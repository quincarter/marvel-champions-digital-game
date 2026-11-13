/**
 * What the replay worker does with each request (`workers/replay.worker.ts` is only the message plumbing around this),
 * and what `LocalReplayBackend` runs in-thread for the tests. One replay at a time: opening another replaces it.
 */
import type { GameStorage, LastPlayedOn } from "../engine/game-storage.js";
import type { CardPool } from "../engine/host.js";
import type { Snapshot } from "../engine/session-core.js";
import {
  decodeReplay,
  encodeReplay,
  replayFileNameOf,
  type ReplayParseError,
  type ReplayWriter,
} from "./replay-file.js";
import { ReplaySession, type ReplayInfo, type ReplayLog, type ReplaySource } from "./replay-session.js";

/** Where a replay comes from: a file's bytes, a game saved on this device, or a log in hand. */
export type ReplayOpenSource =
  | { readonly kind: "file"; readonly bytes: Uint8Array }
  | { readonly kind: "stored"; readonly gameId: string }
  | { readonly kind: "log"; readonly log: ReplayLog };

/** Why a replay could not be opened: the file's own reasons, a saved game that is gone, or a scenario that can't be set up. */
export type ReplayOpenErrorCode = ReplayParseError | "missing" | "setup";

export class ReplayOpenError extends Error {
  readonly code: ReplayOpenErrorCode;

  constructor(code: ReplayOpenErrorCode, message: string = code) {
    super(message);
    this.code = code;
  }
}

export interface ReplayOpened {
  readonly cardPool: CardPool;
  readonly info: ReplayInfo;
}

export interface ReplayExport {
  readonly bytes: Uint8Array;
  readonly name: string;
}

export interface ReplayLogExport {
  readonly text: string;
  readonly name: string;
}

/** A save's writer stamp as a replay writer, when it has the versions (a save from before the stamp has none). */
function playedOnOf(stamp: LastPlayedOn | undefined): { readonly playedOn?: ReplayWriter } {
  if (!stamp?.appVersion || !stamp.contentVersion) return {};
  return {
    playedOn: {
      appVersion: stamp.appVersion,
      contentVersion: stamp.contentVersion,
      ...(stamp.build ? { build: stamp.build } : {}),
    },
  };
}

export class ReplayCore {
  readonly #here: ReplayWriter;
  readonly #storage: Pick<GameStorage, "load"> | null;
  readonly #now: () => number;
  #session: ReplaySession | null = null;

  constructor(here: ReplayWriter, storage: Pick<GameStorage, "load"> | null, now: () => number = Date.now) {
    this.#here = here;
    this.#storage = storage;
    this.#now = now;
  }

  async open(source: ReplayOpenSource): Promise<ReplayOpened> {
    this.#session = null;
    const resolved = await this.#resolve(source);
    let session: ReplaySession;
    try {
      session = ReplaySession.open(resolved, this.#here);
    } catch (cause) {
      throw new ReplayOpenError("setup", cause instanceof Error ? cause.message : String(cause));
    }
    this.#session = session;
    return { cardPool: session.cardPool, info: session.info };
  }

  snapshot(n: number, played: boolean): Snapshot {
    return this.#require().snapshotAt(n, played);
  }

  async exportFile(): Promise<ReplayExport> {
    const file = this.#require().toFile(this.#now());
    return { bytes: await encodeReplay(file), name: replayFileNameOf(file) };
  }

  /** The game's log as a text file, named like the replay. */
  exportLog(): ReplayLogExport {
    const session = this.#require();
    const name = replayFileNameOf(session.toFile(this.#now())).replace(/\.mcreplay$/, "-log.txt");
    return { text: session.logText(), name };
  }

  async #resolve(source: ReplayOpenSource): Promise<ReplaySource> {
    switch (source.kind) {
      case "log":
        return { kind: "log", log: source.log };
      case "file": {
        const parsed = await decodeReplay(source.bytes);
        if (!parsed.ok) throw new ReplayOpenError(parsed.error);
        return { kind: "file", file: parsed.file };
      }
      case "stored": {
        const stored = this.#storage ? await this.#storage.load(source.gameId) : null;
        if (!stored) throw new ReplayOpenError("missing");
        const { meta } = stored;
        return {
          kind: "log",
          log: {
            config: meta.config,
            initialState: stored.initialState,
            commands: stored.commands,
            createdAt: meta.createdAt,
            outcome: meta.outcome,
            round: meta.round,
            ...playedOnOf(meta.lastPlayedOn),
          },
        };
      }
    }
  }

  #require(): ReplaySession {
    if (!this.#session) throw new Error("no replay is open");
    return this.#session;
  }
}
