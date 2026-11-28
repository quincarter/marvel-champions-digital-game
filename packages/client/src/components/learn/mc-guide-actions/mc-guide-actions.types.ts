import type { ControlGlyph } from "@mc/ui";

/** The properties of `mc-guide-actions`. */
export interface GuideActionsProps {
  /** "Suit up", already translated. */
  readonly suitLabel: string;
  /** "Back", already translated. */
  readonly backLabel: string;
  /** Back is drawn (the wide screen only). */
  readonly showBack: boolean;
  /** The Cancel glyph on Back while a keyboard or pad is in use. */
  readonly backGlyph: ControlGlyph | undefined;
}
