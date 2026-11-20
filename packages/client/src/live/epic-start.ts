/**
 * How an Epic room starts its game, and where each group sits (Epic Multiplayer, issue #882), as pure functions.
 *
 * The room has no "start" message and every table host runs its own engine, so the organizer's start is a setting every
 * device sees in the next `lobby` message: `settings.tableRules.epic.start = { id, seed }` (the room keeps `tableRules`
 * opaque and tells everyone; nothing else reads the `epic` key). A table host that sees it starts its own group's game.
 * The seed is shared and each table's own seed is made from it and the table's id, so a start is deterministic: the same
 * `{ seed, table }` always gives the same shuffle, and two tables never share one.
 */
import type { LobbySeatSpec } from "@mc/sync-worker/room-protocol";
import type { EpicGroupPlacement, SessionConfig } from "../engine/host.js";
import type { EpicStart, EpicState } from "./room-state.js";

/** The key of `LobbySettings.tableRules` that holds the Epic start. */
export const EPIC_RULES_KEY = "epic";

/** The start in a lobby's `tableRules`, or null when the organizer has not started the game (or the value is not one). */
export function readEpicStart(tableRules: Readonly<Record<string, unknown>> | undefined): EpicStart | null {
  const epic = tableRules?.[EPIC_RULES_KEY];
  if (typeof epic !== "object" || epic === null) return null;
  const start = (epic as { start?: unknown }).start;
  if (typeof start !== "object" || start === null) return null;
  const { id, seed } = start as { id?: unknown; seed?: unknown };
  if (typeof id !== "string" || id === "" || id.length > 32) return null;
  if (typeof seed !== "number" || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return null;
  return { id, seed };
}

/** `tableRules` with the Epic start set (every other rule kept), for the organizer's `lobby-set`. */
export function withEpicStart(
  tableRules: Readonly<Record<string, unknown>> | undefined,
  start: EpicStart,
): Record<string, unknown> {
  return { ...tableRules, [EPIC_RULES_KEY]: { start } };
}

/** FNV-1a over the table's id, mixed with the shared seed: the table's own seed, an unsigned 32-bit integer. */
export function tableSeedOf(seed: number, table: string): number {
  let hash = 0x811c9dc5 ^ (seed >>> 0);
  for (let i = 0; i < table.length; i++) {
    hash ^= table.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Where `table` sits in the game: its pod's tables in the organizer's order (a table's id is its group's id), the number
 * of groups and the number of players in the whole game (each lobby seat is one player). Null when the table or its pod
 * is not in the lobby.
 */
export function epicPlacementOf(state: Pick<EpicState, "tables" | "pods">, table: string): EpicGroupPlacement | null {
  const mine = state.tables.find((t) => t.id === table);
  const pod = mine && state.pods.find((p) => p.id === mine.pod);
  if (!mine || !pod) return null;
  return {
    groupId: table,
    groupIdsInPod: pod.tables,
    groupsInGame: state.tables.length,
    playersInGame: state.tables.reduce((sum, t) => sum + t.seats.length, 0),
  };
}

/**
 * The game this device starts for its table once the organizer has started the game: `config` (the table's heroes,
 * decks and scenario, built as for a standard room) with this table's seed, its group's place in the pod and the room
 * fields. Throws, in words, when the device cannot start a table now: it hosts none, the organizer has not started, or
 * the heroes do not match the table's seats.
 */
export function epicTableConfig(
  config: SessionConfig,
  epic: EpicState | null,
  room: { readonly roomId: string | null; readonly playMode?: "strict" | "host" },
): SessionConfig {
  if (!epic?.hostsTable) throw new Error("this device hosts no table of the game");
  if (!epic.start) throw new Error("the organizer has not started the game");
  if (!room.roomId) throw new Error("not in a room");
  const table = epic.tables.find((t) => t.id === epic.hostsTable);
  if (!table) throw new Error("the table is not in the lobby");
  if (config.players.length !== table.seats.length) {
    throw new Error(`the table has ${table.seats.length} seats but ${config.players.length} heroes were chosen`);
  }
  const epicPlacement = epicPlacementOf(epic, table.id);
  if (!epicPlacement) throw new Error("the table's pod is not in the lobby");
  return {
    ...config,
    seed: tableSeedOf(epic.start.seed, table.id),
    epic: epicPlacement,
    watchable: true,
    room: room.roomId,
    ...(room.playMode ? { roomPlayMode: room.playMode } : {}),
  };
}

/** How many seats a table has (its group's players), from the lobby. A seat naming no table is at the first. */
export const seatsAt = (seats: readonly Pick<LobbySeatSpec, "table">[], table: string, first: string): number =>
  seats.filter((s) => (s.table ?? first) === table).length;
