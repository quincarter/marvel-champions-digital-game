/**
 * What waits for the end of a sentence: the response windows raised while an `EffectSpec sentence` resolves.
 *
 * FFG ruling December 8, 2023 - Ruling 126 (post-RRG 1.5), Gamma Blast: "You must resolve the first sentence of Gamma
 * Blast in full before resolving the Response on Gamma form." Ruling 137 (January 11, 2024): "In most cases, yes, a
 * sentence in an ability must fully resolve before responses to that sentence can occur." RRG 1.8 p. 4 ("resolve the
 * ability one sentence at a time") and "'And'" (p. 7): effects joined by "and" resolve simultaneously, so what one
 * sentence causes is one occurrence. RRG 1.8 "Triggering Condition" (p. 45): "multiple triggering conditions" created
 * by a single occurrence "are handled with a single interrupt window and a single response window", and abilities
 * referring to any of them "may be used in any order"; "Response" (p. 38) the same.
 *
 * How. `pushWindow` hands every response window raised while a `sentence` frame is on the stack, its last effect's
 * included, to the innermost one (`holdingSentence`): the window's conditions are appended to
 * `Frame<"effects">.heldSentenceResponses`, one entry per occurrence. As the sentence finishes, they open together as
 * ONE response window (`releaseSentenceResponses`), each occurrence a triggering condition group of its own
 * (`Frame<"window">.conditionGroups`). Interrupts never wait. In that window forced responses come before optional ones
 * only within a group (RRG 1.8 p. 5 chart, "abilities with the same triggering condition"; "Forced", p. 20, "for any
 * given triggering condition"): an optional response to a group no forced response answers is offered before the
 * forced tier as well as after it (`window.ts`, `earlyOptional`). The first player orders the forced ones (p. 20).
 *
 * The end of an attack keeps its order. A sentence that ends an "(attack)" or "(thwart)" ability (nothing of the
 * ability is left after it) and made its attack or thwart hands what it held to that attack or thwart, which finishes
 * after the ability (`attack-ability.ts`, `thwart-session.ts`): its response window gathers them, beside its own
 * conditions (RRG 1.8 "Attack (Enemy Activation)" p. 8 step 6; "Attack (Player Ability Type)" p. 9 steps 7-9).
 * "At the end of this attack" delayed effects still resolve before that window (p. 5 item 1; ruling Mar 6, 2026,
 * Leading Blow / Wonder Man), the attack's own forced responses before its optional ones (its conditions are one
 * group), and a basic power's consequential damage still waits beneath it (p. 5 item 5). Overkill is part of dealing
 * the damage, so it stays inside the sentence. Gamma Blast: one window holds the attack's forced responses, the
 * "after you change form" Response (a group of its own) and the "after you attack" Responses; the form's Response may
 * go before or after the attack's forced ones, and the attack's optional ones follow its forced ones.
 *
 * Engine readings, each with its alternative:
 * - Retaliate is applied in `characterAttacked`'s apply step (`applyRetaliate`), before any response window of the
 *   attack, so the form's Response always follows it. RRG 1.8 calls retaliate a forced response, which would let the
 *   Response go first; making it a window candidate is an engine-wide change, not made here.
 * - The response window of an `attack` or `enemyAttack` event made inside a sentence (an ability with no "(attack)"
 *   label) is not held: its event frame still has its "at the end of this attack" effects and "for this attack"
 *   lasting effects to finish after it (`resolve/event.ts`, `done` stage). No shipped card writes one.
 * - In the combined window every forced response resolves in one batch, ordered by the first player: an optional
 *   response is offered before that batch or after it, not between two forced ones.
 * - A reveal in progress holds every response window until its end (`reveal-hold.ts`), which `pushWindow` checks
 *   first; held windows a sentence hands to it are kept one window per occurrence there.
 * - A merged window held again loses its groups: a window opened with `conditionGroups` (an attack's or thwart's that
 *   took a sentence's held windows, on `pushWindow`'s path from `resolve/event.ts`, including the `joinLaterResponses`
 *   and announced-thwart paths) that an outer sentence or a reveal holds is kept as one occurrence, its conditions
 *   flattened, so forced before optional then spans all of them, as in any one-occurrence window.
 * - A sentence holds every response window raised while it is on the stack, including those of another ability
 *   resolving above it (a forced interrupt's own damage during the sentence). Ruling 137 speaks of "a sentence in an
 *   ability"; the alternative, holding only what the sentence's own effects cause, would need each window traced back
 *   to the ability that raised it.
 * Separate sentences, and a flat effect list, keep a window between them (RRG 1.8 p. 4; ruling 137 "in most cases").
 */

