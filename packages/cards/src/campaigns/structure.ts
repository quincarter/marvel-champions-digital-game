/**
 * Structural reads and checks over a `CampaignDefinition`, shared by the base boxes' coverage test
 * (`coverage.test.ts`) and the mod SDK's validation of a pack campaign (docs/custom-content-packs.md §11.10). They
 * walk plain JSON, so the same code serves a box authored in TypeScript and a campaign downloaded as a pack.
 */
import type { CampaignDefinition, CampaignInstruction } from "@mc/engine";
import { action } from "../dsl/abilities.js";
import { validateDefinition } from "../dsl/validate.js";

/** Every `field: string` a value reads or writes, found structurally so no step shape has to be enumerated. */
export function fieldsIn(value: unknown, found: Set<string> = new Set()): ReadonlySet<string> {
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

/**
 * Every literal card id a value names ("cardId" / "cardIds" keys), found the same structural way. A `kind: "cards"`
 * choice source is left out when `skipOptionLists` is set: it lists the options of a choice, which a box may spell as
 * plain words (`"accept"`) rather than card ids.
 */
export function cardIdsIn(
  value: unknown,
  found: Set<string> = new Set(),
  skipOptionLists = false,
): ReadonlySet<string> {
  if (Array.isArray(value)) {
    for (const item of value) cardIdsIn(item, found, skipOptionLists);
    return found;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (skipOptionLists && record.kind === "cards") return found;
    for (const [key, v] of Object.entries(record)) {
      if (key === "cardId" && typeof v === "string") found.add(v);
      if (key === "cardIds" && Array.isArray(v)) for (const id of v) if (typeof id === "string") found.add(id);
      cardIdsIn(v, found, skipOptionLists);
    }
  }
  return found;
}

/** Every object with this `kind` anywhere in a value, found structurally (the same walk `fieldsIn` does). */
export function opsOfKind(
  value: unknown,
  kind: string,
  found: Record<string, unknown>[] = [],
): readonly Record<string, unknown>[] {
  if (Array.isArray(value)) {
    for (const item of value) opsOfKind(item, kind, found);
    return found;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.kind === kind) found.push(record);
    for (const v of Object.values(record)) opsOfKind(v, kind, found);
  }
  return found;
}

/**
 * Every instruction a definition holds: each node's composition, setup, victory and defeat, the every-node blocks, the
 * loss policy's every-node defeat block and the conditional instructions. Works on a `linear` or `choice` graph.
 */
export function campaignInstructionsOf(definition: CampaignDefinition): readonly CampaignInstruction[] {
  const graph = definition.graph;
  return [
    ...(definition.everyNodeSetup ?? []),
    ...(definition.everyNodeVictory ?? []),
    ...(definition.loss?.everyNodeDefeat ?? []),
    ...Object.values(definition.conditionalInstructions ?? {}),
    ...(graph.kind === "choice" ? (graph.beforeChoice ?? []) : []),
    ...graph.nodes.flatMap((node) => [
      ...(node.composition ?? []),
      ...node.setup,
      ...node.victory,
      ...(node.defeat ?? []),
    ]),
  ];
}

/** What a definition's references are checked against. */
export interface CampaignCheckContext {
  /** Whether a literal card id a step names is a card the game can find. */
  readonly isCardId: (id: string) => boolean;
  /** Whether a `fixed` node's scenario id is a scenario the game can find. */
  readonly isScenarioId: (id: string) => boolean;
}

