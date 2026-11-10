import { CAMPAIGNS, PLAYABLE_DEPS, campaignInstructionsOf } from "@mc/cards";
import type { AbilityRegistry, CampaignDefinition } from "@mc/engine";

/**
 * The DSL features a pack's abilities use (docs/custom-content-packs.md §6, §11.2): a deterministic, sorted list of
 * keys read off the plain-data `AbilityDefinition`s, so a client can compare a pack's `requires.dslFeatures` with its
 * own `SUPPORTED_DSL_FEATURES` before loading it.
 *
 * Key naming (`<category>:<name>`; literal values are never recorded, only kinds and field names):
 * - `trigger:<kind>`, `trigger-option:<key>` and `trigger-option:<key>.<field>`;
 * - `event:<name>`: an event kind an interrupt/response pattern listens for;
 * - `effect:<kind>` and `effect:<kind>.<field>`: an effect, found only in an effect slot (the ability's `effects`, an
 *   `if`'s `then`/`otherwise`, a `chooseOne` option's `effects`, a `sentence`/`forEachCard`/... `effects`, a
 *   `replaceTriggeringEvent`'s `with`, an `enemyScheme`'s `wouldPlaceThreat`);
 * - `cost:<key>` and `cost:<key>.<field>`, recursing into `either` and `conditional` branches;
 * - `rule:<kind>` and `rule:<kind>.<field>`: a rule a constant ability installs;
 * - `expr:<kind>` and `expr:<kind>.<field>`: any other discriminated object (a value, predicate, selector, amount);
 * - `ability:<key>` and `ability:<key>.<field>`: a top-level field of the definition other than trigger, cost and
 *   effects (`ability:limit`, `ability:label`, `ability:generates`, `ability:minX`, `ability:unlabeledAttack`).
 *
 * - A pack campaign's definitions add `campaign-graph:<kind>`, `campaign-field:<kind>`, `campaign-window:<window>`,
 *   `campaign:<kind>` and `campaign:<kind>.<field>` (every op, value, predicate, record write and policy object a step
 *   or policy holds); an in-game step's effects and a node's `scenarioRuleSpecs` are read like an ability's
 *   (`effect:*`, `rule:*`).
 *
 * The `.<field>` keys make a field a client has never read (a new option on a known effect) a feature of its own,
 * so an old client refuses the pack instead of silently ignoring it.
 */
export function dslFeatures(
  registry: AbilityRegistry,
  campaigns: readonly CampaignDefinition[] = [],
): readonly string[] {
  const found = new Set<string>();
  for (const definition of Object.values(registry ?? {})) {
    if (isRecord(definition)) collectDefinition(definition, found);
  }
  for (const definition of campaigns) {
    if (isRecord(definition)) collectCampaign(definition as unknown as Record<string, Json>, found);
  }
  return [...found].sort();
}

/** The definitions a pack's `campaigns/*.json` entries carry (`{ definition, ... }`); anything else is skipped. */
export function campaignDefinitionsOf(campaigns: readonly unknown[] | undefined): readonly CampaignDefinition[] {
  return (campaigns ?? []).flatMap((entry) =>
    isRecord(entry) && isRecord(entry.definition) ? [entry.definition as unknown as CampaignDefinition] : [],
  );
}

/** `campaign:<kind>` and `campaign:<kind>.<field>` for every discriminated object in a campaign step or policy. */
function collectCampaignExprs(value: Json, found: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectCampaignExprs(item, found);
    return;
  }
  if (!isRecord(value)) return;
  if (typeof value.kind === "string") {
    found.add(`campaign:${value.kind}`);
    recordFields(`campaign:${value.kind}`, value, found);
  }
  for (const child of Object.values(value)) collectCampaignExprs(child, found);
}

function collectCampaign(definition: Record<string, Json>, found: Set<string>): void {
  const graph = definition.graph;
  if (isRecord(graph) && typeof graph.kind === "string") found.add(`campaign-graph:${graph.kind}`);
  for (const field of Array.isArray(definition.logFields) ? definition.logFields : []) {
    if (isRecord(field) && isRecord(field.type) && typeof field.type.kind === "string")
      found.add(`campaign-field:${field.type.kind}`);
  }
  let instructions: readonly Json[] = [];
  try {
    instructions = campaignInstructionsOf(definition as unknown as CampaignDefinition);
  } catch {
    // A malformed definition: validatePack reports it; there is nothing more to read here.
  }
  for (const instruction of instructions) {
    if (!isRecord(instruction)) continue;
    collectCampaignExprs([instruction.when, instruction.whenModes], found);
    const step = instruction.step;
    if (!isRecord(step)) continue;
    if (step.kind === "inGame") {
      if (typeof step.window === "string") found.add(`campaign-window:${step.window}`);
      visit(step.effects, "effect", found);
    } else collectCampaignExprs(step, found);
  }
  const nodes = isRecord(graph) && Array.isArray(graph.nodes) ? graph.nodes : [];
  for (const node of nodes) {
    if (isRecord(node) && node.scenarioRuleSpecs !== undefined) visit(node.scenarioRuleSpecs, "rule", found);
  }
  collectCampaignExprs([definition.elimination, definition.loss], found);
}

