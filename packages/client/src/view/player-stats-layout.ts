/**
 * The Stats dashboard's tabs and rows (`scenes/player-stats.ts`): which tabs there are, and each tab's content as rows
 * of a scrolling list. The Overview packs its tiles into rows of a column grid (four across, two on a phone); on a wide
 * screen the favorite hero stands tall at the left with the other tiles stacked beside it (`overviewRowsOf`). A hero's
 * cards come as strips of card pictures, as many across as fit. Pure: sizes and positions only, no Phaser.
 */
import type { Rect } from "./layout.js";
import type { MatchupRow } from "./matchup-grid.js";
import type {
  AspectShare,
  HeroCardsView,
  OverviewTile,
  PlayerStats,
  StatRow,
  StatsSection,
} from "./player-stats-model.js";

export type StatsTab =
  | "overview"
  | "heroes"
  | "villains"
  | "matchups"
  | "aspects"
  | "encounter"
  | "records"
  | "all-cards"
  | "decks"
  | "cards";

/** The sections a list tab shows, in order; a tab with more than one heads each. */
const TAB_SECTIONS: Partial<Record<StatsTab, readonly string[]>> = {
  heroes: ["heroes"],
  villains: ["villains"],
  aspects: ["aspects"],
  encounter: ["encounter", "side-schemes"],
  records: ["records", "devices"],
};

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
    ...(stats.matchups ? [{ id: "matchups" as const, label: "Matchups" }] : []),
    ...(has("aspects") ? [{ id: "aspects" as const, label: "Aspects" }] : []),
    // Side schemes and modular sets share Encounter; devices sit under Records.
    ...(has("side-schemes") || has("encounter") ? [{ id: "encounter" as const, label: "Encounter" }] : []),
    ...(has("records") || has("devices") ? [{ id: "records" as const, label: "Records" }] : []),
    ...(stats.allCards ? [{ id: "all-cards" as const, label: "Cards" }] : []),
    ...(stats.decks.length > 0 ? [{ id: "decks" as const, label: "Decks" }] : []),
    ...(stats.heroCards.length > 0 ? [{ id: "cards" as const, label: "Cards by hero" }] : []),
  ];
}

export interface PlacedTile {
  readonly tile: OverviewTile;
  /** From the row's left edge, in px. */
  readonly x: number;
  readonly width: number;
  /** From the row's top, in px, for a tile stacked below others in a showcase row; absent: the row's top. */
  readonly y?: number;
  /** The tile's own height; absent: the row's, less the gap under it. */
  readonly height?: number;
  /** The favorite hero standing tall, its art filling the tile (the wide Overview's showcase). */
  readonly tall?: boolean;
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
  /** The Aspects tab's donut: each aspect's share of your games, in its own color, with a legend. */
  | { readonly kind: "donut"; readonly id: string; readonly height: number; readonly shares: readonly AspectShare[] }
  | {
      readonly kind: "aspects";
      readonly id: string;
      readonly height: number;
      readonly aspects: HeroCardsView["aspects"];
    }
  /** A row of the Matchups tab's Shelves or Focus view. */
  | { readonly kind: "matchup"; readonly id: string; readonly height: number; readonly matchup: MatchupRow }
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
  return packTiles(tiles, width, phone ? 2 : 4, phone, "tiles");
}

function packTiles(
  tiles: readonly OverviewTile[],
  width: number,
  columns: number,
  phone: boolean,
  idPrefix: string,
): Extract<DashRow, { kind: "tiles" }>[] {
  const column = (width - TILE_GAP * (columns - 1)) / columns;
  const rows: Extract<DashRow, { kind: "tiles" }>[] = [];
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
      id: `${idPrefix}:${rows.length}`,
      height: Math.max(...current.map(({ tile }) => heightOf(tile, phone))) + TILE_GAP,
      tiles: placed,
    });
    current = [];
    used = 0;
  };
  for (const tile of tiles) {
    const span = Math.min(columns, spanOf(tile, phone));
    if (used + span > columns) flush();
    current.push({ tile, span });
    used += span;
  }
  flush();
  return rows;
}

