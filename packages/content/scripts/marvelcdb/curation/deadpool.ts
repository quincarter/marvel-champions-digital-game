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

  // Scripting hand-off notes (docs/phase7-wave7-data-survey.md §8 step 12), comments only so the emitted data does not
  // change. Reading taken, question or ruling behind it (docs/phase7-wave7.md §4.1), script under
  // packages/cards/src/wave7/deadpool/. No dotted acronym traits here (docs/trait-split-report.md: no change).
  // - 44001a The Regeneratin' Degenerate: a genuine "would be defeated" replacement, so it resolves before any "is
  //   defeated" interrupt and is not offered together with them for ordering (2026-10-06, RRG 1.8 "Would"). Hero face
  //   only; Wade Wilson at 0 hit points is defeated. When he cannot change form it resolves as far as it can: the dial
  //   goes to 1 and the token is added (Q45 = A). 44028 Git Gud's forced interrupt is heard in the same window.
  //   identity.ts, support-upgrades-allies.ts.
  // - 44028 Git Gud: the cost reduction is read in hand from an outside fact. A game is one finished as a win or a
  //   loss;
  //   an abandoned session is not a game; no history means "did not win"; the result is snapshotted at setup (Q48,
  //   2026-10-06 one definition everywhere). support-upgrades-allies.ts.
  // - 44046 Break Time: Alliance and the per-player cost are data. The minutes are wall-clock time from playing the
  //   card, including time backgrounded, whole minutes rounded down, no cap, stored in the log by `reportFact`; the
  //   player who played it ends the break (Q49; the 1,440-minute cap on the client was confirmed as a product choice,
  //   2026-10-06). pack-cards.ts.
  // - 44032 The Merc with the Mouth: no "When Revealed" header, so the three sentences are one standing constant, one
  //   `-constant` ref (2026-10-05, RRG 1.8 "Ability", p. 4). Exhausted allies stay exhausted and new ones enter
  //   exhausted. Other players cannot resolve player card abilities during your turn, forced ones and Plot Convenience
  //   included ("cannot" wins, RRG p. 11). The talking check is Q50, via `reportFact`. obligation-nemesis.ts.
  // - 44035 Tabula Rasa 16: both faces' text boxes are blank (Q12 = A), so the regeneration does not apply.
  // - 44004 Maximum Effort, 44006 "Yoo-Hoo!": the payer may take 0 damage; the event then does nothing but counts as
  //   played (Q46 = B), and 0 damage opens no damage window (2026-10-06). events.ts.
  // - 44023 'Pool Inspection: "ignoring the crisis icon" covers the first sentence only (2026-10-06, as built).
  //   44024 Live Dangerously counts Dreadful Deeds 44039 (as built). events.ts, support-upgrades-allies.ts.
  // - 44009 Armed to the Teeth: the swap turns up a WEAPON from "your collection", the five aspects' WEAPON upgrades in
  //   the app's playable pool with copy accounting (Q47 = A). A restricted weapon turned up resolves, then the
  //   restricted limit is enforced by discards (2026-10-06). support-upgrades-allies.ts.
  // - 44050 Plot Convenience: any player triggers it and may take any attached card whoever owns it (Q53 = A), but the
  //   Merc stops it during the Merc player's turn. 44053 Blackout: one option per resource type, a wild resource is
  //   spent as the type its player declares (Q51 = A); it takes threat off a scheme the way a move does, so under a
  //   crisis icon with no other scheme the Action cannot be started and nothing is spent (2026-10-06, RRG "Move",
  //   p. 30). 44056 Rock, Paper, Scissors and 44057 Tic-Tac-Toe use the scan's diagrams (spec §3.84, §3.87); 44058
  //   War reads star and boost icons. pack-cards.ts.
  // - 44055 Laser Swords: "counts as 2 restricted cards" is `restrictedWeight` and only weighs on the limit; text that
  //   names restricted cards does not see it, and cards discarded for the limit must carry the keyword (Q52 = B). With
  //   Psylocke's two Katanas it can never stay in play. A restricted card played over the limit resolves, then the
  //   player discards down (2026-10-06). pack-cards.ts.
  // - 44037 Crisis of Infinite Deadpools and the Dreadpool set: auto-included exactly when a seat chose 'Pool (Q44 = A,
  //   `encounterSets` above); the rest of the set starts set aside. 44041 'Pool-ized carries the RRG 1.8 erratum
  //   (`errata` above). dreadpool.ts.
  // - 44047 Get in Front of Me!, 44048 Mulligan: a defender who has left play still counts; "another card this phase"
  //   counts the player's own plays across the whole player phase. pack-cards.ts.
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
