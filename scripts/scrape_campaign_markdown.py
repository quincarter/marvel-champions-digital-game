#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "pymupdf4llm>=0.0.17",
#     "pymupdf>=1.24.0",
# ]
# ///
"""
Marvel Champions Campaign Modes PDF -> AI-Ready Markdown Scraper

Extracts and cleans all campaign expansion rulebooks and log sheets in
docs/campaign-modes, replacing proprietary FFG font glyphs with canonical
game tokens ([per_hero], [physical], [energy], etc.), stripping template
artifacts, structuring multi-column rules, and producing AI-optimized Markdown.
"""

from __future__ import annotations

import argparse
import html
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pymupdf
import pymupdf4llm

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT_DIR = REPO_ROOT / "docs" / "campaign-modes"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "docs" / "campaign-modes" / "markdown"

# Canonical token mapping for FFG Private Use Area (PUA) font glyphs (0xF500..0xF5FF)
PUA_ICON_MAP: Dict[str, str] = {
    "\uf524": "[per_hero]",
    "\uf525": "[physical]",
    "\uf526": "[energy]",
    "\uf527": "[mental]",
    "\uf528": "[wild]",
    "\uf520": "[boost]",
    "\uf521": "[star]",
    "\uf522": "[consequential]",
    "\uf531": "[unique]",
    "\uf52e": "[crisis]",
    "\uf530": "[acceleration]",
    "\uf52f": "[hazard]",
    "\uf52c": "[amplify]",
    "\uf52b": "[hazard]",
    "\uf52d": "• ",  # Action/Trigger bullet
    "\uf532": "[per_group]",
}


@dataclass
class CampaignMetadata:
    code: str
    title: str
    rulebook_pdf: str
    heroes: List[str]
    scenarios: List[str]
    log_sheet_pdf: Optional[str] = None
    output_filename: str = ""
    description: str = ""
    aliases: List[str] = field(default_factory=list)


