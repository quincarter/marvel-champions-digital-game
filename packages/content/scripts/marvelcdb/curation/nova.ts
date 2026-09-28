/**
 * Nova (Sam Alexander) Hero Pack curation. Cycle 5 per the Hall of Heroes card database navigation
 * (https://hallofheroeslcg.com/browse/): Nova, Ironheart, Spider-Ham, Peni Parker/SP//dr, in that release order.
 *
 * Normalizes cleanly with no hand corrections needed once the Requirement multi-icon parser fix (wave 2 schema
 * pass §6.1, docs/phase7-wave2.md) landed — the Spider-Man ally's identical Requirement text is reused here.
 *
 * **Precon (docs/phase7-wave5.md §1.9, §5; docs/phase7-wave5-sources.md §5):** transcribed 2026-09-26 from the
 * pack's own printed decklist card, "Nova Deck", https://hallofheroeslcg.com/wp-content/uploads/2022/05/deck1.jpeg
 * (fetched via `scripts/fetch_card_art.py grab`, viewed directly, not stored — CLAUDE.md "Content & IP
 * boundaries"). Every card code and quantity cross-checked against `raw/marvelcdb/nova.json`'s own `quantity`/
 * `deck_limit` fields (all 8 hero-kit cards at their full printed quantity, matching `normalizeStarterDecks`'
 * exact-kit-quantity rule); no second source found (no MarvelCDB community decklist for this pack as of this
 * pass) — flagged in `note` rather than silently treated as fully cross-checked.
 *
 * **"Bring the War!" (28022, side scheme) has no MarvelCDB text** (`text`/`real_text` both null, checked
 * 2026-09-26 — docs/phase7-wave5.md §1.9). Transcribed from the card's own MarvelCDB bundle image
 * (`https://marvelcdb.com/bundles/cards/28022.png`, fetched via `scripts/fetch_card_art.py grab`, viewed directly
 * 2026-09-26, not stored). No errata in RRG 1.8 pp. 67–68 covers this card; the transcribed text matches ruling
 * Jan 11, 2026 (3) ("Bring the War! vs Supernova Helmet"), which describes a When Revealed discarding cards with
 * a printed [wild] resource.
 */
import type { PackCuration } from "./types.ts";

export const NOVA_CURATION: PackCuration = {
  packCode: "nova",
  cycle: { id: "cycle5", name: "Sinister Motives", order: 5 },
  pack: {
    name: "Nova",
    releaseDate: "2022-05-20",
    releaseDateSource:
      'Hall of Heroes Sam Alexander/Nova page (https://hallofheroeslcg.com/sam-alexander-nova/): "Release date: May 20, 2022"',
  },
  outDir: "src/data/nova",
  exportPrefix: "NOVA",

  corrections: [
    {
      code: "28022",
      reason:
        "MarvelCDB's `text`/`real_text` are both null for \"Bring the War!\" — transcribed verbatim from the card's own MarvelCDB bundle image.",
      evidence:
        'https://marvelcdb.com/bundles/cards/28022.png, fetched via scripts/fetch_card_art.py grab and viewed directly 2026-09-26 (not stored — CLAUDE.md "Content & IP boundaries"); cross-checked against ruling Jan 11, 2026 (3) ("Bring the War! vs Supernova Helmet"), marvel-champions-rulings-post-rrg-1-7.md, which describes the same When Revealed discarding cards with a printed [wild] resource.',
      textReplace: {
        find: "",
        replace:
          "When Revealed: Each player discards 1 card they control with a printed [wild] resource. For each card discarded this way, place 1 threat here.",
      },
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "nova-aggression",
      name: "Nova (Aggression) — Nova Hero Pack starter deck",
      identityCode: "28001a",
      aspect: "aggression",
      cards: {
        "28002": 1, // Ms. Marvel
        "28003": 2, // Forcefield Projection
        "28004": 3, // Lightspeed Flight
        "28005": 3, // Pot Shot
        "28006": 2, // Unleash Nova Force
        "28007": 2, // Connection to the Worldmind
        "28008": 1, // Jesse Alexander
        "28009": 1, // Supernova Helmet
        "28010": 1, // The Locust
        "28011": 2, // Chase Them Down
        "28012": 3, // Pitchback
        "28013": 3, // No Quarter
        "28014": 3, // One by One
        "28015": 2, // The Power of Aggression
        "28016": 3, // Fluid Motion
        "28017": 3, // Honed Technique
        "28018": 1, // Moon Girl
        "28019": 3, // Everyday Hero
        "28020": 1, // Champions Mobile Bunker
      },
      obligationCode: "28021",
      nemesisCodes: ["28022", "28023", "28024", "28025"],
      verified: true,
      sources: [
        'Nova Hero Pack printed decklist card, "Nova Deck" (https://hallofheroeslcg.com/wp-content/uploads/2022/05/deck1.jpeg, linked from the Hall of Heroes Nova page, https://hallofheroeslcg.com/sam-alexander-nova/), transcribed 2026-09-26',
      ],
      note: "No second (MarvelCDB community decklist or rulebook) source found for this pack's precon as of this pass — single-sourced from the pack's own printed decklist card.",
    },
  ],
};
