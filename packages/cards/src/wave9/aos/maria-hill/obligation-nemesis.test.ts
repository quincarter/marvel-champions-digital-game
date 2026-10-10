import { AOS_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  characterProfile,
  cardsInPlay,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { mergeRegistries } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  patchInstance,
  playerOf,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../../wave8/index.js";
import { MARIA_HILL_IDENTITY } from "./identity.js";
import {
  MARIA_HILL_OBLIGATION_NEMESIS as REGISTRY,
  MARIA_HILL_OBLIGATION_NEMESIS_SKIPPED as SKIPPED,
} from "./obligation-nemesis.js";
import { engageHillMinion, inPlay, mariaGame, mariaHeroGame } from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Maria Hill's obligation and nemesis set (50029 Press Conference; 50030 Controller, 50031 Army of the Controlled,
 * 50032 Controlled Innocents, 50033 Diabolical Discs), docs/phase7-wave9.md section 8.4, 3.6, 3.32. The printed precon
 * `maria-hill-leadership` against Core's Rhino (ATK 2, SCH 1). Supports are staged with their counters. Encounter cards
 * are revealed through the villain phase behind Advance fillers (0 boost icons).
 */
const PRESS = "50029";
const CONTROLLER = "50030";
const ARMY = "50031";
const INNOCENTS = "50032";
const DISCS = "50033";
const STAFF = "50008"; // S.H.I.E.L.D. support, uses 3 staff
const ILIAD = "50009"; // S.H.I.E.L.D. support, uses 3 mission
const FRONT_ORG = "50028"; // a support without the S.H.I.E.L.D. trait
const FILLER = "01186"; // Advance: 0 boost icons
const REFS = [
  "50029.obligation",
  "50029.press-conference-forced-response",
  "50029.press-conference-action",
  "50030.controller-forced-response",
  "50031.when-revealed",
  "50031.when-defeated",
  "50032.controlled-innocents-constant",
  "50033.when-revealed",
];

const DEPS = { abilities: mergeRegistries(WAVE8_ABILITIES, MARIA_HILL_IDENTITY, REGISTRY) };
const data = (code: string) => AOS_CARDS.find((c) => (c.id as string) === code)! as any;
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const relabel = (s: GameState, id: InstanceId, code: string): GameState =>
  patchInstance(s, id, { cardId: cardId(code) });
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const encounterCodes = (s: GameState, zone: "deck" | "discard"): string[] =>
  Object.values(s.encounterDecks).flatMap((d) => d[zone].map((i) => codeOf(s, i)));
const setAsideCodes = (s: GameState): string[] => playerOf(s, P1).setAside.map((id) => codeOf(s, id));
const inPlayIds = (s: GameState, code: string): InstanceId[] =>
  instancesOf(s, code).filter((i) => cardsInPlay(s).includes(i));
const endPhase = (s: GameState): Command[] => s.players.map((p) => endTurn(p.playerId));
const counters = (s: GameState, id: InstanceId) => inst(s, id).counters;

const picker =
  (choose?: (s: GameState) => string[] | undefined): Picker =>
  (s) => {
    const prompt = s.pendingChoice!.prompt;
    if (prompt.kind === "declareDefender") return ["decline"];
    return choose?.(s) ?? firstLegal(s);
  };
const run = (s: GameState, pick: Picker, ...commands: readonly Command[]) =>
  driveEventsPicking(DEPS, s, pick, ...commands);

/** The first instance of `code`: Hill's set-aside copy, else the encounter deck's or discard pile's. */
const findCard = (s: GameState, code: string): InstanceId =>
  playerOf(s, P1).setAside.find((i) => codeOf(s, i) === code) ?? instancesOf(s, code)[0]!;
