/**
 * The Title menu (docs/phase4-screen-gaps.md §3 W2, D01/P01): a real menu,
 * not a setup page. Continue (when a game is in progress), New game, Decks &
 * Collection, Campaign (drawn locked — out of scope, PLAN.md Phase 4) and
 * Settings (drawn unavailable until W4 lands it), and a footer with the app's
 * own card-pool coverage and build version.
 *
 * This retires the setup half `TitleScene` used to carry (scenario,
 * difficulty, modular sets, seats, seed) — that flow now lives across
 * `ScenarioSelectScene` → `SeatsScene` → `TableSetupScene`, each reading and
 * writing the one `SetupDraft` `New game` hands off to the first of them.
 *
 * Campaign opens The Saga (`scenes/campaign/saga.ts`, C00b) — campaign mode's own shelf of boxes, not part of
 * this menu's own layout beyond the one button. Extras (`scenes/extras.ts`) opens the comics, artwork, hero and
 * villain files and soundtrack that play has unlocked.
 */

import Phaser from "phaser";
import "@mc/ui";
import type { AlertBannerModel, McTitlePanel, MenuButton, TitlePanelModel } from "@mc/ui";
import { artLanguageNow } from "../art/art-source.js";
import { accent, dotGrid, surface, typeRole, type TypeSpec } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { playPlatformMarkOf } from "../view/play-platform-mark.js";
import { McButton, paintDotGrid } from "../ui/widgets.js";
import { TITLE_ART, coverFit, pickTitleArtFor, titleArtSizeOf, type TitleArt } from "../art/title-art.js";
import { drawnDensity } from "../platform/screen-settings.js";
import { ensurePictureLoaded } from "../art/pictures.js";
import { cardLanguage } from "../art/card-language.js";
import { POOL_CARDS, POOL_DEPS, POOL_SCENARIOS } from "../content/pool.js";
import { cardPoolCoverageOf, cardPoolCoverageText } from "../view/card-pool-coverage.js";
import {
  UPDATE_DISMISS_ID,
  UPDATE_RESTART_ID,
  appVersionText,
  buildCommit,
  updateActions,
} from "../view/app-version.js";
import { releaseNotesPageUrl } from "../view/release-report-link.js";
import { dismissUpdate, dismissedUpdateVersion, isUpdateDismissed } from "../platform/update-dismissal.js";
import { CLIENT_VERSION } from "../version.js";
import { detectPlatform, isNativeShell, openExternal } from "../platform/platform.js";
import { DISCORD_INVITE_URL } from "../view/issue-report.js";
import { onPowerSavingChange, powerSavingState } from "../platform/power-saving.js";
import { powerSavingFooterOf } from "../view/power-saving-notice.js";
import { fetchLiveRooms } from "../platform/live-rooms.js";
import { syncServiceUrl } from "../save-data/transfer-config.js";
import { liveCountOf } from "../view/title-online-panel.js";
import type { OnlineData } from "./online.js";
import { checkForUpdate, latestReleaseVersion, type AvailableUpdate } from "../platform/update-check.js";
import {
  OLD_SAVE_OPEN_ID,
  OLD_SAVE_PAGE_URL,
  dismissOldSaveNotice,
  oldSaveNoticeWanted,
} from "../platform/old-save-notice.js";
import {
  onSteamInstallChange,
  quitForSteamUpdate,
  steamInstall,
  type SteamInstall,
} from "../platform/steam-install.js";
import { leaveRoomAtTitle } from "../platform/live-watch.js";
import { clearGameAddress, releaseGameAddress } from "../platform/game-address.js";
import { clearWatchAddress } from "../live/watch-link.js";
import { steamAdd } from "../platform/steam-add.js";
import { lastUpdateFailed, readyUpdateVersion, selfUpdateInfo, type SelfUpdate } from "../platform/self-update.js";
import type { SteamUpdateSceneData } from "./steam-update.js";
import { STEAM_UPDATE_CLOSED } from "../view/steam-update.js";
import { initialSetupDraft, withSeatOne } from "../view/setup-draft.js";
import { rollSeed } from "../view/seed.js";
import { titleMenuFocusOrder } from "../view/screen-focus.js";
import {
  GAMES_PANEL_HEADER,
  titleMenuLayout,
  updateBannerActionCount,
  updateBannerParts,
  type UpdateBannerParts,
} from "../view/title-menu-layout.js";
import type { SaveMeta } from "../engine/game-storage.js";
import { appSession } from "../session.js";
import { drawGamesList } from "../ui/games-list.js";
import { GAME_LABEL_NAMES } from "../view/game-label-names.js";
import { drawBetaTagBeside } from "../ui/beta-tag.js";
import { BETA_TAG_TEXT, SHOW_BETA_TAGS } from "../view/beta-tag.js";
import { gameRowsOf, shouldShowGamesList, type GameRow } from "../view/games-list-model.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import type { GamesListOverlayData } from "./games-list.js";
import { guidePrefs, setGuideRunLevelOverride } from "../guide/guide-store.js";
import { isFirstLaunch } from "../guide/guide-prefs.js";
import { continueLabelOf } from "../view/continue-label.js";
import {
  CIVIL_WAR_CYCLE_ID,
  CIVIL_WAR_TITLE_LABEL,
  civilWarTitleEntryOf,
  enterBuilder,
  setBuilderOrigin,
} from "../view/civil-war-entry.js";
import {
  earnedAchievementIds,
  lifetimeChampionPoints,
  onProgressRead,
  refreshUnlocks,
  unlocks,
} from "../progression/progression.js";
import { lastRankSeen, rememberRankSeen } from "../platform/rank-seen.js";
import { rankUpAnnouncementOf, titleRankBadgeOf } from "../view/title-rank-badge.js";
import type { CivilWarBuilderData } from "./civil-war-builder.js";
import { tutorialResumeDecisionFor } from "../guide/tutorial-resume.js";
import { TUTORIAL_LESSONS } from "../guide/tutorial-lessons.js";
import type { TutorialResumeConfirmData } from "./tutorial-resume-confirm.js";
import {
  CHROME_LANGUAGE_STOP,
  CHROME_MUSIC_STOP,
  CHROME_REPORT_STOP,
  CHROME_THEME_STOP,
  FocusRoute,
  type FocusStop,
} from "./focus-route.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { isDesktopType } from "../ui/desktop-type.js";
import type { ShortcutId } from "../view/input-shortcuts.js";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { SheetBuilder } from "../dom/sheet-builder.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import {
  MENU_LABEL,
  bannerButtonOf,
  bannerModelOf,
  continueIconOf,
  promoModelOf,
  rankBarOf,
} from "../dom/title-panel-model.js";
import { hasDesktopWindow, quitToDesktop } from "../platform/desktop-window.js";
import { onSyncApplied } from "../sync/sync-events.js";
import { onLanguageChange } from "../language-change.js";
import { t, type MessageKey } from "../i18n/translate.js";
import { takeReceiveLink, takeSyncLink } from "../save-data/receive-link.js";
import { openReplay, replayErrorKey } from "../replay/replay-files.js";
import { introReplay } from "./replay-entry.js";
import { maybeAskGlobalStats } from "./global-ask-launch.js";
import { maybeShowSyncSetupPrompt } from "./sync-setup-prompt-launch.js";
import { maybeShowRendererNotice } from "./renderer-notice-launch.js";
import { SCENES } from "./keys.js";
import type { PlayerStatsData } from "./player-stats.js";
import type { ScenarioSelectData } from "./scenario-select.js";
import type { Deck } from "@mc/content";
import { destroyChildren } from "../ui/destroy-children.js";
import { setReportSlot } from "../ui/report-slot.js";
import { setMusicSlot } from "../ui/music-slot.js";
import { musicSlotBeside } from "../view/music-player.js";
import { languageSlotBeside } from "../view/language-button.js";
import { themeSlotBeside } from "../view/theme-button.js";
import { drawStoreIconButton } from "../ui/store-icon.js";
import { drawCountBadge } from "../ui/count-badge.js";
import {
  badgeTextOf,
  CHECK_INTERVAL_MS,
  checkPackUpdates,
  onPackUpdateCount,
  packUpdateCount,
} from "../packs/pack-updates.js";
import { drawDiscordIconButton, type DiscordIconButton } from "../ui/discord-icon.js";
import { fadeScreenIn, goToScreen, holdScreenFor } from "../ui/transitions.js";
import {
  RELEASE_NOTICE_FOLLOW_LATEST,
  RELEASE_NOTICE_LINK_SHORT,
  RELEASE_NOTICE_ON,
  RELEASE_NOTICE_VERSION,
  noticeBarParts,
  noticeVersionOf,
} from "../view/release-notice.js";
import { openReleaseReport } from "../ui/release-notice-bar.js";

