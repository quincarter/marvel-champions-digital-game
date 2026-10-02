/**
 * Storm (Ororo Munroe) Hero Pack (Cycle 6) curation.
 *
 * **Registered and emitted (docs/phase7-wave2-data.md Part 6)** — `HostMeasure "thw"` landed
 * (`packages/content/src/schema/cards/attachment-host.ts`) and the matching `parse-text.ts` descriptor mapping
 * (`"thw"` → `HostMeasure "thw"`, mirroring `"cost"` → `"printedCost"`) closed the one remaining blocker below
 * (Possessed, 36038).
 *

 * - **The Weather Deck (36002–36005: Clear Skies, Hurricane, Thunderstorm, Blizzard) resolved via the new
 *   `auxiliaryHeroSetCodes` mechanism**, not a one-off: these four supports are Storm's own hero-kit cards (a
 *   "one active weather condition at a time" mechanic — each is `Permanent`, and each has a `Special` ability
 *   swapping which one is in play), but MarvelCDB files them under their own themed sub-set (`storm_weather_deck`)
 *   instead of Storm's own identity set (`storm`), so `heroBySet`'s ordinary `card_set_code` lookup found no
 *   identity for them ("hero card in a set with no identity"). `auxiliaryHeroSetCodes: { storm_weather_deck:
 *   "storm" }` aliases the auxiliary set to Storm's own hero record — general mechanism (`normalize/context.ts`),
 *   not Storm-specific; the same shape is flagged (not yet confirmed) in `fne`/`hercules`/`iceman`'s own gap
 *   matrix entries.
 * - Each Weather Deck card's cost (also flagged "support without a cost") is the confirmed dash-cost pattern
 *   (Permanent, enters play by choice/effect rather than being paid for — MarvelCDB's own "Cost: —" listing).
 * - **Possessed (36038, attachment): now parses.** "Attach to the ally with the lowest THW without Possessed
 *   attached" → `{ kind: "superlative", among: "ally", order: "lowest", measure: "thw", withoutAttachmentNamed:
 *   "Possessed" }` — the same `SuperlativeHostPool "ally"` shape as `valk`'s Beguiled and `deadpool`'s
 *   'Pool-ized ("highest cost"), with the `thw` measure instead of `printedCost`.
 *
 * **Precon:** transcribed 2026-10-01 from the pack's own printed decklist card (see `sources` below); no scenario data (hero pack).
 */
import type { PackCuration } from "./types.ts";

