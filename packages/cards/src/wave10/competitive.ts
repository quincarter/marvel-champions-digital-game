/**
 * Civil War's competitive mode as a setup config (docs/competitive-mode-plan.md §1.2, milestone M1): two teams, each
 * building the scenario the other team faces, traded at the table.
 *
 * MC56 p. 14 (scenario rules override RRG per Golden Rule, RRG p. 4): "Each team chooses a different side … then builds
 * a scenario for the enemy team … using the Standard PvP encounter set instead of the Standard encounter set", "Each
 * team finds the four basic player cards for their chosen leader and sets them aside", "the teams trade scenarios".
 * Owner decisions of 2026-11-20: teams of 1 or 2 players (Q14), one difficulty for the whole table (Q13 A), each area
 * set up on its own, registration first (Q4 A).
 */

import type { CardId, EncounterSetId } from "@mc/content";
import type { CompetitiveScenarioSetup, CompetitiveTeamSetup, GameSetupConfig } from "@mc/engine";
import type { CorePlayer } from "../core/setup.js";
import { WAVE10_CARDS } from "./cards.js";
import {
  WAVE10_GAME_ENCOUNTER_SETS,
  wave10CompetitiveScenario,
  wave10ScenarioRecord,
  type Wave10Difficulty,
  type Wave10ScenarioOptions,
} from "./setup.js";

/** One team of a competitive game. */
export interface CivilWarCompetitiveTeam {
  /**
   * The team's chosen leader, of its own side, by its scenario id (`registration-iron-man`, …): the leader the **other**
   * team fights, and whose four basic player cards this team may earn (MC56 p. 14).
   */
  readonly leaderScenarioId: string;
  /** The scenario this team builds for the other team: modular sets and main scheme stages (MC56 pp. 4-5). */
  readonly scenario?: Pick<Wave10ScenarioOptions, "modularSetIds" | "mainSchemeStageIds" | "extraModularSetIds">;
  /** The team's seats, 1 or 2 (Q14). */
  readonly players: readonly CorePlayer[];
  /** Which of the team's seats starts with its first player token. Default its first. */
  readonly firstPlayerIndex?: number;
}

export interface CivilWarCompetitiveOptions {
  readonly seed: number;
  /** The registration team, then the resistance team (MC56 p. 16: "The registration team always goes first"). */
  readonly teams: readonly [CivilWarCompetitiveTeam, CivilWarCompetitiveTeam];
  /** Standard or expert, for both scenarios (Q13 A per owner decision 2026-11-20). */
  readonly difficulty?: Wave10Difficulty;
}

/** The four basic player cards of a leader (`specificTo.kind === "competitive"`, the leader's encounter set). */
export function leaderPlayerCardIds(leaderScenarioId: string): readonly CardId[] {
  const leaderSet = wave10ScenarioRecord(leaderScenarioId).encounterSetIds[0] as EncounterSetId | undefined;
  return WAVE10_CARDS.filter(
    (card) =>
      "specificTo" in card && card.specificTo?.kind === "competitive" && card.specificTo.encounterSetId === leaderSet,
  ).map((card) => card.id);
}

/**
 * The refusal for a modular set that is not of the scenario's own side. MC56 p. 5: "Modular sets from other products are
 * cooperative-only; in competitive mode only registration or resistance sets are legal"; p. 4: sides are not mixed.
 * Synthezoid Smackdown's sided sets join the pool locked to their side (owner decision N6, 2026-11-20).
 */
export function competitiveModularSetProblem(side: string, setId: string): string | null {
  const set = WAVE10_GAME_ENCOUNTER_SETS.find((candidate) => candidate.id === setId);
  if (!set) return `${setId} is not an encounter set`;
  if (set.side === undefined)
    return `${set.name} is not a Civil War set: only registration and resistance sets are legal in competitive mode (MC56 p. 5)`;
  if (set.side !== side) return `${set.name} is a ${set.side} set, and this scenario is ${side} (MC56 p. 4)`;
  return null;
}

const sideOf = (scenarioId: string): string | undefined => wave10ScenarioRecord(scenarioId).side;

