import { PLAYABLE_DEPS } from "@mc/cards";
import type { AbilityRegistry } from "@mc/engine";

/**
 * The DSL features a pack's abilities use (docs/custom-content-packs.md §6, §11.2): a deterministic, sorted list of
 * keys read off the plain-data `AbilityDefinition`s, so a client can compare a pack's `requires.dslFeatures` with its
 * own `SUPPORTED_DSL_FEATURES` before loading it.
 *
 * Key naming (`<category>:<name>`):
 * - `trigger:<kind>`: the trigger kind (`action`, `interrupt`, `response`, `constant`, ...);
 * - `trigger-option:<key>`: an extra field the trigger carries (`wouldBeDealt`, `keywordGrants`, ...);
 * - `event:<name>`: an event kind an interrupt/response pattern listens for (`event:dealDamage`);
 * - `effect:<kind>`: an effect (`effect:dealDamage`), at any depth of `then` / `otherwise` / `effects` / option lists;
 * - `cost:<key>`: a part of the ability's cost (`cost:exhaustSelf`, `cost:resources`);
 * - `rule:<kind>`: a rule a constant ability installs (`rule:blankTextBox`);
 * - `expr:<kind>`: any other discriminated object: a value, predicate, card selector or amount (`expr:scaled`);
 * - `ability:<key>`: a top-level flag of the definition (`ability:minX`, `ability:activeIn`).
 *
 * The categories are deliberately coarse: a pack is refused only for a feature the client has never had, not for a
 * known kind in a position the base game happens not to use.
 */
export function dslFeatures(registry: AbilityRegistry): readonly string[] {
  const found = new Set<string>();
  for (const definition of Object.values(registry)) collectDefinition(definition, found);
  return [...found].sort();
}

/** Keys whose arrays are effect lists. */
const EFFECT_LISTS: ReadonlySet<string> = new Set(["effects", "then", "otherwise", "with", "wouldPlaceThreat"]);

type Json = unknown;
const isRecord = (value: Json): value is Record<string, Json> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function collectDefinition(definition: object, found: Set<string>): void {
  for (const [key, value] of Object.entries(definition)) {
    if (value === undefined) continue;
    switch (key) {
      case "trigger":
        collectTrigger(value, found);
        break;
      case "cost":
        collectCost(value, found);
        break;
      case "effects":
        walk(value, "effects", found);
        break;
      case "label":
      case "limit":
      case "generates":
        break;
      default:
        found.add(`ability:${key}`);
        walk(value, key, found);
    }
  }
}

function collectTrigger(trigger: Json, found: Set<string>): void {
  if (!isRecord(trigger)) return;
  if (typeof trigger.kind === "string") found.add(`trigger:${trigger.kind}`);
  for (const [key, value] of Object.entries(trigger)) {
    if (key === "kind" || value === undefined) continue;
    if (key === "on") {
      walk(value, "on", found, true);
      continue;
    }
    found.add(`trigger-option:${key}`);
    walk(value, key, found);
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
      walk(
        Object.fromEntries(Object.entries(value).filter(([k]) => k !== "then" && k !== "else")),
        "conditional",
        found,
      );
    } else {
      walk(value, key, found);
    }
  }
}

function walk(value: Json, key: string, found: Set<string>, isPattern = false): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, key, found, isPattern);
    return;
  }
  if (!isRecord(value)) return;
  if (typeof value.kind === "string") {
    const category = EFFECT_LISTS.has(key) ? "effect" : key === "rules" ? "rule" : "expr";
    found.add(`${category}:${value.kind}`);
  }
  // An event pattern: `{ on: "dealDamage" | ["enemyScheme", ...], ... }`, nested in `anyOf`.
  const on = value.on;
  if ((isPattern || value.kind === undefined) && (typeof on === "string" || isStringArray(on))) {
    for (const event of typeof on === "string" ? [on] : on) found.add(`event:${event}`);
  }
  for (const [childKey, child] of Object.entries(value)) {
    if (childKey === "on" && (typeof child === "string" || isStringArray(child))) continue;
    // A list of `chooseOne` options carries an `effects` list per option.
    walk(child, childKey, found, childKey === "anyOf");
  }
}

const isStringArray = (value: Json): value is readonly string[] =>
  Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string");

/**
 * Every feature this build of the game's own scripts use: the walk over the whole playable registry. A pack whose
 * `requires.dslFeatures` has a key outside this list is refused as "needs an app update" (§6). The engine's types
 * are erased at runtime, so this is what the base game exercises rather than every discriminant the types allow; a
 * new primitive a pack needs and no base card uses has to ship with a base card or be added here.
 */
export const SUPPORTED_DSL_FEATURES: readonly string[] = dslFeatures(PLAYABLE_DEPS.abilities);
