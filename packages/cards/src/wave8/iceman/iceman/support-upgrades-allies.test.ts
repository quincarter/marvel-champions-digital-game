import { cardId, ICEMAN_CARDS, WAVE8_CARDS, WAVE8_STARTER_DECKS } from "@mc/content";
import { trait } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  characterProfile,
  createGame,
  maxHitPoints,
  NO_STATUSES,
  traitsOf,
  type AbilityRegistry,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { coreScenario } from "../../../core/setup.js";
import { mergeRegistries } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  resourceAbility,
  runWith,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, playFromHand, withDamage, withForm } from "../../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { ICEMAN_IDENTITY } from "./identity.js";
import { ICEMAN_SUPPORT_UPGRADES_ALLIES, ICEMAN_SUPPORT_UPGRADES_ALLIES_SKIPPED } from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Iceman's supports, upgrades and allies (46002-46008), docs/phase7-wave8.md section 7.2, 3.61, 3.65, 3.67, Q35 = A,
 * Q38 = A. Real commands in a real game: his starter deck (`iceman-aggression`) against Rhino. Hero face: THW 1, ATK 2,
 * DEF 2, 11 hit points. Rhino (stage 1): ATK 2, SCH 1. Sandman (01102, a relabeled minion): ATK 3, SCH 2, 4 hit points.
 * The boost cards are stacked: Breakin' and Takin' (01107) and Crowd Control (01108) each print 2 boost icons.
 * Cryokinetic Perception (46005) is skipped (see the last block).
 */
const FROSTBITE_CODE = "46002";
const SNOW_CLONE = "46003";
const POWER_BELT = "46004";
const CRYO = "46005";
const ICE_SLIDE = "46006";
const FROZEN_SOLID = "46007";
const ICE_WALL = "46008";
const FREEZE = "46001a.freeze";
const BELT_RESOURCE = "46004.power-belt-resource";

const ICEMAN = WAVE8_STARTER_DECKS.find((d) => d.id === "iceman-aggression")!;
const ICEMAN_SEAT = {
  identityCardId: ICEMAN.identityCardId,
  aspects: ICEMAN.aspects,
  deck: ICEMAN.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
};
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" };
type Seat = typeof ICEMAN_SEAT | typeof SPIDER_MAN;

const depsWith = (...fixtures: readonly AbilityRegistry[]): EngineDeps => ({
  abilities: mergeRegistries(WAVE7_ABILITIES, ICEMAN_IDENTITY, ICEMAN_SUPPORT_UPGRADES_ALLIES, ...fixtures),
});
const DEPS: EngineDeps = depsWith();

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const setAsideCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).setAside.map((id) => codeOf(s, id));
const supply = (s: GameState, p: PlayerId = P1): number =>
  setAsideCodes(s, p).filter((c) => c === FROSTBITE_CODE).length;
const frostbiteOn = (s: GameState, host: InstanceId): number =>
  instancesOf(s, FROSTBITE_CODE).filter((id) => inst(s, id).attachedTo === host).length;
const frostbiteInPlayAnywhere = (s: GameState): number =>
  instancesOf(s, FROSTBITE_CODE).filter((id) => inst(s, id).attachedTo !== null).length;

function setupGame(seats: readonly Seat[] = [ICEMAN_SEAT]): GameState {
  const config = coreScenario("rhino", {
    players: [SPIDER_MAN],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...WAVE8_CARDS],
  } as never);
  const created = createGame(
    {
      ...config,
      players: seats.map((seat) =>
        "starterDeckId" in seat
          ? { ...coreScenario("rhino", { players: [seat], seed: 1, modularSetIds: [] }).players[0]! }
          : { identityCardId: seat.identityCardId, aspects: seat.aspects, deck: seat.deck },
      ),
    },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
const heroGame = (seats?: readonly Seat[]): GameState => withForm(setupGame(seats), { heroForm: 0 });

/** Picks by prompt: takes "Freeze!" when `freeze`, defends with the asked player's identity (or `defender`), else declines. */
const picker =
  (opts: { freeze?: boolean; defender?: InstanceId | "none" } = {}): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "chooseTriggers") {
      const freeze = opts.freeze ? choice.options.find((o) => o.optionId.endsWith(FREEZE)) : undefined;
      return freeze ? [freeze.optionId] : firstLegal(s);
    }
    if (choice.prompt.kind === "declareDefender") {
      if (opts.defender === "none") return ["decline"];
      return [opts.defender ?? identityOf(s, choice.playerId)];
    }
    if (choice.prompt.kind === "chooseTarget") return [choice.options[0]!.optionId];
    return firstLegal(s);
  };
const takeFreeze = picker({ freeze: true });
const declineFreeze = picker();
const undefended = picker({ defender: "none" });

const attack = (s: GameState, target: InstanceId, attacker = identityOf(s), player: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const run = (s: GameState, pick: Picker, ...commands: readonly Command[]) =>
  driveEventsPicking(DEPS, s, pick, ...commands);
const ready = (s: GameState, id: InstanceId): GameState => patchInstance(s, id, { exhausted: false });

/** A Sandman relabeled from an encounter card and engaged with `to` (no printed text of his is under test). */
function withMinion(s: GameState, to: PlayerId = P1): { readonly state: GameState; readonly id: InstanceId } {
  const sandman = s.cardPool[cardId("01102")];
  if (sandman?.type !== "minion") throw new Error("no Sandman in the pool");
  const deckId = activeEncounterDeckId(s);
  const pile = s.encounterDecks[deckId]!;
  const spare = pile.deck[0]!;
  const relabeled: GameState = {
    ...patchInstance(s, spare, { cardId: sandman.id, faceup: true, engagedWith: to, damage: 0 }),
    encounterDecks: {
      ...s.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => i !== spare), discard: pile.discard },
    },
    players: s.players.map((p) => (p.playerId === to ? { ...p, playArea: [...p.playArea, spare] } : p)),
  };
  return { state: relabeled, id: spare };
}

