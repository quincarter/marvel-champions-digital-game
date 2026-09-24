"""
Find the full-page artboard / comic pages in the campaign rulebooks and render them to PNG.

Reads docs/campaign-modes/markdown/mc*.md, collects every "## Page N" section whose body is the
"*(Full-page graphic / illustration — no text on this page)*" marker, resolves the section's
"*Source: <pdf> (Page N of M)*" line to docs/campaign-modes/<pdf>, and hands the page list to
docs/extract_pages.py (see docs/EXTRACT_PAGES.md). Pages stay in rulebook order, which is story order.

Stdlib only; extract_pages.py pulls in PyMuPDF through its own uv script header.
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
CAMPAIGN_DIR = REPO / "docs" / "campaign-modes"
MARKDOWN_DIR = CAMPAIGN_DIR / "markdown"
EXTRACTOR = REPO / "docs" / "extract_pages.py"

MARKER = "*(Full-page graphic / illustration — no text on this page)*"
PAGE_HEADING = re.compile(r"^## Page (\d+)\b")
SOURCE_LINE = re.compile(r"^\*Source: (.+?\.pdf) \(Page (\d+) of (\d+)\)\*")


def find_artboards(md_path: Path) -> tuple[str | None, list[int]]:
    pdf_name: str | None = None
    pages: list[int] = []
    current: int | None = None

    for raw in md_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        heading = PAGE_HEADING.match(line)
        if heading:
            current = int(heading.group(1))
            continue
        source = SOURCE_LINE.match(line)
        if source:
            pdf_name = pdf_name or source.group(1)
            # Trust the Source line's PDF page over the heading if they ever disagree.
            current = int(source.group(2))
            continue
        if line == MARKER and current is not None and current not in pages:
            pages.append(current)

    return pdf_name, pages


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "boxes",
        nargs="*",
        help="Box codes or markdown stems to process (e.g. mc10, mc16_galaxys_most_wanted). Default: all.",
    )
    parser.add_argument("-o", "--output", default="extracted_pngs/artboards", help="Base output directory")
    parser.add_argument("--dpi", type=int, default=300, help="Render DPI (default 300)")
    parser.add_argument("--include-cover", action="store_true", help="Also render page 1 (the box cover)")
    parser.add_argument("--dry-run", action="store_true", help="List the pages without rendering")
    args = parser.parse_args()

    wanted = [b.lower() for b in args.boxes]
    md_files = sorted(MARKDOWN_DIR.glob("mc*.md"))
    if wanted:
        md_files = [m for m in md_files if any(m.stem == w or m.stem.startswith(w + "_") for w in wanted)]
    if not md_files:
        print(f"No campaign markdown matched {args.boxes or 'mc*'} in {MARKDOWN_DIR}", file=sys.stderr)
        return 1

    failures = 0
    for md in md_files:
        pdf_name, pages = find_artboards(md)
        if not args.include_cover:
            pages = [p for p in pages if p != 1]
        if not pdf_name:
            print(f"{md.stem}: no '*Source: ...pdf*' line found, skipping", file=sys.stderr)
            failures += 1
            continue
        pdf = CAMPAIGN_DIR / pdf_name
        spec = ",".join(str(p) for p in pages)
        print(f"{md.stem}: {pdf_name} -> pages {spec or '(none)'}")
        if not pages:
            continue
        if not pdf.is_file():
            print(f"  missing PDF: {pdf}", file=sys.stderr)
            failures += 1
            continue
        if args.dry_run:
            continue

        # extract_pages.py writes <output>/<pdf stem>/page_NNN.png.
        cmd = ["uv", "run", str(EXTRACTOR), str(pdf), "-p", spec, "--dpi", str(args.dpi), "-o", args.output]
        result = subprocess.run(cmd, cwd=REPO)
        if result.returncode != 0:
            failures += 1

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
