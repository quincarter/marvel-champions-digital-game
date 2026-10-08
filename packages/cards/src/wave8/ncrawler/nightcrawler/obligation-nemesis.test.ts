import { NCRAWLER_CARDS, NCRAWLER_STARTER_DECKS, VNM_CARDS, WAVE7_CARDS, cardId, type AnyCard } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  characterProfile,
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
  play,
  playerOf,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, driveStepwise, withForm } from "../../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { NIGHTCRAWLER_IDENTITY } from "./identity.js";
import { NIGHTCRAWLER_OBLIGATION_NEMESIS, NIGHTCRAWLER_OBLIGATION_NEMESIS_SKIPPED } from "./obligation-nemesis.js";
import { NIGHTCRAWLER_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Nightcrawler's obligation and nemesis set (48026 Crisis of Faith; 48027 Azazel, 48028 Brimstone Dimension, 48029
 * Azazel's Sword, 48030 Brimstone Strike), docs/phase7-wave8.md section 7.4, 3.1, 3.75, 3.72. Real commands in a real
 * game: his Protection precon (`nightcrawler-protection`, hero face THW 2, ATK 1, DEF 3, hand size 5, 9 hit points;
 * Kurt Wagner REC 3, hand size 6) against Rhino (Core, standard, no modular set; stage 1 ATK 2, SCH 1, one boost card
 * per activation). Spider-Man (Justice precon) is the other seat. A boost card that must do nothing is Advance 01186 (0
 * boost icons); a revealed card that must do nothing is "I'm Tough!" 01105 (0 boost icons). Azazel: SCH 2, ATK 3, 3
 * hit points, quickstrike, no boost icons (a boost star only), and he is not villainous, so he is dealt no boost card.
 * Hands are staged by relabeling cards (test-only surgery on cards whose own text is not under test).
 */
const CRISIS = "48026";
const AZAZEL = "48027";
const DIMENSION = "48028";
const SWORD = "48029";
const STRIKE = "48030";
const NEMESIS_CODES = [AZAZEL, DIMENSION, SWORD, STRIKE, STRIKE];
const SHADOW_OF_THE_PAST = "01190";
const BOOST_FILLER = "01186";
const DEAL_FILLER = "01105";
const BAMF = "48006";
const DAYTRIPPER = "48002";
const UNDER_CONTROL = "48015";
const MERCENARY = "01101";
const ADVANCE = "01186";

const ATTACK_DEFENSE_EVENTS = ["48007", "48008", "48011", "48017", "48018"] as const;
const KEPT = ["48009", "48010"] as const;

const OBLIGATION_REF = "48026.obligation";
const REFS = [
  OBLIGATION_REF,
  "48027.azazel-constant",
  "48027.boost",
  "48028.when-defeated",
  "48029.azazels-sword-constant",
  "48029.azazels-sword-response",
  "48030.when-revealed-alter-ego",
  "48030.when-revealed-hero",
];
const SWORD_RESPONSE = "48029.azazels-sword-response";

const DEPS: EngineDeps = {
  abilities: mergeRegistries(
    WAVE7_ABILITIES,
    NIGHTCRAWLER_IDENTITY,
    NIGHTCRAWLER_SUPPORT_UPGRADES_ALLIES,
    NIGHTCRAWLER_OBLIGATION_NEMESIS,
  ),
};
const POOL: readonly AnyCard[] = [...WAVE7_CARDS, ...VNM_CARDS, ...NCRAWLER_CARDS];
const DATA = (code: string) => NCRAWLER_CARDS.find((c) => (c.id as string) === code)! as any;

const PRECON = NCRAWLER_STARTER_DECKS.find((d) => d.id === "nightcrawler-protection")!;
const PRECON_DECK = PRECON.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId));
type Seat = { readonly kind: "nc" | "core" };
const NC: Seat = { kind: "nc" };
const SM: Seat = { kind: "core" };
const ONE: readonly Seat[] = [NC];
/** Nightcrawler is seat 1, Spider-Man (Justice precon) seat 2. */
const TWO: readonly Seat[] = [NC, SM];
/** Spider-Man is seat 1 and Nightcrawler seat 2: the Kurt Wagner player is not the first player. */
const TWO_NC_SECOND: readonly Seat[] = [SM, NC];

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const setAsideCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).setAside.map((id) => codeOf(s, id));
const encounterDeckCodes = (s: GameState): string[] =>
  Object.values(s.encounterDecks).flatMap((d) => d.deck.map((i) => codeOf(s, i)));
const encounterDiscardCodes = (s: GameState): string[] =>
  Object.values(s.encounterDecks).flatMap((d) => d.discard.map((i) => codeOf(s, i)));
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const count = (codes: readonly string[], code: string): number => codes.filter((c) => c === code).length;
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, DEPS)!;
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
    seat.kind === "nc"
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
const nightcrawlerSeat = (seats: readonly Seat[]): PlayerId => (seats[0]!.kind === "nc" ? P1 : P2);

const relabel = (s: GameState, id: InstanceId, code: string): GameState =>
  patchInstance(s, id, { cardId: cardId(code) });
const activeSeat = (s: GameState): PlayerId | undefined => (s.step as { activePlayerId?: PlayerId }).activePlayerId;
/** Every seat ends its turn, the active seat first. */
const endPhase = (s: GameState): Command[] => {
  const first = activeSeat(s) ?? P1;
  return [first, ...s.players.map((p) => p.playerId).filter((p) => p !== first)].map((p) => endTurn(p));
};
const run = (s: GameState, pick: Picker, ...commands: readonly Command[]) =>
  driveEventsPicking(DEPS, s, pick, ...commands);
/** The seats that have not yet ended their turn end it, one command at a time, until the villain phase has run its course. */
function endPlayerPhase(s: GameState, pick: Picker): { state: GameState; events: readonly GameEvent[] } {
  let state = s;
  const events: GameEvent[] = [];
  for (let guard = 0; guard < 8 && state.round === s.round && !state.outcome; guard++) {
    const r = run(state, pick, endTurn(activeSeat(state) ?? P1));
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}
/** The end-turn commands that must come first for `p` to act: the other seats' turns, when it is not yet `p`'s. */
const waitFor = (s: GameState, p: PlayerId): Command[] => {
  const active = activeSeat(s);
  return active !== undefined && active !== p ? [endTurn(active)] : [];
};

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

type Where = "play" | "deck" | "discard" | "victory" | "removed" | "dealt" | "villain";
/** Test-only surgery: the card `id` taken out of wherever it is and put in `where` (an enemy in play is engaged with `to`). */
function put(s: GameState, id: InstanceId, where: Where, o: { to?: PlayerId; damage?: number; threat?: number } = {}) {
  const to = o.to ?? P1;
  const deckId = activeEncounterDeckId(s);
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
    victoryDisplay: without(s.victoryDisplay),
    removedFromGame: without(s.removedFromGame),
  };
  const pile = stripped.encounterDecks[deckId]!;
  const out = (patch: Parameters<typeof patchInstance>[2], next: GameState = stripped) =>
    patchInstance(next, id, patch);
  const facedown = { faceup: false, engagedWith: null, damage: 0 };
  switch (where) {
    case "play":
      return out(
        { faceup: true, controllerId: null, engagedWith: to, exhausted: false, damage: o.damage ?? 0 },
        {
          ...stripped,
          players: stripped.players.map((p) => (p.playerId === to ? { ...p, playArea: [...p.playArea, id] } : p)),
        },
      );
    case "villain":
      return out({ faceup: true, threat: o.threat ?? 0 }, { ...stripped, villainArea: [...stripped.villainArea, id] });
    case "deck":
      return out(facedown, {
        ...stripped,
        encounterDecks: { ...stripped.encounterDecks, [deckId]: { ...pile, deck: [...pile.deck, id] } },
      });
    case "discard":
      return out(facedown, {
        ...stripped,
        encounterDecks: { ...stripped.encounterDecks, [deckId]: { ...pile, discard: [id, ...pile.discard] } },
      });
    case "victory":
      return out(facedown, { ...stripped, victoryDisplay: [...stripped.victoryDisplay, id] });
    case "removed":
      return out(facedown, { ...stripped, removedFromGame: [...stripped.removedFromGame, id] });
    case "dealt":
      return out(facedown, {
        ...stripped,
        players: stripped.players.map((p) =>
          p.playerId === to ? { ...p, dealtEncounter: [...p.dealtEncounter, id] } : p,
        ),
      });
  }
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
/**
 * `boosts` boost fillers, then `deals` dealt fillers (the first one "I'm Tough!", the rest Advance), then spare boost
 * fillers for the schemes Advance starts: a villain phase that reveals nothing of its own.
 */
const quiet = (s: GameState, boosts = s.players.length, deals = s.players.length): GameState =>
  stageDeck(s, [
    ...times(boosts, "boost" as const),
    "deal",
    ...times(Math.max(0, deals - 1), "advance" as const),
    ...times(6, "boost" as const),
  ]);

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
  const pick = opts.pick ?? firstLegal;
  return { ...runVillainPhase(staged, pick, opts.midway), id };
}
/**
 * Every seat ends its turn and the villain phase runs. `midway`: test surgery at the defender prompt of Rhino's attack
 * on a hero (the first prompt of the villain phase), for what the player phase's own end would undo: heroes ready and
 * draw to their hand size when they end their turn, so nothing can be left exhausted or a hand left short.
 */
