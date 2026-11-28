/**
 * The heads-up's two speakers' pictures (`art/heroes/<id>-<name>/`, or a custom hero's identity card): the address of each
 * and where the face sits, for the round crop the notice draws, and a preload so the notice opens with the faces in rather
 * than with letters that turn into faces a moment later (issue #716).
 */
import type { PictureFocus } from "@mc/ui";
import { heroPicture } from "../../ui/campaign-chrome.js";

/** A face is near the top of a hero picture; the crop is centered on it and kept inside the picture. */
const FACE_HIGH = 0.15;

export function noticePortraitsOf(identityId: string): { readonly src: string; readonly focus: PictureFocus } | null {
  const picture = heroPicture(identityId);
  if (!picture) return null;
  return {
    src: picture.tileUrl ?? picture.url,
    focus: { x: picture.focus?.x ?? 0.5, y: picture.focus?.y ?? FACE_HIGH, centered: true },
  };
}

/** Loads and decodes each speaker's picture, so the browser has it by the time the notice draws it. Never rejects. */
export function preloadPortraits(identityIds: readonly string[]): Promise<void> {
  return Promise.all(
    identityIds.map(async (id) => {
      const portrait = noticePortraitsOf(id);
      if (!portrait) return;
      const image = new Image();
      image.src = portrait.src;
      await image.decode().catch(() => undefined);
    }),
  ).then(() => undefined);
}
