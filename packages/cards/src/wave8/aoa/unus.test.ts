import { AOA_CARDS, CORE_CARDS, encounterSetId } from "@mc/content";
import {
  createGame,
  hasKeyword,
  keywordTotal,
  statBonus,
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
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
} from "../../testing/harness.js";
import { driveEventsPicking, playFromHand, withForm } from "../../testing/staging.js";
import { attachToHost } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { INFINITES } from "./infinites.js";
import { UNUS, UNUS_SKIPPED } from "./unus.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Unus scenario's cards (45059 to 45061 Unus, 45062a Hunting Gene Traitors, and the `unus` set 45063 to 45068),
 * docs/phase7-wave8.md §2.2, §3.2 to §3.5, §3.12, §3.14. There is no wave 8 scenario builder yet, so the game is
 * Core's Rhino config with the villain, main scheme and stage range of the Unus record swapped in and the `unus` and
 * `infinites` sets added to the encounter deck by hand. Gene Pool is in play with 4 threat after setup (its own setup
 * keyword). Cards are stacked on the encounter deck and revealed by real `endTurn` commands.
 */
const STAGE_I = 0;
const STAGE_II = 1;
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, INFINITES, UNUS) };

const UNUS_REFS = [
  "45059.unus-constant",
  "45059.unus-constant-2",
  "45059.unus-constant-3",
  "45060.unus-constant",
  "45060.unus-constant-2",
  "45060.unus-constant-3",
  "45061.unus-constant",
  "45061.unus-constant-2",
  "45061.unus-constant-3",
];
const SET_REFS = [
  "45062a.setup",
  "45062b.hunting-gene-traitors-forced-response",
  "45063.prelate-sidearm-forced-response",
  "45063.prelate-sidearm-response",
  "45064.prelate-armor-forced-response",
  "45064.prelate-armor-response",
  "45065.when-revealed",
  "45065.boost",
  "45066.genetic-experiments-constant",
  "45066.genetic-experiments-constant-2",
  "45066.genetic-experiments-forced-interrupt",
  "45066.boost",
  "45067.when-revealed",
  "45068.when-defeated",
];

const SIDEARM = "45063";
const ARMOR = "45064";
const HUNTER = "45065";
const EXPERIMENTS = "45066";
const PRELATE = "45067";
const RANKS = "45068";
const SOLDIER = "45069";
const GENE_POOL = "45071";
/** Core boost cards of 1 icon and of 0 icons, none with a Boost ability. */
const BOOST_1 = "01188";
const BOOST_1B = "01189";
const BOOST_0 = "01186";
/** A player ally from Spider-Man's Justice deck: 3 hit points. */
const JESSICA_JONES = "01059";

interface Opts {
  readonly expert?: boolean;
  readonly stage?: number;
}

