/**
 * What Your stats' page model is built from (`view/player-stats-page-model.ts`), gathered from the scene's memory
 * (`player-stats-state.ts`), the saves' fold, the leased pictures and the key and pad glyphs the controls wear.
 */
import type { ControlGlyph } from "@mc/ui";
import { t, type MessageKey } from "../i18n/translate.js";
import { currentCardsById, currentScenarios } from "../content/pool.js";
import type { ControlGlyphs } from "../dom/control-glyphs.js";
import { readConsent } from "../global-stats/global-consent.js";
import { backfillProgress } from "../progression/stats-backfill.js";
import type { GlobalState } from "../view/global-stats-ui.js";
import { scenarioCardIdOf } from "../view/random-villain.js";
import type { StatsPageInput } from "../view/player-stats-page-model.js";
import { POOL_STATS_NAMES } from "../view/player-stats-names.js";
import type { MatchupPictures } from "../view/player-stats-matchup-model.js";
import type { PlayerStats } from "../view/player-stats-model.js";
import { SCENES } from "./keys.js";
import type { StatsLooks } from "./player-stats-looks.js";
import { cursorOf, mem, sourceSwitchSpecs, triggerSpecs } from "./player-stats-state.js";

/** What Back says, by the screen it goes to. */
const BACK_LABELS: Readonly<Record<string, MessageKey>> = {
  [SCENES.title]: "stats.back.title",
  [SCENES.decks]: "stats.back.decks",
  [SCENES.trophyRoom]: "stats.back.trophies",
};

/** The control height the glyphs on the chips and the switch are drawn for. */
const CONTROL_HEIGHT = 44;
const TAB_HINT_HEIGHT = 14;

export interface StatsInputEnv {
  readonly stats: PlayerStats | null;
  readonly failed: boolean;
  readonly global: GlobalState;
  readonly shareFailed: boolean;
  readonly overlay: boolean;
  readonly from: string | undefined;
  readonly phone: boolean;
  readonly width: number;
  readonly glyphs: ControlGlyphs;
  readonly looks: StatsLooks;
}

/** The pictures a Matchups axis shows: rows are scenarios unless flipped, and a modular set has none. */
function matchupPicturesOf(looks: StatsLooks): MatchupPictures {
  const scenarios = (axis: "row" | "column"): boolean => (axis === "row") !== mem.flipped;
  return {
    picture: (axis, id) => (scenarios(axis) ? looks.villain(id) : mem.grid === "heroes" ? looks.hero(id) : null),
    cardId: (axis, id) => {
      const scenario = scenarios(axis) ? currentScenarios().find((s) => (s.id as string) === id) : undefined;
      const cardId = scenario ? scenarioCardIdOf(scenario) : !scenarios(axis) && mem.grid === "heroes" ? id : null;
      return cardId && currentCardsById().has(cardId) ? cardId : null;
    },
  };
}

export function statsInputOf(env: StatsInputEnv): StatsPageInput {
  const { glyphs } = env;
  return {
    stats: env.stats,
    failed: env.failed,
    source: mem.source,
    tab: mem.tab,
    hero: mem.hero,
    hideSignature: mem.hideSignature,
    filter: mem.filter,
    filtersOpen: mem.filtersOpen,
    global: env.global,
    sharing: readConsent() === "on",
    shareFailed: env.shareFailed,
    backfill: backfillProgress(),
    matchups: {
      kind: mem.grid,
      counts: mem.counts,
      played: mem.played,
      flipped: mem.flipped,
      view: mem.view,
      cursor: cursorOf(),
    },
    names: POOL_STATS_NAMES,
    backLabel: t(env.overlay ? "stats.back.back" : (BACK_LABELS[env.from ?? SCENES.trophyRoom] ?? "stats.back.back")),
    phone: env.phone,
    width: env.width,
    deps: { ...env.looks.deps, linkGames: !env.overlay },
    matchupPictures: matchupPicturesOf(env.looks),
    glyphs: {
      shortcut: (key, ids): ControlGlyph | undefined => glyphs.glyph(`stats:${key}`, ids, "paper", CONTROL_HEIGHT),
      trigger: (key, which): ControlGlyph | undefined =>
        glyphs.glyph(`stats:${key}`, [], "paper", CONTROL_HEIGHT, "inside", triggerSpecs(which)),
    },
    backGlyph: glyphs.glyph("stats:back", ["cancel"], "ink", CONTROL_HEIGHT),
    tabsGlyph: glyphs.glyph("stats:tabs", ["zonePrevious", "zoneNext"], "paper", TAB_HINT_HEIGHT),
    sourceGlyph: env.phone
      ? undefined
      : glyphs.glyph("stats:source", [], "ink", CONTROL_HEIGHT, "inside", sourceSwitchSpecs),
  };
}
