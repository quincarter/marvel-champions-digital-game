/**
 * Condition-triggered forced abilities (`AbilityTriggerSpec` `stateCheck`): "If there are no madness counters here,
 * flip Green Goblin and State of Madness." (docs/phase7-wave1.md §3.4).
 *
 * `runFlow` calls `checkStateTriggers` between every two frames, the way RRG 1.8 "Uses" (p. 46) discards a card the
 * moment its last counter goes, so the ability resolves before anything else continues (FAQ "Green Goblin (#1B)",
 * p. 59: the flip happens in the middle of an attack). The last observed value of each condition lives in
 * `GameState.stateChecks`, so the check is plain state: a replay re-derives it and a save carries it.
 *
 * A check is edge-triggered. One marked `fromEntering` (a standing "If …, discard this card") also resolves the first
 * time it is seen with its condition true, which for a card entering play is the moment it is in play: before any
 * interrupt or response to its entering play, and before anything else resolves (`pendingEntry`).
 */

import type { AbilityId } from "@mc/content";
import type { AbilityRegistry, RuleSpec } from "../abilities.js";
import {
  discardStatusCards,
  endLastingEffect,
  exhaustCard,
  giveStatus,
  setActiveVillain,
  type StatusDiscarded,
} from "../effects.js";
import { currentName, mainSchemeStageOf, mainSchemeStateOf, undefeatedVillains } from "../query.js";
import { type Ctx, emit, moveCard, pushFrames, updateFrame, updateInstance } from "../ctx.js";
import { statusCapacity } from "../keywords.js";
import type { InstanceId } from "../ids.js";
import {
  activeAbilityRefs,
  activeRules,
  attachmentHolds,
  cardsInPlay,
  controllerOf,
  evaluate,
  focusedMainSchemeId,
  matchesQuery,
} from "../select.js";
import type { StackFrame } from "../stack.js";
import type { GameState } from "../state.js";
import { cannotBeDefeated } from "../rules.js";
import { limitReached } from "./ability.js";
import { atZero, checkDefeats } from "./defeat.js";
import { settleUpgradeControl } from "./attach.js";
import { checkAllyLimits, checkPlayerSideSchemeLimit, usesCountersOnEntering } from "./enter-play.js";
import { abilityFrame } from "./frames.js";
import { announceStatusDiscarded } from "./status-discarded.js";

const registriesWithChecks = new WeakMap<AbilityRegistry, boolean>();
const registriesWithRuleKind = new Map<RuleSpec["kind"], WeakMap<AbilityRegistry, boolean>>();

/**
 * Whether any printed constant in the registry declares a rule of `kind`. The continuous rules below are scanned between
 * frames, so a game whose registry has none skips them.
 */
/** A rule the scenario imposes without a card (§3.40 of wave 4) counts as present too. */
const scenarioHasRule = (ctx: Ctx, kind: RuleSpec["kind"]): boolean =>
  (ctx.state.scenarioRules.rules ?? []).some((rule) => rule.kind === kind);

function hasRuleKind(registry: AbilityRegistry, kind: RuleSpec["kind"]): boolean {
  let byRegistry = registriesWithRuleKind.get(kind);
  if (!byRegistry) {
    byRegistry = new WeakMap();
    registriesWithRuleKind.set(kind, byRegistry);
  }
  let known = byRegistry.get(registry);
  if (known === undefined) {
    known = Object.values(registry).some(
      (definition) =>
        definition.trigger.kind === "constant" && (definition.trigger.rules ?? []).some((rule) => rule.kind === kind),
    );
    byRegistry.set(registry, known);
  }
  return known;
}

/** Whether any ability in the registry is a state check; games without one skip the scan entirely. */
function hasStateChecks(registry: AbilityRegistry): boolean {
  let known = registriesWithChecks.get(registry);
  if (known === undefined) {
    known = Object.values(registry).some((definition) => definition.trigger.kind === "stateCheck");
    registriesWithChecks.set(registry, known);
  }
  return known;
}

/**
 * Observes every live state-check ability on a card in play. One whose condition changed from false to true is put
 * on the stack, in play-area order, and so is a `fromEntering` check seen for the first time with its condition true
 * (at once for a card entering play, ahead of that event's windows); the rest only have their value recorded. Returns true when it pushed a frame.
 */
