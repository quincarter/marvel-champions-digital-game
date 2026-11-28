import type { HintGlyph } from "@mc/ui";

/** The actions of the picked scenario: an optional second one, the call to action and the caption under it. */
export interface ScenarioActionsModel {
  /** Civil War's "Customize this scenario": a quieter action above the call to action; null for none. */
  readonly customize: string | null;
  /** The call to action ("Choose heroes ▸", or the unlock cost when the scenario is locked). */
  readonly next: string;
  /** Why it cannot be pressed now ("Pick a villain first"); null when it can. The button stays in place, dimmed. */
  readonly nextDisabled: string | null;
  /** Start's glyph on the red button, while a pad is in use; null for none. */
  readonly nextGlyph: HintGlyph | null;
  /** The small line under it: the step note, or how to open a locked scenario for free (which wraps). */
  readonly caption: string;
  /** The caption is a lock reason: full strength, not the faint step note. */
  readonly captionIsLock: boolean;
}
