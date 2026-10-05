/**
 * `EventPattern.indirect`: a `dealDamage` event that is one character's assigned share of indirect damage carries
 * `indirect: true`, stamped where the shares are dealt (`dealIndirectDamage`), and a pattern can ask for it or exclude
 * it — "Forced Response: After a friendly character takes any amount of indirect damage, exhaust that character."
 *
 * Source: RRG 1.8 "Indirect Damage" (p. 24): "All indirect damage from a single source is first assigned and then
 * resolved simultaneously"; a tough status card prevents all damage assigned to its character, so none is taken.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { ALLY, DEFAULT_DECK, giveCard, newGame, resolvePending, settle } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const you = { kind: "controller" } as const;
const CHARACTER = { categories: ["character"] } as const;

const INDIRECT_TWO_ABILITY = stubAbility("pattern-indirect-2.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "dealIndirectDamage", to: you, amount: { kind: "const", value: 2 } }],
});
const INDIRECT_TWO = stubEvent({ id: "pattern-indirect-2", cost: 0, abilities: [INDIRECT_TWO_ABILITY.ref] });
const INDIRECT_EACH_ABILITY = stubAbility("pattern-indirect-each.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "dealIndirectDamage", to: { kind: "each" }, amount: { kind: "const", value: 1 } }],
});
const INDIRECT_EACH = stubEvent({ id: "pattern-indirect-each", cost: 0, abilities: [INDIRECT_EACH_ABILITY.ref] });
/** "Deal 2 damage to your hero": direct damage. */
const DIRECT_TWO_ABILITY = stubAbility("pattern-direct-2.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "dealDamage", target: { kind: "identityOf", player: you }, amount: { kind: "const", value: 2 } }],
});
const DIRECT_TWO = stubEvent({ id: "pattern-direct-2", cost: 0, abilities: [DIRECT_TWO_ABILITY.ref] });

/** "Forced Response: After a friendly character takes any amount of indirect damage, exhaust that character." */
const SNARE_ABILITY = stubAbility("snare.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "dealDamage", targetIs: CHARACTER, indirect: true, requireResults: { amount: 1 } },
  },
  effects: [{ kind: "exhaust", target: { kind: "eventTarget" } }],
});
const SNARE = stubSupport({ id: "snare", cost: 0, abilities: [SNARE_ABILITY.ref] });
/** "Forced Response: After a character takes damage that is not indirect damage, place 1 counter here." */
const TALLY_ABILITY = stubAbility("tally.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "dealDamage", targetIs: CHARACTER, indirect: false, requireResults: { amount: 1 } },
  },
  effects: [
    { kind: "addCounters", target: { kind: "self" }, counterType: "direct", amount: { kind: "const", value: 1 } },
  ],
});
const TALLY = stubSupport({ id: "tally", cost: 0, abilities: [TALLY_ABILITY.ref] });
/** "Forced Interrupt: When a character would take indirect damage, prevent 1 of it." */
const NET_ABILITY = stubAbility("net.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "dealDamage", targetIs: CHARACTER, indirect: true } },
  effects: [{ kind: "preventDamage", amount: { kind: "const", value: 1 } }],
});
const NET = stubSupport({ id: "net", cost: 0, abilities: [NET_ABILITY.ref] });

const deps: EngineDeps = depsOf(
  INDIRECT_TWO_ABILITY,
  INDIRECT_EACH_ABILITY,
  DIRECT_TWO_ABILITY,
  SNARE_ABILITY,
  TALLY_ABILITY,
  NET_ABILITY,
);
const EXTRA = [INDIRECT_TWO, INDIRECT_EACH, DIRECT_TWO, SNARE, TALLY, NET];

function game(players = 1): GameState {
  return newGame({
    players,
    deps,
    extraCards: EXTRA,
    deck: [...DEFAULT_DECK, ...EXTRA.flatMap((card) => [card.id, card.id])],
  });
}

/** Test surgery: a card from `player`'s deck put straight into play, ready, under their control. */
function inPlay(state: GameState, player: PlayerId, card: CardId): { state: GameState; id: InstanceId } {
  const given = giveCard(state, player, card);
  const s = given.state;
  return {
    id: given.id,
    state: {
      ...s,
      players: s.players.map((p) =>
        p.playerId === player
          ? { ...p, hand: p.hand.filter((x) => x !== given.id), playArea: [...p.playArea, given.id] }
          : p,
      ),
      instances: { ...s.instances, [given.id]: { ...mustInstance(s, given.id), faceup: true, controllerId: player } },
    },
  };
}
const withTough = (state: GameState, id: InstanceId): GameState => ({
  ...state,
  instances: {
    ...state.instances,
    [id]: { ...mustInstance(state, id), statuses: { stunned: 0, confused: 0, tough: 1 } },
  },
});

