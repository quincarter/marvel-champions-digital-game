import { abilityId, AOS_CARDS, CORE_CARDS } from "@mc/content";
import {
  cardsInPlay,
  createGame,
  hasKeyword,
  maxHitPoints,
  remainingHitPoints,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../ability-refs.js";
import {
  addCounters,
  defineAbilities,
  mergeRegistries,
  placeThreat,
  theMainScheme,
  whenRevealed,
} from "../../dsl/index.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  P3,
  P4,
  endTurn,
  firstLegal,
  inst,
  mainThreat,
  patchInstance,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, withDamage, withForm } from "../../testing/staging.js";
import { engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { wave9Scenario } from "../setup.js";
import {
  CAPTAIN_MARVEL,
  IRON_MAN,
  SHE_HULK,
  SPIDER_MAN,
  codeOf,
  dataOf,
  heroAttacks,
  intoVictoryDisplay,
  piles,
  revealedCodes,
  types,
} from "../testing.js";
import { GRAVITATIONAL_PULL } from "./gravitational-pull.js";
import { PALE_LITTLE_SPIDER } from "./pale-little-spider.js";
import { POWER_OF_THE_ATOM } from "./power-of-the-atom.js";
import { SUPERSONIC } from "./supersonic.js";
import { THE_LEAPER } from "./the-leaper.js";
import { THUNDERBOLTS, THUNDERBOLTS_SKIPPED } from "./thunderbolts.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Thunderbolts scenario (MC50 p. 15; docs/phase7-wave9.md sections 2.5, 3.21 to 3.24): Citizen V 50129a/b,
 * Apprehending Rogue Agents 50130a/b, Justice, Like Lightning / Thunderbolt Backup 50131a/b and the set's cards
 * 50132 to 50138. The real `thunderbolts` scenario builder, hero form for every seat. The modular pool includes sets
 * not scripted yet (Hard Sound, Techno, Whiteout), so each game names its sets (`setAsideModularSetIds`) among the
 * five scripted ones: Gravitational Pull (Moonstone 50139), Pale Little Spider (Black Widow 50148), Power of the Atom
 * (Radioactive Man 50152), Supersonic (MACH-IV 50156) and The Leaper (Batroc 50161).
 *
 * Owner questions named below (docs/phase7-wave9.md section 4.1): Q2 = A (a stunned or confused Citizen V who would
 * activate discards the status and does not heal), Q25 (a held minion that engages quickstrikes), Q26 = B (the
 * remaining minion is revealed by the first player, its When Revealed resolving, and enters play held), Q27 (the
 * environment leaving play discards the held minion undefeated), Q29 = B (Down but Not Out is removed from the game
 * even when no minion returned).
 */
const DEPS: EngineDeps = {
  abilities: mergeRegistries(
    WAVE8_ABILITIES,
    THUNDERBOLTS,
    GRAVITATIONAL_PULL,
    PALE_LITTLE_SPIDER,
    POWER_OF_THE_ATOM,
    SUPERSONIC,
    THE_LEAPER,
  ),
};
const SEATS = [SPIDER_MAN, IRON_MAN, CAPTAIN_MARVEL, SHE_HULK] as const;
const PLAYERS = [P1, P2, P3, P4] as const;
/** Sets for 1 to 4 players: 1 + players of the five scripted ones. */
const SETS = [
  ["supersonic", "the_leaper"],
  ["gravitational_pull", "supersonic", "the_leaper"],
  ["gravitational_pull", "supersonic", "the_leaper", "power_of_the_atom"],
  ["gravitational_pull", "supersonic", "the_leaper", "power_of_the_atom", "pale_little_spider"],
] as const;
/** The Elite, Thunderbolt minion of each of the five sets. */
const ELITES = ["50139", "50148", "50152", "50156", "50161"];
const MOONSTONE = "50139";
const MACH_IV = "50156";
const BATROC = "50161";
const JOLT = "50133";
const CITIZEN_V = "50129a";
const JUSTICE = "50131a";
const SWORD = "50132";
const BYSTANDERS = "50134";
const COMING_STORM = "50135";
const RUMBLING_THUNDER = "50136";
const DOWN = "50137";
const TAP_IN = "50138";
/** Core treacheries with no boost icon and no Boost ability: the encounter deck's top cards that serve as boost cards. */
const BLANKS = ["01186", "01186", "01187", "01187"];

const REGISTERED = [
  "50129a.citizen-v-constant",
  "50129a.citizen-v-forced-interrupt",
  "50129b.citizen-v-constant",
  "50129b.citizen-v-forced-interrupt",
  "50130a.setup",
  "50130b.apprehending-rogue-agents-constant",
  "50130b.apprehending-rogue-agents-forced-response",
  "50131a.when-revealed",
  "50131b.thunderbolt-backup-forced-interrupt",
  "50132.when-revealed",
  "50132.citizen-vs-sword-response",
  "50133.when-defeated",
  "50133.jolt-action",
  "50134.innocent-bystanders-constant",
  "50134.innocent-bystanders-forced-response",
  "50135.when-revealed",
  "50136.when-revealed",
  "50137.when-revealed",
  "50138.when-revealed",
];

type Mode = "standard" | "expert";

/** The scenario past setup, every seat in hero form. */
function game(
  players = 2,
  mode: Mode = "standard",
  seed = 1,
  sets: readonly string[] = SETS[players - 1]!,
  fixSwordData = false,
): GameState {
  const built = wave9Scenario("thunderbolts", {
    players: SEATS.slice(0, players),
    seed,
    difficulty: mode,
    setAsideModularSetIds: sets,
  });
  // The Sword's data once glued the next sentence into its `attachesTo` name; it now reads `{ kind: "villain" }`
  // (packages/content, c55024be). The override below pins that value for the Sword tests and changes nothing.
  const config = fixSwordData
    ? {
        ...built,
        cards: built.cards.map((c) => (c.id === SWORD ? { ...c, attachesTo: { kind: "villain" as const } } : c)),
      }
    : built;
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let state = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  for (let p = 0; p < players; p++) state = withForm(state, { heroForm: 0 }, state.players[p]!.playerId);
  return state;
}
const villainOf = (s: GameState): InstanceId => s.villains[0]!.instanceId;
const allIds = (s: GameState): InstanceId[] => Object.keys(s.instances) as InstanceId[];
const idsOf = (s: GameState, code: string): InstanceId[] => allIds(s).filter((i) => codeOf(s, i) === code);
const inPlay = (s: GameState, code: string): InstanceId | undefined =>
  idsOf(s, code).find((i) => cardsInPlay(s).includes(i));
const environmentOf = (s: GameState): InstanceId => inPlay(s, JUSTICE)!;
/** The Thunderbolt minions in play (the Elite ones of the sets, Jolt, anything engaged), held ones included. */
const thunderbolts = (s: GameState): InstanceId[] =>
  cardsInPlay(s).filter((i) => ELITES.includes(codeOf(s, i)) || codeOf(s, i) === JOLT);
const heldOf = (s: GameState): InstanceId | undefined => thunderbolts(s).find((i) => inst(s, i).heldMinion);
const engagedWith = (s: GameState, id: InstanceId): PlayerId | null => inst(s, id).engagedWith;
const minionOf = (s: GameState, player: PlayerId): InstanceId | undefined =>
  thunderbolts(s).find((i) => engagedWith(s, i) === player);
const deckCodes = (s: GameState): string[] => [...piles(s).deck, ...piles(s).discard].map((i) => codeOf(s, i));
const hpOf = (s: GameState, id: InstanceId): number => maxHitPoints(s, id, DEPS)!;
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const toughOf = (s: GameState, id: InstanceId): number => inst(s, id).statuses.tough;
/** A minion taken out of play (set aside), by surgery: it is engaged with nobody and in nobody's area. */
function setAsideNow(state: GameState, id: InstanceId): GameState {
  const { heldMinion: _held, ...rest } = inst(state, id);
  const host = rest.attachedTo;
  const instances = { ...state.instances, [id]: { ...rest, engagedWith: null, attachedTo: null } };
  if (host)
    instances[host] = { ...instances[host]!, attachments: instances[host]!.attachments.filter((a) => a !== id) };
  return {
    ...state,
    instances,
    players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => i !== id) })),
    encounterSetAside: [...state.encounterSetAside, id],
  };
}
/**
 * The encounter deck's top cards, first card first: `boosts` blank boost cards (one per activation of a villain or
 * villainous minion), then one Innocent Bystanders (an obligation that does nothing when dealt) per player, which step
 * three of the villain phase deals.
 */
