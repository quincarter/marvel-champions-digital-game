/**
 * Setup of a game with two teams: Civil War's competitive mode (docs/competitive-mode-plan.md §1.2, milestone M1).
 *
 * MC56 p. 14 (scenario rules override RRG per Golden Rule, RRG p. 4): each team builds the scenario the other team
 * will face (a leader of its own side, its main scheme deck, its encounter deck with the Standard PvP set in place of
 * the Standard set), the teams trade, "Then the normal setup rules apply". So a competitive `GameSetupConfig` carries
 * the two traded scenarios on `competitive.teams`, each on the team that **faces** it, and `createGame` builds the game
 * the same way it builds one with several villains (`GameSetupConfig.villains`): one leader with its own encounter
 * deck per team, the first team's main scheme as `GameState.mainScheme` and the second's beside it, then a game area per
 * team (`GameAreaState`) holding its players and the leader it faces, and the teams (`GameState.teams`).
 *
 * Owner decisions of 2026-11-20: each area sets up on its own, registration's first wherever one order is needed (Q4
 * A); each identity's obligation goes into the encounter deck of its player's own game area (Q16 A, MC56 FAQ p. 20);
 * teams of 1 or 2 players, the same number on each (Q14, MC56 p. 14: "1v1 or 2v2").
 */

import type { CardId } from "@mc/content";
import type { GameSetupConfig, VillainSetup } from "./setup.js";
import type { TeamSide } from "./team.js";

/** One scenario of a competitive game, as the team that built it handed it over (MC56 pp. 4-5, 14). */
export interface CompetitiveScenarioSetup {
  /**
   * The leader and its encounter deck: the leader's set, the modular sets of its side and the Standard PvP set in
   * place of the Standard set (MC56 pp. 3, 14), plus the Expert set in expert mode. Each team's identities'
   * obligations are added by setup (Q16 A), not listed here.
   */
  readonly villain: VillainSetup;
  /** The main scheme deck: one stage 1 and one stage 2 of the leader's side (MC56 p. 5), as for a cooperative game. */
  readonly mainSchemeCardId: CardId;
  readonly mainSchemeStageIndexes?: readonly number[];
}

/** One team of a competitive game (MC56 p. 14). */
export interface CompetitiveTeamSetup {
  readonly side: TeamSide;
  /**
   * How many seats the team has: the first team's are the first `playerCount` entries of `GameSetupConfig.players`,
   * the second team's the rest. 1 or 2 (Q14).
   */
  readonly playerCount: number;
  /** The scenario this team faces, which the **other** team built (MC56 p. 14: "the teams trade scenarios"). */
  readonly faces: CompetitiveScenarioSetup;
  /**
   * This team's own leader's four basic player cards (MC56 p. 14: "Each team finds the four basic player cards for
   * their chosen leader and sets them aside"), created set aside, never in a deck (p. 16: earned by defeating Choosing
   * Sides). Absent or empty: none.
   */
  readonly leaderPlayerCardIds?: readonly CardId[];
  /** Which of the team's seats holds its first player token at the start, 0 for its first seat. Default 0. */
  readonly firstPlayerIndex?: number;
}

/**
 * The two teams, the registration team first: it "always goes first each round" (MC56 p. 16), and its game area sets
 * up first (Q4 A). Its team id is `t1`, the other's `t2`; their game areas `a1` and `a2`.
 */
export interface CompetitiveSetup {
  readonly teams: readonly [CompetitiveTeamSetup, CompetitiveTeamSetup];
  /**
   * Apply MC56 p. 17's tie-breaks to a tie, in printed order, and report the deciding one (Q9 C per owner decision
   * 2026-11-20: a lobby option, on by default). `false`: a tie is reported as a tie. Default true.
   */
  readonly tieBreaks?: boolean;
}

