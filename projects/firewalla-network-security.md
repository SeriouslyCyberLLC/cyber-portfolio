# Network Segmentation and Mirrored-Traffic Monitoring

**Status:** Live since September 2025. Figures read from the appliance's management API and
from the SIEM on 2026-09-20. Where a number is a vendor rating or a UI setting rather than
something I measured, it says so.

A Firewalla Gold Pro as the router for a segmented home network, with a managed switch
mirroring the router uplink into a monitoring host running Zeek and Suricata. The interesting
parts are the two deliberate limits: what the mirror is scoped to, and which of the
appliance's own numbers turn out to be quotable.

## Segments, as the appliance reports them

Seven networks, 36 devices, 26 online at the time of reading, 17 with reserved addresses.

| segment | devices |
|---|---|
| household: TVs, consoles, phones, smart-home kit | 28 |
| wired general purpose | 3 |
| secondary Linux node | 1 |
| secondary workstation | 1 |
| Windows endpoint running EDR | 1 |
| forensics workstation | 1 |
| IP cameras, deliberately closed | 1 |

Plus a security operations segment that the SOC server sits on. Segment identifiers and
addressing are deliberately omitted.

**The household network is the majority of the estate and is worth stating plainly**, because
a diagram showing only the lab segments would misrepresent what this appliance is actually
protecting. Twenty-eight consumer devices on one flat segment is the realistic condition;
the segmentation exists so that the lab work and the cameras are not on it.

Each segment is a separately routed subnet with the appliance as gateway. Inter-segment traffic is denied
unless a rule exists. **100 rules are configured:** 81 active blocks, 17 active allows, 2
paused.

## The mirror is scoped to the uplink, on purpose

Earlier versions of this page said the switch "mirrors all traffic". It does not, and the
reason is the useful part.

The mirror session is a single destination port fed by **the router uplink only, ingress and
egress.** Mirroring all seven switch ports was tried and measured:

| mirror scope | documents per minute into the SIEM |
|---|---|
| all ports | 6,940 |
| router uplink only | 1,599 |

The extra 4.3× was duplicate east-west traffic, producing duplicate alerts and no additional
visibility, on a storage array already 73% full. Because the appliance is
router-on-a-stick, **everything crossing a segment boundary or going to the internet
traverses that uplink.** What is missed is intra-segment switch-local traffic, and that is
the trade I took deliberately.

The camera segment is not on the switch at all and produces zero documents. That is by
design: eight 1080p cameras would be roughly 4 MB/s against the ~124 KB/s the mirror normally
carries. If it is ever wired in, the right move is to capture only what tries to *leave* it,
and keep the video itself off the mirror.

## There is no full packet capture here

Another claim removed rather than corrected. Packet logging is **disabled** in the IDS
configuration, in both places it appears, and no full-capture platform is deployed.

Zeek and Suricata retain **protocol logs, not packets.** That is a materially different
capability: I can tell you that a host resolved a domain and opened a connection, with
timing and byte counts, but I cannot go back and read the payload. Full retrospective PCAP
is on the roadmap, not in the estate, and a portfolio that implies otherwise fails at the
first question an interviewer asks.

Nor is there NetFlow export into the SIEM. Earlier versions claimed flow logs and syslog
both reaching the ELK stack; there is no flow index in the cluster. Flow records live on the
appliance and are read through its API. What reaches the SIEM is mirrored-traffic analysis,
which is a different data source with different strengths.

## What the mirror actually produces

Measured from the SIEM, last 24 hours:

| | documents |
|---|---|
| DNS | **13,673,292** |
| IDS events | **5,889,890** |
| connection records | 306,808 |

Earlier versions of this page quoted "145K daily DNS queries monitored" and attributed it to
the appliance. That is two orders of magnitude low, and it cannot have been right: the
appliance is the resolver for every segment, so its own count cannot be smaller than what
Zeek sees on a mirror of its uplink.

## The appliance's own blocked-flow counter is not quotable, and that is a finding

Every earlier version of this page led with **877,321 daily blocked flows**, plus 12,000+
blocked domains, 45,000+ geo-blocked addresses, 1,200+ daily intrusion attempts, 2.1M daily
flows and 850+ identified applications. None of those had a retrievable source. I went to
the API to regenerate them properly, and could not.

