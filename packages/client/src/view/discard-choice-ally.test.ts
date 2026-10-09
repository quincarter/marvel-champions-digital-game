/**
 * A card still in hand is offered for play, never for its in-play ability's cost: Randall (45003, an ally whose
 * in-play Action discards a resource card) must not open the "discard 1" picker when the player plays him.
 */

import { cardOf, getPlayer, type GameState, type InstanceId, type LegalAction, type PlayerId } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { beginDiscardChoice, discardCostOf } from "./discard-choice-model.js";

let state: GameState;
let me: PlayerId;
let randall: InstanceId;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "bishop-leadership" }],
    seed: 3,
  });
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  const game = store.state.game!;
  me = store.state.perspectiveId!;
  const found = Object.keys(game.instances).find((id) => cardOf(game, id as InstanceId)?.id === "45003");
  if (!found) throw new Error("Randall is not in the deck");
  randall = found as InstanceId;
  const player = getPlayer(game, me)!;
  // Stand Randall in hand wherever he was, with a few other cards to discard.
  const strip = (list: readonly InstanceId[]) => list.filter((id) => id !== randall);
  state = {
    ...game,
    players: {
      ...game.players,
      [me]: {
        ...player,
        hand: [randall, ...strip(player.hand)],
        deck: strip(player.deck),
        discard: strip(player.discard),
      },
    },
  } as unknown as GameState;
}, 60_000);

const playRandall = (): LegalAction =>
  ({
    action: { kind: "playCard", instanceId: randall },
    example: { type: "playCard", playerId: me, cardInstanceId: randall, payment: [], attachToInstanceId: null },
    targets: [],
    blockedTargets: [],
    needsPayment: true,
  }) as unknown as LegalAction;

describe("a card in hand", () => {
  test("playing an ally has no discard cost, even when his in-play Action has one", () => {
    expect(discardCostOf(state, POOL_DEPS, me, playRandall().action)).toBeNull();
    expect(beginDiscardChoice(state, me, playRandall(), POOL_DEPS)).toBeNull();
  });

  test("using his in-play Action still reads the discard cost", () => {
    const cost = discardCostOf(state, POOL_DEPS, me, {
      kind: "useAbility",
      instanceId: randall,
      abilityId: "45003.randall-action",
    } as unknown as LegalAction["action"]);
    expect(cost).toEqual({ min: 1, max: 1 });
  });
});