import { type Ctx, findFrame, updateFrame } from "../ctx.js";
import type { FrameId } from "../ids.js";
import type { EffectSpec } from "../spec.js";
import type { TriggerEvent } from "../trigger-events.js";
import { waitingAbilityAttack } from "./attack-ability.js";
import type { Frame } from "./frames.js";
import { holdResponsesForReveal } from "./reveal-hold.js";
import { pushWindow } from "./window.js";

/** The innermost sentence frame on the stack. */
function holdingSentence(ctx: Ctx): Frame<"effects"> | undefined {
  const found = ctx.state.stack.find((f) => f.kind === "effects" && f.sentence === true);
  return found?.kind === "effects" ? found : undefined;
}

/** An attack event frame finishes its attack after its own response window (see the module comment). */
function finishesAfterItsWindow(ctx: Ctx, eventFrameId: FrameId | null): boolean {
  const frame = eventFrameId === null ? undefined : findFrame(ctx.state, eventFrameId);
  return frame?.kind === "event" && (frame.event.kind === "attack" || frame.event.kind === "enemyAttack");
}

/** Whether a response window `eventFrameId` raises now would be held by the sentence resolving. */
export function sentenceHoldsResponses(ctx: Ctx, eventFrameId: FrameId | null): boolean {
  return holdingSentence(ctx) !== undefined && !finishesAfterItsWindow(ctx, eventFrameId);
}

/**
 * Hands the response window of `events` (the conditions of one occurrence, the window's own event last) to the
 * sentence resolving. False, with nothing done, when no sentence holds it.
 */
export function holdResponsesForSentence(
  ctx: Ctx,
  events: readonly TriggerEvent[],
  eventFrameId: FrameId | null = null,
): boolean {
  const sentence = holdingSentence(ctx);
  if (!sentence || events.length === 0 || finishesAfterItsWindow(ctx, eventFrameId)) return false;
  updateFrame(ctx, sentence.frameId, (f) =>
    f.kind === "effects" ? { ...f, heldSentenceResponses: [...(f.heldSentenceResponses ?? []), events] } : f,
  );
  return true;
}

/**
 * Held occurrences and, last, the conditions of one more (`own`, its own event last) as one window's conditions: the
 * window's `event`, its `alsoEvents`, and the group of each (`Frame<"window">.conditionGroups`, `alsoEvents` first),
 * `own` being group 0 and each held occurrence the next.
 */
export function sentenceWindowConditions(
  held: readonly (readonly TriggerEvent[])[],
  own: readonly TriggerEvent[],
): {
  readonly event: TriggerEvent;
  readonly alsoEvents: readonly TriggerEvent[];
  readonly groups: readonly number[];
} | null {
  const ownGroup = own.length > 0 ? [{ events: own, group: 0 }] : [];
  const all = [...held.map((events, index) => ({ events, group: index + 1 })), ...ownGroup];
  const conditions = all.flatMap(({ events, group }) => events.map((event) => ({ event, group })));
  const last = conditions[conditions.length - 1];
  if (!last) return null;
  return {
    event: last.event,
    alsoEvents: conditions.slice(0, -1).map((each) => each.event),
    groups: conditions.map((each) => each.group),
  };
}

/** Opens `held` (one entry per occurrence) as one response window. */
export function openHeldSentenceResponses(ctx: Ctx, held: readonly (readonly TriggerEvent[])[]): void {
  const window = sentenceWindowConditions(held, []);
  if (!window) return;
  const single = held.length === 1;
  pushWindow(ctx, window.event, "response", null, window.alsoEvents, [], single ? undefined : window.groups);
}

