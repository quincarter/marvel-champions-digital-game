import { cardId, WAVE8_STARTER_DECKS } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  characterProfile,
  createGame,
  legalActions,
  traitsOf,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, playFromHand, withForm } from "../../../testing/staging.js";
import { WAVE8_CARDS } from "../../cards.js";
import { WAVE8_DEPS } from "../../index.js";
import { JUBILEE_OBLIGATION_NEMESIS, JUBILEE_OBLIGATION_NEMESIS_SKIPPED } from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Jubilee's obligation and nemesis set (47023 Grounded; 47024 Nanny, 47025 Naughty Children, 47026 Battle Suit, 47027
 * "Lost" Child), docs/phase7-wave8.md section 7.3, 3.63, 3.70; Q37. Real commands in a real game: her starter deck
 * (`jubilee-justice`) against Rhino (Core, standard, no modular set). Spider-Man (Justice precon) is the second seat
 * where two players matter. A boost card that must do nothing is Advance 01186 (0 boost icons). Hands are staged by
 * relabeling cards (test-only surgery on cards whose own text is not under test): Cell Phone 47019 [energy], Disguise
 * 47013 [mental], Waylay 47014 [physical], X-Gene 47020 [wild]. Allies: Synch 47018 (cost 3), Husk 47012 (cost 4).
 *
 * The form-change cost (section 3.63) is paid with the change-form command itself (`payment`), as a play is paid for:
 * `legalActions` lists the change only when her hand can pay it, with a payment that does.
 */
const GROUNDED = "47023";
const NANNY = "47024";
const NAUGHTY = "47025";
const SUIT = "47026";
const LOST_CHILD = "47027";
const COST_REF = "47023.obligation";

const REFS = [
  COST_REF,
  "47023.when-revealed",
  "47023.grounded-response",
  "47024.nanny-forced-response",
  "47025.when-revealed",
  "47026.battle-suit-constant",
  "47026.when-revealed",
  "47027.lost-child-constant",
  "47027.when-revealed",
];
const ALL_REFS = REFS;

const E = "47019";
const M = "47013";
const PH = "47014";
const W = "47020";
const SYNCH = "47018";
const HUSK = "47012";
const FIRECRACKER = "47007a";
const THREE_STEPS = "47015";
const ADVANCE = "01186";
const POWER_OF_JUSTICE = "01062";

const byCard = (a: object, b: object): number => JSON.stringify(a).localeCompare(JSON.stringify(b));

/** The change-form option paid with these hand cards (Grounded's additional cost, section 3.63). */
const toHeroPaying = (cards: readonly InstanceId[]): Command => ({
  type: "changeForm",
  playerId: P1,
  payment: cards.map((fromHand) => ({ fromHand })),
});

const JUBILEE = WAVE8_STARTER_DECKS.find((d) => d.id === "jubilee-justice")!;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = "jubilee" | typeof SPIDER_MAN;
const seatOf = (seat: Seat) =>
  seat === "jubilee"
    ? {
        identityCardId: JUBILEE.identityCardId,
        aspects: JUBILEE.aspects,
        deck: JUBILEE.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
      }
    : seat;

function setupGame(seats: readonly Seat[] = ["jubilee"], seed = 1): GameState {
  const config = coreScenario("rhino", {
    players: seats.map(seatOf),
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE8_CARDS,
  } as never);
  const created = createGame({ ...config, requireLegalDecks: false }, WAVE8_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE8_DEPS);
  // Headroom on the main scheme (a negative count, surgery): the tests' villain phases scheme and accelerate.
  return patchInstance(settled, settled.mainScheme.instanceId, { threat: -30 });
}
/** Jubilee (seat 1) in hero form. */
const heroGame = (seats: readonly Seat[] = ["jubilee"]): GameState => withForm(setupGame(seats), { heroForm: 0 }, P1);
/** Jubilee in alter-ego form (as the game starts). */
const alterEgoGame = (seats: readonly Seat[] = ["jubilee"]): GameState => setupGame(seats);

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, WAVE8_DEPS)!;
const traits = (s: GameState, id: InstanceId): string[] => traitsOf(s, id, WAVE8_DEPS).map((t) => String(t));
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const relabel = (s: GameState, id: InstanceId, code: string): GameState =>
  patchInstance(s, id, { cardId: cardId(code) });
