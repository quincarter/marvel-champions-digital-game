/**
 * Coverage for every `CampaignDefinition` (docs/campaign-mode-design.md §9.3), modeled on `../wave2/coverage.test.ts`:
 * exact-match pinning, no passing by omission. It fails when a box's definition references something that does not
 * resolve, or declares a log field nothing ever reads or writes.
 */
import { describe, expect, it } from "vitest";
import { TRORS_CAMPAIGN as TRORS_CAMPAIGN_RECORD, TRORS_CARDS, TRORS_SCENARIOS } from "@mc/content";
import type { CampaignInstruction } from "@mc/engine";
import { action } from "../dsl/abilities.js";
import { validateDefinition } from "../dsl/validate.js";
import { CAMPAIGNS, TRORS_CAMPAIGN_DEFINITION } from "./index.js";

/** `CAMPAIGNS` must cover exactly the campaigns this build ships a definition for — a new box can't be silently unchecked. */
const CAMPAIGN_STATUS: Readonly<Record<string, "scripted">> = {
  trors: "scripted",
};

describe("CAMPAIGNS registry", () => {
  it("covers exactly CAMPAIGN_STATUS's campaigns", () => {
    expect(Object.keys(CAMPAIGNS).sort()).toEqual(Object.keys(CAMPAIGN_STATUS).sort());
  });

  it("campaignDefinitionOf resolves every registered campaign by its own id", () => {
    for (const [id, definition] of Object.entries(CAMPAIGNS)) {
      expect(definition.campaignId as string).toBe(id);
    }
  });
});

/** Every setup/victory/defeat instruction of every node, flattened, for the structural checks below. */
function allInstructions(): readonly CampaignInstruction[] {
  const graph = TRORS_CAMPAIGN_DEFINITION.graph;
  if (graph.kind !== "linear") throw new Error("expected trors's graph to be linear");
  return graph.nodes.flatMap((node) => [...node.setup, ...node.victory, ...(node.defeat ?? [])]);
}

/** Every `field: string` an instruction's step reads or writes, found structurally so no shape has to be enumerated. */
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

/** Every literal card id an instruction's step names ("cardId" / "cardIds" keys), found the same structural way. */
function cardIdsIn(value: unknown, found: Set<string> = new Set()): ReadonlySet<string> {
  if (Array.isArray(value)) {
    for (const item of value) cardIdsIn(item, found);
    return found;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const [key, v] of Object.entries(record)) {
      if (key === "cardId" && typeof v === "string") found.add(v);
      if (key === "cardIds" && Array.isArray(v)) for (const id of v) if (typeof id === "string") found.add(id);
      cardIdsIn(v, found);
    }
  }
  return found;
}

describe("TRORS_CAMPAIGN_DEFINITION", () => {
  it("campaignId matches the @mc/content Campaign record, and the version and loss policy are present", () => {
    expect(TRORS_CAMPAIGN_DEFINITION.campaignId).toBe(TRORS_CAMPAIGN_RECORD.id);
    expect(TRORS_CAMPAIGN_DEFINITION.version).toBe("1");
    expect(TRORS_CAMPAIGN_DEFINITION.loss).toEqual({ retry: "byInstruction", retryBaseline: "nodeStart" });
  });

  it("is a fully-connected linear graph of 5 uniquely-id'd nodes, in the content record's scenario order", () => {
    const graph = TRORS_CAMPAIGN_DEFINITION.graph;
    expect(graph.kind).toBe("linear");
    if (graph.kind !== "linear") return;
    const ids = graph.nodes.map((node) => node.id);
    expect(ids).toEqual(["crossbones", "absorbing-man", "taskmaster", "zola", "red-skull"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every node's scenario resolves in @mc/content, belongs to the trors pack, and matches the content record's order", () => {
    const graph = TRORS_CAMPAIGN_DEFINITION.graph;
    if (graph.kind !== "linear") throw new Error("expected a linear graph");
    const byId = new Map(TRORS_SCENARIOS.map((scenario) => [scenario.id as string, scenario]));
    const scenarioIds = graph.nodes.map((node) => {
      expect(node.scenario.kind, node.id).toBe("fixed");
      if (node.scenario.kind !== "fixed") throw new Error(`${node.id}: expected a fixed scenario`);
      const scenario = byId.get(node.scenario.scenarioId as string);
      expect(scenario, `${node.id}: scenario ${node.scenario.scenarioId} is not registered`).toBeDefined();
      expect(scenario?.packCode, node.id).toBe(TRORS_CAMPAIGN_RECORD.packCode);
      return node.scenario.scenarioId as string;
    });
    expect(scenarioIds).toEqual(TRORS_CAMPAIGN_RECORD.scenarioIds.map((id) => id as string));
  });

  it("every instruction id is unique, prefixed 'mc10.', and cites 'MC10 p. N'", () => {
    const instructions = allInstructions();
    const ids = instructions.map((instruction) => instruction.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const instruction of instructions) {
      expect(instruction.id.startsWith("mc10."), instruction.id).toBe(true);
      expect(instruction.citation, instruction.id).toMatch(/^MC10 p\. \d+$/);
    }
  });

  it("every LogFieldDef cites 'MC10 p. N'", () => {
    for (const field of TRORS_CAMPAIGN_DEFINITION.logFields) {
      expect(field.citation, field.id).toMatch(/^MC10 p\. \d+$/);
    }
  });

  it("every field an instruction reads or writes is declared in logFields", () => {
    const declared = new Set(TRORS_CAMPAIGN_DEFINITION.logFields.map((field) => field.id));
    const referenced = new Set<string>();
    for (const instruction of allInstructions()) fieldsIn(instruction.step, referenced);
    for (const field of referenced) expect(declared.has(field), field).toBe(true);
  });

  it("every declared LogFieldDef is read or written by at least one instruction (no dead fields)", () => {
    const referenced = new Set<string>();
    for (const instruction of allInstructions()) fieldsIn(instruction.step, referenced);
    for (const field of TRORS_CAMPAIGN_DEFINITION.logFields) {
      expect(referenced.has(field.id), `${field.id} is never read or written`).toBe(true);
    }
  });

  it("every inGame instruction's effects pass the DSL validator", () => {
    for (const instruction of allInstructions()) {
      if (instruction.step.kind !== "inGame") continue;
      expect(validateDefinition(action(...instruction.step.effects)), instruction.id).toEqual([]);
    }
  });

  it("every literal card id an instruction names resolves in the trors pool", () => {
    const pool = new Set(TRORS_CARDS.map((card) => card.id as string));
    const named = new Set<string>();
    for (const instruction of allInstructions()) cardIdsIn(instruction.step, named);
    for (const id of named) expect(pool.has(id), id).toBe(true);
  });

  it("round-trips through JSON", () => {
    expect(JSON.parse(JSON.stringify(TRORS_CAMPAIGN_DEFINITION))).toEqual(TRORS_CAMPAIGN_DEFINITION);
  });
});