CAMPAIGNS: List[CampaignMetadata] = [
    CampaignMetadata(
        code="MC10",
        title="The Rise of Red Skull",
        rulebook_pdf="mc10_the_rise_of_red_skull_rules_web.pdf",
        heroes=["Hawkeye (Clint Barton)", "Spider-Woman (Jessica Drew)"],
        scenarios=[
            "Scenario #1: Crossbones",
            "Scenario #2: Absorbing Man",
            "Scenario #3: Taskmaster",
            "Scenario #4: Zola",
            "Scenario #5: Red Skull",
        ],
        log_sheet_pdf="mc10_the_rise_of_red_skull_campaign-log.pdf",
        output_filename="mc10_the_rise_of_red_skull.md",
        description="Hydra's bid for world conquest featuring experimental weapon upgrades, delay counters, and rescued allies.",
        aliases=["rise-of-red-skull.pdf"],
    ),
    CampaignMetadata(
        code="MC16",
        title="The Galaxy's Most Wanted",
        rulebook_pdf="mc16_galaxys_most_wanted_rules_website-compressed.pdf",
        heroes=["Groot", "Rocket Raccoon"],
        scenarios=[
            "Scenario #1: Brotherhood of Badoon (Drang)",
            "Scenario #2: Infiltrate the Museum (Collector 1)",
            "Scenario #3: Escape the Museum (Collector 2)",
            "Scenario #4: Nebula",
            "Scenario #5: Ronan the Accuser",
        ],
        log_sheet_pdf="mc16_galaxys_most_wanted_campaignlog_website-compressed.pdf",
        output_filename="mc16_galaxys_most_wanted.md",
        description="Cosmic race for the Power Stone featuring the Badoon Ship, Market cards, unit tokens, and the Milano.",
    ),
    CampaignMetadata(
        code="MC21",
        title="The Mad Titan's Shadow",
        rulebook_pdf="mc21_the_mad_titans_shadow_rulebook-compressed.pdf",
        heroes=["Adam Warlock", "Spectrum (Monica Rambeau)"],
        scenarios=[
            "Scenario #1: Ebony Maw",
            "Scenario #2: Tower Defense (Proxima Midnight & Corvus Glaive)",
            "Scenario #3: Thanos",
            "Scenario #4: Hela",
            "Scenario #5: Loki",
        ],
        log_sheet_pdf="mc21_the_mad_titans_shadow_rulebook-compressed-campaign_log.pdf",
        output_filename="mc21_the_mad_titans_shadow.md",
        description="Thanos and the Black Order seeking the Infinity Gauntlet, featuring dual-villain battles, Odin's favor, and the Infinity Gauntlet deck.",
    ),
    CampaignMetadata(
        code="MC27",
        title="Sinister Motives",
        rulebook_pdf="mc27_sinister_motives_rules_v5-compressed.pdf",
        heroes=["Ghost-Spider (Gwen Stacy)", "Spider-Man (Miles Morales)"],
        scenarios=[
            "Scenario #1: Sandman",
            "Scenario #2: Venom",
            "Scenario #3: Mysterio",
            "Scenario #4: The Sinister Six",
            "Scenario #5: Venom Goblin",
        ],
        log_sheet_pdf="mc27_sinister_motives_campaignlog.pdf",
        output_filename="mc27_sinister_motives.md",
        description="Spider-Man rogue gallery street and symbiotic war featuring S.H.I.E.L.D. Tech, Symbiote Suits, and a Reputation Track.",
    ),
    CampaignMetadata(
        code="MC32",
        title="Mutant Genesis",
        rulebook_pdf="mc32_mutant_genesis_rulebook_v5-compressed.pdf",
        heroes=["Colossus (Piotr Rasputin)", "Shadowcat (Kitty Pryde)"],
        scenarios=[
            "Scenario #1: Sabretooth",
            "Scenario #2: Project Wideawake (Sentinels)",
            "Scenario #3: Master Mold",
            "Scenario #4: Mansion Attack (Brotherhood of Mutants)",
            "Scenario #5: Magneto",
        ],
        log_sheet_pdf="mc32_mutant_genesis_campaign_log.pdf",
        output_filename="mc32_mutant_genesis.md",
        description="X-Men battles for mutant survival featuring Sentinels, Operation Zero Tolerance, and role cards.",
    ),
    CampaignMetadata(
        code="MC40",
        title="NeXt Evolution",
        rulebook_pdf="mc40_next_evolution_rulebook-web.pdf",
        heroes=["Cable (Nathan Summers)", "Domino (Neena Thurman)"],
        scenarios=[
            "Scenario #1: Morlock Siege (Marauders)",
            "Scenario #2: On the Run (Marauders)",
            "Scenario #3: Juggernaut",
            "Scenario #4: Mister Sinister",
            "Scenario #5: Stryfe",
        ],
        log_sheet_pdf="mc40_next_evolution_campaign_log-compressed.pdf",
        output_filename="mc40_next_evolution.md",
        description="X-Force protecting Hope Summers featuring Player Side Schemes, Morlock rescue tracking, and Hope Summers ally mechanics.",
    ),
    CampaignMetadata(
        code="MC45",
        title="Age of Apocalypse",
        rulebook_pdf="mc45_age_of_apocalypse_rulebook.pdf",
        heroes=["Bishop (Lucas Bishop)", "Magik (Illyana Rasputina)"],
        scenarios=[
            "Scenario #1: Unus the Untouchable",
            "Scenario #2: Four Horsemen",
            "Scenario #3: Apocalypse",
            "Scenario #4: Dark Beast",
            "Scenario #5: En Sabah Nur",
        ],
        log_sheet_pdf="mc45_age_of_apocalypse_campaign_log.pdf",
        output_filename="mc45_age_of_apocalypse.md",
        description="Alternate dystopian timeline battle against Apocalypse featuring Overseer minions, mission side schemes, and mutant upgrades.",
    ),
    CampaignMetadata(
        code="MC50",
        title="Agents of S.H.I.E.L.D.",
        rulebook_pdf="mc50_rulebook-web.pdf",
        heroes=["Maria Hill", "Nick Fury"],
        scenarios=[
            "Scenario #1: Black Widow",
            "Scenario #2: Batroc",
            "Scenario #3: M.O.D.O.K.",
            "Scenario #4: Thunderbolts (Citizen V)",
            "Scenario #5: Baron Zemo",
        ],
        log_sheet_pdf="mc50_agents_of_shield_campaign_log.pdf",
        output_filename="mc50_agents_of_shield.md",
        description="S.H.I.E.L.D. espionage campaign featuring Infiltration cards, captive rescue, and clandestine operations.",
    ),
    CampaignMetadata(
        code="MC56",
        title="Civil War",
        rulebook_pdf="mc56_rulebook-web_1.pdf",
        heroes=["Tigra", "Hulkling"],
        scenarios=[
            "Custom Scenario: Superhero Registration Conflict",
            "Leader Scenarios: Pro-Registration & Anti-Registration",
        ],
        log_sheet_pdf=None,
        output_filename="mc56_civil_war.md",
        description="Civil War scenario expansion introducing Leader characters in place of standard villains and custom scenario building.",
    ),
    CampaignMetadata(
        code="MC60",
        title="Fear No Evil",
        rulebook_pdf="mc60_rulebook-web.pdf",
        heroes=["Daredevil", "Echo"],
        scenarios=[
            "Scenario: Protection Racket",
            "Scenario: The Raft Breakout",
            "Scenario: Art Museum Heist",
            "Scenario: The Getaway",
            "Scenario: Stop the Presses!",
            "Scenario: Kingpin (Mastermind)",
        ],
        log_sheet_pdf="mc60_campaign_log.pdf",
        output_filename="mc60_fear_no_evil.md",
        description="New York City street-level crime wave featuring interchangeable modular villains (Bullseye, Electro, etc.) and Kingpin as the ultimate mastermind.",
    ),
]


