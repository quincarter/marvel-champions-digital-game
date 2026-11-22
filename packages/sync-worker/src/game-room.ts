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
 * A listed room (the host's opt-in `settings.listed`) also publishes one entry to the "Live now" directory
 * (`room-directory.ts`): on a change of what the entry shows, at most once every `LIVE_PUBLISH_MIN_MS` (changes inside
 * the window are coalesced into one call), refreshed hourly with the host's stamp, removed when the host leaves, the
 * room is unlisted, ends or closes. Memory only here: no row of the room's own is written for it.
 *
 * A socket's participant lives in the socket's own attachment, so it survives hibernation; the logic keys everything
 * by participant id and takes the newest socket object it is handed for that id.
 */

import type { KeyValueStorage } from "./env.js";
import { REPLAY_ID_ALPHABET } from "./replay-protocol.js";
import {
  CHAT_BACKLOG_LINES,
  HOST_ACTIVITY_BURST,
  LOBBY_MESSAGE_BURST,
  MAX_ACTIVITY_SCENARIO_CHARS,
  type HostActivityStep,
  ROOM_CODE_MARGIN_MS,
  LIVE_PUBLISH_MIN_MS,
  type LiveRoomEntry,
  CHAT_BURST,
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
export const LOBBY_ROOM_CAPS: readonly RoomCapability[] = ["watch", "chat", "seats"];

/** The room's calls to its code's directory entry (`RoomCode`), made when it moves its expiry or closes. */
export interface RoomCodeHooks {
  refresh(code: string, roomId: string, expiresAt: number): Promise<void>;
  release(code: string, roomId: string): Promise<void>;
}

/** The room's calls to the "Live now" directory; the directory stamps `updatedAt`. */
export interface RoomDirectoryHooks {
  upsert(entry: Omit<LiveRoomEntry, "updatedAt">): Promise<void>;
  remove(code: string): Promise<void>;
}

/** A new lobby's settings: Strict, no house rules, no mods, one seat each, chat on. The versions are the host's. */
export const DEFAULT_LOBBY_SETTINGS: LobbySettings = {
  playMode: "strict",
  undo: "off",
  cheats: false,
  tableRules: {},
  mods: [],
  multiSeat: false,
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
  /** Bumped by every stored change (settings, a seat's holder or deck); a row stored before it reads as 0. */
  rev?: number;
}

interface StoredChunk {
  commands: unknown[];
  checksums: Record<string, string>;
  bytes: number;
  /** The generation of the header this chunk belongs to; a row of another generation is a leftover and is ignored. */
  sg?: number;
}

interface Table {
  id: string;
  header: unknown;
  hasHeader: boolean;
  /** The host's admission id for the game whose header this is (stored with the header row). */
  gid: string | undefined;
  /** A replacement `log` is in memory but its writes did not all land: a retry must redo them, not be acked as the same game. */
  unsaved: boolean;
  /**
   * The storage generation of this game's rows (row key `sg`, not a log epoch): the header, its chunks and its tail carry it, and a new game or replacement
   * log takes the next one, a rewind never does. The new header is stored before the old rows are deleted, so a crash or failed delete
   * between the two leaves rows of another generation, which a load ignores, never a mix of two games.
   */
  storeGen: number | undefined;
  /** The admission id in the stored header row: durable, unlike `gid`, which may be a replacement not stored yet. */
  committedGid: string | undefined;
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
  /** The in-memory header is newer than the stored one (a replacement log whose header put has not landed). */
  headerDirty: boolean;
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

/** UTF-8 bytes of a value's JSON, the unit of every cap here (a multibyte character is up to 4 bytes, not 1 UTF-16 unit). */
const sizeOf = (value: unknown): number => {
  const json = JSON.stringify(value);
  return json === undefined ? 0 : encoder.encode(json).byteLength;
};
/** Room for a part's JSON envelope (`v`, `ch`, `kind`, `table`, `from`, brackets and commas) beyond its commands. */
const PART_ENVELOPE_BYTES = 1024;
const sizeOfAll = (values: readonly unknown[]): number => {
  let total = 0;
  for (const v of values) total += sizeOf(v);
  return total;
};

const newTable = (id: string): Table => ({
  id,
  header: undefined,
  hasHeader: false,
  gid: undefined,
  storeGen: undefined,
  unsaved: false,
  committedGid: undefined,
  commands: [],
  checksums: {},
  persisted: 0,
  bytes: 0,
  ended: false,
  outcome: null,
  overflow: false,
  loaded: false,
  headerDirty: false,
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
/** The lobby as it was before a change: what a failed save puts back. */
interface LobbySnapshot {
  readonly row: LobbyRow;
  readonly requests: Map<string, string[]>;
}

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
  /**
   * Set when sockets were restored after a hibernation: the pending requests above were lost while the sockets stayed
   * open, so the first message handled sends everyone a fresh lobby and the clients ask again (they do on every lobby).
   */
  private woke = false;
  /** The tail of the lobby lock's queue. */
  private lobbyTurn: Promise<void> = Promise.resolve();
  /** Lobby message rate: a bucket per participant (burst `LOBBY_MESSAGE_BURST`, 2 a second). Memory only. */
  private readonly lobbyBuckets = new Map<string, { tokens: number; at: number }>();
  /** `seat-deck` rate per participant, and for the whole room (every accepted deck rewrites the lobby row). Memory only. */
  private readonly deckBuckets = new Map<string, { tokens: number; at: number }>();
  private readonly roomDeckBucket = new Map<string, { tokens: number; at: number }>();
  /** The lobby row, loaded on first use; null for a room without a code. */
  private lobby: LobbyRow | null | undefined;
  /** The last chat lines, oldest first. Mirrored in the one `chat` storage row; loaded on first use after a wake. */
  private backlog: ChatLine[] = [];
  /** The one in-flight (or finished) read of the stored backlog, so overlapping callers all wait for the same load. */
  private backlogLoad: Promise<void> | null = null;
  /** The host's current setup step (memory only, never part of the lobby revision), or null when none. */
  private activity: { step: HostActivityStep; scenario?: string } | null = null;
  /** The newest step that arrived over the limit: relayed once a token is free, so the last step is never lost. */
  private pendingActivity: { who: string; step: { step: HostActivityStep; scenario?: string } } | null = null;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly activityBucket = new Map<string, { tokens: number; at: number }>();
  /** Chat rate: a token bucket per participant (1 a second, burst `CHAT_BURST`). Memory only. */
  private readonly chatBuckets = new Map<string, { tokens: number; at: number }>();

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly limits: GameRoomLimits = DEFAULT_GAME_ROOM_LIMITS,
    private readonly clock: () => number = () => Date.now(),
    private readonly codeHooks?: RoomCodeHooks,
    private readonly directoryHooks?: RoomDirectoryHooks,
  ) {}

  // ----------------------------------------------------------------------------------------------------------
  // The "Live now" listing (memory only)

  private listingTimer: ReturnType<typeof setTimeout> | null = null;
  /** JSON of the entry last sent to the directory; null when none is known to be there. */
  private listedKey: string | null = null;
  private listedAt = Number.NEGATIVE_INFINITY;
  /** The hourly refresh: the next flush sends the entry even when it has not changed. */
  private listingForce = false;
  /** The host turned listing off while this instance did not know it was on (a woken room): one removal is owed. */
  private removalOwed = false;
  /** A removal was sent since the entry was last published (or the room is known not to be listed). */
  private absentSent = false;
  private flushing = false;
  private flushAgain = false;
  /** The table's game has started (seen once; a woken room has not loaded the log, so it keeps what it saw). */
  private startedSeen = false;

  /** Asks for the listing to be brought up to date: coalesced, and never more often than `LIVE_PUBLISH_MIN_MS`. */
  private scheduleListing(): void {
    // A woken room has not loaded its meta yet (undefined): the flush does, and skips a room without a code.
    if (!this.directoryHooks || (this.meta !== undefined && !this.meta?.code) || this.listingTimer !== null) return;
    const wait = Math.max(0, this.listedAt + LIVE_PUBLISH_MIN_MS - this.clock());
    this.listingTimer = setTimeout(() => {
      this.listingTimer = null;
      void this.flushListing();
    }, wait);
  }

  /** What the directory should show now, or null when the room is not to be listed. */
  private listingEntry(meta: RoomMeta, lobby: LobbyRow): Omit<LiveRoomEntry, "updatedAt"> | null {
    if (!meta.code || lobby.settings.listed !== true || meta.ended) return null;
    const host = [...this.participants.values()].find((p) => p.role === "host");
    if (!host?.name) return null;
    if (this.tables.get(FIRST_TABLE)?.hasHeader) this.startedSeen = true;
    return {
      code: meta.code,
      host: host.name,
      mode: lobby.settings.playMode,
      ...(this.activity?.scenario ? { scenario: this.activity.scenario } : {}),
      seatsTaken: lobby.seats.filter((seat) => seat.holder !== undefined).length,
      seatsTotal: lobby.seats.length,
      started: this.startedSeen,
    };
  }

  private async flushListing(): Promise<void> {
    // One directory call at a time: a change that lands meanwhile is picked up by a fresh flush when this one settles.
    if (this.flushing) {
      this.flushAgain = true;
      return;
    }
    this.flushing = true;
    try {
      const hooks = this.directoryHooks;
      const meta = await this.loadMeta();
      if (!hooks || !meta?.code) return;
      const lobby = await this.loadLobby();
      const entry = lobby ? this.listingEntry(meta, lobby) : null;
      try {
        if (entry) {
          const key = JSON.stringify(entry);
          if (key === this.listedKey && !this.listingForce) return;
          this.listingForce = false;
          this.listedAt = this.clock();
          this.listedKey = key;
          this.absentSent = false;
          await hooks.upsert(entry);
        } else if (
          this.listedKey !== null ||
          this.removalOwed ||
          (lobby?.settings.listed === true && !this.absentSent)
        ) {
          // The stored setting counts too: a woken room has lost what it published, but a listed room may still be there.
          this.listedKey = null;
          this.listedAt = this.clock();
          await hooks.remove(meta.code);
          this.removalOwed = false;
          this.absentSent = true;
        }
      } catch {
        // The directory is a convenience: the next change sends it again, and its own entry expires.
        this.listedKey = null;
      }
    } finally {
      this.flushing = false;
      if (this.flushAgain) {
        this.flushAgain = false;
        this.scheduleListing();
      }
    }
  }

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

  /** The parts of the lobby a message may change, copied before it changes them, so a failed save can undo them. */
  private lobbyBefore(lobby: LobbyRow): LobbySnapshot {
    return {
      row: structuredClone({
        settings: lobby.settings,
        seats: lobby.seats,
        ...(lobby.rev === undefined ? {} : { rev: lobby.rev }),
      }),
      requests: new Map(this.requests),
    };
  }

  /**
   * Runs one lobby change at a time. A grant awaits a hash (not storage, so no input gate holds), and a rollback after
   * a failed save must never overwrite what an overlapping change did, so every lobby mutation and its save is one turn.
   */
  private lobbyLock<T>(run: () => Promise<T>): Promise<T> {
    const turn = this.lobbyTurn.then(run, run);
    this.lobbyTurn = turn.then(
      () => undefined,
      () => undefined,
    );
    return turn;
  }

  /**
   * Saves the lobby row, the commit point of a lobby change: nothing that depends on the change (a seat token, the
   * broadcast) goes out before this returns true. When the put fails the lobby in memory goes back to `before`, so the
   * room never holds a seat or a token hash the stored row lacks, and the caller refuses.
   */
  private async saveLobby(before: LobbySnapshot): Promise<boolean> {
    const lobby = this.lobby;
    if (!lobby) return false;
    // Under the lobby lock the revision in memory is the stored one, so each save is strictly one higher.
    lobby.rev = (lobby.rev ?? 0) + 1;
    try {
      await this.storage.put("lobby", lobby);
    } catch {
      lobby.settings = before.row.settings;
      lobby.seats = before.row.seats;
      if (before.row.rev === undefined) delete lobby.rev;
      else lobby.rev = before.row.rev;
      this.requests.clear();
      for (const [id, list] of before.requests) this.requests.set(id, list);
      return false;
    }
    return true;
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
    return { code: this.meta?.code ?? "", rev: lobby.rev ?? 0, settings: lobby.settings, seats };
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
    const header = await this.storage.get<{ h: unknown; g?: string; sg?: number }>(headerKey(table.id));
    if (header) {
      const rows = await this.storage.list<StoredChunk>({ prefix: `${table.id}:c:` });
      const commands: unknown[] = [];
      const checksums: Record<string, string> = {};
      let bytes = 0;
      let persisted = 0;
      // Chunks count only while they run gapless from 0: a missing index ends them, so a hole never shifts the log.
      for (const [key, chunk] of rows) {
        if (key !== chunkKey(table.id, persisted) || chunk.sg !== header.sg) break;
        commands.push(...chunk.commands);
        Object.assign(checksums, chunk.checksums);
        // Recount rather than trust a stored figure, which an older build wrote in UTF-16 units.
        bytes += sizeOfAll(chunk.commands);
        persisted += 1;
      }
      table.header = header.h;
      table.hasHeader = true;
      table.gid = header.g;
      table.storeGen = header.sg;
      table.committedGid = header.g;
      table.commands = commands;
      table.checksums = checksums;
      table.bytes = bytes;
      table.persisted = persisted;
      const tail = await this.storage.get<{
        commands: unknown[];
        checksums: Record<string, string>;
        at?: number;
        from?: number;
        sg?: number;
      }>(tailKey(table.id));
      table.rewindWatchers = true;
      // The tail row says where it starts: a chunk may have landed over it (its delete failed), so the overlap is
      // skipped, and a tail that starts past what the chunks hold (a hole) is ignored. A row from an older build has no
      // `from`: it started after every chunk row then stored, so those rows count (not only the gapless ones).
      const tailFrom = tail ? (tail.from ?? rows.size * ROOM_CHUNK_COMMANDS) : 0;
      // A tail of another generation belongs to a game the stored header replaced.
      if (tail && tail.sg === header.sg && tailFrom <= commands.length) {
        table.tailAt = tail.at;
        const fresh = tail.commands.slice(commands.length - tailFrom);
        table.commands = [...table.commands, ...fresh];
        table.checksums = { ...table.checksums, ...tail.checksums };
        table.bytes += sizeOfAll(fresh);
      }
      table.tailStored = tail !== undefined;
    }
    table.ended = meta?.ended ?? false;
    table.outcome = meta?.outcome ?? null;
    table.overflow = meta?.overflow ?? false;
    table.loaded = true;
  }

  /**
   * Lowers the stored-chunk count to `keep` first, then deletes every stored chunk from `keep` up (found by listing,
   * so chunks a failed earlier delete left behind go too): a failed delete never leaves the count high.
   */
  private async dropChunks(table: Table, keep: number): Promise<void> {
    table.persisted = keep;
    const stored = await this.storage.list<StoredChunk>({ prefix: `${table.id}:c:`, start: chunkKey(table.id, keep) });
    const keys = [...stored.keys()];
    for (let i = 0; i < keys.length; i += 128) await this.storage.delete(keys.slice(i, i + 128));
  }

  /** Deletes the stored tail row, if there is one. */
  private async dropTail(table: Table): Promise<void> {
    // No tail row means no refresh clock: the next batch writes the new remainder at once.
    table.tailAt = undefined;
    if (!table.tailStored) return;
    await this.storage.delete(tailKey(table.id));
    table.tailStored = false;
  }

  /** Stores a replacement header that an earlier put failed to store; every write of the log's rows starts here. */
  private async repairHeader(table: Table): Promise<void> {
    if (!table.headerDirty) return;
    await this.storage.put(headerKey(table.id), {
      h: table.header,
      ...(table.gid !== undefined ? { g: table.gid } : {}),
      ...(table.storeGen !== undefined ? { sg: table.storeGen } : {}),
    });
    table.committedGid = table.gid;
    table.headerDirty = false;
  }

  /** Writes the unfinished tail (commands past the last frozen chunk, with their checksums), overwriting the last. */
  private async writeTail(table: Table): Promise<void> {
    const first = table.persisted * ROOM_CHUNK_COMMANDS;
    if (!table.loaded || !table.hasHeader) return;
    await this.repairHeader(table);
    if (table.commands.length <= first) return this.dropTail(table);
    await this.storage.put(tailKey(table.id), {
      from: first,
      ...(table.storeGen !== undefined ? { sg: table.storeGen } : {}),
      commands: table.commands.slice(first),
      checksums: this.checksumsIn(table, first, table.commands.length),
      at: this.clock(),
    });
    table.tailStored = true;
    table.tailAt = this.clock();
  }

  /** Writes every chunk that has filled since the last write, each once. */
  private async persistChunks(table: Table): Promise<void> {
    await this.repairHeader(table);
    let entries: Record<string, StoredChunk> = {};
    let count = 0;
    let wrote = false;
    // `table.persisted` moves only once a put has landed: a failed write must not leave a counted chunk that was
    // never stored (the tail would then start past a hole).
    let next = table.persisted;
    while (table.commands.length >= (next + 1) * ROOM_CHUNK_COMMANDS) {
      const n = next;
      const first = n * ROOM_CHUNK_COMMANDS;
      const commands = table.commands.slice(first, first + ROOM_CHUNK_COMMANDS);
      const checksums: Record<string, string> = {};
      for (const [key, sum] of Object.entries(table.checksums)) {
        const at = Number(key);
        if ((first === 0 ? at >= 0 : at > first) && at <= first + ROOM_CHUNK_COMMANDS) checksums[key] = sum;
      }
      entries[chunkKey(table.id, n)] = {
        commands,
        checksums,
        bytes: sizeOfAll(commands),
        ...(table.storeGen !== undefined ? { sg: table.storeGen } : {}),
      };
      next += 1;
      count += 1;
      wrote = true;
      if (count === 100) {
        await this.storage.put(entries);
        table.persisted = next;
        entries = {};
        count = 0;
      }
    }
    if (count > 0) {
      await this.storage.put(entries);
      table.persisted = next;
    }
    // A tail row older than the chunks just written is superseded, even when the last flush ended on a 100-chunk
    // batch boundary (count is 0 then).
    if (wrote) await this.dropTail(table);
  }

  private tableOf(id: string): Table | undefined {
    return this.tables.get(id);
  }

  private hostOf(tableId: string): Participant | undefined {
    for (const p of this.participants.values()) if (p.role === "host" && p.table === tableId) return p;
    return undefined;
  }

  private info(table: Table): TableInfo {
    const held = table.unsaved || table.headerDirty;
    return {
      id: table.id,
      hostConnected: this.hostOf(table.id) !== undefined,
      // A header that is not stored yet is not a durable checkpoint: the room claims to hold nothing, so a host that
      // reconnects sends the whole log again instead of trusting memory.
      commands: held ? 0 : table.commands.length,
      ended: table.ended,
      // A header the room has not stored (`headerDirty`) counts only when an earlier one is durable (`committedGid`).
      hasHeader: table.hasHeader && (!table.headerDirty || table.committedGid !== undefined),
      // The admission id is the durable one: a replacement that is only in memory (`unsaved`, `headerDirty`) is no
      // admission yet, so a host whose game is a new admission sees none (and sends its start again), while a host
      // whose game is the committed one sees its own gid with `dirty` and a null checkpoint, and repairs its log.
      ...(table.hasHeader && (held ? table.committedGid : table.gid) !== undefined
        ? { gid: (held ? table.committedGid : table.gid)! }
        : {}),
      checkpoint: held ? null : this.checkpointOf(table),
      ...(held ? { dirty: true as const } : {}),
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
    this.broadcast({
      v: 1,
      ch: "room",
      kind: "roster",
      participants,
      watchers: participants.filter((p) => p.role === "watcher").length,
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
    let used = PART_ENVELOPE_BYTES + sizeOf(table.header);
    let index = 0;
    let first = true;
    do {
      const from = index;
      const part: unknown[] = [];
      while (index < commands.length) {
        const size = sizeOf(commands[index]) + 1;
        if (part.length > 0 && used + size > LOG_PART_BYTES) break;
        part.push(commands[index]);
        used += size;
        index += 1;
      }
      // The part's checksums ride in the same frame, so they count against its budget too.
      let checksums = this.checksumsIn(table, from, index);
      let sumBytes = sizeOf(checksums);
      while (part.length > 1 && used + sumBytes > LOG_PART_BYTES) {
        index -= 1;
        used -= sizeOf(part.pop()) + 1;
        checksums = this.checksumsIn(table, from, index);
        sumBytes = sizeOf(checksums);
      }
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
      used = PART_ENVELOPE_BYTES;
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
    if (message.ch === "room" && message.kind === "host-activity")
      return this.hostActivity(socket, participant, message);
    if (message.ch === "room") return this.lobbyMessage(socket, participant, message);
    if (message.kind === "propose") return this.refuse(socket, "not-allowed");
    const table = this.tableOf(message.table);
    if (participant.role !== "host" || participant.table !== message.table || !table) {
      return this.refuse(socket, "not-allowed");
    }
    const isLog = message.kind === "start" || message.kind === "log";
    if (bytes > this.limits.maxMessageBytes && !isLog) return this.refuse(socket, "too-large");
    await this.ensureLoaded(table);
    await this.touchHost();
    // A start or log built from a lobby revision is admitted in one lobby turn, from the revision check to the header
    // write: a grant in flight (it awaits a hash) saves its revision inside its own turn, so it either lands before the
    // check (the start is refused `lobby-changed`) or queues behind the install, never between the two (#881's
    // compare-and-swap). Everything else runs as before.
    if (isLog && "lobbyRev" in message && message.lobbyRev !== undefined) {
      await this.lobbyLock(async () => {
        // The host may have left while this waited.
        if (!this.participants.has(participant.id)) return;
        await this.game(socket, participant, table, message);
      });
      return;
    }
    await this.game(socket, participant, table, message);
  }

  private refuse(socket: RoomSocket, reason: Refusal): void {
    this.sendSocket(socket, { v: 1, ch: "room", kind: "refused", reason });
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
    if (meta && now - (meta.lastHostAt ?? meta.createdAt) >= STAMP_EVERY_MS) {
      await this.saveMeta({ lastHostAt: now });
      this.listingForce = true;
      this.scheduleListing();
    }
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
        // A write that fails here must not keep the host out: the room keeps the log in memory and retries.
        await this.writeTail(table).catch(() => undefined);
      }
    } else if (this.participants.size >= this.limits.maxParticipants) {
      this.refuse(socket, "full");
      socket.close(1013, "full");
      return;
    }

    // A replacement header the room could not store yet is retried before the welcome says what the room holds.
    await this.repairHeader(table).catch(() => undefined);

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
    this.broadcastRoster();
    if (lobbyRoom) await this.joinLobby(socket, you, seatHashes);
    this.scheduleListing();
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
    message: Exclude<ClientMessage, { ch: "room" } | { ch: "chat" } | { kind: "propose" }>,
  ): Promise<void> {
    switch (message.kind) {
      case "start": {
        // A retry of a start the room already admitted (its ack was lost): confirm it, change nothing. The lobby
        // revision has moved on since (Competitive's own side save advances it), which must not retire the game.
        // A start with the table's current gid and no lobbyRev (admission is over) is a same-game repair instead
        // (below) unless it changes nothing (an empty table with the same header): the log is replaced, the gid kept.
        const sameGame =
          message.gid !== undefined &&
          table.hasHeader &&
          table.gid === message.gid &&
          !table.unsaved &&
          !table.headerDirty;
        if (
          sameGame &&
          (message.lobbyRev !== undefined ||
            (table.commands.length === 0 && JSON.stringify(table.header) === JSON.stringify(message.header)))
        ) {
          this.sendSocket(socket, { v: 1, ch: "game", kind: "started", table: table.id, gid: message.gid });
          return;
        }
        // The host's game was built from lobby revision `lobbyRev`: if the lobby has moved on (a deck or seat change
        // got here first), refuse before anything is stored, so the host's game is never the room's table.
        if (message.lobbyRev !== undefined) {
          const lobby = await this.loadLobby();
          if (lobby && (lobby.rev ?? 0) !== message.lobbyRev) return this.refuse(socket, "lobby-changed");
        }
        // A message without a gid never erases the admitted one; a repair keeps it.
        const gid = message.gid ?? table.gid;
        // A lobby room hosts one game after another (a rematch): `start` on an ended table reopens it first. Any other
        // room's ended table stays ended.
        if (table.ended && this.meta?.code === undefined) return this.refuse(socket, "not-allowed");
        // The new admission is committed first, under the next generation: a failed put leaves the old game whole
        // (header, rows and lifecycle), and the old rows are deleted only once the new header is stored.
        const storeGen = (table.storeGen ?? 0) + 1;
        const wasEnded = table.ended;
        await this.storage.put(headerKey(table.id), {
          h: message.header,
          ...(gid !== undefined ? { g: gid } : {}),
          sg: storeGen,
        });
        const staleTail = table.tailStored;
        Object.assign(table, newTable(table.id), {
          header: message.header,
          hasHeader: true,
          gid,
          storeGen,
          committedGid: gid,
          loaded: true,
        });
        if (wasEnded) {
          this.reopenInMemory(table);
          this.lifecycleDirty = true;
        }
        // Clearing the old game is best effort: a row of the old generation is ignored by a load, and the new
        // game's own writes replace it. The reopened lifecycle stays dirty until its write lands.
        await this.flushLifecycle().catch(() => undefined);
        table.tailStored = staleTail;
        await this.dropTail(table).catch(() => undefined);
        await this.dropChunks(table, 0).catch(() => undefined);
        this.unverified = false;
        this.startedSeen = true;
        this.scheduleListing();
        this.resendAsked.delete(table.id);
        // The game has started: the host's setup status line is over.
        this.setActivity(null);
        this.broadcastLog(table, host.id);
        this.broadcastTable(table);
        this.sendSocket(socket, {
          v: 1,
          ch: "game",
          kind: "started",
          table: table.id,
          ...(gid !== undefined ? { gid } : {}),
        });
        return;
      }
      case "log": {
        const checksums = cleanChecksums(message.checksums);
        if (!checksums) return this.refuse(socket, "bad-message");
        // The same admitted game again (its ack was lost): confirm it and leave the log as it is.
        // A retry still carrying its lobbyRev, or one identical to the table, changes nothing; any other log with
        // the table's gid is a same-game repair (below) that keeps the gid.
        const sameGame =
          message.gid !== undefined &&
          table.hasHeader &&
          table.gid === message.gid &&
          !table.unsaved &&
          !table.headerDirty;
        if (
          sameGame &&
          (message.lobbyRev !== undefined ||
            (JSON.stringify(table.header) === JSON.stringify(message.header) &&
              JSON.stringify(table.commands) === JSON.stringify(message.commands) &&
              JSON.stringify(table.checksums) === JSON.stringify(checksums)))
        ) {
          this.sendSocket(socket, { v: 1, ch: "game", kind: "started", table: table.id, gid: message.gid });
          return;
        }
        // A replacement from a host whose game was never confirmed installs a header like `start` does.
        if (message.lobbyRev !== undefined) {
          const lobby = await this.loadLobby();
          if (lobby && (lobby.rev ?? 0) !== message.lobbyRev) return this.refuse(socket, "lobby-changed");
        }
        if (table.overflow) return this.refuse(socket, "too-large");
        const bytes = sizeOfAll(message.commands);
        if (bytes > this.limits.maxLogBytes) {
          this.refuse(socket, "too-large");
          await this.endTable(table, null, true);
          return;
        }
        // Cleared only once every write below has landed: until then a retry of this log is not "the same game".
        table.unsaved = true;
        table.storeGen = (table.storeGen ?? 0) + 1;
        table.header = message.header;
        table.hasHeader = true;
        this.startedSeen = true;
        this.scheduleListing();
        const gid = message.gid ?? table.gid;
        table.gid = gid;
        table.commands = [...message.commands];
        table.checksums = { ...checksums };
        table.persisted = 0;
        table.bytes = bytes;
        // A replacement log carries no outcome: an ended table reopens (outcome cleared, end alarm swapped for the idle
        // one) and the host's `end` follows if its game is still over, so the room never keeps an old outcome for a
        // new log. A game reopened and then ended again restarts the end grace period.
        const reopened = table.ended;
        if (reopened) this.reopenInMemory(table);
        this.unverified = false;
        this.resendAsked.delete(table.id);
        // The room now holds the new log, so watchers get it before any write that may fail.
        this.broadcastLog(table, host.id);
        this.broadcastTable(table);
        // The header stays dirty until its put lands: the welcome does not claim a checkpoint meanwhile, and the next
        // chunk or tail write, or the host leaving, stores it first.
        table.headerDirty = true;
        if (reopened) this.lifecycleDirty = true;
        try {
          await this.flushLifecycle();
        } finally {
          await this.repairHeader(table);
        }
        // The old log's rows go only now that the new header is stored (a failed put above leaves them whole).
        await this.dropTail(table);
        await this.dropChunks(table, 0);
        await this.persistChunks(table);
        // The replacement's unfinished tail must survive a wake too: chunks only hold complete 20-command runs.
        table.tailAt = undefined;
        await this.writeTail(table);
        table.unsaved = false;
        // The proof withheld while unsaved (`info`) is the room's to show now.
        this.broadcastTable(table);
        // The admission is acknowledged only once the log is saved.
        if (gid !== undefined) {
          this.sendSocket(socket, { v: 1, ch: "game", kind: "started", table: table.id, gid });
        }
        return;
      }
      case "commands": {
        const checksums = cleanChecksums(message.checksums);
        if (!checksums) return this.refuse(socket, "bad-message");
        if (table.overflow) return this.refuse(socket, "too-large");
        await this.flushLifecycle().catch(() => undefined);
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
        this.unverified = false;
        this.resendAsked.delete(table.id);
        // The batch is accepted in memory (the welcome counts it), so watchers get it before any write that may
        // fail: a rejected put must not leave a connected watcher behind with nothing to make it catch up.
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
        // A batch that fills a gap after the table ended (the end overtook a lost batch): watchers clear their ended
        // state on any batch, so the end follows it, once the room holds the log the end closed.
        if (table.ended) {
          this.broadcast({ v: 1, ch: "game", kind: "end", table: table.id, outcome: table.outcome }, host.id);
        }
        this.broadcastTable(table);
        await this.persistChunks(table);
        // A host that closes the app may never return to write the tail: refresh it while it streams, at most once a
        // minute, so an evicted room still has the commands past the last chunk.
        // The first batch of a table (or of a woken room with no stored tail) writes it at once, so a quiet host that
        // then hibernates and closes never leaves watchers an empty log; after that at most once a minute.
        // endTable stamped the tail when the table is already ended, so the refresh rule would skip this batch: save it.
        if (table.ended || table.tailAt === undefined || this.clock() - table.tailAt >= TAIL_REFRESH_MS) {
          await this.writeTail(table);
        }
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
          await this.dropChunks(table, keep);
        }
        table.commands.length = message.to;
        for (const key of Object.keys(table.checksums)) if (Number(key) > message.to) delete table.checksums[key];
        table.bytes = sizeOfAll(table.commands);
        // An Undo past the end reopens the game: the end alarm is cancelled and the idle one re-armed.
        // A rewind to the current count reopens too: a resumed host whose game is not over says so that way.
        const reopened = table.ended;
        if (reopened) this.reopenInMemory(table);
        // The room holds the cut log, so watchers are told before any write that may fail.
        this.broadcast({ v: 1, ch: "game", kind: "rewind", table: table.id, to: message.to }, host.id);
        this.broadcastTable(table);
        // What remains of the cut chunk is the new tail: store it, or an evicted room would serve only the frozen chunks.
        if (reopened) this.lifecycleDirty = true;
        try {
          if (cut) await this.writeTail(table);
        } finally {
          // Reopening is stored whether or not the tail write landed, so the old end alarm cannot close a resumed room.
          await this.flushLifecycle();
        }
        return;
      }
      case "end": {
        await this.endTable(table, message.outcome ?? null, false);
        return;
      }
    }
  }

  private reopenInMemory(table: Table): void {
    table.ended = false;
    table.outcome = null;
    table.overflow = false;
  }

  /**
   * The room's lifecycle (meta and alarm) is not stored yet: whatever the tables say now is retried on every host
   * message and at the alarm until it lands. It is state, not an intent, so a later end supersedes a pending reopen.
   */
  private lifecycleDirty = false;

  private async flushLifecycle(): Promise<void> {
    if (!this.lifecycleDirty || !this.meta) return;
    const tables = [...this.tables.values()];
    if (tables.every((t) => t.ended)) {
      // The end is stored only after the log it closed: a failed tail write leaves the game open in storage (and this
      // dirty), so a wake never serves a finished game with a truncated log; the host's retry completes it.
      for (const t of tables) await this.writeTail(t);
      const first = tables[0]!;
      const endedAt = this.meta.endedAt ?? this.clock();
      this.meta = {
        ...this.meta,
        ended: true,
        outcome: first.outcome,
        endedAt,
        ...(tables.some((t) => t.overflow) ? { overflow: true } : {}),
      };
      await this.storage.put("meta", this.meta);
      await this.storage.setAlarm(endedAt + ROOM_END_GRACE_MS);
    } else {
      const { endedAt: _endedAt, ...rest } = this.meta;
      this.meta = { ...rest, ended: false, outcome: null, overflow: false };
      await this.storage.put("meta", this.meta);
      const last = Math.max(this.lastHostMessageAt ?? 0, this.meta.lastHostAt ?? this.meta.createdAt);
      await this.storage.setAlarm(last + ROOM_IDLE_MS);
      this.scheduleListing();
    }
    this.lifecycleDirty = false;
  }

  /** Ends a table once: a second `end` writes and changes nothing. */
  private async endTable(table: Table, outcome: unknown, overflow: boolean): Promise<void> {
    if (table.ended) {
      await this.flushLifecycle().catch(() => undefined);
      return;
    }
    table.ended = true;
    table.outcome = outcome;
    if (overflow) table.overflow = true;
    this.broadcast({ v: 1, ch: "game", kind: "end", table: table.id, outcome });
    this.broadcastTable(table);
    const now = this.clock();
    // A pending reopen is superseded: the lifecycle written is whatever the tables say now (ended, with this outcome).
    if (this.meta) this.meta = { ...this.meta, endedAt: now };
    this.lifecycleDirty = true;
    // The game is over and the host may never come back: the flush stores the tail, then the end.
    await this.flushLifecycle();
  }

  // ----------------------------------------------------------------------------------------------------------
  // Lobby: settings, seats and chat (docs/live-game-rooms.md section 8)

  private sameBuild(build: RoomBuild | undefined, settings: LobbySettings): boolean {
    // A host that sent no build leaves the versions empty, which nobody matches: seats stay closed.
    return (
      build !== undefined &&
      settings.appVersion !== "" &&
      build.appVersion === settings.appVersion &&
      build.contentVersion === settings.contentVersion &&
      // The rules fingerprint decides when both sides have one; an older client sends none, so only versions count.
      (!build.rules || !settings.rules || build.rules === settings.rules)
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
   * Gives the seat to the participant: a new token (only its hash is stored) is returned as a send for the caller to run
   * once the lobby row holding its hash is saved. The caller has checked everything; this changes memory only, so the
   * caller saves, then sends the token and broadcasts.
   */
  private async grant(seat: StoredSeat, who: Participant): Promise<() => void> {
    const token = newSeatToken();
    // A change of holder clears the previous holder's own deck; the host's preset stays.
    if (seat.holder !== who.id && !seat.deckPreset) delete seat.deck;
    // Holder first: the hash below is an await, and a second message must already see the seat taken.
    seat.holder = who.id;
    seat.holderName = who.name ?? "";
    this.dropRequest(seat.id, who.id);
    seat.tokenHash = await sha256Hex(token);
    return () => this.sendTo(who.id, { v: 1, ch: "room", kind: "seat-token", seat: seat.id, token });
  }

  /**
   * A participant has joined a lobby room: stamps the host's build into the settings, puts the participant back in the
   * seats its tokens open, then sends the lobby (everyone when it changed, else just the joiner) and the chat backlog.
   */
  private joinLobby(socket: RoomSocket, you: Participant, seatHashes: readonly string[]): Promise<void> {
    return this.lobbyLock(() => this.joinLobbyLocked(socket, you, seatHashes));
  }

  private async joinLobbyLocked(socket: RoomSocket, you: Participant, seatHashes: readonly string[]): Promise<void> {
    if (!this.participants.has(you.id)) return;
    const lobby = await this.loadLobby();
    if (!lobby) return;
    const before = this.lobbyBefore(lobby);
    let changed = false;
    if (you.role === "host" && you.build) {
      const { appVersion, contentVersion, rules } = you.build;
      if (
        lobby.settings.appVersion !== appVersion ||
        lobby.settings.contentVersion !== contentVersion ||
        lobby.settings.rules !== (rules || undefined)
      ) {
        const { rules: _old, ...rest } = lobby.settings;
        lobby.settings = { ...rest, appVersion, contentVersion, ...(rules ? { rules } : {}) };
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
      changed = true;
    }
    if (changed) {
      // A failed save leaves the lobby as it was: the joiner is told, and its token reclaims the seat on its next reconnect.
      if (!(await this.saveLobby(before))) {
        // Nothing was committed. The joiner is told and sent the lobby as it is, so its view and its kept tokens agree.
        this.refuse(socket, "not-saved");
        this.sendSocket(socket, { v: 1, ch: "room", kind: "lobby", ...this.lobbyState(lobby) });
      } else this.broadcastLobby(lobby);
    } else {
      this.sendSocket(socket, { v: 1, ch: "room", kind: "lobby", ...this.lobbyState(lobby) });
    }
    await this.loadBacklog();
    if (lobby.settings.chat && this.backlog.length > 0) {
      this.sendSocket(socket, { v: 1, ch: "chat", kind: "backlog", lines: [...this.backlog] });
    }
    if (this.activity) this.sendSocket(socket, { v: 1, ch: "room", kind: "host-activity", ...this.activity });
  }

  /** Loads the stored chat backlog once per lifetime; lines said since the wake (already in memory) stay last. */
  private async loadBacklog(): Promise<void> {
    this.backlogLoad ??= (async () => {
      const stored = await this.storage.get<ChatLine[]>("chat");
      if (stored && stored.length > 0) this.backlog = [...stored, ...this.backlog].slice(-CHAT_BACKLOG_LINES);
    })();
    return this.backlogLoad;
  }

  /**
   * The host's setup step, relayed to everyone as a status line. Memory only: no row, no lobby revision. Rate limited
   * per host (over the limit is dropped, not refused); an unchanged step is not relayed again.
   */
  private hostActivity(
    socket: RoomSocket,
    who: Participant,
    message: Extract<ClientMessage, { kind: "host-activity" }>,
  ): void {
    if (who.role !== "host" || this.meta?.code === undefined) return this.refuse(socket, "not-allowed");
    const scenario = message.scenario ? clip(cleanText(message.scenario), MAX_ACTIVITY_SCENARIO_CHARS) : "";
    const next = message.step === "idle" ? null : { step: message.step, ...(scenario ? { scenario } : {}) };
    // An unchanged step costs nothing; an `idle` always goes through (guests must not keep a stale line); over the
    // limit, the update is dropped quietly (the host's next step replaces it), not refused.
    if (JSON.stringify(next) === JSON.stringify(this.activity)) {
      this.dropPendingActivity();
      return;
    }
    if (next === null) return this.setActivity(null);
    if (!takeToken(this.activityBucket, who.id, HOST_ACTIVITY_BURST, 1, this.clock())) {
      // Kept (the newest wins) and relayed when the bucket has refilled; the host is not told.
      this.pendingActivity = { who: who.id, step: next };
      this.pendingTimer ??= setTimeout(() => this.flushActivity(), 1000);
      return;
    }
    this.pendingActivity = null;
    this.setActivity(next);
  }

  private flushActivity(): void {
    this.pendingTimer = null;
    const pending = this.pendingActivity;
    if (!pending || this.meta === null) return;
    if (!takeToken(this.activityBucket, pending.who, HOST_ACTIVITY_BURST, 1, this.clock())) {
      this.pendingTimer = setTimeout(() => this.flushActivity(), 1000);
      return;
    }
    this.pendingActivity = null;
    this.setActivity(pending.step);
  }

  private dropPendingActivity(): void {
    this.pendingActivity = null;
    if (this.pendingTimer !== null) clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
  }

  /** Sets (or clears) the host activity and tells everyone when it changed. */
  private setActivity(next: { step: HostActivityStep; scenario?: string } | null): void {
    if (next === null) this.dropPendingActivity();
    if (JSON.stringify(next) === JSON.stringify(this.activity)) return;
    this.activity = next;
    this.scheduleListing();
    this.broadcast({ v: 1, ch: "room", kind: "host-activity", ...(next ?? { step: "idle" }) });
  }

  /** A participant left: whatever seats it asked for are no longer asked for. Its held seats stay, for a token rejoin. */
  private withdrawRequests(id: string): Promise<void> {
    // Under the lock, so a rollback never restores a request a leaving participant withdrew.
    return this.lobbyLock(() => this.withdrawRequestsLocked(id));
  }

  private async withdrawRequestsLocked(id: string): Promise<void> {
    const lobby = await this.loadLobby();
    if (!lobby) return;
    let changed = false;
    for (const seat of lobby.seats) if (this.dropRequest(seat.id, id)) changed = true;
    // Requests live in memory: nothing to store.
    if (changed) this.broadcastLobby(lobby);
  }

  private lobbyMessage(
    socket: RoomSocket,
    who: Participant,
    message: Exclude<Extract<ClientMessage, { ch: "room" }>, { kind: "hello" | "room-close" | "host-activity" }>,
  ): Promise<void> {
    return this.lobbyLock(() => this.lobbyMessageLocked(socket, who, message));
  }

  private async lobbyMessageLocked(
    socket: RoomSocket,
    who: Participant,
    message: Exclude<Extract<ClientMessage, { ch: "room" }>, { kind: "hello" | "room-close" | "host-activity" }>,
  ): Promise<void> {
    // A turn that waited for the lock may belong to a participant who has left since: it must not add a request.
    if (!this.participants.has(who.id)) return;
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
    const before = this.lobbyBefore(lobby);
    // Seat tokens wait here until the lobby row that holds their hashes is saved.
    const tokens: Array<() => void> = [];
    const seatOf = (id: string) => lobby.seats.find((seat) => seat.id === id);
    const free = (seat: StoredSeat) => {
      delete seat.holder;
      delete seat.holderName;
      delete seat.tokenHash;
      // The holder's own deck goes with them (the next holder brings theirs); the host's preset stays, and one the
      // holder had replaced comes back.
      if (!seat.deckPreset) {
        delete seat.deck;
        if (seat.presetDeck) {
          seat.deck = seat.presetDeck;
          seat.deckPreset = true;
        }
        delete seat.presetDeck;
      }
    };
    // Only a change of holder, or the host setting the lobby, is stored. A request or its withdrawal is memory only.
    let persist = false;
    let clearChat = false;

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
          ...(message.settings?.chat !== undefined ? { chat: message.settings.chat } : {}),
          ...(message.settings?.listed !== undefined ? { listed: message.settings.listed } : {}),
        };
        let seats = lobby.seats;
        if (message.seats) {
          const ids = new Set(message.seats.map((s) => s.id));
          if (ids.size !== message.seats.length) return this.refuse(socket, "bad-message");
          // A seat id that stays keeps its holder, requests and token; its label may change; a removed one is gone.
          seats = message.seats.map((spec) => {
            const kept = lobby.seats.find((s) => s.id === spec.id);
            const label = spec.label === undefined ? {} : { label: spec.label };
            if (!kept) return { id: spec.id, ...label };
            const { label: _old, ...rest } = kept;
            return { ...rest, ...label };
          });
        }
        if (!next.multiSeat) {
          // Turning multi-seat off cannot quietly take a seat from someone who holds two.
          const counts = new Map<string, number>();
          for (const seat of seats) if (seat.holder) counts.set(seat.holder, (counts.get(seat.holder) ?? 0) + 1);
          if ([...counts.values()].some((n) => n > 1)) return this.refuse(socket, "multi-seat");
        }
        if (settings.chat && !next.chat) {
          // Chat turned off: the stored lines go with it, so a later turn-on starts clean.
          clearChat = true;
        }
        if (settings.listed === true && next.listed !== true) this.removalOwed = true;
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
        if (seat.holder === who.id) return; // Already theirs.
        if (seat.holder) return this.refuse(socket, "seat-taken");
        if (!settings.multiSeat && this.seatsHeldBy(lobby, who.id) > 0) return this.refuse(socket, "multi-seat");
        if (isHost) {
          // The host approves their own request.
          tokens.push(await this.grant(seat, who));
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
          free(seat);
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
        if (seat.holder && seat.holder !== target.id) return this.refuse(socket, "seat-taken");
        if (seat.holder === target.id) return;
        if (!settings.multiSeat && this.seatsHeldBy(lobby, target.id) > 0) return this.refuse(socket, "multi-seat");
        tokens.push(await this.grant(seat, target));
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
      if (!(await this.saveLobby(before))) {
        // Nothing was committed: no token goes out and the lobby in memory is as it was. The sender is told to retry.
        this.refuse(socket, "not-saved");
        this.broadcastLobby(lobby);
        return;
      }
      for (const send of tokens) send();
      if (clearChat) {
        // Only once the lobby that turned chat off is stored: a failed save leaves the lines where they were.
        this.backlog = [];
        this.backlogLoad = Promise.resolve();
        try {
          await this.storage.delete("chat");
        } catch {
          // The lobby is saved; stale lines in the chat row are cleared by the next chat write, so go on to the broadcast.
        }
      }
    }
    this.broadcastLobby(lobby);
    this.scheduleListing();
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
    await this.loadBacklog();
    this.backlog.push(line);
    if (this.backlog.length > CHAT_BACKLOG_LINES) this.backlog.splice(0, this.backlog.length - CHAT_BACKLOG_LINES);
    // One small bounded row (50 lines of at most 280 characters), written with each line.
    await this.storage.put("chat", this.backlog);
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
    this.deckBuckets.delete(participant.id);
    this.activityBucket.delete(participant.id);
    this.broadcastRoster();
    // The host leaving ends its setup status line and its listing.
    if (participant.role === "host") this.setActivity(null);
    this.scheduleListing();
    if (participant.role === "host" && participant.table) {
      const table = this.tableOf(participant.table);
      this.resendAsked.delete(participant.table);
      if (table) {
        this.broadcastTable(table);
        await this.writeTail(table);
        // A pending end follows the tail it was waiting for.
        await this.flushLifecycle();
      }
    }
    await this.withdrawRequests(participant.id);
  }

  /**
   * The alarm: the room closes 12 hours after the last host message (the stored hourly stamp, or the newer one in
   * memory), or 5 minutes after every table ended. When the time has not come the alarm moves out, one row.
   */
  async alarm(now: number): Promise<"closed" | "rescheduled" | "gone"> {
    await this.flushLifecycle().catch(() => undefined);
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
    if (this.listingTimer !== null) clearTimeout(this.listingTimer);
    this.listingTimer = null;
    if (meta?.code && this.directoryHooks && (this.listedKey !== null || (await this.loadLobby())?.settings.listed)) {
      try {
        await this.directoryHooks.remove(meta.code);
      } catch {
        // The directory entry expires on its own alarm.
      }
    }
    this.listedKey = null;
    this.removalOwed = false;
    this.startedSeen = false;
    if (meta?.code && meta.roomId) {
      try {
        await this.codeHooks?.release(meta.code, meta.roomId);
      } catch {
        // The directory entry expires on its own alarm.
      }
    }
    // After any lobby turn in flight, so it cannot write the lobby back into a closed room.
    await this.lobbyLock(async () => {
      await this.storage.deleteAlarm();
      await this.storage.deleteAll();
      this.meta = null;
      this.lobby = null;
      this.backlog = [];
      this.backlogLoad = Promise.resolve();
      this.activity = null;
      this.dropPendingActivity();
      this.activityBucket.clear();
      this.chatBuckets.clear();
      this.lobbyBuckets.clear();
      this.deckBuckets.clear();
      this.roomDeckBucket.clear();
      this.requests.clear();
    });
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
