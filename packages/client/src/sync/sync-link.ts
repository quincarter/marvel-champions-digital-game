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
 * recovery code. There is no short typed link code: a player without a camera types the 25-character recovery code
 * itself on the second device.
 */
import { CODE_ALPHABET, isRoomCode } from "@mc/sync-worker/protocol";
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

export type SendLinkResult =
  | { readonly ok: true; readonly link: SyncLinkAddress; readonly expiresAt: number }
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

/** A fresh long link key. */
export function newLinkKey(random?: RandomBytes): string {
  return randomCode(LINK_KEY_LENGTH, random);
}

const damaged = (detail: string): ReceiveLinkResult => ({ ok: false, failure: { kind: "damaged", detail } });

/** Puts the recovery code in a new transfer room under a long key; show `linkFragmentOf(link)` as a QR code. */
export async function sendSyncLink(recoveryCode: string, deps?: TransferDeps): Promise<SendLinkResult> {
  const code = parseRecoveryCode(recoveryCode);
  // A malformed code is a caller bug, not something the player can fix, so it is not one of the failure kinds.
  if (!code) throw new Error("sendSyncLink needs a valid recovery code.");
  const payload: SyncLink = { kind: SYNC_LINK_KIND, v: SYNC_LINK_VERSION, recoveryCode: code };
  const key = newLinkKey();
  const sent = await sendPayload(new TextEncoder().encode(JSON.stringify(payload)), deps, key);
  if (!sent.ok) return sent;
  return { ok: true, link: { room: sent.code.room, key }, expiresAt: sent.expiresAt };
}

/** Claims a room and returns the recovery code inside; a save file in the room is `damaged`, not a link. */
export async function receiveSyncLink(link: SyncLinkAddress, deps?: TransferDeps): Promise<ReceiveLinkResult> {
  const got = await receivePayload({ room: link.room, keyPart: link.key }, deps);
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
