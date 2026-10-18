import type { AbilityRegistry } from "@mc/engine";
import {
  boost,
  chooseTarget,
  chosen,
  constant,
  dealDamage,
  defineAbilities,
  each,
  enemyScheme,
  engage,
  eventAmount,
  exists,
  findCard,
  forcedInterrupt,
  ifThen,
  inPlay,
  moveCards,
  named,
  on,
  placeThreat,
  query,
  response,
  revealCard,
  rule,
  self,
  statOf,
  surge,
  threatOn,
  valueAtLeast,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  yourIdentity,
  cards,
  instead,
  you,
} from "../../../dsl/index.js";

const KINGPIN = "Kingpin";
/** Echo's nemesis minion (60061), as against the Kingpin villain of the box: only the minion can be found. */
const KINGPIN_MINION = query("minion", { name: KINGPIN });
/**
 * "Kingpin" in 60060-60064 means Echo's nemesis minion 61 (RRG 1.8 "Referential Ability", p. 36: cards associated with the
 * same identity, nemesis set included, outrank encounter cards; June 25, 2026 Ruling 4 (1)); a card removed from the game
 * does not interact with the game (p. 36 "Removed from the Game"). The only other Kingpin-titled enemy is the Kingpin
 * villain, who appears only in the Kingpin scenario, where the minion is removed at setup, so matching any enemy titled
 * Kingpin gives that result in every real game. A future card adding another Kingpin-titled enemy would need an
 * out-of-play check for the minion.
 */
const KINGPIN_ENEMY = query("enemy", { name: KINGPIN });
/** "The Maya Lopez player": the engaged player's identity is Echo's, in either form. */
const MAYA_LOPEZ_PLAYER = query("identity", { controller: "you", anyOf: [{ name: "Echo" }, { name: "Maya Lopez" }] });

/**
 * "Find Kingpin and put him into play engaged with you." Kingpin already in play is not put into play again: he
 * engages the revealing player and keeps everything on him (RRG 1.8 "Find", p. 19; "Engage", p. 18, as wave 10's
 * Fantastic Powers). Otherwise he is looked for in the encounter deck, discard pile and set-aside cards and enters play
 * engaged with the player (the encounter deck is shuffled when it was searched, RRG "Search", p. 39). Kingpin the
 * minion is Echo's nemesis and is unique (RRG 1.8 "Unique Icon", pp. 45-46: while one is in play a second cannot be);
 * the Kingpin villain's scenario removes the minion from the game at setup (MC60 p. 23), so there nothing is found
 * (docs/phase7-wave11-scenarios.md section S4.0).
 */
const findKingpin = [
  ifThen(exists(KINGPIN_MINION), engage(each(KINGPIN_MINION), you), findCard(KINGPIN_MINION, "play")),
];

/**
 * Echo's obligation and nemesis set (60060-60064), docs/phase7-wave11.md section 7.2 and 8.4 line 9.
 *
 * Cards (5):
 * - 60060 Raised by the Kingpin (obligation)
 * - 60061 Kingpin (minion)
 * - 60062 Master Manipulator (side_scheme)
 * - 60063 Kingpin's Henchman (minion)
 * - 60064 Pawn of the Kingpin (treachery)
 *
 * **Raised by the Kingpin (60060)**: "Give to the Maya Lopez player" is engine data
 *   (`HeroIdentityCard.obligationCardId`); the obligation stays in that player's play area. Its printed constant,
 *   "You cannot deal damage to Kingpin", has no ability id of its own on the card, so it is carried by
 *   `60060.obligation`: a `cannotTakeDamage` on Kingpin from Echo's identity and its extensions (events, upgrades,
 *   RRG 1.8 "You, Your", p. 49). Her allies are not "you" and still can. The Response puts the threat she thwarts on
 *   this card as well (the scheme loses it as always); at 4 or more the card is removed from the game.
 * **Kingpin (60061)**: the interrupt replaces his attack on the Maya Lopez player with a scheme (RRG 1.8
 *   "Replacement Effect", p. 37; "'Would'", p. 48). Against any other player he attacks.
 * **Master Manipulator (60062)**, **Kingpin's Henchman (60063)**: "Kingpin cannot take damage" by name.
 * **Pawn of the Kingpin (60064)**: the form is the revealing player's.
 */
export const FNE_ECHO_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "60060.obligation": constant(
    rule({ kind: "cannotTakeDamage", target: KINGPIN_ENEMY, fromSource: { extensionOf: you } }),
  ),
  "60060.when-revealed": whenRevealed(...findKingpin),
  "60060.raised-by-the-kingpin-response": response(
    on.thwarts(query("identity", { controller: "you" })),
    ifThen(valueAtLeast(eventAmount, 1), placeThreat(eventAmount, self)),
    ifThen(valueAtLeast(threatOn(self), 4), moveCards(cards(self), "removedFromGame")),
  ),

  "60061.kingpin-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("self", { againstYou: true }),
    { would: true },
    ifThen(exists(MAYA_LOPEZ_PLAYER), instead(enemyScheme(self, { against: you }))),
  ),

  "60062.master-manipulator-constant": constant(rule({ kind: "cannotTakeDamage", target: KINGPIN_ENEMY })),
  "60062.when-revealed": whenRevealed(...findKingpin),
  "60062.boost": boost(ifThen(inPlay(KINGPIN), revealCard(self, you))),

  "60063.kingpins-henchman-constant": constant(rule({ kind: "cannotTakeDamage", target: KINGPIN_ENEMY })),

  "60064.when-revealed-alter-ego": whenRevealedAlterEgo(ifThen(inPlay(KINGPIN), enemyScheme(named(KINGPIN)), surge())),
  "60064.when-revealed-hero": whenRevealedHero(
    chooseTarget("hero", query("hero")),
    dealDamage(statOf(yourIdentity, "atk"), chosen("hero")),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const FNE_ECHO_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
