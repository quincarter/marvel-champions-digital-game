import {
  applyCommand,
  createGame,
  type AbilityDefinition,
  type Command,
  type EngineDeps,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { action, addCounters, discardTopOfDeckCost, totalPrintedResources } from "../../../dsl/index.js";
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
  payWith,
  play,
  playerOf,
  putOnTopOfDeck,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, moveToDiscard, withForm } from "../../../testing/staging.js";
import { WAVE7_ABILITIES, WAVE7_DEPS, wave7Scenario } from "../../index.js";
import { DOMINO_IDENTITY } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Domino / Neena Thurman (40037a/b), docs/phase7-wave7.md §7.1, §3.56, §3.57. Domino's real precon (`domino-justice`,
 * 40 cards) against Juggernaut through `wave7Scenario` with the real registry. Domino: THW 1, ATK 2, DEF 3, 9 hit
 * points, hand size 5; Neena Thurman: REC 3, hand size 6. Her kit is not scripted by this module: fixtures are cards of
 * the kit by printed id (40040 A Good Workout, wild; 40041 Luck Be a Lady, wild; 40052 Even the Odds, energy; 40053 Team
 * Investigation, mental; 40055 Overwatch, physical; 40043 Jackpot!, produces energy + mental + physical, no printed
 * icon), and the icon count is read through a stand-in action on Diamondback (40038), swapped in test-side only.
 */
const CONSTANT = "40037a.domino-constant";
const DOMINO_ACTION = "40037a.domino-action";
const NEENA_ACTION = "40037b.neena-thurman-action";
const DOMINO = { starterDeckId: "domino-justice" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const WILD = "40040";
const WILD_2 = "40041";
const ENERGY = "40052";
const MENTAL = "40053";
const PHYSICAL = "40055";
const DIAMONDBACK = "40038";
const DIAMONDBACK_ACTION = "40038.diamondback-action";

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const handCodes = (s: GameState, p = P1): string[] => playerOf(s, p).hand.map((id) => codeOf(s, id));
const deckCodes = (s: GameState, p = P1): string[] => playerOf(s, p).deck.map((id) => codeOf(s, id));
const discardCodes = (s: GameState, p = P1): string[] => playerOf(s, p).discard.map((id) => codeOf(s, id));

function setupGame(players: readonly (typeof DOMINO | typeof SPIDER_MAN)[] = [DOMINO], seed = 1): GameState {
  const config = wave7Scenario("juggernaut", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
}
/** Domino in hero form (a hand of 5), Neena in alter-ego form (a hand of 6): the game starts in alter-ego form. */
const heroGame = (players?: readonly (typeof DOMINO | typeof SPIDER_MAN)[], seed = 1): GameState =>
  withForm(setupGame(players, seed), { heroForm: 0 });
const alterEgoGame = (players?: readonly (typeof DOMINO | typeof SPIDER_MAN)[], seed = 1): GameState =>
  setupGame(players, seed);

/** Answers each "choose a card" with the first option whose card is `code`, in the order given (one code per prompt). */
const choosing = (...codes: string[]): Picker => {
  const queue = [...codes];
  return (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseCards") {
      const want = queue[0];
      const hit = choice.options.find((o) => codeOf(state, o.optionId as InstanceId) === want);
      if (hit) {
        queue.shift();
        return [hit.optionId];
      }
    }
    return firstLegal(state);
  };
};
/** The hand and the top card of the deck, for the stack: deck top first. */
function stacked(state: GameState, deck: readonly string[], hand: readonly string[], player = P1): GameState {
  // Clear the hand into the deck, then deal the wanted hand and stack the deck top.
  const base = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, deck: [...p.hand, ...p.deck], hand: [] as InstanceId[] } : p,
    ),
  };
  const withHand = hand.length > 0 ? moveToHand(base, player, ...hand).state : base;
  return deck.length > 0 ? putOnTopOfDeck(withHand, player, ...deck).state : withHand;
}

const refused = (state: GameState, command: Command, deps: EngineDeps = WAVE7_DEPS): boolean =>
  !applyCommand(state, command, deps).ok;
/** Ends the turn and settles into the next round's player phase. */
const nextRound = (state: GameState): GameState =>
  settle(
    driveEventsPicking(WAVE7_DEPS, state, firstLegal, endTurn(P1)).state,
    firstLegal,
    (s) => s.step.phase === "player" && s.round > state.round,
    WAVE7_DEPS,
  );

