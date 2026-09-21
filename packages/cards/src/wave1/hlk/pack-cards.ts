import { trait } from "@mc/content";
import {
  after,
  anEnemy,
  attack,
  attackAnEnemy,
  chooseTarget,
  chosen,
  constant,
  damageOn,
  dealDamage,
  dealEncounterCard,
  defineAbilities,
  discardThis,
  draw,
  enemyAttack,
  eventResult,
  eventSource,
  exhaustThis,
  forcedResponse,
  gets,
  heal,
  heroAction,
  ifThen,
  query,
  ready,
  removeThreatFromAScheme,
  resource,
  response,
  scaled,
  self,
  stun,
  thwartAScheme,
  varOf,
  when,
  YOUR_HERO,
  you,
} from "../../dsl/index.js";
import { moveThreat, paidOnly, resourceForCard } from "./local.js";

const ATTACK = trait("Attack");

/**
 * Aggression/Justice/Leadership/Protection/basic-aspect filler cards bundled in the Hulk pack, not part of his
 * signature hero-kit set (`aspect` is the generic aspect, not `hero:10001a`): Brawn, Sentry, She-Hulk, Drop Kick,
 * Toe to Toe, "You'll Pay for That!", Martial Prowess (aggression, 10011–10016/10018 — 10017 The Power of
 * Aggression is a Core reprint, aliased by `../reprints.ts`); To the Rescue!, Resourceful (basic, 10019/10032);
 * Beat Cop (justice, 10029); Inspiring Presence (leadership, 10030); Electrostatic Armor (protection, 10031).
 */
export const HLK_PACK_CARDS = defineAbilities({
  // Brawn — Response: After Brawn attacks, remove 1 threat from a scheme.
  "10011.brawn-response": response(after.attacks("self"), removeThreatFromAScheme(1)),

  // Sentry — Forced Response: After Sentry enters play under your control, deal yourself 1 encounter card.
  "10012.sentry-forced-response": forcedResponse(after.entersPlay("self"), dealEncounterCard(you)),

  // She-Hulk — [star] She-Hulk gets +1 ATK for each damage token here. Self-buff shape matches Titania's
  // "gets ATK equal to its remaining HP" (`packages/cards/src/core/heroes/she-hulk.ts`).
  "10013.she-hulk-constant": constant(gets("atk", damageOn(self), { self: true })),

  // Drop Kick — Hero Action (attack): Deal 4 damage to an enemy. If you paid for this card using only [physical]
  // resources, stun that enemy and draw 1 card.
  "10014.drop-kick-action": heroAction(
    { label: "attack" },
    attackAnEnemy(4),
    ifThen(paidOnly("physical"), [stun(chosen("enemy")), draw(1)]),
  ),

  // Toe to Toe — Hero Action (attack): Choose an enemy. That enemy attacks you. Deal 5 damage to that enemy.
  "10015.toe-to-toe-action": heroAction(
    { label: "attack" },
    anEnemy("enemy"),
    enemyAttack(chosen("enemy"), { against: you }),
    attack(5, chosen("enemy")),
  ),

  // "You'll Pay for That!" — Hero Response (thwart): After the villain attacks you, remove 1 threat from a scheme
  // for each damage you took from the attack (to a maximum of 5). `eventResult("damage")` reads the villain
  // attack's own dealt-damage result (`applyDamage`'s `addFrameVars(event.parentFrameId, { damage: … })` in
  // `packages/engine/src/resolve/event.ts`), the same key `when.villainAttacks({ damages: true })`'s
  // `requireResults: { damage: 1 }` gates on.
  "10016.youll-pay-for-that-response": response(
    when.villainAttacks({ againstYou: true, damages: true }),
    { label: "thwart" },
    removeThreatFromAScheme(scaled(eventResult("damage"), { max: 5 })),
  ),

  // Martial Prowess — Play under any player's control. Max 1 per player (data). Resource: Exhaust Martial Prowess
  // → generate a [physical] resource for an Attack event. `resourceForCard` (local): "for an Attack event" is
  // `AbilityDefinition.generatesFor`, not yet exposed by the `resource()` builder.
  "10018.martial-prowess-resource": resourceForCard({ physical: 1 }, query("event", { trait: ATTACK }), {
    cost: exhaustThis,
  }),

  // To the Rescue! — Hero Action (thwart): Remove 2 threat from a scheme.
  "10019.to-the-rescue-action": heroAction({ label: "thwart" }, thwartAScheme(2)),

  // Beat Cop — Action: Exhaust Beat Cop → move 1 threat from a scheme to here. `moveThreat` (local): landed
  // `EffectSpec.moveThreat`, documented against this exact card, no `dsl/effects.ts` wrapper yet.
  "10029.beat-cop-action": heroAction(
    { cost: exhaustThis },
    chooseTarget("scheme", query("scheme")),
    moveThreat(chosen("scheme"), self, 1),
  ),
  // Beat Cop — Action: Exhaust and discard Beat Cop → deal 1 damage to a minion for each threat here. Was a skip
  // until the 2026-09-15 fix: `AbilityCost.discardSelf` now snapshots `self.threat`/`self.damage` the same way it
  // already snapshotted `self.counters.<type>`, before `leavePlay` clears them (`packages/engine/src/actions.ts`),
  // so "for each threat here" still reads correctly after the discard.
  "10029.beat-cop-action-2": heroAction(
    { cost: [exhaustThis, discardThis] },
    chooseTarget("minion", query("minion")),
    dealDamage(varOf("self.threat"), chosen("minion")),
  ),

  // Inspiring Presence — Play only if your identity has the Avenger trait (data). Hero Action: Heal 1 damage from
  // an ally and ready it.
  "10030.inspiring-presence-action": heroAction(
    chooseTarget("ally", query("ally")),
    heal(1, chosen("ally")),
    ready(chosen("ally")),
  ),

  // Electrostatic Armor — Play under any player's control. Max 1 per player (data). Response: After you defend
  // against an attack, deal 1 damage to the attacking character. No printed `attachesTo`, so it auto-attaches to
  // whichever identity controls it — "you defend" is that identity defending (`YOUR_HERO`), matching Expert
  // Defense's own reading of "your hero" in `packages/cards/src/wave1/cap/pack-cards.ts`.
  "10031.electrostatic-armor-response": response(after.defends(YOUR_HERO), dealDamage(1, eventSource)),

  // Resourceful — Resource: Discard Resourceful → generate a [wild] resource.
  "10032.resourceful-resource": resource({ wild: 1 }, { cost: discardThis }),
});
