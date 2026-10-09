import { cardId, ICEMAN_CARDS, WAVE8_CARDS, WAVE8_STARTER_DECKS, type AnyCard } from "@mc/content";
import {
  activeEncounterDeckId,
  createGame,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { coreScenario } from "../../../core/setup.js";
import { defineAbilities, mergeRegistries } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withDamage, withForm } from "../../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { ICEMAN_EVENTS } from "./events.js";
import { ICEMAN_IDENTITY } from "./identity.js";
import { ICEMAN_OBLIGATION_NEMESIS, ICEMAN_OBLIGATION_NEMESIS_SKIPPED } from "./obligation-nemesis.js";
import { ICEMAN_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Iceman's obligation and nemesis set (46024 Hot-Headed; 46025 Pyro, 46026 Playing with Fire, 46027 Pyro's
 * Flamethrower, 46028 Burn!), docs/phase7-wave8.md section 7.2, 3.61, 3.65, 3.70. Real commands in a real game: his
 * starter deck (`iceman-aggression`) against Rhino. Hero face: THW 1, ATK 2, DEF 2, hand size 5, 11 hit points;
 * alter-ego face: REC 4, hand size 6. Rhino (stage 1): ATK 2, SCH 1. Printed icons used as fixtures (the top card of a
 * deck is relabeled by surgery, never by play): Energy 01088 prints [energy][energy] (2 icons), Snow Clone 46003 one
 * [physical] (1), the card 01014 three [energy] (3), The Power in All of Us 46023 one [wild] (1), Frostbite 46002 none
 * (0). Boost cards that must do nothing are Advance 01186 (0 boost icons); a revealed card that must do nothing is
 * "I'm Tough!" 01105 (0 boost icons).
 *
 * Hot-Headed's Forced Response hears the engine's `cardAttached` (an ability attached a card to a host).
 */
const FROSTBITE_CODE = "46002";
const HOT_HEADED = "46024";
const PYRO = "46025";
const PLAYING_WITH_FIRE = "46026";
const FLAMETHROWER = "46027";
const BURN = "46028";
const NEMESIS_CODES = [PYRO, PLAYING_WITH_FIRE, FLAMETHROWER, BURN, BURN];
const SHADOW_OF_THE_PAST = "01190";
const FREEZE = "46001a.freeze";
const SNOW_CLONE = "46003";
const ICE_WALL = "46008";
const ICE_BLAST = "46010";

const REFS = [
  "46024.obligation",
  "46024.hot-headed-forced-response",
  "46024.hot-headed-response",
  "46025.pyro-constant",
  "46026.when-defeated",
  "46027.pyros-flamethrower-constant",
  "46027.pyros-flamethrower-forced-interrupt",
  "46028.when-revealed",
  "46028.boost",
];
const HOT_HEADED_RESPONSE = "46024.hot-headed-response";

/** Printed icons by relabeled code, for the arithmetic of the tests. */
const TWO_ICONS = "01088";
const ONE_ICON = SNOW_CLONE;
const THREE_ICONS = "01014";
const WILD_ICON = "46023";
const NO_ICONS = FROSTBITE_CODE;
const BOOST_FILLER = "01186";
const DEAL_FILLER = "01105";

const depsWith = (...fixtures: readonly ReturnType<typeof defineAbilities>[]): EngineDeps => ({
  abilities: mergeRegistries(
    WAVE7_ABILITIES,
    ICEMAN_IDENTITY,
    ICEMAN_SUPPORT_UPGRADES_ALLIES,
    ICEMAN_EVENTS,
    ICEMAN_OBLIGATION_NEMESIS,
    ...fixtures,
  ),
});
const DEPS: EngineDeps = depsWith();
const POOL: readonly AnyCard[] = [...WAVE8_CARDS];
const BY_ID = new Map(POOL.map((c) => [c.id as string, c]));
const DATA = (code: string) => ICEMAN_CARDS.find((c) => (c.id as string) === code)! as any;

const ICEMAN = WAVE8_STARTER_DECKS.find((d) => d.id === "iceman-aggression")!;
const ICEMAN_DECK = ICEMAN.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId));
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = { readonly kind: "iceman" | "core" };
const ICE: Seat = { kind: "iceman" };
const SM: Seat = { kind: "core" };

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const setAsideCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).setAside.map((id) => codeOf(s, id));
const encounterDeckCodes = (s: GameState): string[] =>
  Object.values(s.encounterDecks).flatMap((d) => d.deck.map((i) => codeOf(s, i)));
const encounterDiscardCodes = (s: GameState): string[] =>
  Object.values(s.encounterDecks).flatMap((d) => d.discard.map((i) => codeOf(s, i)));
const supply = (s: GameState, p: PlayerId = P1): number =>
  setAsideCodes(s, p).filter((c) => c === FROSTBITE_CODE).length;
const frostbiteOn = (s: GameState, host: InstanceId): number =>
  instancesOf(s, FROSTBITE_CODE).filter((id) => inst(s, id).attachedTo === host).length;
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const deckTop = (s: GameState, p: PlayerId = P1, n = 3): string[] =>
  playerOf(s, p)
    .deck.slice(0, n)
    .map((id) => codeOf(s, id));
/** The `n` cards discarded last from `p`'s deck (the discard pile lists the newest first), sorted by code. */
const discardTop = (s: GameState, p: PlayerId = P1, n = 3): string[] =>
  playerOf(s, p)
    .discard.slice(0, n)
    .map((id) => codeOf(s, id))
    .sort();
const iconsOf = (s: GameState, id: InstanceId): number => {
  const card = BY_ID.get(codeOf(s, id)) as {
    resourceIcons?: Record<string, number>;
    producesIcons?: Record<string, number>;
  };
  return Object.values({ ...card.resourceIcons, ...card.producesIcons }).reduce((a, b) => a + b, 0);
};
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
/** The damage `source` dealt to `target`, event by event. */
const dealtBy = (events: readonly GameEvent[], source: InstanceId, target: InstanceId): number[] =>
  ofType(events, "damageDealt")
    .filter((e) => e.sourceInstanceId === source && e.targetInstanceId === target)
    .map((e) => e.amount);
const discardedFromDeckBy = (events: readonly GameEvent[], by: InstanceId, p: PlayerId): number =>
  ofType(events, "cardDiscardedFromDeck").filter((e) => e.by === by && e.playerId === p).length;

