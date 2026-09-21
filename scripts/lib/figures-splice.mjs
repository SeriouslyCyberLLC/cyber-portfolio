/**
 * The marker-splice half of update-writeup-figures.mjs, kept separate so the
 * tests drive the SAME code the scheduled job runs.
 *
 * A test that re-implements the logic it is checking proves only that two
 * copies agree — this repository has that lesson written into a shell script
 * already (probe/test_restic_check.sh drives the real script against a fake
 * binary, for the same reason).
 *
 * Gathering lives in the caller because it talks to live systems. Everything
 * that DECIDES whether a refresh is safe to publish lives here.
 */

export const MARKER = /<!--f:([a-z0-9_]+)-->([\s\S]*?)<!--\/f-->/g;

/**
 * @param {object}   o
 * @param {string[]} o.files     relative paths, for messages
 * @param {object}   o.metrics   id -> { value, ok } where ok===false means implausible
 * @param {Function} o.read      (file) => string
 * @returns {{ok:boolean, errors:string[], changes:Array, writes:Array, matched:Set}}
 */
export function planSplice({ files, metrics, read }) {
  const errors = [];
  const changes = [];
  const writes = [];
  const matched = new Set();
  const declared = new Set(Object.keys(metrics));

  // 1. Plausibility first: never write a value we already believe is wrong.
  for (const [id, m] of Object.entries(metrics)) {
    if (m.ok === false) errors.push(`implausible value for f:${id} (${m.value})`);
  }

  // 2. Walk the files, replacing declared markers and recording orphans.
  for (const file of files) {
    const before = read(file);
    const after = before.replace(MARKER, (whole, id, old) => {
      if (!declared.has(id)) {
        errors.push(`orphan marker f:${id} in ${file} is not declared`);
        return whole;
      }
      matched.add(id);
      const next = String(metrics[id].value);
      if (next !== old) changes.push({ file, id, old, next });
      return `<!--f:${id}-->${next}<!--/f-->`;
    });
    if (after !== before) writes.push({ file, content: after });
  }

  // 3. A declared metric that appears nowhere has silently stopped updating.
  //    This is the check that catches a marker dropped during a prose edit, and
  //    it is the whole reason a figure cannot quietly revert to hand-maintained
  //    while the page keeps its "read live" stamp.
  for (const id of declared) {
    if (!matched.has(id)) errors.push(`declared metric f:${id} appears in no file`);
  }

  return { ok: errors.length === 0, errors, changes, writes, matched };
}
