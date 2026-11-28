import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { McNowPlayingStyles } from "./mc-now-playing.styles.js";
import type { NowPlayingModel } from "./mc-now-playing.types.js";

/**
 * # Now playing
 * The ink strip at the head of the music player: a note, the status in caution yellow, the song and what plays it.
 * The note dims while nothing plays.
 *
 * @element mc-now-playing
 * @attr idle - Nothing is playing (reflected).
 */
export class McNowPlaying extends LitElement {
  static override styles = [ThemeStyles, McNowPlayingStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    idle: { type: Boolean, reflect: true },
  };

  declare model: NowPlayingModel | null;
  declare idle: boolean;

  constructor() {
    super();
    this.model = null;
    this.idle = true;
  }

  override willUpdate(): void {
    this.idle = this.model?.title == null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<span class="note" aria-hidden="true">♪</span>
      <div class="text">
        <div class="status">${m.status}</div>
        ${m.title === null ? nothing : html`<div class="title">${m.title}</div>`}
        ${m.detail === null ? nothing : html`<div class="detail">${m.detail}</div>`}
      </div>`;
  }
}
