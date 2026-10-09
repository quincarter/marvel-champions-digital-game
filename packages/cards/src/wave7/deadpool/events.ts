import type { AbilityRegistry, EffectSpec } from "@mc/engine";
import {
  accelerationTokensOn,
  addAccelerationToken,
  anAttackableEnemy,
  action,
  attack,
  attackAnEnemy,
  cancelRevealedCard,
  chooseOne,
  chooseTarget,
  chosen,
  confuse,
  controllerOf,
  countBoostIcons,
  damageAnEnemy,
  damageOn,
  dealDamage,
  defineAbilities,
  draw,
  each,
  encounterIconsInPlay,
  eventAmount,
  eventTarget,
  exhaust,
  exists,
  forcedResponse,
  heroAction,
  heroInterrupt,
  ifThen,
  inHand,
  instead,
  interrupt,
  modifyStat,
  on,
  option,
  preventDamage,
  query,
  ready,
  refMatches,
  remainingHpOf,
  removeThreat,
  removeThreatFromAScheme,
  setVar,
  stun,
  sum,
  takeAnyDamageCost,
  takeDamage,
  theMainScheme,
  theVillain,
  thwart,
  thwartAScheme,
  valueAtLeast,
  varOf,
  when,
  YOUR_IDENTITY,
  yourIdentity,
} from "../../dsl/index.js";

/**
 * Deadpool's signature events (44003-44006, 44012) and the 'Pool events 44017-44023: docs/phase7-wave7.md §7.3.
 *
 * - **Exhausting Personality (44003)**: a choice between two cost-then-effect branches. The second is offered only
 *   while some identity is ready (its cost can be paid), and the identity may be any player's (June 2, 2026 - Ruling 5).
 * - **Maximum Effort (44004) / "Yoo-Hoo!" (44006)**: the payer picks the damage (0 to remaining hit points, Q46 = B);
 *   the effect reads it as `cost.damageSelf`. Taking all of it "defeats" him, his own forced interrupt replaces that,
 *   and the effect still resolves from alter-ego form (the form is checked on initiation).
 * - **Metaknowledge (44005)**: the icons are counted before the card is cancelled and discarded.
 * - **This Card is Fire (44012)**: the forced response is `inHand` and hears the end of its controller's turn the way
 *   Sap Power (21029) does; X is read when the attack resolves.
 * - **Barely a Scratch (44017), Da Bomb (44019), 'Pool Inspection (44023)**: the four encounter icons counted across
 *   every card in play (§3.77). Da Bomb and 'Pool Inspection read the count once, after their first sentence.
 * - **"I Got This" (44021)**: the four icon lines are the body of the one Hero Action (the data emits them as four
 *   constant refs, a card-data fix, see coverage.test.ts), in printed order, each resolved if able.
 * - **Not my Responsibility (44022)**: "you or your ally" is a choice among the controller's identity and the allies
 *   the controller controls; `taken` so that no "additional damage" bonus applies (nothing deals it).
 */
const TOKENS = accelerationTokensOn(theMainScheme);

export const DEADPOOL_EVENTS: AbilityRegistry = defineAbilities({
  "44003.exhausting-personality-action": heroAction(
    chooseOne(
      option("Place 1 acceleration token on the main scheme: stun and confuse the villain", [
        addAccelerationToken(),
        stun(theVillain),
        confuse(theVillain),
      ]),
      option(
        "Exhaust a player's identity: that player draws 1 card per acceleration token",
        { when: exists(query("identity", { exhausted: false })) },
        [
          chooseTarget("who", query("identity", { exhausted: false })),
          exhaust(chosen("who")),
          draw(TOKENS, controllerOf(chosen("who"))),
        ],
      ),
    ),
  ),

  "44004.maximum-effort-action": heroAction(
    { label: "attack", cost: takeAnyDamageCost(remainingHpOf(yourIdentity)) },
    attackAnEnemy(varOf("cost.damageSelf")),
  ),

  "44005.metaknowledge-interrupt": heroInterrupt(
    on.encounterCardRevealed(),
    countBoostIcons(eventTarget, "revealed"),
    setVar("icons", sum(varOf("revealed.boostIcons"), { kind: "starIcons", cards: eventTarget })),
    cancelRevealedCard(),
    takeDamage(varOf("icons")),
  ),

  "44006.yoo-hoo-action": heroAction(
    { label: "thwart", cost: takeAnyDamageCost(remainingHpOf(yourIdentity)) },
    thwartAScheme(varOf("cost.damageSelf")),
  ),

  "44012.this-card-is-fire-forced-response": inHand(
    forcedResponse({ on: "turnEnding", playerIs: "controller" }, takeDamage(1)),
  ),
  "44012.this-card-is-fire-action": heroAction({ label: "attack" }, attackAnEnemy(damageOn(yourIdentity))),

  "44017.barely-a-scratch-interrupt": heroInterrupt(
    when.damage(YOUR_IDENTITY, { fromAttack: true }),
    { label: "defense" },
    preventDamage(encounterIconsInPlay()),
  ),

  "44018.cutupper-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    attack(5, chosen("enemy")),
    // An enemy the attack defeated has left play, so there is nothing to stun.
    ifThen(refMatches(chosen("enemy"), query("enemy")), stun(chosen("enemy"))),
  ),

  "44019.da-bomb-action": heroAction(
    dealDamage(10, theVillain),
    setVar("icons", encounterIconsInPlay()),
    dealDamage(varOf("icons"), each(query("enemy"))),
    dealDamage(varOf("icons"), each(query("hero"))),
  ),

  "44020.get-rage-y-action": action(
    chooseTarget("ally", query("ally")),
    ready(chosen("ally")),
    modifyStat("atk", 1, chosen("ally"), "endOfPhase"),
  ),

  "44021.i-got-this-action": heroAction(
    ifThen(valueAtLeast(encounterIconsInPlay(["crisis"]), 1), damageAnEnemy(3)),
    ifThen(valueAtLeast(encounterIconsInPlay(["acceleration"]), 1), removeThreatFromAScheme(2)),
    ifThen(valueAtLeast(encounterIconsInPlay(["amplify"]), 1), [
      chooseTarget("ally", query("ally", { controller: "you" })),
      ready(chosen("ally")),
    ]),
    ifThen(valueAtLeast(encounterIconsInPlay(["hazard"]), 1), draw(1)),
  ),

  "44022.not-my-responsibility-interrupt": interrupt(
    when.threatPlaced(),
    instead(chooseTarget("who", { categories: ["identity", "ally"], controller: "you" }), {
      ...(dealDamage(eventAmount, chosen("who")) as EffectSpec & { kind: "dealDamage" }),
      taken: true,
    }),
  ),

  "44023.pool-inspection-action": heroAction(
    { label: "thwart" },
    thwart(5, theMainScheme, { ignoreCrisis: true }),
    setVar("icons", encounterIconsInPlay()),
    removeThreat(varOf("icons"), each(query("scheme"))),
  ),
});
