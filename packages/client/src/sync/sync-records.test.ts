import { RECORD_KEY_PATTERN } from "@mc/sync-worker/sync-protocol";
import { describe, expect, test } from "vitest";
import { deriveCredentials, fromBase64Url, toBase64Url } from "./sync-credentials.js";
import { openRecord, recordKeyOf, sealRecord } from "./sync-records.js";

const creds = await deriveCredentials("ABCDEFGHJKMNPQRSTUVWXYZ23");
const other = await deriveCredentials("23456789ABCDEFGHJKMNPQRST");

describe("recordKeyOf", () => {
  test("is a deterministic 43-character base64url key, hiding the logical key", async () => {
    const key = await recordKeyOf(creds, "game:abc");
    expect(key).toMatch(RECORD_KEY_PATTERN);
    expect(await recordKeyOf(creds, "game:abc")).toBe(key);
    expect(key).not.toContain("abc");
  });

  test("differs per logical key and per space", async () => {
    expect(await recordKeyOf(creds, "game:a")).not.toBe(await recordKeyOf(creds, "game:b"));
    expect(await recordKeyOf(other, "game:a")).not.toBe(await recordKeyOf(creds, "game:a"));
  });
});

async function sealWith(logicalKey: string, sealedJson: unknown, recordKey: string): Promise<string> {
  // Seals arbitrary JSON the way sealRecord does, to forge a record whose inner key disagrees with its record key.
  const { gzipSync } = await import("node:zlib");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(`MCS1${recordKey}`) },
      creds.contentKey,
      gzipSync(JSON.stringify(sealedJson)),
    ),
  );
  const out = new Uint8Array(4 + 12 + cipher.length);
  out.set(new TextEncoder().encode("MCS1"), 0);
  out.set(iv, 4);
  out.set(cipher, 16);
  void logicalKey;
  return toBase64Url(out);
}

describe("sealRecord and openRecord", () => {
  test("round-trips JSON values with the logical key and stamp, from the record key alone", async () => {
    for (const value of [{ a: 1, b: ["x", null] }, [1, 2], "text", 7, null, true]) {
      const { recordKey, data } = await sealRecord(creds, "game:a:meta", value, 1234);
      expect(recordKey).toBe(await recordKeyOf(creds, "game:a:meta"));
      expect(await openRecord(creds, recordKey, data)).toEqual({ key: "game:a:meta", stamp: 1234, value });
    }
  });

  test("is base64url, starts with the magic, and differs per seal (random IV)", async () => {
    const a = await sealRecord(creds, "k", { n: 1 }, 1);
    const b = await sealRecord(creds, "k", { n: 1 }, 1);
    expect(a.data).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(new TextDecoder().decode(fromBase64Url(a.data).subarray(0, 4))).toBe("MCS1");
    expect(a.data).not.toBe(b.data);
  });

  test("compresses repetitive contents and never shows them in the clear", async () => {
    const value = { note: "Spider-Man ".repeat(500) };
    const { data } = await sealRecord(creds, "k", value, 1);
    expect(data.length).toBeLessThan(JSON.stringify(value).length / 4);
    expect(new TextDecoder().decode(fromBase64Url(data))).not.toContain("Spider");
  });

  test("a record moved under another record key is refused", async () => {
    const a = await sealRecord(creds, "game:a", { n: 1 }, 1);
    const otherKey = await recordKeyOf(creds, "game:b");
    await expect(openRecord(creds, otherKey, a.data)).rejects.toThrow(/couldn't be decrypted/);
  });

  test("a logical key tampered inside (even re-sealed under the right record key) is refused", async () => {
    const recordKey = await recordKeyOf(creds, "game:a");
    const forged = await sealWith("game:b", { k: "game:b", s: 1, v: 1 }, recordKey);
    await expect(openRecord(creds, recordKey, forged)).rejects.toThrow(/doesn't match/);
    const shapeless = await sealWith("x", { s: 1, v: 1 }, recordKey);
    await expect(openRecord(creds, recordKey, shapeless)).rejects.toThrow(/damaged/);
  });

  test("a wrong space, a flipped byte, a bad magic and junk are refused", async () => {
    const { recordKey, data } = await sealRecord(creds, "k", { n: 1 }, 1);
    await expect(openRecord(other, recordKey, data)).rejects.toThrow(/couldn't be decrypted/);
    const flipped = fromBase64Url(data);
    flipped[flipped.length - 1]! ^= 1;
    await expect(openRecord(creds, recordKey, toBase64Url(flipped))).rejects.toThrow(/couldn't be decrypted/);
    const wrongMagic = fromBase64Url(data);
    wrongMagic[0] = 0x58;
    await expect(openRecord(creds, recordKey, toBase64Url(wrongMagic))).rejects.toThrow(/format/);
    await expect(openRecord(creds, recordKey, "AAAA")).rejects.toThrow(/format/);
    await expect(openRecord(creds, recordKey, "not base64!")).rejects.toThrow(/base64url/);
  });

  test("refuses a value JSON can't hold", async () => {
    await expect(sealRecord(creds, "k", undefined, 1)).rejects.toThrow(/JSON/);
  });
});

describe("the writer stamp", () => {
  test("round-trips the writer and the database version, and a record without them opens as before", async () => {
    const { recordKey, data } = await sealRecord(creds, "db:mc-decks:decks:d1", { n: 1 }, 7, {
      writer: { app: "0.33.0", content: "pool-x" },
      db: 2,
    });
    expect(await openRecord(creds, recordKey, data)).toEqual({
      key: "db:mc-decks:decks:d1",
      stamp: 7,
      value: { n: 1 },
      writer: { app: "0.33.0", content: "pool-x" },
      db: 2,
    });
    const plain = await sealRecord(creds, "k", { n: 1 }, 1);
    expect(await openRecord(creds, plain.recordKey, plain.data)).toEqual({ key: "k", stamp: 1, value: { n: 1 } });
  });

  test("a malformed writer is read as none", async () => {
    const recordKey = await recordKeyOf(creds, "k");
    const sealed = await sealWith("k", { k: "k", s: 1, v: 1, w: { app: 3 }, d: "two" }, recordKey);
    expect(await openRecord(creds, recordKey, sealed)).toEqual({ key: "k", stamp: 1, value: 1 });
  });
});
