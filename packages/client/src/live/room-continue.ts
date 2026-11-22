/**
 * Keeping a room's game when the host closes the room under a seated guest (issue #881, Quin 2026-11-22): every guest
 * already holds the whole command log and the setup (`GameMirror`), so the device saves it as a normal single-player
 * game (config plus log, which the engine replays deterministically) and the "Room closed" notice offers to carry on
 * from where the table stopped. All of it runs on the guest's device; nothing here talks to the room.
 *
 * The saved game is the device's own: the room's fields leave its setup (no room to attach to, no strict rules, no
 * face-down hands), every seat is a local seat (one person plays them all, as in any single-player game), and the row
 * says which room it came from (`SaveMeta.continuedFromRoom`). It counts like any single-player game, once, on this
 * device: a guest never saved a room's game before this, so it is not counted twice, and the host's own save of the same
 * game is the host's. A room played with Cheats on, or a game that holds a Manual adjust, stays adjusted and counts for
 * nothing (`SaveMeta.adjusted`, #791). The hands the guest's copy holds are the whole engine state (the engine keeps
 * every hand), which is fine for one person playing all seats.
 */
import type { Command } from "@mc/engine";
import type { SessionConfig, StateWithoutPool } from "../engine/host.js";
import { SAVE_SCHEMA, type GameStorage, type SaveMeta } from "../engine/game-storage.js";
import type { PackRuntime } from "../packs/pack-runtime.js";
import type { RoomGameSalvage } from "./room-game-mirror.js";
import type { RoomProblem } from "./room-state.js";
import { parseLiveHeader } from "./watch-header.js";

/** The room ends that leave a game worth carrying on: the host closed it, it sat idle, or the service switched rooms off. */
const CLOSES_UNDER_A_GAME: ReadonlySet<RoomProblem> = new Set(["closed-host", "closed-idle", "closed-disabled"]);

/** The most commands a saved game may hold (a replay's own cap, `MAX_REPLAY_COMMANDS`). */
const MAX_COMMANDS = 20_000;

/**
 * Whether the "Room closed" notice offers "Continue in single player": the room was closed (not replaced, full or gone)
 * under a guest who held a seat, with a game started and not over, and the device holds all of it (`salvage` is the log
 * the room worker kept; absent when the game was over, still arriving, or there was none).
 */
export function offersContinue(input: {
  readonly problem: RoomProblem;
  readonly role: "host" | "guest" | "none";
  readonly started: boolean;
  readonly seated: boolean;
  readonly salvage: RoomGameSalvage | null;
}): boolean {
  return (
    CLOSES_UNDER_A_GAME.has(input.problem) &&
    input.role === "guest" &&
    input.started &&
    input.seated &&
    input.salvage !== null
  );
}

export type RoomGameSave =
  | {
      readonly ok: true;
      readonly meta: SaveMeta;
      readonly initialState: StateWithoutPool;
      readonly commands: readonly Command[];
    }
  | { readonly ok: false; readonly reason: "unreadable" | "missingPacks" };

export interface RoomGameSaveDeps {
  /** This device's installed packs: a game's packs are named by id and version, never carried. */
  readonly packs: readonly PackRuntime[];
  readonly now: () => number;
  readonly newId: () => string;
}

/** The room's own fields: left out of the setup so the saved game is no room's (they never reach the rules). */
function ownSetup(config: SessionConfig): SessionConfig {
  const {
    packs: _packs,
    watchable: _watchable,
    room: _room,
    roomPlayMode: _roomPlayMode,
    roomUndo: _roomUndo,
    roomCheats: _roomCheats,
    roomHandsHidden: _roomHandsHidden,
    roomLobbyRev: _roomLobbyRev,
    ...rest
  } = config;
  return rest;
}

/** A guest's log as the device's own saved game, or why it cannot be one. Pure: nothing is written. */
export function roomGameSave(salvage: RoomGameSalvage, roomId: string, deps: RoomGameSaveDeps): RoomGameSave {
  const header = parseLiveHeader(salvage.header);
  const players = (header?.config as Partial<SessionConfig> | undefined)?.players;
  if (
    !header ||
    !Array.isArray(players) ||
    players.length < 1 ||
    players.length > 4 ||
    salvage.commands.length > MAX_COMMANDS ||
    !salvage.commands.every(isCommand)
  ) {
    return { ok: false, reason: "unreadable" };
  }
  const commands = salvage.commands as readonly Command[];
  let config = ownSetup(header.config);
  const refs = header.packs ?? [];
  if (refs.length > 0) {
    const found = refs.map((ref) => deps.packs.find((pack) => pack.id === ref.id && pack.version === ref.version));
    if (found.some((pack) => pack === undefined)) return { ok: false, reason: "missingPacks" };
    config = { ...config, packs: found as PackRuntime[] };
  }
  const at = deps.now();
  const adjusted =
    header.adjusted === true || salvage.adjusted === true || commands.some((command) => command.type === "adjust");
  const meta: SaveMeta = {
    id: deps.newId(),
    schema: SAVE_SCHEMA,
    config,
    createdAt: header.createdAt,
    updatedAt: at,
    status: "active",
    // The row's round is corrected by the first move played here; the log itself is what resumes.
    round: typeof header.initialState.round === "number" ? header.initialState.round : 1,
    commandCount: commands.length,
    outcome: null,
    campaignId: null,
    campaignNodeId: null,
    ...(adjusted ? { adjusted: true as const } : {}),
    continuedFromRoom: roomId,
  };
  return { ok: true, meta, initialState: header.initialState, commands };
}

function isCommand(value: unknown): value is Command {
  return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
}

/** Writes the guest's log as a saved game in `storage`; the new game's id, or null when it could not be kept. Never throws. */
export async function saveRoomGame(
  salvage: RoomGameSalvage,
  roomId: string,
  storage: Pick<GameStorage, "importGame">,
  deps: RoomGameSaveDeps,
): Promise<string | null> {
  const save = roomGameSave(salvage, roomId, deps);
  if (!save.ok) return null;
  try {
    await storage.importGame(save.meta, save.initialState, save.commands);
    return save.meta.id;
  } catch {
    return null;
  }
}
