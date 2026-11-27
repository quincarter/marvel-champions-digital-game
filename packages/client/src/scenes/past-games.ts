/**
 * Past games (issue #706): every finished game saved on this device, newest first, to look over and then watch again
 * as a replay, share as a link, or export as a replay file or a game log. Reached from the Title's "Past games" button;
 * Back returns there.
 *
 * Which games are listed, what a row says and where everything sits is `view/past-games-model.ts`'s. Each row pictures
 * the villain and the heroes (every picture opens the card hover popover under a resting mouse) and says how the game
 * went: won or lost and why, the rounds, and which heroes fell and which stood. A tap on a row opens its details: in a
 * side panel beside the list on desktop and tablet (the newest game is shown there at first), in a popup over the list
 * on a phone. The details carry the larger pictures, each hero's damage and thwart, and the four actions: Watch (opens
 * the game on the board as a replay; the transport's Exit comes back here), Share link, Export (the `.mcreplay` file)
 * and Log (the game log as text). Share, Export and Log open the game in a replay worker of their own just long enough
 * to write the file. A shared link is kept per game while the app runs: a second Share hands the same link out again.
 *
 * Filter tabs (All, Wins, Losses) sit above the list; LB / RB step them. "Open a replay file" in the top bar watches a
 * replay someone else made, as Extras does. A pad or keyboard walks Back, the tabs, the file button, the rows and the
 * details' actions; B (Escape) closes the phone's popup before it leaves the screen. The rows are tapped through the
 * list's own tap (a drag never selects), and every button is an `McButton`, so the end of a swipe that lifts over a row
 * or a button presses nothing (issue #227).
 */
import Phaser from "phaser";
import "@mc/ui";
import type { McSheet } from "@mc/ui";
import type { AnyCard } from "@mc/content";
import type { PackRuntime } from "../packs/pack-runtime.js";
import { onArtChange } from "../language-change.js";
import { artLanguageNow } from "../art/art-source.js";
import { heroSourceOf, villainSourceOf } from "../art/matchup-pictures.js";
import type { ArtSource } from "../art/art-source.js";
import { PictureLeases } from "../dom/picture-leases.js";
import { accent, border, hit, ink, signal, surface, typeRole, type TypeSpec } from "../tokens.js";

/** A label in the type of `typeRole.label` but written as given: the placeholder's name keeps its own case. */
const AS_WRITTEN_LABEL: TypeSpec = { ...typeRole.label, uppercase: false };
import { bangers, campaignFrame, drawTopBar } from "../ui/campaign-chrome.js";
import { HoverPreview, screenHoverArea } from "../ui/card-hover-preview.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { GlyphHints, specsForShortcuts } from "../ui/glyph-hints.js";
import { addPressShield } from "../ui/press-shield.js";
import { cssOf } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { McButton, McTabs, McTextInput } from "../ui/widgets.js";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { SheetBuilder } from "../dom/sheet-builder.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { isDesktopType } from "../ui/desktop-type.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { clipToView } from "../view/focus-list.js";
import type { Rect } from "../view/layout.js";
import { cardInPacks, PAST_GAME_NAMES, TRACKER_EXPORT_NAMES } from "../view/game-label-names.js";
import {
  PAST_GAME_ACTIONS,
  PAST_GAME_FILTERS,
  pastGameCounts,
  pastGameDetailParts,
  pastGameRowHeight,
  aspectsNotInName,
  aspectChipsOf,
  pastGameRowParts,
  pastGameRowsOf,
  pastGamesLayout,
  type PastGamesLayout,
  playedMinutesOf,
  seatFatesOf,
  type PastGameAction,
  type PastGameFilter,
  type PastGameRow,
} from "../view/past-games-model.js";
import { runTrackerExport } from "../view/tracker-export.js";
import { pastGamesFocusOrder } from "../view/screen-focus.js";
import type { SaveMeta } from "../engine/game-storage.js";
import { onLanguageChange } from "../language-change.js";
import { t, type MessageKey } from "../i18n/translate.js";
import { detectPlatform } from "../platform/platform.js";
import {
  deliverGameLog,
  deliverReplayFile,
  deliverTrackerCsv,
  openReplay,
  pickReplayFile,
  replayErrorKey,
} from "../replay/replay-files.js";
import { ReplayOpenError } from "../replay/replay-core.js";
import { exportPastGame, sharePastGame, type PastGameActionDeps } from "../replay/past-game-actions.js";
import { deliverReplayLink, isAbort, shareFailureKey, shareLinkOf } from "../replay/replay-share.js";
import { appSession, deckStorage } from "../session.js";
import { drawSearchField } from "./roster-panel.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { introReplay } from "./replay-entry.js";
import { drawOpenFileIcon } from "../ui/open-file-icon.js";
import { SCENES } from "./keys.js";

/** The widest the tabs, list and side panel run together. */
const CONTENT_MAX_WIDTH = 1220;
const TAB_HEIGHT = 44;
const ROW_GAP = 8;
/** The scrolling keys in the panel. */
const LIST = "list";
const DETAILS = "details";
/** How far a page (Page Up / Down, a shoulder button) scrolls, as a share of the scroller's height. */
const PAGE = 0.85;

const FILTER_LABEL: Readonly<Record<PastGameFilter, MessageKey>> = {
  all: "pastGames.filter.all",
  won: "pastGames.filter.won",
  lost: "pastGames.filter.lost",
};

const ACTION_LABEL: Readonly<Record<PastGameAction, MessageKey>> = {
  watch: "pastGames.watch",
  share: "pastGames.share",
  export: "pastGames.export",
  log: "pastGames.log",
};

/** What is running: an action on a game, or the file picker (`id` empty). One at a time. */
interface Busy {
  readonly id: string;
  readonly action: PastGameAction | "file" | "tracker";
}

/** What the last draw laid out, for the panel's own redraws (the list scrolling) and the focus stops. */
interface PanelContext {
  readonly width: number;
  readonly height: number;
  readonly gutter: number;
  readonly areaTop: number;
  readonly contentWidth: number;
  readonly listRect: Rect;
  /** A row's height with the gap under it. */
  readonly rowHeight: number;
  readonly layout: PastGamesLayout;
  readonly selected: PastGameRow | null;
  readonly popup: boolean;
  /** What the list says in place of rows (still reading, no games, no match), or null when there are rows. */
  readonly empty: string | null;
}

/** What a picture's hover slot stands for, and where it sits: in the list's content space (`y` from its top) or on the screen. */
interface HoverTarget {
  readonly cardId: string;
  readonly card?: AnyCard;
  readonly rect: Rect;
  readonly inList: boolean;
}

/** Links shared this run, by game id: Share never uploads a game twice. */
const sharedUrls = new Map<string, string>();

