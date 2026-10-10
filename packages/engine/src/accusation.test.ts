/**
 * docs/phase7-wave9.md §3.29 (b): the accusation over an evidence grid. `EffectSpec accuse` (the guess), `EffectSpec
 * identifyMole` (the hidden pile turned faceup and compared), `GameState.accusation`, and its three readers: `TargetQuery
 * accusation`, `ValueSpec accusationWrongGuesses`, `Predicate accusedWrong`.
 *
 * Sources: MC50 p. 19, "The Accusation": "the players must make an accusation by choosing a combination of means,
 * motive, and opportunity that has not been crossed out in the campaign log. Each combination is listed underneath a
 * board member. This board member is the **accused**. Next, the players take the evidence cards from the A.I.M.
 * envelope and find the board member associated with the combination … This board member is the **mole**. They compare
 * the mole and its means, motive, and opportunity to their guesses." … "place a secret counter on each board member for
 * each guess (means, motive, opportunity, and board member) they got wrong. Additionally, if they accused the wrong
 * board member, they must place secret counters on that board member". MC50 p. 18: a gained evidence card crosses out
 * "all combinations of means, motive, and opportunity in the campaign log that use the icon shown" on it.
 *
 * Synthetic cards only: nine clue cards (three of each kind) dealt into the piles "sealed" and "open" by a main
 * scheme's Setup, three Suspect environments whose other faces are attachments, and a grid of 27 rows in which a row's
 * suspect follows its means and motive alone, so two rows that differ only in their opportunity share a suspect.
 */

import {
  cardId,
  cycleId,
  encounterSetId,
  EVIDENCE_KINDS,
  flat,
  setCode,
  trait,
  unerrataedText,
  type AnyCard,
  type CardId,
  type EvidenceCard,
  type EvidenceCombination,
  type EvidenceKind,
} from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { evidenceRowId, openEvidenceRows } from "./accusation.js";
import { replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { evaluate, resolveValue } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession, runCommandsPicking } from "./testing/drive.js";
import { stubAttachment, stubEnvironment, stubMainScheme, stubSupport } from "./testing/fixtures.js";
import {
  DEFAULT_CARDS,
  DEFAULT_DECK,
  defaultPick,
  HERO,
  seatIdentities,
  TREACHERY,
  VILLAIN,
} from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, P1, playerCardIntoPlay } from "./testing/wave3.js";
import { sealHiddenPiles } from "./visibility.js";

const SEALED = "sealed";
const OPEN = "open";
const CLUES = "clues";
const SUSPECT = trait("SUSPECT");

const clue = (id: string, evidence: EvidenceKind): EvidenceCard => ({
  id: cardId(id),
  name: id,
  setCode: setCode("stub"),
  cycleId: cycleId("stub"),
  collectorNumber: id,
  quantityInSet: 1,
  unique: false,
  type: "evidence",
  evidence,
  encounterSetIds: [encounterSetId(CLUES)],
  traits: [],
  text: unerrataedText(""),
  abilities: [],
});
const CLUE_CARDS = EVIDENCE_KINDS.flatMap((kind) => [0, 1, 2].map((n) => clue(`clue-${kind}-${n}`, kind)));
const clueId = (kind: EvidenceKind, n: number): CardId => cardId(`clue-${kind}-${n % 3}`);
const indexOf = (id: CardId): number => Number(id.slice(-1));

const faces = <A extends AnyCard, B extends AnyCard>(a: A, b: B): readonly [A, B] => [
  { ...a, otherFaceId: b.id as CardId },
  { ...b, otherFaceId: a.id as CardId },
];
const suspect = (n: number) =>
  faces(
    stubEnvironment({ id: `suspect-${n}`, traits: [SUSPECT] }),
    stubAttachment({ id: `suspect-${n}-turned`, attachesTo: { kind: "villain" }, keywords: [{ name: "permanent" }] }),
  );
const SUSPECTS = [suspect(0), suspect(1), suspect(2)];
const SUSPECT_IDS = SUSPECTS.map(([front]) => front.id);

/** Row (means i, motive j, opportunity k) is listed under suspect (i + j) mod 3: nine rows per suspect. */
const rowOf = (i: number, j: number, k: number): EvidenceCombination => ({
  means: clueId("means", i),
  motive: clueId("motive", j),
  opportunity: clueId("opportunity", k),
  boardMember: SUSPECT_IDS[(i + j) % 3]!,
});
const GRID: readonly EvidenceCombination[] = [0, 1, 2].flatMap((i) =>
  [0, 1, 2].flatMap((j) => [0, 1, 2].map((k) => rowOf(i, j, k))),
);

