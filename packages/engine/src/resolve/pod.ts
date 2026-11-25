/**
 * The pod's shared villain and scheme inside one group's game (docs/phase7-wave9.md §3.66): a script's shared event on
 * its way out, and the results of shared events applied here once the resolution in progress has finished (MC55 p. 20:
 * "Each group should pause gameplay activity in their game area, first finishing any actions or abilities that are
 * currently resolving").
 *
 * The record itself changes in one place, the pure reducer (`applySharedEvent`, `pod.ts`). With a local coordinator
 * (Single Group Mode) this engine calls it; with a remote one it only emits, and the results arrive from outside.
 */

import type { EngineDeps } from "../abilities.js";
import { emit, moveCard, nextInstanceId, pushFrames, updateInstance, type Ctx } from "../ctx.js";
import { endGame } from "../effects.js";
import { EngineInvariantError } from "../errors.js";
import type { GroupId, InstanceId } from "../ids.js";
import { keywordTotal } from "../keywords.js";
import {
  applySharedEvent,
  POD_MOMENT,
  podBlocksOf,
  podGroupIds,
  resolveGroup,
  sharedLost,
  type PodInboundEvent,
  type PodOutboundEvent,
  type PodState,
  type ReachableCard,
  type RemoteHitSettling,
  type RemotePower,
  type SharedEvent,
  type SharedPodState,
  type SharedResult,
  type SharedThreatCause,
} from "../pod.js";
import { cardOf, getInstance, maxHitPoints, remainingHitPoints } from "../query.js";
import { activeRules, cardsInPlay, matchesQuery } from "../select.js";
import type { EffectSpec } from "../spec.js";
import type { GameState } from "../state.js";
import type { RemoteHit, TriggerEvent } from "../trigger-events.js";
import { consequentialDamageEvent } from "../actions.js";
import { gameAbilityFrames, pushEffects, pushEvent, type Frame } from "./frames.js";
import { heard } from "./triggers.js";

const setPod = (ctx: Ctx, pod: PodState): void => {
  ctx.state = { ...ctx.state, pod };
};

function setShared(ctx: Ctx, pod: PodState, shared: SharedPodState): PodState {
  if (shared === pod.shared) return pod;
  const next = { ...pod, shared };
  setPod(ctx, next);
  emit(ctx, { type: "sharedStateChanged", shared });
  return next;
}

/**
 * `EffectSpec sharedEvent`: a script deals damage to the shared villain or places threat on the shared scheme. Always
 * leaves the command as `sharedEventEmitted`, numbered by this group, which is what a host forwards to the pod's
 * coordinator. A local coordinator applies it here and now, and queues what it brought about for `settlePod`. Nothing
 * happens in a game with no shared record, or for an amount of 0.
 */
export function emitSharedEvent(
  ctx: Ctx,
  kind: "villainDamaged" | "schemeThreatPlaced",
  amount: number,
  cause: SharedThreatCause | undefined,
): void {
  const pod = ctx.state.pod;
  const whole = Math.max(0, Math.floor(amount));
  if (!pod?.shared || whole === 0) return;
  const event: SharedEvent =
    kind === "villainDamaged"
      ? { type: "sharedVillainDamaged", groupId: pod.groupId, amount: whole }
      : { type: "sharedSchemeThreatPlaced", groupId: pod.groupId, amount: whole, cause: cause ?? "schemeCompleted" };
  const seq = pod.outboundSeq + 1;
  const numbered: PodState = { ...pod, outboundSeq: seq };
  setPod(ctx, numbered);
  emit(ctx, { type: "sharedEventEmitted", seq, event });
  if (pod.coordinator === "remote") {
    // Wait for the coordinator's answer before playing on (`PodState.awaiting`; MC55 pp. 20, 21).
    setPod(ctx, { ...numbered, awaiting: seq });
    return;
  }
  if (!numbered.shared) return;
  const { shared, results } = applySharedEvent(numbered.shared, event);
  const stored = setShared(ctx, numbered, shared);
  if (results.length > 0) setPod(ctx, { ...stored, pendingResults: [...(stored.pendingResults ?? []), ...results] });
}

/** Raises one of the pod's moments for the first player, on the stack only when an ability answers it. */
function raise(ctx: Ctx, name: string, sourceInstanceId: InstanceId | null): void {
  const moment = { name, playerId: ctx.state.firstPlayerId, sourceInstanceId };
  emit(ctx, { type: "momentRaised", ...moment });
  const event: TriggerEvent = { kind: "momentRaised", ...moment };
  if (heard(ctx.state, ctx.deps, event)) pushEvent(ctx, event);
}