function setupGame(opts: Opts = {}): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: opts.expert ? "expert" : "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS],
  });
  const sets = [encounterSetId("unus"), encounterSetId("infinites")];
  const copies = AOA_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.some((id) => sets.includes(id)),
  ).flatMap((c) => Array.from({ length: (c as { quantityInSet: number }).quantityInSet }, () => c.id));
  const stage = opts.stage ?? (opts.expert ? STAGE_II : STAGE_I);
  const created = createGame(
    {
      ...config,
      villainCardId: "45059" as typeof config.villainCardId,
      villainSide: "A",
      villainStartStageIndex: stage,
      villainLastStageIndex: 2,
      mainSchemeCardId: "45062a" as typeof config.mainSchemeCardId,
      encounterDeck: [...config.encounterDeck, ...copies],
    },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const piles = (s: GameState) => Object.values(s.encounterDecks)[0]!;
const inEncounterDiscard = (s: GameState, code: string) => piles(s).discard.filter((id) => codeOf(s, id) === code);
const inEncounterDeck = (s: GameState, code: string) => piles(s).deck.filter((id) => codeOf(s, id) === code);
const inVillainArea = (s: GameState, code: string) => s.villainArea.filter((id) => codeOf(s, id) === code);
const genePool = (s: GameState): InstanceId => inVillainArea(s, GENE_POOL)[0]!;
const poolThreat = (s: GameState) => inst(s, genePool(s)).threat;
const withPool = (s: GameState, threat: number) => patchInstance(s, genePool(s), { threat });
const unus = (s: GameState): InstanceId => s.activeVillainId!;
const dataOf = (code: string) =>
  AOA_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
const events = <T extends GameEvent["type"]>(run: readonly GameEvent[], type: T) =>
  run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const withTough = (s: GameState, tough: number) =>
  patchInstance(s, unus(s), { statuses: { stunned: 0, confused: 0, tough } });
const nameOf = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.name;

interface Plan {
  /** Option label (start) to take at a `chooseOption` prompt; the first otherwise. */
  readonly choose?: string;
  /** Labels (start) of the optional abilities to trigger. */
  readonly accept?: readonly string[];
  /** Hand cards (by name) to spend. */
  readonly pay?: readonly string[];
  /** Instance ids to declare as defender when offered; nobody otherwise. */
  readonly defend?: InstanceId;
}

function drive(state: GameState, plan: Plan, ...commands: Command[]) {
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    switch (choice.prompt.kind) {
      case "chooseOption": {
        const hit = choice.options.find((o) => (plan.choose ? o.label.startsWith(plan.choose) : true));
        return [(hit ?? choice.options[0]!).optionId];
      }
      case "chooseTriggers":
        return choice.options.filter((o) => plan.accept?.some((l) => o.label.startsWith(l))).map((o) => o.optionId);
      case "payForAbility":
      case "spendResources": {
        const ids: string[] = [];
        for (const name of plan.pay ?? []) {
          const hit = choice.options.find((o) => o.label === name && !ids.includes(o.optionId));
          if (hit) ids.push(hit.optionId);
        }
        return ids.length > 0 ? ids : firstLegal(s);
      }
      case "declareDefender":
        return plan.defend && choice.options.some((o) => o.optionId === plan.defend) ? [plan.defend] : ["decline"];
      default:
        return firstLegal(s);
    }
  };
  return driveEventsPicking(DEPS, state, pick, ...commands);
}

interface RoundOpts {
  readonly boosts?: readonly string[];
  readonly reveals?: readonly string[];
  /** The player is in hero form (Unus attacks) rather than alter-ego form (he schemes). */
  readonly hero?: boolean | undefined;
  readonly plan?: Plan;
}
/** One end of turn: Unus activates with `boosts` (one per activation), then the player is dealt each of `reveals`. */
function round(state: GameState, opts: RoundOpts = {}) {
  // The standard set has two copies each of two blank boost cards: a repeated BOOST_0 takes the next unused one.
  const blanks = ["01186", "01186", "01187", "01187"];
  const code = (c: string) => (c === BOOST_0 ? blanks.shift()! : c);
  const stacked = stackEncounterDeck(state, ...(opts.boosts ?? [BOOST_1]).map(code), ...(opts.reveals ?? []).map(code));
  const form = opts.hero ? withForm(stacked, { heroForm: 0 }) : withForm(stacked, "alterEgo");
  return drive(form, opts.plan ?? {}, endTurn(P1));
}
const heroDamage = (s: GameState) => inst(s, identityOf(s, P1)).damage;
const retaliate = (s: GameState) => keywordTotal(s, unus(s), "retaliate", DEPS);

describe("registry", () => {
  it("registers every ref of the eight cards (the three Unus stages, 45062a/b and the set), each a valid definition", () => {
    expect(Object.keys(UNUS).sort()).toEqual([...UNUS_REFS, ...SET_REFS].sort());
    for (const [id, def] of Object.entries(UNUS)) expect(validateDefinition(def), id).toEqual([]);
    expect(UNUS_SKIPPED).toEqual({});
  });

  it("every ability id the card data names is registered", () => {
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
    for (const code of ["45059", "45062a", SIDEARM, ARMOR, HUNTER, EXPERIMENTS, PRELATE, RANKS]) {
      expect(ids(code).length, code).toBeGreaterThan(0);
      for (const id of ids(code)) expect(Object.keys(UNUS), id).toContain(id);
    }
  });
});

