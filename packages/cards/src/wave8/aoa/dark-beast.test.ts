import { AOA_CARDS, CORE_CARDS, cardId, encounterSetId } from "@mc/content";
import {
  activeEncounterDeckId,
  cardsInPlay,
  characterProfile,
  createGame,
  hasKeyword,
  legalActions,
  maxHitPoints,
  printedProfile,
  showingResources,
  villainStageOf,
  type EngineDeps,
  type GameEvent,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import { mergeRegistries } from "../../dsl/index.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { defeatWithAttack, driveEventsPicking, withForm } from "../../testing/staging.js";
import { attachToHost } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { BLUE_MOON } from "./blue-moon.js";
import { DARK_BEAST, DARK_BEAST_SKIPPED } from "./dark-beast.js";
import { GENOSHA } from "./genosha.js";
import { SAVAGE_LAND } from "./savage-land.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Dark Beast scenario's villain, main scheme and set (45118 to 45120 Dark Beast, 45121a Dark Beast's Bogus
 * Journey, 45122 to 45126), docs/phase7-wave8.md §2.8, §3.12, §3.23 to §3.25. There is no wave 8 scenario builder yet,
 * so the game is Core's Rhino config with the villain, main scheme, stage range, `dark_beast` set and the
 * set-aside Savage Land, Genosha and Blue Moon sets (`setAsideModularSets`, held back by `setAsideUntilCalled`)
 * swapped in by hand. `sets` limits which of the three Setting sets are set aside, to stage a known environment.
 */
const BEAST_I = "45118";
const GOGGLES = "45122";
const ENHANCEMENT = "45123";
const EXPERIMENT = "45124";
const GENIUS = "45125";
const TIME_TRAVEL = "45126";
const SAVAGE = "45127";
const RAPTOR = "45129";
/** Core Rhino side scheme (Breakin' & Takin').  */
const SIDE_SCHEME = "01107";
const GENOSHA_ENV = "45133";
const BLUE_AREA = "45139";
const SETS = ["savage_land", "genosha", "blue_moon"] as const;
type SetName = (typeof SETS)[number];
const ENV_OF: Record<SetName, string> = { savage_land: SAVAGE, genosha: GENOSHA_ENV, blue_moon: BLUE_AREA };

const REFS = [
  "45118.dark-beast-forced-interrupt",
  "45118.when-revealed",
  "45119.dark-beast-forced-interrupt",
  "45119.when-revealed",
  "45120.dark-beast-forced-interrupt",
  "45120.when-revealed",
  "45121a.setup",
  "45122.boost",
  "45122.high-tech-goggles-action",
  "45123.boost",
  "45123.genetic-enhancement-action",
  "45124.cruel-experiment-constant",
  "45124.when-revealed",
  "45125.when-revealed-alter-ego",
  "45125.when-revealed-hero",
  "45126.when-defeated",
];
const BLANK = "01186";
const BLANK_2 = "01187";
/** Core Hydra Mercenary: a minion with 3 hit points and printed guard. */
const MERCENARY = "01101";
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, DARK_BEAST, SAVAGE_LAND, GENOSHA, BLUE_MOON) };

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
type Seats = readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL)[];

const cardsOfSet = (set: string): string[] =>
  AOA_CARDS.filter((c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId(set))).flatMap((c) =>
    Array.from({ length: (c as { quantityInSet: number }).quantityInSet }, () => c.id as string),
  );

