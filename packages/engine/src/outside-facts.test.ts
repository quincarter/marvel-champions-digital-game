/**
 * docs/phase7-wave7.md §3.83: facts from outside the game. Three Deadpool cards read something no game state holds:
 * "if you did not win your previous game of Marvel Champions", "for every minute you were away from the game", "if
 * you have not talked this phase". The engine's rule is the same for all three: the fact is an input. It arrives as
 * setup input (`PlayerSetup.outsideFacts`, read by `Predicate outsideFact`) or as the answer to a `reportFact` choice,
 * which is an ordinary recorded command, so a replayed log reproduces the game without a clock or a profile.
 *
 * Owner decisions, §4.1: Q48 (previous game: snapshotted at setup; none on record is "did not win"), Q49 (minutes:
 * whole minutes, no cap, stored in the log; the player who played the card ends the break), Q50 (talked: a yes/no
 * answer). The Deadpool insert: a forgotten game and a first game both count as not won.
 */

import type { AnyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { playCostOf } from "./actions.js";
import type { PendingChoice } from "./choices.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { REPORTED_FACT_ANSWER, reportedNumberOf, type OutsideFacts } from "./outside-facts.js";
import { mustInstance } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec, PlayerRef, Predicate, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubUpgrade } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, giveCard, HERO, MAIN_SCHEME, VILLAIN } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const controller: PlayerRef = { kind: "controller" };
const eachIdentity: TargetRef = { kind: "each", query: { categories: ["identity"] } };
const varOf = (name: string): ValueSpec => ({ kind: "var", name });
const wonPreviousGame = (player: PlayerRef): Predicate => ({ kind: "outsideFact", fact: "wonPreviousGame", player });

/** Git Gud's shape: cost 2, "reduce the cost to play this card by 2 if you did not win your previous game". */
const DISCOUNT = stubAbility("discounted.constant", {
  trigger: {
    kind: "constant",
    costModifiers: [
      {
        delta: -2,
        appliesTo: { self: true },
        activeIn: "hand",
        while: { kind: "not", of: wonPreviousGame(controller) },
      },
    ],
  },
  effects: [],
});
const DISCOUNTED = stubUpgrade({ id: "discounted", cost: 2, abilities: [DISCOUNT.ref] });

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** Break Time's shape: "heal 1 damage from each identity for every minute you were away from the game". */
const BREAK = action("break", [
  { kind: "reportFact", fact: "minutesAway", player: controller, bind: "break" },
  { kind: "heal", target: eachIdentity, amount: varOf("break.amount") },
]);
const threatUnless = (name: string): EffectSpec => ({
  kind: "if",
  condition: { kind: "not", of: { kind: "varAtLeast", name, amount: 1 } },
  then: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } }],
});
/** The Merc with the Mouth's test: "if you have not talked this phase, …" (here: 1 threat on the main scheme). */
const TALKED = action("talked", [
  { kind: "reportFact", fact: "talkedThisPhase", player: controller, bind: "talked" },
  threatUnless("talked.amount"),
]);
/** A report asked of another player: the one whose seat won its previous game. */
const ASK_THE_WINNER = action("ask-the-winner", [
  {
    kind: "reportFact",
    fact: "talkedThisPhase",
    player: { kind: "where", predicate: wonPreviousGame({ kind: "scoped" }) },
    bind: "talked",
  },
  threatUnless("talked.amount"),
]);
/** A report asked of nobody: 1 threat tells "nobody reported" (`.made` 0) from a report. */
const ASK_NOBODY = action("ask-nobody", [
  { kind: "reportFact", fact: "minutesAway", player: { kind: "where", predicate: { kind: "or", of: [] } }, bind: "m" },
  threatUnless("m.made"),
]);
const ACTIONS = [BREAK, TALKED, ASK_THE_WINNER, ASK_NOBODY];

const deps: EngineDeps = depsOf(DISCOUNT, ...ACTIONS.map((a) => a.ability));
const CARDS: readonly AnyCard[] = [DISCOUNTED, ...ACTIONS.map((a) => a.card)];

