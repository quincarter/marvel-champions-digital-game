import type { GameState, InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  patchInstance,
  playerOf,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, playFromHand, withDamage } from "../../testing/staging.js";
import { attachToHost, engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import {
  BLACK_CAT,
  BLANK,
  CAPTAIN_MARVEL,
  CHARGE,
  FILLER_A,
  FILLER_B,
  IRON_MAN,
  ONE_ICON,
  SHE_HULK,
  SPIDER_MAN,
  attacksBy,
  codeOf,
  dataOf,
  heroAttacks as sharedHeroAttacks,
  heroForm,
  heroThwarts as sharedHeroThwarts,
  inDiscard,
  inPlayCard,
  onlyDeck,
  piles,
  revealedCodes,
  schemesBy,
  setKit,
  types,
  without,
  type Seats,
} from "../testing.js";
import { POWER_OF_THE_ATOM, POWER_OF_THE_ATOM_SKIPPED } from "./power-of-the-atom.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Power of the Atom set (50152 Radioactive Man, 50153 Radiation Exposure, 50154 Runaway Nuclear Reaction, 50155
 * Power of the Atom), docs/phase7-wave9.md sections 3.25, 3.34 and 3.35. Rhino (Core, standard) against a Core starter
 * deck, the set's cards added to the encounter deck by hand. Radioactive Man is engaged with `engageMinion`, an
 * attachment is placed with `attachToHost` (or dealt for real), and the hero's attack, thwart and recovery are real
 * commands.
 */
const RM = "50152";
const EXPOSURE = "50153";
const RUNAWAY = "50154";
const ATOM = "50155";
const SET = [RM, EXPOSURE, RUNAWAY, ATOM];
const REFS = [
  "50152.radioactive-man-forced-response",
  "50153.radiation-exposure-constant",
  "50153.radiation-exposure-forced-response",
  "50154.runaway-nuclear-reaction-forced-response",
  "50155.when-revealed",
  "50155.boost",
];

const { deps: DEPS, setupGame, villainPhase } = setKit("power_of_the_atom", POWER_OF_THE_ATOM);
const heroAttacks = (state: GameState, target: InstanceId, player = P1) =>
  sharedHeroAttacks(DEPS, state, target, { player });
const heroThwarts = (state: GameState, scheme: InstanceId, player = P1) =>
  sharedHeroThwarts(DEPS, state, scheme, { player });
const damageOf = (s: GameState, id: InstanceId) => inst(s, id).damage;
/** The player pays a hand-discard cost with the first card offered; any other choice is answered as `firstLegal` does. */
const payingCost: Picker = (s) =>
  s.pendingChoice!.prompt.kind === "chooseCostCards" ? [s.pendingChoice!.options[0]!.optionId] : firstLegal(s);
const recover = (state: GameState, pick: Picker = payingCost) =>
  driveEventsPicking(DEPS, state, pick, { type: "basicRecover", playerId: P1 });
const withMainThreat = (s: GameState, threat: number) => patchInstance(s, s.mainScheme.instanceId, { threat });
const exposed = (state: GameState, player = P1) => attachToHost(state, EXPOSURE, identityOf(state, player));

describe("registry", () => {
  it("registers the six refs of the four cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(POWER_OF_THE_ATOM).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(POWER_OF_THE_ATOM)) expect(validateDefinition(def), id).toEqual([]);
    expect(POWER_OF_THE_ATOM_SKIPPED).toEqual({});
  });

  it("the data names exactly these refs for the four cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("setup: all six encounter copies (1 Radioactive Man, 2 Radiation Exposure, 1 Runaway Nuclear Reaction, 2 Power of the Atom) are in the deck", () => {
    const s = setupGame();
    const counts = SET.map((code) => piles(s).deck.filter((id) => codeOf(s, id) === code).length);
    expect(counts).toEqual([1, 2, 1, dataOf(ATOM).quantityInSet]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(6);
  });
});