const stack = (s: GameState, boosts: number): GameState =>
  stackEncounterDeck(s, ...BLANKS.slice(0, boosts), ...s.players.map(() => BYSTANDERS));
/** Every player ends their turn and the villain phase runs. */
const villainPhase = (s: GameState, pick: Picker = firstLegal) =>
  driveEventsPicking(DEPS, s, pick, ...s.players.map((p) => endTurn(p.playerId)));
const schemesOf = (s: GameState, events: readonly GameEvent[]) =>
  types(events, "schemeResolved").filter((a) => codeOf(s, a.enemyInstanceId) === CITIZEN_V);
const attacksBy = (s: GameState, events: readonly GameEvent[], code: string) =>
  types(events, "attackResolved").filter((a) => codeOf(s, a.enemyInstanceId) === code);

describe("registry", () => {
  it("registers every ref of the module's cards, each a valid definition, and skips none", () => {
    expect(Object.keys(THUNDERBOLTS).sort()).toEqual([...REGISTERED].sort());
    for (const [id, def] of Object.entries(THUNDERBOLTS)) expect(validateDefinition(def), id).toEqual([]);
    expect(THUNDERBOLTS_SKIPPED).toEqual({});
  });

  it("the data names exactly the registered refs for the module's cards", () => {
    const ids = AOS_CARDS.filter((c) => /^5012[9]|^5013[0-8]/.test(c.id)).map((c) => c.id);
    const refs = ids.flatMap((id) => abilityRefIds(AOS_CARDS.find((c) => c.id === id)!));
    expect([...new Set(refs)].sort()).toEqual([...REGISTERED].sort());
  });
});

describe("Citizen V data (50129a/b)", () => {
  const stages = () =>
    (
      dataOf("50129a").sides as {
        stages: { atk: number; sch: number; hp: { base: number; perPlayer: number } }[];
      }[]
    )[0]!.stages;
  it("(A): ATK 2, SCH 2, 12 hit points per player; (B): ATK 2, SCH 3, 16 per player", () => {
    const [a, b] = stages();
    expect([a!.atk, a!.sch, a!.hp]).toEqual([2, 2, { base: 0, perPlayer: 12 }]);
    expect([b!.atk, b!.sch, b!.hp]).toEqual([2, 3, { base: 0, perPlayer: 16 }]);
  });

  it("standard: (A) with 12 per player; expert: (B) with 16 per player, at one and two players", () => {
    for (const players of [1, 2]) {
      const std = game(players);
      expect(codeOf(std, villainOf(std))).toBe("50129a");
      expect(std.villains[0]!.stageIndex).toBe(0);
      expect(maxHitPoints(std, villainOf(std), DEPS)).toBe(12 * players);
      const exp = game(players, "expert");
      expect(exp.villains[0]!.stageIndex).toBe(1);
      expect(maxHitPoints(exp, villainOf(exp), DEPS)).toBe(16 * players);
    }
  });
});

describe("setup (50130a, 50131a)", () => {
  it("one player: two sets, their Elite minions set aside, one revealed to the player and one held; no Elite in the deck", () => {
    const s = game(1);
    expect(environmentOf(s)).toBeDefined();
    expect(s.encounterSetAside.filter((i) => ELITES.includes(codeOf(s, i)))).toEqual([]);
    const minions = thunderbolts(s);
    expect(minions.map((i) => codeOf(s, i)).sort()).toEqual([BATROC, MACH_IV].sort());
    expect(minions.filter((i) => engagedWith(s, i) === P1)).toHaveLength(1);
    const held = heldOf(s)!;
    expect(inst(s, held)).toMatchObject({ attachedTo: environmentOf(s), engagedWith: null, heldMinion: true });
    // The rest of each chosen set is in the encounter deck, Jolt with the Thunderbolts set; no Elite minion is.
    const deck = deckCodes(s);
    for (const elite of ELITES) expect(deck).not.toContain(elite);
    expect(deck).toContain(JOLT);
    expect(deck).toContain("50162"); // Coup de Foudre, the rest of The Leaper
    expect(deck).not.toContain(MOONSTONE); // Gravitational Pull is not one of this game's sets
    expect(s.setAsideModularSets ?? []).toEqual([]);
  });

  it("two players: three sets, two minions revealed (one each) and one held; the Elite of an unchosen set is absent", () => {
    const s = game(2);
    const minions = thunderbolts(s);
    expect(minions.map((i) => codeOf(s, i)).sort()).toEqual([MOONSTONE, MACH_IV, BATROC].sort());
    expect(minionOf(s, P1)).toBeDefined();
    expect(minionOf(s, P2)).toBeDefined();
    expect(minionOf(s, P1)).not.toBe(minionOf(s, P2));
    expect(heldOf(s)).toBeDefined();
    expect(s.encounterSetAside.filter((i) => ELITES.includes(codeOf(s, i)))).toEqual([]);
  });

  it("four players: five sets, four minions revealed (one each) and one held", () => {
    const s = game(4);
    expect(thunderbolts(s)).toHaveLength(5);
    for (const player of PLAYERS) expect(minionOf(s, player)).toBeDefined();
    expect(new Set(PLAYERS.map((p) => minionOf(s, p))).size).toBe(4);
    expect(heldOf(s)).toBeDefined();
  });

  it("the choice of who gets which minion, and which is held, follows the seed", () => {
    const held = new Set<string>();
    for (let seed = 1; seed <= 6; seed++) {
      const s = game(2, "standard", seed);
      held.add(codeOf(s, heldOf(s)!));
    }
    expect(held.size).toBeGreaterThan(1);
  });

  it("standard: no tough status card on any of them; expert: one on each of them, the held one too (owner Q26)", () => {
    const std = game(2);
    for (const id of thunderbolts(std)) expect(toughOf(std, id)).toBe(0);
    for (const players of [1, 2, 4]) {
      const exp = game(players, "expert");
      expect(thunderbolts(exp)).toHaveLength(players + 1);
      for (const id of thunderbolts(exp)) expect(toughOf(exp, id)).toBe(1);
    }
  });

  /**
   * Owner decision Q26 = B: "Reveal and attach" is a reveal, so the held minion's When Revealed resolves, the first
   * player resolving it. None of the Elite, Thunderbolt minions in the card data prints a When Revealed, surge or
   * quickstrike, so the real setup's numbers are the same as before; this game gives each of them a test-only
   * "Surge. When Revealed: place 1 threat on the main scheme and 1 revealed counter here" to show the reveal.
   */
  it("Q26: the held minion is revealed by the first player: its When Revealed resolves and its surge deals the first player a card", () => {
    const TEST_REF = "99999.test-elite-when-revealed";
    const deps: EngineDeps = {
      abilities: mergeRegistries(
        DEPS.abilities,
        defineAbilities({ [TEST_REF]: whenRevealed(placeThreat(1, theMainScheme), addCounters("revealed", 1)) }),
      ),
    };
    const built = wave9Scenario("thunderbolts", {
      players: SEATS.slice(0, 2),
      seed: 1,
      difficulty: "standard",
      setAsideModularSetIds: SETS[1],
    });
    const cards = built.cards.map((c) =>
      ELITES.includes(c.id) && c.type === "minion"
        ? {
            ...c,
            keywords: [...c.keywords, { name: "surge" as const }],
            abilities: [...c.abilities, { id: abilityId(TEST_REF) }],
          }
        : c,
    );
    const created = createGame({ ...built, cards }, deps);
    if (!created.ok) throw new Error(created.error.message);
    const s = settle(created.state, firstLegal, (state) => state.step.phase === "player", deps);
    const held = heldOf(s)!;
    expect(inst(s, held)).toMatchObject({ attachedTo: environmentOf(s), engagedWith: null, heldMinion: true });
    // All three were revealed, the held one by the first player: 1 counter each, and 2 + 3 threat on the main scheme.
    for (const id of thunderbolts(s)) expect(inst(s, id).counters.revealed).toBe(1);
    expect(mainThreat(s)).toBe(5);
    expect(s.firstPlayerId).toBe(P1);
    expect((s.revealedThisRound ?? []).filter((r) => r.instanceId === held)).toMatchObject([{ playerId: P1 }]);
    // Each surge dealt its player a facedown card, which waits for the first villain phase (Q22): player 1 has their
    // own minion's and the held minion's, player 2 has one.
    expect(s.players.map((p) => p.dealtEncounter.length)).toEqual([2, 1]);
    for (const p of s.players) for (const id of p.dealtEncounter) expect(inst(s, id).faceup).toBe(false);
    // Control: the real data, where no Elite minion has a When Revealed: 2 threat, nothing dealt.
    const real = game(2);
    expect(mainThreat(real)).toBe(2);
    expect(real.players.map((p) => p.dealtEncounter.length)).toEqual([0, 0]);
    expect((real.revealedThisRound ?? []).filter((r) => r.instanceId === heldOf(real))).toMatchObject([
      { playerId: P1 },
    ]);
  });

  it("the environment was flipped by its own When Revealed, and shows Thunderbolt Backup", () => {
    const s = game(2);
    expect(inst(s, environmentOf(s)).flipped).toBe(true);
  });

  it("the main scheme: 1 threat per player, 11 per player to complete it, 1 acceleration per player; the players lose at it", () => {
    for (const players of [1, 2]) {
      const s = game(players);
      expect(mainThreat(s)).toBe(players);
    }
    const stage = (dataOf("50130a") as unknown as { stages: Record<string, unknown>[] }).stages[0]!;
    expect(stage.startingThreat).toEqual({ base: 0, perPlayer: 1 });
    expect(stage.targetThreat).toEqual({ base: 0, perPlayer: 11 });
    expect(stage.acceleration).toEqual({ base: 0, perPlayer: 1 });
    expect(stage.completionLoses).toBe(true);
  });
});

