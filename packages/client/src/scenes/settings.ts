/**
 * Settings (docs/phase4-screen-gaps.md §3 "W4"; design canvases D13, P16, L07).
 *
 * **Composition (fidelity pass, 2026-09-17).** The canvases never draw Settings
 * as its own full screen — D13/P16/L07 show its rows inline, under a "TABLE"
 * heading, inside Pause (`scenes/pause.ts` now draws that same group directly).
 * This overlay is the *standalone* door to the identical rows for a caller with
 * no paused game to attach them to (Title, once W2 lands its entry) — same ink
 * title bar with a boxed ✕, same row shape (title, one-line detail, a toggle
 * on the right) as Pause's own "Table" column, both built from one shared,
 * tested row list (`view/settings-rows.ts`) so the wording can never drift
 * between the two places it's drawn.
 *
 * **Entry point.** `scene.launch(SCENES.settings)` from whatever scene wants it
 * — Pause still offers it too, alongside its own inline Table group, as a way to
 * reach the same rows full-screen. Title's own rewrite (W2, a parallel worktree)
 * should launch it the same way. `#back`/the ✕ always just `this.scene.stop()`s
 * this overlay, so it returns to whichever scene launched it without needing to
 * know or care which.
 *
 * Every setting here is a client-only presentation preference
 * (`settings.ts`'s own doc comment: "nothing here reaches the engine"), read
 * live off `appSession().settings` by whatever draws with it — this scene only
 * flips fields on that one shared object, it never re-implements what reading
 * them does.
 */
import Phaser from "phaser";
import type { OnlineNameData } from "./online-name.js";
import {
  guideLevelSearchDetail,
  guideRowInfoOf,
  guideRowDetailOf,
  nextGuidePrefsAfterRow,
  cardHoverRowInfoOf,
  effectsVolumeRowInfoOf,
  gameVolumeRowInfoOf,
  musicVolumeRowInfoOf,
  nextSettingsAfterEffectsVolume,
  nextSettingsAfterMusicVolume,
  cardSizeRowInfoOf,
  playAreaOrderRowInfoOf,
  schemeFanBackgroundRowInfoOf,
  nextSettingsAfterSchemeFanBackground,
  nextSettingsAfterPlayAreaOrder,
  cardLanguageRowInfoOf,
  nextSettingsAfterCardLanguage,
  displayModeRowInfoOf,
  frameRateRowInfoOf,
  nextSettingsAfterFrameRate,
  nextSettingsAfterRenderScale,
  nextSettingsAfterCouchMode,
  couchModeRowInfoOf,
  renderScaleRowInfoOf,
  renderScaleRowShown,
  nextSettingsAfterCardSize,
  nextSettingsAfterDisplayMode,
  nextSettingsAfterResolution,
  resolutionRowInfoOf,
  nextSettingsAfterCardHover,
  nextSettingsAfterInspectCard,
  inspectCardRowInfoOf,
  fadeColorRowInfoOf,
  nextSettingsAfterFadeColor,
  nextSettingsAfterTokenMotion,
  tokenMotionRowInfoOf,
  achievementPopupPlaceRowInfoOf,
  heroArtRowInfoOf,
  nextSettingsAfterHeroArt,
  achievementPopupSizeRowInfoOf,
  nextSettingsAfterAchievementPopupSize,
  achievementPopupTimeRowInfoOf,
  nextSettingsAfterAchievementPopupPlace,
  nextSettingsAfterAchievementPopupTime,
  nextSettingsAfterToggle,
  nextSettingsAfterVillainRow,
  settingsRowInfoOf,
  discordRowInfoOf,
  liveWatchRowInfoOf,
  onlineNameRowInfoOf,
  deckCopyLimitsRowInfoOf,
  showPreconDecksRowInfoOf,
  extraModularSetsRowInfoOf,
  deckListOnOpenRowInfoOf,
  nextSettingsAfterDeckListOnOpen,
  fadedCampaignArtRowInfoOf,
  customUnlockedRowInfoOf,
  cheatUnlockWarningOf,
  manualAdjustRowInfoOf,
  customPlacementRowInfoOf,
  nextSettingsAfterCustomPlacement,
  deckSignatureRowInfoOf,
  nextSettingsAfterDeckSignature,
  nextSettingsAfterUndoPastTurn,
  undoPastTurnRowInfoOf,
  earnedItemRowInfoOf,
  villainRowInfoOf,
  type GuideRowInfo,
  type SettingsRowInfo,
  type VillainRowId,
  type VillainRowsInfo,
} from "../view/settings-rows.js";
import { GlyphHints, specsForShortcuts } from "../ui/glyph-hints.js";
import { glyphRightInRow } from "../view/glyph-placement.js";
import type { SettingsItemId, SettingsTabId } from "../view/settings-sections.js";
import { SettingsSearchClient } from "../view/settings-search-client.js";
import type { SettingsRowText, SettingsSearchEntry, SettingsSearchResult } from "../view/settings-search.js";
import { readConsent } from "../global-stats/global-consent.js";
import type { ControlsTab } from "../view/controls-rows.js";
import type { ControlsSceneData } from "./controls.js";
import type { UnlocksSceneData } from "./unlocks.js";
import type { StatsTab } from "../view/player-stats-layout.js";
import { drawSearchField, drawSearchToggle } from "./roster-panel.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import { drawSearchResultRow, SEARCH_RESULT_ROW_HEIGHT } from "./settings-search-row.js";
import { McVirtualList } from "../ui/virtual-list.js";
import { ListScroll } from "../view/list-scroll.js";
import type { GuideLevel } from "../guide/guide-prefs.js";
import type { CardLanguage } from "../art/card-language.js";
import type {
  CardHoverScale,
  InspectCard,
  CardSize,
  FirstPlayerTokenMotion,
  Settings,
  VillainAutoAdvance,
  VillainBeatSpeed,
  FlipEncounterSpeed,
  Resolution,
} from "../settings.js";
import {
  applyDesktopWindow,
  desktopMonitor,
  HANDHELD_DISPLAY,
  hasDesktopWindow,
  refreshDesktopMonitor,
  resolutionOptionsFor,
} from "../platform/desktop-window.js";
import { syncDiscordPresence } from "../platform/discord-presence.js";
import {
  followsWindowsMixer,
  knownMixerVolume,
  onMixerChange,
  readMixerVolume,
  writeMixerVolume,
} from "../platform/app-volume.js";
import { surface, typeRole } from "../tokens.js";
import { caseOf, textStyle } from "../ui/theme.js";
import { McButton, McTabs, type McTextInput } from "../ui/widgets.js";
import { onTap } from "../ui/tap.js";
import type { SyncLinkAddress } from "../sync/sync-link.js";
import "@mc/ui";
import type { BodyControl, BodyList, BodyRect, BodyRow, McSettingsBody } from "@mc/ui";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import {
  settingsLayout,
  type SettingsContentLayout,
  type SettingsItemLayout,
  type SettingsItemSpec,
} from "../view/settings-layout.js";
import type { Rect } from "../view/layout.js";
import { appSession } from "../session.js";
import { guidePrefs, onGuidePrefsChange, setGuidePrefs } from "../guide/guide-store.js";
import { onPowerSavingChange, powerSavingOn, powerSavingState } from "../platform/power-saving.js";
import { powerSavingRowOf } from "../view/power-saving-notice.js";
import { onColorSchemeChange } from "../view/color-scheme.js";
import { setThemeSlot } from "../ui/theme-slot.js";
import { inputDevice } from "../platform/input-device.js";
import {
  applyScreenSettings,
  applyTextResolution,
  drawnDensity,
  knownRefreshInfo,
  readRefreshInfo,
} from "../platform/screen-settings.js";
import { onHardwareChange } from "../platform/device-hardware.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { askToConfirm } from "./end-turn-confirm.js";
import { SCENES } from "./keys.js";
import {
  CONTROLS_ROW,
  controlsRowDetail,
  RULES_ROW,
  rulesRowDetail,
  rulesRowTitle,
  SAVE_DATA_ROW,
  STATS_ROW,
  statsRowDetail,
  steamDeckDetail,
  UNLOCKS_ROW,
  controlsShown,
  couchBaseOf,
  couchModeShown,
  screenAdviceOf,
  screenSettingsShown,
  settingsTabsFor,
} from "./settings-env.js";
import type { PlayerStatsData } from "./player-stats.js";
import type { AchievementToastScene } from "./achievement-toast.js";
import type { RulesSceneData } from "./rules.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { OverlayMotion } from "../ui/transitions.js";
import { applyEarnedItems, earnedItems, earnedPromoSets, unlocks } from "../progression/progression.js";
import { heroPromoShown } from "../view/hero-art-choice.js";
import { unlocksSummaryOf } from "../view/unlocks-model.js";
import type { TransferCode } from "@mc/sync-worker/protocol";
import type { SaveDataSceneData } from "./save-data.js";
import { saveDataRowDetail, saveDataRowTitle } from "../view/save-data-model.js";
import { steamInstallRowDetail, steamInstallRowTitle, STEAM_UPDATE_CLOSED } from "../view/steam-update.js";
import { t } from "../i18n/translate.js";
import { knownSteamAdd, steamAdd } from "../platform/steam-add.js";
import { DOWNLOADS_URL } from "../view/language-button.js";
import type { SteamUpdateSceneData } from "./steam-update.js";

