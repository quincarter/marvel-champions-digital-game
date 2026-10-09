import { AOA_CARDS, CORE_CARDS, encounterSetId } from "@mc/content";
import {
  activeEncounterDeckId,
  cardOf,
  createGame,
  maxHitPoints,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
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
  instancesOf,
  mainThreat,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { driveEvents, driveEventsPicking, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { HOUNDS } from "./hounds.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Hounds modular set (45097 Ahab, 45098 Hound x4, 45099 Ahab's Energy Spear, 45100 Release the Hounds),
 * docs/phase7-wave8.md §2.4, §3.1, §3.16. Rhino (Core, standard) built by `coreScenario` with the Age of Apocalypse
 * cards in the pool and the set's seven cards added to the encounter deck by hand (the set is not in the modular pool).
 * Cards are stacked on the encounter deck (the villain's boost card is drawn first, one per activation, then each
 * player is dealt a card, then a boost card per attack a revealed minion makes) and revealed by real `endTurn`
 * commands. The §8.3 proof of §3.16 is the "proof 3.16" tests.
 */
const AHAB = "45097";
const HOUND = "45098";
const SPEAR = "45099";
const SCHEME = "45100";
const AHAB_REVEAL = "45097.when-revealed";
const HOUND_REVEAL = "45098.when-revealed";
const SPEAR_INTERRUPT = "45099.ahabs-energy-spear-forced-interrupt";
const SCHEME_CONSTANT = "45100.release-the-hounds-constant";
const SCHEME_DEFEATED = "45100.when-defeated";
/** Core treachery of 1 boost icon with no boost ability. */
const BOOST_1 = "01188";
/** A second one, for a second activation. */
const BOOST_2 = "01189";
/** A core treachery (the villain schemes) as a harmless card for a player to be dealt. */
const ADVANCE = "01186";
/** Core attachments to Rhino that change nothing the tests read: Armored Rhino Suit, Enhanced Ivory Horn. */
const FILLERS = ["01098", "01100"];
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, HOUNDS) };

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
type Seats = readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL)[];

function setupGame(players: Seats = [SPIDER_MAN]): GameState {
  const config = coreScenario("rhino", {
    players,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS],
  });
  const SET = AOA_CARDS.filter((c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("hounds")));
  const copies = SET.flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const piles = (s: GameState) => s.encounterDecks[activeEncounterDeckId(s)]!;
const inDeck = (s: GameState, code: string) => piles(s).deck.filter((id) => codeOf(s, id) === code);
const inDiscard = (s: GameState, code: string) => piles(s).discard.filter((id) => codeOf(s, id) === code);
const inVillainArea = (s: GameState, code: string) => s.villainArea.filter((id) => codeOf(s, id) === code);
const inPlayArea = (s: GameState, p: PlayerId, code: string) =>
  playerOf(s, p).playArea.filter((id) => codeOf(s, id) === code);
const dealtTo = (s: GameState, p: PlayerId, code: string) =>
  playerOf(s, p).dealtEncounter.filter((id) => codeOf(s, id) === code);
const damageOf = (s: GameState, p: PlayerId) => inst(s, identityOf(s, p)).damage;
const formOf = (s: GameState, p: PlayerId) => playerOf(s, p).identity.form;
const villain = (s: GameState): InstanceId => s.activeVillainId!;
const dataOf = (code: string) =>
  AOA_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
const types = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/** The players in the order they act this round: the first player (the active one) first. */
function turnOrder(state: GameState): readonly PlayerId[] {
  const ids = state.players.map((p) => p.playerId);
  const active = state.step.phase === "player" && state.step.kind === "turn" ? state.step.activePlayerId : ids[0]!;
  const at = ids.indexOf(active);
  return [...ids.slice(at), ...ids.slice(0, at)];
}

interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}
/**
 * Every player ends their turn (those in `hero` first change to hero form; the others keep the form they have) and the
 * villain phase runs. `boosts` are the boost cards of the villain's activations (one each, in order), `reveals` the
 * cards the players are dealt, in player order, then any card a surge or a revealed minion's attack draws.
 */
