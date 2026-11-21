/**
 * What each side of the table hears and keeps across a competitive round (docs/competitive-mode-plan.md M2, M3; the
 * code review of the M1/M2 commits, 2026-11-20).
 *
 * Sources: MC56 p. 16 (scenario rules override RRG per Golden Rule, RRG p. 4): each team plays "their entire hero phase"
 * and villain phase on its own side, each with its own first player token. Q3 B per owner decision 2026-11-20: one
 * shared round, ending after the fourth phase for both teams. Competitive: phase begin/end events are scoped to the
 * active team's area; round end is shared after phase 4 (plan §1.10 Q3). Owner decision pending, A recommended.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { createCtx } from "./ctx.js";
import { resetEncounterDeckIfEmpty } from "./effects.js";
import { applyCommand, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { gameAreaId, playerId, type PlayerId } from "./ids.js";
import { mustInstance, perPlayerCountAt, sharedMainSchemes } from "./query.js";
import { eliminatePlayer } from "./resolve/defeat.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { firstPlayerOfCard } from "./team-phases.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { DEFAULT_DECK, defaultPick, giveCard, newGame } from "./testing/scenario.js";
import { competitiveGame, TEAM_ONE, TEAM_TWO } from "./testing/team.js";
import { playerCardIntoPlay } from "./testing/wave3.js";

const [P1, P2, P3, P4] = ["p1", "p2", "p3", "p4"].map(playerId) as [PlayerId, PlayerId, PlayerId, PlayerId];

const hit = (n: number): EffectSpec => ({
  kind: "dealDamage",
  target: { kind: "identityOf", player: { kind: "controller" } },
  amount: { kind: "const", value: n },
});
/** "Forced Interrupt: When the round ends, …" and "… When the villain phase ends, …", on a support. */
const ROUND_END = stubAbility("listener.round-end", {
  trigger: { kind: "interrupt", forced: true, on: { on: "phaseEnding", eventIs: { phase: ["round"] } } },
  effects: [hit(1)],
});
const VILLAIN_END = stubAbility("listener.villain-end", {
  trigger: { kind: "interrupt", forced: true, on: { on: "phaseEnding", eventIs: { phase: "villain" } } },
  effects: [hit(1)],
});
const PLAYER_BEGINS = stubAbility("listener.player-begins", {
  trigger: { kind: "interrupt", forced: true, on: { on: "phaseBeginning", eventIs: { phase: "player" } } },
  effects: [hit(1)],
});
const LISTENER = stubSupport({
  id: "listener",
  cost: 0,
  abilities: [ROUND_END.ref, VILLAIN_END.ref, PLAYER_BEGINS.ref],
});
/** "When the villain phase or the round ends, …": each listed phase heard on its own (PR #923 review). */
const VILLAIN_OR_ROUND = stubAbility("listener.villain-or-round", {
  trigger: { kind: "interrupt", forced: true, on: { on: "phaseEnding", eventIs: { phase: ["villain", "round"] } } },
  effects: [hit(1)],
});
const EITHER_LISTENER = stubSupport({ id: "either-listener", cost: 0, abilities: [VILLAIN_OR_ROUND.ref] });
/** "At the end of the round, deal 1 damage to your hero." and "Skip the next villain phase." */
const DELAYED = stubAbility("delayed.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "atEndOfRound", effects: [hit(1)] }],
});
const DELAYED_CARD = stubEvent({ id: "delayed", cost: 0, abilities: [DELAYED.ref] });
const SKIP = stubAbility("skip.action", { trigger: { kind: "action" }, effects: [{ kind: "skipNextVillainPhase" }] });
const SKIP_CARD = stubEvent({ id: "skip", cost: 0, abilities: [SKIP.ref] });
/** "Action (once per phase): …" */
const ONCE = stubAbility("once.action", {
  trigger: { kind: "action" },
  limit: { count: 1, period: "phase" },
  effects: [],
});
const ONCE_CARD = stubSupport({ id: "once", cost: 0, abilities: [ONCE.ref] });

const deps: EngineDeps = depsOf(ROUND_END, VILLAIN_END, PLAYER_BEGINS, VILLAIN_OR_ROUND, DELAYED, SKIP, ONCE);
const CARDS = [LISTENER, DELAYED_CARD, SKIP_CARD, ONCE_CARD];
const game = (sizes: readonly [number, number] = [1, 1], extra: readonly CardId[] = []): GameState =>
  competitiveGame({
    sizes,
    deps,
    extraCards: [...CARDS, EITHER_LISTENER],
    deck: [...DEFAULT_DECK, ...CARDS.flatMap((c) => [c.id, c.id]), ...extra],
  });

