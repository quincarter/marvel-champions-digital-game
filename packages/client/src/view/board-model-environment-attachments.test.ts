/**
 * Upgraded Drones (`core` 01142) attaches to the Ultron Drones environment, and its "Hero Action: Spend [energy]
 * [mental] [physical] resources → discard this card" was legal in the engine all along. The environment's panel had
 * no attachments field, so the board drew nothing for it and there was nothing to tap to use the action (issue #462).
 */

import { describe, expect, test } from "vitest";
import { applyCommand, legalActions, type GameState, type InstanceId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { POOL_DEPS } from "../content/pool.js";
import { boardModel } from "./board-model.js";
import { abilityActionsFor, highlights } from "./highlights.js";

/** Test surgery: an Upgraded Drones from the encounter deck, attached to Ultron Drones as its When Revealed would. */
function withUpgradedDrones(game: GameState): { readonly game: GameState; readonly drones: InstanceId } {
  const environment = game.villainArea.find((id) => game.instances[id]?.cardId === "01140")!;
  const drones = Object.values(game.instances).find((card) => card.cardId === "01142")!.instanceId;
  const decks = Object.fromEntries(
    Object.entries(game.encounterDecks).map(([id, deck]) => [
      id,
      { ...deck, deck: deck.deck.filter((card) => card !== drones) },
    ]),
  );
  return {
    drones,
    game: {
      ...game,
      encounterDecks: decks as GameState["encounterDecks"],
      instances: {
        ...game.instances,
        [drones]: { ...game.instances[drones]!, faceup: true, attachedTo: environment },
        [environment]: { ...game.instances[environment]!, attachments: [drones] },
      },
    },
  };
}

describe("an attachment on an environment", () => {
  test("Upgraded Drones is listed on Ultron Drones' panel, with its discard action usable", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "ultron",
      difficulty: "standard",
      players: [{ starterDeckId: "core-iron-man-aggression" }],
      seed: 8,
    });
    // Past setup's own prompts (the mulligan), then into hero form: the action is a Hero Action.
    for (let step = 0; step < 40 && store.state.legal?.actions.kind === "choice"; step++) {
      const { choice } = store.state.legal.actions;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
    }
    const { game: started, perspectiveId } = store.state;
    if (!started || !perspectiveId) throw new Error("no game");
    const changed = applyCommand(started, { type: "changeForm", playerId: perspectiveId }, POOL_DEPS);
    if (!changed.ok) throw new Error(changed.error.message);
    const { game, drones } = withUpgradedDrones(changed.state);

    const environment = boardModel(game, perspectiveId, POOL_DEPS).environments.find(
      (panel) => panel.name === "Ultron Drones",
    );
    expect(environment?.attachments.map((chip) => [chip.instanceId, chip.name])).toEqual([[drones, "Upgraded Drones"]]);

    const legal = legalActions(game, perspectiveId, POOL_DEPS);
    expect(highlights(legal).usableAbilities.has(drones)).toBe(true);
    expect(abilityActionsFor(legal, drones)[0]?.action.abilityId).toBe("01142.upgraded-drones-action");
  });
});
