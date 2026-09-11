import type { AbilityDefinition, AbilityRegistry, EffectSpec } from "@mc/engine";

/**
 * Shape validation for compiled abilities. The engine trusts its registry, so
 * authoring mistakes that TypeScript can't see are caught here, when a card
 * module is defined:
 * - the definition is plain JSON (no `undefined`, functions, NaN);
 * - triggers are well formed (interrupts/responses have a pattern, constants have no effects);
 * - "(attack)"/"(thwart)" labels have a matching attack/thwart effect;
 * - every slot or var an effect reads was bound earlier (by a cost, a choice, or a `bind`).
 */
export function validateDefinition(definition: AbilityDefinition): readonly string[] {
  const problems: string[] = [];
  checkPlain(definition, "definition", problems);
  checkTrigger(definition, problems);
  checkLabels(definition, problems);
  checkBindings(definition, problems);
  return problems;
}

function checkPlain(value: unknown, path: string, problems: string[]): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) problems.push(`${path} is not a finite number`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => checkPlain(item, `${path}[${index}]`, problems));
    return;
  }
  if (typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype) problems.push(`${path} is not a plain object`);
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) problems.push(`${path}.${key} is undefined (omit the key instead)`);
      else checkPlain(item, `${path}.${key}`, problems);
    }
    return;
  }
  problems.push(`${path} is a ${typeof value}, not JSON`);
}

function checkTrigger(definition: AbilityDefinition, problems: string[]): void {
  const trigger = definition.trigger;
  if ((trigger.kind === "interrupt" || trigger.kind === "response") && !trigger.on) problems.push(`${trigger.kind} needs an event pattern`);
  if (trigger.kind === "constant" && definition.effects.length > 0) problems.push("a constant ability has no effects");
  if (definition.generates !== undefined && trigger.kind !== "resource") problems.push("only resource abilities generate resources");
  if (trigger.kind === "constant" && (definition.cost || definition.limit || definition.label)) problems.push("a constant ability has no cost, limit or label");
}

/** Every effect in the tree, including nested branches and deferred effects. */
function allEffects(effects: readonly EffectSpec[]): EffectSpec[] {
  return effects.flatMap((effect) => [effect, ...allEffects(nestedLists(effect).flat())]);
}

function nestedLists(effect: EffectSpec): (readonly EffectSpec[])[] {
  switch (effect.kind) {
    case "if":
      return [effect.then, effect.otherwise ?? []];
    case "chooseOne":
      return effect.options.map((o) => o.effects);
    case "forEachPlayer":
    case "atEndOfAttack":
    case "atEndOfRound":
      return [effect.effects];
    case "replaceTriggeringEvent":
      return [effect.with];
    default:
      return [];
  }
}

/**
 * An attack/thwart effect is what the engine resolves as the labeled action, so
 * it must sit on an ability with that label (stunned/confused cancel it). The
 * converse isn't required: a label can decorate other effects (Emergency is a
 * "(thwart)" that reduces the threat a scheme activation places).
 */
function checkLabels(definition: AbilityDefinition, problems: string[]): void {
  const kinds = new Set(allEffects(definition.effects).map((e) => e.kind));
  if (kinds.has("attack") && !(definition.label ?? []).includes("attack")) problems.push("an attack effect belongs to an (attack)-labeled ability");
  if (kinds.has("thwart") && !(definition.label ?? []).includes("thwart")) problems.push("a thwart effect belongs to a (thwart)-labeled ability");
}

interface Scope {
  readonly slots: Set<string>;
  readonly vars: Set<string>;
  /** `bind` prefixes: `<bind>.anything` is readable once the binding effect has run. */
  readonly prefixes: Set<string>;
}

const known = (scope: Scope, set: Set<string>, name: string): boolean =>
  set.has(name) || [...scope.prefixes].some((prefix) => name.startsWith(prefix));

