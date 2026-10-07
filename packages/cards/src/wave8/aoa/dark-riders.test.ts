import { AOA_CARDS, CORE_CARDS, cardId, encounterSetId } from "@mc/content";
import {
  activeEncounterDeckId,
  createGame,
  hasKeyword,
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
  picking,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { DARK_RIDERS } from "./dark-riders.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Dark Riders modular set (45112 Gauntlet, 45113 Barrage, 45114 Hard-Drive, 45115 Tusk, 45116 Psynapse, 45117 The
 * Dark Riders), docs/phase7-wave8.md §2.10, §3.32. Rhino (Core, standard) built by `coreScenario` with the Age of
 * Apocalypse cards in the pool, the set's six cards added to the encounter deck by hand (the set is not in the
 * modular pool; Rhino's own deck has Hydra Mercenaries, minions that are not Dark Riders). Cards are stacked on the encounter deck (the
 * villain's boost card first, one per activation, then each player is dealt a card) and revealed by real `endTurn`
 * commands. The Dark Riders are not villainous, so none of them is dealt a boost card of its own.
 */
const GAUNTLET = "45112";
const BARRAGE = "45113";
const HARD_DRIVE = "45114";
const TUSK = "45115";
const PSYNAPSE = "45116";
const SCHEME = "45117";
const MERCENARY = "01101";
const RIDERS = [GAUNTLET, BARRAGE, HARD_DRIVE, TUSK, PSYNAPSE];
const GAUNTLET_FR = "45112.gauntlet-forced-response";
const BARRAGE_FR = "45113.barrage-forced-response";
const HARD_DRIVE_FR = "45114.hard-drive-forced-response";
const TUSK_FR = "45115.tusk-forced-response";
const TUSK_BOOST = "45115.boost";
const PSYNAPSE_FR = "45116.psynapse-forced-response";
const PSYNAPSE_BOOST = "45116.boost";
const SCHEME_CONSTANT = "45117.the-dark-riders-constant";
const SCHEME_REVEAL = "45117.when-revealed";
/** Core treachery of 1 boost icon with no boost ability. */
const BOOST_1 = "01188";
/** A second one, for a second activation. */
const BOOST_2 = "01189";
/** A core treachery (the villain schemes) as a harmless card for a player to be dealt, or to be discarded. */
const ADVANCE = "01186";
/** A card to deal a player that does nothing (a Rhino attachment) and draws no boost card, unlike a treachery. */
const HARMLESS = "01098";
/** Core attachments to Rhino that change nothing the tests read: Armored Rhino Suit, Enhanced Ivory Horn. */
const FILLERS = ["01098", "01100"];
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, DARK_RIDERS) };

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
  const SET = AOA_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("dark_riders")),
  );
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
const damageOf = (s: GameState, id: InstanceId) => inst(s, id).damage;
const idDamage = (s: GameState, p: PlayerId) => damageOf(s, identityOf(s, p));
const statusesOf = (s: GameState, p: PlayerId) => inst(s, identityOf(s, p)).statuses;
const villain = (s: GameState): InstanceId => s.activeVillainId!;
const dataOf = (code: string) =>
  AOA_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
const types = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const attacksBy = (s: GameState, events: readonly GameEvent[], code: string) =>
  types(events, "attackResolved").filter((a) => codeOf(s, a.enemyInstanceId) === code);
const schemesBy = (s: GameState, events: readonly GameEvent[], code: string) =>
  types(events, "schemeResolved").filter((a) => codeOf(s, a.enemyInstanceId) === code);
const teamworkBy = (s: GameState, events: readonly GameEvent[], code: string) =>
  types(events, "keywordResolved").filter((e) => e.keyword === "teamwork" && codeOf(s, e.instanceId) === code);

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
 * cards the players are dealt, in player order (then any card a revealed side scheme or surge takes), `pick` answers
 * every choice.
 */
function round(
  state: GameState,
  opts: { boosts?: readonly string[]; reveals?: readonly string[]; hero?: readonly PlayerId[]; pick?: Picker },
): Run {
  const players = state.players.length;
  const boosts = opts.boosts ?? [BOOST_1, BOOST_2].slice(0, players);
  // Rhino's main scheme is emptied and each identity healed first so that several rounds never end the game: damage and
  // threat comparisons are between rounds that start the same way.
  const calm = state.players.reduce(
    (acc, p) => patchInstance(acc, p.identity.instanceId, { damage: 0 }),
    patchInstance(state, state.mainScheme.instanceId, { threat: 0 }),
  );
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
    ...(heroes.includes(id) && playerOf(state, id).identity.form !== "hero" ? [toHero(id)] : []),
    endTurn(id),
  ]);
  return driveEventsPicking(DEPS, stacked, opts.pick ?? firstLegal, ...commands);
}
const control = (state: GameState, opts: { hero?: readonly PlayerId[] } = {}) => round(state, { ...opts, reveals: [] });