const run = (state: GameState, pick: Picker, id: string, who = P1, deps: EngineDeps = WAVE7_DEPS) =>
  driveEventsPicking(deps, state, pick, use(who, identityOf(state, who), id));

describe("Domino identity registry", () => {
  it.each([CONSTANT, DOMINO_ACTION, NEENA_ACTION])("%s validates", (id) => {
    expect(validateDefinition(DOMINO_IDENTITY[id]!)).toEqual([]);
  });
  it("holds exactly the three identity refs", () => {
    expect(Object.keys(DOMINO_IDENTITY).sort()).toEqual([CONSTANT, DOMINO_ACTION, NEENA_ACTION].sort());
  });
  it("stages the starting hand: 6 for Neena in alter-ego form, 40 cards in all", () => {
    const s = alterEgoGame();
    expect(s.players[0]!.identity.form).toBe("alterEgo");
    expect(handCodes(s)).toHaveLength(6);
    expect(playerOf(s, P1).hand.length + playerOf(s, P1).deck.length).toBe(40);
  });
});

describe("Domino (40037a), Action: swap a hand card with the top card of the deck", () => {
  it("puts the chosen hand card on top of the deck and the old top card into the hand", () => {
    const state = stacked(heroGame(), [ENERGY, MENTAL, PHYSICAL], [WILD, WILD_2]);
    expect(handCodes(state)).toEqual([WILD, WILD_2]);
    expect(deckCodes(state).slice(0, 3)).toEqual([ENERGY, MENTAL, PHYSICAL]);
    const deckSize = deckCodes(state).length;
    const { state: after } = run(state, choosing(WILD_2), DOMINO_ACTION);
    expect(handCodes(after)).toEqual([WILD, ENERGY]);
    expect(deckCodes(after).slice(0, 3)).toEqual([WILD_2, MENTAL, PHYSICAL]);
    expect(deckCodes(after)).toHaveLength(deckSize);
    // Neither card was discarded, and the action exhausts nothing.
    expect(discardCodes(after)).toEqual([]);
    expect(inst(after, identityOf(after)).exhausted).toBe(false);
  });

  it("is limited to once per round: a second use is refused, and it works again next round", () => {
    const state = stacked(heroGame(), [ENERGY, MENTAL], [WILD, WILD_2]);
    const first = run(state, choosing(WILD), DOMINO_ACTION).state;
    expect(handCodes(first)).toEqual([ENERGY, WILD_2]);
    expect(refused(first, use(P1, identityOf(first), DOMINO_ACTION))).toBe(true);
    const next = nextRound(first);
    const again = stacked(withForm(next, { heroForm: 0 }), [MENTAL], [WILD]);
    expect(refused(again, use(P1, identityOf(again), DOMINO_ACTION))).toBe(false);
    const { state: after } = run(again, choosing(WILD), DOMINO_ACTION);
    expect(handCodes(after)).toEqual([MENTAL]);
    expect(deckCodes(after)[0]).toBe(WILD);
  });

  it("is a hero-form action: refused in alter-ego form", () => {
    const state = stacked(alterEgoGame(), [ENERGY], [WILD]);
    expect(refused(state, use(P1, identityOf(state), DOMINO_ACTION))).toBe(true);
  });

  it("is not a draw: no card is drawn, the hand size is unchanged and the discard pile is untouched", () => {
    const state = stacked(heroGame(), [ENERGY], [WILD, WILD_2]);
    const { state: after, events } = run(state, choosing(WILD), DOMINO_ACTION);
    expect(handCodes(after)).toHaveLength(2);
    expect(events.filter((e) => e.type === "cardDrawn")).toEqual([]);
    expect(discardCodes(after)).toEqual([]);
  });

  // RRG 1.8 "Target" (p. 42): an ability that requires a target "can only be initiated if it has at least one valid
  // target", and "'Swap'" (p. 42): "A swap cannot be completed if there is not a component in both locations". So the
  // Action is refused, nothing is logged, and its once-per-round use is not spent.
  it("an empty deck: the action cannot be initiated, nothing moves and the use is not spent", () => {
    const base = stacked(heroGame(), [], [WILD, WILD_2]);
    const state = { ...base, players: base.players.map((p) => ({ ...p, deck: [] as InstanceId[] })) };
    const result = applyCommand(state, use(P1, identityOf(state), DOMINO_ACTION), WAVE7_DEPS);
    expect(result.ok ? "ok" : result.error.code).toBe("no_valid_target");
    // With a card back on the deck the same round, the action is still available.
    const refilled = putOnTopOfDeck(
      { ...state, players: state.players.map((p, i) => ({ ...p, deck: base.players[i]!.deck })) },
      P1,
      ENERGY,
    ).state;
    const { state: after, events } = run(refilled, choosing(WILD), DOMINO_ACTION);
    expect(events.some((e) => e.type === "swapRefused")).toBe(false);
    expect(handCodes(after)).toEqual([ENERGY, WILD_2]);
    expect(deckCodes(after)[0]).toBe(WILD);
  });

  it("an empty hand: the action cannot be initiated, nothing moves and the use is not spent", () => {
    const base = stacked(heroGame(), [ENERGY, MENTAL], []);
    const state = { ...base, players: base.players.map((p) => ({ ...p, hand: [] as InstanceId[] })) };
    const result = applyCommand(state, use(P1, identityOf(state), DOMINO_ACTION), WAVE7_DEPS);
    expect(result.ok ? "ok" : result.error.code).toBe("no_valid_target");
    // With a card in hand the same round, the action is still available.
    const dealt = moveToHand(state, P1, WILD).state;
    const top = deckCodes(dealt)[0];
    const { state: after, events } = run(dealt, choosing(WILD), DOMINO_ACTION);
    expect(events.some((e) => e.type === "swapRefused")).toBe(false);
    expect(handCodes(after)).toEqual([top]);
    expect(deckCodes(after)[0]).toBe(WILD);
  });

  it("two players: only the user's hand and deck change", () => {
    const base = heroGame([DOMINO, SPIDER_MAN]);
    const state = stacked(base, [ENERGY, MENTAL], [WILD, WILD_2]);
    const otherHand = playerOf(state, P2).hand;
    const otherDeck = playerOf(state, P2).deck;
    const { state: after } = run(state, choosing(WILD_2), DOMINO_ACTION);
    expect(handCodes(after)).toEqual([WILD, ENERGY]);
    expect(playerOf(after, P2).hand).toEqual(otherHand);
    expect(playerOf(after, P2).deck).toEqual(otherDeck);
  });
});

