import { abilityId, AOA_CARDS, AOA_STARTER_DECKS, cardId, CORE_CARDS, type AnyCard, type CardId } from "@mc/content";
import {
  applyCommand,
  createGame,
  getInstance,
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
import {
  defineAbilities,
  forcedResponse,
  mergeRegistries,
  on,
  placeThreat,
  theMainScheme,
} from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withDamage, withForm } from "../../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { BISHOP_IDENTITY, ENERGY_ABSORPTION_MOMENT } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Bishop / Lucas Bishop (45001a/b), docs/phase7-wave8.md section 7.1, 3.52, 3.39. His real starter deck
 * (`bishop-leadership`) against Rhino (Core, standard) through the Core and Age of Apocalypse pools, with a registry
 * holding Bishop's identity and a fixture support that answers his moment. The rest of his kit (45002 to 45010) is
 * other modules', so this file reads where those cards are, never what they do. Rhino's ATK is 2, so damage comes from
 * an undefended attack (2 plus the boost icons) or one Bishop defends (DEF 1 less). Boost cards are Core cards that
 * carry only their icons (01104 none, 01188 one, 01100 two). The top of the deck is stacked by surgery.
 */
const ENERGY_ABSORPTION = "45001a.energy-absorption";
const TEMPORALLY_DISPLACED = "45001b.temporally-displaced";
const ANSWER = "99001.absorption-answer";
const LISTENER = "99001";

/** Resource cards of the deck: Energy, Genius, Strength (reprints), Stored Energy (TEMPORAL) and The Power of Leadership. */
const ENERGY = "45022";
const GENIUS = "45023";
const STRENGTH = "45024";
const STORED = "45010";
const POWER = "45019";
/** Cards of the deck that are not resource cards: an event (3 copies each), a support, an upgrade, an ally. */
const EVENT_A = "45016";
const EVENT_B = "45017";
const EVENT_C = "45018";
const SUPPORT = "45013";
const UPGRADE = "45014";
const MALCOLM = "45002";
const RANDALL = "45003";
const RIFLE = "45004";

const BOOST_0 = "01104";
const BOOST_1 = "01188";
const BOOST_2 = "01100";
const DEAL_A = "01098";
const DEAL_B = "01099";
const CONCUSSIVE_BLAST = "01154";

const BISHOP = AOA_STARTER_DECKS.find((d) => d.id === "bishop-leadership")!;
const BISHOP_SEAT = {
  identityCardId: BISHOP.identityCardId,
  aspects: BISHOP.aspects,
  deck: BISHOP.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
};
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = "bishop" | "spider";

const auntMay = CORE_CARDS.find((c) => c.id === cardId("01006"));
if (auntMay?.type !== "support") throw new Error("no Aunt May");
/** A cost 0 support borrowed from Aunt May's record with one fixture ability: Forced Response, after you resolve "Energy Absorption", place 1 threat on the main scheme. */
const LISTENER_CARD: AnyCard = {
  ...auntMay,
  id: cardId(LISTENER),
  name: "Absorption Listener",
  cost: 0,
  unique: false,
  aspect: "basic",
  abilities: [{ id: abilityId(ANSWER) }],
} as AnyCard;
const FIXTURE = defineAbilities({
  [ANSWER]: forcedResponse(on.moment(ENERGY_ABSORPTION_MOMENT), placeThreat(1, theMainScheme)),
});
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, BISHOP_IDENTITY, FIXTURE) };

const codeOf = (s: GameState, id: InstanceId): string => (getInstance(s, id)?.cardId as string | undefined) ?? "?";
const codes = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((id) => codeOf(s, id));
const deckOf = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).deck);
const handOf = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).hand);
/** The discard pile in the order cards were discarded (the engine keeps the newest first). */
const discardOf = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).discard).reverse();
const sorted = (list: readonly string[]): string[] => [...list].sort();
const moments = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "momentRaised" && e.name === ENERGY_ABSORPTION_MOMENT);
const damageOf = (s: GameState, p: PlayerId = P1): number => inst(s, identityOf(s, p)).damage;

/** The deck with its last Team Training replaced by the fixture, so it stays at 40 cards and keeps every resource card. */
function withListener(deck: readonly CardId[]): CardId[] {
  const at = deck.lastIndexOf(cardId(SUPPORT));
  return deck.map((c, i) => (i === at ? cardId(LISTENER) : c));
}