export function checkStateTriggers(ctx: Ctx): boolean {
  // A continuous rule rather than an ability, checked in the same place and for the same reason: RRG 1.8 "Ally
  // Limit" (p. 7) applies the moment a player "ever" controls too many allies. Asking for the discard is the result.
  if (checkAllyLimits(ctx)) return true;
  // …and so does the player side scheme limit: RRG 1.8 p. 34, "If there are **ever** more player side schemes in play
  // than the limit, the first player chooses and discards" (docs/phase7-wave7.md §3.2).
  if (checkPlayerSideSchemeLimit(ctx, null)) return true;
  // The same kind of rule: a character that cannot have a status card sheds the ones it holds (stalwart; docs/phase7-
  // wave3.md §3.7). Nothing to put on the stack, so the flow carries on.
  clearForbiddenStatuses(ctx);
  // …and a constant "you are confused" keeps its character holding the status (White Queen; docs/phase7-wave6.md §3.9).
  applyKeptStatuses(ctx);
  // …and a constant "exhaust each ally you control" keeps those cards exhausted (docs/phase7-wave7.md §4.1, 44032).
  applyKeptExhaustion(ctx);
  // …and a card the first player controls follows the first player token (the Milano; §3.13).
  applyFirstPlayerControl(ctx);
  // …and an upgrade on a card another player controls is controlled by that player (RRG 1.8 p. 31).
  applyHostedUpgradeControl(ctx);
  // …and a lasting effect bound to an attachment ends once that card is off that host (§3.50 of wave 6).
  endDetachedLastingEffects(ctx);
  // …and the active villain is the villain of the main scheme Focused Defense is attached to (§3.2 of wave 4).
  applyFocusedActiveVillain(ctx);
  // …and a character at zero hit points that "cannot be defeated" no longer is defeated (wave 7 §4.1 Q21).
  if (checkDefeatProtectionEnded(ctx)) return true;
  if (!hasStateChecks(ctx.deps.abilities)) return false;
  const observed: Record<string, boolean> = {};
  const firing: { readonly instanceId: InstanceId; readonly abilityId: AbilityId }[] = [];
  for (const instanceId of cardsInPlay(ctx.state)) {
    for (const ref of activeAbilityRefs(ctx.state, instanceId, ctx.deps)) {
      const definition = ctx.deps.abilities[ref.id];
      if (definition?.trigger.kind !== "stateCheck") continue;
      const key = `${instanceId}:${ref.id}`;
      const fromEntering = definition.trigger.fromEntering === true;
      // A `fromEntering` check reads its card as it enters play: with the counters its uses keywords are about to place.
      const entry = fromEntering ? pendingEntry(ctx, instanceId) : undefined;
      const now = evaluate(entry ? withUsesCounters(ctx, instanceId) : ctx.state, definition.trigger.when, {
        selfInstanceId: instanceId,
        controllerId: controllerOf(ctx.state, instanceId),
        event: null,
        bindings: {},
        deps: ctx.deps,
      });
      const known = ctx.state.stateChecks[key];
      observed[key] = now;
      // A change from false to true fires. A first observation only records, unless the check is `fromEntering`: then a
      // first observation that is true fires too, since the condition holds as the ability becomes active (RRG 1.8
      // "Ability", p. 4, constant abilities). Recorded true, neither fires again until it has been false.
      const becameTrue = known === false || (fromEntering && known === undefined);
      if (now && becameTrue && !limitReached(ctx.state, instanceId, ref.id, definition)) {
        firing.push({ instanceId, abilityId: ref.id });
        // Resolved before the card's entering play is initiated: should it take the card out of play, that event has
        // nothing left to offer (`StackFrame.standingCheckResolved`, read by `executeEventFrame`).
        if (entry?.stage === "interrupts") {
          updateFrame(ctx, entry.frameId, (f) => (f.kind === "event" ? { ...f, standingCheckResolved: true } : f));
        }
      }
    }
  }
  if (!sameValues(observed, ctx.state.stateChecks)) ctx.state = { ...ctx.state, stateChecks: observed };
  if (firing.length === 0) return false;
  const frames: StackFrame[] = firing.map(({ instanceId, abilityId }) =>
    abilityFrame(
      ctx,
      {
        instanceId,
        abilityId,
        // A card nobody controls acts for the first player, as scheme and villain abilities do.
        controllerId: controllerOf(ctx.state, instanceId) ?? ctx.state.firstPlayerId,
        forced: true,
        fromHand: false,
      },
      null,
      null,
    ),
  );
  pushFrames(ctx, frames);
  return true;
}

