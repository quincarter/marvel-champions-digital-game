/**
 * Persistent scroll position for a pack-shelf roster (`ui/shelf-roster.ts`,
 * W2b) across a scene being stopped and started again — "Deck check ▸"
 * (`scenes/deck-check.ts`) opens over `SCENES.seats`/`SCENES.scenarioSelect`
 * by *stopping* that scene and starting Deck check, per this app's own
 * `scene.start` convention (`scenes/seats.ts`'s `goToDeckCheckOrTableSetup`),
 * so a scene field would lose the player's scroll position on the way back
 * even though the brief asks for it to survive.
 *
 * Kept as a module-level singleton per screen (like `art/card-art.ts`'s
 * per-`Phaser.Game` cache, simplified to one screen = one app since there is
 * exactly one of each of these screens live at a time) rather than on
 * `SetupDraft`: scroll position is view state, not a setup *choice* — nothing
 * about which scenario/deck ends up seated depends on it, and it would be an
 * odd thing to serialize into a save.
 */
import { ListScroll } from "./list-scroll.js";

export type ShelfScreen = "scenario-select" | "seats";

class ShelfScrollCache {
  readonly vertical = new ListScroll();
  readonly #horizontal = new Map<string, ListScroll>();

  horizontalFor(shelfId: string): ListScroll {
    let scroll = this.#horizontal.get(shelfId);
    if (!scroll) {
      scroll = new ListScroll();
      this.#horizontal.set(shelfId, scroll);
    }
    return scroll;
  }

  reset(): void {
    this.vertical.reset();
    this.#horizontal.clear();
  }
}

const caches = new Map<ShelfScreen, ShelfScrollCache>();

export function shelfScrollCacheFor(screen: ShelfScreen): ShelfScrollCache {
  let cache = caches.get(screen);
  if (!cache) {
    cache = new ShelfScrollCache();
    caches.set(screen, cache);
  }
  return cache;
}
