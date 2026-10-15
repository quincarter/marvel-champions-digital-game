/**
 * A seat's hero, as a face rather than a name: the villain phase's encounter-card tiles and the recap's dealt cards
 * named each seat ("CAPTAIN MARVEL") in a space too narrow for it, and the owner found the names cut off on a phone
 * (2026-10-14). The hero's own picture (`art/heroes/`, `HERO_ART`), cover-cropped toward the face; the identity card's
 * hero scan when there is no picture; a plain ink square while either loads.
 */
import type Phaser from "phaser";
import type { GameState, PlayerId } from "@mc/engine";
import { cardOf } from "@mc/engine";
import { artFor } from "../art/art-source.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { HERO_ART, heroArtForIdentity } from "../art/hero-art.js";
import { coverFit, ensurePictureLoaded } from "../art/pictures.js";
import { POOL_CARDS } from "../content/pool.js";
import { border, signal, surface } from "../tokens.js";
import type { Rect } from "../view/layout.js";

/** Emitted on the scene when a hero picture it asked for has loaded, so the scene can redraw. */
export const SEAT_AVATAR_READY = "mc-seat-avatar-ready";

/** Where the face usually is in a hero picture: the upper third. */
const FACE_FOCUS_Y = 0.22;

/** Draws `playerId`'s hero into `rect` (square or not), framed in `frameColor`. */
export function drawSeatAvatar(
  scene: Phaser.Scene,
  rect: Rect,
  game: GameState,
  playerId: PlayerId,
  frameColor: number = surface.paper.hex,
  alpha = 1,
): void {
  const g = scene.add.graphics();
  g.fillStyle(signal.spent.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  const player = game.players.find((candidate) => candidate.playerId === playerId);
  const identity = player ? cardOf(game, player.identity.instanceId) : undefined;
  const picture = identity ? heroArtForIdentity(HERO_ART, identity.id, POOL_CARDS, () => 0) : null;
  let drawn = false;
  if (picture) {
    const key = ensurePictureLoaded(scene, picture, () => scene.events.emit(SEAT_AVATAR_READY));
    const source = key && scene.textures.exists(key) ? scene.textures.get(key).getSourceImage() : null;
    if (key && source && source.width > 0 && source.height > 0) {
      const { scale, cropX, cropWidth, cropHeight } = coverFit(source, rect);
      const cropY = (source.height - cropHeight) * FACE_FOCUS_Y;
      // Phaser keeps a cropped image's frame layout, so it is shifted back by the crop offset (as `drawArt` does).
      scene.add
        .image(rect.x - cropX * scale, rect.y - cropY * scale, key)
        .setOrigin(0, 0)
        .setScale(scale)
        .setCrop(cropX, cropY, cropWidth, cropHeight)
        .setAlpha(alpha);
      drawn = true;
    }
  }
  if (!drawn && identity) {
    const key = cardArt(scene).request(scene, artFor(identity, { kind: "hero" }));
    drawArt(scene, key, rect, { fit: "cover", focusY: 0.3, alpha });
  }
  const frame = scene.add.graphics();
  frame.lineStyle(border.detail, frameColor, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
}