function setupGame(seats: readonly Seat[], seed = 1): GameState {
  const config = coreScenario("rhino", {
    players: [SPIDER_MAN],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  } as never);
  const players = seats.map((seat) =>
    seat.kind === "iceman"
      ? { identityCardId: ICEMAN.identityCardId, aspects: ICEMAN.aspects, deck: ICEMAN_DECK }
      : coreScenario("rhino", { players: [SPIDER_MAN], seed, modularSetIds: [] }).players[0]!,
  );
  const created = createGame({ ...config, players, requireLegalDecks: false }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  // Headroom on the main scheme (a negative count, surgery): the tests' villain phases schemes and accelerates.
  return patchInstance(settled, settled.mainScheme.instanceId, { threat: -30 });
}
/** Every seat in hero form (Iceman at his hero face, Spider-Man at his), Iceman is seat 1. */
const heroGame = (seats: readonly Seat[] = [ICE]): GameState =>
  seats.reduce<GameState>((s, _seat, i) => withForm(s, { heroForm: 0 }, i === 0 ? P1 : P2), setupGame(seats));
/** Bobby Drake in alter-ego form (as the game starts). */
const alterEgoGame = (seats: readonly Seat[] = [ICE]): GameState => setupGame(seats);
const TWO: readonly Seat[] = [ICE, SM];

/** Relabels the instance `id` as card `code` (test-only surgery on a card whose own text is not under test). */
const relabel = (s: GameState, id: InstanceId, code: string): GameState =>
  patchInstance(s, id, { cardId: cardId(code) });
/** Relabels the top cards of `player`'s deck as these codes, in order. */
function relabelTop(s: GameState, codes: readonly string[], p: PlayerId = P1): GameState {
  return codes.reduce((acc, code, n) => relabel(acc, playerOf(acc, p).deck[n]!, code), s);
}

/** The state with Pyro (from Iceman's set-aside area) in play and engaged with `to`: a minion in `to`'s play area. */
function withPyro(s: GameState, to: PlayerId = P1): { readonly state: GameState; readonly id: InstanceId } {
  const id = playerOf(s, P1).setAside.find((i) => codeOf(s, i) === PYRO)!;
  return {
    id,
    state: {
      ...s,
      players: s.players.map((p) => ({
        ...p,
        setAside: p.setAside.filter((i) => i !== id),
        playArea: p.playerId === to ? [...p.playArea, id] : p.playArea,
      })),
      instances: {
        ...s.instances,
        [id]: { ...s.instances[id]!, faceup: true, controllerId: null, engagedWith: to, exhausted: false },
      },
    },
  };
}

const endPhase = (s: GameState): Command[] => s.players.map((p) => endTurn(p.playerId));
/** Whose turn it is in the player phase (the first player passes round to round, so seat 2 may act first). */
const activeSeat = (s: GameState): PlayerId | undefined => (s.step as { activePlayerId?: PlayerId }).activePlayerId;
/** The end-turn commands that must come first for `p` to act: the other seats' turns, when it is not yet `p`'s. */
const waitFor = (s: GameState, p: PlayerId): Command[] => {
  const active = activeSeat(s);
  return active !== undefined && active !== p ? [endTurn(active)] : [];
};
/** Every identity's damage cleared (the villain phase that revealed a card also attacked). */
const clean = (s: GameState): GameState =>
  s.players.reduce((acc, p) => patchInstance(acc, identityOf(acc, p.playerId), { damage: 0 }), s);
/** The enemy stunned (its next activation does nothing, no boost card is dealt for it). */
const stunned = (s: GameState, id: InstanceId): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, stunned: 1 } });
const run = (s: GameState, pick: Picker, ...commands: readonly Command[]) =>
  driveEventsPicking(DEPS, s, pick, ...commands);

/** Picks by prompt: optional triggers by id suffix, targets by `pick`, indirect damage by `shares`; defenders declined. */
const picker =
  (
    opts: {
      accept?: readonly string[];
      pick?: readonly string[];
      shares?: readonly (readonly [InstanceId, number])[];
      seen?: { kind: string; player: string; options: string[] }[];
    } = {},
  ): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const ids = choice.options.map((o) => o.optionId as string);
    opts.seen?.push({ kind: choice.prompt.kind, player: choice.playerId as string, options: ids });
    if (choice.prompt.kind === "chooseTriggers") {
      return ids.filter((id) => (opts.accept ?? []).some((a) => id.endsWith(a))).slice(0, choice.maxSelections);
    }
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    if (choice.prompt.kind === "assignIndirectDamage" && opts.shares) {
      return opts.shares.flatMap(([id, points]) => Array.from({ length: points }, (_, n) => `${id}#${n + 1}`));
    }
    const wanted = (opts.pick ?? []).filter((w) => ids.includes(w));
    return wanted.length > 0 ? wanted.slice(0, choice.maxSelections) : firstLegal(s);
  };

/**
 * Puts the card `id` (set aside, or in the encounter deck) behind `boosts` Advance cards (0 boost icons: the villain's and
 * each minion's boost draws), then for a second-seat reveal behind one more inert card, so it is the revealed card of
 * `to` in the next villain phase; the rest of the deck is untouched.
 */
function stagedForReveal(s: GameState, id: InstanceId, boosts: number, to: PlayerId = P1): GameState {
  const deckId = activeEncounterDeckId(s);
  const pile = s.encounterDecks[deckId]!;
  const rest = pile.deck.filter((i) => i !== id);
  const before = boosts + (to === P1 ? 0 : 1);
  const fillers = rest.slice(0, before);
  const stripped: GameState = {
    ...s,
    players: s.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => i !== id) })),
    encounterDecks: {
      ...s.encounterDecks,
      [deckId]: { ...pile, deck: [...fillers, id, ...rest.slice(before)] },
    },
  };
  return fillers.reduce((acc, f, n) => relabel(acc, f, n < boosts ? BOOST_FILLER : DEAL_FILLER), stripped);
}
/** The card `code`: Iceman's set-aside copy, else the one in the encounter deck. */
const findCard = (s: GameState, code: string): InstanceId =>
  playerOf(s, P1).setAside.find((i) => codeOf(s, i) === code) ?? instancesOf(s, code)[0]!;

type Villain = { state: GameState; events: readonly GameEvent[]; id: InstanceId };
/** The card `code` revealed to `to` in the next villain phase, `boosts` boost draws ahead of it. */
function reveal(s: GameState, code: string, opts: { to?: PlayerId; boosts?: number; pick?: Picker } = {}): Villain {
  const id = findCard(s, code);
  const staged = stagedForReveal(s, id, opts.boosts ?? s.players.length, opts.to ?? P1);
  return { ...run(staged, opts.pick ?? firstLegal, ...endPhase(staged)), id };
}
/** The card `code` on top of the encounter deck as a boost card of the villain's first activation (no reveal of it). */
function asBoost(s: GameState, code: string, pick: Picker = firstLegal): Villain {
  const id = findCard(s, code);
  const deckId = activeEncounterDeckId(s);
  const pile = s.encounterDecks[deckId]!;
  const staged: GameState = {
    ...s,
    players: s.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => i !== id) })),
    encounterDecks: { ...s.encounterDecks, [deckId]: { ...pile, deck: [id, ...pile.deck.filter((i) => i !== id)] } },
  };
  return { ...run(staged, pick, ...endPhase(staged)), id };
}
const attackResolvedBy = (events: readonly GameEvent[], enemy: InstanceId) =>
  ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === enemy);

