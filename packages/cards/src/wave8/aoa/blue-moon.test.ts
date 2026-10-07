import { AOA_CARDS, CORE_CARDS, HOOD_CARDS, cardId, encounterSetId } from "@mc/content";
import {
  activeEncounterDeckId,
  cardsInPlay,
  createGame,
  hasKeyword,
  maxHitPoints,
  traitsOf,
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
  mainThreat,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { defeatWithAttack, driveEventsPicking, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { BLUE_MOON } from "./blue-moon.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Blue Moon set (45139 Blue Area of the Moon, 45140 Gladiator, 45141 Oracle, 45142 Manta, 45143 Earthquake, 45144
 * Warstar, 45145 Imperial Guardsman, 45146 Trial by Combat), docs/phase7-wave8.md §1.16, §3.23, §3.24, §4.1 Q14 = B.
 * Rhino (Core, standard) built by `coreScenario` with the Age of Apocalypse cards in the pool, the set's cards added to
 * the encounter deck by hand (the set is not in the modular pool). Blue Area of the Moon has the setup keyword, so the
 * game starts with it in play. Cards are stacked on the encounter deck (the villain's boost card first, one per
 * activation, then each player is dealt a card) and revealed by real `endTurn` commands.
 */
const BLUE_AREA = "45139";
const GLADIATOR = "45140";
const ORACLE = "45141";
const MANTA = "45142";
const EARTHQUAKE = "45143";
const WARSTAR = "45144";
const GUARDSMAN = "45145";
const TRIAL = "45146";
const SET = [BLUE_AREA, GLADIATOR, ORACLE, MANTA, EARTHQUAKE, WARSTAR, GUARDSMAN, TRIAL];
const REFS = [
  "45139.blue-area-of-the-moon-constant",
  "45139.blue-area-of-the-moon-special",
  "45139.when-revealed",
  "45140.gladiator-constant",
  "45140.boost",
  "45141.when-revealed",
  "45142.when-revealed",
  "45143.when-revealed",
  "45144.when-revealed",
  "45145.imperial-guardsman-constant",
  "45145.imperial-guardsman-constant-2",
  "45145.imperial-guardsman-forced-interrupt",
  "45146.when-defeated",
];
/** Core treachery of 1 boost icon with no boost ability, and a second for a second activation. */
const BOOST_1 = "01188";
const BOOST_2 = "01189";
/** A card to deal a player that does nothing (a Rhino attachment) and draws no boost card, unlike a treachery. */
const HARMLESS = "01098";
const FILLERS = ["01098", "01100"];
/** Core Hydra Mercenary (HYDRA, 3 hit points, printed guard): a host with neither the Imperial Guard trait nor +hit points. */
const MERCENARY = "01101";
/** Core expert treachery: Surge, "When Revealed: Exhaust your identity card." */
const EXHAUSTION = "01191";
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, BLUE_MOON) };

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
type Seats = readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL)[];

/**
 * `area: false` leaves Blue Area of the Moon out of the encounter deck, so no Setting environment is in play. `extra`:
 * codes of other cards (Hood data, in the pool) added to the encounter deck.
 */