def clean_markdown_content(text: str) -> str:
    """Normalize FFG font glyphs, remove template artifacts, and polish markdown."""
    # 1. Replace known PUA font glyphs with canonical tokens
    for pua_char, token in PUA_ICON_MAP.items():
        text = text.replace(pua_char, token)

    # 2. Catch any remaining unmapped PUA unicode chars (0xE000 - 0xF8FF)
    def pua_fallback(match: re.Match) -> str:
        codepoint = ord(match.group(0))
        return f"[icon:U+{codepoint:04X}]"

    text = re.sub(r"[\uE000-\uF8FF]", pua_fallback, text)

    # 3. Strip repeated background InDesign template headers
    # E.g. "N e w W o r l d H y d r a" stamped from Rise of Red Skull template
    text = re.sub(r"(?im)^\s*N\s*e\s*w\s*[Ww]\s*o\s*r\s*l\s*d\s*H\s*y\s*d\s*r\s*a\s*$", "", text)
    text = re.sub(r"N\s*e\s*w\s*[Ww]\s*o\s*r\s*l\s*d\s*H\s*y\s*d\s*r\s*a", "", text)

    # 4. Clean up drop-caps and <mark> styling from PDF conversion
    # E.g. "<mark>p</mark> layer" -> "player", "<mark>P</mark> layer" -> "Player"
    text = re.sub(r"<mark>([A-Za-z])</mark>\s*([A-Za-z]+)", r"\1\2", text)
    text = re.sub(r"<mark>([A-Za-z])</mark>", r"\1", text)
    text = re.sub(r"</?mark>", "", text)

    # 5. Fix spurious strikethrough markdown caused by decorative header underline lines
    # E.g. "~~CAMPAIGN LOG~~" -> "CAMPAIGN LOG"
    text = re.sub(r"~~([A-Za-z0-9 _'’–—#-]{3,})~~", r"\1", text)

    # 6. Format picture text callouts cleanly
    def format_picture_callout(match: re.Match) -> str:
        content = match.group(1).strip()
        if not content:
            return ""
        # Convert <br> to newlines
        content = re.sub(r"<br\s*/?>", "\n", content)
        content = html.unescape(content)
        lines = [line.strip() for line in content.splitlines() if line.strip()]
        if not lines:
            return ""
        quote_lines = ["\n> [!NOTE] Card / Graphic Callout"]
        for line in lines:
            quote_lines.append(f"> {line}")
        return "\n" + "\n".join(quote_lines) + "\n"

    text = re.sub(
        r"<!--\s*Start of picture text\s*-->([\s\S]*?)<!--\s*End of picture text\s*-->",
        format_picture_callout,
        text,
    )

    # 7. Clean up orphan page number markers at line boundaries (e.g. "**_2_**" or standalone digits)
    text = re.sub(r"(?m)^\s*\*\*_\d+_\*\*\s*$", "", text)

    # 8. Clean up multiple consecutive empty lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def extract_page_title(page_text: str, page_num: int) -> str:
    """Infer a concise, meaningful section title from the page text."""
    lines = [line.strip() for line in page_text.splitlines() if line.strip()]
    for line in lines:
        # Check for markdown headers
        h_match = re.match(r"^#+\s*(?:\*\*_?)?([^*_#]+?)(?:_?\*\*)?$", line)
        if h_match:
            candidate = h_match.group(1).strip()
            if len(candidate) > 3 and not candidate.isdigit() and "CALLOUT" not in candidate.upper():
                return candidate
        # Check for scenario headers
        if "SCENARIO #" in line.upper() or "SCENARIO:" in line.upper():
            clean_line = re.sub(r"[*_#]", "", line).strip()
            return clean_line
        # Check for common major section titles
        for key in (
            "CAMPAIGN MODE RULES",
            "CONTENT OVERVIEW",
            "COMPONENTS",
            "CUSTOM SCENARIO",
            "FEATURED TERMS",
            "INTERCHANGEABLE",
            "STARTER DECKS",
            "CAMPAIGN INSTRUCTIONS",
        ):
            if key in line.upper():
                clean_line = re.sub(r"[*_#]", "", line).strip()
                return clean_line

    if page_num == 1:
        return "Cover & Title"
    return f"Page {page_num} Rules"