/** Resource cards in hand that pay `cost`, never a card the tests stage. */
function payers(s: GameState, p: PlayerId, cost: number, not: readonly InstanceId[] = []): InstanceId[] {
  const out: InstanceId[] = [];
  let paid = 0;
  for (const h of playerOf(s, p).hand) {
    if (paid >= cost) break;
    if (not.includes(h) || iconsOf(s, h) === 0 || [ICE_BLAST, SNOW_CLONE, ICE_WALL].includes(codeOf(s, h))) continue;
    out.push(h);
    paid += iconsOf(s, h);
  }
  if (paid < cost) throw new Error(`not enough resource cards in hand to pay ${cost}`);
  return out;
}
/** Adds resource cards to the hand so a test can pay for a card. */
function withResources(s: GameState, n: number, p: PlayerId = P1): GameState {
  const owner = playerOf(s, p);
  const fill = owner.deck
    .filter(
      (id) =>
        iconsOf(s, id) > 0 &&
        ![ICE_BLAST, SNOW_CLONE, ICE_WALL].includes(codeOf(s, id)) &&
        !(BY_ID.get(codeOf(s, id)) as { type: string }).type.startsWith("hero"),
    )
    .slice(0, n);
  return {
    ...s,
    players: s.players.map((pl) =>
      pl.playerId === p ? { ...pl, deck: pl.deck.filter((id) => !fill.includes(id)), hand: [...pl.hand, ...fill] } : pl,
    ),
  };
}
/** Plays `code` from `p`'s hand (cards added to pay for it), choices answered by `pick`. */
function playCard(s: GameState, code: string, pick: Picker = firstLegal, p: PlayerId = P1) {
  const given = moveToHand(withResources(s, 8, p), p, code);
  const id = given.ids[0]!;
  const cost = (BY_ID.get(code) as { cost: number }).cost;
  const pay = payers(given.state, p, cost, [id]);
  const driven = driveEventsPicking(DEPS, given.state, pick, play(p, id, pay));
  return { ...driven, id };
}
/** A real "Freeze!" attack by Iceman on `target`; he is readied and the target's damage cleared after it. */
function freezeOn(s: GameState, target: InstanceId): GameState {
  const accept = picker({ accept: [FREEZE] });
  const { state } = run(s, accept, {
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: identityOf(s),
    targetInstanceId: target,
  });
  return patchInstance(patchInstance(state, identityOf(state), { exhausted: false }), target, { damage: 0 });
}

describe("registry", () => {
  it("registers every ref of the five cards; nothing is skipped", () => {
    const refs = ICEMAN_CARDS.filter((c) => (c.id as string) >= HOT_HEADED && (c.id as string) <= BURN).flatMap(
      abilityRefIds,
    );
    expect([...refs].sort()).toEqual([...REFS].sort());
    expect(Object.keys(ICEMAN_OBLIGATION_NEMESIS).sort()).toEqual([...REFS].sort());
    expect(Object.keys(ICEMAN_OBLIGATION_NEMESIS_SKIPPED)).toEqual([]);
  });
  it.each([...REFS])("%s validates", (id) => {
    expect(validateDefinition(ICEMAN_OBLIGATION_NEMESIS[id as never]!)).toEqual([]);
  });
  it("Hot-Headed's Alter-Ego Response is an optional response, the Flamethrower's interrupt and Burn!'s boost are forced/boost", () => {
    expect(ICEMAN_OBLIGATION_NEMESIS[HOT_HEADED_RESPONSE as never]!.trigger).toMatchObject({
      kind: "response",
      forced: false,
      form: "alterEgo",
    });
    expect(ICEMAN_OBLIGATION_NEMESIS["46027.pyros-flamethrower-forced-interrupt" as never]!.trigger).toMatchObject({
      kind: "interrupt",
      forced: true,
    });
    expect(ICEMAN_OBLIGATION_NEMESIS["46028.boost" as never]!.trigger).toMatchObject({ kind: "boost" });
  });
});

describe("the printed cards (data against the scans)", () => {
  it("Hot-Headed: an obligation with 2 boost icons given to the Bobby Drake player", () => {
    expect(DATA(HOT_HEADED)).toMatchObject({ type: "obligation", name: "Hot-Headed", boostIcons: 2, unique: false });
    expect(DATA("46001a").obligationCardId).toBe(HOT_HEADED);
    expect(DATA("46001a").nemesisEncounterSetId).toBe("iceman_nemesis");
  });
  it("Pyro: unique minion, SCH 1, ATK 3 (star), 4 hit points, quickstrike, 3 boost icons, BROTHERHOOD OF MUTANTS", () => {
    expect(DATA(PYRO)).toMatchObject({ type: "minion", unique: true, sch: 1, atk: 3, hp: 4, boostIcons: 3 });
    expect(DATA(PYRO).keywords).toEqual([{ name: "quickstrike" }]);
    expect(DATA(PYRO).traits).toEqual(["BROTHERHOOD OF MUTANTS"]);
  });
  it("Playing with Fire: a side scheme with 3 threat whatever the player count, an acceleration icon and 3 boost icons", () => {
    expect(DATA(PLAYING_WITH_FIRE)).toMatchObject({
      type: "side_scheme",
      startingThreat: { base: 3, perPlayer: 0 },
      icons: ["acceleration"],
      boostIcons: 3,
    });
  });
  it("the Flamethrower: a WEAPON attachment for Pyro, +0 ATK, 2 boost icons; Burn!: a treachery with a boost star and no boost icon", () => {
    expect(DATA(FLAMETHROWER)).toMatchObject({
      type: "attachment",
      attachesTo: { kind: "namedCard", name: "Pyro" },
      statModifiers: { atk: 0 },
      boostIcons: 2,
    });
    expect(DATA(FLAMETHROWER).traits).toEqual(["WEAPON"]);
    expect(DATA(BURN)).toMatchObject({ type: "treachery", boostIcons: 0, starIcon: true, quantityInSet: 2 });
  });
});

describe("setup: the obligation sits in the encounter deck and the nemesis set is set aside", () => {
  it("Iceman's set-aside area holds six Frostbite and the five nemesis cards (counted by code); the encounter deck holds Hot-Headed once", () => {
    const s = setupGame([ICE]);
    const aside = setAsideCodes(s);
    expect(aside.filter((c) => c === FROSTBITE_CODE)).toHaveLength(6);
    for (const code of [PYRO, PLAYING_WITH_FIRE, FLAMETHROWER]) expect(aside.filter((c) => c === code)).toHaveLength(1);
    expect(aside.filter((c) => c === BURN)).toHaveLength(2);
    expect(aside).toHaveLength(11);
    expect(encounterDeckCodes(s).filter((c) => c === HOT_HEADED)).toHaveLength(1);
    expect(encounterDeckCodes(s).some((c) => NEMESIS_CODES.includes(c))).toBe(false);
  });
  it("two players: only Iceman's seat holds his nemesis set; the other seat holds none of it", () => {
    const s = setupGame(TWO);
    expect(setAsideCodes(s, P1).filter((c) => NEMESIS_CODES.includes(c))).toHaveLength(5);
    expect(setAsideCodes(s, P2).filter((c) => NEMESIS_CODES.includes(c) || c === FROSTBITE_CODE)).toEqual([]);
  });
});

