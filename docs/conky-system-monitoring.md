# Conky System Monitoring Configuration

## Overview
Custom Conky system monitoring overlay providing real-time visibility into system performance, security stack operations, and network activity on the Tepes security operations workstation.

## Configuration Files

### Main Configuration
- **Location**: `~/.config/conky/tepes.conf`
- **Auto-start**: `~/.config/autostart/conky-tepes.desktop`
- **Lua Scripts**: `~/.config/conky/tepes_disks.lua`, `gauges.lua`
- **Helper Scripts**: 
  - `read_gpu.sh` - AMD GPU metrics
  - `read_power.sh` - Power consumption
  - `read_temp.sh` - Temperature sensors

## Display Metrics

### System Resources
- **CPU**: Per-core temperatures (48 cores), aggregate load percentage, CPU frequency
- **RAM**: Used/Total with percentage (128GB capacity)
- **Swap**: Usage and percentage (20GB)
- **GPU**: Temperature, utilization, VRAM usage, power draw

### Storage
- **Root (/)**: NVMe SSD usage (1.78TB capacity)
- **Archive HDD**: 3.58TB capacity
- **Disk Temperatures**: Individual disk temp monitoring (sda, sdb, sdc, nvme0n1)

### Network
- **Interface**: net0 (primary)
- **Upload/Download**: Real-time bandwidth in MB/s
- **Visual Graph**: Network traffic visualization

### Color-Coded Status Indicators

#### Usage Levels
- **<50%**: Green (healthy)
- **50-74%**: Yellow (moderate)
- **75-89%**: Orange (elevated)
- **≥90%**: Red (critical)

#### Temperature Ranges
- **<45°C**: Green (optimal)
- **45-59°C**: Yellow (warm)
- **60-69°C**: Orange (hot)
- **≥70°C**: Red (critical)

#### Network Bandwidth
- **<100 MB/s**: Green (normal)
- **100-299 MB/s**: Yellow (moderate)
- **300-699 MB/s**: Orange (high)
- **≥700 MB/s**: Red (saturated)

## Lua Gauges Implementation

### Disk Monitoring Gauge (`tepes_disks.lua`)
- Circular gauge visualization for disk usage
- Color-coded based on utilization percentage
- Displays used/total capacity
- Temperature monitoring for each disk

### Performance Gauges (`gauges.lua`)
- CPU, RAM, GPU utilization gauges
- Real-time update interval: 1 second
- Smooth animation transitions
- Responsive to system load changes

## Auto-start Configuration

### Desktop Entry
**File**: `~/.config/autostart/conky-tepes.desktop`
```ini
[Desktop Entry]
Type=Application
Name=Conky (Tepes)
Comment=System Monitor
Exec=/usr/bin/conky -c /home/cyberguy/.config/conky/tepes.conf
Terminal=false
Categories=System;Monitor;
```

### Startup Behavior
- Launches 5 seconds after desktop login
- Positioned in top-right corner
- Transparent background with slight shadow
- Always on top, below desktop icons
- No decorations, click-through enabled

## Helper Scripts

### GPU Metrics (`read_gpu.sh`)
```bash
#!/bin/bash
# Reads AMD GPU metrics via rocm-smi
# Output: Temperature, utilization, VRAM, power draw
```

### Power Monitoring (`read_power.sh`)
```bash
#!/bin/bash
# Reads system power consumption
# Uses hwmon sensors for CPU/GPU power
```

### Temperature Sensors (`read_temp.sh`)
```bash
#!/bin/bash
# Aggregates temperature data from:
# - CPU cores (k10temp)
# - NVMe drives (nvme-cli)
# - HDDs (hddtemp/smartctl)
# - GPU (rocm-smi)
```

## Conky Configuration Highlights

### Update Intervals
- **General Updates**: 1.0 second
- **CPU Monitoring**: Real-time per-core
- **Network Stats**: 1.0 second
- **Disk I/O**: 2.0 seconds
- **Temperature**: 2.0 seconds

### Display Settings
- **Alignment**: Top right
- **Gap**: 20px from edge
- **Background**: Transparent with 0.7 opacity
- **Font**: DejaVu Sans Mono 10pt
- **Colors**: Dynamic based on metrics
- **Border**: None (frameless)

### Resource Usage (Conky Itself)
- **CPU**: <1% average
- **RAM**: ~28MB
- **Update Overhead**: Negligible

