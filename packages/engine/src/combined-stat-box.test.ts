/**
 * A combined "SCH/THW" stat box on an attachment (Power Stone `gmw` 16149, Motorcycle `fne` 60187), which the card data
 * carries as both `sch` and `thw`. RRG v1.8 "Attachment" (p. 8): it "modifies the attached character's SCH if that
 * character is a villain or minion, and modifies the attached character's THW if that character is a hero or ally".
 * An ally treated as a minion whose SCH is read from its THW (Malice, docs/phase7-wave7.md §3.44) gets the box once.
 */
import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, characterProfile, mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf } from "./testing/abilities.js";
import { stubAlly, stubAttachment } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, playerCardIntoPlay } from "./testing/wave3.js";

const BOX = stubAttachment({ id: "box", attachesTo: { kind: "villain" }, statModifiers: { sch: 1, thw: 1 } });
const ALLY = stubAlly({ id: "helper", cost: 2, atk: 1, thw: 2, hp: 3 });
const deps = depsOf();

const start = (): GameState =>
  gameAtFirstTurn({ cards: [BOX, ALLY], deps, encounter: copiesOf(BOX.id, 3), deck: [ALLY.id] });

/** Moves an encounter-deck copy of the box onto `host` (surgery). */
function attachBox(state: GameState, host: InstanceId): GameState {
  const piles = activeEncounterDeck(state);
  const id = piles.deck.find((candidate) => state.instances[candidate]?.cardId === (BOX.id as CardId))!;
  const deckId = state.encounterDeckOrder[0]!;
  return {
    ...state,
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((x) => x !== id) } },
    instances: {
      ...state.instances,
      [host]: { ...mustInstance(state, host), attachments: [...mustInstance(state, host).attachments, id] },
      [id]: { ...mustInstance(state, id), attachedTo: host, faceup: true },
    },
  };
}

describe("a combined SCH/THW stat box", () => {
  it("gives a villain +1 SCH", () => {
    const state = start();
    const villain = state.villains[0]!.instanceId;
    const before = characterProfile(state, villain, deps)!;
    expect(characterProfile(attachBox(state, villain), villain, deps)!.sch).toBe(before.sch + 1);
  });

  it("gives an ally +1 THW and no SCH", () => {
    const { state, id } = playerCardIntoPlay(start(), ALLY.id);
    const profile = characterProfile(attachBox(state, id), id, deps)!;
    expect([profile.thw, profile.sch]).toEqual([3, 0]);
  });

  it("gives an ally treated as a minion, whose SCH is its THW, +1 SCH once (not +2)", () => {
    const { state, id } = playerCardIntoPlay(start(), ALLY.id);
    const possessed: GameState = {
      ...state,
      instances: {
        ...state.instances,
        [id]: {
          ...mustInstance(state, id),
          treatedAs: {
            kind: "minion",
            traits: [],
            keepPrintedTraits: true,
            schFromThw: "current",
            source: id,
            controllerBefore: null,
          },
        },
      },
    };
    expect(characterProfile(possessed, id, deps)!.sch).toBe(2);
    expect(characterProfile(attachBox(possessed, id), id, deps)!.sch).toBe(3);
  });

  it("gives a facedown minion made from a player card (an Ultron Drone) +1 SCH", () => {
    const { state, id } = playerCardIntoPlay(start(), ALLY.id);
    const drone: GameState = {
      ...state,
      instances: {
        ...state.instances,
        [id]: { ...mustInstance(state, id), faceup: false, facedownAs: { kind: "minion", traits: [] } },
      },
    };
    const before = characterProfile(drone, id, deps)!;
    const after = characterProfile(attachBox(drone, id), id, deps)!;
    expect([after.sch, after.thw]).toEqual([before.sch + 1, before.thw]);
  });
});