describe("Unus (45059 to 45061)", () => {
  it("is data: Toughness, Prelate, 12/15/18 hit points per player, ATK 2/2/3, SCH 1/2/2", () => {
    const card = dataOf("45059") as { sides: { stages: Record<string, unknown>[] }[] };
    const stages = card.sides[0]!.stages;
    expect(stages.map((s) => (s.hp as { perPlayer: number }).perPlayer)).toEqual([12, 15, 18]);
    expect(stages.map((s) => s.atk)).toEqual([2, 2, 3]);
    expect(stages.map((s) => s.sch)).toEqual([1, 2, 2]);
    for (const s of stages) expect((s.keywords as { name: string }[]).map((k) => k.name)).toEqual(["toughness"]);
  });

  it("starts with a tough status card and Gene Pool at 4: retaliate 1 from the first turn, no stalwart", () => {
    const s = setupGame();
    expect(inst(s, unus(s)).statuses.tough).toBe(1);
    expect(poolThreat(s)).toBe(4);
    expect(retaliate(s)).toBe(1);
    expect(hasKeyword(s, unus(s), "stalwart", DEPS)).toBe(false);
  });

  it("tier 1: at 2 threat no retaliate, at 3 retaliate 1; read live as threat comes and goes", () => {
    const s = setupGame();
    expect(retaliate(withPool(s, 2))).toBe(0);
    expect(retaliate(withPool(s, 3))).toBe(1);
    expect(retaliate(withPool(withPool(s, 3), 2))).toBe(0);
  });

  it("tier 1 in play: a hero's basic attack at 3 threat costs the hero 1 damage (retaliate), at 2 nothing", () => {
    const attack = (pool: number) => {
      const s = withForm(withPool(setupGame(), pool), { heroForm: 0 });
      const run = drive(
        s,
        {},
        {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: identityOf(s, P1),
          targetInstanceId: unus(s),
        },
      );
      return heroDamage(run.state);
    };
    expect(attack(2)).toBe(0);
    expect(attack(3)).toBe(1);
  });

  it("tier 2: stalwart at 6, not at 5; both stages' tiers are cumulative (retaliate stays)", () => {
    const s = setupGame();
    expect(hasKeyword(withPool(s, 5), unus(s), "stalwart", DEPS)).toBe(false);
    const at6 = withPool(s, 6);
    expect(hasKeyword(at6, unus(s), "stalwart", DEPS)).toBe(true);
    expect(retaliate(at6)).toBe(1);
  });

  it("every stage carries the same tiers: Unus II and III read Gene Pool too", () => {
    for (const stage of [STAGE_II, 2]) {
      const s = withPool(setupGame({ stage }), 6);
      expect(retaliate(s)).toBe(1);
      expect(hasKeyword(s, unus(s), "stalwart", DEPS)).toBe(true);
    }
  });

  // `pool` is Gene Pool before the villain phase: step one adds 1 before Unus attacks.
  const attackOf = (pool: number, boost: string) => {
    const run = round(withPool(setupGame(), pool), { hero: true, boosts: [boost] });
    return events(run.events, "attackResolved").find((e) => e.enemyInstanceId === unus(run.state))!;
  };

  it("tier 3: at 9 threat a boost card of 1 icon makes his attack 4 (ATK 2, 1 printed, 1 amplify)", () => {
    const at9 = attackOf(8, BOOST_1);
    expect(at9.baseAtk + at9.boostIcons).toBe(4);
    const at8 = attackOf(7, BOOST_1);
    expect(at8.baseAtk + at8.boostIcons).toBe(3);
  });

  it("tier 3: a boost card with no icons still gains one at 9 (attack 3), and none at 8 (attack 2)", () => {
    const at9 = attackOf(8, BOOST_0);
    expect(at9.baseAtk + at9.boostIcons).toBe(3);
    const at8 = attackOf(7, BOOST_0);
    expect(at8.baseAtk + at8.boostIcons).toBe(2);
  });
});

