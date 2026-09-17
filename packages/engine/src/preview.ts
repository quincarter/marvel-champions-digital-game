/**
 * "What would this command do?" — an outcome preview, computed by running the command through the engine and throwing
 * the resulting state away.
 *
 * This is the same trick `legalActions` uses to decide legality (`legal.ts`'s `probe`), and it works for the same
 * reason: `applyCommand` is pure and `Ctx.state` is *replaced*, never mutated, so a probe cannot touch the caller's
 * state — its RNG included, since `RngState` is a field of `GameState`. A preview is a query. It never enters a
 * `GameLog`, never advances `rng`/`nextChoiceSeq`/`nextFrameSeq`, and is invisible to `replay()`.
 *
 * **The diff is the events, with totals read off the two states.** A numeric diff of `instances` can say
 * `damage: 9 → 14` but cannot say *why*; the engine already emits the distinctions a player asks about —
 * `damagePrevented{reason:"tough"}`, `overkillSpilled`, `threatRemovalBlocked`, `uniqueEntryBlocked`,
 * `leavePlayBlocked`, `activationSkipped` — and events carry order, which a state diff does not. So `events` is the
 * probe's own event list and `counters` is before/after for each instance those events named, read through the same
 * selectors the live board reads. Nothing here is recomputed and no rule is restated: `OutcomePreview` contains no
 * prose and no arithmetic of its own.
 *
 * **What it will not tell you.** A preview stops rather than peek — see `PreviewStop` and `truncate` below. It also
 * never auto-answers a nested choice: that would be the engine deciding, and would be wrong exactly when the answer
 * matters. A client that wants "and then, whichever you pick, …" calls `preview` again on each answer.
 *
 * A preview is what happens *if nobody responds*: an optional interrupt/response window parks a choice and stops the
 * preview there, while a *forced* one resolves inside it (RRG 1.8 "Ability", p. 5, simultaneous timing priority;
 * "Attack (Enemy Activation)" step 6, p. 9) — correct, because a forced ability is mandatory and public, and whether
 * another player will spend a card is not something the engine may predict.
 */

import { DEFAULT_DEPS, type EngineDeps } from "./abilities.js";
import type { ChoicePrompt } from "./choices.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import type { EngineErrorCode } from "./errors.js";
import type { GameEvent, GameEventType } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { characterProfile, getInstance, mainSchemeValue, maxHitPoints, remainingHitPoints } from "./query.js";
import { cardsInPlay, categoriesOf } from "./select.js";
import type { GameOutcome, GameState, StatusCounts } from "./state.js";
import { faceHidden, zoneHidden } from "./visibility.js";

/** Where a preview stopped, and why. */
export type PreviewStop =
  /** The command ran to the end. `events` is the whole story. */
  | { readonly kind: "complete" }
  /** The command parked a decision. Everything before it is certain; what comes after depends on the answer. */
  | {
      readonly kind: "choice";
      readonly playerId: PlayerId;
      readonly prompt: ChoicePrompt;
      /** RRG 1.8 "Peril" (p. 32): only this player may decide, and nobody else may respond. */
      readonly soleDecider: boolean;
    }
  /**
   * The rest depends on information the deciding player may not see. `events` is a certain prefix; `at` is the kind
   * of the event the preview stopped *at*, which is **not** included in `events`.
   */
  | { readonly kind: "hiddenInformation"; readonly at: GameEventType }
  /** The engine refused the command, with its own code and message — the same pair `legalActions` reports. */
  | { readonly kind: "rejected"; readonly reason: EngineErrorCode; readonly message: string };

/** Every counter a preview panel words a target's row from, on one card, at one moment. */
export interface CounterSnapshot {
  readonly inPlay: boolean;
  readonly damage: number;
  /** Null for anything without hit points (a scheme, an upgrade, an event being played). */
  readonly remainingHitPoints: number | null;
  readonly maxHitPoints: number | null;
  /** Null for a non-scheme. */
  readonly threat: number | null;
  /** The main scheme's target threat — the value that completes it. Null for anything else (RRG 1.8 "Scheme", p. 39). */
  readonly threatLimit: number | null;
  readonly exhausted: boolean;
  readonly statuses: StatusCounts;
}

export interface PreviewCounter {
  readonly instanceId: InstanceId;
  readonly before: CounterSnapshot;
  readonly after: CounterSnapshot;
}

export interface OutcomePreview {
  readonly stop: PreviewStop;
  /** The probe's own events, in order, truncated where the outcome starts depending on hidden information. */
  readonly events: readonly GameEvent[];
  /** Before/after for every instance `events` named, in first-mention order. */
  readonly counters: readonly PreviewCounter[];
  /** The game's outcome if this command would end it — null whenever the preview was truncated or rejected. */
  readonly outcome: GameOutcome | null;
}

const EMPTY_STATUSES: StatusCounts = { stunned: 0, confused: 0, tough: 0 };

function snapshot(state: GameState, id: InstanceId, deps: EngineDeps): CounterSnapshot {
  const instance = getInstance(state, id);
  if (!instance) {
    return {
      inPlay: false,
      damage: 0,
      remainingHitPoints: null,
      maxHitPoints: null,
      threat: null,
      threatLimit: null,
      exhausted: false,
      statuses: EMPTY_STATUSES,
    };
  }
  const isScheme = categoriesOf(state, id).includes("scheme");
  const isMainScheme = id === state.mainScheme.instanceId;
  // A character's hit points only: `characterProfile` is what decides whether this card has any at all.
  const hasHitPoints = characterProfile(state, id, deps) !== undefined;
  return {
    inPlay: cardsInPlay(state).includes(id),
    damage: instance.damage,
    remainingHitPoints: hasHitPoints ? (remainingHitPoints(state, id, deps) ?? null) : null,
    maxHitPoints: hasHitPoints ? (maxHitPoints(state, id, deps) ?? null) : null,
    threat: isScheme ? instance.threat : null,
    threatLimit: isMainScheme ? mainSchemeValue(state, "targetThreat", deps) : null,
    exhausted: instance.exhausted,
    statuses: instance.statuses,
  };
}

