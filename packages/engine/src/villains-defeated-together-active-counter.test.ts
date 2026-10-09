/**
 * Several villains defeated by one sweep are defeated together, and the active counter moves once, after the last of
 * them has fallen (docs/phase7-wave8.md §3.9; `removeDefeatedVillain`, `settleActiveCounter`). Synthetic villains: four
 * with one stage and no signature side scheme, so any two left in play tie for the counter (The Wrecking Crew insert:
 * "move the active counter to the villain whose side scheme has the most threat. (In case of a tie, the first player
 * decides.)"). Once in a plain game with several villains, once in a row (`GameState.villainRow`), once with each
 * villain protected by the others' hit points (the shape of `aoa` 45081–45084). The engine names no card.
 *
 * Sources: RRG 1.8 "Villain Defeat" (p. 47), "Defeat" (p. 15), "'Cannot'" (p. 11), "First Player" (p. 19); ruling,
 * Jun 2, 2026 (2) answer 1 ("Damage is dealt simultaneously").
 */

import { flat, type VillainCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import { createGame } from "./setup.js";
import type { Predicate } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, giveCard, HERO } from "./testing/scenario.js";
import { copiesOf, P1, playerCardIntoPlay } from "./testing/wave3.js";

const NAMES = ["north", "east", "south", "west"] as const;
type Name = (typeof NAMES)[number];

/** "[Name] cannot be defeated while another villain has at least 1 hit point." */
const PROTECTED: Record<Name, StubAbility> = Object.fromEntries(
  NAMES.map((name) => {
    const others: Predicate[] = NAMES.filter((other) => other !== name).map((other) => ({
      kind: "compare",
      left: { kind: "remainingHp", of: { kind: "named", name: other } },
      op: "atLeast",
      right: { kind: "const", value: 1 },
    }));
    return [
      name,
      stubAbility(`${name}.cannot-be-defeated`, {
        trigger: {
          kind: "constant",
          rules: [{ kind: "cannotBeDefeated", target: { self: true }, while: { kind: "or", of: others } }],
        },
        effects: [],
      }),
    ];
  }),
) as Record<Name, StubAbility>;

const villain = (name: Name, protectedByOthers: boolean): VillainCard =>
  stubVillain({
    id: name,
    stages: [{ hp: flat(5), atk: 0, sch: 0, abilities: protectedByOthers ? [PROTECTED[name].ref] : [] }],
  });

/** 1A Setup: "Shuffle the villains, then reveal them in a row. Place the active counter on the leftmost villain." */
const ROW_SETUP = stubAbility("row.setup", {
  trigger: { kind: "setup" },
  effects: [
    {
      kind: "selectCards",
      slot: "villains",
      cards: { kind: "encounterSetAside", filter: { categories: ["villain"] } },
    },
    { kind: "addVillain", villain: { kind: "slot", slot: "villains" }, row: "shuffled" },
  ],
});
const PLAIN_SCHEME = stubMainScheme({
  id: "plain",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const ROW_SCHEME = stubMainScheme({
  id: "row",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), aSideAbilities: [ROW_SETUP.ref] }],
});
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

/** "Deal 1 damage to each villain.": simultaneous damage. */
const SWEEP_ABILITY = stubAbility("sweep.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "each", query: { categories: ["villain"] } },
      amount: { kind: "const", value: 1 },
    },
  ],
});
const SWEEP = stubEvent({ id: "sweep", cost: 0, abilities: [SWEEP_ABILITY.ref] });
/** A listener on defeats, so even a lone villain's defeat is an event on the stack with its own windows. */
const WATCHER = stubAbility("watcher.response", {
  trigger: { kind: "response", forced: true, on: { on: "characterDefeated" } },
  effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 0 } }],
});
const WATCHER_CARD = stubSupport({ id: "watcher", cost: 0, abilities: [WATCHER.ref] });

const deps: EngineDeps = depsOf(ROW_SETUP, SWEEP_ABILITY, WATCHER, ...NAMES.map((name) => PROTECTED[name]));

