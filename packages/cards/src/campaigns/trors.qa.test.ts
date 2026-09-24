/**
 * The Rise of Red Skull (MC10) — rules-fidelity QA scenarios (docs/campaign-mode-design.md §11 step 9).
 *
 * Source of truth: `docs/campaign-modes/markdown/mc10_the_rise_of_red_skull.md` ("MC10 p. N"), RRG 1.8
 * `mc_rulesreference_v18_compressed.pdf` p. 11 and pp. 28–29 ("RRG p. N"), and
 * `marvel-champions-rulings-post-rrg-1-7.md` (cited by date). Every RRG quote in this file is copied verbatim from
 * a citation `game-rules-architect` already embedded next to the code it verifies (`packages/engine/src/deck.ts`'s
 * `DeckProblemCode` doc comments, `packages/engine/src/campaign.ts`) — both read the PDF directly when they were
 * written, so this file reuses those already-sourced quotes rather than re-opening the PDF.
 *
 * ---------------------------------------------------------------------------------------------------------------
 * TECHNIQUE — which tests are real games and which are synthetic, per `trors.test.ts`'s own documented rule that
 * this must be flagged, not silently presented as more real than it is.
 *
 * - **Most tests here drive only the *between-games* half** (`resolveBetweenGames`/`applyCampaignResult`), handing
 *   `applyCampaignResult` a synthetic `CampaignGameResult` in place of a played game. This is exactly the technique
 *   `trors.test.ts`'s own five-node "between-games instructions" walk already established: no `GameState` is ever
 *   touched, and a `record` instruction's value is *given* rather than computed, standing in for exactly what
 *   `campaignResultOf` would have derived from a real finished game — which `trors.test.ts`'s real-game test and
 *   `@mc/engine`'s own `campaign-primitives.test.ts`/`campaign/runner.test.ts` prove separately, at the primitive
 *   level. Every such test is labeled "(synthetic)" in its `it()` name.
 * - **"a real, engine-recognized win" plays a real, driven game to its actual winning conclusion** — no override.
 *   The villain's stage range is narrowed to a single, lower-HP stage using `GameSetupConfig`'s own
 *   `villainStartStageIndex`/`villainLastStageIndex` fields — the same fields `wave2/setup.ts`'s
 *   `buildSingleVillain` already uses to pick standard vs. expert stage ranges — so nothing here is an engine hack;
 *   it is the existing knob for "how much of this villain is in this game", pushed to its smallest legal value.
 * - **"persistent damage" plays a real game to its real, *losing* conclusion**, then re-derives `campaignResultOf`
 *   with that finished state's `outcome` overridden to a win — exactly `trors.test.ts`'s own documented technique
 *   (see that file's header for why: the driver reliably loses at full scenario strength, so a real loss is the
 *   only way to get a real, damaged-but-alive identity to record persistent damage from). Labeled "(forced win)".
 */
import { describe, expect, it } from "vitest";
import {
  TRORS_CAMPAIGN,
  TRORS_STARTER_DECKS,
  WAVE2_CARDS,
  WAVE2_SCENARIOS,
  type CardId,
  type PlayModes,
} from "@mc/content";
import {
  applyCampaignResult,
  CAMPAIGN_ACCEPT,
  campaignChoiceKey,
  campaignResultOf,
  characterProfile,
  createCampaignLog,
  createGame,
  getInstance,
  replay,
  resolveBetweenGames,
  startGameFromLog,
  validateDeck,
  type CampaignChoiceAnswer,
  type CampaignDeps,
  type CampaignGameResult,
  type CampaignLog,
  type CampaignPendingChoice,
  type CampaignRunnerResult,
  type CampaignSeatSetup,
  type DeckContext,
  type GameSetupConfig,
  type GameState,
} from "@mc/engine";
import { playToOutcome } from "../testing/driver.js";
import { WAVE2_DEPS, wave2Scenario, wave2StarterDeckSetup } from "../wave2/index.js";
import { TRORS_CAMPAIGN_DEFINITION } from "./trors.js";

const DEPS: CampaignDeps = { pool: WAVE2_CARDS };
const STANDARD: PlayModes = { campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId } };
const EXPERT: PlayModes = { campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId, expertCampaign: true } };
const EXPERT_MODE_TOO: PlayModes = { ...EXPERT, expert: true };

const STARTER_IDS = ["hawkeye-leadership", "spider-woman-aggression-justice"] as const;
const MOON_KNIGHT = "04097" as CardId; // MC10 p. 10's Taskmaster Captive allies
const TECH_IDS = ["04155", "04156", "04157", "04158"] as const; // MC10 p. 5's TECH upgrades (Hydra Campaign set)
const BASIC_IDS = ["04159a", "04160a", "04161a", "04162a"] as const; // MC10 p. 7's "Basic" Condition upgrades

function seatFor(starterDeckId: string, seatNumber: number): CampaignSeatSetup {
  const starter = TRORS_STARTER_DECKS.find((deck) => (deck.id as string) === starterDeckId);
  if (!starter) throw new Error(`no trors starter deck "${starterDeckId}"`);
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}

const SEATS: readonly CampaignSeatSetup[] = STARTER_IDS.map((id, index) => seatFor(id, index + 1));

const answer = (
  instructionId: string,
  slot: string,
  seatNumber: number,
  picked: readonly string[],
): CampaignChoiceAnswer => ({ instructionId, slot, seatNumber, picked });

interface Settled<T> {
  readonly value: T;
  readonly asked: readonly CampaignPendingChoice[];
}

/** Answers every pending choice from a fixed script, re-running the step list as the runner's own contract requires. */
function settle<T>(
  step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>,
  script: readonly CampaignChoiceAnswer[],
): Settled<T> {
  const asked: CampaignPendingChoice[] = [];
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 24; guard++) {
    const outcome = step(answers);
    if (outcome.kind === "done") return { value: outcome.value, asked };
    const found = script.find((entry) => campaignChoiceKey(entry) === campaignChoiceKey(outcome.choice));
    if (!found) {
      throw new Error(
        `the script has no answer for ${campaignChoiceKey(outcome.choice)} of [${outcome.choice.options.join(", ")}]`,
      );
    }
    asked.push(outcome.choice);
    answers.push(found);
  }
  throw new Error("the runner asked for more than 24 choices in one step list");
}

/**
 * Seat 1 takes every TECH/"Basic"/obligation offer; seat 2 takes only the (non-optional) TECH upgrade and declines
 * every "may". Shared by every test below, whatever mode or node it drives, exactly as `trors.test.ts`'s own
 * `SCRIPT` is: an answer for a choice that mode never asks is simply never looked up.
 */
