import { applyCommand, createGame, type GameState } from "@mc/engine";
import { CORE_DEPS, coreScenario } from "./core/index.js";
import { playToOutcome } from "./testing/driver.js";

/**
 * RRG "Limit": "Limit once per round" on Jennifer Walters' "I Object!" was
 * reported firing more than once in a single villain phase of a 4-player game.
 * The engine's stub-level check (`engine/src/replacement.test.ts`) covers one
 * scheme step; this plays full 4-player Core games with the greedy driver —
 * which takes every optional trigger it is offered — from two seats, against
 * two villains, and counts resolutions per round from the replayed log.
 */
const HEROES = ["core-spider-man-justice", "core-iron-man-aggression", "core-black-panther-protection"] as const;

test("'I Object!' resolves at most once per round across full 4-player games", () => {
  const violations: string[] = [];
  let resolutions = 0;
  for (const villain of ["rhino", "klaw"] as const) {
    for (const seat of [0, 2]) {
      for (const seed of [11, 12]) {
        const players: string[] = [...HEROES];
        players.splice(seat, 0, "core-she-hulk-aggression");
        const created = createGame(
          coreScenario(villain, { players: players.map((starterDeckId) => ({ starterDeckId })), seed }),
          CORE_DEPS,
        );
        if (!created.ok) throw new Error(created.error.message);
        const { session } = playToOutcome(created.state, CORE_DEPS, { maxCommands: 4000 });

        let state: GameState = session.log.initialState;
        const perRound = new Map<number, number>();
        for (const command of session.log.commands) {
          // One command can carry a villain phase and the next round's start.
          let round = state.round;
          const applied = applyCommand(state, command, CORE_DEPS);
          if (!applied.ok) throw new Error(applied.error.message);
          for (const event of applied.events) {
            if (event.type === "roundStarted") round = event.round;
            if (event.type === "abilityResolved" && String(event.abilityId) === "01019b.i-object") {
              perRound.set(round, (perRound.get(round) ?? 0) + 1);
              resolutions++;
            }
          }
          state = applied.state;
        }
        for (const [round, count] of perRound) {
          if (count > 1) violations.push(`${villain} seat ${seat} seed ${seed}, round ${round}: ${count}`);
        }
      }
    }
  }
  // Guards the guard: a run where the ability never fired would prove nothing.
  expect(resolutions).toBeGreaterThan(0);
  expect(violations).toEqual([]);
}, 120_000);
