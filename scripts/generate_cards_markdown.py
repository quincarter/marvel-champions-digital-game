#!/usr/bin/env python3
"""
Marvel Champions Card Art & Metadata Parser -> AI-Ready Markdown Generator

Scans card art images in assets/card-art/bundles/cards, correlates them with
the cached MarvelCDB card records in packages/content/raw/marvelcdb/*.json,
extracts all stats, card types, deck numbers (e.g. 19/28), bottom-right logos
(boost icons, boost stars, set emblems, scheme icons), errata and reverse-side
text, and formats everything into structured, AI-optimized Markdown.

Source of truth: MarvelCDB is a community database, NOT an authority (see
CLAUDE.md). The generated documents say so in their own header, and this script
never invents a value the source does not carry -- a field MarvelCDB omits is
reported as "not recorded in this source", never as a confident zero.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

REPO_ROOT = Path(__file__).resolve().parent.parent

# Icon tokens MarvelCDB encodes as <span class="icon-NAME"></span>. Closed set, taken from the
# cache itself -- used both to render the token and to re-insert the space the markup swallows.
ICON_NAMES = (
    "star", "physical", "mental", "energy", "wild", "per_hero", "per_group",
    "crisis", "hazard", "acceleration", "amplify", "boost",
)
ICON_TOKEN_RE = re.compile(r"\[(" + "|".join(ICON_NAMES) + r")\]")

# Only real HTML tags are stripped. A catch-all `<[^>]+>` would also eat genuine card prose that
# happens to sit in angle brackets -- Echo's flavor text is literally "<Need help?>".
HTML_TAG_NAMES = ("b", "i", "em", "strong", "p", "br", "hr", "span", "u", "del", "sub", "sup", "div")

HTML_REPLACEMENTS = [
    (re.compile(r"<b>(.*?)</b>", re.IGNORECASE | re.DOTALL), r"**\1**"),
    (re.compile(r"<strong>(.*?)</strong>", re.IGNORECASE | re.DOTALL), r"**\1**"),
    (re.compile(r"<i>(.*?)</i>", re.IGNORECASE | re.DOTALL), r"*\1*"),
    (re.compile(r"<em>(.*?)</em>", re.IGNORECASE | re.DOTALL), r"*\1*"),
    (re.compile(r"<p>(.*?)</p>", re.IGNORECASE | re.DOTALL), r"\1\n\n"),
    (re.compile(r"<br\s*/?>", re.IGNORECASE), r"\n"),
    (re.compile(r"<hr\s*/?>", re.IGNORECASE), r"\n---\n"),
    (re.compile(r'<span class="icon-([a-zA-Z0-9_-]+)"[^>]*></span>', re.IGNORECASE), r"[\1]"),
    (re.compile(r"</?(?:" + "|".join(HTML_TAG_NAMES) + r")\b[^>]*>", re.IGNORECASE), ""),
]

def clean_text(text: Optional[str]) -> str:
    """Converts card HTML formatting to clean Markdown."""
    if not text:
        return ""
    result = text
    for pattern, repl in HTML_REPLACEMENTS:
        result = pattern.sub(repl, result)
    # The icon markup carries no whitespace of its own, so "star icon<span…>" collapses to
    # "star icon[star]". Restore the space on either side when a token is glued to a word.
    result = re.sub(r"(?<=[A-Za-z0-9])" + ICON_TOKEN_RE.pattern, r" [\1]", result)
    result = re.sub(ICON_TOKEN_RE.pattern + r"(?=[A-Za-z])", r"[\1] ", result)
    # MarvelCDB also writes some icons as literal tokens, occasionally glued to the word before
    # the parenthesis that holds them: "star icon([star])" for a card printed "star icon (*)".
    result = re.sub(r"(?<=[A-Za-z])\((?=" + ICON_TOKEN_RE.pattern + r"\))", " (", result)
    # Collapse multiple blank lines
    result = re.sub(r"\n{3,}", "\n\n", result).strip()
    return result


def is_encounter_card(card: Dict[str, Any]) -> bool:
    """True for cards that carry the bottom-right encounter furniture (boost area, set emblem)."""
    return (
        card.get("faction_code") in ("encounter", "campaign")
        or card.get("type_code") in (
            "villain", "minion", "treachery", "attachment",
            "main_scheme", "side_scheme", "environment", "obligation"
        )
    )


# Card types that never sit in the encounter deck as a boost card, so a missing boost value on one
# of them is expected rather than a gap in the source.
NON_BOOST_TYPES = ("main_scheme", "environment", "villain")


def boost_summary(card: Dict[str, Any]) -> Optional[str]:
    """
    One short phrase describing the boost area, shared by the detail entry and the Quick Index so
    the two views of the same card can never disagree. `None` means "nothing to say about it".

    MarvelCDB never stores `boost: 0`, so an absent value is genuinely ambiguous: it is 0 pips for
    a card whose boost area shows a star, and simply unrecorded otherwise. Reporting the second
    case as "0" would be this script inventing data the source does not have.
    """
    boost = card.get("boost")
    star = bool(card.get("boost_star"))
    if boost is not None:
        plural = "icon" if boost == 1 else "icons"
        return f"{boost} {plural} + star" if star else f"{boost} {plural}"
    if star:
        return "0 icons + star"
    if is_encounter_card(card) and card.get("type_code") not in NON_BOOST_TYPES:
        return "not recorded in this source"
    return None


class CardDatabase:
    """Loads and indexes all card data from raw MarvelCDB JSON caches."""

    def __init__(self, raw_dir: str, images_dir: str):
        self.raw_dir = Path(raw_dir)
        self.images_dir = Path(images_dir)
        self.cards_by_code: Dict[str, Dict[str, Any]] = {}
        self.cards_by_pack: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self.set_totals: Dict[Tuple[str, str], int] = {}
        self.pack_names: Dict[str, str] = {}
        self.images_cache: Dict[str, Dict[str, Any]] = {}

        self._load_images()
        self._load_cards()
        self._calculate_set_totals()

    def _load_images(self):
        """Indexes all images in the bundles directory."""
        if not self.images_dir.exists():
            print(f"Warning: images directory {self.images_dir} does not exist", file=sys.stderr)
            return

        for entry in os.scandir(self.images_dir):
            if entry.is_file() and entry.name.lower().endswith((".png", ".jpg", ".jpeg")):
                base_code = Path(entry.name).stem
                file_size = entry.stat().st_size

                # Paths are emitted relative to the repo root, not the working directory, so the
                # generated markdown reads the same however the script was invoked.
                self.images_cache[base_code] = {
                    "filename": entry.name,
                    "path": os.path.relpath(entry.path, REPO_ROOT),
                    "abs_path": entry.path,
                    "size_bytes": file_size,
                    "size_kb": round(file_size / 1024, 1),
                }

    def _load_cards(self):
        """Loads all raw JSON packs and indexes cards and linked cards."""
        json_files = sorted(glob.glob(str(self.raw_dir / "*.json")))
        if not json_files:
            print(f"Warning: No JSON files found in {self.raw_dir}", file=sys.stderr)
            return

        for jf in json_files:
            try:
                with open(jf, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception as e:
                print(f"Error reading {jf}: {e}", file=sys.stderr)
                continue

            pack_code = data.get("pack", Path(jf).stem)
            raw_cards = data.get("cards", []) if isinstance(data, dict) else data

            for card in raw_cards:
                if not isinstance(card, dict):
                    continue
                code = card.get("code")
                if not code:
                    continue

                if "pack_name" in card and card["pack_name"]:
                    self.pack_names[card.get("pack_code", pack_code)] = card["pack_name"]

                self.cards_by_code[code] = card
                self.cards_by_pack[card.get("pack_code", pack_code)].append(card)

                # Check linked card (e.g. Alter-Ego side, Scheme B-side). Indexed by pack too, so a
                # pack reachable only through a linked card still gets its own split file.
                linked = card.get("linked_card")
                if isinstance(linked, dict) and linked.get("code"):
                    l_code = linked["code"]
                    self.cards_by_code[l_code] = linked
                    self.cards_by_pack[linked.get("pack_code", card.get("pack_code", pack_code))].append(linked)

    def _calculate_set_totals(self):
        """Calculates total card count for each set (e.g., 28 in Red Skull, 15 in Spider-Man)."""
        set_max_positions: Dict[Tuple[str, str], int] = defaultdict(int)
        set_counts: Dict[Tuple[str, str], int] = defaultdict(int)

        for card in self.cards_by_code.values():
            set_code = card.get("card_set_code")
            pack_code = card.get("pack_code")
            if not set_code or not pack_code:
                continue

            key = (pack_code, set_code)
            set_pos = card.get("set_position")
            qty = card.get("quantity") or 1
            set_counts[key] += qty

            if set_pos is not None:
                end_pos = set_pos + qty - 1
                if end_pos > set_max_positions[key]:
                    set_max_positions[key] = end_pos

        for key, max_pos in set_max_positions.items():
            # Use max_pos if defined; otherwise fallback to count of cards in set
            self.set_totals[key] = max_pos if max_pos > 0 else set_counts[key]

    def get_image_info(self, code: str) -> Optional[Dict[str, Any]]:
        """Returns image metadata and dimensions if available."""
        info = self.images_cache.get(code)
        if not info:
            return None

        if "width" not in info and HAS_PIL:
            try:
                with Image.open(info["abs_path"]) as im:
                    info["width"], info["height"] = im.size
            except Exception:
                pass
        return info

    def format_deck_position(self, card: Dict[str, Any]) -> str:
        """Formats deck numbering (e.g. '19/28' or '19-20/28')."""
        set_name = card.get("card_set_name")
        set_code = card.get("card_set_code")
        pack_code = card.get("pack_code")
        set_pos = card.get("set_position")
        qty = card.get("quantity") or 1

        if not set_name and not set_code:
            # Aspect or basic card: use pack position
            pos = card.get("position")
            if pos is not None:
                return f"Pack Position: {pos}"
            return "Standalone / Unset"

        total = None
        if pack_code and set_code:
            total = self.set_totals.get((pack_code, set_code))

        if set_pos is None:
            # Identity or unnumbered card
            stage = card.get("stage")
            if stage:
                return f"{set_name} (Stage {stage})"
            card_type = card.get("type_code", "")
            if card_type in ("hero", "alter_ego"):
                return f"{set_name} (Identity Card)"
            return f"{set_name} (Set Card, unnumbered)"

        if total and total > 0:
            if qty > 1:
                end_pos = set_pos + qty - 1
                return f"{set_name} ({set_pos}–{end_pos}/{total}, Qty: {qty})"
            return f"{set_name} ({set_pos}/{total})"
        else:
            if qty > 1:
                return f"{set_name} (Card {set_pos}–{set_pos + qty - 1}, Qty: {qty})"
            return f"{set_name} (Card {set_pos})"

    @staticmethod
    def _scaling_suffix(card: Dict[str, Any], prefix: str) -> str:
        """' per group' / ' per hero' for a stat that scales with the number of players."""
        if card.get(f"{prefix}_per_group"):
            return " per group"
        if card.get(f"{prefix}_per_hero"):
            return " per hero"
        return ""

    @staticmethod
    def _threat_scaling_suffix(card: Dict[str, Any], prefix: str) -> str:
        """
        Threat stats invert the flag: MarvelCDB stores `<prefix>_fixed`, and *not* fixed means the
        printed value is per player. A separate `_per_group` flag beats both (it is a flat amount
        for the whole group, which is not the same thing as 'per hero').
        """
        if card.get(f"{prefix}_per_group"):
            return " per group"
        if not card.get(f"{prefix}_fixed"):
            return " per hero"
        return ""

    @staticmethod
    def _star(card: Dict[str, Any], prefix: str) -> str:
        """' [star]' when the printed value is a star (variable, governed by card text)."""
        return " [star]" if card.get(f"{prefix}_star") else ""

    def format_stats(self, card: Dict[str, Any]) -> List[str]:
        """Extracts and formats combat/scheme stats."""
        stats = []

        # Cost
        cost = card.get("cost")
        if cost is not None or card.get("cost_star"):
            cost_str = f"{cost}" if cost is not None else "X"
            cost_str += self._star(card, "cost")
            if card.get("cost_per_hero"):
                cost_str += " per hero"
            stats.append(f"**Cost**: {cost_str}")

        # Thwart (THW)
        thw = card.get("thwart")
        if thw is not None:
            thw_str = f"{thw}{self._star(card, 'thwart')}"
            if card.get("thwart_cost"):
                thw_str += f" (Consequential: {card['thwart_cost']})"
            stats.append(f"**THW**: {thw_str}")

        # Scheme (SCH)
        sch = card.get("scheme")
        if sch is not None:
            stats.append(f"**SCH**: {sch}{self._star(card, 'scheme')}")

        # Attack (ATK)
        atk = card.get("attack")
        if atk is not None:
            atk_str = f"{atk}{self._star(card, 'attack')}"
            if card.get("attack_cost"):
                atk_str += f" (Consequential: {card['attack_cost']})"
            stats.append(f"**ATK**: {atk_str}")

        # Defense (DEF)
        defense = card.get("defense")
        if defense is not None:
            def_str = f"{defense}{self._star(card, 'defense')}"
            if card.get("defense_cost"):
                def_str += f" (Consequential: {card['defense_cost']})"
            stats.append(f"**DEF**: {def_str}")

        # Recover (REC)
        rec = card.get("recover")
        if rec is not None:
            rec_str = f"{rec}{self._star(card, 'recover')}"
            if card.get("recover_cost"):
                rec_str += f" (Consequential: {card['recover_cost']})"
            stats.append(f"**REC**: {rec_str}")

        # Health (HP)
        hp = card.get("health")
        if hp is not None:
            hp_str = f"{hp}{self._scaling_suffix(card, 'health')}{self._star(card, 'health')}"
            stats.append(f"**HP**: {hp_str}")

        # Hand Size
        hand = card.get("hand_size")
        if hand is not None:
            stats.append(f"**Hand Size**: {hand}")

        # Scheme Threat Attributes
        base_threat = card.get("base_threat")
        if base_threat is not None:
            bt_str = f"{base_threat}{self._star(card, 'base_threat')}{self._threat_scaling_suffix(card, 'base_threat')}"
            stats.append(f"**Base Threat**: {bt_str}")

        threat = card.get("threat")
        if threat is not None:
            t_str = f"{threat}{self._star(card, 'threat')}{self._threat_scaling_suffix(card, 'threat')}"
            stats.append(f"**Target Threat**: {t_str}")

        esc = card.get("escalation_threat")
        if esc is not None:
            esc_str = f"{esc}{self._star(card, 'escalation_threat')}{self._threat_scaling_suffix(card, 'escalation_threat')}"
            stats.append(f"**Escalation Threat**: +{esc_str}/round")

        # Resources provided when spent
        resources = []
        for r_type in ("energy", "physical", "mental", "wild"):
            val = card.get(f"resource_{r_type}")
            if val:
                resources.extend([f"[{r_type}]"] * int(val))
        if resources:
            stats.append(f"**Resources**: {' '.join(resources)}")

        return stats

    def format_bottom_right_logos(self, card: Dict[str, Any]) -> List[str]:
        """
        Explains all icons found on the bottom-right corner of encounter/villain cards.
        Includes Boost Icons, Boost Stars, Set Icons, and Scheme Icons.
        """
        logos = []
        is_encounter = is_encounter_card(card)

        boost = card.get("boost")
        boost_star = bool(card.get("boost_star"))

        # 1. Boost Icons (Pips)
        if boost is not None:
            plural = "icon" if boost == 1 else "icons"
            logos.append(f"**Boost Icons**: {boost} {plural} (Adds +{boost} to Villain ATK/SCH during activation)")
        elif boost_star:
            logos.append("**Boost Icons**: 0 (the boost area shows a star instead of pips)")
        elif is_encounter and card.get("type_code") not in NON_BOOST_TYPES:
            logos.append(
                "**Boost Icons**: not recorded in this source "
                "(MarvelCDB omits the field; treat as unknown, not as 0)"
            )

        # 2. Boost Star. MarvelCDB has no separate field for the boost ability's text -- it is
        #    printed inline in the card's own rules text, below, prefixed **Boost:**.
        if boost_star:
            logos.append(
                "**Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)"
            )

        # 3. Encounter Set Emblem
        set_name = card.get("card_set_name")
        if set_name and is_encounter:
            logos.append(f"**Encounter Set Emblem**: {set_name} Set Icon (printed bottom-right next to deck number)")

        # 4. Scheme Icons (Crisis, Hazard, Acceleration, Amplify)
        scheme_icons = []
        if card.get("scheme_crisis"):
            scheme_icons.append("Crisis (`[crisis]`: Prevents threat removal from Main Scheme)")
        if card.get("scheme_hazard"):
            scheme_icons.append("Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)")
        if card.get("scheme_acceleration"):
            scheme_icons.append("Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)")
        if card.get("scheme_amplify"):
            scheme_icons.append("Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)")

        if scheme_icons:
            logos.append(f"**Scheme Icons**: {', '.join(scheme_icons)}")

        return logos

    @staticmethod
    def _italic(text: str) -> str:
        """
        Wraps flavor text in emphasis, unless `clean_text` already produced a fully emphasized
        string -- `<b><i>x</i></b>` becomes `***x***`, and wrapping that again yields `****x****`,
        which renders as neither bold nor italic.
        """
        stripped = text.strip()
        if stripped.startswith("*") and stripped.endswith("*"):
            return stripped
        return f"*{stripped}*"

    @staticmethod
    def _blockquote(text: str) -> str:
        """Indents a block of text as a blockquote nested inside the current list item."""
        return "\n".join(f"  > {line}" if line else "  >" for line in text.splitlines())

    def format_card_entry(self, card: Dict[str, Any]) -> str:
        """Formats a single card into a structured Markdown block."""
        code = card.get("code", "UNKNOWN")
        name = card.get("name", "Unnamed Card")
        subname = card.get("subname")
        type_name = card.get("type_name", "Unknown Type")
        pack_name = card.get("pack_name") or self.pack_names.get(card.get("pack_code", ""), "Unknown Pack")
        pack_code = card.get("pack_code", "")

        title_parts = [f"[{code}] {name}"]
        if subname:
            title_parts.append(f"*{subname}*")

        lines = [f"### {' — '.join(title_parts)}"]

        # Core Metadata
        lines.append(f"- **Type**: `{type_name}`")
        if card.get("faction_name"):
            lines.append(f"- **Faction / Aspect**: {card['faction_name']}")
        lines.append(f"- **Pack**: {pack_name} (`{pack_code}`)")

        # Deck position
        deck_str = self.format_deck_position(card)
        lines.append(f"- **Deck / Set**: {deck_str}")

        # Unique & Stage
        flags = []
        if card.get("is_unique"):
            flags.append("Unique")
        if card.get("stage"):
            flags.append(f"Stage {card['stage']}")
        if card.get("permanent"):
            flags.append("Permanent")
        if card.get("double_sided"):
            flags.append("Double-Sided")
        if flags:
            lines.append(f"- **Properties**: {', '.join(flags)}")

        # Combat & Resource Stats
        stats = self.format_stats(card)
        if stats:
            lines.append(f"- **Stats**: {', '.join(stats)}")

        # Bottom-Right Encounter Logos (Boost icons, set emblem, etc.)
        logos = self.format_bottom_right_logos(card)
        if logos:
            lines.append("- **Bottom-Right Encounter Logos**:")
            for logo in logos:
                lines.append(f"  - {logo}")

        # Traits
        traits = card.get("real_traits") or card.get("traits")
        if traits:
            lines.append(f"- **Traits**: *{traits.strip()}*")

        # Rules Text
        rules_text = clean_text(card.get("real_text") or card.get("text"))
        if rules_text:
            lines.append("- **Rules Text**:")
            lines.append(self._blockquote(rules_text))

        # Errata. FFG has changed this card's printed text; the rules engine follows the errata,
        # not the printed wording above (CLAUDE.md: the RRG/FAQ/errata are the authorities).
        errata = clean_text(card.get("errata"))
        if errata:
            lines.append("- **Errata (FFG)**:")
            lines.append(self._blockquote(errata))

        # Reverse side of a double-sided card (scheme backs, villain stage backs, setup text).
        back_name = card.get("back_name")
        back_text = clean_text(card.get("back_text"))
        back_flavor = clean_text(card.get("back_flavor"))
        if back_name or back_text or back_flavor:
            lines.append(f"- **Reverse Side**{f': {back_name}' if back_name else ''}")
            if back_text:
                lines.append(self._blockquote(back_text))
            if back_flavor:
                lines.append(f"  - **Back Flavor**: {self._italic(back_flavor)}")

        # Flavor Text
        flavor = clean_text(card.get("flavor"))
        if flavor:
            lines.append(f"- **Flavor**: {self._italic(flavor)}")

        # Image File Reference
        img_info = self.get_image_info(code)
        if img_info:
            dims = f"{img_info['width']}×{img_info['height']} px" if "width" in img_info else "scanned"
            lines.append(f"- **Image Asset**: `{img_info['path']}` ({dims}, {img_info['size_kb']} KB)")

        lines.extend(["", ""])  # blank line between entries
        return "\n".join(lines)


SUMMARY_CARD_CAP = 500


def generate_markdown(
    db: CardDatabase,
    output_path: Path,
    pack_filter: Optional[str] = None,
    set_filter: Optional[str] = None,
    type_filter: Optional[str] = None,
    include_summary: bool = True
) -> None:
    """Generates the main Markdown reference document."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Filter cards. `position` can be present-but-null, so `or 0` rather than a dict default --
    # otherwise sorted() compares None against int and raises.
    filtered_cards = []
    for code, card in sorted(
        db.cards_by_code.items(),
        key=lambda item: (item[1].get("pack_code") or "", item[1].get("position") or 0, item[0]),
    ):
        if pack_filter and card.get("pack_code") != pack_filter:
            continue
        if set_filter and card.get("card_set_code") != set_filter:
            continue
        if type_filter and card.get("type_code") != type_filter:
            continue
        filtered_cards.append(card)

    print(f"Generating markdown for {len(filtered_cards)} cards -> {output_path}")

    with open(output_path, "w", encoding="utf-8") as out:
        # Header & Documentation
        out.write("# Marvel Champions Card Reference Database\n\n")
        out.write(
            "A complete, generated transcription of the cached MarvelCDB card records in "
            "`packages/content/raw/marvelcdb/`, formatted for AI and rules-engine consumption. "
            "Regenerate with `scripts/generate_cards_markdown.py`; do not hand-edit.\n\n"
            "**This document is not authoritative.** MarvelCDB is a community database. The "
            "authorities on how a card behaves are the Rules Reference Guide "
            "(`mc_rulesreference_v18_compressed.pdf`), FFG's rulings and errata "
            "(`marvel-champions-rulings-post-rrg-1-7.md`), and the structured card data in "
            "`@mc/content`. Where this file and any of those disagree, they win and this file is "
            "wrong. Use it to read printed text quickly, not to settle a rules question.\n\n"
            "Fields absent from the source are reported as \"not recorded in this source\" rather "
            "than guessed at, so a missing value is never silently rendered as a zero.\n\n"
        )

        # Explain Game Mechanics & Card Logos
        out.write("## Rules & Symbol Legend\n\n")
        out.write("### 1. Bottom-Right Encounter Logos\n")
        out.write(
            "- **Boost Icons (Pips)**: In the lower-right corner of Villain, Minion, Treachery, and Attachment cards, "
            "there are triangular boost icons (0 to 4). When the card is flipped face-down as a Boost Card during a "
            "Villain attack or scheme activation, each boost icon adds +1 to the Villain's ATK or SCH.\n"
            "- **Boost Star (`[star]`)**: An icon in the boost area indicating that drawing this card triggers a special "
            "**Boost** ability, printed inline in that card's own rules text. A star is not itself a boost icon "
            "(RRG 1.8, \"Boost\"), so a starred card can also carry 0 or more pips.\n"
            "- **Encounter Set Logo**: An emblem printed on the bottom margin next to the deck number indicating which "
            "modular set or villain deck the card belongs to (e.g. Rhino horn, Red Skull emblem, Bomb Scare bomb, Standard shield).\n"
            "- **Scheme Icons**: Main Schemes and Side Schemes feature board-wide status icons:\n"
            "  - `[crisis]`: Prevents players from removing threat from the Main Scheme.\n"
            "  - `[hazard]`: Deals +1 additional encounter card during the Villain Phase.\n"
            "  - `[acceleration]`: Adds +1 threat to the Main Scheme at the start of each round.\n"
            "  - `[amplify]`: Adds +1 boost pip to boost cards drawn during activation.\n\n"
        )

        out.write("### 2. Deck Numbering (e.g. `19/28`)\n")
        out.write(
            "- Cards in fixed sets (Hero signature decks, Villain encounter decks, Modular sets, Nemesis sets) "
            "feature a printed sequence fraction `X/Y`.\n"
            "- `X` is the card position in that specific set, and `Y` is the total number of cards in that set.\n"
            "- Example: `19/28` in the Red Skull encounter deck represents card 19 of the 28 cards in Red Skull's deck "
            "(specifically *Spreading Lies*).\n"
            "- Hero kits feature 15 signature cards numbered `1/15` through `15/15`.\n\n"
        )

        out.write("### 3. Combat Stats & Icon Tokens\n")
        out.write(
            "- **THW**: Thwart value (removes threat from schemes).\n"
            "- **SCH**: Scheme value (villain/minion adds threat to schemes).\n"
            "- **ATK**: Attack value (deals damage to targets).\n"
            "- **DEF**: Defense value (reduces incoming villain/minion damage).\n"
            "- **REC**: Recover value (Alter-Ego heals HP).\n"
            "- **HP**: Hit Points (health pool; may be fixed, *per hero*, or *per group*).\n"
            "- **`[star]`**: Asterisk/Star indicating a dynamic or variable stat governed by card text.\n"
            "- **`[mental]` / `[physical]` / `[energy]` / `[wild]`**: Resource icons used to pay card costs.\n"
            "- **Consequential**: the damage or threat a hero takes for using that stat on an ally.\n\n"
        )

        # Quick Summary Table (if enabled)
        if include_summary:
            if len(filtered_cards) > SUMMARY_CARD_CAP:
                out.write(
                    f"## Quick Index\n\n_Omitted: {len(filtered_cards)} cards exceeds the "
                    f"{SUMMARY_CARD_CAP}-row cap for this table. Use the per-pack files in "
                    "`docs/cards/by_pack/`, or re-run with `--pack <code>`._\n\n---\n\n"
                )
            else:
                out.write("## Quick Index\n\n")
                out.write("| Code | Name | Type | Deck / Set | Stats | Boost | Pack |\n")
                out.write("|---|---|---|---|---|---|---|\n")
                for c in filtered_cards:
                    code = c.get("code", "")
                    name = c.get("name", "")
                    ctype = c.get("type_name", "")
                    deck = db.format_deck_position(c).split("(")[0].strip()
                    stats = []
                    if c.get("thwart") is not None: stats.append(f"THW:{c['thwart']}")
                    if c.get("scheme") is not None: stats.append(f"SCH:{c['scheme']}")
                    if c.get("attack") is not None: stats.append(f"ATK:{c['attack']}")
                    if c.get("defense") is not None: stats.append(f"DEF:{c['defense']}")
                    if c.get("recover") is not None: stats.append(f"REC:{c['recover']}")
                    if c.get("health") is not None: stats.append(f"HP:{c['health']}")
                    stat_str = " ".join(stats) if stats else "-"
                    b_str = boost_summary(c) or "-"
                    pack = c.get("pack_code", "")
                    out.write(f"| `{code}` | {name} | {ctype} | {deck} | {stat_str} | {b_str} | `{pack}` |\n")
                out.write("\n---\n\n")

        # Group cards by Pack and Set
        by_pack: Dict[str, Dict[str, List[Dict[str, Any]]]] = defaultdict(lambda: defaultdict(list))
        for c in filtered_cards:
            p_code = c.get("pack_code", "misc")
            s_name = c.get("card_set_name") or c.get("faction_name") or "General"
            by_pack[p_code][s_name].append(c)

        for p_code, sets in by_pack.items():
            pack_title = db.pack_names.get(p_code, p_code.upper())
            out.write(f"## Pack: {pack_title} (`{p_code}`)\n\n")

            for s_name, cards in sets.items():
                out.write(f"### Set: {s_name}\n\n")
                for card in cards:
                    out.write(db.format_card_entry(card))
                out.write("\n")

    print(f"Successfully generated {output_path} ({os.path.getsize(output_path) / 1024 / 1024:.2f} MB)")


