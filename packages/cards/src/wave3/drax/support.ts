import { cardId, type CardId } from "@mc/content";
import type { GameSetupConfig } from "@mc/engine";
import { wave3Scenario, type Wave3ScenarioOptions } from "../setup.js";

/**
 * Drax has no `StarterDeck` yet (`DRAX_STARTER_DECKS` is empty — data-only, blocked on the Drax insert not being
 * in the repo, docs/phase7-wave3.md §0/§2.1). This is a hand-built stand-in deck for tests, the `gam/support.ts`
 * precedent: every non-reprint, non-obligation/nemesis `drax` card at its printed deck limit
 * (`packages/content/src/data/drax/cards.ts`), spanning every aspect this pack itself prints (`protection`,
 * `basic`, `aggression`, `justice`, `leadership`) rather than one chosen aspect — not a legality claim, only a
 * fixture that reaches every registered ability.
 *
 * **Not a legality claim.** Deckbuilding legality (RRG 1.8 Appendix I) is `card-data-pipeline`/`rules-qa-engineer`
 * territory (the `hlk`/`thor` precedent, `wave1/hlk/hulk.test.ts`'s own `hulkGameWithExtras` comment); every test
 * using this seat sets `requireLegalDecks: false` on the resulting config, the same way `gam/support.ts` does.
 */
const DRAX_DECK: readonly { readonly card: CardId; readonly quantity: number }[] = [
  { card: cardId("19002"), quantity: 1 }, // Mantis (ally, unique)
  { card: cardId("19003"), quantity: 2 }, // "Fight Me, Coward!"
  { card: cardId("19004"), quantity: 2 }, // Intimidation
  { card: cardId("19005"), quantity: 2 }, // Knife Leap
  { card: cardId("19006"), quantity: 2 }, // Parry
  { card: cardId("19007"), quantity: 2 }, // Payback
  { card: cardId("19008"), quantity: 1 }, // Drax's Knife (unique, restricted)
  { card: cardId("19009"), quantity: 1 }, // Drax's Other Knife (unique, restricted)
  { card: cardId("19010"), quantity: 1 }, // DWI Theet Mastery
  { card: cardId("19011"), quantity: 1 }, // Too Stubborn to Die
  { card: cardId("19012"), quantity: 1 }, // Martyr (ally, unique)
  { card: cardId("19013"), quantity: 1 }, // Moondragon (ally, unique)
  { card: cardId("19014"), quantity: 3 }, // Counter-Punch (reprint)
  { card: cardId("19015"), quantity: 3 }, // Deflection
  { card: cardId("19016"), quantity: 3 }, // Hard Knocks
  { card: cardId("19017"), quantity: 3 }, // Leading Blow
  { card: cardId("19018"), quantity: 3 }, // Subdue
  { card: cardId("19019"), quantity: 3 }, // Indomitable (reprint)
  { card: cardId("19020"), quantity: 1 }, // Gamora (ally, unique, requires guardian trait — Drax has it)
  { card: cardId("19021"), quantity: 3 }, // Athletic Conditioning (reprint)
  { card: cardId("19022"), quantity: 1 }, // Energy
  { card: cardId("19023"), quantity: 1 }, // Genius
  { card: cardId("19024"), quantity: 1 }, // Strength
  { card: cardId("19030"), quantity: 3 }, // "Bring It!"
  { card: cardId("19031"), quantity: 3 }, // "Think Fast!"
  { card: cardId("19032"), quantity: 3 }, // Regroup
  { card: cardId("19033"), quantity: 3 }, // Enhanced Physique (reprint)
];

/** Drax's identity card as a `wave3Scenario` player seat, with the stand-in deck above. */
export const DRAX_SEAT = {
  identityCardId: cardId("19001a"),
  deck: DRAX_DECK.flatMap(({ card, quantity }) => Array.from({ length: quantity }, () => card)),
  aspects: ["protection"] as const,
};

/**
 * `wave3Scenario`, seated with `DRAX_SEAT`, and `requireLegalDecks` dropped (see the module docblock). `players`
 * lets a two-player test add a second seat.
 */
export function draxScenario(
  scenarioId: string,
  options: Omit<Wave3ScenarioOptions, "players"> & {
    readonly extraPlayers?: readonly Wave3ScenarioOptions["players"][number][];
  },
): GameSetupConfig {
  const { extraPlayers, ...rest } = options;
  const config = wave3Scenario(scenarioId, { ...rest, players: [DRAX_SEAT, ...(extraPlayers ?? [])] });
  return { ...config, requireLegalDecks: false };
}