def process_campaign(
    campaign: CampaignMetadata,
    input_dir: Path,
    output_dir: Path,
    include_logs: bool = True,
    verbose: bool = False,
) -> Path:
    """Process a single campaign PDF and generate its AI-ready Markdown file."""
    pdf_path = input_dir / campaign.rulebook_pdf
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    print(f"[{campaign.code}] Processing {campaign.title} ({campaign.rulebook_pdf})...")

    doc = pymupdf.open(pdf_path)
    total_pages = len(doc)

    # Convert page-by-page to markdown using pymupdf4llm
    page_chunks = pymupdf4llm.to_markdown(str(pdf_path), page_chunks=True)

    cleaned_pages: List[Tuple[int, str, str]] = []
    toc_entries: List[Tuple[int, str, str]] = []

    for i, chunk in enumerate(page_chunks):
        page_num = i + 1
        raw_text = chunk.get("text", "")
        cleaned_text = clean_markdown_content(raw_text)
        title = extract_page_title(cleaned_text, page_num)
        anchor = f"page-{page_num}"
        toc_entries.append((page_num, title, anchor))
        cleaned_pages.append((page_num, title, cleaned_text))

    # Process Campaign Log Sheet if present
    log_sheet_text: Optional[str] = None
    if include_logs and campaign.log_sheet_pdf:
        log_pdf_path = input_dir / "log-sheets" / campaign.log_sheet_pdf
        if log_pdf_path.exists():
            if verbose:
                print(f"  -> Extracting campaign log sheet: {campaign.log_sheet_pdf}")
            raw_log = pymupdf4llm.to_markdown(str(log_pdf_path))
            log_sheet_text = clean_markdown_content(raw_log)
        else:
            if verbose:
                print(f"  -> Log sheet PDF not found: {log_pdf_path}")

    # Build AI-ready document
    lines: List[str] = [
        f"# {campaign.title} ({campaign.code}) — Campaign Rules & Scenarios",
        "",
        "> [!IMPORTANT]",
        f"> **Expansion:** {campaign.title} ({campaign.code})  ",
        f"> **Source Document:** `{campaign.rulebook_pdf}` ({total_pages} pages)  ",
        f"> **Included Heroes:** {', '.join(campaign.heroes)}  ",
        f"> **Campaign Summary:** {campaign.description}",
        "",
        "## Scenarios in this Expansion",
    ]

    for scenario in campaign.scenarios:
        lines.append(f"- **{scenario}**")

    lines.extend([
        "",
        "## Table of Contents",
    ])

    for page_num, title, anchor in toc_entries:
        lines.append(f"- [Page {page_num}: {title}](#{anchor})")

    if log_sheet_text:
        lines.append("- [Campaign Log Sheet Reference](#campaign-log-sheet-reference)")

    lines.extend(["", "---", ""])

    # Append pages
    for page_num, title, page_body in cleaned_pages:
        anchor = f"page-{page_num}"
        lines.extend([
            f'<a id="{anchor}"></a>',
            f"## Page {page_num}: {title}",
            f"*Source: {campaign.rulebook_pdf} (Page {page_num} of {total_pages})*",
            "",
        ])
        if page_body:
            lines.append(page_body)
        else:
            lines.append("*(Full-page graphic / illustration — no text on this page)*")
        lines.extend(["", "---", ""])

    # Append Campaign Log Reference if available
    if log_sheet_text:
        lines.extend([
            '<a id="campaign-log-sheet-reference"></a>',
            "# Campaign Log Sheet Reference",
            f"> **Source Log Sheet:** `{campaign.log_sheet_pdf}`  ",
            "> This reference details the campaign log fields, tracks, and record-keeping items used between scenarios.",
            "",
            log_sheet_text,
            "",
            "---",
            "",
        ])

    output_file = output_dir / campaign.output_filename
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file.write_text("\n".join(lines), encoding="utf-8")
    print(f"  -> Wrote {output_file.stat().st_size:,} bytes to {output_file.relative_to(REPO_ROOT)}")

    return output_file


