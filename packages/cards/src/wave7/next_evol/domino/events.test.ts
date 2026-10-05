import { applyCommand, createGame, type Command, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  putOnTopOfDeck,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../../index.js";
import { DOMINO_EVENTS } from "./events.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Domino's hero events and Jackpot! (40040-40043), docs/phase7-wave7.md §7.1, §3.55, §3.56, §4.1 Q32 and Q34. Domino's
 * real precon (`domino-justice`) against Juggernaut through `wave7Scenario` with the real registry. Every event is a
 * Hero Action, so Domino is in hero form (her wild icons count twice). The deck is stacked, so each discarded card and
 * icon is known: ENERGY 40052 (one energy), MENTAL 40053, PHYSICAL 40055, WILD 40046 (one wild; counts 2), TRIO
 * Jackpot! 40043 (energy + mental + physical produced, no printed icon, counts 3). The cost is paid from two fixture
 * cards in hand (40047, 40048), which are not in any stack.
 */
const WORKOUT = "40040.a-good-workout-action";
const LUCK = "40041.luck-be-a-lady-action";
const LUCK_PARTS = ["40041.luck-be-a-lady-constant", "40041.luck-be-a-lady-constant-2"] as const;
const RIGHT_PLACE = "40042.right-place-right-time-action";
const JACKPOT = "40043.jackpot-response";
const DOMINO = { starterDeckId: "domino-justice" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const ENERGY = "40052";
const MENTAL = "40053";
const PHYSICAL = "40055";
const WILD = "40046";
const TRIO = "40043";
const PAYMENT = ["40047", "40048"];

type Seat = typeof DOMINO | typeof SPIDER_MAN;
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const deckCodes = (s: GameState, p = P1): string[] => playerOf(s, p).deck.map((id) => codeOf(s, id));
const discardCodes = (s: GameState, p = P1): string[] => playerOf(s, p).discard.map((id) => codeOf(s, id));

function heroGame(players: readonly Seat[] = [DOMINO], seed = 1): GameState {
  const config = wave7Scenario("juggernaut", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
  return withForm(settled, { heroForm: 0 });
}
/** The hand is the two payment cards; the deck top, first card first, is `deckTop`. */
function stacked(state: GameState, deckTop: readonly string[], hand: readonly string[] = PAYMENT): GameState {
  const base = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, deck: [...p.hand, ...p.deck], hand: [] as InstanceId[] } : p,
    ),
  };
  const withHand = moveToHand(base, P1, ...hand).state;
  return deckTop.length > 0 ? putOnTopOfDeck(withHand, P1, ...deckTop).state : withHand;
}
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const mainOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
/** Juggernaut starts with a tough status card, which would absorb the first hit: take it off. */
const withoutTough = (s: GameState): GameState =>
  patchInstance(s, villainOf(s), { statuses: { ...inst(s, villainOf(s)).statuses, tough: 0 } });
const damageOn = (s: GameState, id = villainOf(s)): number => inst(s, id).damage;
const threatOn = (s: GameState, id = mainOf(s)): number => inst(s, id).threat;