/**
 * "Play this deck ▸" (W9, docs/phase4-screen-gaps.md §3): the Decks screen starts Title with the deck to seat.
 * Title doesn't draw in that case — it builds a fresh draft with that deck alone in seat 1 (`withSeatOne`) and
 * goes straight to Take your seats, seeding the deck into that screen's list so it's seatable before
 * `deckStorage().list()` resolves (Seats prunes unknown seats on every rebuild).
 */
export interface TitleSceneData {
  readonly initialSeatDeckId?: string;
  /** The deck itself; ignored if its `id` doesn't match `initialSeatDeckId`. */
  readonly initialSeatDeck?: Deck;
  /** Why a shared replay's link didn't open after all (`scenes/replay-versus.ts`, #858): said at the top for a moment. */
  readonly replayProblem?: MessageKey;
}

/**
 * A fresh New game draft: a new seed, every seat blank and, by default, no villain picked. Nothing is preselected
 * (owner, 2026-10-26): Scenario select and Take your seats each wait for the player's pick. `picked` seeds the pool's
 * first scenario as the pick, for the two entries that skip Scenario select (Civil War!'s builder, "Play this deck").
 * Shared with the first-run chooser (`scenes/guide-chooser.ts`), whose "Hints only" / "No guide" continue straight
 * into scenario select.
 */
export function newGameDraft(picked = false): ReturnType<typeof initialSetupDraft> {
  return initialSetupDraft({
    scenarioId: POOL_SCENARIOS[0]!.id as string,
    seatDeckId: null,
    scenarioPicked: picked,
    seed: rollSeed(),
  });
}

export class TitleScene extends Phaser.Scene {
  #buttons: McButton[] = [];
  /** Why the game picked to resume could not be, said above the footer. */
  #statusText: string | null = null;
  #starting = false;
  /** The game in progress when this screen opened, if any — looked up asynchronously; the screen draws without it first. */
  #continuable: SaveMeta | null = null;
  /** Every game in progress (several can be, #276), newest first, without guided lesson saves. */
  #games: readonly SaveMeta[] = [];
  /** The games panel's scroll offset, kept across the redraws a resize or a sync makes. */
  #gamesScroll = new VariableListScroll();
  /** The game the panel is asking "Remove this game?" about, or null while it lists. */
  #removing: string | null = null;
  #removeBusy = false;
  /** Why the last Remove failed, shown in the question until it is answered again. */
  #removeError: string | null = null;
  /** A newer release with an installer for this platform (native apps only), once GitHub has answered. */
  #update: AvailableUpdate | null = null;
  /** The web game's "Looking for your old save?" banner (`platform/old-save-notice.ts`), until it is closed. */
  #oldSave = false;
  /**
   * The saved games could not be read: the read failed, or is still pending `SAVES_STUCK_MS` in (iOS can leave an
   * IndexedDB open pending for good after it reloads a killed tab, #871). Shown as a Reload banner, not an empty menu.
   */
  #savesStuck = false;
  /** Saves reads started, across visits: only the newest one's answer is used (`#refreshSaves`). */
  #savesRead = 0;
  /** The Install for Steam script's record of this install, once read (`platform/steam-install.ts`). */
  #steam: SteamInstall | null = null;
  /** Whether this install updates itself (`platform/self-update.ts`), once the shell has said. */
  #selfUpdate: SelfUpdate | null = null;
  /** A downloaded update waiting for the game to restart (or, for the Steam script, to quit), by its version. */
  #readyVersion: string | null = null;
  /** The ready version whose banner the player closed this visit: the 2-second recheck must not bring it back. */
  #readyDismissed: string | null = null;
  /** The last update was downloaded and the game quit for it, but it didn't install (the old game started again). */
  #updateFailed = false;
  /** This visit's picture (`art/title-art.ts`), chosen once per `create` so a resize redraws the same one. */
  #art: TitleArt | null = null;
  #artPanel: { x: number; y: number; width: number; height: number } | null = null;
  /** Bumped by every `#rebuild`, so a picture that finishes loading after a redraw is placed by the current one only. */
  #artGeneration = 0;
  /** "Rank up: <title>" while the badge shows the fanfare (a few seconds after the Title opens), else null. */
  #rankUp: string | null = null;
  #route: FocusRoute | null = null;
  /** The scene's glyph hints (pad and keyboard only): R3 / F jumps to the in-progress games. */
  #hints: GlyphHints | null = null;
  /** The Trophy Room hand-off drawn this rebuild (its button and the rank tile press it), for the View button. */
  #openTrophies: (() => void) | null = null;
  #stops = new Map<string, FocusStop>();
  /** How many public rooms were live when the Title opened (one fetch, never polled), or null before an answer. */
  #liveCount: number | null = null;
  #liveAsked = false;
  /** The top row's Discord icon (tablet/desktop), for its focus label; rebuilt with the screen. */
  #discordIcon: DiscordIconButton | null = null;
  /** Why a replay didn't open, and until when it is said (`#replayProblem`). */
  #problem: { readonly text: string; readonly until: number } | null = null;
  /** The panel over the canvas (`@mc/ui`'s `mc-title-panel`), made once a visit so the menu's scroll stays. */
  #region: DomRegion<McTitlePanel> | null = null;
  /** The panel's glyphs (pad and keyboard only), drawn in the DOM since Phaser's would sit under the panel. */
  #glyphs: SheetGlyphs | null = null;
  /** What a key does when the panel reports a tap on it, or a focus stop is pressed. */
  #actions = new Map<string, () => void>();
  /** Builds the panel's model from what the last `#rebuild` laid out and renders it: a focus move redraws only this. */
  #compose: (() => void) | null = null;
  /** The Phaser parts the panel leaves showing through it (the games panel, the storefront and Discord icons). */
  #holes: readonly Rect[] = [];
  /** Where the menu scrolls on a window too short for it, or null (`layout.menuScroll`). */
  #menuScrollRect: Rect | null = null;
  /** The release the news bar names: the pinned one until GitHub names the latest. */
  #noticeVersion = RELEASE_NOTICE_VERSION;

  constructor() {
    super(SCENES.title);
  }

  /** A game in progress, watched so far as a replay (#693) without resuming it; Exit comes back here. */
  async #watchSaved(save: SaveMeta): Promise<void> {
    if (this.#starting) return;
    try {
      const host = await openReplay({ kind: "stored", gameId: save.id });
      if (!this.sys.isActive()) return host.dispose();
      await introReplay(this, host, SCENES.title);
    } catch (cause) {
      if (this.sys.isActive()) this.#replayProblem(t(replayErrorKey(cause)));
    }
  }

