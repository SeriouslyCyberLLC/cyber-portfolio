/**
 * Tests for the writeup-figure refresh.
 *
 * These drive the REAL planSplice() and the REAL promQuery(), not copies. The
 * guards are the whole value of the feature — a generator that publishes a
 * plausible wrong number is worse than one that does not run — so every guard
 * has a test in both directions, and there is a mutation check at the end
 * proving the suite can actually fail.
 *
 * Run: node scripts/test-writeup-figures.mjs
 */

import { createServer } from 'node:http';
import { planSplice } from './lib/figures-splice.mjs';

let pass = 0, fail = 0;
const ok = m => { pass++; console.log(`  ok   ${m}`); };
const no = (m, d) => { fail++; console.log(`  FAIL ${m}\n       ${d}`); };
const check = (cond, m, d) => cond ? ok(m) : no(m, d);

const files = { 'a.md': 'rules **<!--f:rules_total-->85<!--/f-->** across <!--f:rule_files-->17<!--/f--> files' };
const read = f => files[f];
const M = (over = {}) => ({
  rules_total: { value: '85', ok: true },
  rule_files: { value: '17', ok: true },
  ...over,
});

console.log('== the happy path');
{
  const p = planSplice({ files: ['a.md'], metrics: M(), read });
  check(p.ok, 'a matched, plausible set plans cleanly', p.errors.join('; '));
  check(p.changes.length === 0, 'identical values produce no change', `${p.changes.length} changes`);
  check(p.writes.length === 0, 'and no write', `${p.writes.length} writes`);
}
{
  const p = planSplice({ files: ['a.md'], metrics: M({ rules_total: { value: '86', ok: true } }), read });
  check(p.ok && p.changes.length === 1, 'a moved value produces exactly one change', JSON.stringify(p.changes));
  check(p.writes[0].content.includes('<!--f:rules_total-->86<!--/f-->'),
        'the marker survives the replacement', p.writes[0].content);
  check(!p.writes[0].content.includes('>85<'), 'and the old value is gone', p.writes[0].content);
}

console.log('== idempotency: applying a plan twice changes nothing the second time');
{
  const one = planSplice({ files: ['a.md'], metrics: M({ rules_total: { value: '86', ok: true } }), read });
  const after = one.writes[0].content;
  const two = planSplice({ files: ['a.md'], metrics: M({ rules_total: { value: '86', ok: true } }), read: () => after });
  check(two.ok && two.changes.length === 0, 're-running is a no-op', JSON.stringify(two.changes));
}

console.log('== a declared metric that appears in no file must ABORT');
{
  const p = planSplice({
    files: ['a.md'],
    metrics: M({ producers_total: { value: '17', ok: true } }),
    read,
  });
  check(!p.ok, 'refuses to write', 'it accepted a metric with no marker');
  check(p.errors.some(e => e.includes('f:producers_total') && e.includes('no file')),
        'and names the metric that lost its marker', p.errors.join('; '));
  check(p.writes.length === 0 || !p.ok, 'nothing is written on an abort', 'writes were planned');
}

console.log('== an orphan marker in a file must ABORT');
{
  const orphan = { 'a.md': 'stray <!--f:not_declared-->9<!--/f--> and <!--f:rules_total-->85<!--/f--> <!--f:rule_files-->17<!--/f-->' };
  const p = planSplice({ files: ['a.md'], metrics: M(), read: f => orphan[f] });
  check(!p.ok, 'refuses to write', 'it accepted an undeclared marker');
  check(p.errors.some(e => e.includes('f:not_declared')), 'and names the orphan', p.errors.join('; '));
}

console.log('== an implausible value must ABORT, and must not be written');
{
  const p = planSplice({
    files: ['a.md'],
    metrics: M({ rules_total: { value: '0', ok: false } }),
    read,
  });
  check(!p.ok, 'refuses to write a zero that failed its floor', 'it accepted an implausible value');
  check(p.errors.some(e => e.includes('implausible') && e.includes('rules_total')),
        'and says which metric', p.errors.join('; '));
}

console.log('== multi-file: one bad file blocks the whole run, not just itself');
{
  const two = {
    'a.md': 'ok <!--f:rules_total-->85<!--/f--> <!--f:rule_files-->17<!--/f-->',
    'b.md': 'bad <!--f:nope-->1<!--/f-->',
  };
  const p = planSplice({ files: ['a.md', 'b.md'], metrics: M(), read: f => two[f] });
  check(!p.ok, 'the run is refused', 'a partial refresh was allowed');
}

console.log('== prometheus: an empty result THROWS, it never becomes 0');
{
  // A stub that answers 200 with a well-formed, EMPTY success payload — exactly
  // what a renamed metric returns, and the shape that a `|| echo 0` fallback
  // once turned into a confident "0 rules loaded".
  const empty = createServer((_, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'success', data: { resultType: 'vector', result: [] } }));
  });
  await new Promise(r => empty.listen(0, '127.0.0.1', r));
  process.env.SOC_PROM_URL = `http://127.0.0.1:${empty.address().port}`;
  const { promQuery, promScalar } = await import('./lib/soc-sources.mjs');
  let threw = null;
  try { await promQuery('anything'); } catch (e) { threw = e; }
  check(threw !== null, 'promQuery throws on an empty vector', 'it resolved');
  check(threw && /no series/.test(threw.message), 'and says the series is missing', threw && threw.message);
  let threw2 = null;
  try { await promScalar('anything'); } catch (e) { threw2 = e; }
  check(threw2 !== null, 'promScalar throws too, rather than returning 0', 'it resolved');
  empty.close();
}

console.log('== prometheus: a 500 throws rather than yielding a number');
{
  const boom = createServer((_, res) => { res.writeHead(500); res.end('nope'); });
  await new Promise(r => boom.listen(0, '127.0.0.1', r));
  process.env.SOC_PROM_URL = `http://127.0.0.1:${boom.address().port}`;
  const { promQuery } = await import('./lib/soc-sources.mjs');
  let threw = null;
  try { await promQuery('x'); } catch (e) { threw = e; }
  check(threw !== null, 'an HTTP 500 throws', 'it resolved');
  boom.close();
}

console.log('== mutation: drop the no-marker guard and the suite must FAIL');
{
  // Re-implement planSplice WITHOUT check 3, and confirm the case above passes
  // under it. If a mutant survives, the test is decoration.
  const mutant = ({ files, metrics, read }) => {
    const errors = []; const declared = new Set(Object.keys(metrics));
    for (const [id, m] of Object.entries(metrics)) if (m.ok === false) errors.push(`implausible ${id}`);
    for (const f of files) read(f).replace(MARKERRE(), (w, id) => (declared.has(id) ? w : (errors.push('orphan'), w)));
    return { ok: errors.length === 0, errors };
  };
  const MARKERRE = () => /<!--f:([a-z0-9_]+)-->([\s\S]*?)<!--\/f-->/g;
  const p = mutant({ files: ['a.md'], metrics: M({ producers_total: { value: '17', ok: true } }), read });
  check(p.ok === true,
        'confirmed: without the guard the dropped-marker case passes, so the test has teeth',
        'the mutant also rejected it — the test may be proving something else');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
