#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "requests>=2.31",
#     "beautifulsoup4>=4.12",
#     "markdownify>=0.13",
# ]
# ///
"""
Hall of Heroes older FFG rulings pages -> per-section Markdown

Downloads Hall of Heroes' transcriptions of the OLDER official FFG rulings
(RRG 1.0-1.4 main page & errata, and post-RRG 1.5 rulings), extracts the
WordPress post body (the `entry-content` div), converts it to Markdown
deterministically (no paraphrasing: headings, lists, links and quotes are kept
as written), and writes one small file per top-level section of each page:

    docs/rulings/README.md                      index of every file + authority note
    docs/rulings/<page>/index.md                per-page index
    docs/rulings/<page>/<nn>-<slug>[-part-k].md one section (long ones split)

These are tier-4 sources in CLAUDE.md's rules authority order.

With `--target newer` it instead transcribes the post-RRG 1.7 rulings page into the single file
marvel-champions-rulings-post-rrg-1-7.md at the repo root: one `### <date> - Ruling <n>` section per ruling
(each ruling on the page ends with a signature line, "-Alex – <date>", which gives its date), grouped under
`## <Month>, <Year>`, with the page's own question and answer text converted to Markdown and nothing edited.

Usage:
    uv run scripts/scrape_rulings_markdown.py                         # older pages -> docs/rulings/
    uv run scripts/scrape_rulings_markdown.py --target newer          # post-RRG 1.7 page -> repo-root file
    uv run scripts/scrape_rulings_markdown.py --target all            # both
    uv run scripts/scrape_rulings_markdown.py --html-dir <dir>       # also save the raw HTML
    uv run scripts/scrape_rulings_markdown.py --from-html-dir <dir>  # convert saved HTML, no fetch
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup, Comment, NavigableString, Tag
from markdownify import MarkdownConverter

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT_DIR = REPO_ROOT / "docs" / "rulings"
CARD_DATA_DIR = REPO_ROOT / "packages" / "content" / "raw" / "marvelcdb"
SCRIPT_REL = "scripts/scrape_rulings_markdown.py"
NEWER_RULINGS_FILE = "marvel-champions-rulings-post-rrg-1-7.md"
USER_AGENT = "Mozilla/5.0 (compatible; mc-digital-rulings-scraper/1.0; fan project, non-commercial)"

# Each section file aims for TARGET_BYTES and is never allowed past MAX_BYTES
# (body only; the header adds well under 1 KB).
TARGET_BYTES = 24_000
MAX_BYTES = 36_000
# A section whose Markdown body is smaller than this is folded into the previous file.
MIN_SECTION_BYTES = 120


@dataclass
class Page:
    slug: str
    url: str
    title: str
    coverage: str


PAGES: List[Page] = [
    Page(
        slug="rrg-1-0-to-1-4",
        url="https://hallofheroeslcg.com/official-ffg-rulings/",
        title="Official FFG Rulings (RRG 1.0 - 1.4 main page & errata)",
        coverage="Rulings from the RRG 1.0-1.4 era, sorted by product and hero, plus FFG, community and art errata.",
    ),
    Page(
        slug="post-rrg-1-5",
        url="https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/",
        title="Latest FFG Rulings (post RRG 1.5)",
        coverage="Rulings from May 2023 to July 2024 (after RRG 1.5, before RRG 1.6), sorted by month.",
    ),
]

NEWER_PAGE = Page(
    slug="post-rrg-1-7",
    url="https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/",
    title="Latest FFG Rulings (post RRG 1.7)",
    coverage="Rulings from December 2025 onward (after RRG 1.7, and after RRG 1.8 from July 2026).",
)

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]
MONTH_HEADING_RE = re.compile(rf"^({'|'.join(MONTHS)}),? (\d{{4}})$")
# "-Alex Werner, FFG Game Rules Specialist – December 17, 2025", "-Alex – March 6, 2026".
SIGNATURE_RE = re.compile(rf"^-\s*Alex\b.*?[–—-]\s*(({'|'.join(MONTHS)}) (\d{{1,2}}), (\d{{4}}))\s*$")
# Ruling numbers the repo already cites that differ from "n-th ruling of that date, in page order". The earlier
# hand-made copy numbered the two February 20, 2026 rulings 3 and 4 (continuing February 8's), and code comments
# and specs cite "February 20, 2026 - Ruling 4" (Cruel Experiment), so those numbers are kept.
RULING_NUMBER_OFFSET = {"February 20, 2026": 2}

KEYWORDS = [
    "Acceleration", "Aerial", "Alliance", "Amplify", "Assault", "Boost", "Confuse", "Consequential",
    "Crisis", "Discount", "Guard", "Hazard", "Hinder", "Incite", "Indirect", "Linked", "Overkill",
    "Patrol", "Peril", "Permanent", "Piercing", "Quickstrike", "Ranged", "Requirement", "Restricted",
    "Retaliate", "Setup", "Stalwart", "Steady", "Stun", "Surge", "Team-Up", "Teamwork", "Tough",
    "Toughness", "Uses", "Victory", "Villainous", "Vulnerable",
]
# Names in the card pool that are also everyday words; skipped when listing cards a file covers.
CARD_NAME_STOPWORDS = {
    "Yes", "Back", "Shield", "Focus", "Defiance", "Escape", "Power", "Control", "Rescue", "Vision",
    "Storm", "Rogue", "Strength", "Attack", "Thwart", "Defense", "Defend", "Hero", "Villain",
    "Ready", "Weapon", "Armor", "Team", "Leader", "Training", "Support", "Resource", "Heroes",
    "Advance", "Energy", "Genius", "Emergency", "Mental", "Physical", "Wild",
}


@dataclass
class Section:
    title: str
    anchor: Optional[str]
    elements: List = field(default_factory=list)


@dataclass
class OutFile:
    page: Page
    number: int
    name: str
    title: str
    anchor: Optional[str]
    part: int
    parts: int
    body: str


# ---------------------------------------------------------------------------
# Fetch and extract
# ---------------------------------------------------------------------------


def fetch(url: str) -> str:
    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=60)
    resp.raise_for_status()
    # The pages declare UTF-8; decode strictly so mojibake fails loudly rather than landing in the repo.
    return resp.content.decode("utf-8")


def extract_entry(html_text: str) -> Tag:
    soup = BeautifulSoup(html_text, "html.parser")
    entries = soup.find_all("div", class_="entry-content")
    if len(entries) != 1:
        raise RuntimeError(f"expected exactly one entry-content div, found {len(entries)}")
    entry = entries[0]
    for c in entry.find_all(string=lambda s: isinstance(s, Comment)):
        c.extract()
    for t in entry.find_all(["script", "style", "noscript", "iframe", "form", "svg", "button"]):
        t.decompose()
    junk = re.compile(r"sharedaddy|sd-sharing|jp-relatedposts|wpcnt|wordads|code-block|addtoany|share")
    for t in entry.find_all(True):
        if t.decomposed:
            continue
        if any(junk.search(c) for c in t.get("class", [])):
            t.decompose()
    # "Back to top." links are in-page navigation, not ruling text.
    for p in entry.find_all("p"):
        if re.fullmatch(r"back to top\.?", p.get_text(" ", strip=True), flags=re.I):
            p.decompose()
    return entry


def top_level_elements(entry: Tag) -> List:
    out = []
    for child in entry.children:
        if isinstance(child, Tag):
            out.append(child)
        elif isinstance(child, NavigableString) and child.strip():
            out.append(child)
    return out


def split_sections(elements: List) -> List[Section]:
    """Front matter (resources + navigation) is section 0; then one section per top-level h2."""
    h2_idx = [i for i, el in enumerate(elements) if isinstance(el, Tag) and el.name == "h2"]
    nav = [i for i in h2_idx if elements[i].get_text(" ", strip=True).lower() == "navigation"]
    if nav:
        later = [i for i in h2_idx if i > nav[0]]
        start = later[0] if later else len(elements)
    else:
        start = h2_idx[0] if h2_idx else len(elements)
    sections = [Section(title="Front matter: reference links and navigation", anchor=None, elements=elements[:start])]
    for el in elements[start:]:
        if isinstance(el, Tag) and el.name == "h2":
            sections.append(Section(title=el.get_text(" ", strip=True), anchor=el.get("id"), elements=[el]))
        else:
            sections[-1].elements.append(el)
    return sections


# ---------------------------------------------------------------------------
# Markdown conversion
# ---------------------------------------------------------------------------


_CONVERTER = MarkdownConverter(heading_style="ATX", bullets="-", newline_style="backslash", escape_misc=False)


def normalize_md(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace(" ", " ")
    text = "\n".join(line.rstrip() for line in text.split("\n"))
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip("\n")


def element_md(el) -> str:
    if isinstance(el, NavigableString):
        return normalize_md(str(el).strip())
    return normalize_md(_CONVERTER.convert(str(el)))


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:60].rstrip("-") or "section"


def chunk_section(parts: List[tuple]) -> List[str]:
    """parts: (markdown, is_break_point). Split at ruling boundaries (quotes, rules, headings)."""
    chunks: List[List[str]] = [[]]
    size = 0
    for md, breakable in parts:
        if not md:
            continue
        n = len(md.encode("utf-8")) + 2
        if chunks[-1] and ((breakable and size >= TARGET_BYTES) or size + n > MAX_BYTES):
            chunks.append([])
            size = 0
        chunks[-1].append(md)
        size += n
    chunks = [c for c in chunks if c]
    # Fold a small last part back into the one before it when the result still fits.
    if len(chunks) > 1:
        tail = sum(len(m.encode("utf-8")) + 2 for m in chunks[-1])
        head = sum(len(m.encode("utf-8")) + 2 for m in chunks[-2])
        if tail < TARGET_BYTES // 4 and head + tail <= MAX_BYTES:
            chunks[-2].extend(chunks.pop())
    return ["\n\n".join(c) for c in chunks]


def build_files(page: Page, sections: List[Section]) -> List[OutFile]:
    # Anchor -> file name, so in-page "#anchor" links point at the right file.
    rendered = []
    for s in sections:
        parts = []
        for el in s.elements:
            breakable = isinstance(el, Tag) and el.name in ("blockquote", "hr", "h2", "h3", "h4")
            parts.append((el, breakable))
        rendered.append((s, parts))

    # Fold near-empty trailing sections (e.g. a one-line sign-off) into the previous section.
    merged: List[tuple] = []
    for s, parts in rendered:
        body = sum(len(element_md(el)) for el, _ in parts)
        if len(merged) > 1 and body < MIN_SECTION_BYTES:
            merged[-1][1].extend(parts)
        else:
            merged.append((s, list(parts)))

    names: Dict[str, str] = {}
    plan = []
    for number, (s, parts) in enumerate(merged):
        base = f"{number:02d}-{'front-matter' if number == 0 else slugify(s.title)}"
        plan.append((number, base, s, parts))
        for el, _ in parts:
            if isinstance(el, Tag):
                ids = [el.get("id")] + [t.get("id") for t in el.find_all(True)]
                for i in ids:
                    if i and i not in names:
                        names[i] = base

    out: List[OutFile] = []
    for number, base, s, parts in plan:
        md_parts = []
        for el, breakable in parts:
            if isinstance(el, Tag):
                for a in el.find_all("a", href=True):
                    href = a["href"]
                    if href.startswith("#") and href[1:] in names:
                        a["href"] = f"{names[href[1:]]}.md"
            md_parts.append((element_md(el), breakable))
        chunks = chunk_section(md_parts)
        for k, body in enumerate(chunks, start=1):
            name = base if len(chunks) == 1 else f"{base}-part-{k}"
            out.append(OutFile(page, number, name, s.title, s.anchor, k, len(chunks), body))
    # Point "#anchor" links at the first part of a split section.
    first_part = {f"{f.name.rsplit('-part-', 1)[0]}.md": f"{f.name}.md" for f in out if f.part == 1 and f.parts > 1}
    for f in out:
        for old, new in first_part.items():
            f.body = f.body.replace(f"]({old})", f"]({new})")
    return out


# ---------------------------------------------------------------------------
# Index helpers (deterministic: matched against the repo's card data and a fixed keyword list)
# ---------------------------------------------------------------------------


def load_card_names() -> List[str]:
    names = set()
    if CARD_DATA_DIR.is_dir():
        for p in sorted(CARD_DATA_DIR.glob("*.json")):
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            for card in data.get("cards", []):
                n = (card.get("name") or "").strip()
                if len(n) >= 4 and n not in CARD_NAME_STOPWORDS and n not in KEYWORDS:
                    names.add(n)
    return sorted(names, key=lambda n: (-len(n), n))


def plain_text(md: str) -> str:
    md = re.sub(r"\]\([^)]*\)", "]", md)
    md = md.replace("\\", "")
    return re.sub(r"[‘’]", "'", md)


def covered(md: str, card_re: Optional[re.Pattern], limit: int = 12) -> tuple:
    text = plain_text(md)
    cards: List[str] = []
    if card_re is not None:
        counts = Counter(m.group(0) for m in card_re.finditer(text))
        cards = [n for n, _ in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:limit]]
    kws = [k for k in KEYWORDS if re.search(rf"(?<![A-Za-z]){re.escape(k)}(?![A-Za-z])", text)]
    return cards, kws


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------


def authority_note(prefix: str) -> str:
    return (
        f"{prefix}**OLDER FFG rulings, tier 4 in CLAUDE.md's rules authority order:** valid only where consistent "
        "with RRG v1.8, superseded where v1.8 contradicts them; FFG calls contact-form answers preliminary until a "
        "Rules Reference update includes them."
    )


def file_header(f: OutFile, fetched: str) -> str:
    part = f" (part {f.part} of {f.parts})" if f.parts > 1 else ""
    src = f.page.url + (f"#{f.anchor}" if f.anchor else "")
    return "\n".join(
        [
            f"# {f.title}{part}",
            "",
            f"> **Source:** [Hall of Heroes: {f.page.title}]({src})  ",
            f"> **Fetched:** {fetched}. Transcribed by script from Hall of Heroes; Hall of Heroes is the transcriber, "
            "not the authority.  ",
            authority_note("> ") + "  ",
            f"> **Newer rulings:** [{NEWER_RULINGS_FILE}](../../../{NEWER_RULINGS_FILE}). "
            f"**Regenerate:** `uv run {SCRIPT_REL}` (do not edit by hand).",
            "",
            "---",
            "",
            "",
        ]
    )


def write_outputs(output_dir: Path, page_files: Dict[str, List[OutFile]], fetched: str) -> None:
    card_names = load_card_names()
    card_re = (
        re.compile(r"(?<![\w-])(?:" + "|".join(re.escape(n) for n in card_names) + r")(?![\w-])")
        if card_names
        else None
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    readme = [
        "# Older FFG rulings (Hall of Heroes transcriptions)",
        "",
        f"Generated by `{SCRIPT_REL}` on {fetched}; do not edit by hand. Regenerate with "
        f"`uv run {SCRIPT_REL}`.",
        "",
        authority_note(""),
        "",
        "Hall of Heroes is the transcriber, not the authority. The newer rulings (December 2025 onward, post-RRG 1.7 "
        f"and 1.8) are in [`{NEWER_RULINGS_FILE}`](../../{NEWER_RULINGS_FILE}) at the repo root; check them and "
        "RRG v1.8 before relying on anything here.",
        "",
        "**How to use this folder:** grep it by card name or keyword (`rg -l \"Energy Barrier\" docs/rulings`), "
        "then open only the matching file. Each file is one section of the source page (long sections are split "
        "into parts at ruling boundaries) and starts with a link to its source anchor.",
        "",
        "The card and keyword lists below are matched mechanically against the repo's card data and a fixed keyword "
        "list, so they are a search aid, not a complete list.",
        "",
        "## Newer rulings",
        "",
        f"- [`{NEWER_RULINGS_FILE}`](../../{NEWER_RULINGS_FILE}): post-RRG 1.7 and 1.8 rulings, December 17, 2025 "
        "through October 9, 2026 (tier 3 where issued after v1.8). Not part of this folder.",
        "",
    ]
    for page in PAGES:
        files = page_files.get(page.slug)
        if files is None:
            continue
        page_dir = output_dir / page.slug
        page_dir.mkdir(parents=True, exist_ok=True)
        for old in page_dir.glob("*.md"):
            old.unlink()
        index = [
            f"# {page.title}: index",
            "",
            f"> **Source:** [Hall of Heroes: {page.title}]({page.url})  ",
            f"> **Fetched:** {fetched}. Transcribed by script from Hall of Heroes; Hall of Heroes is the transcriber, "
            "not the authority.  ",
            authority_note("> ") + "  ",
            f"> **Regenerate:** `uv run {SCRIPT_REL}`.",
            "",
            page.coverage,
            "",
        ]
        readme += [f"## [{page.title}]({page.slug}/index.md)", "", page.coverage, ""]
        for f in files:
            text = file_header(f, fetched) + f.body + "\n"
            (page_dir / f"{f.name}.md").write_bytes(text.encode("utf-8"))
            cards, kws = covered(f.body, card_re)
            part = f" (part {f.part}/{f.parts})" if f.parts > 1 else ""
            desc = f"{f.title}{part}"
            extras = []
            if cards:
                extras.append("cards: " + ", ".join(cards))
            if kws:
                extras.append("keywords: " + ", ".join(kws))
            tail = f" ({'; '.join(extras)})" if extras else ""
            kb = len(text.encode("utf-8")) / 1024
            index.append(f"- [{f.name}.md]({f.name}.md): {desc}, {kb:.0f} KB{tail}")
            readme.append(f"- [{page.slug}/{f.name}.md]({page.slug}/{f.name}.md): {desc}{tail}")
        readme.append("")
        (page_dir / "index.md").write_bytes(("\n".join(index) + "\n").encode("utf-8"))
        print(f"[{page.slug}] wrote {len(files)} section file(s) + index.md to {page_dir.relative_to(REPO_ROOT)}")
    (output_dir / "README.md").write_bytes(("\n".join(readme).rstrip("\n") + "\n").encode("utf-8"))


# ---------------------------------------------------------------------------
# Newer rulings page (post-RRG 1.7) -> one repo-root file
# ---------------------------------------------------------------------------


@dataclass
class Ruling:
    date: dt.date
    label: str
    number: int
    elements: List
    note: Optional[str] = None

    @property
    def heading(self) -> str:
        return f"{self.label} - Ruling {self.number}"


def date_label(d: dt.date) -> str:
    return f"{MONTHS[d.month - 1]} {d.day}, {d.year}"


def gh_anchor(text: str) -> str:
    """GitHub's heading anchor: lowercase, punctuation dropped, each space a hyphen."""
    return re.sub(r"[^\w\- ]", "", text.strip().lower()).replace(" ", "-")