  /** Says why a replay didn't open, at the top of the screen, for a few seconds (drawn again by every `#rebuild`). */
  #replayProblem(text: string): void {
    this.#problem = { text, until: this.time.now + REPLAY_PROBLEM_MS };
    this.#compose?.();
    this.time.delayedCall(REPLAY_PROBLEM_MS, () => {
      this.#problem = null;
      if (this.sys.isActive()) this.#compose?.();
    });
  }

  create(data: TitleSceneData = {}): void {
    // A room's game hands back here: leave the room (a no-op for every single-player visit).
    leaveRoomAtTitle();
    // Title is where a game, a watch or a room is left: none of them belongs in the address any more.
    releaseGameAddress();
    clearGameAddress();
    clearWatchAddress();
    this.#readyDismissed = null;
    this.#problem = null;
    this.#statusText = null;
    this.#region = null;
    if (data.initialSeatDeckId) {
      // The player still picks what to play against first; the deck waits in seat one on Take your seats (#958).
      const draft = withSeatOne(this.#freshDraft(), data.initialSeatDeckId);
      const seedDecks =
        data.initialSeatDeck && data.initialSeatDeck.id === data.initialSeatDeckId ? [data.initialSeatDeck] : [];
      goToScreen(this, SCENES.scenarioSelect, { draft, seedDecks } satisfies ScenarioSelectData);
      return;
    }
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#oldSave = oldSaveNoticeWanted(detectPlatform());
    this.scale.on("resize", this.#rebuild, this);
    this.#hints = new GlyphHints(this);
    // The panel's own glyphs: a new input device or setting redraws just the panel.
    this.#glyphs = new SheetGlyphs(this, () => this.#compose?.());
    // The footer says when power saving mode is on (`platform/power-saving.ts`).
    const unsubscribePowerSaving = onPowerSavingChange(() => {
      if (this.sys.isActive()) this.#rebuild();
    });
    // A language switch (#390): the menu reads again in the new language.
    const unsubscribeLanguage = onLanguageChange(() => {
      if (this.sys.isActive()) this.#rebuild();
    });
    // A device sync that brought in saves from another device: Continue reads the newest save again (#276).
    const unsubscribeSync = onSyncApplied(() => {
      if (!this.sys.isActive()) return;
      void this.#refreshSaves();
    });
    // Installed mod packs with a newer version in the store: the Mod Store button and icon wear the count.
    const unsubscribePackUpdates = onPackUpdateCount(() => {
      if (this.sys.isActive()) this.#rebuild();
    });
    // Checked again while the Title stays open (the checker fetches at most once an interval) and when the network
    // comes back, so an update published meanwhile, or a check that failed offline, still reaches the badge.
    void checkPackUpdates();
    this.time.addEvent({ delay: CHECK_INTERVAL_MS, loop: true, callback: () => void checkPackUpdates() });
    // The "Play online" panel reads as unavailable while offline, and again as available once the network is back.
    const onlineChanged = (): void => {
      if (this.sys.isActive()) this.#rebuild();
    };
    const recheckOnline = (): void => {
      void checkPackUpdates();
      onlineChanged();
    };
    globalThis.addEventListener?.("online", recheckOnline);
    globalThis.addEventListener?.("offline", onlineChanged);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      globalThis.removeEventListener?.("offline", onlineChanged);
      this.scale.off("resize", this.#rebuild, this);
      unsubscribePackUpdates();
      globalThis.removeEventListener?.("online", recheckOnline);
      unsubscribePowerSaving();
      unsubscribeLanguage();
      unsubscribeSync();
      this.#hints?.dispose();
      this.#hints = null;
      this.#glyphs?.dispose();
      this.#glyphs = null;
      this.#compose = null;
      this.#region = null;
    });
    this.#route = new FocusRoute(this, {
      // The whole icon row beside the menu, not just the note and the bug.
      topRow: true,
      // The icon row ends over the "Play online" panel on a wide screen: Down from it still goes to the menu column.
      notBelowChrome: ["play-online-host", "play-online-join"],
      // Up from the menu's first row reaches the icon row, then the notice bar above it.
      barAboveChrome: "release-notice",
      // The press glyphs on the top row and the notice bar show on the focused stop.
      // The panel is a DOM layer over the canvas, so the ring is drawn there too.
      ring: domFocusRing,
      // The right stick scrolls a menu that is too tall for the window.
      onScroll: (_dx, dy) => this.#region?.element.scroller?.scrollBy({ top: dy }),
      onFocusChange: () => {
        this.#hints?.refresh();
        this.#compose?.();
        this.#discordIcon?.setFocused(this.#route?.focused === "chrome:discord");
      },
      blocked: () =>
        this.scene.isActive(SCENES.inspect) ||
        this.scene.isActive(SCENES.settings) ||
        this.scene.isActive(SCENES.steamUpdate) ||
        this.scene.isActive(SCENES.gamesList),
      // R3 (and the Expand key, F / ;) snaps focus to the in-progress games, ready to scroll.
      onExpand: () => {
        if (this.#starting) return;
        // The first game's Resume, else the games row, else the remove question's "Keep it"; none of them a stop
        // (no games, nothing listed): leave focus where it is, as focusKey would drop it.
        const stop =
          [...this.#stops.keys()].find((key) => key.startsWith("game:")) ??
          ["games-row", "remove-keep"].find((key) => this.#stops.has(key));
        if (stop) this.#route?.focusKey(stop);
      },
      // X (G / H) closes the Building your stats toast while it shows; its ✕ wears the glyph.
      onToggle: () => {
        if (this.scene.isActive(SCENES.backfillToast))
          (this.scene.get(SCENES.backfillToast) as unknown as { dismiss(): void }).dismiss();
      },
      // View / Back (and the Peek key) is the Trophy Room, the same as its button.
      onView: () => {
        if (!this.#starting) this.#openTrophies?.();
      },
    });
    // Phaser reuses this scene instance across "back to title" round trips, so state from a previous visit
    // (a stuck "Starting…", a stale Continue) must not survive into this one.
    this.#continuable = null;
    this.#games = [];
    this.#removing = null;
    this.#removeBusy = false;
    this.#removeError = null;
    this.#gamesScroll = new VariableListScroll();
    this.#starting = false;
    this.#rankUp = null;
    this.#savesStuck = false;
    // The picture the last visit already loaded for this one, so it is there when the screen fades in.
    this.#art = nextTitleArt ?? this.#pickArt();
    lastTitleArtKey = this.#art?.key ?? null;
    nextTitleArt = null;
    appSession().music?.playTitle();
    this.#checkRankUp();
    this.#rebuild();
    fadeScreenIn(this);
    holdScreenFor(this, this.#artLoaded());
    this.time.delayedCall(NEXT_ART_PRELOAD_MS, () => this.#preloadNextArt());
    // Opened from a Send screen's QR code: straight to Settings, Save data, Receive (read and cleared once).
    if (data.replayProblem) this.#replayProblem(t(data.replayProblem));
    const receive = takeReceiveLink();
    if (receive) this.scene.launch(SCENES.settings, { receive });
    // Opened from a device-sync link's QR code: Save data, Sync across devices, asking to join (read and cleared once).
    const syncLink = takeSyncLink();
    if (syncLink) this.scene.launch(SCENES.settings, { syncLink });
    // The one-time "Set up cross-device sync?" question; it decides for itself and stays out of a link's way.
    // The global win rates question comes only once that one has been decided, and never in the same visit. The
    // "Drawing without WebGL" notice (a browser with no WebGL, on the Canvas fallback) goes first and puts both off.
    else if (!receive && !maybeShowRendererNotice(this))
      void maybeShowSyncSetupPrompt(this).then((asked) => maybeAskGlobalStats(this, asked));
    // Points may have moved since Boot read them (a game just ended): read again, and announce a rank gained.
    // Both reads land before the screen fades in (`holdScreenFor`), so the menu is not seen redrawing for them.
    // Any read that lands redraws the menu and checks the rank (`onProgressRead`), Boot's own included: Boot goes on
    // without it after a few seconds (#871), so it can land after this screen is up, and after this read.
    const unsubscribeProgress = onProgressRead(() => {
      if (!this.sys.isActive()) return;
      this.#checkRankUp();
      this.#rebuild();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribeProgress);
    holdScreenFor(
      this,
      refreshUnlocks().catch(() => false),
    );
    holdScreenFor(this, this.#refreshSaves());
    // Read now so Settings ▸ More can offer Add to Steam (#844) when it opens; once it has added the game, the Title
    // takes the Steam script's update and says so, without a relaunch.
    void steamAdd();
    const unsubscribeSteam = onSteamInstallChange((install) => {
      if (!this.sys.isActive()) return;
      this.#steam = install;
      this.#rebuild();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribeSteam);
    void steamInstall().then((install) => {
      if (!install || !this.sys.isActive()) return;
      this.#steam = install;
      this.#rebuild();
    });
    void selfUpdateInfo().then((info) => {
      if (!info || !this.sys.isActive()) return;
      this.#selfUpdate = info;
      this.#rebuild();
    });
    this.#checkReadyUpdate();
    // A download left going in the background can finish while the player stays here: ask again now and then, so
    // the banner turns to "restart to apply" without leaving the screen. (Phaser stops the timer with the scene.)
    if (detectPlatform() === "tauri") {
      this.time.addEvent({ delay: READY_CHECK_MS, loop: true, callback: () => this.#checkReadyUpdate() });
    }
    void lastUpdateFailed().then((failed) => {
      if (!failed || !this.sys.isActive()) return;
      this.#updateFailed = true;
      this.#rebuild();
    });
    // The news bar names the latest release once GitHub has answered.
    if (RELEASE_NOTICE_FOLLOW_LATEST) {
      void latestReleaseVersion().then((latest) => {
        this.#noticeVersion = noticeVersionOf(latest);
        if (this.sys.isActive()) this.#compose?.();
      });
    }
    void checkForUpdate().then((update) => {
      // A banner the player closed for this very release stays closed; a newer release brings it back.
      if (!update || !this.sys.isActive() || isUpdateDismissed(update.version, dismissedUpdateVersion())) return;
      this.#update = update;
      this.#rebuild();
    });
  }

  /**
   * The rank-up fanfare (docs/achievements.md): when the Title shows a higher rank than the last visit stored, the
   * badge turns red and reads "Rank up: <name>" for a few seconds, with the short Extras sting. The rank is
   * remembered at once, so a second check (after the refresh) or a redraw never repeats it.
   */
  #checkRankUp(): void {
    // Not on points nobody has read yet: Boot can reach Title before the first progress read lands (#871).
    if (earnedAchievementIds() === null) return;
    const result = rankUpAnnouncementOf(lastRankSeen(), lifetimeChampionPoints());
    rememberRankSeen(result.remember);
    if (!result.announce) return;
    this.#rankUp = result.text;
    appSession().music?.playEffect("extras-unlocked");
    this.time.delayedCall(RANK_UP_MS, () => {
      if (!this.sys.isActive()) return;
      this.#rankUp = null;
      this.#rebuild();
    });
  }

  /** The games the list shows: all of them, or none when Continue already is the only one (`shouldShowGamesList`). */
  #listedGames(): readonly SaveMeta[] {
    return shouldShowGamesList(
      this.#games.map((save) => save.id),
      this.#continuable?.id ?? null,
    )
      ? this.#games
      : [];
  }

  /**
   * Reads the newest game (Continue) and every game in progress (the list) again, then redraws. Only the newest read
   * counts (`#savesRead`): an older one that lands late, or one from an earlier visit, changes nothing. A read that
   * fails, or is still the newest and pending after `SAVES_STUCK_MS`, puts up the Reload banner (#871) rather than a
   * menu with no games on it that looks normal; a read that works takes it down.
   */
  async #refreshSaves(): Promise<void> {
    const read = ++this.#savesRead;
    let settled = false;
    this.time.delayedCall(SAVES_STUCK_MS, () => {
      if (settled || read !== this.#savesRead || this.#savesStuck || !this.sys.isActive()) return;
      this.#savesStuck = true;
      this.#rebuild();
    });
    const { latest, games, failed } = await appSession().store.titleSaves();
    settled = true;
    if (read !== this.#savesRead || !this.sys.isActive()) return;
    this.#continuable = latest;
    this.#games = games;
    this.#savesStuck = failed;
    // A game asked about that has since gone (synced away, removed on another screen): drop the question.
    if (this.#removing !== null && !games.some((save) => save.id === this.#removing)) this.#removing = null;
    this.#rebuild();
  }

  /** "Remove" confirmed: the game is retired (counts as played, cannot be resumed) and the list reads again. */
  async #removeGame(row: GameRow): Promise<void> {
    if (this.#removeBusy) return;
    this.#removeBusy = true;
    this.#removeError = null;
    // Drawn unavailable while the write is in flight, so a second tap can't ask twice.
    this.#rebuild();
    try {
      await appSession().store.retireSave(row.id);
      this.#removing = null;
    } catch (cause) {
      this.#removeError = `Could not remove it: ${cause instanceof Error ? cause.message : String(cause)}`;
    }
    this.#removeBusy = false;
    if (!this.sys.isActive()) return;
    await this.#refreshSaves();
  }

  /** The phone's "In-progress games (N)" row: the list full screen, over this one. */
  #openGamesList(): void {
    if (this.scene.isActive(SCENES.gamesList)) return;
    this.scene.launch(SCENES.gamesList, {
      from: this.scene.key,
      saves: this.#listedGames(),
      onResume: (save) => void this.#resume(save),
      onWatch: (save) => void this.#watchSaved(save),
      onChanged: () => void this.#refreshSaves(),
    } satisfies GamesListOverlayData);
  }

  #rebuild(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#stops = new Map();
    this.#discordIcon = null;
    destroyChildren(this);
    this.#hints?.reset();

    const { width, height } = this.scale.gameSize;
    const civilWar = civilWarTitleEntryOf(unlocks().waveLock(CIVIL_WAR_CYCLE_ID), POOL_SCENARIOS);
    const layout = titleMenuLayout({
      width,
      height,
      continuable: this.#continuable !== null,
      games: this.#listedGames().length,
      // The native apps' update banner and the web game's old-save banner share the slot; a build only ever has one.
      update: this.#update !== null || this.#oldSave || this.#readyVersion !== null || this.#savesStuck,
      civilWar: civilWar !== null,
      quit: hasDesktopWindow(),
      noticeBar: RELEASE_NOTICE_ON,
    });
    // The Report button's slot (#176): level with the eyebrow, at the menu column's right edge.
    const reportSize = layout.split ? 44 : 40;
    const reportRect = {
      x: layout.rightEdge - reportSize,
      y: Math.max(8, Math.round(layout.eyebrow.y + layout.eyebrow.height / 2 - reportSize / 2)),
      width: reportSize,
      height: reportSize,
    };
    setReportSlot(this.scene.key, reportRect);
    // The music button's (#191), just left of it.
    const musicRect = musicSlotBeside(reportRect);
    setMusicSlot(this.scene.key, musicRect);

    // Ground: split desktop/tablet (ink art panel left, red rule, paper menu panel right); one ink ground on phone.
    if (layout.split) {
      this.add
        .rectangle(
          layout.artPanel!.x,
          layout.artPanel!.y,
          layout.artPanel!.width,
          layout.artPanel!.height,
          surface.ink.hex,
        )
        .setOrigin(0, 0)
        .setDepth(ART_GROUND_DEPTH);
      paintDotGrid(this, layout.artPanel!, "ink", dotGrid.onInk).setDepth(ART_GROUND_DEPTH);
      this.#artPanel = layout.artPanel!;
      this.add
        .rectangle(
          layout.divider!.x,
          layout.divider!.y,
          layout.divider!.width,
          layout.divider!.height,
          accent.heroRed.hex,
        )
        .setOrigin(0, 0);
      this.add
        .rectangle(
          layout.menuPanel.x,
          layout.menuPanel.y,
          layout.menuPanel.width,
          layout.menuPanel.height,
          surface.paper.hex,
        )
        .setOrigin(0, 0);
      paintDotGrid(this, layout.menuPanel, "paper", dotGrid.onPaper);
    } else {
      this.add.rectangle(0, 0, width, height, surface.ink.hex).setOrigin(0, 0).setDepth(ART_GROUND_DEPTH);
      paintDotGrid(this, { x: 0, y: 0, width, height }, "ink", dotGrid.onInk).setDepth(ART_GROUND_DEPTH);
      // Phone has no art panel (P01 stacks everything on one ink ground): the picture goes full-bleed under an
      // ink scrim so the paper text on top stays legible.
      this.add.rectangle(0, 0, width, height, surface.ink.hex, 0.62).setOrigin(0, 0).setDepth(ART_SCRIM_DEPTH);
      this.#artPanel = { x: 0, y: 0, width, height };
    }

    // Text/menu color: ink-on-paper when split, paper-on-ink on phone (`surface.paper` doubles as the dark-ground text color).
    const onDark = !layout.split;
    const textColor = onDark ? surface.paper.hex : surface.ink.hex;
    const menuKind = onDark ? "onInk" : "secondary";

    const eyebrowText = this.add
      .text(layout.eyebrow.x, layout.eyebrow.y, t("title.eyebrow"), textStyle(typeRole.label, accent.heroRed.hex, 1))
      .setLetterSpacing(1);
    this.add
      .text(layout.left, layout.eyebrow.y + layout.eyebrow.height + 8, "MARVEL\nCHAMPIONS", {
        ...textStyle(typeRole.screenTitle, textColor),
        fontSize: `${layout.titleSize}px`,
        lineSpacing: -Math.round(layout.titleSize * 0.16),
      })
      .setLetterSpacing(2);
    this.add.rectangle(layout.rule.x, layout.rule.y, layout.rule.width, layout.rule.height, textColor).setOrigin(0, 0);

    // The menu, the banners, the rank plate, the promo panel and the footer are a Lit panel over the canvas
    // (`@mc/ui`'s `mc-title-panel`, `#mountPanel`); the ground, the picture, the logo, the games panel and the corner
    // buttons stay Phaser's, drawn under it (the panel leaves the canvas showing wherever it has nothing).
    const measure = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    const wordWidth = (text: string): number => measure.measure(text, { ...typeRole.label, uppercase: false }).width;
    const stops = new Map<string, FocusStop>();
    const actions = new Map<string, () => void>();
    const scrolls = layout.menuScroll !== null;
    this.#menuScrollRect = layout.menuScroll;
    const act = (key: string, activate: () => void, rect: Rect, inScroll = scrolls): void => {
      actions.set(key, activate);
      stops.set(key, this.#domStop(key, activate, rect, inScroll));
    };
    const menu: MenuButton[] = [];
    const kindOf = menuKind as MenuButton["kind"];
    const row = (
      key: string,
      label: string,
      rect: Rect,
      activate: () => void,
      extra: Partial<MenuButton> = {},
    ): void => {
      menu.push({
        key,
        label,
        kind: kindOf,
        rect,
        ...MENU_LABEL,
        ...extra,
      });
      act(key, activate, rect);
    };

    if (layout.continueRow) {
      const save = this.#continuable!;
      const rect = layout.continueRow;
      // Where the game was last played (device sync, #276): a mark at the row's left edge, beside the label.
      const mark = playPlatformMarkOf(save.lastPlayedOn);
      const withIcon = mark ? continueIconOf(mark, rect) : null;
      // A built game's label names its stages and sets: wrapped onto a second line rather than cut.
      row("continue", continueLabel(save), rect, () => void this.#resume(save), {
        kind: "primary",
        wrap: true,
        disabled: this.#starting,
        ...(withIcon ? { icon: withIcon.icon, labelInset: withIcon.labelInset } : {}),
      });
      // Dev-only e2e hook: the platform whose mark the Continue row drew (never read by product code).
      if (import.meta.env.DEV) {
        (window as unknown as { __mcContinuePlatform?: string | null }).__mcContinuePlatform = mark?.platform ?? null;
      }
    }

    const gameRows = layout.gamesPanel ? gameRowsOf(this.#listedGames(), GAME_LABEL_NAMES, Date.now()) : [];
    if (layout.gamesRow) {
      row(
        "games-row",
        t("title.gamesRow", { count: this.#listedGames().length }),
        layout.gamesRow,
        () => this.#openGamesList(),
        {
          disabled: this.#starting,
          ...(SHOW_BETA_TAGS && layout.gamesRow.width >= 300 ? { tag: BETA_TAG_TEXT } : {}),
        },
      );
    }

    row("new-game", this.#starting ? t("title.starting") : t("title.newGame"), layout.newGame, () => this.#newGame(), {
      kind: "primary",
      plain: false,
      display: true,
      size: typeRole.barTitle.size,
      disabled: this.#starting,
    });

    const goTo = (scene: string, data?: object) => (): void => {
      this.scale.off("resize", this.#rebuild, this);
      goToScreen(this, scene, data);
    };
    row("decks", t("title.decks"), layout.decks, goTo(SCENES.decks));
    row("campaign", t("title.campaign"), layout.campaign, goTo(SCENES.campaignSaga));

    // "Play online" (#880): an entry point only. Nothing online starts, and nothing is loaded, until its own screen is used.
    const openOnline = (intent?: OnlineData["intent"]): void =>
      goTo(SCENES.online, intent ? ({ intent } satisfies OnlineData) : undefined)();
    if (layout.playOnline) row("play-online", t("title.playOnline"), layout.playOnline, () => openOnline());
    let promo: TitlePanelModel["promo"] = null;
    // A tablet or desktop gets the feature panel instead (`view/title-online-panel.ts`): the same two flows, one press away.
    if (layout.onlinePanel) {
      const available = this.#onlineAvailable();
      const count = available ? liveCountOf(this.#liveCount) : null;
      promo = {
        rect: layout.onlinePanel.rect,
        scrolls: layout.onlinePanel.placement === "side",
        model: promoModelOf(
          layout.onlinePanel,
          {
            title: t("title.playOnline"),
            pitch: available ? t("title.online.pitch") : t("title.online.offline"),
            liveText: count !== null ? t("title.online.live", { count }) : null,
            host: t("online.host"),
            join: t("online.join"),
          },
          available,
        ),
      };
      const side = layout.onlinePanel.placement === "side" && scrolls;
      act("play-online-host", () => openOnline("host"), layout.onlinePanel.host, side);
      act("play-online-join", () => openOnline("join"), layout.onlinePanel.join, side);
      if (!this.#liveAsked) {
        this.#liveAsked = true;
        // One fetch when the Title opens, never polled; every failure is an empty answer, so offline just shows no count.
        void fetchLiveRooms().then((rooms) => {
          if (rooms.length === 0 || !this.sys.isActive()) return;
          this.#liveCount = rooms.length;
          this.#rebuild();
        });
      }
    }

    // "Civil War!": the box's own entry, once it is open. The last build, or the first leader as printed.
    if (civilWar && layout.civilWar) {
      row("civil-war", CIVIL_WAR_TITLE_LABEL, layout.civilWar, () => {
        const entry = enterBuilder("build", newGameDraft(true), civilWar.scenarioId);
        setBuilderOrigin("title");
        goTo(SCENES.civilWarBuilder, {
          draft: entry.draft,
          step: entry.step,
        } satisfies CivilWarBuilderData)();
      });
    }

    row("extras", t("title.extras"), layout.extras, goTo(SCENES.extras));
    row("past-games", t("title.pastGames"), layout.pastGames, goTo(SCENES.pastGames));
    const openTrophies = goTo(SCENES.trophyRoom);
    this.#openTrophies = openTrophies;
    row("trophies", t("title.trophyRoom"), layout.trophies, openTrophies);
    row(
      "stats",
      t("title.yourStats"),
      layout.stats,
      goTo(SCENES.playerStats, { from: SCENES.title } satisfies PlayerStatsData),
    );
    // "How to play" (guided mode G6c, `docs/guided-mode.md` §4): the learning hub. Not a guided run by itself —
    // starting a lesson from inside the hub is what sets `appSession().guidedRun` (`guide/start-tutorial.ts`).
    row("how-to-play", t("title.howToPlay"), layout.howToPlay, goTo(SCENES.howToPlay));
    // The Mod Store, a main-menu item of its own (issue #734, bluefireF5ran's playtest notes).
    const openModStore = goTo(SCENES.modStore);
    const packUpdates = packUpdateCount();
    row("mod-store", t("title.modStore"), layout.modStore, openModStore, {
      ...(packUpdates > 0 ? { badge: badgeTextOf(packUpdates) } : {}),
    });
    // W4's Settings is an overlay: launched over this scene, it stops itself on Back (`scenes/settings.ts`).
    row("settings", t("title.settings"), layout.settings, () => this.scene.launch(SCENES.settings));
    // The desktop app has no browser tab to close, so it offers its own way out (the owner, 2026-10-16).
    if (layout.quit) row("quit", t("title.quit"), layout.quit, () => void quitToDesktop());

    // The footer: the app's card-pool coverage, the release notes, the build version and, where the top row has no room
    // for the Discord icon, a Discord link. A phone's footer has no room for all of it (the panel drops the coverage note).
    const coverage = cardPoolCoverageOf(POOL_CARDS, POOL_DEPS);
    const version = appVersionText(
      CLIENT_VERSION,
      detectPlatform(),
      buildCommit(),
      cardLanguage(),
      this.#steam !== null,
    );
    const { detected, applied } = powerSavingState();
    const releaseNotes = (): void =>
      openExternal(
        releaseNotesPageUrl(CLIENT_VERSION, globalThis.location?.href ?? "", isNativeShell(), artLanguageNow()),
      );
    const releaseLabel = t("title.releaseNotes");
    // The Discord icon's slot in the top row (#759), left of the storefront on a tablet or desktop and, on a phone, left of
    // the theme button where the eyebrow leaves room (its width varies by language); none where it would touch the eyebrow.
    const topLanguage = languageSlotBeside(musicRect);
    const topTheme = themeSlotBeside(topLanguage);
    const discordIconRect = layout.split ? themeSlotBeside(themeSlotBeside(topTheme)) : themeSlotBeside(topTheme);
    const discordIconFits = discordIconRect.x >= eyebrowText.x + eyebrowText.width + 8;
    // The Discord icon in the top row stands in for this link (#759): never both at once. Where the top row has no room
    // for the icon, the link is the only Discord control, kept where it clears the footer's left edge.
    const openDiscord = (): void => openExternal(DISCORD_INVITE_URL);
    const footerRight = layout.footer.x + layout.footer.width;
    const releaseLeft = footerRight - wordWidth(version) - 16 - wordWidth(releaseLabel);
    const discordLeft = releaseLeft - 24 - wordWidth(DISCORD_LINK_LABEL);
    const discord = !discordIconFits && discordLeft - 6 >= layout.footer.x;
    act("release-notes", releaseNotes, layout.footer);
    if (discord) act("discord", openDiscord, layout.footer);
    const footer: TitlePanelModel["footer"] = {
      rect: layout.footer,
      model: {
        note: cardPoolCoverageText(coverage),
        version,
        links: [
          { key: "release-notes", label: releaseLabel },
          ...(discord ? [{ key: "discord", label: DISCORD_LINK_LABEL }] : []),
        ],
        aside: powerSavingFooterOf(detected, applied),
      },
    };

    // The games panel sits in the art panel, outside the menu's scroll region: Phaser draws it, and the panel leaves a hole there.
    const holes: Rect[] = [];
    if (layout.gamesPanel && layout.gamesPanelList) {
      this.#drawGamesPanel(layout.gamesPanel, layout.gamesPanelList, gameRows, stops);
      holes.push(layout.gamesPanel);
    }

    // The top row's press glyphs, hung under each button while it has focus. The corner buttons are chrome scenes of
    // their own, with no hints.
    const languageRect = languageSlotBeside(musicRect);
    const topRow: readonly (readonly [string, Rect])[] = [
      [CHROME_THEME_STOP, themeSlotBeside(languageRect)],
      [CHROME_LANGUAGE_STOP, languageRect],
      [CHROME_MUSIC_STOP, musicRect],
      [CHROME_REPORT_STOP, reportRect],
    ];
    const hangs: (readonly [string, Rect])[] = [...topRow];
    // The storefront button, left of the theme button: tablets and desktops only, where the top row has the room; a
    // phone has the menu item. Its stop is keyed as one of the top row's (`chrome:`), which it is on screen. A Phaser
    // icon the panel leaves a hole for, like the Discord icon.
    const storeIconRect = layout.split ? themeSlotBeside(themeSlotBeside(languageRect)) : null;
    if (storeIconRect) {
      drawStoreIconButton(this, storeIconRect, openModStore);
      if (packUpdates > 0)
        drawCountBadge(this, storeIconRect, badgeTextOf(packUpdates), { name: "store-icon", inset: 2 });
      stops.set("chrome:mod-store", { rect: storeIconRect, activate: openModStore });
      hangs.push(["chrome:mod-store", storeIconRect]);
      holes.push({
        x: storeIconRect.x - 2,
        y: storeIconRect.y - 12,
        width: storeIconRect.width + 14,
        height: storeIconRect.height + 12,
      });
    }
    // The Discord icon (#759); the footer link stands in for it where the top row has no room.
    if (discordIconFits) {
      this.#discordIcon = drawDiscordIconButton(this, discordIconRect, openDiscord);
      stops.set("chrome:discord", { rect: discordIconRect, activate: openDiscord });
      hangs.push(["chrome:discord", discordIconRect]);
      holes.push(discordIconRect);
    }

    const banner = this.#bannerSpec(layout.updateBanner);
    for (const button of banner?.buttons ?? []) act(button.id, button.activate, button.rect, false);
    act("rank-badge", openTrophies, layout.rankBadge, false);
    if (layout.noticeBar) act("release-notice", () => openReleaseReport(this.#noticeVersion), layout.noticeBar, false);
    this.#holes = holes;
    this.#compose = () => {
      const focused = this.#route?.focused ?? null;
      this.#glyphs?.reset();
      const menuNow = menu.map((model) =>
        model.key === "games-row" ? this.#withGlyph(model, ["expand"], "ink", typeRole.menuButton) : model,
      );
      // The hanging press glyphs of the top row, under the focused one.
      const hung = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
      for (const [key, anchor] of hangs) {
        if (focused !== key) continue;
        this.#glyphs?.hang(hung, {
          key,
          anchor,
          ids: ["activate"],
          height: TOP_ROW_GLYPH_HEIGHT,
          ground: onDark ? "ink" : "paper",
        });
      }
      let news: TitlePanelModel["news"] = null;
      if (layout.noticeBar) {
        const bar = layout.noticeBar;
        const full = t("title.news.link");
        const short =
          noticeBarParts(bar, measure.measure(full, typeRole.rowTitle).width).link === RELEASE_NOTICE_LINK_SHORT;
        const glyphScratch = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
        if (focused === "release-notice") {
          this.#glyphs?.hint(glyphScratch, {
            key: "release-notice",
            x: 0,
            y: 0,
            ids: ["activate"],
            height: Math.min(TOP_ROW_GLYPH_HEIGHT, bar.height - 8),
            ground: "ink",
          });
        }
        const glyph = glyphScratch.nodes.find((node) => node.kind === "glyph");
        news = {
          rect: bar,
          model: {
            tag: t("title.news.tag"),
            message: t("title.news.text", { version: this.#noticeVersion }),
            link: short ? t("title.news.linkShort") : full,
            glyph:
              glyph?.kind === "glyph"
                ? {
                    specs: glyph.specs,
                    height: glyph.height,
                    ground: glyph.ground,
                    openness: glyph.openness,
                    ...(glyph.still ? { still: true } : {}),
                  }
                : null,
          },
        };
      }
      const bannerModel = banner ? this.#bannerModel(banner, focused) : null;
      const panel: TitlePanelModel = {
        ground: onDark ? "ink" : "paper",
        scroll: layout.menuScroll,
        scrollHeight: layout.menuScroll ? layout.footer.y + layout.footer.height + layout.pad - layout.menuScroll.y : 0,
        news,
        banner: banner && bannerModel ? { rect: banner.rect, model: bannerModel } : null,
        rank: {
          rect: layout.rankBadge,
          model: rankBarOf(layout.rankBadge, titleRankBadgeOf(lifetimeChampionPoints()), this.#rankUp, {
            rankUp: t("title.rankUp"),
          }),
        },
        menu: menuNow,
        promo,
        footer,
        status: this.#statusText
          ? {
              rect: { x: layout.left, y: layout.footer.y - 24, width: layout.column, height: 20 },
              text: this.#statusText,
            }
          : null,
        problem: this.#problemText(),
        glyphs: hung.nodes.filter((node) => node.kind === "glyph"),
      };
      this.#mountPanel(panel);
    };

    this.#stops = stops;
    this.#actions = actions;
    this.#compose();
    this.#route?.set(
      [
        // The notice bar is the top-most control, so it comes first.
        ...(layout.noticeBar ? ["release-notice"] : []),
        ...titleMenuFocusOrder({
          continuable: this.#continuable !== null,
          civilWar: civilWar !== null,
          quit: layout.quit !== null,
          discord,
          updateActions: banner?.stops ?? [],
          gameIds: gameRows.map((gameRow) => gameRow.id),
          removeConfirm: this.#removing !== null && gameRows.some((gameRow) => gameRow.id === this.#removing),
          gamesRow: layout.gamesRow !== null,
          onlinePanel: layout.onlinePanel !== null,
        }),
        "rank-badge",
        ...(discordIconFits ? ["chrome:discord"] : []),
        ...(storeIconRect ? ["chrome:mod-store"] : []),
      ],
      this.#stops,
    );
    this.#drawArt();
  }

  /** Whether online play can be tried from here: a connection and a service. Anything else reads as unavailable. */
  #onlineAvailable(): boolean {
    const noNetwork = typeof navigator !== "undefined" && navigator.onLine === false;
    return !noNetwork && syncServiceUrl() !== null;
  }

  /** The "In-progress games" panel in the art panel (split screens): heading, then the list or the remove question. */
  #drawGamesPanel(panel: Rect, list: Rect, rows: readonly GameRow[], stops: Map<string, FocusStop>): void {
    this.add
      .rectangle(panel.x, panel.y, panel.width, panel.height, surface.ink.hex, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, surface.paper.hex);
    const heading = this.add
      .text(
        list.x,
        panel.y + 12 + (GAMES_PANEL_HEADER - typeRole.sectionHeader.size) / 2,
        t("title.games.heading", { count: rows.length }),
        textStyle(typeRole.sectionHeader, surface.paper.hex),
      )
      .setLetterSpacing(1);
    // The R3 glyph owns the header's right end; the Beta tag stops short of it (about 56px for glyph and gap).
    drawBetaTagBeside(this, heading, list.x + list.width - 56);
    this.#hints?.rightInRow(panel, panel.y + 12, GAMES_PANEL_HEADER, 14, ["expand"], 20);
    const confirming = this.#removing === null ? null : (rows.find((row) => row.id === this.#removing) ?? null);
    const drawn = drawGamesList(this, {
      area: list,
      rows,
      scroll: this.#gamesScroll,
      confirming,
      enabled: !this.#starting && !this.#removeBusy,
      error: this.#removeError,
      onResume: (row) => void this.#resume(row.save),
      onWatch: (row) => void this.#watchSaved(row.save),
      onAskRemove: (row) => {
        this.#removing = row.id;
        this.#rebuild();
      },
      onKeep: () => {
        this.#removing = null;
        this.#removeError = null;
        this.#rebuild();
      },
      onRemove: (row) => void this.#removeGame(row),
    });
    this.#buttons.push(...drawn.buttons);
    for (const [key, stop] of drawn.stops) stops.set(key, stop);
  }

  /**
   * The update banner's content (native apps, `platform/update-check.ts`; and the notices that share its slot): caution
   * yellow, the advisory color, with a heading, a detail line and a button per action. Saves that can't be read come
   * first, then a downloaded update waiting on a restart, the old-save notice (web), and the update on offer.
   */
  #bannerSpec(banner: Rect | null): BannerSpec | null {
    if (!banner) return null;
    const update = this.#update;
    const close = (onClose: () => void, parts: UpdateBannerParts): BannerButton => ({
      id: UPDATE_DISMISS_ID,
      kind: "secondary",
      label: "×",
      rect: parts.dismiss,
      activate: onClose,
    });
    if (this.#savesStuck) {
      // Nothing else on this screen works as it should until the saves can be read: one button reloads the page, which
      // is what brings a stuck IndexedDB back on iOS (#871); the close button hides it for this visit.
      const parts = updateBannerParts(banner, 1);
      return {
        rect: banner,
        parts,
        heading: t("title.savesStuck"),
        detail: t("title.savesStuckDetail"),
        buttons: [
          {
            id: SAVES_RELOAD_ID,
            kind: "primary",
            label: t("title.savesStuckReload"),
            rect: parts.buttons[0]!,
            activate: () => window.location.reload(),
          },
          close(() => {
            this.#savesStuck = false;
            this.#rebuild();
          }, parts),
        ],
        stops: [SAVES_RELOAD_ID],
      };
    }
    if (this.#readyVersion !== null) {
      // "The game has been updated, restart to apply" (issue #843): Restart quits; the updater installs and, for the
      // game's own updater, starts the game again. The Steam script's update leaves starting it again to Steam, so its
      // button says Quit. Close hides it for this visit; the update still installs whenever the game quits.
      const version = this.#readyVersion;
      const parts = updateBannerParts(banner, 1);
      const steam = this.#steam !== null;
      return {
        rect: banner,
        parts,
        heading: t("title.updateReady"),
        detail: t(steam ? "title.updateReadySteam" : "title.updateReadyDetail", { version }),
        buttons: [
          {
            id: UPDATE_RESTART_ID,
            kind: "primary",
            label: t(steam ? "title.updateQuit" : "title.updateRestart"),
            rect: parts.buttons[0]!,
            activate: () => void quitForSteamUpdate(),
          },
          close(() => {
            this.#readyDismissed = version;
            this.#readyVersion = null;
            this.#rebuild();
          }, parts),
        ],
        stops: [UPDATE_RESTART_ID],
      };
    }
    if (!update && this.#oldSave) {
      // The web game's "Looking for your old save?" banner (issue #723, `platform/old-save-notice.ts`): one button to
      // the moved page at the old address, whose steps recover the saves the browser kept there, and a close button that
      // hides it for good.
      const parts = updateBannerParts(banner, 1);
      return {
        rect: banner,
        parts,
        heading: t("title.oldSave"),
        detail: t("title.oldSaveDetail"),
        buttons: [
          {
            id: OLD_SAVE_OPEN_ID,
            kind: "primary",
            label: t("title.oldSaveOpen"),
            rect: parts.buttons[0]!,
            activate: () => openExternal(OLD_SAVE_PAGE_URL),
          },
          close(() => {
            dismissOldSaveNotice();
            this.#oldSave = false;
            this.#rebuild();
          }, parts),
        ],
        stops: [OLD_SAVE_OPEN_ID],
      };
    }
    if (!update) return null;
    // The game's own updater checks the download against the release's checksum, so it needs one.
    const selfUpdate = this.#selfUpdate !== null && update.downloadDigest !== null;
    const all = updateActions(update, this.#steam?.canUpdate === true, selfUpdate);
    const actions = all.slice(all.length - updateBannerActionCount(banner, all.length));
    const parts = updateBannerParts(banner, actions.length);
    return {
      rect: banner,
      parts,
      // The last try was downloaded but didn't install (the old game started again): said in the heading, which is short
      // enough for a phone's banner, where the version line would be cut off.
      heading: t(this.#updateFailed ? "title.updateFailed" : "title.updateAvailable"),
      detail: t("title.updateVersion", { version: update.version }),
      buttons: [
        ...actions.map((action, index): BannerButton => ({
          id: action.id,
          kind: action.id === "update-notes" ? "secondary" : "primary",
          label: action.label,
          rect: parts.buttons[index]!,
          activate: () =>
            action.url !== null
              ? openExternal(action.url)
              : this.#openSteamUpdate(update, action.id === "update-install"),
        })),
        close(() => {
          dismissUpdate(update.version);
          this.#update = null;
          this.#rebuild();
        }, parts),
      ],
      stops: actions.map((action) => action.id),
    };
  }

  /** The banner as the panel draws it, with the press glyph on the focused button (pad and keyboard only). */
  #bannerModel(spec: BannerSpec, focused: string | null): AlertBannerModel {
    const desktop = isDesktopType();
    return bannerModelOf(
      spec.rect,
      spec.parts,
      { heading: spec.heading, detail: spec.detail },
      spec.buttons.map((button) => {
        const model = bannerButtonOf(spec.rect, button.id, button.kind, button.label, button.rect, desktop);
        return focused === button.id ? this.#withGlyph(model, ["activate"], "ink", typeRole.rowTitle) : model;
      }),
    );
  }

  /**
   * `model` with a key or pad glyph beside its word (or hung just outside when the pair does not fit), as the Phaser
   * `GlyphHints.button` placed it: placed by the shared rules against a scratch sheet whose origin is the button's own,
   * so the glyph comes out in the button's coordinates.
   */
  #withGlyph(model: MenuButton, ids: readonly ShortcutId[], ground: "ink" | "paper", type: TypeSpec): MenuButton {
    if (!this.#glyphs) return model;
    const scratch = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    this.#glyphs.button(scratch, {
      key: model.key,
      rect: { x: 0, y: 0, width: model.rect.width, height: model.rect.height },
      label: model.label,
      look: model.kind,
      type,
      ids,
      ground,
    });
    const button = scratch.nodes.find((node) => node.kind === "button");
    const glyph = scratch.nodes.find((node) => node.kind === "glyph");
    return {
      ...model,
      ...(button?.kind === "button" && button.labelShift ? { labelShift: button.labelShift } : {}),
      ...(button?.kind === "button" && button.still ? { still: true } : {}),
      ...(button?.kind === "button" && button.keyshortcuts ? { keyshortcuts: button.keyshortcuts } : {}),
      ...(glyph?.kind === "glyph"
        ? {
            glyph: {
              x: glyph.x,
              y: glyph.y,
              specs: glyph.specs,
              height: glyph.height,
              ground: glyph.ground,
              openness: glyph.openness,
              ...(glyph.still ? { still: true } : {}),
            },
          }
        : {}),
    };
  }

  /**
   * A focus stop on a control the panel draws: its box is read off the panel when the ring is drawn (so it follows the
   * scroll), `fallback` (the layout's own rect) until the panel has rendered. In a scrolling menu it scrolls itself in.
   */
  #domStop(key: string, activate: () => void, fallback: Rect, scrolls: boolean): FocusStop {
    const found = (): HTMLElement | null => this.#region?.element.elementOf(key) ?? null;
    return {
      rect: () => {
        const element = found();
        return element && this.#region ? this.#region.rectOf(element) : fallback;
      },
      activate,
      ...(scrolls
        ? {
            view: (): Rect => {
              const scroller = this.#region?.element.scroller;
              return scroller && this.#region ? this.#region.rectOf(scroller) : (this.#menuScrollRect ?? fallback);
            },
            ensureVisible: (): void => found()?.scrollIntoView({ block: "nearest" }),
          }
        : {}),
    };
  }

  /** The panel (made once a visit, so the menu's scroll stays) takes its model and renders now. */
  #mountPanel(model: TitlePanelModel): void {
    const { width, height } = this.scale.gameSize;
    if (!this.#region) {
      const element = document.createElement("mc-title-panel") as McTitlePanel;
      element.addEventListener("mc-activate", (event) => {
        this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      this.#region = new DomRegion(this, element, { x: 0, y: 0, width, height });
    }
    const region = this.#region;
    region.setRect({ x: 0, y: 0, width, height });
    // The Phaser parts the panel leaves showing through it: the games panel, the storefront and Discord icons.
    region.setHoles(this.#holes);
    region.element.model = model;
    renderNow(region.element);
  }

  /** The line about a replay that didn't open, while it is still being said. */
  #problemText(): string | null {
    return this.#problem && this.time.now < this.#problem.until ? this.#problem.text : null;
  }

  /** Asks whether a downloaded update is waiting, and shows the banner for it (on arrival, and when the panel closes). */
  #checkReadyUpdate(): void {
    void readyUpdateVersion().then((ready) => {
      // A version closed this visit stays closed; a newer one that becomes ready shows.
      const version = ready === this.#readyDismissed ? null : ready;
      if (version === this.#readyVersion || !this.sys.isActive()) return;
      this.#readyVersion = version;
      this.#rebuild();
    });
  }

  /** The update panel: the Steam script's update, or with `installer` the game's own (`platform/self-update.ts`). */
  #openSteamUpdate(update: AvailableUpdate, installer = false): void {
    if (this.scene.isActive(SCENES.steamUpdate)) return;
    this.scene.launch(SCENES.steamUpdate, {
      version: update.version,
      fallbackUrl: update.downloadUrl ?? update.notesUrl,
      ...(installer && update.downloadUrl !== null && update.downloadDigest !== null
        ? {
            // These install for every user, so the system asks for an administrator's permission first.
            mode: ["msi", "deb", "rpm"].includes(this.#selfUpdate?.kind ?? "") ? "installer-admin" : "installer",
            installerUrl: update.downloadUrl,
            installerDigest: update.downloadDigest,
          }
        : {}),
    } satisfies SteamUpdateSceneData);
    // Closed with the download ready, the Title says so.
    this.game.events.once(STEAM_UPDATE_CLOSED, () => {
      if (this.sys.isActive()) this.#checkReadyUpdate();
    });
  }

  /** Resolves once this visit's picture is loaded (at once when it already is, or there is none). */
  #artLoaded(): Promise<void> {
    const art = this.#art;
    return new Promise((resolve) => {
      if (!art || ensurePictureLoaded(this, art, resolve) !== null) resolve();
    });
  }

  /** A picture for the art panel at this screen's size and density (`pickTitleArtFor`); the panel is null on a phone. */
  #pickArt(): TitleArt | null {
    const { width, height } = this.scale.gameSize;
    const { artPanel } = titleMenuLayout({
      width,
      height,
      continuable: false,
      games: 0,
      update: false,
      civilWar: false,
      quit: false,
      noticeBar: RELEASE_NOTICE_ON,
    });
    return pickTitleArtFor(TITLE_ART, titleArtSizeOf, artPanel, drawnDensity(), lastTitleArtKey);
  }

  /** Loads the picture the next visit will show, so coming back to Title doesn't wait on it. */
  #preloadNextArt(): void {
    if (!this.sys.isActive() || nextTitleArt) return;
    nextTitleArt = this.#pickArt();
    if (nextTitleArt) ensurePictureLoaded(this, nextTitleArt, () => undefined);
  }

  /** Draws this visit's picture if its texture is ready, otherwise loads it once and draws on arrival. */
  #drawArt(): void {
    const art = this.#art;
    const panel = this.#artPanel;
    if (!art || !panel) return;
    const generation = ++this.#artGeneration;
    const place = (): void => {
      if (generation !== this.#artGeneration || !this.sys.isActive() || !this.textures.exists(art.key)) return;
      const frame = this.textures.get(art.key).getSourceImage() as {
        width: number;
        height: number;
      };
      const fit = coverFit(frame, panel);
      this.add
        .image(panel.x + panel.width / 2, panel.y + panel.height / 2, art.key)
        .setScale(fit.scale)
        .setCrop(fit.cropX, fit.cropY, fit.cropWidth, fit.cropHeight)
        .setDepth(ART_DEPTH);
    };
    // Through the shared loader: the guide chooser draws the same wallpaper, and two scenes loading one key at once log
    // "Texture key already in use".
    if (ensurePictureLoaded(this, art, place) !== null) place();
  }

  #freshDraft(picked = false) {
    return newGameDraft(picked);
  }

  #newGame(): void {
    if (this.#starting) return;
    // A plain "New game" is never a guided run — clears a still-set flag from an earlier tutorial the player left
    // running rather than stopping outright (`session.ts`'s own `guidedRun` doc comment: "not cleared
    // automatically by starting a fresh non-guided game afterward" was this method's own TODO).
    appSession().guidedRun = false;
    appSession().guidedRunKind = undefined;
    setGuideRunLevelOverride(null);
    this.scale.off("resize", this.#rebuild, this);
    // The first New game ever (no guide choice made yet) asks "New to the fight?" first (guided mode, owner
    // 2026-09-29: the game opens on Title, and the chooser comes after you start a new game). Its "Hints only" /
    // "No guide" continue straight into scenario select; "Learn as you play" goes to How to win and the tutorial.
    if (isFirstLaunch(guidePrefs())) {
      goToScreen(this, SCENES.guideChooser);
      return;
    }
    const draft = this.#freshDraft();
    goToScreen(this, SCENES.scenarioSelect, {
      draft,
    } satisfies ScenarioSelectData);
  }

  /**
   * Continue on a saved guided run (guided mode §3.12): a tutorial or aspect "Try it" save asks first whether to
   * resume guidance or just open the save plainly (`guide/tutorial-resume.ts#tutorialResumeDecisionFor`). An
   * ordinary save skips straight to `#resumePlain`, exactly as before this decision existed.
   */
  async #resume(save: SaveMeta): Promise<void> {
    if (this.#starting) return;
    const decision = tutorialResumeDecisionFor(save, guidePrefs());
    if (decision.kind === "plain") {
      await this.#resumePlain(save.id);
      return;
    }
    // `TUTORIAL_LESSONS`' own order numbers "How to win" as lesson 1 (§5.1's table), so a lesson's 1-based
    // number is its index in that list plus one.
    const lessonNumber =
      decision.kind === "tutorial" ? TUTORIAL_LESSONS.findIndex((lesson) => lesson.id === decision.lessonId) + 1 : -1;
    const title =
      decision.kind === "tutorial"
        ? `Resume the tutorial at lesson ${lessonNumber}: ${decision.title}?`
        : decision.kind === "mechanic"
          ? "Restart this Try it?"
          : "Restart this aspect's Try it?";
    const body =
      decision.kind === "tutorial"
        ? "Finished lessons stay done. Or open this save as an ordinary game, with the guide off."
        : "It's a short, one-lesson game — restarting it plays the same opening again. Or open this save as an " +
          "ordinary game, with the guide off.";
    const resumeLabel = decision.kind === "tutorial" ? "Resume tutorial" : "Restart Try it";
    // Launched directly rather than through `askToResumeTutorial`, so the sheet's module stays out of the entry chunk
    // (`scenes/scene-loader.ts` loads it on this launch).
    if (this.scene.isActive(SCENES.tutorialResumeConfirm)) return;
    this.scene.launch(SCENES.tutorialResumeConfirm, {
      from: this.scene.key,
      title,
      body,
      resumeLabel,
      onResume: () => {
        // Imported on the tap, so the lesson configs stay out of the chunk Title loads before its first frame (#226).
        void (
          decision.kind === "tutorial"
            ? import("../guide/start-tutorial.js").then((m) =>
                m.startTutorialGame({ startAtLesson: decision.lessonId }),
              )
            : decision.kind === "mechanic"
              ? import("../guide/start-mechanic-tryit.js").then((m) => m.startMechanicTryItGame(decision.mechanic))
              : import("../guide/start-aspect-tryit.js").then((m) => m.startAspectTryItGame(decision.aspect))
        ).then(() => {
          if (!this.sys.isActive()) return;
          goToScreen(this, SCENES.board);
        });
      },
      onContinuePlain: () => void this.#resumePlain(save.id),
    } satisfies TutorialResumeConfirmData);
  }

  async #resumePlain(gameId: string): Promise<void> {
    if (this.#starting) return;
    this.#starting = true;
    this.#rebuild();
    const { store } = appSession();
    // "Continue" resumes a saved game, never a guided run (guidance isn't part of a save — `session.ts`'s own
    // `guidedRun` doc comment) — same reset as `#newGame`'s own, above.
    appSession().guidedRun = false;
    appSession().guidedRunKind = undefined;
    setGuideRunLevelOverride(null);
    await store.resume(gameId);
    if (store.state.status === "failed") {
      this.#starting = false;
      // Read the saves again rather than dropping Continue: the failed game was retired by the host, the others stand.
      await this.#refreshSaves();
      this.#statusText = store.state.error ?? "that game could not be resumed";
      this.#compose?.();
      return;
    }
    this.scale.off("resize", this.#rebuild, this);
    // A game saved before its mulligans were done resumes on the setup deal screen, the only place a mulligan can
    // be taken properly; that scene hands off to the Board itself once setup is over.
    goToScreen(this, store.state.game?.step.phase === "setup" ? SCENES.setupDeal : SCENES.board);
  }
}

/** How often the Title asks whether a background update download has finished (`#checkReadyUpdate`). */
const READY_CHECK_MS = 2000;

/**
 * Depth ladder for the title picture: the ink ground and dot grid under it, the picture, then (phone only) the
 * legibility scrim — all below the default depth 0 every control and text draws at. Depth rather than display-list
 * order because the picture arrives asynchronously and would otherwise land on top of the menu.
 */
const ART_GROUND_DEPTH = -3;
const ART_DEPTH = -2;
const ART_SCRIM_DEPTH = -1;

/** The Discord link's label in the footer: a brand name, the same in every language. */
const DISCORD_LINK_LABEL = "Discord ↗";

/** The update banner as laid out, before the panel draws it. */
interface BannerSpec {
  readonly rect: Rect;
  readonly parts: UpdateBannerParts;
  readonly heading: string;
  readonly detail: string;
  /** Its buttons, the close button last. */
  readonly buttons: readonly BannerButton[];
  /** The action buttons' focus stops (the close button follows them). */
  readonly stops: readonly string[];
}

interface BannerButton {
  readonly id: string;
  readonly kind: "primary" | "secondary";
  readonly label: string;
  readonly rect: Rect;
  readonly activate: () => void;
}

/** The press glyph on a focused top-row button or the notice bar. */
const TOP_ROW_GLYPH_HEIGHT = 18;

/** How long the rank-up fanfare holds the badge. */
const RANK_UP_MS = 5000;

/** The picture the last Title visit showed, so the next visit shows a different one (`pickTitleArt`). */
let lastTitleArtKey: string | null = null;
/** The picture the next visit shows, picked and loaded during this one (`#preloadNextArt`). */
/** How long a replay problem stays at the top of Title. */
const REPLAY_PROBLEM_MS = 6000;
let nextTitleArt: TitleArt | null = null;
/** How long after Title opens the next visit's picture starts loading: after this visit's own screen has settled. */
const NEXT_ART_PRELOAD_MS = 1500;
/** How long the saves read may take before Title says it hasn't loaded (#871). A slow phone reads well inside it. */
const SAVES_STUCK_MS = 8000;
/** The saves-stuck banner's Reload button (#871). */
const SAVES_RELOAD_ID = "saves-reload";

/** "Continue — Rhino · Spider-Man · round 4". See `view/continue-label.ts`. */
function continueLabel(save: SaveMeta): string {
  return continueLabelOf(save, GAME_LABEL_NAMES);
}
