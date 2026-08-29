#!/usr/bin/env node
// Renders index.html in headless Chrome and reports what only a real layout engine
// knows: console errors, failed resource loads, horizontal overflow, and whether every
// card actually has a box on the page.
//
// Why this exists: on 2026-08-29 the page shipped reading "9 Systems Built" above
// eleven cards. Every static check passed — the number was in the HTML the whole time
// and nothing was looking at it. Static checks read what the file SAYS; this reads what
// a browser DOES with it. Both are needed.
//
// Dependency-free on purpose, like the rest of this harness: it drives Chrome over the
// DevTools Protocol using the WebSocket built into Node 22+. No puppeteer, no install.
//
// Not a screenshot differ. It answers "did this render without breaking", not "does it
// look right" — that judgement stays with a human.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME_CANDIDATES = [
  'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Resolved by walking PATH directly rather than shelling out to `command -v`. No shell
// means no quoting or metacharacter concerns, and it works the same on any platform.
export function findChrome() {
  const dirs = (process.env.PATH || '').split(':').filter(Boolean);
  for (const c of CHROME_CANDIDATES) {
    if (c.includes('/')) { if (existsSync(c)) return c; continue; }
    for (const d of dirs) {
      const p = join(d, c);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

/** Minimal CDP client over the port Chrome reports in DevToolsActivePort. */
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = []; }

  static async attach(port, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    let target;
    while (Date.now() < deadline) {
      try {
        const list = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
        target = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
        if (target) break;
      } catch { /* browser not up yet */ }
      await sleep(100);
    }
    if (!target) throw new Error('no page target exposed by Chrome');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error('CDP websocket failed to open')), { once: true });
      setTimeout(() => rej(new Error('CDP websocket open timed out')), timeoutMs);
    });

    const c = new CDP(ws);
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && c.pending.has(msg.id)) {
        const { resolve, reject } = c.pending.get(msg.id);
        c.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) {
        for (const fn of c.listeners) fn(msg);
      }
    });
    return c;
  }

  send(method, params = {}, timeoutMs = 15000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`${method} timed out`));
      }, timeoutMs);
    });
  }

  on(fn) { this.listeners.push(fn); }
  close() { try { this.ws.close(); } catch { /* already gone */ } }
}

/**
 * Render `fileUrl` at each width in `widths` and report what broke.
 * Resolves to { consoleErrors, failedRequests, viewports: [{width, scrollWidth, overflow}],
 *               cards: {count, zeroSized} }.
 */
export async function probe(fileUrl, { chrome, widths = [1440, 390], quietMs = 700 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'verify-page-'));
  const child = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    '--disable-extensions', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--allow-file-access-from-files',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

  const cleanup = () => {
    try { child.kill('SIGKILL'); } catch { /* already dead */ }
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
  };

  try {
    // Chrome writes the chosen port here once the debugging server is listening.
    const portFile = join(profile, 'DevToolsActivePort');
    const deadline = Date.now() + 15000;
    let port = null;
    while (Date.now() < deadline) {
      if (existsSync(portFile)) {
        const first = readFileSync(portFile, 'utf8').split('\n')[0].trim();
        if (first) { port = Number(first); break; }
      }
      if (child.exitCode !== null) throw new Error(`Chrome exited early (code ${child.exitCode})`);
      await sleep(100);
    }
    if (!port) throw new Error('Chrome never reported a debugging port');

    const cdp = await CDP.attach(port);
    const consoleErrors = [], failedRequests = [];

    cdp.on(msg => {
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        consoleErrors.push(d.exception?.description || d.text || 'uncaught exception');
      } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
        const e = msg.params.entry;
        // favicon is requested by the browser, not the document; not a page defect.
        if (!/favicon\.ico/.test(e.url || '')) consoleErrors.push(e.text);
      } else if (msg.method === 'Network.loadingFailed') {
        const p = msg.params;
        if (!p.canceled) failedRequests.push(`${p.type}: ${p.errorText}`);
      }
    });

    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Network.enable');
    await cdp.send('Page.enable');

    const viewports = [];
    let cards = null;

    for (const width of widths) {
      /* mobile:false deliberately. With mobile emulation Chrome applies the
         viewport-meta machinery and will WIDEN the layout viewport to fit overflowing
         content — window.innerWidth came back as 1200 at a 390px viewport — so any
         scrollWidth-vs-innerWidth comparison silently compares a number to itself and
         can never detect overflow. mobile:false pins the layout viewport to exactly the
         width asked for; media queries still key off that width, which is what a
         layout test needs. */
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width, height: 900, deviceScaleFactor: 1, mobile: false,
      });

      const loaded = new Promise(res => {
        const fn = m => { if (m.method === 'Page.loadEventFired') res(); };
        cdp.on(fn);
        setTimeout(res, 15000); // fall through; the metric read below is the real gate
      });
      await cdp.send('Page.navigate', { url: fileUrl });
      await loaded;
      await sleep(quietMs); // let fonts settle so widths are final

      const { result } = await cdp.send('Runtime.evaluate', {
        returnByValue: true,
        expression: `(() => {
          const de = document.documentElement;
          const cardEls = [...document.querySelectorAll('li.project')];
          return {
            scrollWidth: de.scrollWidth,
            innerWidth: window.innerWidth,
            cardCount: cardEls.length,
            zeroSized: cardEls
              .map((el, i) => ({ i, h: el.getBoundingClientRect().height, w: el.getBoundingClientRect().width,
                                 title: el.querySelector('h3')?.textContent?.trim() || '(no h3)' }))
              .filter(c => c.h < 1 || c.w < 1)
              .map(c => c.title),
          };
        })()`,
      });
      const v = result.value;
      /* Measured against the width WE set, never against window.innerWidth — see the
         note on setDeviceMetricsOverride above. 1px of slack because sub-pixel layout
         rounding is not a horizontal scrollbar. */
      viewports.push({
        width, scrollWidth: v.scrollWidth, innerWidth: v.innerWidth,
        overflow: v.scrollWidth > width + 1,
      });
      cards = { count: v.cardCount, zeroSized: v.zeroSized };
    }

    cdp.close();
    return { consoleErrors, failedRequests, viewports, cards };
  } finally {
    cleanup();
  }
}
