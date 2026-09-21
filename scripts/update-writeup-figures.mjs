/**
 * Refresh the live figures embedded in the project writeups.
 *
 * WHY. The homepage telemetry strip has regenerated itself daily for weeks. Every
 * other number on this site was a hand-taken reading, and the 2026-09-20 audit
 * found nine of them stale across four writeups — rule counts, cluster scale,
 * producer counts, hardening scores — while the pages above them claimed
 * "every figure was read from the running system". The claim was the problem: a
 * dated reading going stale is ordinary, a standing guarantee going stale is a
 * credibility failure. So the figures that CAN refresh themselves now do.
 *
 * Markers are HTML comments, which GitHub renders as nothing:
 *
 *     ... an environment total of **<!--f:rules_total-->85<!--/f--> alert rules**
 *
 * The prose reads normally and the value is replaced in place.
 *
 * FOUR RULES, each one a failure this repository has already had:
 *
 *  1. EVERY VALUE IS GATHERED BEFORE ANY FILE IS WRITTEN. A partial refresh
 *     would leave some figures current and some stale with nothing marking
 *     which, and the page would still carry one date for all of them.
 *
 *  2. A METRIC THAT CANNOT BE MEASURED ABORTS THE RUN. It never falls back to
 *     the value already on the page, and it never renders as 0. `|| echo 0` on
 *     an unreachable endpoint once reported "0 rules loaded" for a deploy that
 *     had fully succeeded, and an ES pattern matching nothing returns 200 with
 *     an empty result rather than an error.
 *
 *  3. A DECLARED METRIC THAT APPEARS IN NO FILE IS AN ERROR, and so is a marker
 *     in a file that is not declared here. Those are the two ways a figure goes
 *     back to being hand-maintained without anyone noticing: someone rewrites a
 *     sentence and drops the marker, and that number silently stops updating
 *     while the page keeps its "read live" stamp. This is the same shape as an
 *     exporter whose metrics freeze at their last values.
 *
 *  4. PLAUSIBILITY FLOORS. Each metric declares a minimum. Zero rules, zero
 *     indices or zero documents mean the query was wrong, not that the estate
 *     emptied overnight.
 *
 * Run: node scripts/update-writeup-figures.mjs [--dry]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { es, esIndex, promScalar, promByRole, promRuleTotals, hostRoles } from './lib/soc-sources.mjs';
import { planSplice } from './lib/figures-splice.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');

const FILES = [
  'projects/soc-infrastructure.md',
  'projects/hardening-telemetry.md',
  'projects/integrity-and-malware-scanning.md',
];

const fmt = n => Math.round(n).toLocaleString('en-US');
const tb = bytes => (bytes / 1e12).toFixed(2);
const billions = docs => (docs / 1e9).toFixed(2) + 'B';
const pct = (part, whole) => ((part / whole) * 100).toFixed(1);

// ---- gather -----------------------------------------------------------------
// Anything that throws in here aborts before a single file is touched.

const roles = hostRoles();
const SENSOR = esIndex();

async function catTotals(pattern) {
  const rows = await es(`/_cat/indices/${pattern}?h=docs.count,store.size&bytes=b&format=json`);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`_cat/indices/${pattern} returned no indices`);
  }
  return {
    docs: rows.reduce((s, r) => s + Number(r['docs.count'] || 0), 0),
    bytes: rows.reduce((s, r) => s + Number(r['store.size'] || 0), 0),
    indices: rows.length,
  };
}

const clusterStats = await es('/_cluster/stats');
const cluster = {
  docs: clusterStats.indices.docs.count,
  bytes: clusterStats.indices.store.size_in_bytes,
  indices: clusterStats.indices.count,
};
const endpoint = await catTotals('*logs-endpoint*');
const sensor = await catTotals(SENSOR);
const other = {
  docs: cluster.docs - endpoint.docs - sensor.docs,
  bytes: cluster.bytes - endpoint.bytes - sensor.bytes,
  indices: cluster.indices - endpoint.indices - sensor.indices,
};

const ruleTotals = await promRuleTotals();
const producersTotal = await promScalar('tepes_freshness_producers_configured');
const producersFloor = await promScalar('count(tepes_producer_min_docs_last_24h)');
const aideEntries = await promScalar('tepes_aide_entries_total');
const lynisIndex = await promByRole('tepes_lynis_hardening_index', roles);
const lynisSugg = await promByRole('tepes_lynis_suggestions_total', roles);
const chkSusp = await promByRole('tepes_chkrootkit_suspicious_files', roles);
const chkChecks = await promByRole('tepes_chkrootkit_checks_total', roles);

const asof = new Date().toISOString().slice(0, 10);

/* id -> { value, ok }. `ok` is the plausibility assertion; false means the
   query was wrong, not that the estate changed. Floors are deliberately loose:
   they catch a collapsed query, not real movement. */
