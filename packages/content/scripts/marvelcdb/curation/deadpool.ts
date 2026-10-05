/**
 * Deadpool (Wade Wilson) Hero Pack (Cycle 7) curation.
 *
 * - **'Pool-ized (44041, attachment): the same landed shape as `valk`'s Beguiled** (`SuperlativeHostPool "ally"`
 *   + `HostMeasure "printedCost"`, docs/phase7-wave2.md §7.1) — "Attach to the ally with the highest cost
 *   without 'Pool-ized attached" now parses automatically, including via the same "attach rule inside a
 *   `When Revealed:` ability body" parser fix `valk.ts` describes. No corrections needed; normalizes cleanly.
 */
import type { PackCuration } from "./types.ts";

export const DEADPOOL_CURATION: PackCuration = {
  packCode: "deadpool",
  cycle: { id: "cycle7", name: "NeXt Evolution", order: 7 },
  pack: {
    name: "Deadpool",
    releaseDate: "2023-11-17",
    releaseDateSource:
      'Hall of Heroes Wade Wilson/Deadpool page (https://hallofheroeslcg.com/deadpool/): "Release date: November 17, 2023"',
  },
  outDir: "src/data/deadpool",
  exportPrefix: "DEADPOOL",

  // Deadpool insert, "Using the 'Pool Aspect": "When setting up a game in which at least one player is using the 'Pool
  // aspect, shuffle 1 copy of the Crisis of Infinite Deadpools (#37) treachery card into the encounter deck. Set the
  // rest of the Dreadpool modular encounter set aside." RRG 1.8 FAQ p. 64: "only included if at least one player in
  // the game chooses the 'Pool aspect as (one of) their chosen aspect(s)" (docs/phase7-wave7.md §3.74, §4 Q44).
  encounterSets: {
    dreadpool: { autoIncluded: { when: { kind: "aspectChosen", aspect: "pool" }, shuffledIn: ["44037"] } },
  },

  corrections: [],
  errata: [
    {
      code: "44041",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: "'Pool-ized: When Revealed now also has the attached ally engage its controller. MarvelCDB carries the current wording; the scan lacks the sentence.",
      evidence:
        "RRG 1.8 p. 69, Deadpool Hero Pack ('Pool-ized #41) errata (\"Added 'Attached ally engages its controller.'\"); scan 44041.png has no such sentence.",
      printedReplace: {
        find: "without 'Pool-ized attached. Attached ally engages its controller. Otherwise,",
        replace: "without 'Pool-ized attached. Otherwise,",
      },
    },
  ],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "deadpool-pool",
      name: "Deadpool ('Pool) — Deadpool Hero Pack starter deck",
      identityCode: "44001a",
      aspect: "pool",
      cards: {
        "44002": 1, // Cable
        "44003": 1, // Exhausting Personality
        "44004": 2, // Maximum Effort
        "44005": 1, // Metaknowledge
        "44006": 2, // "Yoo-Hoo!"
        "44007": 1, // Montage
        "44008": 1, // Chimichanga Truck
        "44009": 1, // Armed to the Teeth
        "44010": 2, // Deadpool's Katana
        "44011": 1, // It Ain't Over...
        "44012": 2, // This Card is Fire
        "44013": 1, // Dogpool
        "44014": 1, // Headpool
        "44015": 1, // Kidpool
        "44016": 1, // Lady Deadpool
        "44017": 3, // Barely a Scratch
        "44018": 1, // Cutupper
        "44019": 1, // Da Bomb
        "44020": 1, // Get Rage-y
        "44021": 3, // "I Got This"
        "44022": 1, // Not my Responsibility
        "44023": 1, // 'Pool Inspection
        "44024": 1, // Live Dangerously
        "44025": 1, // Self Confidence
        "44026": 1, // Self Control
        "44027": 1, // Self Preservation
        "44028": 1, // Git Gud
        "44029": 3, // Healing Factor
        "44030": 1, // Stick-To-Itiveness
        "44031": 1, // Frenemies
      },
      obligationCode: "44032",
      nemesisCodes: ["44033", "44034", "44035", "44036"],
      verified: true,
      sources: ['Deadpool Hero Pack printed decklist card, "Deadpool Deck" (photo supplied by the owner, 2026-10-04)'],
      note: "40 cards (identity, obligation and nemesis set excluded): 15 Deadpool, 24 'Pool, 1 basic (Frenemies). Read from the pack's printed decklist card (the owner's photo, 2026-10-04): entries 2-31 with the quantities here. The card lists the Dreadpool set (44037-44042) apart; the 'Pool cards 44043-44058 are not on the decklist card.",
    },
  ],
};
