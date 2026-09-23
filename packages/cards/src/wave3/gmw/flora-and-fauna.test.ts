import type { InstanceId } from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  P2,
  patchInstance,
  payWith,
  play,
  settle,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { wave3Scenario } from "../setup.js";
import { runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";

/**
 * Flora and Fauna (16020, Groot's own card range; 16048, Rocket Raccoon's own identical printing) — Team-Up
 * (Groot and Rocket Raccoon). Both printed copies are scripted with the identical composition (`gmw/groot-kit.ts`,
 * `gmw/rocket-kit.ts`) and are tested together here, in one two-player game with Groot at P1 and Rocket Raccoon
 * at P2 (docs/phase7-wave3.md §3.34, docs/phase7-wave3-scripting.md §6d) — each playing their own printed copy
 * from their own hand, exercising both branches. The cross-player claim itself ("a Rocket Raccoon upgrade" is
 * any upgrade from Rocket's own identity-specific set, not merely one the *current* player controls) is already
 * covered at the engine level, `packages/engine/src/team-up-names.test.ts`.
 */
const grootAndRocketVsRhino = () =>
  startWave3Game(
    wave3Scenario("rhino", {
      players: [{ starterDeckId: "groot-protection" }, { starterDeckId: "rocket-raccoon-aggression" }],
      seed: 2026,
    }),
  );

/** Picks the offered option whose label starts with `prefix`; declines/first-legals everything else (the single
 * remaining `chooseTarget` candidate, when there's only one). */
const picking =
  (prefix: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hit = choice.options.find((o) => o.label.startsWith(prefix));
    return hit ? [hit.optionId] : firstLegal(state);
  };

describe("Flora and Fauna — Team-Up (Groot and Rocket Raccoon), a two-player game", () => {
  it("Groot's own copy (16020), played from his own hand: places 2 growth counters on Groot, capped at 10, and readies him (16020.flora-and-fauna-action)", () => {
    const hero = runWave3(grootAndRocketVsRhino(), toHero(P1));
    const groot = identityOf(hero, P1);
    const nearCap = patchInstance(hero, groot, { counters: { growth: 9 }, exhausted: true });
    const given = moveToHand(nearCap, P1, "16020");
    const [card] = given.ids as [InstanceId];
    const played = settle(
      runWave3(given.state, play(P1, card, payWith(given.state, P1, 1, [card]))),
      picking("Place 2 growth counters on Groot"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(played, groot).counters.growth).toBe(10); // 9 + 2, capped at 10, not 11
    expect(inst(played, groot).exhausted).toBe(false); // readied
  });

  it("Rocket's own copy (16048), played from his own hand: places 2 charge counters on his own Rocket's Pistol and readies it (16048.flora-and-fauna-action)", () => {
    // P1's own turn is first; end it with nothing done, so it's P2's (Rocket's) own turn.
    const p2Turn = settle(runWave3(grootAndRocketVsRhino(), endTurn(P1)), firstLegal, undefined, WAVE3_DEPS);
    const hero = runWave3(p2Turn, toHero(P2));
    // Rocket's Pistol (16038, a real [TECH] upgrade in Rocket's own card range) enters play with 3 charge
    // counters; exhaust it first so the ready is observable.
    const givenPistol = moveToHand(hero, P2, "16038");
    const [pistol] = givenPistol.ids as [InstanceId];
    const withPistol = settle(
      runWave3(givenPistol.state, play(P2, pistol, payWith(givenPistol.state, P2, 1, [pistol]))),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    const exhausted = patchInstance(withPistol, pistol, { exhausted: true });
    expect(inst(exhausted, pistol).counters.charge).toBe(3);

    const given = moveToHand(exhausted, P2, "16048");
    const [card] = given.ids as [InstanceId];
    const played = settle(
      runWave3(given.state, play(P2, card, payWith(given.state, P2, 1, [card]))),
      picking("Place 2 charge counters on a Rocket Raccoon upgrade"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(played, pistol).counters.charge).toBe(5); // 3 + 2
    expect(inst(played, pistol).exhausted).toBe(false); // readied
  });
});
