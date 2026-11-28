import type { HintGlyph } from "@mc/ui";

/** The Back / Confirm bar under a confirm step, and its optional quiet Inspect button. */
export interface ConfirmBarModel {
  /** The focus stop keys: `role-back` / `role-confirm`, or `rb-back` / `rb-confirm` / `rb-inspect`. */
  readonly stops: { readonly back: string; readonly confirm: string; readonly read?: string };
  /** The Start glyph on Confirm while a pad is in use; null for none. */
  readonly glyph: HintGlyph | null;
}
