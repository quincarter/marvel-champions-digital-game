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
  MAX_LOBBY_SEATS,
  MAX_LOBBY_TABLES,
  MAX_TABLE_NAME_CHARS,
  MAX_POD_EVENT_BYTES,
  MAX_POD_STATE_BYTES,
  POD_BURST,
  POD_PER_SECOND,
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
  type LobbyPod,
  type LobbySeat,
  type LobbySeatSpec,
  type LobbyTable,
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
/** What a lobby room advertises. */
export const LOBBY_ROOM_CAPS: readonly RoomCapability[] = ["watch", "chat", "seats", "play", "tables"];

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
  /** A room with several tables: when the last one ended (the room closes `ROOM_END_GRACE_MS` later). */
  roomEndedAt?: number;
  /** A one-table room's end; a room with several tables stores each table's end in its own `<table>:end` row. */
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

/** An Epic table as stored: the public table plus the hash of its host's token. */
interface StoredTable extends Omit<LobbyTable, "host"> {
  /** A table host other than the organizer (a participant id, updated when it returns with its token). */
  host?: string;
  hostTokenHash?: string;
}

interface LobbyRow {
  settings: LobbySettings;
  seats: StoredSeat[];
  /** Epic rooms only. */
  tables?: StoredTable[];
  pods?: LobbyPod[];
  /** Epic rooms: the table the organizer hosts, if any. */
  organizerTable?: string;
}

interface StoredEnd {
  outcome: unknown;
  overflow: boolean;
  endedAt: number;
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
  /** True until the host's `start`, `log` or an in-order batch confirms the room's tail for this table in this lifetime. */
  unverified: boolean;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const encoder = new TextEncoder();

const sizeOf = (value: unknown): number => JSON.stringify(value)?.length ?? 0;
const byteSize = (value: unknown): number => encoder.encode(JSON.stringify(value) ?? "").byteLength;
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
  unverified: true,
});

const randomId = (): string =>
  [...crypto.getRandomValues(new Uint8Array(5))].map((b) => b.toString(16).padStart(2, "0")).join("");