/** A minion in play moved to the shared victory display, faceup, by surgery (it is not defeated). */
const inVictory = (state: GameState, id: InstanceId): GameState => {
  const out = setAsideNow(state, id);
  return {
    ...out,
    encounterSetAside: out.encounterSetAside.filter((i) => i !== id),
    victoryDisplay: [...out.victoryDisplay, id],
    instances: { ...out.instances, [id]: { ...out.instances[id]!, faceup: true } },
  };
};
const ready = (s: GameState): GameState => ({
  ...s,
  instances: Object.fromEntries(Object.entries(s.instances).map(([k, v]) => [k, { ...v, exhausted: false }])) as never,
});
const villainDefeated = (s: GameState): boolean => s.villains[0]!.defeated;

describe("Citizen V cannot be defeated unless there are 1[per_hero] Thunderbolt minions in the victory display", () => {
  /** Two players, no minion engaged with player 1 (no guard in the way), Citizen V one hit from his last point. */
  function nearlyDefeated(players: 1 | 2 = 2, mode: Mode = "standard"): GameState {
    let s = game(players, mode);
    s = setAsideNow(s, minionOf(s, P1)!);
    return withDamage(s, villainOf(s), hpOf(s, villainOf(s)) - 1);
  }
  const hit = (s: GameState, target: InstanceId = villainOf(s)) => heroAttacks(DEPS, ready(s), target).state;
  /** A Thunderbolt minion defeated by an attack of player 1's: it goes to the victory display (Victory X). */
  const slay = (s: GameState, id: InstanceId): GameState => hit(withDamage(s, id, hpOf(s, id) - 1), id);

  it("with no Thunderbolt minion in the victory display he stays in play at 0 hit points", () => {
    for (const players of [1, 2] as const) {
      const after = hit(nearlyDefeated(players));
      expect(remainingHitPoints(after, villainOf(after), DEPS)).toBeLessThanOrEqual(0);
      expect(villainDefeated(after)).toBe(false);
      expect(after.outcome).toBeNull();
    }
  });

  it("two players: one Thunderbolt minion in the display is not enough; the second defeats him at once", () => {
    let s = hit(nearlyDefeated());
    s = slay(s, heldOf(s)!);
    expect(s.victoryDisplay.map((i) => codeOf(s, i))).toHaveLength(1);
    expect(villainDefeated(s)).toBe(false);
    s = slay(s, minionOf(s, P2)!);
    expect(s.victoryDisplay).toHaveLength(2);
    expect(villainDefeated(s)).toBe(true);
    expect(s.outcome).toMatchObject({ result: "win" });
  });

  it("one player: the first Thunderbolt minion in the display is enough", () => {
    let s = hit(nearlyDefeated(1));
    expect(villainDefeated(s)).toBe(false);
    s = slay(s, heldOf(s)!);
    expect(villainDefeated(s)).toBe(true);
    expect(s.outcome).toMatchObject({ result: "win" });
  });

  it("a card that is not a Thunderbolt minion in the display does not count", () => {
    let s = hit(nearlyDefeated(1));
    s = intoVictoryDisplay(s, "01186");
    s = hit(s);
    expect(villainDefeated(s)).toBe(false);
  });

  it("an attack on a Citizen V already at the count defeats him in the usual way", () => {
    let s = nearlyDefeated(1);
    s = inVictory(s, heldOf(s)!);
    s = hit(s);
    expect(villainDefeated(s)).toBe(true);
    expect(s.outcome).toMatchObject({ result: "win" });
  });
});

