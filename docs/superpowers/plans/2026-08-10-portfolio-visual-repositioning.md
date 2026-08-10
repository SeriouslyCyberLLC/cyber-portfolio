# Portfolio Visual Repositioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `index.html` from a red-on-carbon "hacker/gamer" visual language to a flat graphite surface with a single amber accent, so the design matches the AI-security-and-governance copy it houses.

**Architecture:** Single static HTML file with an inline `<style>` block. No build step, no framework, no dependencies. Verification is a dependency-free Node script that parses `index.html` and asserts the target state; it is written first, fails against the current page, and drives the work to green.

**Tech Stack:** HTML5, inline CSS, Node 24 (verification only, no packages), Google Chrome at `/usr/bin/google-chrome` (headless, for the accessibility run and OG card render).

**Spec:** `docs/superpowers/specs/2026-08-10-portfolio-visual-repositioning-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **Palette, exact values:** `--bg #0f1115`, `--panel #161920`, `--ink #ececee`, `--muted #9aa0a8`, `--faint #7f858d`, `--accent #df8544`, `--line rgba(255,255,255,0.08)`.
- **Red is removed entirely**, not desaturated. No `#ff2a2a`, `#cc0000`, `#ff5b5b`, `#ff4d4d`, `#ff6b6b`, `#990000`, `#240707`, `rgba(255,0,0,…)`, `rgba(255,42,42,…)`, or `rgba(122,0,0,…)` may remain.
- **Contrast floor:** 4.5:1 for normal text, 3:1 for large text and UI. Measured, not eyeballed.
- **Border radius:** 6px for panels and cards, 4px for buttons.
- **No copy changes, no reordering.** The only markup change permitted is the certifications restructure in Task 5.
- **Retained without modification:** skip link, `.visually-hidden` link labels, 44px minimum touch targets on `.contact-links a`, semantic `<ul>`/`<li>` for projects/certs/stats, the `prefers-reduced-motion` block, the `#f4f4f5` badge wells, and the `.stats li` hanging indent (`padding-left: 15px; text-indent: -15px`).
- **Issuer badge art is never recolored, tinted, or ringed.**
- The `.skip-link` uses `translateY(-120%)` / `translateY(0)` for its reveal. That is functional and must survive; only pixel-valued hover lifts (`translateY(-4px)`, `translateY(-5px)`, `translateY(-2px)`) are removed.

---

### Task 1: Verification harness

Writes the executable definition of "done". It must FAIL against the current page — that failure is the proof it detects the problem.

**Files:**
- Create: `scripts/verify-page.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `node scripts/verify-page.mjs` exits 0 when every check passes, 1 otherwise, printing one `PASS`/`FAIL` line per check. Every later task re-runs this exact command.

- [ ] **Step 1: Write the verification script**

```javascript
#!/usr/bin/env node
// Dependency-free verification for index.html. Run: node scripts/verify-page.mjs
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];

// ---- contrast helpers (WCAG 2.1 relative luminance) ----
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const L = h => { const [r, g, b] = hex(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = L(a), y = L(b); const [hi, lo] = x > y ? [x, y] : [y, x]; return (hi + 0.05) / (lo + 0.05); };

// ---- read custom properties out of :root ----
const varOf = name => {
  const m = style.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
};

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

check('palette variables declared with the specified values', () => {
  const want = { bg: '#0f1115', panel: '#161920', ink: '#ececee', muted: '#9aa0a8', faint: '#7f858d', accent: '#df8544' };
  const bad = Object.entries(want).filter(([k, v]) => (varOf(k) || '').toLowerCase() !== v);
  return bad.length ? `wrong or missing: ${bad.map(([k, v]) => `--${k} (want ${v}, got ${varOf(k)})`).join(', ')}` : true;
});

check('no red values anywhere in the stylesheet', () => {
  const banned = /#ff2a2a|#cc0000|#ff5b5b|#ff4d4d|#ff6b6b|#990000|#240707|rgba\(\s*255\s*,\s*0\s*,\s*0|rgba\(\s*255\s*,\s*42\s*,\s*42|rgba\(\s*122\s*,\s*0\s*,\s*0/gi;
  const hits = style.match(banned);
  return hits ? `${hits.length} occurrence(s): ${[...new Set(hits)].join(', ')}` : true;
});

check('no glow: zero text-shadow and zero box-shadow declarations', () => {
  const t = style.match(/text-shadow\s*:/g) || [];
  const b = style.match(/box-shadow\s*:/g) || [];
  return t.length || b.length ? `${t.length} text-shadow, ${b.length} box-shadow` : true;
});

check('no background-clip:text and no .gradient-text class', () => {
  const clip = /background-clip\s*:\s*text/.test(style);
  const cls = /\.gradient-text/.test(style) || /class="[^"]*gradient-text/.test(html);
  return clip || cls ? `background-clip:text=${clip}, gradient-text class=${cls}` : true;
});