const removeFromZones = (s: GameState, id: InstanceId): GameState => ({
  ...s,
  players: s.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => i !== id) })),
  encounterDecks: Object.fromEntries(
    Object.entries(s.encounterDecks).map(([k, d]) => [
      k,
      { deck: d.deck.filter((i) => i !== id), discard: d.discard.filter((i) => i !== id) },
    ]),
  ),
});
/** `id` on top of the encounter deck behind `boosts` fillers, so it is revealed to P1 in the next villain phase. */
function stagedForReveal(s: GameState, id: InstanceId, boosts: number): GameState {
  const deckId = activeEncounterDeckId(s);
  const stripped = removeFromZones(s, id);
  const pile = stripped.encounterDecks[deckId]!;
  const fillers = pile.deck.slice(0, boosts);
  const staged: GameState = {
    ...stripped,
    encounterDecks: {
      ...stripped.encounterDecks,
      [deckId]: { ...pile, deck: [...fillers, id, ...pile.deck.slice(boosts)] },
    },
  };
  // Two fillers behind the card too, so a surge reveals one of those and not a random encounter card.
  const behind = staged.encounterDecks[deckId]!.deck.slice(boosts + 1, boosts + 3);
  return [...fillers, ...behind].reduce((acc, f) => relabel(acc, f, FILLER), staged);
}
/** `code` revealed to P1 in the next villain phase (after Rhino's boost card). */
function reveal(s: GameState, code: string, pick: Picker = picker()) {
  const id = findCard(s, code);
  // The Advance fillers scheme every round, so the main scheme is emptied first to keep a long test from ending the game.
  const calm = patchInstance(s, s.mainScheme.instanceId, { threat: 0 });
  const staged = stagedForReveal(calm, id, 1);
  return { ...run(staged, pick, ...endPhase(staged)), id };
}
/** A set-aside minion put into play engaged with P1 by surgery (no reveal). */
function engaged(s: GameState, code: string): { state: GameState; id: InstanceId } {
  const id = findCard(s, code);
  const stripped = removeFromZones(s, id);
  return {
    id,
    state: {
      ...stripped,
      players: stripped.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...stripped.instances, [id]: { ...stripped.instances[id]!, faceup: true, engagedWith: P1 } },
    },
  };
}
/** The set-aside side scheme `code` put into the villain area by surgery. */
function sideScheme(s: GameState, code: string, threat: number): { state: GameState; id: InstanceId } {
  const id = findCard(s, code);
  const stripped = removeFromZones(s, id);
  return {
    id,
    state: {
      ...stripped,
      villainArea: [...stripped.villainArea, id],
      instances: { ...stripped.instances, [id]: { ...stripped.instances[id]!, faceup: true, threat } },
    },
  };
}
/** P1 with supports staged: Support Staff (staff counters) and The Iliad (mission counters). */
function withSupports(s: GameState, staff: number, mission: number) {
  const a = inPlay(s, STAFF, staff > 0 ? { staff } : {});
  const b = inPlay(a.state, ILIAD, mission > 0 ? { mission } : {});
  return { state: b.state, staff: a.id, iliad: b.id };
}
/** Controlled Innocents put into play by revealing it, then the state at the next player phase. */
const withInnocents = (s: GameState): GameState => reveal(s, INNOCENTS).state;
/** Answers a "choose a support" prompt with the option whose label names `name`. */
const pickSupport = (name: string) =>
  picker((s) => {
    const match = s.pendingChoice!.options.find((o) => o.label.includes(name));
    return match ? [match.optionId] : undefined;
  });
/** The villain phase, with the top of the encounter deck made harmless (Advance fillers, 0 boost icons). */
function villainPhase(s: GameState, pick: Picker = picker()) {
  const deckId = activeEncounterDeckId(s);
  const filled = s.encounterDecks[deckId]!.deck.slice(0, 8).reduce((acc, id) => relabel(acc, id, FILLER), s);
  return run(filled, pick, ...endPhase(filled));
}
const profileOf = (s: GameState, id: InstanceId) => characterProfile(s, id, DEPS)!;
const attackCommand = (s: GameState, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(s),
  targetInstanceId: target,
});
/** Maria Hill in hero form with Controlled Innocents in play and a facedown Controlled minion from Diabolical Discs. */
function withControlledMinion() {
  const innocents = withInnocents(mariaGame());
  const { state } = reveal(innocents, DISCS);
  return { state: withForm(state, { heroForm: 0 }), minions: controlledMinions(state) };
}
/** The facedown Controlled minions in play (they are the player's own cards turned facedown). */
const controlledMinions = (s: GameState): InstanceId[] => cardsInPlay(s).filter((i) => inst(s, i).facedownAs != null);