/** `times` real "Freeze!" attacks on `target` (the villain by default), reading Iceman and clearing the target's damage between. */
function freeze(s: GameState, times: number, target?: InstanceId): GameState {
  let current = s;
  for (let i = 0; i < times; i++) {
    const to = target ?? villainOf(current);
    const { state } = run(current, takeFreeze, attack(current, to));
    current = patchInstance(ready(state, identityOf(state)), to, { damage: 0 });
  }
  return current;
}

/** The kinds of move Frostbite made, in order: "attach" (set aside to an attachment) or "setAside". */
const frostbiteMoves = (events: readonly GameEvent[]): string[] =>
  events.flatMap((e) =>
    e.type === "cardMoved" && e.cardId === cardId(FROSTBITE_CODE)
      ? [e.to.kind === "attachment" ? "attach" : e.to.kind === "setAside" ? "setAside" : e.to.kind]
      : [],
  );
const damageEvents = (events: readonly GameEvent[], source: InstanceId) =>
  events.filter((e) => e.type === "damageDealt" && e.sourceInstanceId === source);
/** The index of the first event matching `test` at or after `from`. */
const indexOf = (events: readonly GameEvent[], test: (e: GameEvent) => boolean, from = 0): number =>
  events.findIndex((e, i) => i >= from && test(e));
const isFrostbiteTo = (kind: "attachment" | "setAside") => (e: GameEvent) =>
  e.type === "cardMoved" && e.cardId === cardId(FROSTBITE_CODE) && e.to.kind === kind;

const RHINO_BOOST = ["01107", "01108"];
/** The villain phase from hero form: Iceman defends Rhino's attack (boost 2 icons: 2 + 2 - DEF 2 = 2 damage, no Frostbite). */
const villainPhase = (s: GameState, pick: Picker = declineFreeze, boosts: readonly string[] = RHINO_BOOST) =>
  run(stackEncounterDeck(s, ...boosts), pick, endTurn());

describe("registry", () => {
  const registered = Object.keys(ICEMAN_SUPPORT_UPGRADES_ALLIES).sort();
  it("registers all eleven refs; nothing is skipped", () => {
    const refs = ICEMAN_CARDS.filter((c) => (c.id as string) >= "46002" && (c.id as string) <= "46008").flatMap(
      abilityRefIds,
    );
    expect(refs).toHaveLength(11);
    expect(registered).toEqual([...refs].sort());
    expect(Object.keys(ICEMAN_SUPPORT_UPGRADES_ALLIES_SKIPPED)).toEqual([]);
  });
  it("names every registered ref", () => {
    expect(registered).toEqual([
      "46002.frostbite-constant",
      "46002.frostbite-forced-response",
      "46003.snow-clone-constant",
      "46003.snow-clone-constant-2",
      "46004.power-belt-constant",
      "46004.power-belt-resource",
      "46005.cryokinetic-perception-response",
      "46006.ice-slide-constant",
      "46006.ice-slide-forced-response",
      "46007.frozen-solid-forced-interrupt",
      "46008.ice-wall-forced-interrupt",
    ]);
  });
  it.each(registered)("%s validates", (id) => {
    expect(validateDefinition(ICEMAN_SUPPORT_UPGRADES_ALLIES[id]!)).toEqual([]);
  });
  it("Ice Slide, Frozen Solid and Ice Wall are forced; the belt's resource is a hero resource", () => {
    const kind = (id: string) => ICEMAN_SUPPORT_UPGRADES_ALLIES[id]!.trigger;
    expect(kind("46006.ice-slide-forced-response")).toMatchObject({ kind: "response", forced: true });
    expect(kind("46007.frozen-solid-forced-interrupt")).toMatchObject({ kind: "interrupt", forced: true });
    expect(kind("46008.ice-wall-forced-interrupt")).toMatchObject({ kind: "interrupt", forced: true });
    expect(ICEMAN_SUPPORT_UPGRADES_ALLIES[BELT_RESOURCE]!.trigger).toMatchObject({ kind: "resource", form: "hero" });
  });
});

describe("Frostbite (46002): what the attached enemy suffers", () => {
  it("the villain has ATK 2 and SCH 1; one copy makes them 1 and 0, two copies 0 and 0, six copies still 0 and 0", () => {
    const s = heroGame();
    expect(characterProfile(s, villainOf(s), DEPS)).toMatchObject({ atk: 2, sch: 1 });
    const one = freeze(s, 1);
    expect(characterProfile(one, villainOf(one), DEPS)).toMatchObject({ atk: 1, sch: 0 });
    const two = freeze(s, 2);
    expect(frostbiteOn(two, villainOf(two))).toBe(2);
    expect(characterProfile(two, villainOf(two), DEPS)).toMatchObject({ atk: 0, sch: 0 });
    const six = freeze(s, 6);
    expect(frostbiteOn(six, villainOf(six))).toBe(6);
    expect(supply(six)).toBe(0);
    expect(characterProfile(six, villainOf(six), DEPS)).toMatchObject({ atk: 0, sch: 0 });
  });
  it("a minion (Sandman, ATK 3, SCH 2) gets the same: 2 and 1 with one copy, 1 and 0 with two", () => {
    const { state: s, id } = withMinion(heroGame());
    expect(characterProfile(s, id, DEPS)).toMatchObject({ atk: 3, sch: 2 });
    const one = freeze(s, 1, id);
    expect(characterProfile(one, id, DEPS)).toMatchObject({ atk: 2, sch: 1 });
    const two = freeze(s, 2, id);
    expect(characterProfile(two, id, DEPS)).toMatchObject({ atk: 1, sch: 0 });
    // The villain beside it is untouched.
    expect(characterProfile(two, villainOf(two), DEPS)).toMatchObject({ atk: 2, sch: 1 });
  });
  it("the villain's attack is weaker by 1 with a copy: Iceman takes 1 where he took 2", () => {
    const without = villainPhase(heroGame());
    expect(inst(without.state, identityOf(without.state)).damage).toBe(2);
    const s = freeze(heroGame(), 1);
    const { state } = villainPhase(s);
    expect(inst(state, identityOf(state)).damage).toBe(1);
  });
  it("two copies on Sandman make his attack 1 (3 - 2 + 2 boost - DEF 2) where one copy gives 2 and none gives 3", () => {
    const damageBy = (copies: number): number => {
      const { state: s, id } = withMinion(heroGame());
      const { events } = villainPhase(freeze(s, copies, id), declineFreeze, ["01107", "01108", "01186"]);
      return damageEvents(events, id).reduce((n, e) => n + (e.type === "damageDealt" ? e.amount : 0), 0);
    };
    expect(damageBy(0)).toBe(3);
    expect(damageBy(1)).toBe(2);
    expect(damageBy(2)).toBe(1);
  });
  it("in alter-ego form the villain schemes: one copy takes 1 off its SCH, and the copy is set aside after", () => {
    const threatAfter = (copies: number) => {
      const s = withForm(freeze(heroGame(), copies), "alterEgo");
      const before = inst(s, s.mainScheme.instanceId).threat;
      const { state, events } = run(stackEncounterDeck(s, "01107", "01108"), declineFreeze, endTurn());
      return { placed: inst(state, state.mainScheme.instanceId).threat - before, state, events };
    };
    const none = threatAfter(0);
    const one = threatAfter(1);
    expect(none.placed - one.placed).toBe(1);
    expect(frostbiteMoves(one.events)).toEqual(["setAside"]);
    expect(supply(one.state)).toBe(6);
    expect(frostbiteOn(one.state, villainOf(one.state))).toBe(0);
  });
});

