import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { activate, popupButton, tapOn } from "../../shared/popup-parts.js";
import "../mc-now-playing/mc-now-playing.js";
import "../mc-player-controls/mc-player-controls.js";
import "../mc-track-list/mc-track-list.js";
import "../mc-volume-slider/mc-volume-slider.js";
import { McMusicPlayerStyles } from "./mc-music-player.styles.js";
import type { MusicPlayerModel } from "./mc-music-player.types.js";
import type { McTrackList } from "../mc-track-list/McTrackList.js";
import type { McVolumeSlider } from "../mc-volume-slider/McVolumeSlider.js";

/**
 * # Music player
 * The player behind the music button: `mc-now-playing`, `mc-player-controls` (with an `mc-volume-slider` on a
 * desktop form factor) and an `mc-track-list` of the earned songs, in a popover hanging from the button or, on a phone,
 * a panel filling the screen under the top bar. A tap outside the panel is the way out.
 *
 * @element mc-music-player
 * @attr phone - The phone layout (reflected from the model).
 * @fires mc-activate - `detail.key`: `close`, `shuffle`, `next`, `pause`, `song:<id>` or `outside`.
 * @fires mc-slide - `detail.key`, `detail.share`, `detail.commit`: the volume slider's track was pressed or dragged.
 * @fires mc-step - `detail.key`, `detail.direction`: the volume slider's − or +.
 */
export class McMusicPlayer extends LitElement {
  static override styles = [ThemeStyles, McMusicPlayerStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    phone: { type: Boolean, reflect: true },
  };

  declare model: MusicPlayerModel | null;
  declare phone: boolean;
  #stopOutside: (() => void) | null = null;

  constructor() {
    super();
    this.model = null;
    this.phone = false;
  }

  override willUpdate(): void {
    const m = this.model;
    this.phone = m?.phone ?? false;
    if (!m) return;
    // The model's geometry reaches the stylesheet as custom properties, so the CSS owns every rule.
    const set = (name: string, px: number): void => this.style.setProperty(name, `${px}px`);
    set("--panel-x", m.panel.x);
    set("--panel-y", m.panel.y);
    set("--panel-w", m.panel.width);
    set("--panel-h", m.panel.height);
    set("--caret-x", m.icon.x + m.icon.width / 2);
  }

  override updated(): void {
    if (this.#stopOutside) return;
    this.#stopOutside = tapOn(this.renderRoot.querySelector(".outside"), () => activate(this, "outside"));
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stopOutside?.();
    this.#stopOutside = null;
  }

  /** The song list's scrolling element (the stick scrolls it). */
  get scroller(): HTMLElement | null {
    return this.#list?.scroller ?? null;
  }

  /** The slider's track, for a press at a share along it. */
  get volumeTrack(): HTMLElement | null {
    return this.#slider?.track ?? null;
  }

  get #list(): McTrackList | null {
    return this.renderRoot.querySelector("mc-track-list");
  }

  get #slider(): McVolumeSlider | null {
    return this.renderRoot.querySelector("mc-volume-slider");
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<div class="outside"></div>
      ${
        m.phone
          ? nothing
          : html`<svg class="caret" viewBox="0 0 20 11" aria-hidden="true">
              <polygon points="0,11 20,11 10,0"></polygon>
              <polyline points="0,9.5 10,0 20,9.5"></polyline>
            </svg>`
      }
      <div class="panel">
        <div class="head">
          <div class="close">${popupButton(this, m.close, m.glyphs?.[m.close.key])}</div>
          <span class="title">${m.title}</span>
          <span class="earned">${m.earned}</span>
        </div>
        <mc-now-playing .model=${m.nowPlaying}></mc-now-playing>
        <mc-player-controls .model=${m.controls}>
          ${
            m.volume
              ? html`<mc-volume-slider
                  slot="volume"
                  .value=${m.volume.value}
                  .label=${m.volume.label}
                  .stepLabels=${m.volume.stepLabels}
                ></mc-volume-slider>`
              : nothing
          }
        </mc-player-controls>
        <mc-track-list .model=${m.list}></mc-track-list>
        <div class="foot">${m.foot}</div>
      </div>`;
  }
}
