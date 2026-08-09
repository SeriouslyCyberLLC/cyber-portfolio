# Enterprise Network Security Architecture with Firewalla

## Overview
Designed and implemented defense-in-depth network architecture using Firewalla Gold Pro for multi-VLAN segmentation, traffic monitoring, and threat prevention. Provides network visibility and security enforcement for distributed security operations center.

## Business Challenge
- Need for network segmentation to isolate security workloads
- Real-time threat prevention at network perimeter
- Traffic visibility for security monitoring and forensics
- Protection against external threats while maintaining performance

## Network Architecture

### VLAN Segmentation Strategy
```
VLAN 20: Secondary Linux node (Anubis)
VLAN 40: Guest network (isolated, restricted egress)
VLAN 60: Primary workstation
VLAN 70: Windows endpoint (EDR agent)
VLAN 80: Servers and self-hosted infrastructure
VLAN 81: Security operations (ELK, Suricata, Zeek, Velociraptor)
```
Each segment is a routed `/24` in `192.168.<vlan>.0/24` form, with the Firewalla as
the gateway at `.1`. Inter-VLAN traffic is denied by default and allowed only where a
rule exists, so the monitored endpoints on 20, 60 and 70 cannot reach the security
operations segment on 81 except on the ports the EDR and log shippers need.

### Traffic Flow Design
- **Port Mirroring**: Managed switch mirrors all traffic to security monitoring VLAN
- **Ingress/Egress Filtering**: Rules enforce zero-trust between VLANs
- **Deep Packet Inspection**: All traffic analyzed at network boundary
- **Threat Intelligence**: Real-time blocking of malicious IPs/domains

## Technical Implementation

### Firewalla Gold Pro Configuration
- **Hardware**: Dual-core ARM, 2GB RAM, 32GB storage
- **Interfaces**: 4x Gigabit Ethernet (router mode)
- **Performance**: Line-rate throughput with DPI enabled
- **Management**: Web UI + mobile app for remote administration

### Security Rules Implemented
1. **Geo-blocking**: Block traffic from high-risk countries
2. **Category Filtering**: Block malware, phishing, botnet C2 domains
3. **Port Control**: Restrict outbound connections by application
4. **Device Isolation**: Prevent lateral movement between VLANs
5. **VPN**: Encrypted remote access for security operations

### Integration with Security Stack
- **Traffic Mirroring**: Full packet capture to Zeek/Suricata
- **Flow Logs**: NetFlow data exported to ELK Stack
- **Threat Feeds**: Integrated with threat intelligence platform
- **Alerting**: Critical blocks trigger Pushover notifications

## Performance Metrics

### Threat Prevention
- **Daily Blocked Flows**: 877,321 (from Gatekeeper alone)
- **Blocked Domains**: 12,000+ malicious/suspicious domains
- **Geo-blocked IPs**: 45,000+ high-risk source addresses
- **Intrusion Attempts**: 1,200+ daily connection attempts blocked

### Network Performance
- **Throughput**: 950 Mbps with full DPI enabled
- **Latency**: <2ms added latency for inspection

### Visibility
- **Flow Records**: 2.1M daily network flows logged
- **DNS Queries**: 145K daily queries monitored
- **Bandwidth Usage**: Per-device tracking and alerting
- **Application Identification**: 850+ applications detected

## Security Features Deployed

### Advanced Threat Protection
- **IDS/IPS**: Inline intrusion prevention with Suricata signatures
- **DNS Security**: DNS-over-HTTPS, malicious domain blocking
- **Ad Blocking**: Network-wide ad/tracker blocking (optional)
- **VPN Server**: WireGuard for secure remote access
- **VPN Client**: Route specific traffic through commercial VPN

### Network Monitoring
- **Real-time Dashboard**: Live traffic visualization
- **Historical Analysis**: 90-day flow retention
- **Anomaly Detection**: Baseline behavior with alerting
- **Device Discovery**: Automatic network mapping
- **Bandwidth Monitoring**: Per-device usage tracking

### Access Control
- **Device Grouping**: Logical groups with shared policies
- **Time-based Rules**: Scheduled access restrictions
- **Port Forwarding**: Secure external service exposure
- **MAC Filtering**: Device authentication at L2
- **Guest Network**: Isolated network with captive portal

## Integration Architecture

### Data Flow
```
Network Traffic → Firewalla (inspection/blocking) → Mirror → Security VLAN
                         ↓
                  Flow Logs → ELK Stack → Kibana Dashboards
                         ↓
                  Threat Intel → IOC Correlation → Automated Response
```

### Automation Integration
- **API Access**: RESTful API for programmatic control
- **Python Scripts**: Automated rule management
- **Webhook Integration**: Events trigger security workflows
- **Syslog Export**: Centralized logging to SIEM

## Use Cases

### 1. Malware C2 Prevention
- Device attempts connection to known botnet C2 server
- Firewalla blocks connection based on threat intelligence
- Alert sent to security team via Pushover
- Flow logged to ELK for investigation

### 2. Lateral Movement Prevention
- Compromised device on the guest network attempts to scan internally
- VLAN isolation prevents access to the security operations segment
- Connection attempts logged and analyzed
- Device automatically quarantined to restricted VLAN

### 3. Data Exfiltration Detection
- Workstation initiates unusual high-bandwidth upload
- Bandwidth monitoring triggers alert
- Deep packet inspection reveals suspicious data transfer
- Connection blocked, incident response initiated

## Technical Skills Demonstrated
- Network architecture and design
- VLAN segmentation and routing
- Firewall rule development
- Traffic analysis and monitoring
- Threat intelligence integration
- Network performance optimization
- Zero-trust security principles
- API integration and automation

## Business Impact
- **Attack Surface Reduction**: Segmentation confines a compromised device to its own VLAN
- **Threat Prevention**: 877K daily malicious connections blocked
- **Incident Response**: Network forensics data for investigations
- **Compliance**: Network segmentation for regulatory requirements
- **Cost**: No per-seat or per-throughput licensing

## Limitations
Honest scope notes, since this is prosumer hardware doing a job enterprises solve differently:
- Single appliance, so it is a single point of failure with no HA pair
- Deep packet inspection cannot see inside TLS without interception, which is not deployed here
- Threat feeds are the vendor's, not tunable the way a commercial NGFW ruleset is
- Throughput ceiling is well below a datacenter firewall; adequate for this link, not for a campus

## Future Enhancements
- Implement SD-WAN for multi-site connectivity
- Add honeypot network for threat research
- Expand VPN capacity for remote workforce
- Integrate with SOAR platform for automated response

---

**Deployed**: September 2025  
**Status**: Production, 24/7 operation  
**Performance**: 950 Mbps with DPI enabled