describe("Frostbite (46002): set aside after the attached enemy activates", () => {
  it("the villain's attack: one copy is set aside afterward, back in the owner's set-aside area, none left in play", () => {
    const s = freeze(heroGame(), 1);
    expect(supply(s)).toBe(5);
    const { state, events } = villainPhase(s);
    expect(frostbiteMoves(events)).toEqual(["setAside"]);
    expect(supply(state)).toBe(6);
    expect(frostbiteInPlayAnywhere(state)).toBe(0);
    expect(setAsideCodes(state).filter((c) => c === FROSTBITE_CODE)).toHaveLength(6);
  });
  it("the copy is set aside after the damage is dealt, not before the attack", () => {
    const { events } = villainPhase(freeze(heroGame(), 1));
    const hit = indexOf(events, (e) => e.type === "damageDealt" && e.amount === 1);
    expect(hit).toBeGreaterThan(-1);
    expect(indexOf(events, isFrostbiteTo("setAside"))).toBeGreaterThan(hit);
  });
  it("and it can be attached again: the next Freeze! takes it from the supply of six", () => {
    const { state: after } = villainPhase(freeze(heroGame(), 1));
    expect(supply(after)).toBe(6);
    const again = freeze(ready(after, identityOf(after)), 1);
    expect(frostbiteOn(again, villainOf(again))).toBe(1);
    expect(supply(again)).toBe(5);
  });
  it("a copy on a minion stays through the villain's activation and goes after the minion's own", () => {
    const { state: s, id } = withMinion(heroGame());
    const { state, events } = villainPhase(freeze(s, 1, id), declineFreeze, ["01107", "01108", "01186"]);
    const rhinoHit = indexOf(events, (e) => e.type === "damageDealt" && e.sourceInstanceId === villainOf(s));
    const minionHit = indexOf(events, (e) => e.type === "damageDealt" && e.sourceInstanceId === id);
    expect(rhinoHit).toBeGreaterThan(-1);
    expect(minionHit).toBeGreaterThan(rhinoHit);
    expect(indexOf(events, isFrostbiteTo("setAside"))).toBeGreaterThan(minionHit);
    expect(frostbiteMoves(events)).toEqual(["setAside"]);
    expect(supply(state)).toBe(6);
  });
  it("two copies on one enemy are both set aside by the one activation", () => {
    const { state: s, id } = withMinion(heroGame());
    const staged = freeze(s, 2, id);
    expect(supply(staged)).toBe(4);
    const { state, events } = villainPhase(staged, declineFreeze, ["01107", "01108", "01186"]);
    expect(frostbiteMoves(events)).toEqual(["setAside", "setAside"]);
    expect(supply(state)).toBe(6);
  });
  it("six copies: Rhino's ATK is 0, no damage gets through, and all six come back in the one activation", () => {
    const staged = freeze(heroGame(), 6);
    expect(supply(staged)).toBe(0);
    const { state, events } = villainPhase(staged);
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(frostbiteMoves(events)).toEqual(Array(6).fill("setAside"));
    expect(supply(state)).toBe(6);
  });
  it("a stunned enemy's activation does not happen: the copy stays and the stun is spent", () => {
    const staged = patchInstance(freeze(heroGame(), 1), villainOf(heroGame()), {});
    const stunned = patchInstance(staged, villainOf(staged), { statuses: { ...NO_STATUSES, stunned: 1 } });
    const { state, events } = villainPhase(stunned);
    expect(inst(state, villainOf(state)).statuses.stunned).toBe(0);
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(frostbiteMoves(events)).toEqual([]);
    expect(frostbiteOn(state, villainOf(state))).toBe(1);
    expect(supply(state)).toBe(5);
  });
  // Section 3.61: the permanent copy is unattached into its owner's play area as the host moves (RRG 1.8 "Permanent",
  // p. 32), still hears "attached enemy leaves play" and is set aside.
  it("set aside when the attached enemy leaves play: a minion defeated by Iceman's own attack", () => {
    const { state: s, id } = withMinion(heroGame());
    // Sandman has 4 hit points and 2 damage: Freeze! attaches before the attack's 2 damage defeats him.
    const staged = withDamage(s, id, 2);
    const { state, events } = driveEventsPicking(DEPS, staged, takeFreeze, attack(staged, id));
    expect(playerOf(state, P1).playArea).not.toContain(id);
    expect(frostbiteMoves(events)).toEqual(["attach", "playArea", "setAside"]);
    expect(supply(state)).toBe(6);
    expect(frostbiteInPlayAnywhere(state)).toBe(0);
    expect(playerOf(state, P1).playArea.map((i) => codeOf(state, i))).not.toContain(FROSTBITE_CODE);
  });
});

