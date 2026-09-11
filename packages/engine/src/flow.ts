import type { ChoiceOption } from "./choices.js";
import { emit, requestChoice, setStep, updateInstance, updatePlayer, type Ctx } from "./ctx.js";
import { dealEncounterCardTo, drawCards, endLastingEffect, expireLastingEffects, readyCard } from "./effects.js";
import type { LastingEffect } from "./lasting.js";
import { EngineInvariantError } from "./errors.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { statusActive } from "./keywords.js";
import {
  cardOf,
  characterProfile,
  isMinion,
  countSchemeIcons,
  getPlayer,
  handSize,
  mainSchemeStage,
  mustCardOf,
  mustPlayer,
  nextClockwisePlayer,
  playerOrder,
  scale,
} from "./query.js";
import { announce, clearAbilityUses, executeFrame, pushEffects, pushEvent, pushRevealFrame } from "./resolve/index.js";
import { describeFrame } from "./stack.js";
import type { GameState, GameStep } from "./state.js";

const MAX_STEPS_PER_COMMAND = 5000;

/**
 * Advances the state machine until it needs input: a player's turn, a pending
 * choice, or game over. The resolution stack takes priority over the phase
 * structure — nothing in a step happens while something is still resolving.
 */
export function runFlow(ctx: Ctx): void {
  for (let i = 0; i < MAX_STEPS_PER_COMMAND; i++) {
    if (ctx.state.outcome || ctx.state.pendingChoice) return;
    if (ctx.state.stack.length > 0) {
      executeFrame(ctx);
      continue;
    }
    const step = ctx.state.step;
    if (step.phase === "gameOver") return;
    if (step.phase === "player" && step.kind === "turn") return;
    executeStep(ctx);
  }
  throw new EngineInvariantError(
    `flow did not settle at ${ctx.state.step.phase}/${ctx.state.step.kind}; stack: ${ctx.state.stack
      .map((frame) => describeFrame(frame))
      .join(" | ")}`,
  );
}

function executeStep(ctx: Ctx): void {
  const step = ctx.state.step;
  switch (step.kind) {
    case "drawStartingHands":
      return executeDrawStartingHands(ctx);
    case "mulligan":
      return executeMulligan(ctx, step.remainingPlayerIds);
    case "turn":
      return;
    case "endPhaseDiscard":
      return executeEndPhaseDiscard(ctx, step.remainingPlayerIds);
    case "endPhaseDraw":
      return executeEndPhaseDraw(ctx);
    case "endPhaseReady":
      return executeEndPhaseReady(ctx);
    case "placeThreat":
      return executePlaceThreat(ctx);
    case "enemyActivations":
      return executeEnemyActivations(ctx, step);
    case "dealEncounterCards":
      return executeDealEncounterCards(ctx);
    case "revealEncounterCards":
      return executeRevealEncounterCards(ctx, step.remainingPlayerIds);
    case "passFirstPlayer":
      return executePassFirstPlayer(ctx);
    case "endOfRound":
      return executeEndOfRound(ctx, step);
    case "gameOver":
      return;
  }
}

const livePlayers = (state: GameState, ids: readonly PlayerId[]): readonly PlayerId[] =>
  ids.filter((id) => getPlayer(state, id)?.eliminated === false);

const handOptions = (ctx: Ctx, playerId: PlayerId): readonly ChoiceOption[] =>
  mustPlayer(ctx.state, playerId).hand.map((id) => ({
    optionId: id,
    label: mustCardOf(ctx.state, id).name,
    ref: { kind: "card", instanceId: id },
  }));

// RRG Appendix II step 14, after setup cards and setup abilities have resolved.
function executeDrawStartingHands(ctx: Ctx): void {
  for (const player of ctx.state.players) {
    drawCards(ctx, player.playerId, handSize(ctx.state, player.playerId, ctx.deps));
  }
  setStep(ctx, {
    phase: "setup",
    kind: "mulligan",
    remainingPlayerIds: playerOrder(ctx.state).map((p) => p.playerId),
  });
}

// RRG Appendix II step 15: each player may discard any number, then draw back up to hand size.
function executeMulligan(ctx: Ctx, remainingPlayerIds: readonly PlayerId[]): void {
  const [current, ...rest] = livePlayers(ctx.state, remainingPlayerIds);
  if (!current) {
    emit(ctx, { type: "roundStarted", round: ctx.state.round });
    beginPlayerPhase(ctx);
    return;
  }
  const player = mustPlayer(ctx.state, current);
  if (player.hand.length === 0) {
    setStep(ctx, { phase: "setup", kind: "mulligan", remainingPlayerIds: rest });
    return;
  }
  requestChoice(ctx, {
    playerId: current,
    prompt: { kind: "mulligan", handSize: handSize(ctx.state, current, ctx.deps) },
    options: handOptions(ctx, current),
    minSelections: 0,
    maxSelections: player.hand.length,
  });
}