interface Opts {
  readonly expert?: boolean;
  readonly seats?: Seats;
  readonly seed?: number;
  readonly sets?: readonly SetName[];
  readonly deps?: EngineDeps;
}
function setupConfig(opts: Opts = {}): GameSetupConfig {
  const sets = opts.sets ?? SETS;
  const config = coreScenario("rhino", {
    players: opts.seats ?? [SPIDER_MAN],
    seed: opts.seed ?? 1,
    difficulty: opts.expert ? "expert" : "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS],
  });
  return {
    ...config,
    villainCardId: "45118" as typeof config.villainCardId,
    villainSide: "A",
    villainStartStageIndex: opts.expert ? 1 : 0,
    villainLastStageIndex: opts.expert ? 2 : 1,
    mainSchemeCardId: "45121a" as typeof config.mainSchemeCardId,
    encounterDeck: [...config.encounterDeck, ...cardsOfSet("dark_beast").map(cardId)],
    setAsideModularSets: sets.map((set) => ({ encounterSetId: set, cardIds: cardsOfSet(set).map(cardId) })),
    setAsideUntilCalled: { encounterSetIds: sets.map((set) => encounterSetId(set)) },
  };
}
function setupGame(opts: Opts = {}): GameState {
  const deps = opts.deps ?? DEPS;
  const created = createGame(setupConfig(opts), deps);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", deps);
}

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const piles = (s: GameState) => s.encounterDecks[activeEncounterDeckId(s)]!;
const inDeck = (s: GameState, code: string) => piles(s).deck.filter((id) => codeOf(s, id) === code);
const inDiscard = (s: GameState, code: string) => piles(s).discard.filter((id) => codeOf(s, id) === code);
const inPlayCards = (s: GameState, code: string) => cardsInPlay(s).filter((id) => codeOf(s, id) === code);
const envsInPlay = (s: GameState): InstanceId[] =>
  cardsInPlay(s).filter((id) => Object.values(ENV_OF).includes(codeOf(s, id)));
const setAsideCount = (s: GameState): number =>
  (s.setAsideModularSets ?? []).reduce((n, set) => n + set.instanceIds.length, 0);
const dataOf = (code: string) =>
  AOA_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
const types = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const stage = (s: GameState): number => villainStageOf(s, s.activeVillainId!).stageNumber;
const beast = (s: GameState): InstanceId => s.activeVillainId!;
const specialThreat = (events: readonly GameEvent[], s: GameState, envId: InstanceId): number =>
  types(events, "threatPlaced")
    .filter((e) => e.schemeInstanceId === s.mainScheme.instanceId && e.sourceInstanceId === envId)
    .reduce((n, e) => n + e.amount, 0);

interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}
/**
 * One end of turn for player 1 (in hero form when `hero`): the villain phase runs with `boosts` the activation's boost
 * cards and `reveals` what the players are then dealt.
 */
function round(
  state: GameState,
  opts: { boosts?: readonly string[]; reveals?: readonly string[]; hero?: boolean; pick?: Picker } = {},
): Run {
  const calm = state.players.reduce(
    (acc, p) => patchInstance(acc, p.identity.instanceId, { damage: 0 }),
    patchInstance(state, state.mainScheme.instanceId, { threat: 0 }),
  );
  // With nothing named, the player is dealt a harmless Rhino card (a random dark_beast card would act).
  const filler = ["01098", "01100", "01099"].find((code) => piles(calm).deck.some((id) => codeOf(calm, id) === code));
  const stacked = stackEncounterDeck(calm, ...(opts.boosts ?? [BLANK]), ...(opts.reveals ?? [filler!]));
  const form = opts.hero ? withForm(stacked, { heroForm: 0 }) : withForm(stacked, "alterEgo");
  return driveEventsPicking(DEPS, form, opts.pick ?? firstLegal, endTurn(P1));
}

describe("registry", () => {
  it("registers the sixteen refs of the seven cards, each a valid definition; nothing is skipped", () => {
    expect(Object.keys(DARK_BEAST).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(DARK_BEAST)) expect(validateDefinition(def), id).toEqual([]);
    expect(Object.keys(DARK_BEAST_SKIPPED)).toEqual([]);
  });

  it("the data names exactly these refs", () => {
    const abilityIds = (card: Record<string, unknown>): string[] =>
      ((card.abilities ?? []) as { id: string }[]).map((a) => a.id);
    const stages = (dataOf("45118").sides as { stages: Record<string, unknown>[] }[])[0]!.stages;
    const mainStage = (dataOf("45121a").stages as { abilities: { id: string }[] }[])[0]!;
    const refs = [
      ...stages.flatMap(abilityIds),
      ...(mainStage.abilities ?? []).map((a) => a.id),
      ...((mainStage as unknown as { aSide: { abilities: { id: string }[] } }).aSide.abilities ?? []).map((a) => a.id),
      ...["45122", "45123", "45124", "45125", "45126"].flatMap((code) => abilityIds(dataOf(code))),
    ];
    expect(refs.sort()).toEqual([...REFS, ...Object.keys(DARK_BEAST_SKIPPED)].sort());
  });
});