/**
 * A final result of the pod: the neutral card's own line ends the game, answering the moment ("If [the shared villain]
 * is defeated, all players in all groups win the game."; "If this stage is completed, the players lose the game."). The
 * shared record is already final by then, so when no ability in the game answers, the engine records the same outcome
 * itself rather than play on: a win as `endGame` records one, a loss against the shared scheme.
 */
function conclude(ctx: Ctx, name: string, sourceInstanceId: InstanceId | null, result: "win" | "loss"): void {
  const moment: TriggerEvent = { kind: "momentRaised", name, playerId: ctx.state.firstPlayerId, sourceInstanceId };
  const answered = heard(ctx.state, ctx.deps, moment);
  raise(ctx, name, sourceInstanceId);
  if (answered) return;
  endGame(
    ctx,
    result === "win"
      ? { result: "win", reason: "villainDefeated" }
      : {
          result: "loss",
          reason: "cardAbility",
          sourceInstanceId: sourceInstanceId ?? ctx.state.mainScheme.instanceId,
        },
  );
}

/**
 * The pod has lost: its shared scheme is complete and no player phase is left to defeat the shared villain in (MC55
 * p. 21).
 */
function loseToSharedScheme(ctx: Ctx, pod: PodState): void {
  if (pod.shared) setShared(ctx, pod, sharedLost(pod.shared));
  conclude(ctx, POD_MOMENT.sharedSchemeCompleted, pod.neutral?.mainSchemeInstanceId ?? null, "loss");
}

/**
 * Applies one result of a shared event in this group's game. The one handler for a result this engine's own reducer
 * produced (a local coordinator) and for one a pod coordinator sends (docs/phase7-wave9.md §3.68), so the two paths
 * cannot drift. Called only with nothing resolving.
 *
 * - `sharedVillainFlipped`: this group's copy of the neutral villain turns over and its new face is revealed: that
 *   face's When Revealed resolves for the first player (MC55 p. 20, p. 23), then `POD_MOMENT.sharedVillainFlipped`.
 * - `sharedVillainDefeated`: `POD_MOMENT.sharedVillainDefeated`, answered by the villain's own line.
 * - `sharedSchemeCompleted`: nothing when the shared villain has been defeated since. In the player phase the phase is
 *   played to its end (`PodState.finalPlayerPhase`; MC55 p. 21, docs/phase7-wave9.md §4.1 Q9 = A). Otherwise, under a
 *   local coordinator, no player phase is running anywhere and the pod has lost. Under a remote one this group waits
 *   for the coordinator's verdict.
 */
export function applyInbound(ctx: Ctx, result: SharedResult): void {
  const pod = ctx.state.pod;
  if (!pod) return;
  emit(ctx, { type: "sharedResultApplied", result });
  const neutral = pod.neutral;
  switch (result) {
    case "sharedVillainFlipped": {
      const id = neutral?.villainInstanceId;
      const instance = id === undefined ? undefined : getInstance(ctx.state, id);
      if (id !== undefined && instance && !instance.flipped) {
        ctx.state = { ...ctx.state, instances: { ...ctx.state.instances, [id]: { ...instance, flipped: true } } };
        emit(ctx, { type: "cardFlipped", instanceId: id, flipped: true });
      }
      // Raised first, so it is answered after the new face's When Revealed has resolved.
      raise(ctx, POD_MOMENT.sharedVillainFlipped, id ?? null);
      if (id !== undefined && instance)
        pushFrames(ctx, gameAbilityFrames(ctx, id, ["whenRevealed"], null, undefined, ctx.state.firstPlayerId));
      return;
    }
    case "sharedVillainDefeated":
      conclude(ctx, POD_MOMENT.sharedVillainDefeated, neutral?.villainInstanceId ?? null, "win");
      return;
    case "sharedSchemeCompleted":
      if (pod.shared?.status === "won") return;
      if (ctx.state.step.phase === "player") setPod(ctx, { ...pod, finalPlayerPhase: true });
      else if (pod.coordinator === "local") loseToSharedScheme(ctx, pod);
      return;
  }
}

/**
 * The pod's business at a quiet point (nothing on the stack, no choice open): the oldest waiting result of a shared
 * event is applied; and a player phase that was played out after the shared scheme's completion has ended, so under a
 * local coordinator the pod has lost unless the shared villain was defeated in it. Returns whether anything was done.
 * A game with no pod record returns at once.
 */