describe("Hot-Headed (46024)", () => {
  it("revealed by Iceman's player from the encounter deck: it stays in his play area, nothing is discarded, no choice is asked", () => {
    const seen: { kind: string; player: string; options: string[] }[] = [];
    const { state, id } = reveal(alterEgoGame(), HOT_HEADED, { pick: picker({ seen }) });
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(encounterDiscardCodes(state)).not.toContain(HOT_HEADED);
    expect(seen.some((p) => p.options.some((o) => o.endsWith(HOT_HEADED_RESPONSE)))).toBe(false);
  });
  it("two players: revealed by the Spider-Man seat it is given to the Bobby Drake player (seat 1), not kept by the revealer", () => {
    const { state, id, events } = reveal(setupGame(TWO), HOT_HEADED, { to: P2 });
    expect(ofType(events, "encounterCardRevealed").find((e) => e.instanceId === id)!.playerId).toBe(P2);
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(playerOf(state, P2).playArea).not.toContain(id);
  });
  it("turned up as a boost card it counts its 2 boost icons (Rhino attacks at 2 + 2 = 4) and is discarded with no obligation effect", () => {
    const base = heroGame();
    const { state, events, id } = asBoost(base, HOT_HEADED);
    const hit = attackResolvedBy(events, villainOf(state))[0]!;
    expect([hit.baseAtk, hit.boostIcons, hit.damageDealt]).toEqual([2, 2, 4]);
    expect(encounterDiscardCodes(state)).toContain(HOT_HEADED);
    expect(playerOf(state, P1).playArea).not.toContain(id);
  });

  describe("Alter-Ego Response: after you make a basic recovery, discard this card", () => {
    /** Hot-Headed revealed to Iceman in the villain phase; the next player phase starts with Bobby Drake damaged by 3. */
    function holding(seats: readonly Seat[] = [ICE]) {
      const { state, id } = reveal(setupGame(seats), HOT_HEADED);
      const damaged = seats.reduce<GameState>(
        (acc, _seat, n) => withDamage(acc, identityOf(acc, n === 0 ? P1 : P2), 3),
        clean(state),
      );
      return { state: damaged, id };
    }
    it("accepted: the 3 damage is healed, Hot-Headed goes to the encounter discard pile and leaves his play area", () => {
      const { state, id } = holding();
      const seen: { kind: string; player: string; options: string[] }[] = [];
      const done = run(state, picker({ accept: [HOT_HEADED_RESPONSE], seen }), { type: "basicRecover", playerId: P1 });
      const offered = seen.filter((p) => p.options.some((o) => o.endsWith(HOT_HEADED_RESPONSE)));
      expect(offered).toHaveLength(1);
      expect(offered[0]!.kind).toBe("chooseTriggers");
      expect(offered[0]!.player).toBe("p1");
      expect(damageOf(done.state, identityOf(done.state))).toBe(0);
      expect(playerOf(done.state, P1).playArea).not.toContain(id);
      expect(encounterDiscardCodes(done.state)).toContain(HOT_HEADED);
    });
    it("declined (it is optional): it stays in his play area, and the next basic recovery offers it again", () => {
      const { state, id } = holding();
      const first = run(state, picker(), { type: "basicRecover", playerId: P1 });
      expect(playerOf(first.state, P1).playArea).toContain(id);
      expect(damageOf(first.state, identityOf(first.state))).toBe(0);
      const ready = patchInstance(withDamage(first.state, identityOf(first.state), 2), identityOf(first.state), {
        exhausted: false,
      });
      const seen: { kind: string; player: string; options: string[] }[] = [];
      const second = run(ready, picker({ accept: [HOT_HEADED_RESPONSE], seen }), {
        type: "basicRecover",
        playerId: P1,
      });
      expect(seen.filter((p) => p.options.some((o) => o.endsWith(HOT_HEADED_RESPONSE)))).toHaveLength(1);
      expect(playerOf(second.state, P1).playArea).not.toContain(id);
    });
    it("two players: the Spider-Man seat's own basic recovery does not offer it, and it stays with the Bobby Drake player", () => {
      const { state, id } = holding(TWO);
      const seen: { kind: string; player: string; options: string[] }[] = [];
      const done = run(state, picker({ accept: [HOT_HEADED_RESPONSE], seen }), ...waitFor(state, P2), {
        type: "basicRecover",
        playerId: P2,
      });
      expect(seen.some((p) => p.options.some((o) => o.endsWith(HOT_HEADED_RESPONSE)))).toBe(false);
      expect(playerOf(done.state, P1).playArea).toContain(id);
    });
    it("two players: Iceman's seat is offered it and discards it", () => {
      const { state, id } = holding(TWO);
      const seen: { kind: string; player: string; options: string[] }[] = [];
      const done = run(state, picker({ accept: [HOT_HEADED_RESPONSE], seen }), ...waitFor(state, P1), {
        type: "basicRecover",
        playerId: P1,
      });
      const offered = seen.filter((p) => p.options.some((o) => o.endsWith(HOT_HEADED_RESPONSE)));
      expect(offered.map((p) => p.player)).toEqual(["p1"]);
      expect(encounterDiscardCodes(done.state)).toContain(HOT_HEADED);
      expect(playerOf(done.state, P1).playArea).not.toContain(id);
    });
  });

  describe("Forced Response: after you attach a Frostbite upgrade to an enemy, take 1 damage (section 3.61)", () => {
    /** Hot-Headed in the Bobby Drake player's play area (staging), Iceman in hero form. */
    function hotHeaded(s: GameState): GameState {
      const id = instancesOf(s, HOT_HEADED)[0]!;
      const deckId = activeEncounterDeckId(s);
      const pile = s.encounterDecks[deckId]!;
      return patchInstance(
        {
          ...s,
          encounterDecks: { ...s.encounterDecks, [deckId]: { ...pile, deck: pile.deck.filter((i) => i !== id) } },
          players: s.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
        },
        id,
        { faceup: true, controllerId: P1 },
      );
    }
    const freezeRhino = (deps: EngineDeps, s: GameState) =>
      driveEventsPicking(deps, s, picker({ accept: [FREEZE] }), {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(s),
        targetInstanceId: villainOf(s),
      });
    it("0 copies attached: Iceman takes no damage (no copy set aside, 'Freeze!' is not offered, the attack deals 2)", () => {
      const s = hotHeaded(heroGame());
      const none = {
        ...s,
        players: s.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => codeOf(s, i) !== FROSTBITE_CODE) })),
      };
      const { state } = freezeRhino(DEPS, none);
      expect(damageOf(state, identityOf(state))).toBe(0);
      expect(damageOf(state, villainOf(state))).toBe(2);
      expect(frostbiteOn(state, villainOf(state))).toBe(0);
    });
    it("1 copy attached by 'Freeze!': Iceman takes 1 damage", () => {
      const s = hotHeaded(heroGame());
      const { state } = freezeRhino(DEPS, s);
      expect(frostbiteOn(state, villainOf(state))).toBe(1);
      expect(damageOf(state, identityOf(state))).toBe(1);
    });
    it("revealed in play, not staged: the obligation given to the Bobby Drake player hears his next 'Freeze!'", () => {
      const { state: held, id } = reveal(setupGame([ICE]), HOT_HEADED);
      expect(playerOf(held, P1).playArea).toContain(id);
      const ready = patchInstance(withForm(clean(held), { heroForm: 0 }, P1), identityOf(held), { exhausted: false });
      const before = damageOf(ready, identityOf(ready));
      const { state } = freezeRhino(DEPS, ready);
      expect(frostbiteOn(state, villainOf(state))).toBe(1);
      expect(damageOf(state, identityOf(state))).toBe(before + 1);
    });
    it("3 copies from one Ice Blast (villain and two minions): three instances, 3 damage: 11 to 8", () => {
      let s = hotHeaded(heroGame());
      const a = withMinionFixture(s, "01102");
      const b = withMinionFixture(a.state, "01102");
      s = b.state;
      const given = moveToHand(withResources(s, 8), P1, ICE_BLAST);
      const pay = payers(given.state, P1, 3, [given.ids[0]!]);
      const { state } = driveEventsPicking(DEPS, given.state, picker(), play(P1, given.ids[0]!, pay));
      expect(supply(state)).toBe(3);
      expect(damageOf(state, identityOf(state))).toBe(3);
    });
  });
});

