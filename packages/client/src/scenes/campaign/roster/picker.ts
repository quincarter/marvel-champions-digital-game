/**
 * The seat picker, drawn over the roster in the same panel: a scrim that closes on a tap (never on the lift of a drag), a
 * panel with the seat's title, a close button, "Remove from this seat", the search field and the list of decks (the
 * recommended heroes under their own heading, then everyone else, then the ones that cannot be seated). The list is one
 * native scroller of `picker-row.ts` rows; only a tap on a row seats it, never the end of a swipe.
 */
import { POOL_VERSION, currentCardsById } from "../../../content/pool.js";
import type { SheetBuilder } from "../../../dom/sheet-builder.js";
import { bangers, type campaignFrame } from "../../../ui/campaign-chrome.js";
import { ink, surface, typeRole } from "../../../tokens.js";
import { t } from "../../../i18n/translate.js";
import { unlocks } from "../../../progression/progression.js";
import {
  pickerEntriesOf,
  pickerRecommendationsOf,
  rosterDeckOptions,
  type PickerEntry,
} from "../../../view/campaign-roster-model.js";
import { clipToView, revealDelta } from "../../../view/focus-list.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../../../view/card-hover.js";
import type { Rect } from "../../../view/layout.js";
import { PICKER_LIST, PICKER_SEARCH, type PickerRowPlace, type RosterCtx } from "./context.js";
import { rosterPairCatalog } from "./pairs.js";
import { drawPickerHeading, drawPickerRow, pickerRowHeight } from "./picker-row.js";

const ROW_GAP = 8;

export function drawPicker(
  ctx: RosterCtx,
  b: SheetBuilder,
  frame: ReturnType<typeof campaignFrame>,
  seatNumber: number,
): void {
  const { state } = ctx;
  const panelWidth = Math.min(460, frame.width - 32);
  const panelHeight = Math.min(560, frame.height - 32);
  const panel: Rect = {
    x: (frame.width - panelWidth) / 2,
    y: (frame.height - panelHeight) / 2,
    width: panelWidth,
    height: panelHeight,
  };
  // The scrim takes every press, so nothing under the picker answers while it is open; only a tap on it closes, never the
  // lift of a drag through the list (issue #257).
  const screen: Rect = { x: 0, y: 0, width: frame.width, height: frame.height };
  b.box(screen, { fill: surface.ink.hex, fillAlpha: 0.6 });
  b.tap("roster-picker:scrim", screen);
  ctx.actions.set("roster-picker:scrim", () => ctx.closePicker());
  b.box(panel, { fill: surface.paper.hex });
  b.box(panel, { stroke: surface.ink.hex, strokeWidth: 3 });
  b.text(
    panel.x + 20,
    panel.y + 18,
    t("roster.picker.title", { number: seatNumber }).toLocaleUpperCase(),
    bangers(20, 1),
    {
      color: surface.ink.hex,
    },
  );

  const closeRect: Rect = { x: panel.x + panel.width - 44, y: panel.y + 14, width: 30, height: 30 };
  b.button({
    key: "pick-close",
    rect: closeRect,
    label: "✕",
    look: "secondary",
    type: typeRole.rowTitle,
    aria: t("roster.picker.close"),
  });
  ctx.actions.set("pick-close", () => ctx.closePicker());
  ctx.stops.set("pick-close", { rect: closeRect, activate: () => ctx.closePicker() });

  let y = panel.y + 58;
  const rowWidth = panel.width - 40;
  if (state.seats[seatNumber - 1]) {
    const removeRect: Rect = { x: panel.x + 20, y, width: rowWidth, height: 40 };
    const remove = (): void => ctx.removeSeat(seatNumber);
    b.button({
      key: "pick-remove",
      rect: removeRect,
      label: t("roster.picker.remove").toLocaleUpperCase(),
      look: "secondary",
      type: bangers(13),
      row: true,
    });
    ctx.actions.set("pick-remove", remove);
    ctx.stops.set("pick-remove", { rect: removeRect, activate: remove });
    y += 50;
  }

  const options = rosterDeckOptions(state.seats, seatNumber, state.savedDecks, POOL_VERSION, (deck) =>
    unlocks().deckLock(deck),
  );
  if (options.length > 0) {
    const searchRect: Rect = { x: panel.x + 20, y, width: rowWidth, height: 40 };
    b.search(searchRect, {
      key: PICKER_SEARCH,
      value: state.pickerQuery,
      placeholder: t("roster.picker.search"),
      clearLabel: t("deckPicker.searchClear"),
      maxLength: 80,
      debounce: 140,
      escapeClears: true,
    });
    ctx.stops.set(PICKER_SEARCH, { rect: searchRect, activate: () => ctx.focusSearch() });
    y += 50;
  }

  const listRect: Rect = { x: panel.x + 20, y, width: rowWidth, height: panel.y + panel.height - 16 - y };
  const note = (text: string): void => {
    b.text(listRect.x, listRect.y + 4, text, typeRole.body, {
      color: surface.ink.hex,
      alpha: ink.secondary,
      wrapWidth: rowWidth,
    });
  };
  state.pickerView = { panel, listRect, thumbSide: 0, rows: [], content: 0 };
  if (options.length === 0) {
    note(t("roster.picker.none"));
    return;
  }

  // From seat 2 on, with someone else seated: a pinned "Recommended" group, then everyone else; both A to Z.
  const recsKey = [seatNumber, ...state.seats.map((deck) => deck?.id ?? "-"), options.length].join("|");
  if (state.pickerRecs?.key !== recsKey) {
    state.pickerRecs = {
      key: recsKey,
      recs: pickerRecommendationsOf(state.seats, seatNumber, options, currentCardsById(), rosterPairCatalog()),
    };
  }
  ctx.syncSearch(options);
  const entries = pickerEntriesOf(
    seatNumber,
    options,
    state.pickerRecs.recs,
    currentCardsById(),
    "",
    state.pickerQuery.trim() === "" ? null : state.pickerRanking,
  );
  if (entries.length === 0) {
    note(t("roster.picker.noMatch"));
    return;
  }
  // A recommended row has a third line for its reason, so a list with the group is a little taller throughout.
  const rowHeight = state.pickerRecs.recs.length > 0 ? 78 : 64;
  const heights = entries.map((entry) => pickerRowHeight(b, entry, options, rowWidth, rowHeight));
  const tops: number[] = [];
  let content = 0;
  for (const height of heights) {
    tops.push(content);
    content += height + ROW_GAP;
  }
  const thumbSide = rowHeight - 16;

  const places: PickerRowPlace[] = [];
  let recCount = 0;
  const keys: (string | null)[] = entries.map((entry) =>
    entry.kind === "option" ? (entry.recommended ? `pick-rec-${recCount++}` : `pick-${entry.optionIndex}`) : null,
  );
  b.scroll(PICKER_LIST, listRect, content, (inner) => {
    entries.forEach((entry: PickerEntry, entryIndex) => {
      const rect: Rect = { x: listRect.x, y: tops[entryIndex]!, width: rowWidth, height: heights[entryIndex]! };
      if (entry.kind === "heading") {
        drawPickerHeading(inner, rect, entry.text);
        return;
      }
      const option = options[entry.optionIndex]!;
      const drawn = drawPickerRow(ctx, inner, entry, option, rect, rowHeight);
      const key = keys[entryIndex]!;
      inner.tap(key, rect, { inspect: true });
      ctx.actions.set(key, () => ctx.pickDeck(seatNumber, option));
      ctx.inspects.set(key, () => ctx.inspectIdentity(option.identityId));
      places.push({
        entryIndex,
        top: tops[entryIndex]!,
        height: heights[entryIndex]!,
        identityId: option.identityId,
        name: drawn.name,
        picture: drawn.picture.src !== null,
        badges: option.stamps.map((stamp) => ({ label: stamp.label, fill: stamp.fill })),
      });
    });
  });
  state.pickerView = { panel, listRect, thumbSide, rows: places, content };

  // Stops for every option, not just the visible ones, so Tab reaches a deck scrolled off-screen.
  entries.forEach((entry, entryIndex) => {
    const key = keys[entryIndex];
    if (entry.kind !== "option" || key === null || key === undefined) return;
    const option = options[entry.optionIndex]!;
    const contentRect = (): Rect => ({
      x: listRect.x,
      y: tops[entryIndex]!,
      width: rowWidth,
      height: heights[entryIndex]!,
    });
    ctx.stops.set(key, {
      rect: () => clipToView(pickerRowOnScreen(ctx, contentRect()), listRect),
      view: listRect,
      activate: () => ctx.pickDeck(seatNumber, option),
      inspect: () => ctx.inspectIdentity(option.identityId),
      ensureVisible: () => {
        const scroller = ctx.scroller();
        if (!scroller) return;
        const delta = revealDelta(contentRect(), {
          x: 0,
          y: scroller.scrollTop,
          width: rowWidth,
          height: listRect.height,
        });
        if (delta !== 0) scroller.scrollTop += delta;
      },
    });
  });
}

