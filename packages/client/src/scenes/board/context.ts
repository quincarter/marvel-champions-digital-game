/**
 * What every Board draw module is handed.
 *
 * The zone modules in this folder are plain functions over a
 * `BoardDrawContext`, not methods on the scene, so none of them can reach the
 * scene's own state — they draw what the context exposes and report taps back
 * through the controller.
 */

import type Phaser from "phaser";
import type { InstanceId, PlayerId } from "@mc/engine";
import type { CardArt } from "../../art/card-art.js";
import type { McButton, McSelectionRing } from "../../ui/widgets.js";
import type { Highlights } from "../../view/highlights.js";
import type { Rect } from "../../view/layout.js";
import type { BoardController } from "./controller.js";
import type { HandScroll } from "./hand.js";
import type { BoardMotion } from "./motion.js";

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
  /**
   * Each pile box drawn this draw, by `pileKey`: where a card moving into or
   * out of a pile travels to or from (`motion.ts#pileAnchor`).
   */
  readonly pileRects: Map<string, Rect>;
  /** Widgets that own listeners, destroyed before the next draw. */
  readonly buttons: McButton[];
  readonly rings: McSelectionRing[];
  /**
   * Mask shapes this draw made. A mask shape is never on the display list (it would render), so clearing the
   * scene's children does not reach it and the next draw has to destroy it by name.
   */
  readonly masks: Phaser.GameObjects.Graphics[];
}

export const emptyFrame = (): BoardFrame => ({
  hitRects: new Map(),
  focusRects: new Map(),
  pileRects: new Map(),
  buttons: [],
  rings: [],
  masks: [],
});

/**
 * A pile's key in `BoardFrame.pileRects`: the zone kind, whose pile it is when
 * it belongs to a player, and — for a separate deck, since an identity could
 * in principle bring more than one — which one by its printed name (Doctor
 * Strange's Invocation deck).
 */
export const pileKey = (
  kind: "deck" | "discard" | "encounterDeck" | "encounterDiscard" | "separateDeck" | "separateDiscard",
  playerId?: PlayerId,
  name?: string,
): string => [kind, playerId, name].filter((part) => part !== undefined).join(":");

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
  /** Timed motions still live from the most recently landed state — status stamps, an exhaust turn, an HP/threat count, the defeat flash. */
  readonly motion: BoardMotion;
  /**
   * Registers a card as a tap target: a tap acts (answering an open target or
   * payment prompt first, `onTap` otherwise), a hold or right-click inspects,
   * and — only when `onDrag` is given — a horizontal drag scrolls instead.
   */
  makeTapTarget(rect: Rect, id: InstanceId, onTap?: () => void, onDrag?: (deltaX: number) => void): void;
  /** Opens a card. `siblings` is the list ◂ ▸ steps through; without it, the hand when the card is in it. */
  inspect(id: InstanceId, siblings?: readonly InstanceId[]): void;
}
