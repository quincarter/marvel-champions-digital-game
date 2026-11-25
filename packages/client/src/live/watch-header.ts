/**
 * Reading a live table's header (docs/live-game-rooms.md, `live-publisher.ts`'s `LiveTableHeader`) on the watcher's
 * side. The room carries it as opaque JSON from the host, so nothing in it is trusted until it has the right shape.
 */
import { LIVE_HEADER_FORMAT, LIVE_HEADER_VERSION, type LiveTableHeader } from "./live-publisher.js";

/** The header as a `LiveTableHeader`, or null when it is not one this build can read (damaged, or a newer version). */
export function parseLiveHeader(value: unknown): LiveTableHeader | null {
  if (typeof value !== "object" || value === null) return null;
  const h = value as Partial<LiveTableHeader>;
  if (h.format !== LIVE_HEADER_FORMAT || typeof h.version !== "number" || h.version > LIVE_HEADER_VERSION) return null;
  if (typeof h.config !== "object" || h.config === null) return null;
  if (typeof h.initialState !== "object" || h.initialState === null) return null;
  if (typeof h.createdAt !== "number") return null;
  const writer = h.writer;
  if (!writer || typeof writer.appVersion !== "string" || typeof writer.contentVersion !== "string") return null;
  if (h.packs !== undefined && !Array.isArray(h.packs)) return null;
  return h as LiveTableHeader;
}
