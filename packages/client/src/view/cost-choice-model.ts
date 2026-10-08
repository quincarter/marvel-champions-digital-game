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
import {
  activeAbilityRefs,
  costAsDetermined,
  resolveValue,
  type AbilityCost,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type LegalAction,
  type PlayerId,
} from "@mc/engine";

export type CostChoicePrompt =
  | { readonly kind: "branch"; readonly options: readonly { readonly branch: number; readonly label: string }[] }
  | { readonly kind: "counters"; readonly min: number; readonly max: number; readonly label: string };

/**
 * The `AbilityCost` an action's `useAbility`/action-triggered `playCard` would pay, mirroring
 * `discard-choice-model.ts`'s own lookup — resolved with `costAsDetermined` so a `conditional` cost (Navigation
 * Column, 16172) shows the branch the board actually has, not the printed template.
 */
export function actionAbilityCost(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  action: LegalAction["action"],
): AbilityCost | undefined {
  if (action.kind === "useAbility") {
    return costAsDetermined(state, deps, action.instanceId, playerId, deps.abilities[action.abilityId]?.cost);
  }
  if (action.kind !== "playCard") return undefined;
  for (const ref of activeAbilityRefs(state, action.instanceId)) {
    const definition = deps.abilities[ref.id];
    if (definition?.trigger.kind === "action") {
      return costAsDetermined(state, deps, action.instanceId, playerId, definition.cost);
    }
  }
  return undefined;
}

/**
 * "The top N cards of your deck", for `AbilityCost.discardFromDeck` — a plain number, or a `ValueSpec` (Shield
 * Spell, `mts` 21061: `eventAmount`, sized from a damage event this description is shown before any attack starts;
 * Aunt May & Uncle Ben, `spdr` 31007: `ifElse(isAlterEgo(), 3, 2)`).
 *
 * Resolved to the real number this cost would pay right now whenever there's a game to resolve it against
 * (`resolveContext`) — the same number `describeCost`'s caller already has state for. Without one (this function's
 * own unit tests, which call it directly), or for a value nothing here can resolve without an event in progress
 * (`eventAmount`), this falls back to a phrase that reads the value's own printed shape instead of the number:
 * `ifElse(isAlterEgo(), …)`'s "the top 2 (3 in alter-ego) cards", the same two counts Aunt May & Uncle Ben prints.
 */
function discardFromDeckPhrase(
  value: NonNullable<AbilityCost["discardFromDeck"]>,
  resolveContext: {
    readonly state: GameState;
    readonly deps: EngineDeps;
    readonly selfInstanceId: InstanceId;
    readonly controllerId: PlayerId;
  } | null,
): string {
  if (typeof value === "number") return `the top ${value} card${value === 1 ? "" : "s"}`;
  // "Discard up to 3 cards from the top of your deck →": a size the payer chooses (docs/phase7-wave8.md §3.55).
  if ("choose" in value) {
    const { min, max } = value.choose;
    return min <= 1 ? `up to ${max} cards from the top` : `${min} to ${max} cards from the top`;
  }
  if (value.kind !== "eventAmount") {
    if (resolveContext) {
      const { state, deps, selfInstanceId, controllerId } = resolveContext;
      const n = resolveValue(state, value, { selfInstanceId, controllerId, event: null, bindings: {}, deps }, deps);
      return `the top ${n} card${n === 1 ? "" : "s"}`;
    }
    if (value.kind === "conditional" && value.then.kind === "const" && value.else.kind === "const") {
      return `the top ${value.else.value} (${value.then.value} in alter-ego) cards`;
    }
  }
  return "however many cards it takes";
}

/**
 * A short, generic phrase for one cost, covering the shapes cycle 2's `either` branches and counter costs use.
 * `resolveContext` lets `discardFromDeck` show a `ValueSpec`'s real, resolved count; omit it only where there's no
 * game to resolve against.
 */
export function describeCost(
  cost: AbilityCost,
  resolveContext: {
    readonly state: GameState;
    readonly deps: EngineDeps;
    readonly selfInstanceId: InstanceId;
    readonly controllerId: PlayerId;
  } | null = null,
): string {
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
  if (cost.discardFromDeck !== undefined) {
    parts.push(`discard ${discardFromDeckPhrase(cost.discardFromDeck, resolveContext)} of your deck`);
  }
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
    const cost = actionAbilityCost(state, deps, entry.example.playerId, entry.action);
    const branches = cost?.either ?? [];
    const selfInstanceId = "instanceId" in entry.action ? entry.action.instanceId : null;
    const resolveContext = selfInstanceId
      ? { state, deps, selfInstanceId, controllerId: entry.example.playerId }
      : null;
    return {
      kind: "branch",
      options: entry.costBranches.map((branch) => ({
        branch,
        label: branches[branch] ? describeCost(branches[branch], resolveContext) : `option ${branch + 1}`,
      })),
    };
  }
  if (entry.costCounters && entry.costCounters.min < entry.costCounters.max) {
    const cost = actionAbilityCost(state, deps, entry.example.playerId, entry.action);
    const counterType = cost?.spendCounters?.counterType ?? "counters";
    return { kind: "counters", min: entry.costCounters.min, max: entry.costCounters.max, label: counterType };
  }
  return null;
}