describe("Frostbite (46002): Q35 = A, attached during an activation", () => {
  it("a Freeze! on the basic defense: the copy is on Rhino for that attack (1 damage, not 2) and set aside right after", () => {
    const { state, events } = villainPhase(heroGame(), takeFreeze);
    expect(inst(state, identityOf(state)).damage).toBe(1);
    expect(frostbiteMoves(events)).toEqual(["attach", "setAside"]);
    const attached = indexOf(events, isFrostbiteTo("attachment"));
    const hit = indexOf(events, (e) => e.type === "damageDealt" && e.amount === 1);
    const away = indexOf(events, isFrostbiteTo("setAside"));
    expect(attached).toBeLessThan(hit);
    expect(hit).toBeLessThan(away);
    expect(supply(state)).toBe(6);
    expect(frostbiteOn(state, villainOf(state))).toBe(0);
  });
  it("no grace activation: the next round's attack is a full-strength 2 unless Freeze! is taken again", () => {
    const first = villainPhase(heroGame(), takeFreeze);
    const second = villainPhase(ready(first.state, identityOf(first.state)), declineFreeze, ["01107", "01186"]);
    expect(inst(second.state, identityOf(second.state)).damage).toBe(1 + 2);
  });
});

describe("Frostbite (46002): a second player's enemy", () => {
  it("Iceman freezes a minion engaged with player 2; it attacks player 2 and the copy goes home to player 1's set-aside area", () => {
    const two = heroGame([ICEMAN_SEAT, SPIDER_MAN]);
    const { state: s, id } = withMinion(two, P2);
    const frozen = run(s, takeFreeze, attack(s, id)).state;
    expect(frostbiteOn(frozen, id)).toBe(1);
    expect(supply(frozen, P1)).toBe(5);
    expect(characterProfile(frozen, id, DEPS)).toMatchObject({ atk: 2, sch: 1 });
    const stacked = stackEncounterDeck(frozen, "01107", "01108", "01186", "01186");
    const { state, events } = run(stacked, picker(), endTurn(P1));
    const afterP2 = run(state, picker(), endTurn(P2));
    const all = [...events, ...afterP2.events];
    expect(frostbiteMoves(all)).toEqual(["setAside"]);
    expect(supply(afterP2.state, P1)).toBe(6);
    expect(supply(afterP2.state, P2)).toBe(0);
    expect(playerOf(afterP2.state, P2).setAside.map((i) => codeOf(afterP2.state, i))).not.toContain(FROSTBITE_CODE);
  });
});

describe("Snow Clone (46003): cannot have upgrades, and 1 less consequential damage after attacking an enemy with Frostbite", () => {
  /** Snow Clone in play (cost 2, ATK 2, 2 hit points), a Sandman engaged with Iceman, and a handful of hand cards left. */
  function cloneGame() {
    const { state: s, id: minion } = withMinion(heroGame());
    const { state, id: clone } = playFromHand(DEPS, s, SNOW_CLONE, 2);
    return { state, clone, minion };
  }

  it("is an ally that enters play with 2 hit points and ATK 2, and has no THW to thwart with", () => {
    const { state, clone } = cloneGame();
    expect(playerOf(state, P1).playArea).toContain(clone);
    expect(characterProfile(state, clone, DEPS)).toMatchObject({ atk: 2, maxHp: 2 });
    expect(characterProfile(state, clone, DEPS)!.missing).toContain("thw");
  });
  it("attacking a minion with Frostbite: 2 damage to it and 0 consequential damage to Snow Clone", () => {
    const { state: s, clone, minion } = cloneGame();
    const frozen = patchInstance(freeze(s, 1, minion), minion, { damage: 0 });
    expect(frostbiteOn(frozen, minion)).toBe(1);
    const { state } = run(frozen, takeFreeze, attack(frozen, minion, clone));
    expect(inst(state, minion).damage).toBe(2);
    expect(inst(state, clone).damage).toBe(0);
    expect(frostbiteOn(state, minion)).toBe(1);
  });
  it("without Frostbite on the target: the same 2 damage and 1 consequential damage (1 hit point left)", () => {
    const { state: s, clone, minion } = cloneGame();
    const { state } = run(s, takeFreeze, attack(s, minion, clone));
    expect(inst(state, minion).damage).toBe(2);
    expect(inst(state, clone).damage).toBe(1);
    expect((maxHitPoints(state, clone, DEPS) ?? 0) - inst(state, clone).damage).toBe(1);
  });
  it("Frostbite on a different enemy does not count: the villain has one, Snow Clone attacks Sandman and takes 1", () => {
    const { state: s, clone, minion } = cloneGame();
    const frozen = freeze(s, 1);
    expect(frostbiteOn(frozen, villainOf(frozen))).toBe(1);
    const { state } = run(frozen, takeFreeze, attack(frozen, minion, clone));
    expect(inst(state, clone).damage).toBe(1);
  });
  it("attacking the villain with Frostbite: 0 consequential damage, 2 damage to Rhino; without it, 1 consequential", () => {
    const { state: s, clone } = cloneGame();
    const frozen = freeze(s, 1);
    const with1 = run(frozen, takeFreeze, attack(frozen, villainOf(frozen), clone)).state;
    expect(inst(with1, villainOf(with1)).damage).toBe(2);
    expect(inst(with1, clone).damage).toBe(0);
    const without = run(s, takeFreeze, attack(s, villainOf(s), clone)).state;
    expect(inst(without, clone).damage).toBe(1);
  });
  // Section 3.67 test 2: the Frostbite is unattached from the defeated minion before the consequential damage is dealt;
  // the enemy is read as it was when the attack was made (Q38 = A), so the reduction holds.
  it("Q38 = A: the attack that defeats the enemy keeps the reduction (Sandman 2 damage of 4, Frostbite on, Snow Clone hits 2)", () => {
    const { state: s, clone, minion } = cloneGame();
    const frozen = patchInstance(freeze(s, 1, minion), minion, { damage: 2 });
    const { state } = run(frozen, takeFreeze, attack(frozen, minion, clone));
    expect(playerOf(state, P1).playArea).not.toContain(minion);
    expect(inst(state, clone).damage).toBe(0);
  });
  it("the same defeat with no Frostbite: Snow Clone takes the 1 consequential damage", () => {
    const { state: s, clone, minion } = cloneGame();
    const staged = withDamage(s, minion, 2);
    const { state } = run(staged, takeFreeze, attack(staged, minion, clone));
    expect(playerOf(state, P1).playArea).not.toContain(minion);
    expect(inst(state, clone).damage).toBe(1);
  });
  it("cannot have an upgrade attached: Inspired (an ally upgrade) is refused on Snow Clone and accepted on another ally", () => {
    const { state: s, clone } = cloneGame();
    const deckCard = playerOf(s, P1).deck[0]!;
    const withAlly: GameState = {
      ...patchInstance(s, deckCard, { cardId: cardId("01002"), faceup: true, exhausted: false }),
      players: s.players.map((p) =>
        p.playerId === P1
          ? { ...p, deck: p.deck.filter((i) => i !== deckCard), playArea: [...p.playArea, deckCard] }
          : p,
      ),
    };
    const given = moveToHand(withAlly, P1, "46004");
    const inspired = given.ids[0]!;
    const staged = patchInstance(given.state, inspired, { cardId: cardId("01074") });
    const onClone = applyCommand(
      staged,
      play(P1, inspired, payWith(staged, P1, 1, [inspired]), { attachToInstanceId: clone }),
      DEPS,
    );
    expect(onClone.ok).toBe(false);
    const onOther = applyCommand(
      staged,
      play(P1, inspired, payWith(staged, P1, 1, [inspired]), { attachToInstanceId: deckCard }),
      DEPS,
    );
    expect(onOther.ok).toBe(true);
  });
  it("is refused for want of its cost: 2 needs 2 hand cards", () => {
    const { state: s } = withMinion(heroGame());
    const given = moveToHand(s, P1, SNOW_CLONE);
    const id = given.ids[0]!;
    expect(applyCommand(given.state, play(P1, id, payWith(given.state, P1, 1, [id])), DEPS).ok).toBe(false);
    expect(applyCommand(given.state, play(P1, id, payWith(given.state, P1, 2, [id])), DEPS).ok).toBe(true);
  });
});

