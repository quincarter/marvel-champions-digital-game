/**
 * What waits for the end of a reveal: every response window, and toughness, triggered while an encounter card is
 * being revealed.
 *
 * RRG 1.8 "Reveal" (p. 38): "Responses (both forced and non-forced) to any step of the revealing of an encounter card
 * are not resolved until after all steps of the reveal process have been completed." The owner's decision of
 * 2026-10-16 (rules audit finding 18) reads it as written: the responses to anything that happens while the reveal
 * resolves wait, whatever the occurrence (threat placed by incite or a When Revealed, a card entering play, damage,
 * status cards, cards drawn or discarded). This replaces the narrower holds of the owner's answers 32B and 35B
 * (2026-10-12), which held only the responses to the revealed card entering play.
 *
 * How. `pushWindow` hands every response window it is asked to open to the reveal in progress (`holdingReveal`)
 * instead of pushing it: the window's conditions are appended to `Frame<"reveal">.heldResponses`, and the reveal opens
 * them all in one window at its end, with "after this card is revealed" (`announceRevealFinished`, answer 39A's first
 * window; forced responses resolve first there, RRG 1.8 "Simultaneous Timing Priority", p. 5). Interrupts are never
 * held: they resolve as their occurrence would (RRG 1.8 "Interrupt", p. 25). Lasting "each time …" effects are not
 * Response abilities and resolve where they always did.
 *
 * Toughness is a forced response too (RRG 1.8 "Toughness", p. 45: "Forced Response: After this character enters play,
 * give it a tough status card"), so a character entering play while a reveal resolves gets its tough status card
 * once the reveal's steps are done (`Frame<"reveal">.heldToughness`). This supersedes the owner's answer 33A
 * (2026-10-12), which kept the tough card as the minion entered play, under the order of rules authority of CLAUDE.md
 * (the latest RRG first). A card put into play with no reveal in progress is unchanged (answer 38A).
 */

import { type Ctx, updateFrame } from "../ctx.js";
import type { InstanceId } from "../ids.js";
import type { StackFrame } from "../stack.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import type { Frame } from "./frames.js";

/**
 * The stages during which a reveal is "resolving" in the sense of RRG 1.8 p. 38: from its first step (the card turned
 * faceup, `enterPlay` onward) to its last (`finish`, step 4). Not `faceup`, a reveal pushed but not begun, so a frame
 * resolving above one that has yet to start is not held; and not `keywords`, `responses` or `done`, where every step
 * is complete: quickstrike, teamwork and the responses to the reveal are resolving then, and the responses they cause
 * in turn are not responses to a step of the reveal.
 */
const HOLDING: ReadonlySet<Frame<"reveal">["stage"]> = new Set<Frame<"reveal">["stage"]>([
  "enterPlay",
  "attachInstruction",
  "cannotAttach",
  "uniqueCheck",
  "quickstrike",
  "whenRevealed",
  "settleAttach",
  "finish",
]);

/**
 * The reveal whose end the responses now triggered wait for: the innermost reveal still in one of its steps
 * (`HOLDING`), or undefined when no reveal is. A reveal inside another's step (a When Revealed that reveals another
 * card) is part of that step, so once the inner reveal's own steps are done what it causes waits for the outer one.
 */
export function holdingReveal(state: GameState): Frame<"reveal"> | undefined {
  return state.stack.find((f): f is Frame<"reveal"> => f.kind === "reveal" && HOLDING.has(f.stage));
}

/**
 * Hands the response window of `events` (the conditions of one occurrence, in the order a shared window lists them) to
 * the reveal in progress. False, with nothing done, when no reveal is in progress.
 */
export function holdResponsesForReveal(ctx: Ctx, events: readonly TriggerEvent[]): boolean {
  const reveal = holdingReveal(ctx.state);
  if (!reveal) return false;
  updateFrame(ctx, reveal.frameId, (f) =>
    f.kind === "reveal" ? { ...f, heldResponses: [...(f.heldResponses ?? []), ...events] } : f,
  );
  return true;
}

/**
 * `id` enters play with the toughness keyword while a reveal is in progress: its tough status card waits for the end
 * of that reveal (`Frame<"reveal">.heldToughness`). False, with nothing done, when no reveal is in progress.
 */
export function holdToughnessForReveal(ctx: Ctx, id: InstanceId): boolean {
  const reveal = holdingReveal(ctx.state);
  if (!reveal) return false;
  updateFrame(ctx, reveal.frameId, (f): StackFrame =>
    f.kind === "reveal" ? { ...f, heldToughness: [...(f.heldToughness ?? []), id] } : f,
  );
  return true;
}
