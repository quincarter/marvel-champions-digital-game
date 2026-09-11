/**
 * What a player may do right now, for the client's "Legal now", "Why illegal?"
 * and legal-move highlighting (PLAN.md Phase 4).
 *
 * Every candidate is decided by the engine's own command handlers: each one is
 * probed through the pure `applyCommand`, so a listed action is exactly one the
 * engine accepts and an illegal one carries the engine's own error code and
 * message. Nothing here restates a rule. Payments are not enumerated: an action
 * is legal if some payment from the player's resources works, and `example`
 * carries the smallest one found (resource abilities first, then hand cards by
 * resources, resource cards first). The client still lets the player choose
 * what to pay with.
 */

import type { AbilityId, AnyCard } from "@mc/content";
import { DEFAULT_DEPS, type AbilityCost, type AbilityDefinition, type EngineDeps } from "./abilities.js";
import { paymentOptions, paymentsFromOptionIds } from "./actions.js";
import type { PendingChoice } from "./choices.js";
import type { Command, CostChoices, Payment } from "./commands.js";
import { createCtx } from "./ctx.js";
import { applyCommand } from "./engine.js";
import type { EngineErrorCode } from "./errors.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { cardOf, getPlayer, isMinion, playerOrder, zoneContents } from "./query.js";
import { attachmentHostCandidates } from "./resolve/index.js";
import { printedResources } from "./resources.js";
import { activeAbilityRefs, cardsInPlay, controllerOf, printedAbilityRefs, type EffectContext } from "./select.js";
import type { GameState } from "./state.js";

/** One thing a player could do on their turn, independent of target and payment. */
export type ActionRef =
  | { readonly kind: "playCard"; readonly instanceId: InstanceId }
  | { readonly kind: "useAbility"; readonly instanceId: InstanceId; readonly abilityId: AbilityId }
  /** `instanceId` is the attacker. */
  | { readonly kind: "basicAttack"; readonly instanceId: InstanceId }
  /** `instanceId` is the thwarter. */
  | { readonly kind: "basicThwart"; readonly instanceId: InstanceId }
  | { readonly kind: "basicRecover" }
  | { readonly kind: "changeForm" }
  | { readonly kind: "endTurn" };

/** A target that exists but can't be chosen right now, and the engine's reason. */
export interface BlockedTarget {
  readonly instanceId: InstanceId;
  readonly reason: EngineErrorCode;
  readonly message: string;
}

export interface LegalAction {
  readonly action: ActionRef;
  /**
   * A complete command the engine accepts right now: the first legal target,
   * the smallest working payment found, and any cost picks filled in.
   */
  readonly example: Command;
  /**
   * Where the action can be aimed: enemies for a basic attack, schemes for a
   * basic thwart, hosts for an upgrade, or the card a cost picks ("pay the
   * printed cost of an ally in a discard pile"). Empty when it needs none.
   */
  readonly targets: readonly InstanceId[];
  /** Targets that exist but are illegal right now ("Why can't I attack Klaw?"). */
  readonly blockedTargets: readonly BlockedTarget[];
  /** Players who may control the card, for "play under any player's control" cards. */
  readonly controllers?: readonly PlayerId[];
  /** True when the action costs resources, so the client opens the payment step. */
  readonly needsPayment: boolean;
}

export interface IllegalAction {
  readonly action: ActionRef;
  /** The engine's error code: `wrong_form`, `already_exhausted`, `insufficient_resources`, `no_valid_target`, … */
  readonly reason: EngineErrorCode;
  /** The engine's explanation, suitable for "Why illegal?". */
  readonly message: string;
  readonly blockedTargets: readonly BlockedTarget[];
}

export type LegalActions =
  | { readonly kind: "gameOver" }
  /** A choice is open; its `options` are every legal answer. It may belong to another player. */
  | { readonly kind: "choice"; readonly choice: PendingChoice }
  /** Not this player's turn (`activePlayerId` is null outside the player phase, e.g. while the villain acts). */
  | { readonly kind: "notYourTurn"; readonly activePlayerId: PlayerId | null }
  | { readonly kind: "turn"; readonly legal: readonly LegalAction[]; readonly illegal: readonly IllegalAction[] };

type Probe = { readonly ok: true } | { readonly ok: false; readonly reason: EngineErrorCode; readonly message: string };

