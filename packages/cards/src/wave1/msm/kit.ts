import { trait, type Trait } from "@mc/content";
import type { AbilityCost, AbilityDefinition, EffectSpec, EventPattern, ResourceGeneration, TargetQuery, TargetRef } from "@mc/engine";
import {
  action,
  alterEgoAction,
  amount,
  anEnemy,
  attackAnEnemy,
  cards,
  chooseCards,
  chosen,
  defineAbilities,
  discardDeckUntil,
  draw,
  eventTarget,
  exhaustThis,
  heroAction,
  heroInterrupt,
  heroResource,
  instead,
  interrupt,
  moveCards,
  oncePerRound,
  preventDamage,
  query,
  reduceNextCardCost,
  response,
  self,
  thwartAScheme,
  when,
  you,
  YOUR_IDENTITY,
  zone,
} from "../../dsl/index.js";

const THWART = trait("Thwart");
const ATTACK = trait("Attack");
const DEFENSE = trait("Defense");

/**
 * "Spend 2 resources of different types" (Red Dagger, 05002): `AbilityCost.distinctResourceTypes` was landed ahead
 * of scripting for exactly this card (engine/src/abilities.ts, engine/src/actions.ts `resourceVars`). No DSL sugar
 * builder exists for it yet, so this composes the raw cost shape locally, the same way `spend`/`spendX` compose
 * `AbilityCost.resources`/`resourcesX`.
 */
const spendDifferentTypes = (n: number): AbilityCost => ({ resources: n, distinctResourceTypes: n });

/**
 * "Attach 1 card from your hand facedown here" (Bruno Carrelli, 05007): the raw `attach` effect (engine
 * `EffectSpec { kind: "attach", card, to, facedown? }`, spec.ts) was landed with Bruno Carrelli named directly in
 * its own doc comment, but `dsl/effects.ts` exposes no builder sugar for it yet.
 */
const attachFacedown = (card: TargetRef, to: TargetRef): EffectSpec => ({ kind: "attach", card, to, facedown: true });
/** "The cards attached here" (Bruno Carrelli): the raw `attachmentsOf` ref (engine `TargetRef`, spec.ts) has no DSL sugar yet. */
const attachedHere = (): TargetRef => ({ kind: "attachmentsOf", of: self });

/**
 * "Generate a [wild] resource for an event" (Biokinetic Polymer Suit, 05009): `AbilityDefinition.generatesFor`
 * restricts what the generated resource can pay for ("usable only while paying for a matching card" — engine
 * `abilities.ts`), but `dsl/abilities.ts`'s `resource()`/`heroResource()` builders don't expose it. This composes
 * it onto the built definition rather than reaching into the engine directly.
 */
const heroResourceFor = (generates: ResourceGeneration, forQuery: TargetQuery): AbilityDefinition => ({
  ...heroResource(generates, { cost: exhaustThis }),
  generatesFor: forQuery,
});

/**
 * "When you play an [Attack]/[Thwart] event" (Embiggen!/Shrink, 05010/05011): the `cardBeingPlayed` trigger event
 * and `modifyCardEffect` (docs/phase7-wave1.md §3.13) are landed, but `dsl/abilities.ts`'s `on`/`when` object has no
 * sugar for this pattern yet, so it's composed here as a raw `EventPattern`.
 */
const whenYouPlay = (t: typeof THWART | typeof ATTACK): EventPattern => ({ on: "cardBeingPlayed", playerIs: "controller", targetIs: query("event", { trait: t }) });

/**
 * "After you play an Attack, Thwart, or Defense event" (Morphogenetics, 05001a): the `cardPlayed` trigger event
 * (announced after the card resolves, unlike `cardBeingPlayed` above) plus `TargetQuery.anyTrait` — an OR of traits,
 * landed 2026-09-15 (`engine/src/spec.ts`, checked in `select.ts`'s `matchesQuery`) — the primitive that had blocked
 * this card (docs/phase7-wave1-scripting.md §6). Proven for this exact shape by `engine/src/movement-wave1.test.ts`'s
 * `RETURN_EVENT` stub.
 */
const afterYouPlay = (traits: readonly Trait[]): EventPattern => ({ on: "cardPlayed", playerIs: "controller", targetIs: query("event", { anyTrait: traits }) });

/**
 * Ms. Marvel / Kamala Khan (05001a/b) and her hero kit (05002–05011). Reprints bundled in this pack (Get Behind
 * Me! 05013, The Power of Protection 05016, Energy 05019, Genius 05020, Strength 05021, Avengers Mansion 05022) are
 * aliased from Core by `../reprints.ts`, not scripted here — see `docs/phase7-wave1-scripting.md`.
 *
 * **No identity ability is unscripted any longer.** "Morphogenetics" (05001a) was a skip until `TargetQuery.anyTrait`
 * landed 2026-09-15; "Teen Spirit" (05001b) was the pack's last skip until `discardDeckUntil` (`dsl/effects.ts`,
 * engine `spec.ts`/`apply-effect.ts`) landed 2026-09-17 — the player-deck analog of `discardEncounterUntil`. "A
 * Ms. Marvel card" is `{ identitySetOf: you }` (RRG 1.8 "Identity-Specific Card", p. 23): it matches her signature
 * allies/events/upgrades/supports, not a basic/aspect card played alongside them. The match is left in the discard
 * pile by `discardDeckUntil` itself; `moveCards` picks it up from there. Nothing is bound (so `moveCards` is a
 * no-op) when the deck (and discard pile) hold no match.
 *
 * **"Embiggen!" (05010)** was a third skip for the same reason (a confirmed engine bug: the `attack` effect ignored
 * `cardEffectBonus`) until the 2026-09-15 fix (`packages/engine/src/resolve/apply-effect.ts`'s `"attack"` case now
 * adds `cardEffectBonus(ctx.state, frame.selfInstanceId, "damage")`, matching `dealDamage`/`removeThreat`/`thwart`);
 * it's now scripted below, identically to Shrink's own interrupt over `threatRemoved`.
 */
