/**
 * The room deck picker's two panels as typed models for `@mc/ui`'s `mc-deck-grid` and `mc-deck-details`: the picker's
 * decks (a grid of tiles or a list of rows) and one deck's details. Plain data in, plain data out (the scene hands them
 * to the elements); nothing here draws. Words come already translated.
 */
import type { CoreAspect } from "@mc/content";
import type { BarChartBar, DeckDetailsModel, DeckGridItem, DeckGridModel, PictureSource, TextLine } from "@mc/ui";
import type { PackLeases } from "../art/pack-art.js";
import { currentCardsById } from "../content/pool.js";
import { t, tPlural } from "../i18n/translate.js";
import { signal } from "../tokens.js";
import { aspectStampsOf } from "../view/aspect-stamp.js";
import { wrapChipsToRows } from "../view/chip-layout.js";
import type { DeckDetails } from "../view/room-deck-details-model.js";
import { pickerGridLayout, tileTitleOf } from "../view/room-deck-picker-layout.js";
import type { PickerRow } from "../view/room-deck-picker-model.js";
import type { FormFactor } from "../view/layout.js";
import { heroPictureOf } from "./hero-picture.js";
import { sheetColor } from "./sheet-builder.js";

const hex6 = (hex: number): string => `#${hex.toString(16).padStart(6, "0")}`;

/** A hero's face as the picture the elements draw: the hero's own picture, or the identity's scan, on the plain ground. */
export function heroPictureSource(cardId: string, leases: PackLeases): PictureSource {
  const picture = heroPictureOf(currentCardsById().get(cardId), leases);
  return {
    src: picture.src,
    fill: sheetColor(signal.spent.hex, "fill"),
    cover: picture.cover,
    ...(picture.retry !== undefined ? { retry: picture.retry } : {}),
  };
}

/** The words under a deck's name: why it cannot be picked, that it is in the seat, or how many cards it has. Words, never a colour. */
export function deckStatusOf(
  row: PickerRow,
  plain: string | null,
): { readonly text: string | null; readonly bold: boolean } {
  if (row.checking) return { text: t("room.picker.checking"), bold: false };
  if (!row.seatable) return { text: t("room.picker.notReady", { reason: row.blockedReason ?? "" }), bold: true };
  if (row.current) return { text: t("room.picker.current"), bold: true };
  return { text: plain, bold: false };
}

const line = (text: string, size: number, height: number, extra: Partial<TextLine> = {}): TextLine => ({
  text,
  size,
  height,
  ...extra,
});

/** One deck as a tile or a row. */
function itemOf(row: PickerRow, mode: "grid" | "list", selected: string | null, leases: PackLeases): DeckGridItem {
  const picture = heroPictureSource(row.cardId, leases);
  const heavy = row.current || row.id === selected;
  if (mode === "grid") {
    const aspects = row.option.deck.aspects.filter((a): a is CoreAspect =>
      ["aggression", "justice", "leadership", "protection", "basic", "pool"].includes(a as string),
    );
    const status = deckStatusOf(row, tPlural("room.deck.cards", row.cards));
    const who = [row.heroName, row.aspects].filter((p) => p !== "").join(" · ");
    return {
      id: row.id,
      cardId: row.cardId,
      picture,
      heavy: row.id === selected || row.current,
      stripe: aspectStampsOf(aspects).map((stamp) => hex6(stamp.fill)),
      lines: [
        line(tileTitleOf(row.name), 14, 19, { weight: 800 }),
        line(who, 12, 16, { opacity: 0.85 }),
        line(status.text ?? "", 12, 16, { opacity: status.bold ? 1 : 0.85, weight: status.bold ? 700 : 400 }),
      ],
    };
  }
  const detail = [row.heroName, row.aspects, tPlural("room.deck.cards", row.cards)].filter((p) => p !== "").join(" · ");
  const status = deckStatusOf(row, null);
  return {
    id: row.id,
    cardId: row.cardId,
    picture,
    heavy,
    stripe: [],
    lines: [
      line(tileTitleOf(row.name), 15, 21, { weight: 800 }),
      line(detail, 12, 17, { opacity: 0.85 }),
      ...(status.text
        ? [line(status.text, 12, 17, { opacity: status.bold ? 1 : 0.85, weight: status.bold ? 700 : 400 })]
        : []),
    ],
    pick: {
      label: t("room.picker.choose"),
      look: row.seatable ? "primary" : "secondary",
      ...(row.seatable ? {} : { disabled: row.blockedReason ?? true }),
    },
  };
}