/** Answers prompts from a queue: each answer is an option id (a target) or an option label; otherwise the first legal. */
const answering = (...answers: readonly string[]): Picker => {
  const queue = [...answers];
  return (state) => {
    const options = state.pendingChoice?.options ?? [];
    const hit = options.find((o) => o.optionId === queue[0] || o.label === queue[0]);
    if (hit) {
      queue.shift();
      return [hit.optionId];
    }
    return firstLegal(state);
  };
};
/** Plays `code` from hand paying `cost` with the two payment cards, answering prompts with `pick`. */
function playEvent(
  state: GameState,
  code: string,
  cost: number,
  pick: Picker = firstLegal,
  empty = false,
): { state: GameState; id: InstanceId; before: GameState } {
  const given = moveToHand(state, P1, code);
  const start = empty ? emptyDeck(given.state) : given.state;
  const [id] = given.ids as [InstanceId];
  const driven = driveEventsPicking(WAVE7_DEPS, start, pick, play(P1, id, payWith(start, P1, cost, [id])));
  return { state: driven.state, id, before: start };
}
const playRefused = (state: GameState, code: string, cost: number): boolean => {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  const command: Command = play(P1, id, payWith(given.state, P1, cost, [id]));
  return !applyCommand(given.state, command, WAVE7_DEPS).ok;
};
/** Hand cards stay, the deck and discard pile are emptied: the paid cards are all the reset has to draw on. */
const emptyDeck = (s: GameState): GameState => ({
  ...s,
  players: s.players.map((p) => (p.playerId === P1 ? { ...p, deck: [], discard: [] } : p)),
});
/** Takes Jackpot!'s response when it is offered ("Jackpot!" is the card), declines it otherwise. */
const declineResponses: Picker = (state) => {
  const choice = state.pendingChoice;
  if (choice && choice.prompt.kind !== "chooseTarget" && choice.options.some((o) => /pass|decline|no/i.test(o.label))) {
    return [choice.options.find((o) => /pass|decline|no/i.test(o.label))!.optionId];
  }
  return firstLegal(state);
};

describe("Domino events registry", () => {
  it.each([WORKOUT, LUCK, RIGHT_PLACE, JACKPOT])("%s validates", (id) => {
    expect(validateDefinition(DOMINO_EVENTS[id]!)).toEqual([]);
  });
  it("holds exactly the printed refs of 40040-40043", () => {
    expect(Object.keys(DOMINO_EVENTS).sort()).toEqual(
      [
        WORKOUT,
        LUCK,
        ...LUCK_PARTS,
        "40041.luck-be-a-lady-constant-3",
        "40041.luck-be-a-lady-constant-4",
        RIGHT_PLACE,
        JACKPOT,
      ].sort(),
    );
  });
});

describe("A Good Workout (40040): 4 damage and 1 more per icon discarded, an attack", () => {
  const workout = (deckTop: readonly string[], base = withoutTough(heroGame())) =>
    playEvent(stacked(base, deckTop), "40040", 2);

  it.each([
    [ENERGY, 5],
    [MENTAL, 5],
    [PHYSICAL, 5],
    [WILD, 6],
  ])("discarding %s deals %i to Juggernaut (Domino counts a wild twice)", (top, damage) => {
    const { state, id } = workout([top, PHYSICAL]);
    expect(damageOn(state)).toBe(damage);
    expect(discardCodes(state)).toContain(top);
    expect(deckCodes(state)[0]).toBe(PHYSICAL);
    expect(playerOf(state, P1).discard).toContain(id);
  });

  it("the cost of 2 is paid from hand, and only the top card of the deck is discarded", () => {
    const { state, before } = workout([ENERGY, MENTAL]);
    expect(playerOf(state, P1).hand).toHaveLength(playerOf(before, P1).hand.length - 3);
    expect(deckCodes(state)[0]).toBe(MENTAL);
    expect(discardCodes(state).filter((c) => c === ENERGY)).toHaveLength(1);
  });

  it("is one attack: a tough status absorbs it whole (the extra damage included) and is removed", () => {
    const base = heroGame();
    expect(inst(base, villainOf(base)).statuses.tough).toBeGreaterThan(0);
    const { state } = workout([WILD], base);
    expect(damageOn(state)).toBe(0);
    expect(inst(state, villainOf(state)).statuses.tough ?? 0).toBe(0);
  });

  it("Jackpot! counts its three icons when its response is declined", () => {
    const { state } = playEvent(stacked(withoutTough(heroGame()), [TRIO, PHYSICAL]), "40040", 2, declineResponses);
    expect(damageOn(state)).toBe(7);
    expect(discardCodes(state)).toContain(TRIO);
  });

  it("Jackpot! shuffled back by its own response does not count (Q32 B: a card a response took away)", () => {
    const { state } = playEvent(stacked(withoutTough(heroGame()), [TRIO, PHYSICAL]), "40040", 2, answering("Jackpot!"));
    expect(damageOn(state)).toBe(4);
    expect(discardCodes(state)).not.toContain(TRIO);
    expect(deckCodes(state)).toContain(TRIO);
  });

  it("an empty deck resets from the discard pile (the paid wild cards): the wild card discarded counts 2", () => {
    const { state } = playEvent(stacked(withoutTough(heroGame()), []), "40040", 2, firstLegal, true);
    expect(damageOn(state)).toBe(6);
    // The deck reset again the moment the discard emptied it (RRG "Player Deck", p. 33): both paid cards are back in it.
    expect([...deckCodes(state)].sort()).toEqual(PAYMENT);
    expect(discardCodes(state)).toEqual(["40040"]);
  });

  it("can only be played in hero form", () => {
    const alterEgo = withForm(stacked(heroGame(), [WILD]), "alterEgo");
    expect(playRefused(alterEgo, "40040", 2)).toBe(true);
    expect(playRefused(stacked(heroGame(), [WILD]), "40040", 2)).toBe(false);
  });

  it("two players: only the player's own deck is discarded from", () => {
    const base = stacked(withoutTough(heroGame([DOMINO, SPIDER_MAN])), [WILD]);
    const otherDeck = playerOf(base, P2).deck;
    const { state } = playEvent(base, "40040", 2);
    expect(damageOn(state)).toBe(6);
    expect(playerOf(state, P2).deck).toEqual(otherDeck);
  });
});