export const MSM_KIT = defineAbilities({
  // Teen Spirit — Action: Discard cards from the top of your deck until you discard a Ms. Marvel card, then add
  // that card to your hand. (Limit once per round.)
  "05001b.teen-spirit": alterEgoAction(
    { limit: oncePerRound },
    discardDeckUntil({ identitySetOf: you }, "found"),
    moveCards(cards(chosen("found")), "hand"),
  ),

  // Morphogenetics — Response: After you play an Attack, Thwart, or Defense event, exhaust Ms. Marvel → return
  // that event to your hand.
  "05001a.morphogenetics": response(afterYouPlay([ATTACK, THWART, DEFENSE]), { cost: exhaustThis }, moveCards(cards(eventTarget), "hand")),

  // Embiggen! — Hero Interrupt: When you play an Attack event, exhaust Embiggen! → increase the amount of damage
  // that event deals by 2.
  "05010.embiggen-interrupt": heroInterrupt(whenYouPlay(ATTACK), { cost: exhaustThis }, { kind: "modifyCardEffect", card: eventTarget, damage: amount(2) }),

  // Red Dagger — Interrupt: When Red Dagger is defeated, spend 2 resources of different types → deal 2 damage to
  // an enemy and return Red Dagger to your hand. A replacement (RRG "Replacement Effect"), same shape as Clea
  // ("When Clea is defeated, shuffle her into her owner's deck": docs/phase7-wave1.md §3.13) and Captain America's
  // Helmet (`cap` pack): the defeat is interrupted and never happens, so Red Dagger goes to hand, not the discard.
  "05002.red-dagger-interrupt": interrupt(
    when.defeated("self"),
    { cost: spendDifferentTypes(2) },
    instead(anEnemy(), { kind: "dealDamage", target: chosen("enemy"), amount: amount(2) }, moveCards(cards(self), "hand")),
  ),

  // Big Hands — Hero Action (attack): Deal 4 damage to an enemy.
  "05003.big-hands-action": heroAction({ label: "attack" }, attackAnEnemy(4)),

  // Sneak By — Hero Action (thwart): Remove 3 threat from a scheme.
  "05004.sneak-by-action": heroAction({ label: "thwart" }, thwartAScheme(3)),

  // Wiggle Room — Hero Interrupt (defense): When you would take any amount of damage, prevent 3 of that damage.
  // Draw 1 card.
  "05005.wiggle-room-interrupt": heroInterrupt(when.damage(YOUR_IDENTITY), { label: "defense" }, preventDamage(3), draw(1)),

  // Aamir Khan — Alter-Ego Action: Exhaust Aamir Khan → place 1 card from your discard pile on the bottom of your
  // deck, then draw 1 card.
  "05006.aamir-khan-action": alterEgoAction(
    { cost: exhaustThis },
    chooseCards("toBottom", zone("discard", you), { min: 1, max: 1 }),
    moveCards(cards(chosen("toBottom")), "deckBottom"),
    draw(1),
  ),

  // Bruno Carrelli — Alter-Ego Action: Exhaust Bruno Carrelli → attach 1 card from your hand facedown here.
  "05007.bruno-carrelli-action": alterEgoAction(
    { cost: exhaustThis },
    chooseCards("toAttach", zone("hand", you), { min: 1, max: 1 }),
    attachFacedown(chosen("toAttach"), self),
  ),
  // Bruno Carrelli — Action: Exhaust Bruno Carrelli → add up to 3 cards attached here to your hand.
  "05007.bruno-carrelli-action-2": action(
    { cost: exhaustThis },
    chooseCards("returned", cards(attachedHere()), { min: 0, max: 3 }),
    moveCards(cards(chosen("returned")), "hand"),
  ),

  // Nakia Bahadir — Alter-Ego Action: Exhaust Nakia Bahadir → reduce the cost of the next card you play this
  // phase by 1.
  "05008.nakia-bahadir-action": alterEgoAction({ cost: exhaustThis }, reduceNextCardCost(you, 1, "phase")),

  // Biokinetic Polymer Suit — Hero Resource: Exhaust Biokinetic Polymer Suit → generate a [wild] resource for an
  // event.
  "05009.biokinetic-polymer-suit-resource": heroResourceFor({ wild: 1 }, query("event")),

  // Shrink — Hero Interrupt: When you play a Thwart event, exhaust Shrink → increase the amount of threat that
  // event removes by 2. FAQ "Shrink (#11)" (RRG 1.8 p. 59): same reading as Embiggen!, for threat removal.
  "05011.shrink-interrupt": heroInterrupt(whenYouPlay(THWART), { cost: exhaustThis }, { kind: "modifyCardEffect", card: eventTarget, threatRemoved: amount(2) }),
});
