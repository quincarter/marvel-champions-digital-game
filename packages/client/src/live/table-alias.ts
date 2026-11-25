/**
 * Epic Multiplayer (issue #882): a device that follows one table of an Epic room (its own, as a seat holder or watcher)
 * feeds that table to its watcher or seat worker as if the room had one table. Those workers were built for a one-table
 * room and know only `FIRST_TABLE`; the room session renames the followed table's messages on the way in (`aliasTable`)
 * and the table on a seat's proposal on the way out, so nothing below the session needs to know about Epic.
 */
import type { ServerMessage } from "@mc/sync-worker/room-protocol";

/**
 * `message` as the one-table room would have sent it, with `from` renamed `to`; null when it names another table (or is
 * a table's own info for one) and so is not for this follower. A message that names no table is returned unchanged.
 */
export function aliasTable(message: ServerMessage, from: string, to: string): ServerMessage | null {
  if (message.ch === "game" && "table" in message) {
    if (message.table !== from) return null;
    return from === to ? message : ({ ...message, table: to } as ServerMessage);
  }
  if (message.ch === "room" && message.kind === "table") {
    if (message.table.id !== from) return null;
    return from === to ? message : { ...message, table: { ...message.table, id: to } };
  }
  if (message.ch === "room" && message.kind === "welcome") {
    const tables = message.tables.filter((t) => t.id === from).map((t) => (from === to ? t : { ...t, id: to }));
    return { ...message, tables };
  }
  return message;
}
