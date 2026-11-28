import type { PictureSource } from "@mc/ui";
import type { ViewerLine, ViewerPromo } from "../../../components/viewer/mc-viewer-text/mc-viewer-text.types.js";

/** Everything the Extras viewer shows; the scene builds it from the entry and the slide and sets it on the page. */
export interface ViewerPageModel {
  /** A phone (under 600px): a smaller title and tighter gutters. */
  readonly compact: boolean;
  /** The words beside the picture (820px and up, with words to show) rather than under it. */
  readonly wide: boolean;
  readonly header: {
    /** The entry's title, in capitals. */
    readonly title: string;
    readonly closeLabel: string;
  };
  readonly slide: {
    readonly picture: PictureSource | null;
    /** "Cover" or "Cover · 2 / 5". */
    readonly caption: string;
    /** More than one picture: the arrows show. */
    readonly arrows: boolean;
    /** "No artwork for this one yet.", for a file with nothing open. */
    readonly empty: string;
  };
  /** The words column; null for a file with none (a piece of artwork). */
  readonly text: {
    readonly subtitle: string;
    readonly lines: readonly ViewerLine[];
    readonly promo: ViewerPromo | null;
    readonly note: string;
  } | null;
}
