/**
 * Hex Bolt (15004), FFG ruling #106 (post-RRG 1.5, Oct 26, 2023): "you can choose which order to resolve the cards
 * discarded by Hex Bolt". Each discarded card's line counts its own boost icons as its turn comes; Chaos Control's
 * once-per-phase replacement lands on whichever card the player resolves first, which makes the order observable.
 */
import { activeEncounterDeck, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  playerOf,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../testing/harness.js";
import { wave2Scenario } from "../wave2/setup.js";
import { playFromHand, runWave2, startWave2Game } from "../wave2/testing.js";

describe("Hex Bolt: the player orders the discarded cards", () => {
  it("offers the three discarded cards and resolves the one chosen first", () => {
    const hero = runWave2(
      startWave2Game(wave2Scenario("rhino", { players: [{ starterDeckId: "scw-justice" }], seed: 2026 })),
      toHero(),
    );
    const villain = hero.villains[0]!.instanceId;
    identityOf(hero);
    const cleared = {
      ...hero,
      instances: {
        ...hero.instances,
        [villain]: { ...hero.instances[villain]!, damage: 0 },
        [hero.mainScheme.instanceId]: { ...hero.instances[hero.mainScheme.instanceId]!, threat: 5 },
      },
    };
    // Advance (0 icons), Caught Off Guard (1), Shadow of the Past (2); Hydra Mercenary (1) is what Chaos Control takes.
    const start = stackEncounterDeck(cleared, "01186", "01188", "01190", "01101");
    const threatBefore = mainThreat(start);
    const handBefore = playerOf(start, P1).hand.length;
    const discardBefore = activeEncounterDeck(start).discard.length;
    let offered = 0;
    const pick: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      const shadow = choice.options.find((o) => state.instances[o.optionId as InstanceId]?.cardId === "01190");
      if (shadow && choice.options.length === 3) {
        offered = choice.options.length;
        return [shadow.optionId];
      }
      const cc = choice.options.find((o) => o.optionId.endsWith(":15001a.chaos-control"));
      return cc ? [cc.optionId] : firstLegal(state);
    };
    const { state } = playFromHand(start, "15004", 2, pick);
    expect(offered).toBe(3);
    // Shadow of the Past resolved first, so Chaos Control counted Hydra Mercenary (1 icon) for it: remove 2 threat, no
    // draw. Then Advance (deal 2 damage) and Caught Off Guard (remove 2 threat) count as printed.
    expect(inst(state, villain).damage).toBe(2);
    expect(mainThreat(state)).toBe(threatBefore - 4);
    expect(playerOf(state, P1).hand.length).toBe(handBefore - 2); // +1 dealt, -1 played, -2 paid, no card drawn
    expect(activeEncounterDeck(state).discard.length).toBe(discardBefore + 4);
  });
});
