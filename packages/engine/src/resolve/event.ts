/** Event frames (interrupts → apply → responses) and the state change each event kind makes. */

import { type Ctx, emit, findFrame, popFrame, pushFrames, setFrame, updateFrame, updateInstance } from "../ctx.js";
import { discardFromPlay, expireEventLastingEffects, healDamage, pierceTough } from "../effects.js";
import type { FrameId, InstanceId } from "../ids.js";
import { hasKeyword, keywordTotal } from "../keywords.js";
import { activeVillain, cardOf, characterProfile, countSchemeIcons, getInstance, getPlayer, isMinion, mustInstance, villainOf } from "../query.js";
import type { EngineDeps } from "../abilities.js";
import { cannotTakeDamage, notDefeatedWithoutThreat, threatCannotBeRemoved } from "../rules.js";
import { cardsInPlay, controllerOf } from "../select.js";
import type { StackFrame, Vars } from "../stack.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { checkDefeats, checkMainSchemeCompletion, eliminatePlayer } from "./defeat.js";
import { dashedStatSkipsActivation, pushEnemyAttackFrame, pushEnemySchemeFrame } from "./enemy-activation.js";
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
import { finishTurn } from "../flow.js";
import { resolveSurge } from "./reveal.js";
import { candidatesFor, hasCandidates } from "./triggers.js";
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
      if (frame.group) {
        // A simultaneous damage group's member: its interrupts are done, and the group applies it with the others.
        const { frameId: groupId, index } = frame.group;
        const event = frame.event;
        if (frame.cancelled) emit(ctx, { type: "triggerEvent", event, phase: "cancelled" });
        updateFrame(ctx, groupId, (group) =>
          group.kind === "damageGroup" && event.kind === "dealDamage"
            ? { ...group, members: group.members.map((member, i) => (i === index ? { ...member, event, cancelled: frame.cancelled } : member)) }
            : group,
        );
        popFrame(ctx);
        return;
      }
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
      // How many forced responses this event triggers, reported to a `bind` ("If that scheme's 'Forced Response'
      // ability is not triggered this way"). Only recorded when there are some, so other results are unchanged.
      const forcedResponses = candidatesFor(ctx.state, ctx.deps, event, "response", true).length;
      setFrame(ctx, { ...frame, event, stage: "done", ...(forcedResponses > 0 ? { vars: { ...frame.vars, forcedResponses } } : {}) });
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
    case "turnEnding":
      finishTurn(ctx, event.playerId);
      return;
    case "surgeResolving":
      resolveSurge(ctx, event.instanceId, event.playerId);
      return;
    case "enemyAttack":
    case "enemyScheme": {
      const activation = event.kind === "enemyAttack" ? "attack" : "scheme";
      // RRG 1.8 "Activation" (p. 6): "If an activating minion leaves play, that minion's activation ends immediately"
      // (FAQ "Nova (#12)", p. 59: defeating the attacker in its "initiates an attack" window ends the attack).
      const leftPlay = !cardsInPlay(ctx.state).includes(event.enemyInstanceId);
      if (leftPlay || dashedStatSkipsActivation(ctx.state, ctx.deps, event.enemyInstanceId, activation)) {
        emit(ctx, { type: "activationSkipped", enemyInstanceId: event.enemyInstanceId, activation, reason: leftPlay ? "leftPlay" : "dashedStat" });
        // The activation does not happen: no boost card, no responses, and a `bind` reports `made` 0.
        setFrame(ctx, { ...frame, stage: "apply", cancelled: true });
        return;
      }
      return event.kind === "enemyAttack" ? pushEnemyAttackFrame(ctx, event, frame.frameId) : pushEnemySchemeFrame(ctx, event, frame.frameId);
    }
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
  // An identity at zero remaining hit points is eliminated, not discarded (RRG 1.8 "Hit Points", p. 22). Reaching
  // here means no interrupt replaced the defeat ("set his hit point dial to 1 instead", Captain America's Helmet).
  const player = ctx.state.players.find((seat) => seat.identity.instanceId === id);
  if (player) {
    emit(ctx, { type: "characterDefeated", instanceId: id, cardId: instance.cardId });
    eliminatePlayer(ctx, player.playerId);
    return true;
  }
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
  if (isMinion(state, targetId)) {
    // "To the villain" is read as the active villain. Open (docs/phase7-wave1.md §4.5): the insert's "'the villain'
    // only refers to the active villain" speaks of card effects, and overkill is a keyword.
    const active = activeVillain(state);
    return active.defeated ? null : active.instanceId;
  }
  if (card?.type !== "ally") return null;
  const defended = state.stack.some(
    (frame) => frame.kind === "enemyAttack" && frame.defenderInstanceId === targetId,
  );
  if (!defended) return null;
  const controller = controllerOf(state, targetId);
  return controller ? (getPlayer(state, controller)?.identity.instanceId ?? null) : null;
}

