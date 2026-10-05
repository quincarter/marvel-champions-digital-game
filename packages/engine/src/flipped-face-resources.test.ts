/**
 * A double-sided card's printed resource icons are those of the face it shows (`CardFlipSide.resourceIcons`): every
 * reader of printed resources over a card instance follows `flipped`, as its name, traits and keywords do.
 *
 * Synthetic cards: an upgrade printing [mental] on its front and [physical] on its other face; one whose other face
 * names no icons of its own (it reads the front's, [energy] x2); an ordinary upgrade printing [mental].
 *
 * Sources: RRG 1.8 "Flip" (p. 20), "Printed" (p. 35), "Double-Sided Card" (p. 17).
 */

import type { AnyCard, CardId, ResourceIconCounts, UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import { generatedResources } from "./actions.js";
import type { EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, showingResources } from "./query.js";
import { printedResources } from "./resources.js";
import { matchesQuery, printedResourcesOf, resolveValue, type EffectContext } from "./select.js";
import type { TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf } from "./testing/abilities.js";
import { stubUpgrade } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const pool = (icons: ResourceIconCounts) => ({ physical: 0, mental: 0, energy: 0, wild: 0, ...icons });

const twoFaced = (id: string, front: ResourceIconCounts, back?: ResourceIconCounts): UpgradeCard => ({
  ...stubUpgrade({ id, cost: 0 }),
  resourceIcons: front,
  flipSide: {
    name: `${id}-back`,
    traits: [],
    keywords: [],
    text: { printed: "", current: "" },
    abilities: [],
    ...(back ? { resourceIcons: back } : {}),
  },
});
/** [mental] on the front, [physical] on the other face. */
const KNIFE = twoFaced("knife", { mental: 1 }, { physical: 1 });
/** [energy] x2 on the front; the other face names no icons of its own. */
const SAME = twoFaced("same", { energy: 2 });
/** An ordinary single-faced upgrade printing [mental]. */
const PLAIN: UpgradeCard = { ...stubUpgrade({ id: "plain", cost: 0 }), resourceIcons: { mental: 1 } };

const deps: EngineDeps = depsOf();
const CARDS: readonly AnyCard[] = [KNIFE, SAME, PLAIN];

/** p1's first turn with these cards in play; one named `"<id>:back"` shows its other face. */
function table(...inPlay: readonly string[]): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
  let state = gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: CARDS.flatMap((card) => copiesOf(card.id, 3)),
  });
  const ids: InstanceId[] = [];
  for (const entry of inPlay) {
    const [card, face] = entry.split(":");
    const put = playerCardIntoPlay(state, card as CardId);
    state =
      face === "back"
        ? {
            ...put.state,
            instances: { ...put.state.instances, [put.id]: { ...mustInstance(put.state, put.id), flipped: true } },
          }
        : put.state;
    ids.push(put.id);
  }
  return { state, ids };
}

const contextOf = (selfId: InstanceId): EffectContext => ({
  selfInstanceId: selfId,
  controllerId: P1,
  event: null,
  bindings: {},
  deps,
});
const yourUpgrades: TargetQuery = { categories: ["upgrade"], controlledBy: { kind: "controller" } };
const each = (query: TargetQuery): TargetRef => ({ kind: "each", query });

