import type { EventPattern } from "@mc/engine";
import {
  action,
  addCounters,
  after,
  attackAnEnemy,
  cards,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  costModifier,
  dealDamage,
  defineAbilities,
  draw,
  eventTarget,
  exhaustThis,
  gets,
  heal,
  healYourIdentityCost,
  heroAction,
  hasStatus,
  ifThen,
  instead,
  interrupt,
  isHero,
  modifyStat,
  moveCards,
  option,
  preventDamage,
  query,
  removeCounter,
  response,
  forcedResponse,
  self,
  shuffleDeck,
  stun,
  when,
  you,
  yourIdentity,
  YOUR_IDENTITY,
  zone,
} from "../../dsl/index.js";
import { cancelBoostIcons, removeStatusOf } from "./local.js";

/** "When a boost card is turned faceup during a scheme activation" (Foiled!, 09038). No `sourceIs` restriction — the
 * printed text names no specific scheme/villain, unlike Ms. Marvel's Preemptive Strike ("while the villain
 * attacks"), which the identically-shaped `whileTheVillainAttacks` in `wave1/msm/pack-cards.ts` does restrict. */
const duringASchemeActivation: EventPattern = { on: "boostCardTurnedFaceup", activation: "scheme" };

/**
 * Doctor Strange (`drs`) pack cards outside his signature kit/nemesis/obligation sets (`aspect` is the generic
 * aspect, not `hero:09001a`): Brother Voodoo (09012, protection ally), Clea (09013, protection ally), Iron Fist
 * (09014, protection ally), Desperate Defense (09015, protection event), Momentum Shift (09016, protection event),
 * The Night Nurse (09019, protection support), Warning (09021, basic event), The Sorcerer Supreme (09026, basic
 * upgrade), Skilled Strike (09037, aggression event), Foiled! (09038, justice event), Iron Man (09039, leadership
 * ally). Reprints bundled in the same physical pack (The Power of Protection 09017, Med Team 09018, Energy 09022,
 * Genius 09023, Strength 09024, Avengers Mansion 09025) are aliased from Core by `../reprints.ts`, not scripted
 * here.
 *
 * **Recorded skip: Unflappable (09020).** Printed text: "Play under any player's control. Max 1 per player.
 * Response: After you defend against an attack and take no damage, exhaust Unflappable → draw 1 card." The
 * compound trigger condition — "you defended, **and** (once the attack is fully resolved) it dealt you no damage"
 * — isn't representable with a single event the engine can attach a Response's cost to. `on.defends` (the
 * `defended` trigger event) fires the moment a defender is declared, strictly *before* the attack deals any
 * damage: the `defended` event frame is pushed, resolved (including its own Response window, where this card's
 * `exhaustSelf` cost would be paid) and popped — all nested *inside* the still-open `enemyAttack`/`attack` frame,
 * before that frame goes on to compute and apply damage (`packages/engine/src/resolve/event.ts`'s "resolving" →
 * "responses" stages per frame, `packages/engine/src/stack.ts`'s LIFO `StackFrame[]`). So a Response keyed off
 * `defends` must decide whether to pay its cost *before* "take no damage" is knowable. `atEndOfAttack` (used for
 * Desperate Defense, `09015` below, and proven for exactly this kind of delayed check by Rhino's Charge,
 * `packages/cards/src/core/scenarios/rhino.ts`) defers *effects*, not an `AbilityCost` — it cannot delay when an
 * `exhaustSelf` cost is charged, only when the resulting damage-dependent effect resolves. Modeling "exhaust
 * Unflappable" as a plain `exhaust(self)` *effect* inside a deferred `ifThen(not(eventDealt("damage")), …)` (rather
 * than an `AbilityCost`) would silently drop the real rule that the response cannot be used at all while
 * Unflappable is already exhausted for some other reason — a wrong answer, not an approximation. What's missing:
 * either (a) an `EventPattern`/trigger-event shape for "the *finished* attack you defended, with its final
 * results" that a Response can match directly (so the cost is offered only once "no damage" is already decided),
 * or (b) a way for `AbilityCost` payment itself to be deferred to a later point in the same activation. Flagged for
 * `game-rules-architect`; left out of `DRS_PACK_CARDS`, unresolved in `coverage.test.ts`.
 *
 * **Recorded skip: Desperate Defense (09015).** Printed text: "Hero Interrupt (defense): When your hero defends
 * against an attack, it gets +2 DEF for that attack. If you take no damage from that attack, ready your hero." A
 * confirmed **engine bug**, not a DSL gap: `on.defends(YOUR_HERO)` compiles to `EventPattern { on: "defended",
 * targetIs: YOUR_HERO }`, which is exactly right (`packages/engine/src/trigger-events.ts`'s `eventSubjects` reports
 * a `defended` event's `target` as `[defenderInstanceId]`) — but `packages/engine/src/trigger-events.ts`'s own
 * `isAnnouncement(event)` has no `case "defended": return false;` alongside its sibling events `enemyAttack` /
 * `attack` / `characterAttacked` / `characterDefeated`, so `defended` falls through to `default: return true`.
 * `packages/engine/src/resolve/frames.ts`'s `eventFrame` reads that flag to decide a pushed event's starting stage:
 * `stage: isAnnouncement(event) ? "responses" : "interrupts"` — an event `isAnnouncement`-true skips the
 * "interrupts" stage (and its `hasCandidates`/`pushWindow` check, `packages/engine/src/resolve/event.ts`) entirely,
 * going straight to "responses". Traced directly against a real Rhino game (`applyCommand` stepping, full event
 * log): once a defender is declared, `{ type: "triggerEvent", event: { kind: "defended" }, phase: "resolved" }`
 * fires with **no preceding `phase: "initiated"` and no `windowOpened`/`choiceRequested` at all** — contrast the verified
 * `dealDamage` event immediately after, whose own `phase: "initiated"` is followed by a real `windowOpened` and a
 * `chooseTriggers` prompt. So **no Interrupt can ever fire on `on.defends`, from hand or in play** — Desperate
 * Defense's own Hero Interrupt (defense) never gets offered a chance to trigger, regardless of cost or targeting.
 * (Captain America's Expert Defense, `wave1/cap/pack-cards.ts`'s `03033.expert-defense-interrupt`, is scripted with
 * the identical `when.defends(YOUR_HERO)` shape and would hit the same gap — not this pack's file to fix, but
 * corroborating evidence this is a general engine gap, not specific to this card.) Fix: add `case "defended":
 * return false;` to `isAnnouncement` (`game-rules-architect`). Left out of `DRS_PACK_CARDS`, unresolved in
 * `coverage.test.ts`.
 */