interface Shape {
  readonly row?: boolean;
  readonly protectedByOthers?: boolean;
}

function start(shape: Shape = {}): GameState {
  const villains = NAMES.map((name) => villain(name, shape.protectedByOthers === true));
  const scheme = shape.row ? ROW_SCHEME : PLAIN_SCHEME;
  const result = createGame(
    {
      seed: 7,
      cards: [...DEFAULT_CARDS, ...villains, scheme, FILLER, SWEEP, WATCHER_CARD],
      villainCardId: villains[0]!.id,
      villains: villains.map((card) => ({ villainCardId: card.id, encounterDeck: [] })),
      sharedEncounterDeck: true,
      ...(shape.row ? { villainsStartSetAside: true as const } : {}),
      mainSchemeCardId: scheme.id,
      encounterDeck: copiesOf(FILLER.id, 30),
      includeIdentitySets: false,
      players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, WATCHER_CARD.id, ...copiesOf(SWEEP.id, 2)] }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}

const idOf = (state: GameState, name: Name): InstanceId => {
  const found = state.villains.find((v) => v.cardId === name);
  if (!found) throw new Error(`no villain ${name}`);
  return found.instanceId;
};
/** Test surgery: each named villain's remaining hit points, and the counter on `holder`. */
function primed(state: GameState, remaining: Partial<Record<Name, number>>, holder: Name): GameState {
  const instances = { ...state.instances };
  for (const [name, left] of Object.entries(remaining) as [Name, number][]) {
    const id = idOf(state, name);
    instances[id] = { ...mustInstance(state, id), damage: 5 - left };
  }
  return { ...state, instances, activeVillainId: idOf(state, holder) };
}

interface Stop {
  readonly defeated: readonly Name[];
  readonly options: readonly Name[];
  readonly won: boolean;
}
/**
 * Plays the sweep for 0 as one command, then answers each choice with its last option. A stop is what the player
 * sees when the engine hands control back: after the command, and after each answer.
 */
function sweep(state: GameState): {
  readonly session: GameSession;
  readonly stops: readonly Stop[];
  readonly events: readonly GameEvent[];
} {
  const given = giveCard(state, P1, SWEEP.id);
  const events: GameEvent[] = [];
  const stops: Stop[] = [];
  let session = startSession(given.state);
  const nameOf = (id: string): Name => mustInstance(session.state, id as InstanceId).cardId as Name;
  const apply = (command: Parameters<typeof sessionApply>[1]): void => {
    const result = sessionApply(session, command, deps);
    if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
    session = result.session;
    events.push(...result.events);
    const choice = session.state.pendingChoice;
    if (choice && choice.prompt.kind !== "chooseTarget") throw new Error(`unexpected prompt ${choice.prompt.kind}`);
    stops.push({
      defeated: session.state.villains.filter((v) => v.defeated).map((v) => v.cardId as Name),
      options: (choice?.options ?? []).map((option) => nameOf(option.optionId)),
      won: session.state.outcome?.result === "win",
    });
  };
  apply({ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null });
  while (session.state.pendingChoice && stops.length < 8) {
    const choice = session.state.pendingChoice;
    apply({
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: [choice.options.at(-1)!.optionId],
    });
  }
  return { session, stops, events };
}
const defeatedEvents = (events: readonly GameEvent[]): number =>
  events.filter((event) => event.type === "characterDefeated").length;
const counterMoves = (events: readonly GameEvent[]) => events.filter((event) => event.type === "activeVillainChanged");

