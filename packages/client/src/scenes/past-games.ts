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
import type { AnyCard } from "@mc/content";
import type { PackRuntime } from "../packs/pack-runtime.js";
import { onArtChange } from "../language-change.js";
import { artLanguageNow } from "../art/art-source.js";
import { cardFaces } from "../art/card-face-baker.js";
import { heroPictureOf, villainPictureOf } from "../art/matchup-pictures.js";
import { accent, hit, signal, surface, typeRole } from "../tokens.js";
import { bangers, campaignFrame, drawTopBar } from "../ui/campaign-chrome.js";
import { HoverPreview, screenHoverArea } from "../ui/card-hover-preview.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { GlyphHints, specsForShortcuts } from "../ui/glyph-hints.js";
import { addPressShield } from "../ui/press-shield.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { McButton, McTabs, McTextInput, fitText, paintPanel } from "../ui/widgets.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { clipToView } from "../view/focus-list.js";
import type { Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
import { cardInPacks, PAST_GAME_NAMES, TRACKER_EXPORT_NAMES } from "../view/game-label-names.js";
import {
  PAST_GAME_ACTIONS,
  PAST_GAME_FILTERS,
  pastGameCounts,
  pastGameDetailParts,
  pastGameRowHeight,
  aspectChipsOf,
  aspectsNotInName,
  pastGameRowParts,
  pastGameRowsOf,
  pastGamesLayout,
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
import { drawSearchField, renderLiveArtThumb, type LiveArtThumb } from "./roster-panel.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { introReplay } from "./replay-entry.js";
import { drawOpenFileIcon } from "../ui/open-file-icon.js";
import { SCENES } from "./keys.js";

/** The widest the tabs, list and side panel run together. */
const CONTENT_MAX_WIDTH = 1220;
const TAB_HEIGHT = 44;
const ROW_GAP = 8;

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

const picturedUrls = (row: PastGameRow): readonly (string | null)[] => [
  villainPictureOf(row.scenarioId, row.villainCardId, packsOf(row)),
  ...row.seats.map((seat) => heroPictureOf(seat.identityCardId, packsOf(row))),
];

/** The names to print on pictures that have no art (a custom hero or villain whose pack is gone), villain first. */
const picturedNames = (row: PastGameRow): readonly (string | null)[] => [
  row.villainName,
  ...row.seats.map((seat) => seat.name),
];

/** The name printed on the placeholder of a picture with no art, so a cover never shows an unnamed blank (#758). */
function addStandInName(
  scene: Phaser.Scene,
  rect: Rect,
  name: string | null,
  url: string | null,
): Phaser.GameObjects.Text | null {
  if (url !== null || !name) return null;
  const label = scene.add
    .text(rect.x + rect.width / 2, rect.y + rect.height / 2, name, {
      ...textStyle(typeRole.label, surface.ink.hex, 0.85),
      align: "center",
      wordWrap: { width: rect.width - 8 },
    })
    .setOrigin(0.5, 0.5);
  fitText(label, rect.width - 8, 12);
  return label;
}

/** Draws the aspect chips along the foot of a hero's picture: the aspect's frame color with its name in words on it. */
function addAspectChips(scene: Phaser.Scene, pic: Rect, aspectIds: readonly string[]): Phaser.GameObjects.GameObject[] {
  const objects: Phaser.GameObjects.GameObject[] = [];
  const chips = aspectChipsOf(pic, aspectIds);
  if (chips.length === 0) return objects;
  const g = scene.add.graphics();
  objects.push(g);
  for (const chip of chips) {
    g.fillStyle(chip.stamp.fill, 1).fillRect(chip.rect.x, chip.rect.y, chip.rect.width, chip.rect.height);
    g.lineStyle(1, surface.ink.hex, 0.9).strokeRect(chip.rect.x, chip.rect.y, chip.rect.width, chip.rect.height);
    const text = scene.add
      .text(
        chip.rect.x + chip.rect.width / 2,
        chip.rect.y + chip.rect.height / 2,
        chip.text,
        textStyle(typeRole.label, chip.stamp.ink),
      )
      .setOrigin(0.5, 0.5);
    text.setFontSize(chip.fontSize);
    // The model picked the wording by an estimate of the type's width; the measured text shrinks to fit what it chose.
    fitText(text, chip.rect.width - 4, 6);
    objects.push(text);
  }
  return objects;
}

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
  readonly #scroll = new ListScroll();
  /** The game whose details show (the side panel), or whose popup is open (a phone); null for none. */
  #selectedId: string | null = null;
  /** A game to scroll to once the saves have loaded (`PastGamesSceneData.gameId`). */
  #revealId: string | null = null;
  /** Where Back goes: a screen that sent the player here. Cleared by Back, so a visit from the Title (or a replay's Exit) is not sent there. */
  #backTo: { readonly from: string; readonly backData: object } | null = null;
  #busy: Busy | null = null;
  #buttons: McButton[] = [];
  #tabs: McTabs | null = null;
  #list: McVirtualList | null = null;
  #route: FocusRoute | null = null;
  #hints!: GlyphHints;
  #hover: HoverPreview | null = null;
  #hoverCards: (() => ReadonlyMap<string, HoverCardIdRect>)[] = [];
  #status: { readonly text: string; readonly until: number } | null = null;
  #obstacles: Rect[] = [];
  /** True while a phone's details popup is up: the list under it takes no taps. */
  #popupOpen = false;
  #offBaked: (() => void) | null = null;
  /** The details' words, which scroll when they outgrow the panel; the offset is kept while the same game shows. */
  #detailsRegion: McScrollRegion | null = null;
  #detailsScroll = new VariableListScroll();
  #detailsScrollId: string | null = null;
  #alive = false;
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
      this.#scroll.reset();
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
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#draw, this);
    this.#hints = new GlyphHints(this, () => this.#obstacles);
    // A pad that put the caret in the search box can take it out again. Bound before the route (`text-field-escape.ts`).
    bindTextFieldEscape(
      this,
      () => this.#searchInput,
      () => this.#popupOpen,
    );
    this.#route = new FocusRoute(this, {
      blocked: () => this.#searchInput?.focused ?? false,
      onCancel: () => this.#cancel(),
      onTab: (direction) => {
        if (!this.#popupOpen) this.#stepFilter(direction);
      },
      // The details scroll while the popup is up or the ring is on their actions; else the list does (the phone
      // popup holds the list under it still).
      onPage: (direction) => {
        const details = this.#detailsHaveScroll() ? this.#detailsRegion : null;
        if (details) details.scrollByPx(direction * details.rect.height * 0.9);
        else if (!this.#popupOpen) this.#list?.scrollByPage(direction);
      },
      onHomeEnd: (edge) => {
        const details = this.#detailsHaveScroll() ? this.#detailsRegion : null;
        if (details) details.scrollByPx(edge === "home" ? -1e6 : 1e6);
        else if (this.#popupOpen) return;
        else if (edge === "home") this.#list?.scrollToStart();
        else this.#list?.scrollToEnd();
      },
      onScroll: (_dx, dy) => {
        const details = this.#detailsHaveScroll() ? this.#detailsRegion : null;
        if (details) details.scrollByPx(dy);
        else if (!this.#popupOpen) this.#list?.scrollByPx(dy);
      },
      onFocusChange: (key) => {
        this.#focusKey = key;
      },
    });
    this.#hover = new HoverPreview(this, {
      cardIds: () => {
        const found = new Map<string, HoverCardIdRect>();
        for (const source of this.#hoverCards) for (const [key, rect] of source()) found.set(key, rect);
        return found;
      },
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
      this.#hover?.destroy();
      this.#hover = null;
      this.scale.off("resize", this.#draw, this);
      this.#hints.dispose();
      this.#destroyWidgets();
      this.#searchInput?.destroy();
      this.#searchInput = null;
    });
    this.#draw();
    fadeScreenIn(this);
    void this.#load();
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
    if (index >= 0) this.#list?.scrollIntoView(index);
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
    this.#scroll.reset();
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
    this.#list?.destroy();
    this.#list = null;
    this.#hoverCards = [];
    this.#offBaked?.();
    this.#offBaked = null;
    this.#detailsRegion?.destroy();
    this.#detailsRegion = null;
  }

  #draw(): void {
    if (!this.#alive) return;
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
      backLabel: phone ? "◂" : this.#backTo?.from === SCENES.playerStats ? "◂ STATS" : "◂ TITLE",
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
        this.#scroll.reset();
        this.#draw();
      },
      this.#searchInput,
      stops,
    );
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

    if (this.#saves === null || rows.length === 0) {
      const empty =
        this.#saves === null
          ? t("pastGames.loading")
          : this.#query.trim() !== ""
            ? t("pastGames.emptySearch")
            : t(this.#filter === "all" ? "pastGames.empty" : "pastGames.emptyFilter");
      this.add
        .text(width / 2, areaTop + 24, empty, textStyle(typeRole.body, surface.ink.hex, 0.8))
        .setOrigin(0.5, 0)
        .setWordWrapWidth(Math.min(contentWidth, 560) - 24)
        .setAlign("center");
    } else {
      this.#drawList(layout.list, selected, stops);
    }

    const listKeys = pastGamesFocusOrder(rows.map((row) => row.id));
    if (selected && layout.side) {
      this.#drawDetails(selected, layout.details, false, stops);
      order.push(...listKeys);
    } else if (selected) {
      // The popup takes every press: a shield over the screen, and only its own stops on the route.
      addPressShield(this, { x: 0, y: 0, width, height });
      this.add.rectangle(0, 0, width, height, surface.ink.hex, 0.72).setOrigin(0, 0);
      this.#drawDetails(selected, layout.details, true, stops);
      order.push("close", ...PAST_GAME_ACTIONS.map((action) => `action:${action}`));
    } else {
      order.push(...listKeys.filter((key) => !key.startsWith("action:")));
    }

    if (this.#status && this.#status.until > Date.now()) this.#drawStatus(this.#status.text, width, height, gutter);

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

  #drawList(listRect: Rect, selected: PastGameRow | null, stops: Map<string, FocusStop>): void {
    const rows = this.#rows;
    const rowHeight = pastGameRowHeight(listRect.width - 20) + ROW_GAP;
    const boxIn = (rect: Rect): Rect => ({
      x: rect.x + 4,
      y: rect.y + 4,
      width: rect.width - 20,
      height: rect.height - ROW_GAP,
    });
    const ink = surface.ink.hex;

    const renderRow = (index: number, rect: Rect): VirtualListRow => {
      const row = rows[index]!;
      const box = boxIn(rect);
      const parts = pastGameRowParts(box, row.seats.length);
      const panel = this.add.graphics();
      paintPanel(panel, box, "card", row.id === selected?.id ? "selected" : "rest");
      const objects: Phaser.GameObjects.GameObject[] = [panel];
      const thumbs: LiveArtThumb[] = [];
      const urls = picturedUrls(row);
      parts.pictures.forEach((pic, i) => {
        const thumb = renderLiveArtThumb(this, pic, urls[i] ?? null, 0.2);
        thumbs.push(thumb);
        objects.push(thumb.object);
        const standIn = addStandInName(this, pic, picturedNames(row)[i] ?? null, urls[i] ?? null);
        if (standIn) objects.push(standIn);
        // A hero's aspect chips along the foot of its picture (the villain, picture 0, has none).
        if (i > 0) objects.push(...addAspectChips(this, pic, row.seats[i - 1]?.aspectIds ?? []));
      });
      const lines = this.#summaryLines(row);
      const result = this.add.text(
        parts.text.x,
        parts.text.y,
        t(`pastGames.result.${row.result}` as MessageKey).toUpperCase(),
        textStyle(bangers(18), this.#resultColor(row)),
      );
      const reason = this.add.text(
        result.x + result.width + 8,
        parts.text.y + 3,
        lines.reason,
        textStyle(typeRole.body, ink, 0.85),
      );
      reason.setFontSize(13);
      fitText(reason, parts.text.x + parts.text.width - reason.x, 11);
      const title = this.add
        .text(parts.text.x, result.y + result.height + 2, row.title, textStyle(typeRole.rowTitle, ink))
        .setWordWrapWidth(parts.text.width);
      for (const size of [15, 14, 13, 12]) {
        title.setFontSize(size);
        if (title.height <= size * 2 * typeRole.rowTitle.lineHeight + 2) break;
      }
      const when = this.add.text(
        parts.text.x,
        title.y + title.height + 3,
        lines.when,
        textStyle(typeRole.body, ink, 0.75),
      );
      when.setFontSize(13);
      fitText(when, parts.text.width, 11);
      objects.push(result, reason, title, when);
      if (lines.fates) {
        const fates = this.add.text(
          parts.text.x,
          when.y + when.height + 2,
          lines.fates,
          textStyle(typeRole.body, ink, 0.9),
        );
        fates.setFontSize(13);
        fitText(fates, parts.text.width, 11);
        objects.push(fates);
      }
      return { objects, refresh: () => thumbs.forEach((thumb) => thumb.refresh()) };
    };

    this.#list = new McVirtualList(this, {
      rect: listRect,
      rowHeight,
      count: rows.length,
      renderRow,
      scroll: this.#scroll,
      onRowActivate: (index) => {
        const row = rows[index];
        if (row && !this.#popupOpen) this.#select(row);
      },
      rowPressableAt: () => !this.#popupOpen,
      cursorBlocked: () => this.#popupOpen,
      inputBlocked: () => this.#popupOpen,
    });
    const list = this.#list;
    list.onDestroy(cardFaces(this).onBaked(() => list.refreshRows()));

    // Each row's pictures open the card hover popover, from the list's own scroll, clipped to its window.
    this.#hoverCards.push(() => {
      const found = new Map<string, HoverCardIdRect>();
      if (this.#popupOpen) return found;
      const view = list.rect;
      rows.forEach((row, index) => {
        const at = list.rectFor(index);
        if (at.y + at.height < view.y || at.y > view.y + view.height) return;
        const cards = picturedCards(row);
        const records = picturedCardRecords(row);
        pastGameRowParts(boxIn(at), row.seats.length).pictures.forEach((pic, i) => {
          const cardId = cards[i];
          const shown = cardId ? clipHoverRect(pic, view) : null;
          if (cardId && shown)
            found.set(hoverSlotOf(cardId, `row${index}:${i}`), {
              ...shown,
              cardId,
              ...(records[i] ? { card: records[i] } : {}),
              through: true,
            });
        });
      });
      return found;
    });

    rows.forEach((row, index) => {
      stops.set(`game:${row.id}`, {
        rect: () => clipToView(boxIn(list.rectFor(index)), list.rect),
        view: () => list.rect,
        activate: () => this.#select(row),
        ensureVisible: () => list.scrollIntoView(index),
      });
    });
  }

  /** A game's details: the side panel beside the list, or (`popup`) a phone's popup over it. */
  #drawDetails(row: PastGameRow, panel: Rect, popup: boolean, stops: Map<string, FocusStop>): void {
    const ink = surface.ink.hex;
    const parts = pastGameDetailParts(panel, row.seats.length, popup);
    const g = this.add.graphics();
    paintPanel(g, panel, "card", "rest");
    this.#obstacles.push(panel);

    if (parts.close) {
      const close = (): void => this.#closePopup();
      const button = new McButton(this, {
        kind: "secondary",
        label: "✕",
        type: typeRole.menuButton,
        rect: parts.close,
        onClick: close,
      });
      this.#buttons.push(button);
      this.#hints.button(button, ["cancel"], "paper");
      stops.set("close", { rect: parts.close, activate: close });
    }

    const urls = picturedUrls(row);
    const thumbs = parts.pictures.map((pic, i) => renderLiveArtThumb(this, pic, urls[i] ?? null, 0.2));
    parts.pictures.forEach((pic, i) => {
      addStandInName(this, pic, picturedNames(row)[i] ?? null, urls[i] ?? null);
      if (i > 0) addAspectChips(this, pic, row.seats[i - 1]?.aspectIds ?? []);
    });
    this.#offBaked = cardFaces(this).onBaked(() => thumbs.forEach((thumb) => thumb.refresh()));
    const cards = picturedCards(row);
    const records = picturedCardRecords(row);
    this.#hoverCards.push(() => {
      const found = new Map<string, HoverCardIdRect>();
      parts.pictures.forEach((pic, i) => {
        const cardId = cards[i];
        if (cardId)
          found.set(hoverSlotOf(cardId, `details:${i}`), {
            ...pic,
            cardId,
            ...(records[i] ? { card: records[i] } : {}),
            through: true,
          });
      });
      return found;
    });

    // The words run in a region of their own above the actions: four heroes, a long title and a campaign line can
    // outgrow the panel on a small screen, and the region scrolls (wheel, drag, the right stick) rather than cut any.
    const lines = this.#summaryLines(row);
    const text = parts.text;
    const before = this.children.list.length;
    let y = text.y;
    const add = (value: string, style: Phaser.Types.GameObjects.Text.TextStyle, size: number, gap = 4) => {
      const line = this.add.text(text.x, y, value, style).setWordWrapWidth(text.width - 10);
      line.setFontSize(size);
      y += line.height + gap;
      return line;
    };
    add(
      t(`pastGames.result.${row.result}` as MessageKey).toUpperCase(),
      textStyle(bangers(28), this.#resultColor(row)),
      28,
      2,
    );
    add(lines.reason, textStyle(typeRole.body, ink), 15);
    add(row.title, textStyle(typeRole.rowTitle, ink), 16);
    add(lines.when, textStyle(typeRole.body, ink, 0.8), 14, row.campaign ? 2 : 10);
    if (row.campaign)
      add(t("pastGames.campaign", { name: row.campaign }), textStyle(typeRole.label, ink, 0.75), 12, 10);
    for (const seat of row.seats) {
      const fate = seat.fell === null ? "" : ` · ${t(seat.fell ? "pastGames.seat.fell" : "pastGames.seat.stood")}`;
      add(`${seat.name}${fate}`, textStyle(typeRole.rowTitle, ink), 14, 1);
      // Every seat at the table, not only the first: its stats, aspects and deck, and the cards it played most (#756).
      // A deck named after its aspect (a precon) does not say it twice.
      const deckParts = [...(seat.deckName ? [seat.deckName] : []), ...aspectsNotInName(seat.deckName, seat.aspects)];
      const lines = [
        ...(seat.damage !== null && seat.thwart !== null
          ? [t("pastGames.seat.stats", { damage: seat.damage, thwart: seat.thwart })]
          : []),
        ...(deckParts.length > 0 ? [t("pastGames.seat.deck", { deck: deckParts.join(" · ") })] : []),
        ...(seat.topCards.length > 0
          ? [t("pastGames.seat.top", { cards: seat.topCards.map((card) => `${card.name} ${card.count}×`).join(", ") })]
          : []),
      ];
      lines.forEach((line, i) => add(line, textStyle(typeRole.body, ink, 0.75), 13, i === lines.length - 1 ? 8 : 1));
    }
    if (this.#detailsScrollId !== row.id) {
      this.#detailsScroll = new VariableListScroll();
      this.#detailsScrollId = row.id;
    }
    // Taken before the region exists, so its own root and mask are never moved into it.
    const words = this.children.list.slice(before);
    const region = new McScrollRegion(this, {
      rect: text,
      heights: [Math.max(text.height, y - text.y)],
      scroll: this.#detailsScroll,
    });
    region.content.add(words);
    region.refresh();
    this.#detailsRegion = region;

    const busy = this.#busy;
    for (const action of PAST_GAME_ACTIONS) {
      const running = busy?.id === row.id && busy.action === action;
      const rect = parts.actions[action];
      const activate = (): void => this.#act(row, action);
      this.#buttons.push(
        new McButton(this, {
          kind: action === "watch" ? "primary" : "secondary",
          label: running ? t("pastGames.working") : t(ACTION_LABEL[action]),
          type: action === "watch" ? typeRole.menuButton : { ...typeRole.rowTitle, size: 13 },
          rect,
          enabled: busy === null,
          onClick: activate,
        }),
      );
      stops.set(`action:${action}`, { rect, activate });
    }
  }

  #drawStatus(text: string, width: number, height: number, gutter: number): void {
    const maxWidth = Math.min(width - gutter * 2, 640);
    const label = this.add
      .text(width / 2, 0, text, textStyle(typeRole.body, surface.paper.hex))
      .setOrigin(0.5, 0)
      .setWordWrapWidth(maxWidth - 24)
      .setAlign("center")
      .setDepth(1001);
    const boxHeight = label.height + 16;
    const y = height - gutter - boxHeight;
    label.setY(y + 8);
    this.add
      .rectangle(width / 2, y, Math.min(maxWidth, label.width + 32), boxHeight, surface.ink.hex, 0.95)
      .setOrigin(0.5, 0)
      .setDepth(1000);
  }
}
