/**
 * What the lobby shows (issue #880, docs/live-game-rooms.md section 8), as plain data worked out from the room's
 * `RoomState`. Nothing here decides a rule: whether a seat may be taken, or the game started, is the room's call; this
 * only words what the room reports and turns the buttons off, with the reason, where the room would refuse anyway.
 */
import { lobbyUndoFor, type LobbyMod, type LobbyUndo, type RoomDevice } from "@mc/sync-worker/room-protocol";
import { aspectName } from "./aspect-stamp.js";
import { en } from "../i18n/en.js";
import { t, tPlural, type MessageKey, type PluralBase } from "../i18n/translate.js";
import type { RoomStartResult, SeatDeckRefusal } from "../live/room-start.js";
import type {
  BuildGap,
  DeckRefusalCode,
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
  "closed-host": "room.problem.closedHost",
};

/** The one line about the connection, or null while it is up. */
export function connectionWords(state: RoomState): Words | null {
  if (state.connection === "connecting") return { key: "room.state.connecting" };
  if (state.connection === "reconnecting") return { key: "room.state.reconnecting" };
  if (state.connection === "ended") return { key: PROBLEM_KEYS[state.problem ?? "unavailable"] };
  return null;
}

/**
 * The room was closed under the player (the host closed it, it sat idle, or rooms were switched off): the lobby sends
 * them back to Play online with a notice saying so. A finished game ("closed-ended") is not one of these: its room
 * closing is the normal end, and the lobby keeps its own "game is over" line and Back to the title button.
 */
export const closedUnderPlayer = (problem: RoomProblem | null): boolean =>
  problem === "closed-host" || problem === "closed-idle" || problem === "closed-disabled";

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
  "lobby-changed": "room.startResult.lobbyChanged",
  "not-saved": "room.refusal.notSaved",
};

/** What to say about the room's last refusal, in plain language. */
export function refusalWords(refusal: RoomRefusal | null, state: RoomState): Words | null {
  if (!refusal) return null;
  const seat = refusal.seat ? state.seats.find((s) => s.id === refusal.seat) : undefined;
  if (
    refusal.reason === "not-allowed" &&
    state.role === "host" &&
    seat?.holder != null &&
    seat.deck?.preset !== true &&
    seat.deck
  ) {
    return { key: "room.deck.takeBackFirst" };
  }
  if (refusal.reason === "build-mismatch") {
    // A guest is told who is behind; the host is told it is the other player's build (the refusal names no one).
    if (state.role === "host") return { key: "room.refusal.buildMismatchHost" };
    return { key: state.buildGap ? myBuildReason(state) : "room.refusal.buildMismatch" };
  }
  return {
    key: REFUSAL_KEYS[refusal.reason],
    params: { seat: seat ? seatNameOf(seat, state.seats.indexOf(seat)) : "" },
  };
}

/** A seat's name: the host's label when it set one, else "Seat 2" (the hero is the deck's, shown beside it). */
export function seatNameOf(seat: { readonly id: string; readonly label: string }, index: number): string {
  const label = seat.label.trim();
  if (label !== "") return label;
  const number = index >= 0 ? index + 1 : Number(seat.id.replace(/\D/g, "")) || 0;
  return t("room.seat.number", { n: number });
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
  /** The badge for `differentVersion`: "Different build" when the version is the same but the rules code is not. */
  readonly buildBadge: MessageKey;
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
        const index = state.seats.findIndex((s) => s.id === id);
        const seat = state.seats[index];
        return seat ? seatNameOf(seat, index) : id;
      }),
      differentVersion: !p.buildMatches,
      buildBadge: p.buildGap === "rules" ? "room.differentBuild" : "room.differentVersion",
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

/** A seat's deck as every device sees it (never the card list). */
export interface SeatDeckView {
  /** The hero's identity card, for the seat's picture. */
  readonly cardId: string;
  readonly heroName: string;
  /** The aspects in words ("Justice", "Leadership + Protection"); empty for a deck with none. */
  readonly aspects: string;
  readonly name: string;
  readonly cards: number;
  /** The host chose it (the holder may replace it). */
  readonly preset: boolean;
  /** Mods the deck uses. */
  readonly mods: readonly LobbyMod[];
}

/** Why a seat's deck was refused at Start, in words: a title for the code, the engine's own sentence as the detail. */
export interface SeatProblemView {
  readonly titleKey: MessageKey;
  readonly reason: string;
  readonly code: DeckRefusalCode;
}

export type DeckButtonKind = "choose" | "preset";

export interface DeckButtonView {
  readonly kind: DeckButtonKind;
  readonly labelKey: MessageKey;
  readonly enabled: boolean;
  readonly reason?: MessageKey;
}

