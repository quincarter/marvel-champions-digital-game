/**
 * What the Epic lobby shows and what the organizer's edits send (Trickster Takeover Epic Multiplayer, issue #882,
 * docs/live-game-rooms.md section 10), as plain data worked out from `RoomState.epic`. Nothing here decides a rule:
 * which tables, pods, seats and hosts are allowed is the room's call (`setEpic`, `assignTableHost`); this only builds the
 * plan the room is asked for, words what it reports, and says why Start is off where the room would refuse anyway.
 *
 * The organizer's plan is edited by pure functions over `EpicPlan` (the plan as the room last reported it), so each
 * press sends the whole new plan and the room's echo is what the screen draws: no second copy of the state.
 */
import { MAX_LOBBY_TABLES, MAX_TABLE_NAME_CHARS } from "@mc/sync-worker/room-protocol";
import type { MessageKey } from "../i18n/translate.js";
import type {
  EpicTable,
  EpicTableStatus,
  LobbyPod,
  LobbySeatSpec,
  LobbyTableSpec,
  RoomState,
} from "../live/room-state.js";
import { seatRows, type SeatContext, type SeatRowView, type Words } from "./room-lobby-model.js";

/** The fewest and most tables an Epic game has (the room refuses others). */
export const MIN_EPIC_TABLES = 2;
export const MAX_EPIC_TABLES = MAX_LOBBY_TABLES;
/** A table is a group of 1 to 4 players (MC55 p. 9). */
export const MIN_TABLE_SEATS = 1;
export const MAX_TABLE_SEATS = 4;

/** A seat whose hero the organizer has not chosen yet: the room keeps labels as opaque text. */
export const HERO_UNSET = "?";

export type EpicDifficulty = "standard" | "expert";

/** The plan the organizer edits and `setEpic` takes. Table `host` is never in it: the room keeps each table's host. */
export interface EpicPlan {
  readonly tables: readonly LobbyTableSpec[];
  readonly pods: readonly LobbyPod[];
  readonly seats: readonly LobbySeatSpec[];
}

const tableIdOf = (index: number): string => `t${index + 1}`;
const podIdOf = (index: number): string => `p${index + 1}`;
const seatIdOf = (table: string, index: number): string => `${table}s${index + 1}`;
const unsetSeat = (table: string, index: number): LobbySeatSpec => ({
  id: seatIdOf(table, index),
  label: HERO_UNSET,
  table,
});

/** `difficulty` as the table carries it (opaque JSON in the room): anything but "expert" is standard. */
export const difficultyOf = (value: unknown): EpicDifficulty => (value === "expert" ? "expert" : "standard");

/** The starting plan: two tables in one pod, one open seat each. */
export function newEpicPlan(): EpicPlan {
  const tables = [0, 1].map((i) => ({
    id: tableIdOf(i),
    name: `Table ${i + 1}`,
    pod: podIdOf(0),
    difficulty: "standard" as const,
  }));
  return {
    tables,
    pods: [{ id: podIdOf(0), name: "Pod 1" }],
    seats: tables.map((table) => unsetSeat(table.id, 0)),
  };
}

/** The plan the room reports now (null in a standard room). */
export function planOf(state: RoomState): EpicPlan | null {
  const epic = state.epic;
  if (!epic) return null;
  const labelOf = new Map(state.seats.map((s) => [s.id, s.label]));
  return {
    tables: epic.tables.map((t) => ({
      id: t.id,
      name: t.name,
      pod: t.pod,
      difficulty: difficultyOf(t.difficulty),
    })),
    pods: epic.pods.map((p) => ({ id: p.id, name: p.name })),
    seats: epic.tables.flatMap((t) => t.seats.map((id) => ({ id, label: labelOf.get(id) ?? HERO_UNSET, table: t.id }))),
  };
}

/** Pods named by no table are dropped; the rest keep their order. */
function tidyPods(tables: readonly LobbyTableSpec[], pods: readonly LobbyPod[]): readonly LobbyPod[] {
  const used = new Set(tables.map((t) => t.pod));
  return pods.filter((p) => used.has(p.id));
}

/** The plan with exactly `count` tables (clamped to 2..8): new ones join the last table's pod with one open seat. */
export function withTableCount(plan: EpicPlan, count: number): EpicPlan {
  const wanted = Math.min(MAX_EPIC_TABLES, Math.max(MIN_EPIC_TABLES, Math.floor(count)));
  if (wanted === plan.tables.length) return plan;
  if (wanted < plan.tables.length) {
    const tables = plan.tables.slice(0, wanted);
    const ids = new Set(tables.map((t) => t.id));
    return { tables, pods: tidyPods(tables, plan.pods), seats: plan.seats.filter((s) => ids.has(s.table ?? "")) };
  }
  const tables = [...plan.tables];
  const seats = [...plan.seats];
  const pod = tables[tables.length - 1]?.pod ?? podIdOf(0);
  while (tables.length < wanted) {
    const id = tableIdOf(tables.length);
    tables.push({ id, name: `Table ${tables.length + 1}`, pod, difficulty: "standard" });
    seats.push(unsetSeat(id, 0));
  }
  return { tables, pods: plan.pods.length > 0 ? plan.pods : [{ id: pod, name: "Pod 1" }], seats };
}

