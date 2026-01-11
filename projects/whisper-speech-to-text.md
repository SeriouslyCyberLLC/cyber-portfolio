# Local Speech-to-Text Infrastructure

## Overview
Built a fully local, privacy-focused speech-to-text system using OpenAI Whisper on AMD GPU infrastructure for enterprise security environments.

## Business Problem
- Need for confidential dictation in security-sensitive environments
- Cloud-based solutions pose data privacy risks
- Required zero-latency, always-available speech recognition

## Technical Solution

### Architecture
- **Whisper Server**: Local transcription using AMD ROCm GPU acceleration
- **WebSocket API** (port 9000): Real-time streaming
- **HTTP API** (port 9001): File-based transcription
- **Browser Extension**: Chrome/Brave integration for web applications
- **System-Wide Hotkey**: Ctrl+Alt+M for universal dictation

### Infrastructure
- **Platform**: Pop!_OS Linux (Ubuntu-based)
- **GPU**: AMD RX 7900 XTX with ROCm
- **Model**: Whisper Medium (1.5GB)
- **Services**: Systemd-managed, auto-start on boot

### Key Features
1. **Privacy**: 100% local processing, no cloud dependencies
2. **Speed**: 3-5 second transcription for 10-second audio
3. **Accuracy**: Whisper medium model, multilingual support
4. **Integration**: Works in any application via keyboard automation

## Implementation Details

### Services Created
```bash
/etc/systemd/system/whisper-server.service    # WebSocket server
/etc/systemd/system/whisper-http.service      # HTTP API server
~/.config/systemd/user/dictation-hotkey.service  # Hotkey handler
```

### Browser Extension
- Manifest V3 compliant
- Cross-site integration (HTTPS sites)
- Audio capture via MediaRecorder API
- Real-time transcription feedback

### Code Repository
[Link will go here once pushed to GitHub]

## Results
- **Transcription Speed**: 3-5 seconds for 10s audio
- **Accuracy**: 95%+ for clear speech
- **Uptime**: 24/7 availability via systemd
- **Privacy**: Zero data exfiltration

## Skills Demonstrated
- Linux system administration
- API development (WebSocket, HTTP)
- Browser extension development (JavaScript, Manifest V3)
- GPU acceleration (ROCm)
- Service management (systemd)
- Python automation
- Security architecture (local-first design)

## Use Cases
- Incident response report dictation
- Secure communication transcription
- Documentation in air-gapped environments
- Accessibility tooling for security analysts

---

**Built**: January 2026  
**Status**: Production-ready  
**License**: Private/Portfolio