/** Test surgery: `player` controls a copy of `code` from their deck or hand: an upgrade on their identity, or an ally. */
function withCard(state: GameState, player: PlayerId, code: string): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, player);
  const id = [...owner.hand, ...owner.deck].find((i) => codeOf(state, i) === code)!;
  const host = identityOf(state, player);
  const isUpgrade = CORE_CARDS.find((c) => c.id === cardId(code))!.type === "upgrade";
  const moved: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player
        ? {
            ...p,
            hand: p.hand.filter((i) => i !== id),
            deck: p.deck.filter((i) => i !== id),
            // An upgrade is listed on its host only (as when played); an ally sits in the play area.
            playArea: isUpgrade ? p.playArea : [...p.playArea, id],
          }
        : p,
    ),
  };
  const placed = patchInstance(moved, id, {
    controllerId: player,
    faceup: true,
    attachedTo: isUpgrade ? host : null,
  });
  return {
    state: isUpgrade ? patchInstance(placed, host, { attachments: [...inst(placed, host).attachments, id] }) : placed,
    id,
  };
}

/** Round 1: the card is dealt to player 1 (an alter-ego, so it does not attack) and sits engaged with them. */
function withRider(code: string, players: Seats = [SPIDER_MAN]): GameState {
  const reveals = players.length === 1 ? [code] : [code, HARMLESS];
  return round(setupGame(players), { reveals }).state;
}

describe("registry", () => {
  it("registers the ten refs of the six cards, each a valid definition", () => {
    expect(Object.keys(DARK_RIDERS).sort()).toEqual(
      [
        GAUNTLET_FR,
        BARRAGE_FR,
        HARD_DRIVE_FR,
        TUSK_FR,
        TUSK_BOOST,
        PSYNAPSE_FR,
        PSYNAPSE_BOOST,
        SCHEME_CONSTANT,
        SCHEME_REVEAL,
      ].sort(),
    );
    for (const [id, def] of Object.entries(DARK_RIDERS)) expect(validateDefinition(def), id).toEqual([]);
  });

  it("the set's six cards are in the encounter deck of the game that asked for them, and Rhino's own deck has Hydra Mercenaries", () => {
    const s = setupGame();
    for (const code of [...RIDERS, SCHEME]) expect(inDeck(s, code), code).toHaveLength(1);
    expect(inDeck(s, MERCENARY).length).toBeGreaterThan(0);
  });
});

describe("data of the five minions", () => {
  const rows: ReadonlyArray<[string, number, number, number, number]> = [
    // code, SCH, ATK, hit points, boost icons
    [GAUNTLET, 2, 2, 5, 2],
    [BARRAGE, 1, 2, 4, 1],
    [HARD_DRIVE, 2, 1, 4, 1],
    [TUSK, 0, 2, 6, 0],
    [PSYNAPSE, 2, 1, 3, 0],
  ];
  for (const [code, sch, atk, hp, icons] of rows) {
    it(`${code}: a unique Dark Riders minion, SCH ${sch}, ATK ${atk}, ${hp} hit points, ${icons} boost icons, teamwork (Dark Riders), not villainous`, () => {
      const card = dataOf(code);
      expect(card.type).toBe("minion");
      expect(card.unique).toBe(true);
      expect([card.sch, card.atk, card.hp, card.boostIcons]).toEqual([sch, atk, hp, icons]);
      expect(card.traits).toEqual(["DARK RIDERS"]);
      expect(card.keywords).toEqual([{ name: "teamwork", sharedTrait: "DARK RIDERS" }]);
    });
  }

  it("Tusk and Psynapse print the star icon of a Boost ability; the other three do not", () => {
    expect([TUSK, PSYNAPSE].map((c) => dataOf(c).starIcon)).toEqual([true, true]);
    expect([GAUNTLET, BARRAGE, HARD_DRIVE].map((c) => dataOf(c).starIcon)).toEqual([undefined, undefined, undefined]);
  });
});

