import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, ROOM_CODE_LENGTH } from "./protocol.js";
import { generateRoomCode } from "./room-code.js";
import { CHUNK_BYTES, MAX_WRONG_PROOFS, RoomLogic } from "./room.js";
import { BLOCK_MS, FAILURE_WINDOW_MS, RateLimiterLogic, UPLOAD_WINDOW_MS, UPLOADS_PER_HOUR } from "./rate-limiter.js";
import { MemoryStorage, OTHER_PROOF, PROOF } from "./test-support.js";

describe("generateRoomCode", () => {
  it("makes 8 characters from the alphabet", () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
  });

  it("skips bytes that would bias the draw (248 and up)", () => {
    const queue = [255, 248, 0, 1, 2, 3, 4, 5, 6, 7, 250];
    const code = generateRoomCode((n) => Uint8Array.from(queue.splice(0, n)));
    expect(code).toBe(CODE_ALPHABET.slice(0, 8));
    expect(generateRoomCode(() => Uint8Array.from([247, 247, 247, 247, 247, 247, 247, 247]))).toBe(
      CODE_ALPHABET[30]!.repeat(8),
    );
  });

  it("keeps drawing when a batch is mostly rejected", () => {
    let calls = 0;
    const code = generateRoomCode((n) => (++calls < 3 ? new Uint8Array(n).fill(255) : new Uint8Array(n).fill(1)));
    expect(code).toBe(CODE_ALPHABET[1]!.repeat(8));
    expect(calls).toBe(3);
  });

  it("maps every accepted byte value evenly", () => {
    const counts = new Map<string, number>();
    for (let byte = 0; byte < 248; byte++) {
      const ch = CODE_ALPHABET[byte % 31]!;
      counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    expect(new Set(counts.values())).toEqual(new Set([8]));
  });
});

describe("RoomLogic", () => {
  const body = new Uint8Array(CHUNK_BYTES * 2 + 5).map((_, i) => i % 251);

  it("stores in chunks, hands over once on the right proof, then empties", async () => {
    const storage = new MemoryStorage();
    const room = new RoomLogic(storage);
    expect(await room.store(PROOF, body, 1000, 5000)).toEqual({ expiresAt: 6000 });
    expect(storage.alarm).toBe(6000);
    expect(storage.map.has("c2")).toBe(true);
    const first = await room.claim(PROOF, 2000);
    expect(first.ok && first.body).toEqual(body);
    expect(storage.map.size).toBe(0);
    expect(storage.alarm).toBeNull();
    expect(await room.claim(PROOF, 2001)).toEqual({ ok: false, why: "missing" });
  });

  it("keeps the upload after a wrong proof and never stores the proof", async () => {
    const storage = new MemoryStorage();
    const room = new RoomLogic(storage);
    await room.store(PROOF, body, 1000, 5000);
    expect(await room.claim(OTHER_PROOF, 1500)).toEqual({ ok: false, why: "wrong" });
    expect(JSON.stringify(storage.map.get("meta"))).not.toContain(PROOF);
    expect((await room.claim(PROOF, 1600)).ok).toBe(true);
  });

  it("deletes the upload after 5 wrong proofs, even if the right one follows", async () => {
    const storage = new MemoryStorage();
    const room = new RoomLogic(storage);
    await room.store(PROOF, body, 1000, 5000);
    for (let i = 0; i < MAX_WRONG_PROOFS - 1; i++)
      expect(await room.claim(OTHER_PROOF, 1500)).toEqual({ ok: false, why: "wrong" });
    expect(storage.map.size).toBeGreaterThan(0);
    expect(await room.claim(OTHER_PROOF, 1500)).toEqual({ ok: false, why: "wrong" });
    expect(storage.map.size).toBe(0);
    expect(await room.claim(PROOF, 1600)).toEqual({ ok: false, why: "missing" });
  });

  it("treats an expired upload as missing and deletes it; the alarm deletes too", async () => {
    const storage = new MemoryStorage();
    const room = new RoomLogic(storage);
    await room.store(PROOF, body, 1000, 5000);
    expect(await room.claim(PROOF, 6000)).toEqual({ ok: false, why: "missing" });
    expect(storage.map.size).toBe(0);

    await room.store(PROOF, body, 10_000, 5000);
    await room.expire();
    expect(storage.map.size).toBe(0);
    expect(storage.alarm).toBeNull();
  });

  it("refuses a second upload while one is live, accepts after expiry", async () => {
    const room = new RoomLogic(new MemoryStorage());
    await room.store(PROOF, body, 1000, 5000);
    expect(await room.store(PROOF, body, 2000, 5000)).toBeNull();
    expect(await room.store(PROOF, body, 7000, 5000)).not.toBeNull();
  });
});

describe("RateLimiterLogic", () => {
  it("refuses the 11th upload in an hour with a retry time, and rolls the window", async () => {
    const limiter = new RateLimiterLogic(new MemoryStorage());
    for (let i = 0; i < UPLOADS_PER_HOUR; i++) expect(await limiter.takeUpload(1000 + i)).toEqual({ ok: true });
    expect(await limiter.takeUpload(5000)).toEqual({ ok: false, retryAfterMs: 1000 + UPLOAD_WINDOW_MS - 5000 });
    expect(await limiter.takeUpload(1000 + UPLOAD_WINDOW_MS + 1)).toEqual({ ok: true });
  });

  it("blocks after 5 failures in 10 minutes and unblocks after the hour", async () => {
    const limiter = new RateLimiterLogic(new MemoryStorage());
    for (let i = 0; i < 4; i++) await limiter.reserveAttempt(1000 + i);
    expect(await limiter.blockedFor(1010)).toBe(0);
    await limiter.reserveAttempt(1004);
    expect(await limiter.blockedFor(1010)).toBe(BLOCK_MS - 6);
    expect(await limiter.blockedFor(1004 + BLOCK_MS)).toBe(0);
  });

  it("refund takes back an attempt and the block it tripped", async () => {
    const limiter = new RateLimiterLogic(new MemoryStorage());
    for (let i = 0; i < 4; i++) await limiter.reserveAttempt(1000 + i);
    await limiter.reserveAttempt(2000);
    expect(await limiter.blockedFor(2001)).toBeGreaterThan(0);
    await limiter.refund(2000, 2001);
    expect(await limiter.blockedFor(2001)).toBe(0);
    expect(await limiter.reserveAttempt(2002)).toEqual({ ok: true });
  });

  it("does not count failures spread beyond the window", async () => {
    const limiter = new RateLimiterLogic(new MemoryStorage());
    for (let i = 0; i < 6; i++) await limiter.reserveAttempt(i * (FAILURE_WINDOW_MS / 2));
    expect(await limiter.blockedFor(6 * FAILURE_WINDOW_MS)).toBe(0);
  });

  it("cleans its own storage once every window has passed", async () => {
    const storage = new MemoryStorage();
    const limiter = new RateLimiterLogic(storage);
    await limiter.takeUpload(1000);
    expect(storage.alarm).toBe(1000 + UPLOAD_WINDOW_MS);
    await limiter.sweep(1000 + UPLOAD_WINDOW_MS + 1);
    expect(storage.map.size).toBe(0);
    expect(storage.alarm).toBeNull();
  });
});
