/**
 * The Title menu (docs/phase4-screen-gaps.md §3 W2, D01/P01): a real menu, not a setup page. Continue (when a game is in
 * progress), New game, Decks & Collection, Campaign, Play online, Extras, Past games, the Trophy Room, Your stats, How to
 * play, the Mod Store and Settings, with a footer that has the app's own card-pool coverage and build version.
 *
 * The screen is one custom element, `mc-title-page` (`views/title/`), composed of the notice bar, the logo, the icon
 * row, the menu, the rank card and the footer (and, on a wide screen, the banner, the In-progress games and Play online
 * panels). The scene mounts it, hands it what `view/title-page-model.ts` words from the facts gathered
 * (`title-facts.ts`), and hears the one `mc-title` event (`title-actions.ts`); the ink ground and the picture under the
 * page's art column are Phaser's (`title-art-layer.ts`). Navigation, the focus route and the pop-ups' hand-off stay the
 * scene's.
 *
 * This retires the setup half `TitleScene` used to carry (scenario, difficulty, modular sets, seats, seed): that flow
 * lives across `ScenarioSelectScene` → `SeatsScene` → `TableSetupScene`, each reading and writing the one `SetupDraft`
 * `New game` hands off to the first of them. Campaign opens The Saga (`scenes/campaign/saga.ts`); Extras
 * (`scenes/extras.ts`) opens the comics, artwork, hero and villain files and soundtrack that play has unlocked.
 */

import Phaser from "phaser";
import type { Deck } from "@mc/content";
import "../views/title/mc-title-page/mc-title-page.js";
import type { McTitlePage } from "../views/title/mc-title-page/mc-title-page.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import type { DomRegion } from "../dom/dom-region.js";
import { mountElement } from "../dom/element-region.js";
import { settleElements } from "../dom/element-settle.js";
import { bindStopFocus, focusStopsOf } from "../dom/element-stops.js";
import type { SaveMeta } from "../engine/game-storage.js";
import { setGuideRunLevelOverride } from "../guide/guide-store.js";
import { t, type MessageKey } from "../i18n/translate.js";
import { clearWatchAddress } from "../live/watch-link.js";
import { hasDesktopWindow } from "../platform/desktop-window.js";
import { clearGameAddress, releaseGameAddress } from "../platform/game-address.js";
import { leaveRoomAtTitle } from "../platform/live-watch.js";
import { lastRankSeen, rememberRankSeen } from "../platform/rank-seen.js";
import { steamAdd } from "../platform/steam-add.js";
import {
  earnedAchievementIds,
  lifetimeChampionPoints,
  onProgressRead,
  refreshUnlocks,
} from "../progression/progression.js";
import { openReplay, replayErrorKey } from "../replay/replay-files.js";
import { takeReceiveLink, takeSyncLink } from "../save-data/receive-link.js";
import { appSession } from "../session.js";
import { surface } from "../tokens.js";
import { setChromeDrawnByDom } from "../ui/dom-chrome.js";
import { setMusicSlot } from "../ui/music-slot.js";
import { setReportSlot } from "../ui/report-slot.js";
import { cssOf } from "../ui/theme.js";
import { fadeScreenIn, goToScreen, holdScreenFor } from "../ui/transitions.js";
import type { Rect } from "../view/layout.js";
import { musicSlotBeside } from "../view/music-player.js";
import { titleMenuFocusOrder } from "../view/screen-focus.js";
import { withSeatOne } from "../view/setup-draft.js";
import { titlePageInputOf } from "../view/title-page-model.js";
import { rankUpAnnouncementOf } from "../view/title-rank-badge.js";
import { maybeAskGlobalStats } from "./global-ask-launch.js";
import {
  CHROME_LANGUAGE_STOP,
  CHROME_MUSIC_STOP,
  CHROME_REPORT_STOP,
  CHROME_THEME_STOP,
  FocusRoute,
} from "./focus-route.js";
import type { FocusStop } from "./focus-route.js";
import type { GamesListOverlayData } from "./games-list.js";
import { SCENES } from "./keys.js";
import { introReplay } from "./replay-entry.js";
import { maybeShowRendererNotice } from "./renderer-notice-launch.js";
import type { ScenarioSelectData } from "./scenario-select.js";
import { maybeShowSyncSetupPrompt } from "./sync-setup-prompt-launch.js";
import { titleActionsOf } from "./title-actions.js";
import { TitleArtLayer } from "./title-art-layer.js";
import { titleBannerFor, type TitleBanner } from "./title-banner.js";
import { newGameDraft } from "./title-draft.js";
import { titleFactsOf } from "./title-facts.js";
import { TitleFeeds } from "./title-feeds.js";
import { resumeSave } from "./title-resume.js";
import { titleRouteOptions, watchTitleWorld } from "./title-world.js";

