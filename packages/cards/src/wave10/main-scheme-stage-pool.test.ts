import { WAVE10_ENCOUNTER_SETS, type MainSchemeCard, type Scenario } from "@mc/content";
import { createGame, type GameSetupConfig, type GameState } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { mainSchemeStagesProblem, sideMainSchemeCard } from "../main-scheme-stages.js";
import { playableScenario } from "../playable/index.js";
import { randomCivilWarScenario } from "../playable/random-civil-war.js";
import { civilWarSidesOffer, playableScenarioOffer } from "../playable/scenario-options.js";
import { UNSCRIPTED_ENCOUNTER_SET_IDS } from "../playable/unscripted.js";
import { P1, endTurn, firstLegal, inst, patchInstance, stackEncounterDeck } from "../testing/harness.js";
import { driveEventsPicking } from "../testing/staging.js";
import { codeOf, piles } from "../wave9/testing.js";
import { WAVE10_CARDS } from "./cards.js";
import {
  WAVE10_GAME_ENCOUNTER_SETS,
  WAVE10_MAIN_SCHEME_STAGE_POOL,
  wave10MainSchemeCard,
  wave10Scenario,
  wave10ScenarioRecord,
} from "./setup.js";
import { CORE_SPIDER_MAN, IRON_MAN_SCENARIO, WAVE10_DEPS } from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * docs/phase7-synthezoid.md §3 M1 (owner SS1 open, built A): a Civil War leader's main scheme stages are every stage of
 * its side from either box. MC56 p. 4, step 4: "Select one of the four main scheme stage 1s from the chosen side. Each
 * stage 1 has the same side A and a different side B." MC57 p. 3 adds one stage 1 and one stage 2 per side whose A
 * sides repeat Civil War's, so each side has five of each once both boxes are playable.
 *
 * While Synthezoid Smackdown is gated (`playable/unscripted.ts`), the playable offers are Civil War's alone; reading A
 * is proven here on the ungated set list (`WAVE10_ENCOUNTER_SETS`), the list the pool reads once the gate is lifted.
 */

const SHE_HULK = "registration-she-hulk";
const VISION = "resistance-vision";
const CAPTAIN_AMERICA = "resistance-captain-america";
const SEAT = { starterDeckId: CORE_SPIDER_MAN } as const;

const REGISTRATION_1 = ["56063b", "56096b", "56121b", "56122b", "57005b"];
const REGISTRATION_2 = ["56064b", "56097b", "56123b", "56124b", "57006b"];
const RESISTANCE_1 = ["56141b", "56172b", "56199b", "56200b", "57044b"];
const RESISTANCE_2 = ["56142b", "56173b", "56201b", "56202b", "57045b"];
const civilWarOnly = (ids: readonly string[]) => ids.filter((id) => id.startsWith("56"));

/** The scenario's card under reading A with every set ungated. */
const ungated = (scenarioId: string): MainSchemeCard =>
  sideMainSchemeCard(wave10ScenarioRecord(scenarioId), WAVE10_CARDS, WAVE10_ENCOUNTER_SETS);
const byNumber = (card: MainSchemeCard) =>
  [1, 2].map((n) => card.stages.filter((s) => s.stageNumber === n).map((s) => s.printedCardId as string));
const indexOn = (card: MainSchemeCard, id: string): number =>
  card.stages.findIndex((stage) => stage.printedCardId === id);
const optionIds = (scenarioId: string) =>
  playableScenarioOffer(scenarioId).mainSchemeStages!.stages.map((stage) =>
    stage.options.map((option) => option.printedCardId),
  );
const printed = (id: string): MainSchemeCard => {
  const card = WAVE10_CARDS.find((c) => (c.id as string) === id);
  if (card?.type !== "main_scheme") throw new Error(`${id} is not a main scheme`);
  return card;
};
const stageKeyAt = (state: GameState): string | undefined => {
  const card = state.cardPool[state.mainScheme.cardId as string] as MainSchemeCard;
  return card.stages[state.mainScheme.stageIndex]?.printedCardId as string | undefined;
};

/** A Civil War game whose main scheme deck is `picks` on the ungated card: what `wave10Scenario` builds once un-gated. */
function ungatedGame(scenarioId: string, picks: readonly [string, string], seed: number): GameSetupConfig {
  const civilWarPicks = playableScenarioOffer(scenarioId).mainSchemeStages!.recommended;
  const config = wave10Scenario(scenarioId, { players: [SEAT], seed, mainSchemeStageIds: civilWarPicks });
  const card = ungated(scenarioId);
  return {
    ...config,
    cards: config.cards.map((c) => (c.id === card.id ? card : c)),
    mainSchemeStageIndexes: picks.map((id) => indexOn(card, id)),
  };
}

