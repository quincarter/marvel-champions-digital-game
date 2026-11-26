import type { Rect } from "../view/layout.js";

/** The slice of a Phaser game object the hole filter reads. */
export interface DrawnObject {
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
