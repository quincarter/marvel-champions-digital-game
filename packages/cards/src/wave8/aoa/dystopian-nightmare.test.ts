import { AOA_CARDS, CORE_CARDS, encounterSetId } from "@mc/content";
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
  use,
} from "../../testing/harness.js";
import { driveEvents, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { DYSTOPIAN_NIGHTMARE } from "./dystopian-nightmare.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Dystopian Nightmare (45072 Hunted, 45073 War-Weary, 45074 Targeted for Extermination), docs/phase7-wave8.md §2.4,
 * §3.17. Rhino (Core, standard) built by `coreScenario` with the Age of Apocalypse cards in the pool and the set's six
 * cards added to the encounter deck by hand (the set is not in the modular pool). The engine gets this module's registry on top of every earlier wave. Cards are
 * stacked on the encounter deck (the villain's boost card is drawn first, then each player is dealt a card) and
 * revealed by real `endTurn` commands.
 */
const OBLIGATION = "45072.obligation";
const WAR_WEARY_REVEAL = "45073.when-revealed";
const WAR_WEARY_BOOST = "45073.boost";
const DEFEATED = "45074.when-defeated";
const HUNTED = "45072";
const WAR_WEARY = "45073";
const TARGETED = "45074";
/** Core boost cards of 1 icon with no boost ability. */
const BOOST_1 = "01188";
/** A second one for a second activation (the deck holds one copy of each). */
const BOOST_2 = "01189";
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, DYSTOPIAN_NIGHTMARE) };

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
  // The set is not in the modular pool (nothing of wave 8 is selectable): its cards, each as often as the set has
  // copies, are added to Rhino's encounter deck by hand.
  const SET = AOA_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("dystopian_nightmare")),
  );
  const copies = SET.flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const piles = (s: GameState) => Object.values(s.encounterDecks)[0]!;
const inEncounterDiscard = (s: GameState, code: string) => piles(s).discard.filter((id) => codeOf(s, id) === code);
const inVillainArea = (s: GameState, code: string) => s.villainArea.filter((id) => codeOf(s, id) === code);
const inPlayArea = (s: GameState, p: PlayerId, code: string) =>
  playerOf(s, p).playArea.filter((id) => codeOf(s, id) === code);
const stunned = (s: GameState, p: PlayerId) => inst(s, identityOf(s, p)).statuses.stunned ?? 0;
const confused = (s: GameState, p: PlayerId) => inst(s, identityOf(s, p)).statuses.confused ?? 0;
const damageOf = (s: GameState, p: PlayerId) => inst(s, identityOf(s, p)).damage;
/** The emitted data of a card of the set, read loosely (one test file spans three card types). */
const dataOf = (code: string) =>
  AOA_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;

interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}
/**
 * Every player ends their turn (in hero form when `hero`), and the villain phase runs. `boosts` are the boost cards of
 * the villain's activations (one each, in order), `reveals` the cards the players are dealt, in player order, then any
 * additional cards. Setup leaves every player in alter-ego form: Rhino schemes; in hero form he attacks.
 */
function round(
  state: GameState,
  opts: { boosts?: readonly string[]; reveals?: readonly string[]; hero?: boolean },
): Run {
  const players = state.players.length;
  const boosts = opts.boosts ?? [BOOST_1, BOOST_2].slice(0, players);
  const stacked = stackEncounterDeck(state, ...boosts, ...(opts.reveals ?? []));
  const order = state.players.map((p) => p.playerId);
  const commands = order.flatMap((id) => [...(opts.hero ? [toHero(id)] : []), endTurn(id)]);
  return driveEvents(DEPS, stacked, ...commands);
}
/** The same round with no revealed card of the set, for a baseline. */
const control = (state: GameState, opts: { hero?: boolean } = {}) =>
  round(state, { ...opts, boosts: [BOOST_1, BOOST_2].slice(0, state.players.length), reveals: [] });

