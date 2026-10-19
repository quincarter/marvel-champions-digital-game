/**
 * `FNE_CAMPAIGN_DEFINITION` (Fear No Evil, MC60): the definition is well formed against the real `@mc/content` records,
 * and the campaign runner does what MC60 p. 9 (steps 1 to 14) and each scenario's VICTORY / DEFEAT block print.
 * Runner-level: the log, the position and the composed game input. The games the composed input starts are
 * `fne.game.test.ts`'s.
 */
import { describe, expect, it } from "vitest";
import { CORE_STARTER_DECKS, FNE_CAMPAIGN, FNE_SCENARIOS, PLAYABLE_CARDS, cardId, type PlayModes } from "@mc/content";
import {
  CAMPAIGN_NEXT_NODE_INSTRUCTION,
  applyCampaignResult,
  createCampaignLog,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignChoiceAnswer,
  type CampaignGameResult,
  type CampaignInstruction,
  type CampaignLog,
  type CampaignSeatSetup,
  type LogValue,
  type LogWrite,
} from "@mc/engine";
import { action } from "../dsl/abilities.js";
import { validateDefinition } from "../dsl/validate.js";
import { CAMPAIGNS, campaignDefinitionOf } from "./index.js";
import {
  FNE_CAMPAIGN_DEFINITION as DEF,
  FNE_ENVIRONMENTS,
  FNE_FINALE_NODE,
  FNE_FIRST_PLAYTHROUGH,
  FNE_LATER_PLAYTHROUGH,
  FNE_UNDERLING_NODES,
  completedField,
  villainField,
} from "./fne.js";

const DEPS = { pool: PLAYABLE_CARDS };
const FNE_VILLAIN_IDS = ["bullseye", "electro", "hammerhead", "purple_man", "typhoid_mary"];
const STANDARD: PlayModes = { campaign: { campaignId: DEF.campaignId } };
const EXPERT: PlayModes = { campaign: { campaignId: DEF.campaignId, expertCampaign: true }, expert: true };
const [AMH, GETAWAY, RACKET, RAFT, PRESSES] = FNE_UNDERLING_NODES as [string, string, string, string, string];
const KINGPIN = FNE_FINALE_NODE;

// ---------------------------------------------------------------------------------------------------------------
// Logs, answers and results
// ---------------------------------------------------------------------------------------------------------------

const DAREDEVIL_ALLY = cardId("60039");

const seatOf = (starterDeckId: string, seatNumber: number, extra: readonly string[] = []): CampaignSeatSetup => {
  const starter = CORE_STARTER_DECKS.find((deck) => (deck.id as string) === starterDeckId)!;
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: {
      identityCardId: starter.identityCardId,
      aspects: starter.aspects,
      cards: [...starter.cards, ...extra.map((id) => ({ cardId: cardId(id), quantity: 1 }))],
    },
  };
};
const SEATS = [seatOf("core-spider-man-justice", 1), seatOf("core-captain-marvel-leadership", 2, ["60039"])];

const newLog = (modes: PlayModes = STANDARD, seed = 11): CampaignLog =>
  createCampaignLog(DEF, { id: `fne-${seed}`, seats: SEATS, modes, poolVersion: "test", seed });

type Picker = (choice: { readonly slot: string; readonly options: readonly string[] }) => string;

/** Resolves the between-games steps, answering every pending choice with `pick` (the first option by default). */
function compose(log: CampaignLog, pick: Picker = (c) => c.options[0]!, asked: string[] = []): CampaignLog {
  const answers: CampaignChoiceAnswer[] = [];
  for (let round = 0; round < 40; round++) {
    const result = resolveBetweenGames(DEF, log, DEPS, log.modes, answers);
    if (result.kind === "done") return result.value;
    const choice = result.choice;
    asked.push(choice.slot);
    answers.push({
      instructionId: choice.instructionId,
      slot: choice.slot,
      seatNumber: choice.seatNumber,
      picked: [pick(choice)],
    });
  }
  throw new Error("a campaign choice kept coming");
}

/** Composes with the first-playthrough answer, and the node (when asked) named. */
const playing =
  (node: string, first = true): Picker =>
  (choice) => {
    if (choice.slot === "playthrough") return first ? FNE_FIRST_PLAYTHROUGH : FNE_LATER_PLAYTHROUGH;
    if (choice.slot === "node") return node;
    return choice.options[0]!;
  };

const flag = (value: boolean): LogValue => ({ kind: "flag", value });
const write = (field: string, value: LogValue, mode: LogWrite["mode"] = "set", seatNumber: number | null = null) => ({
  field,
  seatNumber,
  mode,
  value,
});

/** A game result as the campaign takes it: the `record` instructions' writes are supplied, as a real game would compute. */
function result(
  log: CampaignLog,
  outcome: "won" | "lost",
  records: readonly { instructionId: string; write: LogWrite }[] = [],
): CampaignGameResult {
  return {
    nodeId: log.attempt!.nodeId,
    outcome,
    records,
    removedFromCampaign: [],
    logWrites: [],
    expiringGrants: [],
  };
}

function finish(
  log: CampaignLog,
  outcome: "won" | "lost",
  records: readonly { instructionId: string; write: LogWrite }[] = [],
  answers: readonly CampaignChoiceAnswer[] = [],
): ReturnType<typeof applyCampaignResult> {
  return applyCampaignResult(DEF, log, result(log, outcome, records), { at: 1 }, DEPS, answers);
}

function finished(
  log: CampaignLog,
  outcome: "won" | "lost",
  records: readonly { instructionId: string; write: LogWrite }[] = [],
): CampaignLog {
  const applied = finish(log, outcome, records);
  if (applied.kind !== "done") throw new Error(`unexpected pending choice ${applied.choice.slot}`);
  return applied.value;
}

/** The log as it stands with these nodes already resolved (and nothing else changed). */
function withResolved(
  log: CampaignLog,
  resolved: Readonly<Record<string, "completed" | "failed">>,
  shared: Readonly<Record<string, LogValue>> = {},
): CampaignLog {
  return {
    ...log,
    position: { ...log.position, resolved: { ...log.position.resolved, ...resolved } },
    shared: { ...log.shared, ...shared },
  };
}

