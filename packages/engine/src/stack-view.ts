/**
 * A readable, read-only view of `state.stack` for a client that wants to show what is resolving and what is queued.
 *
 * `describeFrame`/`viewStack` stay what they are — one debug string per frame, good for a log. This is the structured
 * half: every field a row of a stack panel needs, as data, so the client words it and the engine never grows prose.
 *
 * Nothing here is a rule. It restates no rule either: every value is read straight off the frame that is already on
 * the stack. The one derived field is `openWindow`, which is `PendingChoice.frameId` (`choices.ts`) matched against
 * each frame — the engine already records which frame an open decision belongs to, so "← you are answering this one"
 * needs no new state.
 */

import { frameCardId } from "./ctx.js";
import type { FrameId, InstanceId } from "./ids.js";
import type { StackFrame, StackFrameKind, Vars, WindowTiming } from "./stack.js";
import type { GameState } from "./state.js";
import type { TriggerEventKind } from "./trigger-events.js";

/** One frame of the resolution stack, as a row. */
export interface StackEntry {
  readonly frameId: FrameId;
  /** Index into `state.stack`: 0 is resolving right now, higher numbers are queued behind it. */
  readonly depth: number;
  readonly kind: StackFrameKind;
  /**
   * The card this frame is about: the card being resolved (`frameCardId`), or the activating enemy of an
   * `enemyAttack`/`enemyScheme` procedure. Null for a frame that is about an event rather than a card.
   */
  readonly subjectInstanceId: InstanceId | null;
  /** The event a frame is resolving or filling a window for, if any. */
  readonly eventKind: TriggerEventKind | null;
  /** Which half of a timing window a `window` frame is filling (RRG 1.8 "Ability", p. 5). */
  readonly timing: WindowTiming | null;
  /** The frame's own step within its procedure, verbatim ("declareDefender", "flipBoosts", "responses", …). */
  readonly stage: string | null;
  /** What a `window` frame is waiting on: an order, a selection, or a payment. */
  readonly awaiting: "order" | "select" | "pay" | "costPick" | null;
  /** This is the frame the open `PendingChoice` belongs to. At most one entry has it. */
  readonly openWindow: boolean;
  /**
   * The numbers recorded on this frame while it resolves. An activation's event frame is where a forced interrupt's
   * changes land (`atkBonus`, `extraBoost`, `overkill`, `labeledDefense`, `undefended`, `schBonus`, `threatBonus`),
   * so this is what answers "did anything change this attack?" without the client re-deriving it.
   */
  readonly vars: Vars;
}

/** The enemy an activation procedure frame belongs to, on top of the card `frameCardId` names. */
function subjectOf(frame: StackFrame): InstanceId | null {
  if (frame.kind === "enemyAttack" || frame.kind === "enemyScheme") return frame.enemyInstanceId;
  return frameCardId(frame);
}

const eventKindOf = (frame: StackFrame): TriggerEventKind | null => {
  switch (frame.kind) {
    case "event":
    case "window":
      return frame.event.kind;
    case "damageGroup":
      return "dealDamage";
    case "ability":
    case "effects":
    case "playCard":
      return frame.event?.kind ?? null;
    default:
      return null;
  }
};

const stageOf = (frame: StackFrame): string | null =>
  "stage" in frame && typeof frame.stage === "string" ? frame.stage : null;

const varsOf = (frame: StackFrame): Vars => ("vars" in frame && frame.vars ? frame.vars : {});

/**
 * `state.stack` as rows, innermost first. Pure: it reads state and returns data, changes nothing, and is safe to call
 * as often as a client likes.
 */
export function stackEntries(state: GameState): readonly StackEntry[] {
  const openFrameId = state.pendingChoice?.frameId ?? null;
  return state.stack.map((frame, depth) => ({
    frameId: frame.frameId,
    depth,
    kind: frame.kind,
    subjectInstanceId: subjectOf(frame),
    eventKind: eventKindOf(frame),
    timing: frame.kind === "window" ? frame.timing : null,
    stage: stageOf(frame),
    awaiting: frame.kind === "window" ? frame.awaiting : null,
    openWindow: openFrameId !== null && frame.frameId === openFrameId,
    vars: varsOf(frame),
  }));
}
