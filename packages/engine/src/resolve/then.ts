/**
 * RRG 1.8 "'Then'" (p. 44): "If the pre-'then' text of an effect does not fully resolve, the post-'then' text does not
 * attempt to resolve." The pre-"then" text of a `then` effect is every effect before it in the same effects program
 * (branches of `if`/`then` share their parent's vars both ways). Anything that finds the text before a "then" did not
 * fully resolve marks the program's effects frame with `UNRESOLVED_VAR`; a later `then` reads it and is skipped
 * (`thenSkipped`).
 *
 * Two log lines say why a frame was marked:
 *
 * - `choiceFoundNothing { slot }`: a required choice found nothing to choose (RRG 1.8 "Choose (Game Element)", p. 12;
 *   `effects-frame.ts`'s `choseNothing`, from #61);
 * - `preThenUnresolved { cause }`: every other way (`PreThenFailure`, below), marked by `markPreThenUnresolved`.
 *
 * The mark is only ever read by `then`, so marking a frame that has no later `then` changes nothing but the log.
 */

import { type Ctx, emit } from "../ctx.js";
import type { PreThenFailure } from "../events.js";
import type { FrameId, InstanceId } from "../ids.js";
import { addFrameVars } from "./frames.js";

/** The frame var the text before a "then" sets when it did not fully resolve, read by `then`. */
export const UNRESOLVED_VAR = "_then.unresolved";

/**
 * Marks the effects frame `frameId` as holding pre-"then" text that did not fully resolve, and logs why. Used both by an
 * effect that fails as it applies (a search that finds nothing, a cancel with nothing to cancel) and by a procedure an
 * effect started that turned out not to happen (an attack cancelled by a stunned status, a reveal whose effects were
 * cancelled), which reports back to the frame that started it.
 */
export function markPreThenUnresolved(
  ctx: Ctx,
  frameId: FrameId | null | undefined,
  cause: PreThenFailure,
  instanceId?: InstanceId,
): void {
  if (!frameId) return;
  const frame = ctx.state.stack.find((f) => f.frameId === frameId);
  if (frame?.kind !== "effects") return;
  emit(ctx, { type: "preThenUnresolved", cause, ...(instanceId ? { instanceId } : {}) });
  if ((frame.vars[UNRESOLVED_VAR] ?? 0) > 0) return;
  addFrameVars(ctx, frameId, { [UNRESOLVED_VAR]: 1 });
}
