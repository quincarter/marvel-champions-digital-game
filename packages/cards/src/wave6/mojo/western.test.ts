import {
  activeEncounterDeck,
  activeVillain,
  cardsInPlay,
  createGame,
  hasKeyword,
  replay,
  maxHitPoints,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { WAVE6_DEPS, wave6Scenario } from "../index.js";
import { playToOutcome } from "../../testing/driver.js";
import {
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  picking,
  settle,
  type Picker,
  play,
  P1,
  P2,
  patchInstance,
  putOnTopOfDeck,
  playerOf,
  stackEncounterDeck,
  toHero,
  runWith,
} from "../../testing/harness.js";
import {
  defeatWithAttack,
  driveEventsPicking,
  encounterCardInVillainArea,
  moveToDiscard,
} from "../../testing/staging.js";
import { attachToHost, engageMinion, handWith } from "../mut_gen/project-wideawake-testing.js";
import { intoPlayArea } from "../mut_gen/magneto-testing.js";
import { chosen, encounterCards, revealCard, selectCards, whenRevealed } from "../../dsl/index.js";
import { WESTERN_ABILITIES } from "./western.js";
import { inEncounterPiles, inPlay, westernGame, withHand } from "./western-testing.js";

const deps: EngineDeps = WAVE6_DEPS;
const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(deps, state, ...commands);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const codeOf = (state: GameState, id: InstanceId) => state.instances[id]!.cardId as string;

const WILD_WILD_MOJO = "39066";
const DEAD_OR_ALIVE = "39067";
const CARD_SHARK = "39068";
const GUNSLINGER = "39069";
const GAME_OF_CARDS = "39070";
const NO_BOOST = "01187";

const hero = (state: GameState) => identityOf(state, P1);
const ironMan = () => westernGame({ players: [{ starterDeckId: "core-iron-man-aggression" }] });

describe("registry", () => {
  it("registers every ability ref of the Western set", () => {
    expect(Object.keys(WESTERN_ABILITIES).sort()).toEqual(
      [
        "39066.wild-wild-mojo-constant",
        "39066.wild-wild-mojo-forced-interrupt",
        "39066.when-revealed",
        "39067.dead-or-alive-constant",
        "39067.dead-or-alive-constant-2",
        "39067.dead-or-alive-forced-interrupt",
        "39068.card-shark-forced-response",
        "39069.gunslinger-forced-interrupt",
        "39070.when-revealed",
      ].sort(),
    );
  });

  it("the set's five cards are in the game from data", () => {
    const state = westernGame();
    for (const code of [WILD_WILD_MOJO, DEAD_OR_ALIVE, CARD_SHARK, GUNSLINGER, GAME_OF_CARDS])
      expect(inEncounterPiles(state, code).length, code).toBeGreaterThanOrEqual(1);
    expect(inEncounterPiles(state, GUNSLINGER)).toHaveLength(2);
  });
});

describe("Wild Wild Mojo (39066)", () => {
  it("reveals from the encounter deck: enters play, gains surge (the next card is revealed too)", () => {
    const state = run(westernGame(), toHero(P1));
    const stacked = stackEncounterDeck(state, NO_BOOST, WILD_WILD_MOJO, GAME_OF_CARDS);
    const { state: after, events } = driveEventsPicking(deps, stacked, firstLegal, { type: "endTurn", playerId: P1 });
    expect(inPlay(after, WILD_WILD_MOJO)).toHaveLength(1);
    const revealed = of(events, "encounterCardRevealed").map((e) => e.cardId as string);
    expect(revealed).toEqual(expect.arrayContaining([WILD_WILD_MOJO, GAME_OF_CARDS]));
  });

  it("When Revealed: discards each other SETTING environment in play", () => {
    const base = westernGame({ modularSetIds: ["western", "crime"] });
    // The Crime SHOW environment (Dial M for Mojo, 39035) is a SETTING too.
    const { state: withSetting, id: setting } = encounterCardInVillainArea(base, "39035");
    const state = run(withSetting, toHero(P1));
    const stacked = stackEncounterDeck(state, NO_BOOST, WILD_WILD_MOJO);
    const { state: after } = driveEventsPicking(deps, stacked, firstLegal, { type: "endTurn", playerId: P1 });
    expect(inPlay(after, WILD_WILD_MOJO)).toHaveLength(1);
    expect(cardsInPlay(after)).not.toContain(setting);
    expect(activeEncounterDeck(after).discard).toContain(setting);
  });

  it("does not surge when revealed by a search (insert p. 18: not 'revealed from the encounter deck')", () => {
    const state = run(westernGame({ modularSetIds: ["western", "acolytes"] }), toHero(P1));
    // Zeal for the Cause stands in for "search the encounter deck for Wild Wild Mojo and reveal it".
    const searching: EngineDeps = {
      ...deps,
      abilities: {
        ...deps.abilities,
        "32164.when-revealed": whenRevealed(
          selectCards("found", encounterCards(["deck", "discard"], { name: "Wild Wild Mojo" })),
          revealCard(chosen("found")),
        ),
      },
    };
    const stacked = stackEncounterDeck(state, NO_BOOST, "32164", GAME_OF_CARDS);
    const { state: after, events } = driveEventsPicking(searching, stacked, firstLegal, {
      type: "endTurn",
      playerId: P1,
    });
    expect(inPlay(after, WILD_WILD_MOJO)).toHaveLength(1);
    const revealed = of(events, "encounterCardRevealed").map((e) => e.cardId as string);
    expect(revealed).toEqual(expect.arrayContaining(["32164", WILD_WILD_MOJO]));
    // No surge: the card stacked behind Zeal for the Cause was never revealed.
    expect(revealed).not.toContain(GAME_OF_CARDS);
    expect(inEncounterPiles(after, GAME_OF_CARDS)).toHaveLength(1);
  });

  it("every enemy attack gains overkill: an ally defeated by the villain's attack spills +1 to the hero, on +1 damage (FAQ #66)", () => {
    const staged = run(ironMan(), toHero(P1));
    const { state: base, id: ally } = intoPlayArea(staged, P1, "01051"); // Tigra, 3 hit points
    const hurt = patchInstance(base, ally, { damage: 2 }); // 1 hit point left
    const declare = (s: GameState) =>
      s.pendingChoice?.prompt.kind === "declareDefender" && s.pendingChoice.options.some((o) => o.optionId === ally)
        ? [ally as string]
        : firstLegal(s);
    const phase = (state: GameState) =>
      driveEventsPicking(deps, stackEncounterDeck(state, NO_BOOST, NO_BOOST), declare, {
        type: "endTurn",
        playerId: P1,
      });
    const damageTo = (events: readonly GameEvent[], id: InstanceId) =>
      of(events, "damageDealt")
        .filter((e) => e.targetInstanceId === id)
        .map((e) => e.amount);
    const control = phase(hurt);
    // Magneto attacks twice a round here (the second, undefended, is his own activation): ATK 2 each.
    expect(damageTo(control.events, ally)).toEqual([2]);
    expect(damageTo(control.events, hero(hurt))).toEqual([2]);

    const { state: withMojo } = encounterCardInVillainArea(hurt, WILD_WILD_MOJO);
    // The attack gains the keyword, not the enemy making it (RRG 1.8 "Overkill", p. 31).
    expect(hasKeyword(withMojo, activeVillain(withMojo)!.instanceId, "overkill", deps)).toBe(false);
    const mojo = phase(withMojo);
    // The ally takes 2 + 1; its 2 excess hit points spill to the hero as a damage event of its own, so +1 again (3),
    // ahead of the second attack's own 2 + 1.
    expect(damageTo(mojo.events, ally)).toEqual([3]);
    expect(damageTo(mojo.events, hero(hurt))).toEqual([3, 3]);
  });

  it("FAQ #66: an overkill attack that defeats a minion is +1 on the minion and +1 on the spill to the villain", () => {
    const opened = ironMan();
    const hero1 = run(opened, toHero(P1));
    const engaged = engageMinion(hero1, GUNSLINGER, P1); // 3 hit points
    const villain = activeVillain(engaged.state)!.instanceId;
    // The villain's own tough status card would absorb the spill.
    engaged.state = patchInstance(engaged.state, villain, {
      statuses: { ...inst(engaged.state, villain).statuses, tough: 0 },
    });
    const cards = moveToHand(engaged.state, P1, "01053"); // Relentless Assault: 5 damage to a minion, overkill if paid [physical]
    const physical = handWith(cards.state, P1, "physical", 1);
    const pay = [
      physical.ids[0]!,
      ...playerOf(physical.state, P1)
        .hand.filter((id) => id !== cards.ids[0] && id !== physical.ids[0])
        .slice(0, 2),
    ];
    const attack = (state: GameState) =>
      driveEventsPicking(deps, state, picking(engaged.id), play(P1, cards.ids[0]!, pay));
    const control = attack(physical.state);
    expect(inst(control.state, villain).damage - inst(physical.state, villain).damage).toBe(5 - 3);
    const { state: withMojo } = encounterCardInVillainArea(physical.state, WILD_WILD_MOJO);
    const mojo = attack(withMojo);
    // 5 + 1 to the minion, 3 excess, + 1 on the spill: the total overkill damage is increased by 2 (RRG 1.8 p. 64).
    expect(inst(mojo.state, villain).damage - inst(withMojo, villain).damage).toBe(5 + 1 - 3 + 1);
  });

  it("an ally's consequential damage is +1 only when it takes at least 1 (insert p. 18)", () => {
    const staged = run(westernGame(), toHero(P1));
    const withCat = intoPlayArea(staged, P1, "01002"); // Black Cat: ATK 1, 2 hit points, consequential 0 (attack) / 1 (thwart)
    const cat = withCat.id;
    const minion = engageMinion(withCat.state, GUNSLINGER, P1);
    const { state: withMojo } = encounterCardInVillainArea(minion.state, WILD_WILD_MOJO);
    // Attacking: 0 consequential damage is not damage, so Wild Wild Mojo has nothing to increase.
    const attacked = run(withMojo, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: cat,
      targetInstanceId: minion.id,
    });
    expect(inst(attacked, cat).damage).toBe(0);
    // Thwarting: 1 consequential damage becomes 2, which defeats her.
    const thwarted = run(withMojo, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: cat,
      schemeInstanceId: withMojo.mainScheme.instanceId,
    });
    expect(playerOf(thwarted, P1).playArea).not.toContain(cat);
    // Control: without Wild Wild Mojo the same thwart leaves her damaged by 1.
    const control = run(minion.state, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: cat,
      schemeInstanceId: minion.state.mainScheme.instanceId,
    });
    expect(inst(control, cat).damage).toBe(1);
  });
});

