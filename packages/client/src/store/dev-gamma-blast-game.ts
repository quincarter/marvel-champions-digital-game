/**
 * A real one-seat game stopped on a sentence's combined response window (#410; RRG 1.8 "Triggering Condition", p. 45):
 * Spectrum (Leadership) against Rhino plays Gamma Blast (21007), "Change to Gamma energy form and deal 7 damage to an
 * enemy". The form's own "Hero Response: After you change to this energy form, deal 1 damage to an enemy" waits for the
 * whole sentence (FFG ruling Dec 8, 2023, #126), so its window opens after the attack, and the sheet is headed by the
 * form change it answers, not by the attack. Played forward through the store with `SessionConfig.stack` and the
 * engine's own example commands, never a state edit, so it replays byte for byte like any saved game.
 * `dev-gamma-blast-game.test.ts` proves it reaches that window.
 */
import type { GameState } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import { codeOf, ids } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const GAMMA_BLAST = "21007";
/** Spectrum's Gamma energy form upgrade. */
const GAMMA_FORM = "21002";

export const GAMMA_BLAST_DEV_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "spectrum-leadership" }],
  seed: 1,
  stack: { players: { 0: ids(GAMMA_BLAST) } },
};

/** True once the response window after Gamma Blast's sentence is asking the player. */
export function gammaBlastWindowReached(game: GameState): boolean {
  return game.pendingChoice?.prompt.kind === "chooseTriggers" && game.pendingChoice.prompt.timing === "response";
}

/**
 * Keeps the opening hand, changes to hero form (every choice that asks at its minimum), plays Gamma Blast on Rhino
 * and stops on the first response window that asks.
 */
export async function startGammaBlastDevGame(store: SessionStore, config = GAMMA_BLAST_DEV_CONFIG): Promise<boolean> {
  await store.start(config);
  let played = false;
  for (let step = 0; step < 80; step++) {
    const game = store.state.game;
    const actions = store.state.legal?.actions;
    if (!game || game.outcome || !actions) return false;
    if (played && gammaBlastWindowReached(game)) return true;
    if (actions.kind === "choice") {
      const { options, minSelections } = actions.choice;
      // Energy Transformation's pick: any energy form but Gamma, so Gamma Blast really changes form.
      const other = options.find((o) => o.ref.kind === "card" && codeOf(game, o.ref.instanceId) !== GAMMA_FORM);
      const pick =
        !played &&
        minSelections === 1 &&
        options.some((o) => o.ref.kind === "card" && codeOf(game, o.ref.instanceId) === GAMMA_FORM) &&
        other
          ? [other.optionId]
          : options.slice(0, minSelections).map((o) => o.optionId);
      await store.resolveChoice(pick);
      continue;
    }
    if (actions.kind !== "turn") return false;
    if (game.players[0]!.identity.form === "alterEgo") {
      const flip = actions.legal.find((entry) => entry.action.kind === "changeForm");
      if (!flip) return false;
      await store.dispatch(flip.example);
      continue;
    }
    const blast = actions.legal.find(
      (entry) => entry.action.kind === "playCard" && codeOf(game, entry.action.instanceId) === GAMMA_BLAST,
    );
    if (!blast || played) return false;
    played = true;
    await store.dispatch(blast.example);
  }
  return false;
}