/** Between the title bar's search and ✕ buttons. */
const SEARCH_GAP = 10;
/** The room the Y glyph takes in the title bar, left of the search button, before the LB / RB glyphs. */
const HINT_GAP = 30;

type GuideNonLevelRow = Extract<GuideRowInfo, { kind: "action" | "toggle" }>;

/** The control widths of the rows that draw a segmented choice. */
const SPEED_CONTROL_WIDTH = 204;
const CARD_HOVER_CONTROL_WIDTH = 280;
const CARD_SIZE_CONTROL_WIDTH = 520;
const POPUP_TIME_CONTROL_WIDTH = 320;
const POPUP_PLACE_CONTROL_WIDTH = 400;
const POPUP_SIZE_CONTROL_WIDTH = 300;
/** Room for each mode's label with padding either side (the owner, 2026-10-16). */
const DISPLAY_MODE_CONTROL_WIDTH = 480;
/** Resolution is a dropdown and an Apply button: up to seventeen sizes is too many segments. */
const RESOLUTION_CONTROL_WIDTH = 320;
const APPLY_WIDTH = 88;
/** Couch mode's seven short segments ("Off" to "300%"). */
const COUCH_MODE_CONTROL_WIDTH = 560;
/** Resolution's and Frame rate's up to four short segments ("Native", "720p"; "Screen", "60 fps"). */
const SCREEN_CONTROL_WIDTH = 300;

const LIST_ROW_HEIGHT = 36;
const LIST_VISIBLE_ROWS = 8;

/**
 * A toggle or door row's 84px control, right-aligned and centred on the row. Held 2px in from the row's right edge,
 * which is also the scroll region's mask edge, so the control's own border isn't clipped away.
 */
function controlRectOf(row: Rect): Rect {
  return { x: row.x + row.width - 86, y: row.y + (row.height - 32) / 2, width: 84, height: 32 };
}

/** What a segmented row draws: its title and detail, and the option it shows chosen. */
interface SegmentedInfo<V extends string> {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: V; readonly label: string }[];
  readonly selected: V;
}

/** One row the body can draw: how `settingsLayout` sizes it, and how to draw it once placed (screen space). */
interface SettingsItem extends SettingsRowText {
  readonly spec: SettingsItemSpec;
  readonly draw: (item: SettingsItemLayout, stops: Map<string, FocusStop>) => readonly string[];
}

/** The tab Settings last showed, so reopening it in the same session lands where the player left off. */
let lastTab: SettingsTabId = "gameplay";

/** Launch data: `receive` opens Save data straight onto Receive with that code (a scanned QR link). */
export interface SettingsSceneData {
  readonly receive?: TransferCode;
  /** `syncLink` opens Save data, then Sync across devices, asking to join with a scanned `#link=` (device sync, #276). */
  readonly syncLink?: SyncLinkAddress;
  /** Opens Controls straight away (the "Controller connected" toast's button), so it stacks over Settings as usual. */
  readonly openControls?: boolean;
  /** Opens on this row's tab with the focus ring on it: a Settings row Pause's search found but cannot change inline. */
  readonly focus?: { readonly item: SettingsItemId; readonly tab: SettingsTabId };
}

export class SettingsOverlay extends Phaser.Scene {
  #buttons: McButton[] = [];
  #tabs: McTabs | null = null;
  /** LB / RB glyphs beside the tab strip (pad only). */
  #hints!: GlyphHints;
  /** The tabs drawn now, in order, for LB / RB. */
  #tabIds: SettingsTabId[] = [];
  #route: FocusRoute | null = null;
  #motion = new OverlayMotion();
  /** The active tab's own scroll region (docs/guided-mode.md §4 G2b): its sections all draw into it. */
  /** The body: a Lit panel over the canvas (`@mc/ui`'s `mc-settings-body`), kept across redraws so its scroll stays. */
  #body: DomRegion<McSettingsBody> | null = null;
  /** The next draw starts the body from its top (another tab, a search result). */
  #bodyFromTop = false;
  /** What each key in the body does this draw, for the panel's `mc-activate`. */
  #bodyActions = new Map<string, () => void>();
  /** The rows the body is given this draw. */
  #bodyRows: BodyRow[] = [];
  /** The open Resolution list this draw, drawn by the body over its rows. */
  #bodyList: BodyList | null = null;
  /** Where the body sits this draw, so rows can be placed relative to it. */
  #bodyOrigin = { x: 0, y: 0 };
  /** The Resolution the player picked in the dropdown, not yet applied; null when nothing is pending. */
  #pendingResolution: Resolution | null = null;
  #resolutionListOpen = false;
  /** What the Resolution field lists, for the open list. */
  #resolutionInfo: SegmentedInfo<Resolution> | null = null;
  /** The search (#576): shown in the tab rail's place while open, with the results in place of the rows. */
  #searchOpen = false;
  #searchInput: McTextInput | null = null;
  #searchClient: SettingsSearchClient | null = null;
  /** The newest answer for what is typed; null with nothing typed. */
  #searchResults: readonly SettingsSearchResult[] | null = null;
  #resultsList: McVirtualList | null = null;
  readonly #resultsScroll = new ListScroll();
  /** Each row's first focus stop, for a search result to land the ring on. */
  #firstStopOf = new Map<string, string>();

  constructor() {
    super(SCENES.settings);
  }