/** p1 plays `card` for 0, answers an assignment prompt with `shares` (points per character), and settles. */
function play(state: GameState, card: CardId, shares: readonly (readonly [InstanceId, number])[] = []): GameState {
  const given = giveCard(state, p1, card);
  const result = applyCommand(
    given.state,
    { type: "playCard", playerId: p1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  if (result.state.pendingChoice?.prompt.kind !== "assignIndirectDamage") return settle(result.state, undefined, deps);
  const picked = shares.flatMap(([id, points]) => Array.from({ length: points }, (_, n) => `${id}#${n + 1}`));
  return settle(resolvePending(result.state, picked, deps), undefined, deps);
}

const identityOf = (state: GameState, player: PlayerId = p1) => mustPlayer(state, player).identity.instanceId;
const exhausted = (state: GameState, id: InstanceId) => mustInstance(state, id).exhausted;

describe("EventPattern.indirect (RRG 1.8 Indirect Damage, p. 24)", () => {
  it("each character assigned some of the indirect damage triggers it; a character assigned none does not", () => {
    const one = inPlay(game(), p1, ALLY.id);
    const two = inPlay(one.state, p1, ALLY.id);
    const snared = inPlay(two.state, p1, SNARE.id).state;
    const hero = identityOf(snared);
    const after = play(snared, INDIRECT_TWO.id, [
      [hero, 1],
      [one.id, 1],
    ]);
    expect(mustInstance(after, hero).damage).toBe(1);
    expect(mustInstance(after, one.id).damage).toBe(1);
    expect(mustInstance(after, two.id).damage).toBe(0);
    expect(exhausted(after, hero)).toBe(true);
    expect(exhausted(after, one.id)).toBe(true);
    expect(exhausted(after, two.id)).toBe(false);
  });

  it("direct damage is not indirect: `indirect: true` does not hear it and `indirect: false` does", () => {
    const snared = inPlay(game(), p1, SNARE.id).state;
    const tally = inPlay(snared, p1, TALLY.id);
    const hero = identityOf(tally.state);
    const after = play(tally.state, DIRECT_TWO.id);
    expect(mustInstance(after, hero).damage).toBe(2);
    expect(exhausted(after, hero)).toBe(false);
    expect(mustInstance(after, tally.id).counters.direct).toBe(1);
  });

  it("`indirect: false` does not hear either share of indirect damage", () => {
    const ally = inPlay(game(), p1, ALLY.id);
    const tally = inPlay(ally.state, p1, TALLY.id);
    const hero = identityOf(tally.state);
    const after = play(tally.state, INDIRECT_TWO.id, [
      [hero, 1],
      [ally.id, 1],
    ]);
    expect(mustInstance(after, hero).damage).toBe(1);
    expect(mustInstance(after, ally.id).damage).toBe(1);
    expect(mustInstance(after, tally.id).counters.direct ?? 0).toBe(0);
  });

  it("a share a tough status card prevents was not taken: that character is not exhausted", () => {
    const ally = inPlay(game(), p1, ALLY.id);
    const snared = withTough(inPlay(ally.state, p1, SNARE.id).state, ally.id);
    const hero = identityOf(snared);
    const after = play(snared, INDIRECT_TWO.id, [
      [hero, 1],
      [ally.id, 1],
    ]);
    expect(mustInstance(after, ally.id)).toMatchObject({ damage: 0, exhausted: false, statuses: { tough: 0 } });
    expect(mustInstance(after, hero)).toMatchObject({ damage: 1, exhausted: true });
  });

  it("the flag is read in the interrupt window too: 1 of each indirect share is prevented, none of direct damage", () => {
    const ally = inPlay(game(), p1, ALLY.id);
    const netted = inPlay(ally.state, p1, NET.id).state;
    const hero = identityOf(netted);
    const indirect = play(netted, INDIRECT_TWO.id, [[hero, 2]]);
    expect(mustInstance(indirect, hero).damage).toBe(1);
    const direct = play(netted, DIRECT_TWO.id);
    expect(mustInstance(direct, hero).damage).toBe(2);
  });

  it("two players: indirect damage to each player exhausts each player's damaged character", () => {
    const snared = inPlay(game(2), p1, SNARE.id).state;
    const after = play(snared, INDIRECT_EACH.id);
    for (const player of [p1, p2]) {
      expect(mustInstance(after, identityOf(after, player))).toMatchObject({ damage: 1, exhausted: true });
    }
  });
});
