/**
 * What each Your stats tab holds, in reading order, as blocks the page's elements draw (`scenes/player-stats.ts`,
 * `view/player-stats-page-model.ts` words and colours them). The Overview is its tiles and the older-games note; a hero's
 * cards and every hero's cards are strips of card pictures under headings; the Aspects tab opens with the donut; the other
 * list tabs are their sections' rows (a tab with more than one section heads each). Pure, and with no layout: how many
 * cards fit across, which tile stands where, are CSS.
 */
import type {
  AspectShare,
  HeroCardsView,
  OverviewTile,
  PlayerStats,
  StatRow,
  StatsSection,
} from "./player-stats-model.js";
import { heroAt, type StatsTab } from "./player-stats-tabs.js";

/** The sections a list tab shows, in order; a tab with more than one heads each. */
const TAB_SECTIONS: Partial<Record<StatsTab, readonly string[]>> = {
  heroes: ["heroes"],
  villains: ["villains"],
  aspects: ["aspects"],
  encounter: ["encounter", "side-schemes"],
  records: ["records", "devices"],
};

export interface DashCard {
  readonly cardId: string;
  readonly value: string;
  readonly detail: string;
}

export type DashBlock =
  | { readonly kind: "tiles"; readonly id: string; readonly tiles: readonly OverviewTile[] }
  | { readonly kind: "heading"; readonly id: string; readonly title: string }
  | { readonly kind: "note"; readonly id: string; readonly text: string }
  | { readonly kind: "stat"; readonly id: string; readonly row: Extract<StatRow, { kind: "stat" }> }
  /** The Aspects tab's donut: each aspect's share of your games, in its own color, with a legend. */
  | { readonly kind: "donut"; readonly id: string; readonly shares: readonly AspectShare[] }
  | { readonly kind: "aspects"; readonly id: string; readonly aspects: HeroCardsView["aspects"] }
  /** A strip of card pictures. Its id is `<group>:strip:0`: the card stops are `card:<id>:<card>`. */
  | { readonly kind: "cards"; readonly id: string; readonly cards: readonly DashCard[] };

/** One tab's blocks. `heroIndex` picks the hero on Cards by hero (wrapped into range). */
export function dashboardBlocksOf(
  stats: PlayerStats,
  tab: StatsTab,
  heroIndex: number,
  /** Leaves each hero's own cards out of Cards and Cards by hero (the "Hide hero cards" toggle). */
  hideSignature = false,
  /** What a deck with no card numbers, or none played, says (translated by the caller). */
  notes: { readonly untracked: string; readonly none: string } = {
    untracked: "Card stats start with the next game you finish with this deck.",
    none: "No cards played from this deck yet.",
  },
): DashBlock[] {
  const shown = (cards: readonly (DashCard & { readonly signature?: true })[]) =>
    hideSignature ? cards.filter((card) => !card.signature) : cards;
  if (tab === "overview") {
    const blocks: DashBlock[] = [{ kind: "tiles", id: "tiles", tiles: stats.overview.tiles }];
    if (stats.overview.note) blocks.push({ kind: "note", id: "ov:note", text: stats.overview.note });
    return blocks;
  }
  if (tab === "all-cards") return groupBlocksOf(stats.allCards?.groups ?? [], shown);
  if (tab === "decks") {
    // Each deck: a row for its record (the hero's picture, which opens the hover), then its most played cards.
    const blocks: DashBlock[] = [];
    for (const deck of stats.decks) {
      blocks.push({
        kind: "stat",
        id: `deck:${deck.id}`,
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
      if (cards.length > 0) blocks.push({ kind: "cards", id: `deck:${deck.id}:strip:0`, cards });
      else
        blocks.push({
          kind: "note",
          id: `deck:${deck.id}:none`,
          text: deck.tracked === 0 ? notes.untracked : notes.none,
        });
    }
    return blocks;
  }
  if (tab === "cards") {
    const hero = heroAt(stats, heroIndex);
    if (!hero) return [];
    const blocks: DashBlock[] = [];
    if (hero.aspects.length > 0) blocks.push({ kind: "aspects", id: "aspects", aspects: hero.aspects });
    if (hero.note) blocks.push({ kind: "note", id: "cards:note", text: hero.note });
    blocks.push(...groupBlocksOf(hero.groups, shown));
    return blocks;
  }
  const sections = (TAB_SECTIONS[tab] ?? []).flatMap((id) => stats.sections.filter((s) => s.id === id));
  const blocks: DashBlock[] =
    tab === "aspects" && stats.aspects.length > 0
      ? [{ kind: "donut", id: "aspects:donut", shares: stats.aspects }]
      : [];
  for (const section of sections) {
    if (sections.length > 1) blocks.push({ kind: "heading", id: `${section.id}:head`, title: section.title });
    blocks.push(...statBlocksOf(section));
  }
  return blocks;
}

/** A heading and a strip of pictures per group; a group left empty has neither. */
function groupBlocksOf(
  groups: HeroCardsView["groups"],
  shown: (cards: HeroCardsView["groups"][number]["cards"]) => readonly DashCard[],
): DashBlock[] {
  const blocks: DashBlock[] = [];
  for (const group of groups) {
    const cards = shown(group.cards);
    if (cards.length === 0) continue;
    blocks.push({ kind: "heading", id: `${group.id}:head`, title: group.title });
    blocks.push({ kind: "cards", id: `${group.id}:strip:0`, cards });
  }
  return blocks;
}

/** A section's own blocks (no heading): stat rows, and the notes it carries. */
export function statBlocksOf(section: StatsSection): DashBlock[] {
  return section.rows.map((row): DashBlock =>
    row.kind === "note" ? { kind: "note", id: row.id, text: row.text } : { kind: "stat", id: row.id, row },
  );
}

/** Everyone's tab (`view/global-stats-ui.ts`): the notes for the load's state, then the section's rows. */
export function globalBlocksOf(notes: readonly string[], section: StatsSection | null): DashBlock[] {
  return [
    ...notes.map((text, i): DashBlock => ({ kind: "note", id: `global:note:${i}`, text })),
    ...(section ? statBlocksOf(section) : []),
  ];
}