/** A minion relabeled from the next spare encounter card, engaged with P1 and faceup (its own text is not under test). */
function withMinionFixture(s: GameState, code: string): { state: GameState; id: InstanceId } {
  const minion = s.cardPool[cardId(code)];
  if (minion?.type !== "minion") throw new Error(`no minion ${code} in the pool`);
  const deckId = activeEncounterDeckId(s);
  const pile = s.encounterDecks[deckId]!;
  const spare = pile.deck.find((i) => codeOf(s, i) !== HOT_HEADED && codeOf(s, i) !== SHADOW_OF_THE_PAST)!;
  const next: GameState = {
    ...patchInstance(s, spare, { cardId: minion.id, faceup: true, engagedWith: P1, damage: 0 }),
    encounterDecks: {
      ...s.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => i !== spare), discard: pile.discard },
    },
    players: s.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, spare] } : p)),
  };
  return { state: next, id: spare };
}

describe("Pyro (46025)", () => {
  it("his attack deals indirect damage: undefended, Iceman alone takes ATK 3 + 0 boost icons = 3, as damage from Pyro", () => {
    const { state, id } = withPyro(heroGame());
    const filled = [0, 1, 2].reduce((acc, n) => relabel(acc, encounterTop(acc, n), BOOST_FILLER), state);
    const { state: after, events } = run(filled, picker(), ...endPhase(filled));
    const hit = attackResolvedBy(events, id)[0]!;
    expect([hit.baseAtk, hit.boostIcons]).toEqual([3, 0]);
    expect(dealtBy(events, id, identityOf(after))).toEqual([3]);
  });
  it("Pyro is not villainous, so he is dealt no boost card (only Rhino is)", () => {
    const { state, id } = withPyro(heroGame());
    const filled = [0, 1, 2].reduce((acc, n) => relabel(acc, encounterTop(acc, n), BOOST_FILLER), state);
    const { events } = run(filled, picker(), ...endPhase(filled));
    expect(ofType(events, "boostCardDealt").filter((e) => e.enemyInstanceId === id)).toEqual([]);
    expect(ofType(events, "boostCardDealt").length).toBeGreaterThan(0);
    expect(attackResolvedBy(events, id)[0]!.boostIcons).toBe(0);
  });
  it("a copy of Frostbite lowers the attack first (3 - 1 = 2 indirect damage) and is set aside after the activation", () => {
    const { state, id } = withPyro(heroGame());
    const frozen = freezeOn(state, id);
    expect(frostbiteOn(frozen, id)).toBe(1);
    const filled = [0, 1, 2].reduce((acc, n) => relabel(acc, encounterTop(acc, n), BOOST_FILLER), frozen);
    const { state: after, events } = run(filled, picker(), ...endPhase(filled));
    const hit = attackResolvedBy(events, id)[0]!;
    expect(hit.baseAtk).toBe(2);
    expect(dealtBy(events, id, identityOf(after))).toEqual([2]);
    expect(supply(after)).toBe(6);
  });
  it("with an ally the player divides it: 2 to Iceman, 1 to Snow Clone (hit points 2): each takes its share", () => {
    const withAlly = playCard(withPyro(heroGame()).state, SNOW_CLONE);
    const pyro = instancesOf(withAlly.state, PYRO)[0]!;
    const filled = [0, 1, 2].reduce((acc, n) => relabel(acc, encounterTop(acc, n), BOOST_FILLER), withAlly.state);
    const seen: { kind: string; player: string; options: string[] }[] = [];
    const { state, events } = run(
      filled,
      picker({
        shares: [
          [identityOf(filled), 2],
          [withAlly.id, 1],
        ],
        seen,
      }),
      ...endPhase(filled),
    );
    expect(seen.some((p) => p.kind === "assignIndirectDamage" && p.player === "p1")).toBe(true);
    expect(dealtBy(events, pyro, identityOf(state))).toEqual([2]);
    expect(dealtBy(events, pyro, withAlly.id)).toEqual([1]);
    expect(damageOf(state, withAlly.id)).toBe(1);
  });
  it("section 3.65 test 6: with Ice Wall in play the 2 assigned to Iceman are placed on Ice Wall and Snow Clone takes 1", () => {
    const wall = playCard(withPyro(heroGame()).state, ICE_WALL);
    const clone = playCard(wall.state, SNOW_CLONE);
    // Rhino is stunned so that his own attack on Iceman is not also placed on Ice Wall.
    const quiet = stunned(clone.state, villainOf(clone.state));
    const filled = [0, 1, 2].reduce((acc, n) => relabel(acc, encounterTop(acc, n), BOOST_FILLER), quiet);
    const { state } = run(
      filled,
      picker({
        shares: [
          [identityOf(filled), 2],
          [clone.id, 1],
        ],
      }),
      ...endPhase(filled),
    );
    expect(damageOf(state, wall.id)).toBe(2);
    expect(damageOf(state, identityOf(state))).toBe(0);
    expect(damageOf(state, clone.id)).toBe(1);
  });
  it("two players: Pyro engaged with the Spider-Man seat deals the indirect damage to that seat only", () => {
    const { state, id } = withPyro(heroGame(TWO), P2);
    const filled = [0, 1, 2, 3, 4].reduce((acc, n) => relabel(acc, encounterTop(acc, n), BOOST_FILLER), state);
    const { state: after, events } = run(filled, picker(), ...endPhase(filled));
    expect(dealtBy(events, id, identityOf(after, P2))).toEqual([3]);
    expect(dealtBy(events, id, identityOf(after, P1))).toEqual([]);
  });
  it("revealed from the encounter deck (a quickstrike minion): engaged with the revealing player and, in hero form, it attacks at once", () => {
    const { state, events, id } = reveal(heroGame(), PYRO, { pick: picker() });
    expect(inst(state, id).engagedWith).toBe(P1);
    expect(playerOf(state, P1).playArea).toContain(id);
    const hit = attackResolvedBy(events, id);
    expect(hit.map((e) => [e.baseAtk, e.boostIcons, e.damageDealt])).toEqual([[3, 0, 3]]);
    expect(dealtBy(events, id, identityOf(state))).toEqual([3]);
  });
  it("revealed to Bobby Drake in alter-ego form quickstrike does nothing (it needs a hero form): no attack, no scheme", () => {
    const { state, events, id } = reveal(alterEgoGame(), PYRO, { pick: picker() });
    expect(inst(state, id).engagedWith).toBe(P1);
    expect(attackResolvedBy(events, id)).toHaveLength(0);
    expect(ofType(events, "schemeResolved").filter((e) => e.enemyInstanceId === id)).toHaveLength(0);
  });
  it("turned up as a boost card it counts 3 boost icons (Rhino attacks at 2 + 3 = 5) and is discarded: it does not enter play", () => {
    const { state, events, id } = asBoost(heroGame(), PYRO);
    const hit = attackResolvedBy(events, villainOf(state))[0]!;
    expect([hit.baseAtk, hit.boostIcons, hit.damageDealt]).toEqual([2, 3, 5]);
    expect(encounterDiscardCodes(state)).toContain(PYRO);
    expect(playerOf(state, P1).playArea).not.toContain(id);
  });
});

