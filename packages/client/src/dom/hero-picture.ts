/**
 * A hero's face for a DOM `<img>`: the picture the Phaser `drawHeroAvatar` (`ui/seat-avatar.ts`) draws, as the URL and
 * cover crop a sheet's `image` node takes. The hero's own picture (`art/heroes/`) cropped toward the face (the upper
 * third unless the folder's `focus.json` says where it is); the identity card's hero scan when there is no picture; no
 * source at all for an unknown identity, which the box shows as its plain ground.
 */
import type { AnyCard } from "@mc/content";
import { artFor } from "../art/art-source.js";
import { HERO_ART, heroArtForIdentity } from "../art/hero-art.js";
import type { PackLeases } from "../art/pack-art.js";
import { POOL_CARDS } from "../content/pool.js";

/** Where the face usually is in a hero picture: the upper third. */
const FACE_FOCUS_Y = 0.22;
/** Where it usually is on the identity's card scan. */
const SCAN_FOCUS_Y = 0.3;

export interface HeroPicture {
  readonly src: string | null;
  /** The cover crop (`SheetImage.cover`). */
  readonly cover: { readonly x: number; readonly y: number; readonly centered?: boolean };
  /** The pack picture's key, for a URL that went stale under a lazy image (`mc-image-error`). */
  readonly retry?: string;
}

/** `identity`'s picture. A hero printed more than once shares the picture filed under any of its identity cards. */
export function heroPictureOf(identity: AnyCard | undefined, leases: PackLeases): HeroPicture {
  const picture = identity ? heroArtForIdentity(HERO_ART, identity.id, POOL_CARDS, () => 0) : null;
  if (picture) {
    const focus = picture.focus;
    return {
      src: picture.url,
      // A focus centers the crop on the point (as `coverFit` does); with none, the crop starts a fifth of the way down.
      cover:
        focus?.y !== undefined
          ? { x: focus.x ?? 0.5, y: focus.y, centered: true }
          : { x: focus?.x ?? 0.5, y: FACE_FOCUS_Y, centered: false },
    };
  }
  if (!identity) return { src: null, cover: { x: 0.5, y: SCAN_FOCUS_Y } };
  const held = leases.image(artFor(identity, { kind: "hero" }));
  return {
    src: held.src,
    cover: { x: 0.5, y: SCAN_FOCUS_Y },
    ...(held.retry !== undefined ? { retry: held.retry } : {}),
  };
}