function setupGame(players: Seats = [SPIDER_MAN], opts: { area?: boolean; extra?: readonly string[] } = {}): GameState {
  const config = coreScenario("rhino", {
    players,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS, ...HOOD_CARDS],
  });
  const cards = AOA_CARDS.filter(
    (c) =>
      "encounterSetIds" in c &&
      c.encounterSetIds.includes(encounterSetId("blue_moon")) &&
      (opts.area !== false || (c.id as string) !== BLUE_AREA),
  );
  const copies = cards.flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame(
    { ...config, encounterDeck: [...config.encounterDeck, ...copies, ...(opts.extra ?? []).map(cardId)] },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const piles = (s: GameState) => s.encounterDecks[activeEncounterDeckId(s)]!;
const inDeck = (s: GameState, code: string) => piles(s).deck.filter((id) => codeOf(s, id) === code);
const inDiscard = (s: GameState, code: string) => piles(s).discard.filter((id) => codeOf(s, id) === code);
const inPlayCards = (s: GameState, code: string) => cardsInPlay(s).filter((id) => codeOf(s, id) === code);
const inPlayArea = (s: GameState, p: PlayerId, code: string) =>
  playerOf(s, p).playArea.filter((id) => codeOf(s, id) === code);
const minionOf = (s: GameState, code: string): InstanceId =>
  s.players.flatMap((p) => inPlayArea(s, p.playerId, code))[0]!;
const idDamage = (s: GameState, p: PlayerId) => inst(s, identityOf(s, p)).damage;
const dataOf = (code: string) =>
  AOA_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
const types = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const attacksBy = (s: GameState, events: readonly GameEvent[], code: string) =>
  types(events, "attackResolved").filter((a) => codeOf(s, a.enemyInstanceId) === code);
const schemesBy = (s: GameState, events: readonly GameEvent[], code: string) =>
  types(events, "schemeResolved").filter((a) => codeOf(s, a.enemyInstanceId) === code);
const revealedCodes = (s: GameState, events: readonly GameEvent[]) =>
  types(events, "encounterCardRevealed").map((e) => codeOf(s, e.instanceId));
const statuses = (s: GameState, p: PlayerId) => inst(s, identityOf(s, p)).statuses;

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
 * Every player ends their turn (those in `hero` first change to hero form) and the villain phase runs. `boosts` are the
 * boost cards of the villain's activations (one each, in order), `reveals` the cards the players are dealt, in player
 * order (then any card a revealed side scheme or surge takes, or a card a reveal discards from the top), `pick`
 * answers every choice. Rhino's main scheme is emptied and each identity healed first, so rounds start the same way.
 */
function round(
  state: GameState,
  opts: { boosts?: readonly string[]; reveals?: readonly string[]; hero?: readonly PlayerId[]; pick?: Picker },
): Run {
  const players = state.players.length;
  const boosts = opts.boosts ?? [BOOST_1, BOOST_2].slice(0, players);
  const calm = state.players.reduce(
    (acc, p) => patchInstance(acc, p.identity.instanceId, { damage: 0 }),
    patchInstance(state, state.mainScheme.instanceId, { threat: 0 }),
  );
  const named = opts.reveals ?? [];
  const spare = FILLERS.filter(
    (code) => !named.includes(code) && piles(calm).deck.some((id) => codeOf(calm, id) === code),
  );
  const reveals = [...named, ...spare.slice(0, Math.max(0, players - named.length))];
  const stacked = stackEncounterDeck(calm, ...boosts, ...reveals);
  const heroes = opts.hero ?? [];
  const commands = turnOrder(state).flatMap((id) => [
    ...(heroes.includes(id) && playerOf(state, id).identity.form !== "hero" ? [toHero(id)] : []),
    endTurn(id),
  ]);
  return driveEventsPicking(DEPS, stacked, opts.pick ?? firstLegal, ...commands);
}
const control = (state: GameState) => round(state, { reveals: [] });
const mainDelta = (a: Run, b: Run): number => mainThreat(a.state) - mainThreat(b.state);

/** The reveals of a round in turn order: `named` for the players listed (by seat), a harmless card for the others. */
const SPARES = ["01098", "01100", "01099", "01099"];
function dealing(state: GameState, named: Partial<Record<PlayerId, string>>, extras: readonly string[] = []): string[] {
  const used = [...Object.values(named), ...extras];
  const spare = SPARES.filter((c) => !used.includes(c));
  const players = turnOrder(state).map((p) => named[p] ?? spare.shift()!);
  return [...players, ...extras];
}

/** Round 1: the card is dealt to player 1 (an alter-ego, so it does not attack) and sits engaged with them. */
function withMinion(
  code: string,
  players: Seats = [SPIDER_MAN],
  opts: { area?: boolean; extra?: readonly string[] } = {},
): GameState {
  const s = setupGame(players, opts);
  return round(s, { reveals: players.length === 1 ? [code] : [code, HARMLESS] }).state;
}

describe("registry", () => {
  it("registers the thirteen refs of the eight cards, each a valid definition", () => {
    expect(Object.keys(BLUE_MOON).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(BLUE_MOON)) expect(validateDefinition(def), id).toEqual([]);
  });

  it("the data names exactly these refs for the eight cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });
});

describe("setup", () => {
  it("1 player: Blue Area of the Moon starts in play, not in the deck; the other seven cards are in the deck", () => {
    const s = setupGame();
    expect(inPlayCards(s, BLUE_AREA)).toHaveLength(1);
    expect(inDeck(s, BLUE_AREA)).toHaveLength(0);
    for (const code of SET.slice(1)) expect(inDeck(s, code), code).toHaveLength(1);
    expect(s.instances[inPlayCards(s, BLUE_AREA)[0]!]!.faceup).toBe(true);
  });

  it("2 players: the same", () => {
    const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    expect(inPlayCards(s, BLUE_AREA)).toHaveLength(1);
    expect(SET.slice(1).every((code) => inDeck(s, code).length === 1)).toBe(true);
  });

  it("without the card in the game there is no Setting environment in play", () => {
    const s = setupGame([SPIDER_MAN], { area: false });
    expect(inPlayCards(s, BLUE_AREA)).toHaveLength(0);
    expect(cardsInPlay(s).filter((id) => traitsOf(s, id, DEPS).some((t) => (t as string) === "SETTING"))).toEqual([]);
  });
});

describe("Blue Area of the Moon (45139)", () => {
  it("is data: an environment, LOCATION and SETTING, setup, 3 boost icons, one copy, no stats", () => {
    const card = dataOf(BLUE_AREA);
    expect(card.type).toBe("environment");
    expect(card.traits).toEqual(["LOCATION", "SETTING"]);
    expect(card.keywords).toEqual([{ name: "setup" }]);
    expect(card.boostIcons).toBe(3);
    expect(card.quantityInSet).toBe(1);
  });

  it("each minion gains guard, one revealed later included: Oracle has guard with it in play and not without", () => {
    const withArea = withMinion(ORACLE);
    expect(hasKeyword(withArea, minionOf(withArea, ORACLE), "guard", DEPS)).toBe(true);
    const without = withMinion(ORACLE, [SPIDER_MAN], { area: false });
    expect(hasKeyword(without, minionOf(without, ORACLE), "guard", DEPS)).toBe(false);
  });

  it("the villain is not a minion, so it does not gain guard", () => {
    const s = withMinion(ORACLE);
    expect(hasKeyword(s, s.activeVillainId!, "guard", DEPS)).toBe(false);
  });

  it("guard is enforced: engaged with Oracle, the player cannot attack the villain, and can attack Oracle", () => {
    const s = withForm(withMinion(ORACLE), { heroForm: 0 }, P1);
    const attack = (target: InstanceId) =>
      ({
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(s, P1),
        targetInstanceId: target,
      }) as const;
    expect(() => driveEventsPicking(DEPS, s, firstLegal, attack(s.activeVillainId!))).toThrow();
    expect(() => driveEventsPicking(DEPS, s, firstLegal, attack(minionOf(s, ORACLE)))).not.toThrow();
  });

  it("without the environment, the same Oracle can be bypassed: the player attacks the villain", () => {
    const s = withForm(withMinion(ORACLE, [SPIDER_MAN], { area: false }), { heroForm: 0 }, P1);
    const attack = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(s, P1),
      targetInstanceId: s.activeVillainId!,
    } as const;
    expect(() => driveEventsPicking(DEPS, s, firstLegal, attack)).not.toThrow();
  });

  it("WHEN REVEALED: discards each other Setting environment (the Hood's Secret Lair revealed first, then Blue Area)", () => {
    const LAIR = "24061";
    const s0 = setupGame([SPIDER_MAN], { extra: [LAIR] });
    // Secret Lair (a Setting, surge): its own When Revealed discards Blue Area of the Moon, then the next card is revealed.
    const first = round(s0, { reveals: [LAIR, HARMLESS] });
    expect(inPlayCards(first.state, LAIR)).toHaveLength(1);
    expect(inPlayCards(first.state, BLUE_AREA)).toHaveLength(0);
    expect(inDiscard(first.state, BLUE_AREA)).toHaveLength(1);
    // Blue Area revealed from the encounter deck: it discards the Secret Lair.
    const second = round(first.state, { reveals: [BLUE_AREA] });
    expect(revealedCodes(second.state, second.events)).toContain(BLUE_AREA);
    expect(inPlayCards(second.state, BLUE_AREA)).toHaveLength(1);
    expect(inPlayCards(second.state, LAIR)).toHaveLength(0);
    expect(inDiscard(second.state, LAIR)).toHaveLength(1);
  });

  it("as a boost card (from the discard pile, after the Secret Lair discarded it) its 3 icons add 2 to Rhino's scheme; no boost ability", () => {
    const LAIR = "24061";
    const s = round(setupGame([SPIDER_MAN], { extra: [LAIR] }), { reveals: [LAIR, HARMLESS] }).state;
    expect(inDiscard(s, BLUE_AREA)).toHaveLength(1);
    const base = control(s);
    const run = round(s, { boosts: [BLUE_AREA], reveals: [] });
    expect(mainDelta(run, base)).toBe(2);
    expect(inDiscard(run.state, BLUE_AREA)).toHaveLength(1);
    expect(inPlayCards(run.state, LAIR)).toHaveLength(1);
  });

  it("SPECIAL: it never resolves on its own: a round with Blue Area in play and no card that instructs it deals 0 damage", () => {
    const run = round(setupGame(), { reveals: [HARMLESS] });
    expect(idDamage(run.state, P1)).toBe(0);
  });
});

/** A minion's data, its stats at the table (alter-ego scheme, hero attack) and its boost icons. */
function minionSuite(
  code: string,
  expected: {
    readonly name: string;
    readonly atk: number;
    readonly sch: number;
    readonly hp: number;
    readonly boost: number;
    readonly star?: true;
  },
): void {
  describe(`${expected.name} (${code}): the minion`, () => {
    it("is data: a unique Imperial Guard minion with Teamwork (Imperial Guard) and the printed stats", () => {
      const card = dataOf(code);
      expect(card.type).toBe("minion");
      expect([card.atk, card.sch, card.hp, card.boostIcons]).toEqual([
        expected.atk,
        expected.sch,
        expected.hp,
        expected.boost,
      ]);
      expect(card.unique).toBe(true);
      expect(card.quantityInSet).toBe(1);
      expect(card.starIcon).toBe(expected.star);
      expect(card.keywords).toEqual([{ name: "teamwork", sharedTrait: "IMPERIAL GUARD" }]);
      expect(card.traits as string[]).toContain("IMPERIAL GUARD");
    });

    it("schemes for its SCH (alter-ego) and attacks for its ATK (hero), with no boost card of its own", () => {
      const s0 = withMinion(code, [SPIDER_MAN], { area: false });
      // Whatever its When Revealed did, it is engaged with the player who was dealt it.
      expect(inst(s0, minionOf(s0, code)).engagedWith).toBe(P1);
      expect(inst(s0, minionOf(s0, code)).damage).toBe(0);
      const scheme = round(s0, { reveals: [] });
      expect(
        schemesBy(scheme.state, scheme.events, code).map((e) => [e.baseSch, e.boostIcons, e.threatPlaced]),
      ).toEqual([[expected.sch, 0, expected.sch]]);
      const attack = round(s0, { reveals: [], hero: [P1] });
      expect(attacksBy(attack.state, attack.events, code).map((e) => [e.baseAtk, e.boostIcons, e.damageDealt])).toEqual(
        [[expected.atk, 0, expected.atk]],
      );
    });

    it(`as a boost card its ${expected.boost} boost icon(s) change Rhino's scheme by ${expected.boost - 1} against a 1-icon boost`, () => {
      const s = setupGame([SPIDER_MAN], { area: false });
      const base = control(s);
      const run = round(s, { boosts: [code], reveals: [] });
      expect(mainDelta(run, base)).toBe(expected.boost - 1);
      expect(inDiscard(run.state, code)).toHaveLength(1);
    });
  });
}

describe("the minions of the set", () => {
  minionSuite(GLADIATOR, { name: "Gladiator", atk: 3, sch: 2, hp: 6, boost: 0, star: true });
  minionSuite(ORACLE, { name: "Oracle", atk: 1, sch: 2, hp: 3, boost: 1 });
  minionSuite(MANTA, { name: "Manta", atk: 2, sch: 1, hp: 4, boost: 1 });
  minionSuite(EARTHQUAKE, { name: "Earthquake", atk: 2, sch: 2, hp: 4, boost: 2 });
  minionSuite(WARSTAR, { name: "Warstar", atk: 2, sch: 1, hp: 5, boost: 2 });
});

/** A real basic attack by `who` that defeats `target`: the active player's, after the other players have ended their turns. */
function defeatAs(state: GameState, target: InstanceId, who: PlayerId): GameState {
  const active = state.step.phase === "player" && state.step.kind === "turn" ? state.step.activePlayerId : who;
  const lead = active === who ? state : driveEventsPicking(DEPS, state, firstLegal, endTurn(active)).state;
  return defeatWithAttack(DEPS, withForm(lead, { heroForm: 0 }, who), target, who);
}

describe("Oracle (45141), Manta (45142) and Earthquake (45143): the status, and the Special if you already had it", () => {
  type Case = {
    readonly name: string;
    readonly code: string;
    /** Whether `player`'s identity has the status now. */
    readonly has: (s: GameState, p: PlayerId) => boolean;
    /** The same state with the status given to `player`, when a state patch can do it. */
    readonly give: (s: GameState, p: PlayerId) => GameState;
    /**
     * A card that gives the status to the player it is dealt to earlier in the same villain phase, when a patch cannot
     * keep it: the identity readies at the end of the player phase, so only a villain-phase card leaves it exhausted
     * (Exhaustion, core 01191: Surge, "Exhaust your identity card").
     */
    readonly prime?: string;
  };
  const cases: readonly Case[] = [
    {
      name: "Oracle (confused)",
      code: ORACLE,
      has: (s, p) => statuses(s, p).confused > 0,
      give: (s, p) => patchInstance(s, identityOf(s, p), { statuses: { ...statuses(s, p), confused: 1 } }),
    },
    {
      name: "Manta (stunned)",
      code: MANTA,
      has: (s, p) => statuses(s, p).stunned > 0,
      give: (s, p) => patchInstance(s, identityOf(s, p), { statuses: { ...statuses(s, p), stunned: 1 } }),
    },
    {
      name: "Earthquake (exhausted)",
      code: EARTHQUAKE,
      has: (s, p) => inst(s, identityOf(s, p)).exhausted,
      give: (s) => s,
      prime: EXHAUSTION,
    },
  ];
  /** The reveals that deal the card to `target`, with `primed` (a player, or none) already having the status first. */
  const revealsFor = (c: Case, s: GameState, target: PlayerId, primed: PlayerId | null): string[] => {
    if (!c.prime) return dealing(s, { [target]: c.code });
    if (primed === target) return dealing(s, { [target]: c.prime }, [c.code]);
    if (primed === null) return dealing(s, { [target]: c.code });
    return dealing(s, { [primed]: c.prime, [target]: c.code }, ["01100"]);
  };

  const setupLocal = (players: Seats = [SPIDER_MAN], opts: { area?: boolean } = {}) =>
    setupGame(players, { ...opts, extra: [EXHAUSTION] });

  for (const c of cases) {
    describe(c.name, () => {
      it("not already: the player gets the status and the Setting's Special does not resolve (0 damage)", () => {
        const s = setupLocal();
        expect(c.has(s, P1)).toBe(false);
        const run = round(s, { reveals: revealsFor(c, s, P1, null) });
        expect(c.has(run.state, P1)).toBe(true);
        expect(idDamage(run.state, P1)).toBe(0);
        expect(inst(run.state, minionOf(run.state, c.code)).engagedWith).toBe(P1);
      });

      it("already: the player keeps the status (one card) and resolves the Special: exactly 1 damage to their identity", () => {
        const s = setupLocal();
        const run = round(c.give(s, P1), { reveals: revealsFor(c, s, P1, P1) });
        expect(c.has(run.state, P1)).toBe(true);
        expect(idDamage(run.state, P1)).toBe(1);
        expect(statuses(run.state, P1).confused).toBeLessThanOrEqual(1);
        expect(statuses(run.state, P1).stunned).toBeLessThanOrEqual(1);
      });

      it("already, with no Setting environment in play: nothing resolves (0 damage) and nothing is asked", () => {
        const s = setupLocal([SPIDER_MAN], { area: false });
        const run = round(c.give(s, P1), { reveals: revealsFor(c, s, P1, P1) });
        expect(c.has(run.state, P1)).toBe(true);
        expect(idDamage(run.state, P1)).toBe(0);
        expect(run.state.pendingChoice).toBeNull();
      });

      it("2 players, dealt to the second player to act: only that player is checked, changed and damaged", () => {
        const s = setupLocal([SPIDER_MAN, CAPTAIN_MARVEL]);
        const second = turnOrder(s)[1]!;
        const first = turnOrder(s)[0]!;
        const run = round(c.give(s, second), { reveals: revealsFor(c, s, second, second) });
        expect(c.has(run.state, second)).toBe(true);
        expect(idDamage(run.state, second)).toBe(1);
        expect(idDamage(run.state, first)).toBe(0);
        expect(inst(run.state, minionOf(run.state, c.code)).engagedWith).toBe(second);
      });

      it("2 players: the other player already having the status is irrelevant; the revealing player has not (0 damage anywhere)", () => {
        const s = setupLocal([SPIDER_MAN, CAPTAIN_MARVEL]);
        const second = turnOrder(s)[1]!;
        const first = turnOrder(s)[0]!;
        const run = round(c.give(s, first), { reveals: revealsFor(c, s, second, first) });
        expect(c.has(run.state, second)).toBe(true);
        expect(idDamage(run.state, second)).toBe(0);
        expect(idDamage(run.state, first)).toBe(0);
        if (c.prime) expect(c.has(run.state, first)).toBe(true);
      });
    });
  }

  it("the Special is read before the status is given, not after: a player not confused who reveals Oracle is not damaged by it", () => {
    const run = round(setupGame(), { reveals: [ORACLE] });
    expect(statuses(run.state, P1).confused).toBe(1);
    expect(idDamage(run.state, P1)).toBe(0);
  });
});

describe("Warstar (45144): discard the top card; an Imperial Guard minion is revealed, anything else resolves the Special", () => {
  it("an Imperial Guard minion on top (Manta): it is revealed and enters play engaged with the player, stunned; Warstar and it are in play", () => {
    const run = round(setupGame(), { reveals: [WARSTAR, MANTA] });
    expect(revealedCodes(run.state, run.events)).toEqual([WARSTAR, MANTA]);
    expect(inPlayArea(run.state, P1, WARSTAR)).toHaveLength(1);
    expect(inPlayArea(run.state, P1, MANTA)).toHaveLength(1);
    expect(inDiscard(run.state, MANTA)).toHaveLength(0);
    expect(statuses(run.state, P1).stunned).toBe(1);
    expect(idDamage(run.state, P1)).toBe(0);
  });

  it("the revealed minion's own When Revealed resolves for the same player: Oracle, with the player already confused, also resolves the Special (1 damage)", () => {
    const s = setupGame();
    const confused = patchInstance(s, identityOf(s, P1), { statuses: { ...statuses(s, P1), confused: 1 } });
    const run = round(confused, { reveals: [WARSTAR, ORACLE] });
    expect(inPlayArea(run.state, P1, ORACLE)).toHaveLength(1);
    expect(idDamage(run.state, P1)).toBe(1);
  });

  it("a card that is not a minion on top (Enhanced Ivory Horn): it stays discarded and the Special deals 1 damage to the player's identity", () => {
    const run = round(setupGame(), { reveals: [WARSTAR, "01100"] });
    expect(inDiscard(run.state, "01100")).toHaveLength(1);
    expect(revealedCodes(run.state, run.events)).toEqual([WARSTAR]);
    expect(idDamage(run.state, P1)).toBe(1);
  });

  it("an Imperial Guardsman on top is an attachment, not a minion: discarded, and the Special resolves", () => {
    const run = round(setupGame(), { reveals: [WARSTAR, GUARDSMAN] });
    expect(inDiscard(run.state, GUARDSMAN)).toHaveLength(1);
    expect(idDamage(run.state, P1)).toBe(1);
  });

  it("a minion that is not Imperial Guard on top (a Hydra Mercenary): discarded, not revealed, and the Special resolves", () => {
    const run = round(setupGame(), { reveals: [WARSTAR, MERCENARY] });
    expect(inDiscard(run.state, MERCENARY)).toHaveLength(1);
    expect(inPlayArea(run.state, P1, MERCENARY)).toHaveLength(0);
    expect(idDamage(run.state, P1)).toBe(1);
  });

  it("with no Setting environment in play the Special resolves nothing (0 damage), and the top card is still discarded", () => {
    const run = round(setupGame([SPIDER_MAN], { area: false }), { reveals: [WARSTAR, "01100"] });
    expect(inDiscard(run.state, "01100")).toHaveLength(1);
    expect(idDamage(run.state, P1)).toBe(0);
  });

  it("2 players, dealt to the second player: the Special damages that player only; the first player is untouched", () => {
    const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const second = turnOrder(s)[1]!;
    const first = turnOrder(s)[0]!;
    const run = round(s, { reveals: dealing(s, { [second]: WARSTAR }, ["01100"]) });
    expect(idDamage(run.state, second)).toBe(1);
    expect(idDamage(run.state, first)).toBe(0);
    expect(inDiscard(run.state, "01100")).toHaveLength(1);
  });

  it("2 players: the Imperial Guard minion Warstar reveals is revealed by (and engaged with) the player who revealed Warstar", () => {
    const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const second = turnOrder(s)[1]!;
    const run = round(s, { reveals: dealing(s, { [second]: WARSTAR }, [MANTA]) });
    expect(inst(run.state, minionOf(run.state, MANTA)).engagedWith).toBe(second);
    expect(statuses(run.state, second).stunned).toBe(1);
  });
});

describe("Trial by Combat (45146)", () => {
  /** Round 1: Trial by Combat is dealt to player 1 and enters play. */
  const withTrial = (players: Seats = [SPIDER_MAN]) =>
    round(setupGame(players), { reveals: players.length === 1 ? [TRIAL] : [TRIAL, HARMLESS] }).state;
  const trialOf = (s: GameState) => s.villainArea.filter((id) => codeOf(s, id) === TRIAL);

  it("is data: a side scheme, 2 flat threat, an amplify icon, 2 boost icons, hinder 1 per hero, no traits", () => {
    const card = dataOf(TRIAL);
    expect(card.type).toBe("side_scheme");
    expect(card.startingThreat).toEqual({ base: 2, perPlayer: 0 });
    expect(card.amplifyIcons).toBe(1);
    expect(card.boostIcons).toBe(2);
    expect(card.keywords).toEqual([{ name: "hinder", value: 0, perPlayer: 1 }]);
    expect(card.traits).toEqual([]);
  });

  it("revealed: it enters play with its 2 threat plus 1 hinder per hero: 3 threat with 1 player, 4 with 2", () => {
    const one = withTrial();
    expect(trialOf(one)).toHaveLength(1);
    expect(inst(one, trialOf(one)[0]!).threat).toBe(3);
    const two = withTrial([SPIDER_MAN, CAPTAIN_MARVEL]);
    expect(inst(two, trialOf(two)[0]!).threat).toBe(4);
  });

  it("its amplify icon adds one boost icon to the villain's boost card: Rhino's scheme is 1 higher with it in play", () => {
    const base = control(setupGame());
    const run = control(withTrial());
    expect(mainDelta(run, base)).toBe(1);
  });

  it("as a boost card its 2 icons are 1 more than a 1-icon boost", () => {
    const s = setupGame();
    const run = round(s, { boosts: [TRIAL], reveals: [] });
    expect(mainDelta(run, control(s))).toBe(1);
    expect(inDiscard(run.state, TRIAL)).toHaveLength(1);
  });

  /** An Imperial Guard minion (Oracle) in the encounter discard pile: it was a boost card one round ago. */
  const withOracleDiscarded = () => round(withTrial(), { boosts: [ORACLE], reveals: [] }).state;

  /** A hero thwarts the scheme down to 0 (it is at 1 first) and defeats it. */
  const thwartIt = (state: GameState, who: PlayerId): GameState => {
    const scheme = trialOf(state)[0]!;
    const patched = patchInstance(withForm(state, { heroForm: 0 }, who), scheme, { threat: 1 });
    return driveEventsPicking(DEPS, patched, firstLegal, {
      type: "basicThwart",
      playerId: who,
      thwarterInstanceId: identityOf(patched, who),
      schemeInstanceId: scheme,
    }).state;
  };

  it("WHEN DEFEATED: each Imperial Guard minion in the encounter discard pile is shuffled into the encounter deck; other discarded cards stay", () => {
    const s = withOracleDiscarded();
    expect(inDiscard(s, ORACLE)).toHaveLength(1);
    expect(inDiscard(s, BOOST_1).length + inDiscard(s, BOOST_2).length).toBeGreaterThan(0);
    const before = piles(s).discard.length;
    const after = thwartIt(s, P1);
    expect(trialOf(after)).toHaveLength(0);
    expect(inDeck(after, ORACLE)).toHaveLength(1);
    expect(inDiscard(after, ORACLE)).toHaveLength(0);
    // Oracle left; the defeated Trial by Combat (not a minion) went to the discard pile in its place.
    expect(inDiscard(after, TRIAL)).toHaveLength(1);
    expect(piles(after).discard.length).toBe(before);
  });

  it("WHEN DEFEATED: an Imperial Guard minion in play is not moved, nor a Hydra Mercenary in the discard pile", () => {
    const withMerc = round(withTrial(), { boosts: [MERCENARY], reveals: [MANTA] }).state;
    expect(inDiscard(withMerc, MERCENARY)).toHaveLength(1);
    expect(inPlayArea(withMerc, P1, MANTA)).toHaveLength(1);
    const after = thwartIt(withMerc, P1);
    expect(inDiscard(after, MERCENARY)).toHaveLength(1);
    expect(inDeck(after, MERCENARY)).toHaveLength(inDeck(withMerc, MERCENARY).length);
    expect(inPlayArea(after, P1, MANTA)).toHaveLength(1);
  });

  it("WHEN DEFEATED with no Imperial Guard minion in the discard pile: nothing moves", () => {
    const s = withTrial();
    const deckBefore = piles(s).deck.length;
    const after = thwartIt(s, P1);
    expect(trialOf(after)).toHaveLength(0);
    expect(piles(after).deck.length).toBe(deckBefore);
  });
});

describe("Gladiator (45140)", () => {
  const trialSetup = (players: Seats = [SPIDER_MAN]) =>
    round(setupGame(players), { reveals: players.length === 1 ? [TRIAL] : [TRIAL, HARMLESS] }).state;
  const attackIt = (s: GameState): GameState => {
    const target = minionOf(s, GLADIATOR);
    return driveEventsPicking(DEPS, withForm(s, { heroForm: 0 }, P1), firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(s, P1),
      targetInstanceId: target,
    }).state;
  };
  const gladiatorEngaged = (s: GameState) => round(s, { reveals: [GLADIATOR] }).state;

  it("with Trial by Combat in play Gladiator cannot take damage: a basic attack on him is rejected as having no valid target", () => {
    const s = gladiatorEngaged(trialSetup());
    expect(s.villainArea.some((id) => codeOf(s, id) === TRIAL)).toBe(true);
    expect(() => attackIt(s)).toThrow(/cannot take damage/);
    expect(inst(s, minionOf(s, GLADIATOR)).damage).toBe(0);
  });

  it("without Trial by Combat the same attack damages him (the hero's ATK), so the 0 above is the card's doing", () => {
    const s = gladiatorEngaged(setupGame());
    const after = attackIt(s);
    expect(inst(after, minionOf(after, GLADIATOR)).damage).toBeGreaterThan(0);
  });

  it("revealed with Trial by Combat in play he is engaged with the player and undamaged (he has no When Revealed)", () => {
    const s = gladiatorEngaged(trialSetup());
    expect(inst(s, minionOf(s, GLADIATOR)).engagedWith).toBe(P1);
  });

  it("BOOST with Trial by Combat in play: Gladiator is dealt to the player as a facedown card and revealed this phase", () => {
    const s = trialSetup();
    const run = round(s, { boosts: [GLADIATOR], reveals: [] });
    expect(inDiscard(run.state, GLADIATOR)).toHaveLength(0);
    expect(inPlayArea(run.state, P1, GLADIATOR)).toHaveLength(1);
    expect(revealedCodes(run.state, run.events)).toContain(GLADIATOR);
    expect(inst(run.state, minionOf(run.state, GLADIATOR)).engagedWith).toBe(P1);
  });

  it("BOOST without Trial by Combat: nothing is dealt; Gladiator is discarded as a boost card (0 icons)", () => {
    const s = setupGame();
    const run = round(s, { boosts: [GLADIATOR], reveals: [] });
    expect(inDiscard(run.state, GLADIATOR)).toHaveLength(1);
    expect(inPlayArea(run.state, P1, GLADIATOR)).toHaveLength(0);
    expect(mainDelta(run, control(s))).toBe(-1);
  });

  it("BOOST, 2 players: the second activation is against the second player, who is dealt Gladiator", () => {
    const s = trialSetup([SPIDER_MAN, CAPTAIN_MARVEL]);
    const second = turnOrder(s)[1]!;
    const first = turnOrder(s)[0]!;
    const run = round(s, { boosts: [BOOST_1, GLADIATOR], reveals: [] });
    expect(inPlayArea(run.state, second, GLADIATOR)).toHaveLength(1);
    expect(inPlayArea(run.state, first, GLADIATOR)).toHaveLength(0);
    const other = round(s, { boosts: [GLADIATOR, BOOST_2], reveals: [] });
    expect(inPlayArea(other.state, first, GLADIATOR)).toHaveLength(1);
    expect(inPlayArea(other.state, second, GLADIATOR)).toHaveLength(0);
  });
});