function probe(state: GameState, deps: EngineDeps, command: Command): Probe {
  const result = applyCommand(state, command, deps);
  return result.ok ? { ok: true } : { ok: false, reason: result.error.code, message: result.error.message };
}

interface Variant {
  readonly target: InstanceId | null;
  readonly controllerId?: PlayerId;
  readonly build: (payment: readonly Payment[]) => Command;
}

type Evaluated = { readonly legal: LegalAction } | { readonly illegal: IllegalAction };

const resourceCount = (state: GameState, id: InstanceId): number => {
  const card = cardOf(state, id);
  if (!card) return 0;
  const pool = printedResources(card);
  return pool.physical + pool.mental + pool.energy + pool.wild;
};

const isResourceCard = (state: GameState, id: InstanceId): number => Number(cardOf(state, id)?.type === "resource");

/**
 * Everything the player could spend, in the order a payment draws on it:
 * resource abilities (no card lost), then hand cards with the most resources
 * first, resource cards before other cards on a tie.
 */
function spendOrder(state: GameState, deps: EngineDeps, playerId: PlayerId, reserved: ReadonlySet<InstanceId>): readonly Payment[] {
  const payments = paymentsFromOptionIds(paymentOptions(createCtx(state, deps), playerId, null).map((o) => o.optionId));
  const abilities = payments.filter((p) => "ability" in p);
  const hand = payments.flatMap((p) => ("fromHand" in p && !reserved.has(p.fromHand) ? [p.fromHand] : []));
  hand.sort((a, b) => resourceCount(state, b) - resourceCount(state, a) || isResourceCard(state, b) - isResourceCard(state, a));
  return [...abilities, ...hand.map((fromHand) => ({ fromHand }))];
}

/**
 * The payments tried when deciding legality: everything, then hand cards only
 * (a resource ability can conflict with the action's own cost, e.g. both
 * exhausting the same card).
 */
function wallets(spend: readonly Payment[]): readonly (readonly Payment[])[] {
  const handOnly = spend.filter((p) => "fromHand" in p);
  return handOnly.length === spend.length ? [spend] : [spend, handOnly];
}

/** "Choose and discard N cards" cost picks: the cards worth the fewest resources, keeping resource cards for paying. */
function discardPicks(state: GameState, playerId: PlayerId, source: InstanceId, cost: AbilityCost | undefined): readonly InstanceId[] {
  const min = cost?.discardFromHand?.min ?? 0;
  if (min === 0) return [];
  const hand = (getPlayer(state, playerId)?.hand ?? []).filter((id) => id !== source);
  const cheapest = [...hand].sort((a, b) => resourceCount(state, a) - resourceCount(state, b) || isResourceCard(state, a) - isResourceCard(state, b));
  return cheapest.slice(0, min);
}

/** The `costChoices` to try, one per candidate for a "pay the printed cost of …" pick. */
function costChoiceSets(
  state: GameState,
  playerId: PlayerId,
  cost: AbilityCost | undefined,
  picks: readonly InstanceId[],
): readonly { readonly costChoices: CostChoices | undefined; readonly target: InstanceId | null }[] {
  const base: CostChoices = cost?.discardFromHand ? { discard: picks } : {};
  const baseChoices = Object.keys(base).length > 0 ? base : undefined;
  const pay = cost?.payPrintedCostOf;
  if (!pay) return [{ costChoices: baseChoices, target: null }];
  const owners = pay.from.player === "you" ? [playerId] : playerOrder(state).map((p) => p.playerId);
  const candidates = owners.flatMap((owner) => zoneContents(state, { kind: pay.from.zone, playerId: owner }));
  // With nothing to pick, one bare variant lets the engine say why.
  if (candidates.length === 0) return [{ costChoices: baseChoices, target: null }];
  return candidates.map((candidate) => ({ costChoices: { ...base, [pay.slot]: [candidate] }, target: candidate }));
}

function smallestPayment(state: GameState, deps: EngineDeps, variant: Variant, wallet: readonly Payment[]): readonly Payment[] {
  for (let size = 0; size < wallet.length; size++) {
    const payment = wallet.slice(0, size);
    if (probe(state, deps, variant.build(payment)).ok) return payment;
  }
  return wallet;
}

