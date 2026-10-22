/**
 * The recovery code and everything derived from it (issue #276, step 2). One 25-character code is all a device needs
 * to join a sync space: HKDF-SHA256 turns it into the space id, the bearer token and two keys, so nothing else is
 * stored or sent between devices.
 *
 * Why 25 characters (log2(31) x 25 = ~124 bits) is enough: the code is a random secret, not a password a person chose,
 * so the only attack is guessing it offline against what the server keeps. The server sees the space id, a SHA-256 of
 * the token and ciphertext; it never sees the code, the token, or either key. An attacker holding all of that must
 * still search 2^124 codes, and each guess costs an HKDF plus a hash or a decrypt, so no hardware makes that
 * feasible. Online guessing is separately capped by the Worker's per-IP failed-attempt limit. Because the secret
 * is this large, a fixed salt and a fast KDF are fine; slow hashing would only add battery cost on a phone.
 *
 * Linking a second device never shows the Worker anything that yields the code: the code is sealed under a ~109-bit
 * random key that travels only in a QR link's fragment (`sync-link.ts`), not under the 20-bit typed transfer key part.
 *
 * The four outputs use distinct `info` strings, so knowing one (the token goes over the wire on every request) tells
 * an attacker nothing about the others.
 *
 * Local persistence: a device keeps only the recovery code. It lives under `mcsync.code`, deliberately NOT `mc-*`:
 * every `mc-*` localStorage key travels in a save export and would itself be synced, which would copy the secret
 * into backups and onto every device's record store.
 */
import { RECOVERY_CODE_LENGTH, parseRecoveryCode } from "@mc/sync-worker/sync-protocol";
import { fromBase64Url, randomCode, toBase64Url, type RandomBytes } from "../save-data/transfer-crypto.js";

export { fromBase64Url, toBase64Url };

export const SYNC_CODE_STORAGE_KEY = "mcsync.code";

const SALT = "mc-sync/v1";
const INFO_SPACE = "mc-sync/v1/space-id";
const INFO_TOKEN = "mc-sync/v1/token";
const INFO_CONTENT = "mc-sync/v1/content-aes-gcm";
const INFO_RECORD_KEY = "mc-sync/v1/record-key-hmac";

const utf8 = new TextEncoder();

const platformRandom: RandomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));

export interface SyncCredentials {
  /** The normalized 25-character code these were derived from. */
  readonly recoveryCode: string;
  /** 32 lowercase hex characters: the space's address on the server. */
  readonly spaceId: string;
  /** 43-character base64url bearer token. */
  readonly token: string;
  /** AES-256-GCM, for record contents. Not extractable. */
  readonly contentKey: CryptoKey;
  /** HMAC-SHA256, for turning a logical record name into the opaque key the server stores. Not extractable. */
  readonly recordKeyKey: CryptoKey;
}

/**
 * A fresh recovery code, uniformly: bytes at or above the largest multiple of the alphabet size are rejected, so no
 * character is likelier than another (256 is not a multiple of 31).
 */
export function newRecoveryCode(random: RandomBytes = platformRandom): string {
  return randomCode(RECOVERY_CODE_LENGTH, random);
}

function params(info: string): HkdfParams {
  return { name: "HKDF", hash: "SHA-256", salt: utf8.encode(SALT), info: utf8.encode(info) };
}

/** Throws an `Error` when the text isn't a recovery code, or when WebCrypto is missing. */
export async function deriveCredentials(recoveryCode: string): Promise<SyncCredentials> {
  const code = parseRecoveryCode(recoveryCode);
  if (!code) throw new Error("That isn't a recovery code: it is 25 letters and digits.");
  const material = await crypto.subtle.importKey("raw", utf8.encode(code), "HKDF", false, ["deriveBits", "deriveKey"]);
  const bits = async (info: string, length: number) =>
    new Uint8Array(await crypto.subtle.deriveBits(params(info), material, length));
  const spaceBytes = await bits(INFO_SPACE, 128);
  const tokenBytes = await bits(INFO_TOKEN, 256);
  const contentKey = await crypto.subtle.deriveKey(
    params(INFO_CONTENT),
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const recordKeyKey = await crypto.subtle.deriveKey(
    params(INFO_RECORD_KEY),
    material,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign"],
  );
  const spaceId = Array.from(spaceBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { recoveryCode: code, spaceId, token: toBase64Url(tokenBytes), contentKey, recordKeyKey };
}

/** What the credentials need from `localStorage`; a test passes a Map-backed one. */
export type CodeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The saved recovery code, or `null` when none is saved, it is damaged, or storage is blocked (private mode). */
export function loadSyncCode(storage: CodeStorage): string | null {
  try {
    const stored = storage.getItem(SYNC_CODE_STORAGE_KEY);
    return stored ? parseRecoveryCode(stored) : null;
  } catch {
    return null;
  }
}

/** `false` when the code is malformed or storage refused it. */
export function saveSyncCode(storage: CodeStorage, code: string): boolean {
  const parsed = parseRecoveryCode(code);
  if (!parsed) return false;
  try {
    storage.setItem(SYNC_CODE_STORAGE_KEY, parsed);
    return true;
  } catch {
    return false;
  }
}

export function clearSyncCode(storage: CodeStorage): void {
  try {
    storage.removeItem(SYNC_CODE_STORAGE_KEY);
  } catch {
    // Nothing to clear if storage is unreachable.
  }
}
