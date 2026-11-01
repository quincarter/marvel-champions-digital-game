/**
 * docs/competitive-mode-plan.md §3.4 and §4 task 7 (docs/phase7-wave10.md §3.5): the DSL word `enemyTeamChooses`, the
 * chooser of a choice a card gives to "the enemy team". The engine's `enemy-team-authority.test.ts` reads the same spec
 * on a two-team state.
 *
 * Sources: MC56 p. 6 (cooperative play): "Any rule or ability that refers to 'the enemy team' refers to the players.
 * Resolve these abilities using the grim rule: Imagine what an opponent would do if it were their choice." The owner's
 * decision (2026-10-11, question 6, answer A): the first player makes the choice, in a prompt marked as the enemy
 * team's, and the log records it as made for the enemy team.
 *
 * The games here are real Core games against Rhino, which is not a Civil War scenario: the When Revealed of Hard to
 * Keep Down (01104) is rebound to the ability under test, so it resolves through a real villain phase reveal.
 */

import { describe, expect, it } from "vitest";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  applyCommand,
  ENEMY_TEAM_CHOICE_INSTRUCTION,
  ENEMY_TEAM_CHOICE_RULE,
  replay,
  sessionApply,
  SINGLE_TEAM,
  startSession,
  type AbilityDefinition,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameSession,
  type GameState,
  type InstanceId,
  type PendingChoice,
  type PlayerId,
  type PlayerRef,
} from "@mc/engine";
import { CORE_DEPS } from "../core/index.js";
import { coreScenario } from "../core/setup.js";
import {
  endTurn,
  firstLegal,
  identityOf as identityInstance,
  inst,
  instancesOf,
  P1,
  P2,
  P3,
  patchInstance,
  startCoreGame,
  toHero,
} from "../testing/harness.js";
import { whenRevealed } from "./abilities.js";
import { chooseCards, chooseTarget, dealDamage, encounterCards } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, enemyTeamChooses, firstPlayer, query, you } from "./values.js";

const STARTERS = ["core-spider-man-justice", "core-captain-marvel-leadership", "core-iron-man-aggression"] as const;
const HARD_TO_KEEP_DOWN = "01104";

/** "<chooser> chooses an identity. Deal 2 damage to it." */
const chooseAndHit = (chooser: PlayerRef): AbilityDefinition =>
  whenRevealed(chooseTarget("picked", query("identity"), { chooser }), dealDamage(2, chosen("picked")));
const GRIM = chooseAndHit(enemyTeamChooses);

const depsWith = (definition: AbilityDefinition): EngineDeps => ({
  abilities: { ...CORE_DEPS.abilities, [`${HARD_TO_KEEP_DOWN}.when-revealed`]: definition },
});

/**
 * Orders the encounter deck so the villain phase deals Hard to Keep Down as its `position`th card after the `boosts`
 * boost cards of the villain's activations, and no other copy of it comes up before.
 */
function stackReveal(state: GameState, boosts: number, position: number): GameState {
  const piles = activeEncounterDeck(state);
  const copies = instancesOf(state, HARD_TO_KEEP_DOWN).filter((id) => piles.deck.includes(id));
  const rest = piles.deck.filter((id) => !copies.includes(id));
  const before = boosts + position - 1;
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [activeEncounterDeckId(state)]: {
        ...piles,
        deck: [...rest.slice(0, before), copies[0]!, ...rest.slice(before), ...copies.slice(1)],
      },
    },
  };
}

interface Run {
  readonly session: GameSession;
  readonly events: readonly GameEvent[];
}

const enemyTeamChoice = (state: GameState): boolean => state.pendingChoice?.authority === "enemyTeam";
const revealChoice = (state: GameState): boolean =>
  state.pendingChoice?.prompt.kind === "chooseTarget" && state.step.phase === "villain";

