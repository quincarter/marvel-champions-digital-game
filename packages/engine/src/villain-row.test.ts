/**
 * docs/phase7-wave8.md §3.7 and §3.8: villains laid out in a random row, and an active counter that passes one place
 * along it. Synthetic villains shaped like the Four Horsemen (four one-stage villains that start set aside), a main
 * scheme whose 1A Setup is "Shuffle the villains, then reveal them in a row from left to right. Place the active
 * counter on the leftmost villain" and whose 1B is "Forced Response: After a villain activates, move the active counter
 * to the next villain." The engine names no card.
 *
 * Sources: MC45 p. 11 ("Active Villain", "Multiple Villains"); RRG 1.8 "Activation" (p. 6: the villain activates "once
 * per player, in player order", and an activation started during another resolves after it); "Stun, Stunned" (p. 41:
 * "that character is not considered to have attacked"); "All-Purpose Counter" (p. 6). §4.1 Q5 = A (the owner's
 * decision): the counter always moves one place from the villain that holds it, whichever villain activated.
 */

import { flat, type VillainCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer, nextVillainInRow, undefeatedVillains } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, newGame, seatIdentities, withEncounterPiles } from "./testing/scenario.js";
import { copiesOf, playFree } from "./testing/wave3.js";

const p1 = playerId("p1");
const p2 = playerId("p2");

const NAMES = ["north", "east", "south", "west"] as const;
type Name = (typeof NAMES)[number];

/** "When Defeated: Set this villain aside." so a test can take one out of the row and bring it back. */
const SET_ASIDE = stubAbility("rider.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [{ kind: "setVillainAside", villain: { kind: "self" } }],
});
const rider = (name: Name): VillainCard =>
  stubVillain({ id: name, stages: [{ hp: flat(9), atk: 0, sch: 0, abilities: [SET_ASIDE.ref] }] });
const RIDERS = NAMES.map(rider);

const setAsideVillains = { kind: "encounterSetAside", filter: { categories: ["villain"] } } as const;
/** 1A Setup: the set-aside villains, shuffled into a row; the leftmost takes the active counter. */
const SETUP = stubAbility("riders.setup", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "selectCards", slot: "riders", cards: setAsideVillains },
    { kind: "addVillain", villain: { kind: "slot", slot: "riders" }, row: "shuffled" },
  ],
});
/** 1B: "Forced Response: After a villain activates, move the active counter to the next villain." */
const PASS_ON = stubAbility("riders.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: ["enemyAttack", "enemyScheme"], sourceIs: { categories: ["villain"] } },
  },
  effects: [{ kind: "moveActiveCounter", to: "nextInRow" }],
});
const SCHEME = stubMainScheme({
  id: "riders",
  stages: [
    {
      startingThreat: flat(0),
      targetThreat: flat(99),
      acceleration: flat(0),
      abilities: [PASS_ON.ref],
      aSideAbilities: [SETUP.ref],
    },
  ],
});

const named = (name: Name): TargetRef => ({ kind: "named", name });
const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Move the active counter to the next villain." */
const PASS = event("pass", [{ kind: "moveActiveCounter", to: "nextInRow" }]);
/** "Move the active counter to West." */
const TO_WEST = event("to-west", [{ kind: "setActiveVillain", villain: named("west") }]);
/** "Deal 9 damage to East." */
const SLAY = event("slay", [{ kind: "dealDamage", target: named("east"), amount: { kind: "const", value: 9 } }]);
/** "Choose a set-aside villain and put it into play." */
const RETURN = event("return", [
  { kind: "selectCards", slot: "back", cards: setAsideVillains },
  { kind: "addVillain", villain: { kind: "slot", slot: "back" } },
]);
const STUN = event("stun", [{ kind: "giveStatus", target: { kind: "villain" }, status: "stunned" }]);
const EVENTS = [PASS, TO_WEST, SLAY, RETURN, STUN];

