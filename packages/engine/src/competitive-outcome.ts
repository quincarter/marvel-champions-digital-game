/**
 * How a competitive game ends (docs/competitive-mode-plan.md §1.7, milestone M5).
 *
 * MC56 pp. 16-17, 20 (scenario rules override RRG per Golden Rule, RRG p. 4). Three ways to win: defeat the enemy
 * leader first; have your leader complete its main scheme first (the scheme in the enemy team's area, whose final
 * stage reads "If this stage is completed, the players lose the game"); have your leader defeat all your opponents'
 * identities first (any cause, Q8 A). "The game does not end until both sides have played an equal number of phases":
 * when one team wins or loses, play continues through the end of the resistance team's next phase (Q7, settled by the
 * rules expert 2026-11-20: the game ends once both sides have played the same number of phases); a team that wins
 * plays on to the end of its current phase. If both teams lose in that time, both lose; if both defeat their enemy
 * leaders, it is a tie. Owner decisions of 2026-11-20: different win conditions met in that window are a tie too (N4),
 * never decided by who acted first; a leader defeated by a leader-versus-leader attack counts for the team whose area
 * holds it (N3); a tie is settled by MC56 p. 17's tie-breaks in printed order when the table chose them (Q9 C, the
 * lobby's `tieBreaks` option, on by default), and stays a tie when it did not.
 *
 * The phase order is registration hero, resistance hero, registration villain, resistance villain (MC56 p. 16; Q3 B), so
 * the phase a game closes after is always the last team's phase of the kind being played when the first result came:
 * its current phase when it is active, else its next one, of the same kind and round.
 *
 * Every cooperative game is untouched: nothing here runs without stored teams (`GameState.teams`).
 */

import { emit, type Ctx } from "./ctx.js";
import type { EncounterDeckId, InstanceId, PlayerId, TeamId } from "./ids.js";
import { areaOfCard, encounterDeckArea, mainSchemeFor, mainSchemeStateOf, maxHitPoints } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { GameAreaState, GameState } from "./state.js";
import { teamInArea, teamOf, teamsOf, type TeamSide, type TeamState } from "./team.js";

/**
 * A win condition one team met (MC56 p. 17), named from that team's side of the table:
 * - `enemyLeaderDefeated`: the leader in its own area, the one it fights, was defeated;
 * - `leaderSchemeCompleted`: its leader completed its main scheme (the final stage of the scheme in the enemy team's
 *   area), which is the enemy team losing;
 * - `opponentsDefeated`: every identity of the enemy team was defeated, by any cause (Q8 A);
 * - `opponentsLost`: the enemy team lost some other way the rules name for one team (a card's own "the players lose":
 *   MC56 p. 20 QR, "the players" is that team only; the encounter deck in its area emptied with its discard pile
 *   empty too: RRG v1.8 "Encounter Deck" p. 17, to which MC56 adds no exception, `loseIfEncounterCardsExhausted`).
 *   Engine reading (authority step 5): MC56 names only the three above, and a loss of one team is read as the other's
 *   win, as for the scheme.
 */
export type CompetitiveCondition =
  | "enemyLeaderDefeated"
  | "leaderSchemeCompleted"
  | "opponentsDefeated"
  | "opponentsLost";

/** The conditions that are the enemy team's loss rather than this team's own achievement (MC56 p. 17: "both lose"). */
const LOSS_OF_THE_OTHER: ReadonlySet<CompetitiveCondition> = new Set([
  "leaderSchemeCompleted",
  "opponentsDefeated",
  "opponentsLost",
]);

/** One condition met, by which team, and when. */
export interface CompetitiveTrigger {
  readonly teamId: TeamId;
  readonly condition: CompetitiveCondition;
  readonly round: number;
  /** The phase it was met in, and whose phase that was. */
  readonly phase: "player" | "villain";
  readonly activeTeamId: TeamId | null;
  /** The card behind it when there is one: the defeated leader, the completed scheme, the card whose text lost. */
  readonly instanceId?: InstanceId;
}

/** The phase the game closes after: the last team's phase of `phase` in `round` (MC56 p. 17; Q7). */
export interface CompetitiveClose {
  readonly teamId: TeamId;
  readonly round: number;
  readonly phase: "player" | "villain";
}

/** `GameState.competitive`. */
export interface CompetitiveState {
  /** MC56 p. 17's tie-breaks are applied to a tie (Q9 C per owner decision 2026-11-20; the lobby option, default on). */
  readonly tieBreaks: boolean;
  /** Present once a team has won or lost: every condition met so far, in order, and when the game closes. */
  readonly end?: {
    readonly triggers: readonly CompetitiveTrigger[];
    readonly closesAfter: CompetitiveClose;
  };
}

