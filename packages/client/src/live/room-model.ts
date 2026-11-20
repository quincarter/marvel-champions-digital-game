/**
 * The lobby as the UI sees it (issue #880): folds a room's messages (`welcome`, `roster`, `lobby`, `table`, `said`,
 * `backlog`, `refused`, `closed`) into one plain `RoomState`. No socket, no timers: the room session feeds it and posts
 * `state()` to the main thread whenever a call says something changed.
 */
import type { Participant, RoomBuild, ServerMessage, TableInfo } from "@mc/sync-worker/room-protocol";
import { FIRST_TABLE } from "@mc/sync-worker/room-protocol";
import {
  MAX_CHAT_KEPT,
  NO_ROOM,
  type RoomChatLine,
  type RoomConnection,
  type RoomParticipant,
  type RoomProblem,
  type RoomRefusal,
  type RoomRole,
  type RoomSeat,
  type RoomState,
} from "./room-state.js";
import type { LobbyState } from "@mc/sync-worker/room-protocol";

/** Refusals that name the seat the player just asked for. */
const SEAT_REFUSALS = new Set(["build-mismatch", "multi-seat", "seat-taken", "no-such-seat", "no-such-participant"]);

const sameBuild = (a: RoomBuild | undefined, b: RoomBuild | undefined): boolean =>
  a !== undefined && b !== undefined && a.appVersion === b.appVersion && a.contentVersion === b.contentVersion;

export interface RoomModelOptions {
  readonly role: Exclude<RoomRole, "none">;
  readonly name: string;
  readonly build: RoomBuild;
  /** The web version's address the join link hangs off. */
  readonly linkBase: string;
  readonly roomId?: string;
  readonly code?: string;
}

export class RoomModel {
  readonly #role: Exclude<RoomRole, "none">;
  readonly #name: string;
  readonly #build: RoomBuild;
  readonly #linkBase: string;
  #roomId: string | null;
  #code: string | null;
  #connection: RoomConnection = "connecting";
  #problem: RoomProblem | null = null;
  #me: { id: string; name: string } | null = null;
  #participants: readonly Participant[] = [];
  #lobby: LobbyState | null = null;
  #chat: RoomChatLine[] = [];
  #refusal: RoomRefusal | null = null;
  #refusalSeq = 0;
  #lastSeat: string | undefined;
  #table: TableInfo | null = null;
  /** The host's own game is streaming (set by the session): `started` before the room's `table` message says so. */
  #hostStarted = false;
  #welcomed = false;
  /** Seats asked for and not yet answered: the room keeps requests in memory only, so they are sent again after a wake. */
  readonly #wanted = new Set<string>();

  constructor(options: RoomModelOptions) {
    this.#role = options.role;
    this.#name = options.name;
    this.#build = options.build;
    this.#linkBase = options.linkBase;
    this.#roomId = options.roomId ?? null;
    this.#code = options.code ?? null;
  }

  get meId(): string | null {
    return this.#me?.id ?? null;
  }

  get roomId(): string | null {
    return this.#roomId;
  }

  get code(): string | null {
    return this.#code;
  }

  /** The room's lobby seats, for the session's token upkeep. */
  get lobby(): LobbyState | null {
    return this.#lobby;
  }

  /** A `welcome` for a watcher that attaches late (the guest's feed): who is here and what the table holds. */
  welcomeFor(): ServerMessage | null {
    const me = this.#participants.find((p) => p.id === this.meId);
    if (!me) return null;
    return {
      v: 1,
      ch: "room",
      kind: "welcome",
      you: me,
      caps: ["watch"],
      participants: this.#participants,
      tables: this.#table ? [this.#table] : [],
    };
  }

  /** What the room reported of the first table, for a publisher that attaches after the welcome. */
  get table(): TableInfo | null {
    return this.#table;
  }

  setRoom(roomId: string, code?: string): void {
    this.#roomId = roomId;
    if (code) this.#code = code;
  }

  /** The seat of the request just sent, so a refusal can name it. */
  noteRequest(seat: string): void {
    this.#lastSeat = seat;
  }

  /** A request was sent (`want`) or given up (`!want`). */
  want(seat: string, want: boolean): void {
    if (want) this.#wanted.add(seat);
    else this.#wanted.delete(seat);
  }