describe("Right Place, Right Time (40042): 3 threat and 1 more per icon discarded, a thwart", () => {
  const thwartWith = (deckTop: readonly string[], pick: Picker = firstLegal, base = heroGame()) =>
    playEvent(stacked(base, deckTop), "40042", 2, pick);

  it.each([
    [ENERGY, 4],
    [MENTAL, 4],
    [PHYSICAL, 4],
    [WILD, 5],
  ])("discarding %s removes %i threat from the scheme (main scheme 20)", (top, removed) => {
    const base = patchInstance(heroGame(), mainOf(heroGame()), { threat: 20 });
    const { state } = thwartWith([top, PHYSICAL], firstLegal, base);
    expect(threatOn(state)).toBe(20 - removed);
    expect(discardCodes(state)).toContain(top);
    expect(deckCodes(state)[0]).toBe(PHYSICAL);
  });

  it("Jackpot! counts 3 when declined (6 threat) and nothing when it shuffles itself back (3)", () => {
    const base = patchInstance(heroGame(), mainOf(heroGame()), { threat: 20 });
    expect(threatOn(thwartWith([TRIO], declineResponses, base).state)).toBe(14);
    expect(threatOn(thwartWith([TRIO], answering("Jackpot!"), base).state)).toBe(17);
  });

  it("is a thwart: it can remove the threat from a side scheme and leaves the main scheme alone", () => {
    const base = patchInstance(heroGame(), mainOf(heroGame()), { threat: 20 });
    const { state } = thwartWith([WILD], answering(mainOf(base)), base);
    expect(threatOn(state)).toBe(15);
  });

  it("an empty deck resets from the discard pile (the paid wild cards): the wild card discarded counts 2", () => {
    const base = patchInstance(heroGame(), mainOf(heroGame()), { threat: 20 });
    const { state } = playEvent(stacked(base, []), "40042", 2, firstLegal, true);
    expect(threatOn(state)).toBe(15);
    expect([...deckCodes(state)].sort()).toEqual(PAYMENT);
  });

  it("can only be played in hero form", () => {
    expect(playRefused(withForm(stacked(heroGame(), [WILD]), "alterEgo"), "40042", 2)).toBe(true);
  });
});