describe("registry", () => {
  it("registers the four refs of the three cards, each a valid definition", () => {
    expect(Object.keys(DYSTOPIAN_NIGHTMARE).sort()).toEqual([OBLIGATION, WAR_WEARY_BOOST, WAR_WEARY_REVEAL, DEFEATED]);
    for (const [id, def] of Object.entries(DYSTOPIAN_NIGHTMARE)) expect(validateDefinition(def), id).toEqual([]);
  });

  it("the set's six cards are in the encounter deck of a Rhino game that asked for it", () => {
    const s = setupGame();
    const codes = piles(s).deck.map((id) => codeOf(s, id));
    for (const code of [HUNTED, WAR_WEARY, TARGETED])
      expect(
        codes.filter((c) => c === code),
        code,
      ).toHaveLength(2);
  });
});

describe("Hunted (45072)", () => {
  it("is data: an obligation with 2 boost icons and a hazard icon", () => {
    const card = dataOf(HUNTED);
    expect(card.type).toBe("obligation");
    expect(card.boostIcons).toBe(2);
    expect(card.schemeIcons).toEqual(["hazard"]);
  });

  it("revealed in the villain phase it stays in the play area of the player it was dealt to (1 player)", () => {
    const s = setupGame();
    const run = round(s, { reveals: [HUNTED] });
    expect(inPlayArea(run.state, P1, HUNTED)).toHaveLength(1);
    expect(inEncounterDiscard(run.state, HUNTED)).toHaveLength(0);
  });

  it("2 players: only the player it was dealt to has it", () => {
    const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const run = round(s, { reveals: [TARGETED, HUNTED] });
    expect(inPlayArea(run.state, P1, HUNTED)).toHaveLength(0);
    expect(inPlayArea(run.state, P2, HUNTED)).toHaveLength(1);
  });

  it("its hazard icon deals one additional encounter card in the next villain phase (2 cards dealt to the one player instead of 1)", () => {
    const s = setupGame();
    const first = round(s, { reveals: [HUNTED] }).state;
    const second = round(first, { boosts: [BOOST_1], reveals: [TARGETED, TARGETED] });
    // Two side schemes were dealt to the one player: the dealt card and the hazard's additional card.
    expect(inVillainArea(second.state, TARGETED)).toHaveLength(2);
    // Without Hunted in play the same round deals one card.
    const baseline = round(s, { boosts: [BOOST_1], reveals: [TARGETED, TARGETED] });
    expect(inVillainArea(baseline.state, TARGETED)).toHaveLength(1);
  });

  it("as a boost card its 2 icons add 2 to Rhino's scheme, and it is discarded", () => {
    const s = setupGame();
    const base = control(s);
    const withBoost = round(s, { boosts: [HUNTED], reveals: [] });
    const threatOf = (r: Run) => mainThreat(r.state);
    // Rhino: SCH 1 plus the boost icons; the baseline's boost card has 1 icon, Hunted has 2.
    expect(threatOf(withBoost) - threatOf(base)).toBe(1);
    expect(inEncounterDiscard(withBoost.state, HUNTED)).toHaveLength(1);
    expect(inPlayArea(withBoost.state, P1, HUNTED)).toHaveLength(0);
  });

  it("OBLIGATION: Alter-Ego Action, discard a card from your hand: the hand is 1 smaller and Hunted is discarded", () => {
    const s = round(setupGame(), { reveals: [HUNTED] }).state;
    const hunted = inPlayArea(s, P1, HUNTED)[0]!;
    const hand = playerOf(s, P1).hand.length;
    expect(hand).toBeGreaterThan(0);
    const paid = playerOf(s, P1).hand[0]!;
    const after = driveEvents(DEPS, s, use(P1, hunted, OBLIGATION, [], { discard: [paid] })).state;
    expect(playerOf(after, P1).discard).toContain(paid);
    expect(playerOf(after, P1).hand.length).toBe(hand - 1);
    expect(playerOf(after, P1).discard.length).toBe(playerOf(s, P1).discard.length + 1);
    expect(inPlayArea(after, P1, HUNTED)).toHaveLength(0);
    expect(inEncounterDiscard(after, HUNTED)).toHaveLength(1);
  });

  it("OBLIGATION: in hero form the action is not available", () => {
    const s = withForm(round(setupGame(), { reveals: [HUNTED] }).state, { heroForm: 0 });
    const hunted = inPlayArea(s, P1, HUNTED)[0]!;
    expect(() => driveEvents(DEPS, s, use(P1, hunted, OBLIGATION))).toThrow(/useAbility rejected/);
  });

  it("OBLIGATION: with an empty hand the cost cannot be paid", () => {
    const s0 = round(setupGame(), { reveals: [HUNTED] }).state;
    const hunted = inPlayArea(s0, P1, HUNTED)[0]!;
    const s = { ...s0, players: s0.players.map((p) => ({ ...p, hand: [] })) };
    expect(() => driveEvents(DEPS, s, use(P1, hunted, OBLIGATION))).toThrow(/useAbility rejected/);
  });
});

