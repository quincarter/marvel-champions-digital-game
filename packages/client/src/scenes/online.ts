/**
 * Play online (issue #880): "Host a room" or "Join a room" with its 6-character code. Only an entry point: nothing
 * online starts, no worker and no connection, until the player presses Host or Join, and a device with no connection (or a
 * service that is down) says so here, in a line, and leaves everything else in the game alone. The first time, the
 * player is asked for an online name (`scenes/online-name.ts`).
 *
 * Once the room answers, the lobby opens (`scenes/room-lobby.ts`); a room that cannot open is worded here
 * (`view/room-lobby-model.ts`), never on a screen that is already the lobby.
 */
import Phaser from "phaser";
import { t } from "../i18n/translate.js";
import {
  onRoomState,
  onRejoinGame,
  hostRoom,
  joinRoom,
  rejoinRoom,
  roomState,
  leaveRoom,
  onlineName,
} from "../platform/room.js";
import { surface, typeRole, hit } from "../tokens.js";
import type { LiveRoomEntry } from "@mc/sync-worker/room-protocol";
import { pollLiveRooms, type LiveRoomsPoll } from "../platform/live-rooms.js";
import { clearRoomAddress } from "../platform/room-address.js";
import { clearGameAddress, suppressGameAddress } from "../platform/game-address.js";
import { forgetRoom, rememberRoom, recentRooms, roomIsOver } from "../platform/recent-rooms.js";
import { drawArtBackdrop } from "../ui/art-backdrop.js";
import { bangers, campaignFrame, drawTopBar } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { textStyle } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { McButton, McTextInput, fitText } from "../ui/widgets.js";
import type { Rect } from "../view/layout.js";
import {
  LIVE_HEADING_HEIGHT,
  LIVE_ROW_GAP,
  LIVE_ROW_HEIGHT,
  liveRowsOf,
  onlineLayout,
  type LiveRow,
} from "../view/online-model.js";
import { joinTargetFromInput, tidyJoinInput } from "../view/room-join-input.js";
import type { RoomProblem } from "../live/room-state.js";
import type { OptionNoticeData } from "./option-notice.js";
import { problemWords, wordsText } from "../view/room-lobby-model.js";
import { cssOf } from "../ui/theme.js";
import { syncServiceUrl } from "../save-data/transfer-config.js";
import { setGuideRunLevelOverride } from "../guide/guide-store.js";
import { leaveSeatGame } from "../platform/seat-play.js";
import { appSession } from "../session.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { sceneLoader } from "./scene-loader.js";
import type { OnlineNameData } from "./online-name.js";
import type { RejoinData } from "./rejoin.js";
import { resumeLocalSave } from "./resume-save.js";
import { hostGameStep } from "../view/host-game-resume.js";
import { bindTextFieldEscape } from "./text-field-escape.js";

export interface OnlineData {
  /** A room code or id from a `#join=` link: joined as soon as the screen is up (after a name, when none is set). */
  readonly join?: string;
  /** The room code in the address's `?room=` after a reload: rejoined as the host or a guest once the screen is up (after a name, when none is set). */
  readonly rejoin?: string;
  /** A `#join=` link that named no room. */
  readonly invalidLink?: boolean;
  /** Why the room the player was in is gone (the host closed it): shown in a notice over this screen. */
  readonly closedNotice?: RoomProblem;
  /** With `closedNotice`: the saved game this device kept of the room's game (`platform/room-continue.ts`); the notice then offers to continue it in single player. */
  readonly continueGameId?: string;
  /** The Title's "Play online" panel pressed Host (the room starts opening at once, after a name) or Join (the screen opens, where the code is typed). */
  readonly intent?: "host" | "join";
}

const PANEL_PAD = 16;

/** A host game being resumed after a reload: its save id, the screen it opens on once loaded (undefined: still loading, null: could not be resumed), and the room the rejoin named. */
interface HostGameResume {
  readonly gameId: string;
  screen: string | null | undefined;
  hostRoomId: string | null;
}

type Busy = null | "host" | "join";

