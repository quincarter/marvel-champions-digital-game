/**
 * What a room game (a live room, #876) records about how this device played it, for the multiplayer achievements
 * (#909, docs/multiplayer-achievements-plan.md). It lives on the save row (`SaveMeta.roomPlay`), a purely additive
 * field: no `SAVE_SCHEMA` bump, and a save without it is a game played alone (every seat mine).
 */

import type { PlayerId } from "@mc/engine";

/** Why this device took over a seat: its holder was away, or left the room. */
export interface RoomTakeover {
  readonly player: PlayerId;
  readonly reason: "away" | "left";
}

export interface RoomPlayRecord {
  /** The host's own device keeps the real game; a guest's device keeps a finished copy of its own. */
  readonly role: "host" | "guest";
  readonly roomId: string;
  /** The room id plus the start's admission id or revision: one room can play several games, and a sync can repeat one. */
  readonly gameKey: string;
  /**
   * The table's admission id once the room has told it (`gameKey` rests on it then): which game of the room this save is.
   * Absent while the key is still provisional. A write that names another gid than the save's is refused.
   */
  readonly gid?: string;
  readonly mode: "standard" | "epic" | "competitive";
  /** The engine player ids this device held at the end, plus any it took over. */
  readonly mySeats: readonly PlayerId[];
  /** The names of the other seat holders. */
  readonly friends: readonly string[];
  readonly tookOver: readonly RoomTakeover[];
  /** Chat messages this device sent during the game. */
  readonly chatSent: number;
  /** The room played Strict rules. */
  readonly strict: boolean;
  /** The room had Cheats on: the game counts for nothing. */
  readonly cheats: boolean;
  readonly epic?: { readonly groupId: string; readonly tables: number };
  readonly competitive?: { readonly team: string; readonly side: string };
}

type WithRoomPlay = { readonly roomPlay?: RoomPlayRecord | undefined };

/** A game played in a room, on either side (host or guest). */
export const isRoomSave = (meta: WithRoomPlay & { readonly config?: { readonly room?: unknown } }): boolean =>
  meta.roomPlay !== undefined || meta.config?.room !== undefined;

/** The finished copy a guest keeps of a room game: never offered as Continue, resume or rewind. */
export const isRoomGuestSave = (meta: WithRoomPlay): boolean => meta.roomPlay?.role === "guest";

/**
 * The seats this device counts as its own in a save. A room row narrows to the seats this device held; every other
 * game is one person playing every seat, so every seat is mine and single-player facts are unchanged.
 */
export function mySeatsOf(
  meta: WithRoomPlay & { readonly config: { readonly players: readonly unknown[]; readonly room?: unknown } },
): readonly PlayerId[] {
  if (meta.roomPlay) return meta.roomPlay.mySeats;
  // A room game whose room play was never confirmed written (a failed save): a room row with no seat of mine, so it
  // earns nothing, never an offline game with every seat mine.
  if (meta.config.room !== undefined) return [];
  return meta.config.players.map((_, index) => `p${index + 1}` as PlayerId);
}