function runVillainPhase(staged: GameState, pick: Picker, midway?: (s: GameState) => GameState) {
  if (!midway) return run(staged, pick, ...endPhase(staged));
  const ends = endPhase(staged);
  const before = run(staged, pick, ...ends.slice(0, -1));
  const last = applyOk(before.state, ends[ends.length - 1]!, DEPS);
  let done = false;
  const after = driveStepwise(DEPS, last.state, pick, (st) => {
    if (done || st.pendingChoice?.prompt.kind !== "declareDefender") return st;
    done = true;
    return midway(st);
  });
  return { state: after.state, events: [...before.events, ...last.events, ...after.events] };
}
/** The card `id` as the top boost card of the villain's first activation (the second draw is a filler). */
function asBoost(s: GameState, id: InstanceId, pick: Picker = firstLegal, boostsAhead = 0): Villain {
  const staged = stageDeck(s, [...times(boostsAhead, "boost" as const), id, ...times(8, "boost" as const)]);
  return { ...run(staged, pick, ...endPhase(staged)), id };
}
const attacksBy = (events: readonly GameEvent[], enemy: InstanceId) =>
  ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === enemy);
const schemesBy = (events: readonly GameEvent[], enemy: InstanceId) =>
  ofType(events, "schemeResolved").filter((e) => e.enemyInstanceId === enemy);
const revealsOf = (events: readonly GameEvent[], id: InstanceId) =>
  ofType(events, "encounterCardRevealed").filter((e) => e.instanceId === id);
const announced = (events: readonly GameEvent[], kind: string, id: InstanceId) =>
  ofType(events, "triggerEvent").filter(
    (e) => e.event.kind === kind && "instanceId" in e.event && e.event.instanceId === id,
  );

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
const discarded = (events: readonly GameEvent[], p: PlayerId): InstanceId[] =>
  ofType(events, "cardDiscardedFromHand")
    .filter((e) => e.playerId === p)
    .map((e) => e.instanceId);

describe("registry", () => {
  it("registers every ref of the five cards and skips none", () => {
    const refs = NCRAWLER_CARDS.filter((c) => (c.id as string) >= CRISIS && (c.id as string) <= STRIKE).flatMap(
      abilityRefIds,
    );
    expect([...refs].sort()).toEqual([...REFS].sort());
    expect(Object.keys(NIGHTCRAWLER_OBLIGATION_NEMESIS).sort()).toEqual([...REFS].sort());
    expect(NIGHTCRAWLER_OBLIGATION_NEMESIS_SKIPPED).toEqual({});
  });
  it.each(REFS)("%s validates", (id) => {
    expect(validateDefinition(NIGHTCRAWLER_OBLIGATION_NEMESIS[id as never]!)).toEqual([]);
  });
  it("the trigger of each ref: the obligation, Azazel's constant and boost, the Sword's optional hero response", () => {
    const t = (id: string) => NIGHTCRAWLER_OBLIGATION_NEMESIS[id as never]!.trigger;
    expect(t(OBLIGATION_REF)).toMatchObject({ kind: "whenRevealed" });
    expect(t("48027.boost")).toMatchObject({ kind: "boost" });
    expect(t("48028.when-defeated")).toMatchObject({ kind: "whenDefeated" });
    expect(t(SWORD_RESPONSE)).toMatchObject({ kind: "response", forced: false, form: "hero" });
  });
});

describe("the printed cards (data against the scans)", () => {
  it("Crisis of Faith: an obligation with 2 boost icons given to the Kurt Wagner player", () => {
    expect(DATA(CRISIS)).toMatchObject({ type: "obligation", name: "Crisis of Faith", boostIcons: 2, unique: false });
    expect(DATA("48001a").obligationCardId).toBe(CRISIS);
    expect(DATA("48001a").nemesisEncounterSetId).toBe("nightcrawler_nemesis");
  });
  it("Azazel: unique ELITE NEYAPHEM minion, SCH 2, ATK 3, 3 hit points, quickstrike, no boost icons and a boost star", () => {
    expect(DATA(AZAZEL)).toMatchObject({
      type: "minion",
      unique: true,
      sch: 2,
      atk: 3,
      hp: 3,
      boostIcons: 0,
      starIcon: true,
    });
    expect(DATA(AZAZEL).keywords).toEqual([{ name: "quickstrike" }]);
    expect(DATA(AZAZEL).traits).toEqual(["ELITE", "NEYAPHEM"]);
  });
  it("Brimstone Dimension: a side scheme with a flat 5 threat, a hazard icon and 3 boost icons", () => {
    expect(DATA(DIMENSION)).toMatchObject({
      type: "side_scheme",
      startingThreat: { base: 5, perPlayer: 0 },
      icons: ["hazard"],
      boostIcons: 3,
    });
  });
  it("Azazel's Sword: a WEAPON attachment, +1 ATK, 2 boost icons, hosted by Azazel else the villain; Brimstone Strike: 1 boost icon, 2 copies", () => {
    expect(DATA(SWORD)).toMatchObject({
      type: "attachment",
      attachesTo: { kind: "ifAble", preferred: { kind: "namedCard", name: "Azazel" }, otherwise: { kind: "villain" } },
      statModifiers: { atk: 1 },
      boostIcons: 2,
    });
    expect(DATA(SWORD).traits).toEqual(["WEAPON"]);
    expect(DATA(STRIKE)).toMatchObject({ type: "treachery", boostIcons: 1, quantityInSet: 2 });
  });
});

describe("setup: the obligation sits in the encounter deck and the nemesis set is set aside", () => {
  it("Nightcrawler's set-aside area holds the five nemesis cards only (counted by code); the encounter deck holds Crisis of Faith once", () => {
    const s = setupGame(ONE);
    const aside = setAsideCodes(s);
    for (const code of [AZAZEL, DIMENSION, SWORD]) expect(count(aside, code)).toBe(1);
    expect(count(aside, STRIKE)).toBe(2);
    expect(aside).toHaveLength(5);
    expect(count(encounterDeckCodes(s), CRISIS)).toBe(1);
    expect(encounterDeckCodes(s).some((c) => NEMESIS_CODES.includes(c))).toBe(false);
  });
  it("two players: only Nightcrawler's seat holds the set, whichever seat that is", () => {
    const a = setupGame(TWO);
    expect(setAsideCodes(a, P1)).toHaveLength(5);
    expect(setAsideCodes(a, P2).filter((c) => NEMESIS_CODES.includes(c))).toEqual([]);
    const b = setupGame(TWO_NC_SECOND);
    expect(setAsideCodes(b, P2)).toHaveLength(5);
    expect(setAsideCodes(b, P1).filter((c) => NEMESIS_CODES.includes(c))).toEqual([]);
  });
});

