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
import { currentCardsById, currentPool, currentScenarios, currentDeps, POOL_VERSION } from "../content/pool.js";
import { t } from "../i18n/translate.js";
import { loadedPacks } from "../packs/pack-registry.js";
import { withLoadedPacks } from "../packs/game-packs.js";
import {
  leaveRoom,
  onRoomState,
  releaseSeat,
  requestSeat,
  roomState,
  say,
  setLobby,
  startGame,
  assignSeat,
  denySeat,
  takeOverSeat,
  giveBackSeat,
  type RoomState,
} from "../platform/room.js";
import { enterSeatGame, playRoomGame } from "../platform/seat-play.js";
import { askToConfirm } from "./end-turn-confirm.js";
import { appSession, deckStorage } from "../session.js";
import { copyText } from "../ui/report-export.js";
import { hit, surface, typeRole } from "../tokens.js";
import { bangers, campaignFrame, drawTopBar } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
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
import type { DeckOption } from "../view/deck-list-model.js";
import { corePlayerForSeat } from "../view/deck-seat.js";
import type { Rect } from "../view/layout.js";
import { lobbyLayout, type LobbyPanelId } from "../view/room-lobby-layout.js";
import {
  chatOn,
  codeShown,
  connectionWords,
  guestModRows,
  hostModRows,
  participantRows,
  playModeKeys,
  refusalWords,
  seatRows,
  startBlock,
  tableRuleRows,
  toggleModPatch,
  toggleTableRulePatch,
  wordsText,
  type SeatRowView,
  type Words,
} from "../view/room-lobby-model.js";
import { clearRoomTable, enterRoomSetup, parseSeatLabel, roomDraft } from "../view/room-table-setup.js";
import { setSeatNote } from "../view/room-seat-note.js";
import { seatableDeckOptionsOf } from "../view/seatable-decks.js";
import { tableRulesOf, type Settings } from "../settings.js";
import { toSessionConfig } from "../view/setup-draft.js";
import type { SessionConfig } from "../engine/host.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { introReplay } from "./replay-entry.js";
import { newGameDraft } from "./title.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import type { ScenarioSelectData } from "./scenario-select.js";
import type { TableSetupData } from "./table-setup.js";

