import { abilityId, cardId, CORE_CARDS, WAVE8_CARDS, WAVE8_STARTER_DECKS, type AnyCard } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  createGame,
  handSize,
  maxHitPoints,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { defineAbilities, draw, forcedResponse, mergeRegistries, on } from "../../../dsl/index.js";
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
  runWith,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, moveToDiscard, withDamage, withForm } from "../../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { FREEZE_MOMENT, ICEMAN_IDENTITY } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Iceman / Bobby Drake (46001a/b), docs/phase7-wave8.md §7.2, §3.61, §3.39. His real starter deck (`iceman-aggression`)
 * against Rhino. Hero face: THW 1, ATK 2, DEF 2, hand size 5, 11 hit points; alter-ego face: REC 4, hand size 6.
 * Frostbite's own text (46002) is the supports module's, so this file reads where a copy is, never what it does to the
 * enemy. The moment "freeze" is answered by a fixture support (99001) whose Forced Response draws 1 card.
 */
const FREEZE = "46001a.freeze";
const CONSTANT = "46001b.bobby-drake-constant";
const COOL_OFF = "46001b.cool-off";
const FROSTBITE = "46002";
const ANSWER = "99001.freeze-answer";
const LISTENER = "99001";

const ICEMAN = WAVE8_STARTER_DECKS.find((d) => d.id === "iceman-aggression")!;
const ICEMAN_SEAT = {
  identityCardId: ICEMAN.identityCardId,
  aspects: ICEMAN.aspects,
  deck: ICEMAN.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
};
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" };
type Seat = typeof ICEMAN_SEAT | typeof SPIDER_MAN;

const auntMay = CORE_CARDS.find((c) => c.id === cardId("01006"));
if (auntMay?.type !== "support") throw new Error("no Aunt May");
/** A cost 0 support borrowed from Aunt May's record, with one fixture ability: "Forced Response: after you resolve "Freeze!", draw 1 card." */
const LISTENER_CARD: AnyCard = {
  ...auntMay,
  id: cardId(LISTENER),
  name: "Freeze Listener",
  cost: 0,
  unique: false,
  aspect: "basic",
  abilities: [{ id: abilityId(ANSWER) }],
} as AnyCard;
const FIXTURE = defineAbilities({ [ANSWER]: forcedResponse(on.moment(FREEZE_MOMENT), draw(1)) });
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, ICEMAN_IDENTITY, FIXTURE) };

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const codes = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((id) => codeOf(s, id));
const count = (list: readonly string[], code: string): number => list.filter((c) => c === code).length;
const setAsideCodes = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).setAside);
const frostbiteSetAside = (s: GameState, p: PlayerId = P1): number => count(setAsideCodes(s, p), FROSTBITE);
const frostbiteOn = (s: GameState, host: InstanceId): number =>
  instancesOf(s, FROSTBITE).filter((id) => inst(s, id).attachedTo === host).length;
const frostbiteElsewhere = (s: GameState): number =>
  instancesOf(s, FROSTBITE).filter((id) => {
    const p = playerOf(s, P1);
    return [...p.deck, ...p.hand, ...p.discard].includes(id);
  }).length;
const moments = (events: readonly GameEvent[]) => events.filter((e) => e.type === "momentRaised");