describe("setup (standard, 1 player)", () => {
  it("one Setting environment is in play, the 7 other cards of its set are in the deck, 16 cards stay set aside", () => {
    const s = setupGame();
    expect(envsInPlay(s)).toHaveLength(1);
    expect(setAsideCount(s)).toBe(16);
    expect(playerOf(s, P1).dealtEncounter).toHaveLength(0);
    const set = Object.entries(ENV_OF).find(([, code]) => code === codeOf(s, envsInPlay(s)[0]!))![0];
    const members = cardsOfSet(set).filter((code) => code !== ENV_OF[set as SetName]);
    expect(members).toHaveLength(7);
    for (const code of new Set(members))
      expect(inDeck(s, code).length, code).toBe(members.filter((c) => c === code).length);
  });

  it("the same seed gives the same environment; seeds differ across the three", () => {
    const pick = (seed: number) => codeOf(setupGame({ seed }), envsInPlay(setupGame({ seed }))[0]!);
    expect(pick(1)).toBe(pick(1));
    const seen = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(pick));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("is Dark Beast I with 15 hit points per hero", () => {
    const s = setupGame();
    expect(codeOf(s, beast(s))).toBe(BEAST_I);
    expect(stage(s)).toBe(1);
    expect(maxHitPoints(s, beast(s), DEPS)).toBe(15);
  });
});

describe("setup (expert)", () => {
  it("Dark Beast II is the villain, High-Tech Goggles is attached to him (SCH 2 + 1), and each player has a facedown card", () => {
    const s = setupGame({ expert: true, seats: [SPIDER_MAN, CAPTAIN_MARVEL] });
    expect(stage(s)).toBe(2);
    const goggles = inPlayCards(s, GOGGLES);
    expect(goggles).toHaveLength(1);
    expect(inst(s, goggles[0]!).attachedTo).toBe(beast(s));
    expect(envsInPlay(s)).toHaveLength(1);
    for (const p of s.players) expect(playerOf(s, p.playerId).dealtEncounter).toHaveLength(1);
  });
});

describe("stage II", () => {
  it("1 player: Dark Beast I defeated reveals stage II: a second environment, the first discarded, 8 set aside, 1 facedown card", () => {
    const s0 = setupGame();
    const first = codeOf(s0, envsInPlay(s0)[0]!);
    const done = defeatWithAttack(DEPS, withForm(s0, { heroForm: 0 }), beast(s0), P1);
    expect(stage(done)).toBe(2);
    const envs = envsInPlay(done);
    expect(envs).toHaveLength(1);
    expect(codeOf(done, envs[0]!)).not.toBe(first);
    expect(inDiscard(done, first)).toHaveLength(1);
    expect(setAsideCount(done)).toBe(8);
    expect(playerOf(done, P1).dealtEncounter).toHaveLength(1);
  });
});

describe("the Special through Dark Beast's Forced Interrupt", () => {
  it("The Savage Land: when Dark Beast attacks you, 3 cards are discarded from your deck, and he has retaliate 1", () => {
    const s = setupGame({ sets: ["savage_land"] });
    expect(hasKeyword(s, beast(s), "retaliate", DEPS)).toBe(true);
    const run = round(s, { hero: true });
    expect(types(run.events, "attackResolved").map((e) => e.enemyInstanceId)).toContain(beast(s));
    const milled = types(run.events, "cardMoved").filter((e) => e.from.kind === "deck" && e.to.kind === "discard");
    expect(milled.filter((e) => e.from.kind === "deck" && e.from.playerId === P1)).toHaveLength(3);
  });

  it("Genosha: 1 threat on the main scheme, and he has steady", () => {
    const s = setupGame({ sets: ["genosha"] });
    expect(hasKeyword(s, beast(s), "steady", DEPS)).toBe(true);
    const run = round(s, { hero: true });
    expect(specialThreat(run.events, run.state, envsInPlay(s)[0]!)).toBe(1);
  });

  it("Blue Area of the Moon: 1 damage to your identity, and each minion has guard", () => {
    const s = setupGame({ sets: ["blue_moon"] });
    const run = round(s, { hero: true });
    // Dark Beast's attack of 2 plus the Special's 1 damage (no boost icons on a blank card).
    expect(inst(run.state, identityOf(run.state, P1)).damage).toBe(3);
  });

  it("an alter-ego player is schemed against: his attack interrupt does not trigger, so no Special", () => {
    const s = setupGame({ sets: ["genosha"] });
    const run = round(s, { hero: false });
    expect(specialThreat(run.events, run.state, envsInPlay(s)[0]!)).toBe(0);
  });
});

describe("High-Tech Goggles (45122) and Genetic Enhancement (45123)", () => {
  it("are data: attach to Dark Beast with +1 SCH / +1 ATK", () => {
    expect(dataOf(GOGGLES).attachesTo).toEqual({ kind: "namedVillain", name: "Dark Beast" });
    expect(dataOf(GOGGLES).statModifiers).toEqual({ sch: 1 });
    expect(dataOf(ENHANCEMENT).statModifiers).toEqual({ atk: 1 });
  });

  it("[star] BOOST: as Dark Beast's boost card it attaches to him instead of being discarded", () => {
    for (const code of [GOGGLES, ENHANCEMENT]) {
      const s = setupGame({ sets: ["savage_land"] });
      const run = round(s, { boosts: [code], hero: true });
      const attached = inPlayCards(run.state, code);
      expect(attached, code).toHaveLength(1);
      expect(inst(run.state, attached[0]!).attachedTo).toBe(beast(s));
      expect(inDiscard(run.state, code)).toHaveLength(0);
    }
  });
});

describe("the Hero Actions of Goggles and Enhancement: the exhaust and the Special are the cost (§3.24)", () => {
  const CODES = [
    [GOGGLES, "45122.high-tech-goggles-action"],
    [ENHANCEMENT, "45123.genetic-enhancement-action"],
  ] as const;
  /** `code` attached to Dark Beast (surgery, as a boost or reveal would), player 1 in hero form. */
  const staged = (code: string, sets: readonly SetName[]) => {
    const s0 = setupGame({ sets });
    const attached = attachToHost(s0, code, beast(s0));
    return { state: withForm(attached.state, { heroForm: 0 }), id: attached.id };
  };
  const offer = (state: GameState, ref: string) => {
    const actions = legalActions(state, P1, DEPS);
    if (actions.kind !== "turn") throw new Error(`not player 1's turn: ${actions.kind}`);
    return actions.legal.find((a) => a.action.kind === "useAbility" && (a.action.abilityId as string) === ref);
  };
  const hero = (s: GameState) => inst(s, identityOf(s, P1));

  for (const [code, ref] of CODES) {
    it(`${code} with Blue Area of the Moon in play: the hero exhausts, takes 1 damage, the card is discarded`, () => {
      const { state, id } = staged(code, ["blue_moon"]);
      expect(offer(state, ref)).toBeDefined();
      const run = driveEventsPicking(DEPS, state, firstLegal, use(P1, id, ref));
      expect(hero(run.state).exhausted).toBe(true);
      expect(hero(run.state).damage).toBe(hero(state).damage + 1);
      expect(inPlayCards(run.state, code)).toHaveLength(0);
      expect(inDiscard(run.state, code)).toHaveLength(1);
      expect(types(run.events, "resolveAbilityCostSettled")).toMatchObject([{ trigger: "special", paid: true }]);
    });

    it(`${code} with the hero already exhausted: the action is not offered`, () => {
      const { state, id } = staged(code, ["blue_moon"]);
      const tired = patchInstance(state, identityOf(state, P1), { exhausted: true });
      expect(offer(tired, ref)).toBeUndefined();
      expect(() => driveEventsPicking(DEPS, tired, firstLegal, use(P1, id, ref))).toThrow();
    });

    it(`${code} with no Setting environment in play: the action is not offered`, () => {
      const { state, id } = staged(code, []);
      expect(envsInPlay(state)).toHaveLength(0);
      expect(offer(state, ref)).toBeUndefined();
      expect(() => driveEventsPicking(DEPS, state, firstLegal, use(P1, id, ref))).toThrow();
      expect(inPlayCards(state, code)).toHaveLength(1);
    });
  }

  it("Q7 = A: under The Savage Land with an empty deck and discard pile the Special changes nothing, so no action", () => {
    const { state } = staged(GOGGLES, ["savage_land"]);
    expect(offer(state, CODES[0][1])).toBeDefined();
    const empty: GameState = {
      ...state,
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, deck: [], discard: [] } : p)),
    };
    expect(offer(empty, CODES[0][1])).toBeUndefined();
  });

  it("Q15 = A: with two Setting environments in play the player picks whose Special pays the cost", () => {
    const { state: one, id } = staged(GOGGLES, ["genosha", "blue_moon"]);
    // The other set's Setting joins the one in play (surgery: a reveal would discard the first).
    const [GENOSHA_ID, MOON_ID] = [GENOSHA_ENV, BLUE_AREA].map(
      (code) => Object.keys(one.instances).find((i) => codeOf(one, i as InstanceId) === code) as InstanceId,
    );
    const [genosha, moon] = [GENOSHA_ID!, MOON_ID!];
    const added = envsInPlay(one).includes(genosha) ? moon : genosha;
    const state: GameState = {
      ...patchInstance(one, added, { faceup: true }),
      setAsideModularSets: (one.setAsideModularSets ?? []).map((set) => ({
        ...set,
        instanceIds: set.instanceIds.filter((i) => i !== added),
      })),
      villainArea: [...one.villainArea, added],
    };
    expect(envsInPlay(state).sort()).toEqual([genosha, moon].sort());
    const ref = CODES[0][1];
    expect([...offer(state, ref)!.targets].sort()).toEqual([genosha, moon].sort());
    expect(() => driveEventsPicking(DEPS, state, firstLegal, use(P1, id, ref))).toThrow();

    const viaMoon = driveEventsPicking(DEPS, state, firstLegal, use(P1, id, ref, [], { setting: [moon] }));
    expect(hero(viaMoon.state).damage).toBe(hero(state).damage + 1);
    expect(specialThreat(viaMoon.events, viaMoon.state, genosha)).toBe(0);

    const viaGenosha = driveEventsPicking(DEPS, state, firstLegal, use(P1, id, ref, [], { setting: [genosha] }));
    expect(hero(viaGenosha.state).damage).toBe(hero(state).damage);
    expect(specialThreat(viaGenosha.events, viaGenosha.state, genosha)).toBe(1);
  });
});

