/**
 * Spider-Ham (Peter Porker) Hero Pack (Cycle 5) curation.
 *
 * - **Warrior of the Great Web (30029, upgrade): `HostQualifiers.titleContains`**, landed by
 *   `game-rules-architect` (docs/phase7-wave2.md §7.3) — "Attach to a character with 'Spider' in its title. Max
 *   1 per character." now parses to `{ kind: "qualified", category: "character", titleContains: "Spider" }` +
 *   `playRestrictions.maxPerHost: 1`. No corrections needed; normalizes cleanly.
 *
 * **Precon (docs/phase7-wave5.md §1.9, §5; docs/phase7-wave5-sources.md §5):** transcribed 2026-09-26 from the
 * pack's own printed decklist card, "Spider-Ham Deck", https://hallofheroeslcg.com/wp-content/uploads/2022/07/sd.jpg
 * (fetched via `scripts/fetch_card_art.py grab`, viewed directly, not stored — CLAUDE.md "Content & IP
 * boundaries"). Every card code and quantity cross-checked against `raw/marvelcdb/spiderham.json`'s own
 * `quantity`/`deck_limit` fields (all 10 hero-kit cards at full printed quantity); no second source found for
 * this pack's precon as of this pass.
 */
import type { PackCuration } from "./types.ts";

export const SPIDERHAM_CURATION: PackCuration = {
  packCode: "spiderham",
  cycle: { id: "cycle5", name: "Cycle 5", order: 5 },
  pack: {
    name: "Spider-Ham",
    releaseDate: "2022-07-15",
    releaseDateSource:
      'Hall of Heroes Spider-Ham/Peter Porker page (https://hallofheroeslcg.com/spider-ham-peter-porker/): "Release date: July 15, 2022"',
  },
  outDir: "src/data/spiderham",
  exportPrefix: "SPIDERHAM",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "spiderham-justice",
      name: "Spider-Ham (Justice) — Spider-Ham Hero Pack starter deck",
      identityCode: "30001a",
      aspect: "justice",
      cards: {
        "30002": 1, // Captain Americat
        "30003": 2, // Ham It Up
        "30004": 1, // Hogwashed
        "30005": 1, // "I Don't Think So!"
        "30006": 2, // Petulant Pig
        "30007": 3, // Swinging Web Pig
        "30008": 1, // The Daily Beagle
        "30009": 2, // Cartoon Physics
        "30010": 1, // Huge Wooden Hammer
        "30011": 1, // Organic Webbing
        "30012": 1, // Lady Spider
        "30013": 1, // Spider-Man (Pavitr Prabhakar)
        "30014": 3, // Even the Odds
        "30015": 2, // Great Responsibility
        "30016": 3, // Making an Entrance
        "30017": 3, // One Way or Another
        "30018": 3, // Followed
        "30019": 3, // Overwatch
        "30020": 1, // Scarlet Spider
        "30021": 1, // SP//dr
        "30022": 3, // Team-Building Exercise
        "30023": 1, // Web of Life and Destiny
      },
      obligationCode: "30024",
      nemesisCodes: ["30025", "30026", "30027", "30028"],
      verified: true,
      sources: [
        'Spider-Ham Hero Pack printed decklist card, "Spider-Ham Deck" (https://hallofheroeslcg.com/wp-content/uploads/2022/07/sd.jpg, linked from the Hall of Heroes Spider-Ham page, https://hallofheroeslcg.com/spider-ham-peter-porker/), transcribed 2026-09-26',
      ],
      note: "No second (MarvelCDB community decklist or rulebook) source found for this pack's precon as of this pass — single-sourced from the pack's own printed decklist card.",
    },
  ],
};