export { newGameDraft } from "./title-draft.js";

/**
 * "Play this deck ▸" (W9, docs/phase4-screen-gaps.md §3): the Decks screen starts Title with the deck to seat.
 * Title doesn't draw in that case: it builds a fresh draft with that deck alone in seat 1 (`withSeatOne`) and
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

/** How long the rank-up fanfare holds the badge. */
const RANK_UP_MS = 5000;
/** How long a replay problem stays at the top of Title. */
const REPLAY_PROBLEM_MS = 6000;
/** How long after Title opens the next visit's picture starts loading: after this visit's own screen has settled. */
const NEXT_ART_PRELOAD_MS = 1500;
/** How often the icon row's place is read again (a web font arriving moves it without any redraw). */
const CHROME_REPLACE_MS = 250;

export class TitleScene extends Phaser.Scene {
  #feeds: TitleFeeds | null = null;
  /** Why the game picked to resume could not be, said above the footer. */
  #statusText: string | null = null;
  #starting = false;
  /** "Rank up: <title>" while the badge shows the fanfare (a few seconds after the Title opens), else null. */
  #rankUp: string | null = null;
  #route: FocusRoute | null = null;
  #glyphs: ControlGlyphs | null = null;
  #art: TitleArtLayer | null = null;
  #stops: ReadonlyMap<string, FocusStop> = new Map();
  /** What a key does when the page reports a press on it. */
  #actions = new Map<string, () => void>();
  /** Why a replay didn't open, and until when it is said. */
  #problem: { readonly text: string; readonly until: number } | null = null;
  #region: DomRegion<McTitlePage> | null = null;
  #page: McTitlePage | null = null;
  /** Counts rebuilds, so one overtaken while the page rendered does not wire stale stops. */
  #drawn = 0;
  #banner: TitleBanner | null = null;
  #popups = { language: false, music: false };
  #lastReplace = 0;

  constructor() {
    super(SCENES.title);
  }

