/** Defeat sweeps, player elimination, and villain/main scheme stage advancement. */

import { type Ctx, emit, moveCard, pushFrames, updateInstance, updatePlayer } from "../ctx.js";
import { discardFromPlay, endGame, giveStatus, leavePlay, setActiveVillain } from "../effects.js";
import type { FrameId, InstanceId, PlayerId } from "../ids.js";
import { hasKeyword } from "../keywords.js";
import {
  characterProfile,
  discardZoneFor,
  getInstance,
  isMinion,
  mainSchemeStage,
  mainSchemeStageCount,
  mainSchemeValue,
  mustInstance,
  mustPlayer,
  mustVillain,
  nextClockwisePlayer,
  playerOrder,
  undefeatedVillains,
  villainStageCount,
} from "../query.js";
import { cardsInPlay } from "../select.js";
import type { StackFrame } from "../stack.js";
import type { GameState, VillainState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { engagedEvent } from "./apply-effect.js";
import { announce, base, eventFrame, gameAbilityFrames } from "./frames.js";
import { heard } from "./triggers.js";

/** A completion's When Completed abilities are resolving and its advance is still queued. */
const advancePending = (state: GameState): boolean =>
  state.stack.some(
    (frame) =>
      frame.kind === "effects" && frame.cursor === 0 && frame.selfInstanceId === state.mainScheme.instanceId && frame.effects[0]?.kind === "advanceMainScheme",
  );

export function checkMainSchemeCompletion(ctx: Ctx): void {
  if (ctx.state.outcome || advancePending(ctx.state)) return;
  const schemeId = ctx.state.mainScheme.instanceId;
  const scheme = mustInstance(ctx.state, schemeId);
  const target = mainSchemeValue(ctx.state, "targetThreat", ctx.deps);
  if (scheme.threat < target) return;

  emit(ctx, { type: "mainSchemeCompleted", stageIndex: ctx.state.mainScheme.stageIndex });
  const nextIndex = ctx.state.mainScheme.stageIndex + 1;
  if (nextIndex >= mainSchemeStageCount(ctx.state)) {
    ctx.state = { ...ctx.state, mainScheme: { ...ctx.state.mainScheme, completed: true } };
    endGame(ctx, { result: "loss", reason: "mainSchemeCompleted" });
    return;
  }
  // RRG 1.8 "When Completed Abilities" (p. 48): a forced interrupt to the completion, so they resolve before the advance.
  const whenCompleted = gameAbilityFrames(ctx, schemeId, ["whenCompleted"], null, undefined, ctx.state.firstPlayerId);
  if (whenCompleted.length === 0) {
    advanceMainScheme(ctx, nextIndex);
    return;
  }
  pushFrames(ctx, [
    ...whenCompleted,
    {
      ...base(ctx),
      kind: "effects",
      effects: [{ kind: "advanceMainScheme" }],
      cursor: 0,
      bindings: {},
      vars: {},
      scopedPlayerId: null,
      selfInstanceId: schemeId,
      controllerId: null,
      event: null,
      eventFrameId: null,
    },
  ]);
}

/** `EffectSpec advanceMainScheme`: the next stage, if there is one. */
export function advanceMainSchemeStage(ctx: Ctx): void {
  const nextIndex = ctx.state.mainScheme.stageIndex + 1;
  if (ctx.state.outcome || nextIndex >= mainSchemeStageCount(ctx.state)) return;
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
  const startingThreat = mainSchemeValue(ctx.state, "startingThreat", ctx.deps);
  updateInstance(ctx, schemeId, (i) => ({ ...i, threat: 0 }));
  emit(ctx, { type: "mainSchemeAdvanced", stageIndex: nextIndex });
  pushFrames(ctx, [
    ...gameAbilityFrames(ctx, schemeId, ["whenRevealed"], null, stage.aSide.abilities, ctx.state.firstPlayerId),
    ...gameAbilityFrames(ctx, schemeId, ["whenRevealed"], null, undefined, ctx.state.firstPlayerId),
    eventFrame(ctx, {
      kind: "placeThreat",
      schemeInstanceId: schemeId,
      amount: startingThreat,
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

  // Villains first, in printed order: a villain stage falls the moment its dial reaches zero.
  const activeChoices: StackFrame[] = [];
  for (const { instanceId } of undefeatedVillains(ctx.state)) {
    const villainProfile = characterProfile(ctx.state, instanceId, ctx.deps);
    const villain = getInstance(ctx.state, instanceId);
    if (villainProfile && villain && villain.damage >= villainProfile.maxHp) {
      const choice = defeatVillainStage(ctx, instanceId);
      if (ctx.state.outcome) return;
      if (choice) activeChoices.push(choice);
    }
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
  // Choosing who holds the active counter next resolves before anything else queued by this sweep, so no effect
  // can read "the villain" while the counter still sits on a defeated one.
  pushFrames(ctx, activeChoices);

  for (const player of playerOrder(ctx.state)) {
    const identityId = player.identity.instanceId;
    const profile = characterProfile(ctx.state, identityId, ctx.deps);
    const instance = getInstance(ctx.state, identityId);
    if (!profile || !instance) continue;
    if (instance.damage < profile.maxHp) continue;
    // "When [your hero] would be defeated, … instead" (Captain America's Helmet) needs an interrupt window, so the
    // defeat goes on the stack as an event when an ability could react to it and the player is eliminated when it
    // applies. With nothing listening the elimination happens right here, exactly as it did before.
    const defeat: TriggerEvent = { kind: "characterDefeated", instanceId: identityId };
    if (!defeatPending(ctx.state, identityId) && heard(ctx.state, ctx.deps, defeat)) {
      pushFrames(ctx, [eventFrame(ctx, defeat)]);
      continue;
    }
    eliminatePlayer(ctx, player.playerId);
    if (ctx.state.outcome) return;
  }
}

const updateVillain = (ctx: Ctx, id: InstanceId, update: (villain: VillainState) => VillainState): void => {
  ctx.state = { ...ctx.state, villains: ctx.state.villains.map((villain) => (villain.instanceId === id ? update(villain) : villain)) };
};

/**
 * RRG 1.8 "Villain Defeat" (p. 47), for one villain: the next stage is revealed, or after the last stage this
 * villain is defeated. The game is won when every villain is (The Wrecking Crew insert: "If the players defeat all
 * 4 villains, they win the game!"). Returns the frame that chooses the next active villain, when one is needed.
 */
function defeatVillainStage(ctx: Ctx, villainId: InstanceId): StackFrame | null {
  const villain = mustVillain(ctx.state, villainId);
  const nextIndex = villain.stageIndex + 1;
  if (nextIndex > villain.lastStageIndex || nextIndex >= villainStageCount(ctx.state, villainId)) {
    updateVillain(ctx, villainId, (v) => ({ ...v, defeated: true }));
    emit(ctx, { type: "characterDefeated", instanceId: villainId, cardId: villain.cardId });
    if (ctx.state.villains.every((v) => v.defeated)) {
      endGame(ctx, { result: "win", reason: ctx.state.villains.length > 1 ? "allVillainsDefeated" : "villainDefeated" });
      return null;
    }
    return removeDefeatedVillain(ctx, villainId);
  }
  // RRG "Villain Defeat": excess damage does not carry over to the new stage. The extreme challenge's A→B (and a
  // per-villain lastStageIndex) is this same advance (docs/phase7-wave1.md §4.6, proposed).
  updateVillain(ctx, villainId, (v) => ({ ...v, stageIndex: nextIndex }));
  updateInstance(ctx, villainId, (i) => ({ ...i, damage: 0 }));
  emit(ctx, { type: "villainStageAdvanced", stageIndex: nextIndex, instanceId: villainId });
  // RRG "Villain Defeat": the next stage is revealed. Same title in Core, so statuses and
  // attachments carry over; the new stage's keywords (toughness) and When Revealed apply.
  if (hasKeyword(ctx.state, villainId, "toughness", ctx.deps)) giveStatus(ctx, villainId, "tough");
  pushFrames(ctx, [
    ...gameAbilityFrames(ctx, villainId, ["whenRevealed"], null, undefined, ctx.state.firstPlayerId),
    eventFrame(ctx, { kind: "villainStageAdvanced", stageIndex: nextIndex, instanceId: villainId }),
  ]);
  return null;
}

/** Slots used by the frame that picks the next active villain from a tie. */
const ACTIVE_CANDIDATES_SLOT = "_activeVillainCandidates";
const NEXT_ACTIVE_SLOT = "_nextActiveVillain";

/**
 * A villain defeated while others remain (The Wrecking Crew insert, "Multiple Villains and Encounter Decks"):
 *
 * - its stage is removed from the game (RRG 1.8 "Villain Defeat", p. 47), so it is out of play and its attachments,
 *   boost cards and tucked cards are discarded as it leaves;
 * - "When a villain is defeated, their side scheme is also removed from the game." Removed, not defeated: no When
 *   Defeated and no discard. It goes whether it is in play or still set aside;
 * - "Any encounter cards from that villain's deck that are in play remain in play." Nothing else moves;
 * - if it held the active counter: "When the active villain is defeated, move the active counter to the villain
 *   whose side scheme has the most threat. (In case of a tie, the first player decides.)" A villain with no side
 *   scheme in play counts as 0 threat.
 */
function removeDefeatedVillain(ctx: Ctx, villainId: InstanceId): StackFrame | null {
  const villain = mustVillain(ctx.state, villainId);
  const instance = mustInstance(ctx.state, villainId);
  for (const attachment of [...instance.attachments]) discardFromPlay(ctx, attachment);
  for (const boost of [...instance.boostCards]) moveCard(ctx, boost, discardZoneFor(ctx.state, boost), "top");
  for (const tucked of [...instance.tucked]) {
    moveCard(ctx, tucked, discardZoneFor(ctx.state, tucked), "top");
    updateInstance(ctx, tucked, (i) => ({ ...i, faceup: true }));
  }

  const scheme = villain.signatureSideSchemeId;
  if (scheme && !ctx.state.removedFromGame.includes(scheme)) {
    if (cardsInPlay(ctx.state).includes(scheme)) leavePlay(ctx, scheme, { kind: "removedFromGame" });
    else moveCard(ctx, scheme, { kind: "removedFromGame" });
  }

  if (ctx.state.activeVillainId !== villainId) return null;
  const inPlay = cardsInPlay(ctx.state);
  const schemeThreat = (candidate: VillainState): number => {
    const id = candidate.signatureSideSchemeId;
    return id && inPlay.includes(id) ? mustInstance(ctx.state, id).threat : 0;
  };
  const remaining = undefeatedVillains(ctx.state);
  const most = Math.max(...remaining.map(schemeThreat));
  const tied = remaining.filter((candidate) => schemeThreat(candidate) === most);
  const [only] = tied;
  if (tied.length === 1 && only) {
    setActiveVillain(ctx, only.instanceId, "activeVillainDefeated");
    return null;
  }
  // A tie: the first player decides (RRG 1.8 "First Player", p. 19). The frame's source is the defeated villain, so
  // the choice carries `firstPlayerTargets` authority (`effectChoiceAuthority`).
  return {
    ...base(ctx),
    kind: "effects",
    effects: [
      {
        kind: "chooseTarget",
        slot: NEXT_ACTIVE_SLOT,
        query: { categories: ["villain"], inSlot: ACTIVE_CANDIDATES_SLOT },
        chooser: { kind: "firstPlayer" },
      },
      { kind: "setActiveVillain", villain: { kind: "slot", slot: NEXT_ACTIVE_SLOT } },
    ],
    cursor: 0,
    bindings: { [ACTIVE_CANDIDATES_SLOT]: tied.map((candidate) => candidate.instanceId) },
    vars: {},
    scopedPlayerId: null,
    selfInstanceId: villainId,
    controllerId: null,
    event: null,
    eventFrameId: null,
  };
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
      for (const engaged of engagedEvent(ctx, id)) announce(ctx, engaged);
      continue;
    }
    moveCard(ctx, id, discardZoneFor(ctx.state, id), "top");
  }
  for (const id of [...mustPlayer(ctx.state, playerId).hand]) {
    moveCard(ctx, id, { kind: "discard", playerId }, "top");
  }
  for (const id of [...mustPlayer(ctx.state, playerId).deck]) {
    moveCard(ctx, id, { kind: "discard", playerId }, "top");
  }
  for (const id of [...mustPlayer(ctx.state, playerId).dealtEncounter]) {
    moveCard(ctx, id, discardZoneFor(ctx.state, id), "top");
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
