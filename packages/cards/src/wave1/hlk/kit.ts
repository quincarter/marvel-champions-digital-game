import type { EventPattern } from "@mc/engine";
import {
  after,
  alterEgoAction,
  attackAnEnemy,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  dealDamage,
  defineAbilities,
  discard,
  discardFromHand,
  draw,
  exhaustThis,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  gets,
  handCountOf,
  heroAction,
  ifElse,
  ifThen,
  moveCards,
  oncePerRound,
  query,
  ready,
  resource,
  self,
  statOf,
  thwartAScheme,
  you,
  yourIdentity,
  YOUR_IDENTITY,
  zone,
} from "../../dsl/index.js";
import { paidOnly } from "./local.js";

/**
 * "When your turn ends" (Enraged) — landed `turnEnding` trigger event (docs/phase7-wave1.md §3.11;
 * `packages/engine/src/triggers-wave1.test.ts`'s "hulk.enraged" stub is this exact card), no `dsl/abilities.ts`
 * `on.*` wrapper yet.
 */
const turnEnding: EventPattern = { on: "turnEnding", playerIs: "controller" };

/**
 * Hulk / Bruce Banner (10001a/b) and his hero kit (10002–10010, `aspect: "hero:10001a"`). The Power of Aggression
 * (10017), Energy (10020), Genius (10021), Strength (10022), Avengers Mansion (10023) and Helicarrier (10024) all
 * reprint the identical Core card by (name, type) and are aliased from Core by `../reprints.ts`, not scripted here
 * (docs/phase7-wave1-scripting.md §3) — they belong to this same hero pack physically, but by aspect/name/type they
 * are not part of Hulk's own signature kit either way.
 */
export const HLK_KIT = defineAbilities({
  // "Enraged" — Forced Interrupt: When your turn ends, discard your hand.
  "10001a.enraged": forcedInterrupt(turnEnding, discardFromHand(handCountOf())),

  // Experimental Research — Alter-Ego Action: Draw 1 card. Choose and discard 1 card from your hand. (Limit once
  // per round.) No "→": both sentences are plain effects, not a cost — `chooseCards` over the hand zone (not
  // `discardFromHandCost`, which is for a cost paid before "→").
  "10001b.experimental-research": alterEgoAction(
    { limit: oncePerRound },
    draw(1),
    chooseCards("discarded", zone("hand", you), { min: 1, max: 1 }),
    moveCards(cards(chosen("discarded")), "discard"),
  ),

  // Crushing Blow — You can only spend [physical] resources to pay for this card.
  "10002.crushing-blow-constant": constant({ paymentOnly: ["physical"] }),
  // Crushing Blow — Hero Action (attack): Deal damage to an enemy equal to your ATK.
  "10002.crushing-blow-action": heroAction({ label: "attack" }, attackAnEnemy(statOf(yourIdentity, "atk"))),

  // Hulk Smash (10003) — SKIPPED, missing primitive (docs/phase7-wave1-scripting.md §4). See the docblock note
  // below this object for the full write-up; the +10 ATK half works (`modifyStat(...,"endOfAttack")` reads
  // correctly), but `modifyAttack({ overkill: true })` silently does nothing for a *player's* attack, so scripting
  // only the ATK half would be a subtly wrong implementation (CLAUDE.md: "a subtly wrong implementation is worse
  // than an unimplemented one").

  // Sub-Orbital Leap — Hero Action (thwart): Remove 3 threat from a scheme (5 threat instead if you paid for this
  // card using only [physical] resources).
  "10004.sub-orbital-leap-action": heroAction({ label: "thwart" }, thwartAScheme(ifElse(paidOnly("physical"), 5, 3))),

  // Thunderclap — Hero Action: Choose up to 3 different enemies. Deal 3 damage to each of them.
  "10005.thunderclap-action": heroAction(chooseTarget("enemies", query("enemy"), { count: 3, optional: true }), dealDamage(3, chosen("enemies"))),

  // Unstoppable Force — Hero Action: Ready Hulk. If you paid for this card using only [physical] resources, draw
  // 1 card. FAQ "Unstoppable Force (#6)" (RRG 1.8 p. 60): at cost 0 the condition fails (the engine's
  // `paidWithOnly` already reads this way — it fails at 0 paid).
  "10006.unstoppable-force-action": heroAction(ready(yourIdentity), ifThen(paidOnly("physical"), draw(1))),

  // Limitless Strength — Spend this card only in hero form.
  "10007.limitless-strength-constant": constant({ spendableIn: "hero" }),

  // Banner's Laboratory — Bruce Banner gets +2 REC.
  "10008.banners-laboratory-constant": constant(gets("rec", 2, YOUR_IDENTITY)),
  // Banner's Laboratory — Alter-Ego Resource: Exhaust Banner's Laboratory → generate a [mental] resource.
  "10008.banners-laboratory-resource": resource({ mental: 1 }, { cost: exhaustThis, form: "alterEgo" }),

  // Boundless Rage — Hero form only (data). Hulk gets +1 ATK.
  "10009.boundless-rage-constant": constant(gets("atk", 1, YOUR_IDENTITY)),
  // Boundless Rage — Forced Response: After you change form, discard this card.
  "10009.boundless-rage-forced-response": forcedResponse(after.youChangeForm(), discard(self)),

  // Immovable Object — You get +4 hit points.
  "10010.immovable-object-constant": constant(gets("hp", 4, YOUR_IDENTITY)),
  // Immovable Object — Hulk gains retaliate 1.
  "10010.immovable-object-constant-2": constant(gainsKeyword({ name: "retaliate", value: 1 }, YOUR_IDENTITY)),
});

