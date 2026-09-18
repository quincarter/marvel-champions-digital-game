/**
 * The searchable, scrollable roster panel S8 describes
 * (docs/phase4-screen-gaps.md §2): a search field, a quick-filter chip strip,
 * and a virtualized list of plain rows — factored out of what
 * `scenes/title.ts` drew inline for its scenario and hero rosters, so W2's
 * split screens (Scenario select, Take your seats) draw the same panel
 * without a second, drifting copy of the same ~150 lines.
 *
 * Every function here is a free function over a `Phaser.Scene`, not a class:
 * it fits the rest of this codebase's convention (a scene owns its own
 * `#buttons`/`#stops` and rebuilds them every draw pass, `ui/virtual-list.ts`'s
 * own doc comment on "recreated every scene rebuild"), so these functions
 * take the scene's own tracking arrays/maps and push into them rather than
 * returning something the caller has to remember to merge in.
 */
import type Phaser from "phaser";
import type { CardId } from "@mc/content";
import { drawArt } from "../art/card-art.js";
import { ensurePictureLoaded, type Picture } from "../art/pictures.js";
import { accent, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { McButton, McTextInput, fitText, label, paintPanel } from "../ui/widgets.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { McShelfRoster, type ShelfRosterMetrics } from "../ui/shelf-roster.js";
import type { ListScroll } from "../view/list-scroll.js";
import { CHIP_GAP } from "../view/chip-layout.js";
import type { Rect } from "../view/layout.js";
import { ROSTER_ROW_HEIGHT } from "../view/roster-block-layout.js";
import type { Shelf } from "../view/roster-shelves.js";
import { shelfScrollCacheFor, type ShelfScreen } from "../view/shelf-scroll-cache.js";
import type { FocusStop } from "./focus-route.js";

/** One roster row, common to every roster this panel draws. */
export interface RosterRow {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly selected: boolean;
  /** Why this row cannot be chosen. Null when it can (a seatable-with-a-warning deck is still clickable). */
  readonly blockedBy: string | null;
  /** A non-blocking note, shown on Inspect. */
  readonly warning: string | null;
  readonly onClick: () => void;
  readonly inspectCardId: CardId | null;
  /** What Inspect's primary button says when this row can be chosen. */
  readonly chooseLabel: string;
}

/** One quick-filter chip, or a difficulty/modular-set toggle — anything drawn as an equal-width cell in a row. */
export interface ChoiceCell {
  readonly id: string;
  readonly text: string;
  readonly selected: boolean;
  readonly onClick: () => void;
}

/** A DOM search field, created once and laid out on every later call (`McTextInput`'s own persist-across-rebuild pattern, `scenes/title.ts`'s doc comment). */
export function drawSearchField(
  scene: Phaser.Scene,
  rect: Rect,
  stopId: string,
  value: string,
  placeholder: string,
  onChange: (value: string) => void,
  existing: McTextInput | null,
  stops: Map<string, FocusStop>,
): McTextInput {
  const input = existing ?? new McTextInput(scene, { rect, value, placeholder, onChange });
  if (existing) existing.layout(rect);
  stops.set(stopId, { rect, activate: () => input.focus() });
  return input;
}

/**
 * An equal-width row of toggle/select buttons: difficulty, a modular-set
 * cell, or one row of quick-filter chips. `kind` defaults to `"secondary"`
 * (a paper-ground toggle); Table setup's modular set tiles pass `"onInk"` for
 * the dark recessed tile the mock draws them as
 * (`docs/design-renders/ScreensDesktop_04.png`), regardless of the ground
 * behind them.
 */
export function drawChoiceRow(
  scene: Phaser.Scene,
  rect: Rect,
  cells: readonly ChoiceCell[],
  focusPrefix: string,
  buttons: McButton[],
  stops: Map<string, FocusStop>,
  kind: "secondary" | "onInk" = "secondary",
): void {
  const cellWidth = (rect.width - (cells.length - 1) * 6) / cells.length;
  cells.forEach((cell, index) => {
    const cellRect: Rect = { x: rect.x + index * (cellWidth + 6), y: rect.y, width: cellWidth, height: rect.height };
    buttons.push(new McButton(scene, { kind, label: cell.text, type: typeRole.rowTitle, rect: cellRect, selected: cell.selected, onClick: cell.onClick }));
    stops.set(`${focusPrefix}:${cell.id}`, { rect: cellRect, activate: cell.onClick });
  });
}

/** A quick-filter chip strip: one `drawChoiceRow` per row `wrapChipsToRows` already packed, stacked inside the rect the layout reserved for that many rows. */
export function drawChipStrip(
  scene: Phaser.Scene,
  rect: Rect,
  rows: readonly (readonly ChoiceCell[])[],
  focusPrefix: string,
  buttons: McButton[],
  stops: Map<string, FocusStop>,
  kind: "secondary" | "onInk" = "secondary",
): void {
  rows.forEach((row, index) => {
    drawChoiceRow(scene, { x: rect.x, y: rect.y + index * (hit.target + CHIP_GAP), width: rect.width, height: hit.target }, row, focusPrefix, buttons, stops, kind);
  });
}

/**
 * One roster row, drawn as the design's compact "entity card"
 * (`docs/design-renders/Components_01.png`, "List row"/"Entity card"): a
 * square art-slot thumbnail on the left (a future card-art drop-in — plain
 * ground today), the title and subtitle beside it, on the `card` skin's white
 * ground with an ink border — selected gets the skin's red border and a small
 * red "SELECTED" tag instead of the ink-invert this row used before W2's
 * design pass, matching how a selected scenario/hero card reads on the
 * canvases. A blocked row uses the skin's own `unavailable` state (present,
 * dimmed, never hidden — PLAN.md's "dim, don't hide").
 */
export function renderRosterRow(scene: Phaser.Scene, rect: Rect, row: RosterRow): VirtualListRow {
  const objects: Phaser.GameObjects.GameObject[] = [];
  const inner: Rect = { x: rect.x + 4, y: rect.y + 2, width: rect.width - 8, height: rect.height - 4 };
  const g = scene.add.graphics();
  const state = row.blockedBy ? "unavailable" : row.selected ? "selected" : "rest";
  paintPanel(g, inner, "card", state);
  objects.push(g);

  const thumbSize = inner.height - 12;
  const thumb = scene.add.graphics();
  thumb.fillStyle(surface.parchment.hex, 1).fillRect(inner.x + 6, inner.y + 6, thumbSize, thumbSize);
  thumb.lineStyle(1, surface.ink.hex, ink.meta).strokeRect(inner.x + 6, inner.y + 6, thumbSize, thumbSize);
  objects.push(thumb);

  const textX = inner.x + 6 + thumbSize + 10;
  const textWidth = inner.width - (textX - inner.x) - 10;
  const dim = row.blockedBy ? ink.illegal : 1;
  const title = scene.add.text(textX, inner.y + 8, row.title, textStyle(typeRole.rowTitle, surface.ink.hex, dim));
  fitText(title, textWidth);
  objects.push(title);
  const subtitleText = row.blockedBy ?? row.warning ?? row.subtitle;
  const subtitleColor = row.blockedBy ? accent.heroRed.hex : row.warning ? signal.caution.hex : surface.ink.hex;
  const subtitle = label(scene, textX, inner.y + 8 + title.height + 3, subtitleText, typeRole.label, subtitleColor, row.blockedBy || row.warning ? 1 : ink.label * dim);
  fitText(subtitle, textWidth);
  objects.push(subtitle);

  if (row.selected && !row.blockedBy) {
    const tagWidth = 68;
    const tag = scene.add.graphics();
    tag.fillStyle(accent.heroRed.hex, 1).fillRect(inner.x, inner.y, tagWidth, 16);
    objects.push(tag);
    const tagText = label(scene, inner.x + 4, inner.y + 2, "SELECTED", typeRole.label, surface.paper.hex, 1);
    objects.push(tagText);
  }
  return { objects };
}

/** One roster's list: a `McVirtualList` of plain rows, an empty-result message with Clear, and a focus stop per row. */
export function drawRosterList(
  scene: Phaser.Scene,
  rect: Rect,
  rows: readonly RosterRow[],
  scroll: ListScroll,
  focusPrefix: string,
  onClear: () => void,
  buttons: McButton[],
  stops: Map<string, FocusStop>,
  inspect: (row: RosterRow) => void,
): McVirtualList {
  if (rows.length === 0) {
    scene.add.text(rect.x + 10, rect.y + 10, "No matches.", textStyle(typeRole.body, surface.ink.hex, ink.meta));
    const clearRect: Rect = { x: rect.x + 10, y: rect.y + 34, width: 100, height: hit.target };
    buttons.push(new McButton(scene, { kind: "quiet", label: "Clear", type: typeRole.label, rect: clearRect, onClick: onClear }));
    stops.set(`${focusPrefix}-clear`, { rect: clearRect, activate: onClear });
  }
  const renderRow = (index: number, rowRect: Rect): VirtualListRow => renderRosterRow(scene, rowRect, rows[index]!);
  const onRowActivate = (index: number): void => {
    const row = rows[index];
    if (row && !row.blockedBy) row.onClick();
  };
  const list = new McVirtualList(scene, { rect, rowHeight: ROSTER_ROW_HEIGHT, count: rows.length, renderRow, scroll, onRowActivate });
  rows.forEach((row, index) => {
    const ensureVisible = (): void => list.scrollIntoView(index);
    stops.set(`${focusPrefix}:${row.id}`, {
      rect: () => list.rectFor(index),
      activate: () => (row.blockedBy ? undefined : row.onClick()),
      ...(row.inspectCardId ? { inspect: () => inspect(row) } : {}),
      ensureVisible,
    });
  });
  return list;
}

// ---------------------------------------------------------------------------------------------------------------
// The pack-shelf roster (docs/phase4-screen-gaps.md §3 W2b, the owner's decision 2026-09-18): the same searchable,
// scrollable roster idea, but grouped into one horizontally-scrolling shelf per pack (`ui/shelf-roster.ts`'s
// `McShelfRoster` over `view/roster-shelves.ts`'s `shelvesOf`), with a tall art card per item rather than a
// compact list row. Scenario select and Take your seats both draw this; only what art each item shows differs,
// so that stays a caller-supplied `artKey`/`artFit` rather than a second copy of the card chrome.
// ---------------------------------------------------------------------------------------------------------------

const SHELF_CARD_TEXT_BAND = 54;

export interface ShelfCardOptions {
  /** A texture key already resolved by the caller (`art/card-art.ts`'s `drawArt`, or a `Picture`'s own key once `ensurePictureLoaded` says it's ready) — null draws the plain parchment placeholder every card falls back to while its art is missing or still loading. */
  readonly artKey: string | null;
  readonly artFit?: "contain" | "cover";
  readonly title: string;
  /** The blocked reason or a warning wins over this when either is set (matching `renderRosterRow`'s own precedence). */
  readonly subtitle: string;
  readonly blockedBy: string | null;
  readonly warning: string | null;
  /** A small tag in the card's own top-left corner — "SELECTED" or "SEAT 2" (`renderRosterRow`'s own tag, generalized to a caller-chosen word since a hero card's tag names a seat, not just "selected"). Null draws none. */
  readonly tag: string | null;
  readonly selected: boolean;
}

/** One roster item as D02/D03's own tall "entity card": most of the card's own height is the art window, a text band along the bottom carries the title and subtitle, and a selected/blocked card reads exactly like `renderRosterRow`'s list row did (the `card` skin's own selected/unavailable state, a corner tag). */
export function renderShelfCard(scene: Phaser.Scene, rect: Rect, options: ShelfCardOptions): VirtualListRow {
  const objects: Phaser.GameObjects.GameObject[] = [];
  const g = scene.add.graphics();
  const state = options.blockedBy ? "unavailable" : options.selected ? "selected" : "rest";
  paintPanel(g, rect, "card", state);
  objects.push(g);

  const artRect: Rect = { x: rect.x + 4, y: rect.y + 4, width: rect.width - 8, height: rect.height - SHELF_CARD_TEXT_BAND - 4 };
  const art = options.artKey ? drawArt(scene, options.artKey, artRect, { fit: options.artFit ?? "contain" }) : null;
  if (art) objects.push(art);
  else {
    const placeholder = scene.add.graphics();
    placeholder.fillStyle(surface.parchment.hex, 1).fillRect(artRect.x, artRect.y, artRect.width, artRect.height);
    placeholder.lineStyle(1, surface.ink.hex, ink.meta).strokeRect(artRect.x, artRect.y, artRect.width, artRect.height);
    objects.push(placeholder);
  }

  const textY = artRect.y + artRect.height + 4;
  const textWidth = rect.width - 12;
  const dim = options.blockedBy ? ink.illegal : 1;
  const title = scene.add.text(rect.x + 6, textY, options.title, textStyle(typeRole.rowTitle, surface.ink.hex, dim));
  fitText(title, textWidth);
  objects.push(title);
  const subtitleText = options.blockedBy ?? options.warning ?? options.subtitle;
  const subtitleColor = options.blockedBy ? accent.heroRed.hex : options.warning ? signal.caution.hex : surface.ink.hex;
  const subtitle = label(scene, rect.x + 6, textY + title.height + 2, subtitleText, typeRole.label, subtitleColor, options.blockedBy || options.warning ? 1 : ink.label * dim);
  fitText(subtitle, textWidth);
  objects.push(subtitle);

  if (options.tag) {
    const tagWidth = Math.min(rect.width - 8, options.tag.length * 6 + 16);
    const tag = scene.add.graphics();
    tag.fillStyle(accent.heroRed.hex, 1).fillRect(rect.x, rect.y, tagWidth, 16);
    objects.push(tag);
    objects.push(label(scene, rect.x + 4, rect.y + 2, options.tag, typeRole.label, surface.paper.hex, 1));
  }
  return { objects };
}

/** A shelf's own header row: the pack's name, a rule, its item count, and its cover art thumbnail when one exists (`art/scenario-art.ts`'s `packCoverFor`) — plain text otherwise, per `art/README.md`'s "a shelf header draws fine without one". */
export function renderShelfHeader(scene: Phaser.Scene, shelf: Shelf<unknown>, rect: Rect, cover: Picture | null, onCoverReady: () => void): VirtualListRow {
  const objects: Phaser.GameObjects.GameObject[] = [];
  let textX = rect.x;
  if (cover) {
    const coverSize = rect.height - 6;
    const key = ensurePictureLoaded(scene, cover, onCoverReady);
    const coverRect: Rect = { x: rect.x, y: rect.y + 3, width: coverSize, height: coverSize };
    const image = key ? drawArt(scene, key, coverRect, { fit: "cover" }) : null;
    if (image) {
      objects.push(image);
      textX = rect.x + coverSize + 10;
    }
  }
  const title = scene.add.text(textX, rect.y + rect.height / 2, `${shelf.title} — ${shelf.items.length}`, textStyle(typeRole.rowTitle, surface.ink.hex)).setOrigin(0, 0.5);
  objects.push(title);
  const rule = scene.add.graphics();
  rule.lineStyle(2, surface.ink.hex, ink.meta).lineBetween(textX + title.width + 10, rect.y + rect.height / 2, rect.x + rect.width, rect.y + rect.height / 2);
  objects.push(rule);
  return { objects };
}

export interface ShelfRosterPanelOptions<T> {
  readonly scene: Phaser.Scene;
  readonly rect: Rect;
  readonly shelves: readonly Shelf<T>[];
  readonly metrics: ShelfRosterMetrics;
  /** Which screen's scroll-position cache to use (`view/shelf-scroll-cache.ts`) — a scene is destroyed and recreated on every trip to Deck check and back, so scroll position is kept outside it. */
  readonly screen: ShelfScreen;
  readonly renderCard: (item: T, shelfIndex: number, itemIndex: number, rect: Rect) => VirtualListRow;
  readonly renderHeader: (shelf: Shelf<T>, rect: Rect) => VirtualListRow;
  readonly onCardActivate: (item: T, shelfIndex: number, itemIndex: number) => void;
  readonly focusPrefix: string;
  readonly idOf: (item: T) => string;
  readonly inspect?: (item: T) => void;
  readonly onClear: () => void;
  readonly buttons: McButton[];
  readonly stops: Map<string, FocusStop>;
}

/**
 * One pack-shelf roster: the `McShelfRoster` widget itself, an empty-result message with Clear when every shelf
 * was filtered away, and one focus stop per card — the shelf-and-item-index pair a stop's `rect`/`ensureVisible`
 * need is closed over here once, rather than every caller re-deriving it from `shelves` by hand.
 *
 * Returns the roster widget so the caller can `refreshVisible()` it when art arrives, or null when there was
 * nothing to build (the empty-result message was drawn instead).
 */
export function drawShelfRosterPanel<T>(options: ShelfRosterPanelOptions<T>): McShelfRoster<T> | null {
  const { scene, rect, shelves, metrics, screen, renderCard, renderHeader, onCardActivate, focusPrefix, idOf, inspect, onClear, buttons, stops } = options;
  if (shelves.length === 0) {
    scene.add.text(rect.x + 10, rect.y + 10, "No matches.", textStyle(typeRole.body, surface.ink.hex, ink.meta));
    const clearRect: Rect = { x: rect.x + 10, y: rect.y + 34, width: 100, height: hit.target };
    buttons.push(new McButton(scene, { kind: "quiet", label: "Clear", type: typeRole.label, rect: clearRect, onClick: onClear }));
    stops.set(`${focusPrefix}-clear`, { rect: clearRect, activate: onClear });
    return null;
  }
  const cache = shelfScrollCacheFor(screen);
  const roster = new McShelfRoster<T>(scene, {
    rect,
    shelves,
    metrics,
    renderHeader,
    renderCard,
    onCardActivate,
    verticalScroll: cache.vertical,
    horizontalScrollFor: (shelfId) => cache.horizontalFor(shelfId),
  });
  shelves.forEach((shelf, shelfIndex) => {
    shelf.items.forEach((item, itemIndex) => {
      const id = idOf(item);
      stops.set(`${focusPrefix}:${id}`, {
        rect: () => roster.rectFor(shelfIndex, itemIndex),
        activate: () => onCardActivate(item, shelfIndex, itemIndex),
        ...(inspect ? { inspect: () => inspect(item) } : {}),
        ensureVisible: () => roster.scrollIntoView(shelfIndex, itemIndex),
      });
    });
  });
  return roster;
}
