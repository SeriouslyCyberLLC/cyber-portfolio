# An Audit Nobody Reads — putting a number on hardening

**Status:** Live on two Linux hosts. Built August 2026, extended through September. Every
figure below was read from the running monitoring stack at the time of writing, not from my
notes.

Security scanners had been running daily on these machines for months. They worked. They
wrote their findings to disk on schedule. None had ever been read.

That is the whole finding, and it is not a story about installing tools:

> **An audit that runs every day and is never looked at is indistinguishable
> from one that does not run at all.**

The fix was not to repair a scanner. Both scanners were fine. The fix was to turn their
output into a tracked signal, and — the harder half — to decide what was allowed to wake
anyone up.

## The six cases

| # | What reported healthy | What was actually true |
|---|---|---|
| 1 | Hardening auditor running daily, 1.5 MB of output | Nobody had read a single line of it |
| 2 | Rootkit scanner running daily | Findings piped into a mail path that did not exist |
| 3 | `0 updates can be applied immediately` | 30 unpatched CVEs the host could not see |
| 4 | Auto-blocker `active (running)` | 0 blocks executed in the service's entire life |
| 5 | File-integrity monitor scheduled nightly | **Had not run at all for 38 days** — it exited on an error in under a second |
| 6 | Antivirus daemon `active`, signatures loaded | **Nothing ever asked it to scan anything** |

Each is a different way for a system to report a number about itself that is not the
thing itself. The last two are the interesting ones, and they fail in opposite
directions: one was broken and said nothing, the other was in perfect health and
connected to nothing.

## 1. The score nobody tracked

The hardening auditor ran on a daily timer, wrote a report and a 1.5 MB log, and exited
cleanly. There was no defect to fix. There was simply no consumer.

I exported six series to the metrics collector — hardening index, tests performed,
warnings, suggestions, report age, and report readability — and hung the exporter off the
audit unit itself with `ExecStartPost` rather than giving it its own timer.

**That choice is load-bearing.** A separate schedule drifts away from the audit it
reports on, and would happily export a stale score with nothing to indicate staleness.
Hooked to the unit, it fires exactly when there is new data, and a parse failure surfaces
in the audit unit's own status.

### Failure is not zero

The exporter's parser returns nothing on a malformed report — never a zeroed structure.
An unreadable report therefore emits `report_readable=0` **and no score series at all.**

Rendering a missing file as `0` would report it as the worst possible hardening posture
and page accordingly. A monitoring system that invents a plausible number from a failure
is worse than one that stays silent, because the number gets believed. One rule watches
specifically for that state; it is the only thing that can see it.

### What actually improved

A batch that restarted no services, changed no network configuration, and did not touch
remote access: audit tooling, legal banners, login defaults (stricter umask, higher
password hashing rounds, password ageing), four unused network protocols blacklisted,
core dumps disabled, removed-package cruft purged.

Measured from the monitoring stack, 14-day window against today:

| host | hardening index | suggestions | warnings | tests run |
|---|---|---|---|---|
| SOC server | **66 → 71** | 52 → 34 | 2 | 273 |
| second Linux host | **59 → 70** | 51 → 31 | 0 | 277 |

One package was deliberately **not** installed: an interactive bug-notifier that prompts
during package operations and would have hung unattended upgrades. A hardening suggestion
is a suggestion, not an instruction.

### The trend is the point, not the number

An index of 66 is not inherently bad. An index of 66 after a run of 72s means something
specific regressed — and that is exactly what nobody notices by hand.

So the headline rule is a **regression** rule: fire when the index falls more than three
points below its own 14-day maximum. The three-point tolerance is not arbitrary; scores
shift slightly with test-count changes between scanner versions.

A second rule is an absolute floor, and it taught me something. I set it at 60 before I
had measured any real host — calibrated against the only machine I had looked at. The
second host then came in at **59** on a stock install and went straight to pending,
missing an arbitrary line by one point.

