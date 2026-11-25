/**
 * Competitive play: a concession (N12) and an emptied encounter deck.
 *
 * Sources: N12 A per owner decision 2026-11-20 (a team's concession is a forfeit that ends the game at once, with no
 * equal phases and no tie-breaks; one 2v2 player conceding alone removes only that player; conceding fires no defeat
 * effects; RRG v1.8 "Player Elimination" p. 34). MC56 p. 20 QR ("the players" = your team only), p. 17 (equal
 * phases); RRG v1.8 "Encounter Deck" p. 17 (an empty deck reshuffles with an acceleration token; deck and discard both
 * empty is that team's loss).
 */

import { describe, expect, it } from "vitest";
import type { CompetitiveOutcome } from "./competitive-outcome.js";
import { applyCommand, sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type PlayerId } from "./ids.js";
import { mainSchemeFor } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubSupport } from "./testing/fixtures.js";
import { playerCardIntoPlay } from "./testing/wave3.js";
import { DEFAULT_DECK, defaultPick } from "./testing/scenario.js";
import { competitiveGame, TEAM_ONE, TEAM_TWO } from "./testing/team.js";

const [P1, P2, P3] = ["p1", "p2", "p3"].map(playerId) as [PlayerId, PlayerId, PlayerId];

/** "Forced Response: After an identity is defeated, draw 1 card." (on a support), to show no defeat is heard. */
const ON_DEFEAT = stubAbility("on-defeat.response", {
  trigger: { kind: "response", forced: true, on: { on: "characterDefeated", targetIs: { categories: ["identity"] } } },
  effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
});
const ON_DEFEAT_CARD = stubSupport({ id: "on-defeat", cost: 0, abilities: [ON_DEFEAT.ref] });
const deps = depsOf(ON_DEFEAT);
const options = { deps, extraCards: [ON_DEFEAT_CARD], deck: [...DEFAULT_DECK, ON_DEFEAT_CARD.id] };

function apply(state: GameState, command: Parameters<typeof applyCommand>[1]) {
  const result = applyCommand(state, command, deps);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}
