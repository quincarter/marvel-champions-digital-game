/**
 * docs/phase7-wave7.md §3.76: `ValueSpec accelerationTokens { on }`, the acceleration tokens on a card as a number.
 * Synthetic cards shaped like Cable (`deadpool` 44002: "+1 THW and +1 ATK for each acceleration token on the main
 * scheme (to a maximum of +3 THW and +3 ATK)"), Exhausting Personality (44003: "draws 1 card for each acceleration
 * token on the main scheme") and It Ain't Over... (44011: "by 2 for each acceleration token on it").
 *
 * Sources: RRG 1.8 "Acceleration Token" (p. 5): "Acceleration tokens placed on cards other than the main scheme still
 * add threat to the main scheme during step one" (so they are in play, and not on the main scheme), and "Acceleration
 * tokens are not considered acceleration icons, and vice versa."
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { characterProfile, mustInstance } from "./query.js";
import { iconsInPlay } from "./rules.js";
import { resolveValue } from "./select.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubEvent, stubMainScheme, stubSideScheme, stubSupport, stubTreachery } from "./testing/fixtures.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  P1,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const mainScheme: TargetRef = { kind: "mainScheme" };
const prey: TargetRef = { kind: "each", query: { categories: ["sideScheme"], name: "prey" } };
const everyScheme: TargetRef = { kind: "each", query: { categories: ["scheme"] } };
const tokensOn = (on: TargetRef): ValueSpec => ({ kind: "accelerationTokens", on });
const upTo3: ValueSpec = { kind: "scaled", value: tokensOn(mainScheme), max: 3 };

/** A stage printing an acceleration icon, which is not a token. */
const PLAN = stubMainScheme({
  id: "plan",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(1), icons: ["acceleration"] }],
});
const PREY = stubSideScheme({ id: "prey", startingThreat: 3, boostIcons: 0 });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

/** "Gets +1 THW and +1 ATK for each acceleration token on the main scheme (to a maximum of +3 THW and +3 ATK)." */
const PARTNER_RULE = stubAbility("partner.constant", {
  trigger: {
    kind: "constant",
    modifiers: [
      { stat: "atk", amount: upTo3, target: { self: true } },
      { stat: "thw", amount: upTo3, target: { self: true } },
    ],
  },
  effects: [],
});
const PARTNER = stubAlly({ id: "partner", cost: 0, atk: 1, thw: 2, hp: 3, abilities: [PARTNER_RULE.ref] });
const LEDGER = stubSupport({ id: "ledger", cost: 0 });
const ledger: TargetRef = { kind: "each", query: { categories: ["support"], name: "ledger" } };

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const TOKEN = event("token", [{ kind: "addAccelerationToken" }]);
const TOKEN_ON_PREY = event("token-on-prey", [{ kind: "addAccelerationToken", target: prey }]);
/** "For each acceleration token on the main scheme", read as the effect resolves. */
const TALLY = event("tally", [
  { kind: "addCounters", target: ledger, counterType: "tally", amount: tokensOn(mainScheme) },
]);
const EVENTS = [TOKEN, TOKEN_ON_PREY, TALLY];

const deps: EngineDeps = depsOf(PARTNER_RULE, ...EVENTS.map((e) => e.ability));

function start(): GameState {
  const state = gameAtFirstTurn({
    cards: [PLAN, PREY, FILLER, PARTNER, LEDGER, ...EVENTS.map((e) => e.card)],
    deps,
    mainScheme: PLAN,
    encounter: [PREY.id, ...copiesOf(FILLER.id, 30)],
    deck: [PARTNER.id, LEDGER.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 5))],
  });
  return encounterCardInVillainArea(state, PREY.id, 3).state;
}

const read = (state: GameState, value: ValueSpec): number =>
  resolveValue(state, value, { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps });
const preyId = (state: GameState): InstanceId =>
  state.villainArea.find((id) => mustInstance(state, id).cardId === PREY.id)!;
const tokens = (state: GameState, count: number): GameState => {
  let next = state;
  for (let placed = 0; placed < count; placed++) next = playFree(next, deps, TOKEN.card.id).state;
  return next;
};

describe("§3.76 acceleration tokens on a card as a number", () => {
  it("counts the main scheme's tokens: 0, then 1, then 2", () => {
    const state = start();
    expect(read(state, tokensOn(mainScheme))).toBe(0);
    expect(read(tokens(state, 1), tokensOn(mainScheme))).toBe(1);
    expect(read(tokens(state, 2), tokensOn(mainScheme))).toBe(2);
  });

  it("an acceleration icon is not a token (RRG 1.8 'Acceleration Token', p. 5)", () => {
    const state = start();
    expect(iconsInPlay(state, deps, "acceleration")).toBe(1);
    expect(read(state, tokensOn(mainScheme))).toBe(0);
  });

  it("a token on another card is on that card, not on the main scheme", () => {
    const state = playFree(tokens(start(), 2), deps, TOKEN_ON_PREY.card.id).state;
    expect(mustInstance(state, preyId(state)).counters["acceleration"]).toBe(1);
    expect(read(state, tokensOn(mainScheme))).toBe(2);
    expect(read(state, tokensOn(prey))).toBe(1);
    // Every card the reference names, each once.
    expect(read(state, tokensOn(everyScheme))).toBe(3);
  });

  it("a reference naming no card reads 0", () => {
    const state = tokens(start(), 1);
    expect(read(state, tokensOn({ kind: "each", query: { categories: ["sideScheme"], name: "absent" } }))).toBe(0);
  });

  it("a constant reads it live: +1 ATK and +1 THW per token, to a maximum of +3", () => {
    const { state, id } = playerCardIntoPlay(start(), PARTNER.id);
    const stats = (s: GameState) => {
      const profile = characterProfile(s, id, deps);
      return [profile?.atk, profile?.thw];
    };
    expect(stats(state)).toEqual([1, 2]);
    expect(stats(tokens(state, 1))).toEqual([2, 3]);
    expect(stats(tokens(state, 3))).toEqual([4, 5]);
    expect(stats(tokens(state, 4))).toEqual([4, 5]);
    // A token on a side scheme adds nothing.
    expect(stats(playFree(state, deps, TOKEN_ON_PREY.card.id).state)).toEqual([1, 2]);
  });

  it("an effect reads it as it resolves; replay deep-equal", () => {
    const ready = playerCardIntoPlay(tokens(start(), 2), LEDGER.id);
    const { state, session } = playFree(ready.state, deps, TALLY.card.id);
    expect(mustInstance(state, ready.id).counters["tally"]).toBe(2);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