const one = { kind: "const", value: 1 } as const;
const each = (query: object): TargetRef => ({ kind: "each", query }) as TargetRef;
const theAccused = each({ accusation: "accused" });
const theMole = each({ accusation: "mole" });
const add = (target: TargetRef, counterType: string, amount: ValueSpec): EffectSpec => ({
  kind: "addCounters",
  target,
  counterType,
  amount,
});
const action = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(id, { trigger: { kind: "action" }, effects });

const CASE_SETUP = stubAbility("case.setup", {
  trigger: { kind: "setup" },
  effects: [{ kind: "dealHiddenPiles", from: CLUES, groupBy: "evidenceKind", onePerGroupTo: SEALED, restTo: OPEN }],
});
/** "Action: Make an accusation." */
const ACCUSE = action("desk.accuse", [{ kind: "accuse", player: { kind: "firstPlayer" }, grid: GRID }]);
/**
 * "Action: Use the cards in the sealed pile to identify the mole. For each guess you got wrong, place 1 secret counter
 * on each Suspect. If you accused the wrong suspect, place 3 secret counters on the accused."
 */
const IDENTIFY = action("desk.identify", [
  { kind: "identifyMole", hidden: SEALED, grid: GRID },
  add(each({ trait: SUSPECT }), "secret", { kind: "accusationWrongGuesses" }),
  { kind: "if", condition: { kind: "accusedWrong" }, then: [add(theAccused, "secret", { kind: "const", value: 3 })] },
]);
/** "Action: Place 1 named counter on the mole and 1 charged counter on the accused." (another ability, later) */
const NAME = action("desk.name", [add(theMole, "named", one), add(theAccused, "charged", one)]);
/** "Action: Flip the mole." */
const TURN = action("desk.turn", [{ kind: "flipCard", target: theMole }]);
/** "Action: Gain 2 cards from the open pile." */
const GAIN_TWO = action("desk.gain-two", [
  { kind: "gainFromHiddenPile", pile: OPEN, count: { kind: "const", value: 2 } },
]);
/** "Action: Use the cards in the nowhere pile to identify the mole." (a pile nobody prepared) */
const IDENTIFY_NOWHERE = action("desk.identify-nowhere", [{ kind: "identifyMole", hidden: "nowhere", grid: GRID }]);

const ABILITIES = [ACCUSE, IDENTIFY, NAME, TURN, GAIN_TWO, IDENTIFY_NOWHERE];
const CASE = stubMainScheme({
  id: "case",
  stages: [
    { startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), aSideAbilities: [CASE_SETUP.ref] },
  ],
});
const DESK = stubSupport({ id: "desk", cost: 0, abilities: ABILITIES.map((ability) => ability.ref) });
const deps: EngineDeps = depsOf(CASE_SETUP, ...ABILITIES);

interface Table {
  readonly state: GameState;
  readonly desk: InstanceId;
  /** The three Suspect environments in the villain's area, by suspect number. */
  readonly suspects: readonly InstanceId[];
  /** The row the sealed pile makes, read with the engine's eyes: (means, motive, opportunity) numbers. */
  readonly truth: readonly [number, number, number];
}

function table(seed = 21, players: 1 | 2 = 1): Table {
  const identities = seatIdentities(HERO, players);
  const created = createGame(
    {
      seed,
      cards: [...DEFAULT_CARDS, ...identities.slice(1), CASE, DESK, ...CLUE_CARDS, ...SUSPECTS.flat()],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: CASE.id,
      encounterDeck: [...copiesOf(TREACHERY.id, 30), ...SUSPECT_IDS],
      players: identities.map((identity) => ({ identityCardId: identity.id, deck: [...DEFAULT_DECK, DESK.id] })),
    },
    deps,
  );
  if (!created.ok) throw new Error(created.error.message);
  let state = driveSession(startSession(created.state), deps).session.state;
  const suspects: InstanceId[] = [];
  for (const id of SUSPECT_IDS) {
    const placed = encounterCardInVillainArea(state, id);
    state = placed.state;
    suspects.push(placed.id);
  }
  const desk = playerCardIntoPlay(state, DESK.id);
  const sealed = desk.state.hiddenPiles![SEALED]!;
  return {
    state: desk.state,
    desk: desk.id,
    suspects,
    truth: [indexOf(sealed[0]!), indexOf(sealed[1]!), indexOf(sealed[2]!)],
  };
}