const inHand = (s: GameState, p: PlayerId = P1) => playerOf(s, p).hand;
const formOf = (s: GameState, p: PlayerId = P1): string => playerOf(s, p).identity.form;

/** Where an instance is, in one word. */
function whereIs(s: GameState, id: InstanceId): string {
  for (const p of s.players) {
    for (const zone of ["setAside", "playArea", "dealtEncounter", "hand", "deck", "discard"] as const) {
      if (p[zone].includes(id)) return `${zone}:${p.playerId}`;
    }
  }
  for (const d of Object.values(s.encounterDecks)) {
    if (d.deck.includes(id)) return "encounterDeck";
    if (d.discard.includes(id)) return "encounterDiscard";
  }
  if (s.removedFromGame.includes(id)) return "removedFromGame";
  if (s.victoryDisplay.includes(id)) return "victoryDisplay";
  return inst(s, id).attachedTo ? `attachedTo:${inst(s, id).attachedTo}` : "elsewhere";
}

/** Answers the defender prompt with "decline" and every other prompt like `firstLegal` unless `pick` has a match. */
const picker =
  (...want: readonly string[]): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    for (const w of want) {
      const at = choice.options.find((o) => o.optionId === w || o.optionId.endsWith(w) || o.label.includes(w));
      if (at) return [at.optionId as string];
    }
    return firstLegal(s);
  };
const run = (s: GameState, pick: Picker, ...commands: readonly Command[]) =>
  driveEventsPicking(WAVE8_DEPS, s, pick, ...commands);

/** `p`'s hand replaced by cards relabeled as `codes` (the old hand goes to the bottom of the deck). */
function handOf(s: GameState, p: PlayerId, codes: readonly string[]): { state: GameState; ids: InstanceId[] } {
  const owner = playerOf(s, p);
  const deck = [...owner.deck, ...owner.hand];
  const ids = deck.slice(0, codes.length);
  const moved: GameState = {
    ...s,
    players: s.players.map((pl) =>
      pl.playerId === p ? { ...pl, deck: deck.filter((i) => !ids.includes(i)), hand: ids } : pl,
    ),
  };
  return { state: ids.reduce((acc, id, n) => relabel(acc, id, codes[n]!), moved), ids };
}

/**
 * The cards `codes` as the top of the encounter deck after one boost filler per seat: set-aside copies come out of the
 * set-aside area, the rest from wherever they are. The villain phase then reveals them to the first seat.
 */
function stage(s: GameState, ...codes: readonly string[]): GameState {
  const named: InstanceId[] = [];
  for (const code of codes) {
    const id =
      s.players.flatMap((p) => p.setAside).find((i) => codeOf(s, i) === code && !named.includes(i)) ??
      instancesOf(s, code).find((i) => !named.includes(i))!;
    named.push(id);
  }
  const stripped: GameState = {
    ...s,
    players: s.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => !named.includes(i)) })),
    encounterDecks: Object.fromEntries(
      Object.entries(s.encounterDecks).map(([k, d]) => [
        k,
        { ...d, deck: d.deck.filter((i) => !named.includes(i)), discard: d.discard.filter((i) => !named.includes(i)) },
      ]),
    ),
  };
  const deckId = activeEncounterDeckId(stripped);
  const pile = stripped.encounterDecks[deckId]!;
  const fillers = stackEncounterDeck(stripped, ...stripped.players.map(() => ADVANCE));
  const fillerIds = fillers.encounterDecks[deckId]!.deck.slice(0, stripped.players.length);
  const rest = fillers.encounterDecks[deckId]!.deck.filter((i) => !fillerIds.includes(i));
  void pile;
  return {
    ...fillers,
    encounterDecks: {
      ...fillers.encounterDecks,
      [deckId]: { ...fillers.encounterDecks[deckId]!, deck: [...fillerIds, ...named, ...rest] },
    },
  };
}

