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
 * Normalizes cleanly with these three entries — no schema/parser gap found for this pack.
 *
 * **Starter deck and scenario data not curated this pass** — this pass emits the pack's cards only (data-only
 * pool, PLAN.md Phase 7 "All other packs become card data"); precon curation is a follow-up.
 */
import type { PackCuration } from "./types.ts";

export const ICEMAN_CURATION: PackCuration = {
  packCode: "iceman",
  cycle: { id: "cycle8", name: "Cycle 8", order: 8 },
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
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {
    "46003":
      'Snow Clone prints THW as a dash (cannot thwart) — confirmed from the card\'s own MarvelCDB listing ("Attack: 2. Thwart: —."), not a transcription gap.',
  },

  scenarios: [],
  starterDecks: [],

  auxiliaryHeroSetCodes: {
    iceman_frostbite: "iceman",
  },
};