const headerKey = (table: string) => `${table}:header`;
const chunkKey = (table: string, n: number) => `${table}:c:${String(n).padStart(6, "0")}`;
const tailKey = (table: string) => `${table}:tail`;
const endKey = (table: string) => `${table}:end`;

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
  /** Pod channel rate: a bucket per participant. Memory only. */
  private readonly podBuckets = new Map<string, { tokens: number; at: number }>();
  /** The organizer's last `pod:state`, kept in memory for joiners (never stored; the organizer re-sends on return). */
  private podState: unknown;
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
    this.syncTables(this.lobby);
    // A lobby stored before the undo setting has none: it reads as its mode's default.
    this.lobby.settings = {
      ...this.lobby.settings,
      undo: lobbyUndoFor(this.lobby.settings.playMode, this.lobby.settings.undo),
    };
    return this.lobby;
  }

  /** Makes the in-memory table map match the lobby's Epic tables (a standard lobby has only `t1`). */
  private syncTables(lobby: LobbyRow): void {
    const ids = lobby.settings.mode === "epic" && lobby.tables ? lobby.tables.map((t) => t.id) : [FIRST_TABLE];
    for (const id of ids) if (!this.tables.has(id)) this.tables.set(id, newTable(id));
    for (const id of [...this.tables.keys()]) if (!ids.includes(id)) this.tables.delete(id);
  }

  private epic(): boolean {
    return this.lobby?.settings.mode === "epic";
  }

  /** A room with its organizer (the room token's holder); in a standard room the one host is the organizer. */
  private isOrganizer(p: Participant): boolean {
    return p.role === "host" && (p.organizer === true || !this.epic());
  }

  private organizerOf(): Participant | undefined {
    for (const p of this.participants.values()) if (this.isOrganizer(p)) return p;
    return undefined;
  }

  private seatTable(seat: { table?: string }): string {
    return seat.table ?? FIRST_TABLE;
  }

  /** Replaces a participant's record (and the copy on its socket, which survives hibernation). */
  private setParticipantState(next: Participant): void {
    this.participants.set(next.id, next);
    try {
      this.sockets.get(next.id)?.setParticipant(next);
    } catch {
      // The socket is closing.
    }
  }

  /** The table a participant hosts: its role is `host` with that `table`. `undefined` makes it a plain watcher/holder. */
  private makeHost(id: string, table: string | undefined, organizer: boolean): void {
    const p = this.participants.get(id);
    if (!p) return;
    const { table: _t, organizer: _o, ...rest } = p;
    this.setParticipantState({
      ...rest,
      role: organizer || table !== undefined ? "host" : "watcher",
      ...(table !== undefined ? { table } : {}),
      ...(organizer ? { organizer: true as const } : {}),
    });
  }

  private async saveLobby(): Promise<void> {
    if (this.lobby) await this.storage.put("lobby", this.lobby);
  }

  private lobbyState(lobby: LobbyRow): LobbyState {
    const seats: LobbySeat[] = lobby.seats.map(({ tokenHash: _hash, deck, deckPreset, presetDeck: _held, ...seat }) => {
      const requested = this.requests.get(seat.id);
      const holder = seat.holder ? this.participants.get(seat.holder) : undefined;
      const mismatch =
        holder !== undefined && !this.isOrganizer(holder) && !this.sameBuild(holder.build, lobby.settings);
      return {
        ...seat,
        ...(requested && requested.length > 0 ? { requested: [...requested] } : {}),
        ...(mismatch ? { mismatch: true } : {}),
        ...(deck ? { deck: summarize(deck, deckPreset === true) } : {}),
      };
    });
    // A lobby stored before `handover` existed has none: handing over is allowed, as it always was.
    const epic = lobby.settings.mode === "epic" && lobby.tables !== undefined;
    const organizerId = epic ? this.organizerOf()?.id : undefined;
    const tables: LobbyTable[] | undefined = epic
      ? lobby.tables!.map(({ hostTokenHash: _hash, host, ...t }) => {
          const id = t.id === lobby.organizerTable ? organizerId : host;
          return { ...t, ...(id !== undefined ? { host: id } : {}) };
        })
      : undefined;
    return {
      code: this.meta?.code ?? "",
      settings: { ...lobby.settings, handover: lobby.settings.handover !== false },
      seats,
      ...(tables ? { tables, pods: [...(lobby.pods ?? [])] } : {}),
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
    if (this.tables.size > 1) {
      const end = await this.storage.get<StoredEnd>(endKey(table.id));
      table.ended = end !== undefined;
      table.outcome = end?.outcome ?? null;
      table.overflow = end?.overflow ?? false;
    } else {
      table.ended = meta?.ended ?? false;
      table.outcome = meta?.outcome ?? null;
      table.overflow = meta?.overflow ?? false;
    }
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
    const watching = participants.filter((p) => p.role === "watcher" && !holders.has(p.id));
    let perTable: Record<string, number> | undefined;
    if (this.epic()) {
      perTable = {};
      for (const id of this.tables.keys()) {
        perTable[id] = watching.filter((p) => p.follow === undefined || p.follow.includes(id)).length;
      }
    }
    this.broadcast({
      v: 1,
      ch: "room",
      kind: "roster",
      participants,
      // A seat holder plays; only the others watch (read from the lobby in memory: before it loads, all count).
      watchers: watching.length,
      ...(perTable ? { watching: perTable } : {}),
    });
  }

  /** Whether the participant receives a table's log: a `follow` list names the tables, none means all. */
  private follows(id: string, tableId: string): boolean {
    const follow = this.participants.get(id)?.follow;
    if (follow === undefined || follow.includes(tableId)) return true;
    // A seat holder always gets its own table, so it cannot drop out of its own game by unfollowing.
    return this.lobby?.seats.some((seat) => seat.holder === id && this.seatTable(seat) === tableId) ?? false;
  }

  /** A game message to everyone following the table, except one participant (the table's host, which sent it). */
  private sendGame(tableId: string, message: ServerMessage, except?: string): void {
    const text = JSON.stringify(message);
    for (const [id, socket] of this.sockets) {
      if (id === except || !this.follows(id, tableId)) continue;
      try {
        socket.send(text);
      } catch {
        // A socket that cannot take a message is closing.
      }
    }
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
    for (const [id, socket] of this.sockets)
      if (id !== hostId && this.follows(id, table.id)) this.sendLog(socket, table);
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
    // The room's own record is current (a promotion to table host is not yet on an old attachment's copy).
    const who = this.participants.get(participant.id)!;
    await this.loadLobby(); // So `tables` holds every Epic table before a message names one.
    if (this.woke) {
      this.woke = false;
      const lobby = await this.loadLobby();
      if (lobby) this.broadcastLobby(lobby);
    }

    if (message.ch === "room" && message.kind === "room-close") {
      // Only the room's host (the organizer in an Epic room) closes it.
      if (!this.isOrganizer(who)) return this.refuse(socket, "not-allowed");
      return this.shutdown("host");
    }
    if (message.ch === "chat") return this.say(socket, who, message.text);
    if (message.ch === "pod") return this.pod(socket, who, message);
    if (message.ch === "room" && message.kind === "follow") return this.follow(socket, who, message.tables);
    if (message.ch === "room") return this.lobbyMessage(socket, who, message);
    if (message.kind === "propose" || message.kind === "request") return this.fromSeat(socket, who, message);
    if (message.kind === "proposal-refused" || message.kind === "request-answer") {
      return this.answerSeat(socket, who, message);
    }
    const table = this.tableOf(message.table);
    if (who.role !== "host" || who.table !== message.table || !table) {
      return this.refuse(socket, "not-allowed");
    }
    const isLog = message.kind === "start" || message.kind === "log";
    if (bytes > this.limits.maxMessageBytes && !isLog) return this.refuse(socket, "too-large");
    // Several tables: the room's end needs every table's state, so a message-driven wake loads them all.
    if (this.tables.size > 1) for (const t of this.tables.values()) await this.ensureLoaded(t);
    else await this.ensureLoaded(table);
    await this.touchHost();
    await this.game(socket, who, table, message);
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

  /** Drops a replaced host's connection (a returning host takes its table back) and stores its table's tail. */
  private async replaceHost(old: Participant | undefined): Promise<void> {
    if (!old) return;
    const oldSocket = this.sockets.get(old.id);
    this.participants.delete(old.id);
    this.sockets.delete(old.id);
    try {
      oldSocket?.clearParticipant();
      oldSocket?.close(4000, "replaced");
    } catch {
      // Already gone.
    }
    const table = old.table ? this.tableOf(old.table) : undefined;
    if (table) await this.writeTail(table);
  }

  /** Whether a presented seat token opens a held seat: such a player is let in even when the room is full. */
  private async holdsSeatToken(lobby: LobbyRow | null, hashes: readonly string[]): Promise<boolean> {
    return lobby?.seats.some((seat) => seat.tokenHash !== undefined && hashes.includes(seat.tokenHash)) ?? false;
  }

  private async hello(socket: RoomSocket, message: Extract<ClientMessage, { kind: "hello" }>): Promise<void> {
    if (socket.getParticipant()) return this.refuse(socket, "bad-message");
    const meta = await this.loadMeta();
    if (!meta) return socket.close(1011, "no such room");
    const isRoomToken = message.token !== undefined && (await sha256Hex(message.token)) === meta.hostTokenHash;
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
    const lobby = await this.loadLobby();
    // An Epic table's host token (only a lobby in Epic mode has any): the sender hosts that table, and only that one.
    let tokenTable: string | undefined;
    if (!isRoomToken && lobby?.settings.mode === "epic" && lobby.tables && message.tableTokens?.length) {
      const hashes = await Promise.all(message.tableTokens.map(sha256Hex));
      tokenTable = lobby.tables.find((t) => t.hostTokenHash !== undefined && hashes.includes(t.hostTokenHash))?.id;
    }
    for (const table of this.tables.values()) await this.ensureLoaded(table);

    // A valid host token (the room's, or a table's) is always let in, whatever the room holds, and takes the old host
    // socket's place.
    if (isRoomToken) await this.replaceHost(this.organizerOf());
    else if (tokenTable !== undefined) await this.replaceHost(this.hostOf(tokenTable));
    else if (this.participants.size >= this.limits.maxParticipants && !(await this.holdsSeatToken(lobby, seatHashes))) {
      this.refuse(socket, "full");
      socket.close(1013, "full");
      return;
    }

    const epic = this.epic();
    const hosted = isRoomToken ? (epic ? lobby?.organizerTable : FIRST_TABLE) : tokenTable;
    let follow: string[] | undefined;
    if (Array.isArray(message.follow)) {
      if (message.follow.every((t) => this.tables.has(t))) follow = [...new Set(message.follow)];
      else this.refuse(socket, "no-such-table");
    }
    const you: Participant = {
      id: randomId(),
      role: isRoomToken || tokenTable !== undefined ? "host" : "watcher",
      ...(hosted !== undefined ? { table: hosted } : {}),
      ...(isRoomToken && epic ? { organizer: true as const } : {}),
      ...(lobbyRoom ? { name, ...(message.build ? { build: message.build } : {}) } : {}),
      ...(device ? { device } : {}),
      ...(follow ? { follow } : {}),
    };
    socket.setParticipant(you);
    this.sockets.set(you.id, socket);
    this.participants.set(you.id, you);
    if (tokenTable !== undefined && lobby?.tables) {
      const stored = lobby.tables.find((t) => t.id === tokenTable);
      if (stored) {
        stored.host = you.id;
        await this.saveLobby();
      }
    }

    this.sendSocket(socket, {
      v: 1,
      ch: "room",
      kind: "welcome",
      you,
      caps: lobbyRoom ? LOBBY_ROOM_CAPS : ROOM_CAPS,
      participants: this.rosterList(),
      tables: [...this.tables.values()].map((t) => this.info(t)),
    });
    this.broadcastRoster();
    if (lobbyRoom) await this.joinLobby(socket, you, seatHashes);
    if (lobbyRoom && this.podState !== undefined) {
      this.sendSocket(socket, { v: 1, ch: "pod", kind: "state", state: this.podState });
    }
    const own = you.table ? this.tableOf(you.table) : undefined;
    if (you.role === "host") {
      await this.touchHost();
      if (own) {
        this.resendAsked.delete(own.id);
        this.broadcastTable(own);
      }
    }
    // Every other table it follows: the log so far. A host does not get its own table's back.
    for (const table of this.tables.values()) {
      if (table === own || !this.follows(you.id, table.id)) continue;
      if (table.hasHeader) this.sendLog(socket, table);
    }
    // The host's welcome already says what the room holds, so it is not asked here. A participant joining while a table's
    // host is connected and the room's tail of that table is unconfirmed (it woke, or is new) makes the room ask that
    // host for what it lacks.
    for (const table of this.tables.values()) {
      if (table === own || !this.follows(you.id, table.id) || !table.unverified) continue;
      this.askResend(table.id, table.hasHeader ? table.commands.length : 0);
    }
  }

  private async game(
    socket: RoomSocket,
    host: Participant,
    table: Table,
    message: Exclude<
      ClientMessage,
      { ch: "room" } | { ch: "chat" } | { kind: "propose" | "proposal-refused" | "request" | "request-answer" }
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
        table.unverified = false;
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
        table.unverified = false;
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
          this.sendGame(table.id, { v: 1, ch: "game", kind: "rewind", table: table.id, to: message.from }, host.id);
        }
        await this.persistChunks(table);
        // A host that closes the app may never return to write the tail: refresh it while it streams, at most once a
        // minute, so an evicted room still has the commands past the last chunk.
        // The first batch of a table (or of a woken room with no stored tail) writes it at once, so a quiet host that
        // then hibernates and closes never leaves watchers an empty log; after that at most once a minute.
        if (table.tailAt === undefined || this.clock() - table.tailAt >= TAIL_REFRESH_MS) await this.writeTail(table);
        table.unverified = false;
        this.resendAsked.delete(table.id);
        this.sendGame(
          table.id,
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
        this.sendGame(table.id, { v: 1, ch: "game", kind: "rewind", table: table.id, to: message.to }, host.id);
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
      const { endedAt: _endedAt, roomEndedAt: _roomEndedAt, ...rest } = this.meta;
      if (this.tables.size > 1) {
        // Several tables: each table's end is its own row, and the room's end is cleared.
        await this.storage.delete(endKey(table.id));
        this.meta = { ...rest };
      } else this.meta = { ...rest, ended: false, outcome: null, overflow: false };
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
    this.sendGame(table.id, { v: 1, ch: "game", kind: "end", table: table.id, outcome });
    this.broadcastTable(table);
    const now = this.clock();
    // The game is over and the host may never come back: store the tail with the end.
    await this.writeTail(table);
    const all = [...this.tables.values()].every((t) => t.ended);
    if (this.tables.size > 1) {
      // The room ends when every table has: each table's end is its own row, and `roomEndedAt` (one meta write) says when.
      await this.storage.put(endKey(table.id), { outcome, overflow: table.overflow, endedAt: now } satisfies StoredEnd);
      if (all) await this.saveMeta({ roomEndedAt: now });
    } else {
      await this.saveMeta({ ended: true, outcome, endedAt: now, ...(overflow ? { overflow: true } : {}) });
    }
    if (all) await this.storage.setAlarm(now + ROOM_END_GRACE_MS);
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

  /** Whether the participant holds a seat at a table other than `tableId` (a participant plays at one table). */
  private holdsElsewhere(lobby: LobbyRow, id: string, tableId: string): boolean {
    return lobby.seats.some((seat) => seat.holder === id && this.seatTable(seat) !== tableId);
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
    if (this.isOrganizer(you) && you.build) {
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
      if (this.holdsElsewhere(lobby, you.id, this.seatTable(seat))) {
        this.refuse(socket, "other-table");
        continue;
      }
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

  /**
   * The organizer's `lobby-set`: settings, seats and (Epic) tables, pods and each table's host. Validates everything
   * first, then changes the lobby in memory; the caller saves and broadcasts. False when it refused.
   */
  private async lobbySet(
    socket: RoomSocket,
    who: Participant,
    lobby: LobbyRow,
    message: Extract<ClientMessage, { kind: "lobby-set" }>,
  ): Promise<boolean> {
    const { settings } = lobby;
    const patch = message.settings;
    // Cheats are fixed once the game has started: a table's header is the room's sign of that.
    if (patch?.cheats !== undefined && patch.cheats !== (settings.cheats === true)) {
      for (const t of this.tables.values()) {
        await this.ensureLoaded(t);
        if (t.hasHeader) {
          this.refuse(socket, "not-allowed");
          return false;
        }
      }
    }
    const playMode = patch?.playMode ?? settings.playMode;
    // Switching to Host control without naming one starts at Ask; Strict forces Off, whatever was sent.
    const undoChoice = patch?.undo ?? (playMode !== settings.playMode ? undefined : settings.undo);
    const next: LobbySettings = {
      ...settings,
      playMode,
      undo: lobbyUndoFor(playMode, undoChoice),
      cheats: patch?.cheats ?? settings.cheats === true,
      ...(patch?.playMode !== undefined ? { playMode: patch.playMode } : {}),
      ...(patch?.tableRules !== undefined ? { tableRules: patch.tableRules } : {}),
      ...(patch?.mods !== undefined ? { mods: patch.mods.map((m) => ({ ...m })) } : {}),
      ...(patch?.multiSeat !== undefined ? { multiSeat: patch.multiSeat } : {}),
      ...(patch?.handover !== undefined ? { handover: patch.handover } : {}),
      ...(patch?.chat !== undefined ? { chat: patch.chat } : {}),
      ...(patch?.mode !== undefined ? { mode: patch.mode } : {}),
    };
    const wasEpic = settings.mode === "epic";
    const epic = next.mode === "epic";
    const refuse = (reason: Refusal): false => {
      this.refuse(socket, reason);
      return false;
    };
    // Whether a table has a game needs its header: read once, only when tables or the mode change, or in an Epic room
    // (whose topology freezes once a table has started).
    if (
      message.tables !== undefined ||
      message.pods !== undefined ||
      message.seats !== undefined ||
      epic !== wasEpic ||
      wasEpic
    ) {
      for (const t of this.tables.values()) await this.ensureLoaded(t);
    }
    // An Epic game that has started is a fixed set of tables, pods, hosts, seats and players: the coordinator, each
    // table's engine and every client's view were built from them, and a change would leave them disagreeing. Only
    // cosmetic edits (a table's or pod's name, a seat's label) and the play settings below stay open.
    const frozen = wasEpic && [...this.tables.values()].some((t) => t.hasHeader);
    const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    // An ordinary room's running game (issue #881): the seat-to-player mapping is the host engine's, and guests'
    // proposals are judged by it, so a seat may not be added, removed, reordered or given another player until the
    // table ends. Labels and holder handovers stay open.
    const seatsLive = !wasEpic && [...this.tables.values()].some((t) => t.hasHeader && !t.ended);
    if (frozen) {
      if (next.mode !== settings.mode) return refuse("out-of-order");
      if (patch?.mods !== undefined && !same(patch.mods, settings.mods)) return refuse("out-of-order");
      if (patch?.tableRules !== undefined && !same(patch.tableRules, settings.tableRules)) {
        return refuse("out-of-order");
      }
    }

    let seats = lobby.seats;
    if (message.seats) {
      const ids = new Set(message.seats.map((s) => s.id));
      // Every seat holder must fit in the room, so the seats are capped by the participant limit too.
      const cap = Math.min(epic ? MAX_LOBBY_SEATS * MAX_LOBBY_TABLES : MAX_LOBBY_SEATS, this.limits.maxParticipants);
      if (ids.size !== message.seats.length || message.seats.length > cap) return refuse("bad-message");
      if (!epic && message.seats.some((s) => s.table !== undefined && s.table !== FIRST_TABLE)) {
        return refuse("bad-message");
      }
      // A seat id that stays keeps its holder, requests and token; its label may change; a removed one is gone. A seat
      // that moves to another table loses its holder (a participant plays at one table).
      if (frozen) {
        // The same seats at the same tables, each playing the same hero.
        const same1 = message.seats.length === lobby.seats.length;
        const unchanged = message.seats.every((spec) => {
          const kept = lobby.seats.find((s) => s.id === spec.id);
          if (!kept || (spec.table ?? FIRST_TABLE) !== this.seatTable(kept)) return false;
          return spec.player === undefined || String(spec.player) === String(kept.player);
        });
        if (!same1 || !unchanged) return refuse("out-of-order");
      }
      if (seatsLive) {
        const unchanged =
          message.seats.length === lobby.seats.length &&
          message.seats.every((spec, i) => {
            const kept = lobby.seats[i]!;
            return spec.id === kept.id && (spec.player === undefined || String(spec.player) === String(kept.player));
          });
        if (!unchanged) return refuse("not-allowed");
      }
      seats = message.seats.map((spec) => {
        const kept = lobby.seats.find((s) => s.id === spec.id);
        const table = epic ? (spec.table ?? FIRST_TABLE) : undefined;
        const moved = kept !== undefined && epic && this.seatTable(kept) !== table;
        // An Epic seat keeps its player when the spec leaves it out: the table's engine seated its heroes by it.
        const keptPlayer =
          (epic || seatsLive) && kept && !moved && kept.player !== undefined ? { player: kept.player } : {};
        const player = spec.player === undefined ? keptPlayer : { player: spec.player };
        const label = spec.label === undefined ? {} : { label: spec.label };
        const {
          label: _label,
          player: _old,
          table: _table,
          ...rest
        } = moved || !kept ? ({ id: spec.id } as StoredSeat) : kept;
        return { ...rest, ...label, ...player, ...(table !== undefined ? { table } : {}) };
      });
    } else if (!epic && seats.some((s) => this.seatTable(s) !== FIRST_TABLE)) {
      return refuse("bad-message");
    }
    // Epic: seat n of a table plays that table's engine player p<n> (setup built each group's players in seat order), so
    // a seat with no player yet gets the next free one at its table. It is set here, once, so no client path can leave
    // a table without it, and the freeze above keeps it from then on.
    if (epic) {
      const used = new Map<string, Set<string>>();
      for (const seat of seats) {
        if (seat.player === undefined) continue;
        const at = this.seatTable(seat);
        used.set(at, (used.get(at) ?? new Set()).add(String(seat.player)));
      }
      const counts = new Map<string, number>();
      seats = seats.map((seat) => {
        const at = this.seatTable(seat);
        if (seat.player !== undefined) return seat;
        const taken = used.get(at) ?? new Set<string>();
        let n = counts.get(at) ?? 0;
        let id: string;
        do id = `p${++n}`;
        while (taken.has(id));
        counts.set(at, n);
        taken.add(id);
        used.set(at, taken);
        return { ...seat, player: id };
      });
    }
    if (!next.multiSeat) {
      // Turning multi-seat off cannot quietly take a seat from someone who holds two.
      const counts = new Map<string, number>();
      for (const seat of seats) if (seat.holder) counts.set(seat.holder, (counts.get(seat.holder) ?? 0) + 1);
      if ([...counts.values()].some((n) => n > 1)) return refuse("multi-seat");
    }

    let tablesNext: StoredTable[] | undefined;
    let podsNext: LobbyPod[] | undefined;
    let organizerTable: string | undefined;
    const newHosts: { table: string; id: string; token: string; hash: string }[] = [];
    const demote: string[] = [];
    const old = lobby.tables ?? [];

    if (!epic) {
      if (message.tables !== undefined || message.pods !== undefined) return refuse("bad-message");
      if (wasEpic) {
        // Any table with a log (t1 too: its end would move between rows) keeps the room Epic.
        if ([...this.tables.values()].some((t) => t.hasHeader)) return refuse("out-of-order");
        if (old.some((t) => t.host !== undefined)) return refuse("bad-table-host");
      }
    } else {
      const specs: readonly {
        id: string;
        name: string;
        pod: string;
        difficulty?: unknown;
        host?: string | null;
      }[] = message.tables ?? old.map(({ id, name, pod, difficulty }) => ({ id, name, pod, difficulty }));
      if (specs.length < 2 || specs.length > MAX_LOBBY_TABLES) return refuse("bad-message");
      const ids = new Set(specs.map((t) => t.id));
      if (ids.size !== specs.length || !ids.has(FIRST_TABLE)) return refuse("bad-message");
      for (const o of old) if (!ids.has(o.id) && this.tables.get(o.id)?.hasHeader) return refuse("out-of-order");
      if (frozen) {
        // The same tables, each in the same pod with the same difficulty; names may change.
        if (specs.length !== old.length) return refuse("out-of-order");
        for (const spec of specs) {
          const was = old.find((t) => t.id === spec.id);
          if (!was || was.pod !== spec.pod) return refuse("out-of-order");
          if (spec.difficulty !== undefined && !same(spec.difficulty, was.difficulty)) return refuse("out-of-order");
        }
        const podIds = new Set((lobby.pods ?? []).map((p) => p.id));
        if (message.pods && (message.pods.length !== podIds.size || message.pods.some((p) => !podIds.has(p.id)))) {
          return refuse("out-of-order");
        }
      }
      // A removed table's host is a plain participant again.
      for (const o of old) if (!ids.has(o.id) && o.host !== undefined) demote.push(o.host);
      if (!wasEpic && [...this.tables.values()].some((t) => t.hasHeader)) return refuse("out-of-order");
      // Pods: as given, else named by the tables' own pod ids (keeping any name already set).
      const podNames = new Map((lobby.pods ?? []).map((p) => [p.id, p.name]));
      const podSpecs =
        message.pods ?? [...new Set(specs.map((t) => t.pod))].map((id) => ({ id, name: podNames.get(id) ?? id }));
      podsNext = [];
      for (const pod of podSpecs) {
        const name = clip(cleanText(pod.name).replace(/\s+/g, " "), MAX_TABLE_NAME_CHARS);
        if (!hasVisible(name) || podsNext.some((p) => p.id === pod.id)) return refuse("bad-message");
        podsNext.push({ id: pod.id, name });
      }
      for (const seat of seats) if (!ids.has(this.seatTable(seat))) return refuse("no-such-table");
      for (const id of ids) {
        if (seats.filter((s) => this.seatTable(s) === id).length > MAX_LOBBY_SEATS) return refuse("bad-message");
      }

      // Who hosts each table. Keep what is there unless a spec says otherwise; one participant hosts at most one table.
      const ORGANIZER = Symbol("organizer");
      const desired = new Map<string, string | typeof ORGANIZER | null>();
      for (const spec of specs) {
        const was = old.find((t) => t.id === spec.id);
        if (spec.host === undefined) {
          desired.set(spec.id, lobby.organizerTable === spec.id ? ORGANIZER : (was?.host ?? null));
        } else if (spec.host === null) desired.set(spec.id, null);
        else desired.set(spec.id, spec.host === who.id ? ORGANIZER : spec.host);
      }
      const seen = new Set<string | typeof ORGANIZER>();
      for (const [tableId, d] of desired) {
        if (d === null) continue;
        if (seen.has(d)) return refuse("bad-table-host");
        seen.add(d);
        if (d === ORGANIZER) {
          organizerTable = tableId;
          continue;
        }
        if (old.find((t) => t.id === tableId)?.host === d) continue; // already its host
        const p = this.participants.get(d);
        if (!p) return refuse("no-such-participant");
        const holds = seats.some((s) => s.holder === d && this.seatTable(s) === tableId);
        if (!holds || this.isOrganizer(p)) return refuse("bad-table-host");
      }
      for (const [tableId, d] of desired) {
        const was = old.find((t) => t.id === tableId)?.host;
        if (typeof d === "string" && d !== was) {
          const token = newSeatToken();
          newHosts.push({ table: tableId, id: d, token, hash: await sha256Hex(token) });
        }
        if (was !== undefined && was !== d) demote.push(was);
      }
      // Nobody takes a table over, and no table changes hands, once it has started.
      if (frozen && (newHosts.length > 0 || demote.length > 0 || organizerTable !== lobby.organizerTable)) {
        return refuse("out-of-order");
      }
      tablesNext = [];
      for (const spec of specs) {
        const name = clip(cleanText(spec.name).replace(/\s+/g, " "), MAX_TABLE_NAME_CHARS);
        if (!hasVisible(name) || !podsNext.some((p) => p.id === spec.pod)) return refuse("bad-message");
        const d = desired.get(spec.id);
        const fresh = newHosts.find((h) => h.table === spec.id);
        const was = old.find((t) => t.id === spec.id);
        const hash = fresh ? fresh.hash : typeof d === "string" ? was?.hostTokenHash : undefined;
        tablesNext.push({
          id: spec.id,
          name,
          pod: spec.pod,
          ...(spec.difficulty !== undefined ? { difficulty: spec.difficulty } : {}),
          ...(typeof d === "string" ? { host: d } : {}),
          ...(hash ? { hostTokenHash: hash } : {}),
        });
      }
    }

    // Everything checked: change the lobby.
    lobby.settings = next;
    lobby.seats = seats;
    if (epic) {
      lobby.tables = tablesNext!;
      lobby.pods = podsNext!;
      if (organizerTable !== undefined) lobby.organizerTable = organizerTable;
      else delete lobby.organizerTable;
    } else {
      delete lobby.tables;
      delete lobby.pods;
      delete lobby.organizerTable;
    }
    this.syncTables(lobby);
    if (wasEpic && !epic) this.podState = undefined;
    for (const id of [...this.requests.keys()]) if (!seats.some((seat) => seat.id === id)) this.requests.delete(id);
    // The people: a replaced host is a plain participant again; the organizer hosts its table (or none); a new host is
    // promoted and told its token privately.
    for (const id of demote) if (this.participants.has(id)) this.makeHost(id, undefined, false);
    if (epic || wasEpic) this.makeHost(who.id, epic ? organizerTable : FIRST_TABLE, epic);
    for (const h of newHosts) {
      this.makeHost(h.id, h.table, false);
      this.sendTo(h.id, { v: 1, ch: "room", kind: "table-host-token", table: h.table, token: h.token });
    }
    if (epic || wasEpic) for (const t of this.tables.values()) this.broadcastTable(t);
    return true;
  }

  private async lobbyMessage(
    socket: RoomSocket,
    who: Participant,
    message: Exclude<Extract<ClientMessage, { ch: "room" }>, { kind: "hello" | "room-close" }>,
  ): Promise<void> {
    const lobby = await this.loadLobby();
    if (!lobby) return this.refuse(socket, "not-allowed");
    const isHost = this.isOrganizer(who);
    // A host's lobby edits count as host activity, like a game message does.
    if (who.role === "host") await this.touchHost();
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
      if (!seat.deckPreset && !gameLive(seat)) {
        delete seat.deck;
        if (seat.presetDeck) {
          seat.deck = seat.presetDeck;
          seat.deckPreset = true;
        }
        delete seat.presetDeck;
      }
    };
    const handover = settings.handover !== false;
    // Whose seats' full decks this participant may read and refuse: the host's, all of them in a standard room; in an
    // Epic room the host of a table reads its own table's seats (the organizer too, only if it hosts a table).
    const inDeckScope = (): boolean => (this.epic() ? who.role === "host" && who.table !== undefined : isHost);
    const deckScope = (seat: StoredSeat): boolean => !this.epic() || this.seatTable(seat) === who.table;
    const gameLive = (seat: StoredSeat): boolean => {
      const t = this.tables.get(this.seatTable(seat));
      return t !== undefined && t.hasHeader && !t.ended;
    };
    // Only a change of holder, or the host setting the lobby, is stored. A request or its withdrawal is memory only.
    let persist = false;

    switch (message.kind) {
      case "lobby-set": {
        if (!isHost) return this.refuse(socket, "not-allowed");
        if (!(await this.lobbySet(socket, who, lobby, message))) return;
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
        if (this.holdsElsewhere(lobby, who.id, this.seatTable(seat))) return this.refuse(socket, "other-table");
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
          if (!handover && gameLive(seat)) {
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
        if (!this.isOrganizer(target) && !this.sameBuild(target.build, settings)) {
          return this.refuse(socket, "build-mismatch");
        }
        if (seat.holder && seat.holder !== target.id) {
          // A seat whose player left it or is away is not the host's to hand on while handover is off.
          const gone = seat.left === true || !this.participants.has(seat.holder);
          return this.refuse(socket, !handover && gameLive(seat) && gone ? "handover-off" : "seat-taken");
        }
        if (seat.holder === target.id) {
          if (!seat.left) return;
          delete seat.left;
          persist = true;
          break;
        }
        if (this.holdsElsewhere(lobby, target.id, this.seatTable(seat))) return this.refuse(socket, "other-table");
        if (!settings.multiSeat && this.seatsHeldBy(lobby, target.id) > 0) return this.refuse(socket, "multi-seat");
        await this.grant(seat, target);
        persist = true;
        break;
      }
      case "take-over": {
        const seat = seatOf(message.seat);
        if (!isHost && !(who.role === "host" && seat && who.table === this.seatTable(seat))) {
          return this.refuse(socket, "not-allowed");
        }
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
        const seat = seatOf(message.seat);
        if (!isHost && !(who.role === "host" && seat && who.table === this.seatTable(seat))) {
          return this.refuse(socket, "not-allowed");
        }
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
        // The full lists go to the host alone, on request, never in the lobby everyone gets. In an Epic room that is
        // each table's host, for the seats at its own table: it judges and deals that table's game.
        if (!inDeckScope()) return this.refuse(socket, "not-allowed");
        this.sendTo(who.id, {
          v: 1,
          ch: "room",
          kind: "seat-decks",
          decks: lobby.seats.filter(deckScope).flatMap((seat) =>
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
        if (!inDeckScope()) return this.refuse(socket, "not-allowed");
        const seat = seatOf(message.seat);
        if (!seat) return this.refuse(socket, "no-such-seat");
        if (!deckScope(seat)) return this.refuse(socket, "not-allowed");
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
  private actingSeats(
    lobby: LobbyRow,
    who: Participant,
    tableId: string,
  ): { ids: string[]; held: boolean; takenOver: boolean } {
    const held = lobby.seats.filter((seat) => seat.holder === who.id && this.seatTable(seat) === tableId);
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
    const { ids, held } = this.actingSeats(lobby, who, table.id);
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

  /** The host's `proposal-refused` or `request-answer`: relayed to the one participant it names, nobody else. */
  private answerSeat(
    socket: RoomSocket,
    who: Participant,
    message: Extract<ClientMessage, { kind: "proposal-refused" | "request-answer" }>,
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

  // ----------------------------------------------------------------------------------------------------------
  // Several tables: following, and the pod channel (docs/live-game-rooms.md section 10)

  /** A participant chooses which tables' logs it receives; newly followed tables send their log. */
  private async follow(socket: RoomSocket, who: Participant, tables: "all" | readonly string[]): Promise<void> {
    if (!takeToken(this.lobbyBuckets, who.id, LOBBY_MESSAGE_BURST, 2, this.clock())) {
      return this.refuse(socket, "rate-limited");
    }
    if (tables !== "all" && !tables.every((t) => this.tables.has(t))) return this.refuse(socket, "no-such-table");
    const before = who.follow;
    const next = tables === "all" ? undefined : [...new Set(tables)];
    const { follow: _old, ...rest } = who;
    this.setParticipantState(next ? { ...rest, follow: next } : rest);
    this.broadcastRoster();
    for (const table of this.tables.values()) {
      if (table.id === who.table) continue;
      const was = before === undefined || before.includes(table.id);
      const now = next === undefined || next.includes(table.id);
      if (!now || was) continue;
      await this.ensureLoaded(table);
      if (table.hasHeader) this.sendLog(socket, table);
      if (table.unverified) this.askResend(table.id, table.hasHeader ? table.commands.length : 0);
    }
  }

  /**
   * The pod channel (Epic rooms): a table host's event goes to the organizer only, the organizer's answer to that
   * table's host only, and the organizer's state to everyone. Opaque, size-capped, rate limited, never stored.
   */
  private pod(socket: RoomSocket, who: Participant, message: Extract<ClientMessage, { ch: "pod" }>): void {
    if (!this.epic()) return this.refuse(socket, "not-allowed");
    const organizer = this.isOrganizer(who);
    if (message.kind === "state") {
      if (!organizer) return this.refuse(socket, "not-allowed");
      if (byteSize(message.state) > MAX_POD_STATE_BYTES) return this.refuse(socket, "too-large");
      if (!takeToken(this.podBuckets, who.id, POD_BURST, POD_PER_SECOND, this.clock())) {
        return this.refuse(socket, "rate-limited");
      }
      this.podState = message.state;
      this.broadcast({ v: 1, ch: "pod", kind: "state", state: message.state }, who.id);
      return;
    }
    if (byteSize(message.event) > MAX_POD_EVENT_BYTES) return this.refuse(socket, "too-large");
    if (!this.tables.has(message.table)) return this.refuse(socket, "no-such-table");
    if (message.kind === "event") {
      // From a table's own host; the organizer's own table needs no relay (the coordinator is on its device).
      if (who.role !== "host" || who.table !== message.table) return this.refuse(socket, "not-allowed");
      if (organizer) return;
      if (!takeToken(this.podBuckets, who.id, POD_BURST, POD_PER_SECOND, this.clock())) {
        return this.refuse(socket, "rate-limited");
      }
      const target = this.organizerOf();
      if (!target) return this.refuse(socket, "no-such-participant");
      this.sendTo(target.id, {
        v: 1,
        ch: "pod",
        kind: "event",
        table: message.table,
        seq: message.seq,
        event: message.event,
      });
      return;
    }
    if (!organizer) return this.refuse(socket, "not-allowed");
    if (!takeToken(this.podBuckets, who.id, POD_BURST, POD_PER_SECOND, this.clock())) {
      return this.refuse(socket, "rate-limited");
    }
    const host = this.hostOf(message.table);
    if (!host) return this.refuse(socket, "no-such-participant");
    if (host.id === who.id) return;
    this.sendTo(host.id, {
      v: 1,
      ch: "pod",
      kind: "inbound",
      table: message.table,
      seq: message.seq,
      event: message.event,
    });
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
    this.podBuckets.delete(participant.id);
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
    // A one-table room ends with its table; a room with several ends when every table has (`roomEndedAt`).
    const endedAt = meta.roomEndedAt ?? (meta.ended ? meta.endedAt : undefined);
    if (endedAt !== undefined) {
      const closeAt = endedAt + ROOM_END_GRACE_MS;
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
    this.podBuckets.clear();
    this.podState = undefined;
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