Missing a made-up threshold by one point is not a finding. **An alert that fires on day
one for a normal host is how you train yourself to ignore that alert.** The floor is now
50, which means *materially degraded*, and the lesson is to never set a floor just under
whatever the current value happens to be.

**Honest limitation:** a rule that compares against a 14-day maximum has nothing to
compare against until it has 14 days of history. On the day it shipped it could not say
anything useful, and saying so is part of the deliverable.

## 2. A red unit nobody reads

The rootkit scanner on the second host raised findings by piping its report to `mail`.
The mail transport had been installed without a configuration file, so delivery failed,
the wrapper returned non-zero, and the unit sat permanently failed.

The journal shows the two lines back to back: the alert being sent, then the transport
dying on a missing config file.

**The failure is not the undelivered mail. It is that a genuine rootkit detection and a
missing config file produce the identical symptom** — a red unit in a list nobody reads.

Same treatment: export the findings as metrics, hook the exporter to the scan unit, and
disable the mail path outright. Notably this required **no notification credential on
that host at all** — the metrics ride the collector-to-alerting path the hardening
exporter had already established.

### Calibration is the entire point

The scanner reports 142 checks. It also reports, every single day, **29 suspicious
files** — every one of them a false positive. They are package-shipped dotfiles: test
fixtures from a security tool, a `.gitignore` inside a Python library, build-id
directories under the kernel modules tree.

A rule on that warning state would fire every day forever. That is precisely how an
earlier monitor on this network produced 61 pages a day and taught everyone to swipe
notifications away.

So, four rules with sharply different privileges:

| rule | fires on | pages? |
|---|---|---|
| infection detected | `infected > 0` | **yes — the only one.** Has never fired |
| suspicious count jumped | above the 14-day max, tolerance **5** | no |
| report unreadable | `report_readable == 0` | no |
| report stale | older than 3 days | no |

The tolerance of 5 is measured, not guessed: **a kernel upgrade alone adds about two
entries** as new build-id directories appear. That is exactly what raised the one alert
this rule has produced — a kernel reboot, correctly detected, and entirely noise. The
tolerance exists because I went and looked at what normal change costs.

Current state, read live: 0 infected, 29 suspicious, 142 checks, report readable.

### Two scanners, and the order in which to remove one

That host had a **second** rootkit checker installed as well, and it was worse than useless.
It ran, but its weekly database update was gated off, so its baseline was 41 days stale —
and the consequence is legible in its own log: every one of its twelve file-property
warnings was `curl`, `perl` or `wget`. Ordinary patching, reported as tampering, into a
channel nobody read.

**A rootkit checker comparing against a stale baseline is worse than none.** It
manufactures findings from routine work. It was purged, not fixed.

**The order mattered and is the transferable part.** On that host the purge was safe
because the other scanner was already exported with alert rules — the coverage existed
first. When the same pair turned up on the SOC server, *neither* was exported, so removing
either would have left the other equally unread. So the remaining scanner was wired up
first, and **the purge script refuses to run** unless it measures at least five live metric
series and four deployed rules at that moment.

Removing a control because "something else covers it" is only honest if the something else
is verified *as you remove it*, not remembered from a previous session.

**One check had to be suppressed outright**, and it is a good example of what a signature
is worth. One of the scanner's "malware" checks is, in full: list executable regular files
under `/tmp`; if any exist, report `INFECTED`. No signature, no hash, no name match. On two
consecutive days it fired on three different benign files, including the ANSI console
library that the search engine extracts into its private temp directory at every start.
Since the paging rule is `infected > 0`, serving that unfiltered would have paged daily
forever. What is given up is nothing measurable: a check that cannot distinguish a real
DDoS implant from Elasticsearch distinguishes nothing, and execution from `/tmp` is covered
by the endpoint agent, a deterministic severity floor in the triage pipeline, and the
antivirus scan in section 6.

## 3. "0 updates" was not a patched host

The second host runs Ubuntu 24.04. Its login banner reported `0 updates can be applied
immediately` — while separately noting that 35 additional security updates were available
through **ESM Apps**.

