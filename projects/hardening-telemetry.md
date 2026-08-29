# An Audit Nobody Reads — putting a number on hardening

**Status:** Live on two Linux hosts, August 2026. Every figure below was read from the
running monitoring stack at the time of writing, not from my notes.

Two security scanners had been running daily on these machines for months. Both worked.
Both wrote their findings to disk on schedule. Neither had ever been read.

That is the whole finding, and it is not a story about installing tools:

> **An audit that runs every day and is never looked at is indistinguishable
> from one that does not run at all.**

The fix was not to repair a scanner. Both scanners were fine. The fix was to turn their
output into a tracked signal, and — the harder half — to decide what was allowed to wake
anyone up.

## The four cases

| # | What reported healthy | What was actually true |
|---|---|---|
| 1 | Hardening auditor running daily, 1.5 MB of output | Nobody had read a single line of it |
| 2 | Rootkit scanner running daily | Findings piped into a mail path that did not exist |
| 3 | `0 updates can be applied immediately` | 30 unpatched CVEs the host could not see |
| 4 | Auto-blocker `active (running)` | 0 blocks executed in the service's entire life |

Each is a different way for a system to report a number about itself that is not the
thing itself.

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

## 3. "0 updates" was not a patched host

The second host's login banner reported `0 updates can be applied immediately` — while
separately mentioning 35 additional security updates available only through extended
maintenance.

Those were CVEs in the community package set. The automatic updater can never reach them:
it applies security updates from the archives the host is *subscribed to*, and that
pocket was not one of them.

> **A host reading "0 updates" is not a patched host. It is a host that cannot see the
> rest.**

After enabling extended maintenance, the count went from 0 to **30 upgradable packages,
every one of them a security update.** Nothing in the set touched the kernel, the C
library, TLS, the init system, remote access, the web server, or the container runtime —
so it applied without a reboot and without risking the host's remote tunnel.

### The trap inside the fix

The metrics collector **was itself in that upgrade list**, and the flag that tells it
where to read exported metrics lives in a package configuration file — the kind an
upgrade may replace, silently, with no error.

That is not hypothetical: deploying to this host had already surfaced the same shape.
The export directory existed, which made it look configured, but the flag pointing the
collector at it had never been passed. Everything written there was being discarded
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

## What this adds up to

Four alert rules for the hardening auditor, four for the rootkit scanner, on two hosts,
bringing the environment to **28 rules total**. Twenty-five tests pinning the two
exporters' failure behaviour. Zero alerts firing at the time of writing.

The engineering is small. The judgment is the deliverable:

- **Read the output before repairing the tool.** In four of these cases the tool was
  never broken.
- **Failure must never render as a healthy zero.** Withhold the series instead.
- **Hook the exporter to the job, not to a schedule of its own**, or you will export
  stale numbers with nothing marking them stale.
- **Decide what is allowed to page, and defend that decision with measurements.** Of
  eight rules, exactly one is permitted to wake someone up, and it has never fired.
- **Calibrate against a normal host, not against the first host you looked at.**

The value here was never in the hardening points. It was in ending up with a small number
of alerts that mean something — and in being able to say, with evidence, which signals
were deliberately left quiet and why.
