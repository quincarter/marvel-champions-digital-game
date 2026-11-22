/**
 * A room's lobby (issue #880, docs/live-game-rooms.md section 8): the code and a Copy link button, the people in the
 * room, the seats (one per hero the host set up) with who holds each, the table's settings (the host's to change,
 * everyone's to read) and chat. The host sets the table up with the existing New game flow in room mode and presses
 * Start once every seat is held; a guest follows the started game as a watcher with their seats marked.
 *
 * The room owns every fact on this screen (`platform/room.ts`, `RoomState`); this draws it (`view/room-lobby-model.ts`
 * words it) and sends the player's presses back. The seat list, the settings and the chat scroll inside masked regions
 * (`ui/scroll-region.ts`): every control in them passes the region's clip and drag, so a swipe that ends over a button
 * fires nothing (the "no tap on finger lift" rule, issue #227).
 */
import Phaser from "phaser";
import { currentCardsById, currentScenarios } from "../content/pool.js";
import { t, tPlural } from "../i18n/translate.js";
import { loadedPacks } from "../packs/pack-registry.js";
import { withLoadedPacks } from "../packs/game-packs.js";
import {
  leaveRoom,
  onRoomState,
  reportHostActivity,
  releaseSeat,
  requestSeat,
  roomState,
  say,
  setLobby,
  startRoomGame,
  assignSeat,
  denySeat,
  takeOverSeat,
  giveBackSeat,
  type RoomState,
} from "../platform/room.js";
import {
  epicRetryDelay,
  epicRetryExhausted,
  epicRetryNow,
  epicStartFailed,
  shouldAttemptEpicStart,
  type EpicStartRetry,
} from "../view/epic-start-retry.js";
import { dropTable, setEpic, startEpicGame, startEpicTableRoomGame, watchTable } from "../platform/room.js";
import { enterSeatGame, playRoomGame } from "../platform/seat-play.js";
import { askToConfirm } from "./end-turn-confirm.js";
import { copyText } from "../ui/report-export.js";
import { hit, surface, typeRole } from "../tokens.js";
import { bangers, campaignFrame, drawTopBar } from "../ui/campaign-chrome.js";
import { drawArtBackdrop } from "../ui/art-backdrop.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import type { RoomProblem } from "../live/room-state.js";
import type { OnlineData } from "./online.js";
import { keepClosedRoomGame } from "../platform/room-continue.js";
import { McButton, McTabs, McTextInput, fitText } from "../ui/widgets.js";
import { HoverPreview, screenHoverArea } from "../ui/card-hover-preview.js";
import { drawHeroAvatar, SEAT_AVATAR_READY } from "../ui/seat-avatar.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { drawPlayPlatformIcon } from "../ui/play-platform-icon.js";
import { playPlatformMarkOf } from "../view/play-platform-mark.js";
import type { ScenarioIntroData } from "./scenario-intro.js";
import { scenarioIntroFor } from "../campaign/scenario-intros.js";
import { ART_CATALOG, introArtFor } from "../art/scenario-art.js";
import type { ModStoreSceneData } from "./mod-store.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import type { RoomGameBase } from "../live/room-start.js";
import type { DeckRefusalCode } from "../live/room-state.js";
import type { Rect } from "../view/layout.js";
import { hostSeesHandsOf } from "../view/hand-privacy.js";
import { pacingOf } from "../view/villain-pacing.js";
import { lobbyLayout, type LobbyLayout, type LobbyPanelId } from "../view/room-lobby-layout.js";
import { activityDots, hostActivityWords } from "../view/room-host-activity.js";
import { ChatSeen, unreadChatCount } from "../view/room-notices.js";
import { chatRectAboveKeyboard, coveredHeight } from "../view/room-chat-keyboard.js";
import { nativeKeyboardHeight, onNativeKeyboard } from "../platform/native-keyboard.js";
import { appSession } from "../session.js";
import {
  chatOn,
  codeShown,
  closedUnderPlayer,
  connectionWords,
  guestModRows,
  hostModRows,
  participantRows,
  deckKeyOf,
  playModeKeys,
  villainPacingKeys,
  undoRows,
  cheatsOn,
  CHEATS_NOTE_KEY,
  myBuildReason,
  refusalWords,
  seatNameOf,
  seatRows,
  startBlock,
  startResultText,
  startResultWords,
  tableRuleRows,
  toggleModPatch,
  toggleTableRulePatch,
  wordsText,
  type SeatRowView,
  type StartResultView,
  type Words,
} from "../view/room-lobby-model.js";
import {
  clampSeatCount,
  clearRoomTable,
  enterRoomSetup,
  placeholderSeats,
  ROOM_SEATS_DEFAULT,
  ROOM_SEATS_MAX,
  ROOM_SEATS_MIN,
  roomBaseConfig,
  roomDraft,
  seatSpecsOf,
} from "../view/room-table-setup.js";
import { setSeatNote } from "../view/room-seat-note.js";
import { tableRulesOf, type Settings } from "../settings.js";
import type { SessionConfig } from "../engine/host.js";
import { EPIC_SCENARIO_ID, epicTableBase } from "../view/epic-table-config.js";
import { withEpicTimeLimit } from "../live/epic-start.js";
import {
  MAX_EPIC_TABLES,
  MIN_EPIC_TABLES,
  epicStartBlock,
  epicTableViews,
  minutesText,
  newEpicPlan,
  nextTimeLimit,
  planOf,
  statusKey,
  withNextDifficulty,
  withNextPod,
  withSeatCount,
  withTableCount,
  type EpicPlan,
  type EpicTableView,
} from "../view/epic-lobby-model.js";
import type { EpicSheetData } from "./epic-sheet.js";
import type { RoomDeckPickerData } from "./room-deck-picker.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { introReplay } from "./replay-entry.js";
import { newGameDraft } from "./title.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import type { ScenarioSelectData } from "./scenario-select.js";
import type { TableSetupData } from "./table-setup.js";

/** The clip and drag guard a scrolling panel hands its controls (issue #227). */
interface PanelGuard {
  clip: () => Rect;
  suppress: () => boolean;
  stop: (key: string, rect: Rect, activate: () => void) => void;
}

/** Epic starts this device has already acted on (a table host starts its table once per start). */
const epicStarted = new Set<string>();

/** How long a note about what the room refused, or why a button is off, stays in the footer. */
const NOTE_MS = 6000;
const PAPER = surface.paper.hex;
const INK = surface.ink.hex;
const PARCHMENT = surface.parchment.hex;

/** What the player has read of the chat, kept across the lobby's visits (the badge on the Chat tab counts the rest). */
const chatSeen = new ChatSeen();

/** The calls a seat, setting or chat press makes; the dev preview swaps in a recorder (`?screen=room-lobby`). */
interface RoomApi {
  readonly requestSeat: (seat: string) => void;
  readonly releaseSeat: (seat: string) => void;
  readonly assignSeat: (seat: string, participant: string) => void;
  readonly denySeat: (seat: string, participant: string) => void;
  readonly takeOverSeat: (seat: string) => void;
  readonly giveBackSeat: (seat: string) => void;
  readonly say: (text: string) => void;
  readonly setLobby: typeof setLobby;
}

const REAL_API: RoomApi = {
  requestSeat,
  releaseSeat,
  assignSeat,
  denySeat,
  takeOverSeat,
  giveBackSeat,
  say,
  setLobby,
};

/** The dev preview's API: nothing is sent; each call is appended to `globalThis.__mcRoomCalls` for the e2e specs to read. */
const PREVIEW_API: RoomApi | null = import.meta.env.DEV
  ? (Object.fromEntries(
      Object.keys(REAL_API).map((name) => [
        name,
        (...args: unknown[]) => {
          const calls = ((globalThis as { __mcRoomCalls?: string[] }).__mcRoomCalls ??= []);
          calls.push(`${name}(${args.join(",")})`);
        },
      ]),
    ) as unknown as RoomApi)
  : null;

export interface RoomLobbyData {
  /** Dev only: a made-up room to draw (`view/room-lobby-fixture.ts`) instead of the live one. */
  readonly preview?: RoomState;
  /** Dev only: show the refusal a Start with refused decks would (the preview's seats 1 and 3 refused). */
  readonly startResult?: "decks";
  /** The room refused the host's game start as the lobby had changed: Start is offered again with the usual words. */
  readonly startRefused?: "lobby-changed";
}

type ScrollKey = "seats" | "settings" | "chat";

interface Note {
  readonly text: string;
  readonly until: number;
}

