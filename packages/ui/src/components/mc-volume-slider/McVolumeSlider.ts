import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { SlideDetail, StepDetail } from "../../shared/popup.types.js";
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
 * With a `heading` it is a settings row: the title over a line of `detail`, then a line holding the `preview` slot (a
 * live sample at the chosen size) beside the slider. Without one it is the bare slider.
 *
 * @attr heading - The row's title; none: the bare slider.
 * @attr detail - The line under the title.
 * @attr dimmed - Faded but still adjustable.
 * @slot preview - A live sample shown before the slider on a row with a heading.
 * @attr down-stop - The `data-stop` key of the - button ("volume-down").
 * @attr up-stop - The `data-stop` key of the + button ("volume-up").
 * @fires mc-slide - `detail.key`, `detail.share` (0 to 1), `detail.commit`.
 * @fires mc-step - `detail.key`, `detail.direction` (-1 or 1).
 */
export class McVolumeSlider extends LitElement {
  static override styles = [ThemeStyles, McVolumeSliderStyles];

  static override properties: PropertyDeclarations = {
    value: { type: Number, reflect: true },
    label: { type: String },
    stepLabels: { attribute: false },
    heading: { type: String, reflect: true },
    detail: { type: String },
    dimmed: { type: Boolean, reflect: true },
    downStop: { type: String, attribute: "down-stop" },
    upStop: { type: String, attribute: "up-stop" },
  };

  declare value: number;
  declare label: string;
  declare stepLabels: readonly [string, string];
  declare heading: string;
  declare detail: string;
  declare dimmed: boolean;
  declare downStop: string;
  declare upStop: string;
  #press: Press | null = null;

  constructor() {
    super();
    this.value = 100;
    this.label = "";
    this.stepLabels = ["−", "+"];
    this.heading = "";
    this.detail = "";
    this.dimmed = false;
    this.downStop = "volume-down";
    this.upStop = "volume-up";
  }

  override willUpdate(): void {
    this.style.setProperty("--share", String(Math.min(1, Math.max(0, this.value / 100))));
  }

  /** The track a press or drag lands on. */
  get track(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".track");
  }

  /** Cancels a press still down (the panel is covered or closing): its later moves and release raise nothing. */
  cancelPress(): void {
    this.#press = null;
  }

  #slide(detail: SlideDetail): void {
    this.dispatchEvent(new CustomEvent<SlideDetail>("mc-slide", { detail, bubbles: true, composed: true }));
  }

  #step(detail: StepDetail): void {
    this.dispatchEvent(new CustomEvent<StepDetail>("mc-step", { detail, bubbles: true, composed: true }));
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
      this.#slide({ key: KEY, share: this.#shareAt(event.currentTarget as HTMLElement, event.clientX), commit: false });
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
    this.#slide({ key: KEY, share: this.#shareAt(track, event.clientX), commit: true });
  };

  #cancel = (): void => {
    this.#press = null;
  };

  override render() {
    const slider = html`<mc-button
        data-stop=${this.downStop}
        kind="quiet"
        .label=${this.stepLabels[0]}
        aria-label=${this.stepLabels[0]}
        @mc-press=${() => this.#step({ key: KEY, direction: -1 })}
      ></mc-button>
      <div
        class="track"
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
        data-stop=${this.upStop}
        kind="quiet"
        .label=${this.stepLabels[1]}
        aria-label=${this.stepLabels[1]}
        @mc-press=${() => this.#step({ key: KEY, direction: 1 })}
      ></mc-button>
      <span class="label">${this.label}</span>`;
    if (!this.heading) return slider;
    return html`<div class="words">
        <span class="heading">${this.heading}</span>
        ${this.detail ? html`<span class="detail">${this.detail}</span>` : nothing}
      </div>
      <div class="line">
        <slot name="preview"></slot>
        <div class="control">${slider}</div>
      </div>`;
  }
}
