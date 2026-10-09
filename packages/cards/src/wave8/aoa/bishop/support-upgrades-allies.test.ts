import { AOA_CARDS, AOA_STARTER_DECKS, CORE_CARDS, DRAX_CARDS, cardId } from "@mc/content";
import {
  applyCommand,
  createGame,
  getInstance,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { mergeRegistries } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  picking,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withDamage, withForm } from "../../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { BISHOP_IDENTITY } from "./identity.js";
import { BISHOP_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Bishop's allies, upgrades and Stored Energy (45002 to 45006, 45010), docs/phase7-wave8.md section 7.1, 3.52, 3.39.
 * Real commands in real games: Bishop's starter deck (`bishop-leadership`) against Rhino (Core, standard), the hand and
 * the top of the deck arranged by surgery so that every count is exact. Rhino's ATK is 2 and Bishop's DEF 1, so a
 * defended attack takes 1 and an undefended one 2 plus the boost icons (cards 01104 / 01188 / 01100 print 0, 1, 2).
 */
const MALCOLM = "45002";
const RANDALL = "45003";
const RIFLE = "45004";
const UNIFORM = "45005";
const CHARGED = "45006";
const STORED = "45010";
const POWER = "45019";
const ENERGY = "45022";
const GENIUS = "45023";
const STRENGTH = "45024";
const EVENT_A = "45016";
const EVENT_B = "45017";
const EVENT_C = "45018";
const SUPPORT = "45013";
const UPGRADE = "45014";
/** Resource cards that are not Bishop's: Core's Energy, Genius and Strength. */
const CORE_ENERGY = "01088";
const CORE_GENIUS = "01089";
const CORE_STRENGTH = "01090";
const YOTAT = "19027";
const WEAPONS_RUNNER = "01121";
const BOOST_0 = "01104";
const BOOST_2 = "01100";
const DEAL_A = "01098";
const DEAL_B = "01099";
const FILLERS = [SUPPORT, UPGRADE, EVENT_A, EVENT_B, EVENT_C];

const REF = {
  malcolm: "45002.malcolm-action",
  randall: "45003.randall-action",
  rifle: "45004.bishops-rifle-action",
  uniform: "45005.bishops-uniform-response",
  charge: "45006.super-charged-action",
  interrupt: "45006.super-charged-interrupt",
} as const;

const BISHOP = AOA_STARTER_DECKS.find((d) => d.id === "bishop-leadership")!;
const BISHOP_SEAT = {
  identityCardId: BISHOP.identityCardId,
  aspects: BISHOP.aspects,
  deck: BISHOP.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
};
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = "bishop" | "spider";

const DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE7_ABILITIES, BISHOP_IDENTITY, BISHOP_SUPPORT_UPGRADES_ALLIES),
};

const codeOf = (s: GameState, id: InstanceId): string => (getInstance(s, id)?.cardId as string | undefined) ?? "?";
const codes = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((id) => codeOf(s, id));
const handOf = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).hand);
const discardOf = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).discard).reverse();
const sorted = (list: readonly string[]): string[] => [...list].sort();
const damageOf = (s: GameState, p: PlayerId = P1): number => inst(s, identityOf(s, p)).damage;
/** The in-play instance of this code of a player (an ally, or an upgrade on the identity). */
const inPlay = (s: GameState, code: string, p: PlayerId = P1): InstanceId => {
  const id = [...playerOf(s, p).playArea, ...inst(s, identityOf(s, p)).attachments].find((i) => codeOf(s, i) === code);
  if (!id) throw new Error(`${code} is not in play for ${p}`);
  return id;
};
/** Every in-play copy of this code of a player, in play order. */
const copiesInPlay = (s: GameState, code: string, p: PlayerId = P1): InstanceId[] =>
  [...playerOf(s, p).playArea, ...inst(s, identityOf(s, p)).attachments].filter((i) => codeOf(s, i) === code);
const isInPlay = (s: GameState, id: InstanceId, p: PlayerId = P1): boolean =>
  [...playerOf(s, p).playArea, ...inst(s, identityOf(s, p)).attachments].includes(id);
{
}
const rhinoOf = (s: GameState): InstanceId => s.activeVillainId!;
const resourcesIn = (list: readonly string[]): number =>
  list.filter((c) => [ENERGY, GENIUS, STRENGTH, STORED, POWER, CORE_ENERGY, CORE_GENIUS, CORE_STRENGTH].includes(c))
    .length;

function setupGame(seats: readonly Seat[] = ["bishop"], extra: readonly string[] = []) {
  const config = coreScenario("rhino", {
    players: [SPIDER_MAN],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS, ...DRAX_CARDS],
  } as never);
  const created = createGame(
    {
      ...config,
      encounterDeck: [...config.encounterDeck, ...extra.map(cardId)],
      players: seats.map((seat) =>
        seat === "spider"
          ? { ...coreScenario("rhino", { players: [SPIDER_MAN], seed: 1, modularSetIds: [] }).players[0]! }
          : { identityCardId: BISHOP_SEAT.identityCardId, aspects: BISHOP_SEAT.aspects, deck: BISHOP_SEAT.deck },
      ),
    },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

/** Every seat in hero form with a hand of 5. */
function heroGame(seats: readonly Seat[] = ["bishop"], extra: readonly string[] = []): GameState {
  let s = setupGame(seats, extra);
  for (const p of s.players) s = withForm(s, { heroForm: 0 }, p.playerId);
  return s;
}

/**
 * A Spider-Man game (a Core hero) in hero form. A deck cannot be built with Bishop's cards (identity-specific), so by
 * surgery the first deck cards are turned into `extra` (and three of each filler): Spider-Man holds real instances of
 * them, in his own seat, and every ability reads them as his.
 */
function coreSeatGame(...extra: readonly string[]): GameState {
  const base = coreScenario("rhino", {
    players: [SPIDER_MAN],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS],
  } as never);
  const created = createGame(base, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, firstLegal, (st) => st.step.phase === "player", DEPS);
  const wanted = [...extra, ...FILLERS, ...FILLERS, ...FILLERS];
  playerOf(s, P1)
    .deck.slice(0, wanted.length)
    .forEach((id, i) => {
      s = patchInstance(s, id, { cardId: cardId(wanted[i]!) });
    });
  return withForm(s, { heroForm: 0 });
}

