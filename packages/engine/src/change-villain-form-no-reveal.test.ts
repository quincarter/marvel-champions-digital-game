/**
 * docs/phase7-wave8.md §3.26: `EffectSpec changeVillainForm { reveal: false }`, a three-sided villain's change of form
 * that is a flip and not a reveal.
 *
 * Sources: RRG 1.8 "Flip" (p. 20: "A foldable, 'three-sided' card is considered to have flipped any time the faceup
 * side of the card changes"; a flip to a face of the same type keeps attached cards, status cards and tokens). The Age
 * of Apocalypse rulebook (MC45 p. 19, quoted in docs/phase7-wave8.md §2.9): changing Apocalypse's form "is NOT the
 * same as 'defeating' or 'revealing' the villain". The default (no flag) stays the villain flip that reveals its new
 * face (FAQ "Dial M for Mojo (#35)", RRG 1.8 p. 64), which this file pins beside the flag. Synthetic cards only.
 */

import { flat, trait, type VillainCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import { activeVillain, characterStat, mustInstance, villainOf } from "./query.js";
import type { EffectSpec, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import {
  stubEnvironment,
  stubEvent,
  stubMainScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const one = { kind: "const", value: 1 } as const;
const self = { kind: "self" } as const;
const SHELL = trait("SHELL");
const WIRE = trait("WIRE");
const TOWER = trait("TOWER");
const counter = (id: string, counterType: string, on: StubAbility["definition"]["trigger"]) =>
  stubAbility(id, { trigger: on, effects: [{ kind: "addCounters", target: self, counterType, amount: one }] });

/** Each face: "When Revealed: place 1 revealed counter here." */
const FACE_REVEALED = counter("morph.when-revealed", "revealed", { kind: "whenRevealed" });
/** Each face: "Forced Response: After this villain changes to this form, place 1 changed counter here." */
const FACE_CHANGED = counter("morph.forced-response", "changed", {
  kind: "response",
  forced: true,
  on: { on: "cardFlipped", selfIs: "target" },
});
const face = (form: typeof SHELL, atk: number, sch: number) =>
  stubVillain({
    id: `face-${String(form)}`,
    stages: [{ hp: flat(16), atk, sch, traits: [form], abilities: [FACE_REVEALED.ref, FACE_CHANGED.ref] }],
  }).sides[0].stages;
/** One stage card with three faces: A Shell (ATK 2, SCH 2), B Wire (ATK 1, SCH 3), C Tower (ATK 3, SCH 1). */
const MORPH: VillainCard = {
  ...stubVillain({ id: "morph", stages: [{ hp: flat(16), atk: 2, sch: 2 }] }),
  sides: [
    { side: "A", name: "morph", stages: face(SHELL, 2, 2) },
    { side: "B", name: "morph", stages: face(WIRE, 1, 3) },
    { side: "C", name: "morph", stages: face(TOWER, 3, 1) },
  ],
};
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(50), acceleration: flat(0) }],
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const ENCOUNTER_CARD: TargetQuery = {
  categories: ["villain", "mainScheme", "sideScheme", "minion", "treachery", "attachment", "environment", "obligation"],
  controller: "encounter",
};
/** "Each other encounter card gains incite 1": resolves whenever a card is revealed, a villain's new face included. */
const DIAL_GRANT = stubAbility("dial.constant", {
  trigger: {
    kind: "constant",
    keywordGrants: [{ keyword: { name: "incite", value: 1 }, target: { ...ENCOUNTER_CARD, self: false } }],
  },
  effects: [],
});
const DIAL = stubEnvironment({ id: "dial", abilities: [DIAL_GRANT.ref] });
/** A player's support that hears every reveal: the "when revealed" window and the "after revealed" one. */
const SAW_REVEALING = counter("spy.interrupt", "sawRevealing", {
  kind: "interrupt",
  forced: true,
  on: { on: "encounterCardRevealing" },
});
const SAW_REVEALED = counter("spy.response", "sawRevealed", {
  kind: "response",
  forced: true,
  on: { on: "cardRevealed" },
});
const SPY = stubSupport({ id: "spy", cost: 0, abilities: [SAW_REVEALING.ref, SAW_REVEALED.ref] });

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const villain = { kind: "villain" } as const;
/** "Change the villain to [Wire] form", under a rulebook that says the change is not a reveal. */
const TO_WIRE = action("to-wire", [{ kind: "changeVillainForm", villain, toFaceWithTrait: WIRE, reveal: false }]);
const TO_SHELL = action("to-shell", [{ kind: "changeVillainForm", villain, toFaceWithTrait: SHELL, reveal: false }]);
/** The same change with no flag: a villain's flip, whose new face is revealed. */
const TO_TOWER_REVEALED = action("to-tower", [{ kind: "changeVillainForm", villain, toFaceWithTrait: TOWER }]);
const ACTIONS = [TO_WIRE, TO_SHELL, TO_TOWER_REVEALED];

const deps: EngineDeps = depsOf(
  FACE_REVEALED,
  FACE_CHANGED,
  DIAL_GRANT,
  SAW_REVEALING,
  SAW_REVEALED,
  ...ACTIONS.map((a) => a.ability),
);

/** P1's first turn, the villain on its Shell face with 7 damage and a tough status card, Dial and the spy in play. */
function start() {
  const begun = gameAtFirstTurn({
    cards: [DIAL, BLANK, SPY, ...ACTIONS.map((a) => a.card)],
    deps,
    villain: MORPH,
    mainScheme: SCHEME,
    encounter: [DIAL.id, ...copiesOf(BLANK.id, 20)],
    deck: [SPY.id, ...ACTIONS.map((a) => a.card.id)],
  });
  const dialed = encounterCardInVillainArea(begun, DIAL.id).state;
  const spied = playerCardIntoPlay(dialed, SPY.id);
  const id = activeVillain(spied.state).instanceId;
  const state: GameState = {
    ...spied.state,
    instances: {
      ...spied.state.instances,
      [id]: {
        ...mustInstance(spied.state, id),
        damage: 7,
        statuses: { ...mustInstance(spied.state, id).statuses, tough: 1 },
      },
    },
  };
  return { state, villainId: id, spy: spied.id };
}

const threat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const counters = (state: GameState, id: string) => mustInstance(state, id as never).counters;
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

describe("§3.26 changeVillainForm with reveal: false", () => {
  it("the face turns and 'after it changes to this form' resolves, with no reveal step: no When Revealed, no incite, no reveal windows, nothing logged as revealed", () => {
    const at = start();
    expect(villainOf(at.state, at.villainId)?.side).toBe("A");
    const run = playFree(at.state, deps, TO_WIRE.card.id);

    expect(villainOf(run.state, at.villainId)?.side).toBe("B");
    expect(of(run.events, "villainFlipped")).toEqual([
      { type: "villainFlipped", instanceId: at.villainId, from: "A", to: "B" },
    ]);
    // The flip is raised: the new face's Forced Response resolved once.
    expect(counters(run.state, at.villainId).changed).toBe(1);
    // No reveal: the face's When Revealed did not resolve, incite 1 placed no threat, and nothing heard a reveal.
    expect(counters(run.state, at.villainId).revealed).toBe(counters(at.state, at.villainId).revealed);
    expect(threat(run.state)).toBe(threat(at.state));
    expect(counters(run.state, at.spy).sawRevealing ?? 0).toBe(0);
    expect(counters(run.state, at.spy).sawRevealed ?? 0).toBe(0);
    expect(of(run.events, "encounterCardRevealed")).toHaveLength(0);
    // The new face's stats are read at once; damage and the status card stay (RRG 1.8 "Flip", p. 20).
    expect(characterStat(run.state, at.villainId, "sch", deps)).toBe(3);
    expect(characterStat(run.state, at.villainId, "atk", deps)).toBe(1);
    expect(mustInstance(run.state, at.villainId).damage).toBe(7);
    expect(mustInstance(run.state, at.villainId).statuses.tough).toBe(1);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.session.state);
  });

  it("a change to the form already showing is no change: no flip, no Forced Response", () => {
    const at = start();
    const run = playFree(at.state, deps, TO_SHELL.card.id);
    expect(villainOf(run.state, at.villainId)?.side).toBe("A");
    expect(of(run.events, "villainFlipped")).toHaveLength(0);
    expect(counters(run.state, at.villainId).changed ?? 0).toBe(0);
    expect(threat(run.state)).toBe(threat(at.state));
  });

  it("without the flag the change is still a villain flip that reveals its new face: When Revealed, incite and the reveal windows", () => {
    const at = start();
    const run = playFree(at.state, deps, TO_TOWER_REVEALED.card.id);
    expect(villainOf(run.state, at.villainId)?.side).toBe("C");
    expect(counters(run.state, at.villainId).changed).toBe(1);
    expect(counters(run.state, at.villainId).revealed).toBe((counters(at.state, at.villainId).revealed ?? 0) + 1);
    expect(threat(run.state)).toBe(threat(at.state) + 1);
    expect(counters(run.state, at.spy).sawRevealed).toBe(1);
    expect(of(run.events, "encounterCardRevealed").map((e) => e.instanceId)).toEqual([at.villainId]);
  });
});
