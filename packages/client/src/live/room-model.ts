/**
 * The lobby as the UI sees it (issue #880): folds a room's messages (`welcome`, `roster`, `lobby`, `table`, `said`,
 * `backlog`, `refused`, `closed`) into one plain `RoomState`. No socket, no timers: the room session feeds it and posts
 * `state()` to the main thread whenever a call says something changed.
 */
import type { Participant, RoomBuild, ServerMessage, TableInfo } from "@mc/sync-worker/room-protocol";
import { FIRST_TABLE } from "@mc/sync-worker/room-protocol";
import { compareVersions } from "../engine/app-version.js";
import {
  MAX_CHAT_KEPT,
  NO_ROOM,
  playerIdOfSeat,
  type RoomAsk,
  type BuildGap,
  type RoomChatLine,
  type RoomHostActivity,
  type RoomVillainCursor,
  type TablePlan,
  type RoomDeckProblem,
  type RoomConnection,
  type RoomParticipant,
  type RoomProblem,
  type RoomRefusal,
  type RoomRequest,
  type RoomRole,
  type RoomSeat,
  type RoomState,
} from "./room-state.js";
import type { LobbyState } from "@mc/sync-worker/room-protocol";
import { epicStateOf, hostedTableOf } from "./epic-view.js";
import { readPodState, type PodStateWire } from "./pod-wire.js";

/** Refusals that name the seat the player just asked for. */
const SEAT_REFUSALS = new Set(["build-mismatch", "multi-seat", "seat-taken", "no-such-seat", "no-such-participant"]);

/**
 * The same build: equal versions, and equal rules fingerprints when both sides have one (an older client sends none,
 * then only the versions count). Mirrors the room's `sameBuild`, which is the authority.
 */
export const sameBuild = (a: RoomBuild | undefined, b: RoomBuild | undefined): boolean =>
  a !== undefined &&
  b !== undefined &&
  a.appVersion === b.appVersion &&
  a.contentVersion === b.contentVersion &&
  (!a.rules || !b.rules || a.rules === b.rules);