/** Every seat ends its turn: the villain phase runs, the cards `codes` are revealed to seat 1. */
function revealed(s: GameState, codes: readonly string[], pick: Picker = picker()) {
  const staged = stage(s, ...codes);
  const ids = staged.encounterDecks[activeEncounterDeckId(staged)]!.deck.slice(
    staged.players.length,
    staged.players.length + codes.length,
  );
  const result = run(staged, pick, ...staged.players.map((p) => endTurn(p.playerId)));
  return { ...result, ids };
}

/** `allies` ([code, cost]) played one after the other, each paid from a hand staged with `cost` [energy] cards. */
function withAllies(s: GameState, allies: readonly (readonly [string, number])[]): GameState {
  let state = s;
  for (const [code, cost] of allies) {
    const staged = handOf(
      state,
      P1,
      Array.from({ length: cost }, () => E),
    ).state;
    state = playFromHand(WAVE8_DEPS, staged, code, cost, picker()).state;
  }
  return state;
}

/** The first `n` cards of the encounter deck relabeled Advance (0 boost icons; as a revealed card Rhino schemes). */
function fill(s: GameState, n: number): GameState {
  const deckId = activeEncounterDeckId(s);
  return s.encounterDecks[deckId]!.deck.slice(0, n).reduce((acc, id) => relabel(acc, id, ADVANCE), s);
}

/** A minion relabeled from the next spare encounter card, engaged with `to`, faceup and undamaged. */
function withMinion(s: GameState, to: PlayerId, code: string): { state: GameState; id: InstanceId } {
  const minion = s.cardPool[cardId(code)];
  if (minion?.type !== "minion") throw new Error(`no minion ${code} in the pool`);
  const deckId = activeEncounterDeckId(s);
  const pile = s.encounterDecks[deckId]!;
  const spare = pile.deck[pile.deck.length - 1]!;
  const relabeled: GameState = {
    ...patchInstance(s, spare, { cardId: minion.id, faceup: true, engagedWith: to, damage: 0 }),
    encounterDecks: {
      ...s.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => i !== spare), discard: pile.discard },
    },
    players: s.players.map((p) => (p.playerId === to ? { ...p, playArea: [...p.playArea, spare] } : p)),
  };
  return { state: relabeled, id: spare };
}

describe("registry", () => {
  it("registers every ref, the form-change cost included, and skips none", () => {
    expect(Object.keys(JUBILEE_OBLIGATION_NEMESIS).sort()).toEqual([...REFS].sort());
    expect(Object.keys(JUBILEE_OBLIGATION_NEMESIS_SKIPPED)).toEqual([]);
    const named = WAVE8_CARDS.filter((c) => [GROUNDED, NANNY, NAUGHTY, SUIT, LOST_CHILD].includes(c.id as string))
      .flatMap((c) => abilityRefIds(c))
      .sort();
    expect(named).toEqual([...ALL_REFS].sort());
  });

  it("every definition validates", () => {
    const all = JUBILEE_OBLIGATION_NEMESIS as Record<string, never>;
    for (const [id, definition] of Object.entries(all)) expect(validateDefinition(definition), id).toEqual([]);
  });

  it("the trigger of each ref: the Response is optional, Nanny's is forced", () => {
    const def = (id: string) => JUBILEE_OBLIGATION_NEMESIS[id as never] as any;
    expect(def("47023.when-revealed").trigger).toBeDefined();
    expect(def("47023.grounded-response").trigger.forced).toBeFalsy();
    expect(def("47024.nanny-forced-response").trigger.forced).toBe(true);
  });
});

describe("the printed cards (data against the scans)", () => {
  const data = (code: string) => WAVE8_CARDS.find((c) => (c.id as string) === code)! as any;
  it("Grounded: an obligation with 2 boost icons given to the Jubilation Lee player", () => {
    expect(data(GROUNDED)).toMatchObject({ type: "obligation", boostIcons: 2 });
  });
  it("Nanny: unique MUTANT minion, SCH 2, ATK 1, 4 hit points, toughness, 2 boost icons", () => {
    expect(data(NANNY)).toMatchObject({
      type: "minion",
      unique: true,
      sch: 2,
      atk: 1,
      hp: 4,
      boostIcons: 2,
      keywords: [{ name: "toughness" }],
    });
  });
  it("Naughty Children: a side scheme with a flat 2 threat, a crisis icon and 2 boost icons", () => {
    expect(data(NAUGHTY)).toMatchObject({
      type: "side_scheme",
      startingThreat: { base: 2, perPlayer: 0 },
      icons: ["crisis"],
      boostIcons: 2,
    });
  });
  it("Battle Suit: an ARMOR attachment, +1 ATK, 2 boost icons; 'Lost' Child: -1 SCH, 1 boost icon, 2 copies", () => {
    expect(data(SUIT)).toMatchObject({ type: "attachment", statModifiers: { atk: 1 }, boostIcons: 2 });
    expect(data(LOST_CHILD)).toMatchObject({
      type: "attachment",
      statModifiers: { sch: -1 },
      boostIcons: 1,
      quantityInSet: 2,
    });
  });
});

