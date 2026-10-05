/**
 * docs/phase7-wave7.md §3.40: `CampaignOp` `choose` with `repeatOnRetry`.
 *
 * MC40 p. 7: "When the players replay a scenario after losing, they must choose the same player side scheme for that
 * scenario and defeat it in order to earn its reward, even if they defeated it during a game they lost." The loss
 * already rolls the pick back (`LossPolicy.retryBaseline`); the flag is the other half: the retry does not offer the
 * choice, it takes the lost attempt's pick out of the history and traces it with `repeated: true`.
 *
 * A standalone definition, like `sm-queries.test.ts`, so nothing here perturbs `runner.test.ts`'s fixture.
 */
import { describe, expect, it } from "vitest";
import { campaignId, cardId, scenarioId, type PlayModes } from "@mc/content";
import type {
  CampaignChoiceRecord,
  CampaignDefinition,
  CampaignGameResult,
  CampaignInstruction,
  CampaignLog,
  CampaignValue,
  LogValue,
} from "../campaign.js";
import {
  applyCampaignResult,
  campaignChoiceKey,
  createCampaignLog,
  resolveBetweenGames,
  type CampaignChoiceAnswer,
  type CampaignDeps,
  type CampaignPendingChoice,
  type CampaignSeatSetup,
} from "./runner.js";

