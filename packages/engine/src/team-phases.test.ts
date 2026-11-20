/**
 * The team-scoped phase machine of a game with two teams (docs/competitive-mode-plan.md §1.4, §3.7, milestone M2).
 *
 * Sources: MC56 p. 16 and the p. 20 quick reference (scenario rules override RRG per Golden Rule, RRG p. 4): the
 * registration team's hero phase, the resistance team's hero phase, the registration team's villain phase, the
 * resistance team's villain phase; "During the other team's phases, your side of the table is inactive"; "each team has
 * its own first player token. Pass it at the end of that team's villain phase". Owner decisions of 2026-11-20: one
 * shared round (Q3 B: "until the end of the round" ends after the fourth phase, for both teams), the inactive team takes
 * no action but answers choices given to it (Q11 A), the active team's first player orders simultaneous triggers (N2).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, sharedMainSchemes } from "./query.js";
import type { EffectSpec, PlayerRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent } from "./testing/fixtures.js";
import { DEFAULT_DECK, defaultPick, giveCard } from "./testing/scenario.js";
import { competitiveGame, TEAM_ONE, TEAM_TWO } from "./testing/team.js";

const [P1, P2, P3, P4] = ["p1", "p2", "p3", "p4"].map(playerId) as [PlayerId, PlayerId, PlayerId, PlayerId];

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const plusAtk = (until: "endOfPhase" | "endOfRound"): EffectSpec => ({
  kind: "modifyStatUntil",
  stat: "atk",
  amount: { kind: "const", value: 1 },
  target: { kind: "identityOf", player: { kind: "controller" } },
  until,
});
/** "Your hero gets +1 ATK until the end of the round." */
const ROUND = actionEvent("until-round", [plusAtk("endOfRound")]);
/** "Your hero gets +1 ATK until the end of the phase." */
const PHASE = actionEvent("until-phase", [plusAtk("endOfPhase")]);
const ENEMY_TEAM_CHOOSES: PlayerRef = { kind: "enemyTeamDecider" };
/** "The enemy team chooses a character. Deal 1 damage to it." */
const GRIM = actionEvent("grim", [
  { kind: "chooseTarget", slot: "picked", query: { categories: ["character"] }, chooser: ENEMY_TEAM_CHOOSES },
  { kind: "dealDamage", target: { kind: "slot", slot: "picked" }, amount: { kind: "const", value: 1 } },
]);
const EVENTS = [ROUND, PHASE, GRIM];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));
const DECK = [...DEFAULT_DECK, ...EVENTS.flatMap((e) => [e.card.id, e.card.id])];

const game = (sizes: readonly [number, number]): GameState =>
  competitiveGame({ sizes, deps, extraCards: EVENTS.map((e) => e.card), deck: DECK });

interface Driven {
  session: GameSession;
  readonly events: GameEvent[];
}

/** Applies `command` (refused: throws), then answers every choice it leads to with the default pick. */
function act(driven: Driven, command: Command): void {
  const apply = (next: Command): void => {
    const result = sessionApply(driven.session, next, deps);
    if (!result.ok) throw new Error(`${next.type} by ${next.playerId} refused: ${result.error.message}`);
    driven.session = result.session;
    driven.events.push(...result.events);
  };
  apply(command);
  for (let guard = 0; driven.session.state.pendingChoice && !driven.session.state.outcome; guard++) {
    if (guard > 200) throw new Error("choices did not settle");
    const choice = driven.session.state.pendingChoice;
    apply({
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: defaultPick(driven.session.state),
    });
  }
}

/** Ends every turn until `until` holds, from a state at a player's turn. */
function endTurnsUntil(driven: Driven, until: (state: GameState) => boolean): void {
  for (let guard = 0; !until(driven.session.state); guard++) {
    if (guard > 50) throw new Error("the round did not reach the expected point");
    const step = driven.session.state.step;
    if (step.kind !== "turn") throw new Error(`not at a turn: ${step.phase}/${step.kind}`);
    act(driven, { type: "endTurn", playerId: step.activePlayerId });
  }
}

const drive = (state: GameState): Driven => ({ session: startSession(state), events: [] });
const nextRound = (state: GameState) => state.round === 2 && state.step.kind === "turn";