/** The hero form, past the response window a form change can open (She-Hulk's "Do You Even Lift?"). */
const heroGame = (starterDeckId: string): GameState =>
  settle(run(westernGame({ players: [{ starterDeckId }] }), toHero(P1)), firstLegal, undefined, deps);
/** A zero-boost-icon encounter card, to be the boost card of an activation (and a harmless deal). */
const ZERO_BOOST = ["01186", "01186", "01187", "01187", "32153", "32153", "32154", "32154"];
/** The villain's boost card; an engaged minion's activation takes none here. */
const VILLAIN_BOOST = [ZERO_BOOST[0]!];
/** P1 ends their turn with these encounter cards stacked on top of the deck, `picker` answering every prompt. */
const endTurnWith = (state: GameState, picker: Picker, ...codes: string[]) =>
  driveEventsPicking(deps, stackEncounterDeck(state, ...codes), picker, { type: "endTurn", playerId: P1 });
const damageTo = (events: readonly GameEvent[], id: InstanceId) =>
  of(events, "damageDealt")
    .filter((e) => e.targetInstanceId === id)
    .map((e) => e.amount);
const attacksBy = (events: readonly GameEvent[], id: InstanceId) =>
  of(events, "attackResolved").filter((e) => e.enemyInstanceId === id);
