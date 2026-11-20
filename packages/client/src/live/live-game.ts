/**
 * The engine worker's half of the live stream: what a game looks like to the room (`LiveGame`), cut from the session's
 * own pieces. The setup config goes out the way a replay file's does: without the card packs' data (the watcher uses
 * its own installed copies, named by `packs`) and without the seats' typed deck names (`withoutDeckNames`).
 */
import type { Command, GameOutcome } from "@mc/engine";
import type { SessionConfig, StateWithoutPool } from "../engine/host.js";
import { withoutDeckNames } from "../engine/shared-config.js";
import type { ReplayPackRef, ReplayWriter } from "../replay/replay-file.js";
import type { LiveGame } from "./live-publisher.js";

export interface LiveGameParts {
  readonly writer: ReplayWriter;
  readonly config: SessionConfig;
  readonly createdAt: number;
  readonly initialState: StateWithoutPool;
  readonly commands: readonly Command[];
  readonly outcome: GameOutcome | null;
  readonly checksums?: Readonly<Record<string, string>>;
}

export function liveGameOf(parts: LiveGameParts): LiveGame {
  const { packs, watchable: _watchable, room: _room, roomPlayMode: _roomPlayMode, ...rest } = parts.config;
  const refs: readonly ReplayPackRef[] = (packs ?? []).map(({ id, version }) => ({ id, version }));
  return {
    writer: parts.writer,
    config: withoutDeckNames(rest as SessionConfig),
    ...(refs.length > 0 ? { packs: refs } : {}),
    createdAt: parts.createdAt,
    initialState: parts.initialState,
    commands: parts.commands,
    outcome: parts.outcome,
    ...(parts.checksums ? { checksums: parts.checksums } : {}),
  };
}
