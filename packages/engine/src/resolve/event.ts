/** Event frames (interrupts → apply → responses) and the state change each event kind makes. */

import type { CardId } from "@mc/content";
import { type Ctx, emit, findFrame, popFrame, pushFrames, setFrame, updateFrame, updateInstance } from "../ctx.js";
import { overkillRecipient } from "../defend-preview.js";
import { expireEventLastingEffects, healDamage, pierceTough, readyCard, removeCounters } from "../effects.js";
import type { FrameId, InstanceId, PlayerId } from "../ids.js";
import { attackKeywordsOf, hasKeyword, isPermanent, keywordTotal } from "../keywords.js";
import {
  cardOf,
  characterProfile,
  titleShowing,
  getInstance,
  mustInstance,
  villainOf,
  areaOfCard,
  mainSchemeStateOf,
  turnInProgress,
} from "../query.js";
import type { EngineDeps } from "../abilities.js";
import {
  cannotBeDefeated,
  cannotTakeDamage,
  damageTakenAfterConstants,
  excessDamageBonus,
  defeatDestinationRule,
  excessDamageThreatSchemes,
  notDefeatedWithoutThreat,
  patrolledBy,
  cannotReady,
  damagePreventerOf,
  readyCostFor,
  threatCannotBeRemoved,
  iconsInPlay,
} from "../rules.js";
import { canAttack, cardsInPlay, characterIgnores, controllerOf } from "../select.js";
import { currentActivationFrameId, type StackFrame, type Vars } from "../stack.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import type { EffectSpec } from "../spec.js";
import {
  applyMainSchemeCompleting,
  checkDefeats,
  checkMainSchemeCompletion,
  defeatVillainStage,
  eliminatePlayer,
} from "./defeat.js";
import { dashedStatSkipsActivation, pushEnemyAttackFrame, pushEnemySchemeFrame } from "./enemy-activation.js";
import { applyEnterPlayKeywords } from "./enter-play.js";
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
import { finishTurn, pushPhaseEndDelayed } from "../flow.js";
import { resolveSurge } from "./reveal.js";
import { candidatesFor, eachTimeEffectsFor, hasCandidates, heard } from "./triggers.js";
import { pushWindow } from "./window.js";