export interface SeatRowView {
  readonly id: string;
  /** "Seat 2", or the label the host gave it. */
  readonly name: string;
  /** The seat's deck, or null while nobody has chosen one. */
  readonly deck: SeatDeckView | null;
  /** The reason the host's check turned this seat's deck down (on my seat; for the host, on any seat its own last Start refused). */
  readonly problem: SeatProblemView | null;
  /** Mods this seat's deck needs that this device lacks (only on a seat I hold), for the Mod Store link. */
  readonly missingMods: readonly LobbyMod[];
  /** Pick a deck for this seat (mine: choose; the host on another's seat: preset). Null when this device cannot. */
  readonly deckButton: DeckButtonView | null;
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
  /** What the host's own last Start refused, with the deck each refusal was about (a changed deck clears it). */
  readonly refused?: readonly (SeatDeckRefusal & { readonly deckKey: string })[];
}

const PROBLEM_KEYS_BY_CODE: Readonly<Record<DeckRefusalCode, MessageKey>> = {
  "no-deck": "room.deckProblem.noDeck",
  illegal: "room.deckProblem.illegal",
  "unknown-card": "room.deckProblem.unknownCard",
  "mod-missing": "room.deckProblem.modMissing",
  "mod-version": "room.deckProblem.modVersion",
  "mod-not-allowed": "room.deckProblem.modNotAllowed",
};

/** Words for a refused deck: the code's title and the engine's sentence. */
export const problemOf = (code: DeckRefusalCode, reason: string): SeatProblemView => ({
  titleKey: PROBLEM_KEYS_BY_CODE[code],
  reason,
  code,
});

/** Tells one version of a seat's deck from another, so a refusal about the old one stops showing. */
export const deckKeyOf = (deck: RoomSeat["deck"]): string =>
  deck
    ? [deck.hero, deck.name, deck.cards, deck.aspects.join("+"), deck.mods.map((m) => m.id + m.version).join(",")].join(
        "|",
      )
    : "";

function deckViewOf(deck: RoomSeat["deck"]): SeatDeckView | null {
  if (!deck) return null;
  return {
    cardId: deck.hero,
    heroName: deck.heroName,
    aspects: deck.aspects.map((a) => aspectName(a)).join(" + "),
    name: deck.name,
    cards: deck.cards,
    preset: deck.preset === true,
    mods: deck.mods,
  };
}

/** The words for my own build differing from the host's: who is behind, or that it is the same version on another build. */
export function myBuildReason(state: RoomState): MessageKey {
  if (state.buildGap === "hostOlder") return "room.seat.hostOlder";
  if (state.buildGap === "rules") return "room.seat.differentBuild";
  if (state.buildGap === "other") return "room.seat.otherVersion";
  return "room.seat.differentVersion";
}

/** The same for a guest's build, read by the host. */
function theirBuildReason(who: { readonly buildGap?: BuildGap }): MessageKey {
  if (who.buildGap === "hostOlder") return "room.seat.theirNewer";
  if (who.buildGap === "rules") return "room.seat.theirBuild";
  if (who.buildGap === "other") return "room.seat.theirOther";
  return "room.seat.theirVersion";
}

function deckButton(state: RoomState, seat: RoomSeat): DeckButtonView | null {
  // The room refuses a different deck while a game runs (the hero is fixed at Start), so none is offered.
  if (state.started) return null;
  const kind: DeckButtonKind | null = seat.mine ? "choose" : state.role === "host" ? "preset" : null;
  if (!kind) return null;
  const labelKey: MessageKey =
    kind === "preset" ? "room.deck.set" : seat.deck ? "room.deck.change" : "room.deck.choose";
  let reason: MessageKey | undefined;
  if (state.connection !== "connected") reason = "room.seat.notConnected";
  else if (kind === "choose" && (!state.buildMatches || seat.mismatch)) reason = myBuildReason(state);
  // The holder chose their own deck: a preset would be refused, so the host takes the seat back first.
  else if (kind === "preset" && seat.holder !== null && seat.deck && seat.deck.preset !== true) {
    reason = "room.deck.takeBackFirst";
  }
  return { kind, labelKey, enabled: reason === undefined, ...(reason ? { reason } : {}) };
}

