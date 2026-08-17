#!/usr/bin/env node
/**
 * update-telemetry.mjs — regenerate the measured telemetry strip in index.html.
 *
 *   node scripts/update-telemetry.mjs           # query the cluster and rewrite
 *   node scripts/update-telemetry.mjs --dry     # print the block, change nothing
 *
 * Must be run ON the SOC host: it talks to https://localhost:9200 using the
 * credentials in ~/.elastic_credentials. Everything it emits is a real query
 * result stamped with the time it ran — nothing on the strip is hand-written,
 * which is the entire point of the strip.
 *
 * If the cluster is unreachable it exits non-zero and leaves index.html alone.
 * A stale-but-true strip beats a fresh-but-invented one.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { request } from 'node:https';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = join(ROOT, 'index.html');
const DRY = process.argv.includes('--dry');

/* TLS is verified, not bypassed. The cluster presents a private-CA cert whose
   SANs include DNS:localhost, so pinning the CA gives a real handshake check —
   NODE_TLS_REJECT_UNAUTHORIZED=0 would disable verification process-wide and
   leave this open to anything that can occupy the port. If the CA is missing we
   stop, rather than quietly downgrading to no verification. */
const CA_PATH = process.env.SOC_ES_CA || '/etc/prometheus/certs/ca.crt';
if (!existsSync(CA_PATH)) {
  console.error(`CA not found at ${CA_PATH}. Set SOC_ES_CA to the cluster CA.`);
  console.error('Refusing to run without certificate verification.');
  process.exit(1);
}
const CA = readFileSync(CA_PATH);

/* The index pattern is an OPERATIONAL identifier, not prose, and it is not
   hardcoded here because this repository is public and the real prefix carries
   the host name the rest of the site was scrubbed of.

   It has no default on purpose. The sanitisation pass that scrubbed the prose
   also rewrote this query path, and the renamed pattern matched nothing on the
   cluster — 0 indices against 93 real ones.

   That case survived on an implementation detail, not on any check here. A
   wildcard matching no index returns HTTP *200* with hits.total 0 — not an
   error — so es() resolves happily; it is only because Elasticsearch then omits
   the `aggregations` key entirely that the next line throws and the wrapper
   alerts. Had it returned empty buckets instead, exactly as it does for a real
   index holding no documents, the strip would have regenerated as zeros and
   published clean. So: no default. A wrong-but-plausible one puts the outcome
   back on that coin-flip. Unset stops the run, the same way a missing CA does. */
const ES_INDEX = process.env.SOC_ES_INDEX;
if (!ES_INDEX) {
  console.error('SOC_ES_INDEX is not set. Export the security index pattern');
  console.error('(e.g. SOC_ES_INDEX=<prefix>-security-*) before running.');
  console.error('Refusing to guess: a pattern that matches nothing returns an');
  console.error('empty result, not an error, and would publish a strip of zeros.');
  process.exit(1);
}

function creds() {
  const raw = readFileSync(join(homedir(), '.elastic_credentials'), 'utf8');
  const m = raw.match(/^\s*(?:export\s+)?ELASTIC_PASSWORD=["']?([^"'\n]+)/m);
  if (!m) throw new Error('ELASTIC_PASSWORD not found in ~/.elastic_credentials');
  return 'Basic ' + Buffer.from(`elastic:${m[1]}`).toString('base64');
}

const AUTH = creds();

/* node:https rather than fetch(): fetch has no per-request way to supply a CA
   without pulling in undici as a dependency, and this repo has none. */
function es(path, body) {
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = request({
      host: 'localhost', port: 9200, path, ca: CA,
      method: payload ? 'POST' : 'GET',
      servername: 'localhost',           // SNI must match the SAN
      rejectUnauthorized: true,          // explicit: verify the chain
      headers: {
        Authorization: AUTH,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`${path} -> HTTP ${res.statusCode}`));
        }
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error(`${path} -> timeout`)));
    if (payload) req.write(payload);
    req.end();
  });
}

const fmt = n => n.toLocaleString('en-US');

// ---- gather -----------------------------------------------------------------
const hist = await es(`/${ES_INDEX}/_search`, {
  size: 0,
  query: { range: { '@timestamp': { gte: 'now-24h' } } },
  aggs: { per_hour: { date_histogram: { field: '@timestamp', fixed_interval: '1h', min_doc_count: 0 } } },
});
// Drop the partial buckets at each end so the shape is 23 comparable full hours.
const buckets = hist.aggregations.per_hour.buckets.slice(1, -1);
const series = buckets.map(b => b.doc_count);
const last24 = hist.aggregations.per_hour.buckets.reduce((s, b) => s + b.doc_count, 0);