/** The narrowest row the Overview stands the favorite hero tall in; narrower (a phone, a portrait tablet) keeps the grid. */
export const SHOWCASE_MIN_WIDTH = 960;
/** The tall hero's width, as a share of the row, within these bounds. */
const SHOWCASE_SHARE = 0.3;
const SHOWCASE_MIN_HERO = 300;
const SHOWCASE_MAX_HERO = 440;

/**
 * The Overview's tile rows. On a row at least `SHOWCASE_MIN_WIDTH` wide, with a favorite hero, the hero stands tall at
 * the far left and the other tiles stack beside it, three columns across (the record over two of them), as one tall
 * row; tiles that would make the stack much taller than the hero's portrait continue below in the four-column grid.
 * Otherwise the plain grid (`tileRowsOf`).
 */
export function overviewRowsOf(tiles: readonly OverviewTile[], width: number, phone: boolean): DashRow[] {
  const hero = tiles.find((tile) => tile.kind === "portrait" && tile.wide);
  if (phone || !hero || width < SHOWCASE_MIN_WIDTH) return tileRowsOf(tiles, width, phone);
  const heroWidth = Math.round(Math.min(SHOWCASE_MAX_HERO, Math.max(SHOWCASE_MIN_HERO, width * SHOWCASE_SHARE)));
  const sideX = heroWidth + TILE_GAP;
  const rest = tiles.filter((tile) => tile !== hero);
  const sideRows = packTiles(rest, width - sideX, 3, false, "showcase");
  // The stack may run a little past a card's proportions before the rest goes below, so the art stays a portrait.
  const maxStack = Math.round(heroWidth * 1.9);
  const beside: typeof sideRows = [];
  let stack = 0;
  for (const row of sideRows) {
    if (beside.length > 0 && stack + row.height > maxStack) break;
    beside.push(row);
    stack += row.height;
  }
  const height = Math.max(Math.round(heroWidth * 1.25) + TILE_GAP, stack);
  const placed: PlacedTile[] = [{ tile: hero, x: 0, y: 0, width: heroWidth, height: height - TILE_GAP, tall: true }];
  let y = 0;
  for (const row of beside) {
    for (const tile of row.tiles) placed.push({ ...tile, x: sideX + tile.x, y, height: row.height - TILE_GAP });
    y += row.height;
  }
  const below = rest.filter((tile) => !beside.some((row) => row.tiles.some((p) => p.tile === tile)));
  return [{ kind: "tiles", id: "tiles:showcase", height, tiles: placed }, ...tileRowsOf(below, width, false)];
}

/** Card pictures in strips, as many across as fit `width`. */
export function cardRowsOf(
  groupId: string,
  cards: readonly { readonly cardId: string; readonly value: string; readonly detail: string }[],
  width: number,
  phone: boolean,
  /** Room for a longer detail line under each card (the Decks tab's adds the draws). */
  extraHeight = 0,
): DashRow[] {
  const cardWidth = phone ? 100 : 118;
  const cardHeight = Math.round(cardWidth * CARD_RATIO);
  const perRow = Math.max(1, Math.floor((width + CARD_GAP) / (cardWidth + CARD_GAP)));
  const rows: DashRow[] = [];
  for (let i = 0; i < cards.length; i += perRow) {
    rows.push({
      kind: "cards",
      id: `${groupId}:strip:${i / perRow}`,
      height: cardHeight + 50 + extraHeight,
      cardWidth,
      cardHeight,
      cards: cards.slice(i, i + perRow).map((card, j) => ({ ...card, x: j * (cardWidth + CARD_GAP) })),
    });
  }
  return rows;
}

const statHeight = (phone: boolean): number => (phone ? 74 : 58);
/** A stat row with a loss bar under its lines. */
const lossStatHeight = (phone: boolean): number => (phone ? 112 : 84);
const noteHeight = (phone: boolean): number => (phone ? 52 : 40);

/**
 * The picture leading a stat row about a card, inside the row's `box`. The card hover opens on this rect, not the
 * row's: the popover grows from the rect it is given, so a row-wide target would blow the card up to fill the screen.
 */
export function statRowPicture(box: Rect): Rect {
  const height = box.height - 10;
  return { x: box.x + 6, y: box.y + 5, width: Math.round((height * 63) / 88), height };
}

