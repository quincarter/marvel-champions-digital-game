/**
 * `ValueSpec { kind: "refCount" }`: how many different cards a ref names, wherever they are. Med Lab (`rogue` 38028):
 * "(Limit 1 ally at a time.)" reads the number of cards tucked under it (`{ kind: "tuckedUnder", of: self }`). Tucked
 * cards are out of play (RRG 1.8 "Tuck", p. 45), so a `count` of cards in play never sees them. Synthetic cards: a
 * support with "Action: Tuck the top card of the encounter deck facedown here" and "Action: Draw 1 card for each card
 * tucked here".
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { resolveValue } from "./select.js";
import type { GameState } from "./state.js";
import type { ValueSpec } from "./spec.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCards, newGame, RESOURCE, runWith } from "./testing/scenario.js";

const p1 = playerId("p1");
const self = { kind: "self" } as const;
const TUCKED_HERE: ValueSpec = { kind: "refCount", of: { kind: "tuckedUnder", of: self } };
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

const TUCK = stubAbility("lab.tuck", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "tuckCards",
      cards: { kind: "encounter", zones: ["deck"], top: { kind: "const", value: 1 } },
      under: self,
      facedown: true,
    },
  ],
});
const DRAW = stubAbility("lab.draw", {
  trigger: { kind: "action" },
  effects: [{ kind: "draw", player: { kind: "controller" }, amount: TUCKED_HERE }],
});
const LAB = stubSupport({ id: "lab", cost: 0, abilities: [TUCK.ref, DRAW.ref] });
const OTHER = stubSupport({ id: "other", cost: 0, abilities: [] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const deps: EngineDeps = depsOf(TUCK, DRAW);

function setup(): { state: GameState; lab: InstanceId; other: InstanceId } {
  const state = newGame({
    villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] }),
    mainScheme: stubMainScheme({
      id: "main",
      stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
    }),
    extraCards: [BLANK, LAB, OTHER],
    deck: [LAB.id, OTHER.id, ...copies(RESOURCE.id, 20)],
    encounterDeck: copies(BLANK.id, 20),
    deps,
  });
  const given = giveCards(state, p1, LAB.id, OTHER.id);
  const [lab, other] = given.ids as readonly InstanceId[];
  const ready = runWith(
    deps,
    given.state,
    ...[lab!, other!].map((id): Command => ({
      type: "playCard",
      playerId: p1,
      cardInstanceId: id,
      payment: [],
      attachToInstanceId: null,
    })),
  );
  return { state: ready, lab: lab!, other: other! };
}
const use = (card: InstanceId, ability: StubAbility): Command => ({
  type: "useAbility",
  playerId: p1,
  cardInstanceId: card,
  abilityId: ability.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});
const run = (state: GameState, commands: readonly Command[]) =>
  driveSession(startSession(state), deps, commands, defaultPick);
const valueOn = (state: GameState, card: InstanceId, value: ValueSpec) =>
  resolveValue(state, value, { selfInstanceId: card, controllerId: p1, event: null, bindings: {}, deps }, deps);
const handSize = (state: GameState) => mustPlayer(state, p1).hand.length;

describe("refCount: the number of cards a ref names", () => {
  it("counts the cards tucked under this card: 0, then 1, then 2", () => {
    const s = setup();
    expect(valueOn(s.state, s.lab, TUCKED_HERE)).toBe(0);
    const one = run(s.state, [use(s.lab, TUCK)]).session.state;
    expect(mustInstance(one, s.lab).tucked).toHaveLength(1);
    expect(valueOn(one, s.lab, TUCKED_HERE)).toBe(1);
    const two = run(s.state, [use(s.lab, TUCK), use(s.lab, TUCK)]).session.state;
    expect(valueOn(two, s.lab, TUCKED_HERE)).toBe(2);
  });

  it("is read by an effect: 'draw 1 card for each card tucked here' draws 2", () => {
    const s = setup();
    const tucked = run(s.state, [use(s.lab, TUCK), use(s.lab, TUCK)]).session.state;
    const hand = handSize(tucked);
    const drawn = run(tucked, [use(s.lab, DRAW)]).session.state;
    expect(handSize(drawn)).toBe(hand + 2);
  });

  it("near miss: another card with nothing tucked under it reads 0", () => {
    const s = setup();
    const tucked = run(s.state, [use(s.lab, TUCK)]).session.state;
    expect(valueOn(tucked, s.other, TUCKED_HERE)).toBe(0);
  });

  it("near miss: a count of cards in play never sees a tucked card", () => {
    const s = setup();
    const tucked = run(s.state, [use(s.lab, TUCK)]).session.state;
    const inPlay: ValueSpec = { kind: "count", query: { categories: ["treachery"] } };
    expect(valueOn(tucked, s.lab, inPlay)).toBe(0);
  });

  it("names each card once: a ref naming the same card twice counts it once", () => {
    const s = setup();
    const twice: ValueSpec = { kind: "refCount", of: { kind: "slot", slot: "x" } };
    const value = resolveValue(
      s.state,
      twice,
      { selfInstanceId: s.lab, controllerId: p1, event: null, bindings: { x: [s.lab, s.lab, s.other] }, deps },
      deps,
    );
    expect(value).toBe(2);
  });

  it("replays deep-equal", () => {
    const s = setup();
    const { session } = run(s.state, [use(s.lab, TUCK), use(s.lab, DRAW)]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