describe("Hunting Gene Traitors (45062a/b)", () => {
  it("is data: no starting threat, 11 per player, +1 per player acceleration, losing the game when completed", () => {
    const card = dataOf("45062a") as { stages: Record<string, unknown>[] };
    expect(card.stages[0]).toMatchObject({
      targetThreat: { base: 0, perPlayer: 11 },
      acceleration: { base: 0, perPlayer: 1 },
      completionLoses: true,
    });
  });

  it("SETUP: Gene Pool is in play with 4 threat in standard mode, and no card is dealt", () => {
    const s = setupGame();
    expect(inVillainArea(s, GENE_POOL)).toHaveLength(1);
    expect(poolThreat(s)).toBe(4);
    expect(playerOf(s, P1).dealtEncounter).toHaveLength(0);
  });

  it("SETUP: in expert mode each player is dealt a facedown encounter card, and Gene Pool still has 4", () => {
    const s = setupGame({ expert: true });
    expect(poolThreat(s)).toBe(4);
    expect(playerOf(s, P1).dealtEncounter).toHaveLength(1);
  });

  it("FORCED RESPONSE: after step one of the villain phase, 1 threat goes on Gene Pool (once per villain phase)", () => {
    const run = round(setupGame());
    expect(poolThreat(run.state)).toBe(5);
  });
});

describe("Prelate Sidearm (45063)", () => {
  it("is data: a Weapon attached to Unus, +1 ATK, 3 boost icons", () => {
    expect(dataOf(SIDEARM)).toMatchObject({ attachesTo: { kind: "namedVillain", name: "Unus" }, boostIcons: 3 });
  });

  it("attaches to Unus when revealed and adds 1 to his ATK", () => {
    const s = setupGame();
    const control = events(round(s, { hero: true, boosts: [BOOST_0] }).events, "attackResolved")[0]!;
    const run = round(s, { hero: true, boosts: [BOOST_0], reveals: [SIDEARM] });
    expect(inst(run.state, unus(run.state)).attachments.map((i) => codeOf(run.state, i))).toEqual([SIDEARM]);
    const armed = attachToHost(s, SIDEARM, unus(s)).state;
    const attack = events(round(armed, { hero: true, boosts: [BOOST_0] }).events, "attackResolved")[0]!;
    expect(attack.baseAtk).toBe(control.baseAtk + 1);
  });

  const withAlly = (pool: number) => {
    const g = withForm(withPool(attachToHost(setupGame(), SIDEARM, unus(setupGame())).state, pool), { heroForm: 0 });
    const ally = playFromHand(DEPS, g, JESSICA_JONES, 3);
    return { ally, state: patchInstance(ally.state, ally.id, { damage: 2 }) };
  };

  it("FORCED RESPONSE: after Unus attacks and defeats an ally, 1 threat goes on Gene Pool", () => {
    const { ally, state } = withAlly(4);
    const run = round(state, { hero: true, boosts: [BOOST_1], plan: { defend: ally.id } });
    expect(playerOf(run.state, P1).discard).toContain(ally.id);
    // 4, step one's 1, the Sidearm's 1 and Gene Pool's own 3 for an ally defeated by an attack.
    expect(poolThreat(run.state)).toBe(4 + 1 + 1 + 3);
  });

  it("FORCED RESPONSE: an attack that defeats nobody adds only the villain phase's 1", () => {
    const { state } = withAlly(4);
    const run = round(state, { hero: true, boosts: [BOOST_1] });
    expect(poolThreat(run.state)).toBe(5);
  });
});

