/**
 * Playing a dev game forward on the engine's own commands (`dev-uncanny-game.ts`, `dev-in-play-cost-games.ts`): the
 * shared steps. Nothing here edits a state, so every game built from them replays byte for byte like any saved game.
 */
import { cardId } from "@mc/content";
import type { CardId } from "@mc/content";
import type { GameState } from "@mc/engine";
import type { SessionStore } from "./session-store.js";

export const ids = (...codes: string[]): CardId[] => codes.map((code) => cardId(code));
export const copies = (code: string, count: number): string[] => Array<string>(count).fill(code);
export const codeOf = (game: GameState, instanceId: string): string => game.instances[instanceId]?.cardId as string;

export type Turn = Extract<NonNullable<SessionStore["state"]["legal"]>["actions"], { kind: "turn" }>;

/** Answers every open choice with its minimum; returns the turn's legal list, or null when the game is over. */
export async function nextTurn(store: SessionStore): Promise<Turn | null> {
  for (let guard = 0; guard < 60; guard++) {
    const game = store.state.game;
    const actions = store.state.legal?.actions;
    if (!game || game.outcome || !actions) return null;
    if (actions.kind === "choice") {
      await store.resolveChoice(actions.choice.options.slice(0, actions.choice.minSelections).map((o) => o.optionId));
      continue;
    }
    return actions.kind === "turn" ? actions : null;
  }
  return null;
}