describe("Cruel Experiment (45124)", () => {
  it("is data: +1 ATK and +1 SCH, 2 boost icons, two copies", () => {
    expect(dataOf(EXPERIMENT).statModifiers).toEqual({ atk: 1, sch: 1 });
    expect(dataOf(EXPERIMENT).boostIcons).toBe(2);
    expect(dataOf(EXPERIMENT).quantityInSet).toBe(2);
  });

  it("WHEN REVEALED: discards cards from the top until a minion, reveals it and attaches itself: +2 hit points, guard", () => {
    const s = setupGame({ sets: ["savage_land"] });
    // A Hydra Mercenary (3 hit points, printed guard) is the first minion under the Experiment; the harmless card goes.
    const run = round(s, { boosts: [BLANK], reveals: [EXPERIMENT, "01098", MERCENARY] });
    const minions = cardsInPlay(run.state).filter((id) => codeOf(run.state, id) === MERCENARY);
    expect(minions).toHaveLength(1);
    const host = minions[0]!;
    const experiment = inPlayCards(run.state, EXPERIMENT);
    expect(experiment).toHaveLength(1);
    expect(inst(run.state, experiment[0]!).attachedTo).toBe(host);
    expect(inDiscard(run.state, "01098")).toHaveLength(1);
    expect(maxHitPoints(run.state, host, DEPS)).toBe(5);
    expect(hasKeyword(run.state, host, "guard", DEPS)).toBe(true);
  });

  // docs/phase7-wave8.md §3.25, ruling February 20, 2026 – Ruling 4: the card prints no "attach to", so it is turned
  // faceup out of play and its own When Revealed attaches it.
  it("§3.25 test 1: a treachery and a side scheme are discarded, Velociraptor is revealed and attacks at its own ATK, then the card attaches", () => {
    const s = setupGame({ sets: ["savage_land"] });
    const run = round(s, { boosts: [BLANK], reveals: [EXPERIMENT, BLANK_2, SIDE_SCHEME, RAPTOR], hero: true });
    const raptor = inPlayCards(run.state, RAPTOR)[0]!;
    const experiment = inPlayCards(run.state, EXPERIMENT)[0]!;
    expect(inDiscard(run.state, BLANK_2)).toHaveLength(1);
    expect(inDiscard(run.state, SIDE_SCHEME)).toHaveLength(1);
    expect(inPlayCards(run.state, SIDE_SCHEME)).toHaveLength(0);
    expect(types(run.events, "encounterCardRevealed").map((e) => codeOf(run.state, e.instanceId))).toEqual([
      EXPERIMENT,
      RAPTOR,
    ]);
    expect(inst(run.state, raptor).engagedWith).toBe(P1);
    // Its quickstrike attack: printed ATK 1 (the card's +1 is not on it yet), plus its own discard's icons.
    const attack = types(run.events, "attackResolved").filter((e) => e.enemyInstanceId === raptor);
    expect(attack).toHaveLength(1);
    const attackAt = run.events.indexOf(attack[0]!);
    const attachedAt = run.events.findIndex(
      (e) => e.type === "cardMoved" && e.instanceId === experiment && e.to.kind === "attachment",
    );
    expect(attachedAt).toBeGreaterThan(attackAt);
    const mill = run.events
      .slice(0, attackAt)
      .filter((e) => e.type === "cardMoved" && e.from.kind === "deck" && e.to.kind === "discard");
    // The Savage Land's Special for Dark Beast's attack (3), then Velociraptor's own discard (1).
    expect(mill).toHaveLength(4);
    const discarded = (mill[3] as { instanceId: InstanceId }).instanceId;
    const icons = Object.values(showingResources(run.state, discarded)).reduce((n, v) => n + (v ?? 0), 0);
    expect(printedProfile(run.state, raptor)!.atk).toBe(1);
    expect(attack[0]!.baseAtk).toBe(1 + icons);
    // Then attached: 3 + 2 hit points, guard, SCH 1 + 1, ATK 1 + 1.
    expect(inst(run.state, experiment).attachedTo).toBe(raptor);
    expect(maxHitPoints(run.state, raptor, DEPS)).toBe(5);
    expect(hasKeyword(run.state, raptor, "guard", DEPS)).toBe(true);
    expect(characterProfile(run.state, raptor, DEPS)).toMatchObject({ sch: 2, atk: 2 });
  });

  it("§3.25 test 2: no minion in the 4 cards of the deck: 4 discarded, the deck reset with one acceleration token, nothing revealed, the card discarded", () => {
    const s = setupGame({ sets: ["savage_land"] });
    const calm = patchInstance(s, s.mainScheme.instanceId, { threat: 0 });
    const stacked = stackEncounterDeck(calm, BLANK, EXPERIMENT, BLANK_2, SIDE_SCHEME, "01098", "01100");
    // The deck is those six cards and nothing else (surgery): the boost card, the dealt card, and four without a minion.
    const six: GameState = {
      ...stacked,
      encounterDecks: {
        ...stacked.encounterDecks,
        [activeEncounterDeckId(stacked)]: { deck: piles(stacked).deck.slice(0, 6), discard: [] },
      },
    };
    const run = driveEventsPicking(DEPS, withForm(six, "alterEgo"), firstLegal, endTurn(P1));
    const searched = types(run.events, "cardMoved").filter(
      (e) => e.from.kind === "encounterDeck" && e.to.kind === "encounterDiscard",
    );
    expect(searched).toHaveLength(4);
    expect(types(run.events, "accelerationTokenAdded")).toHaveLength(1);
    expect(types(run.events, "encounterCardRevealed").map((e) => codeOf(run.state, e.instanceId))).toEqual([
      EXPERIMENT,
    ]);
    expect(inPlayCards(run.state, EXPERIMENT)).toHaveLength(0);
    expect(inDiscard(run.state, EXPERIMENT)).toHaveLength(1);
    expect(piles(run.state).deck).toHaveLength(5);
  });
});