Those 35 were CVEs in **universe**, the community-maintained package set.
`unattended-upgrades` can never reach them: it applies security updates from the archives
the host is *subscribed to*, and without an **Ubuntu Pro** subscription the universe
security pocket is not one of them.

> **A host reading "0 updates" is not a patched host. It is a host that cannot see the
> rest.**

After attaching Ubuntu Pro — free for personal use on up to five machines — the count
went from 0 to **30 upgradable packages, every one of them a security update**: the
`ffmpeg` and `libav*` stack, ImageMagick, `libcjson1`, `libmbedcrypto7t64`, `python3-pip`,
Syncthing, and the Prometheus node exporter.

Nothing in the set touched the kernel, `libc`, OpenSSL, systemd, SSH, nginx, or Docker, so
it applied without a reboot and without risking the host's Cloudflare tunnel. Livepatch,
enabled at the same time, covers kernel CVEs between reboots — though it deliberately does
not change the on-disk kernel, so `uname -r` remains the truth for actual kernel upgrades.

**`pro attach` exiting 0 is not proof the services enabled.** Each one is re-read from
`pro status` afterwards and the script fails loudly on any that is not `enabled` — the
same lesson as the mask in section 4. The subscription token is passed via a `0600`
attach-config file, never as a command-line argument: `ps` is world-readable, so
`pro attach <token>` leaks the token to every user on the box for the duration of the call.

### The trap inside the fix

Note what was in that upgrade list: **`prometheus-node-exporter` — the exporter this
whole system reports through.** Its `--collector.textfile.directory` flag lives in
`/etc/default/prometheus-node-exporter`, a dpkg **conffile**, and a package upgrade can
replace a conffile and take the flag with it. Silently, with no error. So the upgrade
runs with `--force-confold` and then verifies.

That is not hypothetical: deploying to this host had already surfaced the same shape.
The textfile directory existed, which made it look configured, but the flag pointing the
exporter at it had never been passed. Everything written there was being discarded
without complaint.

So the upgrade script verifies by **counting the series actually being served**, not by
checking that the config file contains the flag. A file containing a setting is not proof
that the running process received it.

## 4. The control I switched off

The auto-blocker documented in the [SOC assurance audit](assurance-audit.md) — three
layers of automated response, zero blocks executed across its entire lifetime, running
because a reboot had started it rather than because anyone had chosen to — was masked.

Four independent signals confirmed it stopped, not one: no main process, a heartbeat file
gone stale (a live loop rewrites it every ten seconds), zero connections to the datastore,
and nothing in the process table. Its unit file was preserved for restore, and the
freshness monitor's expected-producer count was decremented so its now-correct silence
would never page.

### A verification step that acts on the system must undo its own action

The first attempt to mask it failed in the most instructive way available.

Masking works by placing a symlink where the unit file would be — and it **refuses to
overwrite a real file.** This unit was a real file in that exact path, so the mask
errored. The script printed the error, carried on, and then ran its own *prove the mask
holds* check: start the service and confirm it refuses.

It did not refuse. **The verification step started the service the script existed to
stop**, and the run ended with a cheerful final line reporting the service as disabled
and active in the same breath.

The working sequence moves the unit aside first, then masks. But the durable lesson is
about the check, not the mask: a verification step that *acts* on the system must undo
its own action and fail loudly when the thing it is proving turns out to be false.

## 5. The file-integrity scan that had not run in 38 days

The nightly cron line looked entirely reasonable:

```
0 5 * * * root aide --check | mail -s "Integrity Report" root@localhost
```

Two independent defects, either one fatal:

1. **No `--config`.** This build has no compiled-in default config path, so a bare
   `--check` exits with an error **in under a second**. The scan never ran — not slowly,
   not partially. Not at all, for five weeks.
2. **The pipe to `mail`.** The mail transport had been removed from that host weeks
   earlier — detected, ironically, by this same tool's last working run. So the error text
   went nowhere.

A file-integrity monitor reported a hard error into a dead mail path every night for
38 days, and the only visible symptom was a cron mail failure nobody reads.

