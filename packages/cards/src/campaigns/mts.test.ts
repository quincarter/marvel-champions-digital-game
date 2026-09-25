/**
 * Structural coverage for `MTS_CAMPAIGN_DEFINITION` (docs/campaign-mode-design.md §9.3), modeled on
 * `coverage.test.ts`'s own TRORS checks and `mts.gate.test.ts`'s now-retired acceptance gate (its verdict —
 * "MC21 fits the frozen foundation" — is unchanged; this file exercises the real, ingested-content encoding of the
 * same definition instead of the gate's synthetic one).
 */
import { describe, expect, it } from "vitest";
import { MTS_CAMPAIGN as MTS_CAMPAIGN_RECORD, MTS_CARDS, MTS_SCENARIOS } from "@mc/content";
import type { CampaignInstruction } from "@mc/engine";
import { action } from "../dsl/abilities.js";
import { validateDefinition } from "../dsl/validate.js";
import { MTS_CAMPAIGN_DEFINITION } from "./mts.js";

function allInstructions(): readonly CampaignInstruction[] {
  const graph = MTS_CAMPAIGN_DEFINITION.graph;
  if (graph.kind !== "linear") throw new Error("expected mts's graph to be linear");
  return graph.nodes.flatMap((node) => [
    ...(node.composition ?? []),
    ...node.setup,
    ...node.victory,
    ...(node.defeat ?? []),
  ]);
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

function cardIdsIn(value: unknown, found: Set<string> = new Set()): ReadonlySet<string> {
  if (Array.isArray(value)) {
    for (const item of value) cardIdsIn(item, found);
    return found;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const [key, v] of Object.entries(record)) {
      if (key === "card" && v && typeof v === "object" && (v as { kind?: string }).kind === "const") {
        found.add((v as { value: unknown }).value as string);
      }
      cardIdsIn(v, found);
    }
  }
  return found;
}

