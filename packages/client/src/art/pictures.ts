/**
 * Full-bleed pictures from the repo's `art/` folder — title wallpapers,
 * villain artwork, end-of-game scenes — as opposed to card scans
 * (`art-source.ts`). What they share lives here: what a picture is, how one is
 * picked from several, and how one is fitted to a panel.
 *
 * Every folder under `art/` is globbed at build time (`title-art.ts`,
 * `scenario-art.ts`), so adding a file is all it takes to add a picture. Vite
 * emits each as a hashed asset; same origin in dev and in every packaged
 * shell, which WebGL needs to accept it as a texture.
 *
 * `ensurePictureLoaded` below takes a live `Phaser.Scene`, but only as a
 * *type* (`art/card-art.ts`'s own doc comment explains why: the real
 * `phaser` package throws on import outside a browser, so a runtime import
 * here would make this otherwise-pure, otherwise-testable module need a DOM
 * shim for one function).
 */
import type Phaser from "phaser";

/** The formats a picture may be in. Kept in step with the glob patterns, which must be literals. */
export const PICTURE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "avif"] as const;

export interface Picture {
  /** Stable Phaser texture key, derived from the file's path under `art/`. */
  readonly key: string;
  readonly url: string;
}

/**
 * One picture at random — never `avoidKey` (the one shown last time) unless it's the only one.
 * `random` is `Math.random` by default and injectable for tests.
 */
export function pickPicture(
  pool: readonly Picture[],
  avoidKey: string | null = null,
  random: () => number = Math.random,
): Picture | null {
  if (pool.length === 0) return null;
  const candidates = pool.length > 1 ? pool.filter((art) => art.key !== avoidKey) : pool;
  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return candidates[index] ?? null;
}

/**
 * Ensures `picture` is loaded into `scene`'s texture manager, kicking off the load (once) if it isn't yet.
 * Returns its texture key when it's ready to draw, else `null` — the same "draw the frame now, redraw when the
 * scan arrives" contract `art/card-art.ts`'s `CardArt.request` uses, generalized to a full-bleed picture rather
 * than a card scan (which has its own cache keyed by card, not by this module's one-off pictures). Factored out
 * of `scenes/game-over.ts`'s own `#drawOutcomeArt`, which every later caller (the pack-shelf roster, W2b) would
 * otherwise have had to reinvent field for field.
 *
 * `onReady` fires once, the first time this exact picture finishes loading, if `scene` is still active then — a
 * caller redraws from it.
 *
 * **One load per texture manager, not per scene, and not through a scene's loader.** Textures live on the game, so
 * two scenes asking for the same picture at once (Title and the guide chooser share a wallpaper; a Board overlay and
 * its parent share a cover) must not both load it: the second logs "Texture key already in use" and, in the e2e
 * suite, fails the run. A scene's own loader is the wrong tool: when the scene shuts down mid-load the loader is reset,
 * but its in-flight file still completes and adds the texture, so a scene that then asked again (a restart, the next
 * screen) added it a second time. So the picture is fetched with a plain `Image` that outlives every scene, the
 * request stays registered until that image settles, and the texture is added once, guarded by `exists`. Waiters
 * (every scene that asked meanwhile) get their own `onReady` if still active; a file that fails to load is forgotten,
 * so a later request tries again.
 */
interface Waiter {
  readonly scene: Phaser.Scene;
  readonly onReady: () => void;
}
const inFlight = new WeakMap<Phaser.Textures.TextureManager, Map<string, Waiter[]>>();

export function ensurePictureLoaded(scene: Phaser.Scene, picture: Picture, onReady: () => void): string | null {
  const textures = scene.textures;
  if (textures.exists(picture.key)) return picture.key;
  let loads = inFlight.get(textures);
  if (!loads) {
    loads = new Map();
    inFlight.set(textures, loads);
  }
  const waiting = loads.get(picture.key);
  if (waiting) {
    waiting.push({ scene, onReady });
    return null;
  }
  const waiters: Waiter[] = [{ scene, onReady }];
  loads.set(picture.key, waiters);
  const image = new Image();
  const settle = (ok: boolean): void => {
    loads.delete(picture.key);
    if (!ok) return;
    if (!textures.exists(picture.key)) textures.addImage(picture.key, image);
    for (const waiter of waiters) if (waiter.scene.sys.isActive()) waiter.onReady();
  };
  image.onload = () => settle(true);
  image.onerror = () => settle(false);
  image.src = picture.url;
  return null;
}

/**
 * Where a picture of `image` (natural size) goes to cover `panel` edge to edge, cropping whichever
 * dimension overflows: the scale to draw it at, and the crop rectangle in the picture's own pixels.
 */
export function coverFit(
  image: { readonly width: number; readonly height: number },
  panel: { readonly width: number; readonly height: number },
): {
  readonly scale: number;
  readonly cropX: number;
  readonly cropY: number;
  readonly cropWidth: number;
  readonly cropHeight: number;
} {
  const scale = Math.max(panel.width / image.width, panel.height / image.height);
  const cropWidth = Math.min(image.width, panel.width / scale);
  const cropHeight = Math.min(image.height, panel.height / scale);
  return { scale, cropX: (image.width - cropWidth) / 2, cropY: (image.height - cropHeight) / 2, cropWidth, cropHeight };
}

/** The scale that fits all of `image` inside `panel`, letterboxing whichever dimension falls short (never cropping). */
export function containScale(
  image: { readonly width: number; readonly height: number },
  panel: { readonly width: number; readonly height: number },
): number {
  if (image.width <= 0 || image.height <= 0) return 1;
  return Math.min(panel.width / image.width, panel.height / image.height);
}
