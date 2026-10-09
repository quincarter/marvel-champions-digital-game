import { CORE_CARDS, JUBILEE_CARDS, encounterSetId } from "@mc/content";
import {
  createGame,
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
} from "../../testing/harness.js";
import { driveEvents, playFromHand, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { ARCADE } from "./arcade.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Arcade modular set (47030 Arcade, 47031 Welcome to Murderworld, 47032 Arcade's Funhouse, 47033 Hall of Mirrors,
 * 47034 Elaborate Trap), docs/phase7-wave8.md §7.3, §3.70. Rhino (Core, standard) built by `coreScenario` with the
 * Jubilee cards in the pool and the set's five cards added to the encounter deck by hand (the set is not in the modular
 * pool). Cards are stacked on the encounter deck (the villain's boost card is drawn first, then each player is dealt a
 * card) and revealed by real `endTurn` commands; a side scheme is defeated by a real basic thwart.
 */
const ARCADE_CODE = "47030";
const WELCOME = "47031";
const FUNHOUSE = "47032";
const MIRRORS = "47033";
const TRAP_CARD = "47034";
const ARCADE_CONSTANT = "47030.arcade-constant";
const ARCADE_REVEAL = "47030.when-revealed";
const WELCOME_DEFEATED = "47031.when-defeated";
const FUNHOUSE_DEFEATED = "47032.when-defeated";
const MIRRORS_DEFEATED = "47033.when-defeated";
const TRAP_REVEAL = "47034.when-revealed";
const SCHEMES = [WELCOME, FUNHOUSE, MIRRORS] as const;
/** A different Trap, dealt to the other player in a 2-player round: it resolves nothing when revealed. */
const FILLER: Readonly<Record<string, string>> = { [WELCOME]: FUNHOUSE, [FUNHOUSE]: MIRRORS, [MIRRORS]: FUNHOUSE };
/** Core boost cards of 1 icon with no boost ability (Caught Off Guard, Gang-Up). */
const BOOST_1 = "01188";
const BOOST_2 = "01189";
/** Spider-Man's hero form ATK (Core 01001a). */
const SPIDER_MAN_ATK = 2;
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, ARCADE) };

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
type Seats = readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL)[];

const SET = JUBILEE_CARDS.filter((c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("arcade")));

function setupGame(players: Seats = [SPIDER_MAN]): GameState {
  const config = coreScenario("rhino", {
    players,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...JUBILEE_CARDS],
  });
  const copies = SET.flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const piles = (s: GameState) => Object.values(s.encounterDecks)[0]!;
const inEncounterDiscard = (s: GameState, code: string) => piles(s).discard.filter((id) => codeOf(s, id) === code);
const inEncounterDeck = (s: GameState, code: string) => piles(s).deck.filter((id) => codeOf(s, id) === code);
const inVillainArea = (s: GameState, code: string) => s.villainArea.filter((id) => codeOf(s, id) === code);
const stunned = (s: GameState, p: PlayerId) => inst(s, identityOf(s, p)).statuses.stunned ?? 0;
const confused = (s: GameState, p: PlayerId) => inst(s, identityOf(s, p)).statuses.confused ?? 0;
const damageOf = (s: GameState, p: PlayerId) => inst(s, identityOf(s, p)).damage;
const threatOf = (s: GameState, id: InstanceId) => inst(s, id).threat;
const dataOf = (code: string) =>
  JUBILEE_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
/** Copies of a card that are in play as minions, engaged with a player. */
const minionsOf = (s: GameState, code: string): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((id) => codeOf(s, id) === code && inst(s, id).engagedWith !== null);

interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}
/** The players in the order they act and are dealt encounter cards: the first player (the one to act) first. */
function turnOrder(state: GameState): PlayerId[] {
  const ids = state.players.map((p) => p.playerId);
  const first = state.step.phase === "player" && state.step.kind === "turn" ? state.step.activePlayerId : ids[0]!;
  const at = ids.indexOf(first);
  return [...ids.slice(at), ...ids.slice(0, at)];
}
/** The cards to deal in a 2-player round, named by player: `byPlayer` maps each player to the card they are dealt. */
const dealt = (state: GameState, byPlayer: Readonly<Record<string, string>>): string[] =>
  turnOrder(state).map((id) => byPlayer[id]!);