/** How long a note about what the room refused, or why a button is off, stays in the footer. */
const NOTE_MS = 6000;
const PAPER = surface.paper.hex;
const INK = surface.ink.hex;
const PARCHMENT = surface.parchment.hex;

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
  #decks: readonly DeckOption[] | null = null;
  #starting = false;
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
    this.#opening = false;
    this.#openAfter = 0;
    this.#openBackoff = 3000;
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
    void deckStorage()
      .list()
      .then((decks) => {
        if (!this.#alive) return;
        this.#decks = seatableDeckOptionsOf(decks, currentPool(), POOL_VERSION, currentDeps());
        this.#draw();
      });
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

  // ---- State --------------------------------------------------------------------------------------------------

  #onState(state: RoomState): void {
    if (!this.#alive) return;
    this.#state = state;
    if (state.role === "none") return;
    if (state.refusal && state.refusal.seq !== this.#refusalSeen) {
      this.#refusalSeen = state.refusal.seq;
      const words = refusalWords(state.refusal, state);
      if (words) this.#say(wordsText(words));
    }
    if (state.chat.length > this.#chatCount) {
      this.#chatCount = state.chat.length;
      this.#chatToEnd = true;
    }
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

  /** The game the kept draft makes, with the lobby's house rules, or null while the table is not set up. */
  #config(): SessionConfig | null {
    const draft = roomDraft();
    const decks = this.#decks;
    if (!draft || !decks) return null;
    // Built again only when the draft, the decks, the loaded packs or the house rule change (every draw asks).
    const rule = this.#state.settings?.tableRules.sameNameHeroAllyConflict === true;
    const packs = loadedPacks()
      .map((p) => `${p.id}@${p.version}`)
      .join(",");
    // The draft is compared by value: Table setup may edit the kept object in place.
    const draftKey = JSON.stringify(draft);
    const cached = this.#configCache;
    if (
      cached &&
      cached.draft === draftKey &&
      cached.decks === decks &&
      cached.rule === rule &&
      cached.packs === packs
    ) {
      return cached.config;
    }
    const config = this.#buildConfig(draft, decks);
    this.#configCache = { draft: draftKey, decks, rule, packs, config };
    return config;
  }

  #configCache: {
    readonly draft: string;
    readonly decks: unknown;
    readonly rule: boolean;
    readonly packs: string;
    readonly config: SessionConfig | null;
  } | null = null;

  #buildConfig(draft: NonNullable<ReturnType<typeof roomDraft>>, decks: readonly DeckOption[]): SessionConfig | null {
    const options = draft.seats.map((id) => decks.find((o) => (o.deck.id as string) === id));
    if (options.length === 0 || options.some((o) => o === undefined)) return null;
    const players = (options as DeckOption[]).map((o) => corePlayerForSeat(o, draft.deckSwaps));
    const scenario = currentScenarios().find((s) => (s.id as string) === draft.scenarioId);
    const rules = this.#state.settings?.tableRules;
    const settings = { sameNameHeroAllyConflict: rules?.sameNameHeroAllyConflict === true } as Pick<
      Settings,
      "sameNameHeroAllyConflict"
    >;
    return toSessionConfig(draft, players, scenario, tableRulesOf(settings));
  }

  #packsUsed(config: SessionConfig | null): readonly { id: string; version: string }[] {
    return config ? (withLoadedPacks(config).packs?.map((p) => ({ id: p.id, version: p.version })) ?? []) : [];
  }

  #startWords(): Words | null {
    const config = this.#config();
    return startBlock(this.#state, { tableReady: config !== null, packsUsed: this.#packsUsed(config) });
  }

  #setUpTable(): void {
    if (!this.#isHost()) return;
    enterRoomSetup();
    this.scale.off("resize", this.#draw, this);
    const draft = roomDraft();
    if (draft) goToScreen(this, SCENES.setup, { draft } satisfies TableSetupData);
    else goToScreen(this, SCENES.scenarioSelect, { draft: newGameDraft() } satisfies ScenarioSelectData);
  }

  async #start(): Promise<void> {
    if (this.#starting) return;
    const block = this.#startWords();
    if (block) {
      this.#say(wordsText(block));
      this.#draw();
      return;
    }
    const config = this.#config();
    if (!config) return;
    this.#starting = true;
    this.#draw();
    await startGame(config);
    if (!this.#alive) return;
    const { store } = appSession();
    if (store.state.status === "failed") {
      this.#starting = false;
      this.#say(store.state.error ?? t("room.refusal.generic"));
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
      try {
        await enterSeatGame(result.host);
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
      goToScreen(this, SCENES.board, {});
      return;
    }
    const labels = this.#state.mySeats.map(
      (id) => parseSeatLabel(this.#state.seats.find((s) => s.id === id)?.label ?? id).text,
    );
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

  #goTitle(): void {
    leaveRoom();
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
    this.add.rectangle(0, 0, width, height, PAPER).setOrigin(0, 0);
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
    const layout = lobbyLayout(width, height, bar.height, this.#tab, gutter, undefined, footerHeight);
    this.#drawHeader(layout.header, phone);

    if (layout.tabs) {
      const ids = layout.tabIds.filter((id) => id !== "chat" || chatOn(state));
      const cell = layout.tabs.width / ids.length;
      this.#tabs = new McTabs(this, {
        rect: layout.tabs,
        tabs: ids.map((id) => ({ id, label: t(`room.tab.${id}` as const) })),
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
    this.#drawFooter(layout.footer, phone);
    this.#route?.set(this.#order, this.#stops);
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
    const inner = this.#frame(rect, titled ? t("room.seats") : null);
    const state = this.#state;
    this.#scrollPanel("seats", inner, (x, top, w, guard) => {
      let y = top + 2;
      if (this.#isHost()) {
        const hint = this.#text(x, y, t("room.hostHint"), 13, w, { alpha: 0.85 });
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
        y += hit.target + 14;
      } else if (!state.buildMatches) {
        const note = this.#text(x, y, t("room.refusal.buildMismatch"), 13, w, { bold: true });
        y += note.height + 10;
      }
      const rows = seatRows(state, { installed: this.#installed() });
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
        if (person.differentVersion) more.push(t("room.differentVersion"));
        if (more.length > 0) this.#text(x + 10, lineY, more.join(" · "), 12, w - 20, { alpha: 0.8 });
        y += rowHeight + 6;
      }
      return y - top + 4;
    });
  }

  #heading(x: number, y: number, w: number, text: string): number {
    const h = this.add.text(x, y, text.toUpperCase(), textStyle(bangers(17), INK)).setLetterSpacing(1);
    const g = this.add.graphics();
    g.fillStyle(INK, 1).fillRect(x + h.width + 10, y + h.height / 2 - 1, Math.max(0, w - h.width - 10), 2);
    return y + h.height + 8;
  }

  /** One seat's card: label, who holds it (a filled dot when connected, a hollow one when away), its action and requests. */
  #drawSeatRow(
    row: SeatRowView,
    x: number,
    y: number,
    w: number,
    guard: { clip: () => Rect; suppress: () => boolean; stop: (key: string, rect: Rect, activate: () => void) => void },
  ): number {
    const pad = 10;
    const buttonWidth = 104;
    // The hero's picture (the identity card's art, as Take your seats shows it) at the left.
    const artSize = row.cardId ? 56 : 0;
    const tx = x + pad + (artSize > 0 ? artSize + 10 : 0);
    const textWidth = w - (tx - x) - pad - (row.action ? buttonWidth + 8 : 0);
    // The label wraps (never shrinks to nothing on a narrow screen), up to two lines.
    const label = this.add
      .text(tx, y + 10, row.label, textStyle(typeRole.rowTitle, INK))
      .setFontSize(15)
      .setWordWrapWidth(textWidth, true);
    if (label.height > 15 * 2.6) fitText(label, textWidth, 13);
    const holderY = y + 10 + label.height + 16;
    const topHeight = holderY + 14 - y + (row.requestedByMe ? 18 : 0) + (row.mismatch ? 26 : 0);
    const requestHeight = 78;
    const canGive = row.candidates.length > 0 || (this.#isHost() && row.holderName === null);
    const picking = canGive && this.#picking === row.id;
    const pickHeight = picking ? (row.candidates.length > 0 ? row.candidates.length * (hit.target + 6) + 6 : 30) : 0;
    const buttonsHeight = 10 + hit.target + (canGive || row.play ? 6 + hit.target : 0) + 10;
    const topEnd = Math.max(topHeight, artSize > 0 ? 10 + artSize + 10 : 0, buttonsHeight);
    const height = topEnd + pickHeight + row.requests.length * requestHeight;
    const g = this.add.graphics();
    this.children.moveTo(g, this.children.getIndex(label));
    g.fillStyle(PAPER, 1).fillRect(x, y, w, height);
    g.lineStyle(row.mine ? 4 : 2, INK, 1).strokeRect(x + 1, y + 1, w - 2, height - 2);
    // Who holds it.
    const dotY = holderY;
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
    if (row.cardId) {
      const rect: Rect = { x: x + pad, y: y + 10, width: artSize, height: artSize };
      drawHeroAvatar(this, rect, currentCardsById().get(row.cardId), INK);
      this.#hoverFaces.push({ cardId: row.cardId, rect, view: guard.clip(), scroll: "seats" });
    }
    if (row.requestedByMe) {
      this.#text(tx, dotY + 12, t("room.seat.requestedByMe"), 12, textWidth, { alpha: 0.85 });
    }
    if (row.mismatch) {
      const tag = this.add
        .text(tx + 6, y + topHeight - 22, t("room.differentVersion").toUpperCase(), textStyle(typeRole.label, INK))
        .setFontSize(11)
        .setLetterSpacing(1);
      g.lineStyle(2, INK, 1).strokeRect(tx, y + topHeight - 26, tag.width + 12, 20);
    }
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
        const hero = row.label;
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
    // The host's Approve and Deny for each request.
    row.requests.forEach((request, index) => {
      const top = y + topEnd + pickHeight + index * requestHeight;
      g.lineStyle(1, INK, 0.5).lineBetween(x + pad, top, x + w - pad, top);
      const text = this.#text(x + pad, top + 8, t("room.seat.asks", { name: request.name }), 13, w - pad * 2, {
        bold: true,
      });
      void text;
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
    return height;
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
      const toggleRow = (key: string, title: string, detail: string, on: boolean, change: () => void): void => {
        const btnW = 76;
        const textW = w - btnW - 12;
        const name = this.#text(x, y, title, 14, textW, { bold: true });
        const info = this.#text(x, y + name.height + 2, detail, 12, textW, { alpha: 0.8 });
        const rowH = Math.max(hit.target, name.height + info.height + 4);
        const rect2: Rect = { x: x + w - btnW, y: y + (rowH - hit.target) / 2, width: btnW, height: hit.target };
        if (host) {
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

      // Seats per person, chat.
      y = this.#heading(x, y + 4, w, t("room.multi.title"));
      toggleRow("multi", t("room.multi.title"), t("room.multi.detail"), settings.multiSeat, () =>
        this.#api.setLobby({ settings: { multiSeat: !settings.multiSeat } }),
      );
      toggleRow("chat", t("room.chatSetting.title"), t("room.chatSetting.detail"), settings.chat, () =>
        this.#api.setLobby({ settings: { chat: !settings.chat } }),
      );
      // Chosen when opening the game (#881): may the host take over or hand off a hero when its player leaves?
      toggleRow("handover", t("room.handover.title"), t("room.handover.detail"), settings.handover !== false, () =>
        this.#api.setLobby({ settings: { handover: settings.handover === false } }),
      );
      return y - top;
    });
  }

  // ---- Chat -------------------------------------------------------------------------------------------------------

  #sendChat(): void {
    const input = this.#chatInput;
    const text = input?.value.trim() ?? "";
    // A room that has ended hears nothing: Send is off and Enter does nothing.
    if (!input || text === "" || this.#state.connection === "ended") return;
    this.#api.say(text);
    input.setValue("");
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
        if (event.key === "Enter") this.#sendChat();
      });
    }
    this.#button({
      kind: "primary",
      label: t("room.chat.send"),
      type: typeRole.label,
      rect: sendRect,
      enabled: this.#state.connection !== "ended",
      onClick: () => this.#sendChat(),
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
    const say2 = (text: string, bold = false): void => {
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
      say2(note ?? t("room.start.guestWait"), note !== null);
      return;
    }
    const block = this.#startWords();
    say2(note ?? (block ? wordsText(block) : ""), note !== null);
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
