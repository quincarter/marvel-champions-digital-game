/**
 * "Skip the next villain phase", "start another player phase" in its place and "until the start of the next
 * (unskipped) villain phase" with two teams (PR #923 review, P1 on `flow.ts` `executeTeamHandover`).
 *
 * Sources, settled by the rules expert for PR #923: MC56 pp. 16, 20 (each side's abilities ignore the other side; each
 * team plays its own villain phase) and N8 (owner decision 2026-11-20): skips, replacements and "until the next villain
 * phase begins" are the creating team's. A skipped phase never begins (Run Them to Ground 61020 "(unskipped)"; Q101 A,
 * docs/phase7-wave11-hero-packs.md H3.7/H3.8; RRG 1.8 "Lasting Effects", p. 26). The cooperative behaviour is
 * `skip-next-villain-phase.test.ts` and `extra-player-phase.test.ts`, unchanged.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { recordTeamCondition } from "./competitive-outcome.js";
import { createCtx } from "./ctx.js";
import { applyCommand, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type PlayerId } from "./ids.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { runFlow } from "./flow.js";
import { pushEffects } from "./resolve/frames.js";
import { creatingTeamOf } from "./team-phases.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { DEFAULT_DECK, defaultPick, giveCard } from "./testing/scenario.js";
import { competitiveGame, TEAM_ONE, TEAM_TWO } from "./testing/team.js";
import { playerCardIntoPlay } from "./testing/wave3.js";

const [P1, P2] = ["p1", "p2"].map(playerId) as [PlayerId, PlayerId];

const action = (id: string, ...effects: EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Skip the next villain phase." */
const SKIP = action("skip", { kind: "skipNextVillainPhase" });
/** "Start another player phase" in place of the next villain phase. */
const REPLACE = action("replace", { kind: "replaceNextVillainPhaseWithPlayerPhase" });
/** "At the end of the phase, start another player phase" in place of the next villain phase. */
const LATER = action("later", {
  kind: "atEndOfPhase",
  effects: [{ kind: "replaceNextVillainPhaseWithPlayerPhase" }],
});
/** Run Them to Ground's third bullet: "The villain cannot take damage until the start of the next (unskipped) villain phase." */
const WARD = action("ward", {
  kind: "applyRuleUntil",
  rule: { kind: "cannotTakeDamage", target: { categories: ["villain"] } },
  until: "nextVillainPhaseBegins",
});
/** "Forced Interrupt: When the villain phase begins, …" and "… ends, …", on a support. */
const VILLAIN_BEGINS = stubAbility("watcher.villain-begins", {
  trigger: { kind: "interrupt", forced: true, on: { on: "phaseBeginning", eventIs: { phase: "villain" } } },
  effects: [],
});
const VILLAIN_ENDS = stubAbility("watcher.villain-ends", {
  trigger: { kind: "interrupt", forced: true, on: { on: "phaseEnding", eventIs: { phase: "villain" } } },
  effects: [],
});
const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: [VILLAIN_BEGINS.ref, VILLAIN_ENDS.ref] });
/** "Forced Interrupt: When the villain phase begins, <effect>, then remove this card from the game." */
const atBeginning = (id: string, effect: EffectSpec) => {
  const ability = stubAbility(`${id}.interrupt`, {
    trigger: { kind: "interrupt", forced: true, on: { on: "phaseBeginning", eventIs: { phase: "villain" } } },
    effects: [effect, { kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "removedFromGame" }],
  });
  return { card: stubSupport({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const DAWN_SKIP = atBeginning("dawn-skip", { kind: "skipNextVillainPhase" });
const DAWN_REPLACE = atBeginning("dawn-replace", { kind: "replaceNextVillainPhaseWithPlayerPhase" });
const DAWN_WARD = atBeginning("dawn-ward", WARD.ability.definition.effects[0]!);
/** Out of the Game's shape: cancel the villain phase's beginning, remove itself, play a player phase instead. */
const OUT = atBeginning("cancel", { kind: "cancelTriggeringEvent" });
const OUT_AND_REPLACE = stubAbility("out.replace", {
  ...OUT.ability.definition,
  effects: [...OUT.ability.definition.effects, { kind: "replaceNextVillainPhaseWithPlayerPhase" }],
});
const OUT_CARD = stubSupport({ id: "out-of-the-game", cost: 0, abilities: [OUT_AND_REPLACE.ref] });
/** Only the cancel: "When the villain phase begins, cancel it", with no phase in its place. */
const CANCEL_CARD = OUT.card;

const deps: EngineDeps = depsOf(
  SKIP.ability,
  REPLACE.ability,
  LATER.ability,
  WARD.ability,
  VILLAIN_BEGINS,
  VILLAIN_ENDS,
  DAWN_SKIP.ability,
  DAWN_REPLACE.ability,
  DAWN_WARD.ability,
  OUT_AND_REPLACE,
  OUT.ability,
);
const CARDS = [
  SKIP.card,
  REPLACE.card,
  LATER.card,
  WARD.card,
  WATCHER,
  DAWN_SKIP.card,
  DAWN_REPLACE.card,
  DAWN_WARD.card,
  OUT_CARD,
  CANCEL_CARD,
];

/** A 1v1 game (P1 team one, P2 team two) at team one's first turn, each player with the watcher in play. */
function game(): GameState {
  let state = competitiveGame({
    sizes: [1, 1],
    deps,
    extraCards: CARDS,
    deck: [...DEFAULT_DECK, ...CARDS.flatMap((card) => [card.id, card.id])],
  });
  for (const player of [P1, P2]) state = playerCardIntoPlay(state, WATCHER.id, player).state;
  return state;
}

/** Ends turns (answering every choice by default) until `done` holds; returns every event on the way. */
function advance(
  state: GameState,
  done: (state: GameState) => boolean,
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  let session: GameSession = startSession(state);
  const events: GameEvent[] = [];
  for (let guard = 0; !done(session.state); guard++) {
    if (guard > 400) throw new Error("the game did not get there");
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

const turnOf = (player: PlayerId, round: number) => (s: GameState) =>
  s.round === round && s.step.kind === "turn" && s.step.activePlayerId === player && !s.pendingChoice;

/** `player` plays each of `cards` (free events) now. */
function play(state: GameState, player: PlayerId, ...cards: readonly { readonly id: string }[]): GameState {
  let current = state;
  for (const card of cards) {
    const given = giveCard(current, player, card.id);
    const played = applyCommand(
      given.state,
      { type: "playCard", playerId: player, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      deps,
    );
    if (!played.ok) throw new Error(played.error.message);
    current = played.state;
  }
  return current;
}

const resolvedBy = (events: readonly GameEvent[], abilityId: string) =>
  events.flatMap((event) =>
    event.type === "abilityResolved" && event.abilityId === abilityId ? [event.controllerId] : [],
  );
const marks = (events: readonly GameEvent[]) =>
  events.flatMap((event) => (event.type === "activeTeamChanged" ? [`${event.teamId} ${event.phase}`] : []));
const wards = (state: GameState) =>
  state.lastingEffects.filter((effect) => effect.duration.kind === "nextVillainPhaseBegins");
const wardEnded = (events: readonly GameEvent[], id: string) =>
  events.findIndex((event) => event.type === "lastingEffectEnded" && event.id === id);
const handoverTo = (events: readonly GameEvent[], team: string, phase: "player" | "villain") =>
  events.findIndex((event) => event.type === "activeTeamChanged" && event.teamId === team && event.phase === phase);

describe("a skip from team one's hero phase", () => {
  const played = play(game(), P1, WARD.card, SKIP.card);
  const [ward] = wards(played);
  const round1 = advance(played, turnOf(P1, 2));
  const round2 = advance(round1.state, turnOf(P1, 3));

  it("belongs to team one: its count is kept per team, the shared one unused", () => {
    expect(played.villainPhasesToSkipByTeam).toEqual({ [TEAM_ONE]: 1 });
    expect(played.villainPhasesToSkip).toBeUndefined();
    expect(ward?.duration).toEqual({ kind: "nextVillainPhaseBegins", teamId: TEAM_ONE });
  });

  it("skips team one's villain phase only: it never begins or ends, and team two's runs", () => {
    const skipped = round1.events.filter((event) => event.type === "villainPhaseSkipped");
    expect(skipped).toEqual([{ type: "villainPhaseSkipped", round: 1, remaining: 0, teamId: TEAM_ONE }]);
    expect(resolvedBy(round1.events, VILLAIN_BEGINS.ref.id)).toEqual([P2]);
    expect(resolvedBy(round1.events, VILLAIN_ENDS.ref.id)).toEqual([P2]);
    expect(round1.state.villainPhasesToSkipByTeam).toBeUndefined();
  });

  it("keeps team one's ward through team two's villain phase, to team one's next unskipped one", () => {
    expect(wardEnded(round1.events, ward!.id)).toBe(-1);
    expect(wards(round1.state).map((effect) => effect.id)).toEqual([ward!.id]);
    const ended = wardEnded(round2.events, ward!.id);
    const teamOneVillain = handoverTo(round2.events, TEAM_ONE, "villain");
    expect(teamOneVillain).toBeGreaterThan(0);
    expect(ended).toBeGreaterThan(teamOneVillain);
    expect(ended).toBeLessThan(handoverTo(round2.events, TEAM_TWO, "villain"));
  });

  it("is used up: both villain phases of the next round are played", () => {
    expect(resolvedBy(round2.events, VILLAIN_BEGINS.ref.id)).toEqual([P1, P2]);
    expect(round2.events.some((event) => event.type === "villainPhaseSkipped")).toBe(false);
  });
});

describe("a skip from team two's hero phase", () => {
  const atTeamTwo = advance(play(game(), P1, WARD.card), turnOf(P2, 1)).state;
  const [teamOneWard] = wards(atTeamTwo);
  const played = play(atTeamTwo, P2, WARD.card, SKIP.card);
  const teamTwoWard = wards(played).find((effect) => effect.id !== teamOneWard!.id);
  const round1 = advance(played, turnOf(P1, 2));
  const round2 = advance(round1.state, turnOf(P1, 3));

  it("belongs to team two, made in team two's phase", () => {
    expect(played.villainPhasesToSkipByTeam).toEqual({ [TEAM_TWO]: 1 });
    expect(teamTwoWard?.duration).toEqual({ kind: "nextVillainPhaseBegins", teamId: TEAM_TWO });
  });

  it("leaves team one's villain phase alone, skips team two's, and the round still ends", () => {
    expect(resolvedBy(round1.events, VILLAIN_BEGINS.ref.id)).toEqual([P1]);
    expect(resolvedBy(round1.events, VILLAIN_ENDS.ref.id)).toEqual([P1]);
    const skipped = round1.events.filter((event) => event.type === "villainPhaseSkipped");
    expect(skipped).toEqual([{ type: "villainPhaseSkipped", round: 1, remaining: 0, teamId: TEAM_TWO }]);
    expect(round1.state.round).toBe(2);
  });

  it("ends team one's ward at team one's villain phase, and keeps team two's to team two's next unskipped one", () => {
    expect(wardEnded(round1.events, teamOneWard!.id)).toBeGreaterThan(handoverTo(round1.events, TEAM_ONE, "villain"));
    expect(wardEnded(round1.events, teamTwoWard!.id)).toBe(-1);
    const ended = wardEnded(round2.events, teamTwoWard!.id);
    expect(ended).toBeGreaterThan(handoverTo(round2.events, TEAM_TWO, "villain"));
  });
});

describe("'until the next villain phase begins' without a skip", () => {
  it("made by team two, outlasts team one's villain phase and ends at team two's", () => {
    const atTeamTwo = advance(game(), turnOf(P2, 1)).state;
    const played = play(atTeamTwo, P2, WARD.card);
    const [ward] = wards(played);
    const { events } = advance(played, turnOf(P1, 2));
    const ended = wardEnded(events, ward!.id);
    expect(ended).toBeGreaterThan(handoverTo(events, TEAM_TWO, "villain"));
  });
});

describe("a player phase in place of a team's villain phase", () => {
  const turnsIn = (events: readonly GameEvent[]) =>
    events.flatMap((event) => (event.type === "turnStarted" ? [event.playerId] : []));

  it("from team one's hero phase: team one plays a player phase, then its villain phase, then team two's", () => {
    const played = play(game(), P1, REPLACE.card);
    expect(played.villainPhasesReplacedByTeam).toEqual({ [TEAM_ONE]: 1 });
    expect(played.villainPhasesReplacedByPlayerPhase).toBeUndefined();
    const { state, events } = advance(played, turnOf(P1, 2));
    expect(marks(events)).toEqual([
      `${TEAM_TWO} player`,
      `${TEAM_ONE} player`,
      `${TEAM_ONE} villain`,
      `${TEAM_TWO} villain`,
      `${TEAM_ONE} player`,
    ]);
    // P2's hero phase, P1's extra one, then round 2's first turn.
    expect(turnsIn(events)).toEqual([P2, P1, P1]);
    expect(resolvedBy(events, VILLAIN_BEGINS.ref.id)).toEqual([P1, P2]);
    expect(state.villainPhasesReplacedByTeam).toBeUndefined();
    expect(state.playerPhaseInsteadTeamId).toBeUndefined();
  });

  it("from team two's hero phase: team one's villain phase runs, then team two plays a player phase and its own", () => {
    const atTeamTwo = advance(game(), turnOf(P2, 1)).state;
    const played = play(atTeamTwo, P2, REPLACE.card);
    expect(played.villainPhasesReplacedByTeam).toEqual({ [TEAM_TWO]: 1 });
    const { events } = advance(played, turnOf(P1, 2));
    expect(marks(events)).toEqual([
      `${TEAM_ONE} villain`,
      `${TEAM_TWO} player`,
      `${TEAM_TWO} villain`,
      `${TEAM_ONE} player`,
    ]);
    expect(turnsIn(events)).toEqual([P2, P1]);
    expect(resolvedBy(events, VILLAIN_BEGINS.ref.id)).toEqual([P1, P2]);
  });
});

describe("the creating team", () => {
  it("is the controller's team, whichever team is active (an inactive team's trigger)", () => {
    const state = game();
    expect(state.activeTeamId).toBe(TEAM_ONE);
    expect(creatingTeamOf(state, P2, null)).toBe(TEAM_TWO);
    expect(creatingTeamOf(state, P1, null)).toBe(TEAM_ONE);
  });

  it("is the card's area's team for an encounter card, and nobody's in a game with no active team", () => {
    const state = game();
    expect(creatingTeamOf(state, null, state.villains[1]!.instanceId)).toBe(TEAM_TWO);
    const { activeTeamId: _active, ...noActive } = state;
    expect(creatingTeamOf(noActive, P2, null)).toBeNull();
  });
});

/** Records `team`'s result now, as a defeated enemy leader would (MC56 p. 17). */
function result(state: GameState, team: typeof TEAM_ONE): GameState {
  const ctx = createCtx(state, deps);
  recordTeamCondition(ctx, team, "enemyLeaderDefeated");
  return ctx.state;
}
/**
 * A result recorded during team one's villain phase, as `recordTeamCondition` writes it then: the window closes after
 * the last team's villain phase of the round. Written straight onto the state, since the drive cannot stop mid-phase.
 */
const resultInTeamOneVillainPhase = (state: GameState): GameState => ({
  ...state,
  competitive: {
    ...(state.competitive ?? { tieBreaks: true }),
    end: {
      triggers: [
        { teamId: TEAM_ONE, condition: "enemyLeaderDefeated", round: 1, phase: "villain", activeTeamId: TEAM_ONE },
      ],
      closesAfter: { teamId: TEAM_TWO, round: 1, phase: "villain" },
    },
  },
});
const over = (s: GameState) => s.outcome != null;
const ended = (events: readonly GameEvent[]) => events.findIndex((event) => event.type === "gameEnded");
const insteadTurn = (team: typeof TEAM_ONE) => (s: GameState) =>
  s.playerPhaseInsteadTeamId === team && s.step.kind === "turn" && !s.pendingChoice;

// A skipped villain phase or a player phase in its place fills that team's villain slot: see the MC56 p. 17 slot
// note at `flow.ts` `endPlayerPhaseInstead`.
describe("the MC56 p. 17 window with a team's villain slot replaced or skipped", () => {
  it("a result in team one's extra phase closes the game after team two's villain phase (review blocker)", () => {
    const extra = advance(play(game(), P1, REPLACE.card), insteadTurn(TEAM_ONE)).state;
    const recorded = result(extra, TEAM_ONE);
    expect(recorded.competitive?.end?.closesAfter).toEqual({ teamId: TEAM_TWO, round: 1, phase: "villain" });
    const { state, events } = advance(recorded, over);
    expect(state.round).toBe(1);
    expect(ended(events)).toBeGreaterThan(handoverTo(events, TEAM_TWO, "villain"));
    // Team one's own villain phase after its extra phase, then team two's, were both played.
    expect(resolvedBy(events, VILLAIN_BEGINS.ref.id)).toEqual([P1, P2]);
  });

  it("a result in team two's extra phase closes the game as that phase ends, before team two's villain phase", () => {
    const atTeamTwo = advance(game(), turnOf(P2, 1)).state;
    const extra = advance(play(atTeamTwo, P2, REPLACE.card), insteadTurn(TEAM_TWO)).state;
    const recorded = result(extra, TEAM_TWO);
    expect(recorded.competitive?.end?.closesAfter).toEqual({ teamId: TEAM_TWO, round: 1, phase: "villain" });
    const { state, events } = advance(recorded, over);
    expect(state.round).toBe(1);
    expect(ended(events)).toBeGreaterThan(-1);
    expect(resolvedBy(events, VILLAIN_BEGINS.ref.id)).toEqual([]);
  });

  it("a result in registration's villain phase: resistance's phase in its villain slot ends the game with it", () => {
    const atTeamTwo = advance(game(), turnOf(P2, 1)).state;
    const extra = advance(play(atTeamTwo, P2, REPLACE.card), insteadTurn(TEAM_TWO)).state;
    const { state, events } = advance(resultInTeamOneVillainPhase(extra), over);
    expect(state.round).toBe(1);
    const turnEnded = events.findIndex((event) => event.type === "turnEnded" && event.playerId === P2);
    expect(turnEnded).toBeGreaterThan(-1);
    expect(ended(events)).toBeGreaterThan(turnEnded);
    expect(resolvedBy(events, VILLAIN_BEGINS.ref.id)).toEqual([]);
    expect(events.some((event) => event.type === "activeTeamChanged" && event.phase === "villain")).toBe(false);
  });

  it("pins it: team two's skipped villain phase counts as played, so the window closes at the round's end", () => {
    const atTeamTwo = advance(game(), turnOf(P2, 1)).state;
    const skipping = play(atTeamTwo, P2, SKIP.card);
    const { state, events } = advance(resultInTeamOneVillainPhase(skipping), over);
    expect(state.round).toBe(1);
    expect(events.filter((event) => event.type === "villainPhaseSkipped")).toHaveLength(1);
    expect(resolvedBy(events, VILLAIN_BEGINS.ref.id)).toEqual([P1]);
    expect(ended(events)).toBeGreaterThan(-1);
  });
});

describe("the villain phase after a team's extra player phase is marked (review nit)", () => {
  it("logs activeTeamChanged with phase 'villain' for the team already active", () => {
    const { events } = advance(play(game(), P1, REPLACE.card), turnOf(P1, 2));
    const marked = events.findIndex(
      (event) => event.type === "activeTeamChanged" && event.teamId === TEAM_ONE && event.phase === "villain",
    );
    expect(marked).toBeGreaterThan(handoverTo(events, TEAM_ONE, "player"));
    expect(marked).toBeLessThan(handoverTo(events, TEAM_TWO, "villain"));
  });
});

describe("an encounter card's 'until the next villain phase begins' (review item 3)", () => {
  it("is the team of the area holding the card, resolved during the other team's phase", () => {
    const state = game();
    expect(state.activeTeamId).toBe(TEAM_ONE);
    const leaderTwo = state.villains[1]!.instanceId;
    const ctx = createCtx(state, deps);
    pushEffects(ctx, {
      effects: [{ kind: "blankTextBox", target: { kind: "self" }, until: "nextVillainPhaseBegins" }],
      selfInstanceId: leaderTwo,
      controllerId: P1,
    });
    runFlow(ctx);
    expect(wards(ctx.state).map((effect) => effect.duration)).toEqual([
      { kind: "nextVillainPhaseBegins", teamId: TEAM_TWO },
    ]);
  });
});

describe("a team's extra player phase whose villain phase is then skipped (review should-fix)", () => {
  it("team one: the flag clears at the handover, and only team two's villain phase is played and marked", () => {
    const played = play(game(), P1, REPLACE.card, SKIP.card);
    const { state, events } = advance(played, turnOf(P1, 2));
    expect(marks(events)).toEqual([
      `${TEAM_TWO} player`,
      `${TEAM_ONE} player`,
      `${TEAM_TWO} villain`,
      `${TEAM_ONE} player`,
    ]);
    expect(resolvedBy(events, VILLAIN_BEGINS.ref.id)).toEqual([P2]);
    expect(state.playerPhaseInsteadTeamId).toBeUndefined();
    expect(state.villainPhasesToSkipByTeam).toBeUndefined();
    expect(state.villainPhasesReplacedByTeam).toBeUndefined();
  });

  it("team two: the flag clears at the round's end, and only team one's villain phase is played and marked", () => {
    const atTeamTwo = advance(game(), turnOf(P2, 1)).state;
    const played = play(atTeamTwo, P2, REPLACE.card, SKIP.card);
    const { state, events } = advance(played, turnOf(P1, 2));
    expect(marks(events)).toEqual([`${TEAM_ONE} villain`, `${TEAM_TWO} player`, `${TEAM_ONE} player`]);
    expect(resolvedBy(events, VILLAIN_BEGINS.ref.id)).toEqual([P1]);
    expect(state.playerPhaseInsteadTeamId).toBeUndefined();
    expect(state.villainPhasesToSkipByTeam).toBeUndefined();
    expect(state.villainPhasesReplacedByTeam).toBeUndefined();
  });

  it("team two: a window naming its villain slot closes as the extra phase ends, before the skip is reached", () => {
    // The extra phase fills team two's villain slot (the MC56 p. 17 slot note at `flow.ts` `endPlayerPhaseInstead`),
    // and step one's place reads the close before a replacement or a skip (PR #923 review P1), as with no skip waiting.
    const atTeamTwo = advance(game(), turnOf(P2, 1)).state;
    const extra = advance(play(atTeamTwo, P2, REPLACE.card, SKIP.card), insteadTurn(TEAM_TWO)).state;
    const { state, events } = advance(resultInTeamOneVillainPhase(extra), over);
    expect(state.round).toBe(1);
    const turnEnded = events.findIndex((event) => event.type === "turnEnded" && event.playerId === P2);
    expect(turnEnded).toBeGreaterThan(-1);
    expect(ended(events)).toBeGreaterThan(turnEnded);
    expect(events.some((event) => event.type === "villainPhaseSkipped")).toBe(false);
    expect(resolvedBy(events, VILLAIN_BEGINS.ref.id)).toEqual([]);
    expect(state.playerPhaseInsteadTeamId).toBeUndefined();
  });
});

describe("a replacement made at the end of a team's extra player phase, with a skip waiting (review P1)", () => {
  const turnsIn = (events: readonly GameEvent[]) =>
    events.flatMap((event) => (event.type === "turnStarted" ? [event.playerId] : []));
  const skipped = (events: readonly GameEvent[]) =>
    events.flatMap((event) =>
      event.type === "villainPhaseSkipped"
        ? [`${event.teamId} ${event.playerPhaseInstead ? "replaced" : "skipped"}`]
        : [],
    );

  it("team one: the new replacement goes first, then the skip takes team one's villain slot, then team two's", () => {
    const extra = advance(play(game(), P1, REPLACE.card, SKIP.card), insteadTurn(TEAM_ONE)).state;
    const later = play(extra, P1, LATER.card);
    const { state, events } = advance(later, turnOf(P1, 2));
    expect(skipped(events)).toEqual([`${TEAM_ONE} replaced`, `${TEAM_ONE} skipped`]);
    // P1's second extra phase, then round 2's first turn.
    expect(turnsIn(events)).toEqual([P1, P1]);
    expect(resolvedBy(events, VILLAIN_BEGINS.ref.id)).toEqual([P2]);
    expect(
      events.some(
        (event) => event.type === "activeTeamChanged" && event.teamId === TEAM_ONE && event.phase === "villain",
      ),
    ).toBe(false);
    expect(state.playerPhaseInsteadTeamId).toBeUndefined();
    expect(state.villainPhasesToSkipByTeam).toBeUndefined();
    expect(state.villainPhasesReplacedByTeam).toBeUndefined();
  });

  it("team two: the new replacement goes first, then the skip takes team two's villain slot and the round ends", () => {
    const atTeamTwo = advance(game(), turnOf(P2, 1)).state;
    const extra = advance(play(atTeamTwo, P2, REPLACE.card, SKIP.card), insteadTurn(TEAM_TWO)).state;
    const later = play(extra, P2, LATER.card);
    const { state, events } = advance(later, turnOf(P1, 2));
    expect(skipped(events)).toEqual([`${TEAM_TWO} replaced`, `${TEAM_TWO} skipped`]);
    // P2's second extra phase, then round 2's first turn.
    expect(turnsIn(events)).toEqual([P2, P1]);
    expect(resolvedBy(events, VILLAIN_BEGINS.ref.id)).toEqual([]);
    expect(state.round).toBe(2);
    expect(state.playerPhaseInsteadTeamId).toBeUndefined();
    expect(state.villainPhasesToSkipByTeam).toBeUndefined();
    expect(state.villainPhasesReplacedByTeam).toBeUndefined();
  });
});

/**
 * PR #923 review P1: a request a team's villain phase beginning makes is for that team's *next* villain phase. The
 * team's skips and replacements are read before its phase begins (`executeTeamHandover`); once it has begun
 * (`VillainPhaseBegun`), a new one waits for the team's next villain slot, and the phase already open runs in full. A
 * skipped phase never begins (H3.7), so taking the open one would contradict that (and could end its own ward early).
 */
describe("a skip or replacement made as a team's villain phase begins (review P1)", () => {
  const skipped = (events: readonly GameEvent[]) =>
    events.flatMap((event) =>
      event.type === "villainPhaseSkipped"
        ? [`${event.teamId} ${event.playerPhaseInstead ? "replaced" : "skipped"}`]
        : [],
    );
  const threats = (events: readonly GameEvent[]) => events.filter((event) => event.type === "threatPlaced").length;
  const withCard = (player: PlayerId, card: (typeof CARDS)[number]) =>
    playerCardIntoPlay(game(), card.id, player).state;

  for (const [team, player] of [
    [TEAM_ONE, P1],
    [TEAM_TWO, P2],
  ] as const) {
    it(`${team}: a beginning-made skip lets the open villain phase run, and skips the team's next one`, () => {
      const round1 = advance(withCard(player, DAWN_SKIP.card), turnOf(P1, 2));
      expect(skipped(round1.events)).toEqual([]);
      expect(resolvedBy(round1.events, DAWN_SKIP.ability.ref.id)).toEqual([player]);
      expect(resolvedBy(round1.events, VILLAIN_BEGINS.ref.id)).toEqual([P1, P2]);
      expect(resolvedBy(round1.events, VILLAIN_ENDS.ref.id)).toEqual([P1, P2]);
      expect(threats(round1.events)).toBeGreaterThanOrEqual(2);
      expect(round1.state.villainPhasesToSkipByTeam).toEqual({ [team]: 1 });

      const round2 = advance(round1.state, turnOf(P1, 3));
      expect(skipped(round2.events)).toEqual([`${team} skipped`]);
      expect(resolvedBy(round2.events, VILLAIN_BEGINS.ref.id)).toEqual([team === TEAM_ONE ? P2 : P1]);
      expect(round2.state.villainPhasesToSkipByTeam).toBeUndefined();
    });

    it(`${team}: a beginning-made replacement lets the open villain phase run, and replaces the team's next one`, () => {
      const round1 = advance(withCard(player, DAWN_REPLACE.card), turnOf(P1, 2));
      expect(skipped(round1.events)).toEqual([]);
      expect(marks(round1.events)).toEqual([
        `${TEAM_TWO} player`,
        `${TEAM_ONE} villain`,
        `${TEAM_TWO} villain`,
        `${TEAM_ONE} player`,
      ]);
      expect(resolvedBy(round1.events, VILLAIN_ENDS.ref.id)).toEqual([P1, P2]);
      expect(round1.state.villainPhasesReplacedByTeam).toEqual({ [team]: 1 });
      expect(round1.state.playerPhaseInsteadTeamId).toBeUndefined();

      const round2 = advance(round1.state, turnOf(P1, 3));
      expect(skipped(round2.events)).toEqual([`${team} replaced`]);
      expect(marks(round2.events)).toEqual(
        team === TEAM_ONE
          ? [
              `${TEAM_TWO} player`,
              `${TEAM_ONE} player`,
              `${TEAM_ONE} villain`,
              `${TEAM_TWO} villain`,
              `${TEAM_ONE} player`,
            ]
          : [
              `${TEAM_TWO} player`,
              `${TEAM_ONE} villain`,
              `${TEAM_TWO} player`,
              `${TEAM_TWO} villain`,
              `${TEAM_ONE} player`,
            ],
      );
      expect(round2.state.villainPhasesReplacedByTeam).toBeUndefined();
    });
  }

  it("a ward team one's beginning makes lasts past step one, to team one's next villain phase", () => {
    const round1 = advance(withCard(P1, DAWN_WARD.card), turnOf(P1, 2));
    const [ward] = wards(round1.state);
    expect(ward?.duration).toEqual({ kind: "nextVillainPhaseBegins", teamId: TEAM_ONE });
    const round2 = advance(round1.state, turnOf(P1, 3));
    const ended = wardEnded(round2.events, ward!.id);
    expect(ended).toBeGreaterThan(handoverTo(round2.events, TEAM_ONE, "villain"));
    expect(ended).toBeLessThan(handoverTo(round2.events, TEAM_TWO, "villain"));
  });

  it("a cancelled beginning never began: a skip made in its window goes to the phase about to start (team one)", () => {
    // Both Forced Interrupts answer team one's beginning, the skip first: Out of the Game then cancels the beginning
    // (RRG 1.8 "Cancel", p. 11; "Replacement Effect", p. 37), so the skip is no longer noted as made since the phase
    // began. The new replacement goes first, then the skip takes team one's villain slot.
    let state = playerCardIntoPlay(game(), DAWN_SKIP.card.id, P1).state;
    state = playerCardIntoPlay(state, OUT_CARD.id, P1).state;
    const round1 = advance(state, turnOf(P1, 2));
    expect(skipped(round1.events)).toEqual([`${TEAM_ONE} replaced`, `${TEAM_ONE} skipped`]);
    // Team one was marked into its villain phase at the handover; the player phase in its place is not marked again.
    expect(marks(round1.events)).toEqual([
      `${TEAM_TWO} player`,
      `${TEAM_ONE} villain`,
      `${TEAM_TWO} villain`,
      `${TEAM_ONE} player`,
    ]);
    // P2's hero phase, P1's extra one, then round 2's first turn.
    expect(round1.events.flatMap((e) => (e.type === "turnStarted" ? [e.playerId] : []))).toEqual([P2, P1, P1]);
    expect(resolvedBy(round1.events, VILLAIN_ENDS.ref.id)).toEqual([P2]);
    expect(round1.state.villainPhasesToSkipByTeam).toBeUndefined();
    expect(round1.state.villainPhasesReplacedByTeam).toBeUndefined();
    expect(round1.state.madeSinceVillainPhaseBegan).toBeUndefined();
  });

  it("a cancelled beginning never began: a skip noted in its window before the cancel takes this phase (team one)", () => {
    // The skip resolves first and is noted as made since the phase began; the cancel then clears that, so the phase
    // about to start, whose beginning never occurred, is the one skipped (RRG 1.8 "Cancel", p. 11).
    let state = playerCardIntoPlay(game(), DAWN_SKIP.card.id, P1).state;
    state = playerCardIntoPlay(state, CANCEL_CARD.id, P1).state;
    const round1 = advance(state, turnOf(P1, 2));
    expect(resolvedBy(round1.events, DAWN_SKIP.ability.ref.id)).toEqual([P1]);
    expect(skipped(round1.events)).toEqual([`${TEAM_ONE} skipped`]);
    expect(resolvedBy(round1.events, VILLAIN_ENDS.ref.id)).toEqual([P2]);
    expect(round1.state.villainPhasesToSkipByTeam).toBeUndefined();
    expect(round1.state.madeSinceVillainPhaseBegan).toBeUndefined();
  });
});
