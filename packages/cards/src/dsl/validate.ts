import type { AbilityDefinition, AbilityRegistry, EffectSpec } from "@mc/engine";

/**
 * A private marker for `allowUnlabeledAttack`'s opt-out (below). A symbol key never appears in `Object.entries`/
 * `Object.keys`, so it is invisible to `checkPlain`'s "is this JSON?" walk and to `bindsOf`'s field scan, and it is
 * dropped by `structuredClone` if a definition object is ever cloned — it never reaches the engine as data.
 */
const UNLABELED_ATTACK = Symbol("ability-scripting-engineer: unlabeled attack, see allowUnlabeledAttack");

/**
 * Opts one ability out of `checkLabels`'s "an attack effect belongs to an (attack)-labeled ability" rule.
 *
 * The rule holds for almost every Core and wave 1 card: a stunned identity cancels a labeled ability's attack
 * outright, so the engine needs the label to know what a stun touches. **Dance of Death** is the documented
 * exception: it prints no "(attack)" label at all, and FAQ "Dance of Death (#4)" (RRG 1.8 p. 59) rules that its
 * first sentence "defines each damage-dealing effect ... as an individual attack" anyway, with a stun cancelling
 * only the first of the three. `dsl/validate.ts` cannot tell that apart from a card that simply forgot its label,
 * so the opt-out must be requested by name, with a citation, right where the ability is defined — never a blanket
 * relaxation of the check.
 *
 * Use only when a card's own text (or an FAQ ruling on it) makes an unlabeled attack effect correct; every other
 * ability with an `attack` effect must still carry `{ label: "attack" }`.
 */
export function allowUnlabeledAttack<T extends AbilityDefinition>(definition: T, reason: { readonly citation: string }): T {
  if (!reason.citation.trim()) throw new Error("allowUnlabeledAttack needs a citation");
  Object.defineProperty(definition, UNLABELED_ATTACK, { value: true, enumerable: false, configurable: false });
  return definition;
}

const hasUnlabeledAttackOptOut = (definition: AbilityDefinition): boolean =>
  (definition as unknown as Record<symbol, unknown>)[UNLABELED_ATTACK] === true;

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
  checkBoostCards(definition, problems);
  checkCost(definition, problems);
  checkScaled(definition, "definition", problems);
  checkBindings(definition, problems);
  return problems;
}

/**
 * `giveBoostCard` is a boost card dealt *outside* an activation, waiting facedown for the enemy's next one (RRG 1.8
 * "Boost, Boost Icon", p. 11). Inside a Boost ability the printed shape is always "1 additional boost card for this
 * activation", which is `modifyAttack({ extraBoostCards })`; the two would resolve differently when the Boost ability
 * belongs to a minion's activation, so the likely slip is rejected. A constant count below 1 gives nothing.
 */
function checkBoostCards(definition: AbilityDefinition, problems: string[]): void {
  for (const effect of allEffects(definition.effects)) {
    if (effect.kind !== "giveBoostCard") continue;
    if (definition.trigger.kind === "boost") {
      problems.push("giveBoostCard deals a facedown boost card outside an activation; inside a Boost ability use modifyAttack({ extraBoostCards }) for \"for this activation\"");
    }
    if (effect.count?.kind === "const" && (!Number.isInteger(effect.count.value) || effect.count.value < 1)) {
      problems.push("giveBoostCard: a constant count must be a whole number of at least 1");
    }
  }
}

/** Cost shapes TypeScript can't see. */
function checkCost(definition: AbilityDefinition, problems: string[]): void {
  const cost = definition.cost;
  if (!cost) return;
  for (const [name, pick] of [["exhaustCards", cost.exhaustCards], ["returnToHand", cost.returnToHand]] as const) {
    if (!pick) continue;
    // RRG 1.8 "Cost" (p. 14): "A cost requiring 'any number' or 'up to' some number of game elements requires a minimum of one".
    if (!Number.isInteger(pick.min) || pick.min < 1) problems.push(`cost ${name}: min must be a whole number of at least 1 (RRG 1.8 "Cost", p. 14)`);
    if (pick.max !== undefined && (!Number.isInteger(pick.max) || pick.max < pick.min)) problems.push(`cost ${name}: max must be a whole number no smaller than min`);
  }
  // `discardFromHand` keeps min 0 legal: "Discard X cards" lets the player choose X (RRG 1.8 "'X' (Value)", p. 29).
  const discard = cost.discardFromHand;
  if (discard && discard.max !== undefined && discard.max < discard.min) problems.push("cost discardFromHand: max must be no smaller than min");
  const random = cost.discardRandomFromHand;
  if (random !== undefined && (!Number.isInteger(random) || random < 1)) problems.push("cost discardRandomFromHand: must be a whole number of at least 1");
  const slots = [
    ...(cost.discardFromHand ? ["discard"] : []),
    ...(cost.payPrintedCostOf ? [cost.payPrintedCostOf.slot] : []),
    ...(cost.exhaustCards ? [cost.exhaustCards.slot] : []),
    ...(cost.returnToHand ? [cost.returnToHand.slot] : []),
  ];
  if (new Set(slots).size !== slots.length) problems.push(`cost components pick into the same slot (${slots.join(", ")}); give each its own slot`);
}

