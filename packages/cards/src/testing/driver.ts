import type { AnyCard } from "@mc/content";
import {
  applyCommand,
  canAttack,
  cardOf,
  cardsInPlay,
  characterProfile,
  controllerOf,
  getInstance,
  getPlayer,
  mainSchemeStage,
  printedResources,
  scale,
  schemesInPlay,
  sessionApply,
  startSession,
  type AbilityDefinition,
  type Command,
  type EngineDeps,
  type GameOutcome,
  type GameSession,
  type GameState,
  type InstanceId,
  type Payment,
  type PendingChoice,
  type PlayerId,
  isVillain,
} from "@mc/engine";

/**
 * A deterministic, greedy headless player for end-to-end tests. It knows no
 * card names: on its turn it tries, in order, to recover or change form, play
 * cards from hand (paying with the fewest other cards), use action abilities,
 * make basic thwarts/attacks with its hero and allies, and end its turn. Every
 * candidate command is probed with the pure `applyCommand`; the first legal one
 * is committed through `sessionApply`, so the session log replays exactly.
 * Choices are answered with simple rules (defend with an ally, take optional
 * triggers, pay when it can) and otherwise the first legal option.
 */

export interface DriverOptions {
  readonly maxCommands?: number;
  /** Commands one player may issue in one turn before the driver ends it. */
  readonly maxCommandsPerTurn?: number;
}

export interface DriverResult {
  readonly session: GameSession;
  readonly outcome: GameOutcome | null;
  readonly rounds: number;
  readonly commands: number;
}

export function playToOutcome(initial: GameState, deps: EngineDeps, options: DriverOptions = {}): DriverResult {
  const maxCommands = options.maxCommands ?? 20_000;
  const memory: TurnMemory = { key: "", used: new Set(), commands: 0, maxPerTurn: options.maxCommandsPerTurn ?? 60 };
  let session = startSession(initial);
  let commands = 0;
  while (!session.state.outcome && commands < maxCommands) {
    const command = nextCommand(session.state, deps, memory);
    const result = sessionApply(session, command, deps);
    if (!result.ok) throw new Error(`driver issued an illegal ${command.type}: ${result.error.code}: ${result.error.message}`);
    session = result.session;
    commands++;
  }
  return { session, outcome: session.state.outcome, rounds: session.state.round, commands };
}

interface TurnMemory {
  key: string;
  used: Set<string>;
  commands: number;
  readonly maxPerTurn: number;
}

function nextCommand(state: GameState, deps: EngineDeps, memory: TurnMemory): Command {
  const choice = state.pendingChoice;
  if (choice) return { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: answerChoice(state, choice) };
  if (state.step.phase !== "player" || state.step.kind !== "turn") {
    throw new Error(`no choice pending and not a player turn (${state.step.phase}/${state.step.kind})`);
  }
  const playerId = state.step.activePlayerId;
  const key = `${state.round}:${playerId}`;
  if (memory.key !== key) {
    memory.key = key;
    memory.used = new Set();
    memory.commands = 0;
  }
  memory.commands++;
  const endTurn: Command = { type: "endTurn", playerId };
  if (memory.commands > memory.maxPerTurn) return endTurn;
  for (const candidate of turnCandidates(state, deps, playerId, memory)) {
    if (applyCommand(state, candidate.command, deps).ok) {
      if (candidate.memo) memory.used.add(candidate.memo);
      return candidate.command;
    }
  }
  return endTurn;
}

interface Candidate {
  readonly command: Command;
  /** Remembered once committed, so the same ability isn't retried this turn. */
  readonly memo?: string;
}

const card = (state: GameState, id: InstanceId): AnyCard | undefined => cardOf(state, id);
const resourceValue = (state: GameState, id: InstanceId): number => {
  const c = card(state, id);
  if (!c) return 0;
  const pool = printedResources(c);
  return pool.physical + pool.mental + pool.energy + pool.wild;
};

