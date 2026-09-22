import type { CampaignWindow } from "./campaign.js";
import type { ChoiceOption } from "./choices.js";
import { emit, pushFrames, requestChoice, setStep, updatePlayer, type Ctx } from "./ctx.js";
import {
  resolveCampaignWindow,
  resolveScenarioSetup,
  stepAfterCampaignWindow,
  stepAfterMulligans,
  STEP_AFTER_SCENARIO_SETUP,
} from "./setup-steps.js";
import { drawCards, endLastingEffect, expireLastingEffects, expirePlayerTurnEffects } from "./effects.js";
import { readyOrAnnounce } from "./resolve/event.js";
import type { LastingEffect } from "./lasting.js";
import { EngineInvariantError } from "./errors.js";
import type { PlayerId } from "./ids.js";
import { getPlayer, handSize, mustCardOf, mustPlayer, playerOrder, undefeatedVillains } from "./query.js";
import {
  announce,
  clearAbilityUses,
  executeFrame,
  gameAbilityFrames,
  heard,
  pushEffects,
  pushEvent,
} from "./resolve/index.js";
import { resetEmptySeparateDecks } from "./resolve/separate-decks.js";
import { resetEmptyScenarioDecks } from "./resolve/cards.js";
import { checkStateTriggers } from "./resolve/state-checks.js";
import { cardsInPlay, controllerOf } from "./select.js";
import { describeFrame } from "./stack.js";
import type { GameState, GameStep } from "./state.js";
import type { TriggerEvent } from "./trigger-events.js";
import {
  executeDealEncounterCards,
  executeEnemyActivations,
  executePassFirstPlayer,
  executePlaceThreat,
  executeRevealEncounterCards,
} from "./villain/phase.js";

const MAX_STEPS_PER_COMMAND = 5000;

/**
 * Advances the state machine until it needs input: a player's turn, a pending
 * choice, or game over. The resolution stack takes priority over the phase
 * structure — nothing in a step happens while something is still resolving.
 */
