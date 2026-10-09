import { CORE_CARDS, NCRAWLER_CARDS, cardId, encounterSetId } from "@mc/content";
import {
  createGame,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../ability-refs.js";
import { coreScenario } from "../../core/setup.js";
import { mergeRegistries } from "../../dsl/index.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, playFromHand, withDamage, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { CRAZY_GANG } from "./crazy-gang.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Crazy Gang modular set (48033 The Crazy Gang, 48034 Queen of Hearts, 48035 Jester, 48036 Executioner, 48037
 * Tweedledope, 48038 "Off with His Head!"), docs/phase7-wave8.md section 7.4, 3.75, 3.81, Q44. Rhino (Core, standard)
 * built by `coreScenario` with the Nightcrawler cards in the pool and the set's six cards added to the encounter deck by
 * hand (the set is not in the modular pool). Cards are stacked on the encounter deck (the villain's boost card first,
 * then each player is dealt a card) and revealed by real `endTurn` commands.
 */
const GANG = "48033";
const QUEEN = "48034";
const JESTER = "48035";
const EXECUTIONER = "48036";
const TWEEDLEDOPE = "48037";
const OFF = "48038";
const ALL = [GANG, QUEEN, JESTER, EXECUTIONER, TWEEDLEDOPE, OFF];
const ADVANCE = "01186"; // Advance, 0 boost icons
const HYDRA_MERC = "01101"; // non-Elite minion, 3 hit points
const RADIOACTIVE_MAN = "01129"; // Elite minion, SCH 1 (not in Rhino's deck: a revealed Hydra Mercenary is relabeled)
const BOOSTS = [ADVANCE, "01187"]; // Advance, Assault: 0 boost icons, no boost ability
const FILLER = "01098"; // Armored Rhino Suit, an attachment: nothing happens when it is revealed and it never surges
const AUNT_MAY = "01006"; // support, cost 1
const WEB_SHOOTER = "01008"; // upgrade, cost 1, attaches to the hero
const JESSICA_JONES = "01059"; // ally, cost 3, 3 hit points

const REFS = [
  "48033.the-crazy-gang-forced-response",
  "48034.when-revealed",
  "48035.when-revealed",
  "48036.when-revealed",
  "48037.when-revealed",
  "48038.when-revealed",
];

const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, CRAZY_GANG) };
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
const SET = NCRAWLER_CARDS.filter(
  (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("crazy_gang")),
);

function setupGame(players: readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL)[] = [SPIDER_MAN]): GameState {
  const config = coreScenario("rhino", {
    players,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...NCRAWLER_CARDS],
  });
  const copies = SET.flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  // A deck of the set, inert fillers and boost cards: nothing random is revealed, whatever surges or is dealt extra.
  const repeat = (code: string, n: number) => Array.from({ length: n }, () => cardId(code));
  const encounterDeck = [
    ...copies,
    ...repeat(FILLER, 24),
    ...repeat(HYDRA_MERC, 2),
    ...repeat(BOOSTS[0]!, 8),
    ...repeat(BOOSTS[1]!, 8),
  ];
  const created = createGame({ ...config, encounterDeck }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  // Headroom on the main scheme (a negative count, surgery): the villain phases here scheme and accelerate.
  return patchInstance(settled, settled.mainScheme.instanceId, { threat: -30 });
}
const heroGame = (players?: Parameters<typeof setupGame>[0]): GameState => {
  const s = setupGame(players);
  return s.players.reduce((acc, p) => withForm(acc, { heroForm: 0 }, p.playerId), s);
};

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const piles = (s: GameState) => Object.values(s.encounterDecks)[0]!;
const inDiscard = (s: GameState, code: string) => piles(s).discard.filter((id) => codeOf(s, id) === code);
const inDeck = (s: GameState, code: string) => piles(s).deck.filter((id) => codeOf(s, id) === code);
const removed = (s: GameState, code: string) => s.removedFromGame.filter((id) => codeOf(s, id) === code);
const inVillainArea = (s: GameState, code: string) => s.villainArea.filter((id) => codeOf(s, id) === code);
const everyInstance = (s: GameState) => Object.keys(s.instances) as InstanceId[];
/** Copies of a card that exist as a minion engaged with a player. */
const minionsOf = (s: GameState, code: string): InstanceId[] =>
  everyInstance(s).filter((id) => codeOf(s, id) === code && inst(s, id).engagedWith !== null);