export class RoomLobbyScene extends Phaser.Scene {
  #state: RoomState = roomState();
  #preview = false;
  /** The seat whose "give to" list is open. */
  #picking: string | null = null;
  /** The next draw brings the opened "give to" list into view (set by the press, kept until it is drawn). */
  #revealPicker = false;
  #reveal: Rect | null = null;
  #hover: HoverPreview | null = null;
  #hoverFaces: { readonly cardId: string; readonly rect: Rect; readonly view: Rect; readonly scroll: ScrollKey }[] = [];
  #tab: LobbyPanelId = "seats";
  #buttons: McButton[] = [];
  #regions: McScrollRegion[] = [];
  #tabs: McTabs | null = null;
  readonly #scrolls: Record<ScrollKey, VariableListScroll> = {
    seats: new VariableListScroll(),
    settings: new VariableListScroll(),
    chat: new VariableListScroll(),
  };
  #chatInput: McTextInput | null = null;
  /** How much of the screen's bottom the on-screen keyboard covers, in game pixels (0 when it is down). */
  #covered = 0;
  /** The host's activity line in the header while it animates, and its words without the dots. */
  #activity: { readonly text: Phaser.GameObjects.Text; readonly words: string; dots: string } | null = null;
  #chatBound = false;
  #chatCount = 0;
  /** New chat arrived: the chat list scrolls to its newest line on the next draw. */
  #chatToEnd = true;
  #route: FocusRoute | null = null;
  #hints!: GlyphHints;
  #alive = false;
  #off: (() => void) | null = null;
  #confirmLeave = false;
  #refusalSeen = 0;
  #note: Note | null = null;
  #linkCopied = false;
  #starting = false;
  /** What the host's last Start said when it did not start the game (shown in the seats panel until dismissed). */
  #startResult: StartResultView | null = null;
  /** The last failed table start (by Epic start id and lobby revision), so it is retried only as that allows. */
  #epicRetry: EpicStartRetry | null = null;
  /** The decks the host's last Start refused, each with the deck it was about, so a changed deck clears it. */
  #refused: readonly { seat: string; code: DeckRefusalCode; reason: string; deckKey: string }[] = [];
  #seatsDefaulted = false;
  #opening = false;
  /** After a failed open of the room's game: no new try before this time (ms on the scene clock), and the next wait. */
  #openAfter = 0;
  #openBackoff = 3000;
  #stops = new Map<string, FocusStop>();
  #order: string[] = [];

  constructor() {
    super(SCENES.roomLobby);
  }

  init(data: RoomLobbyData): void {
    this.#preview = import.meta.env.DEV && data?.preview !== undefined;
    this.#state = this.#preview ? data.preview! : roomState();
    this.#tab = "seats";
    this.#confirmLeave = false;
    this.#note = null;
    this.#starting = false;
    this.#startResult = null;
    this.#refused = [];
    this.#seatsDefaulted = false;
    this.#opening = false;
    this.#openAfter = 0;
    this.#openBackoff = 3000;
    if (this.#preview && data.startResult === "decks") {
      const refused = [
        {
          seat: "s1",
          code: "illegal" as const,
          reason: "Spider-Man (Justice) needs 40 to 50 cards; this deck has 38.",
        },
        { seat: "s3", code: "mod-missing" as const, reason: "The host does not have the pack fan-pack." },
      ];
      this.#refused = refused.map((r) => ({
        ...r,
        deckKey: deckKeyOf(this.#state.seats.find((seat) => seat.id === r.seat)?.deck ?? null),
      }));
      this.#startResult = startResultWords({ ok: false, reason: "decks", refused }, this.#state);
    }
    if (data?.startRefused === "lobby-changed") {
      this.#startResult = startResultWords({ ok: false, reason: "lobby-changed" }, this.#state);
    }
    this.#chatCount = this.#state.chat.length;
    this.#refusalSeen = this.#state.refusal?.seq ?? 0;
  }

  create(): void {
    this.#alive = true;
    // A fresh chat field each run: its Enter key is bound again (a stale flag left a rerun's field without it).
    this.#chatBound = false;
    this.cameras.main.setBackgroundColor(cssOf(PAPER));
    setSeatNote(null);
    if (this.#state.role === "none") {
      goToScreen(this, SCENES.title);
      return;
    }
    this.#hints = new GlyphHints(this);
    this.#route = new FocusRoute(this, {
      blocked: () => this.#chatInput?.focused ?? false,
      onCancel: () => this.#leave(),
      primary: () => (this.#stops.has("start") ? "start" : null),
    });
    bindTextFieldEscape(this, () => this.#chatInput);
    this.scale.on("resize", this.#draw, this);
    // The host is back in the lobby: its setup status line (if it was showing one) is over.
    if (!this.#preview && this.#state.role === "host") reportHostActivity("idle");
    this.#watchKeyboard();
    // The desktop hover popover over a seat's hero picture, as Table setup and the set sheets show it.
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCardIds(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    // A hero picture that was still loading arrives: draw again to show it.
    this.events.on(SEAT_AVATAR_READY, this.#draw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.#off?.();
      this.#off = null;
      this.#hints.dispose();
      this.scale.off("resize", this.#draw, this);
      this.events.off(SEAT_AVATAR_READY, this.#draw, this);
      this.#hover?.destroy();
      this.#hover = null;
      this.#clearWidgets();
      this.#chatInput?.destroy();
      this.#chatInput = null;
      this.#chatBound = false;
    });
    this.#draw();
    fadeScreenIn(this);
    if (!this.#preview) this.#off = onRoomState((state) => this.#onState(state));
  }

  /** The hero pictures on screen now, each clipped to the scrolled list it sits in. */
  #hoverCardIds(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    this.#hoverFaces.forEach(({ cardId, rect, view, scroll }, index) => {
      const shown = clipHoverRect({ ...rect, y: rect.y - this.#scrolls[scroll].offsetPx }, view);
      if (shown) found.set(hoverSlotOf(cardId, `seat${index}`), { ...shown, cardId, through: true });
    });
    return found;
  }

  /**
   * A phone's on-screen keyboard shrinks the browser's visual viewport without resizing the page, so the canvas keeps its
   * size and the keyboard covers its bottom. The lobby reads the covered strip (`view/room-chat-keyboard.ts`) and, on the
   * Chat tab, gives the chat all the room above the keyboard.
   */
  #watchKeyboard(): void {
    const viewport = globalThis.visualViewport;
    const read = (): void => {
      const layoutHeight = globalThis.innerHeight;
      const css = coveredHeight({
        native: nativeKeyboardHeight(),
        viewport: viewport ? { layoutHeight, visibleHeight: viewport.height, offsetTop: viewport.offsetTop } : null,
      });
      const covered = Math.round(css * (this.scale.gameSize.height / Math.max(1, layoutHeight)));
      if (covered === this.#covered || !this.#alive) return;
      this.#covered = covered;
      this.#chatToEnd = true;
      this.#draw();
    };
    viewport?.addEventListener("resize", read);
    viewport?.addEventListener("scroll", read);
    const offNative = onNativeKeyboard(read);
    // The app may have reported before this screen opened (the keyboard was already up).
    read();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      viewport?.removeEventListener("resize", read);
      viewport?.removeEventListener("scroll", read);
      offNative();
      this.#covered = 0;
    });
  }

  override update(time: number): void {
    const activity = this.#activity;
    if (!activity) return;
    const dots = activityDots(time, appSession().settings.reducedMotion);
    if (dots === activity.dots) return;
    activity.dots = dots;
    activity.text.setText(activity.words + dots);
  }

  // ---- State --------------------------------------------------------------------------------------------------

  #onState(state: RoomState): void {
    if (!this.#alive) return;
    this.#state = state;
    if (state.role === "none") return;
    // The room was closed under this player (not a finished game): back to Play online, which says so.
    if (state.connection === "ended" && closedUnderPlayer(state.problem) && !this.#opening) {
      this.#leaveClosed(state.problem!);
      return;
    }
    // A new lobby opens with a couple of open seats: the host changes the count with the stepper.
    if (state.role === "host" && state.connection === "connected" && state.settings && state.seats.length === 0) {
      if (!this.#seatsDefaulted) {
        this.#seatsDefaulted = true;
        setLobby({ seats: seatSpecsOf(ROOM_SEATS_DEFAULT) });
      }
    }
    if (state.refusal && state.refusal.seq !== this.#refusalSeen) {
      this.#refusalSeen = state.refusal.seq;
      const words = refusalWords(state.refusal, state);
      if (words) this.#say(wordsText(words));
    }
    if (state.chat.length > this.#chatCount) {
      this.#chatCount = state.chat.length;
      this.#chatToEnd = true;
    }
    void this.#maybeStartTable();
    if (state.role === "guest" && state.started && !this.#opening && this.time.now >= this.#openAfter) {
      void this.#openGame();
    }
    this.#draw();
  }

  /** A line in the footer for a few seconds: a refusal, or why a button is off. */
  #say(text: string): void {
    this.#note = { text, until: this.time.now + NOTE_MS };
    this.time.delayedCall(NOTE_MS + 50, () => {
      if (this.#alive && this.#note && this.time.now >= this.#note.until) {
        this.#note = null;
        this.#draw();
      }
    });
  }

  #noteNow(): string | null {
    return this.#note && this.time.now < this.#note.until ? this.#note.text : null;
  }

  get #api(): RoomApi {
    return this.#preview && PREVIEW_API ? PREVIEW_API : REAL_API;
  }

  #isHost(): boolean {
    return this.#state.role === "host";
  }

  #installed(): readonly { id: string; version: string; name: string }[] {
    return loadedPacks().map((p) => ({ id: p.id, version: p.version, name: p.name }));
  }

  // ---- The host's table -------------------------------------------------------------------------------------

  /** The game the kept draft makes without its players, with the lobby's house rules, or null while the table is not set up. */
  #base(): RoomGameBase | null {
    const draft = roomDraft();
    if (!draft) return null;
    // Built again only when the draft, the seat count, the loaded packs or the house rule change (every draw asks).
    const rule = this.#state.settings?.tableRules.sameNameHeroAllyConflict === true;
    const seats = this.#state.seats.length;
    const packs = loadedPacks()
      .map((p) => `${p.id}@${p.version}`)
      .join(",");
    // The draft is compared by value: Table setup may edit the kept object in place.
    const draftKey = JSON.stringify(draft);
    const cached = this.#baseCache;
    if (
      cached &&
      cached.draft === draftKey &&
      cached.rule === rule &&
      cached.packs === packs &&
      cached.seats === seats
    ) {
      return cached.base;
    }
    const scenario = currentScenarios().find((sc) => (sc.id as string) === draft.scenarioId);
    const settings = { sameNameHeroAllyConflict: rule } as Pick<Settings, "sameNameHeroAllyConflict">;
    const base = roomBaseConfig(draft, Math.max(1, seats), scenario, tableRulesOf(settings));
    this.#baseCache = { draft: draftKey, rule, packs, seats, base };
    return base;
  }

  #baseCache: {
    readonly draft: string;
    readonly rule: boolean;
    readonly packs: string;
    readonly seats: number;
    readonly base: RoomGameBase;
  } | null = null;

  #packsUsed(base: RoomGameBase | null): readonly { id: string; version: string }[] {
    if (!base) return [];
    const config: SessionConfig = { ...base, players: [] };
    return withLoadedPacks(config).packs?.map((p) => ({ id: p.id, version: p.version })) ?? [];
  }

  #startWords(): Words | null {
    if (this.#state.epic) return epicStartBlock(this.#state);
    const base = this.#base();
    return startBlock(this.#state, { tableReady: base !== null, packsUsed: this.#packsUsed(base) });
  }

  #setUpTable(): void {
    if (!this.#isHost()) return;
    enterRoomSetup(this.#state.seats.length || ROOM_SEATS_DEFAULT);
    this.scale.off("resize", this.#draw, this);
    const draft = roomDraft();
    // No heroes here: every player brings their own deck, so the table has one placeholder per lobby seat.
    if (draft) {
      const seated = { ...draft, seats: placeholderSeats(this.#state.seats.length || ROOM_SEATS_DEFAULT) };
      goToScreen(this, SCENES.setup, { draft: seated } satisfies TableSetupData);
    } else goToScreen(this, SCENES.scenarioSelect, { draft: newGameDraft() } satisfies ScenarioSelectData);
  }

  /** The host changes the number of seats (one to four); a seat someone holds is not dropped by accident. */
  #setSeatCount(count: number): void {
    const next = clampSeatCount(count);
    if (next === this.#state.seats.length) return;
    this.#api.setLobby({ seats: seatSpecsOf(next) });
  }

  /** Opens the deck picker for a seat: mine ("Choose your deck") or, for the host, any seat ("Set deck"). */
  #pickDeck(seat: string, preset: boolean): void {
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.roomDeckPicker, {
      seat,
      preset,
      ...(this.#preview ? { preview: this.#state } : {}),
    } satisfies RoomDeckPickerData);
  }

  async #start(): Promise<void> {
    if (this.#starting) return;
    this.#startResult = null;
    const block = this.#startWords();
    if (block) {
      this.#say(wordsText(block));
      this.#draw();
      return;
    }
    if (this.#state.epic) {
      if (this.#preview) ((globalThis as { __mcRoomCalls?: string[] }).__mcRoomCalls ??= []).push("startEpicGame()");
      else startEpicGame();
      return;
    }
    const base = this.#base();
    if (!base) return;
    this.#starting = true;
    this.#draw();
    // The decks the seats hold are fetched, judged and dealt by `startRoomGame`; it says what stopped it, if anything.
    const keys = new Map(this.#state.seats.map((seat) => [seat.id, deckKeyOf(seat.deck)] as const));
    const result = await startRoomGame(base);
    if (!this.#alive) return;
    if (!result.ok) {
      this.#starting = false;
      this.#refused =
        result.reason === "decks"
          ? result.refused.map((r) => ({
              seat: r.seat,
              code: r.code,
              reason: r.reason,
              deckKey: keys.get(r.seat) ?? "",
            }))
          : [];
      this.#startResult = startResultWords(result, this.#state);
      if (this.#startResult) this.#tab = "seats";
      this.#draw();
      return;
    }
    this.scale.off("resize", this.#draw, this);
    // As Table setup does: a scenario with a one-off intro and its artboard reads that first.
    const scenarioId = roomDraft()?.scenarioId;
    if (scenarioId && scenarioIntroFor(scenarioId) && introArtFor(ART_CATALOG, scenarioId)) {
      goToScreen(this, SCENES.scenarioIntro, { scenarioId } satisfies ScenarioIntroData);
      return;
    }
    goToScreen(this, SCENES.setupDeal);
  }

  /**
   * A guest, once the host has started: a seat that may act opens the real board and plays from this device (#881);
   * a guest with none (a watcher, or only mismatched or taken-over seats) opens the room's game as a watch, as before.
   */
  async #openGame(): Promise<void> {
    this.#opening = true;
    this.#say(t("room.opening"));
    this.#draw();
    const result = await playRoomGame();
    if (!this.#alive) {
      if (result.ok) result.host.dispose();
      return;
    }
    if (!result.ok) {
      this.#opening = false;
      // Back off rather than ask again on every lobby update, and try once more when the wait is over.
      this.#openAfter = this.time.now + this.#openBackoff;
      this.time.delayedCall(this.#openBackoff + 50, () => {
        const state = this.#state;
        if (this.#alive && state.role === "guest" && state.started && !this.#opening) void this.#openGame();
      });
      this.#openBackoff = Math.min(this.#openBackoff * 2, 30_000);
      this.#say(t(result.message));
      this.#draw();
      return;
    }
    if (result.kind === "seat") {
      this.scale.off("resize", this.#draw, this);
      let store;
      try {
        store = await enterSeatGame(result.host);
      } catch {
        // enterSeatGame closed the seat; back off the way a failed watch does and try again when the wait is over.
        this.#opening = false;
        this.#openAfter = this.time.now + this.#openBackoff;
        this.time.delayedCall(this.#openBackoff + 50, () => {
          const state = this.#state;
          if (this.#alive && state.role === "guest" && state.started && !this.#opening) void this.#openGame();
        });
        this.#openBackoff = Math.min(this.#openBackoff * 2, 30_000);
        this.scale.on("resize", this.#draw, this);
        this.#say(t("watch.link.gone"));
        this.#draw();
        return;
      }
      // The same rule as the host's Start, Title's Resume and the Briefing: a game still in setup opens on the Setup
      // deal scene (so a guest who joins or reconnects mid-mulligan sees "Setting up the table"), else the board.
      goToScreen(this, store.state.game?.step.phase === "setup" ? SCENES.setupDeal : SCENES.board, {});
      return;
    }
    const labels = this.#state.mySeats.map((id) => {
      const index = this.#state.seats.findIndex((seat) => seat.id === id);
      const seat = this.#state.seats[index];
      return seat?.deck?.heroName ?? (seat ? seatNameOf(seat, index) : id);
    });
    setSeatNote(
      labels.length === 0
        ? null
        : t(labels.length === 1 ? "room.watch.yourHero" : "room.watch.yourHeroes", { names: labels.join(", ") }),
      result.host,
    );
    this.scale.off("resize", this.#draw, this);
    try {
      await introReplay(this, result.host, SCENES.title);
    } catch {
      this.#opening = false;
      this.#say(t("watch.link.gone"));
      this.#draw();
    }
  }

  // ---- Leaving ------------------------------------------------------------------------------------------------

  #leave(): void {
    if (this.#isHost() && this.#state.connection !== "ended" && !this.#confirmLeave) {
      this.#confirmLeave = true;
      this.#draw();
      return;
    }
    this.#goTitle();
  }

  /** The room is gone (platform/room.ts already forgot it from recent rooms): drop the connection, show Play online's notice. */
  #leaveClosed(problem: RoomProblem): void {
    this.#alive = false;
    // A seated guest whose game was running keeps it (the log is taken before the room is left): the notice offers it.
    const kept = keepClosedRoomGame(this.#state, problem);
    leaveRoom();
    clearRoomTable();
    this.scale.off("resize", this.#draw, this);
    void kept.then((continueGameId) =>
      goToScreen(this, SCENES.online, {
        closedNotice: problem,
        ...(continueGameId ? { continueGameId } : {}),
      } satisfies OnlineData),
    );
  }

  #goTitle(): void {
    // A host who got here confirmed "close room": the room closes for everyone, not just this socket.
    leaveRoom({ closeRoom: this.#isHost() });
    clearRoomTable();
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.title);
  }

  // ---- Drawing ------------------------------------------------------------------------------------------------

  #clearWidgets(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    for (const region of this.#regions) region.destroy();
    this.#regions = [];
    this.#tabs?.destroy();
    this.#tabs = null;
  }

  #button(options: ConstructorParameters<typeof McButton>[1]): McButton {
    const button = new McButton(this, options);
    this.#buttons.push(button);
    return button;
  }

  #text(
    x: number,
    y: number,
    text: string,
    size: number,
    width: number,
    options: { bold?: boolean; alpha?: number; color?: number } = {},
  ): Phaser.GameObjects.Text {
    const style = textStyle(options.bold ? typeRole.rowTitle : typeRole.body, options.color ?? INK, options.alpha ?? 1);
    return this.add.text(x, y, text, style).setFontSize(size).setWordWrapWidth(width, true);
  }

  #draw(): void {
    if (!this.#alive || this.#state.role === "none") return;
    this.#clearWidgets();
    // The chat field is a DOM element that keeps its caret across a redraw: lifted out of the sweep and put back.
    const kept = this.#chatInput ? this.#chatInput.gameObjects : [];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);
    this.#hints.reset();
    this.#hoverFaces = [];
    this.#stops = new Map();
    this.#order = [];

    const state = this.#state;
    const frame = campaignFrame(this);
    const { width, height, phone, gutter } = frame;
    drawArtBackdrop(this, width, height, () => this.#alive && this.#draw());
    const bar = drawTopBar(this, {
      backLabel: phone ? "◂" : `◂ ${t("room.leave").toUpperCase()}`,
      onBack: () => this.#leave(),
      hints: phone ? null : this.#hints,
      title: t("room.title"),
      right: t(participantRows(state).find((p) => p.me)?.roleKey ?? "room.role.watcher"),
      reserveRight: phone ? 80 : 0,
    });
    if (bar.back) this.#buttons.push(bar.back);
    if (bar.backRect) this.#addStop("back", bar.backRect, () => this.#leave());

    if (this.#tab === "chat" && !chatOn(state)) this.#tab = "seats";
    // The footer is only as tall as it needs: a guest's is one line of words, the host's holds Start (beside the words on
    // a wide screen, under them on a phone).
    const needsButton = this.#isHost() || state.connection === "ended" || this.#confirmLeave;
    const footerHeight = !needsButton ? 52 : width >= 600 ? 76 : 86;
    const full = lobbyLayout(
      width,
      height,
      bar.height,
      this.#tab,
      gutter,
      undefined,
      footerHeight,
      state.epic ? 0.7 : 0.42,
    );
    // The keyboard is up over the Chat tab of a narrow layout: the chat gets every pixel above it, and the header and
    // the Start strip give way.
    const compact = this.#covered > 0 && full.mode !== "wide" && this.#tab === "chat" && chatOn(state);
    const layout = compact ? this.#compactLayout(full, bar.height, gutter, width, height) : full;
    this.#activity = null;
    if (!compact) this.#drawHeader(layout.header, phone);
    // What has been read: the chat on screen is read; otherwise the lines since it was last looked at are the badge.
    if (layout.panels.chat) chatSeen.markSeen(state.roomId, state.chatLive);
    const unread = layout.panels.chat ? 0 : unreadChatCount(state, chatSeen.seenFor(state.roomId));

    if (layout.tabs) {
      const ids = layout.tabIds.filter((id) => id !== "chat" || chatOn(state));
      const cell = layout.tabs.width / ids.length;
      this.#tabs = new McTabs(this, {
        rect: layout.tabs,
        tabs: ids.map((id) => ({
          id,
          label: id === "seats" && state.epic ? t("epic.tab.tables") : t(`room.tab.${id}` as const),
          ...(id === "chat" && unread > 0 ? { badge: unread } : {}),
        })),
        activeId: layout.mode === "stack" && this.#tab === "seats" ? "settings" : this.#tab,
        onSelect: (id) => {
          this.#tab = id as LobbyPanelId;
          this.#draw();
        },
      });
      ids.forEach((id, i) =>
        this.#addStop(
          `tab:${id}`,
          { x: layout.tabs!.x + i * cell, y: layout.tabs!.y, width: cell, height: layout.tabs!.height },
          () => {
            this.#tab = id;
            this.#draw();
          },
        ),
      );
    }

    const titled = layout.mode !== "tabs";
    if (layout.panels.seats) this.#drawSeatsPanel(layout.panels.seats, titled);
    if (layout.panels.settings) this.#drawSettingsPanel(layout.panels.settings, titled);
    if (layout.panels.chat) this.#drawChatPanel(layout.panels.chat, titled, phone);
    else this.#chatInput?.setVisible(false);
    if (!compact) this.#drawFooter(layout.footer, phone);
    this.#route?.set(this.#order, this.#stops);
  }

  /** The chat-only layout while the keyboard is up: the tab strip just under the top bar, the chat above the keyboard. */
  #compactLayout(full: LobbyLayout, barHeight: number, gutter: number, width: number, height: number): LobbyLayout {
    const tabs = full.tabs ? { ...full.tabs, y: barHeight + 6 } : null;
    const top = tabs ? tabs.y + tabs.height + 6 : barHeight + 6;
    const chat = chatRectAboveKeyboard({
      top,
      x: gutter,
      width: width - gutter * 2,
      layoutHeight: height,
      covered: this.#covered,
    });
    const none = { x: gutter, y: 0, width: 0, height: 0 };
    return { ...full, header: none, footer: none, tabs, panels: { chat } };
  }

  #addStop(key: string, rect: Rect | (() => Rect), activate: () => void, extra: Partial<FocusStop> = {}): void {
    this.#stops.set(key, { rect, activate, ...extra });
    this.#order.push(key);
  }

  // The header: the code, Copy link, and the connection line.
  #drawHeader(rect: Rect, phone: boolean): void {
    const state = this.#state;
    this.add.rectangle(rect.x, rect.y, rect.width, rect.height, INK).setOrigin(0, 0);
    this.add
      .text(rect.x + 14, rect.y + 8, t("room.title").toUpperCase(), textStyle(typeRole.label, PAPER, 0.7))
      .setLetterSpacing(1.1);
    this.add
      .text(rect.x + 14, rect.y + 24, codeShown(state.code), textStyle(bangers(phone ? 36 : 44), PAPER))
      .setLetterSpacing(4);
    const copyWidth = phone ? 120 : 160;
    const copyRect: Rect = {
      x: rect.x + rect.width - copyWidth - 12,
      y: rect.y + 8,
      width: copyWidth,
      height: hit.target,
    };
    const copy = (): void => {
      if (!state.link || state.connection === "ended") return;
      void copyText(state.link).then((ok) => {
        if (!ok || !this.#alive) return;
        this.#linkCopied = true;
        this.#draw();
        this.time.delayedCall(2000, () => {
          this.#linkCopied = false;
          if (this.#alive) this.#draw();
        });
      });
    };
    this.#button({
      kind: "onInk",
      label: this.#linkCopied ? t("room.linkCopied") : t("room.copyLink"),
      type: typeRole.label,
      rect: copyRect,
      enabled: state.link !== null && state.connection !== "ended",
      onClick: copy,
    });
    this.#addStop("copy", copyRect, copy);
    const words = connectionWords(state);
    if (words) {
      const line = this.add
        .text(
          rect.x + 14,
          rect.y + rect.height - 22,
          wordsText(words),
          textStyle(typeRole.rowTitle, surface.inkOnHue.hex),
        )
        .setFontSize(12)
        .setBackgroundColor("#f2b01e")
        .setPadding(6, 2, 6, 2);
      fitText(line, rect.width - 28, 12);
    }
  }

  /** A panel's frame and heading; returns the room inside it for content. */
  #frame(rect: Rect, title: string | null): Rect {
    const g = this.add.graphics();
    g.fillStyle(PARCHMENT, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(2, INK, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    let top = rect.y + 8;
    if (title) {
      this.add.text(rect.x + 12, rect.y + 8, title.toUpperCase(), textStyle(bangers(18), INK)).setLetterSpacing(1);
      top = rect.y + 38;
    }
    return { x: rect.x + 10, y: top, width: rect.width - 20, height: rect.y + rect.height - top - 8 };
  }

  /**
   * A scrolling panel: `draw` puts its content at `inner`'s own coordinates and returns the content's height. Its
   * buttons take the region's clip and drag so a swipe never presses one (issue #227).
   */
  #scrollPanel(
    key: ScrollKey,
    inner: Rect,
    draw: (
      x: number,
      top: number,
      width: number,
      region: {
        clip: () => Rect;
        suppress: () => boolean;
        stop: (key: string, rect: Rect, activate: () => void) => void;
      },
    ) => number,
  ): McScrollRegion {
    const scroll = this.#scrolls[key];
    const heights = [inner.height];
    const region = new McScrollRegion(this, { rect: inner, heights, scroll, clipInteractive: true });
    this.#regions.push(region);
    const before = this.children.list.length;
    const guard = {
      clip: (): Rect => inner,
      suppress: (): boolean => region.isDragSuppressingClick,
      stop: (stopKey: string, rect: Rect, activate: () => void): void => {
        const bringIntoView = (): void => {
          const top = rect.y - inner.y - scroll.offsetPx;
          const over = top + rect.height - inner.height;
          if (top < 0) region.scrollByPx(top);
          else if (over > 0) region.scrollByPx(over);
        };
        this.#addStop(stopKey, () => ({ ...rect, y: rect.y - scroll.offsetPx }), activate, {
          ensureVisible: bringIntoView,
          view: inner,
        });
      },
    };
    const used = draw(inner.x, inner.y, inner.width - 12, guard);
    heights[0] = Math.max(inner.height, used);
    const added = this.children.list.slice(before).filter((node) => node !== region.root);
    if (added.length > 0) region.content.add(added);
    region.refresh();
    // A "give to" list just opened lies in view (a phone's list would otherwise open below the fold).
    const reveal = this.#reveal;
    if (reveal) {
      this.#reveal = null;
      const top = reveal.y - inner.y - scroll.offsetPx;
      const over = top + reveal.height - inner.height;
      if (over > 0) region.scrollByPx(Math.min(over, top));
    }
    return region;
  }

  // ---- People and seats ----------------------------------------------------------------------------------------

  #drawSeatsPanel(rect: Rect, titled: boolean): void {
    if (this.#state.epic) return this.#drawEpicPanel(rect, titled);
    const inner = this.#frame(rect, titled ? t("room.seats") : null);
    const state = this.#state;
    this.#scrollPanel("seats", inner, (x, top, w, guard) => {
      let y = top + 2;
      if (this.#isHost()) {
        const hintKey = this.#state.settings?.askToSit === true ? "room.hostHint" : "room.hostHintClaim";
        const hint = this.#text(x, y, t(hintKey), 13, w, { alpha: 0.85 });
        y += hint.height + 8;
        const setupRect: Rect = { x, y, width: w, height: hit.target };
        const label = roomDraft() ? t("room.setupAgain") : t("room.setup");
        this.#button({
          kind: roomDraft() ? "secondary" : "primary",
          label,
          type: typeRole.label,
          rect: setupRect,
          onClick: () => this.#setUpTable(),
          clip: guard.clip,
          suppressClick: guard.suppress,
        });
        guard.stop("setup", setupRect, () => this.#setUpTable());
        y += hit.target + 10;
        y = this.#drawSeatCount(x, y, w, guard) + 14;
      } else if (!state.buildMatches) {
        const note = this.#text(x, y, t(myBuildReason(state)), 13, w, { bold: true });
        y += note.height + 10;
      }
      if (this.#startResult) y = this.#drawStartResult(this.#startResult, x, y, w, guard) + 12;
      const rows = seatRows(state, { installed: this.#installed(), refused: this.#refused });
      if (rows.length === 0) {
        const none = this.#text(x, y, t(this.#isHost() ? "room.seats.noneHost" : "room.seats.none"), 14, w, {
          alpha: 0.85,
        });
        y += none.height + 10;
      }
      for (const row of rows) y += this.#drawSeatRow(row, x, y, w, guard) + 10;
      y += 6;
      y = this.#heading(x, y, w, t("room.people"));
      for (const person of participantRows(state)) {
        const hasMore = person.seats.length > 0 || person.differentVersion;
        // The device is a line of words with a small icon (never the icon alone), when their client said what it runs on.
        const rowHeight = 38 + (person.device ? 18 : 0) + (hasMore ? 16 : 0);
        const g = this.add.graphics();
        g.lineStyle(1, INK, 0.35).strokeRect(x + 0.5, y + 0.5, w - 1, rowHeight - 1);
        const roleText = this.add
          .text(0, 0, t(person.roleKey).toUpperCase(), textStyle(typeRole.label, INK))
          .setFontSize(11)
          .setLetterSpacing(1);
        const chipW = roleText.width + 14;
        g.lineStyle(2, INK, 1).strokeRect(x + w - chipW - 8, y + 8, chipW, 22);
        roleText
          .setPosition(x + w - chipW - 1, y + 19)
          .setOrigin(0.5, 0.5)
          .setX(x + w - chipW / 2 - 8);
        const name = this.add.text(
          x + 10,
          y + 10,
          person.me ? `${person.name} (${t("room.you")})` : person.name,
          textStyle(typeRole.rowTitle, INK),
        );
        fitText(name, w - chipW - 30, 15);
        let lineY = y + 30;
        if (person.device) {
          const mark = person.platform ? playPlatformMarkOf({ platform: person.platform }) : null;
          let tx = x + 10;
          if (mark) {
            const icon = this.add.graphics();
            drawPlayPlatformIcon(icon, mark, { x: x + 10, y: lineY + 1, width: 14, height: 14 }, INK, 0.85);
            tx += 20;
          }
          this.#text(tx, lineY, person.device, 12, w - (tx - x) - 10, { alpha: 0.85 });
          lineY += 18;
        }
        const more = [...person.seats];
        if (person.differentVersion) more.push(t(person.buildBadge));
        if (more.length > 0) this.#text(x + 10, lineY, more.join(" · "), 12, w - 20, { alpha: 0.8 });
        y += rowHeight + 6;
      }
      return y - top + 4;
    });
  }

  /** The host's seat count: fewer / more (one to four). A seat somebody holds is never dropped by a press. */
  #drawSeatCount(
    x: number,
    y: number,
    w: number,
    guard: { clip: () => Rect; suppress: () => boolean; stop: (key: string, rect: Rect, activate: () => void) => void },
  ): number {
    const count = this.#state.seats.length;
    const size = hit.target;
    const label = this.add
      .text(x, y + size / 2, `${t("room.seats.count")}: ${count}`, textStyle(typeRole.rowTitle, INK))
      .setOrigin(0, 0.5)
      .setFontSize(15);
    const lastHeld = this.#state.seats[count - 1]?.holder != null;
    const buttons: { id: string; label: string; to: number; enabled: boolean; reason?: string; aria: string }[] = [
      {
        id: "less",
        label: "−",
        to: count - 1,
        enabled: count > ROOM_SEATS_MIN && !lastHeld,
        ...(count > ROOM_SEATS_MIN && lastHeld ? { reason: t("room.seats.lastHeld") } : {}),
        aria: t("room.seats.fewer"),
      },
      { id: "more", label: "+", to: count + 1, enabled: count < ROOM_SEATS_MAX, aria: t("room.seats.more") },
    ];
    let bx = x + w - size * 2 - 8;
    for (const button of buttons) {
      const rect: Rect = { x: bx, y, width: size, height: size };
      const go = (): void => {
        if (!button.enabled) {
          if (button.reason) this.#say(button.reason);
          this.#draw();
          return;
        }
        this.#setSeatCount(button.to);
      };
      this.#button({
        kind: "secondary",
        label: button.label,
        type: { ...typeRole.label, size: 18 },
        rect,
        enabled: button.enabled,
        ...(button.reason ? { reason: button.reason } : {}),
        onUnavailablePress: go,
        onClick: go,
        clip: guard.clip,
        suppressClick: guard.suppress,
      });
      guard.stop(`seats:${button.id}`, rect, go);
      bx += size + 8;
    }
    fitText(label, Math.max(60, w - size * 2 - 20), 15);
    const hint = this.#text(x, y + size + 4, t("room.seats.countHint"), 12, w, { alpha: 0.8 });
    return y + size + 4 + hint.height;
  }

  /** What the host's Start said when it did not start the game: the headline and a line per refused seat. */
  #drawStartResult(
    result: StartResultView,
    x: number,
    y: number,
    w: number,
    guard: { clip: () => Rect; suppress: () => boolean; stop: (key: string, rect: Rect, activate: () => void) => void },
  ): number {
    const pad = 10;
    const bg = this.add.graphics();
    const mark = this.add.graphics();
    let cy = y + 10;
    const head = this.#text(x + pad + 26, cy, wordsText(result.headline), 14, w - pad * 2 - 26, { bold: true });
    mark.fillStyle(INK, 1).fillRect(x + pad, cy, 18, 18);
    this.add.text(x + pad + 9, cy + 9, "!", textStyle(bangers(16), PAPER)).setOrigin(0.5);
    cy += Math.max(head.height, 18) + 6;
    for (const line of result.lines) {
      const who = line.holder === "" ? "" : ` (${line.holder})`;
      const text = this.#text(
        x + pad,
        cy,
        t("room.startResult.seatLine", { seat: line.seat, who, title: line.title, reason: line.reason }),
        12,
        w - pad * 2,
      );
      cy += text.height + 6;
    }
    const rect: Rect = { x: x + pad, y: cy + 2, width: w - pad * 2, height: hit.target };
    const dismiss = (): void => {
      this.#startResult = null;
      this.#draw();
    };
    this.#button({
      kind: "secondary",
      label: t("room.startResult.dismiss"),
      type: { ...typeRole.label, size: 12 },
      rect,
      onClick: dismiss,
      clip: guard.clip,
      suppressClick: guard.suppress,
    });
    guard.stop("start-result-dismiss", rect, dismiss);
    cy += hit.target + 12;
    bg.fillStyle(PAPER, 1).fillRect(x, y, w, cy - y);
    bg.lineStyle(3, INK, 1).strokeRect(x + 1.5, y + 1.5, w - 3, cy - y - 3);
    return cy;
  }

  #heading(x: number, y: number, w: number, text: string): number {
    const h = this.add.text(x, y, text.toUpperCase(), textStyle(bangers(17), INK)).setLetterSpacing(1);
    const g = this.add.graphics();
    g.fillStyle(INK, 1).fillRect(x + h.width + 10, y + h.height / 2 - 1, Math.max(0, w - h.width - 10), 2);
    return y + h.height + 8;
  }

  /**
   * One seat's card: its name, the deck in it (the hero's picture, hero, aspect, deck name, card count, "preset" and mods),
   * who holds it (a filled dot when connected, a hollow one when away), its action, the deck button, a deck the host turned
   * down (with the reason), mods this device lacks (with a Mod Store link) and requests.
   */
  #drawSeatRow(
    row: SeatRowView,
    x: number,
    y: number,
    w: number,
    guard: { clip: () => Rect; suppress: () => boolean; stop: (key: string, rect: Rect, activate: () => void) => void },
  ): number {
    const pad = 10;
    const buttonWidth = 104;
    const art = 56;
    // The card's ground and frame are drawn last, once the height is known; created first so it sits under everything.
    const bg = this.add.graphics();
    const g = this.add.graphics();
    const tx = x + pad + art + 10;
    const textWidth = w - (tx - x) - pad - (row.action ? buttonWidth + 8 : 0);
    const deck = row.deck;

    let ty = y + 8;
    const tag = [row.name, ...(deck?.preset ? [t("room.deck.preset")] : [])].join(" · ").toUpperCase();
    const nameText = this.add
      .text(tx, ty, tag, textStyle(typeRole.label, INK, 0.75))
      .setFontSize(11)
      .setLetterSpacing(1);
    fitText(nameText, textWidth, 11);
    ty += nameText.height + 2;
    if (deck) {
      const hero = this.#text(tx, ty, deck.heroName, 15, textWidth, { bold: true });
      ty += hero.height + 1;
      const detail = [deck.aspects, deck.name, tPlural("room.deck.cards", deck.cards)]
        .filter((p) => p !== "")
        .join(" · ");
      const line = this.#text(tx, ty, detail, 12, textWidth, { alpha: 0.85 });
      ty += line.height + 2;
      if (deck.mods.length > 0) {
        const mods = this.#text(
          tx,
          ty,
          t("room.deck.mods", { mods: deck.mods.map((m) => `${m.id} v${m.version}`).join(", ") }),
          12,
          textWidth,
          { alpha: 0.8 },
        );
        ty += mods.height + 2;
      }
    } else {
      const none = this.#text(tx, ty, t("room.deck.none"), 15, textWidth, { bold: true, alpha: 0.7 });
      ty += none.height + 2;
    }
    // Who holds it.
    const dotY = ty + 12;
    const held = row.holderName !== null;
    g.lineStyle(2, INK, 1);
    if (held && row.holderConnected) g.fillStyle(INK, 1).fillCircle(tx + 6, dotY, 6);
    else g.strokeCircle(tx + 6, dotY, 6);
    const device = row.holderDevice && textWidth >= 230 ? ` · ${row.holderDevice}` : "";
    const who = held
      ? `${row.holderName}${row.mine ? ` (${t("room.you")})` : ""}${row.holderConnected ? "" : ` · ${t("room.seat.away")}`}${row.takenOver ? ` · ${t("room.seat.takenOver")}` : ""}${device}`
      : t("room.seat.open");
    const holder = this.add
      .text(tx + 20, dotY, who, textStyle(typeRole.body, INK, held ? 1 : 0.7))
      .setOrigin(0, 0.5)
      .setFontSize(14);
    fitText(holder, textWidth - 20, 14);
    ty = dotY + 12;
    if (row.requestedByMe) {
      const asked = this.#text(tx, ty + 2, t("room.seat.requestedByMe"), 12, textWidth, { alpha: 0.85 });
      ty += asked.height + 4;
    }
    if (row.mismatch) {
      const mark = this.add
        .text(tx + 6, ty + 4, t("room.differentVersion").toUpperCase(), textStyle(typeRole.label, INK))
        .setFontSize(11)
        .setLetterSpacing(1);
      g.lineStyle(2, INK, 1).strokeRect(tx, ty, mark.width + 12, 20);
      ty += 26;
    }

    // The hero's picture (the identity card's art, as Take your seats shows it) at the left; an empty frame until a deck.
    const artRect: Rect = { x: x + pad, y: y + 10, width: art, height: art };
    if (deck) {
      drawHeroAvatar(this, artRect, currentCardsById().get(deck.cardId), INK);
      this.#hoverFaces.push({ cardId: deck.cardId, rect: artRect, view: guard.clip(), scroll: "seats" });
    } else {
      g.lineStyle(2, INK, 0.45).strokeRect(artRect.x + 1, artRect.y + 1, art - 2, art - 2);
      this.add.text(artRect.x + art / 2, artRect.y + art / 2, "?", textStyle(bangers(30), INK, 0.4)).setOrigin(0.5);
    }

    const canGive = row.candidates.length > 0 || (this.#isHost() && row.holderName === null);
    const picking = canGive && this.#picking === row.id;
    const pickHeight = picking ? (row.candidates.length > 0 ? row.candidates.length * (hit.target + 6) + 6 : 30) : 0;
    const buttonsBottom = y + 10 + hit.target + (canGive || row.play ? 6 + hit.target : 0) + 10;
    let cy = Math.max(ty + 6, artRect.y + art + 10, row.action ? buttonsBottom : 0);
    const topEnd = cy - y;

    if (row.action) {
      const action = row.action;
      const rect: Rect = { x: x + w - pad - buttonWidth, y: y + 10, width: buttonWidth, height: hit.target };
      const go = (): void => {
        if (!action.enabled) {
          if (action.reason) this.#say(t(action.reason));
          this.#draw();
          return;
        }
        if (action.kind === "ask" || action.kind === "take") this.#api.requestSeat(row.id);
        else if (action.kind === "leave" || action.kind === "withdraw") this.#api.releaseSeat(row.id);
        else if (action.kind === "remove" && action.participant) this.#api.denySeat(row.id, action.participant);
      };
      this.#button({
        kind:
          action.kind === "leave" || action.kind === "withdraw" || action.kind === "remove" ? "secondary" : "primary",
        label: t(action.labelKey),
        type: { ...typeRole.label, size: 12 },
        rect,
        enabled: action.enabled,
        ...(action.reason ? { reason: t(action.reason) } : {}),
        onUnavailablePress: go,
        onClick: go,
        clip: guard.clip,
        suppressClick: guard.suppress,
        wrap: true,
      });
      guard.stop(`seat:${row.id}`, rect, go);
    }
    if (row.play) {
      const play = row.play;
      const playRect: Rect = {
        x: x + w - pad - buttonWidth,
        y: y + 10 + hit.target + 6,
        width: buttonWidth,
        height: hit.target,
      };
      const go = (): void => {
        if (play.kind === "giveBack") {
          this.#api.giveBackSeat(row.id);
          return;
        }
        // Acting for someone is the host's call, and a returning player may find their hero moved: confirm first.
        const hero = row.deck?.heroName ?? row.name;
        const name = row.holderName ?? "";
        const vacant = row.holderName === null;
        askToConfirm(
          this,
          t(vacant ? "takeover.vacantTitle" : "takeover.title", { name, hero }),
          t(vacant ? "takeover.vacantBody" : "takeover.body", { name, hero }),
          t("takeover.confirm"),
          () => this.#api.takeOverSeat(row.id),
        );
      };
      this.#button({
        kind: "primary",
        label: t(play.labelKey),
        type: { ...typeRole.label, size: 12 },
        rect: playRect,
        onClick: go,
        clip: guard.clip,
        suppressClick: guard.suppress,
        wrap: true,
      });
      guard.stop(`play:${row.id}`, playRect, go);
    }
    if (canGive) {
      const giveRect: Rect = {
        x: x + w - pad - buttonWidth,
        y: y + 10 + hit.target + 6,
        width: buttonWidth,
        height: hit.target,
      };
      const toggle = (): void => {
        this.#picking = picking ? null : row.id;
        this.#revealPicker = this.#picking !== null;
        this.#draw();
      };
      this.#button({
        kind: "secondary",
        label: t("room.seat.give"),
        type: { ...typeRole.label, size: 12 },
        rect: giveRect,
        selected: picking,
        onClick: toggle,
        clip: guard.clip,
        suppressClick: guard.suppress,
      });
      guard.stop(`give:${row.id}`, giveRect, toggle);
      if (picking) {
        let py = y + topEnd + 6;
        if (this.#revealPicker) {
          this.#revealPicker = false;
          this.#reveal = { x, y: y + topEnd, width: w, height: pickHeight };
        }
        if (row.candidates.length === 0)
          this.#text(x + pad, py + 4, t("room.seat.giveNobody"), 12, w - pad * 2, { alpha: 0.85 });
        for (const person of row.candidates) {
          const rect: Rect = { x: x + pad, y: py, width: w - pad * 2, height: hit.target };
          const give = (): void => {
            this.#picking = null;
            this.#api.assignSeat(row.id, person.id);
            this.#draw();
          };
          this.#button({
            kind: "primary",
            label: person.name,
            type: { ...typeRole.label, size: 13 },
            rect,
            onClick: give,
            clip: guard.clip,
            suppressClick: guard.suppress,
          });
          guard.stop(`give:${row.id}:${person.id}`, rect, give);
          py += hit.target + 6;
        }
      }
    }
    cy += pickHeight;

    // A deck the host's check turned down: the reason in the engine's words, boxed and headed (never colour alone).
    if (row.problem) {
      const problem = row.problem;
      const boxX = x + pad;
      const boxW = w - pad * 2;
      const head = this.add
        .text(boxX + 30, cy + 8, t("room.deckProblem.heading").toUpperCase(), textStyle(typeRole.label, INK))
        .setFontSize(11)
        .setLetterSpacing(1);
      fitText(head, boxW - 40, 11);
      const title = this.#text(boxX + 30, cy + 8 + head.height + 2, t(problem.titleKey), 14, boxW - 40, { bold: true });
      const reason = this.#text(boxX + 30, cy + 8 + head.height + 2 + title.height + 2, problem.reason, 12, boxW - 40, {
        alpha: 0.9,
      });
      const boxH = 8 + head.height + 2 + title.height + 2 + reason.height + 10;
      g.lineStyle(3, INK, 1).strokeRect(boxX + 1.5, cy + 1.5, boxW - 3, boxH - 3);
      g.fillStyle(INK, 1).fillRect(boxX + 8, cy + 10, 16, 16);
      this.add.text(boxX + 16, cy + 18, "!", textStyle(bangers(16), PAPER)).setOrigin(0.5);
      cy += boxH + 8;
    }

    // Mods this device lacks for the deck on my seat: named, with the Mod Store opened on each.
    for (const mod of row.missingMods) {
      const line = this.#text(
        x + pad,
        cy + 2,
        t("room.deck.needMod", { mod: `${mod.id} v${mod.version}` }),
        12,
        w - pad * 2,
        {
          bold: true,
        },
      );
      cy += line.height + 6;
      const store: Rect = { x: x + pad, y: cy, width: w - pad * 2, height: hit.target };
      const open = (): void => {
        this.scale.off("resize", this.#draw, this);
        goToScreen(this, SCENES.modStore, {
          packId: mod.id,
          returnTo: SCENES.roomLobby,
        } satisfies ModStoreSceneData);
      };
      this.#button({
        kind: "secondary",
        label: t("room.mods.store"),
        type: { ...typeRole.label, size: 12 },
        rect: store,
        onClick: open,
        clip: guard.clip,
        suppressClick: guard.suppress,
      });
      guard.stop(`modstore:${row.id}:${mod.id}`, store, open);
      cy += hit.target + 8;
    }

    // Choose your deck / Change deck on my seat; Set deck for the host on any other.
    if (row.deckButton) {
      const button = row.deckButton;
      const rect: Rect = { x: x + pad, y: cy, width: w - pad * 2, height: hit.target };
      const go = (): void => {
        if (!button.enabled) {
          if (button.reason) this.#say(t(button.reason));
          this.#draw();
          return;
        }
        this.#pickDeck(row.id, button.kind === "preset");
      };
      this.#button({
        kind: button.kind === "choose" && !row.deck ? "primary" : "secondary",
        label: t(button.labelKey),
        type: { ...typeRole.label, size: 13 },
        rect,
        enabled: button.enabled,
        ...(button.reason ? { reason: t(button.reason) } : {}),
        onUnavailablePress: go,
        onClick: go,
        clip: guard.clip,
        suppressClick: guard.suppress,
      });
      guard.stop(`deck:${row.id}`, rect, go);
      cy += hit.target + 10;
    }

    // The host's Approve and Deny for each request.
    const requestHeight = 78;
    row.requests.forEach((request, index) => {
      const top = cy + index * requestHeight;
      g.lineStyle(1, INK, 0.5).lineBetween(x + pad, top, x + w - pad, top);
      this.#text(x + pad, top + 8, t("room.seat.asks", { name: request.name }), 13, w - pad * 2, { bold: true });
      const half = (w - pad * 2 - 8) / 2;
      const approve: Rect = { x: x + pad, y: top + 28, width: half, height: hit.target };
      const deny: Rect = { x: x + pad + half + 8, y: top + 28, width: half, height: hit.target };
      const ok = (): void => {
        if (!request.approvable) {
          if (request.reason) this.#say(t(request.reason));
          this.#draw();
          return;
        }
        this.#api.assignSeat(row.id, request.participant);
      };
      const no = (): void => this.#api.denySeat(row.id, request.participant);
      this.#button({
        kind: "primary",
        label: t("room.seat.approve"),
        type: { ...typeRole.label, size: 12 },
        rect: approve,
        enabled: request.approvable,
        ...(request.reason ? { reason: t(request.reason) } : {}),
        onUnavailablePress: ok,
        onClick: ok,
        clip: guard.clip,
        suppressClick: guard.suppress,
      });
      this.#button({
        kind: "secondary",
        label: t("room.seat.deny"),
        type: { ...typeRole.label, size: 12 },
        rect: deny,
        onClick: no,
        clip: guard.clip,
        suppressClick: guard.suppress,
      });
      guard.stop(`approve:${row.id}:${request.participant}`, approve, ok);
      guard.stop(`deny:${row.id}:${request.participant}`, deny, no);
    });
    cy += row.requests.length * requestHeight;

    const height = cy - y;
    bg.fillStyle(PAPER, 1).fillRect(x, y, w, height);
    bg.lineStyle(row.mine ? 4 : 2, INK, 1).strokeRect(x + 1, y + 1, w - 2, height - 2);
    return height;
  }

  // ---- Epic tables (issue #882) -----------------------------------------------------------------------------------

  /** A full-width button inside a scrolling panel, with its focus stop; returns the next y. */
  #panelButton(
    x: number,
    y: number,
    w: number,
    label: string,
    run: () => void,
    guard: PanelGuard,
    key: string,
    options: { kind?: "primary" | "secondary"; selected?: boolean; enabled?: boolean; reason?: string } = {},
  ): number {
    const rect: Rect = { x, y, width: w, height: hit.target };
    const enabled = options.enabled ?? true;
    const go = (): void => {
      if (!enabled) {
        if (options.reason) this.#say(options.reason);
        this.#draw();
        return;
      }
      run();
    };
    this.#button({
      kind: options.kind ?? "secondary",
      label,
      type: { ...typeRole.label, size: 12 },
      rect,
      enabled,
      ...(options.selected ? { selected: true } : {}),
      ...(options.reason ? { reason: options.reason } : {}),
      onUnavailablePress: go,
      onClick: go,
      clip: guard.clip,
      suppressClick: guard.suppress,
      wrap: true,
    });
    guard.stop(key, rect, go);
    return y + hit.target + 6;
  }

  /** Two buttons side by side (a plus and a minus, a pair of choices). */
  #panelPair(
    x: number,
    y: number,
    w: number,
    left: { label: string; run: () => void; enabled: boolean; key: string },
    right: { label: string; run: () => void; enabled: boolean; key: string },
    guard: PanelGuard,
  ): number {
    const half = (w - 8) / 2;
    this.#panelButton(x, y, half, left.label, left.run, guard, left.key, { enabled: left.enabled });
    this.#panelButton(x + half + 8, y, half, right.label, right.run, guard, right.key, { enabled: right.enabled });
    return y + hit.target + 6;
  }

  #epicSheet(data: EpicSheetData): void {
    const given = this.#preview ? ({ ...data, preview: this.#state } as EpicSheetData) : data;
    if (!this.scene.isActive(SCENES.epicSheet)) this.scene.launch(SCENES.epicSheet, given);
  }

  #sendPlan(plan: EpicPlan): void {
    if (this.#preview) {
      ((globalThis as { __mcRoomCalls?: string[] }).__mcRoomCalls ??= []).push(`setEpic(${plan.tables.length}t)`);
    } else setEpic(plan.tables, plan.pods, plan.seats);
  }

  #drawEpicPanel(rect: Rect, titled: boolean): void {
    const inner = this.#frame(rect, titled ? t("epic.tables.title") : null);
    const state = this.#state;
    const epic = state.epic!;
    const organizer = this.#isHost();
    this.#scrollPanel("seats", inner, (x, top, w, guard) => {
      let y = top + 2;
      const hint = this.#text(x, y, t(organizer ? "epic.hint.organizer" : "epic.hint.player"), 13, w, { alpha: 0.85 });
      y += hint.height + 8;
      const plan = planOf(state);
      if (organizer && plan && !epic.start) {
        y = this.#panelPair(
          x,
          y,
          w,
          {
            label: t("epic.tables.fewer"),
            run: () => this.#sendPlan(withTableCount(plan, plan.tables.length - 1)),
            enabled: plan.tables.length > MIN_EPIC_TABLES,
            key: "epic:fewer",
          },
          {
            label: t("epic.tables.more"),
            run: () => this.#sendPlan(withTableCount(plan, plan.tables.length + 1)),
            enabled: plan.tables.length < MAX_EPIC_TABLES,
            key: "epic:more",
          },
          guard,
        );
        const limit = epic.timeLimitMinutes;
        const words = `${t("epic.timeLimit.title")}: ${limit === null ? t("epic.timeLimit.none") : minutesText(limit)}`;
        y = this.#panelButton(
          x,
          y,
          w,
          words,
          () =>
            this.#api.setLobby({
              settings: { tableRules: withEpicTimeLimit(state.settings?.tableRules, nextTimeLimit(limit)) },
            }),
          guard,
          "epic:limit",
        );
        const note = this.#text(x + 4, y - 2, t("epic.timeLimit.note"), 12, w - 8, { alpha: 0.75 });
        y += note.height + 8;
      } else if (epic.timeLimitMinutes !== null) {
        const line = this.#text(x, y, `${t("epic.timeLimit.title")}: ${minutesText(epic.timeLimitMinutes)}`, 13, w, {
          bold: true,
        });
        y += line.height + 8;
      }
      for (const view of epicTableViews(state, { installed: this.#installed() })) {
        y = this.#drawEpicTable(view, plan, x, y, w, guard) + 12;
      }
      y = this.#heading(x, y, w, t("room.people"));
      for (const person of participantRows(state)) {
        const seats = person.seats.length > 0 ? ` · ${person.seats.join(", ")}` : "";
        const line = `${person.me ? `${person.name} (${t("room.you")})` : person.name} · ${t(person.roleKey)}${seats}`;
        y += this.#text(x + 4, y, line, 13, w - 8).height + 6;
      }
      return y - top + 4;
    });
  }

  /** One table's card: name, pod, difficulty and status in words, its host, the organizer's controls and its seats. */
  #drawEpicTable(
    view: EpicTableView,
    plan: EpicPlan | null,
    x: number,
    y0: number,
    w: number,
    guard: PanelGuard,
  ): number {
    const organizer = this.#isHost();
    const editable = organizer && plan !== null && !this.#state.epic?.start;
    const pad = 10;
    const inW = w - pad * 2;
    let y = y0 + pad;
    const g = this.add.graphics();
    const name = this.add.text(x + pad, y, view.name, textStyle(typeRole.rowTitle, INK)).setFontSize(17);
    fitText(name, inW, 17);
    y += name.height + 4;
    const facts = [
      t("epic.table.pod", { pod: view.podName }),
      t(`epic.difficulty.${view.difficulty}` as const),
      t(statusKey(view.status)),
    ].join(" · ");
    y += this.#text(x + pad, y, facts, 13, inW, { alpha: 0.9 }).height + 2;
    const hostLine = view.hostName
      ? t(view.hostConnected ? "epic.table.host" : "epic.table.hostAway", { name: view.hostName })
      : t("epic.table.hostNone");
    y += this.#text(x + pad, y, view.mine ? t("epic.table.hostYou") : hostLine, 13, inW, { bold: true }).height + 8;
    if (editable) {
      const id = view.id;
      const p = plan;
      y = this.#panelPair(
        x + pad,
        y,
        inW,
        {
          label: t("epic.table.rename"),
          run: () => this.#epicSheet({ kind: "rename", table: id }),
          enabled: true,
          key: `rename:${id}`,
        },
        {
          label: t("epic.table.podNext"),
          run: () => this.#sendPlan(withNextPod(p, id)),
          enabled: true,
          key: `pod:${id}`,
        },
        guard,
      );
      y = this.#panelPair(
        x + pad,
        y,
        inW,
        {
          label: t(`epic.difficulty.${view.difficulty === "expert" ? "standard" : "expert"}` as const),
          run: () => this.#sendPlan(withNextDifficulty(p, id)),
          enabled: true,
          key: `diff:${id}`,
        },
        {
          label: t("epic.table.hostPick"),
          run: () => this.#epicSheet({ kind: "host", table: id }),
          enabled: true,
          key: `host:${id}`,
        },
        guard,
      );
      y = this.#panelPair(
        x + pad,
        y,
        inW,
        {
          label: t("epic.table.seatLess"),
          run: () => this.#sendPlan(withSeatCount(p, id, view.seatCount - 1)),
          enabled: view.canRemoveSeat,
          key: `less:${id}`,
        },
        {
          label: t("epic.table.seatMore"),
          run: () => this.#sendPlan(withSeatCount(p, id, view.seatCount + 1)),
          enabled: view.canAddSeat,
          key: `more:${id}`,
        },
        guard,
      );
    }
    // An organizer who hosts no table watches any table that has a game (no seat, no board of its own).
    if (organizer && !this.#state.epic?.hostsTable && view.status !== "lobby" && !this.#preview) {
      y = this.#panelButton(
        x + pad,
        y,
        inW,
        t("epic.sheet.watch"),
        () => void this.#watchTableFromLobby(view.id),
        guard,
        `watch:${view.id}`,
      );
    }
    const startId = this.#state.epic?.start?.id;
    if (view.mine && startId && epicRetryExhausted(this.#epicRetry, startId) && !this.#preview) {
      y = this.#panelButton(
        x + pad,
        y,
        inW,
        t("epic.table.retry"),
        () => {
          if (this.#epicRetry) this.#epicRetry = epicRetryNow(this.#epicRetry);
          void this.#maybeStartTable();
        },
        guard,
        `retry:${view.id}`,
      );
    }
    if (organizer && view.status === "waiting") {
      y = this.#panelButton(
        x + pad,
        y,
        inW,
        t("epic.sheet.drop"),
        () =>
          askToConfirm(
            this,
            t("epic.sheet.dropTitle", { table: view.name }),
            t("epic.sheet.dropBody", { table: view.name, name: view.hostName ?? "" }),
            t("epic.sheet.dropConfirm"),
            () => (this.#preview ? undefined : dropTable(view.id)),
          ),
        guard,
        `drop:${view.id}`,
      );
    }
    // Each seat shows its deck and the deck button of the standard seat row: the player (or the organizer, as a preset)
    // chooses the deck, and the hero is the deck's.
    for (const seat of view.seats) y += this.#drawSeatRow(seat, x + pad, y, inW, guard) + 6;
    const height = y - y0 + pad - 6;
    g.fillStyle(PARCHMENT, 1).fillRect(x, y0, w, height);
    g.lineStyle(view.mine ? 4 : 2, INK, 1).strokeRect(x + 1, y0 + 1, w - 2, height - 2);
    return y0 + height;
  }

  /**
   * A table host, once the organizer has started: deals this table's game from its seats' decks (fetched from the room
   * and judged on this device, the same path as a standard room's Start) and starts it, once per start (`epicStarted`).
   */
  async #maybeStartTable(): Promise<void> {
    const epic = this.#state.epic;
    if (this.#preview || !epic?.start || !epic.hostsTable) return;
    if (epicStarted.has(epic.start.id) || this.#starting) return;
    const table = epic.tables.find((x) => x.id === epic.hostsTable);
    if (!table) return;
    // After a failed try, ask again once the lobby's revision moves (any stored change, a deck swap included), or on
    // the bounded backoff for a transient failure (`view/epic-start-retry.ts`).
    const rev = this.#state.rev;
    if (!shouldAttemptEpicStart(this.#epicRetry, epic.start.id, rev, this.time.now)) return;
    const rules = this.#state.settings?.tableRules;
    const base = epicTableBase({
      seats: table.seats.length,
      difficulty: table.difficulty,
      scenario: currentScenarios().find((s) => (s.id as string) === EPIC_SCENARIO_ID),
      ...(rules?.sameNameHeroAllyConflict === true
        ? { tableRules: tableRulesOf({ sameNameHeroAllyConflict: true }) }
        : {}),
    });
    epicStarted.add(epic.start.id);
    this.#starting = true;
    this.#draw();
    const result = await startEpicTableRoomGame(base, table.seats);
    if (!this.#alive) return;
    if (!result.ok) {
      this.#starting = false;
      // Decks turned down were told to their holders by the room; the table host reads them here. A table that could not
      // start because a deck is missing is tried again when the decks change (`epicStarted` is cleared).
      epicStarted.delete(epic.start.id);
      this.#epicRetry = epicStartFailed(this.#epicRetry, epic.start.id, rev, result.reason, this.time.now);
      const wait = epicRetryDelay(this.#epicRetry, this.time.now);
      if (wait !== null) this.time.delayedCall(wait + 50, () => void this.#maybeStartTable());
      const view = startResultWords(result, this.#state);
      this.#say(t("epic.table.startFailed", { why: view ? startResultText(view) : t("room.refusal.generic") }));
      this.#draw();
      return;
    }
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.setupDeal);
  }

  async #watchTableFromLobby(table: string): Promise<void> {
    const result = await watchTable(table);
    if (!this.#alive) {
      if (result.ok) result.host.dispose();
      return;
    }
    if (!result.ok) {
      this.#say(t(result.message));
      this.#draw();
      return;
    }
    this.scale.off("resize", this.#draw, this);
    try {
      await introReplay(this, result.host, SCENES.roomLobby);
    } catch {
      this.scale.on("resize", this.#draw, this);
      this.#say(t("watch.link.gone"));
      this.#draw();
    }
  }

  // ---- Settings -------------------------------------------------------------------------------------------------

  #drawSettingsPanel(rect: Rect, titled: boolean): void {
    const inner = this.#frame(rect, titled ? t("room.settings.title") : null);
    const settings = this.#state.settings;
    const host = this.#isHost();
    this.#scrollPanel("settings", inner, (x, top, w, guard) => {
      let y = top + 2;
      if (!settings) {
        const wait = this.#text(x, y, t("room.state.connecting"), 14, w);
        return wait.height + 6;
      }
      if (!host) {
        const note = this.#text(x, y, t("room.settings.readOnly"), 12, w, { alpha: 0.75 });
        y += note.height + 8;
      }
      const toggleRow = (
        key: string,
        title: string,
        detail: string,
        on: boolean,
        change: () => void,
        locked = false,
      ): void => {
        const btnW = 76;
        const textW = w - btnW - 12;
        const name = this.#text(x, y, title, 14, textW, { bold: true });
        const info = this.#text(x, y + name.height + 2, detail, 12, textW, { alpha: 0.8 });
        const rowH = Math.max(hit.target, name.height + info.height + 4);
        const rect2: Rect = { x: x + w - btnW, y: y + (rowH - hit.target) / 2, width: btnW, height: hit.target };
        if (host && !locked) {
          this.#button({
            kind: "secondary",
            label: on ? t("room.on") : t("room.off"),
            type: typeRole.label,
            rect: rect2,
            selected: on,
            onClick: change,
            clip: guard.clip,
            suppressClick: guard.suppress,
          });
          guard.stop(key, rect2, change);
        } else {
          const g = this.add.graphics();
          g.lineStyle(2, INK, on ? 1 : 0.5).strokeRect(rect2.x, rect2.y + 4, rect2.width, hit.target - 8);
          this.add
            .text(
              rect2.x + rect2.width / 2,
              rect2.y + hit.target / 2,
              (on ? t("room.on") : t("room.off")).toUpperCase(),
              textStyle(typeRole.label, INK, on ? 1 : 0.6),
            )
            .setOrigin(0.5);
        }
        y += rowH + 8;
      };

      // Standard or Epic (Trickster Takeover): the organizer's choice, everyone's to read.
      y = this.#heading(x, y, w, t("epic.mode.title"));
      const epicOn = this.#state.epic !== null;
      if (host) {
        const half = (w - 8) / 2;
        const choose = (epic: boolean): void => {
          if (epic === epicOn) return;
          if (epic) this.#sendPlan(newEpicPlan());
          else this.#api.setLobby({ settings: { mode: "standard" } });
        };
        for (const [i, epic] of [false, true].entries()) {
          const btn: Rect = { x: x + i * (half + 8), y, width: half, height: hit.target };
          this.#button({
            kind: "secondary",
            label: t(epic ? "epic.mode.epic" : "epic.mode.standard"),
            type: typeRole.label,
            rect: btn,
            selected: epic === epicOn,
            onClick: () => choose(epic),
            clip: guard.clip,
            suppressClick: guard.suppress,
          });
          guard.stop(`epicmode:${epic}`, btn, () => choose(epic));
        }
        y += hit.target + 6;
        const info = this.#text(x + 4, y, t("epic.mode.epicDetail"), 12, w - 8, { alpha: 0.8 });
        y += info.height + 10;
      } else {
        const line = this.#text(x, y, t(epicOn ? "epic.mode.epic" : "epic.mode.standard"), 15, w, { bold: true });
        y += line.height + 8;
      }

      // How it's played.
      y = this.#heading(x, y, w, t("room.mode.title"));
      for (const mode of ["strict", "host"] as const) {
        const words = playModeKeys[mode];
        const selected = settings.playMode === mode;
        if (host) {
          const btn: Rect = { x, y, width: w, height: hit.target };
          const choose = (): void => this.#api.setLobby({ settings: { playMode: mode } });
          this.#button({
            kind: "secondary",
            label: t(words.title),
            type: typeRole.label,
            rect: btn,
            selected,
            onClick: choose,
            clip: guard.clip,
            suppressClick: guard.suppress,
          });
          guard.stop(`mode:${mode}`, btn, choose);
          y += hit.target + 4;
          const info = this.#text(x + 4, y, t(words.detail), 12, w - 8, { alpha: 0.8 });
          y += info.height + 10;
        } else if (selected) {
          const name = this.#text(x, y, t(words.title), 15, w, { bold: true });
          const info = this.#text(x, y + name.height + 2, t(words.detail), 12, w, { alpha: 0.85 });
          y += name.height + info.height + 12;
        }
      }

      // Villain phase pacing (#881): who steps a guest's villain phase screen along.
      y = this.#heading(x, y + 4, w, t("room.villain.title"));
      for (const value of ["host", "each"] as const) {
        const words = villainPacingKeys[value];
        const selected = pacingOf(settings) === value;
        if (host) {
          const btn: Rect = { x, y, width: w, height: hit.target };
          const choose = (): void => this.#api.setLobby({ settings: { villainPacing: value } });
          this.#button({
            kind: "secondary",
            label: t(words.title),
            type: typeRole.label,
            rect: btn,
            selected,
            onClick: choose,
            clip: guard.clip,
            suppressClick: guard.suppress,
          });
          guard.stop(`villain:${value}`, btn, choose);
          y += hit.target + 4;
          const info = this.#text(x + 4, y, t(words.detail), 12, w - 8, { alpha: 0.8 });
          y += info.height + 10;
        } else if (selected) {
          const name = this.#text(x, y, t(words.title), 15, w, { bold: true });
          const info = this.#text(x, y + name.height + 2, t(words.detail), 12, w, { alpha: 0.85 });
          y += name.height + info.height + 12;
        }
      }

      // Undo: who may take a move back (Strict forces Off).
      y = this.#heading(x, y + 4, w, t("room.undo.title"));
      for (const row of undoRows(settings)) {
        const pressable = host && settings.playMode !== "strict";
        if (pressable) {
          const btn: Rect = { x, y, width: w, height: hit.target };
          const choose = (): void => this.#api.setLobby({ settings: { undo: row.value } });
          this.#button({
            kind: "secondary",
            label: t(row.titleKey),
            type: typeRole.label,
            rect: btn,
            selected: row.selected,
            onClick: choose,
            clip: guard.clip,
            suppressClick: guard.suppress,
          });
          guard.stop(`undo:${row.value}`, btn, choose);
          y += hit.target + 4;
          const info = this.#text(x + 4, y, t(row.detailKey), 12, w - 8, { alpha: 0.8 });
          y += info.height + 10;
        } else if (row.selected) {
          const name = this.#text(x, y, t(row.titleKey), 15, w, { bold: true });
          const info = this.#text(x, y + name.height + 2, t(row.detailKey), 12, w, { alpha: 0.85 });
          y += name.height + info.height + 12;
        }
      }

      // Cheats: the host's own cheats on or off, fixed once the game starts; the note is for everyone.
      y = this.#heading(x, y + 4, w, t("room.cheats.title"));
      toggleRow(
        "cheats",
        t("room.cheats.title"),
        t("room.cheats.detail"),
        cheatsOn(settings),
        () => this.#api.setLobby({ settings: { cheats: !cheatsOn(settings) } }),
        this.#state.started,
      );
      {
        const note = this.#text(x + 4, y - 4, t(CHEATS_NOTE_KEY), 12, w - 8, { alpha: 0.85 });
        y += note.height + 8;
      }

      // House rules.
      y = this.#heading(x, y + 4, w, t("room.rules.title"));
      for (const rule of tableRuleRows(settings)) {
        toggleRow(`rule:${rule.key}`, t(rule.titleKey), t(rule.detailKey), rule.on, () =>
          this.#api.setLobby({ settings: toggleTableRulePatch(settings, rule.key) }),
        );
      }

      // Mods.
      y = this.#heading(x, y + 4, w, t("room.mods.title"));
      if (host) {
        const rows = hostModRows(settings, this.#installed());
        if (rows.length === 0) {
          const none = this.#text(x, y, t("room.mods.none"), 13, w, { alpha: 0.8 });
          y += none.height + 8;
        }
        for (const mod of rows) {
          toggleRow(`mod:${mod.id}`, mod.name, `${mod.id} v${mod.version}`, mod.allowed, () =>
            this.#api.setLobby({ settings: toggleModPatch(settings, { id: mod.id, version: mod.version }) }),
          );
        }
      } else {
        const rows = guestModRows(settings, this.#installed());
        if (rows.length === 0) {
          const none = this.#text(x, y, t("room.mods.noneAllowed"), 13, w, { alpha: 0.8 });
          y += none.height + 8;
        }
        for (const mod of rows) {
          const name = this.#text(x, y, `${mod.id} v${mod.version}`, 14, w, { bold: true });
          const state = this.#text(
            x,
            y + name.height + 2,
            mod.have ? `✓ ${t("room.mods.have")}` : `✗ ${t("room.mods.missing")}`,
            12,
            w,
            {
              alpha: 0.9,
            },
          );
          y += name.height + state.height + 10;
          if (!mod.have) {
            // The Mod Store, opened on this pack; its Back returns here (the room stays joined).
            const store: Rect = { x, y, width: w, height: hit.target };
            const open = (): void => {
              this.scale.off("resize", this.#draw, this);
              goToScreen(this, SCENES.modStore, {
                packId: mod.id,
                returnTo: SCENES.roomLobby,
              } satisfies ModStoreSceneData);
            };
            this.#button({
              kind: "secondary",
              label: t("room.mods.store"),
              type: { ...typeRole.label, size: 12 },
              rect: store,
              onClick: open,
              clip: guard.clip,
              suppressClick: guard.suppress,
            });
            guard.stop(`modstore:${mod.id}`, store, open);
            y += hit.target + 10;
          }
        }
      }

      // Seats (how many each, and whether guests ask the host for one), chat.
      y = this.#heading(x, y + 4, w, t("room.seatsSetting.heading"));
      toggleRow("multi", t("room.multi.title"), t("room.multi.detail"), settings.multiSeat, () =>
        this.#api.setLobby({ settings: { multiSeat: !settings.multiSeat } }),
      );
      toggleRow("askToSit", t("room.askToSit.title"), t("room.askToSit.detail"), settings.askToSit === true, () =>
        this.#api.setLobby({ settings: { askToSit: settings.askToSit !== true } }),
      );
      toggleRow("chat", t("room.chatSetting.title"), t("room.chatSetting.detail"), settings.chat, () =>
        this.#api.setLobby({ settings: { chat: !settings.chat } }),
      );
      // Chosen when opening the game (#881): may the host take over or hand off a hero when its player leaves?
      toggleRow("handover", t("room.handover.title"), t("room.handover.detail"), settings.handover !== false, () =>
        this.#api.setLobby({ settings: { handover: settings.handover === false } }),
      );
      // Chosen in the lobby (#887): does the host's board draw every hand face up? Off by default.
      toggleRow(
        "hands",
        t("room.handsSetting.title"),
        t("room.handsSetting.detail"),
        hostSeesHandsOf(this.#state),
        () => this.#api.setLobby({ settings: { hostSeesHands: !hostSeesHandsOf(this.#state) } }),
      );
      // The host's opt-in to the public "Live now" list; off unless the host turns it on.
      toggleRow("listed", t("room.listed.title"), t("room.listed.detail"), settings.listed === true, () =>
        this.#api.setLobby({ settings: { listed: settings.listed !== true } }),
      );
      return y - top;
    });
  }

  // ---- Chat -------------------------------------------------------------------------------------------------------

  /**
   * Sends the line and clears the field. `refocus`: the player was typing (Enter, or Send on a mouse device), so the
   * field keeps focus for the next line; a phone's Send tap does not raise the keyboard again.
   */
  #sendChat(refocus = false): void {
    const input = this.#chatInput;
    const text = input?.value.trim() ?? "";
    // A room that has ended hears nothing: Send is off and Enter does nothing.
    if (!input || text === "" || this.#state.connection === "ended") return;
    this.#api.say(text);
    input.setValue("");
    if (refocus) {
      // After the redraw the send may cause, and after a button press has taken focus.
      this.time.delayedCall(0, () => {
        if (this.#alive && this.#chatInput === input) input.focus();
      });
    }
  }

  #drawChatPanel(rect: Rect, titled: boolean, phone: boolean): void {
    const state = this.#state;
    const inner = this.#frame(rect, titled ? t("room.tab.chat") : null);
    if (!chatOn(state)) {
      this.#chatInput?.setVisible(false);
      this.#text(inner.x + 2, inner.y + 4, t("room.chat.off"), 14, inner.width - 4, { alpha: 0.8 });
      return;
    }
    const rowHeight = hit.primary;
    const listRect: Rect = {
      x: inner.x,
      y: inner.y,
      width: inner.width,
      height: Math.max(40, inner.height - rowHeight - 8),
    };
    const sendWidth = phone ? 84 : 96;
    const fieldRect: Rect = {
      x: inner.x,
      y: inner.y + inner.height - rowHeight,
      width: inner.width - sendWidth - 8,
      height: rowHeight,
    };
    const sendRect: Rect = {
      x: fieldRect.x + fieldRect.width + 8,
      y: fieldRect.y,
      width: sendWidth,
      height: rowHeight,
    };

    const chatRegion = this.#scrollPanel("chat", listRect, (x, top, w) => {
      if (state.chat.length === 0) {
        const none = this.#text(x + 2, top + 4, t("room.chat.empty"), 13, w, { alpha: 0.75 });
        return none.height + 8;
      }
      let y = top + 2;
      for (const line of state.chat) {
        const who = line.name ?? "?";
        const text = this.#text(x + 8, y + 4, `${who}: ${line.text}`, 13, w - 16, { bold: line.mine });
        const h = text.height + 8;
        const g = this.add.graphics();
        g.lineStyle(line.mine ? 2 : 1, INK, line.mine ? 1 : 0.35).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        this.children.moveTo(g, this.children.getIndex(text));
        y += h + 4;
      }
      return y - top;
    });

    if (this.#chatToEnd) {
      this.#chatToEnd = false;
      chatRegion.scrollByPx(1_000_000);
    }
    if (!this.#chatInput) {
      this.#chatInput = new McTextInput(this, {
        rect: fieldRect,
        value: "",
        type: typeRole.body,
        placeholder: t("room.chat.placeholder"),
        maxLength: 280,
      });
      this.children.bringToTop(this.#chatInput.gameObject);
    } else {
      this.#chatInput.layout(fieldRect);
      this.#chatInput.setPlaceholder(t("room.chat.placeholder"));
    }
    this.#chatInput.setVisible(true);
    if (!this.#chatBound) {
      this.#chatBound = true;
      const node = (this.#chatInput.gameObject as unknown as { node: HTMLElement }).node;
      node.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.key === "Enter") this.#sendChat(true);
      });
    }
    this.#button({
      kind: "primary",
      label: t("room.chat.send"),
      type: typeRole.label,
      rect: sendRect,
      enabled: this.#state.connection !== "ended",
      onClick: () => this.#sendChat(!this.sys.game.device.input.touch),
    });
    this.#addStop("chat-field", fieldRect, () => this.#chatInput?.focus());
    this.#addStop("chat-send", sendRect, () => this.#sendChat());
  }

  // ---- Footer -----------------------------------------------------------------------------------------------------

  #drawFooter(rect: Rect, phone: boolean): void {
    const state = this.#state;
    this.add.rectangle(rect.x, rect.y, rect.width, rect.height, INK).setOrigin(0, 0);
    const pad = 10;
    const full = rect.width >= 600;
    const hasButton = this.#isHost() || state.connection === "ended" || this.#confirmLeave;
    const buttonWidth = full ? 240 : rect.width - pad * 2;
    const buttonRect: Rect = full
      ? {
          x: rect.x + rect.width - pad - buttonWidth,
          y: rect.y + (rect.height - hit.primary) / 2,
          width: buttonWidth,
          height: hit.primary,
        }
      : { x: rect.x + pad, y: rect.y + rect.height - pad / 2 - hit.primary, width: buttonWidth, height: hit.primary };
    const textRect: Rect = full
      ? { x: rect.x + pad, y: rect.y + 6, width: rect.width - buttonWidth - pad * 3, height: rect.height - 12 }
      : {
          x: rect.x + pad,
          y: rect.y + 4,
          width: rect.width - pad * 2,
          height: hasButton ? rect.height - hit.primary - 10 : rect.height - 8,
        };
    const say2 = (text: string, bold = false): Phaser.GameObjects.Text => {
      const line = this.add
        .text(
          textRect.x,
          textRect.y + textRect.height / 2,
          text,
          textStyle(bold ? typeRole.rowTitle : typeRole.body, PAPER),
        )
        .setOrigin(0, 0.5)
        .setWordWrapWidth(textRect.width, true);
      fitText(line, textRect.width, phone ? 12 : 13);
      if (line.height > textRect.height) line.setFontSize(11);
      return line;
    };

    if (this.#confirmLeave) {
      say2(t("room.closeSure"), true);
      const half = (buttonRect.width - 8) / 2;
      const stay: Rect = { ...buttonRect, width: half };
      const close: Rect = { ...buttonRect, x: buttonRect.x + half + 8, width: half };
      this.#button({
        kind: "onInk",
        label: t("room.stay"),
        type: typeRole.label,
        rect: stay,
        onClick: () => {
          this.#confirmLeave = false;
          this.#draw();
        },
      });
      this.#button({
        kind: "primary",
        label: t("room.closeRoom"),
        type: typeRole.label,
        rect: close,
        onClick: () => this.#goTitle(),
      });
      this.#addStop("stay", stay, () => {
        this.#confirmLeave = false;
        this.#draw();
      });
      this.#addStop("close", close, () => this.#goTitle());
      return;
    }
    if (state.connection === "ended") {
      const words = connectionWords(state);
      if (words) say2(wordsText(words), true);
      this.#button({
        kind: "primary",
        label: t("room.backToTitle"),
        type: typeRole.label,
        rect: buttonRect,
        onClick: () => this.#goTitle(),
      });
      this.#addStop("back-title", buttonRect, () => this.#goTitle());
      return;
    }
    const note = this.#noteNow();
    if (!this.#isHost()) {
      // While the host is in a setup screen, the status bar says which, with a moving ellipsis (`view/room-host-activity.ts`).
      const activity = note === null && state.connection === "connected" ? hostActivityWords(state.hostActivity) : null;
      if (activity) {
        const base = wordsText(activity);
        // Fitted with the longest ellipsis, so the text never needs refitting as the dots change.
        const line = say2(base + "...", true);
        const dots = activityDots(this.time.now, appSession().settings.reducedMotion);
        line.setText(base + dots);
        this.#activity = { text: line, words: base, dots };
        return;
      }
      say2(note ?? t("room.start.guestWait"), note !== null);
      return;
    }
    const block = this.#startWords();
    const resultNote = this.#startResult ? wordsText(this.#startResult.headline) : null;
    say2(note ?? resultNote ?? (block ? wordsText(block) : ""), note !== null || resultNote !== null);
    this.#button({
      kind: "primary",
      label: this.#starting ? t("room.starting") : t("room.start"),
      type: bangers(22),
      rect: buttonRect,
      enabled: block === null && !this.#starting,
      onUnavailablePress: () => {
        if (block) this.#say(wordsText(block));
        this.#draw();
      },
      onClick: () => void this.#start(),
    });
    this.#addStop("start", buttonRect, () => void this.#start());
  }
}