/** The ability slots live on a card right now (the active identity face; every other card's printed slots). */
function liveRefs(state: GameState, id: InstanceId): readonly string[] {
  const c = card(state, id);
  if (!c) return [];
  if (c.type === "hero_identity") {
    const player = state.players.find((p) => p.identity.instanceId === id);
    return (player?.identity.form === "hero" ? c.hero.abilities : c.alterEgo.abilities).map((r) => r.id);
  }
  if (c.type === "villain" || c.type === "main_scheme") return [];
  return "abilities" in c ? c.abilities.map((r) => r.id) : [];
}

function* turnCandidates(state: GameState, deps: EngineDeps, playerId: PlayerId, memory: TurnMemory): Generator<Candidate> {
  const player = getPlayer(state, playerId);
  if (!player) return;
  const identityId = player.identity.instanceId;
  const identity = getInstance(state, identityId);
  const profile = characterProfile(state, identityId, deps);
  if (!identity || !profile) return;
  const hpLeft = profile.maxHp - identity.damage;
  const form = player.identity.form;

  // 1. Form and recovery: heal up in alter-ego, otherwise go hero to act.
  if (form === "alterEgo") {
    if (!identity.exhausted && identity.damage > 0 && hpLeft * 2 <= profile.maxHp) yield { command: { type: "basicRecover", playerId } };
    if (!player.identity.changedFormThisRound && hpLeft * 2 > profile.maxHp) yield { command: { type: "changeForm", playerId } };
  }

  // 2. Play cards from hand, paying with the fewest other cards.
  for (const id of player.hand) {
    const c = card(state, id);
    if (!c || c.type === "resource" || !("cost" in c)) continue;
    const action = actionAbility(deps, c);
    if (c.type === "event" && !action) continue; // interrupt/response events are played from windows
    for (const payment of payments(state, deps, playerId, id, c.cost)) {
      for (const extra of playExtras(state, deps, playerId, id, c, action, payment)) {
        yield { command: { type: "playCard", playerId, cardInstanceId: id, payment, attachToInstanceId: extra.attachTo, ...(extra.costChoices ? { costChoices: extra.costChoices } : {}) } };
      }
    }
  }

  // 3. Action abilities on cards in play (yours, and encounter cards with "Hero Action" text).
  for (const id of cardsInPlay(state)) {
    const controller = controllerOf(state, id);
    if (controller !== null && controller !== playerId) continue;
    for (const ability of liveRefs(state, id)) {
      const definition = deps.abilities[ability];
      if (definition?.trigger.kind !== "action") continue;
      const memo = `${id}:${ability}`;
      if (memory.used.has(memo)) continue;
      const choices = definition.cost?.discardFromHand ? { discard: player.hand.slice(0, definition.cost.discardFromHand.min) } : undefined;
      for (const payment of payments(state, deps, playerId, null, 0, definition)) {
        yield { memo, command: { type: "useAbility", playerId, cardInstanceId: id, abilityId: ability as never, payment, ...(choices ? { costChoices: choices } : {}) } };
      }
    }
  }

  // 4. Basic thwart/attack with your identity and then your allies.
  const stage = mainSchemeStage(state);
  const target = scale(stage.targetThreat, state.startingPlayerCount);
  const mainThreat = getInstance(state, state.mainScheme.instanceId)?.threat ?? 0;
  const sideSchemes = schemesInPlay(state).filter((id) => id !== state.mainScheme.instanceId && (getInstance(state, id)?.threat ?? 0) > 0);
  const thwartFirst = mainThreat * 2 >= target || sideSchemes.length > 0;
  const thwartTarget = mainThreat * 2 >= target || sideSchemes.length === 0 ? state.mainScheme.instanceId : (sideSchemes[0] as InstanceId);
  const enemies = cardsInPlay(state).filter((id) => {
    const c = card(state, id);
    return isVillain(state, id) || c?.type === "minion" || getInstance(state, id)?.facedownAs;
  });
  const attackers = [identityId, ...player.playArea.filter((id) => card(state, id)?.type === "ally")];
  for (const attacker of attackers) {
    const ready = !getInstance(state, attacker)?.exhausted;
    if (!ready || (attacker === identityId && form !== "hero")) continue;
    const thwart: Candidate = { command: { type: "basicThwart", playerId, thwarterInstanceId: attacker, schemeInstanceId: thwartTarget } };
    const attacks: Candidate[] = enemies
      .filter((enemy) => canAttack(state, attacker, enemy, deps))
      .map((enemy) => ({ command: { type: "basicAttack", playerId, attackerInstanceId: attacker, targetInstanceId: enemy } }));
    if (thwartFirst) {
      yield thwart;
      yield* attacks;
    } else {
      yield* attacks;
      yield thwart;
    }
  }

  // 5. A badly hurt hero flips to alter-ego (after acting) to recover next turn.
  if (form === "hero" && !player.identity.changedFormThisRound && hpLeft <= 4) yield { command: { type: "changeForm", playerId } };
}

