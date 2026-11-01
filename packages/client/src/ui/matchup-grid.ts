/**
 * The Matchups tab's two grid views (`view/matchup-grid.ts` holds the data and the geometry): cells that pan both ways
 * under two sticky header bands, a line naming the pairing under the cursor, and a key. The heat grid packs small
 * colored squares under names on end; the stamp grid gives each name its picture and each win a lettered stamp.
 *
 * Recreated on every scene rebuild like `ui/virtual-list.ts`; the pan and the cursor live in a `MatchupGridState` the
 * scene keeps. Panning redraws one `Graphics` of the cells in view, and the labels and counts in view come from pools,
 * so a pan never rebuilds the screen.
 *
 * The cells are not masked: each layer above them is opaque, and later layers cover what an earlier one ran past (the
 * row band over the cells, the column band over the row names, the corner, the right edge and the panel under the grid
 * over the rest). A finger's press and lift within the tap slop moves the cursor and nothing else, so a swipe that ends
 * over a cell does nothing to it (`view/press-arm.ts`), and only reading happens here: nothing on the grid is a control.
 */
import Phaser from "phaser";
import { ink, surface, typeRole } from "../tokens.js";
import { Momentum, pointInRect } from "../view/drag-gesture.js";
import type { Rect } from "../view/layout.js";
import { withinTapSlop } from "../view/press-arm.js";
import {
  TIER_MARKS,
  bodyOf,
  cellAt,
  cellLookOf,
  cellRect,
  clampCursor,
  clampPan,
  gridMetricsOf,
  legendLayoutOf,
  legendOf,
  pageRows,
  panToShow,
  readoutOf,
  stepCursor,
  visibleRange,
  type CellLook,
  type GridCursor,
  type GridPoint,
  type GridShape,
  type GridStep,
  type MatchupCell,
  type MatchupGrid,
} from "../view/matchup-grid.js";
import { TIER_COLORS, drawLegend, onTierColor } from "./matchup-rows.js";
import { renderArtThumb } from "../scenes/roster-panel.js";
import { cssOf, textStyle } from "./theme.js";
import { fitText, fitWrapped } from "./widgets.js";

/** The grid's place, kept by the scene across rebuilds. */
export interface MatchupGridState {
  pan: GridPoint;
  cursor: GridCursor;
}

export interface McMatchupGridOptions {
  /** The whole widget: the grid, the readout and the key. */
  readonly rect: Rect;
  readonly grid: MatchupGrid;
  readonly state: MatchupGridState;
  readonly showPlayed: boolean;
  readonly showCounts: boolean;
  readonly phone: boolean;
  readonly style: "heat" | "stamps";
  /** A row's and a column's picture, for the stamp grid. */
  readonly rowPicture: (index: number) => string | null;
  readonly columnPicture: (index: number) => string | null;
}

const CELL_GAP = 2;
const COUNT_SIZE = 14;
const LABEL_SIZE = 13;
const STAMP_LABEL_SIZE = 11;
const BAR = 4;
const READOUT_HEIGHT = 42;
/** Below this screen height the column names' band shrinks. */
const SHORT_SCREEN = 820;
/** How far one line of a mouse's wheel pans; a trackpad reports pixels. */
const WHEEL_LINE_PX = 24;
/** A release this long after the last move is a stop, not a flick. */
const STILL_BEFORE_LIFT_MS = 100;

/** A cell's number or mark: a hue's own color, which no scheme changes, or the ink of a hollow cell, which follows it. */
const countColorOf = (look: Exclude<CellLook, { kind: "unplayed" }>): string =>
  cssOf(look.kind === "played" ? surface.ink.hex : onTierColor(look.tier));

/** A pool of text objects by key: what left the view is reused for what came in, sparing a new canvas each. */
class TextPool {
  readonly #scene: Phaser.Scene;
  readonly #layer: Phaser.GameObjects.Container;
  readonly #make: (scene: Phaser.Scene) => Phaser.GameObjects.Text;
  readonly #live = new Map<string, Phaser.GameObjects.Text>();
  readonly #free: Phaser.GameObjects.Text[] = [];

  constructor(
    scene: Phaser.Scene,
    layer: Phaser.GameObjects.Container,
    make: (scene: Phaser.Scene) => Phaser.GameObjects.Text,
  ) {
    this.#scene = scene;
    this.#layer = layer;
    this.#make = make;
  }