describe("War-Weary (45073)", () => {
  it("is data: a treachery with no boost icon and the star icon", () => {
    const card = dataOf(WAR_WEARY);
    expect(card.type).toBe("treachery");
    expect(card.boostIcons).toBe(0);
    expect(card.starIcon).toBe(true);
  });

  it("WAR_WEARY_REVEAL: a player who is not stunned is stunned and takes no damage", () => {
    const s = setupGame();
    const run = round(s, { reveals: [WAR_WEARY] });
    const base = control(s).state;
    expect(stunned(run.state, P1)).toBe(1);
    expect(damageOf(run.state, P1)).toBe(damageOf(base, P1));
    expect(inEncounterDiscard(run.state, WAR_WEARY)).toHaveLength(1);
  });

  it("WAR_WEARY_REVEAL: a stunned player takes 2 damage instead and stays stunned", () => {
    const s = setupGame();
    const stunnedStart = patchInstance(s, identityOf(s, P1), { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const run = round(stunnedStart, { reveals: [WAR_WEARY] });
    const base = control(stunnedStart).state;
    expect(stunned(run.state, P1)).toBe(1);
    expect(damageOf(run.state, P1)).toBe(damageOf(base, P1) + 2);
  });

  it("WAR_WEARY_REVEAL: 2 players, the card dealt to player 2 changes only player 2", () => {
    const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const base = control(s).state;
    const run = round(s, { reveals: [HUNTED, WAR_WEARY] });
    expect(stunned(run.state, P1)).toBe(0);
    expect(stunned(run.state, P2)).toBe(1);
    expect(damageOf(run.state, P1)).toBe(damageOf(base, P1));
    expect(damageOf(run.state, P2)).toBe(damageOf(base, P2));
  });

  it("WAR_WEARY_REVEAL: 2 players, player 1 stunned and dealt it takes 2 and player 2 is untouched", () => {
    const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const start = patchInstance(s, identityOf(s, P1), { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const base = control(start).state;
    const run = round(start, { reveals: [WAR_WEARY, HUNTED] });
    expect(damageOf(run.state, P1)).toBe(damageOf(base, P1) + 2);
    expect(damageOf(run.state, P2)).toBe(damageOf(base, P2));
    expect(stunned(run.state, P2)).toBe(0);
  });

  it("WAR_WEARY_BOOST: Rhino's attack with this boost card stuns the defending player and adds no damage", () => {
    const s = setupGame();
    const base = control(s, { hero: true }).state;
    const run = round(s, { boosts: [WAR_WEARY], reveals: [], hero: true });
    expect(stunned(run.state, P1)).toBe(1);
    // 0 boost icons against the baseline's 1.
    expect(damageOf(run.state, P1)).toBe(damageOf(base, P1) - 1);
    expect(inEncounterDiscard(run.state, WAR_WEARY)).toHaveLength(1);
  });

  it("WAR_WEARY_BOOST: against a stunned player it deals 2 damage on top of the attack, and the stun stays", () => {
    const s = setupGame();
    const start = patchInstance(s, identityOf(s, P1), { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const run = round(start, { boosts: [WAR_WEARY], reveals: [], hero: true });
    const base = control(start, { hero: true }).state;
    expect(stunned(run.state, P1)).toBe(1);
    expect(damageOf(run.state, P1)).toBe(damageOf(base, P1) - 1 + 2);
  });

  it("WAR_WEARY_BOOST: 2 players, as the boost of the second activation it is resolved for player 2 only", () => {
    const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const run = round(s, { boosts: [BOOST_1, WAR_WEARY], reveals: [], hero: true });
    expect(stunned(run.state, P1)).toBe(0);
    expect(stunned(run.state, P2)).toBe(1);
  });
});

describe("Targeted for Extermination (45074)", () => {
  it("is data: a side scheme with 3 threat at any player count, a crisis icon and 2 boost icons", () => {
    const card = dataOf(TARGETED);
    expect(card.type).toBe("side_scheme");
    expect(card.startingThreat).toEqual({ base: 3, perPlayer: 0 });
    expect(card.icons).toEqual(["crisis"]);
    expect(card.boostIcons).toBe(2);
  });

  it("revealed with 1 player it enters the villain area with 3 threat", () => {
    const run = round(setupGame(), { reveals: [TARGETED] });
    const id = inVillainArea(run.state, TARGETED)[0]!;
    expect(inst(run.state, id).threat).toBe(3);
  });

  it("revealed with 2 players it still has 3 threat (nothing per player)", () => {
    const run = round(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), { reveals: [TARGETED, HUNTED] });
    const id = inVillainArea(run.state, TARGETED)[0]!;
    expect(inst(run.state, id).threat).toBe(3);
  });

  it("as a boost card its 2 icons add 2 to Rhino's scheme and it is discarded", () => {
    const s = setupGame();
    const base = control(s);
    const run = round(s, { boosts: [TARGETED], reveals: [] });
    expect(mainThreat(run.state) - mainThreat(base.state)).toBe(1);
    expect(inEncounterDiscard(run.state, TARGETED)).toHaveLength(1);
  });

  it("DEFEATED: the player who thwarted the last threat is confused (1 player)", () => {
    const s0 = round(setupGame(), { reveals: [TARGETED] }).state;
    const id = inVillainArea(s0, TARGETED)[0]!;
    const s = patchInstance(withForm(patchInstance(s0, id, { threat: 1 }), { heroForm: 0 }), id, { threat: 1 });
    expect(confused(s, P1)).toBe(0);
    const after = driveEvents(DEPS, s, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(s, P1),
      schemeInstanceId: id,
    }).state;
    expect(inVillainArea(after, TARGETED)).toHaveLength(0);
    expect(confused(after, P1)).toBe(1);
  });

  it.each(["first", "second"] as const)("DEFEATED: 2 players, the %s player to act defeats it", (who) => {
    const s0 = round(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), { reveals: [TARGETED, HUNTED] }).state;
    const id = inVillainArea(s0, TARGETED)[0]!;
    const patched = withForm(withForm(patchInstance(s0, id, { threat: 1 }), { heroForm: 0 }, P1), { heroForm: 0 }, P2);
    // The first player passes after each round, so the player who acts first is not always player 1.
    const first = patched.step.phase === "player" && patched.step.kind === "turn" ? patched.step.activePlayerId : P1;
    const second = first === P1 ? P2 : P1;
    const defeater = who === "first" ? first : second;
    const other = who === "first" ? second : first;
    const thwart = {
      type: "basicThwart" as const,
      playerId: defeater,
      thwarterInstanceId: identityOf(patched, defeater),
      schemeInstanceId: id,
    };
    const commands = who === "first" ? [thwart] : [endTurn(first), thwart];
    const after = driveEvents(DEPS, patched, ...commands).state;
    expect(inVillainArea(after, TARGETED)).toHaveLength(0);
    expect(confused(after, defeater)).toBe(1);
    expect(confused(after, other)).toBe(0);
  });

  it("DEFEATED: does not fire when the card is merely revealed or boosted", () => {
    const revealed = round(setupGame(), { reveals: [TARGETED] });
    expect(confused(revealed.state, P1)).toBe(0);
    const boosted = round(setupGame(), { boosts: [TARGETED], reveals: [] });
    expect(confused(boosted.state, P1)).toBe(0);
  });
});