function setupGame(
  seats: readonly Seat[] = [ICEMAN_SEAT],
  opts: { seed?: number; listener?: boolean } = {},
): GameState {
  const seed = opts.seed ?? 1;
  const config = coreScenario("rhino", {
    players: [SPIDER_MAN],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...WAVE8_CARDS, LISTENER_CARD],
  } as never);
  const created = createGame(
    {
      ...config,
      players: seats.map((seat) =>
        "starterDeckId" in seat
          ? { ...coreScenario("rhino", { players: [seat], seed, modularSetIds: [] }).players[0]! }
          : {
              identityCardId: seat.identityCardId,
              aspects: seat.aspects,
              // The fixture replaces the last card so the deck stays at its 40.
              deck: opts.listener ? [...seat.deck.slice(0, -1), cardId(LISTENER)] : seat.deck,
            },
      ),
    },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
const bobbyGame = (seats?: readonly Seat[], opts?: { seed?: number; listener?: boolean }): GameState =>
  setupGame(seats, opts);
const heroGame = (seats?: readonly Seat[], opts?: { seed?: number; listener?: boolean }): GameState =>
  withForm(setupGame(seats, opts), { heroForm: 0 });
/** Hero form with the answering fixture support in play. */
function listenerGame(): GameState {
  const base = heroGame(undefined, { listener: true });
  const { state, ids } = moveToHand(base, P1, LISTENER);
  const played = settle(runWith(DEPS, state, play(P1, ids[0]!)), firstLegal, undefined, DEPS);
  expect(playerOf(played, P1).playArea).toContain(ids[0]);
  return played;
}

/** Takes "Freeze!" whenever it is offered, defends with the Iceman identity, and otherwise declines like `firstLegal`. */
const takeFreeze: Picker = (s) => {
  const choice = s.pendingChoice!;
  if (choice.prompt.kind === "chooseTriggers") {
    const freeze = choice.options.find((o) => o.optionId.endsWith(FREEZE));
    return freeze ? [freeze.optionId] : firstLegal(s);
  }
  if (choice.prompt.kind === "declareDefender") return [identityOf(s)];
  if (choice.prompt.kind === "chooseTarget") return [choice.options[0]!.optionId];
  return firstLegal(s);
};
/** Declines "Freeze!" but defends. */
const declineFreeze: Picker = (s) =>
  s.pendingChoice?.prompt.kind === "declareDefender" ? [identityOf(s)] : firstLegal(s);
const offered = (s: GameState): boolean =>
  s.pendingChoice?.prompt.kind === "chooseTriggers" && s.pendingChoice.options.some((o) => o.optionId.endsWith(FREEZE));

const attack = (s: GameState, target: InstanceId, attacker = identityOf(s), player: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;

/** A Sandman relabeled from an encounter card and engaged with P1 (no printed text of his is under test). */
function withMinion(s: GameState): { readonly state: GameState; readonly id: InstanceId } {
  const sandman = s.cardPool[cardId("01102")];
  if (sandman?.type !== "minion") throw new Error("no Sandman in the pool");
  const deckId = activeEncounterDeckId(s);
  const pile = s.encounterDecks[deckId]!;
  const spare = pile.deck[0]!;
  const relabeled: GameState = {
    ...patchInstance(s, spare, { cardId: sandman.id, faceup: true, engagedWith: P1, damage: 0 }),
    encounterDecks: {
      ...s.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => i !== spare), discard: pile.discard },
    },
    players: s.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, spare] } : p)),
  };
  return { state: relabeled, id: spare };
}
/** One real "Freeze!" on the villain: take it, then ready Iceman and clear the damage so the next attack can follow. */
function freezeVillain(s: GameState, times: number): GameState {
  let current = s;
  for (let i = 0; i < times; i++) {
    const { state } = driveEventsPicking(DEPS, current, takeFreeze, attack(current, villainOf(current)));
    current = patchInstance(patchInstance(state, identityOf(state), { exhausted: false }), villainOf(state), {
      damage: 0,
    });
  }
  return current;
}

describe("Iceman identity registry", () => {
  it.each([FREEZE, CONSTANT, COOL_OFF])("%s validates", (id) => {
    expect(validateDefinition(ICEMAN_IDENTITY[id]!)).toEqual([]);
  });
  it("holds exactly the three identity refs; the setup line has no effect of its own", () => {
    expect(Object.keys(ICEMAN_IDENTITY).sort()).toEqual([FREEZE, CONSTANT, COOL_OFF].sort());
    expect(ICEMAN_IDENTITY[CONSTANT]!.effects).toEqual([]);
  });
  it("Freeze! is an optional interrupt and Cool Off an optional response (a moment has no interrupt window)", () => {
    expect(ICEMAN_IDENTITY[FREEZE]!.trigger).toMatchObject({ kind: "interrupt", forced: false });
    expect(ICEMAN_IDENTITY[COOL_OFF]!.trigger).toMatchObject({ kind: "response", forced: false });
  });
});