  /** Lets go of every key not in `keep`. */
  release(keep: ReadonlySet<string>): void {
    for (const [key, text] of this.#live) {
      if (keep.has(key)) continue;
      this.#live.delete(key);
      this.#free.push(text.setVisible(false));
    }
  }

  /** The text for `key`; `fresh` true when it has just been taken for this key and needs its words set. */
  take(key: string): { readonly text: Phaser.GameObjects.Text; readonly fresh: boolean } {
    const live = this.#live.get(key);
    if (live) return { text: live, fresh: false };
    let text = this.#free.pop();
    if (!text) {
      text = this.#make(this.#scene);
      this.#layer.add(text);
    }
    this.#live.set(key, text.setVisible(true));
    return { text, fresh: true };
  }
}

/** The header pictures in view, each made once at the origin and moved; none are pooled, a texture is per picture. */
class PicturePool {
  readonly #scene: Phaser.Scene;
  readonly #layer: Phaser.GameObjects.Container;
  readonly #live = new Map<number, Phaser.GameObjects.Image | Phaser.GameObjects.Graphics>();

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Container) {
    this.#scene = scene;
    this.#layer = layer;
  }

  place(index: number, url: string | null, width: number, height: number, x: number, y: number): void {
    let picture = this.#live.get(index);
    if (!picture) {
      const made = renderArtThumb(this.#scene, { x: 0, y: 0, width, height }, url);
      picture = made as Phaser.GameObjects.Image;
      this.#layer.addAt(picture, 0);
      this.#live.set(index, picture);
    }
    picture.setPosition(x, y);
  }

  release(keep: ReadonlySet<number>): void {
    for (const [index, picture] of this.#live) {
      if (keep.has(index)) continue;
      this.#live.delete(index);
      picture.destroy();
    }
  }
}

interface Press {
  readonly id: number;
  readonly startX: number;
  readonly startY: number;
  lastX: number;
  lastY: number;
  lastAt: number;
  velocityX: number;
  velocityY: number;
  moved: boolean;
}

export class McMatchupGrid {
  readonly #scene: Phaser.Scene;
  readonly #options: McMatchupGridOptions;
  readonly #grid: MatchupGrid;
  readonly #state: MatchupGridState;
  readonly #shape: GridShape;
  /** Cells by `row:column`, since a pan asks for every cell in view. */
  readonly #cells: ReadonlyMap<string, MatchupCell>;
  readonly #root: Phaser.GameObjects.Container;
  readonly #cellGraphics: Phaser.GameObjects.Graphics;
  readonly #rowBand: Phaser.GameObjects.Graphics;
  readonly #columnBand: Phaser.GameObjects.Graphics;
  readonly #bars: Phaser.GameObjects.Graphics;
  readonly #counts: TextPool;
  readonly #rowLabels: TextPool;
  readonly #columnLabels: TextPool;
  readonly #rowPictures: PicturePool;
  readonly #columnPictures: PicturePool;
  readonly #readoutTitle: Phaser.GameObjects.Text;
  readonly #readoutDetail: Phaser.GameObjects.Text;
  readonly #momentumX = new Momentum();
  readonly #momentumY = new Momentum();
  #press: Press | null = null;

