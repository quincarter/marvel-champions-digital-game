/**
 * Starting a Civil War Competitive game from a lobby room (issue #883, docs/live-game-rooms.md section 11): what the
 * host's device needs besides the room's sealed scenarios, and the one place the two-team `SessionConfig` is built.
 *
 * Each team sealed a scenario for the other team in the room (`SealedScenario`, plain data the room never reads); at
 * Start the host's device gets both, pairs them with each seat's deck and hands `@mc/cards`' `civilWarCompetitive` (via
 * `SessionConfig.competitive`, built by `engine/session-core.ts`) the whole table. The seats are the engine's players in
 * team order: registration's first, then resistance's (`competitiveSeatOrder`), because the engine's teams own
 * consecutive players.
 */
import type { CorePlayer } from "@mc/cards";
import type { AnyCard } from "@mc/content";
import type { SessionConfig } from "../engine/host.js";
import type { SeatDeckRefusal } from "./room-start.js";
import type { RoomState, TeamId } from "./room-state.js";

/** What a team builds for the other team and seals in the room: its leader, modular sets and main scheme stages. */
export interface SealedScenario {
  /** The team's chosen leader, by scenario id (`registration-iron-man`): the leader the other team fights. */
  readonly leaderScenarioId: string;
  readonly modularSetIds: readonly string[];
  /** The `printedCardId` of the stage 1 and the stage 2 picked, in that order. */
  readonly mainSchemeStageIds: readonly string[];
  readonly extraModularSetIds?: readonly string[];
}

/** Both teams' sealed scenarios, as the room revealed them to the host: `<team>` is what that team built for the other. */
export interface SealedScenarios {
  readonly registration: unknown;
  readonly resistance: unknown;
}

/** A sealed scenario read from the room's opaque JSON, or null when it is not the shape `SealedScenario` names. */
export function parseSealedScenario(raw: unknown): SealedScenario | null {
  if (typeof raw !== "object" || raw === null) return null;
  const v = raw as Record<string, unknown>;
  const strings = (x: unknown): x is string[] => Array.isArray(x) && x.every((item) => typeof item === "string");
  if (typeof v.leaderScenarioId !== "string" || !strings(v.modularSetIds) || !strings(v.mainSchemeStageIds))
    return null;
  if (v.extraModularSetIds !== undefined && !strings(v.extraModularSetIds)) return null;
  return {
    leaderScenarioId: v.leaderScenarioId,
    modularSetIds: v.modularSetIds,
    mainSchemeStageIds: v.mainSchemeStageIds,
    ...(v.extraModularSetIds ? { extraModularSetIds: v.extraModularSetIds } : {}),
  };
}

/** One seat's player (hero and deck) as the seat's own deck gave it (`playerOfRoomDeck`). */
export interface CompetitiveSeatSetup {
  readonly seat: string;
  readonly player: CorePlayer;
}

/** What the host's setup supplies: the seed, each seat's player, and the table's difficulty (Q13 A: one for both). */
export interface CompetitiveSetup {
  readonly seed: number;
  readonly seats: readonly CompetitiveSeatSetup[];
  readonly expert?: boolean;
}

export interface CompetitiveBuildInput {
  readonly setup: CompetitiveSetup;
  readonly sealed: SealedScenarios;
  /** Seat ids of each team, in seat (player) order. */
  readonly teams: Readonly<Record<TeamId, readonly string[]>>;
  readonly tieBreaks: boolean;
}

/**
 * Builds the two-team game's `SessionConfig`, or null when something it needs is missing: a sealed scenario that does
 * not read, a team without a seat's player, a team that is not 1 or 2 seats, teams of different sizes (MC56 p. 14).
 * The engine's own checks (a modular set of the other side, a leader of the wrong side) throw when the game is
 * created, which `startCompetitive` reports.
 */
