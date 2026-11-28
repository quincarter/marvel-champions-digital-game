import type { ControlGlyph, PictureFocus } from "@mc/ui";
import type { ModNoticeAnswer } from "../../../view/mod-notice.js";
import type { ModStoreSize } from "../shared/mod-store-size.types.js";

/** One speaker of the heads-up. */
export interface ModNoticeLineModel {
  readonly speaker: string;
  readonly text: string;
  /** The speaker's picture (the full hero art, cropped round around the face); a `src` of null shows the initial. */
  readonly portrait: { readonly src: string | null; readonly focus?: PictureFocus };
}

export interface McModNoticeProps {
  size: ModStoreSize;
  /** The speakers, in order: nothing is drawn while there are none. */
  lines: readonly ModNoticeLineModel[];
  /** The two answers, in order ("Report a problem", "Got it"). */
  buttons: readonly { readonly id: ModNoticeAnswer; readonly label: string }[];
  closeGlyph: ControlGlyph | undefined;
}