describe("setup: the obligation is shuffled into the encounter deck, the nemesis set is set aside", () => {
  it("Jubilee's set-aside area holds Nanny, Naughty Children, Battle Suit and both 'Lost' Children", () => {
    const s = alterEgoGame();
    const aside = playerOf(s, P1).setAside.map((i) => codeOf(s, i));
    expect(aside.sort()).toEqual([NANNY, NAUGHTY, SUIT, LOST_CHILD, LOST_CHILD].sort());
    expect(instancesOf(s, GROUNDED)).toHaveLength(1);
  });
});

describe("Grounded (47023)", () => {
  describe("When Revealed: change to alter-ego form", () => {
    it("revealed in hero form: she is in alter-ego form and Grounded is in her play area", () => {
      const s = heroGame();
      const { state, ids } = revealed(s, [GROUNDED]);
      expect(whereIs(state, ids[0]!)).toBe("playArea:p1");
      expect(formOf(state)).toBe("alterEgo");
    });

    it("revealed in alter-ego form: nothing changes and Grounded is in her play area", () => {
      const { state, ids } = revealed(alterEgoGame(), [GROUNDED]);
      expect(whereIs(state, ids[0]!)).toBe("playArea:p1");
      expect(formOf(state)).toBe("alterEgo");
    });

    it("two players, Jubilee second: the obligation goes to her and she is the one changed", () => {
      const s = withForm(setupGame([SPIDER_MAN, "jubilee"]), { heroForm: 0 }, P2);
      const { state, ids } = revealed(s, [GROUNDED]);
      expect(whereIs(state, ids[0]!)).toBe("playArea:p2");
      expect(formOf(state, P2)).toBe("alterEgo");
    });

    it("a forced change does not use her one change of the round (she can change back at once, at Grounded's cost)", () => {
      const { state } = revealed(heroGame(), [GROUNDED]);
      expect(playerOf(state, P1).identity.changedFormThisRound).toBe(false);
      const staged = handOf(state, P1, [E, E]);
      const back = applyCommand(staged.state, toHeroPaying(staged.ids), WAVE8_DEPS);
      expect(back.ok).toBe(true);
      if (back.ok) expect(formOf(back.state)).toBe("hero");
    });
  });

  describe("Response: after you play a Jubilee event, remove this card from the game", () => {
    /** Grounded in play (revealed in the villain phase), her next turn in hero form with the hand staged. */
    function groundedInPlay() {
      const { state, ids } = revealed(heroGame(), [GROUNDED]);
      return { state: withForm(state, { heroForm: 0 }, P1), grounded: ids[0]! };
    }
    function playEvent(code: string, cost: number, pick: Picker) {
      const { state, grounded } = groundedInPlay();
      // Paid with [energy] cards only: no wild is spent, so an event that reads its payment's types asks nothing.
      const typed = handOf(
        state,
        P1,
        Array.from({ length: cost }, () => E),
      ).state;
      const given = moveToHand(typed, P1, code);
      const [id] = given.ids as [InstanceId];
      const pay = payWith(given.state, P1, cost, [id]);
      const result = run(given.state, pick, play(P1, id, pay));
      return { ...result, grounded };
    }

    const RESPONSE = "47023.grounded-response";
    /** Every chooseTriggers prompt seen, as its option ids. */
    const triggerPrompts =
      (log: string[][]): Picker =>
      (s) => {
        const c = s.pendingChoice!;
        if (c.prompt.kind === "chooseTriggers") log.push(c.options.map((o) => o.optionId as string));
        return picker(RESPONSE)(s);
      };

    it("she plays Firecracker: the Response is offered and Grounded is removed from the game", () => {
      const log: string[][] = [];
      const { state, grounded } = playEvent(FIRECRACKER, 2, triggerPrompts(log));
      expect(log.flat().some((id) => id.endsWith(RESPONSE))).toBe(true);
      expect(whereIs(state, grounded)).toBe("removedFromGame");
    });

    it("she does not use the Response (an optional Response): Grounded stays in her play area", () => {
      const log: string[][] = [];
      const { state, grounded } = playEvent(FIRECRACKER, 2, (s) => {
        if (s.pendingChoice!.prompt.kind === "chooseTriggers") log.push([]);
        return firstLegal(s);
      });
      expect(log.length).toBeGreaterThan(0);
      expect(whereIs(state, grounded)).toBe("playArea:p1");
    });

    it("she plays Three Steps Ahead (a Justice event, not identity-specific): no Response, Grounded stays", () => {
      const log: string[][] = [];
      const { state, grounded } = playEvent(THREE_STEPS, 3, triggerPrompts(log));
      expect(log.flat().some((id) => id.endsWith(RESPONSE))).toBe(false);
      expect(whereIs(state, grounded)).toBe("playArea:p1");
    });
  });

  describe("As an additional cost to change to hero form during your turn, spend 2 resources of the same type (section 3.63, Q37 = A)", () => {
    /** Grounded in her play area, her turn, alter-ego form, the hand staged as `codes`. */
    function grounded(codes: readonly string[]) {
      const { state, ids: revealedIds } = revealed(alterEgoGame(), [GROUNDED]);
      const staged = handOf(state, P1, codes);
      return { s: staged.state, hand: staged.ids, groundedId: revealedIds[0]! };
    }
    /** The change-form action as `legalActions` lists it for her: legal with its example, or illegal with its reason. */
    function changeOf(s: GameState) {
      const actions = legalActions(s, P1, WAVE8_DEPS);
      if (actions.kind !== "turn") throw new Error(`expected her turn, got ${actions.kind}`);
      return {
        legal: actions.legal.find((a) => a.action.kind === "changeForm"),
        illegal: actions.illegal.find((a) => a.action.kind === "changeForm"),
      };
    }

    it("a hand of [energy] and [mental] cannot pay: the change to hero form is refused", () => {
      const { s } = grounded([E, M]);
      expect(applyCommand(s, toHero(P1), WAVE8_DEPS).ok).toBe(false);
    });

    it("a hand of [energy] and [mental]: not offered, with or without the two cards, and the reason names Grounded", () => {
      const { s, hand } = grounded([E, M]);
      const { legal, illegal } = changeOf(s);
      expect(legal).toBeUndefined();
      expect(illegal?.reason).toBe("insufficient_resources");
      expect(illegal?.message).toContain("Grounded (2 resources of the same type)");
      const mixed = applyCommand(s, toHeroPaying(hand), WAVE8_DEPS);
      expect(mixed.ok).toBe(false);
      expect(inHand(s)).toHaveLength(2);
    });

    it("a hand of two [energy] cards: the change is offered at 2 resources of one type and discards both", () => {
      const { s, hand, groundedId } = grounded([E, E, PH]);
      const { legal } = changeOf(s);
      expect(legal?.formChangeCost).toEqual({ sourceInstanceIds: [groundedId] });
      expect(legal?.example).toEqual(toHeroPaying(hand.slice(0, 2)));
      const r = run(s, picker(), legal!.example);
      expect(inHand(r.state)).toHaveLength(1);
      expect(formOf(r.state)).toBe("hero");
      expect(playerOf(r.state, P1).discard).toEqual(expect.arrayContaining(hand.slice(0, 2)));
    });

    it("a wild stands for any type: [mental] and The Power of Justice's [wild] pays", () => {
      const { s, hand } = grounded([M, POWER_OF_JUSTICE]);
      const example = changeOf(s).legal?.example;
      expect(example?.type === "changeForm" ? [...(example.payment ?? [])].sort(byCard) : null).toEqual(
        hand.map((fromHand) => ({ fromHand })).sort(byCard),
      );
      const r = run(s, picker(), toHeroPaying(hand));
      expect(formOf(r.state)).toBe("hero");
      expect(inHand(r.state)).toHaveLength(0);
    });

    it("X-Gene in play cannot pay it: its [wild] is for an identity-specific event only", () => {
      const { s } = grounded([E, M]);
      const xGene = playerOf(s, P1).deck[0]!;
      const inPlay: GameState = {
        ...patchInstance(relabel(s, xGene, W), xGene, { controllerId: P1, faceup: true }),
        players: s.players.map((p) =>
          p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== xGene), playArea: [...p.playArea, xGene] } : p,
        ),
      };
      expect(changeOf(inPlay).legal).toBeUndefined();
    });

    it("she changes to alter-ego form with Grounded in play: no cost", () => {
      const { s } = grounded([E, M]);
      const hero = withForm(s, { heroForm: 0 }, P1);
      const { legal } = changeOf(hero);
      expect(legal?.needsPayment).toBe(false);
      expect(legal?.formChangeCost).toBeUndefined();
      const r = run(hero, picker(), toHero(P1));
      expect(formOf(r.state)).toBe("alterEgo");
      expect(inHand(r.state)).toHaveLength(2);
    });

    it("another player's change to hero form is free: the cost speaks only to the player whose play area holds it", () => {
      const game = setupGame([SPIDER_MAN, "jubilee"]);
      const { state, ids } = revealed(game, [GROUNDED]);
      expect(whereIs(state, ids[0]!)).toBe("playArea:p2");
      // The first player token has passed: it is Jubilee's turn, and her own change is the one that costs.
      expect(applyCommand(state, toHero(P2), WAVE8_DEPS).ok).toBe(false);
      const next = run(state, picker(), endTurn(P2)).state;
      const r = applyCommand(next, toHero(P1), WAVE8_DEPS);
      if (!r.ok) throw new Error(r.error.message);
      expect(formOf(r.state, P1)).toBe("hero");
    });
  });
});

