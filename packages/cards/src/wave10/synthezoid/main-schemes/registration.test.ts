import {
  hasKeyword,
  keywordTotal,
  mainSchemeValue,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { competitiveOnlyTexts, validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  inst,
  mainThreat,
  patchInstance,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { codeOf, inPlayCard, piles, types } from "../../../wave9/testing.js";
import { WAVE10_CARDS } from "../../cards.js";
import { IRON_MAN_SCENARIO, WAVE10_DEPS } from "../../testing.js";
import { ungatedStageGame } from "../testing.js";
import { SYNTHEZOID_MAIN_SCHEMES_REGISTRATION, SYNTHEZOID_MAIN_SCHEMES_REGISTRATION_SKIPPED } from "./registration.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * The Synthezoid Smackdown registration main scheme (57005a/b, 57006a/b; docs/phase7-synthezoid.md sections 1.5, 7.5):
 * the A faces and both B faces repeat Civil War stages (57006b reworded, same meaning), so the scripts are Civil War's
 * under new ids.
 * Played in the real `registration-iron-man` scenario (Synthezoid's She-Hulk leader is not scripted yet), the pack's
 * stages chosen by the id of their B faces; they follow Civil War's eight stages on the gathered card (stage pool
 * "side", wave 10 M1), so 57005b is stage index 8 and 57006b is stage index 9.
 */
const ENFORCE_THE_LAW = "57005b";
const MIGHTY_AVENGERS = "57006b";
const CUT_OFF_SUPPORT = "56063b";
const NO_GOING_BACK = "56124b";
const STARK_TOWER = "56072";
/** Iron Man attachments: revealed they attach to him and touch no player (a villain phase adds nothing else). */
const IRON_MAN_ATTACHMENTS = ["56065", "56066", "56067", "56068", "56069"];
const REFS = [
  "57005a.setup",
  "57005b.enforce-the-law-constant",
  "57005b.enforce-the-law-constant-2",
  "57006b.mighty-avengers-constant",
];
const deps = WAVE10_DEPS;
const SETUP_SENTENCE =
  "In competitive mode, the enemy team finds the Choosing Sides side scheme and your team reveals it.";

type Pair = readonly [string, string];
const open = (pair: Pair, twoPlayers = true): GameState => ungatedStageGame(IRON_MAN_SCENARIO, pair, { twoPlayers });
const scheme = (s: GameState): InstanceId => s.mainScheme.instanceId;
const villain = (s: GameState): InstanceId => s.activeVillainId!;
const target = (s: GameState): number => mainSchemeValue(s, "targetThreat", deps);
const hinder = (s: GameState): number => keywordTotal(s, scheme(s), "hinder", deps);
const heroes = (s: GameState): GameState => withForm(withForm(s, { heroForm: 0 }, P1), { heroForm: 0 }, P2);
const identityOf = (s: GameState, p: PlayerId): InstanceId =>
  s.players.find((x) => x.playerId === p)!.identity.instanceId;
const turnOrder = (s: GameState): PlayerId[] => {
  const step = s.step as unknown as { activePlayerId: PlayerId; remainingPlayerIds: PlayerId[] };
  return [step.activePlayerId, ...step.remainingPlayerIds];
};
const villainPhase = (s: GameState, pick: Picker) => {
  const inDeck = piles(s).deck.map((id) => codeOf(s, id));
  const free = IRON_MAN_ATTACHMENTS.filter((code) => inDeck.includes(code));
  return driveEventsPicking(deps, stackEncounterDeck(s, ...free), pick, ...turnOrder(s).map((p) => endTurn(p)));
};
/** Both heroes, the scheme given this much threat (the stage 1 pair opens at 4 with two players). */
const withThreat = (s: GameState, threat: number): GameState => patchInstance(heroes(s), scheme(s), { threat });
const onStage = (s: GameState, stageIndex: number): GameState => ({
  ...s,
  mainScheme: { ...s.mainScheme, stageIndex },
});
const decline: Picker = (s) => (s.pendingChoice?.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));
/** Player 2 defends with their hero; every other defender prompt is declined. */
const p2Defends: Picker = (s) => {
  const choice = s.pendingChoice!;
  if (choice.prompt.kind !== "declareDefender") return firstLegal(s);
  const mine = choice.options.find((o) => o.optionId === identityOf(s, P2));
  return choice.playerId === P2 && mine ? [mine.optionId] : ["decline"];
};
const villainAttacks = (s: GameState, events: readonly GameEvent[]) =>
  types(events, "attackResolved").filter((a) => a.enemyInstanceId === villain(s));

const card = () => {
  const found = WAVE10_CARDS.find((c) => (c.id as string) === "57005a");
  if (found?.type !== "main_scheme") throw new Error("no 57005a");
  return found;
};

describe("registry", () => {
  it("scripts every ref the data names, none skipped, each valid", () => {
    expect(Object.keys(SYNTHEZOID_MAIN_SCHEMES_REGISTRATION).sort()).toEqual([...REFS].sort());
    expect(SYNTHEZOID_MAIN_SCHEMES_REGISTRATION_SKIPPED).toEqual({});
    expect([...abilityRefIds(card())].sort()).toEqual([...REFS].sort());
    for (const ref of REFS) expect(validateDefinition(SYNTHEZOID_MAIN_SCHEMES_REGISTRATION[ref]!), ref).toEqual([]);
    expect(competitiveOnlyTexts(SYNTHEZOID_MAIN_SCHEMES_REGISTRATION["57005a.setup"]!)).toEqual([SETUP_SENTENCE]);
    expect(card().stages.map((s) => [s.printedCardId, s.stageNumber, s.completionLoses ?? false])).toEqual([
      [ENFORCE_THE_LAW, 1, false],
      [MIGHTY_AVENGERS, 2, true],
    ]);
  });
});

describe("57005a Setup and 57005b Enforce the Law", () => {
  it("57005a.setup finds and reveals the leader's side scheme (Stark Tower, 3 threat per player)", () => {
    for (const twoPlayers of [false, true]) {
      const s = open([ENFORCE_THE_LAW, MIGHTY_AVENGERS], twoPlayers);
      expect(s.mainScheme.stageIndex).toBe(8);
      expect(inst(s, inPlayCard(s, STARK_TOWER)!).threat).toBe(twoPlayers ? 6 : 3);
    }
  });

  it("hinder 2 per hero only with more than one player: 0 threat and target 7 alone, 4 and 14 with two", () => {
    const one = open([ENFORCE_THE_LAW, MIGHTY_AVENGERS], false);
    expect([hinder(one), mainThreat(one), target(one)]).toEqual([0, 0, 7]);
    const two = open([ENFORCE_THE_LAW, MIGHTY_AVENGERS]);
    expect([hinder(two), mainThreat(two), target(two)]).toEqual([4, 4, 14]);
  });

  it("the enemy leader gains steady, and another stage 1 gives it none", () => {
    const s = open([ENFORCE_THE_LAW, MIGHTY_AVENGERS]);
    expect(hasKeyword(s, villain(s), "steady", deps)).toBe(true);
    const other = open([CUT_OFF_SUPPORT, MIGHTY_AVENGERS]);
    expect(hasKeyword(other, villain(other), "steady", deps)).toBe(false);
  });
});

describe("57006b Mighty Avengers", () => {
  /** Stage 1 to stage 2 at exactly the target: step 1 places 2 (acceleration 1 per player) and the blanks add none. */
  const advanced = (pair: Pair): GameState => {
    const s = open(pair);
    return villainPhase(withThreat(s, target(s) - 2), firstLegal).state;
  };

  it("stage 1 advances at exactly the target to stage index 9: target 18, no hinder", () => {
    const s = open([ENFORCE_THE_LAW, MIGHTY_AVENGERS]);
    const short = villainPhase(withThreat(s, target(s) - 3), firstLegal).state;
    expect(short.mainScheme.stageIndex).toBe(8);
    const after = advanced([ENFORCE_THE_LAW, MIGHTY_AVENGERS]);
    expect(after.mainScheme.stageIndex).toBe(9);
    expect(target(after)).toBe(18);
    expect(hinder(after)).toBe(0);
    expect(after.outcome).toBeNull();
  });

  it("the enemy leader's attack is 2 higher undefended and 1 higher defended than under No Going Back", () => {
    const stages: Pair[] = [
      [ENFORCE_THE_LAW, MIGHTY_AVENGERS],
      [ENFORCE_THE_LAW, NO_GOING_BACK],
    ];
    const [mighty, plain] = stages.map(advanced) as [GameState, GameState];
    const attacks = (s: GameState, pick: Picker) => villainAttacks(s, villainPhase(s, pick).events);
    const undefended = attacks(mighty, decline);
    expect(undefended.length).toBeGreaterThan(0);
    for (const attack of undefended) {
      const same = attacks(plain, decline).find((a) => a.targetInstanceId === attack.targetInstanceId)!;
      expect(attack.baseAtk).toBe(same.baseAtk + 2);
    }
    const against = (s: GameState) => attacks(s, p2Defends).find((a) => a.targetInstanceId === identityOf(s, P2))!;
    expect(against(mighty).baseAtk).toBe(against(plain).baseAtk + 1);
  });

  it("completing it loses the game", () => {
    const s = open([ENFORCE_THE_LAW, MIGHTY_AVENGERS]);
    const last = onStage(s, 9);
    expect(target(last)).toBe(18);
    const loses = villainPhase(withThreat(last, 18 - 2), firstLegal).state;
    expect(loses.outcome).toMatchObject({ result: "loss" });
  });
});