const instructionIds = (log: CampaignLog): string[] => log.attempt!.input.instructions.map((i) => i.instructionId);
const setAside = (log: CampaignLog): string[] => (log.attempt!.input.setAsideCards ?? []).map((id) => id as string);
const sharedFlag = (log: CampaignLog, field: string): boolean => {
  const value = log.shared[field];
  return value?.kind === "flag" && value.value;
};
const struck = (log: CampaignLog): readonly string[] => {
  const value = log.shared["unrecordedVillains"];
  return value?.kind === "strikeList" ? value.struck : [];
};
const villainOf = (log: CampaignLog, node: string): string | undefined => {
  const value = log.shared[villainField(node)];
  return value?.kind === "choice" ? value.option : undefined;
};

/** Every instruction in the definition, the node blocks and the box-wide lists included. */
function everyInstruction(): readonly CampaignInstruction[] {
  const graph = DEF.graph;
  if (graph.kind !== "choice") throw new Error("expected a choice graph");
  return [
    ...graph.beforeChoice,
    ...(DEF.everyNodeSetup ?? []),
    ...(DEF.everyNodeVictory ?? []),
    ...(DEF.loss.everyNodeDefeat ?? []),
    ...graph.nodes.flatMap((node) => [
      ...(node.composition ?? []),
      ...node.setup,
      ...node.victory,
      ...(node.defeat ?? []),
    ]),
  ];
}

/** Every `field: string` a step reads or writes, found structurally so no shape has to be enumerated. */
function fieldsIn(value: unknown, found: Set<string> = new Set()): ReadonlySet<string> {
  if (Array.isArray(value)) {
    for (const item of value) fieldsIn(item, found);
  } else if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.field === "string") found.add(record.field);
    for (const v of Object.values(record)) fieldsIn(v, found);
  }
  return found;
}

// ---------------------------------------------------------------------------------------------------------------
// The definition
// ---------------------------------------------------------------------------------------------------------------

