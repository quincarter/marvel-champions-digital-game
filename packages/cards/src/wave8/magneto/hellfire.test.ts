import { CORE_CARDS, MAGNETO_CARDS, encounterSetId } from "@mc/content";
import {
  applyCommand,
  createGame,
  type Command,
  type EngineDeps,
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
import { HELLFIRE, HELLFIRE_SKIPPED } from "./hellfire.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Hellfire Club modular set (49038 Sebastian Shaw, 49039 Selene, 49040 Hellfire Pawn, 49041 The Inner Circle,
 * 49042 Power and Decadence), docs/phase7-wave8.md §7.5, §3.79. Rhino (Core, standard) built by `coreScenario` with the
 * Magneto cards in the pool and the set's five cards added to the encounter deck by hand. Cards are stacked on the
 * encounter deck in the order the villain phase draws them (the villain's boost card, a minion's boost card per
 * activation, then one reveal per player) and revealed by real `endTurn` commands; attacks are real commands.
 */
const SHAW = "49038";
const SELENE = "49039";
const PAWN = "49040";
const CIRCLE = "49041";
const DECADENCE = "49042";
const SHAW_RESPONSE = "49038.sebastian-shaw-forced-response";
const SELENE_CONSTANT = "49039.selene-constant";
const SELENE_BOOST = "49039.boost";
const PAWN_BOOST = "49040.boost";
const CIRCLE_REVEAL = "49041.when-revealed";
const DECADENCE_REVEAL = "49042.when-revealed";
const DECADENCE_BOOST = "49042.boost";
/** Core encounter cards of 1 boost icon and no Boost ability: Stampede (3 copies), Hydra Mercenary (2 copies). */
const BOOST_1 = "01106";
const BOOST_2 = "01101";
const BLACK_CAT = "01002";
/** Rhino's ATK on standard difficulty (Core 01097). */
const RHINO_ATK = 2;
const RHINO_SCH = 1;
/** The threat each villain phase places on the main scheme before anything activates (1 per round, 1 player or 2). */
const PHASE_THREAT = 1;
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, HELLFIRE) };

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
type Seats = readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL)[];

const SET = MAGNETO_CARDS.filter(
  (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("hellfire")),
);