/** `scaled.divide` needs a positive whole divisor; the engine would otherwise read the value as 0. */
function checkScaled(value: unknown, path: string, problems: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => checkScaled(item, `${path}[${i}]`, problems));
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (record.kind === "scaled" && record.divide !== undefined) {
    const divide = record.divide as { by?: unknown; round?: unknown };
    if (typeof divide.by !== "number" || !Number.isInteger(divide.by) || divide.by < 1) problems.push(`${path}: scaled divide.by must be a whole number of at least 1`);
    if (divide.round !== "down" && divide.round !== "up") problems.push(`${path}: scaled divide.round must be "down" or "up"`);
  }
  // An empty list is almost certainly an authoring slip: `sum` of nothing is 0, and `anyTrait`/`anyPrintedResource` of nothing matches no card.
  if (record.kind === "sum" && (!Array.isArray(record.values) || record.values.length === 0)) problems.push(`${path}: sum needs at least one value`);
  if (Array.isArray(record.anyTrait) && record.anyTrait.length === 0) problems.push(`${path}: anyTrait needs at least one trait`);
  if (Array.isArray(record.anyPrintedResource) && record.anyPrintedResource.length === 0) problems.push(`${path}: anyPrintedResource needs at least one resource type`);
  for (const [key, item] of Object.entries(record)) checkScaled(item, `${path}.${key}`, problems);
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
    case "afterNextCardPlayed":
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
  if (kinds.has("attack") && !(definition.label ?? []).includes("attack") && !hasUnlabeledAttackOptOut(definition)) {
    problems.push('an attack effect belongs to an (attack)-labeled ability (opt out with allowUnlabeledAttack for a documented exception like Dance of Death, FAQ "Dance of Death (#4)", RRG 1.8 p. 59)');
  }
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
  // `TargetRef.superlative` ("the X with the highest/lowest Y", docs/phase7-wave1.md §3.12) measures each candidate
  // with that candidate bound to its own slot, "candidate" unless `slot` names another. The engine binds it, never
  // the ability, and only while `measure` is evaluated, so it is readable there and nowhere else.
  if (record.kind === "superlative") {
    checkRefs(record.among, scope, where, problems);
    const candidate = typeof record.slot === "string" ? record.slot : "candidate";
    checkRefs(record.measure, { ...scope, slots: new Set([...scope.slots, candidate]) }, where, problems);
    return;
  }
  if (record.kind === "slot" && typeof record.slot === "string" && !known(scope, scope.slots, record.slot)) {
    problems.push(`${where}: slot "${record.slot}" is read before it is bound`);
  }
  if ((record.kind === "var" || record.kind === "varAtLeast") && typeof record.name === "string" && !known(scope, scope.vars, record.name)) {
    problems.push(`${where}: var "${record.name}" is read before it is bound`);
  }
  if (Array.isArray(record.excludeSlots)) {
    for (const slot of record.excludeSlots) if (typeof slot === "string" && !known(scope, scope.slots, slot)) problems.push(`${where}: excluded slot "${slot}" is never bound`);
  }
  if (typeof record.inSlot === "string" && !known(scope, scope.slots, record.inSlot)) {
    problems.push(`${where}: slot "${record.inSlot}" is read before it is bound`);
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
    // "Discard cards from the encounter deck until N are discarded" binds the discarded cards themselves to `bind`
    // (docs/phase7-wave1.md §3.12), so it belongs with the card-selecting effects above, not the vars-only ones below.
    case "discardEncounterCards":
      if (effect.bind) {
        scope.slots.add(effect.bind);
        scope.prefixes.add(`${effect.bind}.`);
      }
      return;
    case "spendResources":
      scope.prefixes.add(`${effect.bind}.`);
      return;
    // Vars only (`<bind>.made`, `.amount`, `.forcedResponses`, ...): no cards are bound to the slot itself.
    // docs/phase7-wave1.md §3.6 (cancelBoostIcons/cancelBoostAbility), §3.7 (dealIndirectDamage) and §3.8 (moveThreat)
    // each flagged this as a gap for `ability-scripting-engineer` before their cards could be scripted.
    case "cancelBoostIcons":
    case "cancelBoostAbility":
    case "dealIndirectDamage":
    case "moveThreat":
      if (effect.bind) scope.prefixes.add(`${effect.bind}.`);
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
  // "For each threat here" after a discard-self cost (Beat Cop): snapshotted with the counters (`AbilityCost.discardSelf`).
  if (cost?.discardSelf) {
    scope.vars.add("self.threat");
    scope.vars.add("self.damage");
  }
  if (cost?.payPrintedCostOf) scope.slots.add(cost.payPrintedCostOf.slot);
  if (cost?.resourcesX) scope.vars.add(cost.resourcesX.bind);
  for (const pick of [cost?.exhaustCards, cost?.returnToHand]) {
    if (!pick) continue;
    scope.slots.add(pick.slot);
    if (pick.bind) scope.vars.add(pick.bind);
  }
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
