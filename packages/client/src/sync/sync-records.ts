/**
 * How one synced record becomes what the server stores (issue #276, step 2). The server keeps an opaque key and an
 * opaque blob; the real name ("game:abc:meta", "db:decks:...") and the contents exist only on the devices.
 *
 *  - The stored key is an HMAC-SHA256 of the logical key under a key derived from the recovery code: deterministic,
 *    so every device finds the same record, and unlinkable to game or deck ids for anyone without the code.
 *  - The contents are JSON, gzipped (before encrypting, since ciphertext doesn't compress), then AES-256-GCM with a
 *    random 12-byte IV. The sealed JSON is `{ k: logicalKey, s: stamp, v: value }`, because a device pulling a record
 *    it has never seen holds only the server's record key. The record key is the GCM additional data, so a hostile or
 *    buggy server cannot hand back record A's ciphertext under record B's key, and opening checks that the logical
 *    key inside hashes to the record key it was stored under.
 *  - Layout, base64url: "MCS1" | iv(12) | ciphertext. One content key serves every record, which is safe because each
 *    seal uses a fresh random IV (a space holds far fewer than the 2^32 seals where random-IV collisions matter).
 */
import { fromBase64Url, toBase64Url } from "../save-data/transfer-crypto.js";
import type { SyncCredentials } from "./sync-credentials.js";

const MAGIC = new TextEncoder().encode("MCS1");
const IV_BYTES = 12;
const GCM_TAG_BYTES = 16;
const utf8 = new TextEncoder();

/**
 * The additional data is the magic plus the record key, so neither the format tag nor the key can be swapped.
 * Rollback is not prevented: a hostile server could replay an older ciphertext it once stored for a key, and it would
 * still open. The `stamp` sealed inside lets a merge prefer the newer record (the engine's last-write-wins), and that
 * is accepted: the server can withhold or roll back, but never read or forge.
 */
function aad(recordKey: string): Uint8Array<ArrayBuffer> {
  const key = utf8.encode(recordKey);
  const out = new Uint8Array(MAGIC.length + key.length);
  out.set(MAGIC, 0);
  out.set(key, MAGIC.length);
  return out;
}

/** A copy on a plain `ArrayBuffer`, which is what the WebCrypto types accept. */
function buf(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([buf(bytes)]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** The 43-character base64url key the server stores for a logical key. Deterministic per space. */
export async function recordKeyOf(creds: SyncCredentials, logicalKey: string): Promise<string> {
  const mac = await crypto.subtle.sign("HMAC", creds.recordKeyKey, buf(utf8.encode(logicalKey)));
  return toBase64Url(new Uint8Array(mac));
}

/** Throws if WebCrypto or CompressionStream is missing, or the value isn't JSON-serializable. */
export async function sealRecord(
  creds: SyncCredentials,
  logicalKey: string,
  value: unknown,
  stamp: number,
): Promise<{ recordKey: string; data: string }> {
  if (value === undefined) throw new Error("A record must be JSON-serializable.");
  const json = JSON.stringify({ k: logicalKey, s: stamp, v: value });
  const recordKey = await recordKeyOf(creds, logicalKey);
  const compressed = await pipe(utf8.encode(json), new CompressionStream("gzip"));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: buf(iv), additionalData: aad(recordKey) },
      creds.contentKey,
      buf(compressed),
    ),
  );
  const out = new Uint8Array(MAGIC.length + IV_BYTES + cipher.length);
  out.set(MAGIC, 0);
  out.set(iv, MAGIC.length);
  out.set(cipher, MAGIC.length + IV_BYTES);
  return { recordKey, data: toBase64Url(out) };
}

/** Reverses `sealRecord`. Throws an `Error` for a bad format, a wrong space or record key, or damaged contents. */
export async function openRecord(
  creds: SyncCredentials,
  recordKey: string,
  data: string,
): Promise<{ key: string; stamp: number; value: unknown }> {
  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(data);
  } catch {
    throw new Error("The synced record isn't valid base64url.");
  }
  const header = MAGIC.length + IV_BYTES;
  if (bytes.length < header + GCM_TAG_BYTES || !MAGIC.every((byte, i) => bytes[i] === byte)) {
    throw new Error("The synced record isn't in a format this version understands.");
  }
  let compressed: Uint8Array;
  try {
    compressed = new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: buf(bytes.subarray(MAGIC.length, header)),
          additionalData: aad(recordKey),
        },
        creds.contentKey,
        buf(bytes.subarray(header)),
      ),
    );
  } catch {
    throw new Error("The synced record couldn't be decrypted: wrong recovery code, wrong record or damaged data.");
  }
  let opened: { k?: unknown; s?: unknown; v?: unknown };
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      await pipe(compressed, new DecompressionStream("gzip")),
    );
    opened = JSON.parse(text) as typeof opened;
  } catch {
    throw new Error("The synced record was decrypted but its contents are damaged.");
  }
  if (typeof opened?.k !== "string" || typeof opened.s !== "number" || !("v" in opened)) {
    throw new Error("The synced record was decrypted but its contents are damaged.");
  }
  if ((await recordKeyOf(creds, opened.k)) !== recordKey) {
    throw new Error("The synced record's name doesn't match the key it was stored under.");
  }
  return { key: opened.k, stamp: opened.s, value: opened.v };
}