/** "When Revealed: South activates against you." */
const CALL_SOUTH_REVEALED = stubAbility("call-south.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "enemyActivation", enemies: named("south"), against: { kind: "controller" } }],
});
const CALL_SOUTH = stubTreachery({ id: "call-south", boostIcons: 0, abilities: [CALL_SOUTH_REVEALED.ref] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const deps: EngineDeps = depsOf(SET_ASIDE, SETUP, PASS_ON, CALL_SOUTH_REVEALED, ...EVENTS.map((e) => e.ability));

function create(players: 1 | 2, seed: number) {
  const identities = seatIdentities(HERO, players);
  const result = createGame(
    {
      seed,
      cards: [...DEFAULT_CARDS, ...identities, ...RIDERS, SCHEME, FILLER, CALL_SOUTH, ...EVENTS.map((e) => e.card)],
      villainCardId: RIDERS[0]!.id,
      villains: RIDERS.map((card) => ({ villainCardId: card.id, encounterDeck: [] })),
      sharedEncounterDeck: true,
      villainsStartSetAside: true,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: [...copiesOf(FILLER.id, 30), ...copiesOf(CALL_SOUTH.id, 2)],
      includeIdentitySets: false,
      players: identities.map((identity) => ({
        identityCardId: identity.id,
        deck: [...DEFAULT_DECK, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
      })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return result;
}
/** A game past setup, at the first player's first turn, with the events setup logged. */
function start(players: 1 | 2 = 1, seed = 3): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const created = create(players, seed);
  const driven = driveSession(startSession(created.state), deps);
  return { state: driven.session.state, events: [...created.events, ...driven.events] };
}

const idOf = (state: GameState, name: Name): InstanceId => {
  const found = state.villains.find((v) => v.cardId === name);
  if (!found) throw new Error(`no ${name}`);
  return found.instanceId;
};
const nameOf = (state: GameState, id: InstanceId): Name => mustInstance(state, id).cardId as Name;
const rowOf = (state: GameState): readonly Name[] => (state.villainRow ?? []).map((id) => nameOf(state, id));
const active = (state: GameState): Name => nameOf(state, state.activeVillainId);
/** The row as given, the counter on `holder` (test surgery: the same four villains, re-seated). */
const seated = (state: GameState, row: readonly Name[], holder: Name): GameState => ({
  ...state,
  villainRow: row.map((name) => idOf(state, name)),
  activeVillainId: idOf(state, holder),
});
const hero = (state: GameState, players: readonly PlayerId[] = state.players.map((p) => p.playerId)): GameState => ({
  ...state,
  players: state.players.map((p) =>
    players.includes(p.playerId) ? { ...p, identity: { ...p.identity, form: "hero" as const, heroFormIndex: 0 } } : p,
  ),
});
/** `cards` on top of the encounter deck, in order (boost cards and dealt cards come off the top). */
function stacked(state: GameState, ...cards: readonly string[]): GameState {
  const deck = [...activeEncounterDeck(state).deck];
  const top: InstanceId[] = [];
  for (const card of cards) {
    const at = deck.findIndex((id) => state.instances[id]?.cardId === card);
    if (at < 0) throw new Error(`no ${card} in the encounter deck`);
    top.push(...deck.splice(at, 1));
  }
  return withEncounterPiles(state, { deck: [...top, ...deck] });
}
/** Every player ends their turn, in player order: one villain phase. */
function round(state: GameState): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const seats = state.players.map((p) => p.playerId);
  const at = seats.indexOf(state.firstPlayerId);
  const order = [...seats.slice(at), ...seats.slice(0, at)];
  const commands: Command[] = order.map((id) => ({ type: "endTurn", playerId: id }));
  const { session, events } = driveSession(startSession(state), deps, commands);
  return { state: session.state, events };
}
/** Who attacked whom, in order: `[villain, player]`. */
const attacks = (state: GameState, events: readonly GameEvent[]): readonly (readonly [Name, PlayerId])[] =>
  events.flatMap((e) => {
    if (e.type !== "attackResolved") return [];
    const target = state.players.find((p) => p.identity.instanceId === e.targetInstanceId);
    return target ? [[nameOf(state, e.enemyInstanceId), target.playerId] as const] : [];
  });
const moves = (state: GameState, events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "activeVillainChanged" ? [[nameOf(state, e.from), nameOf(state, e.to), e.reason] as const] : [],
  );
const ROW: readonly Name[] = ["north", "east", "south", "west"];

describe("§3.7 the 1A Setup: villains shuffled into a row", () => {
  it("puts all four into play in a seeded random order, logs the row, and gives the leftmost the active counter", () => {
    const { state, events } = start(1, 3);
    expect(undefeatedVillains(state)).toHaveLength(4);
    expect([...rowOf(state)].sort()).toEqual([...NAMES].sort());
    expect(state.encounterSetAside.filter((id) => state.villains.some((v) => v.instanceId === id))).toEqual([]);
    const logged = events.filter((e) => e.type === "villainRowSet");
    expect(logged).toEqual([{ type: "villainRowSet", order: state.villainRow }]);
    expect(state.activeVillainId).toBe(state.villainRow![0]);
    // `villains` stays in printed order: the row is where they sit, not how they are listed.
    expect(state.villains.map((v) => v.cardId)).toEqual([...NAMES]);
    // They entered in row order, left to right.
    const entered = events.flatMap((e) => (e.type === "villainAdded" ? [e.instanceId] : []));
    expect(entered).toEqual(state.villainRow);
  });

  it("the same seed gives the same row; other seeds give other rows", () => {
    expect(rowOf(start(1, 3).state)).toEqual(rowOf(start(1, 3).state));
    const rows = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => rowOf(start(1, seed).state).join(",")));
    expect(rows.size).toBeGreaterThan(1);
    // Not always the printed order, and not always the printed first villain on the left.
    const leftmost = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => rowOf(start(1, seed).state)[0]));
    expect(leftmost.size).toBeGreaterThan(1);
  });

  it("a replay of the log rebuilds the same row and the same state", () => {
    const { state } = start(1, 5);
    const first = round(hero(state));
    const session = driveSession(startSession(hero(state)), deps, [{ type: "endTurn", playerId: p1 }]).session;
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
    expect(replayed.state.villainRow).toEqual(first.state.villainRow);
  });

  it("a game with no row has no `villainRow` field", () => {
    expect("villainRow" in newGame()).toBe(false);
  });
});

