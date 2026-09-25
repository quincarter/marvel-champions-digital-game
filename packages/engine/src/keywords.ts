import type { KeywordInstance, KeywordName } from "@mc/content";
import { DEFAULT_DEPS, type EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import {
  cardOf,
  encounterFace,
  identityFace,
  isVillain,
  mainSchemeStageOf,
  mainSchemeStateOf,
  villainStageOf,
} from "./query.js";
import { cannotHaveStatus, grantedAttackKeywords } from "./rules.js";
import {
  activeAbilityRefs,
  cardsInPlay,
  controllerOf,
  evaluate,
  matchesQuery,
  keywordsBlankFor,
  lastingReaches,
  resolveValue,
  type EffectContext,
} from "./select.js";
import type { AttackKeyword, StatusName } from "./spec.js";
import type { GameState } from "./state.js";

/**
 * Keyword semantics are engine behaviour keyed off the `KeywordInstance` list on
 * the `@mc/content` card — never a per-card special case. This module is the
 * single lookup layer; the rules themselves live where the relevant game action
 * is resolved (attacks in `select.ts`/`actions.ts`, damage in `resolve/event.ts`,
 * statuses and counters in `effects.ts`).
 *
 * `deps` lets keywords *gained* from constant abilities ("Klaw gains retaliate
 * 1") count; without it only printed keywords are seen.
 */
export function printedKeywordsOf(
  state: GameState,
  id: InstanceId,
  deps: EngineDeps = DEFAULT_DEPS,
): readonly KeywordInstance[] {
  const card = cardOf(state, id);
  if (!card) return [];
  // RRG 1.8 "Blank" (p. 10): no printed text in the text box, keywords included. `deps` makes a *constant*
  // class-wide blank visible (Tech Theft); the lasting kind needs no registry.
  if (state.instances[id]?.facedownAs || state.instances[id]?.treatedAs || keywordsBlankFor(state, id, deps)) return [];
  const face = encounterFace(state, id);
  if (face) return face.keywords;
  if (card.type === "villain") {
    return isVillain(state, id) ? villainStageOf(state, id).keywords : [];
  }
  if (card.type === "main_scheme") {
    const scheme = mainSchemeStateOf(state, id);
    return scheme ? mainSchemeStageOf(state, scheme).keywords : [];
  }
  if (card.type === "hero_identity") {
    // Keywords are per face: read the face the identity is currently showing.
    const player = state.players.find((p) => p.identity.instanceId === id);
    if (!player) return [];
    return identityFace(state, player).face.keywords;
  }
  return "keywords" in card ? card.keywords : [];
}

/**
 * The form types a card prints, on either face ("Energy form.", "Mass form."; docs/phase7-wave4.md §3.1), read from the
 * card data even while it is facedown or blanked: the owner knows their own facedown card (`TargetQuery.printedForm`).
 */
export function printedFormTypes(state: GameState, id: InstanceId): readonly string[] {
  const card = cardOf(state, id);
  if (!card) return [];
  const faces: readonly (readonly KeywordInstance[])[] = [
    "keywords" in card ? card.keywords : [],
    "flipSide" in card && card.flipSide ? card.flipSide.keywords : [],
  ];
  const types = faces.flatMap((keywords) => keywords.flatMap((k) => (k.name === "form" ? [k.formType] : [])));
  return [...new Set(types)];
}

/**
 * The additional form a card in play grants right now: its showing face's form keyword. A facedown card shows none (RRG
 * 1.8 "Facedown"), and neither does a blanked text box (RRG 1.8 "Blank", p. 10).
 */
export function activeFormType(state: GameState, id: InstanceId, deps: EngineDeps = DEFAULT_DEPS): string | undefined {
  const form = printedKeywordsOf(state, id, deps).find((k) => k.name === "form");
  return form?.name === "form" ? form.formType : undefined;
}

/** Set while a live keyword value (`KeywordGrantSpec.value`) is being read: a re-entrancy guard, not game state. */
let readingGrantValue = false;

/** Keywords granted by constant abilities in play ("X gains retaliate 1"); RRG "Gains": not printed. */
function grantedKeywords(state: GameState, deps: EngineDeps, id: InstanceId): readonly KeywordInstance[] {
  const granted: KeywordInstance[] = [];
  // "She gains retaliate 1 until the end of the phase" (`grantKeywordUntil`, docs/phase7-wave4.md §3.39).
  for (const effect of state.lastingEffects) {
    if (effect.kind === "keywordGrant" && lastingReaches(state, effect, id, deps)) granted.push(effect.keyword);
  }
  if (Object.keys(deps.abilities).length === 0) return granted;
  for (const sourceId of cardsInPlay(state)) {
    for (const ref of activeAbilityRefs(state, sourceId, deps)) {
      const definition = deps.abilities[ref.id];
      if (definition?.trigger.kind !== "constant" || !definition.trigger.keywordGrants) continue;
      const context: EffectContext = {
        selfInstanceId: sourceId,
        controllerId: controllerOf(state, sourceId),
        event: null,
        bindings: {},
        deps,
      };
      for (const grant of definition.trigger.keywordGrants) {
        if (grant.while && !evaluate(state, grant.while, context)) continue;
        if (!matchesQuery(state, id, grant.target, context)) continue;
        if (!grant.value) {
          granted.push(grant.keyword);
          continue;
        }
        // "Retaliate X, where X is …" (docs/phase7-wave4.md §3.53): read live. While one such X is being read, other
        // live-valued grants are skipped, so an X that asks about keywords cannot re-enter this scan.
        if (readingGrantValue) continue;
        readingGrantValue = true;
        let value: number;
        try {
          value = resolveValue(state, grant.value, context, deps);
        } finally {
          readingGrantValue = false;
        }
        if (value > 0 && "value" in grant.keyword) granted.push({ ...grant.keyword, value });
      }
    }
  }
  return granted;
}

export function keywordsOf(
  state: GameState,
  id: InstanceId,
  deps: EngineDeps = DEFAULT_DEPS,
): readonly KeywordInstance[] {
  const printed = printedKeywordsOf(state, id, deps);
  const granted = grantedKeywords(state, deps, id);
  return granted.length === 0 ? printed : [...printed, ...granted];
}

export const hasKeyword = (
  state: GameState,
  id: InstanceId,
  name: KeywordName,
  deps: EngineDeps = DEFAULT_DEPS,
): boolean => keywordsOf(state, id, deps).some((keyword) => keyword.name === name);

/** RRG "Keywords": repeated instances of a numbered keyword add their values together. */
export function keywordTotal(
  state: GameState,
  id: InstanceId,
  name: "retaliate" | "incite" | "hinder" | "victory",
  deps: EngineDeps = DEFAULT_DEPS,
): number {
  let total = 0;
  for (const keyword of keywordsOf(state, id, deps)) {
    if (keyword.name !== name) continue;
    total += keyword.value;
    // "Hinder 2[per_hero]": RRG 1.8 "Per Player Icon" (p. 32) multiplies by the players who started the scenario
    // (docs/phase7-wave3.md §1.3).
    if (keyword.name === "hinder") total += (keyword.perPlayer ?? 0) * state.startingPlayerCount;
  }
  return total;
}

export const usesKeyword = (
  state: GameState,
  id: InstanceId,
  deps: EngineDeps = DEFAULT_DEPS,
): Extract<KeywordInstance, { name: "uses" }> | undefined =>
  keywordsOf(state, id, deps).find(
    (keyword): keyword is Extract<KeywordInstance, { name: "uses" }> => keyword.name === "uses",
  );

export const ATTACK_KEYWORDS: readonly AttackKeyword[] = ["piercing", "ranged", "overkill"];

/**
 * Everything an attack needs to know for `attackKeywordsOf`. Nothing here is stored: an attack's keywords are
 * recomputed once, when the attack pushes its damage, and stamped on that damage event.
 */
export interface AttackKeywordContext {
  readonly attackerInstanceId: InstanceId;
  /** The card whose ability is making the attack ("your [Arrow] attacks"); null for a basic attack or an enemy activation. */
  readonly viaInstanceId?: InstanceId | null;
  /** Whether this is a character's basic attack ("your basic attacks gain piercing"); false for an enemy activation. */
  readonly basic?: boolean;
  /** Keywords the attack carries itself: `attack.keywords` ("this attack gains piercing"). */
  readonly keywords?: readonly AttackKeyword[];
  /** The attack/activation event frame's vars, where `modifyAttack` records a grant made mid-activation. */
  readonly vars?: Readonly<Record<string, number>>;
}

/**
 * The `AttackKeyword`s one attack has, from every source at once (RRG 1.8 "Piercing", p. 32; "Ranged", p. 35;
 * "Overkill", p. 31 — each is worded as a property of an attack, not of a character):
 *
 * 1. the attacker's own printed or granted keyword (Crossbones "gains piercing while …");
 * 2. `attack.keywords` on the effect that made it ("this attack gains piercing", Piercing Strike);
 * 3. `modifyAttack.keywords` during the activation, recorded as a var named after the keyword on the attack's own
 *    event frame ("the attack gains piercing", Crossfire's boost) — the same var `overkill` has always used;
 * 4. a constant `attackKeywords` rule in play ("each of your [Arrow] attacks gain ranged", Hawkeye's Bow).
 */
export function attackKeywordsOf(
  state: GameState,
  deps: EngineDeps,
  attack: AttackKeywordContext,
): readonly AttackKeyword[] {
  const via = attack.viaInstanceId ?? null;
  const fromRules = grantedAttackKeywords(state, deps, attack.attackerInstanceId, via, attack.basic === true);
  return ATTACK_KEYWORDS.filter(
    (name) =>
      hasKeyword(state, attack.attackerInstanceId, name, deps) ||
      attack.keywords?.includes(name) === true ||
      (attack.vars?.[name] ?? 0) > 0 ||
      fromRules.includes(name),
  );
}

/**
 * RRG "Status Cards": one of each type per character. Steady allows a second
 * stunned and a second confused; stalwart allows neither.
 */
export function statusCapacity(
  state: GameState,
  id: InstanceId,
  status: StatusName,
  deps: EngineDeps = DEFAULT_DEPS,
): number {
  // "Ronan the Accuser cannot be stunned." (`ron` 90001; `cannotHaveStatus`, docs/phase7-wave3.md §3.7).
  if (cannotHaveStatus(state, deps, id, status)) return 0;
  if (status === "tough") return 1;
  if (hasKeyword(state, id, "stalwart", deps)) return 0;
  return hasKeyword(state, id, "steady", deps) ? 2 : 1;
}

/** RRG "Steady": a steady character is not stunned/confused until it holds two of that card. */
export function statusActive(
  state: GameState,
  id: InstanceId,
  status: StatusName,
  deps: EngineDeps = DEFAULT_DEPS,
): boolean {
  const instance = state.instances[id];
  if (!instance) return false;
  const needed = status === "tough" ? 1 : hasKeyword(state, id, "steady", deps) ? 2 : 1;
  return instance.statuses[status] >= needed;
}