/** The hand cards of Spider-Man's deck that pay one given resource each (no wild), moved to the hand by surgery. */
function resourceCards(state: GameState, kinds: readonly ("energy" | "physical" | "mental")[]) {
  const owner = playerOf(state, P1);
  const codes: string[] = [];
  const used: InstanceId[] = [];
  for (const kind of kinds) {
    const hit = [...owner.hand, ...owner.deck].find((id) => {
      const icons = (state.cardPool[state.instances[id]!.cardId] as { resourceIcons?: Record<string, number> })
        .resourceIcons;
      return (
        !used.includes(id) &&
        (icons?.[kind] ?? 0) === 1 &&
        (icons?.wild ?? 0) === 0 &&
        Object.values(icons ?? {}).reduce((a, b) => a + b, 0) === 1
      );
    });
    if (!hit) throw new Error(`no single ${kind} card`);
    used.push(hit);
    codes.push(codeOf(state, hit));
  }
  const hand = {
    ...state,
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [], deck: [...p.hand, ...p.deck] } : p)),
  };
  return { state: moveToHand(hand, P1, ...codes).state, names: used.map((id) => nameOf(state, id)) };
}

describe.each([
  { code: SIDEARM, title: "Prelate Sidearm", kinds: ["energy", "physical"] as const },
  { code: ARMOR, title: "Prelate Armor", kinds: ["mental", "physical"] as const },
])("$title hero response", ({ code, title, kinds }) => {
  const attackUnus = (state: GameState, plan: Plan, target?: InstanceId) =>
    drive(patchInstance(withForm(state, { heroForm: 0 }), identityOf(state, P1), { exhausted: false }), plan, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(state, P1),
      targetInstanceId: target ?? unus(state),
    });
  const armed = () => attachToHost(setupGame(), code, unus(setupGame())).state;

  it("after a basic attack against Unus, spending the two resource types discards it", () => {
    const { state, names } = resourceCards(armed(), kinds);
    const run = attackUnus(state, { accept: [title], pay: names });
    expect(inst(run.state, unus(run.state)).attachments).toEqual([]);
    expect(inEncounterDiscard(run.state, code)).toHaveLength(1);
  });

  it("it is optional: declining leaves it attached", () => {
    const { state } = resourceCards(armed(), kinds);
    const run = attackUnus(state, {});
    expect(inst(run.state, unus(run.state)).attachments.map((i) => codeOf(run.state, i))).toEqual([code]);
  });

  it("two resources of the wrong types do not pay it", () => {
    const { state, names } = resourceCards(
      armed(),
      kinds[0] === "energy" ? ["mental", "mental"] : ["energy", "energy"],
    );
    const run = attackUnus(state, { accept: [title], pay: names });
    expect(inst(run.state, unus(run.state)).attachments.map((i) => codeOf(run.state, i))).toEqual([code]);
  });

  it("an attack against another enemy does not offer it", () => {
    const base = setupGame();
    const hunter = round(base, { boosts: [BOOST_0], reveals: [SOLDIER] }).state;
    const minion = Object.keys(hunter.instances).find(
      (id) => codeOf(hunter, id as InstanceId) === SOLDIER && inst(hunter, id as InstanceId).engagedWith,
    ) as InstanceId;
    const { state, names } = resourceCards(attachToHost(hunter, code, unus(hunter)).state, kinds);
    const run = attackUnus(state, { accept: [title], pay: names }, minion);
    expect(inst(run.state, unus(run.state)).attachments.map((i) => codeOf(run.state, i))).toEqual([code]);
  });
});

