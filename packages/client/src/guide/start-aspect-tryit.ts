/**
 * Starts an aspect's "Try it" game (guided mode G10d, `docs/guided-mode.md` §3.7, §4 G10d): the one call site
 * `scenes/aspect-lesson.ts#onTryIt` uses, the same shape `guide/start-tutorial.ts#startTutorialGame` is for the
 * five-lesson tutorial — loads `guide/aspect-tryit-config.ts`'s own `SessionConfig` for this aspect, answers its
 * mulligan choice as dealt (keeping the stacked opening hand, same as the tutorial), and marks
 * `appSession().guidedRun`/`guidedRunKind` so `BoardScene` mounts the guide controller against
 * `guide/aspect-lessons.ts`'s own one-lesson run instead of the tutorial's five.
 *
 * **Forces Full guidance for this run only**, same as the tutorial (`guide/guide-store.ts#setGuideRunLevelOverride`)
 * — an aspect "Try it" run is always launched from the aspect lesson page, never resumed at a guide level the
 * player picked earlier.
 *
 * **Every setup choice past the mulligan, answered with its first option.** Unlike `TUTORIAL_CONFIG` (whose only
 * pending choice after the mulligan is a nothing-to-discard one, so `resolveChoice([])` alone ever fires), Black
 * Panther's own setup ability (`chooseCards`, "pick a starting upgrade") asks for exactly one — resolving with `[]`
 * there would be an illegal `minSelections: 1` answer. None of the four heroes' own setup choices are anything
 * `guide/aspect-lessons.ts` teaches, so picking whichever option the engine lists first is as good as any other
 * (the game is still fully replay-safe: `ASPECT_TRYIT_CONFIGS`'s own seed pins the order every time).
 */
import { appSession } from "../session.js";
import { setGuideRunLevelOverride } from "./guide-store.js";
import { ASPECT_TRYIT_CONFIGS, type AspectTryItId } from "./aspect-tryit-config.js";

export async function startAspectTryItGame(aspect: AspectTryItId): Promise<void> {
  setGuideRunLevelOverride("full");
  const { store } = appSession();
  const { config } = ASPECT_TRYIT_CONFIGS[aspect];
  // Stamped on the config (guided mode §3.12, `guide/tutorial-resume.ts`), same as `startTutorialGame` — this
  // call site knows it's an aspect run before `appSession().guidedRunKind` is set, below.
  await store.start({ ...config, guided: { kind: "aspect", aspect } });
  for (let pending = store.state.game?.pendingChoice; pending; pending = store.state.game?.pendingChoice) {
    const answer = pending.minSelections > 0 ? [pending.options[0]!.optionId] : [];
    const ok = await store.resolveChoice(answer);
    if (!ok) break;
  }

  appSession().guidedRun = true;
  appSession().guidedRunKind = { kind: "aspect", aspect };
  appSession().guidedRunAlreadyDone = undefined;
}