/** Picks `ids` at a `spendResources` prompt (payment cards are options named `hand:<id>`), else the first legal. */
const paying =
  (...ids: readonly InstanceId[]): Picker =>
  (state) =>
    state.pendingChoice?.prompt.kind === "spendResources"
      ? ids.map((id) => `hand:${id}`).filter((o) => state.pendingChoice!.options.some((x) => x.optionId === o))
      : firstLegal(state);

describe("Gunslinger (39069)", () => {
  /** She-Hulk (ATK 3) with two [energy] cards as her whole hand, `GUNSLINGER` about to be dealt. */
  const duel = (deck = "core-she-hulk-aggression") => {
    const hero1 = heroGame(deck);
    const energy = handWith(hero1, P1, "energy", 2);
    return { state: withHand(energy.state, P1, energy.ids), energy: energy.ids };
  };

  it("When it engages you: spend [energy][energy] and it takes damage equal to your hero's ATK, before quickstrike", () => {
    const { state, energy } = duel();
    const { state: after, events } = endTurnWith(state, paying(...energy), ZERO_BOOST[0]!, GUNSLINGER);
    const [gunslinger] = inPlay(after, GUNSLINGER);
    // ATK 3 against 3 hit points: defeated by the interrupt, so its quickstrike never resolves.
    expect(gunslinger).toBeUndefined();
    expect(of(events, "characterDefeated").some((e) => e.cardId === GUNSLINGER)).toBe(true);
    // Only the villain's own activation attacked.
    expect(of(events, "attackResolved").map((e) => e.enemyInstanceId)).toEqual([activeVillain(after)!.instanceId]);
    for (const id of energy) expect(playerOf(after, P1).discard).toContain(id);
  });

  it("declining to pay leaves it undamaged and its quickstrike attacks you", () => {
    const { state } = duel();
    const { state: after, events } = endTurnWith(state, firstLegal, ZERO_BOOST[0]!, GUNSLINGER);
    const [gunslinger] = inPlay(after, GUNSLINGER);
    expect(gunslinger).toBeDefined();
    expect(inst(after, gunslinger!).damage).toBe(0);
    expect(attacksBy(events, gunslinger!)).toHaveLength(1);
    expect(damageTo(events, hero(after))).toContain(2);
  });

  it("damage equals the hero's ATK: a weaker hero (ATK 2) leaves it alive and it quickstrikes", () => {
    const { state, energy } = duel("core-spider-man-justice");
    const { state: after, events } = endTurnWith(state, paying(...energy), ZERO_BOOST[0]!, GUNSLINGER);
    const [gunslinger] = inPlay(after, GUNSLINGER);
    expect(gunslinger).toBeDefined();
    expect(inst(after, gunslinger!).damage).toBe(2);
    expect(attacksBy(events, gunslinger!)).toHaveLength(1);
  });

  it("paying with fewer than two [energy] resources is not a payment: it takes no damage", () => {
    const hero1 = heroGame("core-she-hulk-aggression");
    const energy = handWith(hero1, P1, "energy", 1);
    const { state: after } = endTurnWith(
      withHand(energy.state, P1, energy.ids),
      paying(...energy.ids),
      ZERO_BOOST[0]!,
      GUNSLINGER,
    );
    const [gunslinger] = inPlay(after, GUNSLINGER);
    expect(inst(after, gunslinger!).damage).toBe(0);
  });
});