function problemFor(seat: RoomSeat, ctx: SeatContext): SeatProblemView | null {
  if (seat.deckProblem) return problemOf(seat.deckProblem.code, seat.deckProblem.reason);
  const key = deckKeyOf(seat.deck);
  const refused = ctx.refused?.find((r) => r.seat === seat.id && r.deckKey === key);
  return refused ? problemOf(refused.code, refused.reason) : null;
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
  else if (!state.buildMatches) reason = myBuildReason(state);
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
  return state.seats.map((seat, index) => ({
    id: seat.id,
    name: seatNameOf(seat, index),
    deck: deckViewOf(seat.deck),
    problem: problemFor(seat, ctx),
    missingMods: seat.mine && seat.deck ? missingMods(seat.deck.mods, ctx.installed) : [],
    deckButton: deckButton(state, seat),
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
          else if (!who.buildMatches) reason = theirBuildReason(who);
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
  if (mismatched) {
    const holder = state.participants.find((p) => p.id === mismatched.holder);
    const key: MessageKey =
      holder?.buildGap === "hostOlder"
        ? "room.start.holderNewer"
        : holder?.buildGap === "rules"
          ? "room.start.differentBuild"
          : holder?.buildGap === "other"
            ? "room.start.otherVersion"
            : "room.start.versionMismatch";
    return { key, params: { name: mismatched.holderName ?? "" } };
  }
  const away = state.seats.find((s) => !s.holderConnected);
  if (away) return { key: "room.start.holderAway", params: { name: away.holderName ?? "" } };
  // Allowed means this pack at this version: guests install the version the host allowed, not another.
  const allowed = state.settings?.mods ?? [];
  const outside = ctx.packsUsed.find((p) => !allowed.some((m) => m.id === p.id && m.version === p.version));
  if (outside) return { key: "room.start.modNotAllowed", params: { name: outside.id } };
  return null;
}

// ---- What Start said ---------------------------------------------------------------------------------------------

/** What the host's Start answered, in words: a headline and, for refused decks, one line per seat. */
export interface StartResultView {
  readonly headline: Words;
  /** For `decks`: which seat, whose, and why. */
  readonly lines: readonly {
    readonly seat: string;
    readonly holder: string;
    readonly title: string;
    readonly reason: string;
  }[];
}

export function startResultWords(result: RoomStartResult, state: RoomState): StartResultView | null {
  if (result.ok) return null;
  const nameOf = (id: string): string => {
    const index = state.seats.findIndex((s) => s.id === id);
    const seat = state.seats[index];
    return seat ? seatNameOf(seat, index) : id;
  };
  switch (result.reason) {
    case "not-host":
      return { headline: { key: "room.start.hostOnly" }, lines: [] };
    case "no-seats":
      return { headline: { key: "room.start.noTable" }, lines: [] };
    case "no-answer":
      return { headline: { key: "room.startResult.noAnswer" }, lines: [] };
    case "lobby-changed":
      return { headline: { key: "room.startResult.lobbyChanged" }, lines: [] };
    case "check-failed":
      return { headline: { key: "room.startResult.checkFailed" }, lines: [] };
    case "unfilled":
      return {
        headline: { key: "room.startResult.unfilled", params: { seats: result.seats.map(nameOf).join(", ") } },
        lines: [],
      };
    case "start-failed":
      return { headline: { key: "room.startResult.startFailed", params: { error: result.error } }, lines: [] };
    case "decks":
      return {
        headline: { key: "room.startResult.decks", params: { count: result.refused.length } },
        lines: result.refused.map((r) => ({
          seat: nameOf(r.seat),
          holder: state.seats.find((s) => s.id === r.seat)?.holderName ?? "",
          title: t(PROBLEM_KEYS_BY_CODE[r.code]),
          reason: r.reason,
        })),
      };
  }
}

/** The whole answer as one block of text for the footer: the headline, then a line per refused seat. */
export function startResultText(view: StartResultView): string {
  const lines = view.lines.map((line) =>
    t("room.startResult.seatLine", {
      seat: line.seat,
      who: line.holder === "" ? "" : ` (${line.holder})`,
      title: line.title,
      reason: line.reason,
    }),
  );
  return [wordsText(view.headline), ...lines].join("\n");
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

export const undoKeys: Readonly<Record<LobbyUndo, { title: MessageKey; detail: MessageKey }>> = {
  off: { title: "room.undo.off", detail: "room.undo.offDetail" },
  host: { title: "room.undo.host", detail: "room.undo.hostDetail" },
  ask: { title: "room.undo.ask", detail: "room.undo.askDetail" },
};

export interface UndoRow {
  readonly value: LobbyUndo;
  readonly titleKey: MessageKey;
  readonly detailKey: MessageKey;
  readonly selected: boolean;
}

/**
 * The Undo row's choices. Strict rules force Off, so only Off is offered (and nothing can be pressed); Host control
 * offers all three. The host presses them, guests see only the selected one. Unknown settings read as the mode's default.
 */
export function undoRows(settings: LobbySettings | null): readonly UndoRow[] {
  const mode = settings?.playMode ?? "strict";
  const current = lobbyUndoFor(mode, settings?.undo);
  const values: readonly LobbyUndo[] = mode === "strict" ? ["off"] : ["off", "host", "ask"];
  return values.map((value) => ({
    value,
    titleKey: undoKeys[value].title,
    detailKey: undoKeys[value].detail,
    selected: value === current,
  }));
}

/** The note under the Cheats row, for everyone. */
export const CHEATS_NOTE_KEY: MessageKey = "room.cheats.note";

/** The cheats setting as the lobby holds it (off when absent). */
export const cheatsOn = (settings: LobbySettings | null): boolean => settings?.cheats === true;

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