function actionAbility(deps: EngineDeps, c: AnyCard): AbilityDefinition | undefined {
  if (!("abilities" in c)) return undefined;
  for (const ref of c.abilities) {
    const definition = deps.abilities[ref.id];
    if (definition?.trigger.kind === "action") return definition;
  }
  return undefined;
}

/**
 * Candidate payments, cheapest first: resource abilities in play, then the
 * smallest runs of hand cards (resource cards first) that could cover the
 * printed cost plus any fixed resource cost of the ability.
 */
function* payments(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  playing: InstanceId | null,
  printedCost: number,
  ability?: AbilityDefinition,
): Generator<readonly Payment[]> {
  const player = getPlayer(state, playerId);
  if (!player) return;
  const fixed = ability?.cost?.resources;
  const needed = printedCost + (typeof fixed === "number" ? fixed : fixed ? Object.values(fixed).reduce((a, b) => a + (b ?? 0), 0) : 0);
  const extra = ability?.cost?.resourcesX ? 1 : 0;
  const abilityPayments: Payment[] = [];
  for (const id of cardsInPlay(state)) {
    if (controllerOf(state, id) !== playerId) continue;
    for (const ref of liveRefs(state, id)) {
      if (deps.abilities[ref]?.trigger.kind === "resource") abilityPayments.push({ ability: { instanceId: id, abilityId: ref as never } });
    }
  }
  const hand = player.hand.filter((id) => id !== playing);
  const byValue = [...hand].sort((a, b) => Number(card(state, b)?.type === "resource") - Number(card(state, a)?.type === "resource"));
  const total = needed + extra;
  if (total === 0) {
    yield [];
    return;
  }
  const tried = new Set<string>();
  const offer = (payment: readonly Payment[]) => {
    const key = JSON.stringify(payment);
    if (tried.has(key)) return false;
    tried.add(key);
    return true;
  };
  for (const order of [byValue, hand]) {
    let sum = 0;
    const picks: Payment[] = [];
    for (const id of order) {
      picks.push({ fromHand: id });
      sum += resourceValue(state, id);
      if (sum >= total) break;
    }
    if (sum >= total && offer(picks)) yield picks;
    if (sum >= total && picks.length < order.length) {
      const one = [...picks, { fromHand: order[picks.length] as InstanceId }];
      if (offer(one)) yield one;
    }
  }
  for (const ability of abilityPayments) {
    let sum = 1;
    const picks: Payment[] = [ability];
    for (const id of byValue) {
      if (sum >= total) break;
      picks.push({ fromHand: id });
      sum += resourceValue(state, id);
    }
    if (sum >= total && offer(picks)) yield picks;
  }
}

