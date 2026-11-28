import type { HintGlyph } from "@mc/ui";
import type { McRulesScopeProps } from "../mc-rules-scope/mc-rules-scope.types.js";

export interface McRulesHeaderProps {
  /** "◂ Back". */
  backLabel: string;
  /** "Rules reference". */
  heading: string;
  /** The Cancel glyph on Back; null on touch or a mouse. */
  backGlyph: HintGlyph | null;
  /** How far the title drops, and where it must end (px, 0 for no limit), to clear the dark mode tab. */
  titleDrop: number;
  titleMax: number;
  /** The scope row's caption and toggle. */
  caption: string;
  toggle: McRulesScopeProps["toggle"];
}
