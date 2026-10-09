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
  inst,
  instancesOf,
  patchInstance,
  playerOf,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, driveStepwise, withForm } from "../../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { MAGIK_OBLIGATION_NEMESIS, MAGIK_OBLIGATION_NEMESIS_SKIPPED } from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Magik's obligation and nemesis set (45053 Darkchilde; 45054 Belasco, 45055 Ruler of Limbo, 45056 S'ym, 45057 Witchfire,
 * 45058 Battle for Limbo), docs/phase7-wave8.md section 7.1, 3.57, 3.60. Real commands in a real game: her Aggression
 * precon (`magik-aggression`) against Rhino (Core, standard, no modular set; stage 1 ATK 2, SCH 1, one boost card per
 * activation). Spider-Man (Justice precon) is the other seat. A boost card that must do nothing is Advance 01186 (0 boost
 * icons); a revealed card that must do nothing is "I'm Tough!" 01105. Hands and boards are staged by surgery on cards
 * whose own text is not under test.
 */
const DARKCHILDE = "45053";
const BELASCO = "45054";
const RULER = "45055";
const SYM = "45056";
const WITCHFIRE = "45057";
const BATTLE = "45058";
const LIMBO = "45032";
const NEMESIS_CODES = [BELASCO, RULER, SYM, WITCHFIRE, BATTLE];
const BOOST_FILLER = "01186";
const DEAL_FILLER = "01105";
const ADVANCE = "01186";
const EVENT_A = "45007";
const EVENT_B = "45008";
const MALCOLM = "45002";

const REFS = [
  "45053.obligation",
  "45054.belasco-forced-response",
  "45055.ruler-of-limbo-constant",
  "45055.when-revealed",
  "45055.when-defeated",
  "45056.when-revealed",
  "45057.witchfire-forced-response",
  "45058.when-revealed",
  "45058.boost",
];

const DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE7_ABILITIES, MAGIK_OBLIGATION_NEMESIS),
};
const POOL: readonly AnyCard[] = [...WAVE7_CARDS, ...AOA_CARDS];
const DATA = (code: string) => AOA_CARDS.find((c) => (c.id as string) === code)! as any;

const PRECON = AOA_STARTER_DECKS.find((d) => d.id === "magik-aggression")!;
const PRECON_DECK = PRECON.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId));
type Seat = { readonly kind: "magik" | "core" };
const MAGIK: Seat = { kind: "magik" };
const SM: Seat = { kind: "core" };
const ONE: readonly Seat[] = [MAGIK];
/** Magik is seat 1, Spider-Man (Justice precon) seat 2. */
const TWO: readonly Seat[] = [MAGIK, SM];
/** Spider-Man is seat 1 and Magik seat 2: the Lucas Magik player is not the first player. */
const TWO_MAGIK_SECOND: readonly Seat[] = [SM, MAGIK];

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const setAsideCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).setAside.map((id) => codeOf(s, id));
const encounterDeckCodes = (s: GameState): string[] =>
  Object.values(s.encounterDecks).flatMap((d) => d.deck.map((i) => codeOf(s, i)));
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const count = (codes: readonly string[], code: string): number => codes.filter((c) => c === code).length;