/**
 * The `cardEntersPlay` event of `id` whose enter-play keywords have not been applied yet (its `apply` step places them,
 * `resolve/event.ts`): the card is in play, and what it "enters play with" by keyword is still to come. A flip's new
 * face has one too (`announceNewFaceEntersPlay`).
 *
 * A `fromEntering` check is first read here, the moment its card is in play (RRG 1.8 "Ability", p. 4: a constant
 * ability "becomes active as soon as its card enters play"; owner ruling 2026-10-05, docs/phase7-wave7.md §4.1: E.V.A.
 * with no Fantomex is discarded immediately). Until 2026-10-05 the first read waited for this event's windows to close.
 */
function pendingEntry(ctx: Ctx, id: InstanceId): Extract<StackFrame, { kind: "event" }> | undefined {
  for (const frame of ctx.state.stack) {
    if (
      frame.kind === "event" &&
      frame.event.kind === "cardEntersPlay" &&
      frame.event.instanceId === id &&
      (frame.stage === "interrupts" || frame.stage === "apply")
    )
      return frame;
  }
  return undefined;
}

/**
 * The state a `fromEntering` condition is read against while its card's entry is pending: the card holding the
 * counters its uses keywords place as it enters play (RRG 1.8 "Uses", p. 46), which are part of entering play, so "no
 * counters here" is not true of a card only because its own are a step away. Nothing is written: the placement itself
 * stays the event's apply step.
 *
 * Only keyword placements are known ahead of time. Counters a card gets from a scripted forced response to its own
 * entering play ("enters play with N counters" as an ability) are not there yet when a `fromEntering` condition is
 * read, so a card with both needs that placement declared where this function can see it.
 */
function withUsesCounters(ctx: Ctx, id: InstanceId): GameState {
  const instance = ctx.state.instances[id];
  const placed = Object.entries(usesCountersOnEntering(ctx.state, ctx.deps, id));
  if (!instance || placed.length === 0) return ctx.state;
  const counters = { ...instance.counters };
  for (const [counterType, amount] of placed) counters[counterType] = (counters[counterType] ?? 0) + amount;
  return { ...ctx.state, instances: { ...ctx.state.instances, [id]: { ...instance, counters } } };
}

/**
 * RRG 1.8 "Stalwart" (p. 40): "If a character gains the stalwart keyword while they have a stunned and/or confused
 * status card, each stunned and/or confused status card is removed from that character." The same holds for a
 * `cannotHaveStatus` rule ("Ronan the Accuser cannot be stunned") that starts to apply. `statusCapacity` is what both
 * read, so a character holding more of a status than it may is trimmed to that. Only characters already holding a
 * status are looked at, so a board with none costs one pass over the instances in play.
 */
function clearForbiddenStatuses(ctx: Ctx): void {
  const discarded: StatusDiscarded[] = [];
  for (const id of cardsInPlay(ctx.state)) {
    const held = ctx.state.instances[id]?.statuses;
    if (!held || held.stunned + held.confused + held.tough === 0) continue;
    for (const status of ["stunned", "confused", "tough"] as const) {
      const allowed = statusCapacity(ctx.state, id, status, ctx.deps);
      if ((ctx.state.instances[id]?.statuses[status] ?? 0) <= allowed) continue;
      discarded.push(...discardStatusCards(ctx, id, status, "cannotHave", allowed));
    }
  }
  // Shed status cards are discarded, so announced, in one window (docs/phase7-wave6.md §3.5); never-held ones are not.
  announceStatusDiscarded(ctx, discarded);
}

/**
 * "While White Queen is engaged with you, you are confused." (`RuleSpec keepsGivingStatus`; docs/phase7-wave6.md §3.9).
 * A level, not an edge: every pass between frames tops each matching character up to its `statusCapacity`, so the
 * rule's first observation gives the card (White Queen entering play engaged with you confuses you at once) and a
 * card spent by a thwart attempt comes back before the next frame (RRG 1.8 FAQ "White Queen (#56)", p. 63: "will
 * immediately be given more"). Capacity is read per card given, so steady gets two and stalwart none; the stunned or
 * confused card counts once, however many rules ask. Nothing is taken back when a rule stops applying (the same FAQ:
 * "When White Queen leaves play, any confused status cards remain"). No choice can be pending here (`runFlow` stops on
 * one before this check), so a card spent while a prompt is open comes back once it is answered.
 */
