/**
 * docs/phase7-wave8.md §3.45 (task 42): `CampaignOp` `random` with `perAttempt`.
 *
 * MC45 p. 5: "randomly select one of the available [MISSION] side schemes" during scenario setup. Owner decision §4.1
 * Q22 = B: a lost scenario that is retried runs setup again, so the mission and the Overseer are drawn again from what
 * is still available. A loss restores the campaign's RNG with the log (`retryBaseline: "nodeStart"`, MC45 p. 4), so
 * without the flag a retry repeats its draw; with it the draw is mixed with how many times the node was played.
 *
 * A standalone definition, like `repeat-on-retry.test.ts`, so nothing here perturbs `runner.test.ts`'s fixture.
 */
import { describe, expect, it } from "vitest";
import { campaignId, cardId, scenarioId, type PlayModes } from "@mc/content";
import type {
  CampaignChoiceRecord,
  CampaignDefinition,
  CampaignGameResult,
  CampaignInstruction,
  CampaignLog,
  CampaignOp,
  CampaignValue,
} from "../campaign.js";
import { mixWithAttempt } from "./ops.js";
import {
  applyCampaignResult,
  createCampaignLog,
  resolveBetweenGames,
  type CampaignDeps,
  type CampaignSeatSetup,
} from "./runner.js";

