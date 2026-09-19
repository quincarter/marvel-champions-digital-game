/**
 * Wasp Hero Pack curation. Evidence abbreviations:
 * - "raw": the pack's own cached raw record (`packages/content/raw/marvelcdb/wsp.json`).
 * - "phase7 wave2 §N": docs/phase7-wave2.md section N.
 *
 * Normalizes cleanly with no hand corrections needed for the parser (survey, 2026-09-18): Nadia Van Dyne/Wasp's
 * Giant inside face (13001c) folds into `additionalHeroForms` the same way Ant-Man's does (docs/phase7-wave2.md
 * §1.1). One real errata was missing from MarvelCDB's cached text (docs/phase7-wave2.md §5.2, RRG 1.8 p. 66):
 * Beetle's "choose to either spend" must read "the defeating player chooses to either spend" — MarvelCDB's
 * cached text is still the pre-errata wording.
 *
 * **Starter deck curated from a photo**: the Wasp Deck title-card back, printed decklist
 * (https://hallofheroeslcg.com/wp-content/uploads/2020/12/waspstarterdeck.jpg, linked from
 * https://hallofheroeslcg.com/wasp/), viewed directly and cross-checked item-by-item against raw (wsp.json) by
 * name and quantity — every item matched exactly, no hand corrections needed.
 */
import type { PackCuration } from "./types.ts";

export const WSP_CURATION: PackCuration = {
  packCode: "wsp",
  cycle: { id: "cycle1", name: "The Rise of Red Skull", order: 2 },
  pack: {
    name: "Wasp",
    releaseDate: "2021-01-22",
    releaseDateSource: "Hall of Heroes Wasp page (https://hallofheroeslcg.com/wasp/): \"Release date: January 22, 2021\"",
  },
  outDir: "src/data/wsp",
  exportPrefix: "WSP",

  corrections: [],
  errata: [
    {
      code: "13028",
      version: "RRG 1.8 p. 66",
      changedFields: ["text"],
      note:
        'Beetle\'s "choose to either spend a [physical] resource or shuffle Beetle into the encounter deck" reads "the defeating player chooses to either spend a [physical] resource or shuffle Beetle into the encounter deck." — MarvelCDB\'s cached text is still the pre-errata wording.',
      evidence: "raw (13028); RRG 1.8 p. 66; docs/phase7-wave2.md §5.2",
      currentReplace: {
        find: "choose to either spend a [physical] resource or shuffle Beetle into the encounter deck.",
        replace: "the defeating player chooses to either spend a [physical] resource or shuffle Beetle into the encounter deck.",
      },
    },
  ],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "wsp-aggression",
      name: "Wasp (Aggression) — Hero Pack starter deck",
      identityCode: "13001a",
      aspect: "aggression",
      cards: {
        // Hero cards (13002-13010), each at its printed kit quantity.
        "13002": 1, "13003": 2, "13004": 3, "13005": 2, "13006": 2, "13007": 2, "13008": 1, "13009": 1, "13010": 1,
        // Aggression aspect cards.
        "13011": 1, "13012": 1, "13013": 3, "13014": 3, "13015": 2, "13016": 3, "13017": 3,
        // Basic cards.
        "13018": 1, "13019": 1, "13020": 1, "13021": 1, "13022": 1, "13023": 1, "13024": 2, "13025": 1,
      },
      obligationCode: "13026",
      nemesisCodes: ["13027", "13028", "13029", "13030"],
      verified: true,
      sources: [
        "Wasp Deck title-card back, printed decklist (https://hallofheroeslcg.com/wp-content/uploads/2020/12/waspstarterdeck.jpg, linked from https://hallofheroeslcg.com/wasp/)",
      ],
    },
  ],
};
