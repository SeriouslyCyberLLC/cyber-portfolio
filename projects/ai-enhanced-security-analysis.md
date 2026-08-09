# AI-Enhanced Security Analysis Platform

## Overview
Deployed local Large Language Model (LLM) infrastructure for security log analysis, threat investigation, and automated incident response. Provides AI-powered context and recommendations while maintaining complete data privacy through on-premise processing.

## Business Problem
- Security analysts overwhelmed by alert volume
- Complex log analysis requires specialized expertise
- Manual threat research is time-consuming
- Need for consistent, documented investigation procedures
- Privacy concerns with cloud-based AI services

## Technical Solution

### AI Infrastructure
- **Platform**: Ollama for local LLM hosting
- **Triage Model**: mistral:7b (4.4GB) for first-pass classification
- **Overseer Model**: mistral-small:22b (12GB) for verification and harder cases
- **Hardware**: AMD RX 7900 XTX (24GB) with ROCm acceleration
- **Server**: Tepes, a dedicated Debian system (Intel i9-13900K, 24 cores / 32 threads)

### RAG (Retrieval Augmented Generation) System
- **Knowledge Base**: MITRE ATT&CK framework, security procedures, threat intel
- **Vector Database**: ChromaDB for semantic search
- **Embedding Model**: sentence-transformers/all-MiniLM-L6-v2
- **Context Window**: 32K tokens for long-form analysis

## Implementation Architecture

### Data Processing Pipeline
```
Security Event → Log Parsing → LLM Analysis → Contextualized Alert
                       ↓
              RAG System (ATT&CK, TI) → Enhanced Context → Recommended Actions
```

### Integration Points
1. **ELK Stack**: Automated analysis of suspicious events
2. **Velociraptor**: Artifact analysis and hunt recommendations
3. **DNS Monitor**: Behavioral pattern explanation
4. **Threat Intel**: IOC contextualization and attribution

## Use Cases

### 1. Log Analysis & Correlation
**Input**: Complex security event with multiple data sources
**Process**: LLM analyzes logs, correlates events, identifies patterns
**Output**: Natural language summary with technical details and recommendations

**Example**:
```
Alert: Suspicious PowerShell execution on workstation
LLM Analysis:
- Identified Base64-encoded command execution
- Correlated with previous failed login attempts
- Matched MITRE ATT&CK T1059.001 (PowerShell)
- Recommended: Memory dump, network traffic analysis, user interview
```

### 2. Threat Intelligence Research
**Input**: Unknown IOC or suspicious domain
**Process**: RAG system searches threat intel database, LLM synthesizes findings
**Output**: Threat actor attribution, campaign details, defensive recommendations

**Example**:
```
Query: Analyze domain "evil-c2-server[.]com"
AI Response:
- First seen: 2024-12-15 (threat intel feeds)
- Associated with APT29 infrastructure
- Used in recent phishing campaign targeting finance sector
- TTPs: Credential harvesting, lateral movement via SMB
- Defensive actions: Block domain, hunt for similar patterns, review email logs
```

### 3. Incident Response Playbook Generation
**Input**: Incident type and initial indicators
**Process**: LLM generates step-by-step investigation procedure
**Output**: Customized IR playbook with commands and expected results

**Example**:
```
Incident: Suspected ransomware infection
Generated Playbook:
1. Isolate affected system (network + VLAN)
2. Capture memory dump: volatility -f memdump.raw imageinfo
3. Identify process tree: pslist, pstree
4. Extract network connections: netscan
5. Search for file modifications: timeline analysis
6. Check for lateral movement indicators
7. Preserve evidence for forensics
```

### 4. Security Training & Documentation
**Input**: Security concept or procedure question
**Process**: LLM explains in appropriate detail level
**Output**: Clear, accurate explanation with examples

**Example**:
```
Query: Explain Kerberoasting attack
AI Response: [Detailed explanation with attack steps, detection methods, 
and defensive measures, tailored to analyst's expertise level]
```

## Performance Metrics

### Analysis Speed
- **Simple Event Analysis**: 2-5 seconds
- **Complex Correlation**: 10-15 seconds
- **Threat Intelligence Research**: 5-8 seconds
- **Playbook Generation**: 15-20 seconds

