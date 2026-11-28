import { LitElement } from "lit";
import { StatsRelay } from "./stats-relay.js";
import { STATS_RENDERED, statsEvent, type StatsEventDetail } from "./stats-events.types.js";

/**
 * The base of Your stats' container elements: one way to speak to the scene (`mc-player-stats`, typed). Presses
 * themselves go through `mc-chip` / `mc-button` / `onTap`, which already answer the focus route's `click()` and ignore
 * the lift that ends a swipe; the relay turns a control's `mc-pressed` into the screen's own event.
 */
export abstract class StatsElement extends LitElement {
  constructor() {
    super();
    new StatsRelay(this);
  }

  protected emit(detail: StatsEventDetail): void {
    this.dispatchEvent(statsEvent(detail));
  }

  /** Tells the scene the focus stops may have changed (it reads them again a frame later). */
  protected emitRendered(): void {
    this.dispatchEvent(new CustomEvent(STATS_RENDERED, { bubbles: true, composed: true }));
  }
}
