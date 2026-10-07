import {
  applyCommand,
  createGame,
  maxHitPoints,
  type AbilityDefinition,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  action,
  addCounters,
  discardTopOfDeckCost,
  forcedResponse,
  heroAction,
  placeThreat,
  query,
  takeDamage,
  theMainScheme,
  totalPrintedResources,
} from "../../../dsl/index.js";
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
  putOnTopOfDeck,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, stackSetAside, withForm } from "../../../testing/staging.js";
import { WAVE7_ABILITIES, WAVE7_DEPS, wave7Scenario } from "../../index.js";
import { DOMINO_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Domino's obligation and nemesis set (40065-40069), docs/phase7-wave7.md §7.1, §3.19, §3.61. Domino's real precon
 * against Juggernaut through `wave7Scenario` with the real registry. The nemesis cards sit in the set-aside area until
 * revealed; the obligation sits in the encounter deck. A reveal is staged with filler cards ahead of it for the
 * villain's boost cards (one per player: the villain activates once per player). Domino starts in alter-ego form.
 *
 * Domino's own kit (events, allies) is scripted by other modules and may not be in the registry yet, so the tests that
 * need "an ability on an identity-specific card" replace Diamondback's action and A Good Workout's in this file's deps.
 */
const MEMORIES = "40065";
const TOPAZ = "40066";
const LUCKY_DAY = "40067";
const PROTOTYPE = "40068";
const FEEDBACK = "40069";
const MEMORIES_ACTION = "40065.memories-of-armageddon-action";
const FEEDBACK_ACTION = "40069.superpower-feedback-action";
const DOMINO_ACTION = "40037a.domino-action";
const NEENA_ACTION = "40037b.neena-thurman-action";
const DOMINO = { starterDeckId: "domino-justice" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = typeof DOMINO | typeof SPIDER_MAN;
const WORKOUT = "40040"; // A Good Workout: wild, an identity-specific event
const WILD_2 = "40041";
const ENERGY = "40052";
const DIAMONDBACK = "40038"; // an identity-specific ally
const DIAMONDBACK_ACTION = "40038.diamondback-action";
const WORKOUT_ACTION = "40040.a-good-workout-action";
const ADVANCE = "01186";
const AUNT_MAY = "01006";
const ATLAS_BEAR = "40056"; // a basic ally: not identity-specific
const AUNT_MAY_ACTION = "01006.aunt-may-action";

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;

function baseGame(players: readonly Seat[] = [DOMINO], seed = 1): GameState {
  const config = wave7Scenario("juggernaut", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
}
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const isIn = (list: readonly InstanceId[], id: InstanceId): boolean => list.includes(id);
const encounterDiscard = (s: GameState): InstanceId[] => Object.values(s.encounterDecks).flatMap((d) => d.discard);
const damageOf = (s: GameState, p: PlayerId): number => inst(s, identityOf(s, p)).damage;
const cardCount = (events: readonly GameEvent[], type: GameEvent["type"]): number =>
  events.filter((e) => e.type === type).length;
const attacks = (events: readonly GameEvent[]) => events.filter((e) => e.type === "attackResolved");

/** Puts the encounter card `id` behind the `n` cards now on top of the active encounter deck. */
function behind(state: GameState, id: InstanceId, n: number): GameState {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  const rest = pile.deck.filter((x) => x !== id);
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { ...pile, deck: [...rest.slice(0, n), id, ...rest.slice(n)] },
    },
  };
}
/** Every player ends their turn, which ends the player phase and runs the villain phase. */
const endPhase = (state: GameState): Command[] => state.players.map((p) => endTurn(p.playerId));

type Revealed = { state: GameState; events: readonly GameEvent[]; id: InstanceId };
/**
 * Reveals set-aside nemesis `code` in the villain phase, with `fillers` cards ahead of it for the villain's boost cards
 * and the cards dealt to earlier players. `owner` is whose set-aside area the card is taken from.
 */
function reveal(
  state: GameState,
  code: string,
  pick: Picker = firstLegal,
  fillers = 1,
  owner: PlayerId = P1,
): Revealed {
  // The copy `stackSetAside` takes is the owner's first set-aside one, which is not always the lowest instance id.
  const id = playerOf(state, owner).setAside.find((i) => codeOf(state, i) === code)!;
  const set = stackSetAside(state, code, owner);
  const driven = driveEventsPicking(WAVE7_DEPS, behind(set, id, fillers), pick, ...endPhase(set));
  return { ...driven, id };
}
/** Reveals the obligation, which sits in the encounter deck: `fillers` cards ahead of it. */
function revealObligation(state: GameState, pick: Picker = firstLegal, fillers = state.players.length): Revealed {
  const id = instancesOf(state, MEMORIES)[0]!;
  const driven = driveEventsPicking(WAVE7_DEPS, behind(state, id, fillers), pick, ...endPhase(state));
  return { ...driven, id };
}

const run = (state: GameState, pick: Picker, command: Command, deps: EngineDeps = WAVE7_DEPS) =>
  driveEventsPicking(deps, state, pick, command);
const refused = (state: GameState, command: Command, deps: EngineDeps = WAVE7_DEPS): boolean =>
  !applyCommand(state, command, deps).ok;

/** The hand of `player` is exactly `codes`, the rest goes to the top of the deck. */
function givenHand(state: GameState, codes: readonly string[], player: PlayerId = P1): GameState {
  const cleared = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, deck: [...p.hand, ...p.deck], hand: [] as InstanceId[] } : p,
    ),
  };
  return codes.length > 0 ? moveToHand(cleared, player, ...codes).state : cleared;
}
/** A discard pile with `code` on top (surgery from the deck or hand). */
function putDiscard(state: GameState, code: string, player: PlayerId = P1): GameState {
  const owner = playerOf(state, player);
  const id = owner.deck.find((i) => codeOf(state, i) === code) ?? owner.hand.find((i) => codeOf(state, i) === code)!;
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player
        ? {
            ...p,
            deck: p.deck.filter((i) => i !== id),
            hand: p.hand.filter((i) => i !== id),
            discard: [id, ...p.discard],
          }
        : p,
    ),
  };
}

