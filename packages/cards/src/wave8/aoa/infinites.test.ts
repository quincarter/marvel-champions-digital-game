import { AOA_CARDS, CORE_CARDS, encounterSetId } from "@mc/content";
import { createGame, hasKeyword, statBonus, type EngineDeps, type GameState, type InstanceId } from "@mc/engine";
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
  mainThreat,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
} from "../../testing/harness.js";
import { driveEvents, driveEventsPicking, playFromHand, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { INFINITES } from "./infinites.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Infinites (45069 Infinite Soldier, 45070 Culling the Weak, 45071 Gene Pool), docs/phase7-wave8.md §3.3, §3.4.
 * Rhino (Core, standard) built by `coreScenario` with the set's eight cards added to the encounter deck by hand (the
 * set is not in the modular pool). Gene Pool, being Permanent and Setup, is in play with 4 threat after setup. Cards
 * are stacked on the encounter deck (the villain's boost card first, then the cards dealt) and revealed by real
 * `endTurn` commands.
 */
const SOLDIER = "45069";
const CULLING = "45070";
const GENE_POOL = "45071";
const SOLDIER_REFS = [
  "45069.infinite-soldier-constant",
  "45069.infinite-soldier-constant-2",
  "45069.infinite-soldier-constant-3",
] as const;
const CULLING_REVEAL = "45070.when-revealed";
const CULLING_BOOST = "45070.boost";
const GENE_POOL_RESPONSE = "45071.gene-pool-forced-response";
/** Core boost card with 1 icon and no boost ability. */
const BOOST_1 = "01188";
/** A player ally from Spider-Man's Justice deck: 3 hit points, 1 consequential damage after an attack. */
const JESSICA_JONES = "01059";
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, INFINITES) };

function setupGame(): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS],
  });
  const SET = AOA_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("infinites")),
  );
  const copies = SET.flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, DEPS);
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
const dataOf = (code: string) =>
  AOA_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;

/** Alter-ego round: Rhino schemes with `boost`, then each card of `reveals` is dealt to player 1. */
function round(state: GameState, opts: { boost?: string; reveals?: readonly string[] } = {}) {
  const stacked = stackEncounterDeck(state, opts.boost ?? BOOST_1, ...(opts.reveals ?? []));
  return driveEvents(DEPS, stacked, endTurn(P1));
}
/** The Soldier a round revealed: in the play area of player 1 or engaged with them. */
const soldierIn = (s: GameState): InstanceId => {
  const ids = Object.keys(s.instances).filter((id) => codeOf(s, id as InstanceId) === SOLDIER) as InstanceId[];
  const found = ids.find((id) => inst(s, id).engagedWith !== undefined && inst(s, id).engagedWith !== null);
  if (!found) throw new Error("no engaged Infinite Soldier");
  return found;
};
const quickstrike = (s: GameState, id: InstanceId) => hasKeyword(s, id, "quickstrike", DEPS);
const surgeKw = (s: GameState, id: InstanceId) => hasKeyword(s, id, "surge", DEPS);
const hpBonus = (s: GameState, id: InstanceId) => statBonus(s, DEPS, id, "hp");

describe("registry", () => {
  it("registers the five refs of the three cards, each a valid definition", () => {
    expect(Object.keys(INFINITES).sort()).toEqual(
      [...SOLDIER_REFS, CULLING_BOOST, CULLING_REVEAL, GENE_POOL_RESPONSE].sort(),
    );
    for (const [id, def] of Object.entries(INFINITES)) expect(validateDefinition(def), id).toEqual([]);
  });

  it("every ability id the card data names is registered", () => {
    for (const code of [SOLDIER, CULLING, GENE_POOL]) {
      const card = dataOf(code) as { abilities?: readonly { id: string }[] };
      for (const a of card.abilities ?? []) expect(Object.keys(INFINITES), a.id).toContain(a.id);
    }
  });
});