describe("setup: six Frostbite set aside", () => {
  it("40 cards split between a 34-card deck and a hand of 6; six Frostbite set aside, none anywhere else", () => {
    const s = bobbyGame();
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    expect(playerOf(s, P1).deck).toHaveLength(34);
    expect(playerOf(s, P1).hand).toHaveLength(6);
    expect(playerOf(s, P1).discard).toHaveLength(0);
    expect(frostbiteSetAside(s)).toBe(6);
    expect(instancesOf(s, FROSTBITE)).toHaveLength(6);
    expect(frostbiteElsewhere(s)).toBe(0);
    expect(playerOf(s, P1).playArea.map((id) => codeOf(s, id))).not.toContain(FROSTBITE);
  });
  it("is the same under other seeds: the supply never reaches a hand or deck, and a mulligan-free start keeps hand 6", () => {
    for (const seed of [2, 7, 99]) {
      const s = bobbyGame(undefined, { seed });
      expect(frostbiteSetAside(s)).toBe(6);
      expect(frostbiteElsewhere(s)).toBe(0);
      expect(playerOf(s, P1).hand).toHaveLength(6);
    }
  });
  it("a second seat's Iceman-less deck has nothing set aside of his", () => {
    const s = bobbyGame([ICEMAN_SEAT, SPIDER_MAN]);
    expect(frostbiteSetAside(s, P1)).toBe(6);
    expect(frostbiteSetAside(s, P2)).toBe(0);
  });
});

describe("printed stats, read from the game", () => {
  it("Bobby Drake: hand size 6, 11 hit points, REC 4 (recovery from 6 damage leaves 2)", () => {
    const s = bobbyGame();
    expect(handSize(s, P1, DEPS)).toBe(6);
    expect(maxHitPoints(s, identityOf(s), DEPS)).toBe(11);
    const hurt = withDamage(s, identityOf(s), 6);
    const after = settle(runWith(DEPS, hurt, { type: "basicRecover", playerId: P1 }), firstLegal, undefined, DEPS);
    expect(inst(after, identityOf(after)).damage).toBe(2);
  });
  it("Iceman: hand size 5, 11 hit points; ATK 2 (a basic attack with Freeze! declined deals 2)", () => {
    const s = heroGame();
    expect(playerOf(s, P1).identity.form).toBe("hero");
    expect(handSize(s, P1, DEPS)).toBe(5);
    expect(maxHitPoints(s, identityOf(s), DEPS)).toBe(11);
    const { state } = driveEventsPicking(DEPS, s, declineFreeze, attack(s, villainOf(s)));
    expect(inst(state, villainOf(s)).damage).toBe(2);
    expect(frostbiteSetAside(state)).toBe(6);
  });
  it("Iceman THW 1: a basic thwart removes 1 threat from a main scheme of 5", () => {
    const s = patchInstance(heroGame(), heroGame().mainScheme.instanceId, { threat: 5 });
    const { state } = driveEventsPicking(DEPS, s, declineFreeze, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(s),
      schemeInstanceId: s.mainScheme.instanceId,
    });
    expect(inst(state, state.mainScheme.instanceId).threat).toBe(4);
    expect(frostbiteSetAside(state)).toBe(6);
  });
  it("Iceman DEF 2: Rhino (ATK 2) with a 2-icon boost card is 4, less DEF 2 is 2 damage, with Freeze! declined", () => {
    const base = stackEncounterDeck(heroGame(), "01107", "01108");
    const { state } = driveEventsPicking(DEPS, base, declineFreeze, endTurn());
    expect(inst(state, identityOf(state)).damage).toBe(2);
  });
});