describe("Prelate Armor (45064)", () => {
  it("is data: Armor attached to Unus, +1 SCH, 3 boost icons", () => {
    expect(dataOf(ARMOR)).toMatchObject({ attachesTo: { kind: "namedVillain", name: "Unus" }, boostIcons: 3 });
  });

  it("FORCED RESPONSE: after Unus schemes, he gets a tough status card (a character holds one at most, so he starts with none)", () => {
    const g = withTough(attachToHost(setupGame(), ARMOR, unus(setupGame())).state, 0);
    const run = round(g, { boosts: [BOOST_0] });
    expect(events(run.events, "schemeResolved").some((e) => e.enemyInstanceId === unus(run.state))).toBe(true);
    expect(inst(run.state, unus(run.state)).statuses.tough).toBe(1);
  });

  it("FORCED RESPONSE: after he attacks (hero form) it gives nothing: the tough cards match a game without it", () => {
    const toughAfter = (armor: boolean) => {
      const base = setupGame();
      const g = withTough(armor ? attachToHost(base, ARMOR, unus(base)).state : base, 0);
      const run = round(g, { hero: true, boosts: [BOOST_0] });
      return inst(run.state, unus(run.state)).statuses.tough;
    };
    expect(toughAfter(true)).toBe(toughAfter(false));
  });

  it("adds 1 to his SCH", () => {
    const s = setupGame();
    const sch = (state: GameState) => events(round(state, { boosts: [BOOST_0] }).events, "schemeResolved")[0]!.baseSch;
    expect(sch(attachToHost(s, ARMOR, unus(s)).state)).toBe(sch(s) + 1);
  });
});

describe("Infinite Hunter (45065)", () => {
  it("is data: an Infinite minion, ATK 3, SCH 2, 4 hit points, the star icon and no boost icon", () => {
    expect(dataOf(HUNTER)).toMatchObject({ type: "minion", atk: 3, sch: 2, hp: 4, boostIcons: 0, starIcon: true });
  });

  it("WHEN REVEALED: deals 3 damage to an ally the player controls", () => {
    const g = withForm(setupGame(), "alterEgo");
    const ally = playFromHand(DEPS, g, JESSICA_JONES, 3);
    const run = round(ally.state, { boosts: [BOOST_0], reveals: [HUNTER] });
    expect(playerOf(run.state, P1).discard).toContain(ally.id);
  });

  it("WHEN REVEALED: with no ally it deals no damage and still enters play", () => {
    const run = round(setupGame(), { boosts: [BOOST_0], reveals: [HUNTER] });
    expect(heroDamage(run.state)).toBe(0);
    expect(
      Object.keys(run.state.instances).some(
        (id) => codeOf(run.state, id as InstanceId) === HUNTER && inst(run.state, id as InstanceId).engagedWith,
      ),
    ).toBe(true);
  });

  const hunterBoost = (choose: string) => {
    const run = round(setupGame(), { hero: true, boosts: [HUNTER], plan: { choose } });
    return {
      run,
      attack: events(run.events, "attackResolved").find((e) => e.enemyInstanceId === unus(run.state))!,
    };
  };

  it("BOOST, option 2: the activating enemy gets +2 ATK, so Unus I attacks for 4", () => {
    const { attack, run } = hunterBoost("Activating");
    expect(attack.baseAtk + attack.boostIcons).toBe(4);
    expect(poolThreat(run.state)).toBe(5);
  });

  it("BOOST, option 1: 2 threat on Gene Pool, and Unus I attacks for 2", () => {
    const { attack, run } = hunterBoost("Place 2");
    expect(attack.baseAtk + attack.boostIcons).toBe(2);
    expect(poolThreat(run.state)).toBe(4 + 2 + 1);
  });

  it("BOOST, option 2: +2 SCH on a scheme activation", () => {
    const run = round(setupGame(), { boosts: [HUNTER], plan: { choose: "Activating" } });
    const scheme = events(run.events, "schemeResolved").find((e) => e.enemyInstanceId === unus(run.state))!;
    expect(scheme.baseSch).toBe(3);
  });
});