/** Ends turns (answering every choice by default) until the next round's first turn; returns every event. */
function finishRound(state: GameState): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  let session: GameSession = startSession(state);
  const events: GameEvent[] = [];
  const round = state.round;
  for (let guard = 0; !(session.state.round === round + 1 && session.state.step.kind === "turn"); guard++) {
    if (guard > 300) throw new Error("the round did not finish");
    const s = session.state;
    const choice = s.pendingChoice;
    const result = sessionApply(
      session,
      choice
        ? {
            type: "resolveChoice",
            playerId: choice.playerId,
            choiceId: choice.choiceId,
            selectedOptionIds: defaultPick(s),
          }
        : { type: "endTurn", playerId: (s.step as { activePlayerId: PlayerId }).activePlayerId },
      deps,
    );
    if (!result.ok) throw new Error(result.error.message);
    session = result.session;
    events.push(...result.events);
  }
  return { state: session.state, events };
}

const handoverToTeamTwoVillain = (events: readonly GameEvent[]): number => {
  const index = events.findIndex(
    (event) => event.type === "activeTeamChanged" && event.teamId === TEAM_TWO && event.phase === "villain",
  );
  expect(index).toBeGreaterThan(0);
  return index;
};

const resolvedBy = (events: readonly GameEvent[], abilityId: string) =>
  events.flatMap((event) =>
    event.type === "abilityResolved" && event.abilityId === abilityId ? [event.controllerId] : [],
  );

describe("phase begin and end are heard on the active side only; the round's end on both (item 3, A)", () => {
  let state = game();
  for (const player of [P1, P2]) state = playerCardIntoPlay(state, LISTENER.id, player).state;
  const { events } = finishRound(state);

  it("'when the villain phase ends' is heard once per side, at that side's own villain phase", () => {
    expect(resolvedBy(events, VILLAIN_END.ref.id)).toEqual([P1, P2]);
  });

  it("'when the round ends' is not heard at team one's villain phase end, and heard by both sides at the round's end", () => {
    const rounds = resolvedBy(events, ROUND_END.ref.id);
    expect(rounds.sort()).toEqual([P1, P2]);
    const teamTwoVillain = events.findIndex(
      (event) => event.type === "activeTeamChanged" && event.teamId === TEAM_TWO && event.phase === "villain",
    );
    const firstRoundEnd = events.findIndex(
      (event) => event.type === "abilityResolved" && event.abilityId === ROUND_END.ref.id,
    );
    expect(firstRoundEnd).toBeGreaterThan(teamTwoVillain);
  });

  it("['round'] is heard only at the round's end, after the second team's villain phase, by both sides", () => {
    const teamTwoVillain = handoverToTeamTwoVillain(events);
    expect(resolvedBy(events.slice(0, teamTwoVillain), ROUND_END.ref.id)).toEqual([]);
    expect(resolvedBy(events.slice(teamTwoVillain), ROUND_END.ref.id).sort()).toEqual([P1, P2]);
  });

  it("['villain', 'round'] hears both teams' villain phases ending: the first through 'villain', the last as the round's end", () => {
    let both = game([1, 1], [EITHER_LISTENER.id]);
    for (const player of [P1, P2]) both = playerCardIntoPlay(both, EITHER_LISTENER.id, player).state;
    const heard = finishRound(both).events;
    const teamTwoVillain = handoverToTeamTwoVillain(heard);
    // Team one's villain phase ends with the round going on: heard on its own side, as a villain phase's end.
    expect(resolvedBy(heard.slice(0, teamTwoVillain), VILLAIN_OR_ROUND.ref.id)).toEqual([P1]);
    // Team two's ends the round: the round's end is heard on both sides, each card once.
    expect(resolvedBy(heard.slice(teamTwoVillain), VILLAIN_OR_ROUND.ref.id).sort()).toEqual([P1, P2]);
  });

  it("'when the player phase begins' is heard by the team whose phase it is", () => {
    // Team two's hero phase in round 1, then team one's in round 2 (team one's round 1 began at setup's end).
    expect(resolvedBy(events, PLAYER_BEGINS.ref.id)).toEqual([P2, P1]);
  });
});

