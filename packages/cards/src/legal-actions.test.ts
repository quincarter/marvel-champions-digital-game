import { applyCommand, createGame, legalActions, type Command, type GameSetupConfig, type LegalAction } from "@mc/engine";
import { CORE_DEPS, coreScenario } from "./core/index.js";
import { playToOutcome } from "./testing/driver.js";

/**
 * `legalActions` against real Core games. The greedy driver finds its moves
 * independently, by trying commands against `applyCommand`. So at every
 * player-turn state:
 * - every command the driver actually issued must be listed as legal, with its target;
 * - every listed action's example command must be accepted.
 */

/** Does `command` fall under `entry` (same action, and its target is one of the legal ones)? */
function covers(entry: LegalAction, command: Command): boolean {
  const action = entry.action;
  switch (command.type) {
    case "playCard": {
      if (action.kind !== "playCard" || action.instanceId !== command.cardInstanceId) return false;
      if (command.attachToInstanceId !== null && !entry.targets.includes(command.attachToInstanceId)) return false;
      const picks = Object.entries(command.costChoices ?? {}).filter(([slot]) => slot !== "discard").flatMap(([, ids]) => ids);
      return picks.every((id) => entry.targets.includes(id));
    }
    case "useAbility":
      return action.kind === "useAbility" && action.instanceId === command.cardInstanceId && action.abilityId === command.abilityId;
    case "basicAttack":
      return action.kind === "basicAttack" && action.instanceId === command.attackerInstanceId && entry.targets.includes(command.targetInstanceId);
    case "basicThwart":
      return action.kind === "basicThwart" && action.instanceId === command.thwarterInstanceId && entry.targets.includes(command.schemeInstanceId);
    case "basicRecover":
    case "changeForm":
    case "endTurn":
      return action.kind === command.type;
    case "resolveChoice":
      return false;
  }
}

const GAMES: readonly [string, GameSetupConfig][] = [
  ["Rhino, solo", coreScenario("rhino", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 2026 })],
  ["Klaw, 2 players", coreScenario("klaw", { players: [{ starterDeckId: "core-she-hulk-aggression" }, { starterDeckId: "core-black-panther-protection" }], seed: 77 })],
  [
    "Ultron, 4 players",
    coreScenario("ultron", {
      players: ["core-captain-marvel-leadership", "core-iron-man-aggression", "core-black-panther-protection", "core-spider-man-justice"].map((starterDeckId) => ({ starterDeckId })),
      seed: 1138,
    }),
  ],
];

describe("legalActions on real Core games", () => {
  for (const [label, config] of GAMES) {
    it(`${label}: every driver move is listed as legal, and every listed example is accepted`, () => {
      const created = createGame(config, CORE_DEPS);
      if (!created.ok) throw new Error(created.error.message);
      const { session } = playToOutcome(created.state, CORE_DEPS);
      let state = session.log.initialState;
      let checked = 0;
      let slowest = 0;
      for (const command of session.log.commands) {
        if (command.type !== "resolveChoice") {
          const started = performance.now();
          const result = legalActions(state, command.playerId, CORE_DEPS);
          slowest = Math.max(slowest, performance.now() - started);
          expect(result.kind).toBe("turn");
          if (result.kind === "turn") {
            const listed = result.legal.some((entry) => covers(entry, command));
            if (!listed) throw new Error(`${command.type} was accepted but not listed as legal: ${JSON.stringify(command)}`);
            for (const entry of result.legal) {
              const accepted = applyCommand(state, entry.example, CORE_DEPS);
              if (!accepted.ok) throw new Error(`example for ${JSON.stringify(entry.action)} rejected: ${accepted.error.message}`);
            }
            checked++;
          }
        }
        const next = applyCommand(state, command, CORE_DEPS);
        if (!next.ok) throw new Error(next.error.message);
        state = next.state;
      }
      console.info(`[legalActions] ${label}: ${checked} turn states checked, slowest call ${slowest.toFixed(1)} ms`);
      expect(checked).toBeGreaterThan(0);
    }, 180_000);
  }
});