const changeTable = (plan: EpicPlan, id: string, change: Partial<LobbyTableSpec>): EpicPlan => ({
  ...plan,
  tables: plan.tables.map((t) => (t.id === id ? { ...t, ...change } : t)),
});

/** The plan with a table renamed (trimmed, at most 40 characters; blank keeps the old name). */
export function withTableName(plan: EpicPlan, id: string, name: string): EpicPlan {
  const kept = name.trim().slice(0, MAX_TABLE_NAME_CHARS);
  return kept === "" ? plan : changeTable(plan, id, { name: kept });
}

/** The plan with a table's difficulty flipped between standard and expert (each group plays its own, MC55 p. 12). */
export function withNextDifficulty(plan: EpicPlan, id: string): EpicPlan {
  const table = plan.tables.find((t) => t.id === id);
  if (!table) return plan;
  return changeTable(plan, id, { difficulty: difficultyOf(table.difficulty) === "expert" ? "standard" : "expert" });
}

/**
 * The plan with the table moved to its next pod: the pods the other tables are in, in order, then a new pod of its own,
 * then back to the first. A table with no other table to share with stays where it is.
 */
export function withNextPod(plan: EpicPlan, id: string): EpicPlan {
  const table = plan.tables.find((t) => t.id === id);
  if (!table) return plan;
  const others = plan.tables.filter((t) => t.id !== id);
  const existing = plan.pods.filter((p) => others.some((t) => t.pod === p.id));
  if (existing.length === 0) return plan;
  const order = [...existing.map((p) => p.id), "new"];
  const at = order.indexOf(table.pod);
  const next = order[(at + 1) % order.length] ?? "new";
  const pods = [...existing];
  let target = next;
  if (next === "new") {
    let n = pods.length;
    do target = podIdOf(n++);
    while (plan.pods.some((p) => p.id === target) && n < 32);
    pods.push({ id: target, name: `Pod ${pods.length + 1}` });
  }
  const tables = plan.tables.map((t) => (t.id === id ? { ...t, pod: target } : t));
  return { ...plan, tables, pods: tidyPods(tables, pods) };
}

/** The plan with a table having `count` seats (1 to 4): new seats are open with no hero chosen. */
export function withSeatCount(plan: EpicPlan, id: string, count: number): EpicPlan {
  const wanted = Math.min(MAX_TABLE_SEATS, Math.max(MIN_TABLE_SEATS, Math.floor(count)));
  const mine = plan.seats.filter((s) => s.table === id);
  if (mine.length === wanted) return plan;
  if (mine.length > wanted) {
    const drop = new Set(mine.slice(wanted).map((s) => s.id));
    return { ...plan, seats: plan.seats.filter((s) => !drop.has(s.id)) };
  }
  const taken = new Set(plan.seats.map((s) => s.id));
  const added: LobbySeatSpec[] = [];
  for (let n = 0; mine.length + added.length < wanted; n++) {
    const seat = unsetSeat(id, n);
    if (!taken.has(seat.id)) {
      added.push(seat);
      taken.add(seat.id);
    }
  }
  // Seats stay grouped by table in table order (seat n of a table plays that table's player p<n>).
  const seats = plan.tables.flatMap((t) => [
    ...plan.seats.filter((s) => s.table === t.id),
    ...(t.id === id ? added : []),
  ]);
  return { ...plan, seats };
}

/** The plan with one seat's hero set (`label` as `seatSpecsOf` writes it, with the identity card id after it). */
export function withSeatHero(plan: EpicPlan, seatId: string, label: string): EpicPlan {
  return { ...plan, seats: plan.seats.map((s) => (s.id === seatId ? { ...s, label } : s)) };
}

// ---- What the lobby shows ---------------------------------------------------------------------------------------

const STATUS_KEYS: Readonly<Record<EpicTableStatus, MessageKey>> = {
  lobby: "epic.status.lobby",
  setup: "epic.status.setup",
  player: "epic.status.player",
  villain: "epic.status.villain",
  halted: "epic.status.halted",
  waiting: "epic.status.waiting",
  dropped: "epic.status.dropped",
  over: "epic.status.over",
};

/** A table's status in words (never colour alone). */
export const statusKey = (status: EpicTableStatus): MessageKey => STATUS_KEYS[status];

export interface HostChoice {
  readonly id: string;
  readonly name: string;
}

export interface EpicTableView {
  readonly id: string;
  readonly name: string;
  readonly podName: string;
  readonly difficulty: EpicDifficulty;
  /** The host's name, or null while the table has none. */
  readonly hostName: string | null;
  readonly hostConnected: boolean;
  /** I run this table's game. */
  readonly mine: boolean;
  readonly status: EpicTableStatus;
  readonly seats: readonly SeatRowView[];
  readonly seatCount: number;
  /** The organizer's choices for this table's host: its seat holders, and the organizer if it hosts no other table. */
  readonly hostChoices: readonly HostChoice[];
  readonly canAddSeat: boolean;
  readonly canRemoveSeat: boolean;
}

