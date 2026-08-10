# Portfolio Visual Repositioning

**Date:** 2026-08-10
**File affected:** `index.html` (single file; all CSS is inline in its `<style>` block)
**Status:** Approved, pending implementation plan

## Problem

The portfolio's copy was repositioned around AI security and governance in commit
`3b38613`, but the visual language was never updated to match. The page still renders
in a "hacker/gamer" idiom while the hero text speaks in boardroom language about
"executive-ready recommendations, control requirements, residual-risk decisions."

When copy and design disagree, readers trust the design. For an audience of hiring
managers at regulated SaaS companies, the current styling actively undercuts the
credibility the copy is trying to establish.

### What specifically produces the effect

Diagnosed by reading the `<style>` block, not by impression:

| Element | Current implementation | Signal |
|---|---|---|
| Background | Six stacked `linear-gradient`s forming a carbon-fiber weave | Gaming rig / tuner car |
| `body::after` | Two fixed red `radial-gradient`s washing the page | RGB peripheral lighting |
| Headings | `background-clip: text` gradient fill + `text-shadow: 0 0 30px rgba(255,0,0,0.4)` | Neon / arcade |
| Cards, badges | `translateY(-4px/-5px)` hover lift with intensified red bloom | Game UI tiles |
| `.stats` | Monospace on red-tinted panel with border | HUD readout / scoreboard |
| Certifications | 12 pieces of issuer art in hover-lift tiles | Achievement case |
| Accent color | Saturated `#ff2a2a` throughout | Alert / danger / gamer |

The red is not the brand color. The logo accent is amber `#df8544`; the red is a theme
layered on top of it.

## Audience

Primary: hiring managers for AI security and governance roles, weighted over
consultancy buyers. The page should read as a serious professional — not a company
marketing brochure, and not a peer-facing technical flex.

## Design

### 1. Palette

```
--bg      #0f1115   flat graphite, replaces the carbon weave
--panel   #161920   header, cards, footer
--ink     #ececee   body text
--muted   #9aa0a8   secondary text
--faint   #7f858d   captions
--accent  #df8544   amber, taken from the logo
--line    rgba(255,255,255,0.08)   hairline borders
```

Red is removed from the page entirely, not desaturated. It is the single strongest
carrier of the signal being corrected.

**Contrast, measured (WCAG 2.1, target 4.5:1 normal / 3.0:1 large):**

| Pair | Ratio |
|---|---|
| ink on bg | 16.02:1 |
| ink on panel | 14.91:1 |
| heading `#f2f2f2` on panel | 15.71:1 |
| muted on bg | 7.17:1 |
| muted on panel | 6.67:1 |
| faint on bg | 5.08:1 |
| faint on panel | 4.73:1 |
| accent on bg | 6.82:1 |
| accent on panel | 6.34:1 |
| `#14171d` on amber button | 6.48:1 |

All ten pairs pass at the normal-text threshold. No value needs adjustment.

### 2. Surface and depth

Deleted outright:
- the six-gradient carbon weave on `body`
- the `body::after` red radial wash (the whole rule)
- every `box-shadow` bloom

Depth is carried by 1px `--line` hairlines instead of glow. Border radius drops from
14px to 6px: large radii read as game cards, tight ones as a document.

### 3. Typography

- `.gradient-text` is **deleted**. Headings become solid `#f2f2f2`, no gradient fill,
  no `text-shadow`.
  - Consequence: the descender-clipping bug fixed in `94b637e` was *caused* by
    `background-clip: text`. Removing the technique retires both the bug and its
    workaround (`line-height: 1.25` + `padding-bottom: 0.12em` exist only to serve it).
- `h1`: 3em → 2.6em, solid, `letter-spacing: -0.01em`.
- Section titles: centered 2.4em gradient → **left-aligned 1.75em solid**, with a 34px
  amber hairline rule beneath (reusing the width already established by
  `.cert-group__label::after`, so the two rules match). Centered oversized headings are
  a marketing-page convention; left-aligned reads as a document.
- Project card `h3`: 1.6em glowing red → 1.15em solid ink.

### 4. Components

**Header** — flat `--panel`, hairline border, no red gradient, no glow. The logo's
`drop-shadow(0 0 24px rgba(223,133,68,0.5))` is removed; the SVG keeps its own colors.

**Buttons** — primary: solid amber background, `#14171d` text, radius 4px, no gradient,
no shadow, no lift. Secondary: transparent with a hairline border. Hover changes
color and border only.

**Project cards** — flat `--panel`, hairline, no bloom. Existing flex layout that pins
CTAs to a shared baseline is retained unchanged.

**Stats** — plain `<ul>`: monospace, red tint, and border all removed; `--muted` text.
The hanging indent (`padding-left: 15px; text-indent: -15px`) is **retained** — it
solves a real wrap-ambiguity problem where continuation lines were indistinguishable
from new items, not a stylistic one.

**Certifications** — restructured from 12 tiles into two tiers:
- 4 flagship badges keep their issuer art, under the existing group labels
  "Core security" (CISSP, CCSP) and "AI security" (AAISM, SecAI+). Both labels and the
  two-group split are preserved. Each badge remains a Credly verification link.
- The remaining 8 become a single typographic line, in the order they appear today:
  SecurityX (CASP+), CySA+, Security+, Network+, A+, CSAP (Stackable), SentinelOne IR,
  Linux Essentials.
- The neutral `#f4f4f5` well behind each badge is **retained**. It is functional, not
  decorative: ISC2 art is transparent with black wordmarks and renders invisible on a
  dark panel. Issuer art is never recolored, tinted, or ringed.
- Tile chrome around the badges (border, hover lift, glow) is removed.

**Footer** — flat, hairline top rule, no glow.

### 5. Motion and state

- Every `translateY` hover lift removed.
- Hover becomes a border-color and text-color shift only.
- Retained: amber `:focus-visible` outlines, 44px minimum touch targets on
  `.contact-links a`, and the `prefers-reduced-motion` block.

## Non-goals

No copy changes. No reordering. No structural changes to the markup beyond the
certifications restructure. Specifically retained from prior work:

- semantic `<ul>`/`<li>` for projects, certs, and stats
- skip link and `.visually-hidden` link labels
- 44px touch targets
- the 4.5:1 contrast floor
- every factual correction from the credibility pass

## Consequences and follow-ups

1. **`assets/og-card.png` becomes inconsistent.** It was designed against the red-on-
   carbon look, so the LinkedIn/social preview will no longer resemble the page.
   Regenerating it is part of this job, not a separate concern.
2. **Page weight drops.** The 8 wall badges total 42,907 bytes of PNG no longer
   requested on load; 4 flagship badges (27,643 bytes) remain. The files stay on disk
   and are referenced nowhere else, so nothing breaks.
3. **`projects/README.md` lists 6 certifications while the page shows 12.** Pre-existing
   inconsistency, out of scope here, noted so it is not mistaken for new drift.

## Verification

Not complete until all of the following are confirmed by running them, not by
inspection:

- axe-core reports 0 violations
- every text/background pair measures ≥4.5:1 (≥3:1 for large text)
- no emoji in `index.html`
- no `#ff2a2a`, `#cc0000`, or red `rgba(255,0,...)` values remain in the stylesheet
- rendered at 375px and 1440px viewport widths
- all 8 project cards and 4 flagship badge links still resolve