describe("the stage pool of a side under reading A (M1, owner SS1 open, built A), every set ungated", () => {
  it("is built under reading A", () => {
    expect(WAVE10_MAIN_SCHEME_STAGE_POOL).toBe("side");
  });

  it("holds five stage 1s and five stage 2s at every leader of a side, the same five in the same order", () => {
    for (const id of ["registration-iron-man", "registration-captain-marvel", SHE_HULK])
      expect(byNumber(ungated(id)), id).toEqual([REGISTRATION_1, REGISTRATION_2]);
    for (const id of [CAPTAIN_AMERICA, "resistance-spider-woman", VISION])
      expect(byNumber(ungated(id)), id).toEqual([RESISTANCE_1, RESISTANCE_2]);
  });

  it("gathers the stages on the scenario's own card, Civil War's at their printed indexes, the pack's after", () => {
    const ironMan = ungated(IRON_MAN_SCENARIO);
    const civilWar = printed("56063a");
    expect(ironMan.id).toBe(civilWar.id);
    expect(ironMan.stages.slice(0, civilWar.stages.length)).toEqual(civilWar.stages);
    expect(ironMan.stages.slice(civilWar.stages.length)).toEqual(printed("57005a").stages);
    const sheHulk = ungated(SHE_HULK);
    expect(sheHulk.id).toBe("57005a");
    expect(sheHulk.stages).toEqual(ironMan.stages);
    // Every stage keeps its own abilities, so a stage plays the same on whichever card it is gathered.
    expect(sheHulk.stages[0]!.aSide.abilities.map((a) => a.id)).toEqual(["56063a.setup"]);
    expect(sheHulk.stages[8]!.aSide.abilities.map((a) => a.id)).toEqual(["57005a.setup"]);
  });

  it("is only the scenario's own card under reading B", () => {
    const own = sideMainSchemeCard(wave10ScenarioRecord(SHE_HULK), WAVE10_CARDS, WAVE10_ENCOUNTER_SETS, "scenario");
    expect(own).toBe(printed("57005a"));
    expect(own.stages.map((stage) => stage.printedCardId)).toEqual(["57005b", "57006b"]);
  });

  it("leaves an unsided scenario's card alone", () => {
    const { side: _side, ...unsided } = wave10ScenarioRecord(SHE_HULK);
    expect(sideMainSchemeCard(unsided as Scenario, WAVE10_CARDS, WAVE10_ENCOUNTER_SETS)).toBe(printed("57005a"));
  });

  it("refuses a stage of the other side, from either box", () => {
    const problem = (scenarioId: string, picks: readonly string[]) =>
      mainSchemeStagesProblem(wave10ScenarioRecord(scenarioId), ungated(scenarioId), picks, {
        encounterSets: WAVE10_ENCOUNTER_SETS,
      });
    expect(problem(SHE_HULK, ["57044b", "57006b"])).toBe(
      "Protect Secret Identities is a resistance stage; She-Hulk leads the registration side (MC56 p. 4)",
    );
    expect(problem(VISION, ["56141b", "56064b"])).toBe(
      "Negative Zone Prison is a registration stage; Vision leads the resistance (MC56 p. 4)",
    );
    expect(problem(CAPTAIN_AMERICA, ["56141b", "57006b"])).toBe(
      "Mighty Avengers is a registration stage; Captain America leads the resistance (MC56 p. 4)",
    );
    expect(problem(SHE_HULK, ["56122b", "57006b"])).toBeNull();
  });

  it("names its picks by printed id, so a saved choice keeps its stages however the pool is ordered", () => {
    const picks = ["56121b", "57006b"] as const;
    const created = createGame(ungatedGame(IRON_MAN_SCENARIO, picks, 5), WAVE10_DEPS);
    if (!created.ok) throw new Error(`${created.error.code}: ${created.error.message}`);
    const card = created.state.cardPool[created.state.mainScheme.cardId as string] as MainSchemeCard;
    expect(created.state.mainScheme.stageOrder!.map((i) => card.stages[i]!.printedCardId)).toEqual(picks);
    expect(stageKeyAt(created.state)).toBe("56121b");
  });

  it("starts on Civil War's Homeland Security and advances to the pack's Mighty Avengers", () => {
    const created = createGame(ungatedGame(IRON_MAN_SCENARIO, ["56121b", "57006b"], 7), WAVE10_DEPS);
    if (!created.ok) throw new Error(`${created.error.code}: ${created.error.message}`);
    let state = driveEventsPicking(WAVE10_DEPS, created.state, firstLegal).state;
    expect(stageKeyAt(state)).toBe("56121b");
    // The leader does nothing this villain phase; the main scheme is one threat short of its target, so step 1's
    // acceleration completes the stage.
    const villain = state.activeVillainId!;
    state = patchInstance(state, villain, { statuses: { ...inst(state, villain).statuses, confused: 1, stunned: 1 } });
    state = patchInstance(state, state.mainScheme.instanceId, { threat: 6 });
    const attachments = ["56065", "56066", "56067", "56068", "56069"].filter((code) =>
      piles(state).deck.some((id) => codeOf(state, id) === code),
    );
    state = stackEncounterDeck(state, ...attachments.slice(0, 2));
    const after = driveEventsPicking(WAVE10_DEPS, state, firstLegal, endTurn(P1)).state;
    expect(after.mainScheme.cardId).toBe("56063a");
    expect(stageKeyAt(after)).toBe("57006b");
    expect(after.mainScheme.stageOrder!.indexOf(after.mainScheme.stageIndex)).toBe(1);
    expect(after.outcome).toBeNull();
  });
});

