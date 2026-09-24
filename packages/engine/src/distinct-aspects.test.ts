/**
 * docs/phase7-wave4.md §3.12: counting different aspects. Karmic Blast (`mts` 21038): "discard up to 4 cards from the top of
 * your deck → deal 1 additional damage to that enemy for each different aspect discarded this way (Aggression, Justice,
 * Leadership and Protection)"; also Cosmic Awareness (21039) and Regeneration Cycle (21066).
 *
 * Sources: the card text's own parenthetical names the four aspects; RRG 1.8 "Aspect" (p. 9); Spider-Woman's printed
 * aspects count as those aspects (docs/phase7-wave2.md §1.2).
 */

import type { EventCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import { resolveValue } from "./select.js";
import { depsOf } from "./testing/abilities.js";
import { stubEvent } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1 } from "./testing/wave3.js";

const card = (id: string, aspect: EventCard["aspect"], printedAspect?: EventCard["printedAspect"]): EventCard => ({
  ...stubEvent({ id, cost: 0, aspect }),
  ...(printedAspect ? { printedAspect } : {}),
});
const CARDS = [
  card("aggr-1", "aggression"),
  card("aggr-2", "aggression"),
  card("just-1", "justice"),
  card("basic-1", "basic"),
  card("pool-1", "pool"),
  card("signature-lead", "hero:someone", "leadership"),
];
const deps = depsOf();

describe("§3.12 counting different aspects", () => {
  it("counts each of the four core aspects once, a printed aspect included; basic and 'Pool do not count", () => {
    const state = gameAtFirstTurn({ cards: CARDS, deps, deck: CARDS.map((c) => c.id) });
    const seat = mustPlayer(state, P1);
    const ids: InstanceId[] = [...seat.deck, ...seat.hand].filter((id) =>
      CARDS.some((c) => c.id === state.instances[id]?.cardId),
    );
    expect(ids).toHaveLength(CARDS.length);
    const context = { selfInstanceId: null, controllerId: P1, event: null, bindings: { discarded: ids }, deps };
    expect(resolveValue(state, { kind: "distinctAspects", cards: { kind: "slot", slot: "discarded" } }, context)).toBe(
      3,
    );
    const byCard = (cardId: string): InstanceId => ids.find((id) => state.instances[id]?.cardId === cardId)!;
    const two = { ...context, bindings: { discarded: [byCard("aggr-1"), byCard("aggr-2"), byCard("just-1")] } };
    expect(resolveValue(state, { kind: "distinctAspects", cards: { kind: "slot", slot: "discarded" } }, two)).toBe(2);
  });
});
