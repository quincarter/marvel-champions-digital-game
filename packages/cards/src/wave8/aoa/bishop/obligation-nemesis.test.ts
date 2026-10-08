import { AOA_CARDS, AOA_STARTER_DECKS, WAVE7_CARDS, cardId, type AnyCard } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
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
import { mergeRegistries } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  playerOf,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, driveStepwise, withForm } from "../../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import {
  BISHOP_OBLIGATION_NEMESIS,
  BISHOP_OBLIGATION_NEMESIS_SKIPPED,
  PORTAL_THROUGH_TIME_DRAFT,
} from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Bishop's obligation and nemesis set (45025 Fear the Future; 45026 Trevor Fitzroy, 45027 Portal Through Time, 45028
 * Bantam, 45029 Temporal Trickery), docs/phase7-wave8.md section 7.1, 3.52, 3.1. Real commands in a real game: his
 * Leadership precon (`bishop-leadership`) against Rhino (Core, standard, no modular set; stage 1 ATK 2, SCH 1, one boost
 * card per activation). Spider-Man (Justice precon) is the other seat. A boost card that must do nothing is Advance
 * 01186 (0 boost icons); a revealed card that must do nothing is "I'm Tough!" 01105 (0 boost icons). Hands are staged
 * by relabeling cards (test-only surgery on cards whose own text is not under test). Bishop's own cards are not
 * installed in these tests: no Energy Absorption interferes with the hands.
 */
const FEAR = "45025";
const FITZROY = "45026";
const PORTAL = "45027";
const BANTAM = "45028";
const TRICKERY = "45029";
const NEMESIS_CODES = [FITZROY, PORTAL, BANTAM, TRICKERY, TRICKERY];
const BOOST_FILLER = "01186";
const DEAL_FILLER = "01105";
const ADVANCE = "01186";
/** Resource cards: Energy (2 icons), Stored Energy (energy and physical: 2), The Power of Leadership (1 wild). */
const ENERGY = "45022";
const STORED = "45010";
const POWER = "45019";
const GENIUS = "45023";
/** Cards that are not resource cards. */
const EVENT_A = "45007";
const EVENT_B = "45008";
const MALCOLM = "45002";

const REFS = [
  "45025.obligation",
  "45026.trevor-fitzroy-forced-response",
  "45027.portal-through-time-forced-interrupt",
  "45028.when-revealed",
  "45029.when-revealed",
];
const PORTAL_REF = "45027.portal-through-time-forced-interrupt";

const DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE7_ABILITIES, BISHOP_OBLIGATION_NEMESIS),
};
/** The same with the Portal's draft registered (the draft is not in the shipped registry). */
const DRAFT_DEPS: EngineDeps = {
  abilities: mergeRegistries(DEPS.abilities, { [PORTAL_REF]: PORTAL_THROUGH_TIME_DRAFT }),
};
const POOL: readonly AnyCard[] = [...WAVE7_CARDS, ...AOA_CARDS];
const DATA = (code: string) => AOA_CARDS.find((c) => (c.id as string) === code)! as any;

const PRECON = AOA_STARTER_DECKS.find((d) => d.id === "bishop-leadership")!;
const PRECON_DECK = PRECON.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId));
type Seat = { readonly kind: "bishop" | "core" };
const BISHOP: Seat = { kind: "bishop" };
const SM: Seat = { kind: "core" };
const ONE: readonly Seat[] = [BISHOP];
/** Bishop is seat 1, Spider-Man (Justice precon) seat 2. */
const TWO: readonly Seat[] = [BISHOP, SM];
/** Spider-Man is seat 1 and Bishop seat 2: the Lucas Bishop player is not the first player. */
const TWO_BISHOP_SECOND: readonly Seat[] = [SM, BISHOP];

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const setAsideCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).setAside.map((id) => codeOf(s, id));
const encounterDeckCodes = (s: GameState): string[] =>
  Object.values(s.encounterDecks).flatMap((d) => d.deck.map((i) => codeOf(s, i)));
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const count = (codes: readonly string[], code: string): number => codes.filter((c) => c === code).length;
const accepted = (s: GameState, c: Command): boolean => applyCommand(s, c, DEPS).ok;

function setupGame(seats: readonly Seat[], seed = 1): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  });
  const players = seats.map((seat) =>
    seat.kind === "bishop"
      ? { identityCardId: PRECON.identityCardId, aspects: PRECON.aspects, deck: PRECON_DECK }
      : coreScenario("rhino", { players: [{ starterDeckId: "core-spider-man-justice" }], seed, modularSetIds: [] })
          .players[0]!,
  );
  const created = createGame({ ...config, players, requireLegalDecks: false }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  // Headroom on the main scheme (a negative count, surgery): the tests' villain phases scheme and accelerate.
  return patchInstance(settled, settled.mainScheme.instanceId, { threat: -30 });
}
/** Every seat in hero form. */
const heroGame = (seats: readonly Seat[] = ONE): GameState =>
  seats.reduce<GameState>((s, _seat, i) => withForm(s, { heroForm: 0 }, i === 0 ? P1 : P2), setupGame(seats));