describe("the shared round's records", () => {
  it("fires an 'at the end of the round' effect once, after the fourth phase", () => {
    const given = giveCard(game(), P1, DELAYED_CARD.id);
    const played = applyCommand(
      given.state,
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      deps,
    );
    if (!played.ok) throw new Error(played.error.message);
    const identity = played.state.players[0]!.identity.instanceId;
    const before = mustInstance(played.state, identity).damage;
    const { state, events } = finishRound(played.state);
    const fired = events.filter((event) => event.type === "lastingEffectEnded" && event.reason === "fired");
    expect(fired).toHaveLength(1);
    const teamTwoVillain = events.findIndex(
      (event) => event.type === "activeTeamChanged" && event.teamId === TEAM_TWO && event.phase === "villain",
    );
    expect(events.indexOf(fired[0]!)).toBeGreaterThan(teamTwoVillain);
    // The delayed damage plus whatever the leader's attack dealt; the delayed part is exactly once.
    expect(mustInstance(state, identity).damage).toBeGreaterThanOrEqual(before + 1);
  });

  it("resets once-per-phase limits at the handover", () => {
    const placed = playerCardIntoPlay(game(), ONCE_CARD.id, P1);
    const use = (s: GameState) =>
      applyCommand(
        s,
        { type: "useAbility", playerId: P1, cardInstanceId: placed.id, abilityId: ONCE.ref.id, payment: [] },
        deps,
      );
    const used = use(placed.state);
    if (!used.ok) throw new Error(used.error.message);
    expect(use(used.state)).toMatchObject({ ok: false, error: { code: "limit_reached" } });
    const next = finishRound(used.state).state;
    expect(use(next).ok).toBe(true);
  });

  it("refuses 'skip the next villain phase' with two teams, so no team loses or gains a phase (review item 4)", () => {
    const given = giveCard(game(), P1, SKIP_CARD.id);
    const played = applyCommand(
      given.state,
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      deps,
    );
    if (!played.ok) throw new Error(played.error.message);
    expect(played.state.villainPhasesToSkip).toBeUndefined();
    const marks = finishRound(played.state).events.flatMap((e) =>
      e.type === "activeTeamChanged" ? [`${e.teamId} ${e.phase}`] : [],
    );
    expect(marks).toEqual([`${TEAM_TWO} player`, `${TEAM_ONE} villain`, `${TEAM_TWO} villain`, `${TEAM_ONE} player`]);
  });
});

describe("tokens and decks of each side", () => {
  it("passes the inactive team's token to the teammate when its holder is eliminated (2v2)", () => {
    const ctx = createCtx(game([2, 2]), deps);
    eliminatePlayer(ctx, P3);
    expect(ctx.state.teams?.map((team) => team.firstPlayerId)).toEqual([P1, P4]);
    expect(ctx.state.firstPlayerId).toBe(P1);
  });

  it("places the acceleration token of a reset deck on the main scheme of that deck's area (review blocker 1)", () => {
    const state = game();
    const [, leaderTwo] = state.villains;
    const deckId = leaderTwo!.encounterDeckId;
    const piles = state.encounterDecks[deckId]!;
    const emptied: GameState = {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { deck: [], discard: [...piles.deck, ...piles.discard] } },
    };
    const ctx = createCtx(emptied, deps);
    expect(resetEncounterDeckIfEmpty(ctx, deckId)).toBe(true);
    const [schemeOne, schemeTwo] = sharedMainSchemes(ctx.state);
    expect([schemeOne!.accelerationTokens, schemeTwo!.accelerationTokens]).toEqual([0, 1]);
  });

  it("gives each card's own side's first player (review item 5)", () => {
    const state = game([2, 2]);
    const [leaderOne, leaderTwo] = state.villains;
    expect(firstPlayerOfCard(state, leaderOne!.instanceId)).toBe(P1);
    expect(firstPlayerOfCard(state, leaderTwo!.instanceId)).toBe(P3);
  });

  it("a card in an encounter deck still counts the whole table in a game of one team with separate areas", () => {
    const coop = newGame({ players: 2 });
    const split: GameState = {
      ...coop,
      gameAreas: [
        {
          areaId: gameAreaId("a1"),
          playerIds: [P1],
          mainScheme: null,
          villainIds: [coop.activeVillainId],
          activeVillainId: coop.activeVillainId,
          sideSchemeIds: [],
          formerSchemeIds: [],
        },
      ],
      nextGameAreaSeq: 2,
    };
    const inDeck = split.encounterDecks[split.encounterDeckOrder[0]!]!.deck[0]!;
    expect(perPlayerCountAt(split, inDeck)).toBe(2);
  });
});