describe("Neena Thurman (40037b), Action: swap a hand card with the top card of the discard pile", () => {
  /** A discard pile of `codes`, top first (`PlayerState.discard[0]` is the top of the pile). */
  function withDiscard(state: GameState, ...codes: string[]): GameState {
    let s = state;
    for (const code of [...codes].reverse()) {
      const moved = moveToDiscard(s, P1, code);
      // `moveToDiscard` appends; the top of a discard pile is its first element.
      s = {
        ...moved.state,
        players: moved.state.players.map((p) =>
          p.playerId === P1 ? { ...p, discard: [moved.id, ...p.discard.filter((x) => x !== moved.id)] } : p,
        ),
      };
    }
    return s;
  }

  it("puts the chosen hand card on top of the discard pile and the old top card into the hand", () => {
    const state = withDiscard(stacked(alterEgoGame(), [], [WILD, WILD_2]), MENTAL, ENERGY);
    expect(discardCodes(state)).toEqual([MENTAL, ENERGY]);
    const { state: after, events } = run(state, choosing(WILD), NEENA_ACTION);
    expect(handCodes(after).sort()).toEqual([MENTAL, WILD_2].sort());
    expect(discardCodes(after)).toEqual([WILD, ENERGY]);
    // Neither card is discarded or drawn.
    expect(events.filter((e) => e.type === "cardDrawn")).toEqual([]);
  });

  it("an empty discard pile: nothing to swap with, nothing moves", () => {
    const state = stacked(alterEgoGame(), [], [WILD, WILD_2]);
    expect(discardCodes(state)).toEqual([]);
    const r = applyCommand(state, use(P1, identityOf(state), NEENA_ACTION), WAVE7_DEPS);
    expect(r.ok ? "ok" : r.error.code).toBe("no_valid_target");
  });

  it("is limited to once per round", () => {
    const state = withDiscard(stacked(alterEgoGame(), [], [WILD, WILD_2]), MENTAL, ENERGY);
    const first = run(state, choosing(WILD), NEENA_ACTION).state;
    expect(refused(first, use(P1, identityOf(first), NEENA_ACTION))).toBe(true);
  });

  it("is an alter-ego action: refused in hero form", () => {
    const state = withDiscard(stacked(heroGame(), [], [WILD]), MENTAL);
    expect(refused(state, use(P1, identityOf(state), NEENA_ACTION))).toBe(true);
  });

  it("each face has its own limit: after Neena's swap, Domino's swap is still available in the same round", () => {
    const state = withDiscard(stacked(alterEgoGame(), [ENERGY], [WILD, WILD_2]), MENTAL);
    const first = run(state, choosing(WILD), NEENA_ACTION).state;
    const hero = withForm(first, { heroForm: 0 });
    expect(refused(hero, use(P1, identityOf(hero), DOMINO_ACTION))).toBe(false);
  });
});

