/**
 * The live game room's logic (docs/live-game-rooms.md), over a small socket interface so Vitest drives it without
 * workerd. The room orders and relays and never reads a game: headers, commands and outcomes are opaque.
 *
 * Storage. A hibernated room is evicted from memory after seconds of quiet, so the log is persisted in frozen chunks:
 * `meta` (host token hash, createdAt, a last-host stamp written at most hourly, and the end/outcome once), one
 * `<table>:header` row at `start`/`log`, and one `<table>:c:<n>` row per completed chunk of `ROOM_CHUNK_COMMANDS`
 * commands with the checksums that fall in it, written once when the chunk fills and never rewritten. The unfinished
 * tail of up to a chunk lives in memory, and is written to one `<table>:tail` row when the host disconnects (so a host
 * who closes the app mid-game leaves watchers the whole log; also written on the first batch of a table and then at
 * most once a minute while it streams), overwritten each time and dropped when a frozen chunk
 * supersedes it, a rewind cuts it or a `log` replaces the table; a woken room loads the chunks and asks the host for the tail with
 * `resend { from }`. About one row per 20 commands.
 *
 * A lobby room (created with a code, docs/live-game-rooms.md section 8) adds one `lobby` row: the host's settings, the
 * seats (holders, requests) and the seat-token hashes, rewritten only when the host, a requester or a seat changes, never
 * for a chat line (chat lives in memory: a 50-line backlog and per-participant rate buckets).
 *
 * A socket's participant lives in the socket's own attachment, so it survives hibernation; the logic keys everything
 * by participant id and takes the newest socket object it is handed for that id.
 */

import type { KeyValueStorage } from "./env.js";
import { REPLAY_ID_ALPHABET } from "./replay-protocol.js";
import {
  CHAT_BACKLOG_LINES,
  LOBBY_MESSAGE_BURST,
  ROOM_CODE_MARGIN_MS,
  CHAT_BURST,
  MAX_REQUEST_NOTE_CHARS,
  PROPOSAL_BURST,
  PROPOSAL_PER_SECOND,
  DEFAULT_MAX_ROOM_LOG_BYTES,
  DEFAULT_MAX_ROOM_MESSAGE_BYTES,
  DEFAULT_MAX_ROOM_PARTICIPANTS,
  DECK_MESSAGE_BURST,
  DECK_REFILL_SECONDS,
  FIRST_TABLE,
  LOG_PART_BYTES,
  MAX_CHAT_LENGTH,
  MAX_LOG_BYTES,
  MAX_DECK_REFUSAL_CHARS,
  MAX_NAME_LENGTH,
  MAX_ROOM_REFUSALS,
  MAX_SEAT_DECK_BYTES,
  ROOM_CHUNK_COMMANDS,
  ROOM_END_GRACE_MS,
  ROOM_IDLE_MS,
  cleanDevice,
  parseClientMessage,
  type ChatLine,
  type ClientMessage,
  type LobbySeat,
  type LobbySeatSpec,
  type RoomDeck,
  type RoomDeckSummary,
  type LobbySettings,
  lobbyUndoFor,
  type LobbyState,
  type Participant,
  type RefusalReason,
  type RoomBuild,
  type RoomCapability,
  type ServerMessage,
  type TableChecksums,
  type TableInfo,
} from "./room-protocol.js";

/** A connection as the logic sees it; the Durable Object adapts a real WebSocket to this. */
export interface RoomSocket {
  send(text: string): void;
  close(code?: number, reason?: string): void;
  /** The participant saved on the socket by `setParticipant`, or null before its `hello` (or after `clearParticipant`). */
  getParticipant(): Participant | null;
  setParticipant(participant: Participant): void;
  /** Forgets the participant on the socket, so a wake does not bring a replaced host back. */
  clearParticipant(): void;
}

export interface GameRoomLimits {
  readonly maxParticipants: number;
  readonly maxMessageBytes: number;
  readonly maxLogBytes: number;
}

export const DEFAULT_GAME_ROOM_LIMITS: GameRoomLimits = {
  maxParticipants: DEFAULT_MAX_ROOM_PARTICIPANTS,
  maxMessageBytes: DEFAULT_MAX_ROOM_MESSAGE_BYTES,
  maxLogBytes: DEFAULT_MAX_ROOM_LOG_BYTES,
};

/** What a watch room advertises. */
export const ROOM_CAPS: readonly RoomCapability[] = ["watch"];
/** What a lobby room advertises; `tables` is not built. */
export const LOBBY_ROOM_CAPS: readonly RoomCapability[] = ["watch", "chat", "seats", "play"];

/** The room's calls to its code's directory entry (`RoomCode`), made when it moves its expiry or closes. */
export interface RoomCodeHooks {
  refresh(code: string, roomId: string, expiresAt: number): Promise<void>;
  release(code: string, roomId: string): Promise<void>;
}

/** A new lobby's settings: Strict, no house rules, no mods, one seat each, chat on. The versions are the host's. */
export const DEFAULT_LOBBY_SETTINGS: LobbySettings = {
  playMode: "strict",
  undo: "off",
  cheats: false,
  tableRules: {},
  mods: [],
  multiSeat: false,
  handover: true,
  chat: true,
  contentVersion: "",
  appVersion: "",
};

/** While the host streams, the tail row is refreshed when it was last written this long ago. */
const TAIL_REFRESH_MS = 60 * 1000;

/** The host's last-message stamp is stored at most this often. */
const STAMP_EVERY_MS = 60 * 60 * 1000;

interface RoomMeta {
  readonly hostTokenHash: string;
  readonly createdAt: number;
  /** Lobby rooms only: the 6-character code that opens the room, and the room's id (for the code's directory entry). */
  readonly code?: string;
  readonly roomId?: string;
  lastHostAt?: number;
  ended?: boolean;
  outcome?: unknown;
  endedAt?: number;
  /** The table reached the log cap and was ended by the room. */
  overflow?: boolean;
}

/** A seat as stored: the public `LobbySeat` plus the hash of the token that restores it. */
interface StoredSeat extends LobbySeatSpec {
  holder?: string;
  holderName?: string;
  tokenHash?: string;
  takenOver?: boolean;
  left?: boolean;
  /** The seat's full deck list: only ever sent to the host (`seat-decks`), never in the lobby broadcast. */
  deck?: RoomDeck;
  /** The host chose `deck`: it stays through a change of holder. */
  deckPreset?: true;
  /** A host preset the holder replaced with their own deck: it comes back when they give the seat up. */
  presetDeck?: RoomDeck;
}

/** Whole-room cap on accepted deck changes (each rewrites the lobby row): a burst of this many, then one every 2 s. */
const ROOM_DECK_BURST = 20;
const ROOM_DECK_REFILL_SECONDS = 2;
const DECK_BYTES = new TextEncoder();

/** What the lobby shows of a deck: everything but the card list. */
function summarize(deck: RoomDeck, preset: boolean): RoomDeckSummary {
  return {
    hero: deck.hero,
    heroName: deck.heroName,
    aspects: [...deck.aspects],
    name: deck.name,
    cards: deck.cards.reduce((n, line) => n + line.quantity, 0),
    mods: deck.mods.map((m) => ({ id: m.id, version: m.version })),
    ...(preset ? { preset: true as const } : {}),
  };
}

interface LobbyRow {
  settings: LobbySettings;
  seats: StoredSeat[];
}

interface StoredChunk {
  commands: unknown[];
  checksums: Record<string, string>;
  bytes: number;
}

