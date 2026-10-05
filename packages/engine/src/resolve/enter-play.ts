/** Keywords and limits that resolve as a card enters play. */

import { type Ctx, emit, moveCard, requestChoice, updateInstance } from "../ctx.js";
import { addCounters, giveStatus, leavingPlayPending, permanentStopsLeaving } from "../effects.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { hasKeyword, keywordsOf, keywordTotal } from "../keywords.js";
import { cardOf, getInstance, getPlayer, isMinion, mustCardOf, mustPlayer, startingThreatOf } from "../query.js";
import {
  allyLimitFor,
  allyLimitMayBeReduced,
  BASE_ALLY_LIMIT,
  BASE_RESTRICTED_LIMIT,
  cannotLeavePlay,
  excludedFromAllyLimit,
  excludedFromPlayerSideSchemeLimit,
  playerSideSchemeLimit,
  restrictedLimitFor,
} from "../rules.js";
import { cardsInPlay, controllerOf, isAlly, restrictedCardsOf, traitsOf } from "../select.js";
import { playFrameOf, type StackFrame } from "../stack.js";
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
import { announce, base, eventFrame, pushEvent } from "./frames.js";
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
  // The player side scheme limit (RRG 1.8 p. 34; docs/phase7-wave7.md §3.2) is checked here, beside the ally limit:
  // every player side scheme entering play, played or put into play (`playerSideSchemeEntersPlay`), reaches this step.
  if (cardOf(ctx.state, id)?.type === "player_side_scheme") checkPlayerSideSchemeLimit(ctx, id);
  placeHinder(ctx, id);
}

/**
 * RRG 1.8 "Hinder X" (p. 22): "This card enters play with X threat on it", on any card type (Paparazzi, an obligation;
 * docs/phase7-wave6.md §3.59, §4 Q34). One placement, as the card's entering play resolves, so its "enters play"
 * responses see the threat. A scheme is left to its own entry, which places its hinder with its starting threat in one
 * placement (`enterPlayOnReveal`, `flipToOtherFace`; docs/phase7-wave3.md §3.3).
 */