/** One card per table, in table order: its seats, host, pod and difficulty. */
export function epicTableViews(state: RoomState, ctx: SeatContext): readonly EpicTableView[] {
  const epic = state.epic;
  if (!epic) return [];
  const rows = seatRows(state, ctx);
  const organizer = state.participants.find((p) => p.role === "host");
  const hostsElsewhere = (table: EpicTable): boolean =>
    organizer !== undefined && epic.tables.some((t) => t.id !== table.id && t.host === organizer.id);
  return epic.tables.map((table) => {
    const seats = table.seats.flatMap((id) => rows.filter((r) => r.id === id));
    const choices: HostChoice[] = [];
    for (const id of table.seats) {
      const holder = state.seats.find((s) => s.id === id)?.holder ?? null;
      const person = holder === null ? undefined : state.participants.find((p) => p.id === holder);
      if (person && !choices.some((c) => c.id === person.id)) choices.push({ id: person.id, name: person.name });
    }
    if (organizer && !hostsElsewhere(table) && !choices.some((c) => c.id === organizer.id)) {
      choices.push({ id: organizer.id, name: organizer.name });
    }
    return {
      id: table.id,
      name: table.name,
      podName: epic.pods.find((p) => p.id === table.pod)?.name ?? table.pod,
      difficulty: difficultyOf(table.difficulty),
      hostName: table.hostName,
      hostConnected: table.hostConnected,
      mine: table.myRole === "host",
      status: table.status,
      seats,
      seatCount: table.seats.length,
      hostChoices: choices,
      canAddSeat: table.seats.length < MAX_TABLE_SEATS,
      canRemoveSeat: table.seats.length > MIN_TABLE_SEATS,
    };
  });
}

/** What Start needs besides the room's own state. */
export interface EpicStartContext {
  /** Heroes of the organizer's own table that none of its decks can play (empty: none, or it hosts no table). */
  readonly missingDecks: readonly string[];
}

/** Why Start is off, or null when the organizer may press it: every table has a host and every seat a holder. */
export function epicStartBlock(state: RoomState, ctx: EpicStartContext): Words | null {
  const epic = state.epic;
  if (!epic || state.role !== "host") return { key: "room.start.hostOnly" };
  if (state.connection !== "connected") return { key: "room.start.notConnected" };
  if (epic.start) return { key: "room.start.started" };
  if (epic.tables.length < MIN_EPIC_TABLES) return { key: "epic.start.fewTables" };
  const labelOf = (id: string): string => state.seats.find((s) => s.id === id)?.label ?? HERO_UNSET;
  for (const table of epic.tables) {
    if (table.seats.length === 0) return { key: "epic.start.noSeats", params: { table: table.name } };
  }
  for (const table of epic.tables) {
    if (table.seats.some((id) => labelOf(id) === HERO_UNSET || labelOf(id) === "")) {
      return { key: "epic.start.heroNotSet", params: { table: table.name } };
    }
  }
  const open = state.seats.filter((s) => s.holder === null).length;
  if (open > 0) return { key: "room.start.openSeats", params: { count: open } };
  const mismatched = state.seats.find((s) => s.mismatch);
  if (mismatched) return { key: "room.start.versionMismatch", params: { name: mismatched.holderName ?? "" } };
  for (const table of epic.tables) {
    if (table.host === null) return { key: "epic.start.noHost", params: { table: table.name } };
    if (!table.hostConnected) {
      return { key: "epic.start.hostAway", params: { table: table.name, name: table.hostName ?? "" } };
    }
  }
  const away = state.seats.find((s) => !s.holderConnected);
  if (away) return { key: "room.start.holderAway", params: { name: away.holderName ?? "" } };
  if (ctx.missingDecks.length > 0) return { key: "epic.start.noDeck", params: { hero: ctx.missingDecks.join(", ") } };
  return null;
}

/** The time limit choices the lobby cycles through, in minutes: none, then 60 to 240 (the insert's default is 180). */
export const TIME_LIMIT_CHOICES: readonly (number | null)[] = [null, 60, 90, 120, 180, 240];

/** The next time limit in the cycle (an unlisted value goes to the first listed one). */
export function nextTimeLimit(current: number | null): number | null {
  const at = TIME_LIMIT_CHOICES.indexOf(current);
  return TIME_LIMIT_CHOICES[(at + 1) % TIME_LIMIT_CHOICES.length] ?? null;
}

/** `90` as "1 h 30 min", `120` as "2 h", `45` as "45 min". */
export function minutesText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h > 0 ? `${h} h` : "", m > 0 || h === 0 ? `${m} min` : ""].filter(Boolean).join(" ");
}

/**
 * "Choose a group in your pod": the engine offers each group by its id (a table's id). The table's name is what the
 * player knows it by; the id is kept for any label that is not a table of this game.
 */
export function groupOptionLabel(epic: Pick<RoomState["epic"] & object, "tables"> | null, label: string): string {
  return epic?.tables.find((table) => table.id === label)?.name ?? label;
}