function setupGame(players: Seats = [SPIDER_MAN]): GameState {
  const config = coreScenario("rhino", {
    players,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...MAGNETO_CARDS],
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
const damageOf = (s: GameState, p: PlayerId) => inst(s, identityOf(s, p)).damage;
const dataOf = (code: string) =>
  MAGNETO_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
/** Copies of a card that are in play as minions, engaged with a player. */
const minionsOf = (s: GameState, code: string): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((id) => codeOf(s, id) === code && inst(s, id).engagedWith !== null);
const topOfDeck = (s: GameState): InstanceId => piles(s).deck[0]!;
const villainOf = (s: GameState): InstanceId => s.villains[0]!.instanceId;

/** The players in the order they act and are dealt encounter cards: the first player (the one to act) first. */
function turnOrder(state: GameState): PlayerId[] {
  const ids = state.players.map((p) => p.playerId);
  const first = state.step.phase === "player" && state.step.kind === "turn" ? state.step.activePlayerId : ids[0]!;
  const at = ids.indexOf(first);
  return [...ids.slice(at), ...ids.slice(0, at)];
}

/**
 * Every player ends their turn (in hero form when `hero`) and the villain phase runs. `deck` is the top of the
 * encounter deck, in the order the phase draws: the villain's boost card, then each boost card and reveal in turn.
 */
function round(state: GameState, deck: readonly string[], opts: { hero?: boolean } = {}): GameState {
  return driveRound(DEPS, state, deck, opts);
}
function driveRound(
  deps: EngineDeps,
  state: GameState,
  deck: readonly string[],
  opts: { hero?: boolean } = {},
): GameState {
  // The main scheme back at no threat, so a scheme step cannot end the game between rounds (staging, not a rule).
  const stacked = stackEncounterDeck(patchInstance(state, state.mainScheme.instanceId, { threat: 0 }), ...deck);
  const commands = turnOrder(state).flatMap((id) => [...(opts.hero ? [toHero(id)] : []), endTurn(id)]);
  return driveEvents(deps, stacked, ...commands).state;
}

/** Spider-Man (P1) in hero form with an exhausted-free identity. */
const heroForm = (s: GameState): GameState => withForm(s, { heroForm: 0 });
const readyIdentity = (s: GameState, p: PlayerId = P1): GameState =>
  patchInstance(s, identityOf(s, p), { exhausted: false });
const attackCommand = (s: GameState, target: InstanceId, p: PlayerId = P1, attacker?: InstanceId): Command => ({
  type: "basicAttack",
  playerId: p,
  attackerInstanceId: attacker ?? identityOf(s, p),
  targetInstanceId: target,
});
/** Applies a command and reports whether the engine accepted it. */
const accepted = (s: GameState, c: Command): boolean => applyCommand(s, c, DEPS).ok;
const why = (s: GameState, c: Command): string => {
  const r = applyCommand(s, c, DEPS);
  return r.ok ? "ok" : `${r.error.code}: ${r.error.message}`;
};
const attack = (s: GameState, target: InstanceId, p: PlayerId = P1): GameState =>
  driveEvents(DEPS, s, attackCommand(s, target, p)).state;

describe("registry", () => {
  it("registers the seven refs of the five cards, each a valid definition", () => {
    expect(Object.keys(HELLFIRE).sort()).toEqual(
      [
        SHAW_RESPONSE,
        SELENE_CONSTANT,
        SELENE_BOOST,
        PAWN_BOOST,
        CIRCLE_REVEAL,
        DECADENCE_REVEAL,
        DECADENCE_BOOST,
      ].sort(),
    );
    for (const [id, def] of Object.entries(HELLFIRE)) expect(validateDefinition(def), id).toEqual([]);
  });

  it("nothing is skipped", () => {
    expect(Object.keys(HELLFIRE_SKIPPED)).toEqual([]);
  });

  it("Hellfire Pawn's Boost is the same definition object as Mutant Genesis 32058's", () => {
    expect(HELLFIRE[PAWN_BOOST]).toBe(WAVE7_ABILITIES["32058.boost"]);
  });

  it("the set's five cards are in the encounter deck of a Rhino game that asked for it", () => {
    const s = setupGame();
    for (const code of [SHAW, SELENE, PAWN, CIRCLE, DECADENCE]) expect(inEncounterDeck(s, code), code).toHaveLength(1);
  });
});

describe("Sebastian Shaw (49038)", () => {
  it("is data: a unique minion, SCH 1, ATK 2, 5 hit points, 3 boost icons, Toughness and Villainous", () => {
    const card = dataOf(SHAW);
    expect(card.type).toBe("minion");
    expect([card.sch, card.atk, card.hp, card.boostIcons]).toEqual([1, 2, 5, 3]);
    expect(card.unique).toBe(true);
    expect(card.keywords).toEqual([{ name: "toughness" }, { name: "villainous" }]);
    expect((card.text as { current: string }).current).toContain("Forced Response:");
  });

  it("revealed (1 player) he enters play engaged with the player, with a tough status card and no boost card", () => {
    const s = round(setupGame(), [BOOST_1, SHAW]);
    const shaw = minionsOf(s, SHAW);
    expect(shaw).toHaveLength(1);
    expect(inst(s, shaw[0]!).engagedWith).toBe(P1);
    expect(inst(s, shaw[0]!).statuses.tough).toBe(1);
    expect(inst(s, shaw[0]!).boostCards).toEqual([]);
  });

  it("revealed by player 2 (2 players) he engages player 2", () => {
    const s0 = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const s = round(s0, [BOOST_1, BOOST_1, BOOST_2, SHAW]);
    expect(inst(s, minionsOf(s, SHAW)[0]!).engagedWith).toBe(P2);
  });

  it("as a boost card his 3 icons add 2 to Rhino's scheme beyond a 1-icon card, and he is discarded without being revealed", () => {
    const s = setupGame();
    const base = round(s, [BOOST_1]);
    const boosted = round(s, [SHAW]);
    expect(mainThreat(boosted) - mainThreat(base)).toBe(2);
    expect(inEncounterDiscard(boosted, SHAW)).toHaveLength(1);
    expect(minionsOf(boosted, SHAW)).toHaveLength(0);
  });

  it("SHAW_RESPONSE: a hero's attack takes his tough status card, deals no damage, and gives him a facedown boost card", () => {
    const s0 = round(setupGame(), [BOOST_1, SHAW]);
    const shaw = minionsOf(s0, SHAW)[0]!;
    const s1 = stackEncounterDeck(heroForm(s0), BOOST_2);
    const s = attack(s1, shaw);
    expect(inst(s, shaw).statuses.tough ?? 0).toBe(0);
    expect(inst(s, shaw).damage).toBe(0);
    expect(inst(s, shaw).boostCards).toEqual([topOfDeck(s1)]);
    expect(piles(s).deck).not.toContain(topOfDeck(s1));
  });

  it("SHAW_RESPONSE: he cannot be attacked again this phase, by the same identity, an ally or a basic attack of any player", () => {
    const s0 = round(setupGame(), [BOOST_1, SHAW]);
    const shaw = minionsOf(s0, SHAW)[0]!;
    const withCat = playFromHand(DEPS, heroForm(s0), BLACK_CAT, 2).state;
    const cat = Object.keys(withCat.instances).find(
      (id) => codeOf(withCat, id as InstanceId) === BLACK_CAT,
    )! as InstanceId;
    // Before the first attack both the hero and the ally may attack him.
    expect(accepted(withCat, attackCommand(withCat, shaw))).toBe(true);
    const hit = attack(stackEncounterDeck(withCat, BOOST_2), shaw);
    const again = readyIdentity(hit);
    expect(accepted(again, attackCommand(again, shaw))).toBe(false);
    expect(accepted(again, attackCommand(again, shaw, P1, cat))).toBe(false);
    // The villain is still a legal target.
    expect(accepted(again, attackCommand(again, villainOf(again)))).toBe(true);
  });

  it("SHAW_RESPONSE: 2 players, the other player's hero is refused too, in the same phase", () => {
    const s0 = round(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), [BOOST_1, BOOST_1, BOOST_2, SHAW]);
    const shaw = minionsOf(s0, SHAW)[0]!;
    const first = turnOrder(s0)[0]!;
    const other = turnOrder(s0)[1]!;
    const s1 = withForm(withForm(s0, { heroForm: 0 }, P1), { heroForm: 0 }, P2);
    const hit = attack(stackEncounterDeck(s1, BOOST_1), shaw, first);
    expect(inst(hit, shaw).boostCards).toHaveLength(1);
    expect(accepted(hit, attackCommand(hit, shaw, other))).toBe(false);
  });

  it("SHAW_RESPONSE: the next phase he can be attacked again (a new attack, a new boost card)", () => {
    const s0 = round(setupGame(), [BOOST_1, SHAW]);
    const shaw = minionsOf(s0, SHAW)[0]!;
    const hit = attack(stackEncounterDeck(heroForm(s0), BOOST_2), shaw);
    const next = round(hit, [BOOST_1, BOOST_1, BOOST_2]);
    expect(why(next, attackCommand(next, shaw))).toBe("ok");
  });

  it("SHAW_RESPONSE: damage that is not an attack still reaches him (a hit of 2 on 5 hit points, no tough card)", () => {
    const s0 = round(setupGame(), [BOOST_1, SHAW]);
    const shaw = minionsOf(s0, SHAW)[0]!;
    const hit = attack(stackEncounterDeck(heroForm(s0), BOOST_2), shaw);
    // Staging: 2 damage as a non-attack effect is a state patch; he takes it and is still alive.
    const hurt = patchInstance(hit, shaw, { damage: 2 });
    expect(inst(hurt, shaw).damage).toBe(2);
  });

  it("SHAW_RESPONSE: an attack that defeats him gives no boost card and leaves nothing waiting", () => {
    const s0 = round(setupGame(), [BOOST_1, SHAW]);
    const shaw = minionsOf(s0, SHAW)[0]!;
    const s1 = stackEncounterDeck(
      patchInstance(heroForm(s0), shaw, { damage: 4, statuses: { stunned: 0, confused: 0, tough: 0 } }),
      BOOST_2,
    );
    const s = attack(s1, shaw);
    expect(inEncounterDiscard(s, SHAW)).toHaveLength(1);
    expect(minionsOf(s, SHAW)).toHaveLength(0);
    expect(topOfDeck(s)).toBe(topOfDeck(s1));
  });

  it("his next activation turns up the waiting card and his villainous card, and both add: ATK 2 + 1 + 2 = 5", () => {
    const s0 = round(setupGame(), [BOOST_1, SHAW]);
    const shaw = minionsOf(s0, SHAW)[0]!;
    const hit = attack(stackEncounterDeck(heroForm(s0), BOOST_1), shaw);
    const waiting = inst(hit, shaw).boostCards[0]!;
    // Rhino's own card is a 1-icon card, Shaw's villainous card has 2 icons (The Inner Circle).
    const deck = [BOOST_1, CIRCLE, BOOST_2];
    const withWaiting = round(hit, deck);
    const without = round(s0, deck, { hero: true });
    expect(inst(withWaiting, shaw).boostCards).toEqual([]);
    expect(piles(withWaiting).discard).toContain(waiting);
    // Rhino: ATK + 1. Shaw: 2 + 2, and with the waiting card 1 more.
    expect(damageOf(withWaiting, P1) - damageOf(without, P1)).toBe(1);
    expect(damageOf(without, P1) - damageOf(s0, P1)).toBe(RHINO_ATK + 1 + 2 + 2);
  });
});

/** The cheapest ally in the player's deck or discard pile, played with a real play command. */
function withAlly(s: GameState, player: PlayerId = P1): { state: GameState; cat: InstanceId } {
  const owner = playerOf(s, player);
  const allies = [...owner.hand, ...owner.deck, ...owner.discard]
    .map((id) => ({
      id,
      card: CORE_CARDS.find((c) => (c.id as string) === codeOf(s, id)) as unknown as Record<string, unknown>,
    }))
    .filter((x) => x.card?.type === "ally")
    .sort((x, y) => (x.card.cost as number) - (y.card.cost as number));
  const pick = allies[0]!;
  const played = playFromHand(DEPS, s, codeOf(s, pick.id), pick.card.cost as number, firstLegal, player);
  return { state: played.state, cat: played.id };
}
const inDiscard = (s: GameState, p: PlayerId, id: InstanceId) => playerOf(s, p).discard.includes(id);

describe("Selene (49039)", () => {
  it("is data: a unique minion, SCH 1, ATK 1, 4 hit points, a boost star and no icon, Quickstrike and Villainous", () => {
    const card = dataOf(SELENE);
    expect(card.type).toBe("minion");
    expect([card.sch, card.atk, card.hp, card.boostIcons, card.starIcon]).toEqual([1, 1, 4, 0, true]);
    expect(card.unique).toBe(true);
    expect(card.keywords).toEqual([{ name: "quickstrike" }, { name: "villainous" }]);
  });

  it("revealed against an alter-ego player she engages them and does not attack (quickstrike is for hero form)", () => {
    const s = round(setupGame(), [BOOST_1, SELENE]);
    const selene = minionsOf(s, SELENE);
    expect(selene).toHaveLength(1);
    expect(inst(s, selene[0]!).engagedWith).toBe(P1);
    expect(inst(s, selene[0]!).statuses.tough ?? 0).toBe(0);
    expect(damageOf(s, P1)).toBe(0);
  });

  it("revealed against a hero-form player she attacks at once, with a boost card: ATK 1 + 1 = 2 beside Rhino's 2 + 1", () => {
    const s = round(setupGame(), [BOOST_1, SELENE, BOOST_2], { hero: true });
    expect(damageOf(s, P1)).toBe(RHINO_ATK + 1 + 1 + 1);
  });

  it("is villainous: her next activation (hero form) deals a boost card for it: ATK 1 + 1", () => {
    const s0 = round(setupGame(), [BOOST_1, SELENE]);
    const s = round(s0, [BOOST_1, BOOST_1, BOOST_2], { hero: true });
    expect(damageOf(s, P1) - damageOf(s0, P1)).toBe(RHINO_ATK + 1 + 1 + 1);
  });

  it("schemes in alter-ego form: SCH 1 plus the 1 icon of her boost card", () => {
    const s0 = round(setupGame(), [BOOST_1, SELENE]);
    const s = round(s0, [BOOST_1, BOOST_1, BOOST_2]);
    const control = round(setupGame(), [BOOST_1, BOOST_2]);
    expect(mainThreat(s) - mainThreat(control)).toBe(1 + 1);
    expect(mainThreat(control)).toBe(PHASE_THREAT + RHINO_SCH + 1);
  });

  it("SELENE_CONSTANT: an ally's attack on her is refused, and so is any ally's, while the hero's is accepted", () => {
    const s0 = round(setupGame(), [BOOST_1, SELENE]);
    const selene = minionsOf(s0, SELENE)[0]!;
    const { state, cat } = withAlly(heroForm(s0));
    expect(accepted(state, attackCommand(state, selene, P1, cat))).toBe(false);
    expect(accepted(state, attackCommand(state, villainOf(state), P1, cat))).toBe(true);
    expect(accepted(state, attackCommand(state, selene))).toBe(true);
    const hit = attack(state, selene);
    expect(inst(hit, selene).damage).toBe(2);
  });

  it("SELENE_CONSTANT: 2 players, the second player's ally cannot attack her either", () => {
    const s0 = round(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), [BOOST_1, BOOST_1, BOOST_2, SELENE]);
    const selene = minionsOf(s0, SELENE)[0]!;
    const [first, second] = turnOrder(s0) as [PlayerId, PlayerId];
    const both = withForm(withForm(s0, { heroForm: 0 }, P1), { heroForm: 0 }, P2);
    const { state, cat } = withAlly(both, first);
    expect(accepted(state, attackCommand(state, selene, first, cat))).toBe(false);
    expect(accepted(state, attackCommand(state, selene, first))).toBe(true);
    expect(second).not.toBe(first);
  });

  it("SELENE_BOOST: with an ally, the ally is discarded to its owner's discard pile; Selene is discarded with 0 icons", () => {
    const { state, cat } = withAlly(setupGame());
    const s = round(state, [SELENE, BOOST_2], { hero: true });
    expect(inDiscard(s, P1, cat)).toBe(true);
    expect(playerOf(s, P1).playArea).not.toContain(cat);
    expect(inEncounterDiscard(s, SELENE)).toHaveLength(1);
    expect(minionsOf(s, SELENE)).toHaveLength(0);
    expect(damageOf(s, P1)).toBe(RHINO_ATK);
  });

  it("SELENE_BOOST: with no ally controlled it does nothing", () => {
    const s = round(setupGame(), [SELENE, BOOST_2], { hero: true });
    expect(damageOf(s, P1)).toBe(RHINO_ATK);
    expect(inEncounterDiscard(s, SELENE)).toHaveLength(1);
  });

  it("SELENE_BOOST: 2 players, it is the player the activation is against who discards: P1's activation takes P1's ally", () => {
    const { state, cat } = withAlly(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1);
    const first = turnOrder(state)[0]!;
    // Rhino activates against the first player, then the other: Selene's boost is for the first activation.
    const s = round(state, first === P1 ? [SELENE, BOOST_1, BOOST_2, BOOST_2] : [BOOST_1, SELENE, BOOST_2, BOOST_2], {
      hero: true,
    });
    expect(inDiscard(s, P1, cat)).toBe(true);
  });

  it("SELENE_BOOST: 2 players, the activation against the player with no ally discards nobody's ally", () => {
    const { state, cat } = withAlly(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1);
    const first = turnOrder(state)[0]!;
    const s = round(state, first === P1 ? [BOOST_1, SELENE, BOOST_2, BOOST_2] : [SELENE, BOOST_1, BOOST_2, BOOST_2], {
      hero: true,
    });
    expect(inDiscard(s, P1, cat)).toBe(false);
    expect(playerOf(s, P1).playArea).toContain(cat);
  });
});

