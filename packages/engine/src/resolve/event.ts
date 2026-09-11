/** Event frames (interrupts → apply → responses) and the state change each event kind makes. */

import { type Ctx, emit, popFrame, pushFrames, setFrame, updateFrame, updateInstance } from "../ctx.js";
import { discardFromPlay, expireEventLastingEffects, healDamage, pierceTough } from "../effects.js";
import type { FrameId, InstanceId } from "../ids.js";
import { hasKeyword, keywordTotal } from "../keywords.js";
import { cardOf, characterProfile, countSchemeIcons, getInstance, getPlayer, isMinion, mustInstance } from "../query.js";
import { cannotTakeDamage, threatCannotBeRemoved } from "../rules.js";
import { cardsInPlay, controllerOf } from "../select.js";
import type { StackFrame, Vars } from "../stack.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { checkDefeats, checkMainSchemeCompletion } from "./defeat.js";
import { pushEnemyAttackFrame, pushEnemySchemeFrame } from "./enemy-activation.js";
import {
  addFrameSlots,
  addFrameVars,
  base,
  eventFrame,
  type Frame,
  gameAbilityFrames,
  pushEffects,
  pushEvent,
  pushEvents,
} from "./frames.js";
import { hasCandidates } from "./triggers.js";
import { pushWindow } from "./window.js";

export function executeEventFrame(ctx: Ctx, frame: Frame<"event">): void {
  switch (frame.stage) {
    case "interrupts": {
      emit(ctx, { type: "triggerEvent", event: frame.event, phase: "initiated" });
      setFrame(ctx, { ...frame, stage: "apply" });
      if (hasCandidates(ctx.state, ctx.deps, frame.event, "interrupt")) {
        pushWindow(ctx, frame.event, "interrupt", frame.frameId);
      }
      return;
    }
    case "apply": {
      if (frame.cancelled) {
        // RRG "Cancel": the canceled effect is not considered to have occurred, so no responses.
        emit(ctx, { type: "triggerEvent", event: frame.event, phase: "cancelled" });
        reportResults(ctx, frame, false);
        expireEventLastingEffects(ctx, frame.frameId);
        popFrame(ctx);
        return;
      }
      setFrame(ctx, { ...frame, stage: "responses" });
      if (applyEvent(ctx, frame) === false) {
        // The event found nothing to do (a defeat whose character was healed first):
        // it didn't happen, so nothing responds to it.
        updateFrame(ctx, frame.frameId, (f) => (f.kind === "event" ? { ...f, stage: "done" } : f));
      }
      return;
    }
    case "responses": {
      // Results are final once everything the event pushed has resolved.
      const event = withResults(frame.event, frame.vars);
      emit(ctx, { type: "triggerEvent", event, phase: "resolved" });
      setFrame(ctx, { ...frame, event, stage: "done" });
      if (hasCandidates(ctx.state, ctx.deps, event, "response")) {
        pushWindow(ctx, event, "response", frame.frameId);
      }
      return;
    }
    case "done": {
      if (frame.endEffects.length > 0) {
        // "At the end of this attack": run after the response window, before the event is gone.
        setFrame(ctx, { ...frame, endEffects: [] });
        const event = withResults(frame.event, frame.vars);
        for (const deferred of [...frame.endEffects].reverse()) {
          pushEffects(ctx, { ...deferred, event, eventFrameId: null });
        }
        return;
      }
      reportResults(ctx, frame, true);
      expireEventLastingEffects(ctx, frame.frameId);
      popFrame(ctx);
      return;
    }
  }
}

const withResults = (event: TriggerEvent, vars: Vars): TriggerEvent =>
  Object.keys(vars).length === 0 ? event : { ...event, results: vars };

/** An event frame is finishing: hand its results (and whether it happened) to whoever asked for them. */
function reportResults(ctx: Ctx, frame: Frame<"event">, happened: boolean): void {
  if (!frame.reportTo) return;
  const { frameId, prefix } = frame.reportTo;
  const delta: Record<string, number> = { [`${prefix}.made`]: happened ? 1 : 0 };
  if (happened) for (const [key, amount] of Object.entries(frame.vars)) delta[`${prefix}.${key}`] = amount;
  addFrameVars(ctx, frameId, delta);
  if (happened) {
    const slots: Record<string, readonly InstanceId[]> = {};
    for (const [key, ids] of Object.entries(frame.slots)) slots[`${prefix}.${key}`] = ids;
    addFrameSlots(ctx, frameId, slots);
  }
}