const CAMPAIGN_ID = campaignId("repeat-on-retry-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID } };
const SCENARIO = scenarioId("repeat-on-retry-test-scenario");
const DEPS: CampaignDeps = { pool: [] };

const SEATS: readonly CampaignSeatSetup[] = [1, 2].map((seatNumber) => ({
  seatNumber,
  identityCardId: cardId(`hero-${seatNumber}`),
  deck: { identityCardId: cardId(`hero-${seatNumber}`), aspects: [], cards: [] },
}));

const SCHEMES = ["north", "south", "east"];
const TONES = ["loud", "quiet"];
const BADGES = ["x", "y"];
const RELIC_A = cardId("relic-a");
const RELIC_B = cardId("relic-b");

const choice = (slot: string): CampaignValue => ({ kind: "choice", slot });

/** "The players as a group choose 1 … that has not been chosen previously", marked as chosen for this node. */
const chooseScheme = (node: string): CampaignInstruction => ({
  id: `${node}.setup.scheme`,
  text: "test",
  citation: "test",
  step: {
    kind: "betweenGames",
    ops: [
      {
        kind: "choose",
        slot: "scheme",
        chooser: "group",
        from: { kind: "fieldOptions", field: "chosen", unstruckOnly: true },
        repeatOnRetry: true,
      },
      { kind: "strike", field: "chosen", option: choice("scheme") },
      { kind: "setField", field: `${node}Scheme`, value: choice("scheme") },
    ],
  },
});

/** The same shape without the flag: a retry asks again. */
const chooseTone: CampaignInstruction = {
  id: "first.setup.tone",
  text: "test",
  citation: "test",
  step: {
    kind: "betweenGames",
    ops: [
      { kind: "choose", slot: "tone", chooser: "group", from: { kind: "fieldOptions", field: "tone" } },
      { kind: "setField", field: "tone", value: choice("tone") },
    ],
  },
};

/** A flagged choice each seat makes, so the recorded pick is found by seat. */
const chooseBadge: CampaignInstruction = {
  id: "first.setup.badge",
  text: "test",
  citation: "test",
  step: {
    kind: "betweenGames",
    ops: [
      {
        kind: "choose",
        slot: "badge",
        chooser: "eachSeat",
        from: { kind: "fieldOptions", field: "badge" },
        repeatOnRetry: true,
      },
      { kind: "setField", field: "badge", seat: "self", value: choice("badge") },
    ],
  },
};

/** A flagged choice gated on a box only a game can check, so the first attempt skips it. */
const chooseLate: CampaignInstruction = {
  id: "first.setup.late",
  text: "test",
  citation: "test",
  when: { kind: "fieldIsSet", field: "unlocked" },
  step: {
    kind: "betweenGames",
    ops: [
      {
        kind: "choose",
        slot: "late",
        chooser: "group",
        from: { kind: "fieldOptions", field: "tone" },
        repeatOnRetry: true,
      },
    ],
  },
};

/** A flagged choice over cards, which a removal from the campaign can take out of the options. */
const chooseRelic: CampaignInstruction = {
  id: "first.setup.relic",
  text: "test",
  citation: "test",
  step: {
    kind: "betweenGames",
    ops: [
      {
        kind: "choose",
        slot: "relic",
        chooser: "group",
        from: { kind: "cards", cardIds: [RELIC_A, RELIC_B] },
        repeatOnRetry: true,
      },
    ],
  },
};

function definitionWith(firstSetup: readonly CampaignInstruction[]): CampaignDefinition {
  const shared = (id: string, type: CampaignDefinition["logFields"][number]["type"]) => ({
    id,
    label: id,
    scope: "shared" as const,
    type,
    citation: "test",
  });
  return {
    campaignId: CAMPAIGN_ID,
    version: "1",
    logFields: [
      shared("chosen", { kind: "strikeList", options: SCHEMES }),
      shared("firstScheme", { kind: "choice", options: SCHEMES }),
      shared("secondScheme", { kind: "choice", options: SCHEMES }),
      shared("tone", { kind: "choice", options: TONES }),
      shared("unlocked", { kind: "flag" }),
      { ...shared("badge", { kind: "choice", options: BADGES }), scope: "perSeat" as const },
    ],
    loss: { retry: "free", retryBaseline: "nodeStart" },
    graph: {
      kind: "linear",
      nodes: [
        {
          id: "first",
          label: "First",
          scenario: { kind: "fixed", scenarioId: SCENARIO },
          setup: firstSetup,
          victory: [],
        },
        {
          id: "second",
          label: "Second",
          scenario: { kind: "fixed", scenarioId: SCENARIO },
          setup: [chooseScheme("second")],
          victory: [],
        },
      ],
    },
  };
}

const DEFINITION = definitionWith([chooseScheme("first"), chooseTone, chooseBadge]);

const newLog = (definition: CampaignDefinition = DEFINITION): CampaignLog =>
  createCampaignLog(definition, { id: "run", seats: SEATS, modes: MODES, poolVersion: "test", seed: 7 });

const answer = (
  instructionId: string,
  slot: string,
  picked: string,
  seatNumber: number | null = null,
): CampaignChoiceAnswer => ({ instructionId, slot, seatNumber, picked: [picked] });

const FIRST_SCRIPT: readonly CampaignChoiceAnswer[] = [
  answer("first.setup.scheme", "scheme", "south"),
  answer("first.setup.tone", "tone", "loud"),
  answer("first.setup.badge", "badge", "x", 1),
  answer("first.setup.badge", "badge", "y", 2),
];

interface Settled {
  readonly log: CampaignLog;
  /** Every choice the runner raised, in order: what a client would have shown. */
  readonly asked: readonly CampaignPendingChoice[];
}

/** A scripted caller. An unscripted choice fails loudly rather than being answered arbitrarily. */
function settle(
  step: (answers: readonly CampaignChoiceAnswer[]) => ReturnType<typeof resolveBetweenGames>,
  script: readonly CampaignChoiceAnswer[],
): Settled {
  const asked: CampaignPendingChoice[] = [];
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 16; guard++) {
    const outcome = step(answers);
    if (outcome.kind === "done") return { log: outcome.value, asked };
    const found = script.find((entry) => campaignChoiceKey(entry) === campaignChoiceKey(outcome.choice));
    if (!found) throw new Error(`the script has no answer for ${campaignChoiceKey(outcome.choice)}`);
    asked.push(outcome.choice);
    answers.push(found);
  }
  throw new Error("the runner asked for more than 16 choices in one step list");
}

const between = (
  log: CampaignLog,
  script: readonly CampaignChoiceAnswer[],
  definition: CampaignDefinition = DEFINITION,
): Settled => settle((answers) => resolveBetweenGames(definition, log, DEPS, MODES, answers), script);

function finish(
  log: CampaignLog,
  outcome: "won" | "lost",
  over: Partial<CampaignGameResult> = {},
  definition: CampaignDefinition = DEFINITION,
): CampaignLog {
  const result: CampaignGameResult = {
    nodeId: log.attempt?.nodeId ?? "",
    outcome,
    records: [],
    removedFromCampaign: [],
    logWrites: [],
    expiringGrants: [],
    ...over,
  };
  const applied = applyCampaignResult(definition, log, result, { at: 1_700_000_000_000 }, DEPS);
  if (applied.kind !== "done") throw new Error("unexpected pending choice after the game");
  return applied.value;
}

