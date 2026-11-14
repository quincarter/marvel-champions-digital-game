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
  const input: unknown = definition;
  if (!isObj(input)) return [];
  const graph = isObj(input.graph) ? input.graph : {};
  const loss = isObj(input.loss) ? input.loss : {};
  const conditional = isObj(input.conditionalInstructions) ? Object.values(input.conditionalInstructions) : [];
  return [
    ...objList(input.everyNodeSetup),
    ...objList(input.everyNodeVictory),
    ...objList(loss.everyNodeDefeat),
    ...conditional.filter(isObj),
    ...(graph.kind === "choice" ? objList(graph.beforeChoice) : []),
    ...objList(graph.nodes).flatMap((node) => [
      ...objList(node.composition),
      ...objList(node.setup),
      ...objList(node.victory),
      ...objList(node.defeat),
    ]),
  ] as unknown as CampaignInstruction[];
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
/** The objects of a list; anything else (absent, a string, null entries) is an empty list or skipped. */
const objList = (value: unknown): readonly Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isObj) : [];
const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * The generic problems of a campaign definition, as sentences: the shape the engine reads, ids unique, every log field a
 * step reads or writes declared and written in a way its type allows, every conditional instruction filed under its own
 * id, every in-game effect and node rule passing the DSL's validator (which includes `campaignLog` read checks), and
 * every scenario and literal card id resolving. Never throws, whatever the input (a pack's campaign is untrusted JSON):
 * a definition it cannot read comes back as problems.
 */
export function campaignDefinitionProblems(
  definition: CampaignDefinition,
  context: CampaignCheckContext,
): readonly string[] {
  try {
    return definitionProblems(definition, context);
  } catch (error) {
    return [`could not be checked: ${errorText(error)}`];
  }
}

const FIELD_KINDS = [
  "number",
  "flag",
  "cardList",
  "cardRef",
  "choice",
  "strikeList",
  "cardState",
  "instructionList",
  "text",
];
/** The kinds `append` accepts without the log throwing (`appended` in the engine's `campaign/log.ts`). */
const LIST_KINDS = ["cardList", "instructionList", "strikeList"];
/** What a card id looks like: a base code (`01001`, `01001a`) or a custom one (`x.pack.01`). Other strings may be words. */
const LOOKS_LIKE_CARD = /^(?:x\.|\d{5}[a-z]?$)/;

/** A list that must hold only objects (instructions, nodes, fields); a problem sentence when it does not. */
function listShape(where: string, value: unknown, problems: string[]): void {
  if (value !== undefined && (!Array.isArray(value) || !value.every(isObj)))
    problems.push(`${where} must be a list of objects`);
}

function definitionProblems(definition: CampaignDefinition, context: CampaignCheckContext): readonly string[] {
  const problems: string[] = [];
  const input: unknown = definition;
  if (!isObj(input)) return ["definition must be a JSON object"];
  if (typeof input.campaignId !== "string" || input.campaignId === "") problems.push("definition needs a campaignId");
  if (typeof input.version !== "string" || input.version === "") problems.push("definition needs a version");
  if (!Array.isArray(input.logFields)) problems.push("logFields must be a list");
  const graph = input.graph;
  if (!isObj(graph) || !Array.isArray(graph.nodes) || graph.nodes.length === 0)
    problems.push("graph needs at least one node");
  const loss = input.loss;
  if (!isObj(loss) || (loss.retry !== "free" && loss.retry !== "byInstruction"))
    problems.push('loss.retry must be "free" or "byInstruction"');
  else if (loss.retryBaseline !== "nodeStart" && loss.retryBaseline !== "keepLog")
    problems.push('loss.retryBaseline must be "nodeStart" or "keepLog"');
  // Everything below reads lists of objects: say so and stop when they are not.
  listShape("logFields", input.logFields, problems);
  listShape("everyNodeSetup", input.everyNodeSetup, problems);
  listShape("everyNodeVictory", input.everyNodeVictory, problems);
  if (isObj(loss)) listShape("loss.everyNodeDefeat", loss.everyNodeDefeat, problems);
  const conditional = input.conditionalInstructions;
  if (conditional !== undefined && !isObj(conditional))
    problems.push("conditionalInstructions must be an object of instructions by id");
  else if (!Object.values(conditional ?? {}).every(isObj))
    problems.push("conditionalInstructions must hold instruction objects");
  if (isObj(graph) && Array.isArray(graph.nodes)) {
    listShape("graph.nodes", graph.nodes, problems);
    for (const node of objList(graph.nodes)) {
      for (const key of ["composition", "setup", "victory", "defeat"])
        listShape(`node "${String(node.id)}": ${key}`, node[key], problems);
    }
  }
  if (problems.length > 0 || !isObj(graph)) return problems;

  const nodes = objList(graph.nodes);
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (typeof node.id !== "string" || node.id === "") {
      problems.push("every node needs an id");
      continue;
    }
    if (nodeIds.has(node.id)) problems.push(`node id "${node.id}" is used twice`);
    nodeIds.add(node.id);
    if (typeof node.label !== "string" || node.label === "") problems.push(`node "${node.id}" needs a label`);
    if (!Array.isArray(node.setup) || !Array.isArray(node.victory))
      problems.push(`node "${node.id}" needs setup and victory lists (empty is fine)`);
    const scenario = node.scenario;
    if (!isObj(scenario)) problems.push(`node "${node.id}" needs a scenario`);
    else if (scenario.kind === "fixed" && !context.isScenarioId(String(scenario.scenarioId)))
      problems.push(`node "${node.id}": scenario "${String(scenario.scenarioId)}" is not a scenario the game has`);
  }

  const fieldKinds = new Map<string, string>();
  for (const field of objList(input.logFields)) {
    if (typeof field.id !== "string" || field.id === "") {
      problems.push("every log field needs an id");
      continue;
    }
    const at = `log field "${field.id}"`;
    if (fieldKinds.has(field.id)) problems.push(`log field id "${field.id}" is used twice`);
    if (field.scope !== "shared" && field.scope !== "perSeat") problems.push(`${at}: bad scope`);
    if (typeof field.label !== "string" || field.label === "") problems.push(`${at} needs a label`);
    const type = field.type;
    if (!isObj(type) || typeof type.kind !== "string" || !FIELD_KINDS.includes(type.kind)) {
      problems.push(`${at} needs a type of kind ${FIELD_KINDS.join(", ")}`);
      fieldKinds.set(field.id, "");
      continue;
    }
    fieldKinds.set(field.id, type.kind);
    if (type.kind === "choice" || type.kind === "strikeList") {
      const options = type.options;
      if (!Array.isArray(options) || options.length === 0 || !options.every((o) => typeof o === "string"))
        problems.push(`${at}: a ${type.kind} field needs an options list of strings`);
    }
    if (
      type.kind === "cardState" &&
      (!Array.isArray(type.cardIds) || !type.cardIds.every((c) => typeof c === "string"))
    )
      problems.push(`${at}: a cardState field needs a cardIds list`);
    for (const bound of ["min", "max"]) {
      if (type.kind === "number" && type[bound] !== undefined && typeof type[bound] !== "number")
        problems.push(`${at}: ${bound} must be a number`);
    }
  }

  const conditionalEntries = Object.entries(isObj(conditional) ? conditional : {});
  const conditionalKeys = new Set(conditionalEntries.map(([key]) => key));
  for (const [key, instruction] of conditionalEntries) {
    if (!isObj(instruction) || instruction.id !== key)
      problems.push(`conditionalInstructions key "${key}" must be the id of the instruction filed under it`);
  }

  const ids = new Set<string>();
  for (const instruction of campaignInstructionsOf(definition)) {
    if (typeof instruction.id !== "string" || instruction.id === "") {
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
    const step: unknown = instruction.step;
    if (!isObj(step) || (step.kind !== "inGame" && step.kind !== "betweenGames" && step.kind !== "record")) {
      problems.push(`${at}: step.kind must be inGame, betweenGames or record`);
      continue;
    }
    for (const field of fieldsIn([step, instruction.when], new Set())) {
      if (!fieldKinds.has(field)) problems.push(`${at}: reads or writes log field "${field}", which is not declared`);
    }
    for (const node of opsOfKind([step, instruction.when], "nodeResolved")) {
      if (!nodeIds.has(String(node.nodeId)))
        problems.push(`${at}: names node "${String(node.nodeId)}", which is not one`);
    }
    for (const node of opsOfKind([step, instruction.when], "nodeProgress")) {
      if (typeof node.node !== "string" || !nodeIds.has(node.node))
        problems.push(`${at}: nodeProgress names node "${String(node.node)}", which is not one`);
    }
    for (const card of cardIdsIn(step, new Set(), true)) {
      if (!context.isCardId(card)) problems.push(`${at}: names card "${card}", which the game does not have`);
    }
    if (step.kind === "betweenGames" && !Array.isArray(step.ops))
      problems.push(`${at}: a betweenGames step needs a list of ops`);
    if (step.kind === "record" && !Array.isArray(step.writes))
      problems.push(`${at}: a record step needs a list of writes`);
    for (const problem of writeProblems(step, fieldKinds, conditionalKeys, context)) problems.push(`${at}: ${problem}`);
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
  for (const field of fieldsIn([input.elimination, loss], new Set())) {
    if (!fieldKinds.has(field)) problems.push(`policy reads log field "${field}", which is not declared`);
  }

  for (const node of nodes) {
    const specs = node.scenarioRuleSpecs;
    if (specs === undefined) continue;
    if (!Array.isArray(specs)) {
      problems.push(`node "${String(node.id)}": scenarioRuleSpecs must be a list`);
      continue;
    }
    try {
      const rules = { trigger: { kind: "constant" as const, rules: specs }, effects: [] };
      for (const problem of validateDefinition(rules))
        problems.push(`node "${String(node.id)}" scenarioRuleSpecs: ${problem}`);
    } catch (error) {
      problems.push(`node "${String(node.id)}": scenarioRuleSpecs could not be checked: ${errorText(error)}`);
    }
  }
  return problems;
}

/**
 * What the runner would throw on, read off one step ahead of time (the engine's `campaign/log.ts` `combine` and
 * `campaign/ops.ts`): a write whose mode its field's type cannot take, a between-games write to a `cardState` field, an
 * instruction list naming an id `conditionalInstructions` lacks, and card choices and grants naming cards that do not
 * exist.
 */
function writeProblems(
  step: Record<string, unknown>,
  fieldKinds: ReadonlyMap<string, string>,
  conditionalKeys: ReadonlySet<string>,
  context: CampaignCheckContext,
): readonly string[] {
  const problems: string[] = [];
  const kindOf = (op: Record<string, unknown>): string | undefined =>
    typeof op.field === "string" ? fieldKinds.get(op.field) : undefined;
  const listedIds = (op: Record<string, unknown>): void => {
    const value = op.value;
    if (kindOf(op) !== "instructionList" || !isObj(value) || value.kind !== "const") return;
    const ids: unknown[] = Array.isArray(value.value) ? value.value : [value.value];
    for (const id of ids) {
      if (typeof id === "string" && !conditionalKeys.has(id))
        problems.push(
          `instruction list "${String(op.field)}" names "${id}", which is not a conditionalInstructions key`,
        );
    }
  };
  for (const op of opsOfKind(step, "setField")) {
    if (kindOf(op) === "cardState")
      problems.push(`setField writes cardState field "${String(op.field)}", which between-games steps cannot write`);
    listedIds(op);
  }
  for (const op of opsOfKind(step, "addToField")) {
    const kind = kindOf(op);
    if (kind !== undefined && kind !== "number")
      problems.push(`addToField needs a number field, "${String(op.field)}" is a ${kind} field`);
  }
  for (const op of opsOfKind(step, "appendToList")) {
    const kind = kindOf(op);
    if (kind !== undefined && !LIST_KINDS.includes(kind))
      problems.push(
        `appendToList needs a cardList, instructionList or strikeList field, "${String(op.field)}" is ${kind}`,
      );
    listedIds(op);
  }
  for (const op of opsOfKind(step, "strike")) {
    const kind = kindOf(op);
    if (kind !== undefined && kind !== "strikeList")
      problems.push(`strike needs a strikeList field, "${String(op.field)}" is a ${kind} field`);
  }
  if (step.kind === "record" && Array.isArray(step.writes)) {
    for (const write of step.writes.filter(isObj)) {
      const kind = kindOf(write);
      if (kind === undefined) continue;
      const name = String(write.field);
      const mode = write.mode;
      if (mode === "add" && kind !== "number")
        problems.push(`an add write needs a number field, "${name}" is a ${kind} field`);
      else if (mode === "append" && !LIST_KINDS.includes(kind))
        problems.push(`an append write needs a list field, "${name}" is a ${kind} field`);
      else if (mode === "strike" && kind !== "strikeList")
        problems.push(`a strike write needs a strikeList field, "${name}" is a ${kind} field`);
      else if (mode !== "set" && mode !== "add" && mode !== "append" && mode !== "strike")
        problems.push(`write to "${name}" has an unknown mode "${String(mode)}"`);
      const value = write.value;
      if (kind === "cardState" && !(mode === "set" && isObj(value) && value.kind === "cardStateOf"))
        problems.push(`cardState field "${name}" can only be set from a cardStateOf query`);
    }
  }

  // Card choices: a `cards` source may list plain words, but ids that look like card codes must exist, and a source
  // whose pick reaches a grant (directly or through `values` of another choice) must name only real cards.
  const grantSlots = new Set<string>();
  for (const grant of opsOfKind(step, "grantCard")) {
    for (const slot of opsOfKind(grant.card, "choice")) if (typeof slot.slot === "string") grantSlots.add(slot.slot);
    for (const constant of opsOfKind(grant.card, "const")) {
      if (typeof constant.value === "string" && !context.isCardId(constant.value))
        problems.push(`grantCard names card "${constant.value}", which the game does not have`);
    }
  }
  const draws = [...opsOfKind(step, "choose"), ...opsOfKind(step, "random")];
  for (let grew = true; grew;) {
    grew = false;
    for (const draw of draws) {
      if (typeof draw.slot !== "string" || !grantSlots.has(draw.slot)) continue;
      for (const slot of opsOfKind(draw.from, "choice")) {
        if (typeof slot.slot === "string" && !grantSlots.has(slot.slot)) {
          grantSlots.add(slot.slot);
          grew = true;
        }
      }
    }
  }
  for (const draw of draws) {
    const reachesGrant = typeof draw.slot === "string" && grantSlots.has(draw.slot);
    for (const source of opsOfKind(draw.from, "cards")) {
      const ids = Array.isArray(source.cardIds)
        ? source.cardIds.filter((id): id is string => typeof id === "string")
        : [];
      for (const id of ids) {
        if ((reachesGrant || LOOKS_LIKE_CARD.test(id)) && !context.isCardId(id))
          problems.push(`a cards choice (slot "${String(draw.slot)}") names "${id}", which the game does not have`);
      }
    }
  }
  return problems;
}
