/**
 * The game log's large view: the lines `view/log-view.ts` puts on screen, a scroll thumb, and a "newer" chip while the
 * player is reading back. It opens from the title bar (`view/log-dock.ts`, issue #550), from the Board beside the table
 * and from the villain phase inside its own panel.
 *
 * Virtualized the only way the redraw model allows: every draw builds `Text` objects for the visible lines alone, and
 * the scroll position lives in `LogScroll` rather than in any object the next draw would sweep away. Line heights are
 * measured once per line per width and cached, so a redraw doesn't re-wrap 400 lines to find out where a dozen go.
 */

import type Phaser from "phaser";
import { accent, ink, signal, status, surface, typeRole, type TypeSpec } from "../../tokens.js";
import { onTap } from "../../ui/tap.js";
import { caseOf, textStyle } from "../../ui/theme.js";
import { fitText, label, McButton, paintPanel } from "../../ui/widgets.js";
import type { Rect } from "../../view/layout.js";
import type { LogType } from "../../view/log-dock.js";
import type { LogLine, LogState, LogVoice } from "../../view/log-lines.js";
import { LogScroll, thumbOf, type LogMeasure } from "../../view/log-view.js";

const HEADER_HEIGHT = 50;
const HEADER_TITLE_SIZE = 26;
const CLOSE_WIDTH = 150;
const CLOSE_HEIGHT = 38;
const PAD_X = 16;
/** Room at the right for the scroll track. */
const TRACK_GUTTER = 12;
const TAG_HEIGHT = 18;
const TAG_ROW_HEIGHT = 24;
const LINE_GAP = 12;
const NEWER_CHIP_HEIGHT = 34;
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

const refHeight = (size: LogType): number => size.ref + 7;

/** The lines' type: bolder and at full ink, which is what made the small panel so hard to read. */
const lineType = (size: number): TypeSpec => ({ ...typeRole.emphasis, size, lineHeight: 1.35 });

