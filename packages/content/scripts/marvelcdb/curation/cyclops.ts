/**
 * Cyclops (Scott Summers) Hero Pack (Cycle 6) curation.
 *
 * Normalizes cleanly with no hand corrections needed — the schema-neutral parser fixes landed across all packs
 * (docs/phase7-wave2-data.md) already cover every shape this pack uses.
 *
 * **Deckbuilding.** Scott Summers (33001b): "You may include X-Men allies from any aspect in your deck." — an
 * `offAspectAllowance` with no `maxCards` (any number). Keyed on 33001a, the hero record's own code, as `gam` keys
 * Gamora's on 18001a (`normalize/heroes.ts` looks it up by the hero code).
 *
 * **Precon:** transcribed 2026-10-01 from the pack's own printed decklist card (see `sources` below); no scenario data (hero pack).
 */
import { traitOf } from "../normalize/brand.ts";
import type { PackCuration } from "./types.ts";

export const CYCLOPS_CURATION: PackCuration = {
  packCode: "cyclops",
  cycle: { id: "cycle6", name: "Mutant Genesis", order: 6 },
  pack: {
    name: "Cyclops",
    releaseDate: "2022-09-30",
    releaseDateSource:
      'Hall of Heroes Cyclops page (https://hallofheroeslcg.com/scott-summers-cyclops/): "Release date: September 30, 2022"',
  },
  outDir: "src/data/cyclops",
  exportPrefix: "CYCLOPS",

  corrections: [
    {
      code: "33027",
      reason:
        'Lost Visor prints "Search your hand, deck, discard pile, and play area for Ruby Quartz Visor and place it facedown under this card." with no When Revealed header, so the parser emitted only -constant and -action refs and nothing ran the search on reveal. The sentence is split into its own 33027.lost-visor-when-revealed ref; the card text is unchanged.',
      evidence:
        'Card scan assets/card-art/bundles/cards/33027.png: "Give to the Scott Summers player." / "Search your hand, deck, discard pile, and play area for Ruby Quartz Visor and place it facedown under this card." / "Cyclops cannot attack." / "Alter-Ego Action: Exhaust Scott Summers \u2192 add Ruby Quartz Visor to your hand and remove Lost Visor from the game."',
      unheadedWhenRevealed:
        "Search your hand, deck, discard pile, and play area for Ruby Quartz Visor and place it facedown under this card.",
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  identityDeckbuilding: {
    "33001a": { offAspectAllowance: { cardType: "ally", anyTrait: [traitOf("X-MEN")] } },
  },

  scenarios: [],
  starterDecks: [
    {
      id: "cyclops-leadership",
      name: "Cyclops (Leadership) — Cyclops Hero Pack starter deck",
      identityCode: "33001a",
      aspect: "leadership",
      cards: {
        "33002": 1, // Phoenix
        "33003": 1, // Ruby Quartz Visor
        "33004": 1, // Field Commander
        "33005": 2, // Exploit Weakness
        "33006": 2, // Practiced Defense
        "33007": 2, // Priority Target
        "33008": 1, // Full Blast
        "33009": 2, // Ricochet Beam
        "33010": 3, // Tactical Brilliance
        "33011": 1, // Beast
        "33012": 1, // Dust (aggression X-Men ally, via Cyclops deck options)
        "33013": 1, // Rockslide (protection X-Men ally)
        "33014": 1, // Blindfold (justice X-Men ally)
        "33015": 3, // Danger Room Training
        "33016": 3, // Coordinated Attack
        "33017": 3, // Teamwork
        "33018": 2, // Effective Leadership
        "33019": 1, // Angel
        "33020": 1, // Utopia
        "33021": 1, // Danger Room
        "33022": 3, // Game Time
        "33023": 1, // Psychic Rapport
        "33024": 1, // Energy
        "33025": 1, // Genius
        "33026": 1, // Strength
      },
      obligationCode: "33027",
      nemesisCodes: ["33028", "33029", "33030", "33031"],
      // Scott Summers' X-Men allies from any aspect (`identityDeckbuilding` above, which `validateDeck` reads); this
      // list only satisfies the normalizer's own per-card aspect check, as with gam.
      offAspectAllowanceCodes: ["33012", "33013", "33014"],
      verified: true,
      sources: [
        'Cyclops Hero Pack printed decklist card, "Cyclops Deck" (https://hallofheroeslcg.com/wp-content/uploads/2022/09/c1-1.jpg, the "Starter Deck" link on the Hall of Heroes Cyclops page, https://hallofheroeslcg.com/scott-summers-cyclops/), transcribed 2026-10-01',
      ],
      note: "Single printed source (no MarvelCDB decklist found); every code and quantity cross-checked against raw/marvelcdb/cyclops.json quantity/deck_limit (full printed quantity for each). Dust, Rockslide and Blindfold are aggression, protection and justice X-Men allies admitted by Cyclops' own deck options; the card lists all three as Leadership + Aspect cards.",
    },
  ],
};
