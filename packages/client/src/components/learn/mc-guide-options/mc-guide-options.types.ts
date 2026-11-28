import type { GuideOptionModel } from "../mc-guide-option/mc-guide-option.types.js";

/** The properties of `mc-guide-options`. */
export interface GuideOptionsProps {
  /** The line over the cards, already translated. */
  readonly subtitle: string;
  readonly options: readonly GuideOptionModel[];
  /** "1 · HOW TO WIN", …: the tutorial's lessons, for the recommended card (none on a narrow screen). */
  readonly chips: readonly string[];
}