export function buildCompetitiveConfig(input: CompetitiveBuildInput): SessionConfig | null {
  const registration = parseSealedScenario(input.sealed.registration);
  const resistance = parseSealedScenario(input.sealed.resistance);
  if (!registration || !resistance) return null;
  const playerOf = new Map(input.setup.seats.map((s) => [s.seat, s.player]));
  const side = (seats: readonly string[]): CorePlayer[] | null => {
    const players = seats.map((seat) => playerOf.get(seat));
    return players.length >= 1 && players.length <= 2 && players.every((p) => p !== undefined)
      ? (players as CorePlayer[])
      : null;
  };
  const registrationPlayers = side(input.teams.registration);
  const resistancePlayers = side(input.teams.resistance);
  if (!registrationPlayers || !resistancePlayers) return null;
  // MC56 p. 14: "either 1v1 ... or 2v2"; the engine refuses 1v2 and 2v1 too, this only keeps them from reaching it.
  if (registrationPlayers.length !== resistancePlayers.length) return null;
  const team = (scenario: SealedScenario, count: number) => ({
    leaderScenarioId: scenario.leaderScenarioId,
    playerCount: count,
    modularSetIds: scenario.modularSetIds,
    mainSchemeStageIds: scenario.mainSchemeStageIds,
    ...(scenario.extraModularSetIds?.length ? { extraModularSetIds: scenario.extraModularSetIds } : {}),
  });
  return {
    scenarioId: registration.leaderScenarioId,
    difficulty: input.setup.expert ? "expert" : "standard",
    players: [...registrationPlayers, ...resistancePlayers],
    seed: input.setup.seed,
    competitive: {
      teams: [team(registration, registrationPlayers.length), team(resistance, resistancePlayers.length)],
      tieBreaks: input.tieBreaks,
    },
  };
}

/**
 * The seats that are on a team, in engine player order: registration's seats first, then resistance's, each in seat
 * order. Seat n of this list plays engine player `p<n>`. A seat with no team is left out.
 */
export function competitiveSeatOrder(state: Pick<RoomState, "seats">): readonly string[] {
  const onTeam = (team: TeamId) => state.seats.filter((seat) => seat.team === team).map((seat) => seat.id);
  return [...onTeam("registration"), ...onTeam("resistance")];
}

/**
 * The team of each engine player (`p1`..), from the lobby's seats, in `competitiveSeatOrder`: the one mapping
 * `startCompetitive` sends the room at Start and uses here, so the gate and the lobby never disagree.
 */
export function roomTeamsOf(state: Pick<RoomState, "seats">): Record<string, TeamId> {
  const teams: Record<string, TeamId> = {};
  competitiveSeatOrder(state).forEach((id, index) => {
    const seat = state.seats.find((s) => s.id === id);
    if (seat?.team) teams[`p${index + 1}`] = seat.team;
  });
  return teams;
}

/** The engine players (`p1`..) of the seats `state` marks as mine, in `competitiveSeatOrder`. */
export function localPlayersOf(state: Pick<RoomState, "seats">): readonly string[] {
  return competitiveSeatOrder(state).flatMap((id, index) =>
    state.seats.find((s) => s.id === id)?.mine ? [`p${index + 1}`] : [],
  );
}

/**
 * The title an identity shares with `leaderName` (the identity's name or either face's name, as the engine's
 * `civilWarCompetitive` compares them), or null. A team cannot field such an identity (MC56 pp. 14, 16).
 */
export function titleSharedWithLeader(identity: AnyCard | undefined, leaderName: string): string | null {
  if (identity?.type !== "hero_identity") return null;
  const titles = [identity.name, identity.hero.faceName, identity.alterEgo.faceName];
  return titles.includes(leaderName) ? identity.name : null;
}

export interface LeaderClashInput {
  readonly teams: Readonly<Record<TeamId, readonly string[]>>;
  /** Each seat's hero (the deck's identity card id) as the host's engine saw it. */
  readonly heroes: ReadonlyMap<string, string>;
  /** Both sealed scenarios: `<team>` names that team's own leader. */
  readonly sealed: SealedScenarios;
  /** The leader's card name for a scenario id, or undefined when it is unknown here. */
  readonly leaderName: (scenarioId: string) => string | undefined;
  readonly card: (cardId: string) => AnyCard | undefined;
}

/**
 * The seats whose hero shares a title with their own team's leader, each as a refusal for that seat's holder alone (the
 * engine's `civilWarCompetitive` refuses the same at creation, without saying whose it is).
 */
export function leaderClashRefusals(input: LeaderClashInput): readonly SeatDeckRefusal[] {
  const refusals: SeatDeckRefusal[] = [];
  for (const team of ["registration", "resistance"] as const) {
    const sealed = parseSealedScenario(input.sealed[team]);
    const leader = sealed ? input.leaderName(sealed.leaderScenarioId) : undefined;
    if (leader === undefined) continue;
    for (const seat of input.teams[team]) {
      const hero = input.heroes.get(seat);
      const clash = hero === undefined ? null : titleSharedWithLeader(input.card(hero), leader);
      if (clash) {
        refusals.push({
          seat,
          code: "illegal",
          reason: `${clash} shares a title with your team's leader ${leader}: a team cannot field it (MC56 pp. 14, 16).`,
        });
      }
    }
  }
  return refusals;
}
