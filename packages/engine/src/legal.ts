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

import { costWithChangeForm } from "./change-form-cost.js";
import type { AbilityId, AnyCard, ResourceIconType } from "@mc/content";
import {
  DEFAULT_DEPS,
  resourcesChoiceOf,
  type AbilityCost,
  type AbilityDefinition,
  type EngineDeps,
} from "./abilities.js";
import {
  basicPowerCost,
  costAsDetermined,
  costPartsPayableByAnyPlayer,
  playCostWith,
  counterCostHolder,
  eventActionForQuery,
  eventActions,
  isActionEvent,
  usableEventActions,
  handCardResources,
  isAlternativeAmount,
  isWhenSpentUse,
  minimumChosenX,
  mostFromEachHandCard,
  whenSpentCostSize,
  spentCardOptionId,
  priceOrNull,
  paidForMultiplied,
  paymentOptions,
  resourcesNotFor,
  paymentsFromOptionIds,
  resourceAbilityGenerates,
  resourceAbilityOptionId,
  defaultInPlayPicks,
  discardCombinedValue,
  planCost,
  attachmentsPlayableBy,
  asIfInHandCostReduction,
  asIfInHandPermissions,
  neverPlayedFault,
  playableFromDiscard,
  playCostReductionFault,
  playRequirement,
} from "./actions.js";
import { chosenSizePayments } from "./payable.js";
import type { PendingChoice } from "./choices.js";
import {
  type Command,
  type CostChoices,
  type CostPartPayers,
  type CostSelection,
  DELEGABLE_COST_PARTS,
  type DelegableCostPart,
  type Payment,
} from "./commands.js";
import { createCtx } from "./ctx.js";
import { areaCostReductionFor } from "./effects.js";
import { applyCommand } from "./engine.js";
import { attachCostCard, attachCostHosts, dealDamageCostChoices } from "./attach-cost.js";
import { chooseTargetCostChoices } from "./choose-target-cost.js";
import { removeThreatCostChoices } from "./remove-threat-cost.js";
import { encounterSearchCostCandidates } from "./encounter-search-cost.js";
import { resolveAbilityCostCandidates } from "./resolve-ability-cost.js";
import { encounterDiscardCostRange } from "./encounter-discard-cost.js";
import { EngineInvariantError, type EngineErrorCode } from "./errors.js";
import type { InstanceId, PlayerId } from "./ids.js";
import {
  activeEncounterDeck,
  cardOf,
  cardZoneCandidates,
  getPlayer,
  heroFacesOf,
  isMinion,
  locateCard,
  playerOrder,
  showingResources,
  undefeatedVillains,
  mainSchemeStates,
  inClosedScenarioPlayArea,
  scenarioPlayAreaOf,
} from "./query.js";
import { attachmentHostCandidates } from "./resolve/index.js";
import { addPools, combineRequirements, poolTotal, requirementTotal, type ResolvedRequirement } from "./resources.js";
import { basicPowerCostNeeds } from "./basic-power-uses.js";
import { dealToCostChoices } from "./deal-to-cost.js";
import {
  attachmentReachOf,
  costsPayableByAnyPlayer,
  formChangeCostsFor,
  playDestinationsOf,
  type FormChangeCost,
} from "./rules.js";
import { formChangeCostSources } from "./form-change-cost.js";
import {
  activeAbilityRefs,
  uncontrolledYouOf,
  attackableAsMinion,
  cardsInPlay,
  controllerOf,
  isAlly,
  isCaptiveAlly,
  matchesQuery,
  printedAbilityRefs,
  triggeringPlayers,
  type EffectContext,
} from "./select.js";
import type { Form, GameState } from "./state.js";
import { displayNameOf } from "./visibility.js";
import { healCostChoices } from "./heal-cost.js";
import { anyThwartCost } from "./thwart-cost.js";

/** One thing a player could do on their turn, independent of target and payment. */
export type ActionRef =
  /**
   * `from: "deckTop"`: the card is the top card of the player's deck, playable "as if it was in your hand" under a
   * `playableTopOfDeck` permission (docs/phase7-wave8.md §3.49). `from: "tucked"`: a card tucked under a card whose
   * `playableAsIfInHand { tuckedUnder }` permission covers it (docs/phase7-wave11.md §3.8). Absent for every other
   * card. The command is the same `playCard`; `playCostOf` gives its reduced price and names the permission's card
   * among the contributions.
   */
  | { readonly kind: "playCard"; readonly instanceId: InstanceId; readonly from?: "deckTop" | "tucked" }
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
  /**
   * True when the action costs resources, so the client opens the payment step. Also true for a play that costs
   * nothing when overpaying matters for it (`PaymentQuery.overpayMatters`).
   */
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
  /**
   * A cost that discards from the top of the encounter deck (`AbilityCost.discardFromEncounterDeck`;
   * docs/phase7-wave9.md §3.43 (a)): the numbers the player may choose from, `min` equal to `max` for a printed number,
   * and `inDeck`, the cards the encounter deck holds now. A number above `inDeck` is legal: the deck's cards are
   * discarded, the deck is reset with an acceleration token and the cost is paid (RRG 1.8 "Encounter Deck", p. 17).
   * The client may send the number as `costSelection.discardFromEncounterDeck`; without it the engine asks as the cost
   * is paid. Absent for any other cost.
   */
  readonly encounterDeckDiscard?: { readonly min: number; readonly max: number; readonly inDeck: number };
  /**
   * A resource cost whose size the player chooses ("spend up to 3 resources →"; docs/phase7-wave8.md §3.62): the
   * payment must generate at least `min` resources in all, a card with two icons counting two; up to `max` of them
   * are paid and the rest overpaid (owner decision, 2026-10-08, docs/phase7-wave8.md §4.1 row 78). The payment
   * itself is the choice; `example` spends the fewest sources that fit. Absent for any other cost.
   */
  readonly chosenResources?: { readonly min: number; readonly max: number };
  /**
   * An event that prints more than one Action ability (RRG 1.8 "Event", p. 18: "the player playing it chooses one of
   * those abilities to trigger"): the ones that can be triggered and paid for right now, in printed order. With more
   * than one the client asks which and sends it as the `playCard` command's `abilityId` (and as
   * `PaymentContext.abilityId`, since each has its own cost); `example`, `targets` and the cost fields describe the
   * first. Absent for any other card.
   */
  readonly abilities?: readonly AbilityId[];
  /**
   * The in-play scenario areas this card may be played into instead of the player's own play area (MC45 p. 5: "they
   * must choose: either play that ally into their game area …, or play it into the mission area"; `RuleSpec
   * playDestination`, docs/phase7-wave8.md §3.34). `example` is the play to the player's own area; the client asks
   * which and sends the area as the `playCard` command's `into`. Absent when there is no choice to make.
   */
  readonly destinations?: readonly string[];
  /**
   * For an upgrade with "attach to" text that may be played into one of `destinations`: the cards in each such area
   * it may be attached to, by area. Played into an area it is attached to a card there (RRG 1.8 "Attach To", p. 8),
   * so the client sends one of these as the command's `attachToInstanceId` beside `into`; `targets` are the hosts of
   * the play `example` names. Absent for every other card.
   */
  readonly destinationHosts?: Readonly<Record<string, readonly InstanceId[]>>;
  /**
   * The play is legal only into one of `destinations`: the player cannot pay for it in their own play area, and can
   * where a reduction that reads the destination applies ("Reduce the cost of the next ally played to the mission
   * this phase by 2", docs/phase7-wave8.md §3.35). `example` then names the first such area as its `into`, and the
   * client offers no play to the player's own area. Absent whenever the own-area play is legal.
   */
  readonly destinationOnly?: true;
  /**
   * A change of form with an additional cost (`RuleSpec formChangeCost`; docs/phase7-wave8.md §3.63): the cards the
   * cost is printed on. The action is listed legal only when the cost can be paid; `example` carries a payment that
   * pays it, and `paymentFor` / `tryPayment` take the action as they take a play. Absent for a free change.
   */
  readonly formChangeCost?: { readonly sourceInstanceIds: readonly InstanceId[] };
  /**
   * An ability whose cost any player may help pay (`RuleSpec costsPayableByAnyPlayer`; docs/phase7-wave10-hero-packs.md
   * H3.19), or the play of an alliance card (RRG 1.8 "Alliance", p. 6; owner answer 48B), whose cost holds a part another player can take over whole (`DelegableCostPart`: "take 2 damage", "discard
   * the top card of your deck"): for each such part, the players who can pay it right now, the user first when they
   * can. The client asks who pays and sends a player other than the user as `costSelection.paidBy`; `example` has the
   * user pay every part they can, and names a helper only for a part the user cannot pay. Absent for every other cost.
   * A helper's resources and cards need no entry here: they are payment sources and cost picks like the user's own.
   */
  readonly costHelp?: readonly CostHelp[];
}

/** Who can pay one delegable part of a cost right now (`LegalAction.costHelp`). */
export interface CostHelp {
  readonly part: DelegableCostPart;
  readonly payers: readonly PlayerId[];
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
  /**
   * Not this player's turn (`activePlayerId` is null outside the player phase, e.g. while the villain acts).
   *
   * `legal` and `illegal` are the Action abilities this player may offer during the active player's turn, and nothing
   * else: Action abilities on cards they may trigger and Action events they may play (RRG 1.8 "Action", p. 6: "during
   * their turn, or by request during other players' turns"; docs/phase7-wave7.md §4.1, owner ruling 2026-10-05).
   * Basic powers, changing form, playing any other card and ending the turn are the active player's alone, so they are
   * never listed here. Both are empty outside a player's turn.
   */
  | {
      readonly kind: "notYourTurn";
      readonly activePlayerId: PlayerId | null;
      readonly legal: readonly LegalAction[];
      readonly illegal: readonly IllegalAction[];
    }
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
  /** Who pays each delegable part of the cost in this variant, the user included (`LegalAction.costHelp`). */
  readonly partPayers?: CostPartPayers;
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
  deps: EngineDeps,
  playerId: PlayerId,
  source: InstanceId,
  cost: AbilityCost | undefined,
): { readonly min: number; readonly max: number } | undefined {
  const counters = [cost?.spendCounters, ...(cost?.either ?? []).map((branch) => branch.spendCounters)].find(
    (component) => component?.upTo,
  );
  if (!counters || typeof counters.amount !== "number") return undefined;
  const holder = counterCostHolder(state, deps, source, playerId, counters.target);
  const held = typeof holder === "string" ? (state.instances[holder]?.counters[counters.counterType] ?? 0) : 0;
  return { min: 1, max: Math.min(counters.amount, held) };
}

