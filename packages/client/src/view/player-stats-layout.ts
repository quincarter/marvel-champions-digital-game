/**
 * The Stats dashboard's tabs and rows (`scenes/player-stats.ts`): which tabs there are, and each tab's content as rows
 * of a scrolling list. The Overview packs its tiles into rows of a column grid (four across, two on a phone); a hero's
 * cards come as strips of card pictures, as many across as fit. Pure: sizes and positions only, no Phaser.
 */
import type { HeroCardsView, OverviewTile, PlayerStats, StatRow } from "./player-stats-model.js";

export type StatsTab = "overview" | "heroes" | "villains" | "side-schemes" | "devices" | "all-cards" | "cards";

export interface StatsTabEntry {
  readonly id: StatsTab;
  readonly label: string;
}

/** The tabs this player's stats have: Devices only once a game says where it was played, Cards once a hero has games. */
export function statsTabsOf(stats: PlayerStats): readonly StatsTabEntry[] {
  const has = (id: string) => stats.sections.some((section) => section.id === id);
  return [
    { id: "overview", label: "Overview" },
    ...(has("heroes") ? [{ id: "heroes" as const, label: "Heroes" }] : []),
    ...(has("villains") ? [{ id: "villains" as const, label: "Villains" }] : []),
    ...(has("side-schemes") ? [{ id: "side-schemes" as const, label: "Side schemes" }] : []),
    ...(has("devices") ? [{ id: "devices" as const, label: "Devices" }] : []),
    ...(stats.allCards ? [{ id: "all-cards" as const, label: "Cards" }] : []),
    ...(stats.heroCards.length > 0 ? [{ id: "cards" as const, label: "Cards by hero" }] : []),
  ];
}

export interface PlacedTile {
  readonly tile: OverviewTile;
  /** From the row's left edge, in px. */
  readonly x: number;
  readonly width: number;
}

export interface PlacedCard {
  readonly cardId: string;
  readonly value: string;
  readonly detail: string;
  readonly x: number;
}

export type DashRow =
  | { readonly kind: "tiles"; readonly id: string; readonly height: number; readonly tiles: readonly PlacedTile[] }
  | { readonly kind: "heading"; readonly id: string; readonly height: number; readonly title: string }
  | { readonly kind: "note"; readonly id: string; readonly height: number; readonly text: string }
  | {
      readonly kind: "stat";
      readonly id: string;
      readonly height: number;
      readonly row: Extract<StatRow, { kind: "stat" }>;
    }
  | {
      readonly kind: "aspects";
      readonly id: string;
      readonly height: number;
      readonly aspects: HeroCardsView["aspects"];
    }
  | {
      readonly kind: "cards";
      readonly id: string;
      readonly height: number;
      readonly cardWidth: number;
      readonly cardHeight: number;
      readonly cards: readonly PlacedCard[];
    };

const TILE_GAP = 14;
const CARD_GAP = 12;
/** A card picture's height over its width (63 × 88 mm). */
const CARD_RATIO = 88 / 63;

/** Columns a tile takes, of four (two on a phone). */
function spanOf(tile: OverviewTile, phone: boolean): number {
  if (phone) return tile.kind === "small" || (tile.kind === "portrait" && !tile.wide) ? 1 : 2;
  if (tile.kind === "record") return 2;
  if (tile.kind === "portrait" && tile.wide) return 2;
  return 1;
}

function heightOf(tile: OverviewTile, phone: boolean): number {
  switch (tile.kind) {
    case "record":
      return phone ? 128 : 150;
    case "split":
      return phone ? 96 : 150;
    case "figures":
      return phone ? 118 : 150;
    case "portrait":
      return phone ? (tile.wide ? 132 : 170) : 230;
    case "small":
      return phone ? 92 : 100;
  }
}