/**
 * A competitive Civil War game's `GameSetupConfig`: team one (registration) faces the scenario team two built around
 * its leader, and the other way round. Throws for a choice the rules forbid: teams on the same side, a team of 0 or 3
 * players, a modular choice a scenario refuses.
 */
export function civilWarCompetitive(options: CivilWarCompetitiveOptions): GameSetupConfig {
  const [registration, resistance] = options.teams;
  if (sideOf(registration.leaderScenarioId) !== "registration")
    throw new Error(`the first team's leader ${registration.leaderScenarioId} is not a registration leader`);
  if (sideOf(resistance.leaderScenarioId) !== "resistance")
    throw new Error(`the second team's leader ${resistance.leaderScenarioId} is not a resistance leader`);
  for (const team of options.teams) {
    const side = sideOf(team.leaderScenarioId)!;
    for (const setId of [...(team.scenario?.modularSetIds ?? []), ...(team.scenario?.extraModularSetIds ?? [])]) {
      const problem = competitiveModularSetProblem(side, setId);
      if (problem) throw new Error(problem);
    }
  }
  for (const team of options.teams)
    if (team.players.length < 1 || team.players.length > 2)
      throw new Error(`a competitive team has 1 or 2 players, not ${team.players.length} (MC56 p. 14)`);

  /** The scenario `builder` built around its leader, for `facing`'s players. */
  const built = (builder: CivilWarCompetitiveTeam, facing: CivilWarCompetitiveTeam): GameSetupConfig =>
    wave10CompetitiveScenario(builder.leaderScenarioId, {
      seed: options.seed,
      players: facing.players,
      ...(options.difficulty ? { difficulty: options.difficulty } : {}),
      ...builder.scenario,
    });
  // Each team faces the scenario the other built (MC56 p. 14: "the teams trade scenarios").
  const facedByRegistration = built(resistance, registration);
  const facedByResistance = built(registration, resistance);
  for (const config of [facedByRegistration, facedByResistance])
    if (config.scenarioDecks?.length) throw new Error("a competitive scenario with a separate deck is not supported");

  const faces = (config: GameSetupConfig): CompetitiveScenarioSetup => ({
    villain: {
      villainCardId: config.villainCardId,
      ...(config.villainSide !== undefined ? { side: config.villainSide } : {}),
      ...(config.villainStartStageIndex !== undefined ? { startStageIndex: config.villainStartStageIndex } : {}),
      ...(config.villainLastStageIndex !== undefined ? { lastStageIndex: config.villainLastStageIndex } : {}),
      encounterDeck: config.encounterDeck,
    },
    mainSchemeCardId: config.mainSchemeCardId,
    ...(config.mainSchemeStageIndexes ? { mainSchemeStageIndexes: config.mainSchemeStageIndexes } : {}),
  });
  const team = (
    side: "registration" | "resistance",
    own: CivilWarCompetitiveTeam,
    faced: GameSetupConfig,
  ): CompetitiveTeamSetup => ({
    side,
    playerCount: own.players.length,
    faces: faces(faced),
    leaderPlayerCardIds: leaderPlayerCardIds(own.leaderScenarioId),
    ...(own.firstPlayerIndex !== undefined ? { firstPlayerIndex: own.firstPlayerIndex } : {}),
  });

  // Each build gathers its side's main scheme stages on its own card (`wave10MainSchemeCard`): the pool takes both.
  const otherScheme = facedByResistance.cards.find((card) => card.id === facedByResistance.mainSchemeCardId);
  const cards = facedByRegistration.cards.map((card) =>
    otherScheme && card.id === otherScheme.id ? otherScheme : card,
  );
  return {
    seed: options.seed,
    cards,
    villainCardId: facedByRegistration.villainCardId,
    mainSchemeCardId: facedByRegistration.mainSchemeCardId,
    encounterDeck: [],
    players: [...facedByRegistration.players, ...facedByResistance.players],
    includeIdentitySets: true,
    requireIdentitySets: true,
    requireLegalDecks: true,
    ...(facedByRegistration.difficulty ? { difficulty: facedByRegistration.difficulty } : {}),
    gameMode: "competitive",
    competitive: {
      teams: [
        team("registration", registration, facedByRegistration),
        team("resistance", resistance, facedByResistance),
      ],
    },
  };
}
