/**
 * QA solo driver: a small heuristic player meant to win full solo games, as opposed to the greedy end-to-end driver
 * (`../testing/driver.ts`, which cannot win the wave 7 scenarios).
 *
 * Interface
 * - `soloNextCommand(state, deps, memory)`: the next command for the seat to act. Reads `legalActions` (so every turn
 *   command is one the engine accepts, with the engine's own payment and target examples) and, for a pending choice,
 *   answers only with the offered option ids. It never edits state.
 * - `playSolo(initial, deps, options)`: loops it through `sessionApply` until an outcome or the command cap; throws on
 *   an engine refusal (a driver command is always legal, so a refusal is a finding). `onCommand` sees every step.
 *
 * Heuristics (policy only, no rules): resource generators, allies and upgrades first; the main scheme is thwarted
 * when the next villain phase could complete it, side schemes with crisis or hazard icons next, otherwise attack,
 * preferring a minion the attacker kills; a ready hero defends, an ally that survives chump-blocks, a hurt hero takes
 * an ally's hit; Hope Summers and Morlocks never defend and are the last picks for damage; a hurt hero flips to
 * alter-ego and recovers; discards and costs pay with the least valuable card; "any number" prompts take the minimum.
 *
 * Options: `style` ("rules", the default, or "lookahead", which ranks commands by a simulated board value and measured
 * weaker) and `explore` (0 = the fixed policy; n > 0 adds a deterministic jitter to every command's score, so one game
 * seed gives many different games, each reproducible from (seed, style, explore)).
 */
import type { AnyCard } from "@mc/content";
import {
  applyCommand,
  cardOf,
  cardsInPlay,
  characterProfile,
  getInstance,
  getPlayer,
  hasKeyword,
  isMinion,
  isVillain,
  keywordTotal,
  legalActions,
  mainSchemeValue,
  playerOrder,
  printedResources,
  schemesInPlay,
  sessionApply,
  startSession,
  undefeatedVillains,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameOutcome,
  type GameSession,
  type GameState,
  type InstanceId,
  type LegalAction,
  type PendingChoice,
  type PlayerId,
} from "@mc/engine";

/** Cards the driver keeps out of harm's way: Hope Summers (Stryfe: "if Hope Summers is defeated, you lose") and her captive face. */
const PROTECTED_CODES: readonly string[] = ["40130", "40131"];

export type SoloStyle = "lookahead" | "rules";
/**
 * `hero-ready` (default): a ready hero always defends, and keeps itself ready (no basic power) when two enemy hits
 * from death; every win found was played this way. `balanced`: see `declareDefender`; the hero takes hits to keep
 * acting, an ally that survives defends for it, and it dies sooner (measured: more losses by defeat, no more wins).
 */
export type DefenseMode = "balanced" | "hero-ready";

export interface SoloMemory {
  /**
   * `rules` (default): fixed priorities by card and action type. `lookahead`: rank commands by the board value after
   * simulating them with `applyCommand`; measured weaker (0 wins in 72 X-23 / Morlock Siege games where `rules` won 2).
   */
  style: SoloStyle;
  defense: DefenseMode;
  /** 0 plays the fixed policy; any other value adds a deterministic jitter to every command's score, so one game seed can be replayed as many different games. */
  explore: number;
  total: number;
  turnKey: string;
  /** `instance:ability` pairs already used this turn (an ability is tried once per turn). */
  used: Set<string>;
  commands: number;
}

export const newSoloMemory = (
  style: SoloStyle = "rules",
  explore = 0,
  defense: DefenseMode = "hero-ready",
): SoloMemory => ({
  style,
  defense,
  explore,
  total: 0,
  turnKey: "",
  used: new Set(),
  commands: 0,
});

const MAX_COMMANDS_PER_TURN = 40;