function start(outsideFacts: readonly (OutsideFacts | undefined)[] = [], players: 1 | 2 = 2): GameState {
  return gameAtFirstTurn({
    deps,
    cards: CARDS,
    deck: [...copiesOf(DISCOUNTED.id, 2), ...ACTIONS.flatMap((a) => copiesOf(a.card.id, 2))],
    players,
    outsideFacts,
  });
}

const player = (state: GameState, id: PlayerId) => state.players.find((p) => p.playerId === id)!;
const damageOf = (state: GameState, id: PlayerId): number =>
  mustInstance(state, player(state, id).identity.instanceId).damage;
const damaged = (state: GameState, amounts: Readonly<Record<string, number>>): GameState => ({
  ...state,
  instances: Object.fromEntries(
    Object.entries(state.instances).map(([id, instance]) => {
      const owner = state.players.find((p) => p.identity.instanceId === id);
      return [id, owner ? { ...instance, damage: amounts[owner.playerId] ?? 0 } : instance];
    }),
  ),
});
const threat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;

/** `who` plays `card` for 0, up to its `reportFact` choice. */
function atReport(state: GameState, card: (typeof ACTIONS)[number], who: PlayerId = P1): GameSession {
  const given = giveCard(state, who, card.card.id);
  let session = startSession(given.state);
  const apply = (command: Parameters<typeof sessionApply>[1]): void => {
    const result = sessionApply(session, command, deps);
    if (!result.ok) throw new Error(result.error.message);
    session = result.session;
  };
  apply({ type: "playCard", playerId: who, cardInstanceId: given.id, payment: [], attachToInstanceId: null });
  for (let guard = 0; session.state.pendingChoice?.prompt.kind !== "reportFact"; guard++) {
    const choice = session.state.pendingChoice;
    if (!choice || guard > 20) throw new Error("no reportFact choice opened");
    apply({
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: defaultPick(session.state),
    });
  }
  return session;
}

const tryAnswer = (session: GameSession, selectedOptionIds: readonly string[], by?: PlayerId) => {
  const choice = session.state.pendingChoice as PendingChoice;
  return sessionApply(
    session,
    { type: "resolveChoice", playerId: by ?? choice.playerId, choiceId: choice.choiceId, selectedOptionIds },
    deps,
  );
};

/** Answers the open report; later choices take their default. */
function answer(
  session: GameSession,
  selectedOptionIds: readonly string[],
): { readonly session: GameSession; readonly events: readonly GameEvent[] } {
  const result = tryAnswer(session, selectedOptionIds);
  if (!result.ok) throw new Error(result.error.message);
  const rest = driveSession(result.session, deps);
  return { session: rest.session, events: [...result.events, ...rest.events] };
}

const reports = (events: readonly GameEvent[]) => events.filter((e) => e.type === "factReported");

