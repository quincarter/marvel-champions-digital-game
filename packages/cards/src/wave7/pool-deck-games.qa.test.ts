/**
 * Wave 7 rules-QA: full solo games with the seven built 'Pool decks (docs/phase7-wave7-qa-pool-deck-games.md).
 *
 * The fixtures of `fixtures/pool-decks/` (proven legal by `pool-decks.qa.test.ts`) are seated through `playableScenario`
 * against Rhino (standard, Bomb Scare; the 'Pool seats get the Dreadpool set, RRG 1.8 FAQ p. 64 "Crisis of Infinite
 * Deadpools"), Morlock Siege and Mister Sinister, one seat, driven by the QA solo driver (`qa-solo-driver.ts`).
 *
 * - `PINS` (7 x 3): one game per pairing, a win where the scan found one, otherwise the longest loss, each named by
 *   (seed, defense, explore). Played command by command with the invariants of `built-deck-games.qa.test.ts` (copied
 *   here: no refusal, no soft lock, no card in two zones, unique rule, arithmetic of every attack and scheme, player side
 *   scheme limit, one voluntary form change a round), replayed from its log to a deep-equal state, and the outcome asserted
 *   by its rule. Re-pin from the scan (`POOL_SCAN=1`), not by editing an expectation to match.
 * - Staged games prove the 'Pool-specific behaviors in play. The driver is the stock one with two additions it must
 *   have for these cards: it answers the out-of-game prompts (Break Time's minutes, Git Gud's `wonPreviousGame` is a setup
 *   input) and it plays what the stock driver never does (Break Time costs 3 so its event rule skips it; a player side
 *   scheme is not scored at all), always from `legalActions`.
 * - `POOL_SCAN=1` prints the table; `QA_FULL=1` plays seeds 1-12 of every pairing with the invariants.
 */
import { describe, expect, it } from "vitest";
import {
  applyCommand,
  cardsInPlay,
  cardsMatch,
  characterProfile,
  createGame,
  handSize,
  legalActions,
  playerSideSchemeLimit,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameSession,
  type GameState,
  type InstanceId,
  type LegalAction,
  type PlayerId,
} from "@mc/engine";
import { PLAYABLE_CARDS, type CoreAspect } from "@mc/content";
import { PLAYABLE_DEPS, playableScenario } from "../playable/index.js";
import { withDamage } from "../testing/staging.js";
import { newSoloMemory, soloNextCommand, type DefenseMode } from "./qa-solo-driver.js";
import { POOL_FIXTURE_DECKS, type PoolFixture } from "./fixtures/pool-decks/index.js";

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const say = (line: string): void =>
  void (globalThis as { process?: { stdout?: { write: (s: string) => void } } }).process?.stdout?.write(`${line}\n`);
const DEPS = PLAYABLE_DEPS;
const SCENARIOS = ["rhino", "morlock-siege", "mister-sinister"] as const;
type Scenario = (typeof SCENARIOS)[number];
const COMMAND_CAP = 3000;
const PLAYER_CARD_TYPES: readonly string[] = ["ally", "event", "resource", "support", "upgrade", "player_side_scheme"];
const MINUTES = 3;

const FIXTURES: Readonly<Record<string, PoolFixture>> = Object.fromEntries(POOL_FIXTURE_DECKS.map((d) => [d.id, d]));
const byCode = new Map(PLAYABLE_CARDS.map((c) => [c.id as string, c]));
const cardOf = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId as string]!;
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const nameOf = (s: GameState, id: InstanceId): string => cardOf(s, id).name;
const aspectOfCode = (code: string): string => (byCode.get(code) as { aspect?: string } | undefined)?.aspect ?? "";

interface BuildOptions {
  readonly wonPreviousGame?: boolean;
  /** Cards put on top of the seat's deck (they are drawn into the opening hand) and of the encounter deck, top first. */
  readonly stackDeck?: readonly string[];
  readonly stackEncounter?: readonly string[];
}

function buildGame(fixtureId: string, scenario: Scenario, seed: number, options: BuildOptions = {}): GameState {
  const fixture = FIXTURES[fixtureId]!;
  const config = playableScenario(scenario, {
    seed,
    players: [
      {
        identityCardId: fixture.identityCardId as string,
        deck: fixture.cards.flatMap((l) => Array.from({ length: l.quantity }, () => l.cardId as string)),
        aspects: fixture.aspects as readonly CoreAspect[],
      },
    ],
    ...(options.stackDeck || options.stackEncounter
      ? {
          stack: {
            ...(options.stackDeck ? { players: { 0: options.stackDeck as never } } : {}),
            ...(options.stackEncounter ? { encounter: options.stackEncounter as never } : {}),
          },
        }
      : {}),
  });
  const seated = options.wonPreviousGame
    ? { ...config, players: config.players.map((p) => ({ ...p, outsideFacts: { wonPreviousGame: true } })) }
    : config;
  const created = createGame(seated, DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return created.state;
}

// ---------------------------------------------------------------------------------------------------------------
// Invariants (the minimum copied from built-deck-games.qa.test.ts)
// ---------------------------------------------------------------------------------------------------------------

function zoneIndex(s: GameState): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const add = (id: InstanceId, label: string) => index.set(id, [...(index.get(id) ?? []), label]);
  for (const p of s.players) {
    for (const zone of ["hand", "deck", "discard", "playArea", "dealtEncounter", "resolving", "setAside"] as const)
      for (const id of p[zone]) add(id, `${p.playerId}.${zone}`);
    for (const [name, sep] of Object.entries(p.separateDecks)) {
      for (const id of sep.deck) add(id, `${p.playerId}.sep.${name}.deck`);
      for (const id of sep.discard) add(id, `${p.playerId}.sep.${name}.discard`);
    }
    add(p.identity.instanceId, `${p.playerId}.identity`);
  }
  for (const [deckId, pile] of Object.entries(s.encounterDecks)) {
    for (const id of pile.deck) add(id, `enc.${deckId}.deck`);
    for (const id of pile.discard) add(id, `enc.${deckId}.discard`);
  }
  for (const id of s.encounterSetAside) add(id, "encounterSetAside");
  for (const id of s.villainArea) add(id, "villainArea");
  for (const id of s.victoryDisplay) add(id, "victoryDisplay");
  for (const id of s.removedFromGame) add(id, "removedFromGame");
  for (const [id, instance] of Object.entries(s.instances)) {
    for (const t of instance.tucked) add(t, `tuckedUnder.${id}`);
    for (const b of instance.boostCards) add(b, `boostOn.${id}`);
  }
  return index;
}

