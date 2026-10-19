import {
  applyCommand,
  cardsInPlay,
  characterProfile,
  createGame,
  type Command,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { engageMinion } from "../../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import { wave11Scenario } from "../../setup.js";
import {
  FNE_SCENARIOS_PROTECTION_RACKET as REGISTRY,
  FNE_SCENARIOS_PROTECTION_RACKET_SKIPPED as SKIPPED,
} from "./protection-racket.js";

vi.setConfig({ testTimeout: 240_000 });

const BODEGA = "60134a";
const BULL = "60135a";
const HUNG = "60136a";
const PAWN = "60137a";
const PIZZA = "60138a";
const SCHEMES = [BODEGA, BULL, HUNG, PAWN, PIZZA];
const PROPRIETOR = "60139";
const MAN_BULL = "60140";
const VENUE = "60141";
/** The Clown: a villainous Tracksuit Mafia minion (ATK 1), so he is dealt a boost card when he attacks. */
const CLOWN = "60201";
/** Maggia Enforcers: ATK 2, SCH 0, 3 hit points, Guard; a plain minion to engage and attack. */
const ENFORCERS = "60092";
/** Core "Advance" and "Assault": boost cards with no boost icon and no boost ability. */
const BLANKS = ["01187", "01187", "01186", "01186"];

const REFS = [
  "60134a.setup",
  "60134b.battle-in-the-bodega-forced-response",
  "60134b.battle-in-the-bodega-constant",
  "60135a.setup",
  "60135b.bull-in-a-china-shop-forced-interrupt",
  "60135b.bull-in-a-china-shop-constant",
  "60136a.setup",
  "60136b.hung-out-to-dry-forced-response",
  "60136b.hung-out-to-dry-constant",
  "60137a.setup",
  "60137b.pawn-shop-showdown-constant",
  "60137b.pawn-shop-showdown-forced-response",
  "60137b.pawn-shop-showdown-constant-2",
  "60138a.setup",
  "60138b.a-slice-of-the-pizza-dough-forced-response",
  "60138b.a-slice-of-the-pizza-dough-constant",
  "60139.when-revealed",
  "60139.shop-proprietor-forced-interrupt",
  "60140.man-bull-forced-response",
  "60140.boost",
  "60141.when-revealed",
  "60141.boost",
];

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const idOf = (s: GameState, code: string): InstanceId =>
  (Object.keys(s.instances) as InstanceId[]).find((i) => codeOf(s, i) === code)!;
const hero = (s: GameState, p: PlayerId = P1): InstanceId => identityOf(s, p);
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, WAVE11_DEPS)!;

/** Every main scheme in play, one per player. */
const schemesOf = (s: GameState) => [s.mainScheme, ...(s.extraMainSchemes ?? [])];
/** The main scheme in this player's play area. */
const schemeOf = (s: GameState, p: PlayerId): InstanceId => schemesOf(s).find((m) => m.playArea === p)!.instanceId;
const schemeCode = (s: GameState, p: PlayerId): string => codeOf(s, schemeOf(s, p));
const threatOf = (s: GameState, p: PlayerId): number => inst(s, schemeOf(s, p)).threat;
const counter = (s: GameState, id: InstanceId, type: string): number => inst(s, id).counters?.[type] ?? 0;

const SEATS = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];

interface Options {
  readonly players?: number;
  readonly seed?: number;
  readonly difficulty?: "standard" | "expert";
  /** Each seat's main scheme, in seat order (standard mode only). */
  readonly picks?: readonly string[];
  readonly modularSetIds?: readonly string[];
  /** Cards added to the encounter deck (Focused Defense 21101, the one "attach to the main scheme" card). */
  readonly extraEncounter?: readonly string[];
}

/** The scenario builder's game against Hammerhead; every hero in hero form, at the start of the player phase. */
function newGame(opts: Options = {}): GameState {
  const { players = 2, seed = 1, difficulty = "standard", picks = [BODEGA, HUNG] } = opts;
  const config = wave11Scenario("protection-racket", {
    villainSetId: "hammerhead",
    players: SEATS.slice(0, players),
    seed,
    difficulty,
    ...(difficulty === "standard" ? { mainSchemePicks: picks.slice(0, players) } : {}),
    ...(opts.modularSetIds ? { modularSetIds: opts.modularSetIds } : {}),
  } as never);
  const adjusted = (
    opts.extraEncounter ? { ...config, encounterDeck: [...config.encounterDeck, ...opts.extraEncounter] } : config
  ) as typeof config;
  const created = createGame(adjusted, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, firstLegal, (st) => st.step.phase === "player", WAVE11_DEPS);
  for (let n = 0; n < players; n++) s = withForm(s, { heroForm: 0 }, n === 0 ? P1 : P2);
  return s;
}

/** An expert game (the schemes are drawn from the seed) in which `p` holds `code`: the first such seed. */
function expertGameWith(code: string, p: PlayerId = P1, opts: Options = {}): GameState {
  for (let seed = 1; seed < 80; seed++) {
    const s = newGame({ ...opts, seed, difficulty: "expert" });
    if (schemeCode(s, p) === code) return s;
  }
  throw new Error(`no seed gives ${p} ${code}`);
}

const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));
/** Answers a defender prompt with `defender` when it is offered, and declines otherwise. */
const defendsWith =
  (defender: InstanceId): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind !== "declareDefender") return firstLegal(s);
    return choice.options.some((o) => (o.optionId as string) === (defender as string))
      ? [defender as string]
      : ["decline"];
  };

const drive = (state: GameState, command: Command, pick: Picker = declines): GameState =>
  driveEventsPicking(WAVE11_DEPS, state, pick, command).state;

/**
 * Takes the Protection Racket encounter cards (Shop Proprietor, Man-Bull, Change of Venue) out of the deck unless a test
 * is about them, so no random reveal or boost card in a comparison run swaps a scheme or puts a minion on one.
 */
function quiet(state: GameState, keep: readonly string[] = []): GameState {
  const gone = [PROPRIETOR, MAN_BULL, VENUE].filter((c) => !keep.includes(c));
  const out = (i: InstanceId) => !gone.includes(codeOf(state, i));
  return {
    ...state,
    encounterDecks: Object.fromEntries(
      Object.entries(state.encounterDecks).map(([id, pile]) => [
        id,
        { deck: pile.deck.filter(out), discard: pile.discard.filter(out) },
      ]),
    ),
  } as GameState;
}

/**
 * `boosts` blank boost cards, then these cards dealt, then the villain phase after the players in `who` (default every
 * player) end their turn. The cards after the stacked ones are the deck's own, in its seeded order.
 */
