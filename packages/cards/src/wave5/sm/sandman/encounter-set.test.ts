import { characterProfile } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { firstLegal, identityOf, inst, instancesOf, P1, settle, toHero, use } from "../../../testing/harness.js";
import { runWave5, WAVE5_DEPS } from "../../testing.js";
import { startWave5Game } from "../../testing.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";

const sandmanGame = (seed = 1) => startWave5Game(ghostSpiderScenario("sandman", { seed }));
const cityStreetsId = (state: ReturnType<typeof sandmanGame>) => instancesOf(state, "27065")[0]!;
const sandCounters = (state: ReturnType<typeof sandmanGame>) => inst(state, cityStreetsId(state)).counters["sand"] ?? 0;

describe("City Streets (27065)", () => {
  it("27065.city-streets-action: exhausting a character removes sand counters equal to its ATK (once per round per player)", () => {
    const hero = settle(runWave5(sandmanGame(), toHero()), firstLegal, undefined, WAVE5_DEPS);
    const identity = identityOf(hero);
    const atk = characterProfile(hero, identity, WAVE5_DEPS)?.atk ?? 0;
    expect(atk).toBeGreaterThan(0);
    const before = sandCounters(hero); // 4 from setup
    const streets = cityStreetsId(hero);
    const after = settle(
      runWave5(hero, use(P1, streets, "27065.city-streets-action")),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(sandCounters(after)).toBe(Math.max(0, before - atk));
  });
});
