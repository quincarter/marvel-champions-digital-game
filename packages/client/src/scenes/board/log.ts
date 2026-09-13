/**
 * The game log panel: the lines `view/log-view.ts` puts on screen, a scroll
 * thumb, and a "newer" chip while the player is reading back.
 *
 * Virtualized the only way the Board's redraw model allows: every draw builds
 * `Text` objects for the visible lines alone, and the scroll position lives in
 * `LogScroll` rather than in any object the next draw would sweep away. Line
 * heights are measured once per line per width and cached, so a redraw doesn't
 * re-wrap 400 lines to find out where a dozen go.
 *
 * Lines wrap instead of stopping at one: on the long table the log is a column
 * about 130px wide, where one line held "Rhino hit Spider-Man for…" and never
 * the defense arithmetic that was the point of the line.
 */

import type Phaser from "phaser";
import { accent, ink, signal, status, surface, typeRole } from "../../tokens.js";
import { caseOf, textStyle } from "../../ui/theme.js";
import { fitText, label, paintPanel } from "../../ui/widgets.js";
import type { Rect } from "../../view/layout.js";
import type { LogLine, LogState, LogVoice } from "../../view/log-lines.js";
import { LogScroll, thumbOf, type LogMeasure } from "../../view/log-view.js";

const HEADER_HEIGHT = 20;
const PAD_X = 7;
/** Room at the right for the scroll track. */
const TRACK_GUTTER = 7;
const REF_HEIGHT = 13;
const TAG_ROW_HEIGHT = 16;
const LINE_GAP = 7;
const NEWER_CHIP_HEIGHT = 22;
/** Wheel pixels per line: a mouse notch (~100px) moves about three lines, and a trackpad glides. */
const WHEEL_PX_PER_LINE = 34;
/** Drag pixels per line: a thumb moving the log about as fast as the lines move under it. */
const DRAG_PX_PER_LINE = 26;

/** The rule down each line's left edge: whose beat it was. The words already say it; this is only for scanning. */
const VOICE_RULE: Readonly<Record<LogVoice, { readonly color: number; readonly alpha: number }>> = {
  player: { color: surface.ink.hex, alpha: ink.meta },
  villain: { color: accent.heroRed.hex, alpha: 1 },
  scenario: { color: signal.caution.hex, alpha: 1 },
  win: { color: signal.heal.hex, alpha: 1 },
  loss: { color: accent.heroRed.hex, alpha: 1 },
};

export class LogPanel {
  readonly #scroll = new LogScroll();
  readonly #redraw: () => void;
  /** Where the panel was drawn last, or null while it isn't on screen (another phone tab). */
  #rect: Rect | null = null;
  #measure: LogMeasure | null = null;
  #heights = new Map<string, number>();
  #measuredWidth = -1;
  #wheelCarry = 0;
  /** The pointer's y at the last line a drag consumed, or null when no drag is in progress. */
  #dragY: number | null = null;

  constructor(redraw: () => void) {
    this.#redraw = redraw;
  }

  /** A new game: back to following the newest line, with nothing measured. */
  reset(): void {
    this.#scroll.follow();
    this.#heights.clear();
    this.#measuredWidth = -1;
    this.#wheelCarry = 0;
    this.hide();
  }

  /** The layout isn't showing the log this draw. */
  hide(): void {
    this.#rect = null;
    this.#dragY = null;
  }

  /** A wheel or trackpad gesture over the panel scrolls it. Registered on the scene's input by the Board. */
  onWheel(pointer: Phaser.Input.Pointer, _objects: unknown, _deltaX: number, deltaY: number): void {
    const rect = this.#rect;
    if (!rect || pointer.x < rect.x || pointer.x > rect.x + rect.width || pointer.y < rect.y || pointer.y > rect.y + rect.height) return;
    this.#wheelCarry += deltaY;
    const lines = Math.trunc(this.#wheelCarry / WHEEL_PX_PER_LINE);
    if (lines === 0) return;
    this.#wheelCarry -= lines * WHEEL_PX_PER_LINE;
    this.#scrollBy(lines);
  }

  draw(scene: Phaser.Scene, rect: Rect, log: LogState): void {
    this.#rect = rect;
    const g = scene.add.graphics();
    paintPanel(g, rect, "rail", "rest");
    label(scene, rect.x + PAD_X, rect.y + 6, "log", typeRole.label, surface.ink.hex, ink.label);

    const x = rect.x + PAD_X;
    const textWidth = Math.max(40, rect.width - PAD_X * 2 - TRACK_GUTTER);
    const listTop = rect.y + HEADER_HEIGHT;
    const listBottom = rect.y + rect.height - 4;
    const following = this.#scroll.following;
    const viewHeight = Math.max(0, listBottom - listTop - (following ? 0 : NEWER_CHIP_HEIGHT + 4));

    const heights = this.#measureLines(scene, log.lines, textWidth);
    const measure: LogMeasure = { ids: log.lines.map((line) => line.id), heights, viewHeight };
    this.#measure = measure;
    const window = this.#scroll.windowFor(measure);

    if (log.lines.length === 0) {
      scene.add
        .text(x, listTop, "What happens at the table is written here.", textStyle(typeRole.body, surface.ink.hex, ink.meta))
        .setWordWrapWidth(textWidth);
    }
    let y = listTop;
    for (let index = window.start; index < window.end; index += 1) {
      this.#drawLine(scene, x, y, textWidth, log.lines[index]!, heights[index]!);
      y += heights[index]!;
    }

    // Drag to scroll: the finger is the only scroll a phone has.
    const zone = scene.add.zone(rect.x, listTop, rect.width, viewHeight).setOrigin(0, 0).setInteractive();
    zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.#dragY = pointer.y;
    });
    zone.on("pointermove", (pointer: Phaser.Input.Pointer) => this.#onDrag(pointer));
    zone.on("pointerup", () => {
      this.#dragY = null;
    });

    const thumb = thumbOf(window, log.lines.length);
    if (thumb) {
      const track: Rect = { x: rect.x + rect.width - 6, y: listTop, width: 3, height: listBottom - listTop };
      const tg = scene.add.graphics();
      tg.fillStyle(surface.ink.hex, 0.12).fillRect(track.x, track.y, track.width, track.height);
      tg.fillStyle(surface.ink.hex, 0.6).fillRect(track.x, track.y + thumb.top * track.height, track.width, Math.max(10, thumb.size * track.height));
    }

    if (!following) this.#drawNewerChip(scene, rect, measure);
  }