/** Applies an event's state change; returns false if the event turned out not to happen. */
function applyEvent(ctx: Ctx, frame: Frame<"event">): boolean | void {
  const event = frame.event;
  switch (event.kind) {
    case "dealDamage":
      return applyDamage(ctx, event, frame.frameId);
    case "healDamage": {
      const before = getInstance(ctx.state, event.targetInstanceId)?.damage ?? 0;
      healDamage(ctx, event.targetInstanceId, event.amount);
      const after = getInstance(ctx.state, event.targetInstanceId)?.damage ?? 0;
      addFrameVars(ctx, frame.frameId, { amount: before - after });
      return;
    }
    case "placeThreat":
      return applyPlaceThreat(ctx, event, frame.frameId);
    case "removeThreat":
      return applyRemoveThreat(ctx, event, frame.frameId);
    case "attack":
      return applyPlayerAttack(ctx, event, frame.frameId);
    case "thwart":
      return applyPlayerThwart(ctx, event, frame.frameId);
    case "enemyAttack":
      return pushEnemyAttackFrame(ctx, event, frame.frameId);
    case "enemyScheme":
      return pushEnemySchemeFrame(ctx, event, frame.frameId);
    case "characterAttacked":
      return applyRetaliate(ctx, event);
    case "characterDefeated":
      return applyDefeat(ctx, event);
    default:
      return;
  }
}

/**
 * RRG "Defeat": an ally or minion with damage equal to its hit points is
 * defeated and discarded (attachments with it). Runs after the defeat's
 * interrupt window, so a "would be defeated … instead" effect that healed it
 * means nothing happens. Overkill excess is dealt only if the defeat happens.
 */
function applyDefeat(ctx: Ctx, event: Extract<TriggerEvent, { kind: "characterDefeated" }>): boolean {
  const id = event.instanceId;
  const instance = getInstance(ctx.state, id);
  if (!instance || !cardsInPlay(ctx.state).includes(id)) return false;
  const profile = characterProfile(ctx.state, id, ctx.deps);
  if (!profile || instance.damage < profile.maxHp) return false;
  if (hasKeyword(ctx.state, id, "permanent", ctx.deps)) return false;
  emit(ctx, { type: "characterDefeated", instanceId: id, cardId: instance.cardId });
  const whenDefeated = gameAbilityFrames(ctx, id, ["whenDefeated"], event, undefined, instance.engagedWith ?? ctx.state.firstPlayerId);
  discardFromPlay(ctx, id);
  addFrameVars(ctx, event.parentFrameId, { defeated: 1 });
  const frames: StackFrame[] = [...whenDefeated];
  if (event.overkill && !ctx.state.outcome && getInstance(ctx.state, event.overkill.toInstanceId)) {
    emit(ctx, { type: "overkillSpilled", fromInstanceId: id, toInstanceId: event.overkill.toInstanceId, amount: event.overkill.amount });
    // RRG "Overkill": spilled damage is attack damage but not an attack against that character.
    frames.push(
      eventFrame(ctx, {
        kind: "dealDamage",
        targetInstanceId: event.overkill.toInstanceId,
        amount: event.overkill.amount,
        sourceInstanceId: event.overkill.sourceInstanceId,
        fromAttack: true,
      }),
    );
  }
  pushFrames(ctx, frames);
  return true;
}

/**
 * RRG "Overkill": excess damage spills to the villain when the attack defeats a
 * minion, and to the controlling player's hero when an *ally used to defend*
 * is defeated — an ally hit by anything other than a defense does not spill.
 */
function overkillRecipient(state: GameState, targetId: InstanceId): InstanceId | null {
  const card = cardOf(state, targetId);
  if (isMinion(state, targetId)) return state.villain.instanceId;
  if (card?.type !== "ally") return null;
  const defended = state.stack.some(
    (frame) => frame.kind === "enemyAttack" && frame.defenderInstanceId === targetId,
  );
  if (!defended) return null;
  const controller = controllerOf(state, targetId);
  return controller ? (getPlayer(state, controller)?.identity.instanceId ?? null) : null;
}

