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
  VILLAIN_CURSOR_BURST,
  VILLAIN_CURSOR_PER_SECOND,
  type VillainCursorState,
  type VillainPacing,
  LOBBY_MESSAGE_BURST,
  MAX_ACTIVITY_SCENARIO_CHARS,
  type HostActivityStep,
  type TablePlan,
  TABLE_PLAN_BURST,
  ROOM_CODE_MARGIN_MS,
  LIVE_PUBLISH_MIN_MS,
  type LiveRoomEntry,
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
  TEAMS,
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
  type TeamId,
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
export const LOBBY_ROOM_CAPS: readonly RoomCapability[] = ["watch", "chat", "seats", "play", "tables", "teams"];

/** The room's calls to its code's directory entry (`RoomCode`), made when it moves its expiry or closes. */
export interface RoomCodeHooks {
  refresh(code: string, roomId: string, expiresAt: number): Promise<void>;
  release(code: string, roomId: string): Promise<void>;
}

/** Proposal results kept per seat for a reconnect. */
const RESULT_LEDGER_SIZE = 32;
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
  handover: true,
  hostSeesHands: false,
  openHands: false,
  villainPacing: "host",
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
  team?: TeamId;
  holder?: string;
  holderName?: string;
  tokenHash?: string;
  takenOver?: boolean;
  showsHand?: boolean;
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
/**
 * A guest who claims a seat (no host approval, `askToSit` off) may claim again only after this long: a seat change
 * writes the lobby row, so a loop of take and leave must not turn into a stream of writes.
 */
const CLAIM_COOLDOWN_MS = 3_000;
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

/** Competitive rooms: which teams have a sealed scenario in the `sealed` row, which are ready, and whether it was revealed. */
interface CompetitiveRow {
  submitted: Record<TeamId, boolean>;
  ready: Record<TeamId, boolean>;
  /** While a game runs: the team each participant held at its start (or first took), so nobody switches sides. */
  sides?: Record<string, TeamId>;
  /** The host has been sent both scenarios (any change to teams or submissions takes this back); a `start` needs it. */
  revealed: boolean;
  /**
   * Bumped by every change a reveal depends on (team seats, holders, readiness, a scenario submission, settings, a
   * reset). Sent in the lobby and with the `sealed` answer, so the host can tell its reveal went stale.
   */
  rev?: number;
  /** The lobby revision a game admission saved the sides from; a retry of that same game's start/log resumes on it. */
  admitFrom?: number;
  /** The game (its gid) the reveal was admitted for; any other game is refused until a fresh reveal (the reset clears it). */
  consumedBy?: string;
}

/** The `sealed` row: each team's scenario, opaque. Read only by `sealed-reveal` and a submission; never broadcast. */
type SealedRow = Partial<Record<TeamId, unknown>>;

const SEALED_KEY = "sealed";
const newCompetitive = (previous?: CompetitiveRow): CompetitiveRow => ({
  submitted: { registration: false, resistance: false },
  ready: { registration: false, resistance: false },
  revealed: false,
  rev: (previous?.rev ?? 0) + 1,
});
const bumpRev = (comp: CompetitiveRow): void => {
  comp.rev = (comp.rev ?? 0) + 1;
};

interface LobbyRow {
  settings: LobbySettings;
  /** Competitive rooms only. */
  competitive?: CompetitiveRow;
  seats: StoredSeat[];
  /** Epic rooms only. */
  tables?: StoredTable[];
  pods?: LobbyPod[];
  /** Epic rooms: the table the organizer hosts, if any. */
  organizerTable?: string;
  /** Bumped by every stored change (settings, a seat's holder or deck); a row stored before it reads as 0. */
  rev?: number;
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
  /**
   * A replacement `log` is being staged: its rows are written under the next storage generation, in the other row
   * slot, and `headerDirty` stays set until they are all durable, so the header put is the single commit point. The
   * stored header (and the previous generation's rows in the other slot) stay whole until then.
   */
  staging: boolean;
  /**
   * While `staging`: the replaced game was over, so the staged commit also stores the reopened room lifecycle (meta),
   * in the same put as the header: a wake never sees the old game open or the new log closed.
   */
  reopening: boolean;
  /** While `staging`: the generation the stored header still points at (its rows are deleted once the switch commits). */
  priorGen: number | undefined;
  /** A tail row exists in storage (in the slot of `storeGen`). */
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
  /**
   * The log's epoch: bumped each time the log under the table is cut back, replaced or started over, so a receipt for
   * a command (a `proposal-accepted`) can be told apart from one for another log that had the same commands. Stored in
   * the header row, so it survives a wake.
   */
  epoch: number;
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
const byteSize = sizeOf;
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
  staging: false,
  reopening: false,
  priorGen: undefined,
  tailStored: false,
  tailAt: undefined,
  rewindWatchers: false,
  unverified: true,
  epoch: 0,
});

const randomId = (): string =>
  [...crypto.getRandomValues(new Uint8Array(5))].map((b) => b.toString(16).padStart(2, "0")).join("");

const headerKey = (table: string) => `${table}:header`;
/**
 * A table's chunk and tail rows live in one of two slots, chosen by the storage generation (odd or unset: the original
 * keys, even: the `b` keys). A replacement game is written to the other slot than the committed one, so the committed
 * game's rows survive untouched until the new header (the commit point) is stored.
 */
const slotOf = (sg: number | undefined): string => (sg !== undefined && sg % 2 === 0 ? "b:" : "");
const chunkPrefix = (table: string, sg: number | undefined) => `${table}:${slotOf(sg)}c:`;
const chunkKey = (table: string, n: number, sg: number | undefined) =>
  `${chunkPrefix(table, sg)}${String(n).padStart(6, "0")}`;
const tailKey = (table: string, sg: number | undefined) => `${table}:${slotOf(sg)}tail`;
/** The generation after `sg`; a header from before generations (no `sg`) used the original slot, so the next is `b`. */
const nextGen = (table: { hasHeader: boolean; storeGen: number | undefined }): number =>
  table.hasHeader && table.storeGen === undefined ? 2 : (table.storeGen ?? 0) + 1;
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
/** The lobby as it was before a change: what a failed save puts back. */
interface LobbySnapshot {
  readonly row: LobbyRow;
  readonly requests: Map<string, string[]>;
  /** The sealed scenarios in memory (a Competitive room); replaced, never edited in place, so the reference is a copy. */
  readonly sealed: SealedRow | undefined;
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

/** The host's villain phase screen as the room keeps it (`villain-cursor`). */
interface VillainCursor {
  readonly key: string;
  readonly at: number;
  readonly state: VillainCursorState;
}

const sameCursor = (a: VillainCursor, b: VillainCursor): boolean =>
  a.key === b.key && a.at === b.at && a.state === b.state;

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
   * The host's proposal results per seat id (last `RESULT_LEDGER_SIZE`), kept so a seat's holder who reconnects (a new
   * participant id, the seat reclaimed by its token) still gets the answer. Memory only; cleared when the seat changes hands.
   */
  private readonly resultLedger = new Map<string, ServerMessage[]>();
  /** A participant id a seat was reclaimed from, to the id that holds it now, so an answer for the old id still arrives. */
  private readonly successors = new Map<string, string>();
  /**
   * Set when sockets were restored after a hibernation: the pending requests above were lost while the sockets stayed
   * open, so the first message handled sends everyone a fresh lobby and the clients ask again (they do on every lobby).
   */
  private woke = false;
  /** The tail of the lobby lock's queue. */
  private lobbyTurn: Promise<void> = Promise.resolve();
  /** A Competitive start passed its lobby turn and has not installed the header yet: the table counts as live. */
  private competitiveStarting = false;
  /** A game ended but the Competitive reset (spent scenarios, reveal) was not saved: the next start retries it first. */
  private competitiveResetPending = false;
  /** Lobby message rate: a bucket per participant (burst `LOBBY_MESSAGE_BURST`, 2 a second). Memory only. */
  private readonly lobbyBuckets = new Map<string, { tokens: number; at: number }>();
  /** `seat-deck` rate per participant, and for the whole room (every accepted deck rewrites the lobby row). Memory only. */
  private readonly deckBuckets = new Map<string, { tokens: number; at: number }>();
  /** When each participant last claimed a seat without approval (memory only; `CLAIM_COOLDOWN_MS`). */
  private readonly lastClaim = new Map<string, number>();
  private readonly roomDeckBucket = new Map<string, { tokens: number; at: number }>();
  /** Sealed submissions each write a row, so they have their own slower bucket. */
  private readonly sealedBuckets = new Map<string, { tokens: number; at: number }>();
  /** The lobby row, loaded on first use; null for a room without a code. */
  private lobby: LobbyRow | null | undefined;
  /** The sealed row, read once per lifetime when a submission or a reveal needs it. */
  private sealed: SealedRow | undefined;
  /** The last chat lines, oldest first. Mirrored in the one `chat` storage row; loaded on first use after a wake. */
  private backlog: ChatLine[] = [];
  /** The one in-flight (or finished) read of the stored backlog, so overlapping callers all wait for the same load. */
  private backlogLoad: Promise<void> | null = null;
  /** The host's current setup step (memory only, never part of the lobby revision), or null when none. */
  private activity: { step: HostActivityStep; scenario?: string } | null = null;
  /** The newest step that arrived over the limit: relayed once a token is free, so the last step is never lost. */
  private pendingActivity: { who: string; step: { step: HostActivityStep; scenario?: string } } | null = null;
  /**
   * The host's table plan, or null when none. Kept in its own storage row (`plan`), apart from the lobby row, so a woken
   * room still has it and it never touches the lobby revision a Start compares and swaps on.
   */
  private plan: TablePlan | null = null;
  /** The stored plan was read, or a newer one was set since the wake (so the stored one must not overwrite it). */
  private planLoad: Promise<void> | null = null;
  private readonly planBucket = new Map<string, { tokens: number; at: number }>();
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly activityBucket = new Map<string, { tokens: number; at: number }>();
  /** Each table host's villain phase cursor (memory only, never stored, no lobby revision): the newest. */
  private readonly cursors = new Map<string, VillainCursor>();
  /** The newest cursor per table that arrived over the limit: relayed once a token is free, so the last is never lost. */
  private readonly pendingCursors = new Map<string, { who: string; cursor: VillainCursor }>();
  private cursorTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly cursorBucket = new Map<string, { tokens: number; at: number }>();
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