describe("Genetic Experiments (45066)", () => {
  it("is data: a Condition attached to an Infinite minion, +1 SCH +1 ATK, the star icon", () => {
    expect(dataOf(EXPERIMENTS)).toMatchObject({
      attachesTo: { kind: "qualified", category: "minion" },
      statModifiers: { atk: 1, sch: 1 },
      starIcon: true,
    });
  });

  /** A round that engages an Infinite Soldier with the player; the Soldier's id. */
  const withSoldier = () => {
    const run = round(setupGame(), { boosts: [BOOST_0], reveals: [SOLDIER] });
    const id = Object.keys(run.state.instances).find(
      (i) => codeOf(run.state, i as InstanceId) === SOLDIER && inst(run.state, i as InstanceId).engagedWith,
    ) as InstanceId;
    return { state: run.state, id };
  };

  it("attaches to an Infinite minion, which gets +2 hit points", () => {
    const { state, id } = withSoldier();
    const run = round(state, { boosts: [BOOST_0, BOOST_0], reveals: [EXPERIMENTS] });
    const host = inst(run.state, id);
    expect(host.attachments.map((a) => codeOf(run.state, a))).toEqual([EXPERIMENTS]);
    expect(statBonus(run.state, DEPS, id, "hp")).toBe(2);
  });

  it("with no Infinite minion in play it gains surge: the next card is revealed too", () => {
    const run = round(setupGame(), { boosts: [BOOST_0], reveals: [EXPERIMENTS, PRELATE] });
    expect(inEncounterDiscard(run.state, EXPERIMENTS)).toHaveLength(1);
    expect(inEncounterDeck(run.state, PRELATE)).toHaveLength(1 + 1 - 1);
  });

  it("FORCED INTERRUPT: when the attached minion is defeated, 2 threat goes on Gene Pool", () => {
    const { state, id } = withSoldier();
    const attached = attachToHost(state, EXPERIMENTS, id).state;
    const before = poolThreat(attached);
    const dying = withForm(patchInstance(attached, id, { damage: 4 }), { heroForm: 0 });
    const run = drive(
      dying,
      {},
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(dying, P1),
        targetInstanceId: id,
      },
    );
    expect(inEncounterDiscard(run.state, SOLDIER)).toHaveLength(1);
    expect(poolThreat(run.state) - before).toBe(2);
  });

  it("BOOST: with an Infinite minion in play it attaches to it", () => {
    const { state, id } = withSoldier();
    const run = round(state, { boosts: [EXPERIMENTS] });
    expect(inst(run.state, id).attachments.map((a) => codeOf(run.state, a))).toContain(EXPERIMENTS);
  });

  it("BOOST: with no Infinite minion in play it attaches to nothing and is discarded", () => {
    const run = round(setupGame(), { boosts: [EXPERIMENTS] });
    expect(inEncounterDiscard(run.state, EXPERIMENTS)).toHaveLength(1);
  });
});