function checkState(s: GameState, dealtTo: ReadonlyMap<string, PlayerId>, where: string): void {
  const fail = (message: string): never => {
    throw new Error(`[${where}] round ${s.round} ${s.step.phase}/${s.step.kind}: ${message}`);
  };
  const choice = s.pendingChoice;
  if (choice) {
    // A whole-number `reportFact` has no options by design (it takes a digit string).
    const numberReport = choice.prompt.kind === "reportFact" && choice.prompt.answer === "wholeNumber";
    if (!numberReport && choice.minSelections > choice.options.length)
      fail(`soft lock: ${choice.prompt.kind} needs ${choice.minSelections} but offers ${choice.options.length}`);
    if (choice.minSelections > choice.maxSelections) fail(`${choice.prompt.kind}: min > max`);
  } else if (!s.outcome && !(s.step.phase === "player" && s.step.kind === "turn")) {
    fail("the game stopped between steps with nothing pending");
  }
  const zones = zoneIndex(s);
  for (const [id, labels] of zones)
    if (labels.length > 1) fail(`${id} (${nameOf(s, id as InstanceId)}) is in two zones: ${labels.join(", ")}`);
  const sideSchemes = s.villainArea.filter((id) => cardOf(s, id).type === "player_side_scheme");
  if (choice?.prompt.kind !== "discardOverPlayerSideSchemeLimit" && sideSchemes.length > playerSideSchemeLimit(s))
    fail(`${sideSchemes.length} player side schemes in play, limit ${playerSideSchemeLimit(s)}`);
  for (const [id, owner] of dealtTo)
    if (!zones.has(id) && s.instances[id]!.attachedTo === null)
      fail(`${owner}'s ${nameOf(s, id as InstanceId)} (${id}) is in no zone`);
  for (const p of s.players)
    for (const zone of ["hand", "deck", "discard", "playArea"] as const)
      for (const id of p[zone]) {
        const dealt = dealtTo.get(id);
        if (dealt !== undefined && dealt !== p.playerId)
          fail(`${nameOf(s, id)} (${id}, dealt to ${dealt}) is in ${p.playerId}'s ${zone}`);
        // A card dealt face down from the encounter deck (Dreadpool's When Defeated) is an encounter card in a player's zone.
        if (zone !== "hand" && zone !== "playArea" && dealt === undefined && s.instances[id]!.ownerId !== p.playerId)
          if (!["deck", "discard"].includes(zone) || s.instances[id]!.ownerId !== null)
            fail(`${nameOf(s, id)} (${id}) is in ${p.playerId}'s ${zone} but no deck started with it`);
      }
  // Unique Icon (RRG 1.8 p. 45).
  const unique: { id: InstanceId; what: string }[] = [];
  for (const p of s.players.filter((x) => !x.eliminated)) {
    unique.push({ id: p.identity.instanceId, what: `${p.playerId}'s identity` });
    for (const id of p.playArea)
      if (["ally", "support", "upgrade"].includes(cardOf(s, id).type)) unique.push({ id, what: nameOf(s, id) });
  }
  for (let i = 0; i < unique.length; i++)
    for (let j = i + 1; j < unique.length; j++)
      if (cardsMatch(cardOf(s, unique[i]!.id) as never, cardOf(s, unique[j]!.id) as never))
        fail(`unique rule broken: ${unique[i]!.what} and ${unique[j]!.what} are in play together`);
}

