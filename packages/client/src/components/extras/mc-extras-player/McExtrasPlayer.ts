import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type PlayerControlsModel } from "@mc/ui";
import { clockOf } from "../../../view/music-player.js";
import { ExtrasElement } from "../shared/ExtrasElement.js";
import type { ExtrasPlayerAction } from "../shared/extras-events.types.js";
import { McExtrasPlayerStyles } from "./mc-extras-player.styles.js";
import type { ExtrasPlayerModel, McExtrasPlayerProps, PlayerProgress } from "./mc-extras-player.types.js";

/** How often the progress bar looks at the song, in ms. */
const TICK_MS = 250;

/**
 * # Extras player
 * The Music tab's player: an ink block (the note, the status in caution yellow, the song in Bangers, what is playing it
 * and a progress bar with its clock) over Shuffle, Next, Pause and, on a desktop form factor, the volume slider. The
 * buttons and slider are the generic `mc-player-controls` and `mc-volume-slider` the music popover uses. The bar follows
 * the song on a timer of its own (`progress` is read every quarter second), so the page is not redrawn for it.
 *
 * @element mc-extras-player
 * @fires mc-extras - `player` (Shuffle, Next, Pause), `volume` and `volume-step`.
 */
export class McExtrasPlayer extends ExtrasElement implements McExtrasPlayerProps {
  static override styles = [ThemeStyles, McExtrasPlayerStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    progress: { attribute: false },
    share: { state: true },
    clock: { state: true },
  };

  declare model: ExtrasPlayerModel | null;
  declare progress: (() => PlayerProgress | null) | null;
  declare share: number;
  declare clock: string;
  #timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
    this.model = null;
    this.progress = null;
    this.share = 0;
    this.clock = "";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#tick();
    this.#timer = setInterval(() => this.#tick(), TICK_MS);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
  }

  #tick(): void {
    const now = this.progress?.() ?? null;
    const share = now && now.duration > 0 ? Math.min(1, now.seek / now.duration) : 0;
    const clock = now ? `${clockOf(now.seek)} / ${clockOf(now.duration)}` : "";
    if (share !== this.share) this.share = share;
    if (clock !== this.clock) this.clock = clock;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const controls: PlayerControlsModel = {
      shuffle: m.shuffle,
      next: m.next,
      pause: m.pause,
      withSlider: m.volume !== null,
    };
    return html`<div class="block" ?data-idle=${m.title === null}>
        <span class="note" aria-hidden="true">♪</span>
        <div class="words">
          <div class="status">${m.status}</div>
          ${m.title === null ? nothing : html`<div class="title">${m.title}</div>`}
          ${m.detail === null ? nothing : html`<div class="detail">${m.detail}</div>`}
          ${
            m.title === null
              ? nothing
              : html`<div class="progress">
                  <div class="bar"><div class="fill" style=${`width:${Math.round(this.share * 1000) / 10}%`}></div></div>
                  <span class="clock">${this.clock}</span>
                </div>`
          }
        </div>
      </div>
      <mc-player-controls
        .model=${controls}
        @mc-activate=${(event: CustomEvent<{ key: ExtrasPlayerAction }>) => {
          event.stopPropagation();
          this.emit({ type: "player", action: event.detail.key.slice("player:".length) as ExtrasPlayerAction });
        }}
      >
        ${
          m.volume
            ? html`<mc-volume-slider
                slot="volume"
                .value=${m.volume.value}
                .label=${m.volume.label}
                .stepLabels=${m.volume.stepLabels}
                @mc-slide=${(event: CustomEvent<{ share: number; commit: boolean }>) => {
                  event.stopPropagation();
                  this.emit({ type: "volume", share: event.detail.share, commit: event.detail.commit });
                }}
                @mc-step=${(event: CustomEvent<{ direction: -1 | 1 }>) => {
                  event.stopPropagation();
                  this.emit({ type: "volume-step", direction: event.detail.direction });
                }}
              ></mc-volume-slider>`
            : nothing
        }
      </mc-player-controls>`;
  }
}
