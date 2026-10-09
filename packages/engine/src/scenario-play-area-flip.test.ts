/**
 * docs/phase7-wave8.md §3.40 with §3.33: a card in an in-play scenario area that flips to its other face stays in that
 * area (`flipToOtherFace`).
 *
 * RRG 1.8 "Flip" (p. 20): a card that flips never leaves play, and with the same card type "the card retains all
 * attached cards, tucked cards, status cards, and tokens". MC45 p. 5: "Cards in the mission area are in play but under
 * no player's control." A [MISSION] side scheme turns to its [FINISHED] face inside the mission area, and that face
 * then clears the area (§4.1 Q20 = A): the face must still be there to be cleared with it. Synthetic cards only.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { locateCard, mustInstance } from "./query.js";
import { cardsInPlay, controllerOf } from "./select.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import {
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, playFree } from "./testing/wave3.js";

const AREA = "mission";
const INTO = { scenarioPlayArea: AREA } as const;
const THERE = { inScenarioPlayArea: AREA } as const;
const n = (value: number): ValueSpec => ({ kind: "const", value });
const you = { kind: "controller" } as const;
const self: TargetRef = { kind: "self" };
const find = (name: string): TargetRef => ({ kind: "find", query: { name } });

/** "When Defeated: Flip this card over." Its other face is a side scheme too, with hinder 2. */
const ERRAND_DEFEATED = stubAbility("errand.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [{ kind: "flipCard", target: self }],
});
const ERRAND = {
  ...stubSideScheme({ id: "errand", startingThreat: 5, boostIcons: 0, abilities: [ERRAND_DEFEATED.ref] }),
  otherFaceId: "errand-done" as CardId,
};
const ERRAND_DONE = {
  ...stubSideScheme({ id: "errand-done", startingThreat: 0, boostIcons: 0, keywords: [{ name: "hinder", value: 2 }] }),
  name: ERRAND.name,
  otherFaceId: ERRAND.id,
};
/** A minion whose other face is a side scheme of 3 threat: a flip to another card type. */
const SPY = { ...stubMinion({ id: "spy", atk: 1, sch: 1, hp: 4, boostIcons: 0 }), otherFaceId: "plot" as CardId };
const PLOT = { ...stubSideScheme({ id: "plot", startingThreat: 3, boostIcons: 0 }), otherFaceId: SPY.id };
const NOISE = stubTreachery({ id: "noise", boostIcons: 0 });