def flat_text(el) -> str:
    text = el.get_text(" ", strip=True) if isinstance(el, Tag) else str(el)
    return re.sub(r"\s+", " ", text.replace(" ", " ")).strip()


def md_escape(text: str) -> str:
    return re.sub(r"([\\`*_\[\]<>#|])", r"\\\1", text)


def inline_md(el: Tag) -> str:
    return re.sub(r"\s*\n\s*", " ", normalize_md(_CONVERTER.convert(el.decode_contents()))).strip()


def parse_newer(entry: Tag) -> tuple:
    """(front matter elements, rulings). A ruling is every element after the previous signature up to its own."""
    elements = top_level_elements(entry)
    starts = [
        i
        for i, el in enumerate(elements)
        if isinstance(el, Tag) and el.name == "h2" and MONTH_HEADING_RE.match(flat_text(el))
    ]
    if not starts:
        raise RuntimeError("no '<Month>, <Year>' heading found on the post-RRG 1.7 page")
    front, body = elements[: starts[0]], elements[starts[0] :]
    rulings: List[Ruling] = []
    counts: Counter = Counter()
    pending: List = []
    for el in body:
        if isinstance(el, Tag) and el.name == "h2":
            if not MONTH_HEADING_RE.match(flat_text(el)):
                raise RuntimeError(f"unexpected heading among the rulings: {flat_text(el)!r}")
            if pending:
                raise RuntimeError(f"ruling text with no signature before heading {flat_text(el)!r}")
            continue  # month headings are regenerated from the signature dates
        if isinstance(el, Tag) and (el.name == "hr" or (not flat_text(el) and not el.find("img"))):
            continue
        pending.append(el)
        m = SIGNATURE_RE.match(flat_text(el)) if isinstance(el, Tag) and el.name == "p" else None
        if not m:
            continue
        d = dt.date(int(m.group(4)), MONTHS.index(m.group(2)) + 1, int(m.group(3)))
        note = None
        prev = rulings[-1].date if rulings else None
        if prev and d < prev:
            # A year typo on a signature (the page has "February 20, 2025" between two February 2026 rulings):
            # date it by its place on the page, which is in date order, and say so.
            fixed = d.replace(year=prev.year)
            if fixed < prev:
                raise RuntimeError(f"signature date {m.group(1)!r} is out of order after {date_label(prev)}")
            note = (
                f'*Transcription note (script, not page text): the signature line below reads "{m.group(1)}"; '
                f"the page lists its rulings in date order and this one sits among the {MONTHS[fixed.month - 1]} "
                f"{fixed.year} rulings, so it is headed {date_label(fixed)}.*"
            )
            d = fixed
        label = date_label(d)
        counts[label] += 1
        rulings.append(Ruling(d, label, counts[label] + RULING_NUMBER_OFFSET.get(label, 0), pending, note))
        pending = []
    if pending:
        raise RuntimeError(f"text after the last signature: {flat_text(pending[0])[:80]!r}")
    return front, rulings


