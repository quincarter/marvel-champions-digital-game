#!/usr/bin/env python3
"""
Marvel Champions Card Art & Metadata Parser -> AI-Ready Markdown Generator

Scans card art images in assets/card-art/bundles/cards, correlates them with
the authoritative card database in packages/content/raw/marvelcdb/*.json,
extracts all stats, card types, deck numbers (e.g. 19/28), bottom-right logos
(boost icons, boost stars, set emblems, scheme icons), and formats everything
into structured, AI-optimized Markdown.
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

# HTML tags to clean up or convert to Markdown
HTML_REPLACEMENTS = [
    (re.compile(r"<b>(.*?)</b>", re.IGNORECASE | re.DOTALL), r"**\1**"),
    (re.compile(r"<strong>(.*?)</strong>", re.IGNORECASE | re.DOTALL), r"**\1**"),
    (re.compile(r"<i>(.*?)</i>", re.IGNORECASE | re.DOTALL), r"*\1*"),
    (re.compile(r"<em>(.*?)</em>", re.IGNORECASE | re.DOTALL), r"*\1*"),
    (re.compile(r"<p>(.*?)</p>", re.IGNORECASE | re.DOTALL), r"\1\n\n"),
    (re.compile(r"<br\s*/?>", re.IGNORECASE), r"\n"),
    (re.compile(r"<hr\s*/?>", re.IGNORECASE), r"\n---\n"),
    (re.compile(r'<span class="icon-([a-zA-Z0-9_-]+)"[^>]*></span>', re.IGNORECASE), r"[\1]"),
    (re.compile(r"<[^>]+>"), ""),  # strip remaining tags
]

def clean_text(text: Optional[str]) -> str:
    """Converts card HTML formatting to clean Markdown."""
    if not text:
        return ""
    result = text
    for pattern, repl in HTML_REPLACEMENTS:
        result = pattern.sub(repl, result)
    # Collapse multiple blank lines
    result = re.sub(r"\n{3,}", "\n\n", result).strip()
    return result

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
                
                # We store metadata for the image
                self.images_cache[base_code] = {
                    "filename": entry.name,
                    "path": os.path.relpath(entry.path),
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

                # Check linked card (e.g. Alter-Ego side, Scheme B-side)
                linked = card.get("linked_card")
                if isinstance(linked, dict) and linked.get("code"):
                    l_code = linked["code"]
                    self.cards_by_code[l_code] = linked

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
                with Image.open(info["path"]) as im:
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

    def format_stats(self, card: Dict[str, Any]) -> List[str]:
        """Extracts and formats combat/scheme stats."""
        stats = []

        # Cost
        cost = card.get("cost")
        if cost is not None:
            cost_str = f"{cost}"
            if card.get("cost_per_hero"):
                cost_str += " per hero"
            stats.append(f"**Cost**: {cost_str}")

        # Thwart (THW)
        thw = card.get("thwart")
        if thw is not None:
            thw_str = f"{thw}"
            if card.get("thwart_star"):
                thw_str += " [star]"
            if card.get("thwart_cost"):
                thw_str += f" (Consequential: {card['thwart_cost']})"
            stats.append(f"**THW**: {thw_str}")

        # Scheme (SCH)
        sch = card.get("scheme")
        if sch is not None:
            sch_str = f"{sch}"
            if card.get("scheme_star"):
                sch_str += " [star]"
            stats.append(f"**SCH**: {sch_str}")

        # Attack (ATK)
        atk = card.get("attack")
        if atk is not None:
            atk_str = f"{atk}"
            if card.get("attack_star"):
                atk_str += " [star]"
            if card.get("attack_cost"):
                atk_str += f" (Consequential: {card['attack_cost']})"
            stats.append(f"**ATK**: {atk_str}")

        # Defense (DEF)
        defense = card.get("defense")
        if defense is not None:
            def_str = f"{defense}"
            if card.get("defense_star"):
                def_str += " [star]"
            if card.get("defense_cost"):
                def_str += f" (Consequential: {card['defense_cost']})"
            stats.append(f"**DEF**: {def_str}")

        # Recover (REC)
        rec = card.get("recover")
        if rec is not None:
            rec_str = f"{rec}"
            if card.get("recover_star"):
                rec_str += " [star]"
            stats.append(f"**REC**: {rec_str}")

        # Health (HP)
        hp = card.get("health")
        if hp is not None:
            hp_str = f"{hp}"
            if card.get("health_per_hero"):
                hp_str += " per hero"
            if card.get("health_star"):
                hp_str += " [star]"
            stats.append(f"**HP**: {hp_str}")

        # Hand Size
        hand = card.get("hand_size")
        if hand is not None:
            stats.append(f"**Hand Size**: {hand}")

        # Scheme Threat Attributes
        base_threat = card.get("base_threat")
        if base_threat is not None:
            bt_str = f"{base_threat}"
            if card.get("base_threat_per_group") or not card.get("base_threat_fixed"):
                bt_str += " per hero"
            stats.append(f"**Base Threat**: {bt_str}")

        threat = card.get("threat")
        if threat is not None:
            t_str = f"{threat}"
            if card.get("threat_per_group") or not card.get("threat_fixed"):
                t_str += " per hero"
            stats.append(f"**Target Threat**: {t_str}")

        esc = card.get("escalation_threat")
        if esc is not None:
            esc_str = f"{esc}"
            if not card.get("escalation_threat_fixed"):
                esc_str += " per hero"
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
        is_encounter = (
            card.get("faction_code") in ("encounter", "campaign")
            or card.get("type_code") in (
                "villain", "minion", "treachery", "attachment",
                "main_scheme", "side_scheme", "environment", "obligation"
            )
        )

        boost = card.get("boost")
        boost_star = card.get("boost_star", False)
        boost_text = card.get("boost_text")

        # 1. Boost Icons (Pips)
        if boost is not None:
            plural = "icon" if boost == 1 else "icons"
            logos.append(f"**Boost Icons**: {boost} {plural} (Adds +{boost} to Villain ATK/SCH during activation)")
        elif is_encounter and card.get("type_code") not in ("main_scheme", "side_scheme", "environment", "villain"):
            logos.append("**Boost Icons**: None (0)")

        # 2. Boost Star & Ability Text
        if boost_star or boost_text:
            logos.append("**Boost Star**: Yes (`[star]` icon triggers special Boost Ability)")
            if boost_text:
                logos.append(f"**Boost Ability Text**: {clean_text(boost_text)}")

        # 3. Encounter Set Emblem
        set_name = card.get("card_set_name")
        if set_name and is_encounter:
            logos.append(f"**Encounter Set Emblem**: {set_name} Set Icon (printed bottom-right next to deck number)")

        # 4. Scheme Icons (Crisis, Hazard, Acceleration, Amplify)
        scheme_icons = []
        if card.get("scheme_crisis"):
            scheme_icons.append(f"Crisis (`[crisis]`: Prevents threat removal from Main Scheme)")
        if card.get("scheme_hazard"):
            scheme_icons.append(f"Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)")
        if card.get("scheme_acceleration"):
            scheme_icons.append(f"Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)")
        if card.get("scheme_amplify"):
            scheme_icons.append(f"Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)")

        if scheme_icons:
            logos.append(f"**Scheme Icons**: {', '.join(scheme_icons)}")

        return logos

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
            # Indent text into blockquote
            bq_text = "\n".join(f"  > {line}" if line else "  >" for line in rules_text.splitlines())
            lines.append(bq_text)

        # Flavor Text
        flavor = card.get("flavor")
        if flavor:
            lines.append(f"- **Flavor**: *{flavor.strip()}*")

        # Image File Reference
        img_info = self.get_image_info(code)
        if img_info:
            dims = f"{img_info['width']}×{img_info['height']} px" if "width" in img_info else "scanned"
            lines.append(f"- **Image Asset**: `{img_info['path']}` ({dims}, {img_info['size_kb']} KB)")

        lines.append("")  # blank line separator
        return "\n".join(lines)


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

    # Filter cards
    filtered_cards = []
    for code, card in sorted(db.cards_by_code.items(), key=lambda item: (item[1].get("pack_code", ""), item[1].get("position", 0), item[0])):
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
            "This document is an authoritative, complete card database generated directly from the "
            "game card assets and metadata. It is formatted specifically for AI and rules engine consumption.\n\n"
        )
        
        # Explain Game Mechanics & Card Logos
        out.write("## Rules & Symbol Legend\n\n")
        out.write("### 1. Bottom-Right Encounter Logos\n")
        out.write(
            "- **Boost Icons (Pips)**: In the lower-right corner of Villain, Minion, Treachery, and Attachment cards, "
            "there are triangular boost icons (0 to 4). When the card is flipped face-down as a Boost Card during a "
            "Villain attack or scheme activation, each boost icon adds +1 to the Villain's ATK or SCH.\n"
            "- **Boost Star (`[star]`)**: An icon in the boost area indicating that drawing this card triggers a special "
            "**Boost Ability** printed in the card's text box.\n"
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
            "- **HP**: Hit Points (health pool; may be fixed or multiplied *per hero*).\n"
            "- **`[star]`**: Asterisk/Star indicating a dynamic or variable stat governed by card text.\n"
            "- **`[mental]` / `[physical]` / `[energy]` / `[wild]`**: Resource icons used to pay card costs.\n\n"
        )

        # Quick Summary Table (if enabled)
        if include_summary and len(filtered_cards) <= 500:
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
                if c.get("health") is not None: stats.append(f"HP:{c['health']}")
                stat_str = " ".join(stats) if stats else "-"
                boost = c.get("boost")
                b_str = f"{boost} pips" if boost is not None else ("Star" if c.get("boost_star") else "-")
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
    parser.add_argument("--summary", action="store_true", help="Include summary index table at the top")

    args = parser.parse_args()

    # Resolve paths relative to repo root
    repo_root = Path(__file__).resolve().parent.parent
    raw_dir = repo_root / args.raw_dir
    images_dir = repo_root / args.images_dir
    output_path = repo_root / args.output

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
        split_dir = repo_root / args.split_dir
        split_dir.mkdir(parents=True, exist_ok=True)
        print(f"Exporting individual pack files to {split_dir}...")
        
        packs = sorted(db.cards_by_pack.keys())
        for p_code in packs:
            p_out = split_dir / f"{p_code}.md"
            generate_markdown(
                db=db,
                output_path=p_out,
                pack_filter=p_code,
                include_summary=True
            )
        print(f"Exported {len(packs)} pack files to {split_dir}")

if __name__ == "__main__":
    main()
