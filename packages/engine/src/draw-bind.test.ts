/**
 * `EffectSpec draw.bind` (docs/phase7-wave8.md §3.70): the cards a draw drew are bound to a slot for the rest of the
 * ability. Synthetic cards shaped like "Draw 1 card. If that card has the [Ice] trait, deal 1 damage to the villain."
 *
 * Sources: RRG 1.8 "Draw" (p. 17); "Player Deck" (p. 33): a deck the draw empties is reset and the drawing goes on.
 */

import { trait, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubEvent } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playFree } from "./testing/wave3.js";

const ICE = trait("Ice");
const DRAWN = { kind: "slot", slot: "drawn" } as const;
const VILLAIN_REF = { kind: "each", query: { categories: ["villain"] } } as const;
const hit = (amount: ValueSpec): EffectSpec => ({
  kind: "dealDamage",
  target: VILLAIN_REF,
  amount,
});

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
// "Draw 1 card. If that card has the Ice trait, deal 1 damage to the villain."
const PEEK = event("peek", [
  { kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 }, bind: "drawn" },
  {
    kind: "if",
    condition: { kind: "refMatches", ref: DRAWN, query: { trait: ICE }, anywhere: true },
    then: [hit({ kind: "const", value: 1 })],
  },
]);
// "Draw 3 cards. Deal damage to the villain equal to the number of cards drawn."
const HAUL = event("haul", [
  { kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 3 }, bind: "drawn" },
  hit({ kind: "var", name: "drawn.count" }),
]);
const SNOWMAN = stubAlly({ id: "snowman", cost: 1, atk: 1, thw: 1, hp: 2, traits: [ICE] });
const ROCK = stubAlly({ id: "rock", cost: 1, atk: 1, thw: 1, hp: 2 });

const deps: EngineDeps = depsOf(PEEK.ability, HAUL.ability);

const start = (): GameState =>
  gameAtFirstTurn({
    cards: [SNOWMAN, ROCK, PEEK.card, HAUL.card],
    deps,
    deck: [SNOWMAN.id, ROCK.id, PEEK.card.id, HAUL.card.id],
  });
/** `card` on top of P1's deck (surgery), taken from wherever P1 holds it. */
function onTop(state: GameState, card: CardId): { state: GameState; id: InstanceId } {
  const player = mustPlayer(state, P1);
  const id = [...player.deck, ...player.hand].find((i) => mustInstance(state, i).cardId === card)!;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: p.hand.filter((i) => i !== id), deck: [id, ...p.deck.filter((i) => i !== id)] }
          : p,
      ),
    },
  };
}
/** `card` in P1's hand, then only the first `keep` cards of the deck stay and the discard pile is emptied (surgery). */
function deckOf(state: GameState, card: CardId, keep: number): GameState {
  const given = giveCard(state, P1, card).state;
  return {
    ...given,
    players: given.players.map((p) => (p.playerId === P1 ? { ...p, deck: p.deck.slice(0, keep), discard: [] } : p)),
  };
}
const villainDamage = (state: GameState): number => mustInstance(state, state.villains[0]!.instanceId).damage;

describe("draw with a bind: the cards drawn are read by the rest of the ability", () => {
  it("the drawn card has the trait: the condition reads it in hand and holds", () => {
    const top = onTop(start(), SNOWMAN.id);
    const run = playFree(top.state, deps, PEEK.card.id);
    expect(mustPlayer(run.state, P1).hand).toContain(top.id);
    expect(villainDamage(run.state)).toBe(1);
  });

  it("the drawn card lacks the trait: the condition fails, though a card with the trait is next in the deck", () => {
    const next = onTop(start(), SNOWMAN.id);
    const top = onTop(next.state, ROCK.id);
    const run = playFree(top.state, deps, PEEK.card.id);
    expect(mustPlayer(run.state, P1).hand).toContain(top.id);
    expect(mustPlayer(run.state, P1).hand).not.toContain(next.id);
    expect(villainDamage(run.state)).toBe(0);
  });

  it("nothing to draw: the slot is empty and the condition fails", () => {
    // The played card itself is discarded only after it resolves, so the deck and discard pile are both empty.
    const run = playFree(deckOf(start(), PEEK.card.id, 0), deps, PEEK.card.id);
    expect(villainDamage(run.state)).toBe(0);
  });

  it("the count is the number of cards drawn, not the number asked for", () => {
    expect(villainDamage(playFree(start(), deps, HAUL.card.id).state)).toBe(3);
    const short = playFree(deckOf(start(), HAUL.card.id, 2), deps, HAUL.card.id);
    expect(villainDamage(short.state)).toBe(2);
  });
});