describe("Infinite Prelate (45067)", () => {
  it("is data: a treachery with 2 boost icons", () => {
    expect(dataOf(PRELATE)).toMatchObject({ type: "treachery", boostIcons: 2 });
  });

  /**
   * `pool` is Gene Pool's threat before the villain phase: step one adds 1, then Unus activates with his own boost
   * card, then the Prelate is revealed and Unus activates again with the cards stacked behind it (`after`).
   */
  const reveal = (
    pool: number,
    opts: {
      readonly after?: readonly string[];
      readonly damage?: number;
      readonly hero?: boolean;
      readonly own?: string;
    } = {},
  ) => {
    // A character holds at most one tough card (RRG "Status Cards"): start with none so the give is visible.
    const g = patchInstance(withPool(setupGame(), pool), unus(setupGame()), {
      damage: opts.damage ?? 0,
      statuses: { stunned: 0, confused: 0, tough: 0 },
    });
    return round(g, {
      boosts: [opts.own ?? BOOST_0],
      reveals: [PRELATE, ...(opts.after ?? [BOOST_0])],
      hero: opts.hero,
    });
  };
  const activations = (run: ReturnType<typeof reveal>) =>
    events(run.events, "schemeResolved").filter((e) => e.enemyInstanceId === unus(run.state)).length +
    events(run.events, "attackResolved").filter((e) => e.enemyInstanceId === unus(run.state)).length;

  it("at 2 threat: Unus activates and nothing else (no tough card, no heal)", () => {
    const run = reveal(1, { damage: 5 });
    // The villain phase's own activation and the Prelate's.
    expect(activations(run)).toBe(2);
    expect(inst(run.state, unus(run.state)).statuses.tough).toBe(0);
    expect(inst(run.state, unus(run.state)).damage).toBe(5);
  });

  it("at 3 threat: he is given a tough status card", () => {
    const run = reveal(2, { damage: 5 });
    expect(poolThreat(run.state)).toBe(3);
    expect(inst(run.state, unus(run.state)).statuses.tough).toBe(1);
    expect(inst(run.state, unus(run.state)).damage).toBe(5);
  });

  it("at 6 threat: tough card and 3 damage healed", () => {
    const run = reveal(5, { damage: 5 });
    expect(poolThreat(run.state)).toBe(6);
    expect(inst(run.state, unus(run.state)).statuses.tough).toBe(1);
    expect(inst(run.state, unus(run.state)).damage).toBe(2);
  });

  it("at 9 threat: the activation is dealt an additional boost card, and tough and heal follow", () => {
    // Hero form: the villain phase's own attack draws a blank, the Prelate's attack draws two cards of 1 icon each.
    const run = reveal(8, { damage: 5, hero: true, after: [BOOST_1, BOOST_1B] });
    expect(poolThreat(run.state)).toBe(9);
    const attacks = events(run.events, "attackResolved").filter((e) => e.enemyInstanceId === unus(run.state));
    expect(attacks).toHaveLength(2);
    // One amplify icon per boost card turned faceup: 0 printed + 1; then 1 + 1 printed and 2 amplify.
    expect(attacks[0]!.boostIcons).toBe(1);
    expect(attacks[1]!.boostIcons).toBe(4);
    expect(inst(run.state, unus(run.state)).statuses.tough).toBe(1);
    expect(inst(run.state, unus(run.state)).damage).toBe(2);
  });

  it("below 9 threat no additional boost card is dealt (one card of 1 icon: 1 boost icon)", () => {
    const run = reveal(6, { hero: true, after: [BOOST_1B, BOOST_1] });
    const attacks = events(run.events, "attackResolved").filter((e) => e.enemyInstanceId === unus(run.state));
    expect(attacks[1]!.boostIcons).toBe(1);
    expect(inEncounterDeck(run.state, BOOST_1).length + inEncounterDeck(run.state, BOOST_1B).length).toBe(1);
  });
});

describe("Endless Ranks (45068)", () => {
  it("is data: a side scheme with 4 threat and an acceleration icon", () => {
    expect(dataOf(RANKS)).toMatchObject({
      type: "side_scheme",
      startingThreat: { base: 4, perPlayer: 0 },
      icons: ["acceleration"],
    });
  });

  it("WHEN DEFEATED: 3 threat goes on Gene Pool", () => {
    const revealed = round(setupGame(), { boosts: [BOOST_0], reveals: [RANKS] }).state;
    const ranks = inVillainArea(revealed, RANKS)[0]!;
    const near = withForm(patchInstance(revealed, ranks, { threat: 1 }), { heroForm: 0 });
    const before = poolThreat(near);
    const run = drive(
      near,
      {},
      {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(near, P1),
        schemeInstanceId: ranks,
      },
    );
    expect(inVillainArea(run.state, RANKS)).toHaveLength(0);
    expect(poolThreat(run.state) - before).toBe(3);
  });

  it("is not defeated while it has threat: thwarting it by 1 leaves Gene Pool alone", () => {
    const revealed = round(setupGame(), { boosts: [BOOST_0], reveals: [RANKS] }).state;
    const ranks = inVillainArea(revealed, RANKS)[0]!;
    const before = poolThreat(revealed);
    const hero = withForm(revealed, { heroForm: 0 });
    const run = drive(
      hero,
      {},
      {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(hero, P1),
        schemeInstanceId: ranks,
      },
    );
    expect(inVillainArea(run.state, RANKS)).toHaveLength(1);
    expect(poolThreat(run.state)).toBe(before);
  });
});