describe("Naughty Children (47025)", () => {
  /** The threat on Naughty Children after it is revealed to Jubilee with `hand` in her hand. */
  function threatWithHand(hand: readonly string[]): number {
    const s = heroGame();
    const size = inHand(s).length;
    expect(hand).toHaveLength(size);
    const staged = handOf(s, P1, hand).state;
    const { state, ids } = revealed(staged, [NAUGHTY]);
    expect(whereIs(state, ids[0]!)).toBe("elsewhere");
    return inst(state, ids[0]!).threat;
  }
  const filler = (n: number, ...codes: string[]) => [
    ...codes,
    ...Array.from({ length: n - codes.length }, () => codes[0]!),
  ];

  it("is in play with its 2 starting threat plus 1 per different type in her hand", () => {
    const size = inHand(heroGame()).length;
    expect(threatWithHand(filler(size, E))).toBe(2 + 1);
    expect(threatWithHand(filler(size, E, M))).toBe(2 + 2);
    expect(threatWithHand(filler(size, E, M, PH))).toBe(2 + 3);
    expect(threatWithHand(filler(size, E, M, PH, W))).toBe(2 + 4);
  });
});

describe("Nanny (47024)", () => {
  /** Nanny engaged with Jubilee (hero form), with the allies `allies` in play; the villain phase runs. */
  function nannyAttacks(
    allies: readonly [string, number][],
    prep: (s: GameState) => GameState = (s) => s,
    seats: readonly Seat[] = ["jubilee"],
  ) {
    const s = withAllies(heroGame(seats), allies);
    const placed = withMinion(prep(s), P1, NANNY);
    const staged = fill(placed.state, 6);
    const result = run(staged, picker(), ...staged.players.map((p) => endTurn(p.playerId)));
    return { ...result, nanny: placed.id, before: staged };
  }
  const lostChildren = (s: GameState) => instancesOf(s, LOST_CHILD);
  const revealedLostChildren = (s: GameState) => lostChildren(s).filter((i) => inst(s, i).attachedTo !== null);

  it("is a minion with SCH 2, ATK 1, 4 hit points and toughness", () => {
    const s = withMinion(heroGame(), P1, NANNY);
    expect(profile(s.state, s.id)).toMatchObject({ sch: 2, atk: 1, maxHp: 4 });
  });

  it("she attacks Jubilee, who controls Synch: a 'Lost' Child is found in the set-aside area and revealed onto Synch", () => {
    const { state, events, nanny, before } = nannyAttacks([[SYNCH, 3]]);
    expect(ofType(events, "attackResolved").some((e) => e.enemyInstanceId === nanny)).toBe(true);
    const synch = instancesOf(state, SYNCH)[0]!;
    const attached = revealedLostChildren(state);
    expect(attached).toHaveLength(1);
    expect(inst(state, attached[0]!).attachedTo).toBe(synch);
    // Both copies were set aside; the other one still is.
    expect(lostChildren(before).map((i) => whereIs(before, i))).toEqual(["setAside:p1", "setAside:p1"]);
    expect(lostChildren(state).filter((i) => whereIs(state, i) === "setAside:p1")).toHaveLength(1);
    expect(inst(state, synch).engagedWith).toBe(P1);
  });

  it("she attacks Jubilee with no ally in play: nothing is searched for or revealed", () => {
    const { state, events, nanny } = nannyAttacks([]);
    expect(ofType(events, "attackResolved").some((e) => e.enemyInstanceId === nanny)).toBe(true);
    expect(revealedLostChildren(state)).toHaveLength(0);
    expect(lostChildren(state).filter((i) => whereIs(state, i) === "setAside:p1")).toHaveLength(2);
  });

  it("the copy is found in the encounter discard pile too (the set-aside copies are gone)", () => {
    const { state } = nannyAttacks([[SYNCH, 3]], (s) => {
      const deckId = activeEncounterDeckId(s);
      const ids = lostChildren(s);
      const pile = s.encounterDecks[deckId]!;
      return {
        ...s,
        players: s.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => !ids.includes(i)) })),
        encounterDecks: {
          ...s.encounterDecks,
          [deckId]: { deck: pile.deck, discard: [...ids.map((i) => i), ...pile.discard] },
        },
      };
    });
    expect(revealedLostChildren(state)).toHaveLength(1);
  });

  it("the copy is found in the encounter deck too, and the deck is shuffled by the search", () => {
    const { state } = nannyAttacks([[SYNCH, 3]], (s) => {
      const deckId = activeEncounterDeckId(s);
      const ids = lostChildren(s);
      const pile = s.encounterDecks[deckId]!;
      return {
        ...s,
        players: s.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => !ids.includes(i)) })),
        encounterDecks: { ...s.encounterDecks, [deckId]: { deck: [...pile.deck, ...ids], discard: pile.discard } },
      };
    });
    expect(revealedLostChildren(state)).toHaveLength(1);
  });

  it("two players: Nanny attacks the Spider-Man seat, who controls no ally: no search (the condition reads the attacked player)", () => {
    const seats: readonly Seat[] = ["jubilee", SPIDER_MAN];
    const s = withForm(withAllies(heroGame(seats), [[SYNCH, 3]]), { heroForm: 0 }, P2);
    const placed = withMinion(s, P2, NANNY);
    const staged = fill(placed.state, 6);
    const { state, events } = run(staged, picker(), endTurn(P1), endTurn(P2));
    expect(ofType(events, "attackResolved").some((e) => e.enemyInstanceId === placed.id)).toBe(true);
    expect(revealedLostChildren(state)).toHaveLength(0);
  });
});

