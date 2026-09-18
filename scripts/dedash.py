#!/usr/bin/env python3
"""Replace em dashes, en dashes and ellipsis characters with plain punctuation.

Not a blanket substitution. An em dash does three different jobs in this prose and each
one wants different punctuation, so blindly swapping in commas produces comma splices --
which reads worse than the dash did.

  X — and/but/so/which/because Y   ->  X, and Y      (the dash was a weak comma)
  X — <independent clause>         ->  X. Y          (it was a weak full stop)
  X — <fragment>                   ->  X, Y          (apposition)
  | — |                            ->  | - |         (table placeholder for "none")
  1990–1995                        ->  1990-1995     (numeric range)
  …                                ->  ...           (elision inside a path or command)

Run with --check to report what is left instead of editing.
"""
import re
import sys

# Words that begin a dependent continuation: the dash was standing in for a comma.
CONJUNCTIONS = ("and ", "but ", "so ", "which ", "who ", "because ", "while ", "though ",
                "although ", "since ", "with ", "without ", "not ", "never ", "then ",
                "or ", "nor ", "yet ", "for ", "after ", "before ", "until ", "unless ")

# Openers that almost always start a complete sentence in this corpus.
SENTENCE_STARTERS = ("it ", "it's ", "its ", "that ", "this ", "these ", "those ", "they ",
                     "there ", "we ", "i ", "he ", "she ", "one ", "both ", "each ",
                     "every ", "nothing ", "none ", "no ", "any ", "all ", "the ", "a ",
                     "an ", "измер")


def fix_spaced(text: str) -> str:
    """Handle ' — ' between two pieces of prose."""
    out = []
    pos = 0
    for m in re.finditer(r'[ \t]+—[ \t]+', text):
        before = text[pos:m.start()]
        after_start = m.end()
        tail = text[after_start:after_start + 40]
        lower = tail.lower()

        if lower.startswith(CONJUNCTIONS):
            sep = ", "
        elif lower.startswith(SENTENCE_STARTERS) and len(before.split("\n")[-1]) > 55:
            # Long clause followed by a complete one: a full stop reads better than a
            # comma, and avoids the splice.
            sep = ". "
            tail_fixed = True
        else:
            sep = ", "
        out.append(before)
        out.append(sep)
        if sep == ". ":
            # Capitalise the new sentence, leaving markup and code spans alone.
            rest = text[after_start:]
            mm = re.match(r'([`*_"\'(\[]*)([a-z])', rest)
            if mm:
                idx = after_start + mm.end() - 1
                text = text[:idx] + text[idx].upper() + text[idx + 1:]
        pos = after_start
    out.append(text[pos:])
    return "".join(out)


def fix_pairs(text: str) -> str:
    """A PAIR of dashes inside one paragraph is a parenthesis, not two commas.

    "the truth the whole time — `removed=0` — and the caller discarded it" becomes
    unreadable as three comma-separated fragments. Parentheses keep the aside an aside.
    Paragraph-wise, not line-wise, because the pair is usually split across wrapped lines.
    """
    out = []
    for para in re.split(r'(\n\s*\n)', text):
        if para.count('—') == 2 and not para.lstrip().startswith(('|', '-', '*', '#')):
            a = para.index('—')
            b = para.index('—', a + 1)
            inner = para[a + 1:b]
            if len(inner) < 120 and not re.search(r'[.!?]\s', inner):
                para = (para[:a].rstrip() + ' (' + inner.strip() + ') ' + para[b + 1:].lstrip())
                para = re.sub(r'\)\s+([,.;:])', r')\1', para)
        out.append(para)
    return "".join(out)


def fix_definitions(text: str) -> str:
    """Term-then-definition wants a colon, which is what the dash was standing in for."""
    # Bullet: "- **Tunneling** — query length, ..." -> "- **Tunneling**: query length, ..."
    text = re.sub(r'(?m)^(\s*[-*]\s+(?:\*\*[^*]+\*\*|`[^`]+`|[A-Z][\w /-]{0,30}))\s+—\s+',
                  r'\1: ', text)
    # Any dash INSIDE a table row: cells are label-then-value, which is what a colon is
    # for. "| duplicate guard | never fired — direct calls stack rules |" reads as a
    # comma splice otherwise.
    def row(m):
        return m.group(0).replace(' — ', ': ')
    text = re.sub(r'(?m)^\s*\|.*$', row, text)
    # Headings: "# Exit 0 Is Not Evidence — auditing a SOC" is a title and a subtitle.
    text = re.sub(r'(?m)^(#{1,6} .*?)\s+—\s+', r'\1: ', text)
    return text


def convert(text: str) -> str:
    # Table cell holding only a dash: it means "no value".
    text = re.sub(r'\|\s*—\s*\|', '| - |', text)
    text = fix_definitions(text)
    text = fix_pairs(text)
    text = fix_spaced(text)
    # A dash left at the end of a line, continuing on the next one.
    text = re.sub(r'[ \t]+—\s*\n', ',\n', text)
    # Anything still attached to words on both sides (rare), e.g. word—word.
    text = re.sub(r'(?<=\w)—(?=\w)', ', ', text)
    text = text.replace('—', ', ')
    # En dash: numeric or date ranges, and the spaced form used in tables.
    text = re.sub(r'(?<=\d)\s*–\s*(?=\d)', '-', text)
    text = re.sub(r'(?<=[A-Za-z])–(?=[A-Za-z])', '-', text)
    text = re.sub(r'[ \t]+–[ \t]+', ' to ', text)
    text = text.replace('–', '-')
    text = text.replace('…', '...')
    # NO GLOBAL TIDY PASS. The first version ran `(?<=[.:;])\s*,\s*` over the whole file
    # to clean up doubled punctuation, and it ate the comma in the CSS selector
    # `.flagship-badge:hover, .flagship-badge:focus-visible`, turning a selector LIST into
    # a compound selector and silently killing the focus style. A cleanup must never touch
    # text it did not create, so the only tidying left is at the substitution sites
    # themselves, where a dash sat next to punctuation that already ended the clause.
    text = re.sub(r'(?<=[,;:])\s*,\s+', ' ', text)   # "X: , Y"  -> "X: Y"
    text = re.sub(r'\.\s*,\s+', '. ', text)          # "X. , Y"  -> "X. Y"
    return text


def main() -> int:
    check = "--check" in sys.argv
    paths = [a for a in sys.argv[1:] if not a.startswith("-")]
    bad = 0
    for p in paths:
        raw = open(p, encoding="utf-8").read()
        if check:
            hits = sum(raw.count(c) for c in "—–…")
            if hits:
                bad += hits
                print(f"  {p}: {hits}")
            continue
        new = convert(raw)
        if new != raw:
            open(p, "w", encoding="utf-8").write(new)
            print(f"  rewrote {p}")
    if check:
        print("  clean" if not bad else f"  TOTAL {bad}")
        return 1 if bad else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
