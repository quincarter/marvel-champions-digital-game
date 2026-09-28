/**
 * Structural coverage for `SM_CAMPAIGN_DEFINITION` (docs/campaign-mode-design.md §9.3), modeled on `mts.test.ts`'s
 * own checks. Scenario-by-scenario behavior (which node crossings mark, what each victory instruction records) is
 * exercised through the engine's own `sm-queries.test.ts` (the pattern this file's reputation track reuses) and
 * `packages/engine/src/campaign/runner.test.ts`-style fixtures elsewhere; this file proves the definition itself is
 * well-formed and matches the real, ingested `@mc/content` records it names.
 */
import { describe, expect, it } from "vitest";
import { SM_CAMPAIGN as SM_CAMPAIGN_RECORD, SM_CARDS, SM_SCENARIOS } from "@mc/content";
import type { CampaignInstruction } from "@mc/engine";
import { action } from "../dsl/abilities.js";
import { validateDefinition } from "../dsl/validate.js";
import { SM_CAMPAIGN_DEFINITION } from "./sm.js";

function allInstructions(): readonly CampaignInstruction[] {
  const graph = SM_CAMPAIGN_DEFINITION.graph;
  if (graph.kind !== "linear") throw new Error("expected sm's graph to be linear");
  const perNode = graph.nodes.flatMap((node) => [
    ...(node.composition ?? []),
    ...node.setup,
    ...node.victory,
    ...(node.defeat ?? []),
  ]);
  return [
    ...perNode,
    ...(SM_CAMPAIGN_DEFINITION.everyNodeVictory ?? []),
    ...Object.values(SM_CAMPAIGN_DEFINITION.conditionalInstructions ?? {}),
  ];
}

function fieldsIn(value: unknown, found: Set<string> = new Set()): ReadonlySet<string> {
  if (Array.isArray(value)) {
    for (const item of value) fieldsIn(item, found);
    return found;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.field === "string") found.add(record.field);
    for (const v of Object.values(record)) fieldsIn(v, found);
  }
  return found;
}

function instructionListIdsIn(value: unknown, found: Set<string> = new Set()): ReadonlySet<string> {
  if (Array.isArray(value)) {
    for (const item of value) instructionListIdsIn(item, found);
    return found;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (
      record.kind === "appendToList" &&
      record.field === "reputationSetups" &&
      record.value &&
      typeof record.value === "object" &&
      (record.value as { readonly kind?: string }).kind === "const"
    ) {
      found.add((record.value as { readonly value: unknown }).value as string);
    }
    for (const v of Object.values(record)) instructionListIdsIn(v, found);
  }
  return found;
}