  #scrollBy(lines: number): void {
    if (this.#measure && this.#scroll.scrollBy(lines, this.#measure)) this.#redraw();
  }

  #onDrag(pointer: Phaser.Input.Pointer): void {
    if (this.#dragY === null) return;
    if (!pointer.isDown) {
      this.#dragY = null;
      return;
    }
    // Dragging down pulls older lines into view, the way a touch list scrolls.
    const lines = Math.trunc((this.#dragY - pointer.y) / DRAG_PX_PER_LINE);
    if (lines === 0) return;
    this.#dragY -= lines * DRAG_PX_PER_LINE;
    this.#scrollBy(lines);
  }

  /** While reading back: how much is below, and a way straight back to it. */
  #drawNewerChip(scene: Phaser.Scene, rect: Rect, measure: LogMeasure): void {
    const newer = this.#scroll.newerThanView(measure);
    const chip: Rect = { x: rect.x + 4, y: rect.y + rect.height - 4 - NEWER_CHIP_HEIGHT, width: rect.width - 8, height: NEWER_CHIP_HEIGHT };
    const cg = scene.add.graphics();
    cg.fillStyle(surface.ink.hex, 1).fillRect(chip.x, chip.y, chip.width, chip.height);
    const text = label(
      scene,
      chip.x + chip.width / 2,
      chip.y + chip.height / 2,
      newer > 0 ? `▼ ${newer} newer · latest` : "▼ latest",
      typeRole.label,
      surface.paper.hex,
      1,
    ).setOrigin(0.5);
    fitText(text, chip.width - 8, typeRole.label.size);
    scene.add
      .zone(chip.x, chip.y, chip.width, chip.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => {
        if (this.#scroll.follow()) this.#redraw();
      });
  }

  /** Each line's height at `width`, measured once and then cached by line id. */
  #measureLines(scene: Phaser.Scene, lines: readonly LogLine[], width: number): number[] {
    if (width !== this.#measuredWidth) {
      this.#heights.clear();
      this.#measuredWidth = width;
    }
    let probe: Phaser.GameObjects.Text | null = null;
    const heights: number[] = [];
    for (const line of lines) {
      let height = this.#heights.get(line.id);
      if (height === undefined) {
        probe ??= scene.add.text(-10000, -10000, "", textStyle(typeRole.body, surface.ink.hex)).setWordWrapWidth(width);
        probe.setText(line.text);
        height = REF_HEIGHT + Math.ceil(probe.height) + (line.tags.length > 0 ? TAG_ROW_HEIGHT : 0) + LINE_GAP;
        this.#heights.set(line.id, height);
      }
      heights.push(height);
    }
    probe?.destroy();
    // The log trims its oldest lines; forget their heights too, so the cache is bounded by the log.
    if (this.#heights.size > lines.length * 2) {
      const held = new Set(lines.map((line) => line.id));
      for (const id of this.#heights.keys()) if (!held.has(id)) this.#heights.delete(id);
    }
    return heights;
  }

  #drawLine(scene: Phaser.Scene, x: number, y: number, width: number, line: LogLine, height: number): void {
    const voice = VOICE_RULE[line.voice];
    const rule = scene.add.graphics();
    rule.fillStyle(voice.color, voice.alpha).fillRect(x - 4, y + 1, 2, height - LINE_GAP - 1);

    label(scene, x, y, line.ref, typeRole.mono, surface.ink.hex, ink.meta).setFontSize(9);
    const text = scene.add.text(x, y + REF_HEIGHT, line.text, textStyle(typeRole.body, surface.ink.hex, ink.secondary)).setWordWrapWidth(width);

    // Statuses as chips in their own hue, named in words, struck through once spent.
    let cursor = x;
    const tagY = text.y + text.height + 2;
    for (const tag of line.tags) {
      const chip = scene.add.graphics();
      const name = scene.add
        .text(cursor + 3, tagY + 1, caseOf(typeRole.label, tag.status), textStyle(typeRole.label, tag.status === "confused" ? surface.paper.hex : surface.ink.hex, tag.spent ? 0.75 : 1))
        .setLetterSpacing(typeRole.label.letterSpacing);
      const chipWidth = Math.ceil(name.width) + 6;
      chip.fillStyle(status[tag.status].hex, tag.spent ? 0.45 : 1).fillRect(cursor, tagY, chipWidth, 13);
      if (tag.spent) chip.lineStyle(1.5, surface.ink.hex, 1).lineBetween(cursor + 2, tagY + 6.5, cursor + chipWidth - 2, tagY + 6.5);
      cursor += chipWidth + 4;
    }
  }
}
