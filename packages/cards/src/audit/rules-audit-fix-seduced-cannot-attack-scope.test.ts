import { canAttack, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { identityOf, instancesOf, P1, runWith, settle, firstLegal, toHero } from "../testing/harness.js";
import { WAVE4_DEPS } from "../wave4/index.js";
import { spectrumScenario } from "../wave4/mts/support.js";
import { valkyrieScenario } from "../wave4/valk/support.js";
import { startWave4Game } from "../wave4/testing.js";

/**
 * Seduced, "You cannot make basic attacks or play Attack events": the first half bars only the identity's basic attack,
 * not an attack made by a card's ability (RRG 1.8 "Basic Power", p. 10; "You, Your", p. 49). The 21179 (mts) and 25032
 * (Valkyrie nemesis) printings must scope the rule the way 55015 does (`cannotMakeBasicAttacks`).
 */
function seduce(hero: GameState, code: string): { readonly state: GameState; readonly identity: string } {
  const identity = identityOf(hero, P1);
  const seduced = instancesOf(hero, code)[0]!;
  const state: GameState = {
    ...hero,
    instances: {
      ...hero.instances,
      [seduced]: { ...hero.instances[seduced]!, attachedTo: identity, faceup: true, controllerId: P1 },
      [identity]: { ...hero.instances[identity]!, attachments: [...hero.instances[identity]!.attachments, seduced] },
    },
  };
  return { state, identity };
}

describe("Seduced bars only basic attacks (21179, 25032)", () => {
  const cases: readonly [string, () => GameState][] = [
    [
      "21179",
      () =>
        settle(
          runWith(
            WAVE4_DEPS,
            startWave4Game(spectrumScenario("ebony-maw", { seed: 6, modularSetIds: ["enchantress"] })),
            toHero(P1),
          ),
          firstLegal,
          undefined,
          WAVE4_DEPS,
        ),
    ],
    ["25032", () => runWith(WAVE4_DEPS, startWave4Game(valkyrieScenario("rhino", { seed: 4 })), toHero())],
  ];
  for (const [code, build] of cases) {
    it(`${code}: the identity cannot make a basic attack, but an ability's attack is still allowed`, () => {
      const { state, identity } = seduce(build(), code);
      const villain = state.villains[0]!.instanceId;
      expect(canAttack(state, identity as never, villain, WAVE4_DEPS, true)).toBe(false);
      expect(canAttack(state, identity as never, villain, WAVE4_DEPS, false)).toBe(true);
    });
  }
});
