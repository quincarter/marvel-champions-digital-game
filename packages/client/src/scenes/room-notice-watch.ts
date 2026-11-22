/**
 * Feeds the room's notices from its state (issue #880): who joined or left (the toast, `scenes/room-toast.ts`), the
 * "room-enter" sound when someone else joins, and the "chat-message" sound for a line from someone else while this
 * window is not in front, at most once every 3 s. Runs for the whole session and does nothing outside a room, so
 * single player and offline play never see it.
 */
import type Phaser from "phaser";
import { onRoomState, type RoomState } from "../platform/room.js";
import { appSession } from "../session.js";
import { ChatSoundGate, newChatFromOthers, participantChanges, windowFocused } from "../view/room-notices.js";
import { roomToasts } from "../view/room-toast.js";
import { SCENES } from "./keys.js";
import { sceneLoader } from "./scene-loader.js";

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