const packsOf = (row: PastGameRow): readonly PackRuntime[] | undefined =>
  row.save.config.packs as readonly PackRuntime[] | undefined;

/** The cards a game's pictures stand for, villain first, for the hover. */
const picturedCards = (row: PastGameRow): readonly (string | null)[] => [
  row.villainCardId,
  ...row.seats.map((seat) => seat.identityCardId),
];

/** The card records a game's pictures stand for, from the game's own packs: the hover's card when its pack is gone. */
const picturedCardRecords = (row: PastGameRow): readonly (AnyCard | undefined)[] =>
  picturedCards(row).map((id) =>
    id ? cardInPacks(row.save.config.packs as readonly PackRuntime[] | undefined, id) : undefined,
  );

/** The pictures' sources (not just URLs): a pack hero's scan is leased and re-resolved by its key while mounted. */
const picturedSources = (row: PastGameRow): readonly (ArtSource | null)[] => [
  villainSourceOf(row.scenarioId, row.villainCardId, packsOf(row)),
  ...row.seats.map((seat) => heroSourceOf(seat.identityCardId, packsOf(row))),
];

/** The names to print on pictures that have no art (a custom hero or villain whose pack is gone), villain first. */
const picturedNames = (row: PastGameRow): readonly (string | null)[] => [
  row.villainName,
  ...row.seats.map((seat) => seat.name),
];

/** How Past games was opened. All absent: from the Title, to the list as it was last left. */
export interface PastGamesSceneData {
  /** A game to show selected, with its details (a stats record's "View game"); scrolled into view once the saves load. */
  readonly gameId?: string;
  /** The screen that opened this one, which Back returns to (with `backData`) instead of the Title. */
  readonly from?: string;
  readonly backData?: object;
}

export class PastGamesScene extends Phaser.Scene {
  /** Every save on the device, or null while they are read. */
  #saves: readonly SaveMeta[] | null = null;
  #rows: readonly PastGameRow[] = [];
  /** What the search box says. Kept across visits like the filter; the DOM field outlives a redraw (`#draw`). */
  #query = "";
  #searchInput: McTextInput | null = null;
  /** Kept across visits (Phaser reuses the instance): a replay's Exit comes back to the same filter, place and game. */
  #filter: PastGameFilter = "all";
  /** Where the list was left: kept across visits (Phaser reuses the instance) and put back when the panel is made again. */
  #listTop = 0;
  /** The list reads from its top on the next paint (a new filter or search). */
  #listFromTop = false;
  /** The list scrollers this scene has put back where they were, and listens to. */
  #listPlaced = new WeakSet<HTMLElement>();
  #listened = new WeakSet<HTMLElement>();
  #scrollFrame = 0;
  /** The screen's one Lit panel over the canvas: the list, the details or popup, the notes. Made on the first paint. */
  #region: DomRegion<McSheet> | null = null;
  #glyphs!: SheetGlyphs;
  #ctx: PanelContext | null = null;
  /** The rows built into the list now: [from, to). */
  #built: { readonly from: number; readonly to: number } | null = null;
  #actions = new Map<string, () => void>();
  #hoverTargets = new Map<string, HoverTarget>();
  #searchRect: Rect = { x: 0, y: 0, width: 0, height: 0 };
  /** The game whose details show (the side panel), or whose popup is open (a phone); null for none. */
  #selectedId: string | null = null;
  /** A game to scroll to once the saves have loaded (`PastGamesSceneData.gameId`). */
  #revealId: string | null = null;
  /** Where Back goes: a screen that sent the player here. Cleared by Back, so a visit from the Title (or a replay's Exit) is not sent there. */
  #backTo: { readonly from: string; readonly backData: object } | null = null;
  #busy: Busy | null = null;
  #buttons: McButton[] = [];
  #tabs: McTabs | null = null;
  #route: FocusRoute | null = null;
  #hints!: GlyphHints;
  #hover: HoverPreview | null = null;
  #status: { readonly text: string; readonly until: number } | null = null;
  #obstacles: Rect[] = [];
  /** True while a phone's details popup is up: the list under it takes no taps. */
  #popupOpen = false;
  /** The game whose details' words the panel last showed: their scroll is kept while the same game shows. */
  #detailsScrollId: string | null = null;
  #alive = false;
  /** The leases this screen holds on its mounted hero and villain pictures (`dom/picture-leases.ts`). */
  readonly #pictures = new PictureLeases();
  /**
   * This visit's number. Phaser reuses the scene, so an open still running from an earlier visit (a slow Watch, then
   * Back and in again) checks it after each wait and stands down rather than act on this one.
   */
  #visit = 0;
  /** Back has started the fade out: no action starts until the next visit (a Watch begun now would land nowhere). */
  #leaving = false;
  /** Where the focus ring is: the side panel's actions take the stick and Page keys for the details. */
  #focusKey: string | null = null;

  constructor() {
    super(SCENES.pastGames);
  }

  init(data: PastGamesSceneData): void {
    const gameId = data?.gameId;
    if (gameId) {
      this.#selectedId = gameId;
      this.#revealId = gameId;
      // The record's game may be under the current filter or search: show everything.
      this.#filter = "all";
      this.#query = "";
      this.#listTop = 0;
      this.#listFromTop = true;
    }
    // Only a visit that says where it came from returns there. Phaser keeps the scene, so a later visit without `from`
    // (from the Title, or back from a replay watched from here) must not keep a Stats return (code review, #917).
    this.#backTo = data?.from ? { from: data.from, backData: data.backData ?? {} } : null;
  }

