/**
 * What the lobby shows (issue #880, docs/live-game-rooms.md section 8), as plain data worked out from the room's
 * `RoomState`. Nothing here decides a rule: whether a seat may be taken, or the game started, is the room's call; this
 * only words what the room reports and turns the buttons off, with the reason, where the room would refuse anyway.
 */
import type { LobbyMod, RoomDevice } from "@mc/sync-worker/room-protocol";
import { parseSeatLabel } from "./room-table-setup.js";
import { en } from "../i18n/en.js";
import { t, tPlural, type MessageKey, type PluralBase } from "../i18n/translate.js";
import type {
  LobbySettings,
  LobbySettingsPatch,
  RefusalReason,
  RoomProblem,
  RoomRefusal,
  RoomSeat,
  RoomState,
} from "../live/room-state.js";

export type { LobbyMod };

export interface Words {
  /** A message key, or a plural base (`room.start.openSeats`) whose `params.count` picks the form. */
  readonly key: MessageKey | PluralBase;
  readonly params?: Readonly<Record<string, string | number>>;
}

const PROBLEM_KEYS: Readonly<Record<RoomProblem, MessageKey>> = {
  "no-name": "room.problem.noName",
  "no-service": "room.problem.noService",
  unavailable: "room.problem.unavailable",
  "rate-limited": "room.problem.rateLimited",
  disabled: "room.problem.disabled",
  "not-found": "room.problem.notFound",
  full: "room.problem.full",
  gone: "room.problem.gone",
  replaced: "room.problem.replaced",
  "closed-ended": "room.problem.closedEnded",
  "closed-idle": "room.problem.closedIdle",
  "closed-disabled": "room.problem.closedDisabled",
};

/** The one line about the connection, or null while it is up. */
export function connectionWords(state: RoomState): Words | null {
  if (state.connection === "connecting") return { key: "room.state.connecting" };
  if (state.connection === "reconnecting") return { key: "room.state.reconnecting" };
  if (state.connection === "ended") return { key: PROBLEM_KEYS[state.problem ?? "unavailable"] };
  return null;
}

/** Words for a problem that kept a room from opening (the Play online screen's own line). */
export const problemWords = (problem: RoomProblem): Words => ({ key: PROBLEM_KEYS[problem] });

const REFUSAL_KEYS: Readonly<Record<RefusalReason, MessageKey>> = {
  "build-mismatch": "room.refusal.buildMismatch",
  "multi-seat": "room.refusal.multiSeat",
  "seat-taken": "room.refusal.seatTaken",
  "rate-limited": "room.refusal.rateLimited",
  "name-required": "room.refusal.nameRequired",
  full: "room.refusal.full",
  "not-allowed": "room.refusal.notAllowed",
  "no-such-seat": "room.refusal.noSuchSeat",
  "no-such-participant": "room.refusal.noSuchParticipant",
  "bad-message": "room.refusal.generic",
  "too-large": "room.refusal.generic",
  "out-of-order": "room.refusal.generic",
  // Play-together refusals (#881).
  "not-away": "room.refusal.notAway",
  "not-seated": "room.refusal.notSeated",
  strict: "room.refusal.strict",
  "handover-off": "room.refusal.handoverOff",
};

/** What to say about the room's last refusal, in plain language. */
export function refusalWords(refusal: RoomRefusal | null, state: RoomState): Words | null {
  if (!refusal) return null;
  const seat = refusal.seat ? state.seats.find((s) => s.id === refusal.seat) : undefined;
  return { key: REFUSAL_KEYS[refusal.reason], params: { seat: seat ? parseSeatLabel(seat.label).text : "" } };
}

export type RoleKind = "host" | "player" | "watcher";

/** A device in words, never an icon alone: "Windows · desktop", "Android · phone". */
export function deviceText(device: RoomDevice | undefined): string | null {
  if (!device) return null;
  return t("room.device", {
    platform: t(`room.device.${device.platform}` as MessageKey),
    form: t(`room.device.form.${device.form}` as MessageKey),
  });
}