const action = (id: string, ...effects: EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const eachThere = (category: "sideScheme" | "minion"): TargetRef => ({
  kind: "each",
  query: { categories: [category], ...THERE },
});
const OPEN = action(
  "open",
  { kind: "createScenarioPlayArea", name: AREA, closed: true },
  { kind: "putIntoPlay", card: find(ERRAND.name), controller: you, into: INTO },
  { kind: "putIntoPlay", card: find(SPY.name), controller: you, into: INTO },
);
const MARK = action("mark", {
  kind: "addCounters",
  target: eachThere("sideScheme"),
  counterType: "attempt",
  amount: n(2),
});
const FLIP_SCHEME = action("flip-scheme", { kind: "flipCard", target: eachThere("sideScheme") });
const FLIP_MINION = action("flip-minion", { kind: "flipCard", target: eachThere("minion") });
/** "Remove 5 threat from the side scheme at the mission": not a thwart. */
const CLEAR = action("clear", { kind: "removeThreat", target: eachThere("sideScheme"), amount: n(5) });
/** "Remove each minion at the mission from the game." */
const SWEEP = action("sweep", {
  kind: "moveCards",
  cards: { kind: "ref", ref: eachThere("minion") },
  to: "removedFromGame",
});
/** "Place 2 threat on the side scheme at the mission." */
const PRESS = action("press", { kind: "placeThreat", target: eachThere("sideScheme"), amount: n(2) });
const EVENTS = [OPEN, MARK, FLIP_SCHEME, FLIP_MINION, CLEAR, SWEEP, PRESS];
/** "The side scheme there cannot be defeated while there are any minions there." */
const RULES: readonly RuleSpec[] = [
  {
    kind: "notDefeatedWithoutThreat",
    target: { categories: ["sideScheme"], ...THERE },
    while: { kind: "exists", query: { categories: ["minion"], ...THERE } },
  },
];

const SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const TYRANT = stubVillain({ id: "tyrant", stages: [{ hp: flat(40), atk: 0, sch: 0 }] });
const deps: EngineDeps = depsOf(ERRAND_DEFEATED, ...EVENTS.map((e) => e.ability));

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const idOf = (state: GameState, ...cardIds: readonly string[]): InstanceId => {
  const id = (Object.keys(state.instances) as InstanceId[]).find((key) =>
    cardIds.includes(state.instances[key]?.cardId ?? ""),
  );
  if (!id) throw new Error(`no ${cardIds.join()}`);
  return id;
};
const areaCards = (state: GameState) => state.scenarioPlayAreas?.[AREA]?.cards ?? [];
const play = (state: GameState, ...cards: readonly { card: { id: CardId } }[]) => {
  let current = state;
  const events: GameEvent[] = [];
  for (const { card } of cards) {
    const run = playFree(current, deps, card.id);
    current = run.state;
    events.push(...run.events);
  }
  return { state: current, events };
};

function start(): GameState {
  const base = gameAtFirstTurn({
    cards: [ERRAND, ERRAND_DONE, SPY, PLOT, NOISE, ...EVENTS.map((e) => e.card)],
    deps,
    villain: TYRANT,
    mainScheme: SCHEME,
    encounter: [ERRAND.id, SPY.id, ...copiesOf(NOISE.id, 14)],
    deck: EVENTS.map((e) => e.card.id),
    scenarioRuleSpecs: RULES,
  });
  return play(base, OPEN).state;
}

describe("§3.40 a card in a scenario play area that flips stays in it", () => {
  it("a side scheme flipped to a side scheme face keeps its place, its threat and its counters, and gains the new face's hinder", () => {
    const opened = start();
    const errand = idOf(opened, ERRAND.id);
    expect(mustInstance(opened, errand).threat).toBe(5);
    const run = play(opened, MARK, FLIP_SCHEME);
    expect(mustInstance(run.state, errand).cardId).toBe(ERRAND_DONE.id);
    expect(locateCard(run.state, errand)).toEqual({ kind: "scenarioPlayArea", name: AREA });
    expect(areaCards(run.state)).toContain(errand);
    expect(run.state.villainArea).not.toContain(errand);
    expect(controllerOf(run.state, errand)).toBeNull();
    // Same card type: tokens stay (RRG p. 20). The new face is treated as entering play: starting threat 0, hinder 2.
    expect(mustInstance(run.state, errand)).toMatchObject({ threat: 7, counters: { attempt: 2 } });
    expect(of(run.events, "cardFlippedToOtherFace")).toEqual([
      {
        type: "cardFlippedToOtherFace",
        instanceId: errand,
        from: ERRAND.id,
        to: ERRAND_DONE.id,
        typeChanged: false,
      },
    ]);
    // Nothing moved the card.
    expect(of(run.events, "cardMoved").filter((e) => e.instanceId === errand)).toEqual([]);
  });

  it("a minion there flipped to a side scheme face stays in the area, not the villain's: the type's own tokens are cleared and the scheme has its starting threat", () => {
    const opened = start();
    const spy = idOf(opened, SPY.id);
    const run = play(opened, FLIP_MINION);
    expect(mustInstance(run.state, spy)).toMatchObject({ cardId: PLOT.id, threat: 3, damage: 0, engagedWith: null });
    expect(locateCard(run.state, spy)).toEqual({ kind: "scenarioPlayArea", name: AREA });
    expect(run.state.villainArea).not.toContain(spy);
    expect(controllerOf(run.state, spy)).toBeNull();
    expect(of(run.events, "cardMoved").filter((e) => e.instanceId === spy)).toEqual([]);
    // It is a side scheme of the area now: the area's query finds two.
    expect(areaCards(run.state).filter((id) => mustInstance(run.state, id).cardId !== SPY.id)).toHaveLength(2);
  });

  it("a side scheme there whose When Defeated flips it is defeated once, shows its other face in the area and is not discarded", () => {
    const opened = play(start(), SWEEP).state;
    const errand = idOf(opened, ERRAND.id);
    const run = play(opened, CLEAR);
    expect(of(run.events, "schemeDefeated").map((e) => e.instanceId)).toEqual([errand]);
    expect(mustInstance(run.state, errand).cardId).toBe(ERRAND_DONE.id);
    expect(cardsInPlay(run.state)).toContain(errand);
    expect(locateCard(run.state, errand)).toEqual({ kind: "scenarioPlayArea", name: AREA });
    expect(of(run.events, "cardMoved").filter((e) => e.instanceId === errand)).toEqual([]);
    expect(run.state.villainArea).not.toContain(errand);
  });

  it("kept in play at no threat while a minion is there, it is defeated the moment the last minion leaves the area, with no defeating player; its When Defeated flips it where it is", () => {
    const opened = start();
    const errand = idOf(opened, ERRAND.id);
    const held = play(opened, CLEAR);
    expect(of(held.events, "schemeDefeated")).toEqual([]);
    expect(mustInstance(held.state, errand)).toMatchObject({ cardId: ERRAND.id, threat: 0 });
    expect(cardsInPlay(held.state)).toContain(errand);
    expect(held.state.heldAtNoThreat).toEqual([errand]);

    const run = play(held.state, SWEEP);
    expect(of(run.events, "defeatProtectionEnded").map((e) => e.instanceId)).toEqual([errand]);
    expect(of(run.events, "schemeDefeated")).toEqual([
      { type: "schemeDefeated", instanceId: errand, cardId: ERRAND.id },
    ]);
    expect(mustInstance(run.state, errand).cardId).toBe(ERRAND_DONE.id);
    expect(locateCard(run.state, errand)).toEqual({ kind: "scenarioPlayArea", name: AREA });
    expect("heldAtNoThreat" in run.state).toBe(false);
    const resolvedDefeat = run.events.find(
      (e) => e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "schemeDefeated",
    );
    expect(resolvedDefeat).toMatchObject({ event: { defeatedByPlayerId: null, sourceInstanceId: null } });
  });

  it("with threat on it again before the last minion leaves, it is no longer watched and is not defeated", () => {
    const opened = start();
    const errand = idOf(opened, ERRAND.id);
    const pressed = play(opened, CLEAR, PRESS);
    expect(mustInstance(pressed.state, errand).threat).toBe(2);
    expect("heldAtNoThreat" in pressed.state).toBe(false);
    const run = play(pressed.state, SWEEP);
    expect(of(run.events, "schemeDefeated")).toEqual([]);
    expect(mustInstance(run.state, errand)).toMatchObject({ cardId: ERRAND.id, threat: 2 });
  });
});