/** MC56 p. 17's tie-breaks, in printed order. */
export type TieBreakMeasure =
  /** 1) "the team whose enemy main scheme deck did not advance past 1B": 1 if the scheme in its area advanced, else 0. */
  | "mainSchemeAdvanced"
  /** 2) "the fewest minions and side schemes in your game area". */
  | "minionsAndSideSchemes"
  /** 3) "the least threat on your main scheme". */
  | "mainSchemeThreat"
  /** 4) "the most remaining hit points on your identities". */
  | "identityHitPoints"
  /** 5) "the fewest attachments on the leader in your area". */
  | "leaderAttachments";

export const TIE_BREAK_ORDER: readonly TieBreakMeasure[] = [
  "mainSchemeAdvanced",
  "minionsAndSideSchemes",
  "mainSchemeThreat",
  "identityHitPoints",
  "leaderAttachments",
];

/** Measures where more is better (the rest: fewer is better). */
const HIGHER_WINS: ReadonlySet<TieBreakMeasure> = new Set(["identityHitPoints"]);

/** What the tie-breaks read and which one decided, for the game-over screen. */
export interface TieBreakReport {
  /** Each measure read, in order, until one separated the teams (all five when none did). */
  readonly measures: readonly {
    readonly measure: TieBreakMeasure;
    readonly values: Readonly<Record<string, number>>;
  }[];
  /** The measure that decided, or null when the teams were still tied after all five. */
  readonly decidedBy: TieBreakMeasure | null;
}

export interface CompetitiveTeamResult {
  readonly teamId: TeamId;
  readonly side: TeamSide | null;
  readonly result: "win" | "loss" | "tie";
  /** The win conditions this team met before the game closed (MC56 p. 17), in the order met. */
  readonly conditions: readonly CompetitiveCondition[];
}

/** `GameOutcome` for a competitive game (MC56 p. 17). */
export interface CompetitiveOutcome {
  readonly result: "teams";
  /** `teamConceded`: a team forfeited (N12 A, `competitiveConcession`); `competitiveEnded`: every other end. */
  readonly reason: "competitiveEnded" | "teamConceded";
  /** With `teamConceded`: the seat whose concession it was. */
  readonly concededBy?: PlayerId;
  readonly decision: "win" | "tie" | "bothLose";
  readonly teams: readonly CompetitiveTeamResult[];
  /** Present when the teams were tied on win conditions: the tie-break the table chose (Q9 C), or `applied: false`. */
  readonly tieBreak?: { readonly applied: boolean } & Partial<TieBreakReport>;
}

/** Whether this game's end is decided by teams (a game with stored teams: competitive mode). */
export const hasTeamOutcome = (state: GameState): boolean => state.teams !== undefined;

/** Where a result comes from, to name the team it belongs to. */
export interface ResultSide {
  readonly instanceId?: InstanceId | null;
  readonly deckId?: EncounterDeckId | null;
  readonly playerId?: PlayerId | null;
}

function areaTeam(state: GameState, area: GameAreaState | null): TeamState | null {
  return area ? teamInArea(state, area) : null;
}

/** The team whose side of the table `side` is on, or null. */
export function teamOfSide(state: GameState, side: ResultSide): TeamState | null {
  if (side.playerId) return teamOf(state, side.playerId);
  if (side.instanceId) {
    const byCard = areaTeam(state, areaOfCard(state, side.instanceId));
    if (byCard) return byCard;
  }
  if (side.deckId) return areaTeam(state, encounterDeckArea(state, side.deckId));
  return null;
}

const otherTeam = (state: GameState, id: TeamId): TeamState | null =>
  teamsOf(state).find((team) => team.teamId !== id) ?? null;

/**
 * The kind of phase being played now. During a phase's end (its "when/after the phase ends" effects) the step is
 * already the `teamHandover` naming the next phase, so the phase still ending is read from it instead: a handover to
 * the next team's hero phase, or to the first team's villain phase (after the last team's hero phase), ends a hero
 * phase; a handover to a later team's villain phase ends a villain phase (MC56 p. 16; Q3 B).
 */
export function phaseBeingPlayed(state: GameState): "player" | "villain" {
  const step = state.step;
  if (step.kind === "teamHandover") {
    const [first] = teamsOf(state);
    return step.phase === "player" || step.teamId === first?.teamId ? "player" : "villain";
  }
  return step.phase === "villain" ? "villain" : "player";
}

