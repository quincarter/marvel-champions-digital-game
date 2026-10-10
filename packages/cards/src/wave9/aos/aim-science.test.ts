import { applyCommand, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import { P1, P2, identityOf, inst, mainThreat, patchInstance } from "../../testing/harness.js";
import { encounterCardInVillainArea } from "../../testing/staging.js";
import { engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import {
  BLANK,
  CAPTAIN_MARVEL,
  FILLER_A,
  FILLER_B,
  SPIDER_MAN,
  attacksBy,
  codeOf,
  dataOf,
  heroAttacks,
  heroForm,
  inDiscard,
  inDiscardPile,
  inPlayCard,
  onlyDeck,
  piles,
  revealedCodes,
  setKit,
  stunWith,
  types,
  without,
} from "../testing.js";
import { AIM_SCIENCE, AIM_SCIENCE_SKIPPED } from "./aim-science.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The A.I.M. Science set (50083 A.I.M. Scientist, 50084 A.I.M. Soldier, 50085 Mad Science), docs/phase7-wave9.md
 * sections 3.1, 3.33 and 3.35. Rhino (Core, standard) against a Spider-Man starter deck, the set's cards added to the
 * encounter deck by hand. Minions are engaged with `engageMinion`; the Scientist is stunned by a real Mockingbird
 * (`stunWith`) to exercise Vulnerable.
 */
const SCIENTIST = "50083";
const SOLDIER = "50084";
const MAD_SCIENCE = "50085";
const SHOCKER = "01103";
const SET = [SCIENTIST, SOLDIER, MAD_SCIENCE];
const REFS = ["50083.aim-scientist-constant", "50084.when-revealed", "50085.mad-science-constant"];

const { deps: DEPS, setupGame, villainPhase } = setKit("a.i.m._science", AIM_SCIENCE);
const damageOf = (s: GameState, id: InstanceId) => inst(s, id).damage;
const attackRejected = (state: GameState, target: InstanceId, player = P1) =>
  applyCommand(
    state,
    {
      type: "basicAttack",
      playerId: player,
      attackerInstanceId: identityOf(state, player),
      targetInstanceId: target,
    },
    DEPS,
  );

describe("registry", () => {
  it("registers the three refs of the three cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(AIM_SCIENCE).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(AIM_SCIENCE)) expect(validateDefinition(def), id).toEqual([]);
    expect(AIM_SCIENCE_SKIPPED).toEqual({});
  });

  it("the data names exactly the registered refs for the three cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("setup: every encounter copy of the three cards is in the deck (1 Scientist, 3 Soldiers, 1 Mad Science)", () => {
    const s = setupGame();
    const counts = SET.map((code) => piles(s).deck.filter((id) => codeOf(s, id) === code).length);
    expect(counts).toEqual([1, 3, 1]);
  });
});