def generate_master_index(campaigns: List[CampaignMetadata], output_dir: Path) -> Path:
    """Generate index.md summarizing all campaigns and linking to their markdown docs."""
    lines: List[str] = [
        "# Marvel Champions: Campaign Modes Reference Directory",
        "",
        "This directory contains AI-optimized, structured Markdown conversions of every official",
        "Marvel Champions campaign expansion rulebook and campaign log sheet.",
        "",
        "## Standard Icon Token Key",
        "All Private Use Area font glyphs from the original FFG PDFs have been normalized to canonical game tokens:",
        "",
        "| Token | Meaning | Context Example |",
        "|---|---|---|",
        "| `[per_hero]` | Value multiplied by number of heroes | `Hit Points: 12[per_hero]` |",
        "| `[physical]` | Physical resource icon | `Spend a [physical] resource` |",
        "| `[energy]` | Energy resource icon | `Spend an [energy] resource` |",
        "| `[mental]` | Mental resource icon | `Spend a [mental] resource` |",
        "| `[wild]` | Wild resource icon | `Spend a [wild] resource` |",
        "| `[boost]` | Boost icon on encounter card | `Boost: [boost][boost]` |",
        "| `[star]` | Star / Boost ability icon | `[star] Boost: Give the villain a tough card` |",
        "| `[consequential]` | Consequential damage icon on allies | `[consequential] THW 2, [consequential] ATK 2` |",
        "| `[unique]` | Unique character indicator | `[unique] Black Widow` |",
        "| `[crisis]` | Crisis icon on side schemes | Scheme prevents threat removal from main scheme |",
        "| `[acceleration]` | Acceleration icon | Adds 1 additional threat per round |",
        "| `[hazard]` | Hazard icon | Deals 1 additional encounter card during villain phase |",
        "| `[amplify]` | Amplify icon | Increases boost icon count by 1 |",
        "",
        "## Campaign Expansions Index",
        "",
        "| Code | Expansion Title | Heroes | Scenarios | Document |",
        "|---|---|---|---|---|",
    ]

    for c in campaigns:
        heroes_str = ", ".join(c.heroes)
        scenario_count = len(c.scenarios)
        link = f"[{c.title}](./{c.output_filename})"
        lines.append(f"| **{c.code}** | {c.title} | {heroes_str} | {scenario_count} scenarios | {link} |")

    lines.extend([
        "",
        "## Campaign Details & Mechanics",
        "",
    ])

    for c in campaigns:
        lines.extend([
            f"### [{c.title} ({c.code})](./{c.output_filename})",
            f"- **Heroes Included:** {', '.join(c.heroes)}",
            f"- **Rulebook File:** `{c.rulebook_pdf}`",
            f"- **Campaign Log File:** `{c.log_sheet_pdf or 'Integrated in rulebook'}`",
            f"- **Summary:** {c.description}",
            "- **Scenarios:**",
        ])
        for s in c.scenarios:
            lines.append(f"  - {s}")
        lines.append("")

    index_path = output_dir / "index.md"
    index_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"[Master Index] Wrote directory index to {index_path.relative_to(REPO_ROOT)}")
    return index_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scrape Marvel Champions campaign mode PDFs into AI-ready Markdown"
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=DEFAULT_INPUT_DIR,
        help=f"Path to directory containing campaign PDFs (default: {DEFAULT_INPUT_DIR})",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Path to output directory (default: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--single",
        type=str,
        default=None,
        help="Process a single campaign by code (e.g. MC10) or PDF filename",
    )
    parser.add_argument(
        "--no-logs",
        action="store_true",
        help="Skip extracting and embedding campaign log sheets",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose output",
    )

    args = parser.parse_args()

    input_dir = args.input_dir.resolve()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    campaigns_to_process: List[CampaignMetadata] = []
    if args.single:
        target = args.single.strip().lower()
        for c in CAMPAIGNS:
            if (
                c.code.lower() == target
                or c.rulebook_pdf.lower() == target
                or c.output_filename.lower() == target
                or any(alias.lower() == target for alias in c.aliases)
            ):
                campaigns_to_process.append(c)
                break
        if not campaigns_to_process:
            print(f"Error: No campaign matching '{args.single}' found.", file=sys.stderr)
            sys.exit(1)
    else:
        campaigns_to_process = CAMPAIGNS

    print(f"Starting campaign PDF scrape: {len(campaigns_to_process)} campaign(s)")
    print(f"  Input dir:  {input_dir}")
    print(f"  Output dir: {output_dir}\n")

    for c in campaigns_to_process:
        try:
            process_campaign(
                campaign=c,
                input_dir=input_dir,
                output_dir=output_dir,
                include_logs=not args.no_logs,
                verbose=args.verbose,
            )
        except Exception as e:
            print(f"Error processing {c.code} ({c.title}): {e}", file=sys.stderr)
            if args.verbose:
                import traceback
                traceback.print_exc()

    # Generate master index if processing all or when requested
    generate_master_index(CAMPAIGNS, output_dir)
    print("\n✓ Scraping and AI-ready Markdown generation completed successfully!")


if __name__ == "__main__":
    main()