/** Answers each "choose one" with the option whose label starts with `by[player]`; anything else by default. */
const choosingOption =
  (by: Partial<Record<PlayerId, string>>): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseOption") {
      const want = by[choice.playerId];
      const hit = want ? choice.options.find((o) => o.label.startsWith(want)) : undefined;
      if (hit) return [hit.optionId];
    }
    return firstLegal(state);
  };

describe("Domino obligation and nemesis registry", () => {
  const REFS = [
    "40065.memories-of-armageddon-constant",
    MEMORIES_ACTION,
    "40066.when-revealed",
    "40067.when-revealed",
    "40068.prototype-constant",
    "40068.when-revealed",
    "40069.superpower-feedback-forced-response",
    FEEDBACK_ACTION,
  ];
  it.each(REFS)("%s validates", (id) => {
    expect(validateDefinition(DOMINO_OBLIGATION_NEMESIS[id]!)).toEqual([]);
  });
  it("holds exactly the eight refs of 40065-40069", () => {
    expect(Object.keys(DOMINO_OBLIGATION_NEMESIS).sort()).toEqual([...REFS].sort());
  });
});

describe("Memories of Armageddon (40065)", () => {
  /** A stand-in reader of the icon count: Diamondback's action discards the top card and counts its icons on a "meter". */
  const METER: AbilityDefinition = {
    ...action(addCounters("meter", totalPrintedResources({ kind: "slot", slot: "paid" }))),
    cost: discardTopOfDeckCost(1, "paid"),
  };
  const METER_DEPS: EngineDeps = { abilities: { ...WAVE7_ABILITIES, [DIAMONDBACK_ACTION]: METER } };

  it("is Domino's own obligation: dealt to the Neena Thurman player, it stays in her play area", () => {
    const base = baseGame();
    expect(instancesOf(base, MEMORIES)).toHaveLength(1);
    const { state, id } = revealObligation(base);
    expect(isIn(playerOf(state, P1).playArea, id)).toBe(true);
    expect(isIn(encounterDiscard(state), id)).toBe(false);
  });

  it("Neena's swap is blank: the alter-ego Action is refused while it is in play, and offered without it", () => {
    const hand = givenHand(baseGame(), [WORKOUT, WILD_2]);
    const control = putDiscard(hand, ENERGY);
    expect(refused(control, use(P1, identityOf(control), NEENA_ACTION))).toBe(false);
    const { state } = revealObligation(hand);
    const staged = putDiscard(state, ENERGY);
    expect(refused(staged, use(P1, identityOf(staged), NEENA_ACTION))).toBe(true);
  });

  it("Domino's swap is blank too: refused in hero form while it is in play, and offered without it", () => {
    const hand = givenHand(baseGame(), [WORKOUT, WILD_2]);
    const control = withForm(hand, { heroForm: 0 });
    expect(refused(control, use(P1, identityOf(control), DOMINO_ACTION))).toBe(false);
    const { state } = revealObligation(hand);
    const hero = withForm(state, { heroForm: 0 });
    expect(refused(hero, use(P1, identityOf(hero), DOMINO_ACTION))).toBe(true);
  });

  /** Diamondback in play, a wild card on top of the deck, hero form, Memories in play or not: the icons counted. */
  function wildCounted(withMemories: boolean): number {
    const given = moveToHand(baseGame(), P1, DIAMONDBACK);
    const [card] = given.ids as [InstanceId];
    const played = driveEventsPicking(
      METER_DEPS,
      given.state,
      firstLegal,
      play(P1, card, payWith(given.state, P1, 2, [card])),
    );
    const blanked = withMemories ? revealObligation(played.state).state : played.state;
    const stacked = putOnTopOfDeck(blanked, P1, WORKOUT).state;
    const hero = withForm(stacked, { heroForm: 0 });
    expect(codeOf(hero, playerOf(hero, P1).deck[0]!)).toBe(WORKOUT);
    const after = run(hero, firstLegal, use(P1, card, DIAMONDBACK_ACTION), METER_DEPS).state;
    return inst(after, card).counters.meter ?? 0;
  }
  it("a wild icon discarded from the deck counts 2 for Domino, and 1 while Memories is in play", () => {
    expect(wildCounted(false)).toBe(2);
    expect(wildCounted(true)).toBe(1);
  });

  it("Alter-Ego Action: exhausts Neena and discards Memories to the encounter discard pile; the swap works again", () => {
    const { state, id } = revealObligation(givenHand(baseGame(), [WORKOUT, WILD_2]));
    const identity = identityOf(state);
    expect(inst(state, identity).exhausted).toBe(false);
    const { state: after } = run(state, firstLegal, use(P1, id, MEMORIES_ACTION));
    expect(inst(after, identity).exhausted).toBe(true);
    expect(isIn(playerOf(after, P1).playArea, id)).toBe(false);
    expect(isIn(encounterDiscard(after), id)).toBe(true);
    // The identity is back to its printed text: Neena's swap is offered again (exhausting is not what blanks it).
    const staged = putDiscard(after, ENERGY);
    expect(refused(staged, use(P1, identityOf(staged), NEENA_ACTION))).toBe(false);
  });

  it("the Action is refused with the identity already exhausted, and in hero form", () => {
    const { state, id } = revealObligation(baseGame());
    const tired = patchInstance(state, identityOf(state), { exhausted: true });
    expect(refused(tired, use(P1, id, MEMORIES_ACTION))).toBe(true);
    const hero = withForm(state, { heroForm: 0 });
    expect(refused(hero, use(P1, id, MEMORIES_ACTION))).toBe(true);
    expect(refused(state, use(P1, id, MEMORIES_ACTION))).toBe(false);
  });

  it("two players: it is dealt to the Domino seat and blanks only that identity", () => {
    const { state, id } = revealObligation(baseGame([SPIDER_MAN, DOMINO]));
    expect(isIn(playerOf(state, P2).playArea, id)).toBe(true);
    expect(isIn(playerOf(state, P1).playArea, id)).toBe(false);
    const staged = putDiscard(givenHand(state, [WORKOUT, WILD_2], P2), ENERGY, P2);
    expect(refused(staged, use(P2, identityOf(staged, P2), NEENA_ACTION))).toBe(true);
    // The action belongs to the Domino seat; the other player's identity cannot use it, and is not exhausted by it.
    expect(refused(staged, use(P1, id, MEMORIES_ACTION))).toBe(true);
    const { state: after } = run(staged, firstLegal, use(P2, id, MEMORIES_ACTION));
    expect(inst(after, identityOf(after, P2)).exhausted).toBe(true);
    expect(inst(after, identityOf(after, P1)).exhausted).toBe(false);
  });
});

