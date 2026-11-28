/** Past games' whole page model, from the saves and the scene's own state: the pure side of the scene. */
import type Phaser from "phaser";
import type { AnyCard } from "@mc/content";
import type { PastGameDetailsModel } from "../../components/past-games/mc-past-game-details/mc-past-game-details.types.js";
import type { PastGameRowModel } from "../../components/past-games/mc-past-game-row/mc-past-game-row.types.js";
import type { PictureLeases } from "../../dom/picture-leases.js";
import type { ControlGlyphs } from "../../dom/control-glyphs.js";
import type { PastGamesPageModel } from "../../views/past-games/mc-past-games-page/mc-past-games-page.types.js";
import type { SaveMeta } from "../../engine/game-storage.js";
import { t, type MessageKey } from "../../i18n/translate.js";
import { campaignFrame } from "../../ui/campaign-chrome.js";
import { PAST_GAME_NAMES } from "../../view/game-label-names.js";
import {
  PAST_GAME_ACTIONS,
  PAST_GAME_FILTERS,
  pastGameCounts,
  pastGameRowsOf,
  pastGamesSidePanel,
  type PastGameAction,
  type PastGameFilter,
  type PastGameRow,
} from "../../view/past-games-model.js";
import { barClearanceOf } from "../screen-bar.js";
import { picturedRecords, picturesOf } from "./past-games-pictures.js";
import { seatModelOf, summaryOf } from "./past-games-words.js";

const FILTER_LABEL: Readonly<Record<PastGameFilter, MessageKey>> = {
  all: "pastGames.filter.all",
  won: "pastGames.filter.won",
  lost: "pastGames.filter.lost",
};

const ACTION_LABEL: Readonly<Record<PastGameAction, MessageKey>> = {
  watch: "pastGames.watch",
  share: "pastGames.share",
  export: "pastGames.export",
  log: "pastGames.log",
};

/** What is running: an action on a game, or the file picker or the tracker export (`id` empty). One at a time. */
export interface Busy {
  readonly id: string;
  readonly action: PastGameAction | "file" | "tracker";
}

export interface PastGamesPageInput {
  readonly scene: Phaser.Scene;
  /** Every save on the device, or null while they are read. */
  readonly saves: readonly SaveMeta[] | null;
  readonly filter: PastGameFilter;
  readonly query: string;
  readonly selectedId: string | null;
  readonly busy: Busy | null;
  readonly status: string;
  /** Stats opened this visit: Back says so. */
  readonly fromStats: boolean;
  /** A Steam pad: the field says how to open the keyboard. */
  readonly steam: boolean;
  /** The pad is the input in use (LB / RB over the tabs). */
  readonly pad: boolean;
  readonly leases: PictureLeases;
  readonly glyphs: ControlGlyphs;
}

export interface PastGamesPageBuild {
  readonly model: PastGamesPageModel;
  readonly rows: readonly PastGameRow[];
  /** The game whose details show: the one picked, else (a side panel) the newest. */
  readonly selected: PastGameRow | null;
  /** The saves are read and the picked game is not among the rows shown: forget it. */
  readonly dropSelection: boolean;
  /** A phone's popup is up. */
  readonly popup: boolean;
  /** The card records the pictures stand for, for a hover whose pack is gone. */
  readonly records: ReadonlyMap<string, AnyCard>;
}

function emptyNote(input: PastGamesPageInput, rows: readonly PastGameRow[]): string | null {
  if (input.saves === null) return t("pastGames.loading");
  if (rows.length > 0) return null;
  if (input.query.trim() !== "") return t("pastGames.emptySearch");
  return t(input.filter === "all" ? "pastGames.empty" : "pastGames.emptyFilter");
}

function detailsOf(row: PastGameRow, input: PastGamesPageInput): PastGameDetailsModel {
  const { busy } = input;
  return {
    id: row.id,
    pictures: picturesOf(row, input.leases),
    summary: summaryOf(row, true),
    seats: row.seats.map(seatModelOf),
    actions: PAST_GAME_ACTIONS.map((action) => ({
      action,
      label: busy?.id === row.id && busy.action === action ? t("pastGames.working") : t(ACTION_LABEL[action]),
    })),
    busy: busy !== null,
    closeLabel: t("trophies.close"),
  };
}

export function buildPastGamesPage(input: PastGamesPageInput): PastGamesPageBuild {
  const { scene, saves, filter, query, busy } = input;
  const frame = campaignFrame(scene);
  const { width, phone } = frame;
  const side = pastGamesSidePanel(width);
  const list = saves ?? [];
  const counts = pastGameCounts(list, undefined, { query, names: PAST_GAME_NAMES });
  const rows = pastGameRowsOf(list, PAST_GAME_NAMES, filter, undefined, query);
  // The side panel always shows a game: the one picked, else the newest. A phone opens its popup only on a tap.
  let selected = rows.find((row) => row.id === input.selectedId) ?? null;
  if (!selected && side) selected = rows[0] ?? null;
  const popup = !side && selected !== null;

  input.leases.begin();
  const rowModels: PastGameRowModel[] = rows.map((row) => {
    const summary = summaryOf(row, false);
    return {
      id: row.id,
      selected: row.id === selected?.id,
      label: `${summary.result}: ${row.title}`,
      pictures: picturesOf(row, input.leases),
      summary,
    };
  });
  const details = selected ? detailsOf(selected, input) : null;
  const records = new Map<string, AnyCard>();
  for (const row of rows)
    picturedRecords(row).forEach((card, i) => {
      const id = [row.villainCardId, ...row.seats.map((seat) => seat.identityCardId)][i];
      if (card && id) records.set(id, card);
    });

  const back = phone ? "◂" : `◂ ${t(input.fromStats ? "pastGames.backStats" : "pastGames.backTitle")}`;
  const title = t("pastGames.title");
  const fileLabel = t(phone ? "pastGames.openFileShort" : "pastGames.openFile");
  const clearance = barClearanceOf(scene, {
    width,
    phone,
    back,
    title,
    endWidth: (phone ? 128 : 220) + 12,
    backGlyph: input.glyphs.glyph("back", ["cancel"], "ink", 44) !== undefined,
  });
  const model: PastGamesPageModel = {
    side,
    phone,
    bar: {
      backLabel: back,
      backGlyph: input.glyphs.glyph("back", ["cancel"], "ink", 44),
      title,
      titleDrop: clearance.drop,
      titleMaxRight: clearance.maxRight,
    },
    file: { label: fileLabel, disabled: busy !== null },
    filters: {
      tabs: PAST_GAME_FILTERS.map((id) => ({ id, label: `${t(FILTER_LABEL[id])} (${counts[id]})` })),
      selected: filter,
      glyph: input.pad ? input.glyphs.glyph("tabs", ["zonePrevious", "zoneNext"], "paper", 14) : undefined,
    },
    search: {
      value: query,
      placeholder: t("pastGames.search"),
      ...(input.steam ? { focusPlaceholder: t("reader.steamKeyboard") } : {}),
      clearLabel: t("decks.clearSearch"),
      exportLabel: busy?.action === "tracker" ? t("pastGames.working") : t("pastGames.exportTracker"),
      exportDisabled: busy !== null || rows.length === 0,
    },
    list: { rows: rowModels, empty: emptyNote(input, rows) },
    details,
    status: input.status,
  };
  return {
    model,
    rows,
    selected,
    dropSelection: !selected && saves !== null,
    popup,
    records,
  };
}
