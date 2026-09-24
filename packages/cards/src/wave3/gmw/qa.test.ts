import { encounterSetId } from "@mc/content";
import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE3_DEPS } from "../index.js";
import { wave3Scenario } from "../setup.js";

/**
 * rules-qa-engineer wave 3 pass over `gmw` (docs/phase7-wave3-qa.md has the full report). Bugs proven here are
 * reported to their owning specialist, not fixed here (CLAUDE.md's rules-qa-engineer ownership boundary).
 *
 * Smoke-game coverage this file adds beyond the existing per-scenario `e2e.test.ts`/`*-e2e.test.ts` files (which
 * were all Groot-Protection solo standard only before this pass): Rocket Raccoon solo, a 2-player Groot+Rocket
 * game (exercising Team-Up/Flora and Fauna, §3.34), expert-mode games, and the two scenarios with no e2e game at
 * all yet (Escape the Museum, Nebula). Every game asserts a real outcome, no stuck `PendingChoice`, and a
 * deep-equal replay.
 */

function runSmoke(
  label: string,
  scenarioId: string,
  players: readonly ({ starterDeckId: string } | never)[],
  opts: {
    seed: number;
    difficulty?: "standard" | "expert";
    modularSetIds?: readonly ReturnType<typeof encounterSetId>[];
  },
) {
  const config = wave3Scenario(scenarioId, {
    players,
    seed: opts.seed,
    ...(opts.difficulty ? { difficulty: opts.difficulty } : {}),
    ...(opts.modularSetIds ? { modularSetIds: opts.modularSetIds } : {}),
  });
  const created = createGame(config, WAVE3_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE3_DEPS);
  console.info(
    `[wave3 qa smoke] ${label}: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE3_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  return result;
}

test("Brotherhood of Badoon (standard), solo: Rocket Raccoon (Aggression)", () => {
  runSmoke(
    "Brotherhood of Badoon (standard) — Rocket",
    "brotherhood-of-badoon",
    [{ starterDeckId: "rocket-raccoon-aggression" }],
    {
      seed: 2027,
    },
  );
}, 120_000);

test("Brotherhood of Badoon (standard), 2-player: Groot (Protection) + Rocket Raccoon (Aggression) — Team-Up (Flora and Fauna)", () => {
  runSmoke(
    "Brotherhood of Badoon (standard), 2p — Groot + Rocket",
    "brotherhood-of-badoon",
    [{ starterDeckId: "groot-protection" }, { starterDeckId: "rocket-raccoon-aggression" }],
    { seed: 2028 },
  );
}, 180_000);

test("Brotherhood of Badoon (expert), solo: Groot (Protection)", () => {
  runSmoke("Brotherhood of Badoon (expert) — Groot", "brotherhood-of-badoon", [{ starterDeckId: "groot-protection" }], {
    seed: 2029,
    difficulty: "expert",
  });
}, 120_000);

test("Infiltrate the Museum (expert), solo: Rocket Raccoon (Aggression)", () => {
  runSmoke(
    "Infiltrate the Museum (expert) — Rocket",
    "infiltrate-the-museum",
    [{ starterDeckId: "rocket-raccoon-aggression" }],
    {
      seed: 2030,
      difficulty: "expert",
    },
  );
}, 120_000);

test("Escape the Museum (standard), solo: Groot (Protection) — no existing e2e game before this pass", () => {
  runSmoke("Escape the Museum (standard) — Groot", "escape-the-museum", [{ starterDeckId: "groot-protection" }], {
    seed: 2031,
  });
}, 120_000);

test("Escape the Museum (expert), solo: Rocket Raccoon (Aggression) — the ∞ hit point Collector B2 face (§1.1, §3.1)", () => {
  runSmoke(
    "Escape the Museum (expert) — Rocket",
    "escape-the-museum",
    [{ starterDeckId: "rocket-raccoon-aggression" }],
    {
      seed: 2032,
      difficulty: "expert",
    },
  );
}, 120_000);

test("Nebula (standard), solo: Groot (Protection) — no existing e2e game before this pass", () => {
  runSmoke("Nebula (standard) — Groot", "nebula", [{ starterDeckId: "groot-protection" }], { seed: 2033 });
}, 120_000);

test("Nebula (expert), solo: Rocket Raccoon (Aggression)", () => {
  runSmoke("Nebula (expert) — Rocket", "nebula", [{ starterDeckId: "rocket-raccoon-aggression" }], {
    seed: 2034,
    difficulty: "expert",
  });
}, 120_000);

test("Ronan the Accuser (standard), 2-player: Groot (Protection) + Rocket Raccoon (Aggression) — also exercises the ron/Kree Fanatic-sharing Power Stone modular", () => {
  runSmoke(
    "Ronan the Accuser (standard), 2p — Groot + Rocket",
    "ronan-the-accuser",
    [{ starterDeckId: "groot-protection" }, { starterDeckId: "rocket-raccoon-aggression" }],
    { seed: 2035 },
  );
}, 180_000);

/**
 * `ron`'s own "Kree Fanatic" modular set (docs/phase7-wave3.md §2.3) is not recommended by any `gmw` 1A, so no
 * `e2e`/`qa` test anywhere else in this pass runs it inside a real scenario. Swapped into Brotherhood of Badoon's
 * modular slot (its own villain, Drang, has no title conflict with `ron`'s Ronan the Accuser minion, unlike
 * Ronan the Accuser the scenario, whose villain shares that exact title — docs/phase7-wave3.md §2.3's own
 * uniqueness note) via `modularSetIds`, a real seeded game to a real outcome.
 */
test("Brotherhood of Badoon (standard), solo: Groot (Protection), with the ron/Kree Fanatic modular in place of Band of Badoon", () => {
  runSmoke(
    "Brotherhood of Badoon (standard) — Groot, Kree Fanatic modular",
    "brotherhood-of-badoon",
    [{ starterDeckId: "groot-protection" }],
    {
      seed: 2036,
      modularSetIds: [encounterSetId("kree_fanatic")],
    },
  );
}, 120_000);
