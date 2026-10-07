/**
 * Angel (Warren Worthington III) Hero Pack (Cycle 7) curation.
 *
 * Normalizes cleanly with zero hand corrections (`survey.ts --pack angel`, confirmed before this file existed —
 * see docs/phase7-wave2-data.md Part 6). A three-sided identity (42001a Angel / 42001b Warren Worthington III
 * alter-ego / 42001c Archangel), the same shape as Ant-Man's Giant (`ant` 12001c) and Wasp's Giant (`wsp` 13001c)
 * — already handled by `normalize/context.ts`'s `heroBySet` fix (docs/phase7-wave2-data.md Part 1 §5). Every
 * record carries its own `imagesrc`; no artwork gap.
 *
 * **Precon:** transcribed 2026-10-04 from the pack's own printed decklist card (see `sources` below); no scenario
 * data (hero pack).
 */
import type { PackCuration } from "./types.ts";

export const ANGEL_CURATION: PackCuration = {
  packCode: "angel",
  cycle: { id: "cycle7", name: "NeXt Evolution", order: 7 },
  pack: {
    name: "Angel",
    releaseDate: "2023-09-22",
    releaseDateSource:
      'Hall of Heroes Angel/Warren Worthington III page (https://hallofheroeslcg.com/angel-warren-worthington-iii/): "September 22, 2023"; cycle grouping confirmed against Hall of Heroes\' own card database navigation (https://hallofheroeslcg.com/browse/), which lists Angel alongside Psylocke, X-23 and Deadpool under Cycle 7.',
  },
  outDir: "src/data/angel",
  exportPrefix: "ANGEL",

  corrections: [
    {
      code: "42013",
      reason: 'MarvelCDB reads "(paying its cost)"; Warpath prints "(paying its costs)".',
      evidence:
        'Card scan assets/card-art/bundles/cards/42013.png: "play an event with a "Hero Action" ability from your hand (paying its costs)."',
      textReplace: { find: "(paying its cost)", replace: "(paying its costs)" },
    },
  ],
  errata: [],

  // Scripting hand-off notes (docs/phase7-wave7-data-survey.md §8 step 12), comments only so the emitted data does not
  // change. Reading taken, question or ruling behind it (docs/phase7-wave7.md §4.1), script under
  // packages/cards/src/wave7/angel/. No dotted acronym traits here (docs/trait-split-report.md: no change).
  // - 42001a/b/c Angel / Warren / Archangel: "if you are Angel / Archangel" reads the title of the face showing, since
  //   both hero faces print the same traits. Each face's response keeps its own limit across a flip (January 26, 2026 -
  //   Ruling 6), and the face showing after an AERIAL event resolves is the one that answers (Q42 = A). Archangel's
  //   acceleration icon is data, heard only while that face is up. identity.ts.
  // - 42003 Adaptive Plumage: two Hero Actions on one card, each gated by the face showing. 42004 Aerial Agility
  //   answers
  //   any enemy attack (Q41 = A); as a "(defense)" ability it makes the hero the defender and DEF is not applied, and
  //   other players cannot use one for that attack (2026-10-06). events.ts.
  // - 42005 Metamorphosis: changes form (any other face, asked), then the effect of the face reached. events.ts.
  // - 42021 Soaring Hearts: reprint of 41020, aliased; Archangel is not "Angel", so no play as Archangel (Q37 = A).
  // - 42011 Elixir: the either-trait restriction is a constant; the unique rule against a Psylocke identity is the
  //   engine's. (Its regenerated diff was reviewed by hand, survey §8 step 10.)
  // - 42013 Warpath: his Response overrides the Hero Action's timing, so he can play the event in the villain phase
  //   too,
  //   at its full cost (2026-10-06). Printed "(paying its costs)" is corrected above. support-upgrades-allies.ts.
  // - 42010 Techno-Organic Wings, 42020 Cannonball, 42019 Containment Strategy: the discount waits for the next AERIAL
  //   card played from hand; "reduce by X" is preventing up to X; "Max 1 per side scheme" is data. support-upgrades-
  //   allies.ts.
  // - 42024 Apocalyptic Influence: the facedown deal is the first effect because the engine's deal cost can only deal
  //   the payer; it differs only in that the deal cannot fail to be paid. 42026 Hook, Line, and Sinker: a share a tough
  //   status card absorbs was not taken. obligation-nemesis.ts.
  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "angel-protection",
      name: "Angel (Protection) — Angel Hero Pack starter deck",
      identityCode: "42001a",
      aspect: "protection",
      cards: {
        "42002": 1, // Psylocke
        "42003": 2, // Adaptive Plumage
        "42004": 2, // Aerial Agility
        "42005": 2, // Metamorphosis
        "42006": 2, // Natural Flight
        "42007": 2, // Razor Dive
        "42008": 2, // Avian Anatomy
        "42009": 1, // Worthington Industries
        "42010": 1, // Techno-Organic Wings
        "42011": 1, // Elixir
        "42012": 1, // Siryn
        "42013": 1, // Warpath
        "42014": 3, // Aerial Intervention
        "42015": 3, // Ever Vigilant
        "42016": 3, // Taunt
        "42017": 1, // Render Medical Aid (Protection player side scheme; the decklist card prints "Triage")
        "42018": 1, // Angel's Aerie
        "42019": 3, // Containment Strategy
        "42020": 1, // Cannonball
        "42021": 1, // Soaring Hearts
        "42022": 3, // The Power of Flight
        "42023": 3, // Soaring Acrobatics
      },
      obligationCode: "42024",
      nemesisCodes: ["42025", "42026", "42027", "42028"],
      verified: true,
      sources: [
        'Angel Hero Pack printed decklist card, "Angel Deck" (https://hallofheroeslcg.com/wp-content/uploads/2023/10/photo-oct-07-2023-4-42-19-pm.jpg, the "Starter Deck" link on the Hall of Heroes Angel page, https://hallofheroeslcg.com/angel-warren-worthington-iii/), transcribed 2026-10-04',
      ],
      note: '40 cards (identity, obligation and nemesis set excluded): 15 Angel, 17 Protection (Render Medical Aid is the in-aspect player side scheme), 8 basic. Identity is the three-face 42001 (a/b/c) keyed on 42001a as ant/wsp do. The printed card numbers equal the codes\' last digits; every quantity matches raw/marvelcdb/angel.json. Title disagreement: the decklist card\'s entry 17 reads "Triage" while MarvelCDB (and the normalized data) title 42017 "Render Medical Aid"; same number, same Protection player side scheme.',
    },
  ],
};