describe("Power Belt (46004)", () => {
  it("+3 hit points: 14 on the hero face and the alter-ego face", () => {
    const s = heroGame();
    expect(maxHitPoints(s, identityOf(s), DEPS)).toBe(11);
    const { state } = playFromHand(DEPS, s, POWER_BELT, 2);
    expect(maxHitPoints(state, identityOf(state), DEPS)).toBe(14);
    const alterEgo = withForm(state, "alterEgo");
    expect(maxHitPoints(alterEgo, identityOf(alterEgo), DEPS)).toBe(14);
  });
  it("is attached to the identity, not set in the play area", () => {
    const { state, id } = playFromHand(DEPS, heroGame(), POWER_BELT, 2);
    expect(inst(state, id).attachedTo).toBe(identityOf(state));
  });
  it("its resource pays one of the cost for an ICE card (Ice Wall, cost 4: belt + 3 cards) and exhausts it", () => {
    const { state: s, id: belt } = playFromHand(DEPS, heroGame(), POWER_BELT, 2);
    const given = moveToHand(s, P1, ICE_WALL);
    const wall = given.ids[0]!;
    const paid = settle(
      runWith(
        DEPS,
        given.state,
        play(P1, wall, payWith(given.state, P1, 3, [wall]), { abilities: [resourceAbility(belt, BELT_RESOURCE)] }),
      ),
      firstLegal,
      undefined,
      DEPS,
    );
    expect(playerOf(paid, P1).playArea).toContain(wall);
    expect(inst(paid, belt).exhausted).toBe(true);
    // Four hand cards would have been needed without it.
    const short = applyCommand(given.state, play(P1, wall, payWith(given.state, P1, 3, [wall])), DEPS);
    expect(short.ok).toBe(false);
  });
  it("cannot pay for a card without the ICE trait: a Haymaker (cost 2) with the belt and 1 hand card is refused", () => {
    const { state: s, id: belt } = playFromHand(DEPS, heroGame(), POWER_BELT, 2);
    const hand = playerOf(s, P1).hand;
    const haymaker = hand[0]!;
    const staged = patchInstance(s, haymaker, { cardId: cardId("01087") });
    const attempt = applyCommand(
      staged,
      play(P1, haymaker, payWith(staged, P1, 1, [haymaker]), { abilities: [resourceAbility(belt, BELT_RESOURCE)] }),
      DEPS,
    );
    expect(attempt.ok).toBe(false);
    // Control: with the two cards it costs, no belt is needed.
    const fine = applyCommand(staged, play(P1, haymaker, payWith(staged, P1, 2, [haymaker])), DEPS);
    expect(fine.ok).toBe(true);
  });
  it("is a hero resource: in alter-ego form it cannot be used", () => {
    const { state: s, id: belt } = playFromHand(DEPS, heroGame(), POWER_BELT, 2);
    const alter = withForm(s, "alterEgo");
    const given = moveToHand(alter, P1, ICE_WALL);
    const wall = given.ids[0]!;
    const attempt = applyCommand(
      given.state,
      play(P1, wall, payWith(given.state, P1, 3, [wall]), { abilities: [resourceAbility(belt, BELT_RESOURCE)] }),
      DEPS,
    );
    expect(attempt.ok).toBe(false);
  });
});

describe("cost refusals of the upgrades", () => {
  it.each([
    [POWER_BELT, 2],
    [ICE_SLIDE, 2],
  ])("%s costs %i: one hand card short is refused, the cost is accepted", (code, cost) => {
    const given = moveToHand(heroGame(), P1, code);
    const id = given.ids[0]!;
    const attach = { attachToInstanceId: identityOf(given.state) };
    expect(applyCommand(given.state, play(P1, id, payWith(given.state, P1, cost - 1, [id]), attach), DEPS).ok).toBe(
      false,
    );
    expect(applyCommand(given.state, play(P1, id, payWith(given.state, P1, cost, [id]), attach), DEPS).ok).toBe(true);
  });
  it("Frozen Solid costs 3, and attaches to an enemy only: the identity is refused as a host", () => {
    const given = moveToHand(heroGame(), P1, FROZEN_SOLID);
    const id = given.ids[0]!;
    const villain = villainOf(given.state);
    expect(
      applyCommand(given.state, play(P1, id, payWith(given.state, P1, 2, [id]), { attachToInstanceId: villain }), DEPS)
        .ok,
    ).toBe(false);
    expect(
      applyCommand(
        given.state,
        play(P1, id, payWith(given.state, P1, 3, [id]), { attachToInstanceId: identityOf(given.state) }),
        DEPS,
      ).ok,
    ).toBe(false);
  });
});