/**
 * Test surgery: the hand is exactly `hand` (padded to `size`, 5 by default, with filler cards so that ending a turn
 * draws nothing), the top of the deck is `top` in order, the rest keeps its order and the discard pile is empty.
 */
function arrange(
  state: GameState,
  player: PlayerId,
  opts: { hand: readonly string[]; top?: readonly string[]; size?: number; fillers?: readonly string[] },
): GameState {
  const owner = playerOf(state, player);
  const pool = [...owner.hand, ...owner.deck, ...owner.discard];
  const used = new Set<InstanceId>();
  const take = (code: string): InstanceId => {
    const id = pool.find((i) => !used.has(i) && codeOf(state, i) === code);
    if (!id) throw new Error(`${player} has no spare ${code}`);
    used.add(id);
    return id;
  };
  const hand = opts.hand.map(take);
  const top = (opts.top ?? []).map(take);
  for (let guard = 0; hand.length < (opts.size ?? opts.hand.length); guard++) {
    const code = (opts.fillers ?? FILLERS).find((c) => pool.some((i) => !used.has(i) && codeOf(state, i) === c));
    if (!code || guard > 20) throw new Error("no filler left");
    hand.push(take(code));
  }
  const rest = pool.filter((i) => !used.has(i));
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, hand, deck: [...top, ...rest], discard: [] } : p,
    ),
  };
}

/** Really plays a card: an upgrade attached to the identity, an ally to the table, paid by `payers` (hand cards). */
function playCard(state: GameState, code: string, payers: readonly string[], player: PlayerId = P1): GameState {
  const s = arrange(state, player, { hand: [code, ...payers], size: 1 + payers.length });
  const [card, ...paying] = playerOf(s, player).hand;
  const type = (AOA_CARDS.find((c) => c.id === cardId(code)) ?? CORE_CARDS.find((c) => c.id === cardId(code)))!.type;
  const after = runWith(
    DEPS,
    s,
    play(player, card!, paying, type === "upgrade" ? { attachToInstanceId: identityOf(s, player) } : {}),
  );
  const done = settle(after, firstLegal, undefined, DEPS);
  expect(isInPlay(done, card!, player)).toBe(true);
  expect(playerOf(done, player).hand).toEqual([]);
  return done;
}

/** The codes of Spider-Man's own cards that are not resource cards, to pad his hand with. */
const spiderFillers = (s: GameState): string[] => [
  ...new Set(
    codes(s, [...playerOf(s, P2).hand, ...playerOf(s, P2).deck]).filter(
      (c) => c.startsWith("01") && !["01088", "01089", "01090"].includes(c),
    ),
  ),
];

const without = (s: GameState, id: InstanceId, change: Partial<ReturnType<typeof inst>>) =>
  patchInstance(s, id, change);

const useOk = (s: GameState, command: Command): GameState =>
  settle(applyOk(s, command, DEPS).state, firstLegal, undefined, DEPS);
const refused = (s: GameState, command: Command): string => {
  const result = applyCommand(s, command, DEPS);
  if (result.ok) throw new Error(`${command.type} was accepted`);
  return result.error.code;
};
const discardingWith = (s: GameState, p: PlayerId, id: InstanceId, ability: string, card: InstanceId): Command =>
  use(p, id, ability, [], { discard: [card] });
const handId = (s: GameState, code: string, p: PlayerId = P1): InstanceId =>
  playerOf(s, p).hand.find((i) => codeOf(s, i) === code)!;

interface PickOpts {
  /** Optional triggers taken: those whose option id ends with one of these. */
  take?: readonly string[];
  takeFor?: PlayerId;
  defend?: boolean;
  minionsOnly?: boolean;
  defender?: InstanceId;
}
const picker =
  (opts: PickOpts = {}): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "chooseTriggers") {
      if (opts.takeFor && choice.playerId !== opts.takeFor) return [];
      const own = choice.options.filter((o) => (opts.take ?? []).some((t) => o.optionId.endsWith(t)));
      return own.slice(0, choice.maxSelections).map((o) => o.optionId);
    }
    if (choice.prompt.kind === "declareDefender") {
      if (opts.defender) return [opts.defender];
      if (opts.minionsOnly && choice.prompt.attack.enemyInstanceId === s.activeVillainId) return ["decline"];
      return opts.defend ? [identityOf(s, choice.playerId)] : ["decline"];
    }
    return firstLegal(s);
  };

/** The villain phase after every player ends their turn: boost cards of the activations, then the deals. */
function round(state: GameState, opts: { boosts: readonly string[]; pick?: Picker; deals?: readonly string[] }) {
  const seats = state.players.map((p) => p.playerId);
  const deals = opts.deals ?? [DEAL_A, DEAL_B].slice(0, seats.length);
  const stacked = stackEncounterDeck(state, ...opts.boosts, ...deals);
  return driveEventsPicking(DEPS, stacked, opts.pick ?? picker(), ...seats.map((p) => endTurn(p)));
}

/** The options of every `chooseTriggers` prompt shown, as ability ids. */
const offered = (events: readonly GameEvent[]): string[][] =>
  events.flatMap((e) =>
    e.type === "choiceRequested" && e.choice.prompt.kind === "chooseTriggers"
      ? [e.choice.options.map((o) => o.optionId.split(":")[1] ?? o.optionId)]
      : [],
  );
const flat = (events: readonly GameEvent[]): string[] => offered(events).flat();
const damagesTo = (events: readonly GameEvent[], id: InstanceId): number[] =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === id ? [e.amount] : []));

/** Weapons Runner (ATK 1) engaged with the player, by surgery on a spare encounter card. */
function withEngagedMinion(s0: GameState, code: string, p: PlayerId = P1): { state: GameState; id: InstanceId } {
  let s = s0;
  const deckId = Object.keys(s.encounterDecks)[0]!;
  const pile = s.encounterDecks[deckId]!;
  const id = pile.deck.find((i) => codeOf(s, i) === code)!;
  s = {
    ...patchInstance(s, id, { faceup: true, engagedWith: p }),
    encounterDecks: { ...s.encounterDecks, [deckId]: { ...pile, deck: pile.deck.filter((i) => i !== id) } },
    players: s.players.map((pl) => (pl.playerId === p ? { ...pl, playArea: [...pl.playArea, id] } : pl)),
  };
  return { state: s, id };
}