/** RRG "Tough": a tough status prevents all damage and is discarded instead. */
function applyDamage(ctx: Ctx, event: Extract<TriggerEvent, { kind: "dealDamage" }>, frameId: FrameId): void {
  if (event.amount <= 0) return;
  const source = event.sourceInstanceId;
  const attackKeyword = (name: "piercing" | "overkill"): boolean =>
    event.fromAttack && source !== null && hasKeyword(ctx.state, source, name, ctx.deps);

  // RRG "Cannot": "cannot take damage" beats everything, including tough (which then isn't used).
  if (cannotTakeDamage(ctx.state, ctx.deps, event.targetInstanceId, [source, event.viaInstanceId])) {
    emit(ctx, { type: "damagePrevented", targetInstanceId: event.targetInstanceId, amount: event.amount, reason: "cannotTakeDamage" });
    return;
  }
  if (attackKeyword("piercing")) pierceTough(ctx, event.targetInstanceId);

  const target = getInstance(ctx.state, event.targetInstanceId);
  if (!target) return;
  if (target.statuses.tough > 0) {
    updateInstance(ctx, event.targetInstanceId, (i) => ({
      ...i,
      statuses: { ...i.statuses, tough: i.statuses.tough - 1 },
    }));
    emit(ctx, { type: "damagePrevented", targetInstanceId: event.targetInstanceId, amount: event.amount, reason: "tough" });
    emit(ctx, {
      type: "statusRemoved",
      instanceId: event.targetInstanceId,
      status: "tough",
      reason: "preventedDamage",
    });
    return;
  }
  updateInstance(ctx, event.targetInstanceId, (i) => ({ ...i, damage: i.damage + event.amount }));
  emit(ctx, {
    type: "damageDealt",
    targetInstanceId: event.targetInstanceId,
    amount: event.amount,
    sourceInstanceId: event.sourceInstanceId,
  });
  addFrameVars(ctx, frameId, { amount: event.amount });
  addFrameVars(ctx, event.parentFrameId, { damage: event.amount, damaged: 1 });
  addFrameSlots(ctx, event.parentFrameId, { damaged: [event.targetInstanceId] });

  const profile = characterProfile(ctx.state, event.targetInstanceId, ctx.deps);
  const damage = mustInstance(ctx.state, event.targetInstanceId).damage;
  const overkill = event.fromAttack && (event.overkill === true || attackKeyword("overkill"));
  const excess = overkill && profile ? damage - profile.maxHp : 0;
  const recipient = excess > 0 ? overkillRecipient(ctx.state, event.targetInstanceId) : null;
  const villainStage = ctx.state.villain.stageIndex;

  checkDefeats(ctx, {
    targetId: event.targetInstanceId,
    parentFrameId: event.parentFrameId ?? null,
    overkill: recipient ? { amount: excess, toInstanceId: recipient, sourceInstanceId: source } : undefined,
    defeatedByPlayerId: source !== null ? controllerOf(ctx.state, source) : null,
  });

  // Allies and minions report their defeat when the defeat event applies; a villain stage falls now.
  if (event.targetInstanceId === ctx.state.villain.instanceId && (ctx.state.villain.stageIndex !== villainStage || ctx.state.villain.defeated)) {
    addFrameVars(ctx, event.parentFrameId, { defeated: 1 });
  }
}

/**
 * RRG "Retaliate X": a forced response after the character is attacked; it must
 * still be in play once the attack resolves. RRG "Ranged": an attack with ranged
 * ignores retaliate entirely.
 */
function applyRetaliate(ctx: Ctx, event: Extract<TriggerEvent, { kind: "characterAttacked" }>): void {
  if (hasKeyword(ctx.state, event.attackerInstanceId, "ranged", ctx.deps)) return;
  const inPlay = cardsInPlay(ctx.state);
  if (!inPlay.includes(event.targetInstanceId) || !inPlay.includes(event.attackerInstanceId)) return;
  const amount = keywordTotal(ctx.state, event.targetInstanceId, "retaliate", ctx.deps);
  if (amount <= 0) return;
  pushEvent(ctx, {
    kind: "dealDamage",
    targetInstanceId: event.attackerInstanceId,
    amount,
    sourceInstanceId: event.targetInstanceId,
    fromAttack: false,
  });
}

function applyPlaceThreat(ctx: Ctx, event: Extract<TriggerEvent, { kind: "placeThreat" }>, frameId: FrameId): void {
  if (event.amount <= 0) return;
  if (!getInstance(ctx.state, event.schemeInstanceId)) return;
  updateInstance(ctx, event.schemeInstanceId, (i) => ({ ...i, threat: i.threat + event.amount }));
  emit(ctx, {
    type: "threatPlaced",
    schemeInstanceId: event.schemeInstanceId,
    amount: event.amount,
    sourceInstanceId: event.sourceInstanceId,
  });
  addFrameVars(ctx, frameId, { amount: event.amount });
  addFrameVars(ctx, event.parentFrameId, { threatPlaced: event.amount });
  if (event.schemeInstanceId === ctx.state.mainScheme.instanceId) checkMainSchemeCompletion(ctx);
}

