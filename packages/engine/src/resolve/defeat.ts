/** Defeat sweeps, player elimination, and villain/main scheme stage advancement. */

import { type Ctx, emit, moveCard, pushFrames, updateInstance, updatePlayer } from "../ctx.js";
import { endGame, giveStatus } from "../effects.js";
import type { FrameId, InstanceId, PlayerId } from "../ids.js";
import { hasKeyword } from "../keywords.js";
import {
  characterProfile,
  getInstance,
  isMinion,
  mainSchemeStage,
  mainSchemeStageCount,
  mustInstance,
  mustPlayer,
  nextClockwisePlayer,
  playerOrder,
  scale,
  villainStageCount,
} from "../query.js";
import type { StackFrame } from "../stack.js";
import type { GameState } from "../state.js";
import { eventFrame, gameAbilityFrames } from "./frames.js";

export function checkMainSchemeCompletion(ctx: Ctx): void {
  const scheme = mustInstance(ctx.state, ctx.state.mainScheme.instanceId);
  const stage = mainSchemeStage(ctx.state);
  const target = scale(stage.targetThreat, ctx.state.startingPlayerCount);
  if (scheme.threat < target) return;

  emit(ctx, { type: "mainSchemeCompleted", stageIndex: ctx.state.mainScheme.stageIndex });
  const nextIndex = ctx.state.mainScheme.stageIndex + 1;
  if (nextIndex >= mainSchemeStageCount(ctx.state)) {
    ctx.state = { ...ctx.state, mainScheme: { ...ctx.state.mainScheme, completed: true } };
    endGame(ctx, { result: "loss", reason: "mainSchemeCompleted" });
    return;
  }
  advanceMainScheme(ctx, nextIndex);
}

/**
 * RRG "Main Scheme": excess threat does not carry over; acceleration tokens do.
 * The new stage's A side is revealed first (its "When Revealed" resolves), then
 * the B side (its own "When Revealed", if any), then the B side's starting
 * threat is placed.
 */
function advanceMainScheme(ctx: Ctx, nextIndex: number): void {
  ctx.state = { ...ctx.state, mainScheme: { ...ctx.state.mainScheme, stageIndex: nextIndex } };
  const stage = mainSchemeStage(ctx.state);
  const schemeId = ctx.state.mainScheme.instanceId;
  updateInstance(ctx, schemeId, (i) => ({ ...i, threat: 0 }));
  emit(ctx, { type: "mainSchemeAdvanced", stageIndex: nextIndex });
  pushFrames(ctx, [
    ...gameAbilityFrames(ctx, schemeId, ["whenRevealed"], null, stage.aSide.abilities, ctx.state.firstPlayerId),
    ...gameAbilityFrames(ctx, schemeId, ["whenRevealed"], null, undefined, ctx.state.firstPlayerId),
    eventFrame(ctx, {
      kind: "placeThreat",
      schemeInstanceId: schemeId,
      amount: scale(stage.startingThreat, ctx.state.startingPlayerCount),
      sourceInstanceId: null,
    }),
    eventFrame(ctx, { kind: "mainSchemeAdvanced", stageIndex: nextIndex }),
  ]);
}

/** The damage that triggered a defeat sweep, so that character's defeat can carry attack context. */
interface DefeatHint {
  readonly targetId: InstanceId;
  readonly parentFrameId: FrameId | null;
  readonly overkill: { readonly amount: number; readonly toInstanceId: InstanceId; readonly sourceInstanceId: InstanceId | null } | undefined;
  /** The controller of the damage's source ("after you defeat a minion"). */
  readonly defeatedByPlayerId?: PlayerId | null;
}

const defeatPending = (state: GameState, id: InstanceId): boolean =>
  state.stack.some(
    (f) => f.kind === "event" && f.event.kind === "characterDefeated" && f.event.instanceId === id && (f.stage === "interrupts" || f.stage === "apply"),
  );

/** Sweeps every character in play for zero remaining hit points, in a fixed order. */
export function checkDefeats(ctx: Ctx, hint?: DefeatHint): void {
  if (ctx.state.outcome) return;

  const villainId = ctx.state.villain.instanceId;
  const villainProfile = characterProfile(ctx.state, villainId, ctx.deps);
  const villain = getInstance(ctx.state, villainId);
  if (villainProfile && villain && villain.damage >= villainProfile.maxHp) {
    defeatVillainStage(ctx);
    if (ctx.state.outcome) return;
  }

  // One batch for the whole sweep, in sweep order. Each defeat is an event with
  // an interrupt window; the card leaves play when it applies (see applyDefeat).
  const defeatFrames: StackFrame[] = [];
  for (const player of playerOrder(ctx.state)) {
    for (const id of [...player.playArea]) {
      const profile = characterProfile(ctx.state, id, ctx.deps);
      const instance = getInstance(ctx.state, id);
      if (!profile || !instance) continue;
      if (profile.kind !== "ally" && profile.kind !== "minion") continue;
      if (instance.damage < profile.maxHp) continue;
      if (hasKeyword(ctx.state, id, "permanent", ctx.deps)) continue;
      if (defeatPending(ctx.state, id)) continue;
      const context =
        hint?.targetId === id
          ? {
              parentFrameId: hint.parentFrameId,
              ...(hint.overkill ? { overkill: hint.overkill } : {}),
              ...(hint.defeatedByPlayerId ? { defeatedByPlayerId: hint.defeatedByPlayerId } : {}),
            }
          : {};
      defeatFrames.push(eventFrame(ctx, { kind: "characterDefeated", instanceId: id, ...context }));
    }
  }
  pushFrames(ctx, defeatFrames);

  for (const player of playerOrder(ctx.state)) {
    const identityId = player.identity.instanceId;
    const profile = characterProfile(ctx.state, identityId, ctx.deps);
    const instance = getInstance(ctx.state, identityId);
    if (!profile || !instance) continue;
    if (instance.damage < profile.maxHp) continue;
    eliminatePlayer(ctx, player.playerId);
    if (ctx.state.outcome) return;
  }
}