export function settlePod(ctx: Ctx): boolean {
  const pod = ctx.state.pod;
  if (!pod) return false;
  // First, so the outcome is read as the hit's own resolution left it, before anything queued behind it applies.
  if (settleRemoteHits(ctx, pod)) return true;
  const [next, ...rest] = pod.pendingResults ?? [];
  if (next !== undefined) {
    const { pendingResults: _taken, ...kept } = pod;
    setPod(ctx, rest.length > 0 ? { ...kept, pendingResults: rest } : kept);
    applyInbound(ctx, next);
    return true;
  }
  const [inbound, ...later] = pod.pendingInbound ?? [];
  if (inbound !== undefined) {
    const { pendingInbound: _taken, ...kept } = pod;
    setPod(ctx, later.length > 0 ? { ...kept, pendingInbound: later } : kept);
    applyQueuedInbound(ctx, inbound);
    return true;
  }
  // A remote power has been made or cancelled: its stand-in leaves (`CardInstance.remoteOf`).
  if (removeStandIns(ctx)) return true;
  if (pod.finalPlayerPhase && ctx.state.step.phase !== "player") {
    const { finalPlayerPhase: _over, ...kept } = pod;
    setPod(ctx, kept);
    if (kept.coordinator === "local" && kept.shared?.status === "schemeCompleted") loseToSharedScheme(ctx, kept);
    // A remote coordinator hears the halt (`groupStatus`) and declares the loss once every group has halted.
    else if (kept.coordinator === "remote" && kept.shared?.status !== "won") setPod(ctx, { ...kept, halted: true });
    return true;
  }
  return false;
}

/**
 * `PodOutboundEvent` other than a shared event (those are `sharedEventEmitted`): numbered with this group's next
 * outbound number and logged as `podEventEmitted`, which a host forwards to the coordinator. Only with a remote
 * coordinator; a pod of one group has nobody to tell.
 */
export function emitPodEvent(ctx: Ctx, event: PodOutboundEvent): void {
  const pod = ctx.state.pod;
  if (!pod || pod.coordinator !== "remote") return;
  const seq = pod.outboundSeq + 1;
  setPod(ctx, { ...pod, outboundSeq: seq });
  emit(ctx, { type: "podEventEmitted", seq, event });
}

/**
 * The game ends at once in this group, whatever is resolving (Q6: "Groups stop at their next command boundary";
 * 55027b "all players in all groups win the game"; MC55 p. 21, every player phase ended: "all players in all groups
 * lose"). The neutral cards' own lines would record the same outcome (`conclude`); they are not waited for, since a
 * choice may be open and nothing more resolves here.
 */
export function concludeFromCoordinator(ctx: Ctx, result: "gameWon" | "gameLost"): void {
  const pod = ctx.state.pod;
  if (!pod) return;
  if (result === "gameWon") {
    if (pod.shared && pod.shared.status !== "won") setShared(ctx, pod, { ...pod.shared, status: "won" });
    endGame(ctx, { result: "win", reason: "villainDefeated" });
    return;
  }
  if (pod.shared) setShared(ctx, pod, sharedLost(pod.shared));
  endGame(ctx, {
    result: "loss",
    reason: "cardAbility",
    sourceInstanceId: pod.neutral?.mainSchemeInstanceId ?? ctx.state.mainScheme.instanceId,
  });
}

/** `PodInboundEvent sharedStateChanged`: this group's copy of the record is replaced. Bookkeeping: no draw, no rule. */
export function replaceSharedCopy(ctx: Ctx, shared: SharedPodState): void {
  const pod = ctx.state.pod;
  if (pod) setShared(ctx, pod, shared);
}

/** This group stops play (MC55 p. 21; M4). The next `groupStatus` tells the coordinator. */
export function haltGroup(ctx: Ctx): void {
  const pod = ctx.state.pod;
  if (pod && !pod.halted) setPod(ctx, { ...pod, halted: true });
}

/**
 * An inbound event applied at a quiet point, nothing resolving (MC55 p. 20: "first finishing any actions or abilities
 * that are currently resolving"; M3). Logged `podInboundApplied`, then what it does.
 */
