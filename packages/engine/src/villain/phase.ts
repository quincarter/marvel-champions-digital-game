/**
 * The villain phase, steps one to five (RRG "Villain Phase"). Everything here
 * is forced procedure: the villain side never "chooses" — where the rules leave
 * a decision open it is parked as a `PendingChoice` for the player the rules
 * name (see `authority.ts`). Attacks, schemes and reveals run through the same
 * stack frames as every other game action (`resolve/`).
 */

import { emit, requestChoice, setStep, updateInstance, type Ctx } from "../ctx.js";
import { dealEncounterCardTo } from "../effects.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { statusActive } from "../keywords.js";
import {
  characterProfile,
  countSchemeIcons,
  getPlayer,
  isMinion,
  mainSchemeStage,
  mustCardOf,
  mustPlayer,
  nextClockwisePlayer,
  playerOrder,
  scale,
} from "../query.js";
import { pushEvent, pushRevealFrame } from "../resolve/index.js";
import type { GameState, GameStep } from "../state.js";

const livePlayers = (state: GameState, ids: readonly PlayerId[]): readonly PlayerId[] =>
  ids.filter((id) => getPlayer(state, id)?.eliminated === false);

// RRG "Villain Phase" step 1: acceleration field + acceleration icons + acceleration tokens.
// The step stays current while that threat (and its interrupts/responses) resolves, so
// "after placing threat here during step one of the villain phase" can see it.
export function executePlaceThreat(ctx: Ctx): void {
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

// RRG "Villain Phase" step 2: the villain activates once per player, in player
// order; after each activation, each minion engaged with that player activates.
export function executeEnemyActivations(ctx: Ctx, step: Extract<GameStep, { kind: "enemyActivations" }>): void {
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
    // The RRG says each engaged minion activates but not in what order; the
    // engaged player picks (the table convention; see docs/phase3-encounter-ai.md).
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
export function executeDealEncounterCards(ctx: Ctx): void {
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

// RRG "Villain Phase" step 4: in player order, each player reveals the cards dealt to them, one at a time.
export function executeRevealEncounterCards(ctx: Ctx, remainingPlayerIds: readonly PlayerId[]): void {
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

// RRG "Villain Phase" step 5: the first player token passes clockwise.
export function executePassFirstPlayer(ctx: Ctx): void {
  const next = nextClockwisePlayer(ctx.state, ctx.state.firstPlayerId);
  if (next) {
    ctx.state = { ...ctx.state, firstPlayerId: next.playerId };
    emit(ctx, { type: "firstPlayerChanged", playerId: next.playerId });
  }
  setStep(ctx, { phase: "villain", kind: "endOfRound" });
}