export interface ParticipantRow {
  readonly id: string;
  /** Their device in words (null when their client sent none), and its platform for the small icon. */
  readonly device: string | null;
  readonly platform: RoomDevice["platform"] | null;
  readonly name: string;
  readonly me: boolean;
  /** Said in words beside the name, never by the name alone. */
  readonly role: RoleKind;
  readonly roleKey: MessageKey;
  /** The labels of the seats they hold. */
  readonly seats: readonly string[];
  readonly differentVersion: boolean;
}

export function participantRows(state: RoomState): readonly ParticipantRow[] {
  return state.participants.map((p) => {
    const role: RoleKind = p.role === "host" ? "host" : p.seats.length > 0 ? "player" : "watcher";
    return {
      id: p.id,
      device: deviceText(p.device),
      platform: p.device?.platform ?? null,
      name: p.name,
      me: p.me,
      role,
      roleKey: role === "host" ? "room.role.host" : role === "player" ? "room.role.player" : "room.role.watcher",
      seats: p.seats.map((id) => {
        const label = state.seats.find((s) => s.id === id)?.label;
        return label === undefined ? id : parseSeatLabel(label).text;
      }),
      differentVersion: !p.buildMatches,
    };
  });
}

export type SeatActionKind = "ask" | "withdraw" | "leave" | "take" | "remove" | "takeOver" | "giveBack";

export interface SeatAction {
  readonly kind: SeatActionKind;
  readonly labelKey: MessageKey;
  readonly enabled: boolean;
  /** Why it is off, in words. */
  readonly reason?: MessageKey;
  /** For `remove`: whose seat it is taken from. */
  readonly participant?: string;
}

export interface RequestRow {
  readonly participant: string;
  readonly name: string;
  readonly approvable: boolean;
  readonly reason?: MessageKey;
}

export interface SeatRowView {
  readonly id: string;
  /** The seat's words (hero and deck), without the identity card id the room carries after them. */
  readonly label: string;
  /** The hero's identity card, for the seat's picture; null when the host's label carried none. */
  readonly cardId: string | null;
  /** The host may give this open seat to someone: the people who could take it (empty: nobody now). */
  readonly candidates: readonly { readonly id: string; readonly name: string }[];
  /** Null: open. */
  readonly holderName: string | null;
  readonly holderConnected: boolean;
  /** The holder's device in words, when their client sent one. */
  readonly holderDevice: string | null;
  readonly mine: boolean;
  readonly mismatch: boolean;
  readonly requestedByMe: boolean;
  /** The host plays this seat for its absent holder (#881). */
  readonly takenOver: boolean;
  /** Host only: take over an away seat, or give a taken-over one back (#881); null for everyone else and every other seat. */
  readonly play: SeatAction | null;
  /** Pending requests, for the host to approve or deny; empty for everyone else. */
  readonly requests: readonly RequestRow[];
  readonly action: SeatAction | null;
}

/** Mods the host allows that this device does not have installed at the same version. */
export function missingMods(allowed: readonly LobbyMod[], installed: readonly LobbyMod[]): readonly LobbyMod[] {
  return allowed.filter((mod) => !installed.some((have) => have.id === mod.id && have.version === mod.version));
}

export interface SeatContext {
  /** The packs installed on this device. */
  readonly installed: readonly LobbyMod[];
}

function seatAction(state: RoomState, seat: RoomSeat, ctx: SeatContext): SeatAction | null {
  const isHost = state.role === "host";
  if (seat.mine) return { kind: "leave", labelKey: "room.seat.leave", enabled: true };
  if (seat.requestedByMe) return { kind: "withdraw", labelKey: "room.seat.withdraw", enabled: true };
  if (seat.holder !== null) {
    return isHost ? { kind: "remove", labelKey: "room.seat.takeBack", enabled: true, participant: seat.holder } : null;
  }
  const kind = isHost ? "take" : "ask";
  const labelKey: MessageKey = isHost ? "room.seat.take" : "room.seat.ask";
  const multi = state.settings?.multiSeat ?? false;
  let reason: MessageKey | undefined;
  if (state.connection !== "connected") reason = "room.seat.notConnected";
  else if (!state.buildMatches) reason = "room.seat.differentVersion";
  else if (!multi && state.mySeats.length > 0) reason = "room.seat.oneEach";
  else if (state.settings && missingMods(state.settings.mods, ctx.installed).length > 0) reason = "room.seat.needsMods";
  return { kind, labelKey, enabled: reason === undefined, ...(reason ? { reason } : {}) };
}

