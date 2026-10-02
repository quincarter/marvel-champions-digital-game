/** Keywords and limits that resolve as a card enters play. */

import { type Ctx, emit, requestChoice } from "../ctx.js";
import { addCounters, giveStatus } from "../effects.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { hasKeyword, keywordsOf } from "../keywords.js";
import { cardOf, getInstance, getPlayer, isMinion, mustCardOf, mustPlayer } from "../query.js";
import {
  allyLimitFor,
  BASE_ALLY_LIMIT,
  BASE_RESTRICTED_LIMIT,
  excludedFromAllyLimit,
  restrictedLimitFor,
} from "../rules.js";
import { cardsInPlay, controllerOf, isAlly, restrictedCardsOf, traitsOf } from "../select.js";
import type { StackFrame } from "../stack.js";
import { activateEnemy } from "../villain/phase.js";
import { defeatedAwaitingLeave } from "./defeat.js";

/**
 * RRG 1.8 "Ally Limit" (p. 7): "if a player **ever** controls a number of allies greater than their ally limit in play,
 * they must immediately choose and discard". An ally entering play is only one way over the limit
 * (`applyEnterPlayKeywords`). The limit can also drop with no ally entering: a card that raises it leaves play, or a
 * conditional increase stops applying (Avengers Tower, once one of your allies loses the Avenger trait). `runFlow` runs
 * this between frames, through `checkStateTriggers`. Returns true when it asked a player to discard.
 */
export function checkAllyLimits(ctx: Ctx): boolean {
  if (ctx.state.pendingChoice) return false;
  for (const player of ctx.state.players) {
    if (checkAllyLimit(ctx, player.playerId)) return true;
  }
  return false;
}
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { announce, base, eventFrame } from "./frames.js";
import { eachTimeEffectsFor, hasCandidates, heard } from "./triggers.js";

/**
 * The keywords that resolve as a card enters play: toughness places a tough
 * status card, uses places its all-purpose counters, and restricted makes the
 * controller check that they still control at most two restricted cards.
 */
export function applyEnterPlayKeywords(ctx: Ctx, id: InstanceId): void {
  for (const keyword of keywordsOf(ctx.state, id, ctx.deps)) {
    if (keyword.name === "toughness") giveStatus(ctx, id, "tough");
    // "Uses (2[per_hero] ammo counters)": RRG 1.8 "Per Player Icon" (p. 32); docs/phase7-wave3.md §1.3.
    if (keyword.name === "uses")
      addCounters(
        ctx,
        id,
        keyword.counterType,
        keyword.count + (keyword.countPerPlayer ?? 0) * ctx.state.startingPlayerCount,
      );
  }
  if (hasKeyword(ctx.state, id, "restricted", ctx.deps)) checkRestricted(ctx, controllerOf(ctx.state, id));
  if (cardOf(ctx.state, id)?.type === "ally") checkAllyLimit(ctx, controllerOf(ctx.state, id));
}

/**
 * RRG "Ally Limit": allies may be played past the limit, but the controller then
 * immediately discards down to it — before abilities that resolve on entering play.
 * Returns true when it asked the player to discard.
 */
function checkAllyLimit(ctx: Ctx, playerId: PlayerId | null): boolean {
  if (!playerId || ctx.state.pendingChoice) return false;
  const allies = mustPlayer(ctx.state, playerId).playArea.filter(
    (id) =>
      isAlly(ctx.state, id) &&
      controllerOf(ctx.state, id) === playerId &&
      !excludedFromAllyLimit(ctx.state, ctx.deps, id),
  );
  // Every ally limit rule is an increase on the base of three, so three allies or fewer is never over the limit.
  // Skipping the rule scan keeps this cheap when it runs between frames.
  if (allies.length <= BASE_ALLY_LIMIT) return false;
  const limit = allyLimitFor(ctx.state, ctx.deps, playerId);
  if (allies.length <= limit) return false;
  requestChoice(ctx, {
    playerId,
    prompt: { kind: "discardOverAllyLimit", limit },
    options: allies.map((id) => ({
      optionId: id,
      label: mustCardOf(ctx.state, id).name,
      ref: { kind: "card", instanceId: id } as const,
    })),
    minSelections: allies.length - limit,
    maxSelections: allies.length - limit,
  });
  return true;
}

/**
 * RRG "Restricted": playing a third is illegal (see `playCard`), but an effect
 * can still put one into play — then the controller discards down to two.
 */