function setupGame(seats: readonly Seat[] = ["bishop"], opts: { listener?: boolean; extra?: readonly string[] } = {}) {
  const config = coreScenario("rhino", {
    players: [SPIDER_MAN],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS, LISTENER_CARD],
  } as never);
  const created = createGame(
    {
      ...config,
      encounterDeck: [...config.encounterDeck, ...(opts.extra ?? []).map(cardId)],
      players: seats.map((seat) =>
        seat === "spider"
          ? { ...coreScenario("rhino", { players: [SPIDER_MAN], seed: 1, modularSetIds: [] }).players[0]! }
          : {
              identityCardId: BISHOP_SEAT.identityCardId,
              aspects: BISHOP_SEAT.aspects,
              deck: opts.listener ? withListener(BISHOP_SEAT.deck) : BISHOP_SEAT.deck,
            },
      ),
    },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

/** Hand cut to `size`, the surplus on the bottom of the deck, so that ending a turn draws and discards nothing. */
function handTo(state: GameState, player: PlayerId, size: number): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, hand: p.hand.slice(0, size), deck: [...p.deck, ...p.hand.slice(size)] } : p,
    ),
  };
}

/**
 * Test surgery: puts these cards on top of `player`'s deck, in order. A copy is taken from the deck, the discard pile or
 * (last) the hand; a card taken from the hand is replaced by one from the bottom of the deck, so the hand keeps its size
 * and ending a turn draws nothing. The rest of the discard pile goes to the bottom of the deck, so the discard pile holds
 * afterward only what the test makes the player discard.
 */
function stackDeck(state: GameState, player: PlayerId, ...wanted: readonly string[]): GameState {
  const owner = playerOf(state, player);
  const used: InstanceId[] = [];
  for (const code of wanted) {
    const id = [...owner.deck, ...owner.discard, ...owner.hand].find(
      (c) => codeOf(state, c) === code && !used.includes(c),
    );
    if (!id) throw new Error(`${player} has no ${code}`);
    used.push(id);
  }
  const strip = (zone: readonly InstanceId[]) => zone.filter((id) => !used.includes(id));
  const takenFromHand = owner.hand.length - strip(owner.hand).length;
  const rest = [...strip(owner.deck), ...strip(owner.discard)];
  const refill = rest.slice(rest.length - takenFromHand);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player
        ? {
            ...p,
            deck: [...used, ...rest.slice(0, rest.length - takenFromHand)],
            discard: [],
            hand: [...strip(owner.hand), ...refill],
          }
        : p,
    ),
  };
}

/** Bishop's seat in hero form, hand of 5, the fixture support in play when asked for. */
function heroGame(opts: { listener?: boolean; seats?: readonly Seat[]; extra?: readonly string[] } = {}): GameState {
  const seats = opts.seats ?? ["bishop"];
  let s = setupGame(seats, opts);
  const bishopSeat = seats.indexOf("bishop") === 0 ? P1 : P2;
  for (const p of s.players) s = withForm(s, { heroForm: 0 }, p.playerId);
  for (const p of s.players) s = handTo(s, p.playerId, 5);
  if (opts.listener) {
    const { state, ids } = moveToHand(s, bishopSeat, LISTENER);
    s = settle(runWith(DEPS, state, play(bishopSeat, ids[0]!)), firstLegal, undefined, DEPS);
    expect(playerOf(s, bishopSeat).playArea).toContain(ids[0]);
    // If playing it left 4 cards in hand, one from the top of the deck, so that ending a turn draws nothing.
    s = {
      ...s,
      players: s.players.map((p) =>
        p.playerId === bishopSeat && p.hand.length < 5
          ? { ...p, hand: [...p.hand, p.deck[0]!], deck: p.deck.slice(1) }
          : p,
      ),
    };
  }
  return s;
}

/** Picks by prompt: Energy Absorption is taken when `accept`; the asked player's identity (or `defender`) defends when `defend`. */
const picker =
  (
    opts: {
      accept?: boolean;
      defend?: boolean;
      minionsOnly?: boolean;
      defender?: InstanceId;
      pick?: (s: GameState) => string[];
    } = {},
  ): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "chooseTriggers") {
      const own = opts.accept ? choice.options.find((o) => o.optionId.endsWith(ENERGY_ABSORPTION)) : undefined;
      return own ? [own.optionId] : [];
    }
    if (choice.prompt.kind === "declareDefender") {
      if (opts.defender) return [opts.defender];
      if (opts.minionsOnly && choice.prompt.attack.enemyInstanceId === s.activeVillainId) return ["decline"];
      return opts.defend ? [identityOf(s, choice.playerId)] : ["decline"];
    }
    return opts.pick ? opts.pick(s) : firstLegal(s);
  };

/**
 * The villain phase after every player ends their turn, in turn order. `boosts` are the boost cards of the villain's
 * activations (one each, in order), then `deals` the encounter cards each player is dealt.
 */
