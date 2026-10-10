/**
 * Falcon (Sam Wilson) Hero Pack (Cycle 9) curation.
 *
 * Normalizes cleanly with no hand corrections needed once the `Linked (Card Title).` keyword parser fix landed
 * (see `curation/bp.ts`'s header for the full explanation).
 *
 * **Starter deck and scenario data not curated this pass** — data-only pool (PLAN.md Phase 7).
 */
import type { PackCuration } from "./types.ts";

export const FALCON_CURATION: PackCuration = {
  packCode: "falcon",
  cycle: { id: "cycle9", name: "Agents of S.H.I.E.L.D.", order: 9 },
  pack: {
    name: "Falcon",
    releaseDate: "2025-06-20",
    releaseDateSource:
      'Hall of Heroes Falcon page (https://hallofheroeslcg.com/falcon-sam-wilson/): "Release date: June 20, 2025"',
  },
  outDir: "src/data/falcon",
  exportPrefix: "FALCON",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "falcon-leadership",
      name: "Falcon (Leadership) — Falcon Hero Pack starter deck",
      identityCode: "53001a",
      aspect: "leadership",
      cards: {
        "53002": 1, // Redwing
        "53003": 2, // Bird of Prey
        "53004": 2, // Bird's-Eye View
        "53005": 2, // Up, Up, and Away
        "53006": 1, // Falcon's Flock
        "53007": 1, // Soup Kitchen
        "53008": 1, // Aerial Evacuation
        "53009": 1, // Aerial Recon
        "53010": 1, // Battlefield Awareness
        "53011": 1, // Draw Their Fire
        "53012": 1, // Talon Line
        "53013": 1, // Vibranium Microweave
        "53014": 1, // Adam Warlock
        "53015": 1, // Aero
        "53016": 1, // Cloud 9
        "53017": 1, // Hugin & Munin
        "53018": 1, // Spectrum
        "53019": 3, // Strength in Diversity
        "53020": 3, // Flight Squadron
        "53021": 3, // Resource Reserve
        "53022": 1, // The Triskelion
        "53023": 1, // Captain America
        "53024": 3, // Wingman
        "53025": 1, // Energy
        "53026": 1, // Genius
        "53027": 1, // Strength
        "53028": 3, // The Power of Flight
      },
      obligationCode: "53029",
      nemesisCodes: ["53030", "53031", "53032", "53033"],
      verified: true,
      sources: [
        'Hall of Heroes "Starter Deck" decklist card image for this pack (wp-content/uploads/2026/01), read card by card and transcribed in docs/phase7-wave9-data-survey.md section 6.2',
      ],
      note: "40 cards by script: 15 Falcon hero cards, the leadership aspect cards and basic cards from the printed decklist (identity, obligation and nemesis set excluded). Printed card numbers equal the codes' last digits. Copies come from raw/marvelcdb/falcon.json quantities except where the deck prints fewer than the pack contains.",
    },
  ],
};
