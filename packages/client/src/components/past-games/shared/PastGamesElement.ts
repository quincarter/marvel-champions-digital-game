import { LitElement } from "lit";
import { pastGamesEvent, type PastGamesEventDetail } from "./past-games-events.types.js";

/**
 * The base of Past games' elements: one way to speak to the scene (`mc-past-games`, typed). Presses themselves go
 * through `mc-button`, `McPress` and `onTap`, which already answer the focus route's `click()` and ignore the lift that
 * ends a swipe.
 */
export abstract class PastGamesElement extends LitElement {
  protected emit(detail: PastGamesEventDetail): void {
    this.dispatchEvent(pastGamesEvent(detail));
  }
}