describe("Citizen V's forced interrupt (step two of the villain phase)", () => {
  const boostsOf = (events: readonly GameEvent[], enemy: InstanceId) =>
    types(events, "boostCardFlipped").filter((b) => b.enemyInstanceId === enemy);
  /** Player 2 has no Thunderbolt minion engaged; player 1 has one. Citizen V has 10 damage. */
  function twoPlayers(mode: Mode = "standard"): GameState {
    let s = game(2, mode);
    s = setAsideNow(s, minionOf(s, P2)!);
    return stack(withDamage(s, villainOf(s), 10), 2);
  }

  it("engaged with a Thunderbolt minion: no attack, no boost card, 4 damage healed (A); a player with none is attacked as usual", () => {
    const s = twoPlayers();
    const { state, events } = villainPhase(s);
    const attacks = attacksBy(s, events, CITIZEN_V);
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.targetInstanceId).toBe(s.players[1]!.identity.instanceId);
    expect(attacks[0]!.damageDealt).toBe(2);
    expect(boostsOf(events, villainOf(s))).toHaveLength(1);
    expect(damageOf(state, villainOf(state))).toBe(6);
  });

  it("(B), expert: 6 damage healed instead", () => {
    const s = twoPlayers("expert");
    const { state, events } = villainPhase(s);
    expect(s.villains[0]!.stageIndex).toBe(1);
    expect(attacksBy(s, events, CITIZEN_V)).toHaveLength(1);
    expect(damageOf(state, villainOf(state))).toBe(4);
  });

  it("it heals no more than the damage on him", () => {
    let s = twoPlayers();
    s = withDamage(s, villainOf(s), 3);
    expect(damageOf(villainPhase(s).state, villainOf(s))).toBe(0);
  });

  it("every player engaged with a Thunderbolt minion: he attacks nobody and heals 4 for each", () => {
    let s = game(2);
    s = stack(withDamage(s, villainOf(s), 10), 2);
    const { state, events } = villainPhase(s);
    expect(attacksBy(s, events, CITIZEN_V)).toHaveLength(0);
    expect(boostsOf(events, villainOf(s))).toHaveLength(0);
    expect(damageOf(state, villainOf(state))).toBe(2);
  });

  it("a player in alter-ego form engaged with a Thunderbolt minion: no scheme, no boost card, 4 damage healed", () => {
    let s = game(1);
    s = withForm(withDamage(s, villainOf(s), 10), "alterEgo", P1);
    s = stack(s, 1);
    const { state, events } = villainPhase(s);
    expect(schemesOf(s, events)).toHaveLength(0);
    expect(boostsOf(events, villainOf(s))).toHaveLength(0);
    expect(damageOf(state, villainOf(state))).toBe(6);
  });

  it("not engaged with a Thunderbolt minion, in alter-ego form: he schemes as usual and heals nothing", () => {
    let s = game(1);
    s = setAsideNow(s, minionOf(s, P1)!);
    s = withForm(withDamage(s, villainOf(s), 10), "alterEgo", P1);
    s = stack(s, 1);
    const { state, events } = villainPhase(s);
    expect(schemesOf(s, events)).toHaveLength(1);
    expect(damageOf(state, villainOf(state))).toBe(10);
  });

  it("owner Q2 = A: a stunned Citizen V, engaged with a Thunderbolt minion, discards the stun card and does not heal", () => {
    let s = game(1);
    s = withDamage(s, villainOf(s), 10);
    s = patchInstance(s, villainOf(s), { statuses: { ...inst(s, villainOf(s)).statuses, stunned: 1 } });
    s = stack(s, 1);
    const { state, events } = villainPhase(s);
    expect(inst(state, villainOf(state)).statuses.stunned).toBe(0);
    expect(damageOf(state, villainOf(state))).toBe(10);
    expect(attacksBy(s, events, CITIZEN_V)).toHaveLength(0);
  });

  it("owner Q2 = A: a stunned Citizen V, engaged with none, discards the stun card and does not attack", () => {
    let s = game(1);
    s = setAsideNow(s, minionOf(s, P1)!);
    s = withDamage(s, villainOf(s), 10);
    s = patchInstance(s, villainOf(s), { statuses: { ...inst(s, villainOf(s)).statuses, stunned: 1 } });
    s = stack(s, 0);
    const { state, events } = villainPhase(s);
    expect(inst(state, villainOf(state)).statuses.stunned).toBe(0);
    expect(damageOf(state, villainOf(state))).toBe(10);
    expect(attacksBy(s, events, CITIZEN_V)).toHaveLength(0);
  });

  it("owner Q2 = A: a confused Citizen V against a player in alter-ego form engaged with a Thunderbolt minion: no heal", () => {
    let s = game(1);
    s = withForm(withDamage(s, villainOf(s), 10), "alterEgo", P1);
    s = patchInstance(s, villainOf(s), { statuses: { ...inst(s, villainOf(s)).statuses, confused: 1 } });
    s = stack(s, 1);
    const { state, events } = villainPhase(s);
    expect(inst(state, villainOf(state)).statuses.confused).toBe(0);
    expect(damageOf(state, villainOf(state))).toBe(10);
    expect(schemesOf(s, events)).toHaveLength(0);
  });

  it("owner Q2 = A: a confused Citizen V against a player in alter-ego form engaged with none: no scheme", () => {
    let s = game(1);
    s = setAsideNow(s, minionOf(s, P1)!);
    s = withForm(withDamage(s, villainOf(s), 10), "alterEgo", P1);
    s = patchInstance(s, villainOf(s), { statuses: { ...inst(s, villainOf(s)).statuses, confused: 1 } });
    s = stack(s, 0);
    const { state, events } = villainPhase(s);
    expect(inst(state, villainOf(state)).statuses.confused).toBe(0);
    expect(damageOf(state, villainOf(state))).toBe(10);
    expect(schemesOf(s, events)).toHaveLength(0);
  });
});

describe("Apprehending Rogue Agents 1B (50130b)", () => {
  const hit = (s: GameState, target: InstanceId, player: PlayerId = P1, pick: Picker = firstLegal) =>
    heroAttacks(DEPS, ready(s), target, { player, pick }).state;

  it("each Thunderbolt minion gains guard: the engaged ones, the held one, and Jolt when she is in play; Citizen V does not", () => {
    let s = game(2);
    const jolt = engageMinion(s, JOLT, P2);
    s = jolt.state;
    for (const id of thunderbolts(s)) expect(hasKeyword(s, id, "guard", DEPS), codeOf(s, id)).toBe(true);
    expect(thunderbolts(s)).toHaveLength(4);
    expect(hasKeyword(s, villainOf(s), "guard", DEPS)).toBe(false);
  });

  it("a held minion's guard stops nobody: a player engaged with nothing attacks the villain past it", () => {
    let s = game(1);
    s = setAsideNow(s, minionOf(s, P1)!);
    const before = damageOf(s, villainOf(s));
    s = hit(s, villainOf(s));
    expect(damageOf(s, villainOf(s))).toBeGreaterThan(before);
    expect(s.pendingChoice).toBeNull();
  });

  it("after a player attacks a Thunderbolt minion engaged with another player, it engages the attacker", () => {
    const s = game(2);
    const theirs = minionOf(s, P2)!;
    const after = hit(s, theirs, P1);
    expect(engagedWith(after, theirs)).toBe(P1);
    expect(after.players[0]!.playArea).toContain(theirs);
    expect(after.players[1]!.playArea).not.toContain(theirs);
    expect(damageOf(after, theirs)).toBeGreaterThan(0);
  });

  it("after a player attacks the held minion, it engages them and nothing is held (until the round ends)", () => {
    const s = game(2);
    const held = heldOf(s)!;
    const after = hit(s, held, P1);
    expect(inst(after, held)).toMatchObject({ engagedWith: P1, attachedTo: null });
    expect(inst(after, held).heldMinion).toBeFalsy();
    expect(inst(after, environmentOf(after)).attachments).not.toContain(held);
    expect(heldOf(after)).toBeUndefined();
  });

  it("a minion the attack defeats does not engage anybody: it goes to the victory display", () => {
    const s = game(2);
    const held = heldOf(s)!;
    const after = hit(withDamage(s, held, hpOf(s, held) - 1), held, P1);
    expect(after.victoryDisplay).toContain(held);
    expect(after.players.flatMap((p) => p.playArea)).not.toContain(held);
    expect(cardsInPlay(after)).not.toContain(held);
  });

  it("Jolt, not Elite, is a Thunderbolt minion too: attacked, she engages the attacker", () => {
    let s = game(2);
    const jolt = engageMinion(s, JOLT, P2);
    s = jolt.state;
    const after = hit(s, jolt.id, P1);
    expect(engagedWith(after, jolt.id)).toBe(P1);
  });

  it("an attack on Citizen V engages nobody", () => {
    let s = game(1);
    s = setAsideNow(s, minionOf(s, P1)!);
    const held = heldOf(s)!;
    const after = hit(s, villainOf(s), P1);
    expect(inst(after, held).heldMinion).toBe(true);
    expect(engagedWith(after, held)).toBeNull();
  });
});