function round(
  state: GameState,
  opts: { boosts: readonly string[]; deals?: readonly string[]; pick?: Picker; ends?: readonly PlayerId[] },
) {
  const seats = state.players.map((p) => p.playerId);
  const deals = opts.deals ?? [DEAL_A, DEAL_B].slice(0, seats.length);
  const stacked = stackEncounterDeck(state, ...opts.boosts, ...deals);
  return driveEventsPicking(DEPS, stacked, opts.pick ?? picker(), ...(opts.ends ?? seats).map((p) => endTurn(p)));
}

/** One attack on a solo Bishop in hero form with `top` stacked on the deck. */
function absorb(
  top: readonly string[],
  opts: { boost: string; defend: boolean; accept?: boolean; listener?: boolean; before?: (s: GameState) => GameState },
) {
  let s = stackDeck(heroGame(opts.listener ? { listener: true } : {}), P1, ...top);
  s = opts.before ? opts.before(s) : s;
  const run = round(s, { boosts: [opts.boost], pick: picker({ accept: opts.accept ?? true, defend: opts.defend }) });
  return { before: s, ...run };
}

describe("Bishop identity registry", () => {
  it.each([ENERGY_ABSORPTION, TEMPORALLY_DISPLACED])("%s validates", (id) => {
    expect(validateDefinition(BISHOP_IDENTITY[id]!)).toEqual([]);
  });
  it("holds exactly the two refs, the ones the data names", () => {
    expect(Object.keys(BISHOP_IDENTITY).sort()).toEqual([ENERGY_ABSORPTION, TEMPORALLY_DISPLACED]);
    const card = AOA_CARDS.find((c) => c.id === cardId("45001a")) as never as {
      hero: { abilities: { id: string }[] };
      alterEgo: { abilities: { id: string }[] };
    };
    expect([...card.hero.abilities, ...card.alterEgo.abilities].map((a) => a.id)).toEqual([
      ENERGY_ABSORPTION,
      TEMPORALLY_DISPLACED,
    ]);
  });
  it("names its moment energyAbsorption", () => {
    expect(ENERGY_ABSORPTION_MOMENT).toBe("energyAbsorption");
  });
});

describe("printed stats, read from the game", () => {
  it("alter-ego form: hand size 6 (6 cards dealt), 12 hit points, REC 4 (recovery heals 4)", () => {
    const s = setupGame();
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    expect(playerOf(s, P1).hand).toHaveLength(6);
    expect(handSize(s, P1, DEPS)).toBe(6);
    expect(maxHitPoints(s, identityOf(s), DEPS)).toBe(12);
    const after = applyOk(withDamage(s, identityOf(s), 7), { type: "basicRecover", playerId: P1 }, DEPS).state;
    expect(damageOf(after)).toBe(3);
  });

  it("hero form: hand size 5, 12 hit points, ATK 2, THW 2 and DEF 1", () => {
    const s = heroGame();
    expect(playerOf(s, P1).identity.form).toBe("hero");
    expect(handSize(s, P1, DEPS)).toBe(5);
    expect(maxHitPoints(s, identityOf(s), DEPS)).toBe(12);
    const rhino = s.activeVillainId!;
    const hit = settle(
      applyOk(
        s,
        { type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(s), targetInstanceId: rhino },
        DEPS,
      ).state,
      firstLegal,
      undefined,
      DEPS,
    );
    expect(inst(hit, rhino).damage - inst(s, rhino).damage).toBe(2);
    const main = s.mainScheme.instanceId;
    const thwarted = settle(
      applyOk(
        patchInstance(s, main, { threat: 5 }),
        { type: "basicThwart", playerId: P1, thwarterInstanceId: identityOf(s), schemeInstanceId: main },
        DEPS,
      ).state,
      firstLegal,
      undefined,
      DEPS,
    );
    expect(inst(thwarted, main).threat).toBe(3);
    // DEF 1: defended, Rhino's ATK 2 and no boost icons deal 1.
    const defended = round(s, { boosts: [BOOST_0], pick: picker({ defend: true }) });
    expect(damageOf(defended.state)).toBe(1);
  });

  it("the printed faces carry the stats and the two ability ids", () => {
    const card = AOA_CARDS.find((c) => c.id === cardId("45001a")) as never as {
      hero: { def: number; thw: number; atk: number; handSize: number };
      alterEgo: { rec: number; handSize: number };
      hp: number;
    };
    expect([card.hero.thw, card.hero.atk, card.hero.def, card.hero.handSize, card.hp]).toEqual([2, 2, 1, 5, 12]);
    expect([card.alterEgo.rec, card.alterEgo.handSize]).toEqual([4, 6]);
  });
});

