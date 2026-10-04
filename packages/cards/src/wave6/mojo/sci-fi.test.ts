import {
  activeEncounterDeck,
  cardsInPlay,
  hasKeyword,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { SCI_FI_ABILITIES } from "./sci-fi.js";
import { WAVE6_DEPS } from "../index.js";
import {
  firstLegal,
  identityOf,
  inst,
  P1,
  patchInstance,
  picking,
  runWith,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import {
  defeatWithAttack,
  driveEventsPicking,
  encounterCardInVillainArea,
  playFromHand,
} from "../../testing/staging.js";
import { engageMinion } from "../mut_gen/project-wideawake-testing.js";
import { inDeck, inEncounterPiles, inPlay, sciFiGame } from "./sci-fi-testing.js";

const deps: EngineDeps = WAVE6_DEPS;
const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(deps, state, ...commands);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

const RUNNER = "39053";
const AVALANCHE = "39054";
const BLOB = "39055";
const MAGNETO = "39056";
const PYRO = "39057";
const TOAD = "39058";
const ICE_TEROID = "39059";
/** Treacheries with no boost icons, to fill the boost and reveal slots of a villain phase. */
const FILLER = "01186";
const FILLER_2 = "01187";
const FILLER_3 = "01104";
const DIAL_M = "39035";
const WEB_SHOOTER = "01008";
const BLACK_CAT = "01002";

const hero = (state: GameState) => identityOf(state, P1);
const heroForm = (options: Parameters<typeof sciFiGame>[0] = {}) => run(sciFiGame(options), toHero(P1));
/**
 * P1 ends their turn: the villain's boost card is the first stacked card (the villain activates first), then each
 * engaged minion's, then `reveal` is the card step 3 deals; `after` follow it (a surge, a later boost card).
 */
const villainPhase = (
  state: GameState,
  boostCards: readonly string[],
  reveal: string,
  after: readonly string[] = [FILLER, FILLER_2],
  pick = firstLegal,
) =>
  driveEventsPicking(deps, stackEncounterDeck(state, ...boostCards, reveal, ...after), pick, {
    type: "endTurn",
    playerId: P1,
  });
/** The events from the first time `abilityId` resolved. */
const afterAbility = (events: readonly GameEvent[], abilityId: string) =>
  events.slice(events.findIndex((e) => e.type === "abilityResolved" && e.abilityId === abilityId));
const revealed = (events: readonly GameEvent[]) => of(events, "encounterCardRevealed").map((e) => e.cardId as string);
const damageTo = (events: readonly GameEvent[], id: InstanceId) =>
  of(events, "damageDealt").filter((e) => e.targetInstanceId === id);
const isExhausted = (state: GameState, id: InstanceId) => inst(state, id).exhausted;
/**
 * A villain phase in which Rhino attacks P1 with `boostCard` as his boost card (a boost ability resolves for whichever
 * enemy the card is dealt to; only the villain and villainous minions are dealt one, RRG "Boost", p. 11).
 */
const boostedActivation = (boostCard: string, base: GameState = heroForm()) =>
  villainPhase(base, [boostCard], FILLER, [FILLER_3]);
/** Picks `wanted` at a prompt of kind `kind` and declines every other prompt (no defender, hand-size discards first-listed). */
const pickingAt =
  (kind: string, ...wanted: readonly string[]) =>
  (state: GameState) =>
    state.pendingChoice?.prompt.kind === kind ? picking(...wanted)(state) : firstLegal(state);
const handOf = (state: GameState) => state.players.find((p) => p.playerId === P1)!.hand;

describe("registry", () => {
  it("scripts every ability ref of the Sci-Fi set", () => {
    expect(Object.keys(SCI_FI_ABILITIES).sort()).toEqual(
      [
        "39053.mojo-runner-constant",
        "39053.when-revealed",
        "39054.avalanche-90-forced-response",
        "39054.boost",
        "39055.blob-314-constant",
        "39055.boost",
        "39056.magneto-26-forced-response",
        "39057.pyro-40-forced-interrupt",
        "39057.boost",
        "39058.toad-20-forced-response",
        "39058.when-defeated",
        "39059.ice-teroid-m-constant",
        "39059.ice-teroid-m-forced-interrupt",
      ].sort(),
    );
  });

  it("the set's seven cards are in the Rhino game from data", () => {
    const state = sciFiGame();
    for (const code of [RUNNER, AVALANCHE, BLOB, MAGNETO, PYRO, TOAD, ICE_TEROID])
      expect(inEncounterPiles(state, code).length, code).toBeGreaterThanOrEqual(1);
  });
});

describe("Mojo Runner (39053)", () => {
  /** Dial M for Mojo (SETTING, SHOW) sitting in play when the Runner is revealed. */
  const withDialM = () => {
    const base = heroForm({ modularSetIds: ["sci-fi", "crime"] });
    return encounterCardInVillainArea(base, DIAL_M);
  };

  it("When Revealed: discards each other Setting environment in play", () => {
    const { state: staged, id: dial } = withDialM();
    expect(cardsInPlay(staged)).toContain(dial);
    const { state } = villainPhase(staged, [FILLER], RUNNER);
    expect(cardsInPlay(state)).not.toContain(dial);
    expect(activeEncounterDeck(state).discard).toContain(dial);
    expect(inPlay(state, RUNNER)).toHaveLength(1);
  });

  it("revealed from the encounter deck it gains surge: the next encounter card is revealed too", () => {
    const { events } = villainPhase(heroForm(), [FILLER], RUNNER, [FILLER_2, FILLER]);
    expect(revealed(events)).toEqual([RUNNER, FILLER_2]);
    expect(of(events, "surgeTriggered")).toHaveLength(1);
  });

  it("Each minion and ally gains toughness: one that enters play gets a tough status card, a hero does not", () => {
    const base = heroForm();
    const { state: withRunner } = villainPhase(base, [FILLER], RUNNER);
    const [runner] = inPlay(withRunner, RUNNER);
    expect(runner).toBeDefined();
    const { state: withAlly, id: ally } = playFromHand(deps, withRunner, BLACK_CAT, 2);
    expect(hasKeyword(withAlly, ally, "toughness", deps)).toBe(true);
    expect(inst(withAlly, ally).statuses.tough).toBe(1);
    expect(hasKeyword(withAlly, hero(withAlly), "toughness", deps)).toBe(false);
    // Control: the same ally with no Runner in play enters without a tough card.
    const control = playFromHand(deps, base, BLACK_CAT, 2);
    expect(inst(control.state, control.id).statuses.tough).toBe(0);
    const { state: engaged, id: minion } = engageMinion(withRunner, BLOB);
    expect(hasKeyword(engaged, minion, "toughness", deps)).toBe(true);
    expect(hasKeyword(base, engageMinion(base, BLOB).id, "toughness", deps)).toBe(false);
  });
});

describe("Avalanche 9.0 (39054)", () => {
  it("Forced Response: after it engages you, exhaust a character you control and deal 1 damage to that character", () => {
    const { state, events } = villainPhase(heroForm(), [FILLER], AVALANCHE);
    const [avalanche] = inPlay(state, AVALANCHE);
    expect(inst(state, avalanche!).engagedWith).toBe(P1);
    const afterEngage = afterAbility(events, "39054.avalanche-90-forced-response");
    expect(of(afterEngage, "cardExhausted").map((e) => e.instanceId)).toEqual([hero(state)]);
    expect(damageTo(afterEngage, hero(state)).map((e) => e.amount)).toEqual([1]);
    expect(isExhausted(state, hero(state))).toBe(true);
  });

  it("the character is the player's choice: an ally can be exhausted and damaged instead of the hero", () => {
    const { state: staged, id: cat } = playFromHand(deps, heroForm(), BLACK_CAT, 2);
    const { state, events } = villainPhase(
      staged,
      [FILLER],
      AVALANCHE,
      [FILLER_2, FILLER_3],
      pickingAt("chooseTarget", cat),
    );
    expect(inPlay(state, AVALANCHE)).toHaveLength(1);
    const afterEngage = afterAbility(events, "39054.avalanche-90-forced-response");
    expect(of(afterEngage, "cardExhausted").map((e) => e.instanceId)).toEqual([cat]);
    expect(damageTo(afterEngage, cat).map((e) => e.amount)).toEqual([1]);
    expect(damageTo(afterEngage, hero(state))).toHaveLength(0);
  });

  it("Boost: exhausts a character you control (and deals no damage)", () => {
    const { state, events } = boostedActivation(AVALANCHE);
    expect(of(events, "abilityResolved").map((e) => e.abilityId)).toContain("39054.boost");
    expect(isExhausted(state, hero(state))).toBe(true);
    // Only Rhino's attack (2 ATK + the card's 1 boost icon) hurt the hero: the boost itself deals no damage.
    expect(damageTo(events, hero(state)).map((e) => e.amount)).toEqual([3]);
  });
});

describe("Blob 3.14 (39055)", () => {
  /** She-Hulk's basic attack (3 ATK) on `code`, engaged with her. */
  const hit = (code: string) => {
    const engaged = engageMinion(heroForm({ players: [{ starterDeckId: "core-she-hulk-aggression" }] }), code);
    const { state, events } = driveEventsPicking(deps, engaged.state, firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(engaged.state, P1),
      targetInstanceId: engaged.id,
    });
    return { state, events, id: engaged.id };
  };

  it("cannot take more than 2 damage from each attack: a 3 ATK attack deals 2", () => {
    const { state, id } = hit(BLOB);
    expect(inst(state, id).damage).toBe(2);
  });

  it("control: a minion without the cap takes the full 3 ATK", () => {
    const { state, id } = hit(PYRO);
    expect(inst(state, id).damage).toBe(3);
  });

  it("the cap is per attack: a second attack deals 2 more", () => {
    const first = hit(BLOB);
    const readied = patchInstance(first.state, identityOf(first.state, P1), { exhausted: false });
    const { state } = driveEventsPicking(deps, readied, firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(readied, P1),
      targetInstanceId: first.id,
    });
    expect(inst(state, first.id).damage).toBe(4);
  });

  it("Boost: you are stunned", () => {
    const { state, events } = boostedActivation(BLOB);
    expect(of(events, "abilityResolved").map((e) => e.abilityId)).toContain("39055.boost");
    expect(inst(state, hero(state)).statuses.stunned).toBe(1);
  });
});