describe("Radioactive Man (50152)", () => {
  it("is data: an Elite Thunderbolt unique minion, ATK 2, SCH 1, 18 hit points, 4 boost icons, Villainous, Victory 1", () => {
    const card = dataOf(RM);
    expect([card.atk, card.sch, card.hp, card.boostIcons, card.unique]).toEqual([2, 1, 18, 4, true]);
    expect(card.traits).toEqual(["ELITE", "THUNDERBOLT"]);
    expect(card.keywords).toEqual([{ name: "villainous" }, { name: "victory", value: 1 }]);
  });

  it("FORCED RESPONSE: after his attack on a hero (ATK 2) he deals 1 damage to each character you control: the identity takes 2 + 1, Black Cat 1", () => {
    const { state: withCat, id: cat } = playFromHand(DEPS, setupGame(), BLACK_CAT, 2);
    const { state: engaged } = engageMinion(heroForm(withCat), RM, P1);
    const run = villainPhase(engaged, [BLANK, BLANK, FILLER_A]);
    expect(attacksBy(run.state, run.events, RM)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    expect(damageOf(run.state, cat)).toBe(1);
    const hits = types(run.events, "attackResolved").reduce((n, a) => n + a.damageDealt, 0);
    expect(damageOf(run.state, identityOf(run.state))).toBe(hits + 1);
  });

  it("FORCED RESPONSE: after his scheme against an alter-ego (SCH 1) the identity takes 1 damage and 1 threat is placed", () => {
    const { state: engaged } = engageMinion(setupGame(), RM, P1);
    const run = villainPhase(engaged, [BLANK, BLANK, FILLER_A]);
    expect(schemesBy(run.state, run.events, RM)).toMatchObject([{ baseSch: 1, boostIcons: 0, threatPlaced: 1 }]);
    expect(damageOf(run.state, identityOf(run.state))).toBe(1);
  });

  it("FORCED RESPONSE: only the player he activates against suffers it: engaged with player 2, player 1's identity takes only Rhino's attack", () => {
    const { state: engaged } = engageMinion(heroForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1, P2), RM, P2);
    const run = villainPhase(engaged, [FILLER_A, BLANK, BLANK, FILLER_B]);
    const rhinoOnOne = types(run.events, "attackResolved").filter(
      (a) => a.targetInstanceId === identityOf(run.state, P1),
    );
    expect(rhinoOnOne).toHaveLength(1);
    expect(damageOf(run.state, identityOf(run.state, P1))).toBe(rhinoOnOne[0]!.damageDealt);
    const rmHit = attacksBy(run.state, run.events, RM)[0]!;
    expect(rmHit.damageDealt).toBe(2);
    expect(damageOf(run.state, identityOf(run.state, P2))).toBe(
      types(run.events, "attackResolved")
        .filter((a) => a.targetInstanceId === identityOf(run.state, P2))
        .reduce((n, a) => n + a.damageDealt, 0) + 1,
    );
  });

  it("no other enemy's activation triggers it: Rhino alone attacks and nobody takes the extra 1", () => {
    const run = villainPhase(heroForm(setupGame()), [BLANK, FILLER_A]);
    const [rhino] = types(run.events, "attackResolved");
    expect(damageOf(run.state, identityOf(run.state))).toBe(rhino!.damageDealt);
  });

  it("VILLAINOUS: he is dealt a boost card, a 1-icon boost makes his attack 2 + 1 = 3", () => {
    const { state: engaged } = engageMinion(heroForm(setupGame()), RM, P1);
    const run = villainPhase(engaged, [BLANK, ONE_ICON, FILLER_A]);
    expect(attacksBy(run.state, run.events, RM)).toMatchObject([{ baseAtk: 2, boostIcons: 1, damageDealt: 3 }]);
  });
});