  private competitive(): boolean {
    return this.lobby?.settings.mode === "competitive";
  }

  /** A game is running at the table (a Competitive room's teams, scenarios and mode are locked while it is). */
  private async gameLive(): Promise<boolean> {
    if (this.competitiveStarting) return true;
    const t = this.tables.get(FIRST_TABLE);
    if (!t) return false;
    await this.ensureLoaded(t);
    return t.hasHeader && !t.ended;
  }

  /** Whether the participant holds a seat on the other team than `team` (a Competitive player is on one team). */
  private holdsOtherTeam(lobby: LobbyRow, id: string, seatId: string, team: TeamId | undefined): boolean {
    return (
      lobby.settings.mode === "competitive" &&
      team !== undefined &&
      lobby.seats.some((s) => s.holder === id && s.id !== seatId && s.team !== undefined && s.team !== team)
    );
  }

  /** Records who is on which team (the holders now), so a running game's sides cannot be swapped. */
  private noteSides(lobby: LobbyRow): void {
    const comp = lobby.competitive;
    if (!comp) return;
    const sides: Record<string, TeamId> = { ...comp.sides };
    for (const seat of lobby.seats) if (seat.holder && seat.team) sides[seat.holder] ??= seat.team;
    comp.sides = sides;
  }

  /** During a Competitive game: this participant already played the other team, and may not take a seat on `team`. */
  private async switchesSide(lobby: LobbyRow, id: string, team: TeamId | undefined): Promise<boolean> {
    if (!lobby.competitive || team === undefined || !(await this.gameLive())) return false;
    const was = lobby.competitive.sides?.[id];
    return was !== undefined && was !== team;
  }

