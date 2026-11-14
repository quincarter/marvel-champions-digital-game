/**
 * The replay file (issue #693): one finished or unfinished game, portable, so it can be watched on another device.
 *
 * A replay is a save's log and nothing more: the stored baseline (`StateWithoutPool`) and every command, with the
 * setup config that rebuilds the card pool (`rebuildBaseline`). The engine is deterministic (`applyCommand` is pure and
 * the RNG lives in the state), so that is enough to rebuild every position of the game.
 *
 * What the save does not carry is the card pool and the card scripts: they come from the build that opens the file. A
 * build whose cards changed since can replay the log differently, so the file also carries a checksum of the state
 * every `CHECKSUM_EVERY` commands, taken by the build that wrote it (`replay-session.ts`). The viewer checks them as it
 * rebuilds and says where the game first played out differently, instead of quietly showing a game that never was.
 *
 * On disk the JSON is gzip-compressed (`CompressionStream`, in every shell the game runs in) and kept as base64 text
 * under a header line (`encodeReplay`): a 200-command game's log is a few hundred KB of JSON and a few tens of KB packed. Pure apart from `encodeReplay`/`decodeReplay`'s streams.
 */
import type { Command, GameOutcome, GameState } from "@mc/engine";
import type { SessionConfig, StateWithoutPool } from "../engine/host.js";
import { isNewerVersion } from "../engine/app-version.js";

export const REPLAY_FORMAT = "mc-replay";
export const REPLAY_VERSION = 1;
/** The file name's extension: a gzip of JSON, named for the game so a shell can route it back here. */
export const REPLAY_EXTENSION = ".mcreplay";
/** How many commands apart the state checksums are taken. */
export const CHECKSUM_EVERY = 10;

/** The build that wrote a replay: the app release, the card pool (`POOL_VERSION`) and the commit, when known. */
export interface ReplayWriter {
  readonly appVersion: string;
  readonly contentVersion: string;
  readonly build?: string;
}

/** A custom pack a replay's game used, by id and version: the viewer plays it with their own installed copy. */
export interface ReplayPackRef {
  readonly id: string;
  readonly version: string;
}

export interface ReplayFile {
  readonly format: typeof REPLAY_FORMAT;
  readonly version: number;
  /** Milliseconds since the epoch. */
  readonly exportedAt: number;
  readonly writer: ReplayWriter;
  /**
   * The setup the game came from: rebuilds the card pool for the baseline, and names the game in a list. Never carries
   * `packs`: a pack's data from a file would be run untrusted, so the file names them (`packs`) and the viewer's own
   * installed, validated copies are used (`replay-core.ts`).
   */
  readonly config: SessionConfig;
  /** The custom packs the game used; absent for a base-game game. */
  readonly packs?: readonly ReplayPackRef[];
  /** When the game was created and how it stood when exported, for the viewer's header. */
  readonly createdAt: number;
  readonly outcome: GameOutcome | null;
  readonly round: number;
  readonly initialState: StateWithoutPool;
  readonly commands: readonly Command[];
  /** `checksums[k]` is `replayChecksum` of the state after `k * CHECKSUM_EVERY` commands, as the writer had it. */
  readonly checksums: readonly string[];
}

/** Why a file could not be read as a replay; the screen words it (`replay.error.*` in the i18n catalog). */
export type ReplayParseError = "notReplay" | "newerFormat" | "damaged";

export type ReplayParse =
  | { readonly ok: true; readonly file: ReplayFile }
  | { readonly ok: false; readonly error: ReplayParseError };

/**
 * A digest of a whole state but its card pool (the pool is the build's, not the game's): FNV-1a over the JSON in two
 * independent 32-bit lanes, plus the length. JSON follows key order, which a deterministic replay on one build keeps; a
 * build that reorders a state's keys reads as different, which only ever errs towards warning.
 */
export function replayChecksum(state: GameState | StateWithoutPool): string {
  const { cardPool: _pool, ...rest } = state as GameState;
  const text = JSON.stringify(rest);
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ code, 0x5bd1e995) >>> 0;
  }
  return `${text.length}:${a.toString(16)}:${b.toString(16)}`;
}

/** Whether `index` commands in is a position the file keeps a checksum for. */
export const isChecksumPosition = (index: number): boolean => index % CHECKSUM_EVERY === 0;

/**
 * Checks a replay's checksums as the viewer rebuilds it: hand it each position's state in order (`observe`), then read
 * `divergedAt`, the first position whose state is not the one the writer had, or null.
 */
export class ChecksumCheck {
  readonly #expected: readonly string[];
  #divergedAt: number | null = null;

  constructor(expected: readonly string[]) {
    this.#expected = expected;
  }