describe("§3.7 the active counter passes to the next villain in the row", () => {
  it("1 player: round 1 North attacks and the counter goes to East; East, South, West follow; round 5 is North again", () => {
    let state = seated(hero(start(1).state), ROW, "north");
    const seen: Name[] = [];
    for (let n = 0; n < 5; n++) {
      // A blank boost card and a blank card to deal, so nothing but the villain phase itself moves the counter.
      const run = round(stacked(state, FILLER.id, FILLER.id));
      const [[attacker, target] = []] = attacks(run.state, run.events);
      expect(target).toBe(p1);
      seen.push(attacker!);
      expect(attacks(run.state, run.events)).toHaveLength(1);
      expect(moves(run.state, run.events)).toEqual([[ROW[n % 4], ROW[(n + 1) % 4], "nextInRow"]]);
      state = run.state;
    }
    expect(seen).toEqual(["north", "east", "south", "west", "north"]);
    expect(active(state)).toBe("east");
  });

  it("2 players: the active villain is read afresh for each player. North attacks player 1, East attacks player 2, the counter ends on South", () => {
    const state = seated(hero(start(2).state), ROW, "north");
    const run = round(state);
    expect(attacks(run.state, run.events)).toEqual([
      ["north", p1],
      ["east", p2],
    ]);
    expect(moves(run.state, run.events)).toEqual([
      ["north", "east", "nextInRow"],
      ["east", "south", "nextInRow"],
    ]);
    expect(active(run.state)).toBe("south");
  });

  it("an alter-ego player is schemed against, and the scheme passes the counter too", () => {
    const state = seated(start(1).state, ROW, "south");
    const run = round(state);
    expect(attacks(run.state, run.events)).toEqual([]);
    expect(run.events.filter((e) => e.type === "schemeResolved")).toHaveLength(1);
    expect(active(run.state)).toBe("west");
  });

  it("a card's 'move the active counter to the next villain' on the rightmost wraps to the leftmost, once; nothing activated, so 1B does not move it again", () => {
    const state = seated(start(1).state, ROW, "west");
    const { state: after, events } = playFree(state, deps, PASS.card.id);
    expect(moves(after, events)).toEqual([["west", "north", "nextInRow"]]);
    expect(active(after)).toBe("north");
  });

  it("'move the active counter to him' is `setActiveVillain`: from North straight to West, whatever sits between", () => {
    const state = seated(start(1).state, ROW, "north");
    const { state: after, events } = playFree(state, deps, TO_WEST.card.id);
    expect(moves(after, events)).toEqual([["north", "west", "effect"]]);
    expect(active(after)).toBe("west");
  });
});

