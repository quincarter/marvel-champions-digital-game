import { AOA_CARDS, CORE_CARDS, encounterSetId } from "@mc/content";
import {
  createGame,
  cardsInPlay,
  keywordTotal,
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
import { FOUR_HORSEMEN, FOUR_HORSEMEN_SKIPPED, PESTILENCE_FORCED_RESPONSE_DRAFT } from "./four-horsemen.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Four Horsemen scenario's cards (45081a to 45084b the villains, 45085a the main scheme, the `four_horsemen` set
 * 45086 to 45096), docs/phase7-wave8.md §2.3, §3.7 to §3.15. There is no wave 8 scenario builder yet, so the game is
 * Core's Rhino config with the four Horsemen as simultaneous villains (the engine's `villains` option, one shared
 * encounter deck, row order War, Famine, Pestilence, Death) and 45085a as the main scheme. 45085a's setup and 1B are
 * not scripted yet (task 20), so the row is the list order and nothing moves the counter. Cards are stacked on the
 * encounter deck and revealed or drawn as boost cards by real `endTurn` commands.
 */
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, FOUR_HORSEMEN) };

const WAR = "45081a";
const FAMINE = "45082a";
const PESTILENCE = "45083a";
const DEATH = "45084a";
const RAVAGES = "45086";
const TIME_OF_FAMINE = "45087";
const SPECTER = "45089";
const METAL_WINGS = "45091";
const H_WAR = "45092";
const H_FAMINE = "45093";
const H_PESTILENCE = "45094";
const H_DEATH = "45095";
/** A core boost card of 0 icons with no Boost ability. */
const BOOST_0 = "01186";
const AUNT_MAY = "01006";

const VILLAINS = [WAR, FAMINE, PESTILENCE, DEATH];
const SKIPPED_REFS = [
  "45083a.pestilence-forced-response",
  "45083b.pestilence-forced-response",
  "45085a.setup",
  "45085b.the-horsemen-of-apocalypse-forced-response",
  "45088.when-defeated",
  "45090.golden-horse-constant",
  "45090.golden-horse-response",
  "45091.when-revealed",
  "45091.metal-wings-response",
  "45096.when-revealed",
];

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
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const villain = (s: GameState, code: string): InstanceId => {
  const found = s.villains.find((v) => codeOf(s, v.instanceId) === code);
  if (!found) throw new Error(`no ${code} in play`);
  return found.instanceId;
};
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
  it("registers every ref the card data names, except the ten skipped ones, each a valid definition", () => {
    expect(Object.keys(FOUR_HORSEMEN).sort()).toEqual(ALL_REFS.filter((r) => !SKIPPED_REFS.includes(r)).sort());
    for (const [id, def] of Object.entries(FOUR_HORSEMEN)) expect(validateDefinition(def), id).toEqual([]);
    expect(Object.keys(FOUR_HORSEMEN_SKIPPED).sort()).toEqual([...SKIPPED_REFS].sort());
    expect(validateDefinition(PESTILENCE_FORCED_RESPONSE_DRAFT)).toEqual([]);
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

describe("Pestilence (45083a/b): Forced Response not registered, waits on task 23", () => {
  const pestilence = () => {
    const s = setupGame();
    return round(withActive(s, villain(s, PESTILENCE)));
  };

  it("today: Pestilence attacks and the identity's text box is not blanked (the ref is skipped)", () => {
    const run = pestilence();
    expect(attacksBy(run.events, run.state, PESTILENCE)).toHaveLength(1);
    expect(textBoxBlank(run.state, identityOf(run.state, P1))).toBe(false);
  });

  it.fails("proof of the gap: after Pestilence attacks, the identity's text box is still blank in the next player phase", () => {
    const run = pestilence();
    expect(run.state.step.phase).toBe("player");
    expect(textBoxBlank(run.state, identityOf(run.state, P1))).toBe(true);
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

describe("the 1B Forced Response and the active counter (task 20): not registered", () => {
  it("today: nothing moves the counter after a villain activates (45085b's ref is skipped)", () => {
    const run = round(setupGame());
    expect(activeCode(run.state)).toBe(WAR);
  });

  it.fails("proof of the gap, Q5: Famine holds the counter; her activation moves it to Pestilence, and Death activating by the Horseman moves it on from Pestilence (the holder) to Death", () => {
    const base = setupGame();
    const s = withActive(base, villain(base, FAMINE));
    const run = round(s, { boosts: [BOOST_0], reveals: [H_DEATH] });
    expect(attacksBy(run.events, run.state, DEATH)).toHaveLength(1);
    // Famine's own activation moves it Famine -> Pestilence, Death's (from the treachery) Pestilence -> Death. Both
    // are "one position from the villain holding it" (Q5 = A), so Death's activation never moves it from Death.
    expect(activeCode(run.state)).toBe(DEATH);
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

  it("Plague and Pestilence (45088): When Defeated not registered, waits on task 23", () => {
    expect(Object.keys(FOUR_HORSEMEN)).not.toContain("45088.when-defeated");
    expect(FOUR_HORSEMEN_SKIPPED["45088.when-defeated"]).toContain("task 23");
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