describe("SM_CAMPAIGN_DEFINITION", () => {
  it("campaignId matches the @mc/content Campaign record, and the version and loss policy are present", () => {
    expect(SM_CAMPAIGN_DEFINITION.campaignId).toBe(SM_CAMPAIGN_RECORD.id);
    expect(SM_CAMPAIGN_DEFINITION.version).toBe("1");
    expect(SM_CAMPAIGN_DEFINITION.loss).toEqual({ retry: "byInstruction", retryBaseline: "nodeStart" });
  });

  it("is a fully-connected linear graph of 5 uniquely-id'd nodes, in the content record's scenario order", () => {
    const graph = SM_CAMPAIGN_DEFINITION.graph;
    expect(graph.kind).toBe("linear");
    if (graph.kind !== "linear") return;
    const ids = graph.nodes.map((node) => node.id);
    expect(ids).toEqual(["sandman", "venom", "mysterio", "sinister-six", "venom-goblin"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every node's scenario resolves in @mc/content, belongs to the sm pack, and matches the content record's order", () => {
    const graph = SM_CAMPAIGN_DEFINITION.graph;
    if (graph.kind !== "linear") throw new Error("expected a linear graph");
    const byId = new Map(SM_SCENARIOS.map((scenario) => [scenario.id as string, scenario]));
    const scenarioIds = graph.nodes.map((node) => {
      expect(node.scenario.kind, node.id).toBe("fixed");
      if (node.scenario.kind !== "fixed") throw new Error(`${node.id}: expected a fixed scenario`);
      const scenario = byId.get(node.scenario.scenarioId as string);
      expect(scenario, `${node.id}: scenario ${node.scenario.scenarioId} is not registered`).toBeDefined();
      expect(scenario?.packCode, node.id).toBe(SM_CAMPAIGN_RECORD.packCode);
      return node.scenario.scenarioId as string;
    });
    expect(scenarioIds).toEqual(SM_CAMPAIGN_RECORD.scenarioIds.map((id) => id as string));
  });

  it("every instruction id is unique, prefixed 'sm.', and cites 'MC27 p. N'", () => {
    const instructions = allInstructions();
    const ids = instructions.map((instruction) => instruction.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const instruction of instructions) {
      expect(instruction.id.startsWith("sm."), instruction.id).toBe(true);
      expect(instruction.citation, instruction.id).toMatch(/^MC27 p\. \d+( \(RRG 1\.8 p\. 67 erratum\))?$/);
    }
  });

  it("every LogFieldDef cites 'MC27 p. N'", () => {
    for (const field of SM_CAMPAIGN_DEFINITION.logFields) {
      expect(field.citation, field.id).toMatch(/^MC27 p\. \d+$/);
    }
  });

  it("every field an instruction reads or writes is declared in logFields", () => {
    const declared = new Set(SM_CAMPAIGN_DEFINITION.logFields.map((field) => field.id));
    const referenced = new Set<string>();
    for (const instruction of allInstructions()) fieldsIn(instruction.step, referenced);
    for (const field of referenced) expect(declared.has(field), field).toBe(true);
  });

  it("every declared LogFieldDef is read or written by at least one instruction (no dead fields)", () => {
    const referenced = new Set<string>();
    for (const instruction of allInstructions()) fieldsIn(instruction.step, referenced);
    for (const field of SM_CAMPAIGN_DEFINITION.logFields) {
      expect(referenced.has(field.id), `${field.id} is never read or written`).toBe(true);
    }
  });

  it("every inGame instruction's effects pass the DSL validator", () => {
    for (const instruction of allInstructions()) {
      if (instruction.step.kind !== "inGame") continue;
      expect(validateDefinition(action(...instruction.step.effects)), instruction.id).toEqual([]);
    }
  });

  it("every reputationSetups id the reputation track can append resolves in conditionalInstructions", () => {
    const appended = instructionListIdsIn(SM_CAMPAIGN_DEFINITION.everyNodeVictory);
    expect(appended.size).toBeGreaterThan(0);
    const declared = new Set(Object.keys(SM_CAMPAIGN_DEFINITION.conditionalInstructions ?? {}));
    for (const id of appended) expect(declared.has(id), id).toBe(true);
    // And every declared conditional instruction is reachable from some node crossing (no dead entries).
    for (const id of declared) expect(appended.has(id), id).toBe(true);
  });

  it("every literal S.H.I.E.L.D. Tech card id the node 13 flip branches on resolves in the sm pool", () => {
    const pool = new Set(SM_CARDS.map((card) => card.id as string));
    const flips = SM_CAMPAIGN_DEFINITION.conditionalInstructions;
    void flips; // node 13's flip is inline in everyNodeVictory, not a conditionalInstruction; checked via ids below.
    const named = new Set<string>();
    for (const instruction of SM_CAMPAIGN_DEFINITION.everyNodeVictory ?? []) {
      const ids = new Set<string>();
      const collect = (value: unknown): void => {
        if (Array.isArray(value)) {
          for (const item of value) collect(item);
          return;
        }
        if (value !== null && typeof value === "object") {
          const record = value as Record<string, unknown>;
          if (record.kind === "setGrantFace" && record.card && typeof record.card === "object") {
            const card = record.card as { readonly kind?: string; readonly value?: unknown };
            if (card.kind === "const") ids.add(card.value as string);
          }
          for (const v of Object.values(record)) collect(v);
        }
      };
      collect(instruction.step);
      for (const id of ids) named.add(id);
    }
    expect(named.size).toBe(8);
    for (const id of named) expect(pool.has(id), id).toBe(true);
  });

  it("lists exactly the printed bullets of each scenario, in printed order", () => {
    const graph = SM_CAMPAIGN_DEFINITION.graph;
    if (graph.kind !== "linear") throw new Error("expected a linear graph");
    const listed = Object.fromEntries(
      graph.nodes.map((node) => [
        node.id,
        {
          composition: (node.composition ?? []).map((instruction) => instruction.id),
          setup: node.setup.map((instruction) => instruction.id),
          victory: node.victory.map((instruction) => instruction.id),
          defeat: (node.defeat ?? []).map((instruction) => instruction.id),
        },
      ]),
    );
    expect(listed).toEqual({
      sandman: {
        composition: ["sm.s1.composition.sets"],
        setup: [
          "sm.s1.setup.public-outcry",
          "sm.s1.setup.smear-campaign",
          "sm.s1.setup.community-service-pick",
          "sm.s1.setup.community-service",
        ],
        victory: ["sm.s1.victory.community-service", "sm.s1.victory.hp"],
        defeat: [],
      },
      venom: {
        composition: ["sm.s2.composition.sets"],
        setup: [
          "sm.s2.setup.public-outcry",
          "sm.s2.setup.smear-campaign",
          "sm.s2.setup.community-service-pick",
          "sm.s2.setup.community-service",
          "sm.s2.setup.hp-set",
          "sm.s2.setup.heal",
          "sm.s2.setup.boost-cards",
        ],
        victory: ["sm.s2.victory.community-service", "sm.s2.victory.hp"],
        defeat: [],
      },
      mysterio: {
        composition: ["sm.s3.composition.sets"],
        setup: [
          "sm.s3.setup.smear-and-snitches",
          "sm.s3.setup.community-service-pick",
          "sm.s3.setup.community-service",
          "sm.s3.setup.hp-set",
          "sm.s3.setup.heal",
          "sm.s3.setup.shuffle-top-2",
        ],
        victory: ["sm.s3.victory.community-service", "sm.s3.victory.waking-nightmare", "sm.s3.victory.hp"],
        defeat: [],
      },
      "sinister-six": {
        composition: ["sm.s4.composition.sets"],
        setup: [
          "sm.s4.setup.public-outcry",
          "sm.s4.setup.smear-and-snitches",
          "sm.s4.setup.community-service-pick",
          "sm.s4.setup.community-service",
          "sm.s4.setup.waking-nightmare-threat",
          "sm.s4.setup.hp-set",
          "sm.s4.setup.heal",
        ],
        victory: ["sm.s4.victory.community-service", "sm.s4.victory.last-ones-standing", "sm.s4.victory.hp"],
        defeat: [],
      },
      "venom-goblin": {
        composition: ["sm.s5.composition.sets"],
        setup: [
          "sm.s5.setup.public-outcry",
          "sm.s5.setup.smear-campaign",
          "sm.s5.setup.sinister-assault",
          "sm.s5.setup.hp-set",
          "sm.s5.setup.heal",
          "sm.s5.setup.extra-threat",
        ],
        victory: ["sm.s5.victory.win", "sm.s5.victory.final-score"],
        defeat: ["sm.s5.defeat.lose-campaign"],
      },
    });
  });

  it("round-trips through JSON", () => {
    expect(JSON.parse(JSON.stringify(SM_CAMPAIGN_DEFINITION))).toEqual(SM_CAMPAIGN_DEFINITION);
  });
});
