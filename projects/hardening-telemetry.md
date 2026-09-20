# An Audit Nobody Reads: putting a number on hardening

**Status:** Live on two Linux hosts. Built August 2026, extended through September. Figures
marked *read live* were taken from the running monitoring stack on 2026-09-20. Historical
figures carry their own dates. Numbers here move as the hosts get patched, so treat a
hardening index as a reading, not a property.

Security scanners had been running daily on these machines for months. They worked. They
wrote their findings to disk on schedule. None had ever been read.

That is the whole finding, and it is not a story about installing tools:

> **An audit that runs every day and is never looked at is indistinguishable
> from one that does not run at all.**

The fix was not to repair a scanner. Both scanners were fine. The fix was to turn their
output into a tracked signal, and (the harder half) to decide what was allowed to wake
anyone up.

## The four cases

| # | What reported healthy | What was actually true |
|---|---|---|
| 1 | Hardening auditor running daily, over 1 MB of output | Nobody had read a single line of it |
| 2 | Rootkit scanner running daily | Findings piped into a mail path that did not exist |
| 3 | `0 updates can be applied immediately` | 30 unpatched CVEs the host could not see |
| 4 | Auto-blocker `active (running)` | 0 blocks executed in the service's entire life |

Each is a different way for a system to report a number about itself that is not the
thing itself.

Two further controls on these hosts failed the same way and are written up separately,
because they fail in opposite directions from each other: a file-integrity monitor that had
not run at all for 38 days, and an antivirus daemon in perfect health that nothing had ever
asked to scan. See [Running Is Not Working](integrity-and-malware-scanning.md).

## 1. The score nobody tracked

The hardening auditor ran on a daily timer, wrote a report and a log that sits around 1.2 MB
between rotations, and exited cleanly. There was no defect to fix. There was simply no consumer.

I exported seven series to the metrics collector (hardening index, tests performed,
warnings, suggestions, report age, report readability, and the export timestamp) and hung
the exporter off the audit unit itself with `ExecStartPost` rather than giving it its own
timer.

**That choice is load-bearing.** A separate schedule drifts away from the audit it
reports on, and would happily export a stale score with nothing to indicate staleness.
Hooked to the unit, it fires exactly when there is new data, and a parse failure surfaces
in the audit unit's own status.

### Failure is not zero

The exporter's parser returns nothing on a malformed report, never a zeroed structure.
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
| second Linux host | **59 → 69** | 51 → 32 | 0 | 277 |

One package was deliberately **not** installed: an interactive bug-notifier that prompts
during package operations and would have hung unattended upgrades. A hardening suggestion
is a suggestion, not an instruction.

### The trend is the point, not the number

An index of 66 is not inherently bad. An index of 66 after a run of 72s means something
specific regressed, and that is exactly what nobody notices by hand.

So the headline rule is a **regression** rule: fire when the index falls more than three
points below its own 14-day maximum. The three-point tolerance is not arbitrary; scores
shift slightly with test-count changes between scanner versions.

A second rule is an absolute floor, and it taught me something. I set it at 60 before I
had measured any real host, calibrated against the only machine I had looked at. The
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
missing config file produce the identical symptom**, a red unit in a list nobody reads.

Same treatment: export the findings as metrics, hook the exporter to the scan unit, and
disable the mail path outright. Notably this required **no notification credential on
that host at all**, the metrics ride the collector-to-alerting path the hardening
exporter had already established.

### Calibration is the entire point

The scanner reports 142 checks. It also reports, every single day, **29 suspicious
files**, every one of them a false positive. They are package-shipped dotfiles: test
fixtures from a security tool, a `.gitignore` inside a Python library, build-id
directories under the kernel modules tree.

A rule on that warning state would fire every day forever. That is precisely how an
earlier monitor on this network produced 61 pages a day and taught everyone to swipe
notifications away.

So, four rules with sharply different weight:

| rule | fires on | priority |
|---|---|---|
| infection detected | `infected > 0` | **critical: the only one here.** Has never fired |
| suspicious count jumped | above the 14-day max, tolerance **5** | warning |
| report unreadable | `report_readable == 0` | warning |
| report stale | older than 3 days | warning |

**Be precise about what "priority" buys, because it is less than it sounds.** There is one
operator and one notification channel, so the router has a single route and no severity
matcher: every rule that fires does reach the phone. What `severity: critical` changes is
the notification priority, which on this channel is the difference between a quiet
notification and one that overrides do-not-disturb. A severity-routing tree for an
audience of one would be pretend enterprise. The real calibration is upstream, in which
conditions are allowed to fire at all.

The tolerance of 5 is measured, not guessed: **a kernel upgrade alone adds about two
entries** as new build-id directories appear. That is exactly what raised the one alert
this rule has produced, a kernel reboot, correctly detected, and entirely noise. The
tolerance exists because I went and looked at what normal change costs.

Second host, read live 2026-09-20: 0 infected, 29 suspicious, 142 checks, report readable.
The SOC server reads 27 suspicious over 118 checks, a different baseline, which is why the
jump rule compares each host against its own history rather than against a shared number.

### Two scanners, and the order in which to remove one

Both hosts had a **second** rootkit checker installed as well, and the two hosts were
running the same package into two opposite failure modes.

