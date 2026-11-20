/**
 * Team membership (docs/competitive-mode-plan.md §3.3, §4 task 2; docs/phase7-wave10.md §3.4; MC56 pp. 6, 14, 20):
 * which players are on which team, and how many of them a per player value counts.
 *
 * A cooperative game is the one-team case: its team is every seat, and it is derived here, never stored (MC56 p. 6:
 * cooperatively, "the enemy team" refers to the players). A competitive game stores two teams. Competitive mode is not
 * built and `createGame` refuses it, so `GameState.teams` is on a state only when a test puts it there
 * (`testing/team.ts`); what reads a team here is already the code a competitive game will run.
 *
 * The team-relative words of a card are answered here too (§4 task 4): "the enemy team", "the enemy leader" and "your
 * leader", each asked for a team.
 *
 * Everything here is pure, and these are the only readers of `GameState.teams`.
 */

import { EngineInvariantError } from "./errors.js";
import { teamId, type GameAreaId, type InstanceId, type PlayerId, type TeamId } from "./ids.js";
import type { GameAreaState, GameState } from "./state.js";

/** The side of the Civil War a team took (MC56 p. 14). */
export type TeamSide = "registration" | "resistance";

export interface TeamState {
  readonly teamId: TeamId;
  /** Null for the one team of a cooperative game, which takes no side. */
  readonly side: TeamSide | null;
  /**
   * The team's seats in seat order, fixed at setup: a player eliminated during the game is still on the team, and so
   * is a seat that sat the scenario out.
   */
  readonly playerIds: readonly PlayerId[];
  /**
   * The game area the team plays in (`GameAreaState`), holding the leader it faces, or null while the players share
   * one game area.
   */
  readonly areaId: GameAreaId | null;
  /**
   * The holder of the team's own first player token (MC56 p. 16: "In 2v2 play, each team has its own first player
   * token. Pass it at the end of that team's villain phase"). While the team is active, `GameState.firstPlayerId` is
   * the same player. Absent on the one derived team of a cooperative game, whose token is `GameState.firstPlayerId`,
   * and on a hand-built test team.
   */
  readonly firstPlayerId?: PlayerId;
  /**
   * The four basic player cards of the team's own leader, set aside at setup (MC56 p. 14: "Each team finds the four
   * basic player cards for their chosen leader and sets them aside"; p. 16: its players can earn them). They wait,
   * ownerless and faceup, in the shared set-aside area (`GameState.encounterSetAside`) until the Choosing Sides reward
   * hands them out (plan M6). Absent when the team set none aside.
   */
  readonly leaderCardIds?: readonly InstanceId[];
}

/** The one team of a game that stores none. */
export const SINGLE_TEAM = teamId("t1");

/** The teams of a game, in team order: the stored ones, or the one team of every seat in seat order. */
export function teamsOf(state: GameState): readonly TeamState[] {
  if (state.teams) return state.teams;
  const seated = [...state.players].sort((a, b) => a.seatIndex - b.seatIndex);
  return [{ teamId: SINGLE_TEAM, side: null, playerIds: seated.map((player) => player.playerId), areaId: null }];
}

function mustTeam(state: GameState, id: TeamId): TeamState {
  const team = teamsOf(state).find((candidate) => candidate.teamId === id);
  if (!team) throw new EngineInvariantError(`unknown team ${id}`);
  return team;
}

/** The team a player is on. Every seat is on exactly one. */
export function teamOf(state: GameState, playerId: PlayerId): TeamState {
  const team = teamsOf(state).find((candidate) => candidate.playerIds.includes(playerId));
  if (!team) throw new EngineInvariantError(`player ${playerId} is on no team`);
  return team;
}

/** A team's seats in seat order, eliminated players included: whoever reads it leaves out those it does not mean. */
export const playersOnTeam = (state: GameState, id: TeamId): readonly PlayerId[] => mustTeam(state, id).playerIds;

/**
 * The number of a team's players who started the scenario: what a per player value counts for a card that team
 * faces (MC56 p. 20: "per player" applies only "to the players on your team"). Like `GameState.startingPlayerCount`
 * it leaves out a seat that sat the scenario out and does not change when a player is eliminated (RRG 1.8 "Per
 * Player Icon", p. 32). With the one derived team it is `startingPlayerCount` itself.
 */
export function teamSize(state: GameState, id: TeamId): number {
  const team = mustTeam(state, id);
  if (!state.teams) return state.startingPlayerCount;
  return state.players.filter((player) => team.playerIds.includes(player.playerId) && !player.sittingOut).length;
}

/**
 * The number a per player icon multiplies by for a card in `area` (RRG 1.8 "Per Player Icon", p. 32; MC56 p. 20: per
 * player values apply only "to the players on your team"): the size of the team that plays in that area. The one
 * helper every per player value is read through (docs/competitive-mode-plan.md §4 task 3).
 *
 * `GameState.startingPlayerCount` when the game stores no teams, which is every cooperative game, and for a card in no
 * team's area (`area` null, or an area no team plays in): the central stage, an environment, an encounter card in a
 * deck or discard pile.
 */
