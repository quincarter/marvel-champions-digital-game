/**
 * `RoomState.epic` (Epic Multiplayer, issue #882) folded from what the room says: the lobby's tables and pods, the
 * roster, each table's info, the per-table watcher counts and the organizer's last `pod:state`. A pure function, so the
 * screens' view of a pod is tested without a socket.
 */
import { FIRST_TABLE, type LobbyState, type Participant, type TableInfo } from "@mc/sync-worker/room-protocol";
import { readEpicStart } from "./epic-start.js";
import type { PodStateWire } from "./pod-wire.js";
import type { EpicPod, EpicState, EpicTable, EpicTableRole, EpicTableStatus, RemoteTarget } from "./room-state.js";

export interface EpicViewInput {
  readonly lobby: LobbyState | null;
  readonly participants: readonly Participant[];
  readonly meId: string | null;
  readonly tableInfos: ReadonlyMap<string, TableInfo>;
  /** `roster.watching`: watchers following each table. */
  readonly watching: Readonly<Record<string, number>>;
  readonly podState: PodStateWire | null;
  /** What this device asked to follow (`follow`); a table it hosts or holds a seat at is always received. */
  readonly follow: "all" | readonly string[];
  /** Ids of the seats I hold. */
  readonly mySeats: readonly string[];
}

/** The table a participant runs: a host's own (`Participant.table`), else null. */
export const hostedTableOf = (me: Participant | undefined): string | null =>
  me?.role === "host" && me.table !== undefined ? me.table : null;

export function epicStateOf(input: EpicViewInput): EpicState | null {
  const { lobby } = input;
  if (!lobby || lobby.settings.mode !== "epic") return null;
  const me = input.participants.find((p) => p.id === input.meId);
  const hostsTable = hostedTableOf(me);
  const seatTable = (seat: { readonly table?: string }): string => seat.table ?? FIRST_TABLE;
  const mySeatTables = lobby.seats.filter((s) => input.mySeats.includes(s.id)).map(seatTable);
  const myTable = hostsTable ?? mySeatTables[0] ?? null;
  const groups = new Map((input.podState?.groups ?? []).map((g) => [g.groupId as string, g]));
  const nameOf = (id: string | undefined): string | null =>
    id === undefined ? null : (input.participants.find((p) => p.id === id)?.name ?? null);

  const tables: EpicTable[] = (lobby.tables ?? []).map((table) => {
    const info = input.tableInfos.get(table.id);
    const group = groups.get(table.id);
    const started = info?.hasHeader === true;
    const status: EpicTableStatus = group?.dropped
      ? "dropped"
      : group?.status.phase === "over" || info?.ended === true
        ? "over"
        : !started
          ? "lobby"
          : info?.hostConnected === false
            ? "waiting"
            : group?.status.halted
              ? "halted"
              : (group?.status.phase ?? "setup");
    const role: EpicTableRole =
      hostsTable === table.id ? "host" : mySeatTables.includes(table.id) ? "player" : "watcher";
    return {
      id: table.id,
      name: table.name,
      pod: table.pod,
      difficulty: table.difficulty ?? null,
      host: table.host ?? null,
      hostName: nameOf(table.host),
      hostConnected: info?.hostConnected ?? false,
      seats: lobby.seats.filter((s) => seatTable(s) === table.id).map((s) => s.id),
      myRole: role,
      status,
      round: group?.status.round ?? 0,
      started,
      commands: info?.commands ?? 0,
      watching: input.watching[table.id] ?? 0,
      followed: role !== "watcher" || input.follow === "all" || input.follow.includes(table.id),
    };
  });

  const pods: EpicPod[] = (lobby.pods ?? []).map((pod) => ({
    id: pod.id,
    name: pod.name,
    tables: tables.filter((t) => t.pod === pod.id).map((t) => t.id),
  }));

  const mine = tables.find((t) => t.id === myTable);
  const remoteTargets: RemoteTarget[] = [];
  if (mine) {
    for (const table of tables) {
      if (table.id === mine.id || table.pod !== mine.pod) continue;
      const group = groups.get(table.id);
      if (!group || group.dropped) continue;
      for (const card of group.reachable) remoteTargets.push({ table: table.id, tableName: table.name, card });
    }
  }

  return {
    organizer: me?.organizer === true,
    hostsTable,
    myTable,
    tables,
    pods,
    start: readEpicStart(lobby.settings.tableRules),
    pod: input.podState ? { shared: input.podState.shared, outcome: input.podState.outcome } : null,
    remoteTargets,
    following: input.follow,
  };
}
