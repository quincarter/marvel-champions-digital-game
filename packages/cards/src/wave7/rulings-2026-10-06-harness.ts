/**
 * Shared staging for the 2026-10-06 rulings QA (`rulings-2026-10-06.qa.test.ts`, `rulings-2026-10-06-part2.qa.test.ts`):
 * a real-content game past setup (any playable scenario, any starter decks), surgery helpers (a card conjured into a
 * hand, an upgrade attached, a minion engaged), a prompt-answering picker, and `drive`, which runs commands through a
 * session and checks that the command log replays to the same state. Test-only; the engine is never patched.
 */
import { cardId } from "@mc/content";
import {
  applyCommand,
  cardsInPlay,
  createGame,
  replay,
  sessionApply,
  startSession,
  type CardInstance,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { expect } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "../playable/index.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../testing/harness.js";
import { withForm } from "../testing/staging.js";

export const DEPS = PLAYABLE_DEPS;

// ---------------------------------------------------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------------------------------------------------

/** A game past setup, every seat in hero form, P1 on their own turn. */
export function game(
  scenarioId: string,
  seats: readonly string[],
  modularSetIds: readonly string[] = [],
  seed = 1,
): GameState {
  const created = createGame(
    playableScenario(scenarioId, {
      seed,
      players: seats.map((starterDeckId) => ({ starterDeckId })),
      modularSetIds,
      firstPlayerIndex: 0,
    }),
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, firstLegal, (x) => x.step.phase === "player", DEPS);
  for (const p of s.players) s = withForm(s, { heroForm: 0 }, p.playerId);
  return s;
}
export const alterEgo = (s: GameState, p: PlayerId = P1): GameState => withForm(s, "alterEgo", p);

export const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
export const codes = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((id) => codeOf(s, id));
export const handCodes = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).hand);
export const discardCodes = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).discard);
export const damageOn = (s: GameState, id: InstanceId): number => inst(s, id).damage;
export const heroDamage = (s: GameState, p: PlayerId = P1): number => damageOn(s, identityOf(s, p));
export const attachedCodes = (s: GameState, host: InstanceId): string[] => codes(s, inst(s, host).attachments);
export const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
export const inPlayCodes = (s: GameState): string[] => codes(s, cardsInPlay(s));

let conjured = 9100;
/** A copy of `code` (any card, in or out of the player's deck) added to the player's hand by surgery. */
export function conjure(state: GameState, player: PlayerId, code: string): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, player);
  const template = inst(state, owner.deck[0] ?? owner.hand[0]!);
  const id = `i${conjured++}` as InstanceId;
  const instance = {
    ...template,
    instanceId: id,
    cardId: cardId(code),
    exhausted: false,
    flipped: false,
    attachments: [],
    counters: {},
    damage: 0,
    threat: 0,
    statuses: { stunned: 0, confused: 0, tough: 0 },
    attachedTo: null,
    engagedWith: null,
  } as CardInstance;
  return {
    id,
    state: {
      ...state,
      instances: { ...state.instances, [id]: instance },
      players: state.players.map((p) => (p.playerId === player ? { ...p, hand: [...p.hand, id] } : p)),
    },
  };
}
export const fromHand = (s: GameState, player: PlayerId, id: InstanceId): GameState => ({
  ...s,
  players: s.players.map((p) => (p.playerId === player ? { ...p, hand: p.hand.filter((x) => x !== id) } : p)),
});
/** An upgrade of `player`'s attached to `host` (their identity by default) by surgery: no cost, no windows. */
export function attached(
  state: GameState,
  code: string,
  player: PlayerId = P1,
  host?: InstanceId,
): { state: GameState; id: InstanceId } {
  const given = conjure(state, player, code);
  const target = host ?? identityOf(state, player);
  const s = patchInstance(fromHand(given.state, player, given.id), given.id, {
    attachedTo: target,
    controllerId: player,
    ownerId: player,
    faceup: true,
  });
  return { id: given.id, state: patchInstance(s, target, { attachments: [...inst(s, target).attachments, given.id] }) };
}
/** An ally or support in `player`'s play area by surgery. */
export function inPlayArea(
  state: GameState,
  code: string,
  player: PlayerId = P1,
): { state: GameState; id: InstanceId } {
  const given = conjure(state, player, code);
  const s = patchInstance(fromHand(given.state, player, given.id), given.id, {
    controllerId: player,
    ownerId: player,
    faceup: true,
  });
  return {
    id: given.id,
    state: {
      ...s,
      players: s.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, given.id] } : p)),
    },
  };
}
/** The hand holds at least `n` cards besides those named (so a cost can be paid from it). */
export function funded(
  state: GameState,
  n: number,
  player: PlayerId = P1,
  keep: readonly InstanceId[] = [],
): GameState {
  let s = state;
  for (;;) {
    const owner = playerOf(s, player);
    if (owner.hand.filter((id) => !keep.includes(id)).length >= n) return s;
    const next = owner.deck[0];
    if (!next) throw new Error("no card left to pay with");
    s = moveToHand(s, player, codeOf(s, next)).state;
  }
}
/** Hand cards that print a resource (so each pays for 1), skipping the named ones. */
export function payers(s: GameState, player: PlayerId, n: number, exclude: readonly InstanceId[] = []): InstanceId[] {
  return payWith(s, player, n, exclude) as InstanceId[];
}

