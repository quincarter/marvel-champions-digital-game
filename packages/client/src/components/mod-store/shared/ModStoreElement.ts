import { LitElement } from "lit";
import { MOD_STORE_EVENT, MOD_STORE_RENDERED, type ModStoreEventDetail } from "./mod-store-events.types.js";

/**
 * The base of the Mod Store's elements: one way to speak to the scene (`mc-mod-store`, typed). Presses themselves go
 * through `mc-button` / `McPress` (`ModStorePress`), which already answer the focus route's `click()` and ignore the lift
 * that ends a swipe.
 */
export abstract class ModStoreElement extends LitElement {
  /** Tells the scene the stops may have changed (it reads them again a frame later). */
  protected emitRendered(): void {
    this.dispatchEvent(new CustomEvent(MOD_STORE_RENDERED, { bubbles: true, composed: true }));
  }

  protected emit(detail: ModStoreEventDetail): void {
    this.dispatchEvent(
      new CustomEvent<ModStoreEventDetail>(MOD_STORE_EVENT, { detail, bubbles: true, composed: true }),
    );
  }
}