describe("Ice Slide (46006)", () => {
  const slideGame = () => {
    const { state, id } = playFromHand(DEPS, heroGame(), ICE_SLIDE, 2);
    return { state, slide: id };
  };
  it("Iceman gets +1 THW, +1 ATK and +1 DEF (1, 2, 2 become 2, 3, 3) and the Aerial trait", () => {
    const base = heroGame();
    expect(characterProfile(base, identityOf(base), DEPS)).toMatchObject({ thw: 1, atk: 2, def: 2 });
    expect(traitsOf(base, identityOf(base), DEPS)).not.toContain(trait("AERIAL"));
    const { state, slide } = slideGame();
    expect(inst(state, slide).attachedTo).toBe(identityOf(state));
    expect(characterProfile(state, identityOf(state), DEPS)).toMatchObject({ thw: 2, atk: 3, def: 3 });
    expect(traitsOf(state, identityOf(state), DEPS)).toContain(trait("AERIAL"));
  });
  it("is real: a basic attack deals 3 and Rhino's 4 is 1 after DEF 3", () => {
    const { state: s } = slideGame();
    const hit = run(s, declineFreeze, attack(s, villainOf(s))).state;
    expect(inst(hit, villainOf(hit)).damage).toBe(3);
    const { state } = villainPhase(ready(s, identityOf(s)));
    expect(inst(state, identityOf(state)).damage).toBe(1);
  });
  it("after changing to alter-ego form it is shuffled into the deck, the identity loses the bonuses", () => {
    const { state: s, slide } = slideGame();
    const deckBefore = playerOf(s, P1).deck.length;
    const { state } = run(s, firstLegal, { type: "changeForm", playerId: P1 });
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    expect(inst(state, slide).attachedTo).toBeNull();
    expect(playerOf(state, P1).deck).toContain(slide);
    expect(playerOf(state, P1).deck).toHaveLength(deckBefore + 1);
    expect(playerOf(state, P1).playArea).not.toContain(slide);
    expect(traitsOf(state, identityOf(state), DEPS)).not.toContain(trait("AERIAL"));
  });
  it("changing to hero form does not shuffle it", () => {
    const { state: s, slide } = slideGame();
    const alter = withForm(s, "alterEgo");
    const { state } = run(alter, firstLegal, { type: "changeForm", playerId: P1 });
    expect(playerOf(state, P1).identity.form).toBe("hero");
    expect(inst(state, slide).attachedTo).toBe(identityOf(state));
  });
});

describe("Frozen Solid (46007)", () => {
  const pay = (s: GameState, id: InstanceId) => payWith(s, P1, 3, [id]);
  function solidOn(target: (s: GameState) => InstanceId, base = heroGame()) {
    const given = moveToHand(base, P1, FROZEN_SOLID);
    const id = given.ids[0]!;
    const on = target(given.state);
    const state = settle(
      runWith(DEPS, given.state, play(P1, id, pay(given.state, id), { attachToInstanceId: on })),
      firstLegal,
      undefined,
      DEPS,
    );
    return { state, id, on };
  }
  it("attaches to the villain (cost 3)", () => {
    const { state, id, on } = solidOn(villainOf);
    expect(inst(state, id).attachedTo).toBe(on);
  });
  it("hero form only: refused in alter-ego form", () => {
    const base = withForm(heroGame(), "alterEgo");
    const given = moveToHand(base, P1, FROZEN_SOLID);
    const id = given.ids[0]!;
    const attempt = applyCommand(
      given.state,
      play(P1, id, pay(given.state, id), { attachToInstanceId: villainOf(given.state) }),
      DEPS,
    );
    expect(attempt.ok).toBe(false);
  });
  it("max 1 per enemy: a second copy on the villain is refused, one on a minion is not", () => {
    const { state: s, id: minion } = withMinion(heroGame());
    const first = solidOn(villainOf, s);
    const given = moveToHand(first.state, P1, FROZEN_SOLID);
    const second = given.ids[0]!;
    const onVillain = applyCommand(
      given.state,
      play(P1, second, payWith(given.state, P1, 3, [second]), { attachToInstanceId: villainOf(given.state) }),
      DEPS,
    );
    expect(onVillain.ok).toBe(false);
    const onMinion = applyCommand(
      given.state,
      play(P1, second, payWith(given.state, P1, 3, [second]), { attachToInstanceId: minion }),
      DEPS,
    );
    expect(onMinion.ok).toBe(true);
  });
  it("when the villain would activate: no attack (no boost, no damage), Frozen Solid is discarded and a Frostbite is attached", () => {
    const { state: s, id } = solidOn(villainOf);
    const { state, events } = villainPhase(ready(s, identityOf(s)), declineFreeze, ["01107", "01108"]);
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(playerOf(state, P1).discard).toContain(id);
    expect(frostbiteOn(state, villainOf(state))).toBe(1);
    expect(supply(state)).toBe(5);
    // "Instead": the activation did not happen, so the new copy is not set aside by it.
    expect(frostbiteMoves(events)).toEqual(["attach"]);
    expect(characterProfile(state, villainOf(state), DEPS)).toMatchObject({ atk: 1, sch: 0 });
  });
  it("the next activation is the weakened one, and the copy is set aside after it", () => {
    const { state: s } = solidOn(villainOf);
    const first = villainPhase(ready(s, identityOf(s)), declineFreeze, ["01107", "01108"]);
    const second = villainPhase(ready(first.state, identityOf(first.state)), declineFreeze, ["01108", "01186"]);
    expect(inst(second.state, identityOf(second.state)).damage).toBe(1);
    expect(frostbiteMoves(second.events)).toEqual(["setAside"]);
    expect(supply(second.state)).toBe(6);
  });
  it("on a minion: only that minion's activation is replaced", () => {
    const { state: s0, id: minion } = withMinion(heroGame());
    const { state: s, id } = solidOn(() => minion, s0);
    const { state, events } = villainPhase(ready(s, identityOf(s)), declineFreeze, ["01107", "01108", "01186"]);
    expect(frostbiteOn(state, minion)).toBe(1);
    expect(playerOf(state, P1).discard).toContain(id);
    expect(damageEvents(events, minion)).toHaveLength(0);
    expect(damageEvents(events, villainOf(state))).toHaveLength(1);
  });
  it("with no Frostbite set aside: still discarded, the activation is still replaced, nothing is attached", () => {
    const { state: s } = solidOn(villainOf, freeze(heroGame(), 6));
    const staged = patchInstance(ready(s, identityOf(s)), villainOf(s), {});
    expect(supply(staged)).toBe(0);
    // Six Freeze! copies on Rhino weaken him to 0, so look at the discard and the copies, not the damage.
    const { state, events } = villainPhase(staged, declineFreeze, ["01107", "01108"]);
    expect(frostbiteOn(state, villainOf(state))).toBe(6);
    expect(frostbiteMoves(events)).toEqual([]);
    expect(playerOf(state, P1).discard.map((i) => codeOf(state, i))).toContain(FROZEN_SOLID);
  });
});