describe("Domino (40037a), constant: a printed wild icon counts twice on a card discarded from the deck", () => {
  /**
   * A stand-in for a kit card that reads the icons ("discard the top card of your deck → ... for each resource icon
   * discarded this way"): Diamondback's action, replaced in this test's deps only, adds one "meter" counter to
   * itself per counted icon. The real Diamondback and the other readers are scripted by the supports/allies and events
   * modules; the engine's `deck-discard-icon-count.test.ts` covers every reader.
   */
  const METER_DEFINITION: AbilityDefinition = {
    ...action(addCounters("meter", totalPrintedResources({ kind: "slot", slot: "paid" }))),
    cost: discardTopOfDeckCost(1, "paid"),
  };
  const DEPS: EngineDeps = { abilities: { ...WAVE7_ABILITIES, [DIAMONDBACK_ACTION]: METER_DEFINITION } };

  /** Diamondback in play (paid for from the hand), then the deck stacked with `top`. */
  function withDiamondback(state: GameState, ...top: string[]): { state: GameState; id: InstanceId } {
    const given = moveToHand(state, P1, DIAMONDBACK);
    const [card] = given.ids as [InstanceId];
    const played = driveEventsPicking(
      DEPS,
      given.state,
      firstLegal,
      play(P1, card, payWith(given.state, P1, 2, [card])),
    );
    return { state: putOnTopOfDeck(played.state, P1, ...top).state, id: card };
  }
  const meter = (s: GameState, id: InstanceId): number => inst(s, id).counters.meter ?? 0;
  const discardTop = (s: GameState, id: InstanceId, pick: Picker = firstLegal) =>
    driveEventsPicking(DEPS, s, pick, use(P1, id, DIAMONDBACK_ACTION));

  it("exists in the registry: the stand-in is the only thing replaced", () => {
    expect(Object.keys(WAVE7_ABILITIES)).toContain(CONSTANT);
    expect(instancesOf(heroGame(), DIAMONDBACK)).toHaveLength(1);
  });

  it("hero form: a wild icon counts 2, an energy icon 1, a mental icon 1, a physical icon 1", () => {
    const base = heroGame();
    const counts: [string, number][] = [
      [WILD, 2],
      [ENERGY, 1],
      [MENTAL, 1],
      [PHYSICAL, 1],
    ];
    for (const [code, expected] of counts) {
      const { state, id } = withDiamondback(base, code);
      const after = discardTop(state, id).state;
      expect(discardCodes(after)).toContain(code);
      expect(meter(after, id), code).toBe(expected);
    }
  });

  it("Jackpot! (energy, mental and physical produced, no printed icon) is counted by the engine rule as it prints", () => {
    const { state, id } = withDiamondback(heroGame(), "40043");
    const after = discardTop(state, id).state;
    expect(discardCodes(after)).toContain("40043");
    expect(meter(after, id)).toBe(3);
  });

  it("alter-ego form: the constant is printed on the hero face, so a wild counts once", () => {
    const { state, id } = withDiamondback(alterEgoGame(), WILD);
    const after = discardTop(state, id).state;
    expect(meter(after, id)).toBe(1);
  });

  it("it counts, it does not change the card: the discarded card is the same wild card", () => {
    const { state, id } = withDiamondback(heroGame(), WILD);
    const topId = playerOf(state, P1).deck[0]!;
    const after = discardTop(state, id).state;
    expect(playerOf(after, P1).discard).toContain(topId);
    expect(inst(after, topId).cardId).toBe(WILD);
  });

  it("an empty deck: nothing is discarded, nothing is counted", () => {
    const { state, id } = withDiamondback(heroGame());
    // A deck that is empty with an empty discard pile has nothing to reset from (the hand cards that paid for
    // Diamondback sit in the discard pile, so they are cleared too).
    const empty = {
      ...state,
      players: state.players.map((p) => ({ ...p, deck: [] as InstanceId[], discard: [] as InstanceId[] })),
    };
    const r = applyCommand(empty, use(P1, id, DIAMONDBACK_ACTION), DEPS);
    expect(r.ok ? "ok" : r.error.code).toBe("card_not_in_zone");
    expect(meter(empty, id)).toBe(0);
  });
});