function placeHinder(ctx: Ctx, id: InstanceId): void {
  const type = cardOf(ctx.state, id)?.type;
  if (type === "main_scheme" || type === "side_scheme" || type === "player_side_scheme") return;
  const amount = keywordTotal(ctx.state, id, "hinder", ctx.deps);
  if (amount > 0) pushEvent(ctx, { kind: "placeThreat", schemeInstanceId: id, amount, sourceInstanceId: null });
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
  // Unless something can reduce an ally limit ("Reduce your ally limit by 2", The Odd Couple), every rule is an increase
  // on the base of three, so three allies or fewer is never over the limit. Skipping the rule scan keeps this cheap
  // when it runs between frames.
  if (allies.length === 0) return false;
  if (allies.length <= BASE_ALLY_LIMIT && !allyLimitMayBeReduced(ctx.state, ctx.deps)) return false;
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

/** The player side schemes in play that count toward the limit, in the order they entered the villain's play area. */
function playerSideSchemesCounted(ctx: Ctx): readonly InstanceId[] {
  return ctx.state.villainArea.filter(
    (id) =>
      cardOf(ctx.state, id)?.type === "player_side_scheme" &&
      // One already defeated and waiting to leave play after its When Defeated is not seen by a rule counting cards in
      // play (`defeatedAwaitingLeave`, FAQ "Fabian Cortez (#159)", RRG 1.8 p. 64), nor is one whose discard is on the
      // stack waiting for a "when this leaves play" interrupt: asking again would discard a second scheme for it.
      !defeatedAwaitingLeave(ctx.state, id) &&
      !leavingPlayPending(ctx.state, id) &&
      !excludedFromPlayerSideSchemeLimit(ctx.state, ctx.deps, id),
  );
}

/** A player side scheme whose entering play is on the stack with its enter-play step (and its limit check) still to come. */
const stillEntering = (ctx: Ctx, id: InstanceId): boolean =>
  ctx.state.stack.some(
    (frame) =>
      frame.kind === "event" &&
      frame.event.kind === "cardEntersPlay" &&
      frame.event.instanceId === id &&
      (frame.stage === "interrupts" || frame.stage === "apply"),
  );

/**
 * RRG 1.8 "Player Side Scheme Limit" (p. 34): "If one or two players started the game, the player side scheme limit is
 * one. If three or four players started the game, the limit is two. If there are ever more player side schemes in play
 * than the limit, the first player chooses and discards player side schemes until there are no longer more in play
 * than the limit. A player may play a player side scheme even while at the player side scheme limit. If they do, they
 * must choose a player side scheme to discard. (The player side scheme discarded this way is not considered defeated.)"
 *
 * Modeled on the ally limit (`checkAllyLimit`): the scheme enters play first, and the check is part of its enter-play
 * step, before abilities that resolve on entering play. `entering` is that scheme, or null for the check between frames
 * (`checkStateTriggers`), which catches every other way over the limit (a scheme that stops being excluded from it).
 *
 * Who chooses (docs/phase7-wave7.md §4.1 Q1): the player who **played** `entering` (its `playCard` frame is still on
 * the stack); the first player when an effect put it into play or nothing entered. Either may choose any counted player
 * side scheme, the one that just entered included (MC40 rulebook p. 21, an effect putting one into play at the limit:
 * "The first player chooses one player side scheme in play to discard, which could include Technovirus Purge").
 *
 * What counts (owner rulings, 2026-10-04): every player side scheme in play, whoever controls it or nobody. Only an
 * `excludedFromPlayerSideSchemeLimit` rule leaves one out, which is how a campaign player side scheme is exempt: its
 * own text says "This scheme does not count against the player side scheme limit", a constant on the scheme targeting
 * itself. Being controlled by no player is not an exemption. One at zero threat is already out of the count while its
 * When Defeated resolves (`playerSideSchemesCounted`).
 *
 * One that cannot leave play (permanent, "cannot leave play") counts but is not offered, since choosing it would
 * discard nothing. So the choice is for `min(number over the limit, schemes that can leave)`: when the only scheme
 * that can leave is the one that just entered, it is the one discarded, and when none can leave nobody is asked and
 * the game continues over the limit. The check between frames then returns false each time, so it cannot loop.
 * Returns true when it asked a player.
 */
export function checkPlayerSideSchemeLimit(ctx: Ctx, entering: InstanceId | null): boolean {
  if (ctx.state.pendingChoice || ctx.state.villainArea.length === 0) return false;
  const counted = playerSideSchemesCounted(ctx);
  const limit = playerSideSchemeLimit(ctx.state);
  if (counted.length <= limit) return false;
  // Between frames, a scheme still entering play is left to its own enter-play step, where the player who played it
  // is the one asked.
  if (entering === null && counted.some((id) => stillEntering(ctx, id))) return false;
  const played = entering === null ? undefined : playFrameOf(ctx.state.stack, entering);
  const options = counted.filter(
    (id) => !permanentStopsLeaving(ctx.state, ctx.deps, id, undefined) && !cannotLeavePlay(ctx.state, ctx.deps, id),
  );
  const over = Math.min(counted.length - limit, options.length);
  if (over === 0) return false;
  requestChoice(ctx, {
    playerId: played?.playerId ?? ctx.state.firstPlayerId,
    prompt: { kind: "discardOverPlayerSideSchemeLimit", limit },
    options: options.map((id) => ({
      optionId: id,
      label: mustCardOf(ctx.state, id).name,
      ref: { kind: "card", instanceId: id } as const,
    })),
    minSelections: over,
    maxSelections: over,
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

/**
 * A player side scheme entering play, whether a player played it (`executePlayCardFrame`) or an effect put it into play
 * (`putIntoPlay`, from any zone; docs/phase7-wave7.md §3.43). RRG 1.8 "Player Side Scheme" (p. 34): "it is placed
 * next to the main scheme in the villain's play area" and "enters play with an amount of threat on it equal to its
 * starting threat value", with its hinder in the same placement, as a side scheme's (`enterPlayOnReveal`).
 *
 * `controllerId` is null for one no player controls: put into play by the scenario from cards nobody owns (§4.1 Q24).
 * `playerId` is who the entering is announced for: the playing player, or the controller an effect named.
 *
 * It has no reveal and its "enters play" windows open with the threat already on it. The unique rule is the caller's,
 * before this: a play is refused as illegal (`actions.ts`), an effect has no effect (`admitUniqueEntry`).
 */
export function playerSideSchemeEntersPlay(
  ctx: Ctx,
  id: InstanceId,
  controllerId: PlayerId | null,
  playerId: PlayerId | null = controllerId,
): void {
  moveCard(ctx, id, { kind: "villainArea" });
  updateInstance(ctx, id, (i) => ({ ...i, controllerId, faceup: true }));
  enterPlay(ctx, id, playerId);
  pushEvent(ctx, {
    kind: "placeThreat",
    schemeInstanceId: id,
    amount: startingThreatOf(ctx.state, id, ctx.deps) + keywordTotal(ctx.state, id, "hinder", ctx.deps),
    sourceInstanceId: null,
  });
}

/**
 * RRG 1.8 "Quickstrike" (p. 36): after this minion engages a hero-form player, it attacks them. The keyword is read
 * with `deps`, so one a constant ability grants ("Each minion gains quickstrike") counts as well as a printed one.
 */
export function quickstrikeAttack(ctx: Ctx, id: InstanceId): TriggerEvent | null {
  const state = ctx.state;
  if (cardOf(state, id)?.type !== "minion") return null;
  if (!hasKeyword(state, id, "quickstrike", ctx.deps)) return null;
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
