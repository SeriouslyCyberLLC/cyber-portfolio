# Portfolio Master Documentation

## Overview
This document contains all commands, procedures, and technical details for maintaining and updating the cybersecurity portfolio hosted at https://seriouslycyberllc.github.io/cybersecurity-portfolio/

---

## Repository Information

- **GitHub Repo**: https://github.com/SeriouslyCyberLLC/cybersecurity-portfolio
- **Live Site**: https://seriouslycyberllc.github.io/cybersecurity-portfolio/
- **Local Directory**: `/home/cyberguy/portfolio/`
- **GitHub Username**: SeriouslyCyberLLC
- **Email**: larry.harvey.cyber@protonmail.com

---

## Initial Setup Commands

### 1. Created Local Portfolio Structure
```bash
mkdir -p ~/portfolio/{projects,docs,scripts,screenshots}
cd ~/portfolio
```

### 2. Initialized Git Repository
```bash
git init
git config user.name "SeriouslyCyberLLC"
git config user.email "larry.harvey.cyber@protonmail.com"
```

### 3. Created .gitignore
```bash
cat > .gitignore << 'GITIGNORE'
screenshots/*
!screenshots/portfolio-picks/
!screenshots/portfolio-picks/*.png
__pycache__/
*.py[cod]
*env/
venv/
*.key
*.pem
*config.json
notification_config.json
*.log
.DS_Store
Thumbs.db
GITIGNORE
```

### 4. Initial Commit
```bash
git add .
git commit -m "Initial commit: Cybersecurity portfolio with 4 major projects"
```

### 5. Connected to GitHub
```bash
git remote add origin https://github.com/SeriouslyCyberLLC/cybersecurity-portfolio.git
git branch -M main
git push -u origin main
```

**Note**: Uses Personal Access Token (PAT) as password, not GitHub password

---

## Common Git Commands

### Check Status
```bash
cd ~/portfolio
git status
```

### View Changes
```bash
git diff
```

### Add Changes
```bash
# Add specific file
git add filename.md

# Add all changes
git add .
```

### Commit Changes
```bash
git commit -m "Description of changes"
```

### Push to GitHub
```bash
git push origin main
```

### Pull Latest Changes
```bash
git pull origin main
```

### View Commit History
```bash
git log --oneline
```

---

## Editing Portfolio Content

### Edit Main Website
```bash
cd ~/portfolio
nano index.html

# After editing:
git add index.html
git commit -m "Updated website content"
git push origin main
```

### Edit Project Documentation
```bash
cd ~/portfolio/projects
nano project-name.md

# After editing:
git add .
git commit -m "Updated project documentation"
git push origin main
```

### Add New Project

1. **Create project documentation:**
```bash
cd ~/portfolio/projects
nano new-project-name.md
```

2. **Add to main README:**
```bash
nano README.md
# Add project entry in Technical Projects section
```

3. **Add to website (index.html):**
```bash
nano index.html
# Add new <div class="project"> section with:
# - Project title and emoji
# - Description
# - Stats box
# - Tech stack
# - Read More link
```

4. **Commit and push:**
```bash
git add .
git commit -m "Add [project name] to portfolio"
git push origin main
```

---

## File Ownership Issues

If you get permission errors (happens when using `sudo` for git commands):
```bash
cd ~/portfolio
sudo chown -R cyberguy:cyberguy .git/
```

---

## GitHub Authentication

### Using Personal Access Token (PAT)

When pushing/pulling, Git will ask for credentials:
- **Username**: `SeriouslyCyberLLC`
- **Password**: Paste your GitHub Personal Access Token (starts with `ghp_...`)

**Never use your GitHub password - it won't work!**

### Create New Token (if needed)
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name: `Portfolio Updates`
4. Expiration: 90 days (or longer)
5. Scopes: Check **repo** (all boxes)
6. Click "Generate token"
7. **Copy the token immediately** (you only see it once)

---

## GitHub Pages Configuration

### Enable GitHub Pages
1. Go to: https://github.com/SeriouslyCyberLLC/cybersecurity-portfolio
2. Click "Settings"
3. Click "Pages" (left sidebar)
4. Source: **Deploy from branch**
5. Branch: **main**
6. Folder: **/ (root)**
7. Click "Save"

Site builds automatically on every push (takes 1-2 minutes).

---

## Directory Structure
```
~/portfolio/
├── .git/                          # Git repository data
├── .gitignore                     # Files to exclude from git
├── index.html                     # Main website (portfolio landing page)
├── PORTFOLIO_MASTER_DOCUMENTATION.md  # This file
├── projects/
│   ├── README.md                  # Projects index
│   ├── soc-infrastructure.md
│   ├── dns-behavioral-monitoring.md
│   ├── automated-report-generation.md
│   ├── whisper-speech-to-text.md
│   └── threat-intelligence-integration.md
└── screenshots/
    └── portfolio-picks/           # Selected screenshots for portfolio
        ├── Screenshot from 2025-12-31 05-05-31.png
        ├── Screenshot from 2025-12-31 04-09-11.png
        ├── Screenshot from 2025-12-28 22-27-58.png
        └── Screenshot from 2025-12-22 15-47-55.png
```