describe("Energy Absorption (45001a): damage taken from an attack", () => {
  it("1 damage (defended), no resource card among the 1 discarded: it goes to the discard pile, nothing to hand", () => {
    const { before, state, events } = absorb([SUPPORT, ENERGY], { boost: BOOST_0, defend: true });
    expect(damageOf(state)).toBe(1);
    expect(discardOf(state)).toEqual([SUPPORT]);
    expect(deckOf(state)).toEqual(deckOf(before).slice(1));
    expect(sorted(handOf(state))).toEqual(sorted(handOf(before)));
    expect(moments(events)).toHaveLength(1);
  });

  it("1 damage, the 1 discarded card is a resource card: it is in his hand and the discard pile is empty", () => {
    const { before, state } = absorb([STRENGTH, SUPPORT], { boost: BOOST_0, defend: true });
    expect(damageOf(state)).toBe(1);
    expect(discardOf(state)).toEqual([]);
    expect(sorted(handOf(state))).toEqual(sorted([...handOf(before), STRENGTH]));
    expect(deckOf(state)).toEqual(deckOf(before).slice(1));
  });

  it("2 damage (undefended), 1 resource card among the 2 discarded: it is in his hand, the other in the discard pile", () => {
    const { before, state, events } = absorb([SUPPORT, GENIUS, EVENT_A], { boost: BOOST_0, defend: false });
    expect(damageOf(state)).toBe(2);
    expect(discardOf(state)).toEqual([SUPPORT]);
    expect(sorted(handOf(state))).toEqual(sorted([...handOf(before), GENIUS]));
    expect(deckOf(state)).toEqual(deckOf(before).slice(2));
    expect(moments(events)).toHaveLength(1);
  });

  it("3 damage (defended, 2 boost icons), two resource cards among the 3 discarded: both in hand, the third discarded, one moment", () => {
    const { before, state, events } = absorb([ENERGY, EVENT_B, STORED, EVENT_C], {
      boost: BOOST_2,
      defend: true,
    });
    expect(damageOf(state)).toBe(3);
    expect(discardOf(state)).toEqual([EVENT_B]);
    expect(sorted(handOf(state))).toEqual(sorted([...handOf(before), ENERGY, STORED]));
    expect(deckOf(state)).toEqual(deckOf(before).slice(3));
    expect(moments(events)).toHaveLength(1);
  });

  it("3 damage (undefended, 1 boost icon), only resource cards: all three in hand, the discard pile empty", () => {
    const { before, state } = absorb([ENERGY, POWER, STRENGTH, SUPPORT], { boost: BOOST_1, defend: false });
    expect(damageOf(state)).toBe(3);
    expect(discardOf(state)).toEqual([]);
    expect(sorted(handOf(state))).toEqual(sorted([...handOf(before), ENERGY, POWER, STRENGTH]));
    expect(deckOf(state)).toEqual(deckOf(before).slice(3));
  });

  it("4 damage (undefended, 2 boost icons), no resource card: four in the discard pile in order, the hand untouched", () => {
    const { before, state } = absorb([SUPPORT, UPGRADE, EVENT_A, EVENT_B, ENERGY], { boost: BOOST_2, defend: false });
    expect(damageOf(state)).toBe(4);
    expect(discardOf(state)).toEqual([SUPPORT, UPGRADE, EVENT_A, EVENT_B]);
    expect(sorted(handOf(state))).toEqual(sorted(handOf(before)));
    expect(deckOf(state)[0]).toBe(ENERGY);
  });

  it("the number is what he took, not what the attack was: DEF 1 takes 1 of an attack of 2", () => {
    const { before, state } = absorb([EVENT_A, EVENT_B, EVENT_C], { boost: BOOST_0, defend: true });
    expect(damageOf(state)).toBe(1);
    expect(deckOf(state)).toEqual(deckOf(before).slice(1));
    expect(discardOf(state)).toEqual([EVENT_A]);
  });

  it("a tough status card absorbs the attack: 0 taken, the tough card discarded, nothing offered, nothing discarded", () => {
    const tough = (s: GameState) =>
      patchInstance(s, identityOf(s), { statuses: { ...inst(s, identityOf(s)).statuses, tough: 1 } });
    const { before, state, events } = absorb([ENERGY, STRENGTH, SUPPORT], {
      boost: BOOST_0,
      defend: false,
      before: tough,
    });
    expect(damageOf(state)).toBe(0);
    expect(inst(state, identityOf(state)).statuses.tough).toBe(0);
    expect(discardOf(state)).toEqual([]);
    expect(deckOf(state)).toEqual(deckOf(before));
    expect(sorted(handOf(state))).toEqual(sorted(handOf(before)));
    expect(moments(events)).toHaveLength(0);
  });

  it("an attack he defends down to 0 offers nothing (a minion of ATK 1 against DEF 1, after tough took Rhino's attack)", () => {
    let s = stackDeck(heroGame({ extra: ["01121"] }), P1, ENERGY, STRENGTH, SUPPORT);
    // Weapons Runner (ATK 1) engaged with him, by surgery on a spare encounter card.
    const deckId = Object.keys(s.encounterDecks)[0]!;
    const pile = s.encounterDecks[deckId]!;
    const runner = pile.deck.find((id) => codeOf(s, id) === "01121")!;
    s = {
      ...patchInstance(s, runner, { faceup: true, engagedWith: P1 }),
      encounterDecks: { ...s.encounterDecks, [deckId]: { ...pile, deck: pile.deck.filter((i) => i !== runner) } },
      players: s.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, runner] } : p)),
    };
    s = patchInstance(s, identityOf(s), { statuses: { ...inst(s, identityOf(s)).statuses, tough: 1 } });
    const before = s;
    const run = round(s, {
      boosts: [BOOST_0, "01105"],
      pick: picker({ accept: true, defend: true, minionsOnly: true }),
    });
    // Rhino's attack met the tough card, the minion's was defended: neither took damage.
    expect(damageOf(run.state)).toBe(0);
    expect(inst(run.state, identityOf(run.state)).statuses.tough).toBe(0);
    expect(discardOf(run.state)).toEqual([]);
    expect(deckOf(run.state)).toEqual(deckOf(before));
    expect(moments(run.events)).toHaveLength(0);
  });

  it("damage from a treachery (Concussive Blast: 1 to each friendly character) is not from an attack: nothing", () => {
    const s = stackDeck(heroGame({ extra: [CONCUSSIVE_BLAST] }), P1, ENERGY, STRENGTH, SUPPORT);
    const run = round(s, {
      boosts: [BOOST_0],
      deals: [CONCUSSIVE_BLAST],
      pick: picker({ accept: true, defend: true }),
    });
    // 1 from the defended attack (absorbed one card), then 1 from the treachery: only the attack is answered.
    expect(damageOf(run.state)).toBe(2);
    expect(moments(run.events)).toHaveLength(1);
    expect(discardOf(run.state)).toEqual([]);
    expect(handOf(run.state)).toContain(ENERGY);
    expect(deckOf(run.state)).toEqual(deckOf(s).slice(1));
  });

  it("the same treachery alone (his attack stopped by tough) deals 1 and discards nothing", () => {
    let s = stackDeck(heroGame({ extra: [CONCUSSIVE_BLAST] }), P1, ENERGY, STRENGTH, SUPPORT);
    s = patchInstance(s, identityOf(s), { statuses: { ...inst(s, identityOf(s)).statuses, tough: 1 } });
    const run = round(s, { boosts: [BOOST_0], deals: [CONCUSSIVE_BLAST], pick: picker({ accept: true }) });
    expect(damageOf(run.state)).toBe(1);
    expect(deckOf(run.state)).toEqual(deckOf(s));
    expect(discardOf(run.state)).toEqual([]);
    expect(moments(run.events)).toHaveLength(0);
  });

  it("damage to an ally he controls is not damage to him: Malcolm takes 2, Bishop's deck and discard pile are untouched", () => {
    const base = stackDeck(heroGame(), P1, MALCOLM, ENERGY, STRENGTH, SUPPORT);
    const ally = playerOf(base, P1).deck[0]!;
    const s: GameState = {
      ...base,
      players: base.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.slice(1), playArea: [...p.playArea, ally] } : p,
      ),
    };
    const run = round(s, { boosts: [BOOST_0], pick: picker({ accept: true, defender: ally }) });
    expect(inst(run.state, ally).damage).toBe(2);
    expect(damageOf(run.state)).toBe(0);
    expect(deckOf(run.state)).toEqual(deckOf(s));
    expect(discardOf(run.state)).toEqual([]);
    expect(moments(run.events)).toHaveLength(0);
  });

  it("it is optional: declined, he takes the damage and nothing is discarded, added or raised", () => {
    const { before, state, events } = absorb([ENERGY, STRENGTH, SUPPORT], {
      boost: BOOST_0,
      defend: false,
      accept: false,
    });
    expect(damageOf(state)).toBe(2);
    expect(deckOf(state)).toEqual(deckOf(before));
    expect(discardOf(state)).toEqual([]);
    expect(sorted(handOf(state))).toEqual(sorted(handOf(before)));
    expect(moments(events)).toHaveLength(0);
    // It was offered (a Response, not forced) and refused.
    const offers = events.flatMap((e) =>
      e.type === "choiceRequested" && e.choice.prompt.kind === "chooseTriggers" ? [e.choice] : [],
    );
    expect(offers).toHaveLength(1);
    expect(offers[0]!.options.map((o) => o.optionId.split(":")[1])).toEqual([ENERGY_ABSORPTION]);
    expect(offers[0]!.playerId).toBe(P1);
  });

  it("alter-ego form: the villain schemes instead of attacking, so there is nothing to answer, and the deck is untouched", () => {
    let s = stackDeck(setupGame(), P1, ENERGY, STRENGTH, SUPPORT);
    s = handTo(s, P1, 6);
    const run = round(s, { boosts: [BOOST_0], pick: picker({ accept: true }) });
    expect(playerOf(run.state, P1).identity.form).toBe("alterEgo");
    expect(damageOf(run.state)).toBe(0);
    expect(deckOf(run.state)).toEqual(deckOf(s));
    expect(moments(run.events)).toHaveLength(0);
  });

  it("alter-ego form: damage that is not from an attack (Concussive Blast) discards nothing", () => {
    let s = stackDeck(setupGame(seatsOf(), { extra: [CONCUSSIVE_BLAST] }), P1, ENERGY, STRENGTH, SUPPORT);
    s = handTo(s, P1, 6);
    const run = round(s, { boosts: [BOOST_0], deals: [CONCUSSIVE_BLAST], pick: picker({ accept: true }) });
    expect(damageOf(run.state)).toBe(1);
    expect(deckOf(run.state)).toEqual(deckOf(s));
    expect(moments(run.events)).toHaveLength(0);
  });
});

