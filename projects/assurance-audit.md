# Exit 0 Is Not Evidence — auditing a SOC's own assurance

**Status:** One day's work, August 2026. Everything below was measured on a running
production SOC, not reconstructed afterwards.

I set out to harden a home security operations centre and spent the day discovering that
the problem was not coverage. Every sensor I might have added was a sensor I could not
have trusted, because the ones already installed had been failing silently for months and
nothing had noticed.

The unifying finding, across eleven separate defects:

> **Five services reported `active (running)` while producing nothing.
> Three security controls reported success while having no effect.**

Not one of them was detectable from a status command, a log file, or an exit code. Every
one was detectable from output.

## The findings

| # | Finding | How long it had been true |
|---|---|---|
| 1 | Evidence store accepted connections from two entire VLANs and a container network | unknown |
| 2 | Log-shipping account held `manage` (delete-index) over the telemetry indices | unknown |
| 3 | That account's password was a **six-digit literal** in a world-readable config | unknown |
| 4 | Threat-intel adapters returning HTTP 403 on every fetch — revoked API key | **35 days** |
| 5 | The intel pipeline's second stage was a manual CLI command with no scheduler | **73 days** |
| 6 | Intel service authenticated as **superuser** with TLS verification disabled | since build |
| 7 | Freshness monitoring could detect *absent* output but not *wrong* output | since build |
| 8 | Auto-blocker running because a reboot started it, not because anyone chose to | 7 days |
| 9 | Auto-blocker's `unblock` and `check` were **no-ops that reported success** | since build |
| 10 | Endpoint isolation **could not launch its own artifact**, and reported success | since build |
| 11 | Four distinct rejection reasons collapsed into one counter | since build |

Three are worth reading in full.

## 1. The auto-blocker that could never unblock

A three-layer automated blocker (host firewall, edge firewall, endpoint isolation) had
never executed a block. Its audit log was zero bytes, which was correct — and which is
also exactly what a completely broken blocker looks like. So I tested it.

The host-firewall layer runs through a privilege-scoped wrapper. `block` writes:

```
-A <CHAIN> -s <IP> -j DROP -m comment --comment "<reason>"
```

while `check`, `unblock`, **and block's own duplicate guard** all probed with:

```
-C <CHAIN> -s <IP> -j DROP
```

`iptables -C` requires an *exact* rule-spec match, comment match included. None of the
three ever matched a rule the wrapper itself had created. Measured:

| verb | behaviour |
|---|---|
| `block` | worked |
| `unblock` | `"(0 rule(s) removed)"`, **exit 0**, rule still present |
| `check` | `"not-blocked"` for a rule plainly visible in a listing |
| duplicate guard | never fired — direct calls would stack duplicate rules |

**Every block this system could ever have made would have been permanent**, with a
removal path that reported success while doing nothing. The edge-firewall layer has no
per-entry expiry either, so there was no working expiry on either reachable layer.

The wrapper had been reporting the truth the whole time — `removed=0` — and the calling
code discarded it.

Fixed both ends: the wrapper now enumerates real rules and deletes each by its own stored
spec; the caller parses the removal count and, when it is zero, re-checks whether the
address is still blocked to distinguish *"was not blocked"* from *"should have been
removed and was not"*. Verified with a full round trip: block → check → duplicate refused
→ unblock → 1 rule removed → check → chain empty.

## 2. Isolation that reported success and created nothing

The endpoint-isolation layer deploys a quarantine artifact that cuts a host off from
everything except the forensics server. Rather than quarantine a live machine to test it,
I used the artifact's own *removal* parameter — running the delete-only code path against
a host that was not quarantined. Full mechanism, no effect.

It returned success. No flow had been created.

```
collect_client(artifacts=['<routine process listing>'])   -> flow_id
collect_client(artifacts=['<quarantine artifact>'])       -> null
```

Same identity, same function, same call shape. The quarantine artifact declares
`required_permissions: [EXECVE, NETWORK]`; the service identity held a role granting
neither. The call returned **null** — exit 0, empty stderr, no error even with verbose
logging on — and the isolation code treated that as containment applied.

**The layer had never been able to isolate anything**, and would have reported success
every time it tried.

The caller now requires a flow identifier as the only acceptable proof and names the
likely permission cause when it is absent.

## 3. One pipeline, two dead stages, two different dates

A threat-intel aggregator held 74,558 indicators whose newest record was 35 days old. Its
scheduler was `active (running)` and executing hourly jobs *successfully* — the jobs
simply fetched nothing:

| adapter | successes | errors |
|---|---|---|
| feed A (no auth required) | 42 | 0 |
| feed B | 0 | **254 × HTTP 403** |
| feed C | 0 | **252 × HTTP 403** |
| feed D | 0 | **252 × HTTP 403** |

A revoked API key. The provider issues one key across all its services, and a working one
was already present elsewhere on the box under a different variable name.

Worth noting for anyone debugging the same thing: **no key returns 401; a *wrong* key
returns 403.** The 403s were evidence a key was being sent and rejected — not that
authentication was missing.