def front_matter_md(front: List) -> List[str]:
    """Intro paragraphs as written, then each navigation heading (and the line under it) as one list item."""
    out: List[str] = []
    item: Optional[str] = None
    for el in front:
        if not isinstance(el, Tag) or el.name == "hr" or not flat_text(el):
            continue
        if el.name == "h2":
            if item:
                out.append(item)
            item = f"- {inline_md(el)}"
        elif item is not None and el.name == "p":
            out.append(f"{item}: {inline_md(el)}")
            item = None
        else:
            out += [element_md(el), ""]
    if item:
        out.append(item)
    return out


def excerpt(el, limit: int = 110) -> str:
    text = flat_text(el)
    if len(text) > limit:
        text = text[:limit].rsplit(" ", 1)[0].rstrip(" ,;:") + " …"
    return md_escape(text)


def build_newer_markdown(entry: Tag, fetched: str) -> tuple:
    front, rulings = parse_newer(entry)
    first, last = date_label(rulings[0].date), date_label(rulings[-1].date)
    months: Dict[tuple, List[Ruling]] = {}
    for r in rulings:
        months.setdefault((r.date.year, r.date.month), []).append(r)
    lines = [
        "# Marvel Champions LCG: Latest FFG Rulings (Post-RRG 1.7 & 1.8)",
        "",
        f"> **Source:** [Hall of Heroes]({NEWER_PAGE.url})  ",
        f"> **Coverage:** Official FFG rulings from {first} through {last} (post-RRG 1.7 & 1.8), "
        f"{len(rulings)} rulings.  ",
        "> **Rulings Specialist:** Alex Werner, FFG Game Rules Specialist.  ",
        "> **Contact / Submissions:** `hallofheroescontact(at)gmail.com`  ",
        f"> **Regenerated:** {fetched}, by script from the live page. Each ruling's question and answer text is the "
        "page's own, converted to Markdown and not edited; Hall of Heroes is the transcriber, not the authority "
        "(CLAUDE.md, rules authority order).  ",
        "> **Headings:** each ruling is headed by the date on its signature line and numbered in page order within "
        "that date (the two February 20, 2026 rulings keep the numbers 3 and 4 that the repo already cites). Cite a "
        "ruling by its heading, e.g. \"January 17, 2026 - Ruling 3\".  ",
        f"> **Regenerate:** `uv run {SCRIPT_REL} --target newer` (do not edit by hand).",
        "",
        "---",
        "",
        "## Reference Guides & Resources",
        "",
        *front_matter_md(front),
        "",
        "---",
        "",
        "## Table of Contents",
        "",
    ]
    for (year, month), rs in months.items():
        title = f"{MONTHS[month - 1]}, {year}"
        lines.append(f"- [{title}](#{gh_anchor(title)})")
        for r in rs:
            lines.append(f"  - [{r.heading}](#{gh_anchor(r.heading)}): {excerpt(r.elements[0])}")
    lines += ["", "---", ""]
    for (year, month), rs in months.items():
        lines += [f"## {MONTHS[month - 1]}, {year}", ""]
        for r in rs:
            lines += [f"### {r.heading}", ""]
            if r.note:
                lines += [r.note, ""]
            lines += ["\n\n".join(md for md in (element_md(el) for el in r.elements) if md), "", "---", ""]
    text = "\n".join(lines).rstrip("\n").removesuffix("---").rstrip("\n") + "\n"
    return text, rulings


