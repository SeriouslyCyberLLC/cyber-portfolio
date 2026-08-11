# DNS Behavioral Monitoring — built, measured, retired

**Status:** Retired January 2026. Kept here because the measurement is the interesting part.

A DGA and DNS-tunneling detector running over Zeek DNS logs. It worked, in the sense that
it ran and produced detections. It did not work, in the sense that almost none of those
detections were worth reading. This page records both, and what the numbers actually say.

## What it did

A Python service tailed Zeek's `dns.log` and scored every query in real time:

- **DGA detection** — Shannon entropy, vowel ratio, consonant-run length, subdomain length
- **Tunneling** — query length, base64 character patterns, TXT-record volume
- **Suspicious TLDs** — `.tk`, `.ml`, `.ga`, `.cf`, `.gq`, `.top`, `.xyz`, `.zip`
- **Scoring** — additive across checks; ≥50 logged, ≥80 pushed a phone alert

Detections were written as structured JSON and alerts delivered via Pushover.

## What it actually produced

It ran from 28 December 2025 to 15 January 2026 — 17.2 days — before stalling. The log it
left behind is the entire basis for this writeup:

| Measure | Value |
|---|---|
| Detections logged | 2,602,248 |
| Rate | 151,340/day, 32 MB/day |
| Scored exactly 50 (the floor) | **99.9%** |
| Phone alerts fired (≥80) | 1,057 — **61 per day** |
| Most-detected "threat" | **`tepes`** — the monitoring host's own hostname |
| Share of output that was that one string | **96.6%** |

The rest of the top detections were `mail.proton.me`, `mail.yahoo.com`,
`otx.alienvault.com`, `claude.ai`, and `grafana.com`. The final entry in the log flagged
this portfolio's own domain at score 50.

Extrapolated, it was on track for **55 million detections and 11.7 GB per year**, at
roughly one useful signal per never.

## Why it failed

The scoring was not wrong so much as unanchored. Entropy over a short bare hostname is
meaningless — `tepes` is five characters with one vowel, which the consonant-run and
vowel-ratio checks read as textbook DGA. Nothing in the design distinguished a local mDNS
lookup from a resolved public domain, so the host's own name became 96.6% of the corpus.

The deeper mistake was **not measuring precision before wiring up alerting**. A 0–100+
additive score feels principled, and the thresholds (50 / 80 / 120) look considered. They
were guesses. No labelled set, no baseline, no held-out evaluation — so "detections per
day" got mistaken for "working," and 61 pages a day got mistaken for coverage.

## Why it stayed broken for seven months

Worth recording separately, because the silent-failure mode is more instructive than the
detector.

The service is started by systemd with `After=network.target` and nothing else. Zeek is a
`zeekctl` standalone install that comes up later in boot, so at start time
`/opt/zeek/spool/zeek/dns.log` did not yet exist. The script shelled out to
`tail -F` and captured its stderr into a pipe **that nothing ever read**:

```python
process = subprocess.Popen(
    ['sudo', 'tail', '-F', '-n', '0', DNS_LOG_PATH],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,   # <- written to, never consumed
    text=True
)
```

`tail` reported `cannot open ... for reading` into that pipe, then parked in inotify retry.
The one message explaining the whole failure went into a buffer with no reader on the other
end. Meanwhile the Python process sat blocked on an empty stdout pipe, and `systemctl
status` reported **active (running)** the entire time — with a live process tree and no
errors in the journal.

Diagnosis came from the file-descriptor table, not the logs. A healthy `tail -F` holds an
fd on its target; this one held only stdin, stdout, stderr and an inotify handle:

```
0 -> /dev/null   1 -> pipe:[30127]   2 -> pipe:[30128]   4 -> anon_inode:inotify
```

No fd on `dns.log` — while the file was present, readable, and taking 30 writes a second.

**Three lessons, all cheap in hindsight:**

1. A service that reports healthy while producing nothing is worse than one that crashes.
   The output was the only real health signal, and nothing watched it.
2. Never capture a subprocess's stderr into a pipe you do not read. Either consume it or
   send it to the journal.
3. `Restart=always` restores the process, not the dependency. Ordering needed
   `After=` the thing it actually consumes.

## Why it was not simply fixed

Restarting it costs nothing technically — but it would resume at 61 false pages per day
and 32 MB of the host's own hostname daily. Repairing the plumbing without fixing the
precision problem would produce a *reliably* useless detector, which is worse than a
broken one, because it looks like coverage.

The capability was not lost. Zeek DNS already lands in Elasticsearch at ~625K records/day,
so DGA and tunneling detection belongs in versioned Sigma rules evaluated against that
index, and in RITA for statistical beaconing — both measurable against a labelled set
before anything is allowed to send an alert. That is the replacement, and it is the right
shape.

## Skills demonstrated

- DNS protocol analysis, entropy and n-gram scoring
- Real-time stream processing in Python
- **Detection evaluation** — measuring a detector against its own output and reading the
  result honestly
- **Silent-failure diagnosis** — fd-table and wait-channel inspection when logs are empty
- Knowing when to retire a detection rather than keep it running for the metrics

**Built:** December 2025 · **Retired:** January 2026 · **Post-mortem:** August 2026
