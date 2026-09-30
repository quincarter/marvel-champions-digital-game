import { activeVillain } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { inst, instancesOf, mainThreat } from "../../../testing/harness.js";
import { validateDefinition } from "../../../dsl/validate.js";
import { startWave5Game } from "../../testing.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";
import { HAPLESS_PEDESTRIANS } from "./main-scheme.js";

const valid = (definition: Parameters<typeof validateDefinition>[0]) =>
  expect(validateDefinition(definition)).toEqual([]);

describe("Hapless Pedestrians (27064a/b)", () => {
  it("27064a.setup: searches for City Streets, puts it into play and places 4 sand counters on it", () => {
    const state = startWave5Game(ghostSpiderScenario("sandman", { seed: 1 }));
    const streets = instancesOf(state, "27065")[0];
    expect(streets).toBeDefined();
    expect(state.villainArea).toContain(streets);
    expect(inst(state, streets!).counters["sand"]).toBe(4);
    expect(activeVillain(state).stageIndex).toBe(0);
    expect(mainThreat(state)).toBeGreaterThanOrEqual(0);
  });

  it("27064b.hapless-pedestrians-forced-response: deals 3 indirect damage to the first player after a token is placed here", () => {
    // Real-game dispatch of "an acceleration token placed on Hapless Pedestrians specifically" is already exercised
    // generically at the engine level: `packages/engine/src/acceleration-tokens-anywhere.test.ts` is built directly
    // around this card as its own worked example (docs/phase7-wave5.md §3.4's docblock names it), and `@mc/engine`'s
    // package export map (`"exports": { ".": "./src/index.ts" }`) does not expose its `testing/*` fixtures for reuse
    // from `@mc/cards`. No `sm` card in scope adds a token to the main scheme yet either (that is Venom/Mysterio/
    // The Sinister Six/Venom Goblin's own cards, or a modular set, docs/phase7-wave5.md §5), so this ref is proven
    // here at the DSL/shape level — the same `on.accelerationTokenPlaced("self")` + `dealIndirectDamage` shape
    // `packages/cards/src/dsl/wave5-primitives.test.ts`'s own "§3.4" describe block validates for this exact card.
    valid(HAPLESS_PEDESTRIANS["27064b.hapless-pedestrians-forced-response"]!);
    expect(HAPLESS_PEDESTRIANS["27064b.hapless-pedestrians-forced-response"]!.trigger).toMatchObject({
      on: { on: "accelerationTokenPlaced", selfIs: "target" },
    });
  });
});