const dataOf = (code: string) =>
  AOA_CARDS.find((c) => c.id === cardId(code)) as never as Record<string, unknown> & {
    abilities: { id: string }[];
  };

describe("registry and data", () => {
  it.each(Object.keys(BISHOP_SUPPORT_UPGRADES_ALLIES))("%s validates", (id) => {
    expect(validateDefinition(BISHOP_SUPPORT_UPGRADES_ALLIES[id]!)).toEqual([]);
  });

  it("holds exactly the six refs the data names on these six cards; Stored Energy has none", () => {
    expect(Object.keys(BISHOP_SUPPORT_UPGRADES_ALLIES).sort()).toEqual(Object.values(REF).sort());
    const named = [MALCOLM, RANDALL, RIFLE, UNIFORM, CHARGED, STORED].flatMap((c) =>
      dataOf(c).abilities.map((a) => a.id),
    );
    expect(named.sort()).toEqual(Object.values(REF).sort());
    expect(dataOf(STORED).abilities).toEqual([]);
  });

  it("printed data: costs, stats, icons, traits, restricted", () => {
    const row = (c: string) => {
      const d = dataOf(c) as never as Record<string, unknown>;
      return [d.type, d.cost, d.atk, d.thw, d.hp, JSON.stringify(d.resourceIcons ?? d.producesIcons), d.unique];
    };
    expect(row(MALCOLM)).toEqual(["ally", 3, 2, 1, 3, '{"wild":1}', true]);
    expect(row(RANDALL)).toEqual(["ally", 3, 1, 2, 3, '{"wild":1}', true]);
    expect(row(RIFLE)).toEqual(["upgrade", 2, undefined, undefined, undefined, '{"energy":1}', true]);
    expect(row(UNIFORM)).toEqual(["upgrade", 2, undefined, undefined, undefined, '{"mental":1}', true]);
    expect(row(CHARGED)).toEqual(["upgrade", 0, undefined, undefined, undefined, '{"mental":1}', false]);
    expect(row(STORED)).toEqual([
      "resource",
      undefined,
      undefined,
      undefined,
      undefined,
      '{"energy":1,"physical":1}',
      false,
    ]);
    expect((dataOf(RIFLE).keywords as { name: string }[]).map((k) => k.name)).toEqual(["restricted"]);
  });
});

describe("Stored Energy (45010): a resource card with no text", () => {
  it("one Stored Energy (energy + physical = 2 resources) alone pays Bishop's Uniform (cost 2)", () => {
    const s = arrange(heroGame(), P1, { hand: [UNIFORM, STORED], size: 2 });
    const [uniform, stored] = playerOf(s, P1).hand;
    const after = useOk(s, play(P1, uniform!, [stored!], { attachToInstanceId: identityOf(s) }));
    expect(isInPlay(after, uniform!)).toBe(true);
    expect(discardOf(after)).toEqual([STORED]);
    expect(handOf(after)).toEqual([]);
  });

  it("it is TEMPORAL: Temporally Displaced (alter-ego form) returns it from the discard pile", () => {
    let s = arrange(heroGame(), P1, { hand: [STORED] });
    const stored = handId(s, STORED);
    s = {
      ...s,
      players: s.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== stored), discard: [stored] } : p,
      ),
    };
    const after = settle(
      applyOk(s, { type: "changeForm", playerId: P1 }, DEPS).state,
      (st) =>
        st.pendingChoice?.prompt.kind === "chooseTriggers"
          ? picker({ take: ["45001b.temporally-displaced"] })(st)
          : firstLegal(st),
      undefined,
      DEPS,
    );
    expect(handOf(after)).toContain(STORED);
    expect(discardOf(after)).toEqual([]);
  });
});

