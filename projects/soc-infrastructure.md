# The SOC, and the Work of Proving It Is Telling the Truth

**Status:** Production, continuous operation. Built September 2025 to January 2026, run and
measured daily since. The tables below were read from the running cluster and services on
**2026-09-20**. Scale and throughput move daily, so they are readings with a date on them,
not properties; the screenshot further down carries its own, earlier date for the same
reason.

A six-layer, self-hosted security operations centre on owned hardware: network detection,
a SIEM, endpoint EDR on every host, threat intelligence, local LLM triage, and the
monitoring that watches all of it.

Standing it up took a few months. Most of the work since has been establishing which parts
of it were actually doing anything:

> **Four services and three controls on this estate reported healthy while producing
> nothing. The engineering that matters is the part that can tell the difference.**

This page is the map. Each layer links to the writeup where that layer was measured,
broken, or retired on the evidence.

## The layers

| # | Layer | What runs | Evidence |
|---|---|---|---|
| 1 | Network detection | Suricata 8.0.6, **63,617 enabled rules**, and Zeek 8.2.2 on a mirrored span | [Network architecture](firewalla-network-security.md) |
| 2 | SIEM | Elasticsearch 8.19.20, Logstash, Kibana; ILM rollover behind a write alias | this page |
| 3 | Threat intelligence | VirusTotal, AbuseIPDB, OTX, abuse.ch feeds, MISP, a custom aggregator | [Threat intel integration](threat-intelligence-integration.md) |
| 4 | LLM triage | Local models over collected endpoint evidence, with a deterministic severity floor | [AI-enhanced analysis](ai-enhanced-security-analysis.md) · [red-team bench](ai-redteam-bench.md) |
| 5 | Endpoint | Velociraptor 0.75.1 for on-demand forensics; Elastic Defend streaming continuously | this page |
| 6 | Assurance | Prometheus, Alertmanager, 85 alert rules across 17 files, freshness and integrity probes | [Assurance audit](assurance-audit.md) · [hardening](hardening-telemetry.md) · [integrity & malware](integrity-and-malware-scanning.md) · [off-site backup](off-site-backup.md) |

All nine core services (search, dashboards, ingest, IDS, EDR server, endpoint agent, the
LLM runtime, metrics and dashboards) were `active` when this was written. That sentence is
worth exactly as much as the rest of this page makes it worth.

## Scale, measured today

| | documents | storage | indices | share |
|---|---|---|---|---|
| Endpoint telemetry (Elastic Defend) | **6.93B** | 1.83 TB | 82 | **74.8%** |
| Network telemetry (Suricata + Zeek) | 0.73B | 0.26 TB | 97 | 7.9% |
| Everything else | 1.60B | 0.32 TB | 448 | 17.3% |
| **Cluster total** | **9.26B** | **2.41 TB** | 627 | |

Daily throughput, seven-day average:

| source | per day |
|---|---|
| Elastic Defend across three endpoints | **54,486,560** |
| Suricata + Zeek | **12,646,447** |

Last 24 hours by source: Zeek 13,981,373, Suricata 5,889,890, Velociraptor collections 439.
Per endpoint over the same window: SOC server 47.9M, second Linux host 4.4M, Windows laptop
274K.

**Read the IDS figure against the seven-day average, not on its own.** It swings between
roughly 0.6M and 13.6M a day depending on how much QUIC decoder traffic one talkative host
is generating, which is exactly why the volume floor for that source was recalibrated onto
session records only. A single day's count from either source is close to meaningless here;
the [assurance audit](assurance-audit.md) has the calibration.

### Quote the 12%, not the 8.7 billion

The cluster total is the least useful number on this page. **Network telemetry (every
Suricata alert and every Zeek connection, flow and DNS record, the SOC data proper) is
11.7% of storage.** The rest is endpoint event volume, dominated by file events.

Saying "8.7 billion documents" in an interview would be true and would misrepresent the
system. The honest framing is that endpoint retention is the single biggest lever on
cluster size, and that deciding how far back file events must be queryable is a retention
decision, not a disk-space one.

### The constraint, and why it is not CPU

Index data lives on a RAID1 pair of **spinning disks**. Measured on bulk work: **~6,300
documents per second, unimproved by parallelism**, the array, not the 24-core CPU or the
128 GB of RAM. It is also why a reboot costs one to two hours of shard recovery.

The NVMe has room only if endpoint retention is cut first, which turns the migration into
the retention question above rather than a hardware purchase.

**The cluster is yellow, deliberately.** 627 active shards, 192 unassigned, replicas that
a single node can never place. A yellow single-node cluster is expected; treating it as a
fault would be misreading the health colour.

## What the assurance layer is for

Four services on this box have reported `active (running)` while producing nothing, for
periods measured in months. Three security controls reported success while having no
effect. That is why layer 6 exists, and why it is the layer I would defend hardest in an
interview:

- **Output freshness, not process liveness.** 17 producers are watched by output age, and
  **6 of those additionally against a 24-hour volume floor**; a source that keeps writing at
  0.2% of normal volume is invisible to any check that only asks whether output exists. See the [assurance audit](assurance-audit.md).
