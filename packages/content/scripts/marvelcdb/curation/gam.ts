/**
 * Gamora Hero Pack (Cycle 3, Guardians of the Galaxy) curation.
 *
 * Normalizes cleanly with no hand corrections needed.
 *
 * **Starter deck and scenario data not curated this pass** — data-only pool (PLAN.md Phase 7).
 *
 * **Skilled Tactician deckbuilding (wave3 §1.5).** Gamora's alter-ego face (18001b), "Skilled Tactician": "You may
 * include up to 6 attack and/or thwart events in your deck from aspects other than your chosen aspect." (raw
 * 18001b's `real_text`). `IdentityDeckbuilding.offAspectAllowance` was added for exactly this shape
 * (`game-rules-architect`'s schema pass): any number of titles, at most `maxCards` cards in total, each of
 * `cardType` with at least one of `anyTrait`, from any aspect not chosen — unlike `offAspectPackages` (Maria
 * Hill's all-or-nothing "exactly three titles at maximum copies"), taking fewer than the maximum is legal. Keyed
 * on 18001a (the hero face's own MarvelCDB code), matching `normalize/heroes.ts`'s `identityDeckbuilding` lookup
 * (by the hero record's code, not the alter-ego's, even though the ability is printed on the alter-ego face).
 *
 * **Typo fix (wave3 §1.7).** In a Bind (18027) reads "Treat Gamora's printed text box as if it were blank
 * (except for traits))." — a doubled closing parenthesis (raw `real_text` carries it verbatim; `toPlainText`
 * doesn't touch parens). Not independently confirmed against the card image this pass.
 */
import { traitOf } from "../normalize/brand.ts";
import type { PackCuration } from "./types.ts";

export const GAM_CURATION: PackCuration = {
  packCode: "gam",
  cycle: { id: "cycle3", name: "Cycle 3", order: 3 },
  pack: {
    name: "Gamora",
    releaseDate: "2021-05-14",
    releaseDateSource: 'Hall of Heroes Gamora page (https://hallofheroeslcg.com/gamora/): "Release date: May 14, 2021"',
  },
  outDir: "src/data/gam",
  exportPrefix: "GAM",

  corrections: [
    {
      code: "18027",
      reason:
        'MarvelCDB\'s own transcription typo: "blank (except for traits))." has a doubled closing parenthesis after "traits" — should read "blank (except for traits)."',
      evidence: "raw (18027); wave3 §1.7 (raw-data typo list)",
      textReplace: { find: "blank (except for traits))", replace: "blank (except for traits)" },
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  identityDeckbuilding: {
    "18001a": {
      offAspectAllowance: { cardType: "event", anyTrait: [traitOf("ATTACK"), traitOf("THWART")], maxCards: 6 },
    },
  },

  scenarios: [],
  starterDecks: [],
};
