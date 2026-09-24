import { cardId, type CardId } from "@mc/content";
import type { GameSetupConfig } from "@mc/engine";
import { wave3Scenario, type Wave3ScenarioOptions } from "../setup.js";

/**
 * Venom has no `StarterDeck` yet (`VNM_STARTER_DECKS` is empty — data-only, blocked on the Venom insert not being
 * in the repo, docs/phase7-wave3.md §0/§4, the same reason `gam`'s own `support.ts` has none). This is a
 * hand-built stand-in deck for tests: every non-reprint, non-obligation/nemesis `vnm` card at its printed deck
 * limit (`packages/content/src/data/vnm/cards.ts`). `wave3Scenario`'s own player shape accepts an explicit
 * `{ identityCardId, deck, aspects }` seat.
 *
 * **Not a legality claim.** Deckbuilding legality (RRG 1.8 Appendix I) is `card-data-pipeline`/`rules-qa-engineer`
 * territory; this deck spans several aspects (Venom's own signature cards plus Justice, Basic, Aggression,
 * Leadership and Protection cards, since the printed kit is spread across all five) — every test using this seat
 * sets `requireLegalDecks: false` on the resulting config, the same way `gam`'s own `support.ts` does for the
 * identical reason.
 */
const VENOM_DECK: readonly { readonly card: CardId; readonly quantity: number }[] = [
  { card: cardId("20002"), quantity: 2 }, // Behind Enemy Lines
  { card: cardId("20003"), quantity: 2 }, // Grasping Tendrils
  { card: cardId("20004"), quantity: 1 }, // Locked and Loaded
  { card: cardId("20005"), quantity: 3 }, // Run and Gun
  { card: cardId("20006"), quantity: 2 }, // Savage Attack
  { card: cardId("20007"), quantity: 1 }, // Project Rebirth 2.0 (unique support)
  { card: cardId("20008"), quantity: 1 }, // Multi-Gun (unique, restricted)
  { card: cardId("20009"), quantity: 1 }, // Spider-Sense
  { card: cardId("20010"), quantity: 2 }, // Venom's Pistol (restricted)
  { card: cardId("20011"), quantity: 1 }, // Jack Flag (ally, unique)
  { card: cardId("20012"), quantity: 3 }, // Scare Tactic
  { card: cardId("20013"), quantity: 3 }, // Making an Entrance
  { card: cardId("20014"), quantity: 2 }, // The Power of Justice (reprint)
  { card: cardId("20015"), quantity: 3 }, // Sonic Rifle (restricted, Uses)
  { card: cardId("20016"), quantity: 1 }, // Star-Lord (ally, unique)
  { card: cardId("20017"), quantity: 1 }, // Energy
  { card: cardId("20018"), quantity: 1 }, // Genius
  { card: cardId("20019"), quantity: 1 }, // Strength
  { card: cardId("20020"), quantity: 3 }, // Resourceful (reprint)
  { card: cardId("20021"), quantity: 3 }, // Side Holster
  { card: cardId("20022"), quantity: 3 }, // Plasma Pistol (restricted, Uses)
  { card: cardId("20026"), quantity: 3 }, // Fusillade
  { card: cardId("20027"), quantity: 3 }, // "Welcome Aboard"
  { card: cardId("20028"), quantity: 3 }, // Shake it Off
  { card: cardId("20029"), quantity: 3 }, // Crew Quarters
];

/** Venom's identity card as a `wave3Scenario` player seat, with the stand-in deck above. */
export const VENOM_SEAT = {
  identityCardId: cardId("20001a"),
  deck: VENOM_DECK.flatMap(({ card, quantity }) => Array.from({ length: quantity }, () => card)),
  aspects: ["justice"] as const,
};

/**
 * `wave3Scenario`, seated with `VENOM_SEAT`, and `requireLegalDecks` dropped (see the module docblock). `players`
 * lets a two-player test add a second seat.
 */
export function venomScenario(
  scenarioId: string,
  options: Omit<Wave3ScenarioOptions, "players"> & {
    readonly extraPlayers?: readonly Wave3ScenarioOptions["players"][number][];
  },
): GameSetupConfig {
  const { extraPlayers, ...rest } = options;
  const config = wave3Scenario(scenarioId, { ...rest, players: [VENOM_SEAT, ...(extraPlayers ?? [])] });
  return { ...config, requireLegalDecks: false };
}