/** Every seat in alter-ego form (as the game starts). */
const alterEgoGame = (seats: readonly Seat[] = ONE): GameState => setupGame(seats);
const bishopSeat = (seats: readonly Seat[]): PlayerId => (seats[0]!.kind === "bishop" ? P1 : P2);

const relabel = (s: GameState, id: InstanceId, code: string): GameState =>
  patchInstance(s, id, { cardId: cardId(code) });
const activeSeat = (s: GameState): PlayerId | undefined => (s.step as { activePlayerId?: PlayerId }).activePlayerId;
/** Every seat ends its turn, the active seat first. */
const endPhase = (s: GameState): Command[] => {
  const first = activeSeat(s) ?? P1;
  return [first, ...s.players.map((p) => p.playerId).filter((p) => p !== first)].map((p) => endTurn(p));
};
const runWithDeps = (deps: EngineDeps, s: GameState, pick: Picker, ...commands: readonly Command[]) =>
  driveEventsPicking(deps, s, pick, ...commands);

type Seen = { kind: string; player: string; options: string[]; labels: string[] };
/**
 * Picks by prompt: each `pick` entry is an option id, an id suffix or a label fragment (the first prompt it matches
 * answers it); every other prompt is answered like `firstLegal`. Every prompt is logged in `seen`.
 */
const picker =
  (opts: { pick?: readonly string[]; seen?: Seen[] } = {}): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const ids = choice.options.map((o) => o.optionId as string);
    const labels = choice.options.map((o) => o.label);
    opts.seen?.push({ kind: choice.prompt.kind, player: choice.playerId as string, options: ids, labels });
    for (const want of opts.pick ?? []) {
      const at = choice.options.findIndex(
        (o) => o.optionId === want || o.optionId.endsWith(want) || o.label.includes(want),
      );
      if (at >= 0) return [ids[at]!];
    }
    return firstLegal(s);
  };
const asked = (seen: readonly Seen[], kind: string) => seen.filter((p) => p.kind === kind);

/** Where an instance is, in one word (or `zone:player`). */
function whereIs(s: GameState, id: InstanceId): string {
  for (const p of s.players) {
    for (const zone of ["setAside", "playArea", "dealtEncounter", "hand", "deck", "discard"] as const) {
      if (p[zone].includes(id)) return `${zone}:${p.playerId}`;
    }
  }
  for (const d of Object.values(s.encounterDecks)) {
    if (d.deck.includes(id)) return "encounterDeck";
    if (d.discard.includes(id)) return "encounterDiscard";
  }
  if (s.villainArea.includes(id)) return "villainArea";
  if (s.victoryDisplay.includes(id)) return "victoryDisplay";
  if (s.removedFromGame.includes(id)) return "removedFromGame";
  return inst(s, id).attachedTo ? `attachedTo:${inst(s, id).attachedTo}` : "elsewhere";
}

/**
 * Test-only surgery: the card `id` taken out of wherever it is and put in play: a minion engaged with `to`, or (`where:
 * "villain"`) a side scheme in the villain's area with `threat` on it.
 */
function put(s: GameState, id: InstanceId, where: "play" | "villain", o: { to?: PlayerId; threat?: number } = {}) {
  const to = o.to ?? P1;
  const without = <T>(list: readonly T[]) => list.filter((i) => (i as unknown) !== id);
  const stripped: GameState = {
    ...s,
    players: s.players.map((p) => ({
      ...p,
      setAside: without(p.setAside),
      playArea: without(p.playArea),
      dealtEncounter: without(p.dealtEncounter),
    })),
    encounterDecks: Object.fromEntries(
      Object.entries(s.encounterDecks).map(([k, d]) => [
        k,
        { ...d, deck: without(d.deck), discard: without(d.discard) },
      ]),
    ),
    villainArea: without(s.villainArea),
  };
  if (where === "villain") {
    return patchInstance({ ...stripped, villainArea: [...stripped.villainArea, id] }, id, {
      faceup: true,
      threat: o.threat ?? 0,
      engagedWith: null,
    });
  }
  return patchInstance(
    {
      ...stripped,
      players: stripped.players.map((p) => (p.playerId === to ? { ...p, playArea: [...p.playArea, id] } : p)),
    },
    id,
    { faceup: true, controllerId: null, engagedWith: to, exhausted: false, damage: 0 },
  );
}

/** The instance of the card `code`: a set-aside copy of any seat, else any other copy. */
const findCard = (s: GameState, code: string): InstanceId => {
  for (const p of s.players) {
    const aside = p.setAside.find((i) => codeOf(s, i) === code);
    if (aside) return aside;
  }
  return instancesOf(s, code)[0]!;
};
/** Every set-aside copy of `code` of a seat. */
const asideCopies = (s: GameState, code: string, p: PlayerId = P1): InstanceId[] =>
  playerOf(s, p).setAside.filter((i) => codeOf(s, i) === code);

