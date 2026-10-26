/**
 * Which glyph the decision popup's own buttons wear (owner playtest, 2026-10-25). Pure: the scene asks, this answers.
 *
 * - Confirm: A / Enter while it is what A would press (nothing focused, or Confirm itself, and it is ready); Start on a
 *   pad otherwise, which commits from anywhere on the sheet. Greyed or behind the reveal cover: nothing, because neither
 *   key would press it.
 * - Decline: X on a pad and G on the keyboard (the `guide` shortcut, which this popup has no other use for), the same
 *   second-answer key the villain phase uses.
 * - Back out / Nevermind: B (Esc, Q), shown always: B backs out when nothing is focused and first drops a focus.
 * - The hidden-info cover: A / Enter reveals while nothing else on the sheet is focused (or the cover is).
 */

import { primaryGlyphShown } from "./primary-activation.js";
import type { ShortcutId } from "./input-shortcuts.js";

export type GlyphInputSet = "keyboard" | "pad";

/** The ids Confirm shows now, or null for none. `primary` is the stop key of the commit A presses (null: A presses none). */
export function confirmGlyphIds(
  set: GlyphInputSet,
  focus: string | null,
  confirmKey: string,
  primary: string | null,
  ready: boolean,
): readonly ShortcutId[] | null {
  if (primary === null || !ready) return null;
  if (primaryGlyphShown(focus, confirmKey, ready)) return ["activate"];
  return set === "pad" ? ["confirm"] : null;
}

/** Decline's glyph: always, wherever it is drawn (the key presses it from anywhere on the sheet). */
export const DECLINE_GLYPH_IDS: readonly ShortcutId[] = ["guide"];

/** Back out / Nevermind's glyph: B, always. */
export const BACK_OUT_GLYPH_IDS: readonly ShortcutId[] = ["cancel"];

/** The reveal cover wears A while A would reveal: nothing focused, or the cover itself. */
export function revealGlyphIds(focus: string | null, revealKey: string): readonly ShortcutId[] | null {
  return focus === null || focus === revealKey ? ["activate"] : null;
}

/** What the popup's second-answer key (X / G) may do now. */
export interface DeclineKeyState {
  readonly canDecline: boolean;
  /** The Decline button is drawn on this sheet. */
  readonly drawn: boolean;
  /** The hidden-info cover is up. */
  readonly revealUp: boolean;
  /** The guide rail is up: it tells the learner X / G moves focus to the guide, so the key must not decline. */
  readonly guideRailUp: boolean;
}

/** True when X / G declines: offered, drawn, nothing covering it, and not claimed by the guide rail. */
export const declineKeyActive = (s: DeclineKeyState): boolean =>
  s.canDecline && s.drawn && !s.revealUp && !s.guideRailUp;

/** The glyph on Decline: shown only while its key would decline. */
export const declineGlyphIdsNow = (s: DeclineKeyState): readonly ShortcutId[] | null =>
  declineKeyActive(s) ? DECLINE_GLYPH_IDS : null;

/** B backs out only on a sheet whose title bar drew the button, and only with nothing focused (a focus drops first). */
export const backOutOnCancel = (focus: string | null, drawnTarget: number | null): number | null =>
  focus === null ? drawnTarget : null;

/**
 * Whether an activate is ignored: a keyboard repeat of the Enter that revealed the hidden-info cover would otherwise
 * commit the hidden choice. The first activate after a keyboard reveal needs a fresh press (a keyup in between).
 */
export const ignoreActivate = (source: "key" | undefined, keyStillDownFromReveal: boolean): boolean =>
  source === "key" && keyStillDownFromReveal;