function seatsOf(): readonly Seat[] {
  return ["bishop"];
}

describe("Energy Absorption (45001a): a deck with fewer cards than the damage (RRG p. 33)", () => {
  /** A deck of exactly [Energy, Support] with a discard pile of five cards, among them Strength; the surplus is set aside. */
  function shortDeck(): GameState {
    const s = stackDeck(heroGame(), P1, ENERGY, SUPPORT, STRENGTH, EVENT_A, EVENT_B, UPGRADE, RIFLE);
    return {
      ...s,
      players: s.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              deck: p.deck.slice(0, 2),
              discard: p.discard.concat(p.deck.slice(2, 7)),
              setAside: [...p.setAside, ...p.deck.slice(7)],
            }
          : p,
      ),
    };
  }

  it("4 damage with 2 cards in the deck: both discarded, the deck resets, nothing more is discarded; Energy comes from the new deck", () => {
    const s = shortDeck();
    expect(deckOf(s)).toEqual([ENERGY, SUPPORT]);
    // The reset deals 1 facedown encounter card, taking the first stacked card; the villain phase's deal is the second.
    const run = round(s, { boosts: [BOOST_2], deals: [DEAL_A, DEAL_B], pick: picker({ accept: true }) });
    expect(damageOf(run.state)).toBe(4);
    // The reset shuffled the 5 old cards and the 2 discarded into a new deck of 7; Energy left it for his hand.
    expect(handOf(run.state)).toContain(ENERGY);
    expect(handOf(run.state).filter((c) => c === ENERGY)).toHaveLength(1);
    expect(sorted(deckOf(run.state))).toEqual(sorted([SUPPORT, STRENGTH, EVENT_A, EVENT_B, UPGRADE, RIFLE]));
    expect(discardOf(run.state)).toEqual([]);
    expect(moments(run.events)).toHaveLength(1);
  });
});