describe('Iceman (46001a): "Freeze!" on a basic attack', () => {
  it("attaches exactly one Frostbite to the villain, leaves five set aside, and then the attack deals its 2", () => {
    const s = heroGame();
    const { state, events } = driveEventsPicking(DEPS, s, takeFreeze, attack(s, villainOf(s)));
    expect(frostbiteOn(state, villainOf(s))).toBe(1);
    expect(frostbiteSetAside(state)).toBe(5);
    expect(frostbiteElsewhere(state)).toBe(0);
    expect(inst(state, villainOf(s)).damage).toBe(2);
    expect(moments(events)).toHaveLength(1);
  });
  it("is offered as an optional interrupt before the attack, and declining attaches nothing", () => {
    const s = heroGame();
    const first = applyCommand(s, attack(s, villainOf(s)), DEPS);
    if (!first.ok) throw new Error(first.error.message);
    expect(offered(first.state)).toBe(true);
    expect(inst(first.state, villainOf(s)).damage).toBe(0);
    const { state, events } = driveEventsPicking(DEPS, s, declineFreeze, attack(s, villainOf(s)));
    expect(frostbiteOn(state, villainOf(s))).toBe(0);
    expect(frostbiteSetAside(state)).toBe(6);
    expect(moments(events)).toHaveLength(0);
  });
  it("against an engaged minion it attaches to that minion and not to the villain", () => {
    const { state: s, id: minion } = withMinion(heroGame());
    const { state } = driveEventsPicking(DEPS, s, takeFreeze, attack(s, minion));
    expect(frostbiteOn(state, minion)).toBe(1);
    expect(frostbiteOn(state, villainOf(state))).toBe(0);
    expect(frostbiteSetAside(state)).toBe(5);
  });
  it("an attack by an ally does not attach one and is not offered Freeze!", () => {
    const s = heroGame();
    const ally = playerOf(s, P1).deck[0]!;
    const staged: GameState = {
      ...patchInstance(s, ally, { cardId: cardId("01002"), faceup: true, exhausted: false }),
      players: s.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== ally), playArea: [...p.playArea, ally] } : p,
      ),
    };
    const first = applyCommand(staged, attack(staged, villainOf(s), ally), DEPS);
    if (!first.ok) throw new Error(first.error.message);
    expect(offered(first.state)).toBe(false);
    const { state, events } = driveEventsPicking(DEPS, staged, takeFreeze, attack(staged, villainOf(s), ally));
    expect(frostbiteOn(state, villainOf(s))).toBe(0);
    expect(frostbiteSetAside(state)).toBe(6);
    expect(moments(events)).toHaveLength(0);
  });
  it("an attack event does not attach one (Haymaker, 3 damage) and is not offered Freeze!", () => {
    const s = heroGame();
    const card = playerOf(s, P1).hand[0]!;
    const pay = payWith(s, P1, 2, [card]);
    const staged = patchInstance(s, card, { cardId: cardId("01087") });
    const { state, events } = driveEventsPicking(DEPS, staged, takeFreeze, play(P1, card, pay));
    expect(inst(state, villainOf(s)).damage).toBe(3);
    expect(frostbiteOn(state, villainOf(s))).toBe(0);
    expect(frostbiteSetAside(state)).toBe(6);
    expect(moments(events)).toHaveLength(0);
  });
  it("with all six copies attached nothing more is attached, no moment is raised, and the attack still deals 2", () => {
    const s = freezeVillain(heroGame(), 6);
    expect(frostbiteOn(s, villainOf(s))).toBe(6);
    expect(frostbiteSetAside(s)).toBe(0);
    const { state, events } = driveEventsPicking(DEPS, s, takeFreeze, attack(s, villainOf(s)));
    expect(frostbiteOn(state, villainOf(s))).toBe(6);
    expect(frostbiteSetAside(state)).toBe(0);
    expect(moments(events)).toHaveLength(0);
    expect(inst(state, villainOf(s)).damage).toBe(2);
  });
  it("two attacks in a turn (readied between) attach two copies: four set aside", () => {
    const s = freezeVillain(heroGame(), 2);
    expect(frostbiteOn(s, villainOf(s))).toBe(2);
    expect(frostbiteSetAside(s)).toBe(4);
  });
  it("is absent in alter-ego form: no basic attack, and a basic recovery offers nothing", () => {
    const s = bobbyGame();
    expect(applyCommand(s, attack(s, villainOf(s)), DEPS).ok).toBe(false);
    const hurt = withDamage(s, identityOf(s), 3);
    const first = applyCommand(hurt, { type: "basicRecover", playerId: P1 }, DEPS);
    if (!first.ok) throw new Error(first.error.message);
    expect(offered(first.state)).toBe(false);
    expect(frostbiteSetAside(first.state)).toBe(6);
  });
});

