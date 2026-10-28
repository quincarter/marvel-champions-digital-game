/**
 * An ability that initiates an enemy activation while another is resolving waits with it (RRG 1.8 "Activation", p. 6):
 * the ability's frames leave the stack, wait in that activation's `endEffects`, and come back as they were.
 *
 * - `suspendBehindActivation`: takes them off the stack (`apply-effect.ts`, the `enemyAttack` / `enemyScheme` /
 *   `enemyActivation` case).
 * - `releaseWaitingAbilities`: as an activation ends, what waited behind it resumes, unless the ability that initiated
 *   that activation is still resolving beneath it: then it waits for that ability to finish (`resumeWaitingAbilities`,
 *   from its root frame as it finishes).
 * - `resumeSuspended`: puts the frames back.
 */

import { type Ctx, emit, findFrame, pushFrames, setFrame, updateFrame } from "../ctx.js";
import { EngineInvariantError } from "../errors.js";
import { gameFingerprint } from "../game-fingerprint.js";
import type { FrameId } from "../ids.js";
import type { EffectSpec } from "../spec.js";
import { type DeferredEffects, RESOLVED_SO_FAR_CHANGED, RESOLVED_SO_FAR_UNCHANGED, type StackFrame } from "../stack.js";
import type { GameState } from "../state.js";
import type { Frame } from "./frames.js";

/**
 * Suspends the ability that is initiating `effect` (an enemy activation) behind the activation `activation` in progress
 * (RRG 1.8 "Activation", p. 6): "the newly initiated activation resolves after the current activation has finished
 * resolving", and "An effect that initiates an enemy activation is considered resolved after that activation has fully
 * resolved". So the rest of the ability waits too: its later instructions, in `frame` and in the frames it is nested in
 * (`if`, `then`, `sentence`, a `forEachPlayer` pass and the passes after it), read what the activation did (`bind`,
 * a rule waiting on the attack it initiates). Its frames (`suspendedFramesOf`) leave the stack as they are, `frame`
 * holding the effect (`resumeActivation`), and wait in the activation's `endEffects`; its end puts them back
 * (`pushEndEffects`), after its Retaliate and responses (ruling Feb 28, 2026 (1) answer 2; ruling May 16, 2024 #191).
 * Ruling Dec 10, 2024 #54 is the same order: Hidden in the Clutter is discarded after the attack and its responses.
 * Rulings Feb 15, 2024 #147 and #148 and May 23, 2024 #194 resolved the later sentences before the new activation;
 * RRG 1.8 p. 6 and #54 supersede them. What modifies the activation itself ("that attack gains …") is part of the
 * effect (`atkBonus`, `keywords`, a rule written before it with `attack: "initiated"`) and goes with it.
 *
 * What the ability was nested in goes on meanwhile, above all the response window it was resolving in: the
 * activation's other responses resolve while the ability waits (p. 6: "All abilities triggered by the initial
 * activation resolve before subsequent activations initiate"; ruling Feb 28, 2026 (1) answer 2).
 *
 * Several abilities suspended behind one activation resume, and initiate their activations, in the order they were
 * suspended: separate effects (two responses, two sentences) are sequential, not simultaneous, and the first player
 * already chose the order of responses to one triggering condition as they resolved (RRG 1.8 p. 19). Swoop Down
 * (60194, `packages/cards/src/wave11/fne/modular/the-owl.ts`) is scripted as three separate effects as an interim
 * reading (task E21), so its Aerial and non-Aerial minions are not ordered against each other yet. Enemies
 * one effect activates together are simultaneous ("If multiple enemies activate against you simultaneously, resolve
 * the villain's activation first (if any) in the order of your choice, followed by minion activations in the order of
 * your choice", p. 6; ruling June 4, 2024 #202): the villain first, then the minions in the order the first player
 * chooses as the effect is initiated (`orderEnemies`, `resolve/effects-frame.ts`, which flags whose choice it is as an
 * open question), kept while it waits.
 */
