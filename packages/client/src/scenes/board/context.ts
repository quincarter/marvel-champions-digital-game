/**
 * What every Board draw module is handed.
 *
 * The zone modules in this folder are plain functions over a
 * `BoardDrawContext`, not methods on the scene, so none of them can reach the
 * scene's own state — they draw what the context exposes and report taps back
 * through the controller.
 */

import type Phaser from "phaser";
import type { InstanceId } from "@mc/engine";
import type { CardArt } from "../../art/card-art.js";
import type { McButton, McSelectionRing } from "../../ui/widgets.js";
import type { Highlights } from "../../view/highlights.js";
import type { Rect } from "../../view/layout.js";
import type { BoardController } from "./controller.js";
import type { HandScroll } from "./hand.js";

/**
 * What one draw leaves behind, rebuilt from empty on every draw. The scene
 * keeps the previous frame just long enough to read "where a card was" for a
 * travel (`view/travel.ts`).
 */
export interface BoardFrame {
  /** Card rect by instance id, so a target tap can be hit-tested and ringed. */
  readonly hitRects: Map<InstanceId, Rect>;
  /** Rects of everything focusable this draw, so the focus ring knows where to go. */
  readonly focusRects: Map<string, Rect>;
  /** Widgets that own listeners, destroyed before the next draw. */
  readonly buttons: McButton[];
  readonly rings: McSelectionRing[];
}

export const emptyFrame = (): BoardFrame => ({ hitRects: new Map(), focusRects: new Map(), buttons: [], rings: [] });

export interface BoardDrawContext {
  readonly scene: Phaser.Scene;
  /** Card scans, shared with every overlay above the Board. */
  readonly art: CardArt;
  readonly marks: Highlights | null;
  /** Whether this draw lays the board out as phone tabs. */
  readonly tabbed: boolean;
  readonly controller: BoardController;
  readonly hand: HandScroll;
  readonly frame: BoardFrame;
  /**
   * Registers a card as a tap target: a tap acts (answering an open target or
   * payment prompt first, `onTap` otherwise), a hold or right-click inspects,
   * and — only when `onDrag` is given — a horizontal drag scrolls instead.
   */
  makeTapTarget(rect: Rect, id: InstanceId, onTap?: () => void, onDrag?: (deltaX: number) => void): void;
  inspect(id: InstanceId): void;
}
