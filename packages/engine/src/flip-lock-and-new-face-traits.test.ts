/**
 * Two existing primitives a custom-content hero (Night Thrasher's Battle Board, a double-sided permanent upgrade with a
 * Vehicle face and a Weapon face) leans on, checked together:
 *
 * - "You cannot flip the Battle Board upgrade until the start of the next villain phase." (Practice): `applyRuleUntil`
 *   with a `cannotFlip` rule and `"nextVillainPhaseBegins"` (a lasting rule, RRG 1.8 "Lasting Effects", p. 26).
 * - "Flip the Battle Board upgrade. Then, if it has the Weapon trait, …": a trait check after a flip in the same
 *   ability reads the face now showing (RRG 1.8 "Flip", p. 20; "Traits", p. 45).
 *
 * Synthetic cards, one seat: the board (front trait Vehicle, back trait Weapon) and two events.
 */

import { trait, type AnyCard, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { applyCommand, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import { cannotFlip } from "./rules.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubUpgrade } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const VEHICLE = trait("Vehicle");
const WEAPON = trait("Weapon");
const def = (definition: AbilityDefinition) => definition;
const yourBoard: TargetQuery = {
  categories: ["upgrade"],
  anyTrait: [VEHICLE, WEAPON],
  controlledBy: { kind: "controller" },
};
const board = { kind: "each", query: yourBoard } as const;

/** "You cannot flip your board until the start of the next villain phase." */
const PRACTICE = stubAbility(
  "practice.action",
  def({
    trigger: { kind: "action" },
    effects: [
      { kind: "applyRuleUntil", rule: { kind: "cannotFlip", target: yourBoard }, until: "nextVillainPhaseBegins" },
    ],
  }),
);
/** "Flip your board. Then, if it has the Weapon trait, place 1 hit counter on it." */
const KICKFLIP = stubAbility(
  "kickflip.action",
  def({
    trigger: { kind: "action" },
    effects: [
      { kind: "flipCard", target: board },
      {
        kind: "if",
        condition: { kind: "exists", query: { ...yourBoard, trait: WEAPON } },
        then: [{ kind: "addCounters", target: board, counterType: "hit", amount: { kind: "const", value: 1 } }],
      },
    ],
  }),
);
const PRACTICE_CARD = stubEvent({ id: "practice", cost: 0, abilities: [PRACTICE.ref] });
const KICKFLIP_CARD = stubEvent({ id: "kickflip", cost: 0, abilities: [KICKFLIP.ref] });
const BOARD: UpgradeCard = {
  ...stubUpgrade({ id: "board", cost: 0, traits: [VEHICLE], keywords: [{ name: "permanent" }] }),
  flipSide: {
    name: "board",
    traits: [WEAPON],
    keywords: [{ name: "permanent" }],
    text: { printed: "", current: "" },
    abilities: [],
  },
};

const deps: EngineDeps = depsOf(PRACTICE, KICKFLIP);
const CARDS: readonly AnyCard[] = [PRACTICE_CARD, KICKFLIP_CARD, BOARD];

function start(): { state: GameState; board: InstanceId } {
  const base = gameAtFirstTurn({ cards: CARDS, deps, deck: [BOARD.id, PRACTICE_CARD.id, KICKFLIP_CARD.id] });
  const put = playerCardIntoPlay(base, BOARD.id);
  return { state: put.state, board: put.id };
}

function play(state: GameState, card: AnyCard): GameState {
  const given = giveCard(state, P1, card.id);
  const result = applyCommand(
    given.state,
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

describe("Practice: cannotFlip until the next villain phase begins", () => {
  it("the board cannot flip after it, and can again once the villain phase has begun", () => {
    const s = start();
    expect(cannotFlip(s.state, deps, s.board)).toBe(false);
    const locked = play(s.state, PRACTICE_CARD);
    expect(cannotFlip(locked, deps, s.board)).toBe(true);
    // A flip effect leaves it as it is.
    const tried = play(locked, KICKFLIP_CARD);
    expect(mustInstance(tried, s.board).flipped).toBe(false);
    const { session } = driveSession(startSession(locked), deps, [{ type: "endTurn", playerId: P1 }]);
    expect(cannotFlip(session.state, deps, s.board)).toBe(false);
  });
});

describe("a trait check after a flip in the same ability reads the new face", () => {
  it("Vehicle flipped to Weapon: the Weapon branch resolves", () => {
    const s = start();
    const after = play(s.state, KICKFLIP_CARD);
    expect(mustInstance(after, s.board).flipped).toBe(true);
    expect(mustInstance(after, s.board).counters.hit ?? 0).toBe(1);
  });

  it("Weapon flipped back to Vehicle: the Weapon branch does not resolve", () => {
    const s = start();
    const once = play(s.state, KICKFLIP_CARD);
    const twice = play(once, KICKFLIP_CARD);
    expect(mustInstance(twice, s.board).flipped).toBe(false);
    expect(mustInstance(twice, s.board).counters.hit ?? 0).toBe(1);
  });
});
