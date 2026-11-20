/**
 * What the Civil War Competitive lobby shows (issue #883, plan M8/M9; docs/live-game-rooms.md section 11), as plain data
 * worked out from the room's `RoomState`. The room decides everything (who may sit where, whether the teams are sized,
 * whether Start is answered); this words it and turns buttons off with the reason. It never holds a sealed scenario: the
 * room only reports `submitted` and `ready` per team, and the other team's scenario is never read here.
 */
import type { LobbySeatSpec } from "@mc/sync-worker/room-protocol";
import { HERO_UNSET, parseSeatLabel } from "./seat-label.js";
import type { MessageKey } from "../i18n/translate.js";
import type { RoomState, TeamId } from "../live/room-state.js";
import type { Words } from "./room-lobby-model.js";

export const TEAMS: readonly TeamId[] = ["registration", "resistance"];

/** The table rule the lobby keeps the Q13 A "expert, agreed by the whole table" choice in (opaque to the room). */
export const EXPERT_RULE = "competitiveExpert";

export const sideKey = (team: TeamId): MessageKey =>
  team === "registration" ? "comp.side.registration" : "comp.side.resistance";

/** The other team: the one this team builds a scenario for, and whose leader it fights. */
export const otherTeam = (team: TeamId): TeamId => (team === "registration" ? "resistance" : "registration");

/** One seat of the plan the host edits: a hero label (HERO_UNSET until chosen) and the side it plays. */
export type CompetitivePlan = readonly (LobbySeatSpec & { readonly label: string; readonly team: TeamId })[];

/** 1 v 1 or 2 v 2 (plan Q14 A): registration's seats first, then resistance's. */
export function newCompetitivePlan(perTeam: 1 | 2 = 1): CompetitivePlan {
  const seats: (LobbySeatSpec & { label: string; team: TeamId })[] = [];
  for (const team of TEAMS) {
    for (let i = 0; i < perTeam; i++) seats.push({ id: `s${seats.length + 1}`, label: HERO_UNSET, team });
  }
  return seats;
}

/** The plan the room reports now: seats in the room's order with the team and label each carries. */
export function planOf(state: RoomState): CompetitivePlan {
  return state.seats.map((seat) => ({
    id: seat.id,
    label: seat.label,
    team: seat.team ?? "registration",
  }));
}

/** The same plan at `perTeam` seats a side, keeping the labels of the seats that stay. */
export function withTeamSize(plan: CompetitivePlan, perTeam: 1 | 2): CompetitivePlan {
  const next = newCompetitivePlan(perTeam);
  const seen: Record<TeamId, number> = { registration: 0, resistance: 0 };
  return next.map((seat) => {
    const old = plan.filter((s) => s.team === seat.team)[seen[seat.team]++];
    return old ? { ...seat, label: old.label } : seat;
  });
}

export const withSeatHero = (plan: CompetitivePlan, seatId: string, label: string): CompetitivePlan =>
  plan.map((s) => (s.id === seatId ? { ...s, label } : s));

/** Seats a side has in the plan: 2 for a 2 v 2, else 1. */
export const perTeamOf = (plan: CompetitivePlan): 1 | 2 =>
  plan.filter((s) => s.team === "registration").length >= 2 ? 2 : 1;

export interface TeamSeatView {
  readonly id: string;
  /** The hero's words, or null while the host has not chosen one. */
  readonly hero: string | null;
  readonly cardId: string | null;
  readonly holderName: string | null;
  readonly mine: boolean;
  /** The seat could move to the other side (the room's team-size and other-team rules still decide). */
  readonly canSwitch: boolean;
}

export interface TeamView {
  readonly team: TeamId;
  readonly nameKey: MessageKey;
  readonly seats: readonly TeamSeatView[];
  readonly submitted: boolean;
  readonly ready: boolean;
  /** The seat holder of this side (or the host with no seat) may build and ready it. */
  readonly mine: boolean;
  readonly buildBlock: MessageKey | null;
  readonly readyBlock: MessageKey | null;
}