function villainPhase(
  state: GameState,
  boosts: number,
  dealt: readonly string[],
  pick: Picker = declines,
  who: readonly PlayerId[] = state.players.map((p) => p.playerId),
) {
  const stacked = stackEncounterDeck(quiet(state, dealt), ...BLANKS.slice(0, boosts), ...dealt);
  return driveEventsPicking(WAVE11_DEPS, stacked, pick, ...who.map((p) => endTurn(p)));
}
/** P1's turn is over, so P2 may act (a player acts on their own turn). */
const asP2 = (s: GameState): GameState => drive(s, endTurn(P1));

/**
 * The same state with `p`'s scheme turned into another Protection Racket scheme (same threat, same everything else):
 * the reference run of a comparison. Both the card instance and the main scheme state name the card.
 */
function asScheme(state: GameState, p: PlayerId, code: string): GameState {
  const id = schemeOf(state, p);
  const turned = patchInstance(state, id, { cardId: code as never });
  const swap = <T extends { instanceId: InstanceId }>(m: T): T => (m.instanceId === id ? { ...m, cardId: code } : m);
  return {
    ...turned,
    mainScheme: swap(turned.mainScheme),
    extraMainSchemes: (turned.extraMainSchemes ?? []).map(swap),
  } as GameState;
}

/** The pieces of a villain phase answered by letting nothing defend, with Hammerhead stunned (he attacks nobody). */
const stunned = (s: GameState): GameState =>
  patchInstance(s, s.activeVillainId!, { statuses: { stunned: 1, confused: 0, tough: 0 } });
/** The copy of `code` that is engaged with a player (not one in the deck). */
const engagedCopy = (s: GameState, code: string): InstanceId =>
  (Object.keys(s.instances) as InstanceId[]).find((i) => codeOf(s, i) === code && inst(s, i).engagedWith !== null)!;
/** The copy of `code` that is attached to a card. */
const attachedCopy = (s: GameState, code: string): InstanceId =>
  (Object.keys(s.instances) as InstanceId[]).find((i) => codeOf(s, i) === code && inst(s, i).attachedTo)!;
