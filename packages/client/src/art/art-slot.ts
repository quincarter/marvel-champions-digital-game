/**
 * A card scan drawn into one tile of a list row, with a stand-in until the scan arrives.
 *
 * A screen that redraws whole whenever a batch of scans lands (`CardArt.onArrived`) rebuilds every label, panel and
 * button on it for each batch, and while scrolling a card grid the batches keep coming: on Decks & Collection that was
 * most of the scroll's long tasks. A tile drawn through `drawArtSlot` instead hands back a `fill`, which the row passes
 * up as its `refresh` (`McVirtualList#refreshRows`, `McVariableList#refreshRows`): on arrival only the stand-in is
 * swapped for the picture, in the same place in the same container, and nothing else is drawn again.
 */
import type Phaser from "phaser";
import type { ArtSource } from "./art-source.js";
import { cardArt, drawArt, type DrawArtOptions } from "./card-art.js";
import type { Rect } from "../view/layout.js";

/** The parts of a container (or the scene's display list) a slot uses to put the picture where the stand-in was. */
export interface SlotParent {
  getIndex(child: Phaser.GameObjects.GameObject): number;
  addAt?(child: Phaser.GameObjects.GameObject, index: number): unknown;
  moveTo?(child: Phaser.GameObjects.GameObject, index: number): unknown;
}

export interface ArtSlotDeps {
  /** The texture key when the scan is on hand, else null (and the scan is asked for). */
  readonly request: () => string | null;
  /** Draws the scan into the slot (`drawArt`). */
  readonly draw: (key: string) => Phaser.GameObjects.GameObject | null;
  /** Where an object with no container sits: the scene's display list. */
  readonly sceneList: SlotParent;
}

/**
 * Draws the scan, or `placeholder()` when it isn't on hand yet, and pushes what it drew into `objects` (the row's
 * objects, which the list destroys with the row). Returns the `fill` to call on every refresh (a row's
 * `refresh`): it puts the picture in once its scan arrives and returns true while it is in. It asks the cache for a
 * drawn scan again, so the cache counts it as in use; if the cache evicted it anyway, the stand-in goes back until the
 * scan is in again. It does nothing once the row is gone.
 */
export function placeArtSlot(
  deps: ArtSlotDeps,
  objects: Phaser.GameObjects.GameObject[],
  placeholder: () => Phaser.GameObjects.GameObject,
): () => boolean {
  const key = deps.request();
  const drawn = key ? deps.draw(key) : null;
  /** What the slot shows now: the picture, or the stand-in until it arrives. */
  let shown = drawn ?? placeholder();
  let isPicture = drawn !== null;
  objects.push(shown);

  /** Puts `next` where `shown` is, in the row's objects and on screen, and destroys `shown`. */
  const swap = (next: Phaser.GameObjects.GameObject): void => {
    const at = objects.indexOf(shown);
    if (at >= 0) objects[at] = next;
    else objects.push(next);
    const container = shown.parentContainer as SlotParent | null;
    if (container?.addAt) container.addAt(next, container.getIndex(shown));
    // A new object starts on top of the scene's own list: move it down to the old one's place.
    else deps.sceneList.moveTo?.(next, deps.sceneList.getIndex(shown));
    shown.destroy();
    shown = next;
  };

  return () => {
    if (!shown.active) return false;
    // Asked again on every refresh, as a redraw would: the cache evicts the scans asked for longest ago, and a shown
    // one must count as in use.
    const now = deps.request();
    if (isPicture) {
      if (now) return true;
      // Evicted anyway (asked for again just now): the stand-in goes back until the scan is in again.
      swap(placeholder());
      isPicture = false;
      return false;
    }
    if (!now) return false;
    const picture = deps.draw(now);
    if (!picture) return false;
    swap(picture);
    isPicture = true;
    return true;
  };
}

/** `placeArtSlot` for a card scan in a Phaser scene. */
export function drawArtSlot(
  scene: Phaser.Scene,
  source: ArtSource | null | undefined,
  rect: Rect,
  objects: Phaser.GameObjects.GameObject[],
  placeholder: () => Phaser.GameObjects.GameObject,
  options: DrawArtOptions = {},
): () => boolean {
  const art = cardArt(scene);
  return placeArtSlot(
    {
      request: () => art.request(scene, source ?? null),
      draw: (key) => drawArt(scene, key, rect, options),
      sceneList: scene.children as unknown as SlotParent,
    },
    objects,
    placeholder,
  );
}
