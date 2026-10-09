/**
 * Iceman (Bobby Drake) Hero Pack (Cycle 8) curation.
 *
 * - **Frostbite (46002) resolved via `auxiliaryHeroSetCodes`**, the same mechanism `storm.ts` uses for the
 *   Weather Deck: MarvelCDB files this hero-kit upgrade under `iceman_frostbite` instead of Iceman's own
 *   identity set (`iceman`) — `auxiliaryHeroSetCodes: { iceman_frostbite: "iceman" }` aliases it.
 * - **Frostbite's cost: dash, confirmed.** "Permanent... Forced Response: After attached enemy activates or
 *   leaves play, set this card aside." — a signature attachment, not paid for from hand. MarvelCDB sends no
 *   `cost` at all; confirmed against the card's own MarvelCDB listing ("Cost: —").
 * - **Snow Clone (46003, ally): printed THW is a dash, confirmed.** MarvelCDB's own listing shows "Attack: 2.
 *   Thwart: —." — a real printed stat (this ally cannot thwart), not a transcription gap.
 *
 * - **Cryokinetic Perception (46005): one text correction** (see `corrections`): the card prints "the ICE trait".
 *
 * **Starter deck:** Iceman / Aggression, from the pack's printed decklist card (docs/phase7-wave8.md §7.2, §3.61).
 * Frostbite (46002) follows the permanent-card model of X-23's Claws and Psylocke's Psi-Knives, not Storm's separate
 * Weather Deck: the deck lists it x6 and setup sets the copies aside (the `permanent` keyword marks it), so they never
 * count toward the 40. The emitted Frostbite record already carries everything that model needs. Scenario data is not
 * curated this pass (data-only pool, PLAN.md Phase 7).
 */
import type { PackCuration } from "./types.ts";

export const ICEMAN_CURATION: PackCuration = {
  packCode: "iceman",
  cycle: { id: "cycle8", name: "Age of Apocalypse", order: 8 },
  pack: {
    name: "Iceman",
    releaseDate: "2024-05-17",
    releaseDateSource:
      'Hall of Heroes Iceman/Bobby Drake page (https://hallofheroeslcg.com/iceman-bobby-drake/): "Release date: May 17, 2024"',
  },
  outDir: "src/data/iceman",
  exportPrefix: "ICEMAN",

  corrections: [
    {
      code: "46002",
      reason:
        'Frostbite is a Permanent signature attachment, set aside by its own Forced Response rather than played for a resource cost: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 "Dash (Value)", p. 15), not a data gap.',
      evidence: 'MarvelCDB card listing (marvelcdb.com/card/46002), "Cost: —"',
      specialCost: "dash",
    },
    {
      code: "46005",
      reason: 'MarvelCDB reads "If that card has an Ice trait"; the card prints "If that card has the ICE trait".',
      evidence: 'Card scan assets/card-art/bundles/cards/46005.png: "If that card has the ICE trait, ready Iceman."',
      textReplace: { find: "has an Ice trait", replace: "has the ICE trait" },
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {
    "46003":
      'Snow Clone prints THW as a dash (cannot thwart) — confirmed from the card\'s own MarvelCDB listing ("Attack: 2. Thwart: —."), not a transcription gap.',
  },

  scenarios: [],
  starterDecks: [
    {
      id: "iceman-aggression",
      name: "Iceman (Aggression) — Iceman Hero Pack starter deck",
      identityCode: "46001a",
      aspect: "aggression",
      cards: {
        "46002": 6, // Frostbite (Permanent; set aside at setup, not one of the 40)
        "46003": 2, // Snow Clone
        "46004": 1, // Power Belt
        "46005": 1, // Cryokinetic Perception
        "46006": 1, // Ice Slide
        "46007": 2, // Frozen Solid
        "46008": 1, // Ice Wall
        "46009": 2, // Arctic Attack
        "46010": 2, // Ice Blast
        "46011": 3, // Chill Out!
        "46012": 1, // Shark-Girl
        "46013": 1, // Glob
        "46014": 3, // Suppressing Fire
        "46015": 3, // Surprise Move
        "46016": 3, // Take That!
        "46017": 3, // Looking for Trouble
        "46018": 1, // Keep Up the Pressure (Aggression player side scheme)
        "46019": 1, // Shadowcat
        "46020": 1, // Beak
        "46021": 3, // Team-Building Exercise
        "46022": 3, // Recuperation
        "46023": 2, // The Power in All of Us
      },
      obligationCode: "46024",
      nemesisCodes: ["46025", "46026", "46027", "46028"],
      verified: true,
      sources: [
        'Iceman Hero Pack printed decklist card, "Iceman Deck" (the owner\'s photo of the card, 2026-10-07), transcribed in docs/phase7-wave8-handoff.md',
      ],
      note: "46 entries, 40 counted (identity, obligation and nemesis set excluded): 15 Iceman, 15 Aggression (Keep Up the Pressure is the in-aspect player side scheme), 10 basic, plus Frostbite (46002) x6. Frostbite is Permanent: it is listed in the deck, setup sets the six copies aside, and they do not count toward the 40 (the model of X-23's Claws and Psylocke's Psi-Knives, not Storm's separate Weather Deck). The printed card numbers equal the codes' last digits; every title and quantity matches raw/marvelcdb/iceman.json. The pack's modular set (Sauron, 46029-46032) is not on the decklist card.",
    },
  ],

  auxiliaryHeroSetCodes: {
    iceman_frostbite: "iceman",
  },
};