/** The phase the game closes after, from the moment of the first result. */
function closeFor(state: GameState): CompetitiveClose {
  const teams = teamsOf(state);
  const last = teams[teams.length - 1]!;
  return { teamId: last.teamId, round: state.round, phase: phaseBeingPlayed(state) };
}

/**
 * Records that `teamId` met `condition` (MC56 p. 17). The first result opens the window: the game then closes after
 * the last team's phase of the kind being played (`closesAfter`). A condition a team has already met is not recorded
 * again (a completed scheme stays completed). Logged `teamResultRecorded`.
 */
export function recordTeamCondition(
  ctx: Ctx,
  teamId: TeamId,
  condition: CompetitiveCondition,
  instanceId?: InstanceId,
): void {
  if (ctx.state.outcome) return;
  const current = ctx.state.competitive ?? { tieBreaks: true };
  const end = current.end;
  if (end?.triggers.some((t) => t.teamId === teamId && t.condition === condition)) return;
  const trigger: CompetitiveTrigger = {
    teamId,
    condition,
    round: ctx.state.round,
    phase: phaseBeingPlayed(ctx.state),
    activeTeamId: ctx.state.activeTeamId ?? null,
    ...(instanceId ? { instanceId } : {}),
  };
  const closesAfter = end?.closesAfter ?? closeFor(ctx.state);
  ctx.state = {
    ...ctx.state,
    competitive: { ...current, end: { triggers: [...(end?.triggers ?? []), trigger], closesAfter } },
  };
  emit(ctx, { type: "teamResultRecorded", trigger, closesAfter });
}

/** Records a loss of `teamId` as the other team's win condition. */
export function recordTeamLoss(
  ctx: Ctx,
  teamId: TeamId,
  condition: Exclude<CompetitiveCondition, "enemyLeaderDefeated">,
  instanceId?: InstanceId,
): void {
  const other = otherTeam(ctx.state, teamId);
  if (other) recordTeamCondition(ctx, other.teamId, condition, instanceId);
}

/** Whether every seat of a team is eliminated. */
export const teamEliminated = (state: GameState, team: TeamState): boolean =>
  team.playerIds.every((id) => state.players.find((p) => p.playerId === id)?.eliminated !== false);

/**
 * Whether the game closes now, after a phase of `ended.teamId` of kind `ended.phase` in `ended.round` has ended, or at
 * once when no seat is left to play a phase. MC56 p. 17: "The game does not end until both sides have played an equal
 * number of phases."
 */
export function competitiveCloseDue(
  state: GameState,
  ended: { readonly teamId: TeamId; readonly phase: "player" | "villain"; readonly round: number } | null,
): boolean {
  const end = state.competitive?.end;
  if (!end) return false;
  if (state.players.every((player) => player.eliminated)) return true;
  if (!ended) return false;
  const at = end.closesAfter;
  return ended.teamId === at.teamId && ended.phase === at.phase && ended.round === at.round;
}

/** The decision from the triggers met (MC56 p. 17; N4). */
export function competitiveOutcome(state: GameState, deps?: Parameters<typeof maxHitPoints>[2]): CompetitiveOutcome {
  const teams = teamsOf(state);
  const triggers = state.competitive?.end?.triggers ?? [];
  const conditionsOf = (team: TeamState) =>
    triggers.filter((trigger) => trigger.teamId === team.teamId).map((trigger) => trigger.condition);
  const winners = teams.filter((team) => conditionsOf(team).length > 0);
  const result = (team: TeamState, value: CompetitiveTeamResult["result"]): CompetitiveTeamResult => ({
    teamId: team.teamId,
    side: team.side,
    result: value,
    conditions: conditionsOf(team),
  });
  const base = { result: "teams" as const, reason: "competitiveEnded" as const };
  // No condition met by either team (a state read before any result): no winner and no loser, so not "both lose".
  if (winners.length === 0) return { ...base, decision: "tie", teams: teams.map((team) => result(team, "tie")) };
  if (winners.length === 1) {
    const [winner] = winners;
    return {
      ...base,
      decision: "win",
      teams: teams.map((team) => result(team, team.teamId === winner!.teamId ? "win" : "loss")),
    };
  }
  // Both teams met a win condition. Each only by the other's loss: both lost (MC56 p. 17: "both teams lose").
  if (winners.every((team) => conditionsOf(team).every((condition) => LOSS_OF_THE_OTHER.has(condition)))) {
    return { ...base, decision: "bothLose", teams: teams.map((team) => result(team, "loss")) };
  }
  // Otherwise a tie (both defeated their enemy leaders, p. 17; or different win conditions in the window, N4), settled
  // by the tie-breaks when the table chose them (Q9 C).
  const tieBreaks = state.competitive?.tieBreaks ?? true;
  if (!tieBreaks) {
    return { ...base, decision: "tie", teams: teams.map((team) => result(team, "tie")), tieBreak: { applied: false } };
  }
  const report = tieBreakReport(state, deps);
  const decided = report.decidedBy;
  if (decided === null) {
    return {
      ...base,
      decision: "tie",
      teams: teams.map((team) => result(team, "tie")),
      tieBreak: { applied: true, ...report },
    };
  }
  const values = report.measures[report.measures.length - 1]!.values;
  const better = (a: number, b: number) => (HIGHER_WINS.has(decided) ? a > b : a < b);
  const [first, second] = teams;
  const firstWins = better(values[first!.teamId]!, values[second!.teamId]!);
  return {
    ...base,
    decision: "win",
    teams: teams.map((team) => result(team, (team.teamId === first!.teamId) === firstWins ? "win" : "loss")),
    tieBreak: { applied: true, ...report },
  };
}

