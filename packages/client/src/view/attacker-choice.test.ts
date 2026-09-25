import { describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import { cardOf, legalActions, type GameState, type InstanceId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import type { SessionConfig } from "../engine/host.js";
import { SessionStore } from "../store/session-store.js";
import { powerEntries, powerSources } from "./attacker-choice.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 4,
};

/** Plays past setup and flips to hero, the same as `targeting-panel.test.ts`'s own fixture. */
async function intoTurn(): Promise<GameState> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(RHINO_SOLO);
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  const legal = store.state.legal?.actions;
  if (legal?.kind === "turn") {
    const flip = legal.legal.find((entry) => entry.action.kind === "changeForm");
    if (flip) await store.dispatch(flip.example);
  }
  return store.state.game!;
}

/** Moves the first ally in the player's hand or deck into play, ready, and stuns the hero when asked. */
function withAlly(state: GameState, stunHero: boolean): { state: GameState; ally: InstanceId } {
  const player = state.players[0]!;
  const ally = [...player.hand, ...player.deck].find((id) => cardOf(state, id)?.type === "ally");
  if (!ally) throw new Error("expected an ally in the Spider-Man deck");
  const hero = player.identity.instanceId;
  const heroInstance = state.instances[hero]!;
  return {
    ally,
    state: {
      ...state,
      players: [
        {
          ...player,
          hand: player.hand.filter((id) => id !== ally),
          deck: player.deck.filter((id) => id !== ally),
          playArea: [...player.playArea, ally],
        },
        ...state.players.slice(1),
      ],
      instances: {
        ...state.instances,
        [ally]: { ...state.instances[ally]!, exhausted: false },
        [hero]: stunHero ? { ...heroInstance, statuses: { ...heroInstance.statuses, stunned: 1 } } : heroInstance,
      },
    },
  };
}

describe("powerSources", () => {
  test("a stunned hero and a ready ally are both offered, the hero marked as cancelled by the stun", async () => {
    const { state, ally } = withAlly(await intoTurn(), true);
    const actions = legalActions(state, state.players[0]!.playerId, CORE_DEPS);
    const sources = powerSources(state, powerEntries(actions, "attack"), "attack", CORE_DEPS);

    const hero = state.players[0]!.identity.instanceId;
    expect(sources.map((source) => source.instanceId)).toEqual([hero, ally]);
    expect(sources[0]!.cancelledBy).toBe("stunned");
    expect(sources[0]!.note).toMatch(/Stunned/);
    expect(sources[1]!.cancelledBy).toBeNull();
    expect(sources[1]!.stat).toMatch(/^ATK \d/);
    const printed = cardOf(state, ally);
    if (printed?.type !== "ally") throw new Error("expected an ally");
    expect(sources[1]!.consequential).toBe(printed.consequentialDamage.attack);
  });

  test("with only the hero able to attack there is nothing to pick", async () => {
    const state = await intoTurn();
    const actions = legalActions(state, state.players[0]!.playerId, CORE_DEPS);
    const sources = powerSources(state, powerEntries(actions, "attack"), "attack", CORE_DEPS);
    expect(sources).toHaveLength(1);
    expect(sources[0]!.cancelledBy).toBeNull();
    expect(sources[0]!.consequential).toBe(0);
  });
});