/**
 * Every player ends their turn (in hero form when `hero`), and the villain phase runs. `boosts` are the boost cards of
 * the villain's activations (one each, in order), `reveals` the cards the players are dealt, in player order, then any
 * further cards the discard-until effects will meet. Setup leaves every player in alter-ego form: Rhino schemes.
 */
function round(
  state: GameState,
  opts: { boosts?: readonly string[]; reveals?: readonly string[]; hero?: boolean },
): Run {
  const players = state.players.length;
  const boosts = opts.boosts ?? [BOOST_1, BOOST_2].slice(0, players);
  const stacked = stackEncounterDeck(state, ...boosts, ...(opts.reveals ?? []));
  const order = turnOrder(state);
  const commands = order.flatMap((id) => [...(opts.hero ? [toHero(id)] : []), endTurn(id)]);
  return driveEvents(DEPS, stacked, ...commands);
}
const control = (state: GameState): Run => round(state, { reveals: [] });

/** The main scheme back at no threat, so a later round's scheme steps cannot end the game (staging, not a rule). */
const calm = (s: GameState): GameState => patchInstance(s, s.mainScheme.instanceId, { threat: 0 });

/** The player `who` (default the one to act) thwarts the last threat of `id` with a real basic thwart in hero form. */
function defeatScheme(s0: GameState, id: InstanceId, who?: PlayerId): GameState {
  const active = s0.step.phase === "player" && s0.step.kind === "turn" ? s0.step.activePlayerId : P1;
  const player = who ?? active;
  let s = patchInstance(s0, id, { threat: 1 });
  for (const p of s.players) s = withForm(s, { heroForm: 0 }, p.playerId);
  const commands = player === active ? [] : [endTurn(active)];
  return driveEvents(DEPS, s, ...commands, {
    type: "basicThwart",
    playerId: player,
    thwarterInstanceId: identityOf(s, player),
    schemeInstanceId: id,
  }).state;
}

describe("registry", () => {
  it("registers the six refs of the five cards, each a valid definition", () => {
    expect(Object.keys(ARCADE).sort()).toEqual(
      [ARCADE_CONSTANT, ARCADE_REVEAL, WELCOME_DEFEATED, FUNHOUSE_DEFEATED, MIRRORS_DEFEATED, TRAP_REVEAL].sort(),
    );
    for (const [id, def] of Object.entries(ARCADE)) expect(validateDefinition(def), id).toEqual([]);
  });

  it("the set's five cards are in the encounter deck of a Rhino game that asked for it", () => {
    const s = setupGame();
    for (const code of [ARCADE_CODE, WELCOME, FUNHOUSE, MIRRORS, TRAP_CARD])
      expect(inEncounterDeck(s, code), code).toHaveLength(1);
  });
});

