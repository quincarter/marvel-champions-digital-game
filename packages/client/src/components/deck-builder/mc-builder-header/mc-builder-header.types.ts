import type { ControlGlyph } from "@mc/ui";

/** How the builder is laid out: three columns, one narrow column of tabs, or the same on a phone. */
export type BuilderLayout = "wide" | "narrow" | "phone";

/** The header row: the screen's title and Back. */
export interface BuilderHeaderModel {
  /** The title, already in capitals and translated (a campaign's own title can run to two lines). */
  readonly title: string;
  readonly backLabel: string;
  /** The Cancel glyph on Back while a keyboard or pad is in use. */
  readonly backGlyph?: ControlGlyph | undefined;
}