  constructor(scene: Phaser.Scene, options: McMatchupGridOptions) {
    this.#scene = scene;
    this.#options = options;
    this.#grid = options.grid;
    this.#state = options.state;
    const { rect, phone, style } = options;
    const stamps = style === "stamps";

    this.#root = scene.add.container(0, 0);
    this.#cellGraphics = scene.add.graphics();
    const countLayer = scene.add.container(0, 0);
    this.#rowBand = scene.add.graphics();
    const rowLayer = scene.add.container(0, 0);
    this.#columnBand = scene.add.graphics();
    const columnLayer = scene.add.container(0, 0);
    const covers = scene.add.graphics();
    this.#bars = scene.add.graphics();
    this.#root.add([this.#cellGraphics, countLayer, this.#rowBand, rowLayer, this.#columnBand, columnLayer, covers]);
    this.#root.add(this.#bars);

    const labelSize = stamps ? STAMP_LABEL_SIZE : LABEL_SIZE;
    const labelStyle = textStyle({ ...typeRole.rowTitle, size: labelSize }, surface.ink.hex, 1);
    this.#counts = new TextPool(scene, countLayer, (s) =>
      s.add
        .text(0, 0, "", textStyle({ ...typeRole.rowTitle, size: COUNT_SIZE }, surface.ink.hex, 1))
        .setOrigin(0.5, 0.5),
    );
    this.#rowLabels = new TextPool(scene, rowLayer, (s) => s.add.text(0, 0, "", labelStyle).setOrigin(0, 0.5));
    this.#columnLabels = new TextPool(scene, columnLayer, (s) =>
      stamps
        ? s.add.text(0, 0, "", labelStyle).setOrigin(0.5, 0).setAlign("center")
        : s.add
            .text(0, 0, "", labelStyle)
            .setOrigin(0, 0.5)
            .setRotation(-Math.PI / 2),
    );
    this.#rowPictures = new PicturePool(scene, rowLayer);
    this.#columnPictures = new PicturePool(scene, columnLayer);

    const legend = legendLayoutOf(legendOf(this.#grid, options.showPlayed), rect.width);
    const gridRect: Rect = { ...rect, height: Math.max(80, rect.height - READOUT_HEIGHT - legend.height) };
    this.#shape = {
      rect: gridRect,
      metrics: gridMetricsOf(phone, scene.scale.height < SHORT_SCREEN, style),
      rows: this.#grid.rows.length,
      columns: this.#grid.columns.length,
    };
    this.#cells = new Map(this.#grid.cells.map((cell) => [`${cell.row}:${cell.column}`, cell]));
    this.#state.cursor = clampCursor(this.#shape, this.#state.cursor);
    this.#state.pan = clampPan(this.#shape, this.#state.pan);

    const below = gridRect.y + gridRect.height;
    // The covers: the corner over the column names, the screen's edge past the last column, and the panel under the grid.
    covers
      .fillStyle(surface.paper.hex, 1)
      .fillRect(rect.x - 2, rect.y, this.#shape.metrics.rowHeader + 2, this.#shape.metrics.columnHeader)
      .fillRect(rect.x + rect.width, rect.y, scene.scale.width - rect.x - rect.width, rect.height)
      .fillRect(rect.x - 2, below, rect.width + 4, scene.scale.height - below);

    this.#readoutTitle = scene.add.text(
      rect.x,
      below + 6,
      "",
      textStyle({ ...typeRole.rowTitle, size: 14 }, surface.ink.hex, 1),
    );
    this.#readoutDetail = scene.add.text(
      rect.x,
      below + 24,
      "",
      textStyle(typeRole.body, surface.ink.hex, ink.secondary),
    );
    this.#readoutDetail.setFontSize(12);
    this.#root.add([this.#readoutTitle, this.#readoutDetail]);
    this.#root.add(drawLegend(scene, legend, rect.x, below + READOUT_HEIGHT));

    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.#onWheel, this);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.#onPointerDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.#onPointerMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.#onPointerUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.#onPointerUp, this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.#onUpdate, this);
    this.#redraw();
  }

  /** The cursor's square, for the focus ring. Panned out of the body, the ring hides (`FocusStop.view`). */
  get cursorRect(): Rect {
    return cellRect(this.#shape, this.#state.pan, this.#state.cursor);
  }

  get bodyRect(): Rect {
    return bodyOf(this.#shape);
  }

  get readout(): { readonly title: string; readonly detail: string } {
    return readoutOf(this.#grid, this.#state.cursor.row, this.#state.cursor.column);
  }

  /** One cell along, the view following; false at the grid's edge, where the arrow should leave the grid. */
  step(step: GridStep): boolean {
    const next = stepCursor(this.#shape, this.#state.cursor, step);
    if (!next) return false;
    this.#moveCursor(next);
    return true;
  }

  /** A page of rows, Page Up or Down. */
  page(direction: 1 | -1): void {
    const { row, column } = this.#state.cursor;
    this.#moveCursor(clampCursor(this.#shape, { row: row + direction * pageRows(this.#shape), column }));
  }

  /** Home and End: the grid's first or last row. */
  edge(edge: "home" | "end"): void {
    this.#moveCursor({ row: edge === "home" ? 0 : this.#shape.rows - 1, column: this.#state.cursor.column });
  }

  /** Brings the cursor back into view, when focus lands on the grid after a pan took it away. */
  reveal(): void {
    this.#setPan(panToShow(this.#shape, this.#state.pan, this.#state.cursor));
  }

  /** The right stick: pixels this frame. */
  panBy(dx: number, dy: number): void {
    this.#setPan({ x: this.#state.pan.x + dx, y: this.#state.pan.y + dy });
  }

  /** Pictures arrived: each header in view asks again. Only this widget redraws, so a drag under way goes on. */
  refreshArt(): void {
    this.#rowPictures.release(new Set());
    this.#columnPictures.release(new Set());
    this.#redraw();
  }

  #moveCursor(cursor: GridCursor): void {
    this.#state.cursor = cursor;
    this.#state.pan = panToShow(this.#shape, this.#state.pan, cursor);
    this.#redraw();
  }

  /** True when the view moved. */
  #setPan(pan: GridPoint): boolean {
    const next = clampPan(this.#shape, pan);
    if (next.x === this.#state.pan.x && next.y === this.#state.pan.y) return false;
    this.#state.pan = next;
    this.#redraw();
    return true;
  }

  destroy(): void {
    const { input, events } = this.#scene;
    input.off(Phaser.Input.Events.POINTER_WHEEL, this.#onWheel, this);
    input.off(Phaser.Input.Events.POINTER_DOWN, this.#onPointerDown, this);
    input.off(Phaser.Input.Events.POINTER_MOVE, this.#onPointerMove, this);
    input.off(Phaser.Input.Events.POINTER_UP, this.#onPointerUp, this);
    input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.#onPointerUp, this);
    events.off(Phaser.Scenes.Events.UPDATE, this.#onUpdate, this);
    this.#root.destroy(true);
  }

  #onWheel(pointer: Phaser.Input.Pointer, _objects: unknown, dx: number, dy: number): void {
    if (!pointInRect(pointer.x, pointer.y, this.#shape.rect)) return;
    const event = pointer.event as WheelEvent | undefined;
    const scale = (event?.deltaMode ?? 1) === 0 ? 1 : WHEEL_LINE_PX;
    // Shift turns a mouse's one wheel sideways.
    const sideways = event?.shiftKey === true && dx === 0;
    this.panBy((sideways ? dy : dx) * scale, (sideways ? 0 : dy) * scale);
  }

  #onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.#press || !pointInRect(pointer.x, pointer.y, this.#shape.rect)) return;
    this.#momentumX.stop();
    this.#momentumY.stop();
    this.#press = {
      id: pointer.id,
      startX: pointer.x,
      startY: pointer.y,
      lastX: pointer.x,
      lastY: pointer.y,
      lastAt: this.#scene.time.now,
      velocityX: 0,
      velocityY: 0,
      moved: false,
    };
  }

  #onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown) {
      // A resting mouse reads the cell under it; a finger has no hover.
      if (pointer.wasTouch) return;
      const under = cellAt(this.#shape, this.#state.pan, pointer.x, pointer.y);
      if (under && (under.row !== this.#state.cursor.row || under.column !== this.#state.cursor.column)) {
        this.#state.cursor = under;
        this.#redraw();
      }
      return;
    }
    const press = this.#press;
    if (!press || press.id !== pointer.id) return;
    const now = this.#scene.time.now;
    const dx = press.lastX - pointer.x;
    const dy = press.lastY - pointer.y;
    const elapsed = Math.max(1, now - press.lastAt);
    press.velocityX = dx / elapsed;
    press.velocityY = dy / elapsed;
    press.lastX = pointer.x;
    press.lastY = pointer.y;
    press.lastAt = now;
    if (!withinTapSlop({ x: press.startX, y: press.startY }, pointer)) press.moved = true;
    if (press.moved) this.panBy(dx, dy);
  }

  #onPointerUp(pointer: Phaser.Input.Pointer): void {
    const press = this.#press;
    if (!press || press.id !== pointer.id) return;
    this.#press = null;
    if (press.moved) {
      if (this.#scene.time.now - press.lastAt > STILL_BEFORE_LIFT_MS) return;
      this.#momentumX.start(press.velocityX);
      this.#momentumY.start(press.velocityY);
      return;
    }
    if (!withinTapSlop({ x: press.startX, y: press.startY }, pointer)) return;
    const under = cellAt(this.#shape, this.#state.pan, pointer.x, pointer.y);
    if (under) {
      this.#state.cursor = under;
      this.#redraw();
    }
  }

  #onUpdate(_time: number, deltaMs: number): void {
    if (!this.#momentumX.active && !this.#momentumY.active) return;
    const dx = this.#momentumX.tick(deltaMs);
    const dy = this.#momentumY.tick(deltaMs);
    if (dx === 0 && dy === 0) return;
    if (this.#setPan({ x: this.#state.pan.x + dx, y: this.#state.pan.y + dy })) return;
    // Hit a corner: no pushing on the wall for the rest of the coast.
    this.#momentumX.stop();
    this.#momentumY.stop();
  }

  #redraw(): void {
    const { pan, cursor } = this.#state;
    const shape = this.#shape;
    const { rect, metrics } = shape;
    const body = bodyOf(shape);
    const { showCounts, showPlayed, style } = this.#options;
    const stamps = style === "stamps";
    const { rowFrom, rowTo, columnFrom, columnTo } = visibleRange(shape, pan);
    const g = this.#cellGraphics.clear();
    const keepCounts = new Set<string>();
    for (let row = rowFrom; row < rowTo; row++) {
      for (let column = columnFrom; column < columnTo; column++) {
        const key = `${row}:${column}`;
        const box = cellRect(shape, pan, { row, column });
        const look = cellLookOf(this.#cells.get(key), showPlayed);
        if (stamps) this.#drawStamp(g, box, look);
        else this.#drawCell(g, box, look);
        const words =
          look.kind === "unplayed"
            ? null
            : showCounts
              ? String(look.count)
              : stamps && look.kind === "won"
                ? TIER_MARKS[look.tier]
                : null;
        if (look.kind !== "unplayed" && words !== null) {
          keepCounts.add(key);
          const { text, fresh } = this.#counts.take(key);
          if (fresh) {
            text.setText(words);
            text.setColor(countColorOf(look));
          }
          text.setPosition(box.x + box.width / 2, box.y + box.height / 2);
        }
      }
    }
    this.#counts.release(keepCounts);
    const at = cellRect(shape, pan, cursor);
    const rowInView = at.y + at.height > body.y && at.y < body.y + body.height;
    const columnInView = at.x + at.width > body.x && at.x < body.x + body.width;
    if (rowInView && columnInView) {
      g.lineStyle(3, surface.ink.hex, 1).strokeRect(at.x + 1.5, at.y + 1.5, at.width - 3, at.height - 3);
      g.lineStyle(1, surface.paperOnInk.hex, 1).strokeRect(at.x + 3.5, at.y + 3.5, at.width - 7, at.height - 7);
    }

    // The bands, tinted along the cursor's row and column, so a cell is read back to its two names.
    const band = this.#rowBand.clear().fillStyle(surface.paper.hex, 1);
    band.fillRect(rect.x - 2, rect.y, metrics.rowHeader + 2, rect.height);
    if (rowInView) band.fillStyle(surface.parchment.hex, 1).fillRect(rect.x, at.y, metrics.rowHeader - 4, at.height);
    const columnBand = this.#columnBand.clear().fillStyle(surface.paper.hex, 1);
    columnBand.fillRect(rect.x - 2, rect.y, rect.width + 4, metrics.columnHeader);
    if (columnInView)
      columnBand.fillStyle(surface.parchment.hex, 1).fillRect(at.x, rect.y, at.width, metrics.columnHeader - 4);

    this.#placeRowHeaders(rowFrom, rowTo, body);
    this.#placeColumnHeaders(columnFrom, columnTo, body);
    this.#drawBars(body);
    const readout = this.readout;
    this.#readoutTitle.setText(readout.title);
    fitText(this.#readoutTitle, rect.width, 14);
    this.#readoutDetail.setText(readout.detail);
    fitText(this.#readoutDetail, rect.width, 12);
  }

  #placeRowHeaders(from: number, to: number, body: Rect): void {
    const { rect, metrics } = this.#shape;
    const { pan } = this.#state;
    const { phone, style, rowPicture } = this.#options;
    const stamps = style === "stamps";
    const keep = new Set<string>();
    const pictures = new Set<number>();
    // On a phone a stamp row's picture sits over its name; wider, beside it.
    const picture = !stamps
      ? null
      : phone
        ? { width: metrics.rowHeader - 10, height: 24 }
        : { width: 52, height: metrics.cell - 8 };
    for (let row = from; row < to; row++) {
      const key = String(row);
      keep.add(key);
      const top = body.y + row * metrics.cell - pan.y;
      const { text, fresh } = this.#rowLabels.take(key);
      const textWidth = metrics.rowHeader - 14 - (picture && !phone ? picture.width + 8 : 0);
      if (fresh) {
        text.setText(this.#grid.rows[row]!.name);
        if (stamps) fitWrapped(text, textWidth, 2, STAMP_LABEL_SIZE);
        else fitText(text, textWidth, LABEL_SIZE);
      }
      if (picture) {
        pictures.add(row);
        this.#rowPictures.place(row, rowPicture(row), picture.width, picture.height, rect.x + 2, top + 4);
      }
      if (picture && phone) text.setPosition(rect.x + 2, top + 28 + (metrics.cell - 28) / 2);
      else text.setPosition(rect.x + 4 + (picture ? picture.width + 6 : 0), top + metrics.cell / 2);
    }
    this.#rowLabels.release(keep);
    this.#rowPictures.release(pictures);
  }

  #placeColumnHeaders(from: number, to: number, body: Rect): void {
    const { rect, metrics } = this.#shape;
    const { pan } = this.#state;
    const { style, columnPicture } = this.#options;
    const stamps = style === "stamps";
    const keep = new Set<string>();
    const pictures = new Set<number>();
    const pictureHeight = metrics.columnHeader - 38;
    for (let column = from; column < to; column++) {
      const key = String(column);
      keep.add(key);
      const left = body.x + column * metrics.cell - pan.x;
      const { text, fresh } = this.#columnLabels.take(key);
      if (fresh) {
        text.setText(this.#grid.columns[column]!.name);
        if (stamps) fitWrapped(text, metrics.cell - 4, 2, STAMP_LABEL_SIZE);
        else fitText(text, metrics.columnHeader - 12, LABEL_SIZE);
      }
      if (stamps) {
        pictures.add(column);
        const width = metrics.cell - 6;
        this.#columnPictures.place(column, columnPicture(column), width, pictureHeight, left + 3, rect.y + 2);
        text.setPosition(left + metrics.cell / 2, rect.y + pictureHeight + 5);
      } else {
        text.setPosition(left + metrics.cell / 2, rect.y + metrics.columnHeader - 6);
      }
    }
    this.#columnLabels.release(keep);
    this.#columnPictures.release(pictures);
  }

  #drawCell(g: Phaser.GameObjects.Graphics, box: Rect, look: CellLook): void {
    const x = box.x + CELL_GAP / 2;
    const y = box.y + CELL_GAP / 2;
    const size = box.width - CELL_GAP;
    if (look.kind === "won") g.fillStyle(TIER_COLORS[look.tier], 1).fillRect(x, y, size, size);
    else if (look.kind === "unplayed") g.fillStyle(surface.parchment.hex, 1).fillRect(x, y, size, size);
    else g.lineStyle(2, surface.ink.hex, 1).strokeRect(x + 2, y + 2, size - 4, size - 4);
  }

  /** A stamp: a filled disc with an ink ring and a hard shadow for a win, a bare ring for played, a small dot for neither. */
  #drawStamp(g: Phaser.GameObjects.Graphics, box: Rect, look: CellLook): void {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const radius = box.width * 0.4;
    if (look.kind === "unplayed") {
      g.fillStyle(surface.parchment.hex, 1).fillCircle(cx, cy, radius * 0.45);
      return;
    }
    if (look.kind === "played") {
      g.lineStyle(3, surface.ink.hex, 1).strokeCircle(cx, cy, radius - 1);
      return;
    }
    g.fillStyle(surface.ink.hex, 1).fillCircle(cx + 2, cy + 2, radius);
    g.fillStyle(TIER_COLORS[look.tier], 1).fillCircle(cx, cy, radius);
    g.lineStyle(2.5, surface.ink.hex, 1).strokeCircle(cx, cy, radius);
  }

  /** Two thin bars at the body's edges saying how far the grid runs each way, in place of a list's scrollbar. */
  #drawBars(body: Rect): void {
    const { metrics, rows, columns } = this.#shape;
    const { pan } = this.#state;
    const g = this.#bars.clear();
    const fullWidth = columns * metrics.cell;
    const fullHeight = rows * metrics.cell;
    if (fullWidth > body.width) {
      const y = body.y + body.height + 1;
      g.fillStyle(surface.inkMark.hex, 0.12).fillRect(body.x, y, body.width, BAR);
      g.fillStyle(surface.inkMark.hex, 0.6).fillRect(
        body.x + (pan.x / fullWidth) * body.width,
        y,
        (body.width / fullWidth) * body.width,
        BAR,
      );
    }
    if (fullHeight > body.height) {
      const x = body.x + body.width + 1;
      g.fillStyle(surface.inkMark.hex, 0.12).fillRect(x, body.y, BAR, body.height);
      g.fillStyle(surface.inkMark.hex, 0.6).fillRect(
        x,
        body.y + (pan.y / fullHeight) * body.height,
        BAR,
        (body.height / fullHeight) * body.height,
      );
    }
  }
}