describe("Battle Suit (47026)", () => {
  /** Nanny (4 hit points) and Shocker 01103 (3) engaged with Jubilee; `damage` on each by id; the suit revealed. */
  function suitRevealed(minions: readonly string[], damage: readonly number[] = []) {
    let s = heroGame();
    const ids: InstanceId[] = [];
    minions.forEach((code, n) => {
      const m = withMinion(s, P1, code);
      s = damage[n] ? patchInstance(m.state, m.id, { damage: damage[n]! }) : m.state;
      ids.push(m.id);
    });
    return { ...revealed(s, [SUIT]), minionIds: ids, suit: undefined as never };
  }
  const SHOCKER = "01103";

  it("attaches to the minion with the fewest remaining hit points: Shocker (3) over Nanny (4)", () => {
    const { state, ids, minionIds } = suitRevealed([NANNY, SHOCKER]);
    expect(whereIs(state, ids[0]!)).toBe(`attachedTo:${minionIds[1]}`);
  });

  it("damage counts: Nanny with 2 damage (2 left) is below Shocker (3)", () => {
    const { state, ids, minionIds } = suitRevealed([NANNY, SHOCKER], [2, 0]);
    expect(whereIs(state, ids[0]!)).toBe(`attachedTo:${minionIds[0]}`);
  });

  it("the attached minion gets +1 ATK and +3 hit points and is AERIAL (Nanny: ATK 2, 7 hit points)", () => {
    const { state, minionIds } = suitRevealed([NANNY]);
    expect(profile(state, minionIds[0]!)).toMatchObject({ atk: 2, maxHp: 7 });
    expect(traits(state, minionIds[0]!)).toContain("AERIAL");
    expect(traits(state, minionIds[0]!)).toContain("MUTANT");
  });

  it("with no minion in play the card is not attached and is discarded", () => {
    const { state, events, ids } = suitRevealed([]);
    expect(ofType(events, "encounterCardRevealed").filter((e) => e.instanceId === ids[0])).toHaveLength(1);
    expect(whereIs(state, ids[0]!)).not.toMatch(/^attachedTo/);
  });

  it("with no minion in play the card gains surge: the next encounter card is revealed", () => {
    const { events } = suitRevealed([]);
    expect(ofType(events, "encounterCardRevealed").length).toBeGreaterThanOrEqual(2);
  });
});

