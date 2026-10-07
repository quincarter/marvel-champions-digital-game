import { trait } from "@mc/content";
import type { AbilityRegistry, EventPattern } from "@mc/engine";
import {
  anyOfCards,
  attachCard,
  boost,
  cancelIt,
  chooseCards,
  chosen,
  confuse,
  constant,
  controllerOf,
  coveredByEngineRule,
  dealDamage,
  dealEncounterCard,
  defineAbilities,
  discard,
  each,
  forcedInterrupt,
  ifThen,
  inPlay,
  moveCards,
  named,
  not,
  otherPlayers,
  placeThreat,
  preventDamage,
  putIntoPlay,
  query,
  rule,
  scaled,
  self,
  shuffleDeck,
  stun,
  takeDamage,
  theMainScheme,
  valueAtLeast,
  varOf,
  victoryDisplayCards,
  victoryDisplayCount,
  when,
  whenRevealed,
  yourIdentity,
  you,
  zone,
  activatingEnemy,
  cards,
} from "../../../dsl/index.js";

const PSIONIC = trait("PSIONIC");
const PURGE = "Technovirus Purge";

/** "each side scheme in the victory display": player and encounter side schemes both count (docs/phase7-wave7.md §3.49). */
const SIDE_SCHEMES_IN_VICTORY_DISPLAY = victoryDisplayCount(query("sideScheme"));

/**
 * Cable's identity, whoever controls it and in either form. The two faces carry different titles (Cable / Nathan
 * Summers), so both names are matched; `named("Cable")` would return the first card in play with that title, which
 * can be another seat's card.
 */
const CABLE_IDENTITY_CARD = each(query("identity", { anyOf: [{ name: "Cable" }, { name: "Nathan Summers" }] }));
/** "The Cable player", however this ability's card came to be in play (an obligation, a side scheme, an attachment). */
const CABLE_PLAYER = controllerOf(CABLE_IDENTITY_CARD);
const OTHER_PLAYERS = otherPlayers(CABLE_PLAYER);
/** Anything a player's card does: their identity and its extensions (events, upgrades), or a character they control. */
const cardsOf = (player: typeof CABLE_PLAYER) => ({ anyOf: [{ extensionOf: player }, { controlledBy: player }] });

/** "When a player plays a PSIONIC event": any player, not only the Stryfe's engaged one (`on.youPlay` is "you"). */
const A_PLAYER_PLAYS_A_PSIONIC_EVENT: EventPattern = {
  on: "cardBeingPlayed",
  targetIs: query("event", { trait: PSIONIC }),
};

/**
 * Cable's obligation and nemesis set (40031-40036), docs/phase7-wave7.md §7.1, §3.49-§3.53, §3.60.
 *
 * - **Technovirus Resurgence (40031)**: "Give to the Nathan Summers player" is engine data
 *   (`HeroIdentityCard.obligationCardId`). When Revealed: if Technovirus Purge is not in play, search the deck,
 *   discard pile, hand and victory display (one pool) for it, put it into play (the player side scheme limit is
 *   checked as it enters, MC40 p. 21) and shuffle the deck. If Purge is in play (found or already), attach the
 *   obligation to it; otherwise discard the obligation and deal the player a facedown encounter card. Taking Purge out
 *   of the victory display ends its PSIONIC and stat bonus (§3.50).
 * - **Stryfe (40032)**, villainous: a forced interrupt to any player playing a PSIONIC event cancels the event's
 *   effects (the card is still played and discarded, RRG "Cancel", p. 11) and deals 1 damage to Stryfe.
 * - **Back to the Future (40033)**: four rules. The threat lines are `threatCannotBeRemoved` with `player`; the damage
 *   lines are `cannotTakeDamage` with `fromSource` naming the Cable player's cards (their identity and its extensions
 *   plus the characters they control). The villain is not engaged with anybody, so the Cable player cannot damage the
 *   villain (§4.1 Q36).
 * - **Telekinetic Force Field (40034)**: attaches to Stryfe, else the villain (`attachesTo` data). Forced Interrupt: prevent
 *   damage to the host, and discard at 2 or more prevented. Boost: attach to the activating enemy.
 * - **Mind Scan (40035)** / **Telekinetic Blast (40036)**: 2 + 1 per side scheme in the victory display; boosts
 *   confuse / stun.
 */
export const CABLE_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "40031.technovirus-resurgence-constant": coveredByEngineRule(),

  "40031.when-revealed": whenRevealed(
    ifThen(not(inPlay(PURGE)), [
      chooseCards(
        "purge",
        anyOfCards(
          zone(["deck", "discard", "hand"], you, { filter: query("sideScheme", { name: PURGE }) }),
          victoryDisplayCards(query("sideScheme", { name: PURGE })),
        ),
        { min: 1, max: 1 },
      ),
      putIntoPlay(chosen("purge")),
      shuffleDeck(),
    ]),
    ifThen(inPlay(PURGE), attachCard(self, named(PURGE)), [moveCards(cards(self), "discard"), dealEncounterCard(you)]),
  ),

  "40032.stryfe-forced-interrupt": forcedInterrupt(A_PLAYER_PLAYS_A_PSIONIC_EVENT, cancelIt(), dealDamage(1, self)),

  // "The Cable player cannot remove threat from schemes other than Back to the Future. Other players cannot remove
  // threat from Back to the Future."
  "40033.back-to-the-future-constant": constant(
    rule({
      kind: "threatCannotBeRemoved",
      target: query("scheme", { self: false }),
      player: CABLE_PLAYER,
    }),
    rule({ kind: "threatCannotBeRemoved", target: { self: true }, player: OTHER_PLAYERS }),
  ),

  // "The Cable player cannot damage enemies not engaged with them. Other players cannot damage minions engaged with
  // the Cable player."
  "40033.back-to-the-future-constant-2": constant(
    rule({
      kind: "cannotTakeDamage",
      target: query("enemy", { not: { engagedWithPlayer: CABLE_PLAYER } }),
      fromSource: cardsOf(CABLE_PLAYER),
    }),
    rule({
      kind: "cannotTakeDamage",
      target: query("minion", { engagedWithPlayer: CABLE_PLAYER }),
      fromSource: cardsOf(OTHER_PLAYERS),
    }),
  ),

  // "Forced Interrupt: When attached character would take any amount of damage, prevent that damage. If 2 or more
  // damage was prevented this way, discard this card."
  "40034.telekinetic-force-field-forced-interrupt": forcedInterrupt(
    when.damage("host"),
    preventDamage(undefined, { bind: "prevented" }),
    ifThen(valueAtLeast(varOf("prevented.amount"), 2), discard(self)),
  ),
  "40034.boost": boost(attachCard(self, activatingEnemy)),

  "40035.when-revealed": whenRevealed(placeThreat(scaled(SIDE_SCHEMES_IN_VICTORY_DISPLAY, { plus: 2 }), theMainScheme)),
  "40035.boost": boost(confuse(yourIdentity)),

  "40036.when-revealed": whenRevealed(takeDamage(scaled(SIDE_SCHEMES_IN_VICTORY_DISPLAY, { plus: 2 }))),
  "40036.boost": boost(stun(yourIdentity)),
});
