/**
 * The villain phase, steps one to five (RRG "Villain Phase"). Everything here
 * is forced procedure: the villain side never "chooses" — where the rules leave
 * a decision open it is parked as a `PendingChoice` for the player the rules
 * name (see `authority.ts`). Attacks, schemes and reveals run through the same
 * stack frames as every other game action (`resolve/`).
 */

import { emit, requestChoice, setStep, updateInstance, type Ctx } from "../ctx.js";
import { dealEncounterCardTo, setActiveVillain } from "../effects.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { statusActive } from "../keywords.js";
import { iconsInPlay } from "../rules.js";
import {
  activeVillainIdFor,
  areaOfPlayer,
  villainOf,
  getPlayer,
  isMinion,
  mainSchemeValue,
  sharedMainSchemes,
  mustCardOf,
  mustPlayer,
  nextClockwisePlayer,
  nextVillainInActivationOrder,
  playerOrder,
} from "../query.js";
import { heard, pushEvent, pushEvents, pushRevealFrame } from "../resolve/index.js";
import { cardsInPlay, gliderMainSchemeId, offSchemeAccelerationTokens } from "../select.js";
import type { TriggerEvent } from "../trigger-events.js";
import type { GameState, GameStep } from "../state.js";

const livePlayers = (state: GameState, ids: readonly PlayerId[]): readonly PlayerId[] =>
  ids.filter((id) => getPlayer(state, id)?.eliminated === false);