describe("Topaz (40066)", () => {
  type Where = "setAside" | "deck" | "discard" | "gone";
  /** Moves the copy of Superpower Feedback at `index` of the first player's set-aside area to `where`. */
  function feedbackAt(state: GameState, where: Where, index = 0): GameState {
    const owner = playerOf(state, P1);
    const copies = owner.setAside.filter((i) => codeOf(state, i) === FEEDBACK);
    const id = copies[index]!;
    if (where === "setAside") return state;
    const deckId = Object.keys(state.encounterDecks)[0]!;
    const pile = state.encounterDecks[deckId]!;
    const out = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p,
      ),
    };
    if (where === "gone") return out;
    return {
      ...out,
      encounterDecks: {
        ...out.encounterDecks,
        [deckId]:
          where === "deck" ? { ...pile, deck: [...pile.deck, id] } : { ...pile, discard: [...pile.discard, id] },
      },
    };
  }
  const attached = (s: GameState, host: InstanceId): InstanceId[] =>
    inst(s, host).attachments.filter((i) => codeOf(s, i) === FEEDBACK);
  const shuffles = (events: readonly GameEvent[]): number => cardCount(events, "deckShuffled");

  it("has two copies of Superpower Feedback in the set-aside area to search", () => {
    expect(playerOf(baseGame(), P1).setAside.filter((i) => codeOf(baseGame(), i) === FEEDBACK)).toHaveLength(2);
  });

  it("finds one copy in the set-aside area and attaches it to the revealing player's identity", () => {
    const { state, id } = reveal(baseGame(), TOPAZ);
    expect(inst(state, id).engagedWith).toBe(P1);
    expect(attached(state, identityOf(state))).toHaveLength(1);
    // The other copy stays set aside.
    expect(playerOf(state, P1).setAside.filter((i) => codeOf(state, i) === FEEDBACK)).toHaveLength(1);
  });

  it("finds a copy in the encounter deck (with the set-aside copies gone)", () => {
    let s = feedbackAt(baseGame(), "deck");
    s = feedbackAt(s, "gone");
    const copy = encounterDiscard(s).length; // untouched
    expect(copy).toBe(0);
    const { state } = reveal(s, TOPAZ);
    const host = attached(state, identityOf(state));
    expect(host).toHaveLength(1);
    expect(
      isIn(
        Object.values(state.encounterDecks).flatMap((d) => d.deck),
        host[0]!,
      ),
    ).toBe(false);
  });

  it("finds a copy in the encounter discard pile (with the set-aside copies gone)", () => {
    const s = feedbackAt(feedbackAt(baseGame(), "discard"), "gone");
    const { state } = reveal(s, TOPAZ);
    const host = attached(state, identityOf(state));
    expect(host).toHaveLength(1);
    expect(isIn(encounterDiscard(state), host[0]!)).toBe(false);
  });

  it("attaches only one copy when several can be found", () => {
    const s = feedbackAt(baseGame(), "deck"); // one copy in the deck, one set aside
    const { state } = reveal(s, TOPAZ);
    expect(attached(state, identityOf(state))).toHaveLength(1);
  });

  it("shuffles the encounter deck", () => {
    const base = baseGame();
    const { events } = reveal(base, TOPAZ);
    const without = driveEventsPicking(WAVE7_DEPS, base, firstLegal, ...endPhase(base));
    expect(shuffles(events)).toBe(shuffles(without.events) + 1);
  });

  it("with no copy anywhere nothing is attached (and the deck is still shuffled)", () => {
    const base = feedbackAt(feedbackAt(baseGame(), "gone"), "gone");
    const { state, events } = reveal(base, TOPAZ);
    expect(attached(state, identityOf(state))).toHaveLength(0);
    expect(shuffles(events)).toBeGreaterThanOrEqual(1);
  });

  it("two players: Topaz dealt to the second player attaches Feedback to that player's identity", () => {
    // Two boosts for the villain's activations, one filler dealt to the first player, then Topaz for the second.
    const { state } = reveal(baseGame([DOMINO, SPIDER_MAN]), TOPAZ, firstLegal, 3);
    expect(attached(state, identityOf(state, P2))).toHaveLength(1);
    expect(attached(state, identityOf(state, P1))).toHaveLength(0);
  });
});

