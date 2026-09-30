/** Resolving an ability frame, labeled-ability rules, and ability-limit bookkeeping. */

import type { AbilityId } from "@mc/content";
import { type AbilityDefinition, abilityUseKey } from "../abilities.js";
import { COST_NOT_PAID_VAR } from "../cost-damage.js";
import { cannotDefend } from "../rules.js";
import { type Ctx, emit, popFrame, setFrame, updateInstance } from "../ctx.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { statusActive } from "../keywords.js";
import { cardOf, getInstance, mustPlayer } from "../query.js";
import { DEFENDER_SLOT } from "../select.js";
import { currentActivationFrameId } from "../stack.js";
import type { GameState } from "../state.js";
import { eventSubjects, type TriggerEvent } from "../trigger-events.js";
import { setDefender } from "./enemy-activation.js";
import { announce, type Frame, pushEffects } from "./frames.js";
import { heard } from "./triggers.js";

/**
 * Which instance of a triggering effect `event` is: the event frame on the stack carrying it (its results aside), else
 * the event itself written out. A window and the abilities it starts hold the event, not its frame id, so the frame is
 * found by content (docs/phase7-wave5.md §3.14).
 */
function triggeringEventKey(state: GameState, event: TriggerEvent | null): string {
  if (!event) return "none";
  const { results: _, ...body } = event;
  const wanted = JSON.stringify(body);
  for (let i = state.stack.length - 1; i >= 0; i--) {
    const frame = state.stack[i];
    if (frame?.kind !== "event") continue;
    const { results: __, ...candidate } = frame.event;
    if (JSON.stringify(candidate) === wanted) return frame.frameId;
  }
  return wanted;
}

/**
 * The `abilityUses` key a limit counts against. An unqualified limit uses `<instance>:<ability>`, exactly as before;
 * `limit.per` appends `#<value>` so the same ability keeps one count per value ("limit once per round for each
 * aspect", Superhuman Agility; "once per round per player", The Grand Collection — `#player:<id>`, the player using
 * it, docs/phase7-wave3.md §3.36). `#` never appears in an ability id, so `clearAbilityUses` can strip it back off.
 */
export function limitKeyOf(
  state: GameState,
  id: InstanceId,
  abilityId: AbilityId,
  definition: AbilityDefinition,
  event: TriggerEvent | null,
  playerId: PlayerId | null = null,
): string {
  // "Max 1 per [instance]" (docs/phase7-wave5.md §3.14): every copy of the title shares one count per triggering event.
  // The key's head is not an ability id, so `clearAbilityUses` drops it at every boundary.
  if (definition.limit?.per === "triggeringEvent") {
    return `max:${cardOf(state, id)?.name ?? abilityId}#event:${triggeringEventKey(state, event)}`;
  }
  const base = abilityUseKey(id, abilityId);
  if (definition.limit?.per === "player") return `${base}#player:${playerId ?? "none"}`;
  if (definition.limit?.per !== "aspectOfEventCard") return base;
  const [subject] = event ? eventSubjects(event).targets : [];
  const card = subject ? cardOf(state, subject) : undefined;
  const aspect = card && "aspect" in card ? String(card.printedAspect ?? card.aspect) : "none";
  return `${base}#${aspect}`;
}

export function limitReached(
  state: GameState,
  id: InstanceId,
  abilityId: AbilityId,
  definition: AbilityDefinition,
  event: TriggerEvent | null = null,
  playerId: PlayerId | null = null,
): boolean {
  if (!definition.limit) return false;
  const key = limitKeyOf(state, id, abilityId, definition, event, playerId);
  return (state.abilityUses[key] ?? 0) >= definition.limit.count;
}

export function executeAbilityFrame(ctx: Ctx, frame: Frame<"ability">): void {
  const definition = ctx.deps.abilities[frame.abilityId];
  popFrame(ctx);
  if (!definition) return;
  // A "take damage" cost not all taken was not paid (RRG 1.8 "Cost", p. 14; `cost-damage.ts`), so the ability is not
  // initiated: "abort this process" (RRG 1.8 "Initiating Abilities", p. 24, step 5). Logged as `costDamageSettled`.
  if ((frame.vars[COST_NOT_PAID_VAR] ?? 0) > 0) return;
  if (limitReached(ctx.state, frame.instanceId, frame.abilityId, definition, frame.event, frame.controllerId)) return;
  recordAbilityUse(ctx, frame.instanceId, frame.abilityId, definition, frame.event, frame.controllerId);
  emit(ctx, {
    type: "abilityResolved",
    instanceId: frame.instanceId,
    abilityId: frame.abilityId,
    controllerId: frame.controllerId,
  });
  if (definition.label && frame.controllerId && labelCancels(ctx, frame.controllerId, definition.label)) return;
  if (definition.label?.includes("defense") && frame.controllerId) declareLabeledDefense(ctx, frame.controllerId);
  // RRG 1.8 "Resolve" (p. 37): resolved once its effects resolve, so the announcement waits under them. Pushed only when
  // something could respond ("After you resolve the ability of a Preparation card you control").
  const resolved: TriggerEvent = {
    kind: "abilityResolved",
    instanceId: frame.instanceId,
    abilityId: frame.abilityId,
    controllerId: frame.controllerId,
  };
  if (definition.effects.length > 0 && heard(ctx.state, ctx.deps, resolved)) announce(ctx, resolved);
  // A player's own ability, or one a player chose to use (docs/phase7-wave4.md §3.44).
  const trigger = definition.trigger;
  const byPlayer =
    (getInstance(ctx.state, frame.instanceId)?.ownerId ?? null) !== null ||
    trigger.kind === "action" ||
    trigger.kind === "resource" ||
    ((trigger.kind === "interrupt" || trigger.kind === "response") && !trigger.forced);
  pushEffects(ctx, {
    effects: definition.effects,
    selfInstanceId: frame.instanceId,
    controllerId: frame.controllerId,
    event: frame.event,
    eventFrameId: frame.eventFrameId,
    bindings: frame.bindings,
    vars: frame.vars,
    byPlayer,
    ...(frame.returnBindingsTo
      ? { returnBindingsTo: frame.returnBindingsTo.frameId, returnBindingsPrefix: frame.returnBindingsTo.prefix }
      : {}),
  });
}

