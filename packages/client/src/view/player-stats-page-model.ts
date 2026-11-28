/**
 * Everything Your stats draws, as one view model (`StatsPageModel`) for the page element (`views/player-stats/`): the
 * header's words, the tab row, the controls under it, and the body (a tab's blocks, the Matchups grid, or a word while the
 * saves are read). Pure: the scene hands in its state, the saves' fold, and the pictures and glyphs it leases and builds;
 * nothing here knows Phaser, the engine or a layout. The layout is CSS in the elements.
 */
import type { ControlGlyph, TabRailTab } from "@mc/ui";
import type { StatsControlRow } from "../components/player-stats/mc-stats-controls/mc-stats-controls.types.js";
import type { StatsBlock } from "../components/player-stats/mc-stats-list/mc-stats-list.types.js";
import type { StatsGridCursor } from "../components/player-stats/mc-stats-matchup-grid/mc-stats-matchup-grid.types.js";
import type { StatsEventDetail } from "../components/player-stats/shared/stats-events.types.js";
import type { StatsPageModel } from "../views/player-stats/mc-player-stats-page/mc-player-stats-page.types.js";
import { t } from "../i18n/translate.js";
import { globalTabViewOf, statsTabsFor, SOURCE_LABELS, type GlobalState, type StatsSource } from "./global-stats-ui.js";
import {
  gridModelOf,
  focusTilesOf,
  legendOfGrid,
  shelfModelsOf,
  shownGridOf,
  sideRowsOf,
  type MatchupChoices,
  type MatchupPictures,
} from "./player-stats-matchup-model.js";
import { blockOf, type StatsBlockDeps } from "./player-stats-block-model.js";
import { dashboardBlocksOf, globalBlocksOf, type DashBlock } from "./player-stats-blocks.js";
import {
  filterChipsOf,
  focusStepperOf,
  gridChipsOf,
  heroStepperOf,
  hideSignatureRowOf,
  shareRowOf,
  type StatsGlyphs,
} from "./player-stats-controls-model.js";
import type { MatchupView } from "./matchup-grid.js";
import type { StatsFilter, PlayerStats } from "./player-stats-model.js";
import { heroAt, statsTabsOf, type StatsTab } from "./player-stats-tabs.js";
import type { StatsNames } from "./player-stats-model.js";

/** The Focus view's side list needs this much screen beside its tiles; narrower, a stepper takes its place. */
export const SIDE_LIST_MIN_SCREEN = 720;
/** From this width the Matchups chips lay all four views out (narrower, one chip steps through them). */
const VIEW_CHIPS_MIN_SCREEN = 1280;

/** Below this screen width Everyone is "All": the switch's two segments would crowd the bar. */
const NARROW_SWITCH = 430;

export interface StatsPageInput {
  /** The folded saves, or null while they are read. */
  readonly stats: PlayerStats | null;
  readonly failed: boolean;
  readonly source: StatsSource;
  readonly tab: StatsTab;
  readonly hero: number;
  readonly hideSignature: boolean;
  readonly filter: StatsFilter;
  readonly filtersOpen: boolean;
  readonly global: GlobalState;
  readonly sharing: boolean;
  readonly shareFailed: boolean;
  readonly backfill: { readonly running: boolean; readonly done: number; readonly total: number };
  readonly matchups: MatchupChoices & {
    readonly view: MatchupView;
    readonly cursor: StatsGridCursor;
  };
  /** The scenes names the everyone tabs use. */
  readonly names: StatsNames;
  readonly backLabel: string;
  readonly phone: boolean;
  /** The screen's width, for what fits where. */
  readonly width: number;
  readonly deps: StatsBlockDeps;
  readonly matchupPictures: MatchupPictures;
  readonly glyphs: StatsGlyphs;
  /** Back's glyph, the tabs' LB / RB and the source switch's. */
  readonly backGlyph: ControlGlyph | undefined;
  readonly tabsGlyph: ControlGlyph | undefined;
  readonly sourceGlyph: ControlGlyph | undefined;
}

/** The scroll key a tab keeps its place under. */
export function scrollKeyOf(input: Pick<StatsPageInput, "source" | "tab" | "hero" | "matchups">): string {
  if (input.source === "everyone") return `global:${input.tab}`;
  if (input.tab === "cards") return `cards:${input.hero}`;
  if (input.tab === "matchups")
    return `matchups:${input.matchups.view}:${input.matchups.kind}:${input.matchups.flipped}`;
  return input.tab;
}

const chips = (
  id: string,
  list: readonly import("../components/player-stats/mc-stats-chip-row/mc-stats-chip-row.types.js").StatsChipModel[],
  scroll: boolean,
): StatsControlRow => ({
  kind: "chips",
  id,
  chips: list,
  scroll,
});