const isObj = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * The generic problems of a campaign definition, as sentences: the shape the engine reads, ids unique, every log field a
 * step reads or writes declared, every conditional instruction filed under its own id, every in-game effect and node
 * rule passing the DSL's validator (which includes `campaignLog` read checks), and every scenario and literal card id
 * resolving. Never throws for a malformed one (a pack's campaign is untrusted JSON).
 */
export function campaignDefinitionProblems(
  definition: CampaignDefinition,
  context: CampaignCheckContext,
): readonly string[] {
  const problems: string[] = [];
  const input: unknown = definition;
  if (!isObj(input)) return ["definition must be a JSON object"];
  if (typeof input.campaignId !== "string" || input.campaignId === "") problems.push("definition needs a campaignId");
  if (typeof input.version !== "string" || input.version === "") problems.push("definition needs a version");
  if (!Array.isArray(input.logFields)) problems.push("logFields must be a list");
  if (!isObj(input.graph) || !Array.isArray(input.graph.nodes) || input.graph.nodes.length === 0)
    problems.push("graph needs at least one node");
  if (!isObj(input.loss) || (input.loss.retry !== "free" && input.loss.retry !== "byInstruction"))
    problems.push('loss.retry must be "free" or "byInstruction"');
  else if (input.loss.retryBaseline !== "nodeStart" && input.loss.retryBaseline !== "keepLog")
    problems.push('loss.retryBaseline must be "nodeStart" or "keepLog"');
  if (problems.length > 0) return problems;

  const nodes = definition.graph.nodes;
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (!isObj(node) || typeof node.id !== "string" || node.id === "") {
      problems.push("every node needs an id");
      continue;
    }
    if (nodeIds.has(node.id)) problems.push(`node id "${node.id}" is used twice`);
    nodeIds.add(node.id);
    if (!Array.isArray(node.setup) || !Array.isArray(node.victory))
      problems.push(`node "${node.id}" needs setup and victory lists (empty is fine)`);
    if (node.scenario?.kind === "fixed" && !context.isScenarioId(String(node.scenario.scenarioId)))
      problems.push(`node "${node.id}": scenario "${String(node.scenario.scenarioId)}" is not a scenario the game has`);
  }

  const fieldIds = new Set<string>();
  for (const field of definition.logFields) {
    if (!isObj(field) || typeof field.id !== "string" || field.id === "") {
      problems.push("every log field needs an id");
      continue;
    }
    if (fieldIds.has(field.id)) problems.push(`log field id "${field.id}" is used twice`);
    fieldIds.add(field.id);
    if (field.scope !== "shared" && field.scope !== "perSeat") problems.push(`log field "${field.id}": bad scope`);
    if (!isObj(field.type) || typeof field.type.kind !== "string")
      problems.push(`log field "${field.id}" needs a type`);
  }

  for (const [key, instruction] of Object.entries(definition.conditionalInstructions ?? {})) {
    if (!isObj(instruction) || instruction.id !== key)
      problems.push(`conditionalInstructions key "${key}" must be the id of the instruction filed under it`);
  }

  const ids = new Set<string>();
  const instructions = campaignInstructionsOf(definition);
  for (const instruction of instructions) {
    if (!isObj(instruction) || typeof instruction.id !== "string" || instruction.id === "") {
      problems.push("every instruction needs an id");
      continue;
    }
    const at = `instruction "${instruction.id}"`;
    if (ids.has(instruction.id)) problems.push(`${at}: id is used twice`);
    ids.add(instruction.id);
    for (const field of ["text", "citation"] as const) {
      if (typeof instruction[field] !== "string" || instruction[field] === "")
        problems.push(`${at}: needs ${field === "text" ? "its printed text" : "a citation"}`);
    }
    const step = instruction.step;
    if (!isObj(step) || (step.kind !== "inGame" && step.kind !== "betweenGames" && step.kind !== "record")) {
      problems.push(`${at}: step.kind must be inGame, betweenGames or record`);
      continue;
    }
    for (const field of fieldsIn([step, instruction.when], new Set())) {
      if (!fieldIds.has(field)) problems.push(`${at}: reads or writes log field "${field}", which is not declared`);
    }
    for (const node of opsOfKind([step, instruction.when], "nodeResolved")) {
      if (!nodeIds.has(String(node.nodeId)))
        problems.push(`${at}: names node "${String(node.nodeId)}", which is not one`);
    }
    for (const card of cardIdsIn(step, new Set(), true)) {
      if (!context.isCardId(card)) problems.push(`${at}: names card "${card}", which the game does not have`);
    }
    if (step.kind === "inGame") {
      if (!Array.isArray(step.effects)) {
        problems.push(`${at}: an inGame step needs a list of effects`);
        continue;
      }
      try {
        for (const problem of validateDefinition(action(...step.effects))) problems.push(`${at}: ${problem}`);
      } catch (error) {
        problems.push(`${at}: effects could not be checked: ${errorText(error)}`);
      }
    }
  }
  for (const field of fieldsIn([definition.elimination, definition.loss], new Set())) {
    if (!fieldIds.has(field)) problems.push(`policy reads log field "${field}", which is not declared`);
  }

  for (const node of nodes) {
    const specs = node.scenarioRuleSpecs;
    if (specs === undefined) continue;
    if (!Array.isArray(specs)) {
      problems.push(`node "${node.id}": scenarioRuleSpecs must be a list`);
      continue;
    }
    try {
      const rules = { trigger: { kind: "constant" as const, rules: specs }, effects: [] };
      for (const problem of validateDefinition(rules)) problems.push(`node "${node.id}" scenarioRuleSpecs: ${problem}`);
    } catch (error) {
      problems.push(`node "${node.id}": scenarioRuleSpecs could not be checked: ${errorText(error)}`);
    }
  }
  return problems;
}