describe("Arcade (47030)", () => {
  it("is data: a unique minion, SCH 2, ATK 2, 3 hit points, 3 boost icons, no keyword", () => {
    const card = dataOf(ARCADE_CODE);
    expect(card.type).toBe("minion");
    expect([card.sch, card.atk, card.hp, card.boostIcons]).toEqual([2, 2, 3, 3]);
    expect(card.unique).toBe(true);
    expect(card.keywords).toEqual([]);
  });

  it("ARCADE_REVEAL: discards a non-Trap card, then reveals the first TRAP! side scheme it meets (1 player)", () => {
    const run = round(setupGame(), { reveals: [ARCADE_CODE, BOOST_2, FUNHOUSE, WELCOME] });
    // Gang-Up (BOOST_2) was passed over into the discard pile; Funhouse is the first Trap and was revealed.
    expect(inEncounterDiscard(run.state, BOOST_2)).toHaveLength(1);
    expect(inVillainArea(run.state, FUNHOUSE)).toHaveLength(1);
    expect(inEncounterDiscard(run.state, FUNHOUSE)).toHaveLength(0);
    // The second Trap was never reached: it is still in the deck.
    expect(inEncounterDeck(run.state, WELCOME)).toHaveLength(1);
    // Arcade is in play, engaged with the revealing player.
    const arcade = minionsOf(run.state, ARCADE_CODE);
    expect(arcade).toHaveLength(1);
    expect(inst(run.state, arcade[0]!).engagedWith).toBe(P1);
  });

  it("ARCADE_REVEAL: a Trap that is already on top is revealed with nothing else discarded", () => {
    const run = round(setupGame(), { reveals: [ARCADE_CODE, MIRRORS] });
    expect(inVillainArea(run.state, MIRRORS)).toHaveLength(1);
    expect(inEncounterDiscard(run.state, BOOST_2)).toHaveLength(0);
  });

  it("ARCADE_REVEAL: the Trap that enters play has its starting threat", () => {
    const run = round(setupGame(), { reveals: [ARCADE_CODE, WELCOME] });
    expect(threatOf(run.state, inVillainArea(run.state, WELCOME)[0]!)).toBe(3);
  });

  it("ARCADE_REVEAL: 2 players, the card dealt to player 2 is Arcade: he engages player 2 and player 2 reveals the Trap", () => {
    const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const run = round(s, { reveals: [...dealt(s, { [P1]: MIRRORS, [P2]: ARCADE_CODE }), WELCOME] });
    const arcade = minionsOf(run.state, ARCADE_CODE)[0]!;
    expect(inst(run.state, arcade).engagedWith).toBe(P2);
    expect(inVillainArea(run.state, WELCOME)).toHaveLength(1);
    expect(inVillainArea(run.state, MIRRORS)).toHaveLength(1);
  });

  it("ARCADE_CONSTANT: while a TRAP! side scheme is in play an attack on Arcade deals no damage", () => {
    const s0 = round(setupGame(), { reveals: [ARCADE_CODE, WELCOME] }).state;
    const arcade = minionsOf(s0, ARCADE_CODE)[0]!;
    const s = withForm(s0, { heroForm: 0 });
    // The engine refuses the attack outright: Arcade is not a legal target of damage while the Trap is in play.
    expect(() =>
      driveEvents(DEPS, s, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(s, P1),
        targetInstanceId: arcade,
      }),
    ).toThrow(/cannot take damage/);
    expect(inst(s, arcade).damage).toBe(0);
  });

  it("ARCADE_CONSTANT: once the last Trap is defeated the same attack deals its damage (the Trap and Arcade, then no Trap)", () => {
    const s0 = round(setupGame(), { reveals: [ARCADE_CODE, MIRRORS] }).state;
    const arcade = minionsOf(s0, ARCADE_CODE)[0]!;
    const trap = inVillainArea(s0, MIRRORS)[0]!;
    const noTrap = defeatScheme(s0, trap);
    expect(inVillainArea(noTrap, MIRRORS)).toHaveLength(0);
    const ready = patchInstance(noTrap, identityOf(noTrap, P1), { exhausted: false });
    const after = driveEvents(DEPS, ready, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(ready, P1),
      targetInstanceId: arcade,
    }).state;
    expect(inst(after, arcade).damage).toBe(SPIDER_MAN_ATK);
  });

  it("ARCADE_CONSTANT: only Arcade is protected: the villain still takes damage while a Trap is in play", () => {
    const s0 = round(setupGame(), { reveals: [ARCADE_CODE, WELCOME] }).state;
    const s = withForm(s0, { heroForm: 0 });
    const villain = s.villains[0]!.instanceId;
    const after = driveEvents(DEPS, s, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(s, P1),
      targetInstanceId: villain,
    }).state;
    expect(inst(after, villain).damage).toBe(SPIDER_MAN_ATK);
  });

  it("as a boost card its 3 icons add 3 to Rhino's scheme (alter-ego), and it is discarded without being revealed", () => {
    const s = setupGame();
    const base = control(s);
    const run = round(s, { boosts: [ARCADE_CODE], reveals: [] });
    expect(mainThreat(run.state) - mainThreat(base.state)).toBe(2);
    expect(inEncounterDiscard(run.state, ARCADE_CODE)).toHaveLength(1);
    expect(minionsOf(run.state, ARCADE_CODE)).toHaveLength(0);
    expect(inVillainArea(run.state, FUNHOUSE)).toHaveLength(0);
  });
});