type Slot = InstanceId | "boost" | "deal" | "advance";
const FILLERS = { boost: BOOST_FILLER, deal: DEAL_FILLER, advance: ADVANCE } as const;
/**
 * The first cards of the active encounter deck, in order: `spec` is an instance (put on top, wherever it was) or a
 * filler (the next spare card of the deck, relabeled): "boost" Advance as a boost card (0 icons), "deal" "I'm Tough!"
 * (gives Rhino a tough status card the first time and gains surge after that), "advance" Advance as a revealed card
 * (Rhino schemes: it never gains surge, so it ends a surge chain). Everything else is untouched.
 */
function stageDeck(s: GameState, spec: readonly Slot[]): GameState {
  const deckId = activeEncounterDeckId(s);
  const named = spec.filter((x) => x !== "boost" && x !== "deal" && x !== "advance") as InstanceId[];
  const stripped: GameState = {
    ...s,
    players: s.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => !named.includes(i)) })),
    encounterDecks: Object.fromEntries(
      Object.entries(s.encounterDecks).map(([k, d]) => [
        k,
        { ...d, deck: d.deck.filter((i) => !named.includes(i)), discard: d.discard.filter((i) => !named.includes(i)) },
      ]),
    ),
  };
  const pile = stripped.encounterDecks[deckId]!;
  let spare = 0;
  let next = stripped;
  const order = spec.map((x) => {
    if (x !== "boost" && x !== "deal" && x !== "advance") return x;
    const id = pile.deck[spare++]!;
    next = relabel(next, id, FILLERS[x as keyof typeof FILLERS]);
    return id;
  });
  const rest = pile.deck.slice(spare).filter((i) => !named.includes(i));
  return { ...next, encounterDecks: { ...next.encounterDecks, [deckId]: { ...pile, deck: [...order, ...rest] } } };
}
const times = <T>(n: number, x: T): T[] => Array.from({ length: n }, () => x);

type Villain = { state: GameState; events: readonly GameEvent[]; id: InstanceId };
/**
 * The card `id` revealed to `to` in the villain phase (the first card dealt to `to`, one boost draw per player ahead
 * of it): every seat ends its turn. Nothing else a villain phase does is hidden: Rhino acts and a hero is attacked.
 */
function reveal(
  s: GameState,
  id: InstanceId,
  opts: {
    to?: PlayerId | undefined;
    pick?: Picker | undefined;
    deps?: EngineDeps | undefined;
    midway?: ((s: GameState) => GameState) | undefined;
  } = {},
): Villain {
  const to = opts.to ?? P1;
  const others = s.players.length - 1 - (to === P1 ? 0 : 1);
  const spec: Slot[] = [
    ...times(s.players.length, "boost" as const),
    ...(to === P1 ? [] : ["deal" as const]),
    id,
    ...times(Math.max(0, others), "advance" as const),
    ...times(6, "boost" as const),
  ];
  const staged = stageDeck(s, spec);
  return { ...runVillainPhase(opts.deps ?? DEPS, staged, opts.pick ?? firstLegal, opts.midway), id };
}
/**
 * Every seat ends its turn and the villain phase runs. `midway`: test surgery at the defender prompt of Rhino's attack
 * on a hero (the first prompt of the villain phase), for what the player phase's own end would undo: heroes draw to
 * their hand size when they end their turn, so no hand can be left short or empty.
 */
function runVillainPhase(deps: EngineDeps, staged: GameState, pick: Picker, midway?: (s: GameState) => GameState) {
  if (!midway) return runWithDeps(deps, staged, pick, ...endPhase(staged));
  const ends = endPhase(staged);
  const before = runWithDeps(deps, staged, pick, ...ends.slice(0, -1));
  const last = applyOk(before.state, ends[ends.length - 1]!, deps);
  let done = false;
  const after = driveStepwise(deps, last.state, pick, (st) => {
    if (done || st.pendingChoice?.prompt.kind !== "declareDefender") return st;
    done = true;
    return midway(st);
  });
  return { state: after.state, events: [...before.events, ...last.events, ...after.events] };
}

/**
 * `p`'s hand replaced by cards relabeled as `codes` (the old hand goes to the bottom of the deck), so a hand never
 * exceeds the hand size at the end of the player phase.
 */
function handOf(s: GameState, p: PlayerId, codes: readonly string[]): { state: GameState; ids: InstanceId[] } {
  const owner = playerOf(s, p);
  const deck = [...owner.deck, ...owner.hand];
  const ids = deck.slice(0, codes.length);
  const moved: GameState = {
    ...s,
    players: s.players.map((pl) =>
      pl.playerId === p ? { ...pl, deck: deck.filter((i) => !ids.includes(i)), hand: ids } : pl,
    ),
  };
  return { state: ids.reduce((acc, id, n) => relabel(acc, id, codes[n]!), moved), ids };
}
/** Fillers that are neither resource cards nor Temporal: padding to a full hand so no draw changes the hand. */
const padded = (cards: readonly string[], size: number): string[] => [...cards, ...times(size - cards.length, EVENT_A)];
const revealsOf = (events: readonly GameEvent[], id: InstanceId) =>
  ofType(events, "encounterCardRevealed").filter((e) => e.instanceId === id);