const askedKeys = (settled: Settled): readonly string[] =>
  settled.asked.map((entry) => `${entry.instructionId}/${entry.seatNumber ?? "group"}`);

/** The choices an attempt's setup traced for one instruction. */
const tracedChoices = (log: CampaignLog, instructionId: string): readonly CampaignChoiceRecord[] =>
  (log.attempt?.steps ?? []).find((step) => step.instructionId === instructionId)?.choices ?? [];

const option = (value: string): LogValue => ({ kind: "choice", option: value });

describe("CampaignOp choose.repeatOnRetry (MC40 p. 7)", () => {
  it("asks on the first attempt, and traces an ordinary pick", () => {
    const first = between(newLog(), FIRST_SCRIPT);

    expect(askedKeys(first)).toEqual([
      "first.setup.scheme/group",
      "first.setup.tone/group",
      "first.setup.badge/1",
      "first.setup.badge/2",
    ]);
    expect(first.asked[0]?.options).toEqual(SCHEMES);
    expect(tracedChoices(first.log, "first.setup.scheme")).toEqual([
      { slot: "scheme", seatNumber: null, picked: ["south"] },
    ]);
    expect(first.log.shared.firstScheme).toEqual(option("south"));
  });

  it("does not ask on the retry of a lost node: same pick, traced as repeated, and the ops after it run again", () => {
    const first = between(newLog(), FIRST_SCRIPT);
    const lost = finish(first.log, "lost");
    // The loss rolled the pick back (`retryBaseline: "nodeStart"`); only the history remembers it.
    expect(lost.shared.firstScheme).toBeUndefined();
    expect(lost.shared.chosen).toBeUndefined();

    // The retry's caller even offers a different scheme: it is never asked, so the answer is never read.
    const retry = between(lost, [
      answer("first.setup.scheme", "scheme", "east"),
      answer("first.setup.tone", "tone", "quiet"),
    ]);

    expect(askedKeys(retry)).toEqual(["first.setup.tone/group"]);
    expect(tracedChoices(retry.log, "first.setup.scheme")).toEqual([
      { slot: "scheme", seatNumber: null, picked: ["south"], repeated: true },
    ]);
    expect(retry.log.shared.firstScheme).toEqual(option("south"));
    expect(retry.log.shared.chosen).toEqual({ kind: "strikeList", struck: ["south"] });
    // Each seat's own pick is found by seat.
    expect(tracedChoices(retry.log, "first.setup.badge")).toEqual([
      { slot: "badge", seatNumber: 1, picked: ["x"], repeated: true },
      { slot: "badge", seatNumber: 2, picked: ["y"], repeated: true },
    ]);
    expect(retry.log.seats.map((seat) => seat.fields.badge)).toEqual([option("x"), option("y")]);
  });

  it("supplies the same answer to a caller that passes no answers at all for the flagged choices", () => {
    const lost = finish(between(newLog(), FIRST_SCRIPT).log, "lost");
    const outcome = resolveBetweenGames(DEFINITION, lost, DEPS, MODES, []);
    // The first thing a retry stops on is the unflagged choice, not the scheme.
    expect(outcome.kind === "pending" && outcome.choice.instructionId).toBe("first.setup.tone");
  });

  it("asks again on a retry without the flag, and takes the new answer", () => {
    const lost = finish(between(newLog(), FIRST_SCRIPT).log, "lost");
    const retry = between(lost, [answer("first.setup.tone", "tone", "quiet")]);

    expect(askedKeys(retry)).toContain("first.setup.tone/group");
    expect(tracedChoices(retry.log, "first.setup.tone")).toEqual([
      { slot: "tone", seatNumber: null, picked: ["quiet"] },
    ]);
    expect(retry.log.shared.tone).toEqual(option("quiet"));
  });

  it("reads the latest attempt after two losses", () => {
    const lostOnce = finish(between(newLog(), FIRST_SCRIPT).log, "lost");
    const tone = [answer("first.setup.tone", "tone", "loud")];
    const lostTwice = finish(between(lostOnce, tone).log, "lost");
    expect(lostTwice.history.map((entry) => entry.outcome)).toEqual(["lost", "lost"]);

    const third = between(lostTwice, tone);

    expect(askedKeys(third)).toEqual(["first.setup.tone/group"]);
    expect(tracedChoices(third.log, "first.setup.scheme")).toEqual([
      { slot: "scheme", seatNumber: null, picked: ["south"], repeated: true },
    ]);
  });

  it("asks afresh at a different node, without what an earlier node chose", () => {
    const lost = finish(between(newLog(), FIRST_SCRIPT).log, "lost");
    const wonFirst = finish(between(lost, [answer("first.setup.tone", "tone", "loud")]).log, "won");
    expect(wonFirst.position.nextNodeId).toBe("second");

    const second = between(wonFirst, [answer("second.setup.scheme", "scheme", "north")]);

    expect(askedKeys(second)).toEqual(["second.setup.scheme/group"]);
    // "… that has not been chosen previously" (MC40 pp. 11, 14, 16, 18): the strike list, not the flag.
    expect(second.asked[0]?.options).toEqual(["north", "east"]);
    expect(tracedChoices(second.log, "second.setup.scheme")).toEqual([
      { slot: "scheme", seatNumber: null, picked: ["north"] },
    ]);

    // And a loss there repeats that node's own pick, not the first node's.
    const retry = between(finish(second.log, "lost"), []);
    expect(retry.asked).toEqual([]);
    expect(tracedChoices(retry.log, "second.setup.scheme")).toEqual([
      { slot: "scheme", seatNumber: null, picked: ["north"], repeated: true },
    ]);
    expect(retry.log.shared.chosen).toEqual({ kind: "strikeList", struck: ["south", "north"] });
  });

  it("survives a JSON round trip mid-retry: before the retry is composed, and with it composed", () => {
    const lost = finish(between(newLog(), FIRST_SCRIPT).log, "lost");
    const tone = [answer("first.setup.tone", "tone", "quiet")];
    const direct = between(lost, tone);

    const reloaded = between(JSON.parse(JSON.stringify(lost)) as CampaignLog, tone);
    expect(reloaded.log).toEqual(direct.log);
    expect(askedKeys(reloaded)).toEqual(["first.setup.tone/group"]);

    const composed = JSON.parse(JSON.stringify(direct.log)) as CampaignLog;
    expect(composed).toEqual(direct.log);
    expect(finish(composed, "won")).toEqual(finish(direct.log, "won"));
  });

  it("needs no new log state: a history written before the flag existed is all a retry reads", () => {
    const lost = finish(between(newLog(), FIRST_SCRIPT).log, "lost");
    // A lost attempt's own trace carries no `repeated` mark, which is every history entry an older save holds.
    expect(JSON.stringify(lost.history)).not.toContain("repeated");
    expect(Object.keys(lost).sort()).toEqual(Object.keys(newLog()).sort());
  });

  it("asks when the lost attempt never made the choice: there is nothing to repeat", () => {
    const definition = definitionWith([chooseLate]);
    const first = between(newLog(definition), [], definition);
    expect(first.log.attempt?.steps[0]?.skipped).toBe("condition");
    // The lost game checks the box (an in-game log write survives the loss), so the retry reaches the choice.
    const lost = finish(
      first.log,
      "lost",
      { logWrites: [{ field: "unlocked", seatNumber: null, mode: "set", value: { kind: "flag", value: true } }] },
      definition,
    );

    const retry = between(lost, [answer("first.setup.late", "late", "quiet")], definition);

    expect(askedKeys(retry)).toEqual(["first.setup.late/group"]);
    expect(tracedChoices(retry.log, "first.setup.late")).toEqual([
      { slot: "late", seatNumber: null, picked: ["quiet"] },
    ]);
  });

  it("fails loudly, and does not ask again, when the recorded pick is no longer an option", () => {
    const definition = definitionWith([chooseRelic]);
    const first = between(newLog(definition), [answer("first.setup.relic", "relic", RELIC_A)], definition);
    // RRG 1.8 p. 29: a removal from the campaign survives the retry, so the option is gone.
    const lost = finish(first.log, "lost", { removedFromCampaign: [{ cardId: RELIC_A }] }, definition);

    expect(() =>
      resolveBetweenGames(definition, lost, DEPS, MODES, [answer("first.setup.relic", "relic", RELIC_B)]),
    ).toThrow(/must repeat "relic-a" on this retry of first, which is no longer one of its options/);
  });
});
