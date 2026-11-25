import { describe, expect, it } from "vitest";
import { GameRoom } from "./durable-objects.js";
import type { WebSocketLike } from "./env.js";
import { MemoryStorage } from "./test-support.js";

function socket(attachment: unknown): WebSocketLike & { closed: boolean } {
  return {
    closed: false,
    send() {},
    close() {
      this.closed = true;
    },
    serializeAttachment(value) {
      attachment = value;
    },
    deserializeAttachment: () => attachment,
  };
}

async function roomWith(sockets: (WebSocketLike & { closed: boolean })[]) {
  const storage = new MemoryStorage();
  const room = new GameRoom({ storage, acceptWebSocket() {}, getWebSockets: () => sockets }, {
    MAX_ROOM_PARTICIPANTS: "3",
  } as never);
  await storage.put("meta", { hostTokenHash: "h", createdAt: 1 });
  return room;
}

const upgrade = () => new Request("https://room/room/AAAAAAAAAAAA/ws", { headers: { Upgrade: "websocket" } });

describe("GameRoom socket cap", () => {
  it("answers 503 at the cap when every open socket is a participant", async () => {
    const full = Array.from({ length: 8 }, (_, i) => socket({ id: `p${i}`, role: "watcher" }));
    const room = await roomWith(full);
    expect((await room.fetch(upgrade())).status).toBe(503);
    expect(full.some((s) => s.closed)).toBe(false);
  });

  it("drops a socket that never said hello to make room, so strangers cannot lock the host out", async () => {
    const strangers = Array.from({ length: 8 }, () => socket(null));
    const room = await roomWith(strangers);
    // Past the cap check the next step needs WebSocketPair, which Node lacks; that failure is after the eviction.
    await room.fetch(upgrade()).catch(() => undefined);
    expect(strangers.filter((s) => s.closed)).toHaveLength(1);
  });

  it("answers 404 for a room nobody created and 426 without an upgrade", async () => {
    const storage = new MemoryStorage();
    const bare = new GameRoom({ storage, acceptWebSocket() {}, getWebSockets: () => [] });
    expect((await bare.fetch(upgrade())).status).toBe(404);
    const room = await roomWith([]);
    expect((await room.fetch(new Request("https://room/room/AAAAAAAAAAAA/ws"))).status).toBe(426);
  });
});