describe("Thunderbolt Backup (50131b): when the round ends, the most damaged Thunderbolt minion is held", () => {
  /** Sets whose Elite minions have no ability that touches a minion's damage or status cards in the villain phase. */
  const SWAP_SETS = ["power_of_the_atom", "pale_little_spider", "the_leaper"];
  interface Roles {
    readonly state: GameState;
    readonly m1: InstanceId;
    readonly m2: InstanceId;
    readonly held: InstanceId;
  }
  /** Two players: `m1` engaged with player 1, `m2` with player 2, `held` by the environment; the damage on each. */
  function table(damage: readonly [number, number, number], mode: Mode = "standard", seed = 1): Roles {
    const base = game(2, mode, seed, SWAP_SETS);
    const [m1, m2, held] = [minionOf(base, P1)!, minionOf(base, P2)!, heldOf(base)!];
    let state = base;
    [m1, m2, held].forEach((id, i) => {
      state = withDamage(state, id, damage[i]!);
    });
    // Both players are engaged with a Thunderbolt minion, so Citizen V gives up both activations; each minion
    // activates once (a boost card each), then a blank obligation is dealt to each player.
    return { state: stack(state, 2), m1, m2, held };
  }
  const noTough = (s: GameState, id: InstanceId): GameState =>
    patchInstance(s, id, { statuses: { ...inst(s, id).statuses, tough: 0 } });
  /** Records who is asked to choose among the tied minions, and picks `target`. */
  const choosing =
    (target: InstanceId | undefined, asked: PlayerId[] = []): Picker =>
    (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind !== "chooseTarget") return firstLegal(s);
      asked.push(choice.playerId);
      const option = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === target);
      return option ? [option.optionId] : firstLegal(s);
    };

  it("the most damaged engaged minion goes back to be held and heals 1 per player; the held one engages its player", () => {
    const { state, m1, m2, held } = table([0, 9, 4]);
    const { state: after, events } = villainPhase(state);
    expect(heldOf(after)).toBe(m2);
    expect(inst(after, m2)).toMatchObject({ engagedWith: null, attachedTo: environmentOf(after), heldMinion: true });
    expect(damageOf(after, m2)).toBe(7);
    expect(inst(after, held)).toMatchObject({ engagedWith: P2, attachedTo: null });
    expect(inst(after, held).heldMinion).toBeFalsy();
    expect(damageOf(after, held)).toBe(4);
    expect(inst(after, m1)).toMatchObject({ engagedWith: P1 });
    expect(damageOf(after, m1)).toBe(0);
    expect(types(events, "damageHealed").filter((h) => h.targetInstanceId === m2)).toEqual([
      { type: "damageHealed", targetInstanceId: m2, amount: 2 },
    ]);
  });

  it("one player: the same swap heals 1", () => {
    const base = game(1, "standard", 1, SWAP_SETS.slice(0, 2));
    const [m1, held] = [minionOf(base, P1)!, heldOf(base)!];
    let s = withDamage(withDamage(base, m1, 6), held, 2);
    s = stackEncounterDeck(s, BLANKS[0]!, BYSTANDERS);
    const after = villainPhase(s).state;
    expect(heldOf(after)).toBe(m1);
    expect(damageOf(after, m1)).toBe(5);
    expect(inst(after, held).engagedWith).toBe(P1);
    expect(inst(after, held).heldMinion).toBeFalsy();
  });

  it("expert: heals 1 more per player and gives the minion a tough status card", () => {
    const t = table([0, 9, 4], "expert");
    const state = noTough(t.state, t.m2);
    const after = villainPhase(state).state;
    expect(heldOf(after)).toBe(t.m2);
    expect(damageOf(after, t.m2)).toBe(5);
    expect(toughOf(after, t.m2)).toBe(1);
  });

  it("if the most damaged minion is already held, it stays held and heals", () => {
    const { state, m1, m2, held } = table([3, 0, 6]);
    const after = villainPhase(state).state;
    expect(heldOf(after)).toBe(held);
    expect(damageOf(after, held)).toBe(4);
    expect(engagedWith(after, m1)).toBe(P1);
    expect(engagedWith(after, m2)).toBe(P2);
    expect(damageOf(after, m1)).toBe(3);
  });

  it("a tie is the first player's choice, and by the end of the round that is the new first player (player 2)", () => {
    const { state, m1, m2, held } = table([5, 5, 1]);
    expect(state.firstPlayerId).toBe(P1);
    const asked: PlayerId[] = [];
    const after = villainPhase(state, choosing(m1, asked)).state;
    expect(asked).toEqual([P2]);
    expect(heldOf(after)).toBe(m1);
    expect(damageOf(after, m1)).toBe(3);
    // The minion that was held engages the player the chosen one was engaged with.
    expect(engagedWith(after, held)).toBe(P1);
    expect(engagedWith(after, m2)).toBe(P2);
    expect(damageOf(after, m2)).toBe(5);
  });

  it("a tie that includes no damage at all is the first player's choice as well, and choosing the held minion changes nothing", () => {
    const { state, m1, m2, held } = table([0, 0, 0]);
    const asked: PlayerId[] = [];
    const after = villainPhase(state, choosing(held, asked)).state;
    expect(asked).toEqual([P2]);
    expect(heldOf(after)).toBe(held);
    expect(engagedWith(after, m1)).toBe(P1);
    expect(engagedWith(after, m2)).toBe(P2);
    expect(damageOf(after, held)).toBe(0);
  });

  it("a tie between an engaged minion and the held one: choosing the engaged one swaps them", () => {
    const { state, m1, m2, held } = table([0, 5, 5]);
    const after = villainPhase(state, choosing(m2)).state;
    expect(heldOf(after)).toBe(m2);
    expect(engagedWith(after, held)).toBe(P2);
    expect(damageOf(after, m2)).toBe(3);
    expect(damageOf(after, held)).toBe(5);
    expect(engagedWith(after, m1)).toBe(P1);
  });

  it("no Thunderbolt minion in play: nothing happens at the end of the round", () => {
    let s = game(1);
    s = setAsideNow(setAsideNow(s, minionOf(s, P1)!), heldOf(s)!);
    expect(thunderbolts(s)).toEqual([]);
    s = stackEncounterDeck(s, BYSTANDERS);
    const { state, events } = villainPhase(s);
    expect(thunderbolts(state)).toEqual([]);
    expect(types(events, "damageHealed")).toEqual([]);
  });
});

describe("Citizen V's Sword (50132)", () => {
  it("When Revealed: attaches to Citizen V (+1 ATK, +1 SCH) and he activates against the player, outside step two (no heal)", () => {
    let s = game(1, "standard", 1, SETS[0], true);
    s = withDamage(s, villainOf(s), 10);
    // Step two: the minion's activation (a boost card); step three deals the Sword; Citizen V's activation (a boost card).
    s = stackEncounterDeck(s, BLANKS[0]!, SWORD, BLANKS[1]!);
    const { state, events } = villainPhase(s);
    const sword = idsOf(state, SWORD)[0]!;
    expect(inst(state, sword).attachedTo).toBe(villainOf(state));
    const attacks = attacksBy(s, events, CITIZEN_V);
    expect(attacks).toHaveLength(1);
    expect(attacks[0]).toMatchObject({
      baseAtk: 3,
      damageDealt: 3,
      targetInstanceId: s.players[0]!.identity.instanceId,
    });
    // Only the step-two activation (replaced by a heal of 4) healed him; the Sword's own activation attacked.
    expect(damageOf(state, villainOf(state))).toBe(6);
  });
});

/** `n` cards whose only resource icon is one [physical], taken from the player's hand and deck into their hand. */
function withPhysical(
  state: GameState,
  player: PlayerId,
  n: number,
): { readonly state: GameState; readonly ids: InstanceId[] } {
  const owner = state.players.find((p) => p.playerId === player)!;
  const ids = [...owner.hand, ...owner.deck]
    .filter((id) => {
      const card = CORE_CARDS.find((c) => (c.id as string) === codeOf(state, id)) as
        | { resourceIcons?: Record<string, number> }
        | undefined;
      const icons = card?.resourceIcons ?? {};
      return Object.values(icons).reduce((a, b) => a + b, 0) === 1 && icons.physical === 1;
    })
    .slice(0, n);
  if (ids.length < n) throw new Error(`${player} has fewer than ${n} physical cards`);
  return {
    ids,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? {
              ...p,
              hand: [...p.hand.filter((i) => !ids.includes(i)), ...ids],
              deck: p.deck.filter((i) => !ids.includes(i)),
            }
          : p,
      ),
    },
  };
}