describe("Luck Be a Lady (40041): one effect per counted icon", () => {
  const damaged = (): GameState => {
    const base = withoutTough(heroGame());
    const withThreat = patchInstance(base, mainOf(base), { threat: 20 });
    return patchInstance(withThreat, identityOf(withThreat, P1), { damage: 6 });
  };
  const luck = (deckTop: readonly string[], pick: Picker = firstLegal, base = damaged()) =>
    playEvent(stacked(base, deckTop), "40041", 1, pick);
  const me = (s: GameState): InstanceId => identityOf(s, P1);

  it("an [energy] card heals 2 damage from a character", () => {
    const base = damaged();
    const { state } = luck([ENERGY, PHYSICAL], answering(me(base)), base);
    expect(damageOn(state, me(state))).toBe(4);
    expect(damageOn(state)).toBe(0);
    expect(threatOn(state)).toBe(20);
    expect(discardCodes(state)).toContain(ENERGY);
    expect(deckCodes(state)[0]).toBe(PHYSICAL);
  });

  it("a [mental] card removes 2 threat from a scheme", () => {
    const { state } = luck([MENTAL, PHYSICAL]);
    expect(threatOn(state)).toBe(18);
    expect(damageOn(state, me(state))).toBe(6);
    expect(damageOn(state)).toBe(0);
  });

  it("a [physical] card deals 3 damage to an enemy", () => {
    const { state } = luck([PHYSICAL, ENERGY]);
    expect(damageOn(state)).toBe(3);
    expect(threatOn(state)).toBe(20);
    expect(damageOn(state, me(state))).toBe(6);
  });

  it("a [wild] card is two counted wilds in hero form: two choices, any of the three effects each", () => {
    const base = damaged();
    const { state } = luck(
      [WILD, PHYSICAL],
      answering("Remove 2 threat from a scheme", "Deal 3 damage to an enemy"),
      base,
    );
    expect(threatOn(state)).toBe(18);
    expect(damageOn(state)).toBe(3);
    expect(damageOn(state, me(state))).toBe(6);
    expect(discardCodes(state)).toContain(WILD);
  });

  it("the two wild choices may be the same effect: heal 2 twice", () => {
    const base = damaged();
    const { state } = luck(
      [WILD],
      answering("Heal 2 damage from a character", me(base), "Heal 2 damage from a character", me(base)),
      base,
    );
    expect(damageOn(state, me(state))).toBe(2);
  });

  it("Jackpot! (energy, mental, physical) does all three effects when its response is declined", () => {
    const base = damaged();
    const heal = answering(me(base));
    const { state } = luck(
      [TRIO, PHYSICAL],
      (s) => (s.pendingChoice?.prompt.kind === "chooseTarget" ? heal(s) : declineResponses(s)),
      base,
    );
    expect(damageOn(state, me(state))).toBe(4);
    expect(threatOn(state)).toBe(18);
    expect(damageOn(state)).toBe(3);
    expect(discardCodes(state)).toContain(TRIO);
  });

  it("an empty deck resets from the discard pile (the paid wild card): it counts 2, two effects", () => {
    const base = damaged();
    const pick = answering("Deal 3 damage to an enemy", "Deal 3 damage to an enemy");
    const { state } = playEvent(stacked(base, []), "40041", 1, pick, true);
    expect(damageOn(state)).toBe(6);
    expect(threatOn(state)).toBe(20);
    expect(deckCodes(state)).toEqual([PAYMENT[0]]);
  });

  it("can only be played in hero form", () => {
    expect(playRefused(withForm(stacked(damaged(), [WILD]), "alterEgo"), "40041", 1)).toBe(true);
  });
});

describe("Jackpot! (40043): shuffles itself back after it is discarded from the top of the deck", () => {
  it("a deck discard by another card offers the response from the discard pile; taking it puts Jackpot! in the deck", () => {
    const { state } = playEvent(stacked(withoutTough(heroGame()), [TRIO, PHYSICAL]), "40040", 2, answering("Jackpot!"));
    expect(discardCodes(state)).not.toContain(TRIO);
    expect(deckCodes(state)).toContain(TRIO);
  });

  it("declining leaves it in the discard pile", () => {
    const { state } = playEvent(stacked(withoutTough(heroGame()), [TRIO, PHYSICAL]), "40040", 2, declineResponses);
    expect(discardCodes(state)).toContain(TRIO);
    expect(deckCodes(state)).not.toContain(TRIO);
  });

  it("a card of another kind in the discard pile is not affected", () => {
    const { state } = playEvent(stacked(withoutTough(heroGame()), [ENERGY]), "40040", 2, answering("Jackpot!"));
    expect(discardCodes(state)).toContain(ENERGY);
  });
});