  private async loadSealed(): Promise<SealedRow> {
    this.sealed ??= (await this.storage.get<SealedRow>(SEALED_KEY)) ?? {};
    return this.sealed;
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

  /** The parts of the lobby a message may change, copied before it changes them, so a failed save can undo them. */
  private lobbyBefore(lobby: LobbyRow): LobbySnapshot {
    return {
      row: structuredClone({
        settings: lobby.settings,
        seats: lobby.seats,
        ...(lobby.tables === undefined ? {} : { tables: lobby.tables }),
        ...(lobby.pods === undefined ? {} : { pods: lobby.pods }),
        ...(lobby.organizerTable === undefined ? {} : { organizerTable: lobby.organizerTable }),
        ...(lobby.competitive === undefined ? {} : { competitive: lobby.competitive }),
        ...(lobby.rev === undefined ? {} : { rev: lobby.rev }),
      }),
      requests: new Map(this.requests),
      sealed: this.sealed,
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
   * Runs `run` as a lobby turn, or directly when the caller already holds the turn (the promise-chain lock is not
   * re-entrant: a nested `lobbyLock` would wait on the turn it is inside, forever).
   */
  private lobbyTurn_<T>(held: boolean, run: () => Promise<T>): Promise<T> {
    return held ? run() : this.lobbyLock(run);
  }

  /**
   * Saves the lobby row, the commit point of a lobby change: nothing that depends on the change (a seat token, the
   * broadcast) goes out before this returns true. When the put fails the lobby in memory goes back to `before`, so the
   * room never holds a seat or a token hash the stored row lacks, and the caller refuses.
   */
  private async saveLobby(before: LobbySnapshot, bump = true): Promise<boolean> {
    const lobby = this.lobby;
    if (!lobby) return false;
    // Under the lobby lock the revision in memory is the stored one, so each save is strictly one higher. A re-attach
    // (`bump` false) stores the new holder id without moving the revision: nothing a start judged has changed.
    if (bump) lobby.rev = (lobby.rev ?? 0) + 1;
    try {
      await this.storage.put("lobby", lobby);
    } catch {
      lobby.settings = before.row.settings;
      lobby.seats = before.row.seats;
      // Epic: the tables, pods and organizer's table go back too (the participants' roles and the table-host tokens
      // only change after a successful save, so there is nothing to undo there).
      // Competitive: the teams, readiness and reveal state, and the sealed scenarios in memory, go back with them.
      this.sealed = before.sealed;
      for (const key of ["tables", "pods", "organizerTable", "competitive"] as const) {
        if (before.row[key] === undefined) delete lobby[key];
        else (lobby as unknown as Record<string, unknown>)[key] = before.row[key];
      }
      this.syncTables(lobby);
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
    const competitive = lobby.settings.mode === "competitive" ? (lobby.competitive ?? newCompetitive()) : undefined;
    // The tie-break option is a Competitive setting: default on, and not shown in any other mode.
    const { tieBreaks: _tieBreaks, ...plain } = lobby.settings;
    const settingsOut: LobbySettings = {
      ...plain,
      handover: lobby.settings.handover !== false,
      hostSeesHands: lobby.settings.hostSeesHands === true,
      openHands: lobby.settings.openHands === true,
      // A lobby stored before the setting existed has none: the host leads, the new default.
      villainPacing: (lobby.settings.villainPacing === "each" ? "each" : "host") satisfies VillainPacing,
      ...(competitive ? { tieBreaks: lobby.settings.tieBreaks !== false } : {}),
    };
    return {
      code: this.meta?.code ?? "",
      rev: lobby.rev ?? 0,
      settings: settingsOut,
      seats,
      ...(tables ? { tables, pods: [...(lobby.pods ?? [])] } : {}),
      // Only flags: a team's scenario itself is never part of the lobby.
      ...(competitive
        ? {
            competitive: {
              teams: {
                registration: { submitted: competitive.submitted.registration, ready: competitive.ready.registration },
                resistance: { submitted: competitive.submitted.resistance, ready: competitive.ready.resistance },
              },
              rev: competitive.rev ?? 0,
            },
          }
        : {}),
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
    const header = await this.storage.get<{ h: unknown; g?: string; e?: number; sg?: number }>(headerKey(table.id));
    if (header) {
      if (typeof header.e === "number") table.epoch = header.e;
      const rows = await this.storage.list<StoredChunk>({ prefix: chunkPrefix(table.id, header.sg) });
      const commands: unknown[] = [];
      const checksums: Record<string, string> = {};
      let bytes = 0;
      let persisted = 0;
      // Chunks count only while they run gapless from 0: a missing index ends them, so a hole never shifts the log.
      for (const [key, chunk] of rows) {
        if (key !== chunkKey(table.id, persisted, header.sg) || chunk.sg !== header.sg) break;
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
      }>(tailKey(table.id, header.sg));
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

  /**
   * Lowers the stored-chunk count to `keep` first, then deletes every stored chunk from `keep` up (found by listing,
   * so chunks a failed earlier delete left behind go too): a failed delete never leaves the count high.
   */
  private async dropChunks(table: Table, keep: number): Promise<void> {
    table.persisted = keep;
    const stored = await this.storage.list<StoredChunk>({
      prefix: chunkPrefix(table.id, table.storeGen),
      start: chunkKey(table.id, keep, table.storeGen),
    });
    const keys = [...stored.keys()];
    for (let i = 0; i < keys.length; i += 128) await this.storage.delete(keys.slice(i, i + 128));
  }

  /** Deletes every chunk and the tail row of one generation's slot. */
  private async clearSlot(tableId: string, sg: number | undefined): Promise<void> {
    const stored = await this.storage.list<StoredChunk>({ prefix: chunkPrefix(tableId, sg) });
    const keys = [...stored.keys(), tailKey(tableId, sg)];
    for (let i = 0; i < keys.length; i += 128) await this.storage.delete(keys.slice(i, i + 128));
  }

  /** Deletes the stored tail row, if there is one. */
  private async dropTail(table: Table): Promise<void> {
    // No tail row means no refresh clock: the next batch writes the new remainder at once.
    table.tailAt = undefined;
    if (!table.tailStored) return;
    await this.storage.delete(tailKey(table.id, table.storeGen));
    table.tailStored = false;
  }

  /**
   * Stores a replacement header that is not stored yet; every write of the log's rows starts here. A staged
   * replacement writes its whole log (chunks, tail) under the new generation first and the header last, so a failure
   * anywhere before the header put leaves the previous generation intact and still the one a load follows.
   */
  private async repairHeader(table: Table): Promise<void> {
    if (!table.headerDirty) return;
    if (table.staging) {
      await this.clearSlot(table.id, table.storeGen);
      table.persisted = 0;
      table.tailStored = false;
      await this.writeChunks(table);
      table.tailAt = undefined;
      await this.writeTailRow(table);
    }
    const header = {
      h: table.header,
      ...(table.gid !== undefined ? { g: table.gid } : {}),
      e: table.epoch,
      ...(table.storeGen !== undefined ? { sg: table.storeGen } : {}),
    };
    // A table that ended again meanwhile leaves the lifecycle to its end (flushLifecycle); otherwise the reopened meta
    // is committed with the header, the single commit point.
    const reopenedMeta = table.staging && table.reopening && !table.ended ? this.reopenedMeta() : undefined;
    if (reopenedMeta) await this.storage.put({ [headerKey(table.id)]: header, meta: reopenedMeta });
    else await this.storage.put(headerKey(table.id), header);
    if (reopenedMeta) {
      this.meta = reopenedMeta;
      // This table's own end row (several tables) goes with the commit (a failed delete is retried by flushLifecycle, which is still dirty).
      if (this.tables.size > 1) await this.storage.delete(endKey(table.id)).catch(() => undefined);
    }
    table.reopening = false;
    table.committedGid = table.gid;
    table.headerDirty = false;
    if (table.staging) {
      table.staging = false;
      const prior = table.priorGen;
      table.priorGen = undefined;
      // The switch has committed: the previous game's rows are garbage now, and a failed delete only leaves rows that
      // a load ignores (another generation).
      await this.clearSlot(table.id, prior).catch(() => undefined);
    }
  }

  /** Writes the unfinished tail (commands past the last frozen chunk, with their checksums), overwriting the last. */
  private async writeTail(table: Table): Promise<void> {
    if (!table.loaded || !table.hasHeader) return;
    await this.repairHeader(table);
    await this.writeTailRow(table);
  }

  /** The tail row itself, without the header repair (a staged replacement writes it before its header). */
  private async writeTailRow(table: Table): Promise<void> {
    const first = table.persisted * ROOM_CHUNK_COMMANDS;
    if (table.commands.length <= first) return this.dropTail(table);
    await this.storage.put(tailKey(table.id, table.storeGen), {
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
    await this.writeChunks(table);
  }

  /** The chunk rows themselves, without the header repair. */
  private async writeChunks(table: Table): Promise<void> {
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
      entries[chunkKey(table.id, n, table.storeGen)] = {
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
          epoch: table.epoch,
          ...(commands.length > index ? { total: commands.length } : {}),
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
    if (message.ch === "room" && message.kind === "host-activity") return this.hostActivity(socket, who, message);
    if (message.ch === "room" && message.kind === "villain-cursor") return this.villainCursor(socket, who, message);
    if (message.ch === "room" && message.kind === "table-plan") return this.tablePlan(socket, who, message);
    if (message.ch === "room" && message.kind === "follow") return this.follow(socket, who, message.tables);
    if (message.ch === "room") return this.lobbyMessage(socket, who, message);
    if (message.kind === "propose" || message.kind === "request") return this.fromSeat(socket, who, message);
    if (
      message.kind === "proposal-refused" ||
      message.kind === "proposal-accepted" ||
      message.kind === "request-answer"
    ) {
      return this.answerSeat(socket, who, message);
    }
    const table = this.tableOf(message.table);
    if (who.role !== "host" || who.table !== message.table || !table) {
      return this.refuse(socket, "not-allowed");
    }
    // A phase's cursor belongs to the game it was shown in: a new game, a rewound one or a finished one has none.
    if (message.kind === "start" || message.kind === "rewind" || message.kind === "end") {
      this.clearCursor(message.table, participant.id);
    }
    const isLog = message.kind === "start" || message.kind === "log";
    if (bytes > this.limits.maxMessageBytes && !isLog) return this.refuse(socket, "too-large");
    // Several tables: the room's end needs every table's state, so a message-driven wake loads them all.
    if (this.tables.size > 1) for (const t of this.tables.values()) await this.ensureLoaded(t);
    else await this.ensureLoaded(table);
    await this.touchHost();
    // A start or log built from a lobby revision is admitted in one lobby turn, from the revision check to the header
    // write: a grant in flight (it awaits a hash) saves its revision inside its own turn, so it either lands before the
    // check (the start is refused `lobby-changed`) or queues behind the install, never between the two (#881's
    // compare-and-swap). Everything else runs as before.
    if (isLog && "lobbyRev" in message && message.lobbyRev !== undefined) {
      await this.lobbyLock(async () => {
        // The host may have left while this waited.
        if (!this.participants.has(who.id)) return;
        await this.game(socket, who, table, message, true);
      });
      return;
    }
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
    if (meta && now - (meta.lastHostAt ?? meta.createdAt) >= STAMP_EVERY_MS) {
      await this.saveMeta({ lastHostAt: now });
      this.listingForce = true;
      this.scheduleListing();
    }
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
    if (table) await this.writeTail(table).catch(() => undefined); // a failed write must not keep the new host out
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
    let tableHashes: string[] = [];
    if (!isRoomToken && lobby?.settings.mode === "epic" && lobby.tables && message.tableTokens?.length) {
      const hashes = await Promise.all(message.tableTokens.map(sha256Hex));
      tableHashes = hashes;
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

    // A replacement header the room could not store yet is retried before the welcome says what each table holds.
    for (const t of this.tables.values()) await this.repairHeader(t).catch(() => undefined);

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
    if (tokenTable !== undefined) {
      // The table was found before the lobby turn: a queued lobby-set may since have replaced the tables or rotated this
      // table's token, so the table and its hash are looked up again inside the turn. A token that no longer opens it,
      // or a host the row cannot record, leaves the joiner no host (two hosts of one table must not exist).
      const refusal = await this.lobbyLock(async (): Promise<Refusal | null> => {
        const current = this.lobby;
        const stored = current?.tables?.find((t) => t.id === tokenTable);
        if (!current || !stored || stored.hostTokenHash === undefined || !tableHashes.includes(stored.hostTokenHash)) {
          return "bad-table-host";
        }
        if (stored.host === you.id) return null;
        const before = this.lobbyBefore(current);
        stored.host = you.id;
        return (await this.saveLobby(before)) ? null : "not-saved";
      });
      if (refusal) {
        this.participants.delete(you.id);
        this.sockets.delete(you.id);
        try {
          socket.clearParticipant();
        } catch {
          // The socket is closing.
        }
        this.refuse(socket, refusal);
        socket.close(1013, "table host not saved");
        return;
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
    this.scheduleListing();
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

  /** Whether a host's `lobbyRev` no longer matches the lobby: any change since, except its own Competitive admission. */
  private lobbyRevStale(lobby: LobbyRow, lobbyRev: number, table: Table): boolean {
    const rev = lobby.rev ?? 0;
    if (rev === lobbyRev) return false;
    // The admission saved the sides (R to R+1) and then the table's write failed: the same game's retry, still carrying
    // R, resumes it. Any other lobby change moves the revision past R+1, so this stops matching.
    return !(
      lobby.competitive?.admitFrom === lobbyRev &&
      rev === lobbyRev + 1 &&
      (!table.hasHeader || table.unsaved || table.ended)
    );
  }

  /**
   * A Competitive game's admission, shared by `start` and `log` (run inside one lobby turn): a pending reset is retried
   * first, the reveal must stand, and the sides are saved (`admitFrom` records the revision they were saved from, so a
   * retry after a failed header write resumes instead of saving again). Marks the table starting until `game` ends.
   */
  private async admitCompetitive(
    lobbyRev: number | undefined,
    table: Table,
    gid: string | undefined,
  ): Promise<Refusal | null> {
    // A game ended but its reset was never saved: the old reveal and sealed row would replay spent scenarios.
    // Retry the reset now; the start then needs a fresh reveal, so it is refused either way.
    if (this.competitiveResetPending) return (await this.resetCompetitive()) ? "out-of-order" : "not-saved";
    const lobby = this.lobby;
    const comp = lobby?.competitive;
    const game = gid ?? table.gid ?? "";
    // The reveal was consumed by an admitted game (stored with the admission, so it outlives a wake): another game
    // needs fresh submissions and a fresh reveal. When that game has ended, its reset is finished here (a failed one
    // is not remembered across an eviction).
    if (comp?.consumedBy !== undefined && comp.consumedBy !== game) {
      if (table.ended && !(await this.resetCompetitive())) return "not-saved";
      return "out-of-order";
    }
    if (this.competitive() && comp?.revealed !== true) return "out-of-order";
    if (lobby && comp) {
      const resumed = lobbyRev !== undefined && comp.admitFrom === lobbyRev && (lobby.rev ?? 0) === lobbyRev + 1;
      if (!resumed) {
        const before = this.lobbyBefore(lobby);
        this.noteSides(lobby);
        comp.admitFrom = lobby.rev ?? 0;
        comp.consumedBy = game;
        if (!(await this.saveLobby(before))) return "not-saved";
      }
      // The table is live from here (its header lands outside this turn): a queued team change is refused.
      this.competitiveStarting = true;
    }
    return null;
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
    lockHeld = false,
  ): Promise<void> {
    try {
      await this.gameMessage(socket, host, table, message, lockHeld);
    } finally {
      // An admission's mark ends with its message: installed (the table is live itself now) or failed.
      this.competitiveStarting = false;
    }
  }

  private async gameMessage(
    socket: RoomSocket,
    host: Participant,
    table: Table,
    message: Exclude<
      ClientMessage,
      | { ch: "room" }
      | { ch: "chat" }
      | { kind: "propose" | "proposal-refused" | "proposal-accepted" | "request" | "request-answer" }
    >,
    lockHeld = false,
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
          if (lobby && this.lobbyRevStale(lobby, message.lobbyRev, table)) return this.refuse(socket, "lobby-changed");
        }
        // A Competitive game starts only after the host has had both teams' sealed scenarios (and nobody changed since).
        // Judged and saved inside the lobby turn, so a reveal or team change cannot land between the check and the write.
        const notStarted = await this.lobbyTurn_(lockHeld, () =>
          this.admitCompetitive(message.lobbyRev, table, message.gid),
        );
        if (notStarted) return this.refuse(socket, notStarted);
        try {
          // A message without a gid never erases the admitted one; a repair keeps it.
          const gid = message.gid ?? table.gid;
          // A lobby room hosts one game after another (a rematch): `start` on an ended table reopens it first. Any other
          // room's ended table stays ended.
          if (table.ended && this.meta?.code === undefined) return this.refuse(socket, "not-allowed");
          // The new admission is committed first, under the next generation: a failed put leaves the old game whole
          // (header, rows and lifecycle), and the old rows are deleted only once the new header is stored.
          const storeGen = nextGen(table);
          // A new game under the table: no result of the old one may settle a proposal against it, and its log is a new
          // epoch (stored in the header row, so it survives a wake).
          const epoch = table.epoch + 1;
          const wasEnded = table.ended;
          const oldGen = table.storeGen;
          const newHeader = {
            h: message.header,
            ...(gid !== undefined ? { g: gid } : {}),
            e: epoch,
            sg: storeGen,
          };
          if (wasEnded && this.meta) {
            // A rematch's header and its reopened lifecycle are one put: a wake never sees the new game next to the old
            // game's ended meta. (A stale end alarm is harmless: the alarm reads meta, finds it open and moves out.)
            await this.storage.put({ [headerKey(table.id)]: newHeader, meta: this.reopenedMeta() });
          } else {
            await this.storage.put(headerKey(table.id), newHeader);
          }
          this.dropResults(table, 0);
          Object.assign(table, newTable(table.id), {
            epoch,
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
          // This table's own end row (several tables) goes before the ack, so a wake does not find the rematch ended.
          if (wasEnded && this.tables.size > 1) await this.storage.delete(endKey(table.id));
          // The reopened meta is already durable with the header; the alarm swap (and the in-memory meta) is retried until
          // it lands. Clearing the old game is best effort: a row of another generation is ignored by a load.
          await this.flushLifecycle().catch(() => undefined);
          await this.clearSlot(table.id, oldGen).catch(() => undefined);
          await this.clearSlot(table.id, storeGen).catch(() => undefined);
          table.unverified = false;
          this.startedSeen = true;
          this.scheduleListing();
          this.resendAsked.delete(table.id);
          // The game has started: the host's setup status line is over.
          this.setActivity(null);
          this.setPlan(null);
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
        } finally {
          // Installed (hasHeader now says live) or failed (the table is not live, so the room is not either).
          this.competitiveStarting = false;
        }
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
          if (lobby && this.lobbyRevStale(lobby, message.lobbyRev, table)) return this.refuse(socket, "lobby-changed");
          // The same admission a `start` gets: a Competitive game needs its reveal, a settled reset and its sides saved.
          const notAdmitted = await this.lobbyTurn_(lockHeld, () =>
            this.admitCompetitive(message.lobbyRev, table, message.gid),
          );
          if (notAdmitted) return this.refuse(socket, notAdmitted);
        }
        if (table.overflow) return this.refuse(socket, "too-large");
        const bytes = sizeOfAll(message.commands);
        if (bytes > this.limits.maxLogBytes) {
          this.refuse(socket, "too-large");
          await this.endTable(table, null, true, lockHeld);
          return;
        }
        // Cleared only once every write below has landed: until then a retry of this log is not "the same game".
        table.unsaved = true;
        // The replacement is staged under the next generation (the other row slot) and committed by its header put; a
        // retry of a staged log reuses its generation, so the committed one's slot is never touched before the switch.
        if (!table.staging) {
          table.staging = true;
          table.priorGen = table.storeGen;
          table.storeGen = nextGen(table);
        }
        table.tailStored = false;
        table.header = message.header;
        table.hasHeader = true;
        this.startedSeen = true;
        this.scheduleListing();
        const gid = message.gid ?? table.gid;
        // A result for a position at or past where the replaced log first differs (all of them for another game) was
        // earned against a log that is gone: it may not settle a proposal against the new one.
        let firstDiff = 0;
        if (gid === table.gid) {
          while (
            firstDiff < table.commands.length &&
            firstDiff < message.commands.length &&
            JSON.stringify(table.commands[firstDiff]) === JSON.stringify(message.commands[firstDiff])
          ) {
            firstDiff++;
          }
        }
        this.dropResults(table, firstDiff);
        // The new epoch is stored with the header the repair below writes.
        if (gid !== table.gid || firstDiff < table.commands.length) table.epoch += 1;
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
        table.unverified = false;
        this.resendAsked.delete(table.id);
        // The room now holds the new log, so watchers get it before any write that may fail.
        this.broadcastLog(table, host.id);
        this.broadcastTable(table);
        // The header stays dirty until its put lands: the welcome does not claim a checkpoint meanwhile, and the next
        // chunk or tail write, or the host leaving, stores it first.
        table.headerDirty = true;
        if (reopened) {
          this.lifecycleDirty = true;
          table.reopening = true;
        }
        // The staged rows, the header and the reopened meta commit together (repairHeader); the alarm swap that follows
        // is best effort (a stale end alarm reads the open meta and moves out) and is retried by flushLifecycle.
        await this.repairHeader(table);
        await this.flushLifecycle().catch(() => undefined);
        // The header put committed the staged generation (its chunks and tail were written first, and the old log's
        // rows are deleted after), or it threw and the previous generation is still the stored game.
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
          this.sendGame(
            table.id,
            { v: 1, ch: "game", kind: "rewind", table: table.id, to: message.from, epoch: table.epoch },
            host.id,
          );
        }
        table.unverified = false;
        this.resendAsked.delete(table.id);
        // The batch is accepted in memory (the welcome counts it), so watchers get it before any write that may
        // fail: a rejected put must not leave a connected watcher behind with nothing to make it catch up.
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
        // A batch that fills a gap after the table ended (the end overtook a lost batch): watchers clear their ended
        // state on any batch, so the end follows it, once the room holds the log the end closed.
        if (table.ended) {
          this.sendGame(table.id, { v: 1, ch: "game", kind: "end", table: table.id, outcome: table.outcome }, host.id);
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
        // A held result for a command in the cut range (an acceptance a away seat never saw) must not come back and
        // credit whatever is played at that position next, even if it is byte-identical.
        this.dropResults(table, message.to);
        if (cut) await this.bumpEpoch(table);
        for (const key of Object.keys(table.checksums)) if (Number(key) > message.to) delete table.checksums[key];
        table.bytes = sizeOfAll(table.commands);
        // An Undo past the end reopens the game: the end alarm is cancelled and the idle one re-armed.
        // A rewind to the current count reopens too: a resumed host whose game is not over says so that way.
        const reopened = table.ended;
        if (reopened) this.reopenInMemory(table);
        // The room holds the cut log, so watchers are told before any write that may fail.
        this.sendGame(
          table.id,
          { v: 1, ch: "game", kind: "rewind", table: table.id, to: message.to, epoch: table.epoch },
          host.id,
        );
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

  /** The room's meta once its game is open again (no end, outcome or end time). */
  private reopenedMeta(): RoomMeta {
    const { endedAt: _endedAt, roomEndedAt: _roomEndedAt, ...rest } = this.meta!;
    // Several tables keep their ends in their own rows (flushLifecycle); the room-level fields are a single table's.
    return this.tables.size > 1 ? { ...rest } : { ...rest, ended: false, outcome: null, overflow: false };
  }

  /** A new epoch for the table's log (it was cut back, replaced or started over); stored before anyone is told. */
  private async bumpEpoch(table: Table): Promise<void> {
    table.epoch += 1;
    // A staged replacement's header is its commit point: it is written (with this epoch) only after its rows are durable.
    if (table.staging) return;
    await this.storage.put(headerKey(table.id), {
      h: table.header,
      ...(table.gid !== undefined ? { g: table.gid } : {}),
      e: table.epoch,
      // The rows stay this game's: a rewind is a new epoch, never a new storage generation.
      ...(table.storeGen !== undefined ? { sg: table.storeGen } : {}),
    });
  }

  /** Forgets the kept `proposal-accepted` / `proposal-refused` results for positions from `from` on (the cut or replaced log). */
  private dropResults(table: Table, from: number): void {
    for (const [seatId, ledger] of this.resultLedger) {
      const kept = ledger.filter(
        (m) =>
          !(m.ch === "game" && (m.kind === "proposal-accepted" || m.kind === "proposal-refused")) ||
          m.table !== table.id ||
          m.base < from,
      );
      if (kept.length === ledger.length) continue;
      if (kept.length === 0) this.resultLedger.delete(seatId);
      else this.resultLedger.set(seatId, kept);
    }
  }

  private reopenInMemory(table: Table): void {
    table.ended = false;
    table.outcome = null;
    table.overflow = false;
  }

  /**
   * The room's lifecycle (meta, each table's end row and the alarm) is not stored yet: whatever the tables say now is
   * retried on every host message and at the alarm until it lands. It is state, not an intent, so a later end supersedes
   * a pending reopen. Several tables: each table's end is its own row, and `roomEndedAt` says when the last one ended.
   */
  private lifecycleDirty = false;

  /** When each table ended in this lifetime (a table ended before a wake falls back to the flush time). */
  private readonly tableEndedAt = new Map<string, number>();

  private async flushLifecycle(): Promise<void> {
    if (!this.lifecycleDirty || !this.meta) return;
    // A replacement log still being staged commits its reopened lifecycle with its header: nothing earlier.
    if ([...this.tables.values()].some((t) => t.staging)) return;
    const tables = [...this.tables.values()];
    const multi = tables.length > 1;
    // A table's end (its own row, or the room's ended meta) is stored only after the log it closed: a failed tail write
    // leaves that game open in storage (and this dirty), so a wake never serves a finished game with a truncated log;
    // the host's retry completes it.
    for (const t of tables) if (t.ended) await this.writeTail(t);
    if (multi) {
      for (const t of tables) {
        if (t.ended) {
          await this.storage.put(endKey(t.id), {
            outcome: t.outcome,
            overflow: t.overflow,
            endedAt: this.tableEndedAt.get(t.id) ?? this.clock(),
          } satisfies StoredEnd);
        } else await this.storage.delete(endKey(t.id));
      }
    }
    if (tables.every((t) => t.ended)) {
      const first = tables[0]!;
      const endedAt = (multi ? this.meta.roomEndedAt : this.meta.endedAt) ?? this.clock();
      this.meta = multi
        ? { ...this.meta, roomEndedAt: endedAt }
        : {
            ...this.meta,
            ended: true,
            outcome: first.outcome,
            endedAt,
            ...(first.overflow ? { overflow: true } : {}),
          };
      await this.storage.put("meta", this.meta);
      await this.storage.setAlarm(endedAt + ROOM_END_GRACE_MS);
    } else {
      const { endedAt: _endedAt, roomEndedAt: _roomEndedAt, ...rest } = this.meta;
      this.meta = multi ? { ...rest } : { ...rest, ended: false, outcome: null, overflow: false };
      await this.storage.put("meta", this.meta);
      const last = Math.max(this.lastHostMessageAt ?? 0, this.meta.lastHostAt ?? this.meta.createdAt);
      await this.storage.setAlarm(last + ROOM_IDLE_MS);
      this.scheduleListing();
    }
    this.lifecycleDirty = false;
  }

  /** Ends a table once: a second `end` writes and changes nothing. */
  private async endTable(table: Table, outcome: unknown, overflow: boolean, lockHeld = false): Promise<void> {
    if (table.ended) {
      await this.flushLifecycle().catch(() => undefined);
      return;
    }
    table.ended = true;
    table.outcome = outcome;
    if (overflow) table.overflow = true;
    this.sendGame(table.id, { v: 1, ch: "game", kind: "end", table: table.id, outcome });
    this.broadcastTable(table);
    const now = this.clock();
    this.tableEndedAt.set(table.id, now);
    // A pending reopen is superseded: the lifecycle written is whatever the tables say now (ended, with this outcome).
    if (this.meta) {
      this.meta = this.tables.size > 1 ? { ...this.meta, roomEndedAt: now } : { ...this.meta, endedAt: now };
    }
    this.lifecycleDirty = true;
    // The game is over and the host may never come back: the flush stores the tail, then the end.
    await this.flushLifecycle();
    // A Competitive game is over: its scenarios are spent (a rematch builds and submits new ones).
    if (this.lobby?.competitive) {
      await this.lobbyTurn_(lockHeld, () => this.resetCompetitive());
    }
  }

  /**
   * Resets a Competitive room after its game: new scenarios and a fresh reveal. Runs in the lobby turn. A failed save
   * puts the old state back (the sealed row untouched) and marks the reset pending, so a rematch start is refused and
   * retries it; the reset lobby is broadcast once stored, and only then is the spent sealed row deleted (a stale row
   * that survives a failed delete is harmless: a reveal needs both teams to submit again).
   */
  private async resetCompetitive(): Promise<boolean> {
    const lobby = this.lobby;
    if (!lobby?.competitive) {
      this.competitiveResetPending = false;
      return true;
    }
    const before = this.lobbyBefore(lobby);
    lobby.competitive = newCompetitive(lobby.competitive);
    this.sealed = {};
    if (!(await this.saveLobby(before))) {
      this.competitiveResetPending = true;
      this.broadcastLobby(lobby);
      return false;
    }
    this.competitiveResetPending = false;
    this.broadcastLobby(lobby);
    try {
      await this.storage.delete(SEALED_KEY);
    } catch {
      // The stale row is overwritten by the next submissions.
    }
    return true;
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

  /** Whether the participant holds a seat at a table other than `tableId` (a participant plays at one table). */
  private holdsElsewhere(lobby: LobbyRow, id: string, tableId: string): boolean {
    return lobby.seats.some((seat) => seat.holder === id && this.seatTable(seat) !== tableId);
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
    if (seat.holder !== who.id) {
      this.resultLedger.delete(seat.id);
      delete seat.showsHand;
    }
    seat.holder = who.id;
    seat.holderName = who.name ?? "";
    delete seat.takenOver;
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
    // A seat its holder (same name, not away) takes back on a reconnect: only the participant id is new, so the lobby
    // is stored and sent but its revision stays, or a host's Start judged just before the drop is refused `lobby-changed`.
    let reattached = false;
    if (this.isOrganizer(you) && you.build) {
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
      if (this.holdsElsewhere(lobby, you.id, this.seatTable(seat))) {
        this.refuse(socket, "other-table");
        continue;
      }
      if (!lobby.settings.multiSeat && this.seatsHeldBy(lobby, you.id) > 0) {
        this.refuse(socket, "multi-seat");
        continue;
      }
      if (this.holdsOtherTeam(lobby, you.id, seat.id, seat.team)) {
        this.refuse(socket, "other-team");
        continue;
      }
      if (seat.holder !== undefined && seat.holderName === (you.name ?? "") && seat.left === undefined)
        reattached = true;
      else changed = true;
      if (seat.holder && seat.holder !== you.id) {
        this.successors.set(seat.holder, you.id);
        while (this.successors.size > 64) this.successors.delete(this.successors.keys().next().value as string);
      }
      seat.holder = you.id;
      seat.holderName = you.name ?? "";
      delete seat.left;
      // The results the host sent while this seat's holder was away (or whose socket died first).
      for (const result of this.resultLedger.get(seat.id) ?? []) this.sendSocket(socket, result);
    }
    if (changed || reattached) {
      // A failed save leaves the lobby as it was: the joiner is told, and its token reclaims the seat on its next reconnect.
      if (!(await this.saveLobby(before, changed))) {
        // Nothing was committed. The joiner is told and sent the lobby as it is, so its view and its kept tokens agree.
        this.refuse(socket, "not-saved");
        this.sendSocket(socket, { v: 1, ch: "room", kind: "lobby", ...this.lobbyState(lobby) });
      } else {
        this.broadcastRoster();
        this.broadcastLobby(lobby);
      }
    } else {
      this.sendSocket(socket, { v: 1, ch: "room", kind: "lobby", ...this.lobbyState(lobby) });
    }
    await this.loadBacklog();
    if (lobby.settings.chat && this.backlog.length > 0) {
      this.sendSocket(socket, { v: 1, ch: "chat", kind: "backlog", lines: [...this.backlog] });
    }
    if (this.activity) this.sendSocket(socket, { v: 1, ch: "room", kind: "host-activity", ...this.activity });
    // A joiner (or a guest that reconnected) is told where the host's villain phase screen is.
    if (you.role !== "host") {
      for (const [table, cursor] of this.cursors) {
        // An Epic room: only the tables this joiner follows (its own table's host leads it).
        if (!this.follows(you.id, table)) continue;
        this.sendSocket(socket, { v: 1, ch: "room", kind: "villain-cursor", table, ...cursor });
      }
    }
    await this.loadPlan();
    if (this.plan) this.sendSocket(socket, { v: 1, ch: "room", kind: "table-plan", plan: this.plan });
  }

  /** Loads the stored plan once per lifetime, unless a plan was set since the wake. */
  private loadPlan(): Promise<void> {
    this.planLoad ??= (async () => {
      const stored = await this.storage.get<TablePlan>("plan");
      if (stored && this.plan === null) this.plan = stored;
    })();
    return this.planLoad;
  }

  /**
   * The host's table plan, relayed to everyone and kept in its own row (never the lobby row or revision). Host only, rate limited
   * (over the limit is refused; the host's client sends its newest plan again on reconnect). An unchanged plan is not
   * relayed again, and a clear always goes through.
   */
  private async tablePlan(
    socket: RoomSocket,
    who: Participant,
    message: Extract<ClientMessage, { kind: "table-plan" }>,
  ): Promise<void> {
    if (who.role !== "host" || this.meta?.code === undefined) return this.refuse(socket, "not-allowed");
    await this.loadPlan();
    const incoming = message.plan;
    const next: TablePlan | null = incoming
      ? {
          scenarioId: incoming.scenarioId,
          modularSetIds: [...incoming.modularSetIds],
          difficulty: incoming.difficulty,
          ...(incoming.heroicLevel ? { heroicLevel: incoming.heroicLevel } : {}),
          ...(incoming.skirmish ? { skirmish: true } : {}),
        }
      : null;
    if (JSON.stringify(next) === JSON.stringify(this.plan)) return;
    if (next !== null && !takeToken(this.planBucket, who.id, TABLE_PLAN_BURST, 0.5, this.clock())) {
      return this.refuse(socket, "rate-limited");
    }
    this.setPlan(next);
  }

  private setPlan(next: TablePlan | null): void {
    if (JSON.stringify(next) === JSON.stringify(this.plan)) return;
    this.plan = next;
    // Stored only when it changes (a clear deletes the row); a failed write leaves memory right for this lifetime.
    this.planLoad ??= Promise.resolve();
    void (next ? this.storage.put("plan", next) : this.storage.delete("plan")).catch(() => undefined);
    this.broadcast({ v: 1, ch: "room", kind: "table-plan", plan: next });
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

  /**
   * The table host's villain phase cursor, relayed to everyone but the host (guests follow it when the lobby says the
   * host leads). Memory only: no row, no lobby revision. Rate limited per host; over the limit the newest is kept and
   * relayed when a token is free, never refused. An unchanged cursor is not relayed again. Only the host of the table
   * it names may send one.
   */
  private villainCursor(
    socket: RoomSocket,
    who: Participant,
    message: Extract<ClientMessage, { kind: "villain-cursor" }>,
  ): void {
    if (who.role !== "host" || who.table !== message.table || !this.tables.has(message.table)) {
      return this.refuse(socket, "not-allowed");
    }
    const next: VillainCursor = { key: message.key, at: message.at, state: message.state };
    const kept = this.cursors.get(message.table);
    if (kept && sameCursor(kept, next)) {
      this.pendingCursors.delete(message.table);
      return;
    }
    if (!takeToken(this.cursorBucket, who.id, VILLAIN_CURSOR_BURST, VILLAIN_CURSOR_PER_SECOND, this.clock())) {
      this.pendingCursors.set(message.table, { who: who.id, cursor: next });
      this.cursorTimer ??= setTimeout(() => this.flushCursors(), 500);
      return;
    }
    this.pendingCursors.delete(message.table);
    this.setCursor(message.table, next, who.id);
  }

  private flushCursors(): void {
    this.cursorTimer = null;
    if (this.meta === null) return;
    for (const [table, pending] of [...this.pendingCursors]) {
      if (!takeToken(this.cursorBucket, pending.who, VILLAIN_CURSOR_BURST, VILLAIN_CURSOR_PER_SECOND, this.clock())) {
        continue;
      }
      this.pendingCursors.delete(table);
      this.setCursor(table, pending.cursor, pending.who);
    }
    if (this.pendingCursors.size > 0) this.cursorTimer = setTimeout(() => this.flushCursors(), 500);
  }

  private setCursor(table: string, cursor: VillainCursor, host: string): void {
    const kept = this.cursors.get(table);
    if (kept && sameCursor(kept, cursor)) return;
    this.cursors.set(table, cursor);
    this.sendGame(table, { v: 1, ch: "room", kind: "villain-cursor", table, ...cursor }, host);
  }

  /** The table's game was started over, rewound or ended: the cursor belongs to a phase that is gone. */
  private clearCursor(table: string, except?: string): void {
    this.pendingCursors.delete(table);
    if (!this.cursors.delete(table)) return;
    this.sendGame(table, { v: 1, ch: "room", kind: "villain-cursor", table, key: "-", at: 0, state: "none" }, except);
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

  /**
   * The organizer's `lobby-set`: settings, seats and (Epic) tables, pods and each table's host. Validates everything
   * first, then changes the lobby in memory; the caller saves and broadcasts. Returns null when it refused, else the
   * changes to the room beyond the lobby row (participants' roles, table-host tokens, the pod state), which the caller
   * applies only once the row is saved, so a failed save leaves roles, tokens and pods as they were.
   */
  private async lobbySet(
    socket: RoomSocket,
    who: Participant,
    lobby: LobbyRow,
    message: Extract<ClientMessage, { kind: "lobby-set" }>,
  ): Promise<(() => void) | null> {
    const { settings } = lobby;
    const patch = message.settings;
    // Cheats are fixed once the game has started: a table's header is the room's sign of that.
    // So is "Everyone sees every hand": the watcher header's `roomHandsHidden` is written once, at the start.
    const changesCheats = patch?.cheats !== undefined && patch.cheats !== (settings.cheats === true);
    const changesOpen = patch?.openHands !== undefined && patch.openHands !== (settings.openHands === true);
    if (changesCheats || changesOpen) {
      for (const t of this.tables.values()) {
        await this.ensureLoaded(t);
        if (t.hasHeader) {
          this.refuse(socket, "not-allowed");
          return null;
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
      ...(patch?.hostSeesHands !== undefined ? { hostSeesHands: patch.hostSeesHands } : {}),
      ...(patch?.openHands !== undefined ? { openHands: patch.openHands } : {}),
      ...(patch?.villainPacing !== undefined ? { villainPacing: patch.villainPacing } : {}),
      ...(patch?.askToSit !== undefined ? { askToSit: patch.askToSit } : {}),
      ...(patch?.listed !== undefined ? { listed: patch.listed } : {}),
      ...(patch?.chat !== undefined ? { chat: patch.chat } : {}),
      ...(patch?.mode !== undefined ? { mode: patch.mode } : {}),
      ...(patch?.tieBreaks !== undefined ? { tieBreaks: patch.tieBreaks } : {}),
    };
    const wasEpic = settings.mode === "epic";
    const epic = next.mode === "epic";
    const wasCompetitive = settings.mode === "competitive";
    const competitive = next.mode === "competitive";
    const refuse = (reason: Refusal): null => {
      this.refuse(socket, reason);
      return null;
    };
    // Whether a table has a game needs its header: read once, only when tables or the mode change, or in an Epic room
    // (whose topology freezes once a table has started), or in a Competitive room.
    if (
      message.tables !== undefined ||
      message.pods !== undefined ||
      message.seats !== undefined ||
      epic !== wasEpic ||
      wasEpic ||
      competitive ||
      wasCompetitive
    ) {
      for (const t of this.tables.values()) await this.ensureLoaded(t);
    }
    // An Epic game that has started is a fixed set of tables, pods, hosts, seats and players: the coordinator, each
    // table's engine and every client's view were built from them, and a change would leave them disagreeing. Only
    // cosmetic edits (a table's or pod's name, a seat's label) and the play settings below stay open.
    // What the checks below judged: a table's header and end as read now. Hashing a new host's token awaits (no input
    // gate), and a start may land meanwhile, so the same read is compared again before anything changes.
    const startedNow = (): string => [...this.tables.values()].map((t) => `${t.hasHeader}${t.ended}`).join();
    const startedAtChecks = startedNow();
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
    // Competitive: the mode, and while a game runs the teams, are locked (a team's scenario was already traded).
    const live = [...this.tables.values()].some((t) => t.hasHeader && !t.ended);
    if (live && competitive !== wasCompetitive) return refuse("out-of-order");
    // What the running game was built on (the rules and the tie-break option) is fixed while it runs; before it, a change
    // takes both teams' readiness back, since they agreed to other rules.
    const rulesSig = (s: LobbySettings): string =>
      JSON.stringify([s.playMode, s.tableRules, s.mods, s.tieBreaks !== false]);
    const settingsChanged = wasCompetitive && competitive && rulesSig(settings) !== rulesSig(next);
    if (
      live &&
      settingsChanged &&
      (settings.playMode !== next.playMode || (settings.tieBreaks !== false) !== (next.tieBreaks !== false))
    ) {
      return refuse("out-of-order");
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
          team: _team,
          ...rest
        } = moved || !kept ? ({ id: spec.id } as StoredSeat) : kept;
        // A seat's team is kept when the host's list omits it, so a guest's `team-set` is not undone by the next set.
        const team = competitive ? (spec.team ?? (moved ? undefined : kept?.team)) : undefined;
        return {
          ...rest,
          ...label,
          ...player,
          ...(table !== undefined ? { table } : {}),
          ...(team !== undefined ? { team } : {}),
        };
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
    if (!competitive) seats = seats.map(({ team: _team, ...rest }) => rest);
    let teamsChanged = false;
    if (competitive) {
      for (const team of TEAMS) if (seats.filter((s) => s.team === team).length > 2) return refuse("team-size");
      const sig = (list: readonly StoredSeat[]) => list.map((s) => `${s.id}:${s.team ?? ""}`).join();
      teamsChanged = !wasCompetitive || sig(seats) !== sig(lobby.seats);
      // Changing who is on which team while a game runs is refused (the engine built its two areas from them).
      if (live && wasCompetitive && teamsChanged) return refuse("out-of-order");
      // A player is on one team.
      const side = new Map<string, TeamId>();
      for (const seat of seats) {
        if (!seat.holder || !seat.team) continue;
        const had = side.get(seat.holder);
        if (had !== undefined && had !== seat.team) return refuse("other-team");
        side.set(seat.holder, seat.team);
      }
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

    if (startedNow() !== startedAtChecks) return refuse("out-of-order");
    // Everything checked: change the lobby.
    lobby.settings = next;
    lobby.seats = seats;
    if (!competitive) {
      // The sealed row is deleted once the lobby that leaves Competitive is saved (in the lobby turn).
      delete lobby.competitive;
      this.sealed = undefined;
    } else if (!lobby.competitive || !wasCompetitive) {
      lobby.competitive = newCompetitive(lobby.competitive);
      this.sealed = undefined;
    } else if (teamsChanged || settingsChanged) {
      lobby.competitive.ready = { registration: false, resistance: false };
      lobby.competitive.revealed = false;
      bumpRev(lobby.competitive);
    }
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
    for (const id of [...this.requests.keys()]) if (!seats.some((seat) => seat.id === id)) this.requests.delete(id);
    // The people, once the lobby row is saved: a replaced host is a plain participant again; the organizer hosts its
    // table (or none); a new host is promoted and told its token privately.
    return () => {
      if (wasEpic && !epic) this.podState = undefined;
      for (const id of demote) if (this.participants.has(id)) this.makeHost(id, undefined, false);
      if (epic || wasEpic) this.makeHost(who.id, epic ? organizerTable : FIRST_TABLE, epic);
      for (const h of newHosts) {
        this.makeHost(h.id, h.table, false);
        this.sendTo(h.id, { v: 1, ch: "room", kind: "table-host-token", table: h.table, token: h.token });
      }
      if (epic || wasEpic) for (const t of this.tables.values()) this.broadcastTable(t);
    };
  }

  private lobbyMessage(
    socket: RoomSocket,
    who: Participant,
    message: Exclude<
      Extract<ClientMessage, { ch: "room" }>,
      { kind: "hello" | "room-close" | "host-activity" | "villain-cursor" | "table-plan" }
    >,
  ): Promise<void> {
    return this.lobbyLock(() => this.lobbyMessageLocked(socket, who, message));
  }

  private async lobbyMessageLocked(
    socket: RoomSocket,
    who: Participant,
    message: Exclude<
      Extract<ClientMessage, { ch: "room" }>,
      { kind: "hello" | "room-close" | "host-activity" | "villain-cursor" | "table-plan" }
    >,
  ): Promise<void> {
    // A turn that waited for the lock may belong to a participant who has left since: it must not add a request.
    if (!this.participants.has(who.id)) return;
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
    const before = this.lobbyBefore(lobby);
    // Seat tokens wait here until the lobby row that holds their hashes is saved.
    const tokens: Array<() => void> = [];
    const seatOf = (id: string) => lobby.seats.find((seat) => seat.id === id);
    const free = async (seat: StoredSeat) => {
      this.resultLedger.delete(seat.id);
      delete seat.holder;
      delete seat.holderName;
      delete seat.tokenHash;
      delete seat.takenOver;
      delete seat.showsHand;
      delete seat.left;
      // The holder's own deck goes with them (the next holder brings theirs); the host's preset stays, and one the
      // holder had replaced comes back. During a live game the hero is fixed (the frozen seat-to-player mapping), so the
      // deck summary stays: a vacant seat still names its hero, and whoever takes it plays that hero.
      if (!seat.deckPreset && !(await gameLive(seat))) {
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
    // Whether a game is running on a table. It loads the table first: after a cold wake the header is not in memory
    // until something loads it, and a policy decision (handover, discarding a deck) must not read an unloaded table.
    const liveFor = async (tableId: string): Promise<boolean> => {
      const t = this.tables.get(tableId);
      if (!t) return false;
      await this.ensureLoaded(t);
      return t.hasHeader && !t.ended;
    };
    /** Whether the game on this seat's own table (an Epic seat's table; otherwise the first) is running. */
    const gameLive = (seat: StoredSeat): Promise<boolean> => liveFor(this.seatTable(seat));
    // Only a change of holder, or the host setting the lobby, is stored. A request or its withdrawal is memory only.
    let persist = false;
    const holdersBefore = lobby.seats.map((s) => s.holder ?? "").join();
    let clearChat = false;
    // A lobby-set's changes to the room beyond the row (roles, table-host tokens): run once the row is saved.
    let leftCompetitive = false;
    let applyRoom: (() => void) | undefined;

    switch (message.kind) {
      case "lobby-set": {
        if (!isHost) return this.refuse(socket, "not-allowed");
        if (message.ifRev !== undefined && (lobby.rev ?? 0) !== message.ifRev) {
          return this.refuse(socket, "lobby-changed");
        }
        // A change that changes nothing is not stored: it would bump the revision a host's start was judged at (#881).
        const rowBefore = JSON.stringify([lobby.settings, lobby.seats, lobby.tables, lobby.pods, lobby.organizerTable]);
        const chatWasOn = lobby.settings.chat;
        const listedWas = lobby.settings.listed;
        const askWas = lobby.settings.askToSit;
        const applied = await this.lobbySet(socket, who, lobby, message);
        if (!applied) return;
        applyRoom = applied;
        if (chatWasOn && !lobby.settings.chat) {
          // Chat turned off: the stored lines go with it, so a later turn-on starts clean.
          clearChat = true;
        }
        if (listedWas === true && lobby.settings.listed !== true) this.removalOwed = true;
        // Asking turned off: pending requests have no one to approve them now. They are dropped, and those guests see
        // Take on the seats that are still open.
        if (askWas === true && lobby.settings.askToSit !== true) this.requests.clear();
        persist =
          JSON.stringify([lobby.settings, lobby.seats, lobby.tables, lobby.pods, lobby.organizerTable]) !== rowBefore;
        break;
      }
      case "team-set":
      case "team-ready":
      case "scenario-submit":
      case "sealed-reveal": {
        if (!(await this.competitiveMessage(socket, who, lobby, message, before))) return;
        // A true return changed the lobby: save it (and its revision) so hibernation keeps teams, readiness and reveal.
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
        if (this.holdsOtherTeam(lobby, who.id, seat.id, seat.team)) return this.refuse(socket, "other-team");
        if (await this.switchesSide(lobby, who.id, seat.team)) return this.refuse(socket, "other-team");
        // A guest claims an open seat at once unless the host has guests ask, or a game is running: a seat that opens
        // mid-game (its player left) is the host's to take over or give on, so a guest's request then waits for them.
        let claim = !isHost && settings.askToSit !== true;
        if (claim && (await gameLive(seat))) claim = false;
        if (claim) {
          const now = this.clock();
          const last = this.lastClaim.get(who.id);
          if (last !== undefined && now - last < CLAIM_COOLDOWN_MS) return this.refuse(socket, "rate-limited");
          this.lastClaim.set(who.id, now);
        }
        if (isHost || claim) {
          // The host approves their own request; a guest claims an open seat (above).
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
          if (!handover && (await gameLive(seat))) {
            // Leaving a seat mid-game with handover off: it stays reserved for them (their token keeps working).
            seat.left = true;
            delete seat.takenOver;
          } else await free(seat);
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
          return this.refuse(socket, !handover && (await gameLive(seat)) && gone ? "handover-off" : "seat-taken");
        }
        if (seat.holder === target.id) {
          if (!seat.left) return;
          delete seat.left;
          persist = true;
          break;
        }
        if (this.holdsElsewhere(lobby, target.id, this.seatTable(seat))) return this.refuse(socket, "other-table");
        if (!settings.multiSeat && this.seatsHeldBy(lobby, target.id) > 0) return this.refuse(socket, "multi-seat");
        if (this.holdsOtherTeam(lobby, target.id, seat.id, seat.team)) return this.refuse(socket, "other-team");
        if (await this.switchesSide(lobby, target.id, seat.team)) return this.refuse(socket, "other-team");
        tokens.push(await this.grant(seat, target));
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
      case "seat-show-hand": {
        const seat = seatOf(message.seat);
        if (!seat) return this.refuse(socket, "no-such-seat");
        // The holder decides (an away holder too, so a taken-over seat can be flipped by both). The host decides too for a seat it acts for (taken over) and for one nobody holds.
        if (seat.holder !== who.id && !(isHost && (seat.takenOver === true || !seat.holder))) {
          return this.refuse(socket, "not-allowed");
        }
        if ((seat.showsHand === true) === message.on) return;
        if (message.on) seat.showsHand = true;
        else delete seat.showsHand;
        persist = true;
        break;
      }
      case "seat-deck": {
        const seat = seatOf(message.seat);
        if (!seat) return this.refuse(socket, "no-such-seat");
        // The hero and deck are fixed while a game runs (the engine's player and deck are set at Start): a different
        // deck waits for the next game, once the table has ended.
        if (await gameLive(seat)) return this.refuse(socket, "not-allowed");
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
          await free(seat);
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
    if (persist && lobby.competitive) {
      if (await this.gameLive()) this.noteSides(lobby);
      else if (lobby.seats.map((s) => s.holder ?? "").join() !== holdersBefore) {
        // Another player on a team is another team: both must say ready again (and the host reveal again).
        lobby.competitive.ready = { registration: false, resistance: false };
        lobby.competitive.revealed = false;
        bumpRev(lobby.competitive);
      }
    }
    if (persist) {
      if (!(await this.saveLobby(before))) {
        // Nothing was committed: no token goes out and the lobby in memory is as it was. The sender is told to retry.
        this.refuse(socket, "not-saved");
        this.broadcastLobby(lobby);
        return;
      }
      // Left Competitive: the scenarios go with the mode, once the lobby that says so is stored (deleted after the
      // sends below: a stale row is harmless, a skipped token send is not).
      leftCompetitive = !!before.row.competitive && !lobby.competitive;
      for (const send of tokens) send();
      applyRoom?.();
      applyRoom = undefined;
      // A holder who plays is not counted as a watcher, so a change of holders changes the roster's count.
      this.broadcastRoster();
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
    // A lobby-set that changed nothing stored still carries its room changes (a re-sent host, say).
    applyRoom?.();
    this.broadcastLobby(lobby);
    this.scheduleListing();
    if (leftCompetitive) {
      this.sealed = undefined;
      try {
        await this.storage.delete(SEALED_KEY);
      } catch {
        // A stale sealed row is harmless: a new Competitive lobby starts with nothing submitted.
      }
    }
  }

  /**
   * The Competitive lobby messages (docs/live-game-rooms.md section 11): `team-set`, `scenario-submit`, `team-ready` and
   * `sealed-reveal`. Changes the lobby in memory and returns true when the caller should save and broadcast it; `false`
   * when it refused or only answered the host (a first reveal saves and broadcasts the lobby itself, then answers), or
   * when it saved and broadcast the lobby itself (a submission, written with its sealed row in one put). A
   * team's scenario goes into its own row and nowhere else, until the host's
   * reveal sends it to the host alone.
   */
  private async competitiveMessage(
    socket: RoomSocket,
    who: Participant,
    lobby: LobbyRow,
    message: Extract<ClientMessage, { kind: "team-set" | "team-ready" | "scenario-submit" | "sealed-reveal" }>,
    before: LobbySnapshot,
  ): Promise<boolean> {
    const comp = lobby.competitive;
    if (lobby.settings.mode !== "competitive" || !comp) return this.refused(socket, "out-of-order");
    const isHost = this.isOrganizer(who);
    const live = await this.gameLive();
    if (message.kind === "sealed-reveal") {
      if (!isHost) return this.refused(socket, "not-allowed");
      const count = (team: TeamId) => lobby.seats.filter((seat) => seat.team === team).length;
      const sized = count("registration") === count("resistance") && [1, 2].includes(count("registration"));
      if (!sized || lobby.seats.length !== count("registration") * 2) return this.refused(socket, "team-size");
      if (!TEAMS.every((t) => comp.submitted[t] && comp.ready[t])) return this.refused(socket, "not-ready");
      const sealed = await this.loadSealed();
      if (!comp.revealed) {
        // The first reveal changes the lobby: save and broadcast it before the host gets the scenarios, so the lobby
        // revision the host's client holds when the reveal resolves is the saved one (its start compares and swaps on it).
        comp.revealed = true;
        delete comp.consumedBy; // a fresh reveal is a fresh game (a failed start's admission is over)
        if (!(await this.saveLobby(before))) return this.refused(socket, "not-saved");
        this.broadcastLobby(lobby);
      }
      this.sendTo(who.id, {
        v: 1,
        ch: "room",
        kind: "sealed",
        registration: sealed.registration,
        resistance: sealed.resistance,
        rev: lobby.competitive?.rev ?? 0,
      });
      return false;
    }
    // Everything else changes the lobby before the game: a running game's teams and scenarios are fixed.
    if (live) return this.refused(socket, "out-of-order");
    const holds = (team: TeamId) => lobby.seats.some((s) => s.holder === who.id && s.team === team);
    if (message.kind === "team-set") {
      const seat = lobby.seats.find((s) => s.id === message.seat);
      if (!seat) return this.refused(socket, "no-such-seat");
      if (!isHost && seat.holder !== who.id) return this.refused(socket, "not-allowed");
      if (seat.team === message.team) return false;
      if (lobby.seats.filter((s) => s.team === message.team).length >= 2) return this.refused(socket, "team-size");
      if (seat.holder && this.holdsOtherTeam(lobby, seat.holder, seat.id, message.team)) {
        return this.refused(socket, "other-team");
      }
      seat.team = message.team;
      comp.ready = { registration: false, resistance: false };
      comp.revealed = false;
      bumpRev(comp);
      return true;
    }
    // A team's scenario and readiness are its own: the host may speak for a team it sits on, or for either team when it
    // holds no seat (it only runs the table). Owner question pending; this is the recommended rule.
    const holdsAny = lobby.seats.some((s) => s.holder === who.id);
    const allowed = holds(message.team) && (isHost || this.sameBuild(who.build, lobby.settings));
    if (!allowed && !(isHost && !holdsAny)) return this.refused(socket, "not-seated");
    if (message.kind === "team-ready") {
      if (message.ready && !comp.submitted[message.team]) return this.refused(socket, "not-ready");
      if (comp.ready[message.team] === message.ready) return false;
      comp.ready[message.team] = message.ready;
      bumpRev(comp);
      if (!message.ready) comp.revealed = false;
      return true;
    }
    // scenario-submit: a row per submission, so a slower bucket than the lobby's.
    if (!takeToken(this.sealedBuckets, who.id, 3, 0.2, this.clock())) return this.refused(socket, "rate-limited");
    const sealed = await this.loadSealed();
    const next: SealedRow = { ...sealed, [message.team]: message.scenario };
    // The new scenario and the readiness, reveal and revisions it resets are one change: staged in copies and written
    // in one multi-key put (atomic on Durable Object storage), so a wake never finds a new scenario with the old team's
    // approval of the previous one. Memory changes only once the write lands; a failed write is refused unchanged. It
    // runs in the lobby turn, so the revision it bumps is the current one, and it bypasses `saveLobby` (which writes the
    // lobby row alone) because the sealed row must go in the same put.
    const staged: CompetitiveRow = {
      ...comp,
      submitted: { ...comp.submitted, [message.team]: true },
      ready: { ...comp.ready, [message.team]: false },
      revealed: false,
    };
    bumpRev(staged);
    const lobbyRev = (lobby.rev ?? 0) + 1;
    const stagedLobby: LobbyRow = { ...lobby, competitive: staged, rev: lobbyRev };
    try {
      await this.storage.put({ [SEALED_KEY]: next, lobby: stagedLobby });
    } catch {
      // Nothing changed in memory; the team can submit again.
      return this.refused(socket, "not-saved");
    }
    this.sealed = next;
    lobby.competitive = staged;
    lobby.rev = lobbyRev;
    // Saved already: broadcast here rather than have the caller write the lobby row a second time.
    this.broadcastLobby(lobby);
    this.scheduleListing();
    return false;
  }

  private refused(socket: RoomSocket, reason: Refusal): false {
    this.refuse(socket, reason);
    return false;
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

  /**
   * The host's `proposal-refused`, `proposal-accepted` or `request-answer`: relayed to the one participant it names, nobody
   * else. A proposal result also follows the seat, not only the socket: the seat's current holder gets it even when it
   * reconnected under a new participant id, and the result is kept per seat for a reclaim that comes later.
   */
  private answerSeat(
    socket: RoomSocket,
    who: Participant,
    message: Extract<ClientMessage, { kind: "proposal-refused" | "proposal-accepted" | "request-answer" }>,
  ): void {
    const table = this.tableOf(message.table);
    if (who.role !== "host" || who.table !== message.table || !table) return this.refuse(socket, "not-allowed");
    let to = message.to;
    for (let hops = 0; hops < 8 && !this.participants.has(to) && this.successors.has(to); hops++) {
      to = this.successors.get(to)!;
    }
    const seat = this.lobby?.seats.find((s) => s.holder === to);
    const result = message.kind !== "request-answer";
    if (!this.participants.has(to) && !(result && seat)) return this.refuse(socket, "no-such-participant");
    let out: ServerMessage;
    if (message.kind === "proposal-refused") {
      out = {
        v: 1,
        ch: "game",
        kind: "proposal-refused",
        table: table.id,
        reason: message.reason,
        base: message.base,
        ...(message.pid === undefined ? {} : { pid: message.pid }),
      };
    } else if (message.kind === "proposal-accepted") {
      out = {
        v: 1,
        ch: "game",
        kind: "proposal-accepted",
        table: table.id,
        base: message.base,
        epoch: table.epoch,
        ...(message.pid === undefined ? {} : { pid: message.pid }),
      };
    } else {
      out = {
        v: 1,
        ch: "game",
        kind: "request-answer",
        table: table.id,
        accepted: message.accepted,
        ...(message.rid === undefined ? {} : { rid: message.rid }),
      };
    }
    if (result && seat) {
      const ledger = this.resultLedger.get(seat.id) ?? [];
      ledger.push(out);
      if (ledger.length > RESULT_LEDGER_SIZE) ledger.splice(0, ledger.length - RESULT_LEDGER_SIZE);
      this.resultLedger.set(seat.id, ledger);
    }
    this.sendTo(to, out);
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
      // The table host's villain phase screen, for a table this participant has just started to follow.
      const cursor = this.cursors.get(table.id);
      if (cursor) this.sendSocket(socket, { v: 1, ch: "room", kind: "villain-cursor", table: table.id, ...cursor });
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
    this.proposalBuckets.delete(participant.id);
    this.podBuckets.delete(participant.id);
    this.deckBuckets.delete(participant.id);
    this.activityBucket.delete(participant.id);
    this.cursorBucket.delete(participant.id);
    this.planBucket.delete(participant.id);
    this.broadcastRoster();
    // The host leaving ends its setup status line and its listing.
    if (participant.role === "host") {
      this.setActivity(null);
      this.setPlan(null);
    }
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
      this.cursors.clear();
      this.pendingCursors.clear();
      this.cursorBucket.clear();
      if (this.cursorTimer !== null) clearTimeout(this.cursorTimer);
      this.cursorTimer = null;
      this.plan = null;
      this.planLoad = Promise.resolve();
      this.planBucket.clear();
      this.chatBuckets.clear();
      this.lobbyBuckets.clear();
      this.sealedBuckets.clear();
      this.sealed = undefined;
      this.proposalBuckets.clear();
      this.podBuckets.clear();
      this.podState = undefined;
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