check('no carbon weave and no red ambient wash', () => {
  const weave = /background-image:[^;]*linear-gradient\(207deg/.test(style);
  const wash = /body::after/.test(style);
  return weave || wash ? `weave=${weave}, body::after=${wash}` : true;
});

check('no pixel hover lifts (skip-link percentage transform is allowed)', () => {
  const hits = style.match(/translateY\(-\d+px\)/g);
  return hits ? `${hits.length}: ${[...new Set(hits)].join(', ')}` : true;
});

check('logo drop-shadow removed', () =>
  /\.brand-logo[^}]*drop-shadow/.test(style) ? 'drop-shadow still on .brand-logo' : true);

check('stats are not monospace and carry no panel', () => {
  const m = style.match(/\.stats\s*\{([^}]*)\}/);
  if (!m) return '.stats rule not found';
  const body = m[1];
  const bad = [];
  if (/font-family/.test(body)) bad.push('font-family present');
  if (/background/.test(body)) bad.push('background present');
  if (/border\s*:/.test(body)) bad.push('border present');
  return bad.length ? bad.join(', ') : true;
});

check('stats hanging indent retained', () =>
  /\.stats li\s*\{[^}]*padding-left:\s*15px[^}]*text-indent:\s*-15px/.test(style)
    ? true : 'hanging indent missing from .stats li');

