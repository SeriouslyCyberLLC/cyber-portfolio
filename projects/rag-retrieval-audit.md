# Retrieval Nobody Had Measured: auditing a SOC's RAG pipeline

**Status:** Live. Audited, rebuilt and redeployed September 2026. Figures were measured on
the running system, or on a retained copy of its vector store, at the time of the work in
mid-September 2026. Retrieval-quality figures are pinned by a committed evaluation set and
an exported metric, so they can be re-checked rather than taken on trust.

A local LLM triages the endpoint forensics my SOC collects. Before each verdict it
retrieves reference material from a vector store: ATT&CK techniques, Sigma rules, LOLBAS,
AI-security frameworks. The store was 2.5 GB, the nightly jobs that fed it reported
success, and the model received context on every analysis.

I was handed a seven-step improvement plan, heavy on caching, index tuning and "joint
learning" between the two local models. Before touching any of it, I asked the retrieval
questions I already knew the answers to.

> **A retriever that returns three documents for every query looks exactly like one that
> returns the right three, until you ask it questions whose answers you already know.**

On 30 known-answer queries it returned the correct technique **6 times**.

## What reported healthy, and what was true

| # | What reported healthy | What was actually true |
|---|---|---|
| 1 | Retrieval running on every analysis | Right technique in context **6/30**; 14 of 30 queries got no context at all |
| 2 | A 2.5 GB knowledge base | **147 orphaned index directories, 1.9 GB of it.** The live index was 111 MB |
| 3 | 14 curated collections | The analyzer read **one**, frozen for over two weeks |
| 4 | Nightly CVE ingest | Failed on **every** night of its retained logs: 31 of 31 |
| 5 | Threat-intel ingest: "Added 5 new entries ... completed successfully" | The same 5 IPs re-written daily. The total had not moved in two months |
| 6 | A nightly rebuild keeps the index current | A long-running reader would never have seen the rebuild: see §5 |

## 1. Measure before you optimise

The plan was built around speed. Measured at the time: embedding a query took roughly **7 ms** and the vector
search **1.8 ms** (medians). LLM generation takes seconds. Caching would have optimised a
2 ms step inside a multi-second one.

The "training" and "joint learning" steps had a subtler problem. RAG does not train
anything, and these models are frozen. The real consistency lever is to feed both
models from one retrieval path and grade them against one evaluation set.

So step one became building that evaluation set. I wrote 30 queries shaped like real
evidence (command lines and artifact rows, not textbook questions) each with a known
correct ATT&CK or ATLAS ID. A hit means that ID appears in the top three documents
retrieved. That is a proxy for relevance, and I say so below.

## 2. The query was the defect, not the database

The analyzer builds its retrieval query from the rows a forensic collection returned. On
the frozen evaluation corpus of 117 real collections:

- **37%** of query terms were bare numbers: PIDs, parent PIDs, inode numbers, ports.
  They mean nothing to an embedding model.
- The builder kept the first 12 distinct terms it saw. A process listing begins with
  PID 1, so the query described `systemd`. In one synthetic malicious case, a binary
  running from `/dev/shm` was term nine.

The fix reused a component I already trusted. The SOC runs a deterministic severity floor
that flags rows with no benign reading, such as a deleted binary executing from a temp
directory, or a lolbin with an established connection to a public address. Rows it flags now
lead the query, preceded by the name of the rule that fired, in words. Numeric, IP and
timestamp terms are dropped. The deterministic layer tells the probabilistic one where to
look.

Both changes were mutation-tested: remove either one and a named test fails.

## 3. Choosing a model under a real constraint

| Embedding model, same five curated sources | Hits (of 30) |
|---|---|
| all-MiniLM-L6-v2, the single legacy collection (production) | 11 |
| all-MiniLM-L6-v2 | 16 |
| **bge-base-en-v1.5, CPU** | **22** |
| nomic-embed-text via Ollama | 22 |

On retrieval quality it was a tie. The constraint decided it. This host caps Ollama at one
loaded model, so each embedding request would evict the triage model and reload it:
**4-11 seconds per swap, measured, on every analysis**. `bge-base` runs on the CPU inside
the analyzer process, at 15 ms per query, and never touches the GPU the triage model
needs.

The winner on a benchmark and the right choice for a system are different questions.

## 4. A threshold does not survive a model change

The analyzer drops retrieved documents past a relevance cutoff, so a query can never be
padded with three irrelevant results. The old cutoff was **1.0**, a squared-L2 distance
calibrated on MiniLM. The new index uses cosine distance, and `bge-base` compresses every
result into a band of roughly 0.23-0.43. Carried over, 1.0 would have kept everything.

I recalibrated on the known-answer set:

| cutoff | correct hits kept | other hits kept |
|---|---|---|
| 0.34 | 21/35 | 22/55 |
| **0.36** | **30/35** | 29/55 |
| 0.38 | 34/35 | 38/55 |

This deserves plain wording. With this model **the cutoff is a weak filter**. Distance barely
separates relevant from irrelevant, and many of the "other" hits are relevant Sigma rules
that simply carry no ATT&CK ID in their text. The quality came from the query, the model
and the sources, not from this number. Re-calibrate on any model change. Never carry a
threshold across embedding models.

## 5. The index a long-running process never refreshes

Before scheduling a nightly rebuild, I tested whether the analyzer, a service that runs
for weeks, would ever see what the rebuild wrote. It would not.

