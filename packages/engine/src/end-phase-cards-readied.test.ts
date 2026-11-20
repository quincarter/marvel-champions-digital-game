/**
 * `TriggerEvent endPhaseCardsReadied` (#890 item 1): after RRG 1.8 "End of Player Phase" (p. 18) step 3, each player's
 * cards that were exhausted and are ready now, handed to an answering ability as slot `readied.cards`. Shaped like
 * Web-Sling (the `spider-punisher-tw` community pack): "Response: After you ready your cards at the end of the player
 * phase, for each 2 upgrades you readied this way, …" — here a support places one counter per readied upgrade.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const SLING = stubAbility("sling.response", {
  trigger: { kind: "response", forced: true, on: { on: "endPhaseCardsReadied", playerIs: "controller" } },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "self" },
      counterType: "readied",
      amount: { kind: "count", query: { categories: ["upgrade"], inSlot: "readied.cards" } },
    },
    { kind: "addCounters", target: { kind: "self" }, counterType: "heard", amount: { kind: "const", value: 1 } },
  ],
} satisfies AbilityDefinition);
/**
 * "… if at least two upgrades readied this way, place 1 'pair' counter here": a condition that only the real
 * announcement can meet (PR #903 review: the listener check before the step reads the event's kind alone).
 */
const PAIR = stubAbility("pair.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "endPhaseCardsReadied", playerIs: "controller" },
    while: {
      kind: "compare",
      left: { kind: "count", query: { categories: ["upgrade"], inSlot: "readied.cards" } },
      op: "atLeast",
      right: { kind: "const", value: 2 },
    },
  },
  effects: [
    { kind: "addCounters", target: { kind: "self" }, counterType: "pair", amount: { kind: "const", value: 1 } },
  ],
} as unknown as AbilityDefinition);
const SLING_CARD = stubSupport({ id: "sling", cost: 0, abilities: [SLING.ref] });
/** Only the conditional response: nothing else listens for the announcement. */
const PAIR_CARD = stubSupport({ id: "pair", cost: 0, abilities: [PAIR.ref] });
const GEAR = stubUpgrade({ id: "gear", cost: 0 });
const deps: EngineDeps = depsOf(SLING, PAIR);

function start(
  exhaustedGear: number,
  readyGear: number,
  listener = SLING_CARD,
): { state: GameState; sling: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [SLING_CARD, PAIR_CARD, GEAR],
    deps,
    deck: [listener.id, ...Array.from({ length: 6 }, () => GEAR.id)],
  });
  let state = base;
  const sling = playerCardIntoPlay(state, listener.id, P1);
  state = sling.state;
  for (let i = 0; i < exhaustedGear + readyGear; i += 1) {
    const put = playerCardIntoPlay(state, GEAR.id, P1);
    state =
      i < exhaustedGear
        ? {
            ...put.state,
            instances: { ...put.state.instances, [put.id]: { ...mustInstance(put.state, put.id), exhausted: true } },
          }
        : put.state;
  }
  // The identity is exhausted too: a readied card that is not an upgrade, left out of the count.
  const identity = mustPlayer(state, P1).identity.instanceId;
  state = {
    ...state,
    instances: { ...state.instances, [identity]: { ...mustInstance(state, identity), exhausted: true } },
  };
  return { state, sling: sling.id };
}

/** Ends the turn: the player phase's end, step 3 and its announcement included, resolves. */
function endPlayerPhase(state: GameState): GameState {
  const driven = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }], defaultPick);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  return driven.session.state;
}

describe("endPhaseCardsReadied: after you ready your cards at the end of the player phase (#890 item 1)", () => {
  it("hands over the upgrades the step readied: 3 exhausted readied, 2 already ready not counted", () => {
    const { state, sling } = start(3, 2);
    const after = endPlayerPhase(state);
    expect(mustInstance(after, sling).counters.heard).toBe(1);
    expect(mustInstance(after, sling).counters.readied).toBe(3);
  });

  it("with nothing exhausted it is still announced, with no upgrade readied", () => {
    const { state, sling } = start(0, 2);
    const after = endPlayerPhase(state);
    expect(mustInstance(after, sling).counters.heard).toBe(1);
    expect(mustInstance(after, sling).counters.readied ?? 0).toBe(0);
  });

  it("a response whose condition needs two readied upgrades hears it with three, not with one", () => {
    const three = start(3, 0, PAIR_CARD);
    expect(mustInstance(endPlayerPhase(three.state), three.sling).counters.pair).toBe(1);
    const one = start(1, 0, PAIR_CARD);
    expect(mustInstance(endPlayerPhase(one.state), one.sling).counters.pair ?? 0).toBe(0);
  });
});
