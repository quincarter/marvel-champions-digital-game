---
name: extract-artboards
description: Render the full-page comic/artboard pages baked into the campaign expansion rulebook PDFs (docs/campaign-modes/*.pdf) to high-resolution PNGs, in story order. Use when someone wants the story art, comic pages or artboards from a campaign box (TRoRS, GMW, MTS, SM, MG, NeXt, AoA, SHIELD, Civil War, Fear No Evil), or asks to run docs/extract_pages.py on the rulebooks.
---

# Extract campaign artboards

The campaign rulebooks in `docs/campaign-modes/` carry full-page comic art between the rules pages.
Their Markdown conversions in `docs/campaign-modes/markdown/` mark every such page with a section whose
body is only:

```
## Page N: ...
*Source: <rulebook>.pdf (Page N of M)*

*(Full-page graphic / illustration — no text on this page)*
```

Those marked pages, in rulebook order, are the story sequence. Page 1 is always the box cover and is
skipped unless asked for.

## How to run

`find_artboards.py` (next to this file) reads the markers, resolves each book's PDF from its `*Source:*`
line, and calls `docs/extract_pages.py` with the page list. Usage of the extractor itself is in
`docs/EXTRACT_PAGES.md`. Run everything from the repo root:

```bash
# See which pages would be pulled, per box, without rendering
python3 .claude/skills/extract-artboards/find_artboards.py --dry-run

# Render one box (code prefix or full markdown stem)
python3 .claude/skills/extract-artboards/find_artboards.py mc10

# Render several, or all when no box is given
python3 .claude/skills/extract-artboards/find_artboards.py mc16 mc21
python3 .claude/skills/extract-artboards/find_artboards.py
```

Options:

- `-o/--output DIR`: base directory, default `extracted_pngs/artboards` (`extracted_pngs/` is gitignored).
- `--dpi N`: render DPI, default 300 (the extractor's default). Use 450 for print-grade crops.
- `--include-cover`: also render page 1.
- `--dry-run`: print the page lists only.

Output lands at `<output>/<pdf stem>/page_NNN.png`, where `NNN` is the PDF page number, so sorting the
filenames gives story order. Example: `extracted_pngs/artboards/mc10_the_rise_of_red_skull_rules_web/page_004.png`.

To pull arbitrary pages instead (a rules diagram, a page the Markdown didn't mark), call the extractor
directly as `docs/EXTRACT_PAGES.md` shows, from the repo root:

```bash
uv run docs/extract_pages.py docs/campaign-modes/mc50_rulebook-web.pdf -p 8,10 -o extracted_pngs/manual
```

## After rendering

- Report per box how many pages were written and where; the dry-run line gives the list.
- Look at a page or two with the Read tool to confirm they are art, not rules text. The markers were
  written by a text-extraction pass, so a page with art plus a caption, or a rules page that is mostly an
  image, can be missed or wrongly marked. If one looks wrong, say which page, and fix the marker in the
  Markdown only if the user asks.
- The PNGs are Fantasy Flight Games / Marvel artwork. Keep them out of commits unless the user asks to
  add specific pages to the client's assets.

## Requirements

- `uv` on PATH (the extractor is a PEP 723 script; `uv run` installs PyMuPDF on first use).
- `python3` 3.10+ for `find_artboards.py`, which uses only the standard library.