describe("Gene Pool (45071)", () => {
  it("is data: a permanent, setup side scheme with 4 threat at any player count", () => {
    const card = dataOf(GENE_POOL);
    expect(card.type).toBe("side_scheme");
    expect(card.startingThreat).toEqual({ base: 4, perPlayer: 0 });
    expect((card.keywords as { name: string }[]).map((k) => k.name).sort()).toEqual(["permanent", "setup"]);
  });

  it("is in play with 4 threat after setup", () => {
    const s = setupGame();
    expect(inVillainArea(s, GENE_POOL)).toHaveLength(1);
    expect(poolThreat(s)).toBe(4);
  });

  it("FORCED RESPONSE: an ally defeated by an enemy attack puts 3 threat on it", () => {
    const g = setupGame();
    const ally = playFromHand(DEPS, g, JESSICA_JONES, 3);
    // Hero form, the ally one damage from defeat; Rhino attacks and the ally defends.
    const s = stackEncounterDeck(patchInstance(withForm(ally.state, { heroForm: 0 }), ally.id, { damage: 2 }), BOOST_1);
    const run = driveEventsPicking(
      DEPS,
      s,
      (x) => {
        const c = x.pendingChoice!;
        if (c.prompt.kind !== "declareDefender") return firstLegal(x);
        return c.options.some((o) => o.optionId === ally.id) ? [ally.id] : ["decline"];
      },
      endTurn(P1),
    );
    expect(playerOf(run.state, P1).discard).toContain(ally.id);
    expect(poolThreat(run.state)).toBe(7);
  });

  it("FORCED RESPONSE: an ally defeated by its own consequential damage adds nothing", () => {
    const g = setupGame();
    const ally = playFromHand(DEPS, g, JESSICA_JONES, 3);
    const s = patchInstance(withForm(ally.state, { heroForm: 0 }), ally.id, { damage: 2 });
    const run = driveEvents(DEPS, s, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: ally.id,
      targetInstanceId: s.activeVillainId!,
    });
    expect(playerOf(run.state, P1).discard).toContain(ally.id);
    expect(poolThreat(run.state)).toBe(4);
  });

  it("FORCED RESPONSE: a villain phase in which no ally is defeated leaves it at 4", () => {
    expect(poolThreat(round(setupGame()).state)).toBe(4);
  });

  it("Permanent: thwarting it to 0 leaves it in play, undefeated", () => {
    const s = withForm(withPool(setupGame(), 1), { heroForm: 0 });
    const run = driveEvents(DEPS, s, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(s, P1),
      schemeInstanceId: genePool(s),
    });
    expect(inVillainArea(run.state, GENE_POOL)).toHaveLength(1);
    expect(poolThreat(run.state)).toBe(0);
    expect(run.events.some((e) => e.type === "schemeDefeated")).toBe(false);
  });
});

describe("Culling the Weak (45070)", () => {
  it("is data: a treachery with the star icon and no boost icon", () => {
    const card = dataOf(CULLING);
    expect(card.type).toBe("treachery");
    expect(card.boostIcons).toBe(0);
    expect(card.starIcon).toBe(true);
  });

  it("WHEN REVEALED: 4 threat on Gene Pool, and it is discarded", () => {
    const run = round(setupGame(), { reveals: [CULLING] });
    expect(poolThreat(run.state)).toBe(8);
    expect(inEncounterDiscard(run.state, CULLING)).toHaveLength(1);
  });

  it("WHEN REVEALED: adds to whatever is already there", () => {
    const run = round(withPool(setupGame(), 0), { reveals: [CULLING] });
    expect(poolThreat(run.state)).toBe(4);
  });

  it("BOOST: as Rhino's boost card it puts 2 threat on Gene Pool (and adds 0 to his scheme)", () => {
    const s = setupGame();
    const base = round(s);
    const run = round(s, { boost: CULLING });
    expect(poolThreat(run.state)).toBe(6);
    expect(mainThreat(run.state)).toBe(mainThreat(base.state) - 1);
    expect(inEncounterDiscard(run.state, CULLING)).toHaveLength(1);
  });
});