describe("Ice Wall (46008)", () => {
  /** Ice Wall in play (cost 4: Iceman's whole hand but one). */
  function wallGame(base = heroGame()) {
    const { state, id } = playFromHand(DEPS, base, ICE_WALL, 4);
    return { state, wall: id };
  }
  const wallDamage = (s: GameState, wall: InstanceId) => inst(s, wall).damage;

  it("an attack of 4 on Iceman who defends with DEF 2: 2 is placed on Ice Wall and Iceman takes 0", () => {
    const { state: s, wall } = wallGame();
    const { state } = villainPhase(s);
    expect(wallDamage(state, wall)).toBe(2);
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(playerOf(state, P1).playArea).toContain(wall);
  });
  it("undefended, the whole 4 is placed on it", () => {
    const { state: s, wall } = wallGame();
    const { state } = villainPhase(s, undefended);
    expect(wallDamage(state, wall)).toBe(4);
    expect(inst(state, identityOf(state)).damage).toBe(0);
  });
  it("at 7 damage it stays: 5 on it plus 2 is 7, no Frostbite", () => {
    const { state: s, wall } = wallGame();
    const { state, events } = villainPhase(withDamage(s, wall, 5));
    expect(wallDamage(state, wall)).toBe(7);
    expect(playerOf(state, P1).playArea).toContain(wall);
    expect(frostbiteMoves(events)).toEqual([]);
  });
  it("at 8 or more it is discarded and the enemy that just attacked gets a Frostbite: 6 + 2 = 8", () => {
    const { state: s, wall } = wallGame();
    const { state, events } = villainPhase(withDamage(s, wall, 6));
    expect(playerOf(state, P1).discard).toContain(wall);
    expect(playerOf(state, P1).playArea).not.toContain(wall);
    expect(inst(state, identityOf(state)).damage).toBe(0);
    // Q35 = A: it is attached during that activation and set aside when the activation ends.
    expect(frostbiteMoves(events)).toEqual(["attach", "setAside"]);
    expect(supply(state)).toBe(6);
    expect(frostbiteOn(state, villainOf(state))).toBe(0);
  });
  it("all the damage is placed, past 8: 6 on it and an undefended 4 leaves it with 10 before it is discarded", () => {
    const { state: s, wall } = wallGame();
    const { state, events } = villainPhase(withDamage(s, wall, 6), undefended);
    expect(inst(state, identityOf(state)).damage).toBe(0);
    const placed = events.filter((e) => e.type === "damagePlaced" && e.targetInstanceId === wall);
    expect(placed.map((e) => (e.type === "damagePlaced" ? e.amount : 0))).toEqual([4]);
    expect(playerOf(state, P1).discard).toContain(wall);
    expect(frostbiteMoves(events)).toEqual(["attach", "setAside"]);
  });
  it("the Frostbite is attached after Ice Wall is discarded, inside the same attack", () => {
    const { state: s, wall } = wallGame();
    const { events } = villainPhase(withDamage(s, wall, 6));
    const discarded = indexOf(
      events,
      (e) => e.type === "cardMoved" && e.instanceId === wall && e.to.kind === "discard",
    );
    expect(discarded).toBeGreaterThan(-1);
    expect(indexOf(events, isFrostbiteTo("attachment"))).toBeGreaterThan(discarded);
  });
  it("with no Frostbite set aside it is still discarded at 8, nothing attached", () => {
    const frozen = freeze(heroGame(), 6);
    const { state: s, wall } = wallGame(frozen);
    const { state, events } = villainPhase(withDamage(ready(s, identityOf(s)), wall, 6), undefended);
    expect(playerOf(state, P1).discard).toContain(wall);
    // Nothing is attached by Ice Wall; Rhino's own activation then sets the six he already carried aside.
    expect(frostbiteMoves(events)).toEqual(Array(6).fill("setAside"));
    expect(inst(state, identityOf(state)).damage).toBe(0);
  });
  it("an ally that defends takes the damage itself: nothing is placed on Ice Wall", () => {
    const { state: s, wall } = wallGame();
    const given = moveToHand(s, P1, SNOW_CLONE);
    const clone = given.ids[0]!;
    // The wall used 4 cards of 6; one card is left to pay with, so stage the ally straight into play.
    const staged: GameState = {
      ...patchInstance(given.state, clone, { faceup: true, exhausted: false }),
      players: given.state.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== clone), playArea: [...p.playArea, clone] } : p,
      ),
    };
    const { state } = villainPhase(staged, picker({ defender: clone }));
    expect(wallDamage(state, wall)).toBe(0);
    // Rhino's 4 defeats the ally (2 hit points).
    expect(playerOf(state, P1).playArea).not.toContain(clone);
    expect(inst(state, identityOf(state)).damage).toBe(0);
  });
  it("any player's identity: Rhino's attacks on both players are placed on player 1's Ice Wall (2 after DEF 2, and 4 undefended)", () => {
    const two = withForm(heroGame([ICEMAN_SEAT, SPIDER_MAN]), { heroForm: 0 }, P2);
    const { state: s, wall } = wallGame(two);
    // Player 1 defends with Iceman; player 2 declines to defend.
    const pick: Picker = (st) =>
      st.pendingChoice?.prompt.kind === "declareDefender" && st.pendingChoice.playerId === P2
        ? ["decline"]
        : declineFreeze(st);
    const first = run(stackEncounterDeck(s, "01107", "01108", "01186"), pick, endTurn(P1));
    const second = run(first.state, pick, endTurn(P2));
    const placed = [...first.events, ...second.events].flatMap((e) =>
      e.type === "damagePlaced" && e.targetInstanceId === wall ? [e.amount] : [],
    );
    expect(placed.slice(0, 2)).toEqual([2, 4]);
    // (The card revealed after both attacks puts 3 more on it, which takes it to 9 and discards it: not under test.)
    expect(inst(second.state, identityOf(second.state, P1)).damage).toBe(0);
    expect(inst(second.state, identityOf(second.state, P2)).damage).toBe(0);
  });
  it("is refused for want of its cost (4 hand cards besides itself)", () => {
    const given = moveToHand(heroGame(), P1, ICE_WALL);
    const id = given.ids[0]!;
    expect(applyCommand(given.state, play(P1, id, payWith(given.state, P1, 3, [id])), DEPS).ok).toBe(false);
    expect(applyCommand(given.state, play(P1, id, payWith(given.state, P1, 4, [id])), DEPS).ok).toBe(true);
  });
});