def main() -> None:
    parser = argparse.ArgumentParser(description="Transcribe Hall of Heroes' FFG rulings pages to Markdown")
    parser.add_argument(
        "--target",
        choices=["older", "newer", "all"],
        default="older",
        help=f"older: the older pages into docs/rulings (default); newer: the post-RRG 1.7 page into "
        f"{NEWER_RULINGS_FILE}; all: both",
    )
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR, help="default: docs/rulings")
    parser.add_argument("--html-dir", type=Path, default=None, help="also save each downloaded page as <slug>.html")
    parser.add_argument(
        "--from-html-dir", type=Path, default=None, help="read <slug>.html from this folder instead of fetching"
    )
    parser.add_argument("--fetch-date", default=None, help="date to print in headers (default: today, YYYY-MM-DD)")
    args = parser.parse_args()

    fetched = args.fetch_date or dt.date.today().isoformat()

    def load(page: Page) -> Tag:
        if args.from_html_dir:
            html_text = (args.from_html_dir / f"{page.slug}.html").read_bytes().decode("utf-8")
        else:
            print(f"[{page.slug}] fetching {page.url}")
            html_text = fetch(page.url)
            if args.html_dir:
                args.html_dir.mkdir(parents=True, exist_ok=True)
                (args.html_dir / f"{page.slug}.html").write_bytes(html_text.encode("utf-8"))
        return extract_entry(html_text)

    if args.target in ("older", "all"):
        page_files: Dict[str, List[OutFile]] = {}
        for page in PAGES:
            page_files[page.slug] = build_files(page, split_sections(top_level_elements(load(page))))
        write_outputs(args.output_dir.resolve(), page_files, fetched)
    if args.target in ("newer", "all"):
        text, rulings = build_newer_markdown(load(NEWER_PAGE), fetched)
        (REPO_ROOT / NEWER_RULINGS_FILE).write_bytes(text.encode("utf-8"))
        print(
            f"[{NEWER_PAGE.slug}] wrote {len(rulings)} rulings ({rulings[0].label} to {rulings[-1].label}) "
            f"to {NEWER_RULINGS_FILE}"
        )
    print("Done.")


if __name__ == "__main__":
    try:
        main()
    except (requests.RequestException, RuntimeError) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