export interface LogPanelOptions {
  readonly type: LogType;
  /** The header's way out: what it says, and the press. */
  readonly closeLabel: string;
  readonly onClose: () => void;
  /** Hears the button, for the scene's own cleanup and glyph. */
  readonly onCloseButton: (button: McButton, rect: Rect) => void;
}

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
  #bodySize = 0;

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
    if (
      !rect ||
      pointer.x < rect.x ||
      pointer.x > rect.x + rect.width ||
      pointer.y < rect.y ||
      pointer.y > rect.y + rect.height
    )
      return;
    this.#wheelCarry += deltaY;
    const lines = Math.trunc(this.#wheelCarry / WHEEL_PX_PER_LINE);
    if (lines === 0) return;
    this.#wheelCarry -= lines * WHEEL_PX_PER_LINE;
    this.#scrollBy(lines);
  }

  /** The right stick while the log has focus: `dy` pixels (positive scrolls toward the newest line) at the wheel's pace. */
  onPadScroll(dy: number): void {
    if (!this.#rect) return;
    this.#wheelCarry += dy;
    const lines = Math.trunc(this.#wheelCarry / WHEEL_PX_PER_LINE);
    if (lines === 0) return;
    this.#wheelCarry -= lines * WHEEL_PX_PER_LINE;
    this.#scrollBy(lines);
  }

  draw(scene: Phaser.Scene, rect: Rect, log: LogState, options: LogPanelOptions): void {
    this.#rect = rect;
    const size = options.type;
    if (size.body !== this.#bodySize) {
      this.#heights.clear();
      this.#bodySize = size.body;
    }
    const g = scene.add.graphics();
    paintPanel(g, rect, "rail", "rest");
    const closeRect: Rect = {
      x: rect.x + rect.width - PAD_X - CLOSE_WIDTH,
      y: rect.y + (HEADER_HEIGHT - CLOSE_HEIGHT) / 2,
      width: CLOSE_WIDTH,
      height: CLOSE_HEIGHT,
    };
    const title = scene.add
      .text(
        rect.x + PAD_X,
        rect.y + HEADER_HEIGHT / 2,
        "GAME LOG",
        textStyle({ ...typeRole.barTitle, size: HEADER_TITLE_SIZE }, surface.ink.hex),
      )
      .setOrigin(0, 0.5);
    fitText(title, closeRect.x - rect.x - PAD_X - 10, HEADER_TITLE_SIZE);
    options.onCloseButton(
      new McButton(scene, {
        kind: "quiet",
        label: options.closeLabel,
        type: { ...typeRole.label, size: 11 },
        rect: closeRect,
        onClick: options.onClose,
      }),
      closeRect,
    );
    const headerHeight = HEADER_HEIGHT;

    const x = rect.x + PAD_X;
    const textWidth = Math.max(40, rect.width - PAD_X * 2 - TRACK_GUTTER);
    const listTop = rect.y + headerHeight;
    const listBottom = rect.y + rect.height - 4;
    const following = this.#scroll.following;
    const viewHeight = Math.max(0, listBottom - listTop - (following ? 0 : NEWER_CHIP_HEIGHT + 4));

    const heights = this.#measureLines(scene, log.lines, textWidth, size);
    const measure: LogMeasure = { ids: log.lines.map((line) => line.id), heights, viewHeight };
    this.#measure = measure;
    const window = this.#scroll.windowFor(measure);

    if (log.lines.length === 0) {
      scene.add
        .text(
          x,
          listTop,
          "What happens at the table is written here.",
          textStyle(lineType(size.body), surface.ink.hex, ink.secondary),
        )
        .setWordWrapWidth(textWidth);
    }
    let y = listTop;
    for (let index = window.start; index < window.end; index += 1) {
      this.#drawLine(scene, x, y, textWidth, log.lines[index]!, heights[index]!, size);
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
      const track: Rect = { x: rect.x + rect.width - 9, y: listTop, width: 4, height: listBottom - listTop };
      const tg = scene.add.graphics();
      tg.fillStyle(surface.ink.hex, 0.12).fillRect(track.x, track.y, track.width, track.height);
      tg.fillStyle(surface.ink.hex, 0.6).fillRect(
        track.x,
        track.y + thumb.top * track.height,
        track.width,
        Math.max(10, thumb.size * track.height),
      );
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
    const chip: Rect = {
      x: rect.x + 4,
      y: rect.y + rect.height - 4 - NEWER_CHIP_HEIGHT,
      width: rect.width - 8,
      height: NEWER_CHIP_HEIGHT,
    };
    const cg = scene.add.graphics();
    cg.fillStyle(surface.ink.hex, 1).fillRect(chip.x, chip.y, chip.width, chip.height);
    const text = label(
      scene,
      chip.x + chip.width / 2,
      chip.y + chip.height / 2,
      newer > 0 ? `▼ ${newer} newer · latest` : "▼ latest",
      { ...typeRole.label, size: 12 },
      surface.paper.hex,
      1,
    ).setOrigin(0.5);
    fitText(text, chip.width - 8, 12);
    const zone = scene.add
      .zone(chip.x, chip.y, chip.width, chip.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    onTap(zone, () => {
      if (this.#scroll.follow()) this.#redraw();
    });
  }

  /** Each line's height at `width`, measured once and then cached by line id. */
  #measureLines(scene: Phaser.Scene, lines: readonly LogLine[], width: number, size: LogType): number[] {
    if (width !== this.#measuredWidth) {
      this.#heights.clear();
      this.#measuredWidth = width;
    }
    let probe: Phaser.GameObjects.Text | null = null;
    const heights: number[] = [];
    for (const line of lines) {
      let height = this.#heights.get(line.id);
      if (height === undefined) {
        probe ??= scene.add
          .text(-10000, -10000, "", textStyle(lineType(size.body), surface.ink.hex))
          .setWordWrapWidth(width);
        probe.setText(line.text);
        height = refHeight(size) + Math.ceil(probe.height) + (line.tags.length > 0 ? TAG_ROW_HEIGHT : 0) + LINE_GAP;
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

  #drawLine(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    line: LogLine,
    height: number,
    size: LogType,
  ): void {
    const voice = VOICE_RULE[line.voice];
    const rule = scene.add.graphics();
    rule.fillStyle(voice.color, voice.alpha).fillRect(x - 8, y + 1, 3, height - LINE_GAP - 1);

    label(scene, x, y, line.ref, typeRole.mono, surface.ink.hex, ink.secondary).setFontSize(size.ref);
    const text = scene.add
      .text(x, y + refHeight(size), line.text, textStyle(lineType(size.body), surface.ink.hex))
      .setWordWrapWidth(width);

    // Statuses as chips in their own hue, named in words, struck through once spent.
    let cursor = x;
    const tagY = text.y + text.height + 3;
    for (const tag of line.tags) {
      const chip = scene.add.graphics();
      const name = scene.add.text(
        cursor + 5,
        tagY + 3,
        caseOf(typeRole.label, tag.status),
        textStyle(
          { ...typeRole.label, size: 11 },
          tag.status === "confused" ? surface.paper.hex : surface.inkOnHue.hex,
          tag.spent ? 0.75 : 1,
        ),
      );
      const chipWidth = Math.ceil(name.width) + 10;
      chip.fillStyle(status[tag.status].hex, tag.spent ? 0.45 : 1).fillRect(cursor, tagY, chipWidth, TAG_HEIGHT);
      if (tag.spent)
        chip
          .lineStyle(1.5, surface.inkOnHue.hex, 1)
          .lineBetween(cursor + 2, tagY + TAG_HEIGHT / 2, cursor + chipWidth - 2, tagY + TAG_HEIGHT / 2);
      cursor += chipWidth + 4;
    }
  }
}