describe("§3.83 a fact known before the game: PlayerSetup.outsideFacts", () => {
  it("is stored per seat; false and absent are both stored as nothing", () => {
    const state = start([{ wonPreviousGame: true }, { wonPreviousGame: false }]);
    expect(player(state, P1).outsideFacts).toEqual({ wonPreviousGame: true });
    expect(player(state, P2).outsideFacts).toBeUndefined();
    expect(player(start(), P1).outsideFacts).toBeUndefined();
  });

  it("the state stays plain data: it survives a JSON round trip unchanged", () => {
    const state = start([{ wonPreviousGame: true }]);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it("the cost of 2 is reduced to 0 for the seat that did not win, and stays 2 for the seat that won", () => {
    const state = start([{ wonPreviousGame: true }, { wonPreviousGame: false }]);
    const mine = giveCard(state, P1, DISCOUNTED.id);
    const theirs = giveCard(mine.state, P2, DISCOUNTED.id);
    expect(playCostOf(theirs.state, P1, mine.id, deps)).toMatchObject({ printed: 2, current: 2 });
    expect(playCostOf(theirs.state, P2, theirs.id, deps)).toMatchObject({ printed: 2, current: 0 });
  });

  it("no fact supplied (a first game, a forgotten game, no history) is 'did not win': the cost is 0", () => {
    const given = giveCard(start([], 1), P1, DISCOUNTED.id);
    expect(playCostOf(given.state, P1, given.id, deps)).toMatchObject({ printed: 2, current: 0 });
  });

  it("setup refuses a fact that is not a boolean", () => {
    const result = createGame(
      {
        seed: 1,
        cards: [...DEFAULT_CARDS],
        villainCardId: VILLAIN.id,
        mainSchemeCardId: MAIN_SCHEME.id,
        encounterDeck: copiesOf("treachery" as never, 20),
        players: [{ identityCardId: HERO.id, deck: DEFAULT_DECK, outsideFacts: { wonPreviousGame: "yes" as never } }],
      },
      deps,
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toContain("outsideFacts.wonPreviousGame must be true or false");
  });
});

describe("§3.83 reportFact minutesAway: a whole number with no upper bound", () => {
  it("asks the player who played the card, alone, with no option list and exactly one selection", () => {
    const session = atReport(damaged(start(), { p1: 5, p2: 9 }), BREAK);
    const choice = session.state.pendingChoice;
    expect(choice).toMatchObject({
      playerId: P1,
      prompt: { kind: "reportFact", fact: "minutesAway", answer: "wholeNumber" },
      options: [],
      minSelections: 1,
      maxSelections: 1,
      ordered: false,
      authority: "player",
    });
    // Nothing is healed while the break runs, and each seat sees the open choice.
    expect(damageOf(session.state, P1)).toBe(5);
    expect(damageOf(session.state, P2)).toBe(9);
    expect(legalActions(session.state, P1, deps)).toEqual({ kind: "choice", choice });
  });

  it("the game holds still while the choice is open: no other command is accepted", () => {
    const session = atReport(start(), BREAK);
    const result = sessionApply(session, { type: "endTurn", playerId: P1 }, deps);
    expect(!result.ok && result.error.code).toBe("choice_pending");
  });

  it.each([
    { minutes: "0", p1: 5, p2: 9 },
    { minutes: "3", p1: 2, p2: 6 },
    { minutes: "7", p1: 0, p2: 2 },
    { minutes: "125", p1: 0, p2: 0 },
  ])("$minutes minutes away: identities at 5 and 9 damage end at $p1 and $p2", ({ minutes, p1, p2 }) => {
    const { session, events } = answer(atReport(damaged(start(), { p1: 5, p2: 9 }), BREAK), [minutes]);
    expect(session.state.pendingChoice).toBeNull();
    expect(damageOf(session.state, P1)).toBe(p1);
    expect(damageOf(session.state, P2)).toBe(p2);
    expect(reports(events)).toEqual([
      { type: "factReported", playerId: P1, fact: "minutesAway", bind: "break", amount: Number(minutes) },
    ]);
  });

  it("only a whole number of 0 or more, written one way, is an answer; only the asked player may give it", () => {
    const session = atReport(start(), BREAK);
    for (const bad of [[], ["-1"], ["1.5"], ["03"], ["+3"], [" 3"], ["3m"], ["yes"], ["1e3"], ["9007199254740992"]]) {
      const result = tryAnswer(session, bad);
      expect(!result.ok && result.error.code, JSON.stringify(bad)).toBe("invalid_choice");
    }
    expect(tryAnswer(session, ["1", "2"]).ok).toBe(false);
    const other = tryAnswer(session, ["3"], P2);
    expect(!other.ok && other.error.message).toContain("p1 must make this choice");
    expect(tryAnswer(session, ["9007199254740991"]).ok).toBe(true);
    expect(tryAnswer(session, ["0"]).ok).toBe(true);
  });

  it("reportedNumberOf reads exactly the canonical spellings", () => {
    expect(reportedNumberOf("0")).toBe(0);
    expect(reportedNumberOf("42")).toBe(42);
    expect(reportedNumberOf("9007199254740991")).toBe(9007199254740991);
    expect(reportedNumberOf("9007199254740992")).toBeNull();
    expect(reportedNumberOf("007")).toBeNull();
    expect(reportedNumberOf("")).toBeNull();
    expect(REPORTED_FACT_ANSWER).toEqual({ minutesAway: "wholeNumber", talkedThisPhase: "yesNo" });
  });

  it("the report is in the log, and replaying the log heals the same amount without asking anyone", () => {
    const { session, events } = answer(atReport(damaged(start(), { p1: 5, p2: 9 }), BREAK), ["4"]);
    expect(session.log.commands.at(-1)).toMatchObject({
      type: "resolveChoice",
      playerId: P1,
      selectedOptionIds: ["4"],
    });
    expect(events).toContainEqual(expect.objectContaining({ type: "choiceResolved", selectedOptionIds: ["4"] }));
    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(session.state);
    expect(replayed.ok && damageOf(replayed.state, P1)).toBe(1);
    expect(replayed.ok && damageOf(replayed.state, P2)).toBe(5);
  });

  it("a different report replays to a different state", () => {
    const base = damaged(start(), { p1: 5, p2: 9 });
    const two = replay(answer(atReport(base, BREAK), ["2"]).session.log, deps);
    const six = replay(answer(atReport(base, BREAK), ["6"]).session.log, deps);
    expect(two.ok && [damageOf(two.state, P1), damageOf(two.state, P2)]).toEqual([3, 7]);
    expect(six.ok && [damageOf(six.state, P1), damageOf(six.state, P2)]).toEqual([0, 3]);
  });
});

describe("§3.83 reportFact talkedThisPhase: yes or no", () => {
  it("offers Yes and No to the asked player, exactly one to be selected", () => {
    const session = atReport(start(), TALKED);
    expect(session.state.pendingChoice).toMatchObject({
      playerId: P1,
      prompt: { kind: "reportFact", fact: "talkedThisPhase", answer: "yesNo" },
      options: [
        { optionId: "yes", label: "Yes", ref: { kind: "none" } },
        { optionId: "no", label: "No", ref: { kind: "none" } },
      ],
      minSelections: 1,
      maxSelections: 1,
      authority: "player",
    });
  });

  it.each([
    { said: "yes", amount: 1, placed: 0 },
    { said: "no", amount: 0, placed: 1 },
  ])("'$said' binds $amount: the 'have not talked' branch places $placed threat", ({ said, amount, placed }) => {
    const before = start();
    const { session, events } = answer(atReport(before, TALKED), [said]);
    expect(threat(session.state) - threat(before)).toBe(placed);
    expect(reports(events)).toEqual([
      { type: "factReported", playerId: P1, fact: "talkedThisPhase", bind: "talked", amount },
    ]);
    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });

  it("anything but yes or no, both at once, or another player's answer is refused", () => {
    const session = atReport(start(), TALKED);
    expect(tryAnswer(session, ["1"]).ok).toBe(false);
    expect(tryAnswer(session, ["maybe"]).ok).toBe(false);
    expect(tryAnswer(session, []).ok).toBe(false);
    expect(tryAnswer(session, ["yes", "no"]).ok).toBe(false);
    expect(tryAnswer(session, ["yes"], P2).ok).toBe(false);
  });

  it("a report asked of another player is that player's alone to answer", () => {
    const before = start([undefined, { wonPreviousGame: true }]);
    const session = atReport(before, ASK_THE_WINNER);
    expect(session.state.pendingChoice).toMatchObject({ playerId: P2, authority: "player" });
    const byP1 = tryAnswer(session, ["yes"], P1);
    expect(!byP1.ok && byP1.error.message).toContain("p2 must make this choice");
    const after = answer(session, ["no"]);
    expect(reports(after.events)).toMatchObject([{ playerId: P2, amount: 0 }]);
    expect(threat(after.session.state) - threat(before)).toBe(1);
  });

  it("with no such player nobody is asked: nothing is reported and <bind>.made is 0", () => {
    const before = start();
    const given = giveCard(before, P1, ASK_NOBODY.card.id);
    const { session, events } = driveSession(startSession(given.state), deps, [
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    ]);
    expect(events.some((e) => e.type === "choiceRequested" && e.choice.prompt.kind === "reportFact")).toBe(false);
    expect(reports(events)).toEqual([]);
    expect(threat(session.state) - threat(before)).toBe(1);
  });
});
