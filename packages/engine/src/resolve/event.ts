/** Event frames (interrupts → apply → responses) and the state change each event kind makes. */

import type { CardId } from "@mc/content";
import { type Ctx, emit, findFrame, popFrame, pushFrames, setFrame, updateFrame, updateInstance } from "../ctx.js";
import { overkillRecipient } from "../defend-preview.js";
import {
  expireEventLastingEffects,
  healDamage,
  permanentStopsLeaving,
  pierceTough,
  discardStatusCards,
  type StatusDiscarded,
  readyCard,
  removeCounters,
} from "../effects.js";
import type { FrameId, InstanceId, PlayerId } from "../ids.js";
import { attackKeywordsOf, hasKeyword, keywordTotal } from "../keywords.js";
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
  cannotThwart,
  damageTakenAfterConstants,
  damageTakenAllowance,
  damageTakenBreakdown,
  damageSourceCard,
  type DamageSourceInfo,
  phaseDamageAllowance,
  excessDamageBonus,
  defeatDestinationRule,
  excessDamageThreatSchemes,
  notDefeatedWithoutThreat,
  patrolledBy,
  cannotReady,
  damagePreventerOf,
  readyCostFor,
  thwartCostFor,
  threatCannotBeRemoved,
  iconsInPlay,
  cannotActivate,
  type ConsequentialDamage,
} from "../rules.js";
import {
  canAttack,
  cardsInPlay,
  characterIgnores,
  controllerOf,
  isProtectedMainScheme,
  sourcePlayerOf,
  thwartAmount,
} from "../select.js";
import {
  applyLeavingPlay,
  dealUnhandledEncounterCard,
  leavingWithHostFrames,
  openLeavingInterrupts,
  runCarriedHostStep,
} from "./cards.js";
import { currentActivationFrameId, type StackFrame, type Vars } from "../stack.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { announceStatusDiscarded } from "./status-discarded.js";
import {
  announceKeywordsIgnored,
  guardsIgnored,
  recordKeywordsIgnored,
  thwartBlockersIgnored,
} from "./keyword-ignored.js";
import { damageTakenKey } from "../trigger-events.js";
import type { DefeatFollowUp, EffectSpec } from "../spec.js";
import {
  applyMainSchemeCompleting,
  checkDefeats,
  checkMainSchemeCompletion,
  defeatVillainStage,
  eliminatePlayer,
} from "./defeat.js";
import { openDefeatedTogetherInterrupts, withDefeatedMember } from "./defeated-together.js";
import { dashedStatSkipsActivation, pushEnemyAttackFrame, pushEnemySchemeFrame } from "./enemy-activation.js";
import { applyEnterPlayKeywords, engagingAsItEnters } from "./enter-play.js";
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
import { continueActivation } from "../villain/phase.js";
import { resolveSurge } from "./reveal.js";
import { candidatesFor, eachTimeEffectsFor, hasCandidates, heard } from "./triggers.js";
import { pushWindow } from "./window.js";
import { markPreThenUnresolved } from "./then.js";
import { cancelThwartSession, foldThwartInstance, openThwartSession, thwartSessionOf } from "./thwart-session.js";