/** The id at position `n` of the active encounter deck. */
function encounterTop(s: GameState, n: number): InstanceId {
  return s.encounterDecks[activeEncounterDeckId(s)]!.deck[n]!;
}

describe("the nemesis set enters by Shadow of the Past (01190)", () => {
  /** Shadow of the Past revealed to Iceman's seat; the cards behind it are the deck as it was. */
  const shadow = (seats: readonly Seat[]) => reveal(heroGame(seats), SHADOW_OF_THE_PAST, { pick: picker() });
  it("reveals Pyro engaged with Iceman, puts Playing with Fire into play, and shuffles the rest of the set into the encounter deck", () => {
    const { state, id } = shadow([ICE]);
    const pyro = instancesOf(state, PYRO)[0]!;
    const scheme = instancesOf(state, PLAYING_WITH_FIRE)[0]!;
    expect(inst(state, pyro).engagedWith).toBe(P1);
    expect(state.villainArea).toContain(scheme);
    expect(inst(state, scheme).threat).toBe(3);
    // Shadow of the Past itself is discarded (a treachery); nothing of the set stays set aside but the six copies.
    expect(encounterDiscardCodes(state)).toContain(SHADOW_OF_THE_PAST);
    expect(setAsideCodes(state)).toEqual(Array(6).fill(FROSTBITE_CODE));
    const elsewhere = (code: string) =>
      instancesOf(state, code).filter((i) => !setAsideCodes(state).includes(codeOf(state, i)) && i !== id);
    expect(elsewhere(FLAMETHROWER)).toHaveLength(1);
    expect(elsewhere(BURN)).toHaveLength(2);
    expect(
      [FLAMETHROWER, BURN]
        .flatMap((c) => instancesOf(state, c))
        .every((i) => !playerOf(state, P1).setAside.includes(i)),
    ).toBe(true);
  });
  it("Playing with Fire has 3 starting threat at 1 player and at 2 players (a flat 3)", () => {
    expect(inst(shadow([ICE]).state, instancesOf(shadow([ICE]).state, PLAYING_WITH_FIRE)[0]!).threat).toBe(3);
    const two = shadow(TWO);
    expect(inst(two.state, instancesOf(two.state, PLAYING_WITH_FIRE)[0]!).threat).toBe(3);
    expect(two.state.villainArea).toContain(instancesOf(two.state, PLAYING_WITH_FIRE)[0]!);
  });
  it("two players: the Spider-Man seat's set-aside area is untouched and Iceman's nemesis set leaves only his area", () => {
    const { state } = shadow(TWO);
    expect(setAsideCodes(state, P1).filter((c) => NEMESIS_CODES.includes(c))).toEqual([]);
    expect(setAsideCodes(state, P2).length).toBeGreaterThan(0);
    expect(inst(state, instancesOf(state, PYRO)[0]!).engagedWith).toBe(P1);
  });
});