  create(data: TitleSceneData = {}): void {
    // A room's game hands back here: leave the room (a no-op for every single-player visit).
    leaveRoomAtTitle();
    // Title is where a game, a watch or a room is left: none of them belongs in the address any more.
    releaseGameAddress();
    clearGameAddress();
    clearWatchAddress();
    this.#problem = null;
    this.#statusText = null;
    this.#region = null;
    this.#page = null;
    if (data.initialSeatDeckId) {
      // The player still picks what to play against first; the deck waits in seat one on Take your seats (#958).
      const draft = withSeatOne(newGameDraft(), data.initialSeatDeckId);
      const seedDecks =
        data.initialSeatDeck && data.initialSeatDeck.id === data.initialSeatDeckId ? [data.initialSeatDeck] : [];
      goToScreen(this, SCENES.scenarioSelect, { draft, seedDecks } satisfies ScenarioSelectData);
      return;
    }
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    const feeds = new TitleFeeds(this, () => this.#rebuild(true));
    this.#feeds = feeds;
    feeds.reset();
    this.#starting = false;
    this.#rankUp = null;
    this.#popups = { language: false, music: false };
    this.#art = new TitleArtLayer(this);
    this.#glyphs = new ControlGlyphs(this, () => this.#rebuild(false));
    this.#mountPage();
    const stopWatching = watchTitleWorld(
      this,
      () => this.#rebuild(true),
      () => void feeds.refreshSaves(),
    );
    this.events.on(Phaser.Scenes.Events.UPDATE, this.#tick, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      stopWatching();
      this.events.off(Phaser.Scenes.Events.UPDATE, this.#tick, this);
      this.#glyphs?.dispose();
      this.#glyphs = null;
      this.#art = null;
      this.#region = null;
      this.#page = null;
      setChromeDrawnByDom(SCENES.title, false);
      setReportSlot(SCENES.title, null);
      setMusicSlot(SCENES.title, null);
    });
    this.#route = new FocusRoute(
      this,
      titleRouteOptions(this, {
        scroller: () => this.#page?.scroller ?? null,
        focusChanged: () => this.#rebuild(false),
        starting: () => this.#starting,
        // The first game's Resume, else the games row, else the remove question's "Keep it"; none of them a stop (no
        // games, nothing listed): leave focus where it is, as focusKey would drop it.
        gamesStop: () =>
          [...this.#stops.keys()].find((key) => key.startsWith("game:")) ??
          ["games-row", "remove-keep"].find((key) => this.#stops.has(key)),
        focusKey: (key) => this.#route?.focusKey(key),
        trophies: () => this.#actions.get("trophies")?.(),
      }),
    );
    // The icon row is the Title's own DOM: the chrome scenes follow its slots but paint nothing (`ui/dom-chrome.ts`).
    setChromeDrawnByDom(SCENES.title, true);
    this.#art.choose();
    appSession().music?.playTitle();
    this.#checkRankUp();
    this.#rebuild(true);
    fadeScreenIn(this);
    holdScreenFor(this, this.#art.loaded());
    this.time.delayedCall(NEXT_ART_PRELOAD_MS, () => this.#art?.preloadNext());
    if (data.replayProblem) this.#replayProblem(t(data.replayProblem));
    // Opened from a Send screen's QR code: straight to Settings, Save data, Receive (read and cleared once).
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
    // Points may have moved since Boot read them (a game just ended): read again, and announce a rank gained. Both reads
    // land before the screen fades in (`holdScreenFor`), so the menu is not seen redrawing for them. Any read that lands
    // redraws the menu and checks the rank (`onProgressRead`), Boot's own included: Boot goes on without it after a few
    // seconds (#871), so it can land after this screen is up, and after this read.
    const unsubscribeProgress = onProgressRead(() => {
      if (!this.sys.isActive()) return;
      this.#checkRankUp();
      this.#rebuild(true);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribeProgress);
    holdScreenFor(
      this,
      refreshUnlocks().catch(() => false),
    );
    holdScreenFor(this, feeds.refreshSaves());
    // Read now so Settings ▸ More can offer Add to Steam (#844) when it opens; once it has added the game, the Title
    // takes the Steam script's update and says so, without a relaunch.
    void steamAdd();
    feeds.start();
    // Dev-only visual-QA hook (never read by product code): puts saves, an update, a status or a replay problem on the Title.
    if (import.meta.env.DEV) {
      (window as unknown as { __mcTitleDemo?: unknown }).__mcTitleDemo = (
        patch: Partial<TitleFeeds> & { status?: string; problem?: string },
      ): void => {
        const { status, problem, ...rest } = patch;
        Object.assign(feeds, rest);
        if (status !== undefined) this.#statusText = status;
        if (problem !== undefined) this.#replayProblem(problem);
        this.#rebuild(true);
      };
    }
  }

  /** Mounts the page once; its one event is a press on a control, by the control's focus stop key. */
  #mountPage(): void {
    const { width, height } = this.scale.gameSize;
    const { region, element } = mountElement(this, "mc-title-page", { x: 0, y: 0, width, height });
    this.#region = region;
    this.#page = element;
    element.addEventListener("mc-title", (event) => {
      if (event.detail.type === "press") this.#actions.get(event.detail.key)?.();
    });
    // A control's native focus (a screen reader, a click) moves the keyboard route there too.
    bindStopFocus(element, (key) => this.#route?.focusKey(key));
  }

  /** Every frame: the pop-ups' open state lights their buttons, and the icon row's slots follow where it is drawn. */
  #tick(time: number): void {
    const language = this.scene.isActive(SCENES.languagePopup);
    const music = this.scene.isActive(SCENES.musicPlayer);
    if (language !== this.#popups.language || music !== this.#popups.music) {
      this.#popups = { language, music };
      this.#rebuild(false);
    }
    if (time - this.#lastReplace >= CHROME_REPLACE_MS) {
      this.#lastReplace = time;
      this.#placeChrome();
    }
  }

  /**
   * The Report and music buttons' slots are where the page drew them, so the chrome scenes (which paint nothing here)
   * keep the pop-ups, the focus route and the music player anchored to the buttons the player sees. The language and
   * theme slots follow from these two by the same measures the CSS row uses (`view/language-button.ts`).
   */
  #placeChrome(): void {
    const rectOf = (key: string): Rect | null => {
      const stop = this.#stops.get(key);
      if (!stop) return null;
      return typeof stop.rect === "function" ? stop.rect() : stop.rect;
    };
    const report = rectOf(CHROME_REPORT_STOP);
    const music = rectOf(CHROME_MUSIC_STOP);
    setReportSlot(SCENES.title, report);
    setMusicSlot(SCENES.title, music ?? (report ? musicSlotBeside(report) : null));
  }

  /**
   * The rank-up fanfare (docs/achievements.md): when the Title shows a higher rank than the last visit stored, the badge
   * turns red and reads "Rank up: <name>" for a few seconds, with the short Extras sting. The rank is remembered at once,
   * so a second check (after the refresh) or a redraw never repeats it.
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
      this.#rebuild(false);
    });
  }

  /** Says why a replay didn't open, at the top of the screen, for a few seconds. */
  #replayProblem(text: string): void {
    this.#problem = { text, until: this.time.now + REPLAY_PROBLEM_MS };
    this.#rebuild(false);
    this.time.delayedCall(REPLAY_PROBLEM_MS, () => {
      this.#problem = null;
      if (this.sys.isActive()) this.#rebuild(false);
    });
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

  /** The phone's "In-progress games (N)" row: the list full screen, over this one. */
  #openGamesList(): void {
    const feeds = this.#feeds;
    if (!feeds || this.scene.isActive(SCENES.gamesList)) return;
    this.scene.launch(SCENES.gamesList, {
      from: this.scene.key,
      saves: feeds.listed(),
      onResume: (save) => void this.#resume(save),
      onWatch: (save) => void this.#watchSaved(save),
      onChanged: () => void feeds.refreshSaves(),
    } satisfies GamesListOverlayData);
  }

  /**
   * Words the page from the current facts, and (with `wire`) hands the focus route its stops once the page has rendered.
   * A focus move, a pop-up opening or a rank-up redraws the words only: the parts, and so the stops, are the same.
   */
  #rebuild(wire: boolean): void {
    const page = this.#page;
    const feeds = this.#feeds;
    const glyphs = this.#glyphs;
    if (!page || !feeds || !glyphs || !this.sys.isActive()) return;
    const { width, height } = this.scale.gameSize;
    this.#banner = titleBannerFor(this, feeds, () => this.#rebuild(true));
    glyphs.reset();
    const { facts, gameIds, civilWarScenario } = titleFactsOf({
      width,
      height,
      feeds,
      glyphs,
      banner: this.#banner,
      starting: this.#starting,
      statusText: this.#statusText,
      problem: this.#problem && this.time.now < this.#problem.until ? this.#problem.text : null,
      rankUp: this.#rankUp,
      focused: this.#route?.focused ?? null,
      popups: this.#popups,
    });
    page.mode = facts.mode;
    page.input = titlePageInputOf(facts);
    glyphs.settled();
    // Dev-only e2e hook: the platform whose mark the Continue row drew (never read by product code).
    if (import.meta.env.DEV) {
      (window as unknown as { __mcContinuePlatform?: string | null }).__mcContinuePlatform =
        facts.continue?.mark?.platform ?? null;
    }
    if (!wire) return;
    this.#region?.setRect({ x: 0, y: 0, width, height });
    this.#actions = titleActionsOf(
      {
        scene: this,
        feeds,
        banner: this.#banner,
        leave: (scene, data) => goToScreen(this, scene, data),
        resume: (save) => void this.#resume(save),
        watch: (save) => void this.#watchSaved(save),
        openGamesList: () => this.#openGamesList(),
        rebuild: () => this.#rebuild(true),
        starting: () => this.#starting,
      },
      gameIds,
      civilWarScenario,
    );
    const draw = ++this.#drawn;
    void settleElements(page).then(() => {
      if (draw !== this.#drawn || !this.sys.isActive()) return;
      this.#wire(facts.mode === "wide", gameIds, civilWarScenario !== null, facts.promo !== "none");
    });
  }

  /** After a render: the route's stops (live rects, from the page's own `data-stop` parts), the chrome slots, the ground. */
  #wire(wide: boolean, gameIds: readonly string[], civilWar: boolean, onlinePanel: boolean): void {
    const page = this.#page;
    const region = this.#region;
    const feeds = this.#feeds;
    if (!page || !region || !feeds) return;
    const stops = focusStopsOf(page, (target) => region.rectOf(target));
    this.#stops = stops;
    this.#route?.set(
      [
        // The notice bar is the top-most control, so it comes first.
        ...(stops.has("release-notice") ? ["release-notice"] : []),
        ...titleMenuFocusOrder({
          continuable: feeds.continuable !== null,
          civilWar,
          quit: hasDesktopWindow(),
          discord: !wide,
          updateActions: this.#banner?.stops ?? [],
          gameIds: wide ? gameIds : [],
          removeConfirm: wide && feeds.removing !== null && gameIds.includes(feeds.removing),
          gamesRow: !wide && gameIds.length > 0,
          onlinePanel,
        }),
        "rank-badge",
        ...(wide ? ["chrome:discord", "chrome:mod-store"] : []),
        CHROME_THEME_STOP,
        CHROME_LANGUAGE_STOP,
        CHROME_MUSIC_STOP,
        CHROME_REPORT_STOP,
      ],
      stops,
    );
    this.#placeChrome();
    const { width, height } = this.scale.gameSize;
    const art = region.rectOf(page.artElement);
    this.#art?.draw(wide ? { x: art.x, y: 0, width: art.width, height } : { x: 0, y: 0, width, height }, !wide);
  }