describe("Citizen V's Sword: Hero Response (50132)", () => {
  /** The Sword in play on Citizen V in the next round's player phase; player 1 has nothing engaged and two [physical] cards. */
  function withSword(): {
    readonly state: GameState;
    readonly sword: InstanceId;
    readonly physical: readonly InstanceId[];
  } {
    let s = game(1, "standard", 1, SETS[0], true);
    s = villainPhase(stackEncounterDeck(s, BLANKS[0]!, SWORD, BLANKS[1]!)).state;
    const sword = idsOf(s, SWORD)[0]!;
    s = withForm(setAsideNow(s, minionOf(s, P1)!), { heroForm: 0 }, P1);
    const given = withPhysical(s, P1, 2);
    return { state: ready(given.state), sword, physical: given.ids };
  }
  /** Takes the Sword's response when it is offered, and pays with `pay`. */
  const accepting =
    (sword: InstanceId, pay: readonly InstanceId[]): Picker =>
    (st) => {
      const c = st.pendingChoice!;
      if (c.prompt.kind === "chooseTriggers") {
        const take = c.options.find((o) => o.optionId.includes("citizen-vs-sword-response"));
        return take ? [take.optionId] : firstLegal(st);
      }
      if (c.prompt.kind === "payForAbility") return pay.map((id) => `hand:${id}`);
      return firstLegal(st);
    };
  const prompts = (s: GameState, target: InstanceId, pick: Picker) => {
    const kinds: string[] = [];
    const after = heroAttacks(DEPS, s, target, {
      pick: (st) => {
        kinds.push(st.pendingChoice!.prompt.kind);
        return pick(st);
      },
    }).state;
    return { after, kinds };
  };

  it("after you attack and damage Citizen V, spend two [physical] resources: the Sword is discarded", () => {
    const t = withSword();
    expect(inst(t.state, t.sword).attachedTo).toBe(villainOf(t.state));
    const { after, kinds } = prompts(t.state, villainOf(t.state), accepting(t.sword, t.physical));
    expect(kinds).toContain("chooseTriggers");
    expect(kinds).toContain("payForAbility");
    expect(piles(after).discard).toContain(t.sword);
    expect(inst(after, t.sword).attachedTo).toBeNull();
    expect(after.players[0]!.hand).not.toEqual(expect.arrayContaining([...t.physical]));
  });

  it("it is a choice: declined, or paid with too little, the Sword stays on him", () => {
    const t = withSword();
    const declined = prompts(t.state, villainOf(t.state), firstLegal);
    expect(inst(declined.after, t.sword).attachedTo).toBe(villainOf(t.state));
    const short = prompts(t.state, villainOf(t.state), accepting(t.sword, t.physical.slice(0, 1)));
    expect(inst(short.after, t.sword).attachedTo).toBe(villainOf(t.state));
  });

  it("an attack on a different enemy does not offer it", () => {
    const t = withSword();
    const jolt = engageMinion(t.state, JOLT, P1);
    const { kinds } = prompts(jolt.state, jolt.id, accepting(t.sword, t.physical));
    expect(kinds).not.toContain("payForAbility");
    expect(kinds).not.toContain("chooseTriggers");
  });
});

describe("Jolt (50133)", () => {
  const JOLT_ACTION = "50133.jolt-action";
  /** Jolt engaged with player 1, who is in hero form with a ready hero. */
  function withJolt(mode: Mode = "standard"): { readonly state: GameState; readonly jolt: InstanceId } {
    const s = game(1, mode);
    const jolt = engageMinion(s, JOLT, P1);
    return { state: ready(jolt.state), jolt: jolt.id };
  }
  const act = (s: GameState, jolt: InstanceId) =>
    driveEventsPicking(DEPS, ready(s), firstLegal, use(P1, jolt, JOLT_ACTION)).state;
  const parley = (s: GameState, jolt: InstanceId): number => inst(s, jolt).counters.parley ?? 0;

  it("data: ATK 1, SCH 0, 5 hit points, Villainous", () => {
    const d = dataOf(JOLT) as unknown as { atk: number; sch: number; hp: number; keywords: { name: string }[] };
    expect([d.atk, d.sch, d.hp, d.keywords.map((k) => k.name)]).toEqual([1, 0, 5, ["villainous"]]);
  });

  it("Hero Action: exhaust your hero, place 1 parley counter on her", () => {
    const { state, jolt } = withJolt();
    const after = act(state, jolt);
    expect(parley(after, jolt)).toBe(1);
    expect(inst(after, after.players[0]!.identity.instanceId).exhausted).toBe(true);
    expect(cardsInPlay(after)).toContain(jolt);
  });

  it("the third parley counter removes her from the game: not defeated, nothing in the victory display, no threat", () => {
    const { state, jolt } = withJolt();
    const threat = mainThreat(state);
    let s = act(act(state, jolt), jolt);
    expect(parley(s, jolt)).toBe(2);
    expect(cardsInPlay(s)).toContain(jolt);
    s = act(s, jolt);
    expect(cardsInPlay(s)).not.toContain(jolt);
    expect(s.removedFromGame).toContain(jolt);
    expect(s.victoryDisplay).not.toContain(jolt);
    expect(piles(s).discard).not.toContain(jolt);
    expect(mainThreat(s)).toBe(threat);
  });

  it("an exhausted hero cannot use it", () => {
    const { state, jolt } = withJolt();
    const exhausted = patchInstance(state, state.players[0]!.identity.instanceId, { exhausted: true });
    expect(() => driveEventsPicking(DEPS, exhausted, firstLegal, use(P1, jolt, JOLT_ACTION))).toThrow(/exhaust/i);
  });

  it("When Defeated: place 3 threat on the main scheme", () => {
    const { state, jolt } = withJolt();
    const threat = mainThreat(state);
    const hit = heroAttacks(DEPS, ready(withDamage(state, jolt, 4)), jolt).state;
    expect(cardsInPlay(hit)).not.toContain(jolt);
    expect(mainThreat(hit)).toBe(threat + 3);
  });

  it("she is a Thunderbolt minion engaged with the player: Citizen V gives up his step-two activation against them", () => {
    let s = game(1);
    s = setAsideNow(s, minionOf(s, P1)!);
    s = withDamage(engageMinion(s, JOLT, P1).state, villainOf(s), 10);
    s = stack(s, 1);
    const { state, events } = villainPhase(s);
    expect(attacksBy(s, events, CITIZEN_V)).toHaveLength(0);
    expect(damageOf(state, villainOf(state))).toBe(6);
  });
});

describe("Innocent Bystanders (50134)", () => {
  /** Player 1 holds a Bystanders obligation (dealt in a villain phase) in the next round's player phase. */
  function withBystanders(mode: Mode = "standard"): GameState {
    let s = game(1, mode, 1, SETS[0]);
    s = villainPhase(stackEncounterDeck(s, BLANKS[0]!, BYSTANDERS)).state;
    return ready(withForm(s, { heroForm: 0 }, P1));
  }
  const obligation = (s: GameState): InstanceId => s.players[0]!.playArea.find((i) => codeOf(s, i) === BYSTANDERS)!;
  const counters = (s: GameState): number => inst(s, obligation(s)).counters.bystander ?? 0;
  const choosing =
    (label: RegExp, pay: readonly InstanceId[] = []): Picker =>
    (st) => {
      const c = st.pendingChoice!;
      if (c.prompt.kind === "chooseOption") {
        const o = c.options.find((x) => label.test(x.label));
        return o ? [o.optionId] : firstLegal(st);
      }
      if (c.prompt.kind === "spendResources") return pay.map((id) => `hand:${id}`);
      return firstLegal(st);
    };
  const attackMinion = (s: GameState, pick: Picker) => heroAttacks(DEPS, s, minionOf(s, P1)!, { pick }).state;

  it("Uses (4 bystander counters): it enters play with 4", () => {
    const s = withBystanders();
    expect(counters(s)).toBe(4);
    expect(inst(s, obligation(s)).controllerId ?? P1).toBe(P1);
  });

  it("after you attack an enemy: place 1 threat on the main scheme (2 in expert) and remove a bystander counter", () => {
    for (const [mode, amount] of [
      ["standard", 1],
      ["expert", 2],
    ] as const) {
      const s = withBystanders(mode);
      const threat = mainThreat(s);
      const after = attackMinion(s, choosing(/threat/i));
      expect(mainThreat(after)).toBe(threat + amount);
      expect(counters(after)).toBe(3);
    }
  });

  it("or spend 1 resource of any type instead: no threat, and the counter is removed all the same", () => {
    const s = withBystanders();
    const spare = s.players[0]!.hand[0]!;
    const threat = mainThreat(s);
    const after = attackMinion(s, choosing(/spend/i, [spare]));
    expect(mainThreat(after)).toBe(threat);
    expect(counters(after)).toBe(3);
    expect(after.players[0]!.hand).not.toContain(spare);
  });

  it("the spend, once chosen, is paid: an answer with no card is refused (RRG 1.8 'Cost', p. 13)", () => {
    const s = withBystanders();
    expect(() => attackMinion(s, choosing(/spend/i, []))).toThrow(/resolveChoice rejected: invalid_choice/);
  });

  it("a player with nothing to spend is not offered the spend: the threat is placed (owner default Q8 = A, docs/phase7-wave7.md)", () => {
    const held = withBystanders();
    const s: GameState = {
      ...held,
      players: held.players.map((p, seat) => (seat === 0 ? { ...p, hand: [], deck: [...p.deck, ...p.hand] } : p)),
    };
    const threat = mainThreat(s);
    const offered: string[][] = [];
    const after = attackMinion(s, (st) => {
      const c = st.pendingChoice!;
      if (c.prompt.kind === "chooseOption") offered.push(c.options.map((o) => o.label));
      return firstLegal(st);
    });
    expect(offered).toEqual([]); // one option left: it resolves without asking
    expect(mainThreat(after)).toBe(threat + 1);
    expect(counters(after)).toBe(3);
  });

  it("after an enemy attacks you, in the villain phase: the same choice", () => {
    const s = withBystanders();
    const threat = mainThreat(s);
    // Citizen V gives up his activation; the minion attacks (a boost card); a Bystanders is dealt (the obligation's twin).
    const stacked = stackEncounterDeck(s, BLANKS[1]!, BYSTANDERS);
    const { state } = villainPhase(stacked, choosing(/threat/i));
    expect(mainThreat(state)).toBeGreaterThanOrEqual(threat + 1);
    expect(inst(state, obligation(state)).counters.bystander).toBeLessThanOrEqual(3);
  });

  it("the last bystander counter removed discards it (Uses)", () => {
    let s = withBystanders();
    s = patchInstance(s, obligation(s), { counters: { bystander: 1 } });
    const id = obligation(s);
    const after = attackMinion(s, choosing(/threat/i));
    expect(after.players[0]!.playArea).not.toContain(id);
    expect(piles(after).discard).toContain(id);
  });
});