**There were two integrity jobs, and only the silent one still fired.** The other lives in
the daily `run-parts` directory and is mode `644` — not executable — so it is skipped
without comment. And the job that *was* firing did not live in root's crontab at all but in
`/etc/cron.d`, which the scheduler logs identically. A fix script that backed up root's
crontab found no matching line, correctly, and then reported "already fixed".

> **This host schedules work from four cron sources plus systemd timers. None of them lists
> the others, and the timer list shows none of the cron sources.** That omission has now
> cost two separate investigations here.

### The stock ruleset was unusable, and subtractive in the wrong direction

The shipped configuration is one line — watch `/`, fully — which matched roughly **two
million files**, including the multi-terabyte search-engine shards on spinning disks that
the SIEM writes thousands of documents a minute into. A dry run was still going after
31 minutes.

Scope is now a **positive** list: boot, binaries, libraries, `/etc`, root's home, SSH keys,
the cron surfaces, the SOC tooling.

**The direction is the point.** The stock config is subtractive — watch everything, then
exclude — which fails **open**: whatever you forget to exclude is silently included. The
replacement fails **closed**, and that is visible in a 40-line file.

| | stock | replacement |
|---|---|---|
| entries scanned | ~2,000,000 | **70,770** (read live) |
| `--check` duration | 717 s, and unbounded | **170 s** (read live) |
| database | 37 MB | 6.8 MB |
| hash algorithms | 8 | 2 |

Incidentally: `timeout` does not stop this tool. It ignores the polite termination signal
during traversal, and a run blew straight past a 900-second limit.

### Alerting on "something changed" would fire every patch Tuesday

A host under active administration always has integrity changes. Over that 38-day gap, the
system library tree alone had 10,432. **Read live today: 3,941 changes in the library tree,
331 in the binaries tree, 63 in `/etc` — and 0 in every area allowed to page.**

Changes are bucketed by **area**, and only four page: SSH keys, boot, local admin binaries,
and the cron surfaces. That is **50 entries against 14,434 of routine churn — a 289:1
reduction**, and it is why the alert is readable at all.

One more distinction that had to be made explicit: a message reading *"entry has different
attributes in the databases"* is **not tampering.** It means the database was built under a
different ruleset than the config now computes — a schema mismatch saying *re-baseline me*.
There were 64,144 of those against 14,484 real changes. Conflating them inflated the area
gauges fivefold and would have spiked them whenever the ruleset was edited: an alert firing
because you changed the alert's own configuration. It is now a separate info-level series,
reading **3** today.

### Calibration, where the filesystem makes a claim it cannot support

The critical-path alert fired three times reporting 20 changes. It was right to fire, and
the finding was benign:

- **19 of the 20 were the EFI system partition**, and the change was **the inode number
  only** — size, permissions and every checksum unchanged. That partition is FAT, which has
  no inodes; the kernel synthesises them and they change on remount. All 19 would have
  recurred forever.
- The 20th was a cron file this project had added the week before.

Fixed by ignoring, on that path only, the one attribute that cannot mean anything on that
filesystem. Content is still fully checksummed, so a tampered bootloader still alerts.

**Two changes survived that fix, and they were a different cause entirely.** The
bootloader's entropy seed file: the loader reads it at every boot, feeds it to the kernel
and **writes a fresh one**. The content changing is the mechanism working, so one of only
four paging areas would have cried wolf after **every single reboot, forever**.

The tell was the inode column — unchanged in both lines, so the earlier FAT rule correctly
left them alone. Two unrelated causes sharing a directory, and conflating them would have
meant "fixing" a rule that was already right.

The seed now has its own rule watching **size and type**, and here is the honest accounting
of what that buys:

| attribute | value on this path |
|---|---|
| **size** | **load-bearing** — the seed is fixed-size with rotating content, so a seed that *grows* means something is stashing data in the boot partition |
| type | catches replacement by a non-file |
| permissions | **near-vacuous** — synthesised from mount options, identical for every file there |
| content hashes | **not watched, and cannot be.** The seed legitimately differs every boot; no rule distinguishes a rotated seed from a substituted one |

