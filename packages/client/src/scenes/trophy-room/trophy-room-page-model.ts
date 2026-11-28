/** The Trophy Room's whole page model, from the achievements and the scene's own state: the pure side of the scene. */
import type Phaser from "phaser";
import type { TrophyFiltersModel } from "../../components/trophy-room/mc-trophy-filters/mc-trophy-filters.types.js";
import type { TrophySheetModel } from "../../components/trophy-room/mc-trophy-sheet/mc-trophy-sheet.types.js";
import type { ControlGlyphs } from "../../dom/control-glyphs.js";
import { t } from "../../i18n/translate.js";
import { ACHIEVEMENT_FAMILIES } from "../../progression/achievements.js";
import { achievementStatusesNow, lifetimeChampionPoints } from "../../progression/progression.js";
import { campaignFrame } from "../../ui/campaign-chrome.js";
import {
  trophyHeaderOf,
  trophyRowsOf,
  trophySortLabel,
  trophySorts,
  type TrophyRow,
  type TrophyView,
} from "../../view/trophy-room-model.js";
import type { TrophyRoomPageModel } from "../../views/trophy-room/mc-trophy-room-page/mc-trophy-room-page.types.js";
import { barClearanceOf } from "../screen-bar.js";

export type AchievementRow = Extract<TrophyRow, { readonly kind: "achievement" }>;

export interface TrophyRoomPageInput {
  readonly scene: Phaser.Scene;
  readonly view: TrophyView;
  /** The sort chips are showing. */
  readonly filtersOpen: boolean;
  /** The achievement whose sheet is open (its id), or null. */
  readonly openId: string | null;
  readonly glyphs: ControlGlyphs;
}

export interface TrophyRoomPageBuild {
  readonly model: TrophyRoomPageModel;
  readonly rows: readonly TrophyRow[];
  /** The row whose sheet is open now, if it is still listed. */
  readonly sheetRow: AchievementRow | null;
}

/** Whether every family is open, so the button folds them all instead. */
export const allExpanded = (view: Pick<TrophyView, "expanded">): boolean =>
  ACHIEVEMENT_FAMILIES.every((f) => view.expanded.has(f.id));

/** The sheet's words: the state line, as it reads. */
function sheetFacts(row: AchievementRow): string {
  const facts = [`${row.state === "earned" ? "✓ " : ""}${row.stateLabel}`];
  if (row.reward) facts.push(row.reward);
  if (row.packName) facts.push(t("trophies.fromPack", { name: row.packName }));
  if (row.progress) facts.push(t("trophies.progress", { progress: row.progressLabel }));
  return facts.join("   ");
}

function sheetOf(row: AchievementRow, glyphs: ControlGlyphs): TrophySheetModel {
  return {
    name: row.name,
    facts: sheetFacts(row),
    detail: row.detail,
    closeLabel: t("trophies.close"),
    closeGlyph: glyphs.glyph("close", ["cancel"], "paper", 48),
  };
}

function filtersOf(input: TrophyRoomPageInput, sheetOpen: boolean): TrophyFiltersModel {
  const { view, filtersOpen, glyphs } = input;
  return {
    open: filtersOpen,
    toggleLabel: `${filtersOpen ? "▾" : "▸"} ${t("trophies.sortBy", { sort: trophySortLabel(view) })}`,
    expandLabel: t(allExpanded(view) ? "trophies.collapseAll" : "trophies.expandAll"),
    // Not `drawFiltersControl`: its Y glyph is the pad's alone, and here the keyboard's Inspect key opens it too.
    toggleGlyph: sheetOpen ? undefined : glyphs.glyph("filters", ["inspect"], "paper", 44),
    expandGlyph: sheetOpen ? undefined : glyphs.glyph("expand", ["expand"], "paper", 44),
    sorts: trophySorts(),
    sort: view.sort,
    descending: view.descending,
    ascendingLabel: t("trophies.ascending"),
    descendingLabel: t("trophies.descending"),
  };
}

export function buildTrophyRoomPage(input: TrophyRoomPageInput): TrophyRoomPageBuild {
  const { scene, view, glyphs } = input;
  const { width, phone } = campaignFrame(scene);
  const statuses = achievementStatusesNow();
  const rows = trophyRowsOf(statuses, view);
  const open = rows.find((row): row is AchievementRow => row.kind === "achievement" && row.id === input.openId) ?? null;
  const back = phone ? "◂" : `◂ ${t("trophies.backTitle")}`;
  const title = t("trophies.title");
  const statsWidth = phone ? 92 : 150;
  const clearance = barClearanceOf(scene, {
    width,
    phone,
    back,
    title,
    endWidth: statsWidth + 12,
    backGlyph: glyphs.glyph("back", ["cancel"], "ink", 44) !== undefined,
  });
  const groupLabels: Record<string, string> = {};
  for (const row of rows) if (row.kind === "group") groupLabels[row.id] = t("trophies.fromPack", { name: row.title });
  const model: TrophyRoomPageModel = {
    phone,
    bar: {
      backLabel: back,
      backGlyph: open ? undefined : glyphs.glyph("back", ["cancel"], "ink", 44),
      title,
      titleDrop: clearance.drop,
      titleMaxRight: clearance.maxRight,
    },
    // "Your stats" (X on a pad) at the bar's right; the earned count it displaced sits over the rank bar instead.
    stats: {
      label: t(phone ? "trophies.statsShort" : "trophies.stats"),
      glyph: open ? undefined : glyphs.glyph("stats", ["guide"], "ink", 44),
    },
    header: trophyHeaderOf(lifetimeChampionPoints(), statuses),
    filters: filtersOf(input, open !== null),
    list: { rows, groupLabels },
    sheet: open ? sheetOf(open, glyphs) : null,
  };
  return { model, rows, sheetRow: open };
}
