/**
 * Phoenix (Jean Grey) Hero Pack (Cycle 6) curation.
 *
 * One hand correction: Phoenix Force (34002a/34002b) prints a dash cost — it is a "Permanent" identity upgrade
 * that enters play via Jean Grey's own hero-kit text, not paid for from hand. MarvelCDB gives it `cost: null`
 * on both faces. Confirmed printed dash from the card's own MarvelCDB listing ("Cost: —"), the same evidence
 * standard used for trors' Hydra Campaign upgrades (docs/phase7-wave2.md §1.3/§5.1's `specialCost` mechanism).
 *
 * Burning Hunger (34002's obligation, 34028) has no `text`/`real_text` at all in MarvelCDB's raw record, so its
 * text is supplied from the card scan `assets/card-art/bundles/cards/34028.png` through the `find: ""` form of
 * `textReplace` (the Nova "Bring the War!" precedent; no new Correction field was needed).
 *
 * **Starter deck and scenario data not curated this pass** — this pass emits the pack's cards only (data-only
 * pool, PLAN.md Phase 7 "All other packs become card data"); precon curation is a follow-up.
 */
import type { PackCuration } from "./types.ts";

export const PHOENIX_CURATION: PackCuration = {
  packCode: "phoenix",
  cycle: { id: "cycle6", name: "Cycle 6", order: 6 },
  pack: {
    name: "Phoenix",
    releaseDate: "2022-09-30",
    releaseDateSource:
      'Hall of Heroes Jean Grey/Phoenix page (https://hallofheroeslcg.com/jean-grey-phoenix/): "Release date: September 30, 2022"',
  },
  outDir: "src/data/phoenix",
  exportPrefix: "PHOENIX",

  corrections: [
    {
      code: "34002a",
      reason:
        'Phoenix Force is a "Permanent" upgrade that enters play through Jean Grey\'s own hero-kit text (Setup/flip, not played from hand): raw sends no `cost` at all on either face (34002a/34002b) — the printed-dash pattern (RRG 1.8 "Dash (Value)", p. 15), not a data gap.',
      evidence: 'MarvelCDB card listing (marvelcdb.com/card/34002a), "Cost: —"',
      specialCost: "dash",
    },
    {
      code: "34028",
      reason:
        "MarvelCDB's raw record for Burning Hunger has no `text` or `real_text` field at all — transcribed verbatim from the card scan. The flavour line is italic on the card, kept as the first line.",
      evidence:
        "Card scan assets/card-art/bundles/cards/34028.png (Phoenix 28, Obligation), read 2026-10-01; UNLEASHED and RESTRAINED are bold-italic trait names on the scan.",
      textReplace: {
        find: "",
        replace:
          "Give to the Jean Grey player.\nWhen Revealed: If you have the UNLEASHED trait, search the encounter deck, discard pile, and set-aside area for Dark Phoenix and reveal her. Then, remove Burning Hunger from the game. If you have the RESTRAINED trait, remove 1 power counter from Phoenix Force and this card gains surge. Discard this card.",
      },
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
