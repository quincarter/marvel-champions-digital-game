/**
 * The reprint map the importer resolves MarvelCDB reprint codes through (`from-marvelcdb-json.ts`'s use of
 * `CATALOG_REPRINTS`, `../data/catalog.ts`). This module owns no data of its own — `catalog.ts` is generated from
 * the cached MarvelCDB packs by `scripts/generate-catalog.ts`, and `catalog.test.ts` already checks it isn't stale
 * — this file only checks the map is actually *usable* for import: every reprint's target either resolves in the
 * app's own card pool, or is named here as a known gap and why.
 */
import { describe, expect, it } from "vitest";
import { CATALOG_REPRINTS } from "../data/catalog.js";
import { DATA_ONLY_CARDS, PLAYABLE_CARDS } from "../data/index.js";
import { SM_CARDS } from "../data/sm/cards.js";

/**
 * Every card id the importer's pool lookup (`indexById`) could realistically be given: the playable pool plus the
 * data-only pool (PLAN.md Phase 7's "every pack becomes card data" cycles), plus Sinister Motives (`SM_CARDS`) —
 * ingested but not yet folded into `DATA_ONLY_CARDS`/`PLAYABLE_CARDS` as of wave 5's in-progress scripting
 * (`data/index.ts`'s own comment on the `sm` export). A real caller would pass a narrower pool (e.g. `SM_CARDS`
 * alone), so this union is deliberately generous: it is only used to ask "does this reprint's target exist
 * *anywhere* in ingested data", not "does every pool contain it".
 */
const KNOWN_IDS = new Set<string>([...PLAYABLE_CARDS, ...DATA_ONLY_CARDS, ...SM_CARDS].map((card) => String(card.id)));

/**
 * Printed-code prefixes (a pack's first two catalog-code digits) whose card data has no normalized
 * `<pack>/cards.ts` under `packages/content/src/data/` at all yet — later cycles this pipeline hasn't reached —
 * so a reprint whose *original* card carries one of these prefixes cannot resolve no matter which in-app pool the
 * importer is given: there is no card data for it yet, ingested or not. Verified directly (not guessed): every
 * prefix here has zero `cardId("<prefix>...")` occurrences anywhere under `packages/content/src/data/`. Drop a
 * prefix from this set once its pack is ingested.
 */
const NOT_YET_INGESTED_ORIGINAL_PREFIXES: ReadonlySet<string> = new Set([
  "32",
  "34",
  "35",
  "36",
  "37",
  "38",
  "40",
  "41",
  "44",
  "48",
  "50",
  "51",
  "54",
  "56",
  "57",
  "59",
  "60",
  "61",
  "62",
]);

describe("CATALOG_REPRINTS is usable for import", () => {
  it("every reprint's target resolves in the app's own ingested card pool, or is a named, explained gap", () => {
    const missing = Object.entries(CATALOG_REPRINTS)
      .filter(([, original]) => !KNOWN_IDS.has(original))
      .filter(([, original]) => ![...NOT_YET_INGESTED_ORIGINAL_PREFIXES].some((prefix) => original.startsWith(prefix)));
    expect(missing).toEqual([]);
  });
});