describe("Crisis of Faith (48026)", () => {
  const FLIP = "Flip to alter-ego form";
  const STAY = "Stay in hero form";
  const EXHAUST = "Exhaust Kurt Wagner";
  const DISCARD = "Discard each Attack and Defense event";
  /**
   * Nightcrawler's hand when the villain phase starts (a hand over the hand size is discarded down first): in alter-ego
   * form (hand size 6) the five Attack and Defense events and Scout Ahead; in hero form (hand size 5) 'Port and Punch
   * (Attack), Tally Ho! (Defense), Powerful Punch (both types), Scout Ahead (Thwart) and 'Port Away (neither).
   */
  const ALTER_HAND = [...ATTACK_DEFENSE_EVENTS, "48009"];
  const HERO_HAND = ["48007", "48011", "48017", ...KEPT];
  /** The scenario: Nightcrawler (at his seat, in `form`) with `hand`, Crisis of Faith revealed to `to`. */
  function revealed(
    seats: readonly Seat[],
    form: "hero" | "alterEgo",
    hand: readonly string[],
    pick: Picker,
    o: { to?: PlayerId; exhaustedAtAttack?: boolean } = {},
  ) {
    const nc = nightcrawlerSeat(seats);
    const base = form === "hero" ? heroGame(seats) : alterEgoGame(seats);
    const staged = handOf(base, nc, hand);
    const id = findCard(staged.state, CRISIS);
    const midway = o.exhaustedAtAttack
      ? (st: GameState) => patchInstance(st, identityOf(st, nc), { exhausted: true })
      : undefined;
    return { ...reveal(staged.state, id, { to: o.to, pick, midway }), nc, hand: staged.ids };
  }
  const formOf = (s: GameState, p: PlayerId) => playerOf(s, p).identity.form;

  describe("hero form (hand of 5: Attack, Defense, both types, Thwart, neither)", () => {
    it("asks Nightcrawler's player to flip, then to choose: flip and exhaust Kurt Wagner removes it from the game, the hand is untouched", () => {
      const seen: Seen[] = [];
      const r = revealed(ONE, "hero", HERO_HAND, picker({ pick: [FLIP, EXHAUST], seen }));
      const chooses = asked(seen, "chooseOption");
      expect(chooses).toHaveLength(2);
      expect(chooses[0]!.labels).toEqual([FLIP, STAY]);
      expect(chooses[1]!.labels).toHaveLength(2);
      expect(chooses[1]!.labels[0]).toContain(EXHAUST);
      expect(chooses[1]!.labels[1]).toContain(DISCARD);
      expect(chooses.map((c) => c.player)).toEqual(["p1", "p1"]);
      expect(whereIs(r.state, r.id)).toBe("removedFromGame");
      expect(encounterDiscardCodes(r.state)).not.toContain(CRISIS);
      expect(formOf(r.state, P1)).toBe("alterEgo");
      expect(ofType(r.events, "formChanged")).toHaveLength(1);
      expect(ofType(r.events, "cardExhausted").map((e) => e.instanceId)).toContain(identityOf(r.state));
      for (const id of r.hand) expect(whereIs(r.state, id)).toBe("hand:p1");
    });
    it("flip and discard: 'Port and Punch (Attack), Tally Ho! (Defense) and Powerful Punch (both) leave his hand, Scout Ahead and 'Port Away stay, Crisis of Faith is discarded", () => {
      const r = revealed(ONE, "hero", HERO_HAND, picker({ pick: [FLIP, DISCARD] }));
      for (const id of r.hand.slice(0, 3)) expect(whereIs(r.state, id)).toBe("discard:p1");
      for (const id of r.hand.slice(3)) expect(whereIs(r.state, id)).toBe("hand:p1");
      expect(playerOf(r.state, P1).discard.filter((i) => r.hand.includes(i))).toHaveLength(3);
      expect(formOf(r.state, P1)).toBe("alterEgo");
      expect(whereIs(r.state, r.id)).toBe("encounterDiscard");
      expect(ofType(r.events, "cardExhausted").map((e) => e.instanceId)).not.toContain(identityOf(r.state));
    });
    it("staying in hero form there is no alter-ego to exhaust, so the discard option is the only one: it is taken without a second prompt", () => {
      const seen: Seen[] = [];
      const r = revealed(ONE, "hero", HERO_HAND, picker({ pick: [STAY], seen }));
      const chooses = asked(seen, "chooseOption");
      expect(chooses.map((c) => c.labels)).toEqual([[FLIP, STAY]]);
      expect(whereIs(r.state, r.id)).toBe("encounterDiscard");
      for (const id of r.hand.slice(0, 3)) expect(whereIs(r.state, id)).toBe("discard:p1");
      for (const id of r.hand.slice(3)) expect(whereIs(r.state, id)).toBe("hand:p1");
      expect(formOf(r.state, P1)).toBe("hero");
      expect(ofType(r.events, "formChanged")).toEqual([]);
    });
    it("flipping with his hero face exhausted gives an exhausted Kurt Wagner who cannot pay: only the discard option, taken without a second prompt", () => {
      const seen: Seen[] = [];
      const r = revealed(ONE, "hero", HERO_HAND, picker({ pick: [FLIP], seen }), { exhaustedAtAttack: true });
      expect(asked(seen, "chooseOption").map((c) => c.labels)).toEqual([[FLIP, STAY]]);
      expect(formOf(r.state, P1)).toBe("alterEgo");
      expect(whereIs(r.state, r.id)).toBe("encounterDiscard");
      for (const id of r.hand.slice(0, 3)) expect(whereIs(r.state, id)).toBe("discard:p1");
    });
  });

  describe("alter-ego form (hand of 6: the five Attack and Defense events and Scout Ahead)", () => {
    it("no flip is offered; both options are: exhaust Kurt Wagner removes it from the game and keeps his hand", () => {
      const seen: Seen[] = [];
      const r = revealed(ONE, "alterEgo", ALTER_HAND, picker({ pick: [EXHAUST], seen }));
      const chooses = asked(seen, "chooseOption");
      expect(chooses).toHaveLength(1);
      expect(chooses[0]!.labels[0]).toContain(EXHAUST);
      expect(chooses[0]!.labels[1]).toContain(DISCARD);
      expect(whereIs(r.state, r.id)).toBe("removedFromGame");
      expect(ofType(r.events, "cardExhausted").map((e) => e.instanceId)).toContain(identityOf(r.state));
      expect(ofType(r.events, "formChanged")).toEqual([]);
      for (const id of r.hand) expect(whereIs(r.state, id)).toBe("hand:p1");
    });
    it("the discard option: all five events leave his hand (a card of both types once), Scout Ahead stays, the obligation is discarded and Kurt Wagner stays ready", () => {
      const r = revealed(ONE, "alterEgo", ALTER_HAND, picker({ pick: [DISCARD] }));
      for (const id of r.hand.slice(0, 5)) expect(whereIs(r.state, id)).toBe("discard:p1");
      expect(whereIs(r.state, r.hand[5]!)).toBe("hand:p1");
      expect(whereIs(r.state, r.id)).toBe("encounterDiscard");
      expect(ofType(r.events, "cardExhausted").map((e) => e.instanceId)).not.toContain(identityOf(r.state));
    });
    it("the discard option with no Attack or Defense event in hand still discards the obligation and keeps the hand", () => {
      const r = revealed(ONE, "alterEgo", [...KEPT, "48003", "48004"], picker({ pick: [DISCARD] }));
      expect(whereIs(r.state, r.id)).toBe("encounterDiscard");
      for (const id of r.hand) expect(whereIs(r.state, id)).toBe("hand:p1");
    });
  });

  describe("two players: the Kurt Wagner player chooses, whoever reveals it", () => {
    it("Nightcrawler second, Spider-Man (seat 1) reveals it: it is Nightcrawler's choice and Nightcrawler's hand; Spider-Man's hand is untouched", () => {
      const seen: Seen[] = [];
      const base = alterEgoGame(TWO_NC_SECOND);
      const smHand = handOf(base, P1, ["48007", "48011", "48009"]);
      const nc = handOf(smHand.state, P2, ALTER_HAND);
      const id = findCard(nc.state, CRISIS);
      const r = reveal(nc.state, id, { to: P1, pick: picker({ pick: [DISCARD], seen }) });
      expect(asked(seen, "chooseOption").map((c) => c.player)).toEqual(["p2"]);
      expect(revealsOf(r.events, id).map((e) => e.playerId)).toEqual([P1]);
      for (const i of nc.ids.slice(0, 5)) expect(whereIs(r.state, i)).toBe("discard:p2");
      expect(whereIs(r.state, nc.ids[5]!)).toBe("hand:p2");
      for (const i of smHand.ids) expect(whereIs(r.state, i)).toBe("hand:p1");
      expect(whereIs(r.state, id)).toBe("encounterDiscard");
    });
    it("Nightcrawler first, Spider-Man (seat 2) reveals it: the choice and the discarded hand are Nightcrawler's again", () => {
      const seen: Seen[] = [];
      const base = alterEgoGame(TWO);
      const smHand = handOf(base, P2, ["48007", "48011", "48009"]);
      const nc = handOf(smHand.state, P1, ALTER_HAND);
      const id = findCard(nc.state, CRISIS);
      const r = reveal(nc.state, id, { to: P2, pick: picker({ pick: [DISCARD], seen }) });
      expect(asked(seen, "chooseOption").map((c) => c.player)).toEqual(["p1"]);
      expect(revealsOf(r.events, id).map((e) => e.playerId)).toEqual([P2]);
      for (const i of nc.ids.slice(0, 5)) expect(whereIs(r.state, i)).toBe("discard:p1");
      for (const i of smHand.ids) expect(whereIs(r.state, i)).toBe("hand:p2");
      expect(whereIs(r.state, id)).toBe("encounterDiscard");
    });
  });

  it("turned up as a boost card it counts its 2 boost icons (Rhino attacks at 2 + 2 = 4) and is discarded with no obligation effect", () => {
    const base = heroGame();
    const seen: Seen[] = [];
    const { state, events, id } = asBoost(base, findCard(base, CRISIS), picker({ seen }));
    expect(asked(seen, "chooseOption")).toEqual([]);
    const hit = attacksBy(events, state.activeVillainId!)[0]!;
    expect([hit.baseAtk, hit.boostIcons, hit.damageDealt]).toEqual([2, 2, 4]);
    expect(whereIs(state, id)).toBe("encounterDiscard");
  });
});