describe.each([
  { code: WELCOME, name: "Welcome to Murderworld", icons: ["hazard"], boost: 2 },
  { code: FUNHOUSE, name: "Arcade's Funhouse", icons: [], boost: 2 },
  { code: MIRRORS, name: "Hall of Mirrors", icons: ["crisis"], boost: 2 },
])("$name ($code), the common shape of a TRAP! side scheme", ({ code, icons, boost }) => {
  it("is data: a TRAP! side scheme with 2 threat, hinder 1 per hero, the printed icons and 2 boost icons", () => {
    const card = dataOf(code);
    expect(card.type).toBe("side_scheme");
    expect(card.startingThreat).toEqual({ base: 2, perPlayer: 0 });
    expect(card.icons).toEqual(icons);
    expect(card.boostIcons).toBe(boost);
    expect(card.keywords).toEqual([{ name: "hinder", value: 0, perPlayer: 1 }]);
  });

  it("revealed in the villain phase it enters the villain area with 2 threat plus 1 per hero by hinder: 3 with 1 player", () => {
    const run = round(setupGame(), { reveals: [code] });
    expect(threatOf(run.state, inVillainArea(run.state, code)[0]!)).toBe(3);
  });

  it("revealed with 2 players it enters with 4 threat", () => {
    const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const run = round(s, { reveals: dealt(s, { [P1]: code, [P2]: FILLER[code]! }) });
    expect(threatOf(run.state, inVillainArea(run.state, code)[0]!)).toBe(4);
  });

  it("as a boost card its 2 icons add 1 more than the 1-icon baseline to Rhino's scheme, and it is discarded", () => {
    const s = setupGame();
    const base = control(s);
    const run = round(s, { boosts: [code], reveals: [] });
    expect(mainThreat(run.state) - mainThreat(base.state)).toBe(1);
    expect(inEncounterDiscard(run.state, code)).toHaveLength(1);
    expect(inVillainArea(run.state, code)).toHaveLength(0);
  });

  it("does nothing when it is merely revealed or boosted: no damage and no status for the player", () => {
    const run = round(setupGame(), { reveals: [code] });
    const base = control(setupGame());
    expect([damageOf(run.state, P1), stunned(run.state, P1), confused(run.state, P1)]).toEqual([
      damageOf(base.state, P1),
      0,
      0,
    ]);
  });
});

describe("Welcome to Murderworld (47031)", () => {
  it("its hazard icon deals one additional encounter card in the next villain phase", () => {
    const s = round(setupGame(), { reveals: [WELCOME] }).state;
    const next = round(s, { boosts: [BOOST_1], reveals: [MIRRORS, FUNHOUSE] });
    expect(inVillainArea(next.state, MIRRORS)).toHaveLength(1);
    expect(inVillainArea(next.state, FUNHOUSE)).toHaveLength(1);
    const baseline = round(setupGame(), { boosts: [BOOST_1], reveals: [MIRRORS, FUNHOUSE] });
    expect(inVillainArea(baseline.state, FUNHOUSE)).toHaveLength(0);
  });

  it("WELCOME_DEFEATED: the player who thwarted the last threat takes 2 damage (1 player)", () => {
    const s0 = round(setupGame(), { reveals: [WELCOME] }).state;
    const id = inVillainArea(s0, WELCOME)[0]!;
    const before = damageOf(s0, P1);
    const after = defeatScheme(s0, id);
    expect(inVillainArea(after, WELCOME)).toHaveLength(0);
    expect(damageOf(after, P1)).toBe(before + 2);
  });

  it.each(["first", "second"] as const)(
    "WELCOME_DEFEATED: 2 players, the %s player to act defeats it and only they take 2",
    (who) => {
      const s0 = round(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), { reveals: [WELCOME, FUNHOUSE] }).state;
      const id = inVillainArea(s0, WELCOME)[0]!;
      const first = s0.step.phase === "player" && s0.step.kind === "turn" ? s0.step.activePlayerId : P1;
      const second = first === P1 ? P2 : P1;
      const defeater = who === "first" ? first : second;
      const other = who === "first" ? second : first;
      const after = defeatScheme(s0, id, defeater);
      expect(inVillainArea(after, WELCOME)).toHaveLength(0);
      expect(damageOf(after, defeater)).toBe(damageOf(s0, defeater) + 2);
      expect(damageOf(after, other)).toBe(damageOf(s0, other));
    },
  );
});