| what I asked for | what came back |
|---|---|
| blocked flows across four different interval requests | **the identical number, 180,583, each time** |
| flows with an explicit `begin`/`end` day range | the most recent page only: 500 records spanning **6 minutes** |
| a `count` field on a bounded query | the size of the page, not a total |

**I could not obtain a windowed aggregate through the endpoints I was using.** The counter
I did get back carries no window I was able to establish, so I am not going to attach a unit
to it. That may well be my reading of the API rather than a limitation of it, and either way
the conclusion for this page is the same: *"877,321 daily"* was a number of that kind with a
time unit added that I could not source. A six-digit figure with no window is the worst shape
a statistic can take, because it reads as measured and it is not.

What I can state, because it has a defined basis:

| | measured |
|---|---|
| rules configured | **100** (81 active block, 17 active allow, 2 paused) |
| open alarms | **22**, none raised in the last 24 hours |
| blocked share of a 500-flow live sample | **1.0%** (5 of 500, over 6 minutes) |
| appliances online | 1 of 1, router mode |

The 1% is a sample and is labelled as one. It is not a daily rate and should not be
multiplied into one.

## Vendor ratings and UI settings, labelled as such

- **Hardware:** quad-core Intel 12th-gen, 8 GB RAM, 2× 10GbE plus 2× 2.5GbE. Vendor spec.
- **Throughput:** rated above 10 Gb software packet processing, deployed behind a 5 Gb fibre
  uplink. Vendor rating; I have not load-tested it.
- **Inspection latency:** previously published as "<2 ms". That was a datasheet figure
  presented as a measurement, and it is removed. I have not measured added latency.
- **Flow retention:** a retention setting in the console, not a verified property of the
  stored data.

## Capabilities configured

Geographic blocking, category blocking for malware, phishing and command-and-control
domains, outbound port control, inter-segment isolation, a WireGuard VPN server for remote
access, and a VPN client for selectively routed egress. Threat feeds are the vendor's.

**Response here is deliberately manual.** An earlier use case on this page ended with a
device being "automatically quarantined to a restricted VLAN", which overstated it. Blocking
is a rule I write or a button I press. The automated path that once existed was retired on
measurement rather than repaired, and the reasoning is in [the assurance
audit](assurance-audit.md) — an autonomous blocker is a containment decision I want to make
deliberately on a network carrying family devices, not one I want inferred from a score.

## Honest limitations

- **Single appliance, so a single point of failure.** No HA pair.
- **Encrypted traffic is not decrypted.** Interception is not deployed and I would not
  deploy it on a network carrying family devices, so protocol metadata and endpoint telemetry
  do that work instead.
- **Threat feeds are the vendor's** and are not tunable the way a commercial NGFW ruleset is.
- **Intra-segment traffic is not mirrored.** Network sensors see what crosses a boundary;
  within-segment activity is the endpoint agent's job. That is the documented trade from the
  mirror-scope decision above, not an accident.
- **The management API's aggregates are not windowed**, as above, which limits what can be
  trended without building the trending myself.
- **Twenty-eight devices on one flat household segment** is the largest unsegmented surface
  here, and segmenting it further is a family-usability problem rather than a technical one.

## Framework mapping

Segmentation and boundary control map to CIS Controls v8 4.4, 12.2 and 13.4, NIST CSF 2.0
PR.AA and PR.IR, and ATT&CK lateral-movement and command-and-control technique families. The
camera VLAN's isolation is a deliberate CIS 12.2 application rather than an oversight.

## Skills demonstrated

Network architecture and VLAN design, routed-segment addressing and inter-segment policy,
port-mirror design with a measured scope trade-off, IDS and NSM sensor deployment against a
mirror, REST API integration with a management plane, and distinguishing a measured number
from a vendor rating in published material.

---

**Deployed:** September 2025. **Audited and corrected:** September 2026.

**Scope and limits:** personal lab on owned equipment; no employer or client data or
systems are involved; figures are readings on the dates stated, not guarantees. See
[Scope, sourcing and limits](../DISCLAIMER.md).