export function afterMulliganChoice(ctx: Ctx, playerId: PlayerId): void {
  const step = ctx.state.step;
  if (step.kind !== "mulligan") return;
  const limit = handSize(ctx.state, playerId, ctx.deps);
  const held = mustPlayer(ctx.state, playerId).hand.length;
  if (held < limit) drawCards(ctx, playerId, limit - held);
  setStep(ctx, {
    phase: "setup",
    kind: "mulligan",
    remainingPlayerIds: step.remainingPlayerIds.filter((id) => id !== playerId),
  });
}

export function beginTurn(ctx: Ctx, activePlayerId: PlayerId, remainingPlayerIds: readonly PlayerId[]): void {
  clearAbilityUses(ctx, "turn");
  setStep(ctx, { phase: "player", kind: "turn", activePlayerId, remainingPlayerIds });
  emit(ctx, { type: "turnStarted", playerId: activePlayerId });
  announce(ctx, { kind: "turnStarted", playerId: activePlayerId });
}

export function beginPlayerPhase(ctx: Ctx): void {
  clearAbilityUses(ctx, "phase");
  const order = playerOrder(ctx.state).map((p) => p.playerId);
  const [first, ...rest] = order;
  if (!first) {
    setStep(ctx, { phase: "player", kind: "endPhaseDiscard", remainingPlayerIds: [] });
    return;
  }
  beginTurn(ctx, first, rest);
}

/** Called by the `endTurn` command once the active player is done. */
export function advanceAfterTurn(ctx: Ctx, remainingPlayerIds: readonly PlayerId[]): void {
  const remaining = livePlayers(ctx.state, remainingPlayerIds);
  const [next, ...rest] = remaining;
  if (next) {
    beginTurn(ctx, next, rest);
    return;
  }
  setStep(ctx, {
    phase: "player",
    kind: "endPhaseDiscard",
    remainingPlayerIds: playerOrder(ctx.state).map((p) => p.playerId),
  });
}

// RRG "End of Player Phase" step 1: each player may discard any number, and must discard down to hand size.
function executeEndPhaseDiscard(ctx: Ctx, remainingPlayerIds: readonly PlayerId[]): void {
  const remaining = livePlayers(ctx.state, remainingPlayerIds);
  const [current, ...rest] = remaining;
  if (!current) {
    setStep(ctx, { phase: "player", kind: "endPhaseDraw" });
    return;
  }
  const player = mustPlayer(ctx.state, current);
  const limit = handSize(ctx.state, current, ctx.deps);
  if (player.hand.length === 0) {
    setStep(ctx, { phase: "player", kind: "endPhaseDiscard", remainingPlayerIds: rest });
    return;
  }
  requestChoice(ctx, {
    playerId: current,
    prompt: { kind: "discardDownToHandSize", handSize: limit },
    options: handOptions(ctx, current),
    minSelections: Math.max(0, player.hand.length - limit),
    maxSelections: player.hand.length,
  });
}

export function afterDiscardChoice(ctx: Ctx, playerId: PlayerId): void {
  const step = ctx.state.step;
  if (step.kind !== "endPhaseDiscard") return;
  const rest = step.remainingPlayerIds.filter((id) => id !== playerId);
  setStep(ctx, { phase: "player", kind: "endPhaseDiscard", remainingPlayerIds: rest });
}

function executeEndPhaseDraw(ctx: Ctx): void {
  for (const player of playerOrder(ctx.state)) {
    const limit = handSize(ctx.state, player.playerId, ctx.deps);
    const current = mustPlayer(ctx.state, player.playerId).hand.length;
    if (current < limit) drawCards(ctx, player.playerId, limit - current);
  }
  setStep(ctx, { phase: "player", kind: "endPhaseReady" });
}

function executeEndPhaseReady(ctx: Ctx): void {
  for (const player of playerOrder(ctx.state)) {
    readyCard(ctx, player.identity.instanceId);
    for (const id of mustPlayer(ctx.state, player.playerId).playArea) readyCard(ctx, id);
  }
  for (const id of ctx.state.villainArea) readyCard(ctx, id);
  readyCard(ctx, ctx.state.villain.instanceId);
  setStep(ctx, { phase: "villain", kind: "placeThreat" });
  clearAbilityUses(ctx, "phase");
  expireLastingEffects(ctx, "endOfPhase");
  announce(ctx, { kind: "playerPhaseEnded" });
}