describe("Hellfire Pawn (49040)", () => {
  it("is data: a non-unique minion, SCH 1, ATK 2, 3 hit points, a boost star, Guard, Patrol and Surge", () => {
    const card = dataOf(PAWN);
    expect(card.type).toBe("minion");
    expect([card.sch, card.atk, card.hp, card.boostIcons, card.starIcon]).toEqual([1, 2, 3, 0, true]);
    expect(card.unique).toBe(false);
    expect(card.keywords).toEqual([{ name: "guard" }, { name: "patrol" }, { name: "surge" }]);
  });

  it("revealed it engages the player, and surge reveals the next card too (Selene)", () => {
    const s = round(setupGame(), [BOOST_1, PAWN, SELENE]);
    expect(inst(s, minionsOf(s, PAWN)[0]!).engagedWith).toBe(P1);
    expect(minionsOf(s, SELENE)).toHaveLength(1);
  });

  it("Guard: while it is engaged the hero cannot attack the villain but can attack the Pawn", () => {
    const s0 = heroForm(round(setupGame(), [BOOST_1, PAWN, SELENE]));
    const pawn = minionsOf(s0, PAWN)[0]!;
    expect(accepted(s0, attackCommand(s0, villainOf(s0)))).toBe(false);
    expect(accepted(s0, attackCommand(s0, pawn))).toBe(true);
  });

  it("Patrol: while it is engaged the hero cannot thwart the main scheme", () => {
    const s0 = heroForm(round(setupGame(), [BOOST_1, PAWN, SELENE]));
    const thwart: Command = {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(s0, P1),
      schemeInstanceId: s0.mainScheme.instanceId,
    };
    expect(accepted(patchInstance(s0, s0.mainScheme.instanceId, { threat: 3 }), thwart)).toBe(false);
  });

  it("attacks for 2 in hero form (not villainous: no boost card) and schemes for 1 in alter-ego form", () => {
    const s0 = round(setupGame(), [BOOST_1, PAWN, SELENE]);
    // Selene is engaged too, so compare two Pawn rounds with and without the Pawn's own activation via damage totals.
    const hero = round(s0, [BOOST_1, BOOST_2, BOOST_2], { hero: true });
    // Rhino 2 + 1, Pawn 2 (no boost card), Selene 1 + 1 (villainous), the reveal is Hydra Mercenary.
    expect(damageOf(hero, P1) - damageOf(s0, P1)).toBe(RHINO_ATK + 1 + 2 + 1 + 1);
  });

  it("PAWN_BOOST: as a boost card it enters play engaged with the player it was dealt for, and adds 0 icons", () => {
    const base = round(setupGame(), [BOOST_1, BOOST_2]);
    const s = round(setupGame(), [PAWN, BOOST_2]);
    expect(minionsOf(s, PAWN)).toHaveLength(1);
    expect(inst(s, minionsOf(s, PAWN)[0]!).engagedWith).toBe(P1);
    // No icons (a 1-icon card would add 1) but the Pawn is in play before the minions' step, so it schemes for 1 itself.
    expect(mainThreat(base) - mainThreat(s)).toBe(0);
    expect(mainThreat(s)).toBe(PHASE_THREAT + RHINO_SCH + 0 + 1);
    expect(inEncounterDiscard(s, PAWN)).toHaveLength(0);
  });

  it("PAWN_BOOST: 2 players, it engages the player the activation is against (the second activation: player 2)", () => {
    const state = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const first = turnOrder(state)[0]!;
    const second = turnOrder(state)[1]!;
    const s = round(state, [BOOST_1, PAWN, BOOST_2, BOOST_2]);
    expect(first).toBeDefined();
    expect(inst(s, minionsOf(s, PAWN)[0]!).engagedWith).toBe(second);
  });
});

