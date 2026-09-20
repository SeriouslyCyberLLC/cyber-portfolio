# Local Speech-to-Text: a transcript is not evidence of speech

**Status:** Running on the workstation. Built January 2026, audited and corrected September
2026. Figures read from the running service and its source on 2026-09-20.

A local dictation service so that notes, incident timelines and draft reports never leave
the host. Commodity plumbing, and it would not be worth a writeup except for two things the
audit turned up: the service had been described as GPU-accelerated when it runs on CPU, and
it invents words when handed silence.

## What it actually is

| | |
|---|---|
| Model | faster-whisper **medium**, `int8` quantisation, 1.5 GB on disk |
| Device | **CPU.** Not the GPU |
| Language | **English, hardcoded** in the transcribe call |
| Transport | HTTPS on 9001, self-signed certificate, file upload |
| Auth | shared secret from a root-owned token file, currently in log-only mode |
| Clients | a Chrome/Brave extension (Manifest V3) and a system-wide hotkey |
| Egress | none. The model and the audio stay on the box |

## It fabricates text on silence

This is the finding worth the page. Measured against six clips of digital silence:

| input | returned |
|---|---|
| 1 s | `{"text": "", "success": true}` |
| 2 s | **`{"text": "Thank you.", "success": true}`** |
| 3 s | **`{"text": "You", "success": true}`** |
| 5 s | **`{"text": "Thank you.", "success": true}`** |
| 8 s and 12 s | **`{"text": "You", "success": true}`** |

Five of six invented words nobody spoke, and every one of them carried `success: true`.

This is documented Whisper decoder behaviour, not a defect in my code: the decoder emits
high-frequency training phrases when there is nothing to transcribe. The consequence is
specific and it is mine to state:

> **A non-empty transcript from this endpoint is not evidence that anyone said anything.**

So nothing downstream may treat non-empty output as speech. It is a dictation convenience,
not a recording of fact, and it would be unfit as-is for anything evidentiary: an interview
note, a timeline entry, a quote attributed to a person. The same failure shape shows up
across this portfolio under a different name, a component returning a well-formed,
plausible answer for a question it could not actually answer.

## The GPU claim was wrong, and it was wrong in my own words

Every earlier version of this page said the service used ROCm on the RX 7900 XTX. It does
not. The source reads:

```python
MODEL_SIZE, DEVICE, COMPUTE_TYPE = "medium", "cpu", "int8"
```

Worse, the server **printed** a hardcoded "on GPU" line at startup around
`device="cpu"`, so the log agreed with the writeup and both were wrong. Confirmed by
checking for open handles on the GPU device nodes: **zero**. The startup banner now prints
the device it was actually given.

That is the same class of error this portfolio spends most of its pages on, committed on my
own work: a status line reporting an intention rather than a measurement. It is the reason
this page now names the device, the quantisation and the language as separate facts rather
than one adjective.

## Two claims removed rather than corrected

- **A WebSocket streaming API on port 9000.** There is no WebSocket server. The library is
  present in the virtualenv and two *test clients* import it, which is how a grep makes a
  server look like it exists. Only 9001 listens, and it takes a file.
- **Multilingual support.** `language="en"` is passed on every call, so there is no
  multilingual path to support.

Latency is not quoted at all any more. The old "3-5 seconds for 10 seconds of audio" has no
measurement behind it anywhere in the repository, and it was describing hardware the service
does not use. An unmeasured number for the wrong device is worth less than no number.

## Service inventory, as deployed

One system unit, `whisper.service`, enabled and active, plus a user unit for the hotkey.
Earlier versions of this page listed two units by paths that do not exist, one of them for
the WebSocket server that was never built.

## What I would change before anyone relied on it

1. **Enforce the shared secret.** It is deliberately in log-only mode so an unconfigured
   client fails loudly in a log rather than silently in use, but it binds all interfaces and
   the enforcement flag is one environment variable away.
2. **Suppress the silence fabrication** with a voice-activity gate ahead of the decoder,
   and return empty rather than a guess. The decoder cannot be talked out of this; it has to
   be prevented from seeing silence.
3. **Decide on the GPU deliberately.** CPU `int8` medium is adequate for dictation. If the
   GPU is wanted, it should be a measured choice with a latency number attached, not an
   assumption written into a startup banner.

## Skills demonstrated

Linux service administration, systemd unit and user-unit design, HTTPS with a private CA,
shared-secret authentication with a deliberate rollout order, browser extension development
(Manifest V3, MediaRecorder), Python, and auditing my own published claims against the
running system.

---

**Built:** January 2026. **Audited and corrected:** September 2026.
