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
  cycle: { id: "cycle7", name: "Cycle 7", order: 7 },
  pack: {
    name: "Angel",
    releaseDate: "2023-09-22",
    releaseDateSource:
      'Hall of Heroes Angel/Warren Worthington III page (https://hallofheroeslcg.com/angel-warren-worthington-iii/): "September 22, 2023"; cycle grouping confirmed against Hall of Heroes\' own card database navigation (https://hallofheroeslcg.com/browse/), which lists Angel alongside Psylocke, X-23 and Deadpool under Cycle 7.',
  },
  outDir: "src/data/angel",
  exportPrefix: "ANGEL",

  corrections: [],
  errata: [],

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