/** One tab's rows. `heroIndex` picks the hero on Cards by hero (wrapped into range). */
export function dashboardRowsOf(
  stats: PlayerStats,
  tab: StatsTab,
  heroIndex: number,
  width: number,
  phone: boolean,
  /** Leaves each hero's own cards out of Cards and Cards by hero (the "Hide hero cards" toggle). */
  hideSignature = false,
): DashRow[] {
  const shown = (cards: HeroCardsView["groups"][number]["cards"]) =>
    hideSignature ? cards.filter((card) => !card.signature) : cards;
  if (tab === "overview") {
    const rows = overviewRowsOf(stats.overview.tiles, width, phone);
    if (stats.overview.note)
      rows.push({ kind: "note", id: "ov:note", height: noteHeight(phone) + 12, text: stats.overview.note });
    return rows;
  }
  if (tab === "all-cards") {
    const rows: DashRow[] = [];
    for (const group of stats.allCards?.groups ?? []) {
      const cards = shown(group.cards);
      if (cards.length === 0) continue;
      rows.push({ kind: "heading", id: `${group.id}:head`, height: phone ? 40 : 44, title: group.title });
      rows.push(...cardRowsOf(group.id, cards, width, phone));
    }
    return rows;
  }
  if (tab === "decks") {
    // Each deck: a row for its record (the hero's picture, which opens the hover), then its most played cards.
    const rows: DashRow[] = [];
    for (const deck of stats.decks) {
      rows.push({
        kind: "stat",
        id: `deck:${deck.id}`,
        height: statHeight(phone),
        row: {
          kind: "stat",
          id: `deck:${deck.id}`,
          label: deck.name,
          value: `${deck.wins}–${deck.losses}`,
          detail: deck.detail,
          cardId: deck.identityCardId,
        },
      });
      const cards = shown(deck.cards);
      if (cards.length > 0) rows.push(...cardRowsOf(`deck:${deck.id}`, cards, width, phone, 16));
      else
        rows.push({
          kind: "note",
          id: `deck:${deck.id}:none`,
          height: noteHeight(phone),
          text:
            deck.tracked === 0
              ? "Card stats start with the next game you finish with this deck."
              : "No cards played from this deck yet.",
        });
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
      const cards = shown(group.cards);
      if (cards.length === 0) continue;
      rows.push({ kind: "heading", id: `${group.id}:head`, height: phone ? 40 : 44, title: group.title });
      rows.push(...cardRowsOf(group.id, cards, width, phone));
    }
    return rows;
  }
  const sections = (TAB_SECTIONS[tab] ?? []).flatMap((id) => stats.sections.filter((s) => s.id === id));
  const rows: DashRow[] =
    tab === "aspects" && stats.aspects.length > 0
      ? [
          {
            kind: "donut",
            id: "aspects:donut",
            height: phone ? 40 + 26 * stats.aspects.length + 150 : 220,
            shares: stats.aspects,
          },
        ]
      : [];
  for (const section of sections) {
    if (sections.length > 1)
      rows.push({ kind: "heading", id: `${section.id}:head`, height: phone ? 40 : 44, title: section.title });
    rows.push(...statRowsOf(section, phone));
  }
  return rows;
}

/** A section's own rows (no heading): stat rows, and the notes it carries. */
function statRowsOf(section: StatsSection, phone: boolean): DashRow[] {
  return section.rows.map((row): DashRow =>
    row.kind === "note"
      ? { kind: "note", id: row.id, height: noteHeight(phone), text: row.text }
      : { kind: "stat", id: row.id, height: row.losses ? lossStatHeight(phone) : statHeight(phone), row },
  );
}

/** Everyone's tab (`view/global-stats-ui.ts`): the notes for the load's state, then the section's rows. */
export function globalRowsOf(notes: readonly string[], section: StatsSection | null, phone: boolean): DashRow[] {
  return [
    ...notes.map((text, i): DashRow => ({ kind: "note", id: `global:note:${i}`, height: noteHeight(phone), text })),
    ...(section ? statRowsOf(section, phone) : []),
  ];
}

/** The hero at `index`, wrapped into range; undefined with no heroes. */
export function heroAt(stats: PlayerStats, index: number): HeroCardsView | undefined {
  const count = stats.heroCards.length;
  return count === 0 ? undefined : stats.heroCards[((index % count) + count) % count];
}