function applyQueuedInbound(ctx: Ctx, event: PodInboundEvent): void {
  const pod = ctx.state.pod;
  if (!pod) return;
  emit(ctx, { type: "podInboundApplied", kind: event.kind });
  switch (event.kind) {
    case "sharedStateChanged":
      return replaceSharedCopy(ctx, event.shared);
    case "sharedVillainFlipped":
      return applyInbound(ctx, "sharedVillainFlipped");
    case "stopAfterPhase":
      // MC55 p. 21: "Each group in the middle of a villain phase must finish any abilities currently resolving, then stop
      // play immediately; each group in the middle of a player phase may finish that phase as normal." (M4.)
      if (pod.shared?.status === "won") return;
      if (ctx.state.step.phase === "player") setPod(ctx, { ...pod, finalPlayerPhase: true });
      else haltGroup(ctx);
      return;
    case "gameWon":
    case "gameLost":
      return concludeFromCoordinator(ctx, event.kind);
    case "sharedAck":
      if (pod.awaiting !== undefined && pod.awaiting <= event.seq) {
        const { awaiting: _answered, ...kept } = pod;
        setPod(ctx, kept);
      }
      return;
    case "podEffect":
      return resolvePodEffect(ctx, event);
    case "remotePower":
      return resolveRemotePower(ctx, event);
    case "remotePowerResolved":
      return resolveRemotePowerResult(ctx, event);
    case "overkillExcess":
      return resolveOverkillExcess(ctx, event);
    case "remotePowerSettled":
      // How this group's remote power ended where its target is: logged for the game record, nothing else changes.
      emit(ctx, {
        type: "remotePowerSettled",
        fromGroupId: event.fromGroupId,
        playerId: event.playerId,
        power: event.power,
        cardId: event.cardId,
        defeated: event.defeated,
      });
      return;
    case "podReachable":
      return recordPodReachable(ctx, event);
  }
}

/**
 * `PodInboundEvent podEffect` (docs/phase7-wave9.md §3.67, §3.68): block `block` of the named ability, read from this
 * group's own registry, resolves here with this group's first player as "you" (M2: "each group's own first player
 * picks its Synergy environment"), as `resolveInGroup` resolves its own group's block. An ability or block this
 * registry does not have is an invariant break: every group runs the same card scripts.
 */
function resolvePodEffect(ctx: Ctx, event: Extract<PodInboundEvent, { kind: "podEffect" }>): void {
  const definition = ctx.deps.abilities[event.abilityId];
  const block = definition ? podBlocksOf(definition.effects)[event.block - 1] : undefined;
  if (!block) throw new EngineInvariantError(`no inGroup block ${event.block} on ability ${event.abilityId}`);
  pushEffects(ctx, {
    effects: (block as Extract<EffectSpec, { kind: "inGroup" }>).effects,
    selfInstanceId: null,
    controllerId: ctx.state.firstPlayerId,
  });
}

/**
 * The cards of this group's area other groups of the pod may reach (`RuleSpec reachableFromPod`), in play order, with
 * the numbers their players need: hit points left for an attack, threat for a thwart. A stand-in for another group's
 * card (`CardInstance.remoteOf`) is never one.
 */
export function reachableCardsOf(state: GameState, deps: EngineDeps): readonly ReachableCard[] {
  const rules = activeRules(state, deps, "reachableFromPod");
  if (rules.length === 0) return [];
  const found: ReachableCard[] = [];
  for (const id of cardsInPlay(state)) {
    const card = cardOf(state, id);
    if (!card || getInstance(state, id)?.remoteOf) continue;
    for (const by of ["attack", "thwart"] as const) {
      if (!rules.some(({ rule, context }) => rule.by === by && matchesQuery(state, id, rule.card, context))) continue;
      found.push(
        by === "attack"
          ? { instanceId: id, cardId: card.id, by, remainingHitPoints: remainingHitPoints(state, id, deps) ?? 0 }
          : { instanceId: id, cardId: card.id, by, threat: getInstance(state, id)?.threat ?? 0 },
      );
    }
  }
  return found;
}

/** Why `id` cannot be reached here by another group's `power` now, or null. */
export function remoteTargetFault(
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  power: RemotePower,
): string | null {
  return reachableCardsOf(state, deps).some((card) => card.instanceId === id && card.by === power)
    ? null
    : `that card is not in play here, or cannot be ${power === "attack" ? "attacked" : "thwarted"} from another group`;
}

/**
 * `PodInboundEvent remotePower`, in the group whose card was attacked or thwarted.
 *
 * 55041/55046 "as if it were in their game area": a real attack/thwart by the remote character (MC55 insert p.12
 * exception; RRG Attack (Player Ability Type) p.10, Thwart p.44). The attack was made in the attacker's group, with
 * its costs, modifiers and responses there (`Command remotePower`); here it arrives as attack damage carrying the
 * attack's Overkill and Piercing, so the card's own keywords and statuses apply (toughness, tough unless piercing), and
 * the card's retaliate is sent back for the attacker (RRG 1.8 "Retaliate X", p. 37). A thwart removes its threat. The
 * remote attacker is not in this area, so this group's own cards see damage, not an attack (owner question pending,
 * option A: they do not react to a remote attacker). Overkill's excess is measured once the damage has resolved, at
 * the defeat (`overkillExcess`; owner question pending, option A: the attacker's own Avatar of Loki).
 *
 * A card no longer reachable (it left play before the power arrived) refuses it, and the attacker's group treats the
 * power as never started (owner question pending, option A: refund).
 */