describe("registry", () => {
  it("registers every ref of the five cards but the Portal's, which is skipped with a reason", () => {
    const refs = AOA_CARDS.filter((c) => (c.id as string) >= FEAR && (c.id as string) <= TRICKERY).flatMap(
      abilityRefIds,
    );
    expect([...refs].sort()).toEqual([...REFS].sort());
    expect(Object.keys(BISHOP_OBLIGATION_NEMESIS).sort()).toEqual(REFS.filter((r) => r !== PORTAL_REF).sort());
    expect(Object.keys(BISHOP_OBLIGATION_NEMESIS_SKIPPED)).toEqual([PORTAL_REF]);
    expect(BISHOP_OBLIGATION_NEMESIS_SKIPPED[PORTAL_REF]).toMatch(/surge/);
  });
  it.each(REFS.filter((r) => r !== PORTAL_REF))("%s validates", (id) => {
    expect(validateDefinition(BISHOP_OBLIGATION_NEMESIS[id as never]!)).toEqual([]);
  });
  it("the Portal's draft validates", () => {
    expect(validateDefinition(PORTAL_THROUGH_TIME_DRAFT)).toEqual([]);
  });
  it("the trigger of each ref: the obligation and the When Revealed abilities, Fitzroy's Forced Response", () => {
    const t = (id: string) => BISHOP_OBLIGATION_NEMESIS[id as never]!.trigger;
    expect(t("45025.obligation")).toMatchObject({ kind: "whenRevealed" });
    expect(t("45026.trevor-fitzroy-forced-response")).toMatchObject({ kind: "response", forced: true });
    expect(t("45028.when-revealed")).toMatchObject({ kind: "whenRevealed" });
    expect(t("45029.when-revealed")).toMatchObject({ kind: "whenRevealed" });
  });
});

describe("the printed cards (data against the print)", () => {
  it("Fear the Future: an obligation with 2 boost icons", () => {
    expect(DATA(FEAR)).toMatchObject({ type: "obligation", name: "Fear the Future", boostIcons: 2, unique: false });
    expect(DATA("45001a").obligationCardId).toBe(FEAR);
  });
  it("Trevor Fitzroy: unique ELITE TEMPORAL minion, SCH 2, ATK 3, 5 hit points, quickstrike, 3 boost icons", () => {
    expect(DATA(FITZROY)).toMatchObject({ type: "minion", unique: true, sch: 2, atk: 3, hp: 5, boostIcons: 3 });
    expect(DATA(FITZROY).keywords).toEqual([{ name: "quickstrike" }]);
    expect(DATA(FITZROY).traits).toEqual(["ELITE", "TEMPORAL"]);
    expect(DATA(FITZROY).nemesisMinion).toBe(true);
  });
  it("Portal Through Time: a side scheme with a flat 4 threat, an acceleration icon and 3 boost icons", () => {
    expect(DATA(PORTAL)).toMatchObject({
      type: "side_scheme",
      startingThreat: { base: 4, perPlayer: 0 },
      icons: ["acceleration"],
      boostIcons: 3,
    });
  });
  it("Bantam: unique TEMPORAL minion, SCH 2, ATK 2, 3 hit points, 2 boost icons; Temporal Trickery: 2 copies, 2 boost icons", () => {
    expect(DATA(BANTAM)).toMatchObject({ type: "minion", unique: true, sch: 2, atk: 2, hp: 3, boostIcons: 2 });
    expect(DATA(BANTAM).traits).toEqual(["TEMPORAL"]);
    expect(DATA(TRICKERY)).toMatchObject({ type: "treachery", quantityInSet: 2, boostIcons: 2 });
    expect(DATA(TRICKERY).traits).toEqual(["TEMPORAL"]);
  });
});

describe("setup: the obligation sits in the encounter deck and the nemesis set is set aside", () => {
  it("Bishop's set-aside area holds the five nemesis cards; the encounter deck holds Fear the Future once", () => {
    const s = setupGame(ONE);
    const aside = setAsideCodes(s);
    for (const code of [FITZROY, PORTAL, BANTAM]) expect(count(aside, code)).toBe(1);
    expect(count(aside, TRICKERY)).toBe(2);
    expect(aside).toHaveLength(5);
    expect(count(encounterDeckCodes(s), FEAR)).toBe(1);
    expect(encounterDeckCodes(s).some((c) => NEMESIS_CODES.includes(c))).toBe(false);
  });
});

