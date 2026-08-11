#!/usr/bin/env node
// Dependency-free verification for index.html. Run: node scripts/verify-page.mjs
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];

// ---- contrast helpers (WCAG 2.1 relative luminance) ----
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const L = h => { const [r, g, b] = hex(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = L(a), y = L(b); const [hi, lo] = x > y ? [x, y] : [y, x]; return (hi + 0.05) / (lo + 0.05); };

// ---- read custom properties out of :root ----
const varOf = name => {
  const m = style.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
};

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

check('palette variables declared with the specified values', () => {
  const want = { bg: '#0f1115', panel: '#161920', ink: '#ececee', muted: '#9aa0a8', faint: '#7f858d', accent: '#df8544' };
  const bad = Object.entries(want).filter(([k, v]) => (varOf(k) || '').toLowerCase() !== v);
  return bad.length ? `wrong or missing: ${bad.map(([k, v]) => `--${k} (want ${v}, got ${varOf(k)})`).join(', ')}` : true;
});

check('no red values anywhere in the stylesheet', () => {
  const banned = /#ff2a2a|#cc0000|#ff5b5b|#ff4d4d|#ff6b6b|#990000|#240707|rgba\(\s*255\s*,\s*0\s*,\s*0|rgba\(\s*255\s*,\s*42\s*,\s*42|rgba\(\s*122\s*,\s*0\s*,\s*0/gi;
  const hits = style.match(banned);
  return hits ? `${hits.length} occurrence(s): ${[...new Set(hits)].join(', ')}` : true;
});

check('no glow: zero text-shadow and zero box-shadow declarations', () => {
  const t = style.match(/text-shadow\s*:/g) || [];
  const b = style.match(/box-shadow\s*:/g) || [];
  return t.length || b.length ? `${t.length} text-shadow, ${b.length} box-shadow` : true;
});

check('no background-clip:text and no .gradient-text class', () => {
  const clip = /background-clip\s*:\s*text/.test(style);
  const cls = /\.gradient-text/.test(style) || /class="[^"]*gradient-text/.test(html);
  return clip || cls ? `background-clip:text=${clip}, gradient-text class=${cls}` : true;
});

check('no carbon weave and no red ambient wash', () => {
  const weave = /background-image:[^;]*linear-gradient\(207deg/.test(style);
  const wash = /body::after/.test(style);
  return weave || wash ? `weave=${weave}, body::after=${wash}` : true;
});

check('no pixel hover lifts (skip-link percentage transform is allowed)', () => {
  const hits = style.match(/translateY\(-\d+px\)/g);
  return hits ? `${hits.length}: ${[...new Set(hits)].join(', ')}` : true;
});

check('logo drop-shadow removed', () =>
  /\.brand-logo[^}]*drop-shadow/.test(style) ? 'drop-shadow still on .brand-logo' : true);

check('stats are not monospace and carry no panel', () => {
  const m = style.match(/\.stats\s*\{([^}]*)\}/);
  if (!m) return '.stats rule not found';
  const body = m[1];
  const bad = [];
  if (/font-family/.test(body)) bad.push('font-family present');
  if (/background/.test(body)) bad.push('background present');
  if (/border\s*:/.test(body)) bad.push('border present');
  return bad.length ? bad.join(', ') : true;
});

check('stats hanging indent retained', () =>
  /\.stats li\s*\{[^}]*padding-left:\s*15px[^}]*text-indent:\s*-15px/.test(style)
    ? true : 'hanging indent missing from .stats li');

