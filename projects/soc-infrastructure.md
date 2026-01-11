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
- **Server**: Custom-built i9-14900K/128GB RAM system
- **Storage**: 1.8TB NVMe SSD for hot data, 3.58TB HDD for archives
- **GPU**: AMD RX 7900 XTX with ROCm acceleration
- **Network**: Firewalla Gold Pro managing multiple VLANs with port mirroring

### Core Components

#### 1. SIEM Platform (ELK Stack)
- **Elasticsearch 8.19.3**: 25.8GB indexed, 42M+ security events
- **Logstash**: Multi-pipeline ingestion from 6+ sources
- **Kibana 7.17.14**: Custom dashboards for security operations
- **Data Volume**: 1.4M events/day, ~91M total indexed events
- **Index Strategy**: Daily indices (`tepes-security-YYYY.MM.DD`)

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
- AI-enhanced analysis using Ollama/Mixtral
- RAG system with MITRE ATT&CK framework integration

## Data Scale & Performance

### Current Metrics
- **Total Events**: 91M+ indexed security events
- **Daily Throughput**: 1.4M events/day
- **Storage Efficiency**: 25.8GB for 42M events
- **Query Performance**: Sub-second search across 90-day retention
- **Uptime**: 99.9% availability (systemd-managed services)

### Index Management
```
tepes-security-*: 42M+ events (Sept-Dec 2025)
metricbeat-*: System performance metrics
tepes-zeek-*: Network analysis data
velociraptor-hunts-*: EDR collections
```

## Advanced Features

### AI-Enhanced Analysis
- Local LLM (Mixtral 13B) for log analysis
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
