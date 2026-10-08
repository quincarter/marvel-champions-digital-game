import { AOA_CARDS, CORE_CARDS, encounterSetId, trait } from "@mc/content";
import {
  activeAbilityRefs,
  characterProfile,
  createGame,
  cardsInPlay,
  consideredRemainingHitPoints,
  handSize,
  keywordTotal,
  remainingHitPoints,
  traitsOf,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
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
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
} from "../../testing/harness.js";
import {
  driveEventsPicking,
  encounterCardInVillainArea,
  playFromHand,
  withActive,
  withForm,
} from "../../testing/staging.js";
import { attachToHost } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { FOUR_HORSEMEN, FOUR_HORSEMEN_SKIPPED } from "./four-horsemen.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Four Horsemen scenario's cards (45081a to 45084b the villains, 45085a the main scheme, the `four_horsemen` set
 * 45086 to 45096), docs/phase7-wave8.md §2.3, §3.7 to §3.15. The game is Core's Rhino config with the four Horsemen as
 * simultaneous villains (the engine's `villains` option, one shared encounter deck) and 45085a as the main scheme.
 *
 * The table is seated by hand so every test starts from a known one: 45085a's Setup is left out of this file's
 * registry (its random row and random side schemes are pinned through the real builder in `wave8/setup.test.ts`), the
 * four villains start in play, and the row is set to War, Famine, Pestilence, Death with the active counter on War
 * (`seated` re-seats it). 1B is registered, so every villain activation passes the counter along the row. Cards are
 * stacked on the encounter deck and revealed or drawn as boost cards by real `endTurn` commands.
 */
const { "45085a.setup": _randomSetup, ...SEATED_BY_HAND } = FOUR_HORSEMEN;
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, SEATED_BY_HAND) };

const WAR = "45081a";
const FAMINE = "45082a";
const PESTILENCE = "45083a";
const DEATH = "45084a";
const RAVAGES = "45086";
const TIME_OF_FAMINE = "45087";
const SPECTER = "45089";
const GOLDEN_HORSE = "45090";
const METAL_WINGS = "45091";
const ROUGH_RIDERS = "45096";
const H_WAR = "45092";
const H_FAMINE = "45093";
const H_PESTILENCE = "45094";
const H_DEATH = "45095";
/** A core boost card of 0 icons with no Boost ability. */
const BOOST_0 = "01186";
const AUNT_MAY = "01006";

const VILLAINS = [WAR, FAMINE, PESTILENCE, DEATH];
/** Every ref is registered since engine tasks 21 to 23 (docs/phase7-wave8.md §3.10, §3.11, §3.13). */
const SKIPPED_REFS: readonly string[] = [];

function setupGame(opts: { readonly players?: 1 | 2; readonly face?: "a" | "b" } = {}): GameState {
  const players = opts.players ?? 1;
  const face = opts.face ?? "a";
  const {
    villainSide: _side,
    villainStartStageIndex: _start,
    villainLastStageIndex: _last,
    ...config
  } = coreScenario("rhino", {
    players: [
      { starterDeckId: "core-spider-man-justice" },
      ...(players === 2 ? [{ starterDeckId: "core-she-hulk-aggression" }] : []),
    ],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS],
  });
  const setIds = [encounterSetId("four_horsemen")];
  const copies = AOA_CARDS.filter((c) => "encounterSetIds" in c && c.encounterSetIds.some((id) => setIds.includes(id)))
    .filter((c) => (c as { type: string }).type !== "main_scheme" && (c as { type: string }).type !== "villain")
    .flatMap((c) => Array.from({ length: (c as { quantityInSet: number }).quantityInSet }, () => c.id));
  const created = createGame(
    {
      ...config,
      villainCardId: `${WAR.slice(0, 5)}${face}` as typeof config.villainCardId,
      villains: VILLAINS.map((id) => ({
        villainCardId: `${id.slice(0, 5)}${face}` as typeof config.villainCardId,
        encounterDeck: [],
      })),
      sharedEncounterDeck: true,
      mainSchemeCardId: "45085a" as typeof config.mainSchemeCardId,
      encounterDeck: [...config.encounterDeck, ...copies],
    },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const s = settle(created.state, firstLegal, (state) => state.step.phase === "player", DEPS);
  return { ...s, villainRow: s.villains.map((v) => v.instanceId) };
}

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const villain = (s: GameState, code: string): InstanceId => {
  const found = s.villains.find((v) => codeOf(s, v.instanceId) === code);
  if (!found) throw new Error(`no ${code} in play`);
  return found.instanceId;
};
/** The same four villains in this row, left to right, with the active counter on `holder`. */
const seated = (s: GameState, row: readonly string[], holder: string): GameState => ({
  ...s,
  villainRow: row.map((code) => villain(s, code)),
  activeVillainId: villain(s, holder),
});
const dataOf = (code: string) =>
  AOA_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
const events = <T extends GameEvent["type"]>(run: readonly GameEvent[], type: T) =>
  run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const damageOf = (s: GameState, code: string) => inst(s, villain(s, code)).damage;
const withDamageOn = (s: GameState, code: string, damage: number) => patchInstance(s, villain(s, code), { damage });

const ALL_REFS = [
  "45081a.war-forced-response",
  "45081a.war-constant",
  "45082a.famine-forced-response",
  "45082a.famine-constant",
  "45083a.pestilence-forced-response",
  "45083a.pestilence-constant",
  "45084a.death-forced-response",
  "45084a.death-constant",
  "45081b.war-forced-response",
  "45081b.war-constant",
  "45082b.famine-forced-response",
  "45082b.famine-constant",
  "45083b.pestilence-forced-response",
  "45083b.pestilence-constant",
  "45084b.death-forced-response",
  "45084b.death-constant",
  "45085a.setup",
  "45085b.the-horsemen-of-apocalypse-forced-response",
  "45086.when-defeated",
  "45087.when-defeated",
  "45088.when-defeated",
  "45089.when-defeated",
  "45090.golden-horse-constant",
  "45090.golden-horse-response",
  "45091.metal-wings-constant",
  "45091.when-revealed",
  "45091.metal-wings-response",
  "45092.when-revealed",
  "45092.boost",
  "45093.when-revealed",
  "45093.boost",
  "45094.when-revealed",
  "45094.boost",
  "45095.when-revealed",
  "45095.boost",
  "45096.when-revealed",
];

const nameOf = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.name;
const textBoxBlank = (s: GameState, id: InstanceId) =>
  s.lastingEffects.some((e) => e.kind === "blankTextBox" && e.targets.includes(id));
const heroDamage = (s: GameState) => inst(s, identityOf(s, P1)).damage;
const activeCode = (s: GameState) => codeOf(s, s.activeVillainId!);
const attacksBy = (run: readonly GameEvent[], s: GameState, code: string) =>
  events(run, "attackResolved").filter((e) => codeOf(s, e.enemyInstanceId) === code);