check('badge well retained and light enough for black wordmarks', () => {
  // Was a literal match on #f4f4f5. That pinned one hex without checking the
  // property it existed to guarantee. ISC2 art is transparent with black
  // wordmarks, so what actually matters is that the well stays light enough for
  // black-on-well to clear 4.5:1 — measure that instead of the spelling.
  const m = style.match(/\.flagship-badge img\s*\{([^}]*)\}/);
  if (!m) return '.flagship-badge img rule not found';
  const bg = (m[1].match(/background:\s*(#[0-9a-fA-F]{3,6})/) || [])[1];
  if (!bg) return 'no background colour declared on the badge well';
  const full = bg.length === 4 ? '#' + [...bg.slice(1)].map(c => c + c).join('') : bg;
  const r = ratio('#000000', full);
  return r >= 4.5 ? true : `well ${full} gives only ${r.toFixed(2)}:1 against black wordmarks`;
});

check('accessibility affordances retained', () => {
  const need = [
    ['skip link', /class="skip-link"/.test(html)],
    ['visually-hidden', /visually-hidden/.test(html)],
    ['44px targets', /min-height:\s*44px/.test(style)],
    ['reduced motion', /prefers-reduced-motion/.test(style)],
    ['focus-visible', /:focus-visible/.test(style)],
  ].filter(([, ok]) => !ok).map(([n]) => n);
  return need.length ? `missing: ${need.join(', ')}` : true;
});

check('contrast: every text pair meets 4.5:1', () => {
  const bg = varOf('bg'), panel = varOf('panel');
  const pairs = [
    ['ink on bg', varOf('ink'), bg], ['ink on panel', varOf('ink'), panel],
    ['muted on bg', varOf('muted'), bg], ['muted on panel', varOf('muted'), panel],
    ['faint on bg', varOf('faint'), bg], ['faint on panel', varOf('faint'), panel],
    ['accent on bg', varOf('accent'), bg], ['accent on panel', varOf('accent'), panel],
  ];
  // A pair with an unresolved variable must FAIL, not be silently skipped —
  // otherwise this check passes vacuously on a page it never measured.
  const missing = pairs.filter(([, f, b]) => !f || !b).map(([n]) => n);
  if (missing.length) return `unresolved custom properties, cannot measure: ${missing.join(', ')}`;
  const bad = pairs.filter(([, f, b]) => ratio(f, b) < 4.5)
    .map(([n, f, b]) => `${n} ${ratio(f, b).toFixed(2)}:1`);
  return bad.length ? bad.join(', ') : true;
});

check('every var(--x) reference resolves to a declared property', () => {
  // Renaming --amber to --accent orphans any rule still saying var(--amber).
  // An orphaned reference renders as nothing — a silent visual failure that
  // the hex-pattern checks above cannot see.
  const declared = new Set([...style.matchAll(/--([a-z0-9-]+)\s*:/g)].map(m => m[1]));
  const used = [...style.matchAll(/var\(\s*--([a-z0-9-]+)\s*\)/g)].map(m => m[1]);
  const orphans = [...new Set(used.filter(u => !declared.has(u)))];
  return orphans.length ? `undeclared: ${orphans.map(o => `--${o}`).join(', ')}` : true;
});

check('focus outline uses the accent and resolves', () => {
  const m = style.match(/:focus-visible[^{]*\{([^}]*)\}/);
  if (!m) return ':focus-visible rule not found';
  return /outline:[^;]*var\(--accent\)/.test(m[1])
    ? true : `focus outline does not use var(--accent): ${m[1].trim()}`;
});

check('no emoji', () => {
  const e = html.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu);
  return e ? [...new Set(e)].join(' ') : true;
});

check('8 project cards present, in order', () => {
  const got = [...html.matchAll(/<li class="project">\s*\n\s*<h3>([^<]+)<\/h3>/g)].map(m => m[1].trim());
  const want = ['AI-Enhanced Security Analysis', 'Automated Report Generation', 'Threat Intelligence Integration',
    'Enterprise SOC Infrastructure', 'DNS Behavioral Monitoring (retired)', 'Network Security Architecture',
    'Business Infrastructure Platform', 'Local Speech-to-Text'];
  return JSON.stringify(got) === JSON.stringify(want) ? true : `got ${got.length}: ${got.join(' | ')}`;
});

check('4 flagship badges retained, cert wall replaced by text', () => {
  const marks = [...html.matchAll(/<span class="mark">([^<]+)<\/span>/g)].map(m => m[1].trim());
  const want = ['CISSP', 'CCSP', 'AAISM', 'SecAI+'];
  if (JSON.stringify(marks) !== JSON.stringify(want)) return `flagship marks: ${marks.join(', ')}`;
  if (/class="cert-wall"/.test(html)) return 'cert-wall grid still present';
  const also = ['SecurityX (CASP+)', 'CySA+', 'Security+', 'Network+', 'A+', 'CSAP (Stackable)', 'SentinelOne IR', 'Linux Essentials'];
  const missing = also.filter(c => !html.includes(c));
  return missing.length ? `missing from text line: ${missing.join(', ')}` : true;
});

check('group labels preserved', () =>
  html.includes('Core security') && html.includes('AI security') ? true : 'group labels changed');

check('telemetry strip is intact and machine-generated', () => {
  const block = html.match(/<!-- TELEMETRY:START[\s\S]*?<!-- TELEMETRY:END -->/);
  if (!block) return 'TELEMETRY markers missing — did someone hand-edit the strip out?';
  const b = block[0];
  if (!/class="spark-line"[^>]*d="M/.test(b)) return 'sparkline path missing or empty';
  const rows = [...b.matchAll(/<tr><td>/g)].length;
  if (rows < 12) return `data table has only ${rows} rows; the plot must stay readable without color`;
  if (!/<title id="spark-title">/.test(b)) return 'sparkline has no accessible title';
  return true;
});

/* The whole point of the strip is that its numbers are measured and dated. A
   stamp nobody refreshes decays into exactly the unverifiable counter this site
   has already had to strip out once, so let the harness fail before a reader
   catches it. Re-run: node scripts/update-telemetry.mjs (on the SOC host). */
check('telemetry figures are not stale', () => {
  const m = html.match(/<b>([A-Z][a-z]{2} \d{2}, \d{4}, [^<]+)<\/b>/);
  if (!m) return 'no measurement timestamp found in the strip';
  const when = new Date(m[1].replace(/\s[A-Z]{2,4}$/, ''));
  if (isNaN(when)) return `unparseable timestamp: ${m[1]}`;
  const days = (Date.now() - when) / 86400000;
  if (days > 120) return `measured ${Math.round(days)} days ago — re-run scripts/update-telemetry.mjs`;
  return true;
});

// ---- run ----
let failed = 0;
for (const { name, fn } of checks) {
  let r; try { r = fn(); } catch (e) { r = `threw: ${e.message}`; }
  if (r === true) console.log(`PASS  ${name}`);
  else { failed++; console.log(`FAIL  ${name}\n        ${r}`); }
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed ? 1 : 0);