describe("the nemesis set enters by Shadow of the Past (01190)", () => {
  const shadow = (seats: readonly Seat[], hero = true) => {
    const s = hero ? heroGame(seats) : alterEgoGame(seats);
    const id = findCard(s, SHADOW_OF_THE_PAST);
    return { ...reveal(s, id, { pick: picker() }), s };
  };
  it("hero form: Azazel engages Nightcrawler and attacks at once (quickstrike, ATK 3, no boost card), Brimstone Dimension enters play with 5 threat, the rest of the set is shuffled into the encounter deck", () => {
    const { state, events, s } = shadow(ONE);
    const azazel = instancesOf(state, AZAZEL)[0]!;
    const dimension = instancesOf(state, DIMENSION)[0]!;
    expect(whereIs(state, azazel)).toBe("playArea:p1");
    expect(inst(state, azazel)).toMatchObject({ engagedWith: P1, faceup: true, damage: 0 });
    expect(state.villainArea).toContain(dimension);
    expect(inst(state, dimension).threat).toBe(5);
    expect(encounterDiscardCodes(state)).toContain(SHADOW_OF_THE_PAST);
    expect(setAsideCodes(state)).toEqual([]);
    expect(count(encounterDeckCodes(state), SWORD)).toBe(1);
    expect(count(encounterDeckCodes(state), STRIKE)).toBe(2);
    expect(count(encounterDeckCodes(s), SWORD)).toBe(0);
    const hit = attacksBy(events, azazel);
    expect(hit.map((e) => [e.baseAtk, e.boostIcons, e.damageDealt])).toEqual([[3, 0, 3]]);
    expect(ofType(events, "boostCardDealt").filter((e) => e.enemyInstanceId === azazel)).toEqual([]);
  });
  it("alter-ego form: Azazel engages Nightcrawler and does not attack (quickstrike needs a hero)", () => {
    const { state, events } = shadow(ONE, false);
    const azazel = instancesOf(state, AZAZEL)[0]!;
    expect(inst(state, azazel).engagedWith).toBe(P1);
    expect(attacksBy(events, azazel)).toEqual([]);
  });
  it("Brimstone Dimension has 5 starting threat at 1 player and at 2 players (a flat 5)", () => {
    const one = shadow(ONE).state;
    expect(inst(one, instancesOf(one, DIMENSION)[0]!).threat).toBe(5);
    const two = shadow(TWO).state;
    expect(inst(two, instancesOf(two, DIMENSION)[0]!).threat).toBe(5);
    expect(two.villainArea).toContain(instancesOf(two, DIMENSION)[0]!);
  });
  it("two players: Nightcrawler is seat 1, Azazel engages the revealing seat 1; the other seat's set-aside area is untouched", () => {
    const { state } = shadow(TWO);
    expect(setAsideCodes(state, P1).filter((c) => NEMESIS_CODES.includes(c))).toEqual([]);
    expect(inst(state, instancesOf(state, AZAZEL)[0]!).engagedWith).toBe(P1);
  });
});

/** Azazel: the set-aside copy of the game, wherever the test put him. */
const azazelOf = (s: GameState): InstanceId => findCard(s, AZAZEL);
/** A spare instance of the encounter deck relabeled as a Mercenary (01101, a minion with 3 hit points), engaged with `to`. */
function withMercenary(s: GameState, to: PlayerId = P1): { state: GameState; id: InstanceId } {
  const spare = s.encounterDecks[activeEncounterDeckId(s)]!.deck.find(
    (i) => ![CRISIS, SHADOW_OF_THE_PAST].includes(codeOf(s, i)),
  )!;
  return { state: put(relabel(s, spare, MERCENARY), spare, "play", { to }), id: spare };
}
/** Azazel's Sword attached to `host` (surgery: the card leaves wherever it was and hangs off the enemy). */
function withSwordOn(s: GameState, host: InstanceId): { state: GameState; id: InstanceId } {
  const id = findCard(s, SWORD);
  const out = put(s, id, "villain");
  const detached: GameState = { ...out, villainArea: out.villainArea.filter((i) => i !== id) };
  const hung = patchInstance(detached, id, { attachedTo: host, faceup: true });
  return { state: patchInstance(hung, host, { attachments: [...inst(hung, host).attachments, id] }), id };
}
/** The state in the player phase with Azazel in play engaged with `to`, taking `damage`. */
const withAzazel = (s: GameState, to: PlayerId = P1, damage = 0) => {
  const id = azazelOf(s);
  return { state: put(s, id, "play", { to, damage }), id };
};

