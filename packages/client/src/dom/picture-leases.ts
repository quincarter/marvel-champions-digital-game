/**
 * The one path a DOM screen takes for the pictures it mounts (`<img>`s in `mc-sheet` parts and components).
 *
 * A card picture of an installed custom pack is a `blob:` URL the pack art cache may revoke when it evicts a texture
 * (`art/pack-art.ts`), and a lazy `<img>` may not have loaded it yet. So a screen that draws such a picture
 *
 * 1. keeps the picture's **source** (`ArtSource`: its key and URL), never just the URL, and asks `image(source)` for what
 *    to hand the `<img>`: the URL (held, so the cache does not revoke it while it is mounted) and the **retry** key to
 *    re-resolve it by;
 * 2. brackets each redraw with `begin()` and `end()` (the old pass's holds are given back only once the new parts are
 *    mounted, so a picture never has a moment with no hold; a windowed list simply stops asking for the rows it no longer
 *    draws), and calls `dispose()` when the screen goes;
 * 3. `watch(element)`s its sheet, so a picture that fails to load (`mc-image-error`, raised for a part with a retry key)
 *    reads its file again (`refreshPackArt`), which announces an art change; the screen redraws on that.
 *
 * Pictures that are not pack art (a bundled scan, a hero's artwork) pass through untouched, with no retry key.
 */
import { PackLeases, refreshPackArt } from "../art/pack-art.js";

/** What a part needs for a leased picture: its URL, and the key to re-resolve it by (absent for a bundled picture). */
export interface LeasedPicture {
  readonly src: string | null;
  readonly retry?: string;
}

export class PictureLeases extends PackLeases {
  #unwatch: (() => void)[] = [];

  /** Hands `element`'s `mc-image-error` events (a picture with a retry key failed to load) to `refreshPackArt`. */
  watch(element: HTMLElement): void {
    const onError = (event: Event): void => {
      const { key, src } = (event as CustomEvent<{ key?: string; src?: string | null }>).detail ?? {};
      if (key) refreshPackArt(key, src ?? undefined);
    };
    element.addEventListener("mc-image-error", onError);
    this.#unwatch.push(() => element.removeEventListener("mc-image-error", onError));
  }

  /** Starts a redraw pass; one that never reached `end()` (a redraw cut short) is finished first, never leaked. */
  override begin(): void {
    this.end();
    super.begin();
  }

  /** Gives back every hold and stops listening (the screen is going). */
  override dispose(): void {
    super.dispose();
    for (const stop of this.#unwatch) stop();
    this.#unwatch = [];
  }
}
