/**
 * The cryptography of a transfer room: the key part, the proof the server checks, and the sealed upload. The payload is
 * a save file (`sealSaveFile`) or any bytes (`sealPayload`, used by the device-sync link in `sync/sync-link.ts`), and
 * the key string can be the 4-character typed key part or a long random key; every function below takes any string.
 * Pure WebCrypto and CompressionStream, so it runs the same in a browser, a webview and Node.
 *
 * A transfer code is an 8-character room (chosen by the server) plus a 4-character key part (chosen here, from
 * `CODE_ALPHABET`). The save is gzipped, then encrypted with AES-256-GCM under a key derived from the key part, and
 * only then uploaded, so the server never holds the key part or a readable save. The upload carries a proof, also
 * derived from the key part, and the server hands the bytes to a fetch only if it presents the same proof.
 *
 * Why this is enough, and where it stops:
 *  - A code is ~39.6 bits of room + ~19.8 bits of key part = ~59.5 bits. That is small for a password, so the design
 *    never lets a guesser at the ciphertext: the server releases an upload only to a fetch with the matching proof.
 *    Guessing the whole code online is hopeless: the Worker rate-limits failed fetches per address (per /64 for IPv6)
 *    to about 100 tries per address per day, against a handful of live rooms out of 2^59.5 codes. If someone learns
 *    the room (say by seeing 8 of the 12 characters), only the key part protects it, but a room deletes its upload
 *    after 5 wrong proofs, so that is at most 5 tries against ~950k key parts before the save is destroyed. A wrong
 *    guess returns no ciphertext, so there is nothing to attack offline. Uploads also live 15 minutes at most and
 *    are deleted on the first successful read.
 *  - The honest limit: the operator of the Worker sees the room, the proof and the ciphertext. The proof is a fast
 *    function of the 20-bit key part, so the operator could brute-force the key part offline in moments and then
 *    decrypt. This protects a save from everyone except whoever runs the Worker. A longer secret in the QR link would
 *    close that gap; one scheme for typed and scanned codes was chosen for simplicity, since a save is game progress,
 *    not anything sensitive.
 *  - The proof does not use the room: the upload is encrypted (and the proof made) before the server picks the room.
 *    Its fixed salt is fine, because the proof's only job is to be equal on both devices, and a per-upload salt
 *    would not raise the bar against the operator, who has the whole 20-bit space to try either way.
 *  - gzip comes before encryption because ciphertext does not compress. A save is repetitive JSON and shrinks a lot.
 *  - The key's salt is random per upload, so two uploads with the same key part never share an AES key, and the
 *    12-byte IV is random per upload. The 4-byte magic "MCT1" is the AES-GCM additional data, so the format tag
 *    can't be swapped without failing the tag check.
 */
import { CODE_ALPHABET, KEY_PART_LENGTH } from "@mc/sync-worker/protocol";
import type { SaveFile } from "./save-file.js";

const MAGIC = new TextEncoder().encode("MCT1");
const SALT_BYTES = 16;
const IV_BYTES = 12;
const GCM_TAG_BYTES = 16;
const PROOF_SALT = "mc-save-transfer/v1/proof";
const PROOF_INFO = "proof";
const KEY_INFO = "mc-save-transfer/v1/aes-gcm";

const utf8 = new TextEncoder();

/** Returns `length` random bytes; the default is the platform CSPRNG. */
export type RandomBytes = (length: number) => Uint8Array;

const platformRandom: RandomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));

