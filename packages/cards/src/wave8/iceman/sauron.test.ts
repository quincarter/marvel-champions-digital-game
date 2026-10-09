import { CORE_CARDS, ICEMAN_CARDS, cardId, encounterSetId } from "@mc/content";
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
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, withDamage, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { SAURON, SAURON_SKIPPED } from "./sauron.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Sauron modular set (46029 Sauron, 46030 Sauron Lives!, 46031 Life Drain, 46032 The Eye of Sauron x3),
 * docs/phase7-wave8.md section 7.2, 3.70. Rhino (Core, standard) with Spider-Man (justice) built by `coreScenario`; the
 * set's six cards are added to the encounter deck by hand (the set is not in the modular pool). Cards are stacked on
 * the encounter deck (the villain's boost card is drawn first, then each player is dealt a card) and revealed by real
 * `endTurn` commands. Spider-Man: hero ATK 2, alter-ego REC 3, 10 hit points; Rhino: ATK 2, SCH 1.
 * The Eye's deck discards are tested by relabeling the top cards of the deck (surgery) with Core cards printing known
 * icons.
 */
const SAURON_CODE = "46029";
const LIVES = "46030";
const LIFE_DRAIN = "46031";
const EYE = "46032";
const BOOST_NONE = "01186"; // Advance, 0 boost icons
const HYDRA_MERC = "01101"; // minion, 3 hit points

const REFS = [
  "46029.when-revealed",
  "46029.boost",
  "46030.when-defeated",
  "46031.life-drain-constant",
  "46031.life-drain-forced-interrupt",
  "46032.when-revealed",
];

const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, SAURON) };
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
const SET = ICEMAN_CARDS.filter((c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("sauron")));

function setupGame(players: readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL)[] = [SPIDER_MAN]): GameState {
  const config = coreScenario("rhino", {
    players,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...ICEMAN_CARDS],
  });
  const copies = SET.flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  // Headroom on the main scheme (a negative count, surgery): the villain phases here scheme and accelerate.
  return patchInstance(settled, settled.mainScheme.instanceId, { threat: -30 });
}
/** Every player in hero form (staging, not a rule). */
const heroGame = (players?: Parameters<typeof setupGame>[0]): GameState => {
  const s = setupGame(players);
  return s.players.reduce((acc, p) => withForm(acc, { heroForm: 0 }, p.playerId), s);
};

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const piles = (s: GameState) => Object.values(s.encounterDecks)[0]!;
const inDeck = (s: GameState, code: string) => piles(s).deck.filter((id) => codeOf(s, id) === code);
const inDiscard = (s: GameState, code: string) => piles(s).discard.filter((id) => codeOf(s, id) === code);
const inVillainArea = (s: GameState, code: string) => s.villainArea.filter((id) => codeOf(s, id) === code);
/** Copies of a card that exist as a minion engaged with a player. */
const minionsOf = (s: GameState, code: string): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((id) => codeOf(s, id) === code && inst(s, id).engagedWith !== null);
const attachedTo = (s: GameState, host: InstanceId, code: string): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((id) => codeOf(s, id) === code && inst(s, id).attachedTo === host);
/** Every identity healed and the main scheme given headroom again (staging between two villain phases). */
const fresh = (s: GameState): GameState =>
  patchInstance(
    s.players.reduce((acc, p) => patchInstance(acc, identityOf(acc, p.playerId), { damage: 0 }), s),
    s.mainScheme.instanceId,
    { threat: -30 },
  );
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const tough = (s: GameState, id: InstanceId): number => inst(s, id).statuses.tough ?? 0;
const exhausted = (s: GameState, id: InstanceId): boolean => inst(s, id).exhausted;
const dataOf = (code: string) => ICEMAN_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, any>;

const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}
const run = (state: GameState, pick: Picker, ...commands: Parameters<typeof driveEventsPicking>[3][]): Run =>
  driveEventsPicking(DEPS, state, pick, ...commands);

