import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { activate } from "../../shared/popup-parts.js";
import { onTap } from "../../shared/tap.js";
import { McTrackRowStyles } from "./mc-track-row.styles.js";
import type { TrackRowModel } from "./mc-track-row.types.js";

/**
 * # Track row
 * One song in the music player's list: a red disc (a play triangle, or a note while it plays), the title and where it
 * plays. A tap on it, by the tap rule, raises `mc-activate`; a finger lifting at the end of a swipe presses nothing.
 *
 * @element mc-track-row
 * @attr playing - This is the song that is playing (reflected).
 * @fires mc-activate - `detail.key`: the row was tapped.
 */
export class McTrackRow extends LitElement {
  static override styles = [ThemeStyles, McTrackRowStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    playing: { type: Boolean, reflect: true },
  };

  declare model: TrackRowModel | null;
  declare playing: boolean;
  #stopTap: (() => void) | null = null;

  constructor() {
    super();
    this.model = null;
    this.playing = false;
  }

  #press(): void {
    if (this.model) activate(this, this.model.key);
  }

  #onClick = (event: MouseEvent): void => {
    if (event.detail === 0) this.#press();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.#stopTap = onTap(this, () => this.#press());
    // `click()` from the focus route (Enter on a `data-stop`) has no pointer press behind it (`detail` 0).
    this.addEventListener("click", this.#onClick);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stopTap?.();
    this.#stopTap = null;
    this.removeEventListener("click", this.#onClick);
  }

  override willUpdate(): void {
    this.playing = this.model?.playing ?? false;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<span class="disc" aria-hidden="true">${m.playing ? "♪" : "▶"}</span>
      <div class="text">
        <div class="title">${m.title}</div>
        <div class="where">${m.where}</div>
      </div>`;
  }
}
