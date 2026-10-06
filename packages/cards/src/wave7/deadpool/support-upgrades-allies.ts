import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  accelerationTokensOn,
  action,
  anAttackableEnemy,
  anEnemy,
  attack,
  attachCard,
  attacksGainKeywords,
  chooseTarget,
  chosen,
  constant,
  controllerOf,
  costModifier,
  damageOn,
  dealDamage,
  defeat,
  defineAbilities,
  enemyAttacksEnemy,
  eventTarget,
  exhaustThis,
  forcedInterrupt,
  fromAnyAspect,
  gets,
  heal,
  heroAction,
  ifElse,
  instead,
  moveCards,
  cards,
  not,
  on,
  outsideFact,
  product,
  query,
  ready,
  response,
  searchCollection,
  self,
  setRemainingHitPoints,
  changeForm,
  spend,
  swapCards,
  takeDamageCost,
  theMainScheme,
  thisCardGenerates,
  min,
  valueAtMost,
  valueEquals,
  host,
  when,
  whenDefeated,
  yourIdentity,
} from "../../dsl/index.js";

const ELITE = trait("ELITE");
const WEAPON = trait("WEAPON");
const A_WEAPON_UPGRADE = { categories: ["upgrade"], aspects: fromAnyAspect, traits: [WEAPON] } as const;

/** "1 more for each acceleration token on the main scheme, to a maximum of 3" (Montage, Cable). */
const TOKENS_TO_3 = min(accelerationTokensOn(theMainScheme), 3);

/** Triple with no damage sustained, double with less than 5, otherwise as printed (the three Self resources). */
const SELF_FACTOR = ifElse(
  valueEquals(damageOn(yourIdentity), 0),
  3,
  ifElse(valueAtMost(damageOn(yourIdentity), 4), 2, 1),
);

/**
 * Deadpool's allies, support, upgrades, resources and player side scheme (44002, 44007-44011, 44013-44016,
 * 44024-44030): docs/phase7-wave7.md §7.3, §3.76, §3.78-§3.81, §3.83.
 *
 * - **Cable (44002)**: +1 THW and +1 ATK per acceleration token on the main scheme, to +3 (the token count, not icons).
 * - **Montage (44007)**: 1 additional [wild] per token to 3, added before any multiplier; the printed icon stays one.
 * - **Self Confidence / Control / Preservation (44025-44027)**: "sustained less than 5" is at most 4 damage on your
 *   identity right now; triple with none. The printed resource is multiplied (1, so 3 / 2 / 1).
 * - **Armed to the Teeth (44009)**: the search is the response; the Action swaps the attachment with a WEAPON upgrade
 *   you control (RRG "Swap", p. 42). Collection rule: spec Q47 = A. The facedown attachment is out of play (RRG "In
 *   Play and Out of Play", p. 23), so this is a swap between an in-play card and an out-of-play one.
 * - **Headpool (44014)**: the minion must still be in play, so the response needs the attack not to have defeated it.
 * - **It Ain't Over... (44011)**: +2 target threat per token on the attached main scheme (data host `mainScheme`).
 * - **Git Gud (44028)**: the cost reduction is read in hand (spec Q48: absent means did not win). The forced interrupt
 *   answers any player's identity defeat; it and Deadpool's own interrupt are both pending when he would be defeated,
 *   and the first one the first player orders replaces the defeat.
 * - **Live Dangerously (44024)**: Victory 0 and the icons are data; +2 hand size for every identity.
 */
export const DEADPOOL_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "44002.cable-constant": constant(gets("thw", TOKENS_TO_3, { self: true }), gets("atk", TOKENS_TO_3, { self: true })),

  "44007.montage-constant": constant(thisCardGenerates({ additional: { resource: "wild", amount: TOKENS_TO_3 } })),

  "44008.chimichanga-truck-response": response(
    { ...on.basicPowerUsed(query("identity")), eventIs: { power: "recover" } },
    { cost: exhaustThis },
    ready(eventTarget),
  ),

  "44009.armed-to-the-teeth-response": response(
    on.youPlayThis(),
    searchCollection(A_WEAPON_UPGRADE, "found"),
    attachCard(chosen("found"), self, { facedown: true }),
  ),
  "44009.armed-to-the-teeth-action": action(
    { cost: exhaustThis },
    chooseTarget("weapon", query("upgrade", { trait: WEAPON, controller: "you" })),
    swapCards({ kind: "each", query: { host: self, facedown: true } }, chosen("weapon")),
  ),

  "44010.deadpools-katana-action": heroAction(
    { label: "attack", cost: [exhaustThis, takeDamageCost(1)] },
    anAttackableEnemy(),
    attack(2, chosen("enemy"), { keywords: ["piercing"] }),
  ),

  "44011.it-aint-over-constant": constant(
    gets("targetThreat", product(2, accelerationTokensOn(host)), { hostOfSelf: true }),
  ),

  "44013.when-defeated": whenDefeated(anEnemy(), dealDamage(1, chosen("enemy"))),
  "44014.headpool-response": response(
    // Damaged and still standing: a minion his attack defeated is out of play and attacks nothing.
    { ...on.attacks("self", { target: query("minion"), damages: true }), resultsAtMost: { defeated: 0 } },
    chooseTarget("attacked", { categories: ["enemy"], attackableBy: eventTarget, excluding: eventTarget }),
    enemyAttacksEnemy(eventTarget, chosen("attacked")),
  ),
  "44015.kidpool-constant": constant(attacksGainKeywords(["piercing"], { attacker: { self: true } })),
  "44016.when-defeated": whenDefeated(
    chooseTarget("minion", query("minion", { withoutTrait: ELITE })),
    defeat(chosen("minion")),
  ),

  "44024.live-dangerously-constant": constant(gets("handSize", 2, query("identity"))),

  "44025.self-confidence-constant": constant(thisCardGenerates({ factor: SELF_FACTOR })),
  "44026.self-control-constant": constant(thisCardGenerates({ factor: SELF_FACTOR })),
  "44027.self-preservation-constant": constant(thisCardGenerates({ factor: SELF_FACTOR })),

  "44028.git-gud-constant": constant(
    costModifier({
      delta: -2,
      appliesTo: { self: true },
      activeIn: "hand",
      while: not(outsideFact("wonPreviousGame")),
    }),
  ),
  "44028.git-gud-forced-interrupt": forcedInterrupt(
    when.defeated(query("identity")),
    { would: true },
    instead(
      setRemainingHitPoints(1, eventTarget),
      changeForm(controllerOf(eventTarget), "alterEgo"),
      moveCards(cards(self), "removedFromGame"),
    ),
  ),

  "44029.healing-factor-response": response(on.phaseBeginning("player"), { cost: exhaustThis }, heal(2, yourIdentity)),

  "44030.stick-to-itiveness-action": heroAction({ cost: [spend({ physical: 1 }), exhaustThis] }, ready(yourIdentity)),
});