describe("Magneto 2.6 (39056)", () => {
  const magnetoAttack = (counters: number) => {
    const engaged = engageMinion(heroForm(), MAGNETO);
    const staged = patchInstance(engaged.state, engaged.id, { counters: counters ? { magnetic: counters } : {} });
    const before = handOf(staged);
    // The villain's boost card, then Magneto's own.
    const result = villainPhase(staged, [FILLER, FILLER_2], FILLER, [FILLER_3]);
    return {
      ...result,
      events: afterAbility(result.events, "39056.magneto-26-forced-response"),
      id: engaged.id,
      before,
    };
  };

  it("after it activates against you: places 1 magnetic counter on him and discards 1 card for it", () => {
    const { state, events, id, before } = magnetoAttack(0);
    expect(inst(state, id).counters.magnetic).toBe(1);
    const discarded = of(events, "cardDiscardedFromHand");
    expect(discarded).toHaveLength(1);
    expect(before).toContain(discarded[0]!.instanceId);
  });

  it("discards 1 card for each magnetic counter on him: a second activation with 1 counter already discards 2", () => {
    const { state, events, id, before } = magnetoAttack(1);
    expect(inst(state, id).counters.magnetic).toBe(2);
    const discarded = of(events, "cardDiscardedFromHand");
    expect(discarded).toHaveLength(2);
    for (const e of discarded) expect(before).toContain(e.instanceId);
  });

  it("the counter goes on before the discard: the count is read after placing it", () => {
    const { events } = magnetoAttack(2);
    expect(of(events, "cardDiscardedFromHand")).toHaveLength(3);
  });

  it("the discard is the player's choice of card", () => {
    const engaged = engageMinion(heroForm(), MAGNETO);
    const [, second] = handOf(engaged.state);
    const result = villainPhase(
      engaged.state,
      [FILLER, FILLER_2],
      FILLER,
      [FILLER_3],
      pickingAt("discardFromHand", second!),
    );
    const events = afterAbility(result.events, "39056.magneto-26-forced-response");
    expect(of(events, "cardDiscardedFromHand").map((e) => e.instanceId)).toEqual([second]);
  });
});

