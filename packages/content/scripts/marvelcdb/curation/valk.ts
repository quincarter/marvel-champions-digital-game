/**
 * Valkyrie (Brunnhilde) Hero Pack (Cycle 4) curation.
 *
 * - **Beguiled (25031, attachment): `SuperlativeHostPool "ally"` + `HostMeasure "printedCost"`**, landed by
 *   `game-rules-architect` (docs/phase7-wave2.md §7.1) — "Attach to the ally with the highest cost without
 *   Beguiled attached" now parses to `{ kind: "superlative", among: "ally", order: "highest", measure:
 *   "printedCost", withoutAttachmentNamed: "Beguiled" }`. Also needed the parser to look for an "Attach to X."
 *   sentence inside a `When Revealed:` ability's own body, not just the card's preamble (`parse-text.ts`'s
 *   general fix, `docs/phase7-wave2-data.md`) — this card's attach rule is the ability's own opening sentence,
 *   not a separate preamble line. No corrections needed; normalizes cleanly.
 *
 * RRG 1.8 p. 67's three Valkyrie errata (Aragorn #7 "Valkyrie" → "You"; Shieldmaiden #11 added the Defense trait
 * and "(defense)" label; Beguiled #31 added the Condition trait) are already reflected in MarvelCDB's cached text
 * and traits (each raw record carries its own `errata` note confirming it), so no curated `Errata`/`Correction`
 * entries were needed for them.
 *
 * Starter deck curated wave 4 (below). Note: the printed starter-deck reference card's own internal numbering
 * skips "21" (jumping "20 The Best Defense... x3" straight to "22 Audacity") and reuses 28-31 for the Nemesis Set
 * after already using them for Basic/Obligation cards — a numbering slip on the physical card itself, not a card-
 * count problem; every named card and quantity below is otherwise unambiguous and sums to the deck's own printed
 * quantityInSet/deckLimit values.
 */
import type { PackCuration } from "./types.ts";

export const VALK_CURATION: PackCuration = {
  packCode: "valk",
  cycle: { id: "cycle4", name: "Cycle 4", order: 4 },
  pack: {
    name: "Valkyrie",
    releaseDate: "2022-01-21",
    releaseDateSource:
      'Hall of Heroes Brunnhilde/Valkyrie page (https://hallofheroeslcg.com/brunnhilde-valkyrie/): "Release date: January 21, 2022"',
  },
  outDir: "src/data/valk",
  exportPrefix: "VALK",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "valkyrie-aggression",
      name: "Valkyrie (Aggression) — starter deck",
      identityCode: "25001a",
      aspect: "aggression",
      cards: {
        // Valkyrie cards (25002-25012), Hall of Heroes starter-deck image ("Valkyrie Deck"): "Death-Glow,
        // Annabelle Riggs, Valhalla, Valkyrie's Spear, Dragonfang, Aragorn, Flight of the Valkyrior x2, Visit
        // Valhalla, Chooser of the Slain x2, Shieldmaiden x2, \"Have at Thee!\" x3". 16 hero cards.
        "25002": 1,
        "25003": 1,
        "25004": 1,
        "25005": 1,
        "25006": 1,
        "25007": 1,
        "25008": 2,
        "25009": 1,
        "25010": 2,
        "25011": 2,
        "25012": 3,
        // Aggression cards: "Thor, Throg, Angela, Hall of Heroes, Combat Training x2, Quick Strike x3, Smash the
        // Problem x3, The Best Defense... x3, Audacity, The Power of Aggression". 17 aspect cards.
        "25013": 1,
        "25014": 1,
        "25015": 1,
        "25016": 1,
        "25017": 2,
        "25018": 3,
        "25019": 3,
        "25020": 3,
        "25021": 1,
        "25022": 1,
        // Basic cards: "The Bifrost, Godlike Stamina x3, Energy, Genius, Strength". 7 basic cards.
        // 16 + 17 + 7 = 40.
        "25023": 1,
        "25024": 3,
        "25025": 1,
        "25026": 1,
        "25027": 1,
      },
      obligationCode: "25028",
      nemesisCodes: ["25029", "25030", "25031", "25032"],
      verified: true,
      sources: [
        'Hall of Heroes Valkyrie release page (https://hallofheroeslcg.com/brunnhilde-valkyrie/), "Starter Deck" ' +
          "link: https://hallofheroeslcg.com/wp-content/uploads/2021/11/1.jpg — image transcribed directly " +
          "(card-data-pipeline, wave 4).",
        "MarvelCDB public API card records for the valk pack (packages/content/raw/marvelcdb/valk.json) — every " +
          "card's quantityInSet/deckLimit matches the transcribed deck exactly.",
      ],
      note:
        "40 cards = 16 Valkyrie + 17 Aggression + 7 Basic, matching the printed deck-list card's own counts (see " +
        "the module doc comment above on that card's own numbering slip). Nemesis set (Enchantress minion, " +
        "Powerful Enchantments, Beguiled, Seduced x2) matches the identity's own nemesisEncounterSetId.",
    },
  ],
};
