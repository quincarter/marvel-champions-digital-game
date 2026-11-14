import { cardId } from "@mc/content";
import { activeEncounterDeck, activeEncounterDeckId, type Command, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import { engageMinion } from "../../../wave9/falcon/testing.js";
import {
  IRON_FIST_IRON_FIST_OBLIGATION_NEMESIS as REGISTRY,
  IRON_FIST_IRON_FIST_OBLIGATION_NEMESIS_SKIPPED as SKIPPED,
} from "./obligation-nemesis.js";
import { IF_DEPS, chiOf, drive, ironFistGame, staged, takeAbility, withChi } from "./testing.js";

vi.setConfig({ testTimeout: 180_000 });

/**
 * Iron Fist's obligation and nemesis set (64034-64037). The card text is provisional (video and fan preview, see
 * docs/phase7-elektra-iron-fist.md section 3), so these tests pin the script to the text as recorded.
 */
const OBLIGATION = "64034.obligation";
const REVEALED = "64034.when-revealed";
const LACK = "64034.lack-of-chi-forced-interrupt";
const DAVOS_R = "64035.when-revealed";
const DAVOS_I = "64035.davos-forced-interrupt";
const SERPENT = "64036.steel-serpent-constant";
const DAUGHTER_D = "64037.when-defeated";
const DAUGHTER_B = "64037.boost";
const MASTER = "64001a.martial-arts-master";
const ADVANCE = "01186";

const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const idsOf = (s: GameState, code: string): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((i) => codeOf(s, i) === code);
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const encounterDeckCodes = (s: GameState): string[] => activeEncounterDeck(s).deck.map((i) => codeOf(s, i));
const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));

/** The given nemesis cards (from P1's set-aside cards, else the encounter deck) on top of it, the next 15 turned into Advance. */
function onTop(state: GameState, ...codes: readonly string[]): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const taken: InstanceId[] = [];
  for (const code of codes) {
    const wanted = (i: InstanceId) => codeOf(state, i) === code && !taken.includes(i);
    const id = playerOf(state, P1).setAside.find(wanted) ?? pile.deck.find(wanted) ?? pile.discard.find(wanted);
    if (!id) throw new Error(`no ${code}`);
    taken.push(id);
  }
  const rest = pile.deck.filter((i) => !taken.includes(i));
  const placed: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => !taken.includes(i)) } : p,
    ),
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: [...taken, ...rest], discard: pile.discard.filter((i) => !taken.includes(i)) },
    },
  };
  return rest.slice(0, 15).reduce((acc, i) => patchInstance(acc, i, { cardId: cardId(ADVANCE) }), placed);
}
/** A set-aside nemesis minion `code` put engaged with P1, faceup. */
function engaged(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const id = playerOf(state, P1).setAside.find((i) => codeOf(state, i) === code)!;
  const left: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
    ),
  };
  return { id, state: patchInstance(left, id, { faceup: true, controllerId: null, engagedWith: P1 }) };
}
/** A set-aside card faceup in the villain area (a side scheme). */
function sideScheme(state: GameState, code: string): GameState {
  const id = playerOf(state, P1).setAside.find((i) => codeOf(state, i) === code)!;
  const left: GameState = {
    ...state,
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p)),
    villainArea: [...state.villainArea, id],
  };
  return patchInstance(left, id, { faceup: true, threat: 4, controllerId: null });
}
/** Moves each of these (set-aside) cards under `under`, facedown. */
function tuckUnder(state: GameState, under: InstanceId, ...ids: readonly InstanceId[]): GameState {
  const left: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => !ids.includes(i)) } : p,
    ),
  };
  return patchInstance(left, under, { tucked: [...inst(left, under).tucked, ...ids] });
}
const stunnedVillain = (s: GameState): GameState =>
  patchInstance(s, villainOf(s), { statuses: { ...inst(s, villainOf(s)).statuses, stunned: 1 } });
const setAsideOf = (s: GameState, code: string) => playerOf(s, P1).setAside.filter((i) => codeOf(s, i) === code);

describe("wave 11 iron_fist/iron-fist/obligation-nemesis registry", () => {
  it("registers only valid definitions and skips none", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY).sort()).toEqual(
      [OBLIGATION, REVEALED, LACK, DAVOS_R, DAVOS_I, SERPENT, DAUGHTER_D, DAUGHTER_B].sort(),
    );
  });
  it("the game sets aside Iron Fist's nemesis cards", () => {
    const game = ironFistGame();
    expect(setAsideOf(game, "64035").length).toBe(1);
    expect(setAsideOf(game, "64037").length).toBe(3);
  });
});

describe(`${LACK}: chi is placed on the obligation instead of Iron Fist`, () => {
  const withObligation = (chiHere: number) => {
    const placed = engageMinion(ironFistGame(), "64034", "lack");
    return patchInstance(placed, "lack" as InstanceId, { engagedWith: null, counters: { chi: chiHere } });
  };
  it("Martial Arts Master's chi lands on the obligation", () => {
    const { state, command } = staged(withObligation(0), "64004", 1);
    const { state: after } = drive(state, command, takeAbility(MASTER));
    expect(chiOf(after)).toBe(0);
    expect(inst(after, "lack" as InstanceId).counters["chi"]).toBe(1);
  });
  it("is discarded once 4 chi are on it", () => {
    const { state, command } = staged(withObligation(3), "64004", 1);
    const { state: after } = drive(state, command, takeAbility(MASTER));
    expect(chiOf(after)).toBe(0);
    expect(playerOf(after, P1).playArea).not.toContain("lack");
  });
});

