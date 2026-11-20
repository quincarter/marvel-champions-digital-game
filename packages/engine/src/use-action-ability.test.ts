/**
 * `EffectSpec useActionAbility` (#890 item 6): "… or resolve an 'Action' ability on a card you control" (War Machine
 * Armor, the `punisher-msp` community pack; the author: "Yes you pay the cost"). The player uses an Action ability of a
 * card in play they control at the effect's moment, out of turn, paying its cost as on their own turn.
 *
 * Out of turn here: a forced response to the end-of-player-phase ready step (`endPhaseCardsReadied`), when no player's
 * turn is running and a `useAbility` command would be refused for its timing.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const ARMOR = stubAbility("armor.response", {
  trigger: { kind: "response", forced: true, on: { on: "endPhaseCardsReadied", playerIs: "controller" } },
  effects: [{ kind: "useActionAbility", player: { kind: "controller" } }],
} satisfies AbilityDefinition);
const ARMOR_CARD = stubSupport({ id: "armor", cost: 0, abilities: [ARMOR.ref] });
/** "Action: Spend 1 resource → place 1 counter here." */
const GUN_ACTION = stubAbility("gun.action", {
  trigger: { kind: "action" },
  cost: { resources: 1 },
  effects: [
    { kind: "addCounters", target: { kind: "self" }, counterType: "shot", amount: { kind: "const", value: 1 } },
  ],
} satisfies AbilityDefinition);
const GUN = stubUpgrade({ id: "gun", cost: 0, abilities: [GUN_ACTION.ref] });
const deps: EngineDeps = depsOf(ARMOR, GUN_ACTION);

function start(): { state: GameState; gun: InstanceId } {
  const base = gameAtFirstTurn({ cards: [ARMOR_CARD, GUN], deps, deck: [ARMOR_CARD.id, GUN.id] });
  const armor = playerCardIntoPlay(base, ARMOR_CARD.id, P1);
  const gun = playerCardIntoPlay(armor.state, GUN.id, P1);
  return { state: gun.state, gun: gun.id };
}

/** Picks the gun's Action and pays it with the first hand card offered. */
const pick = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice!;
  if (choice.prompt.kind === "spendResources") return [choice.options[0]!.optionId];
  return defaultPick(state);
};

describe("useActionAbility: an Action ability of a card you control, out of turn, paying its cost (#890 item 6)", () => {
  it("at the end of the player phase the gun's Action resolves and a hand card pays for it", () => {
    const { state, gun } = start();
    const driven = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }], pick);
    const after = driven.session.state;
    expect(mustInstance(after, gun).counters.shot).toBe(1);
    const spent = driven.events.some((event) => event.type === "paymentCommitted");
    expect(spent).toBe(true);
    const replayed = replay(driven.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(after);
  });

  it("with no card in hand to pay, the Action is not offered and nothing resolves", () => {
    const { state, gun } = start();
    const empty: GameState = {
      ...state,
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, deck: [...p.hand, ...p.deck], hand: [] } : p)),
    };
    // The end-of-phase draw refills the hand before step 3, so the hand is emptied from the deck as well.
    const noCards: GameState = {
      ...empty,
      players: empty.players.map((p) => (p.playerId === P1 ? { ...p, deck: [] } : p)),
    };
    const driven = driveSession(startSession(noCards), deps, [{ type: "endTurn", playerId: P1 }], pick);
    expect(mustInstance(driven.session.state, gun).counters.shot ?? 0).toBe(0);
    expect(mustPlayer(driven.session.state, P1).hand.length).toBe(0);
  });
});
