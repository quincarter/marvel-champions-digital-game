import { activeVillain, characterProfile, generatedResources, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  playerOf,
  runWith,
  settle,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { WAVE4_DEPS } from "../index.js";
import { playFromHand, startWave4Game } from "../testing.js";
import { spectrumScenario } from "./support.js";

const spectrumVsRhino = (seed = 1) => startWave4Game(spectrumScenario("rhino", { seed }));

/** Accepts an offered choice whose optionId names one of `wanted` (an instance id or option label fragment), else
 * falls back to `firstLegal`. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options.map((o) => o.optionId).filter((id) => wanted.some((w) => id.includes(w)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

describe("Spectrum / Monica Rambeau (21001a/b)", () => {
  it("Setup (21001b.setup): all 3 energy form upgrades enter play facedown", () => {
    const state = spectrumVsRhino(1);
    const forms = [...instancesOf(state, "21002"), ...instancesOf(state, "21003"), ...instancesOf(state, "21004")];
    expect(forms).toHaveLength(3);
    for (const id of forms) expect(inst(state, id).faceup).toBe(false);
  });

  it("Energy Transformation (21001a.spectrum-constant): changing to hero form flips a chosen facedown form faceup", () => {
    const state = spectrumVsRhino(2);
    const gamma = instancesOf(state, "21002")[0]!;
    const after = settle(runWith(WAVE4_DEPS, state, toHero()), accepting(gamma), undefined, WAVE4_DEPS);
    expect(inst(after, gamma).faceup).toBe(true);
  });

  it("Power Down (21001b.monica-rambeau-constant): changing back to alter-ego turns every energy form facedown again", () => {
    const state = spectrumVsRhino(3);
    const gamma = instancesOf(state, "21002")[0]!;
    const hero = settle(runWith(WAVE4_DEPS, state, toHero()), accepting(gamma), undefined, WAVE4_DEPS);
    expect(inst(hero, gamma).faceup).toBe(true);
    // The once-per-round form change is spent, so flip back next round.
    const nextRound = settle(runWith(WAVE4_DEPS, hero, endTurn()), firstLegal, undefined, WAVE4_DEPS);
    const alterEgo = settle(runWith(WAVE4_DEPS, nextRound, toHero()), firstLegal, undefined, WAVE4_DEPS);
    expect(playerOf(alterEgo, P1).identity.form).toBe("alterEgo");
    expect(inst(alterEgo, gamma).faceup).toBe(false);
  });
});

describe("Gamma / Photon / Pulsar (21002–21004)", () => {
  it("Gamma (21002.gamma-constant, 21002.gamma-response): +2 ATK while faceup; deals 1 damage on change", () => {
    const state = spectrumVsRhino(4);
    const identity = identityOf(state, P1);
    const gamma = instancesOf(state, "21002")[0]!;
    const villain = activeVillain(state).instanceId;
    const villainBefore = inst(state, villain).damage;
    const after = settle(runWith(WAVE4_DEPS, state, toHero()), accepting(gamma, villain), undefined, WAVE4_DEPS);
    // Spectrum prints ATK 1; Gamma is +2 while faceup.
    expect(characterProfile(after, identity, WAVE4_DEPS)!.atk).toBe(3);
    expect(inst(after, villain).damage).toBe(villainBefore + 1);
  });

  it("Photon (21003.photon-constant, 21003.photon-response): +2 THW while faceup; removes 1 threat on change", () => {
    const state = spectrumVsRhino(5);
    const identity = identityOf(state, P1);
    const photon = instancesOf(state, "21003")[0]!;
    const mainSchemeId = state.mainScheme.instanceId;
    const threatBefore = inst(state, mainSchemeId).threat;
    const after = settle(runWith(WAVE4_DEPS, state, toHero()), accepting(photon), undefined, WAVE4_DEPS);
    expect(characterProfile(after, identity, WAVE4_DEPS)!.thw).toBe(3);
    expect(inst(after, mainSchemeId).threat).toBe(Math.max(0, threatBefore - 1));
  });

  it("Pulsar (21004.pulsar-constant, 21004.pulsar-response): +2 DEF while faceup; heals 1 damage on change", () => {
    const state = spectrumVsRhino(6);
    const identity = identityOf(state, P1);
    const damaged: GameState = {
      ...state,
      instances: { ...state.instances, [identity]: { ...inst(state, identity), damage: 2 } },
    };
    const pulsar = instancesOf(damaged, "21004")[0]!;
    const after = settle(runWith(WAVE4_DEPS, damaged, toHero()), accepting(pulsar), undefined, WAVE4_DEPS);
    expect(characterProfile(after, identity, WAVE4_DEPS)!.def).toBe(3);
    expect(inst(after, identity).damage).toBe(1);
  });
});

describe("Blue Marvel (21005)", () => {
  it("21005.blue-marvel-response: entering play changes energy forms", () => {
    const state = spectrumVsRhino(7);
    const gamma = instancesOf(state, "21002")[0]!;
    const photon = instancesOf(state, "21003")[0]!;
    const hero0 = settle(runWith(WAVE4_DEPS, state, toHero()), accepting(gamma), undefined, WAVE4_DEPS);
    expect(inst(hero0, gamma).faceup).toBe(true);
    const { state: after } = playFromHand(hero0, "21005", 3, accepting(photon, "21005.blue-marvel-response"));
    expect(inst(after, photon).faceup).toBe(true);
    expect(inst(after, gamma).faceup).toBe(false);
  });
});

describe("Gamma Blast / Photon Speed / Speed of Light (21007, 21008, 21010)", () => {
  it("21007.gamma-blast-action: deals 7 damage and changes to Gamma form", () => {
    const hero = settle(runWith(WAVE4_DEPS, spectrumVsRhino(8), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const villain = activeVillain(hero).instanceId;
    const before = inst(hero, villain).damage;
    const { state } = playFromHand(hero, "21007", 3, accepting(villain));
    expect(inst(state, villain).damage).toBeGreaterThanOrEqual(before + 7);
    expect(inst(state, instancesOf(state, "21002")[0]!).faceup).toBe(true);
  });

  it("21008.photon-speed-action: removes 4 threat and changes to Photon form", () => {
    const hero = settle(runWith(WAVE4_DEPS, spectrumVsRhino(9), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const mainSchemeId = hero.mainScheme.instanceId;
    const before = inst(hero, mainSchemeId).threat;
    const { state: after } = playFromHand(hero, "21008", 2, accepting(mainSchemeId));
    expect(inst(after, mainSchemeId).threat).toBe(Math.max(0, before - 4));
    expect(inst(after, instancesOf(after, "21003")[0]!).faceup).toBe(true);
  });

  it("21010.speed-of-light-action: changes energy forms and draws 1 card", () => {
    const hero = settle(runWith(WAVE4_DEPS, spectrumVsRhino(10), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const before = playerOf(hero, P1).hand.length;
    const facedown = instancesOf(hero, "21003")[0]!;
    const { state: after } = playFromHand(hero, "21010", 0, accepting(facedown));
    // -1 playing the card itself, +1 the draw = net 0.
    expect(playerOf(after, P1).hand.length).toBe(before - 1 + 1);
  });
});

describe("Energy Duplication (upgrade, 21006)", () => {
  it("21006.energy-duplication-resource: generates the printed resource of the faceup energy form", () => {
    const state = spectrumVsRhino(4);
    const gamma = instancesOf(state, "21002")[0]!;
    const hero = settle(runWith(WAVE4_DEPS, state, toHero()), accepting(gamma), undefined, WAVE4_DEPS);
    const { state: withDup, id: dup } = playFromHand(hero, "21006", 2);
    const generates = WAVE4_DEPS.abilities["21006.energy-duplication-resource"]!.generates;
    const from = { deps: WAVE4_DEPS, sourceId: dup, playerId: P1 };
    // Gamma prints a [physical] resource.
    expect(generatedResources(withDup, generates, null, from)).toEqual(
      expect.objectContaining({ physical: 1, energy: 0, mental: 0, wild: 0 }),
    );
    // With every form facedown there is no faceup form, so nothing.
    const facedown: GameState = {
      ...withDup,
      instances: {
        ...withDup.instances,
        [gamma]: { ...withDup.instances[gamma]!, faceup: false, facedownAs: { kind: "blank", traits: [] } },
      },
    };
    expect(generatedResources(facedown, generates, null, from).physical).toBe(0);
  });
});