describe("Azazel (48027)", () => {
  it("in play he has SCH 2, ATK 3, 3 hit points", () => {
    const { state, id } = withAzazel(heroGame());
    const p = profile(state, id);
    expect([p.sch, p.atk, p.maxHp]).toEqual([2, 3, 3]);
  });
  it("hero form: he attacks Nightcrawler for ATK 3 + 0 boost icons, and is dealt no boost card (he is not villainous)", () => {
    const { state: s, id } = withAzazel(heroGame());
    const { events } = run(quiet(s, 1, 1), firstLegal, ...endPhase(s));
    expect(attacksBy(events, id).map((e) => [e.baseAtk, e.boostIcons, e.damageDealt])).toEqual([[3, 0, 3]]);
    expect(ofType(events, "boostCardDealt").filter((e) => e.enemyInstanceId === id)).toEqual([]);
    expect(schemesBy(events, id)).toEqual([]);
  });
  it("alter-ego form: he schemes for SCH 2 + 0 boost icons = 2 threat on the main scheme, with no boost card", () => {
    const { state: s, id } = withAzazel(alterEgoGame());
    const { events } = run(quiet(s, 1, 1), firstLegal, ...endPhase(s));
    expect(schemesBy(events, id).map((e) => [e.baseSch, e.boostIcons, e.threatPlaced])).toEqual([[2, 0, 2]]);
    expect(ofType(events, "boostCardDealt").filter((e) => e.enemyInstanceId === id)).toEqual([]);
    expect(attacksBy(events, id)).toEqual([]);
  });

  describe("cannot have upgrades attached", () => {
    /** Nightcrawler in hero form with Azazel and a Mercenary engaged, and the card `code` in his hand (a 0-cost upgrade). */
    function holding(code: string) {
      const base = withMercenary(withAzazel(heroGame()).state);
      const hand = handOf(base.state, P1, [code]);
      return { ...hand, azazel: azazelOf(hand.state), rhino: hand.state.activeVillainId!, mercenary: base.id };
    }
    const playOn = (id: InstanceId, host: InstanceId): Command => play(P1, id, [], { attachToInstanceId: host });
    it("Bamf! cannot be played on Azazel, and can be played on Rhino and on another minion (the same card, the same turn)", () => {
      const h = holding(BAMF);
      expect(accepted(h.state, playOn(h.ids[0]!, h.azazel))).toBe(false);
      expect(accepted(h.state, playOn(h.ids[0]!, h.rhino))).toBe(true);
      expect(accepted(h.state, playOn(h.ids[0]!, h.mercenary))).toBe(true);
    });
    it("Under Control (an upgrade for a minion) cannot be played on Azazel either, only on the Mercenary", () => {
      const h = holding(UNDER_CONTROL);
      expect(accepted(h.state, playOn(h.ids[0]!, h.azazel))).toBe(false);
      expect(accepted(h.state, playOn(h.ids[0]!, h.mercenary))).toBe(true);
      const { state } = run(h.state, firstLegal, playOn(h.ids[0]!, h.mercenary));
      expect(inst(state, h.ids[0]!).attachedTo).toBe(h.mercenary);
    });
    it("Daytripper's Bamf! goes to another enemy: Azazel is never offered as the host (a picker that prefers him still cannot choose him), and he takes none of her 1 damage", () => {
      const h = holding(DAYTRIPPER);
      const paid = handOf(h.state, P1, [DAYTRIPPER, "01088", "01088"]);
      const seen: Seen[] = [];
      const { state } = run(
        paid.state,
        picker({ pick: ["48002.daytripper-response", h.azazel], seen }),
        play(P1, paid.ids[0]!, paid.ids.slice(1)),
      );
      const bamfs = (enemy: InstanceId) => inst(state, enemy).attachments.filter((a) => codeOf(state, a) === BAMF);
      expect(bamfs(h.azazel)).toEqual([]);
      expect(bamfs(h.rhino).length + bamfs(h.mercenary).length).toBe(1);
      expect(seen.flatMap((p) => p.options)).not.toContain(h.azazel);
      expect(damageOf(state, h.azazel)).toBe(0);
    });
    it("Azazel's own Sword, an encounter attachment, is not an upgrade and attaches to him (see the Sword)", () => {
      const s = withAzazel(heroGame());
      const sword = withSwordOn(s.state, s.id);
      expect(inst(sword.state, sword.id).attachedTo).toBe(s.id);
    });
  });

  describe("[star] Boost: deal Azazel to the Kurt Wagner player as a facedown encounter card", () => {
    it("Nightcrawler alone: the boost card Azazel adds 0 icons (Rhino attacks for 2), is dealt to him, and is revealed in step 4 of the same villain phase: engaged, at full hit points, and quickstrike attacks for 3", () => {
      const s = heroGame();
      const id = azazelOf(s);
      const staged = stageDeck(s, [id, "deal"]);
      const { state, events } = run(staged, firstLegal, ...endPhase(staged));
      const rhino = attacksBy(events, state.activeVillainId!)[0]!;
      expect([rhino.baseAtk, rhino.boostIcons, rhino.damageDealt]).toEqual([2, 0, 2]);
      expect(revealsOf(events, id).map((e) => e.playerId)).toEqual([P1]);
      expect(whereIs(state, id)).toBe("playArea:p1");
      expect(inst(state, id)).toMatchObject({ engagedWith: P1, faceup: true, damage: 0 });
      expect(attacksBy(events, id).map((e) => [e.baseAtk, e.boostIcons, e.damageDealt])).toEqual([[3, 0, 3]]);
    });
    it("Kurt Wagner in alter-ego form: Azazel as the boost card of Rhino's scheme (0 icons) is dealt to him all the same, revealed engaged, and does not quickstrike", () => {
      const s = alterEgoGame();
      const id = azazelOf(s);
      const staged = stageDeck(s, [id, "deal"]);
      const { state, events } = run(staged, firstLegal, ...endPhase(staged));
      expect(schemesBy(events, state.activeVillainId!).map((e) => [e.baseSch, e.boostIcons])).toEqual([[1, 0]]);
      expect(revealsOf(events, id).map((e) => e.playerId)).toEqual([P1]);
      expect(inst(state, id)).toMatchObject({ engagedWith: P1, faceup: true });
      expect(attacksBy(events, id)).toEqual([]);
    });
    it("two players, Nightcrawler first: Azazel boosts Rhino's attack on Spider-Man (seat 2) and is dealt to Nightcrawler (seat 1), not to the attacked player", () => {
      const s = heroGame(TWO);
      const id = azazelOf(s);
      const staged = stageDeck(s, ["boost", id, "deal", "deal"]);
      const { state, events } = run(staged, firstLegal, ...endPhase(staged));
      expect(revealsOf(events, id).map((e) => e.playerId)).toEqual([P1]);
      expect(inst(state, id).engagedWith).toBe(P1);
      expect(whereIs(state, id)).toBe("playArea:p1");
    });
    it("two players, Nightcrawler second: Azazel boosts Rhino's attack on Spider-Man (seat 1) and is dealt to Nightcrawler (seat 2)", () => {
      const s = heroGame(TWO_NC_SECOND);
      const id = azazelOf(s);
      const staged = stageDeck(s, [id, "boost", "deal", "deal"]);
      const { state, events } = run(staged, firstLegal, ...endPhase(staged));
      expect(revealsOf(events, id).map((e) => e.playerId)).toEqual([P2]);
      expect(inst(state, id).engagedWith).toBe(P2);
      expect(whereIs(state, id)).toBe("playArea:p2");
    });
    it("two players, Nightcrawler second, Azazel boosts the attack on Nightcrawler himself: he is still dealt to Nightcrawler", () => {
      const s = heroGame(TWO_NC_SECOND);
      const id = azazelOf(s);
      const staged = stageDeck(s, ["boost", id, "deal", "deal"]);
      const { state, events } = run(staged, firstLegal, ...endPhase(staged));
      expect(revealsOf(events, id).map((e) => e.playerId)).toEqual([P2]);
      expect(whereIs(state, id)).toBe("playArea:p2");
    });
  });
});