/** Hosts and cost choices for a play: upgrade hosts, "discard N cards", "pay the printed cost of an ally in a discard pile". */
function* playExtras(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  id: InstanceId,
  c: AnyCard,
  action: AbilityDefinition | undefined,
  payment: readonly Payment[],
): Generator<{ readonly attachTo: InstanceId | null; readonly costChoices?: Record<string, readonly InstanceId[]> }> {
  const reserved = new Set(payment.flatMap((p) => ("fromHand" in p ? [p.fromHand] : [])));
  const player = getPlayer(state, playerId);
  const spare = (player?.hand ?? []).filter((h) => h !== id && !reserved.has(h));
  const costChoices: Record<string, readonly InstanceId[]> = {};
  if (action?.cost?.discardFromHand) {
    const n = Math.max(action.cost.discardFromHand.min, Math.min(action.cost.discardFromHand.max, spare.length, 2));
    if (spare.length < n) return;
    costChoices.discard = spare.slice(0, n);
  }
  const pay = action?.cost?.payPrintedCostOf;
  const pickSlots = pay
    ? state.players.flatMap((p) => p.discard.filter((d) => card(state, d)?.type === "ally")).map((d) => ({ ...costChoices, [pay.slot]: [d] }))
    : [costChoices];
  const hosts: (InstanceId | null)[] = c.type === "upgrade" && c.attachesTo ? cardsInPlay(state).filter((h) => getInstance(state, h)?.faceup !== undefined) : [null];
  for (const choices of pickSlots) {
    for (const host of hosts) yield Object.keys(choices).length > 0 ? { attachTo: host, costChoices: choices } : { attachTo: host };
  }
  void deps;
}

// ---------------------------------------------------------------------------
// Choices
// ---------------------------------------------------------------------------

function answerChoice(state: GameState, choice: PendingChoice): readonly string[] {
  const ids = choice.options.map((o) => o.optionId);
  const fewest = ids.slice(0, choice.minSelections);
  switch (choice.prompt.kind) {
    case "mulligan":
      return [];
    case "declareDefender": {
      const allies = ids.filter((id) => id !== "decline" && card(state, id as InstanceId)?.type === "ally");
      if (allies[0]) return [allies[0]];
      // No ally: the attacked hero defends (DEF soaks damage, but it exhausts) only when badly hurt.
      const attacked = choice.prompt.attack.targetCharacterInstanceId;
      const identity = getInstance(state, attacked);
      const profile = characterProfile(state, attacked);
      const hurt = identity && profile ? profile.maxHp - identity.damage <= 6 : false;
      if (hurt && ids.includes(attacked)) return [attacked];
      return ids.includes("decline") ? ["decline"] : fewest;
    }
    case "chooseTriggers":
    case "orderTriggers":
    case "orderSpecials":
      // Take every optional trigger, in the offered order.
      return ids.slice(0, Math.max(choice.minSelections, choice.maxSelections));
    case "payForCard":
    case "payForAbility":
      return payFromOptions(state, choice, choice.prompt.cost, null);
    case "spendResources": {
      const r = choice.prompt.requirement;
      return payFromOptions(state, choice, (r.generic ?? 0) + (r.physical ?? 0) + (r.mental ?? 0) + (r.energy ?? 0), r);
    }
    case "discardDownToHandSize":
    case "discardOverAllyLimit":
    case "discardRestricted":
      return fewest;
    default:
      // Targets, options, players, cards, attachment hosts, minion order: the first legal option(s).
      return ids.slice(0, Math.min(Math.max(choice.minSelections, 1), choice.maxSelections));
  }
}

/** Picks payment options worth at least `cost`, typed cards first for a typed requirement; declines if it can't. */
function payFromOptions(
  state: GameState,
  choice: PendingChoice,
  cost: number,
  typed: { readonly physical?: number; readonly mental?: number; readonly energy?: number } | null,
): readonly string[] {
  if (cost <= 0) return [];
  const value = (optionId: string): number => {
    if (optionId.startsWith("ability:")) return 1;
    return resourceValue(state, optionId.slice("hand:".length) as InstanceId);
  };
  const matchesType = (optionId: string): boolean => {
    if (!typed || optionId.startsWith("ability:")) return optionId.startsWith("ability:");
    const c = card(state, optionId.slice("hand:".length) as InstanceId);
    if (!c) return false;
    const pool = printedResources(c);
    return pool.wild > 0 || (["physical", "mental", "energy"] as const).some((t) => (typed[t] ?? 0) > 0 && pool[t] > 0);
  };
  const ordered = [...choice.options.map((o) => o.optionId)].sort((a, b) => Number(matchesType(b)) - Number(matchesType(a)));
  const picks: string[] = [];
  let sum = 0;
  for (const optionId of ordered) {
    if (sum >= cost) break;
    picks.push(optionId);
    sum += value(optionId);
  }
  return sum >= cost ? picks : [];
}