describe("a Dark Riders minion revealed alone", () => {
  for (const code of RIDERS) {
    it(`${code} dealt to an alter-ego: it enters engaged with them, undamaged, with no tough status, and does not activate (no other Dark Rider)`, () => {
      const run = round(setupGame(), { reveals: [code] });
      const minion = inPlayArea(run.state, P1, code);
      expect(minion).toHaveLength(1);
      expect(inst(run.state, minion[0]!).engagedWith).toBe(P1);
      expect(inst(run.state, minion[0]!).damage).toBe(0);
      expect(inst(run.state, minion[0]!).statuses.tough).toBe(0);
      expect(hasKeyword(run.state, minion[0]!, "teamwork", DEPS)).toBe(true);
      expect(teamworkBy(run.state, run.events, code)).toEqual([]);
      expect(attacksBy(run.state, run.events, code)).toEqual([]);
      expect(schemesBy(run.state, run.events, code)).toEqual([]);
    });
  }

  it("a Hydra Mercenary in play does not enable teamwork: Tusk revealed next to one does not activate", () => {
    const s0 = round(setupGame(), { reveals: [MERCENARY] }).state;
    expect(inPlayArea(s0, P1, MERCENARY)).toHaveLength(1);
    const run = round(s0, { reveals: [TUSK], hero: [P1] });
    expect(inPlayArea(run.state, P1, TUSK)).toHaveLength(1);
    expect(teamworkBy(run.state, run.events, TUSK)).toEqual([]);
    expect(attacksBy(run.state, run.events, TUSK)).toEqual([]);
    expect(statusesOf(run.state, P1).stunned).toBe(0);
  });
});

describe("Gauntlet (45112)", () => {
  it("attacks a hero for 2 (no boost card) and, with one upgrade, discards it", () => {
    const s0 = withRider(GAUNTLET);
    const { state: s, id: upgrade } = withCard(s0, P1, "01008");
    expect(inst(s, identityOf(s, P1)).attachments).toEqual([upgrade]);
    const run = round(s, { reveals: [], hero: [P1] });
    const attack = attacksBy(run.state, run.events, GAUNTLET);
    expect(attack).toHaveLength(1);
    expect([attack[0]!.baseAtk, attack[0]!.boostIcons, attack[0]!.damageDealt]).toEqual([2, 0, 2]);
    expect(playerOf(run.state, P1).discard).toContain(upgrade);
    expect(inst(run.state, identityOf(run.state, P1)).attachments).toEqual([]);
  });

  it("with two upgrades the player chooses which one: the second chosen is discarded and the first stays", () => {
    const s0 = withRider(GAUNTLET);
    const a = withCard(s0, P1, "01008");
    const b = withCard(a.state, P1, "01007");
    const run = round(b.state, { reveals: [], hero: [P1], pick: picking(b.id) });
    expect(playerOf(run.state, P1).discard).toContain(b.id);
    expect(inst(run.state, identityOf(run.state, P1)).attachments).toEqual([a.id]);
    const other = round(b.state, { reveals: [], hero: [P1], pick: picking(a.id) });
    expect(playerOf(other.state, P1).discard).toContain(a.id);
    expect(inst(other.state, identityOf(other.state, P1)).attachments).toEqual([b.id]);
  });

  it("with no upgrade nothing is discarded and the attack still lands for 2", () => {
    const s = withRider(GAUNTLET);
    const base = control(setupGame(), { hero: [P1] });
    const run = round(s, { reveals: [], hero: [P1] });
    expect(idDamage(run.state, P1)).toBe(idDamage(base.state, P1) + 2);
    expect(playerOf(run.state, P1).discard).toEqual(playerOf(base.state, P1).discard);
  });

  it("2 players, engaged with player 2: player 2's upgrade is discarded, player 1's stays", () => {
    const s0 = withRider(GAUNTLET, [SPIDER_MAN, CAPTAIN_MARVEL]);
    // Revealed by player 1 (the first to act), so it is engaged with player 1; hand it to player 2 by surgery.
    const engagedWith = inst(s0, inPlayArea(s0, P1, GAUNTLET)[0]!).engagedWith;
    expect(engagedWith).toBe(P1);
    const gauntlet = inPlayArea(s0, P1, GAUNTLET)[0]!;
    const moved: GameState = {
      ...s0,
      players: s0.players.map((p) => ({
        ...p,
        playArea:
          p.playerId === P1
            ? p.playArea.filter((i) => i !== gauntlet)
            : p.playerId === P2
              ? [...p.playArea, gauntlet]
              : p.playArea,
      })),
    };
    const s1 = patchInstance(moved, gauntlet, { engagedWith: P2, controllerId: P2 });
    const mine = withCard(s1, P1, "01008");
    const theirs = withCard(mine.state, P2, "01016");
    const run = round(theirs.state, { reveals: [], hero: [P1, P2] });
    expect(attacksBy(run.state, run.events, GAUNTLET).map((a) => a.targetInstanceId)).toEqual([
      identityOf(run.state, P2),
    ]);
    expect(playerOf(run.state, P2).discard).toContain(theirs.id);
    expect(inst(run.state, identityOf(run.state, P1)).attachments).toEqual([mine.id]);
    expect(inst(run.state, identityOf(run.state, P2)).attachments).toEqual([]);
  });

  it("as a boost card his 2 icons add 1 to Rhino's scheme (against a 1-icon boost) and he is discarded without revealing", () => {
    const s = setupGame();
    const base = control(s);
    const run = round(s, { boosts: [GAUNTLET], reveals: [] });
    const scheme = types(run.events, "schemeResolved").find((e) => e.enemyInstanceId === villain(run.state))!;
    expect(scheme.boostIcons).toBe(2);
    expect(mainThreat(run.state) - mainThreat(base.state)).toBe(1);
    expect(inDiscard(run.state, GAUNTLET)).toHaveLength(1);
    expect(inPlayArea(run.state, P1, GAUNTLET)).toHaveLength(0);
  });
});

