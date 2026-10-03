/**
 * An optional ability that only tucks the card a ref names has that card as its target (docs/phase7-wave6.md §3.57).
 * Ruling Dec 17, 2025 (4) #2: "Med Lab can target allies from out-of-play areas that are still in the game, such as a
 * player's discard pile. It **cannot** target allies that have been removed from the game. Because Odin is removed from
 * the game via a Forced Interrupt, he is removed before Med Lab's Response can trigger, making him untargetable." RRG
 * 1.8 "Cost" (p. 13): a cost cannot be paid when the effect needs a target and has none, so Med Lab is not exhausted.
 *
 * Synthetic cards: Med Lab's response as printed (optional, "exhaust this card →"), an ally defeated by its own
 * consequential damage, and Odin's shape ("Forced Interrupt: When this ally is defeated, remove it from the game").
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { CardId } from "@mc/content";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubMinion, stubSupport } from "./testing/fixtures.js";
import { defaultPick, TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const LAB_RESPONSE = stubAbility("lab.response", {
  trigger: {
    kind: "response",
    forced: false,
    on: { on: "characterDefeated", targetIs: { categories: ["ally"] }, consequential: true },
  },
  cost: { exhaustSelf: true },
  effects: [{ kind: "tuckCards", cards: { kind: "ref", ref: { kind: "eventTarget" } }, under: { kind: "self" } }],
});
const LAB = stubSupport({ id: "lab", cost: 0, abilities: [LAB_RESPONSE.ref] });
const PATIENT = stubAlly({ id: "patient", cost: 0, atk: 1, thw: 1, hp: 1, consequentialAttack: 1 });
const KING_INTERRUPT = stubAbility("king.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "characterDefeated", selfIs: "target" } },
  effects: [{ kind: "setDefeatDestination", to: "removedFromGame" }],
});
const KING = stubAlly({
  id: "king",
  cost: 0,
  atk: 1,
  thw: 1,
  hp: 1,
  consequentialAttack: 1,
  abilities: [KING_INTERRUPT.ref],
});
const TANK = stubMinion({ id: "tank", atk: 0, sch: 0, hp: 20 });
const deps: EngineDeps = depsOf(LAB_RESPONSE, KING_INTERRUPT);

/** The ally attacks a minion and is defeated by its consequential damage; Med Lab's response is taken if offered. */
function defeat(ally: CardId) {
  const start = gameAtFirstTurn({
    cards: [LAB, PATIENT, KING, TANK],
    deps,
    deck: [LAB.id, PATIENT.id, KING.id],
    encounter: [...copiesOf(TREACHERY.id, 28), TANK.id],
  });
  const lab = playerCardIntoPlay(start, LAB.id);
  const attacker = playerCardIntoPlay(lab.state, ally);
  const tank = minionEngagedWith(attacker.state, TANK.id);
  let offered = false;
  const pick = (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind !== "chooseTriggers") return defaultPick(state);
    const mine = choice.options.filter((o) => o.optionId.includes(LAB_RESPONSE.ref.id)).map((o) => o.optionId);
    offered ||= mine.length > 0;
    return mine;
  };
  const { session } = driveSession(
    startSession(tank.state),
    deps,
    [{ type: "basicAttack", playerId: P1, attackerInstanceId: attacker.id, targetInstanceId: tank.id }],
    pick,
  );
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, offered, lab: mustInstance(session.state, lab.id), ally: attacker.id };
}

describe("an optional tuck of the card a ref names: ruling Dec 17, 2025 (4) #2", () => {
  it("an ally in the discard pile is a target: the response is offered, its cost paid, the ally tucked", () => {
    const result = defeat(PATIENT.id);
    expect(result.offered).toBe(true);
    expect(result.lab.exhausted).toBe(true);
    expect(result.lab.tucked).toEqual([result.ally]);
    expect(mustPlayer(result.state, P1).discard).not.toContain(result.ally);
  });

  it("an ally removed from the game is no target: the response is not offered and no cost is paid", () => {
    const result = defeat(KING.id);
    expect(result.state.removedFromGame).toContain(result.ally);
    expect(result.offered).toBe(false);
    expect(result.lab.exhausted).toBe(false);
    expect(result.lab.tucked ?? []).toEqual([]);
  });
});
