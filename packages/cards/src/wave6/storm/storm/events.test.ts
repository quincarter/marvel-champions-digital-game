import { cardId } from "@mc/content";
import { activeVillain, separateDeckOf, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  answer,
  endTurn,
  firstLegal,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  settleUntil,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";
import { STORM_EVENTS } from "./events.js";
import { WEATHER_DECK } from "./identity.js";
import { stormGame } from "./support.js";

const DEPS = WAVE6_DEPS;
const CLEAR_SKIES = "36002";
const HURRICANE = "36003";
const THUNDERSTORM = "36004";
const BLIZZARD = "36005";
const WEATHER_CODES = [CLEAR_SKIES, HURRICANE, THUNDERSTORM, BLIZZARD];

/** Picks, at each choice from the WEATHER deck, the card `codes` names next; anything else as `firstLegal`. */
const weatherPicks = (...codes: readonly string[]): Picker => {
  const wanted = [...codes];
  return (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseCards") {
      const option = choice.options.find(
        (o) => o.ref.kind === "card" && state.instances[o.ref.instanceId]?.cardId === cardId(wanted[0] ?? ""),
      );
      if (option) {
        wanted.shift();
        return [option.optionId];
      }
    }
    return firstLegal(state);
  };
};

/** Storm in hero form with `code` as her WEATHER support in play. */
const stormWith = (code: string): GameState =>
  withForm(stormGame("rhino", { seed: 1, pick: weatherPicks(code) }), { heroForm: 0 });
/** The same with 10 threat on the main scheme, room to remove threat from (it changes what Rhino does, so not by default). */
const stormWithThreat = (code: string): GameState => {
  const state = stormWith(code);
  return patchInstance(state, state.mainScheme.instanceId, { threat: 10 });
};
const villainOf = (state: GameState): InstanceId => activeVillain(state).instanceId;
const weatherInPlay = (state: GameState): readonly string[] =>
  playerOf(state, P1)
    .playArea.map((id) => state.instances[id]!.cardId as string)
    .filter((code) => WEATHER_CODES.includes(code));
const one = (state: GameState, code: string): InstanceId => instancesOf(state, code)[0]!;

/** Plays `code` from hand paying its `cost` with other hand cards; `pick` answers every choice. */
const cast = (state: GameState, code: string, cost: number, pick: Picker = firstLegal) => {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0] as InstanceId;
  return {
    id,
    state: settle(
      runWith(DEPS, given.state, play(P1, id, payWith(given.state, P1, cost, [id]))),
      pick,
      undefined,
      DEPS,
    ),
  };
};
const aiming =
  (target: InstanceId, rest: Picker = firstLegal): Picker =>
  (s) => {
    const hit = s.pendingChoice?.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === target);
    return hit ? [hit.optionId] : rest(s);
  };

