/**
 * What the game-over screen says and shows for a Civil War Competitive game (issue #883, MC56 p. 17): the result in the
 * viewer's team's words ("Registration Victory"), each team's leader and heroes as cards, which side won, and the
 * tie-break panel. The screen is the campaign's own Victory / Defeat screen (`scenes/game-over.ts`); this is only the
 * competitive words and cards it draws in place of the villain's. All outcomes come from the engine's `GameOutcome`
 * (through `competitiveOverOf`); nothing is computed here.
 *
 * A team's leader is the one the other team fights (`SessionConfig.competitive.teams[n].leaderScenarioId`: "the leader
 * the other team fights"), so it is read from the other team's game area.
 */
import type { GameState, InstanceId } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import { t } from "../i18n/translate.js";
import { competitiveOverOf, type CompetitiveOver, type CompetitiveOverRow } from "./competitive-over.js";
import { cardName } from "./names.js";
import type { SeatResult } from "./team-outcome.js";

type Side = CompetitiveOverRow["side"];

export interface CompetitiveCard {
  readonly instanceId: InstanceId;
  readonly name: string;
}

export interface CompetitiveResultTeam {
  readonly side: Side;
  readonly sideLabel: string;
  readonly result: SeatResult;
  /** "Victory", "Defeat", "Tie" or "Conceded", in the player's language. */
  readonly resultLabel: string;
  readonly winner: boolean;
  /** This device's own team. */
  readonly mine: boolean;
  /** Words that say so beside the card, never colour alone: "★ Winner", "Your team". */
  readonly tags: readonly string[];
  readonly leader: CompetitiveCard | null;
  /** The leader's scenario id, for its picture in `art/scenarios/`. */
  readonly leaderScenarioId: string | null;
  readonly heroes: readonly CompetitiveCard[];
  readonly conditions: readonly string[];
}

export interface CompetitiveGameOver {
  readonly headline: string;
  readonly kicker: string;
  readonly summary: string;
  /** Registration first, then resistance. */
  readonly teams: readonly CompetitiveResultTeam[];
  /** The scenario this device's team faced (the leader scenario of the other team), for the result's scene. */
  readonly facedScenarioId: string | null;
  /** The tie-break panel's heading and rows, or the plain "how it ended" lines when the teams were not tied. */
  readonly panel: {
    readonly heading: string;
    readonly lines: readonly { readonly text: string; readonly detail: string | null; readonly decided: boolean }[];
  };
  readonly over: CompetitiveOver;
}

const RESULT_WORD: Readonly<
  Record<SeatResult, "comp.over.win" | "comp.over.loss" | "comp.over.tie" | "comp.over.conceded.label">
> = {
  win: "comp.over.win",
  loss: "comp.over.loss",
  tie: "comp.over.tie",
  conceded: "comp.over.conceded.label",
};

const HEADLINE: Readonly<
  Record<SeatResult, "comp.over.h.win" | "comp.over.h.loss" | "comp.over.h.tie" | "comp.over.h.conceded">
> = {
  win: "comp.over.h.win",
  loss: "comp.over.h.loss",
  tie: "comp.over.h.tie",
  conceded: "comp.over.h.conceded",
};

/** The competitive result for a finished two-team game, or null for any other game or while it runs. */
export function competitiveGameOverOf(
  state: GameState,
  config: SessionConfig | null,
  viewer: readonly string[] | null | undefined,
): CompetitiveGameOver | null {
  const over = competitiveOverOf(state, viewer);
  const stateTeams = state.teams;
  if (!over || !stateTeams) return null;
  const leaderOf = (ofSide: Side): InstanceId | null => {
    const other = stateTeams.find((team) => team.side !== ofSide);
    const area = state.gameAreas.find((candidate) => candidate.areaId === other?.areaId);
    return area?.activeVillainId ?? area?.villainIds[0] ?? null;
  };
  const scenarioOf = (ofSide: Side): string | null =>
    config?.competitive?.teams[ofSide === "registration" ? 0 : 1]?.leaderScenarioId ?? null;
  const card = (id: InstanceId): CompetitiveCard => ({ instanceId: id, name: cardName(state, id) });

  const tags = (row: CompetitiveOverRow): string[] => [
    ...(row.result === "win" ? [t("comp.over.tag.winner")] : []),
    ...(row.mine ? [t("comp.over.tag.you")] : []),
  ];
  const teams = over.rows.map<CompetitiveResultTeam>((row) => {
    const stateTeam = stateTeams.find((team) => team.side === row.side);
    const leaderId = leaderOf(row.side);
    return {
      side: row.side,
      sideLabel: row.sideLabel,
      result: row.result,
      resultLabel: t(RESULT_WORD[row.result]),
      winner: row.result === "win",
      mine: row.mine,
      tags: tags(row),
      leader: leaderId ? card(leaderId) : null,
      leaderScenarioId: scenarioOf(row.side),
      heroes: (stateTeam?.playerIds ?? []).flatMap((id) => {
        const player = state.players.find((candidate) => candidate.playerId === id);
        return player ? [card(player.identity.instanceId)] : [];
      }),
      conditions: row.conditions,
    };
  });

  const mine = teams.filter((team) => team.mine);
  const winners = teams.filter((team) => team.winner);
  // One team of ours: its result; both or neither (a hot seat): the winner's, if there is one, else the plain result.
  const headlineTeam = mine.length === 1 ? mine[0]! : winners.length === 1 ? winners[0]! : null;
  const headline = headlineTeam
    ? t(HEADLINE[headlineTeam.result], { side: headlineTeam.sideLabel })
    : over.reason && over.rows.some((row) => row.result === "conceded")
      ? t("comp.over.h.noside.conceded")
      : t(over.reason ? "comp.over.h.noside.loss" : "comp.over.h.noside.tie");

  const winner = winners[0] ?? null;
  const summary = winner
    ? [
        winner.conditions.length > 0
          ? t("comp.over.how", { side: winner.sideLabel, how: winner.conditions.join("; ") })
          : "",
        over.tieBreak?.summary ?? "",
      ]
        .filter((part) => part !== "")
        .join(" ")
    : (over.tieBreak?.summary ?? over.reason ?? "");

  const panel = over.tieBreak
    ? {
        heading: t("comp.over.title"),
        lines: [
          { text: over.tieBreak.summary, detail: null, decided: false },
          ...over.tieBreak.measures.map((measure) => ({
            text: `${measure.decided ? "★ " : ""}${measure.label}`,
            detail: measure.values.map((v) => `${v.sideLabel} ${v.value}`).join("   ·   "),
            decided: measure.decided,
          })),
        ],
      }
    : {
        heading: t("comp.over.how.title"),
        lines: [
          ...(over.reason ? [{ text: over.reason, detail: null, decided: false }] : []),
          ...teams.flatMap((team) =>
            team.conditions.map((text) => ({ text: `${team.sideLabel}: ${text}`, detail: null, decided: false })),
          ),
        ],
      };

  return {
    headline,
    kicker: t("comp.heading"),
    summary,
    teams,
    // The leader the viewer's team fights is the other team's: the sealed scenario of the other side.
    facedScenarioId:
      (mine.length === 1 ? scenarioOf(mine[0]!.side === "registration" ? "resistance" : "registration") : null) ??
      config?.scenarioId ??
      null,
    panel,
    over,
  };
}