/**
 * Every instance id an event names, wherever it names it.
 *
 * A structural walk rather than a per-event-kind list on purpose: a new event kind gets the truncation rule for free,
 * and there is no table to forget to update. An id is anything that is a key of `instances` — including an option id
 * inside a `choiceRequested`, which is exactly a card the choice is offering.
 */
function namedInstances(event: GameEvent, state: GameState, into: Set<string>): void {
  const walk = (value: unknown): void => {
    if (typeof value === "string") {
      if (state.instances[value]) into.add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value !== null && typeof value === "object") {
      for (const item of Object.values(value)) walk(item);
    }
  };
  walk(event);
}

/**
 * How many events are certain, stated over zones rather than over a list of risky event kinds.
 *
 * Every instance is classified against the **pre-probe** state, and the prefix ends at the first event that
 *  (a) names a card inside a closed deck (`zoneHidden`) — a drawn card, a dealt boost card, a searched deck, a
 *      shuffle's new order; or
 *  (b) names a card that was facedown out of a deck and is faceup once the command finishes (`faceHidden` then
 *      revealed) — a boost card left over from an earlier round being flipped, a facedown Drone turned over.
 *
 * Damaging a facedown Drone does *not* truncate: naming a facedown card is not reading it, and the Drone is still
 * facedown afterwards. That distinction is why (b) asks about the post-state's `faceup` rather than treating every
 * mention of a facedown card as a reveal.
 */
function certainPrefix(before: GameState, after: GameState, events: readonly GameEvent[]): number {
  const hidden = new Set<string>();
  const revealable = new Set<string>();
  for (const id of Object.keys(before.instances)) {
    const instanceId = id as InstanceId;
    if (zoneHidden(before, instanceId)) hidden.add(id);
    else if (faceHidden(before, instanceId)) revealable.add(id);
  }
  if (hidden.size === 0 && revealable.size === 0) return events.length;

  for (const [index, event] of events.entries()) {
    const named = new Set<string>();
    namedInstances(event, before, named);
    for (const id of named) {
      if (hidden.has(id)) return index;
      if (revealable.has(id) && after.instances[id]?.faceup === true) return index;
    }
  }
  return events.length;
}

/**
 * How many events are certain *against randomness*.
 *
 * `state.rng` is part of `GameState`, so a probe walks the real random stream and would happily report the card a
 * "discard 1 at random" is about to take. The honest bound is found rather than guessed: re-run the same command on
 * the same state with a different seed and take the first event that differs. Anything before it did not depend on
 * the random stream; the first divergence is where it started to.
 *
 * Skipped entirely when the command consumed no randomness at all, which is nearly every command.
 */
function randomPrefix(before: GameState, after: GameState, events: readonly GameEvent[], command: Command, deps: EngineDeps): number {
  if (before.rng.draws === after.rng.draws && before.rng.value === after.rng.value) return events.length;
  const reseeded: GameState = { ...before, rng: { ...before.rng, value: (before.rng.value ^ 0x9e3779b9) >>> 0 } };
  const shadow = applyCommand(reseeded, command, deps);
  // A rejection under another seed is not something to reason from: report nothing as certain past the first event.
  if (!shadow.ok) return 0;
  const limit = Math.min(events.length, shadow.events.length);
  for (let index = 0; index < limit; index++) {
    if (JSON.stringify(events[index]) !== JSON.stringify(shadow.events[index])) return index;
  }
  return shadow.events.length === events.length ? events.length : limit;
}

/**
 * Runs `command` against `state` and reports what it would do, without changing anything.
 *
 * Cheap enough to call per candidate target and re-call on every state change: a single probe is well under a
 * millisecond, and there is deliberately no caching — a preview must always be computed against the state as it is
 * right now.
 */
export function preview(state: GameState, command: Command, deps: EngineDeps = DEFAULT_DEPS): OutcomePreview {
  const result = applyCommand(state, command, deps);
  if (!result.ok) {
    return {
      stop: { kind: "rejected", reason: result.error.code, message: result.error.message },
      events: [],
      counters: [],
      outcome: null,
    };
  }

  const all = result.events;
  const cut = Math.min(certainPrefix(state, result.state, all), randomPrefix(state, result.state, all, command, deps));
  const events = cut < all.length ? all.slice(0, cut) : all;
  const truncated = cut < all.length;

  const named = new Set<string>();
  for (const event of events) namedInstances(event, result.state, named);
  const counters: PreviewCounter[] = [];
  for (const id of named) {
    const instanceId = id as InstanceId;
    counters.push({
      instanceId,
      before: snapshot(state, instanceId, deps),
      after: snapshot(result.state, instanceId, deps),
    });
  }

  // Order of stops: a truncated preview never reports the choice or the outcome beyond its cut, because both would be
  // things the engine only knows by having looked.
  const pending = result.state.pendingChoice;
  const stop: PreviewStop = truncated
    ? { kind: "hiddenInformation", at: all[cut]!.type }
    : pending
      ? { kind: "choice", playerId: pending.playerId, prompt: pending.prompt, soleDecider: pending.soleDecider }
      : { kind: "complete" };

  return { stop, events, counters, outcome: truncated ? null : result.state.outcome };
}