describe("Storm's hero-kit events (36009-36013)", () => {
  it("registers every ability ref the card data names, all valid", () => {
    expect(Object.keys(STORM_EVENTS).sort()).toEqual([
      "36009.weather-goddess-action",
      "36010.torrential-rain-action",
      "36011.lightning-bolt-action",
      "36012.flash-freeze-interrupt",
      "36013.blast-of-wind-action",
    ]);
    for (const definition of Object.values(STORM_EVENTS)) expect(validateDefinition(definition)).toEqual([]);
  });

  describe("Weather Goddess (36009)", () => {
    it("swaps the WEATHER support in play for the chosen one, shuffles the deck and resolves the new Special", () => {
      const start = stormWith(THUNDERSTORM);
      const thunderstorm = one(start, THUNDERSTORM);
      const clearSkies = one(start, CLEAR_SKIES);
      const handBefore = playerOf(start, P1).hand.length;
      const { id, state } = cast(start, "36009", 0, weatherPicks(CLEAR_SKIES));
      expect(weatherInPlay(state)).toEqual([CLEAR_SKIES]);
      expect(inst(state, clearSkies)).toMatchObject({ faceup: true, exhausted: false });
      expect(separateDeckOf(state, P1, WEATHER_DECK).deck).toContain(thunderstorm);
      expect(inst(state, thunderstorm).faceup).toBe(false);
      // The event left the hand and was discarded; Clear Skies' Special drew 1 card (and not Thunderstorm's damage).
      expect(playerOf(state, P1).discard).toContain(id);
      expect(playerOf(state, P1).hand).toHaveLength(handBefore + 1);
      expect(inst(state, villainOf(state)).damage).toBe(0);
    });

    it("has no round limit: a second copy swaps again the same round", () => {
      const first = cast(stormWith(THUNDERSTORM), "36009", 0, weatherPicks(CLEAR_SKIES)).state;
      const second = cast(first, "36009", 0, weatherPicks(HURRICANE)).state;
      expect(weatherInPlay(second)).toEqual([HURRICANE]);
    });
  });

  describe("Torrential Rain (36010)", () => {
    it("removes 3 threat from among schemes, and resolves Hurricane's Special (2 more) when Hurricane is in play", () => {
      const start = stormWithThreat(HURRICANE);
      const before = mainThreat(start);
      const { state } = cast(start, "36010", 2);
      expect(mainThreat(state)).toBe(before - 5);
    });

    it("removes only 3 when Hurricane is not in play, and is not a thwart (a Special of another WEATHER does not resolve)", () => {
      const start = stormWithThreat(CLEAR_SKIES);
      const before = mainThreat(start);
      const handBefore = playerOf(start, P1).hand.length;
      const { state } = cast(start, "36010", 2);
      expect(mainThreat(state)).toBe(before - 3);
      // 2 spent to pay (the played card was added to the hand after handBefore): Clear Skies' draw did not happen.
      expect(playerOf(state, P1).hand).toHaveLength(handBefore - 2);
    });
  });

  describe("Lightning Bolt (36011)", () => {
    it("deals 8 damage to the chosen enemy, plus Thunderstorm's Special (2 more to an enemy) when in play", () => {
      const start = stormWith(THUNDERSTORM);
      const { state } = cast(start, "36011", 3, aiming(villainOf(start)));
      expect(inst(state, villainOf(state)).damage).toBe(10);
    });

    it("deals only 8 when Thunderstorm is not in play, and is not an attack: a guarding or retaliating enemy does not hit back", () => {
      const { state: withMinion, id: minion } = engageMinion(stormWith(CLEAR_SKIES), "01101", P1);
      const { state } = cast(withMinion, "36011", 3, aiming(villainOf(withMinion)));
      expect(inst(state, villainOf(state)).damage).toBe(8);
      expect(inst(state, minion).damage).toBe(0);
    });
  });

  describe("Blast of Wind (36013)", () => {
    it("deals 3 damage to the villain and each minion engaged with the chosen player, then resolves your WEATHER Special", () => {
      const { state: withMinion, id: minion } = engageMinion(stormWith(CLEAR_SKIES), "01101", P1);
      const handBefore = playerOf(withMinion, P1).hand.length;
      const { state } = cast(withMinion, "36013", 3);
      expect(inst(state, villainOf(state)).damage).toBe(3);
      // The Hydra Mercenary has 2 hit points, so the 3 damage defeats it.
      expect(playerOf(state, P1).playArea).not.toContain(minion);
      // 3 spent to pay, then Clear Skies' Special drew 1.
      expect(playerOf(state, P1).hand).toHaveLength(handBefore - 2);
    });
  });

  describe("Flash Freeze (36012)", () => {
    const damageOf = (state: GameState) => inst(state, playerOf(state, P1).identity.instanceId).damage;
    /** Ends the turn; the villain attacks Storm and the interrupt is offered: plays it (paying with the first card). */
    const freezeThenSettle = (start: GameState, until: "end" | "declareDefender" = "end"): GameState => {
      const given = moveToHand(start, P1, "36012");
      const offered = settleUntil(runWith(DEPS, given.state, endTurn()), "chooseTriggers", firstLegal, DEPS);
      const chose = answer(
        offered,
        [offered.pendingChoice!.options.find((o) => o.optionId.includes("36012.flash-freeze-interrupt"))!.optionId],
        DEPS,
      );
      const paid = answer(chose, [chose.pendingChoice!.options[0]!.optionId], DEPS);
      return until === "end" ? settle(paid, firstLegal, undefined, DEPS) : settleUntil(paid, until, firstLegal, DEPS);
    };

    it("is offered when the villain attacks Storm and takes 3 off the damage she suffers from that attack", () => {
      const start = stormWith(THUNDERSTORM);
      const without = settle(runWith(DEPS, start, endTurn()), firstLegal, undefined, DEPS);
      expect(damageOf(without)).toBeGreaterThan(0);
      const frozen = freezeThenSettle(start);
      // Rhino's attack deals ATK + boost; -3 ATK floors the total at 0 here (a stat cannot go below 0).
      expect(damageOf(frozen)).toBe(Math.max(0, damageOf(without) - 3));
    });

    it("Blizzard in play: its Special resolves too, blanking a non-ELITE minion's text box", () => {
      const { state: withMinion, id: minion } = engageMinion(stormWith(BLIZZARD), "01101", P1);
      // Stopped at the defender choice: the round's end would already have ended the blank.
      const frozen = freezeThenSettle(withMinion, "declareDefender");
      expect(frozen.lastingEffects.filter((l) => l.kind === "blankTextBox")).toEqual([
        expect.objectContaining({ kind: "blankTextBox", targets: [minion], duration: { kind: "endOfRound" } }),
      ]);
    });
  });
});
