/**
 * docs/phase7-wave4.md §3.44: "Players cannot discard attachments that are attached to friendly characters." (Powerful
 * Enchantments, `valk` 25030). A player's ability cannot discard a protected attachment; an encounter card's own effect
 * still can.
 *
 * Sources: the card's own text; RRG 1.8 "'Cannot'" (p. 11), "Ability" (p. 4: who initiates an ability).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAttachment, stubEvent, stubSideScheme, stubTreachery } from "./testing/fixtures.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  onTopOfEncounterDeck,
  P1,
  playFree,
} from "./testing/wave3.js";

const eachAttachment: EffectSpec = {
  kind: "discardFromPlay",
  target: { kind: "each", query: { categories: ["attachment"] } },
};
const ENCHANT = stubAbility("enchant.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "playersCannotDiscard",
        target: {
          categories: ["attachment"],
          host: { kind: "each", query: { categories: ["identity", "ally"], controller: "any" } },
        },
      },
    ],
  },
  effects: [],
});
const ENCHANTMENTS = stubSideScheme({ id: "enchantments", startingThreat: 3, abilities: [ENCHANT.ref] });
const CURSE = stubAttachment({ id: "curse", name: "curse", attachesTo: { kind: "yourIdentity" } });
const PURGE = stubAbility("purge.action", { trigger: { kind: "action" }, effects: [eachAttachment] });
const PURGE_CARD = stubEvent({ id: "purge", cost: 0, abilities: [PURGE.ref] });
const BLAST = stubAbility("blast.when-revealed", { trigger: { kind: "whenRevealed" }, effects: [eachAttachment] });
const BLAST_CARD = stubTreachery({ id: "blast", boostIcons: 0, abilities: [BLAST.ref] });
const REVEAL = stubAbility("reveal.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "revealEncounterCard", player: { kind: "controller" } }],
});
const REVEAL_CARD = stubEvent({ id: "reveal", cost: 0, abilities: [REVEAL.ref] });
const deps: EngineDeps = depsOf(ENCHANT, PURGE, BLAST, REVEAL);

function start(): { state: GameState; curse: InstanceId } {
  let state = gameAtFirstTurn({
    cards: [ENCHANTMENTS, CURSE, PURGE_CARD, BLAST_CARD, REVEAL_CARD],
    deps,
    encounter: [ENCHANTMENTS.id, CURSE.id, BLAST_CARD.id, ...copiesOf(BLAST_CARD.id, 3)],
    deck: [PURGE_CARD.id, REVEAL_CARD.id],
  });
  state = encounterCardInVillainArea(state, ENCHANTMENTS.id, 3).state;
  const placed = encounterCardInVillainArea(state, CURSE.id, 0);
  const identity = mustPlayer(placed.state, P1).identity.instanceId;
  state = {
    ...placed.state,
    villainArea: placed.state.villainArea.filter((id) => id !== placed.id),
    instances: {
      ...placed.state.instances,
      [placed.id]: { ...placed.state.instances[placed.id]!, attachedTo: identity },
      [identity]: { ...placed.state.instances[identity]!, attachments: [placed.id] },
    },
  };
  return { state, curse: placed.id };
}

describe("§3.44 players cannot discard protected attachments", () => {
  it("a player's event cannot discard the attachment on their hero", () => {
    const { state, curse } = start();
    const { state: after, events } = playFree(state, deps, PURGE_CARD.id);
    expect(mustInstance(after, curse).attachedTo).toBe(mustPlayer(after, P1).identity.instanceId);
    expect(events).toContainEqual(expect.objectContaining({ type: "discardRefused", instanceId: curse }));
  });

  it("an encounter card's own effect still discards it", () => {
    const { state, curse } = start();
    const after = playFree(onTopOfEncounterDeck(state, BLAST_CARD.id), deps, REVEAL_CARD.id).state;
    expect(mustInstance(after, curse).attachedTo).toBeNull();
  });
});