describe("while Synthezoid Smackdown is gated (playable/unscripted.ts)", () => {
  it("gates the pack's main scheme sets, so the playable side list has Civil War's cards only", () => {
    for (const id of ["synthezoid_registration", "synthezoid_resistance"]) {
      expect(UNSCRIPTED_ENCOUNTER_SET_IDS.has(id), id).toBe(true);
      expect(
        WAVE10_GAME_ENCOUNTER_SETS.some((set) => set.id === id),
        id,
      ).toBe(false);
    }
  });

  it("offers each Civil War leader Civil War's four stages of each number", () => {
    for (const id of ["registration-iron-man", "registration-captain-marvel"])
      expect(optionIds(id), id).toEqual([civilWarOnly(REGISTRATION_1), civilWarOnly(REGISTRATION_2)]);
    for (const id of [CAPTAIN_AMERICA, "resistance-spider-woman"])
      expect(optionIds(id), id).toEqual([civilWarOnly(RESISTANCE_1), civilWarOnly(RESISTANCE_2)]);
    expect(() =>
      wave10Scenario(IRON_MAN_SCENARIO, { players: [SEAT], seed: 3, mainSchemeStageIds: ["56121b", "57006b"] }),
    ).toThrow("Mighty Avengers is a stage of Superhero Registration Act (57005a)");
  });

  it("does not offer She-Hulk or Vision as a leader", () => {
    const leaders = civilWarSidesOffer().flatMap((side) => side.leaders.map((l) => l.scenarioId));
    expect(leaders).toEqual([
      "registration-iron-man",
      "registration-captain-marvel",
      CAPTAIN_AMERICA,
      "resistance-spider-woman",
    ]);
  });

  it("still holds a gated leader's own stages on its own card, after its side's playable ones", () => {
    const card = wave10MainSchemeCard(wave10ScenarioRecord(SHE_HULK));
    expect(byNumber(card)).toEqual([REGISTRATION_1, REGISTRATION_2]);
    expect(wave10Scenario(VISION, { players: [SEAT], seed: 3 }).mainSchemeStageIndexes).toEqual([8, 9]);
  });

  it("keeps a Civil War precon's stage indexes on its printed card (a game saved before the pack resumes)", () => {
    for (const [scenarioId, cardId] of [
      [IRON_MAN_SCENARIO, "56063a"],
      [CAPTAIN_AMERICA, "56141a"],
    ] as const) {
      const config = playableScenario(scenarioId, { players: [SEAT], seed: 3 });
      const card = config.cards.find((c) => c.id === config.mainSchemeCardId) as MainSchemeCard;
      expect(card.id).toBe(cardId);
      expect(card.stages).toEqual(printed(cardId).stages);
      expect(config.mainSchemeStageIndexes).toEqual([0, 1]);
      // Once un-gated, the pack's stages follow Civil War's, so the same indexes name the same stages.
      expect(ungated(scenarioId).stages.slice(0, 8)).toEqual(printed(cardId).stages);
    }
  });

  it("random creation draws Civil War's leaders and stages only, and refuses a gated pin", () => {
    const leaders = new Set<string>();
    const ones = new Set<string>();
    const twos = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const r = randomCivilWarScenario(seed);
      leaders.add(r.scenarioId);
      ones.add(r.mainSchemeStageIds[0]);
      twos.add(r.mainSchemeStageIds[1]);
    }
    expect(leaders.has(SHE_HULK) || leaders.has(VISION)).toBe(false);
    expect([...ones].sort()).toEqual(civilWarOnly([...REGISTRATION_1, ...RESISTANCE_1]).sort());
    expect([...twos].sort()).toEqual(civilWarOnly([...REGISTRATION_2, ...RESISTANCE_2]).sort());
    expect(() => randomCivilWarScenario(4, { leaderId: SHE_HULK })).toThrow("does not lead");
    expect(() => randomCivilWarScenario(4, { leaderId: IRON_MAN_SCENARIO, stage2Id: "57006b" })).toThrow(
      "Mighty Avengers is a stage of Superhero Registration Act (57005a)",
    );
  });
});
