/**
 * `McStepSlider`: the music player's slider (`ui/now-playing-panel.ts`: a "−" button, a track with a Hero Red fill and a
 * round knob, a "+" button, the percent at the right) as a widget of its own, for a setting with a range and a step
 * that is not the music volume (Controls' hint size). The look and the track math are the panel's; what differs is the
 * ground (drawn on ink or paper) and the gesture rules a scrolling list needs.
 *
 * Gestures (`docs/controller-support.md`, and the no-tap-on-finger-lift rule): a press that goes down and comes up on the
 * track, within the tap slop, sets the value there; a drag that goes sideways past the slop follows the finger and ends
 * on release; a drag that goes up or down past the slop is the list's scroll and changes nothing. The "−" and "+" are
 * `McButton`s. The widget never redraws its scene: it repaints its own graphics, so a drag survives it.
 */
import Phaser from "phaser";
import { accent, surface, typeRole, type TypeSpec } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { textStyle } from "./theme.js";
import { McButton } from "./widgets.js";

const BUTTON_TYPE: TypeSpec = { ...typeRole.label, size: 12 };
const KNOB = 9;
const STEP_WIDTH = 36;
const PERCENT_WIDTH = 50;
/** Where a press turns into a drag (the scroll region's own slop). */
const SLOP = 6;

export interface McStepSliderOptions {
  /** The whole control: "−", track, "+", percent. */
  readonly rect: Rect;
  readonly ground: "ink" | "paper";
  readonly value: number;
  /** The knob's share along the track for a value (0 to 1), and the value a track position means (already clamped). */
  readonly shareOf: (value: number) => number;
  readonly valueAt: (x: number, track: { readonly x: number; readonly width: number }) => number;
  readonly step: (value: number, direction: -1 | 1) => number;
  readonly format: (value: number) => string;
  /** The value changed: \`commit\` is false while a drag is under way and true for a tap, a step or a drag's release. */
  readonly onChange: (value: number, commit: boolean) => void;
  readonly dimmed?: boolean;
  /** The scroll region's clip and drag guard, for a slider inside it. */
  readonly clip?: () => Rect | null;
  readonly suppressClick?: () => boolean;
}

export class McStepSlider {
  readonly buttons: McButton[] = [];
  readonly zone: Phaser.GameObjects.Zone;
  readonly track: { readonly x: number; readonly width: number };
  readonly #options: McStepSliderOptions;
  readonly #bar: Phaser.GameObjects.Graphics;
  readonly #percent: Phaser.GameObjects.Text;
  readonly #midY: number;
  #value: number;
  #press: { x: number; y: number; mode: "none" | "drag" | "scroll" } | null = null;

  constructor(scene: Phaser.Scene, options: McStepSliderOptions) {
    this.#options = options;
    this.#value = options.value;
    const { rect, ground } = options;
    const ink = ground === "ink" ? surface.paper.hex : surface.ink.hex;
    const down: Rect = { x: rect.x, y: rect.y, width: STEP_WIDTH, height: rect.height };
    const up: Rect = {
      x: rect.x + rect.width - PERCENT_WIDTH - STEP_WIDTH,
      y: rect.y,
      width: STEP_WIDTH,
      height: rect.height,
    };
    const left = down.x + STEP_WIDTH + 10 + KNOB;
    this.track = { x: left, width: Math.max(0, up.x - 10 - KNOB - left) };
    this.#midY = rect.y + rect.height / 2;
    this.#bar = scene.add.graphics();
    this.#percent = scene.add
      .text(rect.x + rect.width, this.#midY, "", textStyle(typeRole.label, ink))
      .setOrigin(1, 0.5);
    if (options.dimmed) {
      this.#bar.setAlpha(0.45);
      this.#percent.setAlpha(0.45);
    }
    this.zone = scene.add
      .zone(this.track.x - KNOB, rect.y, this.track.width + KNOB * 2, rect.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.zone.setName("slider-track");
    this.zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (options.suppressClick?.()) return;
      this.#press = { x: pointer.x, y: pointer.y, mode: "none" };
    });
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.#onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.#onUp, this);
    this.zone.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.#onMove, this);
      scene.input.off(Phaser.Input.Events.POINTER_UP, this.#onUp, this);
    });
    const stepButton = (rectOf: Rect, label: string, direction: -1 | 1): McButton =>
      new McButton(scene, {
        kind: "quiet",
        label,
        type: BUTTON_TYPE,
        rect: rectOf,
        onClick: () => this.step(direction),
        ...(options.clip ? { clip: options.clip } : {}),
        ...(options.suppressClick ? { suppressClick: options.suppressClick } : {}),
      });
    this.buttons.push(stepButton(down, "−", -1), stepButton(up, "+", 1));
    this.#paint();
  }

  get value(): number {
    return this.#value;
  }

  /** One step (the "−" and "+" buttons, and Left / Right on the focus route). */
  step(direction: -1 | 1): void {
    this.#set(this.#options.step(this.#value, direction), true);
  }

  #set(value: number, commit: boolean): void {
    if (value !== this.#value || commit) {
      this.#value = value;
      this.#paint();
      this.#options.onChange(value, commit);
    }
  }

  #paint(): void {
    const { track } = this;
    const midY = this.#midY;
    const ground = this.#options.ground;
    const base = ground === "ink" ? surface.paper.hex : surface.ink.hex;
    const bar = this.#bar;
    bar.clear();
    bar.fillStyle(base, 0.22).fillRect(track.x, midY - 3, track.width, 6);
    const at = track.x + track.width * this.#options.shareOf(this.#value);
    bar.fillStyle(accent.heroRed.hex, 1).fillRect(track.x, midY - 3, at - track.x, 6);
    bar.fillStyle(surface.paper.hex, 1).fillCircle(at, midY, KNOB);
    bar.lineStyle(2, surface.ink.hex, 1).strokeCircle(at, midY, KNOB);
    this.#percent.setText(this.#options.format(this.#value));
  }

  #onMove(pointer: Phaser.Input.Pointer): void {
    const press = this.#press;
    if (!press || !pointer.isDown) return;
    if (press.mode === "none") {
      const dx = Math.abs(pointer.x - press.x);
      const dy = Math.abs(pointer.y - press.y);
      if (dx <= SLOP && dy <= SLOP) return;
      // Up or down is the list's scroll; sideways is this slider's drag.
      press.mode = dy > dx ? "scroll" : "drag";
    }
    if (press.mode === "drag") this.#set(this.#options.valueAt(pointer.x, this.track), false);
  }

  #onUp(pointer: Phaser.Input.Pointer): void {
    const press = this.#press;
    this.#press = null;
    if (!press) return;
    if (press.mode === "drag") {
      this.#set(this.#options.valueAt(pointer.x, this.track), true);
    } else if (press.mode === "none" && this.zone.active && this.zone.input?.enabled) {
      // A tap: pressed and released on the track, neither moved past the slop.
      const bounds = this.zone.getBounds();
      if (bounds.contains(pointer.x, pointer.y)) this.#set(this.#options.valueAt(pointer.x, this.track), true);
    }
  }

  destroy(): void {
    for (const button of this.buttons) button.destroy();
    this.buttons.length = 0;
    this.zone.destroy();
    this.#bar.destroy();
    this.#percent.destroy();
  }
}
