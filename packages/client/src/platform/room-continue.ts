/**
 * The main thread's part of keeping a closed room's game (`live/room-continue.ts` has the rules): takes the game the room
 * worker handed over, and, when the notice should offer "Continue in single player", writes it to this device's saved
 * games, in the same IndexedDB the engine worker reads, so the Title's own Continue path opens it.
 */
import { offersContinue, saveRoomGame } from "../live/room-continue.js";
import type { RoomProblem, RoomState } from "../live/room-state.js";
import { loadedPacks } from "../packs/pack-registry.js";
import { CLIENT_VERSION } from "../version.js";
import { POOL_VERSION } from "../content/pool.js";
import { buildCommit } from "../view/app-version.js";
import { takeRoomSalvage } from "./live-watch.js";
import { currentPlayPlatform } from "./play-platform.js";
import { detectPlatform } from "./platform.js";

/**
 * Called as the room closes under a player in a game, with the room's state from before it ended. The id of the saved
 * game when one was kept and should be offered, else null. Always takes the handed-over game, so none lingers.
 */
export async function keepClosedRoomGame(before: RoomState, problem: RoomProblem): Promise<string | null> {
  const salvage = takeRoomSalvage();
  const roomId = before.roomId;
  if (
    !roomId ||
    !offersContinue({
      problem,
      role: before.role,
      started: before.started,
      seated: before.mySeats.length > 0,
      salvage,
    })
  ) {
    return null;
  }
  const { IdbGameStorage } = await import("../engine/idb-game-storage.js");
  const platform = currentPlayPlatform(detectPlatform());
  const storage = new IdbGameStorage(indexedDB, {
    ...(platform ? { platform } : {}),
    appVersion: CLIENT_VERSION,
    contentVersion: POOL_VERSION,
    ...(buildCommit() ? { build: buildCommit() } : {}),
  });
  return saveRoomGame(salvage!, roomId, storage, {
    packs: loadedPacks(),
    now: () => Date.now(),
    newId: () => crypto.randomUUID(),
  });
}