export class OnlineScene extends Phaser.Scene {
  #data: OnlineData = {};
  #buttons: McButton[] = [];
  #input: McTextInput | null = null;
  #code = "";
  #busy: Busy = null;
  /** The code or id the current join asked for, so a room that is gone can be forgotten. */
  #joining: string | null = null;
  /** A line under the buttons: why the last try did not open a room. */
  #message: string | null = null;
  #route: FocusRoute | null = null;
  #hints!: GlyphHints;
  #alive = false;
  #off: (() => void) | null = null;
  /** The listener for a rejoining host's game in progress, and whether its save is loading. */
  #offGame: (() => void) | null = null;
  #hostGame: HostGameResume | null = null;
  /** Bumped when a rejoin is given up, so a save still loading for it knows it was abandoned. */
  #resumeTicket = 0;
  /** The public "Live now" rooms last fetched (empty when offline or the fetch failed), and the poll that refreshes them. */
  #live: LiveRoomEntry[] = [];
  #stopPoll: LiveRoomsPoll | null = null;

  constructor() {
    super(SCENES.online);
  }

  init(data: OnlineData): void {
    this.#joining = null;
    this.#data = data ?? {};
    this.#busy = null;
    this.#message = this.#data.invalidLink ? t("online.codeInvalid") : null;
    this.#code = "";
  }

