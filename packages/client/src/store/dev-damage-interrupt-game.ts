/**
 * The `?screen=villain-damage-interrupt` dev jump (`scenes/boot-dev-jump.ts`, issue #394): a real solo Rhino game
 * stopped on Backflip's interrupt window ("When you would take any amount of damage from an attack"), with the
 * attack's breakdown already resolved, so "happening now" has to show the damage the player is deciding on. Played
 * forward through the store with `SessionConfig.stack` and the engine's own example commands, never a state edit.
 */
import type { GameState } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import { ids } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const DAMAGE_INTERRUPT_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 1,
  stack: { players: { 0: ids("01003") } },
};

/** Backflip's window open on the damage from Rhino's attack. */
export function damageInterruptReached(game: GameState): boolean {
  const prompt = game.pendingChoice?.prompt;
  return prompt?.kind === "chooseTriggers" && prompt.event.kind === "dealDamage" && prompt.event.fromAttack === true;
}

/**
 * Starts the game in hero form on `store`; the returned function ends the turn and answers every choice with its
 * minimum (no defender, no Spider-Sense; the end-of-turn discard from the far end, keeping Backflip) until Backflip's
 * window opens. The board only collects the villain phase's
 * beats while it is mounted, so the dev jump calls it once the board is up.
 */
export async function startDamageInterruptGame(store: SessionStore): Promise<() => Promise<void>> {
  await store.start(DAMAGE_INTERRUPT_CONFIG);
  if (store.state.game?.pendingChoice) await store.resolveChoice([]);
  const legal = store.state.legal?.actions;
  if (legal?.kind === "turn") {
    const flip = legal.legal.find((entry) => entry.action.kind === "changeForm");
    if (flip) await store.dispatch(flip.example);
  }
  return async () => {
    const turn = store.state.legal?.actions;
    const end = turn?.kind === "turn" ? turn.legal.find((entry) => entry.action.kind === "endTurn") : undefined;
    if (end) await store.dispatch(end.example);
    for (let step = 0; step < 30; step++) {
      const game = store.state.game;
      const actions = store.state.legal?.actions;
      if (!game || game.outcome || actions?.kind !== "choice" || damageInterruptReached(game)) return;
      const { choice } = actions;
      const picks =
        choice.prompt.kind === "discardDownToHandSize"
          ? choice.options.slice(choice.options.length - choice.minSelections)
          : choice.options.slice(0, choice.minSelections);
      await store.resolveChoice(picks.map((o) => o.optionId));
    }
  };
}
