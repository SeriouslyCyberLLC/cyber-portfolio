# DNS Behavioral Monitoring System

## Overview
Real-time DNS threat detection system using behavioral analysis and machine learning techniques to identify command-and-control (C2) communications, data exfiltration, and malicious domains.

## Technical Implementation

### Detection Methods
1. **DGA Detection**: Entropy analysis (threshold: 3.5), vowel ratio, consonant patterns
2. **DNS Tunneling**: Query length analysis, base64 encoding detection, volume thresholds
3. **Suspicious TLDs**: Monitored high-risk extensions (.tk, .ml, .ga, .cf, .gq, .top, .xyz, .zip)
4. **Behavioral Scoring**: Risk-based scoring system (0-100+)

### Architecture
- **Data Source**: Zeek DNS logs (`/opt/zeek/spool/zeek/dns.log`)
- **Processing**: Python real-time stream processing
- **Alerting**: Pushover notifications for high-risk detections (score 80+)
- **Logging**: Structured JSON to `/var/log/tepes/dns-suspicious.log`
- **Integration**: Events forwarded to ELK Stack

### Scoring System
```
Score 50+: Logged for analysis
Score 80+: Real-time alert sent
Score 120: Critical threat (multi-vector detection)
```

### Performance
- **Processing Rate**: Real-time (no lag)
- **False Positive Rate**: <5% after tuning
- **Detection Speed**: Sub-second from DNS query to alert

## Sample Detections
- DGA domains: `qkjsdhfkljahsdkfjhaskldjfhalksjdhf.com` (Score: 120)
- Legitimate high-entropy: AWS ELB domains (whitelisted after analysis)

## Skills Demonstrated
- DNS protocol analysis
- Behavioral detection algorithms
- Real-time stream processing
- Python automation
- Alert orchestration
- False positive tuning

**Status**: Production, 24/7 monitoring  
**Built**: December 2025
