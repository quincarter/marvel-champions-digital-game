/**
 * Gamora Hero Pack (Cycle 3, Guardians of the Galaxy) curation.
 *
 * Normalizes cleanly with no hand corrections needed.
 *
 * **Scenario data not curated** — `gam` is a hero pack with no scenario of its own. Starter deck curated wave 3
 * (below); it is the first precon in the pipeline that actually exercises `offAspectAllowance` below (First Hit
 * x3 from Protection, Impede x3 from Justice — exactly the 6-card allowance Skilled Tactician grants).
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
  cycle: { id: "cycle3", name: "The Galaxy's Most Wanted", order: 3 },
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
  starterDecks: [
    {
      id: "gamora-aggression",
      name: "Gamora (Aggression) — starter deck",
      identityCode: "18001a",
      aspect: "aggression",
      // First Hit (Protection) and Impede (Justice) are Skilled Tactician's off-aspect allowance (§1.5), not a
      // second *chosen* aspect the way Spider-Woman's Double-Agent precon (wave 2, `secondaryAspects`) is —
      // `@mc/engine`'s `validateDeck` requires exactly one chosen aspect here (Gamora's `deckbuilding` carries
      // `offAspectAllowance`, not `aspectCount`), so `aspects` on the emitted `StarterDeck` must stay
      // `["aggression"]` alone; `offAspectAllowanceCodes` only lets the normalizer's own per-card aspect check
      // accept these two codes, matching what `validateDeck` already recognizes via the identity's own field.
      offAspectAllowanceCodes: ["18015", "18016"],
      cards: {
        // Gamora cards (18002-18010), Hall of Heroes starter-deck image ("Gamora Deck"): "Nebula, Acrobatic Move
        // x2, Crosscounter x2, Set the Pace x2, Decisive Blow x2, Forward Momentum x2, Conditioning Room, Keen
        // Instincts x2, Gamora's Sword". 15 hero cards.
        "18002": 1,
        "18003": 2,
        "18004": 2,
        "18005": 2,
        "18006": 2,
        "18007": 2,
        "18008": 1,
        "18009": 2,
        "18010": 1,
        // Aggression + off-aspect cards ("Aggression+ Aspect Cards" on the image, Skilled Tactician's allowance):
        // "Angela, Clobber x3, Plan of Attack x3, Uppercut x2, First Hit x3 (Protection), Impede x3 (Justice),
        // Combat Training x2, Godslayer". 18 cards; First Hit + Impede = 6, exactly the offAspectAllowance max.
        "18011": 1,
        "18012": 3,
        "18013": 3,
        "18014": 2,
        "18015": 3,
        "18016": 3,
        "18017": 2,
        "18018": 1,
        // Basic cards: "Drax, Hit and Run x3, Energy, Genius, Strength". 7 basic cards. 15 + 18 + 7 = 40.
        "18019": 1,
        "18020": 3,
        "18021": 1,
        "18022": 1,
        "18023": 1,
      },
      obligationCode: "18024",
      nemesisCodes: ["18025", "18026", "18027", "18028"],
      verified: true,
      sources: [
        'Hall of Heroes Gamora release page (https://hallofheroeslcg.com/gamora/), "Starter Deck" link: https://hallofheroeslcg.com/wp-content/uploads/2021/05/gamorastarter.jpg — image transcribed directly (card-data-pipeline, wave 3).',
      ],
      note: "40 cards = 15 Gamora + 18 Aggression (incl. the 6-card off-aspect allowance: First Hit x3/Protection, Impede x3/Justice) + 7 Basic, matching the printed deck-list card's own counts. Nemesis set (Sibling Rivalry, Nebula, In a Bind, Waylay x2) matches docs/phase7-wave3.md §2.1's independently-researched table.",
    },
  ],
};
