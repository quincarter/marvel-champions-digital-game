/**
 * The pure decision behind `scenes/board/guide-mount.ts#syncSourceOverride`: when a step names a `pickSource`
 * (`LessonStepCopy.pickSource`) and the "Attack with" / "Thwart with" picker is open listing that character,
 * `TRY THIS` moves from the step's action button onto that character's own picker button
 * (`scenes/board/controller-bar.ts#drawSourceBar`, keyed `sourceFocusKey(instanceId)`). The picker is client-side
 * selection state `LessonObservation` never carries, which is why this is an override rather than lesson data —
 * the same split `view/guide-paying-override.ts` makes for the payment bar.
 */
import type { GuideStepOverride } from "../guide/guide-controller.js";
import type { LessonStep } from "./lesson-model.js";

/** The picker button's own `focusRects` key for one character. */
export const sourceFocusKey = (instanceId: string): string => `source:${instanceId}`;

/**
 * `null` (leave the step's own anchor and copy alone) unless the step has a `pickSource`, the picker is open
 * (`sourceIds` non-null), and it lists the suggested character (`suggestedId`). A picker that doesn't offer the
 * suggestion — the player already attacked with that character, say — keeps `TRY THIS` off every button rather
 * than pointing at one the step didn't pick.
 */
export function sourceOverrideFor(
  step: LessonStep | null,
  suggestedId: string | null,
  sourceIds: readonly string[] | null,
): GuideStepOverride | null {
  const pick = step?.copy.pickSource;
  if (!pick || suggestedId === null || !sourceIds?.includes(suggestedId)) return null;
  return { anchor: { kind: "control", id: sourceFocusKey(suggestedId) }, doThis: pick.doThis };
}
