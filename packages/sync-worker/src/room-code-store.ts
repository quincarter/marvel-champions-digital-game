/**
 * The lobby room code directory (docs/live-game-rooms.md section 8). A `RoomCode` Durable Object is named by one
 * 6-character code and holds one row: the room the code opens and when the mapping expires. The expiry matches the
 * room's own: the room moves it out whenever its idle alarm moves out and deletes the mapping when it closes, and an
 * alarm here removes a mapping whose room never came back to say so. Rows: a claim writes 2 (the mapping and the alarm),
 * a refresh 2, a release or expiry deletes both; a lookup writes nothing.
 */

import type { KeyValueStorage } from "./env.js";

interface CodeRow {
  readonly roomId: string;
  readonly expiresAt: number;
}

export class RoomCodeLogic {
  constructor(private readonly storage: KeyValueStorage) {}

  private async row(): Promise<CodeRow | undefined> {
    return this.storage.get<CodeRow>("code");
  }

  /** Takes the code for a room. False when a live (unexpired) mapping holds it, so the caller draws another code. */
  async claim(roomId: string, expiresAt: number, now: number): Promise<boolean> {
    const held = await this.row();
    if (held && held.expiresAt > now) return false;
    await this.storage.put("code", { roomId, expiresAt } satisfies CodeRow);
    await this.storage.setAlarm(expiresAt);
    return true;
  }

  /** The room a code opens, or null when it is unknown or expired (an expired mapping is deleted on the way). */
  async resolve(now: number): Promise<string | null> {
    const held = await this.row();
    if (!held) return null;
    if (held.expiresAt <= now) {
      await this.clear();
      return null;
    }
    return held.roomId;
  }

  /** The room moves its mapping's expiry. Only the room the code belongs to may; false otherwise. */
  async refresh(roomId: string, expiresAt: number): Promise<boolean> {
    const held = await this.row();
    if (held?.roomId !== roomId) return false;
    await this.storage.put("code", { roomId, expiresAt } satisfies CodeRow);
    await this.storage.setAlarm(expiresAt);
    return true;
  }

  /** The room deletes its mapping when it closes. Only the room the code belongs to may. */
  async release(roomId: string): Promise<boolean> {
    const held = await this.row();
    if (held?.roomId !== roomId) return false;
    await this.clear();
    return true;
  }

  /** The alarm: drops the mapping once its expiry has passed, else moves the alarm to it. */
  async expire(now: number): Promise<void> {
    const held = await this.row();
    if (!held) return;
    if (held.expiresAt <= now) await this.clear();
    else await this.storage.setAlarm(held.expiresAt);
  }

  private async clear(): Promise<void> {
    await this.storage.deleteAlarm();
    await this.storage.deleteAll();
  }
}