type Json = unknown;
type Slot = "effect" | "rule" | "expr";
const isRecord = (value: Json): value is Record<string, Json> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isStringArray = (value: Json): value is readonly string[] =>
  Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string");

/** The effect kinds that hold effect lists under keys other than `effects` (`nestedLists` in the DSL's validator). */
const EFFECT_SLOTS: Readonly<Record<string, readonly string[]>> = {
  if: ["then", "otherwise"],
  replaceTriggeringEvent: ["with"],
  enemyScheme: ["wouldPlaceThreat"],
};

/** What a child under `key` of a node of `kind` (in slot `slot`) is: an effect, a rule or any other expression. */
function slotFor(kind: string | undefined, slot: Slot, key: string): Slot {
  if (key === "effects") return "effect";
  if (key === "rules") return "rule";
  if (slot === "effect" && kind !== undefined && EFFECT_SLOTS[kind]?.includes(key)) return "effect";
  return "expr";
}

function collectDefinition(definition: Record<string, Json>, found: Set<string>): void {
  for (const [key, value] of Object.entries(definition)) {
    if (value === undefined) continue;
    if (key === "trigger") collectTrigger(value, found);
    else if (key === "cost") collectCost(value, found);
    else if (key === "effects") visit(value, "effect", found);
    else {
      found.add(`ability:${key}`);
      recordFields(`ability:${key}`, value, found);
      visit(value, slotFor(undefined, "expr", key), found);
    }
  }
}

/** `<prefix>.<field>` for each field of a plain-object value. */
function recordFields(prefix: string, value: Json, found: Set<string>, skip = "kind"): void {
  if (!isRecord(value)) return;
  for (const [field, child] of Object.entries(value)) {
    if (field !== skip && child !== undefined) found.add(`${prefix}.${field}`);
  }
}

function collectTrigger(trigger: Json, found: Set<string>): void {
  if (!isRecord(trigger)) return;
  if (typeof trigger.kind === "string") found.add(`trigger:${trigger.kind}`);
  for (const [key, value] of Object.entries(trigger)) {
    if (key === "kind" || value === undefined) continue;
    if (key === "on") {
      visit(value, "expr", found, true);
      continue;
    }
    found.add(`trigger-option:${key}`);
    recordFields(`trigger-option:${key}`, value, found);
    visit(value, slotFor(undefined, "expr", key), found);
  }
}

function collectCost(cost: Json, found: Set<string>): void {
  if (!isRecord(cost)) return;
  for (const [key, value] of Object.entries(cost)) {
    if (value === undefined) continue;
    found.add(`cost:${key}`);
    if (key === "either" && Array.isArray(value)) {
      for (const branch of value) collectCost(branch, found);
    } else if (key === "conditional" && isRecord(value)) {
      collectCost(value.then, found);
      collectCost(value.else, found);
      const { then: _then, else: _else, ...rest } = value;
      recordFields("cost:conditional", rest, found);
      visit(rest, "expr", found);
    } else {
      recordFields(`cost:${key}`, value, found);
      visit(value, "expr", found);
    }
  }
}

function visit(value: Json, slot: Slot, found: Set<string>, isPattern = false): void {
  if (Array.isArray(value)) {
    for (const item of value) visit(item, slot, found, isPattern);
    return;
  }
  if (!isRecord(value)) return;
  const kind = typeof value.kind === "string" ? value.kind : undefined;
  if (kind !== undefined) {
    found.add(`${slot}:${kind}`);
    recordFields(`${slot}:${kind}`, value, found);
  }
  // An event pattern: `{ on: "dealDamage" | ["enemyScheme", ...], ... }`, nested in `anyOf`.
  const on = value.on;
  const hearsEvents = (isPattern || kind === undefined) && (typeof on === "string" || isStringArray(on));
  if (hearsEvents)
    for (const event of typeof on === "string" ? [on] : (on as readonly string[])) found.add(`event:${event}`);
  for (const [childKey, child] of Object.entries(value)) {
    if (hearsEvents && childKey === "on") continue;
    visit(child, slotFor(kind, slot, childKey), found, childKey === "anyOf");
  }
}

/**
 * Every feature this build of the game's own scripts use: the walk over the whole playable registry. A pack whose
 * `requires.dslFeatures` has a key outside this list is refused as "needs an app update" (§6). The engine's types
 * are erased at runtime, so this is what the base game exercises rather than every discriminant the types allow; a
 * new primitive a pack needs and no base card uses has to ship with a base card or be added here.
 */
export const SUPPORTED_DSL_FEATURES: readonly string[] = dslFeatures(PLAYABLE_DEPS.abilities, Object.values(CAMPAIGNS));