/** Copies of a card in play outside the villain area and hands: a support or upgrade a player controls. */
const inPlay = (s: GameState, code: string): InstanceId[] =>
  everyInstance(s).filter((id) => {
    if (codeOf(s, id) !== code) return false;
    return s.players.some((p) => !p.hand.includes(id) && !p.deck.includes(id) && !p.discard.includes(id));
  });
const status = (s: GameState, p: PlayerId, name: "stunned" | "confused") =>
  inst(s, identityOf(s, p)).statuses[name] ?? 0;
const dataOf = (code: string) =>
  NCRAWLER_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, any>;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}
/** Every player ends their turn and the villain phase runs; `reveals` are dealt after the villain's boost card. */
function round(state: GameState, opts: { reveals?: readonly string[]; pick?: Picker } = {}): Run {
  // One boost card per activation: the villain activates once against each player.
  const stacked = stackEncounterDeck(state, ...BOOSTS.slice(0, state.players.length), ...(opts.reveals ?? []));
  const first = state.step.phase === "player" && state.step.kind === "turn" ? state.step.activePlayerId : P1;
  const ids = state.players.map((p) => p.playerId);
  const order = [...ids.slice(ids.indexOf(first)), ...ids.slice(0, ids.indexOf(first))];
  return driveEventsPicking(DEPS, stacked, opts.pick ?? firstLegal, ...order.map((id) => endTurn(id)));
}
/** The cards dealt to each player this round, put in the order of the current first player. */
const dealt = (state: GameState, byPlayer: Readonly<Record<string, string>>): string[] => {
  const ids = state.players.map((p) => p.playerId as string);
  const at = ids.indexOf(state.firstPlayerId as string);
  return [...ids.slice(at), ...ids.slice(0, at)].map((id) => byPlayer[id] ?? FILLER);
};
/** A fresh round: every identity healed, the main scheme given headroom again. */
const fresh = (s: GameState): GameState =>
  patchInstance(
    s.players.reduce((acc, p) => patchInstance(acc, identityOf(acc, p.playerId), { damage: 0 }), s),
    s.mainScheme.instanceId,
    { threat: -30 },
  );
const schemes = (r: Run, enemy: InstanceId) =>
  ofType(r.events, "schemeResolved").filter((e) => e.enemyInstanceId === enemy).length;

describe("registry", () => {
  it("registers the six refs, each a valid definition", () => {
    expect(Object.keys(CRAZY_GANG).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(CRAZY_GANG)) expect(validateDefinition(def), id).toEqual([]);
  });

  it("every ref of the six cards is registered", () => {
    expect(SET.flatMap(abilityRefIds).filter((r) => !(r in CRAZY_GANG))).toEqual([]);
    expect(SET.map((c) => c.id as string).sort()).toEqual([...ALL].sort());
  });

  it("the set's six cards are in the encounter deck of a game that asked for it", () => {
    const s = setupGame();
    expect(ALL.map((c) => inDeck(s, c).length)).toEqual([1, 1, 1, 1, 1, 1]);
  });
});

describe("card data", () => {
  it("the four minions are unique, SCH 0, with the printed ATK / hit points / boost icons (Tweedledope 1, no star: Q44 = B)", () => {
    const row = (code: string) => {
      const c = dataOf(code);
      return [c.type, c.unique, c.sch, c.atk, c.hp, c.boostIcons, c.starIcon ?? false];
    };
    expect(row(QUEEN)).toEqual(["minion", true, 0, 1, 4, 3, false]);
    expect(row(JESTER)).toEqual(["minion", true, 0, 1, 5, 1, false]);
    expect(row(EXECUTIONER)).toEqual(["minion", true, 0, 2, 4, 2, false]);
    expect(row(TWEEDLEDOPE)).toEqual(["minion", true, 0, 2, 6, 1, false]);
  });
  it("The Crazy Gang: a side scheme of 2 threat per player with an acceleration icon; the treachery has 1 boost icon", () => {
    const c = dataOf(GANG);
    expect([c.type, c.startingThreat, c.icons, c.boostIcons]).toEqual([
      "side_scheme",
      { base: 0, perPlayer: 2 },
      ["acceleration"],
      2,
    ]);
    expect([dataOf(OFF).type, dataOf(OFF).boostIcons]).toEqual(["treachery", 1]);
  });
});

