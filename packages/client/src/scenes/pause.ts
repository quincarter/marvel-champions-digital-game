/**
 * Pause (docs/phase4-screen-gaps.md §3 "W4"; owner decision 2026-09-18 — see
 * `view/pause-layout.ts`'s own header for the full read of what changed and
 * why).
 *
 * **Wide (desktop and tablet, both orientations): D13's two-panel sheet.**
 * A left ink menu — Bangers "Paused", the status line, Resume (the one red
 * fill), Full game log, Rules reference, Settings, and Concede pinned at the
 * panel's own foot — beside a right paper panel: "Rules reference" over a
 * grid of bordered keyword/status cards for what's on the table right now
 * (`view/rules-reference.ts`'s own glossary, capped at a few rows by
 * `view/pause-keyword-grid.ts`), then "Jump to a moment" over the most
 * recent log lines (`view/pause-log-window.ts`). A line Undo could get back
 * to this turn is marked ↶ and a tap rewinds there, as pressing Undo that many
 * times would (`view/undo.ts`'s `undoTargetsOf`); nothing else is a jump
 * target. "Full game log" swaps that same footprint for the fuller
 * retained log instead — there is no separate full-log screen to open, so
 * this is what "open the log" means here (`view/pause-layout.ts`'s own doc
 * comment).
 *
 * **Phone: P16's own single-column sheet**, unchanged in spirit from the
 * previous pass — an ink title bar with a boxed ✕, a search field, "Quick
 * reference" chevron rows, the "Table" toggle rows (`scenes/settings.ts`'s
 * own shared row list — P16 draws Table inline, unlike D13, which sends it
 * to the standalone Settings screen instead), and a footer of Resume over
 * Save & quit / Concede side by side. The "Game log" Quick reference row
 * swaps the Table/Guide group for the same recent-log box wide draws.
 *
 * Launched over the Board by its own MENU/≡ chrome button, or by Escape when
 * nothing else (a target/payment mode, the choice sheet, Inspect, the villain
 * walkthrough) already owns it — see `scenes/board.ts`'s own wiring. The board
 * keeps running underneath, exactly like every other overlay in this app.
 *
 * Concede dispatches the engine's `concede` command (`docs/phase4-screen-gaps.md`
 * §2 S5.9: any seated player may concede for the whole table; the outcome is
 * `{ result: "conceded" }`, never a loss). The store's own state update then
 * ends the game the normal way, same as any other command, and the Board hands
 * off to Game Over — so on success this overlay only has to get out of the way.
 */
import Phaser from "phaser";
import "@mc/ui";
import type { McSheet } from "@mc/ui";
import { addPressShield } from "../ui/press-shield.js";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { SheetBuilder, type Measured, type TextOptions } from "../dom/sheet-builder.js";
import { isDesktopType } from "../ui/desktop-type.js";
import type { CardSize } from "../settings.js";
import { playableScenarioOffer } from "@mc/cards";
import { gameEncounterSets, gameScenarios } from "../content/game-deps.js";
import { gameDeps } from "../content/game-deps.js";
import { accent, hit, ink, signal, status, surface, typeRole, type TypeSpec } from "../tokens.js";
import { skin, type WidgetKind, type WidgetState } from "../ui/theme.js";
import { applyTextResolution, drawnDensity } from "../platform/screen-settings.js";
import { McTextInput } from "../ui/widgets.js";
import {
  pauseLayout,
  type PausePhoneLowerContent,
  type PausePhoneLayout,
  type PauseWideLayout,
} from "../view/pause-layout.js";
import { logLineWords, recentLogMoments } from "../view/pause-log-window.js";
import { adjustedSuffixOf, blindSheetNamesOf, pauseStatusOf, seedSuffixOf } from "../view/pause-model.js";
import { rulesGlossaryOf, type RulesEntry } from "../view/rules-reference.js";
import { scenarioCardListOf } from "../view/scenario-card-list.js";
import {
  guideRowDetailOf,
  guideRowInfoOf,
  nextGuidePrefsAfterRow,
  cardSizeRowInfoOf,
  nextSettingsAfterCardSize,
  nextSettingsAfterToggle,
  settingsRowInfoOf,
  type GuideRowInfo,
  type SettingsRowInfo,
  cheatUnlockWarningOf,
} from "../view/settings-rows.js";
import { askToConfirm } from "./end-turn-confirm.js";
import type { GuideLevel } from "../guide/guide-prefs.js";
import { guidePrefs, onGuidePrefsChange, setGuidePrefs } from "../guide/guide-store.js";
import type { ManualAdjustData } from "./manual-adjust.js";
import { pauseFocusOrder } from "../view/screen-focus.js";
import type { Rect } from "../view/layout.js";
import { appSession } from "../session.js";
import { roomCheatsOf } from "../view/room-strict.js";
import { askAllowedOf } from "../view/room-ask-policy.js";
import { activeSeat } from "../platform/seat-play.js";
import { onRoomState, roomState, setSeatShowsHand } from "../platform/room.js";
import { showHandToggleOf, type ShowHandToggle } from "../view/hand-privacy.js";
import { handoverOn, roomChatOn } from "../view/room-prompts.js";
import { inRoomGame } from "../view/whose-turn.js";
import { leaveSeatForWatch } from "./seat-drop.js";
import type { SessionState } from "../store/session-store.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import type { RulesSceneData } from "./rules.js";
import type { RulesTab } from "../view/rules-layout.js";
import { concedeRouteOf } from "../view/competitive-concede.js";
import { SCENES } from "./keys.js";
import type { PlayerStatsData } from "./player-stats.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { OverlayMotion } from "../ui/transitions.js";
import type { BoardScene } from "./board.js";
import { withLevel } from "../guide/guide-prefs.js";
import { detectPlatform } from "../platform/platform.js";
import { inputDevice, padAvailable } from "../platform/input-device.js";
import { followsWindowsMixer } from "../platform/app-volume.js";
import { powerSavingOn } from "../platform/power-saving.js";
import { t, tPlural } from "../i18n/translate.js";
import { liveStatus, onLiveStatus } from "../platform/live-watch.js";
import { copyWatchLink, pauseWatchLinkOf, watchLinkLabelOf } from "../view/live-watch-ui.js";
import { readConsent } from "../global-stats/global-consent.js";
import { applyEarnedItems, earnedItems, earnedPromoSets, unlocks } from "../progression/progression.js";
import { heroPromoShown } from "../view/hero-art-choice.js";
import { SettingsSearchClient } from "../view/settings-search-client.js";
import type { SettingsSearchEntry, SettingsSearchIndexInput, SettingsSearchResult } from "../view/settings-search.js";
import {
  groupPauseResults,
  pauseResultsContentOf,
  pauseSettingRowsOf,
  PauseSearchSession,
  type PauseResultSlot,
  type PauseSettingRow,
  type PauseSettingsState,
} from "../view/pause-search.js";
import { controlsShown, settingsDeviceRowsFor, settingsTabsFor } from "./settings-env.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import { SEARCH_RESULT_ROW_HEIGHT } from "./settings-search-row.js";
import { markedLineOf, type TextRange } from "../view/settings-search-line.js";
import type { SettingsSceneData } from "./settings.js";
import type { UnlocksSceneData } from "./unlocks.js";
import type { SaveDataSceneData } from "./save-data.js";
import type { ControlsSceneData } from "./controls.js";
import type { AchievementToastScene } from "./achievement-toast.js";

/** One "Quick reference" row (phone only): a title, an optional detail line, and what opens when it's activated (or, absent that, why it can't be yet). */
interface QuickReferenceRow {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly open?: () => void;
  readonly unavailable?: string;
  /** Shares one line with the other compact rows (Music, Report, Controls): a short title in a cell, no detail, no chevron. */
  readonly compact?: true;
}

/** Other words a player might search Pause's Reference rows by. Searched, never drawn. */
const REFERENCE_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  villainPhase: ["villain turn", "steps", "order", "phase"],
  glossary: ["keywords", "terms", "definitions", "status"],
  cardList: ["encounter sets", "cards", "scenario", "modular"],
  jumpLog: ["history", "log", "undo", "rewind", "jump to a moment", "what happened"],
  settings: ["options", "preferences", "all settings"],
  stats: ["record", "wins", "losses", "win rate"],
  manualAdjust: ["fix", "edit", "change", "override", "health", "threat", "counters", "bug", "misclick"],
  music: ["songs", "soundtrack", "jukebox", "player"],
  report: ["bug", "feedback", "issue", "wrong ruling", "problem"],
  controls: ["controller", "gamepad", "keyboard", "shortcuts", "buttons"],
};

/** The rows whose change the music player has to hear about. */
const MUSIC_ROW_IDS: ReadonlySet<string> = new Set(["sound", "music-shuffle", "music-volume", "effects-volume"]);

/** The wide menu's own Bangers size — smaller than a bar title, still the display face, matching D13's own read of "RESUME"/"SETTINGS" etc. */
const MENU_BUTTON_TYPE: TypeSpec = { ...typeRole.barTitle, size: 18 };

type GuideNonLevelRow = Extract<GuideRowInfo, { kind: "action" | "toggle" }>;

function isGuideNonLevelRow(row: GuideRowInfo): row is GuideNonLevelRow {
  return row.kind !== "segmented";
}

export class PauseOverlay extends Phaser.Scene {
  #unsubscribe: (() => void) | null = null;
  #unsubscribeGuide: (() => void) | null = null;
  /** The sheet, one Lit panel over the canvas, made on the first draw and kept (so its scroll positions stay). */
  #region: DomRegion<McSheet> | null = null;
  /** The parts the draw in progress is building (a scrolling region's own while it builds that). */
  #b!: SheetBuilder;
  /** What each key in the panel does this draw, for its `mc-activate`. */
  #actions = new Map<string, () => void>();
  /** The Table/Guide and results regions read from their top on the next draw. */
  #lowerFromTop = false;
  #resultsFromTop = false;
  #searchInput: McTextInput | null = null;
  #route: FocusRoute | null = null;
  #confirmingConcede = false;
  /** Wide: "Full game log" swaps the right panel's header/grid/jump-box group for the fuller retained log (`view/pause-layout.ts`'s own `rightContent`). Phone: the "Game log" row swaps the Table/Guide group for the same log box. */
  #logExpanded = false;
  /** "Link copied" shows on the watch link item for a moment after a copy (#876). */
  #linkCopied = false;
  /** Phone: the rows under the Reference toggle are open. Closed, the Table and Guide group has the panel. */
  #quickExpanded = false;
  #motion = new OverlayMotion();
  /** The log moments drawn this pass that a tap rewinds to (`BoardScene.undoMoments`), by line id, in draw order. */
  #momentIds: string[] = [];
  /**
   * The search: Settings' own search worker, indexed when the sheet opens (so the first letter typed is answered at
   * once), and again whenever what the results say may have changed (a resize, a page closing over the sheet).
   */
  #searchClient: SettingsSearchClient | null = null;
  /** What is typed and the worker's answer for it (`view/pause-search.ts`). */
  #search: PauseSearchSession | null = null;

  constructor() {
    super(SCENES.pause);
  }