describe('Iceman (46001a): "Freeze!" on a basic defense', () => {
  const defended = () => {
    const base = stackEncounterDeck(heroGame(), "01107", "01108");
    return driveEventsPicking(DEPS, base, takeFreeze, endTurn());
  };
  it("attaches one Frostbite to the attacking enemy (Rhino) and leaves five set aside", () => {
    const { state, events } = defended();
    expect(frostbiteOn(state, villainOf(state))).toBe(1);
    expect(frostbiteSetAside(state)).toBe(5);
    expect(moments(events)).toHaveLength(1);
  });
  it("is offered at the defense, before the damage is read", () => {
    const base = stackEncounterDeck(heroGame(), "01107", "01108");
    let current = applyCommand(base, endTurn(), DEPS);
    if (!current.ok) throw new Error(current.error.message);
    let state = current.state;
    for (let guard = 0; guard < 40 && !offered(state); guard++) {
      if (!state.pendingChoice) throw new Error("no prompt before the defense");
      const next = applyCommand(
        state,
        {
          type: "resolveChoice",
          playerId: state.pendingChoice.playerId,
          choiceId: state.pendingChoice.choiceId,
          selectedOptionIds: declineFreeze(state),
        },
        DEPS,
      );
      if (!next.ok) throw new Error(next.error.message);
      state = next.state;
    }
    expect(offered(state)).toBe(true);
    expect(inst(state, identityOf(state)).damage).toBe(0);
  });
  it("declining attaches nothing", () => {
    const base = stackEncounterDeck(heroGame(), "01107", "01108");
    const { state, events } = driveEventsPicking(DEPS, base, declineFreeze, endTurn());
    expect(frostbiteOn(state, villainOf(state))).toBe(0);
    expect(frostbiteSetAside(state)).toBe(6);
    expect(moments(events)).toHaveLength(0);
  });
  it("with no copy set aside the defense still resolves and nothing is raised", () => {
    const attached = freezeVillain(heroGame(), 6);
    const base = stackEncounterDeck(attached, "01107", "01108");
    const { state, events } = driveEventsPicking(DEPS, base, takeFreeze, endTurn());
    expect(frostbiteSetAside(state)).toBe(0);
    expect(moments(events)).toHaveLength(0);
    expect(inst(state, identityOf(state)).damage).toBe(2);
  });
});

describe("the moment", () => {
  it('is named "freeze", raised once per attach for the Iceman player, and the fixture response answers it', () => {
    expect(FREEZE_MOMENT).toBe("freeze");
    const s = listenerGame();
    const handBefore = playerOf(s, P1).hand.length;
    const { state, events } = driveEventsPicking(DEPS, s, takeFreeze, attack(s, villainOf(s)));
    expect(moments(events)).toEqual([
      expect.objectContaining({ type: "momentRaised", name: "freeze", playerId: P1, sourceInstanceId: identityOf(s) }),
    ]);
    expect(frostbiteOn(state, villainOf(state))).toBe(1);
    expect(playerOf(state, P1).hand).toHaveLength(handBefore + 1);
  });
  it("is raised after the copy is attached: the answer sees it, and declining raises and answers nothing", () => {
    const s = listenerGame();
    const handBefore = playerOf(s, P1).hand.length;
    const { state, events } = driveEventsPicking(DEPS, s, declineFreeze, attack(s, villainOf(s)));
    expect(moments(events)).toHaveLength(0);
    expect(playerOf(state, P1).hand).toHaveLength(handBefore);
  });
  it("two attacks raise it twice and the fixture draws twice", () => {
    const s = listenerGame();
    const handBefore = playerOf(s, P1).hand.length;
    const state = freezeVillain(s, 2);
    expect(playerOf(state, P1).hand).toHaveLength(handBefore + 2);
  });
  it("a basic defense raises it as well", () => {
    const s = listenerGame();
    const handBefore = playerOf(s, P1).hand.length;
    const base = stackEncounterDeck(s, "01107", "01108");
    const { state, events } = driveEventsPicking(DEPS, base, takeFreeze, endTurn());
    expect(moments(events)).toHaveLength(1);
    expect(frostbiteOn(state, villainOf(state))).toBe(1);
    expect(playerOf(state, P1).hand.length).toBeGreaterThanOrEqual(handBefore);
  });
  it("with no copy set aside it is not raised and the fixture draws nothing", () => {
    const s = freezeVillain(listenerGame(), 6);
    const handBefore = playerOf(s, P1).hand.length;
    const { state, events } = driveEventsPicking(DEPS, s, takeFreeze, attack(s, villainOf(s)));
    expect(moments(events)).toHaveLength(0);
    expect(playerOf(state, P1).hand).toHaveLength(handBefore);
  });
});

describe("a second player's seat", () => {
  it("Spider-Man's basic attack is untouched: no Freeze! offer, no Frostbite attached, the supply stays six", () => {
    // Iceman's turn ends first, so it is Spider-Man's turn.
    const turn = driveEventsPicking(DEPS, bobbyGame([ICEMAN_SEAT, SPIDER_MAN]), declineFreeze, endTurn(P1)).state;
    const s = withForm(turn, { heroForm: 0 }, P2);
    const first = applyCommand(s, attack(s, villainOf(s), identityOf(s, P2), P2), DEPS);
    if (!first.ok) throw new Error(first.error.message);
    expect(offered(first.state)).toBe(false);
    const { state, events } = driveEventsPicking(DEPS, s, takeFreeze, attack(s, villainOf(s), identityOf(s, P2), P2));
    expect(frostbiteOn(state, villainOf(s))).toBe(0);
    expect(frostbiteSetAside(state, P1)).toBe(6);
    expect(frostbiteSetAside(state, P2)).toBe(0);
    expect(moments(events)).toHaveLength(0);
    expect(inst(state, villainOf(s)).damage).toBeGreaterThan(0);
  });
  it("Iceman beside Spider-Man still takes his own copy from his own supply", () => {
    const s = withForm(bobbyGame([ICEMAN_SEAT, SPIDER_MAN]), { heroForm: 0 }, P1);
    const { state } = driveEventsPicking(DEPS, s, takeFreeze, attack(s, villainOf(s)));
    expect(frostbiteOn(state, villainOf(s))).toBe(1);
    expect(frostbiteSetAside(state, P1)).toBe(5);
    expect(frostbiteSetAside(state, P2)).toBe(0);
  });
});

