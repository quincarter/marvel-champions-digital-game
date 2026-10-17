/**
 * Rules audit chunk 32 (FFG rulings Jan 31 - Apr 17, 2025, post-RRG 1.6). Audit proofs only: each `it.fails`
 * marks a place the engine does something the rulings forbid, and flips to a failure when it is fixed.
 */
import { cardsInPlay, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  inst,
  instancesOf,
  P1,
  runWith,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../testing/harness.js";
import { withForm } from "../testing/staging.js";
import { ASPECT_DEPS as DEPS, aspectGame, placed } from "../wave9/aos/aspect-basic.testing.js";
import { WAVE4_DEPS } from "../wave4/index.js";
import { runWave4, startWave4Game } from "../wave4/testing.js";
import { spectrumScenario } from "../wave4/mts/support.js";

describe("audit 32.38: Restrained (21083) with only an alter-ego in play (Ruling 69.42, Apr 17, 2025)", () => {
  // "Since Alter-Egos do not have an ATK value, they are not valid targets for Restrained. Restrained would not attach
  // to anything if there was only an Alter-Ego in play."
  it.fails("a solo alter-ego with no allies gets no Restrained attached", () => {
    const start: GameState = startWave4Game(spectrumScenario("ebony-maw", { seed: 3 })); // alter-ego by default
    const staged = stackEncounterDeck(start, "01186", "21083", "01186");
    const already = new Set(cardsInPlay(staged));
    const revealed = settle(runWave4(staged, endTurn(P1)), firstLegal, undefined, WAVE4_DEPS);
    const id = instancesOf(revealed, "21083").find((c) => cardsInPlay(revealed).includes(c) && !already.has(c)) as
      | InstanceId
      | undefined;
    // Actual: Restrained is in play attached to the alter-ego identity (verified: attachedTo is the identity).
    expect(id === undefined || inst(revealed, id).attachedTo === null).toBe(true);
  });
});

describe("audit 32.13: Melinda May defending (Ruling 69.17, Mar 16, 2025)", () => {
  // "allies don't have a DEF stat, they aren't considered to 'use a basic power' when they defend attacks."
  it.fails("an ally defending an attack is not a basic power: Melinda May's response is not offered", () => {
    const base = withForm(aspectGame(), { heroForm: 0 });
    const may = placed(base, "50023");
    const offered: string[] = [];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "declareDefender") return [may.id];
      if (choice.prompt.kind === "chooseTriggers")
        offered.push(...choice.options.map((o) => o.optionId as string).filter((o) => o.includes("melinda-may")));
      return firstLegal(s);
    };
    settle(runWith(DEPS, stackEncounterDeck(may.state, "01186", "01186"), endTurn(P1)), pick, undefined, DEPS);
    // Actual: `announceBasicDefense` announces `basicPowerUsed` (power defense) for any defender, ally included.
    expect(offered).toEqual([]);
  });
});
