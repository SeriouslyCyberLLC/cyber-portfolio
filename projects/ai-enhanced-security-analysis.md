# A Triage Model You Can Measure: the SOC's LLM hunt analyzer

**Status:** Production, local-only. Rebuilt and measured August-September 2026 on a running
SOC. Every number below comes from a verdict log or a frozen eval set, not an estimate.

A local LLM reads the output of scheduled endpoint collections (Velociraptor process lists,
network sockets, crontabs, shell history, Windows persistence keys) and returns a structured
verdict: threat level, action, confidence, MITRE ATT&CK techniques, and a reason. It is
grounded with RAG over ATT&CK, D3FEND, Sigma, CISA KEV and LOLBAS/GTFOBins in ChromaDB, and
runs on a single 24 GB AMD GPU through Ollama.

Running it was never the problem. The work worth writing up was finding out whether its
verdicts meant anything:

> **For ten days the analyzer called 37.8% of routine collections CRITICAL, and 52% of its
> verdicts reported a confidence of zero. The model wasn't the main problem. The verdicts
> were being sampled at random rather than decided, the prompt never defined half the fields
> the schema required, and no one had ever measured recall.**

## Before and after, in production

The same service and the same three endpoints, ten days either side of the fix:

| | 10 days before | 10 days after |
|---|---|---|
| verdicts | 1,050 | 1,150 |
| CRITICAL | **397 (37.8%)** | **0** |
| `confidence == 0` | **52%** | **0%** |
| LOW / MEDIUM / HIGH | 568 / 45 / 40 | 940 / 204 / 6 |

A drop in alerts proves nothing by itself. A model that answers LOW to everything would also
produce the right-hand column. The rest of this writeup covers how that case was ruled out.

## 1. The verdicts were sampled, not decided

The shared LLM client sent **no sampling options** for any role, and no Modelfile set any,
so every verdict ran at Ollama's defaults: temperature 0.8, top_p 0.9. That is a sensible
default for a chat assistant and the wrong one for a classifier.

I measured it with the prompt unchanged, the collected evidence frozen, and five identical
reruns on the model then in production (Foundation-Sec-8B):

| | temperature 0.8 | temperature 0 |
|---|---|---|
| malicious test cases that got *different* verdicts across reruns | **8 of 8** | 0 of 8 |

A root shell running from `/tmp` with an established connection to a public IP on port 4444
came back as:

```
LOW, LOW, HIGH, LOW, CRITICAL     at confidence 0, 0, 95, 70, 99
```

**So the high CRITICAL rate and the missed detections were one defect, not two.** It also
means any conclusion drawn from a single run of this analyzer was unsound, including some I
had already written down.

**Setting temperature to 0 was not the fix.** Paired on the same 39 routine flows, greedy
decoding raised the share rated HIGH or above from 41.0% to **79.5%**, and agreed with the
sampled verdicts only 38% of the time. It was stable, but more alarmist. Determinism makes
the analyzer measurable. It does not make it accurate. Production now pins temperature 0 for
this role anyway, as insurance: reproducibility should come from the config, not from which
model tag happens to be installed.

## 2. The eval harness, and why it has two halves

The harness replays **117 real collections** (39 per host, the production artifact mix),
with evidence rows and RAG snippets frozen, so every experiment is paired on identical
input. Next to it is a **control set of 8 malicious cases** in the exact collection schema:
a deleted binary running from `/tmp`, a reverse shell, `curl | bash` persistence in cron, a
credential harvest followed by history wiping, encoded PowerShell from AppData, a rundll32
beacon, a Base64 Run key, and a process posing as a kernel thread.

**The control set is not optional.** If you only measure false positives on routine data,
the best possible score goes to a model that never fires. That happened: one candidate model
rated all 156 routine verdicts LOW across four prompt variants, which looked like noise had
been eliminated and was actually a detector that could not fire. A frontier model posted the
same routine score *while catching every attack*. Same headline number, opposite meaning,
and only the recall half tells them apart.

`compare.py` refuses to let a model shrink its own denominator. If a control case errored,
the report prints **UNMEASURED**, not `7/7`, because 7/7 reads as 100% while quietly dropping
the hardest case.

## 3. The prompt never defined the fields it required

The verdict schema requires `threat_level`, `action` and `confidence`. The prompt defined
none of them. So the model picked from a four-value enum with no rubric and put `0` in a
confidence field it had never been told about. Every verdict self-reported as worthless and
was still logged as a finding.

The fix was a rubric for all four levels and all four actions, confidence **anchors** rather
than a bare "0-100" range (a bare range gets the same default zero), and a counterweight to
the host baseline. The baseline tells the model *what software is present*, never *what it
did*: sshd is expected on the host, but sshd spawning an outbound shell is not.