// RRG "Villain Phase" step 1: acceleration field + acceleration icons + acceleration tokens.
// The step stays current while that threat (and its interrupts/responses) resolves, so
// "after placing threat here during step one of the villain phase" can see it.
function executePlaceThreat(ctx: Ctx): void {
  const step = ctx.state.step;
  if (step.kind === "placeThreat" && !step.placed) {
    const stage = mainSchemeStage(ctx.state);
    const amount =
      scale(stage.acceleration, ctx.state.startingPlayerCount) +
      ctx.state.mainScheme.accelerationTokens +
      countSchemeIcons(ctx.state, "acceleration");
    setStep(ctx, { phase: "villain", kind: "placeThreat", placed: true });
    pushEvent(ctx, {
      kind: "placeThreat",
      schemeInstanceId: ctx.state.mainScheme.instanceId,
      amount,
      sourceInstanceId: null,
    });
    return;
  }
  setStep(ctx, {
    phase: "villain",
    kind: "enemyActivations",
    currentPlayerId: null,
    remainingPlayerIds: playerOrder(ctx.state).map((p) => p.playerId),
    villainActivated: false,
    activatedMinionIds: [],
  });
}

function executeEnemyActivations(ctx: Ctx, step: Extract<GameStep, { kind: "enemyActivations" }>): void {
  const { currentPlayerId, remainingPlayerIds, villainActivated, activatedMinionIds } = step;
  const current = currentPlayerId ? getPlayer(ctx.state, currentPlayerId) : undefined;
  if (!current || current.eliminated) {
    const [next, ...rest] = livePlayers(ctx.state, remainingPlayerIds);
    if (!next) {
      setStep(ctx, { phase: "villain", kind: "dealEncounterCards" });
      return;
    }
    setStep(ctx, {
      phase: "villain",
      kind: "enemyActivations",
      currentPlayerId: next,
      remainingPlayerIds: rest,
      villainActivated: false,
      activatedMinionIds: [],
    });
    return;
  }
  if (!villainActivated) {
    // Mark before resolving: the attack suspends on the defend choice and resumes here.
    setStep(ctx, { ...step, villainActivated: true });
    activateEnemy(ctx, ctx.state.villain.instanceId, current.playerId);
    return;
  }
  const minions = current.playArea.filter((id) => isMinion(ctx.state, id) && !activatedMinionIds.includes(id));
  const [only] = minions;
  if (minions.length === 1 && only) {
    setStep(ctx, { ...step, activatedMinionIds: [...activatedMinionIds, only] });
    activateEnemy(ctx, only, current.playerId);
    return;
  }
  if (minions.length > 1) {
    // RRG "Activation": the engaged player chooses the order their minions activate in.
    requestChoice(ctx, {
      playerId: current.playerId,
      prompt: { kind: "chooseMinionToActivate" },
      options: minions.map((id) => ({
        optionId: id,
        label: mustCardOf(ctx.state, id).name,
        ref: { kind: "card", instanceId: id } as const,
      })),
      minSelections: 1,
      maxSelections: 1,
    });
    return;
  }
  setStep(ctx, { ...step, currentPlayerId: null });
}

/** Applies the answer to a `chooseMinionToActivate` choice. */
export function activateChosenMinion(ctx: Ctx, minionId: InstanceId): void {
  const step = ctx.state.step;
  if (step.kind !== "enemyActivations" || !step.currentPlayerId) return;
  setStep(ctx, { ...step, activatedMinionIds: [...step.activatedMinionIds, minionId] });
  activateEnemy(ctx, minionId, step.currentPlayerId);
}