/** RRG 1.8 "Attack (Enemy Activation)" p. 9, "Boost" p. 11: damage = ATK + boost icons - DEF; a scheme places SCH + boost + bonus. */
function checkArithmetic(events: readonly GameEvent[], where: string): void {
  for (const e of events) {
    if (e.type === "attackResolved" && e.damageTo === undefined && e.removesThreatFrom === undefined) {
      const expected = Math.max(0, e.baseAtk + e.boostIcons - e.defenseReduction);
      if (e.damageDealt !== expected) throw new Error(`[${where}] attack dealt ${e.damageDealt}, expected ${expected}`);
    }
    if (e.type === "schemeResolved" && e.removesThreat !== true) {
      const expected = e.baseSch + e.boostIcons + e.threatBonus;
      if (e.threatPlaced !== expected)
        throw new Error(`[${where}] scheme placed ${e.threatPlaced}, expected ${expected}`);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The game loop: the stock solo driver, plus the answers and plays 'Pool cards need
// ---------------------------------------------------------------------------------------------------------------

interface DriveOptions {
  readonly defense?: DefenseMode;
  readonly explore?: number;
  /** The answer to the "talked this phase" question (the Merc with the Mouth). */
  readonly talked?: "yes" | "no";
  /** A legal action the stock driver would not choose (or not yet) that a staged test wants taken whenever it is legal. */
  readonly nudge?: (state: GameState, action: LegalAction) => Command | null;
  readonly checkInvariants?: boolean;
  /** Stop after this many commands without an outcome (a scan records the game as capped; a test inspects the state). */
  readonly stopAt?: number;
  /** Pass (end the turn at once) in rounds up to this one: a hero that has played nothing controls no 'Pool card. */
  readonly idleRounds?: number;
  readonly onStep?: (before: GameState, command: Command, after: GameState, events: readonly GameEvent[]) => void;
}

interface Played {
  readonly session: GameSession;
  readonly initial: GameState;
  readonly rounds: number;
  readonly commands: number;
  readonly outcome: GameState["outcome"];
}

function drive(initial: GameState, where: string, options: DriveOptions = {}): Played {
  const memory = newSoloMemory("rules", options.explore ?? 0, options.defense ?? "hero-ready");
  const dealtTo = new Map<string, PlayerId>();
  for (const [id, instance] of Object.entries(initial.instances))
    if (instance.ownerId !== null && PLAYER_CARD_TYPES.includes(cardOf(initial, id as InstanceId).type))
      dealtTo.set(id, instance.ownerId);
  if (options.checkInvariants) checkState(initial, dealtTo, `${where} start`);
  const formChanges = new Map<string, number>();
  let session = startSession(initial);
  let commands = 0;
  while (!session.state.outcome && commands < (options.stopAt ?? COMMAND_CAP)) {
    const state = session.state;
    const choice = state.pendingChoice;
    let command: Command | undefined;
    if (choice?.prompt.kind === "reportFact") {
      const answer = choice.prompt.answer === "wholeNumber" ? String(MINUTES) : (options.talked ?? "no");
      command = {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: [answer],
      };
    } else if (!choice && options.nudge && state.step.phase === "player" && state.step.kind === "turn") {
      const seat = state.step.activePlayerId;
      const legal = legalActions(state, seat, DEPS);
      if (legal.kind === "turn") {
        for (const a of legal.legal) command ??= options.nudge(state, a) ?? undefined;
      }
    }
    if (
      !command &&
      !choice &&
      state.step.phase === "player" &&
      state.step.kind === "turn" &&
      state.round <= (options.idleRounds ?? 0)
    )
      command = { type: "endTurn", playerId: state.step.activePlayerId };
    command ??= soloNextCommand(state, DEPS, memory);
    const result = sessionApply(session, command, DEPS);
    if (!result.ok)
      throw new Error(`[${where}] driver command ${JSON.stringify(command)} refused: ${result.error.code}`);
    if (options.checkInvariants) {
      checkArithmetic(result.events, where);
      if (command.type === "changeForm") {
        const key = `${state.round}:${command.playerId}`;
        formChanges.set(key, (formChanges.get(key) ?? 0) + 1);
        if ((formChanges.get(key) ?? 0) > 1) throw new Error(`[${where}] two voluntary form changes in ${key}`);
      }
      checkState(result.session.state, dealtTo, `${where} after ${command.type}`);
    }
    options.onStep?.(state, command, result.session.state, result.events);
    session = result.session;
    commands++;
  }
  if (options.stopAt === undefined)
    expect(session.state.outcome, `${where} did not end within ${COMMAND_CAP} commands`).toBeTruthy();
  if (options.checkInvariants && session.state.outcome) {
    const replayed = replay(session.log, DEPS);
    expect(replayed.ok, `${where} replay`).toBe(true);
    if (replayed.ok) expect(replayed.state, `${where} replay is deep-equal`).toEqual(session.state);
  }
  return { session, initial, rounds: session.state.round, commands, outcome: session.state.outcome };
}

type Verdict = "win" | `loss:${string}`;
const verdictOf = (p: Played): Verdict => {
  const o = p.outcome;
  if (!o) return "loss:capped";
  return o.result === "win" ? "win" : `loss:${(o as { reason: string }).reason}`;
};

// ---------------------------------------------------------------------------------------------------------------
// Pins
// ---------------------------------------------------------------------------------------------------------------

interface Pin {
  readonly fixture: string;
  readonly scenario: Scenario;
  readonly seed: number;
  readonly defense: DefenseMode;
  readonly explore: number;
  readonly verdict: Verdict;
  readonly rounds: number;
}

/** Filled from the scan in docs/phase7-wave7-qa-pool-deck-games.md. */
const LONG_PINS: readonly Pin[] = [
  {
    fixture: "deadpool-pool-break-time",
    scenario: "rhino",
    seed: 1,
    defense: "balanced",
    explore: 1,
    verdict: "loss:mainSchemeCompleted",
    rounds: 10,
  },
  {
    fixture: "deadpool-pool-break-time",
    scenario: "morlock-siege",
    seed: 6,
    defense: "hero-ready",
    explore: 1,
    verdict: "loss:mainSchemeCompleted",
    rounds: 9,
  },
  {
    fixture: "deadpool-pool-break-time",
    scenario: "mister-sinister",
    seed: 9,
    defense: "balanced",
    explore: 3,
    verdict: "loss:mainSchemeCompleted",
    rounds: 9,
  },
  {
    fixture: "deadpool-aggression",
    scenario: "rhino",
    seed: 10,
    defense: "balanced",
    explore: 0,
    verdict: "win",
    rounds: 10,
  },
  {
    fixture: "deadpool-aggression",
    scenario: "morlock-siege",
    seed: 3,
    defense: "balanced",
    explore: 2,
    verdict: "win",
    rounds: 6,
  },
  {
    fixture: "deadpool-aggression",
    scenario: "mister-sinister",
    seed: 10,
    defense: "hero-ready",
    explore: 3,
    verdict: "loss:mainSchemeCompleted",
    rounds: 9,
  },
  {
    fixture: "spider-man-pool",
    scenario: "rhino",
    seed: 2,
    defense: "hero-ready",
    explore: 8,
    verdict: "loss:allPlayersDefeated",
    rounds: 18,
  },
  {
    fixture: "spider-man-pool",
    scenario: "morlock-siege",
    seed: 6,
    defense: "hero-ready",
    explore: 0,
    verdict: "loss:mainSchemeCompleted",
    rounds: 11,
  },
  {
    fixture: "spider-man-pool",
    scenario: "mister-sinister",
    seed: 6,
    defense: "hero-ready",
    explore: 1,
    verdict: "loss:mainSchemeCompleted",
    rounds: 23,
  },
  {
    fixture: "domino-pool",
    scenario: "rhino",
    seed: 11,
    defense: "hero-ready",
    explore: 6,
    verdict: "loss:mainSchemeCompleted",
    rounds: 18,
  },
  {
    fixture: "domino-pool",
    scenario: "morlock-siege",
    seed: 5,
    defense: "hero-ready",
    explore: 0,
    verdict: "loss:mainSchemeCompleted",
    rounds: 10,
  },
  {
    fixture: "domino-pool",
    scenario: "mister-sinister",
    seed: 11,
    defense: "hero-ready",
    explore: 0,
    verdict: "loss:mainSchemeCompleted",
    rounds: 9,
  },
  {
    fixture: "adam-warlock-pool",
    scenario: "rhino",
    seed: 9,
    defense: "hero-ready",
    explore: 1,
    verdict: "loss:mainSchemeCompleted",
    rounds: 20,
  },
  {
    fixture: "adam-warlock-pool",
    scenario: "morlock-siege",
    seed: 5,
    defense: "hero-ready",
    explore: 0,
    verdict: "loss:cardAbility",
    rounds: 10,
  },
  {
    fixture: "adam-warlock-pool",
    scenario: "mister-sinister",
    seed: 8,
    defense: "balanced",
    explore: 0,
    verdict: "loss:mainSchemeCompleted",
    rounds: 12,
  },
  {
    fixture: "cable-leadership-live-dangerously",
    scenario: "rhino",
    seed: 10,
    defense: "hero-ready",
    explore: 1,
    verdict: "loss:mainSchemeCompleted",
    rounds: 14,
  },
  {
    fixture: "cable-leadership-live-dangerously",
    scenario: "morlock-siege",
    seed: 5,
    defense: "hero-ready",
    explore: 2,
    verdict: "loss:cardAbility",
    rounds: 9,
  },
  {
    fixture: "cable-leadership-live-dangerously",
    scenario: "mister-sinister",
    seed: 9,
    defense: "hero-ready",
    explore: 0,
    verdict: "loss:mainSchemeCompleted",
    rounds: 10,
  },
  {
    fixture: "spider-woman-pool-justice",
    scenario: "rhino",
    seed: 10,
    defense: "hero-ready",
    explore: 3,
    verdict: "loss:mainSchemeCompleted",
    rounds: 23,
  },
  {
    fixture: "spider-woman-pool-justice",
    scenario: "morlock-siege",
    seed: 5,
    defense: "hero-ready",
    explore: 3,
    verdict: "loss:mainSchemeCompleted",
    rounds: 10,
  },
  {
    fixture: "spider-woman-pool-justice",
    scenario: "mister-sinister",
    seed: 8,
    defense: "balanced",
    explore: 1,
    verdict: "loss:mainSchemeCompleted",
    rounds: 17,
  },
];

/**
 * One game per pairing, chosen for speed: a win where the scan found one (Deadpool Aggression at Rhino and Morlock Siege),
 * otherwise the shortest loss of seeds 1-12 x explore 0-3 (hero-ready): 2 to 5 rounds. The longest losses (up to 23 rounds)
 * are `LONG_PINS`, played with the same invariants under `QA_FULL=1` (about 6 minutes).
 */
const PINS: readonly Pin[] = [
  {
    fixture: "adam-warlock-pool",
    scenario: "rhino",
    seed: 4,
    defense: "hero-ready",
    explore: 2,
    verdict: "loss:mainSchemeCompleted",
    rounds: 3,
  },
  {
    fixture: "adam-warlock-pool",
    scenario: "morlock-siege",
    seed: 8,
    defense: "hero-ready",
    explore: 2,
    verdict: "loss:mainSchemeCompleted",
    rounds: 4,
  },
  {
    fixture: "adam-warlock-pool",
    scenario: "mister-sinister",
    seed: 10,
    defense: "hero-ready",
    explore: 1,
    verdict: "loss:cardAbility",
    rounds: 2,
  },
  {
    fixture: "deadpool-aggression",
    scenario: "rhino",
    seed: 10,
    defense: "balanced",
    explore: 0,
    verdict: "win",
    rounds: 10,
  },
  {
    fixture: "deadpool-aggression",
    scenario: "morlock-siege",
    seed: 3,
    defense: "balanced",
    explore: 2,
    verdict: "win",
    rounds: 6,
  },
  {
    fixture: "deadpool-aggression",
    scenario: "mister-sinister",
    seed: 3,
    defense: "hero-ready",
    explore: 3,
    verdict: "loss:allPlayersDefeated",
    rounds: 3,
  },
  {
    fixture: "cable-leadership-live-dangerously",
    scenario: "rhino",
    seed: 11,
    defense: "hero-ready",
    explore: 1,
    verdict: "loss:mainSchemeCompleted",
    rounds: 2,
  },
  {
    fixture: "cable-leadership-live-dangerously",
    scenario: "morlock-siege",
    seed: 11,
    defense: "hero-ready",
    explore: 1,
    verdict: "loss:allPlayersDefeated",
    rounds: 2,
  },
  {
    fixture: "cable-leadership-live-dangerously",
    scenario: "mister-sinister",
    seed: 3,
    defense: "hero-ready",
    explore: 0,
    verdict: "loss:allPlayersDefeated",
    rounds: 2,
  },
  {
    fixture: "deadpool-pool-break-time",
    scenario: "rhino",
    seed: 9,
    defense: "hero-ready",
    explore: 0,
    verdict: "loss:mainSchemeCompleted",
    rounds: 3,
  },
  {
    fixture: "deadpool-pool-break-time",
    scenario: "morlock-siege",
    seed: 4,
    defense: "hero-ready",
    explore: 3,
    verdict: "loss:mainSchemeCompleted",
    rounds: 3,
  },
  {
    fixture: "deadpool-pool-break-time",
    scenario: "mister-sinister",
    seed: 11,
    defense: "hero-ready",
    explore: 0,
    verdict: "loss:cardAbility",
    rounds: 3,
  },
  {
    fixture: "domino-pool",
    scenario: "rhino",
    seed: 6,
    defense: "hero-ready",
    explore: 0,
    verdict: "loss:allPlayersDefeated",
    rounds: 3,
  },
  {
    fixture: "domino-pool",
    scenario: "morlock-siege",
    seed: 6,
    defense: "hero-ready",
    explore: 3,
    verdict: "loss:allPlayersDefeated",
    rounds: 2,
  },
  {
    fixture: "domino-pool",
    scenario: "mister-sinister",
    seed: 10,
    defense: "hero-ready",
    explore: 0,
    verdict: "loss:cardAbility",
    rounds: 2,
  },
  {
    fixture: "spider-man-pool",
    scenario: "rhino",
    seed: 6,
    defense: "hero-ready",
    explore: 2,
    verdict: "loss:mainSchemeCompleted",
    rounds: 5,
  },
  {
    fixture: "spider-man-pool",
    scenario: "morlock-siege",
    seed: 4,
    defense: "hero-ready",
    explore: 0,
    verdict: "loss:mainSchemeCompleted",
    rounds: 4,
  },
  {
    fixture: "spider-man-pool",
    scenario: "mister-sinister",
    seed: 4,
    defense: "hero-ready",
    explore: 1,
    verdict: "loss:allPlayersDefeated",
    rounds: 5,
  },
  {
    fixture: "spider-woman-pool-justice",
    scenario: "rhino",
    seed: 6,
    defense: "hero-ready",
    explore: 1,
    verdict: "loss:mainSchemeCompleted",
    rounds: 4,
  },
  {
    fixture: "spider-woman-pool-justice",
    scenario: "morlock-siege",
    seed: 9,
    defense: "hero-ready",
    explore: 2,
    verdict: "loss:cardAbility",
    rounds: 4,
  },
  {
    fixture: "spider-woman-pool-justice",
    scenario: "mister-sinister",
    seed: 10,
    defense: "hero-ready",
    explore: 1,
    verdict: "loss:cardAbility",
    rounds: 2,
  },
];

/** Game over is a state: no step, no prompt, no legal action, and a further command is refused. */
function assertGameOver(s: GameState): void {
  expect(s.pendingChoice).toBeNull();
  expect(s.step.phase).toBe("gameOver");
  expect(legalActions(s, s.players[0]!.playerId, DEPS).kind).toBe("gameOver");
  expect(applyCommand(s, { type: "endTurn", playerId: s.players[0]!.playerId }, DEPS).ok).toBe(false);
}

function assertOutcomeByRule(scenario: Scenario, s: GameState): void {
  const o = s.outcome!;
  if (o.result === "win") {
    if (scenario === "morlock-siege") {
      // Mutant Massacre / Knock, Knock: "If there are 3 villains under Routed, the players win the game."
      const routed = (Object.keys(s.instances) as InstanceId[]).find((id) => s.instances[id]!.cardId === "40081a");
      expect(routed).toBeDefined();
      expect(s.instances[routed!]!.tucked.length).toBeGreaterThanOrEqual(3);
    } else {
      // RRG 1.8 "Villain Defeat" (p. 47): the game is won on the defeat of the villain's last stage.
      expect(s.villains.every((v) => v.defeated)).toBe(true);
      for (const v of s.villains) expect(v.stageIndex).toBe(v.lastStageIndex);
    }
    return;
  }
  const loss = o as { reason: string; sourceInstanceId?: InstanceId };
  if (loss.reason === "mainSchemeCompleted") {
    const threat = s.instances[s.mainScheme.instanceId]!.threat;
    expect(threat).toBeGreaterThanOrEqual(1);
  } else if (loss.reason === "allPlayersDefeated") {
    for (const p of s.players) {
      const profile = characterProfile(s, p.identity.instanceId, DEPS)!;
      expect(p.eliminated || s.instances[p.identity.instanceId]!.damage >= profile.maxHp).toBe(true);
    }
  } else if (loss.reason === "cardAbility" && loss.sourceInstanceId) {
    // Stryfe / Mister Sinister: "If Hope Summers is defeated, you lose"; Morlock Siege's Mutant Massacre 2B: "If this stage
    // is completed or there are no Morlock allies in play, the players lose the game."
    if (nameOf(s, loss.sourceInstanceId) === "Hope Summers")
      expect(cardsInPlay(s)).not.toContain(loss.sourceInstanceId);
    else
      expect(cardsInPlay(s).filter((id) => nameOf(s, id) === "Morlock" && cardOf(s, id).type === "ally")).toHaveLength(
        0,
      );
  }
}

const playPin = (pin: Pin): void => {
  const name = `${pin.fixture} / ${pin.scenario} / seed ${pin.seed}`;
  const played = drive(buildGame(pin.fixture, pin.scenario, pin.seed), name, {
    defense: pin.defense,
    explore: pin.explore,
    checkInvariants: true,
  });
  expect(verdictOf(played)).toBe(pin.verdict);
  expect(played.rounds).toBe(pin.rounds);
  assertGameOver(played.session.state);
  assertOutcomeByRule(pin.scenario, played.session.state);
};
const pinName = (pin: Pin) => ({ ...pin, name: `${pin.fixture} / ${pin.scenario} / seed ${pin.seed}` });

describe("'Pool deck solo games: the pinned table", () => {
  it.each(PINS.map(pinName))("$name ends $verdict in $rounds rounds", playPin, 120_000);
});

describe.skipIf(env.QA_FULL !== "1")("'Pool deck solo games: the longest losses of the scan (QA_FULL=1)", () => {
  it.each(LONG_PINS.map(pinName))("$name ends $verdict in $rounds rounds", playPin, 600_000);
});

// ---------------------------------------------------------------------------------------------------------------
// Scans
// ---------------------------------------------------------------------------------------------------------------

const SCAN = env.POOL_SCAN === "1";

describe.skipIf(!SCAN)("scan (POOL_SCAN=1)", () => {
  const seeds = Number(env.POOL_SCAN_SEEDS ?? 12);
  const explores = (env.POOL_SCAN_EXPLORE ?? "0,1,2,3").split(",").map(Number);
  const only = env.POOL_SCAN_ONLY?.split(",");
  const scenarios = (env.POOL_SCAN_SCENARIOS?.split(",") ?? [...SCENARIOS]) as Scenario[];
  const cases = POOL_FIXTURE_DECKS.flatMap((d) => scenarios.map((scenario) => ({ fixture: d.id, scenario }))).filter(
    (c) => !only || only.includes(c.fixture),
  );
  it.each(cases)(
    "$fixture / $scenario",
    ({ fixture, scenario }) => {
      let wins = 0;
      let games = 0;
      let firstWin = "";
      let longest = { rounds: -1, commands: -1, key: "" };
      let shortest = { commands: Infinity, key: "" };
      const reasons: Record<string, number> = {};
      const tags: Record<string, string> = {};
      const tagCounts: Record<string, number> = {};
      for (const defense of (env.POOL_SCAN_DEFENSE?.split(",") ?? ["hero-ready", "balanced"]) as DefenseMode[])
        for (const explore of explores)
          for (let seed = 1; seed <= seeds; seed++) {
            const tagsHere = new Set<string>();
            const played = drive(buildGame(fixture, scenario, seed), `${fixture}/${scenario}/${seed}`, {
              defense,
              explore,
              stopAt: 700,
              onStep: (_b, _c, _a, events) => {
                for (const e of events) {
                  if (
                    e.type === "encounterCardRevealed" &&
                    ["44037", "44038", "44039", "44032"].includes(e.cardId as string)
                  )
                    tagsHere.add(`revealed${e.cardId}`);
                  if (e.type === "characterDefeated" && e.cardId === "44038") tagsHere.add("dreadpoolDefeated");
                  if (e.type === "abilityResolved" && e.abilityId === "44001a.the-regeneratin-degenerate")
                    tagsHere.add("regen");
                  if (e.type === "abilityResolved" && e.abilityId === "44028.git-gud-forced-interrupt")
                    tagsHere.add("gitGudInterrupt");
                  if (e.type === "cardPlayed" && ["44046", "44028", "44024"].includes(e.cardId as string))
                    tagsHere.add(`played${e.cardId}`);
                  if (e.type === "factReported") tagsHere.add(`fact:${e.fact}=${e.amount}`);
                }
              },
            });
            const v = verdictOf(played);
            for (const t of tagsHere) if (!tags[t]) tags[t] = `seed ${seed}, ${defense}, explore ${explore}`;
            for (const t of tagsHere) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
            games++;
            reasons[v] = (reasons[v] ?? 0) + 1;
            const key = `seed ${seed}, ${defense}, explore ${explore}: ${v} in ${played.rounds}`;
            if (v === "win") {
              wins++;
              if (!firstWin) firstWin = key;
            } else if (played.outcome && played.commands < shortest.commands) {
              shortest = { commands: played.commands, key };
            }
            if (
              v !== "win" &&
              (played.rounds > longest.rounds ||
                (played.rounds === longest.rounds && played.commands > longest.commands))
            )
              longest = { rounds: played.rounds, commands: played.commands, key };
          }
      say(
        `SCAN ${fixture} ${scenario}: ${wins}/${games} wins; first win [${firstWin}]; longest loss [${longest.key}]; shortest loss [${shortest.key}] (${shortest.commands} commands); ${JSON.stringify(reasons)}`,
      );
      say(
        `TAGS ${fixture} ${scenario}: ${JSON.stringify(Object.fromEntries(Object.entries(tags).map(([t, w]) => [t, `${tagCounts[t]} (first ${w})`])))}`,
      );
    },
    3_600_000,
  );
});

describe.skipIf(env.QA_FULL !== "1")("'Pool deck solo games: the wide scan (QA_FULL=1)", () => {
  const cases = POOL_FIXTURE_DECKS.flatMap((d) => SCENARIOS.map((scenario) => ({ fixture: d.id, scenario })));
  it.each(cases)(
    "$fixture / $scenario: seeds 1-12 hold the invariants",
    ({ fixture, scenario }) => {
      for (let seed = 1; seed <= 12; seed++)
        drive(buildGame(fixture, scenario, seed), `${fixture}/${scenario}/${seed}`, { checkInvariants: true });
    },
    3_600_000,
  );
});

// ---------------------------------------------------------------------------------------------------------------
// Staged games: the 'Pool-specific behaviors, seen in play
// ---------------------------------------------------------------------------------------------------------------

const P1 = "p1" as PlayerId;
const DREADPOOL_SEED = 4;
const REGEN = {
  fixture: "deadpool-pool-break-time",
  scenario: "rhino" as Scenario,
  seed: 3,
  defense: "hero-ready" as DefenseMode,
  explore: 0,
};
interface Step {
  readonly before: GameState;
  readonly command: Command;
  readonly after: GameState;
  readonly events: readonly GameEvent[];
}
function trace(initial: GameState, where: string, options: DriveOptions = {}): { played: Played; steps: Step[] } {
  const steps: Step[] = [];
  const played = drive(initial, where, {
    checkInvariants: true,
    ...options,
    onStep: (before, command, after, events) => steps.push({ before, command, after, events }),
  });
  return { played, steps };
}
const allEvents = (steps: readonly Step[]): GameEvent[] => steps.flatMap((s) => [...s.events]);
const playedCards = (steps: readonly Step[], code?: string) =>
  allEvents(steps).filter(
    (e): e is Extract<GameEvent, { type: "cardPlayed" }> => e.type === "cardPlayed" && (!code || e.cardId === code),
  );
/** The first card of the first encounter deck after setup, to eat the villain's boost draw (it is drawn before the player reveals). */
function fillerCode(fixtureId: string, scenario: Scenario, seed: number): string {
  const probe = buildGame(fixtureId, scenario, seed);
  const pile = Object.values(probe.encounterDecks)[0]!;
  const code = pile.deck.map((id) => codeOf(probe, id)).find((c) => !c.startsWith("440"))!;
  return code;
}
const stackedGame = (
  fixtureId: string,
  scenario: Scenario,
  seed: number,
  deck: readonly string[],
  encounter: readonly string[] = [],
  extra: BuildOptions = {},
): GameState =>
  buildGame(fixtureId, scenario, seed, {
    ...extra,
    stackDeck: deck,
    ...(encounter.length > 0 ? { stackEncounter: [fillerCode(fixtureId, scenario, seed), ...encounter] } : {}),
  });

const identityOf = (s: GameState): InstanceId => s.players[0]!.identity.instanceId;
const POOL_NUDGE = (state: GameState, a: LegalAction): Command | null => {
  if (a.action.kind !== "playCard") return null;
  const code = codeOf(state, a.action.instanceId);
  if (code === "44046" && state.instances[identityOf(state)]!.damage > 0) return a.example;
  if (code === "44024" || code === "44028") return a.example;
  return null;
};
/** Attack Dreadpool (44038) whenever he is a legal target: a defeat by a player is what his When Defeated needs. */
const HUNT_DREADPOOL = (state: GameState, a: LegalAction): Command | null => {
  if (a.action.kind !== "basicAttack") return null;
  const target = a.targets.find((id) => codeOf(state, id) === "44038");
  return target
    ? { type: "basicAttack", playerId: P1, attackerInstanceId: a.action.instanceId, targetInstanceId: target }
    : null;
};
const firstStep = (steps: readonly Step[], pick: (e: GameEvent) => boolean): Step | undefined =>
  steps.find((step) => step.events.some(pick));
const instancesOf = (s: GameState, code: string): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((id) => codeOf(s, id) === code);
const inPlayOf = (s: GameState, code: string): InstanceId[] =>
  instancesOf(s, code).filter((id) => cardsInPlay(s).includes(id));

describe("'Pool behaviors in play (staged games, every command checked, every log replayed)", () => {
  // Crisis of Infinite Deadpools 44037: "Reveal the set-aside Dreadpool minion and Dreadful Deeds side scheme ... Remove
  // this card from the game" (RRG 1.8 FAQ p. 64). Dreadpool 44038: "Dreadpool engages the first player. When Defeated:
  // Deal Dreadpool to the player who defeated him as a facedown encounter card." Dreadful Deeds 44039: "Place 2 threat
  // here for each player who controls 1 or more 'Pool (pink) cards."
  it("Crisis is drawn from the encounter deck, reveals Dreadpool and Dreadful Deeds; Deadpool controls 'Pool cards, so 2 threat is placed", () => {
    const { steps } = trace(
      stackedGame("deadpool-pool-break-time", "rhino", DREADPOOL_SEED, ["44043", "44013"], ["44037"]),
      "crisis",
      {
        nudge: HUNT_DREADPOOL,
      },
    );
    const reveal = firstStep(steps, (e) => e.type === "encounterCardRevealed" && e.cardId === "44037")!;
    expect(reveal).toBeDefined();
    const crisis = instancesOf(reveal.after, "44037")[0]!;
    expect(reveal.after.removedFromGame).toContain(crisis);
    const dreadpool = inPlayOf(reveal.after, "44038")[0]!;
    expect(reveal.after.instances[dreadpool]!.engagedWith).toBe(P1);
    const deeds = instancesOf(reveal.after, "44039")[0]!;
    expect(reveal.after.villainArea).toContain(deeds);
    // The allies played this turn are still in play when the villain phase reveals the card.
    const poolControlled = reveal.before.players[0]!.playArea.some(
      (id) => aspectOfCode(codeOf(reveal.before, id)) === "pool",
    );
    expect(poolControlled).toBe(true);
    const placed = reveal.events
      .filter((e) => e.type === "threatPlaced" && e.schemeInstanceId === deeds)
      .reduce((n, e) => n + (e as { amount: number }).amount, 0);
    expect(placed).toBe(2 + 2); // the printed starting threat, plus 2 for the one player controlling a 'Pool card
    expect(reveal.after.instances[deeds]!.threat).toBe(4);
    // Defeated by the player (the hunt), Dreadpool is dealt to them facedown, revealed again, and engages them again at full hit points.
    const defeated = firstStep(steps, (e) => e.type === "characterDefeated" && e.cardId === "44038")!;
    expect(defeated).toBeDefined();
    expect(defeated.after.players[0]!.dealtEncounter.map((id) => codeOf(defeated.after, id))).toContain("44038");
    const again = steps.find(
      (st) =>
        st.events.some((e) => e.type === "encounterCardRevealed" && e.cardId === "44038" && e.playerId === P1) &&
        steps.indexOf(st) > steps.indexOf(defeated),
    )!;
    expect(again).toBeDefined();
    const back = inPlayOf(again.after, "44038")[0]!;
    expect(again.after.instances[back]!.engagedWith).toBe(P1);
    expect(again.after.instances[back]!.damage).toBe(0);
  }, 120_000);

  it("Dreadful Deeds places nothing extra when the player controls no 'Pool card (the hero passed round 1)", () => {
    const { steps } = trace(
      stackedGame("deadpool-pool-break-time", "rhino", DREADPOOL_SEED, ["44043", "44013"], ["44037"]),
      "crisis-idle",
      { idleRounds: 1 },
    );
    const reveal = firstStep(steps, (e) => e.type === "encounterCardRevealed" && e.cardId === "44037")!;
    expect(
      reveal.before.players[0]!.playArea.filter((id) => aspectOfCode(codeOf(reveal.before, id)) === "pool"),
    ).toEqual([]);
    const deeds = instancesOf(reveal.after, "44039")[0]!;
    const placed = reveal.events
      .filter((e) => e.type === "threatPlaced" && e.schemeInstanceId === deeds)
      .reduce((n, e) => n + (e as { amount: number }).amount, 0);
    expect(placed).toBe(2); // the printed starting threat only: nobody controls a 'Pool card
    expect(reveal.after.instances[deeds]!.threat).toBe(2);
  }, 120_000);
});

describe("'Pool behaviors in play: cards that ask the player, cost, and play from the hand", () => {
  // Break Time 44046: "Alter-Ego Action: ... heal 1 damage from each identity for every minute you were away"; cost 3 per
  // player (RRG 1.8 "Per Player", 3 x the one player at this table); the player reports the minutes (an outside fact, answered 3).
  it("Break Time: asks the minutes (3), heals each identity that much (a 5-damage Wade Wilson goes to 2), costs 3 at one player", () => {
    const start = withDamage(
      stackedGame("deadpool-pool-break-time", "rhino", 1, ["44046", "44043", "44013", "44017", "44021"]),
      identityOf(stackedGame("deadpool-pool-break-time", "rhino", 1, [])),
      5,
    );
    expect(start.players[0]!.identity.form).toBe("alterEgo");
    const { steps } = trace(start, "break-time", { nudge: POOL_NUDGE });
    const play = firstStep(steps, (e) => e.type === "cardPlayed" && e.cardId === "44046")!;
    expect(play).toBeDefined();
    const cast = play.events.find((e) => e.type === "cardPlayed" && e.cardId === "44046") as { resourcesPaid: number };
    expect(cast.resourcesPaid).toBe(3);
    // The prompt is a whole-number report (no options); the step that answers it carries the fact and the healing.
    const answered = firstStep(steps, (e) => e.type === "factReported" && e.fact === "minutesAway")!;
    expect(answered.before.pendingChoice?.prompt).toMatchObject({
      kind: "reportFact",
      fact: "minutesAway",
      answer: "wholeNumber",
    });
    expect(answered.before.pendingChoice?.playerId).toBe(P1);
    expect(answered.events).toContainEqual(
      expect.objectContaining({ type: "factReported", amount: MINUTES, bind: "break" }),
    );
    const healed = answered.events
      .filter((e) => e.type === "damageHealed")
      .reduce((n, e) => n + (e as { amount: number }).amount, 0);
    expect(healed).toBe(MINUTES);
    expect(answered.after.instances[identityOf(answered.after)]!.damage).toBe(5 - MINUTES);
  }, 120_000);

  // Git Gud 44028: "Reduce the cost to play Git Gud by 2 if you did not win your previous game of Marvel Champions."
  // Printed cost 2; an absent outside fact means "did not win" (docs/phase7-wave7.md Q48).
  it.each([
    { wonPreviousGame: undefined, paid: 0 },
    { wonPreviousGame: true, paid: 2 },
  ])(
    "Git Gud with wonPreviousGame=$wonPreviousGame costs $paid",
    ({ wonPreviousGame, paid }) => {
      const start = stackedGame("deadpool-pool-break-time", "rhino", 1, ["44028", "44043"], [], {
        ...(wonPreviousGame ? { wonPreviousGame } : {}),
      });
      expect(start.players[0]!.outsideFacts?.wonPreviousGame).toBe(wonPreviousGame);
      const { steps } = trace(start, `git-gud-${String(wonPreviousGame)}`, { nudge: POOL_NUDGE });
      const cast = playedCards(steps, "44028");
      expect(cast.length).toBeGreaterThanOrEqual(1);
      expect(cast[0]!.resourcesPaid).toBe(paid);
    },
    120_000,
  );

  // The Merc with the Mouth 44032: "Forced Response: After the player phase ends, if you have not talked this phase,
  // discard this card." The client asks; the answer is a recorded fact.
  it.each([
    { talked: "no" as const, discarded: true },
    { talked: "yes" as const, discarded: false },
  ])(
    "the Merc with the Mouth asks, and answered '$talked' it is discarded: $discarded",
    ({ talked, discarded }) => {
      const { steps } = trace(
        stackedGame("deadpool-pool-break-time", "rhino", 5, ["44043"], ["44032"]),
        `merc-${talked}`,
        { talked },
      );
      const asked = steps.filter(
        (st) =>
          st.before.pendingChoice?.prompt.kind === "reportFact" &&
          st.before.pendingChoice.prompt.fact === "talkedThisPhase",
      );
      expect(asked.length).toBeGreaterThanOrEqual(1);
      expect(asked[0]!.before.pendingChoice!.prompt).toMatchObject({ answer: "yesNo" });
      expect(asked[0]!.events).toContainEqual(
        expect.objectContaining({ type: "factReported", fact: "talkedThisPhase", amount: talked === "yes" ? 1 : 0 }),
      );
      const merc = instancesOf(asked[0]!.after, "44032")[0]!;
      expect(cardsInPlay(asked[0]!.after).includes(merc)).toBe(!discarded);
      if (discarded)
        expect(Object.values(asked[0]!.after.encounterDecks).some((d) => d.discard.includes(merc))).toBe(true);
      // Answered yes it stays and the question comes again every player phase it is still there.
      if (!discarded) expect(asked.length).toBeGreaterThanOrEqual(2);
    },
    120_000,
  );

  // Live Dangerously 44024: "Victory 0. Each identity gets +2 hand size." A player side scheme: at most
  // one in play at a table of one player (RRG 1.8 "Player Side Scheme", p. 34); Cable's text lets a Leadership deck hold it.
  it.each(["cable-leadership-live-dangerously", "domino-pool"])(
    "%s plays Live Dangerously: +2 hand size, 3 threat, within the limit",
    (fixture) => {
      const { steps } = trace(stackedGame(fixture, "rhino", 1, ["44024"]), `live-dangerously-${fixture}`, {
        nudge: POOL_NUDGE,
      });
      const play = firstStep(steps, (e) => e.type === "cardPlayed" && e.cardId === "44024")!;
      expect(play).toBeDefined();
      const scheme = instancesOf(play.after, "44024")[0]!;
      expect(play.after.villainArea).toContain(scheme);
      expect(handSize(play.after, P1, DEPS)).toBe(handSize(play.before, P1, DEPS) + 2);
      expect(play.after.instances[scheme]!.threat).toBe(3); // 3 per player, one player
      const sideSchemes = (s: GameState) => s.villainArea.filter((id) => cardOf(s, id).type === "player_side_scheme");
      expect(playerSideSchemeLimit(play.after)).toBe(1); // RRG 1.8 p. 34: one or two players started: the limit is one
      if (sideSchemes(play.before).length === 0) {
        expect(sideSchemes(play.after)).toHaveLength(1);
      } else {
        // Cable starts with his own player side scheme (40006) in play: a second one is allowed to be played, and the
        // first player must then choose one to discard (RRG p. 34), which is not a defeat.
        expect(sideSchemes(play.before).map((id) => codeOf(play.before, id))).toEqual(["40006"]);
        expect(play.after.pendingChoice?.prompt.kind).toBe("discardOverPlayerSideSchemeLimit");
        const next = steps[steps.indexOf(play) + 1]!;
        expect(sideSchemes(next.after)).toHaveLength(1);
        expect(next.after.victoryDisplay.map((id) => codeOf(next.after, id))).not.toContain("44024");
        expect(next.after.victoryDisplay.map((id) => codeOf(next.after, id))).not.toContain("40006");
      }
    },
    120_000,
  );

  // Adam Warlock's four aspects (RRG 1.8 FAQ p. 64: 'Pool takes Aggression's place): cards of each aspect are played.
  it("Adam Warlock plays a card of each of his four aspects, 'Pool included", () => {
    const { steps } = trace(stackedGame("adam-warlock-pool", "rhino", 1, ["44043", "21062", "21058", "21051"]), "adam");
    const aspects = new Set(playedCards(steps).map((e) => aspectOfCode(e.cardId as string)));
    for (const aspect of ["pool", "justice", "leadership", "protection"]) expect(aspects, aspect).toContain(aspect);
  }, 120_000);

  // Deadpool 44001a, Forced Interrupt: when he would be defeated, instead his hit point dial goes to 1, he changes to
  // alter-ego form and 1 acceleration token is added to the main scheme.
  it("Deadpool's would-be-defeated ability fires in a real game: dial to 1, alter-ego, one more acceleration token", () => {
    const { steps } = trace(buildGame(REGEN.fixture, REGEN.scenario, REGEN.seed), "regen", {
      defense: REGEN.defense,
      explore: REGEN.explore,
    });
    const fired = firstStep(
      steps,
      (e) => e.type === "abilityResolved" && e.abilityId === "44001a.the-regeneratin-degenerate",
    )!;
    expect(fired).toBeDefined();
    expect(fired.events.some((e) => e.type === "accelerationTokenAdded")).toBe(true);
    expect(fired.events.some((e) => e.type === "formChanged")).toBe(true);
    expect(fired.events.some((e) => e.type === "characterDefeated" && e.instanceId === identityOf(fired.after))).toBe(
      false,
    );
    expect(fired.after.players[0]!.identity.form).toBe("alterEgo");
    expect(fired.after.players[0]!.eliminated).toBeFalsy();
  }, 120_000);
});

describe("findings fixed (each was pinned with it.fails while the defect existed)", () => {
  // F1. domino-pool / Morlock Siege / seed 9 / hero-ready / explore 2 never ended: after 3000 commands the game was still
  // in round 4 with the same prompt open. Lady Deadpool (44016, "When Defeated: Defeat a non-ELITE minion.") is under
  // 'Pool-ized (44041), so she is a minion engaged with Domino, and Domino's basic attack defeats her. Her When Defeated
  // resolves while she is still in play (RRG 1.8 "When Defeated Abilities", p. 48: "A defeated card leaves play after its
  // When Defeated ability is resolved"), she was the only non-ELITE minion, so she was offered as her own target; choosing
  // her defeated her again, which triggered her When Defeated again, for ever. Fixed in the engine: a card already
  // defeated cannot be defeated again and is no target for a defeat (`alreadyDefeated`, RRG 1.8 "Defeat", p. 15).
  it("Lady Deadpool, a 'Pool-ized minion defeated by an attack, resolves her When Defeated once per defeat and the game ends", () => {
    let run = 0;
    let longest = 0;
    const defeated = new Map<string, number>();
    const resolved = new Map<string, number>();
    const played = drive(buildGame("domino-pool", "morlock-siege", 9), "lady-deadpool-loop", {
      defense: "hero-ready",
      explore: 2,
      checkInvariants: true,
      onStep: (before, _command, _after, events) => {
        const prompt = before.pendingChoice?.prompt;
        run = prompt?.kind === "chooseTarget" && prompt.slot === "minion" ? run + 1 : 0;
        longest = Math.max(longest, run);
        for (const event of events) {
          if (event.type === "characterDefeated" && event.cardId === "44016")
            defeated.set(event.instanceId, (defeated.get(event.instanceId) ?? 0) + 1);
          if (event.type === "abilityResolved" && event.abilityId === "44016.when-defeated")
            resolved.set(event.instanceId, (resolved.get(event.instanceId) ?? 0) + 1);
        }
      },
    });
    expect(played.outcome).toBeTruthy();
    expect(longest).toBeLessThan(5);
    const defeats = [...defeated.values()].reduce((sum, count) => sum + count, 0);
    const resolutions = [...resolved.values()].reduce((sum, count) => sum + count, 0);
    expect(defeats).toBeGreaterThanOrEqual(1);
    expect(resolutions).toBe(defeats);
  }, 120_000);
});