function applyKeptStatuses(ctx: Ctx): void {
  if (
    !hasRuleKind(ctx.deps.abilities, "keepsGivingStatus") &&
    !scenarioHasRule(ctx, "keepsGivingStatus") &&
    !ctx.state.lastingEffects.some((e) => e.kind === "ruleGrant" && e.rule.kind === "keepsGivingStatus")
  )
    return;
  for (const { rule, speakerContext } of activeRules(ctx.state, ctx.deps, "keepsGivingStatus")) {
    // A placement like any other (`TriggerEvent statusPlaced`, docs/phase7-wave7.md §3.27): the card whose constant it
    // is placed it, and no player did.
    const by = { sourceInstanceId: speakerContext.selfInstanceId, playerId: null };
    for (const id of cardsInPlay(ctx.state)) {
      if (!matchesQuery(ctx.state, id, rule.target, speakerContext)) continue;
      while (giveStatus(ctx, id, rule.status, by, "constant"));
    }
  }
}

/**
 * "Exhaust each ally you control." as a constant (`RuleSpec keepsExhausted`; RRG 1.8 "Ability", p. 4: text with no
 * bold timing trigger is a constant ability, active while its card is in play). A level like `applyKeptStatuses`: every
 * pass between frames exhausts each matching ready card in play, so the rule's first observation exhausts the cards
 * already there, and a card that enters play or changes control into the query is exhausted before the next frame
 * resolves. An exhausted card is left alone (RRG 1.8 "Exhausted", p. 19), so each card is logged once per readying.
 * Nothing is readied when the rule stops applying.
 */
function applyKeptExhaustion(ctx: Ctx): void {
  if (
    !hasRuleKind(ctx.deps.abilities, "keepsExhausted") &&
    !scenarioHasRule(ctx, "keepsExhausted") &&
    !ctx.state.lastingEffects.some((e) => e.kind === "ruleGrant" && e.rule.kind === "keepsExhausted")
  )
    return;
  for (const { rule, speakerContext } of activeRules(ctx.state, ctx.deps, "keepsExhausted")) {
    for (const id of cardsInPlay(ctx.state)) {
      if (ctx.state.instances[id]?.exhausted !== false) continue;
      if (!matchesQuery(ctx.state, id, rule.target, speakerContext)) continue;
      exhaustCard(ctx, id);
    }
  }
}

/**
 * "The first player controls the Milano." (`controlledByFirstPlayer`; docs/phase7-wave3.md §3.13): a matching card in
 * play is moved to the first player's play area under their control whenever it is anywhere else — after the first
 * player token passes (RRG 1.8 "First Player", p. 19), after a first player is eliminated, and if it entered play under
 * someone else. Moving between play areas is not leaving play, so a permanent card moves too.
 *
 * The same for a character (an ally from an encounter set, docs/phase7-wave7.md §3.25): RRG 1.8 "Ownership and Control"
 * (p. 31), "If a character changes control while it is in play, it remains in the same state (i.e., readied or
 * exhausted, damaged or not, etc.) and is moved to its new controller's play area", so nothing on it is touched; its
 * upgrades follow (`applyHostedUpgradeControl`). Player elimination calls this itself the moment the token passes
 * (`eliminatePlayer`), before the eliminated player's play area is cleared.
 */
export function applyFirstPlayerControl(ctx: Ctx): void {
  if (!hasRuleKind(ctx.deps.abilities, "controlledByFirstPlayer") && !scenarioHasRule(ctx, "controlledByFirstPlayer"))
    return;
  const first = ctx.state.firstPlayerId;
  for (const { rule, context } of activeRules(ctx.state, ctx.deps, "controlledByFirstPlayer")) {
    for (const id of cardsInPlay(ctx.state)) {
      if (!matchesQuery(ctx.state, id, rule.target, context)) continue;
      const from = controllerOf(ctx.state, id);
      if (from === first) continue;
      const attached = ctx.state.instances[id]?.attachedTo ?? null;
      if (attached === null) moveCard(ctx, id, { kind: "playArea", playerId: first });
      updateInstance(ctx, id, (instance) => ({ ...instance, controllerId: first }));
      emit(ctx, { type: "controllerChanged", instanceId: id, from, to: first, reason: "firstPlayer" });
    }
  }
}

/**
 * RRG 1.8 "Ownership and Control" (p. 31): "Upgrades on a card that changes control also change control to the same new
 * controller", and an upgrade attached to a card a player controls is controlled by that player. Each route that
 * attaches settles it at once (`settleUpgradeControl`); this keeps it true when the host changes hands instead (the
 * Milano following the first player, a detached card taken under control, a permanent upgrade re-attached when its
 * host's player is eliminated). A host no player controls leaves the upgrade's controller as it is.
 */