describe("Imperial Guardsman (45145)", () => {
  /** Round 1 reveals a Hydra Mercenary (HYDRA, 3 hit points); round 2 reveals the Guardsman, which attaches to it. */
  function guarded(players: Seats = [SPIDER_MAN], opts: { area?: boolean } = {}): GameState {
    const s0 = withMinion(MERCENARY, players, opts);
    const reveals = players.length === 1 ? [GUARDSMAN] : dealing(s0, { [P1]: GUARDSMAN, [P2]: "01099" });
    return round(s0, { reveals }).state;
  }
  const host = (s: GameState) => minionOf(s, MERCENARY);
  const guardsmanOn = (s: GameState) => inst(s, host(s)).attachments.filter((id) => codeOf(s, id) === GUARDSMAN);

  it("is data: an attachment (title) to a minion, 2 boost icons, no keyword, one copy", () => {
    const card = dataOf(GUARDSMAN);
    expect(card.type).toBe("attachment");
    expect(card.attachesTo).toEqual({ kind: "minion" });
    expect(card.boostIcons).toBe(2);
    expect(card.keywords).toEqual([]);
    expect(card.traits).toEqual(["TITLE"]);
    expect(card.quantityInSet).toBe(1);
  });

  it("revealed with a minion in play it attaches to that minion: +4 hit points (3 to 7) and the Imperial Guard trait", () => {
    const before = withMinion(MERCENARY);
    expect(maxHitPoints(before, host(before), DEPS)).toBe(3);
    expect(traitsOf(before, host(before), DEPS).map(String)).not.toContain("IMPERIAL GUARD");
    const s = guarded();
    expect(guardsmanOn(s)).toHaveLength(1);
    expect(maxHitPoints(s, host(s), DEPS)).toBe(7);
    expect(traitsOf(s, host(s), DEPS).map(String)).toEqual(expect.arrayContaining(["HYDRA", "IMPERIAL GUARD"]));
  });

  it("revealed with no minion in play: it gains surge, is discarded and the next card is revealed", () => {
    const run = round(setupGame(), { reveals: [GUARDSMAN, "01100"] });
    expect(revealedCodes(run.state, run.events)).toEqual([GUARDSMAN, "01100"]);
    expect(inDiscard(run.state, GUARDSMAN)).toHaveLength(1);
    expect(inPlayCards(run.state, GUARDSMAN)).toHaveLength(0);
  });

  it("as a boost card its 2 icons are 1 more than a 1-icon boost", () => {
    const s = setupGame();
    const run = round(s, { boosts: [GUARDSMAN], reveals: [] });
    expect(mainDelta(run, control(s))).toBe(1);
  });

  it("FORCED INTERRUPT: the minion defeated by the engaged player: that player resolves the Special (1 damage), once", () => {
    const s = guarded();
    const after = defeatAs(s, host(s), P1);
    expect(inPlayArea(after, P1, MERCENARY)).toHaveLength(0);
    expect(idDamage(after, P1)).toBe(1);
    expect(inDiscard(after, GUARDSMAN)).toHaveLength(1);
  });

  it("FORCED INTERRUPT, 2 players (Q14 = B): the minion is engaged with player 1, player 2 defeats it: player 2 takes the 1 damage, player 1 none", () => {
    const s = guarded([SPIDER_MAN, CAPTAIN_MARVEL]);
    expect(inst(s, host(s)).engagedWith).toBe(P1);
    const after = defeatAs(patchInstance(s, identityOf(s, P1), { damage: 0 }), host(s), P2);
    expect(inPlayArea(after, P1, MERCENARY)).toHaveLength(0);
    expect(idDamage(after, P2)).toBe(1);
    expect(idDamage(after, P1)).toBe(0);
  });

  it("FORCED INTERRUPT, 2 players: player 1 defeats the minion engaged with player 1: player 1 takes it, player 2 does not", () => {
    const s = guarded([SPIDER_MAN, CAPTAIN_MARVEL]);
    const after = defeatAs(s, host(s), P1);
    expect(idDamage(after, P1)).toBe(1);
    expect(idDamage(after, P2)).toBe(0);
  });

  it("FORCED INTERRUPT with no Setting environment in play: nothing resolves (0 damage) and the minion is still defeated", () => {
    const s = guarded([SPIDER_MAN], { area: false });
    const after = defeatAs(s, host(s), P1);
    expect(inPlayArea(after, P1, MERCENARY)).toHaveLength(0);
    expect(idDamage(after, P1)).toBe(0);
    expect(after.pendingChoice).toBeNull();
  });
});