describe("Barrage (45113)", () => {
  it("attacks a hero for 2 (no boost card), then 1 damage to each character they control: identity 3 in all, an ally 1", () => {
    const s0 = withRider(BARRAGE);
    const { state: s, id: ally } = withCard(s0, P1, "01059");
    const run = round(s, { reveals: [], hero: [P1] });
    const attack = attacksBy(run.state, run.events, BARRAGE);
    expect([attack[0]!.baseAtk, attack[0]!.boostIcons, attack[0]!.damageDealt]).toEqual([2, 0, 2]);
    const base = control(setupGame(), { hero: [P1] });
    expect(idDamage(run.state, P1)).toBe(idDamage(base.state, P1) + 3);
    expect(damageOf(run.state, ally)).toBe(1);
  });

  it("with no ally only the identity takes the 1", () => {
    const run = round(withRider(BARRAGE), { reveals: [], hero: [P1] });
    const base = control(setupGame(), { hero: [P1] });
    expect(idDamage(run.state, P1)).toBe(idDamage(base.state, P1) + 3);
  });

  it("2 players: only the attacked player's characters take the 1", () => {
    const s0 = withRider(BARRAGE, [SPIDER_MAN, CAPTAIN_MARVEL]);
    const mine = withCard(s0, P1, "01059");
    const theirs = withCard(mine.state, P2, "01067");
    const run = round(theirs.state, { reveals: [], hero: [P1, P2] });
    const attack = attacksBy(run.state, run.events, BARRAGE);
    expect(attack).toHaveLength(1);
    expect(attack[0]!.targetInstanceId).toBe(identityOf(run.state, P1));
    expect(damageOf(run.state, mine.id)).toBe(1);
    expect(damageOf(run.state, theirs.id)).toBe(0);
    // Damage dealt by attacks (Rhino's included, which a card dealt in round 1 changes) plus Barrage's 1 on player 1 only.
    const dealtTo = (p: PlayerId) =>
      types(run.events, "attackResolved")
        .filter((a) => a.targetInstanceId === identityOf(run.state, p))
        .reduce((sum, a) => sum + a.damageDealt, 0);
    expect(idDamage(run.state, P1)).toBe(dealtTo(P1) + 1);
    expect(idDamage(run.state, P2)).toBe(dealtTo(P2));
  });

  it("as a boost card his 1 icon adds nothing beyond the 1-icon boost (same scheme total) and he is discarded", () => {
    const s = setupGame();
    const base = control(s);
    const run = round(s, { boosts: [BARRAGE], reveals: [] });
    expect(mainThreat(run.state)).toBe(mainThreat(base.state));
    expect(inDiscard(run.state, BARRAGE)).toHaveLength(1);
  });

  it("in play when an alter-ego's round comes he schemes for 1 (SCH 1), no boost card", () => {
    const s = withRider(BARRAGE);
    const run = round(s, { reveals: [] });
    const scheme = schemesBy(run.state, run.events, BARRAGE);
    expect(scheme).toHaveLength(1);
    expect([scheme[0]!.baseSch, scheme[0]!.boostIcons, scheme[0]!.threatPlaced]).toEqual([1, 0, 1]);
  });
});

