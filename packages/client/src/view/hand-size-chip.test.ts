import { describe, expect, test } from "vitest";
import { activeVillain, type GameState, type InstanceId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { characterPanel, handSizeChipText } from "./board-model.js";

/** Plays past setup and flips to hero, the fixture `hand-size-note.test.ts` uses. */
async function heroTurn(starterDeckId: string): Promise<GameState> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({ scenarioId: "rhino", difficulty: "standard", players: [{ starterDeckId }], seed: 4 });
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

/** The first copy of `code` in the player's deck put straight into play under their control (surgery). */
function intoPlay(state: GameState, code: string): GameState {
  const player = state.players[0]!;
  const id = player.deck.find((card) => state.instances[card]?.cardId === code) as InstanceId | undefined;
  if (!id) throw new Error(`no ${code} in the deck`);
  return {
    ...state,
    players: [
      { ...player, deck: player.deck.filter((card) => card !== id), playArea: [...player.playArea, id] },
      ...state.players.slice(1),
    ],
    instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, controllerId: player.playerId } },
  };
}

describe("the identity panel's hand size chip", () => {
  test("Iron Man: printed 1, and each Tech upgrade he controls raises the value the panel carries", async () => {
    const base = await heroTurn("core-iron-man-aggression");
    const identity = base.players[0]!.identity.instanceId;
    expect(characterPanel(base, identity, POOL_DEPS).handSize).toEqual({ value: 1, printed: 1 });

    const two = intoPlay(intoPlay(base, "01035"), "01039");
    const chip = characterPanel(two, two.players[0]!.identity.instanceId, POOL_DEPS).handSize!;
    expect(chip).toEqual({ value: 3, printed: 1 });
    expect(handSizeChipText(chip)).toBe("HAND SIZE 3 · printed 1");
  });

  test("an unmodified hero reads plainly, and a card that is not an identity carries none", async () => {
    const state = await heroTurn("core-spider-man-justice");
    const panel = characterPanel(state, state.players[0]!.identity.instanceId, POOL_DEPS);
    expect(panel.handSize).toEqual({ value: 5, printed: 5 });
    expect(handSizeChipText(panel.handSize!)).toBe("HAND SIZE 5");
    const villain = characterPanel(state, activeVillain(state).instanceId, POOL_DEPS);
    expect(villain.handSize).toBeUndefined();
  });
});