function defeatVillainStage(ctx: Ctx): void {
  const nextIndex = ctx.state.villain.stageIndex + 1;
  if (nextIndex > ctx.state.villain.lastStageIndex || nextIndex >= villainStageCount(ctx.state)) {
    ctx.state = { ...ctx.state, villain: { ...ctx.state.villain, defeated: true } };
    emit(ctx, {
      type: "characterDefeated",
      instanceId: ctx.state.villain.instanceId,
      cardId: ctx.state.villain.cardId,
    });
    endGame(ctx, { result: "win", reason: "villainDefeated" });
    return;
  }
  // RRG "Villain Defeat": excess damage does not carry over to the new stage.
  ctx.state = { ...ctx.state, villain: { ...ctx.state.villain, stageIndex: nextIndex } };
  const villainId = ctx.state.villain.instanceId;
  updateInstance(ctx, villainId, (i) => ({ ...i, damage: 0 }));
  emit(ctx, { type: "villainStageAdvanced", stageIndex: nextIndex });
  // RRG "Villain Defeat": the next stage is revealed. Same title in Core, so statuses and
  // attachments carry over; the new stage's keywords (toughness) and When Revealed apply.
  if (hasKeyword(ctx.state, villainId, "toughness", ctx.deps)) giveStatus(ctx, villainId, "tough");
  pushFrames(ctx, [
    ...gameAbilityFrames(ctx, villainId, ["whenRevealed"], null, undefined, ctx.state.firstPlayerId),
    eventFrame(ctx, { kind: "villainStageAdvanced", stageIndex: nextIndex }),
  ]);
}

/** RRG "Player Elimination" steps 1–5, minus permanent-keyword handling. */
export function eliminatePlayer(ctx: Ctx, playerId: PlayerId): void {
  const player = mustPlayer(ctx.state, playerId);
  if (player.eliminated) return;

  if (ctx.state.firstPlayerId === playerId) {
    const next = nextClockwisePlayer(ctx.state, playerId);
    if (next) {
      ctx.state = { ...ctx.state, firstPlayerId: next.playerId };
      emit(ctx, { type: "firstPlayerChanged", playerId: next.playerId });
    }
  }

  const nextSeat = nextClockwisePlayer(ctx.state, playerId);
  for (const id of [...player.playArea]) {
    // RRG "Permanent": a permanent card cannot leave play, elimination included.
    if (hasKeyword(ctx.state, id, "permanent", ctx.deps)) continue;
    if (isMinion(ctx.state, id) && nextSeat) {
      moveCard(ctx, id, { kind: "playArea", playerId: nextSeat.playerId });
      updateInstance(ctx, id, (i) => ({ ...i, engagedWith: nextSeat.playerId }));
      continue;
    }
    const owner = getInstance(ctx.state, id)?.ownerId;
    moveCard(ctx, id, owner ? { kind: "discard", playerId: owner } : { kind: "encounterDiscard" }, "top");
  }
  for (const id of [...mustPlayer(ctx.state, playerId).hand]) {
    moveCard(ctx, id, { kind: "discard", playerId }, "top");
  }
  for (const id of [...mustPlayer(ctx.state, playerId).deck]) {
    moveCard(ctx, id, { kind: "discard", playerId }, "top");
  }
  for (const id of [...mustPlayer(ctx.state, playerId).dealtEncounter]) {
    moveCard(ctx, id, { kind: "encounterDiscard" }, "top");
  }
  for (const id of [...mustPlayer(ctx.state, playerId).resolving]) {
    moveCard(ctx, id, { kind: "discard", playerId }, "top");
  }

  updatePlayer(ctx, playerId, (p) => ({ ...p, eliminated: true }));
  emit(ctx, { type: "playerEliminated", playerId });

  if (ctx.state.players.every((p) => p.eliminated)) {
    endGame(ctx, { result: "loss", reason: "allPlayersDefeated" });
  }
}
