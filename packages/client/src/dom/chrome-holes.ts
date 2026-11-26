import type { Rect } from "../view/layout.js";

/** The slice of a Phaser game object the hole filter reads. */
export interface DrawnObject {
  readonly type?: string;
  /** A Graphics object's recorded draw calls: empty once cleared, so nothing of it is on screen. */
  readonly commandBuffer?: readonly unknown[];
  readonly visible?: boolean;
  readonly alpha?: number;
  readonly parentContainer?: DrawnObject | null;
  readonly getBounds?: () => Rect;
}

/**
 * The hole a chrome object (a corner button, a toast) cuts in a panel, or null when it is not actually drawn: hidden,
 * fully transparent, under a hidden or transparent container, empty, or off the camera. A hole for an object nobody can
 * see would show the canvas through the panel (the phone's hidden music/language/report buttons did exactly that).
 */
export function drawnChromeBox(object: DrawnObject, camera: Rect): Rect | null {
  if (!object.getBounds) return null;
  for (let o: DrawnObject | null | undefined = object; o; o = o.parentContainer) {
    if (o.visible === false || o.alpha === 0) return null;
  }
  const b = object.getBounds();
  if (!(b.width > 0 && b.height > 0)) return null;
  const x = Math.max(b.x, camera.x);
  const y = Math.max(b.y, camera.y);
  const width = Math.min(b.x + b.width, camera.x + camera.width) - x;
  const height = Math.min(b.y + b.height, camera.y + camera.height) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}

/** Whether an object paints something itself: a hit-area Zone never does, an emptied Graphics does not, the rest do. */
function paints(object: DrawnObject): boolean {
  if (object.visible === false || object.alpha === 0 || object.type === "Zone") return false;
  return object.type !== "Graphics" || (object.commandBuffer?.length ?? 0) > 0;
}

/**
 * The holes for one chrome scene's objects. A corner button is a Graphics frame plus a Zone for its hit area; a scene
 * that stops drawing its button (the Title's row, left behind on another screen) clears the Graphics but keeps the
 * Zone where it was, so a Zone cuts a hole only while a sibling paints something.
 */
export function drawnChromeBoxes(objects: readonly DrawnObject[], camera: Rect): Rect[] {
  const anyPainted = objects.some(paints);
  const boxes: Rect[] = [];
  for (const object of objects) {
    if (object.type === "Zone" && !anyPainted) continue;
    const box = drawnChromeBox(object, camera);
    if (box) boxes.push(box);
  }
  return boxes;
}
