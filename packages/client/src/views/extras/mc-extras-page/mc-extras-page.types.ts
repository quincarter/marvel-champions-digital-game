import type { ControlGlyph, HintGlyph, TabRailTab } from "@mc/ui";
import type { ExtrasPlayerModel } from "../../../components/extras/mc-extras-player/mc-extras-player.types.js";
import type { ExtrasShelfShape, ExtrasTile } from "../../../components/extras/mc-extras-shelf/mc-extras-shelf.types.js";
import type { ExtrasTrackItem } from "../../../components/extras/mc-extras-tracks/mc-extras-tracks.types.js";

/** The ink bar across the top. */
export interface ExtrasBarModel {
  /** "◂ TITLE" (a phone: the bare arrow). */
  readonly backLabel: string;
  readonly title: string;
  /** "12 of 64 open". */
  readonly right: string;
  readonly backGlyph: HintGlyph | null;
  /** How far the title drops, and where it must end, to clear the dark mode tab (`barClearance`). */
  readonly titleDrop: number;
  readonly titleMaxRight: number;
}

/** Everything Extras shows; the scene builds it from what is open and sets it on the page. */
export interface ExtrasPageModel {
  readonly phone: boolean;
  /** The doors take a row of their own over the rail (a phone, or a screen too narrow to print every tab beside them). */
  readonly stackDoors: boolean;
  readonly bar: ExtrasBarModel;
  readonly doors: { readonly trophies: string; readonly credits: string };
  readonly tabs: {
    readonly tabs: readonly TabRailTab[];
    readonly selected: string;
    readonly size: number;
    /** LB / RB under the rail's right end while a pad is in use. */
    readonly hint: ControlGlyph | undefined;
  };
  /** The Music tab's player; null on every other tab. */
  readonly player: ExtrasPlayerModel | null;
  /** The shelf of tiles (every tab but Music); null on Music. */
  readonly shelf: {
    readonly shape: ExtrasShelfShape;
    readonly tiles: readonly ExtrasTile[];
    readonly empty: string;
  } | null;
  /** The Music tab's songs; null on every other tab. */
  readonly tracks: { readonly tracks: readonly ExtrasTrackItem[]; readonly empty: string } | null;
}
