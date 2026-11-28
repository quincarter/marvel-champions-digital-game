
/**
 * The pictures the Briefing page shows, as the `PictureSource`s its elements take: a card scan, a hero or villain face, the box art.
 * Every one goes through the screen leases (`dom/picture-leases.ts`), so a custom pack picture stays held while it is mounted.
 */
import type { PictureFocus, PictureSource } from "@mc/ui";
import { artFor, type ArtSource } from "../../../art/art-source.js";
import { campaignCardsById } from "../../../content/campaign-pool.js";
import { heroPictureOf } from "../../../dom/hero-picture.js";
import type { PictureLeases } from "../../../dom/picture-leases.js";

const FACE: PictureFocus = { x: 0.5, y: 0.15 };

/** The crop of a picture whose focus may be set: faces sit in the upper part. */
export function coverOf(focus: { readonly x?: number; readonly y?: number } | undefined): PictureFocus {
  return focus?.y !== undefined ? { x: focus.x ?? 0.5, y: focus.y, centered: true } : { x: focus?.x ?? 0.5, y: FACE.y };
}

/** A card scan (the front), `missing` in its place while it loads or when there is none. */
export function cardPicture(leases: PictureLeases, cardId: string, missing: string): PictureSource {
  const held = leases.image(artFor(campaignCardsById().get(cardId), { kind: "front" }));
  return { src: held.src, missing, ...(held.retry !== undefined ? { retry: held.retry } : {}) };
}

/** A picture with a source key (a box cover, a villain), cropped toward the face; null when there is none. */
export function sourcePicture(
  leases: PictureLeases,
  source: (ArtSource & { readonly focus?: { readonly x?: number; readonly y?: number } }) | null,
  cover?: PictureFocus,
): PictureSource | null {
  const held = leases.image(source);
  if (held.src === null) return null;
  return {
    src: held.src,
    cover: cover ?? coverOf(source?.focus),
    ...(held.retry !== undefined ? { retry: held.retry } : {}),
  };
}

/** A hero face for the seat header and the speaker, cropped toward the face; null for an identity with none. */
export function heroFace(leases: PictureLeases, identityId: string): PictureSource | null {
  const hero = heroPictureOf(campaignCardsById().get(identityId), leases);
  if (hero.src === null) return null;
  return { src: hero.src, cover: hero.cover, ...(hero.retry !== undefined ? { retry: hero.retry } : {}) };
}
