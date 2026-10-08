/**
 * "Resolve its 'Forced Response' as if it just attacked you →" as an ability cost (`AbilityCost.resolveAbility`;
 * docs/phase7-wave8.md §3.11): whether it can be paid, and the steps that pay it.
 *
 * The cost is paid by resolving another card's printed abilities of one kind, the same `resolveSpecials` effect a
 * card's "resolve the 'Forced Response' on the active villain" uses, pushed by `payCost` above the frame it pays for
 * (`enemy-attack-cost.ts`'s pattern), so those abilities resolve in full before that frame's effects: "Nonbolded text
 * before the cost arrow icon must be paid and/or resolved in full before the text after the cost arrow icon can be
 * resolved" (RRG 1.8 "Cost Arrow Icon", p. 14).
 *
 * **Not payable when resolving them would change nothing** (owner decision §4.1 Q7 = A, "the normal valid-target and
 * initiation rule"): RRG 1.8 "Initiating Abilities" (p. 24) refuses an ability whose cost cannot be paid, and "Cost"
 * (p. 13) has a cost paid in full or not at all. Whether resolving would change anything is not guessed from the
 * abilities' shape: `resolvingWouldChange` resolves them on a copy of the state and looks.
 */

import { type AbilityCost, type EngineDeps, resolvableAs } from "./abilities.js";
import { COST_NOT_PAID_VAR } from "./cost-damage.js";
import { createCtx, type Ctx, emit, setFrame } from "./ctx.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { getInstance } from "./query.js";
import { addFrameVars, pushEffects, type Frame } from "./resolve/frames.js";
import { executeFrame } from "./resolve/index.js";
import { activeAbilityRefs, type EffectContext, resolveRef } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { Bindings } from "./stack.js";
import type { GameState } from "./state.js";

type ResolveAbilityCost = NonNullable<AbilityCost["resolveAbility"]>;

/** The slot the card whose abilities resolve is bound to on the steps `payCost` pushes, and the prefix they report under. */
const OF_SLOT = "_costResolveOf";
const BIND = "costResolve";

/** The card the cost names: the first card its ref resolves to, read with the cost's own picks bound. */
export function resolveAbilityCostCard(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  cost: ResolveAbilityCost,
  bindings: Bindings,
): InstanceId | null {
  const context: EffectContext = { selfInstanceId: sourceId, controllerId: playerId, event: null, bindings, deps };
  return resolveRef(state, cost.of, context)[0] ?? null;
}

/** The effect that pays the cost: the named card's abilities of the cost's kind, with the payer as "you". */
const resolving = (cost: ResolveAbilityCost): EffectSpec => ({
  kind: "resolveSpecials",
  of: { kind: "slot", slot: OF_SLOT },
  player: { kind: "controller" },
  trigger: cost.trigger,
  ...(cost.abilities ? { abilities: cost.abilities } : {}),
  ...(cost.asIf ? { asIf: cost.asIf } : {}),
  bind: BIND,
});

/**
 * What a probe leaves different without anything in the game having changed: the stack itself, the counters that name
 * frames, choices and lasting effects, the per-ability use counts and the between-frames bookkeeping.
 */
const NOT_GAME_STATE: ReadonlySet<string> = new Set([
  "stack",
  "pendingChoice",
  "nextFrameSeq",
  "nextChoiceSeq",
  "nextLastingSeq",
  "abilityUses",
  "stateChecks",
]);

/** Whether two states hold the same game: every field outside `NOT_GAME_STATE`, by identity or else by content. */
function sameGame(a: GameState, b: GameState): boolean {
  const left = a as unknown as Record<string, unknown>;
  const right = b as unknown as Record<string, unknown>;
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (NOT_GAME_STATE.has(key) || left[key] === right[key]) continue;
    if (JSON.stringify(left[key]) !== JSON.stringify(right[key])) return false;
  }
  return true;
}

/** Frames a probe runs before it stops looking and answers yes: far more than any printed ability resolves in. */
const PROBE_FRAMES = 400;
/** A probe is running: a cost judged from inside it is taken as payable, so probes never nest. */
let probing = false;

