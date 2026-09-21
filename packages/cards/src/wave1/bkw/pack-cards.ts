import {
  after,
  anAttackableEnemy,
  attack,
  cancelRevealedCard,
  chooseCards,
  chosen,
  cards,
  dealDamage,
  defineAbilities,
  discardThis,
  draw,
  eventAmount,
  eventSource,
  eventTarget,
  exhaustThis,
  heroAction,
  heroInterrupt,
  heroResponse,
  ifThen,
  interrupt,
  moveCards,
  preventDamage,
  preventThreat,
  putIntoPlay,
  query,
  removeThreatFromAScheme,
  resource,
  response,
  revealEncounterCard,
  shuffleDeck,
  varAtLeast,
  when,
  you,
  YOUR_IDENTITY,
  zone,
} from "../../dsl/index.js";
import { cancelBoostAbility, onBoostCardTurnedFaceup, PREPARATION_CARD, youReveal } from "./local.js";

/**
 * Aggression/Justice/Protection/Leadership/basic-aspect filler cards bundled in the Black Widow pack, not part of
 * her signature hero-kit set (`aspect` is a generic aspect, not `hero:08001a`): Agent Coulson (08011, justice),
 * Quake (08012, justice), Stealth Strike (08013, justice), Counterintelligence (08017, justice), Spycraft (08018,
 * justice), Quincarrier (08023, basic), Target Acquired (08024, basic), Counterattack (08030, aggression), Rapid
 * Response (08031, leadership), Defensive Stance (08032, protection), Espionage (08033, basic). The Power of
 * Justice (08014), Interrogation Room (08015), Surveillance Team (08016), Nick Fury (08019), Energy/Genius/Strength
 * (08020–08022) and Hydra Mercenary (08028, nemesis set) are identical Core reprints, aliased by `../reprints.ts` —
 * not scripted here, see `docs/phase7-wave1-scripting.md` "Reprints".
 */
export const BKW_PACK_CARDS = defineAbilities({
  // Agent Coulson — Response: After Agent Coulson enters play, search your deck and discard pile for a Preparation
  // card and add it to your hand. Shuffle your deck. Same shape as Core's own "Shuri"/Thor's "For Asgard!" search
  // (`core/heroes/black-panther.ts`, `wave1/thor/kit.ts`).
  "08011.agent-coulson-response": response(
    after.entersPlay("self"),
    chooseCards("found", zone(["deck", "discard"], you, { filter: PREPARATION_CARD }), { min: 1, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),

  // Quake — Response: After a minion schemes, exhaust Quake → deal 2 damage to that minion. "That minion" is the
  // event's source (the minion that schemed, `enemyScheme`'s `eventSubjects`, `packages/engine/src/trigger-events.ts`).
  "08012.quake-response": response(
    after.enemySchemes(query("minion")),
    { cost: exhaustThis },
    dealDamage(2, eventSource),
  ),

  // Stealth Strike — Hero Action (attack): Deal 4 damage to an enemy. If that enemy is defeated by this attack,
  // remove 2 threat from a scheme. `attack`'s `bind` reports `<bind>.defeated` (`packages/engine/src/spec.ts`'s own
  // `EffectSpec` doc comment), landed exactly for this "if this attack defeats it" shape.
  "08013.stealth-strike-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    attack(4, chosen("enemy"), { bind: "hit" }),
    ifThen(varAtLeast("hit.defeated"), removeThreatFromAScheme(2)),
  ),

  // Counterintelligence — Interrupt: When any amount of threat would be placed on the main scheme, discard
  // Counterintelligence → prevent 3 of that threat. (Max 1 per player is card data, `playRestrictions.maxPerPlayer`.)
  "08017.counterintelligence-interrupt": interrupt(
    when.threatPlaced(query("mainScheme")),
    { cost: discardThis },
    preventThreat(3),
  ),

  // Spycraft — Interrupt: When you reveal an encounter card, discard Spycraft → cancel the effects of that card
  // and discard it. Then, reveal another card from the encounter deck. ("Play only if you control a Spy character"
  // is card data, `playRestrictions.requiresControlledCharacterTrait`.) Same shape as Core's own "Black Widow"
  // event (01075, `core/aspects/protection.ts`).
  "08018.spycraft-interrupt": interrupt(
    youReveal(),
    { cost: discardThis },
    cancelRevealedCard(),
    revealEncounterCard(you),
  ),

  // Quincarrier — Resource: Exhaust Quincarrier → generate a [wild] resource. ("Play only if your identity has the
  // Avenger trait" is card data, `playRestrictions.requiresIdentityTrait`.)
  "08023.quincarrier-resource": resource({ wild: 1 }, { cost: exhaustThis }),

  // Target Acquired — Hero Response: After a boost card is turned faceup, discard Target Acquired → cancel that
  // card's boost ability. (Max 1 per player is card data.)
  "08024.target-acquired-response": heroResponse(
    onBoostCardTurnedFaceup(),
    { cost: discardThis },
    cancelBoostAbility(),
  ),

  // Counterattack — Hero Response (attack): After you take damage from an enemy attack, discard Counterattack →
  // deal an equal amount of damage to that enemy. Same shape as Core's own "Counter-Punch" (01077,
  // `core/aspects/protection.ts`): a real `attack` effect, not plain damage, since the ability is "(attack)"-labeled.
  "08030.counterattack-response": heroResponse(
    after.damage(YOUR_IDENTITY, { fromAttack: true, taken: true }),
    { label: "attack", cost: discardThis },
    attack(eventAmount, eventSource),
  ),

  // Rapid Response — Hero Response: After an ally you control is defeated, discard Rapid Response → put that ally
  // into play from your discard pile and deal 1 damage to it. "That ally" is the defeated ally's own instance
  // (`characterDefeated`'s target), still a valid reference once it's back in play.
  "08031.rapid-response-response": heroResponse(
    after.defeated(query("ally", { controller: "you" })),
    { cost: discardThis },
    putIntoPlay(eventTarget, you),
    dealDamage(1, eventTarget),
  ),

  // Defensive Stance — Hero Interrupt: When you would take any amount of damage, discard Defensive Stance →
  // prevent 3 of that damage.
  "08032.defensive-stance-interrupt": heroInterrupt(
    when.damage(YOUR_IDENTITY),
    { cost: discardThis },
    preventDamage(3),
  ),

  // Espionage — Interrupt: When the surge keyword on an encounter card would be resolved, discard Espionage →
  // draw 2 cards. ("Play only if you control a Spy character" is card data.) `{ on: "surgeResolving", playerIs:
  // "controller" }` is the landed primitive for this exact card (`packages/engine/src/triggers-wave1.test.ts`'s
  // `SURGE_DRAW` stub, docs/phase7-wave1.md §3.11), no `dsl/abilities.ts` wrapper yet.
  "08033.espionage-interrupt": interrupt(
    { on: "surgeResolving", playerIs: "controller" },
    { cost: discardThis },
    draw(2),
  ),
});
