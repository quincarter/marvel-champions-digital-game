/** Resolving an ability frame, labeled-ability rules, and ability-limit bookkeeping. */

import type { AbilityId } from "@mc/content";
import { type AbilityDefinition, abilityUseKey, GRANTED_BY_SLOT } from "../abilities.js";
import { COST_NOT_PAID_VAR } from "../cost-damage.js";
import { gameFingerprint } from "../game-fingerprint.js";
import { type Ctx, emit, popFrame, setFrame } from "../ctx.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { statusActive } from "../keywords.js";
import { cardOf, mustPlayer, playerCardOwnerOf } from "../query.js";
import { abilityIgnored } from "../select.js";
import type { GameState } from "../state.js";
import { eventSubjects, slotsCarriedByResolved, type TriggerEvent } from "../trigger-events.js";
import { declareWildTypes } from "./declare-wilds.js";
import { declareLabeledDefense, declaresDefender, recordDefenseLabel } from "./enemy-activation.js";
import { announce, type Frame, pushEffects, pushEvent } from "./frames.js";
import { heard } from "./triggers.js";
import { keywordAbilityOf } from "../keyword-abilities.js";
import { discardStatusCards, settlePaidForEffects } from "../effects.js";
import { announceStatusDiscarded } from "./status-discarded.js";

/**
 * Which instance of a triggering effect `event` is: the event frame on the stack carrying it (its results aside), else
 * the event itself written out. A window and the abilities it starts hold the event, not its frame id, so the frame is
 * found by content (docs/phase7-wave5.md §3.14). The innermost such frame: an attack made while an identical attack
 * is still resolving is its own instance, and whatever reads a limit while it is on the stack is answering it
 * (docs/phase7-wave7.md §3.69).
 */
function triggeringEventKey(state: GameState, event: TriggerEvent | null): string {
  if (!event) return "none";
  const { results: _, ...body } = event;
  const wanted = JSON.stringify(body);
  for (const frame of state.stack) {
    if (frame.kind !== "event") continue;
    const { results: __, ...candidate } = frame.event;
    if (JSON.stringify(candidate) === wanted) return frame.frameId;
  }
  return wanted;
}

