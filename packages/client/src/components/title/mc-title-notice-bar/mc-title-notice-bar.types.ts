import type { TitleGlyph } from "../shared/title.types.js";

/** The slim "what is new" strip across the top of the Title, already worded and translated. */
export interface TitleNoticeInput {
  /** The caution-yellow tag at the left ("NEW"). */
  readonly tag: string;
  readonly message: string;
  /** The link at the right ("Read more ↗"). */
  readonly link: string;
  /** The link's words where the strip is too narrow for them (an arrow alone). */
  readonly linkShort: string;
  /** The press glyph beside the link while the strip has focus. */
  readonly glyph?: TitleGlyph;
}