/** Malcolm (physical heals) and Randall (energy heals) share one shape. */
describe.each([
  {
    name: "Malcolm",
    code: MALCOLM,
    ref: REF.malcolm,
    heals: [STRENGTH, STORED],
    coreHeal: CORE_STRENGTH,
    no: [GENIUS, ENERGY, POWER],
    atk: 2,
    thw: 1,
  },
  {
    name: "Randall",
    code: RANDALL,
    ref: REF.randall,
    heals: [ENERGY, STORED],
    coreHeal: CORE_ENERGY,
    no: [GENIUS, STRENGTH, POWER],
    atk: 1,
    thw: 2,
  },
])("$name ($code)", ({ code, ref, heals, coreHeal, no, atk, thw }) => {
  /** The ally in play, exhausted, with `damage` on it; hand = `hand`, Bishop in hero form. */
  const staged = (hand: readonly string[], damage = 1, exhausted = true, state = heroGame()) => {
    let s = playCard(state, code, [ENERGY, SUPPORT]);
    const ally = inPlay(s, code);
    s = without(s, ally, { exhausted, damage });
    return { s: arrange(s, P1, { hand }), ally };
  };

  it("costs 3 (Energy 2 + Team Training 1), enters ready with no damage, and has its printed ATK and THW", () => {
    const s = playCard(heroGame(), code, [ENERGY, SUPPORT]);
    const ally = inPlay(s, code);
    expect(inst(s, ally).exhausted).toBe(false);
    expect(inst(s, ally).damage).toBe(0);
    expect(discardOf(s)).toEqual([ENERGY, SUPPORT]);
    const rhino = rhinoOf(s);
    const hit = useOk(s, { type: "basicAttack", playerId: P1, attackerInstanceId: ally, targetInstanceId: rhino });
    expect(inst(hit, rhino).damage - inst(s, rhino).damage).toBe(atk);
    // Consequential damage: 1 after attacking.
    expect(inst(hit, ally).damage).toBe(1);
    const main = s.mainScheme.instanceId;
    const withThreat = patchInstance(s, main, { threat: 6 });
    const thwarted = useOk(withThreat, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: ally,
      schemeInstanceId: main,
    });
    expect(inst(withThreat, main).threat - inst(thwarted, main).threat).toBe(thw);
    expect(inst(thwarted, ally).damage).toBe(1);
  });

  it("cannot be played for less than 3", () => {
    const s = arrange(heroGame(), P1, { hand: [code, SUPPORT, SUPPORT], size: 3 });
    const [card, a, b] = playerOf(s, P1).hand;
    expect(refused(s, play(P1, card!, [a!, b!]))).toBeTruthy();
  });

  it.each(heals)(
    "discarding %s (prints the icon): readies, heals 1 of 1 damage, the card to the discard pile, hand 1 smaller",
    (resourceCode) => {
      const { s, ally } = staged([resourceCode, SUPPORT, UPGRADE], 1);
      const after = useOk(s, discardingWith(s, P1, ally, ref, handId(s, resourceCode)));
      expect(inst(after, ally).exhausted).toBe(false);
      expect(inst(after, ally).damage).toBe(0);
      expect(handOf(after)).toEqual([SUPPORT, UPGRADE]);
      expect(discardOf(after)).toEqual([resourceCode]);
    },
  );

  it.each(no)("discarding %s (does not print the icon): readies, no healing (damage stays 1)", (resourceCode) => {
    const { s, ally } = staged([resourceCode, SUPPORT, UPGRADE], 1);
    const after = useOk(s, discardingWith(s, P1, ally, ref, handId(s, resourceCode)));
    expect(inst(after, ally).exhausted).toBe(false);
    expect(inst(after, ally).damage).toBe(1);
    expect(discardOf(after)).toEqual([resourceCode]);
  });

  it("heals only 1 of 2 damage; already ready with no damage it is still a legal use (the card is spent)", () => {
    const hurt = staged([heals[0]!, SUPPORT], 2);
    const after = useOk(hurt.s, discardingWith(hurt.s, P1, hurt.ally, ref, handId(hurt.s, heals[0]!)));
    expect(inst(after, hurt.ally).damage).toBe(1);
    const fresh = staged([heals[0]!, SUPPORT], 0, false);
    const used = useOk(fresh.s, discardingWith(fresh.s, P1, fresh.ally, ref, handId(fresh.s, heals[0]!)));
    expect(inst(used, fresh.ally).exhausted).toBe(false);
    expect(inst(used, fresh.ally).damage).toBe(0);
    expect(discardOf(used)).toEqual([heals[0]]);
  });

  it("limit once per phase: a second use is refused; it works again the next player phase", () => {
    const { s, ally } = staged([heals[0]!, STORED, SUPPORT, UPGRADE, EVENT_A], 0);
    const once = useOk(s, discardingWith(s, P1, ally, ref, handId(s, heals[0]!)));
    expect(handOf(once)).toEqual([STORED, SUPPORT, UPGRADE, EVENT_A]);
    expect(refused(once, discardingWith(once, P1, ally, ref, handId(once, STORED)))).toBeTruthy();
    expect(handOf(once)).toEqual([STORED, SUPPORT, UPGRADE, EVENT_A]);
    // The next player phase: the hand of 4 is drawn up to 5 with a second Stored Energy stacked on the deck.
    const stacked = arrange(once, P1, { hand: [STORED, SUPPORT, UPGRADE, EVENT_A], top: [STORED] });
    const next = round(stacked, { boosts: [BOOST_0] }).state;
    expect(next.step.phase).toBe("player");
    expect(handOf(next)).toEqual([STORED, SUPPORT, UPGRADE, EVENT_A, STORED]);
    const again = useOk(next, discardingWith(next, P1, ally, ref, handId(next, STORED)));
    expect(discardOf(again)).toContain(STORED);
  });

  it("refused with no resource card in hand, and refused when the discard is not a resource card", () => {
    const { s, ally } = staged([SUPPORT, UPGRADE, EVENT_A]);
    expect(refused(s, use(P1, ally, ref))).toBeTruthy();
    expect(refused(s, discardingWith(s, P1, ally, ref, handId(s, SUPPORT)))).toBeTruthy();
    expect(handOf(s)).toEqual([SUPPORT, UPGRADE, EVENT_A]);
    expect(inst(s, ally).exhausted).toBe(true);
  });

  it("is an Action, not a Hero Action: works in alter-ego form too", () => {
    const { s, ally } = staged([heals[0]!, SUPPORT], 1, true, withForm(heroGame(), "alterEgo"));
    const after = useOk(s, discardingWith(s, P1, ally, ref, handId(s, heals[0]!)));
    expect(inst(after, ally).exhausted).toBe(false);
    expect(inst(after, ally).damage).toBe(0);
  });

  it("2 players: only its controller uses it, and the discard is from the controller's hand, not the other player's", () => {
    const base = heroGame(["bishop", "spider"]);
    let s = playCard(base, code, [ENERGY, SUPPORT]);
    const ally = inPlay(s, code);
    s = without(s, ally, { exhausted: true, damage: 1 });
    s = arrange(s, P1, { hand: [heals[0]!, SUPPORT] });
    const p2Hand = handOf(s, P2);
    expect(refused(s, use(P2, ally, ref, [], { discard: [playerOf(s, P2).hand[0]!] }))).toBeTruthy();
    expect(refused(s, use(P1, ally, ref, [], { discard: [playerOf(s, P2).hand[0]!] }))).toBeTruthy();
    const after = useOk(s, discardingWith(s, P1, ally, ref, handId(s, heals[0]!)));
    expect(inst(after, ally).damage).toBe(0);
    expect(handOf(after, P2)).toEqual(p2Hand);
    expect(discardOf(after, P2)).toEqual([]);
  });

  it("from a Core hero's seat (Spider-Man, Core's Energy, Genius and Strength): readies and heals by the printed icon", () => {
    let s = coreSeatGame(code, CORE_ENERGY, CORE_STRENGTH, CORE_GENIUS);
    s = arrange(s, P1, { hand: [code, CORE_ENERGY, SUPPORT] });
    const [card, a, b] = playerOf(s, P1).hand;
    s = useOk(s, play(P1, card!, [a!, b!]));
    const ally = inPlay(s, code);
    s = without(s, ally, { exhausted: true, damage: 1 });
    s = arrange(s, P1, { hand: [coreHeal, CORE_GENIUS] });
    const after = useOk(s, discardingWith(s, P1, ally, ref, handId(s, coreHeal)));
    expect([inst(after, ally).exhausted, inst(after, ally).damage]).toEqual([false, 0]);
    expect(handOf(after)).toEqual([CORE_GENIUS]);
  });
});