/** The `encounterDeckDiscard` range of a cost that discards from the top of the encounter deck (wave 9 §3.43 (a)). */
function encounterDiscardRange(
  state: GameState,
  cost: AbilityCost | undefined,
): LegalAction["encounterDeckDiscard"] | undefined {
  const component = [cost, ...(cost?.either ?? [])].find((part) => part?.discardFromEncounterDeck);
  const range = component?.discardFromEncounterDeck
    ? encounterDiscardCostRange(state, component.discardFromEncounterDeck)
    : null;
  return range ? { ...range, inDeck: activeEncounterDeck(state).deck.length } : undefined;
}

const withBranch = (branch: number | undefined, paidBy?: CostPartPayers): { readonly costSelection?: CostSelection } =>
  branch === undefined && !paidBy
    ? {}
    : { costSelection: { ...(branch === undefined ? {} : { branch }), ...(paidBy ? { paidBy } : {}) } };

/** The delegable parts (`DelegableCostPart`) a cost holds, in its own components or in the branch chosen. */
const delegableParts = (cost: AbilityCost | undefined, branch: number | undefined): readonly DelegableCostPart[] => {
  const paid = branch === undefined ? cost : { ...cost, ...cost?.either?.[branch] };
  return DELEGABLE_COST_PARTS.filter((part) => paid?.[part] !== undefined);
};

/**
 * Who could pay each delegable part of a cost any player may help pay (`RuleSpec costsPayableByAnyPlayer`, or an
 * alliance card being played: `costPartsPayableByAnyPlayer`): the user
 * paying everything first, then every other split, the helpers in player order. One entry, `undefined`, for a cost
 * nobody else may pay or with no such part, which keeps every other command exactly as it was.
 */
function partPayerSets(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  source: InstanceId,
  parts: readonly DelegableCostPart[],
): readonly (CostPartPayers | undefined)[] {
  if (parts.length === 0 || !costPartsPayableByAnyPlayer(state, deps, source)) return [undefined];
  const players = [playerId, ...playerOrder(state).flatMap((p) => (p.playerId === playerId ? [] : [p.playerId]))];
  // Nobody to help (a solo game): the command and what is listed stay exactly as without the rule.
  if (players.length < 2) return [undefined];
  let sets: CostPartPayers[] = [{}];
  for (const part of parts) sets = players.flatMap((payer) => sets.map((set) => ({ ...set, [part]: payer })));
  // The fewest helpers first, so the first working variant has the user pay everything they can.
  const helped = (set: CostPartPayers): number => Object.values(set).filter((payer) => payer !== playerId).length;
  return [...sets].sort((a, b) => helped(a) - helped(b));
}

/** The `paidBy` a command carries for a variant's part payers: only the parts a player other than the user pays. */
function paidByOf(playerId: PlayerId, partPayers: CostPartPayers | undefined): CostPartPayers | undefined {
  const helped = Object.entries(partPayers ?? {}).filter(([, payer]) => payer !== playerId);
  return helped.length > 0 ? (Object.fromEntries(helped) as CostPartPayers) : undefined;
}

type Evaluated = { readonly legal: LegalAction } | { readonly illegal: IllegalAction };

