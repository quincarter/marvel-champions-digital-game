/**
 * Cross-area primitives of a game with two teams (docs/competitive-mode-plan.md milestone M3, second part): held boost
 * cards on a leader-versus-leader attack, decisions and decks read for the card's own side, defenders from the attacked
 * player's team only, a lasting effect made in the other team's phase, and a spend priced by a card's cost.
 *
 * Sources: MC56 pp. 16-17, 20 (scenario rules override RRG per Golden Rule, RRG p. 4); Q3 B, Q11 A, N1 per owner
 * decision 2026-11-20; RRG v1.8 Attack (Enemy Activation) p. 8 step 1 (only a villain or villainous minion gets a boost).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { applyCommand, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type PlayerId } from "./ids.js";
import { mustInstance } from "./query.js";
import { legalDefenders } from "./resolve/enemy-activation.js";
import { effectEncounterDeckId, type EffectContext } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { DEFAULT_DECK, defaultPick, giveCard } from "./testing/scenario.js";
import { competitiveGame, TEAM_TWO } from "./testing/team.js";
import { playerCardIntoPlay } from "./testing/wave3.js";
import { encounterTargetSelector, simultaneousOrderer } from "./villain/authority.js";

const [P1, P2, P3, P4] = ["p1", "p2", "p3", "p4"].map(playerId) as [PlayerId, PlayerId, PlayerId, PlayerId];

const leaderAttack = (boost: true | "held" | null): EffectSpec => ({
  kind: "enemyAttacksEnemy",
  attacker: { kind: "leader", of: "yours" },
  target: { kind: "leader", of: "enemy" },
  ...(boost ? { boost } : {}),
});
const giveHeldBoost: EffectSpec = { kind: "giveBoostCard", enemy: { kind: "leader", of: "yours" } };
const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const HELD = action("held", [giveHeldBoost, leaderAttack("held")]);
const DEALT = action("dealt", [giveHeldBoost, leaderAttack(true)]);
const NONE = action("none", [leaderAttack(null)]);
const PRICED = action("priced", [
  {
    kind: "spendResources",
    player: { kind: "controller" },
    resources: { generic: 1 },
    bind: "paid",
    times: { kind: "const", value: 3 },
  },
]);
/**
 * "Forced Response: After an enemy attacks, your identity gains retaliate 1 until the end of the phase." The attacker's
 * query reaches the other team's area (`anyGameArea`): without it p1's card would not hear leader two attack p2, an
 * event wholly on the other side of the table (MC56 pp. 16-17; `heardOnThisSide`), and this test needs a lasting
 * effect p1 makes in team two's phase.
 */
const RETALIATE = stubAbility("retaliate.response", {
  trigger: { kind: "response", forced: true, on: { on: "enemyAttack", sourceIs: { anyGameArea: true } } },
  effects: [
    {
      kind: "grantKeywordUntil",
      keyword: { name: "retaliate", value: 1 },
      target: { kind: "identityOf", player: { kind: "controller" } },
      until: "endOfPhase",
    },
  ],
});
const RETALIATE_CARD = stubSupport({ id: "retaliate", cost: 0, abilities: [RETALIATE.ref] });

const EVENTS = [HELD, DEALT, NONE, PRICED];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability), RETALIATE);
const CARDS = [...EVENTS.map((e) => e.card), RETALIATE_CARD];
const game = (sizes: readonly [number, number] = [1, 1]): GameState =>
  competitiveGame({ sizes, deps, extraCards: CARDS, deck: [...DEFAULT_DECK, ...CARDS.flatMap((c) => [c.id, c.id])] });