  /**
   * Seats I asked for that the lobby no longer lists as requested or held by me (the room woke and forgot): their
   * requests go out again. Seats I hold or that someone else holds are dropped from the wanted set.
   */
  lostRequests(): string[] {
    const me = this.meId;
    const lost: string[] = [];
    for (const seat of [...this.#wanted]) {
      const s = this.#lobby?.seats.find((x) => x.id === seat);
      if (!s || (me && s.holder !== undefined)) this.#wanted.delete(seat);
      else if (!me || !(s.requested ?? []).includes(me)) lost.push(seat);
    }
    return lost;
  }

  setHostStarted(started: boolean): void {
    this.#hostStarted = started;
  }

  connected(): void {
    this.#connection = "connected";
    this.#problem = null;
  }

  /** The socket dropped (it retries by itself). */
  dropped(): void {
    if (this.#connection === "ended") return;
    this.#connection = this.#welcomed ? "reconnecting" : "connecting";
  }

  /** Nothing more will come: `problem` says why. */
  ended(problem: RoomProblem): void {
    this.#connection = "ended";
    this.#problem = problem;
  }

  /** Applies a room message; false when it changed nothing the UI shows. */
  onMessage(message: ServerMessage): boolean {
    if (message.ch === "chat") {
      if (message.kind === "backlog") {
        this.#chat = message.lines.slice(-MAX_CHAT_KEPT).map((line) => ({ ...line, mine: line.from === this.meId }));
        return true;
      }
      const { v: _v, ch: _ch, kind: _kind, ...line } = message;
      this.#chat = [...this.#chat, { ...line, mine: line.from === this.meId }].slice(-MAX_CHAT_KEPT);
      return true;
    }
    if (message.ch === "game") {
      if (message.kind === "end" && message.table === FIRST_TABLE && this.#table) {
        this.#table = { ...this.#table, ended: true };
        return true;
      }
      return false;
    }
    switch (message.kind) {
      case "welcome":
        this.#welcomed = true;
        this.#me = { id: message.you.id, name: message.you.name ?? this.#name };
        this.#participants = message.participants;
        this.#table = message.tables.find((t) => t.id === FIRST_TABLE) ?? null;
        this.#connection = "connected";
        this.#problem = null;
        return true;
      case "roster":
        this.#participants = message.participants;
        return true;
      case "table":
        if (message.table.id !== FIRST_TABLE) return false;
        this.#table = message.table;
        return true;
      case "seat-denied":
        // The host turned the request down: stop asking (a reconnect would send it again).
        this.#wanted.delete(message.seat);
        return false;
      case "lobby":
        this.#lobby = { code: message.code, settings: message.settings, seats: message.seats };
        this.#code = message.code;
        return true;
      case "refused": {
        const seat = SEAT_REFUSALS.has(message.reason) ? this.#lastSeat : undefined;
        if (seat) this.#wanted.delete(seat);
        this.#refusal = { reason: message.reason, ...(seat ? { seat } : {}), seq: ++this.#refusalSeq };
        return true;
      }
      case "closed":
        this.ended(
          message.reason === "ended" ? "closed-ended" : message.reason === "idle" ? "closed-idle" : "closed-disabled",
        );
        return true;
      default:
        return false;
    }
  }

  state(): RoomState {
    const lobby = this.#lobby;
    const host = this.#participants.find((p) => p.role === "host");
    const hostBuild: RoomBuild | undefined = lobby
      ? { appVersion: lobby.settings.appVersion, contentVersion: lobby.settings.contentVersion }
      : host?.build;
    const buildMatches = (p: Participant): boolean => p.role === "host" || !hostBuild || sameBuild(p.build, hostBuild);
    const meId = this.meId;
    const nameOf = (id: string): string => this.#participants.find((p) => p.id === id)?.name ?? "";
    const seats: RoomSeat[] = (lobby?.seats ?? []).map((seat) => ({
      id: seat.id,
      label: seat.label ?? "",
      holder: seat.holder ?? null,
      holderName: seat.holder ? nameOf(seat.holder) || seat.holderName || null : null,
      mismatch: seat.mismatch === true,
      holderConnected: seat.holder !== undefined && this.#participants.some((p) => p.id === seat.holder),
      mine: meId !== null && seat.holder === meId,
      requests: (seat.requested ?? []).map((id) => ({ participant: id, name: nameOf(id) })),
      requestedByMe: meId !== null && (seat.requested ?? []).includes(meId),
    }));
    const participants: RoomParticipant[] = [...this.#participants]
      .sort((a, b) => Number(b.role === "host") - Number(a.role === "host"))
      .map((p) => ({
        id: p.id,
        name: p.name ?? "",
        role: p.role === "host" ? "host" : "watcher",
        me: p.id === meId,
        buildMatches: buildMatches(p),
        ...(p.device ? { device: p.device } : {}),
        seats: seats.filter((s) => s.holder === p.id).map((s) => s.id),
      }));
    const me = this.#participants.find((p) => p.id === meId);
    const code = this.#code;
    const joinTarget = code ?? this.#roomId;
    return {
      ...NO_ROOM,
      role: this.#role,
      connection: this.#connection,
      problem: this.#problem,
      roomId: this.#roomId,
      code,
      link: joinTarget ? `${this.#linkBase}#join=${joinTarget}` : null,
      me: this.#me,
      participants,
      settings: lobby?.settings ?? null,
      seats,
      mySeats: seats.filter((s) => s.mine).map((s) => s.id),
      chat: this.#chat,
      refusal: this.#refusal,
      buildMatches: me ? buildMatches(me) : sameBuild(this.#build, hostBuild) || !hostBuild,
      started: this.#hostStarted || (this.#table?.hasHeader ?? false),
      gameOver: this.#table?.ended ?? false,
    };
  }
}