describe("Brimstone Dimension (48028)", () => {
  /** Dimension in play with `threat`, as the villain area's side scheme. */
  const withDimension = (s: GameState, threat = 1) => {
    const id = findCard(s, DIMENSION);
    return { state: put(s, id, "villain", { threat }), id };
  };
  const thwart = (s: GameState, by: PlayerId, scheme: InstanceId): Command => ({
    type: "basicThwart",
    playerId: by,
    thwarterInstanceId: identityOf(s, by),
    schemeInstanceId: scheme,
  });
  /**
   * Heroes, Dimension at 1 threat, Azazel put by `where` (`undefined`: left in the set-aside area), optionally with the
   * Sword hanging off him. `by` removes the last threat with a real basic thwart. Returns the state right after.
   */
  function defeated(
    seats: readonly Seat[],
    where: Where | undefined,
    o: { by?: PlayerId; azazelTo?: PlayerId; damage?: number; sword?: boolean } = {},
  ) {
    const by = o.by ?? P1;
    let s = heroGame(seats);
    const dimension = withDimension(s);
    s = dimension.state;
    const azazel = azazelOf(s);
    if (where) s = put(s, azazel, where, { to: o.azazelTo ?? P1, damage: o.damage ?? 0 });
    let sword: InstanceId | undefined;
    if (o.sword) {
      const hung = withSwordOn(s, azazel);
      s = hung.state;
      sword = hung.id;
    }
    const done = run(s, picker(), ...waitFor(s, by), thwart(s, by, dimension.id));
    return { ...done, azazel, dimension: dimension.id, sword, before: s, by };
  }
  /** The villain phase after the defeat: quiet cards on top (Rhino's boost, one dealt filler per seat). */
  const villainPhase = (s: GameState) => endPlayerPhase(quiet(s), picker());
  const dealtTo = (s: GameState, p: PlayerId) => playerOf(s, p).dealtEncounter;

  it("is a side scheme with 5 starting threat at 1 player and at 2 players (Shadow of the Past puts it into play)", () => {
    // Covered where the set enters play: `the nemesis set enters by Shadow of the Past`.
    expect(DATA(DIMENSION).startingThreat).toEqual({ base: 5, perPlayer: 0 });
  });
  it("turned up as a boost card it counts its 3 boost icons (Rhino attacks at 2 + 3 = 5) and is discarded", () => {
    const base = heroGame();
    const dimension = findCard(base, DIMENSION);
    const { state, events } = asBoost(base, dimension);
    const hit = attacksBy(events, state.activeVillainId!)[0]!;
    expect([hit.baseAtk, hit.boostIcons, hit.damageDealt]).toEqual([2, 3, 5]);
    expect(whereIs(state, dimension)).toBe("encounterDiscard");
  });

  describe("its hazard icon: one additional encounter card is dealt in step 3 of the villain phase (RRG p. 21: one card in all, to the first player, not one per player)", () => {
    /** The cards dealt to `p` in step 3: the moves to their dealt cards before the first card is revealed. */
    const dealt = (events: readonly GameEvent[], p: PlayerId): number => {
      const firstReveal = events.findIndex((e) => e.type === "encounterCardRevealed");
      return events
        .slice(0, firstReveal)
        .filter((e) => e.type === "cardMoved" && e.to.kind === "dealtEncounter" && e.to.playerId === p).length;
    };
    it("Nightcrawler alone: 2 cards with it in play, 1 without", () => {
      const s = heroGame();
      expect(dealt(run(quiet(s, 1, 1), firstLegal, ...endPhase(s)).events, P1)).toBe(1);
      const withIt = withDimension(s, 5).state;
      expect(dealt(run(quiet(withIt, 1, 2), firstLegal, ...endPhase(withIt)).events, P1)).toBe(2);
    });
    it("two players: the first player (seat 1) is dealt 2 cards and the other seat 1 with it in play; 1 each without", () => {
      const s = heroGame(TWO);
      const plain = run(quiet(s, 2, 2), firstLegal, ...endPhase(s)).events;
      expect([dealt(plain, P1), dealt(plain, P2)]).toEqual([1, 1]);
      const withIt = withDimension(s, 5).state;
      const hazard = run(quiet(withIt, 2, 3), firstLegal, ...endPhase(withIt)).events;
      expect([dealt(hazard, P1), dealt(hazard, P2)]).toEqual([2, 1]);
    });
  });

  describe("When Defeated: the defeating player finds Azazel and deals him to themself as a facedown encounter card", () => {
    it("Azazel in the encounter deck: he is dealt facedown to Nightcrawler, the deck is shuffled, and he is revealed in the next villain phase: engaged, 3 hit points, quickstrike attack for 3", () => {
      const r = defeated(ONE, "deck");
      expect(dealtTo(r.state, P1)).toEqual([r.azazel]);
      expect(inst(r.state, r.azazel)).toMatchObject({ faceup: false, damage: 0, engagedWith: null });
      expect(ofType(r.events, "cardFound").map((e) => [e.instanceId, e.deckShuffled])).toEqual([[r.azazel, true]]);
      expect(r.state.villainArea).not.toContain(r.dimension);
      const v = villainPhase(r.state);
      expect(revealsOf(v.events, r.azazel).map((e) => e.playerId)).toEqual([P1]);
      expect(whereIs(v.state, r.azazel)).toBe("playArea:p1");
      expect(inst(v.state, r.azazel)).toMatchObject({ engagedWith: P1, faceup: true, damage: 0 });
      expect(profile(v.state, r.azazel).maxHp).toBe(3);
      expect(attacksBy(v.events, r.azazel).map((e) => [e.baseAtk, e.damageDealt])).toEqual([[3, 3]]);
    });
    it("Azazel in the encounter discard pile: he is found there and dealt (no deck is shuffled)", () => {
      const r = defeated(ONE, "discard");
      expect(dealtTo(r.state, P1)).toEqual([r.azazel]);
      expect(ofType(r.events, "cardFound").map((e) => [e.instanceId, e.deckShuffled])).toEqual([[r.azazel, false]]);
    });
    it("Azazel still in the set-aside area (before any Shadow of the Past): a find reaches it, so he is dealt", () => {
      const r = defeated(ONE, undefined);
      expect(dealtTo(r.state, P1)).toEqual([r.azazel]);
    });
    it("Azazel in play engaged with Nightcrawler, with 2 damage and the Sword: he leaves play undefeated, the Sword and his damage stay behind, he is dealt facedown and comes back at full hit points", () => {
      const r = defeated(ONE, "play", { damage: 2, sword: true });
      expect(whereIs(r.state, r.azazel)).toBe("dealtEncounter:p1");
      expect(inst(r.state, r.azazel)).toMatchObject({ faceup: false, damage: 0, engagedWith: null, attachments: [] });
      expect(whereIs(r.state, r.sword!)).toBe("encounterDiscard");
      expect(ofType(r.events, "characterDefeated")).toEqual([]);
      expect(r.state.victoryDisplay).not.toContain(r.azazel);
      const v = villainPhase(r.state);
      expect(whereIs(v.state, r.azazel)).toBe("playArea:p1");
      expect(inst(v.state, r.azazel)).toMatchObject({ damage: 0, engagedWith: P1 });
      expect(attacksBy(v.events, r.azazel).map((e) => [e.baseAtk, e.damageDealt])).toEqual([[3, 3]]);
      expect(ofType(v.events, "characterDefeated")).toEqual([]);
    });
    it("two players: Azazel engaged with the other seat, Nightcrawler (seat 1) defeats it: he is dealt to Nightcrawler, not the seat he was engaged with, and engages Nightcrawler next villain phase", () => {
      const r = defeated(TWO, "play", { azazelTo: P2, damage: 2 });
      expect(whereIs(r.state, r.azazel)).toBe("dealtEncounter:p1");
      expect(dealtTo(r.state, P2)).toEqual([]);
      expect(playerOf(r.state, P2).playArea).not.toContain(r.azazel);
      const v = villainPhase(r.state);
      expect(whereIs(v.state, r.azazel)).toBe("playArea:p1");
      expect(inst(v.state, r.azazel)).toMatchObject({ damage: 0, engagedWith: P1 });
    });
    it("two players: Spider-Man (seat 2) defeats it, Azazel in the encounter deck: he is dealt to Spider-Man, the defeating player, and engages Spider-Man in step 4", () => {
      const r = defeated(TWO, "deck", { by: P2 });
      expect(dealtTo(r.state, P2)).toEqual([r.azazel]);
      expect(dealtTo(r.state, P1)).toEqual([]);
      const v = villainPhase(r.state);
      expect(revealsOf(v.events, r.azazel).map((e) => e.playerId)).toEqual([P2]);
      expect(inst(v.state, r.azazel)).toMatchObject({ engagedWith: P2, faceup: true });
      expect(attacksBy(v.events, r.azazel).map((e) => e.targetInstanceId)).toEqual([identityOf(v.state, P2)]);
    });
    it("two players: Spider-Man defeats it with Azazel in play engaged with Nightcrawler: he is dealt to Spider-Man", () => {
      const r = defeated(TWO, "play", { by: P2, azazelTo: P1, damage: 1 });
      expect(whereIs(r.state, r.azazel)).toBe("dealtEncounter:p2");
      const v = villainPhase(r.state);
      expect(inst(v.state, r.azazel)).toMatchObject({ engagedWith: P2, damage: 0 });
    });
    it("Azazel in the victory display: he is not found and nothing is dealt", () => {
      const r = defeated(TWO, "victory");
      expect(whereIs(r.state, r.azazel)).toBe("victoryDisplay");
      expect([dealtTo(r.state, P1), dealtTo(r.state, P2)]).toEqual([[], []]);
      expect(ofType(r.events, "cardFound")).toEqual([]);
    });
    it("Azazel removed from the game: he is not found and nothing is dealt", () => {
      const r = defeated(TWO, "removed");
      expect(whereIs(r.state, r.azazel)).toBe("removedFromGame");
      expect([dealtTo(r.state, P1), dealtTo(r.state, P2)]).toEqual([[], []]);
    });
    it("Azazel already facedown in front of the other seat: a find does not reach a dealt card, so he stays there and nothing is dealt to the defeating player", () => {
      const r = defeated(TWO, "dealt", { azazelTo: P2 });
      expect(dealtTo(r.state, P1)).toEqual([]);
      expect(dealtTo(r.state, P2)).toEqual([r.azazel]);
      expect(ofType(r.events, "cardFound")).toEqual([]);
    });
  });
});

/** Rhino's next activation is stunned away (no attack, no scheme), so only the minions act in the villain phase. */
const rhinoStunned = (s: GameState): GameState =>
  patchInstance(s, s.activeVillainId!, { statuses: { ...inst(s, s.activeVillainId!).statuses, stunned: 1 } });
/** A tough status card on `p`'s identity. */
const withTough = (s: GameState, p: PlayerId = P1): GameState =>
  patchInstance(s, identityOf(s, p), { statuses: { ...inst(s, identityOf(s, p)).statuses, tough: 1 } });
const toughOf = (s: GameState, p: PlayerId = P1): number => inst(s, identityOf(s, p)).statuses.tough;