function round(
  state: GameState,
  opts: { boosts?: readonly string[]; reveals?: readonly string[]; hero?: readonly PlayerId[] },
): Run {
  const players = state.players.length;
  const boosts = opts.boosts ?? [BOOST_1, BOOST_2].slice(0, players);
  // Rhino's main scheme is emptied and each identity healed first so that several rounds never end the game: damage and
  // threat comparisons are between rounds that start the same way.
  const healed = state.players.reduce(
    (acc, p) => patchInstance(acc, p.identity.instanceId, { damage: 0 }),
    patchInstance(state, state.mainScheme.instanceId, { threat: 0 }),
  );
  const calm = healed;
  // A player with no card named gets a harmless one (a Rhino attachment of no consequence here), never the next card of
  // a shuffled deck, so a round with and without the card under test differs only by that card.
  const named = opts.reveals ?? [];
  const spare = FILLERS.filter(
    (code) => !named.includes(code) && piles(calm).deck.some((id) => codeOf(calm, id) === code),
  );
  const reveals = [...named, ...spare.slice(0, Math.max(0, players - named.length))];
  const stacked = stackEncounterDeck(calm, ...boosts, ...reveals);
  const heroes = opts.hero ?? [];
  const commands = turnOrder(state).flatMap((id) => [
    ...(heroes.includes(id) && formOf(state, id) !== "hero" ? [toHero(id)] : []),
    endTurn(id),
  ]);
  return driveEvents(DEPS, stacked, ...commands);
}
const control = (state: GameState, opts: { hero?: readonly PlayerId[] } = {}) => round(state, { ...opts, reveals: [] });

/** Test surgery: moves the encounter cards `ids` from the deck to the encounter discard pile. */
function toDiscard(state: GameState, ids: readonly InstanceId[]): GameState {
  const deck = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deck]!;
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deck]: { deck: pile.deck.filter((i) => !ids.includes(i)), discard: [...pile.discard, ...ids] },
    },
  };
}
/** Test surgery: puts the encounter cards `ids` out of the game (nowhere a find searches). */
function toRemoved(state: GameState, ids: readonly InstanceId[]): GameState {
  const deck = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deck]!;
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deck]: {
        deck: pile.deck.filter((i) => !ids.includes(i)),
        discard: pile.discard.filter((i) => !ids.includes(i)),
      },
    },
    removedFromGame: [...state.removedFromGame, ...ids],
  };
}

/** Release the Hounds revealed in a first round (5 threat, in the villain area), P1 still in alter-ego form. */
function withScheme(players: Seats = [SPIDER_MAN]): GameState {
  const s = setupGame(players);
  const reveals = players.length === 1 ? [SCHEME] : [SCHEME, SPEAR];
  return round(s, { reveals }).state;
}

describe("registry", () => {
  it("registers the five refs of the four cards, each a valid definition", () => {
    expect(Object.keys(HOUNDS).sort()).toEqual(
      [AHAB_REVEAL, HOUND_REVEAL, SPEAR_INTERRUPT, SCHEME_CONSTANT, SCHEME_DEFEATED].sort(),
    );
    for (const [id, def] of Object.entries(HOUNDS)) expect(validateDefinition(def), id).toEqual([]);
  });

  it("the set's seven cards are in the encounter deck of a Rhino game that asked for it", () => {
    const s = setupGame();
    expect(inDeck(s, AHAB)).toHaveLength(1);
    expect(inDeck(s, HOUND)).toHaveLength(4);
    expect(inDeck(s, SPEAR)).toHaveLength(1);
    expect(inDeck(s, SCHEME)).toHaveLength(1);
  });
});