const cat = await es(`/_cat/indices/${ES_INDEX}?h=docs.count,store.size&bytes=b&format=json`);
const socDocs = cat.reduce((s, r) => s + Number(r['docs.count'] || 0), 0);
const socBytes = cat.reduce((s, r) => s + Number(r['store.size'] || 0), 0);

const epCat = await es('/_cat/indices/*logs-endpoint*?h=docs.count&bytes=b&format=json');
const epDocs = epCat.reduce((s, r) => s + Number(r['docs.count'] || 0), 0);

const figures = [
  { v: fmt(socDocs), k: 'events indexed' },
  { v: fmt(last24), k: 'in the last 24 h' },
  { v: (socBytes / 1e9).toFixed(1) + ' GB', k: 'sensor telemetry' },
  { v: (epDocs / 1e9).toFixed(2) + 'B', k: 'endpoint EDR records' },
];

// ---- plot -------------------------------------------------------------------
// Sparkline, single series: no legend (the caption names it), no axes, no point
// labels. Shape answers "is it steady?"; the table answers "what exactly?".
const W = 320, H = 46, PAD = 3;
const min = Math.min(...series), max = Math.max(...series);
const span = max - min || 1;
const x = i => PAD + (i * (W - PAD * 2)) / (series.length - 1);
const y = v => H - PAD - ((v - min) / span) * (H - PAD * 2);
const pts = series.map((v, i) => [x(i), y(v)]);
const d = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');

// Path length for the draw-on keyframe; polyline sum is exact for a polyline.
const len = Math.ceil(pts.reduce((s, p, i) => i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0, 0));

const hourLabel = i => new Date(buckets[i].key).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
const hits = pts.map(([px], i) =>
  `<rect class="spark-hit" x="${(px - (W / series.length) / 2).toFixed(1)}" y="0" ` +
  `width="${(W / series.length).toFixed(1)}" height="${H}"><title>${hourLabel(i)} — ${fmt(series[i])} events</title></rect>`
).join('\n            ');

const [ex, ey] = pts[pts.length - 1];
const stamp = new Date().toLocaleString('en-US', {
  year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
});

const rows = series.map((v, i) => `<tr><td>${hourLabel(i)}</td><td>${fmt(v)}</td></tr>`).join('');

const block = `<!-- TELEMETRY:START — generated by scripts/update-telemetry.mjs, do not hand-edit -->
        <section class="telemetry" aria-labelledby="telemetry-title">
            <h2 class="telemetry__eyebrow" id="telemetry-title">Measured, not asserted &middot; <b>${stamp}</b></h2>
            <div class="telemetry__row">
                ${figures.map(f => `<div class="telemetry__fig"><span class="v">${f.v}</span><span class="k">${f.k}</span></div>`).join('\n                ')}
                <div class="telemetry__plot">
                    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-labelledby="spark-title">
                        <title id="spark-title">Events per hour over the last ${series.length} hours, ranging from ${fmt(min)} to ${fmt(max)}</title>
                        <path class="spark-line" style="--len:${len}px" stroke-dasharray="${len}" d="${d}"/>
                        <circle class="spark-end" cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="4"/>
                        ${hits}
                    </svg>
                </div>
            </div>
            <p class="telemetry__caption">Events per hour across Suricata and Zeek &mdash; peak ${fmt(max)}, floor ${fmt(min)}. Regenerated from the cluster by <code>scripts/update-telemetry.mjs</code>.</p>
            <table class="visually-hidden">
                <caption>Events per hour, last ${series.length} hours</caption>
                <thead><tr><th scope="col">Hour</th><th scope="col">Events</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </section>
        <!-- TELEMETRY:END -->`;

if (DRY) { console.log(block); process.exit(0); }

const html = readFileSync(PAGE, 'utf8');
const re = /<!-- TELEMETRY:START[\s\S]*?<!-- TELEMETRY:END -->/;
if (!re.test(html)) { console.error('markers not found in index.html'); process.exit(1); }
writeFileSync(PAGE, html.replace(re, block));

console.log(`telemetry updated ${stamp}`);
console.log(`  ${fmt(socDocs)} events / ${(socBytes / 1e9).toFixed(1)} GB, ${fmt(last24)} in 24h`);
console.log(`  sparkline: ${series.length} hours, ${fmt(min)}..${fmt(max)}`);