/** Applies `command`, then answers every choice by default, keeping every event. */
function settled(state: GameState, command: Parameters<typeof applyCommand>[1]) {
  const first = apply(state, command);
  let session = startSession(first.state);
  const events = [...first.events];
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
const resultOf = (state: GameState) =>
  Object.fromEntries(((state.outcome as CompetitiveOutcome | null)?.teams ?? []).map((t) => [t.teamId, t.result]));

describe("a team concedes (N12 A): a forfeit that ends the game at once", () => {
  it("1v1: the conceding team loses and the other wins, with no equal phases and no tie-break", () => {
    const { state, events } = apply(competitiveGame(options), { type: "concede", playerId: P1 });
    expect(state.outcome).toMatchObject({
      result: "teams",
      reason: "teamConceded",
      concededBy: P1,
      decision: "win",
    });
    expect((state.outcome as CompetitiveOutcome).tieBreak).toBeUndefined();
    expect(resultOf(state)).toEqual({ [TEAM_ONE]: "loss", [TEAM_TWO]: "win" });
    // At once: in the registration team's hero phase, the resistance team never played one.
    expect(events.some((e: GameEvent) => e.type === "activeTeamChanged")).toBe(false);
    expect(events.some((e: GameEvent) => e.type === "teamResultRecorded")).toBe(false);
  });

  it("the resistance team conceding in the registration team's phase loses it too", () => {
    const { state } = apply(competitiveGame(options), { type: "concede", playerId: P2 });
    expect(resultOf(state)).toEqual({ [TEAM_ONE]: "win", [TEAM_TWO]: "loss" });
  });

  it("2v2 without `alone`: one player's concession is the team's forfeit", () => {
    const { state } = apply(competitiveGame({ ...options, sizes: [2, 2] }), { type: "concede", playerId: P1 });
    expect(resultOf(state)).toEqual({ [TEAM_ONE]: "loss", [TEAM_TWO]: "win" });
  });
});

describe("one 2v2 player concedes alone (N12 A; RRG v1.8 Player Elimination p. 34)", () => {
  const start = playerCardIntoPlay(competitiveGame({ ...options, sizes: [2, 2] }), ON_DEFEAT_CARD.id, P3).state;
  const { state, events } = apply(start, { type: "concede", playerId: P1, alone: true });

  it("removes only that player; the game goes on and nothing is recorded for either team", () => {
    expect(state.outcome).toBeNull();
    expect(state.players.find((p) => p.playerId === P1)?.eliminated).toBe(true);
    expect(state.players.filter((p) => p.eliminated).map((p) => p.playerId)).toEqual([P1]);
    expect(state.competitive?.end).toBeUndefined();
    expect(events).toContainEqual({ type: "playerEliminated", playerId: P1 });
  });

  it("fires no defeat effect: it is not a defeat", () => {
    expect(events.some((e) => e.type === "characterDefeated")).toBe(false);
    expect(events.some((e) => e.type === "abilityResolved" && e.abilityId === ON_DEFEAT.ref.id)).toBe(false);
  });

  it("the team's last seat conceding alone is the team's forfeit", () => {
    const { state: after } = apply(state, { type: "concede", playerId: playerId("p2"), alone: true });
    expect(after.outcome).toMatchObject({ reason: "teamConceded", concededBy: playerId("p2") });
    expect(resultOf(after)).toEqual({ [TEAM_ONE]: "loss", [TEAM_TWO]: "win" });
  });
});

// RRG v1.8 "Encounter Deck" p. 17: immediate reshuffle + acceleration token; deck and discard both empty = that team loses (MC56 adds no exception; p. 17 equal-phase window applies)
describe('an encounter deck emptied in competitive play (RRG v1.8 "Encounter Deck" p. 17)', () => {
  const tokens = (s: GameState, area: number) => mainSchemeFor(s, s.gameAreas[area]!)!.accelerationTokens;
  /** Team one's deck (area 0) left with one card and `discard` cards in its discard pile; the other deck untouched. */
  function withOneCardLeft(discard: number) {
    const state = competitiveGame(options);
    const deckId = state.villains[0]!.encounterDeckId;
    const piles = state.encounterDecks[deckId]!;
    return {
      deckId,
      state: {
        ...state,
        encounterDecks: {
          ...state.encounterDecks,
          [deckId]: { deck: piles.deck.slice(0, 1), discard: piles.deck.slice(1, 1 + discard) },
        },
      },
    };
  }
  /** Through both hero phases into the registration team's villain phase, which deals P1 that deck's last card. */
  function intoVillainPhase(state: GameState) {
    const one = settled(state, { type: "endTurn", playerId: P1 });
    const two = settled(one.state, { type: "endTurn", playerId: P2 });
    return { state: two.state, events: [...one.events, ...two.events] };
  }

  it("with a discard pile: reshuffled at once, with one acceleration token on that team's main scheme only", () => {
    const { state, deckId } = withOneCardLeft(3);
    const before = [tokens(state, 0), tokens(state, 1)];
    const run = intoVillainPhase(state);
    const shuffled = run.events.findIndex((e) => e.type === "accelerationTokenAdded");
    expect(shuffled).toBeGreaterThanOrEqual(0);
    expect(tokens(run.state, 0)).toBe(before[0]! + 1);
    expect(tokens(run.state, 1)).toBe(before[1]);
    expect(run.state.encounterDecks[deckId]!.deck.length).toBeGreaterThan(0);
    expect(run.events.some((e) => e.type === "teamResultRecorded" || e.type === "gameEnded")).toBe(false);
  });

  it("deck and discard both empty: that team loses, the other's opponentsLost, closing after equal phases", () => {
    const { state } = withOneCardLeft(0);
    const run = intoVillainPhase(state);
    const recorded = run.events.filter((e) => e.type === "teamResultRecorded");
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ trigger: { teamId: TEAM_TWO, condition: "opponentsLost" } });
    // MC56 p. 17: in the registration team's villain phase, so the resistance team still plays its villain phase.
    expect(recorded[0]).toMatchObject({ closesAfter: { teamId: TEAM_TWO, phase: "villain" } });
    // The game ends only after that phase (`settled` plays it through: its seat has no choice to make).
    const at = run.events.indexOf(recorded[0]!);
    const handover = run.events.findIndex((e, i) => i > at && e.type === "activeTeamChanged");
    const ended = run.events.findIndex((e) => e.type === "gameEnded");
    expect(handover).toBeGreaterThan(at);
    expect(ended).toBeGreaterThan(handover);
    expect(resultOf(run.state)).toEqual({ [TEAM_ONE]: "loss", [TEAM_TWO]: "win" });
  });
});