/**
 * The `abilityUses` key a limit counts against. An unqualified limit uses `<instance>:<ability>`, exactly as before;
 * `limit.per` appends `#<value>` so the same ability keeps one count per value ("limit once per round for each
 * aspect", Superhuman Agility; "once per round per player", The Grand Collection — `#player:<id>`, the player using
 * it, docs/phase7-wave3.md §3.36; "once per phase per player" on a forced trigger — `#eventPlayer:<id>`, the player
 * the triggering event belongs to, docs/phase7-wave10.md §3.14). `#` never appears in an ability id, so `clearAbilityUses` can strip it back off.
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
  // "Once per phase per player" on a forced ability nobody controls (docs/phase7-wave10.md §3.14): the event's player.
  if (definition.limit?.per === "eventPlayer") {
    const [eventPlayer] = event ? eventSubjects(event).players : [];
    return `${base}#eventPlayer:${eventPlayer ?? "none"}`;
  }
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
  // "Limit once per card" (`per: "paidCard"`, docs/phase7-wave9.md §3.46 (a)): counted within each payment (`priceOf`).
  if (definition.limit.per === "paidCard") return false;
  const key = limitKeyOf(state, id, abilityId, definition, event, playerId);
  return (state.abilityUses[key] ?? 0) >= definition.limit.count;
}

export function executeAbilityFrame(ctx: Ctx, frame: Frame<"ability">): void {
  // The ability's payment is read for types and holds a wild its player has not declared (docs/phase7-wave8.md §3.62):
  // asked before anything of the ability resolves. An ability nobody controls pays no such cost.
  if (frame.undeclaredWilds && frame.controllerId) {
    return declareWildTypes(ctx, frame, frame.controllerId, frame.undeclaredWilds);
  }
  if (askWouldAct(ctx, frame)) return;
  popFrame(ctx);
  const below = ctx.state.stack[0]?.frameId ?? null;
  resolveAbility(ctx, frame);
  // "That attack" on the resource ability that paid for this one (`LastingDuration endOfPaidFor`, §3.30 of wave 6)
  // follows the ability into the effects frame it just pushed, or ends now if it pushed none.
  const top = ctx.state.stack[0];
  const pushed = top?.kind === "effects" && top.frameId !== below && top.selfInstanceId === frame.instanceId;
  settlePaidForEffects(ctx, frame.frameId, pushed ? top.frameId : null);
  // The game as a measured ability's effects begin (`Frame<"effects">.resolvedCount`), the frames beneath them with it:
  // after its costs. Limitation: a cost written as its leading effects (`costEffects`) is paid inside the frame, so
  // paying it reads as a change even if the effects then do nothing. No counted Special (a When Revealed, Boost,
  // Preparation or When Defeated resolved on instruction) has such a cost today.
  const effects = ctx.state.stack[0];
  if (pushed && effects?.kind === "effects" && effects.resolvedCount)
    setFrame(ctx, {
      ...effects,
      resolvedCount: { ...effects.resolvedCount, from: gameFingerprint(ctx.state, ctx.state.stack.slice(1)) },
    });
}

/**
 * "When [a character] would thwart or attack" for an attack- or thwart-labeled ability (docs/phase7-wave10.md §3.21;
 * `TriggerEvent characterWouldAct`): announced once, above the ability's frame, when the ability is about to resolve
 * its effects. The character is the ability's player's identity, whose attack or thwart a labeled ability is (RRG
 * 1.8 "Labeled Ability", p. 26). True when it was announced: the frame stays on the stack beneath the event.
 *
 * Not announced for an ability that will not resolve anyway (ignored, its cost not paid, its limit reached), nor for
 * one a stunned or confused status card is about to cancel: the status card replaces the attempt first, as it does a
 * basic power's (`labelCancels`).
 */
function askWouldAct(ctx: Ctx, frame: Frame<"ability">): boolean {
  const playerId = frame.controllerId;
  if (frame.wouldAct || !playerId || keywordAbilityOf(frame.abilityId)) return false;
  const definition = ctx.deps.abilities[frame.abilityId];
  const acts = (["attack", "thwart"] as const).filter((act) => definition?.label?.includes(act));
  if (!definition || acts.length === 0) return false;
  if (abilityIgnored(ctx.state, ctx.deps, frame.instanceId, frame.abilityId)) return false;
  if ((frame.vars[COST_NOT_PAID_VAR] ?? 0) > 0) return false;
  if (limitReached(ctx.state, frame.instanceId, frame.abilityId, definition, frame.event, playerId)) return false;
  const identity = mustPlayer(ctx.state, playerId).identity.instanceId;
  if (statusesCancelling(ctx, identity, definition.label ?? []).length > 0) return false;
  const events = acts
    .map((act): TriggerEvent => ({
      kind: "characterWouldAct",
      act,
      characterInstanceId: identity,
      playerId,
      abilityFrameId: frame.frameId,
    }))
    .filter((event) => heard(ctx.state, ctx.deps, event));
  if (events.length === 0) return false;
  setFrame(ctx, { ...frame, wouldAct: "asked" });
  for (const event of events.reverse()) pushEvent(ctx, event);
  return true;
}