def main():
    parser = argparse.ArgumentParser(description="Parse Marvel Champions card art and metadata into AI-ready Markdown")
    parser.add_argument("--output", "-o", default="docs/cards_reference.md", help="Output markdown path")
    parser.add_argument("--raw-dir", default="packages/content/raw/marvelcdb", help="Raw JSON cache directory")
    parser.add_argument("--images-dir", default="assets/card-art/bundles/cards", help="Card images directory")
    parser.add_argument("--pack", help="Filter by pack code (e.g. 'core', 'trors', 'next_evol')")
    parser.add_argument("--set", dest="set_code", help="Filter by card set code (e.g. 'red_skull', 'spider_man')")
    parser.add_argument("--type", dest="type_code", help="Filter by card type (e.g. 'hero', 'villain', 'treachery')")
    parser.add_argument("--split-dir", help="Directory to output split markdown files by pack (e.g. 'docs/cards/by_pack')")
    parser.add_argument(
        "--summary", action=argparse.BooleanOptionalAction, default=True,
        help=f"Include the summary index table (omitted above {SUMMARY_CARD_CAP} cards). Applies to every file written.",
    )

    args = parser.parse_args()

    # Resolve paths relative to repo root
    raw_dir = REPO_ROOT / args.raw_dir
    images_dir = REPO_ROOT / args.images_dir
    output_path = REPO_ROOT / args.output

    print(f"Loading Marvel Champions Card Database from {raw_dir}...")
    db = CardDatabase(str(raw_dir), str(images_dir))
    print(f"Loaded {len(db.cards_by_code)} cards and indexed {len(db.images_cache)} images.")

    # Generate single master markdown or filtered markdown
    generate_markdown(
        db=db,
        output_path=output_path,
        pack_filter=args.pack,
        set_filter=args.set_code,
        type_filter=args.type_code,
        include_summary=args.summary
    )

    # Optional: Generate split pack files if requested
    if args.split_dir:
        split_dir = REPO_ROOT / args.split_dir
        split_dir.mkdir(parents=True, exist_ok=True)
        print(f"Exporting individual pack files to {split_dir}...")

        packs = sorted(db.cards_by_pack.keys())
        for p_code in packs:
            p_out = split_dir / f"{p_code}.md"
            generate_markdown(
                db=db,
                output_path=p_out,
                pack_filter=p_code,
                include_summary=args.summary
            )
        print(f"Exported {len(packs)} pack files to {split_dir}")

if __name__ == "__main__":
    main()