  create(data: SettingsSceneData = {}): void {
    this.#motion = new OverlayMotion();
    this.input.enabled = true;
    // In the desktop app a resize can also be a move to another monitor, whose sizes the Resolution row lists.
    const onResize = (): void => {
      this.#draw();
      // A turned phone can move Sound off its tab.
      this.#refreshSearch();
      if (hasDesktopWindow()) void refreshDesktopMonitor().then(() => this.#redrawIfOpen());
    };
    this.scale.on("resize", onResize, this);
    this.#hints = new GlyphHints(this);
    this.#searchOpen = false;
    this.#searchResults = null;
    if (data.focus) {
      lastTab = data.focus.tab;
      this.#bodyFromTop = true;
    }
    // Before the route: A, B or Start takes the caret out of the search field.
    bindTextFieldEscape(
      this,
      () => this.#searchInput,
      () => this.#covered(),
    );
    this.#route = new FocusRoute(this, {
      onScroll: (_dx, dy) => {
        if (this.#resultsList) this.#resultsList.scrollByPx(dy);
        else this.#body?.element.scroller?.scrollBy({ top: dy });
      },
      ring: domFocusRing,
      // Y opens and shuts the search where a controller is in use; the keyboard's Inspect key stays Inspect.
      onInspect: (source) => {
        if (source === "key" || inputDevice().mode !== "pad" || this.#resolutionListOpen) return false;
        this.#toggleSearch();
        return true;
      },
      // LB / RB (R / F on the keyboard) step through the tabs, wrapping at the ends.
      onTab: (direction) => {
        if (this.#resultsList) this.#resultsList.scrollByPage(direction);
        const ids = this.#tabIds;
        if (ids.length === 0) return;
        if (this.#resolutionListOpen) return;
        const at = Math.max(0, ids.indexOf(lastTab));
        const next = ids[(at + direction + ids.length) % ids.length]!;
        this.#setTab(next);
        // The ring goes onto the new tab, as a press on it would leave it.
        this.#route?.focusKey(`tab:${next}`);
      },
      onPage: (direction) => this.#resultsList?.scrollByPage(direction),
      onHomeEnd: (edge) => (edge === "home" ? this.#resultsList?.scrollToStart() : this.#resultsList?.scrollToEnd()),
      blocked: () => this.#covered() || (this.#searchInput?.focused ?? false),
      onCancel: () => {
        if (this.#resolutionListOpen) this.#closeResolutionList(true);
        else if (this.#searchOpen) this.#closeSearch();
        else this.#close();
      },
    });
    // Another scene (Pause's own inline Guide group) can change the same live prefs while this overlay is open
    // behind it — redraw so this one never shows a stale level/toggle.
    const unsubscribeGuide = onGuidePrefsChange(() => this.#draw());
    // Power saving mode turning on or off changes the Reduced motion and Sharper text rows.
    const unsubscribePowerSaving = onPowerSavingChange(() => this.#redrawIfOpen());
    // The hardware check finishing changes the Screen rows' recommendation.
    const unsubscribeHardware = onHardwareChange(() => this.#redrawIfOpen());
    // Add to Steam's check (#844) reads Steam's files and may still be going when Settings opens: once it says the
    // game can be added, More gains the row.
    if (knownSteamAdd() === null) {
      void steamAdd().then((info) => {
        if (info !== null) this.#redrawIfOpen();
      });
    }
    // The top-of-screen dark mode toggle (#459) flips the same setting as the Dark mode row: the row follows it.
    const unsubscribeScheme = onColorSchemeChange(() => this.#redrawIfOpen());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      unsubscribeGuide();
      unsubscribePowerSaving();
      unsubscribeHardware();
      unsubscribeScheme();
      setThemeSlot(this.scene.key, null);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      this.#tabs?.destroy();
      this.#tabs = null;
      this.#body = null;
      this.#resultsList?.destroy();
      this.#resultsList = null;
      this.#searchInput?.destroy();
      this.#searchInput = null;
      this.#searchClient?.destroy();
      this.#searchClient = null;
      this.#hints.dispose();
    });
    this.#draw();
    // Phaser hands a later launch with no data this same object again, so take the code once.
    const receive = data.receive;
    this.sys.settings.data = {};
    const syncLink = data.syncLink;
    const focus = data.focus;
    if (receive || syncLink) this.#openSaveData(receive, syncLink);
    if (data.openControls === true) this.#openControls();
    if (focus) this.#route?.focusKey(`row:${this.#firstStopOf.get(focus.item) ?? focus.item}`);
    if (hasDesktopWindow()) void refreshDesktopMonitor().then(() => this.#redrawIfOpen());
    // The Frame rate row names the screen's refresh rate once the Android app has said it.
    if (screenSettingsShown() && knownRefreshInfo() === null) void readRefreshInfo().then(() => this.#redrawIfOpen());
    // The game's volume in the Windows mixer may have moved there since: read it fresh for the Game volume row.
    if (followsWindowsMixer()) {
      // Read it now, then follow the shell's change events, so a change in the Windows mixer shows on the Game volume
      // row while Settings is open. Nothing polls here.
      let last = knownMixerVolume();
      const show = (read: number | null): void => {
        if (read === last) return;
        last = read;
        this.#redrawIfOpen();
      };
      void readMixerVolume().then(show);
      const stop = onMixerChange(({ volume }) => show(volume));
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
    }
  }

  #redrawIfOpen(): void {
    if (this.sys.isActive()) this.#draw();
  }

  /** True while a page opened from here is over this one. */
  #covered(): boolean {
    return (
      this.scene.isActive(SCENES.unlocks) ||
      this.scene.isActive(SCENES.saveData) ||
      this.scene.isActive(SCENES.playerStats) ||
      this.scene.isActive(SCENES.controls) ||
      this.scene.isActive(SCENES.steamUpdate) ||
      this.scene.isActive(SCENES.rules) ||
      // The warning before turning on Undo past your turn or Manual adjust (`#afterWarning`).
      this.scene.isActive(SCENES.endTurnConfirm)
    );
  }

  #toggleSearch(): void {
    if (this.#searchOpen) this.#closeSearch();
    else this.#openSearch();
  }

  #openSearch(): void {
    this.#searchOpen = true;
    this.#searchResults = null;
    this.#draw();
    this.#indexForSearch();
    this.#searchInput?.focus();
    this.#route?.focusKey("search-field");
  }

  /** Back to the tab the search was opened over. */
  #closeSearch(focus: string | null = "search-toggle"): void {
    this.#searchOpen = false;
    this.#searchResults = null;
    this.#searchClient?.cancel();
    this.#searchInput?.destroy();
    this.#searchInput = null;
    this.#draw();
    if (focus) this.#route?.focusKey(focus);
  }

  /** After a page or the window changed what the results say: reads the index again and asks again. */
  #refreshSearch(): void {
    if (!this.#searchOpen) return;
    this.#indexForSearch();
    this.#onSearchChange(this.#searchInput?.value ?? "");
  }

  /** What the rows say now: the worker reads the pages under Settings itself. */
  #indexForSearch(): void {
    const { width, height } = this.scale.gameSize;
    const settings = appSession().settings;
    const guideRows = guideRowInfoOf(guidePrefs());
    const rows = this.#itemsOf(settings, guideRows);
    const { progress, prefs, devUnlockAll, achievementPoints } = unlocks();
    this.#searchClient ??= new SettingsSearchClient();
    this.#searchClient.index({
      tabs: this.#tabsOf(width, height, settings, guideRows),
      rows: [...rows].map(([id, { title, detail }]) => [id, { title, detail }] as const),
      settings,
      pad: inputDevice().pad,
      unlocks: { progress, prefs, devUnlockAll, achievementPoints },
      globalConsent: readConsent(),
      controls: controlsShown(),
    });
  }

  #onSearchChange(value: string): void {
    if (value.trim() === "") {
      this.#searchClient?.cancel();
      this.#searchResults = null;
      this.#draw();
      return;
    }
    this.#searchClient?.search(value, (results) => {
      this.#searchResults = results;
      this.#resultsScroll.reset();
      this.#redrawIfOpen();
    });
  }