export function executeEventFrame(ctx: Ctx, frame: Frame<"event">): void {
  switch (frame.stage) {
    case "interrupts": {
      // "As an additional cost to thwart this scheme, …" (docs/phase7-wave5.md §3.21): paid before the thwart is
      // initiated (RRG 1.8 "Cost", p. 13). A declined resource payment cancels the thwart. A basic thwart paid it with
      // its own costs, before it was initiated (§4.1 Q27, `thwart-cost.ts`), and is not asked again.
      if (frame.event.kind === "thwart" && !frame.thwartCostAsked && !frame.thwartCostPaid && askThwartCost(ctx, frame))
        return;
      if (frame.thwartCostAsked && frame.cancelled) {
        // Its additional cost was declined: never initiated, so no interrupt window.
        setFrame(ctx, { ...frame, stage: "apply" });
        return;
      }
      // A "(thwart)" ability is a single thwart (RRG 1.8 "Thwart", p. 44; `thwart-session.ts`): its first instance of
      // threat removal initiates it, with the one "when you thwart" window. A later instance has no window of its own;
      // it takes what that window added to the thwart ("1 additional threat") or, if the thwart was cancelled, is
      // cancelled with it.
      if (frame.event.kind === "thwart" && frame.event.abilityFrameId) {
        const session = thwartSessionOf(ctx.state, frame.event.abilityFrameId);
        if (session) {
          setFrame(ctx, {
            ...frame,
            stage: "apply",
            ...(session.cancelled ? { cancelled: true, thwartInstanceCancelled: true as const } : {}),
            vars: session.extraThreat > 0 ? { ...frame.vars, extraThreat: session.extraThreat } : frame.vars,
          });
          return;
        }
        openThwartSession(ctx, frame.event);
      }
      // Cards leaving play from one step share one interrupt window (docs/phase7-wave5.md §4.1 Q32–Q33), and so do
      // characters defeated by one effect (§4.1 Q49).
      if (openLeavingInterrupts(ctx, frame) || openDefeatedTogetherInterrupts(ctx, frame)) return;
      // An enemy activation by an enemy that "cannot activate" does not begin (docs/phase7-wave6.md §3.34): the villain
      // phase and "X attacks/schemes" effects check before pushing, so this catches quickstrike's attack and any other
      // activation pushed as an event. Cancelled before its interrupt window: no boost card, no responses.
      if (
        (frame.event.kind === "enemyAttack" || frame.event.kind === "enemyScheme") &&
        cannotActivate(ctx.state, ctx.deps, frame.event.enemyInstanceId)
      ) {
        emit(ctx, {
          type: "activationBlocked",
          enemyInstanceId: frame.event.enemyInstanceId,
          activation: frame.event.kind === "enemyAttack" ? "attack" : "scheme",
          playerId: frame.event.kind === "enemyAttack" ? frame.event.attackedPlayerId : frame.event.playerId,
        });
        setFrame(ctx, { ...frame, stage: "apply", cancelled: true });
        return;
      }
      emit(ctx, { type: "triggerEvent", event: frame.event, phase: "initiated" });
      setFrame(ctx, { ...frame, stage: "apply" });
      // Attachments this event's apply step takes out of play with its card get their "when this leaves play"
      // interrupts in this window, still in play (§4.1 Q32 of wave 5; `leavingWithHostFrames`).
      const companions = leavingWithHostFrames(ctx, frame);
      // A minion entering play engaged with a player: interrupts to that engagement share this window
      // (`engagingAsItEnters`, RRG 1.8 "Engage", p. 18, and "Triggering Condition", p. 45). No frame of its own: its
      // responses are announced after the minion's keywords.
      const engaging = engagingAsItEnters(ctx, frame.event);
      const interrupts =
        engaging !== null ||
        hasCandidates(ctx.state, ctx.deps, frame.event, "interrupt") ||
        companions.some((companion) => hasCandidates(ctx.state, ctx.deps, companion.event, "interrupt"));
      // A tough status resolves first and prevents all the damage, so no "would take damage" interrupt gets a window
      // (docs/phase7-wave3.md §3.12).
      if (interrupts && frame.event.kind === "dealDamage" && toughResolvesFirst(ctx, frame.event, frame.frameId)) {
        emit(ctx, { type: "interruptsPreempted", event: frame.event, reason: "tough" });
        return;
      }
      // Piercing discards the tough cards before any "would deal/take damage" interrupt triggers: "keywords have
      // timing priority over triggered abilities" (ruling January 17, 2026 (3) #2, on RRG 1.8 "Piercing", p. 32).
      const opened =
        interrupts && frame.event.kind === "dealDamage" ? pierceBeforeInterrupts(ctx, frame.event) : frame.event;
      if (opened !== frame.event) setFrame(ctx, { ...frame, stage: "apply", event: opened });
      if (interrupts)
        pushWindow(
          ctx,
          opened,
          "interrupt",
          frame.frameId,
          [...companions.map((companion) => companion.event), ...(engaging ? [engaging] : [])],
          [...companions.map((companion) => companion.frameId), ...(engaging ? [null] : [])],
        );
      return;
    }
    case "apply": {
      if (frame.group) {
        // A simultaneous damage group's member, or one of several characters defeated together (§4.1 Q49 of wave 5):
        // its interrupts are done, and the group applies it with the others.
        const { frameId: groupId, index } = frame.group;
        const event = frame.event;
        if (frame.cancelled) emit(ctx, { type: "triggerEvent", event, phase: "cancelled" });
        updateFrame(ctx, groupId, (group) => {
          if (group.kind === "effects" && event.kind === "characterDefeated")
            return withDefeatedMember(group, index, event, frame.cancelled);
          return group.kind === "damageGroup" && event.kind === "dealDamage"
            ? {
                ...group,
                members: group.members.map((member, i) =>
                  i === index ? { ...member, event, cancelled: frame.cancelled } : member,
                ),
              }
            : group;
        });
        popFrame(ctx);
        return;
      }
      if (frame.cancelled && frame.thwartInstanceCancelled) {
        // A later instance of a "(thwart)" ability whose thwart was cancelled: the cancellation is already logged.
        reportResults(ctx, frame, false);
        popFrame(ctx);
        return;
      }
      // The first instance's interrupt window cancelled the thwart: the ability's other instances go with it. An
      // instance whose own additional cost was declined (`thwartCostAsked`) cancels only itself.
      if (frame.cancelled && frame.event.kind === "thwart" && !frame.thwartCostAsked) {
        cancelThwartSession(ctx, frame.event);
      }
      if (frame.cancelled) {
        // A cancelled last placement of step one still checks the main schemes the batch's earlier placements
        // reached, once, before their shared responses (docs/phase7-wave5.md §4.1 Q71).
        if (frame.event.kind === "placeThreat" && frame.event.completionCheck === "closing") {
          const { completionCheck: _checked, ...event } = frame.event;
          setFrame(ctx, { ...frame, event });
          checkMainSchemeCompletion(ctx);
          return;
        }
        // An attack that ends before fully resolving was still defended, and the abilities that trigger after that
        // defense still resolve (RRG 1.8 "Defend, Defense", p. 16, and "Attack (Enemy Activation)", p. 9: "If an
        // enemy attack ends before damage is dealt, abilities that trigger after an attack or after a character
        // defends an attack resolve as normal"). So these run even on the cancel path.
        if (stepDeferredResponses(ctx, frame)) return;
        // Earlier conditions of the same occurrence did happen: their shared window still opens (RRG 1.8 p. 45).
        if (openJoinedResponses(ctx, frame)) return;
        // RRG "Cancel": the canceled effect is not considered to have occurred, so no responses.
        emit(ctx, { type: "triggerEvent", event: frame.event, phase: "cancelled" });
        reportResults(ctx, frame, false);
        expireEventLastingEffects(ctx, frame.frameId);
        // An attachment's leaving that carried its host's change: the change still happens (only this card's leaving
        // was cancelled), run while this frame is still on the stack so it does not wait again (§4.1 Q32 of wave 5).
        let finished = frame;
        if (runCarriedHostStep(ctx, frame)) {
          const now = findFrame(ctx.state, frame.frameId);
          if (now?.kind === "event") finished = now;
          ctx.state = { ...ctx.state, stack: ctx.state.stack.filter((f) => f.frameId !== frame.frameId) };
          emit(ctx, { type: "framePopped", frameId: frame.frameId, frame: frame.kind });
        } else popFrame(ctx);
        // What replaced it is announced after its "cancelled" line (docs/phase7-wave5.md §4.1 Q34).
        announceAfterward(ctx, finished);
        // Tough cards piercing discarded before the interrupt that cancelled this damage were still discarded.
        if (frame.event.kind === "dealDamage") announceStatusDiscarded(ctx, piercedBeforeInterrupts(frame.event));
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
      // An instance of a "(thwart)" ability's one thwart: its results join the ability's, whose resolved `thwart` and
      // response window follow the ability's last effect (RRG 1.8 "Thwart", p. 44; `thwart-session.ts`).
      if (foldThwartInstance(ctx, frame)) {
        setFrame(ctx, { ...frame, stage: "done" });
        return;
      }
      // Results are final once everything the event pushed has resolved.
      const event = withResults(resolvedAmount(frame.event, frame.vars), frame.vars);
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
      // The conditions earlier frames of the same occurrence handed over share this window (RRG 1.8 p. 45).
      const { joinedResponses: joined = [], ...unjoined } = frame;
      setFrame(ctx, {
        ...unjoined,
        event,
        stage: "done",
        ...(forcedResponses > 0 ? { vars: { ...frame.vars, forcedResponses } } : {}),
      });
      if (joinLaterResponses(ctx, frame, event)) {
        // Its responses wait for the later frame's window (`pushEventsSharingResponses`).
      } else if (
        hasCandidates(ctx.state, ctx.deps, event, "response") ||
        joined.some((other) => hasCandidates(ctx.state, ctx.deps, other, "response"))
      ) {
        pushWindow(ctx, event, "response", frame.frameId, joined);
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
      // Handed-over conditions this frame's own response window never gathered (it found nothing to do, or deferred).
      if (openJoinedResponses(ctx, frame)) return;
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
      // "After you ignore guard / patrol / the crisis icon" answers after the attack or thwart (§3.8, §4.1 Q6), so it
      // is pushed first and resolves after the moves `announceAfterward` reports.
      announceKeywordsIgnored(ctx, frame);
      announceAfterward(ctx, frame);
      return;
    }
  }
}

/**
 * Pushes the announcements a finished event frame carries (`announceAfter`: moves made during its own interrupt window,
 * docs/phase7-wave5.md §4.1 Q34), the ones something still listens for, oldest resolving first.
 */
function announceAfterward(ctx: Ctx, frame: Frame<"event">): void {
  const events = (frame.announceAfter ?? []).filter((event) => heard(ctx.state, ctx.deps, event));
  for (const event of [...events].reverse()) pushEvent(ctx, event);
}

/**
 * The step after a defeated card's When Defeated abilities: it leaves play by `leave` (RRG 1.8 "When Defeated
 * Abilities", p. 48: "A defeated card leaves play after its 'When Defeated' ability is resolved, if any"). Only if it is
 * still in play showing the face that was defeated: a When Defeated that moved it ("shuffle this card into the encounter
 * deck") or flipped it into its other face (Secure the Landing Pad → Cosmo; docs/phase7-wave4.md §3.10) has already
 * placed it. Shared by allies, minions and side schemes. `sourceCardId`: the card whose ability defeated it, if any, for
 * the Permanent keyword (`defeatedLeavingSource`, docs/phase7-wave5.md §4.1 Q46).
 */
function leaveAfterWhenDefeated(
  ctx: Ctx,
  id: InstanceId,
  printedId: CardId,
  leave: EffectSpec,
  controllerId: PlayerId | null,
  sourceCardId?: CardId,
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
    ...(sourceCardId !== undefined ? { defeatedLeavingSource: sourceCardId } : {}),
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

/**
 * A resolved thwart's `amount` is the threat it actually removed (its removal's `threatRemoved`, 0 if a crisis icon,
 * Held Hostage or an empty scheme stopped it), so "after [character] thwarts and removes threat …, remove an equal
 * amount" reads what happened, for a basic thwart as for a "(thwart)" ability (RRG 1.8 "Thwart", p. 44). Before it
 * resolves, `thwartAmount` (`select.ts`) gives the amount it is about to remove.
 */
const resolvedAmount = (event: TriggerEvent, vars: Vars): TriggerEvent =>
  event.kind === "thwart" ? { ...event, amount: vars.threatRemoved ?? 0 } : event;

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

/**
 * A frame pushed by `pushEventsSharingResponses` hands its resolved event to the later frame whose response window it
 * shares (RRG 1.8 "Triggering Condition", p. 45). False when it shares none, or that frame is no longer on the stack
 * (then it opens its own window, as any event does).
 */
function joinLaterResponses(ctx: Ctx, frame: Frame<"event">, event: TriggerEvent): boolean {
  const leader = frame.responsesWith;
  if (leader === undefined || findFrame(ctx.state, leader)?.kind !== "event") return false;
  updateFrame(ctx, leader, (f) =>
    f.kind === "event" ? { ...f, joinedResponses: [...(f.joinedResponses ?? []), event] } : f,
  );
  return true;
}

/**
 * Opens the shared response window of the conditions handed to `frame` when its own window did not gather them (it was
 * cancelled, found nothing to do, or deferred its responses). False when none is left.
 */
function openJoinedResponses(ctx: Ctx, frame: Frame<"event">): boolean {
  const [first, ...rest] = frame.joinedResponses ?? [];
  if (!first) return false;
  const { joinedResponses: _opened, ...unjoined } = frame;
  setFrame(ctx, unjoined);
  if ([first, ...rest].some((event) => hasCandidates(ctx.state, ctx.deps, event, "response"))) {
    pushWindow(ctx, first, "response", null, rest);
  }
  return true;
}

/** An event frame is finishing: hand its results (and whether it happened) to whoever asked for them. */
function reportResults(ctx: Ctx, frame: Frame<"event">, happened: boolean): void {
  if (!frame.reportTo) return;
  const { frameId, prefix, gatesThen } = frame.reportTo;
  if (!happened && gatesThen) {
    const about = "enemyInstanceId" in frame.event ? (frame.event.enemyInstanceId ?? undefined) : undefined;
    markPreThenUnresolved(ctx, frameId, "activationDidNotHappen", about);
  }
  if (prefix === null) return;
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
      healDamage(ctx, event.targetInstanceId, event.amount, event.sourceInstanceId ?? null);
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
    case "enemyActivating":
      continueActivation(ctx, event);
      return;
    case "countersRemoved": {
      // Removed already as a cost (`paidAsCost`, wave 6 §3.85): the announcement changes nothing.
      if (event.paidAsCost) {
        addFrameVars(ctx, frame.frameId, { amount: event.amount });
        return true;
      }
      const removed = removeCounters(ctx, event.instanceId, event.counterType, event.amount);
      addFrameVars(ctx, frame.frameId, {
        amount: removed,
        // `EffectSpec removeCounters.bind`: the per-card count, reported as `<bind>.amount.<instanceId>`.
        ...(frame.reportTo?.prefix ? { [`amount.${event.instanceId}`]: removed } : {}),
      });
      return removed > 0;
    }
    case "cardReadying":
      readyAndAnnounce(ctx, event.instanceId, event.sourceInstanceId ?? null);
      return;
    case "basicRecovery":
      // REC as it is now, so an interrupt that changed it first counts (docs/phase7-wave6.md §3.40).
      healRecovery(ctx, event.characterInstanceId);
      return;
    case "cardEntersPlay":
      // The keywords that resolve as a card enters play are this event's change, so an "Interrupt: when X enters
      // play" ability runs before them and a Response after (docs/phase7-wave2.md §3.13.10).
      applyEnterPlayKeywords(ctx, event.instanceId);
      return;
    case "cardLeavesPlay":
      // "When X leaves play" resolved with the card still in play; it moves now (docs/phase7-wave5.md §4.1 Q17).
      return applyLeavingPlay(ctx, frame);
    case "encounterCardFromPlayerDeck":
      // Nothing replaced it in the interrupt window: the engine's fallback (docs/phase7-wave5.md §4.1 Q4).
      dealUnhandledEncounterCard(ctx, event);
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
 *
 * Returns false when the defeat does not happen, true when it did and nothing is left to do (a villain stage, an
 * identity), and for an ally or minion what its When Defeated and leaving steps need, which the caller schedules
 * (`applyDefeat` alone, `defeatedTogether` for several at once).
 */
export function beginDefeat(
  ctx: Ctx,
  event: Extract<TriggerEvent, { kind: "characterDefeated" }>,
): boolean | DefeatFollowUp {
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
  // Permanent (docs/phase7-wave5.md §4.1 Q46): an effect that says "defeat" is its card's ability; reaching zero hit
  // points is the game's rule, with no source card, whatever dealt the damage.
  const sourceId = event.byEffect === true ? event.sourceInstanceId : undefined;
  const sourceCardId = sourceId ? getInstance(ctx.state, sourceId)?.cardId : undefined;
  if (permanentStopsLeaving(ctx.state, ctx.deps, id, sourceCardId)) {
    emit(ctx, { type: "leavePlayBlocked", instanceId: id, reason: "permanent" });
    return false;
  }
  emit(ctx, { type: "characterDefeated", instanceId: id, cardId: instance.cardId });
  const actingPlayerId = instance.engagedWith ?? ctx.state.firstPlayerId;
  // Victory X sends a defeated character to the victory display instead (docs/phase7-wave3.md §3.4). Otherwise an
  // interrupt's `setDefeatDestination` ("return it to its owner's hand instead of discarding it", Regroup), else a
  // constant `defeatDestination` rule, replaces the discard (docs/phase7-wave3.md §3.45). Read now, at the defeat.
  const destination = event.destination ?? defeatDestinationRule(ctx.state, ctx.deps, id);
  addFrameVars(ctx, event.parentFrameId, { defeated: 1 });
  if (event.reportFrameId && event.reportFrameId !== event.parentFrameId) {
    addFrameVars(ctx, event.reportFrameId, { defeated: 1 });
  }
  let spill: DefeatFollowUp["spill"];
  if (event.overkill && !ctx.state.outcome && getInstance(ctx.state, event.overkill.toInstanceId)) {
    emit(ctx, {
      type: "overkillSpilled",
      fromInstanceId: id,
      toInstanceId: event.overkill.toInstanceId,
      amount: event.overkill.amount,
    });
    // RRG "Overkill": spilled damage is attack damage but not an attack against that character.
    spill = {
      kind: "dealDamage",
      targetInstanceId: event.overkill.toInstanceId,
      amount: event.overkill.amount,
      sourceInstanceId: event.overkill.sourceInstanceId,
      fromAttack: true,
      ...(event.parentFrameId ? { spilledFromFrameId: event.parentFrameId } : {}),
    };
  }
  return {
    printedId: instance.cardId,
    actingPlayerId,
    controllerId: controllerOf(ctx.state, id),
    ...(destination === null ? {} : { insteadTo: destination }),
    ...(sourceCardId !== undefined ? { sourceCardId } : {}),
    ...(spill ? { spill } : {}),
  };
}

/** A defeated ally's or minion's leaving step (`leaveAfterWhenDefeated`), with the destination its defeat read. */
function defeatLeaveSpec(followUp: DefeatFollowUp): EffectSpec {
  return {
    kind: "discardFromPlay",
    target: { kind: "self" },
    defeated: true,
    ...(followUp.insteadTo === undefined ? {} : { insteadTo: followUp.insteadTo }),
  };
}

/**
 * The defeat of one character on its own: it happens (`beginDefeat`), then the card's When Defeated abilities, its
 * leaving step and any overkill spill go on the stack in that order. Allies and minions defeated by one effect resolve
 * together instead (`resolve/defeated-together.ts`, docs/phase7-wave5.md §4.1 Q49).
 */
function applyDefeat(ctx: Ctx, event: Extract<TriggerEvent, { kind: "characterDefeated" }>): boolean {
  const begun = beginDefeat(ctx, event);
  if (typeof begun === "boolean") return begun;
  const id = event.instanceId;
  const frames: StackFrame[] = [
    ...gameAbilityFrames(ctx, id, ["whenDefeated"], event, undefined, begun.actingPlayerId),
    leaveAfterWhenDefeated(ctx, id, begun.printedId, defeatLeaveSpec(begun), begun.controllerId, begun.sourceCardId),
  ];
  if (begun.spill) frames.push(eventFrame(ctx, begun.spill));
  pushFrames(ctx, frames);
  return true;
}

type DamageEvent = Extract<TriggerEvent, { kind: "dealDamage" }>;

/**
 * Whether this damage is an attack's, dealt to the character it attacks, by an attack with piercing: the attacker's own
 * keyword, or one granted to this attack alone and stamped on the event (`attackKeywordsOf`). Attack damage dealt to a
 * character the attack is not against (`notAttacked`, docs/phase7-wave6.md §3.36, §4.1 Q18) does not pierce.
 */
function attackPierces(ctx: Ctx, event: DamageEvent): boolean {
  const source = event.sourceInstanceId;
  return (
    event.fromAttack &&
    event.notAttacked !== true &&
    (event.piercing === true || (source !== null && hasKeyword(ctx.state, source, "piercing", ctx.deps)))
  );
}

/**
 * RRG 1.8 "Piercing" (p. 32): "Before this attack deals damage to a character, discard each tough status card from that
 * character", unless the attack "would deal no damage to the attacked character". Whether the damage is then *taken*
 * does not matter: ruling January 17, 2026 (3) #1, "Effects that 'prevent damage' prevent damage taken, not dealt. If
 * Rogue plays Bulletproof Belle and gains a Tough status card, an attack with Piercing that still deals damage to her
 * will remove that Tough status card". So this runs ahead of every prevention; the one thing ahead of it is "cannot
 * take damage", kept as it was (not covered by the ruling).
 */
function pierceForDamage(ctx: Ctx, event: DamageEvent): readonly StatusDiscarded[] {
  if (event.amount <= 0 || !attackPierces(ctx, event)) return [];
  if (!cardsInPlay(ctx.state).includes(event.targetInstanceId)) return [];
  if (cannotTakeDamage(ctx.state, ctx.deps, event.targetInstanceId, [event.sourceInstanceId, event.viaInstanceId]))
    return [];
  return pierceTough(ctx, event.targetInstanceId);
}

/**
 * Piercing ahead of the damage's interrupt window (ruling January 17, 2026 (3) #2: "keywords have timing priority over
 * triggered abilities. Piercing removes the Tough status card before Aerial Evacuation triggers to prevent damage
 * taken"). The event comes back marked with how many tough cards went, so the damage step neither pierces again (a tough
 * card an interrupt gives afterwards is not one the keyword saw) nor forgets to announce them.
 */
function pierceBeforeInterrupts(ctx: Ctx, event: DamageEvent): DamageEvent {
  if (event.toughPierced !== undefined || event.amount <= 0 || !attackPierces(ctx, event)) return event;
  return { ...event, toughPierced: pierceForDamage(ctx, event).length };
}

/** The `statusDiscarded` announcements `pierceBeforeInterrupts` held back for the damage step (docs/phase7-wave6.md §3.5). */
export function piercedBeforeInterrupts(event: DamageEvent): readonly StatusDiscarded[] {
  return Array.from({ length: event.toughPierced ?? 0 }, () => ({
    kind: "statusDiscarded",
    instanceId: event.targetInstanceId,
    status: "tough",
    cause: "piercing",
  }));
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
function toughResolvesFirst(ctx: Ctx, event: Extract<TriggerEvent, { kind: "dealDamage" }>, frameId: FrameId): boolean {
  if (event.amount <= 0 || event.ignoreTough === true) return false;
  const target = getInstance(ctx.state, event.targetInstanceId);
  if (!target || target.statuses.tough <= 0) return false;
  const source = event.sourceInstanceId;
  if (cannotTakeDamage(ctx.state, ctx.deps, event.targetInstanceId, [source, event.viaInstanceId])) return false;
  const consequential = consequentialDamageOf(ctx, event, frameId);
  if (damagePreventerOf(ctx.state, ctx.deps, event.targetInstanceId, consequential) !== null) return false;
  if (event.fromAttack && preventedByAttackFlag(ctx, event)) return false;
  if (attackPierces(ctx, event)) return false;
  return (
    damageTakenAfterConstants(
      ctx.state,
      ctx.deps,
      event.targetInstanceId,
      event.amount,
      event.fromAttack,
      consequential,
      damageSourceInfo(ctx, event),
    ) > 0
  );
}

/**
 * Where this damage comes from, as the damage-taken rules read it (`DamageSourceInfo`, docs/phase7-wave6.md §3.68): its
 * source card (§4 Q39), and for an attack's damage to the character it attacks, the attack's piercing and overkill
 * (stamped on the event or the attacker's own). Ranged is not carried on the damage event, so a rule keyed to it never
 * matches yet.
 */
function damageSourceInfo(ctx: Ctx, event: Extract<TriggerEvent, { kind: "dealDamage" }>): DamageSourceInfo {
  const card = damageSourceCard(event);
  if (!event.fromAttack || event.notAttacked === true) return { card };
  const source = event.sourceInstanceId;
  const attackKeywords = (["piercing", "overkill"] as const).filter(
    (name) => event[name] === true || (source !== null && hasKeyword(ctx.state, source, name, ctx.deps)),
  );
  return { card, attackKeywords };
}

/**
 * An ally's consequential damage as the damage-taken rules read it (`ConsequentialDamageScope`, docs/phase7-wave6.md
 * §3.31): the power it follows, and this damage frame's vars and slots, into which that power has reported its results
 * by now (it resolved first; `pushConsequentialDamage`). Undefined for any other damage.
 */
function consequentialDamageOf(
  ctx: Ctx,
  event: Extract<TriggerEvent, { kind: "dealDamage" }>,
  frameId: FrameId,
): ConsequentialDamage | undefined {
  if (event.consequential !== true || event.consequentialFrom === undefined) return undefined;
  const frame = findFrame(ctx.state, frameId);
  const own = frame?.kind === "event" ? frame : undefined;
  return {
    from: event.consequentialFrom,
    event,
    vars: own?.vars ?? {},
    slots: own?.slots ?? {},
    ...(own?.lingeringDamageRules ? { lingering: own.lingeringDamageRules } : {}),
  };
}

/** Whether the attack this damage belongs to is carrying a "prevent all damage from that attack" flag. */
function preventedByAttackFlag(ctx: Ctx, event: Extract<TriggerEvent, { kind: "dealDamage" }>): boolean {
  const parent = event.parentFrameId ? findFrame(ctx.state, event.parentFrameId) : undefined;
  return parent?.kind === "event" && (parent.vars.preventAllDamage ?? 0) > 0;
}

/**
 * Spends the attack's "prevent N damage from this attack" budget (`modifyAttack.preventDamage`, docs/phase7-wave6.md
 * §3.81) on `taken`, the damage this attack's `dealDamage` would have its target take: up to the budget left, logged
 * and announced as prevented by the card that set it. Returns the amount prevented.
 */
function spendAttackPreventBudget(
  ctx: Ctx,
  event: Extract<TriggerEvent, { kind: "dealDamage" }>,
  taken: number,
): number {
  // The budget is the attacked character's: redirected damage (§3.36) does not spend it.
  if (taken <= 0 || event.notAttacked === true) return 0;
  const parent = event.parentFrameId ? findFrame(ctx.state, event.parentFrameId) : undefined;
  if (parent?.kind !== "event") return 0;
  const left = (parent.vars.preventDamage ?? 0) - (parent.vars.preventDamageUsed ?? 0);
  if (left <= 0) return 0;
  const prevented = Math.min(left, taken);
  addFrameVars(ctx, parent.frameId, { preventDamageUsed: prevented });
  emit(ctx, { type: "damagePrevented", targetInstanceId: event.targetInstanceId, amount: prevented, reason: "effect" });
  announceDamagePrevented(ctx, {
    kind: "damagePrevented",
    targetInstanceId: event.targetInstanceId,
    amount: prevented,
    preventerInstanceId: parent.slots.damagePreventer?.[0] ?? null,
    fromAttack: true,
    sourceInstanceId: event.sourceInstanceId,
  });
  return prevented;
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
  // Piercing comes first, before the attack deals its damage and whatever then keeps that damage from being taken
  // (`pierceForDamage`): done already when the damage had an interrupt window (`pierceBeforeInterrupts`), else here.
  // An attack that deals no damage (amount 0: a defense that covered it all) discards nothing, RRG 1.8 p. 32.
  // Each pierced tough card is announced (docs/phase7-wave6.md §3.5); their shared window opens once the damage and any
  // defeat it starts have resolved, since those are pushed above it.
  announceStatusDiscarded(
    ctx,
    event.toughPierced !== undefined ? piercedBeforeInterrupts(event) : pierceForDamage(ctx, event),
  );
  if (event.amount <= 0) return;
  // RRG 1.8 "In Play and Out of Play" (p. 23): abilities "only interact with … cards that are in play". Damage waiting
  // on the stack for a card that has since left play (an ally's consequential damage after Speed Demon's attack
  // defeated it, docs/phase7-wave4.md §4 Q20) is not dealt, rather than left on the discarded card.
  if (!cardsInPlay(ctx.state).includes(event.targetInstanceId)) return;
  const source = event.sourceInstanceId;
  // The attacker's own keyword, or one granted to this attack alone and stamped on the event (`attackKeywordsOf`).
  // It does not apply to attack damage dealt to a character the attack is not against (`notAttacked`, §3.36, §4.1 Q18).
  const attackKeyword = (name: "overkill"): boolean =>
    event.fromAttack &&
    event.notAttacked !== true &&
    (event[name] === true || (source !== null && hasKeyword(ctx.state, source, name, ctx.deps)));

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
  // RRG 1.8 "Prevent" (p. 35): the damage is dealt but not taken, so nothing below runs: no tough card is used, the
  // attack records no `damage`/`damaged` result, and there is no excess damage (`excessDamageOf`, RRG 1.8 p. 31).
  // Dealt, so a piercing attack has already discarded the tough cards above (ruling January 17, 2026 (3) #1).
  // "Prevent all damage to Ebony Maw" (`RuleSpec preventAllDamage`, docs/phase7-wave4.md §3.20): dealt and prevented,
  // by that card, which "After Abjuration prevents …" hears.
  // A rule scoped to consequential damage ("prevent all consequential damage each ally would take from attacking",
  // Group Assault; docs/phase7-wave6.md §3.31) reaches only an ally's consequential damage.
  const consequential = consequentialDamageOf(ctx, event, frameId);
  const preventer = damagePreventerOf(ctx.state, ctx.deps, event.targetInstanceId, consequential);
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
  const target = getInstance(ctx.state, event.targetInstanceId);
  if (!target) return;
  // Constant reductions and caps on the damage taken ("Reduce the amount of damage Nebula takes from each attack by 1",
  // "cannot take more than 5 damage from a single attack"): constants come before a tough status, so one that brings it
  // to 0 keeps the tough card (RRG 1.8 FAQ p. 58; docs/phase7-wave3.md §3.15).
  const breakdown = damageTakenBreakdown(
    ctx.state,
    ctx.deps,
    event.targetInstanceId,
    event.amount,
    event.fromAttack,
    consequential,
    damageSourceInfo(ctx, event),
  );
  const uncapped = breakdown.taken;
  // "Double the amount of damage this minion takes from …" (§3.68), logged before any cap trims it.
  if (breakdown.doubledBy.length > 0) {
    emit(ctx, {
      type: "damageDoubled",
      targetInstanceId: event.targetInstanceId,
      from: breakdown.beforeDoubling,
      to: breakdown.beforeDoubling * 2 ** breakdown.doubledBy.length,
      doubledBy: breakdown.doubledBy,
    });
  }
  if (uncapped <= 0) {
    emit(ctx, {
      type: "damagePrevented",
      targetInstanceId: event.targetInstanceId,
      amount: event.amount,
      reason: "reduced",
    });
    return;
  }
  // "Magneto cannot have more than N sustained damage" (`maxSustainedDamage`, docs/phase7-wave6.md §3.3), "Nimrod
  // cannot take more than 3 damage each phase" (§3.4): what is above the cap is dealt but neither taken nor prevented
  // (§4.1 Q9), so it is logged as `damageCapped`, never as a prevention, and a tough status card only replaces the
  // damage that would still be taken (none when at the cap).
  const allowance = damageTakenAllowance(ctx.state, ctx.deps, event.targetInstanceId);
  const taken = allowance === null ? uncapped : Math.min(uncapped, allowance);
  if (taken < uncapped) {
    emit(ctx, { type: "damageCapped", targetInstanceId: event.targetInstanceId, amount: uncapped - taken });
  }
  // "This damage ignores tough status cards" (Lightning Strike, errata RRG 1.8 p. 65): the damage is taken and the
  // status card stays. Piercing is the keyword the RRG defines as discarding it, so "ignores" does not (§3.13).
  if (taken > 0 && target.statuses.tough > 0 && event.ignoreTough !== true) {
    emit(ctx, {
      type: "damagePrevented",
      targetInstanceId: event.targetInstanceId,
      amount: taken,
      reason: "tough",
    });
    // One tough card is used up (RRG 1.8 "Tough", p. 44), and announced (docs/phase7-wave6.md §3.5).
    const used = discardStatusCards(ctx, event.targetInstanceId, "tough", "preventedDamage", target.statuses.tough - 1);
    announceStatusDiscarded(ctx, used);
    return;
  }
  if (uncapped < event.amount) {
    emit(ctx, {
      type: "damagePrevented",
      targetInstanceId: event.targetInstanceId,
      amount: event.amount - uncapped,
      reason: "reduced",
    });
  }
  // "Prevent 3 damage from this attack" (`modifyAttack.preventDamage`, Brazen Defense; docs/phase7-wave6.md §3.81):
  // a budget on the attack's own event frame, spent here on the damage it would still have the attacked character
  // take. RRG 1.8 "Damage" (p. 14) puts tough status cards (step 2) before abilities that trigger "when [character]
  // would take damage" (step 3), and FAQ p. 58 gives constants priority over status cards and status cards priority
  // over triggered abilities, so this comes after constant reductions, the sustained-damage cap and tough (a tough card
  // that absorbed the damage returned above with the budget unspent). Prevented damage is dealt but not taken (RRG 1.8
  // "Prevent", p. 35): it yields no `damage` result and no excess. An overkill spill carries no `parentFrameId`, so the
  // budget never reaches it.
  const prevented = event.fromAttack ? spendAttackPreventBudget(ctx, event, taken) : 0;
  const landed = taken - prevented;
  const maxHp = characterProfile(ctx.state, event.targetInstanceId, ctx.deps)?.maxHp;
  // Excess damage is measured on the damage taken, after the sustained-damage cap too, so capped damage yields no excess
  // and no overkill spill (RRG 1.8 "Overkill", p. 31, superseding ruling Jan 26, 2026 (3) and the "seen as dealt" half
  // of docs/phase7-wave6.md §4.1 Q9; `excessDamageOf`).
  if (landed <= 0) return;
  const excessDealt = excessDamageOf(ctx, event, target.damage, landed, maxHp);
  recordDamageTaken(ctx, event, frameId, landed);
  if (excessDealt > 0) {
    addFrameVars(ctx, frameId, { excessDealt });
    addFrameVars(ctx, event.parentFrameId, { excessDealt });
    placeExcessDamageAsThreat(ctx, event, excessDealt);
  }
  if (!sweep) return;

  // Overkill spills the same excess every "excess damage dealt" ability counts (RRG 1.8 "Overkill", p. 31).
  const overkill =
    event.fromAttack && event.notAttacked !== true && (event.overkill === true || attackKeyword("overkill"));
  const excess = overkill ? excessDealt : 0;
  const recipient = excess > 0 ? overkillRecipient(ctx.state, event.targetInstanceId) : null;
  const villainBefore = villainOf(ctx.state, event.targetInstanceId);

  checkDefeats(ctx, {
    targetId: event.targetInstanceId,
    parentFrameId: event.parentFrameId ?? null,
    fromAttack: event.fromAttack,
    overkill: recipient ? { amount: excess, toInstanceId: recipient, sourceInstanceId: source } : undefined,
    defeatedByPlayerId: sourcePlayerOf(ctx.state, event),
    sourceInstanceId: source,
    reportFrameId: frameId,
    ...(excessDealt > 0 ? { excessDamage: excessDealt } : {}),
    ...(event.consequential === true ? { consequential: true } : {}),
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

/** The damage `applyDamage` lets land: the dial or tokens move, the log says so, and the frames remember who took it. */
function recordDamageTaken(
  ctx: Ctx,
  event: Extract<TriggerEvent, { kind: "dealDamage" }>,
  frameId: FrameId,
  taken: number,
): void {
  // Counted toward "cannot take more than 3 damage each phase" only while such a rule applies (docs/phase7-wave6.md
  // §3.4): damage taken, so prevented, reduced and capped damage never reach here (§4.1 Q9).
  const tallied = phaseDamageAllowance(ctx.state, ctx.deps, event.targetInstanceId) !== null;
  updateInstance(ctx, event.targetInstanceId, (i) => ({
    ...i,
    damage: i.damage + taken,
    ...(tallied ? { damageTakenThisPhase: (i.damageTakenThisPhase ?? 0) + taken } : {}),
  }));
  emit(ctx, {
    type: "damageDealt",
    targetInstanceId: event.targetInstanceId,
    amount: taken,
    sourceInstanceId: event.sourceInstanceId,
    ...(event.noPlayer ? { noPlayer: true as const } : {}),
  });
  addFrameVars(ctx, frameId, { amount: taken });
  // The character that took it, reported as `<bind>.damaged` ("exhaust each character damaged this way", Bombshell
  // 31031): only damage actually taken gets here, so a prevented instance names nobody (RRG 1.8 "Indirect Damage",
  // p. 24). A `damageGroup` member sets the same slot on its response frame instead (`resolve/damage-group.ts`).
  addFrameSlots(ctx, frameId, { damaged: [event.targetInstanceId] });
  // The attack's `damage`/`damaged` totals count the attacked character's damage ("after an enemy attack damages
  // you"), so damage redirected to another enemy (`notAttacked`, §3.36) reports only its per-character key, as a spill.
  if (event.notAttacked !== true) addFrameVars(ctx, event.parentFrameId, { damage: taken, damaged: 1 });
  // Per-character damage taken (docs/phase7-wave5.md §4.1 Q65): "if your identity takes any amount of damage from that
  // attack" when an indirect attack's damage was divided among several characters, or overkill spilled onto the
  // identity. Only damage actually taken lands here (prevented, reduced to 0 or absorbed by tough returned above).
  addFrameVars(ctx, event.parentFrameId ?? event.spilledFromFrameId, {
    [damageTakenKey(event.targetInstanceId)]: taken,
  });
  if (event.notAttacked !== true) addFrameSlots(ctx, event.parentFrameId, { damaged: [event.targetInstanceId] });
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
  // Every attack, repeats included ("the first attack this turn", docs/phase7-wave5.md §3.12).
  ctx.state = {
    ...ctx.state,
    attacksThisTurn: [
      ...(ctx.state.attacksThisTurn ?? []),
      { attackerInstanceId: attackerId, targetInstanceId: targetId },
    ],
  };
  const attackerTitle = titleShowing(ctx.state, attackerId) ?? "";
  const already = ctx.state.attackedThisTurn[targetId] ?? [];
  if (already.some((r) => r.attackerInstanceId === attackerId && r.attackerTitle === attackerTitle)) return;
  const record = { attackerInstanceId: attackerId, attackerTitle };
  ctx.state = { ...ctx.state, attackedThisTurn: { ...ctx.state.attackedThisTurn, [targetId]: [...already, record] } };
}

/**
 * Why this player may not thwart `schemeId` at all right now, whether or not the thwart removes threat, or null: the
 * part of `threatRemovalBlocked` that is about thwarting rather than about removing threat.
 *
 * - RRG 1.8 "Patrol" (p. 32): a thwart, basic or a "(thwart)" ability, by a player a patrol minion is engaged with
 *   cannot be aimed at the main scheme; other removal ("remove 2 threat from the main scheme") still can
 *   (docs/phase7-wave3.md §3.5).
 * - "The engaged player cannot thwart side schemes" (`RuleSpec cannotThwart`, with or without `schemes`): the judge of
 *   a "(thwart)" target's validity, and the backstop for a thwart whose player became unable to thwart this scheme
 *   after it began.
 *
 * A crisis icon and a `threatCannotBeRemoved` rule are not read here: they stop threat being removed (RRG 1.8 "Crisis
 * Icon", p. 14: "threat cannot be removed from the main scheme by player cards"), so they stop a thwart only through
 * the removal it makes, and a thwart that removes none (`thwart.reducesThreatPlaced`, Emergency) is not stopped by them.
 */
export function thwartForbiddenOn(
  state: GameState,
  deps: EngineDeps,
  thwart: {
    readonly thwarterInstanceId: InstanceId | null;
    readonly playerId: PlayerId;
    readonly ignorePatrol?: boolean | undefined;
    readonly basic?: boolean | undefined;
  },
  schemeId: InstanceId,
): "patrol" | "rule" | null {
  if (
    thwart.ignorePatrol !== true &&
    isProtectedMainScheme(state, deps, schemeId) &&
    patrolledBy(state, deps, thwart.playerId) &&
    !characterIgnores(state, deps, thwart.thwarterInstanceId, "patrol", thwart.basic === true)
  )
    return "patrol";
  return cannotThwart(state, deps, thwart.playerId, schemeId, thwart.thwarterInstanceId) ? "rule" : null;
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
  /** The removal is a basic thwart's (`characterIgnores.basicOnly`, docs/phase7-wave5.md §3.22). */
  basicThwart = false,
  /**
   * The player removing the threat (`TriggerEvent removeThreat.playerId`): the player using the ability, an encounter
   * card's own action included. Null when unknown or when no player removes it (an encounter card's forced ability).
   */
  removingPlayerId: PlayerId | null = null,
  /** No player removes it although a player controls its source (`removeThreat.noPlayer`): no player-scoped rule applies. */
  noPlayer = false,
): "crisis" | "patrol" | "rule" | null {
  const acting = thwarterInstanceId ?? sourceInstanceId;
  // RRG 1.8 "Crisis Icon" (p. 14): "While at least one crisis icon is in play, threat cannot be removed from the main
  // scheme by player cards. … Abilities on encounter cards are not affected by the crisis icon." So a player using an
  // encounter card's own action is not stopped (owner decision Q66 = B, 2026-10-02, following the RRG). One effect may
  // step over that check ("ignoring any crisis icons in play"), but never over a `threatCannotBeRemoved` rule.
  const byPlayer = sourceInstanceId === null || controllerOf(state, sourceInstanceId) !== null;
  // With separate game areas, only the icons in the scheme's own area count (docs/phase7-wave2.md §3.1).
  if (
    !ignoreCrisis &&
    isProtectedMainScheme(state, deps, schemeId) &&
    byPlayer &&
    iconsInPlay(state, deps, "crisis", areaOfCard(state, schemeId)) > 0 &&
    !characterIgnores(state, deps, acting, "crisis", basicThwart)
  )
    return "crisis";
  if (byThwart && thwartingPlayerId) {
    const forbidden = thwartForbiddenOn(
      state,
      deps,
      { thwarterInstanceId, playerId: thwartingPlayerId, ignorePatrol, basic: basicThwart },
      schemeId,
    );
    if (forbidden) return forbidden;
  }
  // The removing player, for a `threatCannotBeRemoved` rule scoped with `player` (docs/phase7-wave3.md §3.26): the
  // thwart's player when this is a thwart, else the player using the ability (an encounter card's action included:
  // a rule on what a player may do binds that player whichever card they use), else the removing card's controller — the same reading `defeatingPlayerOf` (below) uses for
  // "the player who defeated this scheme".
  const removerId =
    thwartingPlayerId ?? removingPlayerId ?? (noPlayer ? null : sourcePlayerOf(state, { sourceInstanceId }));
  return threatCannotBeRemoved(state, deps, schemeId, byThwart, removerId) ? "rule" : null;
}

/**
 * Why this thwart cannot remove threat from `schemeId` right now (a crisis icon, an engaged patrol minion, a
 * `cannotThwart` or `threatCannotBeRemoved` rule), or null: the arguments `applyRemoveThreat` passes for the removal a
 * thwart makes. A scheme a player cannot thwart is not thwarted at all (RRG 1.8 "Patrol", p. 32: "that player cannot
 * … thwart the main scheme"; "Target", p. 43), so no `thwart` event is raised for it and nothing answers "after you
 * thwart" (owner decision, 2026-10-03: a zero-amount thwart is never raised for a blocked scheme).
 */
export function thwartBlockedOn(
  state: GameState,
  deps: EngineDeps,
  thwart: Pick<
    Extract<TriggerEvent, { kind: "thwart" }>,
    "thwarterInstanceId" | "playerId" | "ignoreCrisis" | "ignorePatrol" | "basic"
  >,
  schemeId: InstanceId,
): "crisis" | "patrol" | "rule" | null {
  return threatRemovalBlocked(
    state,
    deps,
    schemeId,
    thwart.thwarterInstanceId,
    true,
    thwart.ignoreCrisis === true,
    thwart.playerId,
    thwart.thwarterInstanceId,
    thwart.ignorePatrol === true,
    thwart.basic === true,
    thwart.playerId,
  );
}

function applyPlaceThreat(ctx: Ctx, event: Extract<TriggerEvent, { kind: "placeThreat" }>, frameId: FrameId): void {
  // The last of step one's placements checks every main scheme, whatever its own amount (docs/phase7-wave5.md §4.1 Q71).
  const closing = event.completionCheck === "closing";
  if (event.amount <= 0 || !getInstance(ctx.state, event.schemeInstanceId)) {
    if (closing) checkMainSchemeCompletion(ctx);
    return;
  }
  updateInstance(ctx, event.schemeInstanceId, (i) => ({ ...i, threat: i.threat + event.amount }));
  emit(ctx, {
    type: "threatPlaced",
    schemeInstanceId: event.schemeInstanceId,
    amount: event.amount,
    sourceInstanceId: event.sourceInstanceId,
  });
  addFrameVars(ctx, frameId, { amount: event.amount });
  addFrameVars(ctx, event.parentFrameId, { threatPlaced: event.amount });
  if (event.completionCheck === "deferred") return;
  if (closing || mainSchemeStateOf(ctx.state, event.schemeInstanceId)) checkMainSchemeCompletion(ctx);
}

/**
 * Who "the player who defeated this scheme" is: the player whose thwart this removal belongs to, else the player who
 * removed the threat (`removeThreat.playerId`: the player using the ability, a scheme's own Hero Action included), else
 * the controller of whatever removed it (an ally's or an event's own effect). Null for a removal no player made (an
 * encounter card's effect, or a player card's `noPlayer` removal).
 */
function defeatingPlayerOf(state: GameState, event: Extract<TriggerEvent, { kind: "removeThreat" }>): PlayerId | null {
  const parent = event.parentFrameId ? findFrame(state, event.parentFrameId) : undefined;
  if (parent?.kind === "event" && parent.event.kind === "thwart") return parent.event.playerId;
  if (event.playerId) return event.playerId;
  return sourcePlayerOf(state, event);
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
    thwart?.basic === true,
    event.playerId ?? null,
    event.noPlayer === true,
  );
  if (blocked) {
    emit(ctx, { type: "threatRemovalBlocked", schemeInstanceId: event.schemeInstanceId, reason: blocked });
    return;
  }
  const removed = Math.min(event.amount, scheme.threat);
  if (removed <= 0) return;
  // The crisis icons and patrol minions this thwart got past (docs/phase7-wave6.md §3.8), read before the removal
  // changes anything: a removal that was stopped anyway, or removed nothing, ignored nothing (§4.1 Q6).
  if (thwart && event.parentFrameId) {
    const ignoreCrisis = event.ignoreCrisis === true;
    const ignored = thwartBlockersIgnored(ctx.state, ctx.deps, {
      thwart,
      schemeInstanceId: event.schemeInstanceId,
      ignoreCrisis,
    });
    recordKeywordsIgnored(ctx, event.parentFrameId, ignored);
  }
  updateInstance(ctx, event.schemeInstanceId, (i) => ({ ...i, threat: i.threat - removed }));
  emit(ctx, {
    type: "threatRemoved",
    schemeInstanceId: event.schemeInstanceId,
    amount: removed,
    sourceInstanceId: event.sourceInstanceId,
    ...(event.noPlayer ? { noPlayer: true as const } : {}),
  });
  addFrameVars(ctx, frameId, { amount: removed });
  // A thwart's frame also reports `amount`, the key a plain removal reports, so a `bind` on a "(thwart)" ability's
  // `removeThreat` reads `<bind>.amount` whether or not the label made it a thwart.
  addFrameVars(ctx, event.parentFrameId, { threatRemoved: removed, ...(thwart ? { amount: removed } : {}) });
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
  // The attacked character, reported as `<bind>.target` and to the attacker's consequential damage as slot
  // `attack.target` whether or not the attack damages it ("each ally takes -1 consequential damage when attacking
  // attached minion", Coordinated Attack 33016; docs/phase7-wave6.md §3.31). `attack.damaged` names only a character
  // that took damage.
  addFrameSlots(ctx, frameId, { target: [event.targetInstanceId] });
  // "That attack gains overkill" (Hulk Smash) / "this attack gains piercing" (Piercing Strike): every way of granting
  // an attack keyword is folded in here, once, and stamped on the events the attack pushes. An interrupt's
  // `modifyAttack` records its grant as a var on this attack's own event frame, the same var an enemy attack reads
  // when it deals its damage (`enemy-activation.ts`).
  const attackFrame = findFrame(ctx.state, frameId);
  // "Uses their THW instead of their ATK" (Befuddle; `modifyBasicPower.useStat`, docs/phase7-wave6.md §3.32): a basic
  // attack dealing the attacker's THW with its THW modifiers, no ATK modifier (§4.1 Q22). A divided basic attack's
  // share (Wasp) was already split from ATK as the power was used, and is left as it is: no ruling covers Befuddle on
  // one share (open question, wave 6 §3.32).
  const useThw =
    event.basic === true &&
    (event.amount ?? null) === null &&
    attackFrame?.kind === "event" &&
    (attackFrame.vars.useThw ?? 0) > 0;
  // "Havok gets +1 ATK for this attack" (Havok, `storm` 36014): `modifyAttack.atkBonus` on this attack's own frame,
  // part of ATK, so it counts only when the attack deals the attacker's ATK (not an effect's fixed amount, not THW).
  const atkBonus = attackFrame?.kind === "event" ? (attackFrame.vars.atkBonus ?? 0) : 0;
  const computed = useThw
    ? profile?.thw
    : (event.amount ?? (profile === undefined ? undefined : Math.max(0, profile.atk + atkBonus)));
  if (computed === undefined) return;
  // "This attack deals 3 additional damage" (`modifyAttack.extraDamage`, docs/phase7-wave6.md §3.29): added after the
  // amount is computed (ATK, or the effect's amount with its `cardEffectBonus`), to this attack only.
  const extra = attackFrame?.kind === "event" ? (attackFrame.vars.extraDamage ?? 0) : 0;
  const amount = Math.max(0, computed + extra);
  const keywords = attackKeywordsOf(ctx.state, ctx.deps, {
    attackerInstanceId: event.attackerInstanceId,
    viaInstanceId: event.sourceInstanceId ?? null,
    basic: event.basic === true,
    ...(event.keywords ? { keywords: event.keywords } : {}),
    ...(attackFrame?.kind === "event" ? { vars: attackFrame.vars } : {}),
  });
  // The guard minions this attack got past (docs/phase7-wave6.md §3.8, §4.1 Q6), announced once the attack finishes.
  recordKeywordsIgnored(
    ctx,
    frameId,
    guardsIgnored(ctx.state, ctx.deps, event.attackerInstanceId, event.targetInstanceId, event.playerId),
  );
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

/** A basic recovery's healing: the identity heals damage equal to its current REC (RRG 1.8 "Recover", p. 36). */
export function healRecovery(ctx: Ctx, identityId: InstanceId): void {
  const rec = characterProfile(ctx.state, identityId, ctx.deps)?.rec ?? 0;
  healDamage(ctx, identityId, rec, identityId);
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

/**
 * Asks the thwarting player for the scheme's additional thwart cost, if it has one (`RuleSpec additionalThwartCost`,
 * docs/phase7-wave5.md §3.21): an effects frame above the thwart that spends the resources — declining cancels the
 * thwart, so its indirect damage is not taken either — and then deals the indirect damage to that player. The thwart
 * frame waits in its interrupt stage, marked as asked, and carries on when the cost frame is done. Returns true when
 * it pushed the cost frame.
 */
function askThwartCost(ctx: Ctx, frame: Frame<"event">): boolean {
  const event = frame.event;
  if (event.kind !== "thwart") return false;
  const cost = thwartCostFor(ctx.state, ctx.deps, event.schemeInstanceId);
  if (!cost) return false;
  setFrame(ctx, { ...frame, thwartCostAsked: true });
  // docs/phase7-wave5.md §4.1 Q30 (RRG 1.8 "Cost", p. 13: a "take damage" cost "is not considered paid unless all of
  // that damage was taken"): damage prevented or left unassigned cancels the thwart. This resolution-time question is
  // the fallback for a thwart effect, whose own cost was paid at play (`thwart-cost.ts`).
  const damage: EffectSpec[] =
    cost.indirectDamage > 0
      ? [
          {
            kind: "dealIndirectDamage",
            to: { kind: "controller" },
            amount: { kind: "const", value: cost.indirectDamage },
            bind: "thwartCostDamage",
          },
          {
            kind: "if",
            condition: {
              kind: "not",
              of: { kind: "varAtLeast", name: "thwartCostDamage.amount", amount: cost.indirectDamage },
            },
            then: [{ kind: "cancelTriggeringEvent" }],
          },
        ]
      : [];
  const effects: EffectSpec[] = cost.resources
    ? [
        { kind: "spendResources", player: { kind: "controller" }, resources: cost.resources, bind: "thwartCost" },
        {
          kind: "if",
          condition: { kind: "varAtLeast", name: "thwartCost.made", amount: 1 },
          then: damage,
          otherwise: [{ kind: "cancelTriggeringEvent" }],
        },
      ]
    : damage;
  emit(ctx, { type: "thwartCostAsked", schemeInstanceId: event.schemeInstanceId, playerId: event.playerId });
  pushEffects(ctx, {
    effects,
    selfInstanceId: event.schemeInstanceId,
    controllerId: event.playerId,
    event,
    eventFrameId: frame.frameId,
  });
  return true;
}

function applyPlayerThwart(
  ctx: Ctx,
  event: Extract<TriggerEvent, { kind: "thwart" }>,
  frameId: FrameId,
): boolean | void {
  // "Interrupt (thwart): When the villain schemes, reduce the amount of threat placed on the scheme by 1" (Emergency):
  // a thwart by the player's identity (RRG 1.8 "Labeled Ability", p. 26; owner decision, 2026-10-03) that removes no
  // threat. Its effect is the reduction, applied to the scheme activation it interrupts; "that thwart removes 1
  // additional threat" adds nothing to it (RRG 1.8 FAQ, p. 59: "Because Emergency only prevents threat and does not
  // remove any, Shrink will have no effect"). Patrol and `cannotThwart` stop it (it is a thwart of that scheme); a
  // crisis icon does not (no threat is removed; RRG 1.8 "Crisis Icon", p. 14).
  if (event.reducesThreatPlaced) {
    const forbidden = thwartForbiddenOn(ctx.state, ctx.deps, event, event.schemeInstanceId);
    if (forbidden) {
      emit(ctx, { type: "threatRemovalBlocked", schemeInstanceId: event.schemeInstanceId, reason: forbidden });
      return false;
    }
    addFrameVars(ctx, event.reducesThreatPlaced.activationFrameId, { threatBonus: -event.reducesThreatPlaced.amount });
    return;
  }
  const computed = thwartAmount(ctx.state, ctx.deps, event);
  if (computed === undefined) return;
  // The backstop for a scheme that became unthwartable after the thwart began (a patrol minion engaging during its
  // interrupt window): the thwart did not happen, so it has no "resolved" line and no response window.
  const blocked = thwartBlockedOn(ctx.state, ctx.deps, event, event.schemeInstanceId);
  if (blocked && getInstance(ctx.state, event.schemeInstanceId)) {
    emit(ctx, { type: "threatRemovalBlocked", schemeInstanceId: event.schemeInstanceId, reason: blocked });
    return false;
  }
  // "That thwart removes 1 additional threat" (`modifyThwart`, docs/phase7-wave6.md §3.55): added after the amount is
  // computed, to this thwart's one removal, so its checks and its responses see the total.
  const thwartFrame = findFrame(ctx.state, frameId);
  const extra = thwartFrame?.kind === "event" ? (thwartFrame.vars.extraThreat ?? 0) : 0;
  pushEvent(ctx, {
    kind: "removeThreat",
    schemeInstanceId: event.schemeInstanceId,
    amount: computed + extra,
    sourceInstanceId: event.thwarterInstanceId,
    playerId: event.playerId,
    parentFrameId: frameId,
    ...(event.ignoreCrisis ? { ignoreCrisis: true } : {}),
  });
}