describe("Ahab (45097)", () => {
  it("is data: a unique minion, SCH 2, ATK 3, 5 hit points, toughness, 3 boost icons", () => {
    const card = dataOf(AHAB);
    expect(card.type).toBe("minion");
    expect(card.unique).toBe(true);
    expect([card.sch, card.atk, card.hp, card.boostIcons]).toEqual([2, 3, 5, 3]);
    expect(card.keywords).toEqual([{ name: "toughness" }]);
  });

  it("revealed with Release the Hounds in the encounter deck: it is found and revealed with 5 threat, the deck is shuffled once", () => {
    const s = setupGame();
    const deckBefore = piles(s).deck.length;
    const run = round(s, { reveals: [AHAB] });
    const scheme = inVillainArea(run.state, SCHEME);
    expect(scheme).toHaveLength(1);
    expect(inst(run.state, scheme[0]!).threat).toBe(5);
    expect(inDeck(run.state, SCHEME)).toHaveLength(0);
    const found = types(run.events, "cardFound");
    expect(found).toHaveLength(1);
    expect(found[0]!.instanceId).toBe(scheme[0]);
    expect(found[0]!.deckShuffled).toBe(true);
    expect(types(run.events, "deckShuffled").length).toBeGreaterThanOrEqual(1);
    // Ahab and the scheme left the deck (and the villain's boost card was discarded).
    expect(piles(run.state).deck.length).toBe(deckBefore - 3);
  });

  it("revealed: Ahab is in play engaged with the player who revealed him, with the toughness status and no damage", () => {
    const run = round(setupGame(), { reveals: [AHAB] });
    const ahab = inPlayArea(run.state, P1, AHAB);
    expect(ahab).toHaveLength(1);
    const card = inst(run.state, ahab[0]!);
    expect(card.engagedWith).toBe(P1);
    expect(card.damage).toBe(0);
    expect(card.statuses.tough).toBe(1);
    expect(maxHitPoints(run.state, ahab[0]!, DEPS)).toBe(5);
  });

  it("revealed with Release the Hounds in the encounter discard pile: found there, 5 threat, the deck is not shuffled", () => {
    const s0 = setupGame();
    const s = toDiscard(s0, inDeck(s0, SCHEME));
    expect(inDiscard(s, SCHEME)).toHaveLength(1);
    const run = round(s, { reveals: [AHAB] });
    const scheme = inVillainArea(run.state, SCHEME);
    expect(scheme).toHaveLength(1);
    expect(inst(run.state, scheme[0]!).threat).toBe(5);
    expect(inDiscard(run.state, SCHEME)).toHaveLength(0);
    const found = types(run.events, "cardFound");
    expect(found).toHaveLength(1);
    expect(found[0]!.deckShuffled).toBe(false);
  });

  it("revealed with Release the Hounds in play at 2 threat: 3 more (5), and nothing is found or revealed", () => {
    const s0 = withScheme();
    const scheme = inVillainArea(s0, SCHEME)[0]!;
    const s = patchInstance(s0, scheme, { threat: 2 });
    const run = round(s, { boosts: [BOOST_1], reveals: [AHAB] });
    expect(inst(run.state, scheme).threat).toBe(5);
    expect(inVillainArea(run.state, SCHEME)).toEqual([scheme]);
    expect(types(run.events, "cardFound")).toEqual([]);
    expect(inPlayArea(run.state, P1, AHAB)).toHaveLength(1);
  });

  it("revealed with Release the Hounds in play at 5 threat: 8 threat", () => {
    const s0 = withScheme();
    const scheme = inVillainArea(s0, SCHEME)[0]!;
    expect(inst(s0, scheme).threat).toBe(5);
    const run = round(s0, { boosts: [BOOST_1], reveals: [AHAB] });
    expect(inst(run.state, scheme).threat).toBe(8);
  });

  it("revealed with Release the Hounds nowhere in the game: Ahab stays in play, no scheme appears, nothing is found", () => {
    const s0 = setupGame();
    const s = toRemoved(s0, inDeck(s0, SCHEME));
    const run = round(s, { reveals: [AHAB] });
    expect(inPlayArea(run.state, P1, AHAB)).toHaveLength(1);
    expect(inVillainArea(run.state, SCHEME)).toHaveLength(0);
    expect(types(run.events, "cardFound")).toEqual([]);
  });

  it("revealed with Release the Hounds in the victory display: not found", () => {
    const s0 = setupGame();
    const scheme = inDeck(s0, SCHEME);
    const base = toRemoved(s0, scheme);
    const s = { ...base, removedFromGame: [], victoryDisplay: [...base.victoryDisplay, ...scheme] };
    const run = round(s, { reveals: [AHAB] });
    expect(inVillainArea(run.state, SCHEME)).toHaveLength(0);
    expect(run.state.victoryDisplay).toEqual(scheme);
    expect(types(run.events, "cardFound")).toEqual([]);
  });

  it("2 players: Ahab dealt to player 2 engages player 2, and the scheme is revealed with 5 threat", () => {
    const run = round(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), { reveals: [ADVANCE, AHAB] });
    expect(inPlayArea(run.state, P2, AHAB)).toHaveLength(1);
    expect(inPlayArea(run.state, P1, AHAB)).toHaveLength(0);
    expect(inst(run.state, inPlayArea(run.state, P2, AHAB)[0]!).engagedWith).toBe(P2);
    const scheme = inVillainArea(run.state, SCHEME);
    expect(scheme).toHaveLength(1);
    expect(inst(run.state, scheme[0]!).threat).toBe(5);
  });

  it("as a boost card his 3 icons add 2 to Rhino's scheme (against a 1-icon boost) and he is discarded without revealing", () => {
    const s = setupGame();
    const base = control(s);
    const run = round(s, { boosts: [AHAB], reveals: [] });
    expect(mainThreat(run.state) - mainThreat(base.state)).toBe(2);
    expect(inDiscard(run.state, AHAB)).toHaveLength(1);
    expect(inVillainArea(run.state, SCHEME)).toHaveLength(0);
    expect(inDeck(run.state, SCHEME)).toHaveLength(1);
  });

  it("in the next villain phase he schemes against an alter-ego player: SCH 2, no boost card (a minion that is not villainous)", () => {
    const s0 = round(setupGame(), { reveals: [AHAB] }).state;
    const run = round(s0, { reveals: [] });
    const baseline = round(round(setupGame(), { reveals: [] }).state, { reveals: [] });
    // Ahab's scheme (2) is on the main scheme besides Rhino's; the scheme he found took no threat from it.
    expect(mainThreat(run.state)).toBe(mainThreat(baseline.state) + 2);
  });

  it("in the next villain phase he attacks a hero for 3 and no boost card is dealt for him", () => {
    const s0 = round(setupGame(), { reveals: [AHAB] }).state;
    const run = round(s0, { reveals: [], hero: [P1] });
    const attacks = types(run.events, "attackResolved");
    const ahab = attacks.find((a) => codeOf(run.state, a.enemyInstanceId) === AHAB)!;
    expect([ahab.baseAtk, ahab.boostIcons, ahab.damageDealt]).toEqual([3, 0, 3]);
  });
});