function checkRestricted(ctx: Ctx, playerId: PlayerId | null): void {
  if (!playerId) return;
  const held = restrictedCardsOf(ctx.state, playerId, ctx.deps);
  if (held.length <= BASE_RESTRICTED_LIMIT) return;
  // Two, or more with "you can control 1 additional … restricted" (`restrictedLimit`, docs/phase7-wave3.md §3.22).
  const limit = restrictedLimitFor(ctx.state, ctx.deps, playerId, held);
  if (held.length <= limit) return;
  requestChoice(ctx, {
    playerId,
    prompt: { kind: "discardRestricted", limit },
    options: held.map((id) => ({
      optionId: id,
      label: mustCardOf(ctx.state, id).name,
      ref: { kind: "card", instanceId: id } as const,
    })),
    minSelections: held.length - limit,
    maxSelections: held.length - limit,
  });
}

/**
 * Announces a card entering play. The enter-play keywords are the event's own apply step (`resolve/event.ts`), not
 * something done before the announcement, so an "Interrupt: when X enters play" ability gets a window first.
 */
export function enterPlay(ctx: Ctx, id: InstanceId, playerId: PlayerId | null): void {
  announce(ctx, { kind: "cardEntersPlay", instanceId: id, playerId });
}

/** RRG "Quickstrike": after this minion engages a hero-form player, it attacks them. */
export function quickstrikeAttack(state: GameState, id: InstanceId): TriggerEvent | null {
  if (cardOf(state, id)?.type !== "minion") return null;
  if (!hasKeyword(state, id, "quickstrike")) return null;
  const engagedWith = getInstance(state, id)?.engagedWith;
  if (!engagedWith) return null;
  const player = getPlayer(state, engagedWith);
  if (!player || player.identity.form !== "hero") return null;
  return {
    kind: "enemyAttack",
    enemyInstanceId: id,
    attackedPlayerId: player.playerId,
    targetPlayerId: player.playerId,
    targetInstanceId: player.identity.instanceId,
  };
}

/*
 * RRG 1.8 "Teamwork (Trait)" (p. 43): "After a minion with teamwork enters play and engages a player, if there is at
 * least one other minion that shares the specified trait in play, the minion that just entered play activates against
 * the player it is engaged with." Only that minion activates, not every minion sharing the trait (docs/phase7-wave6.md
 * §4.1 Q1, the RRG over the MC32 rulebook's p. 3 wording).
 *
 * It is placed where quickstrike is: after the minion's `cardEntersPlay` frame, and on a reveal before its When Revealed
 * (§4.1 Q2, the user's ruling, following ruling Feb 28, 2026 (4) answer 2 for quickstrike, "triggers upon engagement";
 * RRG 1.8 p. 43 itself puts teamwork after the When Revealed). The condition is checked as the keyword resolves, not as
 * it is queued, and a minion already defeated and waiting to leave play does not count (`defeatedAwaitingLeave`, FAQ
 * "Fabian Cortez (#159)", p. 64).
 */

/** The teamwork step for a minion that entered play engaged with a player, or null when it has no teamwork. */
export function teamworkFrame(ctx: Ctx, id: InstanceId): StackFrame | null {
  if (!isMinion(ctx.state, id) || !getInstance(ctx.state, id)?.engagedWith) return null;
  if (!hasKeyword(ctx.state, id, "teamwork", ctx.deps)) return null;
  return {
    ...base(ctx),
    kind: "effects",
    effects: [{ kind: "resolveTeamwork", minion: id }],
    cursor: 0,
    bindings: {},
    vars: {},
    scopedPlayerId: null,
    selfInstanceId: id,
    controllerId: null,
    event: null,
    eventFrameId: null,
  };
}

/** The `resolveTeamwork` step: the minion activates against its engaged player if another minion shares the trait. */
export function resolveTeamwork(ctx: Ctx, id: InstanceId): void {
  const inPlay = cardsInPlay(ctx.state);
  if (!inPlay.includes(id) || !isMinion(ctx.state, id) || defeatedAwaitingLeave(ctx.state, id)) return;
  const engagedWith = getInstance(ctx.state, id)?.engagedWith;
  const player = engagedWith ? getPlayer(ctx.state, engagedWith) : undefined;
  if (!player || player.eliminated) return;
  const others = inPlay.filter(
    (other) => other !== id && isMinion(ctx.state, other) && !defeatedAwaitingLeave(ctx.state, other),
  );
  for (const keyword of keywordsOf(ctx.state, id, ctx.deps)) {
    if (keyword.name !== "teamwork") continue;
    const trait = keyword.sharedTrait;
    if (!others.some((other) => traitsOf(ctx.state, other, ctx.deps).includes(trait))) continue;
    emit(ctx, { type: "keywordResolved", keyword: "teamwork", instanceId: id, playerId: player.playerId, trait });
    activateEnemy(ctx, id, player.playerId);
    return;
  }
}

