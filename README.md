# Cybersecurity Portfolio — Larry W. Harvey

**Live site: https://seriouslycyberllc.github.io/cyber-portfolio/**

AI security and governance work, plus the home security operations centre it is
measured against. Nine systems, eight in production and one retired on
measurement — that writeup is the honest one.

## What is here

| Path | Contents |
|------|----------|
| `index.html` | The portfolio itself. Single file, inline CSS, no build step. |
| `projects/` | Per-project writeups in Markdown. |
| `docs/` | Longer case studies, plus the design spec and plan behind the current visual language. |
| `scripts/` | `update-telemetry.mjs` regenerates the measured figures on the page; `verify-page.mjs` is a 20-check harness that must pass before anything is published. |
| `assets/` | Certification badges and sanitised screenshots. |

## The numbers on the page are measured, not asserted

The telemetry strip is generated directly from the live Elasticsearch cluster by
`scripts/update-telemetry.mjs` and stamped with the time it ran. It is refreshed
daily. Nothing on that strip is hand-written, which is the entire point of it —
a figure that cannot be regenerated is a claim, not evidence.

## Contributing images

Don't, without reading the image policy in `PORTFOLIO_MASTER_DOCUMENTATION.md`
first. A text sanitisation pass cannot reach a screenshot: host names, internal
addresses and device names in an image survive every find-replace, invisibly.
Curated, sanitised captures live in `assets/screenshots/` and are added
deliberately by path.

## Contact

- Portfolio: https://seriouslycyberllc.github.io/cyber-portfolio/
- Website: https://seriouslycyber.com
- GitHub: https://github.com/SeriouslyCyberLLC
