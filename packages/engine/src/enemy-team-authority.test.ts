/**
 * docs/competitive-mode-plan.md §3.4 and §4 task 7 (docs/phase7-wave10.md §3.5): who makes a choice a card gives to
 * "the enemy team", and what the pending choice and the log say about it.
 *
 * Sources: MC56 p. 6 (cooperative play): "Any rule or ability that refers to 'the enemy team' refers to the players.
 * Resolve these abilities using the grim rule: Imagine what an opponent would do if it were their choice." The rulebook
 * names no one player; the owner's decision (2026-10-11, question 6, answer A) is the first player, as for what an
 * encounter card leaves open (RRG 1.8 "First Player", p. 19). No setup makes a second team, so the two-team side is
 * read on `twoTeamState`.
 */

import { describe, expect, it } from "vitest";
import type { AnyCard } from "@mc/content";
import type { EngineDeps } from "./abilities.js";
import { ENEMY_TEAM_CHOICE_INSTRUCTION, ENEMY_TEAM_CHOICE_RULE, type PendingChoice } from "./choices.js";
import type { Command } from "./commands.js";
import { createCtx } from "./ctx.js";
import { applyCommand, replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { mustInstance } from "./query.js";
import { eliminatePlayer } from "./resolve/defeat.js";
import { enemyTeamDecider, resolvePlayers, type EffectContext } from "./select.js";
import type { EffectSpec, PlayerRef } from "./spec.js";
import type { GameState } from "./state.js";
import { SINGLE_TEAM } from "./team.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { TEAM_ONE, TEAM_TWO, twoTeamState } from "./testing/team.js";
import { gameAtFirstTurn } from "./testing/wave3.js";
import { effectChoiceAuthority } from "./villain/authority.js";

const P1 = playerId("p1");
const P2 = playerId("p2");
const P3 = playerId("p3");
const P4 = playerId("p4");
const SEATS = [P1, P2, P3, P4];

const ENEMY_TEAM_CHOOSES: PlayerRef = { kind: "enemyTeamDecider" };

/** "<chooser> chooses a character. Deal 2 damage to it.": every identity and the villain, so even one player is asked. */
const chooseAndHit = (chooser: PlayerRef): readonly EffectSpec[] => [
  { kind: "chooseTarget", slot: "picked", query: { categories: ["character"] }, chooser },
  { kind: "dealDamage", target: { kind: "slot", slot: "picked" }, amount: { kind: "const", value: 2 } },
];
const event = (id: string, chooser: PlayerRef) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects: chooseAndHit(chooser) });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "The enemy team chooses a character. Deal 2 damage to it." */
const GRIM = event("grim", ENEMY_TEAM_CHOOSES);
/** "Choose a character. Deal 2 damage to it." */
const OWN = event("own", { kind: "controller" });
/** The same, chosen by the first player, on a player card. */
const FIRST = event("first", { kind: "firstPlayer" });
const EVENTS = [GRIM, OWN, FIRST];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));

const start = (players: 1 | 2 | 3 | 4): GameState =>
  gameAtFirstTurn({ cards: EVENTS.map((e) => e.card), deck: EVENTS.map((e) => e.card.id), deps, players });

const identity = (state: GameState, player: PlayerId): InstanceId =>
  state.players.find((seat) => seat.playerId === player)!.identity.instanceId;
const damageOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).damage;

interface Asked {
  readonly session: GameSession;
  readonly events: readonly GameEvent[];
  readonly choice: PendingChoice;
}