export function perPlayerCount(state: GameState, area: Pick<GameAreaState, "areaId"> | null): number {
  if (!state.teams || !area) return state.startingPlayerCount;
  const team = state.teams.find((candidate) => candidate.areaId === area.areaId);
  return team ? teamSize(state, team.teamId) : state.startingPlayerCount;
}

/** The team that plays in a game area, or null: the game stores no teams, or no team plays there. */
export const teamInArea = (state: GameState, area: Pick<GameAreaState, "areaId">): TeamState | null =>
  state.teams?.find((candidate) => candidate.areaId === area.areaId) ?? null;

/**
 * "The enemy team" of a team: the other team, and the same team when the game has one. MC56 p. 6 (cooperative play):
 * "'the enemy team' refers to the players".
 */
export function enemyTeamOf(state: GameState, id: TeamId): TeamState {
  const team = mustTeam(state, id);
  return teamsOf(state).find((candidate) => candidate.teamId !== id) ?? team;
}

/**
 * "The enemy leader" of a team: the leader it is fighting, which is the active villain of the game area it plays in,
 * and the game's active villain for a team with no area of its own (every cooperative game). MC56 p. 6: "The leader in
 * play is called 'the enemy leader.'"; ruling of July 9, 2026 (3) answer 2: outside Civil War scenarios "enemy leader"
 * refers to the villain. Null once that villain is defeated, and for an area with no villain.
 *
 * In a cooperative game whose players are split over separate game areas (docs/phase7-wave2.md §3.1) the team has no
 * one area, and "the villain" depends on which area asks: `leaderFor` (`select.ts`) reads it for an effect.
 */
export function enemyLeaderOf(state: GameState, id: TeamId): InstanceId | null {
  const team = mustTeam(state, id);
  const area = team.areaId === null ? null : state.gameAreas.find((candidate) => candidate.areaId === team.areaId);
  if (area === undefined) return null;
  const leaderId = area ? area.activeVillainId : state.activeVillainId;
  const leader = state.villains.find((villain) => villain.instanceId === leaderId);
  return leader && !leader.defeated ? leader.instanceId : null;
}

/**
 * "Your leader" for a team: the leader the enemy team is fighting. Null when the game has one team, where no leader is
 * the players' own. MC56 p. 6 (cooperative play): "A card ability that refers to 'your leader' cannot be resolved.
 * These cards typically have alternate effects that will resolve instead. Do as much as you can."
 */
export function yourLeaderOf(state: GameState, id: TeamId): InstanceId | null {
  const enemy = enemyTeamOf(state, id);
  return enemy.teamId === id ? null : enemyLeaderOf(state, enemy.teamId);
}

/**
 * The team whose phase it is (`GameState.activeTeamId`), or null when the whole table plays every phase together: a
 * game with one team, and a hand-built two-team state that set no active team.
 */
export function activeTeamOf(state: GameState): TeamState | null {
  if (state.activeTeamId === undefined) return null;
  return mustTeam(state, state.activeTeamId);
}

/** Whether `playerId` sits on the side of the table that is inactive now (MC56 p. 16; Q11 A per owner decision 2026-11-20). */
export function onInactiveTeam(state: GameState, playerId: PlayerId): boolean {
  const active = activeTeamOf(state);
  return active !== null && !active.playerIds.includes(playerId);
}

/** The team that comes after `id` in team order, or null for the last team: the round's next team (MC56 p. 16). */
export function nextTeamAfter(state: GameState, id: TeamId): TeamState | null {
  const teams = teamsOf(state);
  const index = teams.findIndex((team) => team.teamId === id);
  return index < 0 ? null : (teams[index + 1] ?? null);
}

/**
 * The first player token of a player's team: `GameState.firstPlayerId` for the active team and for a game that stores
 * no teams, else the team's own token (`TeamState.firstPlayerId`).
 */
export function teamFirstPlayerOf(state: GameState, team: TeamState): PlayerId {
  if (!state.teams || state.activeTeamId === team.teamId) return state.firstPlayerId;
  return team.firstPlayerId ?? state.firstPlayerId;
}

/** The side's name a player reads in a refusal ("the Registration team"). */
const sideLabel = (team: TeamState): string =>
  team.side === null ? `team ${team.teamId}` : `the ${team.side[0]!.toUpperCase()}${team.side.slice(1)} team`;

/**
 * Why `playerId` may not act now, or null when they may: during the other team's phase "your side of the table is
 * inactive" (MC56 p. 16). Owner decision Q11 A (2026-11-20): the inactive team takes no action; its triggered abilities
 * still fire and it answers choices addressed to it, which reach it as `resolveChoice` and are not refused here.
 */
export function inactiveTeamMessage(state: GameState, playerId: PlayerId): string | null {
  const active = activeTeamOf(state);
  if (active === null || active.playerIds.includes(playerId)) return null;
  const phase = state.step.phase === "villain" ? "villain" : "hero";
  return `It is ${sideLabel(active)}'s ${phase} phase: your side of the table is inactive until it ends.`;
}
