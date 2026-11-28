/**
 * What Pause's buttons, rows and search results do: the scene's state that a press changes (the log open, the Reference
 * rows open, the Concede confirm, "Link copied") and the screens it opens, leaves or closes. `scenes/pause.ts` mounts the
 * page and draws its model; this answers the page's `mc-pause` events.
 */
import Phaser from "phaser";
import { withLevel, type GuideLevel } from "../../guide/guide-prefs.js";
import { guidePrefs, setGuidePrefs } from "../../guide/guide-store.js";
import { t } from "../../i18n/translate.js";
import { liveStatus } from "../../platform/live-watch.js";
import { appSession } from "../../session.js";
import type { McPausePage } from "../../views/pause/mc-pause-page/McPausePage.js";
import type { PauseEventDetail, PauseMenuId } from "../../components/pause/shared/pause-events.types.js";
import { concedeRouteOf } from "../../view/competitive-concede.js";
import { copyWatchLink, pauseWatchLinkOf } from "../../view/live-watch-ui.js";
import type { PauseSearchSession } from "../../view/pause-search.js";
import type { RulesEntry } from "../../view/rules-reference.js";
import { nextGuidePrefsAfterRow, nextSettingsAfterCardSize, type GuideRowInfo } from "../../view/settings-rows.js";
import type { ManualAdjustData } from "../manual-adjust.js";
import type { PlayerStatsData } from "../player-stats.js";
import type { RulesSceneData } from "../rules.js";
import { SCENES } from "../keys.js";
import { leaveSeatForWatch } from "../seat-drop.js";
import type { OverlayMotion } from "../../ui/transitions.js";
import type { BoardScene } from "../board.js";
import { openSearchEntry } from "./pause-open-entry.js";
import { type QuickEntry, type QuickHost } from "./pause-quick-rows.js";
import { flipShowHand, manualAdjustOn, roomChatShown, seatGame, showHandLabelOf } from "./pause-room.js";
import { activateGuideRow, applySetting, toggleTableRow, type SettingsActionHost } from "./pause-settings-actions.js";
import { settingRowsOf } from "./pause-search-host.js";

/** What the actions need of the scene that owns them. */
export interface PauseSceneApi {
  readonly scene: Phaser.Scene;
  readonly motion: OverlayMotion;
  draw(): void;
  page(): McPausePage | null;
  search(): PauseSearchSession | null;
  /** Whether the Reference toggle is open in what the page shows now. */
  quickOpen(): boolean;
}

/** The overlays Save & quit and Play the tutorial close before they leave the game. */
const LEAVE_OVERLAYS = [
  SCENES.rules,
  SCENES.settings,
  SCENES.playerStats,
  SCENES.manualAdjust,
  SCENES.controls,
  SCENES.choice,
  SCENES.inspect,
  SCENES.villainPhase,
];

export class PauseActions {
  /** Wide: "Full game log" swaps the Rules reference for the fuller retained log. Phone: the "Game log" row swaps the Table/Guide group. */
  logExpanded = false;
  /** Phone: the rows under the Reference toggle are open. */
  quickExpanded = false;
  confirmingConcede = false;
  /** "Link copied" shows on the watch link item for a moment after a copy (#876). */
  linkCopied = false;
  /** The results read from their top on the next draw (a new query, the Reference toggled). */
  fromTop = false;
  /** What the last draw showed, for the events that name a row by id. */
  quick: readonly QuickEntry[] = [];
  entries: readonly RulesEntry[] = [];
  guideRows: readonly GuideRowInfo[] = [];
  readonly #api: PauseSceneApi;