  create(): void {
    this.#alive = true;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#hints = new GlyphHints(this);
    this.#route = new FocusRoute(this, {
      blocked: () => (this.#input?.focused ?? false) || this.scene.isActive(SCENES.onlineName),
      onCancel: () => this.#back(),
    });
    bindTextFieldEscape(
      this,
      () => this.#input,
      () => this.scene.isActive(SCENES.onlineName),
    );
    this.scale.on("resize", this.#draw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.#off?.();
      this.#off = null;
      this.#offGame?.();
      this.#offGame = null;
      this.#stopPoll?.stop();
      this.#stopPoll = null;
      this.#hints.dispose();
      this.scale.off("resize", this.#draw, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      this.#input?.destroy();
      this.#input = null;
    });
    this.#draw();
    this.#stopPoll = pollLiveRooms((rooms) => this.#onLive(rooms));
    const onVisible = (): void => this.#stopPoll?.refresh();
    document.addEventListener("visibilitychange", onVisible);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => document.removeEventListener("visibilitychange", onVisible));
    fadeScreenIn(this);
    if (this.#data.rejoin) this.#startRejoin(this.#data.rejoin);
    else if (this.#data.join) this.#startJoin(this.#data.join);
    else if (this.#data.intent === "host") this.#host();
    if (this.#data.closedNotice) this.#showClosedNotice(this.#data.closedNotice, this.#data.continueGameId);
  }

  /** "Room closed": the reason, in the shared notice sheet (OK, Esc and pad B dismiss it). */
  #showClosedNotice(problem: RoomProblem, continueGameId?: string): void {
    const data: OptionNoticeData = {
      notices: [
        {
          title: t("room.closedNotice.title"),
          lead: continueGameId
            ? `${wordsText(problemWords(problem))}\n\n${t("room.closedNotice.continueLead")}`
            : wordsText(problemWords(problem)),
          okLabel: t("room.closedNotice.ok"),
          ...(continueGameId
            ? {
                action: {
                  label: t("room.closedNotice.continue"),
                  run: () => void this.#continueSingle(continueGameId),
                },
              }
            : {}),
          rows: [],
        },
      ],
    };
    const loader = sceneLoader();
    const start = (): void => {
      if (this.#alive) this.scene.launch(SCENES.optionNotice, data);
    };
    if (loader) void loader.load(SCENES.optionNotice).then(start);
    else start();
  }

  /** "Continue in single player": opens the game this device kept of the closed room, as the Title's Continue does. */
  async #continueSingle(gameId: string): Promise<void> {
    if (this.#busy) return;
    const session = appSession();
    // A seat's host may still be on the session (the room ended under the board): the device's own goes back first.
    leaveSeatGame();
    session.guidedRun = false;
    session.guidedRunKind = undefined;
    setGuideRunLevelOverride(null);
    const { store } = session;
    await store.resume(gameId);
    if (!this.#alive) return;
    if (store.state.status === "failed") {
      this.#message = t("room.closedNotice.continueFailed");
      this.#draw();
      return;
    }
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, store.state.game?.step.phase === "setup" ? SCENES.setupDeal : SCENES.board);
  }

  /**
   * A fresh public list: redrawn only when it changed, and never while the code field has focus or a room is being
   * opened (a redraw rebuilds the field); the next refresh picks it up instead.
   */
  #onLive(rooms: LiveRoomEntry[]): void {
    if (!this.#alive || JSON.stringify(rooms) === JSON.stringify(this.#live)) return;
    this.#live = rooms;
    if (this.#busy || this.#input?.focused) return;
    this.#draw();
  }

  #back(): void {
    if (this.#busy) {
      this.#abandonHostGame();
      this.#stopWaiting();
      leaveRoom();
      this.#busy = null;
      this.#draw();
      return;
    }
    this.scale.off("resize", this.#draw, this);
    // Leaving Play online for Title drops a room address that was still waiting for a rejoin (offline, say).
    clearRoomAddress();
    goToScreen(this, SCENES.title);
  }

  /** Needs a name first: asks for one, then runs `then`. */
  #withName(then: () => void): void {
    if (onlineName() !== "") return then();
    this.scene.launch(SCENES.onlineName, {
      onDone: () => {
        if (this.#alive) {
          this.#draw();
          then();
        }
      },
    } satisfies OnlineNameData);
  }

  #offline(): boolean {
    const noNetwork = typeof navigator !== "undefined" && navigator.onLine === false;
    if (noNetwork || !syncServiceUrl()) {
      this.#message = t(noNetwork ? "online.offline" : "room.problem.noService");
      this.#draw();
      return true;
    }
    return false;
  }

  #host(): void {
    if (this.#busy || this.#offline()) return;
    this.#withName(() => {
      this.#busy = "host";
      this.#message = null;
      // Posted first: the call publishes "connecting" at once, so an old room's state can't answer for this one.
      this.#joining = null;
      void hostRoom();
      this.#watchFor();
      this.#draw();
    });
  }

  #join(): void {
    if (this.#busy) return;
    const target = joinTargetFromInput(this.#input?.value ?? this.#code);
    if (!target) {
      this.#message = t("online.codeInvalid");
      this.#draw();
      return;
    }
    this.#startJoin(target);
  }

  /** A reload inside a room: back into it without asking, after a name when none is set. */
  #startRejoin(code: string): void {
    if (this.#offline()) return;
    this.#withName(() => {
      this.#joining = code;
      this.#busy = "join";
      this.#message = null;
      // A host who reloaded mid-game: the worker names the save in progress for this room, and the screen goes straight
      // back to the board with it (which reattaches to the same room) instead of to the lobby.
      this.#offGame?.();
      this.#offGame = onRejoinGame((gameId) => void this.#resumeHostGame(gameId));
      void rejoinRoom(code);
      this.#watchFor();
      this.#draw();
      // "Rejoining room ABC123…", with Cancel, until the room answers (`#stopWaiting` takes it down).
      this.scene.launch(SCENES.rejoin, {
        kind: "room",
        code,
        onCancel: () => {
          this.#abandonHostGame();
          this.#stopWaiting();
          this.#busy = null;
          this.#joining = null;
          this.#draw();
        },
      } satisfies RejoinData);
    });
  }

  /**
   * The host's game in progress, resumed from its local save (no network). The worker names it before the room has
   * answered, so the board waits for two things: the save loaded, and the room confirming this device as the host of the
   * same room (`#settleHostGame`). A host token the room rejects falls back to a guest session, a gone room ends: the
   * loaded game is then put away and the player lands in the guest lobby or on Play online, never on a host board.
   */
  async #resumeHostGame(gameId: string): Promise<void> {
    if (!this.#alive || !this.#busy) return;
    const ticket = ++this.#resumeTicket;
    const pending: HostGameResume = { gameId, screen: undefined, hostRoomId: null };
    this.#hostGame = pending;
    const screen = await resumeLocalSave(gameId);
    // Cancel, Back or the room ending came while the save loaded: the player has left, so the loaded game is put away
    // (not taken to the board, and kept out of the address). The worker already dropped its room records on the leave.
    if (ticket !== this.#resumeTicket || !this.#alive || !this.#busy) {
      this.#putAway(gameId);
      return;
    }
    pending.screen = screen;
    this.#settleHostGame();
  }

  /** The loaded game stays where it is, unattached and out of the address (Title's Continue can still pick it up). */
  #putAway(gameId: string): void {
    suppressGameAddress(gameId);
    clearGameAddress();
  }

  /** Gives up a pending host game (Cancel, Back, the room ending): a save that finished loading is put away. */
  #abandonHostGame(): void {
    this.#resumeTicket++;
    const pending = this.#hostGame;
    this.#hostGame = null;
    if (pending && pending.screen !== undefined) this.#putAway(pending.gameId);
  }

  /**
   * Runs on every room state and when the save finishes loading. The board opens only once this device is the connected
   * host of the room the rejoin named; a guest fallback puts the game away and goes to the guest lobby.
   */
  #settleHostGame(): void {
    const pending = this.#hostGame;
    if (!pending || pending.screen === undefined || !this.#alive || !this.#busy) return;
    const state = roomState();
    const { step, hostRoomId } = hostGameStep(
      { screenLoaded: true, resumed: pending.screen !== null },
      pending.hostRoomId,
      state,
    );
    pending.hostRoomId = hostRoomId;
    if (step.kind === "wait") return;
    this.#hostGame = null;
    if (step.kind === "open") {
      if (state.code) rememberRoom(state.code, "host");
      this.#stopWaiting();
      this.scale.off("resize", this.#draw, this);
      // A save that could not be resumed (no screen): the room itself stands, so the host lands in its lobby.
      goToScreen(this, step.toLobby ? SCENES.roomLobby : (pending.screen ?? SCENES.roomLobby));
      return;
    }
    // The host token was not honoured (or the room changed hands): this device is not the host of that game. The game is
    // put away; a guest session that is still connecting takes the normal path to the lobby once it is up.
    this.#putAway(pending.gameId);
    if (step.toLobby) {
      if (state.code) rememberRoom(state.code, "guest");
      this.#stopWaiting();
      this.scale.off("resize", this.#draw, this);
      goToScreen(this, SCENES.roomLobby);
    }
  }

  #startJoin(target: string): void {
    // No connection (or no service): said here before a name is asked for.
    if (this.#offline()) return;
    this.#withName(() => {
      this.#joining = target;
      this.#busy = "join";
      this.#message = null;
      void joinRoom(target);
      this.#watchFor();
      this.#draw();
    });
  }

  /** Waits for the room to answer: on to the lobby once it is up, else the reason, here. */
  #watchFor(): void {
    this.#stopWaiting();
    this.#off = onRoomState((state) => {
      if (!this.#alive || !this.#busy) return;
      if (this.#hostGame && state.connection !== "connected") this.#settleHostGame();
      if (state.connection === "connected") {
        // A host's game is being resumed: whether it is the board, the lobby or nothing waits on the room's confirmation.
        if (this.#hostGame) {
          this.#settleHostGame();
          return;
        }
        if (state.code && (state.role === "host" || state.role === "guest")) rememberRoom(state.code, state.role);
        this.#stopWaiting();
        this.scale.off("resize", this.#draw, this);
        goToScreen(this, SCENES.roomLobby);
      } else if (state.connection === "ended") {
        this.#abandonHostGame();
        this.#stopWaiting();
        if (this.#joining && roomIsOver(state.problem)) forgetRoom(this.#joining);
        this.#message = wordsText(problemWords(state.problem ?? "unavailable"));
        this.#busy = null;
        leaveRoom();
        this.#draw();
      }
    });
  }

  #stopWaiting(): void {
    this.#off?.();
    this.#off = null;
    // Harmless when the sheet is not up.
    if (this.scene.isActive(SCENES.rejoin)) this.scene.stop(SCENES.rejoin);
  }

  #draw(): void {
    if (!this.#alive) return;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    if (this.#input) this.#code = this.#input.value;
    // The field is a DOM element that keeps its focus and caret across a redraw (a phone's keyboard opening resizes the
    // page, which redraws): lifted out of the sweep and laid out again, never rebuilt, or the keyboard would close at once.
    const kept = this.#input ? this.#input.gameObjects : [];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);
    this.#hints.reset();

    const frame = campaignFrame(this);
    const { width, height, phone, gutter } = frame;
    drawArtBackdrop(this, width, height, () => this.#alive && this.#draw());
    const bar = drawTopBar(this, {
      backLabel: phone ? "◂" : `◂ ${t("online.back")}`,
      onBack: () => this.#back(),
      hints: phone ? null : this.#hints,
      title: t("online.title"),
    });
    if (bar.back) this.#buttons.push(bar.back);
    const stops = new Map<string, FocusStop>();
    const order: string[] = [];
    if (bar.backRect) {
      stops.set("back", { rect: bar.backRect, activate: () => this.#back() });
      order.push("back");
    }

    const layout = onlineLayout(width, height, bar.height, gutter);
    const busy = this.#busy !== null;

    // The controls sit on a panel, so text never reads over the picture.
    const panel = layout.controls;
    this.#panelBox(panel);
    const left = panel.x + PANEL_PAD;
    const column = panel.width - PANEL_PAD * 2;
    let y = panel.y + PANEL_PAD;

    // The name, with a way to change it.
    const name = onlineName();
    const nameLine = this.add
      .text(
        left,
        y + hit.target / 2,
        name ? t("online.playingAs", { name }) : t("online.nameTitle"),
        textStyle(typeRole.rowTitle, surface.ink.hex),
      )
      .setOrigin(0, 0.5);
    const changeRect: Rect = { x: left + column - 130, y, width: 130, height: hit.target };
    fitText(nameLine, column - 140, typeRole.rowTitle.size);
    const change = (): void => {
      this.scene.launch(SCENES.onlineName, { onDone: () => this.#alive && this.#draw() } satisfies OnlineNameData);
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: name ? t("online.change") : t("online.nameSettingNone"),
        type: typeRole.label,
        rect: changeRect,
        enabled: !busy,
        onClick: change,
      }),
    );
    stops.set("name", { rect: changeRect, activate: change });
    order.push("name");
    y += hit.target + 18;

    // Host a room.
    y = this.#paragraph(left, y, column, t("online.hostDetail"));
    const hostRect: Rect = { x: left, y: y + 8, width: column, height: hit.primary };
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: this.#busy === "host" ? t("online.connecting") : t("online.host"),
        type: bangers(22),
        rect: hostRect,
        enabled: !busy,
        onClick: () => this.#host(),
      }),
    );
    stops.set("host", { rect: hostRect, activate: () => this.#host() });
    order.push("host");
    y = hostRect.y + hostRect.height + 24;

    // Join a room.
    y = this.#paragraph(left, y, column, t("online.joinDetail"));
    const joinWidth = 110;
    const fieldRect: Rect = { x: left, y: y + 8, width: column - joinWidth - 10, height: hit.primary };
    if (this.#input) {
      this.#input.layout(fieldRect);
      this.#input.setVisible(true);
      for (const node of this.#input.gameObjects) this.children.bringToTop(node);
    } else {
      this.#input = new McTextInput(this, {
        rect: fieldRect,
        value: this.#code,
        type: typeRole.body,
        placeholder: t("online.codePlaceholder"),
        maxLength: 80,
        onChange: (value) => {
          this.#code = value;
          const tidy = tidyJoinInput(value);
          if (tidy !== value) this.#input?.setValue(tidy);
        },
      });
      // Enter in the code field joins, as the Join button does (bound once: the field outlives redraws).
      (this.#input.gameObject as unknown as { node: HTMLElement }).node.addEventListener("keydown", (event) => {
        if (event.key === "Enter") this.#join();
      });
    }
    const joinRect: Rect = {
      x: fieldRect.x + fieldRect.width + 10,
      y: fieldRect.y,
      width: joinWidth,
      height: hit.primary,
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: this.#busy === "join" ? "…" : t("online.joinGo"),
        type: typeRole.label,
        rect: joinRect,
        enabled: !busy,
        onClick: () => this.#join(),
      }),
    );
    stops.set("code", { rect: fieldRect, activate: () => this.#input?.focus() });
    stops.set("join", { rect: joinRect, activate: () => this.#join() });
    order.push("code", "join");
    y = fieldRect.y + fieldRect.height + 12;

    const message = this.#busy ? t("online.connecting") : this.#message;
    if (message) {
      this.add
        .text(left, y, message, textStyle(typeRole.rowTitle, surface.ink.hex))
        .setWordWrapWidth(column, true)
        .setFontSize(15);
    }

    if (layout.live) this.#drawLive(layout.live, layout.rows, busy, stops, order);
    this.#route?.set(order, stops);
  }

  /** A solid page-coloured box with the design ink border: what text sits on over the backdrop picture. */
  #panelBox(rect: Rect): void {
    this.add.rectangle(rect.x, rect.y, rect.width, rect.height, surface.paper.hex, 0.96).setOrigin(0, 0);
    const g = this.add.graphics();
    g.lineStyle(2, surface.ink.hex, 1);
    g.strokeRect(rect.x, rect.y, rect.width, rect.height);
  }

  /** "Live now": this device recent rooms with Rejoin; a directory feed rows would draw the same way. */
  #drawLive(rect: Rect, capacity: number, busy: boolean, stops: Map<string, FocusStop>, order: string[]): void {
    const rows = liveRowsOf(recentRooms(), this.#live).slice(0, capacity);
    // The panel is as tall as its rows (or its empty note): the picture shows below it on a wide screen.
    const body = rows.length === 0 ? 96 : rows.length * (LIVE_ROW_HEIGHT + LIVE_ROW_GAP) - LIVE_ROW_GAP;
    this.#panelBox({ ...rect, height: Math.min(rect.height, PANEL_PAD * 2 + LIVE_HEADING_HEIGHT - 8 + body) });
    const x = rect.x + PANEL_PAD;
    const width = rect.width - PANEL_PAD * 2;
    this.add
      .text(x, rect.y + PANEL_PAD - 2, t("online.live").toUpperCase(), textStyle(bangers(22), surface.ink.hex))
      .setLetterSpacing(1.5);
    let y = rect.y + PANEL_PAD + LIVE_HEADING_HEIGHT - 8;
    if (rows.length === 0) {
      const title = this.add
        .text(x, y + 6, t("online.liveEmpty"), textStyle(typeRole.rowTitle, surface.ink.hex))
        .setWordWrapWidth(width, true);
      this.#paragraph(x, y + 6 + title.height + 6, width, t("online.liveEmptyBody"));
      return;
    }
    rows.forEach((row, i) => {
      const box: Rect = { x, y, width, height: LIVE_ROW_HEIGHT };
      this.add.rectangle(box.x, box.y, box.width, box.height, surface.paper.hex, 1).setOrigin(0, 0);
      const g = this.add.graphics();
      g.lineStyle(1.5, surface.ink.hex, 0.5);
      g.strokeRect(box.x, box.y, box.width, box.height);
      // The picture slot: a directory row hero art goes here; a room has a plain badge.
      const badge = LIVE_ROW_HEIGHT - 16;
      this.add.rectangle(box.x + 8, box.y + 8, badge, badge, surface.ink.hex).setOrigin(0, 0);
      this.add
        .text(
          box.x + 8 + badge / 2,
          box.y + 8 + badge / 2,
          row.kind === "live" ? ([...(row.host ?? "")][0] ?? "?").toUpperCase() : row.kind === "hosted" ? "H" : "J",
          textStyle(bangers(26), surface.paper.hex),
        )
        .setOrigin(0.5);
      const textX = box.x + badge + 20;
      const buttonRect: Rect = {
        x: box.x + box.width - 108,
        y: box.y + (box.height - hit.target) / 2,
        width: 98,
        height: hit.target,
      };
      const isLive = row.kind === "live";
      const code = this.add
        .text(
          textX,
          box.y + 10,
          isLive ? (row.scenario ?? t("online.livePublic", { host: row.host ?? "" })) : row.title,
          textStyle(bangers(24), surface.ink.hex),
        )
        .setLetterSpacing(isLive ? 0 : 3);
      fitText(code, buttonRect.x - textX - 8, 24);
      const sub = this.add.text(
        textX,
        box.y + 38,
        isLive ? this.#liveDetail(row) : t(row.kind === "hosted" ? "online.liveHosted" : "online.liveJoined"),
        textStyle(typeRole.label, surface.ink.hex, 0.75),
      );
      fitText(sub, buttonRect.x - textX - 8, typeRole.label.size);
      // Watch and Join both open the room's lobby by its code; there a watcher can ask for a seat, so one path serves both.
      const go = (): void => this.#startJoin(row.target);
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: t(
            row.action === "watch"
              ? "online.liveWatch"
              : row.action === "join"
                ? "online.liveJoin"
                : "online.liveRejoin",
          ),
          type: typeRole.label,
          rect: buttonRect,
          enabled: !busy,
          onClick: go,
        }),
      );
      stops.set(`live:${i}`, { rect: buttonRect, activate: go });
      order.push(`live:${i}`);
      y += LIVE_ROW_HEIGHT + LIVE_ROW_GAP;
    });
  }

  /** A public row's second line: the host, how many seats are taken, and whether the game is on. */
  #liveDetail(row: LiveRow): string {
    return [
      row.host ?? "",
      t("online.liveSeats", { taken: row.players ?? 0, total: row.seatsTotal ?? 0 }),
      row.started ? t("online.liveStarted") : "",
    ]
      .filter((part) => part !== "")
      .join(" · ");
  }

  #paragraph(x: number, y: number, width: number, text: string): number {
    const line = this.add
      .text(x, y, text, textStyle(typeRole.body, surface.ink.hex, 0.85))
      .setWordWrapWidth(width, true);
    return y + line.height;
  }
}
