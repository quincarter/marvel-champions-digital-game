import { CODE_ALPHABET } from "@mc/sync-worker/protocol";
import {
  RECOVERY_CODE_LENGTH,
  SPACE_ID_PATTERN,
  TOKEN_PATTERN,
  parseRecoveryCode,
} from "@mc/sync-worker/sync-protocol";
import { describe, expect, test } from "vitest";
import { SAVED_LOCAL_STORAGE_PREFIX } from "../save-data/databases.js";
import {
  SYNC_CODE_STORAGE_KEY,
  clearSyncCode,
  deriveCredentials,
  fromBase64Url,
  loadSyncCode,
  newRecoveryCode,
  saveSyncCode,
  toBase64Url,
  type CodeStorage,
} from "./sync-credentials.js";

const CODE = "ABCDE-FGHJK-MNPQR-STUVW-XYZ23";
const memory = (): CodeStorage & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
};
const throwing: CodeStorage = {
  getItem: () => {
    throw new Error("denied");
  },
  setItem: () => {
    throw new Error("denied");
  },
  removeItem: () => {
    throw new Error("denied");
  },
};

describe("newRecoveryCode", () => {
  test("is 25 characters of the alphabet and parses", () => {
    const code = newRecoveryCode();
    expect(code).toHaveLength(RECOVERY_CODE_LENGTH);
    expect(parseRecoveryCode(code)).toBe(code);
  });

  test("rejects biased bytes: 248 and above are skipped", () => {
    // 256 - 256 % 31 = 248; the first batch is all rejected, the next maps byte % 31 to the alphabet.
    let calls = 0;
    const code = newRecoveryCode((length) => {
      calls++;
      return new Uint8Array(length).fill(calls === 1 ? 255 : 31);
    });
    expect(calls).toBe(2);
    expect(code).toBe(CODE_ALPHABET[0]!.repeat(RECOVERY_CODE_LENGTH));
  });

  test("covers the alphabet roughly evenly", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 400; i++) for (const char of newRecoveryCode()) counts.set(char, (counts.get(char) ?? 0) + 1);
    expect(counts.size).toBe(CODE_ALPHABET.length);
    for (const n of counts.values()) expect(n).toBeGreaterThan(200); // expected ~322
  });
});

describe("deriveCredentials", () => {
  test("is deterministic and normalizes the typed code", async () => {
    const a = await deriveCredentials(CODE);
    const b = await deriveCredentials("abcde fghjk mnpqr stuvw xyz23");
    expect(a.recoveryCode).toBe("ABCDEFGHJKMNPQRSTUVWXYZ23");
    expect(b.spaceId).toBe(a.spaceId);
    expect(b.token).toBe(a.token);
    expect(a.spaceId).toMatch(SPACE_ID_PATTERN);
    expect(a.token).toMatch(TOKEN_PATTERN);
  });

  test("different codes give different space ids and tokens", async () => {
    const a = await deriveCredentials(CODE);
    const b = await deriveCredentials(newRecoveryCode());
    expect(b.spaceId).not.toBe(a.spaceId);
    expect(b.token).not.toBe(a.token);
    expect(toBase64Url(fromBase64Url(a.token))).toBe(a.token);
    expect(a.token).not.toContain(a.spaceId);
  });

  test("keys are non-extractable and typed for their job", async () => {
    const { contentKey, recordKeyKey } = await deriveCredentials(CODE);
    expect(contentKey.extractable).toBe(false);
    expect(contentKey.algorithm.name).toBe("AES-GCM");
    expect(recordKeyKey.extractable).toBe(false);
    expect(recordKeyKey.algorithm.name).toBe("HMAC");
  });

  test("refuses text that isn't a recovery code", async () => {
    await expect(deriveCredentials("SHORT")).rejects.toThrow(/recovery code/);
    await expect(deriveCredentials("0".repeat(25))).rejects.toThrow(/recovery code/);
  });
});

describe("stored recovery code", () => {
  test("the key is not an mc- key, so it never travels in a save export", () => {
    expect(SYNC_CODE_STORAGE_KEY).toBe("mcsync.code");
    expect(SYNC_CODE_STORAGE_KEY.startsWith(SAVED_LOCAL_STORAGE_PREFIX)).toBe(false);
  });

  test("saves, loads and clears", () => {
    const storage = memory();
    expect(loadSyncCode(storage)).toBeNull();
    expect(saveSyncCode(storage, CODE)).toBe(true);
    expect(storage.map.get(SYNC_CODE_STORAGE_KEY)).toBe("ABCDEFGHJKMNPQRSTUVWXYZ23");
    expect(loadSyncCode(storage)).toBe("ABCDEFGHJKMNPQRSTUVWXYZ23");
    clearSyncCode(storage);
    expect(loadSyncCode(storage)).toBeNull();
  });

  test("refuses a malformed code and ignores a damaged stored one", () => {
    const storage = memory();
    expect(saveSyncCode(storage, "nope")).toBe(false);
    expect(storage.map.size).toBe(0);
    storage.map.set(SYNC_CODE_STORAGE_KEY, "garbage");
    expect(loadSyncCode(storage)).toBeNull();
  });

  test("blocked storage never throws", () => {
    expect(loadSyncCode(throwing)).toBeNull();
    expect(saveSyncCode(throwing, CODE)).toBe(false);
    expect(() => clearSyncCode(throwing)).not.toThrow();
  });
});