describe("Infinite Soldier (45069)", () => {
  it("is data: a Guard minion, ATK 2 SCH 1 HP 3, 1 boost icon", () => {
    const card = dataOf(SOLDIER);
    expect(card).toMatchObject({ type: "minion", atk: 2, sch: 1, hp: 3, boostIcons: 1 });
    expect((card.keywords as { name: string }[]).map((k) => k.name)).toEqual(["guard"]);
  });

  const reveal = (pool: number, extra: readonly string[] = []) => {
    const run = round(withPool(setupGame(), pool), { reveals: [SOLDIER, ...extra] });
    return { ...run, soldier: soldierIn(run.state) };
  };

  it("tier 0: at 2 threat it has no quickstrike, no surge and 3 printed hit points", () => {
    const r = reveal(2, [CULLING]);
    expect(quickstrike(r.state, r.soldier)).toBe(false);
    expect(surgeKw(r.state, r.soldier)).toBe(false);
    expect(hpBonus(r.state, r.soldier)).toBe(0);
    // No surge: the next card stays in the deck.
    expect(inEncounterDeck(r.state, CULLING)).toHaveLength(2);
    expect(poolThreat(r.state)).toBe(2);
  });

  it("tier 1: at 3 threat it gains quickstrike only", () => {
    const r = reveal(3, [CULLING]);
    expect(quickstrike(r.state, r.soldier)).toBe(true);
    expect(surgeKw(r.state, r.soldier)).toBe(false);
    expect(hpBonus(r.state, r.soldier)).toBe(0);
    expect(inEncounterDeck(r.state, CULLING)).toHaveLength(2);
  });

  it("tier 1: at 5 threat it still has no surge", () => {
    const r = reveal(5, [CULLING]);
    expect(quickstrike(r.state, r.soldier)).toBe(true);
    expect(surgeKw(r.state, r.soldier)).toBe(false);
  });

  it("tier 2: at 6 threat it also gains surge, and the surge is read at its reveal (the next card is revealed)", () => {
    const r = reveal(6, [CULLING]);
    expect(quickstrike(r.state, r.soldier)).toBe(true);
    expect(surgeKw(r.state, r.soldier)).toBe(true);
    // Surge revealed Culling the Weak: 6 + 4, which reaches tier 3 (read live) on the same card.
    expect(inEncounterDiscard(r.state, CULLING)).toHaveLength(1);
    expect(poolThreat(r.state)).toBe(10);
    expect(hpBonus(r.state, r.soldier)).toBe(3);
  });

  it("tier 3: at 9 threat it also gets +3 hit points", () => {
    const r = reveal(9);
    expect(quickstrike(r.state, r.soldier)).toBe(true);
    expect(surgeKw(r.state, r.soldier)).toBe(true);
    expect(hpBonus(r.state, r.soldier)).toBe(3);
  });

  it("tier 3: at 8 threat it has no extra hit points", () => {
    const r = reveal(8);
    expect(hpBonus(r.state, r.soldier)).toBe(0);
  });

  it("the tiers are read live: removing threat from Gene Pool turns them off, adding turns them on", () => {
    const r = reveal(9);
    const down = withPool(r.state, 2);
    expect(quickstrike(down, r.soldier)).toBe(false);
    expect(surgeKw(down, r.soldier)).toBe(false);
    expect(hpBonus(down, r.soldier)).toBe(0);
    const up = withPool(down, 6);
    expect(quickstrike(up, r.soldier)).toBe(true);
    expect(surgeKw(up, r.soldier)).toBe(true);
    expect(hpBonus(up, r.soldier)).toBe(0);
  });

  it("the grant is for this minion only: a second Soldier is read the same way, other minions are untouched", () => {
    const run = round(withPool(setupGame(), 3), { reveals: [SOLDIER] });
    const soldier = soldierIn(run.state);
    expect(quickstrike(run.state, soldier)).toBe(true);
    expect(quickstrike(run.state, run.state.activeVillainId!)).toBe(false);
  });

  it("quickstrike granted by its own text is read at its reveal: at 3 threat it attacks a hero-form player at once, at 2 it does not", () => {
    const damageAfter = (pool: number) => {
      const hero = withForm(withPool(setupGame(), pool), { heroForm: 0 });
      const run = driveEvents(DEPS, stackEncounterDeck(hero, BOOST_1, SOLDIER), endTurn(P1));
      return { run, dmg: inst(run.state, identityOf(run.state, P1)).damage };
    };
    const at2 = damageAfter(2);
    const at3 = damageAfter(3);
    // Rhino attacks in both; the Soldier's own ATK 2 comes on top at 3 threat, after it is revealed and engaged.
    expect(at3.dmg - at2.dmg).toBe(2);
  });

  const thwartPool = (state: GameState) =>
    driveEvents(DEPS, withForm(state, { heroForm: 0 }), {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(state, P1),
      schemeInstanceId: genePool(state),
    }).state;

  // RRG "Hit Points" (p. 22): a minion whose "+X hit points" ceases to be in effect and who then has damage equal to or
  // greater than its hit points is defeated. The engine has no sweep for a hit point bonus ending (it only releases a
  // "cannot be defeated" hold, `checkDefeatProtectionEnded`), so this stays red until it does.
  it.fails("with 9 threat and 4 damage it is defeated when a thwart takes Gene Pool to 8 (3 hit points, 4 damage)", () => {
    const r = reveal(9);
    const run = thwartPool(patchInstance(r.state, r.soldier, { damage: 4 }));
    expect(poolThreat(run)).toBe(8);
    expect(inEncounterDiscard(run, SOLDIER)).toHaveLength(1);
  });

  it("today: the same thwart takes Gene Pool to 8 and the bonus ends, but the Soldier stays in play with 4 damage on 3 hit points", () => {
    const r = reveal(9);
    const run = thwartPool(patchInstance(r.state, r.soldier, { damage: 4 }));
    expect(poolThreat(run)).toBe(8);
    expect(hpBonus(run, r.soldier)).toBe(0);
    expect(inEncounterDiscard(run, SOLDIER)).toHaveLength(0);
    expect(inst(run, r.soldier).damage).toBe(4);
  });
});