  create(): void {
    this.#motion = new OverlayMotion();
    this.#confirmingConcede = false;
    this.#logExpanded = false;
    this.#quickExpanded = false;
    this.#region = null;
    this.#lowerFromTop = false;
    this.#resultsFromTop = false;
    // The watch link appearing (or going) while Pause is up adds or drops its item (#876).
    let linkShown = pauseWatchLinkOf(liveStatus()) !== null;
    const liveOff = onLiveStatus((status) => {
      const shown = pauseWatchLinkOf(status) !== null;
      if (shown === linkShown) return;
      linkShown = shown;
      if (this.sys.isActive()) this.#draw();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, liveOff);
    // The room's echo of a Show my hand press changes the control's label (and a seat gained or lost, its presence).
    let handKey = JSON.stringify(this.#showHandToggle());
    const roomOff = onRoomState(() => {
      const key = JSON.stringify(this.#showHandToggle());
      if (key === handKey) return;
      handKey = key;
      if (this.sys.isActive()) this.#draw();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, roomOff);
    this.#searchClient = new SettingsSearchClient();
    this.#search = new PauseSearchSession(
      this.#searchClient,
      () => this.#searchIndexInput(),
      (newQuery) => {
        // A new query's list reads from its top; the same query answered again (a setting changed in place) stays
        // where the player had scrolled to.
        if (newQuery) this.#resultsFromTop = true;
        if (this.sys.isActive()) this.#draw();
      },
    );
    const { store } = appSession();
    this.#unsubscribe = store.subscribe(() => this.#draw());
    // The standalone Settings overlay (or another Pause) can change the same live guide prefs while this one is
    // open behind/beside it — redraw so it never shows a stale level/toggle.
    this.#unsubscribeGuide = onGuidePrefsChange(() => {
      this.#search?.reindex();
      this.#draw();
    });
    const onResize = (): void => {
      // A resize can change Settings' tabs (and so where a result lives, and which rows there are).
      this.#reindexSearch();
      this.#draw();
    };
    this.scale.on("resize", onResize, this);
    // Before the route: A, B or Start takes the caret out of the search field (as on Settings).
    bindTextFieldEscape(
      this,
      () => this.#searchInput,
      () => this.#covered(),
    );
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.#covered() || (this.#searchInput?.focused ?? false),
      onCancel: () => (this.#confirmingConcede ? this.#setConfirmingConcede(false) : this.#resume()),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      this.#unsubscribeGuide?.();
      this.#unsubscribeGuide = null;
      this.#searchInput?.destroy();
      this.#searchInput = null;
      // The panel goes with the scene (`DomRegion`); the next open makes a new one.
      this.#region = null;
      this.#searchClient?.destroy();
      this.#searchClient = null;
      this.#search = null;
    });
    this.#draw();
    // The worker loads the pages it searches on its first message: start it now, so the first letter typed is answered
    // at once. Off the main thread, like the searching itself.
    this.#search.reindex();
  }

  /** True while a page opened from here (or the Board's own warning) is over this sheet and owns the input. */
  #covered(): boolean {
    return (
      this.scene.isActive(SCENES.rules) ||
      this.scene.isActive(SCENES.settings) ||
      this.scene.isActive(SCENES.playerStats) ||
      this.scene.isActive(SCENES.manualAdjust) ||
      // The "This game won't count" warning before a Jump to a moment past a reveal opens over the Board (#791).
      this.scene.isActive(SCENES.endTurnConfirm) ||
      this.scene.isActive(SCENES.controls) ||
      this.scene.isActive(SCENES.unlocks) ||
      this.scene.isActive(SCENES.saveData) ||
      this.scene.isActive(SCENES.inspect)
    );
  }

  /** The music player, over this sheet (the same scene the top bar's note opens). */
  #openMusic(): void {
    if (!this.scene.isActive(SCENES.musicPlayer)) this.scene.launch(SCENES.musicPlayer);
  }