function resolveRemotePower(ctx: Ctx, event: Extract<PodInboundEvent, { kind: "remotePower" }>): void {
  const pod = ctx.state.pod;
  if (!pod) return;
  const target = event.targetInstanceId;
  // Committed when this group validates the target (implementation convention pending the rules expert): refused
  // here, the attacker's group refunds; accepted, the answer goes back once the hit applies (`reportRemoteHit`).
  const refused = remoteTargetFault(ctx.state, ctx.deps, target, event.power);
  if (refused !== null || event.amount <= 0) {
    const retaliate =
      refused === null && event.power === "attack" ? keywordTotal(ctx.state, target, "retaliate", ctx.deps) : 0;
    emitPodEvent(ctx, {
      type: "remotePowerResolved",
      groupId: pod.groupId,
      toGroupId: event.fromGroupId,
      ref: event.ref,
      targetInstanceId: target,
      power: event.power,
      retaliate,
      ...(refused === null ? {} : { refused }),
    });
    return;
  }
  const cardId = cardOf(ctx.state, target)?.id;
  if (cardId !== undefined) {
    const settling: RemoteHitSettling = {
      ref: event.ref,
      fromGroupId: event.fromGroupId,
      playerId: event.playerId,
      targetInstanceId: target,
      cardId,
      power: event.power,
    };
    setPod(ctx, { ...pod, remoteHitsSettling: [...(pod.remoteHitsSettling ?? []), settling] });
  }
  const hit: RemoteHit = {
    fromGroupId: event.fromGroupId,
    ref: event.ref,
    retaliate: event.power === "attack" ? keywordTotal(ctx.state, target, "retaliate", ctx.deps) : 0,
  };
  if (event.power === "attack")
    pushEvent(ctx, {
      kind: "dealDamage",
      targetInstanceId: target,
      amount: event.amount,
      sourceInstanceId: null,
      fromAttack: true,
      overkill: event.overkill,
      ...(event.piercing ? { piercing: true } : {}),
      remoteHit: hit,
    });
  else
    pushEvent(ctx, {
      kind: "removeThreat",
      schemeInstanceId: target,
      amount: event.amount,
      sourceInstanceId: null,
      noPlayer: true,
      remoteHit: hit,
    });
}

/**
 * An accepted remote power's hit applies here (the damage or threat removal of `resolveRemotePower`, at its apply
 * step): its answer goes back to the attacker's group, with the card's retaliate. A card that left play while the hit
 * was resolving is reported `lost` (implementation convention, not an official ruling; owner answer 2026-11-20,
 * option A): the attacker's costs and exhaust stand, but it takes no consequential damage and did not attack or
 * thwart, so no retaliate.
 */
export function reportRemoteHit(ctx: Ctx, hit: RemoteHit, target: InstanceId, power: RemotePower): void {
  const pod = ctx.state.pod;
  if (!pod) return;
  const lost = !cardsInPlay(ctx.state).includes(target);
  emitPodEvent(ctx, {
    type: "remotePowerResolved",
    groupId: pod.groupId,
    toGroupId: hit.fromGroupId,
    ref: hit.ref,
    targetInstanceId: target,
    power,
    retaliate: lost ? 0 : hit.retaliate,
    ...(lost ? { lost: true as const } : {}),
  });
  // Its outcome is told at the next quiet point (`settleRemoteHits`); a hit on a card already gone has none.
  const now = ctx.state.pod;
  const settling = now?.remoteHitsSettling;
  if (!now || !settling?.some((entry) => entry.ref === hit.ref && entry.fromGroupId === hit.fromGroupId)) return;
  const kept = settling.flatMap((entry) =>
    entry.ref !== hit.ref || entry.fromGroupId !== hit.fromGroupId
      ? [entry]
      : lost
        ? []
        : [{ ...entry, hit: true as const }],
  );
  setPod(ctx, withSettling(now, kept));
}

const withSettling = (pod: PodState, settling: readonly RemoteHitSettling[]): PodState => {
  const { remoteHitsSettling: _old, ...rest } = pod;
  return settling.length > 0 ? { ...rest, remoteHitsSettling: settling } : rest;
};

/**
 * At a quiet point, the accepted remote powers whose hit has applied and resolved (`PodState.remoteHitsSettling`) are
 * reported back to their groups as `remotePowerSettled`: `defeated` when the card has left play since (engine reading:
 * nothing but the hit and what answered it resolved in between, so leaving play is the attack's defeat of The Mangog
 * or the thwart's clearing of Door Between Worlds; a card kept in play at no threat or no hit points is not). One whose
 * hit never applied is dropped. Not after the game has ended here: nothing more is sent. True when anything changed.
 */