export function runFlow(ctx: Ctx): void {
  for (let i = 0; i < MAX_STEPS_PER_COMMAND; i++) {
    if (ctx.state.outcome || ctx.state.pendingChoice) return;
    // An emptied separate deck (the Invocation deck) takes its discard pile back at once, with no penalty.
    resetEmptySeparateDecks(ctx);
    // …and so does a scenario deck whose rules say so (the side-scheme deck; docs/phase7-wave2.md §3.3).
    resetEmptyScenarioDecks(ctx);
    // Condition-triggered forced abilities go on the stack the moment their condition becomes true, ahead of whatever
    // was about to resolve next (docs/phase7-wave1.md §3.4; FAQ "Green Goblin (#1B)", p. 59).
    if (checkStateTriggers(ctx)) continue;
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
    case "campaignWindow":
      return executeCampaignWindow(ctx, step.window);
    case "scenarioSetup":
      return executeScenarioSetupStep(ctx);
    case "drawStartingHands":
      return executeDrawStartingHands(ctx);
    case "mulligan":
      return executeMulligan(ctx, step.remainingPlayerIds);
    case "playerSetupAbilities":
      return executePlayerSetupAbilities(ctx, step);
    case "turn":
      return;
    case "endPhaseDiscard":
      return executeEndPhaseDiscard(ctx, step.remainingPlayerIds);
    case "endPhaseDraw":
      return executeEndPhaseDraw(ctx);
    case "endPhaseReady":
      return executeEndPhaseReady(ctx);
    // Villain phase steps one to five live in villain/phase.ts.
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

/**
 * A campaign's setup instructions for one window (campaign games only; design §6.1).
 *
 * The step advances as the frames are pushed rather than after they resolve: the stack takes priority over the phase
 * structure in `runFlow`, so the instructions still finish — choices and all — before the next step executes.
 */
function executeCampaignWindow(ctx: Ctx, window: CampaignWindow): void {
  resolveCampaignWindow(ctx, window);
  setStep(ctx, stepAfterCampaignWindow(window));
}

/** RRG 1.8 Appendix II steps 6-12 as a step, so a campaign can resolve instructions on either side of it. */
function executeScenarioSetupStep(ctx: Ctx): void {
  resolveScenarioSetup(ctx);
  setStep(ctx, STEP_AFTER_SCENARIO_SETUP);
}

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
    // MC50 p. 11's "After resolving mulligans" window goes here, between steps 15 and 16, in a campaign game.
    setStep(ctx, stepAfterMulligans(ctx.state));
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

/**
 * RRG 1.8 Appendix II step 16 (p. 51), "Resolve Player Setup Abilities": the last setup step, after the draw (step
 * 14) and the mulligan (step 15). A search like Steve Rogers' therefore reads a deck and discard pile that already
 * hold the opening hand and whatever the mulligan put away (FAQ "Steve Rogers (#1B)", p. 59: "only the deck and the
 * discard pile are searched"). The abilities go on the stack and the first round begins once they have resolved.
 */
function executePlayerSetupAbilities(ctx: Ctx, step: Extract<GameStep, { kind: "playerSetupAbilities" }>): void {
  if (!step.resolved) {
    const frames = playerOrder(ctx.state).flatMap((player) =>
      gameAbilityFrames(ctx, player.identity.instanceId, ["setup"], null),
    );
    setStep(ctx, { phase: "setup", kind: "playerSetupAbilities", resolved: true });
    pushFrames(ctx, frames);
    return;
  }
  emit(ctx, { type: "roundStarted", round: ctx.state.round });
  beginPlayerPhase(ctx);
}

export function beginTurn(ctx: Ctx, activePlayerId: PlayerId, remainingPlayerIds: readonly PlayerId[]): void {
  clearAbilityUses(ctx, "turn");
  // "…attacked this turn" (`attackedThisTurn`, docs/phase7-wave2.md §11.3, §14): each player takes one turn (RRG 1.8
  // "Player Phase", p. 34), so the record starts empty with each one, next to the turn-scoped ability-use counters.
  ctx.state = { ...ctx.state, attackedThisTurn: {} };
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
  // "When/After the player phase begins" (docs/phase7-wave3.md §3.2), pushed after the first turn's `turnStarted` so it
  // resolves before it: RRG 1.8 "Round Overview" (p. 4) step 1 comes before step 2's turns.
  pushIfHeard(ctx, { kind: "phaseBeginning", phase: "player" });
}

/** Pushes a timing-point event only when an ability could react to it, so a game without one logs as before. */
function pushIfHeard(ctx: Ctx, event: TriggerEvent): boolean {
  if (!heard(ctx.state, ctx.deps, event)) return false;
  pushEvent(ctx, event);
  return true;
}

/**
 * The apply step of `phaseEnding` (docs/phase7-wave3.md §3.2): the "at the end of the phase" delayed effects, and at the
 * villain phase's end, which is the round's, the "at the end of the round" ones too. RRG 1.8 "Delayed Effect" (p. 15):
 * they resolve "immediately after their specified timing point [...] and before responses to that point".
 */
export function pushPhaseEndDelayed(ctx: Ctx, phase: "player" | "villain"): void {
  const phaseDelayed = takeDelayed(ctx, "endOfPhase");
  pushDelayed(ctx, phase === "villain" ? [...phaseDelayed, ...takeDelayed(ctx, "endOfRound")] : phaseDelayed);
}

/** Ends `playerId`'s turn if it still is theirs: the `endTurn` command, or its `turnEnding` event applying. */
export function finishTurn(ctx: Ctx, playerId: PlayerId): void {
  const step = ctx.state.step;
  if (step.phase !== "player" || step.kind !== "turn" || step.activePlayerId !== playerId) return;
  emit(ctx, { type: "turnEnded", playerId });
  // "Until the end of this turn" (docs/phase7-wave2.md §13): expires as soon as the turn's end is reached (RRG 1.8
  // "Lasting Effects", p. 26), before the next player's turn begins or the end-of-phase steps start.
  expireLastingEffects(ctx, "endOfTurn");
  // …and "until your next turn ends" (§22), which is the same timing point for a different player's clock.
  expirePlayerTurnEffects(ctx, playerId);
  // …and "attacked this turn" is empty until the next turn begins, so the end-of-phase steps and the villain phase
  // never read the last player's attacks as their own (§14).
  ctx.state = { ...ctx.state, attackedThisTurn: {} };
  advanceAfterTurn(ctx, step.remainingPlayerIds);
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
    readyOrAnnounce(ctx, player.identity.instanceId);
    for (const id of mustPlayer(ctx.state, player.playerId).playArea) readyOrAnnounce(ctx, id);
    // Every card the player controls readies, not just the play-area list: an upgrade attached to an identity
    // (Focused Rage, Web-Shooter) or to another card lives in its host's `attachments` instead.
    for (const id of cardsInPlay(ctx.state)) {
      if (controllerOf(ctx.state, id) === player.playerId) readyOrAnnounce(ctx, id);
    }
  }
  for (const id of ctx.state.villainArea) readyOrAnnounce(ctx, id);
  for (const villain of undefeatedVillains(ctx.state)) readyOrAnnounce(ctx, villain.instanceId);
  setStep(ctx, { phase: "villain", kind: "placeThreat" });
  clearAbilityUses(ctx, "phase");
  ctx.state = { ...ctx.state, playedThisPhase: {} };
  // RRG 1.8 "End of Player Phase" (p. 18) step 5, "Resolve any 'when/after the [player] phase ends' effects", as an event
  // when an ability listens (docs/phase7-wave3.md §3.2); its apply step then resolves the delayed effects below.
  const ending: TriggerEvent = { kind: "phaseEnding", phase: "player" };
  const listened = heard(ctx.state, ctx.deps, ending);
  const delayed = listened ? [] : takeDelayed(ctx, "endOfPhase");
  expireLastingEffects(ctx, "endOfPhase");
  // Pushed first, so it resolves after everything the player phase's end queues and before step one.
  pushIfHeard(ctx, { kind: "phaseBeginning", phase: "villain" });
  announce(ctx, { kind: "playerPhaseEnded" });
  if (listened) {
    pushEvent(ctx, ending);
    return;
  }
  // "At the end of the phase, …" (`atEndOfPhase`; docs/phase7-wave2.md §3.1, §3.4), after "until the end of the phase"
  // effects expire, as RRG 1.8 "Lasting Effects" orders the round's.
  pushDelayed(ctx, delayed);
}

/** The delayed effects waiting on this timing point, marked fired (they resolve through the stack next). */
function takeDelayed(
  ctx: Ctx,
  kind: "endOfPhase" | "endOfRound",
): readonly Extract<LastingEffect, { kind: "delayedEffects" }>[] {
  const delayed = ctx.state.lastingEffects.filter(
    (effect): effect is Extract<LastingEffect, { kind: "delayedEffects" }> =>
      effect.kind === "delayedEffects" && effect.duration.kind === kind,
  );
  for (const effect of delayed) endLastingEffect(ctx, effect.id, "fired");
  return delayed;
}

function pushDelayed(ctx: Ctx, delayed: readonly Extract<LastingEffect, { kind: "delayedEffects" }>[]): void {
  for (const effect of [...delayed].reverse()) pushEffects(ctx, { effects: effect.effects, ...effect.scope });
}

/**
 * RRG "Lasting Effects": "until the end of the round" effects expire just
 * before "at the end of the round" delayed effects initiate. The delayed
 * effects resolve through the stack, then the round actually ends.
 */
function executeEndOfRound(ctx: Ctx, step: Extract<GameStep, { kind: "endOfRound" }>): void {
  if (!step.delayedResolved) {
    // RRG 1.8 "Villain Phase" (p. 47) step 6: "until the end of the phase/round" effects end (6a), then "when/after the
    // [villain] phase ends" and "when/after the round ends" resolve (6b) — one timing point, an event when an ability
    // listens (docs/phase7-wave3.md §3.2), whose apply step resolves the delayed effects.
    const ending: TriggerEvent = { kind: "phaseEnding", phase: "villain" };
    const listened = heard(ctx.state, ctx.deps, ending);
    // The villain phase and the round end together: "at the end of the phase" effects first, then the round's.
    const phaseDelayed = listened ? [] : takeDelayed(ctx, "endOfPhase");
    const delayed = listened ? [] : takeDelayed(ctx, "endOfRound");
    expireLastingEffects(ctx, "endOfPhase");
    expireLastingEffects(ctx, "endOfRound");
    setStep(ctx, { phase: "villain", kind: "endOfRound", delayedResolved: true });
    if (listened) pushEvent(ctx, ending);
    else pushDelayed(ctx, [...phaseDelayed, ...delayed]);
    return;
  }
  for (const player of ctx.state.players) {
    updatePlayer(ctx, player.playerId, (p) => ({
      ...p,
      identity: { ...p.identity, changedFormThisRound: false },
    }));
  }
  clearAbilityUses(ctx, "round");
  // "Max X per round" and "first … each round" count again from zero.
  ctx.state = {
    ...ctx.state,
    round: ctx.state.round + 1,
    playedThisRound: {},
    playedThisPhase: {},
    playedByPlayerThisRound: {},
    // "…revealed each round" counts again from zero (docs/phase7-wave3.md §3.8).
    ...(ctx.state.revealedThisRound ? { revealedThisRound: [] } : {}),
  };
  emit(ctx, { type: "roundStarted", round: ctx.state.round });
  beginPlayerPhase(ctx);
  announce(ctx, { kind: "villainPhaseEnded" });
}