describe("Arcade's Funhouse (47032)", () => {
  it("its amplify icon adds 1 threat to the main scheme in the next villain phase", () => {
    const s = round(setupGame(), { reveals: [FUNHOUSE] }).state;
    const next = round(s, { boosts: [BOOST_1], reveals: [] });
    const baseline = round(setupGame(), { boosts: [BOOST_1], reveals: [] });
    // Two rounds against one: round 1's own scheme step is the same in both, round 2 differs by the amplify icon.
    const roundOne = mainThreat(round(setupGame(), { reveals: [FUNHOUSE] }).state);
    expect(mainThreat(next.state) - roundOne).toBe(mainThreat(baseline.state) - mainThreat(setupGame()) + 1);
  });

  it("FUNHOUSE_DEFEATED: a player who is not stunned is stunned and discards nothing", () => {
    const s0 = round(setupGame(), { reveals: [FUNHOUSE] }).state;
    const ally = playFromHand(DEPS, s0, "01059", 3);
    const s = ally.state;
    expect(stunned(s, P1)).toBe(0);
    const after = defeatScheme(s, inVillainArea(s, FUNHOUSE)[0]!);
    expect(stunned(after, P1)).toBe(1);
    expect(playerOf(after, P1).playArea).toContain(ally.id);
    expect(playerOf(after, P1).discard).not.toContain(ally.id);
  });

  it("FUNHOUSE_DEFEATED: an already stunned player discards an ally they control and stays stunned", () => {
    const s0 = round(setupGame(), { reveals: [FUNHOUSE] }).state;
    const ally = playFromHand(DEPS, s0, "01059", 3);
    const s = patchInstance(ally.state, identityOf(ally.state, P1), {
      statuses: { stunned: 1, confused: 0, tough: 0 },
    });
    const after = defeatScheme(s, inVillainArea(s, FUNHOUSE)[0]!);
    expect(stunned(after, P1)).toBe(1);
    expect(playerOf(after, P1).playArea).not.toContain(ally.id);
    expect(playerOf(after, P1).discard).toContain(ally.id);
  });

  it("FUNHOUSE_DEFEATED: an already stunned player with no ally or upgrade discards nothing", () => {
    const s0 = round(setupGame(), { reveals: [FUNHOUSE] }).state;
    const s = patchInstance(s0, identityOf(s0, P1), { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const before = playerOf(s, P1).discard.length;
    const after = defeatScheme(s, inVillainArea(s, FUNHOUSE)[0]!);
    expect(stunned(after, P1)).toBe(1);
    expect(playerOf(after, P1).discard.length).toBe(before);
  });

  it("FUNHOUSE_DEFEATED: 2 players, only the defeating player is stunned or discards", () => {
    const s0 = round(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), { reveals: [FUNHOUSE, MIRRORS] }).state;
    const id = inVillainArea(s0, FUNHOUSE)[0]!;
    const after = defeatScheme(s0, id, P2);
    expect(stunned(after, P2)).toBe(1);
    expect(stunned(after, P1)).toBe(0);
  });
});

describe("Hall of Mirrors (47033)", () => {
  it("its crisis icon stops the main scheme being thwarted while it is in play", () => {
    const s0 = round(setupGame(), { reveals: [MIRRORS] }).state;
    const s = withForm(s0, { heroForm: 0 });
    expect(() =>
      driveEvents(DEPS, s, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(s, P1),
        schemeInstanceId: s.mainScheme.instanceId,
      }),
    ).toThrow(/crisis/);
  });

  it("MIRRORS_DEFEATED: a player who is not confused is confused and the main scheme gains nothing", () => {
    const s0 = round(setupGame(), { reveals: [MIRRORS] }).state;
    const main = mainThreat(s0);
    const after = defeatScheme(s0, inVillainArea(s0, MIRRORS)[0]!);
    expect(confused(after, P1)).toBe(1);
    expect(mainThreat(after)).toBe(main);
  });

  it("MIRRORS_DEFEATED: an already confused player (defeating it with an ally's thwart) puts 2 threat on the main scheme and stays confused", () => {
    const s0 = round(setupGame(), { reveals: [MIRRORS] }).state;
    const ally = playFromHand(DEPS, s0, "01059", 3);
    const id = inVillainArea(ally.state, MIRRORS)[0]!;
    // A confused hero's own thwart would only remove the status, so the ally makes the thwart.
    let s = patchInstance(ally.state, identityOf(ally.state, P1), { statuses: { stunned: 0, confused: 1, tough: 0 } });
    s = patchInstance(patchInstance(s, ally.id, { exhausted: false }), id, { threat: 1 });
    const main = mainThreat(s);
    const after = driveEvents(DEPS, s, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: ally.id,
      schemeInstanceId: id,
    }).state;
    expect(inVillainArea(after, MIRRORS)).toHaveLength(0);
    expect(mainThreat(after)).toBe(main + 2);
    expect(confused(after, P1)).toBe(1);
  });

  it("MIRRORS_DEFEATED: 2 players, only the defeating player is confused", () => {
    const s0 = round(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), { reveals: [MIRRORS, FUNHOUSE] }).state;
    const after = defeatScheme(s0, inVillainArea(s0, MIRRORS)[0]!, P2);
    expect(confused(after, P2)).toBe(1);
    expect(confused(after, P1)).toBe(0);
  });
});