describe("Fear the Future (45025)", () => {
  const FLIP = "Flip to alter-ego form";
  const STAY = "Stay in hero form";
  const EXHAUST = "Exhaust Lucas Bishop";
  const DISCARD = "Discard each resource card";
  const formOf = (s: GameState, p: PlayerId) => playerOf(s, p).identity.form;
  /** The scenario: Bishop (at his seat, in `form`) with `hand`, Fear the Future revealed to `to`. */
  function revealed(
    seats: readonly Seat[],
    form: "hero" | "alterEgo",
    hand: readonly string[],
    pick: Picker,
    o: { to?: PlayerId } = {},
  ) {
    const bishop = bishopSeat(seats);
    const base = form === "hero" ? heroGame(seats) : alterEgoGame(seats);
    const staged = handOf(base, bishop, hand);
    const id = findCard(staged.state, FEAR);
    return { ...reveal(staged.state, id, { to: o.to, pick }), bishop, hand: staged.ids };
  }
  const surged = (events: readonly GameEvent[], id: InstanceId) =>
    ofType(events, "surgeTriggered").filter((e) => e.instanceId === id);
  /** Alter-ego hand size 6: Energy, an event, Stored Energy, an event, The Power of Leadership, Genius. */
  const HAND = [ENERGY, EVENT_A, STORED, EVENT_B, POWER, GENIUS];

  it("alter-ego form, the discard option: each resource card leaves his hand, the events stay, the obligation is discarded and nothing surges", () => {
    const seen: Seen[] = [];
    const r = revealed(ONE, "alterEgo", HAND, picker({ pick: [DISCARD], seen }));
    const chooses = asked(seen, "chooseOption");
    expect(chooses).toHaveLength(1);
    expect(chooses[0]!.labels[0]).toContain(EXHAUST);
    expect(chooses[0]!.labels[1]).toContain(DISCARD);
    for (const i of [0, 2, 4, 5]) expect(whereIs(r.state, r.hand[i]!)).toBe("discard:p1");
    for (const i of [1, 3]) expect(whereIs(r.state, r.hand[i]!)).toBe("hand:p1");
    expect(whereIs(r.state, r.id)).toBe("encounterDiscard");
    expect(surged(r.events, r.id)).toEqual([]);
  });
  it("alter-ego form, the discard option with no resource card in hand: nothing is discarded and the obligation gains surge", () => {
    const r = revealed(ONE, "alterEgo", padded([EVENT_B], 6), picker({ pick: [DISCARD] }));
    for (const id of r.hand) expect(whereIs(r.state, id)).toBe("hand:p1");
    expect(whereIs(r.state, r.id)).toBe("encounterDiscard");
    expect(surged(r.events, r.id)).toHaveLength(1);
  });
  it("exhausting Lucas Bishop removes the obligation from the game and keeps the hand (the resource cards stay)", () => {
    const r = revealed(ONE, "alterEgo", HAND, picker({ pick: [EXHAUST] }));
    expect(whereIs(r.state, r.id)).toBe("removedFromGame");
    expect(ofType(r.events, "cardExhausted").map((e) => e.instanceId)).toContain(identityOf(r.state));
    for (const id of r.hand) expect(whereIs(r.state, id)).toBe("hand:p1");
    expect(surged(r.events, r.id)).toEqual([]);
  });
  it("hero form: the player may flip first (a card effect), then chooses; flip and discard takes the resource cards", () => {
    const seen: Seen[] = [];
    const r = revealed(ONE, "hero", padded([ENERGY, EVENT_B, STORED], 5), picker({ pick: [FLIP, DISCARD], seen }));
    expect(asked(seen, "chooseOption")[0]!.labels).toEqual([FLIP, STAY]);
    expect(formOf(r.state, P1)).toBe("alterEgo");
    expect(whereIs(r.state, r.hand[0]!)).toBe("discard:p1");
    expect(whereIs(r.state, r.hand[2]!)).toBe("discard:p1");
    expect(whereIs(r.state, r.hand[1]!)).toBe("hand:p1");
    expect(whereIs(r.state, r.id)).toBe("encounterDiscard");
  });
  it("hero form, staying: the exhaust option is not offered (no alter-ego to exhaust), so the discard option is taken without a second prompt", () => {
    const seen: Seen[] = [];
    const r = revealed(ONE, "hero", padded([ENERGY, POWER], 5), picker({ pick: [STAY], seen }));
    expect(asked(seen, "chooseOption").map((c) => c.labels)).toEqual([[FLIP, STAY]]);
    expect(formOf(r.state, P1)).toBe("hero");
    expect(whereIs(r.state, r.hand[0]!)).toBe("discard:p1");
    expect(whereIs(r.state, r.hand[1]!)).toBe("discard:p1");
    expect(whereIs(r.state, r.id)).toBe("encounterDiscard");
  });
  it("two players: Bishop second, Spider-Man (seat 1) reveals it: it is Bishop's choice and Bishop's hand; Spider-Man's hand is untouched", () => {
    const seen: Seen[] = [];
    const base = alterEgoGame(TWO_BISHOP_SECOND);
    const staged = handOf(base, P2, HAND);
    const spiderHand = [...playerOf(staged.state, P1).hand];
    const id = findCard(staged.state, FEAR);
    const r = reveal(staged.state, id, { to: P1, pick: picker({ pick: [DISCARD], seen }) });
    expect(asked(seen, "chooseOption").every((c) => c.player === "p2")).toBe(true);
    expect(asked(seen, "chooseOption").length).toBeGreaterThan(0);
    for (const i of [0, 2, 4, 5]) expect(whereIs(r.state, staged.ids[i]!)).toBe("discard:p2");
    for (const hid of spiderHand) expect(playerOf(r.state, P1).discard).not.toContain(hid);
    expect(whereIs(r.state, id)).toBe("encounterDiscard");
  });
});

