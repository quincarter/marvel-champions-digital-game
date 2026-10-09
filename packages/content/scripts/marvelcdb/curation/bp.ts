/**
 * Black Panther/Shuri Hero Pack (Cycle 9) curation. Evidence abbreviations:
 * - "raw": the pack's own cached raw record (`packages/content/raw/marvelcdb/bp.json`).
 * - "card image": the printed card, viewed directly at `https://marvelcdb.com/bundles/cards/<code>.jpg`
 *   (verification only, no bytes stored — CLAUDE.md "Content & IP boundaries").
 *
 * Not to be confused with Core's own Black Panther (T'Challa) — this is the later (2025) Shuri hero pack, Cycle 9
 * per the Hall of Heroes card database navigation (https://hallofheroeslcg.com/browse/).
 *
 * **Parser fix landed alongside this pack, not curation-specific** (`parse-text.ts`, `normalize/player-cards.ts`):
 * the printed keyword "Linked (Card Title)." (RRG 1.8 p. 27, "cards with the linked keyword cannot be included in
 * a player's deck") was never recognized at all — it fell through as plain text, and a Linked card's missing
 * `deck_limit` failed the "must have a positive deck_limit" check with no exemption. Redemption (51036, "Linked
 * (Show of Empathy). Victory 0.") is this pack's example and the first Linked card this pipeline has ingested;
 * the fix is generic (any pack, any Linked card), not scoped to Black Panther.
 *
 * One curated correction: Redemption's printed dash cost, confirmed against the card image (no numbered cost
 * circle at top-left, just a horizontal dash — matches RRG 1.8 "Dash (Value)", p. 15, and a Linked card entering
 * play only "by the card title in the parentheses following the keyword" rather than being played from hand).
 */
import type { PackCuration } from "./types.ts";

export const BP_CURATION: PackCuration = {
  packCode: "bp",
  cycle: { id: "cycle9", name: "Agents of S.H.I.E.L.D.", order: 9 },
  pack: {
    name: "Black Panther/Shuri",
    releaseDate: "2025-05-02",
    releaseDateSource:
      'Hall of Heroes Black Panther/Shuri page (https://hallofheroeslcg.com/black-panther-shuri/): "Release date: May 2, 2025"',
  },
  outDir: "src/data/bp",
  exportPrefix: "BP",

  corrections: [
    {
      code: "51036",
      reason:
        'Redemption prints a dash cost (RRG 1.8 "Dash (Value)", p. 15) — it is a Linked card, brought into play by Show of Empathy rather than played from hand.',
      evidence:
        "raw (51036, no cost field at all); card image (marvelcdb.com/bundles/cards/51036.jpg, a dash where a cost circle would be)",
      specialCost: "dash",
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "bp-justice",
      name: "Black Panther (Justice) — Black Panther Hero Pack starter deck",
      identityCode: "51001a",
      aspect: "justice",
      cards: {
        "51002": 1, // T'Challa
        "51003": 2, // Clawed Strike
        "51004": 2, // On the Prowl
        "51005": 1, // Wakanda Forever!
        "51006": 2, // Vibranium
        "51007": 1, // The Elephant's Trunk
        "51008": 1, // Queen Ramonda
        "51009": 1, // Aja-Adanna
        "51010": 1, // Kimoyo Beads
        "51011": 1, // Panther Claws
        "51012": 1, // Spider Bites
        "51013": 1, // Vibranium Suit
        "51014": 1, // Manifold
        "51015": 3, // Infiltration
        "51016": 1, // Going Undercover
        "51017": 1, // Show of Empathy
        "51018": 1, // The Raft
        "51019": 3, // Invisibility Gear
        "51020": 3, // Sonic Rifle
        "51021": 3, // Sting Operation
        "51022": 1, // Aneka
        "51023": 1, // Ayo
        "51024": 1, // Okoye
        "51025": 1, // Heart of the Panther
        "51026": 1, // Build Support
        "51027": 1, // Energy
        "51028": 1, // Genius
        "51029": 1, // Strength
        "51030": 1, // Dora Milaje
      },
      obligationCode: "51031",
      nemesisCodes: ["51032", "51033", "51034", "51035"],
      verified: true,
      sources: [
        'Hall of Heroes "Starter Deck" decklist card image for this pack (wp-content/uploads/2026/01), read card by card and transcribed in docs/phase7-wave9-data-survey.md section 6.2',
      ],
      note: "40 cards by script: 15 Black Panther hero cards, the justice aspect cards and basic cards from the printed decklist (identity, obligation and nemesis set excluded). Printed card numbers equal the codes' last digits. Copies come from raw/marvelcdb/bp.json quantities except where the deck prints fewer than the pack contains.",
    },
  ],
};
