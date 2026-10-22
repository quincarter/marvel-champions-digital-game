/**
 * Linking a new device to a sync space (issue #276, step 2): the recovery code travels once, encrypted, through a
 * save-transfer room (`save-data/transfer-client.ts`). The room protocol and the failure kinds are the transfer ones;
 * only the payload (a tiny JSON, not a save file) and the key differ.
 *
 * Threat model, and why the key is long: the typed save transfer seals under a 4-character key part (~20 bits), which
 * is fine for a save because the server never releases the upload to a wrong proof, but the Worker's operator sees the
 * proof and the ciphertext and could brute-force 20 bits offline in moments. For a save that is accepted; for the
 * recovery code it would hand the operator the space for good. So a link is sealed under a 22-character random key
 * (log2(31) x 22 = ~109 bits) that is never typed and never sent to the server: it travels only in a QR code's link
 * fragment (`#link=<ROOM>.<KEY>`, and a fragment never reaches a server). The proof and the AES key are derived from it
 * by the same HKDF steps as a key part, but 2^109 guesses are out of reach, so the operator sees nothing that yields the
 * recovery code from the QR link. A player without a camera can type a short link code (below) or the 25-character recovery code
 * itself on the second device.
 *
 * The typed link code (accepted tradeoff, owner decision 2026-10-22): next to the QR link, `sendSyncLink` also uploads
 * the same payload to a second room sealed under 8 random decimal digits, shown as "ABCD-EFGH 1234-5678" (room, then
 * digits), for a player who cannot scan. Two rooms, not one, because a room holds one proof and one ciphertext. The
 * digits are ~27 bits (10^8). Proof and seal come from them with the same HKDF construction as the typed transfer key
 * part (save-data/transfer-crypto.ts); stretching with PBKDF2 would not help, because an operator holding the proof
 * and ciphertext can still try every digit string offline. So: whoever runs the Worker holds the proof and the
 * ciphertext of that room during its 15-minute window and could brute-force the digits offline. That yields the
 * recovery code, and so lasting access to that player's space. The owner accepted this for game saves. The QR link
 * (~109 bits) and the recovery code itself are unaffected. Outsiders get at most 5 guesses per code: the room deletes
 * its upload after 5 wrong proofs, and the Worker blocks an address after repeated failed fetches; this file relies
 * on that and adds nothing.
 */
import { CODE_ALPHABET, ROOM_CODE_LENGTH, isRoomCode } from "@mc/sync-worker/protocol";
import { parseRecoveryCode } from "@mc/sync-worker/sync-protocol";
import { receivePayload, sendPayload, type TransferDeps, type TransferFailure } from "../save-data/transfer-client.js";
import { randomCode, type RandomBytes } from "../save-data/transfer-crypto.js";

export const SYNC_LINK_KIND = "mc-sync-link";
export const SYNC_LINK_VERSION = 1;
export const LINK_KEY_LENGTH = 22;

/** Where a link lives: the transfer room and the long key that opens it. */
export interface SyncLinkAddress {
  readonly room: string;
  readonly key: string;
}

interface SyncLink {
  readonly kind: typeof SYNC_LINK_KIND;
  readonly v: typeof SYNC_LINK_VERSION;
  readonly recoveryCode: string;
}

/** The typed code: the transfer room that holds the digit-sealed upload, and the 8 digits that open it. */
export interface SyncLinkCode {
  readonly room: string;
  readonly digits: string;
}

export type SendLinkResult =
  | {
      readonly ok: true;
      /** The long-key room, for the QR code. */
      readonly link: SyncLinkAddress;
      /** The digit-key room, for typing; a different room from `link.room`. */
      readonly typed: SyncLinkCode;
      /** The earlier of the two rooms' expiries. */
      readonly expiresAt: number;
    }
  | { readonly ok: false; readonly failure: TransferFailure };

export type ReceiveLinkResult =
  | { readonly ok: true; readonly recoveryCode: string }
  | { readonly ok: false; readonly failure: TransferFailure };

const KEY_CHARS = new RegExp(`^[${CODE_ALPHABET}]{${LINK_KEY_LENGTH}}$`);

/** The `#link=ROOM.KEY` fragment a link's QR code carries. */
export function linkFragmentOf(link: SyncLinkAddress): string {
  return `link=${link.room}.${link.key}`;
}

/** Reads `#link=ROOM.KEY` (with or without the `#`, any case); `null` for any other hash. */
export function parseLinkFragment(hash: string): SyncLinkAddress | null {
  const match = /^#?link=([A-Za-z0-9]{8})\.([A-Za-z0-9]{22})$/.exec(hash.trim());
  if (!match) return null;
  const room = match[1]!.toUpperCase();
  const key = match[2]!.toUpperCase();
  return isRoomCode(room) && KEY_CHARS.test(key) ? { room, key } : null;
}