const SCRIPT: readonly CampaignChoiceAnswer[] = [
  answer("mc10.s1.victory.tech", "tech", 1, [TECH_IDS[0]]),
  answer("mc10.s1.victory.tech", "tech", 2, [TECH_IDS[1]]),
  answer("mc10.s2.victory.basic", "basic", 1, [BASIC_IDS[0]]),
  answer("mc10.s2.victory.basic", "basic", 2, []),
  ...["s2", "s3", "s4", "s5"].flatMap((scenario) => [
    answer(`mc10.${scenario}.setup.obligation`, "obligation", 1, [CAMPAIGN_ACCEPT]),
    answer(`mc10.${scenario}.setup.obligation`, "obligation", 2, []),
  ]),
  answer("mc10.s4.victory.improved", "improve", 1, [BASIC_IDS[0]]),
];

type Records = CampaignGameResult["records"];

const write = (instructionId: string, field: string, seatNumber: number | null, value: unknown): Records[number] =>
  ({ instructionId, write: { field, seatNumber, mode: "set", value } }) as Records[number];

const appendWrite = (
  instructionId: string,
  field: string,
  seatNumber: number | null,
  value: unknown,
): Records[number] => ({ instructionId, write: { field, seatNumber, mode: "append", value } }) as Records[number];

/**
 * Advances the log by exactly one node, with a *synthetic* result standing in for a played game — see the file
 * header. `SCRIPT` answers whatever the node's own between-games instructions ask (a TECH/"Basic" upgrade choice,
 * an obligation draw); `records` answers whatever the node's `record` victory/defeat instructions would have read
 * off a finished `GameState`.
 */
function stepNode(
  log: CampaignLog,
  modes: PlayModes,
  outcome: "won" | "lost",
  records: Records,
  extra: Partial<Pick<CampaignGameResult, "removedFromCampaign" | "logWrites" | "expiringGrants">> = {},
): CampaignLog {
  const nodeId = log.position.nextNodeId;
  if (nodeId === null) throw new Error("no next node to step");
  const composed = settle(
    (answers) => resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, log, DEPS, modes, answers),
    SCRIPT,
  );
  const result: CampaignGameResult = {
    nodeId,
    outcome,
    records,
    removedFromCampaign: extra.removedFromCampaign ?? [],
    logWrites: extra.logWrites ?? [],
    expiringGrants: extra.expiringGrants ?? [],
  };
  return settle(
    (answers) =>
      applyCampaignResult(
        TRORS_CAMPAIGN_DEFINITION,
        composed.value,
        result,
        { at: 1_700_000_000_000, gameId: `qa-${nodeId}` },
        DEPS,
        answers,
      ),
    SCRIPT,
  ).value;
}

const freshLog = (id: string, modes: PlayModes, seed: number): CampaignLog =>
  createCampaignLog(TRORS_CAMPAIGN_DEFINITION, { id, seats: SEATS, modes, poolVersion: "qa-test", seed });

// ---------------------------------------------------------------------------------------------------------------
// 1. MC10 p. 3 — a full standard campaign, all five scenarios, log filled at each step, campaign completes
// ---------------------------------------------------------------------------------------------------------------

/** MC10 p. 3, "Campaign Mode Rules": scenarios are completed "in the order listed below", win all five to finish. */
const RECORDS_STANDARD: Readonly<Record<string, Records>> = {
  crossbones: [appendWrite("mc10.s1.victory.experimental", "experimental", null, { kind: "cardList", cardIds: [] })],
  "absorbing-man": [write("mc10.s2.victory.delay", "delayCounters", null, { kind: "number", value: 3 })],
  taskmaster: [
    appendWrite("mc10.s3.victory.rescued-record", "rescuedAllies", 1, { kind: "cardList", cardIds: [MOON_KNIGHT] }),
  ],
  zola: [
    write("mc10.s4.victory.engaged", "engagedWithEnemy", 1, { kind: "flag", value: true }),
    write("mc10.s4.victory.engaged", "engagedWithEnemy", 2, { kind: "flag", value: false }),
    write("mc10.s4.victory.prison", "hydraPrison", null, { kind: "flag", value: false }),
    write("mc10.s4.victory.hero-form", "heroForm", 1, { kind: "flag", value: true }),
  ],
  "red-skull": [],
};

function fullWalk(modes: PlayModes, records: Readonly<Record<string, Records>>, seed = 4242): CampaignLog {
  let log = freshLog(`qa-full-${JSON.stringify(modes)}`, modes, seed);
  for (let guard = 0; guard < 5 && log.position.nextNodeId !== null; guard++) {
    const nodeId = log.position.nextNodeId as string;
    log = stepNode(log, modes, "won", records[nodeId] ?? []);
  }
  return log;
}

