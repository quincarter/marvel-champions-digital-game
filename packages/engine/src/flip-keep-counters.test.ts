/**
 * docs/phase7-wave9.md §3.26, §4.1 Q1 = A (the owner's answer of 2026-10-10): a flip to another card type that keeps
 * named counters (`EffectSpec flipCard` with `keepCounters`). Synthetic cards shaped like the Board Members, `aos`
 * 50181a/b: an environment "If there are 4 or more secret counters here, flip this card." whose other face is
 * "Attach to the villain. Permanent. Forced Response: After a secret counter is placed here, …" with +1 ATK.
 *
 * Sources: RRG 1.8 "Flip" (p. 20: a different card type discards "all attached cards, tucked cards, status cards, and
 * tokens"), which the owner's answer sets aside for the counters the card data names (MC50 pp. 11 and 19 count the
 * secret counters on a Board Member that became an attachment; RRG 1.8 "The Golden Rules", p. 4); "Attach To" (p. 8);
 * "Permanent" (p. 32).
 */

import { trait, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { characterStat, locateCard, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAttachment, stubEnvironment, stubEvent, stubUpgrade } from "./testing/fixtures.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const self: TargetRef = { kind: "self" };
const one: ValueSpec = { kind: "const", value: 1 };
const BOARD = trait("BOARD");
const eachBoardCard: TargetRef = { kind: "each", query: { trait: BOARD } };
const atFour = { kind: "counterAtLeast", of: self, counterType: "secret", amount: 4 } as const;

/** "If there are 4 or more secret counters here, flip this card.", the counters kept (Q1 = A). */
const TURN = stubAbility("officer.turn", {
  trigger: { kind: "stateCheck", when: atFour },
  effects: [{ kind: "flipCard", target: self, keepCounters: ["secret"] }],
});
/** The same text as RRG 1.8 "Flip" alone reads it: a plain flip, every token discarded. */
const TURN_BARE = stubAbility("clerk.turn", {
  trigger: { kind: "stateCheck", when: atFour },
  effects: [{ kind: "flipCard", target: self }],
});
/** "Forced Response: After a secret counter is placed here, …": counts its own resolutions. */
const PLACED = stubAbility("aid.placed", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "countersPlaced", selfIs: "target", eventIs: { counterType: "secret" } },
  },
  effects: [{ kind: "addCounters", target: self, counterType: "answered", amount: one }],
});

const faces = <A extends AnyCard, B extends AnyCard>(a: A, b: B): readonly [A, B] => [
  { ...a, otherFaceId: b.id as CardId },
  { ...b, otherFaceId: a.id as CardId },
];
const aid = (id: string): AnyCard => ({
  ...stubAttachment({
    id,
    attachesTo: { kind: "villain" },
    statModifiers: { atk: 1 },
    keywords: [{ name: "permanent" }],
    abilities: [PLACED.ref],
  }),
  traits: [BOARD],
});
const [OFFICER, OFFICER_AID] = faces(
  stubEnvironment({ id: "officer", traits: [BOARD], abilities: [TURN.ref] }),
  aid("officer-aid"),
);
const [CLERK, CLERK_AID] = faces(
  stubEnvironment({ id: "clerk", traits: [BOARD], abilities: [TURN_BARE.ref] }),
  aid("clerk-aid"),
);

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Place 1 secret counter on each Board card." */
const SECRET = event("secret", [{ kind: "addCounters", target: eachBoardCard, counterType: "secret", amount: one }]);
/** "Interrupt: When this leaves play, …": marks the hero, and records whether its host was still an environment. */
const hero: TargetRef = { kind: "each", query: { categories: ["identity"] } };
const GADGET_LEAVES = stubAbility("gadget.leaves", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [
    {
      kind: "addCounters",
      target: hero,
      counterType: "hostStillEnvironment",
      amount: { kind: "count", query: { categories: ["environment"], trait: BOARD } },
    },
  ],
});
const GADGET = stubUpgrade({ id: "gadget", cost: 0, abilities: [GADGET_LEAVES.ref] });

const deps: EngineDeps = depsOf(TURN, TURN_BARE, PLACED, SECRET.ability, GADGET_LEAVES);