describe("Hard-Drive (45114)", () => {
  // The main scheme gains its acceleration each round with or without him, so each count is read against a control round.
  it("attacks a hero for 1 (no boost card), then 1 threat on the main scheme", () => {
    const run = round(withRider(HARD_DRIVE), { reveals: [], hero: [P1] });
    const base = control(setupGame(), { hero: [P1] });
    const attack = attacksBy(run.state, run.events, HARD_DRIVE);
    expect([attack[0]!.baseAtk, attack[0]!.boostIcons, attack[0]!.damageDealt]).toEqual([1, 0, 1]);
    expect(mainThreat(run.state)).toBe(mainThreat(base.state) + 1);
  });

  it("with The Dark Riders side scheme in play, 1 threat on it too", () => {
    const staged = encounterCardInVillainArea(withRider(HARD_DRIVE), SCHEME, 3);
    const run = round(staged.state, { reveals: [], hero: [P1] });
    const base = control(setupGame(), { hero: [P1] });
    expect(mainThreat(run.state)).toBe(mainThreat(base.state) + 1);
    expect(inst(run.state, staged.id).threat).toBe(4);
  });

  it("with no side scheme in play the threat on the villain area's cards is unchanged (the main scheme alone gets it)", () => {
    const run = round(withRider(HARD_DRIVE), { reveals: [], hero: [P1] });
    expect(run.state.villainArea.filter((i) => inst(run.state, i).threat > 0)).toEqual([]);
  });

  it("2 players, engaged with player 1: one attack on player 1 and 1 threat on the main scheme", () => {
    const s0 = withRider(HARD_DRIVE, [SPIDER_MAN, CAPTAIN_MARVEL]);
    const run = round(s0, { reveals: [], hero: [P1, P2] });
    const base = control(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), { hero: [P1, P2] });
    expect(attacksBy(run.state, run.events, HARD_DRIVE).map((a) => a.targetInstanceId)).toEqual([
      identityOf(run.state, P1),
    ]);
    expect(mainThreat(run.state)).toBe(mainThreat(base.state) + 1);
  });

  it("revealed to an alter-ego later he schemes for 2 (SCH 2), no boost card", () => {
    const s = withRider(HARD_DRIVE);
    const run = round(s, { reveals: [] });
    const scheme = schemesBy(run.state, run.events, HARD_DRIVE);
    expect([scheme[0]!.baseSch, scheme[0]!.boostIcons, scheme[0]!.threatPlaced]).toEqual([2, 0, 2]);
  });

  it("as a boost card his 1 icon is the same as the 1-icon boost and he is discarded", () => {
    const s = setupGame();
    const base = control(s);
    const run = round(s, { boosts: [HARD_DRIVE], reveals: [] });
    expect(mainThreat(run.state)).toBe(mainThreat(base.state));
    expect(inDiscard(run.state, HARD_DRIVE)).toHaveLength(1);
  });
});

