import { trait } from "@mc/content";
import {
  after,
  alterEgoAction,
  andThen,
  anyOf,
  cannotActivate,
  cards,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  confuse,
  constant,
  costModifier,
  countersOn,
  damagedAtLeast,
  defineAbilities,
  discard,
  eventAmount,
  eventTarget,
  exhaustThis,
  exists,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  gainsTrait,
  gets,
  heal,
  ifThen,
  instead,
  interrupt,
  isAlterEgo,
  isHero,
  moveCards,
  moveThreat,
  named,
  on,
  option,
  placeDamage,
  printedHpOf,
  printedStatOf,
  query,
  ready,
  removeCountersFrom,
  removeThreat,
  response,
  self,
  setRemainingHitPoints,
  shuffleDeck,
  theMainScheme,
  treatAttachedMinionAsAlly,
  when,
  addCounters,
  you,
  youHaveTrait,
  YOUR_IDENTITY,
  yourIdentity,
  zone,
} from "../../../dsl/index.js";

const X_MEN = trait("X-MEN");
const MUTANT = trait("MUTANT");
const PSIONIC = trait("PSIONIC");
const AERIAL = trait("AERIAL");
const RESTRAINED = trait("RESTRAINED");
const UNLEASHED = trait("UNLEASHED");
const CONTROLLED = trait("CONTROLLED");
const PHOENIX_FORCE = named("Phoenix Force");
const THE_HOST_ALLY = query("ally", { hostOfSelf: true });
const THE_HOST_MINION = query("minion", { hostOfSelf: true });
const AN_X_MEN_ALLY = query("ally", { trait: X_MEN });

/**
 * Phoenix's supports, upgrades and allies (`phoenix` 34003-34009, 34014-34016, 34021, 34022, 34024; docs/phase7-wave6.md
 * §6.1, §3.28, §3.33-§3.35, §3.44). Her events (34010-34013, 34017-34019, 34032-34035) and the resource Passion for
 * Justice (34020) are not in this module.
 *
 * - **Cyclops (34003)**: the Forced Interrupt (the data's raw "Response" is corrected, §6.1 card data fixes) removes
 *   what Phoenix Force holds when he leaves play, up to 2.
 * - **Phoenix Suit (34005)**: "Phoenix gains the AERIAL trait" is the hero's name, so only in hero form; the two
 *   "While you have ..." grants read the identity's granted traits (Phoenix Force's RESTRAINED / UNLEASHED).
 * - **Rise from the Ashes (34006)**: removing the card from the game is the cost ("->"), paid first inside the
 *   `instead` (Too Stubborn to Die's shape, `wave3/drax`); "Remove each power counter from Phoenix Force" removing
 *   the last counter flips it to Unleashed's partner via its own forced response (§4.1 Q24).
 * - **Telekinetic Shield (34007)**: Crossbones' Armor's shape (`wave2/trors`): the damage is placed here, not taken.
 * - **Mental Paralysis (34008)**: "Hero form only" and "non-ELITE minion" are card data (§3.34 `cannotActivate`).
 * - **Mind Control (34009)**: `treatAttachedMinionAsAlly` (wave 4 §3.29).
 * - **Marvel Girl (34015)**: X is the attacked minion's printed SCH (§3.33), read before the attack resolves.
 * - **Mission Training (34016)**: "Max 1 TRAINING upgrade per ally" is `maxWithTrait` card data (§3.28).
 * - **Storm (34021)**: Angel's cost reduction; the move is an interrupt, so it is made before the thwart removes
 *   threat (Lady Spider's `excluding: eventTarget` for "another scheme").
 * - **Cerebro (34022)**: "Play only if your identity has the MUTANT trait" is card data.
 */
export const PHOENIX_SUPPORT_UPGRADES_ALLIES = defineAbilities({
  "34003.cyclops-response": response(after.entersPlay("self"), addCounters("power", 2, PHOENIX_FORCE)),
  "34003.cyclops-forced-interrupt": forcedInterrupt(
    when.leavesPlay("self"),
    removeCountersFrom(PHOENIX_FORCE, "power", 2),
  ),

  "34004.white-hot-room-action": alterEgoAction(
    { cost: exhaustThis },
    chooseOne(
      option("Place 1 power counter on Phoenix Force", addCounters("power", 1, PHOENIX_FORCE)),
      option("Heal 2 damage from Jean Grey", heal(2, yourIdentity)),
    ),
  ),

  "34005.phoenix-suit-constant": constant(gainsTrait(AERIAL, YOUR_IDENTITY, { while: isHero() })),
  "34005.phoenix-suit-constant-2": constant(
    gainsKeyword({ name: "steady" }, YOUR_IDENTITY, { while: youHaveTrait(RESTRAINED) }),
  ),
  "34005.phoenix-suit-constant-3": constant(
    gainsKeyword({ name: "retaliate", value: 1 }, YOUR_IDENTITY, { while: youHaveTrait(UNLEASHED) }),
  ),

  "34006.rise-from-the-ashes-interrupt": interrupt(
    when.defeated("host"),
    instead(
      moveCards(cards(self), "removedFromGame"),
      ready(yourIdentity),
      setRemainingHitPoints(printedHpOf(yourIdentity), yourIdentity),
      removeCountersFrom(PHOENIX_FORCE, "power", countersOn(PHOENIX_FORCE, "power")),
    ),
  ),

  "34007.telekinetic-shield-forced-interrupt": forcedInterrupt(
    when.damage("host", { fromAttack: true }),
    instead(placeDamage(eventAmount, self), andThen(ifThen(damagedAtLeast(self, 5), discard(self)))),
  ),

  "34008.mental-paralysis-constant": constant(cannotActivate(THE_HOST_MINION)),
  "34008.mental-paralysis-forced-response": forcedResponse(
    { ...on.youChangeIdentityForm(), eventIs: { change: "identity", to: "alterEgo" } },
    ifThen(isAlterEgo(), discard(self)),
  ),

  "34009.mind-control-constant": constant(treatAttachedMinionAsAlly([CONTROLLED], 1)),

  "34014.banshee-response": response(
    on.thwarts("self"),
    chooseTarget("minion", query("minion")),
    confuse(chosen("minion")),
  ),

  "34015.marvel-girl-interrupt": interrupt(
    on.attacks("self", { target: query("minion") }),
    removeThreat(printedStatOf(eventTarget, "sch"), theMainScheme),
  ),

  "34016.mission-training-constant": constant(gets("thw", 1, THE_HOST_ALLY), gets("hp", 2, THE_HOST_ALLY)),

  "34021.storm-constant": constant(
    costModifier({
      delta: -1,
      appliesTo: query("ally", { self: true }),
      while: anyOf(youHaveTrait(MUTANT), youHaveTrait(X_MEN)),
      activeIn: "hand",
    }),
  ),
  "34021.storm-interrupt": interrupt(
    on.thwarts("self"),
    chooseTarget("scheme", query("scheme", { excluding: eventTarget })),
    moveThreat(eventTarget, chosen("scheme"), { amount: 2 }),
  ),

  "34022.cerebro-action": alterEgoAction(
    { cost: exhaustThis },
    ifThen(
      exists(query("character", { controller: "you", trait: PSIONIC })),
      chooseCards("found", zone("deck", you, { filter: AN_X_MEN_ALLY }), { min: 0, max: 1 }),
      chooseCards("found", zone("deck", you, { top: 5, filter: AN_X_MEN_ALLY }), { min: 0, max: 1 }),
    ),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),

  "34024.down-time-constant": constant(gets("rec", 2, query("alterEgo", { controller: "you" }))),
});
