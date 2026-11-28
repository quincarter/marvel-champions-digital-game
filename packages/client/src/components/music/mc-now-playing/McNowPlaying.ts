import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { McNowPlayingStyles } from "./mc-now-playing.styles.js";
import type { McNowPlayingProps } from "./mc-now-playing.types.js";

/**
 * # Now playing
 * The ink strip at the head of the music player: a note, the status in caution yellow, the song and what plays it.
 * The note dims while nothing plays.
 *
 * @element mc-now-playing
 * @attr status - "NOW PLAYING", "PAUSED" or "NOTHING PLAYING", already translated.
 * @attr idle - Nothing is playing (reflected from `song`).
 */
export class McNowPlaying extends LitElement implements McNowPlayingProps {
  static override styles = [ThemeStyles, McNowPlayingStyles];

  static override properties: PropertyDeclarations = {
    status: { type: String },
    song: { attribute: false },
    detail: { attribute: false },
    idle: { type: Boolean, reflect: true },
  };

  declare status: string;
  declare song: string | null;
  declare detail: string | null;
  declare idle: boolean;

  constructor() {
    super();
    this.status = "";
    this.song = null;
    this.detail = null;
    this.idle = true;
  }

  override willUpdate(): void {
    this.idle = this.song === null;
  }

  override render() {
    return html`<span class="note" aria-hidden="true">♪</span>
      <div class="text">
        <div class="status">${this.status}</div>
        ${this.song === null ? nothing : html`<div class="title">${this.song}</div>`}
        ${this.detail === null ? nothing : html`<div class="detail">${this.detail}</div>`}
      </div>`;
  }
}