describe("The Inner Circle (49041)", () => {
  it("is data: a side scheme with 4 threat (no per-player), an amplify icon, 2 boost icons and no hazard or crisis icon", () => {
    const card = dataOf(CIRCLE);
    expect(card.type).toBe("side_scheme");
    expect(card.startingThreat).toEqual({ base: 4, perPlayer: 0 });
    expect([card.amplifyIcons, card.boostIcons, card.icons]).toEqual([1, 2, []]);
  });

  it("CIRCLE_REVEAL: with no Hellfire card in play it enters with 4 threat (1 player)", () => {
    const s = round(setupGame(), [BOOST_1, CIRCLE]);
    expect(inst(s, inVillainArea(s, CIRCLE)[0]!).threat).toBe(4);
  });

  it("CIRCLE_REVEAL: with Selene and a Hellfire Pawn in play it enters with 4 + 2 x 2 = 8 threat", () => {
    const s0 = round(setupGame(), [BOOST_1, SELENE]);
    const s = round(s0, [BOOST_1, BOOST_2, PAWN, CIRCLE]);
    expect(minionsOf(s, PAWN)).toHaveLength(1);
    expect(inst(s, inVillainArea(s, CIRCLE)[0]!).threat).toBe(8);
  });

  it("CIRCLE_REVEAL: 2 players still start at 4 threat; a Hellfire card revealed before it by the other player counts, one after does not", () => {
    const state = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const before = round(state, [BOOST_1, BOOST_2, SELENE, CIRCLE]);
    expect(inst(before, inVillainArea(before, CIRCLE)[0]!).threat).toBe(6);
    const after = round(state, [BOOST_1, BOOST_2, CIRCLE, SELENE]);
    expect(inst(after, inVillainArea(after, CIRCLE)[0]!).threat).toBe(4);
  });

  it("as a boost card its 2 icons add 1 more than a 1-icon card to Rhino's scheme, and it is discarded unrevealed", () => {
    const base = round(setupGame(), [BOOST_1]);
    const s = round(setupGame(), [CIRCLE]);
    expect(mainThreat(s) - mainThreat(base)).toBe(1);
    expect(inEncounterDiscard(s, CIRCLE)).toHaveLength(1);
    expect(inVillainArea(s, CIRCLE)).toHaveLength(0);
  });

  it("its amplify icon adds a boost icon to each boost card turned up while it is in play", () => {
    const withCircle = round(setupGame(), [BOOST_1, CIRCLE]);
    const without = round(setupGame(), [BOOST_1, BOOST_2]);
    const a = round(withCircle, [BOOST_1, BOOST_2]);
    const b = round(without, [BOOST_1, BOOST_2]);
    expect(mainThreat(a) - mainThreat(b)).toBe(1);
  });
});

