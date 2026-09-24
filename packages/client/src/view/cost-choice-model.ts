/**
 * Choosing an either/or cost branch, or how many counters an "up to N" cost removes — made up front, like every
 * other cost pick (RRG 1.8 "Initiating Abilities", p. 24, step 5; docs/phase7-wave3.md §3.32, §3.36). `legalActions`
 * offers the payable branches (`LegalAction.costBranches`) and the counter range (`LegalAction.costCounters`), but
 * `example` only ever answers with the engine's own default (the first payable branch; the most counters) — the
 * same gap `discard-choice-model.ts` fills for a "discard N cards" cost, mirrored here for these two.
 *
 * The branch labels are drawn straight from the ability's own printed `AbilityCost` shape (a small, generic
 * describer covering the handful of cost kinds cycle 2 actually combines in an `either`), not restated as prose
 * anywhere else — so a new `either` cost the pool adds later still gets a legible label with no client change,
 * as long as its branches use vocabulary this file already knows.
 */
import { activeAbilityRefs, type AbilityCost, type EngineDeps, type GameState, type LegalAction } from "@mc/engine";

export type CostChoicePrompt =
  | { readonly kind: "branch"; readonly options: readonly { readonly branch: number; readonly label: string }[] }
  | { readonly kind: "counters"; readonly min: number; readonly max: number; readonly label: string };

/** The `AbilityCost` an action's `useAbility`/action-triggered `playCard` would pay, mirroring `discard-choice-model.ts`'s own lookup. */
function actionAbilityCost(state: GameState, deps: EngineDeps, action: LegalAction["action"]): AbilityCost | undefined {
  if (action.kind === "useAbility") return deps.abilities[action.abilityId]?.cost;
  if (action.kind !== "playCard") return undefined;
  for (const ref of activeAbilityRefs(state, action.instanceId)) {
    const definition = deps.abilities[ref.id];
    if (definition?.trigger.kind === "action") return definition.cost;
  }
  return undefined;
}

/** A short, generic phrase for one cost, covering the shapes cycle 2's `either` branches and counter costs use. */
function describeCost(cost: AbilityCost): string {
  const parts: string[] = [];
  if (cost.exhaustIdentity) parts.push("exhaust your hero");
  else if (cost.exhaustSelf) parts.push("exhaust this card");
  if (cost.resources !== undefined) {
    parts.push(
      typeof cost.resources === "number"
        ? `spend ${cost.resources} resource${cost.resources === 1 ? "" : "s"} of any type`
        : `spend ${Object.entries(cost.resources)
            .filter(([, n]) => (n ?? 0) > 0)
            .map(([type, n]) => `${n} ${type}`)
            .join(", ")}`,
    );
  }
  if (cost.resourcesX) parts.push(`spend up to ${cost.resourcesX.max ?? "X"} resources of any type`);
  if (cost.spendCounters) {
    const { amount, counterType, upTo } = cost.spendCounters;
    parts.push(`remove ${upTo ? "up to " : ""}${amount} ${counterType} counter${amount === 1 ? "" : "s"}`);
  }
  if (cost.dealEncounterCards) parts.push(`deal yourself ${cost.dealEncounterCards} facedown encounter card`);
  if (cost.discardFromDeck) parts.push(`discard the top ${cost.discardFromDeck} card(s) of your deck`);
  if (cost.damageSelf) parts.push(`take ${cost.damageSelf} damage`);
  if (cost.healIdentity) parts.push(`heal ${cost.healIdentity} damage from your identity`);
  return parts.length > 0 ? parts.join(", ") : "pay this cost";
}

/**
 * A branch or counter-count prompt for this action, or null when there is nothing to ask: no `either`/"up to N"
 * cost at all, only one branch is payable right now, or the counter range has no real width (`min === max`, the
 * only case `legalActions` itself would already have answered unambiguously).
 */
export function costChoicePromptFor(state: GameState, deps: EngineDeps, entry: LegalAction): CostChoicePrompt | null {
  if (entry.costBranches && entry.costBranches.length > 1) {
    const cost = actionAbilityCost(state, deps, entry.action);
    const branches = cost?.either ?? [];
    return {
      kind: "branch",
      options: entry.costBranches.map((branch) => ({
        branch,
        label: branches[branch] ? describeCost(branches[branch]) : `option ${branch + 1}`,
      })),
    };
  }
  if (entry.costCounters && entry.costCounters.min < entry.costCounters.max) {
    const cost = actionAbilityCost(state, deps, entry.action);
    const counterType = cost?.spendCounters?.counterType ?? "counters";
    return { kind: "counters", min: entry.costCounters.min, max: entry.costCounters.max, label: counterType };
  }
  return null;
}