describe("Azazel's Sword (48029)", () => {
  describe("Attach to Azazel. Otherwise, attach to the villain.", () => {
    it("with Azazel in play it attaches to him, and he keeps the Sword", () => {
      const { state: s, id: azazel } = withAzazel(heroGame());
      const sword = findCard(s, SWORD);
      const r = reveal(s, sword);
      expect(inst(r.state, sword).attachedTo).toBe(azazel);
      expect(inst(r.state, azazel).attachments).toContain(sword);
      expect(r.state.activeVillainId && inst(r.state, r.state.activeVillainId).attachments).not.toContain(sword);
    });
    it.each<[string, Where | undefined]>([
      ["in the encounter deck", "deck"],
      ["in the encounter discard pile", "discard"],
      ["in the victory display", "victory"],
      ["still set aside", undefined],
    ])("with Azazel %s (not in play) it attaches to the villain", (_where, where) => {
      const base = heroGame();
      const s = where ? put(base, azazelOf(base), where) : base;
      const sword = findCard(s, SWORD);
      const r = reveal(s, sword);
      expect(inst(r.state, sword).attachedTo).toBe(r.state.activeVillainId);
    });
    it("with Azazel facedown in front of the other seat (out of play) it attaches to the villain", () => {
      const base = heroGame(TWO);
      const s = put(base, azazelOf(base), "dealt", { to: P2 });
      const sword = findCard(s, SWORD);
      const r = reveal(s, sword);
      expect(inst(r.state, sword).attachedTo).toBe(r.state.activeVillainId);
    });
  });

  describe("the attached enemy's attacks: +1 ATK and piercing (RRG Piercing: the tough status card is discarded before damage)", () => {
    /** Azazel in play engaged with Nightcrawler, who carries a tough status card; Rhino stunned (his attack would spend it). */
    function azazelHits(sword: "azazel" | "rhino" | "none") {
      const { state: s0, id } = withAzazel(heroGame());
      const armed = sword === "none" ? s0 : withSwordOn(s0, sword === "azazel" ? id : s0.activeVillainId!).state;
      const s = withTough(rhinoStunned(armed));
      const r = run(quiet(s, 1, 1), picker(), ...endPhase(s));
      return { ...r, azazel: id };
    }
    it("the Sword on Azazel: ATK 3 + 1 = 4, his attack discards Nightcrawler's tough status card and deals all 4", () => {
      const r = azazelHits("azazel");
      expect(attacksBy(r.events, r.azazel).map((e) => [e.baseAtk, e.boostIcons])).toEqual([[4, 0]]);
      expect(toughOf(r.state)).toBe(0);
      expect(damageOf(r.state, identityOf(r.state))).toBe(4);
    });
    it("without it (control): ATK 3, the tough status card prevents the damage and is discarded", () => {
      const r = azazelHits("none");
      expect(attacksBy(r.events, r.azazel).map((e) => e.baseAtk)).toEqual([3]);
      expect(toughOf(r.state)).toBe(0);
      expect(damageOf(r.state, identityOf(r.state))).toBe(0);
    });
    it("only the attached enemy's attacks: the Sword on a stunned Rhino gives Azazel no piercing, so the tough status card stops his 3", () => {
      const r = azazelHits("rhino");
      expect(attacksBy(r.events, r.azazel).map((e) => e.baseAtk)).toEqual([3]);
      expect(damageOf(r.state, identityOf(r.state))).toBe(0);
    });
    it("on the villain (Azazel not in play): Rhino attacks at ATK 2 + 1 = 3 and the tough status card does not stop it", () => {
      const s0 = heroGame();
      const s = withTough(withSwordOn(s0, s0.activeVillainId!).state);
      const r = run(quiet(s, 1, 1), picker(), ...endPhase(s));
      expect(attacksBy(r.events, s.activeVillainId!).map((e) => [e.baseAtk, e.boostIcons])).toEqual([[3, 0]]);
      expect(damageOf(r.state, identityOf(r.state))).toBe(3);
      expect(toughOf(r.state)).toBe(0);
    });
    it("without the Sword on the villain (control): Rhino's 2 is stopped by the tough status card", () => {
      const s = withTough(heroGame());
      const r = run(quiet(s, 1, 1), picker(), ...endPhase(s));
      expect(damageOf(r.state, identityOf(r.state))).toBe(0);
    });
  });

  describe("Hero Response: after the attached enemy attacks you, discard 1 random card from your hand, discard this card", () => {
    const FOUR = ["48009", "48010", "48003", "48004"];
    /** The Sword on Rhino, `hands` staged, Rhino attacks (a villain phase), choices answered by `pick`. */
    function attacked(
      seats: readonly Seat[],
      hands: Partial<Record<PlayerId, readonly string[]>>,
      pick: Picker,
      o: { emptyHands?: boolean } = {},
    ) {
      let s = heroGame(seats);
      for (const [p, codes] of Object.entries(hands) as [PlayerId, readonly string[]][]) s = handOf(s, p, codes).state;
      const sword = withSwordOn(s, s.activeVillainId!);
      const midway = o.emptyHands
        ? (st: GameState): GameState => ({
            ...st,
            players: st.players.map((p) => ({ ...p, deck: [...p.deck, ...p.hand], hand: [] })),
          })
        : undefined;
      const r = runVillainPhase(quiet(sword.state), pick, midway);
      return { ...r, sword: sword.id, rhino: s.activeVillainId! };
    }
    it("accepted: one card of his hand is discarded at random and the Sword goes to the encounter discard pile", () => {
      const seen: Seen[] = [];
      const r = attacked(ONE, { [P1]: FOUR }, picker({ pick: [SWORD_RESPONSE], seen }));
      const offered = asked(seen, "chooseTriggers").filter((p) => p.options.some((o) => o.endsWith(SWORD_RESPONSE)));
      expect(offered.map((p) => p.player)).toEqual(["p1"]);
      const discards = discarded(r.events, P1);
      expect(discards).toHaveLength(1);
      expect(whereIs(r.state, discards[0]!)).toBe("discard:p1");
      expect(whereIs(r.state, r.sword)).toBe("encounterDiscard");
    });
    it("declined (it is optional): nothing is discarded and the Sword stays on Rhino, offered again after his next attack", () => {
      const seen: Seen[] = [];
      const r = attacked(ONE, { [P1]: FOUR }, picker({ seen }));
      expect(discarded(r.events, P1)).toEqual([]);
      expect(inst(r.state, r.sword).attachedTo).toBe(r.rhino);
      const again = run(quiet(r.state, 1, 1), picker({ pick: [SWORD_RESPONSE], seen }), ...endPhase(r.state));
      expect(discarded(again.events, P1)).toHaveLength(1);
      expect(whereIs(again.state, r.sword)).toBe("encounterDiscard");
    });
    it("an empty hand cannot pay the cost: the response is not offered and the Sword stays", () => {
      const seen: Seen[] = [];
      const r = attacked(ONE, {}, picker({ pick: [SWORD_RESPONSE], seen }), { emptyHands: true });
      expect(seen.some((p) => p.options.some((o) => o.endsWith(SWORD_RESPONSE)))).toBe(false);
      expect(inst(r.state, r.sword).attachedTo).toBe(r.rhino);
    });
    it("two players: it is offered to each attacked player; the Spider-Man seat accepts and discards from its own hand, Nightcrawler's hand is untouched", () => {
      const seen: Seen[] = [];
      const pick: Picker = (st) => {
        const c = st.pendingChoice!;
        const mine = c.options.find((o) => o.optionId.endsWith(SWORD_RESPONSE));
        if (c.prompt.kind === "chooseTriggers" && mine && c.playerId === P2) {
          seen.push({ kind: c.prompt.kind, player: "accepted:p2", options: [], labels: [] });
          return [mine.optionId];
        }
        return picker({ seen })(st);
      };
      const r = attacked(TWO, { [P1]: FOUR, [P2]: FOUR }, pick);
      const offeredTo = asked(seen, "chooseTriggers")
        .filter((p) => p.options.some((o) => o.endsWith(SWORD_RESPONSE)))
        .map((p) => p.player);
      expect(offeredTo).toEqual(["p1"]);
      expect(seen.filter((p) => p.player === "accepted:p2")).toHaveLength(1);
      expect(discarded(r.events, P2)).toHaveLength(1);
      expect(discarded(r.events, P1)).toEqual([]);
      expect(whereIs(r.state, r.sword)).toBe("encounterDiscard");
    });
  });

  it("turned up as a boost card it counts its 2 boost icons (Rhino attacks at 2 + 2 = 4) and is discarded, not attached", () => {
    const base = heroGame();
    const sword = findCard(base, SWORD);
    const { state, events } = asBoost(base, sword);
    const hit = attacksBy(events, state.activeVillainId!)[0]!;
    expect([hit.baseAtk, hit.boostIcons, hit.damageDealt]).toEqual([2, 2, 4]);
    expect(whereIs(state, sword)).toBe("encounterDiscard");
  });
});

