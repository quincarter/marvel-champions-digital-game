/**
 * docs/phase7-wave11-scenarios.md E30: `LossPolicy.retryBaseline: "keepLog"`.
 *
 * MC60 p. 8: losing a scenario "does not automatically cause it to fail and it may be able to be attempted again", and
 * every underling DEFEAT block ends "Go to 'Campaign Setup' on page 9": a lost game keeps the log as it stood (the
 * progression marks drawn for it, the villain recorded for it), its DEFEAT block goes on top, and the campaign setup
 * runs again, two new draws and a new choice of scenario included. `"nodeStart"` (every other box) is unchanged.
 */
import { describe, expect, it } from "vitest";
import { campaignId, cardId, scenarioId, type PlayModes } from "@mc/content";
import type {
  CampaignDefinition,
  CampaignGameResult,
  CampaignGraph,
  CampaignInstruction,
  CampaignLog,
  CampaignNode,
  CampaignOp,
  LossPolicy,
} from "../campaign.js";
import {
  CAMPAIGN_NEXT_NODE_INSTRUCTION,
  applyCampaignResult,
  createCampaignLog,
  resolveBetweenGames,
  type CampaignChoiceAnswer,
  type CampaignDeps,
} from "./runner.js";

const CAMPAIGN_ID = campaignId("keep-log-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID } };
const DEPS: CampaignDeps = { pool: [] };

const between = (id: string, ops: readonly CampaignOp[]): CampaignInstruction => ({
  id,
  text: "test",
  citation: "test",
  step: { kind: "betweenGames", ops },
});

/** A node whose composition records a value beside it once (MC60 p. 9 step 5a: "If there is already a villain"). */
const node = (id: string): CampaignNode => ({
  id,
  label: id,
  scenario: { kind: "fixed", scenarioId: scenarioId(`${id}-scenario`) },
  composition: [
    between(`t.${id}.record`, [
      {
        kind: "if",
        when: { kind: "not", of: { kind: "fieldIsSet", field: `villain.${id}` } },
        then: [
          { kind: "random", slot: "villain", from: { kind: "fieldOptions", field: `villain.${id}` } },
          { kind: "setField", field: `villain.${id}`, value: { kind: "choice", slot: "villain" } },
        ],
      },
    ]),
  ],
  setup: [],
  victory: [],
  defeat: [between(`t.${id}.defeat`, [{ kind: "progressNode", node: { kind: "const", value: id } }])],
});

const NODES = ["a", "b", "c"];

const choiceGraph: CampaignGraph = {
  kind: "choice",
  available: { kind: "and", of: [] },
  nodes: [...NODES.map(node), { ...node("finale"), composition: [], defeat: [] }],
  finale: { nodeId: "finale", when: { kind: "and", of: NODES.map((nodeId) => ({ kind: "nodeResolved", nodeId })) } },
  progressToFail: 3,
  // One draw among the unresolved underlings, progressed once (MC60 p. 9 steps 2 and 3, with one draw).
  beforeChoice: [
    between("t.draw", [
      {
        kind: "random",
        slot: "draw",
        from: {
          kind: "excludingTitles",
          from: { kind: "nodes", filter: "unresolved" },
          titlesIn: { kind: "const", value: "finale" },
        },
      },
      { kind: "progressNode", node: { kind: "choice", slot: "draw" } },
    ]),
  ],
};

const definitionWith = (loss: LossPolicy, graph: CampaignGraph = choiceGraph): CampaignDefinition => ({
  campaignId: CAMPAIGN_ID,
  version: "1",
  logFields: [...NODES, "finale"].map((id) => ({
    id: `villain.${id}`,
    label: id,
    scope: "shared" as const,
    type: { kind: "choice" as const, options: ["x", "y", "z", "w"] },
    citation: "t",
  })),
  loss,
  graph,
});

const KEEP = definitionWith({ retry: "byInstruction", retryBaseline: "keepLog" });
const NODE_START = definitionWith({ retry: "byInstruction", retryBaseline: "nodeStart" });

const newLog = (definition: CampaignDefinition): CampaignLog =>
  createCampaignLog(definition, {
    id: "run",
    seats: [
      {
        seatNumber: 1,
        identityCardId: cardId("hero"),
        deck: { identityCardId: cardId("hero"), aspects: [], cards: [] },
      },
    ],
    modes: MODES,
    poolVersion: "t",
    seed: 7,
  });

/** Composes, answering the node choice with `pick` (the first option by default); `offered` collects each offer. */
function compose(
  definition: CampaignDefinition,
  log: CampaignLog,
  pick: (options: readonly string[]) => string = (options) => options[0]!,
  offered: string[][] = [],
): CampaignLog {
  const answers: CampaignChoiceAnswer[] = [];
  for (let round = 0; round < 5; round++) {
    const result = resolveBetweenGames(definition, log, DEPS, MODES, answers);
    if (result.kind === "done") return result.value;
    expect(result.choice.instructionId).toBe(CAMPAIGN_NEXT_NODE_INSTRUCTION);
    offered.push([...result.choice.options]);
    answers.push({ ...result.choice, picked: [pick(result.choice.options)] });
  }
  throw new Error("a campaign choice kept coming");
}

const lose = (definition: CampaignDefinition, log: CampaignLog): CampaignLog => {
  const result: CampaignGameResult = {
    nodeId: log.attempt!.nodeId,
    outcome: "lost",
    records: [],
    removedFromCampaign: [],
    logWrites: [],
    expiringGrants: [],
  };
  const applied = applyCampaignResult(definition, log, result, { at: 1 }, DEPS);
  if (applied.kind !== "done") throw new Error("the loss asked a question");
  return applied.value;
};

describe('LossPolicy.retryBaseline "keepLog" (E30; MC60 pp. 8, 9)', () => {
  it("keeps the lost attempt's draws and records, adds the DEFEAT block, and goes back to the choice", () => {
    const composed = compose(KEEP, newLog(KEEP), () => "b");
    expect(composed.attempt!.nodeId).toBe("b");
    const villain = composed.shared["villain.b"];
    expect(villain?.kind).toBe("choice");
    const lost = lose(KEEP, composed);

    // The draw's mark stays, the DEFEAT block's goes on top of it, and so does the villain recorded for "b".
    const drawn = composed.position.progress;
    expect(lost.position.progress).toEqual({ ...drawn, b: (drawn["b"] ?? 0) + 1 });
    expect(lost.shared["villain.b"]).toEqual(villain);
    // Nothing is rolled back, the RNG included: the next draws are new ones.
    expect(lost.rng).toEqual(composed.rng);
    expect(lost.position.nextNodeId).toBeNull();
    expect(lost.status).toBe("active");
    expect(lost.history.at(-1)!.outcome).toBe("lost");
  });

  it("the next composition draws again and offers the scenario choice again; 5a then reads the kept record", () => {
    const composed = compose(KEEP, newLog(KEEP), () => "b");
    const lost = lose(KEEP, composed);
    const offered: string[][] = [];
    const again = compose(KEEP, lost, () => "b", offered);
    expect(offered).toEqual([["a", "b", "c"]]);
    const marks = (log: CampaignLog) => Object.values(log.position.progress).reduce((sum, n) => sum + n, 0);
    expect(marks(again)).toBe(marks(lost) + 1);
    expect(again.shared["villain.b"]).toEqual(composed.shared["villain.b"]);
    // A different scenario may be picked this time.
    expect(compose(KEEP, lost, () => "c").attempt!.nodeId).toBe("c");
  });

  it("a scenario the DEFEAT block Fails is not offered again", () => {
    // No draw, so the only mark the game adds is the DEFEAT block's.
    const noDraw = definitionWith(KEEP.loss, { ...choiceGraph, beforeChoice: [] });
    const base = newLog(noDraw);
    const marked: CampaignLog = { ...base, position: { ...base.position, progress: { a: 2 } } };
    const composed = compose(noDraw, marked, () => "a");
    const lost = lose(noDraw, composed);
    expect(lost.position.resolved["a"]).toBe("failed");
    const offered: string[][] = [];
    compose(noDraw, lost, (options) => options[0]!, offered);
    expect(offered).toEqual([["b", "c"]]);
  });

  it('"nodeStart" is unchanged: the log and the RNG are restored and the same node is replayed', () => {
    const composed = compose(NODE_START, newLog(NODE_START), () => "b");
    const lost = lose(NODE_START, composed);
    expect(lost.shared["villain.b"]).toBeUndefined();
    expect(lost.rng).toEqual(composed.attempt!.logBefore.rng);
    expect(lost.position.nextNodeId).toBe("b");
    expect(lost.position.progress).toEqual({
      ...composed.attempt!.logBefore.position.progress,
      b: (composed.attempt!.logBefore.position.progress["b"] ?? 0) + 1,
    });
  });

  it("a linear graph under keepLog replays the node, its records kept", () => {
    const linear = definitionWith(
      { retry: "byInstruction", retryBaseline: "keepLog" },
      { kind: "linear", nodes: NODES.map(node) },
    );
    const composed = compose(linear, newLog(linear));
    expect(composed.attempt!.nodeId).toBe("a");
    const lost = lose(linear, composed);
    expect(lost.position.nextNodeId).toBe("a");
    expect(lost.shared["villain.a"]).toEqual(composed.shared["villain.a"]);
    expect(lost.position.progress).toEqual({ a: 1 });
  });
});