function resolveAbility(ctx: Ctx, frame: Frame<"ability">): void {
  // A keyword's own ability (temporary) is the engine's, not the card registry's (`keyword-abilities.ts`).
  const keyword = keywordAbilityOf(frame.abilityId);
  const definition = keyword?.definition ?? ctx.deps.abilities[frame.abilityId];
  if (!definition) return;
  // "Ignore the [ability]" (`RuleSpec ignoreAbilities`, docs/phase7-wave8.md §3.21; RRG 1.8 "Ignore", p. 23): an
  // instance that triggered before the rule began does not resolve. It is not canceled, and its limit is not spent.
  if (!keyword && abilityIgnored(ctx.state, ctx.deps, frame.instanceId, frame.abilityId)) {
    emit(ctx, { type: "abilityIgnored", instanceId: frame.instanceId, abilityId: frame.abilityId });
    return;
  }
  // A "take damage" cost not all taken was not paid (RRG 1.8 "Cost", p. 14; `cost-damage.ts`), so the ability is not
  // initiated: "abort this process" (RRG 1.8 "Initiating Abilities", p. 24, step 5). Logged as `costDamageSettled`.
  if ((frame.vars[COST_NOT_PAID_VAR] ?? 0) > 0) return;
  if (limitReached(ctx.state, frame.instanceId, frame.abilityId, definition, frame.event, frame.controllerId)) return;
  recordAbilityUse(ctx, frame.instanceId, frame.abilityId, definition, frame.event, frame.controllerId);
  const grantedBy = frame.bindings[GRANTED_BY_SLOT]?.[0];
  emit(ctx, {
    type: "abilityResolved",
    instanceId: frame.instanceId,
    abilityId: frame.abilityId,
    controllerId: frame.controllerId,
    ...(definition.trigger.kind === "action" && definition.trigger.forced ? { forced: true as const } : {}),
    ...(grantedBy ? { grantedByInstanceId: grantedBy } : {}),
  });
  if (keyword) {
    emit(ctx, {
      type: "keywordResolved",
      keyword: keyword.keyword,
      instanceId: frame.instanceId,
      playerId: frame.controllerId,
    });
  }
  // "… would thwart or attack, discard this card instead" replaced this use (docs/phase7-wave10.md §3.21): none of
  // its effects resolve. Its costs are paid and its limit counted above, as for a use a status card cancels.
  if (frame.wouldAct === "replaced") return;
  // A printed cost written as the leading effects (`costEffects`) is paid in step 5, before the label's status check,
  // which its effects frame makes once that cost is paid (`beginEffectAfterCost`; ruling April 30, 2026 - Ruling 5).
  const costEffects = keyword ? 0 : Math.min(definition.costEffects ?? 0, definition.effects.length);
  const labelAfterCost = costEffects > 0 && definition.label !== undefined && definition.label.length > 0;
  if (
    !labelAfterCost &&
    definition.label &&
    frame.controllerId &&
    labelCancels(ctx, frame.controllerId, definition.label)
  )
    return;
  // RRG 1.8 "Defend, Defense" (p. 15): from here no other player resolves a defense-labeled ability for this attack.
  if (definition.label?.includes("defense") && frame.controllerId) recordDefenseLabel(ctx, frame.controllerId);
  // An ability that itself declares a defender ("declare it the defender for this attack", Mutant Protectors) leaves
  // the label's own declaration to that effect (`declareDefender` in `apply-effect.ts`; FAQ p. 63).
  if (definition.label?.includes("defense") && frame.controllerId && !declaresDefender(definition))
    declareLabeledDefense(ctx, frame.controllerId);
  // RRG 1.8 "Resolve" (p. 37): resolved once its effects resolve, so its effects frame makes the announcement as it
  // finishes (`Frame<"effects">.announceResolved`, `announceAbilityResolved`), with the slots it then holds.
  const announceResolved = {
    instanceId: frame.instanceId,
    abilityId: frame.abilityId,
    controllerId: frame.controllerId,
  };
  const measured =
    (frame.resolvedCounts?.length ?? 0) > 0 ||
    frame.returnBindingsTo !== undefined ||
    heard(ctx.state, ctx.deps, { kind: "abilityResolved", ...announceResolved });
  // A player's own ability, or one a player chose to use (docs/phase7-wave4.md §3.44).
  const trigger = definition.trigger;
  // A keyword is a game rule, not a player's choice: "players cannot discard …" does not stop temporary.
  const byPlayer =
    !keyword &&
    (playerCardOwnerOf(ctx.state, frame.instanceId) !== null ||
      trigger.kind === "action" ||
      trigger.kind === "resource" ||
      ((trigger.kind === "interrupt" || trigger.kind === "response") && !trigger.forced));
  pushEffects(ctx, {
    effects: definition.effects,
    selfInstanceId: frame.instanceId,
    controllerId: frame.controllerId,
    event: frame.event,
    eventFrameId: frame.eventFrameId,
    bindings: frame.bindings,
    vars: frame.vars,
    byPlayer,
    abilityId: frame.abilityId,
    announceResolved,
    ...(frame.returnBindingsTo
      ? { returnBindingsTo: frame.returnBindingsTo.frameId, returnBindingsPrefix: frame.returnBindingsTo.prefix }
      : {}),
    // Whether this ability resolved is read as its effects finish, against the game as they begin: taken here, with
    // the stack beneath them, and again by `executeAbilityFrame` once the paid-for effects have followed the ability.
    // Taken only where it is read: a counted Special, a Special reporting `<prefix>.resolved`, or an ability whose
    // resolution something could answer (the digest is the whole game, too costly to take for every ability).
    ...(measured ? { resolvedCount: { from: gameFingerprint(ctx.state), to: frame.resolvedCounts ?? [] } } : {}),
  });
  if (labelAfterCost) {
    const pushed = ctx.state.stack[0];
    if (pushed?.kind === "effects" && pushed.selfInstanceId === frame.instanceId && pushed.cursor === 0)
      setFrame(ctx, { ...pushed, costEffectsPending: definition.effects.length - costEffects });
  }
}