/** Whether `effects` holds an effect of one of `kinds`, inside a branch, a "then" or a sentence included. */
function writes(effects: readonly EffectSpec[], kinds: ReadonlySet<string>): boolean {
  return effects.some((effect) => {
    if (kinds.has(effect.kind)) return true;
    switch (effect.kind) {
      case "if":
        return writes(effect.then, kinds) || writes(effect.otherwise ?? [], kinds);
      case "then":
      case "sentence":
        return writes(effect.effects, kinds);
      case "chooseOne":
        return effect.options.some((option) => writes(option.effects, kinds));
      default:
        return false;
    }
  });
}
const ATTACK_KINDS: ReadonlySet<string> = new Set(["attack", "dealDamage", "divide"]);
const THWART_KINDS: ReadonlySet<string> = new Set(["thwart", "removeThreat"]);

/**
 * The sentence `frame` (popped already) ended its "(attack)" or "(thwart)" ability, whose attack or thwart it made and
 * which finishes after the ability: `held` joins that attack's or thwart's response window. False when it did not.
 */
function handToAbilityFinish(ctx: Ctx, frame: Frame<"effects">, held: readonly (readonly TriggerEvent[])[]): boolean {
  // The frames of the same ability beneath it, from its parent down to the ability's root: nothing left in any.
  const run: Frame<"effects">[] = [];
  for (const below of ctx.state.stack) {
    if (
      below.kind !== "effects" ||
      below.abilityId !== frame.abilityId ||
      below.selfInstanceId !== frame.selfInstanceId
    )
      break;
    run.push(below);
  }
  const [parent] = run;
  const root = run[run.length - 1];
  if (!parent || !root || run.some((each) => each.cursor < each.effects.length)) return false;
  const session = root.thwart;
  if (session && !session.cancelled && !session.announced && writes(frame.effects, THWART_KINDS)) {
    updateFrame(ctx, root.frameId, (f) =>
      f.kind === "effects" ? { ...f, heldSentenceResponses: [...(f.heldSentenceResponses ?? []), ...held] } : f,
    );
    return true;
  }
  const attack = writes(frame.effects, ATTACK_KINDS) ? waitingAbilityAttack(ctx.state, ctx.deps, parent) : undefined;
  if (!attack) return false;
  updateFrame(ctx, attack.frameId, (f) =>
    f.kind === "event" ? { ...f, sentenceResponses: [...(f.sentenceResponses ?? []), ...held] } : f,
  );
  return true;
}

/**
 * The effects `frame` has resolved (popped already): the response windows it held open now, as one window. A
 * sentence's go to an enclosing sentence or reveal still resolving, or to the attack or thwart its ability finishes
 * with (`handToAbilityFinish`); a "(thwart)" ability's root frame opens what its thwart did not take.
 */
export function releaseSentenceResponses(ctx: Ctx, frame: Frame<"effects">): void {
  const held = frame.heldSentenceResponses ?? [];
  if (held.length === 0) return;
  // An enclosing sentence, or a reveal, still resolving takes them in turn, in the order they were raised.
  const open = held.filter((events) => !holdResponsesForSentence(ctx, events) && !holdResponsesForReveal(ctx, events));
  if (open.length === 0) return;
  if (frame.sentence === true && handToAbilityFinish(ctx, frame, open)) return;
  openHeldSentenceResponses(ctx, open);
}

/**
 * Takes the held windows handed to the ability thwart's root frame `root`, for the thwart event it is announcing
 * (`announceAbilityThwart`): they leave the root frame for the announced frame's `sentenceResponses`.
 */
export function takeHeldForThwart(ctx: Ctx, root: Frame<"effects">): readonly (readonly TriggerEvent[])[] {
  const held = root.heldSentenceResponses ?? [];
  if (held.length === 0) return [];
  updateFrame(ctx, root.frameId, (f) => {
    if (f.kind !== "effects") return f;
    const { heldSentenceResponses: _taken, ...rest } = f;
    return rest;
  });
  return held;
}
