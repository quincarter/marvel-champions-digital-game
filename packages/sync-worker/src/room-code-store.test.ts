import { describe, expect, it } from "vitest";
import { RoomCodeLogic } from "./room-code-store.js";
import { MemoryStorage } from "./test-support.js";

describe("RoomCodeLogic", () => {
  it("claims a code for a room, resolves it, and writes the mapping and its alarm", async () => {
    const storage = new MemoryStorage();
    const codes = new RoomCodeLogic(storage);
    expect(await codes.claim("room1", 5_000, 1_000)).toBe(true);
    expect(await codes.resolve(2_000)).toBe("room1");
    expect(storage.alarm).toBe(5_000);
    expect([...storage.map.keys()]).toEqual(["code"]);
  });

  it("refuses a code a live mapping holds (a collision), and gives an expired one away", async () => {
    const codes = new RoomCodeLogic(new MemoryStorage());
    await codes.claim("room1", 5_000, 1_000);
    expect(await codes.claim("room2", 9_000, 4_999)).toBe(false);
    expect(await codes.resolve(4_999)).toBe("room1");
    expect(await codes.claim("room2", 9_000, 5_000)).toBe(true);
    expect(await codes.resolve(5_001)).toBe("room2");
  });

  it("an expired mapping resolves to null and is deleted on the way", async () => {
    const storage = new MemoryStorage();
    const codes = new RoomCodeLogic(storage);
    await codes.claim("room1", 5_000, 1_000);
    expect(await codes.resolve(5_000)).toBeNull();
    expect(storage.map.size).toBe(0);
    expect(storage.alarm).toBeNull();
  });

  it("the alarm deletes an expired mapping and moves out for one that was refreshed", async () => {
    const storage = new MemoryStorage();
    const codes = new RoomCodeLogic(storage);
    await codes.claim("room1", 5_000, 1_000);
    expect(await codes.refresh("room1", 9_000)).toBe(true);
    await codes.expire(5_000);
    expect(await codes.resolve(5_001)).toBe("room1");
    expect(storage.alarm).toBe(9_000);
    await codes.expire(9_000);
    expect(storage.map.size).toBe(0);
    expect(storage.alarm).toBeNull();
  });

  it("only the room a code belongs to may refresh or release it", async () => {
    const codes = new RoomCodeLogic(new MemoryStorage());
    await codes.claim("room1", 5_000, 1_000);
    expect(await codes.refresh("other", 9_000)).toBe(false);
    expect(await codes.release("other")).toBe(false);
    expect(await codes.resolve(2_000)).toBe("room1");
    expect(await codes.release("room1")).toBe(true);
    expect(await codes.resolve(2_000)).toBeNull();
    expect(await codes.release("room1")).toBe(false);
  });
});
