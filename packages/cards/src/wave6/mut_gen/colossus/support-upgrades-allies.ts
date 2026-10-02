import { trait } from "@mc/content";
import {
  alterEgoAction,
  after,
  andThen,
  atEndOfRound,
  cards,
  chooseOne,
  chooseTarget,
  chosen,
  confuse,
  constant,
  defineAbilities,
  discard,
  discardDeckUntil,
  draw,
  exists,
  exhaustThis,
  forcedResponse,
  gets,
  giveTough,
  heroResponse,
  ifThen,
  ignores,
  interrupt,
  moveCards,
  ofIdentitySetTitled,
  option,
  preventDamage,
  query,
  ready,
  removeCounter,
  resource,
  response,
  returnToHandCost,
  self,
  spend,
  stun,
  theVillain,
  when,
  yourIdentity,
  youHaveTrait,
} from "../../../dsl/index.js";

const X_MEN = trait("X-MEN");
/** "Colossus": his hero face, as the printed text names him (never Piotr in alter-ego form). */
const COLOSSUS = query("identity", { name: "Colossus", controller: "you" });
const AN_X_MEN_CHARACTER = query("character", { trait: X_MEN });

/**
 * Colossus's supports, upgrades and allies (`mut_gen` 32002-32006, 32011-32013, 32019, 32020; docs/phase7-wave6.md
 * §3.5-§3.7). His events are `events.ts`.
 *
 * - **Iron Will (32004) / Organic Steel (32006)**: "After a tough status card is discarded from Colossus" is
 *   `on.statusDiscarded` (§3.5), announced once per card in one shared window (§4.1 Q5): a piercing attack that strips
 *   two tough cards offers Iron Will's draw twice, but Organic Steel exhausts as its cost, so it can pay only once.
 * - **Titanium Muscles (32005)**: the +1 ATK is scripted; its Hero Resource ("for each tough status card on Colossus")
 *   is not (`KNOWN_SKIPPED`): `generatesPerCard` counts cards in play, and Colossus can hold two tough cards.
 * - **Protective Training (32013)**: "+3 hit points" is scripted; "Max 1 Training upgrade per ally" is card data
 *   (`playRestrictions.maxWithTrait`, §3.28), enforced by the engine wherever a host is chosen.
 * - **The X-Jet (32020)**: a resource ability anyone may use (`forAnyPlayer`) whose `while` is read as the player
 *   spending it, so only a player whose identity has the X-MEN trait can spend it.
 * - **Professor X (32019)**: Nick Fury's shape (`01084`) with Professor X's options.
 */
export const COLOSSUS_SUPPORT_UPGRADES_ALLIES = defineAbilities({
  // Shadowcat: ignores the guard and patrol keywords, and any crisis icons.
  "32002.shadowcat-constant": constant(ignores({ self: true }, ["guard", "patrol", "crisis"])),

  // Piotr's Studio: "until you discard a Colossus card" is his identity set; nothing found leaves the "add" unresolved
  // (RRG 1.8 "'Then'", p. 44).
  "32003.piotrs-studio-action": alterEgoAction(
    { cost: exhaustThis },
    discardDeckUntil(query(["ally", "event", "upgrade", "support"], { ...ofIdentitySetTitled("Colossus") }), "found"),
    andThen(moveCards(cards(chosen("found")), "hand")),
  ),

  "32004.iron-will-constant": constant(gets("thw", 1, { hostOfSelf: true })),
  "32004.iron-will-response": response(after.statusDiscarded("tough", COLOSSUS), draw(1)),

  "32005.titanium-muscles-constant": constant(gets("atk", 1, { hostOfSelf: true })),

  "32006.organic-steel-response": heroResponse(
    after.statusDiscarded("tough", COLOSSUS),
    { cost: [exhaustThis, removeCounter("steel")] },
    giveTough(yourIdentity),
  ),

  // Nightcrawler: damage from an enemy attack to any X-MEN character (the attack's damage, so a player's own attack
  // on an enemy is never it); the cost is a [energy] resource and returning himself to hand.
  "32011.nightcrawler-interrupt": interrupt(
    when.damage(AN_X_MEN_CHARACTER, { fromAttack: true }),
    { cost: [spend({ energy: 1 }), returnToHandCost(query("ally", { self: true }))] },
    preventDamage(),
  ),

  "32012.polaris-response": response(
    after.entersPlay("self"),
    chooseTarget("xmen", AN_X_MEN_CHARACTER),
    giveTough(chosen("xmen")),
  ),

  "32013.protective-training-constant": constant(gets("hp", 3, query("ally", { hostOfSelf: true }))),

  "32019.professor-x-forced-response": forcedResponse(
    after.entersPlay("self"),
    chooseOne(
      option("Confuse the villain", confuse(theVillain)),
      option(
        "Stun a minion",
        { when: exists(query("minion")) },
        chooseTarget("minion", query("minion")),
        stun(chosen("minion")),
      ),
      option(
        "Ready an X-MEN character",
        { when: exists(AN_X_MEN_CHARACTER) },
        chooseTarget("xmen", AN_X_MEN_CHARACTER),
        ready(chosen("xmen")),
      ),
    ),
    atEndOfRound(ifThen(exists({ self: true }), discard(self))),
  ),

  "32020.the-x-jet-resource": resource(1, { cost: exhaustThis, forAnyPlayer: true, while: youHaveTrait(X_MEN) }),
});
