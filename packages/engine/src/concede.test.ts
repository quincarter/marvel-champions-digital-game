/**
 * Conceding.
 *
 * There is **no RRG rule for this**: the rules reference has no concede entry, so this is a digital-implementation
 * affordance rather than a rule, and the tests below fix the decisions rather than cite a page. The two rules-adjacent
 * facts that *are* cited: an eliminated player is out of the game (RRG 1.8 "Player Elimination", p. 33), and a game
 * that has ended has ended (p. 20 "Game End" / the outcome guard in `applyCommand`).
 */

import { flat } from "@mc/content";
import type { Command } from "./commands.js";
import { applyCommand, replay, sessionApply, startSession } from "./engine.js";
import { playerId } from "./ids.js";
import { stubMainScheme, stubVillain } from "./testing/fixtures.js";
import { newGame, run, settleUntil } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const concede = (player = p1): Command => ({ type: "concede", playerId: player });
const endTurn = (player = p1): Command => ({ type: "endTurn", playerId: player });
const toHero = (player = p1): Command => ({ type: "changeForm", playerId: player });

const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(200), atk: 2, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(200), acceleration: flat(0) }],
});
const game = (players = 1) => newGame({ players, villain: VILLAIN, mainScheme: SCHEME });

test("conceding ends the game for the whole table, as its own outcome kind", () => {
  const state = game();
  const result = applyCommand(state, concede());
  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.state.outcome).toEqual({ result: "conceded", reason: "playerConceded", byPlayerId: p1 });
  expect(result.state.step).toEqual({ phase: "gameOver", kind: "gameOver" });
  expect(result.state.pendingChoice).toBeNull();
  expect(result.state.stack).toEqual([]);
  expect(result.events.some((event) => event.type === "gameEnded")).toBe(true);
});

test("a concession is not a loss: nothing reads it as one by accident", () => {
  const conceded = applyCommand(game(), concede());
  expect(conceded.ok && conceded.state.outcome?.result).toBe("conceded");
  expect(conceded.ok && conceded.state.outcome?.result).not.toBe("loss");
  expect(conceded.ok && conceded.state.outcome?.result).not.toBe("win");
});

test("any seated player may concede, not only the active one", () => {
  const twoSeats = game(2);
  expect(twoSeats.step).toMatchObject({ phase: "player", kind: "turn", activePlayerId: p1 });

  const byOther = applyCommand(twoSeats, concede(p2));
  expect(byOther.ok).toBe(true);
  expect(byOther.ok && byOther.state.outcome).toEqual({ result: "conceded", reason: "playerConceded", byPlayerId: p2 });
});

test("a player who is not at the table cannot concede", () => {
  const result = applyCommand(game(), concede(playerId("p9")));
  expect(result.ok).toBe(false);
  expect(!result.ok && result.error.code).toBe("unknown_player");
});

test("an eliminated player has nothing left to concede", () => {
  // RRG 1.8 "Player Elimination" (p. 33): an eliminated player is out of the game.
  const start = game(2);
  const eliminated = {
    ...start,
    players: start.players.map((player) => (player.playerId === p2 ? { ...player, eliminated: true } : player)),
  };

  const result = applyCommand(eliminated, concede(p2));
  expect(result.ok).toBe(false);
  expect(!result.ok && result.error.code).toBe("not_active_player");
  // The other seat still can.
  expect(applyCommand(eliminated, concede(p1)).ok).toBe(true);
});

test("conceding works while a choice is open — that is when a player most wants to", () => {
  const atDefense = settleUntil(run(game(), toHero(), endTurn()), "declareDefender");
  expect(atDefense.pendingChoice?.prompt.kind).toBe("declareDefender");

  // Every other command is still refused while a choice is pending.
  expect(applyCommand(atDefense, endTurn()).ok).toBe(false);
  const result = applyCommand(atDefense, concede());
  expect(result.ok).toBe(true);
  expect(result.ok && result.state.outcome?.result).toBe("conceded");
});

test("a second concede is refused, like anything else after the game has ended", () => {
  const conceded = applyCommand(game(), concede());
  expect(conceded.ok).toBe(true);
  if (!conceded.ok) return;

  const again = applyCommand(conceded.state, concede());
  expect(again.ok).toBe(false);
  expect(!again.ok && again.error.code).toBe("game_over");
});

test("a conceded log replays to the same conceded outcome", () => {
  const session = sessionApply(startSession(run(game(), toHero())), concede());
  expect(session.ok).toBe(true);
  if (!session.ok) return;

  const replayed = replay(session.session.log);
  expect(replayed.ok).toBe(true);
  if (!replayed.ok) return;
  expect(replayed.state).toEqual(session.session.state);
  expect(replayed.state.outcome).toEqual({ result: "conceded", reason: "playerConceded", byPlayerId: p1 });
});
