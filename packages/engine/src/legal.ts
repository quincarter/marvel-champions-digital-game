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

import type { AbilityId, ResourceIconType } from "@mc/content";
import { DEFAULT_DEPS, type AbilityCost, type EngineDeps } from "./abilities.js";
import {
  basicPowerCost,
  costAsDetermined,
  eventActionAbility,
  generatedResources,
  handCardResources,
  paymentOptions,
  paymentsFromOptionIds,
  defaultInPlayPicks,
  planCost,
  playableFromAttachment,
  playableFromDiscard,
  playCostReductionFault,
  playRequirement,
} from "./actions.js";
import type { PendingChoice } from "./choices.js";
import type { Command, CostChoices, CostSelection, Payment } from "./commands.js";
import { createCtx } from "./ctx.js";
import { applyCommand } from "./engine.js";
import { EngineInvariantError, type EngineErrorCode } from "./errors.js";
import type { InstanceId, PlayerId } from "./ids.js";
import {
  cardOf,
  cardZoneCandidates,
  getPlayer,
  heroFacesOf,
  isMinion,
  playerOrder,
  undefeatedVillains,
  mainSchemeStates,
  getInstance,
} from "./query.js";
import { attachmentHostCandidates } from "./resolve/index.js";
import { printedResources, requirementTotal, type ResolvedRequirement } from "./resources.js";
import { activeAbilityRefs, cardsInPlay, controllerOf, matchesQuery, type EffectContext } from "./select.js";
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
  /** `to` is set only for a three-sided identity, one action per reachable form (docs/phase7-wave2.md §3.2). */
  | { readonly kind: "changeForm"; readonly to?: "alterEgo" | { readonly heroForm: number } }
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
  /**
   * An either/or cost ("Choose to either exhaust your hero or spend 2 resources of any type →"; docs/phase7-wave3.md
   * §3.36): the branches (`AbilityCost.either` indexes) that can be paid right now. The client asks which one and
   * sends it as `costSelection.branch`; `example` uses the first. Absent for any other cost.
   */
  readonly costBranches?: readonly number[];
  /**
   * An "up to N" counter cost ("Remove up to 4 growth counters from Groot →"; §3.32): how many the player may remove
   * right now, sent as `costSelection.counters`. `example` removes the most. Absent for any other cost.
   */
  readonly costCounters?: { readonly min: number; readonly max: number };
}

export interface IllegalAction {
  readonly action: ActionRef;
  /**
   * The engine's error code: `wrong_form`, `already_exhausted`, `insufficient_resources`,
   * `no_valid_target`, `duplicate_unique_card`, …
   *
   * `duplicate_unique_card` and `no_valid_target` are easy to confuse and a client should
   * word them differently: `duplicate_unique_card` is the group-wide RRG "Unique Icon" rule
   * ("someone already has that card in play"), while a `no_valid_target` carrying a "max N
   * per player" message is the card's own printed play restriction, scoped to one player.
   */
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
  /** The either/or cost branch this variant pays (`costSelection.branch`), when the cost has one. */
  readonly branch?: number;
  readonly build: (payment: readonly Payment[]) => Command;
}

/**
 * One `CostSelection` per either/or branch (docs/phase7-wave3.md §3.36), so `legalActions` offers an ability whenever
 * any branch can be paid; `[undefined]` for any other cost, which keeps every other command exactly as it was.
 */
const branchSelections = (cost: AbilityCost | undefined): readonly (number | undefined)[] =>
  cost?.either ? cost.either.map((_, index) => index) : [undefined];

/** The `costCounters` range for an "up to N" counter cost, in the cost or any of its branches (§3.32). */
function counterRange(
  state: GameState,
  playerId: PlayerId,
  source: InstanceId,
  cost: AbilityCost | undefined,
): { readonly min: number; readonly max: number } | undefined {
  const counters = [cost?.spendCounters, ...(cost?.either ?? []).map((branch) => branch.spendCounters)].find(
    (component) => component?.upTo,
  );
  if (!counters) return undefined;
  const holder = counters.target === "identity" ? getPlayer(state, playerId)?.identity.instanceId : source;
  const held = holder ? (state.instances[holder]?.counters[counters.counterType] ?? 0) : 0;
  return { min: 1, max: Math.min(counters.amount, held) };
}