/** How `mine` differs from the host's build, for the words that say who should update; null when they match. */
export function buildGapOf(mine: RoomBuild | undefined, host: RoomBuild | undefined): BuildGap | null {
  if (!mine || !host || sameBuild(mine, host)) return null;
  // A build read off an older room's settings may lack a version: it cannot be ordered.
  const order =
    typeof mine.appVersion === "string" && typeof host.appVersion === "string"
      ? compareVersions(mine.appVersion, host.appVersion)
      : null;
  if (order === -1) return "hostNewer";
  if (order === 1) return "hostOlder";
  // Versions that cannot be ordered (a dev build) but differ are just different; "same version" needs them equal.
  return mine.appVersion === host.appVersion ? "rules" : "other";
}

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
  #chatLive = 0;
  #hostActivity: RoomHostActivity | null = null;
  #villainCursor: RoomVillainCursor | null = null;
  #tablePlan: TablePlan | null = null;
  #refusal: RoomRefusal | null = null;
  #refusalSeq = 0;
  #lastSeat: string | undefined;
  /** The table this device follows as its game (its own in an Epic room, else the first): `#table` is its info. */
  #view = FIRST_TABLE;
  #table: TableInfo | null = null;
  /** Every table the room reported, for an Epic room's tables list. */
  readonly #tableInfos = new Map<string, TableInfo>();
  /** Epic rooms: watchers per table (`roster.watching`), the organizer's last `pod:state`, and what this device follows. */
  #watching: Readonly<Record<string, number>> = {};
  #podState: PodStateWire | null = null;
  #follow: "all" | readonly string[] = "all";
  /** The table host's wait for the pod coordinator is not clearing (`EpicState.podStuck`). */
  #podStuck = false;
  /** The host's own game is streaming (set by the session): `started` before the room's `table` message says so. */
  #hostStarted = false;
  #welcomed = false;
  /** Seats asked for and not yet answered: the room keeps requests in memory only, so they are sent again after a wake. */
  readonly #wanted = new Set<string>();
  /** Host: requests from seat holders awaiting its answer (memory only, as the room's own are). */
  #requests: RoomRequest[] = [];
  #requestSeq = 0;
  /** Guest: my last request to the host and its answer. */
  #ask: RoomAsk | null = null;
  #askSeq = 0;
  /**
   * The host's engine refused my deck in a seat at Start. Kept with what the seat looked like then (its deck and the
   * lobby's mods), so it disappears once either changes: the verdict may be different now.
   */
  readonly #deckProblems = new Map<string, RoomDeckProblem & { readonly key: string }>();

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

  /** The table I run (the organizer's own, or a table host's), or null; in a standard room the host's is the first. */
  get hostedTable(): string | null {
    return hostedTableOf(this.#participants.find((p) => p.id === this.meId));
  }

  /** I am a host of some table: the room has made me one. */
  get isHost(): boolean {
    return this.#participants.find((p) => p.id === this.meId)?.role === "host";
  }

  /** The table whose game this device follows as a player or watcher. */
  get view(): string {
    return this.#view;
  }

  /** Follows `table` as this device's game (its own table in an Epic room). */
  setView(table: string): void {
    if (table !== this.#view) this.#villainCursor = null;
    this.#view = table;
    this.#table = this.#tableInfos.get(table) ?? null;
  }

  /** The room's info for any table (the hosted table's, for a host's publisher). */
  tableInfo(table: string): TableInfo | null {
    return this.#tableInfos.get(table) ?? null;
  }

  /** Epic rooms: what this device asked to follow (`follow`); the state shows it. */
  setFollow(follow: "all" | readonly string[]): void {
    this.#follow = follow;
  }

  setPodStuck(stuck: boolean): void {
    this.#podStuck = stuck;
  }

  get follow(): "all" | readonly string[] {
    return this.#follow;
  }

  /** Epic rooms: the organizer's shared state, as broadcast (or as its own coordinator made it). */
  setPodState(state: PodStateWire): void {
    this.#podState = state;
  }

  /** The engine players behind these seat ids (a seat without one yet is left out). */
  playersOfSeats(seatIds: readonly string[]): string[] {
    const out: string[] = [];
    for (const id of seatIds) {
      const player = this.#lobby?.seats.find((s) => s.id === id)?.player;
      if (player !== undefined) out.push(playerIdOfSeat(player));
    }
    return out;
  }

  /** Guest: a request to the host went out; its answer fills the status in. */
  noteAsk(what: "undo" | "adjust"): number {
    const seq = ++this.#askSeq;
    this.#ask = { what, status: "waiting", seq };
    return seq;
  }

  /** Guest: forgets the last request's answer (the player has read it). */
  clearAsk(): void {
    this.#ask = null;
  }

  /** Removes and returns a pending request (the host answered it), or undefined when it is gone. */
  takeRequest(id: string): RoomRequest | undefined {
    const found = this.#requests.find((r) => r.id === id);
    if (found) this.#requests = this.#requests.filter((r) => r !== found);
    return found;
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

  /** Every table the room knows has ended its game (an Epic game is over: the lobby can start another). */
  get allTablesEnded(): boolean {
    return this.#tableInfos.size > 0 && [...this.#tableInfos.values()].every((t) => t.ended);
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

  /** I chose a deck again (or gave the seat up): whatever the host said about the old one no longer applies. */
  clearDeckProblem(seat: string): void {
    this.#deckProblems.delete(seat);
  }

  /** What a seat's deck problem is keyed by: its summary and the lobby's allowed mods. */
  #deckKey(seat: string): string {
    const found = this.#lobby?.seats.find((s) => s.id === seat);
    return JSON.stringify([found?.deck ?? null, this.#lobby?.settings.mods ?? []]);
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
    // The room resends the host's step to a rejoining socket; an old one must not outlive the connection.
    this.#hostActivity = null;
    // The room resends the host's cursor to a rejoining guest; an old one must not outlive the connection.
    this.#villainCursor = null;
    // The room forgets the plan too when it is evicted: the host sends it again once it is back.
    this.#tablePlan = null;
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
      this.#chatLive += 1;
      return true;
    }
    if (message.ch === "game") {
      if (
        message.kind === "request" &&
        (this.#role === "host" || this.isHost) &&
        message.table === (this.hostedTable ?? FIRST_TABLE)
      ) {
        // One pending request of a kind per asker: asking again replaces the note rather than piling up.
        const kept = this.#requests.filter((r) => !(r.from === message.from && r.what === message.what));
        const name = this.#participants.find((p) => p.id === message.from)?.name ?? "";
        this.#requests = [
          ...kept,
          {
            id: `r${++this.#requestSeq}`,
            from: message.from,
            name,
            what: message.what,
            note: message.note,
            ...(message.rid === undefined ? {} : { rid: message.rid }),
          },
        ];
        return true;
      }
      if (message.kind === "request-answer" && message.table === this.#view) {
        if (this.#ask?.status !== "waiting") return false;
        // An answer to an earlier ask (I have asked again since) is not an answer to this one.
        if (message.rid !== undefined && message.rid !== this.#ask.seq) return false;
        this.#ask = { ...this.#ask, status: message.accepted ? "accepted" : "declined" };
        return true;
      }
      if (message.kind === "end") {
        const info = this.#tableInfos.get(message.table);
        if (!info) return false;
        this.#tableInfos.set(message.table, { ...info, ended: true });
        if (message.table === this.#view) this.#table = this.#tableInfos.get(message.table) ?? null;
        return true;
      }
      return false;
    }
    if (message.ch === "pod") {
      if (message.kind !== "state") return false;
      const state = readPodState(message.state);
      if (!state) return false;
      this.#podState = state;
      return true;
    }
    switch (message.kind) {
      case "welcome":
        this.#requests = [];
        this.#welcomed = true;
        this.#me = { id: message.you.id, name: message.you.name ?? this.#name };
        this.#participants = message.participants;
        this.#tableInfos.clear();
        for (const info of message.tables) this.#tableInfos.set(info.id, info);
        this.#table = this.#tableInfos.get(this.#view) ?? null;
        this.#connection = "connected";
        this.#problem = null;
        return true;
      case "roster":
        this.#participants = message.participants;
        this.#watching = message.watching ?? {};
        // An asker who left cannot be answered (the room refuses a `to` that is not connected).
        this.#requests = this.#requests.filter((r) => message.participants.some((p) => p.id === r.from));
        return true;
      case "table":
        this.#tableInfos.set(message.table.id, message.table);
        if (message.table.id !== this.#view) return this.#lobby?.settings.mode === "epic";
        this.#table = message.table;
        return true;
      case "deck-refused":
        this.#deckProblems.set(message.seat, {
          code: message.code,
          reason: message.reason,
          key: this.#deckKey(message.seat),
        });
        return true;
      case "seat-denied":
        // The host turned the request down: stop asking (a reconnect would send it again).
        this.#wanted.delete(message.seat);
        return false;
      case "host-activity":
        this.#hostActivity =
          message.step === "idle"
            ? null
            : { step: message.step, ...(message.scenario ? { scenario: message.scenario } : {}) };
        return true;
      case "villain-cursor":
        // The host of a table leads that table: a guest follows the cursor of the table it is viewing (an Epic room's
        // other tables keep their own cursors).
        if (message.table !== this.#view) return false;
        this.#villainCursor =
          message.state === "none" ? null : { key: message.key, at: message.at, state: message.state };
        return true;
      case "table-plan":
        this.#tablePlan = message.plan;
        return true;
      case "lobby":
        this.#lobby = {
          code: message.code,
          rev: message.rev,
          settings: message.settings,
          seats: message.seats,
          ...(message.tables ? { tables: message.tables } : {}),
          ...(message.pods ? { pods: message.pods } : {}),
        };
        this.#code = message.code;
        return true;
      case "refused": {
        const seat = SEAT_REFUSALS.has(message.reason) ? this.#lastSeat : undefined;
        if (seat) this.#wanted.delete(seat);
        // A turned-down request (a Strict room, no seat) is no longer waiting: the refusal says why.
        const mine = message.rid === undefined || message.rid === this.#ask?.seq;
        if (
          mine &&
          this.#ask?.status === "waiting" &&
          (message.reason === "strict" || message.reason === "not-seated")
        ) {
          this.#ask = null;
        }
        this.#refusal = { reason: message.reason, ...(seat ? { seat } : {}), seq: ++this.#refusalSeq };
        return true;
      }
      case "closed":
        this.ended(
          message.reason === "ended"
            ? "closed-ended"
            : message.reason === "idle"
              ? "closed-idle"
              : message.reason === "host"
                ? "closed-host"
                : "closed-disabled",
        );
        return true;
      default:
        return false;
    }
  }

  #deckProblemOf(seat: string, mine: boolean): RoomDeckProblem | null {
    const problem = this.#deckProblems.get(seat);
    if (!mine || !problem || problem.key !== this.#deckKey(seat)) return null;
    return { code: problem.code, reason: problem.reason };
  }

  state(): RoomState {
    const lobby = this.#lobby;
    const host = this.#participants.find((p) => p.role === "host");
    const hostBuild: RoomBuild | undefined = lobby
      ? {
          appVersion: lobby.settings.appVersion,
          contentVersion: lobby.settings.contentVersion,
          ...(lobby.settings.rules ? { rules: lobby.settings.rules } : {}),
        }
      : host?.build;
    const buildMatches = (p: Participant): boolean => p.role === "host" || !hostBuild || sameBuild(p.build, hostBuild);
    const gapOf = (build: RoomBuild | undefined, matches: boolean): { buildGap?: BuildGap } => {
      const gap = matches ? null : buildGapOf(build, hostBuild);
      return gap ? { buildGap: gap } : {};
    };
    const meId = this.meId;
    const nameOf = (id: string): string => this.#participants.find((p) => p.id === id)?.name ?? "";
    const seats: RoomSeat[] = (lobby?.seats ?? []).map((seat) => ({
      id: seat.id,
      label: seat.label ?? "",
      deck: seat.deck ?? null,
      deckProblem: this.#deckProblemOf(seat.id, meId !== null && seat.holder === meId),
      holder: seat.holder ?? null,
      holderName: seat.holder ? nameOf(seat.holder) || seat.holderName || null : null,
      mismatch: seat.mismatch === true,
      holderConnected: seat.holder !== undefined && this.#participants.some((p) => p.id === seat.holder),
      mine: meId !== null && seat.holder === meId,
      player: seat.player === undefined ? null : playerIdOfSeat(seat.player),
      takenOver: seat.takenOver === true,
      ...(seat.showsHand === true ? { showsHand: true } : {}),
      // Away: the holder is not connected, or (handover off) left the seat mid-game and has not taken it up again.
      away: seat.holder !== undefined && (seat.left === true || !this.#participants.some((p) => p.id === seat.holder)),
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
        ...gapOf(p.build, p.role === "host" || buildMatches(p)),
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
      rev: lobby?.rev ?? 0,
      seats,
      mySeats: seats.filter((s) => s.mine).map((s) => s.id),
      chat: this.#chat,
      chatLive: this.#chatLive,
      hostActivity: this.#hostActivity,
      villainCursor: this.#villainCursor,
      tablePlan: this.#tablePlan,
      refusal: this.#refusal,
      requests: this.#role === "host" || this.isHost ? this.#requests : [],
      myRequest: this.#role === "guest" && !this.isHost ? this.#ask : null,
      buildMatches: me ? buildMatches(me) : sameBuild(this.#build, hostBuild) || !hostBuild,
      ...(me ? gapOf(me.build, me.role === "host" || buildMatches(me)) : gapOf(this.#build, false)),
      started: this.#hostStarted || (this.#table?.hasHeader ?? false),
      gameOver: this.#table?.ended ?? false,
      mode: lobby?.settings.mode ?? "standard",
      epic: epicStateOf({
        lobby,
        participants: this.#participants,
        meId,
        tableInfos: this.#tableInfos,
        watching: this.#watching,
        podState: this.#podState,
        follow: this.#follow,
        podStuck: this.#podStuck,
        mySeats: seats.filter((s) => s.mine).map((s) => s.id),
      }),
    };
  }
}