/** The `triggerEvent` events of one kind that were initiated. */
const initiated = (events: readonly any[], kind: string) =>
  events
    .filter((e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === kind)
    .map((e) => e.event);

/** A basic attack by `p`'s hero on `target`. */
const attack = (state: GameState, target: InstanceId, p: PlayerId = P1): GameState =>
  drive(state, { type: "basicAttack", playerId: p, attackerInstanceId: hero(state, p), targetInstanceId: target });
const ready = (state: GameState, id: InstanceId): GameState => patchInstance(state, id, { exhausted: false });
/** Whether the card is in play (a card's `home` is only the deck it belongs to). */
const inPlay = (s: GameState, id: InstanceId): boolean => cardsInPlay(s).includes(id);

describe("registry", () => {
  it("registers every printed ref of the eight cards; nothing is skipped", () => {
    const printed = [BODEGA, BULL, HUNG, PAWN, PIZZA, PROPRIETOR, MAN_BULL, VENUE].flatMap((c) =>
      abilityRefIds(data(c)),
    );
    expect([...printed].sort()).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each([...REFS])("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
});

describe("setup: a main scheme per player, on its 1B face", () => {
  it("each player's pick is in their play area; the three unused are set aside", () => {
    const s = newGame();
    expect(schemeCode(s, P1)).toBe(BODEGA);
    expect(schemeCode(s, P2)).toBe(HUNG);
    expect(s.encounterSetAside).toHaveLength(3);
    expect(s.encounterSetAside.map((i) => codeOf(s, i)).sort()).toEqual([BULL, PAWN, PIZZA].sort());
  });
});

describe("1B: any player eliminated loses the game (all five)", () => {
  /** P2's hero is one hit from death, in hero form; Hammerhead attacks undefended in the villain phase. */
  const doomed = (picks: readonly string[], dying: boolean): GameState => {
    let s = newGame({ picks });
    const maxHp = profile(s, hero(s, P2)).maxHp;
    if (dying) s = patchInstance(s, hero(s, P2), { damage: maxHp - 1 });
    return s;
  };
  it.each(SCHEMES)("%s: P2 eliminated -> the players lose; the control (P2 alive) plays on", (code) => {
    const other = code === BODEGA ? BULL : BODEGA;
    const alive = villainPhase(doomed([code, other], false), 2, []).state;
    expect(alive.outcome).toBeNull();
    const dead = villainPhase(doomed([code, other], true), 2, []).state;
    expect(dead.outcome).toMatchObject({ result: "loss", reason: "cardAbility" });
  });
  it("the elimination of the player whose scheme it is loses as well (P1 holds it, P1 dies)", () => {
    let s = newGame({ picks: [PAWN, PIZZA] });
    s = patchInstance(s, hero(s, P1), { damage: profile(s, hero(s, P1)).maxHp - 1 });
    expect(villainPhase(s, 2, []).state.outcome).toMatchObject({ result: "loss", reason: "cardAbility" });
  });
});

describe("60134b Battle in the Bodega", () => {
  /** P1 (Bodega) with two Enforcers engaged to it, both heroes in hero form, no damage anywhere. */
  const arena = (opts: Options = {}, start?: GameState) => {
    let s = start ?? newGame(opts);
    const first = engageMinion(s, ENFORCERS, P1);
    s = first.state;
    return { s, first: first.id };
  };

  it("a character in this play area is attacked: 1 damage to the attacker and 1 threat on this scheme only", () => {
    const { s: base, first } = arena();
    const before = [threatOf(base, P1), threatOf(base, P2)];
    const done = attack(base, first);
    expect(inst(done, hero(done)).damage, "the attacker took 1").toBe(1);
    expect(threatOf(done, P1)).toBe(before[0]! + 1);
    expect(threatOf(done, P2), "the other scheme is untouched").toBe(before[1]);
  });

  it("a minion engaged with another player is in that player's area: P2's Bodega answers P1's attack on it", () => {
    const base = newGame({ picks: [HUNG, BODEGA] });
    const { state, id } = engageMinion(base, ENFORCERS, P2);
    const before = [threatOf(state, P1), threatOf(state, P2)];
    const done = attack(state, id, P1);
    expect(inst(done, hero(done, P1)).damage, "the attacker, P1's hero, took 1").toBe(1);
    expect(threatOf(done, P2)).toBe(before[1]! + 1);
    expect(threatOf(done, P1), "P1 holds Hung Out to Dry, which does not hear it").toBe(before[0]);
  });

  // Owner Q208 open, built A: the attacked character was in this play area when it was attacked, so the response still
  // comes when the attack defeated it (RRG 1.8 "Response", p. 38; the Omega Zero Tolerance ruling resolves "after ...
  // attacks and defeats an ally" after the ally has left play).
  // The engine reads the defeated minion's engagement as it was attacked (`characterAttacked.targetEngagedWith`).
  it("an attack that defeats the minion still answers: 1 damage to the attacker and 1 threat", () => {
    const { s: base, first } = arena();
    const doomed = patchInstance(base, first, { damage: 2 });
    expect(inPlay(doomed, first), "the minion is in play before the attack").toBe(true);
    const done = attack(doomed, first);
    expect(inPlay(done, first), "the minion was defeated").toBe(false);
    expect(inst(done, hero(done)).damage).toBe(1);
    expect(threatOf(done, P1)).toBe(threatOf(doomed, P1) + 1);
  });

  it("the villain is in no play area: attacking him does not trigger it", () => {
    const base = newGame();
    const before = threatOf(base, P1);
    const done = attack(base, base.activeVillainId!);
    expect(inst(done, hero(done)).damage).toBe(0);
    expect(threatOf(done, P1)).toBe(before);
  });

  it("standard mode: once per phase, so the second attack of the phase does nothing; the limit lifts after the phase", () => {
    const { s: base, first } = arena();
    const second = engageMinion(base, ENFORCERS, P1);
    const start = threatOf(second.state, P1);
    const one = attack(second.state, first);
    expect(threatOf(one, P1)).toBe(start + 1);
    expect(counter(one, schemeOf(one, P1), "bodega"), "the use is recorded").toBe(1);
    const two = attack(ready(one, hero(one)), second.id);
    expect(threatOf(two, P1), "no second threat this phase").toBe(start + 1);
    expect(inst(two, hero(two)).damage, "and no second damage").toBe(1);
    // The phase ends: the record goes with it (the heroes are alter-egos for the villain phase, so nothing is attacked).
    const calm = withForm(withForm(two, "alterEgo", P1), "alterEgo", P2);
    const over = driveEventsPicking(WAVE11_DEPS, calm, declines, endTurn(P1), endTurn(P2)).state;
    expect(counter(over, schemeOf(over, P1), "bodega")).toBe(0);
  });

  /** The 1-damage hits this scheme dealt to attackers (a tough status card on one still counts: it was dealt). */
  const hitsBy = (events: readonly any[], scheme: InstanceId): number =>
    events.filter(
      (e) =>
        e.type === "triggerEvent" &&
        e.phase === "initiated" &&
        e.event.kind === "dealDamage" &&
        e.event.sourceInstanceId === scheme,
    ).length;

  it("standard mode: the villain phase's two attacks on P1's hero (Hammerhead, the Enforcers) give one use between them", () => {
    const { s: base } = arena();
    const real = villainPhase(base, 2, []);
    const reference = villainPhase(asScheme(base, P1, PAWN), 2, []);
    expect(threatOf(real.state, P1) - threatOf(reference.state, P1), "one threat, from the first attack").toBe(1);
    expect(hitsBy(real.events, schemeOf(base, P1)), "one hit").toBe(1);
    expect(hitsBy(reference.events, schemeOf(base, P1))).toBe(0);
    expect(threatOf(real.state, P2)).toBe(threatOf(reference.state, P2));
  });

  it("expert mode: both of those attacks answer", () => {
    const expert = expertGameWith(BODEGA, P1);
    const { s: base } = arena({}, expert);
    const real = villainPhase(base, 2, []);
    const reference = villainPhase(asScheme(base, P1, PAWN), 2, []);
    expect(threatOf(real.state, P1) - threatOf(reference.state, P1)).toBe(2);
    expect(hitsBy(real.events, schemeOf(base, P1))).toBe(2);
  });

  it("expert mode: no limit, every attack answers", () => {
    const base = expertGameWith(BODEGA, P1);
    const a = engageMinion(base, ENFORCERS, P1);
    const b = engageMinion(a.state, ENFORCERS, P1);
    const start = threatOf(b.state, P1);
    const one = attack(b.state, a.id);
    const two = attack(ready(one, hero(one)), b.id);
    expect(threatOf(two, P1)).toBe(start + 2);
    expect(inst(two, hero(two)).damage).toBe(2);
    expect(counter(two, schemeOf(two, P1), "bodega"), "no use recorded in expert mode").toBe(0);
  });
});

/** `p` plays this ally from their hand, paying with other cards in hand. */
function playAlly(state: GameState, p: PlayerId, code: string): { state: GameState; id: InstanceId } {
  const given = moveToHand(state, p, code);
  const id = given.ids[0]!;
  const cost = (given.state.cardPool[code as never] as any).cost as number;
  return { state: drive(given.state, play(p, id, payWith(given.state, p, cost, [id]))), id };
}
const BLACK_CAT = "01002"; // ally, 2 hit points, cost 2
const MARIA_HILL = "01067"; // ally, 2 hit points, cost 2
const inDiscard = (s: GameState, p: PlayerId, id: InstanceId): boolean => playerOf(s, p).discard.includes(id);

describe("60135b Bull in a China Shop", () => {
  /** P1 (Bull) with Black Cat (`hurt` damage) in play and Enforcers engaged; Hammerhead stunned; P2 an alter-ego. */
  function allyArena(hurt: number, opts: Options = {}) {
    let s = newGame({ picks: [BULL, PAWN], ...opts });
    s = withForm(s, "alterEgo", P2);
    const ally = playAlly(s, P1, BLACK_CAT);
    s = patchInstance(ally.state, ally.id, { damage: hurt });
    const enforcers = engageMinion(s, ENFORCERS, P1);
    return { s: stunned(enforcers.state), ally: ally.id };
  }
  /** The villain phase in which the Enforcers (ATK 2) attack P1 and Black Cat defends. */
  const defended = (s: GameState, ally: InstanceId) => villainPhase(s, 3, [], defendsWith(ally));

  it("an ally defeated with excess damage: that much threat on this scheme", () => {
    const { s, ally } = allyArena(1);
    const real = defended(s, ally);
    const reference = defended(asScheme(s, P1, PAWN), ally);
    expect(inDiscard(real.state, P1, ally), "Black Cat was defeated").toBe(true);
    // ATK 2 against 1 remaining hit point.
    expect(threatOf(real.state, P1) - threatOf(reference.state, P1)).toBe(1);
    expect(threatOf(real.state, P2)).toBe(threatOf(reference.state, P2));
  });

  it("exactly lethal damage is no excess: the ally dies and the scheme gets nothing", () => {
    const { s, ally } = allyArena(0);
    const real = defended(s, ally);
    const reference = defended(asScheme(s, P1, PAWN), ally);
    expect(inDiscard(real.state, P1, ally)).toBe(true);
    expect(threatOf(real.state, P1)).toBe(threatOf(reference.state, P1));
  });

  it("an ally in another play area is not 'in this play area': P2's ally dies with excess, P1's Bull hears nothing", () => {
    let s = newGame({ picks: [BULL, PAWN] });
    s = withForm(s, "alterEgo", P1);
    const ally = playAlly(asP2(s), P2, MARIA_HILL);
    s = patchInstance(ally.state, ally.id, { damage: 1 });
    s = stunned(engageMinion(s, ENFORCERS, P2).state);
    const real = villainPhase(s, 3, [], defendsWith(ally.id), [P2]);
    const reference = villainPhase(asScheme(s, P1, PAWN), 3, [], defendsWith(ally.id), [P2]);
    expect(inDiscard(real.state, P2, ally.id), "P2's ally was defeated with excess").toBe(true);
    expect(threatOf(real.state, P1)).toBe(threatOf(reference.state, P1));
  });

  /** P1 attacks Enforcers (3 hit points, 2 damage on it): 1 remaining, so ATK - 1 is excess. */
  function hitMinion(s0: GameState) {
    const e = engageMinion(s0, ENFORCERS, P1);
    const hurt = patchInstance(e.state, e.id, { damage: 2 });
    expect(inPlay(hurt, e.id)).toBe(true);
    const done = attack(hurt, e.id);
    return {
      before: threatOf(hurt, P1),
      after: threatOf(done, P1),
      done,
      id: e.id,
      atk: profile(hurt, hero(hurt)).atk,
    };
  }

  it("standard mode: a minion defeated with excess damage adds nothing (allies only)", () => {
    const { before, after, done, id } = hitMinion(newGame({ picks: [BULL, PAWN] }));
    expect(inPlay(done, id), "the minion was defeated").toBe(false);
    expect(after).toBe(before);
  });

  it("expert mode: a minion in this play area counts as well", () => {
    const { before, after, atk } = hitMinion(expertGameWith(BULL, P1));
    expect(atk).toBeGreaterThan(1);
    expect(after - before).toBe(atk - 1);
  });
});

describe("60136b Hung Out to Dry", () => {
  it("an ally P2 plays takes 1 damage and puts 1 threat on P2's scheme only", () => {
    const base = newGame({ picks: [PAWN, HUNG] });
    const played = playAlly(asP2(base), P2, MARIA_HILL);
    const before = asP2(base);
    expect(inst(played.state, played.id).damage).toBe(1);
    expect(threatOf(played.state, P2)).toBe(threatOf(before, P2) + 1);
    expect(threatOf(played.state, P1)).toBe(threatOf(before, P1));
  });

  it("an ally played in a play area with another scheme is not hurt", () => {
    const base = newGame({ picks: [PAWN, HUNG] });
    const played = playAlly(base, P1, BLACK_CAT);
    expect(inst(played.state, played.id).damage).toBe(0);
    expect(threatOf(played.state, P1)).toBe(threatOf(base, P1));
    expect(threatOf(played.state, P2)).toBe(threatOf(base, P2));
  });

  it("a minion revealed and engaged with P2 takes 1 damage and adds 1 threat; one engaged with P1 does not", () => {
    let s = newGame({ picks: [PAWN, HUNG] });
    s = withForm(withForm(s, "alterEgo", P1), "alterEgo", P2);
    const underboss = "60093";
    const real = villainPhase(s, 2, [underboss, ENFORCERS]);
    const reference = villainPhase(asScheme(s, P2, PAWN), 2, [underboss, ENFORCERS]);
    expect(inst(real.state, engagedCopy(real.state, ENFORCERS)).engagedWith).toBe(P2);
    expect(inst(real.state, engagedCopy(real.state, ENFORCERS)).damage).toBe(1);
    expect(inst(reference.state, engagedCopy(reference.state, ENFORCERS)).damage).toBe(0);
    expect(inst(real.state, engagedCopy(real.state, underboss)).engagedWith).toBe(P1);
    expect(inst(real.state, engagedCopy(real.state, underboss)).damage).toBe(0);
    expect(threatOf(real.state, P2) - threatOf(reference.state, P2)).toBe(1);
    expect(threatOf(real.state, P1)).toBe(threatOf(reference.state, P1));
  });
});

describe("60137b Pawn Shop Showdown", () => {
  const TENACITY = "01093"; // upgrade, cost 2
  const INTUITION = "01065"; // upgrade, cost 2
  const SHOOTER = "01008"; // upgrade, cost 1
  const HELMET = "01016"; // P2's upgrade, cost 2
  /** Whether playing `id` for `n` other cards from `p`'s hand is legal. */
  const legal = (s: GameState, p: PlayerId, id: InstanceId, n: number): boolean =>
    applyCommand(s, play(p, id, payWith(s, p, n, [id]), { attachToInstanceId: hero(s, p) }), WAVE11_DEPS).ok;
  const cast = (s: GameState, p: PlayerId, id: InstanceId, n: number): GameState =>
    drive(s, play(p, id, payWith(s, p, n, [id]), { attachToInstanceId: hero(s, p) }));

  it("the first upgrade its player plays each round costs 1 less, the second does not, the next round restores it", () => {
    const given = moveToHand(newGame({ picks: [PAWN, HUNG] }), P1, TENACITY, INTUITION, SHOOTER);
    const [tenacity, intuition, shooter] = given.ids as [InstanceId, InstanceId, InstanceId];
    const s0 = given.state;
    expect(legal(s0, P1, tenacity, 0), "cost 2 less 1 is still 1").toBe(false);
    expect(legal(s0, P1, tenacity, 1), "paid with 1 card").toBe(true);
    const s1 = cast(s0, P1, tenacity, 1);
    expect(inst(s1, tenacity).attachedTo).toBe(hero(s1));
    expect(legal(s1, P1, shooter, 0), "a cost 1 upgrade is not free the second time").toBe(false);
    expect(legal(s1, P1, intuition, 1), "the second upgrade is not discounted").toBe(false);
    expect(legal(s1, P1, intuition, 2), "full price").toBe(true);
    // The round ends (alter-egos, so nothing attacks): the discount is back for the first upgrade of the new round.
    const calm = withForm(withForm(s1, "alterEgo", P1), "alterEgo", P2);
    // The first player token moved on: P2 takes the new round's first turn.
    const next = drive(villainPhase(calm, 2, []).state, endTurn(P2));
    expect(next.step.phase).toBe("player");
    expect(legal(next, P1, intuition, 1), "first upgrade of the new round").toBe(true);
    expect(legal(next, P1, intuition, 0)).toBe(false);
  });

  it("only its own player's upgrades, and only upgrades: P2 pays full price, an ally costs full price", () => {
    const given = moveToHand(asP2(newGame({ picks: [PAWN, HUNG] })), P2, HELMET);
    const [helmet] = given.ids as [InstanceId];
    expect(legal(given.state, P2, helmet, 1)).toBe(false);
    expect(legal(given.state, P2, helmet, 2)).toBe(true);
    const ally = moveToHand(newGame({ picks: [PAWN, HUNG] }), P1, BLACK_CAT);
    const cat = ally.ids[0]!;
    expect(applyCommand(ally.state, play(P1, cat, payWith(ally.state, P1, 1, [cat])), WAVE11_DEPS).ok).toBe(false);
  });

  it("an upgrade entering play in this play area places 1 threat here; in another play area it does not", () => {
    const given = moveToHand(newGame({ picks: [PAWN, HUNG] }), P1, TENACITY);
    const [tenacity] = given.ids as [InstanceId];
    const placed = cast(given.state, P1, tenacity, 1);
    expect(threatOf(placed, P1)).toBe(threatOf(given.state, P1) + 1);
    expect(threatOf(placed, P2)).toBe(threatOf(given.state, P2));
    const other = moveToHand(asP2(newGame({ picks: [PAWN, HUNG] })), P2, HELMET);
    const [helmet] = other.ids as [InstanceId];
    const cast2 = cast(other.state, P2, helmet, 2);
    expect(threatOf(cast2, P1), "P1's Pawn Shop does not hear P2's upgrade").toBe(threatOf(other.state, P1));
    expect(threatOf(cast2, P2)).toBe(threatOf(other.state, P2));
  });

  // Focused Defense (21101) is the one encounter attachment that attaches to "the main scheme": revealed by a player, it
  // goes on the scheme in that player's play area (MC60 p. 13), which is in that play area.
  it("an attachment entering play on this play area's main scheme places 1 threat here (Focused Defense)", () => {
    let s = newGame({ picks: [PAWN, HUNG], extraEncounter: ["21101"] });
    s = withForm(withForm(s, "alterEgo", P1), "alterEgo", P2);
    const real = villainPhase(s, 2, ["21101", "60093"]);
    const reference = villainPhase(asScheme(s, P1, BULL), 2, ["21101", "60093"]);
    expect(inst(real.state, attachedCopy(real.state, "21101")).attachedTo, "on P1's scheme").toBe(schemeOf(s, P1));
    expect(threatOf(real.state, P1) - threatOf(reference.state, P1)).toBe(1);
    expect(threatOf(real.state, P2)).toBe(threatOf(reference.state, P2));
  });
  it("and on the other player's main scheme it is not heard", () => {
    let s = newGame({ picks: [PAWN, HUNG], extraEncounter: ["21101"] });
    s = withForm(withForm(s, "alterEgo", P1), "alterEgo", P2);
    const real = villainPhase(s, 2, ["60093", "21101", ENFORCERS]);
    const reference = villainPhase(asScheme(s, P1, BULL), 2, ["60093", "21101", ENFORCERS]);
    expect(inst(real.state, attachedCopy(real.state, "21101")).attachedTo, "on P2's scheme").toBe(schemeOf(s, P2));
    expect(threatOf(real.state, P1)).toBe(threatOf(reference.state, P1));
  });

  /** An encounter attachment (Utility Van, onto the enemy with the fewest remaining hit points) revealed in the villain phase. */
  function vanOnto(owner: PlayerId) {
    let s = newGame({ picks: [PAWN, HUNG], modularSetIds: ["drive", "disasters"] });
    s = withForm(withForm(s, "alterEgo", P1), "alterEgo", P2);
    // The minion of `owner` has 1 hit point left; nobody else has a minion: the Van picks it.
    const mine = engageMinion(s, ENFORCERS, owner);
    s = patchInstance(mine.state, mine.id, { damage: 2 });
    return { s, minion: mine.id };
  }
  it("an attachment entering play on a minion in this play area places 1 threat here (Utility Van)", () => {
    const { s, minion } = vanOnto(P1);
    const real = villainPhase(s, 2, ["60188", "01186"]);
    const reference = villainPhase(asScheme(s, P1, BULL), 2, ["60188", "01186"]);
    expect(inst(real.state, attachedCopy(real.state, "60188")).attachedTo, "on the weakened minion").toBe(minion);
    expect(threatOf(real.state, P1) - threatOf(reference.state, P1)).toBe(1);
    expect(threatOf(real.state, P2)).toBe(threatOf(reference.state, P2));
  });
  it("an attachment on a minion of another play area is not heard (P1's Pawn Shop, the Van on P2's minion)", () => {
    const { s, minion } = vanOnto(P2);
    const real = villainPhase(s, 2, ["01186", "60188"]);
    const reference = villainPhase(asScheme(s, P1, BULL), 2, ["01186", "60188"]);
    expect(inst(real.state, attachedCopy(real.state, "60188")).attachedTo).toBe(minion);
    expect(threatOf(real.state, P1)).toBe(threatOf(reference.state, P1));
  });
});

describe("60138b A Slice of the Pizza Dough", () => {
  /** P1 holds Pizza and is hurt by 2; P2 holds Pawn Shop (which hears none of this). */
  const hurtGame = (opts: Options = {}) => {
    const s = newGame({ picks: [PIZZA, PAWN], ...opts });
    return patchInstance(s, hero(s), { damage: 2 });
  };
  /** An Enforcers engaged with `to` with 1 hit point left. */
  const weak = (s: GameState, to: PlayerId) => {
    const e = engageMinion(s, ENFORCERS, to);
    return { s: patchInstance(e.state, e.id, { damage: 2 }), id: e.id };
  };

  it("a character in this play area defeats a minion: heal 1 damage from it and place 1 threat here", () => {
    const { s, id } = weak(hurtGame(), P1);
    expect(inPlay(s, id)).toBe(true);
    const done = attack(s, id);
    expect(inPlay(done, id), "the minion was defeated").toBe(false);
    expect(inst(done, hero(done)).damage, "2 damage, 1 healed").toBe(1);
    expect(threatOf(done, P1)).toBe(threatOf(s, P1) + 1);
    expect(threatOf(done, P2)).toBe(threatOf(s, P2));
  });

  it("the defeated minion may be in any play area: P1's hero defeats one engaged with P2", () => {
    const { s, id } = weak(hurtGame(), P2);
    expect(inPlay(s, id)).toBe(true);
    const done = attack(s, id);
    expect(inPlay(done, id)).toBe(false);
    expect(inst(done, hero(done)).damage).toBe(1);
    expect(threatOf(done, P1)).toBe(threatOf(s, P1) + 1);
    expect(threatOf(done, P2)).toBe(threatOf(s, P2));
  });

  it("a side scheme counts too (in the villain's play area)", () => {
    const side = encounterCardInVillainArea(hurtGame(), "60094", 1);
    expect(inPlay(side.state, side.id)).toBe(true);
    const done = drive(side.state, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: hero(side.state),
      schemeInstanceId: side.id,
    });
    expect(inPlay(done, side.id), "the side scheme was defeated").toBe(false);
    expect(inst(done, hero(done)).damage).toBe(1);
    expect(threatOf(done, P1)).toBe(threatOf(side.state, P1) + 1);
  });

  /** P1 (Pizza) with Black Cat (1 hit point left) in play, which defends against the attack of the enemy in `foe`. */
  function allyDies(foe: "minion" | "villain") {
    let s = newGame({ picks: [PIZZA, PAWN] });
    s = withForm(s, "alterEgo", P2);
    const cat = playAlly(s, P1, BLACK_CAT);
    s = patchInstance(cat.state, cat.id, { damage: 1 });
    if (foe === "villain")
      return { s: patchInstance(s, s.activeVillainId!, { damage: 2 }), cat: cat.id, foe: s.activeVillainId! };
    const e = engageMinion(s, ENFORCERS, P1);
    return { s: stunned(patchInstance(e.state, e.id, { damage: 1 })), cat: cat.id, foe: e.id };
  }

  it("a minion engaged with P1 defeats P1's ally: heal 1 damage from the minion and place 1 threat here", () => {
    const { s, cat, foe } = allyDies("minion");
    const real = villainPhase(s, 3, [], defendsWith(cat));
    const reference = villainPhase(asScheme(s, P1, PAWN), 3, [], defendsWith(cat));
    expect(inDiscard(real.state, P1, cat), "Black Cat was defeated by the Enforcers").toBe(true);
    expect(inst(real.state, foe).damage, "1 damage healed from the minion").toBe(inst(reference.state, foe).damage - 1);
    expect(threatOf(real.state, P1) - threatOf(reference.state, P1)).toBe(1);
    expect(threatOf(real.state, P2)).toBe(threatOf(reference.state, P2));
  });

  it("control: the villain is in no play area, so his defeating P1's ally heals nothing and adds nothing", () => {
    const { s, cat, foe } = allyDies("villain");
    const real = villainPhase(s, 3, [], defendsWith(cat));
    const reference = villainPhase(asScheme(s, P1, PAWN), 3, [], defendsWith(cat));
    expect(inDiscard(real.state, P1, cat), "Black Cat was defeated by Hammerhead").toBe(true);
    expect(inst(real.state, foe).damage).toBe(inst(reference.state, foe).damage);
    expect(threatOf(real.state, P1)).toBe(threatOf(reference.state, P1));
  });

  it("no defeat, no trigger: an attack that leaves the minion standing heals nothing and adds nothing", () => {
    const e = engageMinion(hurtGame(), ENFORCERS, P1);
    const done = attack(e.state, e.id);
    expect(inst(done, e.id).damage).toBeGreaterThan(0);
    expect(inst(done, hero(done)).damage).toBe(2);
    expect(threatOf(done, P1)).toBe(threatOf(e.state, P1));
  });

  it("another play area's character defeating a minion is not 'a character in this play area'", () => {
    const base = newGame({ picks: [PIZZA, PAWN] });
    const { s, id } = weak(asP2(base), P2);
    const hurt = patchInstance(s, hero(s, P2), { damage: 2 });
    expect(inPlay(hurt, id)).toBe(true);
    const done = attack(hurt, id, P2);
    expect(inPlay(done, id), "P2's hero defeated it").toBe(false);
    expect(threatOf(done, P1), "P1's Pizza Dough hears only characters of its own play area").toBe(threatOf(hurt, P1));
    expect(inst(done, hero(done, P2)).damage, "and P2's Pawn Shop heals nothing").toBe(2);
  });
});

describe("60139 Shop Proprietor", () => {
  it("is an encounter-backed card of the Protection Racket set, dealt in the encounter deck once", () => {
    expect(data(PROPRIETOR).cardBack).toBe("encounter");
    const config = wave11Scenario("protection-racket", {
      villainSetId: "hammerhead",
      players: SEATS,
      seed: 1,
      difficulty: "standard",
      mainSchemePicks: [BODEGA, HUNG],
    } as never);
    expect(config.encounterDeck.filter((c) => (c as string) === PROPRIETOR)).toHaveLength(1);
  });

  /** Hammerhead schemes against two alter-egos; `owner` is dealt Shop Proprietor (surge reveals Enforcers after it). */
  function revealed(owner: PlayerId) {
    let s = newGame({ picks: [PAWN, BULL] });
    s = withForm(withForm(s, "alterEgo", P1), "alterEgo", P2);
    // Each player is dealt one card first; a surge card is then drawn for its player: P1's, then P2's.
    const dealt = owner === P1 ? [PROPRIETOR, "60093", ENFORCERS] : ["60093", PROPRIETOR, ENFORCERS];
    const run = villainPhase(s, 2, dealt);
    return { before: s, ...run, prop: idOf(run.state, PROPRIETOR) };
  }

  it.each([P1, P2])(
    "When Revealed: put into play under the revealing player's control (%s) and gain surge",
    (owner) => {
      const { state, prop } = revealed(owner);
      expect(inst(state, prop).controllerId).toBe(owner);
      expect(playerOf(state, owner).playArea).toContain(prop);
      expect(profile(state, prop).maxHp).toBe(3);
      // Surge: the card after it was revealed to the same player.
      expect(inst(state, engagedCopy(state, ENFORCERS)).engagedWith).toBe(owner);
    },
  );

  it.each([P1, P2])("Forced Interrupt: when it leaves play, 4 threat on the main scheme in %s's play area", (owner) => {
    const { state: round1, prop } = revealed(owner);
    // Round two: the Proprietor has 1 hit point left and defends its controller against the Enforcers' attack.
    let s = stunned(patchInstance(round1, prop, { damage: 2 }));
    s = withForm(s, { heroForm: 0 }, owner);
    const turnOrder = round1.players.map((p) => p.playerId);
    const first = round1.firstPlayerId ?? turnOrder[0]!;
    const order = [first, ...turnOrder.filter((p) => p !== first)];
    const run = villainPhase(s, 3, [], defendsWith(prop), order);
    expect(inPlay(run.state, prop), "it left play").toBe(false);
    const fours = initiated(run.events, "placeThreat").filter((e) => e.sourceInstanceId === prop);
    expect(fours.map((e) => [e.schemeInstanceId, e.amount])).toEqual([[schemeOf(round1, owner), 4]]);
  });
});

describe("60140 Man-Bull", () => {
  /** `owner` (alter-ego for the other) with Black Cat in play and Man-Bull engaged; Hammerhead stunned. */
  function bullArena(owner: PlayerId, ally: string) {
    let s = newGame({ picks: [PAWN, HUNG] });
    const other = owner === P1 ? P2 : P1;
    s = withForm(s, "alterEgo", other);
    const playedBy = owner === P1 ? s : asP2(s);
    const cat = playAlly(playedBy, owner, ally);
    // Hung Out to Dry (P2) hurts a played ally: heal it back so every test starts from a fresh ally.
    const fresh = patchInstance(cat.state, cat.id, { damage: 0 });
    const bull = engageMinion(quiet(fresh, [MAN_BULL]), MAN_BULL, owner);
    return { s: stunned(bull.state), ally: cat.id, bull: bull.id };
  }
  const attackResolvedOn = (events: readonly any[], enemy: InstanceId) =>
    events.filter((e) => e.type === "attackResolved" && e.enemyInstanceId === enemy);

  it.each([P1, P2])(
    "Forced Response: after he attacks, threat equal to the excess damage on %s's scheme only",
    (owner) => {
      const { s, ally, bull } = bullArena(owner, owner === P1 ? BLACK_CAT : MARIA_HILL);
      const run = villainPhase(s, 3, [], defendsWith(ally), owner === P1 ? [P1, P2] : [P2]);
      const [resolved] = attackResolvedOn(run.events, bull);
      expect(resolved, "Man-Bull attacked").toBeDefined();
      const excess = resolved.damageDealt - 2;
      expect(excess, "ATK 4 or more against a 2 hit point ally").toBeGreaterThanOrEqual(2);
      expect(inDiscard(run.state, owner, ally), "the ally defended and died").toBe(true);
      const placed = initiated(run.events, "placeThreat").filter((e) => e.sourceInstanceId === bull);
      expect(placed.map((e) => [e.schemeInstanceId, e.amount])).toEqual([[schemeOf(s, owner), excess]]);
    },
  );

  it("no excess damage, no threat: a hero that survives the hit", () => {
    let s = newGame({ picks: [PAWN, HUNG] });
    s = withForm(s, "alterEgo", P2);
    const bull = engageMinion(quiet(s, [MAN_BULL]), MAN_BULL, P1);
    const run = villainPhase(stunned(bull.state), 3, []);
    expect(attackResolvedOn(run.events, bull.id)).toHaveLength(1);
    expect(inst(run.state, hero(run.state)).damage, "the hero was hit").toBeGreaterThan(0);
    expect(initiated(run.events, "placeThreat").filter((e) => e.sourceInstanceId === bull.id)).toEqual([]);
  });

  it("Boost: on an attack, the excess damage that attack dealt, on every main scheme (a boost card on the villain)", () => {
    let s = newGame({ picks: [PAWN, HUNG] });
    s = withForm(s, "alterEgo", P2);
    const cat = playAlly(s, P1, BLACK_CAT);
    // Man-Bull is Hammerhead's first boost card: 2 boost icons on his attack on P1's hero, defended by Black Cat.
    const staged = quiet(cat.state, [MAN_BULL]);
    const run = (boostFirst: string) =>
      driveEventsPicking(
        WAVE11_DEPS,
        stackEncounterDeck(boostFirst === MAN_BULL ? staged : quiet(cat.state), boostFirst, "01187", "01187"),
        defendsWith(cat.id),
        endTurn(P1),
        endTurn(P2),
      );
    const withBull = run(MAN_BULL);
    const withBlank = run("01186");
    const villain = staged.activeVillainId!;
    const [hit] = attackResolvedOn(withBull.events, villain);
    expect(hit, "Hammerhead attacked P1").toBeDefined();
    expect(hit.boostIcons, "Man-Bull's two icons").toBe(2);
    const excess = hit.damageDealt - 2;
    expect(excess).toBeGreaterThan(0);
    expect(inDiscard(withBull.state, P1, cat.id)).toBe(true);
    // MC60 p. 13: a boost card on the villain is in no player's play area, so "the main scheme" is each one.
    expect(threatOf(withBull.state, P1) - threatOf(withBlank.state, P1)).toBe(excess);
    expect(threatOf(withBull.state, P2) - threatOf(withBlank.state, P2)).toBe(excess);
  });

  it("Boost: on an engaged minion's attack, the excess damage on that player's scheme only (MC60 p. 13)", () => {
    // The Clown (villainous, ATK 1) engaged with P2 is dealt Man-Bull (2 boost icons) as his boost card: ATK 3 into
    // P2's Maria Hill (2 hit points), 1 excess. Hammerhead is stunned and confused (no attack, no scheme, so no boost
    // card for him against either player).
    let s = newGame({ picks: [PAWN, HUNG] });
    s = withForm(s, "alterEgo", P1);
    const hill = playAlly(asP2(s), P2, MARIA_HILL);
    // Hung Out to Dry (P2) hurts a played ally: heal it back.
    const fresh = patchInstance(hill.state, hill.id, { damage: 0 });
    const clown = engageMinion(quiet(fresh, [MAN_BULL]), CLOWN, P2);
    const staged = patchInstance(clown.state, clown.state.activeVillainId!, {
      statuses: { stunned: 1, confused: 1, tough: 0 },
    });
    const run = (boostFirst: string) =>
      driveEventsPicking(
        WAVE11_DEPS,
        stackEncounterDeck(quiet(staged, boostFirst === MAN_BULL ? [MAN_BULL] : []), boostFirst, "01187", "01187"),
        defendsWith(hill.id),
        endTurn(P2),
      );
    const withBull = run(MAN_BULL);
    const withBlank = run("01186");
    const [hit] = attackResolvedOn(withBull.events, clown.id);
    expect(hit, "The Clown attacked P2").toBeDefined();
    expect(hit.boostIcons, "Man-Bull's two icons").toBe(2);
    const excess = hit.damageDealt - 2;
    expect(excess).toBe(1);
    expect(inDiscard(withBull.state, P2, hill.id), "Maria Hill defended and died").toBe(true);
    expect(threatOf(withBull.state, P2) - threatOf(withBlank.state, P2), "on P2's scheme").toBe(excess);
    expect(threatOf(withBull.state, P1), "P1's scheme is untouched").toBe(threatOf(withBlank.state, P1));
  });

  it("Boost: on a scheme it adds nothing beyond its icons (P1 an alter-ego: Hammerhead schemes)", () => {
    let s = newGame({ picks: [PAWN, HUNG] });
    s = withForm(withForm(s, "alterEgo", P1), "alterEgo", P2);
    const run = (boostFirst: string) =>
      driveEventsPicking(
        WAVE11_DEPS,
        stackEncounterDeck(quiet(s, boostFirst === MAN_BULL ? [MAN_BULL] : []), boostFirst, "01187", "01187"),
        declines,
        endTurn(P1),
        endTurn(P2),
      );
    const withBull = run(MAN_BULL);
    const withBlank = run("01186");
    // The only difference is the two boost icons on the scheme the boost card was turned over for.
    expect(threatOf(withBull.state, P1) - threatOf(withBlank.state, P1)).toBe(2);
    expect(threatOf(withBull.state, P2)).toBe(threatOf(withBlank.state, P2));
  });
});

describe("60141 Change of Venue", () => {
  const swaps = (events: readonly any[]) => events.filter((e) => e.type === "mainSchemeSwapped");

  /** `owner` is dealt Change of Venue (surge), P1's scheme carrying 3 threat first. */
  function revealedVenue(owner: PlayerId, seed = 1, difficulty: "standard" | "expert" = "standard") {
    let s = newGame({ picks: [BODEGA, HUNG], seed, difficulty });
    s = withForm(withForm(s, "alterEgo", P1), "alterEgo", P2);
    s = patchInstance(s, schemeOf(s, owner), { threat: 3 });
    const dealt = owner === P1 ? [VENUE, "01186", "01186"] : ["01186", VENUE, "01186"];
    return { s, ...villainPhase(s, 2, dealt) };
  }

  it.each([P1, P2])(
    "When Revealed: %s's own scheme is swapped for a set-aside one, its threat carried over",
    (owner) => {
      const { s, state, events } = revealedVenue(owner);
      const other = owner === P1 ? P2 : P1;
      const [swap] = swaps(events);
      expect(swaps(events), "one swap").toHaveLength(1);
      expect(swap.playArea).toBe(owner);
      expect(swap.cardIds[0]).toBe(owner === P1 ? BODEGA : HUNG);
      expect(swap.threat, "the old scheme carried at least its 3").toBeGreaterThanOrEqual(3);
      expect(schemeCode(state, owner)).toBe(swap.cardIds[1]);
      expect(schemeCode(state, owner)).not.toBe(swap.cardIds[0]);
      expect(schemeCode(state, other), "the other player's scheme is untouched").toBe(schemeCode(s, other));
      // "Place the threat from the previous scheme on the new scheme": that much was placed on it.
      const placed = initiated(events, "placeThreat").filter((e) => e.schemeInstanceId === swap.incoming);
      expect(placed.map((e) => e.amount)).toContain(swap.threat);
      // The old scheme is set aside again, with the unused ones.
      expect(state.encounterSetAside.map((i) => codeOf(state, i))).toContain(swap.cardIds[0]);
      expect(state.encounterSetAside).toHaveLength(3);
    },
  );

  it("Surge: the card after it is revealed to the same player", () => {
    let s = newGame({ picks: [BODEGA, HUNG] });
    s = withForm(withForm(s, "alterEgo", P1), "alterEgo", P2);
    const run = villainPhase(s, 2, [VENUE, "01186", ENFORCERS]);
    expect(inst(run.state, engagedCopy(run.state, ENFORCERS)).engagedWith).toBe(P1);
  });

  it("the new scheme is random: seeds give different replacements", () => {
    const got = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) got.add(swaps(revealedVenue(P1, seed).events)[0].cardIds[1]);
    expect(got.size).toBeGreaterThan(1);
    for (const code of got) expect([BULL, PAWN, PIZZA]).toContain(code);
  });

  it("expert mode swaps just the same (the replacement is one of the three unused)", () => {
    const run = revealedVenue(P1, 1, "expert");
    expect(swaps(run.events)).toHaveLength(1);
    expect(run.state.encounterSetAside).toHaveLength(3);
  });

  it("Boost: on an attack another player defends, 'your' is the defending player (RRG 1.8 Defend, pp. 15-16)", () => {
    // P1 is attacked by Hammerhead (hero form) and P2's ally defends it: P2 is the player whose scheme is swapped.
    let s = newGame({ picks: [BODEGA, HUNG] });
    s = withForm(s, "alterEgo", P2);
    const ally = playAlly(asP2(s), P2, MARIA_HILL);
    const staged = quiet(patchInstance(ally.state, ally.id, { damage: 0 }), [VENUE]);
    const run = driveEventsPicking(
      WAVE11_DEPS,
      stackEncounterDeck(staged, VENUE, "01187", "01187"),
      defendsWith(ally.id),
      endTurn(P2),
    );
    const [swap] = swaps(run.events);
    expect(swap, "the boost swapped a scheme").toBeDefined();
    expect(swap.playArea, "the defending player's").toBe(P2);
    expect(schemeCode(run.state, P1)).toBe(BODEGA);
    expect(schemeCode(run.state, P2)).not.toBe(HUNG);
  });

  it("Boost: resolves the When Revealed ability, swapping the scheme of the player it was turned over against", () => {
    let s = newGame({ picks: [BODEGA, HUNG] });
    s = withForm(withForm(s, "alterEgo", P1), "alterEgo", P2);
    const staged = quiet(s, [VENUE]);
    // Hammerhead's first activation (against P1) takes Change of Venue as its boost card.
    const run = driveEventsPicking(
      WAVE11_DEPS,
      stackEncounterDeck(staged, VENUE, "01187", "01187"),
      declines,
      endTurn(P1),
      endTurn(P2),
    );
    expect(swaps(run.events)).toHaveLength(1);
    expect(swaps(run.events)[0].playArea).toBe(P1);
    expect(schemeCode(run.state, P2)).toBe(HUNG);
    expect(schemeCode(run.state, P1)).not.toBe(BODEGA);
  });

  // The five cards share their 1A title, "Protection Racket" (the data's card name), but the swap compares the faceup
  // 1B titles, which all differ (RRG 1.8 pp. 23, 42; `resolve/swap-main-scheme.ts`): the swap leaves and enters play.
  it("with the shipped card data (all five schemes named Protection Racket) the swap goes through", () => {
    let s = newGame({ picks: [BODEGA, HUNG] });
    s = withForm(withForm(s, "alterEgo", P1), "alterEgo", P2);
    const run = villainPhase(s, 2, [VENUE, "01186", "01186"]);
    expect(swaps(run.events)).toHaveLength(1);
  });
});