ChromaDB caches the vector index per process. In a two-process test, the reader's
document count rose and it saw updated text, but vector search still returned only the
old vectors:

| what the reader tried | nearest results |
|---|---|
| query again | `['A']` |
| fetch the collection again | `['A']` |
| create a new client | `['A']` |
| clear the shared system cache, then a new client | **`['B', 'A']`** |

Every obvious remedy failed silently. Only clearing the shared system cache worked. A
nightly rebuild would therefore have run, reported success, raised the self-check score,
and changed nothing the analyzer actually saw until its next restart. The analyzer now
watches the build's status file and reopens the index when a build completes. If a reopen
fails, it keeps serving the old handle and retries on the next cycle.

I found this **before** shipping, because I tested the assumption instead of the code.

## 6. The feeds that said they worked

- **CVE ingest.** NVD's API takes one `cvssV3Severity` value per request. The script sent
  `HIGH,CRITICAL`, which returns `404 Unrecognized CVSS severity`, and logged it as "NVD API
  may have changed". Fixed by querying each severity separately and printing NVD's own
  error message. The first run added **2,040 CVEs** (1,596 HIGH, 444 CRITICAL).
- **Threat-intel ingest: retired, not repaired.** Two of its three sources returned 401
  and 403, and the third re-inserted the same five IPs daily under a success banner. IOCs
  need exact lookup, not embeddings, and a separate intel aggregator already stores them in
  Postgres for exactly that.
- **Incident-history ingest: retired, not repaired.** Its collection turned out to be
  leftover output from a retired component: 83% one detection rule, plus three
  synthetic "ransomware" test records sitting under a description that called it real
  incident history. Repairing the script would have replaced it with alerts that are
  99.7% one informational rule. That feeds the model a baseline, not experience.
- **The 1.9 GB of dead index files.** Eleven ingest scripts delete and recreate their
  collection on every run, and each run leaves the old index directory behind. I
  moved the orphans aside rather than deleting them, after checking each one against a
  fresh read of the catalog. They will re-accumulate until those scripts update in place,
  and I list that as open rather than calling it fixed.

## 7. End to end: did the verdicts change?

Better retrieval only matters if the verdicts improve without new false alarms. The SOC
already had a frozen evaluation harness: 117 real routine collections and 8 synthetic
malicious control cases. I re-ran retrieval over that identical evidence and graded both
versions with the same model at temperature 0. The only variable was retrieval:

| | old retrieval | new retrieval |
|---|---|---|
| routine collections rated ≥HIGH | 0 / 117 | **0 / 117** |
| malicious controls given any context | 5 / 8 | **8 / 8** |
| malicious controls ≥HIGH, model alone | 0 / 8 | 1 / 8 |
| malicious controls ≥HIGH, after the deterministic floor | 8 / 8 | 8 / 8 |

No new false alarms, a third fewer MEDIUM ratings on routine collections, and every
malicious case now reaches the model with context. The model alone still under-calls, and
that is why the deterministic floor exists. Retrieval was never going to carry recall on
its own, and I did not claim it would.

## Making it stick

- **The build tests itself.** Every nightly rebuild re-runs the 30 known-answer queries
  and exports the score. An alert fires if it falls below 18, from a baseline of 22.
- **The build fails closed.** A source collection that is missing or empty, or a rebuild
  that would delete more than 20% of the index, is refused. It is never mirrored into the
  analyzer as a mass deletion. Unit tests pin both refusals, and both were
  mutation-tested.
- **A failure never looks fresh.** The last-success timestamp is carried forward on
  failure, never refreshed and never zeroed. Counts are withheld entirely, so a broken
  build cannot render as a healthy index.
- **Every ingest step reports.** The nightly job now exports a result per step, written from
  an exit trap, so a run that dies partway still says what it did. Twelve warning-level
  alert rules cover it. None pages, because a stale knowledge base degrades context and
  blinds no detector.

## Framework mapping

- **OWASP Top 10 for LLM Applications 2025, LLM08 Vector and Embedding Weaknesses.** Most of
  this project is the unglamorous side of LLM08: an index silently stale for a long-running
  reader, synthetic test data presented as history, and a relevance cutoff meaningless on
  the new model's scale.
- **NIST AI RMF, MEASURE function.** A labelled evaluation set, a paired end-to-end test
  where retrieval is the only variable, and a self-check that re-measures the deployed
  system every night instead of trusting its launch-day number.

## Honest limits

- The 30 known-answer queries are my own, and a hit means an ID string appears in a
  document. That undercounts relevant documents that carry no ID, such as many Sigma
  rules, so the true gain is probably larger than 6 → 22. It is still a proxy.
- The 8 malicious controls are synthetic and deliberately unambiguous. Catching them is
  necessary, not sufficient.
- Retrieval for masquerading kernel threads is still weak. The right techniques exist in
  the index, and the queries do not reach them.

**Tech:** ChromaDB, sentence-transformers (bge-base-en-v1.5, all-MiniLM-L6-v2), Ollama
(mistral:7b, nomic-embed-text), Velociraptor, NVD API, Prometheus, Alertmanager,
node-exporter, Python, pytest, Bash, cron

**Scope and limits:** personal lab on owned equipment; no employer or client data or
systems are involved; figures are readings on the dates stated, not guarantees. See
[Scope, sourcing and limits](../DISCLAIMER.md).
