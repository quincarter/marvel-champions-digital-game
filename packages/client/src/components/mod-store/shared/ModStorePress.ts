import { McPress } from "@mc/ui";
import { MOD_STORE_EVENT, type ModStoreEventDetail } from "./mod-store-events.types.js";

/**
 * The base of the Mod Store's own press controls (a pack tile, a creator row, a card of a pack): a `McPress` whose tap,
 * and the focus route's `click()` and Inspect, raise one typed `mc-mod-store` event instead of `mc-pressed`. A subclass
 * says which one in `pressed()`.
 */
export abstract class ModStorePress extends McPress {
  /** What a tap, or the route's Enter, says; null while the control is inert. */
  protected abstract pressed(): ModStoreEventDetail | null;

  override press(): void {
    if (this.disabled) return;
    const detail = this.pressed();
    if (detail) {
      this.dispatchEvent(
        new CustomEvent<ModStoreEventDetail>(MOD_STORE_EVENT, { detail, bubbles: true, composed: true }),
      );
    }
  }

  /** The route's Inspect does what a tap does where a control has nothing else to offer. */
  override inspect(): void {
    this.press();
  }
}