describe("Radiation Exposure (50153)", () => {
  it("is data: a Condition attachment for your identity, ATK -1 and THW -1 (the RRG 1.8 erratum: not SCH), 2 boost icons, two copies", () => {
    const card = dataOf(EXPOSURE);
    expect([card.type, card.boostIcons, card.quantityInSet, card.traits]).toEqual(["attachment", 2, 2, ["CONDITION"]]);
    expect(card.statModifiers).toEqual({ atk: -1, thw: -1 });
    expect(card.attachesTo).toEqual({ kind: "yourIdentity" });
  });

  it("dealt as a boost-free encounter card it attaches to the identity of the player it is dealt to", () => {
    const run = villainPhase(setupGame(), [BLANK, EXPOSURE]);
    const id = inPlayCard(run.state, EXPOSURE)!;
    expect(inst(run.state, id).attachedTo).toBe(identityOf(run.state));
  });

  it("CONSTANT: Spider-Man (ATK 2, not Gamma) has ATK 1: his basic attack deals 1, not 2", () => {
    const { state: engaged, id: rm } = engageMinion(heroForm(setupGame()), RM, P1);
    const base = heroAttacks(engaged, rm);
    expect(damageOf(base.state, rm)).toBe(2);
    const { state } = exposed(engaged);
    const run = heroAttacks(state, rm);
    expect(damageOf(run.state, rm)).toBe(1);
  });

  it("CONSTANT (the erratum): the other box is THW, -1: Iron Man (THW 2) removes 1 threat from the main scheme instead of 2", () => {
    const hero = withMainThreat(heroForm(setupGame([IRON_MAN])), 5);
    const main = hero.mainScheme.instanceId;
    const before = mainThreat(hero);
    const base = heroThwarts(hero, main);
    expect(before - mainThreat(base.state)).toBe(2);
    const run = heroThwarts(exposed(hero).state, main);
    expect(before - mainThreat(run.state)).toBe(1);
  });

  it("CONSTANT, Gamma: She-Hulk (ATK 3, Gamma) gets +1 ATK instead of -1: her basic attack deals 4; THW stays -1 (1 - 1 = 0 removes none)", () => {
    const { state: engaged, id: rm } = engageMinion(heroForm(setupGame([SHE_HULK])), RM, P1);
    const base = heroAttacks(engaged, rm);
    expect(damageOf(base.state, rm)).toBe(3);
    const run = heroAttacks(exposed(engaged).state, rm);
    expect(damageOf(run.state, rm)).toBe(4);
    const hero = withMainThreat(heroForm(setupGame([SHE_HULK])), 5);
    const thwart = heroThwarts(exposed(hero).state, hero.mainScheme.instanceId);
    expect(mainThreat(thwart.state)).toBe(mainThreat(hero));
  });

  it("FORCED RESPONSE: after you recover, one card is discarded from your hand and this card is discarded", () => {
    const hurt = withDamage(setupGame(), identityOf(setupGame()), 4);
    const { state, id } = exposed(hurt);
    const handBefore = playerOf(state, P1).hand.length;
    const run = recover(state);
    expect(playerOf(run.state, P1).hand).toHaveLength(handBefore - 1);
    expect(playerOf(run.state, P1).discard).toHaveLength(playerOf(state, P1).discard.length + 1);
    expect(inDiscard(run.state, EXPOSURE)).toContain(id);
    expect(inPlayCard(run.state, EXPOSURE)).toBeUndefined();
  });

  it("FORCED RESPONSE: with an empty hand the cost cannot be paid and the card stays", () => {
    const hurt = withDamage(setupGame(), identityOf(setupGame()), 4);
    const empty = {
      ...hurt,
      players: hurt.players.map((p) => (p.playerId === P1 ? { ...p, hand: [] } : p)),
    };
    const { state } = exposed(empty);
    const run = recover(state);
    expect(inPlayCard(run.state, EXPOSURE)).toBeDefined();
  });
});

describe("Runaway Nuclear Reaction (50154)", () => {
  it("is data: a side scheme with 5 threat (not per hero), crisis, 3 boost icons", () => {
    const card = dataOf(RUNAWAY);
    expect([card.type, card.startingThreat, card.boostIcons]).toEqual(["side_scheme", { base: 5, perPlayer: 0 }, 3]);
    expect(card.icons).toEqual(["crisis"]);
  });

  /** Round 1 reveals the scheme (5 threat); Radioactive Man then stands engaged in a fresh hero-form turn. */
  function withScheme(players: Seats = [SHE_HULK]) {
    const revealed = villainPhase(setupGame(players), [BLANK, RUNAWAY]).state;
    const scheme = inPlayCard(revealed, RUNAWAY)!;
    const { state, id } = engageMinion(heroForm(revealed), RM, P1);
    return { state, scheme, rm: id };
  }

  it("is placed with 5 threat", () => {
    const { state, scheme } = withScheme();
    expect(inst(state, scheme).threat).toBe(5);
  });

  it("FORCED RESPONSE: She-Hulk deals 3 to Radioactive Man: 3 threat is placed here (5 + 3 = 8), below 10 nothing else happens", () => {
    const { state, scheme, rm } = withScheme();
    const run = heroAttacks(state, rm);
    expect(damageOf(run.state, rm)).toBe(3);
    expect(inst(run.state, scheme).threat).toBe(8);
    expect(inPlayCard(run.state, RUNAWAY)).toBe(scheme);
    expect(damageOf(run.state, identityOf(run.state))).toBe(0);
  });

  it("FORCED RESPONSE: reaching 10 threat (7 + 3): 10 damage to each character, enemies and the hero alike, and it is discarded", () => {
    const { state, scheme, rm } = withScheme();
    const run = heroAttacks(patchInstance(state, scheme, { threat: 7 }), rm);
    expect(inPlayCard(run.state, RUNAWAY)).toBeUndefined();
    expect(inDiscard(run.state, RUNAWAY)).toContain(scheme);
    expect(damageOf(run.state, rm)).toBe(3 + 10);
    expect(damageOf(run.state, identityOf(run.state))).toBe(10);
    expect(damageOf(run.state, run.state.villains[0]!.instanceId)).toBe(10);
  });

  it("FORCED RESPONSE: threat past 10 (9 + 3 = 12) still triggers it once", () => {
    const { state, scheme, rm } = withScheme();
    const run = heroAttacks(patchInstance(state, scheme, { threat: 9 }), rm);
    expect(inPlayCard(run.state, RUNAWAY)).toBeUndefined();
    expect(damageOf(run.state, rm)).toBe(13);
  });

  it("FORCED RESPONSE: damage dealt to anyone else (the villain) places no threat here", () => {
    const { state, scheme } = withScheme();
    const run = heroAttacks(state, state.villains[0]!.instanceId);
    expect(inst(run.state, scheme).threat).toBe(5);
  });

  it("FORCED RESPONSE: damage dealt counts even when a tough status card stops it (RM takes 0, 3 threat is placed)", () => {
    const { state, scheme, rm } = withScheme();
    const toughRm = patchInstance(state, rm, { statuses: { ...inst(state, rm).statuses, tough: 1 } });
    const run = heroAttacks(toughRm, rm);
    expect(damageOf(run.state, rm)).toBe(0);
    expect(inst(run.state, scheme).threat).toBe(8);
  });
});

