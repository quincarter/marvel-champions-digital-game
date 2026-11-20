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
import { addPressShield } from "../ui/press-shield.js";
import type { CardSize } from "../settings.js";
import { playableScenarioOffer } from "@mc/cards";
import { gameEncounterSets, gameScenarios } from "../content/game-deps.js";
import { gameDeps } from "../content/game-deps.js";
import { accent, hit, ink, signal, status, surface, typeRole, type TypeSpec } from "../tokens.js";
import { caseOf, textStyle } from "../ui/theme.js";
import { applyTextResolution, drawnDensity } from "../platform/screen-settings.js";
import {
  McButton,
  McTextInput,
  addRowTapZone,
  fitText,
  label,
  paintDotGrid,
  paintOnFrame,
  paintPanel,
} from "../ui/widgets.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { onTap } from "../ui/tap.js";
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
import { VariableListScroll } from "../view/variable-list-scroll.js";
import type { ManualAdjustData } from "./manual-adjust.js";
import { pauseFocusOrder } from "../view/screen-focus.js";
import { contentSlotHeights, type Rect } from "../view/layout.js";
import { appSession } from "../session.js";
import type { SessionState } from "../store/session-store.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import type { RulesSceneData } from "./rules.js";
import type { RulesTab } from "../view/rules-layout.js";
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
import { drawSearchResultRow } from "./settings-search-row.js";
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
  #buttons: McButton[] = [];
  #searchInput: McTextInput | null = null;
  #route: FocusRoute | null = null;
  #confirmingConcede = false;
  /** Wide: "Full game log" swaps the right panel's header/grid/jump-box group for the fuller retained log (`view/pause-layout.ts`'s own `rightContent`). Phone: the "Game log" row swaps the Table/Guide group for the same log box. */
  #logExpanded = false;
  /** Phone: the rows under the Reference toggle are open. Closed, the Table and Guide group has the panel. */
  #quickExpanded = false;
  #motion = new OverlayMotion();
  /** The log moments drawn this pass that a tap rewinds to (`BoardScene.undoMoments`), by line id, in draw order. */
  #momentIds: string[] = [];
  /** Phone only — the Guide group's own scroll region (docs/guided-mode.md §4 G2b); `null` on a wide layout, which has no inline Guide group. */
  #lowerRegion: McScrollRegion | null = null;
  #lowerScroll = new VariableListScroll();
  /**
   * The search: Settings' own search worker, indexed when the sheet opens (so the first letter typed is answered at
   * once), and again whenever what the results say may have changed (a resize, a page closing over the sheet).
   */
  #searchClient: SettingsSearchClient | null = null;
  /** What is typed and the worker's answer for it (`view/pause-search.ts`). */
  #search: PauseSearchSession | null = null;
  #resultsRegion: McScrollRegion | null = null;
  #resultsScroll = new VariableListScroll();

  constructor() {
    super(SCENES.pause);
  }

  create(): void {
    this.#motion = new OverlayMotion();
    this.#confirmingConcede = false;
    this.#logExpanded = false;
    this.#quickExpanded = false;
    this.#searchClient = new SettingsSearchClient();
    this.#search = new PauseSearchSession(
      this.#searchClient,
      () => this.#searchIndexInput(),
      (newQuery) => {
        // A new query's list reads from its top; the same query answered again (a setting changed in place) stays
        // where the player had scrolled to.
        if (newQuery) this.#resultsScroll = new VariableListScroll();
        if (this.sys.isActive()) this.#draw();
      },
    );
    this.#resultsScroll = new VariableListScroll();
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
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      this.#lowerRegion?.destroy();
      this.#lowerRegion = null;
      this.#resultsRegion?.destroy();
      this.#resultsRegion = null;
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

  /** Manual adjust, over this sheet (#791): Done there closes it and Pause takes input again. */
  #openManualAdjust(): void {
    if (!appSession().settings.allowManualAdjust || this.scene.isActive(SCENES.manualAdjust)) return;
    this.scene.launch(SCENES.manualAdjust, { from: SCENES.pause } satisfies ManualAdjustData);
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
    const conceded = await this.#dispatchConcede();
    this.#setConfirmingConcede(false);
    // The engine's refusal (already over, no seat) is in `store.state.error`,
    // which the Board shows; the overlay stays open so the player sees it.
    if (conceded) this.#resume();
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
        title: "Villain phase order",
        detail: "Six steps, in sequence.",
        open: () => this.#openRules({ initialTab: "villainPhase" satisfies RulesTab }),
      },
      {
        id: "glossary",
        title: "Keyword glossary",
        detail: game ? `${glossaryCount} term${glossaryCount === 1 ? "" : "s"} on the table` : "No game in progress.",
        open: () => this.#openRules({ initialTab: "glossary" satisfies RulesTab }),
      },
      {
        id: "cardList",
        title: "Scenario card list",
        detail: game ? `${cardListSetCount} encounter set${cardListSetCount === 1 ? "" : "s"}` : "No game in progress.",
        open: () => this.#openRules({ initialTab: "cardList" satisfies RulesTab }),
      },
      {
        id: "jumpLog",
        title: "Game log",
        detail: this.#logExpanded ? "Showing below, newest first. Tap again for Table." : "What has happened so far.",
        open: () => this.#toggleFullGameLog(),
      },
      // The Table rows below are only a few of them: the rest (music, card size, the villain phase, accessibility) are
      // on the standalone Settings screen, which wide mode's menu links to and the phone had no way to reach.
      {
        id: "settings",
        title: "Show all settings",
        detail: "Sound, card size, villain phase and more.",
        open: () => this.#launchOver(SCENES.settings, {}),
      },
      {
        id: "stats",
        title: "Your stats",
        detail: "Your record, heroes, villains and the cards you play.",
        open: () => this.#openStats(),
      },
      // Only once the player has turned it on in Settings > More > Cheats (the owner, 2026-11-19).
      ...(appSession().settings.allowManualAdjust
        ? [
            {
              id: "manualAdjust",
              title: "Manual adjust",
              detail: "Fix the table by hand after a bug or a misclick. The game stops counting.",
              open: () => this.#openManualAdjust(),
            },
          ]
        : []),
      {
        id: "music",
        title: "Music",
        detail: "What is playing, and the songs you have earned.",
        compact: true,
        open: () => this.#openMusic(),
      },
      {
        id: "report",
        title: "Report",
        detail: "Tell us about a bug or a wrong ruling.",
        compact: true,
        open: () => this.#openReport(),
      },
      // The phone apps show Controls only once a controller is connected (the owner, 2026-10-24).
      ...(detectPlatform() !== "capacitor" || padAvailable()
        ? [
            {
              id: "controls",
              title: "Controls",
              detail: "Controller buttons, keyboard shortcuts and hints.",
              compact: true as const,
              open: () => this.scene.launch(SCENES.controls),
            },
          ]
        : []),
    );
    return rows;
  }

  #draw(): void {
    // Answered its own exit already (Resume, Save & quit) — a store update or
    // resize mid-fade must not redraw over the outgoing sheet.
    if (this.#motion.leaving) return;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#lowerRegion?.destroy();
    this.#lowerRegion = null;
    this.#resultsRegion?.destroy();
    this.#resultsRegion = null;
    this.#momentIds = [];

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
      },
    );

    // The field outlives a redraw: rebuilding a DOM <input> mid-keystroke would drop the caret.
    const kept = this.#searchInput?.gameObjects ?? [];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);

    // Dim scrim over the board — the sheet itself paints its own two panels below.
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    // The scrim is Graphics, which takes no pointer: without this a press outside the sheet reached the board.
    addPressShield(this, { x: 0, y: 0, width, height });
    const panelsFrom = this.children.list.length;

    const stops = new Map<string, FocusStop>();

    if (layout.kind === "wide") {
      const resultIds = this.#drawWide(layout, keywordEntries, game, perspectiveId, config, stops, searching);
      this.#route?.set(
        pauseFocusOrder({
          ...(searching ? { searchResultIds: resultIds } : {}),
          kind: "wide",
          keywordIds: keywordEntries.slice(0, layout.keywordGrid.shown).map((entry) => entry.id),
          momentIds: this.#momentIds,
          confirmingConcede: this.#confirmingConcede,
          guidedRunActive,
        }),
        stops,
      );
    } else {
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
      this.#route?.set(
        pauseFocusOrder({
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
        }),
        stops,
      );
    }

    // A kept field's ring was first on the list, under the panels drawn since (as in `scenes/settings.ts`).
    for (const node of kept) this.children.bringToTop(node);
    this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.slice(panelsFrom) });
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
    // A hard offset shadow behind the sheet — the design's own one shadow besides the selection ring.
    const shadow = this.add.graphics();
    shadow
      .fillStyle(surface.ink.hex, 0.5)
      .fillRect(layout.sheet.x + 8, layout.sheet.y + 8, layout.sheet.width, layout.sheet.height);

    const leftG = this.add.graphics();
    leftG.fillStyle(surface.ink.hex, 1).fillRect(layout.left.x, layout.left.y, layout.left.width, layout.left.height);
    leftG
      .lineStyle(4, surface.paper.hex, 1)
      .strokeRect(layout.left.x, layout.left.y, layout.left.width, layout.left.height);
    paintDotGrid(this, layout.left, "ink", { spacing: 8, radius: 1, alpha: 0.08 });

    // Searching, the right panel turns ink like the left, the ground the results (and the phone's) are drawn for.
    const rightG = this.add.graphics();
    rightG
      .fillStyle(searching ? surface.ink.hex : surface.paper.hex, 1)
      .fillRect(layout.right.x, layout.right.y, layout.right.width, layout.right.height);
    rightG
      .lineStyle(4, searching ? surface.paper.hex : surface.ink.hex, 1)
      .strokeRect(layout.right.x, layout.right.y, layout.right.width, layout.right.height);
    paintDotGrid(this, layout.right, searching ? "ink" : "paper", { spacing: 6, radius: 1, alpha: 0.1 });

    this.add.text(layout.title.x, layout.title.y, caseOf(typeRole.barTitle, "Paused"), {
      ...textStyle(typeRole.barTitle, surface.paper.hex),
      fontSize: "30px",
    });
    const statusText =
      game && perspectiveId ? this.#wideStatusLine(game, perspectiveId, config) : "No game in progress.";
    const statusLabel = label(
      this,
      layout.status.x,
      layout.status.y,
      statusText,
      typeRole.label,
      surface.paper.hex,
      ink.secondary,
    ).setFontSize(11);
    fitText(statusLabel, layout.status.width, 11);
    if (game && perspectiveId) this.#drawBlindSheet(layout.blindSheet, game, perspectiveId, config);

    this.#menuButton(stops, "resume", "primary", "Resume", layout.menu.resume, () => this.#resume());
    this.#menuButton(
      stops,
      "full-game-log",
      "onInk",
      "Full game log",
      layout.menu.fullGameLog,
      () => this.#toggleFullGameLog(),
      this.#logExpanded,
    );
    this.#menuButton(stops, "rules-reference", "onInk", "Rules reference", layout.menu.rulesReference, () =>
      this.#openRules({ initialTab: "glossary" satisfies RulesTab }),
    );
    this.#menuButton(stops, "settings", "onInk", "Settings", layout.menu.settings, () =>
      this.#launchOver(SCENES.settings, {}),
    );
    this.#menuButton(stops, "stats", "onInk", "Your stats", layout.menu.stats, () => this.#openStats());
    this.#menuButton(stops, "save-quit", "onInk", "Save & quit", layout.menu.saveQuit, () => this.#saveAndQuit());
    this.#menuButton(stops, "music", "onInk", "Music", layout.menu.music, () => this.#openMusic());
    // Half a narrow sheet (tablet portrait) cannot hold the whole phrase.
    const reportLabel = layout.menu.report.width < 130 ? "Report" : "Report a problem";
    this.#menuButton(stops, "report", "onInk", reportLabel, layout.menu.report, () => this.#openReport());

    // §3.10 "Pause has 'Stop tutorial' and 'Turn guide off' whenever a guided run is active" (G5c part 3) —
    // `layout.guideStopTutorial`/`guideTurnGuideOff` are `null` unless `guidedRunActive` was true when this layout
    // was built, so this stays a no-op for the far more common non-guided game.
    if (layout.guideStopTutorial && layout.guideTurnGuideOff) {
      this.#menuButton(stops, "guide-stop-tutorial", "onInk", "Stop tutorial", layout.guideStopTutorial, () =>
        this.#stopTutorial(),
      );
      this.#menuButton(stops, "guide-turn-guide-off", "onInk", "Turn guide off", layout.guideTurnGuideOff, () =>
        this.#turnGuideOff(),
      );
    }

    // The wide status line has no room for it, so the left panel says it in the gap above Manual adjust.
    if (!this.#confirmingConcede && appSession().store.state.adjusted) {
      this.add
        .text(
          layout.manualAdjust.x,
          layout.manualAdjust.y - 36,
          "Adjusted: not counted toward stats",
          textStyle(typeRole.label, surface.paper.hex, ink.secondary),
        )
        .setFontSize(11)
        .setWordWrapWidth(layout.manualAdjust.width)
        .setLineSpacing(2);
    }
    if (this.#confirmingConcede) this.#drawWideConcedeConfirm(layout, stops);
    else {
      // Not the primary, and in the slot the concede confirm takes over, so the two never show at once.
      // Off unless the player turned it on in Settings > More > Cheats (the owner, 2026-11-19).
      if (appSession().settings.allowManualAdjust) {
        this.#menuButton(stops, "manual-adjust", "onInk", "Manual adjust", layout.manualAdjust, () =>
          this.#openManualAdjust(),
        );
      }
      // The same full-strength outline as the rest of the menu. D13 dims it, which read as *disabled* (owner,
      // 2026-09-18); its place alone at the panel's foot, and the confirm step behind it, already set it apart.
      this.#menuButton(stops, "concede", "onInk", "Concede", layout.concede, () => this.#setConfirmingConcede(true));
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
    this.#buttons.push(
      new McButton(this, { kind, label: text, type: MENU_BUTTON_TYPE, rect, onClick, selected, enabled: true }),
    );
  }

  #drawWideConcedeConfirm(layout: PauseWideLayout, stops: Map<string, FocusStop>): void {
    this.add
      .text(
        layout.title.x,
        layout.concedeConfirmCancel.y - 34,
        "Concede? This ends the game for the whole table.",
        textStyle(typeRole.body, accent.heroRed.hex),
      )
      .setFontSize(10)
      .setWordWrapWidth(layout.title.width);
    stops.set("concede-confirm-yes", {
      rect: layout.concedeConfirmYes,
      activate: () => void this.#onConcedeConfirmed(),
    });
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: "Yes, concede",
        type: MENU_BUTTON_TYPE,
        rect: layout.concedeConfirmYes,
        onClick: () => void this.#onConcedeConfirmed(),
      }),
    );
    stops.set("concede-confirm-cancel", {
      rect: layout.concedeConfirmCancel,
      activate: () => this.#setConfirmingConcede(false),
    });
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: "Cancel",
        type: MENU_BUTTON_TYPE,
        rect: layout.concedeConfirmCancel,
        onClick: () => this.#setConfirmingConcede(false),
      }),
    );
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

    const headerTitle = this.add.text(
      layout.rulesHeader.x,
      layout.rulesHeader.y,
      caseOf(typeRole.barTitle, "Rules reference"),
      { ...textStyle(typeRole.barTitle, surface.ink.hex), fontSize: "20px" },
    );
    const filterText = game ? "Filtered to what's on your table" : "No game in progress";
    const filterLabel = label(
      this,
      layout.rulesHeader.x + layout.rulesHeader.width,
      layout.rulesHeader.y + 8,
      filterText,
      typeRole.label,
      surface.ink.hex,
      ink.secondary,
    )
      .setOrigin(1, 0)
      .setFontSize(9);
    fitText(filterLabel, 240, 9);
    const ruleY = layout.rulesHeader.y + headerTitle.height / 2 + 4;
    const ruleStartX = layout.rulesHeader.x + headerTitle.width + 12;
    const ruleEndX = filterLabel.x - filterLabel.width - 12;
    if (ruleEndX > ruleStartX) {
      const rule = this.add.graphics();
      rule.fillStyle(surface.ink.hex, 0.3).fillRect(ruleStartX, ruleY, ruleEndX - ruleStartX, 2);
    }

    if (layout.keywordGrid.shown === 0) {
      const emptyText = game
        ? "Nothing on the table carries a keyword or status right now."
        : "No game in progress — start or resume one to see what's on your table.";
      this.add
        .text(
          layout.keywordEmpty.x,
          layout.keywordEmpty.y,
          emptyText,
          textStyle(typeRole.body, surface.ink.hex, ink.meta),
        )
        .setFontSize(10)
        .setWordWrapWidth(layout.keywordEmpty.width);
    } else {
      entries
        .slice(0, layout.keywordGrid.shown)
        .forEach((entry, index) => this.#drawKeywordCard(layout.keywordGrid.cells[index]!, entry, stops));
    }

    this.#drawLogSection(layout.jumpHeader, layout.logBox, "Jump to a moment", stops);
  }

  /** One bordered keyword/status card — a status is a filled card in its own status color with paper text (colorblind-safe: the term is always the plain word, never color alone), a keyword a plain outlined card. Tapping either opens the full Rules reference overlay's Glossary tab, filtered to this term. */
  #drawKeywordCard(rect: Rect, entry: RulesEntry, stops: Map<string, FocusStop>): void {
    const isStatus = entry.id === "stunned" || entry.id === "confused" || entry.id === "tough";
    const g = this.add.graphics();
    if (isStatus) {
      g.fillStyle(status[entry.id as "stunned" | "confused" | "tough"].hex, 1).fillRect(
        rect.x,
        rect.y,
        rect.width,
        rect.height,
      );
      g.lineStyle(3, surface.inkOnHue.hex, 1).strokeRect(rect.x + 1.5, rect.y + 1.5, rect.width - 3, rect.height - 3);
    } else {
      paintPanel(g, rect, "card", "rest");
    }
    const textColor = isStatus ? surface.paper.hex : surface.ink.hex;
    const pad = 10;
    const term = this.add.text(rect.x + pad, rect.y + 8, caseOf(typeRole.barTitle, entry.displayName), {
      ...textStyle(typeRole.barTitle, textColor),
      fontSize: "16px",
    });
    fitText(term, rect.width - pad * 2, 16);
    this.add
      .text(
        rect.x + pad,
        rect.y + 8 + term.height + 4,
        entry.definition,
        textStyle(typeRole.body, textColor, isStatus ? 1 : ink.body),
      )
      .setFontSize(9)
      .setWordWrapWidth(rect.width - pad * 2);
    const tailCard = entry.cardRefs[0];
    if (tailCard) {
      const tail = this.add
        .text(
          rect.x + pad,
          rect.y + rect.height - 16,
          `On ${tailCard.name}.`,
          textStyle(typeRole.label, textColor, isStatus ? 0.85 : ink.meta),
        )
        .setFontSize(9);
      fitText(tail, rect.width - pad * 2, 9);
    }
    const activate = (): void =>
      this.#openRules({ initialTab: "glossary" satisfies RulesTab, initialQuery: entry.displayName });
    const zone = this.add
      .zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    // A tap, not any release: a finger swiping the sheet that lifts over a card is a scroll (`ui/tap.ts`).
    onTap(zone, activate, `keyword:${entry.id}`);
    stops.set(`keyword:${entry.id}`, { rect, activate });
  }

  /** The parchment box of recent log lines — shared by the normal "Jump to a moment" footprint and "Full game log"'s expanded one. Lines Undo could get back to are tap targets (`#drawUndoMoment`). */
  #drawLogBox(boxRect: Rect, stops: Map<string, FocusStop>): void {
    const g = this.add.graphics();
    g.fillStyle(surface.parchment.hex, 1).fillRect(boxRect.x, boxRect.y, boxRect.width, boxRect.height);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(boxRect.x, boxRect.y, boxRect.width, boxRect.height);

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
      this.add
        .text(
          boxRect.x + padX,
          boxRect.y + padY,
          "Nothing has happened yet.",
          textStyle(typeRole.body, surface.ink.hex, ink.meta),
        )
        .setFontSize(10);
    } else {
      let y = boxRect.y + padY;
      for (const moment of moments) {
        const target = undoable.get(moment.line.id);
        let textY = y;
        if (target !== undefined) {
          this.#drawUndoMoment(moment.line.id, target, boxRect, y, moment.height, stops);
          textY = y + (moment.height - moment.textHeight) / 2;
        }
        this.add
          .text(boxRect.x + padX, textY, moment.line.ref, textStyle(typeRole.mono, surface.ink.hex, ink.meta))
          .setFontSize(9);
        this.add
          .text(
            boxRect.x + padX + 46,
            textY,
            logLineWords(moment.line),
            textStyle(typeRole.body, surface.ink.hex, ink.body),
          )
          .setFontSize(10)
          .setWordWrapWidth(textWidth);
        y += moment.height;
      }
    }
    label(
      this,
      boxRect.x + padX,
      boxRect.y + boxRect.height - padY - 6,
      undoable.size > 0 ? "TAP A ↶ MOMENT TO UNDO BACK TO IT" : "ONLY YOUR OWN MOVES THIS TURN CAN BE UNDONE",
      typeRole.label,
      surface.ink.hex,
      ink.meta,
    )
      .setFontSize(8)
      .setOrigin(0, 0.5);
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
    const g = this.add.graphics();
    g.lineStyle(1, surface.ink.hex, 0.5).strokeRect(rect.x, rect.y, rect.width, rect.height);
    label(this, rect.x + rect.width - 10, rect.y + rect.height / 2, "↶", typeRole.rowTitle, surface.ink.hex, 1)
      .setOrigin(0.5)
      .setFontSize(14);
    const activate = (): void => void this.#undoTo(target);
    const zone = this.add
      .zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    onTap(zone, activate, `moment:${lineId}`);
    stops.set(`moment:${lineId}`, { rect, activate });
    this.#momentIds.push(lineId);
  }

  async #undoTo(target: number): Promise<void> {
    if (await this.#boardScene()?.undoTo(target)) this.#resume();
  }

  #drawLogSection(headerRect: Rect, boxRect: Rect, title: string, stops: Map<string, FocusStop>): void {
    this.add.text(headerRect.x, headerRect.y, caseOf(typeRole.barTitle, title), {
      ...textStyle(typeRole.barTitle, surface.ink.hex),
      fontSize: "18px",
    });
    this.#drawLogBox(boxRect, stops);
  }

  /** "Full game log": there is no separate full-log screen to open (`view/pause-layout.ts`'s own doc comment), so this swaps the header/grid/jump-header/log-box group for one taller box over the same footprint instead. */
  #drawExpandedLog(layout: PauseWideLayout, stops: Map<string, FocusStop>): void {
    const rect = layout.rightContent;
    const titleText = this.add.text(rect.x, rect.y, caseOf(typeRole.barTitle, "Full game log"), {
      ...textStyle(typeRole.barTitle, surface.ink.hex),
      fontSize: "20px",
    });
    const note = this.add
      .text(
        rect.x,
        rect.y + titleText.height + 4,
        "Every retained beat, newest first. Tap “Full game log” again to go back to the keyword grid.",
        textStyle(typeRole.label, surface.ink.hex, ink.secondary),
      )
      .setFontSize(9)
      .setWordWrapWidth(rect.width);
    const boxTop = note.y + note.height + 8;
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
    const panel = this.add.graphics();
    panel
      .fillStyle(surface.ink.hex, 1)
      .fillRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    panel
      .lineStyle(4, surface.paper.hex, 1)
      .strokeRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    paintDotGrid(this, layout.panel, "ink", { spacing: 8, radius: 1, alpha: 0.08 });

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
      this.#button(stops, "resume", "primary", "Resume", layout.resume, () => this.#resume());
      this.#button(stops, "save-quit", "secondary", "Save & quit", layout.saveQuit, () => this.#saveAndQuit());
      this.#button(stops, "concede", "quiet", "Concede", layout.concede, () => this.#setConfirmingConcede(true));
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
        placeholder: "Search settings and rules…",
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
      place: "Pause",
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

  /** A stop inside the results' scroll region, as `#lowerStop` is for the Table group's. */
  #resultsStop(rect: Rect, index: number, activate: () => void): FocusStop {
    return {
      rect: () => ({ ...rect, y: rect.y - this.#resultsScroll.offsetPx }),
      activate,
      ensureVisible: () => this.#resultsRegion?.scrollIntoView(index),
    };
  }

  #resultsClip = (): Rect | null => this.#resultsRegion?.rect ?? null;
  #resultsSuppressClick = (): boolean => this.#resultsRegion?.isDragSuppressingClick ?? false;

  /**
   * The grouped results in `room`'s own scroll region: each group's heading, then its rows. Returns the focus stop
   * ids in draw order. Until the worker first answers for this query, a line says it is searching.
   */
  #drawSearchResults(room: Rect, stops: Map<string, FocusStop>): readonly string[] {
    const results = this.#search?.results ?? null;
    if (results === null) {
      this.add
        .text(room.x, room.y + 14, "Searching…", textStyle(typeRole.body, surface.paper.hex, 0.7))
        .setFontSize(12);
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
          this.add
            .text(
              rect.x,
              rect.y + 14,
              "Nothing in Settings or Pause matches that.",
              textStyle(typeRole.body, surface.paper.hex, 0.8),
            )
            .setFontSize(12)
            .setWordWrapWidth(rect.width);
          return [];
        },
      });
    }
    for (const group of groupPauseResults(results)) {
      items.push({
        slot: { kind: "heading" },
        draw: (rect) => {
          label(this, rect.x, rect.y + 4, group.title, typeRole.label, surface.paper.hex, ink.secondary);
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
            draw: (rect, index) => [this.#drawResultToggle(rect, row, control, index, stops)],
          });
        } else if (row && row.control.kind === "choice") {
          const control = row.control;
          items.push({
            slot: { kind: "choice", detail: row.detail },
            draw: (rect, index) => this.#drawResultChoice(rect, row, control, index, stops),
          });
        } else {
          items.push({
            slot: { kind: "link" },
            draw: (rect, index) => [this.#drawResultLink(rect, result, index, stops)],
          });
        }
      }
      // The Rules group ends with the way into the full glossary, filtered to what is typed.
      if (group.id === "rules") {
        const glossary: SettingsSearchResult = {
          entry: {
            id: "pause-glossary-search",
            title: `Search "${query}" in the glossary`,
            detail: "Opens Rules reference, filtered to this.",
            place: "Rules reference",
            target: { kind: "rules", tab: "glossary", query },
          },
          titleRanges: [],
          detailRanges: [],
        };
        items.push({
          slot: { kind: "link" },
          draw: (rect, index) => [this.#drawResultLink(rect, glossary, index, stops)],
        });
      }
    }

    const content = pauseResultsContentOf(
      items.map((item) => item.slot),
      room.width,
    );
    // `clipInteractive`: a row scrolled up under the field must not take a press meant for it (as `#drawLowerGroup`).
    this.#resultsRegion = new McScrollRegion(this, {
      rect: room,
      heights: contentSlotHeights(content.rects),
      scroll: this.#resultsScroll,
      clipInteractive: true,
    });
    const container = this.#resultsRegion.content;
    const ids: string[] = [];
    items.forEach((item, index) => {
      const at = content.rects[index]!;
      const rect: Rect = { x: room.x + at.x, y: room.y + at.y, width: at.width, height: at.height };
      this.#captureInto(container, () => ids.push(...item.draw(rect, index)));
    });
    this.#resultsRegion.syncInteractivity();
    return ids;
  }

  /** A Settings toggle found by the search, drawn as the Table group draws its rows: a press flips it here. */
  #drawResultToggle(
    rect: Rect,
    row: PauseSettingRow,
    control: Extract<PauseSettingRow["control"], { kind: "toggle" }>,
    index: number,
    stops: Map<string, FocusStop>,
  ): string {
    label(this, rect.x, rect.y + 2, row.title, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(12);
    this.add
      .text(
        rect.x,
        rect.y + 20,
        row.detail,
        textStyle(typeRole.body, surface.paper.hex, control.unavailable ? 0.55 : 0.8),
      )
      .setFontSize(10)
      .setWordWrapWidth(rect.width - 100);
    const toggleRect: Rect = { x: rect.x + rect.width - 86, y: rect.y + (rect.height - 32) / 2, width: 84, height: 32 };
    const enabled = control.unavailable === undefined;
    const activate = (): void => {
      if (enabled) this.#applySetting(row);
    };
    addRowTapZone(this, rect, {
      onClick: activate,
      enabled,
      clip: this.#resultsClip,
      suppressClick: this.#resultsSuppressClick,
    });
    this.#buttons.push(
      new McButton(this, {
        kind: control.on ? "secondary" : "quiet",
        label: enabled ? (control.on ? "ON" : "OFF") : "—",
        type: typeRole.label,
        rect: toggleRect,
        enabled,
        ...(control.unavailable ? { reason: control.unavailable } : {}),
        selected: control.on,
        onClick: activate,
        clip: this.#resultsClip,
        suppressClick: this.#resultsSuppressClick,
      }),
    );
    if (control.on && enabled) paintOnFrame(this, toggleRect);
    const id = `result:${row.id}`;
    stops.set(id, this.#resultsStop(rect, index, activate));
    return id;
  }

  /** A Settings choice found by the search: its title and description, then one cell per option, the chosen one in guide yellow. */
  #drawResultChoice(
    rect: Rect,
    row: PauseSettingRow,
    control: Extract<PauseSettingRow["control"], { kind: "choice" }>,
    index: number,
    stops: Map<string, FocusStop>,
  ): readonly string[] {
    label(this, rect.x, rect.y + 2, row.title, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(12);
    this.add
      .text(rect.x, rect.y + 20, row.detail, textStyle(typeRole.body, surface.paper.hex, 0.8))
      .setFontSize(10)
      .setWordWrapWidth(rect.width - 4);
    const gap = 4;
    const EDGE_INSET = 2;
    const count = control.options.length;
    const cellWidth = (rect.width - EDGE_INSET - gap * (count - 1)) / count;
    const top = rect.y + rect.height - hit.target - 6;
    return control.options.map((option, i) => {
      const cellRect: Rect = { x: rect.x + i * (cellWidth + gap), y: top, width: cellWidth, height: hit.target };
      const selected = control.selected === option.value;
      const activate = (): void => this.#applySetting(row, option.value);
      this.#buttons.push(
        new McButton(this, {
          kind: "quiet",
          label: "",
          type: typeRole.label,
          rect: cellRect,
          onClick: activate,
          clip: this.#resultsClip,
          suppressClick: this.#resultsSuppressClick,
        }),
      );
      const g = this.add.graphics();
      g.fillStyle(selected ? signal.caution.hex : surface.ink.hex, 1).fillRect(
        cellRect.x,
        cellRect.y,
        cellRect.width,
        cellRect.height,
      );
      g.lineStyle(2, selected ? signal.caution.hex : surface.paper.hex, 1).strokeRect(
        cellRect.x + 1,
        cellRect.y + 1,
        cellRect.width - 2,
        cellRect.height - 2,
      );
      const text = this.add
        .text(
          cellRect.x + cellRect.width / 2,
          cellRect.y + cellRect.height / 2,
          option.label,
          textStyle(typeRole.label, selected ? surface.inkOnHue.hex : surface.paper.hex),
        )
        .setOrigin(0.5);
      fitText(text, cellRect.width - 8, typeRole.label.size);
      const id = `result:${row.id}:${option.value}`;
      stops.set(id, this.#resultsStop(cellRect, index, activate));
      return id;
    });
  }

  /** A result that opens its page: Settings' own result row (what matched, marked), with a chevron. */
  #drawResultLink(rect: Rect, result: SettingsSearchResult, index: number, stops: Map<string, FocusStop>): string {
    drawSearchResultRow(this, { ...rect, width: rect.width - 18 }, result);
    label(
      this,
      rect.x + rect.width - 8,
      rect.y + rect.height / 2,
      "›",
      typeRole.rowTitle,
      surface.paper.hex,
      ink.secondary,
    ).setOrigin(0.5);
    const activate = (): void => this.#openSearchResult(result.entry);
    addRowTapZone(this, rect, {
      onClick: activate,
      clip: this.#resultsClip,
      suppressClick: this.#resultsSuppressClick,
    });
    const id = `result:${result.entry.id}`;
    stops.set(id, this.#resultsStop(rect, index, activate));
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
    this.add.text(rect.x + 16, rect.y + 10, caseOf(typeRole.barTitle, "Paused"), {
      ...textStyle(typeRole.barTitle, surface.paper.hex),
      fontSize: "26px",
    });
    const statusText = game && perspectiveId ? this.#statusLine(game, perspectiveId, config) : "No game in progress.";
    const statusLabel = label(
      this,
      rect.x + 16,
      rect.y + 40,
      statusText,
      typeRole.label,
      surface.paper.hex,
      ink.secondary,
    ).setFontSize(11);
    if (game && perspectiveId) this.#drawBlindSheet(blindRect, game, perspectiveId, config);
    // Wraps rather than running under the ✕ or ending in "…": at phone width the full "‹scenario› · ‹difficulty› ·
    // Round ‹n› · ‹phase› · ‹seat›" line is wider than the header has room for beside the close button.
    statusLabel
      .setFontSize(10)
      .setWordWrapWidth(closeRect.x - rect.x - 16 - 12)
      .setLineSpacing(1);
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "✕",
        type: typeRole.rowTitle,
        rect: closeRect,
        onClick: () => this.#resume(),
      }),
    );
    stops.set("close", { rect: closeRect, activate: () => this.#resume() });
    const rule = this.add.graphics();
    rule.fillStyle(surface.paper.hex, 0.4).fillRect(rect.x, rect.y + rect.height - 2, rect.width, 2);
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
    this.add
      .text(rect.x, rect.y, lines.join("\n"), textStyle(typeRole.label, surface.paper.hex, ink.secondary))
      .setFontSize(10)
      .setLineSpacing(3)
      .setWordWrapWidth(rect.width);
  }

  #statusLine(
    game: NonNullable<SessionState["game"]>,
    perspectiveId: NonNullable<SessionState["perspectiveId"]>,
    config: SessionState["config"],
  ): string {
    const s = pauseStatusOf(game, perspectiveId, config, gameScenarios(), undefined, appSession().store.state.adjusted);
    return `${s.scenarioName} · ${s.difficultyLabel} · Round ${s.round} · ${s.phaseLabel} · ${s.seatLabel}${seedSuffixOf(s)}${adjustedSuffixOf(s)}`;
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
    return `Round ${s.round} · ${s.phaseLabel.toLowerCase()}${seedSuffixOf(s)} · ${s.seatLabel}`;
  }

  /** The cell that opens the Reference rows, and closes them unless a typed search is holding them open. */
  #drawQuickReferenceToggle(rect: Rect, open: boolean, stops: Map<string, FocusStop>): void {
    const g = this.add.graphics();
    paintPanel(g, rect, "onInk", "rest");
    const title = label(
      this,
      rect.x + 12,
      rect.y + rect.height / 2,
      "Reference",
      typeRole.rowTitle,
      surface.paper.hex,
      1,
    );
    title.setOrigin(0, 0.5);
    fitText(title, rect.width - 40, typeRole.rowTitle.size);
    label(
      this,
      rect.x + rect.width - 16,
      rect.y + rect.height / 2,
      open ? "▾" : "▸",
      typeRole.rowTitle,
      surface.paper.hex,
      ink.secondary,
    ).setOrigin(0.5);
    const activate = (): void => {
      this.#quickExpanded = !open;
      this.#lowerScroll = new VariableListScroll();
      this.#draw();
    };
    stops.set("quick-toggle", { rect, activate });
    const zone = this.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0);
    onTap(zone.setInteractive({ useHandCursor: true }), activate, "quick-toggle");
  }

  #drawQuickReferenceRow(rect: Rect, row: QuickReferenceRow, stops: Map<string, FocusStop>): void {
    const enabled = row.open !== undefined;
    const g = this.add.graphics();
    paintPanel(g, rect, "onInk", enabled ? "rest" : "unavailable");
    const alpha = enabled ? 1 : ink.disabled;
    if (row.compact) {
      // A cell of a shared line: the title centred, nothing else (the row's detail is its accessible hint, not drawn).
      const title = label(
        this,
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        row.title,
        typeRole.rowTitle,
        surface.paper.hex,
        alpha,
      ).setOrigin(0.5);
      fitText(title, rect.width - 12, typeRole.rowTitle.size);
      const act = (): void => row.open?.();
      stops.set(`quick:${row.id}`, { rect, activate: act });
      const cell = this.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0);
      if (enabled) onTap(cell.setInteractive({ useHandCursor: true }), act, `quick:${row.id}`);
      return;
    }
    // One line, clear of the chevron: a half-width cell has no room for a second line above its detail.
    const title = this.add.text(
      rect.x + 12,
      rect.y + 6,
      row.title,
      textStyle(typeRole.rowTitle, surface.paper.hex, alpha),
    );
    fitText(title, rect.width - 40, typeRole.rowTitle.size);
    this.add
      .text(
        rect.x + 12,
        rect.y + 24,
        row.unavailable ?? row.detail,
        textStyle(typeRole.label, surface.paper.hex, alpha * 0.75),
      )
      .setFontSize(9)
      .setWordWrapWidth(rect.width - 36);
    if (enabled)
      label(
        this,
        rect.x + rect.width - 16,
        rect.y + rect.height / 2,
        "›",
        typeRole.rowTitle,
        surface.paper.hex,
        ink.secondary,
      ).setOrigin(0.5);
    const activate = (): void => row.open?.();
    stops.set(`quick:${row.id}`, { rect, activate });
    const zone = this.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0);
    if (enabled) {
      // A tap, not any release: a finger swiping the sheet that lifts over a row is a scroll (`ui/tap.ts`).
      onTap(zone.setInteractive({ useHandCursor: true }), activate, `quick:${row.id}`);
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
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: titleText,
        type: typeRole.rowTitle,
        rect,
        onClick,
        clip: this.#lowerClip,
        suppressClick: this.#lowerSuppressClick,
      }),
    );
    stops.set(id, this.#lowerStop(rect, index, onClick));
  }

  #drawTableRow(rect: Rect, row: SettingsRowInfo, index: number, stops: Map<string, FocusStop>): void {
    label(this, rect.x, rect.y + 2, row.title, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(12);
    this.add
      .text(
        rect.x,
        rect.y + 20,
        row.unavailable ?? row.detail,
        textStyle(typeRole.body, surface.paper.hex, row.unavailable ? 0.55 : 0.8),
      )
      .setFontSize(10)
      .setWordWrapWidth(rect.width - 100);
    const toggleRect: Rect = { x: rect.x + rect.width - 84, y: rect.y + (rect.height - 32) / 2, width: 84, height: 32 };
    const activate = (): void => this.#toggleTableRow(row);
    addRowTapZone(this, rect, {
      onClick: activate,
      enabled: row.unavailable === undefined,
      clip: this.#lowerClip,
      suppressClick: this.#lowerSuppressClick,
    });
    this.#buttons.push(
      new McButton(this, {
        kind: row.on ? "secondary" : "quiet",
        label: row.unavailable ? "—" : row.on ? "ON" : "OFF",
        type: typeRole.label,
        rect: toggleRect,
        enabled: row.unavailable === undefined,
        ...(row.unavailable ? { reason: row.unavailable } : {}),
        selected: row.on,
        onClick: activate,
        clip: this.#lowerClip,
        suppressClick: this.#lowerSuppressClick,
      }),
    );
    if (row.on && row.unavailable === undefined) paintOnFrame(this, toggleRect);
    stops.set(`table:${row.id}`, this.#lowerStop(rect, index, activate));
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
  // groups share one bounded, scrollable `McScrollRegion` (`view/pause-layout.ts`'s own `lowerViewport`/
  // `lowerContent`) — the same "eagerly draw, then reparent" trick `scenes/table-setup.ts`'s own compact layout
  // uses for its own taller-than-the-screen content.
  // ------------------------------------------------------------------------------------------------------------

  /** Runs `draw`, then reparents everything it just added to the scene's top-level display list into `container`. */
  #captureInto(container: Phaser.GameObjects.Container, draw: () => void): void {
    const before = this.children.list.length;
    draw();
    const added = this.children.list.slice(before);
    if (added.length > 0) container.add(added);
  }

  /** A stop inside the Table/Guide scroll region: its rect tracks the current scroll offset, and taking focus scrolls it into view. */
  #lowerStop(rect: Rect, index: number, activate: () => void): FocusStop {
    return {
      rect: () => ({ ...rect, y: rect.y - this.#lowerScroll.offsetPx }),
      activate,
      ensureVisible: () => this.#lowerRegion?.scrollIntoView(index),
    };
  }

  #lowerClip = (): Rect | null => this.#lowerRegion?.rect ?? null;
  #lowerSuppressClick = (): boolean => this.#lowerRegion?.isDragSuppressingClick ?? false;

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
    // `contentSlotHeights`, not a plain `.map(r => r.height)`: each row's own gap to the next has to count toward
    // the scroll region's own total, or its offset math drifts away from where these rows are actually drawn the
    // further down it scrolls (this file's own `view/layout.ts` doc comment).
    const heights = contentSlotHeights([
      ...content.guideRunRows,
      content.tableHeading,
      content.cardSizeRow,
      ...content.tableRows,
      content.guideHeading,
      content.guideLevelRow,
      ...content.guideRows,
    ]);
    // `clipInteractive`: a mask hides pixels, not hit areas, so a row scrolled up under the title bar would still win
    // the press on the ✕ above it (its own `clip` then drops the click, so nothing happened at all), as Settings had.
    this.#lowerRegion = new McScrollRegion(this, {
      rect: viewport,
      heights,
      scroll: this.#lowerScroll,
      clipInteractive: true,
    });
    const container = this.#lowerRegion.content;
    const toScreen = (contentRect: Rect): Rect => ({ ...contentRect, y: viewport.y + contentRect.y });

    // §3.10, G5c part 3 — "Stop tutorial" / "Turn guide off", ahead of "Table" (`content.guideRunRows` is empty
    // outside a guided run, this file's own `#drawPhone` call site).
    const runOffset = content.guideRunRows.length;
    if (content.guideRunRows[0]) {
      this.#captureInto(container, () =>
        this.#drawGuideRunRow(
          toScreen(content.guideRunRows[0]!),
          "Stop tutorial",
          0,
          stops,
          "guide-stop-tutorial",
          () => this.#stopTutorial(),
        ),
      );
    }
    if (content.guideRunRows[1]) {
      this.#captureInto(container, () =>
        this.#drawGuideRunRow(
          toScreen(content.guideRunRows[1]!),
          "Turn guide off",
          1,
          stops,
          "guide-turn-guide-off",
          () => this.#turnGuideOff(),
        ),
      );
    }

    this.#captureInto(container, () =>
      label(
        this,
        viewport.x,
        viewport.y + content.tableHeading.y,
        "Table",
        typeRole.label,
        surface.paper.hex,
        ink.secondary,
      ),
    );
    this.#captureInto(container, () => this.#drawCardSizeRow(toScreen(content.cardSizeRow), runOffset + 1, stops));
    tableRows.forEach((row, index) => {
      this.#captureInto(container, () =>
        this.#drawTableRow(toScreen(content.tableRows[index]!), row, runOffset + index + 2, stops),
      );
    });

    this.#captureInto(container, () =>
      label(
        this,
        viewport.x,
        viewport.y + content.guideHeading.y,
        "Guide",
        typeRole.label,
        surface.paper.hex,
        ink.secondary,
      ),
    );
    const stopIds: string[] = [];
    const guideBaseIndex = runOffset + 2 + tableRows.length + 1; // guide-run rows + tableHeading + Card size + every table row + guideHeading
    if (levelRow && levelRow.kind === "segmented") {
      this.#captureInto(container, () =>
        this.#drawGuideLevelRow(toScreen(content.guideLevelRow), levelRow, guideBaseIndex, stops),
      );
      stopIds.push(...levelRow.options.map((option) => `guide-level:${option.value}`));
    }
    afterLevel.forEach((row, index) => {
      this.#captureInto(container, () =>
        this.#drawGuideRow(toScreen(content.guideRows[index]!), row, guideBaseIndex + 1 + index, stops),
      );
      stopIds.push(row.id);
    });
    this.#lowerRegion.syncInteractivity();
    return stopIds;
  }

  /**
   * Card size, as a quick setting on the phone's sheet (the owner: the cards were too small to read and the phone had
   * no way to change it mid-game). Its title, then one segment per size, the selected one in guide yellow.
   */
  #drawCardSizeRow(rect: Rect, index: number, stops: Map<string, FocusStop>): void {
    const info = cardSizeRowInfoOf(appSession().settings);
    label(this, rect.x, rect.y, info.title.toUpperCase(), typeRole.rowTitle, surface.paper.hex, 1);
    const gap = 4;
    const EDGE_INSET = 2;
    const top = rect.y + 22;
    const height = rect.height - 22;
    const cellWidth = (rect.width - EDGE_INSET - gap * (info.options.length - 1)) / info.options.length;
    info.options.forEach((option, i) => {
      const cellRect: Rect = { x: rect.x + i * (cellWidth + gap), y: top, width: cellWidth, height };
      const selected = info.selected === option.value;
      const activate = (): void => this.#setCardSize(option.value);
      this.#buttons.push(
        new McButton(this, {
          kind: "quiet",
          label: "",
          type: typeRole.label,
          rect: cellRect,
          onClick: activate,
          clip: this.#lowerClip,
          suppressClick: this.#lowerSuppressClick,
        }),
      );
      const g = this.add.graphics();
      g.fillStyle(selected ? signal.caution.hex : surface.ink.hex, 1).fillRect(
        cellRect.x,
        cellRect.y,
        cellRect.width,
        cellRect.height,
      );
      g.lineStyle(2, selected ? signal.caution.hex : surface.paper.hex, 1).strokeRect(
        cellRect.x + 1,
        cellRect.y + 1,
        cellRect.width - 2,
        cellRect.height - 2,
      );
      const text = this.add
        .text(
          cellRect.x + cellRect.width / 2,
          cellRect.y + cellRect.height / 2,
          option.label,
          textStyle(typeRole.label, selected ? surface.inkOnHue.hex : surface.paper.hex),
        )
        .setOrigin(0.5);
      fitText(text, cellRect.width - 8, typeRole.label.size);
      stops.set(`table:card-size:${option.value}`, this.#lowerStop(cellRect, index, activate));
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
    index: number,
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
      // The button lands first (its own "quiet" skin paints an opaque paper fill), so the cell's own fill/stroke/
      // text — added after — draw on top of it rather than being hidden under it (`McButton`'s own z-order).
      this.#buttons.push(
        new McButton(this, {
          kind: "quiet",
          label: "",
          type: typeRole.label,
          rect: cellRect,
          onClick: activate,
          clip: this.#lowerClip,
          suppressClick: this.#lowerSuppressClick,
        }),
      );
      // Selected reads as guide yellow (`signal.caution`, ink text) rather than ink-on-ink, which — against this
      // overlay's own dark ground — used to read as *less* "on" than the bright-paper unselected cells beside it
      // (found in browser verification, 2026-09-26: the selected cell looked unselected at a glance). Unselected
      // is ink fill with a paper border and paper text, the readable-on-dark pairing the rest of this sheet uses.
      const g = this.add.graphics();
      g.fillStyle(selected ? signal.caution.hex : surface.ink.hex, 1).fillRect(
        cellRect.x,
        cellRect.y,
        cellRect.width,
        cellRect.height,
      );
      g.lineStyle(2, selected ? signal.caution.hex : surface.paper.hex, 1).strokeRect(
        cellRect.x + 1,
        cellRect.y + 1,
        cellRect.width - 2,
        cellRect.height - 2,
      );
      this.add
        .text(
          cellRect.x + 10,
          cellRect.y + 8,
          option.label,
          textStyle(typeRole.rowTitle, selected ? surface.inkOnHue.hex : surface.paper.hex),
        )
        .setFontSize(12);
      this.add
        .text(
          cellRect.x + 10,
          cellRect.y + 26,
          option.detail,
          textStyle(typeRole.body, selected ? surface.inkOnHue.hex : surface.paper.hex, selected ? 0.85 : 0.7),
        )
        .setFontSize(9)
        .setWordWrapWidth(cellWidth - 16);
      stops.set(`guide:guide-level:${option.value}`, this.#lowerStop(cellRect, index, activate));
    });
  }

  #drawGuideRow(rect: Rect, row: GuideNonLevelRow, index: number, stops: Map<string, FocusStop>): void {
    label(this, rect.x, rect.y + 2, row.title, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(12);
    this.add
      .text(
        rect.x,
        rect.y + 20,
        guideRowDetailOf(row),
        textStyle(typeRole.body, surface.paper.hex, row.kind === "action" && row.unavailable ? 0.55 : 0.8),
      )
      .setFontSize(10)
      .setWordWrapWidth(rect.width - 100);

    const controlRect: Rect = {
      x: rect.x + rect.width - 84,
      y: rect.y + (rect.height - 32) / 2,
      width: 84,
      height: 32,
    };
    const activate = (): void => this.#activateGuideRow(row);
    const unavailable = row.kind === "action" ? row.unavailable : undefined;
    addRowTapZone(this, rect, {
      onClick: activate,
      enabled: unavailable === undefined,
      clip: this.#lowerClip,
      suppressClick: this.#lowerSuppressClick,
    });
    this.#buttons.push(
      new McButton(this, {
        kind: row.kind === "toggle" && row.on ? "secondary" : "quiet",
        label: unavailable ? "—" : row.kind === "toggle" ? (row.on ? "ON" : "OFF") : "Open ▸",
        type: typeRole.label,
        rect: controlRect,
        enabled: unavailable === undefined,
        ...(unavailable ? { reason: unavailable } : {}),
        selected: row.kind === "toggle" && row.on,
        onClick: activate,
        clip: this.#lowerClip,
        suppressClick: this.#lowerSuppressClick,
      }),
    );
    if (row.kind === "toggle" && row.on) paintOnFrame(this, controlRect);
    stops.set(`guide:${row.id}`, this.#lowerStop(rect, index, activate));
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
    this.add
      .text(
        layout.panel.x + 16,
        yesRect.y - 22,
        "Concede? This ends the game for the whole table.",
        textStyle(typeRole.body, accent.heroRed.hex),
      )
      .setFontSize(11)
      .setWordWrapWidth(layout.panel.width - 32);
    stops.set("concede-confirm-yes", { rect: yesRect, activate: () => void this.#onConcedeConfirmed() });
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: "Yes, concede",
        type: typeRole.barTitle,
        rect: yesRect,
        onClick: () => void this.#onConcedeConfirmed(),
      }),
    );
    stops.set("concede-confirm-cancel", { rect: cancelRect, activate: () => this.#setConfirmingConcede(false) });
    this.#buttons.push(
      new McButton(this, {
        kind: "quiet",
        label: "Cancel",
        type: typeRole.rowTitle,
        rect: cancelRect,
        onClick: () => this.#setConfirmingConcede(false),
      }),
    );
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
    this.#buttons.push(
      new McButton(this, {
        kind,
        label: text,
        type: kind === "primary" ? typeRole.barTitle : typeRole.rowTitle,
        rect,
        onClick,
        enabled: true,
      }),
    );
  }
}