  constructor(api: PauseSceneApi) {
    this.#api = api;
    this.#settingsHost = {
      scene: api.scene,
      leaving: () => api.motion.leaving,
      refresh: () => {
        api.search()?.reindex();
        api.draw();
      },
    };
  }

  get #scenes(): Phaser.Scenes.ScenePlugin {
    return this.#api.scene.scene;
  }

  /** What the Reference rows and search results ask of Pause. */
  readonly quickHost: QuickHost = {
    openRules: (data) => this.#openRules(data),
    toggleFullGameLog: () => this.toggleFullGameLog(),
    launchOver: (key, data) => this.#launchOver(key, data),
    launch: (key, data) => this.#scenes.launch(key, data),
    isActive: (key) => this.#scenes.isActive(key),
    quick: () => this.quick,
    logExpanded: () => this.logExpanded,
    roomChat: () => roomChatShown(),
    openChat: () => this.#openChat(),
    openStats: () => this.#openStats(),
    manualAdjustOn: () => manualAdjustOn(),
    seatGame: () => seatGame(),
    adjustLabel: () => (seatGame() ? t("ask.change") : t("pause.manualAdjust")),
    openManualAdjust: () => this.#openManualAdjust(),
    openLauncher: (key) => this.#openLauncher(key),
    watchLinkShown: () => pauseWatchLinkOf(liveStatus()) !== null,
    linkCopied: () => this.linkCopied,
    copyWatchLink: () => this.#copyWatchLink(),
    showHandLabel: () => showHandLabelOf(false),
    flipShowHand: () => flipShowHand(),
  };

  readonly #settingsHost: SettingsActionHost;

  /** The page said something (a tap, or the focus route's click on a stop). */
  heard(detail: PauseEventDetail): void {
    // Closing already (its exit is playing): a second tap must not act.
    if (this.#api.motion.leaving) return;
    switch (detail.type) {
      case "menu":
        return this.#menu(detail.id);
      case "keyword": {
        const entry = this.entries.find((candidate) => candidate.id === detail.id);
        return this.#openRules({ initialTab: "glossary", ...(entry ? { initialQuery: entry.displayName } : {}) });
      }
      case "moment": {
        const target = this.#boardScene()?.undoMoments().get(detail.id);
        if (target !== undefined) void this.#undoTo(target);
        return;
      }
      case "quick-toggle":
        this.quickExpanded = !this.#api.quickOpen();
        this.fromTop = true;
        return this.#api.draw();
      case "quick":
        return this.quick.find((row) => row.id === detail.id)?.open?.();
      case "table":
        return toggleTableRow(this.#settingsHost, detail.id);
      case "card-size":
        appSession().settings = nextSettingsAfterCardSize(appSession().settings, detail.value as never);
        return this.#api.draw();
      case "guide-level":
        setGuidePrefs(nextGuidePrefsAfterRow(guidePrefs(), "guide-level", detail.value as GuideLevel));
        return this.#api.draw();
      case "guide":
        return activateGuideRow(
          this.#settingsHost,
          this.guideRows.find((row) => row.id === detail.id),
          () => this.#leaveTo(() => this.#scenes.start(SCENES.howToWin, {}), false),
        );
      case "result":
        return this.#openResult(detail.id);
      case "setting": {
        const row = settingRowsOf().find((candidate) => candidate.id === detail.id);
        if (row) applySetting(this.#settingsHost, row, detail.value);
        return;
      }
    }
  }

  #menu(id: PauseMenuId): void {
    switch (id) {
      case "close":
      case "resume":
        return this.resume();
      case "full-game-log":
        return this.toggleFullGameLog();
      case "rules-reference":
        return this.#openRules({ initialTab: "glossary" });
      case "settings":
        return this.#launchOver(SCENES.settings, {});
      case "stats":
        return roomChatShown() ? this.#openChat() : this.#openStats();
      case "save-quit":
        return this.#leaveTo(() => this.#scenes.start(SCENES.title, {}), true);
      case "music":
        return this.#openLauncher(SCENES.musicPlayer);
      case "report":
        return this.#openLauncher(SCENES.reportIssue);
      case "watch-link":
        return this.#copyWatchLink();
      case "show-hand":
        return flipShowHand();
      case "guide-stop-tutorial":
        this.#boardScene()?.stopGuide();
        return this.#api.draw();
      case "guide-turn-guide-off":
        // The saved guide level goes to "off" (so no future game offers guidance unprompted either), and this run stops.
        setGuidePrefs(withLevel(guidePrefs(), "off"));
        this.#boardScene()?.stopGuide();
        return this.#api.draw();
      case "manual-adjust":
        return this.#openManualAdjust();
      case "concede":
        return this.setConfirmingConcede(true);
      case "concede-confirm-yes":
        return void this.#onConcedeConfirmed();
      case "concede-confirm-cancel":
        return this.setConfirmingConcede(false);
    }
  }

  resume(): void {
    this.#api.motion.exit(this.#api.scene, () => this.#scenes.stop());
  }

  setConfirmingConcede(value: boolean): void {
    // Civil War Competitive (#883): the team's forfeit or leaving alone, on its own sheet, not the one-line confirm.
    const { game, perspectiveId } = appSession().store.state;
    if (value && perspectiveId && concedeRouteOf(game, seatGame()) === "sheet") {
      this.#openLauncher(SCENES.competitiveConcede);
      return;
    }
    this.confirmingConcede = value;
    this.#api.draw();
  }

  toggleFullGameLog(): void {
    // The log draws where the results are: from a search, leave it for the log, open whatever it was before.
    const search = this.#api.search();
    if (search?.searching) {
      this.#api.page()?.searchField?.restoreValue("");
      search.setQuery("");
      this.logExpanded = true;
    } else this.logExpanded = !this.logExpanded;
    this.#api.draw();
  }

  #openRules(data: RulesSceneData): void {
    this.#scenes.launch(SCENES.rules, data);
  }

  #openLauncher(key: string): void {
    if (!this.#scenes.isActive(key)) this.#scenes.launch(key);
  }

  /** The live Board scene, when one is running underneath. */
  #boardScene(): BoardScene | null {
    return this.#scenes.isActive(SCENES.board) ? (this.#scenes.get(SCENES.board) as BoardScene) : null;
  }

  guidedRunActive(): boolean {
    return this.#boardScene()?.guidedRunActive() ?? false;
  }

  undoable(): ReadonlyMap<string, number> {
    return this.#boardScene()?.undoMoments() ?? new Map<string, number>();
  }

  /** Manual adjust, over this sheet (#791): Done there closes it and Pause takes input again. */
  #openManualAdjust(): void {
    if (!manualAdjustOn() || this.#scenes.isActive(SCENES.manualAdjust)) return;
    if (seatGame()) return this.#openLauncher(SCENES.roomAsk);
    this.#scenes.launch(SCENES.manualAdjust, { from: SCENES.pause } satisfies ManualAdjustData);
  }

  #openChat(): void {
    if (!this.#scenes.isActive(SCENES.roomChat)) this.#launchOver(SCENES.roomChat, {});
  }

  /** Your stats, over this sheet: Back there closes it and Pause takes input again. */
  #openStats(): void {
    if (!this.#scenes.isActive(SCENES.playerStats))
      this.#scenes.launch(SCENES.playerStats, { from: SCENES.pause, overlay: true } satisfies PlayerStatsData);
  }

  /**
   * Leaves the running game: fades this sheet, stops every overlay and the Board, then `next` (Title for Save & quit, How
   * to win for the tutorial). Saves are continuous (every command is written as it lands), so quitting has nothing to
   * flush. `scene.start` stops this scene as part of starting the next one.
   */
  #leaveTo(next: () => void, withAdjust: boolean): void {
    this.#api.motion.exit(this.#api.scene, () => {
      for (const overlay of withAdjust ? LEAVE_OVERLAYS : LEAVE_OVERLAYS.filter((key) => key !== SCENES.manualAdjust))
        if (this.#scenes.isActive(overlay) || this.#scenes.isSleeping(overlay)) this.#scenes.stop(overlay);
      if (this.#scenes.isActive(SCENES.board)) this.#scenes.stop(SCENES.board);
      next();
    });
  }

  async #onConcedeConfirmed(): Promise<void> {
    if (seatGame()) {
      // A guest's Concede leaves the seat and drops to the watch view; the game goes on (#881).
      const board = this.#boardScene();
      this.setConfirmingConcede(false);
      this.resume();
      if (board) void leaveSeatForWatch(board);
      return;
    }
    const { store } = appSession();
    const playerId = store.state.perspectiveId;
    const conceded = playerId ? await store.dispatch({ type: "concede", playerId }) : false;
    this.setConfirmingConcede(false);
    // The engine's refusal (already over, no seat) is in `store.state.error`, which the Board shows; the overlay stays
    // open so the player sees it.
    if (conceded) this.resume();
  }

  /** Copies the live room's watch link; the item says "Link copied" for a moment after (#876). */
  #copyWatchLink(): void {
    const url = pauseWatchLinkOf(liveStatus());
    if (!url) return;
    const scene = this.#api.scene;
    void copyWatchLink(url).then((ok) => {
      if (!ok || !scene.sys.isActive()) return;
      this.linkCopied = true;
      this.#api.draw();
      scene.time.delayedCall(2500, () => {
        this.linkCopied = false;
        if (scene.sys.isActive()) this.#api.draw();
      });
    });
  }

  /** Opens `key` over this sheet, which takes no input until it closes (its panel sits over this one's rows). */
  #launchOver(key: string, data: object): void {
    const scene = this.#api.scene;
    if (this.#scenes.isActive(key)) return;
    scene.input.enabled = false;
    this.#scenes.launch(key, data);
    // Just above Pause, not on top of everything: on top, Settings drew over the sheets it opens itself (#858).
    this.#scenes.moveAbove(this.#scenes.key, key);
    this.#scenes.get(key).events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.enabled = true;
      if (!scene.sys.isActive()) return;
      this.#api.search()?.reindex();
      this.#api.draw();
    });
  }

  async #undoTo(target: number): Promise<void> {
    if (await this.#boardScene()?.undoTo(target)) this.resume();
  }

  /** A press on a result with no control of its own: its page, on the spot it was found. */
  #openResult(id: string): void {
    const search = this.#api.search();
    this.#api.page()?.searchField?.blurInput();
    if (id === "pause-glossary-search")
      return this.#openRules({
        initialTab: "glossary",
        initialScope: "all",
        initialQuery: (search?.query ?? "").trim(),
      });
    const entry = search?.results?.find((result) => result.entry.id === id)?.entry;
    if (entry) openSearchEntry(this.quickHost, entry);
  }
}