describe("A.I.M. Scientist (50083)", () => {
  it("is data: an A.I.M. minion, ATK 0, SCH 0, 2 hit points, an acceleration icon, Surge and Vulnerable", () => {
    const card = dataOf(SCIENTIST);
    expect([card.atk, card.sch, card.hp, card.schemeIcons, card.traits]).toEqual([
      0,
      0,
      2,
      ["acceleration"],
      ["A.I.M."],
    ]);
    expect(card.keywords).toEqual([{ name: "surge" }, { name: "vulnerable" }]);
  });

  it("CONSTANT: engaged alone with its player it can be attacked: 2 damage from Spider-Man defeats it (2 hit points)", () => {
    const { state, id } = engageMinion(heroForm(setupGame()), SCIENTIST, P1);
    const run = heroAttacks(DEPS, state, id);
    expect(types(run.events, "characterDefeated")).toHaveLength(1);
    expect(inDiscard(run.state, SCIENTIST)).toEqual([id]);
  });

  it("CONSTANT: while its player is engaged with another minion it cannot be attacked (the attack is rejected, no damage), but the other minion can", () => {
    const base = heroForm(setupGame());
    const { state: withSoldier, id: soldier } = engageMinion(base, SOLDIER, P1);
    const { state, id } = engageMinion(withSoldier, SCIENTIST, P1);
    const rejected = attackRejected(state, id);
    expect(rejected.ok).toBe(false);
    expect(damageOf(state, id)).toBe(0);
    const hitSoldier = heroAttacks(DEPS, state, soldier);
    expect(damageOf(hitSoldier.state, soldier)).toBe(2);
  });

  it("CONSTANT: it can be attacked again once the other minion is gone (the Soldier, 3 hit points with 1 damage, is defeated by an attack of 2)", () => {
    const base = heroForm(setupGame());
    const { state: withSoldier, id: soldier } = engageMinion(base, SOLDIER, P1);
    const { state, id } = engageMinion(withSoldier, SCIENTIST, P1);
    expect(attackRejected(state, id).ok).toBe(false);
    // The Soldier (3 hit points) at 1 damage is defeated by Spider-Man's attack of 2.
    const soldierAtOne = {
      ...state,
      instances: { ...state.instances, [soldier]: { ...inst(state, soldier), damage: 1 } },
    };
    const killed = heroAttacks(DEPS, soldierAtOne, soldier);
    expect(inDiscard(killed.state, SOLDIER)).toEqual([soldier]);
    // The attack exhausted Spider-Man; ready him again to ask only whether the rule still forbids the attack.
    const ready = patchInstance(killed.state, identityOf(killed.state), { exhausted: false });
    expect(attackRejected(ready, id).ok).toBe(true);
  });

  it("CONSTANT: only the engaged player's own engagement counts: with the Soldier engaged with player 2, player 1 can attack the Scientist", () => {
    const base = heroForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1, P2);
    const { state: withSoldier } = engageMinion(base, SOLDIER, P2);
    const { state, id } = engageMinion(withSoldier, SCIENTIST, P1);
    expect(attackRejected(state, id, P1).ok).toBe(true);
  });

  it("VULNERABLE (Mockingbird stuns it): discarded at once, not defeated: it is in the encounter discard pile with no damage and no defeat in the log", () => {
    const { state, id } = engageMinion(heroForm(setupGame()), SCIENTIST, P1);
    const run = stunWith(DEPS, state, id);
    expect(types(run.events, "characterDefeated")).toEqual([]);
    expect(inPlayCard(run.state, SCIENTIST)).toBeUndefined();
    expect(inDiscard(run.state, SCIENTIST)).toEqual([id]);
    expect(damageOf(run.state, id)).toBe(0);
  });

  it("SURGE: revealed it engages the player and the next card is revealed too", () => {
    const run = villainPhase(heroForm(setupGame()), [BLANK, SCIENTIST, FILLER_A]);
    expect(revealedCodes(run.state, run.events)).toEqual([SCIENTIST, FILLER_A]);
    expect(inst(run.state, inPlayCard(run.state, SCIENTIST)!).engagedWith).toBe(P1);
  });

  it("ACCELERATION ICON: in play it adds 1 threat to the main scheme each villain phase (ATK 0 and SCH 0 add nothing)", () => {
    const base = heroForm(setupGame());
    const control = villainPhase(base, [BLANK, FILLER_A]);
    const { state } = engageMinion(base, SCIENTIST, P1);
    const run = villainPhase(state, [BLANK, FILLER_A]);
    expect(mainThreat(run.state) - mainThreat(control.state)).toBe(1);
    // Only a villain or a villainous minion is dealt a boost card (RRG 1.8 "Boost", p. 11), so the stack is unchanged.
    expect(attacksBy(run.state, run.events, SCIENTIST)).toMatchObject([{ baseAtk: 0, damageDealt: 0 }]);
  });
});