describe("Bishop's Rifle (45004)", () => {
  const withRifle = (hand: readonly string[], state = heroGame()) => {
    const s = playCard(state, RIFLE, [SUPPORT, UPGRADE]);
    return arrange(s, P1, { hand });
  };

  it("costs 2, attaches to Bishop, enters ready", () => {
    const s = playCard(heroGame(), RIFLE, [SUPPORT, UPGRADE]);
    const rifle = inPlay(s, RIFLE);
    expect(inst(s, rifle).exhausted).toBe(false);
    expect(discardOf(s)).toEqual([SUPPORT, UPGRADE]);
  });

  it.each([
    { hand: [ENERGY, STORED, SUPPORT, UPGRADE, EVENT_A], damage: 2 },
    { hand: [SUPPORT, UPGRADE, EVENT_A, EVENT_B, EVENT_C], damage: 0 },
    { hand: [ENERGY, GENIUS, STRENGTH, STORED, POWER], damage: 5 },
    { hand: [POWER, SUPPORT], damage: 1 },
  ])(
    "hand $hand: 1 damage per resource card = $damage to Rhino, Rifle exhausted, hand untouched",
    ({ hand, damage }) => {
      const s = withRifle(hand);
      const rifle = inPlay(s, RIFLE);
      const rhino = rhinoOf(s);
      const result = applyOk(s, use(P1, rifle, REF.rifle), DEPS);
      const after = settle(result.state, picking(rhino), undefined, DEPS);
      expect(inst(after, rhino).damage - inst(s, rhino).damage).toBe(damage);
      expect(inst(after, rifle).exhausted).toBe(true);
      expect(handOf(after)).toEqual(hand);
      expect(damageOf(after)).toBe(0);
    },
  );

  it("refused while exhausted, and refused in alter-ego form (a Hero Action)", () => {
    const s = withRifle([ENERGY, SUPPORT]);
    const rifle = inPlay(s, RIFLE);
    expect(refused(without(s, rifle, { exhausted: true }), use(P1, rifle, REF.rifle))).toBeTruthy();
    expect(refused(withForm(s, "alterEgo"), use(P1, rifle, REF.rifle))).toBeTruthy();
  });

  it("ranged: against Yotat (guard, retaliate 1) Bishop takes nothing from the Rifle but 1 from a basic attack", () => {
    const staged = withEngagedMinion(heroGame(["bishop"], [YOTAT]), YOTAT);
    const s = arrange(playCard(staged.state, RIFLE, [SUPPORT, UPGRADE]), P1, {
      hand: [ENERGY, STORED, SUPPORT, UPGRADE, EVENT_A],
    });
    const rifle = inPlay(s, RIFLE);
    const shot = settle(applyOk(s, use(P1, rifle, REF.rifle), DEPS).state, picking(staged.id), undefined, DEPS);
    expect(inst(shot, staged.id).damage).toBe(2);
    expect(damageOf(shot)).toBe(0);
    const basic = useOk(s, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(s),
      targetInstanceId: staged.id,
    });
    expect(inst(basic, staged.id).damage).toBe(2);
    expect(damageOf(basic)).toBe(1);
  });

  it("2 players: only the controller's own hand is counted (the other player holds 3 resource cards)", () => {
    let s = playCard(heroGame(["bishop", "spider"]), RIFLE, [SUPPORT, UPGRADE]);
    s = arrange(s, P1, { hand: [ENERGY, SUPPORT] });
    s = arrange(s, P2, { hand: [CORE_ENERGY, CORE_GENIUS, CORE_STRENGTH] });
    const rifle = inPlay(s, RIFLE);
    const rhino = rhinoOf(s);
    const after = settle(applyOk(s, use(P1, rifle, REF.rifle), DEPS).state, picking(rhino), undefined, DEPS);
    expect(inst(after, rhino).damage - inst(s, rhino).damage).toBe(1);
    expect(handOf(after, P2)).toEqual(handOf(s, P2));
  });

  it("Super-Charged's interrupt is for a basic attack: the Rifle's attack offers none", () => {
    let s = playCard(heroGame(), RIFLE, [SUPPORT, UPGRADE]);
    s = playCard(s, CHARGED, []);
    s = arrange(s, P1, { hand: [ENERGY, SUPPORT] });
    const charged = inPlay(s, CHARGED);
    s = without(s, charged, { counters: { charge: 4 } });
    const rifle = inPlay(s, RIFLE);
    const rhino = rhinoOf(s);
    const result = applyOk(s, use(P1, rifle, REF.rifle), DEPS);
    const after = settle(result.state, picking(rhino), undefined, DEPS);
    expect(flat(result.events)).toEqual([]);
    expect(inst(after, rhino).damage - inst(s, rhino).damage).toBe(1);
    expect(isInPlay(after, charged)).toBe(true);
  });

  it("from a Core hero's seat: counts Core's own resource cards", () => {
    let s = coreSeatGame(RIFLE, CORE_ENERGY, CORE_STRENGTH, CORE_GENIUS, CORE_ENERGY);
    s = arrange(s, P1, { hand: [RIFLE, CORE_ENERGY] });
    const [card, a] = playerOf(s, P1).hand;
    s = useOk(s, play(P1, card!, [a!], { attachToInstanceId: identityOf(s) }));
    s = arrange(s, P1, { hand: [CORE_GENIUS, CORE_ENERGY] });
    const rifle = inPlay(s, RIFLE);
    const rhino = rhinoOf(s);
    const after = settle(applyOk(s, use(P1, rifle, REF.rifle), DEPS).state, picking(rhino), undefined, DEPS);
    expect(inst(after, rhino).damage - inst(s, rhino).damage).toBe(resourcesIn(handOf(s)));
  });
});

