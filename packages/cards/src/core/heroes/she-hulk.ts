import {
  action,
  addAccelerationToken,
  after,
  alterEgoAction,
  attackAnEnemy,
  boost,
  cards,
  changeForm,
  constant,
  damageAnEnemy,
  damageOn,
  dealDamage,
  defineAbilities,
  discardFromHandCost,
  discardThis,
  draw,
  drawUpTo,
  each,
  enemyAttack,
  eventTarget,
  exhaustThis,
  exists,
  forcedResponse,
  gets,
  handSizeOf,
  heal,
  heroAction,
  ifThen,
  interrupt,
  made,
  modifyAttack,
  moveCards,
  named,
  not,
  oncePerRound,
  perHero,
  placeThreat,
  preventThreat,
  query,
  ready,
  refMatches,
  remainingHpOf,
  removeThreatFromAScheme,
  response,
  scaled,
  self,
  spend,
  stun,
  surge,
  takeDamageCost,
  thwartAScheme,
  varOf,
  when,
  whenRevealed,
  YOUR_HERO,
  you,
  yourIdentity,
} from "../../dsl/index.js";
import { cardName } from "../names.js";
import { obligation } from "../obligations.js";

/** She-Hulk (01019a/b) and her hero kit (01020–01028). */
export const SHE_HULK_KIT = defineAbilities({
  // "Do You Even Lift?" — Response: After you change to this form, deal 2 damage to an enemy. (Hero face: live only in hero form.)
  "01019a.do-you-even-lift": response(after.youChangeForm(), damageAnEnemy(2)),
  // "I Object!" — Interrupt: When threat would be placed on a scheme, prevent 1 of that threat. (Limit once per round.)
  "01019b.i-object": interrupt(when.threatPlaced(), { limit: oncePerRound }, preventThreat(1)),
  // Hellcat — Action: Return Hellcat to your hand.
  "01020.hellcat-action": action(moveCards(cards(self), "hand")),
  // Gamma Slam — Hero Action (attack): Deal X damage to an enemy (to a maximum of 15). X is the amount of damage you have sustained.
  "01021.gamma-slam-action": heroAction({ label: "attack" }, attackAnEnemy(scaled(damageOn(yourIdentity), { max: 15 }))),
  // Ground Stomp — Hero Action: Deal 1 damage to each enemy.
  "01022.ground-stomp-action": heroAction(dealDamage(1, each(query("enemy")))),
  // Legal Practice — Alter-Ego Action (thwart): Choose and discard up to 5 cards from your hand → remove 1 threat from a scheme
  // for each card discarded this way. ("Up to" still needs at least one card: RRG "Cost".)
  "01023.legal-practice-action": alterEgoAction({ label: "thwart", cost: discardFromHandCost(1, 5, "discarded") }, thwartAScheme(varOf("discarded"))),
  // One-Two Punch — Response: After you make a basic attack (using your ATK), ready She-Hulk.
  "01024.one-two-punch-response": response(after.attacks(YOUR_HERO, { basic: true }), ready(yourIdentity)),
  // Split Personality — Action: Change your form (flip your identity card). Then, draw up to your printed hand size.
  "01025.split-personality-action": action(changeForm(you), drawUpTo(handSizeOf(you, true))),
  // Superhuman Law Division — Alter-Ego Action: Exhaust SLD and spend a [mental] resource → remove 2 threat from a scheme.
  // Current text (RRG 1.5 errata): no longer labeled (thwart).
  "01026.superhuman-law-division-action": alterEgoAction({ cost: [exhaustThis, spend({ mental: 1 })] }, removeThreatFromAScheme(2)),
  // Focused Rage — Hero Action: Exhaust Focused Rage and take 1 damage → draw 1 card.
  "01027.focused-rage-action": heroAction({ cost: [exhaustThis, takeDamageCost(1)] }, draw(1)),
  // Superhuman Strength — She-Hulk gets +2 ATK.
  "01028.superhuman-strength-constant": constant(gets("atk", 2, YOUR_HERO)),
  // Forced Response: After She-Hulk attacks, discard Superhuman Strength → stun the attacked enemy (if it's still in play).
  "01028.superhuman-strength-forced-response": forcedResponse(
    after.attacks(YOUR_HERO),
    { cost: discardThis },
    ifThen(refMatches(eventTarget, query("enemy")), stun(eventTarget)),
  ),
});

/** Legal Work (01160), She-Hulk's obligation. */
export const SHE_HULK_OBLIGATION = defineAbilities({
  // • Give the main scheme 1 acceleration token. Discard this obligation.
  "01160.obligation": obligation("Jennifer Walters", { label: "Give the main scheme 1 acceleration token", effects: [addAccelerationToken()] }),
});

const TITANIA = cardName("01162");

/** She-Hulk's nemesis set: Personal Challenge, Titania, Genetically Enhanced, Titania's Fury. */
export const SHE_HULK_NEMESIS = defineAbilities({
  // Personal Challenge — When Revealed: Place an additional 1 [per_hero] threat here.
  "01161.when-revealed": whenRevealed(placeThreat(perHero(1), self)),
  // Titania — X is equal to Titania's remaining hit points. (Printed ATK "X": base 0 plus this.)
  "01162.titania-constant": constant(gets("atk", remainingHpOf(self), { self: true })),
  // Genetically Enhanced — "If there are no minions in play, this card gains surge." Checked when the card is revealed
  // (after it fails to attach), so it's a When Revealed despite the ref's slug.
  "01163.genetically-enhanced-constant": whenRevealed(ifThen(not(exists(query("minion"))), surge())),
  // Attached minion gets +3 hit points.
  "01163.genetically-enhanced-constant-2": constant(gets("hp", 3, { hostOfSelf: true })),
  // Titania's Fury — When Revealed: Titania attacks your hero. If Titania did not attack, heal all damage from Titania and this card gains surge.
  "01164.when-revealed": whenRevealed(
    enemyAttack(named(TITANIA), { against: you, bind: "fury" }),
    ifThen(not(made("fury")), [heal(damageOn(named(TITANIA)), named(TITANIA)), surge()]),
  ),
  // [star] Boost: Give the villain 1 additional boost card for this activation.
  "01164.boost": boost(modifyAttack({ extraBoostCards: 1 })),
});
