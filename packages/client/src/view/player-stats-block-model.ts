/**
 * A tab's blocks (`player-stats-blocks.ts`) worded and coloured for the page's elements: the Overview's tiles with their
 * captions and bar colours, stat rows with their pictures and loss bars, the Aspects donut's shares, strips of card
 * pictures. Pure: pictures come in through `StatsBlockDeps` (the scene leases them), every word is `t()`'s.
 */
import type { PictureSource, SegmentBarPart } from "@mc/ui";
import type { StatsBlock } from "../components/player-stats/mc-stats-list/mc-stats-list.types.js";
import type { StatsTileModel } from "../components/player-stats/mc-stats-overview/mc-stats-overview.types.js";
import { t } from "../i18n/translate.js";
import { aspectStampOf } from "./aspect-stamp.js";
import type { DashBlock } from "./player-stats-blocks.js";
import type { LossCause, OverviewTile } from "./player-stats-model.js";

/** Where a block's pictures and the card checks come from: the scene. */
export interface StatsBlockDeps {
  /** Whether the pool has this card (a picture and a hover are offered only for one it has). */
  readonly hasCard: (cardId: string) => boolean;
  /** The picture a stats row or strip draws for a card, leased. */
  readonly cardPicture: (cardId: string) => PictureSource | null;
  /** A hero's picture (its artwork, else its scan), leased. */
  readonly heroPicture: (identityId: string) => PictureSource | null;
  /** A scenario's villain picture, leased. */
  readonly villainPicture: (scenarioId: string) => PictureSource | null;
  /** Whether a record's "View game" link shows (it names a game, and the screen is a screen, not an overlay). */
  readonly linkGames: boolean;
}

const css = (hex: number): string => `#${hex.toString(16).padStart(6, "0")}`;

/** A warm grey (the Basic aspect's) for "Other", apart from Wiped's ink. */
const MUTED = "#9a948a";

/** A loss bar's parts: the same hue for a cause on every row. The legend beside the bar names them in words too. */
const LOSS_COLORS: Readonly<Record<LossCause, string>> = {
  scheme: "var(--mc-fill-caution)",
  villain: "var(--mc-fill-red)",
  minions: "var(--mc-fill-cost)",
  // A purple no other part uses (the aspect and signal tokens have none), so Encounter reads apart from the rest.
  encounter: "#6b3fa0",
  other: MUTED,
  unknown: "var(--mc-fill-paper)",
};

const SPLIT_TONES = {
  caution: { color: "var(--mc-fill-caution)", ink: "var(--mc-text-ink-on-hue)" },
  muted: { color: MUTED, ink: "var(--mc-text-ink-on-hue)" },
  ink: { color: "var(--mc-fill-ink)", ink: "var(--mc-text-paper)" },
} as const;

function tileOf(tile: OverviewTile, deps: StatsBlockDeps): StatsTileModel {
  switch (tile.kind) {
    case "record":
      return {
        kind: "record",
        id: tile.id,
        caption: t("stats.winsLosses"),
        record: tile.record,
        rate: tile.rate,
        fraction: tile.fraction,
        detail: tile.detail,
      };
    case "split":
      return {
        kind: "split",
        id: tile.id,
        label: tile.label,
        parts: tile.parts.map((part) => ({
          count: part.count,
          color: SPLIT_TONES[part.tone].color,
          ink: SPLIT_TONES[part.tone].ink,
          label: `${part.label} ${part.count}`,
        })),
        detail: tile.detail,
      };
    case "figures":
      return { kind: "figures", id: tile.id, label: tile.label, lines: tile.lines };
    case "portrait":
      return {
        kind: "portrait",
        id: tile.id,
        hero: tile.wide,
        label: tile.label,
        name: tile.name,
        detail: tile.detail,
        extra: tile.extra,
        picture: "hero" in tile.art ? deps.heroPicture(tile.art.hero) : deps.villainPicture(tile.art.scenario),
      };
    case "small":
      return { kind: "small", id: tile.id, label: tile.label, value: tile.value, detail: tile.detail };
  }
}

/** A row's loss parts as a bar, each with its words and count. */
const lossParts = (
  parts: readonly { readonly cause: LossCause; readonly label: string; readonly count: number }[],
): readonly SegmentBarPart[] =>
  parts.map((part) => ({ count: part.count, color: LOSS_COLORS[part.cause], label: `${part.label} ${part.count}` }));

/** One dashboard block, worded for its element. */
export function blockOf(block: DashBlock, deps: StatsBlockDeps): StatsBlock {
  switch (block.kind) {
    case "tiles":
      return { kind: "tiles", id: block.id, tiles: block.tiles.map((tile) => tileOf(tile, deps)) };
    case "heading":
      return { kind: "heading", id: block.id, title: block.title };
    case "note":
      return { kind: "note", id: block.id, text: block.text };
    case "stat": {
      const row = block.row;
      const hasCard = row.cardId !== undefined && deps.hasCard(row.cardId);
      const losses = row.losses ? lossParts(row.losses) : [];
      return {
        kind: "stat",
        id: block.id,
        row: {
          id: row.id,
          label: row.label,
          value: row.value,
          detail: row.detail,
          highlight: row.highlight === true,
          cardId: hasCard ? row.cardId! : null,
          picture: hasCard ? deps.cardPicture(row.cardId!) : null,
          gameId: deps.linkGames && row.gameId !== undefined ? row.gameId : null,
          linkLabel: t("stats.viewGame"),
          losses,
          lossLegend: losses.map((part) => part.label).join(" · "),
        },
      };
    }
    case "donut": {
      const total = block.shares.reduce((sum, share) => sum + share.games, 0);
      return {
        kind: "donut",
        id: block.id,
        chartKey: `donut:${block.id}`,
        caption: t("stats.aspectsLabel"),
        shares: block.shares.map((share) => ({
          aspect: share.aspect,
          label: share.label,
          games: share.games,
          fill: css(aspectStampOf(share.aspect as Parameters<typeof aspectStampOf>[0]).fill),
          text: t("stats.aspectShare", {
            share: Math.round((share.games / Math.max(1, total)) * 100),
            games: share.games,
            won: Math.round((share.wins / Math.max(1, share.games)) * 100),
          }),
        })),
      };
    }
    case "aspects":
      return {
        kind: "aspects",
        id: block.id,
        caption: t("stats.aspectsLabel"),
        aspects: block.aspects.map((entry) => {
          const stamp = aspectStampOf(entry.aspect as Parameters<typeof aspectStampOf>[0]);
          return {
            aspect: entry.aspect,
            label: entry.label.toUpperCase(),
            fill: css(stamp.fill),
            ink: css(stamp.ink),
            detail: entry.detail,
          };
        }),
      };
    case "cards":
      return {
        kind: "cards",
        id: block.id,
        cards: block.cards.map((card) => ({
          key: `card:${block.id}:${card.cardId}`,
          cardId: card.cardId,
          value: card.value,
          detail: card.detail,
          picture: deps.cardPicture(card.cardId),
        })),
      };
  }
}
