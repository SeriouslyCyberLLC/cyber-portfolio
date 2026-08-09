# Business Infrastructure Platform

## Overview
Self-hosted business infrastructure for Seriously Cyber Consulting LLC, running on owned hardware and reaching the public internet through Cloudflare Tunnel rather than an exposed origin. Serves the company site and the lead generation workflow behind it.

## Business Problem
- A small consultancy needs a public web presence without a public attack surface
- Commercial hosting bills monthly for capacity that already exists on hardware in the rack
- Exposing an origin server by port-forwarding puts the same box on the internet that holds business data
- Lead intake was manual and inconsistent between enquiries

## Technical Architecture

### Ingress
- **Cloudflare Tunnel**: The origin makes an outbound connection to Cloudflare; no inbound ports are opened and the origin IP is never published
- **Multi-domain**: A single tunnel fronts several hostnames, each routed to a different local service
- **TLS**: Terminated at the edge, with the tunnel carrying traffic to the origin

### Origin
- **Platform**: Ubuntu 24.04
- **Web Server**: Nginx, reverse-proxying to local application services
- **Automation**: Python for lead handling and content generation
- **DNS**: Managed at Cloudflare, with records pointed at the tunnel rather than at a host

### Lead Generation
- Six templated intake paths covering the common enquiry types
- Submissions normalized into a consistent structure regardless of entry point

## Why Cloudflare Tunnel
The alternative designs each cost something this one does not:

| Approach | Trade-off |
|----------|-----------|
| Port-forward to the origin | Publishes the origin IP and opens an inbound path to the LAN |
| Commercial VPS | Monthly cost, and business data leaves owned hardware |
| Static site host | No dynamic lead handling, and still a separate bill |
| Cloudflare Tunnel | Outbound-only, origin IP stays private, no hosting line item |

The zero-trust property here is specific and worth stating precisely: there is no listening socket reachable from the internet. Reaching the application requires either the tunnel or LAN access, and the tunnel is authenticated to Cloudflare rather than open.

## Cost
Hosting runs at $0/month. The infrastructure is already deployed for the security lab, so the marginal cost of the business site is the electricity it was drawing anyway. Cloudflare's free tier covers the tunnel and DNS.

## Skills Demonstrated
- Zero-trust ingress design
- Reverse proxy configuration and virtual host routing
- DNS management and multi-domain routing
- Linux system administration
- Python automation
- Cost-conscious architecture for a small business

## Limitations
- Single origin, so an origin outage takes the site down; there is no second region
- Availability depends on Cloudflare as a third party
- Tunnel throughput is adequate for a brochure site and intake forms, not for media serving
- No CDN-level caching strategy is tuned yet; responses are served dynamic

---

**Status**: Production, live at [seriouslycyber.com](https://seriouslycyber.com)
**Stack**: Cloudflare Tunnel, Nginx, Python, Ubuntu 24.04
