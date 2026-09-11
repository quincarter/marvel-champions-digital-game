import { flat, type AnyCard, type CardId } from "@mc/content";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { evaluate, resolvePlayers, selectTargets, type EffectContext } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMainScheme, stubMinion, stubResource, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { giveCards, newGame, resolvePending, RESOURCE, runWith, settle } from "./testing/scenario.js";

// Small, general primitives added while scripting the Core Set (docs/phase2-core-set.md §3 "added during scripting").
const p1 = playerId("p1");
const p2 = playerId("p2");
const def = (definition: AbilityDefinition) => definition;
const toHero = (player: PlayerId = p1): Command => ({ type: "changeForm", playerId: player });
const endTurn = (player: PlayerId = p1): Command => ({ type: "endTurn", playerId: player });
const play = (player: PlayerId, id: InstanceId): Command => ({ type: "playCard", playerId: player, cardInstanceId: id, payment: [], attachToInstanceId: null });
const copies = (id: CardId, n = 20): readonly CardId[] => Array.from({ length: n }, () => id);
const decline = (state: GameState): readonly string[] =>
  state.pendingChoice?.prompt.kind === "declareDefender" ? ["decline"] : (state.pendingChoice?.options.slice(0, state.pendingChoice.minSelections).map((o) => o.optionId) ?? []);

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const SCHEME = stubMainScheme({ id: "scheme", stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0) }] });
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const MENTAL = stubResource({ id: "mental", icons: 0, produces: { mental: 1 } });
const THUG = stubMinion({ id: "thug", atk: 0, sch: 0, hp: 3, boostIcons: 0 });

/** Two players, each engaged with one thug after round 1. */
function twoThugs(extra: { cards?: readonly AnyCard[]; abilities?: readonly ReturnType<typeof stubAbility>[]; deck?: readonly CardId[] } = {}) {
  const deps = depsOf(...(extra.abilities ?? []));
  const start = newGame({
    players: 2,
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [BLANK, THUG, MENTAL, ...(extra.cards ?? [])],
    deck: [...copies(RESOURCE.id, 10), ...(extra.deck ?? [])],
    encounterDeck: copies(THUG.id),
    deps,
  });
  const state = settle(runWith(deps, start, endTurn(p1), endTurn(p2)), decline, deps);
  const thugOf = (player: PlayerId) => mustPlayer(state, player).playArea.find((id) => state.instances[id]?.cardId === THUG.id) as InstanceId;
  return { deps, state, thugOf };
}

const ctxWith = (bindings: Record<string, readonly InstanceId[]>, controllerId: PlayerId = p1): EffectContext => ({ selfInstanceId: null, controllerId, event: null, bindings });

describe("query and player-ref primitives", () => {
  const { state, thugOf } = twoThugs();
  const [t1, t2] = [thugOf(p1), thugOf(p2)];

  it("excludeSlots: 'a different scheme/enemy' skips what an earlier choice bound", () => {
    expect(selectTargets(state, { categories: ["minion"] }, ctxWith({})).length).toBe(2);
    expect(selectTargets(state, { categories: ["minion"], excludeSlots: ["first"] }, ctxWith({ first: [t1] }))).toEqual([t2]);
  });

  it("controlledBy / engagedWithPlayer: 'each character that player controls' / 'each enemy engaged with that player'", () => {
    const p2Identity = mustPlayer(state, p2).identity.instanceId;
    const chosenP2 = ctxWith({ pl: [p2Identity] });
    expect(selectTargets(state, { categories: ["identity"], controlledBy: { kind: "slot", slot: "pl" } }, chosenP2)).toEqual([p2Identity]);
    expect(selectTargets(state, { categories: ["enemy"], engagedWithPlayer: { kind: "slot", slot: "pl" } }, chosenP2)).toEqual([t2]);
    // Minions have no controller, so a controlledBy query never matches them.
    expect(selectTargets(state, { categories: ["minion"], controlledBy: { kind: "each" } }, chosenP2)).toEqual([]);
  });

  it("PlayerRef engagedWith: 'the engaged player'", () => {
    expect(resolvePlayers(state, { kind: "engagedWith", of: { kind: "slot", slot: "m" } }, ctxWith({ m: [t2] }))).toEqual([p2]);
    expect(resolvePlayers(state, { kind: "engagedWith", of: { kind: "villain" } }, ctxWith({}))).toEqual([]);
  });

  it("refMatches: true only while the card is in play and matches", () => {
    const refIsMinion = { kind: "refMatches", ref: { kind: "slot", slot: "m" }, query: { categories: ["minion"] } } as const;
    expect(evaluate(state, refIsMinion, ctxWith({ m: [t1] }))).toBe(true);
    expect(evaluate(state, { ...refIsMinion, query: { categories: ["ally"] } }, ctxWith({ m: [t1] }))).toBe(false);
    const discarded: GameState = {
      ...state,
      players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((id) => id !== t1) })),
      encounterDiscard: [...state.encounterDiscard, t1],
    };
    expect(evaluate(discarded, refIsMinion, ctxWith({ m: [t1] }))).toBe(false);
  });

  it("gameStep: 'during step one of the villain phase'", () => {
    expect(evaluate(state, { kind: "gameStep", phase: "player", step: "turn" }, ctxWith({}))).toBe(true);
    expect(evaluate(state, { kind: "gameStep", phase: "villain" }, ctxWith({}))).toBe(false);
  });
});