export const STORM_CURATION: PackCuration = {
  packCode: "storm",
  cycle: { id: "cycle6", name: "Mutant Genesis", order: 6 },
  pack: {
    name: "Storm",
    releaseDate: "2022-11-11",
    releaseDateSource:
      'Hall of Heroes Ororo Munroe/Storm page (https://hallofheroeslcg.com/ororo-munroe-storm/): "Release date: November 11, 2022"',
  },
  outDir: "src/data/storm",
  exportPrefix: "STORM",

  corrections: [
    {
      code: "36002",
      reason:
        'Clear Skies is one of the Weather Deck\'s four Permanent supports, swapped into play by their own Special ability rather than played from hand: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 "Dash (Value)", p. 15), not a data gap.',
      evidence: 'MarvelCDB card listing (marvelcdb.com/card/36002), "Cost: —"',
      specialCost: "dash",
    },
    {
      code: "36003",
      reason: "Hurricane — same Weather Deck reasoning as 36002.",
      evidence: 'MarvelCDB card listing (marvelcdb.com/card/36003), "Cost: —"',
      specialCost: "dash",
    },
    {
      code: "36004",
      reason: "Thunderstorm — same Weather Deck reasoning as 36002.",
      evidence: 'MarvelCDB card listing (marvelcdb.com/card/36004), "Cost: —"',
      specialCost: "dash",
    },
    {
      code: "36005",
      reason: "Blizzard — same Weather Deck reasoning as 36002.",
      evidence: 'MarvelCDB card listing (marvelcdb.com/card/36005), "Cost: —"',
      specialCost: "dash",
    },
  ],
  errata: [
    {
      code: "36030",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Claustrophobia: "change forms" became "change to hero form". MarvelCDB already carries the current wording.',
      evidence: "RRG 1.8 p. 68, Storm Hero Pack (#30) errata.",
      printedReplace: {
        find: "You cannot change to hero form.",
        replace: "You cannot change forms.",
      },
    },
    {
      code: "36038",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Possessed: added "Attached ally engages its controller.". MarvelCDB already carries the current wording; the scan (assets/card-art/bundles/cards/36038.png) lacks it.',
      evidence: "RRG 1.8 p. 68, Storm Hero Pack (#38) errata; card scan 36038.png.",
      printedReplace: {
        find: " Attached ally engages its controller.",
        replace: "",
      },
    },
  ],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],

  // The Weather deck (docs/phase7-wave6.md §3.45). The Storm Hero Pack insert, "The Weather Deck": "Storm begins each
  // game with a special, four-card 'WEATHER deck' in addition to her player deck. To create the WEATHER deck, shuffle
  // all four of Storm's WEATHER support cards together … Then, place the WEATHER deck facedown next to your identity
  // card." It names no discard pile and no reset (§4.1 Q26): the four cards are never listed in the player deck.
  separateDecks: [
    {
      identityCode: "36001a",
      deckName: "Weather",
      cardCodes: ["36002", "36003", "36004", "36005"],
      topCardFaceup: false,
      discardPile: "none",
      whenEmpty: "stayEmpty",
    },
  ],

  starterDecks: [
    {
      id: "storm-leadership",
      name: "Storm (Leadership) — Storm Hero Pack starter deck",
      identityCode: "36001a",
      aspect: "leadership",
      cards: {
        "36006": 1, // Storm's Crown
        "36007": 1, // Storm's Cape
        "36008": 1, // Ororo's Garden
        "36009": 3, // Weather Goddess
        "36010": 3, // Torrential Rain
        "36011": 2, // Lightning Bolt
        "36012": 2, // Flash Freeze
        "36013": 2, // Blast of Wind
        "36014": 1, // Havok
        "36015": 1, // Mirage
        "36016": 1, // Gentle
        "36017": 1, // Pixie
        "36018": 3, // Uncanny X-Men
        "36019": 3, // Leadership Skill
        "36020": 3, // To Me, My X-Men!
        "36021": 2, // Effective Leadership
        "36022": 1, // Forge
        "36023": 1, // The X-Jet
        "36024": 1, // Utopia
        "36025": 1, // X-Mansion
        "36026": 3, // Endurance
        "36027": 1, // Energy
        "36028": 1, // Genius
        "36029": 1, // Strength
      },
      obligationCode: "36030",
      nemesisCodes: ["36031", "36032", "36033", "36034"],
      verified: true,
      sources: [
        'Storm Hero Pack printed decklist card, "Storm Deck" (https://hallofheroeslcg.com/wp-content/uploads/2022/11/zzz.jpg, the "Starter Deck" link on the Hall of Heroes page, https://hallofheroeslcg.com/ororo-munroe-storm/), transcribed 2026-10-01 from the card image',
      ],
      note: "Single printed source (no MarvelCDB decklist found); every code and quantity cross-checked against raw/marvelcdb/storm.json quantity/deck_limit (full printed quantity for each). The printed list is '40 + 4 weather': the four Weather deck cards (36002-36005, Storm's own hero-set cards, auxiliary set storm_weather_deck) are not listed in `cards` (docs/phase7-wave6.md §3.45); they come from the identity's `separateDecks`, so the player deck totals 40.",
    },
  ],

  auxiliaryHeroSetCodes: {
    storm_weather_deck: "storm",
  },
};
