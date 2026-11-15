/**
 * A real one-seat game stopped on Black Panther's alter-ego turn with Kang's Stolen Memories (11019, "Alter-Ego Action:
 * Discard a [mental] resource from your hand → discard this obligation") in play, and a hand of two printed [mental]
 * cards (Avengers Mansion, Get Behind Me!) beside a printed wild (Wakanda Forever!): the Discord report behind issue
 * #717. Played forward through the store on the engine's own commands from a
 * searched seed, never a state edit. `dev-stolen-memories-game.test.ts` proves it reaches the state it claims.
 */
import type { SessionConfig } from "../engine/host.js";
import { codeOf, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const STOLEN_MEMORIES = "11019";

export const STOLEN_MEMORIES_DEV_CONFIG: SessionConfig = {
  scenarioId: "kang",
  difficulty: "standard",
  players: [{ starterDeckId: "core-black-panther-protection" }],
  // Found by search: seed 26 deals Avengers Mansion (01091) and Get Behind Me! (01078), both [mental], with Wakanda
  // Forever! (01043d), and leaves Stolen Memories second in the encounter deck, under Kang's own boost card, so it is
  // the card the player is dealt (RRG 1.8 "Villain Phase", p. 47).
  seed: 26,
};

const KEEP = new Set(["01091", "01078", "01043d"]);

/**
 * Ends the first turn in alter-ego form, so the villain phase deals Stolen Memories, and stops on the next turn. The
 * end-of-turn discard down to hand size keeps the three cards the picker is about; an encounter card's "discard 1 random
 * card or place threat" places threat, so the hand stays as dealt.
 */
export async function startStolenMemoriesDevGame(store: SessionStore): Promise<void> {
  await store.start(STOLEN_MEMORIES_DEV_CONFIG);
  const turn = await nextTurn(store);
  const end = turn?.legal.find((entry) => entry.action.kind === "endTurn");
  if (end) await store.dispatch(end.example);
  for (let guard = 0; guard < 60; guard++) {
    const game = store.state.game;
    const actions = store.state.legal?.actions;
    if (!game || game.outcome || actions?.kind !== "choice") return;
    const { choice } = actions;
    const keep = (optionId: string): boolean => {
      const ref = choice.options.find((each) => each.optionId === optionId)?.ref;
      return ref?.kind === "card" && KEEP.has(codeOf(game, ref.instanceId));
    };
    const preferred = choice.options.filter((option) => !keep(option.optionId) && !/random/i.test(option.label));
    const pool = preferred.length >= choice.minSelections ? preferred : choice.options;
    await store.resolveChoice(pool.slice(0, choice.minSelections).map((option) => option.optionId));
  }
}