type MinionEngaged = Extract<TriggerEvent, { kind: "minionEngaged" }>;

/** The engagement a minion now engaged with a player represents, or null for a card that is not an engaged minion. */
export function engagementOf(state: GameState, id: InstanceId): MinionEngaged | null {
  const playerId = getInstance(state, id)?.engagedWith;
  if (!playerId || !isMinion(state, id)) return null;
  return { kind: "minionEngaged", minionInstanceId: id, playerId };
}

/*
 * Engagement timing. RRG 1.8 "Engage" (p. 18): a minion entering play in a player's play area engages that player, and
 * an ability telling a player to engage a minion counts as it engaging them. "Interrupt" (p. 25): an interrupt
 * "resolves immediately before that triggering condition resolves"; "Response" (p. 38): a response resolves after it.
 * So "Hero Interrupt: When you engage a minion" (Anticipation) and "Interrupt: When a minion would engage a player"
 * (Target Spotter, whose FAQ entry, RRG 1.8 p. 65, says it "interrupts the engagement of that minion") get a window before
 * anything that follows from the engagement: the minion's enter-play keywords, its When Revealed, quickstrike, and the
 * "after you engage" responses (Thor's "Have at Thee", which keep their place after the keywords: ruling Jan 17, 2026 (3)
 * answer 2).
 *
 * Like `cardEntersPlay`'s own interrupt window (the card is already in its zone), the minion's `engagedWith` is already
 * set while the window is open: the engine records the move first and runs the windows around it. No printed interrupt
 * to engagement reads whether the minion is engaged yet, so that is not observable today; a card whose interrupt
 * needed the minion not yet engaged would need the engagement deferred into the event's apply step.
 *
 * Three shapes:
 *   - entering play (reveal, `putIntoPlay`, `putIntoPlayFacedown`, a flip to a minion face): the engagement is one of
 *     the triggering conditions of the minion entering play (RRG 1.8 "Triggering Condition", p. 45), so its
 *     interrupts share the `cardEntersPlay` interrupt window (`engagingAsItEnters`), and its responses are announced
 *     after the keywords (`engagedEvent` in `apply-effect.ts`);
 *   - an already-in-play minion engaging (the `engage` effect, an eliminated player's minions passing on): one
 *     `minionEngaged` event frame with both windows (`engagementFrame`).
 */

/**
 * The engagement whose interrupts share an entering card's interrupt window: the `cardEntersPlay` of a minion that
 * entered play engaged with a player, when an interrupt to that engagement could resolve now.
 */
export function engagingAsItEnters(ctx: Ctx, event: TriggerEvent): MinionEngaged | null {
  if (event.kind !== "cardEntersPlay") return null;
  const engaging = engagementOf(ctx.state, event.instanceId);
  return engaging && hasCandidates(ctx.state, ctx.deps, engaging, "interrupt") ? engaging : null;
}

/** Whether anything answers a minion's engagement in the response window ("After you engage a minion"). */
export function engagementHeardAfter(ctx: Ctx, event: MinionEngaged): boolean {
  return (
    hasCandidates(ctx.state, ctx.deps, event, "response") || eachTimeEffectsFor(ctx.state, ctx.deps, event).length > 0
  );
}

/**
 * The event frame for an in-play minion now engaged with a player: interrupts, then responses, when an interrupt to the
 * engagement could resolve; responses only (an announcement, as before interrupts to engagement existed) when only
 * responses could; nothing when nothing listens.
 */
export function engagementFrame(ctx: Ctx, id: InstanceId): StackFrame | null {
  const event = engagementOf(ctx.state, id);
  if (!event || !heard(ctx.state, ctx.deps, event)) return null;
  const frame = eventFrame(ctx, event);
  const interrupts = hasCandidates(ctx.state, ctx.deps, event, "interrupt");
  return interrupts && frame.kind === "event" ? { ...frame, stage: "interrupts" } : frame;
}