check('badge wells retained (#f4f4f5)', () =>
  (style.match(/#f4f4f5/g) || []).length >= 1 ? true : 'badge well background missing');

check('accessibility affordances retained', () => {
  const need = [
    ['skip link', /class="skip-link"/.test(html)],
    ['visually-hidden', /visually-hidden/.test(html)],
    ['44px targets', /min-height:\s*44px/.test(style)],
    ['reduced motion', /prefers-reduced-motion/.test(style)],
    ['focus-visible', /:focus-visible/.test(style)],
  ].filter(([, ok]) => !ok).map(([n]) => n);
  return need.length ? `missing: ${need.join(', ')}` : true;
});

check('contrast: every text pair meets 4.5:1', () => {
  const bg = varOf('bg'), panel = varOf('panel');
  const pairs = [
    ['ink on bg', varOf('ink'), bg], ['ink on panel', varOf('ink'), panel],
    ['muted on bg', varOf('muted'), bg], ['muted on panel', varOf('muted'), panel],
    ['faint on bg', varOf('faint'), bg], ['faint on panel', varOf('faint'), panel],
    ['accent on bg', varOf('accent'), bg], ['accent on panel', varOf('accent'), panel],
  ];
  // A pair with an unresolved variable must FAIL, not be silently skipped —
  // otherwise this check passes vacuously on a page it never measured.
  const missing = pairs.filter(([, f, b]) => !f || !b).map(([n]) => n);
  if (missing.length) return `unresolved custom properties, cannot measure: ${missing.join(', ')}`;
  const bad = pairs.filter(([, f, b]) => ratio(f, b) < 4.5)
    .map(([n, f, b]) => `${n} ${ratio(f, b).toFixed(2)}:1`);
  return bad.length ? bad.join(', ') : true;
});

check('every var(--x) reference resolves to a declared property', () => {
  // Renaming --amber to --accent orphans any rule still saying var(--amber).
  // An orphaned reference renders as nothing — a silent visual failure that
  // the hex-pattern checks above cannot see.
  const declared = new Set([...style.matchAll(/--([a-z0-9-]+)\s*:/g)].map(m => m[1]));
  const used = [...style.matchAll(/var\(\s*--([a-z0-9-]+)\s*\)/g)].map(m => m[1]);
  const orphans = [...new Set(used.filter(u => !declared.has(u)))];
  return orphans.length ? `undeclared: ${orphans.map(o => `--${o}`).join(', ')}` : true;
});

check('focus outline uses the accent and resolves', () => {
  const m = style.match(/:focus-visible[^{]*\{([^}]*)\}/);
  if (!m) return ':focus-visible rule not found';
  return /outline:[^;]*var\(--accent\)/.test(m[1])
    ? true : `focus outline does not use var(--accent): ${m[1].trim()}`;
});

check('no emoji', () => {
  const e = html.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu);
  return e ? [...new Set(e)].join(' ') : true;
});

check('8 project cards present, in order', () => {
  const got = [...html.matchAll(/<li class="project">\s*\n\s*<h3>([^<]+)<\/h3>/g)].map(m => m[1].trim());
  const want = ['AI-Enhanced Security Analysis', 'Automated Report Generation', 'Threat Intelligence Integration',
    'Enterprise SOC Infrastructure', 'DNS Behavioral Monitoring', 'Network Security Architecture',
    'Business Infrastructure Platform', 'Local Speech-to-Text'];
  return JSON.stringify(got) === JSON.stringify(want) ? true : `got ${got.length}: ${got.join(' | ')}`;
});

check('4 flagship badges retained, cert wall replaced by text', () => {
  const marks = [...html.matchAll(/<span class="mark">([^<]+)<\/span>/g)].map(m => m[1].trim());
  const want = ['CISSP', 'CCSP', 'AAISM', 'SecAI+'];
  if (JSON.stringify(marks) !== JSON.stringify(want)) return `flagship marks: ${marks.join(', ')}`;
  if (/class="cert-wall"/.test(html)) return 'cert-wall grid still present';
  const also = ['SecurityX (CASP+)', 'CySA+', 'Security+', 'Network+', 'A+', 'CSAP (Stackable)', 'SentinelOne IR', 'Linux Essentials'];
  const missing = also.filter(c => !html.includes(c));
  return missing.length ? `missing from text line: ${missing.join(', ')}` : true;
});

check('group labels preserved', () =>
  html.includes('Core security') && html.includes('AI security') ? true : 'group labels changed');

// ---- run ----
let failed = 0;
for (const { name, fn } of checks) {
  let r; try { r = fn(); } catch (e) { r = `threw: ${e.message}`; }
  if (r === true) console.log(`PASS  ${name}`);
  else { failed++; console.log(`FAIL  ${name}\n        ${r}`); }
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run it against the unmodified page to confirm it detects the problem**

Run: `node scripts/verify-page.mjs; echo "exit=$?"`
Expected: `exit=1` and `7/18 passed`, with these eleven FAIL lines — palette variables, no red values, no glow, background-clip:text, carbon weave, pixel hover lifts, logo drop-shadow, stats monospace, contrast (reported as `unresolved custom properties`, because `--bg` and `--accent` do not exist yet), focus outline (still `var(--amber)`), and cert wall.
Expected to already PASS, and to keep passing through every later task: hanging indent, badge wells, accessibility affordances, var() references resolve, no emoji, 8 project cards, group labels.

Note the two guards that exist specifically to catch silent failures: `every
var(--x) reference resolves` passes now and must keep passing — renaming
`--amber` to `--accent` in Task 2 will break it unless every reference is
swept in the same task. And `focus outline uses the accent` fails now and
must pass by Task 2, because a focus outline referencing an undeclared
variable renders invisible while the string `:focus-visible` is still present
for the coarser accessibility check to find.

If any check that should fail passes, the check is wrong — fix the script, not the page.

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-page.mjs
git commit -m "Add verification harness for the visual repositioning

Dependency-free Node script asserting the target visual state: palette
values, absence of red, absence of glow, contrast floors, retained
accessibility affordances, and page structure.

Fails against the current page by design; the failures are the work list."
```

---

### Task 2: Palette and surface

**Files:**
- Modify: `index.html` — the `:root` block (~lines 92-102), `body` (~106-121), `body::after` (~124-132)

**Interfaces:**
- Consumes: `node scripts/verify-page.mjs` from Task 1.
- Produces: the `--bg/--panel/--ink/--muted/--faint/--accent/--line` custom properties every later task references.

- [ ] **Step 1: Replace the `:root` block**

Replace the entire existing `:root { … }` with:

```css
        :root {
            --bg: #0f1115;
            --panel: #161920;
            --ink: #ececee;
            --muted: #9aa0a8;
            --faint: #7f858d;
            --accent: #df8544;          /* from the logo; the only accent on the page */
            --line: rgba(255,255,255,0.08);
        }
```

- [ ] **Step 2: Replace `body` and delete `body::after`**

Replace the entire `body { … }` rule with:

```css
        body {
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: var(--ink);
            background: var(--bg);
            min-height: 100vh;
        }
```

Delete the entire `body::after { … }` rule and the `/* Subtle red ambient glow over the weave */` comment above it.

- [ ] **Step 3: Sweep every orphaned variable reference**

Step 1 drops `--amber`, `--red`, `--red-deep`, and `--panel-2`. Any rule still
naming one renders that property as nothing — a silent visual failure. Find
them all:

```bash
grep -n 'var(--amber)\|var(--red)\|var(--red-deep)\|var(--panel-2)' index.html
```

Expected: 6 matches. Apply these replacements:

| Line | Current | Becomes |
|---|---|---|
| `a:focus-visible, button:focus-visible` | `var(--amber)` | `var(--accent)` |
| `.cert-group--ai .cert-group__label::after` | `var(--amber)` | `var(--accent)` |
| `.project a:not(.btn)` | `var(--amber)` | `var(--accent)` |
| `.contact-links a:hover` | `var(--amber)` | `var(--accent)` |
| `.flagship-badge` background | `linear-gradient(135deg, var(--panel) 0%, var(--panel-2) 100%)` | `var(--panel)` |
| `.cert-item` background | `linear-gradient(135deg, var(--panel) 0%, var(--panel-2) 100%)` | `var(--panel)` |

The `.btn` rule's `var(--red-deep)` sits inside a `linear-gradient` that Task 4
replaces wholesale; change it to `var(--accent)` here anyway so no intermediate
commit carries a dangling reference.

The `:focus-visible` line is the one that matters most, because no later task
revisits it and an unresolved outline color renders invisible:

```css
        a:focus-visible, button:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
```

Confirm none remain:

```bash
grep -c 'var(--amber)\|var(--red)\|var(--red-deep)\|var(--panel-2)' index.html
```
Expected: `0`.

- [ ] **Step 4: Run verification**

Run: `node scripts/verify-page.mjs`
Expected: `palette variables`, `no carbon weave and no red ambient wash`, `contrast`, `focus outline uses the accent`, and `every var(--x) reference resolves` all PASS. `no red values`, `no glow`, `background-clip:text`, `pixel hover lifts`, `logo drop-shadow`, `stats`, `cert wall` still FAIL.

If `every var(--x) reference resolves` FAILS here, the sweep in Step 3 was
incomplete — the failure message names the undeclared properties.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Replace red-on-carbon palette with flat graphite and amber

Deletes the six-gradient carbon weave and the fixed red radial wash.
Accent moves to the logo's amber. All eight text/background pairs
measured at or above 4.5:1."
```

---

### Task 3: Typography

**Files:**
- Modify: `index.html` — `.gradient-text` (~160-166), `h1` (~187-191), `.subtitle` (~192), `.section-title` (~214-220), and the two `class="gradient-text"` usages in the body

**Interfaces:**
- Consumes: palette variables from Task 2.
- Produces: `.section-title` left-aligned with a 34px amber rule; later tasks assume headings carry no shadow or gradient.

- [ ] **Step 1: Delete `.gradient-text` and its comment**

Delete the entire `/* Shared gradient-text treatment … */` comment block and the `.gradient-text { … }` rule. Its `line-height: 1.25` and `padding-bottom: 0.12em` existed only to stop `background-clip: text` cropping descenders; with the technique gone, both are unnecessary.

- [ ] **Step 2: Remove the class from the two elements using it**

In the body markup, change:

```html
<h1 class="gradient-text">Larry W. Harvey</h1>
```

to:

```html
<h1>Larry W. Harvey</h1>
```

Then find every `<h2 class="gradient-text">` inside `.section-title` and remove the `class="gradient-text"` attribute, leaving `<h2>`.

- [ ] **Step 3: Replace the heading rules**

Replace the `h1 { … }` rule with:

```css
        h1 {
            font-size: 2.6em;
            line-height: 1.2;
            letter-spacing: -0.01em;
            color: #f2f2f2;
            margin-bottom: 8px;
        }
```

Replace the `.section-title { … }` and `.section-title h2 { … }` rules with:

```css
        .section-title { text-align: left; margin: 56px 0 24px; }
        .section-title h2 {
            font-size: 1.75em;
            line-height: 1.25;
            color: #f2f2f2;
            letter-spacing: -0.01em;
        }
        /* 34px matches .cert-group__label::after so the two rules read as one system. */
        .section-title h2::after {
            content: ''; display: block; height: 2px; width: 34px;
            margin-top: 10px; background: var(--accent); border-radius: 2px;
        }
        .section-title p { color: var(--faint); margin-top: 10px; }
```

- [ ] **Step 4: Bring `.subtitle` into the palette**

It currently hardcodes `#cfcfcf`, which sits outside the token system and
cannot be checked. Replace the rule with:

```css
        .subtitle { font-size: 1.25em; color: var(--muted); margin-bottom: 14px; }
```

`--muted` measures 6.67:1 on `--panel`, so this is a contrast improvement as
well as a consistency one. The size drops from 1.35em to 1.25em to sit under
the reduced 2.6em `h1` rather than competing with it.

- [ ] **Step 5: Run verification**

Run: `node scripts/verify-page.mjs`
Expected: `no background-clip:text and no .gradient-text class` now PASSES, and `every var(--x) reference resolves` still PASSES. Heading-related glow may still FAIL under `no glow` because `.project h3` and `footer h2` still carry `text-shadow` — those are Task 4.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Replace gradient neon headings with solid left-aligned type

Deletes .gradient-text entirely. This also retires the descender-clipping
workaround from 94b637e, which existed only to compensate for
background-clip:text cropping the glyph box.

Section titles move from centered 2.4em to left-aligned 1.75em with a
34px amber rule, matching the existing cert group label treatment."
```

---

### Task 4: Components and motion

**Files:**
- Modify: `index.html` — `header` (~169-180), `.brand-logo` (~185), `.btn`/`.btn-secondary` (~201-211), `.project*` (~291-316), `.stats` (~311-316), `footer` (~319-330), `.flagship-badge` (~244-270), `.cert-item` (~277-287), `.skip-link` (~137-146)

**Interfaces:**
- Consumes: palette variables from Task 2.
- Produces: final component styling; Task 5 changes only cert markup, not these rules.

- [ ] **Step 1: Replace header, logo, and buttons**

```css
        header {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 30px;
            align-items: center;
            background: var(--panel);
            padding: 40px;
            border-radius: 6px;
            margin: 40px 0;
            border: 1px solid var(--line);
        }

        .brand-logo { width: clamp(200px, 24vw, 330px); height: auto; }

        .btn {
            display: inline-block;
            background: var(--accent);
            color: #14171d;
            padding: 12px 24px; border-radius: 4px;
            text-decoration: none; margin: 8px 10px 0 0; font-weight: 600;
            border: 1px solid var(--accent);
            transition: background-color .2s ease, border-color .2s ease, color .2s ease;
        }
        .btn:hover { background: #e9975c; border-color: #e9975c; }
        .btn-secondary {
            background: transparent; color: var(--ink);
            border: 1px solid rgba(255,255,255,0.18);
        }
        .btn-secondary:hover { border-color: var(--accent); color: var(--accent); background: transparent; }
```

- [ ] **Step 2: Replace the skip-link border color**

In `.skip-link`, change `border: 1px solid rgba(255,42,42,0.5);` to `border: 1px solid var(--accent);`. Leave its `transform: translateY(-120%)` and `.skip-link:focus { transform: translateY(0); }` untouched — that is the reveal mechanism, not decoration.

- [ ] **Step 3: Replace project cards and stats**

```css
        .projects { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 24px; margin: 30px 0; list-style: none; }
        .project {
            display: flex; flex-direction: column;
            background: var(--panel);
            padding: 26px; border-radius: 6px;
            border: 1px solid var(--line);
            transition: border-color .2s ease;
        }
        .project:hover { border-color: rgba(223,133,68,0.45); }
        .project h3 { color: var(--ink); font-size: 1.15em; font-weight: 600; margin-bottom: 10px; }
        .project p { margin: 10px 0; color: var(--muted); }
        .project a:not(.btn) { color: var(--accent); text-decoration: none; font-weight: 600; }
        .project a:not(.btn):hover { text-decoration: underline; }
        /* auto top margin pushes every card's CTA to the same baseline regardless of
           how much copy sits above it; flex-start keeps it hugging its label rather
           than stretching to the card width the way a blockified flex item would. */
        .project .btn { margin-top: auto; align-self: flex-start; }
        .project-actions { margin-top: auto; display: flex; flex-wrap: wrap; align-items: flex-start; }
        .project-actions .btn { margin-top: 8px; }

        .stats { margin: 14px 0; color: var(--muted); list-style: none; }
        /* Hanging indent + inter-item gap. These lines wrap at card width, and with
           no leading glyph a wrapped continuation is otherwise indistinguishable
           from the next item, so the block reads as one run-on paragraph. */
        .stats li { padding-left: 15px; text-indent: -15px; }
        .stats li + li { margin-top: 7px; }
```

- [ ] **Step 4: Replace cert tile chrome**

```css
        .flagship-badge {
            display: flex; flex-direction: column; align-items: center;
            width: 172px; padding: 4px; text-decoration: none;
            background: transparent; border: 0; border-radius: 0;
            transition: opacity .2s ease;
        }
        /* Badge well. ISC2 badge art is TRANSPARENT with black wordmarks, so on a dark
           panel "CISSP" renders black-on-black and is unreadable. A neutral light well
           makes every issuer's art legible without recolouring any of it. */
        .flagship-badge img {
            width: 118px; height: 118px; object-fit: contain;
            background: #f4f4f5; border-radius: 8px; padding: 9px;
        }
        .flagship-badge .mark { margin-top: 12px; font-size: .95em; font-weight: 600; color: var(--ink); }
        .flagship-badge .full { font-size: .75em; color: var(--muted); line-height: 1.3; margin-top: 4px; text-align: center; }
        .cert-group--ai .flagship-badge { width: 148px; }
        .cert-group--ai .flagship-badge img { width: 100px; height: 100px; }
        .flagship-badge:hover, .flagship-badge:focus-visible { opacity: .82; }
```

Change `.cert-group__label::after` background from `var(--red)` to `var(--accent)`, and delete the `.cert-group--ai .cert-group__label::after` override (both groups now use the same accent, since there is only one).

- [ ] **Step 5: Replace footer**

```css
        footer {
            background: var(--panel); padding: 34px; border-radius: 6px;
            margin: 56px 0 40px; text-align: center; border: 1px solid var(--line);
        }
        footer h2 { color: var(--ink); font-size: 1.5em; font-weight: 600; }
        .contact-links { display: flex; flex-wrap: wrap; justify-content: center; margin: 20px 0; }
        /* 44px min target, per WCAG 2.2 target-size guidance. These were 17px tall. */
        .contact-links a {
            display: inline-flex; align-items: center; justify-content: center;
            min-height: 44px; padding: 0 14px; margin: 0 2px;
            color: var(--accent); text-decoration: none; font-weight: 600;
            transition: color .2s ease;
        }
        .contact-links a:hover { text-decoration: underline; }
        .footer-meta { margin-top: 20px; color: var(--muted); }
        .footer-legal { margin-top: 26px; font-size: .9em; color: var(--faint); }
```

- [ ] **Step 6: Update the reduced-motion block**

Replace the transform-suppression list, since the hover lifts it referenced no longer exist:

```css
        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
                animation-duration: .01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: .01ms !important;
                scroll-behavior: auto !important;
            }
        }
```

- [ ] **Step 7: Run verification**

Run: `node scripts/verify-page.mjs`
Expected: `no red values`, `no glow`, `no pixel hover lifts`, `logo drop-shadow removed`, `stats are not monospace`, `stats hanging indent retained`, `badge wells retained` all PASS. Only the cert-wall check should still FAIL.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "Flatten components: hairline borders replace glow and hover lift

Header, cards, buttons, badges and footer move to flat panels with 1px
hairline borders and 6px radii. Every box-shadow bloom, text-shadow glow
and pixel translateY hover is removed; hover now shifts border and text
color only.

Stat blocks lose the monospace face and red-tinted panel and become plain
fact lists. The hanging indent is kept because it resolves genuine wrap
ambiguity, not because it is decorative. The #f4f4f5 badge wells are kept
because ISC2 art is transparent with black wordmarks."
```

---

### Task 5: Certifications restructure

The only markup change in the plan.

**Files:**
- Modify: `index.html` — the `.cert-wall` list in the body, and the `.cert-wall`/`.cert-item` rules in the `<style>` block

**Interfaces:**
- Consumes: palette variables and `.flagship-badge` styling from Tasks 2 and 4.
- Produces: `.cert-also` paragraph replacing the `.cert-wall` grid.

- [ ] **Step 1: Delete the `.cert-wall` and `.cert-item` CSS rules**

Delete the `/* 108px floor = … */` comment, `.cert-wall { … }`, `.cert-item { … }`, `.cert-item:hover { … }`, the badge-well comment above `.cert-item img`, `.cert-item img { … }`, and `.cert-item span { … }`. Add in their place:

```css
        .cert-also {
            max-width: 72ch; margin: 22px auto 0; text-align: center;
            color: var(--muted); font-size: .92em;
        }
        .cert-also strong { color: var(--ink); font-weight: 600; }
```

- [ ] **Step 2: Replace the `<ul class="cert-wall">` block in the body**

Delete the entire `<ul class="cert-wall"> … </ul>` element, including all eight `<li class="cert-item">` children and their `<img>` tags. Replace with:

```html
                <p class="cert-also">
                    <strong>Also holds</strong> CompTIA SecurityX (CASP+), CySA+, Security+, Network+, A+,
                    CSAP (Stackable), SentinelOne IR, and Linux Essentials.
                </p>
```

Leave `.cert-verify-note` exactly as it is; it still applies to the flagship badges.

- [ ] **Step 3: Run verification**

Run: `node scripts/verify-page.mjs; echo "exit=$?"`
Expected: `exit=0`. Every check PASSES, including `4 flagship badges retained, cert wall replaced by text` and `group labels preserved`.

If `missing from text line` appears, the check compares exact strings — match the eight names character for character as listed in Step 2.

- [ ] **Step 4: Confirm the eight removed images are referenced nowhere else**

Run:
```bash
grep -rn 'comptia-a\.png\|comptia-csap\.png\|comptia-cysa\.png\|comptia-network\.png\|comptia-security\.png\|comptia-securityx\.png\|linux-essentials\.png\|sentinelone-ir\.png' --include='*.html' --include='*.md' . | grep -v node_modules
```
Expected: no output. The files stay on disk (they are not deleted) but are no longer requested on load, removing 42,907 bytes from the page.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Restructure certifications into flagship badges plus a text line

Twelve badge tiles read as a trophy case. CISSP, CCSP, AAISM and SecAI+
keep their issuer art as Credly verification links under the existing
Core security / AI security grouping; the other eight become one
typographic line.

Drops 42,907 bytes of PNG from the page load. The files remain on disk
and are referenced nowhere else."
```

---

### Task 6: Accessibility and responsive verification

**Files:**
- None modified unless a violation is found.

**Interfaces:**
- Consumes: the finished page from Task 5.
- Produces: confirmation, or a defect list to fix before proceeding to Task 7.

- [ ] **Step 1: Run axe via pa11y against the local file**

Run:
```bash
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome \
  npx --yes pa11y@8 --runner axe --standard WCAG2AA "file://$PWD/index.html"
```
Expected: `No issues found!`

First invocation downloads pa11y. If it cannot launch a browser, fall back to Step 1b.

- [ ] **Step 1b: Fallback — Chrome DevTools**

Open `index.html` in Chrome, DevTools → Lighthouse → Accessibility only → Analyze. Expected: score 100, zero listed issues. Record the score in the commit message rather than claiming a pa11y result that was not run.

- [ ] **Step 2: Capture both viewport widths**

Run:
```bash
google-chrome --headless=new --disable-gpu --hide-scrollbars \
  --screenshot=/tmp/portfolio-375.png --window-size=375,2400 "file://$PWD/index.html"
google-chrome --headless=new --disable-gpu --hide-scrollbars \
  --screenshot=/tmp/portfolio-1440.png --window-size=1440,2000 "file://$PWD/index.html"
```

- [ ] **Step 3: Inspect both screenshots**

Read `/tmp/portfolio-375.png` and `/tmp/portfolio-1440.png`. Confirm: no horizontal overflow at 375px, the header stacks and centers, project cards are single-column at 375px, the four flagship badges wrap without clipping, and no element still renders red.

- [ ] **Step 4: Commit only if something was fixed**

If Steps 1-3 surfaced defects, fix them, re-run `node scripts/verify-page.mjs`, and commit with a message naming the specific defect. If nothing was wrong, make no commit — there is nothing to record.

---

### Task 7: Regenerate the OG card

The current `assets/og-card.png` was designed against the red-on-carbon look and no longer resembles the page. There is no source file for it, so this task creates one, making future regeneration reproducible.

**Files:**
- Create: `assets/og-card.html`
- Modify: `assets/og-card.png` (regenerated)

**Interfaces:**
- Consumes: the palette from Task 2.
- Produces: a 1200x630 PNG matching the finished page.

- [ ] **Step 1: Create the card source**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>OG card source</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    background: #0f1115;
    color: #ececee;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    display: grid; grid-template-columns: auto 1fr; gap: 56px;
    align-items: center; padding: 0 84px;
  }
  img { width: 260px; height: auto; }
  h1 { font-size: 62px; line-height: 1.1; letter-spacing: -0.02em; color: #f2f2f2; }
  .sub { margin-top: 20px; font-size: 27px; line-height: 1.4; color: #9aa0a8; }
  .rule { height: 3px; width: 64px; background: #df8544; border-radius: 2px; margin: 28px 0; }
  .certs { font-size: 22px; letter-spacing: .16em; text-transform: uppercase; color: #df8544; }
</style>
</head>
<body>
  <img src="logo-orbital.svg" alt="">
  <div>
    <h1>Larry W. Harvey</h1>
    <div class="sub">AI Security &amp; Governance | Enterprise AI Risk<br>Incident &amp; Crisis Readiness</div>
    <div class="rule"></div>
    <div class="certs">CISSP &middot; CCSP &middot; AAISM &middot; SecAI+</div>
  </div>
</body>
</html>
```

- [ ] **Step 2: Render it at exactly 1200x630**

Run:
```bash
google-chrome --headless=new --disable-gpu --hide-scrollbars \
  --screenshot="$PWD/assets/og-card.png" --window-size=1200,630 \
  "file://$PWD/assets/og-card.html"
```

- [ ] **Step 3: Verify dimensions and size**

Run:
```bash
file assets/og-card.png && du -b assets/og-card.png
```
Expected: `PNG image data, 1200 x 630`. Size should be well under the previous 349,596 bytes; a flat-background card compresses far better than the gradient one.

- [ ] **Step 4: Confirm the page still points at it**

Run: `grep -c 'assets/og-card.png' index.html`
Expected: `3` — the `og:image`, `twitter:image`, and JSON-LD `image` references. The filename is unchanged, so no markup edit is needed.

- [ ] **Step 5: Commit**

```bash
git add assets/og-card.html assets/og-card.png
git commit -m "Regenerate the OG card to match the new palette

The previous card was built against the red-on-carbon design and no
longer resembled the page it previews. Adds assets/og-card.html as a
reproducible source, rendered to PNG with headless Chrome at 1200x630,
so the next palette change does not orphan the card again."
```

---

### Task 8: Publish

**Files:**
- None modified.

- [ ] **Step 1: Final full verification**

Run: `node scripts/verify-page.mjs; echo "exit=$?"`
Expected: `exit=0`, all checks PASS.

- [ ] **Step 2: Confirm a clean tree and review the full diff**

Run: `git status -sb && git diff main --stat`
Expected: clean tree; changes confined to `index.html`, `assets/og-card.html`, `assets/og-card.png`, `scripts/verify-page.mjs`, and the two `docs/superpowers/` files.

- [ ] **Step 3: Push**

Run: `git push origin main`

- [ ] **Step 4: Verify the deployed page**

Wait for Pages to rebuild, then run:
```bash
node -e "fetch('https://seriouslycyberllc.github.io/cybersecurity-portfolio/')
  .then(r=>r.text()).then(h=>{
    const red=/#ff2a2a|#cc0000|rgba\(\s*255\s*,\s*0\s*,\s*0/.test(h);
    const grad=/gradient-text/.test(h);
    const wall=/cert-wall/.test(h);
    console.log('red present:',red,'| gradient-text:',grad,'| cert-wall:',wall);
    console.log(red||grad||wall?'STALE — Pages has not rebuilt yet':'LIVE and current');
  })"
```
Expected: `LIVE and current`. If stale, wait and re-run; Pages typically rebuilds within a couple of minutes.

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Palette, exact values | 2 |
| Contrast measured ≥4.5:1 | 1 (check), 2 (values) |
| Surface: weave, wash, shadows deleted; 6px radius | 2, 4 |
| Typography: `.gradient-text` deleted, solid headings, left-aligned section titles + 34px rule | 3 |
| Components: header, buttons, cards, stats, footer | 4 |
| Certifications: 4 flagship + 8 as text, wells retained, labels preserved | 5 |
| Motion: lifts removed, focus/targets/reduced-motion retained | 4 (with 1 asserting retention) |
| Non-goals: no copy change, no reordering | 1 (card order + group label checks) |
| Follow-up: og-card regeneration | 7 |
| Verification: axe, contrast, no emoji, no red, 375/1440px, links resolve | 1, 6, 8 |

**Placeholder scan:** No TBDs. Every code step carries the actual CSS or HTML. Task 6 Step 1b exists because the pa11y invocation depends on a browser launch that has not been executed in this environment — it is a named fallback with a concrete alternative, not a deferred decision.

**Type consistency:** `node scripts/verify-page.mjs` is the identical command in Tasks 1, 2, 3, 4, 5, 6, and 8. Custom property names (`--bg`, `--panel`, `--ink`, `--muted`, `--faint`, `--accent`, `--line`) are declared in Task 2 and used unchanged thereafter. `.cert-also` is defined in Task 5 Step 1 and used in Step 2. The eight cert names in the Task 1 check match Task 5 Step 2 verbatim.

**Known gap:** `projects/README.md` lists 6 certifications while the page shows 12. Pre-existing, explicitly out of scope per the spec, and no task addresses it.