export type Prompt = { readonly kind: string; readonly options: readonly string[]; readonly player: PlayerId };
export type Answer = (s: GameState, options: readonly string[]) => readonly string[] | undefined;
/** A picker that tries each rule per prompt kind, records every prompt, and declines/leaves the rest. */
export function picker(rules: Readonly<Record<string, Answer>> = {}, seen: Prompt[] = []): Picker {
  return (s) => {
    const choice = s.pendingChoice;
    if (!choice) return [];
    const options = choice.options.map((o) => o.optionId);
    seen.push({ kind: choice.prompt.kind, options, player: choice.playerId });
    const rule = rules[choice.prompt.kind];
    const answer = rule?.(s, options);
    if (answer) return answer;
    const prompt = choice.prompt as { kind: string; cost?: number };
    // A payment prompt is answered with the number of cards its cost asks for (the minimum would pay nothing).
    if (prompt.kind === "payForCard" || prompt.kind === "payForAbility") return options.slice(0, prompt.cost ?? 0);
    return firstLegal(s);
  };
}
/** Takes the first offered option containing `needle` (an ability id or a card id), else undefined. */
export const takes =
  (...needles: readonly string[]): Answer =>
  (s, options) => {
    for (const needle of needles) {
      const hit = options.find((o) => o === needle || o.includes(needle) || codeOf0(s, o) === needle);
      if (hit) return [hit];
    }
    return undefined;
  };
export const codeOf0 = (s: GameState, option: string): string | undefined =>
  s.instances[option.replace(/^hand:/, "") as InstanceId]?.cardId as string | undefined;
/** The minimum number of options offered, in sorted order (a discard-down prompt asks for exactly the excess). */
export const fewest: Answer = (s, options) => options.slice().sort().slice(0, s.pendingChoice!.minSelections);
export const takesAll: Answer = (_s, options) => options;
export const declines: Answer = () => [];

export interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly prompts: readonly Prompt[];
}
/** Drives `commands` through a session answering prompts with `rules`; the log must replay to the same state. */
export function drive(start: GameState, rules: Readonly<Record<string, Answer>>, ...commands: readonly Command[]): Run {
  const prompts: Prompt[] = [];
  const pick = picker(rules, prompts);
  let session = startSession(start);
  const events: GameEvent[] = [];
  const apply = (command: Command) => {
    const result = sessionApply(session, command, DEPS);
    if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.code}: ${result.error.message}`);
    session = result.session;
    events.push(...result.events);
  };
  const settleAll = () => {
    for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
      if (guard > 300) throw new Error(`stuck on ${session.state.pendingChoice.prompt.kind}`);
      const choice = session.state.pendingChoice;
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(session.state),
      });
    }
  };
  settleAll();
  for (const command of commands) {
    apply(command);
    settleAll();
  }
  const replayed = replay(session.log, DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(session.state);
  return { state: session.state, events, prompts };
}
export const rejected = (state: GameState, command: Command): boolean => !applyCommand(state, command, DEPS).ok;
/** The engine's refusal code for a command, or "accepted". */
export const refusal = (state: GameState, command: Command): string => {
  const r = applyCommand(state, command, DEPS);
  return r.ok ? "accepted" : r.error.code;
};
export const offeredOptions = (run: Run, kind: string): string[] =>
  run.prompts.filter((p) => p.kind === kind).flatMap((p) => [...p.options]);

/** Plays `code` from the conjured hand, paying `cost` from other hand cards. */
export function playCard(
  state: GameState,
  code: string,
  cost: number,
  rules: Readonly<Record<string, Answer>> = {},
  player = P1,
) {
  const given = conjure(funded(state, cost, player), player, code);
  const paid = payers(given.state, player, cost, [given.id]);
  const run = drive(given.state, rules, play(player, given.id, paid));
  return { ...run, id: given.id, before: given.state };
}
export const resolvedAbilities = (events: readonly GameEvent[]): string[] =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [String(e.abilityId)] : []));
export const hasResolved = (events: readonly GameEvent[], abilityId: string): boolean =>
  resolvedAbilities(events).includes(abilityId);

// ---------------------------------------------------------------------------------------------------------------------
// 2. A move of threat needs a source its threat can leave (RRG "Move", p. 30; "Crisis Icon", p. 14)
// ---------------------------------------------------------------------------------------------------------------------

let serial = 0;
export const blankInstance = (id: InstanceId, code: string, over: Partial<CardInstance>): CardInstance =>
  ({
    instanceId: id,
    cardId: cardId(code),
    ownerId: null,
    controllerId: null,
    home: { kind: "activeEncounterDeck" },
    faceup: true,
    exhausted: false,
    damage: 0,
    threat: 0,
    statuses: { stunned: 0, confused: 0, tough: 0 },
    counters: {},
    attachedTo: null,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: null,
    flipped: false,
    ...over,
  }) as CardInstance;
/** An encounter side scheme dropped into the villain area by surgery. */
export function withScheme(state: GameState, code: string, threat = 3): { state: GameState; id: InstanceId } {
  const id = `i8${++serial}-${code}` as InstanceId;
  return {
    id,
    state: {
      ...state,
      villainArea: [...state.villainArea, id],
      instances: { ...state.instances, [id]: blankInstance(id, code, { threat }) },
    },
  };
}
/** A minion engaged with `player`, by surgery. */
export function withMinion(
  state: GameState,
  code: string,
  opts: { player?: PlayerId; damage?: number } = {},
): { state: GameState; id: InstanceId } {
  const player = opts.player ?? P1;
  const id = `i8${++serial}-${code}` as InstanceId;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: {
        ...state.instances,
        [id]: blankInstance(id, code, {
          home: { kind: "playArea", playerId: player } as never,
          damage: opts.damage ?? 0,
          engagedWith: player,
          controllerId: null,
        }),
      },
    },
  };
}
/** An encounter card attached to `host` by surgery (a fresh instance: no reveal, no When Revealed). */
export function attachEncounter(
  state: GameState,
  code: string,
  host: InstanceId,
): { state: GameState; id: InstanceId } {
  const id = `i8${++serial}-${code}` as InstanceId;
  return {
    id,
    state: {
      ...state,
      instances: {
        ...state.instances,
        [id]: blankInstance(id, code, { attachedTo: host }),
        [host]: { ...state.instances[host]!, attachments: [...state.instances[host]!.attachments, id] },
      },
    },
  };
}
export const threatOf = (s: GameState, id: InstanceId): number => inst(s, id).threat;
export const mainOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
/** The villain area holds only the main scheme (and what `keep` names). */
export const withoutSideSchemes = (s: GameState, mainThreatNow: number): GameState =>
  patchInstance({ ...s, villainArea: [] }, mainOf(s), { threat: mainThreatNow });

export const CROWD_CONTROL = "01108"; // a Core side scheme with a crisis icon
export const BREAKIN = "01107"; // a Core side scheme with a hazard icon, no crisis
export const TEMPORAL_LEAP = "40013";
export const LEAP_INTERRUPT = "40013.temporal-leap-interrupt";

/** The smallest main-scheme threat at which a villain phase (no card played) completes the stage. */
export function completingThreat(state: GameState): number {
  for (let t = 0; t < 40; t++) {
    let s = patchInstance(state, mainOf(state), { threat: t });
    for (const p of s.players) s = settle(runCommand(s, endTurn(p.playerId)), firstLegal, undefined, DEPS);
    if (s.mainScheme.stageIndex > state.mainScheme.stageIndex || s.outcome) return t;
  }
  throw new Error("the main scheme never completed");
}
export const runCommand = (s: GameState, c: Command): GameState => {
  const r = applyCommand(s, c, DEPS);
  if (!r.ok) throw new Error(`${c.type} rejected: ${r.error.code}: ${r.error.message}`);
  return r.state;
};
/** Both players end their turns: the villain phase runs. */
export const bothEnd = (s: GameState): Command[] => s.players.map((p) => endTurn(p.playerId));
export const toVictory = (state: GameState, id: InstanceId): GameState => ({
  ...patchInstance(state, id, { threat: 0 }),
  villainArea: state.villainArea.filter((x) => x !== id),
  victoryDisplay: [...state.victoryDisplay, id],
});

// ---------------------------------------------------------------------------------------------------------------------
// 3. "Would" interrupts are an earlier tier (RRG "'Would'", p. 48), for attacks, schemes and defeats
// ---------------------------------------------------------------------------------------------------------------------

/** The interrupt windows opened for an attack by `enemy`: tier and the abilities gathered. */
export const attackWindows = (events: readonly GameEvent[], enemy: InstanceId) =>
  events.flatMap((e) =>
    e.type === "windowOpened" &&
    e.timing === "interrupt" &&
    e.event.kind === "enemyAttack" &&
    e.event.enemyInstanceId === enemy
      ? [{ would: e.would === true, abilities: e.candidates.map((c) => String(c.abilityId)) }]
      : [],
  );
export const defeatWindows = (events: readonly GameEvent[], target: InstanceId) =>
  events.flatMap((e) =>
    e.type === "windowOpened" &&
    e.timing === "interrupt" &&
    e.event.kind === "characterDefeated" &&
    e.event.instanceId === target
      ? [{ would: e.would === true, abilities: e.candidates.map((c) => String(c.abilityId)) }]
      : [],
  );
export const attacksBy = (events: readonly GameEvent[], enemy: InstanceId) =>
  events.filter((e) => e.type === "attackResolved" && e.enemyInstanceId === enemy);
export const schemesBy = (events: readonly GameEvent[], enemy: InstanceId) =>
  events.filter((e) => e.type === "schemeResolved" && e.enemyInstanceId === enemy);
export const ordering = (run: Run) => run.prompts.filter((p) => p.kind === "orderTriggers");
export const WEBBED_UP = "01009";
export const CHARGE = "01099";
export const WEBBED_INTERRUPT = "01009.webbed-up-forced-interrupt";
export const SPIDER_SENSE = "01001a.spider-sense";
/** The deck's top two cards are Core's two Advances (0 boost icons) so the first boosts are predictable. */
export const fillers = (s: GameState): GameState => stackEncounterDeck(s, "01186", "01186");

// ---------------------------------------------------------------------------------------------------------------------
// 4. 0 damage opens no damage window (RRG "Damage" p. 14, "Tough" p. 44, "Prevent" p. 35)
// ---------------------------------------------------------------------------------------------------------------------

export const BACKFLIP_OFFER = "01003.backflip-interrupt";
export const WARNING_OFFER = "09021.warning-interrupt";
export const offeredAnywhere = (run: Run, needle: string): boolean =>
  run.prompts.some((p) => p.options.some((o) => o.includes(needle)));
/** Answers the defender prompt with the first listed option containing `who` (an instance id), else declines. */
export const defendSelf: Answer = (s, options) => {
  const own = identityOf(s, s.pendingChoice!.playerId);
  return options.includes(own) ? [own] : ["decline"];
};
export const defendWith =
  (who: InstanceId): Answer =>
  (_s, options) =>
    options.includes(who) ? [who] : ["decline"];

// ---------------------------------------------------------------------------------------------------------------------
// 5. A defender without DEF, and defense between players (RRG "Defense" and "Defender", pp. 14-15)
// ---------------------------------------------------------------------------------------------------------------------

export const AGILITY_OFFER = "42004.aerial-agility-interrupt";
/** Takes `needle` on its nth offer to the asked player (1-based), declining it at the others. */
export const nthOffer = (needle: string, nth: number): Answer => {
  let seen = 0;
  return (_s, options) => {
    const hit = options.find((o) => o.includes(needle));
    if (!hit) return undefined;
    return ++seen === nth ? [hit] : [];
  };
};
export const defenders = (events: readonly GameEvent[]) =>
  events.filter((e): e is Extract<GameEvent, { type: "defenderDeclared" }> => e.type === "defenderDeclared");

// ---------------------------------------------------------------------------------------------------------------------
// 6. Cypher on a killing blow, Warpath in the villain phase, Float Like a Butterfly unchanged
// ---------------------------------------------------------------------------------------------------------------------

export const CYPHER = "41013";
export const CYPHER_OFFER = "41013.";
export const WARPATH = "42013";
export const HYDRA_MERCENARY = "01101";

/** The printed cost of a card in the pool. */
export const cardCost = (code: string): number => {
  const probe = game("rhino", ["core-spider-man-justice"], ["the_doomsday_chair"]);
  return (probe.cardPool[cardId(code)] as { cost: number }).cost;
};
/** P1 ends the turn, so it is P2's. */
export const passToP2 = (s: GameState): GameState => runCommand(s, endTurn(P1));
/** Whether `player` can play `code` paying `cost` hand cards: the engine's verdict, "accepted" or its code. */
export function driveAttempt(state: GameState, code: string, cost: number, player: PlayerId): string {
  const given = conjure(funded(state, cost, player), player, code);
  return refusal(given.state, play(player, given.id, payers(given.state, player, cost, [given.id])));
}