Then a de-confounded comparison: identical frozen prompts, with the model as the only
variable.

| model | routine rated ≥ HIGH (of 39) | control recall (of 8) | notes |
|---|---|---|---|
| Foundation-Sec-8B | 5.1% | 1/8 | 9 invented ATT&CK IDs rejected by the validator |
| mistral:7b | 0.0% | **0/8** | discriminates, but rated 7 of 8 MEDIUM and one LOW |
| Claude Opus 5 (sanitised, eval only) | 0.0% | **8/8** | confidence 45-95 across 13 distinct values; 0 invalid IDs |
| **mistral:7b + severity floor** (deployed) | **0.0%** | **8/8** | |

Paired on the same 39 flows at the same default sampling, the rubric alone took
Foundation-Sec's rate of routine verdicts at HIGH or above from 41.0% to 5.1%. But it moved
mistral's misses into MEDIUM rather than HIGH. The local model could tell a reverse shell
from routine activity and still never crossed the line that matters.

## 4. A deterministic floor under the model

`severity_floor.py` computes a **minimum** threat level from the sampled evidence rows. The
model can go above the floor, never below it. It is code rather than prompt text for three
reasons: the guarantee has to survive a model swap (this role was swapped the same week), it
has to survive an unrelated prompt edit, and a prompt instruction can't be unit-tested.

Two of the six missed detections weren't missing rules. They were **fields the matcher could
not see**: socket rows nest their process details in an object the flat scan skipped, and
Velociraptor renders Windows argv NUL-separated, so a pattern spanning two arguments could
never match. Fixing that plumbing recovered more than the new patterns did.

Where a rule depends on the *relationship* between fields, it is structural rather than a
regex:

| rule | floor | why each half matters |
|---|---|---|
| executable in a temp path **and** deleted from disk | CRITICAL | either alone is routine: deleted binaries follow every package upgrade |
| kernel-thread name **with** an executable path | CRITICAL | real kernel threads have no executable at all |
| established connection **from** a temp-path binary | CRITICAL | scoped to established, not listening |
| rundll32/regsvr32/mshta/certutil **to a public** address | HIGH | these do talk to LAN services |
| encoded PowerShell **with** a hidden window | HIGH | installers use `-enc` openly; hiding the window is the tell |

**Measured:** fires on **0 of 117** real routine flows and **8 of 8** controls. 80 tests
cover the floor, the harness and the sanitiser. The rules were written with the control set
visible, so 8/8 alone proves little. The benign-shape tests are what carry the weight: a
deleted binary on a normal path, a real kernel worker, a listening socket from `/tmp`,
rundll32 to a private address, `-enc` without a hidden window.

`severity_floor_applied` is logged on every verdict, along with the model's own answer, so
"the model agreed with the floor" and "no rule matched" stay separate facts. **If overrides
start appearing, the model has regressed.**

## 5. What production caught that the eval set didn't

Between 2026-09-13 and 09-17 the floor overrode the model **9 times, all HIGH, all from the
same rule, and all the same line**. Each was the standard one-liner installer for the Node
version manager:

```
curl -o- https://.../nvm-sh/nvm/v0.39.0/install.sh | bash
```

It sits in an admin host's shell history, which is re-collected on a schedule, so the same
line re-fired on every collection. The rule treats `curl ... | bash` as having no benign
reading in this environment. The 117-flow calibration corpus happened to contain no shell
history with an installer in it, so nothing contradicted that. **Production did.**
Download-and-execute is exactly how that installer is meant to run, and it is also exactly
what the rule is there to catch. The two cannot be told apart from the command line alone.

### The fix was neither of the two options I first saw

I framed the decision as allowlist the known installer URLs (which an attacker could
imitate) or suppress history lines already seen (so a new one still fires). Both are about
the *string*. The third option, which is the one that shipped, is about **where the evidence
came from**:

> **A `.bash_history` line is a record of the past, not evidence of execution.**

Rows carry an `_artifact` field, so a rule can know its evidence's provenance. A
download-and-execute pattern found in a *process* row still floors to HIGH. The same pattern
found in a shell-history row does not, because `.bash_history` is undated, unordered, and
says only that someone once typed it. The hit is still recorded, tagged as history-only, so
the finding is visible without being escalated.

**The scope is deliberately narrow.** It applies to that one rule. Wiping shell history and
harvesting credentials have no benign reading wherever they are found, and those still floor
from a history row, which is pinned by tests. There is also a structural fallback for
captures taken before `_artifact` existed.