/** A deterministic hash of three integers to [0, 1). */
function hash32(a: number, b: number, c: number): number {
  let h =
    Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^
    Math.imul(b + 0x7f4a7c15, 0xc2b2ae35) ^
    Math.imul(c + 0x165667b1, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

const cardAt = (state: GameState, id: InstanceId): AnyCard | undefined => cardOf(state, id);
const codeOf = (state: GameState, id: InstanceId): string => String(state.instances[id]?.cardId ?? "");
const isProtected = (state: GameState, id: InstanceId): boolean => PROTECTED_CODES.includes(codeOf(state, id));
const isMorlock = (state: GameState, id: InstanceId): boolean => (cardAt(state, id)?.name ?? "") === "Morlock";
const isEnemy = (state: GameState, id: InstanceId): boolean => isVillain(state, id) || isMinion(state, id);
const hpLeft = (state: GameState, id: InstanceId): number => {
  const profile = characterProfile(state, id);
  const instance = getInstance(state, id);
  return profile && instance ? profile.maxHp - instance.damage : 0;
};

/** A rough worth of a card in hand, for "least valuable" decisions (higher is worth more). */
function valueOf(state: GameState, id: InstanceId): number {
  const card = cardAt(state, id);
  if (!card) return 0;
  const pool = printedResources(card);
  const resources = pool.physical + pool.mental + pool.energy + pool.wild;
  const cost = "cost" in card ? Number(card.cost ?? 0) : 0;
  const byType: Record<string, number> = { ally: 6, support: 4, upgrade: 4, event: 3, resource: 1 };
  return (byType[card.type] ?? 2) + Math.min(cost, 4) * 0.3 + resources * 0.8;
}

const resourceTotal = (state: GameState, id: InstanceId): number => {
  const card = cardAt(state, id);
  if (!card) return 0;
  const pool = printedResources(card);
  return pool.physical + pool.mental + pool.energy + pool.wild;
};

// ---------------------------------------------------------------------------------------------------------------
// Threat management
// ---------------------------------------------------------------------------------------------------------------

/** Threat the main scheme could hold after the next villain phase, and the threat that completes it. */
function threatOutlook(
  state: GameState,
  deps: EngineDeps,
  seat: PlayerId,
): { threat: number; target: number; projected: number } {
  const main = getInstance(state, state.mainScheme.instanceId);
  const threat = main?.threat ?? 0;
  const target = mainSchemeValue(state, "targetThreat", deps);
  let add = mainSchemeValue(state, "acceleration", deps);
  // Assume the worst: every villain and every minion engaged with the seat schemes (a hero-form seat is attacked
  // instead, but a card (Hope's Captor) or a form change can turn it into a scheme, and the margin is cheap).
  for (const villain of undefeatedVillains(state)) add += characterProfile(state, villain.instanceId, deps)?.sch ?? 0;
  for (const id of Object.keys(state.instances) as InstanceId[]) {
    if (isMinion(state, id) && state.instances[id]?.engagedWith === seat)
      add += characterProfile(state, id, deps)?.sch ?? 0;
  }
  // Side-scheme crisis and hazard icons add to the villain phase; one encounter card of margin.
  add += 1;
  return { threat, target, projected: threat + add };
}

// ---------------------------------------------------------------------------------------------------------------
// One-step lookahead: simulate a command with the engine's pure `applyCommand`, answer the choices it opens with the
// driver's own choice rules, and compare a rough board value before and after.
// ---------------------------------------------------------------------------------------------------------------

/** The state after `command` and every prompt it opens (up to a few) are answered; null when the engine refuses. */
function settleAfter(state: GameState, deps: EngineDeps, command: Command, defense: DefenseMode): GameState | null {
  let result = applyCommand(state, command, deps);
  if (!result.ok) return null;
  let current = result.state;
  for (let steps = 0; current.pendingChoice && !current.outcome && steps < 10; steps++) {
    const choice = current.pendingChoice;
    result = applyCommand(
      current,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: answerChoice(current, deps, choice, defense),
      },
      deps,
    );
    if (!result.ok) return current;
    current = result.state;
  }
  return current;
}

/** A rough value of the board for the players (higher is better); only differences between states matter. */
function boardValue(state: GameState, deps: EngineDeps): number {
  if (state.outcome) return state.outcome.result === "win" ? 10_000 : -10_000;
  let value = 0;
  const main = getInstance(state, state.mainScheme.instanceId);
  const target = Math.max(1, mainSchemeValue(state, "targetThreat", deps));
  const threat = main?.threat ?? 0;
  value -= threat * (1 + 2 * Math.max(0, threat / target - 0.3));
  value += state.mainScheme.stageIndex * 15;
  for (const villain of state.villains) {
    if (villain.defeated) {
      value += 40;
      continue;
    }
    const left = hpLeft(state, villain.instanceId);
    value -= left;
    value += villain.stageIndex * 14;
    const statuses = state.instances[villain.instanceId]?.statuses;
    value += 2 * ((statuses?.stunned ?? 0) + (statuses?.confused ?? 0));
  }
  for (const id of schemesInPlay(state)) {
    if (id === state.mainScheme.instanceId) continue;
    value -= 1.3 * (getInstance(state, id)?.threat ?? 0) + 1;
  }
  const inPlay = new Set(cardsInPlay(state));
  for (const id of Object.keys(state.instances) as InstanceId[]) {
    if (inPlay.has(id) && isMinion(state, id)) {
      value -= 0.8 * hpLeft(state, id) + 2;
      const statuses = state.instances[id]?.statuses;
      value += 2 * ((statuses?.stunned ?? 0) + (statuses?.confused ?? 0));
    }
  }
  for (const player of state.players) {
    if (player.eliminated) continue;
    const identityId = player.identity.instanceId;
    const left = hpLeft(state, identityId);
    const max = characterProfile(state, identityId, deps)?.maxHp ?? left;
    value -= 1.3 * (max - left) + (left <= 5 ? 6 : 0);
    value += 2 * (state.instances[identityId]?.statuses?.tough ?? 0);
    value += 0.5 * Math.min(player.hand.length, 5);
    for (const id of player.playArea) {
      const card = cardAt(state, id);
      if (!card) continue;
      if (isProtected(state, id)) value += 25;
      if (card.type === "ally") {
        const profile = characterProfile(state, id, deps);
        value += 4 + 0.5 * hpLeft(state, id) + 0.8 * ((profile?.atk ?? 0) + (profile?.thw ?? 0));
      } else if (card.type === "support" || card.type === "upgrade") {
        const generates = ("abilities" in card ? card.abilities : []).some(
          (a) => deps.abilities[a.id]?.trigger.kind === "resource",
        );
        value += generates ? 4 : 2.5;
      }
    }
  }
  return value;
}

// ---------------------------------------------------------------------------------------------------------------
// Turn
// ---------------------------------------------------------------------------------------------------------------

interface Scored {
  readonly score: number;
  readonly command: Command;
  readonly memo?: string;
}

/** The next command for whichever seat the game is waiting on. */
export function soloNextCommand(state: GameState, deps: EngineDeps, memory: SoloMemory): Command {
  const choice = state.pendingChoice;
  if (choice) {
    return {
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: answerChoice(state, deps, choice, memory.defense),
    };
  }
  if (state.step.phase !== "player" || state.step.kind !== "turn")
    throw new Error(`soloNextCommand: nothing pending and not a player turn (${state.step.phase}/${state.step.kind})`);
  const seat = state.step.activePlayerId;
  const key = `${state.round}:${seat}`;
  if (memory.turnKey !== key) Object.assign(memory, { turnKey: key, used: new Set<string>(), commands: 0 });
  memory.commands++;
  const endTurn: Command = { type: "endTurn", playerId: seat };
  if (memory.commands > MAX_COMMANDS_PER_TURN) return endTurn;
  const legal = legalActions(state, seat, deps);
  if (legal.kind !== "turn") return endTurn;
  let best: Scored = { score: 0.3, command: endTurn };
  const base = boardValue(state, deps);
  // The jitter is a hash of (explore, command number, candidate number): the same inputs always give the same game.
  const amplitude = memory.style === "rules" ? 30 : 5;
  memory.total++;
  let candidate = 0;
  for (const action of legal.legal) {
    for (const option of scoreAction(state, deps, seat, action, memory, base)) {
      const jitter = memory.explore === 0 ? 0 : (hash32(memory.explore, memory.total, ++candidate) - 0.5) * amplitude;
      if (option.score + jitter > best.score) best = { ...option, score: option.score + jitter };
    }
  }
  if (best.memo) memory.used.add(best.memo);
  return best.command;
}

interface RulesContext {
  readonly urgent: boolean;
  readonly outlook: { threat: number; target: number; projected: number };
}

/** The `rules` style: fixed priorities (resource generators, allies, supports, upgrades, events; thwart when urgent; attack a minion it kills). */
function rulesScore(
  state: GameState,
  deps: EngineDeps,
  seat: PlayerId,
  action: LegalAction,
  memory: SoloMemory,
  ctx: RulesContext,
): Scored[] {
  const { urgent, outlook } = ctx;
  const player = getPlayer(state, seat)!;
  const identityId = player.identity.instanceId;
  const ref = action.action;
  // `hero-ready` defense: keep the hero ready to defend when two enemy hits from death (unless the scheme is about to complete).
  const reserve =
    memory.defense === "hero-ready" &&
    player.identity.form === "hero" &&
    !urgent &&
    hpLeft(state, identityId) <= worstEnemyAttack(state, deps, seat) * 2 + 2;
  if (ref.kind === "playCard") {
    const card = cardAt(state, ref.instanceId);
    if (!card) return [];
    const example = action.example;
    const paid = example.type === "playCard" ? example.payment.length : 0;
    const generates = ("abilities" in card ? card.abilities : []).some(
      (a) => deps.abilities[a.id]?.trigger.kind === "resource",
    );
    let score = 0;
    if (generates) score = 95;
    else if (card.type === "ally") score = 90;
    else if (card.type === "support") score = 85;
    else if (card.type === "upgrade") score = 80;
    else if (card.type === "event") score = paid <= 2 ? 60 : 0;
    if (paid >= 3 && (getPlayer(state, seat)?.hand.length ?? 0) <= 4) score = Math.min(score, 20);
    return score > 0 ? [{ score, command: example }] : [];
  }
  if (ref.kind === "useAbility") {
    const memo = `${ref.instanceId}:${ref.abilityId}`;
    if (memory.used.has(memo) || deps.abilities[ref.abilityId]?.trigger.kind !== "action") return [];
    return [{ score: 65, command: action.example, memo }];
  }
  if (ref.kind === "basicThwart") {
    if (ref.instanceId === identityId && reserve) return [];
    const thw = characterProfile(state, ref.instanceId, deps)?.thw ?? 1;
    const out: Scored[] = [];
    for (const target of action.targets) {
      const threat = getInstance(state, target)?.threat ?? 0;
      if (threat <= 0) continue;
      const card = cardAt(state, target);
      const crisis = /crisis|hazard/.test(card && "icons" in card ? JSON.stringify(card.icons ?? {}) : "");
      let score: number;
      if (target === state.mainScheme.instanceId)
        score = urgent ? 120 : outlook.threat * 2 >= outlook.target ? 58 : outlook.threat > 0 ? 30 : 0;
      else score = crisis ? 110 : threat <= thw ? 55 : 35;
      if (score > 0)
        out.push({
          score,
          command: {
            type: "basicThwart",
            playerId: seat,
            thwarterInstanceId: ref.instanceId,
            schemeInstanceId: target,
          },
        });
    }
    return out;
  }
  if (ref.kind !== "basicAttack") return [];
  const attacker = ref.instanceId;
  if (attacker === identityId && reserve) return [];
  const atk = characterProfile(state, attacker, deps)?.atk ?? 1;
  const attackerLeft = hpLeft(state, attacker);
  const out: Scored[] = [];
  for (const target of action.targets) {
    if (keywordTotal(state, target, "retaliate", deps) >= attackerLeft - (attacker === identityId ? 2 : 0)) continue;
    const kills = hpLeft(state, target) <= atk && !isVillain(state, target);
    const patrol = hasKeyword(state, target, "patrol", deps) && outlook.threat > 0;
    out.push({
      score: (kills ? 75 : isVillain(state, target) ? 50 : 45) + (patrol ? (urgent ? 60 : 12) : 0),
      command: { type: "basicAttack", playerId: seat, attackerInstanceId: attacker, targetInstanceId: target },
    });
  }
  return out;
}

function scoreAction(
  state: GameState,
  deps: EngineDeps,
  seat: PlayerId,
  action: LegalAction,
  memory: SoloMemory,
  base: number,
): Scored[] {
  const player = getPlayer(state, seat);
  if (!player) return [];
  const identityId = player.identity.instanceId;
  const identity = getInstance(state, identityId);
  const profile = characterProfile(state, identityId, deps);
  if (!identity || !profile) return [];
  const left = profile.maxHp - identity.damage;
  const hurt = left * 2 <= profile.maxHp || left <= 5;
  const hero = player.identity.form === "hero";
  const ref = action.action;
  const outlook = threatOutlook(state, deps, seat);
  const urgent = outlook.projected >= outlook.target;
  /** The value a command adds to the board once its prompts are answered; null when it cannot be simulated. */
  const gain = (command: Command): number | null => {
    const after = settleAfter(state, deps, command, memory.defense);
    return after ? boardValue(after, deps) - base : null;
  };
  if (memory.style === "rules" && ["playCard", "useAbility", "basicThwart", "basicAttack"].includes(ref.kind))
    return rulesScore(state, deps, seat, action, memory, { urgent, outlook });
  switch (ref.kind) {
    case "endTurn":
      return [];
    case "changeForm": {
      if (!hero) {
        // Go hero unless hurt enough that recovering is the better turn.
        return hurt && !identity.exhausted ? [] : [{ score: 200, command: action.example }];
      }
      return hurt && !player.identity.changedFormThisRound ? [{ score: 5, command: action.example }] : [];
    }
    case "basicRecover":
      return hurt && identity.damage > 0 ? [{ score: 150, command: action.example }] : [];
    case "playCard": {
      const card = cardAt(state, ref.instanceId);
      if (!card || card.type === "player_side_scheme") return [];
      const value = gain(action.example);
      if (value === null) return [];
      const generates = ("abilities" in card ? card.abilities : []).some(
        (a) => deps.abilities[a.id]?.trigger.kind === "resource",
      );
      // Paying with cards costs hand cards (counted by the board value), and the played card itself leaves the hand.
      return [{ score: value + (generates ? 3 : 0) + 0.5, command: action.example }];
    }
    case "useAbility": {
      const memo = `${ref.instanceId}:${ref.abilityId}`;
      if (memory.used.has(memo)) return [];
      if (deps.abilities[ref.abilityId]?.trigger.kind !== "action") return [];
      const value = gain(action.example);
      return value === null ? [] : [{ score: value + 0.5, command: action.example, memo }];
    }
    case "basicThwart": {
      const out: Scored[] = [];
      const thwarter = ref.instanceId;
      for (const target of action.targets) {
        if ((getInstance(state, target)?.threat ?? 0) <= 0) continue;
        const command: Command = {
          type: "basicThwart",
          playerId: seat,
          thwarterInstanceId: thwarter,
          schemeInstanceId: target,
        };
        const value = gain(command);
        // Thwarting costs the hero nothing but its exhaustion; the board gain decides which scheme.
        if (value !== null)
          out.push({ score: value + 1 + (urgent && target === state.mainScheme.instanceId ? 40 : 0), command });
      }
      return out;
    }
    case "basicAttack": {
      const attacker = ref.instanceId;
      const attackerLeft = hpLeft(state, attacker);
      const out: Scored[] = [];
      for (const target of action.targets) {
        const retaliate = keywordTotal(state, target, "retaliate", deps);
        if (retaliate >= attackerLeft - (attacker === identityId ? 2 : 0)) continue;
        const command: Command = {
          type: "basicAttack",
          playerId: seat,
          attackerInstanceId: attacker,
          targetInstanceId: target,
        };
        const value = gain(command);
        // A patrol minion blocks thwarting the main scheme, so it dies first when the scheme is the danger.
        const patrol = hasKeyword(state, target, "patrol", deps) && outlook.threat > 0;
        if (value !== null) out.push({ score: value + 1 + (patrol ? (urgent ? 40 : 6) : 0), command });
      }
      return out;
    }
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Choices
// ---------------------------------------------------------------------------------------------------------------

function answerChoice(
  state: GameState,
  deps: EngineDeps,
  choice: PendingChoice,
  defense: DefenseMode,
): readonly string[] {
  const options = choice.options;
  const ids = options.map((o) => o.optionId);
  const min = choice.minSelections;
  const max = choice.maxSelections;
  const cardOfOption = (optionId: string): InstanceId | null => {
    const option = options.find((o) => o.optionId === optionId);
    return option?.ref.kind === "card" ? option.ref.instanceId : null;
  };
  const take = (ordered: readonly string[], n = Math.min(Math.max(min, 1), max)): readonly string[] =>
    ordered.slice(0, n);
  const prompt = choice.prompt;
  switch (prompt.kind) {
    case "mulligan":
      return [];
    case "declareDefender":
      return defense === "hero-ready"
        ? declareDefenderHeroReady(state, deps, choice, prompt.attack)
        : declareDefender(state, deps, choice, prompt.attack);
    case "chooseTriggers":
    case "orderTriggers":
    case "orderSpecials":
    case "orderEnemies":
    case "orderPlayers":
    case "orderCards":
      return ids.slice(0, Math.max(min, max));
    case "chooseMinionToActivate":
      return take(ids);
    case "payForCard":
    case "payForAbility":
      return payFromOptions(state, choice, prompt.cost, null);
    case "spendResources": {
      const r = prompt.requirement;
      const cost = (r.generic ?? 0) + (r.physical ?? 0) + (r.mental ?? 0) + (r.energy ?? 0);
      return payFromOptions(state, choice, cost, r);
    }
    case "chooseNumber":
      return [String(prompt.min)];
    case "reportFact":
      if (prompt.answer === "wholeNumber") return ["0"];
      return ids.includes("no") ? ["no"] : take(ids, 1);
    case "discardDownToHandSize":
    case "discardOverAllyLimit":
    case "discardRestricted":
    case "chooseCostCards":
      return take(byLeastValue(state, ids, cardOfOption), min);
    case "discardOverPlayerSideSchemeLimit":
      return take(ids, min);
    case "assignIndirectDamage":
      return assignDamage(state, choice, prompt.amount, true);
    case "divideEvenlyRemainder":
      return assignDamage(state, choice, prompt.amount, false);
    case "divide":
      return divide(state, choice, prompt);
    case "chooseTarget":
    case "chooseAttachmentTarget":
      return take(byTargetPreference(state, deps, ids, cardOfOption));
    case "chooseCards":
    case "lookAt": {
      const n = Math.min(Math.max(min, 0), max);
      // Cards from my hand are "discard"-like picks (least valuable); from elsewhere, take the best.
      const inHand = ids.some((id) => {
        const card = cardOfOption(id);
        return card !== null && state.players.some((p) => p.hand.includes(card));
      });
      const ordered = inHand
        ? byLeastValue(state, ids, cardOfOption)
        : [...ids].sort((a, b) => valueAt(state, cardOfOption(b)) - valueAt(state, cardOfOption(a)));
      return take(ordered, n);
    }
    default:
      return take(ids, Math.min(Math.max(min, 0), max));
  }
}

const valueAt = (state: GameState, id: InstanceId | null): number => (id ? valueOf(state, id) : 0);

const byLeastValue = (
  state: GameState,
  ids: readonly string[],
  cardOfOption: (id: string) => InstanceId | null,
): readonly string[] =>
  [...ids].sort((a, b) => {
    const ca = cardOfOption(a);
    const cb = cardOfOption(b);
    // Hope and Morlocks are the first to go when a choice makes the player lose an ally; everything else by value.
    const pa = ca && (isProtected(state, ca) ? 100 : 0);
    const pb = cb && (isProtected(state, cb) ? 100 : 0);
    return valueAt(state, ca) + (pa || 0) - (valueAt(state, cb) + (pb || 0));
  });

/** Ranks the options of a "choose a target" prompt: villain, then minions, then schemes by danger, then my own cards. */
function byTargetPreference(
  state: GameState,
  deps: EngineDeps,
  ids: readonly string[],
  cardOfOption: (id: string) => InstanceId | null,
): readonly string[] {
  const seat = (
    state.step.phase === "player" && state.step.kind === "turn" ? state.step.activePlayerId : playerOrder(state)[0]
  ) as PlayerId;
  const outlook = threatOutlook(state, deps, seat);
  const score = (optionId: string): number => {
    const id = cardOfOption(optionId);
    if (!id) return 1;
    if (isProtected(state, id)) return -10;
    if (isVillain(state, id)) return 50;
    if (isMinion(state, id)) return hpLeft(state, id) <= 2 ? 60 : 45;
    if (schemesInPlay(state).includes(id)) {
      const threat = getInstance(state, id)?.threat ?? 0;
      if (id === state.mainScheme.instanceId) return outlook.projected >= outlook.target ? 80 : 20;
      return threat > 0 ? 40 : 0;
    }
    // My own characters: the most damaged first (a heal) and never the hero's last hit points.
    return Math.min(30, state.instances[id]?.damage ?? 0);
  };
  return [...ids].sort((a, b) => score(b) - score(a));
}

/**
 * Who defends. The hero is ready for the villain phase (everything readies at the end of the player phase, RRG 1.8 "End
 * of Player Phase", p. 18) but a defender exhausts and stays exhausted through the next player turn, so a defending hero
 * gives up its next basic power. Policy: an ally that survives the hit takes it for the hero; a hurt hero defends itself
 * (its DEF reduces the damage); a healthy hero takes the hit; Hope Summers is defended by whoever can (her loss is the
 * game's loss); a Morlock is defended only when it would die and a defender survives.
 */
function declareDefender(
  state: GameState,
  deps: EngineDeps,
  choice: PendingChoice,
  attack: { readonly enemyInstanceId: InstanceId; readonly targetCharacterInstanceId: InstanceId },
): readonly string[] {
  const ids = choice.options.map((o) => o.optionId);
  const decline = ids.includes("decline") ? ["decline"] : ids.slice(0, choice.minSelections);
  const hit = (characterProfile(state, attack.enemyInstanceId, deps)?.atk ?? 1) + 1; // plus a boost's average
  const target = attack.targetCharacterInstanceId;
  const heroId = getPlayer(state, choice.playerId)?.identity.instanceId;
  const heroLeft = heroId ? hpLeft(state, heroId) : 0;
  const defenders = ids.filter(
    (id) =>
      id !== "decline" &&
      state.instances[id as InstanceId] &&
      id !== target &&
      !isProtected(state, id as InstanceId) &&
      !isMorlock(state, id as InstanceId),
  ) as InstanceId[];
  const survivors = defenders
    .filter((id) => hpLeft(state, id) > hit)
    .sort((a, b) => hpLeft(state, b) - hpLeft(state, a));
  const heroCan = heroId !== undefined && defenders.includes(heroId);
  if (isProtected(state, target)) {
    // The game is lost with her: anyone, the hero first, then the sturdiest ally.
    if (heroCan) return [heroId];
    const sturdy = [...defenders].sort((a, b) => hpLeft(state, b) - hpLeft(state, a));
    return sturdy[0] ? [sturdy[0]] : decline;
  }
  if (isMorlock(state, target)) {
    if (hpLeft(state, target) > hit) return decline;
    const ally = survivors.find((id) => id !== heroId);
    if (ally) return [ally];
    return heroCan && heroLeft > hit + 3 ? [heroId] : decline;
  }
  if (target !== heroId) return decline;
  const ally = survivors.find((id) => id !== heroId);
  if (ally && hit >= 2) return [ally];
  if (heroCan && heroLeft <= hit + 3) return [heroId];
  if (heroLeft <= hit + 3) {
    const cheap = defenders.filter((id) => id !== heroId).sort((a, b) => valueAt(state, a) - valueAt(state, b));
    if (cheap[0]) return [cheap[0]];
  }
  return decline;
}

/** `hero-ready` defense (the first version): a ready hero defends for free; otherwise an ally that survives; a hurt hero's last resort is a cheap ally. */
function declareDefenderHeroReady(
  state: GameState,
  deps: EngineDeps,
  choice: PendingChoice,
  attack: { readonly enemyInstanceId: InstanceId; readonly targetCharacterInstanceId: InstanceId },
): readonly string[] {
  const ids = choice.options.map((o) => o.optionId);
  const decline = ids.includes("decline") ? ["decline"] : ids.slice(0, choice.minSelections);
  const enemyAtk = (characterProfile(state, attack.enemyInstanceId, deps)?.atk ?? 1) + 1;
  const target = attack.targetCharacterInstanceId;
  const heroLeft = hpLeft(state, target);
  const candidates = ids.filter(
    (id) =>
      id !== "decline" &&
      state.instances[id as InstanceId] &&
      !isProtected(state, id as InstanceId) &&
      !isMorlock(state, id as InstanceId),
  ) as InstanceId[];
  if (candidates.includes(target)) return [target];
  const allies = candidates.filter((id) => id !== target);
  const survivors = allies
    .filter((id) => hpLeft(state, id) > enemyAtk)
    .sort((a, b) => hpLeft(state, b) - hpLeft(state, a));
  if (survivors[0]) return [survivors[0]];
  if (heroLeft <= enemyAtk + 3) {
    const cheap = [...allies].sort((a, b) => valueAt(state, a) - valueAt(state, b));
    if (cheap[0]) return [cheap[0]];
  }
  return decline;
}

/** The hardest hit an enemy engaged with the seat (or a villain) can print right now, plus one for a boost. */
function worstEnemyAttack(state: GameState, deps: EngineDeps, seat: PlayerId): number {
  let worst = 0;
  for (const villain of undefeatedVillains(state))
    worst = Math.max(worst, characterProfile(state, villain.instanceId, deps)?.atk ?? 0);
  for (const id of Object.keys(state.instances) as InstanceId[])
    if (isMinion(state, id) && state.instances[id]?.engagedWith === seat)
      worst = Math.max(worst, characterProfile(state, id, deps)?.atk ?? 0);
  return worst + 1;
}

/** Indirect damage and its relatives: onto enemies when the options are enemies, otherwise onto allies before the hero. */
function assignDamage(state: GameState, choice: PendingChoice, amount: number, indirect: boolean): readonly string[] {
  const cardId = (optionId: string): InstanceId =>
    (optionId.includes("#") ? optionId.slice(0, optionId.lastIndexOf("#")) : optionId) as InstanceId;
  const options = choice.options.map((o) => o.optionId);
  const enemySide = options.some((id) => isEnemy(state, cardId(id)));
  const identityIds = new Set(state.players.map((p) => p.identity.instanceId));
  const rank = (optionId: string): number => {
    const id = cardId(optionId);
    if (enemySide) return isVillain(state, id) ? 1 : 0; // kill minions first
    if (isProtected(state, id)) return 100;
    if (identityIds.has(id)) return 50;
    return 10;
  };
  const sorted = [...options].sort((a, b) => rank(a) - rank(b));
  const wanted = indirect ? amount : Math.min(amount, choice.maxSelections);
  return sorted.slice(0, Math.max(choice.minSelections, wanted));
}

function divide(
  state: GameState,
  choice: PendingChoice,
  prompt: { readonly amount: number; readonly maxTargets?: number; readonly what: string },
): readonly string[] {
  const ids = choice.options.map((o) => o.optionId);
  const cardIdOf = (optionId: string): string => optionId.slice(0, optionId.lastIndexOf("#"));
  const cards = [...new Set(ids.map(cardIdOf))];
  const enemyFirst = cards.sort(
    (a, b) => Number(isEnemy(state, b as InstanceId)) - Number(isEnemy(state, a as InstanceId)),
  );
  const picked: string[] = [];
  const used: string[] = [];
  for (const card of enemyFirst) {
    if (picked.length >= prompt.amount) break;
    if (prompt.maxTargets !== undefined && used.length >= prompt.maxTargets) break;
    used.push(card);
    for (const id of ids.filter((x) => cardIdOf(x) === card)) {
      if (picked.length >= prompt.amount) break;
      picked.push(id);
    }
  }
  return picked;
}

/** Payment options worth at least `cost`: resource abilities, then resource cards, then the least valuable cards. */
function payFromOptions(
  state: GameState,
  choice: PendingChoice,
  cost: number,
  typed: { readonly physical?: number; readonly mental?: number; readonly energy?: number } | null,
): readonly string[] {
  if (cost <= 0) return [];
  const idOf = (optionId: string): InstanceId => optionId.slice("hand:".length) as InstanceId;
  const value = (optionId: string): number =>
    optionId.startsWith("ability:") ? 1 : resourceTotal(state, idOf(optionId));
  const matches = (optionId: string): boolean => {
    if (optionId.startsWith("ability:")) return true;
    if (!typed) return true;
    const card = cardAt(state, idOf(optionId));
    if (!card) return false;
    const pool = printedResources(card);
    return pool.wild > 0 || (["physical", "mental", "energy"] as const).some((t) => (typed[t] ?? 0) > 0 && pool[t] > 0);
  };
  const cost2 = (optionId: string): number => (optionId.startsWith("ability:") ? -1 : valueOf(state, idOf(optionId)));
  const ordered = choice.options
    .map((o) => o.optionId)
    .sort((a, b) => Number(matches(b)) - Number(matches(a)) || cost2(a) - cost2(b));
  const picks: string[] = [];
  let sum = 0;
  for (const optionId of ordered) {
    if (sum >= cost) break;
    picks.push(optionId);
    sum += value(optionId);
  }
  return sum >= cost ? picks : [];
}

// ---------------------------------------------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------------------------------------------

export interface SoloOptions {
  readonly maxCommands?: number;
  readonly style?: SoloStyle;
  readonly defense?: DefenseMode;
  /** See `SoloMemory.explore`; default 0 (no jitter). */
  readonly explore?: number;
  /** Called after every accepted command with the state it produced (for invariant checks and logging). */
  readonly onCommand?: (before: GameState, command: Command, after: GameState, events: readonly GameEvent[]) => void;
}

export interface SoloResult {
  readonly session: GameSession;
  readonly outcome: GameOutcome | null;
  readonly rounds: number;
  readonly commands: number;
  /** True when the command cap stopped a game that had not ended. */
  readonly capped: boolean;
}

export function playSolo(initial: GameState, deps: EngineDeps, options: SoloOptions = {}): SoloResult {
  const maxCommands = options.maxCommands ?? 3000;
  const memory = newSoloMemory(options.style, options.explore, options.defense);
  let session = startSession(initial);
  let commands = 0;
  while (!session.state.outcome && commands < maxCommands) {
    const command = soloNextCommand(session.state, deps, memory);
    const result = sessionApply(session, command, deps);
    if (!result.ok)
      throw new Error(
        `solo driver command ${JSON.stringify(command)} refused: ${result.error.code}: ${result.error.message}`,
      );
    options.onCommand?.(session.state, command, result.session.state, result.events);
    session = result.session;
    commands++;
  }
  return {
    session,
    outcome: session.state.outcome,
    rounds: session.state.round,
    commands,
    capped: !session.state.outcome,
  };
}
