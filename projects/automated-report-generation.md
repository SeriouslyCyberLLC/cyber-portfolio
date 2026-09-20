# Automated Security Report Generation

**Status:** Built October to December 2025. **Not in active use since January 2026**, and it
would not run today without a change. Audited 2026-09-20; what follows is what is on disk.

Tabletop exercise reports and incident-response assessments were taking most of a working day
each, largely in document assembly rather than thinking. This generates the draft from
scenario parameters against real Word templates, preserving the formatting, and scores
exercise responses against a rubric.

## What it does

| | |
|---|---|
| Generation | Ollama, local inference |
| Document layer | `python-docx` against real client-format Word templates |
| Content | retrieval over a security knowledge base |
| Scoring | rubric evaluation for exercise responses |
| Host | the SOC server: Pop!_OS 22.04, i9-13900K, 24 cores / 32 threads, 24 GB AMD GPU |

## Measured durations

| document | generated | previous manual effort |
|---|---|---|
| tabletop exercise report | **3 minutes** | ~4 hours |
| incident response assessment | **20 minutes** | ~8 hours |

Earlier versions of this page reduced that to a single headline "95% reduction". The two
ratios are **98.75%** and **95.8%**, so one round number cannot describe both, and the manual
baselines are my own recollection of how long these took rather than a timing record. The
durations above are the real output; the reader can do the division.

What the tool demonstrably removes is document assembly. It does not remove the exercise
design, the judgement about what the findings mean, or the review pass before anything goes
to a client.

## The audit findings, on my own work

**It calls a model that is not installed.** Every generator on disk names `llama3.1:8b`, and
two earlier variants name `mixtral:latest`. Neither is present on the host. As it stands the
toolchain cannot complete a run. Earlier versions of this page claimed `mistral:7b` in one
section and `mistral-small:22b` in another, and neither matched the source.

**The host was described as Debian.** It is Pop!_OS 22.04. That error was in this project's
own internal documentation for months before anyone checked `/etc/os-release`.

**There is no client deliverable on disk.** The three output directories are placeholders
with test names. The generators were last modified 2025-12-24 and the newest output is
2026-01-14. Earlier versions of this page carried `Status: Production, client deliverables`,
which was a stronger claim than the evidence supports, and "client-ready output" was a
quality assessment with no reviewer behind it.

I am leaving it in the portfolio as what it is rather than deleting it, because the
template-preservation problem was the genuinely hard part and that code still works. But an
unmaintained tool described as in production is the same failure this portfolio spends most of
its pages on, and it was mine.

## What it would take to revive it

1. **Pin the model in one place** and name a model that exists. The five generator variants
   each hardcode their own, which is how two of them drifted onto a different model family.
2. **Consolidate the variants.** `ir_assessor`, `_fixed`, `_old` and `_excel` are four
   generations of the same file with no indication which is current.
3. **Add a smoke test that actually generates a document**, so "the model is missing" fails
   in a test rather than in front of a deliverable.

## Skills demonstrated

Local LLM integration, retrieval-augmented generation against a curated knowledge base,
document automation preserving exact client formatting, rubric-based scoring, Python, and
auditing a published claim against the code it describes.

---

**Built:** October to December 2025. **Last run:** January 2026. **Audited:** September 2026.