describe("Hound (45098)", () => {
  it("is data: a minion, SCH 1, ATK 2, 2 hit points, guard, 1 boost icon, 4 copies", () => {
    const card = dataOf(HOUND);
    expect(card.type).toBe("minion");
    expect([card.sch, card.atk, card.hp, card.boostIcons, card.quantityInSet]).toEqual([1, 2, 2, 1, 4]);
    expect(card.keywords).toEqual([{ name: "guard" }]);
  });

  it("revealed to a hero: it engages the player and attacks for 2 (no boost card: it is not villainous)", () => {
    const s = setupGame();
    const base = control(s, { hero: [P1] });
    const run = round(s, { reveals: [HOUND], hero: [P1] });
    const hound = inPlayArea(run.state, P1, HOUND);
    expect(hound).toHaveLength(1);
    expect(inst(run.state, hound[0]!).engagedWith).toBe(P1);
    expect(formOf(run.state, P1)).toBe("hero");
    const attack = types(run.events, "attackResolved").find((a) => a.enemyInstanceId === hound[0]);
    expect([attack!.baseAtk, attack!.boostIcons, attack!.damageDealt]).toEqual([2, 0, 2]);
    expect(damageOf(run.state, P1)).toBe(damageOf(base.state, P1) + 2);
  });

  it("revealed to an alter-ego: the identity changes to hero form, Hound does not attack and no damage is taken", () => {
    const s = setupGame();
    expect(formOf(s, P1)).toBe("alterEgo");
    const base = control(s);
    const run = round(s, { reveals: [HOUND] });
    expect(formOf(run.state, P1)).toBe("hero");
    expect(types(run.events, "formChanged").filter((e) => e.playerId === P1 && e.to === "hero")).toHaveLength(1);
    expect(types(run.events, "attackResolved").filter((a) => codeOf(run.state, a.enemyInstanceId) === HOUND)).toEqual(
      [],
    );
    expect(damageOf(run.state, P1)).toBe(damageOf(base.state, P1));
    const hound = inPlayArea(run.state, P1, HOUND);
    expect(hound).toHaveLength(1);
    expect(inst(run.state, hound[0]!).engagedWith).toBe(P1);
  });

  it("proof 3.16: the forced change is an effect, so the once-per-round change is unused", () => {
    const run = round(setupGame(), { reveals: [HOUND] });
    expect(formOf(run.state, P1)).toBe("hero");
    expect(playerOf(run.state, P1).identity.changedFormThisRound).toBe(false);
    expect(types(run.events, "formChanged").find((e) => e.playerId === P1)!.byEffect).toBe(true);
  });

  it("2 players, player 1 an alter-ego and player 2 a hero: player 1 changes form, player 2 is attacked", () => {
    const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const base = control(s, { hero: [P2] });
    const run = round(s, { reveals: [HOUND, HOUND], hero: [P2] });
    expect(formOf(run.state, P1)).toBe("hero");
    expect(formOf(run.state, P2)).toBe("hero");
    const h1 = inPlayArea(run.state, P1, HOUND);
    const h2 = inPlayArea(run.state, P2, HOUND);
    expect(h1).toHaveLength(1);
    expect(h2).toHaveLength(1);
    const attacks = types(run.events, "attackResolved").filter((a) => codeOf(run.state, a.enemyInstanceId) === HOUND);
    expect(attacks.map((a) => a.enemyInstanceId)).toEqual([h2[0]]);
    expect(attacks[0]!.targetInstanceId).toBe(identityOf(run.state, P2));
    expect(damageOf(run.state, P1)).toBe(damageOf(base.state, P1));
    expect(damageOf(run.state, P2)).toBe(damageOf(base.state, P2) + attacks[0]!.damageDealt);
    expect(attacks[0]!.damageDealt).toBe(2);
  });

  it("2 players, player 1 a hero and player 2 an alter-ego: player 1 is attacked, player 2 changes form", () => {
    const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const base = control(s, { hero: [P1] });
    const run = round(s, { reveals: [HOUND, HOUND], hero: [P1] });
    const attacks = types(run.events, "attackResolved").filter((a) => codeOf(run.state, a.enemyInstanceId) === HOUND);
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.targetInstanceId).toBe(identityOf(run.state, P1));
    expect(damageOf(run.state, P1)).toBe(damageOf(base.state, P1) + 2);
    expect(damageOf(run.state, P2)).toBe(damageOf(base.state, P2));
    expect(formOf(run.state, P2)).toBe("hero");
  });

  it("as a boost card its 1 icon adds 1 to Rhino's scheme (against 1 icon: same) and it is discarded", () => {
    const s = setupGame();
    const base = control(s);
    const run = round(s, { boosts: [HOUND], reveals: [] });
    expect(mainThreat(run.state)).toBe(mainThreat(base.state));
    expect(inDiscard(run.state, HOUND)).toHaveLength(1);
    expect(formOf(run.state, P1)).toBe("alterEgo");
  });

  it("guard: while it is engaged with the player, the hero's attack on the villain is rejected; on the Hound it is allowed", () => {
    const s0 = round(setupGame(), { reveals: [HOUND] }).state;
    const hound = inPlayArea(s0, P1, HOUND)[0]!;
    const s = patchInstance(s0, hound, { damage: 1 });
    const attack = (target: InstanceId) =>
      ({
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(s, P1),
        targetInstanceId: target,
      }) as const;
    expect(() => driveEvents(DEPS, s, attack(villain(s)))).toThrow();
    const after = driveEvents(DEPS, s, attack(hound)).state;
    expect(inPlayArea(after, P1, HOUND)).toHaveLength(0);
    // With the Hound defeated the villain can be attacked.
    const second = withForm(after, { heroForm: 0 });
    expect(() =>
      driveEvents(DEPS, patchInstance(second, identityOf(second, P1), { exhausted: false }), attack(villain(second))),
    ).not.toThrow();
  });

  it("guard: a player the Hound is not engaged with may still attack the villain", () => {
    const s0 = round(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), { reveals: [ADVANCE, HOUND] }).state;
    expect(inPlayArea(s0, P2, HOUND)).toHaveLength(1);
    const s = withForm(s0, { heroForm: 0 }, P1);
    const active = s.step.phase === "player" && s.step.kind === "turn" ? s.step.activePlayerId : P1;
    const target = villain(s);
    const attacker = active === P1 ? P1 : P1;
    const cmds = active === P1 ? [] : [endTurn(active)];
    expect(() =>
      driveEvents(DEPS, s, ...cmds, {
        type: "basicAttack",
        playerId: attacker,
        attackerInstanceId: identityOf(s, attacker),
        targetInstanceId: target,
      }),
    ).not.toThrow();
  });
});

