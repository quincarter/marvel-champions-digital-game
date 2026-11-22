/**
 * The Epic Multiplayer, Civil War Competitive and Watching and hosting achievements (#909,
 * docs/multiplayer-achievements-plan.md, families `epic`, `competitive` and `hosting`). Definitions use
 * `multiplayerDef` from `room-seats.ts`; `achievements.ts` concatenates this list into `ACHIEVEMENTS`.
 *
 * Every summary counter (`boosts`, `endState`, `competitive`) is optional: an older save without one earns nothing
 * from it. Competitive games reach only the competitive achievements, through `competitiveRows`; a game this device
 * played with seats on both teams (hot seat) earns none of them (the owner's provisional call).
 */
import {
  multiplayerDef,
  progressCount,
  type GameRow,
  type MultiplayerDef,
  type MultiplayerFacts,
} from "./room-seats.js";

/** Mangog and the door card that a remote basic power can defeat or clear (`tt`). */
const MANGOG_ID = "55041";
const DOOR_ID = "55046";
/** Captain America's leader card (`cw`): the card "No, You Move!" redirects an attack onto. */
const CAPTAIN_AMERICA_LEADER_ID = "56137";
const COMPETITIVE_LEADERS = ["iron-man", "captain-marvel", "captain-america", "spider-woman"] as const;
const VETERAN_WINS = 5;
const HOST_GAMES = 10;
const THREE_TABLES = 3;

interface EpicConfig {
  readonly groupId?: string;
  readonly groupsInGame?: number;
}
interface CompetitiveConfig {
  readonly teams?: readonly { readonly leaderScenarioId: string; readonly playerCount: number }[];
}

const epicOf = (row: GameRow): EpicConfig | undefined => (row.config as { readonly epic?: EpicConfig }).epic;
const isEpicRow = (row: GameRow): boolean => epicOf(row) !== undefined || row.roomPlay?.mode === "epic";
const epicRows = (facts: MultiplayerFacts): readonly GameRow[] => facts.rows.filter(isEpicRow);
const anyEpic = (facts: MultiplayerFacts, test: (row: GameRow) => boolean): number =>
  epicRows(facts).some(test) ? 1 : 0;

const remoteDefeatBy = (row: GameRow, cardId: string, power: string): boolean => {
  const counters = row.summary?.boosts;
  if (!counters) return false;
  return row.mySeats.some((seat) =>
    (counters.seats[seat]?.remoteDefeats ?? []).some((d) => d.cardId === cardId && d.power === power),
  );
};

/** The result of the one team this device played in a competitive game. */
interface MyTeamGame {
  readonly row: GameRow;
  readonly teamId: string;
  readonly side: "registration" | "resistance" | null;
  readonly won: boolean;
  readonly conditions: readonly string[];
  readonly tieBroken: boolean;
  /** The leader the team fields (`iron-man`..), when the saved config names it. */
  readonly leader: string | null;
}

/** Null without a summary, and when this device held both teams' seats (hot seat) or neither. */
function myTeamGame(row: GameRow): MyTeamGame | null {
  const competitive = row.summary?.competitive;
  if (!competitive) return null;
  const mine = competitive.teams.filter((team) => team.playerIds.some((id) => row.mySeats.some((seat) => seat === id)));
  if (mine.length !== 1) return null;
  const team = mine[0]!;
  // Teams follow one another in `config.players`, registration first: the team's first seat names its leader.
  const teams = (row.config as { readonly competitive?: CompetitiveConfig }).competitive?.teams ?? [];
  const firstSeat = Math.min(...team.playerIds.map((id) => Number(id.slice(1)) - 1));
  let start = 0;
  let leaderScenario: string | undefined;
  for (const t of teams) {
    if (firstSeat >= start && firstSeat < start + t.playerCount) leaderScenario = t.leaderScenarioId;
    start += t.playerCount;
  }
  return {
    row,
    teamId: team.teamId,
    side: team.side,
    won: team.result === "win",
    conditions: team.conditions,
    tieBroken: competitive.tieBreak?.applied === true && competitive.tieBreak.decidedBy !== null,
    leader: leaderScenario?.replace(/^(registration|resistance)-/, "") ?? null,
  };
}

const myTeamGames = (facts: MultiplayerFacts): readonly MyTeamGame[] =>
  facts.competitiveRows.flatMap((row) => {
    const game = myTeamGame(row);
    return game ? [game] : [];
  });

const isStandardOrEpicRoom = (row: GameRow): boolean =>
  row.roomPlay?.mode === "standard" || row.roomPlay?.mode === "epic";

const flag = (on: boolean) => progressCount(on ? 1 : 0, 1);