describe("Evil Genius (45125)", () => {
  it("is data: a treachery with 1 boost icon, three copies", () => {
    expect(dataOf(GENIUS).type).toBe("treachery");
    expect(dataOf(GENIUS).quantityInSet).toBe(3);
  });

  it("WHEN REVEALED (Alter-Ego): Dark Beast schemes, then gets a tough status card", () => {
    const s = setupGame({ sets: ["savage_land"] });
    const run = round(s, { boosts: [BLANK], reveals: [GENIUS] });
    const schemes = types(run.events, "schemeResolved").filter((e) => e.enemyInstanceId === beast(s));
    // His own activation in the villain phase, then the one from the treachery.
    expect(schemes).toHaveLength(2);
    expect(inst(run.state, beast(run.state)).statuses.tough).toBe(1);
  });

  it("WHEN REVEALED (Hero): Dark Beast attacks you with one additional boost card (two boost cards), no tough card", () => {
    const s = setupGame({ sets: ["savage_land"] });
    const run = round(s, { boosts: [BLANK], reveals: [GENIUS, BLANK_2, BLANK], hero: true });
    const attacks = types(run.events, "attackResolved").filter((e) => e.enemyInstanceId === beast(s));
    expect(attacks).toHaveLength(2);
    const dealt = types(run.events, "boostCardDealt").filter((e) => e.enemyInstanceId === beast(s));
    expect(dealt).toHaveLength(3);
    expect(inst(run.state, beast(run.state)).statuses.tough).toBe(0);
  });
});

