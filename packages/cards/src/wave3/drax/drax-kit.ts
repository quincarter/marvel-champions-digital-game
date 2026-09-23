import {
  addCounters,
  after,
  anAttackableEnemy,
  aScheme,
  atEndOfAttack,
  attack,
  boostIconsOn,
  cards,
  changeForm,
  chosen,
  chooseTarget,
  constant,
  costModifier,
  countersOn,
  damageThisCardCost,
  defineAbilities,
  draw,
  enemyAttack,
  encounterCards,
  eventAmount,
  eventDealt,
  exhaustThis,
  forcedResponse,
  gainsKeyword,
  gets,
  giveTough,
  heal,
  heroAction,
  heroInterrupt,
  heroResponse,
  host,
  ifThen,
  instead,
  isHero,
  min,
  modifyAttack,
  modifyStat,
  moveCards,
  on,
  preventDamage,
  query,
  ready,
  removeCountersFrom,
  response,
  scaled,
  self,
  selectCards,
  setRemainingHitPoints,
  statOf,
  theVillain,
  thwart,
  topOfDeck,
  valueEquals,
  varAtLeast,
  varOf,
  when,
  YOUR_IDENTITY,
  you,
  yourIdentity,
} from "../../dsl/index.js";

/**
 * Drax (19001a/b) and his hero kit (19002–19024). Two reprints in this range (19014 Counter-Punch, 19019
 * Indomitable) are aliased automatically by `../reprints.ts`, not scripted here — see docs/phase7-wave3-
 * scripting.md.
 *
 * **Genuine primitive gap, `KNOWN_SKIPPED` (`wave3/coverage.test.ts`):**
 * - `19012.martyr-response` ("Response: After Martyr takes consequential damage from performing an attack, if
 *   that attack defeated an enemy, give her a tough status card.") — the trigger point has to be the consequential
 *   damage itself (RRG 1.8 "Consequential Damage", p. 13, tier 5, resolves *after* the attack, its own responses
 *   and any "after X attacks" window; giving tough any earlier would let the fresh tough card absorb Martyr's own
 *   consequential damage, which the printed card does not intend). But the engine's consequential-damage
 *   `dealDamage` event (`pushConsequentialDamage`, `packages/engine/src/actions.ts`) carries no `parentFrameId`
 *   back to the attack that caused it — unlike ordinary attack damage, which gets one from the currently-open
 *   attack frame (`effects-frame.ts`) — because it is pushed *before* the attack event exists (so it resolves
 *   *after*, LIFO order). There is no live `EventPattern`/`Predicate` way to read "did the attack I just took
 *   consequential damage from defeat an enemy" without that link. Linking the two would need the attack's own
 *   frame id reserved ahead of its own push — a bigger, riskier engine change than one ally's behavior justifies
 *   solo — so this is flagged for `game-rules-architect` rather than approximated (e.g. firing on the attack's
 *   own "defeats" response instead would change the printed timing and its interaction with tough).
 * - `19013.moondragon-action` ("That minion attacks another enemy of your choice") stays `KNOWN_SKIPPED` too, per
 *   docs/phase7-wave3.md §3.23/§4 Q12 — the primitive is intentionally left unbuilt this wave.
 */