describe("two Setting environments in play (Q15 = A): the resolving player chooses which one's Special", () => {
  const LAIR = "24061";
  /** Test surgery: the Hood's Secret Lair (a Setting environment) put into play next to Blue Area of the Moon. */
  function withSecondSetting(state: GameState): { readonly state: GameState; readonly lair: InstanceId } {
    const lair = piles(state).deck.find((id) => codeOf(state, id) === LAIR)!;
    const deckId = activeEncounterDeckId(state);
    const pile = state.encounterDecks[deckId]!;
    const placed: GameState = {
      ...state,
      villainArea: [...state.villainArea, lair],
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: pile.deck.filter((id) => id !== lair) } },
    };
    return { state: patchInstance(placed, lair, { faceup: true }), lair };
  }
  const settings = (s: GameState) => cardsInPlay(s).filter((id) => [BLUE_AREA, LAIR].includes(codeOf(s, id)));
  /** Picks the option naming `wanted` when a "setting" choice is offered, remembering who was asked and with what. */
  function choosing(wanted: () => InstanceId) {
    const asked: { player: PlayerId; options: number }[] = [];
    const pick: Picker = (state) => {
      const choice = state.pendingChoice!;
      const option = choice.options.find((o) => o.ref?.kind === "card" && o.ref.instanceId === wanted());
      if (!option) return firstLegal(state);
      asked.push({ player: choice.playerId, options: choice.options.length });
      return [option.optionId];
    };
    return { pick, asked };
  }

  it("Oracle, already confused, with Blue Area and the Secret Lair in play: the revealing player is asked which, and Blue Area's Special deals 1 damage", () => {
    const base = setupGame([SPIDER_MAN], { extra: [LAIR] });
    const { state: both } = withSecondSetting(base);
    expect(settings(both)).toHaveLength(2);
    const confused = patchInstance(both, identityOf(both, P1), { statuses: { ...statuses(both, P1), confused: 1 } });
    const blue = inPlayCards(both, BLUE_AREA)[0]!;
    const { pick, asked } = choosing(() => blue);
    const run = round(confused, { reveals: [ORACLE], pick });
    expect(asked).toEqual([{ player: P1, options: 2 }]);
    expect(idDamage(run.state, P1)).toBe(1);
  });

  it("Oracle, already confused, choosing the Secret Lair instead: it has no Special, so nothing resolves (0 damage)", () => {
    const { state: both, lair } = withSecondSetting(setupGame([SPIDER_MAN], { extra: [LAIR] }));
    const confused = patchInstance(both, identityOf(both, P1), { statuses: { ...statuses(both, P1), confused: 1 } });
    const { pick, asked } = choosing(() => lair);
    const run = round(confused, { reveals: [ORACLE], pick });
    expect(asked).toHaveLength(1);
    expect(idDamage(run.state, P1)).toBe(0);
  });

  it("Imperial Guardsman, 2 players: the choice goes to the player who defeated the minion (player 2), not the engaged player", () => {
    const players = [SPIDER_MAN, CAPTAIN_MARVEL] as const;
    const s0 = withMinion(MERCENARY, players, { extra: [LAIR] });
    const s1 = round(s0, { reveals: dealing(s0, { [P1]: GUARDSMAN, [P2]: "01099" }) }).state;
    const { state: both } = withSecondSetting(s1);
    const mercenary = minionOf(both, MERCENARY);
    expect(inst(both, mercenary).engagedWith).toBe(P1);
    expect(settings(both)).toHaveLength(2);
    const blue = inPlayCards(both, BLUE_AREA)[0]!;
    const { pick, asked } = choosing(() => blue);
    const active = both.step.phase === "player" && both.step.kind === "turn" ? both.step.activePlayerId : P2;
    const lead = active === P2 ? both : driveEventsPicking(DEPS, both, firstLegal, endTurn(active)).state;
    const near = patchInstance(withForm(lead, { heroForm: 0 }, P2), mercenary, { damage: 999 });
    const { state } = driveEventsPicking(DEPS, near, pick, {
      type: "basicAttack",
      playerId: P2,
      attackerInstanceId: identityOf(near, P2),
      targetInstanceId: mercenary,
    });
    expect(asked).toEqual([{ player: P2, options: 2 }]);
    expect(idDamage(state, P2)).toBe(1);
    expect(idDamage(state, P1)).toBe(0);
  });
});