const useCommand = (t: Table, ability: { readonly ref: { readonly id: string } }) =>
  ({ type: "useAbility", playerId: P1, cardInstanceId: t.desk, abilityId: ability.ref.id, payment: [] }) as never;
/** Uses the Desk's abilities in order; an `accuse` prompt is answered with `row`, every other with the default. */
const use = (
  t: Table,
  state: GameState,
  abilities: readonly { readonly ref: { readonly id: string } }[],
  row?: EvidenceCombination,
) =>
  runCommandsPicking(
    state,
    deps,
    (current) => (current.pendingChoice?.prompt.kind === "accuse" && row ? [evidenceRowId(row)] : defaultPick(current)),
    ...abilities.map((ability) => useCommand(t, ability)),
  );
const secrets = (state: GameState, t: Table) => t.suspects.map((id) => state.instances[id]!.counters["secret"] ?? 0);
const counter = (state: GameState, t: Table, type: string) =>
  t.suspects.map((id) => state.instances[id]!.counters[type] ?? 0);
const context = { selfInstanceId: null, controllerId: P1, event: null, bindings: {} } as const;
const wrongGuesses = (state: GameState) => resolveValue(state, { kind: "accusationWrongGuesses" }, context);
const accusedWrong = (state: GameState) => evaluate(state, { kind: "accusedWrong" }, context);
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((event): event is Extract<GameEvent, { type: T }> => event.type === type);
const expectReplays = (session: GameSession): void => {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
};
describe("§3.29 (b) the accusation: choosing a combination (MC50 p. 19)", () => {
  it("with no evidence gained all 27 rows are offered, in the grid's order, each under its 3 card ids", () => {
    const t = table();
    const choice = runUntilAccusePrompt(t, t.state).pendingChoice!;
    expect(choice.prompt).toEqual({ kind: "accuse", grid: GRID, crossedOut: [] });
    expect(choice.playerId).toBe(P1);
    expect([choice.minSelections, choice.maxSelections]).toEqual([1, 1]);
    expect(choice.options.map((option) => option.optionId)).toEqual(GRID.map(evidenceRowId));
    expect(choice.options[0]!.ref).toEqual({ kind: "cardDefinition", cardId: SUSPECT_IDS[0] });
    expect(choice.options[0]!.optionId).toBe("clue-means-0+clue-motive-0+clue-opportunity-0");
  });

  it("the chosen row is recorded as the accused and logged; no pile is read: 3 cards stay sealed and no mole is named", () => {
    const t = table();
    const row = rowOf(1, 2, 0);
    const { state, events, session } = use(t, t.state, [ACCUSE], row);
    expect(state.accusation).toEqual({ accused: row });
    expect(ofType(events, "accusationMade")).toEqual([{ type: "accusationMade", playerId: P1, accused: row }]);
    expect(state.hiddenPiles).toEqual(t.state.hiddenPiles);
    expect(ofType(events, "hiddenPileRevealed")).toEqual([]);
    expect([wrongGuesses(state), accusedWrong(state)]).toEqual([0, false]);
    // Another ability names the accused (suspect (1 + 2) mod 3 = 0) and finds no mole yet.
    const named = use(t, state, [NAME]).state;
    expect(counter(named, t, "charged")).toEqual([1, 0, 0]);
    expect(counter(named, t, "named")).toEqual([0, 0, 0]);
    expectReplays(session);
  });

  it("2 gained cards cross out every row with either: 27 rows drop to 12 (2 kinds) or 9 (1 kind), none holding a gained card", () => {
    for (const seed of [21, 22, 23, 24]) {
      const t = table(seed);
      const gained = use(t, t.state, [GAIN_TWO]).state;
      const faceup = gained.revealedPileCards![OPEN]!;
      expect(faceup).toHaveLength(2);
      const choice = runUntilAccusePrompt(t, gained).pendingChoice!;
      const sameKind = faceup[0]!.slice(0, -2) === faceup[1]!.slice(0, -2);
      expect(choice.options).toHaveLength(sameKind ? 9 : 12);
      for (const option of choice.options) for (const id of faceup) expect(option.optionId).not.toContain(id);
      expect(choice.prompt).toEqual({ kind: "accuse", grid: GRID, crossedOut: faceup });
      expect(openEvidenceRows(sealHiddenPiles(gained), GRID).map(evidenceRowId)).toEqual(
        choice.options.map((option) => option.optionId),
      );
      // The row the sealed pile makes is never crossed out.
      expect(choice.options.map((option) => option.optionId)).toContain(evidenceRowId(rowOf(...t.truth)));
    }
  });

  it("a crossed-out row is not an answer: the choice is refused", () => {
    const t = table();
    const gained = use(t, t.state, [GAIN_TWO]).state;
    const crossed = GRID.find((row) => Object.values(row).includes(gained.revealedPileCards![OPEN]![0]!))!;
    expect(() => use(t, gained, [ACCUSE], crossed)).toThrow();
  });

  it("all 6 open cards gained: 1 row is left, nobody is asked, and it is accused", () => {
    const t = table();
    const gained = use(t, t.state, [GAIN_TWO, GAIN_TWO, GAIN_TWO]).state;
    expect(gained.hiddenPiles![OPEN]).toEqual([]);
    const { state, events } = use(t, gained, [ACCUSE]);
    expect(ofType(events, "choiceRequested").filter((e) => e.choice.prompt.kind === "accuse")).toEqual([]);
    expect(state.accusation).toEqual({ accused: rowOf(...t.truth) });
  });

  it("the prompt does not depend on what is sealed: seeds 1 to 12 ask the same 27 rows", () => {
    const prompts = new Set<string>();
    const truths = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const t = table(seed);
      truths.add(t.truth.join());
      const choice = runUntilAccusePrompt(t, t.state).pendingChoice!;
      prompts.add(JSON.stringify([choice.prompt, choice.options]));
    }
    expect(truths.size).toBeGreaterThan(3);
    expect(prompts.size).toBe(1);
  });

  it("a second accusation replaces the first", () => {
    const t = table();
    const first = use(t, t.state, [ACCUSE], rowOf(0, 1, 2)).state;
    const second = use(t, first, [ACCUSE], rowOf(2, 2, 2));
    expect(second.state.accusation).toEqual({ accused: rowOf(2, 2, 2) });
    expect(ofType(second.events, "accusationMade")).toHaveLength(1);
  });
});

