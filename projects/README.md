# Larry's Cybersecurity Portfolio

## Professional Summary
AI security and governance professional focused on enterprise AI adoption, AI risk strategy, responsible AI controls, and secure use of generative and agentic systems.

## Certifications
- CISSP (Certified Information Systems Security Professional), ISC2
- CCSP (Certified Cloud Security Professional), ISC2
- AAISM (Advanced in AI Security Management), ISACA
- SecAI+ (CompTIA SecAI+ Certification)
- CompTIA SecurityX (CASP+)
- CompTIA CySA+ (Cybersecurity Analyst)

## Current Focus
Assess AI use cases, vendors, customer-facing features, and internal AI workflows across regulated SaaS environments, working with Engineering, Product, Legal, Privacy, Compliance, and Security stakeholders.

- Translate ambiguous AI risk into executive-ready recommendations, control requirements, residual-risk decisions, and operational safeguards.
- Define responsible-AI controls for generative and agentic systems, weighing confidentiality, privacy, security, legal exposure, and business adoption together rather than in isolation.

## Background
AI security, DFIR consulting, regulated-healthcare MSSP experience, executive incident reporting, vendor risk, security questionnaires, and crisis leadership.

Previously **Security Advisory Consultant, Incident & Crisis Readiness** at a managed security service provider:

- Owned security governance, risk, and incident readiness advisory engagements for regulated enterprise clients, delivering audit-defensible security programs aligned to NIST CSF 2.0, NIST 800-61 r2, HIPAA, and federal risk management expectations.
- Advised on data handling, retention, and incident documentation practices supporting regulatory obligations and potential litigation scenarios.
- Conducted formal risk and control assessments, documented control gaps, and prioritized remediation by regulatory exposure, operational impact, and organizational risk tolerance.
- Developed executive-ready security risk reports and dashboards, presenting findings, trends, and decision points to senior leadership and boards.

Transitioned from military and fire rescue into cybersecurity in May 2024, with rapid progression including Employee of the Quarter recognition in the first year.

## Technical Projects

### 1. [AI-Enhanced Security Analysis](ai-enhanced-security-analysis.md)
Local LLM infrastructure with Mistral and a RAG system for automated log analysis, threat research, and incident response assistance. On-premise processing throughout.

**Key Stats**: Two-tier triage with overseer verification, RAG over ATT&CK, D3FEND, Sigma and CISA KEV, local inference only, 24GB RX 7900 XTX

### 2. [Automated Report Generation](automated-report-generation.md)
AI-powered system reducing client deliverable creation time by 95%. Generates professional TTX reports and IR assessments using local LLMs.

**Key Stats**: 4-8 hours to 3-20 minutes per document, TTX and IR assessment templates, automated rubric scoring

### 3. [Threat Intelligence Integration](threat-intelligence-integration.md)
Multi-source threat intel platform with automated IOC enrichment. Integrated VirusTotal, AbuseIPDB, AlienVault OTX, and Hybrid Analysis.

**Key Stats**: 2.3M IOCs indexed, 50K queries per day, four intel sources on a 5-minute enrichment cycle, threat_score 0-100 written to each alert

### 4. [Enterprise SOC Infrastructure](soc-infrastructure.md)
Full-stack security monitoring platform with ELK Stack, Suricata IDS, Zeek NSM, and Velociraptor EDR.

**Key Stats**: 307M events across the SOC indices, 118 GB of Suricata and Zeek telemetry, mirrored capture on a dedicated interface, 3 monitored endpoints

### 5. [DNS Behavioral Monitoring](dns-behavioral-monitoring.md)
Real-time DNS threat detection using DGA analysis, tunneling detection, and behavioral scoring. Integrated with Pushover alerting and ELK Stack.

**Key Stats**: 626K DNS records in 24 hours, DGA and tunneling detection, Zeek dns.log into Elasticsearch

### 6. [Firewalla Network Security Architecture](firewalla-network-security.md)
Defense-in-depth network architecture with multi-VLAN segmentation, threat prevention, and comprehensive traffic monitoring.

**Key Stats**: 877K blocked flows per day, 2.1M flow records per day, 6 VLANs segmented by trust level

### 7. [Business Infrastructure Platform](business-infrastructure-platform.md)
Self-hosted business infrastructure reaching the internet through Cloudflare Tunnel, with no inbound ports opened on the origin. Live at seriouslycyber.com.

**Key Stats**: $0/month hosting, outbound-only ingress with the origin IP unpublished, 6 lead generation templates, multi-domain tunnel

### 8. [Local Speech-to-Text Infrastructure](whisper-speech-to-text.md)
Privacy-focused transcription system using Whisper AI with GPU acceleration. Browser extension and system-wide hotkey for secure dictation.

**Key Stats**: 3-5 second transcription, local Whisper with ROCm acceleration, no cloud upload

## Security Assessment Work

### Automated Vulnerability Discovery in Production SOC Infrastructure
Leveraged Trail of Bits Claude Code security analysis skills to perform automated code review of production Security Operations Center infrastructure. Discovered and remediated 4 CRITICAL and 3 HIGH severity vulnerabilities in 157 minutes, demonstrating the effectiveness of AI-enhanced security assessment methodologies.
- Analysis Duration: 2 minutes 37 seconds (automated)
- Remediation Duration: 155 minutes (guided implementation)
- Tools Used: Claude Code with Trail of Bits security skills, insecure-defaults skill, static-analysis skill

Target Environment:
    • Tepes SOC - Enterprise security operations infrastructure 
    • 13 Python security applications 
    • Elasticsearch cluster (127 active shards, 230 total) 
    • Automated threat intelligence pipeline 
    • Real-time log analysis and automated response system 
Assessment Methodology:
    1. Automated security code review using Trail of Bits insecure-defaults skill 
    2. Command injection vulnerability analysis 
    3. Authentication and authorization review 
    4. Input validation assessment 
    5. Secrets management audit 

## Technical Skills

### Security Operations
- SIEM deployment & tuning (ELK Stack)
- Network security monitoring (Suricata, Zeek)
- Endpoint detection & response (Velociraptor)
- Threat intelligence integration
- Incident response & forensics

### Infrastructure & Automation  
- Linux system administration (Ubuntu, Pop!_OS)
- Docker containerization
- Python automation & scripting
- GPU acceleration (AMD ROCm)
- Service orchestration (systemd)
- API development (REST, WebSocket)

### Development
- Python (automation, analysis, APIs)
- JavaScript (browser extensions)
- Bash scripting
- SQL queries
- VQL (Velociraptor)
- Document automation (docx, pdf)

### AI/ML Integration
- LLM deployment (Ollama, Whisper)
- RAG systems
- Model optimization
- Prompt engineering

## Contact
- Website: seriouslycyber.com
- GitHub: https://github.com/SeriouslyCyberLLC/cybersecurity-portfolio
- Location: Parkton, North Carolina
- Clearance: Public Trust

---

**Last Updated**: August 2026  
**Portfolio Status**: Active Development