/**
 * Every player ends their turn and the villain phase runs. `boosts` are the villain's boost cards (one per activation,
 * Advance by default), `reveals` the cards dealt after them: the first player first.
 */
function round(
  state: GameState,
  opts: { boosts?: readonly string[]; reveals?: readonly string[]; pick?: Picker } = {},
): Run {
  const boosts = opts.boosts ?? [BOOST_NONE];
  const stacked = stackEncounterDeck(state, ...boosts, ...(opts.reveals ?? []));
  const first = state.step.phase === "player" && state.step.kind === "turn" ? state.step.activePlayerId : P1;
  const ids = state.players.map((p) => p.playerId);
  const order = [...ids.slice(ids.indexOf(first)), ...ids.slice(0, ids.indexOf(first))];
  return run(stacked, opts.pick ?? firstLegal, ...order.map((id) => endTurn(id)));
}

/** A fixture card (Core) printing exactly these icons, to relabel the top of a deck with. */
const fixture = (icons: Record<string, number>): string => {
  const hit = (CORE_CARDS as readonly any[]).find((c) => {
    const printed = c.resourceIcons ?? c.producesIcons;
    return printed && JSON.stringify(printed) === JSON.stringify(icons);
  });
  if (!hit) throw new Error(`no core card prints ${JSON.stringify(icons)}`);
  return hit.id as string;
};
const NONE_ICON = BOOST_NONE; // Advance prints no resource icon
const E1 = fixture({ energy: 1 });
const E2 = fixture({ energy: 2 });
const M1 = fixture({ mental: 1 });
const P1_ICON = fixture({ physical: 1 });
const W1 = fixture({ wild: 1 });

/** Relabels the top cards of `p`'s deck as these codes, in order, so the Eye discards known icons. */
function relabelTop(s: GameState, codes: readonly string[], p: PlayerId = P1): GameState {
  return codes.reduce((acc, code, n) => patchInstance(acc, playerOf(acc, p).deck[n]!, { cardId: cardId(code) }), s);
}
/** The same round with an inert card (Sauron Lives!, a side scheme) revealed in the Eye's place: the baseline. */
const baseline = (top: readonly string[], state?: GameState): Run =>
  round(relabelTop(state ?? heroGame(), top), { reveals: [LIVES] });
/** The Eye revealed to the first player with `top` as the top of their deck; hero form. */
function eye(top: readonly string[], opts: { state?: GameState; pick?: Picker } = {}): Run & { before: GameState } {
  const before = relabelTop(opts.state ?? heroGame(), top);
  return { ...round(before, { reveals: [EYE], ...(opts.pick ? { pick: opts.pick } : {}) }), before };
}

describe("registry", () => {
  it("registers the six live refs of the four cards, each a valid definition", () => {
    expect(Object.keys(SAURON).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(SAURON)) expect(validateDefinition(def), id).toEqual([]);
  });

  it("every ref of the four cards is registered or skipped with a reason, and none is both", () => {
    const refs = SET.flatMap(abilityRefIds);
    expect(refs.filter((r) => !(r in SAURON) && !(r in SAURON_SKIPPED))).toEqual([]);
    expect(Object.keys(SAURON_SKIPPED).filter((r) => r in SAURON)).toEqual([]);
    for (const reason of Object.values(SAURON_SKIPPED)) expect(reason.length).toBeGreaterThan(10);
  });

  it("The Eye of Sauron lists only its When Revealed, so nothing is skipped", () => {
    expect(Object.keys(SAURON_SKIPPED)).toEqual([]);
    expect(abilityRefIds(SET.find((c) => String(c.id) === EYE)!)).toEqual(["46032.when-revealed"]);
  });

  it("the set's six cards are in the encounter deck of a game that asked for it", () => {
    const s = setupGame();
    expect([SAURON_CODE, LIVES, LIFE_DRAIN].map((c) => inDeck(s, c).length)).toEqual([1, 1, 1]);
    expect(inDeck(s, EYE)).toHaveLength(3);
  });
});

