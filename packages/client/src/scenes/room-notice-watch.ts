/**
 * Feeds the room's notices from its state (issue #880): who joined or left (the toast, `scenes/room-toast.ts`), the
 * "room-enter" sound when someone else joins, and the "chat-message" sound for a line from someone else while this
 * window is not in front, at most once every 3 s. Runs for the whole session and does nothing outside a room, so
 * single player and offline play never see it.
 */
import type Phaser from "phaser";
import { leaveRoom, onRoomState, type RoomState } from "../platform/room.js";
import { keepClosedRoomGame } from "../platform/room-continue.js";
import { clearRoomTable } from "../view/room-table-setup.js";
import type { RoomProblem } from "../live/room-state.js";
import { goToScreen } from "../ui/transitions.js";
import type { OnlineData } from "./online.js";
import { appSession } from "../session.js";
import {
  ChatSoundGate,
  IN_GAME_SCENES,
  newChatFromOthers,
  participantChanges,
  roomClosedInGame,
  windowFocused,
} from "../view/room-notices.js";
import { roomToasts } from "../view/room-toast.js";
import { CHROME_SCENES, SCENES } from "./keys.js";
import { sceneLoader } from "./scene-loader.js";

/**
 * The room closed under a player who is in a game: leave the room (the seat follower and the room's connection end
 * with it; a seated guest's game is saved first, as a single-player game they can continue), stop every game scene, and go to Play
 * online, which says why. Works from any in-game scene because it reads the room, not the screen.
 */
function leaveToClosedRoom(game: Phaser.Game, problem: RoomProblem, state: RoomState): void {
  // A seated guest's game is kept before the room is left (the log is the room worker's, handed over as the room ended):
  // Play online then offers to carry on with it in single player.
  const kept = keepClosedRoomGame(state, problem);
  leaveRoom();
  clearRoomTable();
  const active = game.scene.getScenes(true);
  const main =
    active.find((scene) => scene.scene.key === SCENES.board) ?? active.find((s) => IN_GAME_SCENES.has(s.scene.key));
  if (!main) return;
  for (const scene of active) {
    const key = scene.scene.key;
    if (scene === main || CHROME_SCENES.has(key) || key === SCENES.music || key === SCENES.boot) continue;
    scene.scene.stop();
  }
  void kept.then((continueGameId) =>
    goToScreen(main, SCENES.online, {
      closedNotice: problem,
      ...(continueGameId ? { continueGameId } : {}),
    } satisfies OnlineData),
  );
}

export function startRoomNoticeWatch(game: Phaser.Game): () => void {
  const gate = new ChatSoundGate();
  let previous: RoomState | null = null;
  const showToasts = (): void => {
    const start = (): void => {
      if (roomToasts.toasts.length > 0 && !game.scene.isActive(SCENES.roomToast)) game.scene.start(SCENES.roomToast);
    };
    const loader = sceneLoader();
    if (loader) void loader.load(SCENES.roomToast).then(start);
    else start();
  };
  const off = onRoomState((state) => {
    const before = previous;
    previous = state;
    if (before) {
      const active = game.scene.getScenes(true).map((scene) => scene.scene.key);
      const closed = roomClosedInGame(before, state, active);
      if (closed) {
        leaveToClosedRoom(game, closed, state);
        return;
      }
    }
    if (!before || state.role === "none") {
      if (state.role === "none") roomToasts.clear();
      return;
    }
    const changes = participantChanges(before, state);
    if (changes.length > 0) {
      const now = performance.now();
      for (const change of changes) roomToasts.push(change, now);
      if (changes.some((change) => change.kind === "joined")) appSession().music?.playEffect("room-enter");
      showToasts();
    }
    if (
      newChatFromOthers(before, state).length > 0 &&
      gate.take(performance.now(), windowFocused(globalThis.document))
    ) {
      appSession().music?.playEffect("chat-message");
    }
  });
  if (import.meta.env.DEV) {
    // Dev hook: `window.__mcRoomToast("joined", "quin", "android")` shows a toast (screenshots use it with --eval).
    (window as unknown as Record<string, unknown>)["__mcRoomToast"] = (
      kind = "joined",
      name = "quin",
      platform = "android",
    ): void => {
      roomToasts.push(
        {
          kind: kind === "left" ? "left" : "joined",
          id: `dev-${name}`,
          name,
          device: { platform: platform as "android", form: platform === "windows" ? "desktop" : "phone" },
        },
        performance.now(),
      );
      showToasts();
    };
  }
  return off;
}
