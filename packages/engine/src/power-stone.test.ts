/**
 * docs/phase7-wave3.md §3.19: an encounter attachment that moves between the villain and identities. Synthetic cards
 * shaped like the Power Stone (`gmw` 16149): "Setup. Attach to the villain. / Permanent. / Forced Response: After a hero
 * or villain deals 3 or more damage to attached character with a single attack, attach Power Stone to the attacking hero
 * or villain."; Superior Tactics (16113): "The Power Stone cannot be unattached from Ronan the Accuser."
 *
 * Sources: RRG 1.8 "Player Elimination" (p. 34) step 3, "Permanent" (p. 33), "'Cannot'" (p. 11); FAQ "Power Stone
 * (#149)" (RRG 1.8 p. 62).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAttachment, stubEvent, stubSideScheme } from "./testing/fixtures.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playFree } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const theVillain: TargetRef = { kind: "villain" };

const STONE_MOVES = stubAbility("stone.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "dealDamage", targetIs: { hostOfSelf: true }, fromAttack: true, eventAtLeast: { amount: 3 } },
  },
  effects: [{ kind: "attach", card: { kind: "self" }, to: { kind: "eventSource" } }],
});
const STONE = stubAttachment({
  id: "stone",
  attachesTo: { kind: "villain" },
  keywords: [{ name: "permanent" }],
  abilities: [STONE_MOVES.ref],
});
const TACTICS_RULE = stubAbility("tactics.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotBeUnattached", target: { name: "stone" } }] },
  effects: [],
});
const TACTICS = stubSideScheme({ id: "tactics", startingThreat: 2, abilities: [TACTICS_RULE.ref] });
/** An ordinary encounter attachment on an identity, for elimination's other branch. */
const SHACKLE = stubAttachment({ id: "shackle", attachesTo: { kind: "yourIdentity" } });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const STRIKE = actionEvent("strike", [{ kind: "attack", target: theVillain, amount: n(3) }]);
const JAB = actionEvent("jab", [{ kind: "attack", target: theVillain, amount: n(2) }]);
const DOOM = actionEvent("doom", [
  { kind: "dealDamage", target: { kind: "identityOf", player: { kind: "controller" } }, amount: n(50) },
]);
const EVENTS = [STRIKE, JAB, DOOM];

const deps: EngineDeps = depsOf(STONE_MOVES, TACTICS_RULE, ...EVENTS.map((e) => e.ability));
const CARDS = [STONE, TACTICS, SHACKLE, ...EVENTS.map((e) => e.card)];
const ENCOUNTER: readonly CardId[] = [STONE.id, TACTICS.id, SHACKLE.id, ...copiesOf(SHACKLE.id, 5)];

/** Moves an encounter-deck card onto `host` as an attachment (surgery). */
function attached(state: GameState, card: CardId, host: InstanceId): { state: GameState; id: InstanceId } {
  const piles = activeEncounterDeck(state);
  const id = piles.deck.find((candidate) => state.instances[candidate]?.cardId === card)!;
  const deckId = state.encounterDeckOrder[0]!;
  return {
    id,
    state: {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((x) => x !== id) } },
      instances: {
        ...state.instances,
        [host]: { ...mustInstance(state, host), attachments: [...mustInstance(state, host).attachments, id] },
        [id]: { ...mustInstance(state, id), attachedTo: host, faceup: true },
      },
    },
  };
}

function start(players: 1 | 2 = 1): GameState {
  const base = gameAtFirstTurn({
    cards: CARDS,
    deps,
    encounter: ENCOUNTER,
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
    players,
  });
  return { ...base, players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
}
const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const identityOf = (state: GameState, player = P1): InstanceId => mustPlayer(state, player).identity.instanceId;

describe("§3.19 the Power Stone", () => {
  it("moves to the hero whose single attack dealt its host 3 or more damage", () => {
    const stone = attached(start(), STONE.id, villainOf(start()));
    const { state, session } = playFree(stone.state, deps, STRIKE.card.id);
    expect(mustInstance(state, stone.id).attachedTo).toBe(identityOf(state));
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("stays put after a smaller attack", () => {
    const stone = attached(start(), STONE.id, villainOf(start()));
    const { state } = playFree(stone.state, deps, JAB.card.id);
    expect(mustInstance(state, stone.id).attachedTo).toBe(villainOf(state));
  });

  it("'cannot be unattached' keeps it where it is", () => {
    const stone = attached(start(), STONE.id, villainOf(start()));
    const tactics = encounterCardInVillainArea(stone.state, TACTICS.id, 2);
    const { state } = playFree(tactics.state, deps, STRIKE.card.id);
    expect(mustInstance(state, stone.id).attachedTo).toBe(villainOf(state));
  });

  it("when its holder is eliminated it resolves its 'attach to' text (FAQ, RRG 1.8 p. 62)", () => {
    const base = start(2);
    const stone = attached(base, STONE.id, identityOf(base));
    const shackle = attached(stone.state, SHACKLE.id, identityOf(base));
    const { state } = playFree(shackle.state, deps, DOOM.card.id);
    expect(mustPlayer(state, P1).eliminated).toBe(true);
    expect(mustPlayer(state, P2).eliminated).toBe(false);
    // The permanent Power Stone goes back to the villain; the ordinary attachment to its discard pile.
    expect(mustInstance(state, stone.id).attachedTo).toBe(villainOf(state));
    expect(activeEncounterDeck(state).discard).toContain(shackle.id);
  });
});