describe("printed resources follow the face a double-sided card shows", () => {
  it("the card data: each face prints its own, and a face with none of its own reads the front's", () => {
    expect(printedResources(KNIFE)).toEqual(pool({ mental: 1 }));
    expect(printedResources(KNIFE, true)).toEqual(pool({ physical: 1 }));
    expect(printedResources(SAME, true)).toEqual(pool({ energy: 2 }));
    // A single-faced card has no other face to read.
    expect(printedResources(PLAIN, true)).toEqual(pool({ mental: 1 }));
  });

  it("an instance reads the face it shows: front [mental], flipped [physical]", () => {
    const { state, ids } = table("knife", "knife:back", "same:back");
    const [front, back, same] = ids as [InstanceId, InstanceId, InstanceId];
    expect(showingResources(state, front)).toEqual(pool({ mental: 1 }));
    expect(showingResources(state, back)).toEqual(pool({ physical: 1 }));
    expect(showingResources(state, same)).toEqual(pool({ energy: 2 }));
    expect(printedResourcesOf(state, front, deps)).toEqual(pool({ mental: 1 }));
    expect(printedResourcesOf(state, back, deps)).toEqual(pool({ physical: 1 }));
    expect(printedResourcesOf(state, back, undefined)).toEqual(pool({ physical: 1 }));
  });

  it("a query for a printed resource type matches the showing face only", () => {
    const { state, ids } = table("knife", "knife:back");
    const [front, back] = ids as [InstanceId, InstanceId];
    const context = contextOf(front);
    const mental: TargetQuery = { ...yourUpgrades, printedResource: "mental" };
    const physical: TargetQuery = { ...yourUpgrades, printedResource: "physical" };
    expect([matchesQuery(state, front, mental, context), matchesQuery(state, back, mental, context)]).toEqual([
      true,
      false,
    ]);
    expect([matchesQuery(state, front, physical, context), matchesQuery(state, back, physical, context)]).toEqual([
      false,
      true,
    ]);
    const either: TargetQuery = { ...yourUpgrades, anyPrintedResource: ["physical", "energy"] };
    expect([matchesQuery(state, front, either, context), matchesQuery(state, back, either, context)]).toEqual([
      false,
      true,
    ]);
  });

  it("'printed [mental] resources on cards you control' counts each card's showing face", () => {
    const mentalIn = (state: GameState, self: InstanceId): number =>
      resolveValue(
        state,
        { kind: "totalPrintedResources", cards: each(yourUpgrades), types: ["mental"] },
        contextOf(self),
      );
    const physicalIn = (state: GameState, self: InstanceId): number =>
      resolveValue(
        state,
        { kind: "totalPrintedResources", cards: each(yourUpgrades), types: ["physical"] },
        contextOf(self),
      );
    const fronts = table("knife", "knife", "plain");
    expect([mentalIn(fronts.state, fronts.ids[0]!), physicalIn(fronts.state, fronts.ids[0]!)]).toEqual([3, 0]);
    const mixed = table("knife", "knife:back", "plain");
    expect([mentalIn(mixed.state, mixed.ids[0]!), physicalIn(mixed.state, mixed.ids[0]!)]).toEqual([2, 1]);
    const backs = table("knife:back", "knife:back", "plain");
    expect([mentalIn(backs.state, backs.ids[0]!), physicalIn(backs.state, backs.ids[0]!)]).toEqual([1, 2]);
  });

  it("the number of resource types among cards reads the showing faces", () => {
    const types = (state: GameState, self: InstanceId): number =>
      resolveValue(state, { kind: "resourceTypes", cards: each(yourUpgrades) }, contextOf(self));
    const fronts = table("knife", "knife", "plain");
    expect(types(fronts.state, fronts.ids[0]!)).toBe(1);
    const mixed = table("knife", "knife:back", "same:back");
    expect(types(mixed.state, mixed.ids[0]!)).toBe(3);
  });

  it("'generate the printed resources of [cards]' generates what the showing faces print", () => {
    const { state, ids } = table("knife", "knife:back", "same:back");
    const from = { deps, sourceId: ids[0]!, playerId: P1 };
    expect(generatedResources(state, { kind: "printedResourcesOf", cards: yourUpgrades }, null, from)).toEqual(
      pool({ mental: 1, physical: 1, energy: 2 }),
    );
    // "The resources on the top card of the discard pile" (`topCardOfDiscard`) reads the named card the same way.
    expect(generatedResources(state, { kind: "topCardOfDiscard" }, ids[1]!)).toEqual(pool({ physical: 1 }));
  });
});
