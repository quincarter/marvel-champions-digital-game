import { trait } from "@mc/content";
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
  draw,
  eventTarget,
  exhaustThis,
  heroAction,
  heroInterrupt,
  heroResource,
  instead,
  interrupt,
  moveCards,
  preventDamage,
  query,
  reduceNextCardCost,
  self,
  thwartAScheme,
  when,
  you,
  YOUR_IDENTITY,
  zone,
} from "../../dsl/index.js";

const THWART = trait("Thwart");

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
const whenYouPlay = (t: typeof THWART): EventPattern => ({ on: "cardBeingPlayed", playerIs: "controller", targetIs: query("event", { trait: t }) });

/**
 * Ms. Marvel / Kamala Khan (05001a/b) and her hero kit (05002–05011). Reprints bundled in this pack (Get Behind
 * Me! 05013, The Power of Protection 05016, Energy 05019, Genius 05020, Strength 05021, Avengers Mansion 05022) are
 * aliased from Core by `../reprints.ts`, not scripted here — see `docs/phase7-wave1-scripting.md`.
 *
 * **Two identity abilities are intentionally unscripted** (missing engine primitives — docs/phase7-wave1-scripting.md
 * §4, "record and skip"):
 *
 * - **"Morphogenetics" (05001a)** — Response: After you play an Attack, Thwart, or Defense event, exhaust Ms.
 *   Marvel → return that event to your hand. `TargetQuery` (engine `spec.ts`) has only a single `trait` field (and
 *   its negation `withoutTrait`); there is no way to match "any of these traits" (Attack, Thwart, or Defense) in
 *   one query. `EventPattern.targetIs`/`sourceIs` are typed `TargetQuery`, so the trigger can't be built from
 *   existing pieces without over- or under-matching — filtering only on `categories: ["event"]` would also fire
 *   for a General-trait event, which the printed text doesn't cover, and there is no `condition?: Predicate` hook
 *   on `EventPattern` to compose `Predicate.anyOf(hasTrait(…), hasTrait(…), hasTrait(…))` instead. Closest existing
 *   primitives: `TargetQuery.trait`/`withoutTrait` (singular only), `Predicate.anyOf` (composes predicates, not
 *   usable inside a query-shaped `targetIs`). Proposed shape: `TargetQuery.anyTrait?: readonly Trait[]` — matches a
 *   card carrying at least one of the listed traits (printed or granted), symmetric with `trait`/`withoutTrait`.
 *   (`EffectSpec moveCards` to `"hand"` and the `cardPlayed` event pattern themselves are already proven for this
 *   exact card by `engine/src/movement-wave1.test.ts`'s `RETURN_EVENT`/`MORPHO` stub — only the trait-OR gate is missing.)
 *
 * - **"Teen Spirit" (05001b)** — Action: Discard cards from the top of your deck until you discard a Ms. Marvel
 *   card, then add that card to your hand. (Limit once per round.) `EffectSpec discardEncounterUntil` (spec.ts) —
 *   the only "discard from the top until a match" primitive that exists — reads only the active villain's
 *   encounter deck (`apply-effect.ts`'s `discardEncounterUntil` case calls `activeEncounterDeckId`/
 *   `encounterDeckOf` directly); there is no equivalent over a player's own deck. Closest existing primitive:
 *   `discardEncounterUntil { filter, bind }`. Proposed shape: `discardDeckUntil { player, filter, bind }` — same
 *   "discard from the top, stop at (and include) the first match, bound to `bind`, bounded by deck+discard length
 *   so a deck with no match can't loop forever" semantics, over `zone("deck", player)` instead of the encounter
 *   deck (RRG 1.8 "Deck", p. 15, governs a player deck's own reshuffle-on-empty the same way).
 *
 * - **"Embiggen!" (05010)** — Hero Interrupt: When you play an Attack event, exhaust Embiggen! → increase the
 *   amount of damage that event deals by 2. This one is a confirmed **engine bug**, not a missing DSL primitive:
 *   `modifyCardEffect`/`cardEffectBonus` is proven and correct for `dealDamage`, `removeThreat` and `thwart` (each
 *   reads `cardEffectBonus(ctx.state, frame.selfInstanceId, …)` in `apply-effect.ts`, and Shrink's own interrupt,
 *   scripted right below with the identical shape over `threatRemoved`, passes its own test in `ms-marvel.test.ts`
 *   proving the `cardBeingPlayed`/`modifyCardEffect` mechanism itself is sound) — but the `"attack"` case in that
 *   same `switch` (`apply-effect.ts`, the case starting `case "attack": {`) computes `amount = value(effect.amount)`
 *   with no `+ cardEffectBonus(ctx.state, frame.selfInstanceId, "damage")`, unlike its `dealDamage` sibling one
 *   case above. Big Hands (05003, "Hero Action (attack): Deal 4 damage to an enemy") correctly uses the `attack`
 *   `EffectSpec` (not `dealDamage`) so guard and retaliate apply, matching `cap`'s own precedent (Heroic Strike,
 *   Shield Toss); rewriting it as `dealDamage` just to make Embiggen! read would silently drop guard/retaliate —
 *   the wrong kind of approximation. Flagging for `game-rules-architect`: add the same one-line
 *   `+ cardEffectBonus(ctx.state, frame.selfInstanceId, "damage")` to the `"attack"` case that `"dealDamage"`
 *   already has, then `"05010.embiggen-interrupt"` can be scripted exactly like `"05011.shrink-interrupt"` below.
 */
export const MSM_KIT = defineAbilities({
  // "05001a.morphogenetics" and "05001b.teen-spirit" — intentionally absent; see the module doc comment above.
  // "05010.embiggen-interrupt" — intentionally absent; see the module doc comment above (engine bug, not a DSL gap).

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
