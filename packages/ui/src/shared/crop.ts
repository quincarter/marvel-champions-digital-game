import type { PictureFocus } from "./picture.types.js";

/**
 * A cover picture `object-position`. A plain focal point is a share of the overflow (CSS own `object-position`). A
 * `centered` one puts the middle of the crop on the point and keeps the crop inside the picture (the client cover crop,
 * as a hero `focus.json` means it), which needs the picture natural size: until it has loaded the point is used as a share.
 */
export function objectPositionFor(
  subject: PictureFocus,
  natural: { readonly width: number; readonly height: number } | undefined,
  box: { readonly width: number; readonly height: number },
): string {
  if (!subject.centered || !natural) return `${subject.x * 100}% ${subject.y * 100}%`;
  const scale = Math.max(box.width / natural.width, box.height / natural.height);
  const share = (length: number, extent: number, point: number): number => {
    const crop = Math.min(length, extent / scale);
    const room = length - crop;
    return room <= 0 ? 50 : (Math.max(0, Math.min(room, point * length - crop / 2)) / room) * 100;
  };
  return `${share(natural.width, box.width, subject.x)}% ${share(natural.height, box.height, subject.y)}%`;
}