---

## Current Portfolio Projects

1. **Enterprise SOC Infrastructure** - Full-stack SIEM with ELK, Suricata, Zeek, Velociraptor
2. **DNS Behavioral Monitoring** - Real-time threat detection with DGA analysis
3. **Automated Report Generation** - AI-powered TTX/IR report system
4. **Local Speech-to-Text** - Privacy-focused Whisper transcription
5. **Threat Intelligence Integration** - Multi-source IOC enrichment platform

---

## Troubleshooting

### "Permission denied" errors
```bash
sudo chown -R cyberguy:cyberguy ~/portfolio/.git/
```

### "divergent branches" error
```bash
cd ~/portfolio
git config pull.rebase false
git pull origin main
# Resolve any conflicts, then:
git push origin main
```

### Changes not showing on website
- Wait 1-2 minutes after pushing
- Check GitHub Actions: https://github.com/SeriouslyCyberLLC/cybersecurity-portfolio/actions
- Hard refresh browser (Ctrl+Shift+R)

### "Authentication failed"
- Make sure you're using your GitHub PAT, not password
- Username must be: `SeriouslyCyberLLC`
- Check token hasn't expired: https://github.com/settings/tokens

---

## Maintenance Tasks

### Weekly
- Review and update project metrics if significant changes
- Check for any broken links
- Review GitHub Issues (if any)

### Monthly
- Update certifications section if new certs obtained
- Add new projects as completed
- Review and refresh screenshots if systems updated

### As Needed
- Update contact information
- Add new technical skills
- Update employment status
- Refresh metrics and statistics

---

## Quick Reference - Most Common Commands
```bash
# Navigate to portfolio
cd ~/portfolio

# Check what changed
git status

# Add and commit all changes
git add .
git commit -m "Brief description of changes"

# Push to GitHub (makes changes live)
git push origin main

# Edit main website
nano index.html

# Edit project docs
cd projects
nano project-name.md
```

---

## Website Update Workflow

1. **Make changes locally**
```bash
   cd ~/portfolio
   nano index.html  # or edit project files
```

2. **Preview changes** (optional)
```bash
   # Open in browser to check
   firefox index.html
```

3. **Commit changes**
```bash
   git add .
   git commit -m "Description of what you changed"
```

4. **Push to GitHub**
```bash
   git push origin main
   # Enter username: SeriouslyCyberLLC
   # Enter password: [GitHub PAT token]
```

5. **Wait 1-2 minutes**, then check live site

---

## Adding Screenshots
```bash
# Copy screenshots to portfolio
cp ~/Pictures/Screenshots/[filename].png ~/portfolio/screenshots/portfolio-picks/

# Add to git
git add screenshots/portfolio-picks/
git commit -m "Add new screenshots"
git push origin main
```

---

## Contact Information Updates

Edit in `index.html`, footer section:
```html
<div class="contact-links">
    <a href="https://github.com/SeriouslyCyberLLC">GitHub</a>
    <a href="mailto:larry.harvey.cyber@protonmail.com">Email</a>
    <a href="https://www.linkedin.com/in/larry-harvey-cyber">LinkedIn</a>
</div>
```

---

## Important Notes

- **Never use `sudo` with git commands** - causes permission issues
- **Always pull before pushing** if you edit on GitHub web interface
- **Website updates take 1-2 minutes** after pushing
- **Keep GitHub PAT secure** - treat it like a password
- **Token expires** - renew before expiration to avoid push failures
- **Test locally** when making major HTML changes

---

## Backup Strategy

Portfolio is backed up in multiple places:
1. **Local**: `/home/cyberguy/portfolio/`
2. **GitHub**: https://github.com/SeriouslyCyberLLC/cybersecurity-portfolio
3. **Live Site**: https://seriouslycyberllc.github.io/cybersecurity-portfolio/

To create local backup:
```bash
cd ~
tar -czf portfolio-backup-$(date +%Y%m%d).tar.gz portfolio/
```

---

## Future Enhancements

### Planned
- [ ] Point custom domain (seriouslycyber.com) to GitHub Pages
- [ ] Generate PDF version of portfolio
- [ ] Add blog section for technical write-ups
- [ ] Create project showcase videos/demos

### Ideas
- Add dark/light mode toggle
- Include downloadable resume
- Add project timeline/roadmap
- Create interactive dashboard demos

---

## Resources

- **GitHub Docs**: https://docs.github.com
- **GitHub Pages**: https://pages.github.com
- **Markdown Guide**: https://www.markdownguide.org
- **HTML/CSS Reference**: https://developer.mozilla.org

---

**Last Updated**: January 13, 2026  
**Created By**: Larry Harvey with Claude assistance  
**Version**: 1.0