interface Table {
  id: string;
  header: unknown;
  hasHeader: boolean;
  commands: unknown[];
  checksums: Record<string, string>;
  /** Chunks written to storage: commands `[0, persisted * ROOM_CHUNK_COMMANDS)` are stored, the rest is the tail. */
  persisted: number;
  /** JSON bytes of the commands held. */
  bytes: number;
  ended: boolean;
  outcome: unknown;
  overflow: boolean;
  loaded: boolean;
  /** A `<table>:tail` row exists in storage. */
  tailStored: boolean;
  /** When the tail row was last written (or this lifetime first saw the table), for the 60 s refresh while streaming. */
  tailAt: number | undefined;
  /**
   * Loaded from storage in this lifetime: the room does not know how far its watchers got (their last commands may have
   * been in the lost tail), so the host's first accepted batch is preceded by a `rewind` to what the room holds.
   */
  rewindWatchers: boolean;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const encoder = new TextEncoder();

const sizeOf = (value: unknown): number => JSON.stringify(value)?.length ?? 0;
const sizeOfAll = (values: readonly unknown[]): number => {
  let total = 0;
  for (const v of values) total += sizeOf(v);
  return total;
};

const newTable = (id: string): Table => ({
  id,
  header: undefined,
  hasHeader: false,
  commands: [],
  checksums: {},
  persisted: 0,
  bytes: 0,
  ended: false,
  outcome: null,
  overflow: false,
  loaded: false,
  tailStored: false,
  tailAt: undefined,
  rewindWatchers: false,
});

const randomId = (): string =>
  [...crypto.getRandomValues(new Uint8Array(5))].map((b) => b.toString(16).padStart(2, "0")).join("");

const headerKey = (table: string) => `${table}:header`;
const chunkKey = (table: string, n: number) => `${table}:c:${String(n).padStart(6, "0")}`;
const tailKey = (table: string) => `${table}:tail`;

/** The checksums of a message as a plain record, or null when a key is not a command count or a value not a string. */
function cleanChecksums(value: unknown): Record<string, string> | null {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [key, sum] of Object.entries(value)) {
    if (!/^\d{1,9}$/.test(key) || typeof sum !== "string" || sum.length > 128) return null;
    out[key] = sum;
  }
  return out;
}

type Refusal = RefusalReason;

/** Refusals that count toward closing a noisy socket after `MAX_ROOM_REFUSALS`. */
const HARD_REFUSALS: ReadonlySet<Refusal> = new Set(["bad-message", "too-large", "not-allowed"]);
/** The lobby's soft refusals (a taken seat, chat too fast) close the socket only in a flood: this many in the window. */
const SOFT_REFUSAL_LIMIT = 50;
const SOFT_REFUSAL_WINDOW_MS = 10_000;

/** A new seat token: 32 characters of the URL-safe alphabet (64 symbols divide 256), 192 random bits. */
function newSeatToken(): string {
  let token = "";
  for (const byte of crypto.getRandomValues(new Uint8Array(32))) token += REPLAY_ID_ALPHABET[byte & 63];
  return token;
}

/** A name or chat text with control characters (newlines included) turned into spaces and the ends trimmed. */
const cleanText = (text: string): string =>
  text
    .normalize("NFC")
    // Format characters (zero-width, bidi overrides and isolates) vanish; controls and line separators become spaces.
    .replace(/\p{Cf}/gu, "")
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, " ")
    .trim();

/** The first `max` code points, so an emoji is never cut in half. */
const clip = (text: string, max: number): string => {
  const points = [...text];
  return points.length <= max ? text : points.slice(0, max).join("");
};

/** Whether a cleaned name has something to see: not only spaces and marks. */
const hasVisible = (text: string): boolean => /[\p{L}\p{N}\p{P}\p{S}]/u.test(text);

/** A deck rebuilt from the fields the room knows, with its text cleaned: nothing else a client sent is kept. */
function cleanDeck(deck: RoomDeck): RoomDeck | null {
  const text = (value: string, max: number): string => clip(cleanText(value).replace(/\s+/g, " "), max).trim();
  const name = text(deck.name, 80);
  const heroName = text(deck.heroName, 80);
  const hero = text(deck.hero, 64);
  if (hero.length === 0 || name.length === 0 || heroName.length === 0) return null;
  return {
    name,
    hero,
    heroName,
    aspects: deck.aspects.map((a) => text(a, 24)),
    cards: deck.cards.map((c) => ({ cardId: text(c.cardId, 64), quantity: c.quantity })),
    mods: deck.mods.map((m) => ({ id: text(m.id, 64), version: text(m.version, 32) })),
    ...(deck.deckId ? { deckId: text(deck.deckId, 64) } : {}),
  };
}

