# Enterprise Security Operations Center (SOC) Infrastructure

## Overview
Designed and deployed a comprehensive, defense-in-depth security monitoring infrastructure on bare-metal hardware for continuous threat detection and incident response capabilities.

## Business Challenge
- Need for 24/7 security monitoring across distributed network
- Real-time threat detection and correlation
- Scalable log aggregation and analysis
- Zero reliance on cloud services for sensitive data

## Technical Architecture

### Hardware Infrastructure
- **Server**: Custom-built i9-13900K/128GB RAM system (24 cores / 32 threads)
- **Storage**: 1.8TB NVMe SSD for hot data, 3.58TB HDD for archives
- **GPU**: AMD RX 7900 XTX with ROCm acceleration
- **Network**: Firewalla Gold Pro managing multiple VLANs with port mirroring

### Core Components

#### 1. SIEM Platform (ELK Stack)
- **Elasticsearch 8.19.19**: 307M network security events (Suricata + Zeek) in 118GB, within a 6.09-billion-document cluster totalling 1.51TB
- **Logstash**: Multi-pipeline ingestion from 6+ sources
- **Kibana 8.19.19**: Custom dashboards for security operations
- **Data Volume**: ~1.5M network security events/day; ~41M endpoint telemetry events/day from Elastic Defend
- **Index Strategy**: ILM rollover behind the `tepes-security-write` alias (replaced daily `tepes-security-YYYY.MM.DD` indices in July 2026, cutting the cluster from 814 to 589 shards)

#### 2. Network Security Monitoring
- **Suricata 7.0.3**: 44,983 threat signatures, IDS mode
- **Zeek**: Full packet analysis, protocol dissection
- **Coverage**: All network traffic via managed switch port mirroring
- **Detection**: Real-time JSON event streaming to ELK

#### 3. Endpoint Detection & Response
- **Velociraptor 0.75.1**: Centralized EDR server
- **Agents**: 3 endpoints (Windows 11, Linux systems)
- **Capabilities**: Live forensics, hunt deployment, artifact collection
- **Integration**: Direct data feed to Elasticsearch

#### 4. Threat Intelligence
- **Sources**: VirusTotal, AbuseIPDB, AlienVault OTX, Hybrid Analysis
- **Correlation**: Automated IOC enrichment in ELK
- **Custom Detections**: DNS behavioral analysis, DGA detection

### Security Monitoring Capabilities

#### DNS Behavioral Analysis
- DGA (Domain Generation Algorithm) detection
- DNS tunneling identification  
- Suspicious TLD monitoring
- Scoring system (50+ logged, 80+ alerted)
- Real-time Pushover notifications

#### Automated Response
- Custom Python automation for alert triage
- Velociraptor hunt deployment
- AI-enhanced analysis using Ollama with Mistral 7B
- RAG system with MITRE ATT&CK framework integration

## Data Scale & Performance

### Current Metrics (measured 2026-08-08)
- **Cluster Total**: 6.09 billion documents, 1.51TB across 443 indices
- **Network Security Events**: 307M (Suricata + Zeek) in 118GB — `tepes-security-*`
- **Endpoint Telemetry**: 4.81 billion events in 1.21TB from Elastic Defend across 3 hosts
- **Daily Throughput**: ~1.5M network security events/day, ~41M endpoint events/day
- **Query Performance**: Sub-second search across 90-day retention
- **Uptime**: 99.9% availability (systemd-managed services)

### Index Management
```
tepes-security-*              307M docs / 118GB   Suricata + Zeek, ILM rollover
.ds-logs-endpoint.events.*   4.81B docs / 1.21TB  Elastic Defend (file, process,
                                                   network, library, registry,
                                                   api, security)
velociraptor-hunts-*                              EDR collections
```

Endpoint telemetry dominates the cluster: `logs-endpoint.file` alone is 3.99 billion
documents in 624GB, which makes file-event retention the largest single lever on
cluster size.

## Advanced Features

### AI-Enhanced Analysis
- Local LLM (Mistral 7B for triage, Mistral Small 22B as overseer) for log analysis
- RAG system with security knowledge base
- Automated threat classification
- Alert prioritization

### Automated Reporting
- TTX (Tabletop Exercise) report generation: 3 minutes
- IR assessment creation: 20 minutes  
- Previously manual (4-8 hours) → 95% time reduction

## Technical Skills Demonstrated
- Enterprise SIEM deployment & tuning
- Network security monitoring (NSM)
- Endpoint detection & response (EDR)
- Threat intelligence integration
- Linux system administration
- Docker containerization
- Python automation & scripting
- GPU acceleration (ROCm)
- Log analysis & correlation
- Incident response workflows
- Infrastructure as code

## Business Impact
- **Threat Detection**: Real-time visibility across entire network
- **Response Time**: Reduced from hours to minutes via automation
- **Cost Savings**: Self-hosted vs. commercial SIEM ($50K+/year)
- **Compliance**: Complete audit trail for forensics
- **Scalability**: Handles 1M+ events/day with room for 10x growth

## Screenshots
- [Full SIEM Dashboard](../screenshots/portfolio-picks/Screenshot from 2025-12-31 05-05-31.png)
- [Event Correlation View](../screenshots/portfolio-picks/Screenshot from 2025-12-31 04-09-11.png)
- [Index Management](../screenshots/portfolio-picks/Screenshot from 2025-12-28 22-27-58.png)
- [Threat Analysis](../screenshots/portfolio-picks/Screenshot from 2025-12-22 15-47-55.png)

---

**Built**: September 2025 - January 2026  
**Status**: Production, 24/7 operation  
**Environment**: Bare-metal, self-hosted