describe("Bantam (45028)", () => {
  it("Portal Through Time not in play: found among the set-aside nemesis cards and revealed to the revealing player; Bantam engages", () => {
    const s = alterEgoGame(ONE);
    const bantam = findCard(s, BANTAM);
    const portal = findCard(s, PORTAL);
    expect(whereIs(s, portal)).toBe("setAside:p1");
    const r = reveal(s, bantam);
    expect(revealsOf(r.events, bantam)).toHaveLength(1);
    expect(revealsOf(r.events, portal)).toHaveLength(1);
    expect(r.state.villainArea).toContain(portal);
    expect(inst(r.state, portal).threat).toBe(4);
    expect(inst(r.state, bantam).engagedWith).toBe(P1);
  });
  it("Portal Through Time in play: 2 threat is placed on it, it is not revealed again", () => {
    const base = alterEgoGame(ONE);
    const portal = findCard(base, PORTAL);
    const s = put(base, portal, "villain", { threat: 3 });
    const bantam = findCard(s, BANTAM);
    const r = reveal(s, bantam);
    expect(inst(r.state, portal).threat).toBe(5);
    expect(revealsOf(r.events, portal)).toEqual([]);
    expect(ofType(r.events, "threatPlaced").filter((e) => e.schemeInstanceId === portal)).toHaveLength(1);
  });
  it("two players: the second player's Bantam reveals the Portal to that player", () => {
    const base = alterEgoGame(TWO);
    const bantam = findCard(base, BANTAM);
    const portal = findCard(base, PORTAL);
    const r = reveal(base, bantam, { to: P2 });
    const revealed = revealsOf(r.events, portal);
    expect(revealed).toHaveLength(1);
    expect(revealed[0]!.playerId).toBe(P2);
  });
});

describe("Temporal Trickery (45029)", () => {
  const MAIN = (s: GameState) => s.mainScheme.instanceId;
  /** Threat the Trickery placed on a scheme. */
  const placed = (events: readonly GameEvent[], trickery: InstanceId, scheme: InstanceId): number =>
    ofType(events, "threatPlaced")
      .filter((e) => e.sourceInstanceId === trickery && e.schemeInstanceId === scheme)
      .reduce((n, e) => n + e.amount, 0);
  function revealed(hand: readonly string[], pick: Picker, o: { sideThreat?: number } = {}) {
    const base = alterEgoGame(ONE);
    const staged = handOf(base, P1, hand);
    const portal = findCard(staged.state, PORTAL);
    const withSide = put(staged.state, portal, "villain", { threat: o.sideThreat ?? 1 });
    const id = asideCopies(withSide, TRICKERY)[0]!;
    return { ...reveal(withSide, id, { pick }), portal, hand: staged.ids };
  }

  it("Energy (2 icons), Stored Energy (2) and The Power of Leadership (1): the player picks a card with the most icons, and each scheme takes that many", () => {
    const seen: Seen[] = [];
    const hand = padded([ENERGY, STORED, POWER], 6);
    const r = revealed(hand, picker({ pick: [], seen }));
    const prompts = asked(seen, "chooseCards").concat(asked(seen, "chooseTarget"));
    expect(prompts.length).toBeGreaterThan(0);
    // The first tied candidate (Energy or Stored Energy) is discarded; the one with 1 icon is kept.
    const discardedIds = r.hand.filter((id) => whereIs(r.state, id).startsWith("discard"));
    expect(discardedIds).toHaveLength(1);
    expect([r.hand[0], r.hand[1]]).toContain(discardedIds[0]);
    expect(whereIs(r.state, r.hand[2]!)).toBe("hand:p1");
    const trickery = asideCopies(r.state, TRICKERY)[0] ?? findCard(r.state, TRICKERY);
    void trickery;
    const placements = ofType(r.events, "threatPlaced").filter((e) => e.amount === 2);
    expect(placements.map((e) => e.schemeInstanceId)).toEqual(expect.arrayContaining([MAIN(r.state), r.portal]));
  });
  it("the choice among tied cards is the player's: picking Stored Energy discards Stored Energy, not Energy", () => {
    const hand = padded([ENERGY, STORED, POWER], 6);
    const base = alterEgoGame(ONE);
    const staged = handOf(base, P1, hand);
    const storedId = staged.ids[1]!;
    const r = revealed(hand, picker({ pick: [] }));
    void r;
    const portal = findCard(staged.state, PORTAL);
    const withSide = put(staged.state, portal, "villain", { threat: 1 });
    const id = asideCopies(withSide, TRICKERY)[0]!;
    const v = reveal(withSide, id, {
      pick: (st) =>
        st.pendingChoice!.prompt.kind === "chooseCards" ? picker({ pick: [storedId as string] })(st) : firstLegal(st),
    });
    expect(whereIs(v.state, storedId)).toBe("discard:p1");
    expect(whereIs(v.state, staged.ids[0]!)).toBe("hand:p1");
    expect(whereIs(v.state, staged.ids[2]!)).toBe("hand:p1");
  });
  it("a single card with the most icons is discarded without a choice between cards: Energy beside Power of Leadership and events", () => {
    const hand = padded([POWER, ENERGY], 6);
    const base = alterEgoGame(ONE);
    const staged = handOf(base, P1, hand);
    const id = asideCopies(staged.state, TRICKERY)[0]!;
    const v = reveal(staged.state, id);
    expect(whereIs(v.state, staged.ids[1]!)).toBe("discard:p1");
    expect(whereIs(v.state, staged.ids[0]!)).toBe("hand:p1");
    expect(placed(v.events, id, MAIN(v.state))).toBe(2);
  });
  it("an empty hand (emptied at Rhino's defender prompt, hero form): nothing is discarded and no threat is placed", () => {
    const base = heroGame(ONE);
    const id = asideCopies(base, TRICKERY)[0]!;
    const emptied = (st: GameState): GameState => ({
      ...st,
      players: st.players.map((p) => ({ ...p, hand: [], deck: [...p.deck, ...p.hand] })),
    });
    const v = reveal(base, id, { midway: emptied });
    const at = v.events.findIndex((e) => e.type === "encounterCardRevealed" && e.instanceId === id);
    expect(at).toBeGreaterThan(-1);
    expect(v.events.slice(at).filter((e) => e.type === "cardDiscardedFromHand")).toEqual([]);
    expect(ofType(v.events, "threatPlaced").filter((e) => e.sourceInstanceId === id)).toEqual([]);
    expect(whereIs(v.state, id)).toBe("encounterDiscard");
  });
  it("any card counts by its printed resource icons, an event's too: with only events (1 icon each) one is discarded and 1 threat goes on each scheme", () => {
    const base = alterEgoGame(ONE);
    const staged = handOf(base, P1, padded([], 6));
    const id = asideCopies(staged.state, TRICKERY)[0]!;
    const v = reveal(staged.state, id);
    expect(staged.ids.filter((i) => whereIs(v.state, i).startsWith("discard"))).toHaveLength(1);
    expect(placed(v.events, id, MAIN(v.state))).toBe(1);
  });
});