/** The decks panel: tiles or rows for `rows`, or the words that stand in for them. `contentWidth` is what the items take. */
export function deckGridModelOf(args: {
  readonly rows: readonly PickerRow[];
  /** The decks are not known yet. */
  readonly loading: boolean;
  /** There are no decks at all (as against none matching the search). */
  readonly none: boolean;
  readonly mode: "grid" | "list";
  readonly selected: string | null;
  readonly contentWidth: number;
  readonly formFactor: FormFactor;
  readonly leases: PackLeases;
}): DeckGridModel {
  const { rows, loading, none, mode, selected, contentWidth, formFactor, leases } = args;
  const layout = pickerGridLayout(contentWidth, formFactor);
  const emptyText = loading
    ? t("room.state.connecting")
    : rows.length === 0
      ? t(none ? "room.picker.noDecks" : "room.picker.empty")
      : null;
  return {
    mode,
    columns: layout.columns,
    gap: layout.gap,
    artHeight: layout.artHeight,
    contentWidth,
    items: emptyText === null ? rows.map((row) => itemOf(row, mode, selected, leases)) : [],
    emptyText,
    loading,
  };
}

/** A deck's details panel: `contentWidth` is the body's column. */
export function deckDetailsModelOf(details: DeckDetails, contentWidth: number, leases: PackLeases): DeckDetailsModel {
  const topCounts = new Set(
    [...new Set(details.curve.map((bar) => bar.count))]
      .filter((count) => count > 0)
      .sort((a, b) => b - a)
      .slice(0, 2),
  );
  const bars: BarChartBar[] = details.curve.map((bar) => ({
    label: bar.label,
    count: bar.count,
    highlight: topCounts.has(bar.count),
  }));
  const status = details.checking
    ? t("room.picker.checking")
    : !details.seatable
      ? t("room.picker.notReady", { reason: details.blockedReason ?? "" })
      : details.current
        ? t("room.picker.current")
        : null;
  const tiles = details.tiles.map((tile) => ({ id: tile.id, text: `${tile.label} ${tile.count}` }));
  return {
    cardId: details.cardId,
    picture: heroPictureSource(details.cardId, leases),
    artHeight: Math.round(Math.min(200, Math.max(110, contentWidth * 0.5))),
    contentWidth,
    title: details.title,
    who: [details.heroName, details.aspects].filter((p) => p !== "").join(" · "),
    counts: [details.countText, details.averageCostText].filter((p): p is string => p !== null).join(" · "),
    status,
    missing: details.missing > 0 ? tPlural("room.picker.missing", details.missing) : null,
    statsHeading: t("room.picker.statsHeading"),
    cardsHeading: t("room.picker.cardsHeading"),
    bars,
    tileRows: wrapChipsToRows(tiles, contentWidth),
    groups: details.groups
      .filter((group) => group.entries.length > 0)
      .map((group) => ({
        label: `${group.label} · ${group.count}`,
        entries: group.entries.map((entry) => ({
          name: entry.name,
          quantity: entry.quantity,
          hover: entry.cardId as string,
        })),
      })),
    use: {
      label: t("room.picker.use"),
      look: details.seatable ? "primary" : "secondary",
      ...(details.seatable ? {} : { disabled: details.blockedReason ?? true }),
    },
    edit: details.edit
      ? { label: t(details.edit.copy ? "room.picker.editCopy" : "room.picker.edit"), look: "secondary" }
      : null,
    close: { label: t("room.picker.close"), look: "secondary" },
  };
}
