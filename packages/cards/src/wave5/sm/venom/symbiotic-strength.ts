import {
  activationIs,
  adjustBoostCount,
  boost,
  changeForm,
  defineAbilities,
  discard,
  enemyAttack,
  eventAmount,
  forcedInterrupt,
  forcedResponse,
  giveBoostCard,
  hasStatus,
  heroAction,
  host,
  ifThen,
  instead,
  modifyAttack,
  on,
  putIntoPlay,
  self,
  spend,
  stun,
  takeDamage,
  theVillain,
  valueAtLeast,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  yourIdentity,
} from "../../../dsl/index.js";

/**
 * Symbiotic Strength (`sm` 27164–27169, docs/phase7-wave5.md §2.2), Venom's own required non-modular set (also
 * usable elsewhere, per that section's own note): Improvised Weapons, Violent Tendencies, Webbed Up, Enraged
 * Symbiote, Swinging Assault and Unstable Sentience.
 */
export const SYMBIOTIC_STRENGTH = defineAbilities({
  // Improvised Weapons (27164, attachment to the villain; amplify is data) — Hero Action: Spend
  // [mental][physical][energy] resources → discard this card.
  "27164.improvised-weapons-action": heroAction({ cost: spend({ mental: 1, physical: 1, energy: 1 }) }, discard(self)),

  // Violent Tendencies (27165, attachment to the villain) — Forced Response: After attached villain takes any
  // amount of damage from an attack, give attached villain 1 facedown boost card. If that attack dealt 3 or more
  // damage to attached villain, discard this card.
  "27165.violent-tendencies-forced-response": forcedResponse(
    on.damage("host", { fromAttack: true, taken: true }),
    giveBoostCard(host),
    ifThen(valueAtLeast(eventAmount, 3), discard(self)),
  ),

  // Webbed Up (27166, attachment to your identity) — Forced Interrupt: When your hero would attack, discard Webbed
  // Up instead. Then you are stunned.
  "27166.webbed-up-constant": forcedInterrupt(
    on.basicPowerUsing("host", { power: "attack" }),
    instead(discard(self)),
    stun(yourIdentity),
  ),
  // [star] Boost: You are stunned. If you are already stunned, take 2 damage (`hasStatus` read before the new stun
  // is applied, `badoon.ts`'s own "if it already had a tough status card" precedent for reordering a printed
  // "already" check ahead of the effect that would make it trivially true).
  "27166.boost": boost(ifThen(hasStatus(yourIdentity, "stunned"), takeDamage(2)), stun(yourIdentity)),

  // Enraged Symbiote (27167, minion; Guard/Patrol are data) — [star] Boost: Put Enraged Symbiote into play engaged
  // with you.
  "27167.boost": boost(putIntoPlay(self)),

  // Swinging Assault (27168, treachery) — When Revealed (Alter-Ego): Change to hero form. The villain attacks you.
  // When Revealed (Hero): The villain attacks you. Give the villain 1 additional boost card for that activation.
  // **Unverified composition:** `modifyAttack({ extraBoostCards })` reads "the current activation" (`resolve/
  // apply-effect.ts`'s own `currentActivationFrameId`), which every other pack's use of it reaches from *inside* a
  // Boost ability (already nested in the ongoing activation) or a response/interrupt to an *already-initiated*
  // enemy attack — never from the same effect list as the `enemyAttack` that starts the activation in the first
  // place. No wave 5 card needing exactly this composition was found scripted elsewhere; `encounter-set.test.ts`
  // plays this card and asserts the villain's activation actually dealt 2 boost cards, so if the ordering below is
  // wrong the test (not a silent miss) catches it.
  "27168.when-revealed-alter-ego": whenRevealedAlterEgo(
    changeForm(you, "hero"),
    enemyAttack(theVillain, { against: you }),
  ),
  "27168.when-revealed-hero": whenRevealedHero(
    enemyAttack(theVillain, { against: you }),
    modifyAttack({ extraBoostCards: 1 }),
  ),

  // Unstable Sentience (27169, treachery; surge is data) — When Revealed: Give the villain 1 facedown boost card.
  // [star] Boost: If this activation is an attack, this card gets +2 boost icons for this attack and this attack
  // gains overkill.
  "27169.when-revealed": whenRevealed(giveBoostCard(theVillain)),
  "27169.boost": boost(ifThen(activationIs("attack"), [adjustBoostCount(2), modifyAttack({ keywords: ["overkill"] })])),
});
