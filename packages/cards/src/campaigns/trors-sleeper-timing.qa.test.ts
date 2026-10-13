/**
 * QA of the reporter's randomness point for The Sleeper Awakened (04140, issue #130): "on turns 3-4 in 18 of 20 games".
 * Measured in the REAL campaign flow as a player meets it: the Red Skull node (5th scenario) composed by the campaign
 * runner (`resolveBetweenGames` + `startGameFromLog`), the same `createGame` setup the client launches, standard
 * difficulty, no easier start. Each campaign gets its own seed exactly as the client rolls it (`rollSeed()`, 0..99999).
 *
 * The side-scheme deck is revealed one card per villain phase (New World Hydra / The Rise of Red Skull), so the index
 * of 04140 in the freshly set-up deck + 1 is the round it appears.
 */
import { describe, expect, it } from "vitest";
import { TRORS_STARTER_DECKS, WAVE2_CARDS, type PlayModes } from "@mc/content";
import {
  applyCampaignResult,
  campaignChoiceKey,
  createCampaignLog,
  createGame,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignChoiceAnswer,
  type CampaignDeps,
  type CampaignGameResult,
  type CampaignLog,
  type CampaignRunnerResult,
  type CampaignSeatSetup,
} from "@mc/engine";
import { cardsInPlay } from "@mc/engine";
import { endTurn, firstLegal, instancesOf, settle as settleChoices } from "../testing/harness.js";
import { runWave2, startWave2Game } from "../wave2/testing.js";
import { wave2Scenario, WAVE2_DEPS } from "../wave2/index.js";
import { TRORS_CAMPAIGN_DEFINITION } from "./trors.js";

const DEPS: CampaignDeps = { pool: WAVE2_CARDS };
const STANDARD: PlayModes = { campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId } };

const seatFor = (id: string, seatNumber: number): CampaignSeatSetup => {
  const s = TRORS_STARTER_DECKS.find((d) => (d.id as string) === id)!;
  return {
    seatNumber,
    identityCardId: s.identityCardId,
    deck: { identityCardId: s.identityCardId, aspects: s.aspects, cards: s.cards },
  };
};
const SEATS = [seatFor("hawkeye-leadership", 1)];

const answer = (instructionId: string, slot: string, seatNumber: number, picked: readonly string[]) =>
  ({ instructionId, slot, seatNumber, picked }) as CampaignChoiceAnswer;
const SCRIPT: readonly CampaignChoiceAnswer[] = [
  answer("mc10.s1.victory.tech", "tech", 1, ["04155"]),
  answer("mc10.s2.victory.basic", "basic", 1, ["04159a"]),
  ...["s2", "s3", "s4", "s5"].map((s) => answer(`mc10.${s}.setup.obligation`, "obligation", 1, ["accept"])),
  answer("mc10.s4.victory.improved", "improve", 1, ["04159a"]),
];

function settle<T>(step: (a: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>): T {
  const answers: CampaignChoiceAnswer[] = [];
  for (let g = 0; g < 24; g++) {
    const out = step(answers);
    if (out.kind === "done") return out.value;
    const found = SCRIPT.find((e) => campaignChoiceKey(e) === campaignChoiceKey(out.choice));
    answers.push(found ?? ({ ...out.choice, picked: [out.choice.options[0]] } as unknown as CampaignChoiceAnswer));
  }
  throw new Error("too many choices");
}

const RECORDS: Record<string, CampaignGameResult["records"]> = {};

function toRedSkullNode(seed: number): CampaignLog {
  let log = createCampaignLog(TRORS_CAMPAIGN_DEFINITION, {
    id: `t-${seed}`,
    seats: SEATS,
    modes: STANDARD,
    poolVersion: "qa",
    seed,
  });
  for (let guard = 0; guard < 4; guard++) {
    const nodeId = log.position.nextNodeId as string;
    const composed = settle((a) => resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, log, DEPS, STANDARD, a));
    const result: CampaignGameResult = {
      nodeId,
      outcome: "won",
      records: RECORDS[nodeId] ?? [],
      removedFromCampaign: [],
      logWrites: [],
      expiringGrants: [],
    };
    log = settle((a) =>
      applyCampaignResult(TRORS_CAMPAIGN_DEFINITION, composed, result, { at: 1, gameId: `g-${nodeId}` }, DEPS, a),
    );
  }
  return log;
}