describe("Elaborate Trap (47034)", () => {
  it("is data: a treachery with 1 boost icon and no keyword", () => {
    const card = dataOf(TRAP_CARD);
    expect(card.type).toBe("treachery");
    expect(card.boostIcons).toBe(1);
    expect(card.keywords).toEqual([]);
  });

  it("TRAP_REVEAL: with no TRAP! side scheme in play it discards until one and reveals it", () => {
    const run = round(setupGame(), { reveals: [TRAP_CARD, BOOST_2, WELCOME, MIRRORS] });
    expect(inEncounterDiscard(run.state, BOOST_2)).toHaveLength(1);
    expect(inVillainArea(run.state, WELCOME)).toHaveLength(1);
    // Nothing was resolved by a defeat: no damage to the player.
    expect(damageOf(run.state, P1)).toBe(damageOf(control(setupGame()).state, P1));
    expect(inEncounterDiscard(run.state, TRAP_CARD)).toHaveLength(1);
    expect(inEncounterDeck(run.state, MIRRORS)).toHaveLength(1);
  });

  it("TRAP_REVEAL: with a Trap in play it resolves that Trap's When Defeated, leaves the Trap in play and discards nothing more", () => {
    const s = calm(round(setupGame(), { reveals: [FUNHOUSE] }).state);
    const trap = inVillainArea(s, FUNHOUSE)[0]!;
    const run = round(s, { boosts: [BOOST_1], reveals: [TRAP_CARD, MIRRORS] });
    expect(stunned(run.state, P1)).toBe(1);
    expect(inVillainArea(run.state, FUNHOUSE)).toEqual([trap]);
    expect(threatOf(run.state, trap)).toBe(threatOf(s, trap));
    // "If no abilities were resolved": one was, so no further Trap was found and revealed.
    expect(inVillainArea(run.state, MIRRORS)).toHaveLength(0);
    expect(inEncounterDeck(run.state, MIRRORS)).toHaveLength(1);
    expect(inEncounterDiscard(run.state, TRAP_CARD)).toHaveLength(1);
  });

  it("TRAP_REVEAL: Welcome to Murderworld in play (1 player): the player takes 2 damage and the Trap stays in play", () => {
    const s = calm(round(setupGame(), { reveals: [WELCOME] }).state);
    const trap = inVillainArea(s, WELCOME)[0]!;
    // Welcome's hazard icon deals one more card after Elaborate Trap: Hall of Mirrors, which does nothing on its own.
    const run = round(s, { boosts: [BOOST_1], reveals: [TRAP_CARD, MIRRORS] });
    expect(damageOf(run.state, P1)).toBe(damageOf(s, P1) + 2);
    expect(inVillainArea(run.state, WELCOME)).toEqual([trap]);
    expect(inVillainArea(run.state, MIRRORS)).toHaveLength(1);
  });

  it.each(["first", "second"] as const)(
    "TRAP_REVEAL: 2 players, the %s player to be dealt it resolves every Trap in play for themselves and only them",
    (who) => {
      const s0 = calm(round(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), { reveals: [FUNHOUSE, MIRRORS] }).state);
      const [a, b] = turnOrder(s0) as [PlayerId, PlayerId];
      const revealer = who === "first" ? a : b;
      const other = who === "first" ? b : a;
      // Welcome to Murderworld is the other player's card: when it is dealt first it is in play, and resolved, too.
      const run = round(s0, { reveals: dealt(s0, { [revealer]: TRAP_CARD, [other]: WELCOME }) });
      const welcomeFirst = who === "second";
      expect(stunned(run.state, revealer)).toBe(1);
      expect(confused(run.state, revealer)).toBe(1);
      expect(damageOf(run.state, revealer)).toBe(damageOf(s0, revealer) + (welcomeFirst ? 2 : 0));
      expect(stunned(run.state, other)).toBe(0);
      expect(confused(run.state, other)).toBe(0);
      expect(damageOf(run.state, other)).toBe(damageOf(s0, other));
      expect(inVillainArea(run.state, FUNHOUSE)).toHaveLength(1);
      expect(inVillainArea(run.state, MIRRORS)).toHaveLength(1);
    },
  );

  it("TRAP_REVEAL: an already confused player who reveals it with Hall of Mirrors in play puts 2 threat on the main scheme", () => {
    const s0 = round(setupGame(), { reveals: [MIRRORS] }).state;
    const s = patchInstance(s0, identityOf(s0, P1), { statuses: { stunned: 0, confused: 1, tough: 0 } });
    const base = control(s).state;
    const run = round(s, { boosts: [BOOST_1], reveals: [TRAP_CARD] });
    expect(mainThreat(run.state)).toBe(mainThreat(base) + 2);
    expect(confused(run.state, P1)).toBe(1);
  });

  it("as a boost card its 1 icon is the baseline and nothing is resolved", () => {
    const s = round(setupGame(), { reveals: [WELCOME] }).state;
    const base = control(s);
    const run = round(s, { boosts: [TRAP_CARD], reveals: [] });
    expect(mainThreat(run.state)).toBe(mainThreat(base.state));
    expect(damageOf(run.state, P1)).toBe(damageOf(base.state, P1));
    expect(inEncounterDiscard(run.state, TRAP_CARD)).toHaveLength(1);
  });
});

describe("the set's schemes together", () => {
  it("every Trap of the set is a side scheme the reveal effects can find (all three reachable)", () => {
    for (const code of SCHEMES) {
      const run = round(setupGame(), { reveals: [ARCADE_CODE, code] });
      expect(inVillainArea(run.state, code), code).toHaveLength(1);
    }
  });
});
