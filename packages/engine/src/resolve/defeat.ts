/** Defeat sweeps, player elimination, and villain/main scheme stage advancement. */

import { type Ctx, emit, moveCard, pushFrames, updateInstance, updatePlayer } from "../ctx.js";
import {
  discardFromPlay,
  endGame,
  giveStatus,
  leavePlay,
  setActiveVillain,
  updateMainSchemeState,
} from "../effects.js";
import type { FrameId, InstanceId, PlayerId } from "../ids.js";
import { hasKeyword } from "../keywords.js";
import {
  characterProfile,
  discardZoneFor,
  getInstance,
  isMinion,
  mainSchemeStageOf,
  mainSchemeStates,
  mainSchemeStateOf,
  mainSchemeValue,
  mustInstance,
  mustPlayer,
  mustVillain,
  nextClockwisePlayer,
  playerOrder,
  undefeatedVillains,
  villainStageCount,
  villainStageOf,
} from "../query.js";
import { cannotBeDefeated } from "../rules.js";
import { cardsInPlay } from "../select.js";
import type { StackFrame } from "../stack.js";
import type { GameState, MainSchemeState, VillainState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { engagedEvent } from "./apply-effect.js";
import { announce, base, eventFrame, gameAbilityFrames } from "./frames.js";
import { leaveAreaOnDefeat } from "./game-areas.js";
import { attachmentHostCandidates } from "./reveal.js";
import { heard } from "./triggers.js";

/** A completion's When Completed abilities are resolving and its advance is still queued. */
const advancePending = (state: GameState, schemeId: InstanceId): boolean =>
  state.stack.some(
    (frame) =>
      frame.kind === "effects" &&
      frame.cursor === 0 &&
      frame.selfInstanceId === schemeId &&
      frame.effects[0]?.kind === "advanceMainScheme",
  );

/**
 * The stage a main scheme advances to by default: the next stage, when exactly one stage carries the next stage number.
 * `null` when there is none (the final stage) and `"alternatives"` when several do (The Once and Future Kang's four
 * stage 3 cards): the default "advance to the next stage" is undefined into a group of alternatives, so card text must
 * name the stage (docs/phase7-wave2.md §1.6).
 */
export function nextMainSchemeStage(state: GameState, scheme: MainSchemeState): number | "alternatives" | null {
  const card = state.cardPool[scheme.cardId];
  if (card?.type !== "main_scheme") return null;
  const current = card.stages[scheme.stageIndex]?.stageNumber ?? 0;
  const later = card.stages
    .map((stage, index) => ({ stage, index }))
    .filter(({ stage, index }) => index > scheme.stageIndex && stage.stageNumber > current);
  const [first] = later;
  if (!first) return null;
  const group = later.filter(({ stage }) => stage.stageNumber === first.stage.stageNumber);
  return group.length > 1 ? "alternatives" : first.index;
}

/** Checks every main scheme in play (central, then each area's) for completion. */
export function checkMainSchemeCompletion(ctx: Ctx): void {
  for (const scheme of mainSchemeStates(ctx.state)) {
    if (ctx.state.outcome) return;
    checkOneMainScheme(ctx, scheme.instanceId);
  }
}

function checkOneMainScheme(ctx: Ctx, schemeId: InstanceId): void {
  const scheme = mainSchemeStateOf(ctx.state, schemeId);
  if (!scheme || scheme.completed || advancePending(ctx.state, schemeId)) return;
  const stage = mainSchemeStageOf(ctx.state, scheme);
  // RRG 1.8 "Dash (Value)" (p. 15): a dashed target threat "cannot be used", so the stage never completes by threat (The
  // Master of Time 2B; docs/phase7-wave2.md §3.4).
  if (stage.dashedValues?.includes("targetThreat")) return;
  const target = mainSchemeValue(ctx.state, "targetThreat", ctx.deps, scheme);
  if (mustInstance(ctx.state, schemeId).threat < target) return;
  completeMainScheme(ctx, schemeId);
}

/**
 * A main scheme stage is completed: by reaching its target threat, or by a card ability ("If all the players at this
 * stage are defeated, this stage is complete", `completeMainScheme`).
 *
 * - The central (or only) main scheme, as before: its final stage loses the game (RRG 1.8 "Main Scheme"); otherwise its
 *   When Completed abilities resolve and it advances (RRG 1.8 "When Completed Abilities", p. 48).
 * - A separate game area's own stage never advances or loses: it is marked completed and `mainSchemeCompleted` is
 *   announced, for its "After this stage is complete" response (Kang's stage 3 cards; docs/phase7-wave2.md §3.1).
 * - A stage whose next stage is a group of alternatives is marked completed the same way: the card must say which.
 */
export function completeMainScheme(ctx: Ctx, schemeId: InstanceId): void {
  const scheme = mainSchemeStateOf(ctx.state, schemeId);
  if (!scheme || scheme.completed || ctx.state.outcome) return;
  const central = schemeId === ctx.state.mainScheme.instanceId;
  emit(ctx, {
    type: "mainSchemeCompleted",
    stageIndex: scheme.stageIndex,
    ...(central ? {} : { schemeInstanceId: schemeId }),
  });
  const next = central ? nextMainSchemeStage(ctx.state, scheme) : "alternatives";
  // "If this stage is completed, the players lose the game." on a stage that is not the last (docs/phase7-wave3.md
  // §3.37): its completion loses exactly as the final stage's does (RRG 1.8 "Main Scheme", p. 27), not advance.
  if (next === null || mainSchemeStageOf(ctx.state, scheme).completionLoses === true) {
    updateMainSchemeState(ctx, schemeId, (s) => ({ ...s, completed: true }));
    endGame(ctx, { result: "loss", reason: "mainSchemeCompleted" });
    return;
  }
  if (next === "alternatives") {
    updateMainSchemeState(ctx, schemeId, (s) => ({ ...s, completed: true }));
    pushFrames(ctx, [
      ...gameAbilityFrames(ctx, schemeId, ["whenCompleted"], null, undefined, ctx.state.firstPlayerId),
      eventFrame(ctx, { kind: "mainSchemeCompleted", schemeInstanceId: schemeId, stageIndex: scheme.stageIndex }),
    ]);
    return;
  }
  // RRG 1.8 "When Completed Abilities" (p. 48): a forced interrupt to the completion, so they resolve before the advance.
  const whenCompleted = gameAbilityFrames(ctx, schemeId, ["whenCompleted"], null, undefined, ctx.state.firstPlayerId);
  if (whenCompleted.length === 0) {
    advanceMainScheme(ctx, schemeId, next);
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

/**
 * `EffectSpec advanceMainScheme`: the scheme's next stage if there is exactly one, or the stage `to` names ("Advance
 * the main scheme to stage 2", "advance to stage 4A"; docs/phase7-wave2.md §3.4). Nothing happens on the final stage,
 * into an unnamed group of alternatives, or to a stage already spent.
 */
export function advanceMainSchemeStage(
  ctx: Ctx,
  schemeId: InstanceId = ctx.state.mainScheme.instanceId,
  to?: { readonly stageNumber: number; readonly name?: string },
): void {
  const scheme = mainSchemeStateOf(ctx.state, schemeId);
  if (ctx.state.outcome || !scheme) return;
  let nextIndex: number | null = null;
  if (to) {
    const card = ctx.state.cardPool[scheme.cardId];
    const matches =
      card?.type === "main_scheme"
        ? card.stages
            .map((stage, index) => ({ stage, index }))
            .filter(
              ({ stage, index }) =>
                stage.stageNumber === to.stageNumber &&
                (to.name === undefined || stage.name === to.name) &&
                !ctx.state.spentMainSchemeStages.includes(index),
            )
        : [];
    nextIndex = matches.length === 1 ? (matches[0]?.index ?? null) : null;
  } else {
    const next = nextMainSchemeStage(ctx.state, scheme);
    nextIndex = typeof next === "number" ? next : null;
  }
  if (nextIndex === null) return;
  advanceMainScheme(ctx, schemeId, nextIndex);
}

/**
 * RRG "Main Scheme": excess threat does not carry over; acceleration tokens do.
 * The new stage's A side is revealed first (its "When Revealed" resolves), then
 * the B side (its own "When Revealed", if any), then the B side's starting
 * threat is placed.
 */
function advanceMainScheme(ctx: Ctx, schemeId: InstanceId, nextIndex: number): void {
  updateMainSchemeState(ctx, schemeId, (s) => ({ ...s, stageIndex: nextIndex, completed: false }));
  const scheme = mainSchemeStateOf(ctx.state, schemeId);
  if (!scheme) return;
  const stage = mainSchemeStageOf(ctx.state, scheme);
  const startingThreat = mainSchemeValue(ctx.state, "startingThreat", ctx.deps, scheme);
  const central = schemeId === ctx.state.mainScheme.instanceId;
  const which = central ? {} : { schemeInstanceId: schemeId };
  updateInstance(ctx, schemeId, (i) => ({ ...i, threat: 0 }));
  emit(ctx, { type: "mainSchemeAdvanced", stageIndex: nextIndex, ...which });
  pushFrames(ctx, [
    ...gameAbilityFrames(ctx, schemeId, ["whenRevealed"], null, stage.aSide.abilities, ctx.state.firstPlayerId),
    ...gameAbilityFrames(ctx, schemeId, ["whenRevealed"], null, undefined, ctx.state.firstPlayerId),
    eventFrame(ctx, {
      kind: "placeThreat",
      schemeInstanceId: schemeId,
      amount: startingThreat,
      sourceInstanceId: null,
    }),
    eventFrame(ctx, { kind: "mainSchemeAdvanced", stageIndex: nextIndex, ...which }),
  ]);
}

/** The damage that triggered a defeat sweep, so that character's defeat can carry attack context. */
interface DefeatHint {
  readonly targetId: InstanceId;
  readonly parentFrameId: FrameId | null;
  readonly overkill:
    | { readonly amount: number; readonly toInstanceId: InstanceId; readonly sourceInstanceId: InstanceId | null }
    | undefined;
  /** The controller of the damage's source ("after you defeat a minion"). */
  readonly defeatedByPlayerId?: PlayerId | null;
  /** The damage's source card itself ("after *Wasp* — or an event you play — defeats a minion"). */
  readonly sourceInstanceId?: InstanceId | null;
  /** The damage was attack damage: "defeated by an enemy attack" (Regroup; docs/phase7-wave3.md §3.45). */
  readonly fromAttack?: boolean;
}

const defeatPending = (state: GameState, id: InstanceId): boolean =>
  state.stack.some(
    (f) =>
      f.kind === "event" &&
      f.event.kind === "characterDefeated" &&
      f.event.instanceId === id &&
      (f.stage === "interrupts" || f.stage === "apply"),
  );

/**
 * Sweeps every character in play for zero remaining hit points, in a fixed order. `hints` say what dealt the damage to
 * each character that took some: one for a single damage event, one per member for a simultaneous damage group.
 */
export function checkDefeats(ctx: Ctx, hints?: DefeatHint | readonly DefeatHint[]): void {
  if (ctx.state.outcome) return;
  const all: readonly DefeatHint[] = hints === undefined ? [] : "targetId" in hints ? [hints] : hints;
  const hintFor = (id: InstanceId): DefeatHint | undefined => all.find((candidate) => candidate.targetId === id);

  // Villains first, in printed order: a villain stage falls the moment its dial reaches zero.
  const activeChoices: StackFrame[] = [];
  // "When Collector would be defeated, … flip this card instead" (docs/phase7-wave3.md §3.1): a villain's defeat is an
  // event with an interrupt window when an ability could react to it, the way an identity's already is below. It
  // applies through `applyDefeat`, which re-checks the dial, so a flip to an ∞ face or a reset dial replaces it. With
  // nothing listening the stage falls right here, exactly as it did before.
  const villainDefeats: StackFrame[] = [];
  // A villain and an identity defeated by the same sweep are defeated simultaneously, and if that eliminates the last
  // player the players lose: "there aren't any ties in Marvel Champions between the villain and the heroes, so if the
  // heroes don't win, they have lost" (FFG ruling, May 18, 2023, The Kraken's "each other character takes 1 damage";
  // docs/phase7-wave3.md §4 Q1). So while an identity falls in this sweep, the villain's defeat waits on the stack
  // until the eliminations below have applied: the last one ends the game as a loss, and otherwise the villain falls.
  const identityFalls = playerOrder(ctx.state).some((player) => identityAtZero(ctx, player.identity.instanceId));
  for (const { instanceId } of undefeatedVillains(ctx.state)) {
    const villainProfile = characterProfile(ctx.state, instanceId, ctx.deps);
    const villain = getInstance(ctx.state, instanceId);
    if (!villainProfile || !villain || villain.damage < villainProfile.maxHp) continue;
    if (cannotBeDefeated(ctx.state, ctx.deps, instanceId) || defeatPending(ctx.state, instanceId)) continue;
    const hint = hintFor(instanceId);
    const defeat: TriggerEvent = {
      kind: "characterDefeated",
      instanceId,
      ...(hint
        ? {
            parentFrameId: hint.parentFrameId,
            ...(hint.defeatedByPlayerId ? { defeatedByPlayerId: hint.defeatedByPlayerId } : {}),
            ...(hint.sourceInstanceId ? { sourceInstanceId: hint.sourceInstanceId } : {}),
            ...(hint.fromAttack ? { fromAttack: true as const } : {}),
          }
        : {}),
    };
    if (identityFalls || heard(ctx.state, ctx.deps, defeat)) {
      villainDefeats.push(eventFrame(ctx, defeat));
      continue;
    }
    const choice = defeatVillainStage(ctx, instanceId);
    if (ctx.state.outcome) return;
    if (choice) activeChoices.push(choice);
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
      if (cannotBeDefeated(ctx.state, ctx.deps, id)) continue;
      if (defeatPending(ctx.state, id)) continue;
      const hint = hintFor(id);
      const context = hint
        ? {
            parentFrameId: hint.parentFrameId,
            ...(hint.overkill ? { overkill: hint.overkill } : {}),
            ...(hint.defeatedByPlayerId ? { defeatedByPlayerId: hint.defeatedByPlayerId } : {}),
            ...(hint.sourceInstanceId ? { sourceInstanceId: hint.sourceInstanceId } : {}),
            ...(hint.fromAttack ? { fromAttack: true as const } : {}),
          }
        : {};
      defeatFrames.push(eventFrame(ctx, { kind: "characterDefeated", instanceId: id, ...context }));
    }
  }
  pushFrames(ctx, defeatFrames);
  // Choosing who holds the active counter next resolves before anything else queued by this sweep, so no effect
  // can read "the villain" while the counter still sits on a defeated one.
  pushFrames(ctx, activeChoices);
  // A villain's defeat event resolves before the minions' and allies', keeping the sweep's villains-first order.
  pushFrames(ctx, villainDefeats);

  for (const player of playerOrder(ctx.state)) {
    const identityId = player.identity.instanceId;
    if (!identityAtZero(ctx, identityId)) continue;
    // "When [your hero] would be defeated, … instead" (Captain America's Helmet) needs an interrupt window, so the
    // defeat goes on the stack as an event when an ability could react to it and the player is eliminated when it
    // applies. With nothing listening the elimination happens right here, exactly as it did before.
    // The same hint the ally/minion and villain paths above thread through (`fromAttack`/`sourceInstanceId`/
    // `defeatedByPlayerId`, docs/phase7-wave3.md §3.45): an identity's own defeat previously carried none of it, so
    // "defeated by an enemy attack" could never distinguish an identity killed by a villain's attack from one
    // killed by, say, a treachery's own damage (`ron` 90002's own docblock, `wave3/ron/kree-fanatic.ts`).
    const hint = hintFor(identityId);
    const defeat: TriggerEvent = {
      kind: "characterDefeated",
      instanceId: identityId,
      ...(hint
        ? {
            parentFrameId: hint.parentFrameId,
            ...(hint.defeatedByPlayerId ? { defeatedByPlayerId: hint.defeatedByPlayerId } : {}),
            ...(hint.sourceInstanceId ? { sourceInstanceId: hint.sourceInstanceId } : {}),
            ...(hint.fromAttack ? { fromAttack: true as const } : {}),
          }
        : {}),
    };
    if (!defeatPending(ctx.state, identityId) && heard(ctx.state, ctx.deps, defeat)) {
      pushFrames(ctx, [eventFrame(ctx, defeat)]);
      continue;
    }
    eliminatePlayer(ctx, player.playerId);
    if (ctx.state.outcome) return;
  }
}

/** An identity at zero remaining hit points that can be defeated: the sweep defeats it. */
function identityAtZero(ctx: Ctx, identityId: InstanceId): boolean {
  const profile = characterProfile(ctx.state, identityId, ctx.deps);
  const instance = getInstance(ctx.state, identityId);
  if (!profile || !instance || instance.damage < profile.maxHp) return false;
  return !cannotBeDefeated(ctx.state, ctx.deps, identityId);
}

const updateVillain = (ctx: Ctx, id: InstanceId, update: (villain: VillainState) => VillainState): void => {
  ctx.state = {
    ...ctx.state,
    villains: ctx.state.villains.map((villain) => (villain.instanceId === id ? update(villain) : villain)),
  };
};

/**
 * RRG 1.8 "Villain Defeat" (p. 47), for one villain: the next stage is revealed, or after the last stage this
 * villain is defeated. The game is won when every villain is (The Wrecking Crew insert: "If the players defeat all
 * 4 villains, they win the game!"). Returns the frame that chooses the next active villain, when one is needed.
 */
export function defeatVillainStage(ctx: Ctx, villainId: InstanceId): StackFrame | null {
  const villain = mustVillain(ctx.state, villainId);
  const nextIndex = villain.stageIndex + 1;
  // The defeated stage's own "When Defeated" (Kang (I): "Advance the main scheme to stage 2 at the end of the phase";
  // Kang (III): "The players win the game."), read before the stage changes. Resolved after this defeat's bookkeeping.
  const whenDefeated = gameAbilityFrames(
    ctx,
    villainId,
    ["whenDefeated"],
    null,
    villainStageOf(ctx.state, villainId).abilities,
    ctx.state.firstPlayerId,
  );
  if (nextIndex > villain.lastStageIndex || nextIndex >= villainStageCount(ctx.state, villainId)) {
    updateVillain(ctx, villainId, (v) => ({ ...v, defeated: true }));
    emit(ctx, { type: "characterDefeated", instanceId: villainId, cardId: villain.cardId });
    pushFrames(ctx, whenDefeated);
    // `victory: "cardAbility"` (The Once and Future Kang): only a card ability wins (docs/phase7-wave2.md §3.4).
    if (ctx.state.scenarioRules.victory === "finalVillainStage" && ctx.state.villains.every((v) => v.defeated)) {
      endGame(ctx, {
        result: "win",
        reason: ctx.state.villains.length > 1 ? "allVillainsDefeated" : "villainDefeated",
      });
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
    ...whenDefeated,
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

  // A villain in a separate game area passes that area's counter on (docs/phase7-wave2.md §3.1).
  if (leaveAreaOnDefeat(ctx, villainId)) return null;
  if (ctx.state.activeVillainId !== villainId) return null;
  const inPlay = cardsInPlay(ctx.state);
  const schemeThreat = (candidate: VillainState): number => {
    const id = candidate.signatureSideSchemeId;
    return id && inPlay.includes(id) ? mustInstance(ctx.state, id).threat : 0;
  };
  // Villains in separate game areas never hold the game's counter. With none left (Kang (I) under `victory:
  // "cardAbility"`), the counter stays on the defeated villain and "the villain" is nobody until one is added.
  const remaining = undefeatedVillains(ctx.state).filter(
    (candidate) => !ctx.state.gameAreas.some((area) => area.villainIds.includes(candidate.instanceId)),
  );
  if (remaining.length === 0) return null;
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

/**
 * RRG 1.8 "Player Elimination" (p. 34), steps 1–5. Step 3, for "each card in the eliminated player's play area that [is]
 * not owned by that player": a permanent attachment resolves its "attach to" text (removed from the game when it has no
 * valid target), any other permanent card is removed from the game, the rest go to their owners' discard piles. That
 * covers an encounter attachment on the identity (the Power Stone; FAQ "Power Stone (#149)", RRG 1.8 p. 62: "they
 * resolve the 'attach to' text of that attachment. In this case, the Power Stone would be attached to the villain").
 * docs/phase7-wave3.md §3.19.
 */
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
  // Step 3: a card in play there that the player does not own, and is permanent (the one case the keyword does not stop).
  const notOwnedPermanent = (id: InstanceId): boolean =>
    getInstance(ctx.state, id)?.ownerId !== playerId && hasKeyword(ctx.state, id, "permanent", ctx.deps);
  const reattachOrRemove = (id: InstanceId): void => {
    const card = ctx.state.cardPool[mustInstance(ctx.state, id).cardId];
    const attachesTo = card && "attachesTo" in card ? card.attachesTo : undefined;
    const context = { selfInstanceId: id, controllerId: null, event: null, bindings: {}, deps: ctx.deps };
    const [host] = attachesTo
      ? attachmentHostCandidates(ctx.state, attachesTo, context).filter((candidate) => candidate !== identityId)
      : [];
    if (host) moveCard(ctx, id, { kind: "attachment", hostInstanceId: host });
    else moveCard(ctx, id, { kind: "removedFromGame" });
  };
  const identityId = player.identity.instanceId;
  for (const id of [...mustInstance(ctx.state, identityId).attachments]) {
    if (notOwnedPermanent(id)) reattachOrRemove(id);
    else moveCard(ctx, id, discardZoneFor(ctx.state, id), "top");
  }
  for (const id of [...player.playArea]) {
    if (isMinion(ctx.state, id) && nextSeat) {
      moveCard(ctx, id, { kind: "playArea", playerId: nextSeat.playerId });
      updateInstance(ctx, id, (i) => ({ ...i, engagedWith: nextSeat.playerId }));
      for (const engaged of engagedEvent(ctx, id)) announce(ctx, engaged);
      continue;
    }
    if (notOwnedPermanent(id)) {
      if (ctx.state.cardPool[mustInstance(ctx.state, id).cardId]?.type === "attachment") reattachOrRemove(id);
      else moveCard(ctx, id, { kind: "removedFromGame" });
      continue;
    }
    moveCard(ctx, id, discardZoneFor(ctx.state, id), "top");
  }
  // Marked eliminated before its hand, deck and the rest are emptied into its discard pile, so the emptied deck is not
  // reset (`settlePlayerDecks`): step 5 removes these zones from the game.
  updatePlayer(ctx, playerId, (p) => ({ ...p, eliminated: true }));
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

  emit(ctx, { type: "playerEliminated", playerId });

  if (ctx.state.players.every((p) => p.eliminated)) {
    endGame(ctx, { result: "loss", reason: "allPlayersDefeated" });
  }
}