describe("FNE_CAMPAIGN_DEFINITION: shape", () => {
  it("is registered, and its id and loss policy are the box's", () => {
    expect(campaignDefinitionOf("fne")).toBe(DEF);
    expect(CAMPAIGNS["fne"]).toBe(DEF);
    expect(DEF.campaignId).toBe(FNE_CAMPAIGN.id);
    expect(DEF.version).toBe("1");
    expect(DEF.loss).toMatchObject({
      retry: "byInstruction",
      retryBaseline: "keepLog",
      citation: "MC60 pp. 8, 9, 13, 23",
    });
    expect(DEF.elimination).toMatchObject({ id: "mc60.elimination", whenModes: { expertCampaign: true } });
  });

  it("is a choice graph of the six scenarios in log order, three marks to fail, always available, Kingpin the finale", () => {
    const graph = DEF.graph;
    expect(graph.kind).toBe("choice");
    if (graph.kind !== "choice") return;
    expect(graph.nodes.map((node) => node.id)).toEqual(FNE_CAMPAIGN.scenarioIds.map((id) => id as string));
    expect(graph.nodes.map((node) => node.id)).toEqual([AMH, GETAWAY, RACKET, RAFT, PRESSES, KINGPIN]);
    expect(graph.progressToFail).toBe(3);
    expect(graph.available).toEqual({ kind: "and", of: [] });
    expect(graph.finale?.nodeId).toBe(KINGPIN);
    expect(graph.finale?.when).toEqual({
      kind: "and",
      of: [AMH, GETAWAY, RACKET, RAFT, PRESSES].map((nodeId) => ({ kind: "nodeResolved", nodeId })),
    });
    expect(graph.beforeChoice.map((i) => i.id)).toEqual([
      "mc60.choice.playthrough",
      "mc60.choice.draw",
      "mc60.choice.progress",
    ]);
  });

  it("every node plays the scenario record of its own id", () => {
    const graph = DEF.graph;
    if (graph.kind !== "choice") throw new Error("expected a choice graph");
    for (const node of graph.nodes) {
      expect(node.scenario.kind).toBe("fixed");
      if (node.scenario.kind !== "fixed") continue;
      const scenarioId = node.scenario.scenarioId;
      expect(scenarioId as string, node.id).toBe(node.id);
      expect(
        FNE_SCENARIOS.some((scenario) => scenario.id === scenarioId),
        node.id,
      ).toBe(true);
    }
  });

  it("every instruction id is unique and prefixed 'mc60.', and cites 'MC60 p. N'", () => {
    const instructions = everyInstruction();
    const ids = instructions.map((instruction) => instruction.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const instruction of instructions) {
      expect(instruction.id.startsWith("mc60."), instruction.id).toBe(true);
      expect(instruction.citation, instruction.id).toMatch(/^MC60 pp?\. \d+/);
    }
    for (const field of DEF.logFields) expect(field.citation, field.id).toMatch(/^MC60 p\. \d+$/);
  });

  it("every field a step reads or writes is declared, and every declared field is used", () => {
    const declared = new Set(DEF.logFields.map((field) => field.id));
    const referenced = new Set<string>();
    for (const instruction of everyInstruction()) fieldsIn(instruction.step, referenced);
    // The finale's and the draws' predicates read fields through `when`, not a step.
    for (const instruction of everyInstruction()) if (instruction.when) fieldsIn(instruction.when, referenced);
    for (const field of referenced) expect(declared.has(field), `${field} is not declared`).toBe(true);
    for (const field of DEF.logFields) expect(referenced.has(field.id), `${field.id} is never used`).toBe(true);
  });

  it("every in-game instruction's effects pass the DSL validator", () => {
    for (const instruction of everyInstruction()) {
      if (instruction.step.kind !== "inGame") continue;
      expect(validateDefinition(action(...instruction.step.effects)), instruction.id).toEqual([]);
    }
  });

  it("every literal card id a step names is in the pool", () => {
    const pool = new Set(PLAYABLE_CARDS.map((card) => card.id as string));
    const named = new Set<string>(Object.values(FNE_ENVIRONMENTS));
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value !== null && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (record.kind === "setAsideCards" && Array.isArray(record.cards)) {
          for (const card of record.cards as { kind: string; value: unknown }[])
            if (card.kind === "const") named.add(card.value as string);
        }
        Object.values(record).forEach(walk);
      }
    };
    for (const instruction of everyInstruction()) walk(instruction.step);
    expect(named.size).toBeGreaterThanOrEqual(5 + 1 + 6 + 4);
    for (const id of named) expect(pool.has(id), id).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Steps 1 to 4: the draw, the progression and the choice
// ---------------------------------------------------------------------------------------------------------------

describe("campaign setup steps 1 to 4 (MC60 p. 9)", () => {
  it("asks the first-playthrough question once, then draws two scenarios and marks each once", () => {
    const asked: string[] = [];
    const composed = compose(newLog(), playing(AMH), asked);
    expect(asked.filter((slot) => slot === "playthrough")).toHaveLength(1);
    const marks = composed.position.progress;
    const marked = Object.entries(marks).filter(([, count]) => count > 0);
    expect(marked).toHaveLength(2);
    expect(marked.every(([, count]) => count === 1)).toBe(true);
    expect(marked.every(([node]) => node !== KINGPIN)).toBe(true);
    // Asked on the first call only: the answer is in the log now.
    const next: string[] = [];
    compose(finished(composed, "won"), (c) => c.options[0]!, next);
    expect(next).not.toContain("playthrough");
  });

  it("offers every unresolved scenario but Kingpin, and a Completed or Failed one is not offered", () => {
    const log = withResolved(newLog(), { [AMH]: "completed", [GETAWAY]: "failed" });
    const offered: string[][] = [];
    compose(log, (choice) => {
      if (choice.slot === "node") offered.push([...choice.options]);
      return playing(RAFT)(choice);
    });
    expect(offered).toEqual([[RACKET, RAFT, PRESSES]]);
  });

  it("with one scenario left to draw, marks that one twice; a scenario already at two marks Fails on the third", () => {
    const log = withResolved(
      newLog(),
      { [AMH]: "completed", [GETAWAY]: "completed", [RACKET]: "completed", [RAFT]: "failed" },
      { playthrough: { kind: "choice", option: FNE_LATER_PLAYTHROUGH } },
    );
    const composed = compose(log);
    // Only Stop the Presses! is left: one environment drawn, so two boxes are marked, and it is the only choice.
    expect(composed.position.progress[PRESSES]).toBe(2);
    expect(composed.attempt!.nodeId).toBe(PRESSES);
    const marked = compose({ ...log, position: { ...log.position, progress: { [PRESSES]: 1 } } });
    expect(marked.position.resolved[PRESSES]).toBe("failed");
    // Failed by the draw, so every scenario is resolved and the finale is the only game left.
    expect(marked.attempt!.nodeId).toBe(KINGPIN);
  });

  it("step 4: with every scenario Completed or Failed the players must play Kingpin, and no draw marks anything", () => {
    const log = withResolved(newLog(), {
      [AMH]: "completed",
      [GETAWAY]: "failed",
      [RACKET]: "completed",
      [RAFT]: "completed",
      [PRESSES]: "failed",
    });
    const asked: string[] = [];
    const composed = compose(log, playing(KINGPIN), asked);
    expect(composed.attempt!.nodeId).toBe(KINGPIN);
    expect(asked).not.toContain("node");
    expect(composed.position.progress).toEqual({});
  });

  it("Kingpin is never offered while another scenario is unresolved", () => {
    const log = withResolved(newLog(), {
      [AMH]: "completed",
      [GETAWAY]: "completed",
      [RACKET]: "completed",
      [RAFT]: "completed",
    });
    const offered: string[][] = [];
    compose(log, (choice) => {
      if (choice.slot === "node") offered.push([...choice.options]);
      return playing(PRESSES)(choice);
    });
    // One scenario left: it is simply played, and the node choice is never asked (nor Kingpin offered).
    expect(offered).toEqual([]);
    const composed = compose(log);
    expect(composed.attempt!.nodeId).toBe(PRESSES);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Step 5: the villain
// ---------------------------------------------------------------------------------------------------------------

describe("campaign setup step 5: the villain (MC60 p. 9, p. 8)", () => {
  const firstTime = (log: CampaignLog): CampaignLog => ({
    ...log,
    shared: { ...log.shared, playthrough: { kind: "choice", option: FNE_FIRST_PLAYTHROUGH } },
  });

  it("first playthrough: Hammerhead, Bullseye, Electro in turn, recorded beside the scenario and struck from the list", () => {
    let log = firstTime(newLog());
    const order: string[] = [];
    for (let game = 0; game < 3; game++) {
      const unresolved = FNE_UNDERLING_NODES.filter((node) => log.position.resolved[node] === undefined);
      const composed = compose(log, (c) => (c.slot === "node" ? unresolved[0]! : c.options[0]!));
      const node = composed.attempt!.nodeId;
      order.push(startGameFromLog(DEF, composed).villain!);
      expect(villainOf(composed, node)).toBe(order[game]);
      expect(struck(composed)).toContain(order[game]);
      log = finished(composed, "won");
    }
    expect(order).toEqual(["hammerhead", "bullseye", "electro"]);
  });

  it("first playthrough, fourth game: the group chooses between Purple Man and Typhoid Mary", () => {
    const log = withResolved(
      firstTime(newLog()),
      { [AMH]: "completed", [GETAWAY]: "completed", [RACKET]: "completed" },
      {
        unrecordedVillains: { kind: "strikeList", struck: ["hammerhead", "bullseye", "electro"] },
        playthrough: { kind: "choice", option: FNE_FIRST_PLAYTHROUGH },
      },
    );
    const offered: string[][] = [];
    const composed = compose(log, (choice) => {
      if (choice.slot === "villain") {
        offered.push([...choice.options]);
        return "typhoid_mary";
      }
      return choice.options[0]!;
    });
    expect(offered).toEqual([["purple_man", "typhoid_mary"]]);
    expect(startGameFromLog(DEF, composed).villain).toBe("typhoid_mary");
    expect(struck(composed)).toContain("typhoid_mary");
  });

  it("later playthroughs draw an unrecorded villain at random, never one twice", () => {
    let log: CampaignLog = {
      ...newLog(STANDARD, 5),
      shared: { playthrough: { kind: "choice", option: FNE_LATER_PLAYTHROUGH } },
    };
    const seen: string[] = [];
    for (let game = 0; game < 5; game++) {
      const composed = compose(log);
      // The progression fails scenarios nobody played, so the finale can come before every villain has been met.
      if (composed.attempt!.nodeId === KINGPIN) break;
      seen.push(startGameFromLog(DEF, composed).villain!);
      log = finished(composed, "won");
    }
    expect(seen.length).toBeGreaterThanOrEqual(3);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.every((villain) => FNE_VILLAIN_IDS.includes(villain))).toBe(true);
    expect([...struck(log)].sort()).toEqual([...seen].sort());
  });

  it("a villain already listed for the scenario must be chosen (5a), and is not struck again", () => {
    const log = withResolved(
      newLog(),
      {},
      {
        playthrough: { kind: "choice", option: FNE_LATER_PLAYTHROUGH },
        [villainField(RAFT)]: { kind: "choice", option: "electro" },
        unrecordedVillains: { kind: "strikeList", struck: ["electro"] },
      },
    );
    const composed = compose(log, playing(RAFT, false));
    expect(composed.attempt!.nodeId).toBe(RAFT);
    expect(startGameFromLog(DEF, composed).villain).toBe("electro");
    expect(struck(composed)).toEqual(["electro"]);
  });

  it("the Kingpin scenario composes no villain", () => {
    const log = withResolved(newLog(), Object.fromEntries(FNE_UNDERLING_NODES.map((n) => [n, "completed" as const])));
    const composed = compose(log);
    expect(startGameFromLog(DEF, composed).villain).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Steps 8, 12 and 13: what the composed game is handed
// ---------------------------------------------------------------------------------------------------------------

describe("campaign setup steps 12 and 13: the environments and the Typhoid Mary ally", () => {
  const later = { playthrough: { kind: "choice", option: FNE_LATER_PLAYTHROUGH } } as const;

  it("sets aside and places one environment for each Completed or Failed scenario, on its face, in log order, then resolves their Setups (E31)", () => {
    const log = withResolved(newLog(), { [AMH]: "completed", [GETAWAY]: "failed", [RAFT]: "completed" }, later);
    const composed = compose(log, playing(RACKET, false));
    expect(composed.attempt!.nodeId).toBe(RACKET);
    expect(setAside(composed).filter((id) => /^6020\d/.test(id))).toEqual(["60205a", "60206a", "60208a"]);
    expect(instructionIds(composed).filter((id) => id.startsWith("mc60.setup.environment."))).toEqual([
      `mc60.setup.environment.${AMH}.completed`,
      `mc60.setup.environment.${GETAWAY}.failed`,
      `mc60.setup.environment.${RAFT}.completed`,
      "mc60.setup.environment.setups",
    ]);
    const windows = new Set(
      composed
        .attempt!.input.instructions.filter((i) => i.instructionId.startsWith("mc60.setup.environment."))
        .map((i) => i.window),
    );
    expect([...windows]).toEqual(["afterMulligans"]);
  });

  it("a scenario that is not resolved has no environment in its game", () => {
    const composed = compose(newLog(), playing(AMH));
    expect(setAside(composed).filter((id) => /^6020[5-9]/.test(id))).toEqual([]);
    expect(instructionIds(composed).some((id) => id.startsWith("mc60.setup.environment."))).toBe(false);
  });

  it("step 13: the Typhoid Mary ally only with 'Trust Established?' checked and 'Mary Defeated?' not", () => {
    const trust = { ...later, trustEstablished: flag(true) };
    const check = (shared: Record<string, LogValue>) => {
      const composed = compose(withResolved(newLog(), {}, shared), playing(GETAWAY, false));
      return {
        aside: setAside(composed).includes("60210a"),
        step: instructionIds(composed).includes("mc60.setup.typhoid-mary"),
      };
    };
    expect(check(later)).toEqual({ aside: false, step: false });
    expect(check(trust)).toEqual({ aside: true, step: true });
    expect(check({ ...trust, maryDefeated: flag(true) })).toEqual({ aside: false, step: false });
    expect(check({ ...later, maryDefeated: flag(true) })).toEqual({ aside: false, step: false });
  });

  it("step 13 comes after the environments and before the scenario's own SETUP, all after the mulligans", () => {
    const log = withResolved(newLog(), { [AMH]: "completed" }, { ...later, trustEstablished: flag(true) });
    const composed = compose(log, playing(RAFT, false));
    const ids = instructionIds(composed);
    expect(ids.indexOf(`mc60.setup.environment.${AMH}.completed`)).toBeLessThan(ids.indexOf("mc60.setup.typhoid-mary"));
    expect(ids.indexOf("mc60.setup.typhoid-mary")).toBeLessThan(ids.indexOf(`mc60.${RAFT}.setup`));
    for (const id of ["mc60.setup.typhoid-mary", `mc60.${RAFT}.setup`])
      expect(composed.attempt!.input.instructions.find((i) => i.instructionId === id)!.window).toBe("afterMulligans");
  });

  it("The Raft Breakout's six minions are set aside while that scenario is Failed, the Daily Bugle supports while Stop the Presses! is Completed", () => {
    const minions = (log: CampaignLog) => setAside(log).filter((id) => /^6014[4-9]$/.test(id));
    const supports = (log: CampaignLog) => setAside(log).filter((id) => /^6015[3-6]$/.test(id));
    const failedRaft = compose(withResolved(newLog(), { [RAFT]: "failed" }, later), playing(AMH, false));
    expect(minions(failedRaft)).toEqual(["60144", "60145", "60146", "60147", "60148", "60149"]);
    const completedRaft = compose(withResolved(newLog(), { [RAFT]: "completed" }, later), playing(AMH, false));
    expect(minions(completedRaft)).toEqual([]);

    const presses = compose(withResolved(newLog(), { [PRESSES]: "completed" }, later), playing(AMH, false));
    expect(supports(presses)).toEqual(["60153", "60154", "60155", "60156"]);
    const failedPresses = compose(withResolved(newLog(), { [PRESSES]: "failed" }, later), playing(AMH, false));
    expect(supports(failedPresses)).toEqual([]);
  });

  it("a Daily Bugle support whose title is recorded as removed is not set aside (Q203 = B)", () => {
    const log = withResolved(
      newLog(),
      { [PRESSES]: "completed" },
      { ...later, removedTitles: { kind: "cardList", cardIds: [cardId("60154"), cardId("60156")] } },
    );
    const composed = compose(log, playing(AMH, false));
    expect(setAside(composed).filter((id) => /^6015[3-6]$/.test(id))).toEqual(["60153", "60155"]);
  });
});

describe("campaign setup steps 10 and 11 (expert campaign only)", () => {
  const expertSteps = (log: CampaignLog) =>
    instructionIds(log).filter((id) => /^mc60\.setup\.(hp|heal|rejoin)$/.test(id));
  const hpRecords = (instructionId: string) => [
    { instructionId, write: write("remainingHp", { kind: "number", value: 7 }, "set", 1) },
    { instructionId, write: write("remainingHp", { kind: "number", value: 9 }, "set", 2) },
  ];

  it("the first game of an expert campaign has no previous scenario: no hit points set, no heal, no rejoin", () => {
    // With no record, setting hit points would put every hero at 0 (reviewer blocker 1).
    expect(expertSteps(compose(newLog(EXPERT), playing(AMH)))).toEqual([]);
  });

  it("sets hit points and heals only in an expert campaign, after a game, after the mulligans, hit points first", () => {
    const standard = compose(finished(compose(newLog(STANDARD), playing(AMH)), "won"), playing(GETAWAY));
    expect(expertSteps(standard)).toEqual([]);
    const first = compose(newLog(EXPERT), playing(AMH));
    const expert = compose(finished(first, "won", hpRecords("mc60.victory.hp")), playing(GETAWAY));
    const ids = instructionIds(expert);
    expect(ids.indexOf("mc60.setup.hp")).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf("mc60.setup.hp")).toBeLessThan(ids.indexOf("mc60.setup.heal"));
    expect(ids.indexOf("mc60.setup.heal")).toBeLessThan(ids.indexOf(`mc60.${GETAWAY}.setup`));
    const byId = new Map(expert.attempt!.input.instructions.map((i) => [i.instructionId, i]));
    expect(byId.get("mc60.setup.hp")!.window).toBe("afterMulligans");
    expect(byId.get("mc60.setup.heal")!.window).toBe("afterMulligans");
    // A defeated seat is asked to rejoin or sit out before the scenario is set up (owner decision 66B).
    expect(byId.get("mc60.setup.rejoin")!.window).toBe("beforeScenarioSetup");
    // Step 11's heal is a "may": a seat with hit points left is offered "Decline".
    expect(JSON.stringify(byId.get("mc60.setup.heal")!.effects)).toContain('"Decline"');
  });

  it("a lost first game is a previous scenario too: the next game sets hit points from the loss's record", () => {
    const first = compose(newLog(EXPERT), playing(AMH));
    const next = compose(finished(first, "lost", hpRecords("mc60.defeat.hp")), playing(GETAWAY));
    expect(expertSteps(next)).toEqual(["mc60.setup.rejoin", "mc60.setup.hp", "mc60.setup.heal"]);
  });
});

describe("campaign setup step 8: removal by title", () => {
  it("a recorded ally is removed from every deck by title, and stays removed", () => {
    const log = withResolved(
      newLog(),
      {},
      {
        playthrough: { kind: "choice", option: FNE_LATER_PLAYTHROUGH },
        removedTitles: { kind: "cardList", cardIds: [DAREDEVIL_ALLY] },
      },
    );
    expect(log.seats[1]!.deck.cards.some((line) => line.cardId === DAREDEVIL_ALLY)).toBe(true);
    const composed = compose(log, playing(AMH, false));
    for (const seat of composed.seats)
      expect(seat.deck.cards.some((line) => line.cardId === DAREDEVIL_ALLY)).toBe(false);
    expect(composed.removedFromCampaign.some((face) => face.cardId === DAREDEVIL_ALLY)).toBe(true);
    expect(composed.attempt!.input.seats.every((seat) => !seat.deck.includes(DAREDEVIL_ALLY))).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The scenarios' SETUP bullets (step 14) are handed over with the log's check marks
// ---------------------------------------------------------------------------------------------------------------

describe("each scenario's SETUP bullet", () => {
  it("is an after-mulligans instruction of its node", () => {
    for (const node of [...FNE_UNDERLING_NODES, KINGPIN]) {
      const log =
        node === KINGPIN
          ? withResolved(newLog(), Object.fromEntries(FNE_UNDERLING_NODES.map((n) => [n, "completed" as const])))
          : withResolved(newLog(), {}, { playthrough: { kind: "choice", option: FNE_LATER_PLAYTHROUGH } });
      const composed = compose(log, playing(node, false));
      expect(composed.attempt!.nodeId).toBe(node);
      const setup = composed.attempt!.input.instructions.find((i) => i.instructionId === `mc60.${node}.setup`);
      expect(setup?.window, node).toBe("afterMulligans");
    }
  });

  it("'checks' holds the marks beside the chosen scenario", () => {
    const log = withResolved(newLog(), {}, { playthrough: { kind: "choice", option: FNE_LATER_PLAYTHROUGH } });
    const marked: CampaignLog = { ...log, position: { ...log.position, progress: { [RACKET]: 1 } } };
    const composed = compose(marked, playing(RACKET, false));
    expect(composed.shared["checks"]).toEqual({ kind: "number", value: composed.position.progress[RACKET] });
    expect(composed.position.progress[RACKET]).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// VICTORY
// ---------------------------------------------------------------------------------------------------------------

describe("each underling scenario's VICTORY block (MC60 pp. 13 to 21)", () => {
  const later = { playthrough: { kind: "choice", option: FNE_LATER_PLAYTHROUGH } } as const;

  it.each(FNE_UNDERLING_NODES)(
    "%s: marks Completed on the position and the log, and goes back to Campaign Setup",
    (node) => {
      const composed = compose(withResolved(newLog(), {}, later), playing(node, false));
      const won = finished(composed, "won");
      expect(won.position.resolved[node]).toBe("completed");
      expect(sharedFlag(won, completedField(node))).toBe(true);
      // Back to Campaign Setup: the scenario is chosen anew, not queued.
      expect(won.position.nextNodeId).toBeNull();
      expect(won.status).toBe("active");
      expect(won.attempt).toBeUndefined();
      // The block's bullets, in the order printed.
      const steps = won.history.at(-1)!.steps.map((step) => step.instructionId);
      expect(steps.filter((id) => id.startsWith(`mc60.${node}.victory.`) && !id.endsWith("-record"))).toEqual([
        `mc60.${node}.victory.trust`,
        `mc60.${node}.victory.mary`,
        `mc60.${node}.victory.removed`,
        `mc60.${node}.victory.completed`,
      ]);
    },
  );

  it("checks 'Trust Established?' only when Disturbed Psyche had at least 2 threat, and never clears it", () => {
    const composed = compose(withResolved(newLog(), {}, later), playing(AMH, false));
    const record = (trust: boolean) => [
      { instructionId: `mc60.${AMH}.victory.trust-record`, write: write("trustThisGame", flag(trust)) },
      { instructionId: `mc60.${AMH}.victory.trust-record`, write: write("maryThisGame", flag(false)) },
    ];
    const without = finished(composed, "won", record(false));
    expect(sharedFlag(without, "trustEstablished")).toBe(false);
    const checked = finished(composed, "won", record(true));
    expect(sharedFlag(checked, "trustEstablished")).toBe(true);
    // A later game against another villain has no Disturbed Psyche: the box stays checked.
    const next = compose(checked, playing(GETAWAY, false));
    const after = finished(next, "won", [
      { instructionId: `mc60.${GETAWAY}.victory.trust-record`, write: write("trustThisGame", flag(false)) },
      { instructionId: `mc60.${GETAWAY}.victory.trust-record`, write: write("maryThisGame", flag(false)) },
    ]);
    expect(sharedFlag(after, "trustEstablished")).toBe(true);
  });

  it("checks 'Mary Defeated?' when the ally is in the victory display, and the ally is then not offered again", () => {
    const composed = compose(
      withResolved(newLog(), {}, { ...later, trustEstablished: flag(true) }),
      playing(RACKET, false),
    );
    expect(setAside(composed)).toContain("60210a");
    const won = finished(composed, "won", [
      { instructionId: `mc60.${RACKET}.victory.trust-record`, write: write("trustThisGame", flag(false)) },
      { instructionId: `mc60.${RACKET}.victory.trust-record`, write: write("maryThisGame", flag(true)) },
    ]);
    expect(sharedFlag(won, "maryDefeated")).toBe(true);
    const next = compose(won, playing(RAFT, false));
    expect(setAside(next)).not.toContain("60210a");
    expect(instructionIds(next)).not.toContain("mc60.setup.typhoid-mary");
  });

  it("records the title of each unique ally and support removed from the game, once each, and a won game's removal sticks", () => {
    const composed = compose(withResolved(newLog(), {}, later), playing(PRESSES, false));
    const removed = (instructionId: string, ids: string[]) => [
      {
        instructionId,
        write: {
          ...write("removedTitles", { kind: "cardList", cardIds: ids.map(cardId) }, "append"),
          distinct: true as const,
        },
      },
    ];
    const won = finished(composed, "won", removed(`mc60.${PRESSES}.victory.removed`, ["60153", "60155", "60156"]));
    expect(won.shared["removedTitles"]).toEqual({ kind: "cardList", cardIds: ["60153", "60155", "60156"].map(cardId) });
    // Recorded again by a later victory: no duplicate.
    const second = compose(won, playing(AMH, false));
    const again = finished(second, "won", removed(`mc60.${AMH}.victory.removed`, ["60153", "60039"]));
    expect(again.shared["removedTitles"]).toEqual({
      kind: "cardList",
      cardIds: ["60153", "60155", "60156", "60039"].map(cardId),
    });
    // And the Daredevil ally leaves every deck by title at the next setup.
    const third = compose(again, playing(GETAWAY, false));
    for (const seat of third.seats) expect(seat.deck.cards.some((line) => line.cardId === DAREDEVIL_ALLY)).toBe(false);
  });

  it("expert: records each identity's remaining hit points after a win, capped at base", () => {
    const composed = compose(withResolved(newLog(EXPERT), {}, later), playing(AMH, false));
    const won = finished(composed, "won", [
      { instructionId: "mc60.victory.hp", write: write("remainingHp", { kind: "number", value: 7 }, "set", 1) },
      { instructionId: "mc60.victory.hp", write: write("remainingHp", { kind: "number", value: 9 }, "set", 2) },
    ]);
    expect(won.seats.map((seat) => seat.fields["remainingHp"])).toEqual([
      { kind: "number", value: 7 },
      { kind: "number", value: 9 },
    ]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// DEFEAT
// ---------------------------------------------------------------------------------------------------------------

describe("each underling scenario's DEFEAT block (MC60 pp. 13 to 21)", () => {
  const later = { playthrough: { kind: "choice", option: FNE_LATER_PLAYTHROUGH } } as const;

  it.each(FNE_UNDERLING_NODES)(
    "%s: a standard loss keeps the draw's marks, adds none, and goes back to Campaign Setup",
    (node) => {
      const composed = compose(withResolved(newLog(STANDARD), {}, later), playing(node, false));
      // MC60 p. 8 / E30: the log is kept (the marks this game's setup drew included), and standard mode adds none.
      const lost = finished(composed, "lost");
      expect(lost.position.progress).toEqual(composed.position.progress);
      expect(lost.position.resolved[node]).toBeUndefined();
      expect(lost.position.nextNodeId).toBeNull();
      expect(lost.status).toBe("active");
    },
  );

  it.each(FNE_UNDERLING_NODES)(
    "%s: an expert loss progresses that scenario once, on top of the draw's marks",
    (node) => {
      const composed = compose(withResolved(newLog(EXPERT), {}, later), playing(node, false));
      const lost = finished(composed, "lost");
      expect(lost.position.progress[node]).toBe((composed.position.progress[node] ?? 0) + 1);
    },
  );

  it("losing the first game: the next setup asks no playthrough question, keeps the marks, draws again, re-asks", () => {
    const asked: string[] = [];
    const composed = compose(newLog(STANDARD), playing(AMH), asked);
    expect(asked.filter((slot) => slot === "playthrough")).toHaveLength(1);
    expect(villainOf(composed, AMH)).toBe("hammerhead");
    const lost = finished(composed, "lost");
    const marks = (log: CampaignLog) => Object.values(log.position.progress).reduce((sum, n) => sum + n, 0);
    expect(marks(lost)).toBe(2);
    expect(lost.position.progress).toEqual(composed.position.progress);
    // The villain recorded for the scenario stays recorded (step 5a), and struck from the list.
    expect(villainOf(lost, AMH)).toBe("hammerhead");
    expect(struck(lost)).toEqual(["hammerhead"]);

    const next: string[] = [];
    const offered: string[][] = [];
    const again = compose(
      lost,
      (choice) => {
        if (choice.slot === "node") offered.push([...choice.options]);
        return playing(GETAWAY)(choice);
      },
      next,
    );
    expect(next).not.toContain("playthrough");
    expect(next).toContain("node");
    expect(offered).toEqual([[AMH, GETAWAY, RACKET, RAFT, PRESSES]]);
    // Two new draws on top of the kept marks; a different scenario was chosen, with the next villain in the order.
    expect(marks(again)).toBe(4);
    for (const [node, count] of Object.entries(lost.position.progress))
      expect(again.position.progress[node]).toBeGreaterThanOrEqual(count);
    expect(again.attempt!.nodeId).toBe(GETAWAY);
    expect(villainOf(again, GETAWAY)).toBe("bullseye");
    // Back at the lost scenario later, 5a takes the villain already recorded.
    const replay = compose(finished(again, "won"), playing(AMH));
    expect(startGameFromLog(DEF, replay).villain).toBe("hammerhead");
  });

  it("expert: a scenario failed by its own game's draw plus its DEFEAT mark is not offered again", () => {
    // Find a seed whose draw marks The Getaway, already at one mark, so the composed game holds two.
    let found: CampaignLog | null = null;
    for (let seed = 1; seed < 200 && !found; seed++) {
      const base = withResolved(newLog(EXPERT, seed), {}, later);
      const log: CampaignLog = { ...base, position: { ...base.position, progress: { [GETAWAY]: 1 } } };
      const composed = compose(log, playing(GETAWAY, false));
      if (composed.attempt!.nodeId === GETAWAY && composed.position.progress[GETAWAY] === 2) found = composed;
    }
    expect(found).not.toBeNull();
    const lost = finished(found!, "lost");
    expect(lost.position.progress[GETAWAY]).toBe(3);
    expect(lost.position.resolved[GETAWAY]).toBe("failed");
    expect(lost.position.nextNodeId).toBeNull();
    const offered: string[][] = [];
    const next = compose(lost, (choice) => {
      if (choice.slot === "node") offered.push([...choice.options]);
      return choice.options[0]!;
    });
    for (const options of offered) expect(options).not.toContain(GETAWAY);
    expect(next.attempt!.nodeId).not.toBe(GETAWAY);
    // Its Failed environment is in the next game.
    expect(instructionIds(next)).toContain(`mc60.setup.environment.${GETAWAY}.failed`);
  });

  it("an expert loss on a scenario with two marks marks the third: that scenario has Failed", () => {
    const base = withResolved(newLog(EXPERT), {}, later);
    const log: CampaignLog = { ...base, position: { ...base.position, progress: { [GETAWAY]: 2 } } };
    const composed = compose(log, playing(GETAWAY, false));
    const lost = finished(composed, "lost");
    expect(composed.attempt!.logBefore.position.progress[GETAWAY]).toBe(2);
    expect(lost.position.resolved[GETAWAY]).toBe("failed");
    expect(lost.position.nextNodeId).toBeNull();
  });

  it("expert: hit points are recorded after a loss too", () => {
    const composed = compose(withResolved(newLog(EXPERT), {}, later), playing(AMH, false));
    const lost = finished(composed, "lost", [
      { instructionId: "mc60.defeat.hp", write: write("remainingHp", { kind: "number", value: 4 }, "set", 1) },
    ]);
    expect(lost.seats[0]!.fields["remainingHp"]).toEqual({ kind: "number", value: 4 });
  });

  it("a lost game records no victory facts (no Trust, no Mary, no removed titles; Q201 = A)", () => {
    const composed = compose(withResolved(newLog(STANDARD), {}, later), playing(RACKET, false));
    // What the game would have recorded had it been won: Disturbed Psyche at 2 threat, the Mary ally in the victory
    // display, and a unique ally and a Daily Bugle support removed from the game.
    const lost = finished(composed, "lost", [
      { instructionId: `mc60.${RACKET}.victory.trust-record`, write: write("trustThisGame", flag(true)) },
      { instructionId: `mc60.${RACKET}.victory.trust-record`, write: write("maryThisGame", flag(true)) },
      {
        instructionId: `mc60.${RACKET}.victory.removed`,
        write: {
          ...write("removedTitles", { kind: "cardList", cardIds: [DAREDEVIL_ALLY, cardId("60153")] }, "append"),
          distinct: true as const,
        },
      },
    ]);
    expect(sharedFlag(lost, "trustEstablished")).toBe(false);
    expect(sharedFlag(lost, "maryDefeated")).toBe(false);
    expect(lost.shared["trustThisGame"]).toBeUndefined();
    expect(lost.shared["maryThisGame"]).toBeUndefined();
    expect(lost.shared["removedTitles"]).toBeUndefined();
    expect(lost.removedFromCampaign).toEqual([]);
    // And the next setup's deck surgery leaves the Daredevil ally in its deck.
    const next = compose(lost);
    expect(next.seats[1]!.deck.cards.some((line) => line.cardId === DAREDEVIL_ALLY)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The Kingpin scenario
// ---------------------------------------------------------------------------------------------------------------

describe("the Kingpin scenario (MC60 p. 23)", () => {
  const allDone = (over: Record<string, "completed" | "failed"> = {}, modes: PlayModes = STANDARD): CampaignLog =>
    withResolved(
      newLog(modes),
      { ...Object.fromEntries(FNE_UNDERLING_NODES.map((n) => [n, "completed" as const])), ...over },
      Object.fromEntries(FNE_UNDERLING_NODES.map((n) => [completedField(n), flag(true)])),
    );

  it("VICTORY: the players win the campaign", () => {
    const composed = compose(allDone());
    expect(composed.attempt!.nodeId).toBe(KINGPIN);
    const won = finished(composed, "won");
    expect(won.status).toBe("won");
    expect(won.attempt).toBeUndefined();
  });

  it("standard DEFEAT: replay the scenario, nothing changes", () => {
    const composed = compose(allDone({ [GETAWAY]: "failed" }));
    const lost = finished(composed, "lost");
    expect(lost.status).toBe("active");
    // Back to Campaign Setup, where every scenario is resolved: step 4 leaves Kingpin as the only game.
    expect(lost.position.nextNodeId).toBeNull();
    expect(lost.position.resolved).toEqual(composed.position.resolved);
    expect(compose(lost).attempt!.nodeId).toBe(KINGPIN);
  });

  it("expert DEFEAT: the players choose a Completed environment and flip it to Failed, then replay the scenario", () => {
    const composed = compose(allDone({ [GETAWAY]: "failed", [PRESSES]: "failed" }, EXPERT));
    expect(setAside(composed).filter((id) => /^6020[5-9]/.test(id))).toHaveLength(5);
    const offered: string[][] = [];
    const answers: CampaignChoiceAnswer[] = [];
    let applied = finish(composed, "lost", [], answers);
    expect(applied.kind).toBe("pending");
    if (applied.kind !== "pending") return;
    offered.push([...applied.choice.options]);
    answers.push({
      instructionId: applied.choice.instructionId,
      slot: applied.choice.slot,
      seatNumber: applied.choice.seatNumber,
      picked: [RACKET],
    });
    applied = finish(composed, "lost", [], answers);
    expect(applied.kind).toBe("done");
    if (applied.kind !== "done") return;
    // Only the Completed ones are offered, in graph order.
    expect(offered).toEqual([[AMH, RACKET, RAFT]]);
    const log = applied.value;
    expect(log.position.resolved[RACKET]).toBe("failed");
    expect(log.position.resolved[AMH]).toBe("completed");
    expect(sharedFlag(log, completedField(RACKET))).toBe(false);
    expect(sharedFlag(log, completedField(AMH))).toBe(true);
    expect(log.status).toBe("active");
    expect(log.position.nextNodeId).toBeNull();

    // The replay: the flipped environment is now placed Failed side up, the others as before.
    const replay = compose(log);
    expect(replay.attempt!.nodeId).toBe(KINGPIN);
    expect(instructionIds(replay).filter((id) => id.startsWith("mc60.setup.environment."))).toEqual([
      `mc60.setup.environment.${AMH}.completed`,
      `mc60.setup.environment.${GETAWAY}.failed`,
      `mc60.setup.environment.${RACKET}.failed`,
      `mc60.setup.environment.${RAFT}.completed`,
      `mc60.setup.environment.${PRESSES}.failed`,
      "mc60.setup.environment.setups",
    ]);
  });

  it("expert DEFEAT with no environment on its Completed side: the players lose the campaign", () => {
    const failedAll = Object.fromEntries(FNE_UNDERLING_NODES.map((n) => [n, "failed" as const]));
    const composed = compose(allDone(failedAll, EXPERT));
    const lost = finished(composed, "lost");
    expect(lost.status).toBe("lost");
    expect(lost.position.nextNodeId).toBeNull();
  });

  it("expert DEFEAT with exactly one Completed environment asks, and the last flip then loses the next defeat", () => {
    const composed = compose(
      allDone({ [AMH]: "failed", [GETAWAY]: "failed", [RACKET]: "failed", [RAFT]: "failed" }, EXPERT),
    );
    const asked: string[][] = [];
    const answers: CampaignChoiceAnswer[] = [];
    let applied = finish(composed, "lost", [], answers);
    if (applied.kind === "pending") {
      asked.push([...applied.choice.options]);
      answers.push({
        instructionId: applied.choice.instructionId,
        slot: applied.choice.slot,
        seatNumber: applied.choice.seatNumber,
        picked: [applied.choice.options[0]!],
      });
      applied = finish(composed, "lost", [], answers);
    }
    expect(asked).toEqual([[PRESSES]]);
    expect(applied.kind).toBe("done");
    if (applied.kind !== "done") return;
    expect(applied.value.status).toBe("active");
    const replay = compose(applied.value);
    expect(replay.attempt!.nodeId).toBe(KINGPIN);
    const second = finished(replay, "lost");
    expect(second.status).toBe("lost");
  });

  it("the Kingpin node is the only game once every scenario is resolved, with the environments of the finished ones", () => {
    const composed = compose(allDone({ [AMH]: "failed" }));
    expect(setAside(composed).filter((id) => /^6020[5-9]/.test(id))).toEqual([
      "60205a",
      "60206a",
      "60207a",
      "60208a",
      "60209a",
    ]);
    expect(CAMPAIGN_NEXT_NODE_INSTRUCTION).toBeDefined();
  });
});
