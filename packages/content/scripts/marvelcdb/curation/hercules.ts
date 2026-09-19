/**
 * Hercules Hero Pack (Cycle 10) curation.
 *
 * **Curated but NOT registered for emission** — the Labor Deck (below) needs a schema decision; see "Schema
 * requests for game-rules-architect" in docs/phase7-wave2-data.md.
 *
 * - **The Gift Deck (59005–59007: Nemean Lion Skin, Shield of Perseus, Sword of Peleus) resolved via
 *   `auxiliaryHeroSetCodes`** (`hercules_gift_deck` → `hercules`), the same mechanism as `storm.ts`'s Weather
 *   Deck / `iceman.ts`'s Frostbite. Each card's dash cost is the same confirmed pattern (a Permanent upgrade
 *   whose own "Response: After this card enters play, draw 4 cards." shows it enters play by effect, not paid
 *   for — MarvelCDB's own "Cost: —" listing on each).
 * - **The Labor Deck (59002 Defeat the Hydra, 59003 Embody Pathos, 59004 Protect Humanity, and likely more
 *   unsurveyed codes in the same `hercules_labor_deck` set) is NOT curatable — a real schema gap, not a data
 *   error.** Each prints `faction_code: "hero"` (an identity-specific card, like the Gift Deck) but is typed
 *   `attachment`/`obligation` and behaves exactly like an *encounter* card: "Victory 0.", a `When Revealed:`
 *   trigger that searches for and attaches/plays itself, no resource cost, no deck slot. This is Hercules' own
 *   "Labors" mechanic — a personal quest deck built from encounter-shaped cards that belong to his hero kit, not
 *   the shared encounter deck. `AttachmentCard`/`ObligationCard` (`packages/content/src/schema/cards/
 *   encounter-cards.ts`) assume `faction_code: "encounter"`; there's no schema shape yet for a hero-owned
 *   encounter-shaped card, or for the "Labor deck" itself as a place these enter play from (closest existing
 *   precedent: `PlayerCardCommon.separateDeck`/`IdentitySeparateDeck`, but those are ordinary player cards, not
 *   encounter-shaped ones). Flagged as a consolidated schema request rather than guessed at.
 */
import type { PackCuration } from "./types.ts";

export const HERCULES_CURATION: PackCuration = {
  packCode: "hercules",
  cycle: { id: "cycle10", name: "Cycle 10", order: 10 },
  pack: {
    name: "Hercules",
    releaseDate: "2026-02-20",
    releaseDateSource: 'Hall of Heroes Hercules page (https://hallofheroeslcg.com/hercules/): "Release date: February 20, 2026"',
  },
  outDir: "src/data/hercules",
  exportPrefix: "HERCULES",

  corrections: [
    {
      code: "59005",
      reason: "Nemean Lion Skin is a Permanent upgrade whose own Response (\"After this card enters play, draw 4 cards\") shows it enters play by effect, not paid for from hand: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 \"Dash (Value)\", p. 15), not a data gap.",
      evidence: "MarvelCDB card listing (marvelcdb.com/card/59005), \"Cost: —\"",
      specialCost: "dash",
    },
    {
      code: "59006",
      reason: "Shield of Perseus — same Gift Deck reasoning as 59005.",
      evidence: "MarvelCDB card listing (marvelcdb.com/card/59006), \"Cost: —\"",
      specialCost: "dash",
    },
    {
      code: "59007",
      reason: "Sword of Peleus — same Gift Deck reasoning as 59005.",
      evidence: "MarvelCDB card listing (marvelcdb.com/card/59007), \"Cost: —\"",
      specialCost: "dash",
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],

  auxiliaryHeroSetCodes: {
    hercules_gift_deck: "hercules",
  },
};