/** Which team I speak for: the team I hold a seat on, else (a host holding no seat) the one it picked. */
export function speakingFor(state: RoomState, hostPick: TeamId | null = null): TeamId | null {
  const mine = state.competitive?.myTeam ?? null;
  if (mine) return mine;
  return state.role === "host" && state.mySeats.length === 0 ? hostPick : null;
}

export function teamViews(state: RoomState, speaking: TeamId | null): readonly TeamView[] {
  const competitive = state.competitive;
  if (!competitive) return [];
  return TEAMS.map((team) => {
    const info = competitive.teams[team];
    const seats = info.seats.flatMap((id) => {
      const seat = state.seats.find((s) => s.id === id);
      if (!seat) return [];
      const parsed = parseSeatLabel(seat.label);
      const unset = seat.label === HERO_UNSET;
      return [
        {
          id,
          hero: unset ? null : parsed.text,
          cardId: unset ? null : parsed.cardId,
          holderName: seat.holderName,
          mine: seat.mine,
          canSwitch: state.role === "host" || seat.mine,
        },
      ];
    });
    const mine = speaking === team;
    const heroMissing = seats.some((s) => s.hero === null);
    return {
      team,
      nameKey: sideKey(team),
      seats,
      submitted: info.submitted,
      ready: info.ready,
      mine,
      buildBlock: !mine ? "comp.block.notYourSide" : state.started ? "comp.block.started" : null,
      readyBlock: !mine
        ? "comp.block.notYourSide"
        : !info.submitted
          ? "comp.block.sealFirst"
          : heroMissing
            ? "comp.block.heroFirst"
            : null,
    };
  });
}

/** The tie-break option, on unless the host turned it off (plan Q9 C). */
export const tieBreaksOn = (state: RoomState): boolean => state.competitive?.tieBreaks !== false;

/** The table agrees on expert leaders (plan Q13 A). */
export const expertOn = (state: RoomState): boolean => state.settings?.tableRules?.[EXPERT_RULE] === true;

/** `tableRules` with expert toggled, for a `lobby-set` patch (the room clears both readiness on a rules change). */
export function expertPatch(state: RoomState): { readonly tableRules: Record<string, unknown> } {
  const rules: Record<string, unknown> = { ...state.settings?.tableRules };
  if (rules[EXPERT_RULE] === true) delete rules[EXPERT_RULE];
  else rules[EXPERT_RULE] = true;
  return { tableRules: rules };
}

export interface CompetitiveStartContext {
  /** Heroes (seat labels) this device has no deck for. */
  readonly missingDecks: readonly string[];
}

const sideWords = (team: TeamId): string => (team === "registration" ? "Registration" : "Resistance");

/** Why Start is off, or null when the host may press it (the room answers the same at the reveal). */
export function competitiveStartBlock(state: RoomState, ctx: CompetitiveStartContext): Words | null {
  const competitive = state.competitive;
  if (state.role !== "host") return { key: "room.start.hostOnly" };
  if (state.connection !== "connected") return { key: "room.start.notConnected" };
  if (state.started) return { key: "room.start.started" };
  if (!competitive || !competitive.sized) return { key: "comp.start.sizes" };
  const open = state.seats.filter((s) => s.holder === null).length;
  if (open > 0) return { key: "room.start.openSeats", params: { count: open } };
  if (state.seats.some((s) => s.label === HERO_UNSET)) return { key: "comp.start.noHero" };
  const away = state.seats.find((s) => !s.holderConnected);
  if (away) return { key: "room.start.holderAway", params: { name: away.holderName ?? "" } };
  for (const team of TEAMS) {
    const info = competitive.teams[team];
    if (!info.submitted) return { key: "comp.start.notSealed", params: { side: sideWords(team) } };
    if (!info.ready) return { key: "comp.start.notReady", params: { side: sideWords(team) } };
  }
  if (ctx.missingDecks.length > 0) return { key: "comp.start.noDeck", params: { hero: ctx.missingDecks[0]! } };
  return competitive.canStart ? null : { key: "comp.start.sizes" };
}