describe("§3.8 'after a villain activates' with several villains (Q4, Q5)", () => {
  it("Q5 in the villain phase: row [west, east, south, north], the counter on West; a revealed treachery makes South activate, and the counter moves from the villain holding it", () => {
    const row: readonly Name[] = ["west", "east", "south", "north"];
    const state = stacked(seated(hero(start(1).state), row, "west"), FILLER.id, CALL_SOUTH.id);
    const run = round(state);
    // West's own activation in step two moves it West -> East. South's, from the treachery, moves it East -> South:
    // one place from the holder (East). It does not jump to North, South's right-hand neighbor.
    expect(attacks(run.state, run.events)).toEqual([
      ["west", p1],
      ["south", p1],
    ]);
    expect(moves(run.state, run.events)).toEqual([
      ["west", "east", "nextInRow"],
      ["east", "south", "nextInRow"],
    ]);
    expect(active(run.state)).toBe("south");
  });

  it("Q5, the holder far from the activating villain: South activates while North holds the counter, and it goes to East", () => {
    // The treachery is revealed outside the villain's own activation: the player phase, so only South activates.
    const state = seated(hero(start(1).state), ROW, "north");
    const CALL = event("call", [{ kind: "enemyActivation", enemies: named("south"), against: { kind: "controller" } }]);
    const callDeps = depsOf(SET_ASIDE, SETUP, PASS_ON, CALL.ability);
    const withCard: GameState = { ...state, cardPool: { ...state.cardPool, [CALL.card.id]: CALL.card } };
    const instanceId = "call-1" as InstanceId;
    const player = mustPlayer(withCard, p1);
    const given: GameState = {
      ...withCard,
      instances: {
        ...withCard.instances,
        [instanceId]: { ...mustInstance(withCard, player.hand[0]!), instanceId, cardId: CALL.card.id },
      },
      players: withCard.players.map((p) => (p.playerId === p1 ? { ...p, hand: [...p.hand, instanceId] } : p)),
    };
    const { session, events } = driveSession(startSession(given), callDeps, [
      { type: "playCard", playerId: p1, cardInstanceId: instanceId, payment: [], attachToInstanceId: null },
    ]);
    expect(attacks(session.state, events)).toEqual([["south", p1]]);
    // From North (the holder) to East. Not to West (South's neighbor), and it does not stay.
    expect(moves(session.state, events)).toEqual([["north", "east", "nextInRow"]]);
    expect(active(session.state)).toBe("east");
  });

  it("Q4: a stunned active villain does not attack, so it did not activate and the counter stays", () => {
    const state = seated(hero(start(1).state), ROW, "north");
    const stunned = playFree(state, deps, STUN.card.id).state;
    expect(mustInstance(stunned, idOf(stunned, "north")).statuses.stunned).toBe(1);
    const run = round(stunned);
    expect(attacks(run.state, run.events)).toEqual([]);
    expect(mustInstance(run.state, idOf(run.state, "north")).statuses.stunned).toBe(0);
    expect(moves(run.state, run.events)).toEqual([]);
    expect(active(run.state)).toBe("north");
  });
});

describe("§3.7 who sits in the row", () => {
  it("a villain that leaves play leaves the row, and one that enters play joins at the right end", () => {
    const state = seated(start(1).state, ROW, "east");
    const { state: without } = playFree(state, deps, SLAY.card.id);
    expect(rowOf(without)).toEqual(["north", "south", "west"]);
    expect(without.encounterSetAside).toContain(idOf(without, "east"));
    const { state: back } = playFree(without, deps, RETURN.card.id);
    expect(rowOf(back)).toEqual(["north", "south", "west", "east"]);
  });

  it("`nextVillainInRow`: one place right, wrapping; the leftmost when the holder is not in the row; nobody with one villain or no row", () => {
    const state = seated(start(1).state, ROW, "north");
    const next = (from: Name | null) => {
      const id = nextVillainInRow(state, from === null ? null : idOf(state, from));
      return id === null ? null : nameOf(state, id);
    };
    expect(next("north")).toBe("east");
    expect(next("east")).toBe("south");
    expect(next("west")).toBe("north");
    expect(next(null)).toBe("north");
    const lone: GameState = { ...state, villainRow: [idOf(state, "south")] };
    expect(nextVillainInRow(lone, idOf(state, "south"))).toBeNull();
    expect(nextVillainInRow(lone, idOf(state, "north"))).toBe(idOf(state, "south"));
    const { villainRow: _row, ...noRow } = state;
    expect(nextVillainInRow(noRow, idOf(state, "north"))).toBeNull();
    expect(nextVillainInRow({ ...state, villainRow: [] }, idOf(state, "north"))).toBeNull();
  });

  it("with one villain left in the row the counter stays on it", () => {
    const state = seated(start(1).state, ROW, "south");
    const lone: GameState = { ...state, villainRow: [idOf(state, "south")] };
    const { state: after, events } = playFree(lone, deps, PASS.card.id);
    expect(moves(after, events)).toEqual([]);
    expect(active(after)).toBe("south");
  });

  it("with no row, 'next in the row' moves nothing", () => {
    const state = seated(start(1).state, ROW, "south");
    const { villainRow: _row, ...noRow } = state;
    const { state: after, events } = playFree(noRow, deps, PASS.card.id);
    expect(moves(after, events)).toEqual([]);
    expect(active(after)).toBe("south");
  });
});
