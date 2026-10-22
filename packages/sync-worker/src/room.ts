/**
 * One transfer room: holds at most one upload until it is claimed once or its time runs out. The logic works over a
 * plain storage interface (the Durable Object class is a thin wrapper), so tests run it without workerd.
 *
 * The upload is split into chunks because one storage value is capped (about 2 MiB on SQLite-backed objects); the
 * metadata keeps only a SHA-256 of the proof, never the proof, and the claim compares hashes in constant time.
 */

import type { KeyValueStorage } from "./env.js";

export const CHUNK_BYTES = 512 * 1024;

/** After this many wrong proofs the upload is deleted, capping guesses at the key part however many IPs guess. */
export const MAX_WRONG_PROOFS = 5;

interface RoomMeta {
  readonly proofHash: string;
  readonly expiresAt: number;
  readonly chunks: number;
  readonly size: number;
  /** Wrong proofs so far; the upload is deleted at MAX_WRONG_PROOFS. */
  readonly wrong: number;
}

export type ClaimResult =
  | { readonly ok: true; readonly body: Uint8Array }
  | { readonly ok: false; readonly why: "missing" | "wrong" };

export async function hashProof(proof: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(proof)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export class RoomLogic {
  constructor(private readonly storage: KeyValueStorage) {}

  private async liveMeta(now: number): Promise<RoomMeta | undefined> {
    const meta = await this.storage.get<RoomMeta>("meta");
    if (!meta) return undefined;
    if (meta.expiresAt <= now) {
      await this.clear();
      return undefined;
    }
    return meta;
  }

  private async clear(): Promise<void> {
    await this.storage.deleteAll();
    await this.storage.deleteAlarm();
  }

  /** Stores an upload; `null` when the room is already occupied by a live upload. */
  async store(proof: string, body: Uint8Array, now: number, ttlMs: number): Promise<{ expiresAt: number } | null> {
    // Hash first: an await on something other than storage in the middle of the writes would open the input gate.
    const proofHash = await hashProof(proof);
    if (await this.liveMeta(now)) return null;
    const expiresAt = now + ttlMs;
    const chunks = Math.ceil(body.length / CHUNK_BYTES);
    for (let i = 0; i < chunks; i++) {
      await this.storage.put(`c${i}`, body.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES));
    }
    const meta: RoomMeta = { proofHash, expiresAt, chunks, size: body.length, wrong: 0 };
    await this.storage.put("meta", meta);
    await this.storage.setAlarm(expiresAt);
    return { expiresAt };
  }

  /** Hands the upload over once, on a matching proof. A wrong proof leaves it in place. */
  async claim(proof: string, now: number): Promise<ClaimResult> {
    const proofHash = await hashProof(proof);
    const meta = await this.liveMeta(now);
    if (!meta) return { ok: false, why: "missing" };
    if (!constantTimeEqual(proofHash, meta.proofHash)) {
      if (meta.wrong + 1 >= MAX_WRONG_PROOFS) await this.clear();
      else await this.storage.put("meta", { ...meta, wrong: meta.wrong + 1 });
      return { ok: false, why: "wrong" };
    }
    const body = new Uint8Array(meta.size);
    for (let i = 0; i < meta.chunks; i++) {
      const chunk = await this.storage.get<Uint8Array>(`c${i}`);
      if (chunk) body.set(chunk, i * CHUNK_BYTES);
    }
    await this.clear();
    return { ok: true, body };
  }

  /** The alarm: whatever is left is expired. */
  async expire(): Promise<void> {
    await this.clear();
  }
}