describe("Dead or Alive (39067)", () => {
  /** Hero form with Card Shark (7 hit points) and a Gunslinger (3) engaged by surgery. */
  const withMinions = () => {
    const hero1 = heroGame("core-she-hulk-aggression"); // 15 hit points: both minions attack her
    const shark = engageMinion(hero1, CARD_SHARK, P1);
    const gunslinger = engageMinion(shark.state, GUNSLINGER, P1);
    return { state: gunslinger.state, shark: shark.id, gunslinger: gunslinger.id };
  };

  it("attaches to the minion with the highest printed hit points, which gets +3 hit points per hero", () => {
    const { state, shark, gunslinger } = withMinions();
    expect(maxHitPoints(state, shark, deps)).toBe(7);
    const { state: after } = endTurnWith(state, firstLegal, ...VILLAIN_BOOST, DEAD_OR_ALIVE);
    const [bounty] = inPlay(after, DEAD_OR_ALIVE);
    expect(inst(after, bounty!).attachedTo).toBe(shark);
    expect(maxHitPoints(after, shark, deps)).toBe(7 + 3);
    expect(maxHitPoints(after, gunslinger, deps)).toBe(3);
  });

  it("the bonus is 3 for each hero: +6 with two players", () => {
    const base = westernGame({
      players: [{ starterDeckId: "core-iron-man-aggression" }, { starterDeckId: "core-spider-man-justice" }],
    });
    const shark = engageMinion(base, CARD_SHARK, P1);
    const bounty = attachToHost(shark.state, DEAD_OR_ALIVE, shark.id);
    expect(maxHitPoints(shark.state, shark.id, deps)).toBe(7);
    expect(maxHitPoints(bounty.state, shark.id, deps)).toBe(7 + 6);
  });

  it("with no minion to attach to, it gains surge", () => {
    const state = heroGame("core-iron-man-aggression");
    const { state: after, events } = endTurnWith(state, firstLegal, ZERO_BOOST[0]!, DEAD_OR_ALIVE, ZERO_BOOST[2]!);
    // Nothing to attach to: it is discarded like any attachment that cannot attach, and surges.
    expect(inPlay(after, DEAD_OR_ALIVE)).toHaveLength(0);
    expect(activeEncounterDeck(after).discard.map((id) => codeOf(after, id))).toContain(DEAD_OR_ALIVE);
    const revealed = of(events, "encounterCardRevealed").map((e) => e.cardId as string);
    expect(revealed).toEqual(expect.arrayContaining([DEAD_OR_ALIVE, ZERO_BOOST[2]!]));
  });

  it("with a minion to attach to, it does not surge", () => {
    const { state } = withMinions();
    const { events } = endTurnWith(state, firstLegal, ...VILLAIN_BOOST, DEAD_OR_ALIVE, ZERO_BOOST[2]!);
    const revealed = of(events, "encounterCardRevealed").map((e) => e.cardId as string);
    expect(revealed).toContain(DEAD_OR_ALIVE);
    expect(revealed).not.toContain(ZERO_BOOST[2]!);
  });

  it("When the attached minion is defeated, each player adds 1 card from their discard pile to their hand", () => {
    const base = westernGame({
      players: [{ starterDeckId: "core-iron-man-aggression" }, { starterDeckId: "core-spider-man-justice" }],
    });
    const shark = engageMinion(base, CARD_SHARK, P1);
    const bounty = attachToHost(shark.state, DEAD_OR_ALIVE, shark.id);
    const p1Discard = moveToDiscard(bounty.state, P1, "01031");
    const p2Discard = moveToDiscard(p1Discard.state, P2, "01003");
    const staged = run(p2Discard.state, toHero(P1));
    const settled = settle(staged, firstLegal, undefined, deps);
    const before = {
      p1Hand: playerOf(settled, P1).hand.length,
      p2Hand: playerOf(settled, P2).hand.length,
      p1Discard: playerOf(settled, P1).discard.length,
      p2Discard: playerOf(settled, P2).discard.length,
    };
    const defeated = defeatWithAttack(
      deps,
      patchInstance(settled, shark.id, { statuses: { ...inst(settled, shark.id).statuses, tough: 0 } }),
      shark.id,
    );
    expect(inPlay(defeated, CARD_SHARK)).toHaveLength(0);
    expect(playerOf(defeated, P1).hand.length).toBe(before.p1Hand + 1);
    expect(playerOf(defeated, P2).hand.length).toBe(before.p2Hand + 1);
    expect(playerOf(defeated, P1).discard.length).toBe(before.p1Discard - 1);
    expect(playerOf(defeated, P2).discard.length).toBe(before.p2Discard - 1);
  });

  it("a player with an empty discard pile adds nothing", () => {
    const hero1 = heroGame("core-iron-man-aggression");
    const shark = engageMinion(hero1, CARD_SHARK, P1);
    const bounty = attachToHost(shark.state, DEAD_OR_ALIVE, shark.id);
    const handBefore = playerOf(bounty.state, P1).hand.length;
    const defeated = defeatWithAttack(
      deps,
      patchInstance(bounty.state, shark.id, { statuses: { ...inst(bounty.state, shark.id).statuses, tough: 0 } }),
      shark.id,
    );
    expect(playerOf(defeated, P1).hand.length).toBe(handBefore);
  });
});