  /** Continue on a saved game: a guided run asks first how to open it (`title-resume.ts`); an ordinary one opens at once. */
  async #resume(save: SaveMeta): Promise<void> {
    if (this.#starting) return;
    await resumeSave(this, save, () => this.#resumePlain(save.id));
  }

  async #resumePlain(gameId: string): Promise<void> {
    if (this.#starting) return;
    this.#starting = true;
    this.#rebuild(false);
    const { store } = appSession();
    // "Continue" resumes a saved game, never a guided run (guidance isn't part of a save, `session.ts`'s own
    // `guidedRun` doc comment): the same reset as a new game's.
    appSession().guidedRun = false;
    appSession().guidedRunKind = undefined;
    setGuideRunLevelOverride(null);
    await store.resume(gameId);
    if (store.state.status === "failed") {
      this.#starting = false;
      // Read the saves again rather than dropping Continue: the failed game was retired by the host, the others stand.
      await this.#feeds?.refreshSaves();
      this.#statusText = store.state.error ?? "that game could not be resumed";
      this.#rebuild(false);
      return;
    }
    // A game saved before its mulligans were done resumes on the setup deal screen, the only place a mulligan can be
    // taken properly; that scene hands off to the Board itself once setup is over.
    goToScreen(this, store.state.game?.step.phase === "setup" ? SCENES.setupDeal : SCENES.board);
  }
}
