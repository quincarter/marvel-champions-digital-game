import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  addCounters,
  after,
  alterEgoAction,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  defineAbilities,
  divide,
  doublesResourcesWhilePayingFor,
  draw,
  eachPlayer,
  eventResult,
  eventTarget,
  exhaustThis,
  forEachPlayer,
  handCountOf,
  heal,
  heroAction,
  heroInterrupt,
  heroResponse,
  host,
  ifElse,
  ifThen,
  interrupt,
  isAlterEgo,
  modifyBasicPower,
  moveCards,
  cards,
  on,
  anyOf,
  playFromHandReducingCost,
  playOnlyIf,
  preventDamage,
  query,
  ready,
  reduceNextCardCost,
  removeAllCounters,
  removeThreat,
  response,
  returnToHandAfterResolving,
  self,
  stun,
  thatPlayer,
  valueAtMost,
  varOf,
  when,
  whenDefeated,
  YOUR_IDENTITY,
  you,
  youAreNamed,
  youHaveTrait,
  yourIdentity,
  zone,
  canTakeStatus,
} from "../../dsl/index.js";

const AERIAL = trait("AERIAL");
const X_FORCE = trait("X-FORCE");
const X_MEN = trait("X-MEN");

/**
 * Angel's signature allies, supports, upgrades, resources and side scheme (42002, 42008-42013, 42017-42020, 42022,
 * 42023): docs/phase7-wave7.md §7.2, §3.62, §3.68, §3.71.
 *
 * - **Psylocke (42002)**: Hero Response, so only in a hero face; the face showing picks the branch (Angel heals her,
 *   Archangel readies the hero). The unique rule against a Psylocke identity is the engine's (RRG "Unique Icon").
 * - **Avian Anatomy (42008)**: an any-form response to spending this card for an AERIAL event; the event is returned
 *   to hand after it resolves (it still counts as played, so Angel's responses and The Power of Flight answer it).
 * - **Worthington Industries (42009)**: the AERIAL card is a required pick, as Betsy Braddock's (41001b) PSIONIC card.
 * - **Techno-Organic Wings (42010)**: "from your hand" is the engine's: the cost reduction waits for the next AERIAL
 *   card played, and a card played from hand is the only one it is read on.
 * - **Elixir (42011)**: the either-trait restriction as a constant (§3.71). "Another friendly character" is any
 *   player's identity or ally but Elixir.
 * - **Warpath (42013)**: Toughness is data; a "Hero Action" event is played from hand at its full cost.
 * - **Cannonball (42020)**: "reduce that amount by X" is preventing up to X of the consequential damage.
 * - **Angel's Aerie (42018)**: counters are fatigue counters on the card; "you" defend is the identity.
 * - **Containment Strategy (42019)**: "Max 1 per side scheme" is data (`maxPerHost`). A hero that took no damage is read
 *   as 0 damage dealt to it by the attack.
 * - **Render Medical Aid (42017)**: each player divides 5 healing among their own identity and allies.
 */
export const ANGEL_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "42002.psylocke-response": heroResponse(
    after.attacks("self"),
    ifThen(youAreNamed("Angel"), heal(1, self)),
    ifThen(youAreNamed("Archangel"), ready(yourIdentity)),
  ),

  "42008.avian-anatomy-response": response(
    on.youSpendThis({ toPlay: query("event", { trait: AERIAL }) }),
    returnToHandAfterResolving(eventTarget),
  ),

  "42009.worthington-industries-action": action(
    { cost: exhaustThis },
    chooseCards("card", zone("discard", you, { filter: query([], { trait: AERIAL }) }), { min: 1, max: 1 }),
    moveCards(cards(chosen("card")), "deckShuffle"),
    ifThen(isAlterEgo(), draw(1)),
  ),

  "42010.techno-organic-wings-action": heroAction(
    { cost: exhaustThis },
    ifThen(youAreNamed("Angel"), ready(yourIdentity)),
    ifThen(youAreNamed("Archangel"), reduceNextCardCost(you, 2, "phase", query("event", { trait: AERIAL }))),
  ),

  "42011.elixir-constant": constant(playOnlyIf(anyOf(youHaveTrait(X_FORCE), youHaveTrait(X_MEN)))),
  "42011.elixir-response": response(
    after.attacksOrThwarts("self"),
    chooseTarget("friend", query(["identity", "ally"], { controller: "any", excluding: self })),
    heal(1, chosen("friend")),
  ),

  "42012.siryn-response": response(
    after.attacks("self"),
    chooseTarget("minion", query("minion", canTakeStatus("stunned"))),
    stun(chosen("minion")),
  ),

  "42013.warpath-response": heroResponse(
    after.defends({ self: true }),
    playFromHandReducingCost(0, you, { filter: query("event", { abilityTiming: ["heroAction"] }) }),
  ),

  "42017.when-defeated": whenDefeated(
    forEachPlayer(
      eachPlayer,
      divide("heal", 5, query(["identity", "ally"], { controlledBy: thatPlayer }), { chooser: thatPlayer }),
    ),
  ),

  "42018.angels-aerie-response": response(after.defends(YOUR_IDENTITY), addCounters("fatigue", 1)),
  "42018.angels-aerie-action": alterEgoAction(
    { cost: removeAllCounters("fatigue", { bind: "removed" }) },
    heal(varOf("removed"), yourIdentity),
  ),

  "42019.containment-strategy-response": response(
    after.defends(query("hero", { controller: "any" })),
    removeThreat(ifElse(valueAtMost(eventResult("damage"), 0), 2, 1), host),
  ),

  "42020.cannonball-interrupt": interrupt(
    when.damage("self", { consequential: true }),
    preventDamage(handCountOf(you, query([], { trait: AERIAL }))),
  ),

  "42022.the-power-of-flight-constant": constant(doublesResourcesWhilePayingFor({ trait: AERIAL })),

  "42023.soaring-acrobatics-interrupt": heroInterrupt(
    on.basicPowerUsing(query(["identity", "ally"], { trait: AERIAL, controller: "you" })),
    { cost: exhaustThis },
    modifyBasicPower(1),
  ),
});