describe("§3.29 (b) identifying the mole and counting the wrong guesses (MC50 p. 19)", () => {
  it("a correct accusation: the pile is turned faceup, the mole is the accused, 0 wrong guesses and no counter placed", () => {
    const t = table();
    const row = rowOf(...t.truth);
    const { state, events, session } = use(t, t.state, [ACCUSE, IDENTIFY], row);
    expect(state.hiddenPiles![SEALED]).toEqual([]);
    expect(state.revealedPileCards![SEALED]).toEqual([row.means, row.motive, row.opportunity]);
    expect(state.accusation).toEqual({ accused: row, mole: row, wrong: [] });
    expect(secrets(state, t)).toEqual([0, 0, 0]);
    expect([wrongGuesses(state), accusedWrong(state)]).toEqual([0, false]);
    const types = events.map((event) => event.type);
    expect(types.indexOf("hiddenPileRevealed")).toBeLessThan(types.indexOf("moleIdentified"));
    expect(ofType(events, "moleIdentified")).toEqual([
      { type: "moleIdentified", pile: SEALED, accused: row, mole: row, wrong: [] },
    ]);
    expectReplays(session);
  });

  it("1 wrong card under the right suspect: 1 wrong guess, 1 secret counter on each of the 3, none extra on the accused", () => {
    const t = table();
    const [i, j, k] = t.truth;
    const { state } = use(t, t.state, [ACCUSE, IDENTIFY], rowOf(i, j, k + 1));
    expect(state.accusation?.wrong).toEqual(["opportunity"]);
    expect([wrongGuesses(state), accusedWrong(state)]).toEqual([1, false]);
    expect(secrets(state, t)).toEqual([1, 1, 1]);
  });

  it("2 wrong cards that still name the right suspect: 2 wrong guesses, 2 counters on each", () => {
    const t = table();
    const [i, j, k] = t.truth;
    const { state } = use(t, t.state, [ACCUSE, IDENTIFY], rowOf(i + 1, j + 2, k));
    expect(state.accusation?.wrong).toEqual(["means", "motive"]);
    expect(accusedWrong(state)).toBe(false);
    expect(secrets(state, t)).toEqual([2, 2, 2]);
  });

  it("1 wrong card that names another suspect: 2 wrong guesses (the card and the board member), 2 on each and 3 more on the accused", () => {
    const t = table();
    const [i, j, k] = t.truth;
    const { state } = use(t, t.state, [ACCUSE, IDENTIFY], rowOf(i + 1, j, k));
    expect(state.accusation?.wrong).toEqual(["means", "boardMember"]);
    expect([wrongGuesses(state), accusedWrong(state)]).toEqual([2, true]);
    const accused = (i + 1 + j) % 3;
    expect(secrets(state, t)).toEqual([0, 1, 2].map((n) => (n === accused ? 5 : 2)));
  });

  it("everything wrong: 4 wrong guesses, 4 counters on each suspect and 3 more on the accused (7)", () => {
    const t = table();
    const [i, j, k] = t.truth;
    const { state, events } = use(t, t.state, [ACCUSE, IDENTIFY], rowOf(i + 1, j + 1, k + 1));
    expect(state.accusation?.wrong).toEqual(["means", "motive", "opportunity", "boardMember"]);
    expect(wrongGuesses(state)).toBe(4);
    const accused = (i + j + 2) % 3;
    expect(secrets(state, t)).toEqual([0, 1, 2].map((n) => (n === accused ? 7 : 4)));
    expect(ofType(events, "moleIdentified")[0]!.wrong).toHaveLength(4);
  });

  it("the mole and the accused are read by a later ability, and the mole is still the mole on its other face", () => {
    const t = table();
    const [i, j, k] = t.truth;
    const mole = (i + j) % 3;
    const accused = (i + j + 1) % 3;
    const identified = use(t, t.state, [ACCUSE, IDENTIFY], rowOf(i + 1, j, k)).state;
    const named = use(t, identified, [NAME]).state;
    expect(counter(named, t, "named")).toEqual([0, 1, 2].map((n) => (n === mole ? 1 : 0)));
    expect(counter(named, t, "charged")).toEqual([0, 1, 2].map((n) => (n === accused ? 1 : 0)));
    const turned = use(t, named, [TURN]).state;
    expect(turned.instances[t.suspects[mole]!]!.cardId).toBe(SUSPECTS[mole]![1].id);
    expect(turned.instances[t.suspects[mole]!]!.attachedTo).toBe(turned.activeVillainId);
    // A flip to another card type discards its counters (RRG 1.8 "Flip", p. 20), so 1 here is the new one.
    const again = use(t, turned, [NAME]).state;
    expect(again.instances[t.suspects[mole]!]!.counters["named"]).toBe(1);
    expect(again.instances[t.suspects[accused]!]!.counters["charged"]).toBe(2);
  });

  it("with no accusation made the mole is still identified, and no guess is wrong", () => {
    const t = table();
    const row = rowOf(...t.truth);
    const { state, events } = use(t, t.state, [IDENTIFY]);
    expect(state.accusation).toEqual({ mole: row, wrong: [] });
    expect(secrets(state, t)).toEqual([0, 0, 0]);
    expect(ofType(events, "moleIdentified")).toEqual([
      { type: "moleIdentified", pile: SEALED, accused: null, mole: row, wrong: [] },
    ]);
    expect(counter(use(t, state, [NAME]).state, t, "charged")).toEqual([0, 0, 0]);
  });

  it("a pile nobody prepared names no mole: the accusation stands as it was and the log says so", () => {
    const t = table();
    const row = rowOf(0, 0, 0);
    const { state, events } = use(t, t.state, [ACCUSE, IDENTIFY_NOWHERE], row);
    expect(state.accusation).toEqual({ accused: row });
    expect(state.hiddenPiles).toEqual(t.state.hiddenPiles);
    expect(ofType(events, "moleIdentified")).toEqual([
      { type: "moleIdentified", pile: "nowhere", accused: row, mole: null, wrong: [] },
    ]);
  });

  it("with 2 players the first player is asked, and a game with no accusation has no accusation field", () => {
    const t = table(21, 2);
    expect("accusation" in t.state).toBe(false);
    const choice = runUntilAccusePrompt(t, t.state).pendingChoice!;
    expect(choice.playerId).toBe(t.state.firstPlayerId);
  });
});

/** Uses the accuse ability and stops at its prompt. */
function runUntilAccusePrompt(t: Table, state: GameState): GameState {
  let session = startSession(state);
  const stop = Symbol("accuse prompt");
  try {
    driveSession(session, deps, [useCommand(t, ACCUSE)], (current) => {
      if (current.pendingChoice?.prompt.kind === "accuse") {
        session = { ...session, state: current };
        throw stop;
      }
      return defaultPick(current);
    });
  } catch (error) {
    if (error !== stop) throw error;
    return session.state;
  }
  throw new Error("no accuse prompt was asked");
}
