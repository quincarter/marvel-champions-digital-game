import type { ControlGlyph, PictureSource } from "@mc/ui";
import type { GuideOptionModel } from "../../../components/learn/mc-guide-option/mc-guide-option.types.js";

/** Wide (a tablet in landscape, a desktop): the picture at the left, the choices at the right; narrow: stacked. */
export type GuideChooserMode = "wide" | "narrow";

/** Everything the first-run chooser shows, already computed and translated by the scene's view models. */
export interface GuideChooserPageModel {
  readonly art: { readonly picture: PictureSource | null; readonly heading: string };
  readonly options: {
    readonly subtitle: string;
    readonly options: readonly GuideOptionModel[];
    /** The tutorial's lessons as chips for the recommended card (none on a narrow screen). */
    readonly chips: readonly string[];
  };
  readonly actions: {
    readonly suitLabel: string;
    readonly backLabel: string;
    /** The Cancel glyph on Back while a keyboard or pad is in use. */
    readonly backGlyph: ControlGlyph | undefined;
  };
}