describe("MTS_CAMPAIGN_DEFINITION", () => {
  it("campaignId matches the @mc/content Campaign record, and the version and loss policy are present", () => {
    expect(MTS_CAMPAIGN_DEFINITION.campaignId).toBe(MTS_CAMPAIGN_RECORD.id);
    expect(MTS_CAMPAIGN_DEFINITION.version).toBe("1");
    expect(MTS_CAMPAIGN_DEFINITION.loss).toEqual({ retry: "byInstruction", retryBaseline: "nodeStart" });
  });

  it("is a fully-connected linear graph of 5 uniquely-id'd nodes, in the content record's scenario order", () => {
    const graph = MTS_CAMPAIGN_DEFINITION.graph;
    expect(graph.kind).toBe("linear");
    if (graph.kind !== "linear") return;
    const ids = graph.nodes.map((node) => node.id);
    expect(ids).toEqual(["ebony-maw", "tower-defense", "thanos", "hela", "loki"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every node's scenario resolves in @mc/content, belongs to the mts pack, and matches the content record's order", () => {
    const graph = MTS_CAMPAIGN_DEFINITION.graph;
    if (graph.kind !== "linear") throw new Error("expected a linear graph");
    const byId = new Map(MTS_SCENARIOS.map((scenario) => [scenario.id as string, scenario]));
    const scenarioIds = graph.nodes.map((node) => {
      expect(node.scenario.kind, node.id).toBe("fixed");
      if (node.scenario.kind !== "fixed") throw new Error(`${node.id}: expected a fixed scenario`);
      const scenario = byId.get(node.scenario.scenarioId as string);
      expect(scenario, `${node.id}: scenario ${node.scenario.scenarioId} is not registered`).toBeDefined();
      expect(scenario?.packCode, node.id).toBe(MTS_CAMPAIGN_RECORD.packCode);
      return node.scenario.scenarioId as string;
    });
    expect(scenarioIds).toEqual(MTS_CAMPAIGN_RECORD.scenarioIds.map((id) => id as string));
  });

  it("every instruction id is unique, prefixed 'mc21.', and cites 'MC21 p. N'", () => {
    const instructions = allInstructions();
    const ids = instructions.map((instruction) => instruction.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const instruction of instructions) {
      expect(instruction.id.startsWith("mc21."), instruction.id).toBe(true);
      expect(instruction.citation, instruction.id).toMatch(/^MC21 p\. \d+$/);
    }
  });

  it("every LogFieldDef cites 'MC21 p. N'", () => {
    for (const field of MTS_CAMPAIGN_DEFINITION.logFields) {
      expect(field.citation, field.id).toMatch(/^MC21 p\. \d+$/);
    }
  });

  it("every field an instruction reads or writes is declared in logFields", () => {
    const declared = new Set(MTS_CAMPAIGN_DEFINITION.logFields.map((field) => field.id));
    const referenced = new Set<string>();
    for (const instruction of allInstructions()) fieldsIn(instruction.step, referenced);
    for (const field of referenced) expect(declared.has(field), field).toBe(true);
  });

  it("every declared LogFieldDef is read or written by at least one instruction (no dead fields)", () => {
    const referenced = new Set<string>();
    for (const instruction of allInstructions()) fieldsIn(instruction.step, referenced);
    for (const field of MTS_CAMPAIGN_DEFINITION.logFields) {
      expect(referenced.has(field.id), `${field.id} is never read or written`).toBe(true);
    }
  });

  it("every inGame instruction's effects pass the DSL validator", () => {
    for (const instruction of allInstructions()) {
      if (instruction.step.kind !== "inGame") continue;
      expect(validateDefinition(action(...instruction.step.effects)), instruction.id).toEqual([]);
    }
  });

  it("every literal card id a grantCard op names resolves in the mts pool", () => {
    const pool = new Set(MTS_CARDS.map((card) => card.id as string));
    const named = new Set<string>();
    for (const instruction of allInstructions()) cardIdsIn(instruction.step, named);
    expect(named.size).toBeGreaterThan(0);
    for (const id of named) expect(pool.has(id), id).toBe(true);
  });

  it("lists exactly the printed bullets of each scenario, in printed order", () => {
    const graph = MTS_CAMPAIGN_DEFINITION.graph;
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
      "ebony-maw": {
        composition: [],
        setup: ["mc21.s1.setup.identity", "mc21.s1.setup.landing-pad", "mc21.s1.setup.security-breach"],
        victory: [
          "mc21.s1.victory.landing-pad.record",
          "mc21.s1.victory.landing-pad.pool",
          "mc21.s1.victory.security-breach",
          "mc21.s1.victory.hp",
        ],
        defeat: [],
      },
      "tower-defense": {
        composition: ["mc21.s2.compose.security-breach"],
        setup: [
          "mc21.s2.setup.shawarma-place",
          "mc21.s2.setup.security-breach",
          "mc21.s2.setup.hp",
          "mc21.s2.setup.heal",
        ],
        victory: [
          "mc21.s2.victory.shawarma-place.record",
          "mc21.s2.victory.shawarma-place.pool",
          "mc21.s2.victory.black-swan.record",
          "mc21.s2.victory.black-swan.pool",
          "mc21.s2.victory.tower-damaged",
          "mc21.s2.victory.hp",
        ],
        defeat: [],
      },
      thanos: {
        composition: ["mc21.s3.compose.cosmo", "mc21.s3.compose.security-breach", "mc21.s3.compose.black-swan"],
        setup: [
          "mc21.s3.setup.sanctuarys-computer",
          "mc21.s3.setup.cosmo",
          "mc21.s3.setup.security-breach",
          "mc21.s3.setup.shawarma",
          "mc21.s3.setup.black-swan",
          "mc21.s3.setup.hp",
          "mc21.s3.setup.heal",
          "mc21.s3.setup.tower-damage",
        ],
        victory: [
          "mc21.s3.victory.defensive-protocols.record",
          "mc21.s3.victory.defensive-protocols.pool",
          "mc21.s3.victory.infinity-stones",
          "mc21.s3.victory.hp",
        ],
        defeat: [],
      },
      hela: {
        composition: [],
        setup: [
          "mc21.s4.setup.norn-stones",
          "mc21.s4.setup.summoned-back",
          "mc21.s4.setup.shawarma",
          "mc21.s4.setup.system-shock",
          "mc21.s4.setup.infinity-stones-discard",
          "mc21.s4.setup.hp",
          "mc21.s4.setup.heal",
        ],
        victory: [
          "mc21.s4.victory.norn-stones.record",
          "mc21.s4.victory.norn-stones.pool",
          "mc21.s4.victory.odin",
          "mc21.s4.victory.hp",
        ],
        defeat: [],
      },
      loki: {
        composition: ["mc21.s5.compose.odin"],
        setup: [
          "mc21.s5.setup.dungeons",
          "mc21.s5.setup.summoned-back",
          "mc21.s5.setup.shawarma",
          "mc21.s5.setup.system-shock",
          "mc21.s5.setup.infinity-stones-discard",
          "mc21.s5.setup.norn-stone",
          "mc21.s5.setup.odin",
          "mc21.s5.setup.hp",
          "mc21.s5.setup.heal",
        ],
        victory: ["mc21.s5.victory.win"],
        defeat: ["mc21.s5.defeat.lose-campaign"],
      },
    });
  });

  it("round-trips through JSON", () => {
    expect(JSON.parse(JSON.stringify(MTS_CAMPAIGN_DEFINITION))).toEqual(MTS_CAMPAIGN_DEFINITION);
  });
});