describe("Super-Charged (45006): the Action", () => {
  const withCharged = (hand: readonly string[], state = heroGame()) =>
    arrange(playCard(state, CHARGED, []), P1, { hand });

  it("costs 0 and enters with no counters", () => {
    const s = playCard(heroGame(), CHARGED, []);
    expect(inst(s, inPlay(s, CHARGED)).counters.charge ?? 0).toBe(0);
  });

  it.each([
    [ENERGY, 2],
    [GENIUS, 2],
    [STRENGTH, 2],
    [STORED, 2],
    [POWER, 1],
  ])("discarding %s places %i charge counters", (resourceCode, counters) => {
    const s = withCharged([resourceCode, SUPPORT]);
    const charged = inPlay(s, CHARGED);
    const after = useOk(s, discardingWith(s, P1, charged, REF.charge, handId(s, resourceCode)));
    expect(inst(after, charged).counters.charge).toBe(counters);
    expect(discardOf(after)).toEqual([resourceCode]);
    expect(handOf(after)).toEqual([SUPPORT]);
  });

  it("no limit: Energy, then Stored Energy, then Genius in one phase make 6 counters", () => {
    let s = withCharged([ENERGY, STORED, GENIUS, SUPPORT]);
    const charged = inPlay(s, CHARGED);
    for (const c of [ENERGY, STORED, GENIUS]) s = useOk(s, discardingWith(s, P1, charged, REF.charge, handId(s, c)));
    expect(inst(s, charged).counters.charge).toBe(6);
    expect(handOf(s)).toEqual([SUPPORT]);
  });

  it("refused with no resource card in hand and when the discard is not a resource card", () => {
    const s = withCharged([SUPPORT, UPGRADE]);
    const charged = inPlay(s, CHARGED);
    expect(refused(s, use(P1, charged, REF.charge))).toBeTruthy();
    expect(refused(s, discardingWith(s, P1, charged, REF.charge, handId(s, SUPPORT)))).toBeTruthy();
  });

  it("works in alter-ego form (an Action)", () => {
    const s = withCharged([ENERGY, SUPPORT], withForm(heroGame(), "alterEgo"));
    const charged = inPlay(s, CHARGED);
    const after = useOk(s, discardingWith(s, P1, charged, REF.charge, handId(s, ENERGY)));
    expect(inst(after, charged).counters.charge).toBe(2);
  });

  it("2 players: only its controller uses it; the other seat's hand is untouched", () => {
    let s = playCard(heroGame(["bishop", "spider"]), CHARGED, []);
    s = arrange(s, P1, { hand: [ENERGY, SUPPORT] });
    const charged = inPlay(s, CHARGED);
    expect(refused(s, use(P2, charged, REF.charge, [], { discard: [playerOf(s, P2).hand[0]!] }))).toBeTruthy();
    const after = useOk(s, discardingWith(s, P1, charged, REF.charge, handId(s, ENERGY)));
    expect(handOf(after, P2)).toEqual(handOf(s, P2));
  });

  it("from a Core hero's seat: Core's Strength (2 icons) makes 2 counters", () => {
    let s = coreSeatGame(CHARGED, CORE_STRENGTH, CORE_GENIUS);
    s = arrange(s, P1, { hand: [CHARGED], size: 1 });
    s = useOk(s, play(P1, playerOf(s, P1).hand[0]!, [], { attachToInstanceId: identityOf(s) }));
    s = arrange(s, P1, { hand: [CORE_STRENGTH, CORE_GENIUS], size: 2 });
    const charged = inPlay(s, CHARGED);
    const after = useOk(s, discardingWith(s, P1, charged, REF.charge, handId(s, CORE_STRENGTH)));
    expect(inst(after, charged).counters.charge).toBe(2);
  });
});

describe("Super-Charged (45006): the Hero Interrupt on a basic attack", () => {
  /** A basic attack by Bishop on Rhino with `counters` on each Super-Charged (one or two copies) in play. */
  function attackWith(counters: readonly number[], accept = true) {
    let s = heroGame();
    for (const _ of counters) s = playCard(s, CHARGED, []);
    s = arrange(s, P1, { hand: [SUPPORT, UPGRADE] });
    const copies = copiesInPlay(s, CHARGED);
    counters.forEach((n, i) => (s = without(s, copies[i]!, { counters: { charge: n } })));
    const rhino = rhinoOf(s);
    const result = applyOk(
      s,
      { type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(s), targetInstanceId: rhino },
      DEPS,
    );
    const pick = picker({ take: accept ? [REF.interrupt] : [] });
    let after = result.state;
    const events = [...result.events];
    while (after.pendingChoice) {
      const choice = after.pendingChoice;
      const step = applyOk(
        after,
        { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: pick(after) },
        DEPS,
      );
      after = step.state;
      events.push(...step.events);
    }
    // Summed from the damage events: with enough damage Rhino is defeated and leaves play.
    const damage = damagesTo(events, rhino).reduce((a, b) => a + b, 0);
    return { s, after, rhino, copies, offers: flat(result.events), damage };
  }

  it.each([
    [0, 2],
    [1, 4],
    [2, 6],
    [3, 8],
    [4, 10],
    [5, 10],
    [6, 10],
  ])("%i counters: ATK 2 + the bonus (+2 each, at most +8) = %i damage, and the card is discarded", (n, damage) => {
    const { after, copies, damage: dealt, offers } = attackWith([n]);
    expect(offers).toEqual([REF.interrupt]);
    expect(dealt).toBe(damage);
    expect(isInPlay(after, copies[0]!)).toBe(false);
    expect(playerOf(after, P1).discard).toContain(copies[0]);
  });

  it("declined: ATK 2 only, and Super-Charged stays with its counters", () => {
    const { after, copies, damage, offers } = attackWith([4], false);
    expect(offers).toEqual([REF.interrupt]);
    expect(damage).toBe(2);
    expect(inst(after, copies[0]!).counters.charge).toBe(4);
  });

  it("the cap is each copy's own: two copies with 4 counters each give +8 and +8 (2 + 16 damage)", () => {
    const { after, copies, offers, damage } = attackWith([4, 4]);
    expect(offers).toEqual([REF.interrupt, REF.interrupt]);
    expect(damage).toBe(18);
    for (const c of copies) expect(isInPlay(after, c)).toBe(false);
  });

  it("two copies, 1 counter and 3: +2 and +6 (2 + 8 damage)", () => {
    expect(attackWith([1, 3]).damage).toBe(10);
  });

  it("an ally's basic attack is not 'you make a basic attack': no interrupt, ATK only", () => {
    let s = playCard(heroGame(), CHARGED, []);
    s = playCard(s, MALCOLM, [ENERGY, SUPPORT]);
    s = arrange(s, P1, { hand: [SUPPORT] });
    const charged = inPlay(s, CHARGED);
    s = without(s, charged, { counters: { charge: 4 } });
    const malcolm = inPlay(s, MALCOLM);
    const rhino = rhinoOf(s);
    const result = applyOk(
      s,
      { type: "basicAttack", playerId: P1, attackerInstanceId: malcolm, targetInstanceId: rhino },
      DEPS,
    );
    const after = settle(result.state, firstLegal, undefined, DEPS);
    expect(flat(result.events)).toEqual([]);
    expect(inst(after, rhino).damage - inst(s, rhino).damage).toBe(2);
    expect(inst(after, charged).counters.charge).toBe(4);
  });

  it("2 players: the other player's basic attack does not offer it", () => {
    let s = playCard(heroGame(["bishop", "spider"]), CHARGED, []);
    s = arrange(s, P1, { hand: [SUPPORT] });
    s = without(s, inPlay(s, CHARGED), { counters: { charge: 4 } });
    const rhino = rhinoOf(s);
    const turn2 = applyOk(s, endTurn(P1), DEPS).state;
    expect(turn2.step.phase).toBe("player");
    const result = applyOk(
      turn2,
      { type: "basicAttack", playerId: P2, attackerInstanceId: identityOf(turn2, P2), targetInstanceId: rhino },
      DEPS,
    );
    expect(flat(result.events)).toEqual([]);
    expect(
      inst(settle(result.state, firstLegal, undefined, DEPS), rhino).damage - inst(turn2, rhino).damage,
    ).toBeGreaterThan(0);
  });

  it("from a Core hero's seat: Spider-Man's basic attack gets +2 per counter (ATK 1... read from the game)", () => {
    let s = coreSeatGame(CHARGED, CORE_STRENGTH, CORE_GENIUS);
    s = arrange(s, P1, { hand: [CHARGED], size: 1 });
    s = useOk(s, play(P1, playerOf(s, P1).hand[0]!, [], { attachToInstanceId: identityOf(s) }));
    const charged = inPlay(s, CHARGED);
    s = without(s, charged, { counters: { charge: 2 } });
    const rhino = rhinoOf(s);
    const plain = useOk(s, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(s),
      targetInstanceId: rhino,
    });
    // Declining (firstLegal) reads the unmodified ATK; accepting adds 4.
    const base = inst(plain, rhino).damage - inst(s, rhino).damage;
    const result = applyOk(
      s,
      { type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(s), targetInstanceId: rhino },
      DEPS,
    );
    const boosted = settle(result.state, picker({ take: [REF.interrupt] }), undefined, DEPS);
    expect(inst(boosted, rhino).damage - inst(s, rhino).damage).toBe(base + 4);
  });
});