/** Rounds that bring a minion and then The Crazy Gang into play (one card is dealt to each player per round). */
function gangInPlay(state: GameState, minion = HYDRA_MERC, deal: readonly string[][] = [[minion], [GANG]]): GameState {
  return deal.reduce(
    (acc, reveals, n) => (n === 0 ? round(acc, { reveals }).state : round(fresh(acc), { reveals }).state),
    state,
  );
}

describe("The Crazy Gang (48033)", () => {
  it("solo: a minion that schemes against its alter-ego player is dealt facedown and revealed again, healed", () => {
    const base = gangInPlay(setupGame());
    expect(inVillainArea(base, GANG)).toHaveLength(1);
    const merc = minionsOf(base, HYDRA_MERC)[0]!;
    const r = round(withDamage(fresh(base), merc, 2), { reveals: [FILLER] });
    expect(schemes(r, merc)).toBe(1);
    const after = minionsOf(r.state, HYDRA_MERC);
    expect(after).toHaveLength(1);
    expect(inst(r.state, after[0]!).engagedWith).toBe(P1);
    expect(inst(r.state, after[0]!).damage).toBe(0);
  });

  it("without the side scheme in play the minion just stays where it is, damaged", () => {
    const base = round(setupGame(), { reveals: [HYDRA_MERC] });
    const merc = minionsOf(base.state, HYDRA_MERC)[0]!;
    const r = round(withDamage(fresh(base.state), merc, 2), { reveals: [FILLER] });
    expect(minionsOf(r.state, HYDRA_MERC)).toEqual([merc]);
    expect(inst(r.state, merc).damage).toBe(2);
  });

  it("two players: the dealt minion is passed to the next player and comes back engaged with them", () => {
    const s0 = withForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), { heroForm: 0 }, P2);
    const one = round(s0, { reveals: dealt(s0, { p1: HYDRA_MERC, p2: FILLER }) });
    const two = fresh(one.state);
    const base = round(two, { reveals: dealt(two, { p1: GANG, p2: FILLER }) });
    expect(inVillainArea(base.state, GANG)).toHaveLength(1);
    const merc = minionsOf(base.state, HYDRA_MERC)[0]!;
    expect(inst(base.state, merc).engagedWith).toBe(P1);
    const three = withDamage(fresh(base.state), merc, 2);
    const r = round(three, { reveals: dealt(three, {}) });
    const after = minionsOf(r.state, HYDRA_MERC);
    expect(after).toHaveLength(1);
    expect(inst(r.state, after[0]!).engagedWith).toBe(P2);
    expect(inst(r.state, after[0]!).damage).toBe(0);
  });

  it("an Elite minion that schemes is not dealt", () => {
    const base = gangInPlay(setupGame());
    const elite = minionsOf(base, HYDRA_MERC)[0]!;
    const relabeled = patchInstance(base, elite, { cardId: cardId(RADIOACTIVE_MAN) });
    const r = round(withDamage(fresh(relabeled), elite, 2), { reveals: [FILLER] });
    expect(schemes(r, elite)).toBe(1);
    expect(minionsOf(r.state, RADIOACTIVE_MAN)).toEqual([elite]);
    expect(inst(r.state, elite).damage).toBe(2);
  });

  it("a minion that attacks (hero form) is not dealt", () => {
    const base = gangInPlay(heroGame());
    const merc = minionsOf(base, HYDRA_MERC)[0]!;
    const r = round(withDamage(fresh(base), merc, 2), { reveals: [FILLER] });
    expect(minionsOf(r.state, HYDRA_MERC)).toEqual([merc]);
    expect(inst(r.state, merc).damage).toBe(2);
  });
});

