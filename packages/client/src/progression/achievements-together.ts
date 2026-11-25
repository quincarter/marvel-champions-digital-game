/**
 * The "Playing together" achievements (#909, docs/multiplayer-achievements-plan.md, family `together`). Definitions use
 * `multiplayerDef` from `room-seats.ts`; `achievements.ts` concatenates this list into `ACHIEVEMENTS`.
 *
 * Room-only ones read `roomPlay`. The rest count in a room game and in a game one person plays at several seats
 * ("another player" is another seat), from this device's seats' counters (`GameSummary.together`, absent on an older
 * summary). "In one game" means one row. The two funny ones are family `funny` with a `rewardPackId`, as `achievements.test.ts` requires of 0-point rows.
 */
import type { TogetherCounter } from "../engine/record-together.js";
import {
  multiplayerDef,
  progressCount,
  type GameRow,
  type MultiplayerDef,
  type MultiplayerFacts,
} from "./room-seats.js";

const roomRows = (f: MultiplayerFacts): readonly GameRow[] => f.rows.filter((row) => row.roomPlay !== undefined);

const once = (earned: boolean) => progressCount(earned ? 1 : 0, 1);

/** A counter summed over this device's seats in one game; 0 when the summary carries none. */
const mine = (row: GameRow, counter: TogetherCounter): number =>
  row.mySeats.reduce((sum, seat) => sum + (row.summary?.together?.[seat]?.[counter] ?? 0), 0);

/** One game where this device's seats reached `target` of a counter between them. */
const inOneGame = (counter: TogetherCounter, target: number) => (f: MultiplayerFacts) =>
  once(f.rows.some((row) => mine(row, counter) >= target));

const BEST_FRIEND_WINS = 10;
const STRICT_WINS = 5;
const CHAT_SENT = 50;

export const TOGETHER_ACHIEVEMENTS: readonly MultiplayerDef[] = [
  multiplayerDef({
    id: "room-four-players",
    name: "Assemble!",
    description: "Win a game in a room with four players.",
    family: "together",
    points: 100,
    measure: (f) => once(roomRows(f).some((row) => row.won && row.config.players.length === 4)),
  }),
  multiplayerDef({
    id: "room-tag-team-10",
    name: "Tag Team",
    description: "Win 10 room games with the same friend.",
    family: "together",
    points: 150,
    showProgress: true,
    measure: (f) => {
      const wins = new Map<string, number>();
      for (const row of roomRows(f)) {
        if (!row.won) continue;
        for (const friend of new Set(row.roomPlay?.friends ?? [])) wins.set(friend, (wins.get(friend) ?? 0) + 1);
      }
      return progressCount(Math.max(0, ...wins.values()), BEST_FRIEND_WINS);
    },
  }),
  multiplayerDef({
    id: "room-takeover-away",
    name: "No One Left Behind",
    description: "Win a room game after taking over the seat of a player who stepped away.",
    family: "together",
    points: 100,
    measure: (f) => once(roomRows(f).some((row) => row.won && row.roomPlay?.tookOver.some((t) => t.reason === "away"))),
  }),
  multiplayerDef({
    id: "room-takeover-left",
    name: "I Got This",
    description: "Win a room game after taking over the seat of a player who left the room.",
    family: "together",
    points: 100,
    measure: (f) => once(roomRows(f).some((row) => row.won && row.roomPlay?.tookOver.some((t) => t.reason === "left"))),
  }),
  multiplayerDef({
    id: "room-chat-50",
    name: "Talk It Out",
    description: "Send 50 chat messages in room games.",
    family: "together",
    points: 50,
    showProgress: true,
    measure: (f) =>
      progressCount(
        roomRows(f).reduce((sum, row) => sum + (row.roomPlay?.chatSent ?? 0), 0),
        CHAT_SENT,
      ),
  }),
  multiplayerDef({
    id: "room-strict-5",
    name: "Strict Rules Club",
    description: "Win 5 room games played with Strict rules.",
    family: "together",
    points: 100,
    showProgress: true,
    measure: (f) => progressCount(roomRows(f).filter((row) => row.won && row.roomPlay?.strict).length, STRICT_WINS),
  }),
  multiplayerDef({
    id: "together-avenge-me",
    name: "Avenge Me!",
    description: "Win a game after one of your heroes was defeated.",
    family: "together",
    points: 50,
    measure: (f) =>
      once(f.rows.some((row) => row.won && row.mySeatIndexes.some((i) => row.summary?.seats?.[i]?.defeated === true))),
  }),
  multiplayerDef({
    id: "together-upgrade-given",
    name: "It's Dangerous to Go Alone",
    description: "Play an upgrade onto another player's hero.",
    family: "together",
    points: 50,
    measure: inOneGame("upgradesGiven", 1),
  }),
  multiplayerDef({
    id: "together-oops",
    name: "Oops, That One's Yours",
    description: "Put a minion into play that then attacks another player's hero.",
    family: "funny",
    rewardPackId: "pack-oops-thats-yours",
    points: 0,
    measure: inOneGame("oopsMinions", 1),
  }),
  multiplayerDef({
    id: "together-get-behind-me",
    name: "Get Behind Me!",
    description: "Cancel a treachery that was revealed for another player.",
    family: "together",
    points: 50,
    measure: inOneGame("cancelledForOthers", 1),
  }),
  multiplayerDef({
    id: "together-human-shield",
    name: "Human Shield",
    description: "Defend another player three times in one game.",
    family: "together",
    points: 50,
    measure: inOneGame("defendedForOthers", 3),
  }),
  multiplayerDef({
    id: "together-combat-medic",
    name: "Combat Medic",
    description: "Heal 6 damage from other players' heroes in one game.",
    family: "together",
    points: 50,
    measure: inOneGame("healedOthers", 6),
  }),
  multiplayerDef({
    id: "together-alliance-paid",
    name: "Assemble the Wallets",
    description: "Play a card that two or more players paid for together.",
    family: "together",
    points: 50,
    measure: inOneGame("multiPayerPlays", 1),
  }),
  multiplayerDef({
    id: "together-kill-steal",
    name: "Kill Steal",
    description: "Defeat a minion that is engaged with another player.",
    family: "together",
    points: 25,
    measure: inOneGame("killSteals", 1),
  }),
  multiplayerDef({
    id: "together-care-package",
    name: "Care Package",
    description: "Make other players draw 5 cards in one game.",
    family: "together",
    points: 50,
    measure: inOneGame("drewForOthers", 5),
  }),
  multiplayerDef({
    id: "together-sticky-fingers",
    name: "Sticky Fingers",
    description: "Take a card from another player's deck or discard pile.",
    family: "together",
    points: 50,
    measure: inOneGame("takenFromOthers", 1),
  }),
  multiplayerDef({
    id: "together-friendly-fire",
    name: "Friendly Fire",
    description: "Defeat a side scheme whose damage lands on a friend's hero who was already low.",
    family: "funny",
    rewardPackId: "pack-friendly-fire",
    points: 0,
    measure: inOneGame("friendlyFire", 1),
  }),
];