describe("Trevor Fitzroy (45026)", () => {
  /** An ally of `who` (Malcolm's card, relabeled from the top of their deck) put in play with `damage` on it. */
  function withAlly(
    s: GameState,
    who: PlayerId,
    o: { damage?: number; tough?: boolean | undefined },
  ): { state: GameState; ally: InstanceId } {
    const ally = playerOf(s, who).deck[0]!;
    const state = patchInstance(
      {
        ...s,
        players: s.players.map((p) =>
          p.playerId === who ? { ...p, deck: p.deck.filter((i) => i !== ally), playArea: [...p.playArea, ally] } : p,
        ),
      },
      ally,
      {
        cardId: cardId(MALCOLM),
        faceup: true,
        controllerId: who,
        exhausted: false,
        damage: o.damage ?? 0,
        ...(o.tough ? { statuses: { stunned: 0, confused: 0, tough: 1 } } : {}),
      },
    );
    return { state, ally };
  }
  /**
   * Hero Bishop (seat `seats[bishop]`) with Fitzroy engaged to him and an ally of his in play. Rhino's attack on the first
   * player is left undefended; Fitzroy's is defended by the ally (or, with `defends: false`, by nobody).
   */
  function fitzroyAttacks(o: {
    portal: "play" | "aside";
    seats?: readonly Seat[];
    defends?: boolean;
    tough?: boolean;
    deps?: EngineDeps;
  }) {
    const seats = o.seats ?? ONE;
    const who = bishopSeat(seats);
    const base = heroGame(seats);
    const fitzroy = findCard(base, FITZROY);
    const portal = findCard(base, PORTAL);
    const { state: withAllyState, ally } = withAlly(put(base, fitzroy, "play", { to: who }), who, { tough: o.tough });
    const s = o.portal === "play" ? put(withAllyState, portal, "villain", { threat: 3 }) : withAllyState;
    const staged = stageDeck(s, [
      ...times(seats.length + 2, "boost" as const),
      ...times(seats.length, "deal" as const),
      ...times(6, "boost" as const),
    ]);
    let prompts = 0;
    const pick: Picker = (st) => {
      const choice = st.pendingChoice!;
      if (choice.prompt.kind !== "declareDefender") return firstLegal(st);
      // Rhino attacks every player first; Fitzroy's attack is the Bishop player's second defender prompt.
      if (choice.playerId === who) prompts += 1;
      const mine = choice.playerId === who && prompts === 2;
      const at = choice.options.find((opt) => (opt.optionId as string) === (ally as string));
      if (mine && o.defends !== false && at) return [at.optionId as string];
      return ["decline"];
    };
    const r = runWithDeps(o.deps ?? DEPS, staged, pick, ...endPhase(staged));
    return { ...r, fitzroy, portal, ally, who };
  }
  const fitzroyAttacksOf = (events: readonly GameEvent[], fitzroy: InstanceId) =>
    ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === fitzroy);

  it("his attack defeats Bishop's ally with Portal Through Time in play: 2 threat is placed on the Portal and it is not revealed", () => {
    const r = fitzroyAttacks({ portal: "play" });
    expect(fitzroyAttacksOf(r.events, r.fitzroy)).toHaveLength(1);
    expect(whereIs(r.state, r.ally)).toBe("discard:p1");
    expect(inst(r.state, r.portal).threat).toBe(5);
    expect(revealsOf(r.events, r.portal)).toEqual([]);
    expect(ofType(r.events, "threatPlaced").filter((e) => e.schemeInstanceId === r.portal)).toHaveLength(1);
  });
  it("his attack defeats the ally with the Portal not in play: it is found in the set-aside nemesis cards and revealed to the engaged player", () => {
    const base = heroGame(ONE);
    expect(whereIs(base, findCard(base, PORTAL))).toBe("setAside:p1");
    const r = fitzroyAttacks({ portal: "aside" });
    expect(whereIs(r.state, r.ally)).toBe("discard:p1");
    expect(revealsOf(r.events, r.portal)).toHaveLength(1);
    expect(r.state.villainArea).toContain(r.portal);
    expect(inst(r.state, r.portal).threat).toBe(4);
  });
  it("the ally takes the hit and survives (a tough status card): the Forced Response does not trigger", () => {
    const r = fitzroyAttacks({ portal: "play", tough: true });
    expect(fitzroyAttacksOf(r.events, r.fitzroy)).toHaveLength(1);
    expect(whereIs(r.state, r.ally)).toBe("playArea:p1");
    expect(inst(r.state, r.portal).threat).toBe(3);
  });
  it("his attack is not defended: the hero takes the damage and the Forced Response does not trigger", () => {
    const r = fitzroyAttacks({ portal: "aside", defends: false });
    expect(fitzroyAttacksOf(r.events, r.fitzroy)).toHaveLength(1);
    expect(whereIs(r.state, r.ally)).toBe("playArea:p1");
    expect(revealsOf(r.events, r.portal)).toEqual([]);
    expect(whereIs(r.state, r.portal)).toBe("setAside:p1");
  });
  it("two players, Bishop second: Fitzroy engaged with Bishop's player defeats his ally and that player reveals the Portal", () => {
    const r = fitzroyAttacks({ portal: "aside", seats: TWO_BISHOP_SECOND });
    expect(whereIs(r.state, r.ally)).toBe("discard:p2");
    const revealed = revealsOf(r.events, r.portal);
    expect(revealed).toHaveLength(1);
    expect(revealed[0]!.playerId).toBe(P2);
  });
});