export const EPIC_COMPETITIVE_ACHIEVEMENTS: readonly MultiplayerDef[] = [
  // Epic Multiplayer
  multiplayerDef({
    id: "epic-finished",
    name: "Pod Person",
    description: "Finish an Epic Multiplayer game.",
    family: "epic",
    points: 50,
    measure: (facts) => flag(epicRows(facts).length > 0),
  }),
  multiplayerDef({
    id: "epic-loki-final-blow",
    name: "Shatter the Illusion",
    description: "Be the table that lands the final blow on the shared Loki in an Epic Multiplayer game.",
    family: "epic",
    points: 150,
    measure: (facts) =>
      flag(
        anyEpic(facts, (row) => {
          const end = row.summary?.endState;
          return end?.groupId != null && end.lokiDefeatedByGroup === end.groupId;
        }) === 1,
      ),
  }),
  multiplayerDef({
    id: "epic-mangog-remote",
    name: "Mangog Hunter",
    description: "Defeat Mangog with a remote attack from another table in an Epic Multiplayer game.",
    family: "epic",
    points: 100,
    measure: (facts) => flag(anyEpic(facts, (row) => remoteDefeatBy(row, MANGOG_ID, "attack")) === 1),
  }),
  multiplayerDef({
    id: "epic-door-remote",
    name: "Door Stop",
    description: "Clear a door with a remote thwart from another table in an Epic Multiplayer game.",
    family: "epic",
    points: 100,
    measure: (facts) => flag(anyEpic(facts, (row) => remoteDefeatBy(row, DOOR_ID, "thwart")) === 1),
  }),
  multiplayerDef({
    id: "epic-three-tables",
    name: "Tables Turned",
    description: "Win an Epic Multiplayer game with three or more tables in the pod.",
    family: "epic",
    points: 150,
    measure: (facts) =>
      flag(
        anyEpic(
          facts,
          (row) => row.won && (epicOf(row)?.groupsInGame ?? row.roomPlay?.epic?.tables ?? 0) >= THREE_TABLES,
        ) === 1,
      ),
  }),
  // Civil War Competitive
  multiplayerDef({
    id: "competitive-both-sides",
    name: "Pick a Side",
    description: "Play a Civil War Competitive game on the Registration side and one on the Resistance side.",
    family: "competitive",
    points: 50,
    showProgress: true,
    measure: (facts) => progressCount(new Set(myTeamGames(facts).flatMap((g) => (g.side ? [g.side] : []))).size, 2),
  }),
  multiplayerDef({
    id: "competitive-leader-down",
    name: "Leader Down",
    description: "Defeat the enemy leader in a Civil War Competitive game.",
    family: "competitive",
    points: 100,
    measure: (facts) => flag(myTeamGames(facts).some((g) => g.conditions.includes("enemyLeaderDefeated"))),
  }),
  multiplayerDef({
    id: "competitive-tie-break",
    name: "Tie-Breaker",
    description: "Win a Civil War Competitive game that the tie-break decided.",
    family: "competitive",
    points: 100,
    measure: (facts) => flag(myTeamGames(facts).some((g) => g.won && g.tieBroken)),
  }),
  multiplayerDef({
    id: "competitive-no-you-move",
    name: "No, You Move!",
    description:
      "Have the enemy leader's attack on your team moved onto Captain America in a Civil War Competitive game.",
    family: "competitive",
    points: 50,
    measure: (facts) =>
      flag(
        myTeamGames(facts).some((g) =>
          (g.row.summary?.boosts?.leaderRedirects[g.teamId] ?? []).includes(CAPTAIN_AMERICA_LEADER_ID),
        ),
      ),
  }),
  multiplayerDef({
    id: "competitive-veteran",
    name: "Civil War Veteran",
    description: `Win ${VETERAN_WINS} Civil War Competitive games with each of the four leaders.`,
    family: "competitive",
    points: 250,
    showProgress: true,
    measure: (facts) => {
      const wins = myTeamGames(facts).filter((g) => g.won);
      const current = COMPETITIVE_LEADERS.reduce(
        (sum, leader) => sum + Math.min(VETERAN_WINS, wins.filter((g) => g.leader === leader).length),
        0,
      );
      return progressCount(current, COMPETITIVE_LEADERS.length * VETERAN_WINS);
    },
  }),
  // Watching and hosting
  multiplayerDef({
    id: "watch-to-end",
    name: "Front Row Seat",
    description: "Watch a friend's live game through to the end.",
    family: "hosting",
    points: 25,
    measure: (facts) => progressCount(facts.watched, 1),
  }),
  multiplayerDef({
    id: "host-10",
    name: "Game Night Host",
    description: `Host ${HOST_GAMES} finished online games.`,
    family: "hosting",
    points: 100,
    showProgress: true,
    measure: (facts) => progressCount(facts.hostedRows.filter(isStandardOrEpicRoom).length, HOST_GAMES),
  }),
];