/**
 * RRG "Labeled Ability": a stunned identity using an (attack) ability, or a
 * confused one using a (thwart) ability, cancels the whole ability except its
 * costs, and every status that cancelled it is removed. Only the identity is
 * checked: a labeled ability is that identity's thwart (RRG 1.8 p. 26). A
 * confused *thwarter* named by a thwart effect (an ally's own ability, an
 * unlabeled "your identity thwarts") is caught as that effect applies
 * (`thwart` in `apply-effect.ts`); a cancelled ability never gets that far.
 */
function labelCancels(ctx: Ctx, playerId: PlayerId, labels: readonly string[]): boolean {
  const identity = mustPlayer(ctx.state, playerId).identity.instanceId;
  const cancelling: ("stunned" | "confused")[] = [];
  if (labels.includes("attack") && statusActive(ctx.state, identity, "stunned", ctx.deps)) cancelling.push("stunned");
  if (labels.includes("thwart") && statusActive(ctx.state, identity, "confused", ctx.deps)) cancelling.push("confused");
  for (const status of cancelling) {
    updateInstance(ctx, identity, (i) => ({ ...i, statuses: { ...i.statuses, [status]: 0 } }));
    emit(ctx, {
      type: "statusRemoved",
      instanceId: identity,
      status,
      reason: status === "stunned" ? "cancelledAttack" : "cancelledSchemeOrThwart",
    });
  }
  return cancelling.length > 0;
}

/** RRG "Defend, Defense": a (defense) ability makes the identity the defender if the current attack has none. */
function declareLabeledDefense(ctx: Ctx, playerId: PlayerId): void {
  const identity = mustPlayer(ctx.state, playerId).identity.instanceId;
  const attack = ctx.state.stack.find((f): f is Frame<"enemyAttack"> => f.kind === "enemyAttack");
  // A character that cannot defend is not made the defender by a "(defense)" ability either (§3.31 of wave 4).
  const attackerOf = attack?.enemyInstanceId ?? null;
  if (cannotDefend(ctx.state, ctx.deps, identity, attackerOf)) return;
  if (attack) {
    if (attack.defenderInstanceId === null) setDefender(ctx, attack, identity, playerId, false);
    return;
  }
  // Interrupting the attack itself ("When the villain attacks you"): the procedure
  // hasn't started, so record the defender on the attack event.
  const activation = currentActivationFrameId(ctx.state.stack);
  const frame = activation ? ctx.state.stack.find((f) => f.frameId === activation) : undefined;
  if (frame?.kind !== "event" || frame.event.kind !== "enemyAttack" || (frame.vars.labeledDefense ?? 0) > 0) return;
  const enemyInstanceId = frame.event.enemyInstanceId;
  setFrame(ctx, {
    ...frame,
    event: { ...frame.event, targetInstanceId: identity, targetPlayerId: playerId },
    vars: { ...frame.vars, labeledDefense: 1 },
    slots: { ...frame.slots, [DEFENDER_SLOT]: [identity] },
  });
  announce(ctx, { kind: "defended", defenderInstanceId: identity, enemyInstanceId, playerId, basic: false });
}

export function recordAbilityUse(
  ctx: Ctx,
  instanceId: InstanceId,
  abilityId: AbilityId,
  definition: AbilityDefinition,
  event: TriggerEvent | null = null,
  playerId: PlayerId | null = null,
): void {
  if (!definition.limit) return;
  const key = limitKeyOf(ctx.state, instanceId, abilityId, definition, event, playerId);
  const uses = (ctx.state.abilityUses[key] ?? 0) + 1;
  ctx.state = { ...ctx.state, abilityUses: { ...ctx.state.abilityUses, [key]: uses } };
  emit(ctx, { type: "abilityUseRecorded", instanceId, abilityId, uses });
}

/** RRG "Limit": counters reset at the boundary of the named period. */
export function clearAbilityUses(ctx: Ctx, period: "turn" | "phase" | "round"): void {
  const kept: Record<string, number> = {};
  for (const [key, uses] of Object.entries(ctx.state.abilityUses)) {
    // `<instance>:<ability>` or `<instance>:<ability>#<qualifier>` for a per-something limit (`limitKeyOf`).
    const abilityId = key.slice(key.indexOf(":") + 1).split("#")[0] ?? "";
    const definition = ctx.deps.abilities[abilityId];
    if (definition?.limit && definition.limit.period !== period) kept[key] = uses;
  }
  ctx.state = { ...ctx.state, abilityUses: kept };
}