describe("Pyro 4.0 (39057)", () => {
  it("Forced Interrupt: when it attacks you, you take 2 indirect damage before the attack's own damage", () => {
    const engaged = engageMinion(heroForm(), PYRO);
    const { state, events } = villainPhase(engaged.state, [FILLER], FILLER_2, [FILLER_3]);
    const toHero = damageTo(events, hero(state)).filter((e) => e.sourceInstanceId === engaged.id);
    expect(toHero.map((e) => e.amount)).toEqual([2, 2]);
    // The indirect damage is the interrupt: it lands before the attack itself resolves.
    const attackAt = events.findIndex((e) => e.type === "attackResolved" && e.enemyInstanceId === engaged.id);
    const indirectAt = events.findIndex((e) => e.type === "damageDealt" && e.sourceInstanceId === engaged.id);
    expect(indirectAt).toBeGreaterThan(-1);
    expect(indirectAt).toBeLessThan(attackAt);
  });

  it("Boost: you take 2 indirect damage, on top of the attack it boosts", () => {
    const total = (r: { events: readonly GameEvent[]; state: GameState }) =>
      damageTo(r.events, hero(r.state)).reduce((sum, e) => sum + e.amount, 0);
    const base = heroForm();
    const control = boostedActivation(FILLER_2, base);
    const boosted = boostedActivation(PYRO, base);
    expect(of(boosted.events, "abilityResolved").map((e) => e.abilityId)).toContain("39057.boost");
    // Rhino's 2 ATK either way (neither card has boost icons); the Pyro boost adds exactly 2.
    expect(total(control)).toBe(2);
    expect(total(boosted)).toBe(4);
  });
});

