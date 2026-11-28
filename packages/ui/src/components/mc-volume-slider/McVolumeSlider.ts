import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { slide, step } from "../../shared/popup-parts.js";
import { McVolumeSliderStyles } from "./mc-volume-slider.styles.js";

const KNOB = 9;
/** A press that moves this far is a drag (sideways) or the page's scroll (up or down). */
const SLOP = 6;
const KEY = "volume";

interface Press {
  readonly x: number;
  readonly y: number;
  readonly id: number;
  mode: "none" | "drag" | "scroll";
}

/**
 * # Volume slider
 * A − button, a track with a knob, a + button and the percent. A press or drag along the track raises `mc-slide` with
 * the share along it (`commit` on release); − and + raise `mc-step`. Up and down on the track is the page's scroll, so
 * a finger swiping a list past it moves nothing.
 *
 * @element mc-volume-slider
 * @attr value - 0 to 100.
 * @fires mc-slide - `detail.key`, `detail.share` (0 to 1), `detail.commit`.
 * @fires mc-step - `detail.key`, `detail.direction` (-1 or 1).
 */
export class McVolumeSlider extends LitElement {
  static override styles = [ThemeStyles, McVolumeSliderStyles];

  static override properties: PropertyDeclarations = {
    value: { type: Number, reflect: true },
    label: { type: String },
    stepLabels: { attribute: false },
  };

  declare value: number;
  declare label: string;
  declare stepLabels: readonly [string, string];
  #press: Press | null = null;

  constructor() {
    super();
    this.value = 100;
    this.label = "";
    this.stepLabels = ["−", "+"];
  }

  override willUpdate(): void {
    this.style.setProperty("--share", String(Math.min(1, Math.max(0, this.value / 100))));
  }

  /** The slider's own parts by key: `volume:track`, `volume:down`, `volume:up`. */
  elementOf(key: string): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(`[data-key="${key}"]`);
  }

  /** Cancels a press still down (the panel is covered or closing): its later moves and release raise nothing. */
  cancelPress(): void {
    this.#press = null;
  }

  #shareAt(track: HTMLElement, clientX: number): number {
    const box = track.getBoundingClientRect();
    const bar = box.width - KNOB * 2;
    return bar > 0 ? Math.min(1, Math.max(0, (clientX - box.left - KNOB) / bar)) : 0;
  }

  #down = (event: PointerEvent): void => {
    this.#press = { x: event.clientX, y: event.clientY, id: event.pointerId, mode: "none" };
    // Held from the press on, so the release is heard wherever it lands.
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  #move = (event: PointerEvent): void => {
    const press = this.#press;
    if (!press || press.id !== event.pointerId) return;
    // A mouse with no button down is hovering: its press ended unseen.
    if (event.buttons === 0 && event.pointerType !== "touch") {
      this.#press = null;
      return;
    }
    if (press.mode === "none") {
      const dx = Math.abs(event.clientX - press.x);
      const dy = Math.abs(event.clientY - press.y);
      if (dx <= SLOP && dy <= SLOP) return;
      press.mode = dy > dx ? "scroll" : "drag";
    }
    if (press.mode === "drag") {
      slide(this, { key: KEY, share: this.#shareAt(event.currentTarget as HTMLElement, event.clientX), commit: false });
    }
  };

  #up = (event: PointerEvent): void => {
    const press = this.#press;
    this.#press = null;
    if (!press || press.id !== event.pointerId || press.mode === "scroll") return;
    const track = event.currentTarget as HTMLElement;
    if (press.mode === "none") {
      // A tap: press and release both on the track.
      const box = track.getBoundingClientRect();
      const inside =
        event.clientX >= box.left &&
        event.clientX <= box.right &&
        event.clientY >= box.top &&
        event.clientY <= box.bottom;
      if (!inside) return;
    }
    slide(this, { key: KEY, share: this.#shareAt(track, event.clientX), commit: true });
  };

  #cancel = (): void => {
    this.#press = null;
  };

  override render() {
    return html`<mc-button
        data-key="volume:down"
        kind="quiet"
        .label=${this.stepLabels[0]}
        aria-label=${this.stepLabels[0]}
        @mc-press=${() => step(this, { key: KEY, direction: -1 })}
      ></mc-button>
      <div
        class="track"
        data-key="volume:track"
        @pointerdown=${this.#down}
        @pointermove=${this.#move}
        @pointerup=${this.#up}
        @pointercancel=${this.#cancel}
        @lostpointercapture=${this.#cancel}
      >
        <div class="bar"></div>
        <div class="fill"></div>
        <div class="knob"></div>
      </div>
      <mc-button
        data-key="volume:up"
        kind="quiet"
        .label=${this.stepLabels[1]}
        aria-label=${this.stepLabels[1]}
        @mc-press=${() => step(this, { key: KEY, direction: 1 })}
      ></mc-button>
      <span class="label">${this.label}</span>`;
  }
}