describe("registry", () => {
  it("registers every ref of the five cards; only the Controlled Innocents forced response is skipped (an engine gap)", () => {
    const refs = AOS_CARDS.filter((c) => (c.id as string) >= PRESS && (c.id as string) <= DISCS).flatMap(abilityRefIds);
    expect([...refs].sort()).toEqual([...REFS, "50032.controlled-innocents-forced-response"].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual(["50032.controlled-innocents-forced-response"]);
  });
  it.each([...REFS])("%s validates", (id) => {
    expect(validateDefinition(REGISTRY[id as never]!)).toEqual([]);
  });
  it("timing: Press Conference and Controller are forced responses, its action an alter-ego action", () => {
    expect(REGISTRY["50029.press-conference-forced-response" as never]!.trigger).toMatchObject({
      kind: "response",
      forced: true,
    });
    expect(REGISTRY["50030.controller-forced-response" as never]!.trigger).toMatchObject({
      kind: "response",
      forced: true,
    });
    expect(REGISTRY["50029.press-conference-action" as never]!).toMatchObject({
      trigger: { kind: "action", form: "alterEgo" },
    });
    expect(REGISTRY["50031.when-defeated" as never]!.trigger).toMatchObject({ kind: "whenDefeated" });
  });
});

describe("the printed cards and setup", () => {
  it("Press Conference: an obligation with 2 boost icons in no encounter set", () => {
    expect(data(PRESS)).toMatchObject({ type: "obligation", boostIcons: 2, encounterSetIds: [] });
  });
  it("Controller: unique elite minion ATK 1 SCH 2 HP 6, 3 boost icons, a star, no keywords", () => {
    expect(data(CONTROLLER)).toMatchObject({ type: "minion", atk: 1, sch: 2, hp: 6, boostIcons: 3, unique: true });
    expect(data(CONTROLLER).traits).toEqual(["ELITE", "PSIONIC"]);
    expect(data(CONTROLLER).keywords).toEqual([]);
  });
  it("Army of the Controlled: a side scheme with 3 threat per player, an acceleration icon, 1 boost icon", () => {
    expect(data(ARMY)).toMatchObject({ type: "side_scheme", startingThreat: { base: 0, perPlayer: 3 }, boostIcons: 1 });
    expect(data(ARMY).icons).toEqual(["acceleration"]);
  });
  it("Controlled Innocents: an environment with no boost icons; Diabolical Discs: 2 copies, Surge, 2 boost icons", () => {
    expect(data(INNOCENTS)).toMatchObject({ type: "environment", boostIcons: 0 });
    expect(data(DISCS)).toMatchObject({ type: "treachery", boostIcons: 2, quantityInSet: 2 });
    expect(data(DISCS).keywords).toEqual([{ name: "surge" }]);
  });
  it("the whole nemesis set is set aside (one each, two Discs) and the obligation is in the encounter deck once", () => {
    const s = mariaGame();
    expect(setAsideCodes(s)).toEqual([CONTROLLER, ARMY, INNOCENTS, DISCS, DISCS]);
    expect(encounterCodes(s, "deck").filter((c) => c === PRESS)).toHaveLength(1);
  });
});

describe("50029 Press Conference", () => {
  it("revealed, it is given to Maria Hill's player and stays in play", () => {
    const { state, id } = reveal(mariaGame(), PRESS);
    expect(playerOf(state, P1).playArea).toContain(id);
  });
  it("forced response: after the player phase ends, 1 counter comes off each support (Staff 1 -> discarded, Iliad 3 -> 2)", () => {
    const { state: s0, id } = reveal(mariaGame(), PRESS);
    const sup = withSupports(s0, 1, 3);
    const { state } = run(sup.state, picker(), ...endPhase(sup.state));
    expect(cardsInPlay(state)).not.toContain(sup.staff);
    expect(counters(state, sup.iliad)).toEqual({ mission: 2 });
    expect(playerOf(state, P1).playArea).toContain(id);
  });
  it("it takes 1 from each support, not 1 in all: Staff 3 -> 2 and Iliad 3 -> 2", () => {
    const { state: s0 } = reveal(mariaGame(), PRESS);
    const sup = withSupports(s0, 3, 3);
    const { state } = run(sup.state, picker(), ...endPhase(sup.state));
    expect(counters(state, sup.staff)).toEqual({ staff: 2 });
    expect(counters(state, sup.iliad)).toEqual({ mission: 2 });
  });
  it("a support with no counters is untouched; with no supports at all nothing happens", () => {
    const { state: s0 } = reveal(mariaGame(), PRESS);
    const none = run(s0, picker(), ...endPhase(s0)).state;
    expect(playerOf(none, P1).playArea.length).toBeGreaterThan(0);
    const placed = inPlay(s0, FRONT_ORG, {});
    const { state } = run(placed.state, picker(), ...endPhase(placed.state));
    expect(cardsInPlay(state)).toContain(placed.id);
    expect(counters(state, placed.id)).toEqual({});
  });
  it("a card holding two counter types loses exactly one counter in all (mission 2 and all-purpose 2: 3 left)", () => {
    const { state: s0 } = reveal(mariaGame(), PRESS);
    const sup = inPlay(s0, ILIAD, { mission: 2, allPurpose: 2 });
    const { state } = run(sup.state, picker(), ...endPhase(sup.state));
    expect(cardsInPlay(state)).toContain(sup.id);
    expect(Object.values(counters(state, sup.id)).reduce((x, y) => x + y, 0)).toBe(3);
  });
  it("alter-ego action: exhausting the identity discards it", () => {
    const { state: s0, id } = reveal(mariaGame(), PRESS);
    const { state } = run(s0, picker(), use(P1, id, "50029.press-conference-action"));
    expect(playerOf(state, P1).playArea).not.toContain(id);
    expect(encounterCodes(state, "discard")).toContain(PRESS);
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
  });
  it("the action is refused in hero form and with an exhausted identity", () => {
    const { state: s0, id } = reveal(mariaGame(), PRESS);
    const hero = withForm(s0, { heroForm: 0 });
    expect(applyCommand(hero, use(P1, id, "50029.press-conference-action"), DEPS).ok).toBe(false);
    const tired = patchInstance(s0, identityOf(s0), { exhausted: true });
    expect(applyCommand(tired, use(P1, id, "50029.press-conference-action"), DEPS).ok).toBe(false);
  });
});

describe("50030.controller-forced-response (Controller)", () => {
  it("after it schemes against alter-ego Hill, 1 counter comes off a support of her choice (Iliad 3 -> 2, Staff stays 3)", () => {
    const { state: engagedState, id } = engaged(mariaGame(), CONTROLLER);
    const sup = withSupports(engagedState, 3, 3);
    const { state, events } = villainPhase(sup.state, pickSupport("The Iliad"));
    expect(ofType(events, "enemyActivated").some((e) => e.enemyInstanceId === id && e.activation === "scheme")).toBe(
      true,
    );
    expect(counters(state, sup.iliad)).toEqual({ mission: 2 });
    expect(counters(state, sup.staff)).toEqual({ staff: 3 });
  });
  it("it is her choice: choosing Support Staff takes it from Staff instead", () => {
    const { state: engagedState } = engaged(mariaGame(), CONTROLLER);
    const sup = withSupports(engagedState, 3, 3);
    const { state } = villainPhase(sup.state, pickSupport("Support Staff"));
    expect(counters(state, sup.staff)).toEqual({ staff: 2 });
    expect(counters(state, sup.iliad)).toEqual({ mission: 3 });
  });
  it("after it attacks hero-form Hill it triggers too", () => {
    const { state: engagedState, id } = engaged(mariaHeroGame(), CONTROLLER);
    const sup = withSupports(engagedState, 3, 3);
    const { state, events } = villainPhase(sup.state, pickSupport("The Iliad"));
    expect(ofType(events, "enemyActivated").some((e) => e.enemyInstanceId === id && e.activation === "attack")).toBe(
      true,
    );
    expect(counters(state, sup.iliad)).toEqual({ mission: 2 });
  });
  it("a support with the last counter is discarded (Staff 1)", () => {
    const { state: engagedState } = engaged(mariaGame(), CONTROLLER);
    const sup = withSupports(engagedState, 1, 0);
    const { state } = villainPhase(sup.state, pickSupport("Support Staff"));
    expect(cardsInPlay(state)).not.toContain(sup.staff);
  });
  it("only supports holding a counter can be chosen: with no counters anywhere nothing is removed and no minion appears", () => {
    const { state: engagedState } = engaged(mariaGame(), CONTROLLER);
    const sup = withSupports(engagedState, 0, 0);
    const { state } = villainPhase(sup.state);
    expect(counters(state, sup.staff)).toEqual({});
    expect(counters(state, sup.iliad)).toEqual({});
    expect(controlledMinions(state)).toEqual([]);
  });
  it("without Controlled Innocents in play no facedown minion is made", () => {
    const { state: engagedState } = engaged(mariaGame(), CONTROLLER);
    const sup = withSupports(engagedState, 3, 3);
    const { state } = villainPhase(sup.state, pickSupport("The Iliad"));
    expect(controlledMinions(state)).toEqual([]);
  });
  it("with Controlled Innocents in play the top card of her deck becomes a facedown Controlled minion engaged with her", () => {
    const innocents = withInnocents(mariaGame());
    const { state: engagedState } = engaged(innocents, CONTROLLER);
    const sup = withSupports(engagedState, 3, 3);
    const { state } = villainPhase(sup.state, pickSupport("The Iliad"));
    expect(counters(state, sup.iliad)).toEqual({ mission: 2 });
    const minions = controlledMinions(state);
    expect(minions).toHaveLength(1);
    const top = minions[0]!;
    // It came off her deck (no longer in it) and keeps its owner.
    expect(playerOf(state, P1).deck).not.toContain(top);
    expect(inst(state, top).engagedWith).toBe(P1);
    const profile = profileOf(state, top);
    expect([profile.atk, profile.sch, profile.maxHp]).toEqual([1, 1, 1]);
  });
  it("with Controlled Innocents in play but no counter to remove the minion is still made", () => {
    const innocents = withInnocents(mariaGame());
    const { state: engagedState } = engaged(innocents, CONTROLLER);
    const sup = withSupports(engagedState, 0, 0);
    const { state } = villainPhase(sup.state);
    expect(controlledMinions(state)).toHaveLength(1);
  });
});

describe("50031 Army of the Controlled", () => {
  it("when revealed it finds Controlled Innocents in the set-aside area and puts it into play; 3 threat for one player", () => {
    const { state, id } = reveal(mariaGame(), ARMY);
    expect(inst(state, id).threat).toBe(3);
    expect(inPlayIds(state, INNOCENTS)).toHaveLength(1);
    expect(setAsideCodes(state)).not.toContain(INNOCENTS);
  });
  it("it also finds it in the encounter discard pile", () => {
    const s0 = mariaGame();
    const innocents = findCard(s0, INNOCENTS);
    const deckId = activeEncounterDeckId(s0);
    const stripped = removeFromZones(s0, innocents);
    const staged: GameState = {
      ...stripped,
      encounterDecks: {
        ...stripped.encounterDecks,
        [deckId]: { ...stripped.encounterDecks[deckId]!, discard: [innocents] },
      },
    };
    const { state } = reveal(staged, ARMY);
    expect(inPlayIds(state, INNOCENTS)).toEqual([innocents]);
    expect(encounterCodes(state, "discard")).not.toContain(INNOCENTS);
  });
  it("with Controlled Innocents already in play nothing else is put into play", () => {
    const { state } = reveal(withInnocents(mariaGame()), ARMY);
    expect(inPlayIds(state, INNOCENTS)).toHaveLength(1);
  });
  it("when defeated with no Controlled minion in play: nothing is discarded and no counter is placed", () => {
    const sup = withSupports(mariaHeroGame(), 2, 2);
    const { state: staged, id } = sideScheme(sup.state, ARMY, 1);
    const { state } = run(staged, picker(), {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(staged),
      schemeInstanceId: id,
    });
    expect(cardsInPlay(state)).not.toContain(id);
    expect(counters(state, sup.staff)).toEqual({ staff: 2 });
    expect(counters(state, sup.iliad)).toEqual({ mission: 2 });
  });
  it("when defeated with two Controlled minions: both are discarded (no threat), 2 counters go on supports of her choice", () => {
    const first = withControlledMinion();
    const second = (() => {
      const { state } = reveal(withForm(first.state, "alterEgo"), DISCS);
      return { state: withForm(state, { heroForm: 0 }), minions: controlledMinions(state) };
    })();
    expect(second.minions).toHaveLength(2);
    const sup = withSupports(second.state, 2, 2);
    const { state: staged, id } = sideScheme(sup.state, ARMY, 1);
    const threatBefore = mainThreat(staged);
    const { state } = run(staged, pickSupport("The Iliad"), {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(staged),
      schemeInstanceId: id,
    });
    expect(cardsInPlay(state)).not.toContain(id);
    expect(controlledMinions(state)).toEqual([]);
    for (const m of second.minions) expect(playerOf(state, P1).discard).toContain(m);
    expect(mainThreat(state)).toBe(threatBefore);
    expect(counters(state, sup.iliad)).toEqual({ mission: 4 });
    expect(counters(state, sup.staff)).toEqual({ staff: 2 });
  });
  it("with one Controlled minion exactly 1 counter is placed", () => {
    const first = withControlledMinion();
    const sup = withSupports(first.state, 2, 2);
    const { state: staged, id } = sideScheme(sup.state, ARMY, 1);
    const { state } = run(staged, pickSupport("Support Staff"), {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(staged),
      schemeInstanceId: id,
    });
    expect(counters(state, sup.staff)).toEqual({ staff: 3 });
    expect(counters(state, sup.iliad)).toEqual({ mission: 2 });
  });
});

describe("50032 Controlled Innocents", () => {
  it("revealed it stays in play with no boost icons of its own", () => {
    const { state, id } = reveal(mariaGame(), INNOCENTS);
    expect(cardsInPlay(state)).toContain(id);
  });
  it("each facedown Controlled minion has base SCH, ATK and hit points of 1", () => {
    const { minions, state } = withControlledMinion();
    expect(minions).toHaveLength(1);
    const profile = profileOf(state, minions[0]!);
    expect([profile.atk, profile.sch, profile.maxHp]).toEqual([1, 1, 1]);
  });
  it("a defeated Controlled minion is placed in its owner's discard pile (engine rule)", () => {
    const { minions, state: staged } = withControlledMinion();
    const { state } = run(staged, picker(), attackCommand(staged, minions[0]!));
    expect(cardsInPlay(state)).not.toContain(minions[0]);
    expect(playerOf(state, P1).discard).toContain(minions[0]);
  });
  // The threat half of the forced response is skipped (SKIPPED, engine gap): the defeat event cannot see the facedown
  // role. The test to turn on once the engine stamps it: the minion's defeat adds exactly 1 threat to the main scheme.
  it.todo("forced response: after a Controlled minion is defeated, 1 threat is placed on the main scheme");
  it("a Core minion defeated places no threat (only Controlled minions)", () => {
    const { state: s0 } = withControlledMinion();
    const hero = engageHillMinion(s0, "01110", "probe-minion");
    const before = mainThreat(hero);
    const { state } = run(hero, picker(), attackCommand(hero, "probe-minion" as InstanceId));
    expect(mainThreat(state)).toBe(before);
  });
});

describe("50033.when-revealed (Diabolical Discs)", () => {
  it("surges: the next encounter card is revealed after it", () => {
    const { events, id } = reveal(mariaGame(), DISCS);
    expect(ofType(events, "surgeTriggered").some((e) => e.instanceId === id)).toBe(true);
  });
  it("removes 1 counter from a support of her choice (Staff 3 -> 2) and, without Controlled Innocents, makes no minion", () => {
    const sup = withSupports(mariaGame(), 3, 3);
    const { state } = reveal(sup.state, DISCS, pickSupport("Support Staff"));
    expect(counters(state, sup.staff)).toEqual({ staff: 2 });
    expect(counters(state, sup.iliad)).toEqual({ mission: 3 });
    expect(controlledMinions(state)).toEqual([]);
  });
  it("with exactly 1 counter on a support, that support is discarded", () => {
    const sup = withSupports(mariaGame(), 0, 1);
    const { state } = reveal(sup.state, DISCS);
    expect(cardsInPlay(state)).not.toContain(sup.iliad);
  });
  it("with no support holding a counter nothing is removed, and with Controlled Innocents the minion is still made", () => {
    const sup = withSupports(withInnocents(mariaGame()), 0, 0);
    const { state } = reveal(sup.state, DISCS);
    expect(counters(state, sup.staff)).toEqual({});
    expect(controlledMinions(state)).toHaveLength(1);
  });
  it("with Controlled Innocents: the top card of her deck becomes a facedown Controlled minion 1/1/1 engaged with her", () => {
    const sup = withSupports(withInnocents(mariaGame()), 3, 3);
    const { state } = reveal(sup.state, DISCS, pickSupport("The Iliad"));
    expect(counters(state, sup.iliad)).toEqual({ mission: 2 });
    const minions = controlledMinions(state);
    expect(minions).toHaveLength(1);
    const top = minions[0]!;
    expect(playerOf(state, P1).deck).not.toContain(top);
    expect(inst(state, top).engagedWith).toBe(P1);
    const profile = profileOf(state, top);
    expect([profile.atk, profile.sch, profile.maxHp]).toEqual([1, 1, 1]);
  });
  it("two Discs in a row make two minions", () => {
    const { state: first } = reveal(withInnocents(mariaGame()), DISCS);
    const { state } = reveal(first, DISCS);
    expect(controlledMinions(state)).toHaveLength(2);
  });
});
