/**
 * Lookups into Core's raw MarvelCDB cache that other packs' normalization needs.
 *
 * Read from the raw Core cache directly (not the generated `src/data/core` module): those generated files use `.js`
 * specifiers meant for the TypeScript/bundler build, which this script's Node type-stripping runtime does not resolve.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { RawCard } from "../raw-types.ts";

/** Core artwork by `"<type_code> <name>"`, for reprints that carry no image of their own (see `reprintImages` in art.ts). */
export const CORE_ART_BY_NAME = new Map<string, string>();

/**
 * Encounter set codes that exist only in Core's own raw cache, for scenarios in *other* packs that reuse Core's
 * shared Standard/Expert sets rather than shipping their own copies (docs/phase7-wave1.md §2.2 — the Green Goblin
 * insert: "include no modular encounter sets for an easier challenge or multiple sets for a greater challenge",
 * recommending "Standard" and "Expert" by name; the Green Goblin pack's own raw cache carries no `standard`/
 * `expert` card_set_code at all, confirmed against `raw/marvelcdb/gob.json` — the physical Scenario Pack does not
 * reprint those cards). A scenario naming one of these codes is referencing Core's already-emitted `EncounterSet`
 * record (same `EncounterSetId`), not asking this pack to define a new one — verified against Core's actual raw
 * card_set_code values, not a blind allowlist, so a genuine typo still fails the normal per-pack check.
 */
export const CORE_ENCOUNTER_SET_CODES = new Set<string>();

try {
  const coreRawPath = fileURLToPath(new URL("../../../raw/marvelcdb/core.json", import.meta.url));
  const coreRaw = JSON.parse(readFileSync(coreRawPath, "utf8")) as { cards: RawCard[] };
  for (const c of coreRaw.cards) {
    if (c.imagesrc) CORE_ART_BY_NAME.set(`${c.type_code} ${c.name}`, c.imagesrc);
    if (c.linked_card?.imagesrc) CORE_ART_BY_NAME.set(`${c.linked_card.type_code} ${c.linked_card.name}`, c.linked_card.imagesrc);
    if (c.faction_code === "encounter" && c.type_code !== "obligation" && c.card_set_code) {
      CORE_ENCOUNTER_SET_CODES.add(c.card_set_code);
    }
  }
} catch {
  // No Core raw cache available (e.g. a unit test constructing its own fixtures) — reprint art and cross-pack
  // encounter set references simply won't resolve.
}