describe("Bishop's Uniform (45005) and Energy Absorption", () => {
  const TAKE = [REF.uniform, "45001a.energy-absorption"];

  /** The Uniform in play on Bishop, hand and top of the deck arranged, damage already on Bishop. */
  function absorb(opts: {
    hand: readonly string[];
    top: readonly string[];
    boost: string;
    defend: boolean;
    damage?: number;
    take?: readonly string[];
    state?: GameState;
    seats?: readonly Seat[];
  }) {
    let s = playCard(opts.state ?? heroGame(opts.seats), UNIFORM, [STORED]);
    s = arrange(s, P1, { hand: opts.hand, top: opts.top });
    s = withDamage(s, identityOf(s), opts.damage ?? 5);
    const run = round(s, { boosts: [opts.boost], pick: picker({ take: opts.take ?? TAKE, defend: opts.defend }) });
    return { before: s, ...run, uniform: inPlay(s, UNIFORM) };
  }

  it("costs 2 and attaches to Bishop", () => {
    const s = playCard(heroGame(), UNIFORM, [STORED]);
    expect(inst(s, inPlay(s, UNIFORM)).exhausted).toBe(false);
    expect(discardOf(s)).toEqual([STORED]);
  });

  it("defended hit (1): Strength discarded and taken to hand; hand [Energy, Genius, Strength] = 3 resource cards: heals 3 (5+1-3 = 3), Uniform exhausted", () => {
    const { state, events, uniform } = absorb({
      hand: [ENERGY, GENIUS, SUPPORT, UPGRADE, EVENT_A],
      top: [STRENGTH, EVENT_B],
      boost: BOOST_0,
      defend: true,
    });
    expect(handOf(state)).toEqual([ENERGY, GENIUS, SUPPORT, UPGRADE, EVENT_A, STRENGTH]);
    expect(discardOf(state)).toEqual([]);
    expect(damageOf(state)).toBe(3);
    expect(inst(state, uniform).exhausted).toBe(true);
    expect(flat(events).filter((a) => a === REF.uniform)).toHaveLength(1);
  });

  it("2 damage (undefended): Genius and a Team Training discarded, Genius to hand; 1 resource card in hand: heals 1 (5+2-1 = 6)", () => {
    const { state, uniform } = absorb({
      hand: [SUPPORT, UPGRADE, EVENT_A, EVENT_B, EVENT_C],
      top: [SUPPORT, GENIUS, EVENT_B],
      boost: BOOST_0,
      defend: false,
    });
    expect(handOf(state)).toEqual([SUPPORT, UPGRADE, EVENT_A, EVENT_B, EVENT_C, GENIUS]);
    expect(discardOf(state)).toEqual([SUPPORT]);
    expect(damageOf(state)).toBe(6);
    expect(inst(state, uniform).exhausted).toBe(true);
  });

  it("4 damage, 3 resource cards among the 4 discarded and 1 in hand already: 4 in hand, heals 4 (5+4-4 = 5)", () => {
    const { state } = absorb({
      hand: [POWER, SUPPORT, UPGRADE, EVENT_A, EVENT_B],
      top: [ENERGY, STORED, EVENT_C, STRENGTH, SUPPORT],
      boost: BOOST_2,
      defend: false,
    });
    expect(damageOf(state)).toBe(5);
    expect(sorted(handOf(state))).toEqual(
      sorted([POWER, SUPPORT, UPGRADE, EVENT_A, EVENT_B, ENERGY, STORED, STRENGTH]),
    );
    expect(discardOf(state)).toEqual([EVENT_C]);
  });

  it("no resource card in hand or discarded: the Response is offered and may be used for 0 (exhausts, heals nothing)", () => {
    const { state, events, uniform } = absorb({
      hand: [SUPPORT, UPGRADE, EVENT_A, EVENT_B, EVENT_C],
      top: [SUPPORT],
      boost: BOOST_0,
      defend: true,
    });
    expect(flat(events)).toContain(REF.uniform);
    expect(damageOf(state)).toBe(6);
    expect(inst(state, uniform).exhausted).toBe(true);
  });

  it("declined: nothing healed, the Uniform stays ready (damage 5+1)", () => {
    const { state, events, uniform } = absorb({
      hand: [ENERGY, SUPPORT, UPGRADE, EVENT_A, EVENT_B],
      top: [STRENGTH],
      boost: BOOST_0,
      defend: true,
      take: ["45001a.energy-absorption"],
    });
    expect(flat(events)).toContain(REF.uniform);
    expect(damageOf(state)).toBe(6);
    expect(inst(state, uniform).exhausted).toBe(false);
    expect(handOf(state)).toContain(STRENGTH);
  });

  it("Energy Absorption declined: no moment, so the Uniform is never offered", () => {
    const { state, events, uniform } = absorb({
      hand: [ENERGY, SUPPORT, UPGRADE, EVENT_A, EVENT_B],
      top: [STRENGTH],
      boost: BOOST_0,
      defend: true,
      take: [REF.uniform],
    });
    expect(flat(events)).not.toContain(REF.uniform);
    expect(damageOf(state)).toBe(6);
    expect(inst(state, uniform).exhausted).toBe(false);
  });

  it("an attack stopped by a tough status card: no damage, no Energy Absorption, no Uniform", () => {
    const { state, events } = absorb({
      hand: [ENERGY, SUPPORT, UPGRADE, EVENT_A, EVENT_B],
      top: [STRENGTH],
      boost: BOOST_0,
      defend: false,
      damage: 5,
      state: (() => {
        const s = heroGame();
        return patchInstance(s, identityOf(s), { statuses: { ...inst(s, identityOf(s)).statuses, tough: 1 } });
      })(),
    });
    expect(flat(events)).not.toContain(REF.uniform);
    expect(damageOf(state)).toBe(5);
  });

  it("a Response, not an action: it cannot be used on its own", () => {
    const s = playCard(heroGame(), UNIFORM, [STORED]);
    expect(refused(s, use(P1, inPlay(s, UNIFORM), REF.uniform))).toBeTruthy();
  });

  it("exhausted by the first Energy Absorption, it is not offered after the second (a minion's attack) in the same phase", () => {
    let s = playCard(heroGame(["bishop"], [WEAPONS_RUNNER]), UNIFORM, [STORED]);
    s = withEngagedMinion(s, WEAPONS_RUNNER).state;
    s = arrange(s, P1, { hand: [ENERGY, SUPPORT, UPGRADE, EVENT_A, EVENT_B], top: [STRENGTH, GENIUS, EVENT_C] });
    s = withDamage(s, identityOf(s), 6);
    const run = round(s, { boosts: [BOOST_0, BOOST_0], pick: picker({ take: TAKE, defend: true }) });
    // Rhino's defended attack: 1 taken, Strength absorbed (hand: Energy and Strength), the Uniform heals 2 and exhausts.
    // Weapons Runner's attack then deals 1 (his Energy Absorption takes Genius): the exhausted Uniform is not offered again.
    expect(flat(run.events).filter((a) => a === REF.uniform)).toHaveLength(1);
    expect(flat(run.events).filter((a) => a === "45001a.energy-absorption")).toHaveLength(2);
    expect(inst(run.state, inPlay(run.state, UNIFORM)).exhausted).toBe(true);
    expect(damageOf(run.state)).toBe(6 + 1 - 2 + 1);
    expect(handOf(run.state)).toEqual([ENERGY, SUPPORT, UPGRADE, EVENT_A, EVENT_B, STRENGTH, GENIUS]);
  });

  it("2 players: 'your hand' is its controller's: the other player's 3 resource cards are not counted, his hand untouched", () => {
    let s = playCard(heroGame(["bishop", "spider"]), UNIFORM, [STORED], P1);
    s = arrange(s, P1, { hand: [ENERGY, SUPPORT, UPGRADE, EVENT_A, EVENT_B], top: [STRENGTH] });
    s = arrange(s, P2, { hand: [CORE_ENERGY, CORE_GENIUS, CORE_STRENGTH], size: 5, fillers: spiderFillers(s) });
    s = withDamage(s, identityOf(s, P1), 5);
    const p2Hand = handOf(s, P2);
    const run = round(s, { boosts: [BOOST_0, BOOST_0], pick: picker({ take: TAKE, takeFor: P1, defend: true }) });
    // 5 + 1, absorbed Strength: Energy and Strength in his hand = 2 resource cards: heals 2.
    expect(damageOf(run.state, P1)).toBe(4);
    expect(inst(run.state, inPlay(run.state, UNIFORM)).exhausted).toBe(true);
    expect(handOf(run.state, P2)).toEqual(p2Hand);
  });

  it("2 players: the other player's attack on his own identity (no Energy Absorption of his) never offers the Uniform", () => {
    let s = playCard(heroGame(["bishop", "spider"]), UNIFORM, [STORED], P1);
    s = arrange(s, P1, { hand: [ENERGY, SUPPORT, UPGRADE, EVENT_A, EVENT_B], top: [STRENGTH] });
    s = arrange(s, P2, { hand: [CORE_ENERGY], size: 5, fillers: spiderFillers(s) });
    s = withDamage(s, identityOf(s, P1), 5);
    const run = round(s, { boosts: [BOOST_0, BOOST_0], pick: picker({ take: TAKE, takeFor: P2, defend: true }) });
    // P1 was offered nothing (the picker answers for P2 only): he declined Energy Absorption, so no moment and no Uniform.
    expect(damageOf(run.state, P1)).toBe(6);
    expect(inst(run.state, inPlay(run.state, UNIFORM)).exhausted).toBe(false);
  });
});