describe("Not My Lucky Day (40067)", () => {
  const TAKE = "Take 1 damage";
  const PLACE = "Place 2 threat";
  const threat = (s: GameState, id: InstanceId): number => inst(s, id).threat;

  it("starts with 3 threat and no per player scaling", () => {
    const r = reveal(baseGame(), LUCKY_DAY, choosingOption({ [P1]: PLACE }));
    expect(threat(r.state, r.id)).toBe(5);
    const two = reveal(baseGame([DOMINO, SPIDER_MAN]), LUCKY_DAY, choosingOption({ [P1]: TAKE, [P2]: TAKE }), 2);
    expect(threat(two.state, two.id)).toBe(3);
  });

  it("option one: the player takes 1 damage and no threat is placed here", () => {
    const damaged = reveal(baseGame(), LUCKY_DAY, choosingOption({ [P1]: TAKE }));
    const placed = reveal(baseGame(), LUCKY_DAY, choosingOption({ [P1]: PLACE }));
    expect(damageOf(damaged.state, P1) - damageOf(placed.state, P1)).toBe(1);
    expect(threat(damaged.state, damaged.id)).toBe(3);
  });

  it("option two: 2 threat is placed here and no damage is taken", () => {
    const placed = reveal(baseGame(), LUCKY_DAY, choosingOption({ [P1]: PLACE }));
    expect(threat(placed.state, placed.id)).toBe(5);
    const taken = placed.events.filter((e) => e.type === "damageDealt" && e.sourceInstanceId === placed.id);
    expect(taken).toEqual([]);
  });

  it("two players: each player chooses for themselves (one takes damage, one places threat)", () => {
    const base = baseGame([DOMINO, SPIDER_MAN]);
    const mixed = reveal(base, LUCKY_DAY, choosingOption({ [P1]: TAKE, [P2]: PLACE }), 2);
    const bothThreat = reveal(base, LUCKY_DAY, choosingOption({ [P1]: PLACE, [P2]: PLACE }), 2);
    expect(threat(mixed.state, mixed.id)).toBe(5);
    expect(threat(bothThreat.state, bothThreat.id)).toBe(7);
    expect(damageOf(mixed.state, P1) - damageOf(bothThreat.state, P1)).toBe(1);
    expect(damageOf(mixed.state, P2)).toBe(damageOf(bothThreat.state, P2));
  });

  it("two players: both taking damage places no threat, and the same player is not asked twice", () => {
    const base = baseGame([DOMINO, SPIDER_MAN]);
    const asked: PlayerId[] = [];
    const pick: Picker = (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseOption") asked.push(s.pendingChoice.playerId);
      return choosingOption({ [P1]: TAKE, [P2]: TAKE })(s);
    };
    const both = reveal(base, LUCKY_DAY, pick, 2);
    expect(threat(both.state, both.id)).toBe(3);
    expect(asked.filter((p) => p === P1)).toHaveLength(1);
    expect(asked.filter((p) => p === P2)).toHaveLength(1);
    const bothPlace = reveal(base, LUCKY_DAY, choosingOption({ [P1]: PLACE, [P2]: PLACE }), 2);
    expect(damageOf(both.state, P1) - damageOf(bothPlace.state, P1)).toBe(1);
    expect(damageOf(both.state, P2) - damageOf(bothPlace.state, P2)).toBe(1);
  });
});