/** Who the host could give a seat to: connected people (not the host, who takes seats directly) on the host's build, with no seat yet unless several seats each are allowed. */
export function assignCandidates(state: RoomState): readonly { readonly id: string; readonly name: string }[] {
  const multi = state.settings?.multiSeat ?? false;
  return state.participants
    .filter((p) => p.role !== "host" && p.buildMatches && (multi || p.seats.length === 0))
    .map((p) => ({ id: p.id, name: p.name }));
}

/** Hand-offs are on unless the lobby setting says otherwise (read loosely until the settings carry the field). */
const handoverAllowed = (state: RoomState): boolean => state.settings?.handover !== false;

/** The host's way to keep the game moving for an absent holder: Take over, then Give back once they return. */
function playAction(seat: RoomSeat, started: boolean, handover: boolean): SeatAction | null {
  // The host turned hand-offs off: a leaving player's seat stays theirs, and the game waits (or the host concedes).
  if (!handover && !seat.takenOver) return null;
  if (seat.takenOver) return { kind: "giveBack", labelKey: "room.seat.giveBack", enabled: true };
  // A seat its holder left mid-game (a guest's Concede) can be taken over too; the lobby's Give to... hands it on.
  if (seat.holder === null && seat.player !== null && started) {
    return { kind: "takeOver", labelKey: "room.seat.takeOver", enabled: true };
  }
  if (seat.holder !== null && seat.away) return { kind: "takeOver", labelKey: "room.seat.takeOver", enabled: true };
  return null;
}

export function seatRows(state: RoomState, ctx: SeatContext): readonly SeatRowView[] {
  const isHost = state.role === "host";
  const multi = state.settings?.multiSeat ?? false;
  return state.seats.map((seat) => ({
    id: seat.id,
    label: parseSeatLabel(seat.label).text,
    cardId: parseSeatLabel(seat.label).cardId,
    candidates:
      isHost && seat.holder === null && (handoverAllowed(state) || !state.started) ? assignCandidates(state) : [],
    holderName: seat.holder === null ? null : (seat.holderName ?? seat.holder),
    holderConnected: seat.holderConnected,
    holderDevice: deviceText(state.participants.find((p) => p.id === seat.holder)?.device),
    mine: seat.mine,
    mismatch: seat.mismatch,
    requestedByMe: seat.requestedByMe,
    takenOver: seat.takenOver,
    play: isHost ? playAction(seat, state.started, handoverAllowed(state)) : null,
    requests: isHost
      ? seat.requests.map((request) => {
          const who = state.participants.find((p) => p.id === request.participant);
          let reason: MessageKey | undefined;
          if (!who) reason = "room.seat.requesterGone";
          else if (!who.buildMatches) reason = "room.seat.theirVersion";
          else if (seat.holder !== null) reason = "room.seat.alreadyHeld";
          else if (!multi && who.seats.length > 0) reason = "room.seat.theyHoldOne";
          return {
            participant: request.participant,
            name: request.name,
            approvable: reason === undefined,
            ...(reason ? { reason } : {}),
          };
        })
      : [],
    action: seatAction(state, seat, ctx),
  }));
}

/** The facts about the host's table that Start needs besides the room's own state. */
export interface StartContext {
  /** The host has set the table up (a draft with every seat's deck chosen). */
  readonly tableReady: boolean;
  /** The packs (id and version) the table's game would carry. */
  readonly packsUsed: readonly LobbyMod[];
}