/**
 * Whether resolving `ofId`'s abilities as this cost asks would change the game right now, found by resolving them on
 * a copy of the state (the state is immutable data, so the copy is the state itself and nothing here reaches the real
 * game or its log). The answer is yes as soon as the game would be over, a player would be asked a choice with
 * something to choose, or the state differs once the abilities have finished; no when no such ability is live on the
 * card (a blank text box, the wrong face) or everything they did left the game as it was (a discard with nothing to
 * discard, damage to nobody). The frames beneath stay on the copy's stack untouched, so the abilities read the same
 * surroundings they will read when the cost is paid.
 */
export function resolvingWouldChange(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  ofId: InstanceId,
  cost: ResolveAbilityCost,
): boolean {
  if (probing) return true;
  probing = true;
  try {
    const before: GameState = { ...state, pendingChoice: null };
    const ctx = createCtx(before, deps);
    const depth = before.stack.length;
    pushEffects(ctx, {
      effects: [resolving(cost)],
      selfInstanceId: sourceId,
      controllerId: playerId,
      bindings: { [OF_SLOT]: [ofId] },
    });
    for (let frames = 0; ctx.state.stack.length > depth; frames++) {
      if (frames >= PROBE_FRAMES) return true;
      executeFrame(ctx);
      if (ctx.state.outcome !== before.outcome) return true;
      if (ctx.state.pendingChoice) return ctx.state.pendingChoice.options.length > 0;
    }
    return !sameGame(before, ctx.state);
  } finally {
    probing = false;
  }
}

/**
 * Why the cost could not be paid right now, or null if it could: the card it names is not there, it has no live
 * printed ability of the kind (RRG 1.8 "Text Box", p. 44: a blank text box has none), or resolving what it has would
 * change nothing (§4.1 Q7 = A).
 */
export function resolveAbilityCostFault(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  ofId: InstanceId | null,
  cost: ResolveAbilityCost,
): string | null {
  if (ofId === null || !getInstance(state, ofId)) return "no card whose ability this cost resolves";
  const only = cost.abilities ? new Set<string>(cost.abilities) : null;
  const live = activeAbilityRefs(state, ofId, deps).some(
    (ref) => resolvableAs(deps.abilities[ref.id], cost.trigger) && (!only || only.has(ref.id)),
  );
  if (!live) return "that card has no such ability to resolve";
  if (!resolvingWouldChange(state, deps, sourceId, playerId, ofId, cost))
    return "resolving that ability would change nothing";
  return null;
}

/**
 * The steps `payCost` pushes for the cost, above `paidFor`: `ofId`'s abilities resolve, then the cost is settled.
 * `wouldChange` is read as the steps are pushed, the moment the cost is paid; when it is false nothing resolves and the
 * settling step alone reports the cost unpaid.
 */
export function resolveAbilityCostEffects(
  ofId: InstanceId,
  cost: ResolveAbilityCost,
  wouldChange: boolean,
  paidFor: Frame<"ability"> | Frame<"playCard"> | null,
): { readonly effects: EffectSpec[]; readonly bindings: Bindings } {
  const settle: EffectSpec = {
    kind: "settleResolveAbilityCost",
    of: ofId,
    trigger: cost.trigger,
    bind: BIND,
    wouldChange,
    paidFor: paidFor?.frameId ?? null,
  };
  return { effects: wouldChange ? [resolving(cost), settle] : [settle], bindings: { [OF_SLOT]: [ofId] } };
}

/**
 * The `settleResolveAbilityCost` step: at least one ability resolved (`<bind>.count`) and resolving could change the
 * game when the cost was paid, so the cost is paid; otherwise the frame it paid for is marked (`COST_NOT_PAID_VAR`) and
 * the ability's effects do not resolve ("discard this card" stays undone). Whatever else of the cost was paid stays
 * paid.
 *
 * The abilities themselves are not second-guessed once they have resolved: one whose effects were then prevented or
 * replaced as they applied still resolved, as an attack another player defends is still the attack
 * (`settleEnemyAttackCost`).
 */
export function executeSettleResolveAbilityCost(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "settleResolveAbilityCost" }>,
): void {
  setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
  const resolved = frame.vars[`${effect.bind}.count`] ?? 0;
  const paid = effect.wouldChange && resolved > 0;
  emit(ctx, {
    type: "resolveAbilityCostSettled",
    instanceId: frame.selfInstanceId,
    playerId: frame.controllerId,
    ofInstanceId: effect.of,
    trigger: effect.trigger,
    resolved,
    paid,
  });
  if (!paid) addFrameVars(ctx, effect.paidFor, { [COST_NOT_PAID_VAR]: 1 });
}