/**
 * A team's forfeit (N12 A per owner decision 2026-11-20; MC56 p. 17 has no concession, so this is the engine's): the
 * game ends at once, the conceding team loses and the other wins, with no equal phases and no tie-breaks. The
 * conditions each team met before it are kept for the record.
 */
export function competitiveConcession(state: GameState, teamId: TeamId, byPlayerId: PlayerId): CompetitiveOutcome {
  const triggers = state.competitive?.end?.triggers ?? [];
  return {
    result: "teams",
    reason: "teamConceded",
    concededBy: byPlayerId,
    decision: "win",
    teams: teamsOf(state).map((team) => ({
      teamId: team.teamId,
      side: team.side,
      result: team.teamId === teamId ? "loss" : "win",
      conditions: triggers.filter((trigger) => trigger.teamId === team.teamId).map((trigger) => trigger.condition),
    })),
  };
}

/** One tie-break measure for a team, read on its own side of the table (MC56 p. 17). */
export function tieBreakValue(
  state: GameState,
  team: TeamState,
  measure: TieBreakMeasure,
  deps?: Parameters<typeof maxHitPoints>[2],
): number {
  const area = state.gameAreas.find((candidate) => candidate.areaId === team.areaId) ?? null;
  const inArea = (id: InstanceId): boolean => {
    const at = areaOfCard(state, id);
    return at !== null && area !== null && at.areaId === area.areaId;
  };
  switch (measure) {
    case "mainSchemeAdvanced": {
      const scheme = mainSchemeFor(state, area);
      const current = scheme ? mainSchemeStateOf(state, scheme.instanceId) : undefined;
      if (!current) return 0;
      const first = current.stageOrder?.[0] ?? 0;
      return current.stageIndex !== first ? 1 : 0;
    }
    case "minionsAndSideSchemes":
      return cardsInPlay(state).filter((id) => {
        const type = state.cardPool[state.instances[id]!.cardId]?.type;
        return (type === "minion" || type === "side_scheme") && inArea(id);
      }).length;
    case "mainSchemeThreat": {
      const scheme = mainSchemeFor(state, area);
      return scheme ? (state.instances[scheme.instanceId]?.threat ?? 0) : 0;
    }
    case "identityHitPoints":
      return team.playerIds.reduce((sum, playerId) => {
        const player = state.players.find((p) => p.playerId === playerId);
        if (!player || player.eliminated) return sum;
        const id = player.identity.instanceId;
        const max = maxHitPoints(state, id, deps) ?? 0;
        return sum + Math.max(0, max - (state.instances[id]?.damage ?? 0));
      }, 0);
    case "leaderAttachments": {
      const leaderId = area?.activeVillainId ?? null;
      return leaderId ? (state.instances[leaderId]?.attachments.length ?? 0) : 0;
    }
  }
}

/** MC56 p. 17's tie-breaks in printed order, until one separates the two teams. */
export function tieBreakReport(state: GameState, deps?: Parameters<typeof maxHitPoints>[2]): TieBreakReport {
  const teams = teamsOf(state);
  const measures: { measure: TieBreakMeasure; values: Record<string, number> }[] = [];
  for (const measure of TIE_BREAK_ORDER) {
    const values = Object.fromEntries(teams.map((team) => [team.teamId, tieBreakValue(state, team, measure, deps)]));
    measures.push({ measure, values });
    const distinct = new Set(Object.values(values));
    if (distinct.size > 1) return { measures, decidedBy: measure };
  }
  return { measures, decidedBy: null };
}
