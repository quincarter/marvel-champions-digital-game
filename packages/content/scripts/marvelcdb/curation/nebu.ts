/**
 * Nebula Hero Pack (Cycle 4) curation.
 *
 * - **`22017` ("The Power of Justice") quantity correction**: MarvelCDB sends `quantity: 1` for this record, but
 *   Hall of Heroes' Nebula starter-deck reference card (https://hallofheroeslcg.com/wp-content/uploads/2021/09/
 *   nebula-starter-deck.jpg, transcribed below) lists "17 The Power of Justice x2", and the card's own printed
 *   text is "Max 2 per deck" (no errata) — the same shape as every other pack's analogous "Power of X"/aspect
 *   resource card (e.g. Star-Lord's `17018` "The Power of Leadership", which sends `quantity: 2`). Corrected via
 *   `quantityInSet` below, not treated as errata (the card always had two physical copies; MarvelCDB's own
 *   `quantity` field for this one pack's `duplicate_of_code: "01062"` record undercounts it).
 *
 * - **`22011` ("Eros") errata (RRG 1.8 p. 67)**: "Should read: 'Response: After you play Eros from your hand, for
 *   each [mental] resource you used to pay for him, choose a minion and confuse it.' (Revised wording to function
 *   as intended with updated 'for each' rules.)" MarvelCDB's cached text is still the pre-errata wording ("confuse
 *   a minion for each [mental] resource...", no `errata` field set on the raw record) — applied forward via
 *   `currentReplace` below. The pack's other three errata entries (Cosmo #20, Old Rivals #31 here; James Rhodes
 *   #1B in `warm.ts`; Aragorn #7/Shieldmaiden #11/Beguiled #31 in `valk.ts`; Machine Man #22 in `vision.ts`) are
 *   already reflected in MarvelCDB's cached text (each carries its own raw `errata` note confirming it), so no
 *   further curation was needed for those.
 *
 * Starter deck curated wave 4 (below).
 */
import type { PackCuration } from "./types.ts";

export const NEBU_CURATION: PackCuration = {
  packCode: "nebu",
  cycle: { id: "cycle4", name: "Cycle 4", order: 4 },
  pack: {
    name: "Nebula",
    releaseDate: "2021-09-17",
    releaseDateSource:
      'Hall of Heroes Nebula page (https://hallofheroeslcg.com/nebula/): "Release date: September 17, 2021"',
  },
  outDir: "src/data/nebu",
  exportPrefix: "NEBU",

  corrections: [
    {
      code: "22017",
      reason:
        'MarvelCDB sends quantity: 1 for "The Power of Justice", but the pack\'s own printed starter-deck reference ' +
        'card lists two copies ("17 The Power of Justice x2") and the card text itself reads "Max 2 per deck" — ' +
        "matching every other pack's analogous resource card (2 physical copies), not a genuine one-copy print.",
      evidence:
        'Hall of Heroes Nebula release page (https://hallofheroeslcg.com/nebula/), "Starter Deck" link: ' +
        "https://hallofheroeslcg.com/wp-content/uploads/2021/09/nebula-starter-deck.jpg — image transcribed " +
        "directly (card-data-pipeline, wave 4). Cross-checked against Star-Lord's 17018 (same role, quantity: 2).",
      quantityInSet: 2,
    },
  ],
  errata: [
    {
      code: "22011",
      version: "RRG 1.8 p. 67",
      changedFields: ["text"],
      note:
        'Eros\' Response "confuse a minion for each [mental] resource you used to pay for him" reads "for each ' +
        '[mental] resource you used to pay for him, choose a minion and confuse it" — the updated "for each" rules ' +
        "wording (letting each resource confuse a separately-chosen minion). MarvelCDB's cached text is still the " +
        "pre-errata wording.",
      evidence: 'raw (22011, no `errata` field set); RRG 1.8 p. 67 Appendix V "NEBULA HERO PACK" / "EROS (#11)"',
      currentReplace: {
        find: "confuse a minion for each [mental] resource you used to pay for him.",
        replace: "for each [mental] resource you used to pay for him, choose a minion and confuse it.",
      },
    },
  ],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "nebula-justice",
      name: "Nebula (Justice) — starter deck",
      identityCode: "22001a",
      aspect: "justice",
      cards: {
        // Nebula cards (22002-22010), Hall of Heroes starter-deck image ("Nebula Deck"): "Gamora, Nebula's Ship,
        // Cutthroat Ambition x2, Evasive Maneuvering, Unyielding Persistence, Weapons Master x2, Wide Stance x2,
        // Combat Ready x2, Lethal Intent x3". 15 hero cards.
        "22002": 1,
        "22003": 1,
        "22004": 2,
        "22005": 1,
        "22006": 1,
        "22007": 2,
        "22008": 2,
        "22009": 2,
        "22010": 3,
        // Justice cards: "Eros, Wraith, Venom, Justice Served x3, One Way or Another x3, Determination, The
        // Power of Justice x2, Brains Over Brawn x3, Heroic Intuition x2". 17 aspect cards.
        "22011": 1,
        "22012": 1,
        "22013": 1,
        "22014": 3,
        "22015": 3,
        "22016": 1,
        "22017": 2,
        "22018": 3,
        "22019": 2,
        // Basic cards: "Cosmo, Knowhere, Daughters of Thanos, First Aid x2, Energy, Genius, Strength". 8 basic
        // cards. 15 + 17 + 8 = 40.
        "22020": 1,
        "22021": 1,
        "22022": 1,
        "22023": 2,
        "22024": 1,
        "22025": 1,
        "22026": 1,
      },
      obligationCode: "22027",
      nemesisCodes: ["22028", "22029", "22030", "22031"],
      verified: true,
      sources: [
        'Hall of Heroes Nebula release page (https://hallofheroeslcg.com/nebula/), "Starter Deck" link: ' +
          "https://hallofheroeslcg.com/wp-content/uploads/2021/09/nebula-starter-deck.jpg — image transcribed " +
          "directly (card-data-pipeline, wave 4).",
        "MarvelCDB public API card records for the nebu pack (packages/content/raw/marvelcdb/nebu.json) — cross-" +
          "checked every card's quantityInSet/deckLimit against the transcribed deck (see the 22017 correction above " +
          "for the one mismatch found).",
      ],
      note:
        "40 cards = 15 Nebula + 17 Justice + 8 Basic, matching the printed deck-list card's own counts. Nemesis set " +
        "(Gamora minion, Self-Preservation, Lethal Weapon, Old Rivals x2) matches the identity's own nemesisEncounterSetId.",
    },
  ],
};
