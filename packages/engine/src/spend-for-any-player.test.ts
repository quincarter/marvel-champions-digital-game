/**
 * docs/phase7-wave5.md §3.17: a resource card spent for another player. Synthetic cards shaped like Everyday Hero
 * (`nova` 28019: "While your identity has the [Civilian] trait, this card can be spent for any player and gains the
 * text: 'Response: After you spend this card for a player, heal 1 damage from that player's identity.'"). The trait
 * condition is stood in for by the owner's form.
 *
 * Source: RRG 1.8 "Alliance" (p. 6) for how another player's hand card joins a payment.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { Predicate } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubResource } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const ownerInAlterEgo: Predicate = { kind: "form", player: { kind: "controller" }, form: "alterEgo" };
const EVERYDAY_CONSTANT = stubAbility("everyday.constant", {
  trigger: { kind: "constant", spendableForAnyPlayer: { while: ownerInAlterEgo } },
  effects: [],
});
const EVERYDAY_RESPONSE_DEFINITION: AbilityDefinition = {
  trigger: { kind: "response", forced: true, on: { on: "resourcesSpent", selfIs: "source" } },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "identityOf", player: { kind: "eventPlayer" } },
      counterType: "healed",
      amount: { kind: "const", value: 1 },
    },
  ],
};
const EVERYDAY_RESPONSE = stubAbility("everyday.response", EVERYDAY_RESPONSE_DEFINITION);
const EVERYDAY = stubResource({ id: "everyday", icons: 1, abilities: [EVERYDAY_CONSTANT.ref, EVERYDAY_RESPONSE.ref] });

const NOTHING = stubAbility("nothing.action", { trigger: { kind: "action" }, effects: [] });
const PRICEY = stubEvent({ id: "pricey", cost: 1, abilities: [NOTHING.ref] });

const deps: EngineDeps = depsOf(EVERYDAY_CONSTANT, EVERYDAY_RESPONSE, NOTHING);

function start(): GameState {
  return gameAtFirstTurn({ cards: [EVERYDAY, PRICEY], deps, players: 2, deck: [EVERYDAY.id, PRICEY.id] });
}

const play = (state: GameState, event: InstanceId, payWith: InstanceId) =>
  ({
    type: "playCard",
    playerId: P1,
    cardInstanceId: event,
    payment: [{ fromHand: payWith }],
    attachToInstanceId: null,
  }) as const;

describe("§3.17 'this card can be spent for any player'", () => {
  it("another player spends it toward the paying player's card; 'that player' is the payer; replay deep-equal", () => {
    const state = start();
    const pricey = giveCard(state, P1, PRICEY.id);
    const everyday = giveCard(pricey.state, P2, EVERYDAY.id);
    const { session } = driveSession(startSession(everyday.state), deps, [
      play(everyday.state, pricey.id, everyday.id),
    ]);
    const after = session.state;
    expect(mustPlayer(after, P2).discard).toContain(everyday.id);
    expect(mustInstance(after, mustPlayer(after, P1).identity.instanceId).counters["healed"]).toBe(1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("not while the condition is false", () => {
    const state = start();
    const pricey = giveCard(state, P1, PRICEY.id);
    const everyday = giveCard(pricey.state, P2, EVERYDAY.id);
    const heroP2: GameState = {
      ...everyday.state,
      players: everyday.state.players.map((p) =>
        p.playerId === P2 ? { ...p, identity: { ...p.identity, form: "hero" } } : p,
      ),
    };
    const result = applyCommand(heroP2, play(heroP2, pricey.id, everyday.id), deps);
    expect(result.ok).toBe(false);
  });
});