function evaluate(
  state: GameState,
  deps: EngineDeps,
  action: ActionRef,
  variants: readonly Variant[],
  tryWallets: readonly (readonly Payment[])[],
): Evaluated {
  const tried = variants.map((variant) => {
    let failure: Extract<Probe, { ok: false }> | null = null;
    for (const wallet of tryWallets) {
      const result = probe(state, deps, variant.build(wallet));
      if (result.ok) return { variant, wallet, failure: null };
      failure ??= result;
    }
    return { variant, wallet: null, failure };
  });
  const blockedTargets: BlockedTarget[] = [];
  for (const { variant, wallet, failure } of tried) {
    if (wallet || !failure || variant.target === null) continue;
    if (tried.some((t) => t.wallet && t.variant.target === variant.target)) continue;
    if (blockedTargets.some((b) => b.instanceId === variant.target)) continue;
    blockedTargets.push({ instanceId: variant.target, reason: failure.reason, message: failure.message });
  }
  const working = tried.filter((t) => t.wallet !== null);
  const [first] = working;
  if (!first?.wallet) {
    const failure = tried[0]?.failure;
    return {
      illegal: {
        action,
        reason: failure?.reason ?? "no_valid_target",
        message: failure?.message ?? "nothing to aim this at",
        blockedTargets,
      },
    };
  }
  const payment = smallestPayment(state, deps, first.variant, first.wallet);
  const targets = [...new Set(working.flatMap((t) => (t.variant.target === null ? [] : [t.variant.target])))];
  const controllers = variants.some((v) => v.controllerId !== undefined)
    ? [...new Set(working.flatMap((t) => (t.variant.controllerId ? [t.variant.controllerId] : [])))]
    : undefined;
  return {
    legal: {
      action,
      example: first.variant.build(payment),
      targets,
      blockedTargets,
      ...(controllers ? { controllers } : {}),
      needsPayment: payment.length > 0,
    },
  };
}

/** The action ability an event resolves when played from hand (none for interrupt/response events). */
function eventAction(deps: EngineDeps, card: AnyCard): AbilityDefinition | undefined {
  if (card.type !== "event") return undefined;
  for (const ref of printedAbilityRefs(card)) {
    const definition = deps.abilities[ref.id];
    if (definition?.trigger.kind === "action") return definition;
  }
  return undefined;
}

function evaluatePlay(state: GameState, deps: EngineDeps, playerId: PlayerId, id: InstanceId): Evaluated | null {
  const card = cardOf(state, id);
  if (!card) return null;
  const cost = eventAction(deps, card)?.cost;
  const picks = discardPicks(state, playerId, id, cost);
  const spend = spendOrder(state, deps, playerId, new Set([id, ...picks]));
  const context: EffectContext = { selfInstanceId: id, controllerId: playerId, event: null, bindings: {}, deps };
  const candidateHosts = card.type === "upgrade" && card.attachesTo ? attachmentHostCandidates(state, card.attachesTo, context) : [];
  // With no candidate host, one host-less variant lets the engine say why.
  const hosts: readonly (InstanceId | null)[] = candidateHosts.length > 0 ? candidateHosts : [null];
  const restrictions = "playRestrictions" in card ? card.playRestrictions : undefined;
  const controllers: readonly (PlayerId | undefined)[] = restrictions?.anyPlayerControl ? playerOrder(state).map((p) => p.playerId) : [undefined];
  const variants: Variant[] = [];
  for (const host of hosts) {
    for (const { costChoices, target } of costChoiceSets(state, playerId, cost, picks)) {
      for (const controllerId of controllers) {
        variants.push({
          target: host ?? target,
          ...(controllerId ? { controllerId } : {}),
          build: (payment) => ({
            type: "playCard",
            playerId,
            cardInstanceId: id,
            payment,
            attachToInstanceId: host,
            ...(costChoices ? { costChoices } : {}),
            ...(controllerId && controllerId !== playerId ? { controllerId } : {}),
          }),
        });
      }
    }
  }
  return evaluate(state, deps, { kind: "playCard", instanceId: id }, variants, wallets(spend));
}

function evaluateAbility(state: GameState, deps: EngineDeps, playerId: PlayerId, instanceId: InstanceId, abilityId: AbilityId): Evaluated {
  const cost = deps.abilities[abilityId]?.cost;
  const picks = discardPicks(state, playerId, instanceId, cost);
  const spend = spendOrder(state, deps, playerId, new Set(picks));
  const variants: Variant[] = costChoiceSets(state, playerId, cost, picks).map(({ costChoices, target }) => ({
    target,
    build: (payment) => ({ type: "useAbility", playerId, cardInstanceId: instanceId, abilityId, payment, ...(costChoices ? { costChoices } : {}) }),
  }));
  return evaluate(state, deps, { kind: "useAbility", instanceId, abilityId }, variants, wallets(spend));
}

