/**
 * The facts the Title's words are made from (`view/title-page-model.ts`): what is saved, the update state, the rank, the
 * input device and the layout mode. Gathered here so the scene stays a mount, a route and a set of reactions.
 */
import type { ControlGlyphs } from "../dom/control-glyphs.js";
import { artLanguageNow } from "../art/art-source.js";
import { cardLanguage } from "../art/card-language.js";
import { POOL_CARDS, POOL_DEPS, POOL_SCENARIOS } from "../content/pool.js";
import { packUpdateCount } from "../packs/pack-updates.js";
import { hasDesktopWindow } from "../platform/desktop-window.js";
import { detectPlatform } from "../platform/platform.js";
import { powerSavingState } from "../platform/power-saving.js";
import { syncServiceUrl } from "../save-data/transfer-config.js";
import { lifetimeChampionPoints, unlocks } from "../progression/progression.js";
import { CLIENT_VERSION } from "../version.js";
import { appVersionText, buildCommit } from "../view/app-version.js";
import { cardPoolCoverageOf, cardPoolCoverageText } from "../view/card-pool-coverage.js";
import { colorScheme } from "../view/color-scheme.js";
import { CIVIL_WAR_CYCLE_ID, CIVIL_WAR_TITLE_LABEL, civilWarTitleEntryOf } from "../view/civil-war-entry.js";
import { continueLabelOf } from "../view/continue-label.js";
import { GAME_LABEL_NAMES } from "../view/game-label-names.js";
import { gameRowsOf } from "../view/games-list-model.js";
import { languageCodeOf } from "../view/language-button.js";
import { playPlatformMarkOf } from "../view/play-platform-mark.js";
import { powerSavingFooterOf } from "../view/power-saving-notice.js";
import { RELEASE_NOTICE_ON } from "../view/release-notice.js";
import { setupMetrics } from "../view/setup-metrics.js";
import { onlineSideFits } from "../view/title-online-panel.js";
import type { TitleFacts } from "../view/title-page-model.js";
import { titleRankBadgeOf } from "../view/title-rank-badge.js";
import type { TitleBanner } from "./title-banner.js";
import type { TitleFeeds } from "./title-feeds.js";

/** The Play online panel needs this much height; a shorter wide screen keeps the plain Campaign / Play online pair. */
const PROMO_MIN_HEIGHT = 560;

export interface TitleFactsSource {
  readonly width: number;
  readonly height: number;
  readonly feeds: TitleFeeds;
  readonly banner: TitleBanner | null;
  readonly glyphs: ControlGlyphs;
  readonly starting: boolean;
  readonly statusText: string | null;
  /** Why a replay did not open, while it is still being said. */
  readonly problem: string | null;
  readonly rankUp: string | null;
  readonly focused: string | null;
  readonly popups: { readonly language: boolean; readonly music: boolean };
}

export interface TitleFactsResult {
  readonly facts: TitleFacts;
  /** The listed games' ids, newest first. */
  readonly gameIds: readonly string[];
  /** The Civil War! entry's scenario, once the box is open. */
  readonly civilWarScenario: string | null;
}

/** Whether online play can be tried from here: a connection and a service. Anything else reads as unavailable. */
function onlineAvailable(): boolean {
  const noNetwork = typeof navigator !== "undefined" && navigator.onLine === false;
  return !noNetwork && syncServiceUrl() !== null;
}

export function titleFactsOf(source: TitleFactsSource): TitleFactsResult {
  const { width, height, feeds, glyphs } = source;
  const { phone, pad } = setupMetrics(width, height);
  const mode = phone ? "phone" : "wide";
  const civilWar = civilWarTitleEntryOf(unlocks().waveLock(CIVIL_WAR_CYCLE_ID), POOL_SCENARIOS);
  const games = gameRowsOf(feeds.listed(), GAME_LABEL_NAMES, Date.now());
  const promo = phone || height < PROMO_MIN_HEIGHT ? "none" : onlineSideFits(width, height, pad, 520) ? "side" : "art";
  const online = { available: onlineAvailable(), liveCount: feeds.liveCount };
  if (promo !== "none" && online.available) feeds.askLive();
  const save = feeds.continuable;
  const { detected, applied } = powerSavingState();
  const facts: TitleFacts = {
    mode,
    starting: source.starting,
    continue: save
      ? { label: continueLabelOf(save, GAME_LABEL_NAMES), mark: playPlatformMarkOf(save.lastPlayedOn) }
      : null,
    games,
    gamesPanel: mode === "wide",
    removing: feeds.removing,
    removeBusy: feeds.removeBusy,
    removeError: feeds.removeError,
    civilWar: civilWar ? { label: CIVIL_WAR_TITLE_LABEL } : null,
    quit: hasDesktopWindow(),
    promo,
    online,
    packUpdates: packUpdateCount(),
    notice: RELEASE_NOTICE_ON ? { version: feeds.noticeVersion } : null,
    banner: source.banner?.input ?? null,
    rank: titleRankBadgeOf(lifetimeChampionPoints()),
    rankUp: source.rankUp,
    footer: {
      cards: cardPoolCoverageText(cardPoolCoverageOf(POOL_CARDS, POOL_DEPS)),
      version: appVersionText(CLIENT_VERSION, detectPlatform(), buildCommit(), cardLanguage(), feeds.steam !== null),
      // A phone's top row has no room for the Discord icon: the footer carries the link instead.
      discordLink: mode === "phone",
      aside: powerSavingFooterOf(detected, applied),
    },
    status: source.statusText,
    problem: source.problem,
    focused: source.focused,
    theme: colorScheme() === "light" ? "moon" : "sun",
    languageCode: languageCodeOf(artLanguageNow()),
    languageOpen: source.popups.language,
    musicOpen: source.popups.music,
    topRowExtras: mode === "wide",
    glyph: (key, ids, ground, controlHeight, place) => glyphs.glyph(key, ids, ground, controlHeight, place),
  };
  return { facts, gameIds: games.map((row) => row.id), civilWarScenario: civilWar?.scenarioId ?? null };
}
