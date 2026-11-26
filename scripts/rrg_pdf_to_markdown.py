# /// script
# requires-python = ">=3.10"
# dependencies = ["pymupdf4llm<1", "pymupdf"]
# ///
"""
Rules Reference PDF -> Markdown (mechanical transcription, one `<!-- PDF page N -->` marker per page).

Used for docs/rules/mc_rulesreference_v16_compressed.md (the PDF is not committed; download it from Hall of Heroes, the link
is in docs/project/rules-authority.md) and for the Spanish guide, docs/rules/es/mc_guia_de_referencia_es_2019.md (its PDF
is beside it). pymupdf4llm is pinned below 1.0 because the 2.0 release on PyPI ships no module.

Usage:
    uv run scripts/rrg_pdf_to_markdown.py <rrg.pdf> docs/rules/mc_rulesreference_v16_compressed.md
    uv run scripts/rrg_pdf_to_markdown.py docs/rules/es/mc_guia_de_referencia_es_2019.pdf         docs/rules/es/mc_guia_de_referencia_es_2019.md --es
"""

import datetime as dt
import re
import sys

import pymupdf4llm

HEADER = """# Marvel Champions Rules Reference, v1.6 (July 2024): Markdown transcription

> **Source:** [mc_rulesreference_v16_compressed.pdf](https://hallofheroeslcg.com/wp-content/uploads/2024/07/mc_rulesreference_v16_compressed.pdf)
> (FFG, hosted by Hall of Heroes). Converted mechanically with pymupdf4llm on {date}; layout artifacts
> (broken columns, index dot leaders) are left as converted.
> **Historical, not current:** RRG v1.8 ([`docs/rules/mc_rulesreference_v18_compressed.md`](mc_rulesreference_v18_compressed.md))
> is the current rules authority and wins wherever this version differs. This copy is kept for history and for
> resolving conflicts, such as reading what the rules said when the post-RRG 1.6 rulings
> ([`docs/rulings/post-rrg-1-6/`](../rulings/post-rrg-1-6/)) were issued.
> Each `<!-- PDF page N -->` marker starts a page of the PDF; the printed page number appears near the end of it.

"""


HEADER_ES = """# Marvel Champions: El Juego de Cartas, Guía de referencia (Asmodee España, 2019): Markdown transcription

> **Source:** [mc_guia_de_referencia_es_2019.pdf](mc_guia_de_referencia_es_2019.pdf), Asmodee España's official Spanish
> reference guide for the Core Set ([download](https://cdn.svc.asmodee.net/production-asmodeees/uploads/2023/06/Referencia_Marvel_Champions.pdf)).
> Converted mechanically with pymupdf4llm on {date}; layout artifacts (broken columns, index dot leaders) are left as
> converted.
> **Not a rules authority:** it predates RRG v1.8 ([`../mc_rulesreference_v18_compressed.md`](../mc_rulesreference_v18_compressed.md)),
> which wins wherever they differ. It is the source of the Spanish game terms the app text uses
> (`packages/client/src/i18n/es.ts`).
> Each `<!-- PDF page N -->` marker starts a page of the PDF.

"""


def main() -> None:
    src, dest = sys.argv[1], sys.argv[2]
    header = HEADER_ES if "--es" in sys.argv[3:] else HEADER
    parts = [header.replace("{date}", dt.date.today().isoformat())]
    for i, chunk in enumerate(pymupdf4llm.to_markdown(src, page_chunks=True), 1):
        text = re.sub(r"\n{3,}", "\n\n", chunk["text"]).strip("\n")
        parts.append(f"<!-- PDF page {i} -->\n\n{text}\n\n")
    with open(dest, "w", encoding="utf-8", newline="\n") as f:
        f.write("".join(parts).rstrip("\n") + "\n")
    print(f"wrote {len(parts) - 1} pages to {dest}")


if __name__ == "__main__":
    main()