describe("Ahab's Energy Spear (45099)", () => {
  /** Round 2 of a Rhino game where the spear was revealed in round 1 with no Ahab in play, hero form from now on. */
  const spearOnVillain = (players: Seats = [SPIDER_MAN]) => {
    const run = round(setupGame(players), {
      reveals: players.length === 1 ? [SPEAR] : [SPEAR, ADVANCE],
    });
    return run.state;
  };

  it("is data: an attachment, +2 ATK, attaches to Ahab, otherwise to the villain, 2 boost icons", () => {
    const card = dataOf(SPEAR);
    expect(card.type).toBe("attachment");
    expect(card.statModifiers).toEqual({ atk: 2 });
    expect(card.attachesTo).toEqual({
      kind: "ifAble",
      preferred: { kind: "namedCard", name: "Ahab" },
      otherwise: { kind: "villain" },
    });
    expect(card.boostIcons).toBe(2);
  });

  it("revealed with Ahab not in play: it attaches to the villain", () => {
    const s = spearOnVillain();
    const spear = instancesOf(s, SPEAR)[0]!;
    expect(inst(s, spear).attachedTo).toBe(villain(s));
    expect(inst(s, villain(s)).attachments).toContain(spear);
  });

  it("revealed with Ahab in play: it attaches to Ahab, not the villain", () => {
    const s0 = round(setupGame(), { reveals: [AHAB] }).state;
    const run = round(s0, { reveals: [SPEAR] });
    const spear = instancesOf(run.state, SPEAR)[0]!;
    const ahab = inPlayArea(run.state, P1, AHAB)[0]!;
    expect(inst(run.state, spear).attachedTo).toBe(ahab);
    expect(inst(run.state, villain(run.state)).attachments).not.toContain(spear);
  });

  it("on the villain, in a hero's round: Rhino attacks for 2 + 2 + the boost icon, then the spear is discarded", () => {
    const s = spearOnVillain();
    const spear = instancesOf(s, SPEAR)[0]!;
    const base = control(round(setupGame(), { reveals: [] }).state, { hero: [P1] });
    const run = round(s, { boosts: [BOOST_1], reveals: [], hero: [P1] });
    const attack = types(run.events, "attackResolved").find((a) => a.enemyInstanceId === villain(run.state))!;
    expect([attack.baseAtk, attack.boostIcons, attack.damageDealt]).toEqual([4, 1, 5]);
    expect(inst(run.state, spear).attachedTo ?? null).toBe(null);
    expect(inDiscard(run.state, SPEAR)).toHaveLength(1);
    expect(damageOf(run.state, P1)).toBe(damageOf(base.state, P1) + 2);
  });

  it("on the villain: the attack has piercing, so a tough status card is discarded and the damage is still dealt", () => {
    const s0 = spearOnVillain();
    const tough = patchInstance(s0, identityOf(s0, P1), { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const run = round(tough, { boosts: [BOOST_1], reveals: [], hero: [P1] });
    expect(inst(run.state, identityOf(run.state, P1)).statuses.tough).toBe(0);
    const attack = types(run.events, "attackResolved").find((a) => a.enemyInstanceId === villain(run.state))!;
    expect(attack.damageDealt).toBe(5);
    expect(damageOf(run.state, P1)).toBe(damageOf(tough, P1) + 5);
  });

  it("on the villain, without the spear, the same tough status card stops all of Rhino's damage", () => {
    const s0 = round(setupGame(), { reveals: [] }).state;
    const tough = patchInstance(s0, identityOf(s0, P1), { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const run = round(tough, { boosts: [BOOST_1], reveals: [], hero: [P1] });
    expect(damageOf(run.state, P1)).toBe(damageOf(tough, P1));
    expect(inst(run.state, identityOf(run.state, P1)).statuses.tough).toBe(0);
  });

  it("on the villain, against an alter-ego the villain schemes: the spear is not used up and the attack is not boosted", () => {
    const s = spearOnVillain();
    const spear = instancesOf(s, SPEAR)[0]!;
    const run = round(s, { boosts: [BOOST_1], reveals: [] });
    expect(inst(run.state, spear).attachedTo).toBe(villain(s));
    expect(inDiscard(run.state, SPEAR)).toHaveLength(0);
    expect(types(run.events, "attackResolved")).toEqual([]);
  });

  it("overkill: a defending ally at 1 hit point takes 1 and the hero takes the rest of the 5", () => {
    const s0 = spearOnVillain();
    const player = playerOf(s0, P1);
    const ally = [...player.hand, ...player.deck].find((i) => cardOf(s0, i)?.type === "ally");
    if (!ally) throw new Error("no ally in P1's hand or deck");
    const seated: GameState = {
      ...s0,
      players: s0.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              hand: p.hand.filter((i) => i !== ally),
              deck: p.deck.filter((i) => i !== ally),
              playArea: [...p.playArea, ally],
            }
          : p,
      ),
    };
    const hp = maxHitPoints(seated, ally, DEPS)!;
    const wounded = patchInstance(seated, ally, { faceup: true, controllerId: P1, damage: hp - 1 });
    const stacked = stackEncounterDeck(wounded, BOOST_1);
    const pick = (s: GameState): readonly string[] => {
      const prompt = s.pendingChoice?.prompt;
      if (prompt?.kind === "declareDefender") return [ally as string];
      return firstLegal(s);
    };
    const { state, events } = driveEventsPicking(DEPS, stacked, pick, toHero(P1), endTurn(P1));
    const dealt = (target: InstanceId) =>
      events.flatMap((e) =>
        e.type === "damageDealt" && e.sourceInstanceId === villain(state) && e.targetInstanceId === target
          ? [e.amount]
          : [],
      );
    expect(dealt(ally)).toEqual([5]);
    expect(types(events, "overkillSpilled").map((e) => e.amount)).toEqual([4]);
    expect(dealt(identityOf(state, P1))).toEqual([4]);
  });

  it("on Ahab, in a hero's round: his attack is 3 + 2, the spear is discarded, Ahab keeps his state", () => {
    const s0 = round(setupGame(), { reveals: [AHAB] }).state;
    const s1 = round(s0, { reveals: [SPEAR] }).state;
    const ahab = inPlayArea(s1, P1, AHAB)[0]!;
    const spear = instancesOf(s1, SPEAR)[0]!;
    expect(inst(s1, spear).attachedTo).toBe(ahab);
    const base = control(s0, { hero: [P1] });
    const run = round(s1, { reveals: [], hero: [P1] });
    const attack = types(run.events, "attackResolved").find((a) => a.enemyInstanceId === ahab)!;
    expect([attack.baseAtk, attack.boostIcons, attack.damageDealt]).toEqual([5, 0, 5]);
    expect(inDiscard(run.state, SPEAR)).toHaveLength(1);
    expect(inst(run.state, ahab).attachments).toEqual([]);
    expect(inPlayArea(run.state, P1, AHAB)).toEqual([ahab]);
    expect(damageOf(run.state, P1)).toBe(damageOf(base.state, P1) + 2);
  });

  it("2 players, the spear on the villain: the attack against player 2 is the spear's, player 1's scheme is not", () => {
    const s = spearOnVillain([SPIDER_MAN, CAPTAIN_MARVEL]);
    const spear = instancesOf(s, SPEAR)[0]!;
    expect(inst(s, spear).attachedTo).toBe(villain(s));
    const run = round(s, { reveals: [], hero: [P2] });
    const attack = types(run.events, "attackResolved").find((a) => a.enemyInstanceId === villain(run.state))!;
    expect(attack.targetInstanceId).toBe(identityOf(run.state, P2));
    expect(attack.baseAtk).toBe(4);
    expect(inDiscard(run.state, SPEAR)).toHaveLength(1);
  });

  it("as a boost card its 2 icons add 1 to Rhino's scheme (against 1 icon) and it is discarded, not attached", () => {
    const s = setupGame();
    const base = control(s);
    const run = round(s, { boosts: [SPEAR], reveals: [] });
    expect(mainThreat(run.state) - mainThreat(base.state)).toBe(1);
    expect(inDiscard(run.state, SPEAR)).toHaveLength(1);
    expect(inst(run.state, villain(run.state)).attachments).not.toContain(instancesOf(run.state, SPEAR)[0]);
  });
});

describe("Release the Hounds (45100)", () => {
  it("is data: a side scheme with 5 threat at any player count and 3 boost icons", () => {
    const card = dataOf(SCHEME);
    expect(card.type).toBe("side_scheme");
    expect(card.startingThreat).toEqual({ base: 5, perPlayer: 0 });
    expect(card.boostIcons).toBe(3);
  });

  it("revealed with 1 player it enters the villain area with 5 threat", () => {
    const run = round(setupGame(), { reveals: [SCHEME] });
    expect(inst(run.state, inVillainArea(run.state, SCHEME)[0]!).threat).toBe(5);
  });

  it("revealed with 2 players it still has 5 threat", () => {
    const run = round(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), { reveals: [SCHEME, ADVANCE] });
    expect(inst(run.state, inVillainArea(run.state, SCHEME)[0]!).threat).toBe(5);
  });

  it("as a boost card its 3 icons add 2 to Rhino's scheme (against 1 icon) and it is discarded", () => {
    const s = setupGame();
    const base = control(s);
    const run = round(s, { boosts: [SCHEME], reveals: [] });
    expect(mainThreat(run.state) - mainThreat(base.state)).toBe(2);
    expect(inDiscard(run.state, SCHEME)).toHaveLength(1);
  });

  it("proof 3.16: the first Hound revealed in a phase gains surge (another card is revealed), the second does not", () => {
    // 2 players, both alter-egos, scheme in play (round 1). In round 2 the first player to act is player 2: its Hound
    // surges and reveals Ahab (the dealt cards come first, the surge's card after them); the second player's Hound
    // does not.
    const s = withScheme([SPIDER_MAN, CAPTAIN_MARVEL]);
    const [first, second] = turnOrder(s);
    const run = round(s, { reveals: [HOUND, HOUND, AHAB] });
    expect(inPlayArea(run.state, first!, HOUND)).toHaveLength(1);
    expect(inPlayArea(run.state, first!, AHAB)).toHaveLength(1);
    expect(inPlayArea(run.state, second!, HOUND)).toHaveLength(1);
    expect(inPlayArea(run.state, second!, AHAB)).toHaveLength(0);
    expect(types(run.events, "surgeGranted")).toHaveLength(1);
    expect(inDeck(run.state, AHAB)).toHaveLength(0);
  });

  it("without Release the Hounds in play the same Hound has no surge: the next card stays in the deck", () => {
    const s = setupGame();
    const run = round(s, { reveals: [HOUND, AHAB] });
    expect(inPlayArea(run.state, P1, HOUND)).toHaveLength(1);
    expect(inPlayArea(run.state, P1, AHAB)).toHaveLength(0);
    expect(inDeck(run.state, AHAB)).toHaveLength(1);
  });

  it("proof 3.16: the surge is given again in the next villain phase", () => {
    const s0 = withScheme();
    const first = round(s0, { boosts: [BOOST_1], reveals: [HOUND, AHAB] });
    expect(types(first.events, "surgeGranted")).toHaveLength(1);
    expect(inPlayArea(first.state, P1, AHAB)).toHaveLength(1);
    // The next phase, with a second Hound: it is the first revealed that phase, so it surges too.
    // (Back in alter-ego form, so that no minion's attack ends the game for the one hero.)
    const second = round(withForm(first.state, "alterEgo"), { boosts: [BOOST_1], reveals: [HOUND, SPEAR] });
    expect(inPlayArea(second.state, P1, HOUND)).toHaveLength(2);
    expect(types(second.events, "surgeGranted")).toHaveLength(1);
    expect(inst(second.state, instancesOf(second.state, SPEAR)[0]!).attachedTo).not.toBe(null);
  });

  it("a Hound revealed after the scheme left play has no surge", () => {
    const s0 = withScheme();
    const scheme = inVillainArea(s0, SCHEME)[0]!;
    const deck = activeEncounterDeckId(s0);
    const pile = s0.encounterDecks[deck]!;
    const gone: GameState = {
      ...s0,
      villainArea: s0.villainArea.filter((id) => id !== scheme),
      encounterDecks: { ...s0.encounterDecks, [deck]: { deck: pile.deck, discard: [...pile.discard, scheme] } },
    };
    const run = round(gone, { reveals: [HOUND, AHAB] });
    expect(types(run.events, "surgeGranted")).toEqual([]);
    expect(inPlayArea(run.state, P1, AHAB)).toHaveLength(0);
  });

  /** A hero thwarts the scheme down to 0 (it is at 1 first) and defeats it. */
  const thwartIt = (state: GameState, who: PlayerId): GameState => {
    const scheme = inVillainArea(state, SCHEME)[0]!;
    const patched = patchInstance(withForm(state, { heroForm: 0 }, who), scheme, { threat: 1 });
    const active = patched.step.phase === "player" && patched.step.kind === "turn" ? patched.step.activePlayerId : who;
    const lead = active === who ? [] : [endTurn(active)];
    return driveEvents(DEPS, patched, ...lead, {
      type: "basicThwart",
      playerId: who,
      thwarterInstanceId: identityOf(patched, who),
      schemeInstanceId: scheme,
    }).state;
  };

  it("DEFEATED: the player who thwarted it is dealt a Hound from the encounter deck facedown, and the deck is shuffled", () => {
    const s0 = withScheme();
    const hounds = inDeck(s0, HOUND);
    expect(hounds).toHaveLength(4);
    const after = thwartIt(s0, P1);
    expect(inVillainArea(after, SCHEME)).toHaveLength(0);
    expect(dealtTo(after, P1, HOUND)).toHaveLength(1);
    expect(inDeck(after, HOUND)).toHaveLength(3);
    expect(inst(after, dealtTo(after, P1, HOUND)[0]!).faceup).toBe(false);
  });

  it("DEFEATED: the dealt Hound is revealed in the next villain phase (step four): the hero is changed or attacked", () => {
    const s0 = withScheme();
    const after = thwartIt(s0, P1);
    const hound = dealtTo(after, P1, HOUND)[0]!;
    const run = round(after, { boosts: [BOOST_1], reveals: [] });
    expect(playerOf(run.state, P1).dealtEncounter).not.toContain(hound);
    expect(inPlayArea(run.state, P1, HOUND)).toContain(hound);
  });

  it("DEFEATED: with every Hound in the encounter discard pile, one is taken from there", () => {
    const s0 = withScheme();
    const s = toDiscard(s0, inDeck(s0, HOUND));
    expect(inDiscard(s, HOUND)).toHaveLength(4);
    const after = thwartIt(s, P1);
    expect(dealtTo(after, P1, HOUND)).toHaveLength(1);
    expect(inDiscard(after, HOUND)).toHaveLength(3);
  });

  it("DEFEATED: with no Hound in the encounter deck or discard pile nothing is dealt", () => {
    const s0 = withScheme();
    const s = toRemoved(s0, inDeck(s0, HOUND));
    const after = thwartIt(s, P1);
    expect(inVillainArea(after, SCHEME)).toHaveLength(0);
    expect(dealtTo(after, P1, HOUND)).toHaveLength(0);
  });

  it("DEFEATED: a Hound in play is not searched for", () => {
    const s0 = round(setupGame(), { reveals: [SCHEME] }).state;
    const s1 = round(s0, { boosts: [BOOST_1], reveals: [HOUND, SPEAR] }).state;
    const inPlay = inPlayArea(s1, P1, HOUND);
    expect(inPlay).toHaveLength(1);
    const s = toRemoved(s1, inDeck(s1, HOUND));
    const after = thwartIt(s, P1);
    expect(dealtTo(after, P1, HOUND)).toHaveLength(0);
    expect(inPlayArea(after, P1, HOUND)).toEqual(inPlay);
  });

  it("DEFEATED: 2 players, the one who defeated it is dealt the Hound and the other is not", () => {
    for (const who of [P1, P2] as const) {
      const s0 = withScheme([SPIDER_MAN, CAPTAIN_MARVEL]);
      const after = thwartIt(s0, who);
      const other = who === P1 ? P2 : P1;
      expect(dealtTo(after, who, HOUND), who).toHaveLength(1);
      expect(dealtTo(after, other, HOUND), who).toHaveLength(0);
    }
  });

  it("DEFEATED: does not fire when the card is merely revealed or boosted", () => {
    const revealed = round(setupGame(), { reveals: [SCHEME] });
    expect(playerOf(revealed.state, P1).dealtEncounter.map((id) => codeOf(revealed.state, id))).toEqual([]);
    const boosted = round(setupGame(), { boosts: [SCHEME], reveals: [] });
    expect(inDeck(boosted.state, HOUND)).toHaveLength(4);
  });
});
