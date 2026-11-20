/**
 * How a competitive game ends (docs/competitive-mode-plan.md §1.7, milestone M5).
 *
 * Sources: MC56 pp. 16-17, 20 (scenario rules override RRG per Golden Rule, RRG p. 4): the three ways to win, "the game
 * does not end until both sides have played an equal number of phases", both lose, a tie, the five tie-breaks, and a
 * leader defeated in its opponents' hero phase staying in play. Q7, Q8 settled by the rules expert 2026-11-20; Q9 C,
 * Q10 A, N3, N4 per owner decision 2026-11-20.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { competitiveOutcome, type CompetitiveOutcome } from "./competitive-outcome.js";
import { applyCommand, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type PlayerId } from "./ids.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { playerCardIntoPlay } from "./testing/wave3.js";
import { DEFAULT_DECK, defaultPick, giveCard } from "./testing/scenario.js";
import { competitiveConfig, competitiveGame, TEAM_ONE, TEAM_TWO } from "./testing/team.js";
import { createGame } from "./setup.js";
import { settle } from "./testing/scenario.js";

const [P1, P2] = ["p1", "p2"].map(playerId) as [PlayerId, PlayerId];

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const ENEMY_LEADER: TargetRef = { kind: "leader", of: "enemy" };
const YOUR_LEADER: TargetRef = { kind: "leader", of: "yours" };
/** "Defeat the enemy leader." */
const DEFEAT_ENEMY_LEADER = action("defeat-enemy-leader", [{ kind: "defeat", target: ENEMY_LEADER }]);
/** "Complete the main scheme" (yours, the one your enemy leader advances). */
const COMPLETE_OWN = action("complete-own", [{ kind: "completeMainScheme", scheme: { kind: "mainScheme" } }]);
/** "Complete your leader's main scheme." */
const COMPLETE_LEADERS = action("complete-leaders", [
  { kind: "completeMainScheme", scheme: { kind: "mainScheme", of: "yourLeader" } },
]);
/** "Deal 99 damage to your identity." */
const SELF_DEFEAT = action("self-defeat", [
  {
    kind: "dealDamage",
    target: { kind: "identityOf", player: { kind: "controller" } },
    amount: { kind: "const", value: 99 },
  },
]);
/** "Your leader attacks the enemy leader." */
const LEADER_ATTACK = action("leader-attack", [
  { kind: "enemyAttacksEnemy", attacker: YOUR_LEADER, target: ENEMY_LEADER },
]);

/** "Forced Response: After the villain phase begins, defeat the enemy leader." (on a support) */
const AT_VILLAIN_PHASE = stubAbility("villain-phase-defeat.response", {
  trigger: { kind: "response", forced: true, on: { on: "phaseBeginning", eventIs: { phase: "villain" } } },
  effects: [{ kind: "defeat", target: ENEMY_LEADER }],
});
const AT_VILLAIN_PHASE_CARD = stubSupport({ id: "villain-phase-defeat", cost: 0, abilities: [AT_VILLAIN_PHASE.ref] });

const ACTIONS = [DEFEAT_ENEMY_LEADER, COMPLETE_OWN, COMPLETE_LEADERS, SELF_DEFEAT, LEADER_ATTACK];
const deps: EngineDeps = depsOf(...ACTIONS.map((a) => a.ability), AT_VILLAIN_PHASE);
const CARDS = [...ACTIONS.map((a) => a.card), AT_VILLAIN_PHASE_CARD];
const options = { deps, extraCards: CARDS, deck: [...DEFAULT_DECK, ...CARDS.flatMap((c) => [c.id, c.id, c.id])] };
const game = (): GameState => competitiveGame(options);
const gameWithoutTieBreaks = (): GameState => {
  const config = competitiveConfig(options);
  const created = createGame({ ...config, competitive: { ...config.competitive!, tieBreaks: false } }, deps);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, defaultPick, deps);
};

interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

function play(run: Run, player: PlayerId, card: string): Run {
  const given = giveCard(run.state, player, card);
  const result = applyCommand(
    given.state,
    { type: "playCard", playerId: player, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return settled({ state: result.state, events: [...run.events, ...result.events] });
}

function settled(run: Run): Run {
  let session: GameSession = startSession(run.state);
  const events = [...run.events];
  for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
    if (guard > 200) throw new Error("did not settle");
    const choice = session.state.pendingChoice;
    const result = sessionApply(
      session,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: defaultPick(session.state),
      },
      deps,
    );
    if (!result.ok) throw new Error(result.error.message);
    session = result.session;
    events.push(...result.events);
  }
  return { state: session.state, events };
}