describe.each([
  { label: "several villains, no row", row: false },
  { label: "villains in a row", row: true },
])("villains defeated together and the active counter: $label", ({ row }) => {
  it("all four fall in one sweep: the game is won in that command and nobody is asked who is active next", () => {
    const state = primed(start({ row }), { north: 1, east: 1, south: 1, west: 1 }, "north");
    const { stops, events, session } = sweep(state);
    expect(stops).toEqual([{ defeated: [...NAMES], options: [], won: true }]);
    expect(defeatedEvents(events)).toBe(4);
    expect(counterMoves(events)).toEqual([]);
    expect(session.state.outcome).toEqual({ result: "win", reason: "allVillainsDefeated" });
    expect(session.state.villainRow ?? []).toEqual([]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("all four fall whichever of them holds the counter", () => {
    for (const holder of NAMES) {
      const { stops } = sweep(primed(start({ row }), { north: 1, east: 1, south: 1, west: 1 }, holder));
      expect(stops, holder).toEqual([{ defeated: [...NAMES], options: [], won: true }]);
    }
  });

  it("the holder and one other fall: one question, asked after both are defeated, between the two left in play", () => {
    const state = primed(start({ row }), { north: 1, east: 1 }, "north");
    const { stops, events, session } = sweep(state);
    expect(stops).toEqual([
      { defeated: ["north", "east"], options: ["south", "west"], won: false },
      { defeated: ["north", "east"], options: [], won: false },
    ]);
    expect(session.state.activeVillainId).toBe(idOf(state, "west"));
    expect(counterMoves(events)).toEqual([
      {
        type: "activeVillainChanged",
        from: idOf(state, "north"),
        to: idOf(state, "west"),
        reason: "activeVillainDefeated",
      },
    ]);
  });

  it("the holder and two others fall: the one villain left takes the counter with no question", () => {
    const state = primed(start({ row }), { north: 1, east: 1, south: 1 }, "east");
    const { stops, events, session } = sweep(state);
    expect(stops).toEqual([{ defeated: ["north", "east", "south"], options: [], won: false }]);
    expect(session.state.activeVillainId).toBe(idOf(state, "west"));
    expect(counterMoves(events)).toHaveLength(1);
  });

  it("two fall together and neither holds the counter: it stays where it is", () => {
    const state = primed(start({ row }), { north: 1, east: 1 }, "south");
    const { stops, events, session } = sweep(state);
    expect(stops).toEqual([{ defeated: ["north", "east"], options: [], won: false }]);
    expect(session.state.activeVillainId).toBe(idOf(state, "south"));
    expect(counterMoves(events)).toEqual([]);
  });

  it("the holder falls alone and three remain: the first player is still asked, among all three", () => {
    const state = primed(start({ row }), { north: 1 }, "north");
    const { stops, session } = sweep(state);
    expect(stops).toEqual([
      { defeated: ["north"], options: ["east", "south", "west"], won: false },
      { defeated: ["north"], options: [], won: false },
    ]);
    expect(session.state.pendingChoice).toBeNull();
    expect(session.state.activeVillainId).toBe(idOf(state, "west"));
  });

  it("the same with each defeat on the stack (something listens to defeats)", () => {
    const watched = playerCardIntoPlay(start({ row }), WATCHER_CARD.id).state;
    expect(sweep(primed(watched, { north: 1, east: 1, south: 1, west: 1 }, "south")).stops).toEqual([
      { defeated: [...NAMES], options: [], won: true },
    ]);
    expect(sweep(primed(watched, { north: 1, east: 1 }, "east")).stops).toEqual([
      { defeated: ["north", "east"], options: ["south", "west"], won: false },
      { defeated: ["north", "east"], options: [], won: false },
    ]);
    expect(sweep(primed(watched, { north: 1 }, "north")).stops).toEqual([
      { defeated: ["north"], options: ["east", "south", "west"], won: false },
      { defeated: ["north"], options: [], won: false },
    ]);
  });

  it("each protected by the others' hit points: three held at 0, the fourth's last hit point takes all four", () => {
    const base = start({ row, protectedByOthers: true });
    const held = sweep(primed(base, { north: 1, east: 1, south: 1 }, "north"));
    expect(held.stops).toEqual([{ defeated: [], options: [], won: false }]);
    expect(defeatedEvents(held.events)).toBe(0);
    const last = sweep(primed(held.session.state, { west: 1 }, "north"));
    expect(last.stops).toEqual([{ defeated: [...NAMES], options: [], won: true }]);
    expect(defeatedEvents(last.events)).toBe(4);
    expect(counterMoves(last.events)).toEqual([]);
  });
});