describe("The Coming Storm (50135) and Rumbling Thunder (50136): each player engages the minions of the player clockwise", () => {
  const SETS_3P = ["power_of_the_atom", "pale_little_spider", "the_leaper", "gravitational_pull"];
  /**
   * `players` seats, every one engaged with a Thunderbolt minion; the held minion has the most damage, so the end of the
   * round leaves it held. The first player reveals `card` in step three of the villain phase.
   */
  function round(players: 1 | 2 | 3, card: string) {
    const base = game(players, "standard", 1, SETS_3P.slice(0, players + 1));
    const minions = PLAYERS.slice(0, players).map((p) => minionOf(base, p)!);
    const held = heldOf(base)!;
    const state = withDamage(base, held, 9);
    // Step two: one boost card per engaged minion; step three: the card, then an obligation for each other player (and
    // one more for the hazard icon of The Coming Storm).
    const spare = Array.from({ length: players }, () => BYSTANDERS);
    const after = villainPhase(
      stackEncounterDeck(state, ...BLANKS.slice(0, players), card, ...spare),
      firstLegal,
    ).state;
    return { before: state, after, minions, held };
  }

  it("three players: player 1 takes player 2's minion, player 2 player 3's, player 3 player 1's; the held one stays held", () => {
    for (const card of [COMING_STORM, RUMBLING_THUNDER]) {
      const { after, minions, held } = round(3, card);
      const [m1, m2, m3] = minions as [InstanceId, InstanceId, InstanceId];
      expect(inPlay(after, card)).toBeDefined();
      expect(engagedWith(after, m2)).toBe(P1);
      expect(engagedWith(after, m3)).toBe(P2);
      expect(engagedWith(after, m1)).toBe(P3);
      expect(heldOf(after)).toBe(held);
    }
  });

  it("two players: the two engaged minions trade places", () => {
    const { after, minions } = round(2, COMING_STORM);
    const [m1, m2] = minions as [InstanceId, InstanceId];
    expect(engagedWith(after, m1)).toBe(P2);
    expect(engagedWith(after, m2)).toBe(P1);
  });

  it("one player: nothing moves", () => {
    const { after, minions } = round(1, RUMBLING_THUNDER);
    expect(engagedWith(after, minions[0]!)).toBe(P1);
  });

  it("a player with several minions hands them all on at once, and takes the next player's", () => {
    let s = game(2, "standard", 1, SETS_3P.slice(0, 3));
    const [m1, m2] = [minionOf(s, P1)!, minionOf(s, P2)!];
    const jolt = engageMinion(s, JOLT, P2);
    s = withDamage(jolt.state, heldOf(s)!, 9);
    const after = villainPhase(
      stackEncounterDeck(s, ...BLANKS.slice(0, 3), RUMBLING_THUNDER, BYSTANDERS),
      firstLegal,
    ).state;
    expect(engagedWith(after, m2)).toBe(P1);
    expect(engagedWith(after, jolt.id)).toBe(P1);
    expect(engagedWith(after, m1)).toBe(P2);
  });

  it("data: The Coming Storm has 2 threat per player and a hazard icon, Rumbling Thunder 3 per player and an acceleration icon", () => {
    const storm = dataOf(COMING_STORM) as unknown as { startingThreat: unknown; icons: string[] };
    const thunder = dataOf(RUMBLING_THUNDER) as unknown as { startingThreat: unknown; icons: string[] };
    expect([storm.startingThreat, storm.icons]).toEqual([{ base: 0, perPlayer: 2 }, ["hazard"]]);
    expect([thunder.startingThreat, thunder.icons]).toEqual([{ base: 0, perPlayer: 3 }, ["acceleration"]]);
  });
});