describe("the moment", () => {
  it("is named energyAbsorption, raised once for Bishop per use, and the fixture response answers it", () => {
    const accepted = absorb([ENERGY, SUPPORT], { boost: BOOST_0, defend: false, listener: true });
    expect(moments(accepted.events)).toEqual([
      expect.objectContaining({ type: "momentRaised", name: "energyAbsorption", playerId: P1 }),
    ]);
    const declined = absorb([ENERGY, SUPPORT], { boost: BOOST_0, defend: false, listener: true, accept: false });
    expect(mainThreat(accepted.state) - mainThreat(declined.state)).toBe(1);
  });

  it("is raised after the resource cards reached his hand, and once even with none among the discards", () => {
    const { state, events } = absorb([EVENT_A, EVENT_B], { boost: BOOST_0, defend: false, listener: true });
    expect(moments(events)).toHaveLength(1);
    expect(discardOf(state)).toEqual([EVENT_A, EVENT_B]);
    const withResources = absorb([ENERGY, STRENGTH], { boost: BOOST_0, defend: false, listener: true });
    expect(moments(withResources.events)).toHaveLength(1);
    const at = withResources.events.findIndex((e) => e.type === "momentRaised");
    const toHand = withResources.events.flatMap((e, i) => (e.type === "cardMoved" && e.to.kind === "hand" ? [i] : []));
    expect(toHand).toHaveLength(2);
    expect(toHand.every((i) => i < at)).toBe(true);
  });

  it("a second attack the next round raises it again, answered again (the moment is once per use, not once per game)", () => {
    const s = stackDeck(heroGame({ listener: true }), P1, ENERGY, SUPPORT, STRENGTH, EVENT_A);
    const first = round(s, { boosts: [BOOST_0], pick: picker({ accept: true }) });
    expect(moments(first.events)).toHaveLength(1);
    expect(damageOf(first.state)).toBe(2);
    expect(mainThreat(first.state)).toBeGreaterThan(0);
    const second = round(stackDeck(first.state, P1, ENERGY, STRENGTH, EVENT_A), {
      boosts: [BOOST_0],
      deals: [DEAL_B],
      pick: picker({ accept: true }),
    });
    expect(moments(second.events)).toHaveLength(1);
    expect(damageOf(second.state)).toBe(4);
  });
});