describe("Portal Through Time (45027): skipped, see BISHOP_OBLIGATION_NEMESIS_SKIPPED", () => {
  const granted = (events: readonly GameEvent[], id: InstanceId) =>
    ofType(events, "surgeGranted").filter((e) => e.instanceId === id);
  /** Portal in play (surgery), then Temporal Trickery revealed to Bishop's player alone: the card the Portal should surge. */
  function trickeryWithPortalInPlay(deps: EngineDeps) {
    const base = alterEgoGame(ONE);
    const portal = findCard(base, PORTAL);
    const s = put(base, portal, "villain", { threat: 4 });
    const trickery = asideCopies(s, TRICKERY)[0]!;
    return { ...reveal(s, trickery, { deps }), portal };
  }
  /**
   * Two players: Bishop's player reveals Bantam, whose When Revealed finds and reveals the Portal; the other player then
   * reveals Temporal Trickery in the same phase. The Portal is in play and unused, so the Trickery should gain surge.
   */
  function bantamThenTrickery(deps: EngineDeps) {
    const base = alterEgoGame(TWO);
    const bantam = findCard(base, BANTAM);
    const trickery = asideCopies(base, TRICKERY)[0]!;
    const staged = stageDeck(base, [...times(2, "boost" as const), bantam, trickery, ...times(8, "boost" as const)]);
    const r = runWithDeps(deps, staged, firstLegal, ...endPhase(staged));
    return { ...r, bantam, trickery, portal: findCard(base, PORTAL) };
  }

  it("is not registered: the shipped registry has no Portal ability", () => {
    expect(BISHOP_OBLIGATION_NEMESIS[PORTAL_REF as never]).toBeUndefined();
  });
  it("shipped today: a Temporal card revealed with the Portal in play gains no surge", () => {
    const r = trickeryWithPortalInPlay(DEPS);
    expect(granted(r.events, r.id)).toEqual([]);
  });
  it("the draft (first TEMPORAL reveal each phase gains surge) works when no TEMPORAL card was revealed earlier that phase", () => {
    const r = trickeryWithPortalInPlay(DRAFT_DEPS);
    expect(granted(r.events, r.id)).toHaveLength(1);
  });
  it("companion: the draft under-grants after Bantam, which counts as the phase's first TEMPORAL reveal (today's behavior)", () => {
    const r = bantamThenTrickery(DRAFT_DEPS);
    expect(revealsOf(r.events, r.portal)).toHaveLength(1);
    expect(revealsOf(r.events, r.trickery)).toHaveLength(1);
    expect(granted(r.events, r.trickery)).toEqual([]);
  });
  it.fails("Bantam reveals the Portal, then another TEMPORAL card revealed in the same phase gains surge (the draft cannot)", () => {
    const r = bantamThenTrickery(DRAFT_DEPS);
    expect(granted(r.events, r.trickery)).toHaveLength(1);
  });
  it("accepts commands: the harness still applies (sanity)", () => {
    expect(accepted(alterEgoGame(ONE), endTurn(P1))).toBe(true);
  });
});