describe("Tusk (45115)", () => {
  it("attacks a hero for 2 (no boost card) and the hero is stunned", () => {
    const run = round(withRider(TUSK), { reveals: [], hero: [P1] });
    const attack = attacksBy(run.state, run.events, TUSK);
    expect([attack[0]!.baseAtk, attack[0]!.boostIcons, attack[0]!.damageDealt]).toEqual([2, 0, 2]);
    expect(statusesOf(run.state, P1).stunned).toBe(1);
  });

  it("a hero already stunned stays stunned with one status card", () => {
    const s0 = withRider(TUSK);
    const s = patchInstance(s0, identityOf(s0, P1), { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const run = round(s, { reveals: [], hero: [P1] });
    expect(statusesOf(run.state, P1).stunned).toBe(1);
  });

  it("revealed to an alter-ego later he schemes for 0 (SCH 0) and places no threat", () => {
    const run = round(withRider(TUSK), { reveals: [] });
    const scheme = schemesBy(run.state, run.events, TUSK);
    expect(scheme).toHaveLength(1);
    expect([scheme[0]!.baseSch, scheme[0]!.boostIcons, scheme[0]!.threatPlaced]).toEqual([0, 0, 0]);
    expect(statusesOf(run.state, P1).stunned).toBe(0);
  });

  it("as a boost card against an alter-ego: no icons, and the player is stunned", () => {
    const s = setupGame();
    const run = round(s, { boosts: [TUSK], reveals: [] });
    const scheme = types(run.events, "schemeResolved").find((e) => e.enemyInstanceId === villain(run.state))!;
    expect(scheme.boostIcons).toBe(0);
    expect(statusesOf(run.state, P1).stunned).toBe(1);
    expect(inDiscard(run.state, TUSK)).toHaveLength(1);
  });

  it("2 players, boost card of the villain's activation against player 2: player 2 is stunned, player 1 is not", () => {
    const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const first = round(s, { boosts: [BOOST_1, TUSK], reveals: [] });
    expect(statusesOf(first.state, P1).stunned).toBe(0);
    expect(statusesOf(first.state, P2).stunned).toBe(1);
    const other = round(s, { boosts: [TUSK, BOOST_1], reveals: [] });
    expect(statusesOf(other.state, P1).stunned).toBe(1);
    expect(statusesOf(other.state, P2).stunned).toBe(0);
  });

  it("2 players, engaged with player 1: only player 1 is stunned by the attack", () => {
    const s = withRider(TUSK, [SPIDER_MAN, CAPTAIN_MARVEL]);
    const run = round(s, { reveals: [], hero: [P1, P2] });
    expect(attacksBy(run.state, run.events, TUSK).map((a) => a.targetInstanceId)).toEqual([identityOf(run.state, P1)]);
    expect(statusesOf(run.state, P1).stunned).toBe(1);
    expect(statusesOf(run.state, P2).stunned).toBe(0);
  });
});

describe("Psynapse (45116)", () => {
  it("attacks a hero for 1 (no boost card) and the hero is confused", () => {
    const run = round(withRider(PSYNAPSE), { reveals: [], hero: [P1] });
    const attack = attacksBy(run.state, run.events, PSYNAPSE);
    expect([attack[0]!.baseAtk, attack[0]!.boostIcons, attack[0]!.damageDealt]).toEqual([1, 0, 1]);
    expect(statusesOf(run.state, P1).confused).toBe(1);
  });

  it("a hero already confused stays confused with one status card", () => {
    const s0 = withRider(PSYNAPSE);
    const s = patchInstance(s0, identityOf(s0, P1), { statuses: { stunned: 0, confused: 1, tough: 0 } });
    const run = round(s, { reveals: [], hero: [P1] });
    expect(statusesOf(run.state, P1).confused).toBe(1);
  });

  it("revealed to an alter-ego later she schemes for 2 (SCH 2) and nobody is confused", () => {
    const run = round(withRider(PSYNAPSE), { reveals: [] });
    const scheme = schemesBy(run.state, run.events, PSYNAPSE);
    expect([scheme[0]!.baseSch, scheme[0]!.boostIcons, scheme[0]!.threatPlaced]).toEqual([2, 0, 2]);
    expect(statusesOf(run.state, P1).confused).toBe(0);
  });

  it("as a boost card against an alter-ego: no icons, and the player is confused", () => {
    const run = round(setupGame(), { boosts: [PSYNAPSE], reveals: [] });
    const scheme = types(run.events, "schemeResolved").find((e) => e.enemyInstanceId === villain(run.state))!;
    expect(scheme.boostIcons).toBe(0);
    expect(statusesOf(run.state, P1).confused).toBe(1);
    expect(inDiscard(run.state, PSYNAPSE)).toHaveLength(1);
  });

  it("2 players, boost card of the villain's activation against player 2: player 2 is confused, player 1 is not", () => {
    const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const run = round(s, { boosts: [BOOST_1, PSYNAPSE], reveals: [] });
    expect(statusesOf(run.state, P1).confused).toBe(0);
    expect(statusesOf(run.state, P2).confused).toBe(1);
  });
});

describe("The Dark Riders (45117)", () => {
  it("is data: a side scheme, 2 starting threat, hinder 1 per hero, 3 boost icons, no traits", () => {
    const card = dataOf(SCHEME);
    expect(card.type).toBe("side_scheme");
    expect(card.startingThreat).toEqual({ base: 2, perPlayer: 0 });
    expect(card.keywords).toEqual([{ name: "hinder", value: 0, perPlayer: 1 }]);
    expect(card.boostIcons).toBe(3);
  });

  it("revealed (1 player): 2 threat plus hinder 1, and the encounter deck is discarded until a Dark Rider, who is revealed", () => {
    const run = round(setupGame(), { reveals: [SCHEME, ADVANCE, BOOST_2, TUSK] });
    const scheme = inVillainArea(run.state, SCHEME);
    expect(scheme).toHaveLength(1);
    expect(inst(run.state, scheme[0]!).threat).toBe(3);
    expect(inDiscard(run.state, ADVANCE)).toHaveLength(1);
    expect(inDiscard(run.state, BOOST_2)).toHaveLength(1);
    const tusk = inPlayArea(run.state, P1, TUSK);
    expect(tusk).toHaveLength(1);
    expect(inst(run.state, tusk[0]!).engagedWith).toBe(P1);
    expect(inDiscard(run.state, TUSK)).toHaveLength(0);
  });

  it("revealed (2 players): hinder 1 per hero makes 4 threat", () => {
    const run = round(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), { reveals: [HARMLESS, SCHEME, GAUNTLET] });
    const scheme = inVillainArea(run.state, SCHEME);
    expect(inst(run.state, scheme[0]!).threat).toBe(4);
  });

  it("2 players, revealed by player 2: the Dark Rider it reveals engages player 2", () => {
    const run = round(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), { reveals: [HARMLESS, SCHEME, GAUNTLET] });
    expect(inPlayArea(run.state, P2, GAUNTLET)).toHaveLength(1);
    expect(inPlayArea(run.state, P1, GAUNTLET)).toHaveLength(0);
    expect(inst(run.state, inPlayArea(run.state, P2, GAUNTLET)[0]!).engagedWith).toBe(P2);
  });

  it("the minion it reveals enters with a tough status card (the scheme is already in play)", () => {
    const run = round(setupGame(), { reveals: [SCHEME, TUSK] });
    const tusk = inPlayArea(run.state, P1, TUSK)[0]!;
    expect(inst(run.state, tusk).statuses.tough).toBe(1);
    expect(hasKeyword(run.state, tusk, "toughness", DEPS)).toBe(true);
  });

  it("each Dark Riders minion that enters while it is in play gets a tough status card; one that is not a Dark Rider does not", () => {
    const s0 = round(setupGame(), { reveals: [SCHEME, TUSK] }).state;
    const run = round(s0, { reveals: [MERCENARY] });
    const mercenary = inPlayArea(run.state, P1, MERCENARY)[0]!;
    expect(inst(run.state, mercenary).statuses.tough).toBe(0);
    expect(hasKeyword(run.state, mercenary, "toughness", DEPS)).toBe(false);
    const next = round(run.state, { reveals: [BARRAGE] });
    expect(inst(next.state, inPlayArea(next.state, P1, BARRAGE)[0]!).statuses.tough).toBe(1);
  });

  it("a Dark Rider that entered before the scheme has the toughness keyword while it is in play, but no tough status card", () => {
    const s0 = withRider(BARRAGE);
    const barrage = inPlayArea(s0, P1, BARRAGE)[0]!;
    expect(hasKeyword(s0, barrage, "toughness", DEPS)).toBe(false);
    const staged = encounterCardInVillainArea(s0, SCHEME, 2);
    expect(hasKeyword(staged.state, barrage, "toughness", DEPS)).toBe(true);
    expect(inst(staged.state, barrage).statuses.tough).toBe(0);
  });

  it("with the scheme out of play a Dark Rider is revealed with no tough status card", () => {
    const run = round(setupGame(), { reveals: [TUSK] });
    expect(inst(run.state, inPlayArea(run.state, P1, TUSK)[0]!).statuses.tough).toBe(0);
  });

  it("a Dark Rider already in play stays where it is, and the scheme finds and reveals a different one", () => {
    const s0 = withRider(BARRAGE);
    const run = round(s0, { reveals: [SCHEME, ADVANCE, GAUNTLET] });
    expect(inPlayArea(run.state, P1, BARRAGE)).toHaveLength(1);
    expect(inPlayArea(run.state, P1, GAUNTLET)).toHaveLength(1);
  });

  it("as a boost card its 3 icons add 2 to Rhino's scheme (against a 1-icon boost) and it is discarded without revealing", () => {
    const s = setupGame();
    const base = control(s);
    const run = round(s, { boosts: [SCHEME], reveals: [] });
    expect(mainThreat(run.state) - mainThreat(base.state)).toBe(2);
    expect(inDiscard(run.state, SCHEME)).toHaveLength(1);
    expect(inVillainArea(run.state, SCHEME)).toHaveLength(0);
  });
});