/** Applies the commands through a session, answering every choice with `firstLegal` until `stop` (or none is left). */
function drive(
  from: GameSession,
  deps: EngineDeps,
  commands: readonly Command[],
  stop: (state: GameState) => boolean,
): Run {
  let session = from;
  const events: GameEvent[] = [];
  const apply = (command: Command): void => {
    const result = sessionApply(session, command, deps);
    if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.code}: ${result.error.message}`);
    session = result.session;
    events.push(...result.events);
  };
  const settle = (): void => {
    for (let guard = 0; session.state.pendingChoice && !session.state.outcome && !stop(session.state); guard++) {
      if (guard > 500) throw new Error("choices did not settle");
      const choice = session.state.pendingChoice;
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: firstLegal(session.state),
      });
    }
  };
  settle();
  for (const command of commands) {
    if (stop(session.state)) break;
    apply(command);
    settle();
  }
  return { session, events };
}

const answerAs = (choice: PendingChoice, player: PlayerId, optionId: string): Command => ({
  type: "resolveChoice",
  playerId: player,
  choiceId: choice.choiceId,
  selectedOptionIds: [optionId],
});

const optionIds = (choice: PendingChoice): readonly string[] => choice.options.map((option) => option.optionId);
const damageOn = (state: GameState, id: InstanceId): number => inst(state, id).damage;

/** A Rhino game at the first turn, the deck stacked so the seat at `position` in the deal reveals the card. */
function rhinoGame(definition: AbilityDefinition, players: 1 | 3, position: number) {
  const deps = depsWith(definition);
  const config = coreScenario("rhino", {
    players: STARTERS.slice(0, players).map((starterDeckId) => ({ starterDeckId })),
    seed: 11,
  });
  const state = stackReveal(startCoreGame(config, deps), players, position);
  const seats = [P1, P2, P3].slice(0, players);
  return { deps, state, seats, turns: seats.map((seat) => endTurn(seat)) };
}

describe("the builder and the validator", () => {
  it("the word is one plain record, and a script with it survives serialization unchanged", () => {
    expect(enemyTeamChooses).toEqual({ kind: "enemyTeamDecider" });
    expect(JSON.parse(JSON.stringify(GRIM))).toEqual(GRIM);
    expect(GRIM.effects).toEqual([
      {
        kind: "chooseTarget",
        slot: "picked",
        query: { categories: ["identity"] },
        chooser: { kind: "enemyTeamDecider" },
      },
      { kind: "dealDamage", target: { kind: "slot", slot: "picked" }, amount: { kind: "const", value: 2 } },
    ]);
  });

  it("accepts it as a chooser and refuses it where a card is needed", () => {
    expect(validateDefinition(GRIM)).toEqual([]);
    expect(validateDefinition(whenRevealed(dealDamage(1, enemyTeamChooses as never)))).toEqual([
      "effects[0] dealDamage: target needs a card, and enemyTeamChooses is the player who chooses for the enemy team",
    ]);
  });
});

describe("a real 3-player cooperative game against Rhino", () => {
  it("player 2 reveals the card: the first player is asked, in a prompt marked as the enemy team's", () => {
    const game = rhinoGame(GRIM, 3, 2);
    const run = drive(startSession(game.state), game.deps, game.turns, enemyTeamChoice);
    const state = run.session.state;
    const choice = state.pendingChoice!;
    expect(state.step.phase).toBe("villain");
    expect(state.firstPlayerId).toBe(P1);
    expect(choice.playerId).toBe(P1);
    expect(choice.authority).toBe("enemyTeam");
    expect(choice.onBehalfOf).toEqual({ kind: "enemyTeam", teamId: SINGLE_TEAM, facingPlayerId: P2 });
    expect(choice.prompt.kind).toBe("chooseTarget");
    expect([choice.minSelections, choice.maxSelections]).toEqual([1, 1]);
    // Every identity is offered; the engine ranks none of them.
    expect([...optionIds(choice)].sort()).toEqual(game.seats.map((seat) => identityInstance(state, seat)).sort());
    expect(run.events.filter((e) => e.type === "choiceRequested" && e.choice.authority === "enemyTeam")).toEqual([
      { type: "choiceRequested", choice },
    ]);
    expect(ENEMY_TEAM_CHOICE_INSTRUCTION).toBe("Choose as the enemy team would.");
    expect(ENEMY_TEAM_CHOICE_RULE).toBe("Imagine what an opponent would do if it were their choice.");
  });

  it("the revealing player and the third player are refused; the first player's answer deals the 2 damage", () => {
    const game = rhinoGame(GRIM, 3, 2);
    const run = drive(startSession(game.state), game.deps, game.turns, enemyTeamChoice);
    const before = run.session.state;
    const choice = before.pendingChoice!;
    const target = identityInstance(before, P3);
    for (const seat of [P2, P3]) {
      const refused = applyCommand(before, answerAs(choice, seat, target), game.deps);
      expect(refused.ok).toBe(false);
      if (refused.ok) continue;
      expect(refused.error.code).toBe("invalid_choice");
      expect(refused.error.message).toBe("p1 must make this choice");
    }
    const answered = sessionApply(run.session, answerAs(choice, P1, target), game.deps);
    if (!answered.ok) throw new Error(answered.error.message);
    expect(answered.events.filter((e) => e.type === "choiceResolved")[0]).toEqual({
      type: "choiceResolved",
      choiceId: choice.choiceId,
      playerId: P1,
      selectedOptionIds: [target],
      onBehalfOf: { kind: "enemyTeam", teamId: SINGLE_TEAM, facingPlayerId: P2 },
    });
    const after = drive(answered.session, game.deps, [], revealChoice).session.state;
    expect(damageOn(after, target)).toBe(damageOn(before, target) + 2);
    for (const seat of [P1, P2]) {
      const id = identityInstance(before, seat);
      expect(damageOn(after, id)).toBe(damageOn(before, id));
    }
  });

  it("the game replays to the same state from its log", () => {
    const game = rhinoGame(GRIM, 3, 2);
    const run = drive(startSession(game.state), game.deps, game.turns, enemyTeamChoice);
    const choice = run.session.state.pendingChoice!;
    const answered = sessionApply(
      run.session,
      answerAs(choice, P1, identityInstance(run.session.state, P2)),
      game.deps,
    );
    if (!answered.ok) throw new Error(answered.error.message);
    const finished = drive(answered.session, game.deps, [], () => false).session;
    const replayed = replay(finished.log, game.deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(finished.state);
    // Stopped at the choice, the replay parks the same choice with the same mark.
    const parked = replay(run.session.log, game.deps);
    if (!parked.ok) throw new Error(parked.error.message);
    expect(parked.state.pendingChoice).toEqual(choice);
  });

  it("the first player is eliminated before the reveal: the choice goes where the token went", () => {
    const game = rhinoGame(GRIM, 3, 2);
    // Spider-Man in hero form with 1 hit point left: Rhino's attack in this villain phase defeats him undefended.
    const hero = identityInstance(game.state, P1);
    const flipped = drive(startSession(game.state), game.deps, [toHero(P1)], () => false).session.state;
    const dying = patchInstance(flipped, hero, { damage: 9 });
    const run = drive(startSession(dying), game.deps, game.turns, enemyTeamChoice);
    const state = run.session.state;
    expect(run.events.filter((e) => e.type === "playerEliminated")).toEqual([
      { type: "playerEliminated", playerId: P1 },
    ]);
    expect(run.events.filter((e) => e.type === "firstPlayerChanged")).toEqual([
      { type: "firstPlayerChanged", playerId: P2 },
    ]);
    // The deal skips the eliminated seat, so the second card dealt is player 3's.
    const choice = state.pendingChoice!;
    expect(choice.playerId).toBe(P2);
    expect(choice.authority).toBe("enemyTeam");
    expect(choice.onBehalfOf).toEqual({ kind: "enemyTeam", teamId: SINGLE_TEAM, facingPlayerId: P3 });
    expect([...optionIds(choice)].sort()).toEqual([identityInstance(state, P2), identityInstance(state, P3)].sort());
    const refused = applyCommand(state, answerAs(choice, P3, identityInstance(state, P2)), game.deps);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.message).toBe("p2 must make this choice");
  });

  it("the same script with no mark keeps today's chooser: 'choose' is the revealing player's own", () => {
    const own = rhinoGame(chooseAndHit(you), 3, 2);
    const asked = drive(startSession(own.state), own.deps, own.turns, revealChoice).session.state.pendingChoice!;
    expect(asked.playerId).toBe(P2);
    expect(asked.authority).toBe("player");
    expect("onBehalfOf" in asked).toBe(false);
    // An encounter card's first-player choice is the existing authority, unmarked.
    const group = rhinoGame(chooseAndHit(firstPlayer), 3, 2);
    const first = drive(startSession(group.state), group.deps, group.turns, revealChoice).session.state.pendingChoice!;
    expect(first.playerId).toBe(P1);
    expect(first.authority).toBe("firstPlayerTargets");
    expect("onBehalfOf" in first).toBe(false);
    // The enemy team's choice offers what those two do.
    const grim = rhinoGame(GRIM, 3, 2);
    const marked = drive(startSession(grim.state), grim.deps, grim.turns, enemyTeamChoice).session.state.pendingChoice!;
    expect(optionIds(marked)).toEqual(optionIds(asked));
    expect(optionIds(marked)).toEqual(optionIds(first));
  });
});

describe("a real solo game against Rhino", () => {
  /** "The enemy team chooses a character. Deal 2 damage to it.": the player's identity or Rhino, so one player is asked. */
  const SOLO = whenRevealed(
    chooseTarget("picked", query(["identity", "villain"]), { chooser: enemyTeamChooses }),
    dealDamage(2, chosen("picked")),
  );

  it("the one player is the first player and chooses for the enemy team", () => {
    const game = rhinoGame(SOLO, 1, 1);
    const run = drive(startSession(game.state), game.deps, game.turns, enemyTeamChoice);
    const state = run.session.state;
    const choice = state.pendingChoice!;
    expect(choice.playerId).toBe(P1);
    expect(choice.authority).toBe("enemyTeam");
    expect(choice.onBehalfOf).toEqual({ kind: "enemyTeam", teamId: SINGLE_TEAM, facingPlayerId: P1 });
    expect([...optionIds(choice)].sort()).toEqual([identityInstance(state, P1), state.activeVillainId].sort());
    const answered = sessionApply(run.session, answerAs(choice, P1, state.activeVillainId), game.deps);
    if (!answered.ok) throw new Error(answered.error.message);
    expect(damageOn(answered.session.state, state.activeVillainId)).toBe(damageOn(state, state.activeVillainId) + 2);
  });

  // docs/phase7-wave10.md section 3.5: "Where there is one candidate there is no prompt" (QA finding F2).
  it("with one candidate the enemy team's choice is forced and nobody is asked; the unmarked script still asks its player", () => {
    const game = rhinoGame(GRIM, 1, 1);
    const run = drive(startSession(game.state), game.deps, game.turns, revealChoice);
    expect(revealChoice(run.session.state)).toBe(false);
    expect(run.events.filter((e) => e.type === "choiceRequested" && e.choice.authority === "enemyTeam")).toEqual([]);
    const picked = run.events.flatMap((e) => (e.type === "targetChosen" && e.slot === "picked" ? [e.instanceIds] : []));
    expect(picked).toEqual([[identityInstance(game.state, P1)]]);
    const again = replay(run.session.log, game.deps);
    expect(again.ok && again.state).toEqual(run.session.state);
    const own = rhinoGame(chooseAndHit(you), 1, 1);
    const unmarked = drive(startSession(own.state), own.deps, own.turns, revealChoice).session.state.pendingChoice!;
    expect(optionIds(unmarked)).toEqual([identityInstance(own.state, P1)]);
    expect([unmarked.playerId, unmarked.authority]).toEqual([P1, "player"]);
  });
});

describe("a search the enemy team must make (RRG 1.8 'Search' p. 39: the player chooses only 'if a player finds multiple cards that satisfy the criteria')", () => {
  /** "<chooser> searches the encounter deck and discard pile for <a side scheme>." */
  const search = (chooser: PlayerRef, name?: string): AbilityDefinition =>
    whenRevealed(
      chooseCards("found", encounterCards(["deck", "discard"], query("sideScheme", name ? { name } : {})), {
        min: 1,
        max: 1,
        chooser,
      }),
    );
  const CROWD_CONTROL = "01108"; // one copy in Rhino's encounter deck
  const searchPrompt = (state: GameState): boolean =>
    state.pendingChoice?.prompt.kind === "chooseCards" && state.step.phase === "villain";
  const found = (events: readonly GameEvent[]) =>
    events.flatMap((e) => (e.type === "targetChosen" && e.slot === "found" ? [e.instanceIds] : []));

  it("one card found: it is found without a prompt, and the log records it as any pick", () => {
    const game = rhinoGame(search(enemyTeamChooses, "Crowd Control"), 1, 1);
    const copies = instancesOf(game.state, CROWD_CONTROL);
    expect(copies).toHaveLength(1);
    const run = drive(startSession(game.state), game.deps, game.turns, searchPrompt);
    expect(searchPrompt(run.session.state)).toBe(false);
    expect(run.events.filter((e) => e.type === "choiceRequested" && e.choice.authority === "enemyTeam")).toEqual([]);
    expect(found(run.events)).toEqual([copies]);
    const again = replay(run.session.log, game.deps);
    expect(again.ok && again.state).toEqual(run.session.state);
  });

  it("several cards found: the first player is asked for the enemy team, as before", () => {
    const game = rhinoGame(search(enemyTeamChooses), 1, 1);
    const asked = drive(startSession(game.state), game.deps, game.turns, searchPrompt).session.state.pendingChoice!;
    expect([asked.playerId, asked.authority, asked.minSelections, asked.maxSelections]).toEqual([
      P1,
      "enemyTeam",
      1,
      1,
    ]);
    expect(asked.options.length).toBeGreaterThan(1);
  });

  it("the same one-card search by the player ('search ... for') still shows its prompt: only the enemy team's is resolved for them", () => {
    const game = rhinoGame(search(you, "Crowd Control"), 1, 1);
    const asked = drive(startSession(game.state), game.deps, game.turns, searchPrompt).session.state.pendingChoice!;
    expect([asked.playerId, asked.authority]).toEqual([P1, "player"]);
    expect(optionIds(asked)).toEqual(instancesOf(game.state, CROWD_CONTROL));
  });

  it("no card found: nobody is asked and nothing is bound", () => {
    const game = rhinoGame(search(enemyTeamChooses, "No Such Scheme"), 1, 1);
    const run = drive(startSession(game.state), game.deps, game.turns, searchPrompt);
    expect(searchPrompt(run.session.state)).toBe(false);
    expect(found(run.events)).toEqual([]);
  });
});