describe("card data (the scans were not available to check against)", () => {
  it("Sauron: a unique BROTHERHOOD OF MUTANTS minion, SCH 2, ATK 2, 6 hit points, a boost star and no boost icon", () => {
    const c = dataOf(SAURON_CODE);
    expect([c.type, c.sch, c.atk, c.hp, c.boostIcons, c.unique, c.starIcon]).toEqual([
      "minion",
      2,
      2,
      6,
      0,
      true,
      true,
    ]);
  });
  it("Sauron Lives!: a side scheme with 3 threat regardless of players, a crisis icon and 3 boost icons", () => {
    const c = dataOf(LIVES);
    expect([c.type, c.startingThreat, c.icons, c.boostIcons]).toEqual([
      "side_scheme",
      { base: 3, perPlayer: 0 },
      ["crisis"],
      3,
    ]);
  });
  it("Life Drain: an attachment to the minion with the highest printed hit points, 2 boost icons", () => {
    const c = dataOf(LIFE_DRAIN);
    expect([c.type, c.attachesTo, c.boostIcons]).toEqual(["attachment", { kind: "minionWithHighestPrintedHp" }, 2]);
  });
  it("The Eye of Sauron: three copies, a treachery with 1 boost icon", () => {
    const c = dataOf(EYE);
    expect([c.type, c.quantityInSet, c.boostIcons]).toEqual(["treachery", 3, 1]);
  });
});

describe("Sauron (46029)", () => {
  it("WHEN_REVEALED: finds Life Drain in the encounter deck, reveals it and it attaches to Sauron (the only minion)", () => {
    const r = round(heroGame(), { reveals: [SAURON_CODE] });
    const sauron = minionsOf(r.state, SAURON_CODE);
    expect(sauron).toHaveLength(1);
    expect(inst(r.state, sauron[0]!).engagedWith).toBe(P1);
    expect(attachedTo(r.state, sauron[0]!, LIFE_DRAIN)).toHaveLength(1);
    expect(inDeck(r.state, LIFE_DRAIN)).toHaveLength(0);
  });

  it("WHEN_REVEALED: finds Life Drain in the encounter discard pile as well", () => {
    const s0 = heroGame();
    const drain = inDeck(s0, LIFE_DRAIN)[0]!;
    const deckId = Object.keys(s0.encounterDecks)[0]!;
    const pile = s0.encounterDecks[deckId]!;
    const s: GameState = {
      ...s0,
      encounterDecks: {
        ...s0.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== drain), discard: [drain, ...pile.discard] },
      },
    };
    const r = round(s, { reveals: [SAURON_CODE] });
    expect(attachedTo(r.state, minionsOf(r.state, SAURON_CODE)[0]!, LIFE_DRAIN)).toHaveLength(1);
    expect(inDiscard(r.state, LIFE_DRAIN)).toHaveLength(0);
  });

  it("WHEN_REVEALED: with no Life Drain to find, Sauron just comes into play", () => {
    const s0 = heroGame();
    const drain = inDeck(s0, LIFE_DRAIN)[0]!;
    const deckId = Object.keys(s0.encounterDecks)[0]!;
    const pile = s0.encounterDecks[deckId]!;
    const s: GameState = {
      ...s0,
      encounterDecks: { ...s0.encounterDecks, [deckId]: { ...pile, deck: pile.deck.filter((i) => i !== drain) } },
    };
    const r = round(s, { reveals: [SAURON_CODE] });
    expect(minionsOf(r.state, SAURON_CODE)).toHaveLength(1);
    expect(attachedTo(r.state, minionsOf(r.state, SAURON_CODE)[0]!, LIFE_DRAIN)).toHaveLength(0);
  });

  it("BOOST: heals 3 from the activating enemy and gives it a tough status card; discarded, no icons", () => {
    const s0 = setupGame();
    const rhino = s0.villains[0]!.instanceId;
    const hurt = withDamage(s0, rhino, 5);
    const r = round(hurt, { boosts: [SAURON_CODE], reveals: [] });
    expect(damageOf(r.state, rhino)).toBe(2);
    expect(tough(r.state, rhino)).toBe(1);
    expect(inDiscard(r.state, SAURON_CODE)).toHaveLength(1);
    expect(minionsOf(r.state, SAURON_CODE)).toHaveLength(0);
  });

  it("BOOST: heals only the damage there is (2 of 3) and still gives the tough card", () => {
    const s0 = setupGame();
    const rhino = s0.villains[0]!.instanceId;
    const r = round(withDamage(s0, rhino, 2), { boosts: [SAURON_CODE], reveals: [] });
    expect(damageOf(r.state, rhino)).toBe(0);
    expect(tough(r.state, rhino)).toBe(1);
  });

  it("BOOST: adds no threat (0 boost icons) in the villain's scheme", () => {
    const s = setupGame();
    const base = round(s, { boosts: [BOOST_NONE], reveals: [] });
    const withSauron = round(s, { boosts: [SAURON_CODE], reveals: [] });
    expect(mainThreat(withSauron.state)).toBe(mainThreat(base.state));
  });
});