/** Packs tiles into rows, left to right, a new row when the next one does not fit. */
export function tileRowsOf(tiles: readonly OverviewTile[], width: number, phone: boolean): DashRow[] {
  const columns = phone ? 2 : 4;
  const column = (width - TILE_GAP * (columns - 1)) / columns;
  const rows: DashRow[] = [];
  let current: { tile: OverviewTile; span: number }[] = [];
  let used = 0;
  const flush = (): void => {
    if (current.length === 0) return;
    let x = 0;
    const placed = current.map(({ tile, span }) => {
      const w = column * span + TILE_GAP * (span - 1);
      const entry = { tile, x, width: w };
      x += w + TILE_GAP;
      return entry;
    });
    rows.push({
      kind: "tiles",
      id: `tiles:${rows.length}`,
      height: Math.max(...current.map(({ tile }) => heightOf(tile, phone))) + TILE_GAP,
      tiles: placed,
    });
    current = [];
    used = 0;
  };
  for (const tile of tiles) {
    const span = spanOf(tile, phone);
    if (used + span > columns) flush();
    current.push({ tile, span });
    used += span;
  }
  flush();
  return rows;
}

/** Card pictures in strips, as many across as fit `width`. */
export function cardRowsOf(
  groupId: string,
  cards: readonly { readonly cardId: string; readonly value: string; readonly detail: string }[],
  width: number,
  phone: boolean,
): DashRow[] {
  const cardWidth = phone ? 100 : 118;
  const cardHeight = Math.round(cardWidth * CARD_RATIO);
  const perRow = Math.max(1, Math.floor((width + CARD_GAP) / (cardWidth + CARD_GAP)));
  const rows: DashRow[] = [];
  for (let i = 0; i < cards.length; i += perRow) {
    rows.push({
      kind: "cards",
      id: `${groupId}:strip:${i / perRow}`,
      height: cardHeight + 50,
      cardWidth,
      cardHeight,
      cards: cards.slice(i, i + perRow).map((card, j) => ({ ...card, x: j * (cardWidth + CARD_GAP) })),
    });
  }
  return rows;
}

const statHeight = (phone: boolean): number => (phone ? 74 : 58);
const noteHeight = (phone: boolean): number => (phone ? 52 : 40);

/** One tab's rows. `heroIndex` picks the hero on Cards by hero (wrapped into range). */
export function dashboardRowsOf(
  stats: PlayerStats,
  tab: StatsTab,
  heroIndex: number,
  width: number,
  phone: boolean,
): DashRow[] {
  if (tab === "overview") {
    const rows = tileRowsOf(stats.overview.tiles, width, phone);
    if (stats.overview.note)
      rows.push({ kind: "note", id: "ov:note", height: noteHeight(phone) + 12, text: stats.overview.note });
    return rows;
  }
  if (tab === "all-cards") {
    const rows: DashRow[] = [];
    for (const group of stats.allCards?.groups ?? []) {
      rows.push({ kind: "heading", id: `${group.id}:head`, height: phone ? 40 : 44, title: group.title });
      rows.push(...cardRowsOf(group.id, group.cards, width, phone));
    }
    return rows;
  }
  if (tab === "cards") {
    const hero = heroAt(stats, heroIndex);
    if (!hero) return [];
    const rows: DashRow[] = [];
    if (hero.aspects.length > 0)
      // One line per aspect on a phone; side by side on a wider screen.
      rows.push({
        kind: "aspects",
        id: "aspects",
        height: phone ? 14 + 34 * hero.aspects.length : 48,
        aspects: hero.aspects,
      });
    if (hero.note) rows.push({ kind: "note", id: "cards:note", height: noteHeight(phone), text: hero.note });
    for (const group of hero.groups) {
      rows.push({ kind: "heading", id: `${group.id}:head`, height: phone ? 40 : 44, title: group.title });
      rows.push(...cardRowsOf(group.id, group.cards, width, phone));
    }
    return rows;
  }
  const section = stats.sections.find((s) => s.id === tab);
  if (!section) return [];
  return section.rows.map((row): DashRow =>
    row.kind === "note"
      ? { kind: "note", id: row.id, height: noteHeight(phone), text: row.text }
      : { kind: "stat", id: row.id, height: statHeight(phone), row },
  );
}

/** The hero at `index`, wrapped into range; undefined with no heroes. */
export function heroAt(stats: PlayerStats, index: number): HeroCardsView | undefined {
  const count = stats.heroCards.length;
  return count === 0 ? undefined : stats.heroCards[((index % count) + count) % count];
}
