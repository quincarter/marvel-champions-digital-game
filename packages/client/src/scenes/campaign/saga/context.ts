/**
 * What the Saga's drawing pieces (`saga/*.ts`) share: the layout numbers, and `SagaCtx`, the one object the scene hands
 * them (its builder-side state and the few things a piece may ask it to do). The pieces are plain functions over it, so the
 * scene stays a thin owner of the panel, the focus route and navigation.
 */
import type Phaser from "phaser";
import type { PictureLeases } from "../../../dom/picture-leases.js";
import type { SheetGlyphs } from "../../../dom/sheet-glyphs.js";
import type { SagaVolumesView } from "../../../platform/saga-view.js";
import type { SagaVolumeRow } from "../../../view/campaign-saga-model.js";
import type { Rect } from "../../../view/layout.js";
import type { FocusRoute, FocusStop } from "../../focus-route.js";

export const WIDE_TILE_COLUMNS = 4;
export const TILE_COLUMNS = 4;
export const PHONE_TILE_COLUMNS = 2;
export const TILE_GAP = 12;
export const MIN_TILE_HEIGHT = 100;
export const VOLUME_ROW_HEIGHT = 58;
export const VIEW_STOP = "volumes-view";
/** The scrollbar's room beside a scroller (`SCROLL_GUTTER` in `@mc/ui`). */
export const SCROLL_GUTTER = 8;
/** The volumes scroller's key in the panel. */
export const LIST = "saga-volumes";
/** The room the "scroll for more" cue takes under the list. */
export const MORE_HEIGHT = 20;
/** The tile's own ground: a shade warmer than ink, as the design canvas has it. */
export const TILE_GROUND = 0x0b0906;
export const CUSTOM_HEADER_HEIGHT = 34;

/** Where a page-scrolled list's rows are (the phone's one scroller): see `drawVolumes`. */
export interface VolumeInline {
  /** The builder to draw the rows into, and the content y of the first row. */
  readonly into: import("../../../dom/sheet-builder.js").SheetBuilder;
  readonly top: number;
  /** A content-space rect as it is on the screen now. */
  readonly onScreen: (content: Rect) => Rect;
  /** The part of the screen a row can be seen in. */
  readonly view: () => Rect;
  /** Scrolls the page the least that brings a row into view. */
  readonly reveal: (content: Rect) => void;
}

/** How the volumes draw as tiles: how many across, and how tall. */
export interface VolumeTiles {
  readonly columns: number;
  readonly height: number;
}

/** One row of the volumes list: a section header, or a run of volumes (a tile row, or a single phone row). */
export type ShelfItem =
  | { readonly kind: "header" }
  | { readonly kind: "volumes"; readonly rows: readonly SagaVolumeRow[] };

/** The scene state the pieces read and write while a screen is drawn. */
export interface SagaState {
  rows: readonly SagaVolumeRow[];
  /** The featured volume's number. */
  featured: number;
  /** Start over is waiting for its second tap. */
  confirmAbandon: boolean;
  /** Box art tiles or plain rows under the featured volume, on a phone or an upright tablet. */
  volumesView: SagaVolumesView;
  /** The volumes list's box on the screen, and what it holds: the focus ring and the scroll cue read them. */
  listRect: Rect;
  listContent: number;
  listTop: number;
  moreShown: boolean;
  /** What the player chose on this visit; until then the kept choice, or the screen's own default. */
  volumesChosen: SagaVolumesView | null;
  /** Whether the featured volume's big button can be pressed right now (Start and A must not press a disabled one). */
  ctaEnabled: boolean;
}

export interface SagaCtx {
  readonly scene: Phaser.Scene;
  readonly glyphs: SheetGlyphs;
  readonly leases: PictureLeases;
  readonly actions: Map<string, () => void>;
  readonly stops: Map<string, FocusStop>;
  readonly meanings: Map<string, string>;
  readonly obstacles: Rect[];
  readonly route: FocusRoute | null;
  readonly state: SagaState;
  scroller(): HTMLElement | null;
  /** Whether there is more list below the view: what the "scroll for more" cue says. */
  moreNow(): boolean;
  feature(number: number): void;
  rebuild(): void;
  /** Reads the saved runs and unlocks again and draws (an unlock just changed them). */
  reload(): void;
  startOver(row: SagaVolumeRow): void;
}