describe("Temporally Displaced (45001b): after he changes to this form, a TEMPORAL card of the discard pile to hand", () => {
  /** Hero form with these cards in the discard pile, a changeForm next. */
  function withDiscard(...wanted: readonly string[]): GameState {
    const s = heroGame();
    const owner = playerOf(s, P1);
    const used: InstanceId[] = [];
    for (const code of wanted) {
      used.push([...owner.deck, ...owner.hand].find((c) => codeOf(s, c) === code && !used.includes(c))!);
    }
    return {
      ...s,
      players: s.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              hand: p.hand.filter((i) => !used.includes(i)),
              deck: p.deck.filter((i) => !used.includes(i)),
              discard: [...p.discard, ...used],
            }
          : p,
      ),
    };
  }
  const toAlterEgo = (_s: GameState): Command => ({ type: "changeForm", playerId: P1 });
  /** Takes "Temporally Displaced", then the card named `code` when it is offered. */
  const takeTemporal =
    (code: string): Picker =>
    (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseTriggers") {
        return choice.options.filter((o) => o.optionId.endsWith(TEMPORALLY_DISPLACED)).map((o) => o.optionId);
      }
      const hit = choice.options.find((o) => o.ref?.kind === "card" && codeOf(s, o.ref.instanceId) === code);
      return hit ? [hit.optionId] : firstLegal(s);
    };
  const acceptTemporally: Picker = (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "chooseTriggers") {
      return choice.options.filter((o) => o.optionId.endsWith(TEMPORALLY_DISPLACED)).map((o) => o.optionId);
    }
    return firstLegal(s);
  };

  it("is offered, and the chosen TEMPORAL card (Malcolm, Randall, Stored Energy are TEMPORAL; an event is not) goes to hand", () => {
    const s = withDiscard(MALCOLM, EVENT_A, STORED, RANDALL);
    const handBefore = handOf(s);
    const run = driveEventsPicking(DEPS, s, takeTemporal(RANDALL), toAlterEgo(s));
    expect(playerOf(run.state, P1).identity.form).toBe("alterEgo");
    expect(sorted(handOf(run.state))).toEqual(sorted([...handBefore, RANDALL]));
    expect(sorted(discardOf(run.state))).toEqual(sorted([MALCOLM, EVENT_A, STORED]));
  });

  it("only TEMPORAL cards are offered: with an event and a resource that is not TEMPORAL in the pile, the three TEMPORAL are options", () => {
    const s = withDiscard(MALCOLM, EVENT_A, ENERGY, STORED, RIFLE);
    const changed = applyOk(s, toAlterEgo(s), DEPS).state;
    const offer = changed.pendingChoice!;
    expect(offer.prompt.kind).toBe("chooseTriggers");
    const answered = applyOk(
      changed,
      {
        type: "resolveChoice",
        playerId: P1,
        choiceId: offer.choiceId,
        selectedOptionIds: offer.options
          .filter((o) => o.optionId.endsWith(TEMPORALLY_DISPLACED))
          .map((o) => o.optionId),
      },
      DEPS,
    ).state;
    const options = answered.pendingChoice!.options.map((o) =>
      o.ref?.kind === "card" ? codeOf(answered, o.ref.instanceId) : "?",
    );
    expect(sorted(options)).toEqual(sorted([MALCOLM, STORED, RIFLE]));
  });

  it("declined: the hand and the discard pile are unchanged", () => {
    const s = withDiscard(MALCOLM, STORED);
    const run = driveEventsPicking(DEPS, s, picker(), toAlterEgo(s));
    expect(playerOf(run.state, P1).identity.form).toBe("alterEgo");
    expect(sorted(handOf(run.state))).toEqual(sorted(handOf(s)));
    expect(sorted(discardOf(run.state))).toEqual(sorted([MALCOLM, STORED]));
  });

  it("with no TEMPORAL card in the discard pile: nothing is offered and nothing moves", () => {
    const s = withDiscard(EVENT_A, ENERGY);
    const changed = applyOk(s, toAlterEgo(s), DEPS);
    expect(changed.state.pendingChoice).toBeNull();
    expect(sorted(handOf(changed.state))).toEqual(sorted(handOf(s)));
    expect(sorted(discardOf(changed.state))).toEqual(sorted([EVENT_A, ENERGY]));
  });

  it("changing to hero form does not answer it (it is printed on the alter-ego face)", () => {
    const s = withForm(withDiscard(MALCOLM, STORED), "alterEgo");
    const changed = applyOk(s, toHero(), DEPS);
    expect(playerOf(changed.state, P1).identity.form).toBe("hero");
    const options = changed.state.pendingChoice?.options.map((o) => o.optionId) ?? [];
    expect(options.filter((o) => o.endsWith(TEMPORALLY_DISPLACED))).toEqual([]);
    expect(sorted(discardOf(changed.state))).toEqual(sorted([MALCOLM, STORED]));
  });

  it("changing form twice in one round is refused; the next round it answers again", () => {
    const s = withDiscard(MALCOLM, STORED);
    const once = settle(applyOk(s, toAlterEgo(s), DEPS).state, acceptTemporally, undefined, DEPS);
    expect(applyCommand(once, toHero(), DEPS).ok).toBe(false);
    expect(handOf(once).filter((c) => c === MALCOLM || c === STORED)).toHaveLength(1);
  });

  it("a second player's seat is untouched: his own discard pile and hand stay as they were", () => {
    const s0 = heroGame({ seats: ["bishop", "spider"] });
    const owner = playerOf(s0, P1);
    const malcolm = owner.deck.find((i) => codeOf(s0, i) === MALCOLM)!;
    const s: GameState = {
      ...s0,
      players: s0.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== malcolm), discard: [malcolm] } : p,
      ),
    };
    const run = driveEventsPicking(DEPS, s, acceptTemporally, toAlterEgo(s));
    expect(handOf(run.state)).toContain(MALCOLM);
    expect(handOf(run.state, P2)).toEqual(handOf(s, P2));
    expect(deckOf(run.state, P2)).toEqual(deckOf(s, P2));
    expect(discardOf(run.state, P2)).toEqual([]);
  });
});