function setupGame(seats: readonly Seat[], seed = 1): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  });
  const players = seats.map((seat) =>
    seat.kind === "magik"
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

/** An ally of `who` (Malcolm's card, relabeled from the top of their deck) put in play with `damage` on it. */
function withAlly(
  s: GameState,
  who: PlayerId,
  o: { damage?: number; tough?: boolean | undefined } = {},
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
const identityId = (s: GameState, p: PlayerId = P1): InstanceId => playerOf(s, p).identity.instanceId as InstanceId;

describe("registry", () => {
  it("registers every ref of the six cards; nothing is skipped", () => {
    const refs = AOA_CARDS.filter((c) => (c.id as string) >= DARKCHILDE && (c.id as string) <= BATTLE).flatMap(
      abilityRefIds,
    );
    expect([...refs].sort()).toEqual([...REFS].sort());
    expect(Object.keys(MAGIK_OBLIGATION_NEMESIS).sort()).toEqual([...REFS].sort());
    expect(Object.keys(MAGIK_OBLIGATION_NEMESIS_SKIPPED)).toEqual([]);
  });
  it.each(REFS)("%s validates", (id) => {
    expect(validateDefinition(MAGIK_OBLIGATION_NEMESIS[id as never]!)).toEqual([]);
  });
  it("the trigger of each ref", () => {
    const t = (id: string) => MAGIK_OBLIGATION_NEMESIS[id as never]!.trigger;
    expect(t("45053.obligation")).toMatchObject({ kind: "whenRevealed" });
    expect(t("45054.belasco-forced-response")).toMatchObject({ kind: "response", forced: true });
    expect(t("45055.when-revealed")).toMatchObject({ kind: "whenRevealed" });
    // A Forced Interrupt on the scheme: a When Defeated would run after its facedown attachments are already discarded.
    expect(t("45055.when-defeated")).toMatchObject({ kind: "interrupt", forced: true });
    expect(t("45057.witchfire-forced-response")).toMatchObject({ kind: "response", forced: true });
    expect(t("45058.boost")).toMatchObject({ kind: "boost" });
  });
});

describe("the printed cards (data against the print)", () => {
  it("Darkchilde: an obligation with 2 boost icons", () => {
    expect(DATA(DARKCHILDE)).toMatchObject({ type: "obligation", boostIcons: 2 });
  });
  it("Belasco: unique ELITE LIMBO minion, SCH 1, ATK 1, 6 hit points, villainous, 3 boost icons, nemesis minion", () => {
    expect(DATA(BELASCO)).toMatchObject({ type: "minion", unique: true, sch: 1, atk: 1, hp: 6, boostIcons: 3 });
    expect(DATA(BELASCO).keywords).toEqual([{ name: "villainous" }]);
    expect(DATA(BELASCO).nemesisMinion).toBe(true);
  });
  it("Ruler of Limbo: a flat 3 threat, an amplify icon and 3 boost icons", () => {
    expect(DATA(RULER)).toMatchObject({
      type: "side_scheme",
      amplifyIcons: 1,
      boostIcons: 3,
      startingThreat: { base: 3, perPlayer: 0 },
    });
  });
  it("S'ym: unique LIMBO minion, SCH 2, ATK 2, 5 hit points, guard, 2 boost icons", () => {
    expect(DATA(SYM)).toMatchObject({ type: "minion", unique: true, sch: 2, atk: 2, hp: 5, boostIcons: 2 });
    expect(DATA(SYM).keywords).toEqual([{ name: "guard" }]);
  });
  it("Witchfire: unique LIMBO minion, SCH 1, ATK 3, 4 hit points, quickstrike, 2 boost icons", () => {
    expect(DATA(WITCHFIRE)).toMatchObject({ type: "minion", unique: true, sch: 1, atk: 3, hp: 4, boostIcons: 2 });
    expect(DATA(WITCHFIRE).keywords).toEqual([{ name: "quickstrike" }]);
  });
  it("Battle for Limbo: a treachery with no boost icons and the star", () => {
    expect(DATA(BATTLE)).toMatchObject({ type: "treachery", boostIcons: 0, starIcon: true });
  });
});

describe("setup: the obligation sits in the encounter deck and the nemesis set is set aside", () => {
  it("Magik's set-aside area holds the five nemesis cards; the encounter deck holds Darkchilde once", () => {
    const s = alterEgoGame(ONE);
    expect([...setAsideCodes(s)].sort()).toEqual([...NEMESIS_CODES].sort());
    expect(count(encounterDeckCodes(s), DARKCHILDE)).toBe(1);
  });
});

describe("Darkchilde (45053)", () => {
  const EXHAUST = "Exhaust Illyana Rasputin";
  const DAMAGE = "Deal 1 damage to each character";
  const formOf = (s: GameState, p: PlayerId) => playerOf(s, p).identity.form;
  function revealed(form: "hero" | "alterEgo", pick: Picker, o: { ally?: boolean; seats?: readonly Seat[] } = {}) {
    const seats = o.seats ?? ONE;
    const base = form === "hero" ? heroGame(seats) : alterEgoGame(seats);
    const withA = o.ally ? withAlly(base, P1) : { state: base, ally: undefined as InstanceId | undefined };
    const id = findCard(withA.state, DARKCHILDE);
    return { ...reveal(withA.state, id, { pick }), ally: withA.ally, before: withA.state };
  }
  it("alter-ego form, the damage option: the identity and the ally each take 1, and the obligation is discarded", () => {
    const seen: Seen[] = [];
    const r = revealed("alterEgo", picker({ pick: [DAMAGE], seen }), { ally: true });
    const hp = (s: GameState) => inst(s, identityId(s)).damage;
    expect(hp(r.state) - hp(r.before)).toBe(1);
    expect(inst(r.state, r.ally!).damage).toBe(1);
    expect(whereIs(r.state, r.id)).toBe("encounterDiscard");
    expect(seen.length).toBeGreaterThan(0);
  });
  it("the exhaust option removes the obligation from the game and deals no damage", () => {
    const r = revealed("alterEgo", picker({ pick: [EXHAUST] }), { ally: true });
    expect(whereIs(r.state, r.id)).toBe("removedFromGame");
    expect(inst(r.state, r.ally!).damage).toBe(0);
    expect(inst(r.state, identityId(r.state)).exhausted).toBe(true);
  });
  it("hero form: the player may flip first (a card effect), then chooses the damage option", () => {
    const r = revealed("hero", picker({ pick: ["Flip to alter-ego form", DAMAGE] }), { ally: true });
    expect(formOf(r.state, P1)).toBe("alterEgo");
    expect(inst(r.state, r.ally!).damage).toBe(1);
    expect(whereIs(r.state, r.id)).toBe("encounterDiscard");
  });
  it("hero form, staying: the exhaust option is not offered, so the damage option is taken", () => {
    const seen: Seen[] = [];
    const r = revealed("hero", picker({ pick: ["Stay in hero form"], seen }), { ally: true });
    expect(formOf(r.state, P1)).toBe("hero");
    expect(inst(r.state, r.ally!).damage).toBe(1);
    expect(whereIs(r.state, r.id)).toBe("encounterDiscard");
    expect(seen.flatMap((p) => p.labels).some((l) => l.includes(EXHAUST))).toBe(false);
  });
});

/** Threat a given card placed on a scheme, summed over the events. */
const placedBy = (events: readonly GameEvent[], scheme: InstanceId, source: InstanceId): number =>
  ofType(events, "threatPlaced")
    .filter((e) => e.schemeInstanceId === scheme && e.sourceInstanceId === source)
    .reduce((n, e) => n + e.amount, 0);

describe("S'ym (45056)", () => {
  it("Ruler of Limbo in play: 2 threat is placed on it and none on the main scheme", () => {
    const base = alterEgoGame(ONE);
    const ruler = findCard(base, RULER);
    const s = put(base, ruler, "villain", { threat: 3 });
    const sym = findCard(s, SYM);
    const r = reveal(s, sym);
    expect(inst(r.state, ruler).threat).toBe(5);
    expect(placedBy(r.events, ruler, sym)).toBe(2);
    expect(placedBy(r.events, r.state.mainScheme.instanceId, sym)).toBe(0);
    expect(inst(r.state, sym).engagedWith).toBe(P1);
  });
  it("Ruler of Limbo not in play: 2 threat goes on the main scheme", () => {
    const base = alterEgoGame(ONE);
    const sym = findCard(base, SYM);
    const r = reveal(base, sym);
    expect(placedBy(r.events, r.state.mainScheme.instanceId, sym)).toBe(2);
    expect(r.state.villainArea).not.toContain(findCard(base, RULER));
  });
});

describe("Ruler of Limbo (45055)", () => {
  const thwart = (s: GameState, ruler: InstanceId, who: PlayerId = P1): Command => ({
    type: "basicThwart",
    playerId: who,
    thwarterInstanceId: playerOf(s, who).identity.instanceId as InstanceId,
    schemeInstanceId: ruler,
  });
  const limboOf = (s: GameState) => instancesOf(s, LIMBO).filter((i) => whereIs(s, i).startsWith("attachedTo:"));

  it("When Revealed: Limbo is found in the deck and attached to Ruler of Limbo facedown (out of play)", () => {
    const s = heroGame(ONE);
    const ruler = findCard(s, RULER);
    const limbo =
      playerOf(s, P1).deck.find((i) => codeOf(s, i) === LIMBO) ??
      playerOf(s, P1).hand.find((i) => codeOf(s, i) === LIMBO)!;
    const r = reveal(s, ruler);
    expect(r.state.villainArea).toContain(ruler);
    expect(whereIs(r.state, limbo)).toBe(`attachedTo:${ruler}`);
    expect(inst(r.state, limbo).faceup).toBe(false);
    expect(playerOf(r.state, P1).deck).not.toContain(limbo);
    expect(limboOf(r.state)).toEqual([limbo]);
  });
  it("Limbo in hand is the one found", () => {
    const base = heroGame(ONE);
    const staged = handOf(base, P1, [LIMBO, EVENT_A, EVENT_B]);
    const ruler = findCard(staged.state, RULER);
    const limbo = staged.ids[0]!;
    const r = reveal(staged.state, ruler);
    expect(whereIs(r.state, limbo)).toBe(`attachedTo:${ruler}`);
    expect(playerOf(r.state, P1).hand).not.toContain(limbo);
  });
  it("two players, Spider-Man (seat 1) reveals it: Magik's player's Limbo is found, whoever reveals", () => {
    const s = heroGame(TWO_MAGIK_SECOND);
    const ruler = findCard(s, RULER);
    const limbo = [...playerOf(s, P2).deck, ...playerOf(s, P2).hand].find((i) => codeOf(s, i) === LIMBO)!;
    const r = reveal(s, ruler, { to: P1 });
    expect(whereIs(r.state, limbo)).toBe(`attachedTo:${ruler}`);
  });
  it("When Defeated: Limbo is put into play under its owner's control, faceup and ready", () => {
    const s = heroGame(ONE);
    const ruler = findCard(s, RULER);
    const revealed = reveal(s, ruler);
    const limbo = limboOf(revealed.state)[0]!;
    const low = patchInstance(revealed.state, ruler, { threat: 1 });
    const done = driveEventsPicking(DEPS, low, firstLegal, thwart(low, ruler));
    expect(ofType(done.events, "threatRemoved").filter((e) => e.schemeInstanceId === ruler)).toHaveLength(1);
    expect(whereIs(done.state, limbo)).toBe("playArea:p1");
    expect(inst(done.state, limbo).faceup).toBe(true);
    expect(inst(done.state, limbo).exhausted).toBe(false);
  });
  it("Belasco in play: threat cannot be removed, the thwart takes nothing off", () => {
    const base = heroGame(ONE);
    const ruler = findCard(base, RULER);
    const revealed = reveal(base, ruler).state;
    const withBelasco = put(patchInstance(revealed, ruler, { threat: 2 }), findCard(revealed, BELASCO), "play");
    const result = applyCommand(withBelasco, thwart(withBelasco, ruler), DEPS);
    if (result.ok)
      expect(
        inst(
          settle(result.state, firstLegal, (st) => !st.pendingChoice, DEPS),
          ruler,
        ).threat,
      ).toBe(2);
    else expect(result.ok).toBe(false);
  });
  it("without Belasco in play the same thwart removes threat", () => {
    const base = heroGame(ONE);
    const ruler = findCard(base, RULER);
    const revealed = patchInstance(reveal(base, ruler).state, ruler, { threat: 2 });
    const done = driveEventsPicking(DEPS, revealed, firstLegal, thwart(revealed, ruler));
    expect(inst(done.state, ruler).threat).toBe(1);
  });
});

describe("Belasco (45054)", () => {
  /** Hero Magik, Belasco engaged with the first seat; Rhino's attack comes first (midway fires at its defender prompt). */
  function belascoActs(o: { ruler: boolean; seats?: readonly Seat[]; form?: "hero" | "alterEgo" }) {
    const seats = o.seats ?? ONE;
    const base = o.form === "alterEgo" ? alterEgoGame(seats) : heroGame(seats);
    const belasco = findCard(base, BELASCO);
    const ruler = findCard(base, RULER);
    let s = put(base, belasco, "play", { to: P1 });
    if (o.ruler) s = put(s, ruler, "villain", { threat: 3 });
    const staged = stageDeck(s, [
      ...times(seats.length + 2, "boost" as const),
      ...times(seats.length, "deal" as const),
      ...times(6, "boost" as const),
    ]);
    let top: InstanceId[] = [];
    const r = runVillainPhase(DEPS, staged, picker({ pick: ["decline"] }), (st) => {
      top = playerOf(st, P1).deck.slice(0, 3);
      return st;
    });
    return { ...r, belasco, ruler, top };
  }
  it("after he attacks you: the top 3 cards of your deck are discarded", () => {
    const r = belascoActs({ ruler: false });
    expect(r.top).toHaveLength(3);
    expect(ofType(r.events, "attackResolved").filter((e) => e.enemyInstanceId === r.belasco)).toHaveLength(1);
    for (const id of r.top) expect(whereIs(r.state, id)).toBe("discard:p1");
  });
  it("Ruler of Limbo in play: those 3 cards are attached to it facedown instead of staying in the discard pile", () => {
    const r = belascoActs({ ruler: true });
    expect(r.top).toHaveLength(3);
    for (const id of r.top) {
      expect(whereIs(r.state, id)).toBe(`attachedTo:${r.ruler}`);
      expect(inst(r.state, id).faceup).toBe(false);
    }
  });
  it("alter-ego form: he schemes against you and the Forced Response still discards the top 3", () => {
    const r = belascoActs({ ruler: false, form: "alterEgo" });
    expect(ofType(r.events, "attackResolved").filter((e) => e.enemyInstanceId === r.belasco)).toHaveLength(0);
    expect(r.top).toEqual([]); // no defender prompt in alter-ego form
    expect(playerOf(r.state, P1).discard).toHaveLength(3);
  });
  it("he does not trigger for a player he is not activating against: two players, he is engaged with Spider-Man (seat 2)", () => {
    const seats = TWO;
    const base = heroGame(seats);
    const belasco = findCard(base, BELASCO);
    const s = put(base, belasco, "play", { to: P2 });
    const staged = stageDeck(s, [
      ...times(seats.length + 2, "boost" as const),
      ...times(seats.length, "deal" as const),
      ...times(6, "boost" as const),
    ]);
    const before = playerOf(staged, P1).deck.slice(0, 3);
    const r = runVillainPhase(DEPS, staged, picker({ pick: ["decline"] }));
    // Magik's player is attacked by Rhino only; her deck is not milled by Belasco.
    for (const id of before) expect(whereIs(r.state, id)).not.toBe("discard:p1");
    const spider = playerOf(staged, P2).deck.slice(0, 3);
    expect(spider.some((id) => whereIs(r.state, id) === "discard:p2")).toBe(true);
  });
});

describe("Witchfire (45057), RAW pending FFG clarification (Q31)", () => {
  /**
   * Hero Magik with Witchfire engaged and an ally in play; Rhino's attack on the first player is left undefended and
   * Witchfire's is defended by the ally (`defends: false`: by nobody). `ruler`: Ruler of Limbo in play (3 threat).
   */
  function witchfireAttacks(o: { ruler: boolean; defends?: boolean; tough?: boolean }) {
    const base = heroGame(ONE);
    const witchfire = findCard(base, WITCHFIRE);
    const ruler = findCard(base, RULER);
    const placed = withAlly(put(base, witchfire, "play", { to: P1 }), P1, { tough: o.tough });
    const s = o.ruler ? put(placed.state, ruler, "villain", { threat: 3 }) : placed.state;
    const staged = stageDeck(s, [...times(3, "boost" as const), "deal", ...times(6, "boost" as const)]);
    let prompts = 0;
    const pick: Picker = (st) => {
      const choice = st.pendingChoice!;
      if (choice.prompt.kind !== "declareDefender") return firstLegal(st);
      prompts += 1;
      const at = choice.options.find((opt) => (opt.optionId as string) === (placed.ally as string));
      if (prompts === 2 && o.defends !== false && at) return [at.optionId as string];
      return ["decline"];
    };
    const r = runWithDeps(DEPS, staged, pick, ...endPhase(staged));
    const main = r.state.mainScheme.instanceId;
    return {
      ...r,
      witchfire,
      ruler,
      ally: placed.ally,
      onRuler: placedBy(r.events, ruler, witchfire),
      onMain: placedBy(r.events, main, witchfire),
    };
  }
  const attacksOf = (events: readonly GameEvent[], id: InstanceId) =>
    ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === id);

  it("her attack defeats the ally with Ruler of Limbo in play: 1 threat on Ruler of Limbo and none on the main scheme", () => {
    const r = witchfireAttacks({ ruler: true });
    expect(attacksOf(r.events, r.witchfire)).toHaveLength(1);
    expect(whereIs(r.state, r.ally)).toBe("discard:p1");
    expect(r.onRuler).toBe(1);
    expect(r.onMain).toBe(0);
    expect(inst(r.state, r.ruler).threat).toBe(4);
  });
  it("her attack defeats the ally with Ruler of Limbo not in play: nothing is placed (the 'Otherwise' is not reached)", () => {
    const r = witchfireAttacks({ ruler: false });
    expect(whereIs(r.state, r.ally)).toBe("discard:p1");
    expect(r.onRuler).toBe(0);
    expect(r.onMain).toBe(0);
  });
  it("her attack hits the hero (undefended): 'Otherwise', 1 threat on the main scheme, Ruler of Limbo untouched", () => {
    const r = witchfireAttacks({ ruler: true, defends: false });
    expect(attacksOf(r.events, r.witchfire)).toHaveLength(1);
    expect(whereIs(r.state, r.ally)).toBe("playArea:p1");
    expect(r.onMain).toBe(1);
    expect(r.onRuler).toBe(0);
  });
  it("the ally survives her attack (a tough status card): 'Otherwise', 1 threat on the main scheme", () => {
    const r = witchfireAttacks({ ruler: true, tough: true });
    expect(whereIs(r.state, r.ally)).toBe("playArea:p1");
    expect(r.onMain).toBe(1);
    expect(r.onRuler).toBe(0);
  });
});

describe("Battle for Limbo (45058)", () => {
  /** Hero Magik; `minions`: the nemesis cards put in play engaged with the first seat before Battle for Limbo is revealed. */
  function battle(minions: readonly string[], o: { form?: "hero" | "alterEgo"; ruler?: boolean } = {}) {
    const base = o.form === "alterEgo" ? alterEgoGame(ONE) : heroGame(ONE);
    let s = base;
    const ids = minions.map((code) => findCard(base, code));
    for (const id of ids) s = put(s, id, "play", { to: P1 });
    const ruler = findCard(base, RULER);
    if (o.ruler) s = put(s, ruler, "villain", { threat: 3 });
    const bfl = findCard(s, BATTLE);
    const r = reveal(s, bfl, { pick: picker({ pick: ["decline"] }) });
    return { ...r, bfl, ids, ruler };
  }
  const surges = (events: readonly GameEvent[], id: InstanceId) =>
    ofType(events, "surgeTriggered").filter((e) => e.instanceId === id);
  const attacksOf = (events: readonly GameEvent[], id: InstanceId) =>
    ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === id);

  it("a LIMBO minion in play attacks the hero it is engaged with, and the card does not gain surge", () => {
    const r = battle([WITCHFIRE]);
    // Two: her own activation in the villain phase, then the one Battle for Limbo makes her take.
    expect(attacksOf(r.events, r.ids[0]!)).toHaveLength(2);
    expect(surges(r.events, r.bfl)).toEqual([]);
  });
  it("each LIMBO minion activates: S'ym and Witchfire each attack in the villain phase and again for the card", () => {
    const r = battle([SYM, WITCHFIRE]);
    for (const id of r.ids) expect(attacksOf(r.events, id)).toHaveLength(2);
    expect(surges(r.events, r.bfl)).toEqual([]);
  });
  it("Belasco (LIMBO) counts too", () => {
    // Villainous: each of Belasco's activations is dealt a boost card, so the villain phase's one comes before the deal.
    const base = heroGame(ONE);
    const belasco = findCard(base, BELASCO);
    const s = put(base, belasco, "play", { to: P1 });
    const bfl = findCard(s, BATTLE);
    const staged = stageDeck(s, ["boost", "boost", bfl, ...times(8, "boost" as const)]);
    const r = runWithDeps(DEPS, staged, picker({ pick: ["decline"] }), ...endPhase(staged));
    expect(attacksOf(r.events, belasco)).toHaveLength(2);
    expect(surges(r.events, bfl)).toEqual([]);
  });
  it("an alter-ego schemes instead: the minion's activation is a scheme against that player", () => {
    const r = battle([WITCHFIRE], { form: "alterEgo" });
    expect(attacksOf(r.events, r.ids[0]!)).toHaveLength(0);
    expect(ofType(r.events, "schemeResolved").length).toBeGreaterThanOrEqual(1);
    expect(surges(r.events, r.bfl)).toEqual([]);
  });
  it("no LIMBO minion in play: the card gains surge", () => {
    const r = battle([]);
    expect(surges(r.events, r.bfl)).toHaveLength(1);
  });
  it("boost: with Ruler of Limbo in play, 2 threat is placed on it", () => {
    const base = heroGame(ONE);
    const ruler = findCard(base, RULER);
    const s = put(base, ruler, "villain", { threat: 3 });
    const bfl = findCard(s, BATTLE);
    const staged = stageDeck(s, [bfl, ...times(3, "boost" as const), "deal", ...times(6, "boost" as const)]);
    const r = runWithDeps(DEPS, staged, picker({ pick: ["decline"] }), ...endPhase(staged));
    expect(placedBy(r.events, ruler, bfl)).toBe(2);
    expect(inst(r.state, ruler).threat).toBe(5);
  });
  it("boost: with Ruler of Limbo not in play, nothing happens", () => {
    const base = heroGame(ONE);
    const bfl = findCard(base, BATTLE);
    const staged = stageDeck(base, [bfl, ...times(3, "boost" as const), "deal", ...times(6, "boost" as const)]);
    const r = runWithDeps(DEPS, staged, picker({ pick: ["decline"] }), ...endPhase(staged));
    expect(ofType(r.events, "threatPlaced").filter((e) => e.sourceInstanceId === bfl)).toEqual([]);
  });
});