function applyHostedUpgradeControl(ctx: Ctx): void {
  for (const id of cardsInPlay(ctx.state)) {
    if (ctx.state.instances[id]?.attachedTo == null) continue;
    settleUpgradeControl(ctx, id, ctx.state.instances[id]!.controllerId);
  }
}

/**
 * "For as long as Touched stays on that character" (docs/phase7-wave6.md §3.50, §4.1 Q28; `LastingEffect.whileAttached`):
 * an effect whose card is no longer attached to its host ends here, so the state and the log show the end. Every read
 * already ignores it from the moment the card moves (`lastingReaches`); this only records it.
 */
function endDetachedLastingEffects(ctx: Ctx): void {
  for (const effect of [...ctx.state.lastingEffects]) {
    if (effect.whileAttached && !attachmentHolds(ctx.state, effect.whileAttached)) {
      endLastingEffect(ctx, effect.id, "detached");
    }
  }
}

/**
 * Focused Defense (Tower Defense, `mts` 21101): "The villain who matches the attached scheme is the active villain."
 * (`RuleSpec focusedMainScheme`; docs/phase7-wave4.md §3.2.) The villain whose title the scheme's `villainOf` names, if
 * it is undefeated, takes the active counter the moment the attachment moves ("After the player phase ends, attach this
 * card to the other main scheme").
 */
function applyFocusedActiveVillain(ctx: Ctx): void {
  if (!hasRuleKind(ctx.deps.abilities, "focusedMainScheme") && !scenarioHasRule(ctx, "focusedMainScheme")) return;
  const schemeId = focusedMainSchemeId(ctx.state, ctx.deps);
  const scheme = schemeId ? mainSchemeStateOf(ctx.state, schemeId) : undefined;
  if (!scheme) return;
  const name = mainSchemeStageOf(ctx.state, scheme).villainOf;
  if (name === undefined) return;
  const villain = undefeatedVillains(ctx.state).find((v) => currentName(ctx.state, v.instanceId) === name);
  if (villain && villain.instanceId !== ctx.state.activeVillainId)
    setActiveVillain(ctx, villain.instanceId, "focusedScheme");
}

/**
 * "X cannot be defeated" stopped covering a character it kept in play at zero or fewer remaining hit points
 * (`GameState.heldAtZero`): the card granting the rule left play, or its `while` ended (docs/phase7-wave7.md §3.34).
 * RRG 1.8 "Defeat" (p. 15), "If a character has zero or fewer remaining hit points … it is defeated", applies again the
 * moment nothing forbids it, so the defeat sweep runs here, between frames, before anything else continues. It carries
 * no damage, so the defeat has no defeating player and no defeating card: "after you defeat" is not offered and
 * `PlayerRef defeatingPlayer` names nobody (owner decision §4.1 Q21; the sibling of a removal no player makes, Q2). A
 * villain's stage falls as any does (RRG 1.8 "Villain Defeat", p. 47): the next stage is revealed, or the game is won.
 *
 * A held character healed above zero, or out of play, is dropped and nothing happens when the rule ends. A rule that
 * passes from one card to another without a gap (the granting card flips to a face that grants it too) never stops
 * covering the character. Returns true when the sweep put a defeat on the stack or ended the game.
 */
function checkDefeatProtectionEnded(ctx: Ctx): boolean {
  const held = ctx.state.heldAtZero ?? [];
  if (held.length === 0) return false;
  const inPlay = cardsInPlay(ctx.state);
  const stillAtZero = held.filter((id) => inPlay.includes(id) && atZero(ctx, id));
  const kept = stillAtZero.filter((id) => cannotBeDefeated(ctx.state, ctx.deps, id));
  if (kept.length !== held.length) ctx.state = { ...ctx.state, heldAtZero: kept };
  const released = stillAtZero.filter((id) => !kept.includes(id));
  if (released.length === 0) return false;
  for (const id of released) {
    emit(ctx, { type: "defeatProtectionEnded", instanceId: id, cardId: ctx.state.instances[id]!.cardId });
  }
  const depth = ctx.state.stack.length;
  checkDefeats(ctx);
  return ctx.state.stack.length > depth || ctx.state.outcome !== null;
}

function sameValues(a: Readonly<Record<string, boolean>>, b: Readonly<Record<string, boolean>>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => b[key] === a[key]);
}