## Monitoring Security Stack

### Security Services Visibility
- ELK Stack services (Elasticsearch, Logstash, Kibana)
- Suricata IDS/IPS status
- Zeek NSM process monitoring
- Velociraptor server/agent status
- Whisper transcription services

### System Health Indicators
- High CPU usage indicates active security processing
- RAM usage shows ELK data buffering
- Network bandwidth reflects event ingestion rate
- Disk I/O shows log write activity

## Customization

### Adding New Metrics
1. Edit `~/.config/conky/tepes.conf`
2. Add conky variable or script call
3. Update Lua gauges if visual representation needed
4. Reload Conky: `killall conky && conky -c ~/.config/conky/tepes.conf`

### Color Theme Customization
Edit color definitions in `tepes.conf`:
```lua
color0 = '#FFFFFF'  -- White (default text)
color1 = '#00FF00'  -- Green (healthy)
color2 = '#FFFF00'  -- Yellow (caution)
color3 = '#FFA500'  -- Orange (warning)
color4 = '#FF0000'  -- Red (critical)
color5 = '#00FFFF'  -- Cyan (headers)
```

### Position Adjustment
```lua
alignment = 'top_right'
gap_x = 20
gap_y = 20
```

## Troubleshooting

### Conky Not Starting
```bash
# Check autostart file exists
ls -la ~/.config/autostart/conky-tepes.desktop

# Test manually
conky -c ~/.config/conky/tepes.conf

# Check for errors
journalctl --user -u conky -n 50
```

### Missing Metrics
```bash
# Verify helper scripts are executable
chmod +x ~/.config/conky/read_*.sh

# Test scripts individually
~/.config/conky/read_gpu.sh
~/.config/conky/read_temp.sh
```

### Display Issues
```bash
# Kill and restart Conky
killall conky
conky -c ~/.config/conky/tepes.conf &

# Check X11 display
echo $DISPLAY
```

### Permission Issues
```bash
# Fix ownership
sudo chown -R cyberguy:cyberguy ~/.config/conky/

# Fix permissions
chmod 644 ~/.config/conky/tepes.conf
chmod 755 ~/.config/conky/*.sh
```

## Performance Optimization

### Reduce Update Frequency
```lua
update_interval = 2.0  -- Instead of 1.0
cpu_avg_samples = 4    -- Smooth CPU readings
net_avg_samples = 4    -- Smooth network readings
```

### Disable Unused Features
Comment out sections not needed:
```lua
-- ${exec ~/.config/conky/read_power.sh}  # Disable if not needed
```

## Integration with Security Operations

### Use Cases
1. **Live Monitoring**: Watch system load during security event processing
2. **Resource Planning**: Identify bottlenecks during high-traffic periods
3. **Incident Response**: Quick system health check during investigations
4. **Performance Tuning**: Validate optimization changes in real-time

### Key Metrics for Security Ops
- **CPU Spike**: Indicates active threat processing (Suricata/Zeek)
- **RAM Growth**: ELK data buffering, possible retention issues
- **Network Traffic**: Event ingestion rate from monitored systems
- **Disk I/O**: Log write performance, potential bottleneck

## Files Reference
```
~/.config/conky/
├── tepes.conf              # Main configuration
├── tepes_disks.lua         # Disk gauge visualization
├── gauges.lua              # Performance gauges
├── read_gpu.sh             # GPU metrics script
├── read_power.sh           # Power monitoring script
└── read_temp.sh            # Temperature aggregation

~/.config/autostart/
└── conky-tepes.desktop     # Auto-start configuration

~/.conkyrc                  # Fallback/default config (not used)
```

## Backup Configuration
```bash
# Backup Conky config
tar -czf ~/conky-backup-$(date +%Y%m%d).tar.gz ~/.config/conky/

# Restore from backup
tar -xzf ~/conky-backup-YYYYMMDD.tar.gz -C ~/
```

## Screenshots

Key views captured in portfolio:
- Full system overview (all metrics visible)
- High-load state (security processing active)
- Network traffic spike (event ingestion)
- Thermal management (cooling system performance)

---

**Configured**: September 2025  
**Last Updated**: January 2026  
**Status**: Production, auto-start enabled  
**Performance Impact**: <1% CPU, ~28MB RAM
