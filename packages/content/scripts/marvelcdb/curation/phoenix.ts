/**
 * Phoenix (Jean Grey) Hero Pack (Cycle 6) curation.
 *
 * One hand correction: Phoenix Force (34002a/34002b) prints a dash cost — it is a "Permanent" identity upgrade
 * that enters play via Jean Grey's own hero-kit text, not paid for from hand. MarvelCDB gives it `cost: null`
 * on both faces. Confirmed printed dash from the card's own MarvelCDB listing ("Cost: —"), the same evidence
 * standard used for trors' Hydra Campaign upgrades (docs/phase7-wave2.md §1.3/§5.1's `specialCost` mechanism).
 *
 * `normalizePack` runs clean with just that one correction (confirmed by `survey.ts --pack phoenix`) — **but the
 * pack is NOT registered in `ingest-marvelcdb.ts`'s `REGISTERED_CURATIONS`, and is not wired into
 * `DATA_ONLY_CARDS`.** `validateCard()` (run once the pack was actually emitted and checked against
 * `data-only.test.ts`'s pool-wide assertions, which `survey.ts` never exercises) rejects Burning Hunger (34028,
 * Phoenix's obligation): MarvelCDB's raw record has **no `text`/`real_text` field at all** — not a blank string,
 * the field is entirely absent — and MarvelCDB's own card page (marvelcdb.com/card/34028) doesn't display any
 * text either. A web search surfaces a third-party *paraphrase* of the card's effect (summon Dark Phoenix/Consume
 * the World if drawn while Unleashed), not the verbatim printed wording, so it is not usable as a source (this
 * project's discipline: never fabricate card text, CLAUDE.md/card-data-pipeline's own remit).
 *
 * **Blocked until a second source with the exact printed text of 34028 is found** (a card scan, e.g. a Hall of
 * Heroes release-page gallery image actually confirmed to be this specific card — the Jean Grey/Phoenix gallery's
 * own filenames are generic and unconfirmed, see docs/phase7-wave2-data.md). Once found, curate it as
 * `separatedIdentities`-style curated text was for SP//dr's Peni Parker, or extend `Correction` with a
 * from-scratch text field if the existing `textReplace` (find-and-replace against *existing* text) doesn't fit an
 * entirely-absent source string.
 *
 * Otherwise normalizes cleanly — the schema-neutral parser fixes (docs/phase7-wave2-data.md) already cover every
 * other shape this pack uses.
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
    releaseDateSource: 'Hall of Heroes Jean Grey/Phoenix page (https://hallofheroeslcg.com/jean-grey-phoenix/): "Release date: September 30, 2022"',
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
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