describe("Queen of Hearts (48034)", () => {
  it("WHEN_REVEALED: finds The Crazy Gang in the encounter deck and reveals it", () => {
    const r = round(setupGame(), { reveals: [QUEEN] });
    expect(inVillainArea(r.state, GANG)).toHaveLength(1);
    expect(inDeck(r.state, GANG)).toHaveLength(0);
    expect(inst(r.state, minionsOf(r.state, QUEEN)[0]!).engagedWith).toBe(P1);
  });

  it("WHEN_REVEALED: finds it in the discard pile as well", () => {
    const s0 = setupGame();
    const gang = inDeck(s0, GANG)[0]!;
    const deckId = Object.keys(s0.encounterDecks)[0]!;
    const pile = s0.encounterDecks[deckId]!;
    const s: GameState = {
      ...s0,
      encounterDecks: {
        ...s0.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== gang), discard: [gang, ...pile.discard] },
      },
    };
    const r = round(s, { reveals: [QUEEN] });
    expect(inVillainArea(r.state, GANG)).toHaveLength(1);
    expect(inDiscard(r.state, GANG)).toHaveLength(0);
  });

  it("WHEN_REVEALED: with The Crazy Gang already in play, deals herself a facedown encounter card, revealed this phase", () => {
    const base = round(setupGame(), { reveals: [GANG] });
    expect(inVillainArea(base.state, GANG)).toHaveLength(1);
    const r = round(fresh(base.state), { reveals: [QUEEN, HYDRA_MERC] });
    expect(minionsOf(r.state, QUEEN)).toHaveLength(1);
    expect(minionsOf(r.state, HYDRA_MERC)).toHaveLength(1);
    expect(inVillainArea(r.state, GANG)).toHaveLength(1);
  });
});

describe("Jester (48035)", () => {
  it("WHEN_REVEALED: you are confused", () => {
    const r = round(setupGame(), { reveals: [JESTER] });
    expect(status(r.state, P1, "confused")).toBe(1);
  });

  it("WHEN_REVEALED: already confused, you discard a support you control and stay confused", () => {
    const staged = playFromHand(DEPS, setupGame(), AUNT_MAY, 1);
    expect(inPlay(staged.state, AUNT_MAY)).toHaveLength(1);
    const s = patchInstance(staged.state, identityOf(staged.state, P1), {
      statuses: { stunned: 0, confused: 1, tough: 0 },
    });
    const r = round(s, { reveals: [JESTER] });
    expect(inPlay(r.state, AUNT_MAY)).toHaveLength(0);
    expect(status(r.state, P1, "confused")).toBe(1);
  });

  it("WHEN_REVEALED: not already confused, a support is not discarded", () => {
    const staged = playFromHand(DEPS, setupGame(), AUNT_MAY, 1);
    const r = round(staged.state, { reveals: [JESTER] });
    expect(inPlay(r.state, AUNT_MAY)).toHaveLength(1);
    expect(status(r.state, P1, "confused")).toBe(1);
  });

  it("WHEN_REVEALED: already confused with no support, nothing is discarded", () => {
    const s = patchInstance(setupGame(), identityOf(setupGame(), P1), {
      statuses: { stunned: 0, confused: 1, tough: 0 },
    });
    expect(status(round(s, { reveals: [JESTER] }).state, P1, "confused")).toBe(1);
  });
});

describe("Tweedledope (48037)", () => {
  it("WHEN_REVEALED: you are stunned", () => {
    const r = round(setupGame(), { reveals: [TWEEDLEDOPE] });
    expect(status(r.state, P1, "stunned")).toBe(1);
  });

  it("WHEN_REVEALED: already stunned, you discard an upgrade you control", () => {
    const staged = playFromHand(DEPS, setupGame(), WEB_SHOOTER, 1);
    expect(inPlay(staged.state, WEB_SHOOTER)).toHaveLength(1);
    const s = patchInstance(staged.state, identityOf(staged.state, P1), {
      statuses: { stunned: 1, confused: 0, tough: 0 },
    });
    const r = round(s, { reveals: [TWEEDLEDOPE] });
    expect(inPlay(r.state, WEB_SHOOTER)).toHaveLength(0);
    expect(status(r.state, P1, "stunned")).toBe(1);
  });

  it("WHEN_REVEALED: not already stunned, an upgrade is not discarded", () => {
    const staged = playFromHand(DEPS, setupGame(), WEB_SHOOTER, 1);
    const r = round(staged.state, { reveals: [TWEEDLEDOPE] });
    expect(inPlay(r.state, WEB_SHOOTER)).toHaveLength(1);
    expect(status(r.state, P1, "stunned")).toBe(1);
  });
});

