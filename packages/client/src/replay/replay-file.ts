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
 * On disk the JSON is gzip-compressed (`CompressionStream`, in every shell the game runs in): a 200-command game's log
 * is a few hundred KB of JSON and a few tens of KB compressed. Pure apart from `encodeReplay`/`decodeReplay`'s streams.
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

export interface ReplayFile {
  readonly format: typeof REPLAY_FORMAT;
  readonly version: number;
  /** Milliseconds since the epoch. */
  readonly exportedAt: number;
  readonly writer: ReplayWriter;
  /** The setup the game came from: rebuilds the card pool for the baseline, and names the game in a list. */
  readonly config: SessionConfig;
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

/** The file's bytes: its JSON, gzip-compressed. */
export async function encodeReplay(file: ReplayFile): Promise<Uint8Array> {
  const json = new Blob([JSON.stringify(file)]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(json).arrayBuffer());
}

/** Reads a replay file's bytes: gzip-compressed JSON, or plain JSON (a replay someone unpacked to read). */
export async function decodeReplay(bytes: Uint8Array): Promise<ReplayParse> {
  let text: string;
  try {
    if (bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1]) {
      const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
      text = await new Response(stream).text();
    } else {
      text = new TextDecoder().decode(bytes);
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