describe("Time-Travel Shenanigans (45126)", () => {
  it("is data: a side scheme of 2 threat per hero with acceleration, two copies", () => {
    expect(dataOf(TIME_TRAVEL).startingThreat).toEqual({ base: 0, perPlayer: 2 });
    expect(dataOf(TIME_TRAVEL).icons).toEqual(["acceleration"]);
    expect(dataOf(TIME_TRAVEL).quantityInSet).toBe(2);
  });

  it("WHEN DEFEATED: the defeating player discards until a card of the Setting environment's set and reveals it", () => {
    const s0 = round(setupGame({ sets: ["savage_land"] }), { boosts: [BLANK], reveals: [TIME_TRAVEL] }).state;
    const scheme = inPlayCards(s0, TIME_TRAVEL)[0]!;
    // The next cards: a Rhino card that is not of the set, then Pterosaur (45128, of the Savage Land set).
    const stacked = stackEncounterDeck(s0, "01098", "45128");
    const active = stacked.step.phase === "player" && stacked.step.kind === "turn" ? stacked.step.activePlayerId : P1;
    expect(active).toBe(P1);
    const hero = withForm(patchInstance(stacked, scheme, { threat: 1 }), { heroForm: 0 });
    const done = driveEventsPicking(DEPS, hero, firstLegal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(hero, P1),
      schemeInstanceId: scheme,
    });
    expect(inDiscard(done.state, "01098")).toHaveLength(1);
    expect(types(done.events, "encounterCardRevealed").map((e) => codeOf(done.state, e.instanceId))).toContain("45128");
  });
});