/** A token bucket in a map: true when one token was taken. Memory only. */
function takeToken(
  buckets: Map<string, { tokens: number; at: number }>,
  id: string,
  burst: number,
  perSecond: number,
  now: number,
): boolean {
  const bucket = buckets.get(id) ?? { tokens: burst, at: now };
  bucket.tokens = Math.min(burst, bucket.tokens + ((now - bucket.at) / 1000) * perSecond);
  bucket.at = now;
  buckets.set(id, bucket);
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

export class GameRoomLogic {
  private meta: RoomMeta | null | undefined;
  private readonly sockets = new Map<string, RoomSocket>();
  private readonly participants = new Map<string, Participant>();
  private readonly tables = new Map<string, Table>([[FIRST_TABLE, newTable(FIRST_TABLE)]]);
  private readonly loading = new Map<string, Promise<void>>();
  /** Tables whose host has been asked for a log that has not come yet, so one gap is asked once. */
  private readonly resendAsked = new Set<string>();
  /** True until the host's `start`, `log` or an in-order batch confirms the room's tail in this lifetime. */
  private unverified = true;
  private lastHostMessageAt: number | undefined;
  private readonly refusals = new WeakMap<RoomSocket, number>();
  private readonly softRefusals = new WeakMap<RoomSocket, { n: number; since: number }>();
  /** Pending seat requests by seat id. Memory only, so asking and withdrawing never write a row. */
  private readonly requests = new Map<string, string[]>();
  /** Proposal rate: a bucket per participant (burst `PROPOSAL_BURST`, `PROPOSAL_PER_SECOND` a second). Memory only. */
  private readonly proposalBuckets = new Map<string, { tokens: number; at: number }>();
  /**
   * Set when sockets were restored after a hibernation: the pending requests above were lost while the sockets stayed
   * open, so the first message handled sends everyone a fresh lobby and the clients ask again (they do on every lobby).
   */
  private woke = false;
  /** Lobby message rate: a bucket per participant (burst `LOBBY_MESSAGE_BURST`, 2 a second). Memory only. */
  private readonly lobbyBuckets = new Map<string, { tokens: number; at: number }>();
  /** `seat-deck` rate per participant, and for the whole room (every accepted deck rewrites the lobby row). Memory only. */
  private readonly deckBuckets = new Map<string, { tokens: number; at: number }>();
  private readonly roomDeckBucket = new Map<string, { tokens: number; at: number }>();
  /** The lobby row, loaded on first use; null for a room without a code. */
  private lobby: LobbyRow | null | undefined;
  /** The last chat lines, oldest first. Memory only: a woken room starts with none. */
  private backlog: ChatLine[] = [];
  /** Chat rate: a token bucket per participant (1 a second, burst `CHAT_BURST`). Memory only. */
  private readonly chatBuckets = new Map<string, { tokens: number; at: number }>();

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly limits: GameRoomLimits = DEFAULT_GAME_ROOM_LIMITS,
    private readonly clock: () => number = () => Date.now(),
    private readonly codeHooks?: RoomCodeHooks,
  ) {}

  // ----------------------------------------------------------------------------------------------------------
  // Lifecycle and storage

  private async loadMeta(): Promise<RoomMeta | null> {
    if (this.meta === undefined) this.meta = (await this.storage.get<RoomMeta>("meta")) ?? null;
    return this.meta;
  }

  private async saveMeta(patch: Partial<RoomMeta>): Promise<void> {
    if (!this.meta) return;
    this.meta = { ...this.meta, ...patch };
    await this.storage.put("meta", this.meta);
  }

  /** The lobby row (defaults until the host changes something), or null for a room without a code. */
  private async loadLobby(): Promise<LobbyRow | null> {
    if (this.lobby !== undefined) return this.lobby;
    const meta = await this.loadMeta();
    if (!meta?.code) return (this.lobby = null);
    const stored = await this.storage.get<LobbyRow>("lobby");
    // Another message may have loaded it while this one waited.
    this.lobby ??= stored ?? { settings: { ...DEFAULT_LOBBY_SETTINGS }, seats: [] };
    // A lobby stored before the undo setting has none: it reads as its mode's default.
    this.lobby.settings = {
      ...this.lobby.settings,
      undo: lobbyUndoFor(this.lobby.settings.playMode, this.lobby.settings.undo),
    };
    return this.lobby;
  }

  private async saveLobby(): Promise<void> {
    if (this.lobby) await this.storage.put("lobby", this.lobby);
  }

  private lobbyState(lobby: LobbyRow): LobbyState {
    const seats: LobbySeat[] = lobby.seats.map(({ tokenHash: _hash, deck, deckPreset, presetDeck: _held, ...seat }) => {
      const requested = this.requests.get(seat.id);
      const holder = seat.holder ? this.participants.get(seat.holder) : undefined;
      const mismatch = holder !== undefined && holder.role !== "host" && !this.sameBuild(holder.build, lobby.settings);
      return {
        ...seat,
        ...(requested && requested.length > 0 ? { requested: [...requested] } : {}),
        ...(mismatch ? { mismatch: true } : {}),
        ...(deck ? { deck: summarize(deck, deckPreset === true) } : {}),
      };
    });
    // A lobby stored before `handover` existed has none: handing over is allowed, as it always was.
    return {
      code: this.meta?.code ?? "",
      settings: { ...lobby.settings, handover: lobby.settings.handover !== false },
      seats,
    };
  }

  private broadcastLobby(lobby: LobbyRow): void {
    this.broadcast({ v: 1, ch: "room", kind: "lobby", ...this.lobbyState(lobby) });
  }

  async exists(): Promise<boolean> {
    return (await this.loadMeta()) !== null;
  }

  /**
   * Makes the room: false when it already exists (the caller draws another id). One row, plus the idle alarm. A lobby
   * room also takes its `code` and its own id (the lobby row is written lazily, when the host first changes something).
   */
  async create(hostTokenHash: string, now: number, lobby?: { code: string; roomId: string }): Promise<boolean> {
    if (await this.loadMeta()) return false;
    const meta: RoomMeta = {
      hostTokenHash,
      createdAt: now,
      ...(lobby ? { code: lobby.code, roomId: lobby.roomId } : {}),
    };
    await this.storage.put("meta", meta);
    this.meta = meta;
    this.lastHostMessageAt = now;
    await this.storage.setAlarm(now + ROOM_IDLE_MS);
    return true;
  }

  /** Re-registers a socket that outlived the object's memory (hibernation) from its saved participant. */
  restore(socket: RoomSocket): void {
    const participant = socket.getParticipant();
    if (!participant) return;
    this.sockets.set(participant.id, socket);
    this.participants.set(participant.id, participant);
    this.woke = true;
  }

  /** Loads a table's header and stored chunks once per lifetime. */
  private ensureLoaded(table: Table): Promise<void> {
    if (table.loaded) return Promise.resolve();
    let pending = this.loading.get(table.id);
    if (!pending) {
      pending = this.load(table).finally(() => this.loading.delete(table.id));
      this.loading.set(table.id, pending);
    }
    return pending;
  }

  private async load(table: Table): Promise<void> {
    const meta = await this.loadMeta();
    const header = await this.storage.get<{ h: unknown }>(headerKey(table.id));
    if (header) {
      const rows = await this.storage.list<StoredChunk>({ prefix: `${table.id}:c:` });
      const commands: unknown[] = [];
      const checksums: Record<string, string> = {};
      let bytes = 0;
      let persisted = 0;
      for (const chunk of rows.values()) {
        commands.push(...chunk.commands);
        Object.assign(checksums, chunk.checksums);
        bytes += chunk.bytes;
        persisted += 1;
      }
      table.header = header.h;
      table.hasHeader = true;
      table.commands = commands;
      table.checksums = checksums;
      table.bytes = bytes;
      table.persisted = persisted;
      const tail = await this.storage.get<{ commands: unknown[]; checksums: Record<string, string>; at?: number }>(
        tailKey(table.id),
      );
      table.tailAt = tail?.at;
      table.rewindWatchers = true;
      if (tail) {
        table.commands = [...table.commands, ...tail.commands];
        table.checksums = { ...table.checksums, ...tail.checksums };
        table.bytes += sizeOfAll(tail.commands);
        table.tailStored = true;
      }
    }
    table.ended = meta?.ended ?? false;
    table.outcome = meta?.outcome ?? null;
    table.overflow = meta?.overflow ?? false;
    table.loaded = true;
  }

  private async deleteChunks(tableId: string, from: number, to: number): Promise<void> {
    const keys: string[] = [];
    for (let n = from; n < to; n++) keys.push(chunkKey(tableId, n));
    for (let i = 0; i < keys.length; i += 128) await this.storage.delete(keys.slice(i, i + 128));
  }

  /** Deletes the stored tail row, if there is one. */
  private async dropTail(table: Table): Promise<void> {
    if (!table.tailStored) return;
    table.tailStored = false;
    await this.storage.delete(tailKey(table.id));
  }

  /** Writes the unfinished tail (commands past the last frozen chunk, with their checksums), overwriting the last. */
  private async writeTail(table: Table): Promise<void> {
    const first = table.persisted * ROOM_CHUNK_COMMANDS;
    if (!table.loaded || !table.hasHeader) return;
    if (table.commands.length <= first) return this.dropTail(table);
    await this.storage.put(tailKey(table.id), {
      commands: table.commands.slice(first),
      checksums: this.checksumsIn(table, first, table.commands.length),
      at: this.clock(),
    });
    table.tailStored = true;
    table.tailAt = this.clock();
  }

  /** Writes every chunk that has filled since the last write, each once. */
  private async persistChunks(table: Table): Promise<void> {
    let entries: Record<string, StoredChunk> = {};
    let count = 0;
    while (table.commands.length >= (table.persisted + 1) * ROOM_CHUNK_COMMANDS) {
      const n = table.persisted;
      const first = n * ROOM_CHUNK_COMMANDS;
      const commands = table.commands.slice(first, first + ROOM_CHUNK_COMMANDS);
      const checksums: Record<string, string> = {};
      for (const [key, sum] of Object.entries(table.checksums)) {
        const at = Number(key);
        if ((first === 0 ? at >= 0 : at > first) && at <= first + ROOM_CHUNK_COMMANDS) checksums[key] = sum;
      }
      entries[chunkKey(table.id, n)] = { commands, checksums, bytes: sizeOfAll(commands) };
      table.persisted += 1;
      count += 1;
      if (count === 100) {
        await this.storage.put(entries);
        entries = {};
        count = 0;
      }
    }
    if (count > 0) {
      await this.storage.put(entries);
      await this.dropTail(table);
    }
  }

  private tableOf(id: string): Table | undefined {
    return this.tables.get(id);
  }

  private hostOf(tableId: string): Participant | undefined {
    for (const p of this.participants.values()) if (p.role === "host" && p.table === tableId) return p;
    return undefined;
  }

  private info(table: Table): TableInfo {
    return {
      id: table.id,
      hostConnected: this.hostOf(table.id) !== undefined,
      commands: table.commands.length,
      ended: table.ended,
      hasHeader: table.hasHeader,
      checkpoint: this.checkpointOf(table),
    };
  }

  /** The latest stored checksum at or below the command count, so a resuming host can prove its log is this one. */
  private checkpointOf(table: Table): { count: number; sum: string } | null {
    let best = -1;
    for (const key of Object.keys(table.checksums)) {
      const at = Number(key);
      if (at <= table.commands.length && at > best) best = at;
    }
    return best < 0 ? null : { count: best, sum: table.checksums[String(best)]! };
  }

  private rosterList(): Participant[] {
    return [...this.participants.values()];
  }

  // ----------------------------------------------------------------------------------------------------------
  // Sending

  private sendTo(id: string, message: ServerMessage): void {
    const socket = this.sockets.get(id);
    if (socket) this.sendSocket(socket, message);
  }

  private sendSocket(socket: RoomSocket, message: ServerMessage): void {
    try {
      socket.send(JSON.stringify(message));
    } catch {
      // A socket that cannot take a message is closing; its close event removes it.
    }
  }

  private broadcast(message: ServerMessage, except?: string): void {
    const text = JSON.stringify(message);
    for (const [id, socket] of this.sockets) {
      if (id === except) continue;
      try {
        socket.send(text);
      } catch {
        // As above.
      }
    }
  }

  private broadcastRoster(): void {
    const participants = this.rosterList();
    const holders = new Set<string>();
    for (const seat of this.lobby?.seats ?? []) if (seat.holder) holders.add(seat.holder);
    this.broadcast({
      v: 1,
      ch: "room",
      kind: "roster",
      participants,
      // A seat holder plays; only the others watch (read from the lobby in memory: before it loads, all count).
      watchers: participants.filter((p) => p.role === "watcher" && !holders.has(p.id)).length,
    });
  }

  private broadcastTable(table: Table): void {
    this.broadcast({ v: 1, ch: "room", kind: "table", table: this.info(table) });
  }

  private checksumsIn(table: Table, after: number, upTo: number): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, sum] of Object.entries(table.checksums)) {
      const at = Number(key);
      // A range starting at 0 includes the baseline checksum keyed "0"; later ranges start after their boundary.
      if ((after <= 0 ? at >= 0 : at > after) && at <= upTo) out[key] = sum;
    }
    return out;
  }

  /**
   * The table's log to one socket in parts: a `log` with the header and the first commands up to about
   * `LOG_PART_BYTES`, `commands` batches for the rest, then `end` if the table ended. No part nears the WebSocket cap.
   */
  private sendLog(socket: RoomSocket, table: Table): void {
    const commands = table.commands;
    let used = sizeOf(table.header);
    let index = 0;
    let first = true;
    do {
      const from = index;
      const part: unknown[] = [];
      while (index < commands.length) {
        const size = sizeOf(commands[index]);
        if (part.length > 0 && used + size > LOG_PART_BYTES) break;
        part.push(commands[index]);
        used += size;
        index += 1;
      }
      const checksums = this.checksumsIn(table, from, index);
      if (first) {
        this.sendSocket(socket, {
          v: 1,
          ch: "game",
          kind: "log",
          table: table.id,
          header: table.header,
          commands: part,
          checksums,
        });
        first = false;
      } else {
        this.sendSocket(socket, {
          v: 1,
          ch: "game",
          kind: "commands",
          table: table.id,
          from,
          commands: part,
          ...(Object.keys(checksums).length > 0 ? { checksums } : {}),
        });
      }
      used = 0;
    } while (index < commands.length);
    if (table.ended)
      this.sendSocket(socket, { v: 1, ch: "game", kind: "end", table: table.id, outcome: table.outcome });
  }

  /** The log to everyone but the table's host. */
  private broadcastLog(table: Table, hostId: string): void {
    for (const [id, socket] of this.sockets) if (id !== hostId) this.sendLog(socket, table);
  }

  /** Asks the table's host for what the room lacks from `from`, once per gap. */
  private askResend(tableId: string, from: number): void {
    const host = this.hostOf(tableId);
    if (!host || this.resendAsked.has(tableId)) return;
    this.resendAsked.add(tableId);
    this.sendTo(host.id, { v: 1, ch: "game", kind: "resend", table: tableId, from });
  }

  // ----------------------------------------------------------------------------------------------------------
  // Incoming

  /** One text frame from a socket. Never throws on a bad frame; it answers `refused`. */
  async message(socket: RoomSocket, data: string | ArrayBuffer): Promise<void> {
    if (typeof data !== "string") return this.refuse(socket, "bad-message");
    const participant = socket.getParticipant();
    const bytes = encoder.encode(data).byteLength;
    if (bytes > MAX_LOG_BYTES) return this.refuse(socket, "too-large");
    // Only a host may send a start or log, so everyone else is held to the ordinary cap before anything is parsed.
    if (participant?.role !== "host" && bytes > this.limits.maxMessageBytes) return this.refuse(socket, "too-large");
    const message = parseClientMessage(data);
    if (!message) return this.refuse(socket, "bad-message");

    if (message.ch === "room" && message.kind === "hello") return this.hello(socket, message);
    if (!participant) return this.refuse(socket, "bad-message");
    if (!this.participants.has(participant.id)) {
      // An attachment the room does not know (a replaced host's socket still closing): not part of this room.
      this.refuse(socket, "not-allowed");
      socket.close(1008, "not in the room");
      return;
    }
    this.sockets.set(participant.id, socket);
    if (this.woke) {
      this.woke = false;
      const lobby = await this.loadLobby();
      if (lobby) this.broadcastLobby(lobby);
    }

    if (message.ch === "room" && message.kind === "room-close") {
      if (participant.role !== "host") return this.refuse(socket, "not-allowed");
      return this.shutdown("host");
    }
    if (message.ch === "chat") return this.say(socket, participant, message.text);
    if (message.ch === "room") return this.lobbyMessage(socket, participant, message);
    if (message.kind === "propose" || message.kind === "request") return this.fromSeat(socket, participant, message);
    if (
      message.kind === "proposal-refused" ||
      message.kind === "proposal-accepted" ||
      message.kind === "request-answer"
    ) {
      return this.answerSeat(socket, participant, message);
    }
    const table = this.tableOf(message.table);
    if (participant.role !== "host" || participant.table !== message.table || !table) {
      return this.refuse(socket, "not-allowed");
    }
    const isLog = message.kind === "start" || message.kind === "log";
    if (bytes > this.limits.maxMessageBytes && !isLog) return this.refuse(socket, "too-large");
    await this.ensureLoaded(table);
    await this.touchHost();
    await this.game(socket, participant, table, message);
  }

  private refuse(
    socket: RoomSocket,
    reason: Refusal,
    ask: { pid?: number | undefined; rid?: number | undefined } = {},
  ): void {
    this.sendSocket(socket, {
      v: 1,
      ch: "room",
      kind: "refused",
      reason,
      ...(ask.pid === undefined ? {} : { pid: ask.pid }),
      ...(ask.rid === undefined ? {} : { rid: ask.rid }),
    });
    if (!HARD_REFUSALS.has(reason)) {
      const now = this.clock();
      const seen = this.softRefusals.get(socket);
      const window = seen && now - seen.since < SOFT_REFUSAL_WINDOW_MS ? seen : { n: 0, since: now };
      window.n += 1;
      this.softRefusals.set(socket, window);
      if (window.n >= SOFT_REFUSAL_LIMIT) {
        try {
          socket.close(1008, "too many refusals");
        } catch {
          // Already gone.
        }
      }
      return;
    }
    const count = (this.refusals.get(socket) ?? 0) + 1;
    this.refusals.set(socket, count);
    if (count >= MAX_ROOM_REFUSALS) {
      try {
        socket.close(1008, "too many refusals");
      } catch {
        // Already gone.
      }
    }
  }

  /** Notes a host message; the stamp is stored at most once an hour, so a command writes nothing. */
  private async touchHost(): Promise<void> {
    const now = this.clock();
    this.lastHostMessageAt = now;
    const meta = this.meta;
    if (meta && now - (meta.lastHostAt ?? meta.createdAt) >= STAMP_EVERY_MS) await this.saveMeta({ lastHostAt: now });
  }

  private async hello(socket: RoomSocket, message: Extract<ClientMessage, { kind: "hello" }>): Promise<void> {
    if (socket.getParticipant()) return this.refuse(socket, "bad-message");
    const meta = await this.loadMeta();
    if (!meta) return socket.close(1011, "no such room");
    const isHost = message.token !== undefined && (await sha256Hex(message.token)) === meta.hostTokenHash;
    // A lobby room needs a name from everyone; any other room ignores `hello.name`, as watching always did.
    const lobbyRoom = meta.code !== undefined;
    const name = lobbyRoom ? clip(cleanText(message.name ?? "").replace(/\s+/g, " "), MAX_NAME_LENGTH).trim() : "";
    if (lobbyRoom && !hasVisible(name)) {
      this.refuse(socket, "name-required");
      socket.close(1008, "name required");
      return;
    }
    const device = cleanDevice(message.device);
    const seatHashes = lobbyRoom ? await Promise.all((message.seatTokens ?? []).map(sha256Hex)) : [];
    const table = this.tables.get(FIRST_TABLE)!;
    await this.ensureLoaded(table);

    // A valid host token is always let in, whatever the room holds, and takes the old host socket's place.
    if (isHost) {
      const old = this.hostOf(FIRST_TABLE);
      if (old) {
        const oldSocket = this.sockets.get(old.id);
        this.participants.delete(old.id);
        this.sockets.delete(old.id);
        try {
          oldSocket?.clearParticipant();
          oldSocket?.close(4000, "replaced");
        } catch {
          // Already gone.
        }
        await this.writeTail(table);
      }
    } else if (this.participants.size >= this.limits.maxParticipants) {
      this.refuse(socket, "full");
      socket.close(1013, "full");
      return;
    }

    const you: Participant = {
      id: randomId(),
      role: isHost ? "host" : "watcher",
      ...(isHost ? { table: FIRST_TABLE } : {}),
      ...(lobbyRoom ? { name, ...(message.build ? { build: message.build } : {}) } : {}),
      ...(device ? { device } : {}),
    };
    socket.setParticipant(you);
    this.sockets.set(you.id, socket);
    this.participants.set(you.id, you);

    this.sendSocket(socket, {
      v: 1,
      ch: "room",
      kind: "welcome",
      you,
      caps: lobbyRoom ? LOBBY_ROOM_CAPS : ROOM_CAPS,
      participants: this.rosterList(),
      tables: [...this.tables.values()].map((t) => this.info(t)),
    });
    if (lobbyRoom) await this.loadLobby(); // So the roster's watcher count can leave out seat holders.
    this.broadcastRoster();
    if (lobbyRoom) await this.joinLobby(socket, you, seatHashes);
    if (isHost) {
      await this.touchHost();
      this.resendAsked.delete(FIRST_TABLE);
      this.broadcastTable(table);
    } else if (table.hasHeader) {
      this.sendLog(socket, table);
    }
    // The host's welcome already says what the room holds, so it is not asked here. A watcher joining while the host
    // is connected and the room's tail is unconfirmed (it woke, or is new) makes the room ask the host for what it lacks.
    if (!isHost && this.unverified) this.askResend(FIRST_TABLE, table.hasHeader ? table.commands.length : 0);
  }

  private async game(
    socket: RoomSocket,
    host: Participant,
    table: Table,
    message: Exclude<
      ClientMessage,
      | { ch: "room" }
      | { ch: "chat" }
      | { kind: "propose" | "proposal-refused" | "proposal-accepted" | "request" | "request-answer" }
    >,
  ): Promise<void> {
    switch (message.kind) {
      case "start": {
        // A lobby room hosts one game after another (a rematch): `start` on an ended table reopens it first. Any other
        // room's ended table stays ended.
        if (table.ended) {
          if (this.meta?.code === undefined) return this.refuse(socket, "not-allowed");
          await this.reopen(table);
        }
        await this.dropTail(table);
        await this.deleteChunks(table.id, 0, table.persisted);
        await this.storage.put(headerKey(table.id), { h: message.header });
        Object.assign(table, newTable(table.id), { header: message.header, hasHeader: true, loaded: true });
        this.unverified = false;
        this.resendAsked.delete(table.id);
        this.broadcastLog(table, host.id);
        this.broadcastTable(table);
        return;
      }
      case "log": {
        const checksums = cleanChecksums(message.checksums);
        if (!checksums) return this.refuse(socket, "bad-message");
        if (table.overflow) return this.refuse(socket, "too-large");
        const bytes = sizeOfAll(message.commands);
        if (bytes > this.limits.maxLogBytes) {
          this.refuse(socket, "too-large");
          await this.endTable(table, null, true);
          return;
        }
        await this.dropTail(table);
        await this.deleteChunks(table.id, 0, table.persisted);
        table.header = message.header;
        table.hasHeader = true;
        table.commands = [...message.commands];
        table.checksums = { ...checksums };
        table.persisted = 0;
        table.bytes = bytes;
        await this.storage.put(headerKey(table.id), { h: message.header });
        await this.persistChunks(table);
        this.unverified = false;
        this.resendAsked.delete(table.id);
        this.broadcastLog(table, host.id);
        this.broadcastTable(table);
        return;
      }
      case "commands": {
        const checksums = cleanChecksums(message.checksums);
        if (!checksums) return this.refuse(socket, "bad-message");
        if (table.overflow) return this.refuse(socket, "too-large");
        if (!table.hasHeader || message.from !== table.commands.length) {
          this.refuse(socket, "out-of-order");
          this.askResend(table.id, table.hasHeader ? table.commands.length : 0);
          return;
        }
        const added = sizeOfAll(message.commands);
        if (table.bytes + added > this.limits.maxLogBytes) {
          this.refuse(socket, "too-large");
          await this.endTable(table, null, true);
          return;
        }
        table.commands.push(...message.commands);
        table.checksums = { ...table.checksums, ...checksums };
        table.bytes += added;
        if (table.rewindWatchers) {
          // Watchers may hold commands the room lost with its tail: cut them back to what the room held, then the
          // host's batch re-appends from there.
          table.rewindWatchers = false;
          this.broadcast({ v: 1, ch: "game", kind: "rewind", table: table.id, to: message.from }, host.id);
        }
        await this.persistChunks(table);
        // A host that closes the app may never return to write the tail: refresh it while it streams, at most once a
        // minute, so an evicted room still has the commands past the last chunk.
        // The first batch of a table (or of a woken room with no stored tail) writes it at once, so a quiet host that
        // then hibernates and closes never leaves watchers an empty log; after that at most once a minute.
        if (table.tailAt === undefined || this.clock() - table.tailAt >= TAIL_REFRESH_MS) await this.writeTail(table);
        this.unverified = false;
        this.resendAsked.delete(table.id);
        this.broadcast(
          {
            v: 1,
            ch: "game",
            kind: "commands",
            table: table.id,
            from: message.from,
            commands: message.commands,
            ...(Object.keys(checksums).length > 0 ? { checksums } : {}),
          },
          host.id,
        );
        this.broadcastTable(table);
        return;
      }
      case "rewind": {
        if (!table.hasHeader || message.to > table.commands.length) {
          this.refuse(socket, "out-of-order");
          this.askResend(table.id, table.hasHeader ? table.commands.length : 0);
          return;
        }
        const cut = message.to < table.commands.length;
        const keep = Math.floor(message.to / ROOM_CHUNK_COMMANDS);
        if (cut) await this.dropTail(table);
        if (keep < table.persisted) {
          await this.deleteChunks(table.id, keep, table.persisted);
          table.persisted = keep;
        }
        table.commands.length = message.to;
        for (const key of Object.keys(table.checksums)) if (Number(key) > message.to) delete table.checksums[key];
        table.bytes = sizeOfAll(table.commands);
        // What remains of the cut chunk is the new tail: store it, or an evicted room would serve only the frozen chunks.
        if (cut) await this.writeTail(table);
        // An Undo past the end reopens the game: the end alarm is cancelled and the idle one re-armed.
        // A rewind to the current count reopens too: a resumed host whose game is not over says so that way.
        if (table.ended) await this.reopen(table);
        this.broadcast({ v: 1, ch: "game", kind: "rewind", table: table.id, to: message.to }, host.id);
        this.broadcastTable(table);
        return;
      }
      case "end": {
        await this.endTable(table, message.outcome ?? null, false);
        return;
      }
    }
  }

  private async reopen(table: Table): Promise<void> {
    table.ended = false;
    table.outcome = null;
    table.overflow = false;
    if (this.meta) {
      const { endedAt: _endedAt, ...rest } = this.meta;
      this.meta = { ...rest, ended: false, outcome: null, overflow: false };
      await this.storage.put("meta", this.meta);
      const last = Math.max(this.lastHostMessageAt ?? 0, this.meta.lastHostAt ?? this.meta.createdAt);
      await this.storage.setAlarm(last + ROOM_IDLE_MS);
    }
  }

  /** Ends a table once: a second `end` writes and changes nothing. */
  private async endTable(table: Table, outcome: unknown, overflow: boolean): Promise<void> {
    if (table.ended) return;
    table.ended = true;
    table.outcome = outcome;
    if (overflow) table.overflow = true;
    this.broadcast({ v: 1, ch: "game", kind: "end", table: table.id, outcome });
    this.broadcastTable(table);
    const now = this.clock();
    // The game is over and the host may never come back: store the tail with the end.
    await this.writeTail(table);
    await this.saveMeta({ ended: true, outcome, endedAt: now, ...(overflow ? { overflow: true } : {}) });
    if ([...this.tables.values()].every((t) => t.ended)) await this.storage.setAlarm(now + ROOM_END_GRACE_MS);
  }

  // ----------------------------------------------------------------------------------------------------------
  // Lobby: settings, seats and chat (docs/live-game-rooms.md section 8)

  private sameBuild(build: RoomBuild | undefined, settings: LobbySettings): boolean {
    // A host that sent no build leaves the versions empty, which nobody matches: seats stay closed.
    return (
      build !== undefined &&
      settings.appVersion !== "" &&
      build.appVersion === settings.appVersion &&
      build.contentVersion === settings.contentVersion
    );
  }

  private dropRequest(seatId: string, id: string): boolean {
    const list = this.requests.get(seatId);
    if (!list?.includes(id)) return false;
    const rest = list.filter((r) => r !== id);
    if (rest.length > 0) this.requests.set(seatId, rest);
    else this.requests.delete(seatId);
    return true;
  }

  private seatsHeldBy(lobby: LobbyRow, id: string): number {
    return lobby.seats.filter((seat) => seat.holder === id).length;
  }

  /**
   * Gives the seat to the participant: a new token (only its hash is stored) goes to that participant alone. The caller
   * has checked everything; this changes memory only, so the caller saves and broadcasts.
   */
  private async grant(seat: StoredSeat, who: Participant): Promise<void> {
    const token = newSeatToken();
    // A change of holder clears the previous holder's own deck; the host's preset stays.
    if (seat.holder !== who.id && !seat.deckPreset) delete seat.deck;
    // Holder first: the hash below is an await, and a second message must already see the seat taken.
    seat.holder = who.id;
    seat.holderName = who.name ?? "";
    delete seat.takenOver;
    this.dropRequest(seat.id, who.id);
    seat.tokenHash = await sha256Hex(token);
    this.sendTo(who.id, { v: 1, ch: "room", kind: "seat-token", seat: seat.id, token });
  }

  /**
   * A participant has joined a lobby room: stamps the host's build into the settings, puts the participant back in the
   * seats its tokens open, then sends the lobby (everyone when it changed, else just the joiner) and the chat backlog.
   */
  private async joinLobby(socket: RoomSocket, you: Participant, seatHashes: readonly string[]): Promise<void> {
    const lobby = await this.loadLobby();
    if (!lobby) return;
    let changed = false;
    if (you.role === "host" && you.build) {
      const { appVersion, contentVersion } = you.build;
      if (lobby.settings.appVersion !== appVersion || lobby.settings.contentVersion !== contentVersion) {
        lobby.settings = { ...lobby.settings, appVersion, contentVersion };
        changed = true;
      }
    }
    for (const seat of lobby.seats) {
      if (!seat.tokenHash || !seatHashes.includes(seat.tokenHash)) continue;
      // The token is the credential, but not a way round the multi-seat rule: an extra seat stays with its old holder.
      // A build that is not the host's keeps the seat held and shows as `mismatch` in the lobby (derived, not stored).
      if (!lobby.settings.multiSeat && this.seatsHeldBy(lobby, you.id) > 0) {
        this.refuse(socket, "multi-seat");
        continue;
      }
      seat.holder = you.id;
      seat.holderName = you.name ?? "";
      delete seat.left;
      changed = true;
    }
    if (changed) {
      await this.saveLobby();
      this.broadcastRoster();
      this.broadcastLobby(lobby);
    } else {
      this.sendSocket(socket, { v: 1, ch: "room", kind: "lobby", ...this.lobbyState(lobby) });
    }
    if (lobby.settings.chat && this.backlog.length > 0) {
      this.sendSocket(socket, { v: 1, ch: "chat", kind: "backlog", lines: [...this.backlog] });
    }
  }

  /** A participant left: whatever seats it asked for are no longer asked for. Its held seats stay, for a token rejoin. */
  private async withdrawRequests(id: string): Promise<void> {
    const lobby = await this.loadLobby();
    if (!lobby) return;
    let changed = false;
    for (const seat of lobby.seats) if (this.dropRequest(seat.id, id)) changed = true;
    // Requests live in memory: nothing to store.
    if (changed) this.broadcastLobby(lobby);
  }

  private async lobbyMessage(
    socket: RoomSocket,
    who: Participant,
    message: Exclude<Extract<ClientMessage, { ch: "room" }>, { kind: "hello" | "room-close" }>,
  ): Promise<void> {
    const lobby = await this.loadLobby();
    if (!lobby) return this.refuse(socket, "not-allowed");
    const isHost = who.role === "host";
    // A host's lobby edits count as host activity, like a game message does.
    if (isHost) await this.touchHost();
    // A participant's lobby messages are rate limited, so a loop of requests cannot flood the room.
    if (!takeToken(this.lobbyBuckets, who.id, LOBBY_MESSAGE_BURST, 2, this.clock())) {
      return this.refuse(socket, "rate-limited");
    }
    const { settings } = lobby;
    const seatOf = (id: string) => lobby.seats.find((seat) => seat.id === id);
    const free = (seat: StoredSeat) => {
      delete seat.holder;
      delete seat.holderName;
      delete seat.tokenHash;
      delete seat.takenOver;
      delete seat.left;
      // The holder's own deck goes with them (the next holder brings theirs); the host's preset stays, and one the
      // holder had replaced comes back. During a live game the hero is fixed (the frozen seat-to-player mapping), so the
      // deck summary stays: a vacant seat still names its hero, and whoever takes it plays that hero.
      if (!seat.deckPreset && !gameLive()) {
        delete seat.deck;
        if (seat.presetDeck) {
          seat.deck = seat.presetDeck;
          seat.deckPreset = true;
        }
        delete seat.presetDeck;
      }
    };
    const handover = settings.handover !== false;
    const gameLive = (): boolean => {
      const t = this.tables.get(FIRST_TABLE);
      return t !== undefined && t.hasHeader && !t.ended;
    };
    // Only a change of holder, or the host setting the lobby, is stored. A request or its withdrawal is memory only.
    let persist = false;

    switch (message.kind) {
      case "lobby-set": {
        if (!isHost) return this.refuse(socket, "not-allowed");
        // Cheats are fixed once the game has started: the table's header is the room's sign of that.
        if (message.settings?.cheats !== undefined && message.settings.cheats !== settings.cheats) {
          const table = this.tableOf(FIRST_TABLE);
          if (table) await this.ensureLoaded(table);
          if (table?.hasHeader) return this.refuse(socket, "not-allowed");
        }
        const playMode = message.settings?.playMode ?? settings.playMode;
        // Switching to Host control without naming one starts at Ask; Strict forces Off, whatever was sent.
        const undoChoice = message.settings?.undo ?? (playMode !== settings.playMode ? undefined : settings.undo);
        const next: LobbySettings = {
          ...settings,
          playMode,
          undo: lobbyUndoFor(playMode, undoChoice),
          cheats: message.settings?.cheats ?? settings.cheats === true,
          ...(message.settings?.playMode !== undefined ? { playMode: message.settings.playMode } : {}),
          ...(message.settings?.tableRules !== undefined ? { tableRules: message.settings.tableRules } : {}),
          ...(message.settings?.mods !== undefined ? { mods: message.settings.mods.map((m) => ({ ...m })) } : {}),
          ...(message.settings?.multiSeat !== undefined ? { multiSeat: message.settings.multiSeat } : {}),
          ...(message.settings?.handover !== undefined ? { handover: message.settings.handover } : {}),
          ...(message.settings?.chat !== undefined ? { chat: message.settings.chat } : {}),
        };
        let seats = lobby.seats;
        if (message.seats) {
          const ids = new Set(message.seats.map((s) => s.id));
          if (ids.size !== message.seats.length) return this.refuse(socket, "bad-message");
          // Once a game is running, the seat-to-player mapping is the host engine's: only labels may change here.
          // A seat added, removed, reordered or given another player would let a guest be judged against a hero
          // the engine does not map to that seat. An omitted player keeps the seat's own.
          const table = this.tableOf(FIRST_TABLE);
          if (table) await this.ensureLoaded(table);
          const activeGame = table !== undefined && table.hasHeader && !table.ended;
          if (activeGame) {
            const same =
              message.seats.length === lobby.seats.length &&
              message.seats.every((spec, i) => {
                const kept = lobby.seats[i]!;
                return spec.id === kept.id && (spec.player === undefined || spec.player === kept.player);
              });
            if (!same) return this.refuse(socket, "not-allowed");
          }
          // A seat id that stays keeps its holder, requests and token; its label may change; a removed one is gone.
          seats = message.seats.map((spec) => {
            const kept = lobby.seats.find((s) => s.id === spec.id);
            const label = spec.label === undefined ? {} : { label: spec.label };
            const player = spec.player === undefined ? {} : { player: spec.player };
            if (!kept) return { id: spec.id, ...label, ...player };
            const { label: _old, player: _oldPlayer, ...rest } = kept;
            // In a running game the seat keeps its player whatever was sent (checked equal or omitted above).
            const keep = activeGame && kept.player !== undefined ? { player: kept.player } : player;
            return { ...rest, ...label, ...keep };
          });
        }
        if (!next.multiSeat) {
          // Turning multi-seat off cannot quietly take a seat from someone who holds two.
          const counts = new Map<string, number>();
          for (const seat of seats) if (seat.holder) counts.set(seat.holder, (counts.get(seat.holder) ?? 0) + 1);
          if ([...counts.values()].some((n) => n > 1)) return this.refuse(socket, "multi-seat");
        }
        lobby.settings = next;
        lobby.seats = seats;
        for (const id of [...this.requests.keys()]) if (!seats.some((seat) => seat.id === id)) this.requests.delete(id);
        persist = true;
        break;
      }
      case "seat-request": {
        const seat = seatOf(message.seat);
        if (!seat) return this.refuse(socket, "no-such-seat");
        if (!isHost && !this.sameBuild(who.build, settings)) return this.refuse(socket, "build-mismatch");
        if (seat.holder === who.id) {
          // Already theirs; a seat they left mid-game (handover off) is theirs to take again.
          if (!seat.left) return;
          delete seat.left;
          persist = true;
          break;
        }
        if (seat.holder) return this.refuse(socket, "seat-taken");
        if (!settings.multiSeat && this.seatsHeldBy(lobby, who.id) > 0) return this.refuse(socket, "multi-seat");
        if (isHost) {
          // The host approves their own request.
          await this.grant(seat, who);
          persist = true;
        } else {
          const list = this.requests.get(seat.id) ?? [];
          if (list.includes(who.id)) return;
          this.requests.set(seat.id, [...list, who.id]);
        }
        break;
      }
      case "seat-release": {
        const seat = seatOf(message.seat);
        if (!seat) return this.refuse(socket, "no-such-seat");
        if (seat.holder === who.id) {
          if (!handover && gameLive()) {
            // Leaving a seat mid-game with handover off: it stays reserved for them (their token keeps working).
            seat.left = true;
            delete seat.takenOver;
          } else free(seat);
          persist = true;
        } else if (!this.dropRequest(seat.id, who.id)) {
          return this.refuse(socket, "not-allowed");
        }
        break;
      }
      case "seat-assign": {
        if (!isHost) return this.refuse(socket, "not-allowed");
        const seat = seatOf(message.seat);
        if (!seat) return this.refuse(socket, "no-such-seat");
        const target = this.participants.get(message.participant);
        if (!target) return this.refuse(socket, "no-such-participant");
        if (target.role !== "host" && !this.sameBuild(target.build, settings)) {
          return this.refuse(socket, "build-mismatch");
        }
        if (seat.holder && seat.holder !== target.id) {
          // A seat whose player left it or is away is not the host's to hand on while handover is off.
          const gone = seat.left === true || !this.participants.has(seat.holder);
          return this.refuse(socket, !handover && gameLive() && gone ? "handover-off" : "seat-taken");
        }
        if (seat.holder === target.id) {
          if (!seat.left) return;
          delete seat.left;
          persist = true;
          break;
        }
        if (!settings.multiSeat && this.seatsHeldBy(lobby, target.id) > 0) return this.refuse(socket, "multi-seat");
        await this.grant(seat, target);
        persist = true;
        break;
      }
      case "take-over": {
        if (!isHost) return this.refuse(socket, "not-allowed");
        const seat = seatOf(message.seat);
        if (!seat) return this.refuse(socket, "no-such-seat");
        if (!handover) return this.refuse(socket, "handover-off");
        // An away seat (held, holder not connected) or a vacant one (its holder left it, Quin 2026-11-20: a seated player's
        // Concede is leaving the seat). A connected holder is the host's to deny instead.
        if (seat.holder && this.participants.has(seat.holder)) return this.refuse(socket, "not-away");
        if (seat.takenOver) return;
        seat.takenOver = true;
        persist = true;
        break;
      }
      case "give-back": {
        if (!isHost) return this.refuse(socket, "not-allowed");
        const seat = seatOf(message.seat);
        if (!seat) return this.refuse(socket, "no-such-seat");
        if (!seat.takenOver) return;
        delete seat.takenOver;
        persist = true;
        break;
      }
      case "seat-deck": {
        const seat = seatOf(message.seat);
        if (!seat) return this.refuse(socket, "no-such-seat");
        // A holder sets their own seat's deck; the host may set any seat's, which is then a preset.
        if (seat.holder !== who.id && !isHost) return this.refuse(socket, "not-allowed");
        const preset = isHost && seat.holder !== who.id;
        // A preset does not overwrite a deck its holder chose: take the seat back first.
        if (preset && seat.holder && !seat.deckPreset && seat.deck) return this.refuse(socket, "not-allowed");
        const now = this.clock();
        if (
          !takeToken(this.deckBuckets, who.id, DECK_MESSAGE_BURST, 1 / DECK_REFILL_SECONDS, now) ||
          !takeToken(this.roomDeckBucket, "room", ROOM_DECK_BURST, 1 / ROOM_DECK_REFILL_SECONDS, now)
        ) {
          return this.refuse(socket, "rate-limited");
        }
        // The size is the deck as sent, in bytes; the shape and counts were checked when the message was read.
        if (DECK_BYTES.encode(JSON.stringify(message.deck)).length > MAX_SEAT_DECK_BYTES) {
          return this.refuse(socket, "too-large");
        }
        const deck = cleanDeck(message.deck);
        if (!deck) return this.refuse(socket, "bad-message");
        // The same deck again changes nothing, so it writes nothing and tells no one.
        if (seat.deck && (seat.deckPreset === true) === preset && JSON.stringify(seat.deck) === JSON.stringify(deck)) {
          return;
        }
        // A holder's own deck over the host's preset keeps the preset behind it, for when they give the seat up.
        if (!preset && seat.deckPreset && seat.deck) seat.presetDeck = seat.deck;
        if (preset) delete seat.presetDeck;
        seat.deck = deck;
        if (preset) seat.deckPreset = true;
        else delete seat.deckPreset;
        persist = true;
        break;
      }
      case "seat-decks-request": {
        // The full lists go to the host alone, on request, never in the lobby everyone gets.
        if (!isHost) return this.refuse(socket, "not-allowed");
        this.sendTo(who.id, {
          v: 1,
          ch: "room",
          kind: "seat-decks",
          decks: lobby.seats.flatMap((seat) =>
            seat.deck
              ? [
                  {
                    seat: seat.id,
                    ...(seat.holder ? { holder: seat.holder } : {}),
                    preset: seat.deckPreset === true,
                    deck: seat.deck,
                  },
                ]
              : [],
          ),
        });
        return;
      }
      case "deck-refused": {
        // The host's engine judged a deck at Start: only that seat's holder is told why.
        if (!isHost) return this.refuse(socket, "not-allowed");
        const seat = seatOf(message.seat);
        if (!seat) return this.refuse(socket, "no-such-seat");
        const reason = clip(cleanText(message.reason), MAX_DECK_REFUSAL_CHARS);
        if (seat.holder && seat.holder !== who.id) {
          this.sendTo(seat.holder, {
            v: 1,
            ch: "room",
            kind: "deck-refused",
            seat: seat.id,
            code: message.code,
            reason,
          });
        }
        return;
      }
      case "seat-deny": {
        if (!isHost) return this.refuse(socket, "not-allowed");
        const seat = seatOf(message.seat);
        if (!seat) return this.refuse(socket, "no-such-seat");
        if (this.dropRequest(seat.id, message.participant)) {
          // A pending request: memory only. The requester is told, or it would keep asking after every reconnect.
          this.sendTo(message.participant, { v: 1, ch: "room", kind: "seat-denied", seat: seat.id });
        } else if (seat.holder === message.participant) {
          free(seat);
          persist = true;
        } else {
          // The request is gone (the room woke from hibernation, or the requester withdrew): not an error, the host
          // just needs the current lobby.
          this.sendSocket(socket, { v: 1, ch: "room", kind: "lobby", ...this.lobbyState(lobby) });
          return;
        }
        break;
      }
    }
    if (persist) {
      await this.saveLobby();
      // A holder who plays is not counted as a watcher, so a change of holders changes the roster's count.
      this.broadcastRoster();
    }
    this.broadcastLobby(lobby);
  }

  /** The seat ids `who` holds that may act: builds match and the host has not taken the seat over. */
  private actingSeats(lobby: LobbyRow, who: Participant): { ids: string[]; held: boolean; takenOver: boolean } {
    const held = lobby.seats.filter((seat) => seat.holder === who.id);
    const free = held.filter((seat) => !seat.takenOver && !seat.left);
    const ids = this.sameBuild(who.build, lobby.settings) ? free.map((seat) => seat.id) : [];
    return { ids, held: free.length > 0, takenOver: held.length > free.length };
  }

  /**
   * A seat holder's `propose` or `request`, relayed to the table's host and never stored. Refusals are soft: a flood
   * only ends in the socket's own refusal limit, and nothing here writes a row.
   */
  private async fromSeat(
    socket: RoomSocket,
    who: Participant,
    message: Extract<ClientMessage, { kind: "propose" | "request" }>,
  ): Promise<void> {
    const askId = message.kind === "propose" ? { pid: message.pid } : { rid: message.rid };
    const lobby = await this.loadLobby();
    if (!lobby) return this.refuse(socket, "not-allowed", askId);
    const table = this.tableOf(message.table);
    if (!table) return this.refuse(socket, "not-allowed", askId);
    if (who.role === "host") return this.refuse(socket, "not-seated", askId);
    const { ids, held } = this.actingSeats(lobby, who);
    if (ids.length === 0) return this.refuse(socket, held ? "build-mismatch" : "not-seated", askId);
    if (message.kind === "request" && lobby.settings.playMode === "strict") return this.refuse(socket, "strict", askId);
    const propose = message.kind === "propose";
    const taken = takeToken(
      propose ? this.proposalBuckets : this.lobbyBuckets,
      who.id,
      propose ? PROPOSAL_BURST : LOBBY_MESSAGE_BURST,
      propose ? PROPOSAL_PER_SECOND : 2,
      this.clock(),
    );
    if (!taken) return this.refuse(socket, "rate-limited", askId);
    await this.ensureLoaded(table);
    if (!table.hasHeader || table.ended) return this.refuse(socket, "out-of-order", askId);
    const host = this.hostOf(table.id);
    if (!host) return this.refuse(socket, "no-such-participant", askId);
    if (message.kind === "propose") {
      this.sendTo(host.id, {
        v: 1,
        ch: "game",
        kind: "proposal",
        table: table.id,
        from: who.id,
        seats: ids,
        command: message.command,
        base: message.base,
        ...(message.pid === undefined ? {} : { pid: message.pid }),
        ...(message.stamp === undefined ? {} : { stamp: message.stamp }),
      });
      return;
    }
    const note = clip(cleanText(message.note ?? ""), MAX_REQUEST_NOTE_CHARS);
    this.sendTo(host.id, {
      v: 1,
      ch: "game",
      kind: "request",
      table: table.id,
      from: who.id,
      what: message.what,
      note,
      ...(message.rid === undefined ? {} : { rid: message.rid }),
    });
  }

  /** The host's `proposal-refused`, `proposal-accepted` or `request-answer`: relayed to the one participant it names, nobody else. */
  private answerSeat(
    socket: RoomSocket,
    who: Participant,
    message: Extract<ClientMessage, { kind: "proposal-refused" | "proposal-accepted" | "request-answer" }>,
  ): void {
    const table = this.tableOf(message.table);
    if (who.role !== "host" || who.table !== message.table || !table) return this.refuse(socket, "not-allowed");
    if (!this.participants.has(message.to)) return this.refuse(socket, "no-such-participant");
    if (message.kind === "proposal-refused") {
      this.sendTo(message.to, {
        v: 1,
        ch: "game",
        kind: "proposal-refused",
        table: table.id,
        reason: message.reason,
        base: message.base,
        ...(message.pid === undefined ? {} : { pid: message.pid }),
      });
    } else if (message.kind === "proposal-accepted") {
      this.sendTo(message.to, {
        v: 1,
        ch: "game",
        kind: "proposal-accepted",
        table: table.id,
        base: message.base,
        ...(message.pid === undefined ? {} : { pid: message.pid }),
      });
    } else {
      this.sendTo(message.to, {
        v: 1,
        ch: "game",
        kind: "request-answer",
        table: table.id,
        accepted: message.accepted,
        ...(message.rid === undefined ? {} : { rid: message.rid }),
      });
    }
  }

  /** One line of chat: lobby rooms with chat on, at most 280 characters, 1 a second with a burst of 5 per participant. */
  private async say(socket: RoomSocket, who: Participant, raw: string): Promise<void> {
    const lobby = await this.loadLobby();
    if (!lobby || !lobby.settings.chat) return this.refuse(socket, "not-allowed");
    // An over-long line is cut to 280 code points, not refused.
    const text = clip(cleanText(raw), MAX_CHAT_LENGTH);
    if (text.length === 0) return this.refuse(socket, "bad-message");
    const now = this.clock();
    if (!takeToken(this.chatBuckets, who.id, CHAT_BURST, 1, now)) return this.refuse(socket, "rate-limited");
    const line: ChatLine = { from: who.id, ...(who.name ? { name: who.name } : {}), text, at: now };
    this.backlog.push(line);
    if (this.backlog.length > CHAT_BACKLOG_LINES) this.backlog.splice(0, this.backlog.length - CHAT_BACKLOG_LINES);
    this.broadcast({ v: 1, ch: "chat", kind: "said", ...line });
  }

  // ----------------------------------------------------------------------------------------------------------
  // Leaving and closing

  /** A socket closed or errored. A host replaced by a newer one is already gone and changes nothing. */
  async close(socket: RoomSocket): Promise<void> {
    const participant = socket.getParticipant();
    if (!participant || !this.participants.has(participant.id)) return;
    this.participants.delete(participant.id);
    this.sockets.delete(participant.id);
    this.chatBuckets.delete(participant.id);
    this.lobbyBuckets.delete(participant.id);
    this.proposalBuckets.delete(participant.id);
    this.deckBuckets.delete(participant.id);
    this.broadcastRoster();
    if (participant.role === "host" && participant.table) {
      const table = this.tableOf(participant.table);
      this.resendAsked.delete(participant.table);
      if (table) {
        this.broadcastTable(table);
        await this.writeTail(table);
      }
    }
    await this.withdrawRequests(participant.id);
  }

  /**
   * The alarm: the room closes 12 hours after the last host message (the stored hourly stamp, or the newer one in
   * memory), or 5 minutes after every table ended. When the time has not come the alarm moves out, one row.
   */
  async alarm(now: number): Promise<"closed" | "rescheduled" | "gone"> {
    const meta = await this.loadMeta();
    if (!meta) return "gone";
    if (meta.ended && meta.endedAt !== undefined) {
      const closeAt = meta.endedAt + ROOM_END_GRACE_MS;
      if (now >= closeAt) {
        await this.shutdown("ended");
        return "closed";
      }
      await this.storage.setAlarm(closeAt);
      await this.refreshCode(meta, closeAt);
      return "rescheduled";
    }
    const last = Math.max(this.lastHostMessageAt ?? 0, meta.lastHostAt ?? meta.createdAt);
    const due = last + ROOM_IDLE_MS;
    if (now >= due) {
      await this.shutdown("idle");
      return "closed";
    }
    await this.storage.setAlarm(due);
    await this.refreshCode(meta, due);
    return "rescheduled";
  }

  /** Moves the lobby code's expiry to the room's own, so the two match. A failed call leaves the old expiry. */
  private async refreshCode(meta: RoomMeta, expiresAt: number): Promise<void> {
    if (!meta.code || !meta.roomId) return;
    try {
      await this.codeHooks?.refresh(meta.code, meta.roomId, expiresAt + ROOM_CODE_MARGIN_MS);
    } catch {
      // The directory entry expires on its own alarm.
    }
  }

  /** Closes the room for good: tells everyone, closes the sockets, and forgets the room so its id is a 404 again. */
  async shutdown(reason: "ended" | "idle" | "disabled" | "host"): Promise<void> {
    this.broadcast({ v: 1, ch: "room", kind: "closed", reason });
    for (const socket of this.sockets.values()) {
      try {
        socket.close(1000, reason);
      } catch {
        // Already gone.
      }
    }
    this.sockets.clear();
    this.participants.clear();
    const meta = await this.loadMeta();
    if (meta?.code && meta.roomId) {
      try {
        await this.codeHooks?.release(meta.code, meta.roomId);
      } catch {
        // The directory entry expires on its own alarm.
      }
    }
    await this.storage.deleteAlarm();
    await this.storage.deleteAll();
    this.meta = null;
    this.lobby = null;
    this.backlog = [];
    this.chatBuckets.clear();
    this.lobbyBuckets.clear();
    this.proposalBuckets.clear();
    this.deckBuckets.clear();
    this.roomDeckBucket.clear();
    this.requests.clear();
  }

  // Test and handler views.
  get participantCount(): number {
    return this.participants.size;
  }

  logLength(tableId: string = FIRST_TABLE): number {
    return this.tables.get(tableId)?.commands.length ?? 0;
  }

  checksums(tableId: string = FIRST_TABLE): TableChecksums {
    return this.tables.get(tableId)?.checksums ?? {};
  }
}