  create(): void {
    // Back from a replay, which played its scenario's music: the menus' music again (#858). A no-op when it already is.
    appSession().music?.playTitle();
    this.#alive = true;
    this.#leaving = false;
    this.#visit += 1;
    this.#busy = null;
    this.#status = null;
    this.#saves = null;
    this.#region = null;
    this.#built = null;
    this.#ctx = null;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#draw, this);
    this.#hints = new GlyphHints(this, () => this.#obstacles);
    this.#glyphs = new SheetGlyphs(this, () => this.#draw());
    // A pad that put the caret in the search box can take it out again. Bound before the route (`text-field-escape.ts`).
    bindTextFieldEscape(
      this,
      () => this.#searchInput,
      () => this.#popupOpen,
    );
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.#searchInput?.focused ?? false,
      onCancel: () => this.#cancel(),
      onTab: (direction) => {
        if (!this.#popupOpen) this.#stepFilter(direction);
      },
      // The details scroll while the popup is up or the ring is on their actions; else the list does (the phone
      // popup holds the list under it still).
      onPage: (direction) => {
        const scroller = this.#activeScroller();
        scroller?.scrollBy({ top: direction * scroller.clientHeight * PAGE });
      },
      onHomeEnd: (edge) => {
        this.#activeScroller()?.scrollTo({ top: edge === "home" ? 0 : Number.MAX_SAFE_INTEGER });
      },
      onScroll: (_dx, dy) => {
        this.#activeScroller()?.scrollBy({ top: dy });
      },
      onFocusChange: (key) => {
        this.#focusKey = key;
      },
    });
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCards(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    const offLanguage = onLanguageChange(() => this.#draw());
    // A pack's pictures are read from the store after the packs load: draw again when they land.
    const offArt = onArtChange(() => this.#draw());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.#visit += 1;
      offLanguage();
      offArt();
      this.#pictures.dispose();
      this.#hover?.destroy();
      this.#hover = null;
      this.scale.off("resize", this.#draw, this);
      this.#hints.dispose();
      this.#glyphs.dispose();
      this.#destroyWidgets();
      // The panel goes with the scene (`DomRegion`); the next visit makes a new one.
      this.#region = null;
      this.#searchInput?.destroy();
      this.#searchInput = null;
    });
    this.#draw();
    // The type measured before the fonts were in: lay the words out again once they are.
    void (typeof document === "undefined" ? undefined : document.fonts?.ready)?.then(() => {
      if (this.#alive) this.#draw();
    });
    fadeScreenIn(this);
    void this.#load();
  }

  /** The scroller the stick and the Page keys move: the details', or the list (never under the phone's popup). */
  #activeScroller(): HTMLElement | null {
    if (this.#detailsHaveScroll()) return this.#detailsScroller();
    return this.#popupOpen ? null : this.#scroller();
  }

  /** The stick and the Page keys scroll the details: the phone popup is up, or the ring is on the side panel's actions. */
  #detailsHaveScroll(): boolean {
    return this.#popupOpen || (this.#focusKey?.startsWith("action:") ?? false);
  }

  /** True while `visit` is still this scene's visit: a wait that began in an earlier one acts on nothing. */
  #current(visit: number): boolean {
    return this.#alive && !this.#leaving && this.#visit === visit;
  }

  async #load(): Promise<void> {
    const visit = this.#visit;
    const saves = await appSession().store.listSaves();
    if (!this.#current(visit)) return;
    this.#saves = saves;
    this.#draw();
    this.#revealSelected();
  }

