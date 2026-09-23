import { cardId, type CardId } from "@mc/content";
import type { GameSetupConfig } from "@mc/engine";
import { wave3Scenario, type Wave3ScenarioOptions } from "../setup.js";

/**
 * Gamora has no `StarterDeck` yet (`GAM_STARTER_DECKS` is empty — data-only, blocked on the Gamora insert not
 * being in the repo, docs/phase7-wave3.md §0/§4). This is a hand-built stand-in deck for tests: every non-reprint,
 * non-obligation/nemesis `gam` card at its printed deck limit (`packages/content/src/data/gam/cards.ts`), no
 * aspect cards. `wave3Scenario`'s own player shape accepts an explicit `{ identityCardId, deck, aspects }` seat
 * (its fallback to `coreScenario` already supports this — only a `starterDeckId` seat is special-cased).
 *
 * **Not a legality claim.** Deckbuilding legality (RRG 1.8 Appendix I) is `card-data-pipeline`/`rules-qa-engineer`
 * territory (the `hlk`/`thor` precedent, `wave1/hlk/hulk.test.ts`'s own `hulkGameWithExtras` comment); every test
 * using this seat sets `requireLegalDecks: false` on the resulting config, the same way those two do for their own
 * added filler.
 */
const GAMORA_DECK: readonly { readonly card: CardId; readonly quantity: number }[] = [
  { card: cardId("18002"), quantity: 1 }, // Nebula (ally, unique)
  { card: cardId("18003"), quantity: 2 }, // Acrobatic Move
  { card: cardId("18004"), quantity: 2 }, // Crosscounter
  { card: cardId("18005"), quantity: 2 }, // Set the Pace
  { card: cardId("18006"), quantity: 2 }, // Decisive Blow
  { card: cardId("18007"), quantity: 2 }, // Forward Momentum
  { card: cardId("18008"), quantity: 1 }, // Conditioning Room (unique support)
  { card: cardId("18009"), quantity: 2 }, // Keen Instincts
  { card: cardId("18010"), quantity: 1 }, // Gamora's Sword (unique, restricted)
  { card: cardId("18011"), quantity: 1 }, // Angela (ally, unique)
  { card: cardId("18012"), quantity: 3 }, // Clobber
  { card: cardId("18013"), quantity: 3 }, // Plan of Attack
  { card: cardId("18014"), quantity: 3 }, // Uppercut (reprint)
  { card: cardId("18015"), quantity: 3 }, // First Hit
  { card: cardId("18016"), quantity: 3 }, // Impede
  { card: cardId("18017"), quantity: 3 }, // Combat Training (reprint)
  { card: cardId("18018"), quantity: 1 }, // Godslayer (unique, restricted)
  { card: cardId("18019"), quantity: 1 }, // Drax (ally, unique)
  { card: cardId("18020"), quantity: 3 }, // Hit and Run
  { card: cardId("18021"), quantity: 1 }, // Energy
  { card: cardId("18022"), quantity: 1 }, // Genius
  { card: cardId("18023"), quantity: 1 }, // Strength
  { card: cardId("18029"), quantity: 3 }, // Pivotal Moment
  { card: cardId("18030"), quantity: 3 }, // Comms Implant
  { card: cardId("18031"), quantity: 3 }, // True Grit
  { card: cardId("18032"), quantity: 3 }, // Enhanced Reflexes (reprint)
];

/** Gamora's identity card as a `wave3Scenario` player seat, with the stand-in deck above. */
export const GAMORA_SEAT = {
  identityCardId: cardId("18001a"),
  deck: GAMORA_DECK.flatMap(({ card, quantity }) => Array.from({ length: quantity }, () => card)),
  aspects: ["aggression"] as const,
};

/**
 * `wave3Scenario`, seated with `GAMORA_SEAT`, and `requireLegalDecks` dropped (see the module docblock). `players`
 * lets a two-player test add a second seat (Sibling Rivalry's `player` scoping needs one).
 */
export function gamoraScenario(
  scenarioId: string,
  options: Omit<Wave3ScenarioOptions, "players"> & {
    readonly extraPlayers?: readonly Wave3ScenarioOptions["players"][number][];
  },
): GameSetupConfig {
  const { extraPlayers, ...rest } = options;
  const config = wave3Scenario(scenarioId, { ...rest, players: [GAMORA_SEAT, ...(extraPlayers ?? [])] });
  return { ...config, requireLegalDecks: false };
}
