/**
 * Magneto (Erik Lehnsherr) Hero Pack (Cycle 8) curation.
 *
 * Normalizes cleanly with no hand corrections needed once the `Linked (Card Title).` keyword parser fix landed
 * (`parse-text.ts`, `normalize/player-cards.ts` — see `curation/bp.ts`'s header for the full explanation).
 *
 * **Scenario data not curated this pass** — data-only pool (PLAN.md Phase 7). The Leadership starter deck comes from the pack's printed decklist card.
 */
import type { PackCuration } from "./types.ts";

export const MAGNETO_CURATION: PackCuration = {
  packCode: "magneto",
  cycle: { id: "cycle8", name: "Cycle 8", order: 8 },
  pack: {
    name: "Magneto",
    releaseDate: "2024-11-15",
    releaseDateSource:
      'Hall of Heroes Magneto page (https://hallofheroeslcg.com/magneto-erik-lehnsherr/): "Release date: November 15, 2024"',
  },
  outDir: "src/data/magneto",
  exportPrefix: "MAGNETO",

  corrections: [],
  errata: [
    {
      code: "49010",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Magnetic Missile: the cost arrow after the discard becomes "Then,". MarvelCDB (and the scan) carry the arrow.',
      evidence:
        "RRG 1.8 p. 69, Magneto Hero Pack MAGNETIC MISSILE (#10) errata; scan 49010.jpg read, prints the cost arrow",
      currentReplace: {
        find: "Wrapped in Metal attached → deal 5 damage",
        replace: "Wrapped in Metal attached. Then, deal 5 damage",
      },
    },
    {
      code: "49023",
      version: "RRG 1.8",
      changedFields: ["aspect"],
      note: "Deft Focus: classification is Basic, not Protection. The scan prints PROTECTION; MarvelCDB and the emitted data already say basic. Text is unchanged.",
      evidence: "RRG 1.8 p. 69, Magneto Hero Pack DEFT FOCUS (#23) errata; scan 49023.jpg read, prints PROTECTION",
    },
    {
      code: "49028",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Exodus: "equal to his total ATK" gains "for that attack". MarvelCDB (and the scan) carry the printed wording.',
      evidence:
        'RRG 1.8 p. 69, Magneto Hero Pack EXODUS (#28) errata; scan 49028.jpg read, prints no "for that attack"',
      currentReplace: { find: "equal to his total ATK.", replace: "equal to his total ATK for that attack." },
    },
  ],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "magneto-leadership",
      name: "Magneto (Leadership) — Magneto Hero Pack starter deck",
      identityCode: "49001a",
      aspect: "leadership",
      cards: {
        "49002": 1, // Asteroid M
        "49003": 1, // Magneto's Helmet
        "49004": 1, // Magneto's Armor
        "49005": 1, // Magneto's Cape
        "49006": 1, // Magnetic Bubble
        "49007": 2, // Wrapped in Metal
        "49008": 2, // Electromagnetic Blast
        "49009": 2, // Metal Shards
        "49010": 2, // Magnetic Missile
        "49011": 2, // Master of Magnetism
        "49012": 1, // M
        "49013": 1, // Kid Omega
        "49014": 1, // Phoenix
        "49015": 1, // Cyclops
        "49016": 3, // Won't Stay Down
        "49017": 3, // Squared Off
        "49018": 3, // Noble Sacrifice
        "49019": 3, // "You Got This!"
        "49020": 1, // New Recruits (Leadership player side scheme)
        "49021": 1, // White Queen
        "49022": 1, // Face the Past
        "49023": 3, // Deft Focus
        "49024": 1, // Energy
        "49025": 1, // Genius
        "49026": 1, // Strength
      },
      obligationCode: "49027",
      nemesisCodes: ["49028", "49029", "49030", "49031", "49032"],
      verified: true,
      sources: [
        'Magneto Hero Pack printed decklist card, "Magneto Deck" (the owner\'s photo of the card, 2026-10-07), transcribed in docs/phase7-wave8-handoff.md',
      ],
      note: "40 cards (identity, obligation and nemesis set excluded): 15 Magneto, 17 Leadership (New Recruits is the in-aspect player side scheme), 8 basic. Identity is 49001a. The printed card numbers equal the codes' last digits; every title and quantity matches raw/marvelcdb/magneto.json (checked by script). The nemesis set is one copy of each of 49028 to 49032 (the card prints no multiplier).",
    },
  ],
};
