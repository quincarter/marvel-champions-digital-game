import type { KeywordInstance, KeywordName } from "@mc/content";
import { DEFAULT_DEPS, type EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { cardOf, encounterFace, identityFace, isVillain, mainSchemeStageOf, mainSchemeStateOf, textBoxBlank, villainStageOf } from "./query.js";
import { activeAbilityRefs, cardsInPlay, controllerOf, evaluate, matchesQuery, type EffectContext } from "./select.js";
import type { StatusName } from "./spec.js";
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
export function printedKeywordsOf(state: GameState, id: InstanceId): readonly KeywordInstance[] {
  const card = cardOf(state, id);
  if (!card) return [];
  if (state.instances[id]?.facedownAs || textBoxBlank(state, id)) return [];
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

/** Keywords granted by constant abilities in play ("X gains retaliate 1"); RRG "Gains": not printed. */
function grantedKeywords(state: GameState, deps: EngineDeps, id: InstanceId): readonly KeywordInstance[] {
  if (Object.keys(deps.abilities).length === 0) return [];
  const granted: KeywordInstance[] = [];
  for (const sourceId of cardsInPlay(state)) {
    for (const ref of activeAbilityRefs(state, sourceId)) {
      const definition = deps.abilities[ref.id];
      if (definition?.trigger.kind !== "constant" || !definition.trigger.keywordGrants) continue;
      const context: EffectContext = { selfInstanceId: sourceId, controllerId: controllerOf(state, sourceId), event: null, bindings: {}, deps };
      for (const grant of definition.trigger.keywordGrants) {
        if (grant.while && !evaluate(state, grant.while, context)) continue;
        if (matchesQuery(state, id, grant.target, context)) granted.push(grant.keyword);
      }
    }
  }
  return granted;
}

export function keywordsOf(state: GameState, id: InstanceId, deps: EngineDeps = DEFAULT_DEPS): readonly KeywordInstance[] {
  const printed = printedKeywordsOf(state, id);
  const granted = grantedKeywords(state, deps, id);
  return granted.length === 0 ? printed : [...printed, ...granted];
}

export const hasKeyword = (state: GameState, id: InstanceId, name: KeywordName, deps: EngineDeps = DEFAULT_DEPS): boolean =>
  keywordsOf(state, id, deps).some((keyword) => keyword.name === name);

/** RRG "Keywords": repeated instances of a numbered keyword add their values together. */
export function keywordTotal(
  state: GameState,
  id: InstanceId,
  name: "retaliate" | "incite" | "hinder" | "victory",
  deps: EngineDeps = DEFAULT_DEPS,
): number {
  let total = 0;
  for (const keyword of keywordsOf(state, id, deps)) {
    if (keyword.name === name) total += keyword.value;
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

/**
 * RRG "Status Cards": one of each type per character. Steady allows a second
 * stunned and a second confused; stalwart allows neither.
 */
export function statusCapacity(state: GameState, id: InstanceId, status: StatusName, deps: EngineDeps = DEFAULT_DEPS): number {
  if (status === "tough") return 1;
  if (hasKeyword(state, id, "stalwart", deps)) return 0;
  return hasKeyword(state, id, "steady", deps) ? 2 : 1;
}

/** RRG "Steady": a steady character is not stunned/confused until it holds two of that card. */
export function statusActive(state: GameState, id: InstanceId, status: StatusName, deps: EngineDeps = DEFAULT_DEPS): boolean {
  const instance = state.instances[id];
  if (!instance) return false;
  const needed = status === "tough" ? 1 : hasKeyword(state, id, "steady", deps) ? 2 : 1;
  return instance.statuses[status] >= needed;
}