/** A copy on a plain `ArrayBuffer`, which is what the WebCrypto types accept (they refuse `ArrayBufferLike`). */
function buf(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

/**
 * Four characters of `CODE_ALPHABET`, uniformly: bytes at or above the largest multiple of the alphabet size are
 * rejected, so no character is likelier than another (256 is not a multiple of 31).
 */
export function newKeyPart(random: RandomBytes = platformRandom): string {
  return randomCode(KEY_PART_LENGTH, random);
}

/** `length` characters of `CODE_ALPHABET`, uniformly (rejection sampling, as `newKeyPart` describes). */
export function randomCode(length: number, random: RandomBytes = platformRandom): string {
  const size = CODE_ALPHABET.length;
  const limit = 256 - (256 % size);
  let out = "";
  while (out.length < length) {
    for (const byte of random(length * 2)) {
      if (byte >= limit) continue;
      out += CODE_ALPHABET[byte % size]!;
      if (out.length === length) break;
    }
  }
  return out;
}

function hkdfMaterial(keyPart: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", buf(utf8.encode(keyPart)), "HKDF", false, ["deriveBits", "deriveKey"]);
}

function hkdfParams(salt: Uint8Array, info: string): HkdfParams {
  return { name: "HKDF", hash: "SHA-256", salt: buf(salt), info: buf(utf8.encode(info)) };
}

async function aesKey(keyPart: string, salt: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    hkdfParams(salt, KEY_INFO),
    await hkdfMaterial(keyPart),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Unpadded base64url; the one helper the transfer proof, the sync credentials and the sync records share. */
export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Throws an `Error` when the text is not base64url. */
export function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error("Not base64url.");
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** What the server stores and compares: 32 bytes of HKDF output in unpadded base64url. Deterministic per key part. */
export async function proofOf(keyPart: string): Promise<string> {
  const bits = await crypto.subtle.deriveBits(
    hkdfParams(utf8.encode(PROOF_SALT), PROOF_INFO),
    await hkdfMaterial(keyPart),
    256,
  );
  return toBase64Url(new Uint8Array(bits));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([buf(bytes)]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** "MCT1" | salt(16) | iv(12) | AES-256-GCM ciphertext of the gzipped JSON. */
export async function sealSaveFile(
  file: SaveFile,
  keyPart: string,
  random: RandomBytes = platformRandom,
): Promise<Uint8Array> {
  return await sealPayload(utf8.encode(JSON.stringify(file)), keyPart, random);
}

/** The same envelope around any bytes (a device-sync link is a small JSON, not a save): gzip, then AES-256-GCM. */
export async function sealPayload(
  payload: Uint8Array,
  keyPart: string,
  random: RandomBytes = platformRandom,
): Promise<Uint8Array> {
  const compressed = await pipe(payload, new CompressionStream("gzip"));
  const salt = random(SALT_BYTES);
  const iv = random(IV_BYTES);
  const key = await aesKey(keyPart, salt);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: buf(iv), additionalData: buf(MAGIC) }, key, buf(compressed)),
  );
  const out = new Uint8Array(MAGIC.length + SALT_BYTES + IV_BYTES + cipher.length);
  out.set(MAGIC, 0);
  out.set(salt, MAGIC.length);
  out.set(iv, MAGIC.length + SALT_BYTES);
  out.set(cipher, MAGIC.length + SALT_BYTES + IV_BYTES);
  return out;
}

/** Reverses `sealSaveFile`, returning the JSON text. Throws an `Error` on a bad magic or a failed decrypt. */
export async function openSealed(bytes: Uint8Array, keyPart: string): Promise<string> {
  const header = MAGIC.length + SALT_BYTES + IV_BYTES;
  if (bytes.length < header + GCM_TAG_BYTES || !MAGIC.every((byte, i) => bytes[i] === byte)) {
    throw new Error("This isn't a Marvel Champions save transfer.");
  }
  const salt = bytes.subarray(MAGIC.length, MAGIC.length + SALT_BYTES);
  const iv = bytes.subarray(MAGIC.length + SALT_BYTES, header);
  const key = await aesKey(keyPart, salt);
  let compressed: Uint8Array;
  try {
    compressed = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: buf(iv), additionalData: buf(MAGIC) },
        key,
        buf(bytes.subarray(header)),
      ),
    );
  } catch {
    throw new Error("The save couldn't be decrypted: the code is wrong or the data was damaged.");
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(await pipe(compressed, new DecompressionStream("gzip")));
  } catch {
    throw new Error("The save was decrypted but its contents are damaged.");
  }
}