/** Ends the active player's turn (answering choices by default). */
function endTurn(run: Run): Run {
  const step = run.state.step as { activePlayerId?: PlayerId };
  const result = applyCommand(run.state, { type: "endTurn", playerId: step.activePlayerId! }, deps);
  if (!result.ok) throw new Error(result.error.message);
  return settled({ state: result.state, events: [...run.events, ...result.events] });
}

const start = (state: GameState = game()): Run => ({ state, events: [] });
const outcomeOf = (run: Run) => run.state.outcome as CompetitiveOutcome | null;
const resultOf = (run: Run) => Object.fromEntries((outcomeOf(run)?.teams ?? []).map((t) => [t.teamId, t.result]));

describe("defeating the enemy leader first (MC56 p. 17)", () => {
  const defeated = play(start(), P1, DEFEAT_ENEMY_LEADER.card.id);
  const [leaderOne] = defeated.state.villains;

  it("records the registration team's win condition and closes after the resistance team's hero phase", () => {
    expect(defeated.state.outcome).toBeNull();
    expect(defeated.state.competitive?.end).toMatchObject({
      triggers: [{ teamId: TEAM_ONE, condition: "enemyLeaderDefeated", phase: "player" }],
      closesAfter: { teamId: TEAM_TWO, phase: "player", round: 1 },
    });
  });

  it("leaves the leader defeated but in play, as its opponents' hero phase is under way (Q10 A)", () => {
    expect(leaderOne!.defeated).toBe(true);
    expect(leaderOne!.defeatedInPlay).toBe(true);
    expect(cardsInPlay(defeated.state)).toContain(leaderOne!.instanceId);
  });

  it("the defeated leader initiates no attack, even when a card tells it to (Q10 A)", () => {
    const handed = endTurn(defeated);
    const attacked = play(handed, P2, LEADER_ATTACK.card.id);
    expect(
      attacked.events.some((e) => e.type === "enemyAttackedEnemy" && e.attackerInstanceId === leaderOne!.instanceId),
    ).toBe(false);
  });

  it("plays on through the resistance team's hero phase, then the registration team wins", () => {
    const handed = endTurn(defeated);
    expect(handed.state.outcome).toBeNull();
    expect(handed.state.activeTeamId).toBe(TEAM_TWO);
    const done = endTurn(handed);
    expect(outcomeOf(done)).toMatchObject({ result: "teams", reason: "competitiveEnded", decision: "win" });
    expect(resultOf(done)).toEqual({ [TEAM_ONE]: "win", [TEAM_TWO]: "loss" });
    // It ended before the registration team's villain phase.
    expect(done.events.some((e) => e.type === "activeTeamChanged" && e.phase === "villain")).toBe(false);
  });
});

describe("a result in the resistance team's phase ends that phase's end (equal phases)", () => {
  it("closes after the resistance team's current hero phase", () => {
    const handed = endTurn(start());
    const defeated = play(handed, P2, DEFEAT_ENEMY_LEADER.card.id);
    expect(defeated.state.competitive?.end?.closesAfter).toEqual({ teamId: TEAM_TWO, phase: "player", round: 1 });
    const done = endTurn(defeated);
    expect(resultOf(done)).toEqual({ [TEAM_ONE]: "loss", [TEAM_TWO]: "win" });
  });
});

describe("a leader defeated in a villain phase (MC56 p. 17)", () => {
  it("leaves play at once, and the game closes after the resistance team's villain phase", () => {
    const placed = playerCardIntoPlay(game(), AT_VILLAIN_PHASE_CARD.id, P1).state;
    const handed = endTurn(start(placed));
    const done = endTurn(handed);
    const [leaderOne] = done.state.villains;
    expect(leaderOne!.defeated).toBe(true);
    expect(leaderOne!.defeatedInPlay).toBeUndefined();
    expect(cardsInPlay(done.state)).not.toContain(leaderOne!.instanceId);
    const recorded = done.events.find((e) => e.type === "teamResultRecorded");
    expect(recorded).toMatchObject({ closesAfter: { teamId: TEAM_TWO, phase: "villain", round: 1 } });
    expect(resultOf(done)).toEqual({ [TEAM_ONE]: "win", [TEAM_TWO]: "loss" });
    // The resistance team played its villain phase first.
    const teamTwoVillain = done.events.findIndex(
      (e) => e.type === "activeTeamChanged" && e.teamId === TEAM_TWO && e.phase === "villain",
    );
    expect(teamTwoVillain).toBeGreaterThan(done.events.indexOf(recorded!));
  });
});