test("EventPattern.on with several kinds: 'After this minion schemes or attacks, place 1 threat on the main scheme'", () => {
  const either = stubAbility("either", def({
    trigger: { kind: "response", forced: true, on: { on: ["enemyScheme", "enemyAttack"], selfIs: "source" } },
    effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } }],
  }));
  const GRUNT = stubMinion({ id: "grunt", atk: 0, sch: 0, hp: 9, boostIcons: 0, abilities: [either.ref] });
  const deps = depsOf(either);
  const start = newGame({ villain: VILLAIN, mainScheme: SCHEME, extraCards: [BLANK, GRUNT], encounterDeck: [GRUNT.id, ...copies(BLANK.id)], deps });
  // Round 1: the villain's boost card is a blank, the dealt card is the grunt.
  const gruntId = start.encounterDeck.find((id) => start.instances[id]?.cardId === GRUNT.id) as InstanceId;
  const [first, ...others] = start.encounterDeck.filter((id) => id !== gruntId);
  const stacked: GameState = { ...start, encounterDeck: [first as InstanceId, gruntId, ...others] };
  const roundTwo = settle(runWith(deps, stacked, endTurn()), decline, deps);
  const threat = (s: GameState) => mustInstance(s, s.mainScheme.instanceId).threat;
  const afterScheme = settle(runWith(deps, roundTwo, endTurn()), decline, deps);
  expect(threat(afterScheme) - threat(roundTwo)).toBe(1);
  const afterAttack = settle(runWith(deps, afterScheme, toHero(), endTurn()), decline, deps);
  expect(threat(afterAttack) - threat(afterScheme)).toBe(1);
});

test("characterDefeated carries the defeating player: 'After you defeat a minion' ignores other players' defeats", () => {
  const room = stubAbility("room", def({
    trigger: { kind: "response", forced: true, on: { on: "characterDefeated", playerIs: "controller", targetIs: { categories: ["minion"] } } },
    effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 5 } }],
  }));
  // A non-attack damage effect, so "defeat" isn't limited to attacks.
  const blast = stubAbility("blast", def({
    trigger: { kind: "action" },
    effects: [
      { kind: "chooseTarget", slot: "m", chooser: { kind: "controller" }, query: { categories: ["minion"], engagedWith: "you" } },
      { kind: "dealDamage", target: { kind: "slot", slot: "m" }, amount: { kind: "const", value: 5 } },
    ],
  }));
  const ROOM = stubSupport({ id: "room", cost: 0, abilities: [room.ref] });
  const BLAST = stubEvent({ id: "blast", cost: 0, abilities: [blast.ref] });
  const { deps, state, thugOf } = twoThugs({ cards: [ROOM, BLAST], abilities: [room, blast], deck: [ROOM.id, BLAST.id, BLAST.id] });
  const threat = (s: GameState) => mustInstance(s, s.mainScheme.instanceId).threat;
  // p1 controls the room; round 2's first player is p2.
  const p1Cards = giveCards(state, p1, "room");
  const p2Cards = giveCards(p1Cards.state, p2, "blast");
  const [roomId] = p1Cards.ids as [InstanceId];
  const [p2Blast] = p2Cards.ids as [InstanceId];
  expect(p2Cards.state.firstPlayerId).toBe(p2);
  const byP2 = resolvePending(runWith(deps, p2Cards.state, play(p2, p2Blast)), [thugOf(p2)], deps);
  expect(byP2.encounterDiscard).toContain(thugOf(p2));
  expect(threat(byP2)).toBe(threat(state));
  const p1Turn = giveCards(runWith(deps, byP2, endTurn(p2), play(p1, roomId)), p1, "blast");
  const byP1 = resolvePending(runWith(deps, p1Turn.state, play(p1, p1Turn.ids[0] as InstanceId)), [thugOf(p1)], deps);
  expect(byP1.encounterDiscard).toContain(thugOf(p1));
  expect(threat(byP1)).toBe(threat(state) + 5);
});

