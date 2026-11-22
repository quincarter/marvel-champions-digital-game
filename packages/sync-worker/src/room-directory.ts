/**
 * The "Live now" directory (issue #880, the owner's option A). A room whose host opted in (`settings.listed`) publishes
 * one small entry here; `GET /rooms/live` reads the newest few. One `RoomDirectory` Durable Object instance holds every
 * entry in ONE storage row, so an upsert or a removal is one row written, a read writes nothing (an expired entry is
 * hidden on read, and an alarm drops them), and the alarm is set only when none is pending. Entries expire
 * `LIVE_ENTRY_TTL_MS` after their last publish; the room refreshes while it is open. Nothing here is personal: the host
 * name, mode, scenario and seat counts are what the room's lobby already shows everyone in it.
 */

import type { KeyValueStorage } from "./env.js";
import {
  LIVE_DIRECTORY_MAX,
  LIVE_ENTRY_TTL_MS,
  LIVE_LIST_MAX,
  LIVE_TEXT_MAX,
  LOBBY_CODE_LENGTH,
  type LiveRoomEntry,
} from "./room-protocol.js";

const ROW = "entries";

/** What a room sends; the directory stamps `updatedAt`. */
export type LiveRoomInput = Omit<LiveRoomEntry, "updatedAt">;

const clip = (text: string): string => [...text.replace(/\s+/g, " ").trim()].slice(0, LIVE_TEXT_MAX).join("");

/** Cleans an input from a room: null when it is not a usable entry. */
export function cleanLiveInput(v: unknown): LiveRoomInput | null {
  if (typeof v !== "object" || v === null) return null;
  const r = v as Record<string, unknown>;
  if (typeof r.code !== "string" || r.code.length !== LOBBY_CODE_LENGTH) return null;
  if (typeof r.host !== "string" || (r.mode !== "strict" && r.mode !== "host")) return null;
  const count = (x: unknown) => (typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 99 ? x : null);
  const taken = count(r.seatsTaken);
  const total = count(r.seatsTotal);
  if (taken === null || total === null || typeof r.started !== "boolean") return null;
  const host = clip(r.host);
  if (host === "") return null;
  const scenario = typeof r.scenario === "string" ? clip(r.scenario) : "";
  return {
    code: r.code,
    host,
    mode: r.mode,
    ...(scenario ? { scenario } : {}),
    seatsTaken: taken,
    seatsTotal: total,
    started: r.started,
  };
}

export class RoomDirectoryLogic {
  constructor(private readonly storage: KeyValueStorage) {}

  private async entries(): Promise<Record<string, LiveRoomEntry>> {
    return (await this.storage.get<Record<string, LiveRoomEntry>>(ROW)) ?? {};
  }

  /** Adds or replaces a room's entry: one row, plus the alarm when none is pending. Over the cap, the oldest go. */
  async upsert(input: LiveRoomInput, now: number): Promise<void> {
    const all = await this.entries();
    all[input.code] = { ...input, updatedAt: now };
    const live = Object.values(all)
      .filter((e) => e.updatedAt + LIVE_ENTRY_TTL_MS > now)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, LIVE_DIRECTORY_MAX);
    await this.storage.put(ROW, Object.fromEntries(live.map((e) => [e.code, e])));
    if ((await this.storage.getAlarm()) === null) await this.storage.setAlarm(now + LIVE_ENTRY_TTL_MS);
  }

  /** Takes a room's entry out. No write when it is not there. */
  async remove(code: string): Promise<void> {
    const all = await this.entries();
    if (!(code in all)) return;
    delete all[code];
    await this.storage.put(ROW, all);
  }

  /** The newest entries (at most `LIVE_LIST_MAX`), skipping any whose time has passed. Writes nothing. */
  async list(now: number): Promise<LiveRoomEntry[]> {
    return Object.values(await this.entries())
      .filter((e) => e.updatedAt + LIVE_ENTRY_TTL_MS > now)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, LIVE_LIST_MAX);
  }

  /** The alarm: drops expired entries and sets the next alarm for the oldest left; the row goes when none is left. */
  async expire(now: number): Promise<void> {
    const all = await this.entries();
    const live = Object.values(all).filter((e) => e.updatedAt + LIVE_ENTRY_TTL_MS > now);
    if (live.length === 0) {
      await this.storage.deleteAll();
      return;
    }
    if (live.length !== Object.keys(all).length) {
      await this.storage.put(ROW, Object.fromEntries(live.map((e) => [e.code, e])));
    }
    await this.storage.setAlarm(Math.min(...live.map((e) => e.updatedAt)) + LIVE_ENTRY_TTL_MS);
  }
}
