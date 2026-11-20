/**
 * `TargetQuery.keywordNotFromSelf` (#890 item 9), on a synthetic attachment shaped like Rose's Greenhouse (the
 * `the-rose-bf` community pack): "Attached villain gains steady. If it already has steady or stalwart, it gets
 * +4[per_hero] hit points instead." The "already has" check leaves out the attachment's own grant, which would otherwise
 * always make it true; printed keywords and other cards' grants still count.
 */

import { cardId, flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import { characterProfile, mustInstance } from "./query.js";
import type { Predicate, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAttachment, stubSupport, stubVillain } from "./testing/fixtures.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const HOST: TargetQuery = { categories: ["villain"], hostOfSelf: true };
const ALREADY: TargetQuery = {
  categories: ["villain"],
  hostOfSelf: true,
  anyOf: [
    { withKeyword: "steady", keywordNotFromSelf: true },
    { withKeyword: "stalwart", keywordNotFromSelf: true },
  ],
};
const already: Predicate = { kind: "exists", query: ALREADY };
const GREENHOUSE_CONSTANT = stubAbility("greenhouse.constant", {
  trigger: {
    kind: "constant",
    keywordGrants: [{ keyword: { name: "steady" }, target: HOST, while: { kind: "not", of: already } }],
    modifiers: [{ stat: "hp", amount: { kind: "perPlayer", base: 0, perPlayer: 4 }, target: HOST, while: already }],
  },
  effects: [],
} satisfies AbilityDefinition);
const GREENHOUSE = stubAttachment({ id: "greenhouse", abilities: [GREENHOUSE_CONSTANT.ref] });
/** A support granting the villain stalwart: another card's grant, which does count. */
const BANNER_CONSTANT = stubAbility("banner.constant", {
  trigger: {
    kind: "constant",
    keywordGrants: [{ keyword: { name: "stalwart" }, target: { categories: ["villain"] } }],
  },
  effects: [],
} satisfies AbilityDefinition);
const BANNER = stubSupport({ id: "banner", cost: 0, abilities: [BANNER_CONSTANT.ref] });

const deps: EngineDeps = depsOf(GREENHOUSE_CONSTANT, BANNER_CONSTANT);
const plain = stubVillain({ id: "plain", stages: [{ hp: flat(14), atk: 2, sch: 1 }] });
const steady = stubVillain({
  id: "steadfast",
  stages: [{ hp: flat(14), atk: 2, sch: 1, keywords: [{ name: "steady" }] }],
});

function attached(villain: typeof plain, withBanner = false): { state: GameState; villainId: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [GREENHOUSE, BANNER, villain],
    deps,
    villain,
    deck: [BANNER.id],
    encounter: [GREENHOUSE.id, ...Array.from({ length: 10 }, () => cardId("blank"))].filter(
      (id) => id === GREENHOUSE.id,
    ),
  });
  const villainId = base.villains[0]!.instanceId;
  const placed = encounterCardInVillainArea(base, GREENHOUSE.id);
  const green = placed.id;
  let state: GameState = {
    ...placed.state,
    villainArea: placed.state.villainArea.filter((id) => id !== green),
    instances: {
      ...placed.state.instances,
      [green]: { ...mustInstance(placed.state, green), attachedTo: villainId },
      [villainId]: {
        ...mustInstance(placed.state, villainId),
        attachments: [...mustInstance(placed.state, villainId).attachments, green],
      },
    },
  };
  if (withBanner) state = playerCardIntoPlay(state, BANNER.id, P1).state;
  return { state, villainId };
}
const hp = (state: GameState, id: InstanceId) => characterProfile(state, id, deps)!.maxHp;

describe("keywordNotFromSelf: 'if it already has steady or stalwart' (#890 item 9)", () => {
  it("a villain with no steady gains steady, and no extra hit points", () => {
    const { state, villainId } = attached(plain);
    expect(hasKeyword(state, villainId, "steady", deps)).toBe(true);
    expect(hp(state, villainId)).toBe(14);
  });

  it("a villain with printed steady gets +4 per player hit points instead", () => {
    const { state, villainId } = attached(steady);
    expect(hasKeyword(state, villainId, "steady", deps)).toBe(true);
    expect(hp(state, villainId)).toBe(18);
  });

  it("another card's stalwart grant counts as already having it: +4 hit points, no steady from this card", () => {
    const { state, villainId } = attached(plain, true);
    expect(hasKeyword(state, villainId, "stalwart", deps)).toBe(true);
    expect(hasKeyword(state, villainId, "steady", deps)).toBe(false);
    expect(hp(state, villainId)).toBe(18);
  });
});
