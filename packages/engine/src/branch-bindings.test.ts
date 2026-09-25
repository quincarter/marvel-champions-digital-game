/**
 * docs/phase7-wave4.md §3.43: a binding made inside a `chooseOne` option or an `if` branch is visible to the effects
 * after it ("Choose one: discard the top 3 cards of your deck, or … . Then add a card discarded this way to your hand").
 * Before, a branch ran as a child frame whose bindings were dropped, so a later effect read an empty slot and silently
 * did nothing (Magic Attack, Zone of Silence, Karmic Blast, Cosmic Awareness were scripted around it).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, playFree } from "./testing/wave3.js";

const topTwo = (slot: string): EffectSpec => ({
  kind: "selectCards",
  slot,
  cards: { kind: "zone", zone: "deck", player: { kind: "controller" }, top: { kind: "const", value: 2 } },
});
const toHand = (slot: string): EffectSpec => ({
  kind: "moveCards",
  cards: { kind: "ref", ref: { kind: "slot", slot } },
  to: "hand",
});
const CHOOSE = stubAbility("choose.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "chooseOne", chooser: { kind: "controller" }, options: [{ label: "Look", effects: [topTwo("seen")] }] },
    toHand("seen"),
  ],
});
const IF = stubAbility("if.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "if",
      condition: { kind: "form", player: { kind: "controller" }, form: "alterEgo" },
      then: [topTwo("seen")],
    },
    toHand("seen"),
  ],
});
const CHOOSE_CARD = stubEvent({ id: "choose", cost: 0, abilities: [CHOOSE.ref] });
const IF_CARD = stubEvent({ id: "if", cost: 0, abilities: [IF.ref] });
const deps: EngineDeps = depsOf(CHOOSE, IF);

describe("§3.43 a branch's bindings reach the effects after it", () => {
  for (const card of [CHOOSE_CARD, IF_CARD]) {
    it(`${card.id}: the cards bound inside the branch are moved by the effect after it`, () => {
      const state = gameAtFirstTurn({ cards: [CHOOSE_CARD, IF_CARD], deps, deck: [CHOOSE_CARD.id, IF_CARD.id] });
      const after = playFree(state, deps, card.id).state;
      // The deck's top two (the card played aside) are now in hand.
      const deckBefore = mustPlayer(state, P1).deck.filter((id) => state.instances[id]!.cardId !== card.id);
      for (const id of deckBefore.slice(0, 2)) expect(mustPlayer(after, P1).hand).toContain(id);
    });
  }
});
