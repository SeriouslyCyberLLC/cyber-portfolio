# The Backup That Had Never Run: restic to object storage, and five defects in reviewed code

**Status:** Deployed and running daily, September 2026. Figures come from the service's own
logs, its exported metrics, or the git history of the deployment scripts, measured on
2026-09-20 except where a row is labelled with its own date. Repository size and snapshot
count grow daily.

The risk register had one line on it I could not close: the SOC was a single point of
failure. Detections, configuration and five git repositories whose only remote was a bare
repository on the same box all lived on one machine, protected by a local backup written to
the same physical disk as the thing it was backing up.

The tooling to fix that (a restic backup to Cloudflare R2, systemd units, a metrics
exporter, five alert rules) was committed on 2026-08-29 as a Backblaze B2 design, rewritten
for Cloudflare R2 on 2026-08-31, with the last pre-deploy commits landing 2026-09-09. It was not
deployed until 2026-09-13.

> **Everything in it had been read. None of it had been run.**
> Five separate defects stood between the committed code and a single working snapshot, and
> the first one made the deployment script exit silently before printing a word.

## What it protects, and what it deliberately doesn't

An **include list, not a whole-filesystem sweep with excludes.** The direction matters:

| approach | failure mode |
|---|---|
| exclude list | fails **open**: a path you forget to exclude ships silently |
| include list | fails **closed**: a path you forget is absent, and visible in the snapshot listing |

In: the detection configs, the SOC scripts and their configuration, the credential files,
the crontab, the systemd timer list, and every local git repository. Out: ~2.4 TB of
Elasticsearch telemetry, which is regenerable, retention-governed, and does nothing for
recovery.

The crontab earns a special mention. It lives in `/var/spool/cron`, which no include path
covers, and it is the least reproducible thing on the box. The backup script dumps it before
restic runs, along with the systemd timer list, because `crontab -l` doesn't show timers
and `systemctl list-timers` doesn't show cron, and this host schedules work through both.

**Measured, because the spec's estimate was 150× wrong:**

| backup set | size |
|---|---|
| include list, no exclusions | ~37 GB |
| with the first draft of the exclude file | 15,811 MB |
| after excluding the live database directory | **179 MB** |

The first draft excluded directories named exactly `venv` or `.venv`. The three virtualenvs
in one repo are named `venv`, `velo-ai-venv` and `rag-system/rag-venv`: 21.5 GB, and two of
the three didn't match. **Find virtualenvs by `pyvenv.cfg`, never by guessing the name.**

## The five defects

None of these were visible by reading the code. Each needed a run.

### 1. The password step was described, never written

The setup script defined the password file path, exported it for restic, and never created
the file. The design document describes the step in full, 32 characters, printed once,
refuses to continue without acknowledgement. None of it existed in code. It shipped because
**the design document was read instead of the program**, which is the exact failure the
document itself warns about.

```
Fatal: Resolving password failed: /etc/.../restic-password does not exist
```

### 2. Generating the password could never succeed

```bash
PW=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32)
```

