# Larry's Cybersecurity Portfolio

## Professional Summary
AI security and governance professional focused on enterprise AI adoption, AI risk strategy, responsible AI controls, and secure use of generative and agentic systems.

## Certifications
- CISSP (Certified Information Systems Security Professional) — ISC2
- CCSP (Certified Cloud Security Professional) — ISC2
- AAISM (Advanced in AI Security Management) — ISACA
- SecAI+ (CompTIA SecAI+ Certification)
- CompTIA SecurityX (CASP+)
- CompTIA CySA+ (Cybersecurity Analyst)

## Current Focus
Assess AI use cases, vendors, customer-facing features, and internal AI workflows across regulated SaaS environments, working with Engineering, Product, Legal, Privacy, Compliance, and Security stakeholders.

- Translate ambiguous AI risk into executive-ready recommendations, control requirements, residual-risk decisions, and operational safeguards.
- Define responsible-AI controls for generative and agentic systems, weighing confidentiality, privacy, security, legal exposure, and business adoption together rather than in isolation.

## Background
AI security, DFIR consulting, regulated-healthcare MSSP experience, executive incident reporting, vendor risk, security questionnaires, and crisis leadership.

Previously **Security Advisory Consultant – Incident & Crisis Readiness** at a managed security service provider:

- Owned security governance, risk, and incident readiness advisory engagements for regulated enterprise clients, delivering audit-defensible security programs aligned to NIST CSF 2.0, NIST 800-61 r2, HIPAA, and federal risk management expectations.
- Advised on data handling, retention, and incident documentation practices supporting regulatory obligations and potential litigation scenarios.
- Conducted formal risk and control assessments, documented control gaps, and prioritized remediation by regulatory exposure, operational impact, and organizational risk tolerance.
- Developed executive-ready security risk reports and dashboards, presenting findings, trends, and decision points to senior leadership and boards.

Transitioned from military and fire rescue into cybersecurity in May 2024, with rapid progression including Employee of the Quarter recognition in the first year.

## Technical Projects

### 1. [Enterprise SOC Infrastructure](soc-infrastructure.md)
Full-stack security monitoring platform with ELK Stack, Suricata IDS, Zeek NSM, and Velociraptor EDR. Processing ~1.5M network security events and ~41M endpoint telemetry events daily with AI-enhanced threat analysis.

**Key Stats**: 6.09B documents / 1.51TB indexed, 307M network security events, 99.9% uptime, sub-second query performance

### 2. [DNS Behavioral Monitoring](dns-behavioral-monitoring.md)
Real-time DNS threat detection using DGA analysis, tunneling detection, and behavioral scoring. Integrated with Pushover alerting and ELK Stack.

**Key Stats**: Real-time processing, <5% FP rate, 24/7 operation

### 3. [Automated Report Generation](automated-report-generation.md)
AI-powered system reducing client deliverable creation time by 95%. Generates professional TTX reports and IR assessments using local LLMs.

**Key Stats**: 4-8 hours → 3-20 minutes, 10x capacity increase

### 4. [Local Speech-to-Text Infrastructure](whisper-speech-to-text.md)
Privacy-focused transcription system using Whisper AI with GPU acceleration. Browser extension and system-wide hotkey for secure dictation.

**Key Stats**: 3-5 second transcription, 95%+ accuracy, 100% local

### 5. [Threat Intelligence Integration](threat-intelligence-integration.md)
Multi-source threat intel platform with automated IOC enrichment, reducing analyst investigation time by 60%. Integrated VirusTotal, AbuseIPDB, AlienVault OTX, and Hybrid Analysis.

**Key Stats**: 50K daily API calls, 60% time savings, 40% FP reduction, 2.3M IOCs indexed

### 6. [Firewalla Network Security Architecture](firewalla-network-security.md)
Defense-in-depth network architecture with multi-VLAN segmentation, threat prevention, and comprehensive traffic monitoring. Blocks 877K+ malicious flows daily.

**Key Stats**: 877K+ blocked flows/day, 99.98% uptime, 2.1M flow records/day

### 7. [AI-Enhanced Security Analysis](ai-enhanced-security-analysis.md)
Local LLM infrastructure with Mistral and a RAG system for automated log analysis, threat research, and incident response assistance. 100% private, on-premise processing.

**Key Stats**: 60% analyst time savings, 35% FP reduction, 25-35 tokens/sec, 95%+ accuracy

### 8. Automated Vulnerability Discovery in Production SOC Infrastructure
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
