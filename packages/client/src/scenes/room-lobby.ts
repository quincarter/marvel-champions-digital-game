/**
 * A room's lobby (issue #880, docs/live-game-rooms.md section 8): the code and a Copy link button, the people in the
 * room, the seats (one per hero the host set up) with who holds each, the table's settings (the host's to change,
 * everyone's to read) and chat. The host sets the table up with the existing New game flow in room mode and presses
 * Start once every seat is held; a guest follows the started game as a watcher with their seats marked.
 *
 * The room owns every fact on this screen (`platform/room.ts`, `RoomState`); this draws it (`view/room-lobby-model.ts`
 * words it) and sends the player's presses back. Everything under the top bar is one Lit panel over the canvas; the seat
 * list, the settings and the chat are its native scroll regions, and every press is a tap, so a swipe that ends over a
 * button fires nothing (the "no tap on finger lift" rule, issue #227).
 */
import Phaser from "phaser";
import "@mc/ui";
import type { McSheet, SheetNode } from "@mc/ui";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { SheetBuilder, sheetColor, type Measured } from "../dom/sheet-builder.js";
import { isDesktopType } from "../ui/desktop-type.js";
import { currentCardsById, currentEncounterSets, currentScenarios } from "../content/pool.js";
import { POOL_CARDS } from "../content/pool-cards.js";
import { artFor } from "../art/art-source.js";
import { HERO_ART, heroArtForIdentity } from "../art/hero-art.js";
import { PackLeases, refreshPackArt } from "../art/pack-art.js";
import { onArtChange } from "../language-change.js";
import { PLATFORM_ICON_VIEWBOX, playPlatformSvgOps } from "../view/play-platform-svg.js";
import { t, tPlural } from "../i18n/translate.js";
import { loadedPacks } from "../packs/pack-registry.js";
import { withLoadedPacks } from "../packs/game-packs.js";
import {
  leaveRoom,
  onRoomState,
  onChatPopout,
  recallChatPopout,
  armChatPopout,
  reportHostActivity,
  resyncTablePlan,
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
import { hasKeptSettings, readHostSettings } from "../view/host-settings-memory.js";
import { setCompetitive, setTeam, setTeamReady, startCompetitive } from "../platform/room.js";
import {
  competitiveStartBlock,
  expertOn,
  expertPatch,
  newCompetitivePlan,
  otherTeam,
  perTeamOf,
  planOf as competitivePlanOf,
  speakingFor,
  teamViews,
  tieBreaksOn,
  withTeamSize,
  type CompetitivePlan,
  type TeamView,
} from "../view/competitive-lobby-model.js";
import { startSealing } from "../view/competitive-seal.js";
import { civilWarSidesOffer } from "@mc/cards";
import { openBuilderOn } from "../view/civil-war-builder-model.js";
import type { TeamId } from "../live/room-state.js";
import { enterSeatGame, playRoomGame } from "../platform/seat-play.js";
import { askToConfirm } from "./end-turn-confirm.js";
import { copyText } from "../ui/report-export.js";
import { border, hit, minType, signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import { bangers, campaignFrame, drawTopBar } from "../ui/campaign-chrome.js";
import { drawArtBackdrop } from "../ui/art-backdrop.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { cssOf } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import type { RoomProblem } from "../live/room-state.js";
import type { OnlineData } from "./online.js";
import { keepClosedRoomGame } from "../platform/room-continue.js";
import { McButton, McTextInput } from "../ui/widgets.js";
import { HoverPreview, screenHoverArea } from "../ui/card-hover-preview.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { playPlatformMarkOf } from "../view/play-platform-mark.js";
import type { ScenarioIntroData } from "./scenario-intro.js";
import { scenarioIntroFor } from "../campaign/scenario-intros.js";
import { ART_CATALOG, introArtFor } from "../art/scenario-art.js";
import type { ModStoreSceneData } from "./mod-store.js";
import { pointInRect } from "../view/drag-gesture.js";
import { chatPopoutAvailable, openChatPopout } from "../platform/chat-popout.js";
import { mintPopoutToken } from "../live/chat-popout-protocol.js";
import { artLanguageNow } from "../art/art-source.js";
import type { RoomGameBase } from "../live/room-start.js";
import type { DeckRefusalCode } from "../live/room-state.js";
import type { CardFace } from "../art/art-source.js";
import { planGrid, planPicturesCached, type PlanPicture } from "../view/room-table-plan.js";
import type { Rect } from "../view/layout.js";
import { hostSeesHandsOf, openHandsOf } from "../view/hand-privacy.js";
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
import type { RoomModePickerData } from "./room-mode-picker.js";
import { ROOM_MODE_COPY, type RoomModeId } from "../view/room-mode-picker.js";
import { villainPicture } from "../ui/campaign-chrome.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { introReplay } from "./replay-entry.js";
import { newGameDraft } from "./title.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import type { ScenarioSelectData } from "./scenario-select.js";
import type { TableSetupData } from "./table-setup.js";

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
  readonly setCompetitive: typeof setCompetitive;
  readonly setTeam: typeof setTeam;
  readonly setTeamReady: typeof setTeamReady;
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
  setCompetitive,
  setTeam,
  setTeamReady,
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
  /** Dev only: open the game mode picker over the preview room (`?screen=room-lobby&modes=1`). */
  readonly openModes?: boolean;
}

type ScrollKey = "seats" | "settings" | "chat";

/** The lobby's three lists, each a native scroll region of the panel (its element's key is `list:<key>`). */
const LIST_KEYS: readonly ScrollKey[] = ["seats", "settings", "chat"];

/** Where the face usually is in a hero picture: the upper third (the same focus a seat's picture is drawn with). */
const FACE_FOCUS_Y = 0.22;

interface Note {
  readonly text: string;
  readonly until: number;
}

/** The narrowest lobby header that fits the host's Live now toggle beside the code and Copy link. */
const LISTED_HEADER_MIN_WIDTH = 600;

export class RoomLobbyScene extends Phaser.Scene {
  #state: RoomState = roomState();
  #preview = false;
  #openModes = false;
  /** The seat whose "give to" list is open. */
  #picking: string | null = null;
  /** The next draw brings the opened "give to" list into view (set by the press, kept until it is drawn). */
  #revealPicker = false;
  #reveal: Rect | null = null;
  #hover: HoverPreview | null = null;
  /** The hero and plan pictures on screen: each card's box in the screen's coordinates as if its list were unscrolled. */
  #hoverFaces: {
    readonly cardId: string;
    readonly face?: CardFace;
    readonly rect: Rect;
    readonly scroll: ScrollKey;
  }[] = [];
  #tab: LobbyPanelId = "seats";
  /** The top bar's Back button (the rest of the screen is the panel). */
  #buttons: McButton[] = [];
  /** Everything under the top bar: one Lit panel over the canvas, made once a visit. */
  #region: DomRegion<McSheet> | null = null;
  /** The parts being built (the panel's top level, or a list's own while one is drawn). */
  #b!: SheetBuilder;
  /** The parts last handed to the panel. */
  #nodes: readonly SheetNode[] = [];
  #area: Rect = { x: 0, y: 0, width: 0, height: 0 };
  /** What a press on each key does, this draw. */
  readonly #actions = new Map<string, () => void>();
  /** The list being drawn, if any; its box, and where its top sits on the screen. */
  #listKey: ScrollKey | null = null;
  readonly #listViews: Partial<Record<ScrollKey, Rect>> = {};
  readonly #listTops: Partial<Record<ScrollKey, number>> = {};
  /** Which list each focus stop inside a list belongs to (the right stick scrolls that one). */
  readonly #stopList = new Map<string, ScrollKey>();
  /** What each list was scrolled to at the last draw, so a list another tab hid comes back where it was. */
  readonly #scrolled: Partial<Record<ScrollKey, number>> = {};
  readonly #leases = new PackLeases();
  /** The tab ids drawn this pass (empty when every panel shows at once). */
  #tabIds: readonly LobbyPanelId[] = [];
  /** Where the chat field sits, seen through a hole in the panel while it shows. */
  #fieldRect: Rect | null = null;
  #chatInput: McTextInput | null = null;
  /** How much of the screen's bottom the on-screen keyboard covers, in game pixels (0 when it is down). */
  #covered = 0;
  /** The host's activity line in the header while it animates, and its words without the dots. */
  #activity: { readonly index: number; readonly words: string; dots: string } | null = null;
  #chatBound = false;
  #chatCount = 0;
  /** New chat arrived: the chat list scrolls to its newest line on the next draw. */
  #chatToEnd = true;
  /** Whether the floating chat (a desktop) is open; it starts closed and keeps its choice across redraws. */
  #chatOpen = false;
  /** The chat is open in its own window (`live/chat-popout-protocol.ts`): the lobby's chat shows where it went. */
  #popped = false;
  /** The browser blocked the pop-out window: the chat header says so for a few seconds. */
  #popBlocked = false;
  /** Desktop only: a phone or a tablet has no window to put the chat in. */
  readonly #canPopOut = chatPopoutAvailable();
  #offPopout: (() => void) | null = null;
  /** Where the open floating chat is, while it is; the lists under it do not scroll there. */
  #floatRect: Rect | null = null;
  #layoutMode: LobbyLayout["mode"] = "tabs";
  #route: FocusRoute | null = null;
  #hints!: GlyphHints;
  #alive = false;
  #off: (() => void) | null = null;
  #confirmLeave = false;
  #refusalSeen = 0;
  #note: Note | null = null;
  #linkCopied = false;
  /** The host's Live now toggle sits in the header beside Copy link (a wide header); else first in the settings. */
  #listedInHeader = false;
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
    this.#openModes = import.meta.env.DEV && data?.openModes === true;
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
    // The panel went with the last visit's scene (`DomRegion`): this one makes its own, and its lists start at the top.
    this.#region = null;
    this.#scrolled.seats = this.#scrolled.settings = this.#scrolled.chat = 0;
    this.#chatToEnd = true;
    this.cameras.main.setBackgroundColor(cssOf(PAPER));
    setSeatNote(null);
    if (this.#state.role === "none") {
      goToScreen(this, SCENES.title);
      return;
    }
    this.#hints = new GlyphHints(this);
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.#chatInput?.focused ?? false,
      onCancel: () => this.#leave(),
      primary: () => (this.#stops.has("start") ? "start" : null),
      // LB / RB step through the tabs; the right stick and Page Up / Down scroll the list the focus is in.
      onTab: (direction) => this.#stepTab(direction),
      onScroll: (_dx, dy) => this.#scrollList(dy),
      onPage: (direction) => this.#scrollList(direction * Math.max(80, this.#area.height * 0.6)),
    });
    bindTextFieldEscape(this, () => this.#chatInput);
    this.scale.on("resize", this.#draw, this);
    // The host is back in the lobby: its setup status line (if it was showing one) is over.
    if (!this.#preview && this.#state.role === "host") {
      reportHostActivity("idle");
      // Back from a game with the draft kept: the room cleared the plan at its start, so it is sent again.
      resyncTablePlan();
    }
    this.#watchKeyboard();
    // The desktop hover popover over a seat's hero picture, as Table setup and the set sheets show it.
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCardIds(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    // A pack's picture that resolves later (a hero's scan, once its pack has loaded) draws in place of the blank.
    const offArt = onArtChange(() => {
      if (this.#alive && this.sys.isActive()) this.#draw();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offArt();
      this.#leases.dispose();
      this.#alive = false;
      if (this.scene.isActive(SCENES.roomModePicker)) this.scene.stop(SCENES.roomModePicker);
      this.#off?.();
      this.#off = null;
      this.#offPopout?.();
      this.#offPopout = null;
      this.#hints.dispose();
      this.scale.off("resize", this.#draw, this);
      this.#hover?.destroy();
      this.#hover = null;
      this.#clearWidgets();
      this.#chatInput?.destroy();
      this.#chatInput = null;
      this.#chatBound = false;
    });
    this.#draw();
    fadeScreenIn(this);
    if (this.#preview && this.#openModes) {
      this.#openModes = false;
      this.#openModePicker(this.#state.competitive ? "competitive" : this.#state.epic ? "epic" : "standard", (mode) =>
        ((globalThis as { __mcRoomCalls?: string[] }).__mcRoomCalls ??= []).push(`chooseMode(${mode})`),
      );
    }
    if (!this.#preview) {
      this.#off = onRoomState((state) => this.#onState(state));
      this.#offPopout = onChatPopout((open) => {
        if (open === this.#popped) return;
        this.#popped = open;
        if (this.#alive) this.#draw();
      });
    }
  }

  /** The hero pictures on screen now, each clipped to the scrolled list it sits in. */
  #hoverCardIds(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    this.#hoverFaces.forEach(({ cardId, face, rect, scroll }, index) => {
      const view = this.#listViews[scroll];
      if (!view) return;
      const shown = clipHoverRect({ ...rect, y: rect.y - (this.#scroller(scroll)?.scrollTop ?? 0) }, view);
      if (shown)
        found.set(hoverSlotOf(cardId, `seat${index}`), { ...shown, cardId, ...(face ? { face } : {}), through: true });
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
    this.#setActivityDots(dots);
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
        // The host's settings from its last room, kept on this device (GarethMagis), or the room's defaults.
        const kept = readHostSettings();
        // Two messages: a room that refuses the kept settings (an older Worker, the rate limit) still gets its seats.
        setLobby({ seats: seatSpecsOf(clampSeatCount(kept.seats ?? ROOM_SEATS_DEFAULT)), keep: false });
        if (hasKeptSettings(kept)) setLobby({ settings: kept.settings, keep: false });
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
    if (this.#state.competitive) return competitiveStartBlock(this.#state);
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
    if (this.#state.competitive) {
      await this.#startCompetitive();
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
   * Competitive: the host's device deals each seat's own deck through the same check as any room (a refusal is told to
   * that seat's holder alone), then builds the two-team game from both sealed scenarios (#883).
   */
  async #startCompetitive(): Promise<void> {
    if (this.#preview) {
      this.#record("startCompetitive()");
      return;
    }
    this.#starting = true;
    this.#draw();
    const keys = new Map(this.#state.seats.map((seat) => [seat.id, deckKeyOf(seat.deck)] as const));
    let failure: string | null = null;
    try {
      const result = await startCompetitive({
        seed: Math.floor(Math.random() * 2 ** 31),
        expert: expertOn(this.#state),
      });
      if (!result.ok) {
        if (result.reason === "room") {
          this.#refused =
            result.result.reason === "decks"
              ? result.result.refused.map((r) => ({
                  seat: r.seat,
                  code: r.code,
                  reason: r.reason,
                  deckKey: keys.get(r.seat) ?? "",
                }))
              : [];
          this.#startResult = startResultWords(result.result, this.#state);
          if (this.#startResult) this.#tab = "seats";
          failure = "";
        } else failure = result.reason;
      }
    } catch (cause) {
      failure = cause instanceof Error ? cause.message : String(cause);
    }
    if (!this.#alive) return;
    const { store } = appSession();
    if (failure === null && store.state.status === "failed") failure = store.state.error ?? t("room.refusal.generic");
    if (failure !== null) {
      this.#starting = false;
      if (failure !== "") this.#say(t("comp.start.failed", { why: failure }));
      this.#draw();
      return;
    }
    this.scale.off("resize", this.#draw, this);
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
  //
  // Everything under the top bar is one Lit panel (`mc-sheet`, `dom/dom-region.ts`) over the canvas, built at the rects the
  // lobby layout gives (`view/room-lobby-layout.ts`), so the geometry is the Phaser screen's. The top bar, the backdrop
  // picture and the chat field stay in Phaser (the field is seen through a hole). The seat list, the settings and the
  // chat scroll natively inside the panel's own scroll regions, and every press is a tap: a swipe that ends over a
  // button fires nothing (the "no tap on finger lift" rule, issue #227).

  #clearWidgets(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
  }

  /** The text a press on `key` runs (what a tap on its part or its focus stop does). */
  #press(key: string, run: () => void): void {
    this.#actions.set(key, run);
  }

  #text(
    x: number,
    y: number,
    text: string,
    size: number,
    width: number,
    options: { bold?: boolean; alpha?: number; color?: number; maxLines?: number } = {},
  ): Measured {
    return this.#b.text(x, y, text, options.bold ? typeRole.rowTitle : typeRole.body, {
      size,
      color: options.color ?? INK,
      wrapWidth: width,
      ...(options.alpha !== undefined ? { alpha: options.alpha } : {}),
      ...(options.maxLines !== undefined ? { maxLines: options.maxLines } : {}),
    });
  }

  /**
   * A button with its press and focus stop. A button that cannot be used now stays drawn, dimmed, and a press on it says
   * why in the footer (`reason`), as the Phaser screen's did: its tap area sits over it, since a disabled button takes
   * no press of its own.
   */
  #button(options: {
    readonly key: string;
    readonly rect: Rect;
    readonly label: string;
    readonly look: "primary" | "secondary" | "quiet" | "onInk";
    readonly type?: TypeSpec;
    readonly run: () => void;
    readonly selected?: boolean;
    readonly enabled?: boolean;
    readonly reason?: string;
    /** No focus stop (the button is not reachable by key). */
    readonly noStop?: boolean;
    readonly labelShift?: number;
    readonly aria?: string;
  }): void {
    const enabled = options.enabled ?? true;
    const run = enabled
      ? options.run
      : (): void => {
          if (options.reason) {
            this.#say(options.reason);
            this.#draw();
          }
        };
    this.#press(options.key, run);
    this.#b.button({
      key: options.key,
      rect: options.rect,
      label: options.label,
      look: options.look,
      type: options.type ?? typeRole.label,
      ...(options.selected ? { selected: true } : {}),
      ...(enabled ? {} : { disabled: options.reason ?? (true as const) }),
      ...(options.labelShift ? { labelShift: options.labelShift } : {}),
      ...(options.aria ? { aria: options.aria } : {}),
    });
    if (!enabled) this.#b.tap(options.key, options.rect);
    if (!options.noStop) this.#stop(options.key, options.rect, run);
  }

  /**
   * A focus stop. In a scrolling list its box is read off the panel, so it follows the scroll, and taking focus scrolls
   * it into view; `rect` is then in the list's content space.
   */
  #stop(key: string, rect: Rect, activate: () => void, extra: Partial<FocusStop> = {}): void {
    const list = this.#listKey;
    if (list === null) {
      this.#addStop(key, rect, activate, extra);
      return;
    }
    const view = this.#listViews[list]!;
    const listTop = this.#listTops[list]!;
    this.#stopList.set(key, list);
    this.#addStop(key, () => this.#elementRect(key, { ...rect, y: rect.y + listTop }), activate, {
      ...extra,
      view: () => this.#elementRect(`list:${list}`, view),
      ensureVisible: () => this.#region?.element.elementOf(key)?.scrollIntoView({ block: "nearest" }),
    });
  }

  /** An element of the panel in game coordinates, or `fallback` while it is not drawn. */
  #elementRect(key: string, fallback: Rect): Rect {
    const region = this.#region;
    const found = region?.element.elementOf(key);
    return region && found ? region.rectOf(found) : fallback;
  }

  /** A list's own element, which scrolls. */
  #scroller(key: ScrollKey): HTMLElement | null {
    return this.#region?.element.elementOf(`list:${key}`) ?? null;
  }

  /**
   * A box that is drawn under what follows but is as tall as it turns out to be (a seat's card, a note): pushed now with
   * no height, given its height by the function this returns. A stroke is drawn `inset` px in from the edge, as the
   * Phaser frame's `strokeRect` was.
   */
  #groundBox(
    x: number,
    y: number,
    w: number,
    look: {
      readonly fill?: number;
      readonly stroke?: number;
      readonly strokeWidth?: number;
      readonly inset?: number;
      /** Names the box (its stroke `<key>:frame`), so it keeps its element when parts before it come and go. */
      readonly key?: string;
    },
  ): (height: number) => void {
    const b = this.#b;
    const inset = look.inset ?? 0;
    const at: { readonly index: number; readonly pad: number }[] = [];
    if (look.fill !== undefined) {
      at.push({ index: b.nodes.length, pad: 0 });
      b.box({ x, y, width: w, height: 0 }, { fill: look.fill, ...(look.key ? { key: look.key } : {}) });
    }
    if (look.stroke !== undefined) {
      at.push({ index: b.nodes.length, pad: inset });
      b.box(
        { x: x + inset, y: y + inset, width: w - inset * 2, height: 0 },
        { stroke: look.stroke, strokeWidth: look.strokeWidth ?? 2, ...(look.key ? { key: `${look.key}:frame` } : {}) },
      );
    }
    return (height) => {
      for (const { index, pad } of at) {
        const node = b.nodes[index];
        if (node?.kind === "box") b.nodes[index] = { ...node, rect: { ...node.rect, height: height - pad * 2 } };
      }
    };
  }

  #draw(): void {
    if (!this.#alive || this.#state.role === "none") return;
    this.#clearWidgets();
    this.#rememberScrolls();
    // The chat field is a DOM element that keeps its caret across a redraw: lifted out of the sweep and put back.
    const kept = this.#chatInput ? this.#chatInput.gameObjects : [];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);
    this.#hints.reset();
    this.#hoverFaces = [];
    this.#stops = new Map();
    this.#order = [];
    this.#actions.clear();
    this.#stopList.clear();
    this.#leases.begin();

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
      state.epic || state.competitive ? 0.7 : 0.42,
      this.#chatOpen,
      this.#popped,
      this.#covered,
    );
    // The keyboard is up over the Chat tab of a narrow layout: the chat gets every pixel above it, and the header and
    // the Start strip give way.
    const compact = this.#covered > 0 && full.tabs !== null && this.#tab === "chat" && chatOn(state);
    const layout = compact ? this.#compactLayout(full, bar.height, gutter, width, height) : full;
    this.#activity = null;
    this.#layoutMode = layout.mode;
    this.#floatRect = layout.mode === "float" ? (layout.panels.chat ?? null) : null;
    this.#listedInHeader = false;
    this.#fieldRect = null;

    // The panel: everything under the top bar, built at the layout's own rects.
    const area: Rect = { x: 0, y: bar.height, width, height: height - bar.height };
    this.#area = area;
    this.#b = new SheetBuilder(this.game, { x: area.x, y: area.y }, isDesktopType);

    if (!compact) this.#drawHeader(layout.header, phone);
    // What has been read: the chat on screen is read; otherwise the lines since it was last looked at are the badge.
    // The chat in its own window is read there.
    const chatShown = layout.panels.chat !== undefined || this.#popped;
    if (chatShown) chatSeen.markSeen(state.roomId, state.chatLive);
    const unread = chatShown ? 0 : unreadChatCount(state, chatSeen.seenFor(state.roomId));

    this.#tabIds = [];
    if (layout.tabs) {
      const ids = layout.tabIds.filter((id) => id !== "chat" || chatOn(state));
      this.#tabIds = ids;
      this.#drawTabs(layout, ids, unread);
    }

    const titled = layout.mode !== "tabs";
    if (layout.panels.seats) this.#drawSeatsPanel(layout.panels.seats, titled);
    if (layout.panels.settings) this.#drawSettingsPanel(layout.panels.settings, titled);
    if (layout.panels.chat) this.#drawChatPanel(layout.panels.chat, titled, phone, layout.mode === "float");
    else this.#chatInput?.setVisible(false);
    if (layout.chatPill && chatOn(state)) {
      if (this.#popped) this.#drawPoppedCard(layout.chatPill);
      else this.#drawChatPill(layout.chatPill, unread);
    }
    if (!compact) this.#drawFooter(layout.footer, phone);

    // Rendered before the route reads its stops, so a stop inside a list can find its element.
    this.#mount(area);
    this.#leases.end();
    this.#afterMount();
    if (this.#floatRect) this.#dropStopsUnder(this.#floatRect);
    this.#route?.set(this.#order, this.#stops);
    this.#hover?.onDraw();
  }

  /** Hands the built parts to the panel (made once, so a list's scroll survives a redraw) and renders them now. */
  #mount(area: Rect): void {
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      element.addEventListener("mc-activate", (event) => {
        this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      // A pack picture's blob URL went stale before its lazy image loaded: read it again, once (McSheet's retry).
      element.addEventListener("mc-image-error", (event) => {
        const { key, src } = (event as CustomEvent<{ key: string; src: string | null }>).detail;
        refreshPackArt(key, src ?? undefined);
      });
      this.#region = new DomRegion(this, element, area);
      // The card hover popover follows Phaser's pointer, which only hears the mouse over the canvas.
      this.#region.forwardMouseMoves();
      // The chat field is a Phaser DOM element under the panel, and the hover popover is drawn in the canvas: both are
      // left out of the panel to be seen through it. The field only while it shows.
      this.#region.setHoles(() => {
        const holes: Rect[] = [];
        if (this.#chatInput?.shown && this.#fieldRect) holes.push(this.#fieldRect);
        const popover = this.#hover?.shownRect;
        if (popover) holes.push(popover);
        return holes;
      });
    }
    this.#region.setRect(area);
    this.#nodes = this.#b.nodes;
    this.#region.element.nodes = this.#nodes;
    renderNow(this.#region.element);
  }

  /** What a list was scrolled to, kept from one draw to the next (a list another tab hid comes back where it was). */
  #rememberScrolls(): void {
    for (const key of LIST_KEYS) {
      const element = this.#scroller(key);
      if (element) this.#scrolled[key] = element.scrollTop;
    }
  }

  /** After the panel is rendered: each list back where it was, the chat at its newest line, a "give to" list in view. */
  #afterMount(): void {
    for (const key of LIST_KEYS) {
      const element = this.#scroller(key);
      if (!element) continue;
      const kept = this.#scrolled[key] ?? 0;
      if (element.scrollTop !== kept) element.scrollTop = kept;
      if (key === "chat" && this.#chatToEnd) {
        this.#chatToEnd = false;
        element.scrollTop = element.scrollHeight;
      }
    }
    // A "give to" list just opened lies in view (a phone's list would otherwise open below the fold).
    const reveal = this.#reveal;
    const seats = this.#scroller("seats");
    if (reveal && seats) {
      this.#reveal = null;
      const top = reveal.y - seats.scrollTop;
      const over = top + reveal.height - seats.clientHeight;
      if (over > 0) seats.scrollTop += Math.min(over, top);
    }
  }

  /** The open floating chat covers rows of the lists beneath it: tab and the pad must not reach what the player cannot see. */
  #dropStopsUnder(panel: Rect): void {
    for (const key of [...this.#order]) {
      if (key.startsWith("chat-")) continue;
      const stop = this.#stops.get(key);
      if (!stop) continue;
      const rect = typeof stop.rect === "function" ? stop.rect() : stop.rect;
      if (!pointInRect(rect.x + rect.width / 2, rect.y + rect.height / 2, panel)) continue;
      this.#stops.delete(key);
      this.#order.splice(this.#order.indexOf(key), 1);
    }
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

  /** The tab strip: a recessed rail of equal cells, the active one an ink fill, a red count on a Chat tab with news. */
  #drawTabs(layout: LobbyLayout, ids: readonly LobbyPanelId[], unread: number): void {
    const state = this.#state;
    const b = this.#b;
    const rail = layout.tabs!;
    const cell = rail.width / ids.length;
    const active = layout.mode === "stack" && this.#tab === "seats" ? "settings" : this.#tab;
    const type = { ...typeRole.label, size: Math.max(minType.phoneLabel, typeRole.label.size) };
    const rows = ids.map((id) => ({
      id,
      label:
        id === "seats" && state.epic
          ? t("epic.tab.tables")
          : id === "seats" && state.competitive
            ? t("comp.tab.teams")
            : t(`room.tab.${id}` as const),
      selected: id === active,
      ...(id === "chat" && unread > 0 ? { badge: unread } : {}),
    }));
    // One rail of cells (`mc-tab-rail`, a tap on a cell raises `tab:<id>`); the stops frame each cell.
    b.tabRail(rail, rows, { prefix: "tab:", size: type.size });
    ids.forEach((id, i) => {
      const rect: Rect = { x: rail.x + i * cell, y: rail.y, width: cell, height: rail.height };
      const key = `tab:${id}`;
      const select = (): void => {
        this.#tab = id;
        this.#draw();
      };
      this.#press(key, select);
      this.#addStop(key, rect, select);
    });
  }

  /** LB / RB: the next or previous tab of a layout that has tabs. */
  #stepTab(direction: 1 | -1): void {
    const ids = this.#tabIds;
    if (ids.length === 0) return;
    const active = this.#layoutMode === "stack" && this.#tab === "seats" ? "settings" : this.#tab;
    const next = ids[Math.min(ids.length - 1, Math.max(0, ids.indexOf(active) + direction))]!;
    if (next === active) return;
    this.#tab = next;
    this.#draw();
    this.#route?.focusKey(`tab:${next}`);
  }

  /** The right stick and Page Up / Down: the list the focused control is in, else the first list on screen. */
  #scrollList(pixels: number): void {
    const focused = this.#route?.focused;
    const key =
      (focused ? this.#stopList.get(focused) : undefined) ?? LIST_KEYS.find((k) => this.#scroller(k) !== null);
    this.#scroller(key ?? "seats")?.scrollBy({ top: pixels });
  }

  // The header: the code, Copy link, and the connection line.
  #drawHeader(rect: Rect, phone: boolean): void {
    const state = this.#state;
    const b = this.#b;
    b.box(rect, { fill: INK });
    b.text(rect.x + 14, rect.y + 8, t("room.title").toUpperCase(), typeRole.label, {
      color: PAPER,
      alpha: 0.7,
      letterSpacing: 1.1,
    });
    b.text(rect.x + 14, rect.y + 24, codeShown(state.code), bangers(phone ? 36 : 44), {
      color: PAPER,
      letterSpacing: 4,
    });
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
      key: "copy",
      look: "onInk",
      label: this.#linkCopied ? t("room.linkCopied") : t("room.copyLink"),
      rect: copyRect,
      enabled: state.link !== null && state.connection !== "ended",
      run: copy,
    });
    // The host's "List this room in Live now", up top beside Copy link where it is seen (Quin, 2026-11-23: it was
    // buried at the bottom of the settings). A phone's header has no room for it: it leads the settings there.
    const settings = state.settings;
    this.#listedInHeader = this.#isHost() && settings !== null && rect.width >= LISTED_HEADER_MIN_WIDTH;
    if (this.#listedInHeader && settings) {
      const on = settings.listed === true;
      const listedWidth = 210;
      const listedRect: Rect = {
        x: copyRect.x - listedWidth - 10,
        y: copyRect.y,
        width: listedWidth,
        height: hit.target,
      };
      this.#button({
        key: "listed",
        look: "onInk",
        label: on ? t("room.listed.headerOn") : t("room.listed.headerOff"),
        rect: listedRect,
        selected: on,
        enabled: state.connection !== "ended",
        run: () => this.#api.setLobby({ settings: { listed: settings.listed !== true } }),
      });
    }
    const words = connectionWords(state);
    if (words) {
      const text = wordsText(words);
      const fit = rect.width - 28 - 12;
      const size = b.measure(text, typeRole.rowTitle, { size: 12, fitWidth: fit });
      const y = rect.y + rect.height - 22;
      b.box({ x: rect.x + 14, y, width: size.width + 12, height: size.height + 4 }, { fill: signal.caution.hex });
      b.text(rect.x + 20, y + 2, text, typeRole.rowTitle, { size: 12, color: surface.inkOnHue.hex, fitWidth: fit });
    }
  }

  /** A panel's frame and heading; returns the room inside it for content. */
  #frame(rect: Rect, title: string | null): Rect {
    const b = this.#b;
    b.box(rect, { fill: PARCHMENT });
    b.box(
      { x: rect.x + 1, y: rect.y + 1, width: rect.width - 2, height: rect.height - 2 },
      { stroke: INK, strokeWidth: 2 },
    );
    let top = rect.y + 8;
    if (title) {
      b.text(rect.x + 12, rect.y + 8, title.toUpperCase(), bangers(18), { color: INK, letterSpacing: 1 });
      top = rect.y + 38;
    }
    return { x: rect.x + 10, y: top, width: rect.width - 20, height: rect.y + rect.height - top - 8 };
  }

  /**
   * A scrolling panel: `draw` puts its content at the list's own coordinates (`top` is 0) and returns the content's
   * height. The list is a native scroll region of the panel, kept by its key across redraws.
   */
  #scrollPanel(key: ScrollKey, inner: Rect, draw: (x: number, top: number, width: number) => number): void {
    // The list's content is 12px narrower than its box: the scrollbar's room.
    const rect: Rect = { x: inner.x, y: inner.y, width: inner.width - 12, height: inner.height };
    const outer = this.#b;
    this.#listViews[key] = inner;
    this.#listTops[key] = inner.y;
    this.#listKey = key;
    try {
      outer.scrollFit(`list:${key}`, rect, (listBuilder) => {
        this.#b = listBuilder;
        return draw(rect.x, 0, rect.width);
      });
    } finally {
      this.#b = outer;
      this.#listKey = null;
    }
  }

  /** A card's box in the screen's own coordinates, from one drawn in the list in `this.#listKey`'s content space. */
  #inScreen(rect: Rect): Rect {
    const list = this.#listKey;
    return list === null ? rect : { ...rect, y: rect.y + this.#listTops[list]! };
  }

  // ---- People and seats ----------------------------------------------------------------------------------------

  #drawSeatsPanel(rect: Rect, titled: boolean): void {
    if (this.#state.epic) return this.#drawEpicPanel(rect, titled);
    if (this.#state.competitive) return this.#drawCompetitivePanel(rect, titled);
    const inner = this.#frame(rect, titled ? t("room.seats") : null);
    const state = this.#state;
    this.#scrollPanel("seats", inner, (x, top, w) => {
      let y = top + 2;
      if (this.#isHost()) {
        const hintKey = this.#state.settings?.askToSit === true ? "room.hostHint" : "room.hostHintClaim";
        const hint = this.#text(x, y, t(hintKey), 13, w, { alpha: 0.85 });
        y += hint.height + 8;
        const setupRect: Rect = { x, y, width: w, height: hit.target };
        const label = roomDraft() ? t("room.setupAgain") : t("room.setup");
        this.#button({
          key: "setup",
          look: roomDraft() ? "secondary" : "primary",
          label,
          rect: setupRect,
          run: () => this.#setUpTable(),
        });
        y += hit.target + 10;
        // The seat count sits right under Set up, before the table plan: it is a control, so it is on the first screen of the
        // panel at every size (a short panel scrolls, and the plan below it is only to read).
        y = this.#drawSeatCount(x, y, w) + 14;
        y = this.#drawTablePlan(x, y, w) + 6;
      } else {
        y = this.#drawTablePlan(x, y, w);
        if (!state.buildMatches) {
          const note = this.#text(x, y, t(myBuildReason(state)), 13, w, { bold: true });
          y += note.height + 10;
        }
      }
      if (this.#startResult) y = this.#drawStartResult(this.#startResult, x, y, w) + 12;
      const rows = seatRows(state, { installed: this.#installed(), refused: this.#refused });
      if (rows.length === 0) {
        const none = this.#text(x, y, t(this.#isHost() ? "room.seats.noneHost" : "room.seats.none"), 14, w, {
          alpha: 0.85,
        });
        y += none.height + 10;
      }
      for (const row of rows) y += this.#drawSeatRow(row, x, y, w) + 10;
      y += 6;
      y = this.#heading(x, y, w, t("room.people"));
      for (const [personIndex, person] of participantRows(state).entries()) {
        const hasMore = person.seats.length > 0 || person.differentVersion;
        // The device is a line of words with a small icon (never the icon alone), when their client said what it runs on.
        const rowHeight = 38 + (person.device ? 18 : 0) + (hasMore ? 16 : 0);
        const b = this.#b;
        b.box(
          { x: x + 0.5, y: y + 0.5, width: w - 1, height: rowHeight - 1 },
          { stroke: INK, strokeWidth: 1, alpha: 0.35 },
        );
        const role = t(person.roleKey).toUpperCase();
        const chipW = b.measure(role, typeRole.label, { size: 11, letterSpacing: 1 }).width + 14;
        b.box({ x: x + w - chipW - 8, y: y + 8, width: chipW, height: 22 }, { stroke: INK, strokeWidth: 2 });
        b.text(x + w - chipW / 2 - 8, y + 19, role, typeRole.label, {
          size: 11,
          letterSpacing: 1,
          color: INK,
          origin: [0.5, 0.5],
        });
        b.text(x + 10, y + 10, person.me ? `${person.name} (${t("room.you")})` : person.name, typeRole.rowTitle, {
          size: 15,
          color: INK,
          fitWidth: w - chipW - 30,
        });
        let lineY = y + 30;
        if (person.device) {
          const mark = person.platform ? playPlatformMarkOf({ platform: person.platform }) : null;
          let tx = x + 10;
          if (mark) {
            b.svg(
              { x: x + 10, y: lineY + 1, width: 14, height: 14 },
              PLATFORM_ICON_VIEWBOX,
              playPlatformSvgOps(mark, sheetColor(INK, "line"), 0.85),
              `device:${personIndex}`,
            );
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

  /**
   * "The table": what the host picked, so everyone knows what they are up against. The villain and each modular set are
   * pictures with their names (each opens the card hover on desktop); difficulty, Heroic and Skirmish are words. A guest
   * sees a line saying the host has not chosen yet; the host, who has the Set up button, sees nothing until it has.
   */
  #drawTablePlan(x: number, top: number, w: number): number {
    const plan = this.#state.tablePlan;
    if (!plan) {
      if (this.#isHost()) return top;
      const none = this.#text(x, top, t("room.table.none"), 13, w, { bold: true });
      return top + none.height + 12;
    }
    let y = this.#heading(x, top, w, t("room.table"));
    const facts = [t("room.table.difficulty", { difficulty: t(`room.table.difficulty.${plan.difficulty}` as const) })];
    if (plan.heroicLevel) facts.push(t("room.table.heroic", { level: String(plan.heroicLevel) }));
    if (plan.skirmish) facts.push(t("room.table.skirmish"));
    const line = this.#text(x, y, facts.join(" · "), 13, w, { bold: true });
    y += line.height + 8;

    const pictures = planPicturesCached(plan, {
      scenarios: currentScenarios(),
      cards: currentCardsById(),
      encounterSets: currentEncounterSets(),
    });
    const all: PlanPicture[] = [pictures.villain, ...pictures.sets];
    const { cols, size } = planGrid(all.length, w);
    const gap = 8;
    const b = this.#b;
    for (let start = 0; start < all.length; start += cols) {
      let rowHeight = 0;
      all.slice(start, start + cols).forEach((item, col) => {
        const rect: Rect = { x: x + col * (size + gap), y, width: size, height: size };
        // The picture fills its square (cropped toward the top, where a villain's face is), under an ink frame.
        b.pictureTile(rect, { src: item.artUrl, focus: { x: 0.5, y: 0.12 }, key: `plan:${item.key}` });
        if (item.cardId) {
          this.#hoverFaces.push({
            cardId: item.cardId,
            ...(item.face ? { face: item.face } : {}),
            rect: this.#inScreen(rect),
            scroll: "seats",
          });
        }
        const kind = item.key === "villain" ? `${t("room.table.villain").toUpperCase()} · ` : "";
        // At most two lines, so a long name never runs into the next row.
        const name = this.#text(rect.x, rect.y + size + 3, `${kind}${item.name}`, 11, size, {
          bold: true,
          maxLines: 2,
        });
        rowHeight = Math.max(rowHeight, size + 3 + Math.min(name.height, 30));
      });
      y += rowHeight + 8;
    }
    if (pictures.sets.length === 0) {
      const none = this.#text(x, y, t("room.table.noSets"), 12, w, { alpha: 0.8 });
      y += none.height + 6;
    }
    return y + 8;
  }

  /** The host's seat count: fewer / more (one to four). A seat somebody holds is never dropped by a press. */
  #drawSeatCount(x: number, y: number, w: number): number {
    const count = this.#state.seats.length;
    const size = hit.target;
    this.#b.text(x, y + size / 2, `${t("room.seats.count")}: ${count}`, typeRole.rowTitle, {
      size: 15,
      color: INK,
      origin: [0, 0.5],
      fitWidth: Math.max(60, w - size * 2 - 20),
    });
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
      this.#button({
        key: `seats:${button.id}`,
        look: "secondary",
        label: button.label,
        aria: button.aria,
        type: { ...typeRole.label, size: 18 },
        rect,
        enabled: button.enabled,
        ...(button.reason ? { reason: button.reason } : {}),
        run: () => this.#setSeatCount(button.to),
      });
      bx += size + 8;
    }
    const hint = this.#text(x, y + size + 4, t("room.seats.countHint"), 12, w, { alpha: 0.8 });
    return y + size + 4 + hint.height;
  }

  /** What the host's Start said when it did not start the game: the headline and a line per refused seat. */
  #drawStartResult(result: StartResultView, x: number, y: number, w: number): number {
    const pad = 10;
    const b = this.#b;
    const ground = this.#groundBox(x, y, w, {
      fill: PAPER,
      stroke: INK,
      strokeWidth: 3,
      inset: 1.5,
      key: "start-result",
    });
    let cy = y + 10;
    const head = this.#text(x + pad + 26, cy, wordsText(result.headline), 14, w - pad * 2 - 26, { bold: true });
    b.box({ x: x + pad, y: cy, width: 18, height: 18 }, { fill: INK });
    b.text(x + pad + 9, cy + 9, "!", bangers(16), { color: PAPER, origin: [0.5, 0.5] });
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
    this.#button({
      key: "start-result-dismiss",
      look: "secondary",
      label: t("room.startResult.dismiss"),
      type: { ...typeRole.label, size: 12 },
      rect,
      run: () => {
        this.#startResult = null;
        this.#draw();
      },
    });
    cy += hit.target + 12;
    ground(cy - y);
    return cy;
  }

  /** A block's heading with its rule (`mc-section-header`); returns the y under it. */
  #heading(x: number, y: number, w: number, text: string): number {
    const height = this.#b.measure(text.toUpperCase(), bangers(17), { letterSpacing: 1 }).height;
    this.#b.sectionHeader({ x, y, width: w, height }, text);
    return y + height + 8;
  }

  /** The hero a seat's deck is, as a picture for the panel: its own picture, else the identity card's hero scan. */
  #heroPicture(cardId: string): { src: string | null; retry?: string; cover: { x: number; y: number } } {
    const identity = currentCardsById().get(cardId);
    const picture = identity ? heroArtForIdentity(HERO_ART, identity.id, POOL_CARDS, () => 0) : null;
    if (picture)
      return { src: picture.url, cover: { x: picture.focus?.x ?? 0.5, y: picture.focus?.y ?? FACE_FOCUS_Y } };
    const art = identity ? artFor(identity, { kind: "hero" }) : null;
    return { ...this.#leases.image(art), cover: { x: 0.5, y: 0.3 } };
  }

  /**
   * One seat's card: its name, the deck in it (the hero's picture, hero, aspect, deck name, card count, "preset" and mods),
   * who holds it (a filled dot when connected, a hollow one when away), its action, the deck button, a deck the host turned
   * down (with the reason), mods this device lacks (with a Mod Store link) and requests.
   */
  #drawSeatRow(row: SeatRowView, x: number, y: number, w: number): number {
    const pad = 10;
    const buttonWidth = 104;
    const art = 56;
    const b = this.#b;
    // The card's ground and frame sit under everything and are as tall as the card turns out to be.
    const ground = this.#groundBox(x, y, w, {
      fill: PAPER,
      stroke: INK,
      strokeWidth: row.mine ? 4 : 2,
      inset: 1,
      key: `seat-ground:${row.id}`,
    });
    const tx = x + pad + art + 10;
    const textWidth = w - (tx - x) - pad - (row.action ? buttonWidth + 8 : 0);
    const deck = row.deck;

    let ty = y + 8;
    const tag = [row.name, ...(deck?.preset ? [t("room.deck.preset")] : [])].join(" · ").toUpperCase();
    const nameText = b.text(tx, ty, tag, typeRole.label, {
      size: 11,
      letterSpacing: 1,
      color: INK,
      alpha: 0.75,
      fitWidth: textWidth,
    });
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
    if (held && row.holderConnected) {
      b.box({ x: tx, y: dotY - 6, width: 12, height: 12 }, { fill: INK, round: true });
    } else b.box({ x: tx, y: dotY - 6, width: 12, height: 12 }, { stroke: INK, strokeWidth: 2, round: true });
    const device = row.holderDevice && textWidth >= 230 ? ` · ${row.holderDevice}` : "";
    const who = held
      ? `${row.holderName}${row.mine ? ` (${t("room.you")})` : ""}${row.holderConnected ? "" : ` · ${t("room.seat.away")}`}${row.takenOver ? ` · ${t("room.seat.takenOver")}` : ""}${device}`
      : t("room.seat.open");
    b.text(tx + 20, dotY, who, typeRole.body, {
      size: 14,
      color: INK,
      alpha: held ? 1 : 0.7,
      origin: [0, 0.5],
      fitWidth: textWidth - 20,
    });
    ty = dotY + 12;
    if (row.requestedByMe) {
      const asked = this.#text(tx, ty + 2, t("room.seat.requestedByMe"), 12, textWidth, { alpha: 0.85 });
      ty += asked.height + 4;
    }
    if (row.mismatch) {
      const label = t("room.differentVersion").toUpperCase();
      const mark = b.text(tx + 6, ty + 4, label, typeRole.label, { size: 11, letterSpacing: 1, color: INK });
      b.box({ x: tx, y: ty, width: mark.width + 12, height: 20 }, { stroke: INK, strokeWidth: 2 });
      ty += 26;
    }

    // The hero's picture (the identity card's art, as Take your seats shows it) at the left; an empty frame until a deck.
    const artRect: Rect = { x: x + pad, y: y + 10, width: art, height: art };
    if (deck) {
      const picture = this.#heroPicture(deck.cardId);
      b.pictureTile(artRect, {
        key: `hero:${row.id}`,
        src: picture.src,
        focus: picture.cover,
        frame: border.detail,
        ...(picture.retry !== undefined ? { retry: picture.retry } : {}),
      });
      this.#hoverFaces.push({ cardId: deck.cardId, rect: this.#inScreen(artRect), scroll: "seats" });
    } else {
      b.box(
        { x: artRect.x + 1, y: artRect.y + 1, width: art - 2, height: art - 2 },
        {
          stroke: INK,
          strokeWidth: 2,
          alpha: 0.45,
        },
      );
      b.text(artRect.x + art / 2, artRect.y + art / 2, "?", bangers(30), {
        color: INK,
        alpha: 0.4,
        origin: [0.5, 0.5],
      });
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
      this.#button({
        key: `seat:${row.id}`,
        look:
          action.kind === "leave" || action.kind === "withdraw" || action.kind === "remove" ? "secondary" : "primary",
        label: t(action.labelKey),
        type: { ...typeRole.label, size: 12 },
        rect,
        enabled: action.enabled,
        ...(action.reason ? { reason: t(action.reason) } : {}),
        run: () => {
          if (action.kind === "ask" || action.kind === "take") this.#api.requestSeat(row.id);
          else if (action.kind === "leave" || action.kind === "withdraw") this.#api.releaseSeat(row.id);
          else if (action.kind === "remove" && action.participant) this.#api.denySeat(row.id, action.participant);
        },
      });
    }
    if (row.play) {
      const play = row.play;
      const playRect: Rect = {
        x: x + w - pad - buttonWidth,
        y: y + 10 + hit.target + 6,
        width: buttonWidth,
        height: hit.target,
      };
      this.#button({
        key: `play:${row.id}`,
        look: "primary",
        label: t(play.labelKey),
        type: { ...typeRole.label, size: 12 },
        rect: playRect,
        run: () => {
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
        },
      });
    }
    if (canGive) {
      const giveRect: Rect = {
        x: x + w - pad - buttonWidth,
        y: y + 10 + hit.target + 6,
        width: buttonWidth,
        height: hit.target,
      };
      this.#button({
        key: `give:${row.id}`,
        look: "secondary",
        label: t("room.seat.give"),
        type: { ...typeRole.label, size: 12 },
        rect: giveRect,
        selected: picking,
        run: () => {
          this.#picking = picking ? null : row.id;
          this.#revealPicker = this.#picking !== null;
          this.#draw();
        },
      });
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
          this.#button({
            key: `give:${row.id}:${person.id}`,
            look: "primary",
            label: person.name,
            type: { ...typeRole.label, size: 13 },
            rect,
            run: () => {
              this.#picking = null;
              this.#api.assignSeat(row.id, person.id);
              this.#draw();
            },
          });
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
      const head = b.text(boxX + 30, cy + 8, t("room.deckProblem.heading").toUpperCase(), typeRole.label, {
        size: 11,
        letterSpacing: 1,
        color: INK,
        fitWidth: boxW - 40,
      });
      const title = this.#text(boxX + 30, cy + 8 + head.height + 2, t(problem.titleKey), 14, boxW - 40, { bold: true });
      const reason = this.#text(boxX + 30, cy + 8 + head.height + 2 + title.height + 2, problem.reason, 12, boxW - 40, {
        alpha: 0.9,
      });
      const boxH = 8 + head.height + 2 + title.height + 2 + reason.height + 10;
      b.box({ x: boxX + 1.5, y: cy + 1.5, width: boxW - 3, height: boxH - 3 }, { stroke: INK, strokeWidth: 3 });
      b.box({ x: boxX + 8, y: cy + 10, width: 16, height: 16 }, { fill: INK });
      b.text(boxX + 16, cy + 18, "!", bangers(16), { color: PAPER, origin: [0.5, 0.5] });
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
      this.#button({
        key: `modstore:${row.id}:${mod.id}`,
        look: "secondary",
        label: t("room.mods.store"),
        type: { ...typeRole.label, size: 12 },
        rect: store,
        run: () => {
          this.scale.off("resize", this.#draw, this);
          goToScreen(this, SCENES.modStore, {
            packId: mod.id,
            returnTo: SCENES.roomLobby,
          } satisfies ModStoreSceneData);
        },
      });
      cy += hit.target + 8;
    }

    // Choose your deck / Change deck on my seat; Set deck for the host on any other.
    if (row.deckButton) {
      const button = row.deckButton;
      const rect: Rect = { x: x + pad, y: cy, width: w - pad * 2, height: hit.target };
      this.#button({
        key: `deck:${row.id}`,
        look: button.kind === "choose" && !row.deck ? "primary" : "secondary",
        label: t(button.labelKey),
        type: { ...typeRole.label, size: 13 },
        rect,
        enabled: button.enabled,
        ...(button.reason ? { reason: t(button.reason) } : {}),
        run: () => this.#pickDeck(row.id, button.kind === "preset"),
      });
      cy += hit.target + 10;
    }

    // The host's Approve and Deny for each request.
    const requestHeight = 78;
    row.requests.forEach((request, index) => {
      const top = cy + index * requestHeight;
      b.box({ x: x + pad, y: top, width: w - pad * 2, height: 1 }, { fill: INK, alpha: 0.5 });
      this.#text(x + pad, top + 8, t("room.seat.asks", { name: request.name }), 13, w - pad * 2, { bold: true });
      const half = (w - pad * 2 - 8) / 2;
      const approve: Rect = { x: x + pad, y: top + 28, width: half, height: hit.target };
      const deny: Rect = { x: x + pad + half + 8, y: top + 28, width: half, height: hit.target };
      this.#button({
        key: `approve:${row.id}:${request.participant}`,
        look: "primary",
        label: t("room.seat.approve"),
        type: { ...typeRole.label, size: 12 },
        rect: approve,
        enabled: request.approvable,
        ...(request.reason ? { reason: t(request.reason) } : {}),
        run: () => this.#api.assignSeat(row.id, request.participant),
      });
      this.#button({
        key: `deny:${row.id}:${request.participant}`,
        look: "secondary",
        label: t("room.seat.deny"),
        type: { ...typeRole.label, size: 12 },
        rect: deny,
        run: () => this.#api.denySeat(row.id, request.participant),
      });
    });
    cy += row.requests.length * requestHeight;

    const height = cy - y;
    ground(height);
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
    key: string,
    options: { kind?: "primary" | "secondary"; selected?: boolean; enabled?: boolean; reason?: string } = {},
  ): number {
    this.#button({
      key,
      look: options.kind ?? "secondary",
      label,
      type: { ...typeRole.label, size: 12 },
      rect: { x, y, width: w, height: hit.target },
      ...(options.enabled !== undefined ? { enabled: options.enabled } : {}),
      ...(options.selected ? { selected: true } : {}),
      ...(options.reason ? { reason: options.reason } : {}),
      run,
    });
    return y + hit.target + 6;
  }

  /** Two buttons side by side (a plus and a minus, a pair of choices). */
  #panelPair(
    x: number,
    y: number,
    w: number,
    left: { label: string; run: () => void; enabled: boolean; key: string },
    right: { label: string; run: () => void; enabled: boolean; key: string },
  ): number {
    const half = (w - 8) / 2;
    this.#panelButton(x, y, half, left.label, left.run, left.key, { enabled: left.enabled });
    this.#panelButton(x + half + 8, y, half, right.label, right.run, right.key, { enabled: right.enabled });
    return y + hit.target + 6;
  }

  // ---- Civil War Competitive (issue #883) ------------------------------------------------------------------------

  /** The host's plan to the room: mode competitive, each seat on its side. Recorded in the dev preview. */
  #sendCompetitive(plan: CompetitivePlan): void {
    if (this.#preview) this.#record(`setCompetitive(${plan.length}s)`);
    else this.#api.setCompetitive(plan, tieBreaksOn(this.#state));
  }

  /** The side a host with no seat speaks for. */
  #hostPick: TeamId | null = null;

  #drawCompetitivePanel(rect: Rect, titled: boolean): void {
    const inner = this.#frame(rect, titled ? t("comp.heading") : null);
    const state = this.#state;
    const host = this.#isHost();
    const plan = competitivePlanOf(state);
    this.#scrollPanel("seats", inner, (x, top, w) => {
      let y = top + 2;
      y += this.#text(x, y, t("comp.mode.detail"), 13, w, { alpha: 0.85 }).height + 8;
      if (this.#startResult) y = this.#drawStartResult(this.#startResult, x, y, w) + 12;
      if (host && !state.started) {
        y = this.#panelPair(
          x,
          y,
          w,
          {
            label: `${perTeamOf(plan) === 1 ? "✓ " : ""}${t("comp.size.1v1")}`,
            run: () => this.#sendCompetitive(withTeamSize(plan, 1)),
            enabled: perTeamOf(plan) !== 1,
            key: "comp:size1",
          },
          {
            label: `${perTeamOf(plan) === 2 ? "✓ " : ""}${t("comp.size.2v2")}`,
            run: () => this.#sendCompetitive(withTeamSize(plan, 2)),
            enabled: perTeamOf(plan) !== 2,
            key: "comp:size2",
          },
        );
      }
      const speaking = speakingFor(state, this.#hostPick ?? "registration");
      for (const view of teamViews(state, speaking)) {
        y = this.#drawTeam(view, x, y, w) + 12;
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

  /** One side's card: its seats and heroes, whether a scenario is sealed for the other side, and Ready. Never the scenario. */
  #drawTeam(view: TeamView, x: number, y0: number, w: number): number {
    const state = this.#state;
    const host = this.#isHost();
    const pad = 10;
    const inW = w - pad * 2;
    let y = y0 + pad;
    const ground = this.#groundBox(x, y0, w, {
      fill: PARCHMENT,
      stroke: INK,
      strokeWidth: view.mine ? 4 : 2,
      inset: 1,
      key: `team-ground:${view.team}`,
    });
    const side = t(view.nameKey);
    const title = this.#b.text(x + pad, y, view.mine ? t("comp.area.you", { side }) : side, typeRole.rowTitle, {
      size: 17,
      color: INK,
      fitWidth: inW,
    });
    y += title.height + 4;
    const status = [
      view.submitted ? t("comp.seal.sealed") : t("comp.seal.none"),
      view.ready ? t("comp.ready.state") : t("comp.ready.notYet"),
    ].join(" · ");
    y += this.#text(x + pad, y, status, 13, inW, { bold: true }).height + 8;
    const rows = new Map(seatRows(state, { installed: this.#installed() }).map((r) => [r.id, r]));
    for (const seat of view.seats) {
      const row = rows.get(seat.id);
      if (!row) continue;
      y += this.#drawSeatRow(row, x + pad, y, inW) + 6;
      if (seat.canSwitch && !state.started) {
        const to = otherTeam(view.team);
        y = this.#panelButton(
          x + pad,
          y,
          inW,
          t("comp.team.moveTo", { side: t(to === "registration" ? "comp.side.registration" : "comp.side.resistance") }),
          () => (this.#preview ? this.#record(`setTeam(${seat.id},${to})`) : this.#api.setTeam(seat.id, to)),
          `team:${seat.id}`,
        );
      }
    }
    if (host && state.mySeats.length === 0 && !state.started) {
      y = this.#panelButton(
        x + pad,
        y,
        inW,
        t("comp.side.speak", { side }),
        () => {
          this.#hostPick = view.team;
          this.#draw();
        },
        `speak:${view.team}`,
        { selected: view.mine },
      );
    }
    const block = view.buildBlock;
    const forSide = t(otherTeam(view.team) === "registration" ? "comp.side.registration" : "comp.side.resistance");
    y = this.#panelButton(
      x + pad,
      y,
      inW,
      t(view.submitted ? "comp.seal.rebuild" : "comp.seal.build", { side: forSide }),
      () => this.#openSeal(view.team),
      `seal:${view.team}`,
      { enabled: block === null, ...(block ? { reason: t(block) } : {}), kind: view.mine ? "primary" : "secondary" },
    );
    const readyBlock = view.readyBlock;
    y = this.#panelButton(
      x + pad,
      y,
      inW,
      t(view.ready ? "comp.ready.undo" : "comp.ready"),
      () =>
        this.#preview
          ? this.#record(`setTeamReady(${view.team},${!view.ready})`)
          : this.#api.setTeamReady(!view.ready, view.team),
      `ready:${view.team}`,
      { enabled: readyBlock === null, ...(readyBlock ? { reason: t(readyBlock) } : {}), selected: view.ready },
    );
    const height = y - y0 + pad - 6;
    ground(height);
    return y0 + height;
  }

  #record(call: string): void {
    ((globalThis as { __mcRoomCalls?: string[] }).__mcRoomCalls ??= []).push(call);
  }

  /** Opens the Civil War builder for the other team's scenario: this side's leaders and sets only. */
  #openSeal(team: TeamId): void {
    if (this.#preview) return this.#record(`openSeal(${team})`);
    const first = civilWarSidesOffer().find((side) => side.side === team)?.leaders[0]?.scenarioId;
    if (!first) return;
    startSealing(team);
    const entry = openBuilderOn(newGameDraft(), first);
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.civilWarBuilder, { draft: entry.draft, step: 1 });
  }

  /** The host's game mode picker: the boxes choose, and `choose` is the lobby's own (a mode already in force does nothing). */
  #openModePicker(current: RoomModeId, choose: (mode: RoomModeId) => void): void {
    if (this.scene.isActive(SCENES.roomModePicker)) return;
    this.scene.launch(SCENES.roomModePicker, {
      current,
      onChoose: choose,
      watch: !this.#preview,
    } satisfies RoomModePickerData);
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
    this.#scrollPanel("seats", inner, (x, top, w) => {
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
        y = this.#drawEpicTable(view, plan, x, y, w) + 12;
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
  #drawEpicTable(view: EpicTableView, plan: EpicPlan | null, x: number, y0: number, w: number): number {
    const organizer = this.#isHost();
    const editable = organizer && plan !== null && !this.#state.epic?.start;
    const pad = 10;
    const inW = w - pad * 2;
    let y = y0 + pad;
    const ground = this.#groundBox(x, y0, w, {
      fill: PARCHMENT,
      stroke: INK,
      strokeWidth: view.mine ? 4 : 2,
      inset: 1,
      key: `epic-ground:${view.id}`,
    });
    const name = this.#b.text(x + pad, y, view.name, typeRole.rowTitle, { size: 17, color: INK, fitWidth: inW });
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
        `drop:${view.id}`,
      );
    }
    // Each seat shows its deck and the deck button of the standard seat row: the player (or the organizer, as a preset)
    // chooses the deck, and the hero is the deck's.
    for (const seat of view.seats) y += this.#drawSeatRow(seat, x + pad, y, inW) + 6;
    const height = y - y0 + pad - 6;
    ground(height);
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
    this.#scrollPanel("settings", inner, (x, top, w) => {
      const b = this.#b;
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
            key,
            look: "secondary",
            label: on ? t("room.on") : t("room.off"),
            rect: rect2,
            selected: on,
            run: change,
          });
        } else {
          b.box(
            { x: rect2.x, y: rect2.y + 4, width: rect2.width, height: hit.target - 8 },
            {
              stroke: INK,
              strokeWidth: 2,
              alpha: on ? 1 : 0.5,
            },
          );
          b.text(
            rect2.x + rect2.width / 2,
            rect2.y + hit.target / 2,
            (on ? t("room.on") : t("room.off")).toUpperCase(),
            typeRole.label,
            {
              color: INK,
              alpha: on ? 1 : 0.6,
              origin: [0.5, 0.5],
            },
          );
        }
        y += rowH + 8;
      };

      // The host's Live now toggle leads the settings when the header has no room for it (a phone).
      const listedRow = (): void =>
        toggleRow("listed", t("room.listed.title"), t("room.listed.detail"), settings.listed === true, () =>
          this.#api.setLobby({ settings: { listed: settings.listed !== true } }),
        );
      if (host && !this.#listedInHeader) listedRow();

      // One choice of a few: the host's button with its detail under it, everyone else just the chosen one.
      const choice = (
        key: string,
        title: string,
        detail: string,
        selected: boolean,
        pressable: boolean,
        choose: () => void,
      ): void => {
        if (pressable) {
          this.#button({
            key,
            look: "secondary",
            label: title,
            rect: { x, y, width: w, height: hit.target },
            selected,
            run: choose,
          });
          y += hit.target + 4;
          const info = this.#text(x + 4, y, detail, 12, w - 8, { alpha: 0.8 });
          y += info.height + 10;
        } else if (selected) {
          const name = this.#text(x, y, title, 15, w, { bold: true });
          const info = this.#text(x, y + name.height + 2, detail, 12, w, { alpha: 0.85 });
          y += name.height + info.height + 12;
        }
      };

      // Standard or Epic (Trickster Takeover): the organizer's choice, everyone's to read.
      y = this.#heading(x, y, w, t("epic.mode.title"));
      const epicOn = this.#state.epic !== null;
      if (host) {
        const modeNow = this.#state.competitive ? "competitive" : epicOn ? "epic" : "standard";
        const choose = (mode: "standard" | "epic" | "competitive"): void => {
          if (mode === modeNow) return;
          if (mode === "epic") this.#sendPlan(newEpicPlan());
          else if (mode === "competitive") this.#sendCompetitive(newCompetitivePlan(1));
          else this.#api.setLobby({ settings: { mode: "standard" } });
        };
        // The current mode as a small box of cards, and the button that opens the picker (the three boxes and what
        // each one is: `scenes/room-mode-picker.ts`).
        const thumb: Rect = { x, y, width: 52, height: 68 };
        const copy = ROOM_MODE_COPY[modeNow];
        b.box({ x: thumb.x + 3, y: thumb.y + 3, width: thumb.width, height: thumb.height }, { fill: INK });
        copy.art.forEach((id, i) => {
          const slot: Rect = {
            x: thumb.x + (i * thumb.width) / copy.art.length,
            y: thumb.y,
            width: thumb.width / copy.art.length,
            height: thumb.height,
          };
          const picture = villainPicture(id);
          b.pictureTile(slot, {
            key: `modeThumb:${i}`,
            src: picture?.url ?? null,
            frame: 0,
            focus: { x: picture?.focus?.x ?? 0.5, y: picture?.focus?.y ?? 0.3 },
          });
        });
        b.box(thumb, { stroke: INK, strokeWidth: 3 });
        const tx = thumb.x + thumb.width + 12;
        const nameText = this.#text(tx, y + 2, t(copy.title), 17, w - (tx - x), { bold: true });
        const tag = this.#text(tx, y + 2 + nameText.height, t(copy.tagline), 12, w - (tx - x), { alpha: 0.85 });
        const change: Rect = {
          x: tx,
          y: Math.max(y + thumb.height - hit.target, y + 4 + nameText.height + tag.height),
          width: Math.min(w - (tx - x), 220),
          height: hit.target,
        };
        this.#button({
          key: "epicmode:change",
          look: "secondary",
          label: t("room.modes.change"),
          type: { ...typeRole.label, size: 12 },
          rect: change,
          run: () => this.#openModePicker(modeNow, choose),
        });
        y = Math.max(thumb.y + thumb.height, change.y + hit.target) + 8;
        if (this.#state.competitive) {
          y += this.#text(x + 4, y, t("comp.friendly"), 12, w - 8, { alpha: 0.8 }).height + 10;
          const compState = this.#state;
          toggleRow("comp:tie", t("comp.tiebreaks.title"), t("comp.tiebreaks.detail"), tieBreaksOn(compState), () =>
            this.#api.setLobby({ settings: { tieBreaks: !tieBreaksOn(compState) } }),
          );
          toggleRow("comp:expert", t("comp.expert.title"), t("comp.expert.detail"), expertOn(compState), () =>
            this.#api.setLobby({ settings: expertPatch(compState) }),
          );
        }
      } else {
        const line = this.#text(
          x,
          y,
          t(this.#state.competitive ? "comp.mode.competitive" : epicOn ? "epic.mode.epic" : "epic.mode.standard"),
          15,
          w,
          { bold: true },
        );
        y += line.height + 8;
        if (this.#state.competitive) {
          const on = (v: boolean): string => (v ? t("room.on") : t("room.off"));
          const opts = `${t("comp.tiebreaks.title")}: ${on(tieBreaksOn(this.#state))} · ${t("comp.expert.title")}: ${on(expertOn(this.#state))}`;
          y += this.#text(x, y, opts, 13, w, { alpha: 0.85 }).height + 8;
          y += this.#text(x, y, t("comp.friendly"), 12, w, { alpha: 0.8 }).height + 8;
        }
      }

      // How it's played.
      y = this.#heading(x, y, w, t("room.mode.title"));
      for (const mode of ["strict", "host"] as const) {
        const words = playModeKeys[mode];
        choice(`mode:${mode}`, t(words.title), t(words.detail), settings.playMode === mode, host, () =>
          this.#api.setLobby({ settings: { playMode: mode } }),
        );
      }

      // Villain phase pacing (#881): who steps a guest's villain phase screen along.
      y = this.#heading(x, y + 4, w, t("room.villain.title"));
      for (const value of ["host", "each"] as const) {
        const words = villainPacingKeys[value];
        choice(`villain:${value}`, t(words.title), t(words.detail), pacingOf(settings) === value, host, () =>
          this.#api.setLobby({ settings: { villainPacing: value } }),
        );
      }

      // Undo: who may take a move back (Strict forces Off).
      y = this.#heading(x, y + 4, w, t("room.undo.title"));
      for (const row of undoRows(settings)) {
        choice(
          `undo:${row.value}`,
          t(row.titleKey),
          t(row.detailKey),
          row.selected,
          host && settings.playMode !== "strict",
          () => this.#api.setLobby({ settings: { undo: row.value } }),
        );
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
            { alpha: 0.9 },
          );
          y += name.height + state.height + 10;
          if (!mod.have) {
            // The Mod Store, opened on this pack; its Back returns here (the room stays joined).
            this.#button({
              key: `modstore:${mod.id}`,
              look: "secondary",
              label: t("room.mods.store"),
              type: { ...typeRole.label, size: 12 },
              rect: { x, y, width: w, height: hit.target },
              run: () => {
                this.scale.off("resize", this.#draw, this);
                goToScreen(this, SCENES.modStore, {
                  packId: mod.id,
                  returnTo: SCENES.roomLobby,
                } satisfies ModStoreSceneData);
              },
            });
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
      // Chosen in the lobby: a teaching table where every seated device (and watchers) sees every hand. Off by default.
      toggleRow("openHands", t("room.openHands.title"), t("room.openHands.detail"), openHandsOf(this.#state), () =>
        this.#api.setLobby({ settings: { openHands: !openHandsOf(this.#state) } }),
      );
      // The host's opt-in to the public "Live now" list, off unless the host turns it on: a guest reads it here, the host
      // has it in the header or at the top of this list.
      if (!host) listedRow();
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

  /** Opens or closes the floating chat. Opening shows the newest line; closing leaves the draft in the field. */
  #setChatOpen(open: boolean): void {
    this.#chatOpen = open;
    this.#chatToEnd = open;
    this.#draw();
    if (open && !this.sys.game.device.input.touch) this.#chatInput?.focus();
  }

  /** Opens the chat in its own window. The dev preview has no room worker, so it pretends. */
  #popOut(): void {
    if (this.#preview) {
      this.#popped = true;
      this.#draw();
      return;
    }
    const roomId = this.#state.roomId;
    if (!roomId) return;
    this.#popBlocked = false;
    // This tab's own token: the window's channel is named for it, so another tab in this browser never joins it.
    const token = mintPopoutToken();
    armChatPopout(token);
    void openChatPopout(roomId, token, artLanguageNow()).then((opened) => {
      if (opened || !this.#alive) return;
      // A blocked pop-up: say so in the chat header for a few seconds; the chat stays where it is.
      this.#popBlocked = true;
      this.#draw();
      this.time.delayedCall(6000, () => {
        if (!this.#alive) return;
        this.#popBlocked = false;
        this.#draw();
      });
    });
  }

  /** Brings the chat back from its window. */
  #bringBack(): void {
    if (this.#preview) {
      this.#popped = false;
      this.#draw();
      return;
    }
    recallChatPopout();
  }

  /** The Pop out button of a chat panel that has a header to hold it (the floating panel and the ultrawide column). */
  #drawPopOutButton(rect: Rect, offset: number): void {
    if (!this.#canPopOut || !chatOn(this.#state)) return;
    const popRect: Rect = { x: rect.x + rect.width - 12 - offset - 120, y: rect.y + 6, width: 120, height: 30 };
    this.#button({
      key: "chat-popout",
      look: "secondary",
      label: t("room.chat.popout"),
      rect: popRect,
      run: () => this.#popOut(),
    });
  }

  /** What the lobby's chat says while it is in its own window, with the way back. */
  #drawPoppedNotice(inner: Rect): void {
    this.#chatInput?.setVisible(false);
    this.#text(inner.x + 2, inner.y + 4, t("room.chat.popped"), 14, inner.width - 4, { bold: true });
    const back: Rect = { x: inner.x, y: inner.y + 40, width: Math.min(inner.width, 200), height: hit.target };
    this.#button({
      key: "chat-bring-back",
      look: "primary",
      label: t("room.chat.bringBack"),
      rect: back,
      run: () => this.#bringBack(),
    });
  }

  /** The floating chat's corner while the chat is in its own window: a small card in the pill's place. */
  #drawPoppedCard(rect: Rect): void {
    // The card's own box takes every press over it, so nothing under it is pressed through it.
    this.#b.box({ x: rect.x + 6, y: rect.y + 6, width: rect.width, height: rect.height }, { fill: INK });
    const inner = this.#frame(rect, null);
    this.#b.box(
      { x: rect.x + 1.5, y: rect.y + 1.5, width: rect.width - 3, height: rect.height - 3 },
      {
        stroke: INK,
        strokeWidth: 3,
      },
    );
    this.#drawPoppedNotice({ ...inner, y: inner.y + 2, width: inner.width });
  }

  /** The closed floating chat: a Chat pill at the corner, with the unread count beside it. */
  #drawChatPill(rect: Rect, unread: number): void {
    this.#button({
      key: "chat-pill",
      look: "primary",
      label: t("room.tab.chat"),
      rect,
      run: () => this.#setChatOpen(true),
      ...(unread > 0 ? { labelShift: -10 } : {}),
    });
    if (unread > 0) {
      this.#b.text(
        rect.x + rect.width - 12,
        rect.y + rect.height / 2,
        unread > 9 ? "9+" : String(unread),
        typeRole.label,
        {
          color: PAPER,
          origin: [1, 0.5],
        },
      );
    }
  }

  #drawChatPanel(rect: Rect, titled: boolean, phone: boolean, floating = false): void {
    const state = this.#state;
    const b = this.#b;
    // A floating panel is opaque and takes the pointer, so nothing under it scrolls or presses through it: a comic-panel
    // drop shadow (an offset ink box) and a heavier border lift it off the settings.
    if (floating) b.box({ x: rect.x + 6, y: rect.y + 6, width: rect.width, height: rect.height }, { fill: INK });
    const framed = this.#frame(rect, titled ? t("room.tab.chat") : null);
    let inner = framed;
    if (this.#popBlocked && titled && !this.#popped) {
      this.#text(framed.x + 2, framed.y - 2, t("room.chat.popoutBlocked"), 12, framed.width - 4, { bold: true });
      inner = { ...framed, y: framed.y + 20, height: framed.height - 20 };
    }
    if (floating) {
      b.box(
        { x: rect.x + 1.5, y: rect.y + 1.5, width: rect.width - 3, height: rect.height - 3 },
        {
          stroke: INK,
          strokeWidth: 3,
        },
      );
      const closeRect: Rect = { x: rect.x + rect.width - 12 - 92, y: rect.y + 6, width: 92, height: 30 };
      this.#button({
        key: "chat-close",
        look: "secondary",
        label: t("room.chat.close"),
        rect: closeRect,
        run: () => this.#setChatOpen(false),
      });
      this.#drawPopOutButton(rect, 92 + 8);
    } else if (this.#layoutMode === "triple") {
      // Only the floating panel and the ultrawide column pop out; the tablet-landscape and stacked layouts do not.
      this.#drawPopOutButton(rect, 0);
    }
    if (this.#popped && chatOn(state)) {
      this.#drawPoppedNotice(inner);
      return;
    }
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

    this.#scrollPanel("chat", listRect, (x, top, w) => {
      const list = this.#b;
      if (state.chat.length === 0) {
        const none = this.#text(x + 2, top + 4, t("room.chat.empty"), 13, w, { alpha: 0.75 });
        return none.height + 8;
      }
      let y = top + 2;
      for (const line of state.chat) {
        const who = line.name ?? "?";
        const text = `${who}: ${line.text}`;
        const spec = line.mine ? typeRole.rowTitle : typeRole.body;
        const h = list.measure(text, spec, { size: 13, wrapWidth: w - 16 }).height + 8;
        list.box(
          { x: x + 0.5, y: y + 0.5, width: w - 1, height: h - 1 },
          {
            stroke: INK,
            strokeWidth: line.mine ? 2 : 1,
            alpha: line.mine ? 1 : 0.35,
          },
        );
        list.text(x + 8, y + 4, text, spec, { size: 13, color: INK, wrapWidth: w - 16 });
        y += h + 4;
      }
      return y - top;
    });

    this.#fieldRect = fieldRect;
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
      key: "chat-send",
      look: "primary",
      label: t("room.chat.send"),
      rect: sendRect,
      enabled: this.#state.connection !== "ended",
      run: () => this.#sendChat(!this.sys.game.device.input.touch),
      noStop: true,
    });
    this.#addStop("chat-field", fieldRect, () => this.#chatInput?.focus());
    this.#addStop("chat-send", sendRect, () => this.#sendChat());
  }

  // ---- Footer -----------------------------------------------------------------------------------------------------

  #drawFooter(rect: Rect, phone: boolean): void {
    const state = this.#state;
    const b = this.#b;
    b.box(rect, { fill: INK });
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
    /** The footer's line of words: wrapped to the strip, a point smaller (down to 11) when it is too tall for it. */
    const say2 = (text: string, bold = false): number => {
      const spec = bold ? typeRole.rowTitle : typeRole.body;
      let size = phone ? 12 : 13;
      if (b.measure(text, spec, { size, wrapWidth: textRect.width }).height > textRect.height) size = 11;
      b.text(textRect.x, textRect.y + textRect.height / 2, text, spec, {
        size,
        color: PAPER,
        origin: [0, 0.5],
        wrapWidth: textRect.width,
        key: "footer-words",
      });
      return b.nodes.length - 1;
    };

    if (this.#confirmLeave) {
      say2(t("room.closeSure"), true);
      const half = (buttonRect.width - 8) / 2;
      const stay: Rect = { ...buttonRect, width: half };
      const close: Rect = { ...buttonRect, x: buttonRect.x + half + 8, width: half };
      this.#button({
        key: "stay",
        look: "onInk",
        label: t("room.stay"),
        rect: stay,
        run: () => {
          this.#confirmLeave = false;
          this.#draw();
        },
      });
      this.#button({
        key: "close",
        look: "primary",
        label: t("room.closeRoom"),
        rect: close,
        run: () => this.#goTitle(),
      });
      return;
    }
    if (state.connection === "ended") {
      const words = connectionWords(state);
      if (words) say2(wordsText(words), true);
      this.#button({
        key: "back-title",
        look: "primary",
        label: t("room.backToTitle"),
        rect: buttonRect,
        run: () => this.#goTitle(),
      });
      return;
    }
    const note = this.#noteNow();
    if (!this.#isHost()) {
      // While the host is in a setup screen, the status bar says which, with a moving ellipsis (`view/room-host-activity.ts`).
      const activity = note === null && state.connection === "connected" ? hostActivityWords(state.hostActivity) : null;
      if (activity) {
        const base = wordsText(activity);
        // Fitted with the longest ellipsis, so the text never needs refitting as the dots change.
        const at = say2(base + "...", true);
        const dots = activityDots(this.time.now, appSession().settings.reducedMotion);
        this.#activity = { index: at, words: base, dots: "..." };
        this.#writeActivityDots(dots);
        return;
      }
      say2(note ?? t("room.start.guestWait"), note !== null);
      return;
    }
    const block = this.#startWords();
    const resultNote = this.#startResult ? wordsText(this.#startResult.headline) : null;
    say2(note ?? resultNote ?? (block ? wordsText(block) : ""), note !== null || resultNote !== null);
    this.#button({
      key: "start",
      look: "primary",
      label: this.#starting ? t("room.starting") : t("room.start"),
      type: bangers(22),
      rect: buttonRect,
      enabled: block === null && !this.#starting,
      ...(block ? { reason: wordsText(block) } : {}),
      run: () => void this.#start(),
    });
  }

  /** Puts the host-activity line's ellipsis in the parts being built. */
  #writeActivityDots(dots: string): void {
    const activity = this.#activity;
    const node = activity ? this.#b.nodes[activity.index] : undefined;
    if (!activity || node?.kind !== "text") return;
    activity.dots = dots;
    this.#b.nodes[activity.index] = { ...node, text: activity.words + dots };
  }

  /** The ellipsis moves on: the panel gets the parts again with only that line changed. */
  #setActivityDots(dots: string): void {
    if (!this.#activity || this.#activity.dots === dots || !this.#region) return;
    this.#writeActivityDots(dots);
    this.#nodes = [...this.#b.nodes];
    this.#region.element.nodes = this.#nodes;
  }
}