`head` exits the moment it has 32 bytes and closes the pipe. `tr` dies of **SIGPIPE, exit
141**. Under the script's own `set -euo pipefail`, `pipefail` promotes that status and `set
-e` kills the script, before the banner, before any echo, with **no error text at all**.

100% reproducible, so that step had never once worked since it was written. **A silent exit
under `set -e` is indistinguishable from a script that finished**, which is why it cost
three operator runs to find. Fixed by removing the SIGPIPE rather than masking it: `|| true`
would also have swallowed a genuinely broken `/dev/urandom`.

### 3. The size gate measured a different set than restic would upload

The pre-flight size check carried its own hardcoded exclusion list, in three places, and it
drifted from the real exclude file the moment that file changed. After the database
directory was excluded, restic's real set was 179 MB while the gate still reported 1,830 MB
and blocked the deployment, twice, on a backup set that was already correct.

**A gate that measures something other than what the tool will do is wrong in both
directions:** it cries wolf on a healthy set, and it would stay silent about a genuinely
huge path that happened to match one of its private patterns. The patterns are now
translated from the exclude file once and reused by every consumer. An empty translation
aborts rather than measuring the unfiltered tree, because reporting a huge number reads as
"your backup set exploded" instead of "the exclude file could not be read".

### 4. Ninety per cent of the backup was a live database

`/.../tia/data/postgres` is the running bind mount of a Postgres container: **1,644 MB of heap
files and write-ahead log out of an 1,830 MB set.** restic reads those files while Postgres
is writing them, producing a torn snapshot that may refuse to start or, worse, start and be
subtly wrong.

**A file-level copy of a running cluster is not a backup of that cluster.** It is now
excluded, with `pg_dump` writing the schema and the feed configuration into the staging
directory the include list already covers. The two changes belong together: excluding the
directory *without* adding the dump would have dropped the data entirely.

The database user is read from **the container's own environment**, never assumed. On the
second host, `pg_dumpall -U postgres` had already failed outright with `role "postgres" does
not exist`, because that image was created with a different superuser. The Postgres image
creates only the role it is told to.

### 5. It worked by hand and failed under systemd

The first real timed run died on:

```
unable to locate cache directory: neither $XDG_CACHE_HOME nor $HOME are defined
```

**systemd sets no `$HOME`**, even for a service running as root, and restic refuses to run
rather than proceeding without a cache. The repository had initialised perfectly by hand,
because an interactive shell has `$HOME`, and then failed the moment the timer ran it,
which is the only way it will ever actually run. The cache directory is now pinned in the
**scripts** rather than the unit files, so it survives being invoked by hand, from cron, or
from a future unit written by someone who didn't read the comment.

### Bonus: a credential written into the one field everything prints

A real run pasted the Cloudflare **API token** into the *account ID* prompt. The script
accepted it silently and wrote it into the repository URL. A live secret in the one value
of that file that everything echoes, including restic at init and the diagnostic that found
it. Nothing would ever have flagged it as a credential. The account ID isn't secret; the
token is. Swapping them turns a public identifier into an exposed one. The prompt now
rejects values with the token prefix by name, requires 32 hex characters, and refuses when
the account ID equals the access key (also 32 hex, and the very next prompt).

## Delete protection instead of a second key

The backup runs `backup` only. **It never runs `forget` and never runs `prune`.**

Object-storage bucket locks are set on the `data/`, `index/`, `snapshots/` and `keys/`
prefixes for 30 days. The intended property is that the credential held on the host can
*add* snapshots but cannot remove existing objects inside the lock window, so a host
compromise does not take the backups with it. That is the design and the lock
configuration was checked against it; it has not been adversarially tested, and no single
control should be read as making a backup ransomware-proof.

**The one prefix deliberately left unlocked is `locks/`**, because restic creates and
removes a lock on every run. Lock that prefix and every backup breaks, permanently.

There is no maintenance key and no pruning path. That was a deliberate trade: at roughly
340 MB plus about 10 MB a day measured across nine increments, the repository stays well
under a 10 GB
free tier, so retention management would cost more than it saves, and pruning is the only
operation that could destroy recoverable data.

**The repository password is the backup.** No recovery path, no vendor escrow. The set
deliberately contains the credential files, because a restore without credentials doesn't
restore a working SOC, which is exactly why that password lives in a separate file from the
storage credentials and never needs to be read by anything that talks to the network.

## Running, measured

| | |
|---|---|
| first successful backup | 2026-09-13: 6,688 files, 120 MB uploaded |
| a representative run (2026-09-17) | 04:31, exit 0, **2.3 s** |
| that run | 7,289 files / 268 MB processed, 205 new, 49 changed, **2.1 MB added** |
| daily increments since | 78 KB to 63 MB |
| alert rules deployed | **6**, byte-identical to the repo copy |
| exporter tests | **26**, passing |

**Failure is not zero, and here it is the whole design.** A failed backup emits
`export_ok=0` and **leaves the last-success timestamp at its previous value**. It does not
write a fresh timestamp, the lie that makes a dead backup look healthy, and does not write
`0`, which renders as 1970 and fires everything at once. Staleness of the *last success* is
the honest signal, and `ResticBackupStale` at 36 hours is the rule that fires if the timer
itself stops, which has happened to four other services on this host.

The exporter deliberately does **not** call restic for a snapshot count or repository size.
That would mean a network round trip inside a post-run hook, where it can hang, making the
backup's failure modes depend on the storage provider's availability.

## A restore drill, because `check` is not a restore

`restic check` proves the repository is structurally sound and its blobs exist. It cannot
tell you the restored bytes land in the right places, or that the most valuable thing in the
set (the git repositories) is usable afterwards.

The drill restores the newest snapshot to a root-only scratch tree and then:

- asserts the files a rebuild can't proceed without are present and non-empty
- compares restored files byte-for-byte against live, **skipping files modified since the
  snapshot**, a file edited since the backup *should* differ, and counting that as a failure
  makes the drill cry wolf every run. It reports the skipped count, so **"0 compared" can
  never render as a pass**
- runs `git fsck` on every restored repository. A tarball of a repo that fails fsck is not a
  recovery
- confirms the database dump parses. Restoring a dump that won't reload is not a database
  backup

It passed on 2026-09-13. **The restored tree contains credentials in the clear**, so it is
root-only, outside the paths the file-integrity monitor watches, and deleted afterwards.
Cadence is quarterly; an untested backup is not a backup.

## The weekly integrity check passed against an empty repository: FIXED

The weekly check runs `restic check --read-data-subset=5%`, reading a rotating subset of
packfiles, because a structure-only check proves the blobs exist without ever reading them.

Its first run, on 2026-09-13 05:34, reported:

```
check snapshots, trees and blobs
[0:00]          0 snapshots
no errors were found
```

Exit 0. The exporter recorded `check_ok 1`. **Both were correct and neither meant anything**,
because the first backup attempt that morning had failed on defect 5 and the first
successful one didn't land until 10:17. The check verified an empty repository and passed.

This is the same shape as a file-integrity scan reporting "no differences" after scanning
zero entries. Neither existing rule can see it: one watches for a check that **fails**, and
this one passed; the other watches for a check that **stops running**, and this one ran on
time. Only the snapshot count separates *verified and sound* from *verified nothing*.

**Fixed with a floor, deployed 2026-09-17.** The check counts snapshots after verifying and
**exits 3** on a pass over zero, saying so in words rather than leaving the reader to notice.
A new metric carries the count and a critical rule fires on `== 0`.

Three details that are the actual design:

- **An unlistable repository records UNKNOWN by omitting the count, never 0.** A failed API
  call must not manufacture the alarming case out of an absence. That inversion is how this
  estate has produced false zeros before.
- **The check now runs the exporter itself**, because the unit's post-run hook doesn't
  execute when the main command fails, which is precisely when the metrics matter most.
- **No second rule for the missing series.** The 10-day staleness rule already covers a check
  that stops running, and two alerts for one silence teaches you to skim past both.

**The tests are the point, given what is being fixed.** They drive the real script with a
fake restic on the path, and cover all four directions: empty repository → exit 3 with the
count recorded and the metrics still exported; populated → exit 0 and silent; unlistable →
UNKNOWN with no count and no invented failure; the underlying check failing → its exit code
propagated.

Then the tests were **mutation-tested**: deleting the floor from the script turns 11 passing
assertions into **9 passed, 2 failed**. A guard against a vacuous pass that cannot itself
fail would be the joke writing itself.

Verified on deployment against the live system rather than the deploy script's own summary:
7 snapshots present, one packfile read back, the metric served by the collector, the rule
loaded and healthy. **It has never fired, and the only vacuous run on record is the one that
prompted it**, the guarantee now exists; it has not been exercised in anger.

Still open: the restore drill ran from a script in a temporary directory, so the script
itself wasn't kept. A drill you can't re-run identically is a demonstration, not a
procedure. It belongs in the repository beside the deployment scripts.

## What this closed, and what it didn't

**Closed:** the only off-site copy of `/etc`, the credentials and the crontab. The five
repositories gained private GitHub remotes on 2026-09-13, the same day this deployed, so
restic is no longer their sole off-site copy, but it remains the only copy of everything
that is not a git repository. Hardware failure is no longer a
total loss.

**Not closed:** this is configuration and code, not telemetry. A restore rebuilds the SOC's
brain, not its memory. Historical events stay on the cluster, under retention policy, by
design.

## Framework mapping

| element | maps to |
|---|---|
| off-site encrypted copies of security configuration and evidence | CIS Controls v8 **11 (Data Recovery)**; NIST CSF 2.0 **PR.DS**, **RC.RP** |
| immutable retention windows on the storage prefixes | CIS **11.3**; ransomware-resilience control for the security stack itself |
| quarterly restore drill with byte comparison and repository fsck | CIS **11.5** (test recovery); SOC 2 **A1.2** availability |
| credential prompt that refuses a pasted secret in a public field | CWE-522; OWASP secrets-handling |
| last-success timestamp never fabricated on failure | NIST CSF 2.0 **DE.CM** (monitoring that can fail honestly) |

## Skills demonstrated

- Backup architecture with an explicit threat model, protecting against the operator's own
  compromised host, not just disk failure
- Object-storage immutability, and the `locks/` exception that makes it usable
- Finding defects that only appear at runtime: SIGPIPE under `set -e`, a missing `$HOME`
  under systemd, verification code that measures the wrong thing
- Telemetry that fails honestly, with alert rules calibrated to the failure that matters
- Recovery testing that can't pass vacuously

**Tech:** restic, Cloudflare R2 (S3 API), systemd timers, Prometheus, Alertmanager,
node-exporter, PostgreSQL `pg_dump`, Bash, Python, pytest

**Scope and limits:** personal lab on owned equipment; no employer or client data or
systems are involved; figures are readings on the dates stated, not guarantees. See
[Scope, sourcing and limits](../DISCLAIMER.md).