function play(state: GameState, card: string, player: PlayerId = P1) {
  const given = giveCard(state, player, card);
  const result = applyCommand(
    given.state,
    { type: "playCard", playerId: player, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

/** Answers choices by default until none is open, collecting the events. */
function settled(state: GameState, events: readonly GameEvent[] = []) {
  let session: GameSession = startSession(state);
  const all = [...events];
  for (let guard = 0; session.state.pendingChoice; guard++) {
    if (guard > 100) throw new Error("did not settle");
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
    all.push(...result.events);
  }
  return { state: session.state, events: all };
}

const flipped = (events: readonly GameEvent[]) => events.filter((event) => event.type === "boostCardFlipped");

describe("boost cards on a leader-versus-leader attack (owner question pending, built at A)", () => {
  // Leader two is p1's leader; each deck's treachery has 1 boost icon; leader ATK 2.
  const run = (card: string) => {
    const played = play(game(), card);
    const done = settled(played.state, played.events);
    const [leaderOne] = done.state.villains;
    return { damage: mustInstance(done.state, leaderOne!.instanceId).damage, flips: flipped(done.events).length };
  };

  it("'do not give it a boost card' (held): no card dealt, the one already facedown on it is turned (2 + 1)", () => {
    expect(run(HELD.card.id)).toEqual({ damage: 3, flips: 1 });
  });

  it("an ordinary leader attack: its own card and the held one are both turned (2 + 1 + 1)", () => {
    expect(run(DEALT.card.id)).toEqual({ damage: 4, flips: 2 });
  });

  it("no boost (Moondragon's attack): nothing is turned", () => {
    expect(run(NONE.card.id)).toEqual({ damage: 2, flips: 0 });
  });
});

describe("decisions and decks of a card's own side (Q11 A; MC56 p. 16)", () => {
  const state = game([2, 2]);

  it("an encounter card's first-player choice for a player goes to that player's team's first player", () => {
    expect(encounterTargetSelector(state, { playerId: P2 })).toBe(P1);
    expect(encounterTargetSelector(state, { playerId: P4 })).toBe(P3);
    expect(simultaneousOrderer(state, { playerId: P3 })).toBe(P3);
    // With no side named, the active team's first player (N2).
    expect(simultaneousOrderer(state)).toBe(state.firstPlayerId);
  });

  it("'the encounter deck' of an effect is the deck of its own side", () => {
    const [one, two] = state.villains;
    const context = (controllerId: PlayerId): EffectContext => ({
      selfInstanceId: null,
      controllerId,
      event: null,
      bindings: {},
      deps,
    });
    expect(effectEncounterDeckId(state, context(P1))).toBe(one!.encounterDeckId);
    expect(effectEncounterDeckId(state, context(P4))).toBe(two!.encounterDeckId);
  });

  it("only the attacked player's team may defend", () => {
    const heroes = state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } }));
    const all = { ...state, players: heroes } as GameState;
    const identity = (p: PlayerId) => all.players.find((x) => x.playerId === p)!.identity.instanceId;
    expect([...legalDefenders(all, P1, deps)].sort()).toEqual([identity(P1), identity(P2)].sort());
    expect([...legalDefenders(all, P3, deps)].sort()).toEqual([identity(P3), identity(P4)].sort());
  });
});

describe("a lasting effect made in the other team's phase (Cuts Both Ways 56050, the rules expert's reading)", () => {
  it("'until the end of the phase' ends with that phase, the other team's villain phase", () => {
    let state = game();
    state = playerCardIntoPlay(state, RETALIATE_CARD.id, P1).state;
    // p1 in alter-ego form (leader one schemes), p2 in hero form (leader two attacks p2 in team two's villain phase).
    state = {
      ...state,
      players: state.players.map((p) => ({
        ...p,
        identity: { ...p.identity, form: p.playerId === P1 ? ("alterEgo" as const) : ("hero" as const) },
      })),
    };
    let session = startSession(state);
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
    const teamTwoVillain = events.findIndex(
      (e) => e.type === "activeTeamChanged" && e.teamId === TEAM_TWO && e.phase === "villain",
    );
    const added = events.findIndex((e, i) => i > teamTwoVillain && e.type === "lastingEffectAdded");
    expect(added).toBeGreaterThan(teamTwoVillain);
    const id = (events[added] as Extract<GameEvent, { type: "lastingEffectAdded" }>).effect.id;
    const ended = events.findIndex((e) => e.type === "lastingEffectEnded" && e.id === id);
    const nextRound = events.findIndex((e, i) => i > teamTwoVillain && e.type === "activeTeamChanged");
    expect(ended).toBeGreaterThan(added);
    expect(ended).toBeLessThan(nextRound);
    expect(session.state.lastingEffects).toEqual([]);
  });
});

describe("a spend priced by a value (Switching Sides 56158: 'resources equal to that ally's cost')", () => {
  it("asks for the price of one taken that many times", () => {
    const played = play(game(), PRICED.card.id);
    expect(played.state.pendingChoice?.prompt).toMatchObject({ kind: "spendResources", requirement: { generic: 3 } });
  });
});
