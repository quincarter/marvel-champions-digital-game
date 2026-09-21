/**
 * Black Panther/Shuri Hero Pack (Cycle 9) curation. Evidence abbreviations:
 * - "raw": the pack's own cached raw record (`packages/content/raw/marvelcdb/bp.json`).
 * - "card image": the printed card, viewed directly at `https://marvelcdb.com/bundles/cards/<code>.jpg`
 *   (verification only, no bytes stored — CLAUDE.md "Content & IP boundaries").
 *
 * Not to be confused with Core's own Black Panther (T'Challa) — this is the later (2025) Shuri hero pack, Cycle 9
 * per the Hall of Heroes card database navigation (https://hallofheroeslcg.com/browse/).
 *
 * **Parser fix landed alongside this pack, not curation-specific** (`parse-text.ts`, `normalize/player-cards.ts`):
 * the printed keyword "Linked (Card Title)." (RRG 1.8 p. 27, "cards with the linked keyword cannot be included in
 * a player's deck") was never recognized at all — it fell through as plain text, and a Linked card's missing
 * `deck_limit` failed the "must have a positive deck_limit" check with no exemption. Redemption (51036, "Linked
 * (Show of Empathy). Victory 0.") is this pack's example and the first Linked card this pipeline has ingested;
 * the fix is generic (any pack, any Linked card), not scoped to Black Panther.
 *
 * One curated correction: Redemption's printed dash cost, confirmed against the card image (no numbered cost
 * circle at top-left, just a horizontal dash — matches RRG 1.8 "Dash (Value)", p. 15, and a Linked card entering
 * play only "by the card title in the parentheses following the keyword" rather than being played from hand).
 */
import type { PackCuration } from "./types.ts";

export const BP_CURATION: PackCuration = {
  packCode: "bp",
  cycle: { id: "cycle9", name: "Cycle 9", order: 9 },
  pack: {
    name: "Black Panther/Shuri",
    releaseDate: "2025-05-02",
    releaseDateSource:
      'Hall of Heroes Black Panther/Shuri page (https://hallofheroeslcg.com/black-panther-shuri/): "Release date: May 2, 2025"',
  },
  outDir: "src/data/bp",
  exportPrefix: "BP",

  corrections: [
    {
      code: "51036",
      reason:
        'Redemption prints a dash cost (RRG 1.8 "Dash (Value)", p. 15) — it is a Linked card, brought into play by Show of Empathy rather than played from hand.',
      evidence:
        "raw (51036, no cost field at all); card image (marvelcdb.com/bundles/cards/51036.jpg, a dash where a cost circle would be)",
      specialCost: "dash",
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