Measured since it deployed on 2026-09-18: **326 verdicts, 0 floor overrides, 0 CRITICAL, 0
verdicts at confidence 0.** The regression signal did its job first, though, and that is the
transferable part: the overrides were visible, attributable to one rule and one line, and
checked against the collected evidence rather than argued about. **A calibration corpus is a
sample, and the zero it produces is only as good as what the sample contains.**

## Sending evidence to a frontier model without leaking the environment

The Claude arm ran on sanitised copies of the corpus only. `sanitize.py` **preserves
structure rather than redacting**: public IPs map to TEST-NET-3, private ranges to a
consistent `10.99.x`, and hostnames to stable pseudonyms so "same host" relationships
survive. Loopback is kept, because a listener on 127.0.0.1 is evidence, not identity. Every
detection signal stays intact: temp paths, port numbers, `curl | bash`, `-enc`, hashes, the
deleted flag.

A fail-closed guard runs immediately before the first API call and exits non-zero on any
leftover address. Two traps turned up while building it:

- **An X.509 OID looks like an IPv4 address.** The first sanitiser rewrote
  `1.3.6.1.4.1.311.60.2.1.3` in an Authenticode subject into a fake IP, silently corrupting
  exactly the certificate evidence the Windows cases turn on. A four-component OID
  (`2.5.4.15`) has the same shape as an address, and only its `OID=` context separates them.
- **The sanitiser and the guard must share one definition of an address.** Once OIDs were
  preserved correctly, the guard started blocking them as real IPs, which would have refused
  a correctly sanitised payload forever.

## Guardrails that were already in place

- **No failure can produce a well-formed verdict.** A schema violation, empty completion,
  timeout or unreachable endpoint raises an error. Nothing is clamped into a default
  MEDIUM/0.
- **ATT&CK IDs are validated** against a frozen list of 860 real technique IDs, and the free
  text is scanned too, because checking only the structured field left invented IDs in the
  prose.
- **RAG has a relevance floor.** Retrieved documents past a distance threshold are dropped,
  not injected as context regardless of fit.
- **Two log files, on purpose.** The verdict log gets successes only, so it goes stale when
  analysis fails. A status file is rewritten every cycle to prove the loop is running.
  Merging the two would let a running-but-useless service look healthy.
- **No containment is triggered by a model verdict.** The analyzer recommends. It doesn't
  act.

## Honest limitations

- The control cases are synthetic and deliberately unambiguous. Catching them is necessary,
  not sufficient. Accuracy on *ambiguous* evidence needs a labelled set of real alerts, and
  that is still being built.
- n = 39 routine flows per arm, from three hosts. Enough to expose a 79.5% false-positive
  rate or a detector that can't fire. Not enough to rank two good models.
- mistral:7b still under-calls on its own. The floor guarantees the unambiguous cases and
  nothing more. Treat the output as triage assistance, not a detector.
- Section 5's false positive is closed, on the third option rather than either of the two I
  first framed. What remains open is the general case: the floor only guarantees the
  unambiguous patterns, and quantifying accuracy on ambiguous evidence still needs a larger
  labelled set.

## Framework mapping

| finding | maps to |
|---|---|
| verdicts that change on identical input; confidence reported as zero | NIST AI RMF **Measure** (validity, reliability) |
| invented ATT&CK IDs caught by validation | OWASP LLM Top 10 2025 **LLM09 Misinformation** |
| model rates a reverse shell MEDIUM; deterministic code floor underneath | NIST AI RMF **Manage** (risk treatment for a known model weakness) |
| analyzer recommends only, never triggers containment | OWASP **LLM06 Excessive Agency** |
| structure-preserving sanitiser and fail-closed egress guard | OWASP **LLM02 Sensitive Information Disclosure**; NIST AI RMF **Manage** |
| paired eval with a recall control before any model or prompt change | NIST AI RMF **Measure**; ISO/IEC 42001 AI system performance monitoring |

## Skills demonstrated

- Designing LLM evaluations that can't be gamed by a degenerate classifier
- Tracing an ML failure to its root cause (sampling configuration) rather than blaming the model
- Deterministic guardrails layered under a probabilistic component, with regression telemetry
- Privacy-preserving evaluation against a frontier API
- Local LLM operations: Ollama, ROCm, RAG with ChromaDB, schema-enforced structured output

**Tech:** Python, Ollama, mistral:7b, Foundation-Sec-8B, Claude Opus 5 (eval only), ChromaDB,
Velociraptor, AMD ROCm, pytest, MITRE ATT&CK, OWASP LLM Top 10 2025, NIST AI RMF

**Scope and limits:** personal lab on owned equipment; no employer or client data or
systems are involved; figures are readings on the dates stated, not guarantees. See
[Scope, sourcing and limits](../DISCLAIMER.md).
