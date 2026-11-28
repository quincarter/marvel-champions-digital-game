import type { HintGlyph } from "@mc/ui";

/** Everything the side-story reader's chrome shows; the scene builds it from the beat and sets it on the page. */
export interface SideStoryPageModel {
  /** A phone: smaller title, credit and buttons, a shorter action bar. */
  readonly compact: boolean;
  readonly header: {
    /** "SIDE STORY". */
    readonly label: string;
    /** The story's title, in capitals. */
    readonly title: string;
    readonly credit: string;
    /** "CLOSE ✕". */
    readonly closeLabel: string;
    /** The Start glyph on CLOSE, or null. */
    readonly closeGlyph: HintGlyph | null;
  };
  /** "PAGE 2 · PANEL 3" or "PAGE 2 · FULL PAGE". */
  readonly where: string;
  readonly actions: {
    readonly hasBack: boolean;
    readonly backLabel: string;
    /** "NEXT ▸", or "DONE ▸" on the last beat. */
    readonly nextLabel: string;
    readonly nextGlyph: HintGlyph | null;
  };
}