/** Action abilities the player could trigger: on cards they control, and "Hero Action" text on encounter cards. */
function actionAbilities(state: GameState, deps: EngineDeps, playerId: PlayerId): readonly { readonly instanceId: InstanceId; readonly abilityId: AbilityId }[] {
  const found: { instanceId: InstanceId; abilityId: AbilityId }[] = [];
  for (const id of cardsInPlay(state)) {
    const controller = controllerOf(state, id);
    if (controller !== null && controller !== playerId) continue;
    for (const ref of activeAbilityRefs(state, id)) {
      if (deps.abilities[ref.id]?.trigger.kind === "action") found.push({ instanceId: id, abilityId: ref.id });
    }
  }
  return found;
}

const NO_PAYMENT: readonly (readonly Payment[])[] = [[]];

const simple = (state: GameState, deps: EngineDeps, action: ActionRef, command: Command): Evaluated =>
  evaluate(state, deps, action, [{ target: null, build: () => command }], NO_PAYMENT);

/**
 * Every action `playerId` could take right now, split into legal (with an
 * example command and legal targets) and illegal (with the engine's reason).
 * Outside the player's own turn it says what the game is waiting on instead.
 */
export function legalActions(state: GameState, playerId: PlayerId, deps: EngineDeps = DEFAULT_DEPS): LegalActions {
  if (state.outcome) return { kind: "gameOver" };
  if (state.pendingChoice) return { kind: "choice", choice: state.pendingChoice };
  const step = state.step;
  if (step.phase !== "player" || step.kind !== "turn") return { kind: "notYourTurn", activePlayerId: null };
  if (step.activePlayerId !== playerId) return { kind: "notYourTurn", activePlayerId: step.activePlayerId };
  const player = getPlayer(state, playerId);
  if (!player) return { kind: "notYourTurn", activePlayerId: step.activePlayerId };

  const results: Evaluated[] = [];
  for (const id of player.hand) {
    const evaluated = evaluatePlay(state, deps, playerId, id);
    if (evaluated) results.push(evaluated);
  }
  for (const { instanceId, abilityId } of actionAbilities(state, deps, playerId)) {
    results.push(evaluateAbility(state, deps, playerId, instanceId, abilityId));
  }

  const characters = [player.identity.instanceId, ...player.playArea.filter((id) => cardOf(state, id)?.type === "ally")];
  const enemies = [
    ...(state.villain.defeated ? [] : [state.villain.instanceId]),
    ...cardsInPlay(state).filter((id) => isMinion(state, id)),
  ];
  const schemes = [
    state.mainScheme.instanceId,
    ...state.villainArea.filter((id) => {
      const type = cardOf(state, id)?.type;
      return type === "side_scheme" || type === "player_side_scheme";
    }),
  ];
  for (const attacker of characters) {
    const variants: Variant[] = enemies.map((target) => ({
      target,
      build: () => ({ type: "basicAttack", playerId, attackerInstanceId: attacker, targetInstanceId: target }),
    }));
    results.push(evaluate(state, deps, { kind: "basicAttack", instanceId: attacker }, variants, NO_PAYMENT));
  }
  for (const thwarter of characters) {
    const variants: Variant[] = schemes.map((target) => ({
      target,
      build: () => ({ type: "basicThwart", playerId, thwarterInstanceId: thwarter, schemeInstanceId: target }),
    }));
    results.push(evaluate(state, deps, { kind: "basicThwart", instanceId: thwarter }, variants, NO_PAYMENT));
  }
  results.push(simple(state, deps, { kind: "basicRecover" }, { type: "basicRecover", playerId }));
  results.push(simple(state, deps, { kind: "changeForm" }, { type: "changeForm", playerId }));
  results.push(simple(state, deps, { kind: "endTurn" }, { type: "endTurn", playerId }));

  return {
    kind: "turn",
    legal: results.flatMap((r) => ("legal" in r ? [r.legal] : [])),
    illegal: results.flatMap((r) => ("illegal" in r ? [r.illegal] : [])),
  };
}