export const LINK_DIGITS_LENGTH = 8;

/** "ABCD-EFGH 1234-5678": the room, then the digits, in groups of four. */
export function formatLinkCode(code: SyncLinkCode): string {
  return `${code.room.slice(0, 4)}-${code.room.slice(4)} ${code.digits.slice(0, 4)}-${code.digits.slice(4)}`;
}

/** A typed link code in any case and grouping; `null` unless 8 characters of the alphabet then 8 digits. */
export function parseLinkCode(input: string): SyncLinkCode | null {
  const text = input.toUpperCase().replace(/[\s\-.]+/g, "");
  if (text.length !== ROOM_CODE_LENGTH + LINK_DIGITS_LENGTH) return null;
  const room = text.slice(0, ROOM_CODE_LENGTH);
  const digits = text.slice(ROOM_CODE_LENGTH);
  return isRoomCode(room) && /^[0-9]{8}$/.test(digits) ? { room, digits } : null;
}

/** Eight decimal digits, uniformly: bytes of 250 and above are rejected (256 is not a multiple of 10). */
export function newLinkDigits(random: RandomBytes = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  let out = "";
  while (out.length < LINK_DIGITS_LENGTH) {
    for (const byte of random(LINK_DIGITS_LENGTH * 2)) {
      if (byte >= 250) continue;
      out += String(byte % 10);
      if (out.length === LINK_DIGITS_LENGTH) break;
    }
  }
  return out;
}

/** A fresh long link key. */
export function newLinkKey(random?: RandomBytes): string {
  return randomCode(LINK_KEY_LENGTH, random);
}

const damaged = (detail: string): ReceiveLinkResult => ({ ok: false, failure: { kind: "damaged", detail } });

/**
 * Puts the recovery code in two new transfer rooms: one under a long key (show `linkFragmentOf(link)` as a QR code)
 * and one under 8 digits (show `formatLinkCode(typed)`). If the second upload fails the whole send fails.
 */
export async function sendSyncLink(recoveryCode: string, deps?: TransferDeps): Promise<SendLinkResult> {
  const code = parseRecoveryCode(recoveryCode);
  // A malformed code is a caller bug, not something the player can fix, so it is not one of the failure kinds.
  if (!code) throw new Error("sendSyncLink needs a valid recovery code.");
  const payload: SyncLink = { kind: SYNC_LINK_KIND, v: SYNC_LINK_VERSION, recoveryCode: code };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const key = newLinkKey();
  const digits = newLinkDigits();
  const sent = await sendPayload(bytes, deps, key);
  if (!sent.ok) return sent;
  const typed = await sendPayload(bytes, deps, digits);
  if (!typed.ok) return typed;
  return {
    ok: true,
    link: { room: sent.code.room, key },
    typed: { room: typed.code.room, digits },
    expiresAt: Math.min(sent.expiresAt, typed.expiresAt),
  };
}

/** Claims the digit-key room from a typed code; the result is the same as `receiveSyncLink`'s. */
export function receiveSyncLinkCode(typed: SyncLinkCode, deps?: TransferDeps): Promise<ReceiveLinkResult> {
  return receiveFrom(typed.room, typed.digits, deps);
}

/** Claims a room and returns the recovery code inside; a save file in the room is `damaged`, not a link. */
export function receiveSyncLink(link: SyncLinkAddress, deps?: TransferDeps): Promise<ReceiveLinkResult> {
  return receiveFrom(link.room, link.key, deps);
}

async function receiveFrom(room: string, key: string, deps?: TransferDeps): Promise<ReceiveLinkResult> {
  const got = await receivePayload({ room, keyPart: key }, deps);
  if (!got.ok) return got;
  let body: unknown;
  try {
    body = JSON.parse(got.text);
  } catch {
    return damaged("The transfer isn't a device-sync link.");
  }
  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  if (record.format === "mc-save-data") {
    return damaged("This code holds a save file, not a device-sync link: use Receive a save.");
  }
  if (record.kind !== SYNC_LINK_KIND) return damaged("The transfer isn't a device-sync link.");
  if (record.v !== SYNC_LINK_VERSION) {
    return damaged("This link was made by a different version of the game: update both devices and try again.");
  }
  const recoveryCode = typeof record.recoveryCode === "string" ? parseRecoveryCode(record.recoveryCode) : null;
  if (!recoveryCode) return damaged("The link's recovery code is damaged.");
  return { ok: true, recoveryCode };
}