const CAMPAIGN_ID = campaignId("random-per-attempt-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID } };
const SCENARIO = scenarioId("random-per-attempt-test-scenario");
const DEPS: CampaignDeps = { pool: [] };
const SEATS: readonly CampaignSeatSetup[] = [1, 2].map((seatNumber) => ({
  seatNumber,
  identityCardId: cardId(`hero-${seatNumber}`),
  deck: { identityCardId: cardId(`hero-${seatNumber}`), aspects: [], cards: [] },
}));

const MISSIONS = ["liberate", "evacuate", "sabotage", "find"];
const OVERSEERS = ["a", "b", "c", "d", "e"];
const TOKENS = ["one", "two", "three", "four", "five", "six", "seven"];
const SEEDS = Array.from({ length: 200 }, (_, index) => index + 1);

const choice = (slot: string): CampaignValue => ({ kind: "choice", slot });
const instruction = (id: string, ops: readonly CampaignOp[]): CampaignInstruction => ({
  id,
  text: "test",
  citation: "test",
  step: { kind: "betweenGames", ops },
});
const draw = (slot: string, field: string, perAttempt: boolean, count?: number): CampaignOp => ({
  kind: "random",
  slot,
  from: { kind: "fieldOptions", field, unstruckOnly: true },
  ...(count !== undefined ? { count } : {}),
  ...(perAttempt ? { perAttempt: true as const } : {}),
});

/**
 * Each node: draw a mission and an Overseer (per attempt when `perAttempt`), then an ordinary draw after them. A win
 * strikes the mission.
 */
function definitionWith(perAttempt: boolean, pair = false): CampaignDefinition {
  const shared = (id: string, type: CampaignDefinition["logFields"][number]["type"]) => ({
    id,
    label: id,
    scope: "shared" as const,
    type,
    citation: "test",
  });
  const setup = (node: string): readonly CampaignInstruction[] => [
    instruction(`${node}.mission`, [
      draw("mission", "missions", perAttempt, pair ? 2 : undefined),
      ...(pair ? [] : [{ kind: "setField" as const, field: "currentMission", value: choice("mission") }]),
    ]),
    instruction(`${node}.overseer`, [draw("overseer", "overseers", perAttempt)]),
    instruction(`${node}.later`, [draw("token", "tokens", false)]),
  ];
  const node = (id: string) => ({
    id,
    label: id,
    scenario: { kind: "fixed" as const, scenarioId: SCENARIO },
    setup: setup(id),
    victory: pair
      ? []
      : [
          instruction(`${id}.strike`, [
            { kind: "strike", field: "missions", option: { kind: "field", field: "currentMission" } },
          ]),
        ],
  });
  return {
    campaignId: CAMPAIGN_ID,
    version: "1",
    logFields: [
      shared("missions", { kind: "strikeList", options: MISSIONS }),
      shared("overseers", { kind: "strikeList", options: OVERSEERS }),
      shared("tokens", { kind: "strikeList", options: TOKENS }),
      shared("currentMission", { kind: "choice", options: MISSIONS }),
    ],
    loss: { retry: "free", retryBaseline: "nodeStart" },
    graph: { kind: "linear", nodes: [node("first"), node("second")] },
  };
}
const FRESH = definitionWith(true);
const REPEATING = definitionWith(false);

const newLog = (definition: CampaignDefinition, seed: number): CampaignLog =>
  createCampaignLog(definition, { id: "run", seats: SEATS, modes: MODES, poolVersion: "test", seed });

function between(definition: CampaignDefinition, log: CampaignLog): CampaignLog {
  const outcome = resolveBetweenGames(definition, log, DEPS, MODES, []);
  if (outcome.kind !== "done") throw new Error("a random draw asked a question");
  return outcome.value;
}
function finish(definition: CampaignDefinition, log: CampaignLog, outcome: "won" | "lost"): CampaignLog {
  const result: CampaignGameResult = {
    nodeId: log.attempt?.nodeId ?? "",
    outcome,
    records: [],
    removedFromCampaign: [],
    logWrites: [],
    expiringGrants: [],
  };
  const applied = applyCampaignResult(definition, log, result, { at: 1_700_000_000_000 }, DEPS);
  if (applied.kind !== "done") throw new Error("unexpected pending choice after the game");
  return applied.value;
}

const traced = (log: CampaignLog, id: string): CampaignChoiceRecord => {
  const record = (log.attempt?.steps ?? []).find((step) => step.instructionId === id)?.choices[0];
  if (!record) throw new Error(`${id} traced no draw`);
  return record;
};
interface Drawn {
  readonly mission: string;
  readonly overseer: string;
  readonly token: string;
  readonly seed: number;
  readonly rngDraws: number;
}
const drawnBy = (log: CampaignLog, node = "first"): Drawn => ({
  mission: traced(log, `${node}.mission`).picked[0]!,
  overseer: traced(log, `${node}.overseer`).picked[0]!,
  token: traced(log, `${node}.later`).picked[0]!,
  seed: log.attempt!.input.seed,
  rngDraws: log.rng.draws,
});

/** A campaign whose first scenario is lost `losses` times: every attempt's draws, the last one still open. */
function play(definition: CampaignDefinition, seed: number, losses: number) {
  let log = between(definition, newLog(definition, seed));
  const attempts: Drawn[] = [drawnBy(log)];
  for (let i = 0; i < losses; i++) {
    log = between(definition, finish(definition, log, "lost"));
    attempts.push(drawnBy(log));
  }
  return { log, attempts };
}

describe("CampaignOp random.perAttempt (docs/phase7-wave8.md §3.45, Q22 = B)", () => {
  it("200 seeds, scenario 1 lost once and retried: every retry draws 1 of the 4 unstruck missions and 1 of the 5 Overseers", () => {
    for (const seed of SEEDS) {
      const { attempts } = play(FRESH, seed, 1);
      expect(MISSIONS).toContain(attempts[1]!.mission);
      expect(OVERSEERS).toContain(attempts[1]!.overseer);
    }
  });

  it("a fresh draw, not one that excludes the last: some retries differ from the first attempt and some repeat it, and every mission turns up", () => {
    const runs = SEEDS.map((seed) => play(FRESH, seed, 1).attempts);
    const sameMission = runs.filter(([first, retry]) => first!.mission === retry!.mission).length;
    const sameOverseer = runs.filter(([first, retry]) => first!.overseer === retry!.overseer).length;
    expect(sameMission).toBeGreaterThan(0);
    expect(sameMission).toBeLessThan(SEEDS.length);
    expect(sameOverseer).toBeGreaterThan(0);
    expect(sameOverseer).toBeLessThan(SEEDS.length);
    expect(new Set(runs.map(([, retry]) => retry!.mission))).toEqual(new Set(MISSIONS));
    expect(new Set(runs.map(([, retry]) => retry!.overseer))).toEqual(new Set(OVERSEERS));
    // Roughly one retry in four lands on the same mission (a fresh draw over four): well away from 0 and from all.
    expect(sameMission).toBeGreaterThan(SEEDS.length / 8);
    expect(sameMission).toBeLessThan(SEEDS.length / 2);
  });

  it("the campaign RNG advances as before: the draw after them, the RNG's position and the game's seed are those of the same campaign without the flag", () => {
    for (const seed of SEEDS) {
      const fresh = play(FRESH, seed, 2).attempts;
      const repeating = play(REPEATING, seed, 2).attempts;
      // A node's first attempt is the plain draw: no other box and no saved campaign changes.
      expect(fresh[0]).toEqual(repeating[0]);
      for (const attempt of [1, 2]) {
        expect(fresh[attempt]!.token).toBe(repeating[attempt]!.token);
        expect(fresh[attempt]!.rngDraws).toBe(repeating[attempt]!.rngDraws);
        expect(fresh[attempt]!.seed).toBe(repeating[attempt]!.seed);
      }
      // The game's own seed is fresh on a retry, as it always was: the draw mixed with the attempts before.
      expect(fresh[1]!.seed).not.toBe(fresh[0]!.seed);
    }
  });

  it("with perAttempt off (the runner's behavior before): all 200 retries repeat the first draw", () => {
    for (const seed of SEEDS) {
      const [first, retry] = play(REPEATING, seed, 1).attempts;
      expect(retry!.mission).toBe(first!.mission);
      expect(retry!.overseer).toBe(first!.overseer);
    }
  });

  it("a replay of the log reproduces both attempts' draws and both game seeds; a second loss draws a third time", () => {
    let thirdDiffers = 0;
    for (const seed of SEEDS) {
      const once = play(FRESH, seed, 2);
      const again = play(FRESH, seed, 2);
      expect(again.attempts).toEqual(once.attempts);
      expect(again.log).toEqual(once.log);
      expect(MISSIONS).toContain(once.attempts[2]!.mission);
      if (once.attempts[2]!.mission !== once.attempts[1]!.mission) thirdDiffers++;
      // The history holds every earlier attempt's trace, so the draws are read back from the log alone.
      const history = once.log.history.map(
        (entry) => entry.steps.find((step) => step.instructionId === "first.mission")?.choices[0],
      );
      expect(history.map((record) => record?.picked[0])).toEqual([
        once.attempts[0]!.mission,
        once.attempts[1]!.mission,
      ]);
      expect(history.map((record) => record?.attempt)).toEqual([1, 2]);
    }
    expect(thirdDiffers).toBeGreaterThan(0);
    expect(thirdDiffers).toBeLessThan(SEEDS.length);
  });

  it("the step is traced with its attempt number; a draw without the flag is traced as before", () => {
    const { log } = play(FRESH, 7, 2);
    expect(traced(log, "first.mission")).toEqual({
      slot: "mission",
      seatNumber: null,
      picked: [expect.any(String)],
      random: true,
      attempt: 3,
    });
    expect(traced(log, "first.overseer")).toMatchObject({ random: true, attempt: 3 });
    expect(traced(log, "first.later")).not.toHaveProperty("attempt");
    const first = between(FRESH, newLog(FRESH, 7));
    expect(traced(first, "first.mission").attempt).toBe(1);
    expect(traced(between(REPEATING, newLog(REPEATING, 7)), "first.mission")).not.toHaveProperty("attempt");
  });

  it("attempts are counted for the node being played: after a win the next node starts at attempt 1 and draws from the 3 unstruck missions", () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const lostOnce = play(FRESH, seed, 1);
      const struck = lostOnce.attempts[1]!.mission;
      const second = between(FRESH, finish(FRESH, lostOnce.log, "won"));
      expect(second.attempt?.nodeId).toBe("second");
      expect(traced(second, "second.mission").attempt).toBe(1);
      expect(drawnBy(second, "second").mission).not.toBe(struck);
      // A lost attempt struck nothing: only the won attempt's mission is gone.
      const retried = between(FRESH, finish(FRESH, second, "lost"));
      expect(traced(retried, "second.mission").attempt).toBe(2);
      expect(drawnBy(retried, "second").mission).not.toBe(struck);
    }
  });

  it("a draw of several: distinct options on every attempt, one RNG value for each as the plain draw takes", () => {
    const PAIRS = definitionWith(true, true);
    const PLAIN_PAIRS = definitionWith(false, true);
    for (const seed of SEEDS.slice(0, 50)) {
      const fresh = play(PAIRS, seed, 1);
      const picked = traced(fresh.log, "first.mission").picked;
      expect(picked).toHaveLength(2);
      expect(new Set(picked).size).toBe(2);
      expect(fresh.log.rng).toEqual(play(PLAIN_PAIRS, seed, 1).log.rng);
    }
  });

  it("mixWithAttempt: attempt 0 is the value itself, later attempts are other values, each a pure function of its inputs", () => {
    expect(mixWithAttempt(123456, 0)).toBe(123456);
    const values = [1, 2, 3].map((attempt) => mixWithAttempt(123456, attempt));
    expect(new Set([123456, ...values]).size).toBe(4);
    expect([1, 2, 3].map((attempt) => mixWithAttempt(123456, attempt))).toEqual(values);
  });
});