describe("Life Drain (46031)", () => {
  it("REVEALED: a lone lesser minion (3 hit points) is the host", () => {
    const base = round(heroGame(), { reveals: [HYDRA_MERC] });
    const next = round(fresh(base.state), { reveals: [LIFE_DRAIN] });
    expect(attachedTo(next.state, minionsOf(base.state, HYDRA_MERC)[0]!, LIFE_DRAIN)).toHaveLength(1);
  });

  it("REVEALED: Sauron (6 printed hit points) comes in beside a 3-hit-point minion and the Life Drain he finds goes to him", () => {
    const base = round(heroGame(), { reveals: [HYDRA_MERC] });
    const next = round(fresh(base.state), { reveals: [SAURON_CODE] });
    const merc = minionsOf(next.state, HYDRA_MERC)[0]!;
    const sauron = minionsOf(next.state, SAURON_CODE)[0]!;
    expect(attachedTo(next.state, sauron, LIFE_DRAIN)).toHaveLength(1);
    expect(attachedTo(next.state, merc, LIFE_DRAIN)).toHaveLength(0);
  });

  const activations = (r: Run, enemy: InstanceId, kind: "attack" | "scheme") =>
    ofType(r.events, kind === "attack" ? "attackResolved" : "schemeResolved").filter((e) => e.enemyInstanceId === enemy)
      .length;

  it("REVEALED: the host activates against the revealer in hero form: a second attack in the same villain phase", () => {
    const base = round(heroGame(), { reveals: [HYDRA_MERC] });
    const merc = minionsOf(base.state, HYDRA_MERC)[0]!;
    const calm = patchInstance(base.state, base.state.mainScheme.instanceId, { threat: -30 });
    const control = round(calm, { reveals: [LIVES] });
    const drained = round(calm, { reveals: [LIFE_DRAIN] });
    expect(activations(control, merc, "attack")).toBe(1);
    expect(activations(drained, merc, "attack")).toBe(2);
    expect(attachedTo(drained.state, merc, LIFE_DRAIN)).toHaveLength(1);
  });

  it("REVEALED: against a player in alter-ego form the host schemes instead of attacking", () => {
    const base = round(setupGame(), { reveals: [HYDRA_MERC] });
    const merc = minionsOf(base.state, HYDRA_MERC)[0]!;
    const calm = patchInstance(base.state, base.state.mainScheme.instanceId, { threat: -30 });
    const control = round(calm, { reveals: [LIVES] });
    const drained = round(calm, { reveals: [LIFE_DRAIN] });
    expect(activations(control, merc, "scheme")).toBe(1);
    expect(activations(drained, merc, "scheme")).toBe(2);
    expect(activations(drained, merc, "attack")).toBe(0);
  });

  it("REVEALED: with no minion in play it is discarded and gains surge: the next card is revealed", () => {
    const r = round(heroGame(), { reveals: [LIFE_DRAIN, LIVES] });
    expect(inVillainArea(r.state, LIVES)).toHaveLength(1);
    expect(attachedTo(r.state, r.state.villains[0]!.instanceId, LIFE_DRAIN)).toHaveLength(0);
  });

  it("REVEALED: with a minion to activate it does not gain surge: the next card stays in the deck", () => {
    const base = round(heroGame(), { reveals: [HYDRA_MERC] });
    const r = round(base.state, { reveals: [LIFE_DRAIN, LIVES] });
    expect(inVillainArea(r.state, LIVES)).toHaveLength(0);
    expect(inDeck(r.state, LIVES)).toHaveLength(1);
  });

  it("FORCED_INTERRUPT: when the host attacks you, you take 2 damage (from Life Drain) and it gets a tough status card", () => {
    const first = round(heroGame(), { reveals: [SAURON_CODE] });
    const sauron = minionsOf(first.state, SAURON_CODE)[0]!;
    const drain = attachedTo(first.state, sauron, LIFE_DRAIN)[0]!;
    // Sauron's own reveal activation: his Life Drain was just attached to him and he attacked, so it fired already.
    expect(tough(first.state, sauron)).toBe(1);
    const ready = patchInstance(fresh(first.state), sauron, { statuses: { stunned: 0, confused: 0, tough: 0 } });
    const second = round(ready, { reveals: [LIVES] });
    const identity = identityOf(second.state, P1);
    // Rhino 2, Sauron 2 (his attack, ATK 2 and no boost icon), Life Drain 2: 6 damage in all.
    expect(damageOf(second.state, identity)).toBe(6);
    expect(ofType(second.events, "damageDealt").filter((e) => e.sourceInstanceId === drain)).toEqual([
      expect.objectContaining({ amount: 2, targetInstanceId: identity }),
    ]);
    expect(tough(second.state, sauron)).toBe(1);
  });

  it("FORCED_INTERRUPT: fires before the attack: the 2 damage lands first, then Sauron's own damage", () => {
    const first = round(heroGame(), { reveals: [SAURON_CODE] });
    const sauron = minionsOf(first.state, SAURON_CODE)[0]!;
    const drain = attachedTo(first.state, sauron, LIFE_DRAIN)[0]!;
    const second = round(fresh(first.state), { reveals: [LIVES] });
    const sources = ofType(second.events, "damageDealt").map((e) => e.sourceInstanceId);
    expect(sources.indexOf(drain)).toBeLessThan(sources.indexOf(sauron));
  });

  it("FORCED_INTERRUPT: stays silent when the host schemes instead (alter-ego): no damage from the drain", () => {
    const first = round(setupGame(), { reveals: [SAURON_CODE] });
    const sauron = minionsOf(first.state, SAURON_CODE)[0]!;
    expect(tough(first.state, sauron)).toBe(0);
    expect(damageOf(first.state, identityOf(first.state, P1))).toBe(0);
  });
});

