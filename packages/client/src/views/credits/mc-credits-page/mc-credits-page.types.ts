import type { CreditsListRow, HintGlyph } from "@mc/ui";

/** What the Art & Credits page shows: the bar and the rows of the list. */
export interface CreditsPageModel {
  readonly phone: boolean;
  readonly bar: {
    readonly title: string;
    readonly backLabel: string;
    readonly backGlyph: HintGlyph | null;
    readonly titleDrop: number;
    readonly titleMaxRight: number;
  };
  readonly rows: readonly CreditsListRow[];
}