describe("Power of the Atom (50155)", () => {
  it("is data: a treachery with no boost icon and a star, two copies", () => {
    const card = dataOf(ATOM);
    expect([card.type, card.boostIcons ?? 0, card.starIcon, card.quantityInSet]).toEqual(["treachery", 0, true, 2]);
  });

  it("WHEN REVEALED (hero): Radioactive Man is found, engages the revealing player and attacks: ATK 2 + 1 icon = 3, then his 1 damage; no surge", () => {
    const run = villainPhase(onlyDeck(heroForm(setupGame()), BLANK, ATOM, RM, ONE_ICON), []);
    const rm = inPlayCard(run.state, RM)!;
    expect(inst(run.state, rm).engagedWith).toBe(P1);
    expect(attacksBy(run.state, run.events, RM)).toMatchObject([{ baseAtk: 2, boostIcons: 1, damageDealt: 3 }]);
    const hits = types(run.events, "attackResolved").reduce((n, a) => n + a.damageDealt, 0);
    expect(damageOf(run.state, identityOf(run.state))).toBe(hits + 1);
    expect(revealedCodes(run.state, run.events)).toEqual([ATOM, RM]);
  });

  it("WHEN REVEALED (alter-ego): he schemes against the player: SCH 1 + 1 icon = 2 threat; the identity takes 1", () => {
    const run = villainPhase(onlyDeck(setupGame(), BLANK, ATOM, RM, ONE_ICON), []);
    expect(schemesBy(run.state, run.events, RM)).toMatchObject([{ baseSch: 1, boostIcons: 1, threatPlaced: 2 }]);
    expect(damageOf(run.state, identityOf(run.state))).toBe(1);
  });

  it("WHEN REVEALED: with Radioactive Man already in play (engaged with player 2) he engages the revealing player 1 and attacks them", () => {
    const { state: engaged, id } = engageMinion(heroForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1, P2), RM, P2);
    const run = villainPhase(onlyDeck(engaged, FILLER_A, BLANK, BLANK, ATOM, CHARGE, CHARGE), []);
    expect(inst(run.state, id).engagedWith).toBe(P1);
    // Against player 2 (ATK 2), then against player 1 with a Charge boost (2 icons): 2 + 2.
    expect(attacksBy(run.state, run.events, RM).map((a) => a.damageDealt)).toEqual([2, 4]);
  });

  it("WHEN REVEALED: with no Radioactive Man anywhere nothing activates and this card gains surge: the next card is revealed", () => {
    const run = villainPhase(onlyDeck(without(setupGame(), RM), BLANK, ATOM, FILLER_A), []);
    expect(revealedCodes(run.state, run.events)).toEqual([ATOM, FILLER_A]);
    expect(inPlayCard(run.state, RM)).toBeUndefined();
  });

  it("BOOST: you take 2 indirect damage (Rhino attacks a hero: his hit plus 2)", () => {
    const run = villainPhase(heroForm(setupGame()), [ATOM, FILLER_A]);
    const [attack] = types(run.events, "attackResolved");
    expect(attack!.boostIcons).toBe(0);
    expect(damageOf(run.state, identityOf(run.state))).toBe(attack!.damageDealt + 2);
  });
});