describe("Prototype (40068)", () => {
  const counters = (s: GameState, id: InstanceId): number => inst(s, id).counters.luck ?? 0;

  it.each([0, 2, 5])("with %i damage on the identity: that many luck counters are placed", (hurt) => {
    const base0 = baseGame();
    const base = patchInstance(base0, identityOf(base0), { damage: hurt });
    const { state, id } = reveal(base, PROTOTYPE);
    // In alter-ego form the villain schemes, so nothing adds damage before the reveal.
    expect(damageOf(state, P1)).toBe(hurt);
    expect(counters(state, id)).toBe(hurt);
    expect(maxHitPoints(state, id, WAVE7_DEPS)).toBe(1 + hurt);
  });

  it("each luck counter is +1 hit point on a printed 1: 2 damage gives 3 hit points", () => {
    const base0 = baseGame();
    const base = patchInstance(base0, identityOf(base0), { damage: 2 });
    const { state, id } = reveal(base, PROTOTYPE);
    expect(counters(state, id)).toBe(2);
    expect(maxHitPoints(state, id, WAVE7_DEPS)).toBe(3);
  });

  it("with no counters it has its printed 1 hit point", () => {
    const { state, id } = reveal(baseGame(), PROTOTYPE);
    expect(counters(state, id)).toBe(0);
    const cleared = patchInstance(state, id, { counters: {} });
    expect(maxHitPoints(cleared, id, WAVE7_DEPS)).toBe(1);
  });

  it("luck counters stay as placed: healing the identity afterwards does not shrink him", () => {
    const base0 = baseGame();
    const { state, id } = reveal(patchInstance(base0, identityOf(base0), { damage: 3 }), PROTOTYPE);
    const before = counters(state, id);
    expect(before).toBe(3);
    const healed = patchInstance(state, identityOf(state), { damage: 0 });
    expect(counters(healed, id)).toBe(before);
    expect(maxHitPoints(healed, id, WAVE7_DEPS)).toBe(1 + before);
  });

  it("two players: the revealing player's identity is counted, not the first player's", () => {
    const base0 = baseGame([DOMINO, SPIDER_MAN]);
    const base = patchInstance(patchInstance(base0, identityOf(base0, P1), { damage: 1 }), identityOf(base0, P2), {
      damage: 4,
    });
    const { state, id } = reveal(base, PROTOTYPE, firstLegal, 3);
    expect(inst(state, id).engagedWith).toBe(P2);
    expect(counters(state, id)).toBe(4);
    expect(damageOf(state, P1)).toBe(1);
  });
});

