/**
 * `EffectSpec discardFacedownBoostCards` (docs/phase7-elektra-iron-fist.md §5, Moon Knight 63039's "Discard 1 boost card
 * from the attacker"): facedown boost cards taken off an enemy before its flip step are discarded unturned, so the
 * activation turns up only the rest and they add nothing (RRG 1.8 "Boost, Boost Icon", p. 11). Synthetic cards: the
 * villain is given 2 facedown boost cards outside its activation (they wait for it, p. 11), and a forced interrupt to
 * its activation discards some of them before its own boost card is dealt.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import { mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, playFree } from "./testing/wave3.js";

const ONE_ICON = stubTreachery({ id: "one-icon", boostIcons: 1 });
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 1 }] });

/** "Give the villain 2 facedown boost cards." */
const GIFT = stubAbility("gift.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "giveBoostCard", enemy: { kind: "villain" }, count: { kind: "const", value: 2 } }],
});
const GIFT_CARD = stubEvent({ id: "gift", cost: 0, abilities: [GIFT.ref] });

/** "Forced Interrupt: When the villain activates, discard `n` of its facedown boost cards." */
const shedding = (n: number) =>
  stubAbility(`shed-${n}.forced-interrupt`, {
    trigger: { kind: "interrupt", forced: true, on: { on: "enemyActivating", sourceIs: { categories: ["villain"] } } },
    effects: [
      {
        kind: "discardFacedownBoostCards",
        from: { kind: "eventSource" },
        ...(n === 1 ? {} : { count: { kind: "const", value: n } }),
      },
    ],
  });

function start(deps: EngineDeps, abilities: readonly StubAbility[]): GameState {
  return gameAtFirstTurn({
    cards: [ONE_ICON, GIFT_CARD],
    deps,
    villain: VILLAIN,
    mainScheme: stubMainScheme({
      id: "scheme",
      stages: [
        {
          startingThreat: flat(0),
          targetThreat: flat(99),
          acceleration: flat(0),
          abilities: abilities.map((a) => a.ref),
        },
      ],
    }),
    encounter: copiesOf(ONE_ICON.id, 30),
    deck: copiesOf(GIFT_CARD.id, 2),
  });
}

/** Plays the gift, then the villain schemes (the hero is in alter-ego form) in the villain phase. */
function villainPhase(abilities: readonly StubAbility[]) {
  const deps = depsOf(GIFT, ...abilities);
  const gifted = playFree(start(deps, abilities), deps, GIFT_CARD.id).state;
  const given = mustInstance(gifted, gifted.activeVillainId!).boostCards;
  const step = gifted.step;
  if (step.kind !== "turn") throw new Error(step.kind);
  const { session, events } = driveSession(startSession(gifted), deps, [
    { type: "endTurn", playerId: step.activePlayerId },
  ]);
  const state = session.state;
  const discarded = events.flatMap((e) =>
    e.type === "boostCancelled" && e.scope === "discarded" ? [e.instanceId] : [],
  );
  const flipped = events.flatMap((e) => (e.type === "boostCardFlipped" ? [e.instanceId] : []));
  return {
    deps,
    session,
    state,
    given,
    discarded,
    flipped,
    threat: mustInstance(state, state.mainScheme.instanceId).threat,
  };
}

describe("discardFacedownBoostCards: facedown boost cards discarded unturned before the flip step", () => {
  it("without it: SCH 1 + the 2 given cards + the villain's own boost card", () => {
    expect(villainPhase([]).threat).toBe(4);
  });

  it("discards 1 (the first dealt): it is never turned faceup and adds nothing; replay deep-equal", () => {
    const { deps, session, state, given, discarded, flipped, threat } = villainPhase([shedding(1)]);
    expect(threat).toBe(3);
    expect(discarded).toEqual([given[0]]);
    expect(flipped).not.toContain(given[0]);
    expect(flipped).toContain(given[1]);
    const deckId = Object.keys(state.encounterDecks)[0]!;
    expect(state.encounterDecks[deckId]!.discard).toContain(given[0]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a count beyond the facedown cards discards each of them, and no more", () => {
    const { given, discarded, threat } = villainPhase([shedding(5)]);
    // SCH 1 + only the villain's own boost card, dealt after the interrupt.
    expect(threat).toBe(2);
    expect(discarded).toEqual(given);
  });
});