describe("Card Shark (39068)", () => {
  /** Iron Man with Card Shark engaged and `top` as the top three cards of his deck; Card Shark attacks in the villain phase. */
  const attackWith = (...top: string[]) => {
    const hero1 = heroGame("core-iron-man-aggression");
    const shark = engageMinion(hero1, CARD_SHARK, P1);
    const stacked = putOnTopOfDeck(shark.state, P1, ...top);
    const { state, events } = endTurnWith(stacked.state, firstLegal, ZERO_BOOST[0]!, ZERO_BOOST[2]!);
    const attacks = attacksBy(events, shark.id);
    expect(attacks).toHaveLength(1);
    expect(inst(state, hero(state)).damage).toBeGreaterThan(0);
    return { state, events, ids: stacked.ids, shark: shark.id, attack: attacks[0]!, hero: hero(state) };
  };
  /** Damage the hero took beyond the two attacks that landed (the villain's and Card Shark's). */
  const indirect = (r: ReturnType<typeof attackWith>) =>
    inst(r.state, r.hero).damage - of(r.events, "attackResolved").reduce((sum, e) => sum + e.damageDealt, 0);

  it("After it attacks you: discards the top 3 cards of your deck and takes indirect damage per different printed resource type", () => {
    // [physical] Repulsor Blast, [energy] Supersonic Punch, [wild] War Machine: three different types.
    const three = attackWith("01031", "01032", "01030");
    for (const id of three.ids) expect(playerOf(three.state, P1).discard).toContain(id);
    expect(three.attack.damageDealt).toBe(3);
    expect(indirect(three)).toBe(3);
  });

  it("the same type three times counts once; wild is a type of its own", () => {
    // Three [physical] cards (Repulsor Blast has three copies): 1 indirect damage.
    expect(indirect(attackWith("01031", "01031", "01031"))).toBe(1);
    // [physical], [physical], [wild]: 2.
    expect(indirect(attackWith("01031", "01031", "01030"))).toBe(2);
    // [energy], [mental], [physical]: 3.
    expect(indirect(attackWith("01032", "01052", "01031"))).toBe(3);
  });

  it("a resource card counts for the wild it prints", () => {
    // Two [mental] cards and The Power of Aggression (it generates [wild]): 2 types.
    expect(indirect(attackWith("01052", "01086", "01055"))).toBe(2);
  });
});