describe("Cryokinetic Perception (46005): after Freeze!, exhaust to draw 1 card; an ICE card readies Iceman", () => {
  const CRYO_RESPONSE = "46005.cryokinetic-perception-response";
  /** Takes "Freeze!" and, when `cryo`, the response it opens; counts how often that response was offered. */
  const cryoPicker =
    (cryo: boolean, offered: string[] = []): Picker =>
    (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind !== "chooseTriggers") return takeFreeze(s);
      const ids = choice.options.map((o) => o.optionId as string);
      const freezeOption = ids.find((id) => id.endsWith(FREEZE));
      if (freezeOption) return [freezeOption];
      const response = ids.find((id) => id.endsWith(CRYO_RESPONSE));
      if (response) offered.push(response);
      return response && cryo ? [response] : [];
    };
  /** Cryokinetic Perception in play (cost 2), hero form, and the card `top` relabeled onto the top of the deck. */
  function cryoGame(top: string) {
    const { state: played, id: cryo } = playFromHand(DEPS, heroGame(), CRYO, 2);
    const first = playerOf(played, P1).deck[0]!;
    return { state: patchInstance(played, first, { cardId: cardId(top) }), cryo, first };
  }
  // Snow Clone 46003 prints the ICE trait; Power Belt 46004 does not.
  it("the card data: Snow Clone has ICE and Power Belt has not", () => {
    const traits = (code: string) => (ICEMAN_CARDS.find((c) => (c.id as string) === code) as any).traits;
    expect(traits(SNOW_CLONE)).toContain(trait("ICE"));
    expect(traits(POWER_BELT)).not.toContain(trait("ICE"));
  });
  it("an ICE card drawn: it is in hand, Cryokinetic Perception is exhausted and Iceman is ready after his basic attack", () => {
    const { state: s, cryo, first } = cryoGame(SNOW_CLONE);
    const hand = playerOf(s, P1).hand.length;
    const { state, events } = run(s, cryoPicker(true), attack(s, villainOf(s)));
    expect(frostbiteOn(state, villainOf(state))).toBe(1);
    expect(playerOf(state, P1).hand).toContain(first);
    expect(playerOf(state, P1).hand).toHaveLength(hand + 1);
    expect(inst(state, cryo).exhausted).toBe(true);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    // The attack still resolved: 2 damage on Rhino.
    expect(inst(state, villainOf(state)).damage).toBe(2);
    expect(events.filter((e) => e.type === "cardDrawn")).toHaveLength(1);
  });
  it("a card without ICE drawn: it is in hand and Iceman stays exhausted", () => {
    const { state: s, cryo, first } = cryoGame(POWER_BELT);
    const { state } = run(s, cryoPicker(true), attack(s, villainOf(s)));
    expect(playerOf(state, P1).hand).toContain(first);
    expect(inst(state, cryo).exhausted).toBe(true);
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
  });
  it("optional: declined, nothing is drawn and the card stays ready", () => {
    const { state: s, cryo, first } = cryoGame(SNOW_CLONE);
    const offered: string[] = [];
    const { state } = run(s, cryoPicker(false, offered), attack(s, villainOf(s)));
    expect(offered).toHaveLength(1);
    expect(playerOf(state, P1).deck[0]).toBe(first);
    expect(inst(state, cryo).exhausted).toBe(false);
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
  });
  it("not offered while exhausted, nor when Freeze! was not taken", () => {
    const { state: s, cryo } = cryoGame(SNOW_CLONE);
    const spent: string[] = [];
    run(patchInstance(s, cryo, { exhausted: true }), cryoPicker(true, spent), attack(s, villainOf(s)));
    expect(spent).toHaveLength(0);
    const noFreeze: Picker = (st) => (st.pendingChoice!.prompt.kind === "chooseTriggers" ? [] : takeFreeze(st));
    const { state } = run(s, noFreeze, attack(s, villainOf(s)));
    expect(frostbiteOn(state, villainOf(state))).toBe(0);
    expect(inst(state, cryo).exhausted).toBe(false);
  });
  it("on the basic defense: the Freeze! taken while defending Rhino's attack opens the same response", () => {
    const { state: s, cryo, first } = cryoGame(SNOW_CLONE);
    const { state } = villainPhase(s, cryoPicker(true));
    expect(playerOf(state, P1).hand).toContain(first);
    expect(inst(state, cryo).exhausted).toBe(true);
  });
});