### Quality Controls
- **Two-Tier Verification**: mistral:7b produces the first-pass verdict, mistral-small:22b reviews it before anything is surfaced
- **Grounded Output**: Every technique mapping is drawn from the retrieved ATT&CK context rather than model recall
- **Structured Verdicts**: Fixed output schema, so a malformed or low-confidence response fails closed instead of guessing
- **Human in the Loop**: No containment action is taken on a model verdict alone

### Resource Utilization
- **GPU Memory**: 24GB VRAM total; 4.4GB resident for mistral:7b, 12GB for mistral-small:22b
- **Inference Speed**: 25-35 tokens/second
- **Concurrent Requests**: Up to 3 simultaneous analyses
- **Model Loading Time**: 8-12 seconds cold start

## RAG System Details

### Knowledge Base Components
1. **MITRE ATT&CK Framework**
   - All 14 tactics, 193+ techniques
   - Sub-techniques and procedures
   - Detection methods and mitigations

2. **Threat Intelligence**
   - APT group profiles and TTPs
   - Malware family behaviors
   - Campaign analysis and IOCs

3. **Security Procedures**
   - Incident response playbooks
   - Forensic analysis procedures
   - Tool usage documentation

4. **Internal Knowledge**
   - Custom detection rules
   - Environment-specific context
   - Historical incident data

### Semantic Search Implementation
- **Embedding Dimension**: 384
- **Search Method**: Cosine similarity
- **Top-K Results**: 5 most relevant chunks
- **Context Injection**: Relevant knowledge added to LLM prompt

## Technical Skills Demonstrated
- Large Language Model deployment and optimization
- GPU acceleration (AMD ROCm)
- RAG system architecture
- Vector database implementation
- Prompt engineering for security analysis
- Model quantization and optimization
- API development for LLM integration
- Privacy-preserving AI implementation

## Privacy & Security

### Data Protection
- **100% Local Processing**: No data leaves infrastructure
- **No Internet Connectivity**: Models run air-gapped from external services
- **Sensitive Data Handling**: PII/credentials never sent to external APIs
- **Audit Trail**: All queries and responses logged locally

### Model Security
- **Open Source Models**: Auditable, no vendor lock-in
- **Offline Operation**: No dependency on external services
- **Version Control**: Model versioning and rollback capability
- **Access Control**: API authentication and authorization

## Automation Integration

### Automated Workflows
1. **Alert Enrichment**: Security events auto-analyzed on detection
2. **Daily Summaries**: Automated daily security posture reports
3. **Threat Briefings**: Morning digest of overnight activity
4. **Investigation Assistance**: On-demand analysis for SOC analysts

### Python Integration
```python
# Example: Automated alert analysis
def analyze_security_event(event):
    prompt = f"""
    Analyze this security event:
    {event['details']}
    
    Provide:
    1. Severity assessment
    2. MITRE ATT&CK mapping
    3. Recommended actions
    """
    
    response = ollama.generate(
        model="mistral:7b",
        prompt=prompt,
        context=rag_search(event['indicators'])
    )
    
    return response['response']
```

## Business Impact
- **Analyst Efficiency**: Routine enrichment and ATT&CK mapping happen before an analyst opens the alert
- **Knowledge Retention**: Consistent analysis methodology across every alert, independent of who is on shift
- **Cost**: Runs on already-owned hardware, with no per-token or per-seat billing
- **Data Residency**: Alert contents never leave the host, which is what makes the tool usable on regulated data

## Comparison to Alternatives
- **vs. ChatGPT/Claude**: 100% private, no API costs, custom knowledge
- **vs. Security Copilot**: Local data, customizable, one-time cost
- **vs. Manual Analysis**: Faster, more consistent, scalable

## Future Enhancements
- Multi-agent systems for complex investigations
- Fine-tuning models on proprietary incident data
- Real-time analysis of streaming security events
- Integration with SOAR platforms for automated response
- Custom security-focused models

---

**Deployed**: November 2025  
**Status**: Production, continuous enhancement  
**Performance**: 25-35 tokens/sec