- **Failure never renders as a healthy zero.** Every exporter here withholds its series
  rather than emitting `0` when it cannot measure, because a plausible number gets
  believed. See [hardening telemetry](hardening-telemetry.md).
- **Controls are verified by their consumers, not their status.** An antivirus daemon in
  perfect health with no caller is not a control. See
  [integrity and malware scanning](integrity-and-malware-scanning.md).
- **The whole thing is backed up off-site, and the restore is tested.** See
  [off-site backup](off-site-backup.md).

## What was removed, and why that counts as work

An earlier revision of this page advertised capabilities that no longer exist. Correcting
that is part of the job:

| Capability once listed here | Actual state |
|---|---|
| DNS behavioural analysis with scoring and push notifications | **Retired on measurement**: 2.6M detections in 17 days, 99.9% at the score floor, 61 pages/day. [The post-mortem](dns-behavioral-monitoring.md) |
| Automated response / auto-blocking | **Retired on measurement.** Three layers, **zero blocks executed in its entire life**, running because a reboot had started it rather than because anyone chose to |
| A webhook that could isolate a host and block an address | **Retired**: it took the host to isolate and the address to block from the caller, with nothing establishing who the caller was |
| Threat-intel enrichment service | **Retired**: queried a dead index and had no write path at all; its permission error was the only thing stopping it spending API quota on output nobody consumed |

Three of those four were *removed* rather than repaired. Each had been kept on the
assumption that a capability present is better than one absent, and in each case measuring
it showed the opposite: they consumed attention, and two of them would have consumed money
or authority the moment anyone "fixed" them.

Two figures on this page were also simply **wrong** until today: Suricata was listed at
7.0.3 with 44,983 signatures. It is **8.0.6 with 63,617 enabled rules**, and the rule
count has to be taken as `grep -c '^alert'`, because the file also carries roughly 16,000
commented-out rules that a line count would happily include.

## Honest limitations

- **Single node.** No high availability. A disk failure is an outage; that is what the
  off-site backup and the tested restore are for.
- **Three endpoints.** The conclusions here are about depth of instrumentation, not fleet
  scale.
- **No case management.** Alert triage produces verdicts and metrics, not tickets with
  owners and timers. Mean-time-to-triage is therefore an estimate, and I do not quote one.
- **The LLM layer is triage assistance, not a detector.** It under-calls without its
  deterministic floor, and that is stated in its own writeup rather than glossed.
- **Coverage is the mirrored uplink**, so traffic that never crosses a VLAN boundary is not
  captured. That is a deliberate trade, mirroring every port duplicated east-west traffic
  and added no visibility.

## Framework mapping

| element | maps to |
|---|---|
| Network detection, host telemetry, log aggregation, retention | CIS Controls v8 **8**, **13**; NIST CSF 2.0 **DE.CM** |
| Endpoint EDR with prevention on every host | CIS **10**; NIST CSF 2.0 **DE.CM-1**, **PR.PS** |
| Detection content mapped to adversary behaviour | **MITRE ATT&CK** |
| Monitoring of the monitoring: freshness, integrity, backup verification | NIST CSF 2.0 **ID.IM**, **RC.RP**; SOC 2 **CC7.2** |
| Local-only LLM analysis, no third-party data egress | NIST **AI RMF** (Govern, Measure); OWASP **LLM Top 10 2025** |

## Screenshot

![Discover over the security indices: 3.05M documents in 24 hours across 290 fields](../assets/screenshots/soc-discover-24h.png)

*Kibana Discover across the security indices, **captured 2026-08-17**: 3,050,369 documents
in a rolling 24 hours, 290 mapped fields. Note the date, because the volume is roughly a
quarter of the current figures in the table above, and the collapse mid-frame is not a
rendering artefact or an ingest pause: it is the onset of the 41-hour mirror-session loss
described below. The capture is kept for exactly that reason.*

Host names are rewritten in the page before capture and the document table is cropped out:
raw records carry internal addressing and device names, and **a screenshot is the one
artefact a text sanitisation pass cannot reach.**

The dated figures in the telemetry strip on the
[site homepage](https://seriouslycyberllc.github.io/cyber-portfolio/) are regenerated
directly from the cluster by `scripts/update-telemetry.mjs`, and are better evidence than
any screenshot, reproducible, timestamped, and not hand-composed.

## Skills demonstrated

- SIEM architecture, ILM and retention design against a measured storage constraint
- Network security monitoring with a span-based capture design, and the trade that sizing it
  correctly requires
- EDR deployment across mixed Linux and Windows endpoints, on-demand and continuous
- Instrumenting a security stack so its own failures are visible, which is the part most
  home SOCs skip
- Retiring controls on evidence, and being able to say what each one actually did

**Tech:** Elasticsearch, Logstash, Kibana, Suricata, Zeek, Velociraptor, Elastic Agent and
Defend, Prometheus, Alertmanager, Grafana, Ollama, ChromaDB, Docker, systemd, Python, Bash

**Scope and limits:** personal lab on owned equipment; no employer or client data or
systems are involved; figures are readings on the dates stated, not guarantees. See
[Scope, sourcing and limits](../DISCLAIMER.md).