// RRG "Villain Phase" step 1: acceleration field + acceleration icons + acceleration tokens.
// The step stays current while that threat (and its interrupts/responses) resolves, so
// "after placing threat here during step one of the villain phase" can see it.
export function executePlaceThreat(ctx: Ctx): void {
  const step = ctx.state.step;
  if (step.kind === "placeThreat" && !step.placed) {
    setStep(ctx, { phase: "villain", kind: "placeThreat", placed: true });
    if (ctx.state.gameAreas.length === 0) {
      // Every main scheme in play gains threat, each from its own acceleration and tokens plus the icons in play: MC21
      // p. 10, "Each main scheme gains threat during step 1 of the villain phase, and they are each affected by any
      // acceleration and crisis icons in play" (docs/phase7-wave4.md §3.2). One main scheme is every other game.
      // Tokens on other cards add to "the main scheme" (docs/phase7-wave5.md §3.4).
      const offScheme = offSchemeAccelerationTokens(ctx.state);
      const tokensGoTo = gliderMainSchemeId(ctx.state, ctx.deps) ?? ctx.state.mainScheme.instanceId;
      const events = sharedMainSchemes(ctx.state).map((scheme) => ({
        kind: "placeThreat" as const,
        schemeInstanceId: scheme.instanceId,
        amount:
          mainSchemeValue(ctx.state, "acceleration", ctx.deps, scheme) +
          scheme.accelerationTokens +
          (scheme.instanceId === tokensGoTo ? offScheme : 0) +
          iconsInPlay(ctx.state, ctx.deps, "acceleration"),
        sourceInstanceId: null,
      }));
      if (events.length === 1) pushEvent(ctx, events[0]!);
      else pushEvents(ctx, events);
      return;
    }
    // Separate game areas (docs/phase7-wave2.md §3.1): each area places threat on its own stage, from its own
    // acceleration, tokens and icons. The central stage's acceleration tokens add to every area's step one — RRG 1.8
    // "Acceleration Token" (p. 5) adds their threat "to the main scheme during step one", and the central stage (The
    // Master of Time 2B) prints no values; docs/phase7-wave2.md §4.3's proposed reading, unconfirmed.
    pushEvents(
      ctx,
      ctx.state.gameAreas.flatMap((area) => {
        if (!area.mainScheme) return [];
        const amount =
          mainSchemeValue(ctx.state, "acceleration", ctx.deps, area.mainScheme) +
          area.mainScheme.accelerationTokens +
          ctx.state.mainScheme.accelerationTokens +
          iconsInPlay(ctx.state, ctx.deps, "acceleration", area);
        return [
          {
            kind: "placeThreat" as const,
            schemeInstanceId: area.mainScheme.instanceId,
            amount,
            sourceInstanceId: null,
          },
        ];
      }),
    );
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
  // "After resolving step one of the villain phase" (docs/phase7-wave3.md §3.2): step one's threat and its own windows
  // have resolved, and step two waits for this response window. Pushed only when an ability is listening.
  const resolved: TriggerEvent = { kind: "villainStepResolved", step: "placeThreat" };
  if (heard(ctx.state, ctx.deps, resolved)) pushEvent(ctx, resolved);
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
    // Only the active villain activates (The Wrecking Crew insert, "The Active Villain"), read at each player's
    // activation rather than fixed at the start of the step, so a counter moved during one player's activations
    // changes who activates against the next. Proposed reading of docs/phase7-wave1.md §4.10: the insert says
    // only "the active villain will activate".
    // With separate game areas the villain is the one in that player's area (docs/phase7-wave2.md §3.1). A defeated
    // villain with no successor (Kang (I) under `victory: "cardAbility"`) does not activate.
    // FAQ The Sinister Six (RRG 1.8 p. 62): "What happens if a villain needs to activate and there are one or more
    // villains in play but none of them have the active counter? A: Place the active counter on the villain with the
    // lowest activation order value and continue that activation." (docs/phase7-wave5.md §3.1)
    if (
      ctx.state.scenarioRules.activeCounter === "nextInActivationOrder" &&
      villainOf(ctx.state, ctx.state.activeVillainId)?.defeated !== false
    ) {
      const lowest = nextVillainInActivationOrder(ctx.state, null);
      if (lowest) setActiveVillain(ctx, lowest, "noActiveVillain");
    }
    const villainId = activeVillainIdFor(ctx.state, areaOfPlayer(ctx.state, current.playerId));
    if (villainId && villainOf(ctx.state, villainId)?.defeated === false) {
      activateEnemy(ctx, villainId, current.playerId);
      return;
    }
    // No villain in play (docs/phase7-wave5.md §3.2): the villain's activation is still announced, with no enemy, so
    // "When a villain would activate, if no villain is in play, …" can put one in; with nothing listening it is skipped.
    const activation = current.identity.form === "hero" ? "attack" : "scheme";
    const announced: TriggerEvent = {
      kind: "enemyActivating",
      enemyInstanceId: null,
      activation,
      playerId: current.playerId,
    };
    if (heard(ctx.state, ctx.deps, announced)) pushEvent(ctx, announced);
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
    // The engaged player chooses the order: RRG 1.8 "Villain Phase" (p. 47) step 2b, "Each minion engaged with the
    // player activates against them, in the order of that player's choice"; "Activation" (p. 6), "followed by minion
    // activations in the order of your choice".
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

/**
 * RRG "Activation" (p. 6): attack a player in hero form, scheme against a player in alter-ego form.
 *
 * The status check comes first: FAQ "Norman Osborn (#1A)" (p. 58), "Because status cards take priority over all
 * other abilities, a stun status card will prevent Norman Osborn's activation." Only then is the activation
 * initiated, even for a printed "—" ATK or SCH, so a "When [enemy] would attack … instead" replacement has an event
 * to replace. An activation nothing replaces is skipped when it applies (`dashedStatSkipsActivation`).
 *
 * "When an enemy would activate" (docs/phase7-wave5.md §3.2; Web Binding, `sm` 27006): an activation a status card
 * does not replace is announced as `enemyActivating` when an ability listens, and continues from its apply step
 * (`continueActivation`) unless an interrupt cancelled it.
 */
export function activateEnemy(ctx: Ctx, enemyId: InstanceId, playerId: PlayerId): void {
  const player = mustPlayer(ctx.state, playerId);
  const activation = player.identity.form === "hero" ? "attack" : "scheme";
  emit(ctx, { type: "enemyActivated", enemyInstanceId: enemyId, activation, playerId });
  if (activation === "attack" && statusActive(ctx.state, enemyId, "stunned", ctx.deps)) {
    // RRG "Stun": a stunned enemy discards the status instead of attacking.
    updateInstance(ctx, enemyId, (i) => ({ ...i, statuses: { ...i.statuses, stunned: 0 } }));
    emit(ctx, { type: "statusRemoved", instanceId: enemyId, status: "stunned", reason: "cancelledAttack" });
    return;
  }
  if (activation === "scheme" && statusActive(ctx.state, enemyId, "confused", ctx.deps)) {
    // RRG "Confuse": a confused enemy discards the status instead of scheming.
    updateInstance(ctx, enemyId, (i) => ({ ...i, statuses: { ...i.statuses, confused: 0 } }));
    emit(ctx, { type: "statusRemoved", instanceId: enemyId, status: "confused", reason: "cancelledSchemeOrThwart" });
    return;
  }
  const announced: TriggerEvent = { kind: "enemyActivating", enemyInstanceId: enemyId, activation, playerId };
  if (heard(ctx.state, ctx.deps, announced)) {
    pushEvent(ctx, announced);
    return;
  }
  initiateActivation(ctx, enemyId, playerId, activation);
}

function initiateActivation(ctx: Ctx, enemyId: InstanceId, playerId: PlayerId, activation: "attack" | "scheme"): void {
  if (activation === "attack") {
    pushEvent(ctx, {
      kind: "enemyAttack",
      enemyInstanceId: enemyId,
      attackedPlayerId: playerId,
      targetPlayerId: playerId,
      targetInstanceId: mustPlayer(ctx.state, playerId).identity.instanceId,
    });
    return;
  }
  pushEvent(ctx, { kind: "enemyScheme", enemyInstanceId: enemyId, playerId });
}

/**
 * The apply step of `enemyActivating` (docs/phase7-wave5.md §3.2), reached only when no interrupt cancelled it: the
 * activation continues. With no enemy named (the villain's activation with no villain in play), it is "the villain"
 * now — Sinister Synchronization 1B: "When a villain would activate, if no villain is in play, resolve this card's
 * 'Ambush!' ability. Continue that activation." A villain the interrupt put into play enters with no status card, so
 * the activation is initiated at once; with still no villain in play nothing activates.
 */
export function continueActivation(ctx: Ctx, event: Extract<TriggerEvent, { kind: "enemyActivating" }>): void {
  if (event.enemyInstanceId) {
    if (cardsInPlay(ctx.state).includes(event.enemyInstanceId))
      initiateActivation(ctx, event.enemyInstanceId, event.playerId, event.activation);
    return;
  }
  const villainId = activeVillainIdFor(ctx.state, areaOfPlayer(ctx.state, event.playerId));
  if (villainId && villainOf(ctx.state, villainId)?.defeated === false) activateEnemy(ctx, villainId, event.playerId);
}

// RRG "Villain Phase" step 3 + "Hazard Icon": one card each, then one per hazard icon in player order.
export function executeDealEncounterCards(ctx: Ctx): void {
  const order = playerOrder(ctx.state);
  for (const player of order) dealEncounterCardTo(ctx, player.playerId);
  const hazards = iconsInPlay(ctx.state, ctx.deps, "hazard");
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