/** Why a competitive config is malformed, or null. Read before any card is created. */
export function competitiveSetupFault(config: GameSetupConfig): string | null {
  const competitive = config.competitive;
  if (!competitive) return "competitive mode needs the two teams' scenarios (`competitive`)";
  if (competitive.teams.length !== 2) return "a competitive game has exactly two teams";
  const [first, second] = competitive.teams;
  if (first.side !== "registration" || second.side !== "resistance")
    return "the registration team is listed first and the resistance team second: registration goes first (MC56 p. 16)";
  for (const [index, team] of competitive.teams.entries()) {
    if (!Number.isInteger(team.playerCount) || team.playerCount < 1 || team.playerCount > 2)
      return `team ${index + 1} has ${team.playerCount} players; a competitive team has 1 or 2 (MC56 p. 14)`;
    const firstIndex = team.firstPlayerIndex ?? 0;
    if (!Number.isInteger(firstIndex) || firstIndex < 0 || firstIndex >= team.playerCount)
      return `team ${index + 1} has no seat ${firstIndex} for its first player`;
  }
  // MC56 p. 14: "This mode can be played either 1v1 (one registration player against one resistance player) or 2v2
  // (two registration players against two resistance players)." No 1v2 or 2v1.
  if (first.playerCount !== second.playerCount)
    return `the teams have ${first.playerCount} and ${second.playerCount} players; competitive mode is 1v1 or 2v2 (MC56 p. 14)`;
  if (first.playerCount + second.playerCount !== config.players.length)
    return `the teams have ${first.playerCount + second.playerCount} seats and the table ${config.players.length}`;
  const conflicts: readonly [keyof GameSetupConfig, string][] = [
    ["villains", "each team's leader comes from its scenario"],
    ["sharedEncounterDeck", "each leader has its own encounter deck"],
    ["villainChoice", "each team chooses its own leader"],
    ["randomStartingVillain", "each team chooses its own leader"],
    ["setAsideVillainCardIds", "each scenario has one leader"],
    ["villainsStartSetAside", "each leader starts in play"],
    ["mainSchemeChoice", "each team faces one main scheme deck"],
    ["mainSchemeStageIndexes", "each scenario names its own main scheme stages"],
    ["campaign", "competitive mode is not played as a campaign"],
    ["pod", "competitive mode is not an Epic Multiplayer pod"],
    ["separateGameAreas", "the teams' game areas are made at setup"],
    ["firstPlayerIndex", "each team names its own first player"],
  ];
  for (const [field, reason] of conflicts)
    if (config[field] !== undefined) return `competitive mode does not take ${field}: ${reason}`;
  if (config.encounterDeck.length > 0) return "competitive mode takes each encounter deck from its scenario";
  return null;
}

/**
 * The config `createGame` builds a competitive game from: the two leaders as `villains` in team order, the first
 * team's main scheme as the game's. The second team's main scheme, the teams and their areas are made from
 * `competitive` itself.
 */
export function competitiveAsVillainsConfig(config: GameSetupConfig): GameSetupConfig {
  const [first, second] = config.competitive!.teams;
  return {
    ...config,
    villainCardId: first.faces.villain.villainCardId,
    villains: [first.faces.villain, second.faces.villain],
    mainSchemeCardId: first.faces.mainSchemeCardId,
    ...(first.faces.mainSchemeStageIndexes ? { mainSchemeStageIndexes: first.faces.mainSchemeStageIndexes } : {}),
  };
}

/** The index of the team (0 or 1) that seat `seatIndex` is on. */
export function teamIndexOfSeat(competitive: CompetitiveSetup, seatIndex: number): number {
  return seatIndex < competitive.teams[0].playerCount ? 0 : 1;
}

/** The seat index of team `teamIndex`'s first player. */
export function teamFirstSeat(competitive: CompetitiveSetup, teamIndex: number): number {
  const offset = teamIndex === 0 ? 0 : competitive.teams[0].playerCount;
  return offset + (competitive.teams[teamIndex]?.firstPlayerIndex ?? 0);
}