/** `card` in the villain's area as an environment holding 3 secret counters, 1 mark counter and 2 threat. */
function table(card: AnyCard): { state: GameState; id: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [OFFICER, OFFICER_AID, CLERK, CLERK_AID, SECRET.card, GADGET],
    deps,
    encounter: [OFFICER.id, CLERK.id],
    deck: [SECRET.card.id, SECRET.card.id, GADGET.id],
  });
  const placed = encounterCardInVillainArea(base, card.id, 2);
  const state: GameState = {
    ...placed.state,
    instances: {
      ...placed.state.instances,
      [placed.id]: { ...mustInstance(placed.state, placed.id), counters: { secret: 3, mark: 1 } },
    },
  };
  return { state, id: placed.id };
}
const expectReplays = (session: GameSession): void => {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
};
const flips = (events: readonly GameEvent[]) => events.filter((e) => e.type === "cardFlippedToOtherFace");

describe("§3.26 a flip to another card type that keeps named counters", () => {
  it("the fourth secret counter flips the environment: attached to the villain with its 4 secret counters, +1 ATK", () => {
    const { state: before, id } = table(OFFICER);
    const villain = before.activeVillainId!;
    const atk = characterStat(before, villain, "atk", deps) ?? 0;
    const { state, events, session } = playFree(before, deps, SECRET.card.id);
    const card = mustInstance(state, id);
    expect(card.cardId).toBe(OFFICER_AID.id);
    expect(locateCard(state, id)).toEqual({ kind: "attachment", hostInstanceId: villain });
    expect(card.attachedTo).toBe(villain);
    expect(mustInstance(state, villain).attachments).toContain(id);
    expect(state.villainArea).not.toContain(id);
    expect(card.faceup).toBe(true);
    // The named counters stay; every other token the Flip rule discards is gone.
    expect(card.counters).toEqual({ secret: 4 });
    expect(card.threat).toBe(0);
    expect(characterStat(state, villain, "atk", deps)).toBe(atk + 1);
    expect(flips(events)).toEqual([
      {
        type: "cardFlippedToOtherFace",
        instanceId: id,
        from: OFFICER.id,
        to: OFFICER_AID.id,
        typeChanged: true,
        keptCounters: { secret: 4 },
      },
    ]);
    // No reveal of the new face, and the counters it kept were not placed on it.
    expect(events.some((e) => e.type === "framePushed" && e.frame === "reveal")).toBe(false);
    expect(state.stack).toEqual([]);
    expectReplays(session);
  });

  it("the next secret counter placed on the attachment makes 5 and its Forced Response resolves once", () => {
    const { state: before, id } = table(OFFICER);
    const flipped = playFree(before, deps, SECRET.card.id).state;
    expect(mustInstance(flipped, id).counters["answered"]).toBeUndefined();
    const { state, session } = playFree(flipped, deps, SECRET.card.id);
    expect(mustInstance(state, id).cardId).toBe(OFFICER_AID.id);
    expect(mustInstance(state, id).counters).toEqual({ secret: 5, answered: 1 });
    expectReplays(session);
  });

  it("without keepCounters the same flip discards them (RRG 1.8 Flip, p. 20)", () => {
    const { state: before, id } = table(CLERK);
    const { state, events } = playFree(before, deps, SECRET.card.id);
    expect(mustInstance(state, id).cardId).toBe(CLERK_AID.id);
    expect(mustInstance(state, id).attachedTo).toBe(state.activeVillainId);
    expect(mustInstance(state, id).counters).toEqual({});
    expect(flips(events)[0]).not.toHaveProperty("keptCounters");
  });

  it("a flip that waits for an attachment's leave interrupt still keeps the counters", () => {
    const { state: start, id } = table(OFFICER);
    const gadget = playerCardIntoPlay(start, GADGET.id);
    // Surgery: the upgrade off the play area and onto the environment.
    const attached: GameState = {
      ...gadget.state,
      players: gadget.state.players.map((p) => ({ ...p, playArea: p.playArea.filter((x) => x !== gadget.id) })),
      instances: {
        ...gadget.state.instances,
        [gadget.id]: { ...mustInstance(gadget.state, gadget.id), attachedTo: id },
        [id]: { ...mustInstance(gadget.state, id), attachments: [gadget.id] },
      },
    };
    const { state, session } = playFree(attached, deps, SECRET.card.id);
    const heroId = mustPlayer(state, P1).identity.instanceId;
    // The interrupt saw its host still an environment; the flip then ran from the stack.
    expect(mustInstance(state, heroId).counters["hostStillEnvironment"]).toBe(1);
    expect(mustPlayer(state, P1).discard).toContain(gadget.id);
    expect(mustInstance(state, id).cardId).toBe(OFFICER_AID.id);
    expect(mustInstance(state, id).attachedTo).toBe(state.activeVillainId);
    expect(mustInstance(state, id).counters).toEqual({ secret: 4 });
    expect(mustInstance(state, id).attachments).toEqual([]);
    expectReplays(session);
  });
});