describe("spendResources: 'Either spend a [mental] resource or take 3 damage'", () => {
  const eitherOr = stubAbility("either-or", def({
    trigger: { kind: "whenRevealed" },
    effects: [
      { kind: "spendResources", player: { kind: "controller" }, resources: { mental: 1 }, bind: "spent" },
      { kind: "if", condition: { kind: "not", of: { kind: "varAtLeast", name: "spent.made", amount: 1 } }, then: [{ kind: "dealDamage", target: { kind: "identityOf", player: { kind: "controller" } }, amount: { kind: "const", value: 3 } }] },
    ],
  }));
  const TOLL = stubTreachery({ id: "toll", boostIcons: 0, abilities: [eitherOr.ref] });
  const deps = depsOf(eitherOr);
  const start = newGame({ villain: VILLAIN, mainScheme: SCHEME, extraCards: [TOLL, MENTAL], deck: [...copies(MENTAL.id, 4), ...copies(RESOURCE.id, 16)], encounterDeck: copies(TOLL.id), deps });
  const handed = giveCards(start, p1, "mental", RESOURCE.id);
  const [mentalId, wildId] = handed.ids as [InstanceId, InstanceId];
  // Test surgery: keep the hand at the alter-ego hand size (6) so no end-of-phase discard intervenes.
  const given = {
    state: {
      ...handed.state,
      players: handed.state.players.map((p) => {
        const keep = [mentalId, wildId, ...p.hand.filter((id) => id !== mentalId && id !== wildId)].slice(0, 6);
        return { ...p, hand: keep, deck: [...p.deck, ...p.hand.filter((id) => !keep.includes(id))] };
      }),
    } satisfies GameState,
  };
  // RRG "End of Player Phase" step 1 always offers an optional discard first; answer it, then the treachery is revealed.
  const untilSpend = (s: GameState): GameState => {
    let current = s;
    while (current.pendingChoice && current.pendingChoice.prompt.kind !== "spendResources") current = resolvePending(current, decline(current), deps);
    return current;
  };
  const atPrompt = untilSpend(runWith(deps, given.state, endTurn()));
  const identity = mustPlayer(start, p1).identity.instanceId;

  it("asks the revealing player for a payment from their usual options", () => {
    expect(atPrompt.pendingChoice?.prompt).toEqual({ kind: "spendResources", requirement: { generic: 0, physical: 0, mental: 1, energy: 0 } });
    expect(atPrompt.pendingChoice?.minSelections).toBe(0);
  });

  it("paying spends the resource and skips the alternative", () => {
    const paid = settle(resolvePending(atPrompt, [`hand:${mentalId}`], deps), decline, deps);
    expect(mustPlayer(paid, p1).discard).toContain(mentalId);
    expect(mustInstance(paid, identity).damage).toBe(0);
  });

  it("a wild counts; declining (or paying the wrong type) resolves the alternative and spends nothing", () => {
    expect(mustInstance(settle(resolvePending(atPrompt, [`hand:${wildId}`], deps), decline, deps), identity).damage).toBe(0);
    const declined = settle(resolvePending(atPrompt, [], deps), decline, deps);
    expect(mustInstance(declined, identity).damage).toBe(3);
    expect(mustPlayer(declined, p1).hand).toContain(mentalId);
  });

  it("replays to an identical state", () => {
    let session: GameSession = startSession(given.state);
    const apply = (command: Command) => {
      const result = sessionApply(session, command, deps);
      if (!result.ok) throw new Error(result.error.message);
      session = result.session;
    };
    apply(endTurn());
    for (let choice = session.state.pendingChoice; choice && choice.prompt.kind !== "spendResources"; choice = session.state.pendingChoice) {
      apply({ type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: decline(session.state) });
    }
    apply({ type: "resolveChoice", playerId: p1, choiceId: session.state.pendingChoice?.choiceId as never, selectedOptionIds: [`hand:${mentalId}`] });
    while (session.state.pendingChoice) {
      const choice = session.state.pendingChoice;
      apply({ type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: decline(session.state) });
    }
    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });
});