describe("Sauron Lives! (46030)", () => {
  function defeat(s0: GameState, scheme: InstanceId, who: PlayerId = P1): GameState {
    const s = patchInstance(s0, scheme, { threat: 1 });
    const hero = s.players.reduce((acc, p) => withForm(acc, { heroForm: 0 }, p.playerId), s);
    const active = hero.step.phase === "player" && hero.step.kind === "turn" ? hero.step.activePlayerId : P1;
    return run(hero, firstLegal, ...(who === active ? [] : [endTurn(active)]), {
      type: "basicThwart",
      playerId: who,
      thwarterInstanceId: identityOf(hero, who),
      schemeInstanceId: scheme,
    }).state;
  }
  const withScheme = (s: GameState): { state: GameState; scheme: InstanceId } => {
    // With two players the second dealt card is an inert Advance; try both orders (who is dealt first is not under test).
    const orders =
      s.players.length === 1
        ? [[LIVES]]
        : [
            [LIVES, BOOST_NONE],
            [BOOST_NONE, LIVES],
          ];
    for (const reveals of orders) {
      const r = round(s, { boosts: [BOOST_NONE], reveals });
      if (inVillainArea(r.state, LIVES).length > 0)
        return { state: r.state, scheme: inVillainArea(r.state, LIVES)[0]! };
    }
    throw new Error("Sauron Lives! was not revealed");
  };

  it("is revealed with its 3 threat", () => {
    const { state, scheme } = withScheme(heroGame());
    expect(inst(state, scheme).threat).toBe(3);
  });

  it("WHEN_DEFEATED: the defeating player gets Sauron from the encounter deck as a facedown encounter card", () => {
    const { state, scheme } = withScheme(heroGame());
    expect(inDeck(state, SAURON_CODE)).toHaveLength(1);
    const after = defeat(state, scheme);
    expect(inVillainArea(after, LIVES)).toHaveLength(0);
    expect(inDeck(after, SAURON_CODE)).toHaveLength(0);
    const sauron = (Object.keys(after.instances) as InstanceId[]).filter((i) => codeOf(after, i) === SAURON_CODE);
    expect(sauron).toHaveLength(1);
    expect(inst(after, sauron[0]!).faceup).toBe(false);
    expect(playerOf(after, P1).dealtEncounter).toContain(sauron[0]);
  });

  it("WHEN_DEFEATED: Sauron is revealed from the dealt cards in the next villain phase, engaged with the defeater", () => {
    const { state, scheme } = withScheme(heroGame());
    const after = defeat(state, scheme);
    const next = round(patchInstance(after, after.mainScheme.instanceId, { threat: -30 }), { reveals: [] });
    expect(minionsOf(next.state, SAURON_CODE)).toHaveLength(1);
    expect(inst(next.state, minionsOf(next.state, SAURON_CODE)[0]!).engagedWith).toBe(P1);
  });

  it("WHEN_DEFEATED: finds Sauron in the encounter discard pile too", () => {
    const { state: s0, scheme } = withScheme(heroGame());
    const sauron = inDeck(s0, SAURON_CODE)[0]!;
    const deckId = Object.keys(s0.encounterDecks)[0]!;
    const pile = s0.encounterDecks[deckId]!;
    const s: GameState = {
      ...s0,
      encounterDecks: {
        ...s0.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== sauron), discard: [sauron, ...pile.discard] },
      },
    };
    const after = defeat(s, scheme);
    expect(inDiscard(after, SAURON_CODE)).toHaveLength(0);
    expect(inst(after, sauron).faceup).toBe(false);
  });

  it("WHEN_DEFEATED: with Sauron already in play it finds nothing (and nothing breaks)", () => {
    const withSauronInPlay = fresh(round(heroGame(), { reveals: [SAURON_CODE] }).state);
    const { state, scheme } = withScheme(withSauronInPlay);
    const after = defeat(state, scheme);
    expect(minionsOf(after, SAURON_CODE)).toHaveLength(1);
    expect(inVillainArea(after, LIVES)).toHaveLength(0);
  });

  it("WHEN_DEFEATED: 2 players, the player who defeated it (not the one who revealed it) is dealt Sauron", () => {
    const s = heroGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const { state, scheme } = withScheme(s);
    const other = state.players.map((p) => p.playerId).find((p) => p !== P1)!;
    const after = defeat(state, scheme, other);
    const sauron = (Object.keys(after.instances) as InstanceId[]).find((i) => codeOf(after, i) === SAURON_CODE)!;
    expect(playerOf(after, other).dealtEncounter).toContain(sauron);
    expect(playerOf(after, P1).dealtEncounter).not.toContain(sauron);
  });
});