export function statsPageModelOf(input: StatsPageInput): StatsPageModel {
  const { stats, phone, width } = input;
  const header = {
    backLabel: phone ? "◂" : `◂ ${input.backLabel}`,
    title: t("stats.title"),
    played: phone || !stats ? "" : stats.header.played,
    showSource: stats !== null,
    source: input.source,
    youLabel: SOURCE_LABELS.you,
    everyoneLabel: width < NARROW_SWITCH ? "All" : SOURCE_LABELS.everyone,
    backGlyph: input.backGlyph,
    sourceGlyph: input.sourceGlyph,
  };
  if (!stats) {
    return {
      header,
      tabs: null,
      controls: [],
      body: { kind: "message", text: t(input.failed ? "stats.failed" : "stats.reading") },
    };
  }
  const everyone = input.source === "everyone";
  const tabs = statsTabsFor(input.source, statsTabsOf(stats));
  const onMatchups = !everyone && input.tab === "matchups" && stats.matchups !== null;
  const view = input.matchups.view;
  const stepper = onMatchups && view === "focus" && width < SIDE_LIST_MIN_SCREEN;

  // The hero / villain / difficulty filters fold your games only: they are not offered on Everyone.
  const filters = everyone ? null : filterChipsOf(stats, input.filter, phone, input.filtersOpen, input.glyphs);
  const controls: StatsControlRow[] = [];
  if (filters && filters.chips.length > 0) controls.push(chips("filters", filters.chips, false));
  if (onMatchups)
    controls.push(
      chips(
        "matchups",
        gridChipsOf(phone, width >= VIEW_CHIPS_MIN_SCREEN, view, input.matchups.kind, input.matchups, input.glyphs),
        phone,
      ),
    );
  if (everyone) controls.push(shareRowOf(input.sharing, input.shareFailed));
  if (input.tab === "cards") {
    const current = heroAt(stats, input.hero);
    if (current) controls.push(heroStepperOf(stats, current, phone, input.glyphs));
  }
  const matchup = onMatchups ? shownGridOf(stats.matchups![input.matchups.kind], input.matchups.flipped) : null;
  const focusRow = matchup ? Math.min(input.matchups.cursor.row, matchup.rows.length - 1) : 0;
  if (stepper && matchup) controls.push(focusStepperOf(matchup.rows[focusRow]!.name));
  if (input.tab === "cards" || input.tab === "all-cards" || input.tab === "decks")
    controls.push(hideSignatureRowOf(input.hideSignature));

  const tabsModel = {
    tabs: tabs.map((tab): TabRailTab => ({ id: tab.id, label: tab.label, selected: tab.id === input.tab })),
    selected: input.tab,
    glyph: tabs.length > 1 ? input.tabsGlyph : undefined,
    toggle: filters?.toggle ?? null,
  };

  if (matchup && (view === "heat" || view === "stamps")) {
    return {
      header,
      tabs: tabsModel,
      controls,
      body: {
        kind: "grid",
        grid: gridModelOf(matchup, view === "stamps" ? "stamps" : "heat", input.matchups, input.matchupPictures),
        cursor: input.matchups.cursor,
      },
    };
  }

  const blocks: StatsBlock[] = [];
  if (matchup) {
    blocks.push({ kind: "legend", id: "matchup:legend", entries: legendOfGrid(matchup, input.matchups.played) });
    if (view === "shelves")
      for (const shelf of shelfModelsOf(matchup, input.matchups, input.matchupPictures))
        blocks.push({ kind: "shelf", id: `shelf:${shelf.row}`, shelf });
    else
      blocks.push({
        kind: "matchup-tiles",
        id: "matchup:tiles",
        tiles: focusTilesOf(matchup, focusRow, input.matchups, input.matchupPictures),
      });
  } else {
    const dash: DashBlock[] = everyone
      ? (() => {
          const filtered =
            input.filter.hero !== undefined ||
            input.filter.villain !== undefined ||
            input.filter.difficulty !== undefined;
          const global = globalTabViewOf(input.global, input.tab, input.names, filtered);
          return globalBlocksOf(global.notes, global.section);
        })()
      : [
          ...(input.tab === "overview" && input.backfill.running
            ? [
                {
                  kind: "note" as const,
                  id: "ov:backfill",
                  text: t("stats.backfill", { done: input.backfill.done, total: input.backfill.total }),
                },
              ]
            : []),
          ...dashboardBlocksOf(stats, input.tab, input.hero, input.hideSignature),
        ];
    for (const block of dash) blocks.push(blockOf(block, input.deps));
  }
  return {
    header,
    tabs: tabsModel,
    controls,
    body: {
      kind: "list",
      scrollKey: scrollKeyOf(input),
      blocks,
      side: matchup && view === "focus" && !stepper ? sideRowsOf(matchup, input.matchups, focusRow) : null,
    },
  };
}

/** What a press of a control says, for the scene's one handler (re-exported so a scene names no element file). */
export type { StatsEventDetail };
