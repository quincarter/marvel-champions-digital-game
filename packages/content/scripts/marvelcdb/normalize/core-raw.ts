/**
 * Lookups into other packs' raw MarvelCDB caches that a pack's own normalization needs.
 *
 * Read from the raw caches directly (not the generated `src/data/<pack>` modules): those generated files use `.js`
 * specifiers meant for the TypeScript/bundler build, which this script's Node type-stripping runtime does not resolve.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { RawCard } from "../raw-types.ts";

/**
 * Cross-pack artwork by `"<type_code> <name>"`, for a reprint that carries no image of its own (see `reprintImages`
 * in art.ts) — a card reprinted verbatim in a later pack (the "basic"/pool cards — Energy, Genius, Strength,
 * Avengers Mansion, Helicarrier — a hero pack re-listing a Core ally/event/resource under its own MarvelCDB code
 * such as `cap`'s Hawkeye (03012), or a later cycle reprinting a wave 1 card such as `trors`' Avengers Tower
 * (04021, `duplicate_of_code: "03024"`, first printed in `cap`) — gets no `imagesrc` of its own on MarvelCDB: the
 * physical card was never re-photographed, since it is the same printing. Rather than fail ingestion on "no
 * artwork reference", such a card's art resolves to its *first* printing's, matched by exact printed name and
 * MarvelCDB type_code (which is how MarvelCDB itself groups reprints — its own `duplicated_by` field is
 * unreliable/empty for these records, verified against the raw caches).
 *
 * Built once, at import time, from every raw pack cache under `raw/marvelcdb/`, in `PRIORITY_ORDER` (Core, then
 * each wave 1 pack in its release order) followed by every other cached pack in whatever order `readdirSync`
 * returns them — a name+type pair is only ever recorded from the *first* pack that supplies it (`??=`-style: an
 * existing entry is never overwritten), so a pack later in the scan can never shadow an earlier "first printing".
 * `PRIORITY_ORDER` only needs to be correct where two different real printings of the same name+type both carry
 * art of their own (a true redesign, not a reprint) — every wave 1/wave 2 case checked so far is a reprint with no
 * art of its own, so this has not come up, but a future cycle should extend `PRIORITY_ORDER` if it does.
 */
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
 *
 * Deliberately Core-only (unlike `CORE_ART_BY_NAME` above): widening this to every pack would change what counts
 * as a *legitimate* cross-pack reference rather than just filling in an image, which is a bigger claim than this
 * survey pass makes for any wave 2 pack.
 */
export const CORE_ENCOUNTER_SET_CODES = new Set<string>();

/** Release order for packs where two genuinely different printings of the same name+type could both carry art. */
const PRIORITY_ORDER = ["core", "cap", "msm", "thor", "bkw", "drs", "hlk", "gob", "twc"];

function recordArt(cards: readonly RawCard[]): void {
  for (const c of cards) {
    const key = `${c.type_code} ${c.name}`;
    if (c.imagesrc && !CORE_ART_BY_NAME.has(key)) CORE_ART_BY_NAME.set(key, c.imagesrc);
    if (c.linked_card) {
      const linkedKey = `${c.linked_card.type_code} ${c.linked_card.name}`;
      if (c.linked_card.imagesrc && !CORE_ART_BY_NAME.has(linkedKey)) CORE_ART_BY_NAME.set(linkedKey, c.linked_card.imagesrc);
    }
  }
}

try {
  const rawDir = fileURLToPath(new URL("../../../raw/marvelcdb/", import.meta.url));
  const allPacks = readdirSync(rawDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length));
  const ordered = [...PRIORITY_ORDER.filter((p) => allPacks.includes(p)), ...allPacks.filter((p) => !PRIORITY_ORDER.includes(p)).sort()];
  for (const pack of ordered) {
    const raw = JSON.parse(readFileSync(`${rawDir}${pack}.json`, "utf8")) as { cards: RawCard[] };
    recordArt(raw.cards);
    if (pack === "core") {
      for (const c of raw.cards) {
        if (c.faction_code === "encounter" && c.type_code !== "obligation" && c.card_set_code) CORE_ENCOUNTER_SET_CODES.add(c.card_set_code);
      }
    }
  }
} catch {
  // No raw cache directory available (e.g. a unit test constructing its own fixtures) — reprint art and cross-pack
  // encounter set references simply won't resolve.
}