describe("The Eye of Sauron (46032)", () => {
  it("discards the top 2 cards of your deck with no Sauron in play", () => {
    const { state, before } = eye([NONE_ICON, NONE_ICON]);
    const was = playerOf(before, P1).deck;
    expect(playerOf(state, P1).discard.filter((i) => was.slice(0, 2).includes(i))).toHaveLength(2);
    expect(playerOf(state, P1).deck.includes(was[2]!)).toBe(true);
  });

  it("discards the top 3 cards instead with Sauron in play", () => {
    const base = round(heroGame(), { reveals: [SAURON_CODE] }).state;
    const top = relabelTop(fresh(base), [NONE_ICON, NONE_ICON, NONE_ICON, NONE_ICON]);
    const ids = playerOf(top, P1).deck.slice(0, 4);
    const r = round(top, { reveals: [EYE] });
    const discarded = playerOf(r.state, P1).discard;
    expect(ids.slice(0, 3).every((i) => discarded.includes(i))).toBe(true);
    expect(playerOf(r.state, P1).deck.includes(ids[3]!)).toBe(true);
  });

  it("[energy]: 1 threat on the main scheme per energy icon discarded", () => {
    const control = baseline([NONE_ICON, NONE_ICON]);
    const r = eye([E2, E1]);
    expect(mainThreat(r.state) - mainThreat(control.state)).toBe(3);
  });

  it("[physical]: 1 damage to your identity per physical icon, each its own instance", () => {
    const control = baseline([NONE_ICON, NONE_ICON]);
    const r = eye([P1_ICON, P1_ICON]);
    const identity = identityOf(r.state, P1);
    expect(damageOf(r.state, identity) - damageOf(control.state, identity)).toBe(2);
    const dealt = ofType(r.events, "damageDealt").filter((e) => e.targetInstanceId === identity && e.amount === 1);
    const base = ofType(control.events, "damageDealt").filter((e) => e.targetInstanceId === identity && e.amount === 1);
    expect(dealt.length - base.length).toBe(2);
  });

  it("[mental]: discards 1 card from your hand per mental icon", () => {
    const s = heroGame();
    const control = baseline([NONE_ICON, NONE_ICON], s);
    const r = eye([M1, M1], { state: s });
    expect(playerOf(r.state, P1).hand.length).toBe(playerOf(control.state, P1).hand.length - 2);
  });

  it("[wild]: exhausts a character you control per wild icon (one wild: the identity or an ally, your choice)", () => {
    const s = heroGame();
    const r = eye([W1, NONE_ICON], { state: s });
    expect(exhausted(r.state, identityOf(r.state, P1))).toBe(true);
    const control = baseline([NONE_ICON, NONE_ICON], s);
    expect(exhausted(control.state, identityOf(control.state, P1))).toBe(false);
  });

  it("cards with no icon do nothing: the round is the baseline's", () => {
    const control = baseline([NONE_ICON, NONE_ICON]);
    const r = eye([NONE_ICON, NONE_ICON]);
    const identity = identityOf(r.state, P1);
    expect(damageOf(r.state, identity)).toBe(damageOf(control.state, identity));
    expect(mainThreat(r.state)).toBe(mainThreat(control.state));
    expect(playerOf(r.state, P1).hand).toHaveLength(playerOf(control.state, P1).hand.length);
  });

  it("as a boost card its 1 icon adds 1 threat to Rhino's scheme, and it is discarded", () => {
    const s = setupGame();
    const base = round(s, { boosts: [BOOST_NONE], reveals: [] });
    const r = round(s, { boosts: [EYE], reveals: [] });
    expect(mainThreat(r.state) - mainThreat(base.state)).toBe(1);
    expect(inDiscard(r.state, EYE)).toHaveLength(1);
  });
});