function applyRemoveThreat(ctx: Ctx, event: Extract<TriggerEvent, { kind: "removeThreat" }>, frameId: FrameId): void {
  const scheme = getInstance(ctx.state, event.schemeInstanceId);
  if (!scheme) return;
  // RRG "Crisis Icon": while a crisis icon is in play, players cannot remove threat from the main scheme.
  const byPlayer = event.sourceInstanceId === null || controllerOf(ctx.state, event.sourceInstanceId) !== null;
  if (event.schemeInstanceId === ctx.state.mainScheme.instanceId && byPlayer && countSchemeIcons(ctx.state, "crisis") > 0) {
    emit(ctx, { type: "threatRemovalBlocked", schemeInstanceId: event.schemeInstanceId, reason: "crisis" });
    return;
  }
  if (threatCannotBeRemoved(ctx.state, ctx.deps, event.schemeInstanceId)) {
    emit(ctx, { type: "threatRemovalBlocked", schemeInstanceId: event.schemeInstanceId, reason: "rule" });
    return;
  }
  const removed = Math.min(event.amount, scheme.threat);
  if (removed <= 0) return;
  updateInstance(ctx, event.schemeInstanceId, (i) => ({ ...i, threat: i.threat - removed }));
  emit(ctx, {
    type: "threatRemoved",
    schemeInstanceId: event.schemeInstanceId,
    amount: removed,
    sourceInstanceId: event.sourceInstanceId,
  });
  addFrameVars(ctx, frameId, { amount: removed });
  addFrameVars(ctx, event.parentFrameId, { threatRemoved: removed });
  const after = mustInstance(ctx.state, event.schemeInstanceId);
  const card = cardOf(ctx.state, event.schemeInstanceId);
  const isSideScheme = card?.type === "side_scheme" || card?.type === "player_side_scheme";
  if (isSideScheme && after.threat === 0) {
    emit(ctx, { type: "schemeDefeated", instanceId: event.schemeInstanceId, cardId: after.cardId });
    // Its "When Defeated" resolves first, then it leaves play (so tucked cards it returns aren't discarded first).
    const effectsFrame: StackFrame = {
      ...base(ctx),
      kind: "effects",
      effects: [{ kind: "discardFromPlay", target: { kind: "self" } }],
      cursor: 0,
      bindings: {},
      vars: {},
      scopedPlayerId: null,
      selfInstanceId: event.schemeInstanceId,
      controllerId: null,
      event: null,
      eventFrameId: null,
    };
    pushFrames(ctx, [
      ...gameAbilityFrames(ctx, event.schemeInstanceId, ["whenDefeated"], null, undefined, ctx.state.firstPlayerId),
      effectsFrame,
      eventFrame(ctx, { kind: "schemeDefeated", instanceId: event.schemeInstanceId }),
    ]);
  }
}

function applyPlayerAttack(ctx: Ctx, event: Extract<TriggerEvent, { kind: "attack" }>, frameId: FrameId): void {
  const profile = characterProfile(ctx.state, event.attackerInstanceId, ctx.deps);
  if (!getInstance(ctx.state, event.targetInstanceId)) return;
  if (profile?.missing.includes("atk")) return;
  const amount = event.amount ?? profile?.atk;
  if (amount === undefined) return;
  pushEvents(ctx, [
    {
      kind: "dealDamage",
      targetInstanceId: event.targetInstanceId,
      amount,
      sourceInstanceId: event.attackerInstanceId,
      fromAttack: true,
      parentFrameId: frameId,
      overkill: event.overkill === true,
      viaInstanceId: event.sourceInstanceId ?? null,
    },
    {
      kind: "characterAttacked",
      attackerInstanceId: event.attackerInstanceId,
      targetInstanceId: event.targetInstanceId,
      playerId: event.playerId,
    },
  ]);
}

function applyPlayerThwart(ctx: Ctx, event: Extract<TriggerEvent, { kind: "thwart" }>, frameId: FrameId): void {
  const thwarter = characterProfile(ctx.state, event.thwarterInstanceId, ctx.deps);
  if (thwarter?.missing.includes("thw")) return;
  const amount = event.amount ?? thwarter?.thw;
  if (amount === undefined) return;
  pushEvent(ctx, {
    kind: "removeThreat",
    schemeInstanceId: event.schemeInstanceId,
    amount,
    sourceInstanceId: event.thwarterInstanceId,
    parentFrameId: frameId,
  });
}
