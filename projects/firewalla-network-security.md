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

| segment | role | devices |
|---|---|---|
| Main | the household: TVs, consoles, phones, smart-home kit | 28 |
| LAN 1 | wired general purpose | 3 |
| VLAN 20 | secondary Linux node | 1 |
| VLAN 60 | secondary workstation segment | 1 |
| VLAN 70 | Windows endpoint running EDR | 1 |
| VLAN 80 | forensics workstation | 1 |
| VLAN 66 | IP cameras, deliberately closed | 1 |

Plus VLAN 81, the security operations segment, which the SOC server sits on.

**The household network is the majority of the estate and is worth stating plainly**, because
a diagram showing only the lab VLANs would misrepresent what this appliance is actually
protecting. Twenty-eight consumer devices on one flat segment is the realistic condition;
the segmentation exists so that the lab work and the cameras are not on it.

Each segment is a routed `/24` with the appliance as gateway. Inter-segment traffic is denied
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

The camera VLAN is not on the switch at all and produces zero documents. That is by design:
eight 1080p cameras would be roughly 4 MB/s against the ~124 KB/s the mirror normally
carries. If it is ever wired in, the correct move is to add it to the trunk so that
*escape attempts* are captured while intra-VLAN video stays off the mirror.

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
| blocked flows over 1h / 24h / 7d / 30d | **the identical number, 180,583, for all four** |
| flows with an explicit `begin`/`end` day range | the most recent page only: 500 records spanning **6 minutes** |
| a `count` field on a bounded query | the size of the page, not a total |

**The interval parameter is accepted and ignored.** So 180,583 is a cumulative counter over
an undefined period, and "877,321 daily" was that same kind of number with a unit attached
to it that the API never supplied. A six-digit figure with no window is the worst shape a
statistic can take: it reads as measured and it is not.

What I can state, because it has a defined basis:

| | measured |
|---|---|
| rules configured | **100** (81 active block, 17 active allow, 2 paused) |
| open alarms | **22**, none raised in the last 24 hours |
| blocked share of a 500-flow live sample | **1.0%** (5 of 500, over 6 minutes) |
| appliances online | 1 of 1, firmware 1.983, router mode |

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

**There is no automatic quarantine.** An earlier use case on this page ended with a device
being "automatically quarantined to a restricted VLAN". No such automation exists. The one
component on this network that could have acted on a detection was an auto-blocker that
executed **zero blocks in its entire operational life** and has since been masked, which is
written up in [the assurance audit](assurance-audit.md). Blocking here is a rule I wrote or
a button I pressed.

## Honest limitations

- **Single appliance, so a single point of failure.** No HA pair.
- **Inspection cannot see inside TLS** without interception, which is not deployed and which
  I would not deploy on a network carrying family devices.
- **Threat feeds are the vendor's** and are not tunable the way a commercial NGFW ruleset is.
- **Intra-segment traffic is not mirrored**, so lateral movement *within* a segment is
  visible only to the endpoint agent, not to the network sensors.
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