const resourceCount = (state: GameState, id: InstanceId): number => {
  const pool = showingResources(state, id);
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
  // One use of a resource ability pays one amount: the option for the most it generates (`isAlternativeAmount`).
  const abilities = payments.filter((p) => "ability" in p && !isAlternativeAmount(p));
  // One card is spent once: its plain spending here, its "When you spend this card" uses in `walletsWithWhenSpent`.
  const hand = payments.flatMap((p) =>
    "fromHand" in p && !isWhenSpentUse(p) && !reserved.has(p.fromHand) ? [p.fromHand] : [],
  );
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
 * `wallets(spend)`, then the same wallets with each hand card spent the way that generates the most: with its own
 * "Interrupt: When you spend this card, [cost] → generate …" where it has one that can be used (`Payment.whenSpent`,
 * `mostFromEachHandCard`). They come last, so `example` and `suggested` use such an ability only when the plain
 * payments do not pay (its cost is cards the player may want ready), and an action that only it makes affordable is
 * still listed. A wallet is built for each number of cards such a cost may pick, the fewest first, so the payment
 * found exhausts no more cards than it needs; within a wallet the cards generating the most come first, so the
 * shortest prefix that pays spends the fewest.
 */
function walletsWithWhenSpent(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  reserved: ReadonlySet<InstanceId>,
  payingFor: InstanceId | null,
  spend: readonly Payment[],
): readonly (readonly Payment[])[] {
  const plain = wallets(spend);
  const ctx = createCtx(state, deps);
  const uses = paymentsFromOptionIds(paymentOptions(ctx, playerId, null, payingFor).map((o) => o.optionId)).filter(
    (p) => "fromHand" in p && isWhenSpentUse(p) && !reserved.has(p.fromHand),
  );
  if (uses.length === 0) return plain;
  const total = (payment: Payment): number => {
    const pool = priceOrNull(ctx, playerId, [payment], null, payingFor);
    return pool ? poolTotal(pool) : 0;
  };
  const sizes = [...new Set(uses.map(whenSpentCostSize))].sort((a, b) => a - b);
  return [
    ...plain,
    ...sizes.flatMap((size) => {
      const most = mostFromEachHandCard(ctx, playerId, [...spend, ...uses], null, payingFor, size);
      const hand = most.filter((p) => "fromHand" in p).sort((a, b) => total(b) - total(a));
      return wallets([...most.filter((p) => "ability" in p), ...hand]);
    }),
  ];
}

/** How many payments of a chosen-size cost `legalActions` probes before the usual wallets (`chosenSizeWallets`). */
const CHOSEN_SIZE_WALLETS = 8;

/**
 * The wallets tried first for a cost whose size the payer chooses ("spend up to 3 resources →", `ResourcesChoice`;
 * docs/phase7-wave8.md §3.62). These are the first few payments that fit its range without overpaying it
 * (`chosenSizePayments`), the fewest sources first, so `example` spends the least it can rather than everything the
 * player holds. Overpaying is legal (owner decision, 2026-10-08, §4.1 row 78; RRG 1.8 "Cost", p. 13), so when no
 * payment fits exactly (one card of two icons toward a size of exactly 1) the overpaying ones are offered instead.
 * Empty for any other cost.
 *
 * Priced for the ability's own card, which is what `useAbility` pays for unless its cost picks one; a cost that both
 * picks a card to pay for and chooses a size falls back on the usual wallets (no such card).
 */
function chosenSizeWallets(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  spend: readonly Payment[],
  range: { readonly min: number; readonly max: number } | null,
  payingFor: InstanceId | null,
  limit = CHOSEN_SIZE_WALLETS,
): readonly (readonly Payment[])[] {
  if (!range) return [];
  const found: (readonly Payment[])[] = [];
  for (const overpay of [false, true]) {
    for (const payment of chosenSizePayments(state, deps, playerId, spend, range, payingFor, overpay)) {
      found.push(payment);
      if (found.length >= limit) break;
    }
    if (found.length > 0) break;
  }
  return found;
}

/** How many exact-size payments of a form change's additional cost are probed before the usual wallets. */
const FORM_CHANGE_WALLETS = 32;

/** The form a `changeForm` action ends in: the one it names, or the other form of a two-faced identity. */
const formChangeDestination = (state: GameState, playerId: PlayerId, to: ChangeFormTo | undefined): Form =>
  to === undefined ? (getPlayer(state, playerId)?.identity.form === "hero" ? "alterEgo" : "hero") : formOfTo(to);

type ChangeFormTo = "alterEgo" | { readonly heroForm: number };
const formOfTo = (to: ChangeFormTo): Form => (to === "alterEgo" ? "alterEgo" : "hero");

/**
 * A change of form with an additional cost (`RuleSpec formChangeCost`; docs/phase7-wave8.md §3.63), as a command that
 * carries a payment: the costs in force, the cards a "discard N cards" cost picks, what may be spent and the wallets
 * to try. The payments that generate exactly the total come first, so `example` spends no more than the cost asks
 * ("2 resources of the same type" from a hand of three cards), then everything the player holds (overpaying is
 * legal). Null for a free change.
 */
function formChangeWithCost(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  to: ChangeFormTo | undefined,
  given?: CostChoices,
): {
  readonly costs: readonly FormChangeCost[];
  readonly costChoices: CostChoices | undefined;
  readonly reserved: ReadonlySet<InstanceId>;
  readonly spend: readonly Payment[];
  readonly requirement: ResolvedRequirement | null;
  readonly tryWallets: readonly (readonly Payment[])[];
  readonly build: (payment: readonly Payment[]) => Command;
} | null {
  const costs = formChangeCostsFor(state, deps, playerId, formChangeDestination(state, playerId, to));
  if (costs.length === 0) return null;
  const picks =
    given?.discard ??
    costs.flatMap(({ sourceInstanceId, cost }) => discardPicks(state, deps, playerId, sourceInstanceId, cost));
  const costChoices = mergeChoices(picks.length > 0 ? { discard: picks } : undefined, given);
  const reserved = new Set(picks);
  const spend = spendOrder(state, deps, playerId, reserved, null);
  let requirement: ResolvedRequirement | null = combineRequirements(0, 0);
  for (const { sourceInstanceId, cost } of costs) {
    const plan = planCost(state, deps, sourceInstanceId, playerId, cost, costChoices ?? {}, NO_RESERVED);
    requirement = requirement && "requirement" in plan ? combineRequirements(requirement, plan.requirement) : null;
  }
  const total = requirement ? requirementTotal(requirement) : 0;
  const exact =
    total > 0
      ? chosenSizeWallets(state, deps, playerId, spend, { min: total, max: total }, null, FORM_CHANGE_WALLETS)
      : [];
  return {
    costs,
    costChoices,
    reserved,
    spend,
    requirement,
    tryWallets: [...exact, ...walletsWithWhenSpent(state, deps, playerId, reserved, null, spend)],
    build: (payment) => ({
      type: "changeForm",
      playerId,
      ...(to === undefined ? {} : { to }),
      payment,
      ...(costChoices ? { costChoices } : {}),
    }),
  };
}

type BasicPowerRef = Extract<ActionRef, { kind: "basicAttack" | "basicThwart" }>;

/**
 * A basic attack or thwart whose additional costs ask for resources: the power's own (`basicPowerCosts`, "that hero
 * must spend 1 of any resource") and a rule's over the character (`RuleSpec additionalPowerCost`,
 * docs/phase7-wave9.md §3.31). As `formChangeWithCost`: the command carries the payment, the payments that generate
 * exactly the total are tried first, then everything the player holds. Null when the power asks for no resources.
 */
function basicPowerWithCost(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  action: BasicPowerRef,
  given?: CostChoices,
): {
  readonly costChoices: CostChoices | undefined;
  readonly reserved: ReadonlySet<InstanceId>;
  readonly requirement: ResolvedRequirement;
  readonly tryWallets: readonly (readonly Payment[])[];
} | null {
  const power = action.kind === "basicAttack" ? "attack" : "thwart";
  const character = action.instanceId;
  const picks =
    given?.discard ?? discardPicks(state, deps, playerId, character, basicPowerCost(state, deps, character, power));
  const costChoices = mergeChoices(picks.length > 0 ? { discard: picks } : undefined, given);
  const needs = basicPowerCostNeeds(state, deps, playerId, character, power, picks.length > 0 ? picks : undefined);
  if (!needs || "fault" in needs) return null;
  const total = requirementTotal(needs.requirement);
  if (total === 0) return null;
  const reserved = new Set(picks);
  const spend = spendOrder(state, deps, playerId, reserved, null);
  const exact = chosenSizeWallets(state, deps, playerId, spend, { min: total, max: total }, null, FORM_CHANGE_WALLETS);
  return {
    costChoices,
    reserved,
    requirement: needs.requirement,
    tryWallets: [...exact, ...walletsWithWhenSpent(state, deps, playerId, reserved, null, spend)],
  };
}

/** The basic attack or thwart command with its cost picks and payment filled in. */
function basicPowerCommandWith(
  playerId: PlayerId,
  action: BasicPowerRef,
  target: InstanceId,
  costChoices: CostChoices | undefined,
  payment: readonly Payment[],
): Command {
  const command = mustBasicCommand(playerId, action, target);
  if (command.type !== "basicAttack" && command.type !== "basicThwart") return command;
  return {
    ...command,
    ...(costChoices ? { costChoices } : {}),
    ...(payment.length > 0 ? { payment } : {}),
  };
}

/** A `changeForm` action: free, or with its additional cost paid (`formChangeWithCost`). */
function evaluateChangeForm(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  action: Extract<ActionRef, { kind: "changeForm" }>,
): Evaluated {
  const costed = formChangeWithCost(state, deps, playerId, action.to);
  if (!costed) return simple(state, deps, playerId, action);
  const evaluated = evaluate(state, deps, action, [{ target: null, build: costed.build }], costed.tryWallets);
  if (!("legal" in evaluated)) return evaluated;
  return { legal: { ...evaluated.legal, formChangeCost: { sourceInstanceIds: formChangeCostSources(costed.costs) } } };
}

/**
 * docs/phase7-wave5.md §4.1 Q28: with an additional thwart cost in play, a "(thwart)" play or ability is judged after
 * it is paid for, so paying with the whole wallet (overpaying is legal) can spend what the scheme's cost needed. Its
 * first wallet's shorter prefixes (from paying nothing up) and each single source in it are tried as well, after the
 * usual wallets.
 */
function withThwartCostWallets(
  state: GameState,
  deps: EngineDeps,
  definition: AbilityDefinition | undefined,
  tryWallets: readonly (readonly Payment[])[],
): readonly (readonly Payment[])[] {
  const [first] = tryWallets;
  if (!first || !definition || !anyThwartCost(state, deps)) return tryWallets;
  if (!JSON.stringify(definition.effects).includes('"kind":"thwart"')) return tryWallets;
  const seen = new Set(tryWallets.map((wallet) => JSON.stringify(wallet)));
  const extra: (readonly Payment[])[] = [];
  for (const wallet of [...first.map((_, i) => first.slice(0, i)), ...first.map((payment) => [payment])]) {
    const key = JSON.stringify(wallet);
    if (seen.has(key)) continue;
    seen.add(key);
    extra.push(wallet);
  }
  return [...tryWallets, ...extra];
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
 * is what makes `legalActions` gray the ability out rather than offer an unpayable one.
 */
function discardPicks(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  source: InstanceId,
  written: AbilityCost | undefined,
): readonly InstanceId[] {
  // A "change form →" cost's hand discard may be an additional cost to change form (`change-form-cost.ts`).
  const cost = costWithChangeForm(state, deps, source, playerId, written);
  const min = cost?.discardFromHand?.min ?? 0;
  const combined = cost?.discardFromHand?.combined;
  if (min === 0 && !combined) return [];
  const filter = cost?.discardFromHand?.filter;
  const context: EffectContext = { selfInstanceId: source, controllerId: playerId, event: null, bindings: {}, deps };
  // A cost any player may help pay (`RuleSpec costsPayableByAnyPlayer`, hero-packs H3.19): the user's own cards
  // first, then the other players' in player order, so a helper's card is picked only when the user's run out.
  // Not a discard folded in from an additional cost to change form: that one is the changing player's own hand.
  const hands =
    costsPayableByAnyPlayer(state, deps, source) && !cost?.changeFormFolded?.includes("discardFromHand")
      ? [playerId, ...playerOrder(state).flatMap((p) => (p.playerId === playerId ? [] : [p.playerId]))]
      : [playerId];
  const matching = (owner: PlayerId): InstanceId[] =>
    (getPlayer(state, owner)?.hand ?? [])
      .filter((id) => id !== source)
      .filter((id) => !filter || matchesQuery(state, id, filter, context));
  const hand = hands.flatMap(matching);
  if (combined) {
    // "… with a combined resource cost of 3 or more" (`DiscardCombined`): the fewest cards that reach it, largest
    // share first. A hand whose matching cards can't reach it yields all of them, which the engine refuses — so
    // `legalActions` never offers the ability. The player may pick any other subset that reaches it.
    const largest = [...hand].sort(
      (a, b) => discardCombinedValue(state, b, combined) - discardCombinedValue(state, a, combined),
    );
    const picks: InstanceId[] = [];
    let total = 0;
    for (const id of largest) {
      if (total >= combined.atLeast && picks.length >= min) break;
      picks.push(id);
      total += discardCombinedValue(state, id, combined);
    }
    return picks;
  }
  const cheapest = hands.flatMap((owner) =>
    matching(owner).sort(
      (a, b) =>
        resourceCount(state, a) - resourceCount(state, b) || isResourceCard(state, a) - isResourceCard(state, b),
    ),
  );
  return cheapest.slice(0, min);
}

type CostChoiceSet = { readonly costChoices: CostChoices | undefined; readonly target: InstanceId | null };

/**
 * The `costChoices` to try: one per candidate for a "pay the printed cost of …" or "choose a card …" pick, each then
 * once per host an attach cost may pick ("attach it to a character other than Rogue →", `AbilityCost.attach`,
 * docs/phase7-wave6.md §3.49). With no card to attach or no host, the variants are left as they are and the engine's
 * own check (`planCost`) refuses them, so the ability is not offered.
 */
function costChoiceSets(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  source: InstanceId,
  cost: AbilityCost | undefined,
  picks: readonly InstanceId[],
): readonly CostChoiceSet[] {
  const sets = searchChoiceSets(
    state,
    deps,
    playerId,
    source,
    cost,
    resolveChoiceSets(state, deps, playerId, source, cost, pickChoiceSets(state, deps, playerId, source, cost, picks)),
  );
  const attach = cost?.attach;
  if (!attach) return damageChoiceSets(state, deps, playerId, source, cost, sets);
  const card = attachCostCard(state, deps, source, playerId, attach);
  const hosts = card === null ? [] : attachCostHosts(state, deps, source, playerId, attach, card);
  if (hosts.length === 0) return sets;
  return damageChoiceSets(
    state,
    deps,
    playerId,
    source,
    cost,
    sets.flatMap(({ costChoices, target }) =>
      hosts.map((host) => ({ costChoices: { ...costChoices, [attach.to.slot]: [host] }, target: target ?? host })),
    ),
  );
}

/**
 * "Search the encounter deck and discard pile for a minion and put it into play engaged with you" as a cost
 * (`AbilityCost.searchEncounterIntoPlay`, docs/phase7-wave10-box-heroes.md B3.1): each variant once per card the payer
 * may search out, which is the variant's target. With no candidate the variants are left as they are and the engine's
 * own check (`planCost`) refuses them, so the play is listed illegal with its reason.
 */
function searchChoiceSets(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  source: InstanceId,
  cost: AbilityCost | undefined,
  sets: readonly CostChoiceSet[],
): readonly CostChoiceSet[] {
  const search = cost?.searchEncounterIntoPlay;
  if (!search) return sets;
  const candidates = encounterSearchCostCandidates(state, deps, source, playerId, search);
  if (candidates.length === 0) return sets;
  return sets.flatMap(({ costChoices, target }) =>
    candidates.map((card) => ({ costChoices: { ...costChoices, [search.slot]: [card] }, target: target ?? card })),
  );
}

/**
 * "Deal 1 damage to another friendly character →" (`AbilityCost.dealDamage.choose`, docs/phase7-wave8.md §3.74): each
 * variant once per card the payer may pick. With no candidate the variants are left as they are and the engine's own
 * check (`planCost`) refuses them, so the ability is not offered.
 */
function damageChoiceSets(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  source: InstanceId,
  cost: AbilityCost | undefined,
  given: readonly CostChoiceSet[],
): readonly CostChoiceSet[] {
  const base = chooseTargetChoiceSets(
    state,
    deps,
    playerId,
    source,
    cost,
    healChoiceSets(state, deps, playerId, source, cost, dealToChoiceSets(state, cost, given)),
  );
  // "Remove 3 threat from a scheme →" (`AbilityCost.removeThreat.choose`): one variant per card that can pay.
  const threat = cost?.removeThreat;
  const threatCards = threat?.choose ? removeThreatCostChoices(state, deps, source, playerId, threat) : [];
  const sets =
    threat?.choose && threatCards.length > 0
      ? base.flatMap(({ costChoices, target }) =>
          threatCards.map((card) => ({
            costChoices: { ...costChoices, [threat.choose!.slot]: [card] },
            target: target ?? card,
          })),
        )
      : base;
  const choose = cost?.dealDamage?.choose;
  if (!choose) return sets;
  const candidates = dealDamageCostChoices(state, deps, source, playerId, choose);
  if (candidates.length === 0) return sets;
  return sets.flatMap(({ costChoices, target }) =>
    candidates.map((card) => ({ costChoices: { ...costChoices, [choose.slot]: [card] }, target: target ?? card })),
  );
}

/**
 * "Heal 2 damage from an enemy →" (`AbilityCost.healCharacter`, docs/phase7-wave10-hero-packs.md H3.17): each variant
 * once per character the payer may pick, which is the variant's target. With no candidate the variants are left as
 * they are and the engine's own check (`planCost`) refuses them, so the ability is not offered.
 */
function healChoiceSets(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  source: InstanceId,
  cost: AbilityCost | undefined,
  sets: readonly CostChoiceSet[],
): readonly CostChoiceSet[] {
  const heal = cost?.healCharacter;
  if (!heal) return sets;
  const candidates = healCostChoices(state, deps, source, playerId, heal);
  if (candidates.length === 0) return sets;
  return sets.flatMap(({ costChoices, target }) =>
    candidates.map((card) => ({ costChoices: { ...costChoices, [heal.slot]: [card] }, target: target ?? card })),
  );
}

/**
 * "Choose a non-Elite minion" before the arrow (`AbilityCost.chooseTarget`, hero-pack spec H3.5): each variant once per
 * card the payer may pick, which is the variant's target. A pick the rest of the cost cannot be paid for (a counter
 * cost read off it) is dropped by the engine's own check (`planCost`). With no candidate the variants are left as they
 * are, and that check refuses them, so the ability is not offered.
 */
function chooseTargetChoiceSets(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  source: InstanceId,
  cost: AbilityCost | undefined,
  sets: readonly CostChoiceSet[],
): readonly CostChoiceSet[] {
  const choose = cost?.chooseTarget;
  if (!choose) return sets;
  const candidates = chooseTargetCostChoices(state, deps, source, playerId, choose);
  if (candidates.length === 0) return sets;
  return sets.flatMap(({ costChoices, target }) =>
    candidates.map((card) => ({ costChoices: { ...costChoices, [choose.slot]: [card] }, target: target ?? card })),
  );
}

/**
 * "Deal a player 1 facedown encounter card →" (`AbilityCost.dealEncounterCardsTo`): each variant once per player the
 * payer may pick, named by that player's identity card (the variant's target). With one player the pick is forced
 * and the variants are left as they are.
 */
function dealToChoiceSets(
  state: GameState,
  cost: AbilityCost | undefined,
  sets: readonly CostChoiceSet[],
): readonly CostChoiceSet[] {
  const deal = cost?.dealEncounterCardsTo;
  if (!deal) return sets;
  const candidates = dealToCostChoices(state);
  if (candidates.length < 2) return sets;
  return sets.flatMap(({ costChoices, target }) =>
    candidates.map((identity) => ({
      costChoices: { ...costChoices, [deal.slot]: [identity] },
      target: target ?? identity,
    })),
  );
}

/**
 * "Resolve the 'Special' ability on the [SETTING] environment →" with several such cards in play
 * (`AbilityCost.resolveAbility.choose`, docs/phase7-wave8.md §3.24, §4.1 Q15 = A): each variant once per card the cost
 * could name. `planCost` drops the ones whose abilities would change nothing. With one card or none the variants are
 * left as they are: the pick is forced, or the engine's own check says why the cost cannot be paid.
 */
function resolveChoiceSets(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  source: InstanceId,
  cost: AbilityCost | undefined,
  sets: readonly CostChoiceSet[],
): readonly CostChoiceSet[] {
  const resolve = cost?.resolveAbility;
  const slot = resolve?.choose;
  if (!resolve || !slot) return sets;
  const candidates = resolveAbilityCostCandidates(state, deps, source, playerId, resolve, {});
  if (candidates.length < 2) return sets;
  return sets.flatMap(({ costChoices, target }) =>
    candidates.map((card) => ({ costChoices: { ...costChoices, [slot]: [card] }, target: target ?? card })),
  );
}

/** The `costChoices` to try, one per candidate for a "pay the printed cost of …" pick. */
function pickChoiceSets(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  source: InstanceId,
  cost: AbilityCost | undefined,
  picks: readonly InstanceId[],
): readonly CostChoiceSet[] {
  const base: CostChoices = {
    ...defaultInPlayPicks(state, deps, source, playerId, cost),
    ...(costWithChangeForm(state, deps, source, playerId, cost)?.discardFromHand ? { discard: picks } : {}),
  };
  const baseChoices = Object.keys(base).length > 0 ? base : undefined;
  // "Choose an ATTACK event in your hand … →" (`chooseCard`, docs/phase7-wave6.md §3.42): one variant per card of the
  // payer's own zone; the engine's own check (`planCost`) drops the ones that cannot be chosen.
  const pick = cost?.chooseCard;
  if (pick) {
    const context = { selfInstanceId: source, controllerId: playerId, event: null, bindings: {}, deps };
    const query = pick.from.query;
    const candidates = cardZoneCandidates(state, { ...pick.from, player: "you" }, playerId).filter(
      (id) => id !== source && (!query || matchesQuery(state, id, query, context)),
    );
    if (candidates.length === 0) return [{ costChoices: baseChoices, target: null }];
    return candidates.map((candidate) => ({ costChoices: { ...base, [pick.slot]: [candidate] }, target: candidate }));
  }
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
  const example = first.variant.build(payment);
  const targets = [...new Set(working.flatMap((t) => (t.variant.target === null ? [] : [t.variant.target])))];
  const controllers = variants.some((v) => v.controllerId !== undefined)
    ? [...new Set(working.flatMap((t) => (t.variant.controllerId ? [t.variant.controllerId] : [])))]
    : undefined;
  const costBranches = variants.some((v) => v.branch !== undefined)
    ? [...new Set(working.flatMap((t) => (t.variant.branch === undefined ? [] : [t.variant.branch])))].sort(
        (a, b) => a - b,
      )
    : undefined;
  // Who can pay each delegable part (`LegalAction.costHelp`), from the variants that work, in the order tried.
  const helpParts = DELEGABLE_COST_PARTS.filter((part) => variants.some((v) => v.partPayers?.[part] !== undefined));
  const costHelp: readonly CostHelp[] = helpParts.map((part) => ({
    part,
    payers: [...new Set(working.flatMap((t) => t.variant.partPayers?.[part] ?? []))],
  }));
  return {
    legal: {
      action,
      example,
      targets,
      blockedTargets,
      ...(controllers ? { controllers } : {}),
      needsPayment:
        payment.length > 0 ||
        printsX(state, action) ||
        ("playerId" in example && choosesSpendSize(state, deps, example.playerId, action)) ||
        ("playerId" in example && overpayMatters(state, deps, example.playerId, action)),
      ...(costBranches ? { costBranches } : {}),
      ...(costHelp.length > 0 ? { costHelp } : {}),
    },
  };
}

/**
 * RRG 1.8 "Event" (p. 18): "If an event has more than one triggered ability on it, the player playing it chooses one of
 * those abilities to trigger when playing that event." So an event that prints several Action abilities is judged one
 * ability at a time, each on its own form, condition, targets and cost: the play is legal when any of them is, and
 * `LegalAction.abilities` lists the ones that are. Every other card is judged once, with a command that names none.
 */
/**
 * The cards outside the player's hand that an "as if it was in your hand" permission stands over: the top card of their
 * deck (`playableTopOfDeck`, docs/phase7-wave8.md §3.49) and each covered tucked card (`playableAsIfInHand`,
 * docs/phase7-wave11.md §3.8), as a list: listed legal while the limit is unused, and illegal with `limit_reached`
 * once it is used ("once per phase"). A card that is never played (a resource, an encounter card, a "—" cost) is not
 * listed at all, and with no permission in force (the other form, a blank text box) neither is anything else.
 */
function asIfInHandToList(state: GameState, deps: EngineDeps, playerId: PlayerId): readonly InstanceId[] {
  return asIfInHandPermissions(state, deps, playerId).flatMap(({ instanceId }) => {
    const card = cardOf(state, instanceId);
    if (!card || card.type === "resource" || !("cost" in card)) return [];
    if (neverPlayedFault(card)) return [];
    return [instanceId];
  });
}

function evaluatePlay(state: GameState, deps: EngineDeps, playerId: PlayerId, id: InstanceId): Evaluated | null {
  const card = cardOf(state, id);
  if (!card) return null;
  const ctx = createCtx(state, deps);
  const actions = eventActions(ctx, card);
  if (actions.length < 2) return evaluatePlayOf(state, deps, playerId, id, card, actions[0]?.definition, undefined);
  // Only the abilities usable now are offered; with none, the first says why the card cannot be played.
  const usable = usableEventActions(ctx, card, id, playerId);
  const judged = (usable.length > 0 ? usable : actions.slice(0, 1)).map((action) => ({
    abilityId: action.abilityId,
    evaluated: evaluatePlayOf(state, deps, playerId, id, card, action.definition, action.abilityId),
  }));
  const legal = judged.filter((entry) => "legal" in entry.evaluated);
  const [first] = legal;
  if (!first || !("legal" in first.evaluated)) return judged[0]?.evaluated ?? null;
  return { legal: { ...first.evaluated.legal, abilities: legal.map((entry) => entry.abilityId) } };
}

function evaluatePlayOf(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  id: InstanceId,
  card: AnyCard,
  /** The event's Action ability this play triggers, and its id when the command must name it. */
  ability: AbilityDefinition | undefined,
  abilityId: AbilityId | undefined,
): Evaluated {
  // With the card's additional cost to play (`playCostWith`, box-heroes B3.1), as the play command plans it.
  const cost = costAsDetermined(state, deps, id, playerId, playCostWith(state, deps, id, playerId, ability?.cost));
  const picks = discardPicks(state, deps, playerId, id, cost);
  const reserved = new Set([id, ...picks]);
  const spend = spendOrder(state, deps, playerId, reserved, id);
  const context: EffectContext = {
    selfInstanceId: id,
    controllerId: playerId,
    event: null,
    bindings: {},
    deps,
    // "Players may attach upgrades to allies in the mission area" (`RuleSpec playDestination.attachments`).
    ...attachmentReachOf(state, deps, id),
  };
  // A host at the card's own maximum stays a candidate, so the play command's refusal reaches `blockedTargets`.
  const candidateHosts =
    card.type === "upgrade" && card.attachesTo
      ? attachmentHostCandidates(state, card.attachesTo, context, { ignoreAttachLimits: true })
      : [];
  // With no candidate host, one host-less variant lets the engine say why.
  const hosts: readonly (InstanceId | null)[] = candidateHosts.length > 0 ? candidateHosts : [null];
  const restrictions = "playRestrictions" in card ? card.playRestrictions : undefined;
  const controllers: readonly (PlayerId | undefined)[] = restrictions?.anyPlayerControl
    ? playerOrder(state).map((p) => p.playerId)
    : [undefined];
  // Each usable "reduce the cost to play that card" ability is its own variant, after the unreduced ones, so a card
  // that is affordable anyway is offered without it and one that is only affordable with it is still offered
  // (docs/phase7-wave3.md §3.20). The client decides whether to use it; this only makes the play reachable.
  const reducers = playCostReducers(state, deps, playerId, id);
  const reductionSets: readonly (readonly { instanceId: InstanceId; abilityId: AbilityId }[])[] = [
    [],
    ...reducers.map((reducer) => [reducer]),
  ];
  // A printed X cost is probed at the least X the card may be played with (`AbilityDefinition.minX`; 0 for most).
  const leastX = minimumChosenX(state, deps, id, abilityId);
  const variantsOver = (over: readonly (InstanceId | null)[]): Variant[] => {
    const variants: Variant[] = [];
    for (const reductions of reductionSets) for (const host of over) variants.push(...variantsOn(reductions, host));
    return variants;
  };
  const variantsOn = (
    reductions: readonly { instanceId: InstanceId; abilityId: AbilityId }[],
    host: InstanceId | null,
  ): Variant[] => {
    const variants: Variant[] = [];
    for (const { costChoices, target } of costChoiceSets(state, deps, playerId, id, cost, picks)) {
      for (const controllerId of controllers) {
        for (const branch of branchSelections(cost)) {
          // An alliance card's delegable cost parts (RRG 1.8 "Alliance", p. 6; owner answer 48B): one variant per
          // way of sharing them out, the user paying everything first. One `undefined` entry for every other card.
          for (const partPayers of partPayerSets(state, deps, playerId, id, delegableParts(cost, branch)))
            variants.push({
              target: host ?? target,
              ...(controllerId ? { controllerId } : {}),
              ...(branch === undefined ? {} : { branch }),
              ...(partPayers ? { partPayers } : {}),
              build: (payment) => ({
                type: "playCard",
                playerId,
                cardInstanceId: id,
                payment,
                attachToInstanceId: host,
                ...(costChoices ? { costChoices } : {}),
                ...(controllerId && controllerId !== playerId ? { controllerId } : {}),
                ...(reductions.length > 0 ? { costReductionAbilities: reductions } : {}),
                ...withBranch(branch, paidByOf(playerId, partPayers)),
                ...(abilityId ? { abilityId } : {}),
                ...(leastX > 0 ? { x: leastX } : {}),
              }),
            });
        }
      }
    }
    return variants;
  };
  const variants = variantsOver(hosts);
  const asIfInHand = getPlayer(state, playerId)?.hand.includes(id)
    ? undefined
    : asIfInHandPermissions(state, deps, playerId).find((p) => p.instanceId === id);
  const action: ActionRef = {
    kind: "playCard",
    instanceId: id,
    ...(asIfInHand ? { from: asIfInHand.from } : {}),
  };
  const tryWallets = withThwartCostWallets(
    state,
    deps,
    ability,
    leavingCardsToDiscard(walletsWithWhenSpent(state, deps, playerId, reserved, id, spend), cost),
  );
  const own = evaluate(state, deps, action, variants, tryWallets);
  const ranged = (evaluated: Evaluated): Evaluated =>
    withEncounterDiscard(
      withCounterRange(evaluated, counterRange(state, deps, playerId, id, cost)),
      encounterDiscardRange(state, cost),
    );
  if ("legal" in own) return withDestinations(state, deps, id, ranged(own));
  // Not playable to the player's own area. A reduction that reads the destination may still pay for it there
  // (docs/phase7-wave8.md §3.35): the same variants, each naming the area. An upgrade with "attach to" text has other
  // hosts there (`hostsInArea`), so it may be playable into the area with no legal host anywhere else.
  for (const area of playDestinationsOf(state, deps, id)) {
    const hostsThere = hostsInArea(state, deps, id, playerId, area, { ignoreAttachLimits: true });
    if (hostsThere === null && areaCostReductionFor(state, deps, playerId, id, area) <= 0) continue;
    if (hostsThere?.length === 0) continue;
    const there = (hostsThere === null ? variants : variantsOver(hostsThere)).map((variant) => ({
      ...variant,
      build: (payment: readonly Payment[]): Command => {
        const command = variant.build(payment);
        return command.type === "playCard" ? { ...command, into: { scenarioPlayArea: area } } : command;
      },
    }));
    const evaluated = withDestinations(state, deps, id, ranged(evaluate(state, deps, action, there, tryWallets)));
    if ("legal" in evaluated) return { legal: { ...evaluated.legal, destinationOnly: true } };
  }
  return own;
}

/**
 * The cards in an in-play scenario area that an upgrade with "attach to" text may take as its host when it is played
 * into that area (`playCard.into`), read as the play command reads them: its own text, reaching into the area. Null
 * for any other card, which is played into an area with no host.
 */
function hostsInArea(
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  playerId: PlayerId,
  area: string,
  opts: { readonly ignoreAttachLimits?: true } = {},
): readonly InstanceId[] | null {
  const card = cardOf(state, id);
  if (card?.type !== "upgrade" || !card.attachesTo) return null;
  const context: EffectContext = {
    selfInstanceId: id,
    controllerId: playerId,
    event: null,
    bindings: {},
    deps,
    reaches: { scenarioPlayArea: area },
  };
  return attachmentHostCandidates(state, card.attachesTo, context, opts).filter(
    (host) => scenarioPlayAreaOf(state, host) === area,
  );
}

/**
 * Adds `destinations` to a legal play that may also go to an in-play scenario area (`RuleSpec playDestination`,
 * docs/phase7-wave8.md §3.34): each area the same command is accepted for with `into` naming it. An upgrade with
 * "attach to" text is attached to a card in the area it is played into, so for it the command also names one of the
 * hosts there, listed in `destinationHosts`.
 */
function withDestinations(state: GameState, deps: EngineDeps, id: InstanceId, evaluated: Evaluated): Evaluated {
  if (!("legal" in evaluated) || evaluated.legal.example.type !== "playCard") return evaluated;
  const example = evaluated.legal.example;
  // The example pays for the play it names. Another area may price the card lower, never higher, and overpaying is
  // legal (RRG 1.8 "Cost", p. 13), so the same payment is accepted wherever the play itself is.
  const destinations: string[] = [];
  const destinationHosts: Record<string, readonly InstanceId[]> = {};
  for (const area of playDestinationsOf(state, deps, id)) {
    const into = { scenarioPlayArea: area };
    const hostsThere = hostsInArea(state, deps, id, example.playerId, area);
    if (hostsThere === null) {
      if (probe(state, deps, { ...example, into }).ok) destinations.push(area);
      continue;
    }
    const legal = hostsThere.filter((host) => probe(state, deps, { ...example, attachToInstanceId: host, into }).ok);
    if (legal.length === 0) continue;
    destinations.push(area);
    destinationHosts[area] = legal;
  }
  if (destinations.length === 0) return evaluated;
  const hosted = Object.keys(destinationHosts).length > 0 ? { destinationHosts } : {};
  return { legal: { ...evaluated.legal, destinations, ...hosted } };
}

/** Adds `costCounters` to a legal action whose cost removes "up to N" counters (docs/phase7-wave3.md §3.32). */
const withCounterRange = (
  evaluated: Evaluated,
  range: { readonly min: number; readonly max: number } | undefined,
): Evaluated => ("legal" in evaluated && range ? { legal: { ...evaluated.legal, costCounters: range } } : evaluated);

/** Adds `encounterDeckDiscard` to a legal action whose cost discards from the encounter deck (wave 9 §3.43 (a)). */
const withEncounterDiscard = (evaluated: Evaluated, range: LegalAction["encounterDeckDiscard"]): Evaluated =>
  "legal" in evaluated && range ? { legal: { ...evaluated.legal, encounterDeckDiscard: range } } : evaluated;

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
  const reserved = new Set(picks);
  // A cost any player may help pay (`RuleSpec costsPayableByAnyPlayer`, hero-packs H3.19) is paid for its card, which
  // is what makes the other players' hand cards and resource abilities sources (`paymentOptions`).
  const payingFor = costsPayableByAnyPlayer(state, deps, instanceId) ? instanceId : null;
  const spend = spendOrder(state, deps, playerId, reserved, payingFor);
  const chosenSize = resourcesChoiceOf(cost);
  const variants: Variant[] = costChoiceSets(state, deps, playerId, instanceId, cost, picks).flatMap(
    ({ costChoices, target }) =>
      branchSelections(cost).flatMap((branch) =>
        partPayerSets(state, deps, playerId, instanceId, delegableParts(cost, branch)).map((partPayers) => ({
          target,
          ...(branch === undefined ? {} : { branch }),
          ...(partPayers ? { partPayers } : {}),
          build: (payment: readonly Payment[]): Command => ({
            type: "useAbility",
            playerId,
            cardInstanceId: instanceId,
            abilityId,
            // A hand card a `chooseCard` cost picks cannot also pay (RRG 1.8 "Cost", p. 13: one card, one cost).
            payment: cost?.chooseCard ? payment.filter((p) => !("fromHand" in p && p.fromHand === target)) : payment,
            ...(costChoices ? { costChoices } : {}),
            ...withBranch(branch, paidByOf(playerId, partPayers)),
          }),
        })),
      ),
  );
  const evaluated = evaluate(
    state,
    deps,
    { kind: "useAbility", instanceId, abilityId },
    variants,
    withThwartCostWallets(
      state,
      deps,
      deps.abilities[abilityId],
      leavingCardsToDiscard(
        [
          ...chosenSizeWallets(state, deps, playerId, spend, chosenSize, instanceId),
          ...walletsWithWhenSpent(state, deps, playerId, reserved, payingFor, spend),
        ],
        cost,
      ),
    ),
  );
  const ranged = withEncounterDiscard(
    withCounterRange(evaluated, counterRange(state, deps, playerId, instanceId, cost)),
    encounterDiscardRange(state, cost),
  );
  return "legal" in ranged && chosenSize ? { legal: { ...ranged.legal, chosenResources: chosenSize } } : ranged;
}

/**
 * Action abilities the player could trigger, as candidates for `evaluateAbility` to probe through the `useAbility`
 * command: on cards they control, on cards nobody controls (encounter cards), and on any card in play, another
 * player's included, whose ability names them (`triggerableBy`: "Any player may trigger this ability"). Who is named
 * comes from `triggeringPlayers`, which the command reads too. The command stays the judge of the rest (an attachment
 * on another player's card, an obligation, a "cannot", the form, the limit, the cost), so a candidate it refuses is
 * listed as illegal with its reason, never as legal.
 */
function actionAbilities(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
): readonly { readonly instanceId: InstanceId; readonly abilityId: AbilityId }[] {
  const found: { instanceId: InstanceId; abilityId: AbilityId }[] = [];
  // The cards in play, then the player's own hand for abilities that work in hand (docs/phase7-wave4.md §3.13).
  const hand = getPlayer(state, playerId)?.hand ?? [];
  for (const id of [...cardsInPlay(state), ...hand]) {
    const inHand = hand.includes(id);
    const controller = inHand ? playerId : controllerOf(state, id);
    for (const ref of activeAbilityRefs(state, id, deps)) {
      const definition = deps.abilities[ref.id];
      const trigger = definition?.trigger;
      if (trigger?.kind !== "action") continue;
      if ((definition?.activeIn === "hand") !== inHand) continue;
      // "Any player whose alter-ego has the [MUTANT] trait may trigger this ability" names who may (§3.11 of wave 6);
      // otherwise the card's controller, or any player on a card nobody controls (an encounter card).
      const named = inHand ? null : triggeringPlayers(state, deps, id, trigger, null);
      if (named ? !named.includes(playerId) : controller !== null && controller !== playerId) continue;
      // An ally under no player's control is used by nobody (docs/phase7-wave9.md §3.19; `isCaptiveAlly`).
      if (!named && isCaptiveAlly(state, id)) continue;
      // "First Player Action" (docs/phase7-wave3.md §3.13).
      if (trigger.firstPlayerOnly === true && playerId !== state.firstPlayerId) continue;
      found.push({ instanceId: id, abilityId: ref.id });
    }
  }
  return found;
}

/** A "Forced Action" its player could trigger right now, with a command that does (`outstandingForcedActions`). */
export interface OutstandingForcedAction {
  readonly playerId: PlayerId;
  readonly instanceId: InstanceId;
  readonly abilityId: AbilityId;
  /** A complete `useAbility` command the engine accepts for it on that player's turn: the smallest payment found. */
  readonly example: Command & { readonly type: "useAbility" };
}

/** The option id of one forced action in a `chooseOption { forcedAction }` prompt. */
export const forcedActionOptionId = (instanceId: InstanceId, abilityId: AbilityId): string =>
  `forcedAction:${instanceId}:${abilityId}`;

/**
 * The player a card's "Forced Action" is put to (docs/phase7-wave9.md §3.53): its controller, else the "you" of a
 * card nobody controls (the player whose card an encounter attachment is on, RRG 1.8 "Attachment", p. 8; the holder of
 * an obligation, p. 30). A card that is nobody's in that sense (an encounter card in the villain's play area) may be
 * triggered by any player and is put to the first player.
 */
const forcedActionPlayer = (state: GameState, id: InstanceId): PlayerId =>
  controllerOf(state, id) ?? uncontrolledYouOf(state, id) ?? state.firstPlayerId;

/**
 * The "Forced Action" abilities `playerId` must still resolve before the player phase can end (RRG 1.8 "Action", p. 6;
 * "Forced Action", p. 20; docs/phase7-wave9.md §3.53): those on cards in play that are theirs to trigger and that the
 * `useAbility` command would accept from them on their turn, so the card is in play and its text box is not blank,
 * the cost can be paid now and each target the ability requires exists (the two outs the RRG gives). An ability whose
 * effect would change nothing is still outstanding (MC55 p. 22).
 *
 * A pure query over a state at any moment: it asks about the cards as they stand, as if it were that player's moment
 * to act, so what is on the stack or which step the game is in does not matter. An eliminated player has none.
 */
export function outstandingForcedActions(
  state: GameState,
  playerId: PlayerId,
  deps: EngineDeps = DEFAULT_DEPS,
): readonly OutstandingForcedAction[] {
  const player = getPlayer(state, playerId);
  if (!player || player.eliminated || state.outcome) return [];
  const candidates: { instanceId: InstanceId; abilityId: AbilityId }[] = [];
  for (const id of cardsInPlay(state)) {
    for (const ref of activeAbilityRefs(state, id, deps)) {
      const trigger = deps.abilities[ref.id]?.trigger;
      if (trigger?.kind !== "action" || trigger.forced !== true) continue;
      if (forcedActionPlayer(state, id) !== playerId) continue;
      candidates.push({ instanceId: id, abilityId: ref.id });
    }
  }
  if (candidates.length === 0) return [];
  // That player's moment to act: their turn, with nothing resolving and nothing asked.
  const asTheirTurn: GameState = {
    ...state,
    stack: [],
    pendingChoice: null,
    step: { phase: "player", kind: "turn", activePlayerId: playerId, remainingPlayerIds: [] },
  };
  return candidates.flatMap(({ instanceId, abilityId }) => {
    const evaluated = evaluateAbility(asTheirTurn, deps, playerId, instanceId, abilityId);
    if (!("legal" in evaluated) || evaluated.legal.example.type !== "useAbility") return [];
    return [{ playerId, instanceId, abilityId, example: evaluated.legal.example }];
  });
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
 * Outside the player's own turn it says what the game is waiting on instead, with the Action abilities the player
 * may still offer during another player's turn.
 */
export function legalActions(state: GameState, playerId: PlayerId, deps: EngineDeps = DEFAULT_DEPS): LegalActions {
  if (state.outcome) return { kind: "gameOver" };
  if (state.pendingChoice) return { kind: "choice", choice: state.pendingChoice };
  const step = state.step;
  const waiting = (activePlayerId: PlayerId | null): LegalActions => ({
    kind: "notYourTurn",
    activePlayerId,
    legal: [],
    illegal: [],
  });
  if (step.phase !== "player" || step.kind !== "turn") return waiting(null);
  // The turn has ended and the phase waits on a forced action (`GameStep turn.ended`): nothing is anyone's to take.
  if (step.ended) return waiting(null);
  const player = getPlayer(state, playerId);
  if (!player || player.eliminated) return waiting(step.activePlayerId);
  const ownTurn = step.activePlayerId === playerId;

  const results: Evaluated[] = [];
  // Hand cards, and discard pile cards whose own permission allows playing them from there (RRG 1.8 "Play Restrictions
  // and Permissions", p. 33).
  // Cards attached to a card that lets its controller play them from there (Hawkeye's Quiver; docs/phase7-wave2.md §3.10).
  const attached = attachmentsPlayableBy(state, deps, playerId);
  const probeCtx = createCtx(state, deps);
  for (const id of [
    ...player.hand,
    ...player.discard.filter((id) => playableFromDiscard(state, deps, playerId, id)),
    ...attached,
    ...asIfInHandToList(state, deps, playerId),
  ]) {
    // During another player's turn only an event whose play is its Action can be played (RRG 1.8 "Action", p. 6).
    const card = cardOf(state, id);
    if (!ownTurn && !(card && isActionEvent(probeCtx, card))) continue;
    const evaluated = evaluatePlay(state, deps, playerId, id);
    if (evaluated) results.push(evaluated);
  }
  for (const { instanceId, abilityId } of actionAbilities(state, deps, playerId)) {
    results.push(evaluateAbility(state, deps, playerId, instanceId, abilityId));
  }
  // That is all another player's turn allows: Action abilities, offered as on the player's own turn.
  if (!ownTurn) {
    return {
      kind: "notYourTurn",
      activePlayerId: step.activePlayerId,
      legal: results.flatMap((r) => ("legal" in r ? [r.legal] : [])),
      illegal: results.flatMap((r) => ("illegal" in r ? [r.illegal] : [])),
    };
  }

  const characters = [player.identity.instanceId, ...player.playArea.filter((id) => isAlly(state, id))];
  const enemies = [
    // Any undefeated villain, not only the active one (The Wrecking Crew insert: "Players may attack any villain").
    ...undefeatedVillains(state).map((villain) => villain.instanceId),
    // Not a minion in a closed in-play scenario area (the mission area): `inClosedScenarioPlayArea`.
    ...cardsInPlay(state).filter((id) => isMinion(state, id) && !inClosedScenarioPlayArea(state, id)),
    // A card any player can attack "as if it were a minion" (`RuleSpec attackableAsMinion`, wave 9 §3.50).
    ...cardsInPlay(state).filter((id) => !isMinion(state, id) && attackableAsMinion(state, id, deps)),
  ];
  const schemes = [
    ...mainSchemeStates(state).map((scheme) => scheme.instanceId),
    ...state.villainArea.filter((id) => {
      const type = cardOf(state, id)?.type;
      return type === "side_scheme" || type === "player_side_scheme";
    }),
  ];
  // A basic power with an additional "discard N cards" cost gets the cheapest picks filled in (`basicPowerCosts`);
  // one whose additional costs ask for resources is tried with a payment (`basicPowerWithCost`).
  const powerOf = (action: BasicPowerRef, targets: readonly InstanceId[]): Evaluated => {
    const character = action.instanceId;
    const power = action.kind === "basicAttack" ? "attack" : "thwart";
    const costed = basicPowerWithCost(state, deps, playerId, action);
    const picks = discardPicks(state, deps, playerId, character, basicPowerCost(state, deps, character, power));
    const costChoices = costed?.costChoices ?? (picks.length > 0 ? { discard: picks } : undefined);
    const variants: Variant[] = targets.map((target) => ({
      target,
      build: (payment) => basicPowerCommandWith(playerId, action, target, costChoices, costed ? payment : []),
    }));
    return evaluate(state, deps, action, variants, costed?.tryWallets ?? NO_PAYMENT);
  };
  for (const attacker of characters) results.push(powerOf({ kind: "basicAttack", instanceId: attacker }, enemies));
  for (const thwarter of characters) results.push(powerOf({ kind: "basicThwart", instanceId: thwarter }, schemes));
  results.push(simple(state, deps, playerId, { kind: "basicRecover" }));
  const identityCard = cardOf(state, player.identity.instanceId);
  const faces = identityCard?.type === "hero_identity" ? heroFacesOf(identityCard).length : 1;
  if (faces > 1) {
    // A three-sided identity: each form it is not in right now is its own action.
    if (player.identity.form === "hero")
      results.push(evaluateChangeForm(state, deps, playerId, { kind: "changeForm", to: "alterEgo" }));
    for (let heroForm = 0; heroForm < faces; heroForm++) {
      if (player.identity.form === "hero" && player.identity.heroFormIndex === heroForm) continue;
      results.push(evaluateChangeForm(state, deps, playerId, { kind: "changeForm", to: { heroForm } }));
    }
  } else {
    results.push(evaluateChangeForm(state, deps, playerId, { kind: "changeForm" }));
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
  /**
   * The option-id shape `paymentOptions` produces: "hand:<id>" | "hand:<id>:<abilityId>" (`spendsHandCard`) |
   * "ability:<id>:<abilityId>", with ":<n>" for a
   * repeated use and "@<slot>=<id>,…" for the cards a resource ability's own cost picks (`resourceAbilityOptionId`).
   */
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
   * the pool as of the current discard pile, not a promise. A resource ability whose cost picks a card is one source
   * per legal pick, each with what that pick generates ("generate that upgrade's resources", Sync Ratio).
   */
  readonly pool: Readonly<Record<ResourceIconType, number>>;
  /** The cards this source's own cost picks, by slot (a resource ability's `ResourceAbilityUse.costChoices`). */
  readonly costChoices?: CostChoices;
  /**
   * The amount this source's own cost removes when the source is one amount of several ("remove up to 2 threat from …
   * → generate a resource for each": a resource ability's `ResourceAbilityUse.costSelection`; docs/phase7-wave9.md
   * §3.7 (b)). The source for the most it can remove has none. A payment may hold one source of the same ability.
   *
   * Also the damage this source's own cost takes ("take up to 3 damage → … for each damage taken this way":
   * `CostSelection.damageSelf`; docs/phase7-wave10-hero-packs.md H3.14): one source per amount, each with what that
   * amount generates in `pool`. A `spendsHandCard` source carries it for the card's own ability
   * (`SpentCardAbilityUse.costSelection`); the option id holds it too ("#damageSelf=<n>").
   */
  readonly costSelection?: CostSelection;
  /**
   * This `resourceAbility` source is a card in hand spent with its own "Interrupt: When you spend this card, [cost] →
   * generate …" (`Payment.whenSpent`; option id "hand:<id>:<abilityId>…"): `instanceId` is the hand card, choosing it
   * discards that card, and `pool` is the card's resources and the ability's together. The card's plain `handCard`
   * source is listed as well, and a payment holds one of the two (one card is spent once).
   */
  readonly spendsHandCard?: true;
  /**
   * This `handCard` source is not in the player's hand: it is tucked under this card, whose rule lets the player
   * spend it "as if it were in their hand" (`RuleSpec spendableFromTucked`, Resource Reserve; docs/phase7-wave9.md
   * §3.46 (c)). Its option id is a hand card's; choosing it discards it from under its host. Absent for a card in hand.
   */
  readonly tuckedUnder?: InstanceId;
  /**
   * This `resourceAbility` source generates "to overpay for a card" (`AbilityDefinition.overpayOnly`, Mr. Hollywood;
   * docs/phase7-wave10-hero-packs.md H3.14): its `pool` never counts toward `requirement`, so the other sources
   * selected must cover the cost by themselves, and everything in `pool` is overpaid. Listed only while a card is
   * being played. `suggested` never holds it (the smallest working payment has no use for it); a selection that needs
   * it to reach the cost is refused by `tryPayment` with `insufficient_resources`.
   */
  readonly overpayOnly?: true;
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
  /**
   * The cost is a number of resources the player chooses (`LegalAction.chosenResources`): the selection must generate
   * at least `min` resources, and what it generates beyond `max` is overpaid (owner decision, 2026-10-08).
   * `requirement` is then what the rest of the cost asks (0).
   */
  readonly chosenResources?: { readonly min: number; readonly max: number };
  /**
   * Overpaying matters for this play: the card reads an `overpaid.*` value, or a resource that can only be overpaid
   * (`PaymentSource.overpayOnly`) is on offer for it. Set only on a play with nothing to pay, where it is the whole
   * reason the query exists; the cost is 0, so paying nothing is a legal default and anything spent is overpaid.
   */
  readonly overpayMatters?: true;
  /**
   * The player's resource abilities that cannot pay for this card only because they generate for another kind of card
   * (`resourcesNotFor`: Finesse's "for an aspect card" while paying for a hero card). Never sources; listed so the pay
   * step can show them as unusable, with the reason (issue #292).
   */
  readonly notForThisCard?: readonly PaymentNotFor[];
}

/** A resource ability that generates only for another kind of card than the one being paid for (`notForThisCard`). */
export interface PaymentNotFor {
  readonly instanceId: InstanceId;
  readonly abilityId: AbilityId;
  /** Card name. */
  readonly label: string;
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
  /** One of `LegalAction.abilities`: the event's Action ability being triggered. Absent: the first of them. */
  readonly abilityId?: AbilityId;
  /**
   * One of `LegalAction.destinations`: the in-play scenario area the card is played into, which the price may read
   * (docs/phase7-wave8.md §3.35). Absent: the player's own play area.
   */
  readonly into?: string;
  /**
   * The X the player names for a cost printed "X" (`playCard.x`; RRG 1.8 "Non-Numerical Variable", p. 30). Absent:
   * the least X the card may be played with (`minimumChosenX`: 0 unless its ability sets `minX`), which is also what
   * `legalActions` probes the play at. Ignored by a card with no printed X.
   */
  readonly x?: number;
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
  /** The range of a chosen-size resource cost (`ResourcesChoice`), for an ability that has one. */
  readonly chosenResources?: { readonly min: number; readonly max: number };
  /** The wallets to try for `suggested`, in place of the usual ones (a form change's exact-size payments first). */
  readonly preferred?: readonly (readonly Payment[])[];
}

const NO_RESERVED: ReadonlySet<InstanceId> = new Set();

const mergeChoices = (auto: CostChoices | undefined, given: CostChoices | undefined): CostChoices | undefined => {
  const merged = { ...auto, ...given };
  return Object.keys(merged).length > 0 ? merged : undefined;
};

/** The inverse of `paymentsFromOptionIds`: a repeated resource ability's n-th use is "…:<n>" (§3.25 of wave 5). */
const optionIdsOf = (payment: readonly Payment[]): readonly string[] => {
  const uses = new Map<string, number>();
  return payment.map((entry) => {
    if ("fromHand" in entry) return spentCardOptionId(entry);
    const id = resourceAbilityOptionId(entry.ability);
    const n = (uses.get(id) ?? 0) + 1;
    uses.set(id, n);
    return n === 1 ? id : resourceAbilityOptionId(entry.ability, n);
  });
};

/** True when the player may still choose to spend even though the fixed cost is 0 ("Spend X resources…", a chosen size). */
const isSpendable = (requirement: ResolvedRequirement | null, cost: AbilityCost | undefined): boolean =>
  requirement !== null &&
  (requirementTotal(requirement) > 0 || cost?.resourcesX !== undefined || resourcesChoiceOf(cost) !== null);

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
    // The event's Action ability being paid for (RRG 1.8 "Event", p. 18): the one the player chose, else the first
    // usable one, which is what `LegalAction.example` triggers.
    const query = card ? eventActionForQuery(createCtx(state, deps), card, id, playerId, options.abilityId) : null;
    const abilityId = query?.named ? query.action?.abilityId : undefined;
    const cost = costAsDetermined(
      state,
      deps,
      id,
      playerId,
      playCostWith(state, deps, id, playerId, query?.action?.definition.cost),
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
    // The X of a printed X cost: the player's (`PaymentContext.x`), else the least the card may be played with.
    const x = options.x ?? minimumChosenX(state, deps, id, abilityId);
    const requirement =
      card && planned
        ? playRequirement(
            state,
            playerId,
            id,
            planned.requirement,
            deps,
            host,
            x,
            asIfInHandCostReduction(state, deps, playerId, id) +
              Math.max(0, areaCostReductionFor(state, deps, playerId, id, options.into ?? null)),
          )
        : null;
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
        ...(abilityId ? { abilityId } : {}),
        ...(options.into !== undefined ? { into: { scenarioPlayArea: options.into } } : {}),
        ...(x > 0 ? { x } : {}),
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
    const chosenResources = resourcesChoiceOf(cost);
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
      payingFor: planned?.payingFor ?? instanceId,
      requirement: planned?.requirement ?? null,
      spendable: isSpendable(planned?.requirement ?? null, cost),
      ...(chosenResources ? { chosenResources } : {}),
    };
  }
  if (action.kind === "basicAttack" || action.kind === "basicThwart") {
    // Only a basic power whose additional costs ask for resources carries a payment (docs/phase7-wave9.md §3.31).
    const costed = basicPowerWithCost(state, deps, playerId, action, options.costChoices);
    const target = options.target;
    if (!costed || !target) return null;
    return {
      build: (payment) => basicPowerCommandWith(playerId, action, target, costed.costChoices, payment),
      excludeInstanceId: null,
      reserved: costed.reserved,
      payingFor: null,
      requirement: costed.requirement,
      spendable: true,
      preferred: costed.tryWallets,
    };
  }
  if (action.kind === "changeForm") {
    // Only a change with an additional cost carries a payment (docs/phase7-wave8.md §3.63); a free one is a basic action.
    const costed = formChangeWithCost(state, deps, playerId, action.to, options.costChoices);
    if (!costed) return null;
    return {
      build: costed.build,
      excludeInstanceId: null,
      reserved: costed.reserved,
      payingFor: null,
      requirement: costed.requirement,
      spendable: costed.requirement !== null && requirementTotal(costed.requirement) > 0,
      preferred: costed.tryWallets,
    };
  }
  return null;
}

/**
 * A play with nothing to pay that still has a pay step: overpaying means something for it. The card reads an
 * `overpaid.*` value, or a resource that can only be overpaid is on offer (`PaymentSource.overpayOnly`).
 */
function overpayMatters(state: GameState, deps: EngineDeps, playerId: PlayerId, action: ActionRef): boolean {
  if (action.kind !== "playCard") return false;
  if (readsOverpaid(state, deps, action)) return true;
  return paymentOptions(createCtx(state, deps), playerId, action.instanceId, action.instanceId).some(
    (option) => option.ref.kind === "ability" && deps.abilities[option.ref.abilityId]?.overpayOnly === true,
  );
}

/**
 * An ability whose cost spends a number of resources the player chooses ("spend X", "spend up to N"): the pay step is
 * where that number is chosen, so it opens even when the least payment is empty (issue #174, Nebula's Ship).
 */
function choosesSpendSize(state: GameState, deps: EngineDeps, playerId: PlayerId, action: ActionRef): boolean {
  if (action.kind !== "useAbility") return false;
  const cost = costAsDetermined(state, deps, action.instanceId, playerId, deps.abilities[action.abilityId]?.cost);
  return cost?.resourcesX !== undefined || resourcesChoiceOf(cost) !== null;
}

/** Whether the played card prints an X cost (`specialCost: "X"`), which the player names in the pay step (`PaymentContext.x`). */
function printsX(state: GameState, action: ActionRef): boolean {
  if (action.kind !== "playCard") return false;
  const card = cardOf(state, action.instanceId);
  return !!card && "specialCost" in card && card.specialCost === "X";
}

/** Whether a played card's printed abilities read an `overpaid.*` value anywhere in their text. */
function readsOverpaid(state: GameState, deps: EngineDeps, action: ActionRef): boolean {
  if (action.kind !== "playCard") return false;
  const card = cardOf(state, action.instanceId);
  return !!card && printedAbilityRefs(card).some((ref) => mentionsOverpaid(deps.abilities[ref.id]));
}

function mentionsOverpaid(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(mentionsOverpaid);
  if (value === null || typeof value !== "object") return false;
  const record = value as Readonly<Record<string, unknown>>;
  const name = record.kind === "var" || record.kind === "varAtLeast" ? record.name : undefined;
  if (typeof name === "string" && name.startsWith("overpaid.")) return true;
  return Object.values(record).some(mentionsOverpaid);
}

/**
 * What the player must pay for `action`, what they may pay it with, and the
 * payment the engine itself would make. Null when there is nothing to decide:
 * a basic action with no additional resource cost (a basic attack or thwart
 * that has one is asked with its `target`), a card that costs nothing and has no "spend X" cost, or a
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
  if (!payable || payable.requirement === null) return null;
  // A play with nothing to pay still has a pay step when overpaying means something for the card (checked below,
  // once the sources are known).
  if (!payable.spendable && action.kind !== "playCard") return null;
  const ctx = createCtx(state, deps);
  const discardTop = getPlayer(state, playerId)?.discard[0] ?? null;
  // Cards the cost's own picks already use (Nebula's Ship exhausts the Milano): their resource abilities cannot pay
  // the rest of it (RRG 1.8 "Cost", p. 13: one card cannot pay two parts of a cost), so they are not offered.
  const bare = payable.build([]);
  const claimed = new Set<InstanceId>(
    "costChoices" in bare && bare.costChoices ? Object.values(bare.costChoices).flat() : [],
  );
  const sources = paymentOptions(ctx, playerId, payable.excludeInstanceId, payable.payingFor).flatMap<PaymentSource>(
    (option) => {
      if (option.ref.kind === "card") {
        // A card the cost already claims cannot also be spent (RRG "Cost": each card pays once).
        if (payable.reserved.has(option.ref.instanceId)) return [];
        // A card spent "as if it were in their hand" from under its host (`RuleSpec spendableFromTucked`).
        const at = locateCard(state, option.ref.instanceId);
        return [
          {
            optionId: option.optionId,
            kind: "handCard",
            instanceId: option.ref.instanceId,
            label: option.label,
            pool: handCardResources(state, deps, option.ref.instanceId, playerId, payable.payingFor),
            ...(at?.kind === "tucked" ? { tuckedUnder: at.hostInstanceId } : {}),
          },
        ];
      }
      if (option.ref.kind !== "ability") return [];
      const [spending] = paymentsFromOptionIds([option.optionId]);
      // A hand card spent with its own "When you spend this card" ability (`Payment.whenSpent`): the card's resources
      // and the ability's together, since choosing this source is choosing both.
      if (spending && "fromHand" in spending && spending.whenSpent) {
        if (payable.reserved.has(spending.fromHand)) return [];
        const picks = spending.whenSpent.costChoices;
        const amounts = spending.whenSpent.costSelection;
        const use = {
          instanceId: spending.fromHand,
          abilityId: spending.whenSpent.abilityId,
          ...(amounts ? { costSelection: amounts } : {}),
        };
        return [
          {
            optionId: option.optionId,
            kind: "resourceAbility",
            instanceId: spending.fromHand,
            label: option.label,
            pool: addPools(
              handCardResources(state, deps, spending.fromHand, playerId, payable.payingFor),
              paidForMultiplied(
                state,
                deps,
                payable.payingFor,
                resourceAbilityGenerates(
                  state,
                  deps,
                  { ...use, ...(picks ? { costChoices: picks } : {}) },
                  playerId,
                  discardTop,
                  payable.payingFor,
                ),
                playerId,
              ),
            ),
            spendsHandCard: true,
            ...(picks ? { costChoices: picks } : {}),
            ...(amounts ? { costSelection: amounts } : {}),
          },
        ];
      }
      if (claimed.has(option.ref.instanceId)) return [];
      const use = paymentsFromOptionIds([option.optionId]).find((entry) => "ability" in entry);
      const costChoices = use && "ability" in use ? use.ability.costChoices : undefined;
      const costSelection = use && "ability" in use ? use.ability.costSelection : undefined;
      return [
        {
          optionId: option.optionId,
          kind: "resourceAbility",
          instanceId: option.ref.instanceId,
          label: option.label,
          pool: paidForMultiplied(
            state,
            deps,
            payable.payingFor,
            resourceAbilityGenerates(
              state,
              deps,
              {
                instanceId: option.ref.instanceId,
                abilityId: option.ref.abilityId,
                ...(costChoices ? { costChoices } : {}),
                ...(costSelection ? { costSelection } : {}),
              },
              playerId,
              discardTop,
              payable.payingFor,
            ),
            playerId,
          ),
          ...(costChoices ? { costChoices } : {}),
          ...(costSelection ? { costSelection } : {}),
          ...(deps.abilities[option.ref.abilityId]?.overpayOnly ? { overpayOnly: true as const } : {}),
        },
      ];
    },
  );
  let suggested: readonly string[] = [];
  const spend = spendOrder(state, deps, playerId, payable.reserved, payable.payingFor);
  const sized = payable.payingFor
    ? chosenSizeWallets(state, deps, playerId, spend, payable.chosenResources ?? null, payable.payingFor)
    : [];
  const usual = walletsWithWhenSpent(state, deps, playerId, payable.reserved, payable.payingFor, spend);
  for (const wallet of payable.preferred ?? [...sized, ...usual]) {
    if (!probe(state, deps, payable.build(wallet)).ok) continue;
    suggested = optionIdsOf(smallestPayment(state, deps, payable.build, wallet));
    break;
  }
  const overpayMatters =
    !payable.spendable && (sources.some((source) => source.overpayOnly) || readsOverpaid(state, deps, action));
  // A card printed with an X cost always has a pay step: the player names the X there, even when the least X costs 0.
  if (!payable.spendable && !overpayMatters && !printsX(state, action)) return null;
  const notFor = payable.payingFor
    ? resourcesNotFor(state, deps, playerId, payable.payingFor).map((use) => ({
        ...use,
        label: displayNameOf(state, use.instanceId),
      }))
    : [];
  return {
    requirement: payable.requirement,
    sources,
    suggested,
    ...(notFor.length > 0 ? { notForThisCard: notFor } : {}),
    ...(overpayMatters ? { overpayMatters: true as const } : {}),
    ...(payable.chosenResources ? { chosenResources: payable.chosenResources } : {}),
  };
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

/** The cost a play of `id` pays besides its resource cost: its additional cost to play and its event Action's cost. */
function playCostAsQueried(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  id: InstanceId,
  abilityId: AbilityId | undefined,
): AbilityCost | undefined {
  const card = cardOf(state, id);
  const query = card ? eventActionForQuery(createCtx(state, deps), card, id, playerId, abilityId) : null;
  return costAsDetermined(
    state,
    deps,
    id,
    playerId,
    playCostWith(state, deps, id, playerId, query?.action?.definition.cost),
  );
}

/** Whether `helperId` can pay one delegable part of a cost for another player, and the engine's reason when not. */
export type CostHelpAnswer =
  | { readonly part: DelegableCostPart; readonly ok: true }
  | {
      readonly part: DelegableCostPart;
      readonly ok: false;
      readonly reason: EngineErrorCode;
      readonly message: string;
    };

/**
 * "Why can't I help pay that?", asked for the helper: for each delegable part (`DelegableCostPart`) of the cost of
 * `playerId`'s ability `action`, whether `helperId` could pay it in their place right now (`CostSelection.paidBy`),
 * with the engine's own reason when they cannot: no rule lets another player pay ("only the player using this ability
 * can pay its costs"), or the part cannot be taken from them (their identity holds a tough status card, their deck is
 * short). Each part is judged alone, so the answer does not depend on what else the user can or cannot pay. Empty for a
 * cost with no such part, and for anything but a `useAbility` or a `playCard` (the cost of playing the card with the
 * event Action `options.abilityId` names, else its first; an alliance card's is the one a helper may pay, RRG 1.8
 * "Alliance", p. 6, owner answer 48B). The parts that name the user's own card are never listed: no player can take
 * those over (RRG 1.8 "Cost", p. 14; owner answer 21B).
 */
export function costHelpFor(
  state: GameState,
  playerId: PlayerId,
  action: ActionRef,
  helperId: PlayerId,
  options: Pick<PaymentContext, "costSelection" | "abilityId"> = {},
  deps: EngineDeps = DEFAULT_DEPS,
): readonly CostHelpAnswer[] {
  if (!getPlayer(state, playerId)) return [];
  if (action.kind !== "useAbility" && action.kind !== "playCard") return [];
  const { instanceId } = action;
  const cost =
    action.kind === "useAbility"
      ? costAsDetermined(state, deps, instanceId, playerId, deps.abilities[action.abilityId]?.cost)
      : playCostAsQueried(state, deps, playerId, instanceId, options.abilityId);
  return delegableParts(cost, options.costSelection?.branch).map((part): CostHelpAnswer => {
    const paid = { ...cost, ...cost?.either?.[options.costSelection?.branch ?? -1] };
    const { branch: _branch, ...amounts } = options.costSelection ?? {};
    const selection: CostSelection = { ...amounts, paidBy: { [part]: helperId } };
    const plan = planCost(state, deps, instanceId, playerId, { [part]: paid[part] }, {}, NO_RESERVED, selection);
    return "requirement" in plan ? { part, ok: true } : { part, ok: false, reason: plan.code, message: plan.message };
  });
}