export function executeEventFrame(ctx: Ctx, frame: Frame<"event">): void {
  switch (frame.stage) {
    case "interrupts": {
      emit(ctx, { type: "triggerEvent", event: frame.event, phase: "initiated" });
      setFrame(ctx, { ...frame, stage: "apply" });
      const interrupts = hasCandidates(ctx.state, ctx.deps, frame.event, "interrupt");
      // A tough status resolves first and prevents all the damage, so no "would take damage" interrupt gets a window
      // (docs/phase7-wave3.md §3.12).
      if (interrupts && frame.event.kind === "dealDamage" && toughResolvesFirst(ctx, frame.event)) {
        emit(ctx, { type: "interruptsPreempted", event: frame.event, reason: "tough" });
        return;
      }
      if (interrupts) pushWindow(ctx, frame.event, "interrupt", frame.frameId);
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
            ? {
                ...group,
                members: group.members.map((member, i) =>
                  i === index ? { ...member, event, cancelled: frame.cancelled } : member,
                ),
              }
            : group,
        );
        popFrame(ctx);
        return;
      }
      if (frame.cancelled) {
        // An attack that ends before fully resolving was still defended, and the abilities that trigger after that
        // defense still resolve (RRG 1.8 "Defend, Defense", p. 16, and "Attack (Enemy Activation)", p. 9: "If an
        // enemy attack ends before damage is dealt, abilities that trigger after an attack or after a character
        // defends an attack resolve as normal"). So these run even on the cancel path.
        if (stepDeferredResponses(ctx, frame)) return;
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
      // "After a character defends" waits for the attack to end (RRG 1.8 p. 16): hand the response window to the
      // activation frame, which opens it in its own `done` stage. With no activation on the stack (a defense-labeled
      // ability triggered outside an attack) there is nothing to wait for, so the window opens here as before.
      const activation = defersResponsesToActivation(event) ? currentActivationFrameId(ctx.state.stack) : null;
      if (activation !== null) {
        setFrame(ctx, { ...frame, event, stage: "done" });
        updateFrame(ctx, activation, (f) =>
          f.kind === "event" ? { ...f, deferredResponses: [...(f.deferredResponses ?? []), event] } : f,
        );
        return;
      }
      // How many forced responses this event triggers, reported to a `bind` ("If that scheme's 'Forced Response'
      // ability is not triggered this way"). Only recorded when there are some, so other results are unchanged.
      const forcedResponses = candidatesFor(ctx.state, ctx.deps, event, "response", true).length;
      setFrame(ctx, {
        ...frame,
        event,
        stage: "done",
        ...(forcedResponses > 0 ? { vars: { ...frame.vars, forcedResponses } } : {}),
      });
      if (hasCandidates(ctx.state, ctx.deps, event, "response")) {
        pushWindow(ctx, event, "response", frame.frameId);
      }
      // Lasting "each time …" effects resolve before the responses, so they are pushed on top (§3.17).
      for (const effect of [...eachTimeEffectsFor(ctx.state, ctx.deps, event)].reverse()) {
        pushEffects(ctx, { effects: effect.effects, ...effect.scope, event, eventFrameId: frame.frameId });
      }
      return;
    }
    case "done": {
      // Step 6 of the attack first: the abilities that trigger after the attack ends, which is where a deferred
      // "after a character defends" response belongs (RRG 1.8 p. 9 step 6, p. 16). This frame's own response window
      // has already run, so the order within the attack's end is: the attack's own "after" abilities, then the
      // defense's, then "at the end of this attack" delayed effects (RRG 1.8 "Delayed Effect", p. 16) below.
      //
      // Open question, flagged rather than hidden: p. 9 step 6 orders *all* of these by forced (6a) before non-forced
      // (6b), across every trigger it lists. The engine tiers forced-before-optional inside each window, but these are
      // separate windows per event, so a forced defend-response resolves after an optional "after [enemy] attacks you"
      // response. It only shows up when one attack triggers both, with opposite forcedness.
      if (stepDeferredResponses(ctx, frame)) return;
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

/**
 * The step after a defeated card's When Defeated abilities: it leaves play by `leave` (RRG 1.8 "When Defeated
 * Abilities", p. 48: "A defeated card leaves play after its 'When Defeated' ability is resolved, if any"). Only if it is
 * still in play showing the face that was defeated: a When Defeated that moved it ("shuffle this card into the encounter
 * deck") or flipped it into its other face (Secure the Landing Pad → Cosmo; docs/phase7-wave4.md §3.10) has already
 * placed it. Shared by allies, minions and side schemes.
 */
function leaveAfterWhenDefeated(
  ctx: Ctx,
  id: InstanceId,
  printedId: CardId,
  leave: EffectSpec,
  controllerId: PlayerId | null,
): StackFrame {
  return {
    ...base(ctx),
    kind: "effects",
    effects: [
      {
        kind: "if",
        condition: { kind: "refMatches", ref: { kind: "self" }, query: { printedId } },
        then: [leave],
      },
    ],
    cursor: 0,
    bindings: {},
    vars: {},
    scopedPlayerId: null,
    selfInstanceId: id,
    controllerId,
    event: null,
    eventFrameId: null,
    defeatedLeaving: id,
  };
}

/**
 * A defeated side scheme leaves play: to a constant `defeatDestination` (or `defeatedIntoEncounterDeck`) destination if
 * one matches, else its discard pile, marked defeated so Victory X can claim it (docs/phase7-wave3.md §3.4, §3.45).
 */
function schemeDefeatDestination(state: GameState, deps: EngineDeps, schemeId: InstanceId): EffectSpec {
  // Victory X is not a discard, so a destination that replaces the discard does not apply to it.
  const to = hasKeyword(state, schemeId, "victory", deps) ? null : defeatDestinationRule(state, deps, schemeId);
  return to === null
    ? { kind: "discardFromPlay", target: { kind: "self" }, defeated: true }
    : { kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to };
}

const withResults = (event: TriggerEvent, vars: Vars): TriggerEvent =>
  Object.keys(vars).length === 0 ? event : { ...event, results: vars };

/**
 * Whether this event's *response* window waits for the activation it belongs to to finish.
 *
 * RRG 1.8 "Defend, Defense" (p. 16): "Abilities that trigger after a character defends an attack resolve after that
 * attack ends." RRG 1.8 "Attack (Enemy Activation)" (p. 9) step 6 places "after [character] defends [and takes no
 * damage]…" in the step the attack triggers as it finishes resolving, alongside retaliate and the attack's own
 * "after [enemy] attacks you" abilities — so a defense declared in step 2 must not resolve its responses until then.
 * The interrupt side is unaffected: "when your hero defends" still fires as the defense initiates (p. 15).
 *
 * `defended` defers, and so does `basicPowerUsed` for the basic **defense** power: "After Groot uses a basic power"
 * (Lashing Vines, `gmw` 16009) and "After you use a basic power" (Super Speed) are, for a defense, abilities that
 * trigger after a character defends (docs/phase7-wave3.md §3.28). The other step 6 triggers the RRG lists
 * (`characterAttacked` for retaliate, `dealDamage`) are already pushed by the attack procedure after damage, so they
 * resolve inside step 6 where they belong.
 */
const defersResponsesToActivation = (event: TriggerEvent): boolean =>
  event.kind === "defended" || (event.kind === "basicPowerUsed" && event.power === "defense");

/**
 * Opens one deferred response window held on an activation frame. The finished activation's own results ride along
 * as the event's `results`, which is what makes "after you defend … and take no damage" expressible: the attack's
 * `damage`/`damaged` results count only damage dealt by the attack itself (FAQ "Unflappable (#20)", p. 60: the
 * defending identity must "take no damage during step 4 of the enemy attack", so damage from a "Boost" ability
 * during the same attack does not count).
 */
function openDeferredResponse(ctx: Ctx, frame: Frame<"event">, deferred: TriggerEvent): void {
  const event = withResults(deferred, frame.vars);
  // Triggering conditions are checked when the window opens, not when the defense happened.
  if (!hasCandidates(ctx.state, ctx.deps, event, "response")) return;
  pushWindow(ctx, event, "response", frame.frameId);
}

/** Takes the next deferred response window off `frame` and opens it; false when none is left. */
function stepDeferredResponses(ctx: Ctx, frame: Frame<"event">): boolean {
  const [deferred, ...rest] = frame.deferredResponses ?? [];
  if (!deferred) return false;
  setFrame(ctx, { ...frame, deferredResponses: rest });
  openDeferredResponse(ctx, frame, deferred);
  return true;
}

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
    case "enemyAttacksEnemy":
      return applyEnemyAttacksEnemy(ctx, event, frame.frameId);
    case "thwart":
      return applyPlayerThwart(ctx, event, frame.frameId);
    case "turnEnding":
      finishTurn(ctx, event.playerId);
      return;
    case "phaseEnding":
      // The phase's (and at the villain phase's end, the round's) delayed effects, between the interrupts and the
      // responses (RRG 1.8 "Delayed Effect", p. 15; docs/phase7-wave3.md §3.2).
      pushPhaseEndDelayed(ctx, event.phase);
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
        emit(ctx, {
          type: "activationSkipped",
          enemyInstanceId: event.enemyInstanceId,
          activation,
          reason: leftPlay ? "leftPlay" : "dashedStat",
        });
        // The activation does not happen: no boost card, no responses, and a `bind` reports `made` 0.
        setFrame(ctx, { ...frame, stage: "apply", cancelled: true });
        return;
      }
      return event.kind === "enemyAttack"
        ? pushEnemyAttackFrame(ctx, event, frame.frameId)
        : pushEnemySchemeFrame(ctx, event, frame.frameId);
    }
    case "characterAttacked":
      recordAttackThisTurn(ctx, event.attackerInstanceId, event.targetInstanceId);
      return applyRetaliate(ctx, event);
    case "characterDefeated":
      return applyDefeat(ctx, event);
    case "schemeDefeated":
      return applySchemeDefeated(ctx, event);
    case "mainSchemeCompleting":
      return applyMainSchemeCompleting(ctx, event);
    case "countersRemoved": {
      const removed = removeCounters(ctx, event.instanceId, event.counterType, event.amount);
      addFrameVars(ctx, frame.frameId, { amount: removed });
      return removed > 0;
    }
    case "cardReadying":
      readyAndAnnounce(ctx, event.instanceId, event.sourceInstanceId ?? null);
      return;
    case "cardEntersPlay":
      // The keywords that resolve as a card enters play are this event's change, so an "Interrupt: when X enters
      // play" ability runs before them and a Response after (docs/phase7-wave2.md §3.13.10).
      applyEnterPlayKeywords(ctx, event.instanceId);
      return;
    default:
      return;
  }
}