describe("Bobby Drake (46001b): Cool Off", () => {
  const ICE_IN_DISCARD = ["46009", "46011", "46010"];
  /** Iceman with `n` copies attached, three ICE cards and Shadowcat (not ICE) in his discard pile, still in hero form. */
  function staged(n: number, ice: readonly string[] = ICE_IN_DISCARD): GameState {
    let s = freezeVillain(heroGame(), n);
    for (const code of [...ice, "46019"]) s = moveToDiscard(s, P1, code).state;
    return s;
  }
  const take: Picker = (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "chooseTriggers")
      return choice.options.filter((o) => o.optionId.endsWith(COOL_OFF)).map((o) => o.optionId);
    return choice.options.slice(0, choice.minSelections).map((o) => o.optionId);
  };
  const change: Command = { type: "changeForm", playerId: P1 };
  const iceCards = (s: GameState, ids: readonly InstanceId[]): number =>
    codes(s, ids).filter((c) => ICE_IN_DISCARD.includes(c)).length;

  it.each([
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
  ])(
    "with %i Frostbite in play, %i ICE cards go from the discard pile into the deck; the non-ICE card stays",
    (frost, moved) => {
      const s = staged(frost);
      expect(frostbiteOn(s, villainOf(s))).toBe(frost);
      const deckBefore = playerOf(s, P1).deck.length;
      expect(iceCards(s, playerOf(s, P1).discard)).toBe(3);
      const { state } = driveEventsPicking(DEPS, s, take, change);
      expect(playerOf(state, P1).identity.form).toBe("alterEgo");
      expect(iceCards(state, playerOf(state, P1).discard)).toBe(3 - moved);
      expect(playerOf(state, P1).deck).toHaveLength(deckBefore + moved);
      expect(codes(state, playerOf(state, P1).discard)).toContain("46019");
      expect(frostbiteOn(state, villainOf(state))).toBe(frost);
    },
  );
  it("with more copies in play than ICE cards in the discard pile it moves what there is", () => {
    const s = staged(3, ["46009"]);
    const deckBefore = playerOf(s, P1).deck.length;
    const { state } = driveEventsPicking(DEPS, s, take, change);
    expect(playerOf(state, P1).deck).toHaveLength(deckBefore + 1);
    expect(codes(state, playerOf(state, P1).discard)).toEqual(["46019"]);
  });
  it("is a response Iceman may decline", () => {
    const s = staged(2);
    const deckBefore = playerOf(s, P1).deck.length;
    const { state } = driveEventsPicking(DEPS, s, firstLegal, change);
    expect(playerOf(state, P1).deck).toHaveLength(deckBefore);
    expect(iceCards(state, playerOf(state, P1).discard)).toBe(3);
  });
  it("is offered only on the alter-ego face: changing to hero form hears nothing", () => {
    let s = bobbyGame();
    for (const code of ["46009", "46011"]) s = moveToDiscard(s, P1, code).state;
    const first = applyCommand(s, change, DEPS);
    if (!first.ok) throw new Error(first.error.message);
    expect(playerOf(first.state, P1).identity.form).toBe("hero");
    expect(first.state.pendingChoice).toBeNull();
  });
  it("has no use limit: a second change to Bobby Drake the same game answers again", () => {
    let s = staged(1);
    ({ state: s } = driveEventsPicking(DEPS, s, take, change));
    s = withForm(s, { heroForm: 0 });
    const deckBefore = playerOf(s, P1).deck.length;
    const { state } = driveEventsPicking(DEPS, s, take, change);
    expect(playerOf(state, P1).deck).toHaveLength(deckBefore + 1);
  });
});
