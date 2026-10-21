# /// script
# requires-python = ">=3.10"
# dependencies = ["pymupdf4llm<1", "pymupdf"]
# ///
"""
Rules Reference PDF -> Markdown (mechanical transcription, one `<!-- PDF page N -->` marker per page).

Used for mc_rulesreference_v16_compressed.md. The PDF is not committed; download it from Hall of Heroes (the link is
in docs/project/rules-authority.md) and pass its path. pymupdf4llm is pinned below 1.0 because the 2.0 release on
PyPI ships no module.

Usage:
    uv run scripts/rrg_pdf_to_markdown.py <rrg.pdf> mc_rulesreference_v16_compressed.md
"""

import datetime as dt
import re
import sys

import pymupdf4llm

HEADER = """# Marvel Champions Rules Reference, v1.6 (July 2024): Markdown transcription

> **Source:** [mc_rulesreference_v16_compressed.pdf](https://hallofheroeslcg.com/wp-content/uploads/2024/07/mc_rulesreference_v16_compressed.pdf)
> (FFG, hosted by Hall of Heroes). Converted mechanically with pymupdf4llm on {date}; layout artifacts
> (broken columns, index dot leaders) are left as converted.
> **Historical, not current:** RRG v1.8 ([`mc_rulesreference_v18_compressed.md`](mc_rulesreference_v18_compressed.md))
> is the current rules authority and wins wherever this version differs. This copy is kept for history and for
> resolving conflicts, such as reading what the rules said when the post-RRG 1.6 rulings
> ([`docs/rulings/post-rrg-1-6/`](docs/rulings/post-rrg-1-6/)) were issued.
> Each `<!-- PDF page N -->` marker starts a page of the PDF; the printed page number appears near the end of it.

"""


def main() -> None:
    src, dest = sys.argv[1], sys.argv[2]
    parts = [HEADER.replace("{date}", dt.date.today().isoformat())]
    for i, chunk in enumerate(pymupdf4llm.to_markdown(src, page_chunks=True), 1):
        text = re.sub(r"\n{3,}", "\n\n", chunk["text"]).strip("\n")
        parts.append(f"<!-- PDF page {i} -->\n\n{text}\n\n")
    with open(dest, "w", encoding="utf-8", newline="\n") as f:
        f.write("".join(parts).rstrip("\n") + "\n")
    print(f"wrote {len(parts) - 1} pages to {dest}")


if __name__ == "__main__":
    main()