export const DRAX_KIT = defineAbilities({
  // Drax — Drax gets +1 ATK for each vengeance counter on him.
  "19001a.drax-constant": constant(gets("atk", countersOn(yourIdentity, "vengeance"), { self: true })),

  // Drax — Response: After the villain attacks Drax, place 1 vengeance counter here (to a maximum of 3). If you
  // cannot, draw 1 card. Aug 3, 2026 (4) #4: "(to a maximum of 3)" is local to this placement — Drax can still
  // hold more than 3 vengeance counters if something else adds them; `addCounters`'s `upTo` is scoped the same way.
  "19001a.drax-response": response(
    after.villainAttacks({ againstYou: true }),
    addCounters("vengeance", 1, yourIdentity, { upTo: 3, bind: "placed" }),
    ifThen(valueEquals(varOf("placed.amount"), 0), draw(1)),
  ),

  // Drax (alter-ego face) — Forced Response: After you change to this form, remove all vengeance counters from
  // Drax. Heal 2 damage from him for each vengeance counter removed this way. Sequenced heal-then-remove (rather
  // than the printed remove-then-heal): `countersOn` reads live state, so removing first would leave 0 to heal
  // for — both orders reach the same final board state, since neither effect's amount depends on the other having
  // already resolved. `on.youChangeForm()` fires on any form change; printed on the alter-ego face, the same
  // convention Ant-Man's own "After you change to this form" abilities use (`wave2/ant/kit.ts` 12001b).
  "19001b.drax-forced-response": forcedResponse(
    on.youChangeForm(),
    heal(scaled(countersOn(yourIdentity, "vengeance"), { times: 2 }), yourIdentity),
    removeCountersFrom(yourIdentity, "vengeance", countersOn(yourIdentity, "vengeance")),
  ),

  // Mantis — Action: Exhaust Mantis and deal 1 damage to her → heal 3 damage from an identity.
  "19002.mantis-action": heroAction(
    { cost: [exhaustThis, damageThisCardCost(1)] },
    chooseTarget("identity", query("identity")),
    heal(3, chosen("identity")),
  ),

  // "Fight Me, Coward!" — Hero Action: Ready your hero and draw 1 card. The villain attacks you.
  "19003.fight-me-coward-action": heroAction(ready(yourIdentity), draw(1), enemyAttack(theVillain, { against: you })),

  // Intimidation — Hero Action (thwart): Remove X threat from a scheme, where X is equal to your ATK.
  "19004.intimidation-action": heroAction(
    { label: "thwart" },
    aScheme(),
    thwart(statOf(yourIdentity, "atk"), chosen("scheme")),
  ),

  // Knife Leap — Reduce the cost to play this card by 1 for each vengeance counter on Drax (RRG 1.8 "In Play and
  // Out of Play", p. 23: a cost reduction reading the card's own printed cost applies from hand, the Hercules/
  // Winter Soldier shape, docs/phase7-wave1.md §3.10).
  "19005.knife-leap-constant": constant(
    costModifier({
      delta: scaled(countersOn(yourIdentity, "vengeance"), { times: -1 }),
      appliesTo: { self: true },
      activeIn: "hand",
    }),
  ),
  // Knife Leap — Hero Interrupt: When you make a basic attack, you get +5 ATK for that attack. That attack gains
  // overkill and piercing. Same shape as Hulk Smash (`wave1/hlk/kit.ts` 10003): `modifyStat(..., "endOfAttack")`
  // for the ATK bonus, `modifyAttack({ keywords })` for the attack's own keyword grant.
  "19005.knife-leap-interrupt": heroInterrupt(
    when.attacks(YOUR_IDENTITY, { basic: true }),
    modifyStat("atk", 5, yourIdentity, "endOfAttack"),
    modifyAttack({ keywords: ["overkill", "piercing"] }),
  ),

  // Parry — Hero Interrupt (defense): When you would take any amount of damage, prevent X of that damage, where X
  // is equal to double your ATK.
  "19006.parry-interrupt": heroInterrupt(
    when.damage(YOUR_IDENTITY),
    { label: "defense" },
    preventDamage(scaled(statOf(yourIdentity, "atk"), { times: 2 })),
  ),

  // Payback — Hero Response (attack): After the villain attacks you, deal X damage to the villain, where X is
  // equal to your ATK. `attack`, not `dealDamage`: the "(attack)" label (Counter-Punch, `core/aspects/protection.ts`
  // 01077, is the same shape).
  "19007.payback-response": heroResponse(
    after.villainAttacks({ againstYou: true }),
    { label: "attack" },
    attack(statOf(yourIdentity, "atk"), theVillain),
  ),

  // Drax's Knife — Restricted (data). While in hero form, Drax gets +1 ATK.
  "19008.draxs-knife-constant": constant(gets("atk", 1, { hostOfSelf: true }, { while: isHero() })),

  // Drax's Other Knife — Restricted (data). While in hero form, Drax gains retaliate 1.
  "19009.draxs-other-knife-constant": constant(
    gainsKeyword({ name: "retaliate", value: 1 }, { hostOfSelf: true }, { while: isHero() }),
  ),

  // DWI Theet Mastery — Hero Response: After Drax makes a basic attack, draw 1 card.
  "19010.dwi-theet-mastery-response": heroResponse(after.attacks(YOUR_IDENTITY, { basic: true }), draw(1)),

  // Too Stubborn to Die — Hero Interrupt: When Drax would be defeated, instead set his hit point dial to 4, change
  // him to alter-ego form, and remove this card from the game. No `attachesTo` printed (a Drax-aspect signature
  // upgrade defaults to attaching to your own identity, DWI Theet Mastery's own convention): `host` is Drax.
  "19011.too-stubborn-to-die-interrupt": heroInterrupt(
    when.defeated("host"),
    instead(setRemainingHitPoints(4, host), changeForm(you, "alterEgo"), moveCards(cards(self), "removedFromGame")),
  ),

  // Deflection — Hero Interrupt: When an identity would take any amount of damage from an attack, prevent up to 5
  // of that damage. Discard cards from the top of your deck equal to the amount prevented this way. Reordered from
  // the printed text: `preventDamage` mutates the pending damage event's own amount in place, so the discard count
  // is computed first, while `eventAmount` still reads the original (pre-prevention) total — the same final state
  // either way, since discarding from your own deck doesn't affect the damage event or vice versa. `preventDamage`
  // itself already clamps to what's pending (`packages/engine/src/resolve/apply-effect.ts`), so "up to 5" needs no
  // extra clamping there.
  "19015.deflection-interrupt": heroInterrupt(
    when.damage(query("identity"), { fromAttack: true }),
    moveCards(topOfDeck(min(5, eventAmount), you), "discard"),
    preventDamage(5),
  ),

  // Hard Knocks — Hero Action (attack): Deal 4 damage to an enemy. If that enemy is defeated by this attack, give
  // your hero a tough status card. `attack`'s `bind` reports `<bind>.defeated` (Stealth Strike, `bkw/pack-
  // cards.ts` 08013, the same shape).
  "19016.hard-knocks-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    attack(4, chosen("enemy"), { bind: "hit" }),
    ifThen(varAtLeast("hit.defeated"), giveTough(yourIdentity)),
  ),

  // Leading Blow — Hero Interrupt: When your hero makes a basic attack, discard the top card of the encounter deck
  // → reduce your hero's ATK for that attack by the number of printed boost icons on that card. If that attack
  // still deals damage, ready your hero. Discard modeled as an unconditional effect (not a paid `AbilityCost`),
  // the same convention Scarlet Witch's own basic-power interrupt uses (`wave2/qsv/kit.ts` 14002.scarlet-witch-
  // interrupt) for "discard the top card of the encounter deck" ahead of an arrow.
  "19017.leading-blow-interrupt": heroInterrupt(
    when.attacks(YOUR_IDENTITY, { basic: true }),
    selectCards("discarded", encounterCards(["deck"], undefined, 1)),
    moveCards(cards(chosen("discarded")), "discard"),
    modifyStat("atk", scaled(boostIconsOn(chosen("discarded")), { times: -1 }), yourIdentity, "endOfAttack"),
    atEndOfAttack(ifThen(eventDealt("damage", 1), ready(yourIdentity))),
  ),

  // Subdue — Hero Interrupt: When an enemy initiates an attack, that enemy gets -3 ATK for that attack.
  "19018.subdue-interrupt": heroInterrupt(when.enemyAttacks(query("enemy")), modifyAttack({ atkBonus: -3 })),
});