/**
 * SKIPPED — missing primitive (docs/phase7-wave1-scripting.md §4): Hulk Smash (10003), current text unchanged from
 * printed: "Hero Interrupt: When you make a basic attack, you get +10 ATK for that attack. If you paid for this
 * card using only [physical] resources, that attack gains overkill."
 *
 * Scripted as `heroInterrupt(when.attacks(YOUR_IDENTITY, { basic: true }), modifyStat("atk", 10, yourIdentity,
 * "endOfAttack"), ifThen(paidOnly("physical"), modifyAttack({ overkill: true })))` and proven against a real Rhino
 * game (a basic attack on an engaged Hydra Mercenary, HP 3): the `dealDamage` event fired with `amount: 13`
 * (3 printed ATK + 10, confirmed by a raw event-log capture) — the ATK boost is correct. But the resulting `attack`
 * event's own `dealDamage` never carries `overkill: true` (checked the same way, by event log), so the 10 excess
 * damage never spills to the villain (RRG "Overkill") even though the payment was all-[physical].
 *
 * Root cause, traced to `@mc/engine`: `modifyAttack({ overkill: true })` records the grant as a frame var
 * (`addFrameVars(ctx, activation, { overkill: 1 })`, `packages/engine/src/resolve/apply-effect.ts`'s "modifyAttack"
 * case) on the current attack's own event frame. For an *enemy* attack, `packages/engine/src/resolve/
 * enemy-activation.ts` reads that var back out when it builds the `dealDamage` event (`overkill: (vars.overkill ??
 * 0) > 0`, line ~282) — this is why Rhino's own Charge (`packages/cards/src/core/scenarios/rhino.ts`,
 * `modifyAttack({ overkill: true })` on a villain attack) works. But for a *player's* attack (kind `"attack"`,
 * basic or a `(attack)`-labeled ability), `applyPlayerAttack` (`packages/engine/src/resolve/event.ts`) builds its
 * `dealDamage` event from `overkill: event.overkill === true` — the *original* `attack` trigger event's own fixed
 * field (set only when the event is first pushed, e.g. by `basicAttack` in `actions.ts`, which never sets it) —
 * never from the frame vars an interrupt accumulated. The two code paths diverged: only the enemy-attack one was
 * ever wired to read a granted overkill back.
 *
 * Proposed shape: `applyPlayerAttack` needs the same read `enemy-activation.ts` already does — resolve the current
 * attack's frame vars (via `frame.frameId`/`frameId` already in scope there) and OR that into `event.overkill ===
 * true` when constructing the `dealDamage` event, e.g. `overkill: event.overkill === true || (frameVars.overkill ??
 * 0) > 0`. This is a general gap (any card granting overkill to a *player's* attack via an interrupt/response would
 * hit it), not specific to this card. Flagged for `game-rules-architect`.
 */
export const HLK_KIT_SKIPPED = ["10003.hulk-smash-interrupt"] as const;
