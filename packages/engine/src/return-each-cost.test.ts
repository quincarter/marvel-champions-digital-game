/**
 * `AbilityCost.returnToHand` as a list of picks (docs/phase7-wave8.md §3.70). Synthetic cards shaped like "Alliance.
 * Action: Choose a [Red] ally and a [Blue] ally and return them to their owners' hands → those players play those
 * allies, ignoring their resource costs."
 *
 * Sources: RRG 1.8 "Cost" (p. 13): a cost's components are paid simultaneously and one card cannot pay two of them,
 * and a cost that cannot be paid in full is not paid at all; "Alliance" (p. 6): any player may help pay; "Leaves
 * Play" (p. 27): a card that left play and comes back is a new copy of it.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command, CostChoices } from "./commands.js";
import { applyCommand, startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const RED = trait("Red");
const BLUE = trait("Blue");
const replay = (slot: string): EffectSpec => ({
  kind: "playFromHand",
  player: { kind: "ownerOf", target: { kind: "slot", slot } },
  ignoreCost: true,
  card: { kind: "slot", slot },
});
const SWAP = stubAbility("swap.action", {
  trigger: { kind: "action" },
  cost: {
    returnToHand: [
      { slot: "red", query: { categories: ["ally"], trait: RED }, min: 1, max: 1 },
      { slot: "blue", query: { categories: ["ally"], trait: BLUE }, min: 1, max: 1 },
    ],
  },
  effects: [replay("red"), replay("blue")],
} as AbilityDefinition);
const SWAP_CARD = stubEvent({ id: "swap", cost: 0, keywords: [{ name: "alliance" }], abilities: [SWAP.ref] });
const SOLO_CARD = stubEvent({ id: "solo", cost: 0, abilities: [SWAP.ref] });
const RUBY = stubAlly({ id: "ruby", cost: 3, atk: 1, thw: 1, hp: 3, traits: [RED] });
const AZURE = stubAlly({ id: "azure", cost: 3, atk: 1, thw: 1, hp: 3, traits: [BLUE] });
const VIOLET = stubAlly({ id: "violet", cost: 3, atk: 1, thw: 1, hp: 3, traits: [RED, BLUE] });

const deps: EngineDeps = depsOf(SWAP);

const start = (players: 1 | 2 = 1): GameState =>
  gameAtFirstTurn({
    cards: [SWAP_CARD, SOLO_CARD, RUBY, AZURE, VIOLET],
    deps,
    deck: [SWAP_CARD.id, SOLO_CARD.id, RUBY.id, AZURE.id, VIOLET.id],
    players,
  });
function withAllies(state: GameState, ...allies: readonly [{ readonly id: string }, PlayerId][]) {
  let current = state;
  const ids: InstanceId[] = [];
  for (const [ally, player] of allies) {
    const placed = playerCardIntoPlay(current, ally.id as never, player);
    // Damaged and exhausted, so a fresh copy is told from the old one.
    current = {
      ...placed.state,
      instances: {
        ...placed.state.instances,
        [placed.id]: { ...mustInstance(placed.state, placed.id), damage: 1, exhausted: true },
      },
    };
    ids.push(placed.id);
  }
  return { state: current, ids };
}
function play(state: GameState, card: { readonly id: string }, costChoices?: CostChoices) {
  const given = giveCard(state, P1, card.id);
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
    ...(costChoices ? { costChoices } : {}),
  };
  return { state: given.state, command };
}
const run = (state: GameState, command: Command) => driveSession(startSession(state), deps, [command]);
const inPlayOf = (state: GameState, player: PlayerId) => mustPlayer(state, player).playArea;

describe("a return-to-hand cost of several picks", () => {
  it("both picks are returned and then played again for free: fresh copies in play", () => {
    const table = withAllies(start(), [RUBY, P1], [AZURE, P1]);
    const [ruby, azure] = table.ids as [InstanceId, InstanceId];
    const { state, command } = play(table.state, SWAP_CARD);
    const { session, events } = run(state, command);
    const after = session.state;
    for (const id of [ruby, azure]) {
      expect(inPlayOf(after, P1)).toContain(id);
      expect(mustInstance(after, id)).toMatchObject({ damage: 0, exhausted: false });
      const moves = events.flatMap((e) => (e.type === "cardMoved" && e.instanceId === id ? [e.to.kind] : []));
      expect(moves).toEqual(["hand", "playArea"]);
    }
  });

  it("with one of the two missing the cost cannot be paid: the card cannot be played and nothing is returned", () => {
    const table = withAllies(start(), [RUBY, P1]);
    const { state, command } = play(table.state, SWAP_CARD);
    expect(applyCommand(state, command, deps).ok).toBe(false);
  });

  it("one card cannot pay both picks: a Red and Blue ally alone does not pay", () => {
    const table = withAllies(start(), [VIOLET, P1]);
    const { state, command } = play(table.state, SWAP_CARD);
    expect(applyCommand(state, command, deps).ok).toBe(false);
    const both = withAllies(start(), [VIOLET, P1], [AZURE, P1]);
    const [violet, azure] = both.ids as [InstanceId, InstanceId];
    const second = play(both.state, SWAP_CARD, { red: [violet], blue: [azure] });
    expect(applyCommand(second.state, second.command, deps).ok).toBe(true);
    const clash = play(both.state, SWAP_CARD, { red: [violet], blue: [violet] });
    expect(applyCommand(clash.state, clash.command, deps).ok).toBe(false);
  });

  it("alliance: another player's ally pays, goes to its owner's hand and is played by its owner", () => {
    const table = withAllies(start(2), [RUBY, P1], [AZURE, P2]);
    const [ruby, azure] = table.ids as [InstanceId, InstanceId];
    const { state, command } = play(table.state, SWAP_CARD);
    const { session, events } = run(state, command);
    const after = session.state;
    expect(inPlayOf(after, P1)).toContain(ruby);
    expect(inPlayOf(after, P2)).toContain(azure);
    expect(mustInstance(after, azure)).toMatchObject({ controllerId: P2, damage: 0 });
    const toHand = events.find((e) => e.type === "cardMoved" && e.instanceId === azure && e.to.kind === "hand");
    expect(toHand).toMatchObject({ to: { kind: "hand", playerId: P2 } });
  });

  it("without alliance only the payer's own cards pay", () => {
    const table = withAllies(start(2), [RUBY, P1], [AZURE, P2]);
    const { state, command } = play(table.state, SOLO_CARD);
    expect(applyCommand(state, command, deps).ok).toBe(false);
  });
});