describe("A Game of Cards (39070)", () => {
  const SUPPORTS = ["01034", "01033", "01056"]; // Stark Tower, Pepper Potts, Tac Team
  /**
   * Iron Man with these supports in play, `held` as his whole hand and `top` on top of his deck; A Game of Cards is
   * dealt in the villain phase. `keep` are the held cards the player chooses not to discard.
   */
  const reveal = (top: string[], held: string[] = [], keep: string[] = []) => {
    const hero1 = heroGame("core-iron-man-aggression");
    let state = hero1;
    const supports: InstanceId[] = [];
    for (const code of SUPPORTS) {
      const placed = intoPlayArea(state, P1, code);
      state = placed.state;
      supports.push(placed.id);
    }
    const hand = held.length > 0 ? moveToHand(state, P1, ...held) : { state, ids: [] as InstanceId[] };
    state = withHand(hand.state, P1, hand.ids);
    state = putOnTopOfDeck(state, P1, ...top).state;
    const kept = new Set(hand.ids.filter((_, i) => keep.includes(held[i]!)));
    const discardFive: Picker = (s) =>
      s.pendingChoice?.prompt.kind === "discardDownToHandSize" && s.pendingChoice.minSelections === 0
        ? [] // the optional end-of-turn discard: keep the hand
        : s.pendingChoice?.prompt.kind === "chooseCards" && s.pendingChoice.maxSelections === 5
          ? s.pendingChoice.options
              .map((o) => o.optionId)
              .filter((o) => !kept.has(o as InstanceId))
              .slice(0, 5)
          : firstLegal(s);
    const result = endTurnWith(state, discardFive, ZERO_BOOST[0]!, GAME_OF_CARDS);
    const afterReveal = result.events.slice(
      result.events.findIndex((e) => e.type === "encounterCardRevealed" && e.cardId === GAME_OF_CARDS),
    );
    const discardedFromHand = of(afterReveal, "cardMoved").filter(
      (e) => e.from.kind === "hand" && e.to.kind === "discard",
    );
    const supportsLeft = supports.filter((id) => cardsInPlay(result.state).includes(id));
    return { ...result, supports, supportsLeft, discardedFromHand, kept: [...kept] };
  };
  const drawn = ["01031", "01032", "01052", "01030", "01031"]; // physical, energy, mental, wild, physical

  it("When Revealed: draws 5, discards 5 from hand, and discards a support per different printed resource type", () => {
    const r = reveal(drawn);
    expect(of(r.events, "cardDrawn").length).toBeGreaterThanOrEqual(5);
    // Four types ([physical], [energy], [mental], [wild]) but only three supports to lose.
    expect(r.supportsLeft).toEqual([]);
    for (const id of r.supports) expect(playerOf(r.state, P1).discard).toContain(id);
  });

  it("the same type counts once: five [physical] cards cost one support", () => {
    const r = reveal(["01031", "01031", "01031", "01054", "01054"]);
    expect(r.supportsLeft).toHaveLength(2);
  });

  it("two types cost two supports", () => {
    const r = reveal(["01031", "01031", "01031", "01030", "01054"]);
    expect(r.supportsLeft).toHaveLength(1);
  });

  it("counts the cards chosen and discarded, not the one kept: 6 in hand, the player keeps one", () => {
    // Iron Man's hand size is 1: the held [energy] Supersonic Punch is kept; the 5 drawn are [physical] x4 and [wild].
    const r = reveal(["01031", "01031", "01031", "01054", "01030"], ["01032"], ["01032"]);
    expect(r.discardedFromHand).toHaveLength(5);
    for (const id of r.kept) expect(r.discardedFromHand.map((e) => e.instanceId)).not.toContain(id);
    expect(r.supportsLeft).toHaveLength(1); // [physical] and [wild]: two types
    for (const id of r.kept) expect(playerOf(r.state, P1).hand).toContain(id);
  });

  it("discards nothing when the player controls no upgrade or support", () => {
    const hero1 = heroGame("core-iron-man-aggression");
    const stacked = putOnTopOfDeck(withHand(hero1, P1, []), P1, ...drawn).state;
    const { state } = endTurnWith(stacked, firstLegal, ZERO_BOOST[0]!, GAME_OF_CARDS);
    expect(playerOf(state, P1).discard.length).toBeGreaterThanOrEqual(5);
  });
});

describe("a whole game with the Western set", () => {
  it("plays to an outcome with a Core hero and replays deep-equal", () => {
    const config = wave6Scenario("magneto", {
      players: [{ starterDeckId: "core-she-hulk-aggression" }],
      seed: 2026,
      modularSetIds: ["western"],
    });
    const created = createGame(config, deps);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, deps);
    expect(result.outcome).not.toBeNull();
    const replayed = replay(result.session.log, deps);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);
});