/**
 * An ability's effects have resolved, so the ability has (RRG 1.8 "Resolve", p. 37): the announcement that "After you
 * resolve the ability of …" answers, made by the ability's effects frame as it finishes and only when something could
 * respond. It carries the slots the ability holds by then (docs/phase7-wave9.md §3.43 (c)): what its costs bound, its
 * chosen targets, and what its effects bound, so "After you resolve Falcon's 'Eagle-Eyed' ability, … for each icon in
 * the discarded card's boost area" reads the card that ability's effect discarded. Not made when its effects changed
 * nothing (`changed`, read by `executeEffectsFrame` from `Frame<"effects">.resolvedCount`): RRG 1.8 "Resolve", p. 37.
 */
export function announceAbilityResolved(ctx: Ctx, frame: Frame<"effects">, changed: boolean): void {
  if (!frame.announceResolved || !changed) return;
  const carried = slotsCarriedByResolved(frame.bindings);
  const resolved: TriggerEvent = {
    kind: "abilityResolved",
    ...frame.announceResolved,
    ...(carried ? { carried } : {}),
  };
  if (heard(ctx.state, ctx.deps, resolved)) announce(ctx, resolved);
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
export function labelCancels(ctx: Ctx, playerId: PlayerId, labels: readonly string[]): boolean {
  const identity = mustPlayer(ctx.state, playerId).identity.instanceId;
  const cancelling = statusesCancelling(ctx, identity, labels);
  announceStatusDiscarded(
    ctx,
    cancelling.flatMap((status) =>
      discardStatusCards(ctx, identity, status, status === "stunned" ? "cancelledAttack" : "cancelledSchemeOrThwart"),
    ),
  );
  return cancelling.length > 0;
}

/** The status cards on `identity` that cancel an ability with these labels (`labelCancels`). */
function statusesCancelling(ctx: Ctx, identity: InstanceId, labels: readonly string[]): ("stunned" | "confused")[] {
  const cancelling: ("stunned" | "confused")[] = [];
  if (labels.includes("attack") && statusActive(ctx.state, identity, "stunned", ctx.deps)) cancelling.push("stunned");
  if (labels.includes("thwart") && statusActive(ctx.state, identity, "confused", ctx.deps)) cancelling.push("confused");
  return cancelling;
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
  // A limit for each card paid for is the payment's own count: nothing is kept between payments (wave 9 §3.46 (a)).
  if (definition.limit.per === "paidCard") return;
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