describe("one shared round of four team phases (2v2)", () => {
  const driven = drive(game([2, 2]));
  const [leaderOne, leaderTwo] = driven.session.state.villains.map((villain) => villain.instanceId);
  const [deckOne, deckTwo] = driven.session.state.villains.map((villain) => villain.encounterDeckId);
  const [schemeOne, schemeTwo] = sharedMainSchemes(driven.session.state).map((scheme) => scheme.instanceId);
  endTurnsUntil(driven, nextRound);
  const { events } = driven;

  it("plays registration hero, resistance hero, registration villain, resistance villain, then a new round", () => {
    const marks = events.flatMap((event) => {
      if (event.type === "activeTeamChanged") return [`${event.teamId} ${event.phase}`];
      if (event.type === "roundStarted") return [`round ${event.round}`];
      return [];
    });
    expect(marks).toEqual([
      `${TEAM_TWO} player`,
      `${TEAM_ONE} villain`,
      `${TEAM_TWO} villain`,
      "round 2",
      `${TEAM_ONE} player`,
    ]);
  });

  it("gives turns to the active team only, its first player first", () => {
    const turns = events.flatMap((event) => (event.type === "turnStarted" ? [event.playerId] : []));
    // Round 1: p1 p2, then p3 p4; round 2 opens with team one's token, passed to p2 at its villain phase's end.
    expect(turns).toEqual([P2, P3, P4, P2]);
  });

  it("activates each team's enemy leader against that team's players only", () => {
    const activations = events.flatMap((event) =>
      event.type === "enemyActivated" ? [[event.enemyInstanceId, event.playerId]] : [],
    );
    expect(activations).toEqual([
      [leaderOne, P1],
      [leaderOne, P2],
      [leaderTwo, P3],
      [leaderTwo, P4],
    ]);
  });

  it("places step one's threat on the active team's main scheme alone", () => {
    // Step one's threat has no source card; a leader scheming against an alter-ego places threat of its own.
    const placed = events.flatMap((event) =>
      event.type === "threatPlaced" && event.sourceInstanceId === null ? [[event.schemeInstanceId, event.amount]] : [],
    );
    expect(placed).toEqual([
      [schemeOne, 1],
      [schemeTwo, 2],
    ]);
  });

  it("deals each team's encounter cards from the deck it faces", () => {
    const dealt = events.flatMap((event) =>
      event.type === "cardMoved" && event.to.kind === "dealtEncounter" && event.from.kind === "encounterDeck"
        ? [[event.from.deckId, event.to.playerId]]
        : [],
    );
    // Step three's cards in player order, team one's first; a dealt obligation's own text may deal more.
    expect(dealt.slice(0, 2)).toEqual([
      [deckOne, P1],
      [deckOne, P2],
    ]);
    expect(dealt.slice(2, 4)).toEqual([
      [deckTwo, P3],
      [deckTwo, P4],
    ]);
    for (const [deck, player] of dealt) expect(deck).toBe(player === P1 || player === P2 ? deckOne : deckTwo);
  });

  it("passes each team's own first player token at the end of that team's villain phase", () => {
    const passes = events.flatMap((event) =>
      event.type === "firstPlayerChanged" ? [[event.playerId, event.teamId]] : [],
    );
    expect(passes).toEqual([
      [P2, TEAM_ONE],
      [P4, TEAM_TWO],
    ]);
    const state = driven.session.state;
    expect(state.teams?.map((team) => team.firstPlayerId)).toEqual([P2, P4]);
    // N2: "the first player" every existing reader asks is the active team's.
    expect(state.activeTeamId).toBe(TEAM_ONE);
    expect(state.firstPlayerId).toBe(P2);
    expect(state.activeVillainId).toBe(leaderOne);
  });

  it("replays from the log to the same state", () => {
    const replayed = replay(driven.session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(driven.session.state);
  });
});

describe("lasting effects bounded by a team's phase and by the shared round (Q3 B)", () => {
  const lasting = (state: GameState, player: PlayerId) => {
    const identity = state.players.find((seat) => seat.playerId === player)!.identity.instanceId;
    return state.lastingEffects
      .filter((effect) => JSON.stringify(effect).includes(identity))
      .map((effect) => effect.duration.kind)
      .sort();
  };
  const playEvent = (driven: Driven, player: PlayerId, card: string): void => {
    const given = giveCard(driven.session.state, player, card);
    driven.session = startSession(given.state);
    act(driven, {
      type: "playCard",
      playerId: player,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });
  };

  it("ends 'this phase' with the acting team's phase and 'this round' after both villain phases", () => {
    const driven = drive(game([1, 1]));
    playEvent(driven, P1, ROUND.card.id);
    playEvent(driven, P1, PHASE.card.id);
    expect(lasting(driven.session.state, P1)).toEqual(["endOfPhase", "endOfRound"]);
    // Team one's hero phase ends: its phase effect is gone, its round effect stays through team two's phases.
    endTurnsUntil(driven, (state) => state.activeTeamId === TEAM_TWO);
    expect(lasting(driven.session.state, P1)).toEqual(["endOfRound"]);
    playEvent(driven, P2, ROUND.card.id);
    expect(lasting(driven.session.state, P2)).toEqual(["endOfRound"]);
    const roundEffects = driven.session.state.lastingEffects.map((effect) => effect.id);
    // The rest of the round runs in one go: team two's hero phase, then both villain phases.
    driven.events.length = 0;
    endTurnsUntil(driven, nextRound);
    const at = (match: (event: GameEvent) => boolean): number => driven.events.findIndex(match);
    const teamTwoVillain = at((e) => e.type === "activeTeamChanged" && e.teamId === TEAM_TWO && e.phase === "villain");
    const roundTwo = at((e) => e.type === "roundStarted");
    const ends = roundEffects.map((id) => at((e) => e.type === "lastingEffectEnded" && e.id === id));
    // Both teams' round effects end together, after the second villain phase and before the next round: not with the
    // first team's villain phase.
    expect(teamTwoVillain).toBeGreaterThan(0);
    for (const end of ends) {
      expect(end).toBeGreaterThan(teamTwoVillain);
      expect(end).toBeLessThan(roundTwo);
    }
    expect(lasting(driven.session.state, P1)).toEqual([]);
    expect(lasting(driven.session.state, P2)).toEqual([]);
  });
});

describe("the inactive team (Q11 A)", () => {
  const state = game([1, 1]);
  const hand = (player: PlayerId): readonly InstanceId[] =>
    state.players.find((seat) => seat.playerId === player)!.hand;

  it("is refused every action during the other team's phase, with a clear error", () => {
    const tries: readonly Command[] = [
      { type: "endTurn", playerId: P2 },
      { type: "basicRecover", playerId: P2 },
      { type: "changeForm", playerId: P2 },
      { type: "playCard", playerId: P2, cardInstanceId: hand(P2)[0]!, payment: [], attachToInstanceId: null },
    ];
    for (const command of tries) {
      const result = applyCommand(state, command, deps);
      expect(result.ok ? null : result.error).toMatchObject({
        code: "inactive_team",
        message: "It is the Registration team's hero phase: your side of the table is inactive until it ends.",
      });
    }
    expect(legalActions(state, P2, deps)).toMatchObject({ kind: "notYourTurn", legal: [], illegal: [] });
  });

  it("answers a choice the active team's card gives to the enemy team", () => {
    const given = giveCard(state, P1, GRIM.card.id);
    const asked = applyCommand(
      given.state,
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      deps,
    );
    if (!asked.ok) throw new Error(asked.error.message);
    const choice = asked.state.pendingChoice!;
    expect(choice.playerId).toBe(P2);
    const target = asked.state.players.find((seat) => seat.playerId === P1)!.identity.instanceId;
    const answered = applyCommand(
      asked.state,
      { type: "resolveChoice", playerId: P2, choiceId: choice.choiceId, selectedOptionIds: [target] },
      deps,
    );
    if (!answered.ok) throw new Error(answered.error.message);
    expect(mustInstance(answered.state, target).damage).toBe(1);
    // …and still takes no action of its own.
    expect(applyCommand(answered.state, { type: "endTurn", playerId: P2 }, deps)).toMatchObject({
      ok: false,
      error: { code: "inactive_team" },
    });
  });

  it("acts once its own phase begins, and the first team is then the inactive one", () => {
    const driven = drive(state);
    endTurnsUntil(driven, (current) => current.activeTeamId === TEAM_TWO);
    const now = driven.session.state;
    expect(now.step).toMatchObject({ phase: "player", kind: "turn", activePlayerId: P2 });
    // N2: whatever the first player decides now (the order of simultaneous triggers, in either area) is team two's.
    expect(now.firstPlayerId).toBe(P2);
    expect(applyCommand(now, { type: "basicRecover", playerId: P1 }, deps)).toMatchObject({
      ok: false,
      error: { code: "inactive_team" },
    });
    expect(applyCommand(now, { type: "endTurn", playerId: P2 }, deps).ok).toBe(true);
  });
});