describe("Superpower Feedback (40069)", () => {
  /** Domino's identity, Superpower Feedback attached (revealed in the villain phase), then the form and hand wanted. */
  function withFeedback(players: readonly Seat[] = [DOMINO]) {
    const { state, id } = reveal(baseGame(players), FEEDBACK, firstLegal, players.length);
    return { state, id };
  }
  const STUBS: EngineDeps = {
    abilities: {
      ...WAVE7_ABILITIES,
      [DIAMONDBACK_ACTION]: action(addCounters("meter", 1)),
      [WORKOUT_ACTION]: heroAction(placeThreat(1, theMainScheme)),
    },
  };
  const damageAfter = (before: GameState, after: GameState, p = P1): number => damageOf(after, p) - damageOf(before, p);

  it("attaches to the identity of the player it is revealed to", () => {
    const { state, id } = withFeedback();
    expect(inst(state, id).attachedTo).toBe(identityOf(state));
  });

  it("Domino's own Action (hero form) costs 1 damage", () => {
    const { state } = withFeedback();
    const hero = withForm(givenHand(state, [WORKOUT, WILD_2]), { heroForm: 0 });
    const { state: after } = run(hero, firstLegal, use(P1, identityOf(hero), DOMINO_ACTION), STUBS);
    expect(damageAfter(hero, after)).toBe(1);
  });

  // `controller: "you"` inside a trigger pattern's `sourceIs` query on an attachment on a player's identity is the
  // host's player, as the pattern's `playerIs: "controller"` is. The script names the host (`hostOfSelf`), which reads
  // the same.
  it("`controller: you` in a trigger's `sourceIs` on an attachment matches its host's identity", () => {
    const viaYou: AbilityDefinition = forcedResponse(
      { on: "abilityResolved", playerIs: "controller", sourceIs: query("identity", { controller: "you" }) },
      takeDamage(1),
    );
    const deps: EngineDeps = {
      abilities: { ...WAVE7_ABILITIES, "40069.superpower-feedback-forced-response": viaYou },
    };
    const { state } = withFeedback();
    const hero = withForm(givenHand(state, [WORKOUT, WILD_2]), { heroForm: 0 });
    const { state: after } = run(hero, firstLegal, use(P1, identityOf(hero), DOMINO_ACTION), deps);
    expect(damageAfter(hero, after)).toBe(1);
  });

  it("Neena's own Action (alter-ego form) costs 1 damage", () => {
    const { state } = withFeedback();
    const staged = putDiscard(givenHand(state, [WORKOUT, WILD_2]), ENERGY);
    const { state: after } = run(staged, firstLegal, use(P1, identityOf(staged), NEENA_ACTION), STUBS);
    expect(damageAfter(staged, after)).toBe(1);
  });

  it("an ability on an identity-specific ally costs 1 damage (Diamondback)", () => {
    const { state } = withFeedback();
    const given = moveToHand(withForm(state, { heroForm: 0 }), P1, DIAMONDBACK);
    const [card] = given.ids as [InstanceId];
    const played = driveEventsPicking(
      STUBS,
      given.state,
      firstLegal,
      play(P1, card, payWith(given.state, P1, 2, [card])),
    );
    const { state: after } = run(played.state, firstLegal, use(P1, card, DIAMONDBACK_ACTION), STUBS);
    expect(damageAfter(played.state, after)).toBe(1);
    expect(inst(after, card).counters.meter).toBe(1);
  });

  it("an identity-specific event played costs 1 damage, the event still resolves", () => {
    const { state } = withFeedback();
    const given = moveToHand(withForm(state, { heroForm: 0 }), P1, WORKOUT);
    const [card] = given.ids as [InstanceId];
    const before = inst(given.state, given.state.mainScheme.instanceId).threat;
    const driven = driveEventsPicking(
      STUBS,
      given.state,
      firstLegal,
      play(P1, card, payWith(given.state, P1, 2, [card])),
    );
    expect(inst(driven.state, driven.state.mainScheme.instanceId).threat).toBe(before + 1);
    expect(damageAfter(given.state, driven.state)).toBe(1);
  });

  it("a basic attack is not an ability on the identity: no damage", () => {
    const { state } = withFeedback();
    const hero = withForm(state, { heroForm: 0 });
    const attack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(hero),
      targetInstanceId: villainOf(hero),
    };
    const { state: after } = run(hero, firstLegal, attack);
    expect(inst(after, villainOf(after)).damage).toBeGreaterThan(inst(hero, villainOf(hero)).damage - 1);
    expect(damageAfter(hero, after)).toBe(0);
  });

  it("the obligation's own Action does not count (not an identity or an identity-specific card)", () => {
    const obligation = revealObligation(baseGame());
    // Two boost cards ahead of it: the villain's activation in round 2 draws two (also with no Domino card in play).
    const { state, id: feedback } = reveal(obligation.state, FEEDBACK, firstLegal, 2);
    expect(inst(state, feedback).attachedTo).toBe(identityOf(state));
    const memories = obligation.id;
    expect(isIn(playerOf(state, P1).playArea, memories)).toBe(true);
    const { state: after } = run(state, firstLegal, use(P1, memories, MEMORIES_ACTION));
    expect(isIn(encounterDiscard(after), memories)).toBe(true);
    expect(damageAfter(state, after)).toBe(0);
  });

  it("Alter-Ego Action: discard 1 identity-specific card from your hand to discard this card, taking no damage", () => {
    const { state, id } = withFeedback();
    const staged = givenHand(state, [WORKOUT, WILD_2]);
    const card = playerOf(staged, P1).hand.find((i) => codeOf(staged, i) === WORKOUT)!;
    const pay = use(P1, id, FEEDBACK_ACTION, [], { discard: [card] });
    const { state: after } = run(staged, firstLegal, pay);
    expect(inst(after, id).attachedTo).toBeNull();
    expect(isIn(encounterDiscard(after), id)).toBe(true);
    expect(playerOf(after, P1).hand.map((i) => codeOf(after, i))).toEqual([WILD_2]);
    expect(isIn(playerOf(after, P1).discard, card)).toBe(true);
    expect(damageAfter(staged, after)).toBe(0);
    // With it gone, an identity ability costs nothing.
    const { state: later } = run(putDiscard(after, ENERGY), firstLegal, use(P1, identityOf(after), NEENA_ACTION));
    expect(damageAfter(after, later)).toBe(0);
  });

  it("Alter-Ego Action: refused with no identity-specific card in hand, and in hero form", () => {
    const { state, id } = withFeedback();
    const none = givenHand(state, [ATLAS_BEAR]);
    expect(refused(none, use(P1, id, FEEDBACK_ACTION))).toBe(true);
    const hero = withForm(givenHand(state, [WORKOUT]), { heroForm: 0 });
    expect(refused(hero, use(P1, id, FEEDBACK_ACTION))).toBe(true);
    const one = givenHand(state, [WORKOUT]);
    const card = playerOf(one, P1).hand[0]!;
    expect(refused(one, use(P1, id, FEEDBACK_ACTION, [], { discard: [card] }))).toBe(false);
  });

  it("two players: another player's ability (Aunt May) costs the host nothing, and the host's own still does", () => {
    const { state } = withFeedback([DOMINO, SPIDER_MAN]);
    // The first player token passed in the villain phase: the Spider-Man seat is up first.
    expect(state.step).toMatchObject({ phase: "player", activePlayerId: P2 });
    const given = moveToHand(state, P2, AUNT_MAY);
    const [may] = given.ids as [InstanceId];
    const inPlay = driveEventsPicking(
      WAVE7_DEPS,
      given.state,
      firstLegal,
      play(P2, may, payWith(given.state, P2, 2, [may])),
    );
    const hurt = patchInstance(inPlay.state, identityOf(inPlay.state, P2), { damage: 3 });
    const { state: used } = run(hurt, firstLegal, use(P2, may, AUNT_MAY_ACTION));
    expect(damageOf(used, P2)).toBe(0); // healed 4, and Feedback is not on this identity
    expect(damageAfter(hurt, used, P1)).toBe(0);
    const next = driveEventsPicking(WAVE7_DEPS, used, firstLegal, endTurn(P2)).state;
    const staged = putDiscard(givenHand(next, [WORKOUT, WILD_2]), ENERGY);
    const { state: own } = run(staged, firstLegal, use(P1, identityOf(staged), NEENA_ACTION));
    expect(damageAfter(staged, own, P1)).toBe(1);
    expect(damageAfter(staged, own, P2)).toBe(0);
  });
});