describe(`${REVEALED}: move all chi from your identity to this card`, () => {
  it("is revealed in the villain phase and takes every chi counter", () => {
    const base = withChi(onTop(ironFistGame(), "64034"), 3);
    const run = driveEventsPicking(IF_DEPS, stunnedVillain(base), declines, endTurn(P1));
    const [lack] = idsOf(run.state, "64034");
    expect(chiOf(run.state)).toBe(0);
    expect(inst(run.state, lack!).counters["chi"]).toBe(3);
  });
});

describe(`${DAVOS_R}: find and tuck the 3 Crane Daughters under Davos`, () => {
  it("tucks all three facedown under him", () => {
    const run = driveEventsPicking(IF_DEPS, stunnedVillain(onTop(ironFistGame(), "64035")), declines, endTurn(P1));
    const [davos] = idsOf(run.state, "64035");
    expect(inst(run.state, davos!).tucked.map((i) => codeOf(run.state, i))).toEqual(["64037", "64037", "64037"]);
    expect(encounterDeckCodes(run.state)).not.toContain("64037");
  });
});

describe(`${DAVOS_I}: damage to Davos shuffles a tucked Crane Daughter into the encounter deck instead`, () => {
  const setup = () => {
    const e = engaged(ironFistGame(), "64035");
    const daughters = setAsideOf(e.state, "64037");
    return { state: tuckUnder(e.state, e.id, ...daughters), davos: e.id };
  };
  const basicAttack = (s: GameState, target: InstanceId): Command => ({
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: identityOf(s),
    targetInstanceId: target,
  });
  it("takes no damage and loses one tucked card to the encounter deck", () => {
    const { state, davos } = setup();
    const { state: after } = drive(state, basicAttack(state, davos), declines);
    expect(inst(after, davos).damage).toBe(0);
    expect(inst(after, davos).tucked.length).toBe(2);
    expect(encounterDeckCodes(after)).toContain("64037");
  });
  it("with none tucked he takes the damage", () => {
    const { state, davos } = setup();
    const bare = patchInstance(state, davos, { tucked: [] });
    const { state: after } = drive(bare, basicAttack(bare, davos), declines);
    expect(inst(after, davos).damage).toBe(2);
  });
});

describe(`${SERPENT}: when Davos attacks, spend a Crane Daughter for +3 ATK`, () => {
  const attackRun = (withScheme: boolean, tucked: boolean) => {
    let e = engaged(ironFistGame(), "64035");
    let state = e.state;
    if (tucked) state = tuckUnder(state, e.id, ...setAsideOf(state, "64037").slice(0, 1));
    if (withScheme) state = sideScheme(state, "64036");
    const run = driveEventsPicking(IF_DEPS, stunnedVillain(state), declines, endTurn(P1));
    return { state: run.state, davos: e.id };
  };
  it("discards a tucked Crane Daughter and hits for 2 + 3", () => {
    const { state, davos } = attackRun(true, true);
    expect(inst(state, identityOf(state)).damage).toBe(5);
    expect(inst(state, davos).tucked.length).toBe(0);
  });
  it("control: without the side scheme Davos hits for 2", () => {
    const { state } = attackRun(false, true);
    expect(inst(state, identityOf(state)).damage).toBe(2);
  });
  it("with nothing to discard or defeat there is no bonus", () => {
    const { state } = attackRun(true, false);
    expect(inst(state, identityOf(state)).damage).toBe(2);
  });
  it("defeats a Crane Daughter in play instead", () => {
    const e = engaged(ironFistGame(), "64035");
    const daughter = engaged(e.state, "64037");
    const run = driveEventsPicking(IF_DEPS, stunnedVillain(sideScheme(daughter.state, "64036")), declines, endTurn(P1));
    expect(playerOf(run.state, P1).playArea).not.toContain(daughter.id);
    expect(inst(run.state, identityOf(run.state)).damage).toBeGreaterThanOrEqual(5);
  });
});

describe(`${DAUGHTER_D}: shuffled into the encounter deck when defeated`, () => {
  it("returns to the encounter deck", () => {
    const e = engaged(ironFistGame(), "64037");
    const hurt = patchInstance(e.state, e.id, { damage: 2 });
    const attack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(hurt),
      targetInstanceId: e.id,
    };
    const { state: after } = drive(hurt, attack, declines);
    expect(playerOf(after, P1).playArea).not.toContain(e.id);
    expect(encounterDeckCodes(after)).toContain("64037");
  });
});

describe(`${DAUGHTER_B}: with Davos engaged, put it facedown under him`, () => {
  it("is tucked under Davos when it is a boost card", () => {
    const e = engaged(ironFistGame(), "64035");
    const run = driveEventsPicking(IF_DEPS, onTop(e.state, "64037"), declines, endTurn(P1));
    expect(inst(run.state, e.id).tucked.map((i) => codeOf(run.state, i))).toContain("64037");
  });
});