describe("Executioner (48036)", () => {
  const identityDamage = (r: Run, p: PlayerId) => inst(r.state, identityOf(r.state, p)).damage;

  it("WHEN_REVEALED: attacks the friendly character with the fewest remaining hit points: a damaged ally over a healthy identity", () => {
    const ally = playFromHand(DEPS, heroGame(), JESSICA_JONES, 3);
    const hurt = withDamage(ally.state, ally.id, 1);
    const baseline = round(hurt, { reveals: [FILLER] });
    const r = round(hurt, { reveals: [EXECUTIONER] });
    expect(identityDamage(r, P1)).toBe(identityDamage(baseline, P1));
    expect(removed(r.state, JESSICA_JONES)).toEqual([ally.id]);
  });

  it("WHEN_REVEALED: an ally this attack defeats is removed from the game, not discarded", () => {
    const ally = playFromHand(DEPS, heroGame(), JESSICA_JONES, 3);
    const r = round(withDamage(ally.state, ally.id, 1), { reveals: [EXECUTIONER] });
    expect(removed(r.state, JESSICA_JONES)).toHaveLength(1);
    expect(r.state.players[0]!.discard.filter((id) => codeOf(r.state, id) === JESSICA_JONES)).toEqual([]);
  });

  it("WHEN_REVEALED: an ally that survives the attack stays in play damaged", () => {
    const ally = playFromHand(DEPS, heroGame(), JESSICA_JONES, 3);
    // The ally (3 hit points) has fewer remaining than the identity (10) and lives through ATK 2.
    const r = round(ally.state, { reveals: [EXECUTIONER] });
    expect(removed(r.state, JESSICA_JONES)).toEqual([]);
    expect(inst(r.state, ally.id).damage).toBe(2);
  });

  it("WHEN_REVEALED: with only identities, attacks the one with the fewest remaining hit points, across players", () => {
    const s0 = heroGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const s = withDamage(s0, identityOf(s0, P2), 3);
    const baseline = round(s, { reveals: dealt(s, { p1: FILLER, p2: FILLER }) });
    const r = round(s, { reveals: dealt(s, { p1: EXECUTIONER, p2: FILLER }) });
    expect(identityDamage(r, P2)).toBe(identityDamage(baseline, P2) + 2);
    expect(identityDamage(r, P1)).toBe(identityDamage(baseline, P1));
  });
});

describe('"Off with His Head!" (48038)', () => {
  it("WHEN_REVEALED: each minion activates against the player it is engaged with: a scheme in alter-ego form", () => {
    const base = round(setupGame(), { reveals: [HYDRA_MERC] });
    const merc = minionsOf(base.state, HYDRA_MERC)[0]!;
    const control = round(fresh(base.state), { reveals: [FILLER] });
    const r = round(fresh(base.state), { reveals: [OFF] });
    expect(schemes(control, merc)).toBe(1);
    expect(schemes(r, merc)).toBe(2);
  });

  it("WHEN_REVEALED: in hero form the minion attacks instead", () => {
    const base = round(heroGame(), { reveals: [HYDRA_MERC] });
    const merc = minionsOf(base.state, HYDRA_MERC)[0]!;
    const attacks = (r: Run) => ofType(r.events, "attackResolved").filter((e) => e.enemyInstanceId === merc).length;
    const control = round(fresh(base.state), { reveals: [FILLER] });
    const r = round(fresh(base.state), { reveals: [OFF] });
    expect(attacks(r)).toBe(attacks(control) + 1);
  });

  it("WHEN_REVEALED: with no minion in play, discards from the encounter deck until a minion is discarded and reveals it", () => {
    const r = round(setupGame(), { reveals: [OFF, FILLER, HYDRA_MERC] });
    expect(minionsOf(r.state, HYDRA_MERC)).toHaveLength(1);
    expect(inst(r.state, minionsOf(r.state, HYDRA_MERC)[0]!).engagedWith).toBe(P1);
    expect(inDiscard(r.state, FILLER).length).toBeGreaterThanOrEqual(1);
  });

  it("WHEN_REVEALED: with a minion in play, nothing is discarded or revealed from the deck", () => {
    const base = round(setupGame(), { reveals: [HYDRA_MERC] });
    const r = round(fresh(base.state), { reveals: [OFF, FILLER, QUEEN] });
    expect(minionsOf(r.state, QUEEN)).toHaveLength(0);
    expect(inDeck(r.state, QUEEN)).toHaveLength(1);
  });
});
