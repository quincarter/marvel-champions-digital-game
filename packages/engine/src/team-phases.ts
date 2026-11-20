/**
 * The team-scoped turn structure of a game with two teams (docs/competitive-mode-plan.md §3.7, milestone M2).
 *
 * MC56 p. 16 (scenario rules override RRG per Golden Rule, RRG p. 4): "The registration team always goes first each
 * round", and a round is the registration team's hero phase, the resistance team's hero phase, the registration team's
 * villain phase and the resistance team's villain phase (p. 20, quick reference). "During the other team's phases,
 * your side of the table is inactive." "In 2v2 play, each team has its own first player token. Pass it at the end of
 * that team's villain phase." Owner decisions of 2026-11-20: one shared round of the four phases (Q3 B); the active
 * team's first player orders simultaneous triggers across both areas (N2).
 *
 * Everything here keeps the existing readers right without their knowing about teams: while a team is active,
 * `GameState.firstPlayerId` is its token holder and `GameState.activeVillainId` the leader it faces, so "the first
 * player", "in player order" from the token and "the encounter deck" are the active team's. Each switch is logged
 * `activeTeamChanged`. With no active team (every cooperative game) each function is the whole table's, unchanged.
 */

import { emit, type Ctx } from "./ctx.js";
import type { InstanceId, PlayerId, TeamId } from "./ids.js";
import { areaOfCard, nextClockwisePlayer, playerOrder } from "./query.js";
import type { GameState, PlayerState } from "./state.js";
import { activeTeamOf, teamOf, teamsOf, type TeamState } from "./team.js";

/**
 * "In player order" for the phase being played (RRG 1.8 "In Player Order", p. 24): the active team's players from its
 * first player clockwise, or every player when the whole table plays the phase. Eliminated players are skipped.
 */
export function phasePlayerOrder(state: GameState): readonly PlayerState[] {
  const active = activeTeamOf(state);
  const order = playerOrder(state);
  return active === null ? order : order.filter((player) => active.playerIds.includes(player.playerId));
}

/**
 * Whether a card is on the active team's side of the table, for the steps a team plays on its own side ("Each player
 * readies all of their cards. Ready each exhausted encounter card", RRG 1.8 "End of Player Phase", p. 18; MC56 p. 16:
 * each team plays its entire hero phase, "including readying"). True for every card with no active team, and for a card
 * in no area (in every area).
 */
export function onActiveSide(state: GameState, id: InstanceId): boolean {
  const active = activeTeamOf(state);
  if (active === null || active.areaId === null) return true;
  const area = areaOfCard(state, id);
  return area === null || area.areaId === active.areaId;
}

/**
 * The next player clockwise from `from` who is still in the game and on `from`'s team: where a team's first player
 * token goes (MC56 p. 16) and who takes an eliminated player's cards (p. 20: "in 2v2, if one of your teammates is
 * eliminated, … your remaining teammate"). With no stored teams, `nextClockwisePlayer`.
 */
export function nextClockwiseTeammate(state: GameState, from: PlayerId): PlayerState | undefined {
  if (!state.teams) return nextClockwisePlayer(state, from);
  const team = teamOf(state, from);
  const seated = [...state.players].sort((a, b) => a.seatIndex - b.seatIndex);
  const index = seated.findIndex((player) => player.playerId === from);
  for (let step = 1; step <= seated.length; step++) {
    const candidate = seated[(index + step) % seated.length] as PlayerState;
    if (!candidate.eliminated && team.playerIds.includes(candidate.playerId)) return candidate;
  }
  return undefined;
}

const withTeam = (state: GameState, id: TeamId, update: (team: TeamState) => TeamState): GameState => ({
  ...state,
  teams: (state.teams ?? []).map((team) => (team.teamId === id ? update(team) : team)),
});

/**
 * Gives `playerId`'s team's first player token to `playerId` and logs it. The active team's token (or the one token
 * of a game without stored teams) is `GameState.firstPlayerId`; a stored team's is kept on its `TeamState` too.
 */
export function setTeamFirstPlayer(ctx: Ctx, playerId: PlayerId): void {
  if (!ctx.state.teams) {
    ctx.state = { ...ctx.state, firstPlayerId: playerId };
    emit(ctx, { type: "firstPlayerChanged", playerId });
    return;
  }
  const team = teamOf(ctx.state, playerId);
  ctx.state = withTeam(ctx.state, team.teamId, (t) => ({ ...t, firstPlayerId: playerId }));
  const active = ctx.state.activeTeamId === undefined || ctx.state.activeTeamId === team.teamId;
  if (active) ctx.state = { ...ctx.state, firstPlayerId: playerId };
  emit(ctx, { type: "firstPlayerChanged", playerId, teamId: team.teamId });
}

/**
 * Makes `id` the active team: its token holder becomes `GameState.firstPlayerId` and the leader in its game area
 * `GameState.activeVillainId` ("the villain" and "the encounter deck" of the table's existing readers). The outgoing
 * team's token is already on its `TeamState` (`setTeamFirstPlayer` keeps both). No change, and nothing logged, when `id`
 * is already active.
 */
export function switchActiveTeam(ctx: Ctx, id: TeamId, phase: "setup" | "player" | "villain"): void {
  if (ctx.state.activeTeamId === id) return;
  const team = teamsOf(ctx.state).find((candidate) => candidate.teamId === id);
  if (!team) return;
  const area = ctx.state.gameAreas.find((candidate) => candidate.areaId === team.areaId);
  // Kept current as the token passes (`setTeamFirstPlayer`), an elimination's pass included.
  const firstPlayerId = team.firstPlayerId ?? team.playerIds[0] ?? ctx.state.firstPlayerId;
  const activeVillainId = area?.activeVillainId ?? ctx.state.activeVillainId;
  ctx.state = { ...ctx.state, activeTeamId: id, firstPlayerId, activeVillainId };
  emit(ctx, { type: "activeTeamChanged", teamId: id, phase, firstPlayerId, activeVillainId });
}