describe("both teams defeat their enemy leaders: a tie (MC56 p. 17), decided by the tie-breaks (Q9 C)", () => {
  const bothDefeated = (state: GameState) => {
    const one = play(start(state), P1, DEFEAT_ENEMY_LEADER.card.id);
    const two = play(endTurn(one), P2, DEFEAT_ENEMY_LEADER.card.id);
    return endTurn(two);
  };

  it("tie-breaks on: the first measure that separates the teams decides, and is reported", () => {
    const done = bothDefeated(game());
    const outcome = outcomeOf(done)!;
    // Neither scheme advanced and no minion or side scheme is in play; registration's main scheme holds less threat
    // (1 per player against 2), so measure 3 decides.
    expect(outcome.decision).toBe("win");
    expect(outcome.tieBreak).toMatchObject({ applied: true, decidedBy: "mainSchemeThreat" });
    expect(outcome.tieBreak?.measures?.map((m) => m.measure)).toEqual([
      "mainSchemeAdvanced",
      "minionsAndSideSchemes",
      "mainSchemeThreat",
    ]);
    expect(resultOf(done)).toEqual({ [TEAM_ONE]: "win", [TEAM_TWO]: "loss" });
    expect(outcome.teams.map((t) => t.conditions)).toEqual([["enemyLeaderDefeated"], ["enemyLeaderDefeated"]]);
  });

  it("tie-breaks off: reported as a tie", () => {
    const done = bothDefeated(gameWithoutTieBreaks());
    expect(outcomeOf(done)).toMatchObject({ decision: "tie", tieBreak: { applied: false } });
    expect(resultOf(done)).toEqual({ [TEAM_ONE]: "tie", [TEAM_TWO]: "tie" });
  });
});

describe("the final main scheme stage completed (MC56 p. 17)", () => {
  it("is the loss of the team in its area and the win condition of the other; stage 1 only advances", () => {
    const once = play(start(), P1, COMPLETE_LEADERS.card.id);
    expect(once.state.competitive?.end).toBeUndefined();
    const twice = play(once, P1, COMPLETE_LEADERS.card.id);
    expect(twice.state.outcome).toBeNull();
    expect(twice.state.competitive?.end?.triggers).toMatchObject([
      { teamId: TEAM_ONE, condition: "leaderSchemeCompleted" },
    ]);
    const done = endTurn(endTurn(twice));
    expect(resultOf(done)).toEqual({ [TEAM_ONE]: "win", [TEAM_TWO]: "loss" });
  });

  it("both teams lose in the window: both lose", () => {
    let run = play(start(), P1, COMPLETE_OWN.card.id);
    run = play(run, P1, COMPLETE_OWN.card.id);
    run = play(run, P1, COMPLETE_LEADERS.card.id);
    run = play(run, P1, COMPLETE_LEADERS.card.id);
    const done = endTurn(endTurn(run));
    expect(outcomeOf(done)?.decision).toBe("bothLose");
    expect(resultOf(done)).toEqual({ [TEAM_ONE]: "loss", [TEAM_TWO]: "loss" });
  });
});

describe("different win conditions in the window are a tie (N4)", () => {
  it("the registration team defeats its enemy leader while its own main scheme completes", () => {
    let run = play(start(gameWithoutTieBreaks()), P1, DEFEAT_ENEMY_LEADER.card.id);
    run = play(run, P1, COMPLETE_OWN.card.id);
    run = play(run, P1, COMPLETE_OWN.card.id);
    const done = endTurn(endTurn(run));
    expect(outcomeOf(done)?.decision).toBe("tie");
    expect(outcomeOf(done)?.teams.map((t) => t.conditions)).toEqual([
      ["enemyLeaderDefeated"],
      ["leaderSchemeCompleted"],
    ]);
  });
});

describe("every identity of a team defeated (1v1 elimination; Q8 A, any cause)", () => {
  it("is the other team's win condition; the game ends after the resistance team's hero phase", () => {
    const run = play(start(), P1, SELF_DEFEAT.card.id);
    expect(run.state.players.find((p) => p.playerId === P1)?.eliminated).toBe(true);
    expect(run.state.outcome).toBeNull();
    const handed = run.state.activeTeamId === TEAM_TWO ? run : endTurn(run);
    const done = handed.state.outcome ? handed : endTurn(handed);
    expect(resultOf(done)).toEqual({ [TEAM_ONE]: "loss", [TEAM_TWO]: "win" });
    expect(outcomeOf(done)?.teams[1]?.conditions).toEqual(["opponentsDefeated"]);
  });
});

describe("the outcome of a state read directly", () => {
  it("a game with no result in yet has no winner to name", () => {
    expect(competitiveOutcome(game()).teams.map((t) => t.conditions)).toEqual([[], []]);
  });
});