describe("Brimstone Strike (48030)", () => {
  const strikeOf = (s: GameState) => findCard(s, STRIKE);
  const azazelHits = (events: readonly GameEvent[], azazel: InstanceId, at: InstanceId) =>
    attacksBy(events, azazel).filter((e) => e.targetInstanceId === at);

  describe("When Revealed (Hero): find Azazel and reveal him", () => {
    it("Azazel in the encounter deck: he enters play engaged with Nightcrawler at full hit points and quickstrikes (ATK 3), and does not scheme", () => {
      const s = put(heroGame(), azazelOf(heroGame()), "deck");
      const azazel = azazelOf(s);
      const r = reveal(s, strikeOf(s));
      expect(whereIs(r.state, r.id)).toBe("encounterDiscard");
      expect(revealsOf(r.events, azazel).map((e) => e.playerId)).toEqual([P1]);
      expect(inst(r.state, azazel)).toMatchObject({ engagedWith: P1, faceup: true, damage: 0 });
      expect(attacksBy(r.events, azazel).map((e) => [e.baseAtk, e.boostIcons, e.damageDealt])).toEqual([[3, 0, 3]]);
      expect(schemesBy(r.events, azazel)).toEqual([]);
    });
    it("Azazel in the encounter discard pile or still set aside: found and revealed the same way", () => {
      for (const where of ["discard", undefined] as const) {
        const base = heroGame();
        const s = where ? put(base, azazelOf(base), where) : base;
        const azazel = azazelOf(s);
        const r = reveal(s, strikeOf(s));
        expect(whereIs(r.state, azazel)).toBe("playArea:p1");
        expect(attacksBy(r.events, azazel).map((e) => e.damageDealt)).toEqual([3]);
      }
    });
    it("Azazel in play engaged with the other seat, with 2 damage and the Sword: he moves to the revealing seat keeping both, and quickstrikes it for ATK 3 + 1 = 4 (no new entry into play)", () => {
      const { state: s0, id: azazel } = withAzazel(heroGame(TWO), P2, 2);
      const sword = withSwordOn(s0, azazel);
      const strike = strikeOf(sword.state);
      const r = reveal(sword.state, strike);
      expect(inst(r.state, azazel)).toMatchObject({ engagedWith: P1, damage: 2, faceup: true });
      expect(whereIs(r.state, azazel)).toBe("playArea:p1");
      expect(inst(r.state, sword.id).attachedTo).toBe(azazel);
      expect(announced(r.events, "cardEntersPlay", azazel)).toEqual([]);
      expect(ofType(r.events, "revealedInPlay").filter((e) => e.instanceId === azazel)).toMatchObject([
        { playerId: P1, engaged: true },
      ]);
      expect(azazelHits(r.events, azazel, identityOf(r.state, P1)).map((e) => [e.baseAtk, e.damageDealt])).toEqual([
        [4, 4],
      ]);
    });
    it("Azazel already engaged with the revealing player: he is revealed where he is and does not quickstrike again (RRG p. 19: not newly engaged); his one attack is the villain phase's own", () => {
      const { state: s, id: azazel } = withAzazel(heroGame());
      const r = reveal(s, strikeOf(s));
      expect(ofType(r.events, "revealedInPlay").filter((e) => e.instanceId === azazel)).toMatchObject([
        { playerId: P1, engaged: false },
      ]);
      expect(attacksBy(r.events, azazel)).toHaveLength(1);
    });
    it("Azazel in the victory display: not found, nothing happens to him and Brimstone Strike is discarded", () => {
      const base = heroGame();
      const s = put(base, azazelOf(base), "victory");
      const azazel = azazelOf(s);
      const r = reveal(s, strikeOf(s));
      expect(whereIs(r.state, azazel)).toBe("victoryDisplay");
      expect(whereIs(r.state, r.id)).toBe("encounterDiscard");
      expect(attacksBy(r.events, azazel)).toEqual([]);
    });
  });

  describe("When Revealed (Alter-Ego): find Azazel and reveal him. He schemes.", () => {
    it("Azazel in the encounter deck: he enters play engaged with Kurt Wagner and schemes for SCH 2 + 0 boost icons = 2 threat (no boost card, no attack)", () => {
      const base = alterEgoGame();
      const s = put(base, azazelOf(base), "deck");
      const azazel = azazelOf(s);
      const r = reveal(s, strikeOf(s));
      expect(inst(r.state, azazel)).toMatchObject({ engagedWith: P1, faceup: true });
      expect(schemesBy(r.events, azazel).map((e) => [e.baseSch, e.boostIcons, e.threatPlaced])).toEqual([[2, 0, 2]]);
      expect(ofType(r.events, "boostCardDealt").filter((e) => e.enemyInstanceId === azazel)).toEqual([]);
      expect(attacksBy(r.events, azazel)).toEqual([]);
    });
    it("Azazel already in play: he schemes once on his own (step 2) and once more for the Strike", () => {
      const { state: s, id: azazel } = withAzazel(alterEgoGame());
      const r = reveal(s, strikeOf(s));
      expect(schemesBy(r.events, azazel).map((e) => e.threatPlaced)).toEqual([2, 2]);
    });
    it("Azazel in the victory display: not found, so nobody schemes", () => {
      const base = alterEgoGame();
      const s = put(base, azazelOf(base), "victory");
      const azazel = azazelOf(s);
      const r = reveal(s, strikeOf(s));
      expect(schemesBy(r.events, azazel)).toEqual([]);
      expect(whereIs(r.state, azazel)).toBe("victoryDisplay");
    });
    it("two players: Azazel facedown in front of the other seat is not found; Strike schemes nothing, and he is revealed to that seat in step 4", () => {
      const base = alterEgoGame(TWO);
      const s = put(base, azazelOf(base), "dealt", { to: P2 });
      const azazel = azazelOf(s);
      const r = reveal(s, strikeOf(s));
      expect(ofType(r.events, "cardFound")).toEqual([]);
      expect(schemesBy(r.events, azazel)).toEqual([]);
      expect(revealsOf(r.events, azazel).map((e) => e.playerId)).toEqual([P2]);
      expect(inst(r.state, azazel).engagedWith).toBe(P2);
    });
  });

  describe("two players, Nightcrawler second: 'you' is the player who reveals it", () => {
    it("Spider-Man (seat 1) in alter-ego form reveals it: Azazel engages Spider-Man, not Nightcrawler, and schemes", () => {
      const base = withForm(heroGame(TWO_NC_SECOND), "alterEgo", P1);
      const s = put(base, azazelOf(base), "deck");
      const azazel = azazelOf(s);
      const r = reveal(s, strikeOf(s));
      expect(inst(r.state, azazel)).toMatchObject({ engagedWith: P1, faceup: true });
      expect(whereIs(r.state, azazel)).toBe("playArea:p1");
      expect(schemesBy(r.events, azazel).map((e) => e.threatPlaced)).toEqual([2]);
    });
    it("Spider-Man (seat 1) in hero form reveals it: Azazel engages and quickstrikes Spider-Man for 3", () => {
      const base = heroGame(TWO_NC_SECOND);
      const s = put(base, azazelOf(base), "deck");
      const azazel = azazelOf(s);
      const r = reveal(s, strikeOf(s));
      expect(whereIs(r.state, azazel)).toBe("playArea:p1");
      expect(azazelHits(r.events, azazel, identityOf(r.state, P1)).map((e) => [e.baseAtk, e.damageDealt])).toEqual([
        [3, 3],
      ]);
      expect(azazelHits(r.events, azazel, identityOf(r.state, P2))).toEqual([]);
    });
  });

  it("turned up as a boost card it counts its 1 boost icon (Rhino attacks at 2 + 1 = 3) and is discarded", () => {
    const base = heroGame();
    const strike = strikeOf(base);
    const { state, events } = asBoost(base, strike);
    const hit = attacksBy(events, state.activeVillainId!)[0]!;
    expect([hit.baseAtk, hit.boostIcons, hit.damageDealt]).toEqual([2, 1, 3]);
    expect(whereIs(state, strike)).toBe("encounterDiscard");
    expect(whereIs(state, azazelOf(base))).toBe(`setAside:p1`);
  });
});