export const DRS_PACK_CARDS = defineAbilities({
  // Brother Voodoo — Response: After Brother Voodoo enters play, search the top 5 cards of your deck for an event
  // card and add it to your hand. Shuffle your deck. `min: 1` auto-skips with no prompt if none of the top 5 are
  // events (`executeChooseCards`, `packages/engine/src/resolve/effects-frame.ts`: `max` is capped to the candidate
  // count, and the choice is skipped outright once `max` hits 0).
  "09012.brother-voodoo-response": response(
    after.entersPlay("self"),
    chooseCards("found", zone("deck", you, { top: 5, filter: query("event") }), { min: 1, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),

  // Clea — Interrupt: When Clea is defeated, shuffle her into her owner's deck. A replacement (RRG "Replacement
  // Effect"): the defeat is interrupted and never happens, so Clea goes to her owner's deck, not the discard —
  // same shape as Ms. Marvel's Red Dagger (`wave1/msm/kit.ts`) and Captain America's Helmet (`cap` pack).
  "09013.clea-interrupt": interrupt(when.defeated("self"), instead(moveCards(cards(self), "deckShuffle"))),

  // Iron Fist — "Iron Fist enters play with 2 mystic counters on him." (Not the Uses keyword: he stays when they
  // run out.) Same shape as Core's Hawkeye (`01066.hawkeye-constant`, `core/aspects/leadership.ts`).
  "09014.iron-fist-constant": forcedResponse(after.entersPlay("self"), addCounters("mystic", 2)),
  // Interrupt: When Iron Fist attacks an enemy, remove 1 mystic counter from him → stun that enemy and deal 1
  // damage to it.
  "09014.iron-fist-interrupt": interrupt(when.attacks("self"), { cost: removeCounter("mystic") }, stun(eventTarget), dealDamage(1, eventTarget)),

  // "09015.desperate-defense-interrupt" — intentionally absent; see the module doc comment above (confirmed engine
  // bug: `isAnnouncement` never lets an Interrupt fire on `on.defends`).

  // Momentum Shift — Hero Action (attack): Heal 2 damage from your hero → deal 2 damage to an enemy.
  // `healYourIdentityCost` is `AbilityCost.healIdentity` (dsl/abilities.ts): the controller's identity must have
  // that much damage to heal, matching the printed cost-arrow exactly.
  "09016.momentum-shift-action": heroAction({ label: "attack", cost: healYourIdentityCost(2) }, attackAnEnemy(2)),

  // The Night Nurse — Uses (3 medical counters) (data). Action: Exhaust The Night Nurse and remove 1 medical
  // counter from her → heal 1 damage from a hero and discard 1 status card from it. `chooseOne`'s per-option
  // `condition` (`hasStatus`) offers only the statuses actually on the chosen hero — auto-skipped if none, resolved
  // without a prompt if exactly one (`executeChooseOne`, `packages/engine/src/resolve/effects-frame.ts`), and lets
  // the player pick among more than one, matching "discard 1 status card" (singular) exactly without needing to
  // know in advance which status the hero carries (the same generic-status gap `kit.ts`'s Vapors of Valtorr skip
  // describes, sidestepped here since Night Nurse doesn't need to know *which* status to pick a *different* one).
  "09019.the-night-nurse-action": action(
    { cost: [exhaustThis, removeCounter("medical")] },
    chooseTarget("hero", query("hero")),
    heal(1, chosen("hero")),
    chooseOne(
      option("Discard the stunned status", { when: hasStatus(chosen("hero"), "stunned") }, removeStatusOf(chosen("hero"), "stunned")),
      option("Discard the confused status", { when: hasStatus(chosen("hero"), "confused") }, removeStatusOf(chosen("hero"), "confused")),
      option("Discard the tough status", { when: hasStatus(chosen("hero"), "tough") }, removeStatusOf(chosen("hero"), "tough")),
    ),
  ),

  // "09020.unflappable-response" — intentionally absent; see the module doc comment above (missing primitive, not
  // a DSL gap this pack can work around).

  // Warning — Interrupt: When a hero would take any amount of damage, reduce that amount by 1. Any hero, not just
  // yours — `query("hero")`, not `YOUR_HERO`.
  "09021.warning-interrupt": interrupt(when.damage(query("hero")), preventDamage(1)),

  // The Sorcerer Supreme — Play only if you have the Mystic trait (data, `playRestrictions.requiresIdentityTrait`).
  // You get +1 hand size while in hero form. No printed `attachesTo` (data), so it auto-attaches to the identity;
  // `hostOfSelf` reads that host generically (Cloak of Levitation, `kit.ts`, is the model), gated `while: isHero()`.
  "09026.the-sorcerer-supreme-constant": constant(gets("handSize", 1, { hostOfSelf: true }, { while: isHero() })),

  // Skilled Strike — Interrupt: When your hero makes a basic attack, it gets +2 ATK for that attack. `YOUR_IDENTITY`
  // (not `YOUR_HERO`) matches `wave1/hlk/kit.ts`'s identically-shaped Hulk Smash precedent for "you make a basic
  // attack" — only hero form can ever attack, so the two are equivalent here.
  "09037.skilled-strike-interrupt": interrupt(when.attacks(YOUR_IDENTITY, { basic: true }), modifyStat("atk", 2, yourIdentity, "endOfAttack")),

  // Foiled! — Interrupt: When a boost card is turned faceup during a scheme activation, cancel its boost icons.
  "09038.foiled-interrupt": interrupt(duringASchemeActivation, cancelBoostIcons()),

  // Iron Man — Reduce the cost to play each upgrade on Iron Man by 1. `CostModifierSpec.host` (`packages/engine/
  // src/abilities.ts`) is landed specifically with this card as its own doc-comment example ("each upgrade on Iron
  // Man"): `appliesTo` matches the card being played (any upgrade), `host: { self: true }` restricts to upgrades
  // being attached to this ally itself.
  "09039.iron-man-constant": constant(costModifier({ delta: -1, appliesTo: query("upgrade"), host: { self: true } })),
});