const withBranch = (branch: number | undefined): { readonly costSelection?: CostSelection } =>
  branch === undefined ? {} : { costSelection: { branch } };

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
 *
 * `payingFor` is the card the payment is for. It has to be named: a resource ability that only generates for one kind
 * of card (Expert Marksman: "a [wild] resource for an Arrow event") is offered only when that card matches. Asked with
 * no card, Expert Marksman was dropped from every wallet, so an Arrow event nobody could pay for from hand read as
 * unaffordable even with both Marksmen ready (2026-09-21 report, Cable Arrow: "need 1, paid 0").
 */
function spendOrder(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  reserved: ReadonlySet<InstanceId>,
  payingFor: InstanceId | null,
): readonly Payment[] {
  const payments = paymentsFromOptionIds(
    paymentOptions(createCtx(state, deps), playerId, null, payingFor).map((o) => o.optionId),
  );
  const abilities = payments.filter((p) => "ability" in p);
  const hand = payments.flatMap((p) => ("fromHand" in p && !reserved.has(p.fromHand) ? [p.fromHand] : []));
  hand.sort(
    (a, b) => resourceCount(state, b) - resourceCount(state, a) || isResourceCard(state, b) - isResourceCard(state, a),
  );
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

/**
 * "Discard N cards at random from your hand →" needs N cards the payment leaves in hand, so each wallet is also tried
 * with its last N hand cards kept back. The unchanged wallet is tried first; costs without the component are untouched.
 */
function leavingCardsToDiscard(
  tryWallets: readonly (readonly Payment[])[],
  cost: AbilityCost | undefined,
): readonly (readonly Payment[])[] {
  const keep = cost?.discardRandomFromHand ?? 0;
  if (keep <= 0) return tryWallets;
  return tryWallets.flatMap((wallet) => {
    const handIndexes = wallet.flatMap((entry, index) => ("fromHand" in entry ? [index] : []));
    const keptBack = new Set(handIndexes.slice(-keep));
    return [wallet, wallet.filter((_, index) => !keptBack.has(index))];
  });
}

/**
 * "Choose and discard N cards" cost picks: the cards worth the fewest resources, keeping resource cards for paying.
 *
 * A `filter` ("Discard a [physical] resource from your hand →", docs/phase7-wave2.md §19) narrows the candidates
 * first, so a hand with too few matching cards yields fewer than `min` picks and `planCost` refuses the cost — which
 * is what makes `legalActions` grey the ability out rather than offer an unpayable one.
 */
function discardPicks(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  source: InstanceId,
  cost: AbilityCost | undefined,
): readonly InstanceId[] {
  const min = cost?.discardFromHand?.min ?? 0;
  if (min === 0) return [];
  const filter = cost?.discardFromHand?.filter;
  const context: EffectContext = { selfInstanceId: source, controllerId: playerId, event: null, bindings: {}, deps };
  const hand = (getPlayer(state, playerId)?.hand ?? [])
    .filter((id) => id !== source)
    .filter((id) => !filter || matchesQuery(state, id, filter, context));
  const cheapest = [...hand].sort(
    (a, b) => resourceCount(state, a) - resourceCount(state, b) || isResourceCard(state, a) - isResourceCard(state, b),
  );
  return cheapest.slice(0, min);
}

/** The `costChoices` to try, one per candidate for a "pay the printed cost of …" pick. */
function costChoiceSets(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  source: InstanceId,
  cost: AbilityCost | undefined,
  picks: readonly InstanceId[],
): readonly { readonly costChoices: CostChoices | undefined; readonly target: InstanceId | null }[] {
  const base: CostChoices = {
    ...defaultInPlayPicks(state, deps, source, playerId, cost),
    ...(cost?.discardFromHand ? { discard: picks } : {}),
  };
  const baseChoices = Object.keys(base).length > 0 ? base : undefined;
  const pay = cost?.payPrintedCostOf;
  if (!pay) return [{ costChoices: baseChoices, target: null }];
  const owners = pay.from.player === "you" ? [playerId] : playerOrder(state).map((p) => p.playerId);
  const candidates = owners.flatMap((owner) => cardZoneCandidates(state, pay.from, owner));
  // With nothing to pick, one bare variant lets the engine say why.
  if (candidates.length === 0) return [{ costChoices: baseChoices, target: null }];
  return candidates.map((candidate) => ({ costChoices: { ...base, [pay.slot]: [candidate] }, target: candidate }));
}

/** The shortest prefix of `wallet` the engine accepts: the payment `example` and `suggested` both carry. */
function smallestPayment(
  state: GameState,
  deps: EngineDeps,
  build: Variant["build"],
  wallet: readonly Payment[],
): readonly Payment[] {
  for (let size = 0; size < wallet.length; size++) {
    const payment = wallet.slice(0, size);
    if (probe(state, deps, build(payment)).ok) return payment;
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
  const payment = smallestPayment(state, deps, first.variant.build, first.wallet);
  const targets = [...new Set(working.flatMap((t) => (t.variant.target === null ? [] : [t.variant.target])))];
  const controllers = variants.some((v) => v.controllerId !== undefined)
    ? [...new Set(working.flatMap((t) => (t.variant.controllerId ? [t.variant.controllerId] : [])))]
    : undefined;
  const costBranches = variants.some((v) => v.branch !== undefined)
    ? [...new Set(working.flatMap((t) => (t.variant.branch === undefined ? [] : [t.variant.branch])))].sort(
        (a, b) => a - b,
      )
    : undefined;
  return {
    legal: {
      action,
      example: first.variant.build(payment),
      targets,
      blockedTargets,
      ...(controllers ? { controllers } : {}),
      needsPayment: payment.length > 0,
      ...(costBranches ? { costBranches } : {}),
    },
  };
}

function evaluatePlay(state: GameState, deps: EngineDeps, playerId: PlayerId, id: InstanceId): Evaluated | null {
  const card = cardOf(state, id);
  if (!card) return null;
  const cost = costAsDetermined(state, deps, id, playerId, eventActionAbility(createCtx(state, deps), card)?.cost);
  const picks = discardPicks(state, deps, playerId, id, cost);
  const spend = spendOrder(state, deps, playerId, new Set([id, ...picks]), id);
  const context: EffectContext = { selfInstanceId: id, controllerId: playerId, event: null, bindings: {}, deps };
  const candidateHosts =
    card.type === "upgrade" && card.attachesTo ? attachmentHostCandidates(state, card.attachesTo, context) : [];
  // With no candidate host, one host-less variant lets the engine say why.
  const hosts: readonly (InstanceId | null)[] = candidateHosts.length > 0 ? candidateHosts : [null];
  const restrictions = "playRestrictions" in card ? card.playRestrictions : undefined;
  const controllers: readonly (PlayerId | undefined)[] = restrictions?.anyPlayerControl
    ? playerOrder(state).map((p) => p.playerId)
    : [undefined];
  const variants: Variant[] = [];
  // Each usable "reduce the cost to play that card" ability is its own variant, after the unreduced ones, so a card
  // that is affordable anyway is offered without it and one that is only affordable with it is still offered
  // (docs/phase7-wave3.md §3.20). The client decides whether to use it; this only makes the play reachable.
  const reducers = playCostReducers(state, deps, playerId, id);
  const reductionSets: readonly (readonly { instanceId: InstanceId; abilityId: AbilityId }[])[] = [
    [],
    ...reducers.map((reducer) => [reducer]),
  ];
  for (const reductions of reductionSets) {
    for (const host of hosts) {
      for (const { costChoices, target } of costChoiceSets(state, deps, playerId, id, cost, picks)) {
        for (const controllerId of controllers) {
          for (const branch of branchSelections(cost)) {
            variants.push({
              target: host ?? target,
              ...(controllerId ? { controllerId } : {}),
              ...(branch === undefined ? {} : { branch }),
              build: (payment) => ({
                type: "playCard",
                playerId,
                cardInstanceId: id,
                payment,
                attachToInstanceId: host,
                ...(costChoices ? { costChoices } : {}),
                ...(controllerId && controllerId !== playerId ? { controllerId } : {}),
                ...(reductions.length > 0 ? { costReductionAbilities: reductions } : {}),
                ...withBranch(branch),
              }),
            });
          }
        }
      }
    }
  }
  const evaluated = evaluate(
    state,
    deps,
    { kind: "playCard", instanceId: id },
    variants,
    leavingCardsToDiscard(wallets(spend), cost),
  );
  return withCounterRange(evaluated, counterRange(state, playerId, id, cost));
}

/** Adds `costCounters` to a legal action whose cost removes "up to N" counters (docs/phase7-wave3.md §3.32). */
const withCounterRange = (
  evaluated: Evaluated,
  range: { readonly min: number; readonly max: number } | undefined,
): Evaluated => ("legal" in evaluated && range ? { legal: { ...evaluated.legal, costCounters: range } } : evaluated);

/** The `playCostReduction` abilities `playerId` could use on playing this card right now (docs/phase7-wave3.md §3.20). */
function playCostReducers(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  cardInstanceId: InstanceId,
): readonly { readonly instanceId: InstanceId; readonly abilityId: AbilityId }[] {
  const found: { instanceId: InstanceId; abilityId: AbilityId }[] = [];
  for (const instanceId of cardsInPlay(state)) {
    if (controllerOf(state, instanceId) !== playerId) continue;
    for (const ref of activeAbilityRefs(state, instanceId, deps)) {
      if (!deps.abilities[ref.id]?.playCostReduction) continue;
      if (playCostReductionFault(state, deps, instanceId, ref.id, playerId, cardInstanceId)) continue;
      found.push({ instanceId, abilityId: ref.id });
    }
  }
  return found;
}

function evaluateAbility(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  instanceId: InstanceId,
  abilityId: AbilityId,
): Evaluated {
  const cost = costAsDetermined(state, deps, instanceId, playerId, deps.abilities[abilityId]?.cost);
  const picks = discardPicks(state, deps, playerId, instanceId, cost);
  const spend = spendOrder(state, deps, playerId, new Set(picks), null);
  const variants: Variant[] = costChoiceSets(state, deps, playerId, instanceId, cost, picks).flatMap(
    ({ costChoices, target }) =>
      branchSelections(cost).map((branch) => ({
        target,
        ...(branch === undefined ? {} : { branch }),
        build: (payment: readonly Payment[]): Command => ({
          type: "useAbility",
          playerId,
          cardInstanceId: instanceId,
          abilityId,
          payment,
          ...(costChoices ? { costChoices } : {}),
          ...withBranch(branch),
        }),
      })),
  );
  const evaluated = evaluate(
    state,
    deps,
    { kind: "useAbility", instanceId, abilityId },
    variants,
    leavingCardsToDiscard(wallets(spend), cost),
  );
  return withCounterRange(evaluated, counterRange(state, playerId, instanceId, cost));
}

/** Action abilities the player could trigger: on cards they control, and "Hero Action" text on encounter cards. */
function actionAbilities(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
): readonly { readonly instanceId: InstanceId; readonly abilityId: AbilityId }[] {
  const found: { instanceId: InstanceId; abilityId: AbilityId }[] = [];
  for (const id of cardsInPlay(state)) {
    const controller = controllerOf(state, id);
    if (controller !== null && controller !== playerId) continue;
    for (const ref of activeAbilityRefs(state, id, deps)) {
      const trigger = deps.abilities[ref.id]?.trigger;
      if (trigger?.kind !== "action") continue;
      // "First Player Action" (docs/phase7-wave3.md §3.13).
      if (trigger.firstPlayerOnly === true && playerId !== state.firstPlayerId) continue;
      found.push({ instanceId: id, abilityId: ref.id });
    }
  }
  return found;
}

const NO_PAYMENT: readonly (readonly Payment[])[] = [[]];

/**
 * The command for an action that costs no resources. `target` is the attack's
 * or thwart's target; the rest take none. Returns null for `playCard` and
 * `useAbility`, which are built by `payableFor` because they carry a payment.
 */
function basicCommand(playerId: PlayerId, action: ActionRef, target: InstanceId | null): Command | null {
  switch (action.kind) {
    case "basicAttack":
      return target === null
        ? null
        : { type: "basicAttack", playerId, attackerInstanceId: action.instanceId, targetInstanceId: target };
    case "basicThwart":
      return target === null
        ? null
        : { type: "basicThwart", playerId, thwarterInstanceId: action.instanceId, schemeInstanceId: target };
    case "basicRecover":
      return { type: "basicRecover", playerId };
    case "changeForm":
      return action.to === undefined
        ? { type: "changeForm", playerId }
        : { type: "changeForm", playerId, to: action.to };
    case "endTurn":
      return { type: "endTurn", playerId };
    default:
      return null;
  }
}

/** `basicCommand` where a command is certain: an untargeted action, or a target that was just enumerated. */
function mustBasicCommand(playerId: PlayerId, action: ActionRef, target: InstanceId | null): Command {
  const command = basicCommand(playerId, action, target);
  if (!command) throw new EngineInvariantError(`${action.kind} has no command for target ${target}`);
  return command;
}

const simple = (state: GameState, deps: EngineDeps, playerId: PlayerId, action: ActionRef): Evaluated =>
  evaluate(state, deps, action, [{ target: null, build: () => mustBasicCommand(playerId, action, null) }], NO_PAYMENT);

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
  // Hand cards, and discard pile cards whose own permission allows playing them from there (RRG 1.8 "Play Restrictions
  // and Permissions", p. 33).
  // Cards attached to a card that lets its controller play them from there (Hawkeye's Quiver; docs/phase7-wave2.md §3.10).
  // The attachments of *every* card in play, not just `cardsInPlay` itself: that list goes one level deep (an identity
  // and what is attached to it), and the Quiver is itself attached to Hawkeye, so an Arrow on it sat a level below and
  // was never considered at all — neither offered nor refused (2026-09-21 report).
  const attached = [
    ...new Set(cardsInPlay(state).flatMap((id) => [id, ...(getInstance(state, id)?.attachments ?? [])])),
  ].filter((id) => playableFromAttachment(state, deps, playerId, id));
  for (const id of [
    ...player.hand,
    ...player.discard.filter((id) => playableFromDiscard(state, deps, playerId, id)),
    ...attached,
  ]) {
    const evaluated = evaluatePlay(state, deps, playerId, id);
    if (evaluated) results.push(evaluated);
  }
  for (const { instanceId, abilityId } of actionAbilities(state, deps, playerId)) {
    results.push(evaluateAbility(state, deps, playerId, instanceId, abilityId));
  }

  const characters = [
    player.identity.instanceId,
    ...player.playArea.filter((id) => cardOf(state, id)?.type === "ally"),
  ];
  const enemies = [
    // Any undefeated villain, not only the active one (The Wrecking Crew insert: "Players may attack any villain").
    ...undefeatedVillains(state).map((villain) => villain.instanceId),
    ...cardsInPlay(state).filter((id) => isMinion(state, id)),
  ];
  const schemes = [
    ...mainSchemeStates(state).map((scheme) => scheme.instanceId),
    ...state.villainArea.filter((id) => {
      const type = cardOf(state, id)?.type;
      return type === "side_scheme" || type === "player_side_scheme";
    }),
  ];
  // A basic power with an additional "discard N cards" cost gets the cheapest picks filled in (`basicPowerCosts`).
  const withPicks = (character: InstanceId, power: "attack" | "thwart", command: Command): Command => {
    const picks = discardPicks(state, deps, playerId, character, basicPowerCost(state, deps, character, power));
    return picks.length > 0 && (command.type === "basicAttack" || command.type === "basicThwart")
      ? { ...command, costChoices: { discard: picks } }
      : command;
  };
  for (const attacker of characters) {
    const action: ActionRef = { kind: "basicAttack", instanceId: attacker };
    const variants: Variant[] = enemies.map((target) => ({
      target,
      build: () => withPicks(attacker, "attack", mustBasicCommand(playerId, action, target)),
    }));
    results.push(evaluate(state, deps, action, variants, NO_PAYMENT));
  }
  for (const thwarter of characters) {
    const action: ActionRef = { kind: "basicThwart", instanceId: thwarter };
    const variants: Variant[] = schemes.map((target) => ({
      target,
      build: () => withPicks(thwarter, "thwart", mustBasicCommand(playerId, action, target)),
    }));
    results.push(evaluate(state, deps, action, variants, NO_PAYMENT));
  }
  results.push(simple(state, deps, playerId, { kind: "basicRecover" }));
  const identityCard = cardOf(state, player.identity.instanceId);
  const faces = identityCard?.type === "hero_identity" ? heroFacesOf(identityCard).length : 1;
  if (faces > 1) {
    // A three-sided identity: each form it is not in right now is its own action.
    if (player.identity.form === "hero")
      results.push(simple(state, deps, playerId, { kind: "changeForm", to: "alterEgo" }));
    for (let heroForm = 0; heroForm < faces; heroForm++) {
      if (player.identity.form === "hero" && player.identity.heroFormIndex === heroForm) continue;
      results.push(simple(state, deps, playerId, { kind: "changeForm", to: { heroForm } }));
    }
  } else {
    results.push(simple(state, deps, playerId, { kind: "changeForm" }));
  }
  results.push(simple(state, deps, playerId, { kind: "endTurn" }));

  return {
    kind: "turn",
    legal: results.flatMap((r) => ("legal" in r ? [r.legal] : [])),
    illegal: results.flatMap((r) => ("illegal" in r ? [r.illegal] : [])),
  };
}

// ---------------------------------------------------------------------------
// Payment query
// ---------------------------------------------------------------------------
//
// `legalActions` only answers "can this be afforded at all?", and its `example`
// carries the smallest working payment. The Payment overlay (PLAN.md Phase 4)
// lets the player pick instead, so it needs the cost, what may be spent, and a
// way to ask the engine whether a selection works. The engine stays the judge:
// `tryPayment` builds the same command `legalActions` would and runs it through
// `applyCommand`, so `ok: true` means "this exact command is accepted right now".

/** One thing the player can spend toward a cost. */
export interface PaymentSource {
  /** The option-id shape `paymentOptions` produces: "hand:<id>" | "ability:<id>:<abilityId>". */
  readonly optionId: string;
  readonly kind: "handCard" | "resourceAbility";
  readonly instanceId: InstanceId;
  /** Card name, as `paymentOptions` labels it. */
  readonly label: string;
  /**
   * What spending this source contributes, by icon type, so the overlay can
   * draw pips. A hand card's pool already accounts for "double the resources
   * on this card while paying for an [aspect] card". A resource ability's pool
   * is what its `generates` says; for "equal to the top card of your discard
   * pile" (Pepper Potts) that top card can change during a payment, so this is
   * the pool as of the current discard pile, not a promise.
   */
  readonly pool: Readonly<Record<ResourceIconType, number>>;
}

export interface PaymentQuery {
  /** What the action costs, as the engine computes it (generic plus typed). */
  readonly requirement: ResolvedRequirement;
  readonly sources: readonly PaymentSource[];
  /**
   * The engine's own smallest working payment, as option ids: the overlay's
   * initial selection. Empty when no payment at all works right now (the
   * player cannot afford it) — `tryPayment` then reports the engine's reason.
   */
  readonly suggested: readonly string[];
}

export type PaymentAttempt =
  | { readonly ok: true; readonly command: Command }
  | { readonly ok: false; readonly reason: EngineErrorCode; readonly message: string };

/** The picks already made for an action, named exactly as `legalActions` reports them. */
export interface PaymentContext {
  /** One of `LegalAction.targets`: an upgrade's host, or the card a cost picks. */
  readonly target?: InstanceId | null;
  /** One of `LegalAction.controllers`, for "play under any player's control". */
  readonly controllerId?: PlayerId;
  /** Overrides the cost picks the engine would fill in itself. */
  readonly costChoices?: CostChoices;
  /** The either/or branch and "up to N" counter count (`CostSelection`; docs/phase7-wave3.md §3.32, §3.36). */
  readonly costSelection?: CostSelection;
}

/** An action that carries a payment, resolved down to a single command shape. */
interface Payable {
  readonly build: (payment: readonly Payment[]) => Command;
  /** The card being paid for: it cannot pay for itself (RRG "Cost"). */
  readonly excludeInstanceId: InstanceId | null;
  /** Hand cards the cost has already claimed (a "discard N cards" cost), so they cannot also pay. */
  readonly reserved: ReadonlySet<InstanceId>;
  /** What the resources are being spent on, for "while paying for an [aspect] card". */
  readonly payingFor: InstanceId | null;
  /** Null when the engine refuses the cost as configured; `tryPayment` then says why. */
  readonly requirement: ResolvedRequirement | null;
  /** True when there is something to decide: a non-zero cost, or "spend X resources". */
  readonly spendable: boolean;
}

const NO_RESERVED: ReadonlySet<InstanceId> = new Set();

const mergeChoices = (auto: CostChoices | undefined, given: CostChoices | undefined): CostChoices | undefined => {
  const merged = { ...auto, ...given };
  return Object.keys(merged).length > 0 ? merged : undefined;
};

/** The inverse of `paymentsFromOptionIds`. */
const optionIdsOf = (payment: readonly Payment[]): readonly string[] =>
  payment.map((entry) =>
    "fromHand" in entry ? `hand:${entry.fromHand}` : `ability:${entry.ability.instanceId}:${entry.ability.abilityId}`,
  );

/** True when the player may still choose to spend even though the fixed cost is 0 ("Spend X resources…"). */
const isSpendable = (requirement: ResolvedRequirement | null, cost: AbilityCost | undefined): boolean =>
  requirement !== null && (requirementTotal(requirement) > 0 || cost?.resourcesX !== undefined);

/**
 * The one command `legalActions` would build for this action with these picks,
 * plus everything the payment step needs to know about its cost. Returns null
 * for actions that carry no payment at all (the basic actions).
 */
function payableFor(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  action: ActionRef,
  options: PaymentContext,
): Payable | null {
  if (action.kind === "playCard") {
    const id = action.instanceId;
    const card = cardOf(state, id);
    const cost = costAsDetermined(
      state,
      deps,
      id,
      playerId,
      card ? eventActionAbility(createCtx(state, deps), card)?.cost : undefined,
    );
    const picks = options.costChoices?.discard ?? discardPicks(state, deps, playerId, id, cost);
    const sets = costChoiceSets(state, deps, playerId, id, cost, picks);
    const chosen = sets.find((set) => set.target !== null && set.target === options.target) ?? sets[0];
    const costChoices = mergeChoices(chosen?.costChoices, options.costChoices);
    const controllerId = options.controllerId;
    const context: EffectContext = {
      selfInstanceId: id,
      controllerId: controllerId ?? playerId,
      event: null,
      bindings: {},
      deps,
    };
    const hosts =
      card?.type === "upgrade" && card.attachesTo ? attachmentHostCandidates(state, card.attachesTo, context) : [];
    const host = options.target && hosts.includes(options.target) ? options.target : (hosts[0] ?? null);
    const selection = options.costSelection;
    const plan = planCost(state, deps, id, playerId, cost, costChoices ?? {}, NO_RESERVED, selection);
    const planned = "requirement" in plan ? plan : null;
    const requirement = card && planned ? playRequirement(state, playerId, id, planned.requirement, deps, host) : null;
    return {
      build: (payment) => ({
        type: "playCard",
        playerId,
        cardInstanceId: id,
        payment,
        attachToInstanceId: host,
        ...(costChoices ? { costChoices } : {}),
        ...(controllerId && controllerId !== playerId ? { controllerId } : {}),
        ...(selection ? { costSelection: selection } : {}),
      }),
      excludeInstanceId: id,
      reserved: new Set([id, ...picks]),
      payingFor: planned?.payingFor ?? id,
      requirement,
      spendable: isSpendable(requirement, cost),
    };
  }
  if (action.kind === "useAbility") {
    const { instanceId, abilityId } = action;
    const cost = costAsDetermined(state, deps, instanceId, playerId, deps.abilities[abilityId]?.cost);
    const picks = options.costChoices?.discard ?? discardPicks(state, deps, playerId, instanceId, cost);
    const sets = costChoiceSets(state, deps, playerId, instanceId, cost, picks);
    const chosen = sets.find((set) => set.target !== null && set.target === options.target) ?? sets[0];
    const costChoices = mergeChoices(chosen?.costChoices, options.costChoices);
    const selection = options.costSelection;
    const plan = planCost(state, deps, instanceId, playerId, cost, costChoices ?? {}, NO_RESERVED, selection);
    const planned = "requirement" in plan ? plan : null;
    return {
      build: (payment) => ({
        type: "useAbility",
        playerId,
        cardInstanceId: instanceId,
        abilityId,
        payment,
        ...(costChoices ? { costChoices } : {}),
        ...(selection ? { costSelection: selection } : {}),
      }),
      excludeInstanceId: null,
      reserved: new Set(picks),
      payingFor: planned?.payingFor ?? null,
      requirement: planned?.requirement ?? null,
      spendable: isSpendable(planned?.requirement ?? null, cost),
    };
  }
  return null;
}

/**
 * What the player must pay for `action`, what they may pay it with, and the
 * payment the engine itself would make. Null when there is nothing to decide:
 * a basic action, a card that costs nothing and has no "spend X" cost, or a
 * cost the engine refuses as configured (`tryPayment` then reports why).
 *
 * Pure, and cheap enough for the main thread: it prices the cost once, then
 * probes prefixes of the player's resources for `suggested` (the same search
 * `legalActions` already runs per action). Measured at 0.3 ms worst case across
 * the Rhino solo game, against 5–8 ms for a whole `legalActions` call.
 */
export function paymentFor(
  state: GameState,
  playerId: PlayerId,
  action: ActionRef,
  options: PaymentContext,
  deps: EngineDeps = DEFAULT_DEPS,
): PaymentQuery | null {
  if (!getPlayer(state, playerId)) return null;
  const payable = payableFor(state, deps, playerId, action, options);
  if (!payable || payable.requirement === null || !payable.spendable) return null;
  const ctx = createCtx(state, deps);
  const discardTop = getPlayer(state, playerId)?.discard[0] ?? null;
  const sources = paymentOptions(ctx, playerId, payable.excludeInstanceId, payable.payingFor).flatMap<PaymentSource>(
    (option) => {
      if (option.ref.kind === "card") {
        // A card the cost already claims cannot also be spent (RRG "Cost": each card pays once).
        if (payable.reserved.has(option.ref.instanceId)) return [];
        return [
          {
            optionId: option.optionId,
            kind: "handCard",
            instanceId: option.ref.instanceId,
            label: option.label,
            pool: handCardResources(state, deps, option.ref.instanceId, playerId, payable.payingFor),
          },
        ];
      }
      if (option.ref.kind !== "ability") return [];
      return [
        {
          optionId: option.optionId,
          kind: "resourceAbility",
          instanceId: option.ref.instanceId,
          label: option.label,
          pool: generatedResources(state, deps.abilities[option.ref.abilityId]?.generates, discardTop),
        },
      ];
    },
  );
  let suggested: readonly string[] = [];
  for (const wallet of wallets(spendOrder(state, deps, playerId, payable.reserved, payable.payingFor))) {
    if (!probe(state, deps, payable.build(wallet)).ok) continue;
    suggested = optionIdsOf(smallestPayment(state, deps, payable.build, wallet));
    break;
  }
  return { requirement: payable.requirement, sources, suggested };
}

/**
 * Builds the command the player's selection describes and asks the engine to
 * judge it. `ok: true` carries the exact command that was accepted, for the
 * client to issue; `ok: false` carries the engine's own code and message
 * ("insufficient_resources", "a card cannot pay for itself", …).
 */
export function tryPayment(
  state: GameState,
  playerId: PlayerId,
  action: ActionRef,
  selectedOptionIds: readonly string[],
  options: PaymentContext,
  deps: EngineDeps = DEFAULT_DEPS,
): PaymentAttempt {
  const payable = payableFor(state, deps, playerId, action, options);
  // A basic action carries no payment, so a selection is simply not part of its command.
  const command = payable
    ? payable.build(paymentsFromOptionIds(selectedOptionIds))
    : basicCommand(playerId, action, options.target ?? null);
  if (!command) return { ok: false, reason: "no_valid_target", message: "this action needs a target" };
  const result = applyCommand(state, command, deps);
  return result.ok ? { ok: true, command } : { ok: false, reason: result.error.code, message: result.error.message };
}
