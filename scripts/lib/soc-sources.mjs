/**
 * Shared read-only clients for the two systems the portfolio quotes: the
 * Elasticsearch cluster and Prometheus.
 *
 * WHY THIS FILE EXISTS. update-telemetry.mjs had its own ES client. Adding a
 * second generator with a second copy would have given this repository two
 * definitions of "how we talk to the cluster", free to drift apart — which is
 * the exact failure the whole portfolio is about. One client, two callers.
 *
 * EVERY OPERATIONAL IDENTIFIER COMES FROM THE ENVIRONMENT AND HAS NO DEFAULT.
 * This repository is public. The index prefix and the Prometheus address both
 * carry the host name the prose was scrubbed of, and the instance labels are
 * host names outright. A wrong-but-plausible default is worse than no default:
 * an ES wildcard matching nothing returns HTTP 200 with an empty result rather
 * than an error, so a renamed pattern regenerates as zeros and publishes clean.
 * Unset stops the run.
 */

import { readFileSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';

function required(name, hint) {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} is not set. ${hint}`);
    console.error('Refusing to guess: a wrong identifier can return an empty');
    console.error('result rather than an error, and empty would publish as zero.');
    process.exit(1);
  }
  return v;
}

/* ---- Elasticsearch --------------------------------------------------------- */

const CA_PATH = process.env.SOC_ES_CA || '/etc/prometheus/certs/ca.crt';
let CA, AUTH;

function esInit() {
  if (CA) return;
  try {
    CA = readFileSync(CA_PATH);
  } catch {
    console.error(`cannot read CA at ${CA_PATH}; set SOC_ES_CA`);
    process.exit(1);
  }
  const raw = readFileSync(join(homedir(), '.elastic_credentials'), 'utf8');
  const m = raw.match(/^\s*(?:export\s+)?ELASTIC_PASSWORD=["']?([^"'\n]+)/m);
  if (!m) throw new Error('ELASTIC_PASSWORD not found in ~/.elastic_credentials');
  AUTH = 'Basic ' + Buffer.from(`elastic:${m[1]}`).toString('base64');
}

export function esIndex() {
  return required('SOC_ES_INDEX', 'Export the security index pattern (e.g. SOC_ES_INDEX=<prefix>-security-*).');
}

/* node:https rather than fetch(): fetch has no per-request way to supply a CA,
   and the alternative is disabling verification globally. */
export function es(path, body) {
  esInit();
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = httpsRequest({
      host: 'localhost', port: 9200, path, ca: CA,
      method: payload ? 'POST' : 'GET',
      servername: 'localhost',          // SNI must match the SAN
      rejectUnauthorized: true,         // explicit: verify the chain
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

/* ---- Prometheus ------------------------------------------------------------ */

/* NOT loopback. This host's Prometheus binds its LAN address, and a curl to
   127.0.0.1:9090 returns nothing at all — which a `|| echo 0` fallback once
   turned into a confident "0 rules loaded" against a completely successful
   deploy. Hence: address from the environment, and an unreachable endpoint
   throws rather than resolving to a number. */
function promBase() {
  return required('SOC_PROM_URL', 'Export the Prometheus base URL (e.g. SOC_PROM_URL=http://<addr>:9090).');
}

function promGet(path) {
  const url = new URL(path, promBase());
  const driver = url.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = driver({
      host: url.hostname, port: url.port, path: url.pathname + url.search,
      method: 'GET', headers: { Accept: 'application/json' },
    }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`${url.pathname} -> HTTP ${res.statusCode}`));
        }
        let j;
        try { j = JSON.parse(data); } catch { return reject(new Error(`${url.pathname} -> not JSON`)); }
        if (j.status !== 'success') return reject(new Error(`${url.pathname} -> status ${j.status}`));
        resolve(j.data);
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error(`${url.pathname} -> timeout`)));
    req.end();
  });
}

/**
 * One instant query. Returns an array of { labels, value:Number }.
 *
 * AN EMPTY RESULT THROWS. It is never an empty array the caller might reduce
 * to 0. A metric that has stopped being exported and a metric that is genuinely
 * zero are different facts, and only one of them is safe to publish.
 */
export async function promQuery(query) {
  const d = await promGet(`/api/v1/query?query=${encodeURIComponent(query)}`);
  const r = d.result || [];
  if (!r.length) throw new Error(`prometheus query returned no series: ${query}`);
  return r.map(s => ({ labels: s.metric, value: Number(s.value[1]) }));
}

/** A query that must return exactly one series. */
export async function promScalar(query) {
  const r = await promQuery(query);
  if (r.length !== 1) throw new Error(`expected 1 series, got ${r.length}: ${query}`);
  if (!Number.isFinite(r[0].value)) throw new Error(`non-finite value: ${query}`);
  return r[0].value;
}

/**
 * A per-host query, keyed by ROLE rather than by host name.
 *
 * The instance labels are host names and must never reach a published page, so
 * the mapping lives in the environment beside the other identifiers:
 *   SOC_HOST_ROLES='soc_server=host-a:9100,second_host=host-b:9100'
 * An instance present on the cluster but absent from the mapping is ignored; a
 * role in the mapping with no series throws, because that is a metric that has
 * silently stopped being exported for a host the pages still quote.
 */
export function hostRoles() {
  const raw = required('SOC_HOST_ROLES', "Export role=instance pairs (e.g. SOC_HOST_ROLES='soc_server=a:9100,second_host=b:9100').");
  const map = new Map();
  for (const pair of raw.split(',')) {
    const [role, instance] = pair.split('=').map(s => s && s.trim());
    if (!role || !instance) {
      console.error(`SOC_HOST_ROLES entry is malformed: "${pair}"`);
      process.exit(1);
    }
    map.set(role, instance);
  }
  return map;
}

export async function promByRole(query, roles) {
  const series = await promQuery(query);
  const byInstance = new Map(series.map(s => [s.labels.instance, s.value]));
  const out = {};
  for (const [role, instance] of roles) {
    if (!byInstance.has(instance)) {
      throw new Error(`no series for role "${role}" (instance ${instance}): ${query}`);
    }
    out[role] = byInstance.get(instance);
  }
  return out;
}

/** Alerting-rule and rule-file totals, read from the running server. */
export async function promRuleTotals() {
  const d = await promGet('/api/v1/rules');
  const groups = d.groups || [];
  if (!groups.length) throw new Error('prometheus reports no rule groups');
  const rules = groups.reduce(
    (n, g) => n + (g.rules || []).filter(r => r.type === 'alerting').length, 0);
  const files = new Set(groups.map(g => g.file)).size;
  if (!rules || !files) throw new Error(`implausible rule totals: ${rules} rules / ${files} files`);
  return { rules, files };
}
