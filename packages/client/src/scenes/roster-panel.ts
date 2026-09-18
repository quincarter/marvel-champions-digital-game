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
import { accent, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { McButton, McTextInput, fitText, label, paintPanel } from "../ui/widgets.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import type { ListScroll } from "../view/list-scroll.js";
import { CHIP_GAP } from "../view/chip-layout.js";
import type { Rect } from "../view/layout.js";
import { ROSTER_ROW_HEIGHT } from "../view/roster-block-layout.js";
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