// RRG "Activation": attack a player in hero form, scheme against a player in alter-ego form.
export function activateEnemy(ctx: Ctx, enemyId: InstanceId, playerId: PlayerId): void {
  const player = mustPlayer(ctx.state, playerId);
  const missing = characterProfile(ctx.state, enemyId, ctx.deps)?.missing ?? [];
  if (player.identity.form === "hero") {
    emit(ctx, { type: "enemyActivated", enemyInstanceId: enemyId, activation: "attack", playerId });
    // A printed "—" ATK: this enemy cannot attack, so the activation does nothing.
    if (missing.includes("atk")) return;
    if (statusActive(ctx.state, enemyId, "stunned", ctx.deps)) {
      // RRG "Stun": a stunned enemy discards the status instead of attacking.
      updateInstance(ctx, enemyId, (i) => ({ ...i, statuses: { ...i.statuses, stunned: 0 } }));
      emit(ctx, { type: "statusRemoved", instanceId: enemyId, status: "stunned", reason: "cancelledAttack" });
      return;
    }
    pushEvent(ctx, {
      kind: "enemyAttack",
      enemyInstanceId: enemyId,
      attackedPlayerId: playerId,
      targetPlayerId: playerId,
      targetInstanceId: player.identity.instanceId,
    });
    return;
  }
  emit(ctx, { type: "enemyActivated", enemyInstanceId: enemyId, activation: "scheme", playerId });
  if (missing.includes("sch")) return;
  if (statusActive(ctx.state, enemyId, "confused", ctx.deps)) {
    // RRG "Confuse": a confused enemy discards the status instead of scheming.
    updateInstance(ctx, enemyId, (i) => ({ ...i, statuses: { ...i.statuses, confused: 0 } }));
    emit(ctx, { type: "statusRemoved", instanceId: enemyId, status: "confused", reason: "cancelledSchemeOrThwart" });
    return;
  }
  pushEvent(ctx, { kind: "enemyScheme", enemyInstanceId: enemyId, playerId });
}

// RRG "Villain Phase" step 3 + "Hazard Icon": one card each, then one per hazard icon in player order.
function executeDealEncounterCards(ctx: Ctx): void {
  const order = playerOrder(ctx.state);
  for (const player of order) dealEncounterCardTo(ctx, player.playerId);
  const hazards = countSchemeIcons(ctx.state, "hazard");
  for (let i = 0; i < hazards; i++) {
    const player = order[i % order.length];
    if (player) dealEncounterCardTo(ctx, player.playerId);
  }
  setStep(ctx, {
    phase: "villain",
    kind: "revealEncounterCards",
    remainingPlayerIds: order.map((p) => p.playerId),
  });
}

function executeRevealEncounterCards(ctx: Ctx, remainingPlayerIds: readonly PlayerId[]): void {
  const remaining = livePlayers(ctx.state, remainingPlayerIds);
  const [current, ...rest] = remaining;
  if (!current) {
    setStep(ctx, { phase: "villain", kind: "passFirstPlayer" });
    return;
  }
  const next = mustPlayer(ctx.state, current).dealtEncounter[0];
  if (!next) {
    setStep(ctx, { phase: "villain", kind: "revealEncounterCards", remainingPlayerIds: rest });
    return;
  }
  pushRevealFrame(ctx, current, next);
}

function executePassFirstPlayer(ctx: Ctx): void {
  const next = nextClockwisePlayer(ctx.state, ctx.state.firstPlayerId);
  if (next) {
    ctx.state = { ...ctx.state, firstPlayerId: next.playerId };
    emit(ctx, { type: "firstPlayerChanged", playerId: next.playerId });
  }
  setStep(ctx, { phase: "villain", kind: "endOfRound" });
}

/**
 * RRG "Lasting Effects": "until the end of the round" effects expire just
 * before "at the end of the round" delayed effects initiate. The delayed
 * effects resolve through the stack, then the round actually ends.
 */
function executeEndOfRound(ctx: Ctx, step: Extract<GameStep, { kind: "endOfRound" }>): void {
  if (!step.delayedResolved) {
    const delayed = ctx.state.lastingEffects.filter(
      (effect): effect is Extract<LastingEffect, { kind: "delayedEffects" }> =>
        effect.kind === "delayedEffects" && effect.duration.kind === "endOfRound",
    );
    // The villain phase and the round end together.
    expireLastingEffects(ctx, "endOfPhase");
    expireLastingEffects(ctx, "endOfRound");
    for (const effect of delayed) endLastingEffect(ctx, effect.id, "fired");
    setStep(ctx, { phase: "villain", kind: "endOfRound", delayedResolved: true });
    for (const effect of [...delayed].reverse()) {
      pushEffects(ctx, { effects: effect.effects, ...effect.scope });
    }
    return;
  }
  for (const player of ctx.state.players) {
    updatePlayer(ctx, player.playerId, (p) => ({
      ...p,
      identity: { ...p.identity, changedFormThisRound: false },
    }));
  }
  clearAbilityUses(ctx, "round");
  ctx.state = { ...ctx.state, round: ctx.state.round + 1 };
  emit(ctx, { type: "roundStarted", round: ctx.state.round });
  beginPlayerPhase(ctx);
  announce(ctx, { kind: "villainPhaseEnded" });
}
