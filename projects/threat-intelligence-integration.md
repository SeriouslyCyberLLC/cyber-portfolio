# Threat Intelligence Enrichment: the service that threw its answers away

**Status:** The aggregator and the enrichment pipeline are live. The service this page
originally described is **retired and masked.** Figures read from the running cluster and
the indicator database on 2026-09-20.

For most of a year this SOC had a threat-intelligence enrichment service that reported
`active (running)`, called three commercial reputation APIs every 300 seconds, computed a
threat score for every external address it saw, and then **discarded the result.** No alert
was ever enriched. Nothing downstream consumed anything.

Every earlier version of this page described that service in the present tense, complete
with an enrichment latency and a 0-100 scoring scale. It is a better portfolio piece as
what it actually was.

## What was wrong with it, in the order it matters

The service threw an Elasticsearch **403 Forbidden** on every cycle, 3,319 of them over
five weeks, because a least-privilege change had correctly made its account write-only and
the code called `search()`. That looked like the bug. It was not.

| # | defect | measured |
|---|---|---|
| 1 | **No write path existed at all** | 0 `index`/`update`/`bulk` calls in 270 lines, against a positive control of 1 `search` |
| 2 | Searched an index that had been dead for a year | 4 matching indices, all a year stale; live data was elsewhere, across 95 indices |
| 3 | Ran as root | for work that needed no privilege |
| 4 | Treated all of `172.*` as private | rather than 172.16-31, so it would skip public 172.32+ addresses even once repaired |

Defect 1 decided it. The enrichment loop ends like this:

```python
for ip in ips_to_enrich:
    enrichment = self.enrich_ip(ip)
    # Update alerts in Elasticsearch with enrichment data
    # (Optional - could bulk update here)
```

It called the APIs, computed the score, printed it, and moved on. Every 300 seconds.

> **The permission error was not the bug. It was the only thing preventing the bug from
> costing money.**

Fixing the credential and the index would have converted a service that spent nothing into
one that spent real API quota 288 times a day for output nobody consumed. It was masked,
with the unit preserved for restore, and the retirement verified on five independent
signals rather than on the script's own success line.

## What replaced it

A purpose-built aggregator with its own Postgres store, and enrichment performed **in the
ingest pipeline** rather than by a polling service.

| | live today |
|---|---|
| feeds enabled | **7**: VirusTotal, AbuseIPDB, AlienVault OTX, ThreatFox, MalwareBazaar, URLhaus, Feodo Tracker |
| indicators held | **161,392** |
| sightings | 3.38 M |
| indicator index | 152,930 documents |
| enrich snapshots | **14,574** addresses, **22,519** domains |
| documents through the pipeline | **37,957,952**, **0 failures** |
| refresh | hourly timer, last success confirmed by an exported timestamp |

Enrichment is three `enrich` processors on the ingest pipeline, matching source address,
destination address and DNS query against the snapshotted indicator set, plus a script
processor that computes three separate booleans. The design choices that matter:

- **The aggregator's writer account cannot read its own index.** It only writes. Verified
  it cannot escalate: reading the telemetry indices, listing indices, creating a superuser
  and deleting its own index all return 403.
- **The snapshot is refreshed on a timer, not queried per document.** An enrich policy is a
  frozen copy; ingest never makes a network call, so a feed outage cannot stall ingestion.
- **TLS verification needed a code change, not a config flip.** The client passed
  `verify_certs` but no CA path, so enabling the flag alone would have verified against the
  system trust store, failed against this cluster's private CA, and invited someone to turn
  it back off. Proven on by a negative test: pointed at the system bundle, the sync fails
  with `certificate verify failed`. A verification flag that is silently ignored looks
  identical to one that works.

## The number that makes it useful is the one that filters

A match is not a finding. Measured across every document that has matched an indicator:

| | count |
|---|---|
| documents matching any indicator | **1,751** |
| above the per-type confidence floor | 1,687 |
| **allowlisted** | **1,401** |
| **actionable** (above floor, not allowlisted) | **286** |

**80% of matches are allowlisted, and that is the design working, not a gap.** The feeds
list shared platforms because malware abuses them: a content-delivery host, a code-hosting
service, a pastebin. A DNS query for a code-hosting domain cannot distinguish a `git push`
from a payload fetch, and alerting on it teaches you to ignore the alert. That distinction
belongs to the endpoint agent, which sees what executed.

Matches are **reclassified, never dropped.** `allowlisted` and `above_floor` are recorded
separately from `actionable`, because "we chose not to act on this" and "this did not meet
the bar" are different facts, and a future question about either one needs both retained.

## The scoring scale this page used to claim

Earlier versions described a 0-100 threat score with four bands, Critical at 90-100 down to
Low at 1-39. That was wrong, and checkably so. The field named `threat_score` in the
telemetry is synthesised by the log pipeline from IDS severity and takes **exactly three
values**:

| value | documents |
|---|---|
| 5 | 36,385,797 |
| 7 | 84,399 |
| 10 | 6 |

Maximum attainable is 10. Three of the four published bands described scores that have
never existed, and one downstream component had a blocking threshold of **75**, which is
7.5× the maximum, so that condition was unsatisfiable by arithmetic. The bands are gone
from this page and the threshold is documented in [the assurance
audit](assurance-audit.md).

## Honest limitations

- **OTX is enabled but its key is rejected.** The feed is configured and contributes
  nothing. That is stated rather than quietly listed as a source.
- **MISP runs on this network but is not a feed here.** Earlier versions of this page and
  its card claimed six sources including MISP, Hybrid Analysis and a CISA catalogue. None
  of the three is a configured source; MISP was listed under future work in the same
  document that claimed it as live.
- **No enrichment latency is quoted**, because none was ever measured. The old "<2 seconds
  per alert, four sources in parallel" described the retired service, which never wrote a
  result to time.
- **Nothing here triggers containment.** `actionable` is a label for a human and for
  queries. The one component on this network that could act on an indicator was masked
  after it was found to have executed zero blocks in its entire life.

## Framework mapping

Detection and enrichment map to CIS Controls v8 13.1 and 13.6, NIST CSF 2.0 ID.RA and
DE.AE, and ATT&CK reconnaissance and command-and-control technique families. The
least-privilege split on the writer account is ISO 27002 8.2 and 8.3.

## Skills demonstrated

Elasticsearch enrich policies and ingest pipelines, index templates and dynamic pipeline
attachment, Postgres schema design for indicator storage, API integration against
rate-limited feeds, least-privilege service accounts, TLS verification proven by negative
test, Prometheus instrumentation with a freshness signal, and retiring a service on
measured evidence rather than repairing it because it exists.

---

**Built:** October to December 2025. **Predecessor retired:** September 2026.
**Aggregator and enrichment pipeline:** live.