export function suspendBehindActivation(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: EffectSpec,
  activation: FrameId,
): void {
  const run = suspendedFramesOf(ctx.state, frame.frameId, activation);
  const suspended = run.map((f): StackFrame => {
    if (f.kind !== "effects") return f;
    const resumes = f.frameId === frame.frameId ? { resumeActivation: effect } : {};
    // Whether the ability resolved (RRG 1.8 "Resolve", p. 37) is read against the frames beneath its root, which are
    // not the same when it resumes: what it changed so far is kept, and the digest is taken again then (`resumeSuspended`).
    if (!f.resolvedCount || f.resolvedCount.from === RESOLVED_SO_FAR_CHANGED) return { ...f, ...resumes };
    const at = ctx.state.stack.findIndex((other) => other.frameId === f.frameId);
    const changed =
      f.resolvedCount.from !== RESOLVED_SO_FAR_UNCHANGED &&
      gameFingerprint(ctx.state, ctx.state.stack.slice(at + 1)) !== f.resolvedCount.from;
    const from = changed ? RESOLVED_SO_FAR_CHANGED : RESOLVED_SO_FAR_UNCHANGED;
    return { ...f, ...resumes, resolvedCount: { ...f.resolvedCount, from } };
  });
  const ids = new Set(suspended.map((f) => f.frameId));
  ctx.state = { ...ctx.state, stack: ctx.state.stack.filter((f) => !ids.has(f.frameId)) };
  // Logged as they leave the stack; `framePushed` follows as they come back.
  for (const f of suspended) emit(ctx, { type: "framePopped", frameId: f.frameId, frame: f.kind });
  const deferred: DeferredEffects = {
    effects: [],
    selfInstanceId: frame.selfInstanceId,
    controllerId: frame.controllerId,
    bindings: {},
    vars: {},
    suspended,
  };
  updateFrame(ctx, activation, (f) => (f.kind === "event" ? { ...f, endEffects: [...f.endEffects, deferred] } : f));
}

/**
 * The effects frames of the ability resolving the effects frame `frameId`, top first: that frame, then down the stack
 * each frame it is nested in, up to and including the ability's root effects frame (the one `resolveAbility` pushed:
 * `announceResolved`). A frame is nested in the one beneath it when it hands its bindings back to it (`if`, `then`,
 * `sentence`, `chooseOne`), or when both resolve the same ability of the same card (a `forEachPlayer` pass, and the
 * passes still to come beneath it). Effects that are no ability's (a lasting effect's, an end-of-attack effect) stop at
 * their own frame and the frames they return to. Never `stopAt`. Empty when `frameId` is no effects frame on the stack.
 */
function abilityEffectsFrames(state: GameState, frameId: FrameId, stopAt: FrameId | null): Frame<"effects">[] {
  const start = state.stack.findIndex((f) => f.frameId === frameId);
  const first = state.stack[start];
  if (first?.kind !== "effects") return [];
  const run: Frame<"effects">[] = [first];
  let current = first;
  for (let index = start + 1; !current.announceResolved; index++) {
    const below = state.stack[index];
    if (below?.kind !== "effects" || below.frameId === stopAt) break;
    const returnsTo = current.returnBindingsTo === below.frameId;
    const sameAbility =
      current.abilityId !== undefined &&
      below.abilityId === current.abilityId &&
      below.selfInstanceId === current.selfInstanceId;
    if (!returnsTo && !sameAbility) break;
    run.push(below);
    current = below;
  }
  return run;
}

/**
 * The frames suspended with the ability resolving `frameId` (`abilityEffectsFrames`), and beneath its root what holds
 * the ability open: the attack of an "(attack)" ability waiting for it (`attackOf`), the play of the event card whose
 * ability it is, and the reveal of the encounter card whose When Revealed it is (with that card's other abilities still
 * to resolve). Never the activation waited for.
 */
function suspendedFramesOf(state: GameState, frameId: FrameId, activation: FrameId): StackFrame[] {
  const effects = abilityEffectsFrames(state, frameId, activation);
  const root = effects[effects.length - 1];
  if (!root) throw new EngineInvariantError("an activation was initiated from no effects frame");
  const run: StackFrame[] = [...effects];
  if (!root.announceResolved) return run;
  const ids = new Set(run.map((f) => f.frameId));
  const self = root.selfInstanceId;
  // The reveal of the card whose When Revealed this is, with the card's other abilities of that reveal still to
  // resolve above it: the reveal's later steps (its surge, its discard, the "after … is revealed" responses) wait for
  // the ability (RRG 1.8 "Reveal", p. 38: they follow its When Revealed abilities). Taken only when it is reached
  // through them; otherwise (an incite ordered after the ability is in between) the reveal goes on.
  const reveal: StackFrame[] = [];
  let index = state.stack.findIndex((f) => f.frameId === root.frameId) + 1;
  for (let below = state.stack[index]; below && below.frameId !== activation; below = state.stack[++index]) {
    const carriesAttack = below.kind === "event" && below.attackOf !== undefined && ids.has(below.attackOf);
    const playsCard = below.kind === "playCard" && below.stage === "effects" && below.instanceId === self;
    if (reveal.length === 0 && (carriesAttack || playsCard)) {
      run.push(below);
      continue;
    }
    if (below.kind === "ability" && below.instanceId === self) {
      reveal.push(below);
      continue;
    }
    if (below.kind === "reveal" && below.instanceId === self) run.push(...reveal, below);
    break;
  }
  return run;
}