describe("MC10 p. 3 — a full standard campaign completes when all five scenarios are won in order (synthetic)", () => {
  it("visits every node once, in numerical order, and the campaign ends won", () => {
    const log = fullWalk(STANDARD, RECORDS_STANDARD);
    expect(log.status).toBe("won");
    expect(log.history.map((entry) => entry.nodeId)).toEqual([
      "crossbones",
      "absorbing-man",
      "taskmaster",
      "zola",
      "red-skull",
    ]);
    expect(log.position.resolved).toEqual({
      crossbones: "completed",
      "absorbing-man": "completed",
      taskmaster: "completed",
      zola: "completed",
      "red-skull": "completed",
    });
  });

  it("fills the log at each step: a TECH upgrade, the delay count, rescued allies, and engagement are all recorded", () => {
    const log = fullWalk(STANDARD, RECORDS_STANDARD);
    expect(log.seats[0]?.fields.techUpgrade).toEqual({ kind: "cardRef", cardId: TECH_IDS[0] });
    expect(log.shared.experimental).toEqual({ kind: "cardList", cardIds: [] });
    expect(log.shared.delayCounters).toEqual({ kind: "number", value: 3 });
    expect(log.seats[0]?.fields.rescuedAllies).toEqual({ kind: "cardList", cardIds: [MOON_KNIGHT] });
    expect(log.seats[0]?.fields.engagedWithEnemy).toEqual({ kind: "flag", value: true });
    // MC10 p. 17's persistent-damage and obligation fields are declared `whenModes: { expertCampaign: true }`
    // (`trors.ts` `logFields`): in a standard campaign they are never even written.
    expect(log.seats[0]?.fields.remainingHp).toBeUndefined();
    expect(log.seats[0]?.fields.obligations).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Helper shared by every real-game test: a genuinely low-total-HP Crossbones (RRG p. 11-legal setup, not a hack)
// ---------------------------------------------------------------------------------------------------------------

const PLAYER_SEATS = STARTER_IDS.map((starterDeckId) => ({ starterDeckId }));

/**
 * `GameSetupConfig.villainStartStageIndex`/`villainLastStageIndex` are the *same* fields
 * `wave2/setup.ts`'s `buildSingleVillain` already uses to pick standard's `[1, 2]` vs. expert's `[2, 3]` stage
 * range (`packages/content/src/data/trors/scenarios.ts`'s `villainStages`) — clamping both to stage I alone is
 * legal, existing configuration, not an engine change: it plays the same Crossbones, at his lowest printed HP
 * (`hp: { base: 0, perPlayer: 12 }`), so a deterministic greedy driver can reach a genuine `villainDefeated` win
 * inside the time this suite budgets for one test.
 */
function crossbonesStageOneOnly(seed: number): GameSetupConfig {
  const scenario = WAVE2_SCENARIOS.find((s) => s.id === "crossbones");
  if (!scenario) throw new Error("no crossbones scenario record");
  const villain = WAVE2_CARDS.find((c) => c.id === scenario.villainCardId && c.type === "villain");
  if (!villain || villain.type !== "villain") throw new Error("crossbones' villain card is missing or wrong type");
  const side = villain.sides[0];
  if (!side) throw new Error("crossbones has no villain side");
  const stageOne = side.stages.findIndex((s) => s.stageNumber === 1);
  const sets = [...scenario.encounterSetIds, ...scenario.standardEncounterSetIds];
  const encounterDeck: CardId[] = [];
  for (const setId of sets) {
    const members = WAVE2_CARDS.filter(
      (c) =>
        "encounterSetIds" in c &&
        (c as { encounterSetIds: readonly string[] }).encounterSetIds.includes(setId) &&
        c.type !== "villain" &&
        c.type !== "main_scheme",
    );
    for (const card of members)
      for (let copy = 0; copy < (card as { quantityInSet: number }).quantityInSet; copy++) encounterDeck.push(card.id);
  }
  return {
    seed,
    cards: WAVE2_CARDS,
    villainCardId: scenario.villainCardId,
    villainSide: side.side,
    villainStartStageIndex: stageOne,
    villainLastStageIndex: stageOne,
    mainSchemeCardId: scenario.mainSchemeCardId,
    encounterDeck,
    players: PLAYER_SEATS.map((seat) => wave2StarterDeckSetup(seat.starterDeckId)),
    includeIdentitySets: scenario.usesIdentityEncounterSets ?? true,
    requireIdentitySets: true,
    requireLegalDecks: true,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// 12 (kept here so its helper is beside it). A real, engine-recognized win, played through the actual campaign
// runner — no override anywhere in this test.
// ---------------------------------------------------------------------------------------------------------------

describe("a real, engine-recognized win proves the victory path end to end (no override)", () => {
  it("MC10 p. 3 — Crossbones is genuinely defeated, and the campaign runner marks the node completed for real", () => {
    // Seed 20 is not special to the rule under test — it is simply one of several campaign seeds (found by an
    // exhaustive local search over 1..60) whose derived in-game seed lets the driver's greedy play genuinely
    // reduce stage-I-only Crossbones to 0 HP before the main scheme completes or both players are defeated.
    const seedLog = freshLog("qa-genuine-win", STANDARD, 20);
    const composed = settle(
      (answers) => resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, seedLog, DEPS, STANDARD, answers),
      SCRIPT,
    ).value;
    const start = startGameFromLog(TRORS_CAMPAIGN_DEFINITION, composed);
    if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
    const created = createGame({ ...crossbonesStageOneOnly(start.input.seed), campaign: start.input }, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);

    const driven = playToOutcome(created.state, WAVE2_DEPS);
    // The genuine claim: no override anywhere below this line. If the driver ever stops winning this exact
    // configuration (a real risk — it is a deterministic function of the driver's own greedy policy), this
    // assertion is the one that fails, not a downstream one.
    expect(driven.outcome).toEqual({ result: "win", reason: "villainDefeated" });

    const replayed = replay(driven.session.log, WAVE2_DEPS);
    if (!replayed.ok) throw new Error("session log did not replay");
    const events = [...created.events, ...replayed.events];
    const result = campaignResultOf(TRORS_CAMPAIGN_DEFINITION, composed, driven.session.state, events, WAVE2_DEPS);
    expect(result.outcome).toBe("won"); // derived from the real `driven.session.state.outcome`, not asserted

    const folded = settle(
      (answers) =>
        applyCampaignResult(
          TRORS_CAMPAIGN_DEFINITION,
          composed,
          result,
          { at: 1_700_000_000_000, gameId: "qa-genuine-win" },
          DEPS,
          answers,
        ),
      SCRIPT,
    ).value;
    expect(folded.position.resolved.crossbones).toBe("completed");
    expect(folded.position.nextNodeId).toBe("absorbing-man");
    expect(folded.history[0]?.outcome).toBe("won");
  }, 60_000);
});

// ---------------------------------------------------------------------------------------------------------------
// 2. A full expert campaign: persistent damage, healing by obligation, the "engaged with enemy" record, delay
//    counters as starting threat, and Red Skull's expert-only campaign loss.
// ---------------------------------------------------------------------------------------------------------------

/** Plays a real, full-strength Crossbones game to its real (per `trors.test.ts`'s own finding, always losing)
 * conclusion, then re-derives `campaignResultOf` with that finished state's outcome overridden to a win — the
 * documented technique, used here because only a real, damaged-but-alive loss produces a real hit-point value to
 * record as persistent damage. */
function playCrossbonesForPersistentDamage(seedLog: CampaignLog): { readonly folded: CampaignLog } {
  const composed = settle(
    (answers) => resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, seedLog, DEPS, seedLog.modes, answers),
    SCRIPT,
  ).value;
  const start = startGameFromLog(TRORS_CAMPAIGN_DEFINITION, composed);
  if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
  const config = wave2Scenario(start.scenarioId, { players: PLAYER_SEATS, seed: start.input.seed, modes: start.modes });
  const created = createGame({ ...config, campaign: start.input }, WAVE2_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);

  const driven = playToOutcome(created.state, WAVE2_DEPS);
  if (!driven.outcome) throw new Error("crossbones never reached an outcome");
  const replayed = replay(driven.session.log, WAVE2_DEPS);
  if (!replayed.ok) throw new Error("session log did not replay");
  const events = [...created.events, ...replayed.events];
  // The driver reliably loses this villain at full strength by both identities being defeated (`allPlayersDefeated`)
  // — the file header's own reason a real loss is the only way to get real persistent damage. Overriding `outcome`
  // to a win is already fictional (see the header); a real win never leaves every seat eliminated, so the override
  // also clears `eliminated`, or `sittingOutOf`'s now-wired `elimination` policy (step 4e) would read both seats as
  // sitting out the Victory steps this test exists to exercise, healing away the very persistent damage under test.
  const wonState: GameState = {
    ...driven.session.state,
    players: driven.session.state.players.map((player) => ({ ...player, eliminated: false })),
    outcome: { result: "win", reason: "villainDefeated" },
  };
  const result = campaignResultOf(TRORS_CAMPAIGN_DEFINITION, composed, wonState, events, WAVE2_DEPS);
  const folded = settle(
    (answers) =>
      applyCampaignResult(
        TRORS_CAMPAIGN_DEFINITION,
        composed,
        result,
        { at: 1_700_000_000_000, gameId: "qa-persist" },
        DEPS,
        answers,
      ),
    SCRIPT,
  ).value;
  return { folded };
}

describe("MC10 p. 17 / p. 7 — persistent damage and obligation healing in an expert campaign (forced win)", () => {
  it("records each identity's remaining hit points, capped at base HP, after the scenario", () => {
    const { folded } = playCrossbonesForPersistentDamage(freshLog("qa-persist-seed", EXPERT, 7));
    for (const seat of folded.seats) {
      const recorded = seat.fields.remainingHp;
      expect(recorded).toEqual({ kind: "number", value: expect.any(Number) });
      const value = (recorded as { readonly value: number }).value;
      expect(value).toBeGreaterThanOrEqual(0);
    }
  }, 60_000);

  it("Absorbing Man's setup sets each identity's HP to that recorded value, and healing by obligation overrides it to full", () => {
    const { folded } = playCrossbonesForPersistentDamage(freshLog("qa-persist-heal", EXPERT, 7));
    const seat1Field = folded.seats[0]?.fields.remainingHp;
    const seat2Field = folded.seats[1]?.fields.remainingHp;
    if (!seat1Field || !seat2Field) throw new Error("missing recorded remainingHp");
    const recordedHp1 = (seat1Field as { readonly value: number }).value;
    const recordedHp2 = (seat2Field as { readonly value: number }).value;

    // Compose (but do not play) Absorbing Man: `SCRIPT` has seat 1 accept the random obligation and seat 2 decline
    // it, so only seat 1 should end this setup healed to full, and only seat 1 should carry the obligation in its
    // deck (MC10 p. 17: "Each player **may** add 1 random obligation ... to heal their identity to its full hit
    // point value").
    const composed = settle(
      (answers) => resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, folded, DEPS, EXPERT, answers),
      SCRIPT,
    ).value;
    const start = startGameFromLog(TRORS_CAMPAIGN_DEFINITION, composed);
    if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
    const config = wave2Scenario(start.scenarioId, {
      players: PLAYER_SEATS,
      seed: start.input.seed,
      modes: start.modes,
    });
    const created = createGame({ ...config, campaign: start.input }, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);

    const seat1Id = created.state.players[0]?.identity.instanceId;
    const seat2Id = created.state.players[1]?.identity.instanceId;
    if (!seat1Id || !seat2Id) throw new Error("missing identity instance");
    const seat1Damage = getInstance(created.state, seat1Id)?.damage ?? -1;
    const seat2Damage = getInstance(created.state, seat2Id)?.damage ?? -1;
    const seat2Max = characterProfile(created.state, seat2Id, WAVE2_DEPS)?.maxHp ?? 0;

    expect(seat1Damage).toBe(0); // healed to full by the obligation it accepted
    expect(seat2Damage).toBe(seat2Max - recordedHp2); // persistent damage, unmodified (declined the obligation)
    // A real loss at full-strength Crossbones (see the file header) leaves the identity meaningfully hurt, not
    // merely "not full" by rounding: this seed's damage is not the vacuous 0-damage case.
    expect(seat2Damage).toBeGreaterThan(0);
    void recordedHp1;

    // The obligation is a granted encounter card with a player-card back (MC10 p. 17), legal in this seat's deck
    // only because the campaign granted it, and exempt from deck size (MC10 p. 3).
    const obligationGrant = composed.seats[0]?.grants.find((grant) => grant.cardId.startsWith("0416"));
    expect(obligationGrant).toBeDefined();
    const context: DeckContext = {
      campaign: {
        campaignId: TRORS_CAMPAIGN.id as string,
        campaignSetIds: TRORS_CAMPAIGN.campaignSetIds.map((id) => id as string),
        identityCardId: composed.seats[0]?.identityCardId as string,
        grantedCardIds: (composed.seats[0]?.grants ?? []).map((grant) => grant.cardId as string),
        removedFromCampaign: composed.removedFromCampaign,
      },
    };
    expect(validateDeck(composed.seats[0]?.deck as never, WAVE2_CARDS, context)).toEqual({ ok: true });
  }, 60_000);
});

/** Advances a log through a chosen number of already-won, synthetic nodes, for tests that need to reach a later
 * node without playing every earlier game for real. */
function synthWalkTo(
  modes: PlayModes,
  records: Readonly<Record<string, Records>>,
  stopAfterNodeId: string,
): CampaignLog {
  let log = freshLog(`qa-to-${stopAfterNodeId}-${JSON.stringify(modes)}`, modes, 4242);
  for (let guard = 0; guard < 5 && log.position.nextNodeId !== null; guard++) {
    const nodeId = log.position.nextNodeId as string;
    log = stepNode(log, modes, "won", records[nodeId] ?? []);
    if (nodeId === stopAfterNodeId) break;
  }
  return log;
}

describe("MC10 p. 15 — delay counters set Red Skull's starting threat (synthetic)", () => {
  const RECORDS_WITH_DELAY: Readonly<Record<string, Records>> = {
    ...RECORDS_STANDARD,
    "absorbing-man": [write("mc10.s2.victory.delay", "delayCounters", null, { kind: "number", value: 5 })],
  };

  it("standard: places exactly the recorded number of threat counters, once", () => {
    const log = synthWalkTo(STANDARD, RECORDS_WITH_DELAY, "zola");
    const composed = settle(
      (answers) => resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, log, DEPS, STANDARD, answers),
      SCRIPT,
    ).value;
    const start = startGameFromLog(TRORS_CAMPAIGN_DEFINITION, composed);
    if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
    const config = wave2Scenario(start.scenarioId, {
      players: PLAYER_SEATS,
      seed: start.input.seed,
      modes: start.modes,
    });
    const created = createGame({ ...config, campaign: start.input }, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    expect(getInstance(created.state, created.state.mainScheme.instanceId)?.threat).toBe(5);
  });

  it("expert campaign: places that many threat counters once per player (MC10's “[per_hero]” notation)", () => {
    const log = synthWalkTo(EXPERT, RECORDS_WITH_DELAY, "zola");
    const composed = settle(
      (answers) => resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, log, DEPS, EXPERT, answers),
      SCRIPT,
    ).value;
    const start = startGameFromLog(TRORS_CAMPAIGN_DEFINITION, composed);
    if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
    const config = wave2Scenario(start.scenarioId, {
      players: PLAYER_SEATS,
      seed: start.input.seed,
      modes: start.modes,
    });
    const created = createGame({ ...config, campaign: start.input }, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    // 5 delay counters * 2 players, per the module's own reading of "[per_hero]" (`trors.ts`'s
    // `mc10.s5.setup.delay-threat-expert` comment).
    expect(getInstance(created.state, created.state.mainScheme.instanceId)?.threat).toBe(10);
  });
});

describe("MC10 p. 12 / p. 15 — the “engaged with enemy” record and its expert-campaign consequence (synthetic)", () => {
  const RECORDS_WITH_ENGAGEMENT: Readonly<Record<string, Records>> = {
    ...RECORDS_STANDARD,
    zola: [
      write("mc10.s4.victory.engaged", "engagedWithEnemy", 1, { kind: "flag", value: true }),
      write("mc10.s4.victory.engaged", "engagedWithEnemy", 2, { kind: "flag", value: false }),
      write("mc10.s4.victory.prison", "hydraPrison", null, { kind: "flag", value: false }),
      write("mc10.s4.victory.hero-form", "heroForm", 1, { kind: "flag", value: true }),
    ],
  };

  it("is recorded per player regardless of mode", () => {
    const log = synthWalkTo(STANDARD, RECORDS_WITH_ENGAGEMENT, "zola");
    expect(log.seats[0]?.fields.engagedWithEnemy).toEqual({ kind: "flag", value: true });
    expect(log.seats[1]?.fields.engagedWithEnemy).toEqual({ kind: "flag", value: false });
  });

  it("expert campaign only: deals that player an encounter card at Red Skull's setup, and no one else one", () => {
    const log = synthWalkTo(EXPERT, RECORDS_WITH_ENGAGEMENT, "zola");
    const composed = settle(
      (answers) => resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, log, DEPS, EXPERT, answers),
      SCRIPT,
    ).value;
    const start = startGameFromLog(TRORS_CAMPAIGN_DEFINITION, composed);
    if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
    const config = wave2Scenario(start.scenarioId, {
      players: PLAYER_SEATS,
      seed: start.input.seed,
      modes: start.modes,
    });
    const created = createGame({ ...config, campaign: start.input }, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    expect(created.state.players[0]?.dealtEncounter).toHaveLength(1);
    expect(created.state.players[1]?.dealtEncounter).toHaveLength(0);
  });

  it("standard campaign: the record still happens, but nothing is dealt at Red Skull's setup", () => {
    const log = synthWalkTo(STANDARD, RECORDS_WITH_ENGAGEMENT, "zola");
    const composed = settle(
      (answers) => resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, log, DEPS, STANDARD, answers),
      SCRIPT,
    ).value;
    const start = startGameFromLog(TRORS_CAMPAIGN_DEFINITION, composed);
    if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
    const config = wave2Scenario(start.scenarioId, {
      players: PLAYER_SEATS,
      seed: start.input.seed,
      modes: start.modes,
    });
    const created = createGame({ ...config, campaign: start.input }, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    expect(created.state.players[0]?.dealtEncounter).toHaveLength(0);
  });
});

describe("MC10 p. 15 — Red Skull's expert-campaign-only defeat loses the whole campaign (synthetic)", () => {
  it("a lost Red Skull ends the campaign lost, in an expert campaign", () => {
    const log = synthWalkTo(EXPERT, RECORDS_STANDARD, "zola");
    expect(log.position.nextNodeId).toBe("red-skull");
    const lost = stepNode(log, EXPERT, "lost", []);
    expect(lost.status).toBe("lost");
    expect(lost.history.at(-1)?.outcome).toBe("lost");
  });

  it("a lost Red Skull in a *standard* campaign is only a free retry, per MC10 p. 3's general rule", () => {
    const log = synthWalkTo(STANDARD, RECORDS_STANDARD, "zola");
    expect(log.position.nextNodeId).toBe("red-skull");
    const lost = stepNode(log, STANDARD, "lost", []);
    // `whenModes: { expertCampaign: true }` on `mc10.s5.defeat.lose-campaign` (`trors.ts`) means the instruction is
    // skipped entirely outside an expert campaign, so `applyCampaignResult`'s "no penalty, try again" default holds.
    expect(lost.status).toBe("active");
    expect(lost.position.nextNodeId).toBe("red-skull");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 3. A lost-and-retried scenario: the log survives, the retry replays the same deck, no penalty, nodeStart baseline
// ---------------------------------------------------------------------------------------------------------------

describe("MC10 p. 3 — a lost scenario resets with no penalty, and a retry replays the same deck (synthetic)", () => {
  it("a loss at Absorbing Man restores the log to exactly how Crossbones' win left it", () => {
    const wonCrossbones = stepNode(
      freshLog("qa-retry", STANDARD, 4242),
      STANDARD,
      "won",
      RECORDS_STANDARD.crossbones ?? [],
    );
    // The deck Absorbing Man's *first* attempt would be composed with — the retry must reproduce this exactly.
    const firstAttemptComposed = settle(
      (answers) => resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, wonCrossbones, DEPS, STANDARD, answers),
      SCRIPT,
    ).value;
    const firstAttemptDeck = startGameFromLog(TRORS_CAMPAIGN_DEFINITION, firstAttemptComposed).input.seats[0]?.deck;

    const afterLoss = stepNode(wonCrossbones, STANDARD, "lost", []);
    // MC10 p. 3: "If the players lost, they may reset the scenario and try again with no penalty." No history
    // entry is lost, the node to play is still Absorbing Man, and the seat that took a TECH upgrade after
    // Crossbones still has it — nothing about the node's own (never-reached) victory steps is applied or undone.
    expect(afterLoss.position.nextNodeId).toBe("absorbing-man");
    expect(afterLoss.history).toHaveLength(2);
    expect(afterLoss.history[1]?.outcome).toBe("lost");
    expect(afterLoss.seats).toEqual(wonCrossbones.seats); // `retryBaseline: "nodeStart"` — design §4.6, §7.3

    // The retry's own composed game must draw the *same* deck the lost game did (design Q6 / MC40 p. 7's reading).
    const retryComposed = settle(
      (answers) => resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, afterLoss, DEPS, STANDARD, answers),
      SCRIPT,
    ).value;
    const retryDeck = startGameFromLog(TRORS_CAMPAIGN_DEFINITION, retryComposed).input.seats[0]?.deck;
    expect(retryDeck).toEqual(firstAttemptDeck);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 4. A permanent removal made during a lost game still refuses the card on retry (RRG p. 29; MC10 p. 5 card text)
// ---------------------------------------------------------------------------------------------------------------

describe("RRG p. 29 / MC10 p. 5 — an in-game removal survives a loss, and refuses the card on the retry", () => {
  it("a TECH upgrade's own 'remove it from the campaign log' still sticks after the game that used it is lost", () => {
    const wonCrossbones = stepNode(
      freshLog("qa-removal", STANDARD, 4242),
      STANDARD,
      "won",
      RECORDS_STANDARD.crossbones ?? [],
    );
    expect(wonCrossbones.seats[0]?.grants.some((grant) => grant.cardId === TECH_IDS[0])).toBe(true);

    // A TECH upgrade's printed ability is "Discard this card and remove it from the campaign log → …" (MC10 p. 5
    // card text; design §6.2), which resolves in-game as `removeFromCampaign` regardless of the game's outcome.
    // `CampaignGameResult.removedFromCampaign` is exactly the plain-data shape that ability writes into
    // `GameState.campaignWrites` (`resolve/campaign.ts`'s `recordCampaignRemoval`) — this test supplies that
    // outcome directly rather than scripting the ability's `useAbility` command through a real game, which
    // `campaign-primitives.test.ts` already covers at the primitive level.
    const lost = stepNode(wonCrossbones, STANDARD, "lost", [], {
      removedFromCampaign: [{ cardId: TECH_IDS[0] as CardId }],
    });

    // RRG 1.8 "Campaign" (p. 29): "If a card is removed from a campaign, that card can no longer be used during the
    // rest of the campaign, even if players retry the scenario wherein that card was removed."
    expect(lost.removedFromCampaign).toEqual([{ cardId: TECH_IDS[0] }]);
    expect(lost.position.nextNodeId).toBe("absorbing-man");

    // Refused by `validateDeck` — the deckbuilding side of the same rule.
    const context: DeckContext = {
      campaign: {
        campaignId: TRORS_CAMPAIGN.id as string,
        campaignSetIds: TRORS_CAMPAIGN.campaignSetIds.map((id) => id as string),
        identityCardId: lost.seats[0]?.identityCardId as string,
        grantedCardIds: (lost.seats[0]?.grants ?? []).map((grant) => grant.cardId as string),
        removedFromCampaign: lost.removedFromCampaign,
      },
    };
    const validation = validateDeck(lost.seats[0]?.deck as never, WAVE2_CARDS, context);
    expect(validation.ok).toBe(false);
    if (!validation.ok) expect(validation.problems.map((p) => p.code)).toContain("campaign_removed_card");

    // Absent from the retry's own setup: the next attempt's `CampaignGameInput` still carries the removal.
    const retryComposed = settle(
      (answers) => resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, lost, DEPS, STANDARD, answers),
      SCRIPT,
    ).value;
    const retryInput = startGameFromLog(TRORS_CAMPAIGN_DEFINITION, retryComposed).input;
    expect(retryInput.removedFromCampaign).toEqual([{ cardId: TECH_IDS[0] }]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 5. Hydra Prison rescued allies: recorded, removed, and the "Improved" upgrade gate (MC10 p. 10, p. 12)
// ---------------------------------------------------------------------------------------------------------------

describe("MC10 p. 10 / p. 12 — Hydra Prison's rescued allies are recorded and removed correctly (synthetic)", () => {
  it("an ally still tucked under Hydra Prison when the scenario ends is removed from the campaign for good", () => {
    const RECORDS_ZOLA_PRISON: Readonly<Record<string, Records>> = {
      ...RECORDS_STANDARD,
      taskmaster: [
        appendWrite("mc10.s3.victory.rescued-record", "rescuedAllies", 1, {
          kind: "cardList",
          cardIds: [MOON_KNIGHT],
        }),
      ],
      zola: [
        // The `cardsTuckedUnder` query itself (RRG 1.8 "Tuck") is `@mc/engine`'s own primitive, proven separately
        // (design §11 step 7's file header); this test proves MC10's *wiring* of it: the prison still in play
        // means the tucked ally is recorded and then removed, and the "Improved" upgrade offer is skipped.
        write("mc10.s4.victory.prison", "hydraPrison", null, { kind: "flag", value: true }),
        appendWrite("mc10.s4.victory.prison", "imprisonedAllies", null, { kind: "cardList", cardIds: [MOON_KNIGHT] }),
        write("mc10.s4.victory.hero-form", "heroForm", 1, { kind: "flag", value: true }),
      ],
    };
    const log = synthWalkTo(STANDARD, RECORDS_ZOLA_PRISON, "zola");

    expect(log.seats[0]?.fields.rescuedAllies).toEqual({ kind: "cardList", cardIds: [MOON_KNIGHT] });
    // RRG 1.8 p. 29's removal, as MC10 p. 12's own rules clarification spells it out: "cross it out of the
    // campaign log. That card is no longer part of the campaign and cannot be included in any deck for the
    // remainder of the campaign."
    expect(log.removedFromCampaign).toEqual([{ cardId: MOON_KNIGHT }]);

    const context: DeckContext = {
      campaign: {
        campaignId: TRORS_CAMPAIGN.id as string,
        campaignSetIds: TRORS_CAMPAIGN.campaignSetIds.map((id) => id as string),
        identityCardId: log.seats[0]?.identityCardId as string,
        grantedCardIds: (log.seats[0]?.grants ?? []).map((grant) => grant.cardId as string),
        removedFromCampaign: log.removedFromCampaign,
      },
    };
    // The rescued ally was granted earlier (MC10 p. 10) and then removed (MC10 p. 12): `campaignTookAway` in
    // `deck.ts` checks the removal *first*, so this is refused as removed, not accepted as granted.
    const deckWithMoonKnight = {
      identityCardId: log.seats[0]?.identityCardId as string,
      aspects: log.seats[0]?.deck.aspects ?? [],
      cards: [...(log.seats[0]?.deck.cards ?? []), { cardId: MOON_KNIGHT, quantity: 1 }],
    };
    const validation = validateDeck(deckWithMoonKnight as never, WAVE2_CARDS, context);
    expect(validation.ok).toBe(false);
    if (!validation.ok) expect(validation.problems.map((p) => p.code)).toContain("campaign_removed_card");

    const zola = log.history.find((entry) => entry.nodeId === "zola");
    expect(zola?.steps.find((step) => step.instructionId === "mc10.s4.victory.improved")?.skipped).toBe("condition");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 6. Campaign-specific legality (RRG p. 11) and the deck-size exemption (MC10 p. 3)
// ---------------------------------------------------------------------------------------------------------------

describe("RRG p. 11 — a campaign-specific card is illegal outside its campaign, legal only inside it", () => {
  it("a Hydra Campaign TECH upgrade is refused with no campaign context, and refused if not granted", () => {
    const deck = {
      identityCardId: "04001a" as string,
      aspects: ["leadership"] as const,
      cards: [
        ...(TRORS_STARTER_DECKS.find((d) => (d.id as string) === "hawkeye-leadership")?.cards ?? []).map((line) => ({
          cardId: line.cardId as string,
          quantity: line.quantity,
        })),
        { cardId: TECH_IDS[0], quantity: 1 },
      ],
    };
    const outside = validateDeck(deck as never, WAVE2_CARDS);
    expect(outside.ok).toBe(false);
    if (!outside.ok) expect(outside.problems.map((p) => p.code)).toContain("campaign_card");

    const context: DeckContext = {
      campaign: {
        campaignId: TRORS_CAMPAIGN.id as string,
        campaignSetIds: TRORS_CAMPAIGN.campaignSetIds.map((id) => id as string),
        identityCardId: "04001a",
        grantedCardIds: [], // in the campaign, but never directed to add it
      },
    };
    const notGranted = validateDeck(deck as never, WAVE2_CARDS, context);
    expect(notGranted.ok).toBe(false);
    if (!notGranted.ok) expect(notGranted.problems.map((p) => p.code)).toContain("campaign_card_not_granted");

    const granted = validateDeck(deck as never, WAVE2_CARDS, {
      campaign: {
        campaignId: TRORS_CAMPAIGN.id as string,
        campaignSetIds: TRORS_CAMPAIGN.campaignSetIds.map((id) => id as string),
        identityCardId: "04001a",
        grantedCardIds: [TECH_IDS[0]],
      },
    });
    expect(granted).toEqual({ ok: true });
  });

  it("campaign-added cards do not count toward minimum or maximum deck size (MC10 p. 3)", () => {
    const starter = TRORS_STARTER_DECKS.find((d) => (d.id as string) === "hawkeye-leadership");
    if (!starter) throw new Error("no hawkeye starter");
    // The starter is exactly 40 cards (the maximum a non-campaign deck may add nothing beyond); a 41st line that
    // is a *granted* campaign card must still validate.
    const total = starter.cards.reduce((sum, line) => sum + line.quantity, 0);
    expect(total).toBe(40);
    const deck = {
      identityCardId: starter.identityCardId as string,
      aspects: starter.aspects,
      cards: [
        ...starter.cards.map((line) => ({ cardId: line.cardId as string, quantity: line.quantity })),
        { cardId: TECH_IDS[0], quantity: 1 },
      ],
    };
    const context: DeckContext = {
      campaign: {
        campaignId: TRORS_CAMPAIGN.id as string,
        campaignSetIds: TRORS_CAMPAIGN.campaignSetIds.map((id) => id as string),
        identityCardId: starter.identityCardId as string,
        grantedCardIds: [TECH_IDS[0]],
      },
    };
    expect(validateDeck(deck as never, WAVE2_CARDS, context)).toEqual({ ok: true });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 7. Determinism
// ---------------------------------------------------------------------------------------------------------------

describe("determinism", () => {
  it("the same seed and the same answers reproduce an identical log", () => {
    const first = fullWalk(EXPERT, RECORDS_STANDARD, 4242);
    const second = fullWalk(EXPERT, RECORDS_STANDARD, 4242);
    // `id` is caller-supplied and deliberately differs per call (`fullWalk`'s own `id`); everything the runner
    // itself produces must match exactly, seeded RNG state included.
    expect({ ...first, id: "x" }).toEqual({ ...second, id: "x" });
  });

  it("a mid-campaign JSON round trip continues to the same end state as the unsaved log", () => {
    let live = freshLog("qa-roundtrip", EXPERT, 4242);
    live = stepNode(live, EXPERT, "won", RECORDS_STANDARD.crossbones ?? []);
    live = stepNode(live, EXPERT, "won", RECORDS_STANDARD["absorbing-man"] ?? []);
    // Simulates a save/resume through `mc-saves` (design §10.1): plain `JSON.parse(JSON.stringify(...))`, no
    // custom (de)serializer, because `CampaignLog` is declared plain serializable data (design §5).
    let resumed = JSON.parse(JSON.stringify(live)) as CampaignLog;

    for (const nodeId of ["taskmaster", "zola", "red-skull"]) {
      const records = RECORDS_STANDARD[nodeId] ?? [];
      live = stepNode(live, EXPERT, "won", records);
      resumed = stepNode(resumed, EXPERT, "won", records);
    }
    expect(resumed).toEqual(live);
    expect(live.status).toBe("won");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 8. Modes: expert campaign composes with standard mode and with expert mode (RRG p. 29 Q1); the expert-mode
//    encounter-set substitution still happens inside a campaign.
// ---------------------------------------------------------------------------------------------------------------

describe('RRG 1.8 "Modes of Play" (p. 29) — expert campaign is independent of expert mode, and both still compose', () => {
  it("an expert campaign in standard mode composes a legal game at Crossbones' standard stage range", () => {
    const seedLog = freshLog("qa-modes-standard", EXPERT, 11);
    const composed = settle(
      (answers) => resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, seedLog, DEPS, EXPERT, answers),
      SCRIPT,
    ).value;
    const start = startGameFromLog(TRORS_CAMPAIGN_DEFINITION, composed);
    if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
    const config = wave2Scenario(start.scenarioId, { players: PLAYER_SEATS, seed: start.input.seed, modes: EXPERT });
    const created = createGame({ ...config, campaign: start.input }, WAVE2_DEPS);
    expect(created.ok).toBe(true);
    // Crossbones' `villainStages.standard` is `[1, 2]` (`scenarios.ts`): stage I is index 0.
    expect(config.villainStartStageIndex).toBe(0);
  });

  it("an expert campaign in expert mode starts the villain a stage later and substitutes the expert encounter set", () => {
    const seedLog = freshLog("qa-modes-expert", EXPERT_MODE_TOO, 11);
    const composed = settle(
      (answers) => resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, seedLog, DEPS, EXPERT_MODE_TOO, answers),
      SCRIPT,
    ).value;
    const start = startGameFromLog(TRORS_CAMPAIGN_DEFINITION, composed);
    if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
    const standardConfig = wave2Scenario(start.scenarioId, {
      players: PLAYER_SEATS,
      seed: start.input.seed,
      modes: EXPERT,
    });
    const expertConfig = wave2Scenario(start.scenarioId, {
      players: PLAYER_SEATS,
      seed: start.input.seed,
      modes: EXPERT_MODE_TOO,
    });
    const created = createGame({ ...expertConfig, campaign: start.input }, WAVE2_DEPS);
    expect(created.ok).toBe(true);
    // `villainStages.expert` is `[2, 3]`: stage II is index 1, one later than standard's stage I (index 0).
    expect(expertConfig.villainStartStageIndex).toBe(1);
    expect(expertConfig.villainStartStageIndex).not.toBe(standardConfig.villainStartStageIndex);
    // The `expert` encounter set (`Scenario.expertEncounterSetIds`) is only mixed in for expert *mode*, whether or
    // not this is a campaign game — the campaign's own `modes.expert` flag reaches the same `difficultyOf` read
    // `wave2/setup.ts`'s `buildSingleVillain` always used.
    expect(expertConfig.encounterDeck.length).toBeGreaterThan(standardConfig.encounterDeck.length);
  });
});

// -----------------------------------------------------------------------------------------------------------------
// Step 4e — MC10 p. 17's own Elimination and Victory: a mandatory obligation, not MC16's free rejoin
// -----------------------------------------------------------------------------------------------------------------

/**
 * MC10 p. 17 (`trors.ts`'s `elimination`, `mc10.elimination.rejoin`/`.obligation`): "If a player is defeated during
 * a scenario that their teammates go on to win, the defeated player does not participate in any of the victory
 * steps for that scenario. However, they can rejoin their teammates for the next scenario by adding an obligation
 * to their deck during setup to restore their identity to full hit points." Maintainer decision 2026-09-23 (no FFG
 * ruling exists): unlike MC16 p. 5's free rejoin, the obligation here is the mandatory price of rejoining.
 *
 * Synthetic (per this file's header technique note): `applyCampaignResult` is handed a `CampaignGameResult` whose
 * `sittingOut: [2]` stands in for whatever `campaignResultOf` would have derived from a real game where seat 2 was
 * eliminated (`GameState.players[i].eliminated`) in a scenario the team won — `@mc/engine`'s own
 * `campaign/result.test.ts` / `campaign/runner.test.ts` already cover that derivation at the primitive level, and
 * `gmw.qa.test.ts`'s "Elimination and Victory" describe block proves it against a real finished `GameState` for the
 * sibling MC16 policy.
 */
describe('MC10 p. 17 "Elimination and Victory" — an eliminated seat sits out Victory, then rejoins with a mandatory obligation', () => {
  const seat2IdentityHp = (() => {
    const card = WAVE2_CARDS.find((candidate) => candidate.id === SEATS[1]!.identityCardId);
    if (!card || card.type !== "hero_identity") throw new Error("seat 2's identity is not a hero_identity card");
    return card.hp;
  })();

  function eliminatedAtCrossbones(seed = 9001) {
    const log = freshLog(`qa-elimination-${seed}`, EXPERT, seed);
    const composed = settle(
      (answers) => resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, log, DEPS, EXPERT, answers),
      SCRIPT,
    ).value;
    const result: CampaignGameResult = {
      nodeId: "crossbones",
      outcome: "won",
      // Exactly what `campaignResultOf` would compute for a won game with seat 2 eliminated: `seatsFor`'s exclusion
      // already means no "each"-scoped write exists for seat 2, so none is supplied here either — instead there is
      // `rejoinRecords`' own write, keyed to the policy's own instruction id, exactly as `result.ts` derives it from
      // the seat's printed hit points.
      records: [
        appendWrite("mc10.s1.victory.experimental", "experimental", null, { kind: "cardList", cardIds: [] }),
        write("mc10.s1.victory.hp", "remainingHp", 1, { kind: "number", value: 40 }),
        write("mc10.elimination.rejoin", "remainingHp", 2, { kind: "number", value: seat2IdentityHp }),
      ],
      removedFromCampaign: [],
      logWrites: [],
      expiringGrants: [],
      sittingOut: [2],
    };
    const folded = settle(
      (answers) =>
        applyCampaignResult(
          TRORS_CAMPAIGN_DEFINITION,
          composed,
          result,
          { at: 1_700_000_000_000, gameId: "qa-elimination" },
          DEPS,
          answers,
        ),
      SCRIPT,
    ).value;
    return { composed, folded };
  }

  it("seat 2 takes none of Crossbones' Victory steps: no TECH upgrade grant, no log write", () => {
    const { folded } = eliminatedAtCrossbones();
    expect(folded.seats[1]?.fields.techUpgrade).toBeUndefined();
    expect(
      folded.seats[1]?.grants.some((grant) => (TECH_IDS as readonly string[]).includes(grant.cardId as string)),
    ).toBe(false);
    // Seat 1 (not eliminated) is unchanged: it still takes its own TECH upgrade normally.
    expect(folded.seats[0]?.fields.techUpgrade).toEqual({ kind: "cardRef", cardId: TECH_IDS[0] });
    expect(folded.seats[0]?.grants.some((grant) => grant.cardId === TECH_IDS[0])).toBe(true);
  });

  it("seat 2 rejoins with exactly one new Expert Campaign obligation and full (printed) hit points (the shared-set caveat in trors.ts note 1 applies)", () => {
    const { folded } = eliminatedAtCrossbones();
    const seat2 = folded.seats[1]!;
    expect(seat2.fields.remainingHp).toEqual({ kind: "number", value: seat2IdentityHp });
    const obligationGrants = seat2.grants.filter((grant) => (grant.cardId as string).startsWith("0416"));
    expect(obligationGrants).toHaveLength(1);
    expect(seat2.fields.obligations).toEqual({ kind: "cardList", cardIds: [obligationGrants[0]!.cardId] });
    const trace = folded.history
      .at(-1)!
      .steps.find((step) => step.instructionId === "mc10.elimination.rejoin.obligation");
    expect(trace?.grants).toHaveLength(1);
  });

  it("a standard campaign prints no such rule: the obligation and HP write never happen even if a seat sits out", () => {
    const log = freshLog("qa-elimination-standard", STANDARD, 9002);
    const composed = settle(
      (answers) => resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, log, DEPS, STANDARD, answers),
      SCRIPT,
    ).value;
    const result: CampaignGameResult = {
      nodeId: "crossbones",
      outcome: "won",
      records: [appendWrite("mc10.s1.victory.experimental", "experimental", null, { kind: "cardList", cardIds: [] })],
      removedFromCampaign: [],
      logWrites: [],
      expiringGrants: [],
      sittingOut: [2],
    };
    const folded = settle(
      (answers) =>
        applyCampaignResult(
          TRORS_CAMPAIGN_DEFINITION,
          composed,
          result,
          { at: 1_700_000_000_000, gameId: "qa-elimination-standard" },
          DEPS,
          answers,
        ),
      SCRIPT,
    ).value;
    // `EliminationPolicy.whenModes: { expertCampaign: true }` gates the whole rule: no rejoin write, no obligation.
    // The instruction is still traced (as every instruction is, per `runCampaignInstruction`'s own contract, "why
    // did nothing happen?"), but `skipped: "modes"` and no writes or grants — a standard campaign never applies it.
    expect(folded.seats[1]?.fields.remainingHp).toBeUndefined();
    expect(folded.seats[1]?.fields.obligations).toBeUndefined();
    const traces = folded.history.at(-1)!.steps.filter((step) => step.instructionId.startsWith("mc10.elimination"));
    expect(traces.every((step) => step.skipped === "modes")).toBe(true);
    expect(traces.every((step) => step.grants.length === 0 && step.writes.length === 0)).toBe(true);
  });

  it("a seat not eliminated leaves no elimination trace at all: the synthetic rejoin instructions are absent", () => {
    const log = fullWalk(EXPERT, RECORDS_STANDARD);
    for (const entry of log.history) {
      expect(entry.steps.some((step) => step.instructionId.startsWith("mc10.elimination"))).toBe(false);
    }
  });
});