describe("teamwork (Dark Riders), with the side scheme in play", () => {
  /** Barrage in play and The Dark Riders in the villain area (surgery) at the start of a round. */
  function withScheme(): GameState {
    const barrage = withRider(BARRAGE);
    return encounterCardInVillainArea(barrage, SCHEME, 3).state;
  }

  it("hero form: Tusk revealed gets a tough status card, then attacks the engaged player alone for 2 and stuns them", () => {
    const run = round(withScheme(), { reveals: [TUSK], hero: [P1] });
    const tusk = inPlayArea(run.state, P1, TUSK)[0]!;
    expect(inst(run.state, tusk).statuses.tough).toBe(1);
    expect(teamworkBy(run.state, run.events, TUSK)).toHaveLength(1);
    const attacks = attacksBy(run.state, run.events, TUSK);
    expect(attacks).toHaveLength(1);
    expect([attacks[0]!.baseAtk, attacks[0]!.boostIcons, attacks[0]!.damageDealt]).toEqual([2, 0, 2]);
    expect(statusesOf(run.state, P1).stunned).toBe(1);
    // Barrage's own ordinary activation happened once, and Tusk's teamwork came after it.
    expect(attacksBy(run.state, run.events, BARRAGE)).toHaveLength(1);
    const order = types(run.events, "attackResolved").map((e) => codeOf(run.state, e.enemyInstanceId));
    expect(order.indexOf(BARRAGE)).toBeLessThan(order.indexOf(TUSK));
  });

  it("alter-ego: Tusk revealed schemes for 0 by teamwork; Barrage's ordinary scheme is 1", () => {
    const run = round(withScheme(), { reveals: [TUSK] });
    const tusk = schemesBy(run.state, run.events, TUSK);
    expect(tusk).toHaveLength(1);
    expect([tusk[0]!.baseSch, tusk[0]!.boostIcons, tusk[0]!.threatPlaced]).toEqual([0, 0, 0]);
    expect(teamworkBy(run.state, run.events, TUSK)).toHaveLength(1);
    expect(schemesBy(run.state, run.events, BARRAGE).map((s) => s.threatPlaced)).toEqual([1]);
  });

  it("alter-ego: Psynapse revealed schemes for 2 by teamwork and nobody is confused", () => {
    const run = round(withScheme(), { reveals: [PSYNAPSE] });
    const psynapse = schemesBy(run.state, run.events, PSYNAPSE);
    expect(psynapse.map((s) => s.threatPlaced)).toEqual([2]);
    expect(statusesOf(run.state, P1).confused).toBe(0);
  });

  it("hero form: Psynapse revealed attacks for 1 by teamwork and confuses the player; Barrage's own attack and response happen once", () => {
    const run = round(withScheme(), { reveals: [PSYNAPSE], hero: [P1] });
    expect(attacksBy(run.state, run.events, PSYNAPSE).map((a) => a.damageDealt)).toEqual([1]);
    expect(statusesOf(run.state, P1).confused).toBe(1);
    const base = control(setupGame(), { hero: [P1] });
    // Barrage 2 + 1, Psynapse 1.
    expect(idDamage(run.state, P1)).toBe(idDamage(base.state, P1) + 4);
  });

  it("2 players: a Dark Rider revealed to player 2 activates against player 2, not player 1", () => {
    const s0 = withRider(BARRAGE, [SPIDER_MAN, CAPTAIN_MARVEL]);
    const s = encounterCardInVillainArea(s0, SCHEME, 4).state;
    // Cards are dealt in turn order, and the first player has passed to player 2 after round 1.
    const reveals = turnOrder(s).map((p) => (p === P2 ? TUSK : "01100"));
    const run = round(s, { reveals, hero: [P1, P2] });
    expect(inPlayArea(run.state, P2, TUSK)).toHaveLength(1);
    const attacks = attacksBy(run.state, run.events, TUSK);
    expect(attacks.map((a) => a.targetInstanceId)).toEqual([identityOf(run.state, P2)]);
    expect(statusesOf(run.state, P2).stunned).toBe(1);
    expect(statusesOf(run.state, P1).stunned).toBe(0);
  });

  it("the scheme's own reveal brings a second Dark Rider while one is in play: it activates by teamwork", () => {
    const s0 = withRider(BARRAGE);
    const run = round(s0, { reveals: [SCHEME, ADVANCE, GAUNTLET], hero: [P1] });
    const gauntlet = inPlayArea(run.state, P1, GAUNTLET);
    expect(gauntlet).toHaveLength(1);
    expect(teamworkBy(run.state, run.events, GAUNTLET)).toHaveLength(1);
    expect(attacksBy(run.state, run.events, GAUNTLET).map((a) => a.damageDealt)).toEqual([2]);
  });
});

describe("The Dark Riders with no Dark Riders minion left", () => {
  it("revealed with every Dark Rider already in play: the deck is discarded and nothing is revealed", () => {
    const s0 = setupGame();
    const riders = RIDERS.flatMap((c) => inDeck(s0, c));
    const gone: GameState = {
      ...s0,
      encounterDecks: {
        ...s0.encounterDecks,
        [activeEncounterDeckId(s0)]: {
          deck: piles(s0).deck.filter((i) => !riders.includes(i)),
          discard: piles(s0).discard,
        },
      },
      removedFromGame: [...s0.removedFromGame, ...riders],
    };
    const run = round(gone, { reveals: [SCHEME] });
    expect(inVillainArea(run.state, SCHEME)).toHaveLength(1);
    for (const code of RIDERS) expect(inPlayArea(run.state, P1, code)).toHaveLength(0);
  });
});