That last row is a real gap and it is stated rather than implied.

### The test of that rule passed while testing nothing

The first sandbox test of the seed rule was built in a directory the scanner could not
read. It scanned **0 entries** and reported *"found no differences"* — indistinguishable
from the rule working. Only dumping raw output instead of grepping for a pass string caught
it.

**Assert the baseline entry count before believing any integrity-scan result.** Re-run with
three confirmed entries, all three directions hold: same-size content rotation → no alert;
the file grows → alerts; an ordinary file's content changes → still alerts.

And `0` in an area immediately after a re-baseline **proves nothing** — a re-baseline
produces zeros everywhere. The rule was only proven at the next reboot, with the seed's
checksum confirmed changed before and after and the boot area still reading 0 on a real
check run. An unchanged seed exits *inconclusive*, never *pass*.

### The gap one layer out: a frozen exporter looks perfectly healthy

The report-age metric is computed **at exporter runtime**. So if the cron entry stops firing
— cron dies, the wrapper is renamed, the file is edited badly — the metrics file is simply
never rewritten, the collector keeps serving the last values forever, and the age stays
frozen at whatever it last read. A staleness rule can then never fire, and the
"never reported" rule uses absence, which is also false while the stale file exists.

**A dead integrity pipeline would have reported a perfectly clean, perfectly fresh system
indefinitely** — the same shape as everything else here, displaced one layer outward from
the scan to the exporter.

Closed by watching the metrics file itself as a freshness producer: **its mtime is
liveness, its content is health.** That split only works because the exporter writes the
file **unconditionally**, including on a failed parse, rather than only on success. Both
failure modes were negative-tested against a real probe run: a 30-hour-old file trips the
staleness rule at a 26-hour threshold, and an absent file reports non-existence **with no
age series at all**, so nothing fabricates an age.

## 6. The control that was wired to nothing

Every other case here is a control that lied. This one told the truth and was still
useless.

The antivirus daemon reported `active` and genuinely was. No liveness check, freshness
probe or unit-state alert could ever have caught this, because nothing was faulty — the
control was simply **connected to nothing**.

> **"The process is running" and "the control is doing work" are different claims. Only the
> second one matters.**

| | measured |
|---|---|
| daemon | enabled, active, up nearly five hours |
| signature updater | **disabled**, inactive, no journal entries at all |
| on-access scanning | disabled |
| callers of the scanner — cron, timers, any script | **none** |
| clients on the daemon's socket | **0** |
| signature database | **41 days stale** |

**The proof was in the memory profile, not in any log.** The daemon held **8 MB resident
against 955 MB of swap**: it had loaded 3.6 million signatures at startup, was never asked
to match anything against them, and the kernel paged the entire database out. An
actively-scanning daemon keeps its signatures resident. That number is what turned
"probably idle" into proof.

**An inventory script had been counting the signature total as evidence of a control.** The
number was real and meant nothing. A signature count, a version string and a green unit are
all compatible with scanning zero bytes. **When auditing a control, find its consumer** —
the cron entry, the socket client, the caller — before believing it does anything.

### What runs now

A daily scan at 04:15, running the scan **and** its exporter as one unit — same reasoning
as everywhere else here — at low CPU priority and idle I/O scheduling, because it competes
with the SIEM for the same spinning disks.

| path | mode | measured |
|---|---|---|
| Downloads | full | 0 files — watched *because* it is the ingress point |
| Desktop | full | 2,707 files, 36.7 s |
| document store on the RAID | **incremental** | 72 GB / 4,375 files; first pass 731 s, thereafter only what changed — **0.02 s today** |

Deliberate malware corpora — 1,739 sample files — are excluded **in the scanner**, not
tolerated inside an alert threshold. Alerting on detections you have deliberately stored is
how you get the 61-pages-a-day failure again.

**Baseline measured before any rule was written: 7,082 files, 0 detections, 0 errors.** So
`infected > 0` is signal, not day-one noise.