describe("Down but Not Out (50137)", () => {
  /**
   * Two players, each engaged with a Thunderbolt minion, one held (Moonstone, MACH-IV and Batroc: 16 hit points each).
   * Player 1's minion has 12 damage, so the round's end (Thunderbolt Backup) holds that one and leaves a minion this
   * card returned (11 damage) as it was.
   */
  function table(seed = 1) {
    const base = game(2, "standard", seed);
    const [m1, m2, held] = [minionOf(base, P1)!, minionOf(base, P2)!, heldOf(base)!];
    return { state: withDamage(base, m1, 12), m1, m2, held };
  }
  /**
   * Step two turns two boost cards (the two engaged minions, or one of them and Citizen V against a player engaged
   * with none); step three deals `dealt` to player 1 and player 2 in that order; `more` are next (a surge's card).
   */
  const reveal = (s: GameState, dealt: readonly [string, string] = [DOWN, BYSTANDERS], ...more: string[]) =>
    villainPhase(stackEncounterDeck(s, BLANKS[0]!, BLANKS[1]!, ...dealt, ...more));
  const downOf = (s: GameState, events: readonly GameEvent[]): InstanceId =>
    types(events, "encounterCardRevealed").find((e) => codeOf(s, e.instanceId) === DOWN)!.instanceId;
  const surgesOf = (events: readonly GameEvent[], id: InstanceId) =>
    types(events, "surgeTriggered").filter((e) => e.instanceId === id);
  const remaining = (s: GameState, id: InstanceId) => remainingHitPoints(s, id, DEPS);

  it("data: a treachery with 1 boost icon, two copies", () => {
    const card = dataOf(DOWN);
    expect([card.type, card.boostIcons, card.quantityInSet]).toEqual(["treachery", 1, 2]);
  });

  // Owner decision Q29 = B: the card is removed from the game even when no minion returned; the surge is as printed.
  it("no Thunderbolt minion in the victory display (Q29): nothing enters play, the card gains surge and is removed from the game all the same", () => {
    const t = table();
    // A card in the display that is not a Thunderbolt minion is never the one.
    const staged = intoVictoryDisplay(t.state, "01187");
    const other = staged.victoryDisplay[0]!;
    const { state, events } = reveal(staged, [DOWN, BYSTANDERS], BYSTANDERS);
    const down = downOf(state, events);
    expect(state.victoryDisplay).toEqual([other]);
    expect(thunderbolts(state).sort()).toEqual([t.m1, t.m2, t.held].sort());
    expect(surgesOf(events, down)).toMatchObject([{ playerId: P1 }]);
    // The surge deals player 1 a second card in step four, revealed there before player 2's (Q22): three in all.
    expect(types(events, "encounterCardRevealed").map((e) => [codeOf(state, e.instanceId), e.playerId])).toEqual([
      [DOWN, P1],
      [BYSTANDERS, P1],
      [BYSTANDERS, P2],
    ]);
    expect(revealedCodes(state, events).sort()).toEqual([BYSTANDERS, BYSTANDERS, DOWN].sort());
    expect(state.removedFromGame).toContain(down);
    expect(piles(state).discard).not.toContain(down);
    expect(piles(state).deck).not.toContain(down);
  });

  it("one in the display: it is revealed and engages the revealing player, not held, with 11 damage (16 hit points, 5 remaining); the card is removed from the game, no surge", () => {
    const t = table();
    const staged = inVictory(t.state, t.held);
    expect(hpOf(staged, t.held)).toBe(16);
    const { state, events } = reveal(staged);
    const down = downOf(state, events);
    expect(state.victoryDisplay).toEqual([]);
    expect(cardsInPlay(state)).toContain(t.held);
    expect(engagedWith(state, t.held)).toBe(P1);
    expect(inst(state, t.held).heldMinion).toBeUndefined();
    expect(damageOf(state, t.held)).toBe(11);
    expect(remaining(state, t.held)).toBe(5);
    expect(toughOf(state, t.held)).toBe(0);
    expect(revealedCodes(state, events)).toContain(codeOf(state, t.held));
    expect(state.removedFromGame).toContain(down);
    expect(piles(state).discard).not.toContain(down);
    expect(surgesOf(events, down)).toEqual([]);
    expect(revealedCodes(state, events).filter((code) => code === BYSTANDERS)).toHaveLength(1);
  });

  it("revealed by player 2: the minion engages player 2", () => {
    const t = table();
    const { state } = reveal(inVictory(t.state, t.held), [BYSTANDERS, DOWN]);
    expect(engagedWith(state, t.held)).toBe(P2);
    expect(remaining(state, t.held)).toBe(5);
  });

  it("several in the display: exactly one of them returns, the other stays; which one follows the seed", () => {
    const returned = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const t = table(seed);
      const staged = inVictory(inVictory(t.state, t.held), t.m2);
      const { state, events } = reveal(staged);
      const back = [t.held, t.m2].filter((id) => cardsInPlay(state).includes(id));
      expect(back).toHaveLength(1);
      expect(state.victoryDisplay).toEqual([t.held, t.m2].filter((id) => id !== back[0]));
      expect(engagedWith(state, back[0]!)).toBe(P1);
      expect(remaining(state, back[0]!)).toBe(5);
      expect(state.removedFromGame).toContain(downOf(state, events));
      returned.add(back[0] === t.held ? "first" : "second");
      // The same seed, the same minion.
      const again = reveal(staged).state;
      expect(cardsInPlay(again)).toContain(back[0]);
    }
    expect([...returned].sort()).toEqual(["first", "second"]);
  });

  it("Citizen V sees the count drop: at 0 hit points with one Thunderbolt minion in the display, the minion returns and the next one defeated is again only the first (two players)", () => {
    const t = table();
    let s = inVictory(t.state, t.held);
    s = withDamage(s, villainOf(s), hpOf(s, villainOf(s)));
    const { state } = reveal(s);
    expect(state.victoryDisplay).toEqual([]);
    expect(villainDefeated(state)).toBe(false);
    expect(state.outcome).toBeNull();
    // The returned minion has 5 hit points left; defeated, it is the only one in the display: one short of two.
    expect(remaining(state, t.held)).toBe(5);
    // The round ended: player 2 is the first player and it is their turn.
    const struck = withDamage(state, t.held, hpOf(state, t.held) - 1);
    const after = heroAttacks(DEPS, ready(struck), t.held, { player: P2 }).state;
    expect(after.victoryDisplay).toEqual([t.held]);
    expect(villainDefeated(after)).toBe(false);
  });
});

describe("Tap In (50138)", () => {
  const SWAP_SETS = ["power_of_the_atom", "pale_little_spider", "the_leaper"];
  /** Two players, each engaged with a Thunderbolt minion; the held one and the damage of each as given. */
  function table(damage: readonly [number, number, number]) {
    const base = game(2, "standard", 1, SWAP_SETS);
    const [m1, m2, held] = [minionOf(base, P1)!, minionOf(base, P2)!, heldOf(base)!];
    let state = base;
    [m1, m2, held].forEach((id, i) => {
      state = withDamage(state, id, damage[i]!);
    });
    return { state, m1, m2, held };
  }
  /** Step two: one boost card for each engaged minion; step three: Tap In to player 1; then the activation's boost card. */
  const reveal = (s: GameState, pick: Picker = firstLegal) =>
    villainPhase(stackEncounterDeck(s, BLANKS[0]!, BLANKS[1]!, TAP_IN, BYSTANDERS, BLANKS[2]!), pick);
  const choosing =
    (target: InstanceId | undefined, asked: PlayerId[] = []): Picker =>
    (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind !== "chooseTarget") return firstLegal(s);
      asked.push(choice.playerId);
      const option = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === target);
      return option ? [option.optionId] : firstLegal(s);
    };
  const attacksOn = (s: GameState, events: readonly GameEvent[], minion: InstanceId, player: PlayerId) =>
    types(events, "attackResolved").filter(
      (a) =>
        a.enemyInstanceId === minion &&
        a.targetInstanceId === s.players.find((p) => p.playerId === player)!.identity.instanceId,
    );

  it("engages the held minion when it has the least damage, and it attacks the player", () => {
    const t = table([6, 6, 1]);
    const { events } = reveal(t.state);
    expect(attacksOn(t.state, events, t.held, P1)).toHaveLength(1);
    expect(attacksOn(t.state, events, t.m2, P1)).toHaveLength(0);
  });

  it("engages the least damaged minion engaged with another player, which then activates against the player", () => {
    const t = table([6, 1, 6]);
    const { events } = reveal(t.state);
    // Once against player 2 in step two, then, engaged with player 1 by Tap In, once against them.
    expect(attacksOn(t.state, events, t.m2, P2)).toHaveLength(1);
    expect(attacksOn(t.state, events, t.m2, P1)).toHaveLength(1);
  });

  it("a minion already engaged with you is never the one, even with the least damage", () => {
    const t = table([0, 5, 6]);
    const { events } = reveal(t.state);
    // Player 1's own minion has the least damage but only the other two qualify: the least of them is player 2's.
    expect(attacksOn(t.state, events, t.m2, P1)).toHaveLength(1);
    expect(attacksOn(t.state, events, t.m1, P1).length).toBe(1);
  });

  it("a tie among the least damaged is the revealing player's choice (player 1)", () => {
    const t = table([6, 3, 3]);
    const asked: PlayerId[] = [];
    const { events } = reveal(t.state, choosing(t.held, asked));
    expect(asked).toContain(P1);
    expect(attacksOn(t.state, events, t.held, P1)).toHaveLength(1);
    expect(attacksOn(t.state, events, t.m2, P1)).toHaveLength(0);
  });

  it("with no Thunderbolt minion to engage, Citizen V activates against you (not in step two: no heal)", () => {
    let s = game(1, "standard", 1, SWAP_SETS.slice(0, 2));
    s = setAsideNow(s, heldOf(s)!);
    s = withDamage(s, villainOf(s), 10);
    // Step two: Citizen V gives up his activation (a heal of 4); the minion attacks (a boost card); Tap In; Citizen V
    // attacks (a boost card).
    const stacked = stackEncounterDeck(s, BLANKS[0]!, TAP_IN, BLANKS[1]!);
    const { state, events } = villainPhase(stacked);
    expect(attacksBy(s, events, CITIZEN_V)).toHaveLength(1);
    expect(damageOf(state, villainOf(state))).toBe(6);
  });
});