/** One end of turn: the active villain activates once with `boosts` (one per activation), then `reveals` are dealt. */
function round(
  state: GameState,
  opts: { boosts?: readonly string[]; reveals?: readonly string[]; heroForm?: boolean } = {},
) {
  // The standard set has two copies each of two blank boost cards: a repeated BOOST_0 takes the next unused one.
  const blanks = ["01186", "01186", "01187", "01187"];
  const code = (c: string) => (c === BOOST_0 ? blanks.shift()! : c);
  const stacked = stackEncounterDeck(state, ...(opts.boosts ?? [BOOST_0]).map(code), ...(opts.reveals ?? []).map(code));
  const form = opts.heroForm === false ? withForm(stacked, "alterEgo") : withForm(stacked, { heroForm: 0 });
  return driveEventsPicking(DEPS, form, firstLegal, endTurn(P1));
}
const hit = (s: GameState, attacker: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const attack = (s: GameState, code: string) => {
  const ready = patchInstance(withForm(s, { heroForm: 0 }), identityOf(s, P1), { exhausted: false });
  return driveEventsPicking(DEPS, ready, firstLegal, hit(s, identityOf(s, P1), villain(s, code)));
};
const discardCount = (s: GameState) => playerOf(s, P1).discard.length;
const inPlay = (s: GameState, code: string): InstanceId[] => cardsInPlay(s).filter((i) => codeOf(s, i) === code);

describe("registry", () => {
  it("registers every ref the card data names, each a valid definition, and skips none", () => {
    expect(Object.keys(FOUR_HORSEMEN).sort()).toEqual(ALL_REFS.filter((r) => !SKIPPED_REFS.includes(r)).sort());
    for (const [id, def] of Object.entries(FOUR_HORSEMEN)) expect(validateDefinition(def), id).toEqual([]);
    expect(Object.keys(FOUR_HORSEMEN_SKIPPED).sort()).toEqual([...SKIPPED_REFS].sort());
    expect(FOUR_HORSEMEN_SKIPPED).toEqual({});
  });

  it("every ability id the card data names is registered or skipped with a reason", () => {
    const ids = (code: string): string[] => {
      const card = dataOf(code) as {
        abilities?: { id: string }[];
        stages?: { abilities?: { id: string }[]; aSide?: { abilities?: { id: string }[] } }[];
        sides?: { stages: { abilities?: { id: string }[] }[] }[];
      };
      return [
        ...(card.abilities ?? []),
        ...(card.stages ?? []).flatMap((s) => [...(s.abilities ?? []), ...(s.aSide?.abilities ?? [])]),
        ...(card.sides ?? []).flatMap((side) => side.stages.flatMap((s) => s.abilities ?? [])),
      ].map((a) => a.id);
    };
    const codes = [
      ...["81", "82", "83", "84"].flatMap((n) => [`450${n}a`, `450${n}b`]),
      "45085a",
      ...["86", "87", "88", "89", "90", "91", "92", "93", "94", "95", "96"].map((n) => `450${n}`),
    ];
    for (const code of codes) {
      expect(ids(code).length, code).toBeGreaterThan(0);
      for (const id of ids(code)) {
        expect(Object.keys(FOUR_HORSEMEN).includes(id) || id in FOUR_HORSEMEN_SKIPPED, id).toBe(true);
      }
    }
  });
});

describe("the villains (45081a to 45084b): data", () => {
  it("side A has 9 hit points per player and side B 12; ATK/SCH 2/1 War, 1/2 Famine, 1/2 Pestilence, 2/1 Death (B: +1)", () => {
    const stat = (code: string) => {
      const card = dataOf(code) as { sides: { stages: Record<string, unknown>[] }[] };
      const st = card.sides[0]!.stages[0]!;
      return [(st.hp as { perPlayer: number }).perPlayer, st.atk, st.sch];
    };
    expect(["45081a", "45082a", "45083a", "45084a"].map(stat)).toEqual([
      [9, 2, 1],
      [9, 1, 2],
      [9, 1, 2],
      [9, 2, 1],
    ]);
    expect(["45081b", "45082b", "45083b", "45084b"].map(stat)).toEqual([
      [12, 3, 2],
      [12, 2, 3],
      [12, 2, 3],
      [12, 3, 2],
    ]);
  });
});

describe("cannot be defeated while another villain has at least 1 hit point (45081 to 45084, a and b)", () => {
  it("1 player, side A: 9 damage to War leaves him in play at 0, and 5 more changes nothing", () => {
    let s = setupGame();
    s = withDamageOn(s, WAR, 7);
    const first = attack(s, WAR);
    expect(damageOf(first.state, WAR)).toBeGreaterThanOrEqual(9);
    expect(events(first.events, "characterDefeated")).toHaveLength(0);
    const second = attack(first.state, WAR);
    expect(events(second.events, "characterDefeated")).toHaveLength(0);
    expect(second.state.villains.find((v) => v.instanceId === villain(second.state, WAR))!.defeated).toBe(false);
    expect(second.state.outcome).toBeNull();
  });

  it("War, Famine and Pestilence at 0 and Death at 4 remaining: a 2-damage attack on Death defeats nobody", () => {
    let s = setupGame();
    for (const code of [WAR, FAMINE, PESTILENCE]) s = withDamageOn(s, code, 9);
    s = withDamageOn(s, DEATH, 5);
    const run = attack(s, DEATH);
    expect(damageOf(run.state, DEATH)).toBe(7);
    expect(events(run.events, "characterDefeated")).toHaveLength(0);
    expect(run.state.outcome).toBeNull();
  });

  it("the same with Death at 2 remaining: the last hit points fall and all four are defeated together, the players win", () => {
    let s = setupGame();
    for (const code of [WAR, FAMINE, PESTILENCE]) s = withDamageOn(s, code, 9);
    s = withDamageOn(s, DEATH, 7);
    const run = attack(s, DEATH);
    expect(events(run.events, "characterDefeated")).toHaveLength(4);
    expect(run.state.outcome).toEqual({ result: "win", reason: "allVillainsDefeated" });
  });

  it("side B (12 per player) reads the same way: Death with 2 hit points left falls with the others", () => {
    let s = setupGame({ face: "b" });
    for (const code of ["45081b", "45082b", "45083b"]) s = withDamageOn(s, code, 12);
    s = withDamageOn(s, "45084b", 10);
    const run = attack(s, "45084b");
    expect(run.state.outcome).toEqual({ result: "win", reason: "allVillainsDefeated" });
  });
});

describe("War (45081a/b): Forced Response, discard an upgrade or support you control", () => {
  const withAuntMay = (s: GameState) => playFromHand(DEPS, withForm(s, { heroForm: 0 }), AUNT_MAY, 1);

  it("after War attacks you with hit points remaining, the support you control is discarded", () => {
    const { state } = withAuntMay(setupGame());
    expect(inPlay(state, AUNT_MAY)).toHaveLength(1);
    const run = round(state);
    expect(attacksBy(run.events, run.state, WAR)).toHaveLength(1);
    expect(inPlay(run.state, AUNT_MAY)).toHaveLength(0);
    expect(playerOf(run.state, P1).discard.map((i) => nameOf(run.state, i))).toContain("Aunt May");
  });

  it("at 0 hit points War still attacks, but nothing is discarded", () => {
    const { state } = withAuntMay(withDamageOn(setupGame(), WAR, 9));
    const run = round(state);
    expect(attacksBy(run.events, run.state, WAR)).toHaveLength(1);
    expect(inPlay(run.state, AUNT_MAY)).toHaveLength(1);
  });

  it("with nothing to discard, nothing happens", () => {
    const run = round(setupGame());
    expect(attacksBy(run.events, run.state, WAR)).toHaveLength(1);
    expect(run.state.pendingChoice).toBeNull();
  });
});

describe("Famine (45082a/b): Forced Response, discard the top 10 cards of your deck", () => {
  const famine = (damage: number) => {
    const s = withDamageOn(setupGame(), FAMINE, damage);
    return round(withActive(s, villain(s, FAMINE)));
  };

  it("alive she mills 10; at 0 hit points she attacks and mills nothing", () => {
    const alive = famine(0);
    const dead = famine(9);
    expect(attacksBy(alive.events, alive.state, FAMINE)).toHaveLength(1);
    expect(attacksBy(dead.events, dead.state, FAMINE)).toHaveLength(1);
    expect(discardCount(alive.state) - discardCount(dead.state)).toBe(10);
  });
});

describe("Death (45084a/b): Forced Response, deal 1 damage to each character you control", () => {
  it("Spider-Man and his ally each take 1 after the attack; at 0 hit points only the attack's damage lands", () => {
    const run = (damage: number) => {
      const base = withDamageOn(setupGame(), DEATH, damage);
      const { state } = playFromHand(DEPS, withForm(base, { heroForm: 0 }), "01059", 4);
      const active = withActive(state, villain(state, DEATH));
      return { before: active, after: round(active, { boosts: [BOOST_0] }) };
    };
    const ally = (s: GameState) => inPlay(s, "01059")[0]!;
    const alive = run(0);
    const dead = run(9);
    expect(heroDamage(alive.after.state) - heroDamage(dead.after.state)).toBe(1);
    expect(inst(alive.after.state, ally(alive.after.state)).damage).toBe(1);
    expect(inst(dead.after.state, ally(dead.after.state)).damage).toBe(0);
  });
});

const SPIDER_SENSE = "01001a.spider-sense";
const PLAGUE = "45088";
/** The lasting blanks on a card, as their durations. */
const blanksOn = (s: GameState, id: InstanceId) =>
  s.lastingEffects.filter((e) => e.kind === "blankTextBox" && e.targets.includes(id)).map((e) => e.duration.kind);
/** `round`, counting the windows that offer Spider-Sense ("When the villain initiates an attack against you"). */
function roundWatching(state: GameState, opts: { boosts?: readonly string[]; reveals?: readonly string[] } = {}) {
  let offered = 0;
  const pick = (s: GameState) => {
    if (s.pendingChoice?.options.some((o) => o.ref?.kind === "ability" && o.ref.abilityId === SPIDER_SENSE))
      offered += 1;
    return firstLegal(s);
  };
  const blanks = ["01186", "01186", "01187", "01187"];
  const code = (c: string) => (c === BOOST_0 ? blanks.shift()! : c);
  const stacked = stackEncounterDeck(state, ...(opts.boosts ?? [BOOST_0]).map(code), ...(opts.reveals ?? []).map(code));
  const run = driveEventsPicking(DEPS, withForm(stacked, { heroForm: 0 }), pick, endTurn(P1));
  return { ...run, offered };
}
/** The position of the first event of `type` matching `where`, or -1. */
const firstAt = <T extends GameEvent["type"]>(
  run: readonly GameEvent[],
  type: T,
  where: (e: Extract<GameEvent, { type: T }>) => boolean = () => true,
) => run.findIndex((e) => e.type === type && where(e as Extract<GameEvent, { type: T }>));
/** Plague and Pestilence in play with 1 threat, defeated by Spider-Man's basic thwart. */
const defeatPlague = (s: GameState) => {
  const { state, id } = encounterCardInVillainArea(s, PLAGUE, 1);
  const ready = patchInstance(withForm(state, { heroForm: 0 }), identityOf(state, P1), { exhausted: false });
  return driveEventsPicking(DEPS, ready, firstLegal, {
    type: "basicThwart",
    playerId: P1,
    thwarterInstanceId: identityOf(state, P1),
    schemeInstanceId: id,
  });
};

describe("Pestilence (45083a/b): Forced Response, the identity's text box is blank until the next villain phase begins (§3.13)", () => {
  const pestilenceActive = (face: "a" | "b" = "a") => {
    const s = setupGame({ face });
    return withActive(s, villain(s, `45083${face}`));
  };

  it("round 1: Spider-Sense is offered on Pestilence's own attack (the blank comes after it), then not on War's attack later in the same villain phase", () => {
    // Pestilence attacks in step two; Horseman of War, dealt in step four, makes War attack.
    const run = roundWatching(pestilenceActive(), { boosts: [BOOST_0], reveals: [H_WAR] });
    expect(villainAttacks(run)).toEqual([PESTILENCE, WAR]);
    expect(run.offered).toBe(1);
    const spidey = identityOf(run.state, P1);
    expect(blanksOn(run.state, spidey)).toEqual(["nextVillainPhaseBegins"]);
    expect(run.state.step.phase).toBe("player");
    expect(run.state.round).toBe(2);
  });

  it("the control: with Pestilence at 0 (no blank) Spider-Sense is offered on both attacks", () => {
    const zero = withDamageOn(pestilenceActive(), PESTILENCE, 9);
    const run = roundWatching(zero, { boosts: [BOOST_0], reveals: [H_WAR] });
    expect(villainAttacks(run)).toEqual([PESTILENCE, WAR]);
    expect(run.offered).toBe(2);
    expect(textBoxBlank(run.state, identityOf(run.state, P1))).toBe(false);
  });

  it("round 2's player phase: the identity is still blank on both faces; hand size, stats, hit points and traits are unchanged", () => {
    const start = pestilenceActive();
    const spidey = identityOf(start, P1);
    const inHero = withForm(start, { heroForm: 0 });
    const before = {
      profile: characterProfile(inHero, spidey, DEPS),
      traits: traitsOf(inHero, spidey, DEPS),
      hand: handSize(inHero, P1, DEPS),
    };
    expect(activeAbilityRefs(inHero, spidey, DEPS).map((r) => r.id as string)).toContain(SPIDER_SENSE);
    const run = roundWatching(start, { boosts: [BOOST_0], reveals: [QUIET[0]!] });
    expect(run.state.step.phase).toBe("player");
    expect(textBoxBlank(run.state, spidey)).toBe(true);
    const hero = withForm(run.state, { heroForm: 0 });
    expect(activeAbilityRefs(hero, spidey, DEPS)).toEqual([]);
    expect(handSize(hero, P1, DEPS)).toBe(before.hand);
    expect(traitsOf(hero, spidey, DEPS)).toEqual(before.traits);
    expect(characterProfile(hero, spidey, DEPS)).toEqual(before.profile);
    // Peter Parker's side is blank too: the blank is on the card.
    expect(activeAbilityRefs(withForm(run.state, "alterEgo"), spidey, DEPS)).toEqual([]);
  });

  it("round 2's villain phase: the blank ended before step one, and Spider-Sense is offered again on the active villain's attack", () => {
    const first = roundWatching(pestilenceActive(), { boosts: [BOOST_0], reveals: [QUIET[0]!] });
    // 1B passed the counter to Death, who attacks in round 2.
    expect(activeCode(first.state)).toBe(DEATH);
    const healed = patchInstance(first.state, identityOf(first.state, P1), { damage: 0 });
    const second = roundWatching(healed, { boosts: [BOOST_0], reveals: [QUIET[1]!] });
    expect(villainAttacks(second)).toEqual([DEATH]);
    expect(second.offered).toBe(1);
    const expired = firstAt(second.events, "lastingEffectEnded", (e) => e.reason === "expired");
    expect(expired).toBeGreaterThan(-1);
    expect(firstAt(second.events, "threatPlaced")).toBeGreaterThan(expired);
    expect(textBoxBlank(second.state, identityOf(second.state, P1))).toBe(false);
  });

  it("at 0 hit points Pestilence attacks and blanks nothing; side B's Forced Response is the same as side A's", () => {
    const zero = withDamageOn(pestilenceActive(), PESTILENCE, 9);
    const none = roundWatching(zero, { boosts: [BOOST_0], reveals: [QUIET[0]!] });
    expect(attacksBy(none.events, none.state, PESTILENCE)).toHaveLength(1);
    expect(textBoxBlank(none.state, identityOf(none.state, P1))).toBe(false);

    const sideB = roundWatching(pestilenceActive("b"), { boosts: [BOOST_0], reveals: [QUIET[0]!] });
    expect(attacksBy(sideB.events, sideB.state, "45083b")).toHaveLength(1);
    expect(blanksOn(sideB.state, identityOf(sideB.state, P1))).toEqual(["nextVillainPhaseBegins"]);
  });

  it("Golden Horse on Pestilence, used on the player's turn: the blank lasts the rest of the player phase and is gone before step one of that round's villain phase", () => {
    const base = setupGame();
    const horsed = attachToHost(base, GOLDEN_HORSE, villain(base, PESTILENCE));
    const used = attackUsing(horsed.state, PESTILENCE, GOLDEN_HORSE);
    expect(used.offered).toBe(1);
    const spidey = identityOf(used.state, P1);
    expect(blanksOn(used.state, spidey)).toEqual(["nextVillainPhaseBegins"]);
    expect(inPlay(used.state, GOLDEN_HORSE)).toHaveLength(0);
    // War, the active villain, attacks in step two of the same round: Spider-Sense is offered.
    const run = roundWatching(used.state, { boosts: [BOOST_0], reveals: [QUIET[0]!] });
    expect(run.offered).toBe(1);
    expect(textBoxBlank(run.state, spidey)).toBe(false);
  });
});

describe("Plague and Pestilence (45088): When Defeated (§3.13)", () => {
  it("the player who defeated it has their identity's text box blank until that round's villain phase begins", () => {
    const run = defeatPlague(setupGame());
    const spidey = identityOf(run.state, P1);
    expect(inPlay(run.state, PLAGUE)).toHaveLength(0);
    expect(blanksOn(run.state, spidey)).toEqual(["nextVillainPhaseBegins"]);
    expect(activeAbilityRefs(run.state, spidey, DEPS)).toEqual([]);
    // The same round's villain phase: gone before step one, so Spider-Sense is offered on War's attack.
    const next = roundWatching(run.state, { boosts: [BOOST_0], reveals: [QUIET[1]!] });
    expect(next.offered).toBe(1);
    expect(textBoxBlank(next.state, spidey)).toBe(false);
  });

  it("a second blank from it in round 2's player phase ends at the same moment as Pestilence's from round 1", () => {
    const s = setupGame();
    const first = roundWatching(withActive(s, villain(s, PESTILENCE)), { boosts: [BOOST_0], reveals: [QUIET[1]!] });
    const healed = patchInstance(first.state, identityOf(first.state, P1), { damage: 0 });
    const second = defeatPlague(healed);
    const spidey = identityOf(second.state, P1);
    expect(blanksOn(second.state, spidey)).toEqual(["nextVillainPhaseBegins", "nextVillainPhaseBegins"]);
    const ids = second.state.lastingEffects.filter((e) => e.kind === "blankTextBox").map((e) => e.id);
    const run = roundWatching(second.state, { boosts: [BOOST_0], reveals: [QUIET[2]!] });
    const ends = run.events.flatMap((e, index) =>
      e.type === "lastingEffectEnded" && ids.includes(e.id) ? [{ id: e.id, index }] : [],
    );
    expect(ends.map((e) => e.id)).toEqual(ids);
    expect(ends[1]!.index - ends[0]!.index).toBe(1);
    expect(firstAt(run.events, "threatPlaced")).toBeGreaterThan(ends[1]!.index);
    expect(textBoxBlank(run.state, spidey)).toBe(false);
  });

  it("defeated by another player, it is that player's identity that is blank", () => {
    const s = setupGame({ players: 2 });
    const turned = driveEventsPicking(DEPS, s, firstLegal, endTurn(P1)).state;
    const { state, id } = encounterCardInVillainArea(turned, PLAGUE, 1);
    const run = driveEventsPicking(DEPS, withForm(state, { heroForm: 0 }, P2), firstLegal, {
      type: "basicThwart",
      playerId: P2,
      thwarterInstanceId: identityOf(state, P2),
      schemeInstanceId: id,
    });
    expect(textBoxBlank(run.state, identityOf(run.state, P2))).toBe(true);
    expect(textBoxBlank(run.state, identityOf(run.state, P1))).toBe(false);
  });
});

describe("Horseman of War / Famine / Pestilence / Death (45092 to 45095)", () => {
  const CASES = [
    [H_WAR, WAR, "War"],
    [H_FAMINE, FAMINE, "Famine"],
    [H_PESTILENCE, PESTILENCE, "Pestilence"],
    [H_DEATH, DEATH, "Death"],
  ] as const;

  for (const [treachery, code, name] of CASES) {
    it(`${name}: When Revealed heals 2, gives a tough status card and ${name} activates against you`, () => {
      const s = withDamageOn(setupGame(), code, 5);
      // War is the active villain and takes his own activation first; the Horseman then makes `code` activate.
      const run = round(s, { boosts: [BOOST_0], reveals: [treachery] });
      const target = villain(run.state, code);
      expect(attacksBy(run.events, run.state, code)).toHaveLength(code === WAR ? 2 : 1);
      expect(inst(run.state, target).statuses.tough).toBe(1);
      expect(inst(run.state, target).damage).toBe(3);
    });
  }

  it("a tough card already on the Horseman stays one: a character holds at most one", () => {
    const s = patchInstance(withDamageOn(setupGame(), DEATH, 5), villain(setupGame(), DEATH), {
      damage: 5,
      statuses: { stunned: 0, confused: 0, tough: 1 },
    });
    const run = round(s, { boosts: [BOOST_0], reveals: [H_DEATH] });
    expect(inst(run.state, villain(run.state, DEATH)).statuses.tough).toBe(1);
  });

  it("in alter-ego form the revealed Horseman schemes against you instead", () => {
    const run = round(setupGame(), { boosts: [BOOST_0], reveals: [H_FAMINE], heroForm: false });
    expect(events(run.events, "schemeResolved").length).toBeGreaterThan(0);
  });

  it("Boost: after War's attack with Horseman of Famine as the boost card, Famine attacks with no boost card", () => {
    const run = round(setupGame(), { boosts: [H_FAMINE] });
    const wars = attacksBy(run.events, run.state, WAR);
    const famines = attacksBy(run.events, run.state, FAMINE);
    expect(wars).toHaveLength(1);
    expect(famines).toHaveLength(1);
    expect(famines[0]!.boostIcons).toBe(0);
    expect(famines[0]!.baseAtk).toBe(1);
    // War's attack finished first, then Famine's.
    const order = events(run.events, "attackResolved").map((e) => codeOf(run.state, e.enemyInstanceId));
    expect(order.indexOf(WAR)).toBeLessThan(order.indexOf(FAMINE));
  });

  it("Boost: Horseman of War on Famine's attack makes War attack with exactly his printed ATK (2)", () => {
    const base = setupGame();
    const s = withActive(base, villain(base, FAMINE));
    const run = round(s, { boosts: [H_WAR] });
    const wars = attacksBy(run.events, run.state, WAR);
    expect(wars).toHaveLength(1);
    expect(wars[0]!.baseAtk + wars[0]!.boostIcons).toBe(2);
  });
});

/** The active counter's moves in these events, as `[from, to, reason]` card codes. */
const counterMoves = (run: { readonly state: GameState; readonly events: readonly GameEvent[] }) =>
  events(run.events, "activeVillainChanged").map((e) => [codeOf(run.state, e.from), codeOf(run.state, e.to), e.reason]);
/** Every villain attack in these events, in order, as the attacker's card code. */
const villainAttacks = (run: { readonly state: GameState; readonly events: readonly GameEvent[] }) =>
  events(run.events, "attackResolved")
    .map((e) => codeOf(run.state, e.enemyInstanceId))
    .filter((code) => VILLAINS.includes(code));
/**
 * Cards that do nothing when dealt and revealed: side schemes with no When Revealed and no hazard icon (Plague and
 * Pestilence, Core's Crowd Control, A Time of Famine, The Specter of Death). The Standard set's own treacheries make
 * the villain activate, which would pass the counter a second time.
 */
const QUIET = ["45088", "01108", "45087", "45089"];
/**
 * A round with a blank boost card and a quiet card dealt, so only step two of the villain phase moves the counter. The
 * hero is healed and the main scheme cleared first, so a run of rounds cannot end the game.
 */
const quietRound = (s: GameState, n = 0, heroForm = true, boosts: readonly string[] = [BOOST_0]) => {
  const fresh = patchInstance(patchInstance(s, identityOf(s, P1), { damage: 0 }), s.mainScheme.instanceId, {
    threat: 0,
  });
  return round(fresh, { boosts, reveals: [QUIET[n % QUIET.length]!], heroForm });
};
/** A round whose only dealt card is `code`, the hero healed and the main scheme cleared first. */
const quietRoundWith = (s: GameState, code: string) => {
  const fresh = patchInstance(patchInstance(s, identityOf(s, P1), { damage: 0 }), s.mainScheme.instanceId, {
    threat: 0,
  });
  return round(fresh, { boosts: [BOOST_0], reveals: [code] });
};
/** The events of step two only: everything before the first encounter card is revealed. */
const stepTwo = (run: { readonly state: GameState; readonly events: readonly GameEvent[] }) => {
  const cut = run.events.findIndex((e) => e.type === "encounterCardRevealed");
  return { state: run.state, events: cut < 0 ? run.events : run.events.slice(0, cut) };
};

describe("The Horsemen of Apocalypse 1B (45085b): the active counter passes along the row (§3.7)", () => {
  it("the row is War, Famine, Pestilence, Death with the counter on War, as this file seats it", () => {
    const s = setupGame();
    expect(s.villainRow!.map((id) => codeOf(s, id))).toEqual(VILLAINS);
    expect(activeCode(s)).toBe(WAR);
  });

  it("1 player: round 1 War attacks and the counter goes to Famine; Famine, Pestilence, Death follow; round 5 is War again", () => {
    let s = setupGame();
    const attackers: string[] = [];
    for (let n = 0; n < 5; n++) {
      // Each of the first four rounds deals a different quiet card (the earlier ones are in play by then). The fifth
      // deals whatever the deck holds, so only its step two is read.
      const whole =
        n < 4 ? quietRound(s, n) : round(patchInstance(s, identityOf(s, P1), { damage: 0 }), { boosts: [BOOST_0] });
      const run = n < 4 ? whole : stepTwo(whole);
      expect(villainAttacks(run), `round ${n + 1}`).toHaveLength(1);
      attackers.push(villainAttacks(run)[0]!);
      expect(counterMoves(run)).toEqual([[VILLAINS[n % 4], VILLAINS[(n + 1) % 4], "nextInRow"]]);
      s = whole.state;
    }
    expect(attackers).toEqual([WAR, FAMINE, PESTILENCE, DEATH, WAR]);
  });

  it("2 players: the active villain is read afresh for each player. War attacks player 1, Famine attacks player 2, and the counter ends on Pestilence", () => {
    const base = setupGame({ players: 2 });
    // A blank boost card for each villain activation, then a quiet card dealt to each player.
    const stackedDeck = stackEncounterDeck(base, "01186", "01187", QUIET[0]!, QUIET[1]!);
    const inHero = withForm(withForm(stackedDeck, { heroForm: 0 }, P1), { heroForm: 0 }, P2);
    const run = driveEventsPicking(DEPS, inHero, firstLegal, endTurn(P1), endTurn(P2));
    const targets = events(run.events, "attackResolved")
      .filter((e) => VILLAINS.includes(codeOf(run.state, e.enemyInstanceId)))
      .map((e) => [codeOf(run.state, e.enemyInstanceId), e.targetInstanceId]);
    expect(targets).toEqual([
      [WAR, identityOf(run.state, P1)],
      [FAMINE, identityOf(run.state, P2)],
    ]);
    expect(counterMoves(run)).toEqual([
      [WAR, FAMINE, "nextInRow"],
      [FAMINE, PESTILENCE, "nextInRow"],
    ]);
    expect(activeCode(run.state)).toBe(PESTILENCE);
  });

  it("in alter-ego form the villain schemes, and the scheme passes the counter too", () => {
    const run = quietRound(setupGame(), 0, false);
    expect(villainAttacks(run)).toEqual([]);
    expect(events(run.events, "schemeResolved")).toHaveLength(1);
    expect(counterMoves(run)).toEqual([[WAR, FAMINE, "nextInRow"]]);
  });

  it("Q4: a stunned War does not attack (the stunned card is discarded), so he did not activate and the counter stays on War", () => {
    const base = setupGame();
    const stunned = patchInstance(base, villain(base, WAR), { statuses: { stunned: 1, confused: 0, tough: 0 } });
    // No boost card is stacked: with no attack none is dealt, and the Standard set's own would be the card revealed.
    const run = quietRound(stunned, 0, true, []);
    expect(villainAttacks(run)).toEqual([]);
    expect(inst(run.state, villain(run.state, WAR)).statuses.stunned).toBe(0);
    expect(counterMoves(run)).toEqual([]);
    expect(activeCode(run.state)).toBe(WAR);
  });

  it("Q4: a confused War does not scheme against an alter-ego, and the counter stays on War", () => {
    const base = setupGame();
    const confused = patchInstance(base, villain(base, WAR), { statuses: { stunned: 0, confused: 1, tough: 0 } });
    const run = quietRound(confused, 0, false, []);
    expect(events(run.events, "schemeResolved")).toHaveLength(0);
    expect(counterMoves(run)).toEqual([]);
    expect(activeCode(run.state)).toBe(WAR);
  });

  it("a Horseman at 0 hit points keeps his place in the row: he takes the counter and activates in his turn", () => {
    const first = quietRound(withDamageOn(setupGame(), FAMINE, 9));
    expect(activeCode(first.state)).toBe(FAMINE);
    const second = quietRound(first.state, 1);
    expect(villainAttacks(second)).toEqual([FAMINE]);
    expect(activeCode(second.state)).toBe(PESTILENCE);
  });
});

describe("'after a villain activates' with several villains (§3.8, Q5)", () => {
  it("Horseman of Death revealed in step four: Death heals 2, gets a tough card and attacks, and each activation passes the counter one place", () => {
    const s = withDamageOn(setupGame(), DEATH, 5);
    const run = round(s, { boosts: [BOOST_0], reveals: [H_DEATH] });
    expect(villainAttacks(run)).toEqual([WAR, DEATH]);
    expect(damageOf(run.state, DEATH)).toBe(3);
    expect(inst(run.state, villain(run.state, DEATH)).statuses.tough).toBe(1);
    // War's own activation moved it War -> Famine. Death's moved it Famine -> Pestilence: from the holder (Famine),
    // not from Death, the villain that activated.
    expect(counterMoves(run)).toEqual([
      [WAR, FAMINE, "nextInRow"],
      [FAMINE, PESTILENCE, "nextInRow"],
    ]);
  });

  it("War attacks with Horseman of Famine as his boost card: War's attack finishes and 1B moves the counter to Famine; then Famine activates with no boost card and 1B moves it to Pestilence; next round Pestilence is active", () => {
    const run = round(setupGame(), { boosts: [H_FAMINE], reveals: [QUIET[0]!] });
    expect(villainAttacks(run)).toEqual([WAR, FAMINE]);
    expect(attacksBy(run.events, run.state, FAMINE)[0]!.boostIcons).toBe(0);
    expect(counterMoves(run)).toEqual([
      [WAR, FAMINE, "nextInRow"],
      [FAMINE, PESTILENCE, "nextInRow"],
    ]);
    // The first move is logged before Famine's attack resolves: all of War's activation's triggers come first.
    const order = run.events.flatMap((e) =>
      e.type === "activeVillainChanged"
        ? [`counter:${codeOf(run.state, e.to)}`]
        : e.type === "attackResolved"
          ? [`attack:${codeOf(run.state, e.enemyInstanceId)}`]
          : [],
    );
    expect(order).toEqual([`attack:${WAR}`, `counter:${FAMINE}`, `attack:${FAMINE}`, `counter:${PESTILENCE}`]);
    const next = quietRound(run.state, 1);
    expect(villainAttacks(next)).toEqual([PESTILENCE]);
  });

  it("Q5: Famine holds the counter; her activation moves it to Pestilence, and Death activating by the Horseman moves it on from Pestilence (the holder) to Death", () => {
    const base = setupGame();
    const s = withActive(base, villain(base, FAMINE));
    const run = round(s, { boosts: [BOOST_0], reveals: [H_DEATH] });
    expect(attacksBy(run.events, run.state, DEATH)).toHaveLength(1);
    // Famine's own activation moves it Famine -> Pestilence, Death's (from the treachery) Pestilence -> Death. Both
    // are "one position from the villain holding it" (Q5 = A), so Death's activation never moves it from Death.
    expect(activeCode(run.state)).toBe(DEATH);
  });

  it("Q5, the owner's test: row [Death, Pestilence, War, Famine] with the counter on Death when Horseman of War is revealed. War heals 2, gets a tough card and attacks; the counter moves from Death to Pestilence, not to Famine (War's neighbor), and next round Pestilence is active", () => {
    const base = withDamageOn(setupGame(), WAR, 5);
    // Famine, the rightmost, starts with the counter: her own activation in step two wraps it to Death, the leftmost,
    // so Death holds it when the treachery is revealed in step four.
    const s = seated(base, [DEATH, PESTILENCE, WAR, FAMINE], FAMINE);
    const run = round(s, { boosts: [BOOST_0], reveals: [H_WAR] });
    expect(villainAttacks(run)).toEqual([FAMINE, WAR]);
    expect(damageOf(run.state, WAR)).toBe(3);
    expect(inst(run.state, villain(run.state, WAR)).statuses.tough).toBe(1);
    expect(counterMoves(run)).toEqual([
      [FAMINE, DEATH, "nextInRow"],
      [DEATH, PESTILENCE, "nextInRow"],
    ]);
    expect(activeCode(run.state)).toBe(PESTILENCE);
    const next = quietRound(run.state, 1);
    expect(villainAttacks(next)).toEqual([PESTILENCE]);
  });
});

describe("side schemes (45086, 45087, 45089): When Defeated", () => {
  const defeated = (s0: GameState, code: string, player = P1) => {
    // A second player acts after the first has ended their turn.
    const turned = player === P1 ? s0 : driveEventsPicking(DEPS, s0, firstLegal, endTurn(P1)).state;
    const { state, id } = encounterCardInVillainArea(turned, code, 1);
    const thwarted = driveEventsPicking(DEPS, withForm(state, { heroForm: 0 }, player), firstLegal, {
      type: "basicThwart",
      playerId: player,
      thwarterInstanceId: identityOf(state, player),
      schemeInstanceId: id,
    });
    return thwarted;
  };

  it("The Ravages of War: the player who defeated it discards an upgrade or support they control", () => {
    const { state } = playFromHand(DEPS, withForm(setupGame(), { heroForm: 0 }), AUNT_MAY, 1);
    const run = defeated(state, RAVAGES);
    expect(inPlay(run.state, AUNT_MAY)).toHaveLength(0);
  });

  it("A Time of Famine: the defeating player (player 2, not the first player) discards 10, the first player none", () => {
    const s = setupGame({ players: 2 });
    const run = defeated(s, TIME_OF_FAMINE, P2);
    const p = (state: GameState, pid: typeof P1) => playerOf(state, pid).discard.length;
    expect(p(run.state, P2) - p(s, P2)).toBe(10);
    expect(p(run.state, P1) - p(s, P1)).toBe(0);
  });

  it("The Specter of Death: the defeating player's identity and ally each take 1 damage", () => {
    const base = playFromHand(DEPS, withForm(setupGame(), { heroForm: 0 }), "01059", 4).state;
    const run = defeated(base, SPECTER);
    expect(heroDamage(run.state)).toBe(1);
    expect(inst(run.state, inPlay(run.state, "01059")[0]!).damage).toBe(1);
  });
});

describe("considered to have at least 1 hit point (Golden Horse 45090, Metal Wings 45091; §3.10, Q6 = A)", () => {
  const horseOn = (s: GameState, code: string) => attachToHost(s, GOLDEN_HORSE, villain(s, code)).state;
  const withAuntMay = (s: GameState) => playFromHand(DEPS, withForm(s, { heroForm: 0 }), AUNT_MAY, 1).state;

  it("Golden Horse is data: attaches to the villain with the fewest hit points without the Aerial trait", () => {
    expect(dataOf(GOLDEN_HORSE).attachesTo).toEqual({
      kind: "superlative",
      among: "villain",
      order: "lowest",
      measure: "remainingHp",
      withoutTrait: trait("AERIAL"),
    });
  });

  it("War at 0 with Golden Horse reads 1 hit point (the dial stays 0), so after he attacks the player discards a support", () => {
    const s = withAuntMay(horseOn(withDamageOn(setupGame(), WAR, 9), WAR));
    expect(remainingHitPoints(s, villain(s, WAR), DEPS)).toBe(0);
    expect(consideredRemainingHitPoints(s, villain(s, WAR), DEPS)).toBe(1);
    const run = round(s);
    expect(attacksBy(run.events, run.state, WAR)).toHaveLength(1);
    expect(inPlay(run.state, AUNT_MAY)).toHaveLength(0);
  });

  it("the other Horsemen's constants read the floor with no change to them: all four at 0, Golden Horse on Famine, and nobody is defeated", () => {
    let s = setupGame();
    for (const code of [WAR, PESTILENCE, DEATH]) s = withDamageOn(s, code, 9);
    s = horseOn(withDamageOn(s, FAMINE, 7), FAMINE);
    const run = attack(s, FAMINE);
    expect(damageOf(run.state, FAMINE)).toBe(9);
    expect(events(run.events, "characterDefeated")).toHaveLength(0);
    expect(run.state.villains.every((v) => !v.defeated)).toBe(true);
    expect(run.state.outcome).toBeNull();
    // A further attack on a Horseman at 0 changes nothing either.
    const again = attack(run.state, WAR);
    expect(events(again.events, "characterDefeated")).toHaveLength(0);
    expect(again.state.outcome).toBeNull();
  });

  it("the floor gone (the horse discarded with all four at 0), all four fall together and the players win", () => {
    let s = setupGame();
    for (const code of VILLAINS) s = withDamageOn(s, code, 9);
    const horsed = attachToHost(s, GOLDEN_HORSE, villain(s, FAMINE));
    // The watch on a character at 0 starts when the defeat check first passes it over: an attack on Death does that.
    const held = attack(horsed.state, DEATH);
    expect(held.state.outcome).toBeNull();
    // Surgery: the horse off the table. The next check finds nothing holding any of the four.
    const famine = villain(held.state, FAMINE);
    const off = patchInstance(patchInstance(held.state, famine, { attachments: [] }), horsed.id, { attachedTo: null });
    const run = attack(off, WAR);
    expect(events(run.events, "characterDefeated")).toHaveLength(4);
    expect(run.state.outcome).toEqual({ result: "win", reason: "allVillainsDefeated" });
  });

  it("Golden Horse on War: War has the Aerial trait, and a second Golden Horse revealed goes to the lowest villain without it (Famine), not to War", () => {
    const base = withDamageOn(withDamageOn(setupGame(), WAR, 8), FAMINE, 3);
    const first = horseOn(base, WAR);
    expect(traitsOf(first, villain(first, WAR), DEPS)).toContain(trait("AERIAL"));
    expect(traitsOf(first, villain(first, FAMINE), DEPS)).not.toContain(trait("AERIAL"));
    const run = round(first, { boosts: [BOOST_0], reveals: [GOLDEN_HORSE] });
    expect(inst(run.state, villain(run.state, WAR)).attachments).toHaveLength(1);
    expect(inst(run.state, villain(run.state, FAMINE)).attachments).toHaveLength(1);
    expect(traitsOf(run.state, villain(run.state, FAMINE), DEPS)).toContain(trait("AERIAL"));
  });

  it("the host is chosen by the true dial: Pestilence really at 0 takes the first horse, and Famine at 1 the second", () => {
    // Pestilence at 0 has no floor and no Aerial trait; Famine at 1 left. The horse goes to Pestilence, the real lowest.
    const s = withDamageOn(withDamageOn(setupGame(), PESTILENCE, 9), FAMINE, 8);
    const run = round(s, { boosts: [BOOST_0], reveals: [GOLDEN_HORSE] });
    expect(inst(run.state, villain(run.state, PESTILENCE)).attachments).toHaveLength(1);
    // Now floored at 1, tied with Famine by the considered value, Pestilence is out by trait and Famine is next.
    const next = quietRoundWith(run.state, GOLDEN_HORSE);
    expect(inst(next.state, villain(next.state, FAMINE)).attachments).toHaveLength(1);
  });

  it("Metal Wings on Death at 4: an attack on Death deals its damage and the attacker takes 1 (retaliate 1)", () => {
    const s0 = withDamageOn(setupGame(), DEATH, 5);
    const { state } = attachToHost(s0, METAL_WINGS, villain(s0, DEATH));
    const run = attack(state, DEATH);
    expect(damageOf(run.state, DEATH)).toBe(7);
    expect(heroDamage(run.state)).toBe(1);
  });

  it("Metal Wings on Death at 0: Death reads 1 hit point, his Forced Response still deals 1 to each character, and the other three at 0 are not defeated", () => {
    let s = setupGame();
    for (const code of VILLAINS) s = withDamageOn(s, code, 9);
    const winged = attachToHost(s, METAL_WINGS, villain(s, DEATH)).state;
    expect(consideredRemainingHitPoints(winged, villain(winged, DEATH), DEPS)).toBe(1);
    // The control: Death with 1 hit point of his own and no Metal Wings, the other three at 0.
    const alive = withDamageOn(s, DEATH, 8);
    const control = round(withActive(alive, villain(alive, DEATH)), { boosts: [BOOST_0], reveals: [QUIET[0]!] });
    expect(control.state.outcome).toBeNull();
    const run = round(withActive(winged, villain(winged, DEATH)), { boosts: [BOOST_0], reveals: [QUIET[0]!] });
    expect(attacksBy(run.events, run.state, DEATH)).toHaveLength(1);
    // Both resolve the Forced Response (1 damage); Metal Wings prints +1 ATK, the one point of difference.
    expect(heroDamage(run.state) - heroDamage(control.state)).toBe(1);
    expect(heroDamage(run.state)).toBeGreaterThanOrEqual(2);
    expect(events(run.events, "characterDefeated")).toHaveLength(0);
    expect(run.state.outcome).toBeNull();
  });
});

/** Whether a window is offering the Hero Response of `code` (Golden Horse or Metal Wings). */
const offers = (s: GameState, code: string) =>
  s.pendingChoice?.prompt.kind === "chooseTriggers" &&
  s.pendingChoice.options.some((o) => o.ref?.kind === "ability" && codeOf(s, o.ref.instanceId) === code);
/** A basic attack on `target` by Spider-Man, taking the Hero Response of `code` when a window offers it. */
const attackUsing = (s: GameState, target: string, code: string) => {
  let offered = 0;
  const pick = (state: GameState) => {
    if (!offers(state, code)) return firstLegal(state);
    offered += 1;
    return state
      .pendingChoice!.options.filter((o) => o.ref?.kind === "ability" && codeOf(state, o.ref.instanceId) === code)
      .map((o) => o.optionId);
  };
  const ready = patchInstance(withForm(s, { heroForm: 0 }), identityOf(s, P1), { exhausted: false });
  const run = driveEventsPicking(DEPS, ready, pick, hit(s, identityOf(s, P1), villain(s, target)));
  return { ...run, offered };
};

describe("Golden Horse (45090) and Metal Wings (45091): Hero Response, resolve its Forced Response as if it just attacked you → discard this card (§3.11)", () => {
  it("Golden Horse on Famine (at 5): after a basic attack the response is offered; used, 10 cards are discarded, the horse is discarded, and Famine has not attacked", () => {
    const base = withDamageOn(setupGame(), FAMINE, 4);
    const horsed = attachToHost(base, GOLDEN_HORSE, villain(base, FAMINE));
    const before = playerOf(horsed.state, P1);
    expect(before.deck.length).toBeGreaterThanOrEqual(10);
    const run = attackUsing(horsed.state, FAMINE, GOLDEN_HORSE);
    expect(run.offered).toBe(1);
    expect(discardCount(run.state) - before.discard.length).toBe(10);
    expect(playerOf(run.state, P1).deck.length).toBe(before.deck.length - 10);
    expect(inPlay(run.state, GOLDEN_HORSE)).toHaveLength(0);
    expect(inst(run.state, villain(run.state, FAMINE)).attachments).toEqual([]);
    // No attack by Famine: no boost card, no damage, the active counter (1B hears activations) still on War.
    expect(attacksBy(run.events, run.state, FAMINE)).toHaveLength(0);
    expect(events(run.events, "boostCardDealt")).toHaveLength(0);
    expect(heroDamage(run.state)).toBe(heroDamage(horsed.state));
    expect(counterMoves(run)).toEqual([]);
    expect(events(run.events, "resolveAbilityCostSettled")).toMatchObject([
      { trigger: "forcedResponse", resolved: 1, paid: true, ofInstanceId: villain(run.state, FAMINE) },
    ]);
  });

  it("all four at 0, Golden Horse on Famine: nobody is defeated; the player attacks Famine and uses the response (discard 10, discard the horse) and all four fall, the game is won", () => {
    let s = setupGame();
    for (const code of VILLAINS) s = withDamageOn(s, code, 9);
    const horsed = attachToHost(s, GOLDEN_HORSE, villain(s, FAMINE));
    const before = discardCount(horsed.state);
    const run = attackUsing(horsed.state, FAMINE, GOLDEN_HORSE);
    expect(run.offered).toBe(1);
    expect(discardCount(run.state) - before).toBe(10);
    expect(events(run.events, "characterDefeated")).toHaveLength(4);
    expect(run.state.outcome).toEqual({ result: "win", reason: "allVillainsDefeated" });
    // Nobody fell before the horse left: every defeat comes after its discard.
    const left = run.events.findIndex(
      (e) => e.type === "cardDiscardedFromPlay" && codeOf(run.state, e.instanceId) === GOLDEN_HORSE,
    );
    const fell = run.events.findIndex((e) => e.type === "characterDefeated");
    expect(left).toBeGreaterThan(-1);
    expect(fell).toBeGreaterThan(left);
  });

  it("the same table with the response declined: nobody is defeated and the horse stays", () => {
    let s = setupGame();
    for (const code of VILLAINS) s = withDamageOn(s, code, 9);
    const horsed = attachToHost(s, GOLDEN_HORSE, villain(s, FAMINE));
    const run = attack(horsed.state, FAMINE);
    expect(events(run.events, "characterDefeated")).toHaveLength(0);
    expect(inPlay(run.state, GOLDEN_HORSE)).toHaveLength(1);
    expect(run.state.outcome).toBeNull();
  });

  it("Q7 = A: Golden Horse on War with no upgrade or support in play is not offered (the Forced Response can change nothing); with Aunt May in play it is, and she is discarded with the horse", () => {
    const horsed = attachToHost(setupGame(), GOLDEN_HORSE, villain(setupGame(), WAR));
    expect(cardsInPlay(horsed.state).filter((i) => playerOf(horsed.state, P1).playArea.includes(i))).toEqual([]);
    const bare = attackUsing(horsed.state, WAR, GOLDEN_HORSE);
    expect(bare.offered).toBe(0);
    expect(inPlay(bare.state, GOLDEN_HORSE)).toHaveLength(1);

    const { state } = playFromHand(DEPS, withForm(horsed.state, { heroForm: 0 }), AUNT_MAY, 1);
    const run = attackUsing(state, WAR, GOLDEN_HORSE);
    expect(run.offered).toBe(1);
    expect(inPlay(run.state, AUNT_MAY)).toHaveLength(0);
    expect(inPlay(run.state, GOLDEN_HORSE)).toHaveLength(0);
    expect(attacksBy(run.events, run.state, WAR)).toHaveLength(0);
  });

  it("an attack on a villain the horse is not on does not offer it", () => {
    const horsed = attachToHost(setupGame(), GOLDEN_HORSE, villain(setupGame(), FAMINE));
    expect(attackUsing(horsed.state, DEATH, GOLDEN_HORSE).offered).toBe(0);
  });

  it("Metal Wings on Death at 0: after an attack on Death (retaliate 1 first) the response deals 1 to Spider-Man and his ally, and Metal Wings is discarded", () => {
    const base = withDamageOn(setupGame(), DEATH, 9);
    const { state: withAlly } = playFromHand(DEPS, withForm(base, { heroForm: 0 }), "01059", 4);
    const winged = attachToHost(withAlly, METAL_WINGS, villain(withAlly, DEATH));
    const run = attackUsing(winged.state, DEATH, METAL_WINGS);
    expect(run.offered).toBe(1);
    // 1 from retaliate, 1 from Death's Forced Response; the ally takes the Forced Response's 1 only.
    expect(heroDamage(run.state)).toBe(2);
    expect(inst(run.state, inPlay(run.state, "01059")[0]!).damage).toBe(1);
    expect(inPlay(run.state, METAL_WINGS)).toHaveLength(0);
    expect(keywordTotal(run.state, villain(run.state, DEATH), "retaliate", DEPS)).toBe(0);
    expect(attacksBy(run.events, run.state, DEATH)).toHaveLength(0);
  });
});

describe("Rough Riders (45096): When Revealed (§3.11, §3.7 test 3)", () => {
  /** A round in alter-ego form with a confused active villain, so step two makes no activation and deals no boost card. */
  const reveal = (s: GameState) => {
    const holder = s.activeVillainId!;
    const quiet = patchInstance(s, holder, { statuses: { stunned: 0, confused: 1, tough: 0 } });
    const run = round(quiet, { boosts: [], reveals: [ROUGH_RIDERS], heroForm: false });
    const cut = run.events.findIndex((e) => e.type === "encounterCardRevealed");
    return { state: run.state, events: run.events.slice(cut) };
  };

  it("the counter on Death (the last in the row): Death's Forced Response, the counter wraps to War once, War's Forced Response; 1B does not move it again", () => {
    const base = playFromHand(DEPS, withForm(setupGame(), { heroForm: 0 }), AUNT_MAY, 1).state;
    const s = withActive(base, villain(base, DEATH));
    const before = heroDamage(s);
    const run = reveal(s);
    // Death: 1 damage to each character you control. War: discard an upgrade or support you control.
    expect(heroDamage(run.state) - before).toBe(1);
    expect(inPlay(run.state, AUNT_MAY)).toHaveLength(0);
    expect(counterMoves(run)).toEqual([[DEATH, WAR, "nextInRow"]]);
    expect(activeCode(run.state)).toBe(WAR);
    // Nothing attacked or schemed: no activation for 1B to hear.
    expect(villainAttacks(run)).toEqual([]);
    expect(events(run.events, "schemeResolved")).toHaveLength(0);
    expect(events(run.events, "boostCardDealt")).toHaveLength(0);
    const resolved = events(run.events, "abilityResolved").map((e) => e.abilityId as string);
    expect(resolved.filter((id) => id.endsWith("-forced-response"))).toEqual([
      "45084a.death-forced-response",
      "45081a.war-forced-response",
    ]);
  });

  it("the counter on Pestilence at 0, the next is Death at 0: each resolves as if it has at least 1 hit point; the identity's text box is blank until the next villain phase begins; the counter is on Death; 1 damage to the identity and to each ally", () => {
    let base = playFromHand(DEPS, withForm(setupGame(), { heroForm: 0 }), "01059", 4).state;
    for (const code of [PESTILENCE, DEATH]) base = withDamageOn(base, code, 9);
    const s = withActive(base, villain(base, PESTILENCE));
    const before = heroDamage(s);
    const run = reveal(s);
    expect(activeCode(run.state)).toBe(DEATH);
    expect(counterMoves(run)).toEqual([[PESTILENCE, DEATH, "nextInRow"]]);
    // Pestilence's: the identity's text box is blank until the next villain phase begins.
    expect(blanksOn(run.state, identityOf(run.state, P1))).toEqual(["nextVillainPhaseBegins"]);
    expect(heroDamage(run.state) - before).toBe(1);
    expect(inst(run.state, inPlay(run.state, "01059")[0]!).damage).toBe(1);
    // The floor lasted only while each Forced Response resolved, and nobody fell.
    expect(run.state.lastingEffects.filter((e) => e.kind === "ruleGrant")).toEqual([]);
    expect(consideredRemainingHitPoints(run.state, villain(run.state, DEATH), DEPS)).toBe(0);
    expect(run.state.villains.every((v) => !v.defeated)).toBe(true);
    expect(damageOf(run.state, DEATH)).toBe(9);
  });
});

describe("Metal Wings (45091): When Revealed, attach to Death and move the active counter to him", () => {
  it("revealed with Famine holding the counter: it attaches to Death and the counter goes straight to Death, past Pestilence", () => {
    // War's own activation in step two passes the counter to Famine; Metal Wings is revealed in step four.
    const run = round(setupGame(), { boosts: [BOOST_0], reveals: [METAL_WINGS] });
    const death = villain(run.state, DEATH);
    const wings = inPlay(run.state, METAL_WINGS);
    expect(wings).toHaveLength(1);
    expect(inst(run.state, death).attachments).toEqual(wings);
    expect(counterMoves(run)).toEqual([
      [WAR, FAMINE, "nextInRow"],
      [FAMINE, DEATH, "effect"],
    ]);
    expect(activeCode(run.state)).toBe(DEATH);
    expect(keywordTotal(run.state, death, "retaliate", DEPS)).toBe(1);
  });

  it("revealed with Death already holding the counter: it attaches and the counter stays", () => {
    const base = setupGame();
    // Pestilence starts with it, so her activation passes it to Death before the reveal.
    const run = round(withActive(base, villain(base, PESTILENCE)), { boosts: [BOOST_0], reveals: [METAL_WINGS] });
    expect(counterMoves(run)).toEqual([[PESTILENCE, DEATH, "nextInRow"]]);
    expect(activeCode(run.state)).toBe(DEATH);
    expect(inst(run.state, villain(run.state, DEATH)).attachments).toHaveLength(1);
  });
});

describe("Metal Wings (45091): retaliate 1 on Death", () => {
  it("is data: attaches to Death, +1 ATK and +1 SCH", () => {
    const card = dataOf(METAL_WINGS) as Record<string, unknown>;
    expect(card.attachesTo).toEqual({ kind: "namedVillain", name: "Death" });
    expect(card.statModifiers).toEqual({ atk: 1, sch: 1 });
  });

  it("attached to Death he has retaliate 1, and a hero's attack on him costs the hero 1 damage", () => {
    const s0 = setupGame();
    const death = villain(s0, DEATH);
    expect(keywordTotal(s0, death, "retaliate", DEPS)).toBe(0);
    const { state } = attachToHost(s0, METAL_WINGS, death);
    expect(keywordTotal(state, death, "retaliate", DEPS)).toBe(1);
    const run = attack(state, DEATH);
    expect(heroDamage(run.state)).toBe(1);
    // The other Horsemen gain nothing.
    expect(keywordTotal(state, villain(state, WAR), "retaliate", DEPS)).toBe(0);
  });
});