  #openReport(): void {
    if (!this.scene.isActive(SCENES.reportIssue)) this.scene.launch(SCENES.reportIssue);
  }

  #setConfirmingConcede(value: boolean): void {
    // Civil War Competitive (#883): the team's forfeit or leaving alone, on its own sheet, not the one-line confirm.
    const { game, perspectiveId } = appSession().store.state;
    if (value && perspectiveId && concedeRouteOf(game, this.#seatGame()) === "sheet") {
      if (!this.scene.isActive(SCENES.competitiveConcede)) this.scene.launch(SCENES.competitiveConcede);
      return;
    }
    this.#confirmingConcede = value;
    this.#draw();
  }

  #toggleFullGameLog(): void {
    // The log draws where the results are: from a search, leave it for the log, open whatever it was before.
    if (this.#search?.searching) {
      this.#clearSearch();
      this.#logExpanded = true;
    } else this.#logExpanded = !this.#logExpanded;
    this.#draw();
  }

  #resume(): void {
    this.#motion.exit(this, () => this.scene.stop());
  }

  /** The live Board scene, when one is running underneath — mirrors `scenes/inspect.ts`'s own `#boardScene`. */
  #boardScene(): BoardScene | null {
    if (!this.scene.isActive(SCENES.board)) return null;
    return this.scene.get(SCENES.board) as BoardScene;
  }

  /** §3.10 "Pause has 'Stop tutorial' and 'Turn guide off' whenever a guided run is active" (G5c part 3): both
   * entries stay hidden without a live, still-running guide (`BoardScene.guidedRunActive`) — `appSession().guidedRun`
   * alone would keep showing them even after the run already stopped itself once this game. */
  #guidedRunActive(): boolean {
    return this.#boardScene()?.guidedRunActive() ?? false;
  }

  /** "Stop tutorial": the same path the guide panel/callout's own Stop already takes
   * (`BoardGuideMount.stop` → `GuideController.stop`) — ends guidance for this game, keeps playing. */
  #stopTutorial(): void {
    this.#boardScene()?.stopGuide();
    this.#draw();
  }

  /** "Turn guide off": the saved guide level goes to `"off"` (so no *future* game offers guidance unprompted
   * either), and this run stops the same way "Stop tutorial" does — the level change alone wouldn't touch a
   * guide already running against this game's own `appSession().guidedRun`. */
  #turnGuideOff(): void {
    setGuidePrefs(withLevel(guidePrefs(), "off"));
    this.#boardScene()?.stopGuide();
    this.#draw();
  }

  /** Manual adjust is offered when Settings allows it and the game is not a strict lobby room's (`view/room-strict.ts`). */
  #manualAdjustOn(): boolean {
    // A seated guest does not adjust the table: in a Host control room the same place asks the host for a change (#881).
    if (this.#seatGame()) return askAllowedOf("adjust", roomState().settings);
    return roomCheatsOf(appSession().settings, appSession().store.state.config).manualAdjust;
  }

  /** This device plays a room's game from a seat (a guest): Pause leaves instead of saving, and Concede leaves the seat. */
  #seatGame(): boolean {
    return activeSeat() !== null;
  }

  #adjustLabel(): string {
    return this.#seatGame() ? t("ask.change") : t("pause.manualAdjust");
  }

  #quitLabel(): string {
    return this.#seatGame() ? t("ask.leave") : t("pause.saveQuit");
  }

  /** What the Concede confirm says: a guest's Concede is leaving the seat, not ending the game. */
  #concedeSentence(): string {
    if (!this.#seatGame()) return t("pause.concedeSentence");
    return handoverOn(roomState())
      ? `${t("concede.seatTitle")} ${t("concede.seatBody")}`
      : `${t("concede.seatTitle")} ${t("concede.seatStays")}`;
  }

  /** Manual adjust, over this sheet (#791): Done there closes it and Pause takes input again. */
  #openManualAdjust(): void {
    if (!this.#manualAdjustOn() || this.scene.isActive(SCENES.manualAdjust)) return;
    if (this.#seatGame()) {
      if (!this.scene.isActive(SCENES.roomAsk)) this.scene.launch(SCENES.roomAsk);
      return;
    }
    this.scene.launch(SCENES.manualAdjust, { from: SCENES.pause } satisfies ManualAdjustData);
  }

  /** The room's chat is on in this room game: Pause has a Chat entry (the stats' place) (#881). */
  #roomChat(): boolean {
    const room = roomState();
    return inRoomGame(room) && roomChatOn(room);
  }

  #openChat(): void {
    if (!this.scene.isActive(SCENES.roomChat)) this.#launchOver(SCENES.roomChat, {});
  }

  /** Your stats, over this sheet: Back there closes it and Pause takes input again. */
  #openStats(): void {
    if (this.scene.isActive(SCENES.playerStats)) return;
    this.scene.launch(SCENES.playerStats, { from: SCENES.pause, overlay: true } satisfies PlayerStatsData);
  }

  /** Saves are continuous (every command is written as it lands), so "quitting" is just leaving — nothing to flush. */
  #saveAndQuit(): void {
    // Fade this sheet first; the existing stop/start sequence runs once that's
    // done. `scene.start(SCENES.title)` stops this scene as part of starting
    // Title, so there is no separate `this.scene.stop()` for Pause itself.
    this.#motion.exit(this, () => {
      for (const overlay of [
        SCENES.rules,
        SCENES.settings,
        SCENES.playerStats,
        SCENES.manualAdjust,
        SCENES.controls,
        SCENES.choice,
        SCENES.inspect,
        SCENES.villainPhase,
      ]) {
        if (this.scene.isActive(overlay) || this.scene.isSleeping(overlay)) this.scene.stop(overlay);
      }
      if (this.scene.isActive(SCENES.board)) this.scene.stop(SCENES.board);
      this.scene.start(SCENES.title, {});
    });
  }

  /** True when the engine accepted the concession; the store then carries the outcome. */
  async #dispatchConcede(): Promise<boolean> {
    const { store } = appSession();
    const playerId = store.state.perspectiveId;
    if (!playerId) return false;
    return store.dispatch({ type: "concede", playerId });
  }

  async #onConcedeConfirmed(): Promise<void> {
    if (this.#seatGame()) {
      // A guest's Concede leaves the seat and drops to the watch view; the game goes on (#881).
      const board = this.#boardScene();
      this.#setConfirmingConcede(false);
      this.#resume();
      if (board) void leaveSeatForWatch(board);
      return;
    }
    const conceded = await this.#dispatchConcede();
    this.#setConfirmingConcede(false);
    // The engine's refusal (already over, no seat) is in `store.state.error`,
    // which the Board shows; the overlay stays open so the player sees it.
    if (conceded) this.#resume();
  }

  /** The "Show my hand" control in a room game, else null (single player, offline, every hand already open, no seat). */
  #showHandToggle(): ShowHandToggle | null {
    return showHandToggleOf(roomState());
  }

  #showHandLabel(toggle: ShowHandToggle, short: boolean): string {
    const key = toggle.on ? "room.showHand.hide" : "room.showHand.show";
    return t(short ? (`${key}Short` as "room.showHand.showShort" | "room.showHand.hideShort") : key);
  }

  /** Flips the hands this device may show; the room echoes the new lobby state, which redraws Pause. */
  #flipShowHand(): void {
    const toggle = this.#showHandToggle();
    if (!toggle) return;
    for (const seat of toggle.seats) setSeatShowsHand(seat, !toggle.on);
  }

  /** Copies the live room's watch link; the item says "Link copied" for a moment after (#876). */
  #copyWatchLink(): void {
    const url = pauseWatchLinkOf(liveStatus());
    if (!url) return;
    void copyWatchLink(url).then((ok) => {
      if (!ok || !this.sys.isActive()) return;
      this.#linkCopied = true;
      this.#draw();
      this.time.delayedCall(2500, () => {
        this.#linkCopied = false;
        if (this.sys.isActive()) this.#draw();
      });
    });
  }

  #openRules(data: RulesSceneData): void {
    this.scene.launch(SCENES.rules, data);
  }

  /** Phone only — wide mode's menu links straight to Rules reference/Settings instead of this chevron list. */
  #quickReferenceRows(game: SessionState["game"]): readonly QuickReferenceRow[] {
    const rows: QuickReferenceRow[] = [];
    const glossaryCount = game ? rulesGlossaryOf(game, gameDeps()).length : 0;
    const cardListSetCount = game ? scenarioCardListOf(game, gameEncounterSets()).length : 0;
    rows.push(
      {
        id: "villainPhase",
        title: t("pause.q.villainPhase.title"),
        detail: t("pause.q.villainPhase.detail"),
        open: () => this.#openRules({ initialTab: "villainPhase" satisfies RulesTab }),
      },
      {
        id: "glossary",
        title: t("pause.q.glossary.title"),
        detail: game ? tPlural("pause.q.glossary.count", glossaryCount) : t("pause.noGame"),
        open: () => this.#openRules({ initialTab: "glossary" satisfies RulesTab }),
      },
      {
        id: "cardList",
        title: t("pause.q.cardList.title"),
        detail: game ? tPlural("pause.q.cardList.count", cardListSetCount) : t("pause.noGame"),
        open: () => this.#openRules({ initialTab: "cardList" satisfies RulesTab }),
      },
      {
        id: "jumpLog",
        title: t("pause.q.log.title"),
        detail: this.#logExpanded ? t("pause.q.log.shown") : t("pause.q.log.detail"),
        open: () => this.#toggleFullGameLog(),
      },
      // The Table rows below are only a few of them: the rest (music, card size, the villain phase, accessibility) are
      // on the standalone Settings screen, which wide mode's menu links to and the phone had no way to reach.
      {
        id: "settings",
        title: t("pause.q.settings.title"),
        detail: t("pause.q.settings.detail"),
        open: () => this.#launchOver(SCENES.settings, {}),
      },
      {
        id: "stats",
        title: this.#roomChat() ? t("chat.title") : t("pause.yourStats"),
        detail: this.#roomChat() ? t("chat.pauseDetail") : t("pause.q.stats.detail"),
        open: () => (this.#roomChat() ? this.#openChat() : this.#openStats()),
      },
      // Only once the player has turned it on in Settings > More > Cheats (the owner, 2026-11-19).
      ...(this.#manualAdjustOn()
        ? [
            {
              id: "manualAdjust",
              title: this.#adjustLabel(),
              detail: this.#seatGame() ? t("ask.changeDetail") : t("pause.q.adjust.detail"),
              open: () => this.#openManualAdjust(),
            },
          ]
        : []),
      {
        id: "music",
        title: t("pause.music"),
        detail: t("pause.q.music.detail"),
        compact: true,
        open: () => this.#openMusic(),
      },
      {
        id: "report",
        title: t("pause.report"),
        detail: t("pause.q.report.detail"),
        compact: true,
        open: () => this.#openReport(),
      },
      // The phone apps show Controls only once a controller is connected (the owner, 2026-10-24).
      // The live room's link (#876), only while one is open: a compact cell beside Music and Report.
      ...(pauseWatchLinkOf(liveStatus()) !== null
        ? [
            {
              id: "watch-link",
              title: watchLinkLabelOf(this.#linkCopied, true),
              detail: t("live.copyLink"),
              compact: true as const,
              open: () => this.#copyWatchLink(),
            },
          ]
        : []),
      ...(this.#showHandToggle()
        ? [
            {
              id: "show-hand",
              title: this.#showHandLabel(this.#showHandToggle()!, false),
              detail: this.#showHandLabel(this.#showHandToggle()!, false),
              // Its own full-width row in the expanded Quick reference: a fifth compact cell is under the touch
              // target and cannot hold "Mostrar mano".
              open: () => this.#flipShowHand(),
            },
          ]
        : []),
      ...(detectPlatform() !== "capacitor" || padAvailable()
        ? [
            {
              id: "controls",
              title: t("pause.q.controls.title"),
              detail: t("pause.q.controls.detail"),
              compact: true as const,
              open: () => this.scene.launch(SCENES.controls),
            },
          ]
        : []),
    );
    return rows;
  }

  // ------------------------------------------------------------------------------------------------------------
  // The sheet is one Lit panel (`mc-sheet`, `dom/sheet-builder.ts`) over the canvas: each `#draw` builds its parts
  // again, at the rects `view/pause-layout.ts` gives, and hands them to the panel. Phaser keeps the scrim, the press
  // shield, the search field and the invisible motion anchor the panel follows (`DomRegion.follow`).
  // ------------------------------------------------------------------------------------------------------------

  /** A label (Phaser's `label()` and a `caseOf`'d `add.text`): the spec's own case, tracking and weight. */
  #label(
    x: number,
    y: number,
    text: string,
    spec: TypeSpec,
    color: number,
    alpha: number = ink.label,
    options: Omit<TextOptions, "color" | "alpha"> = {},
  ): Measured {
    return this.#b.text(x, y, text, spec, { ...options, color, alpha });
  }

  /** A text as `add.text(..., textStyle(spec, ...))` drew it: the spec's face and size, never uppercased. */
  #plain(
    x: number,
    y: number,
    text: string,
    spec: TypeSpec,
    color: number,
    alpha = 1,
    options: Omit<TextOptions, "color" | "alpha"> = {},
  ): Measured {
    return this.#b.text(x, y, text, { ...spec, uppercase: false }, { ...options, color, alpha });
  }

  /** `paintPanel`: a box in a widget kind's skin. */
  #panel(rect: Rect, kind: WidgetKind, state: WidgetState): void {
    const s = skin(kind, state);
    this.#b.box(rect, {
      fill: s.fill,
      stroke: s.stroke,
      strokeWidth: s.strokeWidth,
      ...(s.fillAlpha < 1 ? { alpha: s.fillAlpha } : {}),
      ...(s.dashed ? { dashed: true } : {}),
    });
  }

  /** What a key does when the panel reports a tap on it. */
  #press(key: string, action: () => void): void {
    this.#actions.set(key, action);
  }

  /** A stop inside one of the panel's scrolling regions: its box is read off the panel, so it follows the scroll. */
  #scrollStop(
    scroll: { readonly key: string; readonly rect: Rect },
    itemKey: string,
    rect: Rect,
    activate: () => void,
  ): FocusStop {
    const region = (): DomRegion<McSheet> | null => this.#region;
    return {
      rect: () => {
        const found = region()?.element.elementOf(itemKey);
        return found ? region()!.rectOf(found) : rect;
      },
      view: () => {
        const found = region()?.element.elementOf(scroll.key);
        return found ? region()!.rectOf(found) : scroll.rect;
      },
      activate,
      ensureVisible: () => region()?.element.elementOf(itemKey)?.scrollIntoView({ block: "nearest" }),
    };
  }

  /** Builds the parts of a scrolling region in its own content space (`y` from 0, `x` the screen's). */
  #inScroll(key: string, rect: Rect, height: number, draw: () => void): void {
    const outer = this.#b;
    outer.scroll(key, rect, height, (inner) => {
      this.#b = inner;
      try {
        draw();
      } finally {
        this.#b = outer;
      }
    });
  }

  /** Hands the built parts to the panel (made once, so scroll positions survive a redraw) and renders them now. */
  #mount(width: number, height: number, searchRect: Rect): void {
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      element.addEventListener("mc-activate", (event) => {
        // Closing already (its exit is playing): a second tap must not act.
        if (this.#motion.leaving) return;
        this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      this.#region = new DomRegion(this, element, { x: 0, y: 0, width, height });
    }
    const region = this.#region;
    region.setRect({ x: 0, y: 0, width, height });
    // The search field is a Phaser DOM element under the panel: left out of it, it is seen and pressed. Only while it
    // shows: under a pop-up it hides itself, and the hole would show the board through the panel.
    region.setHoles(() => (this.#searchInput?.shown ? [searchRect] : []));
    region.element.nodes = this.#b.nodes;
    renderNow(region.element);
    if (this.#lowerFromTop) {
      const scroller = region.element.elementOf("lower");
      if (scroller) scroller.scrollTop = 0;
      this.#lowerFromTop = false;
    }
    if (this.#resultsFromTop) {
      const scroller = region.element.elementOf("results");
      if (scroller) scroller.scrollTop = 0;
      this.#resultsFromTop = false;
    }
  }

  #draw(): void {
    // Answered its own exit already (Resume, Save & quit) — a store update or
    // resize mid-fade must not redraw over the outgoing sheet.
    if (this.#motion.leaving) return;
    this.#momentIds = [];
    this.#actions = new Map();

    const { store, settings } = appSession();
    const { game, perspectiveId, config } = store.state;
    const { width, height } = this.scale.gameSize;

    const allQuickRows = this.#quickReferenceRows(game);
    const quickReferenceRows = this.#quickExpanded ? allQuickRows : allQuickRows.filter((row) => row.compact);
    // With something typed, the results take everything between the field and the footer (phone) or the right panel (wide).
    const searching = this.#search?.searching ?? false;
    const tableRows = settingsRowInfoOf(settings);
    const keywordEntries = game ? rulesGlossaryOf(game, gameDeps()) : [];
    const guideRows = guideRowInfoOf(guidePrefs());
    const guideAfterLevel = guideRows.filter(isGuideNonLevelRow);
    const guidedRunActive = this.#guidedRunActive();
    const watchLinkUrl = pauseWatchLinkOf(liveStatus());
    // Phone: the log takes the Table/Guide group's place, so neither group's rows are on screen to focus.
    const phoneLogShown = this.#logExpanded;

    const blindLines = game && perspectiveId ? this.#blindSheet(game, perspectiveId, config) : [];
    const layout = pauseLayout(
      { x: 0, y: 0, width, height },
      {
        blindLineCount: blindLines.length,
        keywordCount: keywordEntries.length,
        keywordTexts: keywordEntries.map((entry) => ({
          definition: entry.definition,
          hasTail: entry.cardRefs.length > 0,
        })),
        quickReferenceDetails: quickReferenceRows.map((row) => row.unavailable ?? row.detail),
        quickReferenceCompactTail: quickReferenceRows.filter((row) => row.compact).length,
        quickReferenceFullWidthHead: quickReferenceRows.filter((row) => row.id === "search").length,
        tableDetails: tableRows.map((row) => row.unavailable ?? row.detail),
        guideRowDetails: guideAfterLevel.map(guideRowDetailOf),
        guidedRunActive,
        watchLink: watchLinkUrl !== null,
        showHand: this.#showHandToggle() !== null,
      },
    );

    // The field outlives a redraw: rebuilding a DOM <input> mid-keystroke would drop the caret.
    const kept = this.#searchInput?.gameObjects ?? [];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);

    // Dim scrim over the board — the sheet itself is the panel above it.
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    // The scrim is Graphics, which takes no pointer: without this a press outside the sheet reached the board.
    addPressShield(this, { x: 0, y: 0, width, height });
    const panelsFrom = this.children.list.length;
    // Nothing drawn: the entrance and exit tween this, and the panel rises and fades with it (`DomRegion.follow`).
    const anchor = this.add.graphics();

    this.#b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    const stops = new Map<string, FocusStop>();
    let order: readonly string[];
    let searchRect: Rect;

    if (layout.kind === "wide") {
      searchRect = layout.search;
      const resultIds = this.#drawWide(layout, keywordEntries, game, perspectiveId, config, stops, searching);
      order = pauseFocusOrder({
        ...(searching ? { searchResultIds: resultIds } : {}),
        kind: "wide",
        keywordIds: keywordEntries.slice(0, layout.keywordGrid.shown).map((entry) => entry.id),
        momentIds: this.#momentIds,
        confirmingConcede: this.#confirmingConcede,
        guidedRunActive,
        watchLink: layout.watchLink !== null,
        showHand: layout.showHand !== null,
      });
    } else {
      searchRect = layout.search;
      const { guideRowIds, resultIds } = this.#drawPhone(
        layout,
        quickReferenceRows,
        tableRows,
        guideRows,
        game,
        perspectiveId,
        config,
        stops,
        searching,
      );
      order = pauseFocusOrder({
        ...(searching ? { searchResultIds: resultIds } : {}),
        kind: "phone",
        // The compact cells share the toggle's line, so they come before the rows it opens.
        quickReferenceIds: [
          ...quickReferenceRows.filter((row) => row.compact),
          ...quickReferenceRows.filter((row) => !row.compact),
        ].map((row) => row.id),
        momentIds: this.#momentIds,
        tableRowIds: phoneLogShown
          ? []
          : [
              ...cardSizeRowInfoOf(appSession().settings).options.map((option) => `card-size:${option.value}`),
              ...tableRows.map((row) => row.id),
            ],
        guideRowIds,
        confirmingConcede: this.#confirmingConcede,
        guidedRunActive: guidedRunActive && !phoneLogShown,
      });
    }

    // Rendered before the route reads its stops, so a stop inside a scrolling region can find its element.
    this.#mount(width, height, searchRect);
    this.#route?.set(order, stops);

    // A kept field's ring was first on the list, under the anchor drawn since (as in `scenes/settings.ts`).
    for (const node of kept) this.children.bringToTop(node);
    this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.slice(panelsFrom) });
    this.#region?.follow(anchor);
  }

  // ------------------------------------------------------------------------------------------------------------
  // Wide (desktop + tablet, both orientations): D13's two-panel sheet.
  // ------------------------------------------------------------------------------------------------------------

  #drawWide(
    layout: PauseWideLayout,
    entries: readonly RulesEntry[],
    game: SessionState["game"],
    perspectiveId: SessionState["perspectiveId"],
    config: SessionState["config"],
    stops: Map<string, FocusStop>,
    searching: boolean,
  ): readonly string[] {
    const b = this.#b;
    // A hard offset shadow behind the sheet — the design's own one shadow besides the selection ring.
    b.box(
      { x: layout.sheet.x + 8, y: layout.sheet.y + 8, width: layout.sheet.width, height: layout.sheet.height },
      { fill: surface.ink.hex, fillAlpha: 0.5 },
    );

    b.box(layout.left, { fill: surface.ink.hex, stroke: surface.paper.hex, strokeWidth: 4 });
    b.dots(layout.left, "ink", 8, 1, 0.08);

    // Searching, the right panel turns ink like the left, the ground the results (and the phone's) are drawn for.
    b.box(layout.right, {
      fill: searching ? surface.ink.hex : surface.paper.hex,
      stroke: searching ? surface.paper.hex : surface.ink.hex,
      strokeWidth: 4,
    });
    b.dots(layout.right, searching ? "ink" : "paper", 6, 1, 0.1);

    this.#label(layout.title.x, layout.title.y, t("pause.title"), typeRole.barTitle, surface.paper.hex, 1, {
      size: 30,
    });
    const statusText = game && perspectiveId ? this.#wideStatusLine(game, perspectiveId, config) : t("pause.noGame");
    this.#label(layout.status.x, layout.status.y, statusText, typeRole.label, surface.paper.hex, ink.secondary, {
      size: 11,
      fitWidth: layout.status.width,
    });
    if (game && perspectiveId) this.#drawBlindSheet(layout.blindSheet, game, perspectiveId, config);

    this.#menuButton(stops, "resume", "primary", t("pause.resume"), layout.menu.resume, () => this.#resume());
    this.#menuButton(
      stops,
      "full-game-log",
      "onInk",
      t("pause.fullGameLog"),
      layout.menu.fullGameLog,
      () => this.#toggleFullGameLog(),
      this.#logExpanded,
    );
    this.#menuButton(stops, "rules-reference", "onInk", t("pause.rulesReference"), layout.menu.rulesReference, () =>
      this.#openRules({ initialTab: "glossary" satisfies RulesTab }),
    );
    this.#menuButton(stops, "settings", "onInk", t("settings.title"), layout.menu.settings, () =>
      this.#launchOver(SCENES.settings, {}),
    );
    // A room game's chat takes the stats slot: its stop keeps the id, so the focus route is the same (#881).
    this.#menuButton(
      stops,
      "stats",
      "onInk",
      this.#roomChat() ? t("chat.open") : t("pause.yourStats"),
      layout.menu.stats,
      () => (this.#roomChat() ? this.#openChat() : this.#openStats()),
    );
    this.#menuButton(stops, "save-quit", "onInk", this.#quitLabel(), layout.menu.saveQuit, () => this.#saveAndQuit());
    this.#menuButton(stops, "music", "onInk", t("pause.music"), layout.menu.music, () => this.#openMusic());
    // Half a narrow sheet (tablet portrait) cannot hold the whole phrase.
    const reportLabel = layout.menu.report.width < 130 ? t("pause.report") : t("pause.reportLong");
    this.#menuButton(stops, "report", "onInk", reportLabel, layout.menu.report, () => this.#openReport());
    if (layout.watchLink)
      this.#menuButton(stops, "watch-link", "onInk", watchLinkLabelOf(this.#linkCopied, false), layout.watchLink, () =>
        this.#copyWatchLink(),
      );

    const showHand = this.#showHandToggle();
    if (layout.showHand && showHand)
      this.#menuButton(
        stops,
        "show-hand",
        "onInk",
        this.#showHandLabel(showHand, layout.showHand.width < 200),
        layout.showHand,
        () => this.#flipShowHand(),
      );

    // §3.10 "Pause has 'Stop tutorial' and 'Turn guide off' whenever a guided run is active" (G5c part 3) —
    // `layout.guideStopTutorial`/`guideTurnGuideOff` are `null` unless `guidedRunActive` was true when this layout
    // was built, so this stays a no-op for the far more common non-guided game.
    if (layout.guideStopTutorial && layout.guideTurnGuideOff) {
      this.#menuButton(stops, "guide-stop-tutorial", "onInk", t("pause.stopTutorial"), layout.guideStopTutorial, () =>
        this.#stopTutorial(),
      );
      this.#menuButton(stops, "guide-turn-guide-off", "onInk", t("pause.turnGuideOff"), layout.guideTurnGuideOff, () =>
        this.#turnGuideOff(),
      );
    }

    // The wide status line has no room for it, so the left panel says it in the gap above Manual adjust.
    if (!this.#confirmingConcede && appSession().store.state.adjusted) {
      this.#plain(
        layout.manualAdjust.x,
        layout.manualAdjust.y - 36,
        t("pause.adjusted"),
        typeRole.label,
        surface.paper.hex,
        ink.secondary,
        { size: 11, wrapWidth: layout.manualAdjust.width, lineSpacing: 2 },
      );
    }
    if (this.#confirmingConcede) this.#drawWideConcedeConfirm(layout, stops);
    else {
      // Not the primary, and in the slot the concede confirm takes over, so the two never show at once.
      // Off unless the player turned it on in Settings > More > Cheats (the owner, 2026-11-19).
      if (this.#manualAdjustOn()) {
        this.#menuButton(stops, "manual-adjust", "onInk", this.#adjustLabel(), layout.manualAdjust, () =>
          this.#openManualAdjust(),
        );
      }
      // The same full-strength outline as the rest of the menu. D13 dims it, which read as *disabled* (owner,
      // 2026-09-18); its place alone at the panel's foot, and the confirm step behind it, already set it apart.
      this.#menuButton(stops, "concede", "onInk", t("pause.concede"), layout.concede, () =>
        this.#setConfirmingConcede(true),
      );
    }

    this.#drawSearchField(layout.search, stops);
    if (searching) return this.#drawSearchResults(layout.searchResults, stops);
    this.#drawWideRight(layout, entries, game, stops);
    return [];
  }

  #menuButton(
    stops: Map<string, FocusStop>,
    id: string,
    kind: "primary" | "onInk",
    text: string,
    rect: Rect,
    onClick: () => void,
    selected = false,
  ): void {
    stops.set(id, { rect, activate: onClick });
    this.#press(id, onClick);
    this.#b.button({ key: id, rect, label: text, look: kind, type: MENU_BUTTON_TYPE, selected });
  }

  #drawWideConcedeConfirm(layout: PauseWideLayout, stops: Map<string, FocusStop>): void {
    this.#plain(
      layout.title.x,
      layout.concedeConfirmCancel.y - 34,
      this.#concedeSentence(),
      typeRole.body,
      accent.heroRed.hex,
      1,
      { size: 10, wrapWidth: layout.title.width },
    );
    const yes = (): void => void this.#onConcedeConfirmed();
    const cancel = (): void => this.#setConfirmingConcede(false);
    stops.set("concede-confirm-yes", { rect: layout.concedeConfirmYes, activate: yes });
    this.#press("concede-confirm-yes", yes);
    this.#b.button({
      key: "concede-confirm-yes",
      rect: layout.concedeConfirmYes,
      label: this.#seatGame() ? t("concede.seatConfirm") : t("pause.concedeYes"),
      look: "primary",
      type: MENU_BUTTON_TYPE,
    });
    stops.set("concede-confirm-cancel", { rect: layout.concedeConfirmCancel, activate: cancel });
    this.#press("concede-confirm-cancel", cancel);
    this.#b.button({
      key: "concede-confirm-cancel",
      rect: layout.concedeConfirmCancel,
      label: t("pause.cancel"),
      look: "onInk",
      type: MENU_BUTTON_TYPE,
    });
  }

  #drawWideRight(
    layout: PauseWideLayout,
    entries: readonly RulesEntry[],
    game: SessionState["game"],
    stops: Map<string, FocusStop>,
  ): void {
    if (this.#logExpanded) {
      this.#drawExpandedLog(layout, stops);
      return;
    }

    const headerTitle = this.#label(
      layout.rulesHeader.x,
      layout.rulesHeader.y,
      t("pause.rulesReference"),
      typeRole.barTitle,
      surface.ink.hex,
      1,
      { size: 20 },
    );
    const filterText = game ? t("pause.filtered") : t("pause.filteredNone");
    const filterRight = layout.rulesHeader.x + layout.rulesHeader.width;
    const filterLabel = this.#label(
      filterRight,
      layout.rulesHeader.y + 8,
      filterText,
      typeRole.label,
      surface.ink.hex,
      ink.secondary,
      { origin: [1, 0], size: 9, fitWidth: 240 },
    );
    const ruleY = layout.rulesHeader.y + headerTitle.height / 2 + 4;
    const ruleStartX = layout.rulesHeader.x + headerTitle.width + 12;
    const ruleEndX = filterRight - filterLabel.width - 12;
    if (ruleEndX > ruleStartX)
      this.#b.box(
        { x: ruleStartX, y: ruleY, width: ruleEndX - ruleStartX, height: 2 },
        { fill: surface.ink.hex, fillAlpha: 0.3 },
      );

    if (layout.keywordGrid.shown === 0) {
      const emptyText = game ? t("pause.keywordsNone") : t("pause.keywordsNoGame");
      this.#plain(layout.keywordEmpty.x, layout.keywordEmpty.y, emptyText, typeRole.body, surface.ink.hex, ink.meta, {
        size: 10,
        wrapWidth: layout.keywordEmpty.width,
      });
    } else {
      entries
        .slice(0, layout.keywordGrid.shown)
        .forEach((entry, index) => this.#drawKeywordCard(layout.keywordGrid.cells[index]!, entry, stops));
    }

    this.#drawLogSection(layout.jumpHeader, layout.logBox, t("pause.jump"), stops);
  }

  /** One bordered keyword/status card — a status is a filled card in its own status color with paper text (colorblind-safe: the term is always the plain word, never color alone), a keyword a plain outlined card. Tapping either opens the full Rules reference overlay's Glossary tab, filtered to this term. */
  #drawKeywordCard(rect: Rect, entry: RulesEntry, stops: Map<string, FocusStop>): void {
    const isStatus = entry.id === "stunned" || entry.id === "confused" || entry.id === "tough";
    if (isStatus) {
      this.#b.box(rect, { fill: status[entry.id as "stunned" | "confused" | "tough"].hex });
      this.#b.box(
        { x: rect.x + 1.5, y: rect.y + 1.5, width: rect.width - 3, height: rect.height - 3 },
        { stroke: surface.inkOnHue.hex, strokeWidth: 3 },
      );
    } else {
      this.#panel(rect, "card", "rest");
    }
    const textColor = isStatus ? surface.paper.hex : surface.ink.hex;
    const pad = 10;
    const term = this.#label(rect.x + pad, rect.y + 8, entry.displayName, typeRole.barTitle, textColor, 1, {
      size: 16,
      fitWidth: rect.width - pad * 2,
    });
    this.#plain(
      rect.x + pad,
      rect.y + 8 + term.height + 4,
      entry.definition,
      typeRole.body,
      textColor,
      isStatus ? 1 : ink.body,
      { size: 9, wrapWidth: rect.width - pad * 2 },
    );
    const tailCard = entry.cardRefs[0];
    if (tailCard)
      this.#plain(
        rect.x + pad,
        rect.y + rect.height - 16,
        t("pause.onCard", { card: tailCard.name }),
        typeRole.label,
        textColor,
        isStatus ? 0.85 : ink.meta,
        { size: 9, fitWidth: rect.width - pad * 2 },
      );
    const activate = (): void =>
      this.#openRules({ initialTab: "glossary" satisfies RulesTab, initialQuery: entry.displayName });
    this.#press(`keyword:${entry.id}`, activate);
    this.#b.tap(`keyword:${entry.id}`, rect);
    stops.set(`keyword:${entry.id}`, { rect, activate });
  }

  /** The parchment box of recent log lines — shared by the normal "Jump to a moment" footprint and "Full game log"'s expanded one. Lines Undo could get back to are tap targets (`#drawUndoMoment`). */
  #drawLogBox(boxRect: Rect, stops: Map<string, FocusStop>): void {
    this.#b.box(boxRect, { fill: surface.parchment.hex, stroke: surface.ink.hex, strokeWidth: 2 });

    const padX = 12;
    const padY = 10;
    const footerHeight = 16;
    const textWidth = Math.max(1, boxRect.width - padX * 2 - 46);
    const available = Math.max(0, boxRect.height - padY * 2 - footerHeight - 6);
    // The moments Undo could get back to this turn: tapping one is pressing Undo that many times (`view/undo.ts`).
    // Each is a full touch target tall, its words centred in it; the other lines stay at their text height.
    const undoable = this.#boardScene()?.undoMoments() ?? new Map<string, number>();
    const moments = recentLogMoments(appSession().gameLog.lines, available, textWidth, (line) =>
      undoable.has(line.id) ? hit.target : 0,
    );

    if (moments.length === 0) {
      this.#plain(boxRect.x + padX, boxRect.y + padY, t("pause.logEmpty"), typeRole.body, surface.ink.hex, ink.meta, {
        size: 10,
      });
    } else {
      let y = boxRect.y + padY;
      for (const moment of moments) {
        const target = undoable.get(moment.line.id);
        let textY = y;
        if (target !== undefined) {
          this.#drawUndoMoment(moment.line.id, target, boxRect, y, moment.height, stops);
          textY = y + (moment.height - moment.textHeight) / 2;
        }
        this.#plain(boxRect.x + padX, textY, moment.line.ref, typeRole.mono, surface.ink.hex, ink.meta, { size: 9 });
        this.#plain(boxRect.x + padX + 46, textY, logLineWords(moment.line), typeRole.body, surface.ink.hex, ink.body, {
          size: 10,
          wrapWidth: textWidth,
        });
        y += moment.height;
      }
    }
    this.#label(
      boxRect.x + padX,
      boxRect.y + boxRect.height - padY - 6,
      undoable.size > 0 ? t("pause.logUndoHint") : t("pause.logUndoNone"),
      typeRole.label,
      surface.ink.hex,
      ink.meta,
      { size: 8, origin: [0, 0.5] },
    );
  }

  /**
   * One log moment Undo could get back to: outlined, marked ↶ at its right edge, and a tap target that rewinds there
   * and returns to the table, where the Undo notice says what was taken back.
   */
  #drawUndoMoment(
    lineId: string,
    target: number,
    boxRect: Rect,
    y: number,
    height: number,
    stops: Map<string, FocusStop>,
  ): void {
    // The whole row is the target (`height` is at least `hit.target`, from `recentLogMoments`), less a 2 px seam so
    // two undoable rows in a row read as two.
    const rect: Rect = { x: boxRect.x + 4, y: y - 2, width: boxRect.width - 8, height: Math.max(1, height - 2) };
    this.#b.box(rect, { stroke: surface.ink.hex, strokeWidth: 1, alpha: 0.5 });
    this.#label(rect.x + rect.width - 10, rect.y + rect.height / 2, "↶", typeRole.rowTitle, surface.ink.hex, 1, {
      origin: [0.5, 0.5],
      size: 14,
    });
    const activate = (): void => void this.#undoTo(target);
    this.#press(`moment:${lineId}`, activate);
    this.#b.tap(`moment:${lineId}`, rect);
    stops.set(`moment:${lineId}`, { rect, activate });
    this.#momentIds.push(lineId);
  }

  async #undoTo(target: number): Promise<void> {
    if (await this.#boardScene()?.undoTo(target)) this.#resume();
  }

  #drawLogSection(headerRect: Rect, boxRect: Rect, title: string, stops: Map<string, FocusStop>): void {
    this.#label(headerRect.x, headerRect.y, title, typeRole.barTitle, surface.ink.hex, 1, { size: 18 });
    this.#drawLogBox(boxRect, stops);
  }

  /** "Full game log": there is no separate full-log screen to open (`view/pause-layout.ts`'s own doc comment), so this swaps the header/grid/jump-header/log-box group for one taller box over the same footprint instead. */
  #drawExpandedLog(layout: PauseWideLayout, stops: Map<string, FocusStop>): void {
    const rect = layout.rightContent;
    const titleText = this.#label(rect.x, rect.y, t("pause.fullGameLog"), typeRole.barTitle, surface.ink.hex, 1, {
      size: 20,
    });
    const noteY = rect.y + titleText.height + 4;
    const note = this.#plain(rect.x, noteY, t("pause.fullLogNote"), typeRole.label, surface.ink.hex, ink.secondary, {
      size: 9,
      wrapWidth: rect.width,
    });
    const boxTop = noteY + note.height + 8;
    this.#drawLogBox(
      { x: rect.x, y: boxTop, width: rect.width, height: Math.max(60, rect.y + rect.height - boxTop) },
      stops,
    );
  }

  // ------------------------------------------------------------------------------------------------------------
  // Phone: P16's own single-column sheet.
  // ------------------------------------------------------------------------------------------------------------

  #drawPhone(
    layout: PausePhoneLayout,
    quickReferenceRows: readonly QuickReferenceRow[],
    tableRows: readonly SettingsRowInfo[],
    guideRows: readonly GuideRowInfo[],
    game: SessionState["game"],
    perspectiveId: SessionState["perspectiveId"],
    config: SessionState["config"],
    stops: Map<string, FocusStop>,
    searching: boolean,
  ): { readonly guideRowIds: readonly string[]; readonly resultIds: readonly string[] } {
    this.#b.box(layout.panel, { fill: surface.ink.hex, stroke: surface.paper.hex, strokeWidth: 4 });
    this.#b.dots(layout.panel, "ink", 8, 1, 0.08);

    this.#drawHeader(layout.header, layout.closeButton, layout.blindSheet, game, perspectiveId, config, stops);

    this.#drawSearchField(layout.search, stops);

    if (searching) {
      const resultIds = this.#drawSearchResults(layout.searchResults, stops);
      this.#drawPhoneFooter(layout, stops);
      return { guideRowIds: [], resultIds };
    }

    this.#drawQuickReferenceToggle(
      layout.quickReferenceToggle,
      quickReferenceRows.some((row) => !row.compact),
      stops,
    );
    quickReferenceRows.forEach((row, index) =>
      this.#drawQuickReferenceRow(layout.quickReferenceRows[index]!, row, stops),
    );

    let guideStopIds: readonly string[] = [];
    if (this.#logExpanded) this.#drawLogBox(layout.lowerViewport, stops);
    else guideStopIds = this.#drawLowerGroup(layout.lowerViewport, layout.lowerContent, tableRows, guideRows, stops);

    this.#drawPhoneFooter(layout, stops);
    return { guideRowIds: guideStopIds, resultIds: [] };
  }

  #drawPhoneFooter(layout: PausePhoneLayout, stops: Map<string, FocusStop>): void {
    if (this.#confirmingConcede) this.#drawPhoneConcedeConfirm(layout, stops);
    else {
      this.#button(stops, "resume", "primary", t("pause.resume"), layout.resume, () => this.#resume());
      this.#button(stops, "save-quit", "secondary", this.#quitLabel(), layout.saveQuit, () => this.#saveAndQuit());
      this.#button(stops, "concede", "quiet", t("pause.concede"), layout.concede, () =>
        this.#setConfirmingConcede(true),
      );
    }
  }

  // ------------------------------------------------------------------------------------------------------------
  // The search (phone): with something typed, grouped results in place of everything between the field and the
  // footer (`view/pause-search.ts`). Settings rows change in place; the rest open their page.
  // ------------------------------------------------------------------------------------------------------------

  /** The one search field, wherever this layout puts it. */
  #drawSearchField(rect: Rect, stops: Map<string, FocusStop>): void {
    if (this.#searchInput) this.#searchInput.layout(rect);
    else {
      this.#searchInput = new McTextInput(this, {
        rect,
        value: this.#search?.query ?? "",
        placeholder: t("pause.searchPlaceholder"),
        onChange: (value) => this.#onQuery(value),
      });
    }
    stops.set("search", { rect, activate: () => this.#searchInput?.focus() });
  }

  /** Empties the field and the results: the sheet is back to how it opens. */
  #clearSearch(): void {
    this.#searchInput?.setValue("");
    this.#search?.setQuery("");
  }

  /** Each change drops the last answer at once, so nothing found for an older query is drawn or pressed. */
  #onQuery(value: string): void {
    this.#search?.setQuery(value);
    this.#draw();
  }

  /** Indexes again, and asks again for what is typed, so the results read what is true now. */
  #reindexSearch(): void {
    this.#search?.reindex();
  }

  /** The Settings rows this device shows and Pause can find, as they read now. */
  #settingRows(): readonly PauseSettingRow[] {
    const settings = appSession().settings;
    return pauseSettingRowsOf(settings, guidePrefs(), {
      powerSaving: powerSavingOn(),
      mixer: followsWindowsMixer(),
      promoShown: heroPromoShown(earnedPromoSets(), settings.promoArtOn),
      earned: earnedItems(),
    });
  }

  /** Pause's own Reference rows, as search entries. */
  #referenceEntries(): readonly SettingsSearchEntry[] {
    const { game } = appSession().store.state;
    return this.#quickReferenceRows(game).map((row) => ({
      id: `pause:${row.id}`,
      title: row.title,
      detail: row.detail,
      place: t("pause.place"),
      target: { kind: "pause", id: row.id },
      ...(REFERENCE_KEYWORDS[row.id] ? { keywords: REFERENCE_KEYWORDS[row.id] } : {}),
    }));
  }

  /** What Settings' search worker indexes, with Pause's Settings rows and Reference rows, as they read now. */
  #searchIndexInput(): SettingsSearchIndexInput {
    const { width, height } = this.scale.gameSize;
    const settings = appSession().settings;
    const { progress, prefs, devUnlockAll, achievementPoints } = unlocks();
    return {
      tabs: settingsTabsFor(this.game, width, height, settings, guideRowInfoOf(guidePrefs())),
      rows: [
        // The rows Pause has no control for first, so a row Pause can change wins where both name it.
        ...settingsDeviceRowsFor(this.game, width, height, settings),
        ...this.#settingRows().map((row) => [row.id, { title: row.title, detail: row.detail }] as const),
      ],
      settings,
      pad: inputDevice().pad,
      unlocks: { progress, prefs, devUnlockAll, achievementPoints },
      globalConsent: readConsent(),
      controls: controlsShown(),
      extra: this.#referenceEntries(),
    };
  }

  /**
   * The grouped results in `room`'s own scroll region: each group's heading, then its rows. Returns the focus stop
   * ids in draw order. Until the worker first answers for this query, a line says it is searching.
   */
  #drawSearchResults(room: Rect, stops: Map<string, FocusStop>): readonly string[] {
    const results = this.#search?.results ?? null;
    if (results === null) {
      this.#plain(room.x, room.y + 14, t("pause.searching"), typeRole.body, surface.paper.hex, 0.7, { size: 12 });
      return [];
    }
    const query = (this.#search?.query ?? "").trim();
    const rowsById = new Map(this.#settingRows().map((row) => [row.id as string, row]));
    type Item = {
      readonly slot: PauseResultSlot;
      readonly draw: (rect: Rect, index: number) => readonly string[];
    };
    const items: Item[] = [];
    if (results.length === 0) {
      items.push({
        slot: { kind: "link" },
        draw: (rect) => {
          this.#plain(rect.x, rect.y + 14, t("pause.noMatch"), typeRole.body, surface.paper.hex, 0.8, {
            size: 12,
            wrapWidth: rect.width,
          });
          return [];
        },
      });
    }
    for (const group of groupPauseResults(results)) {
      items.push({
        slot: { kind: "heading" },
        draw: (rect) => {
          this.#label(rect.x, rect.y + 4, group.title, typeRole.label, surface.paper.hex, ink.secondary);
          return [];
        },
      });
      for (const result of group.results) {
        const target = result.entry.target;
        const row = target.kind === "setting" ? rowsById.get(target.item) : undefined;
        if (row && row.control.kind === "toggle") {
          const control = row.control;
          items.push({
            slot: { kind: "toggle", detail: row.detail },
            draw: (rect, index) => [this.#drawResultToggle(rect, row, control, index, room, stops)],
          });
        } else if (row && row.control.kind === "choice") {
          const control = row.control;
          items.push({
            slot: { kind: "choice", detail: row.detail },
            draw: (rect, index) => this.#drawResultChoice(rect, row, control, index, room, stops),
          });
        } else {
          items.push({
            slot: { kind: "link" },
            draw: (rect, index) => [this.#drawResultLink(rect, result, index, room, stops)],
          });
        }
      }
      // The Rules group ends with the way into the full glossary, filtered to what is typed.
      if (group.id === "rules") {
        const glossary: SettingsSearchResult = {
          entry: {
            id: "pause-glossary-search",
            title: t("pause.glossarySearch", { query }),
            detail: t("pause.glossarySearchDetail"),
            place: t("pause.rulesReference"),
            target: { kind: "rules", tab: "glossary", query },
          },
          titleRanges: [],
          detailRanges: [],
        };
        items.push({
          slot: { kind: "link" },
          draw: (rect, index) => [this.#drawResultLink(rect, glossary, index, room, stops)],
        });
      }
    }

    const content = pauseResultsContentOf(
      items.map((item) => item.slot),
      room.width,
    );
    const ids: string[] = [];
    this.#inScroll("results", room, content.totalHeight, () => {
      items.forEach((item, index) => {
        const at = content.rects[index]!;
        // In the region's own space: `x` the screen's, `y` from the region's top.
        const rect: Rect = { x: room.x + at.x, y: at.y, width: at.width, height: at.height };
        ids.push(...item.draw(rect, index));
      });
    });
    return ids;
  }

  /** A Settings toggle found by the search, drawn as the Table group draws its rows: a press flips it here. */
  #drawResultToggle(
    rect: Rect,
    row: PauseSettingRow,
    control: Extract<PauseSettingRow["control"], { kind: "toggle" }>,
    _index: number,
    room: Rect,
    stops: Map<string, FocusStop>,
  ): string {
    this.#label(rect.x, rect.y + 2, row.title, typeRole.label, surface.paper.hex, ink.secondary, { size: 12 });
    this.#plain(rect.x, rect.y + 20, row.detail, typeRole.body, surface.paper.hex, control.unavailable ? 0.55 : 0.8, {
      size: 10,
      wrapWidth: rect.width - 100,
    });
    const toggleRect: Rect = { x: rect.x + rect.width - 86, y: rect.y + (rect.height - 32) / 2, width: 84, height: 32 };
    const enabled = control.unavailable === undefined;
    const activate = (): void => {
      if (enabled) this.#applySetting(row);
    };
    const id = `result:${row.id}`;
    this.#press(id, activate);
    this.#b.tap(id, rect);
    this.#press(`${id}:switch`, activate);
    this.#b.button({
      key: `${id}:switch`,
      rect: toggleRect,
      label: enabled ? (control.on ? t("settings.toggleOn") : t("settings.toggleOff")) : "—",
      look: control.on ? "secondary" : "quiet",
      selected: control.on,
      ...(control.unavailable ? { disabled: control.unavailable } : {}),
      ...(control.on && enabled ? { framed: true } : {}),
    });
    stops.set(id, this.#scrollStop({ key: "results", rect: room }, id, { ...rect, y: rect.y + room.y }, activate));
    return id;
  }

  /** A cell of a segmented control: ink (or guide yellow when chosen) with a paper (or yellow) frame and its words. */
  #segmentCell(cell: Rect, selected: boolean, text: string): void {
    this.#b.box(cell, { fill: selected ? signal.caution.hex : surface.ink.hex });
    this.#b.box(
      { x: cell.x + 1, y: cell.y + 1, width: cell.width - 2, height: cell.height - 2 },
      { stroke: selected ? signal.caution.hex : surface.paper.hex, strokeWidth: 2 },
    );
    this.#plain(
      cell.x + cell.width / 2,
      cell.y + cell.height / 2,
      text,
      typeRole.label,
      selected ? surface.inkOnHue.hex : surface.paper.hex,
      1,
      { origin: [0.5, 0.5], fitWidth: cell.width - 8, size: typeRole.label.size },
    );
  }

  /** A Settings choice found by the search: its title and description, then one cell per option, the chosen one in guide yellow. */
  #drawResultChoice(
    rect: Rect,
    row: PauseSettingRow,
    control: Extract<PauseSettingRow["control"], { kind: "choice" }>,
    _index: number,
    room: Rect,
    stops: Map<string, FocusStop>,
  ): readonly string[] {
    this.#label(rect.x, rect.y + 2, row.title, typeRole.label, surface.paper.hex, ink.secondary, { size: 12 });
    this.#plain(rect.x, rect.y + 20, row.detail, typeRole.body, surface.paper.hex, 0.8, {
      size: 10,
      wrapWidth: rect.width - 4,
    });
    const gap = 4;
    const EDGE_INSET = 2;
    const count = control.options.length;
    const cellWidth = (rect.width - EDGE_INSET - gap * (count - 1)) / count;
    const top = rect.y + rect.height - hit.target - 6;
    return control.options.map((option, i) => {
      const cellRect: Rect = { x: rect.x + i * (cellWidth + gap), y: top, width: cellWidth, height: hit.target };
      const selected = control.selected === option.value;
      const activate = (): void => this.#applySetting(row, option.value);
      const id = `result:${row.id}:${option.value}`;
      this.#segmentCell(cellRect, selected, option.label);
      this.#press(id, activate);
      this.#b.tap(id, cellRect);
      stops.set(
        id,
        this.#scrollStop({ key: "results", rect: room }, id, { ...cellRect, y: cellRect.y + room.y }, activate),
      );
      return id;
    });
  }

  /** A result's one line, cut around its match to what fits `room`, with the match marked (`drawSearchResultRow`'s own rule). */
  #resultLine(
    x: number,
    y: number,
    whole: string,
    ranges: readonly TextRange[],
    size: number,
    alpha: number,
    room: number,
  ): void {
    const width = this.#b.measure(whole, { ...typeRole.body, uppercase: false }, { size }).width;
    const maxChars = width <= room ? whole.length : Math.floor((whole.length * room) / width);
    const line = markedLineOf(whole, ranges, maxChars);
    this.#plain(x, y, line.text, typeRole.body, surface.paper.hex, alpha, { size, marks: line.ranges });
  }

  /** A result that opens its page: Settings' own result row (what matched, marked), with a chevron. */
  #drawResultLink(
    rect: Rect,
    result: SettingsSearchResult,
    _index: number,
    room: Rect,
    stops: Map<string, FocusStop>,
  ): string {
    // As `drawSearchResultRow` draws it, in a row 18px narrower than the slot, with room for its own scrollbar.
    const row = { ...rect, width: rect.width - 18 };
    const gutter = 14;
    const place = this.#plain(
      row.x + row.width - gutter,
      row.y + 8,
      result.entry.place,
      typeRole.body,
      surface.paper.hex,
      0.6,
      { origin: [1, 0], size: 10, fitWidth: row.width * 0.45 },
    );
    const titleRoom = row.width - gutter - place.width - 12;
    this.#resultLine(row.x, row.y + 6, result.entry.title, result.titleRanges, 14, 0.95, titleRoom);
    this.#resultLine(row.x, row.y + 28, result.entry.detail, result.detailRanges, 11, 0.75, row.width - gutter);
    this.#b.box(
      { x: row.x, y: row.y + SEARCH_RESULT_ROW_HEIGHT - 2, width: row.width - gutter, height: 1 },
      { fill: surface.paper.hex, fillAlpha: 0.25 },
    );
    this.#label(
      rect.x + rect.width - 8,
      rect.y + rect.height / 2,
      "›",
      typeRole.rowTitle,
      surface.paper.hex,
      ink.secondary,
      { origin: [0.5, 0.5] },
    );
    const activate = (): void => this.#openSearchResult(result.entry);
    const id = `result:${result.entry.id}`;
    this.#press(id, activate);
    this.#b.tap(id, rect);
    stops.set(id, this.#scrollStop({ key: "results", rect: room }, id, { ...rect, y: rect.y + room.y }, activate));
    return id;
  }

  /** A press on a Settings toggle (no `value`) or one of a choice's options, found by the search. */
  #applySetting(row: PauseSettingRow, value?: string): void {
    if (!row.apply) return;
    const before = { settings: appSession().settings, guide: guidePrefs() };
    const next = row.apply(before, value, drawnDensity());
    // Turning on a way for a game to stop counting (Undo past your turn, Manual adjust) asks first, as Settings does.
    const warning = cheatUnlockWarningOf(before.settings, next.settings);
    if (warning) {
      askToConfirm(this, warning.title, warning.sentence, warning.confirmLabel, () => {
        if (!this.#motion.leaving) this.#landSetting(row, before, next);
      });
      return;
    }
    this.#landSetting(row, before, next);
  }

  #landSetting(row: PauseSettingRow, before: PauseSettingsState, next: PauseSettingsState): void {
    if (next.settings !== before.settings) {
      if (row.id === "sharper-text") applyTextResolution(next.settings);
      if (MUSIC_ROW_IDS.has(row.id)) appSession().music?.syncSettings(next.settings);
      appSession().settings = next.settings;
      applyEarnedItems();
      // A sample at the new level, and the popup where it now shows, as Settings does.
      if (row.id === "effects-volume") appSession().music?.playEffect("basic-attack");
      if (row.id.startsWith("achievement-popup-"))
        (this.scene.get(SCENES.achievementToast) as AchievementToastScene | null)?.preview();
    }
    // The guide store's own change event indexes again and redraws this sheet.
    if (next.guide !== before.guide) setGuidePrefs(next.guide);
    else {
      this.#search?.reindex();
      this.#draw();
    }
  }

  /** Opens `key` over this sheet, which takes no input until it closes (its panel sits over this one's rows). */
  #launchOver(key: string, data: object): void {
    if (this.scene.isActive(key)) return;
    this.input.enabled = false;
    this.scene.launch(key, data);
    // Just above Pause, not on top of everything: on top, Settings drew over the sheets it opens itself (Controls,
    // Unlocks, Save data), which launch in their own place in the draw order (#858).
    this.scene.moveAbove(this.scene.key, key);
    this.scene.get(key).events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.enabled = true;
      if (!this.sys.isActive()) return;
      this.#reindexSearch();
      this.#draw();
    });
  }

  /** A press on a result with no control of its own: its page, on the spot it was found. */
  #openSearchResult(entry: SettingsSearchEntry): void {
    this.#searchInput?.blur();
    const target = entry.target;
    switch (target.kind) {
      case "setting":
        this.#launchOver(SCENES.settings, {
          focus: { item: target.item, tab: target.tab },
        } satisfies SettingsSceneData);
        return;
      case "rules":
        this.#openRules({
          initialTab: target.tab,
          initialScope: "all",
          ...(target.query !== undefined ? { initialQuery: target.query } : {}),
        });
        return;
      case "unlocks":
        this.#launchOver(SCENES.unlocks, {
          ...(target.row !== undefined ? { row: target.row } : {}),
          ...(target.guideSection !== undefined ? { guideSection: target.guideSection } : {}),
        } satisfies UnlocksSceneData);
        return;
      case "saveData":
        this.#launchOver(SCENES.saveData, { row: target.row } satisfies SaveDataSceneData);
        return;
      case "controls":
        this.#launchOver(SCENES.controls, { tab: target.tab } satisfies ControlsSceneData);
        return;
      case "stats":
        if (!this.scene.isActive(SCENES.playerStats))
          this.scene.launch(SCENES.playerStats, {
            from: SCENES.pause,
            overlay: true,
            tab: target.tab,
          } satisfies PlayerStatsData);
        return;
      case "pause":
        if (target.id === "jumpLog") {
          this.#toggleFullGameLog();
          return;
        }
        this.#quickReferenceRows(appSession().store.state.game)
          .find((row) => row.id === target.id)
          ?.open?.();
        return;
    }
  }

  #drawHeader(
    rect: Rect,
    closeRect: Rect,
    blindRect: Rect | null,
    game: SessionState["game"],
    perspectiveId: SessionState["perspectiveId"],
    config: SessionState["config"],
    stops: Map<string, FocusStop>,
  ): void {
    this.#label(rect.x + 16, rect.y + 10, t("pause.title"), typeRole.barTitle, surface.paper.hex, 1, { size: 26 });
    const statusText = game && perspectiveId ? this.#statusLine(game, perspectiveId, config) : t("pause.noGame");
    // Wraps rather than running under the ✕ or ending in "…": at phone width the full "‹scenario› · ‹difficulty› ·
    // Round ‹n› · ‹phase› · ‹seat›" line is wider than the header has room for beside the close button.
    this.#label(rect.x + 16, rect.y + 40, statusText, typeRole.label, surface.paper.hex, ink.secondary, {
      size: 10,
      wrapWidth: closeRect.x - rect.x - 16 - 12,
      lineSpacing: 1,
    });
    if (game && perspectiveId) this.#drawBlindSheet(blindRect, game, perspectiveId, config);
    const close = (): void => this.#resume();
    this.#press("close", close);
    this.#b.button({ key: "close", rect: closeRect, label: "✕", look: "secondary", type: typeRole.rowTitle });
    stops.set("close", { rect: closeRect, activate: close });
    this.#b.box(
      { x: rect.x, y: rect.y + rect.height - 2, width: rect.width, height: 2 },
      { fill: surface.paper.hex, fillAlpha: 0.4 },
    );
  }

  /**
   * A Civil War game played blind (docs/phase7-wave10-client.md 2.6): the stage pair and the modular sets as they stand,
   * hidden pieces worded and counted; a built or rolled game (not blind) lists its stages and sets. Empty for every
   * other game, and for a leader as printed.
   */
  #blindSheet(
    game: NonNullable<SessionState["game"]>,
    perspectiveId: NonNullable<SessionState["perspectiveId"]>,
    config: SessionState["config"],
  ): readonly string[] {
    if (!config) return [];
    let offer = null;
    try {
      offer = playableScenarioOffer(config.scenarioId);
    } catch {
      offer = null;
    }
    const setNames = new Map(gameEncounterSets().map((set) => [set.id as string, set.name]));
    const status = pauseStatusOf(
      game,
      perspectiveId,
      config,
      gameScenarios(),
      blindSheetNamesOf(offer, setNames),
      appSession().store.state.adjusted,
    );
    return status.blindSheet ?? status.buildSheet ?? [];
  }

  #drawBlindSheet(
    rect: Rect | null,
    game: NonNullable<SessionState["game"]>,
    perspectiveId: NonNullable<SessionState["perspectiveId"]>,
    config: SessionState["config"],
  ): void {
    const lines = this.#blindSheet(game, perspectiveId, config);
    if (!rect || lines.length === 0) return;
    this.#plain(rect.x, rect.y, lines.join("\n"), typeRole.label, surface.paper.hex, ink.secondary, {
      size: 10,
      lineSpacing: 3,
      wrapWidth: rect.width,
    });
  }

  #statusLine(
    game: NonNullable<SessionState["game"]>,
    perspectiveId: NonNullable<SessionState["perspectiveId"]>,
    config: SessionState["config"],
  ): string {
    const s = pauseStatusOf(game, perspectiveId, config, gameScenarios(), undefined, appSession().store.state.adjusted);
    return `${s.scenarioName} · ${s.difficultyLabel} · ${t("pause.round", { round: s.round })} · ${s.phaseLabel} · ${s.seatLabel}${seedSuffixOf(s)}${adjustedSuffixOf(s)}`;
  }

  /**
   * D13's own shorter read ("Round 3 · player phase · your turn") — the wide
   * left menu is a fixed ~300px column, not phone's near-full-width header,
   * so it drops the scenario/difficulty phone's line carries (still visible
   * on the Board's own chrome underneath) rather than shrinking the whole
   * line to near-illegibility to fit all five segments.
   */
  #wideStatusLine(
    game: NonNullable<SessionState["game"]>,
    perspectiveId: NonNullable<SessionState["perspectiveId"]>,
    config: SessionState["config"],
  ): string {
    const s = pauseStatusOf(game, perspectiveId, config, gameScenarios(), undefined, appSession().store.state.adjusted);
    // The seed before the seat: the seat name is the part that gives way when the column is too narrow for both.
    return `${t("pause.round", { round: s.round })} · ${s.phaseLabel.toLowerCase()}${seedSuffixOf(s)} · ${s.seatLabel}`;
  }

  /** The cell that opens the Reference rows, and closes them unless a typed search is holding them open. */
  #drawQuickReferenceToggle(rect: Rect, open: boolean, stops: Map<string, FocusStop>): void {
    this.#panel(rect, "onInk", "rest");
    this.#label(rect.x + 12, rect.y + rect.height / 2, t("pause.reference"), typeRole.rowTitle, surface.paper.hex, 1, {
      origin: [0, 0.5],
      fitWidth: rect.width - 40,
      size: typeRole.rowTitle.size,
    });
    this.#label(
      rect.x + rect.width - 16,
      rect.y + rect.height / 2,
      open ? "▾" : "▸",
      typeRole.rowTitle,
      surface.paper.hex,
      ink.secondary,
      { origin: [0.5, 0.5] },
    );
    const activate = (): void => {
      this.#quickExpanded = !open;
      this.#lowerFromTop = true;
      this.#draw();
    };
    stops.set("quick-toggle", { rect, activate });
    this.#press("quick-toggle", activate);
    this.#b.tap("quick-toggle", rect);
  }

  #drawQuickReferenceRow(rect: Rect, row: QuickReferenceRow, stops: Map<string, FocusStop>): void {
    const enabled = row.open !== undefined;
    this.#panel(rect, "onInk", enabled ? "rest" : "unavailable");
    const alpha = enabled ? 1 : ink.disabled;
    const key = `quick:${row.id}`;
    if (row.compact) {
      // A cell of a shared line: the title centred, nothing else (the row's detail is its accessible hint, not drawn).
      this.#label(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        row.title,
        typeRole.rowTitle,
        surface.paper.hex,
        alpha,
        {
          origin: [0.5, 0.5],
          fitWidth: rect.width - 12,
          size: typeRole.rowTitle.size,
        },
      );
      const act = (): void => row.open?.();
      stops.set(key, { rect, activate: act });
      if (enabled) {
        this.#press(key, act);
        this.#b.tap(key, rect);
      }
      return;
    }
    // One line, clear of the chevron: a half-width cell has no room for a second line above its detail.
    this.#plain(rect.x + 12, rect.y + 6, row.title, typeRole.rowTitle, surface.paper.hex, alpha, {
      fitWidth: rect.width - 40,
      size: typeRole.rowTitle.size,
    });
    this.#plain(
      rect.x + 12,
      rect.y + 24,
      row.unavailable ?? row.detail,
      typeRole.label,
      surface.paper.hex,
      alpha * 0.75,
      {
        size: 9,
        wrapWidth: rect.width - 36,
      },
    );
    if (enabled)
      this.#label(
        rect.x + rect.width - 16,
        rect.y + rect.height / 2,
        "›",
        typeRole.rowTitle,
        surface.paper.hex,
        ink.secondary,
        { origin: [0.5, 0.5] },
      );
    const activate = (): void => row.open?.();
    stops.set(key, { rect, activate });
    if (enabled) {
      this.#press(key, activate);
      this.#b.tap(key, rect);
    }
  }

  /** "Stop tutorial" / "Turn guide off" (§3.10, G5c part 3) — one full-width button per row, inside the same
   * scroll region "Table"/"Guide" already share (`content.guideRunRows`'s own doc comment). No detail line: the
   * label alone says what tapping it does, the same shape the footer's own Save & quit/Concede already use. */
  #drawGuideRunRow(
    rect: Rect,
    titleText: string,
    index: number,
    stops: Map<string, FocusStop>,
    id: string,
    onClick: () => void,
  ): void {
    this.#press(id, onClick);
    this.#b.button({ key: id, rect, label: titleText, look: "secondary", type: typeRole.rowTitle });
    stops.set(id, this.#scrollStop(this.#lowerScroll, id, this.#lowerScrollRect(rect), onClick));
  }

  /** The Table/Guide region the group draws in (set by `#drawLowerGroup`). */
  #lowerScroll: { readonly key: string; readonly rect: Rect } = {
    key: "lower",
    rect: { x: 0, y: 0, width: 0, height: 0 },
  };

  /** A rect in the Table/Guide region's own space, as the screen has it (for a stop read before the panel exists). */
  #lowerScrollRect(rect: Rect): Rect {
    return { ...rect, y: rect.y + this.#lowerScroll.rect.y };
  }

  #drawTableRow(rect: Rect, row: SettingsRowInfo, index: number, stops: Map<string, FocusStop>): void {
    this.#label(rect.x, rect.y + 2, row.title, typeRole.label, surface.paper.hex, ink.secondary, { size: 12 });
    this.#plain(
      rect.x,
      rect.y + 20,
      row.unavailable ?? row.detail,
      typeRole.body,
      surface.paper.hex,
      row.unavailable ? 0.55 : 0.8,
      { size: 10, wrapWidth: rect.width - 100 },
    );
    const toggleRect: Rect = { x: rect.x + rect.width - 84, y: rect.y + (rect.height - 32) / 2, width: 84, height: 32 };
    const activate = (): void => this.#toggleTableRow(row);
    const id = `table:${row.id}`;
    // A tap on an unavailable row does nothing (the keyboard stop keeps its own old behavior).
    const tapped = (): void => {
      if (row.unavailable === undefined) activate();
    };
    this.#press(id, tapped);
    this.#b.tap(id, rect);
    this.#press(`${id}:switch`, tapped);
    this.#b.button({
      key: `${id}:switch`,
      rect: toggleRect,
      label: row.unavailable ? "—" : row.on ? t("settings.toggleOn") : t("settings.toggleOff"),
      look: row.on ? "secondary" : "quiet",
      selected: row.on,
      ...(row.unavailable ? { disabled: row.unavailable } : {}),
      ...(row.on && row.unavailable === undefined ? { framed: true } : {}),
    });
    stops.set(id, this.#scrollStop(this.#lowerScroll, id, this.#lowerScrollRect(rect), activate));
  }

  #toggleTableRow(row: SettingsRowInfo): void {
    const { settings } = appSession();
    const next = nextSettingsAfterToggle(settings, row.id, drawnDensity());
    if (row.id === "sharper-text") applyTextResolution(next);
    if (row.id === "sound" || row.id === "music-shuffle") appSession().music?.syncSettings(next);
    appSession().settings = next;
    this.#draw();
  }

  // ------------------------------------------------------------------------------------------------------------
  // The "Table" + "Guide" groups (docs/guided-mode.md §4 G2b), phone only — Pause's wide layout has no inline
  // Guide group, only the standalone Settings screen does. A real phone can't fit Quick reference, five Table
  // rows *and* the Guide group's own level control plus six more rows unscrolled (browser verification,
  // 2026-09-26: "Confirm before ending turn" already ran under Resume with no Guide group at all), so both
  // groups share one bounded, scrollable region of the panel (`view/pause-layout.ts`'s own `lowerViewport`/
  // `lowerContent`), in the DOM so a swipe scrolls it natively.
  // ------------------------------------------------------------------------------------------------------------

  /**
   * "Table" heading + its rows, then "Guide" heading, the "Guide level" segment and one row per non-segmented
   * Guide entry — all inside one scroll region. Returns the Guide group's own stop ids (without the `guide:`
   * prefix `pauseFocusOrder` applies), in focus order; the Table rows register themselves under their existing
   * `table:${id}` keys directly, unchanged from before this group scrolled.
   */
  #drawLowerGroup(
    viewport: Rect,
    content: PausePhoneLowerContent,
    tableRows: readonly SettingsRowInfo[],
    guideRows: readonly GuideRowInfo[],
    stops: Map<string, FocusStop>,
  ): readonly string[] {
    const levelRow = guideRows.find((row) => row.kind === "segmented");
    const afterLevel = guideRows.filter(isGuideNonLevelRow);
    this.#lowerScroll = { key: "lower", rect: viewport };
    const stopIds: string[] = [];
    this.#inScroll("lower", viewport, content.totalHeight, () => {
      // §3.10, G5c part 3 — "Stop tutorial" / "Turn guide off", ahead of "Table" (`content.guideRunRows` is empty
      // outside a guided run, this file's own `#drawPhone` call site).
      if (content.guideRunRows[0])
        this.#drawGuideRunRow(content.guideRunRows[0], t("pause.stopTutorial"), 0, stops, "guide-stop-tutorial", () =>
          this.#stopTutorial(),
        );
      if (content.guideRunRows[1])
        this.#drawGuideRunRow(content.guideRunRows[1], t("pause.turnGuideOff"), 1, stops, "guide-turn-guide-off", () =>
          this.#turnGuideOff(),
        );

      this.#label(
        viewport.x,
        content.tableHeading.y,
        t("pause.table"),
        typeRole.label,
        surface.paper.hex,
        ink.secondary,
      );
      this.#drawCardSizeRow(content.cardSizeRow, stops);
      tableRows.forEach((row, index) => this.#drawTableRow(content.tableRows[index]!, row, index, stops));

      this.#label(
        viewport.x,
        content.guideHeading.y,
        t("pause.guide"),
        typeRole.label,
        surface.paper.hex,
        ink.secondary,
      );
      if (levelRow && levelRow.kind === "segmented") {
        this.#drawGuideLevelRow(content.guideLevelRow, levelRow, stops);
        stopIds.push(...levelRow.options.map((option) => `guide-level:${option.value}`));
      }
      afterLevel.forEach((row, index) => {
        this.#drawGuideRow(content.guideRows[index]!, row, stops);
        stopIds.push(row.id);
      });
    });
    return stopIds;
  }

  /**
   * Card size, as a quick setting on the phone's sheet (the owner: the cards were too small to read and the phone had
   * no way to change it mid-game). Its title, then one segment per size, the selected one in guide yellow.
   */
  #drawCardSizeRow(rect: Rect, stops: Map<string, FocusStop>): void {
    const info = cardSizeRowInfoOf(appSession().settings);
    this.#label(rect.x, rect.y, info.title.toUpperCase(), typeRole.rowTitle, surface.paper.hex, 1);
    const gap = 4;
    const EDGE_INSET = 2;
    const top = rect.y + 22;
    const height = rect.height - 22;
    const cellWidth = (rect.width - EDGE_INSET - gap * (info.options.length - 1)) / info.options.length;
    info.options.forEach((option, i) => {
      const cellRect: Rect = { x: rect.x + i * (cellWidth + gap), y: top, width: cellWidth, height };
      const selected = info.selected === option.value;
      const activate = (): void => this.#setCardSize(option.value);
      const id = `table:card-size:${option.value}`;
      this.#segmentCell(cellRect, selected, option.label);
      this.#press(id, activate);
      this.#b.tap(id, cellRect);
      stops.set(id, this.#scrollStop(this.#lowerScroll, id, this.#lowerScrollRect(cellRect), activate));
    });
  }

  /** A card size picked on the phone's sheet: the table behind it redraws at the new size, as Settings does. */
  #setCardSize(value: CardSize): void {
    appSession().settings = nextSettingsAfterCardSize(appSession().settings, value);
    this.#draw();
  }

  #drawGuideLevelRow(
    rect: Rect,
    row: Extract<GuideRowInfo, { kind: "segmented" }>,
    stops: Map<string, FocusStop>,
  ): void {
    const gap = 4;
    // `EDGE_INSET`: the rightmost cell's own border used to land exactly on this row's own right edge — which,
    // once this group draws inside a masked scroll region, is also the mask's own right edge, so the border's
    // last pixel or two got clipped away entirely (found in browser verification, 2026-09-26, at 390 and 1440
    // widths). A couple of spare pixels keeps every cell's own border inside the content width the mask allows.
    const EDGE_INSET = 2;
    const cellWidth = (rect.width - EDGE_INSET - gap * (row.options.length - 1)) / row.options.length;
    row.options.forEach((option, i) => {
      const cellRect: Rect = { x: rect.x + i * (cellWidth + gap), y: rect.y, width: cellWidth, height: rect.height };
      const selected = row.selected === option.value;
      const activate = (): void => this.#setGuideLevel(option.value);
      // Selected reads as guide yellow (`signal.caution`, ink text) rather than ink-on-ink, which — against this
      // overlay's own dark ground — used to read as *less* "on" than the bright-paper unselected cells beside it
      // (found in browser verification, 2026-09-26: the selected cell looked unselected at a glance). Unselected
      // is ink fill with a paper border and paper text, the readable-on-dark pairing the rest of this sheet uses.
      this.#b.box(cellRect, { fill: selected ? signal.caution.hex : surface.ink.hex });
      this.#b.box(
        { x: cellRect.x + 1, y: cellRect.y + 1, width: cellRect.width - 2, height: cellRect.height - 2 },
        { stroke: selected ? signal.caution.hex : surface.paper.hex, strokeWidth: 2 },
      );
      this.#plain(
        cellRect.x + 10,
        cellRect.y + 8,
        option.label,
        typeRole.rowTitle,
        selected ? surface.inkOnHue.hex : surface.paper.hex,
        1,
        { size: 12 },
      );
      this.#plain(
        cellRect.x + 10,
        cellRect.y + 26,
        option.detail,
        typeRole.body,
        selected ? surface.inkOnHue.hex : surface.paper.hex,
        selected ? 0.85 : 0.7,
        { size: 9, wrapWidth: cellWidth - 16 },
      );
      const id = `guide:guide-level:${option.value}`;
      this.#press(id, activate);
      this.#b.tap(id, cellRect);
      stops.set(id, this.#scrollStop(this.#lowerScroll, id, this.#lowerScrollRect(cellRect), activate));
    });
  }

  #drawGuideRow(rect: Rect, row: GuideNonLevelRow, stops: Map<string, FocusStop>): void {
    this.#label(rect.x, rect.y + 2, row.title, typeRole.label, surface.paper.hex, ink.secondary, { size: 12 });
    this.#plain(
      rect.x,
      rect.y + 20,
      guideRowDetailOf(row),
      typeRole.body,
      surface.paper.hex,
      row.kind === "action" && row.unavailable ? 0.55 : 0.8,
      { size: 10, wrapWidth: rect.width - 100 },
    );

    const controlRect: Rect = {
      x: rect.x + rect.width - 84,
      y: rect.y + (rect.height - 32) / 2,
      width: 84,
      height: 32,
    };
    const activate = (): void => this.#activateGuideRow(row);
    const unavailable = row.kind === "action" ? row.unavailable : undefined;
    const id = `guide:${row.id}`;
    this.#press(id, activate);
    this.#b.tap(id, rect);
    this.#press(`${id}:switch`, activate);
    this.#b.button({
      key: `${id}:switch`,
      rect: controlRect,
      label: unavailable
        ? "—"
        : row.kind === "toggle"
          ? row.on
            ? t("settings.toggleOn")
            : t("settings.toggleOff")
          : t("settings.open"),
      look: row.kind === "toggle" && row.on ? "secondary" : "quiet",
      selected: row.kind === "toggle" && row.on,
      ...(unavailable ? { disabled: unavailable } : {}),
      ...(row.kind === "toggle" && row.on ? { framed: true } : {}),
    });
    stops.set(id, this.#scrollStop(this.#lowerScroll, id, this.#lowerScrollRect(rect), activate));
  }

  #setGuideLevel(level: GuideLevel): void {
    setGuidePrefs(nextGuidePrefsAfterRow(guidePrefs(), "guide-level", level));
    this.#draw();
  }

  #activateGuideRow(row: GuideNonLevelRow): void {
    if (row.kind === "action") {
      // "Aspect lessons" (G10c) has no target yet, still dashed unavailable; "Play the tutorial" (G6b) does.
      if (row.id === "play-tutorial") this.#openHowToWin();
      return;
    }
    setGuidePrefs(nextGuidePrefsAfterRow(guidePrefs(), row.id));
    this.#draw();
  }

  /**
   * "Play the tutorial" from Pause's own inline Guide group (guided mode G6b, `docs/guided-mode.md` §4): leaves
   * the running game the same way `#saveAndQuit` does — every overlay stopped, Board stopped — then opens How to
   * win, so starting the tutorial from mid-game never leaves the abandoned game's scenes running underneath it.
   */
  #openHowToWin(): void {
    this.#motion.exit(this, () => {
      for (const overlay of [
        SCENES.rules,
        SCENES.settings,
        SCENES.playerStats,
        SCENES.controls,
        SCENES.choice,
        SCENES.inspect,
        SCENES.villainPhase,
      ]) {
        if (this.scene.isActive(overlay) || this.scene.isSleeping(overlay)) this.scene.stop(overlay);
      }
      if (this.scene.isActive(SCENES.board)) this.scene.stop(SCENES.board);
      this.scene.start(SCENES.howToWin, {});
    });
  }

  #drawPhoneConcedeConfirm(layout: PausePhoneLayout, stops: Map<string, FocusStop>): void {
    const yesRect = layout.resume;
    const cancelRect = layout.saveQuit;
    this.#plain(layout.panel.x + 16, yesRect.y - 22, this.#concedeSentence(), typeRole.body, accent.heroRed.hex, 1, {
      size: 11,
      wrapWidth: layout.panel.width - 32,
    });
    const yes = (): void => void this.#onConcedeConfirmed();
    const cancel = (): void => this.#setConfirmingConcede(false);
    stops.set("concede-confirm-yes", { rect: yesRect, activate: yes });
    this.#press("concede-confirm-yes", yes);
    this.#b.button({
      key: "concede-confirm-yes",
      rect: yesRect,
      label: this.#seatGame() ? t("concede.seatConfirm") : t("pause.concedeYes"),
      look: "primary",
      type: typeRole.barTitle,
    });
    stops.set("concede-confirm-cancel", { rect: cancelRect, activate: cancel });
    this.#press("concede-confirm-cancel", cancel);
    this.#b.button({
      key: "concede-confirm-cancel",
      rect: cancelRect,
      label: t("pause.cancel"),
      look: "quiet",
      type: typeRole.rowTitle,
    });
  }

  #button(
    stops: Map<string, FocusStop>,
    id: string,
    kind: "primary" | "secondary" | "quiet",
    text: string,
    rect: Rect,
    onClick: () => void,
  ): void {
    stops.set(id, { rect, activate: onClick });
    this.#press(id, onClick);
    this.#b.button({
      key: id,
      rect,
      label: text,
      look: kind,
      type: kind === "primary" ? typeRole.barTitle : typeRole.rowTitle,
    });
  }
}