describe("Toad 2.0 (39058)", () => {
  it("Forced Response: after it engages you, an upgrade you control goes facedown under it", () => {
    const { state: staged, id: shooter } = playFromHand(deps, heroForm(), WEB_SHOOTER, 1);
    const { state } = villainPhase(staged, [FILLER], TOAD);
    const [toad] = inPlay(state, TOAD);
    expect(toad).toBeDefined();
    expect(cardsInPlay(state)).not.toContain(shooter);
    expect(inst(state, shooter).faceup).toBe(false);
    expect(inst(state, toad!).tucked).toEqual([shooter]);
  });

  it("with no upgrade to place, nothing happens", () => {
    const { state } = villainPhase(heroForm(), [FILLER], TOAD);
    const [toad] = inPlay(state, TOAD);
    expect(inst(state, toad!).tucked).toEqual([]);
  });

  it("When Defeated: each card under it returns to its owner's hand", () => {
    const { state: staged, id: shooter } = playFromHand(deps, heroForm(), WEB_SHOOTER, 1);
    const { state: engaged } = villainPhase(staged, [FILLER], TOAD);
    const [toad] = inPlay(engaged, TOAD);
    const after = defeatWithAttack(
      deps,
      patchInstance(engaged, toad!, { statuses: { ...inst(engaged, toad!).statuses, tough: 0 } }),
      toad!,
    );
    expect(cardsInPlay(after)).not.toContain(toad);
    expect(handOf(after)).toContain(shooter);
    expect(inst(after, shooter).faceup).toBe(false);
  });
});

describe("ICE-Teroid M (39059)", () => {
  it("Each minion gains guard and patrol", () => {
    const base = heroForm();
    const control = engageMinion(base, BLOB);
    for (const keyword of ["guard", "patrol"] as const)
      expect(hasKeyword(control.state, control.id, keyword, deps), keyword).toBe(false);
    const { state: withScheme } = encounterCardInVillainArea(control.state, ICE_TEROID, 2);
    for (const keyword of ["guard", "patrol"] as const)
      expect(hasKeyword(withScheme, control.id, keyword, deps), keyword).toBe(true);
    // Not a hero, not the villain.
    expect(hasKeyword(withScheme, hero(withScheme), "guard", deps)).toBe(false);
  });

  it("Forced Interrupt: at the end of the round the first player fetches a minion of their choice into play engaged with them, then the deck is shuffled", () => {
    const base = heroForm();
    const wanted = inDeck(base, PYRO)[0]!;
    const { state, events } = (() => {
      const staged = encounterCardInVillainArea(base, ICE_TEROID, 2).state;
      return villainPhase(staged, [FILLER], FILLER_2, [FILLER], picking(wanted));
    })();
    expect(inPlay(state, PYRO)).toEqual([wanted]);
    expect(inst(state, wanted).engagedWith).toBe(P1);
    expect(of(events, "deckShuffled").length).toBeGreaterThanOrEqual(1);
    // It came at the round's end: after the villain phase's own reveal and the first player token passing.
    const enteredAt = events.findIndex(
      (e) => e.type === "cardMoved" && e.instanceId === wanted && e.to.kind === "playArea",
    );
    expect(enteredAt).toBeGreaterThan(events.findIndex((e) => e.type === "firstPlayerChanged"));
    expect(enteredAt).toBeGreaterThan(events.map((e) => e.type).lastIndexOf("encounterCardRevealed"));
    expect(enteredAt).toBeLessThan(events.findIndex((e) => e.type === "roundStarted"));
  });

  it("also finds a minion in the encounter discard pile", () => {
    const base = heroForm();
    const [pyro] = inDeck(base, PYRO);
    const inDiscard = (() => {
      const deckId = Object.keys(base.encounterDecks).find(
        (k) => base.encounterDecks[k] === activeEncounterDeck(base),
      )!;
      const pile = base.encounterDecks[deckId]!;
      return {
        ...base,
        encounterDecks: {
          ...base.encounterDecks,
          [deckId]: { deck: pile.deck.filter((i) => i !== pyro), discard: [...pile.discard, pyro!] },
        },
      };
    })();
    const staged = encounterCardInVillainArea(inDiscard, ICE_TEROID, 2).state;
    const { state } = villainPhase(staged, [FILLER], FILLER_2, [FILLER], picking(pyro!));
    expect(inPlay(state, PYRO)).toEqual([pyro]);
  });
});