/** A content-space rect of the picker's list as it is on the screen now. */
function pickerRowOnScreen(ctx: RosterCtx, content: Rect): Rect {
  const view = ctx.state.pickerView;
  const scrolled = ctx.scroller()?.scrollTop ?? ctx.state.pickerTop;
  return { ...content, y: (view?.listRect.y ?? 0) + content.y - scrolled };
}

/** Each option row's thumbnail opens the hover popover with the hero's identity card (desktop mouse only). */
export function pickerHoverCards(ctx: RosterCtx): ReadonlyMap<string, HoverCardIdRect> {
  const found = new Map<string, HoverCardIdRect>();
  const view = ctx.state.pickerView;
  if (!view) return found;
  for (const row of view.rows) {
    const rowRect = pickerRowOnScreen(ctx, {
      x: view.listRect.x,
      y: row.top,
      width: view.listRect.width,
      height: row.height,
    });
    const thumb = clipHoverRect(
      { x: rowRect.x + 8, y: rowRect.y + 8, width: view.thumbSide, height: view.thumbSide },
      view.listRect,
    );
    if (thumb)
      found.set(hoverSlotOf(row.identityId, `pick${row.entryIndex}`), {
        ...thumb,
        cardId: row.identityId,
        through: true,
      });
  }
  return found;
}

/** The picker's rows as the e2e hooks read them (dev only): name, whether the picture is drawn, the badges, the row's box on screen. */
export function pickerDebugRows(ctx: RosterCtx): {
  name: string;
  picture: boolean;
  badges: readonly { label: string; fill: number }[];
  rect: Rect;
}[] {
  const view = ctx.state.pickerView;
  if (!view) return [];
  return view.rows.map((row) => ({
    name: row.name,
    picture: row.picture,
    badges: row.badges,
    rect: pickerRowOnScreen(ctx, { x: view.listRect.x, y: row.top, width: view.listRect.width, height: row.height }),
  }));
}