describe("Playing with Fire (46026)", () => {
  /** Playing with Fire revealed to Iceman's seat (hero form), then thwarted down to 1 threat. */
  function inPlayAt1(seats: readonly Seat[] = [ICE]) {
    const revealed = reveal(heroGame(seats), PLAYING_WITH_FIRE);
    return { ...revealed, state: patchInstance(clean(revealed.state), revealed.id, { threat: 1 }) };
  }
  const thwart = (s: GameState, id: InstanceId, p: PlayerId = P1): Command => ({
    type: "basicThwart",
    playerId: p,
    thwarterInstanceId: identityOf(s, p),
    schemeInstanceId: id,
  });
  it("revealed: a side scheme in play with 3 threat (and its acceleration icon, data); at 2 players still 3", () => {
    const one = reveal(heroGame([ICE]), PLAYING_WITH_FIRE);
    expect(one.state.villainArea).toContain(one.id);
    expect(inst(one.state, one.id).threat).toBe(3);
    const two = reveal(heroGame(TWO), PLAYING_WITH_FIRE);
    expect(inst(two.state, two.id).threat).toBe(3);
  });
  it("defeated by Iceman: the top 3 cards of his deck are discarded (2 + 1 + 3 icons) and he takes 6 indirect damage", () => {
    const { state, id } = inPlayAt1();
    const staged = relabelTop(state, [TWO_ICONS, ONE_ICON, THREE_ICONS]);
    const { state: after, events } = run(staged, picker(), thwart(staged, id));
    expect(after.villainArea).not.toContain(id);
    expect(discardedFromDeckBy(events, id, P1)).toBe(3);
    expect(discardTop(after)).toEqual([TWO_ICONS, ONE_ICON, THREE_ICONS].sort());
    expect(damageOf(after, identityOf(after))).toBe(6);
  });
  it("a wild icon is one icon and a card with no icon none: [wild], none, 2 icons discard 3 cards for 3 damage", () => {
    const { state, id } = inPlayAt1();
    const staged = relabelTop(state, [WILD_ICON, NO_ICONS, TWO_ICONS]);
    const { state: after } = run(staged, picker(), thwart(staged, id));
    expect(damageOf(after, identityOf(after))).toBe(3);
  });
  it("with Ice Wall in play the indirect damage is not an attack's: Iceman takes it himself and Ice Wall holds none", () => {
    const wall = playCard(inPlayAt1().state, ICE_WALL);
    const id = instancesOf(wall.state, PLAYING_WITH_FIRE)[0]!;
    const staged = relabelTop(wall.state, [TWO_ICONS, ONE_ICON, THREE_ICONS]);
    const { state: after } = run(staged, picker(), thwart(staged, id));
    expect(damageOf(after, identityOf(after))).toBe(6);
    expect(damageOf(after, wall.id)).toBe(0);
  });
  it("two players: defeated by the Spider-Man seat, that seat discards from its own deck and takes the damage; Iceman is untouched", () => {
    const { state, id } = inPlayAt1(TWO);
    const staged = relabelTop(state, [TWO_ICONS, ONE_ICON, THREE_ICONS], P2);
    const iceTop = deckTop(staged, P1);
    const { state: after, events } = run(staged, picker(), ...waitFor(staged, P2), thwart(staged, id, P2));
    expect(discardedFromDeckBy(events, id, P2)).toBe(3);
    expect(discardedFromDeckBy(events, id, P1)).toBe(0);
    expect(damageOf(after, identityOf(after, P2))).toBe(6);
    expect(damageOf(after, identityOf(after, P1))).toBe(0);
    expect(deckTop(after, P1)).toEqual(iceTop);
  });
  it("two players: defeated by Iceman, only Iceman's deck is discarded from and only he takes the damage", () => {
    const { state, id } = inPlayAt1(TWO);
    const staged = relabelTop(state, [TWO_ICONS, ONE_ICON, ONE_ICON]);
    const { state: after } = run(staged, picker(), ...waitFor(staged, P1), thwart(staged, id, P1));
    expect(damageOf(after, identityOf(after, P1))).toBe(4);
    expect(damageOf(after, identityOf(after, P2))).toBe(0);
  });
  it("turned up as a boost card it counts 3 boost icons (Rhino attacks at 2 + 3 = 5) and is discarded: not put into play", () => {
    const { state, events, id } = asBoost(heroGame(), PLAYING_WITH_FIRE);
    const hit = attackResolvedBy(events, villainOf(state))[0]!;
    expect([hit.baseAtk, hit.boostIcons, hit.damageDealt]).toEqual([2, 3, 5]);
    expect(state.villainArea).not.toContain(id);
    expect(encounterDiscardCodes(state)).toContain(PLAYING_WITH_FIRE);
  });
});

describe("Pyro's Flamethrower (46027)", () => {
  it("revealed with Pyro in play it attaches to him and does not surge", () => {
    const { state: s, id: pyro } = withPyro(heroGame());
    const { state, events, id } = reveal(s, FLAMETHROWER, { boosts: 1 });
    expect(inst(state, id).attachedTo).toBe(pyro);
    expect(ofType(events, "surgeTriggered").filter((e) => e.instanceId === id)).toEqual([]);
  });
  it("revealed with no Pyro in play it cannot attach: it gains surge, is discarded, and the next encounter card is revealed", () => {
    const { state, events, id } = reveal(heroGame(), FLAMETHROWER);
    expect(inst(state, id).attachedTo).toBeNull();
    expect(encounterDiscardCodes(state)).toContain(FLAMETHROWER);
    expect(ofType(events, "surgeTriggered").filter((e) => e.instanceId === id)).toHaveLength(1);
    expect(ofType(events, "encounterCardRevealed").filter((e) => e.playerId === P1)).toHaveLength(2);
  });
  describe("Forced Interrupt: when Pyro attacks you, discard the top card of your deck; +1 ATK per resource icon on it", () => {
    /** Pyro engaged with `to` and the Flamethrower on him, then the villain phase with 0-icon boost cards. */
    function attacked(seats: readonly Seat[], to: PlayerId, tops: readonly string[], who: PlayerId = to) {
      const pyro = withPyro(heroGame(seats), to);
      const base = relabelTop(pyro.state, tops, who);
      const flamed = stageFlamethrower(base, pyro.id);
      const filled = [0, 1, 2, 3, 4].reduce((acc, n) => relabel(acc, encounterTop(acc, n), BOOST_FILLER), flamed.state);
      const { state, events } = run(filled, picker(), ...endPhase(filled));
      return { state, events, pyro: pyro.id, flame: flamed.id };
    }
    /** The Flamethrower attached to `pyro` by staging (the reveal is tested above). */
    function stageFlamethrower(s: GameState, pyro: InstanceId): { state: GameState; id: InstanceId } {
      const id = playerOf(s, P1).setAside.find((i) => codeOf(s, i) === FLAMETHROWER)!;
      return {
        id,
        state: {
          ...patchInstance(s, id, { attachedTo: pyro, faceup: true, controllerId: null }),
          players: s.players.map((p) => ({
            ...p,
            setAside: p.setAside.filter((i) => i !== id),
            playArea: p.playerId === P1 ? [...p.playArea, id] : p.playArea,
          })),
        },
      };
    }
    it("the top card has 2 icons: it is discarded and Pyro attacks at 3 + 2 = 5 indirect damage", () => {
      const { state, events, pyro, flame } = attacked([ICE], P1, [TWO_ICONS]);
      expect(discardedFromDeckBy(events, flame, P1)).toBe(1);
      const hit = attackResolvedBy(events, pyro)[0]!;
      expect(hit.baseAtk).toBe(5);
      expect(dealtBy(events, pyro, identityOf(state))).toEqual([5]);
      expect(discardTop(state, P1, 1)).toEqual([TWO_ICONS]);
    });
    it("a wild icon is one icon: Pyro attacks at 3 + 1 = 4", () => {
      const { events, pyro } = attacked([ICE], P1, [WILD_ICON]);
      expect(attackResolvedBy(events, pyro)[0]!.baseAtk).toBe(4);
    });
    it("a card with no icon adds nothing (ATK 3) but is still discarded", () => {
      const { events, pyro, flame } = attacked([ICE], P1, [NO_ICONS]);
      expect(discardedFromDeckBy(events, flame, P1)).toBe(1);
      expect(attackResolvedBy(events, pyro)[0]!.baseAtk).toBe(3);
    });
    it("a 3-icon card: ATK 3 + 3 = 6", () => {
      const { events, pyro } = attacked([ICE], P1, [THREE_ICONS]);
      expect(attackResolvedBy(events, pyro)[0]!.baseAtk).toBe(6);
    });
    it("two players: Pyro engaged with the Spider-Man seat discards from that seat's deck (2 icons), not Iceman's", () => {
      const iceTop = deckTop(heroGame(TWO), P1, 1);
      const { state, events, pyro, flame } = attacked(TWO, P2, [TWO_ICONS], P2);
      expect(discardedFromDeckBy(events, flame, P2)).toBe(1);
      expect(discardedFromDeckBy(events, flame, P1)).toBe(0);
      expect(attackResolvedBy(events, pyro)[0]!.baseAtk).toBe(5);
      expect(dealtBy(events, pyro, identityOf(state, P2))).toEqual([5]);
      expect(deckTop(state, P1, 1)).toEqual(iceTop);
    });
  });
  it("turned up as a boost card it counts 2 boost icons (Rhino attacks at 2 + 2 = 4) and is discarded", () => {
    const { state, events, id } = asBoost(heroGame(), FLAMETHROWER);
    const hit = attackResolvedBy(events, villainOf(state))[0]!;
    expect([hit.baseAtk, hit.boostIcons, hit.damageDealt]).toEqual([2, 2, 4]);
    expect(inst(state, id).attachedTo).toBeNull();
  });
});