/** `player` plays `card` for 0 from a fresh session, which stops at the choice the card asks. */
function ask(state: GameState, card: AnyCard, player: PlayerId): Asked {
  const seat = state.players.find((candidate) => candidate.playerId === player)!;
  // The two-team fixture's decks do not hold the test's cards: the top card of the deck becomes one.
  const held = seat.deck.concat(seat.hand).some((id) => state.instances[id]?.cardId === card.id);
  const top = seat.deck[0]!;
  const stocked: GameState = held
    ? state
    : {
        ...state,
        cardPool: { ...state.cardPool, [card.id]: card },
        instances: { ...state.instances, [top]: { ...state.instances[top]!, cardId: card.id } },
      };
  const given = giveCard(stocked, player, card.id);
  const result = sessionApply(
    startSession(given.state),
    { type: "playCard", playerId: player, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  const choice = result.session.state.pendingChoice;
  if (!choice) throw new Error("the card asked nothing");
  return { session: result.session, events: result.events, choice };
}

const answerAs = (asked: Asked, player: PlayerId, optionId: string): Command => ({
  type: "resolveChoice",
  playerId: player,
  choiceId: asked.choice.choiceId,
  selectedOptionIds: [optionId],
});

const contextOf = (controllerId: PlayerId | null): EffectContext => ({
  selfInstanceId: null,
  controllerId,
  event: null,
  bindings: {},
  deps,
});

describe("cooperative play: the first player chooses for the enemy team", () => {
  it.each([1, 2, 3, 4] as const)(
    "%i players: the last seat's card asks the first player, marked as the enemy team's",
    (players) => {
      const state = start(players);
      const resolving = SEATS[players - 1]!;
      expect(state.firstPlayerId).toBe(P1);
      const { choice } = ask(state, GRIM.card, resolving);
      expect(choice.playerId).toBe(P1);
      expect(choice.authority).toBe("enemyTeam");
      expect(choice.onBehalfOf).toEqual({ kind: "enemyTeam", teamId: SINGLE_TEAM, facingPlayerId: resolving });
      expect(choice.prompt.kind).toBe("chooseTarget");
      expect(choice.minSelections).toBe(1);
      expect(choice.maxSelections).toBe(1);
      // Every character, and nothing ranked or left out: each identity and the villain.
      expect(choice.options.map((option) => option.optionId).sort()).toEqual(
        [...SEATS.slice(0, players).map((seat) => identity(state, seat)), state.activeVillainId].sort(),
      );
    },
  );

  it("after the first player token passes, the new first player is asked", () => {
    const opening = start(3);
    const round = driveSession(
      startSession(opening),
      deps,
      [P1, P2, P3].map((seat) => ({ type: "endTurn", playerId: seat })),
    ).session.state;
    expect(round.round).toBe(opening.round + 1);
    expect(round.firstPlayerId).toBe(P2);
    const { choice } = ask(round, GRIM.card, P3);
    expect(choice.playerId).toBe(P2);
    expect(choice.onBehalfOf).toEqual({ kind: "enemyTeam", teamId: SINGLE_TEAM, facingPlayerId: P3 });
  });

  it("when the first player is eliminated, the choice goes where the token went", () => {
    const ctx = createCtx(start(3), deps);
    eliminatePlayer(ctx, P1);
    expect(ctx.state.firstPlayerId).toBe(P2);
    const { choice } = ask(ctx.state, GRIM.card, P3);
    expect(choice.playerId).toBe(P2);
    expect(choice.authority).toBe("enemyTeam");
    expect(choice.options.map((option) => option.optionId).sort()).toEqual(
      [identity(ctx.state, P2), identity(ctx.state, P3), ctx.state.activeVillainId].sort(),
    );
  });

  it.each([2, 3, 4] as const)("%i players: no other seat may answer, the resolving player included", (players) => {
    const state = start(players);
    const resolving = SEATS[players - 1]!;
    const asked = ask(state, GRIM.card, resolving);
    for (const seat of SEATS.slice(1, players)) {
      const refused = applyCommand(asked.session.state, answerAs(asked, seat, state.activeVillainId), deps);
      expect(refused.ok).toBe(false);
      if (refused.ok) continue;
      expect(refused.error.code).toBe("invalid_choice");
      expect(refused.error.message).toBe("p1 must make this choice");
    }
    expect(asked.session.state.pendingChoice).toEqual(asked.choice);
  });

  it("the answer is the first player's: 2 damage on the identity picked, and the log says for whom", () => {
    const state = start(3);
    const asked = ask(state, GRIM.card, P2);
    const target = identity(state, P2);
    const answered = sessionApply(asked.session, answerAs(asked, P1, target), deps);
    if (!answered.ok) throw new Error(answered.error.message);
    expect(damageOn(answered.session.state, target)).toBe(damageOn(state, target) + 2);
    expect(damageOn(answered.session.state, state.activeVillainId)).toBe(damageOn(state, state.activeVillainId));
    expect(answered.session.state.pendingChoice).toBeNull();
    const behalf = { kind: "enemyTeam", teamId: SINGLE_TEAM, facingPlayerId: P2 };
    expect(asked.events.filter((e) => e.type === "choiceRequested")).toEqual([
      { type: "choiceRequested", choice: asked.choice },
    ]);
    expect(answered.events.filter((e) => e.type === "choiceResolved")).toEqual([
      {
        type: "choiceResolved",
        choiceId: asked.choice.choiceId,
        playerId: P1,
        selectedOptionIds: [target],
        onBehalfOf: behalf,
      },
    ]);
  });

  it("a game that makes the choice replays to the same state", () => {
    const state = start(4);
    const asked = ask(state, GRIM.card, P3);
    const answered = sessionApply(asked.session, answerAs(asked, P1, identity(state, P4)), deps);
    if (!answered.ok) throw new Error(answered.error.message);
    expect(answered.session.log.commands).toHaveLength(2);
    const replayed = replay(answered.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(answered.session.state);
    expect(damageOn(replayed.state, identity(state, P4))).toBe(2);
    // The parked choice is plain data.
    expect(JSON.parse(JSON.stringify(asked.choice))).toEqual(asked.choice);
  });
});

describe("the same card without the word keeps its chooser", () => {
  it("'choose' is the resolving player's own, with no mark, over the same options", () => {
    const state = start(3);
    const grim = ask(state, GRIM.card, P3).choice;
    const own = ask(state, OWN.card, P3).choice;
    expect(own.playerId).toBe(P3);
    expect(own.authority).toBe("player");
    expect("onBehalfOf" in own).toBe(false);
    expect(own.options).toEqual(grim.options);
    expect(own.prompt).toEqual(grim.prompt);
  });

  it("a first-player choice on a player card is still an unmarked first-player choice", () => {
    const state = start(3);
    const asked = ask(state, FIRST.card, P3);
    expect(asked.choice.playerId).toBe(P1);
    expect(asked.choice.authority).toBe("player");
    expect("onBehalfOf" in asked.choice).toBe(false);
    const answered = sessionApply(asked.session, answerAs(asked, P1, state.activeVillainId), deps);
    if (!answered.ok) throw new Error(answered.error.message);
    expect(answered.events.filter((e) => e.type === "choiceResolved")).toEqual([
      {
        type: "choiceResolved",
        choiceId: asked.choice.choiceId,
        playerId: P1,
        selectedOptionIds: [state.activeVillainId],
      },
    ]);
  });

  it("the authority is read from the chooser alone, on a card of either side", () => {
    const state = start(2);
    expect(effectChoiceAuthority(state, null, ENEMY_TEAM_CHOOSES)).toBe("enemyTeam");
    expect(effectChoiceAuthority(state, state.activeVillainId, ENEMY_TEAM_CHOOSES)).toBe("enemyTeam");
    expect(effectChoiceAuthority(state, state.activeVillainId, { kind: "firstPlayer" })).toBe("firstPlayerTargets");
    expect(effectChoiceAuthority(state, state.activeVillainId, { kind: "controller" })).toBe("player");
  });
});

describe("the decider as a player", () => {
  it.each([1, 2, 3, 4] as const)("%i players: the first player, whoever the effect resolves for", (players) => {
    const state: GameState = { ...start(players), firstPlayerId: SEATS[players - 1]! };
    for (const seat of [...SEATS.slice(0, players), null]) {
      expect(enemyTeamDecider(state, contextOf(seat))).toBe(SEATS[players - 1]);
      expect(resolvePlayers(state, ENEMY_TEAM_CHOOSES, contextOf(seat))).toEqual([SEATS[players - 1]]);
    }
  });

  it("the words a client shows are the plan's line and the rulebook's sentence", () => {
    expect(ENEMY_TEAM_CHOICE_INSTRUCTION).toBe("Choose as the enemy team would.");
    expect(ENEMY_TEAM_CHOICE_RULE).toBe("Imagine what an opponent would do if it were their choice.");
  });
});

describe("two teams: a player of the other team chooses", () => {
  it("2 against 2: each side's choice is parked with the other team's first player in player order", () => {
    const state = twoTeamState({ sizes: [2, 2] });
    expect(state.firstPlayerId).toBe(P1);
    expect(enemyTeamDecider(state, contextOf(P1))).toBe(P3);
    expect(enemyTeamDecider(state, contextOf(P2))).toBe(P3);
    expect(enemyTeamDecider(state, contextOf(P3))).toBe(P1);
    expect(enemyTeamDecider(state, contextOf(P4))).toBe(P1);
    // Player order starts at the first player; an eliminated player is passed over.
    expect(enemyTeamDecider({ ...state, firstPlayerId: P4 }, contextOf(P1))).toBe(P4);
    expect(enemyTeamDecider({ ...state, firstPlayerId: P2 }, contextOf(P4))).toBe(P2);
    const ctx = createCtx(state, deps);
    eliminatePlayer(ctx, P3);
    expect(enemyTeamDecider(ctx.state, contextOf(P1))).toBe(P4);
    // An effect read for no team has nobody to ask.
    expect(enemyTeamDecider(state, contextOf(null))).toBeNull();
    expect(resolvePlayers(state, ENEMY_TEAM_CHOOSES, contextOf(null))).toEqual([]);
  });

  it("2 against 2: the pending choice names the other team and the player it is made against", () => {
    const state = twoTeamState({ sizes: [2, 2] });
    const fromOne = ask(state, GRIM.card, P1).choice;
    expect(fromOne.playerId).toBe(P3);
    expect(fromOne.authority).toBe("enemyTeam");
    expect(fromOne.onBehalfOf).toEqual({ kind: "enemyTeam", teamId: TEAM_TWO, facingPlayerId: P1 });
    const fromTwo = ask(state, GRIM.card, P4).choice;
    expect(fromTwo.playerId).toBe(P1);
    expect(fromTwo.onBehalfOf).toEqual({ kind: "enemyTeam", teamId: TEAM_ONE, facingPlayerId: P4 });
  });
});

// docs/phase7-wave10.md §3.5: "Where there is one candidate there is no prompt" (QA finding F2). Only a required choice
// is forced: a printed "may" can choose none and "up to" is the chooser's to make (RRG 1.8 "Choose (Game Element)",
// p. 12; spec §4 Q16), so both still ask with one candidate.
describe("one candidate: the enemy team's required choice is forced", () => {
  /** "The enemy team chooses the villain. Deal 2 damage to it.", with `extra` on the choice. */
  const villainEvent = (id: string, extra: Partial<Extract<EffectSpec, { kind: "chooseTarget" }>>) => {
    const ability = stubAbility(`${id}.action`, {
      trigger: { kind: "action" },
      effects: [
        {
          kind: "chooseTarget",
          slot: "picked",
          query: { categories: ["villain"] },
          chooser: ENEMY_TEAM_CHOOSES,
          ...extra,
        },
        { kind: "dealDamage", target: { kind: "slot", slot: "picked" }, amount: { kind: "const", value: 2 } },
      ],
    });
    return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
  };
  const REQUIRED = villainEvent("forced", {});
  const MAY = villainEvent("may", { optional: true });
  const UP_TO = villainEvent("upto", { count: 2, upTo: true });
  const ONE = [REQUIRED, MAY, UP_TO];
  const oneDeps: EngineDeps = depsOf(...ONE.map((e) => e.ability));
  const play = (card: AnyCard) => {
    const opening = gameAtFirstTurn({
      cards: ONE.map((e) => e.card),
      deck: ONE.map((e) => e.card.id),
      deps: oneDeps,
      players: 2,
    });
    const given = giveCard(opening, P2, card.id);
    const result = sessionApply(
      startSession(given.state),
      { type: "playCard", playerId: P2, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      oneDeps,
    );
    if (!result.ok) throw new Error(result.error.message);
    return { opening, session: result.session, events: result.events };
  };
  const enemyTeamRequests = (events: readonly GameEvent[]) =>
    events.filter((e) => e.type === "choiceRequested" && e.choice.authority === "enemyTeam");

  it("required, one legal target: no prompt, the pick is logged as `targetChosen` and resolves", () => {
    const { opening, session, events } = play(REQUIRED.card);
    const villain = opening.activeVillainId;
    expect(enemyTeamRequests(events)).toEqual([]);
    expect(session.state.pendingChoice).toBeNull();
    expect(events.filter((e) => e.type === "targetChosen")).toEqual([
      { type: "targetChosen", slot: "picked", instanceIds: [villain] },
    ]);
    expect(damageOn(session.state, villain)).toBe(damageOn(opening, villain) + 2);
  });

  it("a printed 'may' with one legal target still asks the first player, who may choose none", () => {
    const { opening, session } = play(MAY.card);
    const choice = session.state.pendingChoice!;
    expect([choice.playerId, choice.authority, choice.minSelections, choice.maxSelections]).toEqual([
      P1,
      "enemyTeam",
      0,
      1,
    ]);
    expect(choice.options.map((option) => option.optionId)).toEqual([opening.activeVillainId]);
  });

  it("'up to 2' with one legal target still asks the first player", () => {
    const { opening, session } = play(UP_TO.card);
    const choice = session.state.pendingChoice!;
    expect([choice.playerId, choice.authority, choice.minSelections, choice.maxSelections]).toEqual([
      P1,
      "enemyTeam",
      1,
      1,
    ]);
    expect(choice.options.map((option) => option.optionId)).toEqual([opening.activeVillainId]);
  });
});