describe("A.I.M. Soldier (50084)", () => {
  it("is data: an A.I.M. minion, ATK 2, SCH 1, 3 hit points, 1 boost icon, Patrol", () => {
    const card = dataOf(SOLDIER);
    expect([card.atk, card.sch, card.hp, card.boostIcons, card.traits]).toEqual([2, 1, 3, 1, ["A.I.M."]]);
    expect(card.keywords).toEqual([{ name: "patrol" }]);
  });

  /** The main scheme's threat after a villain phase in which the first player reveals `stack`'s encounter card. */
  const threatAfter = (state: GameState, ...stack: string[]) => mainThreat(villainPhase(state, stack).state);

  it("WHEN REVEALED: the Scientist is found in the deck and put into play engaged with you; it entered play, so no threat is placed", () => {
    const state = heroForm(setupGame());
    const control = threatAfter(state, BLANK, FILLER_A);
    const run = villainPhase(onlyDeck(state, BLANK, SOLDIER, SCIENTIST), []);
    const scientist = inPlayCard(run.state, SCIENTIST)!;
    expect(inst(run.state, scientist).engagedWith).toBe(P1);
    expect(piles(run.state).deck.map((id) => codeOf(run.state, id))).not.toContain(SCIENTIST);
    expect(mainThreat(run.state)).toBe(control);
    // Found, not revealed: no surge, only the Soldier was revealed.
    expect(revealedCodes(run.state, run.events)).toEqual([SOLDIER]);
  });

  it("WHEN REVEALED: found in the encounter discard pile it is put into play engaged with you just the same", () => {
    const state = inDiscardPile(heroForm(setupGame()), SCIENTIST);
    const control = threatAfter(heroForm(setupGame()), BLANK, FILLER_A);
    const run = villainPhase(state, [BLANK, SOLDIER]);
    expect(inst(run.state, inPlayCard(run.state, SCIENTIST)!).engagedWith).toBe(P1);
    expect(inDiscard(run.state, SCIENTIST)).toEqual([]);
    expect(mainThreat(run.state)).toBe(control);
  });

  it("WHEN REVEALED: with the Scientist already in play engaged with player 1 and the Soldier revealed by player 2, the Scientist engages player 2, and 1 threat goes on the main scheme (it did not enter play)", () => {
    const base = heroForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1, P2);
    const { state: engaged, id } = engageMinion(base, SCIENTIST, P1);
    const control = villainPhase(engaged, [BLANK, FILLER_A, FILLER_B]);
    const run = villainPhase(onlyDeck(engaged, BLANK, SOLDIER, FILLER_A), []);
    expect(
      types(run.events, "encounterCardRevealed").find((e) => codeOf(run.state, e.instanceId) === SOLDIER),
    ).toMatchObject({
      playerId: P2,
    });
    expect(inst(run.state, id).engagedWith).toBe(P2);
    // The Scientist's acceleration icon counts in both runs; the Soldier adds exactly 1 more.
    expect(mainThreat(run.state) - mainThreat(control.state)).toBe(1);
  });

  it("WHEN REVEALED: the Scientist already engaged with you stays, and 1 threat is placed", () => {
    const base = heroForm(setupGame());
    const { state: engaged, id } = engageMinion(base, SCIENTIST, P1);
    const control = villainPhase(engaged, [BLANK, FILLER_A]);
    const run = villainPhase(onlyDeck(engaged, BLANK, SOLDIER), []);
    expect(inst(run.state, id).engagedWith).toBe(P1);
    expect(mainThreat(run.state) - mainThreat(control.state)).toBe(1);
  });

  it("WHEN REVEALED: with the Scientist nowhere to be found, 1 threat is placed on the main scheme", () => {
    const state = without(heroForm(setupGame()), SCIENTIST);
    const control = threatAfter(state, BLANK, FILLER_A);
    const run = villainPhase(state, [BLANK, SOLDIER]);
    expect(inPlayCard(run.state, SCIENTIST)).toBeUndefined();
    expect(mainThreat(run.state) - control).toBe(1);
  });

  it("the Soldier itself is engaged with the player that revealed it, and Patrol is data", () => {
    const run = villainPhase(onlyDeck(heroForm(setupGame()), BLANK, SOLDIER, SCIENTIST), []);
    expect(inst(run.state, inPlayCard(run.state, SOLDIER)!).engagedWith).toBe(P1);
  });
});

describe("Mad Science (50085)", () => {
  it("is data: a side scheme with 2 threat, an acceleration icon, 3 boost icons, Hinder 2 per hero", () => {
    const card = dataOf(MAD_SCIENCE);
    expect([card.type, card.startingThreat, card.icons, card.boostIcons, card.keywords]).toEqual([
      "side_scheme",
      { base: 2, perPlayer: 0 },
      ["acceleration"],
      3,
      [{ name: "hinder", value: 0, perPlayer: 2 }],
    ]);
  });

  /** One villain phase with two Soldiers engaged, Mad Science in play or not. */
  function phase(withMadScience: boolean) {
    let state = heroForm(setupGame());
    state = engageMinion(state, SOLDIER, P1).state;
    state = engageMinion(state, SOLDIER, P1).state;
    if (withMadScience) state = encounterCardInVillainArea(state, MAD_SCIENCE, 2).state;
    return villainPhase(state, [BLANK, FILLER_A]);
  }

  it("CONSTANT: each A.I.M. minion gains 1 acceleration icon: two Soldiers add 2, and the scheme's own printed icon 1 more (3 in all)", () => {
    expect(mainThreat(phase(true).state) - mainThreat(phase(false).state)).toBe(3);
  });

  it("CONSTANT: it stacks with the Scientist's printed icon (1 printed + 1 gained = 2) beside the scheme's own 1", () => {
    const base = heroForm(setupGame());
    const { state: engaged } = engageMinion(base, SCIENTIST, P1);
    const control = villainPhase(engaged, [BLANK, FILLER_A]);
    const { state } = encounterCardInVillainArea(engaged, MAD_SCIENCE, 2);
    const run = villainPhase(state, [BLANK, FILLER_A]);
    expect(mainThreat(run.state) - mainThreat(control.state)).toBe(2);
  });

  it("CONSTANT: a minion without the A.I.M. trait (Shocker) gains nothing: only the scheme's own icon is added", () => {
    const withShocker = (madScience: boolean) => {
      let state = engageMinion(heroForm(setupGame()), SHOCKER, P1).state;
      if (madScience) state = encounterCardInVillainArea(state, MAD_SCIENCE, 2).state;
      return mainThreat(villainPhase(state, [BLANK, FILLER_A]).state);
    };
    expect(withShocker(true) - withShocker(false)).toBe(1);
  });
});