describe("two players", () => {
  it("the damage dealt to the other player (Bishop in alter-ego form, not attacked): his deck, hand and discard pile are untouched", () => {
    let s = stackDeck(setupGame(["bishop", "spider"]), P1, ENERGY, STRENGTH, SUPPORT);
    s = withForm(s, { heroForm: 0 }, P2);
    s = handTo(handTo(s, P1, 6), P2, 5);
    // Rhino schemes against Bishop's alter-ego (the first boost card) and attacks the other player (the second).
    const run = round(s, { boosts: [BOOST_0, BOOST_1], pick: picker({ accept: true }) });
    expect(damageOf(run.state, P2)).toBe(3);
    expect(damageOf(run.state, P1)).toBe(0);
    expect(deckOf(run.state, P1)).toEqual(deckOf(s, P1));
    expect(discardOf(run.state, P1)).toEqual([]);
    expect(moments(run.events)).toHaveLength(0);
  });

  it("both in hero form, Bishop second: his attack is answered, the other player's deck is untouched", () => {
    const bishop = P2;
    const s = stackDeck(heroGame({ seats: ["spider", "bishop"] }), bishop, EVENT_A, GENIUS, SUPPORT);
    const run = round(s, { boosts: [BOOST_0, BOOST_0], pick: picker({ accept: true }) });
    // Each attack is undefended for 2: the first on the other player, the second on Bishop.
    expect(damageOf(run.state, P1)).toBe(2);
    expect(damageOf(run.state, bishop)).toBe(2);
    expect(discardOf(run.state, bishop)).toEqual([EVENT_A]);
    expect(handOf(run.state, bishop)).toContain(GENIUS);
    expect(deckOf(run.state, P1)).toEqual(deckOf(s, P1));
    expect(discardOf(run.state, P1)).toEqual([]);
    expect(moments(run.events)).toEqual([expect.objectContaining({ playerId: bishop })]);
  });
});