/**
 * The abilities that waited behind the activation `frame` as it ends (`waiting`, its `DeferredEffects.suspended`): the
 * ones to resume now. When the ability that initiated `frame` (its `reportTo` frame) is still resolving beneath it, they
 * wait for that ability's root frame to finish (`Frame<"effects">.waitingAbilities`, `resumeWaitingAbilities`), and none
 * resume now, even when its activation was its last instruction. So the initiating ability resolves its remaining
 * sentences, the responses its sentences held and the responses to its resolution, as soon as its own activation has
 * finished, before an activation that waited behind that activation is initiated, whatever is left of it.
 *
 * Owner decision (the user, 2026-10-28, reading A): RRG 1.8 "Activation" (p. 6) makes both wait ("considered resolved
 * after that activation has fully resolved"; "the newly initiated activation resolves after the current activation has
 * finished resolving") and no source ranks the two. Resuming the waiting ability first let Krahllak's Blessing (65019)
 * with a Retaliate hero start another attack before its first use's "Discard this card", and loop until the heroes
 * were defeated; this keeps the no-loop intent of ruling Feb 15, 2024 #148 (Hidden in the Clutter and Retaliate: no
 * infinite loop). The waiting ability's activation still happens (it was initiated; ruling June 2023, answer 6).
 */
export function releaseWaitingAbilities(
  ctx: Ctx,
  frame: Frame<"event">,
  waiting: readonly DeferredEffects[],
): readonly DeferredEffects[] {
  if (waiting.length === 0 || !frame.reportTo) return waiting;
  const run = abilityEffectsFrames(ctx.state, frame.reportTo.frameId, frame.frameId);
  const root = run[run.length - 1];
  if (!root) return waiting;
  setFrame(ctx, { ...root, waitingAbilities: [...(root.waitingAbilities ?? []), ...waiting] });
  return [];
}

/**
 * As the root frame of an ability finishes, the abilities that waited behind an activation it initiated resume
 * (`releaseWaitingAbilities`), first held first.
 */
export function resumeWaitingAbilities(ctx: Ctx, frame: Frame<"effects">): void {
  for (const deferred of [...(frame.waitingAbilities ?? [])].reverse())
    if (deferred.suspended) resumeSuspended(ctx, deferred.suspended);
}

/**
 * Puts back the frames of an ability suspended behind an activation (`DeferredEffects.suspended`), as they were: the
 * ability resumes where it stopped, its activation first (`Frame<"effects">.resumeActivation`). A triggering event
 * frame that has finished meanwhile is no longer named, as it would not be for an ability that outlived it. Whether
 * the ability resolved (RRG 1.8 "Resolve", p. 37) is read against the game as it resumes, with the frames now beneath
 * it, unless its effects had already changed the game (`RESOLVED_SO_FAR_UNCHANGED`, `suspendBehindActivation`).
 */
export function resumeSuspended(ctx: Ctx, frames: readonly StackFrame[]): void {
  pushFrames(
    ctx,
    frames.map((f) =>
      (f.kind === "effects" || f.kind === "playCard") &&
      f.eventFrameId !== null &&
      !findFrame(ctx.state, f.eventFrameId)
        ? { ...f, eventFrameId: null }
        : f,
    ),
  );
  const stack = ctx.state.stack;
  const ids = new Set(frames.map((f) => f.frameId));
  const root = stack.findIndex(
    (f) => ids.has(f.frameId) && f.kind === "effects" && f.resolvedCount?.from === RESOLVED_SO_FAR_UNCHANGED,
  );
  const found = stack[root];
  if (found?.kind !== "effects" || !found.resolvedCount) return;
  setFrame(ctx, {
    ...found,
    resolvedCount: { ...found.resolvedCount, from: gameFingerprint(ctx.state, stack.slice(root + 1)) },
  });
}
