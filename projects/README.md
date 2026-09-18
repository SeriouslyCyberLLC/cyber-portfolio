# Larry's Cybersecurity Portfolio

**Live portfolio: https://seriouslycyberllc.github.io/cyber-portfolio/**

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
Local LLM that triages endpoint collections, rebuilt around an eval harness that measures recall as well as noise. The verdicts turned out to be sampled, not decided.

**Key Stats**: CRITICAL rate 37.8% to 0 over 10 days either side, 8 of 8 attack cases unstable at the default temperature, deterministic severity floor catching 8/8 with 0/117 false positives on real flows, one production false positive documented and open

### 2. [AI Red-Team Bench](ai-redteam-bench.md)
Paired-experiment harness that red-teams the SOC's own LLM triage tier and proves, with retained evidence, whether an attacker-controlled alert field can steer the verdict.

**Key Stats**: 7 of 10 payloads effective on first real run, null rate 0.0, 400/400 results corroborated against the ledger, mapped to OWASP LLM Top 10 and MITRE ATLAS

### 3. [RAG Retrieval Audit](rag-retrieval-audit.md)
The SOC's LLM triage retrieved context on every analysis and nobody had measured whether it was the right context. Asked it 30 questions with known answers, found the query builder was the defect, and rebuilt the query, embedding model and index around measurements.

**Key Stats**: right technique retrieved 6/30 to 22/30, 95% of a 2.5 GB vector store was orphaned index files, a per-process index cache that would have hidden every nightly rebuild from the running analyzer, 0 new false alarms with malicious cases given context 5/8 to 8/8

### 4. [Automated Report Generation](automated-report-generation.md)
AI-powered system reducing client deliverable creation time by 95%. Generates professional TTX reports and IR assessments using local LLMs.

**Key Stats**: 4-8 hours to 3-20 minutes per document, TTX and IR assessment templates, automated rubric scoring

### 5. [Threat Intelligence Integration](threat-intelligence-integration.md)
Multi-source threat intel platform with automated IOC enrichment. Integrated VirusTotal, AbuseIPDB, AlienVault OTX, and Hybrid Analysis.

**Key Stats**: Six intelligence sources (VirusTotal, AbuseIPDB, OTX, Hybrid Analysis, MISP, CISA KEV), enrichment lookup on every external source and destination IP

### 6. [Enterprise SOC Infrastructure](soc-infrastructure.md)
Six layers on owned hardware, and the map to every other project here: network detection, SIEM, threat intel, local LLM triage, endpoint EDR, and the assurance layer that watches all of it.

**Key Stats**: 8.73B documents across 2.30 TB with network telemetry only 11.7% of it, 12.6M network and 54.5M endpoint events per day, ingest ceiling 6,300 docs/sec bounded by spinning disks, four advertised capabilities retired on measurement rather than repaired

### 7. [SOC Assurance Audit](assurance-audit.md)
Audited a running SOC's own reliability rather than adding sensors. Eleven defects, every one invisible to status commands and exit codes, all found by measuring output.

**Key Stats**: 5 services healthy while producing nothing, 3 controls reporting success with no effect, intel pipeline dead 35 and 73 days, auto-blocker that could never unblock

### 8. [Hardening Telemetry](hardening-telemetry.md)
Daily security scanners had run for months and nothing had ever read their output. Turned each into tracked metrics, then decided — with measurements — what was allowed to page.

**Key Stats**: hardening index 66 to 71 and 59 to 70 across two hosts, rootkit findings piped into a dead mail path, 1 of 11 rules may page and it has never fired, a stale-baseline scanner purged rather than fixed, unreadable reports emit no score rather than a zero

### 9. [Integrity and Malware Scanning](integrity-and-malware-scanning.md)
Two controls on one host, both reporting healthy and both proving nothing, failing in opposite directions: a file-integrity monitor that had not run for 38 days, and an antivirus daemon in perfect health that nothing had ever asked to scan.

**Key Stats**: antivirus holding 8 MB resident against 955 MB swapped out, integrity scope 2,000,000 entries to 70,770 and 717s to 170s, change alerts calibrated 289:1 against routine churn, a permanent positive control without which "0 infected" means nothing

### 10. [Off-Site Backup and Restore](off-site-backup.md)
Encrypted off-site backup of the SOC's configuration, detections and git repositories, with immutable retention and a restore drill that cannot pass vacuously. The tooling sat reviewed and committed for two weeks without ever being run.

**Key Stats**: five runtime-only defects between committed code and one snapshot, backup set 1,830 MB to 179 MB once a live database directory came out, 30-day delete protection with no prune path, first weekly integrity check passed against an empty repository — now floored, and the floor is mutation-tested

### 11. [DNS Behavioral Monitoring — built, measured, retired](dns-behavioral-monitoring.md)
DGA and tunneling detector over Zeek DNS. Ran 17 days, was measured against its own output, and was retired on the evidence. The post-mortem covers both the precision failure and the silent-failure mode that hid it for seven months.

**Key Stats**: 2.6M detections in 17.2 days, 99.9% at the score floor, 96.6% of output was the host's own hostname, 61 false pages/day

### 12. [Firewalla Network Security Architecture](firewalla-network-security.md)
Defense-in-depth network architecture with multi-VLAN segmentation, threat prevention, and comprehensive traffic monitoring.

**Key Stats**: 877K blocked flows per day, 2.1M flow records per day, 6 VLANs segmented by trust level

### 13. [Business Infrastructure Platform](business-infrastructure-platform.md)
Self-hosted business infrastructure reaching the internet through Cloudflare Tunnel, with no inbound ports opened on the origin. Live at seriouslycyber.com.

**Key Stats**: $0/month hosting, outbound-only ingress with the origin IP unpublished, 6 lead generation templates, multi-domain tunnel

### 14. [Local Speech-to-Text Infrastructure](whisper-speech-to-text.md)
Privacy-focused transcription system using Whisper AI with GPU acceleration. Browser extension and system-wide hotkey for secure dictation.

**Key Stats**: 3-5 second transcription, local Whisper with ROCm acceleration, no cloud upload

## Security Assessment Work

### Automated Vulnerability Discovery in Production SOC Infrastructure
Leveraged Trail of Bits Claude Code security analysis skills to perform automated code review of production Security Operations Center infrastructure. Discovered and remediated 4 CRITICAL and 3 HIGH severity vulnerabilities in 157 minutes, demonstrating the effectiveness of AI-enhanced security assessment methodologies.
- Analysis Duration: 2 minutes 37 seconds (automated)
- Remediation Duration: 155 minutes (guided implementation)
- Tools Used: Claude Code with Trail of Bits security skills, insecure-defaults skill, static-analysis skill

Target Environment:
    • soc-01 - Enterprise security operations infrastructure 
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
- Portfolio: https://seriouslycyberllc.github.io/cyber-portfolio/
- Website: seriouslycyber.com
- GitHub: https://github.com/SeriouslyCyberLLC/cyber-portfolio
- Location: Fayetteville, North Carolina Metro Area
- Clearance: Public Trust

---

**Last Updated**: August 2026  
**Portfolio Status**: Active Development