/** Why Start is off, or null when the host may press it. */
export function startBlock(state: RoomState, ctx: StartContext): Words | null {
  if (state.role !== "host") return { key: "room.start.hostOnly" };
  if (state.connection !== "connected") return { key: "room.start.notConnected" };
  if (state.started) return { key: "room.start.started" };
  if (!ctx.tableReady || state.seats.length === 0) return { key: "room.start.noTable" };
  const open = state.seats.filter((s) => s.holder === null).length;
  if (open > 0) return { key: "room.start.openSeats", params: { count: open } };
  const mismatched = state.seats.find((s) => s.mismatch);
  if (mismatched) return { key: "room.start.versionMismatch", params: { name: mismatched.holderName ?? "" } };
  const away = state.seats.find((s) => !s.holderConnected);
  if (away) return { key: "room.start.holderAway", params: { name: away.holderName ?? "" } };
  // Allowed means this pack at this version: guests install the version the host allowed, not another.
  const allowed = state.settings?.mods ?? [];
  const outside = ctx.packsUsed.find((p) => !allowed.some((m) => m.id === p.id && m.version === p.version));
  if (outside) return { key: "room.start.modNotAllowed", params: { name: outside.id } };
  return null;
}

// ---- Host controls -------------------------------------------------------------------------------------------

/** A table rule (`TableRules`) the lobby lets the host choose. */
export interface TableRuleRow {
  readonly key: string;
  readonly titleKey: MessageKey;
  readonly detailKey: MessageKey;
  readonly on: boolean;
}

export function tableRuleRows(settings: LobbySettings | null): readonly TableRuleRow[] {
  return [
    {
      key: "sameNameHeroAllyConflict",
      titleKey: "room.rule.sameName.title",
      detailKey: "room.rule.sameName.detail",
      on: settings?.tableRules.sameNameHeroAllyConflict === true,
    },
  ];
}

export function toggleTableRulePatch(settings: LobbySettings, key: string): LobbySettingsPatch {
  const rules: Record<string, unknown> = { ...settings.tableRules };
  if (rules[key] === true) delete rules[key];
  else rules[key] = true;
  return { tableRules: rules };
}

export interface ModRow {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly allowed: boolean;
}

/** The host's installed packs with whether the room allows each. */
export function hostModRows(
  settings: LobbySettings | null,
  installed: readonly (LobbyMod & { readonly name: string })[],
): readonly ModRow[] {
  return installed.map((pack) => ({
    id: pack.id,
    version: pack.version,
    name: pack.name,
    allowed: settings?.mods.some((m) => m.id === pack.id && m.version === pack.version) === true,
  }));
}

export function toggleModPatch(settings: LobbySettings, pack: LobbyMod): LobbySettingsPatch {
  const has = settings.mods.some((m) => m.id === pack.id && m.version === pack.version);
  // Turning a pack on replaces any other version of it that was allowed.
  const others = settings.mods.filter((m) => m.id !== pack.id);
  return { mods: has ? others : [...others, { id: pack.id, version: pack.version }] };
}

/** A guest's view of the allowed mods: each with whether this device has it at the room's version. */
export function guestModRows(
  settings: LobbySettings | null,
  installed: readonly LobbyMod[],
): readonly { readonly id: string; readonly version: string; readonly have: boolean }[] {
  return (settings?.mods ?? []).map((mod) => ({
    ...mod,
    have: installed.some((p) => p.id === mod.id && p.version === mod.version),
  }));
}

export const playModeKeys: Readonly<Record<"strict" | "host", { title: MessageKey; detail: MessageKey }>> = {
  strict: { title: "room.mode.strict", detail: "room.mode.strictDetail" },
  host: { title: "room.mode.host", detail: "room.mode.hostDetail" },
};

/** Whether chat shows: the room's own setting (on until the lobby says otherwise). */
export const chatOn = (state: RoomState): boolean => state.settings?.chat !== false;

/** The code as shown: `ABC 234`. */
export const codeShown = (code: string | null): string => (code ? `${code.slice(0, 3)} ${code.slice(3)}` : "------");

/** `words` in the player's language. */
export function wordsText(words: Words): string {
  const count = words.params?.count;
  if (typeof count === "number" && !(words.key in en)) return tPlural(words.key as PluralBase, count, words.params);
  return t(words.key as MessageKey, words.params);
}
