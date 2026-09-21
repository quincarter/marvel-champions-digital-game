/** Keywords and limits that resolve as a card enters play. */

import { type Ctx, requestChoice } from "../ctx.js";
import { addCounters, giveStatus } from "../effects.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { hasKeyword, keywordsOf } from "../keywords.js";
import { cardOf, getInstance, getPlayer, mustCardOf, mustPlayer } from "../query.js";
import { allyLimitFor, BASE_ALLY_LIMIT, excludedFromAllyLimit } from "../rules.js";
import { controllerOf, restrictedCardsOf } from "../select.js";

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
import { announce } from "./frames.js";

/**
 * The keywords that resolve as a card enters play: toughness places a tough
 * status card, uses places its all-purpose counters, and restricted makes the
 * controller check that they still control at most two restricted cards.
 */
export function applyEnterPlayKeywords(ctx: Ctx, id: InstanceId): void {
  for (const keyword of keywordsOf(ctx.state, id, ctx.deps)) {
    if (keyword.name === "toughness") giveStatus(ctx, id, "tough");
    if (keyword.name === "uses") addCounters(ctx, id, keyword.counterType, keyword.count);
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
      cardOf(ctx.state, id)?.type === "ally" &&
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
  if (held.length <= 2) return;
  requestChoice(ctx, {
    playerId,
    prompt: { kind: "discardRestricted", limit: 2 },
    options: held.map((id) => ({
      optionId: id,
      label: mustCardOf(ctx.state, id).name,
      ref: { kind: "card", instanceId: id } as const,
    })),
    minSelections: held.length - 2,
    maxSelections: held.length - 2,
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
