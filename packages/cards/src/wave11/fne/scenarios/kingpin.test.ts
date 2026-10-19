import {
  categoriesOf,
  applyCommand,
  cardsInPlay,
  characterProfile,
  hasKeyword,
  createGame,
  keywordTotal,
  locateCard,
  type GameEvent,
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
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import {
  defeatWithAttack,
  driveEventsPicking,
  playFromHand,
  encounterCardInVillainArea,
  stackSetAside,
  withForm,
} from "../../../testing/staging.js";
import { engageMinion } from "../../../wave6/mut_gen/project-wideawake-testing.js";
import { inPlayFromDeck } from "../../../wave7/next_evol/superpower-testing.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import { wave11Scenario } from "../../setup.js";
import { FNE_SCENARIOS_KINGPIN as REGISTRY, FNE_SCENARIOS_KINGPIN_SKIPPED as SKIPPED } from "./kingpin.js";

vi.setConfig({ testTimeout: 180_000 });

/**
 * The Kingpin scenario (docs/phase7-wave11-scenarios.md section S6, task S12), played through
 * `wave11Scenario("kingpin", ...)`: Kingpin on side 1 (A1 standard, B1 expert), The King's Gambit, Public Support,
 * the Kingpin encounter set plus Tombstone and Tracksuit Mafia. Setup reveals every nemesis minion; a card under test
 * is staged on top of the encounter deck and dealt in a villain phase whose enemies are stunned and confused, so
 * their activations (and boost cards) consume the status and the dealt card's own text stands alone.
 */
const KINGPIN = "60159a";
const KINGPIN_B = "60160a";
const SUPPORT = "60163a";
const SUPPORT_HIGH = "60163b";
const BEAR_HUG = "60164";
const WESLEY = "60165";
const CANE = "60166";
const MOUNTAIN = "60167";
const VANESSA = "60168";
const BLACK_CAT = "60169";
const DIAMONDBACK = "60170";
const SPOT = "60171";
const STILT = "60172";
const INFLUENCE = "60173";
const CRIME = "60174";
const BAG = "60175";
const BRO = "60203";
const HATE = "60176";
const VULTURE = "01167";
const HIGHWAY_ROBBERY = "01166";
const ECHO_KINGPIN = "60061";
const BULLSEYE = "60033";
const SWINGING_WEB_KICK = "01005";
const FOR_JUSTICE = "01060";

const REFS = [
  "60159a.kingpin-constant",
  "60159a.kingpin-forced-interrupt",
  "60159b.kingpin-forced-interrupt",
  "60160a.kingpin-constant",
  "60160a.kingpin-forced-interrupt",
  "60160b.kingpin-forced-interrupt",
  "60161a.setup",
  "60161b.when-revealed",
  "60161b.the-kings-gambit-action",
  "60162a.when-revealed",
  "60162b.endgame-constant",
  "60163a.public-support-forced-response",
  "60163a.public-support-forced-interrupt",
  "60163b.public-support-interrupt",
  "60163b.public-support-forced-response",
  "60164.bear-hug-constant",
  "60164.bear-hug-constant-2",
  "60164.bear-hug-forced-interrupt",
  "60165.when-revealed",
  "60165.james-wesley-action",
  "60165.boost",
  "60166.when-revealed",
  "60166.kingpins-cane-forced-response",
  "60166.boost",
  "60167.mountain-of-muscle-constant",
  "60167.mountain-of-muscle-constant-2",
  "60167.mountain-of-muscle-forced-interrupt",
  "60168.when-revealed",
  "60168.vanessa-fisk-action",
  "60168.boost",
  "60169.black-cat-constant",
  "60169.black-cat-action",
  "60170.diamondback-forced-interrupt",
  "60170.boost",
  "60171.spot-constant",
  "60171.spot-forced-interrupt",
  "60172.stilt-man-constant",
  "60172.stilt-man-constant-2",
  "60172.stilt-man-forced-interrupt",
  "60173.when-defeated",
  "60174.organized-crime-constant",
  "60175.when-revealed",
  "60175.boost",
  "60176.when-revealed",
  "60176.boost",
];
const SKIPPED_REFS = ["60163b.public-support-interrupt", "60175.when-revealed", "60175.boost"];
const CARDS = [
  "60159a",
  "60160a",
  "60161a",
  "60163a",
  "60164",
  "60165",
  "60166",
  "60167",
  "60168",
  "60169",
  "60170",
  "60171",
  "60172",
  "60173",
  "60174",
  "60175",
  "60176",
];

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const hero = (s: GameState, p: PlayerId = P1): InstanceId => identityOf(s, p);
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const idsOf = (s: GameState, code: string): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((i) => codeOf(s, i) === code);
const idOf = (s: GameState, code: string): InstanceId => idsOf(s, code)[0]!;
const inPlay = (s: GameState, code: string): InstanceId[] => idsOf(s, code).filter((i) => cardsInPlay(s).includes(i));
const zoneOf = (s: GameState, id: InstanceId) => locateCard(s, id)?.kind;
const villainSide = (s: GameState): string => s.villains.find((v) => v.instanceId === villainOf(s))!.side as string;
const typeOf = (s: GameState, id: InstanceId): string => (s.cardPool[inst(s, id).cardId] as { type: string }).type;
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, WAVE11_DEPS)!;
const counters = (s: GameState, id: InstanceId, kind: string): number =>
  (inst(s, id).counters as Record<string, number> | undefined)?.[kind] ?? 0;

const SEATS = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];
const ECHO_SEATS = [{ starterDeckId: "fne-daredevil-justice" }, { starterDeckId: "fne-echo-protection" }];

/** A Kingpin game past setup (side 1; `side: "B"` turns him to his second side, as Public Support does). */
function newGame(
  opts: {
    players?: number;
    seed?: number;
    expert?: boolean;
    echo?: boolean;
    side?: "A" | "B";
    heroForm?: boolean;
  } = {},
): GameState {
  const { players = 1, seed = 1, expert = false, echo = false, side = "A", heroForm = true } = opts;
  const seats = echo ? ECHO_SEATS : SEATS;
  const base = wave11Scenario("kingpin", {
    players: seats.slice(0, players),
    seed,
    difficulty: expert ? "expert" : "standard",
  } as never);
  const created = createGame(base, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, firstLegal, (st) => st.step.phase === "player", WAVE11_DEPS);
  if (heroForm && !echo) for (const p of s.players) s = withForm(s, { heroForm: 0 }, p.playerId);
  if (side === "B") s = { ...s, villains: s.villains.map((v) => ({ ...v, side: "B" })) };
  return s;
}

const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));
const endAll = (s: GameState) =>
  s.players.length > 1 && s.firstPlayerId === P2
    ? [endTurn(P2), endTurn(P1)]
    : s.players.map((p) => endTurn(p.playerId));

/**
 * Every enemy in play stunned and confused: its activation only spends the status (no attack, scheme or boost card).
 * */
const hobbled = (s: GameState): GameState => {
  let current = s;
  for (const id of cardsInPlay(s)) {
    const type = typeOf(s, id);
    if (type !== "minion" && type !== "villain") continue;
    current = patchInstance(current, id, { statuses: { ...inst(current, id).statuses, stunned: 1, confused: 1 } });
  }
  return current;
};
/**
 * The villain phase with `dealt` on top of the encounter deck (one card per player), after the boost card each player's
 * Kingpin activation is given first. Kingpin is Stalwart, so a status card on him is never spent (his activations are
 * not skipped); the minions are hobbled, so only Kingpin acts. Blank boost cards (60175 Bag of Tricks, 60173 Kingpin's
 * Influence: no Boost ability) keep his activation from doing anything the test is not about.
 */