  /** Scrolls a linked game (`#revealId`) to the middle of the list, once its row exists. */
  #revealSelected(): void {
    const id = this.#revealId;
    if (!id) return;
    this.#revealId = null;
    const index = this.#rows.findIndex((row) => row.id === id);
    if (index >= 0) {
      this.#centerRow(index);
      this.#paintPanel();
    }
  }

  #back(): void {
    // A replay being put on the board (Watch, or a picked file) is not walked away from: once it is installed on the session
    // only the board's own shutdown takes it down, and a Title fade already running would swallow the board's start.
    if (this.#busy?.action === "watch") return;
    // Anything else still waiting (a Share, an Export) stands down from here, not from the fade's end, and nothing new
    // starts during the fade.
    this.#leaving = true;
    this.#visit += 1;
    this.scale.off("resize", this.#draw, this);
    const back = this.#backTo;
    this.#backTo = null;
    if (back) goToScreen(this, back.from, back.backData);
    else goToScreen(this, SCENES.title);
  }

  /** B / Escape: closes the phone's popup first, then leaves. */
  #cancel(): void {
    if (this.#popupOpen) return this.#closePopup();
    this.#back();
  }

  #closePopup(): void {
    const id = this.#selectedId;
    this.#selectedId = null;
    this.#draw();
    if (id) this.#route?.focusKey(`game:${id}`);
  }

  #select(row: PastGameRow): void {
    this.#selectedId = row.id;
    this.#draw();
    this.#route?.focusKey("action:watch");
  }

  #setFilter(filter: PastGameFilter): void {
    if (filter === this.#filter) return;
    this.#filter = filter;
    this.#resetScroll();
    this.#draw();
    this.#route?.focusKey(`filter:${filter}`);
  }

  #stepFilter(direction: 1 | -1): void {
    const at = PAST_GAME_FILTERS.indexOf(this.#filter);
    this.#setFilter(PAST_GAME_FILTERS[(at + direction + PAST_GAME_FILTERS.length) % PAST_GAME_FILTERS.length]!);
  }

  /** Says something at the foot of the screen for a while: a link copied, or why an action failed. */
  #say(text: string, ms = 4000): void {
    if (!this.#alive) return;
    const status = { text, until: Date.now() + ms };
    this.#status = status;
    this.#draw();
    this.time.delayedCall(ms, () => {
      if (this.#status !== status) return;
      this.#status = null;
      this.#draw();
    });
  }

  // ---- actions --------------------------------------------------------------------------------------------------

  #act(row: PastGameRow, action: PastGameAction): void {
    if (this.#busy || this.#leaving) return;
    switch (action) {
      case "watch":
        void this.#watch(row);
        break;
      case "share":
        void this.#share(row);
        break;
      case "export":
      case "log":
        void this.#export(row, action);
        break;
    }
  }

  /** Sets what is running, for `visit` only: a late finish from an earlier visit leaves this one's state alone. */
  #setBusy(busy: Busy | null, visit: number = this.#visit): void {
    if (!this.#current(visit)) return;
    this.#busy = busy;
    this.#draw();
  }

  #sayIn(visit: number, text: string, ms?: number): void {
    if (this.#current(visit)) this.#say(text, ms);
  }

  async #watch(row: PastGameRow): Promise<void> {
    const visit = this.#visit;
    this.#setBusy({ id: row.id, action: "watch" }, visit);
    try {
      const host = await openReplay({ kind: "stored", gameId: row.id });
      if (!this.#current(visit)) return host.dispose();
      this.scale.off("resize", this.#draw, this);
      await introReplay(this, host, SCENES.pastGames);
    } catch (cause) {
      this.#setBusy(null, visit);
      this.#sayIn(visit, t(replayErrorKey(cause)));
    }
  }

  /** Writes a game's replay file (or its log) and hands it out through the shell's own route. */
  /** The actions' steps (`replay/past-game-actions.ts`), each standing down once `visit` is no longer this one. */
  #actionDeps(visit: number): PastGameActionDeps {
    return {
      open: (gameId) => openReplay({ kind: "stored", gameId }),
      current: () => this.#current(visit),
      deliverFile: deliverReplayFile,
      deliverLog: deliverGameLog,
      shareLink: (bytes) => shareLinkOf(bytes, detectPlatform() !== "web"),
    };
  }

  /** Writes a game's replay file (or its log) and hands it out through the shell's own route. */
  async #export(row: PastGameRow, kind: "export" | "log"): Promise<void> {
    const visit = this.#visit;
    this.#setBusy({ id: row.id, action: kind }, visit);
    try {
      const outcome = await exportPastGame(row.id, kind, this.#actionDeps(visit));
      if (outcome.kind === "delivered" && outcome.stopsAt !== null) {
        this.#sayIn(visit, t("pastGames.partialLog", { n: outcome.stopsAt }), 8000);
      }
    } catch (cause) {
      if (!isAbort(cause)) {
        console.warn("past game export failed", cause);
        // A game that won't open says why (its packs gone, a damaged save); a write that failed says so.
        this.#sayIn(visit, t(cause instanceof ReplayOpenError ? replayErrorKey(cause) : "replay.exportFailed"));
      }
    } finally {
      this.#setBusy(null, visit);
    }
  }

  async #share(row: PastGameRow): Promise<void> {
    const cached = sharedUrls.get(row.id);
    if (cached) {
      await this.#deliverLink(cached);
      return;
    }
    const visit = this.#visit;
    this.#setBusy({ id: row.id, action: "share" }, visit);
    let url: string | null = null;
    try {
      const shared = await sharePastGame(row.id, this.#actionDeps(visit));
      if (shared.ok === "stale") return;
      if (!shared.ok) {
        this.#sayIn(visit, t(shareFailureKey(shared.failure)));
        return;
      }
      url = shared.url;
      sharedUrls.set(row.id, url);
    } catch (cause) {
      if (!isAbort(cause)) {
        console.warn("past game share failed", cause);
        this.#sayIn(visit, t(cause instanceof ReplayOpenError ? replayErrorKey(cause) : "replay.link.offline"));
      }
      return;
    } finally {
      this.#setBusy(null, visit);
    }
    if (url && this.#current(visit)) await this.#deliverLink(url);
  }

  async #deliverLink(url: string): Promise<void> {
    const delivered = await deliverReplayLink(url, t("replay.title"));
    if (delivered === "copied") this.#say(t("replay.link.copied"));
    else if (delivered === "manual") this.#say(`${t("replay.link.manual")} ${url}`, 30_000);
  }

  /**
   * "Export for MC Tracker (CSV)" (#757): the games the list shows now (the filter's), as one spreadsheet file, handed
   * out by the shell's own route (save dialog, Android Save, share sheet or download).
   */
  async #exportTracker(): Promise<void> {
    if (this.#busy || this.#leaving) return;
    const visit = this.#visit;
    const saves = this.#rows.map((row) => row.save);
    this.#setBusy({ id: "", action: "tracker" }, visit);
    try {
      const outcome = await runTrackerExport({
        saves,
        names: TRACKER_EXPORT_NAMES,
        listDecks: () => deckStorage().list(),
        isCurrent: () => this.#current(visit),
        deliver: deliverTrackerCsv,
        now: Date.now,
      });
      if (outcome.kind === "left") return;
      if (outcome.kind === "none") return this.#sayIn(visit, t("pastGames.exportTrackerNone"));
      this.#sayIn(
        visit,
        outcome.games === 1 ? t("pastGames.exportTrackerOne") : t("pastGames.exportTrackerDone", { n: outcome.games }),
      );
    } catch (cause) {
      if (!isAbort(cause)) {
        console.warn("MC Tracker export failed", cause);
        this.#sayIn(visit, t("replay.exportFailed"));
      }
    } finally {
      this.#setBusy(null, visit);
    }
  }

  /** "Open a replay file": a replay someone else made, watched on the board; Exit comes back here. */
  async #openFile(): Promise<void> {
    if (this.#busy || this.#leaving) return;
    const visit = this.#visit;
    this.#setBusy({ id: "", action: "file" }, visit);
    try {
      const picked = await pickReplayFile();
      if (picked === null || !this.#current(visit)) return this.#setBusy(null, visit);
      if (picked === "unreadable") {
        this.#setBusy(null, visit);
        return this.#sayIn(visit, t("replay.error.damaged"));
      }
      // From here the file is being put on the board, which Back waits for (the picker itself never holds Back).
      this.#setBusy({ id: "", action: "watch" }, visit);
      const host = await openReplay({ kind: "file", bytes: picked });
      if (!this.#current(visit)) return host.dispose();
      this.scale.off("resize", this.#draw, this);
      await introReplay(this, host, SCENES.pastGames);
    } catch (cause) {
      this.#setBusy(null, visit);
      this.#sayIn(visit, t(replayErrorKey(cause)));
    }
  }

  // ---- drawing --------------------------------------------------------------------------------------------------

  #destroyWidgets(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#tabs?.destroy();
    this.#tabs = null;
  }

  /** The list's own scroller, in the panel (null before the first draw). */
  #scroller(): HTMLElement | null {
    return this.#region?.element.elementOf(LIST) ?? null;
  }

  #detailsScroller(): HTMLElement | null {
    return this.#region?.element.elementOf(DETAILS) ?? null;
  }

  /** The list reads from its top on the next draw (a new filter or search). */
  #resetScroll(): void {
    this.#listTop = 0;
    this.#listFromTop = true;
    const scroller = this.#scroller();
    if (scroller) scroller.scrollTop = 0;
  }

  /** A row's box in the list's content space (`y` from the list's top), as the Phaser list placed it. */
  #rowBox(index: number): Rect {
    const ctx = this.#ctx!;
    return {
      x: ctx.listRect.x + 4,
      y: index * ctx.rowHeight + 4,
      width: ctx.listRect.width - 20,
      height: ctx.rowHeight - ROW_GAP,
    };
  }

  /** A row's box on the screen now, from the list's scroll. */
  #rowOnScreen(index: number): Rect {
    const ctx = this.#ctx!;
    const box = this.#rowBox(index);
    return clipToView(
      { ...box, y: ctx.listRect.y + box.y - (this.#scroller()?.scrollTop ?? this.#listTop) },
      ctx.listRect,
    );
  }

  /** Brings a row into view: the least scroll that shows all of it. */
  #showRow(index: number): void {
    const ctx = this.#ctx;
    const scroller = this.#scroller();
    if (!ctx || !scroller) return;
    const top = index * ctx.rowHeight;
    if (top < scroller.scrollTop) scroller.scrollTop = top;
    else if (top + ctx.rowHeight > scroller.scrollTop + ctx.listRect.height)
      scroller.scrollTop = top + ctx.rowHeight - ctx.listRect.height;
  }

  /** The rows a linked game scrolls to the middle of the list. */
  #centerRow(index: number): void {
    const ctx = this.#ctx;
    const scroller = this.#scroller();
    if (!ctx || !scroller) return;
    scroller.scrollTop = Math.max(0, index * ctx.rowHeight - (ctx.listRect.height - ctx.rowHeight) / 2);
  }

  /**
   * Every picture in view with its place, for the card hover popover (read on each pointer move). The list's pictures
   * are placed from the rects noted at draw time and the list's scroll, clipped to its window, so no element is
   * measured.
   */
  #hoverCards(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    const ctx = this.#ctx;
    if (!ctx) return found;
    const scrolled = this.#scroller()?.scrollTop ?? this.#listTop;
    for (const [slot, target] of this.#hoverTargets) {
      let rect: Rect | null = target.rect;
      if (target.inList) {
        // Under the phone's popup the list takes no hover.
        if (ctx.popup) continue;
        rect = clipHoverRect({ ...target.rect, y: ctx.listRect.y + target.rect.y - scrolled }, ctx.listRect);
      }
      if (!rect) continue;
      found.set(slot, { ...rect, cardId: target.cardId, ...(target.card ? { card: target.card } : {}), through: true });
    }
    return found;
  }

  #draw(): void {
    if (!this.#alive) return;
    this.#pictures.begin();
    this.#destroyWidgets();
    // The search box's DOM field outlives a redraw, so its caret and what is typed stay put.
    const kept = this.#searchInput ? [this.#searchInput.gameObject] : [];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);
    this.#hints.reset();
    this.#obstacles = [];

    const frame = campaignFrame(this);
    const { width, height, phone, gutter } = frame;
    const stops = new Map<string, FocusStop>();
    const order: string[] = [];
    const saves = this.#saves ?? [];
    const counts = pastGameCounts(saves, undefined, { query: this.#query, names: PAST_GAME_NAMES });
    this.#rows = pastGameRowsOf(saves, PAST_GAME_NAMES, this.#filter, undefined, this.#query);

    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    // The file button's room in the bar's right end, so the title stops short of it.
    const fileWidth = phone ? 128 : 220;
    const bar = drawTopBar(this, {
      backLabel: phone
        ? "◂"
        : `◂ ${t(this.#backTo?.from === SCENES.playerStats ? "pastGames.backStats" : "pastGames.backTitle")}`,
      onBack: () => this.#back(),
      title: t("pastGames.title"),
      reserveRight: fileWidth + 12,
      hints: this.#hints,
    });
    if (bar.back) this.#buttons.push(bar.back);
    if (bar.backRect) {
      stops.set("back", { rect: bar.backRect, activate: () => this.#back() });
      this.#obstacles.push(bar.backRect);
    }
    const fileRect: Rect = {
      x: width - (phone ? 12 : 22) - fileWidth,
      y: (bar.height - hit.target) / 2,
      width: fileWidth,
      height: hit.target,
    };
    const openFile = (): void => void this.#openFile();
    // A folder mark at its left, so the button reads as "open a file" at a glance (#858).
    const iconSize = 18;
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: t(phone ? "pastGames.openFileShort" : "pastGames.openFile"),
        type: typeRole.label,
        rect: fileRect,
        labelInset: iconSize + 14,
        enabled: this.#busy === null,
        onClick: openFile,
      }),
    );
    const icon = this.add.graphics().setDepth(1);
    drawOpenFileIcon(
      icon,
      fileRect.x + 12 + iconSize / 2,
      fileRect.y + fileRect.height / 2,
      iconSize,
      surface.paper.hex,
    );
    if (this.#busy !== null) icon.setAlpha(0.4);
    stops.set("open-file", { rect: fileRect, activate: openFile });
    this.#obstacles.push(fileRect);

    const contentWidth = Math.min(width - gutter * 2, CONTENT_MAX_WIDTH);
    const left = (width - contentWidth) / 2;
    const tabRect: Rect = { x: left, y: bar.height + 12, width: contentWidth, height: TAB_HEIGHT };
    this.#tabs = new McTabs(this, {
      rect: tabRect,
      tabs: PAST_GAME_FILTERS.map((filter) => ({
        id: filter,
        label: `${t(FILTER_LABEL[filter])} (${counts[filter]})`,
      })),
      activeId: this.#filter,
      onSelect: (id) => this.#setFilter(id as PastGameFilter),
    });
    this.#obstacles.push(tabRect);
    const tabWidth = tabRect.width / PAST_GAME_FILTERS.length;
    PAST_GAME_FILTERS.forEach((filter, index) => {
      stops.set(`filter:${filter}`, {
        rect: { x: tabRect.x + index * tabWidth, y: tabRect.y, width: tabWidth, height: tabRect.height },
        activate: () => this.#setFilter(filter),
      });
    });
    // LB / RB, pad only, in the gap under the strip's right end.
    this.#hints.custom(
      (set, snapshot) => (set === "pad" ? specsForShortcuts(["zonePrevious", "zoneNext"], snapshot) : null),
      16,
      ({ width: hintWidth }) => ({
        x: tabRect.x + tabRect.width - hintWidth,
        y: tabRect.y + tabRect.height + 6 + (hit.target - 16) / 2,
      }),
      { avoidObstacles: true },
    );

    // The export button under the tabs, the LB / RB hint to its right where the pad shows one.
    const exportRect: Rect = {
      x: left,
      y: tabRect.y + tabRect.height + 6,
      width: Math.min(contentWidth, 340),
      height: hit.target,
    };
    const exportTracker = (): void => void this.#exportTracker();
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: this.#busy?.action === "tracker" ? t("pastGames.working") : t("pastGames.exportTracker"),
        type: { ...typeRole.rowTitle, size: 13 },
        rect: exportRect,
        enabled: this.#busy === null && this.#rows.length > 0,
        onClick: exportTracker,
      }),
    );
    stops.set("export-tracker", { rect: exportRect, activate: exportTracker });
    this.#obstacles.push(exportRect);

    // The search box: beside the export button where there is room (leaving the pad's LB / RB hint its corner), else
    // on a row of its own under it. A DOM field above the canvas, not on the scrolling list.
    const besideExport = contentWidth >= 720;
    const searchRect: Rect = besideExport
      ? {
          x: exportRect.x + exportRect.width + 10,
          y: exportRect.y,
          width: contentWidth - exportRect.width - 10 - 110,
          height: hit.target,
        }
      : { x: left, y: exportRect.y + exportRect.height + 6, width: contentWidth, height: hit.target };
    this.#searchInput = drawSearchField(
      this,
      searchRect,
      "search",
      this.#query,
      t("pastGames.search"),
      (value) => {
        this.#query = value;
        this.#resetScroll();
        this.#draw();
      },
      this.#searchInput,
      stops,
    );
    this.#searchRect = searchRect;
    this.#obstacles.push(searchRect);

    const areaTop = Math.max(exportRect.y + exportRect.height, searchRect.y + searchRect.height) + 10;
    const area: Rect = { x: left, y: areaTop, width: contentWidth, height: Math.max(80, height - areaTop - gutter) };
    const layout = pastGamesLayout(area, { width, height });
    const rows = this.#rows;
    // The side panel always shows a game: the one picked, else the newest. A phone opens its popup only on a tap.
    let selected = rows.find((row) => row.id === this.#selectedId) ?? null;
    if (!selected && layout.side) selected = rows[0] ?? null;
    // Until the saves load there are no rows to find a linked game in: keep the id for the draw that has them.
    if (!selected && this.#saves !== null) this.#selectedId = null;
    this.#popupOpen = !layout.side && selected !== null;
    // The popup sits over the screen; the DOM field would show through it.
    this.#searchInput.setVisible(!this.#popupOpen);

    const empty =
      this.#saves === null || rows.length === 0
        ? this.#saves === null
          ? t("pastGames.loading")
          : this.#query.trim() !== ""
            ? t("pastGames.emptySearch")
            : t(this.#filter === "all" ? "pastGames.empty" : "pastGames.emptyFilter")
        : null;
    this.#ctx = {
      width,
      height,
      gutter,
      areaTop,
      contentWidth,
      listRect: layout.list,
      rowHeight: pastGameRowHeight(layout.list.width - 20) + ROW_GAP,
      layout,
      selected,
      popup: this.#popupOpen,
      empty,
    };

    const listKeys = pastGamesFocusOrder(rows.map((row) => row.id));
    if (selected && layout.side) {
      this.#obstacles.push(layout.details);
      this.#detailStops(selected, layout.details, false, stops);
      order.push(...listKeys);
    } else if (selected) {
      // The popup takes every press: a shield over the screen, and only its own stops on the route.
      addPressShield(this, { x: 0, y: 0, width, height });
      this.#obstacles.push(layout.details);
      this.#detailStops(selected, layout.details, true, stops);
      order.push("close", ...PAST_GAME_ACTIONS.map((action) => `action:${action}`));
    } else {
      order.push(...listKeys.filter((key) => !key.startsWith("action:")));
    }
    if (empty === null) {
      rows.forEach((row, index) => {
        stops.set(`game:${row.id}`, {
          rect: () => this.#rowOnScreen(index),
          view: () => this.#ctx?.listRect ?? layout.list,
          activate: () => this.#select(row),
          ensureVisible: () => this.#showRow(index),
        });
      });
    }

    this.#paintPanel();
    this.#route?.set(order, stops);
  }

  /** The lines that say how a game went: why it ended, rounds and time, who fell and who stood. */
  #summaryLines(row: PastGameRow): { readonly reason: string; readonly when: string; readonly fates: string | null } {
    const minutes = playedMinutesOf(row.playedMs);
    const date = new Intl.DateTimeFormat(artLanguageNow(), { dateStyle: "medium", timeStyle: "short" }).format(
      row.endedAt,
    );
    const fates = seatFatesOf(row.seats);
    let fatesText: string | null = null;
    // A loss to every hero falling already says so in its reason.
    if (fates.wiped && row.reason === "heroesDefeated") fatesText = null;
    else if (fates.wiped) fatesText = t(row.seats.length === 1 ? "pastGames.fates.heroFell" : "pastGames.fates.wiped");
    else if (fates.fell.length > 0 || fates.stood.length > 0) {
      fatesText = [
        ...(fates.fell.length > 0 ? [t("pastGames.fates.fell", { names: fates.fell.join(", ") })] : []),
        ...(fates.stood.length > 0 ? [t("pastGames.fates.stood", { names: fates.stood.join(", ") })] : []),
      ].join(" · ");
    }
    return {
      reason: t(`pastGames.reason.${row.reason}` as MessageKey),
      when: [
        t(row.round === 1 ? "pastGames.oneRound" : "pastGames.rounds", { rounds: row.round }),
        ...(minutes === null ? [] : [t("pastGames.minutes", { minutes })]),
        date,
      ].join(" · "),
      fates: fatesText,
    };
  }

  #resultColor(row: PastGameRow): number {
    return row.result === "won"
      ? signal.heal.hex
      : row.result === "lost" || row.result === "conceded"
        ? accent.heroRed.hex
        : surface.ink.hex;
  }

  /** What a key does when the panel reports a tap on it. */
  #press(key: string, action: () => void): void {
    this.#actions.set(key, action);
  }

  /**
   * Builds the list, the details (or the phone's popup), the empty note and the status line as the panel's parts, hands
   * them to it and renders now. Also the list's own redraw when a scroll nears the edge of the rows built.
   */
  #paintPanel(): void {
    const ctx = this.#ctx;
    if (!ctx || !this.#alive) return;
    this.#actions = new Map();
    this.#hoverTargets = new Map();
    this.#glyphs.reset();
    // The panel's box: everything below the controls, or (a phone's popup) the whole screen, which its scrim covers.
    const region: Rect = ctx.popup
      ? { x: 0, y: 0, width: ctx.width, height: ctx.height }
      : { x: 0, y: ctx.areaTop, width: ctx.width, height: Math.max(0, ctx.height - ctx.areaTop) };
    const b = new SheetBuilder(this.game, { x: region.x, y: region.y }, isDesktopType);
    const rows = this.#rows;

    if (ctx.empty !== null) {
      const emptyWidth = Math.min(ctx.contentWidth, 560) - 24;
      b.emptyState(
        { x: ctx.width / 2 - emptyWidth / 2, y: ctx.areaTop + 24, width: emptyWidth, height: 80 },
        ctx.empty,
        { align: "center", size: 11 },
      );
      this.#built = null;
    } else {
      this.#drawList(b, ctx, rows);
    }

    const selected = ctx.selected;
    if (selected) {
      if (ctx.popup) {
        // The popup takes every press: the scrim over the screen, and a tap area over the scrim that does nothing.
        b.box({ x: 0, y: 0, width: ctx.width, height: ctx.height }, { fill: surface.ink.hex, fillAlpha: 0.72 });
        this.#press("scrim", () => undefined);
        b.tap("scrim", { x: 0, y: 0, width: ctx.width, height: ctx.height });
      }
      this.#drawDetails(b, selected, ctx.layout.details, ctx.popup);
    }

    if (this.#status && this.#status.until > Date.now()) this.#drawStatus(b, this.#status.text, ctx);
    this.#mount(region, b);
  }

  /** Hands the built parts to the panel (made once, so the list's scroll survives a redraw) and renders them now. */
  #mount(rect: Rect, b: SheetBuilder): void {
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      // A pack scan that fails to load reads its file again (`mc-image-error` from a part with a retry key).
      this.#pictures.watch(element);
      element.addEventListener("mc-activate", (event) => {
        // Leaving already (the fade runs): a second tap must not act.
        if (this.#leaving) return;
        this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      this.#region = new DomRegion(this, element, rect);
      // The card hover popover follows Phaser's pointer, which only hears the mouse over the canvas.
      this.#region.forwardMouseMoves();
    }
    const region = this.#region;
    region.setRect(rect);
    // The search field is a Phaser DOM element and the hover popover is drawn in the canvas: both are left out of the
    // panel to be seen through it. The field only while it shows (a popup hides it, as does a scene above).
    region.setHoles(() => {
      const holes: Rect[] = [];
      if (this.#searchInput?.shown && !this.#popupOpen) holes.push(this.#searchRect);
      const popover = this.#hover?.shownRect;
      if (popover) holes.push(popover);
      return holes;
    });
    region.element.nodes = b.nodes;
    renderNow(region.element);
    // The new parts are mounted: the pictures the last pass held are given back now.
    this.#pictures.end();
    const scroller = this.#scroller();
    if (scroller) {
      // The list comes back to where it was left (a replay's Exit, a redraw), unless the filter or search reset it.
      if (this.#listFromTop || !this.#listPlaced.has(scroller)) {
        scroller.scrollTop = this.#listFromTop ? 0 : this.#listTop;
        this.#listFromTop = false;
        this.#listPlaced.add(scroller);
      }
      if (!this.#listened.has(scroller)) {
        this.#listened.add(scroller);
        scroller.addEventListener(
          "scroll",
          () => {
            this.#listTop = scroller.scrollTop;
            this.#onListScroll();
          },
          { passive: true },
        );
      }
    }
  }

  /** The list scrolled: build again once the view nears the edge of the rows built, so what scrolls in is there. */
  #onListScroll(): void {
    if (this.#scrollFrame) return;
    this.#scrollFrame = requestAnimationFrame(() => {
      this.#scrollFrame = 0;
      const built = this.#built;
      const ctx = this.#ctx;
      if (!built || !ctx || !this.#alive || this.#leaving) return;
      const top = this.#listTop;
      const bottom = top + ctx.listRect.height;
      const slack = ctx.listRect.height / 2;
      const from = built.from * ctx.rowHeight;
      const to = built.to * ctx.rowHeight;
      if ((built.from > 0 && top < from + slack) || (built.to < this.#rows.length && bottom > to - slack))
        this.#paintPanel();
    });
  }

  /** The rows in and near the view: a long history builds only these, and builds again as the list scrolls. */
  #drawList(b: SheetBuilder, ctx: PanelContext, rows: readonly PastGameRow[]): void {
    const { listRect, rowHeight } = ctx;
    const top = this.#listFromTop ? 0 : (this.#scroller()?.scrollTop ?? this.#listTop);
    const from = Math.max(0, Math.floor((top - listRect.height) / rowHeight));
    const to = Math.min(rows.length, Math.ceil((top + listRect.height * 2) / rowHeight));
    this.#built = { from, to };
    b.scroll(LIST, listRect, rows.length * rowHeight, (inner) => {
      for (let index = from; index < to; index++) {
        const row = rows[index]!;
        this.#drawRow(inner, row, index, this.#rowBox(index), row.id === ctx.selected?.id);
      }
    });
  }

  /** One game's row: its pictures, how it went, and a tap area over the whole of it. */
  #drawRow(b: SheetBuilder, row: PastGameRow, index: number, box: Rect, selected: boolean): void {
    const ink = surface.ink.hex;
    const parts = pastGameRowParts(box, row.seats.length);
    b.box(box, {
      fill: surface.card.hex,
      stroke: selected ? accent.heroRed.hex : ink,
      strokeWidth: border.object,
    });
    this.#drawPictures(b, row, parts.pictures, `row${index}`, true);
    const lines = this.#summaryLines(row);
    const result = b.text(
      parts.text.x,
      parts.text.y,
      t(`pastGames.result.${row.result}` as MessageKey).toUpperCase(),
      bangers(18),
      { color: this.#resultColor(row) },
    );
    const reasonX = parts.text.x + result.width + 8;
    b.text(reasonX, parts.text.y + 3, lines.reason, typeRole.body, {
      size: 13,
      color: ink,
      alpha: 0.85,
      fitWidth: parts.text.x + parts.text.width - reasonX,
    });
    // The title steps down until it fits two lines.
    const titleY = parts.text.y + result.height + 2;
    let titleSize = 12;
    for (const size of [15, 14, 13, 12]) {
      titleSize = size;
      const measured = b.measure(row.title, typeRole.rowTitle, { size, wrapWidth: parts.text.width });
      if (measured.height <= size * 2 * typeRole.rowTitle.lineHeight + 2) break;
    }
    const title = b.text(parts.text.x, titleY, row.title, typeRole.rowTitle, {
      size: titleSize,
      color: ink,
      wrapWidth: parts.text.width,
      maxLines: 2,
    });
    const whenY = titleY + title.height + 3;
    const when = b.text(parts.text.x, whenY, lines.when, typeRole.body, {
      size: 13,
      color: ink,
      alpha: 0.75,
      fitWidth: parts.text.width,
    });
    if (lines.fates) {
      b.text(parts.text.x, whenY + when.height + 2, lines.fates, typeRole.body, {
        size: 13,
        color: ink,
        alpha: 0.9,
        fitWidth: parts.text.width,
      });
    }
    // The tap area over the whole row, last, so the pictures and words under it take the press.
    const key = `game:${row.id}`;
    b.tap(key, box);
    this.#press(key, () => {
      if (!this.#popupOpen) this.#select(row);
    });
  }

  /**
   * The villain's and each hero's picture (the picture, a thin frame, the name printed on a stand-in with no art, a
   * hero's aspect chips along its foot), each opening the card hover popover. `inList`: the rects are in the list's
   * content space, so the hover places them from the list's scroll.
   */
  #drawPictures(b: SheetBuilder, row: PastGameRow, pictures: readonly Rect[], where: string, inList: boolean): void {
    const sources = picturedSources(row);
    const names = picturedNames(row);
    const cards = picturedCards(row);
    const records = picturedCardRecords(row);
    pictures.forEach((pic, i) => {
      const cardId = cards[i];
      const slot = cardId ? hoverSlotOf(cardId, `${where}:${i}`) : undefined;
      if (cardId && slot)
        this.#hoverTargets.set(slot, {
          cardId,
          rect: pic,
          inList,
          ...(records[i] ? { card: records[i] } : {}),
        });
      const held = this.#pictures.image(sources[i] ?? null);
      // A hero's face sits high in its picture (focusY 0.2), as the baked thumbnails cropped it.
      b.image(pic, {
        src: held.src,
        ...(held.retry !== undefined ? { retry: held.retry } : {}),
        fill: surface.parchment.hex,
        cover: { x: 0.5, y: 0.2 },
        ...(slot ? { hover: slot } : {}),
      });
      b.box(pic, { stroke: surface.ink.hex, strokeWidth: 1.5, alpha: ink.label });
      // The name printed on the placeholder of a picture with no art, so a cover never shows an unnamed blank (#758).
      const name = names[i];
      if (held.src === null && name) {
        b.text(pic.x + pic.width / 2, pic.y + pic.height / 2, name, AS_WRITTEN_LABEL, {
          size: 10,
          color: surface.ink.hex,
          alpha: 0.85,
          origin: [0.5, 0.5],
          wrapWidth: pic.width - 8,
          align: "center",
          maxLines: 4,
        });
      }
      // A hero's aspect chips along the foot of its picture (the villain, picture 0, has none).
      if (i > 0) {
        for (const chip of aspectChipsOf(pic, row.seats[i - 1]?.aspectIds ?? [])) {
          b.box(chip.rect, { fill: chip.stamp.fill, stroke: surface.ink.hex, strokeWidth: 1, alpha: 1 });
          b.text(chip.rect.x + chip.rect.width / 2, chip.rect.y + chip.rect.height / 2, chip.text, typeRole.label, {
            size: chip.fontSize,
            color: chip.stamp.ink,
            origin: [0.5, 0.5],
            fitWidth: chip.rect.width - 4,
          });
        }
      }
    });
  }

  /** The details' focus stops: the popup's close, and the four actions. Their rects are fixed, so the route holds them. */
  #detailStops(row: PastGameRow, panel: Rect, popup: boolean, stops: Map<string, FocusStop>): void {
    const parts = pastGameDetailParts(panel, row.seats.length, popup);
    if (parts.close) stops.set("close", { rect: parts.close, activate: () => this.#closePopup() });
    for (const action of PAST_GAME_ACTIONS) {
      stops.set(`action:${action}`, { rect: parts.actions[action], activate: () => this.#act(row, action) });
    }
  }

  /** A game's details: the side panel beside the list, or (`popup`) a phone's popup over it. */
  #drawDetails(b: SheetBuilder, row: PastGameRow, panel: Rect, popup: boolean): void {
    const ink = surface.ink.hex;
    const parts = pastGameDetailParts(panel, row.seats.length, popup);
    b.box(panel, { fill: surface.card.hex, stroke: ink, strokeWidth: border.object });

    if (parts.close) {
      this.#glyphs.button(b, {
        key: "close",
        rect: parts.close,
        label: "✕",
        look: "secondary",
        type: typeRole.menuButton,
        ids: ["cancel"],
        ground: "paper",
      });
      this.#press("close", () => this.#closePopup());
    }
    this.#drawPictures(b, row, parts.pictures, "details", false);

    // The words run in a region of their own above the actions: four heroes, a long title and a campaign line can
    // outgrow the panel on a small screen, and the region scrolls (wheel, drag, the right stick) rather than cut any.
    const lines = this.#summaryLines(row);
    const text = parts.text;
    const inner = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    let y = 0;
    const wrapWidth = text.width - 10;
    const add = (value: string, spec: TypeSpec, size: number, color: number, alpha: number, gap = 4): void => {
      const line = inner.text(0, y, value, spec, { size, color, alpha, wrapWidth });
      y += line.height + gap;
    };
    add(t(`pastGames.result.${row.result}` as MessageKey).toUpperCase(), bangers(28), 28, this.#resultColor(row), 1, 2);
    add(lines.reason, typeRole.body, 15, ink, 1);
    add(row.title, typeRole.rowTitle, 16, ink, 1);
    add(lines.when, typeRole.body, 14, ink, 0.8, row.campaign ? 2 : 10);
    if (row.campaign) add(t("pastGames.campaign", { name: row.campaign }), typeRole.label, 12, ink, 0.75, 10);
    for (const seat of row.seats) {
      const fate = seat.fell === null ? "" : ` · ${t(seat.fell ? "pastGames.seat.fell" : "pastGames.seat.stood")}`;
      add(`${seat.name}${fate}`, typeRole.rowTitle, 14, ink, 1, 1);
      // Every seat at the table, not only the first: its stats, aspects and deck, and the cards it played most (#756).
      // A deck named after its aspect (a precon) does not say it twice.
      const deckParts = [...(seat.deckName ? [seat.deckName] : []), ...aspectsNotInName(seat.deckName, seat.aspects)];
      const seatLines = [
        ...(seat.damage !== null && seat.thwart !== null
          ? [t("pastGames.seat.stats", { damage: seat.damage, thwart: seat.thwart })]
          : []),
        ...(deckParts.length > 0 ? [t("pastGames.seat.deck", { deck: deckParts.join(" · ") })] : []),
        ...(seat.topCards.length > 0
          ? [t("pastGames.seat.top", { cards: seat.topCards.map((card) => `${card.name} ${card.count}×`).join(", ") })]
          : []),
      ];
      seatLines.forEach((line, i) => add(line, typeRole.body, 13, ink, 0.75, i === seatLines.length - 1 ? 8 : 1));
    }
    // The offset is kept while the same game shows, and starts over for another.
    if (this.#detailsScrollId !== row.id) {
      this.#detailsScrollId = row.id;
      const existing = this.#detailsScroller();
      if (existing) existing.scrollTop = 0;
    }
    b.scroll(DETAILS, text, Math.max(text.height, y), (target) => {
      target.nodes.push(...inner.nodes);
    });

    const busy = this.#busy;
    for (const action of PAST_GAME_ACTIONS) {
      const running = busy?.id === row.id && busy.action === action;
      const rect = parts.actions[action];
      b.button({
        key: `action:${action}`,
        rect,
        label: running ? t("pastGames.working") : t(ACTION_LABEL[action]),
        look: action === "watch" ? "primary" : "secondary",
        type: action === "watch" ? typeRole.menuButton : { ...typeRole.rowTitle, size: 13 },
        ...(busy !== null ? { disabled: true as const } : {}),
      });
      this.#press(`action:${action}`, () => this.#act(row, action));
    }
  }

  #drawStatus(b: SheetBuilder, text: string, ctx: PanelContext): void {
    const maxWidth = Math.min(ctx.width - ctx.gutter * 2, 640);
    const measured = b.measure(text, typeRole.body, { wrapWidth: maxWidth - 24, align: "center" });
    const boxHeight = measured.height + 16;
    const y = ctx.height - ctx.gutter - boxHeight;
    const natural = b.measure(text, typeRole.body).width;
    const boxWidth = Math.min(maxWidth, Math.min(natural, maxWidth - 24) + 32);
    b.box(
      { x: ctx.width / 2 - boxWidth / 2, y, width: boxWidth, height: boxHeight },
      { fill: surface.ink.hex, fillAlpha: 0.95 },
    );
    b.text(ctx.width / 2, y + 8, text, typeRole.body, {
      color: surface.paper.hex,
      origin: [0.5, 0],
      wrapWidth: maxWidth - 24,
      align: "center",
    });
  }
}
