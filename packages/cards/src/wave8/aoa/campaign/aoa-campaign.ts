import type { AbilityRegistry } from "@mc/engine";
import {
  alterEgoAction,
  boost,
  constant,
  coveredByEngineRule,
  dealAsEncounterCard,
  defineAbilities,
  draw,
  exhaustYourHero,
  forcedResponse,
  inHand,
  moveCards,
  cards,
  on,
  query,
  revealCard,
  rule,
  self,
  you,
} from "../../../dsl/index.js";

/**
 * Campaign-only encounter set `aoa_campaign` (campaign mode only; docs/phase7-wave8.md §1.28, §3.42).
 *
 * North American Sea Wall (45177): Hinder 2[per_hero], Surge and Victory 2 are data. "The villain cannot take
 *   damage" is a standing `cannotTakeDamage` on the villain while the scheme is in play (Kang's Dominion, `toafk`
 *   11023, is the same rule). The Boost deals the card to the player the activation is against as a facedown
 *   encounter card (`dealAsEncounterCard`, the way You Dare Oppose Me? deals a card): "you" in a boost is that player.
 * Panicked Refugees (45178): An obligation that lives in a player's deck by campaign instruction (section 2.14,
 *   not this module's job). "Give to" is absent, so the obligation ref is engine data (`coveredByEngineRule`); the
 *   Forced Response is the card's own hand ability on `cardEntersHand`: reveal it (an obligation then stays in that
 *   player's play area, wave 7 section 3.70), then draw 1 card. A draw counts as entering the hand (owner decision,
 *   2026-10-08, section 4.1 row 76: the engine draws an obligation with this text into the hand instead of placing
 *   it by RRG p. 30), so the same ability answers a draw. The Alter-Ego Action is the controller's only (RRG
 *   p. 30): exhaust the identity, remove this card from the game (this game, not the campaign).
 *
 * Cards (2):
 * - 45177 North American Sea Wall (side_scheme)
 * - 45178 Panicked Refugees (obligation)
 */
export const AOA_CAMPAIGN: AbilityRegistry = defineAbilities({
  // The villain cannot take damage.
  "45177.north-american-sea-wall-constant": constant(rule({ kind: "cannotTakeDamage", target: query("villain") })),
  // [star] Boost: Deal this card to yourself as a facedown encounter card.
  "45177.boost": boost(dealAsEncounterCard(self, you)),

  "45178.obligation": coveredByEngineRule(),
  // Forced Response: After this card enters your hand, reveal it. Then, draw 1 card.
  "45178.panicked-refugees-forced-response": inHand(forcedResponse(on.thisEntersYourHand(), revealCard(self), draw(1))),
  // Alter-Ego Action: Exhaust your identity -> remove this card from the game.
  "45178.panicked-refugees-action": alterEgoAction(
    { cost: exhaustYourHero },
    moveCards(cards(self), "removedFromGame"),
  ),
});

/** Unregistered refs and why, with the engine queue task (spec section 8.2) each waits on. Empty: both cards are scripted. */
export const AOA_CAMPAIGN_SKIPPED: Readonly<Record<string, string>> = {};