Fixing that revealed the second failure. The pipeline's database was now current, but the
*search index* — the thing detection actually enriches against — held 1,734 documents
from **73 days** earlier. The database-to-index sink was a manual command-line operation
with no scheduler entry at all. It had run exactly once, at build time.

So detection had been enriching against a 1,734-indicator snapshot while the database
held 74,983. Both halves failed independently, on different dates, for unrelated reasons,
and neither was visible.

## What the monitoring could not see

An output-freshness monitor already existed — it checks whether producers have written
recently, and it had caught real failures. It could not have caught any of this, because
it detects **absent** output, not **wrong** output.

The clearest case: during an earlier 41-hour network-visibility outage, the IDS never
stopped writing. It wrote **6,134 events in a day against a 2.8M–8.0M normal**. Every
timestamp check stayed green for 41 hours.

Added two capabilities: rolling-24h **volume floors** per data source, and freshness for
producers whose output is database rows rather than files. Floors were derived from 14
days of per-day counts, not guessed:

| source | healthy/day | floor | catches the outage by |
|---|---|---|---|
| IDS | 2.8M – 8.0M | 500,000 | **80×** |
| network monitor | 357K – 4.4M | 250,000 | — |

That second row is written into the config with an explicit caveat: **that floor would
not have caught the outage.** The network monitor's lowest day in fourteen *is* the
outage day, because it was faithfully logging multicast chatter the whole time. Only the
IDS floor is load-bearing there. A monitoring threshold that cannot catch the incident it
was built for should say so in the file, not in someone's memory.

One design decision carried the most weight. A **collection failure** and a **producer
that has never produced** are different states and must never render identically. The
"never produced" metric drives a critical alert; rendering a transient auth failure that
way would page that the IDS is dead when the IDS is fine. Failed queries now emit a
distinct error metric and withhold the others entirely.

## Corrections to my own documentation

The operational runbook for this environment is detailed and confidently written. Four of
its claims were wrong, and each survived because nothing measured it:

- **"This service is deliberately left disabled."** It was enabled and running, started
  by a reboot a week earlier.
- **"Fixing the intel pipeline would arm the auto-blocker."** It would not — the field in
  question appears nowhere in that pipeline's code. This claim had blocked a needed
  repair for no reason.
- **"X is the sole remaining barrier to automatic blocking."** There is a second,
  independent barrier. Over seven days, **15,347 alerts** met the blocking criteria from
  **three distinct source addresses, all internal** — and the next gate rejects internal
  addresses outright. Worth stating precisely: the first barrier is structural, the
  second is a property of current traffic. That distinction is now in the file, because
  reading "zero external sources in seven days" as a safety guarantee is how the original
  wrong claim happened.
- **A security review flagged "a six-digit password" and I dismissed it** as wrong,
  because the account I checked had a 32-character password. The review was right about a
  *different* account. Checking the claim that was made, rather than the one I assumed,
  would have found it immediately.

## Mistakes made doing the work

Included because a writeup that reports only successes is the same genre of artifact as a
service that only logs successes.

Seven errors, and they cluster: I was reliable when *reading* the system and unreliable
when *writing* automation against tool interfaces I had not checked.

- Assumed a `--stdin` flag on a secrets-store CLI that has none — it took bare key names,
  so the flag became a key named `--stdin`
- Missed that the same store lowercases key names, so my verification reported a false
  failure *and* the config reference I generated would not have resolved
- Missed its overwrite prompt, so the piped secret answered the prompt instead
- Parsed a firewall rule containing a quoted string with `split()` — twice, in the same
  script, while fixing a bug whose root cause was that same assumption
- Drafted a permissions change against an assumed interface: the grant command **replaces**
  a policy rather than merging it, so it wiped the role it was meant to extend and left
  the identity unable to run any query at all

`--help` first would have prevented four of them.

What kept these off the floor was ordering, not care: every script did the reversible work
first, verified, and only then touched the irreversible step. Ingestion never stopped, and
the one stray firewall rule I created was inert and later removed. That is a property
worth designing for deliberately, because it is the only thing that held when I did not.

## What I would take to a production SOC

**Instrument outputs, not processes.** A process table tells you something exists. It
cannot tell you it is doing anything. Five services here proved that simultaneously.

**Exit 0 is not evidence of effect.** Three separate controls reported success while
having none. In each case something downstream — a removal count, a returned identifier,
a document count — was available and being discarded. The honest signal usually already
exists; the bug is that nobody reads it.

**Volume floors catch what liveness checks cannot.** "Still writing" and "writing the
right amount" are different questions. The 41-hour outage answered the first one green
for its entire duration.

**Test containment on the removal path.** Most containment actions have an inverse.
Running the inverse against a target that is not contained exercises authentication,
authorisation, targeting, and completion — with no effect on the target. It found a
completely non-functional isolation layer in one call.

**Write the limits of a control into the control.** The threshold that cannot catch the
incident it was built for, the barrier that is circumstantial rather than structural, the
producer whose silence is expected — all of it belongs in the config file next to the
setting, not in a runbook someone will read a year from now.
