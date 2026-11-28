import { html, nothing, type PropertyDeclarations } from "lit";
import { onTap, ThemeStyles } from "@mc/ui";
import { MusicElement } from "../../../components/music/shared/MusicElement.js";
import type { McTrackList } from "../../../components/music/mc-track-list/McTrackList.js";
import type { McVolumeSlider, SlideDetail, StepDetail } from "@mc/ui";
import "../../../components/music/mc-now-playing/mc-now-playing.js";
import "../../../components/music/mc-player-controls/mc-player-controls.js";
import "../../../components/music/mc-track-list/mc-track-list.js";
import { McMusicPlayerStyles } from "./mc-music-player.styles.js";
import type { MusicPlayerModel } from "./mc-music-player.types.js";

/**
 * # Music player
 * The player behind the music button: `mc-now-playing`, `mc-player-controls` (with an `mc-volume-slider` on a desktop
 * form factor) and an `mc-track-list` of the earned songs, in a popover hanging from the button or, on a phone, a panel
 * filling the screen under the top bar. A tap outside the panel is the way out. It composes and holds no state: the
 * scene sets `model` and hears `mc-music`.
 *
 * @element mc-music-player
 * @attr phone - The phone layout (reflected from the model).
 * @fires mc-music - `MusicEventDetail`: a press by key (`close`, `shuffle`, `next`, `pause`, `song:<id>`, or `outside`
 *   for a tap beside the panel), the volume slider's `slide` and its `step`.
 */
export class McMusicPlayer extends MusicElement {
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
    // Where the button is reaches the stylesheet as custom properties: the popover hangs from it, and every size and
    // clamp is the CSS's.
    const set = (name: string, px: number): void => this.style.setProperty(name, `${px}px`);
    set("--anchor-bottom", m.anchor.y + m.anchor.height);
    set("--anchor-right", m.anchor.x + m.anchor.width);
    set("--anchor-center", m.anchor.x + m.anchor.width / 2);
  }

  override updated(): void {
    if (this.#stopOutside) return;
    const outside = this.renderRoot.querySelector<HTMLElement>(".outside");
    this.#stopOutside = outside ? onTap(outside, () => this.press("outside")) : null;
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

  /** The slider is generic: its `mc-slide` and `mc-step` become the player's `mc-music`, and go no further. */
  #onSlide = (event: CustomEvent<SlideDetail>): void => {
    event.stopPropagation();
    this.emit({ type: "slide", share: event.detail.share, commit: event.detail.commit });
  };

  #onStep = (event: CustomEvent<StepDetail>): void => {
    event.stopPropagation();
    this.emit({ type: "step", direction: event.detail.direction });
  };

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const glyph = m.glyphs.close;
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
          <mc-popup-button
            class="close"
            .button=${{ key: "close", kind: "quiet", label: m.closeLabel }}
            .glyph=${glyph ?? null}
            @mc-activate=${(event: Event) => {
              event.stopPropagation();
              this.press("close");
            }}
          ></mc-popup-button>
          <span class="title">${m.title}</span>
          <span class="earned">${m.earned}</span>
        </div>
        <mc-now-playing
          .status=${m.nowPlaying.status}
          .song=${m.nowPlaying.song}
          .detail=${m.nowPlaying.detail}
        ></mc-now-playing>
        <mc-player-controls
          .shuffleLabel=${m.controls.shuffleLabel}
          .nextLabel=${m.controls.nextLabel}
          .pauseLabel=${m.controls.pauseLabel}
          .shuffleOn=${m.controls.shuffleOn}
          .paused=${m.controls.paused}
          .reason=${m.controls.reason}
          .withSlider=${m.volume !== null}
          .glyphs=${m.glyphs}
        >
          ${
            m.volume
              ? html`<mc-volume-slider
                  slot="volume"
                  .value=${m.volume.value}
                  .label=${m.volume.label}
                  .stepLabels=${m.volume.stepLabels}
                  @mc-slide=${this.#onSlide}
                  @mc-step=${this.#onStep}
                ></mc-volume-slider>`
              : nothing
          }
        </mc-player-controls>
        <mc-track-list .tracks=${m.list.tracks} .empty=${m.list.empty}></mc-track-list>
        <div class="foot">${m.foot}</div>
      </div>`;
  }
}
