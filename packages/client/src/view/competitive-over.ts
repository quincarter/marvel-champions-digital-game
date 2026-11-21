/**
 * The end of a Civil War Competitive game in words (issue #883, plan M9; MC56 p. 17): one result per team, why each won
 * or lost, and, when the teams tied on win conditions and the table kept the tie-breaks on (Q9 C), each measure the
 * engine read and the one that decided. The engine decides all of it (`GameOutcome` `result: "teams"`); this only words
 * the outcome it reports and never recomputes a measure.
 */
import type { GameOutcome, GameState } from "@mc/engine";
import { t, type MessageKey } from "../i18n/translate.js";
import { seatResultLabel, seatResultOf, type SeatResult } from "./team-outcome.js";

type Side = "registration" | "resistance";

export interface CompetitiveOverRow {
  readonly side: Side;
  readonly sideLabel: string;
  /** "Victory", "Defeat", "Tie" or "Conceded", in words (never colour alone). */
  readonly resultLabel: string;
  readonly result: SeatResult;
  /** The win conditions the team met, in words, in the order met. */
  readonly conditions: readonly string[];
  /** This device's own side. */
  readonly mine: boolean;
}

export interface CompetitiveOverMeasure {
  readonly label: string;
  /** Each side's number for the measure, registration first. */
  readonly values: readonly { readonly sideLabel: string; readonly value: number }[];
  /** The measure that separated the teams. */
  readonly decided: boolean;
}

export interface CompetitiveOver {
  /** This device's result: "Victory", "Defeat", "Tie", "Conceded". */
  readonly headline: string;
  readonly rows: readonly CompetitiveOverRow[];
  /** One line about how it ended that is not a team's row: both lost, or a team conceded; null otherwise. */
  readonly reason: string | null;
  /** The tie-break panel, or null when the teams were not tied on win conditions. */
  readonly tieBreak: {
    /** Words for the whole panel: the deciding measure, or that it was still a tie, or that tie-breaks were off. */
    readonly summary: string;
    readonly measures: readonly CompetitiveOverMeasure[];
  } | null;
}

const MEASURE_KEYS: Readonly<Record<string, MessageKey>> = {
  mainSchemeAdvanced: "comp.measure.mainSchemeAdvanced",
  minionsAndSideSchemes: "comp.measure.minionsAndSideSchemes",
  mainSchemeThreat: "comp.measure.mainSchemeThreat",
  identityHitPoints: "comp.measure.identityHitPoints",
  leaderAttachments: "comp.measure.leaderAttachments",
};

const CONDITION_KEYS: Readonly<Record<string, MessageKey>> = {
  enemyLeaderDefeated: "comp.cond.enemyLeaderDefeated",
  leaderSchemeCompleted: "comp.cond.leaderSchemeCompleted",
  opponentsDefeated: "comp.cond.opponentsDefeated",
  opponentsLost: "comp.cond.opponentsLost",
};

const sideLabel = (side: Side): string =>
  t(side === "registration" ? "comp.side.registration" : "comp.side.resistance");

type TeamsOutcome = Extract<GameOutcome, { result: "teams" }>;

/** The panel for a finished competitive game, or null for any other game or while it runs. */
export function competitiveOverOf(
  state: Pick<GameState, "outcome" | "teams">,
  viewer: readonly string[] | null | undefined,
): CompetitiveOver | null {
  const outcome = state.outcome;
  if (!outcome || outcome.result !== "teams" || !state.teams) return null;
  const teams = state.teams;
  const mineIds = new Set(
    teams
      .filter((team) => viewer?.some((id) => (team.playerIds as readonly string[]).includes(id)))
      .map((team) => team.teamId),
  );
  const sideOfTeam = (teamId: string): Side => teams.find((team) => team.teamId === teamId)?.side ?? "registration";
  const conceded = outcome.reason === "teamConceded";
  const rows = outcome.teams.map<CompetitiveOverRow>((team) => {
    const side = team.side ?? sideOfTeam(team.teamId);
    // A forfeit is the conceding team's alone: the engine reports a loss for it (N12), shown as "Conceded".
    const concededHere =
      conceded &&
      outcome.concededBy !== undefined &&
      teams.find((x) => x.teamId === team.teamId)?.playerIds.includes(outcome.concededBy);
    const result: SeatResult = concededHere ? "conceded" : team.result;
    return {
      side,
      sideLabel: sideLabel(side),
      result,
      resultLabel: seatResultLabel(result),
      conditions: team.conditions.map((condition) => t(CONDITION_KEYS[condition] ?? "comp.cond.opponentsLost")),
      mine: mineIds.has(team.teamId),
    };
  });
  const reason = conceded ? t("comp.over.conceded") : outcome.decision === "bothLose" ? t("comp.over.both") : null;
  return {
    headline: seatResultLabel(seatResultOf(outcome, teams, viewer)),
    rows,
    reason,
    tieBreak: tieBreakPanel(outcome, sideOfTeam),
  };
}

function tieBreakPanel(outcome: TeamsOutcome, sideOfTeam: (teamId: string) => Side): CompetitiveOver["tieBreak"] {
  const tie = outcome.tieBreak;
  if (!tie) return null;
  if (!tie.applied) return { summary: t("comp.over.off"), measures: [] };
  const measures = (tie.measures ?? []).map<CompetitiveOverMeasure>((entry) => ({
    label: t(MEASURE_KEYS[entry.measure] ?? "comp.measure.mainSchemeThreat"),
    values: Object.entries(entry.values)
      .map(([teamId, value]) => ({ side: sideOfTeam(teamId), value }))
      .sort((a, b) => (a.side === b.side ? 0 : a.side === "registration" ? -1 : 1))
      .map(({ side, value }) => ({ sideLabel: sideLabel(side), value })),
    decided: tie.decidedBy === entry.measure,
  }));
  const decided = measures.find((m) => m.decided);
  return {
    summary: decided ? t("comp.over.decided", { measure: decided.label }) : t("comp.over.undecided"),
    measures,
  };
}
