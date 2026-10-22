import { CODE_ALPHABET, KEY_PART_LENGTH, PROOF_PATTERN } from "@mc/sync-worker/protocol";
import { describe, expect, test } from "vitest";
import { sampleSaveFile } from "./transfer-fixtures.js";
import { newKeyPart, openSealed, proofOf, sealSaveFile } from "./transfer-crypto.js";

describe("newKeyPart", () => {
  test("is four characters of the code alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const part = newKeyPart();
      expect(part).toHaveLength(KEY_PART_LENGTH);
      expect([...part].every((c) => CODE_ALPHABET.includes(c))).toBe(true);
    }
  });

  test("rejects biased bytes instead of wrapping them", () => {
    // 248 is the first rejected byte for a 31-letter alphabet (31 * 8); 0..30 map to the first letters.
    const bytes = [255, 248, 0, 1, 2, 3, 4, 5];
    expect(newKeyPart(() => Uint8Array.from(bytes))).toBe(CODE_ALPHABET.slice(0, 4));
  });

  test("draws again when a draw is mostly rejected", () => {
    const draws = [Uint8Array.from(Array(8).fill(250)), Uint8Array.from([30, 31, 32, 33, 0, 0, 0, 0])];
    expect(newKeyPart(() => draws.shift()!)).toBe(
      CODE_ALPHABET[30]! + CODE_ALPHABET[0]! + CODE_ALPHABET[1]! + CODE_ALPHABET[2]!,
    );
  });
});

describe("proofOf", () => {
  test("is deterministic, URL-safe and 43 characters", async () => {
    const proof = await proofOf("ABCD");
    expect(proof).toMatch(PROOF_PATTERN);
    expect(await proofOf("ABCD")).toBe(proof);
    expect(await proofOf("ABCE")).not.toBe(proof);
  });
});

describe("sealSaveFile / openSealed", () => {
  test("round trips the JSON", async () => {
    const file = sampleSaveFile();
    const sealed = await sealSaveFile(file, "K7Q2");
    expect(JSON.parse(await openSealed(sealed, "K7Q2"))).toEqual(file);
  });

  test("starts with the magic and is salted and IV'd per upload", async () => {
    const file = sampleSaveFile(2);
    const a = await sealSaveFile(file, "K7Q2");
    const b = await sealSaveFile(file, "K7Q2");
    expect(new TextDecoder().decode(a.subarray(0, 4))).toBe("MCT1");
    expect(a).not.toEqual(b);
  });

  test("compresses a repetitive save before encrypting", async () => {
    const file = sampleSaveFile();
    const sealed = await sealSaveFile(file, "K7Q2");
    expect(sealed.length).toBeLessThan(JSON.stringify(file).length / 5);
  });

  test("a wrong key part fails", async () => {
    const sealed = await sealSaveFile(sampleSaveFile(2), "K7Q2");
    await expect(openSealed(sealed, "K7Q3")).rejects.toThrow(/couldn't be decrypted/);
  });

  test("a tampered byte fails", async () => {
    const sealed = await sealSaveFile(sampleSaveFile(2), "K7Q2");
    const bad = sealed.slice();
    bad[bad.length - 5] = bad[bad.length - 5]! ^ 1;
    await expect(openSealed(bad, "K7Q2")).rejects.toThrow(/couldn't be decrypted/);
  });

  test("a bad magic or a short input is refused", async () => {
    const sealed = await sealSaveFile(sampleSaveFile(2), "K7Q2");
    const bad = sealed.slice();
    bad[0] = 0x58;
    await expect(openSealed(bad, "K7Q2")).rejects.toThrow(/isn't a Marvel Champions save transfer/);
    await expect(openSealed(sealed.subarray(0, 10), "K7Q2")).rejects.toThrow(/isn't a Marvel Champions save transfer/);
  });
});