function settleRemoteHits(ctx: Ctx, pod: PodState): boolean {
  const settling = pod.remoteHitsSettling;
  if (!settling || settling.length === 0) return false;
  setPod(ctx, withSettling(pod, []));
  if (ctx.state.outcome) return true;
  const inPlay = cardsInPlay(ctx.state);
  for (const entry of settling) {
    if (!entry.hit) continue;
    emitPodEvent(ctx, {
      type: "remotePowerSettled",
      groupId: pod.groupId,
      toGroupId: entry.fromGroupId,
      ref: entry.ref,
      playerId: entry.playerId,
      targetInstanceId: entry.targetInstanceId,
      cardId: entry.cardId,
      power: entry.power,
      defeated: !inPlay.includes(entry.targetInstanceId),
    });
  }
  return true;
}

/**
 * A remote attack's excess, at the defeat of the card it attacked (`beginDefeat`; RRG 1.8 "Overkill", p. 31): sent to
 * the attacker's group rather than spilled onto this group's villain (owner question pending, option A).
 */
export function sendOverkillExcess(ctx: Ctx, hit: RemoteHit, amount: number): void {
  const pod = ctx.state.pod;
  if (!pod || amount <= 0) return;
  emitPodEvent(ctx, { type: "overkillExcess", groupId: pod.groupId, toGroupId: hit.fromGroupId, ref: hit.ref, amount });
}

/**
 * Where a stand-in's power goes (`CardInstance.remoteOf`): damage dealt to it, or threat removed from it, is not dealt
 * here but sent to the group whose card it stands for, as `remotePowerUsed` with the amount this group's modifiers
 * made it and the attack's keywords. True when `targetId` is a stand-in (the caller then does nothing more).
 */
export function divertToRemote(
  ctx: Ctx,
  targetId: InstanceId,
  power: RemotePower,
  amount: number,
  keywords: { readonly overkill: boolean; readonly piercing: boolean },
  /** The card the damage or removal comes from, and whether it is an attack's damage. */
  from: { readonly sourceInstanceId: InstanceId | null; readonly fromAttack: boolean },
): boolean {
  const pod = ctx.state.pod;
  const remote = getInstance(ctx.state, targetId)?.remoteOf;
  if (!pod || !remote) return false;
  const flight = pod.inFlight?.find((entry) => entry.ref === targetId);
  // Only the power's own damage (its attack's, from its character) or threat removal (its thwart's), once. Anything else
  // aimed at the stand-in (a response's damage, an "each enemy" effect) is not dealt at all, here or there: the card is
  // not in this area for it (MC55 p. 12), and nothing is taken, so no "after damaged" ability answers it.
  const own =
    flight !== undefined &&
    !flight.sent &&
    from.sourceInstanceId === flight.characterInstanceId &&
    (power === "thwart" || from.fromAttack);
  if (!own) {
    emit(ctx, { type: "remoteStandIn", instanceId: targetId, placed: true, ignored: power });
    return true;
  }
  emitPodEvent(ctx, {
    type: "remotePowerUsed",
    groupId: pod.groupId,
    playerId: flight?.playerId ?? ctx.state.firstPlayerId,
    toGroupId: remote.groupId,
    targetInstanceId: remote.instanceId,
    ref: targetId,
    power,
    amount: Math.max(0, amount),
    overkill: keywords.overkill,
    piercing: keywords.piercing,
  });
  // The character's consequential damage waits under the power: it is taken off and dealt only once the owning group
  // accepts the power (`resolveRemotePowerResult`). Refused, the power was not initiated and dealt none (RRG 1.8
  // "Initiating Abilities", p. 24 step 2); lost after acceptance, it dealt none either ("Consequential Damage", p. 13).
  const character = flight.characterInstanceId;
  const waiting = ctx.state.stack.filter(
    (frame) =>
      frame.kind === "event" &&
      frame.event.kind === "dealDamage" &&
      frame.event.consequentialFrom !== undefined &&
      frame.event.targetInstanceId === character,
  );
  const consequential = waiting.reduce(
    (sum, frame) => sum + (frame.kind === "event" && frame.event.kind === "dealDamage" ? frame.event.amount : 0),
    0,
  );
  if (waiting.length > 0)
    ctx.state = { ...ctx.state, stack: ctx.state.stack.filter((frame) => !waiting.includes(frame)) };
  const after = ctx.state.pod;
  if (after?.inFlight)
    setPod(ctx, {
      ...after,
      inFlight: after.inFlight.map((entry) =>
        entry.ref === targetId ? { ...entry, sent: true, consequential: entry.consequential + consequential } : entry,
      ),
    });
  return true;
}