  observe(index: number, state: GameState): void {
    if (this.#divergedAt !== null || !isChecksumPosition(index)) return;
    const expected = this.#expected[index / CHECKSUM_EVERY];
    if (expected !== undefined && expected !== replayChecksum(state)) this.#divergedAt = index;
  }

  get divergedAt(): number | null {
    return this.#divergedAt;
  }
}

/** Collects the checksums a writer stores (`observe` each position in order). */
export class ChecksumWriter {
  readonly #values: string[] = [];

  observe(index: number, state: GameState): void {
    if (isChecksumPosition(index)) this.#values.push(replayChecksum(state));
  }

  get values(): readonly string[] {
    return this.#values;
  }
}

/** Whether a replay was written by a build other than `here`: its game may play out differently on this one. */
export function writtenElsewhere(writer: ReplayWriter, here: ReplayWriter): boolean {
  return (
    writer.appVersion !== here.appVersion ||
    writer.contentVersion !== here.contentVersion ||
    (writer.build !== undefined && here.build !== undefined && writer.build !== here.build)
  );
}

/** Whether a replay was written by a newer release than `appVersion` (its commands may be ones this build lacks). */
export const writtenByNewerRelease = (writer: ReplayWriter, appVersion: string): boolean =>
  isNewerVersion(writer.appVersion, appVersion);

/** Checks a parsed JSON value is a replay this build can read, and says why not otherwise. */
export function parseReplay(value: unknown): ReplayParse {
  if (!value || typeof value !== "object") return { ok: false, error: "notReplay" };
  const file = value as Partial<ReplayFile>;
  if (file.format !== REPLAY_FORMAT) return { ok: false, error: "notReplay" };
  if (typeof file.version !== "number" || file.version > REPLAY_VERSION) {
    return { ok: false, error: "newerFormat" };
  }
  if (
    !file.config ||
    typeof file.config !== "object" ||
    !file.initialState ||
    typeof file.initialState !== "object" ||
    !Array.isArray(file.commands) ||
    !Array.isArray(file.checksums) ||
    !file.writer ||
    typeof file.writer.appVersion !== "string" ||
    typeof file.writer.contentVersion !== "string"
  ) {
    return { ok: false, error: "damaged" };
  }
  return { ok: true, file: file as ReplayFile };
}

/** A file name for a replay: the scenario and the date it was exported, e.g. `rhino-2026-11-13.mcreplay`. */
export function replayFileNameOf(file: Pick<ReplayFile, "config" | "exportedAt">): string {
  const day = new Date(file.exportedAt).toISOString().slice(0, 10);
  const scenario = file.config.scenarioId.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "game";
  return `${scenario}-${day}${REPLAY_EXTENSION}`;
}

const GZIP_MAGIC = [0x1f, 0x8b] as const;
/** The first line of a replay file; the gzip, in base64, follows on the next. */
export const REPLAY_HEADER = "MCREPLAY1";

const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

/**
 * The most a replay may hold, packed or unpacked. A long four-hero game's log is a few MB of JSON; these leave room
 * for that, and stop a small file built to unpack to hundreds of MB (a shared link opens one by itself) from filling
 * memory before it is read.
 */
export const MAX_REPLAY_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_REPLAY_JSON_BYTES = 24 * 1024 * 1024;

class TooLarge extends Error {}

/** Unpacks gzip, reading it a chunk at a time and giving up past `limit` unpacked bytes. */
async function gunzip(bytes: Uint8Array, limit: number = MAX_REPLAY_JSON_BYTES): Promise<string> {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
  const decoder = new TextDecoder();
  let text = "";
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new TooLarge();
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

/**
 * The file's bytes: a header line, then the JSON gzip-compressed and in base64. Text, so every way the game hands a file
 * out (the desktop and Android save dialogs take text) carries it unchanged, and it survives being pasted.
 */
export async function encodeReplay(file: ReplayFile): Promise<Uint8Array> {
  const gzip = new Blob([JSON.stringify(file)]).stream().pipeThrough(new CompressionStream("gzip"));
  const packed = toBase64(new Uint8Array(await new Response(gzip).arrayBuffer()));
  return new TextEncoder().encode(`${REPLAY_HEADER}\n${packed}\n`);
}

/** Reads a replay file's bytes: as `encodeReplay` writes them, raw gzip, or plain JSON (a replay unpacked to read). */
export async function decodeReplay(bytes: Uint8Array, limit: number = MAX_REPLAY_JSON_BYTES): Promise<ReplayParse> {
  if (bytes.byteLength > MAX_REPLAY_FILE_BYTES) return { ok: false, error: "damaged" };
  let text: string;
  try {
    if (bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1]) {
      text = await gunzip(bytes, limit);
    } else {
      text = new TextDecoder().decode(bytes).trim();
      if (text.startsWith(REPLAY_HEADER)) {
        text = await gunzip(fromBase64(text.slice(REPLAY_HEADER.length).trim()), limit);
      }
    }
  } catch {
    return { ok: false, error: "damaged" };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: "notReplay" };
  }
  return parseReplay(value);
}
