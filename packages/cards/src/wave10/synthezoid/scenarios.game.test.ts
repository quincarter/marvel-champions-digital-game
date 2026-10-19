/**
 * Rules QA for docs/phase7-synthezoid.md §8.5/§8.6: one seeded real game per Synthezoid Smackdown scenario (She-Hulk's
 * registration, Vision's resistance), standard and expert, built through the playable pool (`playableScenario` with
 * `PLAYABLE_DEPS`, the path the client takes once the pack is un-gated), not the `ungatedStageGame` shortcut. Each is
 * played by the greedy driver (testing/driver.ts, which knows no card names) to an outcome or a command cap. Claims:
 * the driver is never refused a command and never meets a stuck prompt (it throws), a finished game leaves no prompt
 * open, and the session log replays from its first state to a deep-equal state (PLAN.md Phase 1).
 * Run on 2026-10-19, every game a loss (the greedy driver is weak), none stalled or refused: she-hulk 1p standard s11
 * round 4 (35 commands), 2p expert s12 round 6 (123); vision 1p standard s11 round 5 (44), 2p expert s12 round 6 (120).
 */
import { createGame, replay } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "../../playable/index.js";
import { playToOutcome } from "../../testing/driver.js";

vi.setConfig({ testTimeout: 600_000 });

const CAP = 3000;
const TIGRA = "tigra-aggression";
const HULKLING = "hulkling-protection";

describe("seeded greedy games of the Synthezoid Smackdown scenarios, from the playable pool", () => {
  for (const scenario of ["registration-she-hulk", "resistance-vision"])
    for (const [players, difficulty, seed] of [
      [1, "standard", 11],
      [2, "expert", 12],
    ] as const)
      it(`${scenario}, ${players} player(s), ${difficulty}, seed ${seed}: plays to an outcome or ${CAP} commands, replays deep-equal`, () => {
        const config = playableScenario(scenario, {
          seed,
          difficulty,
          players: [{ starterDeckId: TIGRA }, ...(players === 2 ? [{ starterDeckId: HULKLING }] : [])],
        });
        const created = createGame(config, PLAYABLE_DEPS);
        if (!created.ok) throw new Error(`${created.error.code}: ${created.error.message}`);
        const run = playToOutcome(created.state, PLAYABLE_DEPS, { maxCommands: CAP });
        const end = run.session.state;
        expect(run.outcome !== null || run.commands >= CAP, "an outcome or the cap").toBe(true);
        if (run.outcome) expect(end.pendingChoice, "no prompt left open after the outcome").toBeNull();
        const replayed = replay(run.session.log, PLAYABLE_DEPS);
        if (!replayed.ok) throw new Error(`replay failed: ${replayed.error.message}`);
        expect(replayed.state).toEqual(end);
      });
});
