/**
 * One "(thwart)" ability is one thwart. RRG 1.8 "Thwart" (p. 44): "An ability labeled as a thwart is considered a
 * single thwart, even if that thwart removes multiple instances of threat", and "If an ability increases the amount
 * of threat an ability labeled as a thwart removes and that ability removes multiple instances of threat, each of
 * those instances that does not use the word 'additional' is increased by the specified amount." Owner decision,
 * 2026-10-03 (and Q78, docs/phase7-wave6.md §4.1, for the per-instance increase).
 *
 * Each instance of threat a "(thwart)" ability removes by its controller's identity (one scheme of an "each scheme",
 * one share of a division, one of two "remove N threat from a scheme" sentences) is still its own `thwart` event
 * frame, so each is checked, paid for (`additionalThwartCost`) and removed on its own. The frames are tied to the
 * ability by `TriggerEvent thwart.abilityFrameId`, the root effects frame of the ability's resolution, which carries
 * the `ThwartSession`:
 *
 * - **"When you thwart" is heard once**, as the first instance initiates: only that frame opens an interrupt window
 *   (and logs `initiated`). What an interrupt adds ("that thwart removes 1 additional threat", `modifyThwart`) is kept
 *   on the session and added to every instance; cancelling that thwart cancels every instance.
 * - **"After you thwart" is heard once**, when the ability's effects have all resolved: the root frame then pushes one
 *   resolved `thwart` event whose `amount` is the threat every instance removed together, with `instances` listing
 *   each scheme and its amount when there were several. `schemeInstanceId` is the first instance's scheme, and the
 *   event's targets (`eventTarget`, `targetIs`, `selfIs: "target"`) are every scheme an instance was aimed at. Its
 *   results are the instances' results summed. No instance logs its own `resolved` line or opens its own window.
 *
 * A basic thwart and a thwart by another character (an ally's "it thwarts") have no session and resolve as before.
 */

import { type Ctx, findFrame, pushFrames, setFrame, updateFrame } from "../ctx.js";
import type { FrameId } from "../ids.js";
import type { ThwartSession } from "../stack.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { eventFrame, type Frame } from "./frames.js";

type Thwart = Extract<TriggerEvent, { kind: "thwart" }>;

/**
 * The root effects frame of the ability resolution `frame` belongs to: the deepest of the run of effects frames of
 * the same ability and card directly beneath it (a branch of an `if`, an option or a "then" sits on its parent).
 */
export function abilityRootFrameId(state: GameState, frame: Frame<"effects">): FrameId {
  const start = state.stack.findIndex((other) => other.frameId === frame.frameId);
  let root = frame.frameId;
  for (let index = start + 1; start >= 0 && index < state.stack.length; index++) {
    const below = state.stack[index];
    if (below?.kind !== "effects") break;
    if (below.abilityId !== frame.abilityId || below.selfInstanceId !== frame.selfInstanceId) break;
    root = below.frameId;
  }
  return root;
}

/** The session the ability frame `frameId` carries, once its first instance has initiated. */
export function thwartSessionOf(state: GameState, frameId: FrameId | undefined): ThwartSession | undefined {
  const frame = frameId ? findFrame(state, frameId) : undefined;
  return frame?.kind === "effects" ? frame.thwart : undefined;
}

function updateSession(ctx: Ctx, frameId: FrameId, change: (session: ThwartSession) => ThwartSession): void {
  updateFrame(ctx, frameId, (frame) =>
    frame.kind === "effects" && frame.thwart ? { ...frame, thwart: change(frame.thwart) } : frame,
  );
}

/** The first instance initiates: the ability's thwart begins. False when the ability's frame is gone. */
export function openThwartSession(ctx: Ctx, event: Thwart): boolean {
  const frame = event.abilityFrameId ? findFrame(ctx.state, event.abilityFrameId) : undefined;
  if (frame?.kind !== "effects") return false;
  setFrame(ctx, {
    ...frame,
    thwart: {
      thwarterInstanceId: event.thwarterInstanceId,
      playerId: event.playerId,
      sourceInstanceId: event.sourceInstanceId ?? null,
      extraThreat: 0,
      instances: [],
      results: {},
    },
  });
  return true;
}

/** "That thwart removes N additional threat": kept for the instances that have not resolved yet. */
export function addSessionExtraThreat(ctx: Ctx, event: Thwart, extra: number): void {
  if (event.abilityFrameId) {
    updateSession(ctx, event.abilityFrameId, (session) => ({ ...session, extraThreat: session.extraThreat + extra }));
  }
}

/** The thwart was cancelled (not one instance's own additional cost declined): no instance resolves, nothing answers. */
export function cancelThwartSession(ctx: Ctx, event: Thwart): void {
  if (event.abilityFrameId) updateSession(ctx, event.abilityFrameId, (session) => ({ ...session, cancelled: true }));
}

/** An instance has resolved: its scheme, the threat it removed and its results join the ability's one thwart. */
export function foldThwartInstance(ctx: Ctx, frame: Frame<"event">): boolean {
  const event = frame.event;
  if (event.kind !== "thwart" || !thwartSessionOf(ctx.state, event.abilityFrameId)) return false;
  updateSession(ctx, event.abilityFrameId!, (session) => {
    const results: Record<string, number> = { ...session.results };
    for (const [key, amount] of Object.entries(frame.vars)) {
      // The modifier is the session's own, already added to each instance.
      if (key !== "extraThreat") results[key] = (results[key] ?? 0) + amount;
    }
    return {
      ...session,
      instances: [
        ...session.instances,
        { schemeInstanceId: event.schemeInstanceId, amount: frame.vars.threatRemoved ?? 0 },
      ],
      results,
    };
  });
  return true;
}

/**
 * The ability's effects have all resolved: its one thwart is announced as resolved, for "after you thwart". Returns
 * true when it pushed the event (the effects frame then waits beneath it and finishes afterwards).
 */
export function announceAbilityThwart(ctx: Ctx, frame: Frame<"effects">): boolean {
  const session = frame.thwart;
  if (!session || session.announced) return false;
  setFrame(ctx, { ...frame, thwart: { ...session, announced: true } });
  const [first] = session.instances;
  if (!first || session.cancelled) return false;
  const event: Thwart = {
    kind: "thwart",
    thwarterInstanceId: session.thwarterInstanceId,
    schemeInstanceId: first.schemeInstanceId,
    playerId: session.playerId,
    amount: session.instances.reduce((sum, instance) => sum + instance.amount, 0),
    basic: false,
    sourceInstanceId: session.sourceInstanceId,
    ...(session.instances.length > 1 ? { instances: session.instances } : {}),
  };
  const announced = eventFrame(ctx, event, null, session.results);
  pushFrames(ctx, [announced.kind === "event" ? { ...announced, stage: "responses" } : announced]);
  return true;
}
