/**
 * Cyclops (Scott Summers) Hero Pack (Cycle 6) curation.
 *
 * Normalizes cleanly with no hand corrections needed — the schema-neutral parser fixes landed across all packs
 * (docs/phase7-wave2-data.md) already cover every shape this pack uses.
 *
 * **Precon:** transcribed 2026-10-01 from the pack's own printed decklist card (see `sources` below); no scenario data (hero pack).
 */
import type { PackCuration } from "./types.ts";

export const CYCLOPS_CURATION: PackCuration = {
  packCode: "cyclops",
  cycle: { id: "cycle6", name: "Cycle 6", order: 6 },
  pack: {
    name: "Cyclops",
    releaseDate: "2022-09-30",
    releaseDateSource:
      'Hall of Heroes Cyclops page (https://hallofheroeslcg.com/scott-summers-cyclops/): "Release date: September 30, 2022"',
  },
  outDir: "src/data/cyclops",
  exportPrefix: "CYCLOPS",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

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
      // Cyclops' own deck options admit X-Men allies of any aspect; this only satisfies the normalizer's aspect check
      // (the identity's `offAspectAllowance` is what `validateDeck` reads, as with gam).
      offAspectAllowanceCodes: ["33012", "33013", "33014"],
      verified: true,
      sources: [
        'Cyclops Hero Pack printed decklist card, "Cyclops Deck" (https://hallofheroeslcg.com/wp-content/uploads/2022/09/c1-1.jpg, the "Starter Deck" link on the Hall of Heroes Cyclops page, https://hallofheroeslcg.com/scott-summers-cyclops/), transcribed 2026-10-01',
      ],
      note: "Single printed source (no MarvelCDB decklist found); every code and quantity cross-checked against raw/marvelcdb/cyclops.json quantity/deck_limit (full printed quantity for each). Dust, Rockslide and Blindfold are aggression, protection and justice X-Men allies admitted by Cyclops' own deck options; the card lists all three as Leadership + Aspect cards.",
    },
  ],
};
