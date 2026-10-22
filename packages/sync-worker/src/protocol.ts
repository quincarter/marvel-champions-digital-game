/**
 * The save-transfer wire protocol, shared by the Worker and the client (`@mc/sync-worker/protocol`). Pure: no Worker
 * or DOM APIs, so both sides import it.
 *
 * A transfer code is 12 characters: 8 that name the room (the Durable Object holding the upload) and 4 that only the
 * two devices know (the key part). The sender's device encrypts the save with a key derived from the key part and
 * uploads it with a proof also derived from it; the server hands the upload over only to a fetch that names the room
 * and presents the same proof, then deletes it. The server learns the room and the proof, never the key part or the
 * save. See `packages/client/src/save-data/transfer-crypto.ts` for the derivation and why ~59 bits are enough.
 *
 * Players read the code aloud or type it on a phone, so the alphabet leaves out every character that looks like
 * another: 0/O, 1/I/L. That leaves 31 symbols (digits 2-9 and 23 letters), not 32: per character log2(31) ≈ 4.95
 * bits, so the room is ≈ 39.6 bits and the key part ≈ 19.8.
 */

export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const ROOM_CODE_LENGTH = 8;
export const KEY_PART_LENGTH = 4;
export const TRANSFER_CODE_LENGTH = ROOM_CODE_LENGTH + KEY_PART_LENGTH;

/** How long an unclaimed upload waits before the room's alarm deletes it. */
export const TRANSFER_TTL_MS = 15 * 60 * 1000;

/** The Worker's default upload cap; the deployed value is the `MAX_UPLOAD_BYTES` var. */
export const DEFAULT_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** Carries the base64url proof on both the upload and the fetch. */
export const PROOF_HEADER = "X-Transfer-Proof";

/** Carries a Turnstile token on upload, checked only when the Worker has a `TURNSTILE_SECRET`. */
export const TURNSTILE_HEADER = "CF-Turnstile-Response";

/** A proof is 32 bytes in unpadded base64url. */
export const PROOF_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** `POST /transfer` answers this with 201. */
export interface TransferCreated {
  /** The 8-character room code. The client appends its own key part before showing it. */
  readonly code: string;
  /** Milliseconds since the epoch. */
  readonly expiresAt: number;
}

export type TransferErrorReason =
  | "disabled"
  | "origin"
  | "bad-request"
  | "too-large"
  | "rate-limited"
  | "blocked"
  | "turnstile"
  | "not-found"
  | "server";

/** Every non-2xx answer's body. */
export interface TransferError {
  readonly reason: TransferErrorReason;
  readonly error: string;
}

const CODE_CHAR = new RegExp(`^[${CODE_ALPHABET}]+$`);

export function isRoomCode(value: string): boolean {
  return value.length === ROOM_CODE_LENGTH && CODE_CHAR.test(value);
}

export function isKeyPart(value: string): boolean {
  return value.length === KEY_PART_LENGTH && CODE_CHAR.test(value);
}

/** What a player typed, uppercased, with spaces, dashes and dots taken out. */
export function normalizeCodeInput(input: string): string {
  return input.toUpperCase().replace(/[\s\-.]+/g, "");
}

export interface TransferCode {
  readonly room: string;
  readonly keyPart: string;
}

/** A typed code in any case and grouping ("abcd efgh jkmn", "ABCD-EFGH-JKMN"); `null` unless 12 good characters. */
export function parseTransferCode(input: string): TransferCode | null {
  const code = normalizeCodeInput(input);
  if (code.length !== TRANSFER_CODE_LENGTH) return null;
  const room = code.slice(0, ROOM_CODE_LENGTH);
  const keyPart = code.slice(ROOM_CODE_LENGTH);
  return isRoomCode(room) && isKeyPart(keyPart) ? { room, keyPart } : null;
}

/** How the code is shown and read aloud: "ABCD-EFGH-JKMN". */
export function formatTransferCode(code: TransferCode): string {
  const all = code.room + code.keyPart;
  return `${all.slice(0, 4)}-${all.slice(4, 8)}-${all.slice(8)}`;
}

/** The `#receive=ROOM.KEY` fragment a QR code's link carries. A fragment never reaches a server. */
export function receiveFragmentOf(code: TransferCode): string {
  return `receive=${code.room}.${code.keyPart}`;
}

/** Reads `#receive=ROOM.KEY` (with or without the `#`); `null` for any other hash. */
export function parseReceiveFragment(hash: string): TransferCode | null {
  const match = /^#?receive=([A-Za-z0-9]{8})\.([A-Za-z0-9]{4})$/.exec(hash.trim());
  if (!match) return null;
  return parseTransferCode(match[1]! + match[2]!);
}
