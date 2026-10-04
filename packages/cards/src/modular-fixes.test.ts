/**
 * Rules-QA follow-up to docs/phase7-wave6-qa-modular-matrix.md: the fixes for findings F3 to F7 and the owner's answers
 * Q-M1 to Q-M4, each as a scenario test against the printed text (the matrix itself holds the pins).
 */
import { cardsInPlay } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_SCENARIOS, startPairing } from "./testing/modular-matrix.js";

const TIMEOUT = 120_000;

const instancesOf = (state: ReturnType<typeof startPairing>, code: string) =>
  Object.values(state.instances).filter((instance) => instance.cardId === code);

describe("F3: Ship Command's Milano starts in play wherever the set is in the game (RRG 1.8 'Setup (Keyword)' p. 40, step 11 p. 51)", () => {
  const SCENARIOS = [
    "rhino",
    "red-skull",
    "kang",
    "infiltrate-the-museum",
    "ebony-maw",
    "tower-defense",
    "sandman",
    "sabretooth",
    "magneto",
    "magog",
  ];
  for (const id of SCENARIOS) {
    it(
      `${id}: the Milano is in play under the first player, once`,
      () => {
        expect(PLAYABLE_SCENARIOS.some((scenario) => scenario.id === id)).toBe(true);
        const state = startPairing("ship_command", id);
        const milano = instancesOf(state, "16142");
        expect(milano).toHaveLength(1);
        expect(cardsInPlay(state)).toContain(milano[0]!.instanceId);
        expect(milano[0]!.controllerId).toBe(state.firstPlayerId);
      },
      TIMEOUT,
    );
  }
});
