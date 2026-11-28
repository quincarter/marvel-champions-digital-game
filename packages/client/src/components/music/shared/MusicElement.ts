import { LitElement } from "lit";
import { MUSIC_EVENT, type MusicEventDetail } from "./music-events.types.js";

/**
 * The base of the music player's elements: one way to speak to the scene (`mc-music`, typed). Presses themselves go
 * through `mc-button` / `mc-track-row` (the tap rule, and the focus route's `click()`), which raise their own events;
 * the element that holds them turns those into `mc-music`.
 */
export abstract class MusicElement extends LitElement {
  protected emit(detail: MusicEventDetail): void {
    this.dispatchEvent(new CustomEvent<MusicEventDetail>(MUSIC_EVENT, { detail, bubbles: true, composed: true }));
  }

  protected press(key: string): void {
    this.emit({ type: "press", key });
  }
}