/** Scans an effect's own fields (not its nested effect lists) for slot and var references. */
function checkRefs(value: unknown, scope: Scope, where: string, problems: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) checkRefs(item, scope, where, problems);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const record = value as Record<string, unknown>;
  if (record.kind === "slot" && typeof record.slot === "string" && !known(scope, scope.slots, record.slot)) {
    problems.push(`${where}: slot "${record.slot}" is read before it is bound`);
  }
  if ((record.kind === "var" || record.kind === "varAtLeast") && typeof record.name === "string" && !known(scope, scope.vars, record.name)) {
    problems.push(`${where}: var "${record.name}" is read before it is bound`);
  }
  if (Array.isArray(record.excludeSlots)) {
    for (const slot of record.excludeSlots) if (typeof slot === "string" && !known(scope, scope.slots, slot)) problems.push(`${where}: excluded slot "${slot}" is never bound`);
  }
  for (const [key, item] of Object.entries(record)) {
    if (key === "effects" || key === "then" || key === "otherwise" || key === "with" || key === "options") continue;
    checkRefs(item, scope, where, problems);
  }
}

function bindsOf(effect: EffectSpec, scope: Scope): void {
  switch (effect.kind) {
    case "chooseTarget":
    case "chooseCards":
    case "choosePlayer":
    case "bindTargets":
      scope.slots.add(effect.slot);
      return;
    case "selectCards":
      scope.slots.add(effect.slot);
      scope.vars.add(`${effect.slot}.count`);
      return;
    case "discardEncounterUntil":
      scope.slots.add(effect.bind);
      return;
    case "moveCards":
    case "enemyAttack":
    case "enemyScheme":
    case "attack":
    case "thwart":
    case "dealDamage":
    case "heal":
    case "placeThreat":
    case "removeThreat":
      if (effect.bind) {
        scope.slots.add(effect.bind);
        scope.prefixes.add(`${effect.bind}.`);
      }
      return;
    case "spendResources":
      scope.prefixes.add(`${effect.bind}.`);
      return;
    default:
      return;
  }
}

function walk(effects: readonly EffectSpec[], scope: Scope, path: string, problems: string[]): void {
  effects.forEach((effect, index) => {
    const where = `${path}[${index}] ${effect.kind}`;
    if (effect.kind === "chooseOne") {
      effect.options.forEach((option, i) => {
        if (option.condition) checkRefs(option.condition, scope, `${where} option ${i}`, problems);
        walk(option.effects, scope, `${where}.options[${i}]`, problems);
      });
      return;
    }
    checkRefs(effect, scope, where, problems);
    nestedLists(effect).forEach((list, i) => walk(list, scope, `${where}/${i}`, problems));
    bindsOf(effect, scope);
  });
}

function checkBindings(definition: AbilityDefinition, problems: string[]): void {
  const scope: Scope = { slots: new Set(), vars: new Set(), prefixes: new Set(["paid.", "sequence.", "self.counters."]) };
  const cost = definition.cost;
  if (cost?.discardFromHand) {
    scope.slots.add("discard");
    if (cost.discardFromHand.bind) scope.vars.add(cost.discardFromHand.bind);
  }
  if (cost?.payPrintedCostOf) scope.slots.add(cost.payPrintedCostOf.slot);
  if (cost?.resourcesX) scope.vars.add(cost.resourcesX.bind);
  if (definition.trigger.kind === "constant") {
    checkRefs(definition.trigger, scope, "constant", problems);
    return;
  }
  walk(definition.effects, scope, "effects", problems);
}

const ABILITY_ID = /^\d{5}[a-z]?\.[a-z0-9-]+$/;

/**
 * Defines a module of card abilities keyed by their `AbilityReference` ids
 * (`<cardCode>.<slug>`). Throws on the first import if any definition is
 * malformed, so a broken card fails loudly in every test that loads it.
 */
export function defineAbilities<const T extends Readonly<Record<string, AbilityDefinition>>>(definitions: T): T {
  const problems: string[] = [];
  for (const [id, definition] of Object.entries(definitions)) {
    if (!ABILITY_ID.test(id)) problems.push(`${id}: not a <cardCode>.<slug> ability id`);
    for (const problem of validateDefinition(definition)) problems.push(`${id}: ${problem}`);
  }
  if (problems.length > 0) throw new Error(`invalid ability definitions:\n  ${problems.join("\n  ")}`);
  return definitions;
}

/** Merges ability modules into one registry; an id defined twice is an error. */
export function mergeRegistries(...modules: readonly Readonly<Record<string, AbilityDefinition>>[]): AbilityRegistry {
  const merged: Record<string, AbilityDefinition> = {};
  for (const module of modules) {
    for (const [id, definition] of Object.entries(module)) {
      if (id in merged) throw new Error(`ability ${id} is defined twice`);
      merged[id] = definition;
    }
  }
  return merged;
}