On the second Linux host it was gated off at the config level, so the daily and weekly cron
entries both existed, both were executable, and both exited immediately. Its log was **0
bytes, dated 2026-03-01**. That is the mild version: it fails closed, it does not pretend,
and the empty log says so honestly to anyone who looks. Nobody looked for six months.

On the SOC server the same package was gated **on** and ran daily, but its weekly database
update was gated off, so its baseline sat 41 days stale. The consequence is legible in its
own log: every one of its twelve file-property warnings was `curl`, `perl` or `wget`.
Ordinary patching, reported as tampering, into a channel nobody read.

**A rootkit checker comparing against a stale baseline is worse than none.** It
manufactures findings from routine work, and the noisy host is the more dangerous of the
two: an empty log invites a question, while a log full of explained-away warnings trains
you to stop asking. Both were purged, not fixed.

**The order mattered and is the transferable part.** On that host the purge was safe
because the other scanner was already exported with alert rules. The coverage existed
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
immediately`, while separately noting that 35 additional security updates were available
through **ESM Apps**.

Those 35 were CVEs in **universe**, the community-maintained package set.
`unattended-upgrades` can never reach them: it applies security updates from the archives
the host is *subscribed to*, and without an **Ubuntu Pro** subscription the universe
security pocket is not one of them.

> **A host reading "0 updates" is not a patched host. It is a host that cannot see the
> rest.**

After attaching Ubuntu Pro (free for personal use on up to five machines) the count
went from 0 to **30 upgradable packages, every one of them a security update**: the
`ffmpeg` and `libav*` stack, ImageMagick, `libcjson1`, `libmbedcrypto7t64`, `python3-pip`,
Syncthing, and the Prometheus node exporter.

Nothing in the set touched the kernel, `libc`, OpenSSL, systemd, SSH, nginx, or Docker, so
it applied without a reboot and without risking the host's Cloudflare tunnel. Livepatch,
enabled at the same time, covers kernel CVEs between reboots, though it deliberately does
not change the on-disk kernel, so `uname -r` remains the truth for actual kernel upgrades.

**`pro attach` exiting 0 is not proof the services enabled.** Each one is re-read from
`pro status` afterwards and the script fails loudly on any that is not `enabled`, the
same lesson as the mask in section 4. The subscription token is passed via a `0600`
attach-config file, never as a command-line argument: `ps` is world-readable, so
`pro attach <token>` leaks the token to every user on the box for the duration of the call.

### The trap inside the fix

Note what was in that upgrade list: **`prometheus-node-exporter`. The exporter this
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

The auto-blocker documented in the [SOC assurance audit](assurance-audit.md), three
layers of automated response, zero blocks executed across its entire lifetime, running
because a reboot had started it rather than because anyone had chosen to, was retired.

Four independent signals confirmed it stopped, not one: no main process, a heartbeat file
gone stale (a live loop rewrites it every ten seconds), zero connections to the datastore,
and nothing in the process table. Its unit file was preserved for restore, and the
freshness monitor's expected-producer count was decremented so its now-correct silence
would never page.

### A verification step that acts on the system must undo its own action

The first attempt to mask it failed in the most instructive way available.

Masking works by placing a symlink where the unit file would be, and it **refuses to
overwrite a real file.** This unit was a real file in that exact path, so the mask
errored. The script printed the error, carried on, and then ran its own *prove the mask
holds* check: start the service and confirm it refuses.

It did not refuse. **The verification step started the service the script existed to
stop**, and the run ended with a cheerful final line reporting the service as disabled
and active in the same breath.

The working sequence moves the unit aside first, then masks. But the durable lesson is
about the check, not the mask: a verification step that *acts* on the system must undo
its own action and fail loudly when the thing it is proving turns out to be false.

## What this adds up to

Three controls, each with its own exporter hooked to its own job, and rules calibrated
separately:

| control | rules | exporter tests |
|---|---|---|
| hardening auditor | 4 | 11 |
| rootkit scanner (both hosts) | 4 | 17 |
| package-verification scan (second host) | 3 | 10 |
| **total** | **11** | **38** |

Those 11 sit inside an environment total of **85 alert rules across 17 rule files**, counted
off the deployed files on 2026-09-20 rather than added up from this page. Zero of the 11
were firing when I checked.

The engineering is a few hundred lines of exporter and rule YAML. The decisions that took
the time:

- **Read the output before repairing the tool.** In four of these cases the tool was
  never broken.
- **Removing a control is only honest if its replacement is verified as you remove it**,
  not remembered from a previous session.
- **Failure must never render as a healthy zero.** Withhold the series instead.
- **Hook the exporter to the job, not to a schedule of its own**, or you will export
  stale numbers with nothing marking them stale.
- **Decide what is allowed to fire, and defend that decision with measurements.** Of
  these 11 rules, 2 carry critical priority and neither has ever fired. The daily-forever
  conditions were left out of the rule set entirely rather than routed around after the
  fact.
- **Calibrate against a normal host, not against the first host you looked at.**

The value here was never in the hardening points. It was in ending up with a small number
of alerts that mean something, and in being able to say, with evidence, which signals
were deliberately left quiet and why.

**Scope and limits:** personal lab on owned equipment; no employer or client data or
systems are involved; figures are readings on the dates stated, not guarantees. See
[Scope, sourcing and limits](../DISCLAIMER.md).