const BLANKS = [BRO, BRO, BRO, INFLUENCE];
const phase = (s: GameState, dealt: readonly string[], pick: Picker = declines) =>
  driveEventsPicking(
    WAVE11_DEPS,
    stackEncounterDeck(hobbled(s), ...BLANKS.slice(0, s.players.length), ...dealt),
    pick,
    ...endAll(s),
  );
/** The villain phase as it is, with `stack` on top of the deck (boost cards first, then each player's dealt card). */
const bare = (s: GameState, stack: readonly string[], pick: Picker = declines) =>
  driveEventsPicking(WAVE11_DEPS, stackEncounterDeck(s, ...stack), pick, ...endAll(s));

describe("registry", () => {
  it("registers every printed ref of the cards but the three skipped ones, and names each skip's reason", () => {
    const printed = CARDS.flatMap((c) => abilityRefIds(data(c))).sort();
    expect(printed).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual(REFS.filter((r) => !SKIPPED_REFS.includes(r)).sort());
    expect(Object.keys(SKIPPED).sort()).toEqual([...SKIPPED_REFS].sort());
    for (const reason of Object.values(SKIPPED)) expect(reason.length).toBeGreaterThan(40);
  });
  it.each(Object.keys(REGISTRY))("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Setup and the main scheme
// ---------------------------------------------------------------------------------------------------------------

describe("The King's Gambit setup (60161a.setup, 60161b.when-revealed)", () => {
  it("60161a.setup: each player reveals their set-aside nemesis minion, engaged with them", () => {
    const s = newGame({ players: 1 });
    const vulture = inPlay(s, VULTURE);
    expect(vulture).toHaveLength(1);
    expect(inst(s, vulture[0]!).engagedWith).toBe(P1);
  });

  it("60161a.setup: Echo's Kingpin shares a title with the villain: removed from the game, an Underling revealed instead", () => {
    const s = newGame({ players: 2, echo: true });
    const echoKingpin = idOf(s, ECHO_KINGPIN);
    expect(zoneOf(s, echoKingpin)).toBe("removedFromGame");
    // Daredevil's Bullseye shares no title with a character in play: revealed, engaged with Daredevil's player.
    const bullseye = inPlay(s, BULLSEYE);
    expect(bullseye).toHaveLength(1);
    expect(inst(s, bullseye[0]!).engagedWith).toBe(P1);
    // Echo's player (p2) is engaged with a different minion: an Underling from the encounter deck.
    const echoMinions = cardsInPlay(s).filter((i) => typeOf(s, i) === "minion" && inst(s, i).engagedWith === P2);
    expect(echoMinions).toHaveLength(1);
    const traits = (data(codeOf(s, echoMinions[0]!)).traits as readonly string[]).map(String);
    expect(traits).toContain("UNDERLING");
  });

  it("60161b.when-revealed: Public Support is in play on its Low side", () => {
    const s = newGame({ players: 1 });
    expect(inPlay(s, SUPPORT)).toHaveLength(1);
    expect(inPlay(s, SUPPORT_HIGH)).toHaveLength(0);
    expect(zoneOf(s, idOf(s, SUPPORT))).toBe("villainArea");
  });
});

describe("The King's Gambit Hero Action (60161b.the-kings-gambit-action)", () => {
  const act = (s: GameState, pick: Picker = firstLegal) =>
    driveEventsPicking(WAVE11_DEPS, s, pick, use(P1, s.mainScheme.instanceId, "60161b.the-kings-gambit-action"));
  const withThreat = (s: GameState, n: number) => patchInstance(s, s.mainScheme.instanceId, { threat: n });

  it("removes 5 threat in standard mode, 4 in expert mode", () => {
    for (const [expert, removed] of [
      [false, 5],
      [true, 4],
    ] as const) {
      const s = withThreat(newGame({ expert }), 9);
      expect(inst(s, s.mainScheme.instanceId).threat).toBe(9);
      const after = act(s).state;
      expect(inst(after, after.mainScheme.instanceId).threat).toBe(9 - removed);
    }
  });

  it("shuffles the encounter discard pile into the deck, discards until a minion and reveals it, engaged with the player", () => {
    let s = withThreat(newGame(), 9);
    const cruel = idOf(s, HATE);
    const deckId = Object.keys(s.encounterDecks)[0]!;
    const piles = s.encounterDecks[deckId]!;
    s = {
      ...s,
      encounterDecks: {
        ...s.encounterDecks,
        [deckId]: { deck: piles.deck.filter((i) => i !== cruel), discard: [...piles.discard, cruel] },
      },
    };
    const minionsBefore = cardsInPlay(s).filter((i) => typeOf(s, i) === "minion" && inst(s, i).engagedWith === P1);
    const { state: after, events } = act(s);
    // The discard pile went into the deck: the treachery in it was moved there.
    expect(
      ofType(events, "cardMoved").some((e) => e.instanceId === cruel && String(e.to.kind).startsWith("encounterDeck")),
    ).toBe(true);
    // Cards were discarded from the top until a minion; that minion is revealed and engaged with the acting player.
    const discards = ofType(events, "cardDiscardedFromEncounterDeck").map((e) => e.instanceId);
    expect(discards.length).toBeGreaterThanOrEqual(1);
    expect(discards.slice(0, -1).every((id) => typeOf(after, id) !== "minion")).toBe(true);
    expect(typeOf(after, discards.at(-1)!)).toBe("minion");
    const minionsAfter = cardsInPlay(after).filter(
      (i) => typeOf(after, i) === "minion" && inst(after, i).engagedWith === P1,
    );
    expect(minionsAfter).toHaveLength(minionsBefore.length + 1);
    expect(minionsAfter).toContain(discards.at(-1));
  });

  it("ignores crisis icons (an encounter card's own Hero Action: RRG 1.8 p. 14, owner Q66 = B)", () => {
    // No crisis side scheme is in the Kingpin, Tombstone or Tracksuit Mafia sets, so the rule is read off the script.
    const text = JSON.stringify(REGISTRY["60161b.the-kings-gambit-action"]);
    expect(text.match(/"ignoreCrisis":true/g)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Kingpin
// ---------------------------------------------------------------------------------------------------------------

describe("Kingpin side 1 (60159a, 60160a)", () => {
  for (const [ref, expert] of [
    ["60159a.kingpin-constant", false],
    ["60160a.kingpin-constant", true],
  ] as const) {
    it(`${ref}: cannot be dealt damage, so a basic attack on him is refused (and is allowed on side 2)`, () => {
      const s = newGame({ expert });
      expect(codeOf(s, villainOf(s))).toBe(expert ? KINGPIN_B : KINGPIN);
      const attack = {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: hero(s),
        targetInstanceId: villainOf(s),
      } as const;
      const refused = applyCommand(patchInstance(s, hero(s), { exhausted: false }), attack, WAVE11_DEPS);
      expect(refused.ok).toBe(false);
      expect(JSON.stringify(refused)).toContain("cannot take damage");
    });
  }

  it("60159a.kingpin-constant: on his second side (A2) the same attack damages him", () => {
    const s = newGame({ side: "B" });
    const strike = driveEventsPicking(WAVE11_DEPS, patchInstance(s, hero(s), { exhausted: false }), declines, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: hero(s),
      targetInstanceId: villainOf(s),
    });
    expect(damageOf(strike.state, villainOf(s))).toBeGreaterThan(0);
  });

  it("60159a.kingpin-constant: carries the no-upgrade rule from the upgrade side only (structure)", () => {
    const def = JSON.stringify(REGISTRY["60159a.kingpin-constant"]);
    expect(def).toContain('"cannotHaveAttachments"');
    expect(def).toContain('"from":"upgrade"');
    expect(def).toContain('"stage":"dealt"');
    expect(JSON.stringify(REGISTRY["60160a.kingpin-constant"])).toBe(def);
  });

  for (const [ref, expert] of [
    ["60159a.kingpin-forced-interrupt", false],
    ["60160a.kingpin-forced-interrupt", true],
  ] as const) {
    it(`${ref}: he schemes instead of attacking a hero (the main scheme gains threat, the hero takes nothing)`, () => {
      const s = newGame({ expert });
      const kingpin = villainOf(s);
      // Only Kingpin acts: the other enemies are hobbled, and the boost card he is given is a blank.
      const quiet = hobbled(s);
      const free = patchInstance(quiet, kingpin, {
        statuses: { ...inst(quiet, kingpin).statuses, stunned: 0, confused: 0 },
      });
      const before = inst(s, s.mainScheme.instanceId).threat;
      const { state, events } = bare(free, [BRO, INFLUENCE]);
      expect(ofType(events, "schemeResolved").length).toBeGreaterThanOrEqual(1);
      expect(inst(state, state.mainScheme.instanceId).threat).toBeGreaterThan(before);
      expect(damageOf(state, hero(s))).toBe(0);
    });
  }

  it("60159a.kingpin-forced-interrupt: the replacement is for the attack only: on side 2 he attacks", () => {
    const s = newGame({ side: "B" });
    const kingpin = villainOf(s);
    const quiet = hobbled(s);
    const free = patchInstance(quiet, kingpin, {
      statuses: { ...inst(quiet, kingpin).statuses, stunned: 0, confused: 0 },
    });
    const { state } = bare(free, [BRO, INFLUENCE]);
    expect(damageOf(state, hero(s))).toBeGreaterThan(0);
  });
});

/** The Kingpin game with Kingpin free to act (not hobbled) and no minion engaged with the first player. */
function aloneGame(opts: Parameters<typeof newGame>[0] = {}): GameState {
  let s = newGame(opts);
  for (const id of cardsInPlay(s)) if (typeOf(s, id) === "minion") s = defeatWithAttack(WAVE11_DEPS, s, id);
  return hobbledExceptKingpin(s);
}
/** Every minion hobbled; Kingpin himself acts. */
function hobbledExceptKingpin(s: GameState): GameState {
  const quiet = hobbled(s);
  const kingpin = villainOf(s);
  return patchInstance(quiet, kingpin, { statuses: { ...inst(quiet, kingpin).statuses, stunned: 0, confused: 0 } });
}
const boostsGiven = (events: readonly GameEvent[], enemy: InstanceId): number =>
  ofType(events, "boostCardDealt").filter((e) => e.enemyInstanceId === enemy).length;

describe("Kingpin side 2 (60159b, 60160b)", () => {
  // The villain phase's activation order is Kingpin first, so the first stacked cards are his boost cards.
  const STACK = [BRO, BRO, INFLUENCE];

  for (const [ref, expert] of [
    ["60159b.kingpin-forced-interrupt", false],
    ["60160b.kingpin-forced-interrupt", true],
  ] as const) {
    it(`${ref}: alone (no minion engaged with the player) he is given 1 additional boost card`, () => {
      const s = aloneGame({ side: "B", expert });
      expect(cardsInPlay(s).filter((i) => typeOf(s, i) === "minion")).toHaveLength(0);
      const { events } = bare(s, STACK);
      expect(boostsGiven(events, villainOf(s))).toBe(2);
    });

    it(`${ref}: with a minion engaged with the player he gets only his own boost card`, () => {
      const s = hobbledExceptKingpin(newGame({ side: "B", expert }));
      expect(cardsInPlay(s).filter((i) => typeOf(s, i) === "minion" && inst(s, i).engagedWith === P1)).not.toHaveLength(
        0,
      );
      const { events } = bare(s, STACK);
      expect(boostsGiven(events, villainOf(s))).toBe(1);
    });
  }

  it("60159b.kingpin-forced-interrupt: the check is the attacked player's own: only the player without a minion has the extra card", () => {
    let s = newGame({ side: "B", players: 2 });
    const p1Minion = cardsInPlay(s).find((i) => typeOf(s, i) === "minion" && inst(s, i).engagedWith === P1)!;
    s = defeatWithAttack(WAVE11_DEPS, s, p1Minion);
    s = hobbledExceptKingpin(s);
    const { events } = bare(s, [BRO, BRO, BRO, INFLUENCE, CRIME]);
    // Kingpin activates once per player: 1 + 1 boost cards, plus the 1 extra for the player with no minion.
    expect(boostsGiven(events, villainOf(s))).toBe(3);
  });

  it("60160b.kingpin-forced-interrupt: an expert attack gains overkill (excess spills past a defending ally); a standard one does not", () => {
    const run = (expert: boolean) => {
      let s = aloneGame({ side: "B", expert });
      const ally = inPlayFromDeck(s, P1, "01059");
      s = patchInstance(ally.state, ally.id, { damage: 2 });
      const pickAlly: Picker = (st) =>
        st.pendingChoice!.prompt.kind === "declareDefender" ? [ally.id as string] : firstLegal(st);
      return driveEventsPicking(WAVE11_DEPS, stackEncounterDeck(s, ...STACK), pickAlly, ...endAll(s));
    };
    expect(ofType(run(false).events, "overkillSpilled")).toHaveLength(0);
    expect(ofType(run(true).events, "overkillSpilled").length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Public Support and the endgame
// ---------------------------------------------------------------------------------------------------------------

describe("Public Support (60163a, 60163b)", () => {
  const support = (s: GameState): InstanceId => idOf(s, SUPPORT);
  const withSupport = (s: GameState, n: number): GameState =>
    patchInstance(s, support(s), { counters: { ...inst(s, support(s)).counters, support: n } });

  it("60163a.public-support-forced-response: each minion defeated puts 1 support counter on it", () => {
    let s = newGame();
    const [minion] = cardsInPlay(s).filter((i) => typeOf(s, i) === "minion");
    expect(counters(s, support(s), "support")).toBe(0);
    s = defeatWithAttack(WAVE11_DEPS, s, minion!);
    expect(counters(s, support(s), "support")).toBe(1);
  });

  it("60163a.public-support-forced-interrupt: at 2[per_hero]+2 counters (4 for one hero) the villain phase flips Kingpin, advances the main scheme and flips Public Support", () => {
    const { state, events } = phase(withSupport(newGame(), 4), [INFLUENCE]);
    expect(villainSide(state)).toBe("B");
    expect(state.mainScheme.stageIndex).toBe(1);
    expect(ofType(events, "mainSchemeAdvanced").length).toBeGreaterThanOrEqual(1);
    expect(inst(state, support(state)).flipped).toBe(true);
    // Support counters stay when it flips (same card type).
    expect(counters(state, support(state), "support")).toBe(4);
  });

  it("60163a.public-support-forced-interrupt: one counter short of 2[per_hero]+2 nothing flips (1 hero: 3; 2 heroes: 5), and the exact number does", () => {
    for (const [players, short] of [
      [1, 3],
      [2, 5],
    ] as const) {
      const base = newGame({ players });
      const dealt = BLANKS.slice(players, 2 * players);
      const { state } = phase(withSupport(base, short), dealt);
      expect(villainSide(state)).toBe("A");
      expect(state.mainScheme.stageIndex).toBe(0);
      expect(inst(state, support(state)).flipped).toBe(false);
      expect(villainSide(phase(withSupport(base, short + 1), dealt).state)).toBe("B");
    }
  });

  it("60163b.public-support-forced-response: the High side also counts defeated minions", () => {
    const flipped = phase(withSupport(newGame(), 4), [INFLUENCE]).state;
    expect(inst(flipped, support(flipped)).flipped).toBe(true);
    const minion = cardsInPlay(flipped).find(
      (i) => typeOf(flipped, i) === "minion" && inst(flipped, i).engagedWith === P1,
    )!;
    const before = counters(flipped, support(flipped), "support");
    const after = defeatWithAttack(WAVE11_DEPS, ready(withForm(flipped, { heroForm: 0 })), minion);
    expect(counters(after, support(after), "support")).toBe(before + 1);
  });
});

describe("Endgame (60162a.when-revealed, 60162b.endgame-constant)", () => {
  /** Public Support at its threshold, then the villain phase that flips Kingpin and advances the main scheme. */
  const advanced = (opts: Parameters<typeof newGame>[0] = {}, mutate: (s: GameState) => GameState = (s) => s) => {
    const base = mutate(newGame(opts));
    const players = base.players.length;
    const high = patchInstance(base, idOf(base, SUPPORT), { counters: { support: 2 * players + 2 } });
    const run = phase(high, BLANKS.slice(players, 2 * players));
    return { base, ...run };
  };
  /**
   * The cards the advance itself revealed, in order: 2A's When Revealed resolves the moment the stage is advanced,
   * before any encounter card is dealt (the encounter deck is shuffled by it, so what the players are dealt next is
   * not stageable).
   */
  const revealedByAdvance = (events: readonly GameEvent[]): string[] => {
    const start = events.findIndex((e) => e.type === "mainSchemeAdvanced");
    expect(start, "the main scheme advanced").toBeGreaterThanOrEqual(0);
    return ofType(events.slice(start), "encounterCardRevealed").map((e) => `${e.cardId}`);
  };
  const isUnderling = (code: string): boolean =>
    (data(code).traits as readonly unknown[]).map(String).includes("UNDERLING");
  const engagedWith = (s: GameState, code: string, p: PlayerId): boolean =>
    inPlay(s, code).some((i) => inst(s, i).engagedWith === p);

  it("60162a.when-revealed: a player whose nemesis minion is still in play finds an Underling instead", () => {
    const { state, events } = advanced();
    expect(state.mainScheme.stageIndex).toBe(1);
    const [first] = revealedByAdvance(events);
    expect(isUnderling(first!)).toBe(true);
    // The Vulture was in play already: it is not revealed again (still one copy, still engaged with p1).
    expect(inPlay(state, VULTURE)).toHaveLength(1);
    expect(engagedWith(state, first!, P1)).toBe(true);
  });

  it("60162a.when-revealed: a player whose nemesis minion is out of play finds it and reveals it (no Underling)", () => {
    const { events } = advanced({}, (s) => defeatWithAttack(WAVE11_DEPS, s, inPlay(s, VULTURE)[0]!));
    expect(revealedByAdvance(events)[0]).toBe(VULTURE);
  });

  it("60162a.when-revealed: Echo's removed Kingpin cannot be found, so Echo's player finds an Underling again; Daredevil's Bullseye is in play, so another Underling", () => {
    const { state, events } = advanced({ echo: true, players: 2 });
    expect(zoneOf(state, idOf(state, ECHO_KINGPIN))).toBe("removedFromGame");
    const [one, two] = revealedByAdvance(events);
    expect(isUnderling(one!)).toBe(true);
    expect(isUnderling(two!)).toBe(true);
  });

  it("60162a.when-revealed: in expert mode the first player then finds and reveals Organized Crime; in standard it stays in the deck", () => {
    const standard = advanced({ expert: false });
    expect(revealedByAdvance(standard.events)).not.toContain(CRIME);
    const expert = advanced({ expert: true });
    expect(revealedByAdvance(expert.events)[1]).toBe(CRIME);
    expect(inPlay(expert.state, CRIME)).toHaveLength(1);
  });

  it("60162b.endgame-constant: every minion gains guard once the main scheme is at stage 2, and not before", () => {
    const { base, state } = advanced();
    const before = cardsInPlay(base).filter((i) => typeOf(base, i) === "minion");
    expect(before.length).toBeGreaterThanOrEqual(1);
    for (const id of before) expect(hasKeyword(base, id, "guard", WAVE11_DEPS)).toBe(false);
    const minions = cardsInPlay(state).filter((i) => typeOf(state, i) === "minion");
    expect(minions.length).toBeGreaterThanOrEqual(2);
    for (const id of minions) expect(hasKeyword(state, id, "guard", WAVE11_DEPS)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Kingpin's attachments
// ---------------------------------------------------------------------------------------------------------------

const attack = (s: GameState, target: InstanceId, player: PlayerId = P1, attacker?: InstanceId) =>
  ({
    type: "basicAttack",
    playerId: player,
    attackerInstanceId: attacker ?? hero(s, player),
    targetInstanceId: target,
  }) as const;
const thwart = (s: GameState, scheme: InstanceId, player: PlayerId = P1) =>
  ({
    type: "basicThwart",
    playerId: player,
    thwarterInstanceId: hero(s, player),
    schemeInstanceId: scheme,
  }) as const;
const ready = (s: GameState, player: PlayerId = P1): GameState =>
  patchInstance(s, hero(s, player), { exhausted: false });
/** The codes revealed in order by the commands that produced `events`. */
const revealed = (events: readonly GameEvent[]): string[] =>
  ofType(events, "encounterCardRevealed").map((e) => `${e.cardId}`);
/** Surgery: the first copy of `code` from the encounter deck, faceup and attached to `host`. */
function attachedTo(state: GameState, code: string, host: InstanceId): { state: GameState; id: InstanceId } {
  const staged = encounterCardInVillainArea(state, code);
  const placed = patchInstance(
    { ...staged.state, villainArea: staged.state.villainArea.filter((i) => i !== staged.id) },
    staged.id,
    { faceup: true, attachedTo: host, controllerId: null },
  );
  return {
    id: staged.id,
    state: patchInstance(placed, host, { attachments: [...inst(placed, host).attachments, staged.id] }),
  };
}
const discarded = (s: GameState, id: InstanceId): boolean => zoneOf(s, id) === "encounterDiscard";

describe("Bear Hug (60164)", () => {
  it("60164.bear-hug-constant: with Kingpin a Martial Artist (side 2) it attaches to the player's hero", () => {
    const { state } = phase(newGame({ side: "B" }), [BEAR_HUG]);
    expect(inst(state, inPlay(state, BEAR_HUG)[0]!).attachedTo).toBe(hero(state));
  });

  it("60164.bear-hug-constant: with Kingpin a Martial Artist (side 2) it attaches to the player's hero with 3 grip counters", () => {
    const { state } = phase(newGame({ side: "B" }), [BEAR_HUG]);
    const [hug] = inPlay(state, BEAR_HUG);
    expect(hug).toBeDefined();
    expect(inst(state, hug!).attachedTo).toBe(hero(state));
    expect(counters(state, hug!, "grip")).toBe(3);
  });

  it("60164.bear-hug-constant: on side 1 (Criminal only) it gains surge instead and is not kept", () => {
    const { state, events } = phase(newGame({ side: "A" }), [BEAR_HUG, INFLUENCE]);
    expect(inPlay(state, BEAR_HUG)).toHaveLength(0);
    expect(discarded(state, idOf(state, BEAR_HUG))).toBe(true);
    // Surge: the next encounter card is revealed in its place.
    expect(revealed(events)).toEqual([BEAR_HUG, INFLUENCE]);
  });

  it("60164.bear-hug-constant-2: the held hero cannot change to alter-ego form, and can without it", () => {
    const free = newGame({ side: "B" });
    expect(applyCommand(ready(free), { type: "changeForm", playerId: P1 }, WAVE11_DEPS).ok).toBe(true);
    const held = phase(free, [BEAR_HUG]).state;
    expect(inPlay(held, BEAR_HUG)).toHaveLength(1);
    const refused = applyCommand(held, { type: "changeForm", playerId: P1 }, WAVE11_DEPS);
    expect(refused.ok).toBe(false);
  });

  it("60164.bear-hug-forced-interrupt: a basic attack is replaced by losing a grip counter; the third discards it", () => {
    const base = newGame({ side: "B" });
    const hug = attachedTo(base, BEAR_HUG, hero(base));
    let s = patchInstance({ ...hug.state, instances: hug.state.instances }, hug.id, { counters: { grip: 3 } });
    const target = inPlay(s, VULTURE)[0]!;
    for (const expected of [2, 1]) {
      s = driveEventsPicking(WAVE11_DEPS, ready(s), declines, attack(s, target)).state;
      expect(damageOf(s, target)).toBe(0);
      expect(counters(s, hug.id, "grip")).toBe(expected);
    }
    s = driveEventsPicking(WAVE11_DEPS, ready(s), declines, attack(s, target)).state;
    expect(damageOf(s, target)).toBe(0);
    expect(discarded(s, hug.id)).toBe(true);
    // Free again: the attack lands.
    s = driveEventsPicking(WAVE11_DEPS, ready(s), declines, attack(s, target)).state;
    expect(damageOf(s, target)).toBeGreaterThan(0);
  });

  it("60164.bear-hug-forced-interrupt: a basic thwart is replaced the same way", () => {
    const base = newGame({ side: "B" });
    const hug = attachedTo(base, BEAR_HUG, hero(base));
    const scheme = encounterCardInVillainArea(hug.state, INFLUENCE, 3);
    let s = patchInstance(scheme.state, hug.id, { counters: { grip: 3 } });
    s = driveEventsPicking(WAVE11_DEPS, ready(s), declines, thwart(s, scheme.id)).state;
    expect(inst(s, scheme.id).threat).toBe(3);
    expect(counters(s, hug.id, "grip")).toBe(2);
  });
});

describe("James Wesley (60165)", () => {
  it("60165.when-revealed: attaches to Kingpin and gives him a facedown boost card", () => {
    const { state } = phase(newGame(), [WESLEY]);
    const [wesley] = inPlay(state, WESLEY);
    expect(inst(state, wesley!).attachedTo).toBe(villainOf(state));
    expect(inst(state, villainOf(state)).boostCards).toHaveLength(1);
  });

  it("60165.james-wesley-action: discarding a Thwart event from hand discards him and Kingpin schemes", () => {
    const base = newGame();
    const wesley = attachedTo(base, WESLEY, villainOf(base));
    const given = moveToHand(wesley.state, P1, FOR_JUSTICE);
    const event = given.ids[0]!;
    const before = inst(given.state, given.state.mainScheme.instanceId).threat;
    const { state, events } = driveEventsPicking(
      WAVE11_DEPS,
      given.state,
      declines,
      use(P1, wesley.id, "60165.james-wesley-action", [], { discard: [event] }),
    );
    expect(discarded(state, wesley.id)).toBe(true);
    expect(playerOf(state, P1).discard).toContain(event);
    expect(ofType(events, "schemeResolved").length).toBeGreaterThanOrEqual(1);
    expect(inst(state, state.mainScheme.instanceId).threat).toBeGreaterThan(before);
  });

  it("60165.james-wesley-action: an Attack event is not a Thwart event and does not pay", () => {
    const base = newGame();
    const wesley = attachedTo(base, WESLEY, villainOf(base));
    const given = moveToHand(wesley.state, P1, SWINGING_WEB_KICK);
    const refused = applyCommand(
      given.state,
      use(P1, wesley.id, "60165.james-wesley-action", [], { discard: [given.ids[0]!] }),
      WAVE11_DEPS,
    );
    expect(refused.ok).toBe(false);
  });

  it("60165.boost: the boost card attaches to Kingpin", () => {
    // Kingpin (side 1) schemes against the player; James Wesley is his boost card.
    const base = hobbledExceptKingpin(newGame());
    const { state } = bare(base, [WESLEY, INFLUENCE]);
    const [wesley] = inPlay(state, WESLEY);
    expect(wesley).toBeDefined();
    expect(inst(state, wesley!).attachedTo).toBe(villainOf(state));
  });
});

describe("Kingpin's Cane (60166)", () => {
  it("60166.when-revealed: attaches to Kingpin and stuns the revealing player's hero", () => {
    const { state } = phase(newGame(), [CANE]);
    const [cane] = inPlay(state, CANE);
    expect(inst(state, cane!).attachedTo).toBe(villainOf(state));
    expect(inst(state, hero(state)).statuses.stunned).toBe(1);
  });

  it("60166.kingpins-cane-forced-response: after Kingpin attacks and damages a hero, that hero is stunned and the Cane is discarded", () => {
    const base = aloneGame({ side: "B" });
    const cane = attachedTo(base, CANE, villainOf(base));
    expect(inst(cane.state, hero(cane.state)).statuses.stunned ?? 0).toBe(0);
    const { state } = bare(cane.state, [BRO, BRO, INFLUENCE]);
    expect(damageOf(state, hero(state))).toBeGreaterThan(0);
    expect(inst(state, hero(state)).statuses.stunned).toBe(1);
    expect(discarded(state, cane.id)).toBe(true);
  });

  it("60166.kingpins-cane-forced-response: a hero already stunned is given no stunned card, so the Cane stays", () => {
    const base = aloneGame({ side: "B" });
    const cane = attachedTo(base, CANE, villainOf(base));
    const stunned = patchInstance(cane.state, hero(base), {
      statuses: { ...inst(base, hero(base)).statuses, stunned: 1 },
    });
    const { state } = bare(stunned, [BRO, BRO, INFLUENCE]);
    expect(damageOf(state, hero(state))).toBeGreaterThan(0);
    expect(discarded(state, cane.id)).toBe(false);
    expect(inst(state, cane.id).attachedTo).toBe(villainOf(state));
  });

  it("60166.kingpins-cane-forced-response: an ally that defends takes the blow: no hero is damaged, nobody is stunned", () => {
    const base = aloneGame({ side: "B" });
    const cane = attachedTo(base, CANE, villainOf(base));
    const ally = inPlayFromDeck(cane.state, P1, "01059");
    const pickAlly: Picker = (st) =>
      st.pendingChoice!.prompt.kind === "declareDefender" ? [ally.id as string] : firstLegal(st);
    const { state } = driveEventsPicking(
      WAVE11_DEPS,
      stackEncounterDeck(ally.state, BRO, BRO, INFLUENCE),
      pickAlly,
      ...endAll(ally.state),
    );
    expect(cardsInPlay(state)).not.toContain(ally.id); // Kingpin's 3 ATK defeats Jessica Jones (3 HP)
    expect(damageOf(state, hero(state))).toBe(0);
    expect(inst(state, hero(state)).statuses.stunned ?? 0).toBe(0);
    expect(inst(state, cane.id).attachedTo).toBe(villainOf(state));
  });

  it("60166.boost: the player is stunned; one already stunned also takes 1 damage", () => {
    const fresh = bare(hobbledExceptKingpin(newGame()), [CANE, INFLUENCE]).state;
    expect(inst(fresh, hero(fresh)).statuses.stunned).toBe(1);
    expect(damageOf(fresh, hero(fresh))).toBe(0);
    const base = hobbledExceptKingpin(newGame());
    const stunned = patchInstance(base, hero(base), { statuses: { ...inst(base, hero(base)).statuses, stunned: 1 } });
    const again = bare(stunned, [CANE, INFLUENCE]).state;
    expect(damageOf(again, hero(again))).toBe(1);
  });
});

describe("Mountain of Muscle (60167)", () => {
  it("60167.mountain-of-muscle-constant: with Kingpin a Martial Artist it attaches to him", () => {
    const { state } = phase(newGame({ side: "B" }), [MOUNTAIN]);
    const [mountain] = inPlay(state, MOUNTAIN);
    expect(mountain).toBeDefined();
    expect(inst(state, mountain!).attachedTo).toBe(villainOf(state));
  });

  it("60167.mountain-of-muscle-constant: on side 1 it gains surge instead and is not kept", () => {
    const { state, events } = phase(newGame({ side: "A" }), [MOUNTAIN, INFLUENCE]);
    expect(inPlay(state, MOUNTAIN)).toHaveLength(0);
    expect(discarded(state, idOf(state, MOUNTAIN))).toBe(true);
    expect(revealed(events)).toEqual([MOUNTAIN, INFLUENCE]);
  });

  it("60167.mountain-of-muscle-constant-2: Kingpin gains retaliate 1 while it is attached", () => {
    const base = newGame({ side: "B" });
    const before = keywordTotal(base, villainOf(base), "retaliate", WAVE11_DEPS);
    const mountain = attachedTo(base, MOUNTAIN, villainOf(base));
    expect(keywordTotal(mountain.state, villainOf(base), "retaliate", WAVE11_DEPS)).toBe(before + 1);
  });

  it("60167.mountain-of-muscle-forced-interrupt: damage Kingpin would take is placed on it instead, and at 8 damage it is discarded", () => {
    const base = newGame({ side: "B" });
    const mountain = attachedTo(base, MOUNTAIN, villainOf(base));
    const hit = driveEventsPicking(WAVE11_DEPS, ready(mountain.state), declines, attack(base, villainOf(base)));
    expect(damageOf(hit.state, villainOf(base))).toBe(0);
    expect(damageOf(hit.state, mountain.id)).toBeGreaterThan(0);
    // Seven damage already on it: the next blow takes it to 8 or more and it goes, and Kingpin still took none.
    const worn = patchInstance(mountain.state, mountain.id, { damage: 7 });
    const broken = driveEventsPicking(WAVE11_DEPS, ready(worn), declines, attack(base, villainOf(base))).state;
    expect(damageOf(broken, villainOf(base))).toBe(0);
    expect(discarded(broken, mountain.id)).toBe(true);
    // Without it the next blow reaches Kingpin.
    const bare2 = driveEventsPicking(WAVE11_DEPS, ready(broken), declines, attack(broken, villainOf(base))).state;
    expect(damageOf(bare2, villainOf(base))).toBeGreaterThan(0);
  });
});

describe("Vanessa Fisk (60168)", () => {
  it("60168.when-revealed: attaches to Kingpin and confuses the revealing player's hero", () => {
    const { state } = phase(newGame(), [VANESSA]);
    const [vanessa] = inPlay(state, VANESSA);
    expect(inst(state, vanessa!).attachedTo).toBe(villainOf(state));
    expect(inst(state, hero(state)).statuses.confused).toBe(1);
  });

  it("60168.vanessa-fisk-action: discarding an Attack event discards her and Kingpin attacks the player", () => {
    const base = newGame({ side: "B" });
    const vanessa = attachedTo(base, VANESSA, villainOf(base));
    const given = moveToHand(vanessa.state, P1, SWINGING_WEB_KICK);
    const { state } = driveEventsPicking(
      WAVE11_DEPS,
      given.state,
      declines,
      use(P1, vanessa.id, "60168.vanessa-fisk-action", [], { discard: [given.ids[0]!] }),
    );
    expect(discarded(state, vanessa.id)).toBe(true);
    expect(damageOf(state, hero(state))).toBeGreaterThan(0);
  });

  it("60168.vanessa-fisk-action: on Kingpin's first side the attack is replaced, so he schemes", () => {
    const base = newGame({ side: "A" });
    const vanessa = attachedTo(base, VANESSA, villainOf(base));
    const given = moveToHand(vanessa.state, P1, SWINGING_WEB_KICK);
    const before = inst(given.state, given.state.mainScheme.instanceId).threat;
    const { state } = driveEventsPicking(
      WAVE11_DEPS,
      given.state,
      declines,
      use(P1, vanessa.id, "60168.vanessa-fisk-action", [], { discard: [given.ids[0]!] }),
    );
    expect(damageOf(state, hero(state))).toBe(0);
    expect(inst(state, state.mainScheme.instanceId).threat).toBeGreaterThan(before);
  });

  it("60168.vanessa-fisk-action: a Thwart event does not pay", () => {
    const base = newGame();
    const vanessa = attachedTo(base, VANESSA, villainOf(base));
    const given = moveToHand(vanessa.state, P1, FOR_JUSTICE);
    const refused = applyCommand(
      given.state,
      use(P1, vanessa.id, "60168.vanessa-fisk-action", [], { discard: [given.ids[0]!] }),
      WAVE11_DEPS,
    );
    expect(refused.ok).toBe(false);
  });

  it("60168.boost: the player is confused; one already confused also puts 1 threat on the main scheme", () => {
    const base = hobbledExceptKingpin(newGame());
    const threat = (s: GameState) => inst(s, s.mainScheme.instanceId).threat;
    const fresh = bare(base, [VANESSA, INFLUENCE]).state;
    expect(inst(fresh, hero(fresh)).statuses.confused).toBe(1);
    const confused = patchInstance(base, hero(base), { statuses: { ...inst(base, hero(base)).statuses, confused: 1 } });
    const again = bare(confused, [VANESSA, INFLUENCE]).state;
    // Same boost card (same icons) both times: only the second player was already confused.
    expect(threat(again)).toBe(threat(fresh) + 1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Minions
// ---------------------------------------------------------------------------------------------------------------

const asMinion = (s: GameState, code: string, player: PlayerId = P1) => engageMinion(s, code, player);
const power = (s: GameState, id: InstanceId) => profile(s, id);

describe("Black Cat (60169)", () => {
  const payMental = (s: GameState) => {
    const given = moveToHand(s, P1, "01062");
    return { state: given.state, resource: given.ids[0]! };
  };
  const act = (s: GameState, cat: InstanceId) => {
    const paid = payMental(s);
    return driveEventsPicking(
      WAVE11_DEPS,
      paid.state,
      declines,
      use(P1, cat, "60169.black-cat-action", [{ fromHand: paid.resource }]),
    ).state;
  };
  const isAlly = (s: GameState, id: InstanceId): boolean => categoriesOf(s, id).includes("ally");

  it("60169.black-cat-action: a [mental] resource puts 1 threat on her; she stays a minion below 4", () => {
    const staged = asMinion(newGame(), BLACK_CAT);
    const after = act(staged.state, staged.id);
    expect(inst(after, staged.id).threat).toBe(1);
    expect(isAlly(after, staged.id)).toBe(false);
    expect(inst(after, staged.id).controllerId ?? null).not.toBe(P1);
    expect(inst(after, staged.id).engagedWith).toBe(P1);
  });

  it("60169.black-cat-action: the 4th threat takes control of her as an ally", () => {
    const staged = asMinion(newGame(), BLACK_CAT);
    const after = act(patchInstance(staged.state, staged.id, { threat: 3 }), staged.id);
    expect(inst(after, staged.id).threat).toBe(4);
    expect(isAlly(after, staged.id)).toBe(true);
    expect(inst(after, staged.id).controllerId).toBe(P1);
    expect(playerOf(after, P1).playArea).toContain(staged.id);
  });

  it("60169.black-cat-constant: owner Q205 = B: exactly 4 threat makes her an ally; a 5th does not, and neither does 3", () => {
    const staged = asMinion(newGame(), BLACK_CAT);
    const five = act(patchInstance(staged.state, staged.id, { threat: 4 }), staged.id);
    expect(inst(five, staged.id).threat).toBe(5);
    expect(isAlly(five, staged.id)).toBe(false);
    expect(isAlly(act(patchInstance(staged.state, staged.id, { threat: 2 }), staged.id), staged.id)).toBe(false);
  });

  it("60169.black-cat-constant: as an ally she takes 2 consequential damage after she attacks", () => {
    const staged = asMinion(newGame(), BLACK_CAT);
    const ally = act(patchInstance(staged.state, staged.id, { threat: 3 }), staged.id);
    const target = inPlay(ally, VULTURE)[0]!;
    const strike = driveEventsPicking(WAVE11_DEPS, ally, declines, attack(ally, target, P1, staged.id));
    expect(damageOf(strike.state, staged.id)).toBe(2);
    expect(damageOf(strike.state, target)).toBeGreaterThan(0);
  });
});

describe("Diamondback (60170)", () => {
  it("60170.diamondback-forced-interrupt: when he attacks the player they take 1 damage first", () => {
    const staged = asMinion(newGame(), DIAMONDBACK);
    const quiet = hobbledExceptKingpin(staged.state);
    const free = patchInstance(quiet, staged.id, { statuses: { stunned: 0, confused: 0, tough: 0 } });
    const { events, state } = bare(free, [BRO, BRO, INFLUENCE]);
    const mine = ofType(events, "damageDealt").filter(
      (e) => e.targetInstanceId === hero(state) && e.sourceInstanceId === staged.id,
    );
    expect(mine.map((e) => e.amount)[0]).toBe(1);
    // The interrupt came before his attack resolved.
    const first = events.findIndex((e) => e.type === "damageDealt" && e.sourceInstanceId === staged.id);
    const resolved = events.findIndex((e) => e.type === "attackResolved" && e.enemyInstanceId === staged.id);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(resolved).toBeGreaterThan(first);
  });

  it("60170.boost: the player takes 1 damage", () => {
    const { state } = bare(hobbledExceptKingpin(newGame()), [DIAMONDBACK, INFLUENCE]);
    expect(damageOf(state, hero(state))).toBe(1);
    expect(damageOf(bare(hobbledExceptKingpin(newGame()), [BRO, INFLUENCE]).state, hero(state))).toBe(0);
  });
});

describe("Spot (60171)", () => {
  it("60171.spot-constant: enters play with 1 spot counter", () => {
    const { state } = phase(newGame(), [SPOT]);
    const [spot] = inPlay(state, SPOT);
    expect(spot).toBeDefined();
    expect(counters(state, spot!, "spot")).toBe(1);
  });

  it("60171.spot-forced-interrupt: with a counter, an attack's damage goes to the attacker instead and the counter is removed; then the next attack hurts him and adds a counter", () => {
    const staged = asMinion(newGame(), SPOT);
    let s = patchInstance(staged.state, staged.id, { counters: { spot: 1 } });
    const before = damageOf(s, hero(s));
    s = driveEventsPicking(WAVE11_DEPS, ready(s), declines, attack(s, staged.id)).state;
    expect(damageOf(s, staged.id)).toBe(0);
    expect(counters(s, staged.id, "spot")).toBe(0);
    expect(damageOf(s, hero(s))).toBeGreaterThan(before);
    const hurt = damageOf(s, hero(s));
    s = driveEventsPicking(WAVE11_DEPS, ready(s), declines, attack(s, staged.id)).state;
    expect(damageOf(s, staged.id)).toBeGreaterThan(0);
    expect(counters(s, staged.id, "spot")).toBe(1);
    expect(damageOf(s, hero(s))).toBe(hurt);
  });

  it("60171.spot-forced-interrupt: an ally that attacks him takes the damage, not the player's hero or Spot", () => {
    const staged = asMinion(newGame(), SPOT);
    const ally = inPlayFromDeck(patchInstance(staged.state, staged.id, { counters: { spot: 1 } }), P1, "01059");
    const { state, events } = driveEventsPicking(
      WAVE11_DEPS,
      ally.state,
      declines,
      attack(ally.state, staged.id, P1, ally.id),
    );
    expect(damageOf(state, staged.id)).toBe(0);
    const back = ofType(events, "damageDealt").filter(
      (e) => e.targetInstanceId === ally.id && e.sourceInstanceId === staged.id,
    );
    expect(back.map((e) => e.amount)).toEqual([profile(ally.state, ally.id).atk]);
    expect(damageOf(state, hero(state))).toBe(0);
  });
});

describe("Stilt-Man (60172)", () => {
  it("60172.stilt-man-constant: enters play with 2 stilt counters", () => {
    const { state } = phase(newGame(), [STILT]);
    const [stilt] = inPlay(state, STILT);
    expect(counters(state, stilt!, "stilt")).toBe(2);
  });

  it("60172.stilt-man-constant-2: +1 SCH and +1 ATK for each stilt counter", () => {
    const staged = asMinion(newGame(), STILT);
    const base = patchInstance(staged.state, staged.id, { counters: { stilt: 0 } });
    for (const n of [1, 2, 3]) {
      const s = patchInstance(base, staged.id, { counters: { stilt: n } });
      expect(power(s, staged.id).atk - power(base, staged.id).atk).toBe(n);
      expect(power(s, staged.id).sch - power(base, staged.id).sch).toBe(n);
    }
  });

  it("60172.stilt-man-forced-interrupt: damage removes a stilt counter instead until there are none", () => {
    const staged = asMinion(newGame(), STILT);
    let s = patchInstance(staged.state, staged.id, { counters: { stilt: 2 } });
    for (const left of [1, 0]) {
      s = driveEventsPicking(WAVE11_DEPS, ready(s), declines, attack(s, staged.id)).state;
      expect(damageOf(s, staged.id)).toBe(0);
      expect(counters(s, staged.id, "stilt")).toBe(left);
    }
    s = driveEventsPicking(WAVE11_DEPS, ready(s), declines, attack(s, staged.id)).state;
    expect(damageOf(s, staged.id)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Side schemes and treacheries
// ---------------------------------------------------------------------------------------------------------------

describe("Kingpin's Influence (60173)", () => {
  const defeatInfluence = (s: GameState, player: PlayerId = P1) => {
    const staged = encounterCardInVillainArea(s, INFLUENCE, 1);
    return driveEventsPicking(
      WAVE11_DEPS,
      ready(staged.state, player),
      declines,
      thwart(staged.state, staged.id, player),
    );
  };
  const startingThreat = (s: GameState, code: string): number => {
    const stage = (data(code).stages ?? [data(code)])[0] as { startingThreat?: { base: number; perPlayer: number } };
    const t = stage.startingThreat ?? (data(code).startingThreat as { base: number; perPlayer: number });
    return t.base + t.perPlayer * s.players.length;
  };

  it("60173.when-defeated: the defeating player reveals their nemesis side scheme when it is not in play", () => {
    const base = newGame();
    expect(inPlay(base, HIGHWAY_ROBBERY)).toHaveLength(0);
    const { state } = defeatInfluence(base);
    const [scheme] = inPlay(state, HIGHWAY_ROBBERY);
    expect(scheme).toBeDefined();
    // Revealed with its printed threat; the 3 threat is for a scheme already there (printed order).
    expect(inst(state, scheme!).threat).toBe(startingThreat(state, HIGHWAY_ROBBERY));
  });

  it("60173.when-defeated: with their nemesis side scheme in play it gets 3 more threat", () => {
    const staged = phase(stackSetAside(newGame(), HIGHWAY_ROBBERY), [HIGHWAY_ROBBERY]);
    const base = staged.state;
    const scheme = inPlay(base, HIGHWAY_ROBBERY)[0]!;
    expect(cardsInPlay(base)).toContain(scheme);
    const before = inst(base, scheme).threat;
    const { state } = defeatInfluence(base);
    expect(inPlay(state, HIGHWAY_ROBBERY)).toHaveLength(1);
    expect(inst(state, scheme).threat).toBe(before + 3);
  });

  it("60173.when-defeated: in a 2-player game only the player who defeated it is affected", () => {
    const base = newGame({ players: 2 });
    const sideSchemesOf = (s: GameState, p: PlayerId) =>
      playerOf(s, p).setAside.filter((i) => typeOf(s, i) === "side_scheme");
    const p2Scheme = sideSchemesOf(base, P2)[0]!;
    const p1Scheme = sideSchemesOf(base, P1)[0]!;
    expect(p2Scheme).toBeDefined();
    // p1 ends their turn, then p2 thwarts and defeats it.
    const turn2 = driveEventsPicking(WAVE11_DEPS, base, declines, endTurn(P1)).state;
    expect(turn2.step.kind === "turn" && turn2.step.activePlayerId).toBe(P2);
    const { state } = defeatInfluence(turn2, P2);
    expect(cardsInPlay(state)).toContain(p2Scheme);
    expect(cardsInPlay(state)).not.toContain(p1Scheme);
  });
});

describe("Organized Crime (60174)", () => {
  it("60174.organized-crime-constant: each minion gets +2 hit points, a hero none", () => {
    const base = newGame();
    const vulture = inPlay(base, VULTURE)[0]!;
    const staged = encounterCardInVillainArea(base, CRIME);
    const asBase = profile(base, vulture).maxHp;
    expect(profile(staged.state, vulture).maxHp).toBe(asBase + 2);
    expect(profile(staged.state, hero(base)).maxHp).toBe(profile(base, hero(base)).maxHp);
    const cat = asMinion(staged.state, BLACK_CAT);
    expect(profile(cat.state, cat.id).maxHp).toBe(profile(asMinion(base, BLACK_CAT).state, cat.id).maxHp + 2);
  });
});

describe("Unrelenting Hate (60176)", () => {
  const activationsBy = (events: readonly GameEvent[], enemy: InstanceId): number =>
    ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === enemy).length;
  /** Only Kingpin and the Vulture act in the villain phase. */
  const vultureActs = (s: GameState): GameState => {
    const vulture = inPlay(s, VULTURE)[0]!;
    const quiet = hobbledExceptKingpin(s);
    return patchInstance(quiet, vulture, { statuses: { stunned: 0, confused: 0, tough: 0 } });
  };

  it("60176.when-revealed: your nemesis minion in play activates against you (one more attack than without it)", () => {
    const base = newGame();
    const vulture = inPlay(base, VULTURE)[0]!;
    const withHate = bare(vultureActs(base), [BRO, HATE]).events;
    const control = bare(vultureActs(base), [BRO, INFLUENCE]).events;
    expect(activationsBy(control, vulture)).toBe(1);
    expect(activationsBy(withHate, vulture)).toBe(2);
  });

  it("60176.when-revealed: a nemesis minion not in play is found and revealed", () => {
    const base = defeatWithAttack(WAVE11_DEPS, newGame(), inPlay(newGame(), VULTURE)[0]!);
    expect(inPlay(base, VULTURE)).toHaveLength(0);
    const { state, events } = phase(base, [HATE]);
    expect(revealed(events)).toEqual([HATE, VULTURE]);
    expect(inPlay(state, VULTURE)).toHaveLength(1);
    expect(inst(state, inPlay(state, VULTURE)[0]!).engagedWith).toBe(P1);
  });

  it("60176.when-revealed: Echo's Kingpin is out of the game, so Echo's player finds an Underling instead", () => {
    const base = newGame({ players: 2, echo: true });
    // Daredevil's player is dealt a blank, Echo's player (p2) the Hate.
    const { state, events } = phase(base, [INFLUENCE, HATE]);
    const codes = revealed(events);
    expect(codes.slice(-2)[0]).toBe(HATE);
    const last = codes.at(-1)!;
    expect((data(last).traits as readonly unknown[]).map(String)).toContain("UNDERLING");
    expect(inPlay(state, last).some((i) => inst(state, i).engagedWith === P2)).toBe(true);
    expect(zoneOf(state, idOf(state, ECHO_KINGPIN))).toBe("removedFromGame");
  });

  it("60176.boost: an attack Kingpin makes gains overkill; with a blank boost card it does not", () => {
    const run = (boost: string) => {
      let s = aloneGame({ side: "B" });
      const ally = inPlayFromDeck(s, P1, "01059");
      s = patchInstance(ally.state, ally.id, { damage: 2 });
      const pickAlly: Picker = (st) =>
        st.pendingChoice!.prompt.kind === "declareDefender" ? [ally.id as string] : firstLegal(st);
      return driveEventsPicking(WAVE11_DEPS, stackEncounterDeck(s, boost, BRO, INFLUENCE), pickAlly, ...endAll(s));
    };
    expect(ofType(run(BRO).events, "overkillSpilled")).toHaveLength(0);
    expect(ofType(run(HATE).events, "overkillSpilled").length).toBeGreaterThanOrEqual(1);
  });
});

describe("Bag of Tricks (60175)", () => {
  it("60175.when-revealed, 60175.boost: left unscripted (no random pick from a player's set-aside area): revealing it does nothing", () => {
    const { state, events } = phase(newGame(), [BAG]);
    expect(revealed(events)).toEqual([BAG]);
    expect(damageOf(state, hero(state))).toBe(0);
    expect(Object.keys(SKIPPED)).toEqual(expect.arrayContaining(["60175.when-revealed", "60175.boost"]));
  });
});

describe("review follow-ups", () => {
  it("60164.bear-hug-constant: revealed in alter-ego form it has no hero to attach to: discarded, with surge on side 1 and without it on side 2", () => {
    const side1 = phase(newGame({ side: "A", heroForm: false }), [BEAR_HUG, INFLUENCE]);
    expect(inPlay(side1.state, BEAR_HUG)).toHaveLength(0);
    expect(discarded(side1.state, idOf(side1.state, BEAR_HUG))).toBe(true);
    expect(revealed(side1.events)).toEqual([BEAR_HUG, INFLUENCE]);
    const side2 = phase(newGame({ side: "B", heroForm: false }), [BEAR_HUG, INFLUENCE]);
    expect(inPlay(side2.state, BEAR_HUG)).toHaveLength(0);
    expect(discarded(side2.state, idOf(side2.state, BEAR_HUG))).toBe(true);
    expect(revealed(side2.events)).toEqual([BEAR_HUG]);
  });

  it("60159b.kingpin-forced-interrupt: against a player in alter-ego form (he schemes) the extra boost card is given too", () => {
    const s = withForm(aloneGame({ side: "B" }), "alterEgo");
    const { events } = bare(s, [BRO, BRO, INFLUENCE]);
    expect(ofType(events, "schemeResolved").length).toBeGreaterThanOrEqual(1);
    expect(boostsGiven(events, villainOf(s))).toBe(2);
  });

  it("60164.bear-hug-forced-interrupt: an event attack is replaced too (the host is the identity making it)", () => {
    const base = newGame({ side: "B" });
    const hug = attachedTo(base, BEAR_HUG, hero(base));
    const s = patchInstance(hug.state, hug.id, { counters: { grip: 3 } });
    const target = inPlay(s, VULTURE)[0]!;
    const { state: played } = playFromHand(WAVE11_DEPS, s, SWINGING_WEB_KICK, 3, firstLegal);
    expect(damageOf(played, target)).toBe(0);
    expect(counters(played, hug.id, "grip")).toBe(2);
  });
});
