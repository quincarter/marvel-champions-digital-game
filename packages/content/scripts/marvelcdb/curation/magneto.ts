/**
 * Magneto (Erik Lehnsherr) Hero Pack (Cycle 8) curation.
 *
 * Normalizes cleanly with no hand corrections needed once the `Linked (Card Title).` keyword parser fix landed
 * (`parse-text.ts`, `normalize/player-cards.ts` — see `curation/bp.ts`'s header for the full explanation).
 *
 * **Starter deck and scenario data not curated this pass** — data-only pool (PLAN.md Phase 7).
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
  starterDecks: [],
};