describe("Burn! (46028)", () => {
  /** Burn! revealed to `to`, whose top cards are first relabeled as `tops`; Burn!'s own indirect damage by the log. */
  function burned(s: GameState, tops: readonly string[], to: PlayerId = P1, boosts = s.players.length) {
    const staged = relabelTop(s, tops, to);
    const { state, events, id } = reveal(staged, BURN, { to, boosts, pick: picker() });
    return { state, events, id, took: dealtBy(events, id, identityOf(state, to)) };
  }
  it("without Pyro in play: the top 2 cards are discarded (2 + 1 icons) and he takes 3 indirect damage", () => {
    const { state, events, id, took } = burned(heroGame(), [TWO_ICONS, ONE_ICON, THREE_ICONS]);
    expect(discardedFromDeckBy(events, id, P1)).toBe(2);
    expect(discardTop(state, P1, 2)).toEqual([TWO_ICONS, ONE_ICON].sort());
    expect(took).toEqual([3]);
    expect(deckTop(state, P1, 1)).toEqual([THREE_ICONS]);
  });
  it("with Pyro in play: the top 3 cards are discarded (2 + 1 + 3 icons) and he takes 6", () => {
    const { state: s } = withPyro(heroGame());
    const { events, id, took } = burned(s, [TWO_ICONS, ONE_ICON, THREE_ICONS], P1, 1);
    expect(discardedFromDeckBy(events, id, P1)).toBe(3);
    expect(took).toEqual([6]);
  });
  it("Pyro in play engaged with the other seat still counts (two players): 3 cards discarded", () => {
    const { state: s } = withPyro(heroGame(TWO), P2);
    const { events, id, took } = burned(s, [ONE_ICON, ONE_ICON, ONE_ICON], P1, 2);
    expect(discardedFromDeckBy(events, id, P1)).toBe(3);
    expect(took).toEqual([3]);
  });
  it("a wild icon is one icon: [wild], [wild] is 2 damage; cards with no icon are 0 damage", () => {
    expect(burned(heroGame(), [WILD_ICON, WILD_ICON]).took).toEqual([2]);
    const none = burned(heroGame(), [NO_ICONS, NO_ICONS]);
    expect(none.took).toEqual([]);
    expect(discardedFromDeckBy(none.events, none.id, P1)).toBe(2);
  });
  it("two players: revealed by the Spider-Man seat it discards that seat's top 2 cards and that seat takes the damage", () => {
    const s = heroGame(TWO);
    const iceTop = deckTop(s, P1, 2);
    const { state, events, id, took } = burned(s, [TWO_ICONS, TWO_ICONS], P2, 2);
    expect(ofType(events, "encounterCardRevealed").find((e) => e.instanceId === id)!.playerId).toBe(P2);
    expect(discardedFromDeckBy(events, id, P2)).toBe(2);
    expect(discardedFromDeckBy(events, id, P1)).toBe(0);
    expect(took).toEqual([4]);
    expect(deckTop(state, P1, 2)).toEqual(iceTop);
  });
  it("with Ice Wall in play Burn!'s indirect damage (a treachery's, not an attack's) is taken by Iceman, not placed on it", () => {
    const wall = playCard(heroGame(), ICE_WALL);
    const { state, events, took } = burned(wall.state, [TWO_ICONS, ONE_ICON]);
    // Rhino's own attack in the same villain phase (2) is the only damage Ice Wall holds.
    const rhino = attackResolvedBy(events, villainOf(state))[0]!;
    expect(took).toEqual([3]);
    expect(damageOf(state, wall.id)).toBe(rhino.damageDealt);
    expect(damageOf(state, identityOf(state))).toBe(3);
  });
  describe("[star] Boost: discard the top card of your deck; this card gets +1 boost icon per resource icon on it", () => {
    it("a 2-icon top card: it is discarded and Rhino's attack gets 2 boost icons (2 + 2 = 4 damage)", () => {
      const s = relabelTop(heroGame(), [TWO_ICONS]);
      const { state, events, id } = asBoost(s, BURN);
      const hit = attackResolvedBy(events, villainOf(state))[0]!;
      expect([hit.baseAtk, hit.boostIcons, hit.damageDealt]).toEqual([2, 2, 4]);
      expect(discardedFromDeckBy(events, id, P1)).toBe(1);
      expect(discardTop(state, P1, 1)).toEqual([TWO_ICONS]);
    });
    it("a 3-icon top card: 3 boost icons (damage 5); a wild icon: 1 (damage 3); no icon: 0 (damage 2)", () => {
      const damage = (code: string) => {
        const { state, events } = asBoost(relabelTop(heroGame(), [code]), BURN);
        const hit = attackResolvedBy(events, villainOf(state))[0]!;
        return [hit.boostIcons, hit.damageDealt];
      };
      expect(damage(THREE_ICONS)).toEqual([3, 5]);
      expect(damage(WILD_ICON)).toEqual([1, 3]);
      expect(damage(NO_ICONS)).toEqual([0, 2]);
    });
    it("two players: as the boost of the villain's attack on the Spider-Man seat, that seat's deck is discarded from", () => {
      const s = relabelTop(heroGame(TWO), [TWO_ICONS], P2);
      const iceTop = deckTop(s, P1, 1);
      const id = findCard(s, BURN);
      const deckId = activeEncounterDeckId(s);
      const pile = s.encounterDecks[deckId]!;
      const rest = pile.deck.filter((i) => i !== id);
      const staged = relabel(
        {
          ...s,
          players: s.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => i !== id) })),
          encounterDecks: { ...s.encounterDecks, [deckId]: { ...pile, deck: [rest[0]!, id, ...rest.slice(1)] } },
        },
        rest[0]!,
        BOOST_FILLER,
      );
      const { state, events } = run(staged, picker(), ...endPhase(staged));
      expect(discardedFromDeckBy(events, id, P2)).toBe(1);
      expect(discardedFromDeckBy(events, id, P1)).toBe(0);
      expect(deckTop(state, P1, 1)).toEqual(iceTop);
      const hit = attackResolvedBy(events, villainOf(state)).find((e) => e.targetInstanceId === identityOf(state, P2))!;
      expect(hit.boostIcons).toBe(2);
    });
  });
});