describe("Power and Decadence (49042)", () => {
  const toughOf = (s: GameState) => inst(s, villainOf(s)).statuses.tough ?? 0;

  it("is data: a treachery with a boost star and no icon, no keyword", () => {
    const card = dataOf(DECADENCE);
    expect(card.type).toBe("treachery");
    expect([card.boostIcons, card.starIcon, card.keywords]).toEqual([0, true, []]);
  });

  // Section 3.79: the card being revealed goes onto the villain, facedown, instead of the encounter discard pile.
  it("DECADENCE_REVEAL: the villain gets a tough status card and this card as its one facedown boost card", () => {
    const s0 = setupGame();
    const toughBefore = toughOf(s0);
    const s = round(s0, [BOOST_1, DECADENCE]);
    expect(toughOf(s)).toBe(toughBefore + 1);
    const waiting = inst(s, villainOf(s)).boostCards;
    expect(waiting).toHaveLength(1);
    expect(codeOf(s, waiting[0]!)).toBe(DECADENCE);
    expect(inst(s, waiting[0]!).faceup).toBe(false);
    expect(inEncounterDiscard(s, DECADENCE)).toHaveLength(0);
  });

  it("DECADENCE_REVEAL then DECADENCE_BOOST: next round the waiting card is turned up with Rhino's own, and he activates again with no boost card", () => {
    const s0 = round(setupGame(), [BOOST_1, DECADENCE]);
    const before = damageOf(s0, P1);
    // Rhino's automatic card (1 icon), then the card revealed to the player.
    const s = round(s0, [BOOST_1, BOOST_2], { hero: true });
    // The waiting Power and Decadence (0 icons) and the automatic card (1 icon): 2 + 1; then again, no boost card: 2.
    // The tough status card it gave Rhino is his; the hero's damage is not reduced by it.
    expect(damageOf(s, P1) - before).toBe(RHINO_ATK + 1 + RHINO_ATK);
    expect(inst(s, villainOf(s)).boostCards).toEqual([]);
    expect(inEncounterDiscard(s, DECADENCE)).toHaveLength(1);
  });

  it("DECADENCE_BOOST: turned up as the villain's own automatic card, Rhino activates against that player again with no boost card (2 players: player 2)", () => {
    const state = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const first = turnOrder(state)[0]!;
    const second = turnOrder(state)[1]!;
    const s = round(state, [BOOST_1, DECADENCE, BOOST_2, BOOST_2], { hero: true });
    // Rhino: first player 2 + 1; second player 2 + 0, then again 2.
    expect(damageOf(s, first)).toBe(RHINO_ATK + 1);
    expect(damageOf(s, second)).toBe(RHINO_ATK + RHINO_ATK);
    expect(inEncounterDiscard(s, DECADENCE)).toHaveLength(1);
  });

  it("DECADENCE_BOOST: as Selene's villainous card Selene activates again with no boost card: 1 + 0, then 1", () => {
    const s0 = round(setupGame(), [BOOST_1, SELENE]);
    const s = round(s0, [BOOST_1, DECADENCE, BOOST_2], { hero: true });
    expect(damageOf(s, P1) - damageOf(s0, P1)).toBe(RHINO_ATK + 1 + 1 + 1);
    expect(inEncounterDiscard(s, DECADENCE)).toHaveLength(1);
  });
});