/**
 * The stand-ins of remote powers leave once nothing is resolving (their power has been made or cancelled), and an
 * in-flight power that never sent anything (a stunned attacker, a confused thwarter) is forgotten: its status discard
 * and exhaust stand (RRG 1.8 "Stun, Stunned", p. 41). True when anything changed.
 */
function removeStandIns(ctx: Ctx): boolean {
  const standIns = ctx.state.villainArea.filter((id) => getInstance(ctx.state, id)?.remoteOf);
  const pod = ctx.state.pod;
  const unsent = pod?.inFlight?.filter((entry) => !entry.sent) ?? [];
  if (standIns.length === 0 && unsent.length === 0) return false;
  const instances = { ...ctx.state.instances };
  for (const id of standIns) delete instances[id];
  ctx.state = {
    ...ctx.state,
    instances,
    villainArea: ctx.state.villainArea.filter((id) => !standIns.includes(id)),
  };
  for (const id of standIns) emit(ctx, { type: "remoteStandIn", instanceId: id, placed: false });
  const now = ctx.state.pod;
  if (now && unsent.length > 0) {
    const kept = (now.inFlight ?? []).filter((entry) => entry.sent);
    const { inFlight: _dropped, ...rest } = now;
    setPod(ctx, kept.length > 0 ? { ...rest, inFlight: kept } : rest);
  }
  return true;
}

/**
 * `PodInboundEvent remotePowerResolved`, in the attacker's group. The power is no longer in flight.
 *
 * Cross-group attack/thwart (55041/55046) is initiated when the owning group's engine accepts it (engine reading: no
 * source orders events across groups, MC55 p.12). No valid target then = not initiated, no cost paid (RRG v1.8
 * Initiating Abilities p.24 step 2; Target p.42; Cost p.13). Target leaves play after that = exhausts, no consequential
 * damage, not considered to have attacked (Consequential Damage p.13).
 *
 * - Accepted: the character's consequential damage, held back when the power was sent (`divertToRemote`), is dealt now,
 *   as consequential damage (a tough card absorbs it as usual); then the attacked card's retaliate hits the attacker
 *   (RRG 1.8 "Retaliate X", p. 37).
 * - Lost while resolving (`lost`): nothing more; the exhaust and costs stand (implementation convention, not an official
 *   ruling; owner answer 2026-11-20).
 * - Refused: the character readies and the hand cards spent on the power's costs (under any cost key) come back from
 *   the discard pile. A refund undoes, so no "cannot ready" applies to it. Engine reading A: a synergy counter spent on
 *   Domineering Force or Mounting Resistance stands, being the cost of that interrupt, an ability of its own that
 *   resolved, not a cost of the power; so do resource abilities used in the payment.
 */
function resolveRemotePowerResult(ctx: Ctx, event: Extract<PodInboundEvent, { kind: "remotePowerResolved" }>): void {
  const pod = ctx.state.pod;
  if (!pod) return;
  const flight = pod.inFlight?.find((entry) => entry.ref === event.ref);
  if (flight) {
    const rest = (pod.inFlight ?? []).filter((entry) => entry !== flight);
    const { inFlight: _done, ...kept } = pod;
    setPod(ctx, rest.length > 0 ? { ...kept, inFlight: rest } : kept);
  }
  if (!flight) return;
  const character = flight.characterInstanceId;
  const inPlay = cardsInPlay(ctx.state).includes(character);
  if (event.lost) return;
  if (event.refused !== undefined) {
    if (inPlay && getInstance(ctx.state, character)?.exhausted) {
      updateInstance(ctx, character, (i) => ({ ...i, exhausted: false }));
      emit(ctx, { type: "cardReadied", instanceId: character });
    }
    for (const id of flight.spent) {
      const owner = getInstance(ctx.state, id)?.ownerId;
      const player = owner ? ctx.state.players.find((p) => p.playerId === owner) : undefined;
      if (player?.discard.includes(id)) moveCard(ctx, id, { kind: "hand", playerId: player.playerId });
    }
    return;
  }
  if (!inPlay) return;
  // Pushed first, so the retaliate (pushed above it) resolves before it, as an attack's retaliate does (RRG 1.8
  // "Attack (Player Ability Type)", p. 9: the retaliate in the attack's response window, consequential damage after).
  if (flight.consequential > 0) pushEvent(ctx, consequentialDamageEvent(character, flight.consequential, event.power));
  if (event.retaliate > 0)
    pushEvent(ctx, {
      kind: "dealDamage",
      targetInstanceId: character,
      amount: event.retaliate,
      sourceInstanceId: null,
      fromAttack: false,
    });
}

/**
 * `PodInboundEvent overkillExcess`, in the attacker's group: the excess of its remote attack is dealt to this group's
 * villain as the attack's damage, not as an attack on it (RRG 1.8 "Overkill", p. 31; owner question pending, option A:
 * the attacker's own Avatar of Loki).
 */