describe("Boost icons (printed)", () => {
  /** The boost icons the villain's attack counted when `id` was its boost card. */
  function boostOnVillain(code: string): number | undefined {
    const base = withForm(baseGame(), { heroForm: 0 });
    const staged = code === MEMORIES ? behind(base, instancesOf(base, MEMORIES)[0]!, 0) : stackSetAside(base, code);
    const driven = driveEventsPicking(WAVE7_DEPS, staged, firstLegal, ...endPhase(staged));
    const attack = attacks(driven.events)[0];
    return attack?.type === "attackResolved" ? attack.boostIcons : undefined;
  }
  it.each([
    [MEMORIES, 2],
    [TOPAZ, 3],
    [LUCKY_DAY, 2],
    [PROTOTYPE, 2],
    [FEEDBACK, 1],
  ])("%s as the villain's boost card adds its icons to Juggernaut's ATK", (code, icons) => {
    expect(boostOnVillain(code)).toBe(icons);
  });

  it("a minion without villainous draws no boost card: Prototype attacks for its printed ATK 2 and Topaz is revealed instead", () => {
    // Prototype is revealed in round 1; in round 2 the villain draws Advance and the next card is dealt, not boosted.
    const revealed = reveal(withForm(baseGame(), { heroForm: 0 }), PROTOTYPE).state;
    const hero = withForm(revealed, { heroForm: 0 });
    const staged = stackEncounterDeck(stackSetAside(hero, TOPAZ), ADVANCE);
    const driven = driveEventsPicking(WAVE7_DEPS, staged, firstLegal, ...endPhase(staged));
    const minionAttack = attacks(driven.events).find((e) => e.type === "attackResolved" && e.baseAtk === 2);
    expect(minionAttack).toMatchObject({ baseAtk: 2, boostIcons: 0, damageDealt: 2 });
    expect(cardCount(driven.events, "boostCardDealt")).toBe(1);
  });
});