  /** A press on a result: its page, on the spot it was found. The search stays open behind a page, for the way back. */
  #openResult(entry: SettingsSearchEntry): void {
    this.#searchInput?.blur();
    const target = entry.target;
    switch (target.kind) {
      case "setting":
        lastTab = target.tab;
        this.#bodyFromTop = true;
        this.#closeSearch(null);
        this.#route?.focusKey(`row:${this.#firstStopOf.get(target.item) ?? target.item}`);
        return;
      case "rules":
        this.#openRules({
          initialTab: target.tab,
          initialScope: "all",
          ...(target.query !== undefined ? { initialQuery: target.query } : {}),
        });
        return;
      case "unlocks":
        this.#openUnlocks({
          ...(target.row !== undefined ? { row: target.row } : {}),
          ...(target.guideSection !== undefined ? { guideSection: target.guideSection } : {}),
        });
        return;
      case "saveData":
        this.#openSaveData(undefined, undefined, target.row);
        return;
      case "controls":
        this.#openControls(target.tab);
        return;
      case "stats":
        this.#openStats(target.tab);
        return;
      case "pause":
        // Only Pause's search indexes its own rows.
        return;
    }
  }

  /** The tabs this device shows now. */
  #tabsOf(width: number, height: number, settings: Settings, guideRows: readonly GuideRowInfo[]) {
    return settingsTabsFor(this.game, width, height, settings, guideRows);
  }

  #openSteamUpdate(): void {
    if (this.scene.isActive(SCENES.steamUpdate)) return;
    // Asks the script itself rather than the update check: this is also how to look again after closing the banner.
    this.scene.launch(SCENES.steamUpdate, { version: null, fallbackUrl: DOWNLOADS_URL } satisfies SteamUpdateSceneData);
  }

  /** Add to Steam (#844): the same panel, running the Steam script on this game as it is. */
  #openSteamAdd(): void {
    if (this.scene.isActive(SCENES.steamUpdate)) return;
    this.scene.launch(SCENES.steamUpdate, {
      version: null,
      fallbackUrl: DOWNLOADS_URL,
      mode: "add-steam",
    } satisfies SteamUpdateSceneData);
    // Back from it: redraw, so a game just added to Steam loses the row (and gains the Steam install row) at once.
    this.game.events.once(STEAM_UPDATE_CLOSED, () => {
      if (this.sys.isActive()) this.#draw();
    });
  }

  #openUnlocks(data: UnlocksSceneData = {}): void {
    if (this.scene.isActive(SCENES.unlocks)) return;
    // Unlocks' panel sits exactly over this one, so a tap on its blank space must not reach a toggle underneath.
    this.input.enabled = false;
    this.scene.launch(SCENES.unlocks, data);
    // Back from Unlocks: redraw so the summary line reads what was just changed.
    this.scene.get(SCENES.unlocks).events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.enabled = true;
      if (this.sys.isActive()) this.#draw();
      this.#refreshSearch();
    });
  }

  /** Your stats, over this overlay: Back there closes it and gives this one its input again. */
  #openStats(tab?: StatsTab): void {
    if (this.scene.isActive(SCENES.playerStats)) return;
    this.scene.launch(SCENES.playerStats, {
      from: SCENES.settings,
      overlay: true,
      ...(tab ? { tab } : {}),
    } satisfies PlayerStatsData);
  }

  #openSaveData(receive?: TransferCode, syncLink?: SyncLinkAddress, row?: string): void {
    if (this.scene.isActive(SCENES.saveData)) return;
    this.input.enabled = false;
    this.scene.launch(SCENES.saveData, {
      ...(receive ? { receive } : {}),
      ...(syncLink ? { syncLink } : {}),
      ...(row ? { row } : {}),
    } satisfies SaveDataSceneData);
    this.scene.get(SCENES.saveData).events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.enabled = true;
      if (this.sys.isActive()) this.#draw();
      this.#refreshSearch();
    });
  }

  #openControls(tab?: ControlsTab): void {
    if (this.scene.isActive(SCENES.controls)) return;
    this.input.enabled = false;
    this.scene.launch(SCENES.controls, (tab ? { tab } : {}) satisfies ControlsSceneData);
    this.scene.get(SCENES.controls).events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.enabled = true;
      this.#refreshSearch();
    });
  }

  #openRules(data: RulesSceneData = { initialTab: "glossary" }): void {
    if (this.scene.isActive(SCENES.rules)) return;
    this.input.enabled = false;
    this.scene.launch(SCENES.rules, data);
    // Rules is registered before Settings, so a plain launch renders it underneath this panel.
    this.scene.bringToTop(SCENES.rules);
    this.scene.get(SCENES.rules).events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.enabled = true;
    });
  }

  #close(): void {
    this.#motion.exit(this, () => this.scene.stop());
  }

  /**
   * "Play the tutorial" (guided mode G6c, `docs/guided-mode.md` §4): leaves whatever's running — Settings can be
   * reached standalone from Title (nothing else to stop) or launched over a live game from Pause — and opens the
   * "How to play" hub (`scenes/how-to-play.ts`), mirroring `scenes/pause.ts#saveAndQuit`'s own "fully leave
   * what's running" shape rather than a bare `scene.start`, which would only stop this overlay and leave
   * Board/Pause running invisibly underneath. Retargeted from How to win directly (G6b) to the hub once it landed
   * (G6c) — the hub's own lesson 1 row/"Continue learning" is what opens How to win now.
   */
  #openHowToPlay(): void {
    this.#motion.exit(this, () => {
      for (const overlay of [SCENES.pause, SCENES.rules, SCENES.choice, SCENES.inspect, SCENES.villainPhase]) {
        if (this.scene.isActive(overlay) || this.scene.isSleeping(overlay)) this.scene.stop(overlay);
      }
      if (this.scene.isActive(SCENES.board)) this.scene.stop(SCENES.board);
      this.scene.start(SCENES.howToPlay, {});
    });
  }

  /**
   * Applies `next` straight away, or, where it turns on a way for a game to stop counting (Undo past your turn, Manual
   * adjust), only once the player has read the warning and said yes (`cheatUnlockWarningOf`).
   */
  #afterWarning(next: Settings, apply: (next: Settings) => void): void {
    const warning = cheatUnlockWarningOf(appSession().settings, next);
    if (!warning) {
      apply(next);
      return;
    }
    askToConfirm(this, warning.title, warning.sentence, warning.confirmLabel, () => {
      if (this.#motion.leaving) return;
      apply(next);
    });
  }

  #toggle(row: SettingsRowInfo): void {
    const next = nextSettingsAfterToggle(appSession().settings, row.id, drawnDensity());
    this.#afterWarning(next, (applied) => this.#applyToggle(row, applied));
  }

  #applyToggle(row: SettingsRowInfo, next: Settings): void {
    if (row.id === "sharper-text") applyTextResolution(next);
    if (row.id === "discord-presence") syncDiscordPresence(next.discordPresence);
    if (row.id === "sound" || row.id === "music-shuffle") appSession().music?.syncSettings(next);
    appSession().settings = next;
    applyEarnedItems();
    this.#draw();
  }

  /** Shows another tab, from its top. */
  #setTab(id: SettingsTabId): void {
    if (id === lastTab) return;
    lastTab = id;
    this.#bodyFromTop = true;
    this.#draw();
  }

  #draw(): void {
    // Already fading out for the ✕/Escape close — a redraw mid-fade (a toggle
    // fired just before it, a resize) would only flash new chrome under it.
    if (this.#motion.leaving) return;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#tabs?.destroy();
    this.#tabs = null;
    this.#resultsList?.destroy();
    this.#resultsList = null;
    // The field outlives a redraw: rebuilding a DOM <input> mid-keystroke would drop the caret.
    const kept = this.#searchInput?.gameObjects ?? [];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);

    const { width, height } = this.scale.gameSize;
    const settings = appSession().settings;
    const guideRows = guideRowInfoOf(guidePrefs());
    const items = this.#itemsOf(settings, guideRows);
    const tabs = this.#tabsOf(width, height, settings, guideRows);
    const active = tabs.find((tab) => tab.id === lastTab) ?? tabs[0]!;
    // With something typed the results replace the rows; until then the tab stays under the field.
    const results = this.#searchOpen ? this.#searchResults : null;
    const layout = settingsLayout(
      { x: 0, y: 0, width, height },
      (results ? [] : active.sections).map((section) => ({
        id: section.id,
        // A tab's only section is already named by the tab itself.
        title: active.sections.length > 1 ? section.title : "",
        items: section.items.flatMap((id) => {
          const item = items.get(id);
          return item ? [item.spec] : [];
        }),
      })),
    );

    // Swallows every press that lands on no control of this overlay's own. Without it, lifting a finger after a
    // touch scroll over the panel's blank space reached Title underneath and opened its releases link (owner,
    // 2026-10-16), and the same went for Pause or the Board.
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    const panelsFrom = this.children.list.length;
    const panel = this.add.graphics();
    panel
      .fillStyle(surface.ink.hex, 1)
      .fillRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    panel
      .lineStyle(4, surface.paper.hex, 1)
      .strokeRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    const rule = this.add.graphics();
    rule
      .fillStyle(surface.paper.hex, 0.4)
      .fillRect(layout.header.x, layout.header.y + layout.header.height - 2, layout.header.width, 2);

    const stops = new Map<string, FocusStop>();
    const closeSize = 32;
    const closeRect: Rect = {
      x: layout.header.x + layout.header.width - closeSize - 16,
      y: layout.header.y + (layout.header.height - closeSize) / 2,
      width: closeSize,
      height: closeSize,
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "✕",
        type: typeRole.rowTitle,
        rect: closeRect,
        onClick: () => this.#close(),
      }),
    );
    stops.set("back", { rect: closeRect, activate: () => this.#close() });
    const searchRect: Rect = { ...closeRect, x: closeRect.x - SEARCH_GAP - closeSize };
    drawSearchToggle(
      this,
      searchRect,
      "search-toggle",
      this.#searchOpen,
      () => this.#toggleSearch(),
      this.#buttons,
      stops,
    );
    const title = this.add
      .text(
        layout.header.x + 16,
        layout.header.y + layout.header.height / 2,
        caseOf(typeRole.barTitle, t("settings.title")),
        {
          ...textStyle(typeRole.barTitle, surface.paper.hex),
          fontSize: "24px",
        },
      )
      .setOrigin(0, 0.5);
    // The dark mode toggle (#459) sits in the header's middle, clear of the title on the left and the pad hints and
    // the search and close buttons on the right, rather than floating over the panel's top border. Past the title
    // where the middle would run into it.
    const themeX = Math.max(
      Math.round(layout.header.x + layout.header.width / 2 - 19),
      Math.round(title.x + title.width + 12),
    );
    setThemeSlot(this.scene.key, {
      x: themeX,
      y: Math.round(layout.header.y + (layout.header.height - 30) / 2),
      width: 38,
      height: 30,
    });

    this.#hints.reset();
    const searchInset = closeSize + 32 + SEARCH_GAP + closeSize + 8;
    this.#hints.custom(
      (set, snapshot) => (set === "pad" ? specsForShortcuts(["inspect"], snapshot) : null),
      22,
      ({ width }) => glyphRightInRow(layout.panel, layout.header.y, layout.header.height, width, searchInset),
    );
    if (this.#searchOpen) {
      this.#searchInput = drawSearchField(
        this,
        layout.tabs,
        "search-field",
        "",
        t("settings.searchPlaceholder"),
        (value) => this.#onSearchChange(value),
        this.#searchInput,
        stops,
      );
      this.#tabIds = [];
    } else {
      this.#tabs = new McTabs(this, {
        rect: layout.tabs,
        tabs: tabs.map((tab) => ({ id: tab.id, label: tab.label })),
        activeId: active.id,
        onSelect: (id) => this.#setTab(id as SettingsTabId),
      });
      this.#tabIds = tabs.map((tab) => tab.id);
      this.#hints.custom(
        (set, snapshot) => (set === "pad" ? specsForShortcuts(["zonePrevious", "zoneNext"], snapshot) : null),
        22,
        ({ width }) => {
          const place = glyphRightInRow(
            layout.panel,
            layout.header.y,
            layout.header.height,
            width,
            searchInset + HINT_GAP,
          );
          // A phone's title bar has no room beside the dark mode toggle: the tabs still take LB / RB without it.
          return place.x < themeX + 38 + 4 ? null : place;
        },
      );
      const cellWidth = layout.tabs.width / tabs.length;
      tabs.forEach((tab, index) => {
        stops.set(`tab:${tab.id}`, {
          rect: {
            x: layout.tabs.x + index * cellWidth,
            y: layout.tabs.y,
            width: cellWidth,
            height: layout.tabs.height,
          },
          activate: () => this.#setTab(tab.id),
        });
      });
    }

    // The open list holds the keyboard; the field is a DOM element over it.
    this.#searchInput?.setVisible(!this.#resolutionListOpen);
    const stopIds = results
      ? this.#drawResults(layout.bodyRoom, results, stops)
      : this.#drawBody(layout.bodyViewport, layout.content, items, stops).map((id) => `row:${id}`);
    const head = this.#searchOpen ? ["search-field"] : tabs.map((tab) => `tab:${tab.id}`);
    // A kept field's ring was first on the list, under the panel drawn since.
    for (const node of kept) this.children.bringToTop(node);
    if (this.#resolutionListOpen) {
      // While the list is open it owns the pad and keyboard: the route holds only its sizes, so the d-pad never
      // reaches the rows behind it. A picks and closes, B closes unchanged.
      const listStops = new Map<string, FocusStop>();
      const listIds = this.#drawResolutionList({ x: 0, y: 0, width, height }, listStops);
      this.#route?.set(listIds, listStops);
    } else {
      this.#route?.set(["back", "search-toggle", ...head, ...stopIds], stops);
    }
    this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.slice(panelsFrom) });
    this.#body?.follow(panel);
    // The search's results are still drawn in Phaser, under the DOM: the body steps aside while they show.
    this.#body?.setHidden(results !== null);
  }

  /** The ranked results, in the room the rows had, or a line saying there are none. Returns their stops in order. */
  #drawResults(room: Rect, results: readonly SettingsSearchResult[], stops: Map<string, FocusStop>): readonly string[] {
    if (results.length === 0) {
      this.add
        .text(room.x, room.y + 14, t("settings.noResults"), textStyle(typeRole.body, surface.paper.hex, 0.8))
        .setFontSize(12);
      return [];
    }
    const list = new McVirtualList(this, {
      rect: room,
      rowHeight: SEARCH_RESULT_ROW_HEIGHT,
      count: results.length,
      scroll: this.#resultsScroll,
      background: false,
      renderRow: (index, rect) => drawSearchResultRow(this, rect, results[index]!),
      onRowActivate: (index) => this.#openResult(results[index]!.entry),
    });
    this.#resultsList = list;
    return results.map(({ entry }, index) => {
      const key = `result:${entry.id}`;
      stops.set(key, {
        rect: () => list.rectFor(index),
        view: room,
        activate: () => this.#openResult(entry),
        ensureVisible: () => list.scrollIntoView(index),
      });
      return key;
    });
  }

  /**
   * Every row this screen can draw, keyed by its id in `view/settings-sections.ts`: the shape `settingsLayout` sizes
   * it by, and how to draw it once placed. Each `draw` registers its own focus stops and returns their ids in order.
   */
  #itemsOf(settings: Settings, guideRows: readonly GuideRowInfo[]): ReadonlyMap<SettingsItemId, SettingsItem> {
    const items = new Map<SettingsItemId, SettingsItem>();
    for (const row of [
      ...settingsRowInfoOf(settings, powerSavingOn()),
      ...(hasDesktopWindow() ? [discordRowInfoOf(settings)] : []),
      liveWatchRowInfoOf(settings),
      deckCopyLimitsRowInfoOf(settings),
      showPreconDecksRowInfoOf(settings),
      extraModularSetsRowInfoOf(settings),
      fadedCampaignArtRowInfoOf(settings),
      customUnlockedRowInfoOf(settings),
      manualAdjustRowInfoOf(settings),
      ...earnedItemRowInfoOf(settings, earnedItems()),
    ]) {
      items.set(row.id, {
        title: row.title,
        detail: row.unavailable ?? row.detail,
        spec: { kind: "toggle", id: row.id, detail: row.unavailable ?? row.detail },
        draw: (item, stops) => {
          this.#drawRow(item.row, row, item.slot, stops);
          return [row.id];
        },
      });
    }

    const segmented = <V extends string>(
      id: SettingsItemId,
      info: SegmentedInfo<V>,
      controlWidth: number,
      choose: (value: V) => void,
    ): void => {
      items.set(id, {
        title: info.title,
        detail: info.detail,
        spec: { kind: "segmented", id, detail: info.detail, controlWidth },
        draw: (item, stops) => {
          this.#drawSegmentedRow(item, info, id, stops, choose);
          return info.options.map((o) => `${id}:${o.value}`);
        },
      });
    };
    segmented("inspect-card", inspectCardRowInfoOf(settings), CARD_HOVER_CONTROL_WIDTH, (v) => this.#setInspectCard(v));
    segmented("card-hover", cardHoverRowInfoOf(settings), CARD_HOVER_CONTROL_WIDTH, (v) => this.#setCardHover(v));
    // The game's mixer volume shows once read (`create` reads it); 100 until then, the mixer's own default.
    segmented("game-volume", gameVolumeRowInfoOf(knownMixerVolume() ?? 100), CARD_HOVER_CONTROL_WIDTH, (v) => {
      writeMixerVolume(Number(v));
      this.#draw();
    });
    const setVolume = (next: Settings): void => {
      appSession().music?.syncSettings(next);
      appSession().settings = next;
      this.#draw();
    };
    segmented("music-volume", musicVolumeRowInfoOf(settings, followsWindowsMixer()), CARD_HOVER_CONTROL_WIDTH, (v) =>
      setVolume(nextSettingsAfterMusicVolume(appSession().settings, v)),
    );
    segmented("effects-volume", effectsVolumeRowInfoOf(settings), CARD_HOVER_CONTROL_WIDTH, (v) => {
      setVolume(nextSettingsAfterEffectsVolume(appSession().settings, v));
      // A sample at the new level.
      appSession().music?.playEffect("basic-attack");
    });
    segmented("online-name", onlineNameRowInfoOf(settings), CARD_HOVER_CONTROL_WIDTH, () => {
      this.scene.launch(SCENES.onlineName, { onDone: () => this.#redrawIfOpen() } satisfies OnlineNameData);
    });
    segmented("card-language", cardLanguageRowInfoOf(settings), SPEED_CONTROL_WIDTH, (v) => this.#setCardLanguage(v));
    segmented("card-size", cardSizeRowInfoOf(settings), CARD_SIZE_CONTROL_WIDTH, (v) => this.#setCardSize(v));
    segmented("scheme-fan-background", schemeFanBackgroundRowInfoOf(settings), CARD_SIZE_CONTROL_WIDTH, (v) => {
      appSession().settings = nextSettingsAfterSchemeFanBackground(appSession().settings, v);
      this.#draw();
    });
    segmented("play-area-order", playAreaOrderRowInfoOf(settings), CARD_SIZE_CONTROL_WIDTH, (v) => {
      appSession().settings = nextSettingsAfterPlayAreaOrder(appSession().settings, v);
      this.#draw();
    });
    segmented("fade-color", fadeColorRowInfoOf(settings), CARD_SIZE_CONTROL_WIDTH, (v) => {
      appSession().settings = nextSettingsAfterFadeColor(appSession().settings, v);
      this.#draw();
    });
    segmented("token-motion", tokenMotionRowInfoOf(settings), CARD_SIZE_CONTROL_WIDTH, (v) => this.#setTokenMotion(v));
    segmented("deck-signature", deckSignatureRowInfoOf(settings), CARD_HOVER_CONTROL_WIDTH, (v) => {
      appSession().settings = nextSettingsAfterDeckSignature(appSession().settings, v);
      this.#draw();
    });
    segmented("undo-past-turn", undoPastTurnRowInfoOf(settings), CARD_HOVER_CONTROL_WIDTH, (v) =>
      this.#afterWarning(nextSettingsAfterUndoPastTurn(appSession().settings, v), (next) => {
        appSession().settings = next;
        this.#draw();
      }),
    );
    segmented("deck-list-on-open", deckListOnOpenRowInfoOf(settings), CARD_SIZE_CONTROL_WIDTH, (v) => {
      appSession().settings = nextSettingsAfterDeckListOnOpen(appSession().settings, v);
      this.#draw();
    });
    const promoShown = heroPromoShown(earnedPromoSets(), settings.promoArtOn);
    segmented("hero-art", heroArtRowInfoOf(settings, promoShown), CARD_HOVER_CONTROL_WIDTH, (v) => {
      appSession().settings = nextSettingsAfterHeroArt(appSession().settings, v);
      this.#draw();
    });
    segmented("custom-placement", customPlacementRowInfoOf(settings), CARD_HOVER_CONTROL_WIDTH, (v) => {
      appSession().settings = nextSettingsAfterCustomPlacement(appSession().settings, v);
      this.#draw();
    });
    // The achievement popup: picking a time or a position shows a sample there (`scenes/achievement-toast.ts`).
    const setPopup = (next: Settings): void => {
      appSession().settings = next;
      this.#draw();
      (this.scene.get(SCENES.achievementToast) as AchievementToastScene | null)?.preview();
    };
    segmented("achievement-popup-time", achievementPopupTimeRowInfoOf(settings), POPUP_TIME_CONTROL_WIDTH, (v) =>
      setPopup(nextSettingsAfterAchievementPopupTime(appSession().settings, v)),
    );
    segmented("achievement-popup-place", achievementPopupPlaceRowInfoOf(settings), POPUP_PLACE_CONTROL_WIDTH, (v) =>
      setPopup(nextSettingsAfterAchievementPopupPlace(appSession().settings, v)),
    );
    segmented("achievement-popup-size", achievementPopupSizeRowInfoOf(settings), POPUP_SIZE_CONTROL_WIDTH, (v) =>
      setPopup(nextSettingsAfterAchievementPopupSize(appSession().settings, v)),
    );
    if (screenSettingsShown()) {
      // The game's own size (inside the safe area) at each choice: the pixels it actually draws.
      const { width, height } = this.scale.gameSize;
      const screen = { width, height, devicePixelRatio: globalThis.devicePixelRatio || 1 };
      const setScreen = (next: Settings): void => {
        appSession().settings = next;
        applyScreenSettings(this.game, next);
        this.#draw();
      };
      const advice = screenAdviceOf();
      // A 1x screen has nothing below Native to offer, so the row is left out there.
      const scaleInfo = renderScaleRowInfoOf(settings, screen, advice);
      if (renderScaleRowShown(scaleInfo)) {
        segmented("render-scale", scaleInfo, SCREEN_CONTROL_WIDTH, (v) =>
          setScreen(nextSettingsAfterRenderScale(appSession().settings, v)),
        );
      }
      segmented(
        "frame-rate",
        frameRateRowInfoOf(settings, knownRefreshInfo()?.maxRefreshRate ?? null, powerSavingOn(), advice),
        SCREEN_CONTROL_WIDTH,
        (v) => setScreen(nextSettingsAfterFrameRate(appSession().settings, v)),
      );
    }
    if (couchModeShown(this.game, settings)) {
      segmented("couch-mode", couchModeRowInfoOf(settings, couchBaseOf(this.game)), COUCH_MODE_CONTROL_WIDTH, (v) => {
        const next = nextSettingsAfterCouchMode(appSession().settings, v);
        appSession().settings = next;
        applyScreenSettings(this.game, next);
        this.#draw();
      });
    }
    if (hasDesktopWindow()) {
      const monitor = desktopMonitor();
      const sizes = monitor === null ? [] : resolutionOptionsFor(monitor, settings.displayMode);
      segmented("display-mode", displayModeRowInfoOf(settings), DISPLAY_MODE_CONTROL_WIDTH, (v) => {
        this.#pendingResolution = null;
        this.#setWindow(nextSettingsAfterDisplayMode(appSession().settings, v));
      });
      const sizeInfo = resolutionRowInfoOf(settings, sizes, monitor, monitor?.displayModes !== undefined);
      items.set("resolution", {
        title: sizeInfo.title,
        detail: sizeInfo.detail,
        spec: {
          kind: "segmented",
          id: "resolution",
          detail: sizeInfo.detail,
          controlWidth: RESOLUTION_CONTROL_WIDTH,
        },
        draw: (item, stops) => {
          this.#drawResolutionRow(item, sizeInfo, stops);
          return ["resolution:field", "resolution:apply"];
        },
      });
    }

    const villain = villainRowInfoOf(settings);
    items.set("villain-auto", {
      title: villain.autoAdvance.title,
      detail: villain.autoAdvance.detail,
      spec: {
        kind: "tiles",
        id: "villain-auto",
        detail: villain.autoAdvance.detail,
        count: villain.autoAdvance.options.length,
      },
      draw: (item, stops) => {
        this.#drawVillainAuto(item, villain, stops);
        return villain.autoAdvance.options.map((o) => `villain-auto:${o.value}`);
      },
    });
    segmented("villain-flip-speed", villain.flipSpeed, SPEED_CONTROL_WIDTH, (v) =>
      this.#setVillain("villain-flip-speed", v),
    );
    segmented("villain-speed", villain.beatSpeed, SPEED_CONTROL_WIDTH, (v) => this.#setVillain("villain-speed", v));
    for (const [id, row] of [
      ["villain-hold", villain.hold],
      ["villain-flip", villain.flip],
      ["villain-dock", villain.dock],
      ["power-saving", powerSavingRowOf(settings, powerSavingState().detected)],
    ] as const) {
      items.set(id, {
        title: row.title,
        detail: row.detail,
        spec: { kind: "toggle", id, detail: row.detail },
        draw: (item, stops) => {
          this.#drawVillainToggle(item.row, id, row, item.slot, stops);
          return [id];
        },
      });
    }

    for (const row of guideRows) {
      if (row.kind === "segmented") {
        items.set(row.id, {
          title: row.title,
          detail: guideLevelSearchDetail(),
          spec: { kind: "level", id: row.id },
          draw: (item, stops) => {
            this.#drawGuideLevelRow(item.row, row, item.slot, stops);
            return row.options.map((option) => `guide-level:${option.value}`);
          },
        });
      } else {
        items.set(row.id, {
          title: row.title,
          detail: guideRowDetailOf(row),
          spec: { kind: "toggle", id: row.id, detail: guideRowDetailOf(row) },
          draw: (item, stops) => {
            this.#drawGuideRow(item.row, row, item.slot, stops);
            return [row.id];
          },
        });
      }
    }

    const door = (id: SettingsItemId, title: string, detail: string, open: () => void): void => {
      items.set(id, {
        title,
        detail,
        spec: { kind: "toggle", id, detail },
        draw: (item, stops) => {
          this.#drawDoorRow(item.row, id, title, detail, item.slot, stops, open);
          return [id];
        },
      });
    };
    door(UNLOCKS_ROW, t("settings.unlocks.title"), unlocksSummaryOf(unlocks()), () => this.#openUnlocks());
    door(STATS_ROW, t("settings.stats.title"), statsRowDetail(), () => this.#openStats());
    door(SAVE_DATA_ROW, saveDataRowTitle(), saveDataRowDetail(), () => this.#openSaveData());
    door(CONTROLS_ROW, t("settings.controls.title"), controlsRowDetail(), () => this.#openControls());
    door(RULES_ROW, rulesRowTitle(), rulesRowDetail(), () => this.#openRules());
    door("steam-install", steamInstallRowTitle(), steamInstallRowDetail(), () => this.#openSteamUpdate());
    items.set("steam-add", {
      title: t("steamAdd.row.title"),
      detail: t("steamAdd.row.detail"),
      spec: { kind: "toggle", id: "steam-add", detail: t("steamAdd.row.detail") },
      draw: (item, stops) => {
        const open = (): void => this.#openSteamAdd();
        const title = t("steamAdd.row.title");
        this.#drawDoorRow(
          item.row,
          "steam-add",
          title,
          t("steamAdd.row.detail"),
          item.slot,
          stops,
          open,
          t("steamAdd.row.open"),
        );
        return ["steam-add"];
      },
    });
    items.set("steam-deck", {
      title: "Steam Deck",
      detail: steamDeckDetail(),
      spec: { kind: "toggle", id: "steam-deck", detail: steamDeckDetail() },
      draw: (item, stops) => {
        const use = (): void => {
          this.#pendingResolution = null;
          this.#setWindow({ ...appSession().settings, ...HANDHELD_DISPLAY });
        };
        this.#drawDoorRow(
          item.row,
          "steam-deck",
          "Steam Deck",
          steamDeckDetail(),
          item.slot,
          stops,
          use,
          t("settings.use"),
        );
        return ["steam-deck"];
      },
    });
    return items;
  }

  /** A stop inside the body scroll region: its rect tracks the current scroll offset, and taking focus scrolls it into view. */
  #bodyStop(elementKey: string, activate: () => void, rowKey?: string): FocusStop {
    const element = (): HTMLElement | null => this.#body?.element.elementOf(elementKey) ?? null;
    return {
      rect: () => {
        const found = element();
        return found && this.#body ? this.#body.rectOf(found) : { x: 0, y: 0, width: 0, height: 0 };
      },
      view: () => this.#body?.rect ?? { x: 0, y: 0, width: 0, height: 0 },
      activate,
      ensureVisible: () => {
        if (rowKey && rowKey !== elementKey)
          this.#body?.element.elementOf(rowKey)?.scrollIntoView({ block: "nearest" });
        element()?.scrollIntoView({ block: "nearest" });
      },
    };
  }

  /**
   * The whole body — every section's heading and rows (`view/settings-sections.ts`) — inside one scroll region
   * (docs/guided-mode.md §4 G2b; `view/settings-layout.ts`'s own doc comment says why it's one region). Returns every
   * focus stop id in draw order.
   */
  #drawBody(
    viewport: Rect,
    content: SettingsContentLayout,
    items: ReadonlyMap<SettingsItemId, SettingsItem>,
    stops: Map<string, FocusStop>,
  ): readonly string[] {
    if (!this.#body) {
      const element = document.createElement("mc-settings-body");
      element.addEventListener("mc-activate", (event) => {
        // Closing already (its exit is playing): a second tap must not change a setting or open another screen.
        if (this.#motion.leaving) return;
        this.#bodyActions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      this.#body = new DomRegion(this, element, viewport);
    }
    const body = this.#body;
    body.setRect(viewport);
    this.#bodyActions = new Map();
    this.#bodyRows = [];
    this.#bodyList = null;
    this.#bodyOrigin = { x: viewport.x, y: viewport.y };

    const stopIds: string[] = [];
    const headings: { rect: BodyRect; title: string }[] = [];
    for (const section of content.sections) {
      if (section.heading) headings.push({ rect: this.#bodyRect(section.heading), title: section.title });
      for (const item of section.items) {
        const entry = items.get(item.id as SettingsItemId);
        if (!entry) continue;
        const ids = entry.draw(item, stops);
        if (ids[0] !== undefined) this.#firstStopOf.set(item.id, ids[0]);
        stopIds.push(...ids);
      }
    }
    body.element.model = {
      height: content.totalHeight,
      headings,
      rows: this.#bodyRows,
      ...(this.#bodyList ? { list: this.#bodyList } : {}),
    };
    renderNow(body.element);
    const scroller = body.element.scroller;
    if (this.#bodyFromTop && scroller) scroller.scrollTop = 0;
    this.#bodyFromTop = false;
    if (this.#bodyList)
      body.element.elementOf(`list:${this.#resolutionPickedIndex()}`)?.scrollIntoView({ block: "nearest" });
    return stopIds;
  }

  /** A layout rect (content space, screen `x`) as the body places it: `x` from the body's own left edge. */
  #bodyRect(rect: Rect): BodyRect {
    return { x: rect.x - this.#bodyOrigin.x, y: rect.y, width: rect.width, height: rect.height };
  }

  /** Adds a row to the body: what each of its keys does, and its focus stops (`stops`: stop key to element key). */
  #addBodyRow(
    row: BodyRow,
    actions: Readonly<Record<string, () => void>>,
    stops: Map<string, FocusStop>,
    stopKeys: Readonly<Record<string, string>>,
  ): void {
    this.#bodyRows.push(row);
    for (const [key, action] of Object.entries(actions)) this.#bodyActions.set(key, action);
    for (const [stop, elementKey] of Object.entries(stopKeys)) {
      const action = actions[elementKey] ?? actions[row.rowKey ?? ""] ?? Object.values(actions)[0];
      stops.set(
        stop,
        this.#bodyStop(elementKey, () => action?.(), row.key),
      );
    }
  }

  /** A row's text: its title and a detail wrapping `width` wide (dimmer when it says why the row is unavailable). */
  #rowText(title: string | undefined, detail: string | undefined, width: number, dim = false) {
    return {
      ...(title !== undefined ? { title } : {}),
      ...(detail !== undefined ? { detail, detailWidth: width, detailDim: dim } : {}),
    };
  }

  /** A switch or door button in a row's 84px control slot. */
  #rowButton(
    key: string,
    row: Rect,
    look: { readonly label: string; readonly on?: boolean; readonly door?: boolean; readonly unavailable?: string },
  ): BodyControl {
    const on = look.on === true;
    return {
      kind: "button",
      key,
      rect: this.#bodyRect(controlRectOf(row)),
      label: look.label,
      look: look.door ? "secondary" : on ? "secondary" : "quiet",
      selected: on,
      framed: on && look.unavailable === undefined,
      ...(look.unavailable !== undefined ? { disabled: look.unavailable } : {}),
    };
  }

  #drawGuideLevelRow(
    rect: Rect,
    row: Extract<GuideRowInfo, { kind: "segmented" }>,
    _index: number,
    stops: Map<string, FocusStop>,
  ): void {
    const gap = 4;
    // A couple of spare pixels at the right, as the Phaser body kept clear of its mask edge.
    const EDGE_INSET = 2;
    const cellWidth = (rect.width - EDGE_INSET - gap * (row.options.length - 1)) / row.options.length;
    const actions: Record<string, () => void> = {};
    const stopKeys: Record<string, string> = {};
    const controls: BodyControl[] = row.options.map((option, i) => {
      const key = `guide-level:${option.value}`;
      actions[key] = () => this.#setGuideLevel(option.value);
      stopKeys[`row:${key}`] = key;
      return {
        kind: "cell",
        key,
        rect: this.#bodyRect({ x: rect.x + i * (cellWidth + gap), y: rect.y, width: cellWidth, height: rect.height }),
        label: option.label,
        detail: option.detail,
        selected: row.selected === option.value,
        fill: "caution",
      };
    });
    this.#addBodyRow({ key: `row:${row.id}`, rect: this.#bodyRect(rect), controls }, actions, stops, stopKeys);
  }

  /** "Lighter play in power saving": the session tells `platform/power-saving.ts`, and this redraws from its change. */
  #togglePowerSaving(): void {
    const settings = appSession().settings;
    appSession().settings = { ...settings, powerSavingAdjust: !settings.powerSavingAdjust };
    this.#draw();
  }

  #setVillain(id: VillainRowId, value?: VillainAutoAdvance | VillainBeatSpeed | FlipEncounterSpeed): void {
    appSession().settings = nextSettingsAfterVillainRow(appSession().settings, id, value);
    this.#draw();
  }

  #drawVillainAuto(item: SettingsItemLayout, villain: VillainRowsInfo, stops: Map<string, FocusStop>): void {
    const { autoAdvance } = villain;
    const rect = item.row;
    const actions: Record<string, () => void> = {};
    const stopKeys: Record<string, string> = {};
    const controls: BodyControl[] = autoAdvance.options.map((option, i) => {
      const key = `villain-auto:${option.value}`;
      actions[key] = () => this.#setVillain("villain-auto", option.value);
      stopKeys[`row:${key}`] = key;
      return {
        kind: "cell",
        key,
        rect: this.#bodyRect(item.tiles[i]!),
        label: option.label,
        detail: option.detail,
        selected: autoAdvance.selected === option.value,
        fill: "caution",
      };
    });
    this.#addBodyRow(
      {
        key: "row:villain-auto",
        rect: this.#bodyRect(rect),
        ...this.#rowText(autoAdvance.title, autoAdvance.detail, rect.width),
        controls,
      },
      actions,
      stops,
      stopKeys,
    );
  }

  #setCardHover(value: CardHoverScale): void {
    appSession().settings = nextSettingsAfterCardHover(appSession().settings, value);
    this.#draw();
  }

  #setInspectCard(value: InspectCard): void {
    appSession().settings = nextSettingsAfterInspectCard(appSession().settings, value);
    this.#draw();
  }

  #setCardLanguage(value: CardLanguage): void {
    // session.ts applies it to the art when the settings are assigned.
    appSession().settings = nextSettingsAfterCardLanguage(appSession().settings, value);
    this.#draw();
  }

  #setCardSize(value: CardSize): void {
    appSession().settings = nextSettingsAfterCardSize(appSession().settings, value);
    this.#draw();
  }

  /** A row with a title, its detail, and one segmented choice beside or (stacked) under the text. */
  #drawSegmentedRow<V extends string>(
    item: SettingsItemLayout,
    info: SegmentedInfo<V>,
    stopPrefix: string,
    stops: Map<string, FocusStop>,
    choose: (value: V) => void,
  ): void {
    const rect = item.row;
    const control = item.control!;
    const cellWidth = control.width / info.options.length;
    const actions: Record<string, () => void> = {};
    const stopKeys: Record<string, string> = {};
    const controls: BodyControl[] = info.options.map((option, i) => {
      const key = `${stopPrefix}:${option.value}`;
      actions[key] = () => choose(option.value);
      stopKeys[`row:${key}`] = key;
      return {
        kind: "cell",
        key,
        rect: this.#bodyRect({ x: control.x + i * cellWidth, y: control.y, width: cellWidth, height: control.height }),
        label: option.label,
        selected: info.selected === option.value,
        fill: "paper",
      };
    });
    this.#addBodyRow(
      {
        key: `row:${stopPrefix}`,
        rect: this.#bodyRect(rect),
        ...this.#rowText(info.title, info.detail, item.stacked ? rect.width : rect.width - control.width - 16),
        controls,
      },
      actions,
      stops,
      stopKeys,
    );
  }

  /** Saves a Window mode or size change and puts the window into it; redraws again once it lands (a new monitor). */
  #setWindow(next: Settings): void {
    appSession().settings = next;
    this.#draw();
    void applyDesktopWindow(next.displayMode, next.resolution).then(() => this.#redrawIfOpen());
  }

  /**
   * The Resolution row: a dropdown field showing the resolution picked (pending, until applied) and an Apply button
   * that is live only while the pick differs from what is in effect. The open list draws over everything
   * (`#drawResolutionList`), from the field's own position on screen.
   */
  #drawResolutionRow(item: SettingsItemLayout, info: SegmentedInfo<Resolution>, stops: Map<string, FocusStop>): void {
    const rect = item.row;
    const control = item.control!;
    const picked = this.#pendingResolution ?? info.selected;
    const field: Rect = { x: control.x, y: control.y, width: control.width - APPLY_WIDTH - 8, height: control.height };
    const apply: Rect = { x: field.x + field.width + 8, y: control.y, width: APPLY_WIDTH, height: control.height };
    // How far the body is scrolled, so the open list goes under the field only when it shows there.
    const scrolled = this.#body?.element.scroller?.scrollTop ?? 0;
    this.#resolutionInfo = info;
    const open = (): void => {
      this.#resolutionListOpen = true;
      this.#draw();
    };
    const pending = this.#pendingResolution !== null && this.#pendingResolution !== info.selected;
    const activateApply = (): void => {
      if (this.#pendingResolution === null) return;
      const next = nextSettingsAfterResolution(appSession().settings, this.#pendingResolution);
      this.#pendingResolution = null;
      this.#setWindow(next);
    };
    this.#addBodyRow(
      {
        key: "row:resolution",
        rect: this.#bodyRect(rect),
        ...this.#rowText(info.title, info.detail, item.stacked ? rect.width : rect.width - control.width - 16),
        controls: [
          {
            kind: "field",
            key: "resolution:field",
            rect: this.#bodyRect(field),
            label: info.options.find((option) => option.value === picked)?.label ?? "",
          },
          {
            kind: "button",
            key: "resolution:apply",
            rect: this.#bodyRect(apply),
            label: t("settings.apply"),
            look: pending ? "primary" : "secondary",
            ...(pending ? {} : { disabled: true as const }),
          },
        ],
      },
      {
        "resolution:field": () => {
          open();
          this.#route?.focusKey(`list:${this.#resolutionPickedIndex()}`);
        },
        "resolution:apply": activateApply,
      },
      stops,
      { "row:resolution:field": "resolution:field", "row:resolution:apply": "resolution:apply" },
    );
    // A tap on the field opens the list without moving the ring into it; the pad's A does both.
    this.#bodyActions.set("resolution:field", open);
    if (this.#resolutionListOpen) {
      const visible = Math.min(info.options.length, LIST_VISIBLE_ROWS);
      const height = visible * LIST_ROW_HEIGHT + 4;
      const viewport = this.#body?.rect.height ?? 0;
      const below = field.y + field.height + height <= scrolled + viewport - 8;
      const box: Rect = {
        x: field.x,
        y: below ? field.y + field.height + 2 : field.y - height - 2,
        width: field.width,
        height,
      };
      this.#bodyList = {
        rect: this.#bodyRect(box),
        rowHeight: LIST_ROW_HEIGHT,
        closeKey: "list:close",
        options: info.options.map((option, i) => ({
          key: `list:${i}`,
          label: option.label,
          selected: option.value === picked,
        })),
      };
      this.#bodyActions.set("list:close", () => this.#closeResolutionList());
      info.options.forEach((option, i) =>
        this.#bodyActions.set(`list:${i}`, () => {
          this.#pickResolution(option.value);
          this.#closeResolutionList();
        }),
      );
    }
  }

  /** Index in the open list of the size shown as picked (the pending one, else the one in effect). */
  #resolutionPickedIndex(): number {
    const info = this.#resolutionInfo;
    if (info === null) return 0;
    const picked = this.#pendingResolution ?? info.selected;
    return Math.max(
      0,
      info.options.findIndex((option) => option.value === picked),
    );
  }

  /** Closes the list; `refocus` (pad or keyboard) puts the ring back on the field it opened from. */
  #closeResolutionList(refocus = false): void {
    this.#resolutionListOpen = false;
    this.#draw();
    if (refocus) this.#route?.focusKey("row:resolution:field");
  }

  /**
   * The open Resolution list: up to `LIST_VISIBLE_ROWS` rows under the field (over it when there's no room below),
   * scrolling for the rest. A press anywhere else closes it without a change; picking a row makes it the pending
   * choice, which Apply then puts into effect.
   */
  #drawResolutionList(bounds: Rect, stops: Map<string, FocusStop>): string[] {
    const info = this.#resolutionInfo;
    if (info === null) return [];
    // A tap outside the body (the header, the tabs) closes the list too; inside the body its backdrop does. A tap, not
    // a bare release: a swipe that lifts over the header must leave the list open (CLAUDE.md, no tap on finger lift).
    const outside = this.add.zone(0, 0, bounds.width, bounds.height).setOrigin(0, 0).setInteractive();
    onTap(outside, () => this.#closeResolutionList(), "resolution-list-outside");
    return info.options.map((option, i) => {
      const key = `list:${i}`;
      stops.set(
        key,
        this.#bodyStop(key, () => {
          this.#pickResolution(option.value);
          this.#closeResolutionList(true);
        }),
      );
      return key;
    });
  }

  /** Makes `value` the pending Resolution, which Apply puts into effect (none when it is already the one in effect). */
  #pickResolution(value: Resolution): void {
    const info = this.#resolutionInfo;
    this.#pendingResolution = info !== null && value === info.selected ? null : value;
  }

  #setTokenMotion(value: FirstPlayerTokenMotion): void {
    appSession().settings = nextSettingsAfterTokenMotion(appSession().settings, value);
    this.#draw();
  }

  #drawVillainToggle(
    rect: Rect,
    id: "villain-hold" | "villain-flip" | "villain-dock" | "power-saving",
    row: { readonly title: string; readonly detail: string; readonly on: boolean },
    _index: number,
    stops: Map<string, FocusStop>,
  ): void {
    const activate = (): void => (id === "power-saving" ? this.#togglePowerSaving() : this.#setVillain(id));
    this.#addBodyRow(
      {
        key: `row:${id}`,
        rect: this.#bodyRect(rect),
        ...this.#rowText(row.title, row.detail, rect.width - 100),
        rowKey: id,
        controls: [
          this.#rowButton(id, rect, { label: row.on ? t("settings.toggleOn") : t("settings.toggleOff"), on: row.on }),
        ],
      },
      { [id]: activate },
      stops,
      { [`row:${id}`]: `row:${id}` },
    );
  }

  #drawGuideRow(rect: Rect, row: GuideNonLevelRow, _index: number, stops: Map<string, FocusStop>): void {
    const activate = (): void => this.#activateGuideRow(row);
    const unavailable = row.kind === "action" ? row.unavailable : undefined;
    const on = row.kind === "toggle" && row.on;
    this.#addBodyRow(
      {
        key: `row:${row.id}`,
        rect: this.#bodyRect(rect),
        ...this.#rowText(row.title, guideRowDetailOf(row), rect.width - 100, unavailable !== undefined),
        ...(unavailable === undefined ? { rowKey: row.id } : {}),
        controls: [
          this.#rowButton(row.id, rect, {
            label: unavailable
              ? "—"
              : row.kind === "toggle"
                ? row.on
                  ? t("settings.toggleOn")
                  : t("settings.toggleOff")
                : t("settings.open"),
            on,
            ...(unavailable !== undefined ? { unavailable } : {}),
          }),
        ],
      },
      { [row.id]: activate },
      stops,
      { [`row:${row.id}`]: `row:${row.id}` },
    );
  }

  #setGuideLevel(level: GuideLevel): void {
    setGuidePrefs(nextGuidePrefsAfterRow(guidePrefs(), "guide-level", level));
    this.#draw();
  }

  #activateGuideRow(row: GuideNonLevelRow): void {
    if (row.kind === "action") {
      // Both actions open the same "How to play" hub (`scenes/how-to-play.ts`) — "Play the tutorial" at THE
      // BASICS, "Aspect lessons" (G10c) at ASPECTS, same screen either way.
      if (row.id === "play-tutorial" || row.id === "aspect-lessons") this.#openHowToPlay();
      return;
    }
    setGuidePrefs(nextGuidePrefsAfterRow(guidePrefs(), row.id));
    this.#draw();
  }

  /** A title, a detail line and an "Open ▸" button that opens another screen — the Unlocks, Save data and Rules rows. */
  #drawDoorRow(
    rect: Rect,
    id: string,
    title: string,
    detail: string,
    _index: number,
    stops: Map<string, FocusStop>,
    activate: () => void,
    buttonLabel = t("settings.open"),
  ): void {
    this.#addBodyRow(
      {
        key: `row:${id}`,
        rect: this.#bodyRect(rect),
        ...this.#rowText(title, detail, rect.width - 100),
        controls: [this.#rowButton(id, rect, { label: buttonLabel, door: true })],
      },
      { [id]: activate },
      stops,
      { [`row:${id}`]: `row:${id}` },
    );
  }

  #drawRow(rect: Rect, row: SettingsRowInfo, _index: number, stops: Map<string, FocusStop>): void {
    const activate = (): void => this.#toggle(row);
    this.#addBodyRow(
      {
        key: `row:${row.id}`,
        rect: this.#bodyRect(rect),
        ...this.#rowText(row.title, row.unavailable ?? row.detail, rect.width - 100, row.unavailable !== undefined),
        ...(row.unavailable === undefined ? { rowKey: row.id } : {}),
        controls: [
          this.#rowButton(row.id, rect, {
            label: row.unavailable ? "—" : row.on ? t("settings.toggleOn") : t("settings.toggleOff"),
            on: row.on,
            ...(row.unavailable !== undefined ? { unavailable: row.unavailable } : {}),
          }),
        ],
      },
      { [row.id]: activate },
      stops,
      { [`row:${row.id}`]: `row:${row.id}` },
    );
  }
}