function resolveOverkillExcess(ctx: Ctx, event: Extract<PodInboundEvent, { kind: "overkillExcess" }>): void {
  if (event.amount <= 0) return;
  pushEvent(ctx, {
    kind: "dealDamage",
    targetInstanceId: ctx.state.activeVillainId,
    amount: event.amount,
    sourceInstanceId: null,
    fromAttack: true,
    notAttacked: true,
  });
}

/**
 * A stand-in for another group's card, in this group's villain area for one basic power (`Command remotePower`):
 * "as if it were in their game area". It has no text box here (`CardInstance.remoteOf`); its numbers are the last
 * report's: the threat on a side scheme, the hit points left on a minion (its damage set to match).
 */
export function placeStandIn(ctx: Ctx, groupId: GroupId, card: ReachableCard): InstanceId {
  const id = nextInstanceId(ctx);
  ctx.state = {
    ...ctx.state,
    instances: {
      ...ctx.state.instances,
      [id]: {
        instanceId: id,
        cardId: card.cardId,
        ownerId: null,
        controllerId: null,
        home: { kind: "activeEncounterDeck" },
        faceup: true,
        exhausted: false,
        damage: 0,
        threat: card.threat ?? 0,
        statuses: { stunned: 0, confused: 0, tough: 0 },
        counters: {},
        attachedTo: null,
        attachments: [],
        boostCards: [],
        tucked: [],
        facedownAs: null,
        engagedWith: null,
        flipped: false,
        remoteOf: { groupId, instanceId: card.instanceId },
      },
    },
    villainArea: [...ctx.state.villainArea, id],
  };
  if (card.remainingHitPoints !== undefined) {
    const max = maxHitPoints(ctx.state, id, ctx.deps) ?? 0;
    updateInstance(ctx, id, (i) => ({ ...i, damage: Math.max(0, max - card.remainingHitPoints!) }));
  }
  emit(ctx, { type: "remoteStandIn", instanceId: id, placed: true, groupId, remoteInstanceId: card.instanceId });
  return id;
}

/** `PodInboundEvent podReachable`: another group's reachable cards, kept for `Command remotePower` (bookkeeping). */
export function recordPodReachable(ctx: Ctx, event: Extract<PodInboundEvent, { kind: "podReachable" }>): void {
  const pod = ctx.state.pod;
  if (!pod) return;
  setPod(ctx, { ...pod, reachable: { ...pod.reachable, [event.groupId]: event.cards } });
}

/**
 * `EffectSpec inGroup` (docs/phase7-wave9.md §3.67): the block resolves in each group it names. For this group, as a
 * frame of its own with this group's first player as "you" and nothing of the ability around it (no slot, var or
 * event), which is exactly what another group would be sent. For another group, nothing resolves here and the block is
 * requested of the pod's coordinator by its place in the ability.
 */
export function resolveInGroup(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "inGroup" }>,
): void {
  const own = ctx.state.pod?.groupId ?? podGroupIds(ctx.state)[0];
  const named =
    effect.group === "eachInPod" ? podGroupIds(ctx.state) : [resolveGroup(ctx.state, effect.group, frame.vars)];
  for (const group of named) {
    if (group === undefined) continue;
    if (group === own) {
      pushEffects(ctx, {
        effects: effect.effects,
        selfInstanceId: frame.selfInstanceId,
        abilityId: frame.abilityId,
        instruction: frame.instruction,
        controllerId: ctx.state.firstPlayerId,
      });
      continue;
    }
    const sourceCardId = frame.selfInstanceId === null ? undefined : cardOf(ctx.state, frame.selfInstanceId)?.id;
    const definition = frame.abilityId === undefined ? undefined : ctx.deps.abilities[frame.abilityId];
    // Found by content, not identity: a frame restored from a save holds a copy of the registry's effect.
    const wanted = JSON.stringify(effect);
    const block = definition ? podBlocksOf(definition.effects).findIndex((b) => JSON.stringify(b) === wanted) : -1;
    if (sourceCardId === undefined || frame.abilityId === undefined || block < 0)
      throw new EngineInvariantError("an inGroup block for another group must be part of a card's ability");
    // Numbered with the group's other outbound events, so the coordinator applies it once (§3.68; plan §4 item 1).
    const pod = ctx.state.pod;
    const seq = (pod?.outboundSeq ?? 0) + 1;
    if (pod) setPod(ctx, { ...pod, outboundSeq: seq });
    emit(ctx, {
      type: "podEffectRequested",
      seq,
      toGroupId: group,
      sourceCardId,
      abilityId: frame.abilityId,
      block: block + 1,
    });
  }
}