const METRICS = {
  asof: { value: asof, ok: null },

  cluster_docs: { value: billions(cluster.docs), ok: cluster.docs > 1e9 },
  cluster_tb: { value: tb(cluster.bytes), ok: cluster.bytes > 1e11 },
  cluster_indices: { value: fmt(cluster.indices), ok: cluster.indices > 10 },

  endpoint_docs: { value: billions(endpoint.docs), ok: endpoint.docs > 1e8 },
  endpoint_tb: { value: tb(endpoint.bytes), ok: endpoint.bytes > 1e10 },
  endpoint_indices: { value: fmt(endpoint.indices), ok: endpoint.indices > 0 },
  endpoint_share: { value: pct(endpoint.docs, cluster.docs), ok: endpoint.docs > 0 },

  sensor_docs: { value: billions(sensor.docs), ok: sensor.docs > 1e6 },
  sensor_tb: { value: tb(sensor.bytes), ok: sensor.bytes > 1e9 },
  sensor_indices: { value: fmt(sensor.indices), ok: sensor.indices > 0 },
  sensor_share: { value: pct(sensor.docs, cluster.docs), ok: sensor.docs > 0 },

  other_docs: { value: billions(other.docs), ok: other.docs > 0 },
  other_tb: { value: tb(other.bytes), ok: other.bytes > 0 },
  other_indices: { value: fmt(other.indices), ok: other.indices > 0 },
  other_share: { value: pct(other.docs, cluster.docs), ok: other.docs > 0 },

  rules_total: { value: fmt(ruleTotals.rules), ok: ruleTotals.rules > 10 },
  rule_files: { value: fmt(ruleTotals.files), ok: ruleTotals.files > 1 },

  producers_total: { value: fmt(producersTotal), ok: producersTotal > 1 },
  producers_floor: { value: fmt(producersFloor), ok: producersFloor > 0 },

  aide_entries: { value: fmt(aideEntries), ok: aideEntries > 1000 },

  lynis_index_soc: { value: fmt(lynisIndex.soc_server), ok: lynisIndex.soc_server > 0 },
  lynis_index_second: { value: fmt(lynisIndex.second_host), ok: lynisIndex.second_host > 0 },
  lynis_sugg_soc: { value: fmt(lynisSugg.soc_server), ok: lynisSugg.soc_server >= 0 },
  lynis_sugg_second: { value: fmt(lynisSugg.second_host), ok: lynisSugg.second_host >= 0 },

  chkroot_susp_soc: { value: fmt(chkSusp.soc_server), ok: chkSusp.soc_server >= 0 },
  chkroot_checks_soc: { value: fmt(chkChecks.soc_server), ok: chkChecks.soc_server > 0 },
  chkroot_susp_second: { value: fmt(chkSusp.second_host), ok: chkSusp.second_host >= 0 },
  chkroot_checks_second: { value: fmt(chkChecks.second_host), ok: chkChecks.second_host > 0 },
};

// ---- decide, then write -----------------------------------------------------

const plan = planSplice({
  files: FILES,
  metrics: METRICS,
  read: f => readFileSync(join(ROOT, f), 'utf8'),
});

if (!plan.ok) {
  console.error('ABORT: nothing written.');
  for (const e of plan.errors) console.error(`  ${e}`);
  console.error('');
  console.error('A dropped marker means that figure has gone back to being hand-maintained');
  console.error('and will go stale under a "read live" stamp. An implausible value means the');
  console.error('query was wrong, not that the estate emptied overnight.');
  process.exit(1);
}

if (DRY) {
  console.log(`as of ${asof} — ${plan.matched.size} metrics matched, ${plan.changes.length} would change`);
  for (const c of plan.changes) console.log(`  ${basename(c.file)}  f:${c.id}  ${c.old} -> ${c.next}`);
  if (!plan.changes.length) console.log('  (all figures already current)');
  process.exit(0);
}

for (const w of plan.writes) writeFileSync(join(ROOT, w.file), w.content);

console.log(`writeup figures updated, as of ${asof}`);
console.log(`  ${plan.matched.size} metrics, all matched across ${FILES.length} files`);
if (!plan.changes.length) console.log('  no figure changed');
for (const c of plan.changes) console.log(`  ${basename(c.file)}  f:${c.id}  ${c.old} -> ${c.next}`);