### Two properties carry this, and both were earned

**An errored path withholds its infected count.** Measured against the real scanner: an
unreadable path exits with an error status **and still prints `Infected files: 0`**. Publish
that zero and a scan of a path that no longer exists is indistinguishable from a clean one.

**A permanent test-signature positive control.** A scanner that has never detected anything
is indistinguishable from one that has silently stopped matching. `positive_control_ok` is
the only metric separating a clean estate from a dead detector — **when it reads 0, every
"0 infected" above it is worthless.** It reads 1 live.

### Three bugs found by testing, all of which would have shipped

- **The endpoint agent quarantines the test file.** A disk-based positive control raised 13
  real malware-prevention alerts and the file was deleted within seconds — so the control
  reported the scanner broken when it was fine, *and* polluted the alert index with
  self-inflicted findings. The control now feeds the test string on **standard input** and
  never touches disk. Incidentally, that is independent proof the endpoint agent's
  prevention mode works.
- **A shell pipeline inverted the result.** The scanner exits non-zero *when it finds
  something*, so under `pipefail` the pipeline returned failure precisely when the control
  **succeeded**. Capture the output first, test it after.
- **A calculator emitted invalid JSON.** A sub-second duration rendered as `.03` — a
  leading dot with no zero — which only breaks on *fast* scans, i.e. the normal case for an
  empty Downloads directory. It would have corrupted the result file on nearly every run.
  The exporter's fail-closed design is what surfaced it, as a collection error rather than
  a false clean.

### The signature age went negative on the first production run

Reported `-12` seconds. The wrapper captured the start time at launch but computed the age
at the **end**, from a timestamp read after the scan — and the deploy had just enabled the
updater, which wrote fresh signatures 12 seconds later, while the document pass ran 731
seconds. So the signatures were genuinely newer than the start time.

It failed safe, but it recurs whenever an update lands mid-scan, which at 24 checks a day
against a multi-minute scan is routine. Now measured against the instant the timestamp is
read and clamped at zero — with **`-1` still reserved for "no signature database at all"**,
a different fact that must not collapse into the same value.

**Scan duration is deliberately not alerted on.** The same unchanged 2,707-file tree took
**4.08 s, 36.17 s and 37.32 s** across three runs — page-cache variance against a disk the
SIEM is hammering. A ceiling calibrated on the fast run would page on every normal cold
scan.

## What this adds up to

Five controls, each with its own exporter hooked to its own job, and rules calibrated
separately:

| control | rules | exporter tests |
|---|---|---|
| hardening auditor | 4 | 11 |
| rootkit scanner (both hosts) | 4 | 17 |
| file-integrity monitor | 5 | 22 |
| antivirus scan | 6 | 14 |
| package-verification scan (second host) | 3 | — |
| **total** | **22** | **64** |

Those 22 sit inside an environment total of **69 alert rules across 15 rule files**, read
off the deployed files today rather than added up from this page. Zero of the 22 were firing
at the time of writing.

The engineering is small. The judgment is the deliverable:

- **Read the output before repairing the tool.** In four of these cases the tool was
  never broken.
- **"Running" is not "working".** An antivirus daemon in perfect health, with no caller, is
  not a control. Find the consumer — the cron entry, the socket client, the script — before
  believing a green unit means anything.
- **A scan over zero entries reports "no differences".** Assert the denominator before
  trusting any clean result, in an integrity scan, a test fixture, or a verification script.
- **Failure must never render as a healthy zero.** Withhold the series instead.
- **Hook the exporter to the job, not to a schedule of its own**, or you will export
  stale numbers with nothing marking them stale.
- **Decide what is allowed to page, and defend that decision with measurements.** Of
  eight rules, exactly one is permitted to wake someone up, and it has never fired.
- **Calibrate against a normal host, not against the first host you looked at.**

The value here was never in the hardening points. It was in ending up with a small number
of alerts that mean something — and in being able to say, with evidence, which signals
were deliberately left quiet and why.