describe('"Lost" Child (47027)', () => {
  /** Jubilee with `allies` in play (hero form); `count` "Lost" Children revealed in the villain phase. */
  function lostChildRevealed(allies: readonly [string, number][], count = 1) {
    const s = withAllies(heroGame(), allies);
    return revealed(
      s,
      Array.from({ length: count }, () => LOST_CHILD),
    );
  }

  it("attaches to the ally with the highest cost: Husk (4) over Synch (3), who engages Jubilee as a minion", () => {
    const { state, ids } = lostChildRevealed([
      [SYNCH, 3],
      [HUSK, 4],
    ]);
    const husk = instancesOf(state, HUSK)[0]!;
    const synch = instancesOf(state, SYNCH)[0]!;
    expect(whereIs(state, ids[0]!)).toBe(`attachedTo:${husk}`);
    expect(inst(state, husk).engagedWith).toBe(P1);
    expect(inst(state, synch).engagedWith ?? null).toBeNull();
  });

  it("treats Husk as a REGRESSED minion: SCH is her printed THW (2) less 1, ATK stays 2", () => {
    const { state } = lostChildRevealed([[HUSK, 4]]);
    const husk = instancesOf(state, HUSK)[0]!;
    expect(traits(state, husk)).toContain("REGRESSED");
    expect(profile(state, husk)).toMatchObject({ sch: 1, atk: 2 });
  });

  it("a second copy, revealed the next round, goes to the ally without a 'Lost' Child: Synch", () => {
    const first = lostChildRevealed([
      [SYNCH, 3],
      [HUSK, 4],
    ]);
    const second = revealed(first.state, [LOST_CHILD]);
    const husk = instancesOf(second.state, HUSK)[0]!;
    const synch = instancesOf(second.state, SYNCH)[0]!;
    expect(whereIs(first.state, first.ids[0]!)).toBe(`attachedTo:${husk}`);
    expect(whereIs(second.state, second.ids[0]!)).toBe(`attachedTo:${synch}`);
  });

  it("no ally to attach to: the card gains surge (discarded, the next card revealed)", () => {
    const { state, events, ids } = lostChildRevealed([]);
    expect(whereIs(state, ids[0]!)).not.toMatch(/^attachedTo/);
    expect(ofType(events, "encounterCardRevealed").length).toBeGreaterThanOrEqual(2);
  });

  it("no ally left without a 'Lost' Child (one ally, two copies): the second surges", () => {
    const first = lostChildRevealed([[HUSK, 4]]);
    const second = revealed(first.state, [LOST_CHILD]);
    expect(whereIs(second.state, second.ids[0]!)).not.toMatch(/^attachedTo/);
    expect(ofType(second.events, "encounterCardRevealed").length).toBeGreaterThanOrEqual(2);
  });
});