function sleeperIndex(campaignSeed: number): { index: number; size: number } {
  const log = toRedSkullNode(campaignSeed);
  const composed = settle((a) => resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, log, DEPS, STANDARD, a));
  const start = startGameFromLog(TRORS_CAMPAIGN_DEFINITION, composed);
  if (start.scenarioId !== "red-skull") throw new Error(`expected the Red Skull node, got ${start.scenarioId}`);
  const config = wave2Scenario(start.scenarioId, {
    players: SEATS.map(() => ({ starterDeckId: "hawkeye-leadership" })),
    seed: start.input.seed,
    modes: start.modes,
  });
  const created = createGame({ ...config, campaign: start.input }, WAVE2_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  // Setup may pause on choices; the deck is built during setup, so read it from the created state after settling.
  let state = created.state;
  const deck = state.scenarioDecks["side-scheme deck"];
  if (!deck) throw new Error("no side-scheme deck at setup");
  const index = deck.deck.findIndex((id) => state.instances[id]?.cardId === "04140");
  return { index, size: deck.deck.length };
}

describe("The Sleeper Awakened's arrival round in the real campaign flow", () => {
  it("varies with the campaign seed: not concentrated on rounds 3-4", () => {
    const seeds = Array.from({ length: 150 }, (_, i) => 1000 + i * 613);
    const rounds = seeds.map((s) => sleeperIndex(s));
    const size = rounds[0]!.size;
    const histogram = new Map<number, number>();
    for (const r of rounds) histogram.set(r.index + 1, (histogram.get(r.index + 1) ?? 0) + 1);
    console.log(
      "side-scheme deck size",
      size,
      "round histogram",
      JSON.stringify([...histogram.entries()].sort((a, b) => a[0] - b[0])),
    );
    const threeFour = (histogram.get(3) ?? 0) + (histogram.get(4) ?? 0);
    expect(rounds.every((r) => r.index >= 0)).toBe(true);
    expect(threeFour / rounds.length).toBeLessThan(0.6);
  });
});

/** Standalone (non-campaign) setup, as the Scenarios screen launches it with `rollSeed()`'s range of seeds. */
function standaloneIndex(seed: number): number {
  const config = wave2Scenario("red-skull", { players: [{ starterDeckId: "hawkeye-leadership" }], seed });
  const created = createGame(config, WAVE2_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const deck = created.state.scenarioDecks["side-scheme deck"]!;
  return deck.deck.findIndex((id) => created.state.instances[id]?.cardId === "04140");
}

describe("The Sleeper Awakened's arrival round: seeds as the client rolls them (0..99999)", () => {
  /** A small deterministic spread of seeds over the client's range, and consecutive ones (worst case for a weak PRNG). */
  const spread = Array.from({ length: 300 }, (_, i) => (i * 7919 + 13) % 100000);
  const consecutive = Array.from({ length: 300 }, (_, i) => i);

  it.each([
    ["spread seeds, standalone", spread],
    ["consecutive seeds 0..299, standalone", consecutive],
  ])("%s: every arrival round 1..6 occurs and none exceeds a third of games", (_label, seeds) => {
    const counts = Array.from({ length: 6 }, () => 0);
    for (const s of seeds) counts[standaloneIndex(s)]! += 1;
    console.log(_label, JSON.stringify(counts));
    for (const c of counts) {
      expect(c).toBeGreaterThan(seeds.length / 6 / 2);
      expect(c).toBeLessThan(seeds.length / 3);
    }
  });

  it("campaign seeds spread over the client's range also give every round 1..6", () => {
    const counts = Array.from({ length: 6 }, () => 0);
    for (let i = 0; i < 120; i++) counts[sleeperIndex((i * 7919 + 13) % 100000).index]! += 1;
    console.log("campaign node 5, spread campaign seeds", JSON.stringify(counts));
    for (const c of counts) expect(c).toBeGreaterThanOrEqual(6);
  });
});

describe("The Sleeper Awakened's arrival round in an actually played standalone game", () => {
  it("the round it enters play is never later than its deck position + 1", () => {
    for (const seed of [3, 11, 29, 57, 101, 202, 4040, 77777]) {
      let state = startWave2Game(
        wave2Scenario("red-skull", { players: [{ starterDeckId: "hawkeye-leadership" }], seed }),
      );
      const expected = standaloneIndex(seed) + 1;
      let arrived = 0;
      for (let round = 1; round <= 7 && !arrived && !state.outcome; round++) {
        state = settleChoices(
          runWave2(state, endTurn()),
          firstLegal,
          (s) => s.step.phase === "player" && s.step.kind === "turn",
          WAVE2_DEPS,
        );
        if (instancesOf(state, "04140").some((id) => cardsInPlay(state).includes(id))) arrived = round;
      }
      if (state.outcome) continue; // the hero lost before it arrived; nothing to compare
      console.log("seed", seed, "deck position+1", expected, "arrived round", arrived);
      expect(arrived).toBeLessThanOrEqual(expected);
    }
  });
});