/**
 * RRG "Defeat": an ally or minion with damage equal to its hit points is
 * defeated and discarded (attachments with it). Runs after the defeat's
 * interrupt window, so a "would be defeated … instead" effect that healed it
 * means nothing happens. Overkill excess is dealt only if the defeat happens.
 *
 * RRG 1.8 "When Defeated Abilities" (p. 48): "A defeated card leaves play after its 'When Defeated' ability is resolved,
 * if any." So the defeat happens here (logged, reported to the attack) but the card stays in play while its own When
 * Defeated abilities resolve, then leaves (`leaveAfterWhenDefeated`), then any overkill spill is dealt. The spill's
 * amount was fixed by the damage that caused the defeat (`applyDamage`), so it does not depend on where the card is.
 * A side scheme already worked this way (ruling, Jan 11, 2026 (1); `applySchemeDefeated`). Before 2026-09-25 an ally
 * or minion was discarded before its When Defeated resolved (docs/phase7-wave3.md §4 Q4).
 */
function applyDefeat(ctx: Ctx, event: Extract<TriggerEvent, { kind: "characterDefeated" }>): boolean {
  const id = event.instanceId;
  const instance = getInstance(ctx.state, id);
  if (!instance || !cardsInPlay(ctx.state).includes(id)) return false;
  const profile = characterProfile(ctx.state, id, ctx.deps);
  // A defeat by effect ("defeat a minion", docs/phase7-wave3.md §3.9) does not depend on the dial.
  if (!profile || (instance.damage < profile.maxHp && event.byEffect !== true)) return false;
  // RRG 1.8 "'Cannot'" (p. 11): absolute, including a defeat already on the stack (docs/phase7-wave3.md §3.1).
  // `protectionChecked`: villains that fell together in one sweep had their "cannot be defeated while …" read then, before
  // either applied (docs/phase7-wave4.md §3.3).
  if (event.protectionChecked !== true && cannotBeDefeated(ctx.state, ctx.deps, id)) return false;
  // A villain stage (docs/phase7-wave3.md §3.1). Reaching here means no interrupt replaced the defeat: "flip this card
  // instead" turns the villain to an ∞ face and "reset his hit points instead" clears the damage, and either fails the
  // dial check above. Otherwise it falls exactly as the sweep's inline path does (RRG 1.8 "Villain Defeat", p. 47).
  const villain = villainOf(ctx.state, id);
  if (villain) {
    if (villain.defeated) return false;
    const choice = defeatVillainStage(ctx, id);
    if (choice && !ctx.state.outcome) pushFrames(ctx, [choice]);
    return true;
  }
  // An identity at zero remaining hit points is eliminated, not discarded (RRG 1.8 "Hit Points", p. 22). Reaching
  // here means no interrupt replaced the defeat ("set his hit point dial to 1 instead", Captain America's Helmet).
  const player = ctx.state.players.find((seat) => seat.identity.instanceId === id);
  if (player) {
    emit(ctx, { type: "characterDefeated", instanceId: id, cardId: instance.cardId });
    eliminatePlayer(ctx, player.playerId);
    return true;
  }
  if (isPermanent(ctx.state, id, ctx.deps)) return false;
  emit(ctx, { type: "characterDefeated", instanceId: id, cardId: instance.cardId });
  const whenDefeated = gameAbilityFrames(
    ctx,
    id,
    ["whenDefeated"],
    event,
    undefined,
    instance.engagedWith ?? ctx.state.firstPlayerId,
  );
  // Victory X sends a defeated character to the victory display instead (docs/phase7-wave3.md §3.4). Otherwise an
  // interrupt's `setDefeatDestination` ("return it to its owner's hand instead of discarding it", Regroup), else a
  // constant `defeatDestination` rule, replaces the discard (docs/phase7-wave3.md §3.45). Read now, at the defeat.
  const destination = event.destination ?? defeatDestinationRule(ctx.state, ctx.deps, id);
  const leave: EffectSpec = {
    kind: "discardFromPlay",
    target: { kind: "self" },
    defeated: true,
    ...(destination === null ? {} : { insteadTo: destination }),
  };
  addFrameVars(ctx, event.parentFrameId, { defeated: 1 });
  if (event.reportFrameId && event.reportFrameId !== event.parentFrameId) {
    addFrameVars(ctx, event.reportFrameId, { defeated: 1 });
  }
  const frames: StackFrame[] = [
    ...whenDefeated,
    leaveAfterWhenDefeated(ctx, id, instance.cardId, leave, controllerOf(ctx.state, id)),
  ];
  if (event.overkill && !ctx.state.outcome && getInstance(ctx.state, event.overkill.toInstanceId)) {
    emit(ctx, {
      type: "overkillSpilled",
      fromInstanceId: id,
      toInstanceId: event.overkill.toInstanceId,
      amount: event.overkill.amount,
    });
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
 * Whether a tough status card will prevent this damage, so it resolves ahead of every other interrupt (docs/phase7-wave3.md
 * §3.12). RRG 1.8 Appendix III "Simultaneous Timing Priority": "2. Interrupts: a. Status card 'Forced Interrupt'
 * abilities. b. 'Forced Interrupt' abilities. c. 'Interrupt' abilities"; RRG 1.8 "Status Cards" (p. 42): "Status card
 * abilities have timing priority over all conflicting triggered abilities"; General FAQ (RRG 1.8 p. 58): "the tough status
 * card must be discarded to prevent all of the damage before any other abilities could trigger". Tough is a replacement
 * ("remove a tough status card from it instead"), and RRG 1.8 "Would" (p. 48) closes further interrupts to a trigger a
 * replacement changed. The Galaxy's Most Wanted FAQ (MC16 p. 21) applies it to Groot's Flora Colossus.
 *
 * The same order `applyDamage` uses: "cannot take damage", a prevented attack, piercing and constant reductions all come
 * first, and each of them means the tough card is not what stops the damage (FAQ p. 58's two exceptions: a constant that
 * reduces the damage to zero, and a basic defense's DEF, which reduced the amount before this event).
 */
function toughResolvesFirst(ctx: Ctx, event: Extract<TriggerEvent, { kind: "dealDamage" }>): boolean {
  if (event.amount <= 0 || event.ignoreTough === true) return false;
  const target = getInstance(ctx.state, event.targetInstanceId);
  if (!target || target.statuses.tough <= 0) return false;
  const source = event.sourceInstanceId;
  if (cannotTakeDamage(ctx.state, ctx.deps, event.targetInstanceId, [source, event.viaInstanceId])) return false;
  if (event.fromAttack && preventedByAttackFlag(ctx, event)) return false;
  const piercing =
    event.fromAttack &&
    (event.piercing === true || (source !== null && hasKeyword(ctx.state, source, "piercing", ctx.deps)));
  if (piercing) return false;
  return damageTakenAfterConstants(ctx.state, ctx.deps, event.targetInstanceId, event.amount, event.fromAttack) > 0;
}

/** Whether the attack this damage belongs to is carrying a "prevent all damage from that attack" flag. */
function preventedByAttackFlag(ctx: Ctx, event: Extract<TriggerEvent, { kind: "dealDamage" }>): boolean {
  const parent = event.parentFrameId ? findFrame(ctx.state, event.parentFrameId) : undefined;
  return parent?.kind === "event" && (parent.vars.preventAllDamage ?? 0) > 0;
}

/** `TriggerEvent damagePrevented`, pushed only when an ability listens (docs/phase7-wave4.md §3.20). */
export function announceDamagePrevented(ctx: Ctx, event: Extract<TriggerEvent, { kind: "damagePrevented" }>): void {
  if (event.amount > 0 && heard(ctx.state, ctx.deps, event)) pushEvent(ctx, event);
}

/**
 * The excess damage one `dealDamage` event deals: the damage the target takes beyond its remaining hit points, plus any
 * `excessDamageBonus` ("When your hero's attack deals any amount of excess damage, increase that amount by 1", Follow
 * Through; docs/phase7-wave3.md §3.18), added only when there is some.
 *
 * RRG 1.8 "Overkill" (p. 31, revised in 1.8): "If a card ability counts excess damage dealt, that ability counts the
 * same value of excess damage that is calculated when resolving the overkill keyword", and overkill deals "any damage
 * on that [character] beyond its hit points". So excess is measured on the damage *taken*, after constant reductions,
 * and a tough status, "cannot take damage" or a prevention leaves none. This supersedes rulings Jan 26, 2026 (3) and
 * Feb 8, 2026 (2), which measured it on the damage dealt (user decision 2026-09-25; PLAN.md's Overkill note): Hercules's
 * 6 against Thumbelina (3 HP, takes 1 less) spills 2 and Prince of Power heals 2, not 3.
 *
 * The same number with or without overkill: an attack without it (Into the Fray, "Murdered You!", Radioactive Buildup's
 * "excess damage dealt by Thunderball") counts what overkill would have spilled. It is measured when the damage lands,
 * whether or not the defeat that follows happens, since the counting abilities read the damage, not the defeat.
 */
export function excessDamageOf(
  ctx: Ctx,
  event: Extract<TriggerEvent, { kind: "dealDamage" }>,
  damageBefore: number,
  taken: number,
  maxHp: number | undefined,
): number {
  if (maxHp === undefined || taken <= 0) return 0;
  const measured = taken - Math.max(0, maxHp - damageBefore);
  if (measured <= 0) return 0;
  const source = event.sourceInstanceId;
  return measured + (event.fromAttack && source !== null ? excessDamageBonus(ctx.state, ctx.deps, source) : 0);
}

/** RRG "Tough": a tough status prevents all damage and is discarded instead. */
/** `sweep` false: a `damageGroup` applies several at once and sweeps for defeats itself afterwards. */
export function applyDamage(
  ctx: Ctx,
  event: Extract<TriggerEvent, { kind: "dealDamage" }>,
  frameId: FrameId,
  sweep = true,
): void {
  if (event.amount <= 0) return;
  // RRG 1.8 "In Play and Out of Play" (p. 23): abilities "only interact with … cards that are in play". Damage waiting
  // on the stack for a card that has since left play (an ally's consequential damage after Speed Demon's attack
  // defeated it, docs/phase7-wave4.md §4 Q20) is not dealt, rather than left on the discarded card.
  if (!cardsInPlay(ctx.state).includes(event.targetInstanceId)) return;
  const source = event.sourceInstanceId;
  // The attacker's own keyword, or one granted to this attack alone and stamped on the event (`attackKeywordsOf`).
  const attackKeyword = (name: "piercing" | "overkill"): boolean =>
    event.fromAttack && (event[name] === true || (source !== null && hasKeyword(ctx.state, source, name, ctx.deps)));

  // RRG "Cannot": "cannot take damage" beats everything, including tough (which then isn't used).
  if (cannotTakeDamage(ctx.state, ctx.deps, event.targetInstanceId, [source, event.viaInstanceId])) {
    emit(ctx, {
      type: "damagePrevented",
      targetInstanceId: event.targetInstanceId,
      amount: event.amount,
      reason: "cannotTakeDamage",
    });
    return;
  }
  // "Prevent all damage from that attack" (`modifyAttack.preventAllDamage`, set at attack initiation): the flag lives
  // on the attack's own event frame, so it reaches whatever damage that attack eventually deals, whoever defends.
  // RRG 1.8 "Prevent" (p. 34): the damage is dealt but not taken, so nothing below runs: no tough card is used, the
  // attack records no `damage`/`damaged` result, and there is no excess damage (`excessDamageOf`, RRG 1.8 p. 31).
  //
  // UNCONFIRMED READING, flagged rather than hidden: this returns before piercing, so a fully prevented piercing
  // attack discards no tough status cards. RRG 1.8 "Piercing" (p. 32) exempts an attack that "would deal no damage",
  // and prevented damage is still *dealt* (p. 34), which argues the other way. No cycle 1 card reaches the case
  // (the one prevention effect answers a villain attack; the one piercing grant belongs to a minion's boost).
  // "Prevent all damage to Ebony Maw" (`RuleSpec preventAllDamage`, docs/phase7-wave4.md §3.20): dealt and prevented,
  // by that card, which "After Abjuration prevents …" hears.
  const preventer = damagePreventerOf(ctx.state, ctx.deps, event.targetInstanceId);
  if (preventer !== null) {
    emit(ctx, {
      type: "damagePrevented",
      targetInstanceId: event.targetInstanceId,
      amount: event.amount,
      reason: "effect",
    });
    announceDamagePrevented(ctx, {
      kind: "damagePrevented",
      targetInstanceId: event.targetInstanceId,
      amount: event.amount,
      preventerInstanceId: preventer,
      fromAttack: event.fromAttack,
      sourceInstanceId: source,
    });
    return;
  }
  if (event.fromAttack && preventedByAttackFlag(ctx, event)) {
    emit(ctx, {
      type: "damagePrevented",
      targetInstanceId: event.targetInstanceId,
      amount: event.amount,
      reason: "effect",
    });
    return;
  }
  if (attackKeyword("piercing")) pierceTough(ctx, event.targetInstanceId);

  const target = getInstance(ctx.state, event.targetInstanceId);
  if (!target) return;
  // Constant reductions and caps on the damage taken ("Reduce the amount of damage Nebula takes from each attack by 1",
  // "cannot take more than 5 damage from a single attack"): constants come before a tough status, so one that brings it
  // to 0 keeps the tough card (RRG 1.8 FAQ p. 58; docs/phase7-wave3.md §3.15).
  const taken = damageTakenAfterConstants(ctx.state, ctx.deps, event.targetInstanceId, event.amount, event.fromAttack);
  if (taken <= 0) {
    emit(ctx, {
      type: "damagePrevented",
      targetInstanceId: event.targetInstanceId,
      amount: event.amount,
      reason: "reduced",
    });
    return;
  }
  // "This damage ignores tough status cards" (Lightning Strike, errata RRG 1.8 p. 65): the damage is taken and the
  // status card stays. Piercing is the keyword the RRG defines as discarding it, so "ignores" does not (§3.13).
  if (target.statuses.tough > 0 && event.ignoreTough !== true) {
    updateInstance(ctx, event.targetInstanceId, (i) => ({
      ...i,
      statuses: { ...i.statuses, tough: i.statuses.tough - 1 },
    }));
    emit(ctx, {
      type: "damagePrevented",
      targetInstanceId: event.targetInstanceId,
      amount: taken,
      reason: "tough",
    });
    emit(ctx, {
      type: "statusRemoved",
      instanceId: event.targetInstanceId,
      status: "tough",
      reason: "preventedDamage",
    });
    return;
  }
  if (taken < event.amount) {
    emit(ctx, {
      type: "damagePrevented",
      targetInstanceId: event.targetInstanceId,
      amount: event.amount - taken,
      reason: "reduced",
    });
  }
  const maxHp = characterProfile(ctx.state, event.targetInstanceId, ctx.deps)?.maxHp;
  const excessDealt = excessDamageOf(ctx, event, target.damage, taken, maxHp);
  updateInstance(ctx, event.targetInstanceId, (i) => ({ ...i, damage: i.damage + taken }));
  emit(ctx, {
    type: "damageDealt",
    targetInstanceId: event.targetInstanceId,
    amount: taken,
    sourceInstanceId: event.sourceInstanceId,
  });
  addFrameVars(ctx, frameId, { amount: taken });
  addFrameVars(ctx, event.parentFrameId, { damage: taken, damaged: 1 });
  addFrameSlots(ctx, event.parentFrameId, { damaged: [event.targetInstanceId] });
  if (excessDealt > 0) {
    addFrameVars(ctx, frameId, { excessDealt });
    addFrameVars(ctx, event.parentFrameId, { excessDealt });
    placeExcessDamageAsThreat(ctx, event, excessDealt);
  }
  if (!sweep) return;

  // Overkill spills the same excess every "excess damage dealt" ability counts (RRG 1.8 "Overkill", p. 31).
  const overkill = event.fromAttack && (event.overkill === true || attackKeyword("overkill"));
  const excess = overkill ? excessDealt : 0;
  const recipient = excess > 0 ? overkillRecipient(ctx.state, event.targetInstanceId) : null;
  const villainBefore = villainOf(ctx.state, event.targetInstanceId);

  checkDefeats(ctx, {
    targetId: event.targetInstanceId,
    parentFrameId: event.parentFrameId ?? null,
    fromAttack: event.fromAttack,
    overkill: recipient ? { amount: excess, toInstanceId: recipient, sourceInstanceId: source } : undefined,
    defeatedByPlayerId: source !== null ? controllerOf(ctx.state, source) : null,
    sourceInstanceId: source,
    reportFrameId: frameId,
  });

  // Allies and minions report their defeat when the defeat event applies; a villain stage falls now.
  const villainAfter = villainOf(ctx.state, event.targetInstanceId);
  if (
    villainBefore &&
    villainAfter &&
    (villainAfter.stageIndex !== villainBefore.stageIndex || villainAfter.defeated)
  ) {
    addFrameVars(ctx, event.parentFrameId, { defeated: 1 });
    addFrameVars(ctx, frameId, { defeated: 1 });
  }
}

/**
 * A constant "Excess damage dealt by [source] is placed as threat on [scheme]" (`RuleSpec excessDamageAsThreat`,
 * Radioactive Buildup 07022): one `placeThreat` event per scheme, sourced by the dealing card and reported to the
 * damage's parent (an attack's `threatPlaced` result), announced by an `excessDamageAsThreat` log entry.
 *
 * - **Measured as overkill measures it** (RRG 1.8 "Overkill", p. 31; `excessDamageOf`): damage taken beyond remaining
 *   hit points, so a tough, "cannot take damage" or prevented hit places no threat. This supersedes the reading of
 *   ruling Jan 26, 2026 (3) the engine followed before 2026-09-25 (excess measured as dealt, before tough).
 * - **Order:** it is pushed as the damage lands and before the defeat sweep, so it resolves after this damage's
 *   defeats (pushed later, on top) and before the damage event's own response window. The RRG gives a constant
 *   conversion no step of its own; the observable difference is only "when defeated" vs. "after threat is placed"
 *   ordering.
 * - **Open, flagged for the user:** whether the excess still spills with overkill. The engine applies both
 *   independently (they now count the same number); "placed as threat" could instead be read as the damage no longer
 *   existing to spill. No card in the pool gives Thunderball overkill.
 */
function placeExcessDamageAsThreat(
  ctx: Ctx,
  event: Extract<TriggerEvent, { kind: "dealDamage" }>,
  excessDealt: number,
): void {
  const source = event.sourceInstanceId;
  if (source === null) return;
  const frames: StackFrame[] = [];
  for (const schemeId of excessDamageThreatSchemes(ctx.state, ctx.deps, source)) {
    emit(ctx, {
      type: "excessDamageAsThreat",
      sourceInstanceId: source,
      targetInstanceId: event.targetInstanceId,
      schemeInstanceId: schemeId,
      amount: excessDealt,
    });
    frames.push(
      eventFrame(ctx, {
        kind: "placeThreat",
        schemeInstanceId: schemeId,
        amount: excessDealt,
        sourceInstanceId: source,
        parentFrameId: event.parentFrameId ?? null,
      }),
    );
  }
  pushFrames(ctx, frames);
}

/**
 * RRG "Retaliate X": a forced response after the character is attacked; it must
 * still be in play once the attack resolves. RRG "Ranged": an attack with ranged
 * ignores retaliate entirely.
 */
function applyRetaliate(ctx: Ctx, event: Extract<TriggerEvent, { kind: "characterAttacked" }>): void {
  // Ranged printed on the attacker, or granted to this attack alone ("each of your [Arrow] attacks gain ranged").
  if (event.ranged === true || hasKeyword(ctx.state, event.attackerInstanceId, "ranged", ctx.deps)) return;
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

/**
 * Remembers that `attackerId` attacked `targetId` this turn, under the title it is showing now (`GameState.
 * attackedThisTurn`; docs/phase7-wave2.md §11.3, §14). Every attack passes through the `characterAttacked` event,
 * player-made and enemy-made alike, so this is the one place it has to be written. Outside a player's turn there is
 * no "this turn" to record into. The list is a set in attack order, so the same attacker attacking twice under one
 * title is recorded once and a replay produces the same array.
 */
function recordAttackThisTurn(ctx: Ctx, attackerId: InstanceId, targetId: InstanceId): void {
  if (!turnInProgress(ctx.state)) return;
  const attackerTitle = titleShowing(ctx.state, attackerId) ?? "";
  const already = ctx.state.attackedThisTurn[targetId] ?? [];
  if (already.some((r) => r.attackerInstanceId === attackerId && r.attackerTitle === attackerTitle)) return;
  const record = { attackerInstanceId: attackerId, attackerTitle };
  ctx.state = { ...ctx.state, attackedThisTurn: { ...ctx.state.attackedThisTurn, [targetId]: [...already, record] } };
}

/** Why threat cannot be removed from this scheme right now, or null. Shared by removal and `moveThreat`. */
export function threatRemovalBlocked(
  state: GameState,
  deps: EngineDeps,
  schemeId: InstanceId,
  sourceInstanceId: InstanceId | null,
  byThwart = false,
  ignoreCrisis = false,
  thwartingPlayerId: PlayerId | null = null,
  /** The thwart's own character, for a removal made by a thwart (`characterIgnores`, docs/phase7-wave4.md §3.24). */
  thwarterInstanceId: InstanceId | null = null,
  /** "…, ignoring the patrol keyword" on the thwart itself (docs/phase7-wave4.md §3.32). */
  ignorePatrol = false,
): "crisis" | "patrol" | "rule" | null {
  const acting = thwarterInstanceId ?? sourceInstanceId;
  // RRG "Crisis Icon": while a crisis icon is in play, players cannot remove threat from the main scheme. One effect
  // may step over that check ("ignoring any crisis icons in play"), but never over a `threatCannotBeRemoved` rule.
  const byPlayer = sourceInstanceId === null || controllerOf(state, sourceInstanceId) !== null;
  // With separate game areas, only the icons in the scheme's own area count (docs/phase7-wave2.md §3.1).
  if (
    !ignoreCrisis &&
    mainSchemeStateOf(state, schemeId) &&
    byPlayer &&
    iconsInPlay(state, deps, "crisis", areaOfCard(state, schemeId)) > 0 &&
    !characterIgnores(state, deps, acting, "crisis")
  )
    return "crisis";
  // RRG 1.8 "Patrol" (p. 32): a thwart — basic or a "(thwart)" ability — by a player a patrol minion is engaged with
  // cannot remove threat from the main scheme; other removal ("remove 2 threat from the main scheme") still can
  // (docs/phase7-wave3.md §3.5).
  if (
    byThwart &&
    !ignorePatrol &&
    thwartingPlayerId &&
    mainSchemeStateOf(state, schemeId) &&
    patrolledBy(state, deps, thwartingPlayerId) &&
    !characterIgnores(state, deps, thwarterInstanceId, "patrol")
  )
    return "patrol";
  // The removing player, for a `threatCannotBeRemoved` rule scoped with `player` (docs/phase7-wave3.md §3.26): the
  // thwart's player when this is a thwart, else the removing card's controller — the same reading `defeatingPlayerOf`
  // (below) uses for "the player who defeated this scheme".
  const removerId = thwartingPlayerId ?? (sourceInstanceId === null ? null : controllerOf(state, sourceInstanceId));
  return threatCannotBeRemoved(state, deps, schemeId, byThwart, removerId) ? "rule" : null;
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
  if (mainSchemeStateOf(ctx.state, event.schemeInstanceId)) checkMainSchemeCompletion(ctx);
}

/**
 * Who "the player who defeated this scheme" is: the player whose thwart this removal belongs to, else the controller
 * of whatever removed the threat (an ally's or an event's own effect). Null for a removal no player made.
 */
function defeatingPlayerOf(state: GameState, event: Extract<TriggerEvent, { kind: "removeThreat" }>): PlayerId | null {
  const parent = event.parentFrameId ? findFrame(state, event.parentFrameId) : undefined;
  if (parent?.kind === "event" && parent.event.kind === "thwart") return parent.event.playerId;
  return event.sourceInstanceId === null ? null : controllerOf(state, event.sourceInstanceId);
}

function applyRemoveThreat(ctx: Ctx, event: Extract<TriggerEvent, { kind: "removeThreat" }>, frameId: FrameId): void {
  const scheme = getInstance(ctx.state, event.schemeInstanceId);
  if (!scheme) return;
  // "Threat cannot be removed from attached scheme by thwarting" (Held Hostage) looks at the thwart this removal belongs to.
  const parent = event.parentFrameId ? findFrame(ctx.state, event.parentFrameId) : undefined;
  const thwart = parent?.kind === "event" && parent.event.kind === "thwart" ? parent.event : null;
  const byThwart = thwart !== null;
  const blocked = threatRemovalBlocked(
    ctx.state,
    ctx.deps,
    event.schemeInstanceId,
    event.sourceInstanceId,
    byThwart,
    event.ignoreCrisis === true,
    thwart?.playerId ?? null,
    thwart?.thwarterInstanceId ?? null,
    thwart?.ignorePatrol === true,
  );
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
    // "When the defeat is initiated" interrupts (Chance Encounter, "When attached side scheme is defeated") answer
    // while the scheme and its attachments are still in play; the scheme's When Defeated and its leaving play are the
    // event's apply step (`applySchemeDefeated`), and "after … is defeated" responds after both (docs/phase7-wave4.md
    // §3.37).
    // "When Defeated: … the player who defeated this scheme" (Crossbones' Assault): the defeat event is handed to the
    // When Defeated abilities too — a minion's already got its `characterDefeated` event — so `defeatingPlayer`
    // resolves inside them. No Core or wave 1 When Defeated script reads an event-scoped ref, so nothing changes.
    const defeated: TriggerEvent = {
      kind: "schemeDefeated",
      instanceId: event.schemeInstanceId,
      defeatedByPlayerId: defeatingPlayerOf(ctx.state, event),
      // What removed the last threat. A thwart's own removal is already sourced to the thwarting character
      // (`applyPlayerThwart`), so this needs no thwart special case of its own, unlike the defeating *player* above.
      sourceInstanceId: event.sourceInstanceId,
    };
    pushFrames(ctx, [eventFrame(ctx, defeated)]);
  }
}

/**
 * A side scheme's defeat, after its interrupt window (docs/phase7-wave4.md §3.37): its "When Defeated" resolves first,
 * then it leaves play (so tucked cards it returns aren't discarded first). A scheme an interrupt already removed from
 * play has nothing left to do.
 */
function applySchemeDefeated(ctx: Ctx, event: Extract<TriggerEvent, { kind: "schemeDefeated" }>): void {
  const schemeId = event.instanceId;
  const scheme = getInstance(ctx.state, schemeId);
  if (!scheme || !cardsInPlay(ctx.state).includes(schemeId)) return;
  // "Shuffle it into the encounter deck instead of discarding it." (Time Portal; `defeatedIntoEncounterDeck`, §3.11;
  // the general `defeatDestination`, docs/phase7-wave3.md §3.45).
  const effectsFrame = leaveAfterWhenDefeated(
    ctx,
    schemeId,
    scheme.cardId,
    schemeDefeatDestination(ctx.state, ctx.deps, schemeId),
    null,
  );
  pushFrames(ctx, [
    ...gameAbilityFrames(ctx, schemeId, ["whenDefeated"], event, undefined, ctx.state.firstPlayerId),
    effectsFrame,
  ]);
}

/**
 * A player's attack, after its interrupt window. An attack whose attacker has left play by now ends: no damage, and none
 * of its other results (`characterAttacked`, which retaliate and "after … attacks" hang off). This mirrors RRG 1.8
 * "Activation" (p. 6), which ends an enemy's attack when the enemy leaves play; RRG 1.8 "Attack (Player Ability Type)"
 * (p. 10) is silent, and the reading is the user's decision (docs/phase7-wave4.md §4 Q20, 2026-09-25; community
 * pointer: BoardGameGeek ruling thread, Mar 23 2023 — not an FFG ruling). A villain whose stage is defeated and
 * advances mid-attack is the same character still in play, so its attack is unaffected (`enemy-activation.ts`).
 */
function applyPlayerAttack(ctx: Ctx, event: Extract<TriggerEvent, { kind: "attack" }>, frameId: FrameId): void {
  if (!cardsInPlay(ctx.state).includes(event.attackerInstanceId)) {
    emit(ctx, {
      type: "playerAttackEnded",
      attackerInstanceId: event.attackerInstanceId,
      targetInstanceId: event.targetInstanceId,
      reason: "attackerLeftPlay",
    });
    return;
  }
  const profile = characterProfile(ctx.state, event.attackerInstanceId, ctx.deps);
  if (!getInstance(ctx.state, event.targetInstanceId)) return;
  if (profile?.missing.includes("atk")) return;
  const amount = event.amount ?? profile?.atk;
  if (amount === undefined) return;
  // "That attack gains overkill" (Hulk Smash) / "this attack gains piercing" (Piercing Strike): every way of granting
  // an attack keyword is folded in here, once, and stamped on the events the attack pushes. An interrupt's
  // `modifyAttack` records its grant as a var on this attack's own event frame, the same var an enemy attack reads
  // when it deals its damage (`enemy-activation.ts`).
  const attackFrame = findFrame(ctx.state, frameId);
  const keywords = attackKeywordsOf(ctx.state, ctx.deps, {
    attackerInstanceId: event.attackerInstanceId,
    viaInstanceId: event.sourceInstanceId ?? null,
    basic: event.basic === true,
    ...(event.keywords ? { keywords: event.keywords } : {}),
    ...(attackFrame?.kind === "event" ? { vars: attackFrame.vars } : {}),
  });
  pushEvents(ctx, [
    {
      kind: "dealDamage",
      targetInstanceId: event.targetInstanceId,
      amount,
      sourceInstanceId: event.attackerInstanceId,
      fromAttack: true,
      parentFrameId: frameId,
      overkill: event.overkill === true || keywords.includes("overkill"),
      viaInstanceId: event.sourceInstanceId ?? null,
      // Only set when true, so an attack with no granted keyword logs exactly as it always has.
      ...(keywords.includes("piercing") ? { piercing: true } : {}),
    },
    {
      kind: "characterAttacked",
      attackerInstanceId: event.attackerInstanceId,
      targetInstanceId: event.targetInstanceId,
      playerId: event.playerId,
      ...(keywords.includes("ranged") ? { ranged: true } : {}),
    },
  ]);
}

/**
 * One enemy attacks another (`EffectSpec enemyAttacksEnemy`; docs/phase7-wave3.md §3.23, §4 Q12 as the user decided it
 * on 2026-09-23): an attack, not an activation, so there is no boost step and no defense step — the target is an enemy,
 * with no controller to defend it. What is left of RRG 1.8 "Attack (Enemy Activation)" (p. 9) is steps 4–6: the
 * attacker's ATK (modifiers included) is dealt to the target as attack damage, and the attack finishes with the
 * `characterAttacked` event that retaliate hangs off. The damage is the same `dealDamage` a player's attack pushes, so
 * the target's tough status, its damage reductions, piercing, and overkill (RRG 1.8 "Overkill", p. 31: a defeated
 * minion's excess goes to the villain, whoever attacked it) all apply exactly as they do anywhere else.
 *
 * Re-checked here because the interrupt window may have changed things: an attacker or target that left play ends the
 * attack (RRG 1.8 "Activation", p. 6's rule for a minion leaving mid-activation, applied to this attack), and so does a
 * `cannotAttack` rule now in force. Guard never does (`canAttack`: an enemy's attack is nobody's; RRG 1.8 "Guard", p. 21).
 */
function applyEnemyAttacksEnemy(
  ctx: Ctx,
  event: Extract<TriggerEvent, { kind: "enemyAttacksEnemy" }>,
  frameId: FrameId,
): boolean | void {
  const { attackerInstanceId: attacker, targetInstanceId: target } = event;
  const skip = (reason: "leftPlay" | "cannotAttack" | "dashedStat"): false => {
    emit(ctx, {
      type: "enemyAttackedEnemy",
      attackerInstanceId: attacker,
      targetInstanceId: target,
      damageDealt: 0,
      skipped: reason,
    });
    return false;
  };
  const inPlay = cardsInPlay(ctx.state);
  if (!inPlay.includes(attacker) || !inPlay.includes(target)) return skip("leftPlay");
  if (!canAttack(ctx.state, attacker, target, ctx.deps)) return skip("cannotAttack");
  const profile = characterProfile(ctx.state, attacker, ctx.deps);
  if (!profile || profile.missing.includes("atk")) return skip("dashedStat");
  const attackFrame = findFrame(ctx.state, frameId);
  const keywords = attackKeywordsOf(ctx.state, ctx.deps, {
    attackerInstanceId: attacker,
    ...(attackFrame?.kind === "event" ? { vars: attackFrame.vars } : {}),
  });
  const amount = Math.max(0, profile.atk + (attackFrame?.kind === "event" ? (attackFrame.vars.atkBonus ?? 0) : 0));
  emit(ctx, {
    type: "enemyAttackedEnemy",
    attackerInstanceId: attacker,
    targetInstanceId: target,
    damageDealt: amount,
  });
  pushEvents(ctx, [
    {
      kind: "dealDamage",
      targetInstanceId: target,
      amount,
      sourceInstanceId: attacker,
      fromAttack: true,
      parentFrameId: frameId,
      overkill: keywords.includes("overkill"),
      ...(keywords.includes("piercing") ? { piercing: true } : {}),
    },
    {
      kind: "characterAttacked",
      attackerInstanceId: attacker,
      targetInstanceId: target,
      playerId: null,
      ...(keywords.includes("ranged") ? { ranged: true } : {}),
    },
  ]);
}

/**
 * Readies a card, through a `cardReadying` event when an ability could replace it ("When attached character would
 * ready, discard this card instead", Frozen in Time; docs/phase7-wave2.md §3.11), else at once as before.
 */
export function readyOrAnnounce(
  ctx: Ctx,
  id: InstanceId,
  how: {
    /** The player readying it: the controller at the end-of-phase ready, the resolving player for an effect. */
    readonly readierId?: PlayerId | null;
    /** The card whose ability readies it; absent for the end-of-phase ready. */
    readonly sourceInstanceId?: InstanceId | null;
    /** The additional cost to ready was just paid (`EffectSpec ready.readyCostPaid`). */
    readonly costPaid?: boolean;
  } = {},
): void {
  const instance = getInstance(ctx.state, id);
  if (!instance?.exhausted) return;
  const source = how.sourceInstanceId ?? null;
  if (cannotReady(ctx.state, ctx.deps, id, source)) return;
  // RRG 1.8 "Ready" (p. 36): "If there is an additional cost for a player to ready a card, that player can choose not
  // to pay that cost. If they do not pay the cost, the card does not ready." (`RuleSpec readyCost`; §3.19.) The
  // question is an effects frame the player answers with a payment; paying readies the card through this same path.
  const readier = how.readierId ?? controllerOf(ctx.state, id);
  const cost = !how.costPaid && readier ? readyCostFor(ctx.state, ctx.deps, id, readier) : null;
  if (cost && readier) {
    emit(ctx, { type: "readyCostAsked", instanceId: id, playerId: readier });
    pushEffects(ctx, {
      effects: [
        { kind: "spendResources", player: { kind: "controller" }, resources: cost, bind: "readyCost" },
        {
          kind: "if",
          condition: { kind: "varAtLeast", name: "readyCost.made", amount: 1 },
          then: [{ kind: "ready", target: { kind: "slot", slot: "readyTarget" }, readyCostPaid: true }],
        },
      ],
      selfInstanceId: source,
      controllerId: readier,
      bindings: { readyTarget: [id] },
    });
    return;
  }
  const event: TriggerEvent = { kind: "cardReadying", instanceId: id, ...(source ? { sourceInstanceId: source } : {}) };
  if (heard(ctx.state, ctx.deps, event)) pushEvent(ctx, event);
  else readyAndAnnounce(ctx, id, source);
}

/**
 * Readies a card and announces `cardReadied` if the ready actually happened: "Hero Response: After you ready
 * Quicksilver, ready this card." (Friction Resistance; docs/phase7-wave2.md §21.)
 *
 * The announcement is guarded on the card actually changing from exhausted to ready, so it is not made for a card
 * that was already ready (an interrupt readied it first) nor for one RRG 1.8 "'Cannot'" (p. 11) stopped — "after you
 * ready X" is a fact about a ready that happened. Like every other optional announcement it goes on the stack only
 * when an ability could react, so the end-of-phase ready of a whole table resolves exactly as it did before.
 */
function readyAndAnnounce(ctx: Ctx, id: InstanceId, sourceInstanceId: InstanceId | null = null): void {
  if (!getInstance(ctx.state, id)?.exhausted) return;
  readyCard(ctx, id, sourceInstanceId);
  if (getInstance(ctx.state, id)?.exhausted !== false) return;
  const readied: TriggerEvent = { kind: "cardReadied", instanceId: id };
  if (heard(ctx.state, ctx.deps, readied)) pushEvent(ctx, readied);
}

function applyPlayerThwart(ctx: Ctx, event: Extract<TriggerEvent, { kind: "thwart" }>, frameId: FrameId): void {
  const thwarter = characterProfile(ctx.state, event.thwarterInstanceId, ctx.deps);
  const stat = event.useAtk ? "atk" : "thw";
  if (thwarter?.missing.includes(stat)) return;
  const amount = event.amount ?? thwarter?.[stat];
  if (amount === undefined) return;
  pushEvent(ctx, {
    kind: "removeThreat",
    schemeInstanceId: event.schemeInstanceId,
    amount,
    sourceInstanceId: event.thwarterInstanceId,
    parentFrameId: frameId,
    ...(event.ignoreCrisis ? { ignoreCrisis: true } : {}),
  });
}