/** RRG "Tough": a tough status prevents all damage and is discarded instead. */
/** `sweep` false: a `damageGroup` applies several at once and sweeps for defeats itself afterwards. */
export function applyDamage(ctx: Ctx, event: Extract<TriggerEvent, { kind: "dealDamage" }>, frameId: FrameId, sweep = true): void {
  if (event.amount <= 0) return;
  // RRG 1.8 "Excess Damage" (p. 19): damage dealt beyond remaining hit points. Ruling, Jan 26, 2026 (3): it is dealt
  // even when the target does not take it, so it is measured before tough and "cannot take damage".
  const hit = getInstance(ctx.state, event.targetInstanceId);
  const maxHp = characterProfile(ctx.state, event.targetInstanceId, ctx.deps)?.maxHp;
  const excessDealt = hit && maxHp !== undefined ? event.amount - Math.max(0, maxHp - hit.damage) : 0;
  if (excessDealt > 0) {
    addFrameVars(ctx, frameId, { excessDealt });
    addFrameVars(ctx, event.parentFrameId, { excessDealt });
  }
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
  // "This damage ignores tough status cards" (Lightning Strike, errata RRG 1.8 p. 65): the damage is taken and the
  // status card stays. Piercing is the keyword the RRG defines as discarding it, so "ignores" does not (§3.13).
  if (target.statuses.tough > 0 && event.ignoreTough !== true) {
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
  if (!sweep) return;

  const profile = characterProfile(ctx.state, event.targetInstanceId, ctx.deps);
  const damage = mustInstance(ctx.state, event.targetInstanceId).damage;
  const overkill = event.fromAttack && (event.overkill === true || attackKeyword("overkill"));
  const excess = overkill && profile ? damage - profile.maxHp : 0;
  const recipient = excess > 0 ? overkillRecipient(ctx.state, event.targetInstanceId) : null;
  const villainBefore = villainOf(ctx.state, event.targetInstanceId);

  checkDefeats(ctx, {
    targetId: event.targetInstanceId,
    parentFrameId: event.parentFrameId ?? null,
    overkill: recipient ? { amount: excess, toInstanceId: recipient, sourceInstanceId: source } : undefined,
    defeatedByPlayerId: source !== null ? controllerOf(ctx.state, source) : null,
  });

  // Allies and minions report their defeat when the defeat event applies; a villain stage falls now.
  const villainAfter = villainOf(ctx.state, event.targetInstanceId);
  if (villainBefore && villainAfter && (villainAfter.stageIndex !== villainBefore.stageIndex || villainAfter.defeated)) {
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

/** Why threat cannot be removed from this scheme right now, or null. Shared by removal and `moveThreat`. */
export function threatRemovalBlocked(
  state: GameState,
  deps: EngineDeps,
  schemeId: InstanceId,
  sourceInstanceId: InstanceId | null,
  byThwart = false,
): "crisis" | "rule" | null {
  // RRG "Crisis Icon": while a crisis icon is in play, players cannot remove threat from the main scheme.
  const byPlayer = sourceInstanceId === null || controllerOf(state, sourceInstanceId) !== null;
  if (schemeId === state.mainScheme.instanceId && byPlayer && countSchemeIcons(state, "crisis") > 0) return "crisis";
  return threatCannotBeRemoved(state, deps, schemeId, byThwart) ? "rule" : null;
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
  // "Threat cannot be removed from attached scheme by thwarting" (Held Hostage) looks at the thwart this removal belongs to.
  const parent = event.parentFrameId ? findFrame(ctx.state, event.parentFrameId) : undefined;
  const byThwart = parent?.kind === "event" && parent.event.kind === "thwart";
  const blocked = threatRemovalBlocked(ctx.state, ctx.deps, event.schemeInstanceId, event.sourceInstanceId, byThwart);
  if (blocked) {
    emit(ctx, { type: "threatRemovalBlocked", schemeInstanceId: event.schemeInstanceId, reason: blocked });
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
  if (isSideScheme && after.threat === 0 && !notDefeatedWithoutThreat(ctx.state, ctx.deps, event.schemeInstanceId)) {
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
  // "That attack gains overkill" (Hulk Smash): an interrupt's `modifyAttack` records the grant on this attack's event
  // frame, the same var an enemy attack reads when it deals its damage (`enemy-activation.ts`).
  const attackFrame = findFrame(ctx.state, frameId);
  const granted = attackFrame?.kind === "event" && (attackFrame.vars.overkill ?? 0) > 0;
  pushEvents(ctx, [
    {
      kind: "dealDamage",
      targetInstanceId: event.targetInstanceId,
      amount,
      sourceInstanceId: event.attackerInstanceId,
      fromAttack: true,
      parentFrameId: frameId,
      overkill: event.overkill === true || granted,
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
