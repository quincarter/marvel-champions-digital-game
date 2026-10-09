import { AOA_CARDS, CORE_CARDS, encounterSetId } from "@mc/content";
import {
  createGame,
  keywordTotal,
  mainSchemeValue,
  maxHitPoints,
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
  defeatWithAttack,
  encounterCardInVillainArea,
  playFromHand,
  withActive,
  withForm,
} from "../../testing/staging.js";
import { attachToHost } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { APOCALYPSE } from "./apocalypse.js";
import { FOUR_HORSEMEN } from "./four-horsemen.js";
import { INFINITES } from "./infinites.js";
import { PRELATES } from "./prelates.js";
import { UNUS } from "./unus.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Full QA audit, scenarios 1 (Unus, The Four Horsemen, Apocalypse): card-by-card pass over the villain, main scheme and
 * scenario-set cards, written for what the existing per-module tests do not cover. The existing tests are almost all
 * one-player games; this file's focus is two players ("you" = the player the activation is against or who revealed,
 * "each other player", per-player values) and stat icons that only had a data check.
 *
 * Sources: the printed text in `packages/content/src/data/aoa/cards.ts`, checked against the raw MarvelCDB rows for the
 * stats; RRG 1.8 "Per Player Icon" p. 32, "Defend, Defense" (boost abilities that say "you" refer to the defending
 * player) and "Attack" (the attacked player).
 */
const BLANK_A = "01186";
const BLANK_B = "01187";
const BLANK_A2 = "01186";
const BLANK_B2 = "01187";

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const events = <T extends GameEvent["type"]>(run: readonly GameEvent[], type: T) =>
  run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const allIds = (s: GameState) => Object.keys(s.instances) as InstanceId[];
const byCode = (s: GameState, code: string) => allIds(s).filter((id) => codeOf(s, id) === code);
const inVillainArea = (s: GameState, code: string) => s.villainArea.filter((id) => codeOf(s, id) === code);
const hero = (s: GameState, player = P1) => withForm(s, { heroForm: 0 }, player);
const alterEgo = (s: GameState, player = P1) => withForm(s, "alterEgo", player);
const damageOnIdentity = (s: GameState, player = P1) => inst(s, identityOf(s, player)).damage;
const inPlayControlled = (s: GameState, player: typeof P1, code: string) =>
  playerOf(s, player).playArea.filter((id) => codeOf(s, id) === code);

/** Player 2 acts out of turn by surgery for staging only: the step is restored afterwards. */
function asPlayer(s: GameState, player: typeof P1, fn: (staged: GameState) => GameState): GameState {
  const original = s.step;
  const staged = fn({ ...s, step: { ...(original as object), activePlayerId: player } as typeof original });
  return { ...staged, step: original };
}

const TWO_PLAYERS = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }];
const JESSICA_JONES = "01059"; // P1's Justice ally, 3 hit points, cost 4
const TIGRA = "01051"; // P2's Aggression ally, 3 hit points, cost 3
const AUNT_MAY = "01006";

// ---------------------------------------------------------------------------------------------------------------
// Unus
// ---------------------------------------------------------------------------------------------------------------

const U_DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, INFINITES, UNUS) };
const SIDEARM = "45063";
const HUNTER = "45065";
const EXPERIMENTS = "45066";
const INF_PRELATE = "45067";
const RANKS = "45068";
const SOLDIER = "45069";
const GENE_POOL = "45071";

function unusGame(opts: { stage?: number; expert?: boolean } = {}): GameState {
  const config = coreScenario("rhino", {
    players: TWO_PLAYERS,
    seed: 1,
    difficulty: opts.expert ? "expert" : "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS],
  });
  const sets = [encounterSetId("unus"), encounterSetId("infinites")];
  const copies = AOA_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.some((id) => sets.includes(id)),
  ).flatMap((c) => Array.from({ length: (c as { quantityInSet: number }).quantityInSet }, () => c.id));
  const created = createGame(
    {
      ...config,
      villainCardId: "45059" as typeof config.villainCardId,
      villainSide: "A",
      villainStartStageIndex: opts.stage ?? (opts.expert ? 1 : 0),
      villainLastStageIndex: 2,
      mainSchemeCardId: "45062a" as typeof config.mainSchemeCardId,
      encounterDeck: [...config.encounterDeck, ...copies],
    },
    U_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", U_DEPS);
}
const unusId = (s: GameState) => s.activeVillainId!;
const pool = (s: GameState) => inst(s, inVillainArea(s, GENE_POOL)[0]!).threat;

/** Both players end their turn: Unus activates against P1 then P2 (a boost card each), then each is dealt `reveals`. */
function unusRound(
  s: GameState,
  opts: {
    boosts: readonly string[];
    reveals?: readonly string[];
    heroForm?: boolean;
    pick?: (s: GameState) => string[];
  },
) {
  const stacked = stackEncounterDeck(s, ...opts.boosts, ...(opts.reveals ?? []));
  const formed = opts.heroForm ? hero(hero(stacked, P1), P2) : alterEgo(alterEgo(stacked, P1), P2);
  const pick = opts.pick ?? ((st: GameState) => firstLegal(st) as string[]);
  return driveEventsPicking(U_DEPS, formed, pick, endTurn(P1), endTurn(P2));
}
const declineDefense = (st: GameState): string[] =>
  st.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : (firstLegal(st) as string[]);

describe("Unus, 2 players: per-player values (RRG 1.8 'Per Player Icon', p. 32)", () => {
  it("Unus I/II/III have 12/15/18 hit points per player: 24/30/36 with two players", () => {
    for (const [stage, hp] of [
      [0, 24],
      [1, 30],
      [2, 36],
    ] as const) {
      const s = unusGame({ stage });
      expect(maxHitPoints(s, unusId(s), U_DEPS), `stage ${stage + 1}`).toBe(hp);
    }
  });

  it("Hunting Gene Traitors: target threat 11 per player (22), no starting threat, acceleration 1 per player", () => {
    const s = unusGame();
    expect(mainSchemeValue(s, "targetThreat", U_DEPS)).toBe(22);
    expect(inst(s, s.mainScheme.instanceId).threat).toBe(0);
    expect(mainSchemeValue(s, "acceleration", U_DEPS)).toBe(2);
  });

  it("Hunting Gene Traitors setup: expert mode deals EACH player a facedown card; Gene Pool still 4", () => {
    const s = unusGame({ expert: true });
    expect(playerOf(s, P1).dealtEncounter).toHaveLength(1);
    expect(playerOf(s, P2).dealtEncounter).toHaveLength(1);
    expect(pool(s)).toBe(4);
  });

  it("Hunting Gene Traitors 1B: step one of the villain phase puts exactly 1 threat on Gene Pool for two players, not 2", () => {
    const run = unusRound(unusGame(), { boosts: [BLANK_A, BLANK_B], reveals: [RANKS, RANKS] });
    // 4 at setup, 1 from step one; Endless Ranks is a side scheme, not a Gene Pool threat source.
    expect(pool(run.state)).toBe(5);
  });
});

describe("Infinite Hunter (45065), 2 players", () => {
  it("WHEN REVEALED by player 2: 3 damage goes to an ally PLAYER 2 controls, not to player 1's ally", () => {
    let s = hero(unusGame());
    s = playFromHand(U_DEPS, s, JESSICA_JONES, 4).state;
    s = asPlayer(s, P2, (x) => playFromHand(U_DEPS, hero(x, P2), TIGRA, 3, firstLegal, P2).state);
    const jessica = inPlayControlled(s, P1, JESSICA_JONES)[0]!;
    const tigra = inPlayControlled(s, P2, TIGRA)[0]!;
    // P1 is dealt a quiet Endless Ranks, P2 the Hunter.
    const run = unusRound(s, { boosts: [BLANK_A, BLANK_B], reveals: [RANKS, HUNTER] });
    expect(inst(run.state, jessica).damage).toBe(0);
    expect(playerOf(run.state, P2).discard).toContain(tigra);
    expect(playerOf(run.state, P1).playArea).toContain(jessica);
  });

  it("WHEN REVEALED by player 2 with no ally of theirs: nothing is damaged, even with player 1's ally in play", () => {
    let s = hero(unusGame());
    s = playFromHand(U_DEPS, s, JESSICA_JONES, 4).state;
    const jessica = inPlayControlled(s, P1, JESSICA_JONES)[0]!;
    const run = unusRound(s, { boosts: [BLANK_A, BLANK_B], reveals: [RANKS, HUNTER] });
    expect(inst(run.state, jessica).damage).toBe(0);
    expect(byCode(run.state, HUNTER).some((id) => inst(run.state, id).engagedWith === P2)).toBe(true);
  });

  it("BOOST on the activation against player 2: player 2 makes the choice (RRG 'Defend, Defense': boost 'you' is the defender)", () => {
    const chooser: string[] = [];
    const pick = (st: GameState): string[] => {
      const c = st.pendingChoice!;
      if (c.prompt.kind === "chooseOption") {
        chooser.push(c.playerId);
        return [c.options.find((o) => o.label.startsWith("Place 2"))!.optionId];
      }
      return declineDefense(st);
    };
    // Unus attacks P1 with a blank boost, then P2 with the Hunter as the boost card.
    const run = unusRound(unusGame(), { boosts: [BLANK_A, HUNTER], heroForm: true, pick });
    expect(chooser).toEqual([P2]);
    expect(pool(run.state)).toBe(4 + 1 + 2);
  });
});

describe("Infinite Prelate (45067), 2 players", () => {
  it("revealed by player 2: Unus attacks player 2 again, a third attack after the two of the villain phase", () => {
    const run = unusRound(unusGame(), {
      boosts: [BLANK_A, BLANK_B],
      reveals: [RANKS, INF_PRELATE, BLANK_A2, BLANK_B2],
      heroForm: true,
      pick: declineDefense,
    });
    const targets = events(run.events, "attackResolved")
      .filter((e) => e.enemyInstanceId === unusId(run.state))
      .map((e) => e.targetInstanceId);
    expect(targets).toEqual([identityOf(run.state, P1), identityOf(run.state, P2), identityOf(run.state, P2)]);
  });
});

describe("Prelate Sidearm (45063), 2 players", () => {
  it("FORCED RESPONSE: Unus defeating player 2's ally puts 1 threat on Gene Pool ('an ally', not 'your ally')", () => {
    let s = hero(unusGame());
    s = asPlayer(s, P2, (x) => playFromHand(U_DEPS, hero(x, P2), TIGRA, 3, firstLegal, P2).state);
    const tigra = inPlayControlled(s, P2, TIGRA)[0]!;
    s = patchInstance(s, tigra, { damage: 2 });
    s = attachToHost(s, SIDEARM, unusId(s)).state;
    const before = pool(s);
    // Unus attacks P1 (undefended), then P2, who defends with Tigra.
    const pick = (st: GameState): string[] => {
      const c = st.pendingChoice!;
      if (c.prompt.kind === "declareDefender") {
        return c.playerId === P2 && c.options.some((o) => o.optionId === tigra) ? [tigra] : ["decline"];
      }
      return firstLegal(st) as string[];
    };
    const run = unusRound(s, { boosts: [BLANK_A, BLANK_B], heroForm: true, pick });
    expect(playerOf(run.state, P2).discard).toContain(tigra);
    // Step one's 1 + Sidearm's 1 + Gene Pool's own 3 for an ally defeated by an attack.
    expect(pool(run.state) - before).toBe(1 + 1 + 3);
  });
});

describe("Prelate Sidearm / Armor hero response (45063, 45064), player 2", () => {
  /** Hand cards of player 2 (surgery) paying exactly the two wanted resource kinds. */
  const handFor = (s: GameState, kinds: readonly ("energy" | "physical" | "mental")[]) => {
    const owner = playerOf(s, P2);
    const used: InstanceId[] = [];
    for (const kind of kinds) {
      const hit = [...owner.hand, ...owner.deck].find((id) => {
        const icons = (s.cardPool[s.instances[id]!.cardId] as { resourceIcons?: Record<string, number> }).resourceIcons;
        return (
          !used.includes(id) &&
          (icons?.[kind] ?? 0) === 1 &&
          Object.values(icons ?? {}).reduce((a, b) => a + b, 0) === 1
        );
      });
      if (!hit) throw new Error(`no single ${kind} card`);
      used.push(hit);
    }
    const hand = used.filter((id) => !owner.hand.includes(id));
    return {
      names: used.map((id) => s.cardPool[s.instances[id]!.cardId]!.name),
      state: {
        ...s,
        players: s.players.map((p) =>
          p.playerId === P2
            ? {
                ...p,
                hand: [...used, ...p.hand.filter((i) => !used.includes(i))],
                deck: p.deck.filter((i) => !hand.includes(i)),
              }
            : p,
        ),
      } as GameState,
    };
  };

  it("player 2's basic attack against Unus offers the response to player 2, who pays and discards the Sidearm", () => {
    let s = attachToHost(unusGame(), SIDEARM, unusId(unusGame())).state;
    // Player 2 acts after player 1 ends their turn.
    s = driveEventsPicking(U_DEPS, hero(s), firstLegal, endTurn(P1)).state;
    const { state, names } = handFor(hero(s, P2), ["energy", "physical"]);
    const ready = patchInstance(state, identityOf(state, P2), { exhausted: false });
    const pick = (st: GameState): string[] => {
      const c = st.pendingChoice!;
      if (c.prompt.kind === "chooseTriggers")
        return c.options.filter((o) => o.label.startsWith("Prelate Sidearm")).map((o) => o.optionId);
      if (c.prompt.kind === "payForAbility" || c.prompt.kind === "spendResources") {
        const ids: string[] = [];
        for (const name of names) {
          const hit = c.options.find((o) => o.label === name && !ids.includes(o.optionId));
          if (hit) ids.push(hit.optionId);
        }
        return ids.length > 0 ? ids : (firstLegal(st) as string[]);
      }
      return firstLegal(st) as string[];
    };
    const run = driveEventsPicking(U_DEPS, ready, pick, {
      type: "basicAttack",
      playerId: P2,
      attackerInstanceId: identityOf(ready, P2),
      targetInstanceId: unusId(ready),
    } as Command);
    expect(inst(run.state, unusId(run.state)).attachments).toEqual([]);
  });
});

describe("Genetic Experiments (45066): the +1 ATK / +1 SCH on its card", () => {
  it("an attached Infinite minion has +1 ATK, +1 SCH (card icons) and +2 hit points", () => {
    const run = unusRound(unusGame(), { boosts: [BLANK_A, BLANK_B], reveals: [SOLDIER, SOLDIER] });
    const soldier = byCode(run.state, SOLDIER).find((id) => inst(run.state, id).engagedWith === P1)!;
    const before = {
      atk: statBonus(run.state, U_DEPS, soldier, "atk"),
      sch: statBonus(run.state, U_DEPS, soldier, "sch"),
    };
    const armed = attachToHost(run.state, EXPERIMENTS, soldier).state;
    expect(statBonus(armed, U_DEPS, soldier, "atk") - before.atk).toBe(1);
    expect(statBonus(armed, U_DEPS, soldier, "sch") - before.sch).toBe(1);
    expect(statBonus(armed, U_DEPS, soldier, "hp")).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The Four Horsemen
// ---------------------------------------------------------------------------------------------------------------

const { "45085a.setup": _randomSetup, ...SEATED } = FOUR_HORSEMEN;
const H_DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, SEATED) };
const WAR = "45081a";
const FAMINE = "45082a";
const PESTILENCE = "45083a";
const DEATH = "45084a";
const VILLAINS = [WAR, FAMINE, PESTILENCE, DEATH];
const RAVAGES = "45086";
const SPECTER = "45089";
const GOLDEN_HORSE = "45090";
const METAL_WINGS = "45091";
const H_WAR = "45092";
const H_DEATH = "45095";
const ROUGH_RIDERS = "45096";
const QUIET = ["45088", "01108", "45087", "45089"];

function horsemenGame(face: "a" | "b" = "a"): GameState {
  const {
    villainSide: _side,
    villainStartStageIndex: _start,
    villainLastStageIndex: _last,
    ...config
  } = coreScenario("rhino", {
    players: TWO_PLAYERS,
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
      villainCardId: `45081${face}` as typeof config.villainCardId,
      villains: VILLAINS.map((id) => ({
        villainCardId: `${id.slice(0, 5)}${face}` as typeof config.villainCardId,
        encounterDeck: [],
      })),
      sharedEncounterDeck: true,
      mainSchemeCardId: "45085a" as typeof config.mainSchemeCardId,
      encounterDeck: [...config.encounterDeck, ...copies],
    },
    H_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const s = settle(created.state, firstLegal, (state) => state.step.phase === "player", H_DEPS);
  return { ...s, villainRow: s.villains.map((v) => v.instanceId) };
}
const villain = (s: GameState, code: string): InstanceId => {
  const found = s.villains.find((v) => codeOf(s, v.instanceId) === code);
  if (!found) throw new Error(`no ${code}`);
  return found.instanceId;
};
const seated = (s: GameState, row: readonly string[], holder: string): GameState => ({
  ...s,
  villainRow: row.map((c) => villain(s, c)),
  activeVillainId: villain(s, holder),
});
const withDamageOn = (s: GameState, code: string, damage: number) => patchInstance(s, villain(s, code), { damage });
const activeCode = (s: GameState) => codeOf(s, s.activeVillainId!);
const discardCount = (s: GameState, player = P1) => playerOf(s, player).discard.length;

/** Both players are in `form`; both end their turn. `boosts` are the villain activations' boost cards, then `reveals`. */
function horsemenRound(
  s: GameState,
  opts: {
    boosts: readonly string[];
    reveals?: readonly string[];
    heroForm?: boolean;
    pick?: (s: GameState) => string[];
  },
) {
  const stacked = stackEncounterDeck(s, ...opts.boosts, ...(opts.reveals ?? [QUIET[0]!, QUIET[2]!]));
  const formed = opts.heroForm === false ? alterEgo(alterEgo(stacked, P1), P2) : hero(hero(stacked, P1), P2);
  return driveEventsPicking(H_DEPS, formed, opts.pick ?? declineDefense, endTurn(P1), endTurn(P2));
}
const attackersOf = (run: { state: GameState; events: readonly GameEvent[] }) =>
  events(run.events, "attackResolved")
    .filter((e) => VILLAINS.includes(codeOf(run.state, e.enemyInstanceId)))
    .map((e) => [codeOf(run.state, e.enemyInstanceId), e.targetInstanceId] as const);

describe("Four Horsemen villains, 2 players: per-player hit points and Forced Responses", () => {
  it("side A has 9 hit points per player (18), side B 12 (24)", () => {
    const a = horsemenGame("a");
    for (const code of VILLAINS) expect(maxHitPoints(a, villain(a, code), H_DEPS), code).toBe(18);
    const b = horsemenGame("b");
    for (const code of VILLAINS) expect(maxHitPoints(b, villain(b, `${code.slice(0, 5)}b`), H_DEPS), code).toBe(24);
  });

  it("The Horsemen of Apocalypse: target threat 12 per player (24), acceleration 1 per player", () => {
    const s = horsemenGame();
    expect(mainSchemeValue(s, "targetThreat", H_DEPS)).toBe(24);
    expect(mainSchemeValue(s, "acceleration", H_DEPS)).toBe(2);
  });

  it("War attacks player 1 and Famine attacks player 2: each Forced Response hits only the player that was attacked", () => {
    let s = horsemenGame();
    s = playFromHand(H_DEPS, hero(s), AUNT_MAY, 1).state;
    // P2 has a support too (Tac Team, 01056, cost 3).
    s = asPlayer(s, P2, (x) => playFromHand(H_DEPS, hero(x, P2), "01056", 3, firstLegal, P2).state);
    const run = horsemenRound(s, { boosts: [BLANK_A, BLANK_B] });
    expect(attackersOf(run).map(([code]) => code)).toEqual([WAR, FAMINE]);
    // War (against P1) discards P1's support only; Famine (against P2) mills P2 only.
    expect(inPlayControlled(run.state, P1, AUNT_MAY)).toHaveLength(0);
    expect(inPlayControlled(run.state, P2, "01056")).toHaveLength(1);
    expect(discardCount(run.state, P2) - discardCount(s, P2)).toBe(10);
    expect(discardCount(run.state, P1) - discardCount(s, P1)).toBe(1);
  });

  it("Death attacking player 2 deals 1 to each character PLAYER 2 controls and nothing to player 1's characters", () => {
    let s = horsemenGame();
    s = playFromHand(H_DEPS, hero(s), JESSICA_JONES, 4).state;
    s = asPlayer(s, P2, (x) => playFromHand(H_DEPS, hero(x, P2), TIGRA, 3, firstLegal, P2).state);
    const jessica = inPlayControlled(s, P1, JESSICA_JONES)[0]!;
    const tigra = inPlayControlled(s, P2, TIGRA)[0]!;
    // Row Pestilence, Death, War, Famine with the counter on Pestilence: Pestilence attacks P1, Death attacks P2.
    const row = seated(s, [PESTILENCE, DEATH, WAR, FAMINE], PESTILENCE);
    const run = horsemenRound(row, { boosts: [BLANK_A, BLANK_B] });
    expect(attackersOf(run).map(([code]) => code)).toEqual([PESTILENCE, DEATH]);
    expect(inst(run.state, tigra).damage).toBe(1);
    expect(damageOnIdentity(run.state, P2)).toBeGreaterThanOrEqual(1);
    expect(inst(run.state, jessica).damage).toBe(0);
  });

  it("Pestilence attacking player 2 blanks only player 2's identity", () => {
    const row = seated(horsemenGame(), [WAR, PESTILENCE, FAMINE, DEATH], WAR);
    const run = horsemenRound(row, { boosts: [BLANK_A, BLANK_B] });
    expect(attackersOf(run).map(([code]) => code)).toEqual([WAR, PESTILENCE]);
    const blank = (player: typeof P1) =>
      run.state.lastingEffects.some(
        (e) => e.kind === "blankTextBox" && e.targets.includes(identityOf(run.state, player)),
      );
    expect(blank(P2)).toBe(true);
    expect(blank(P1)).toBe(false);
  });
});

describe("Horsemen treachery and Rough Riders revealed by player 2", () => {
  it("Horseman of War dealt to player 2: War heals 2, gets tough and attacks PLAYER 2", () => {
    const s0 = withDamageOn(horsemenGame(), WAR, 5);
    const run = horsemenRound(s0, { boosts: [BLANK_A, BLANK_B], reveals: [QUIET[0]!, H_WAR] });
    const wars = attackersOf(run).filter(([code]) => code === WAR);
    // The villain phase's own activation is against P1 (War holds the counter); the treachery's is against P2.
    expect(wars.map(([, target]) => target)).toContain(identityOf(run.state, P2));
    expect(inst(run.state, villain(run.state, WAR)).statuses.tough).toBe(1);
  });

  it("Horseman of Death dealt to player 2: Death attacks PLAYER 2 (the villain phase's own attacks are War on player 1, Famine on player 2)", () => {
    const run = horsemenRound(horsemenGame(), { boosts: [BLANK_A, BLANK_B], reveals: [QUIET[0]!, H_DEATH] });
    const hits = attackersOf(run);
    expect(hits.map(([code]) => code)).toEqual([WAR, FAMINE, DEATH]);
    expect(hits[2]![1]).toBe(identityOf(run.state, P2));
  });

  it("Rough Riders revealed by player 2: the active villain's and the next villain's Forced Responses resolve for PLAYER 2", () => {
    let s = horsemenGame();
    s = playFromHand(H_DEPS, hero(s), AUNT_MAY, 1).state;
    s = asPlayer(s, P2, (x) => playFromHand(H_DEPS, hero(x, P2), "01056", 3, firstLegal, P2).state);
    // All four at 0 hit points: their own activations resolve no Forced Response, but Rough Riders resolves them "as if
    // it has at least 1 hit point". Pestilence and Death take the two villain-phase activations, leaving War active.
    const zero = VILLAINS.reduce((acc, code) => withDamageOn(acc, code, 18), seated(s, VILLAINS, PESTILENCE));
    const before = { p1: discardCount(zero, P1), p2: discardCount(zero, P2) };
    const run = horsemenRound(zero, {
      boosts: [BLANK_A, BLANK_B],
      reveals: [QUIET[0]!, ROUGH_RIDERS],
      heroForm: false,
    });
    // War's Forced Response discards P2's support (not P1's Aunt May); Famine's mills P2's deck by 10.
    expect(inPlayControlled(run.state, P2, "01056")).toHaveLength(0);
    expect(inPlayControlled(run.state, P1, AUNT_MAY)).toHaveLength(1);
    expect(discardCount(run.state, P2) - before.p2).toBe(1 + 10);
    expect(discardCount(run.state, P1) - before.p1).toBe(0);
    expect(activeCode(run.state)).toBe(FAMINE);
  });
});

describe("Four Horsemen side schemes defeated by player 2", () => {
  const defeatedBy = (s0: GameState, code: string, player: typeof P1) => {
    const turned = player === P1 ? s0 : driveEventsPicking(H_DEPS, s0, firstLegal, endTurn(P1)).state;
    const { state, id } = encounterCardInVillainArea(turned, code, 1);
    return driveEventsPicking(H_DEPS, hero(state, player), firstLegal, {
      type: "basicThwart",
      playerId: player,
      thwarterInstanceId: identityOf(state, player),
      schemeInstanceId: id,
    } as Command);
  };

  it("The Ravages of War: player 2 defeats it and discards player 2's support, player 1's stays", () => {
    let s = horsemenGame();
    s = playFromHand(H_DEPS, hero(s), AUNT_MAY, 1).state;
    s = asPlayer(s, P2, (x) => playFromHand(H_DEPS, hero(x, P2), "01056", 3, firstLegal, P2).state);
    const run = defeatedBy(s, RAVAGES, P2);
    expect(inPlayControlled(run.state, P2, "01056")).toHaveLength(0);
    expect(inPlayControlled(run.state, P1, AUNT_MAY)).toHaveLength(1);
  });

  it("The Specter of Death: player 2 defeats it and only player 2's characters take 1", () => {
    let s = horsemenGame();
    s = playFromHand(H_DEPS, hero(s), JESSICA_JONES, 4).state;
    s = asPlayer(s, P2, (x) => playFromHand(H_DEPS, hero(x, P2), TIGRA, 3, firstLegal, P2).state);
    const jessica = inPlayControlled(s, P1, JESSICA_JONES)[0]!;
    const tigra = inPlayControlled(s, P2, TIGRA)[0]!;
    const run = defeatedBy(s, SPECTER, P2);
    expect(inst(run.state, tigra).damage).toBe(1);
    expect(inst(run.state, jessica).damage).toBe(0);
    expect(damageOnIdentity(run.state, P1)).toBe(damageOnIdentity(s, P1));
    expect(damageOnIdentity(run.state, P2)).toBe(damageOnIdentity(s, P2) + 1);
  });
});

describe("Golden Horse / Metal Wings: stat icons on the card and 'you' for a player 2 attacker", () => {
  it("Golden Horse and Metal Wings give their host +1 ATK and +1 SCH (the card's icons)", () => {
    const s = horsemenGame();
    const horsed = attachToHost(s, GOLDEN_HORSE, villain(s, FAMINE)).state;
    expect(statBonus(horsed, H_DEPS, villain(horsed, FAMINE), "atk")).toBe(1);
    expect(statBonus(horsed, H_DEPS, villain(horsed, FAMINE), "sch")).toBe(1);
    const winged = attachToHost(s, METAL_WINGS, villain(s, DEATH)).state;
    expect(statBonus(winged, H_DEPS, villain(winged, DEATH), "atk")).toBe(1);
    expect(statBonus(winged, H_DEPS, villain(winged, DEATH), "sch")).toBe(1);
    expect(keywordTotal(winged, villain(winged, DEATH), "retaliate", H_DEPS)).toBe(1);
  });

  it("Golden Horse on Famine, player 2 attacks and uses the response: PLAYER 2's deck is milled, not player 1's", () => {
    let s = horsemenGame();
    s = withDamageOn(s, FAMINE, 4);
    s = attachToHost(s, GOLDEN_HORSE, villain(s, FAMINE)).state;
    s = hero(hero(s, P1), P2);
    // P2 acts after P1 ends the turn.
    s = driveEventsPicking(H_DEPS, s, firstLegal, endTurn(P1)).state;
    s = patchInstance(hero(s, P2), identityOf(s, P2), { exhausted: false });
    const before = { p1: discardCount(s, P1), p2: discardCount(s, P2) };
    const pick = (st: GameState): string[] => {
      const c = st.pendingChoice!;
      if (c.prompt.kind === "chooseTriggers") return c.options.map((o) => o.optionId);
      return firstLegal(st) as string[];
    };
    const run = driveEventsPicking(H_DEPS, s, pick, {
      type: "basicAttack",
      playerId: P2,
      attackerInstanceId: identityOf(s, P2),
      targetInstanceId: villain(s, FAMINE),
    } as Command);
    expect(discardCount(run.state, P2) - before.p2).toBe(10);
    expect(discardCount(run.state, P1) - before.p1).toBe(0);
    expect(byCode(run.state, GOLDEN_HORSE).some((id) => inVillainArea(run.state, GOLDEN_HORSE).includes(id))).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Apocalypse
// ---------------------------------------------------------------------------------------------------------------

const A_DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, APOCALYPSE, PRELATES) };
const PRELATE_CODES = ["45179b", "45180b", "45181b", "45182b", "45183b"];
const HEART = "45104a";
const CITADEL = "45104b";
const THRONE = "45105a";
const NLW = "45105b";
const FITTEST = "45109";
const SOLUTION = "45111";

function apocalypseGame(stage = 1): GameState {
  const config = coreScenario("rhino", {
    players: TWO_PLAYERS,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS],
  });
  const set = encounterSetId("apocalypse");
  const copies = AOA_CARDS.filter(
    (c) =>
      "encounterSetIds" in c &&
      c.encounterSetIds.includes(set) &&
      !["45104b", "45105a", "45105b"].includes(c.id as string) &&
      (c.type as string) !== "villain" &&
      (c.type as string) !== "main_scheme",
  ).flatMap((c) => Array.from({ length: (c as { quantityInSet: number }).quantityInSet }, () => c.id));
  const created = createGame(
    {
      ...config,
      villainCardId: "45101a" as typeof config.villainCardId,
      villainSide: "A",
      villainStartStageIndex: stage,
      villainLastStageIndex: 3,
      mainSchemeCardId: "45103a" as typeof config.mainSchemeCardId,
      encounterDeck: [...config.encounterDeck, ...copies],
      setAside: [...PRELATE_CODES, THRONE] as never[],
    },
    A_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", A_DEPS);
}
const prelatesInPlay = (s: GameState) =>
  allIds(s).filter((id) => PRELATE_CODES.includes(codeOf(s, id)) && inst(s, id).engagedWith !== null);
const apoc = (s: GameState) => s.activeVillainId!;

describe("Apocalypse, 2 players: per-player values and setup", () => {
  it("villain hit points 8/9/10/11 per player: 16/18/20/22", () => {
    for (const [stage, hp] of [
      [0, 16],
      [1, 18],
      [2, 20],
      [3, 22],
    ] as const) {
      const s = apocalypseGame(stage);
      expect(maxHitPoints(s, apoc(s), A_DEPS), `stage ${stage + 1}`).toBe(hp);
    }
  });

  it("The Age of Apocalypse: 1 starting threat per player (2), acceleration 1 per player (2), target = printed hit points per player (18 at stage II)", () => {
    const s = apocalypseGame();
    expect(inst(s, s.mainScheme.instanceId).threat).toBe(2);
    expect(mainSchemeValue(s, "acceleration", A_DEPS)).toBe(2);
    expect(mainSchemeValue(s, "targetThreat", A_DEPS)).toBe(18);
  });

  it("SETUP: the first player (only) reveals the Prelate, engaged with player 1; Heart of the Empire starts at 2", () => {
    const s = apocalypseGame();
    const prelates = prelatesInPlay(s);
    expect(prelates).toHaveLength(1);
    expect(inst(s, prelates[0]!).engagedWith).toBe(P1);
    expect(inst(s, inVillainArea(s, HEART)[0]!).threat).toBe(2);
  });

  it("every Prelate has 5 hit points per player: 10 with two players", () => {
    for (const code of PRELATE_CODES) {
      const s = stackEncounterDeck(apocalypseGame(), ...[]);
      const config = byCode(s, code);
      // Set-aside Prelates are instances too: read the printed value through the engine's max hit points.
      expect(config.length, code).toBe(1);
      expect(maxHitPoints(s, config[0]!, A_DEPS), code).toBe(10);
    }
  });

  it("Heart of the Empire defeated by player 2: the FIRST player reveals the Prelate (engaged with player 1) and player 2 is dealt the card", () => {
    let s = apocalypseGame();
    // Defeat the Prelate in play so threat can come off Heart.
    const only = prelatesInPlay(s)[0]!;
    s = patchInstance(s, only, { statuses: { stunned: 0, confused: 0, tough: 0 }, damage: 999 });
    s = hero(s);
    s = driveEventsPicking(A_DEPS, patchInstance(s, identityOf(s, P1), { exhausted: false }), firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(s, P1),
      targetInstanceId: only,
    } as Command).state;
    expect(prelatesInPlay(s)).toHaveLength(0);
    const turned = driveEventsPicking(A_DEPS, s, firstLegal, endTurn(P1)).state;
    const heart = inVillainArea(turned, HEART)[0]!;
    const near = patchInstance(hero(turned, P2), heart, { threat: 1 });
    const run = driveEventsPicking(A_DEPS, near, firstLegal, {
      type: "basicThwart",
      playerId: P2,
      thwarterInstanceId: identityOf(near, P2),
      schemeInstanceId: heart,
    } as Command);
    expect(prelatesInPlay(run.state)).toHaveLength(1);
    expect(inst(run.state, prelatesInPlay(run.state)[0]!).engagedWith).toBe(P1);
    expect(playerOf(run.state, P2).dealtEncounter).toHaveLength(1);
    expect(playerOf(run.state, P1).dealtEncounter).toHaveLength(0);
    expect(inVillainArea(run.state, CITADEL)).toHaveLength(1);
  });
});

describe("The Apocalypse Solution (45111), 2 players", () => {
  it("discards the bare numeral (9 at stage II), not 18", () => {
    const s0 = apocalypseGame();
    const { state, id } = encounterCardInVillainArea(s0, SOLUTION, 1);
    const piles = Object.values(state.encounterDecks)[0]!;
    const deckBefore = piles.deck.length;
    const discardBefore = piles.discard.length;
    expect(deckBefore).toBeGreaterThan(20);
    const near = patchInstance(hero(state), id, { threat: 1 });
    const run = driveEventsPicking(
      A_DEPS,
      patchInstance(near, identityOf(near, P1), { exhausted: false }),
      firstLegal,
      {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(near, P1),
        schemeInstanceId: id,
      } as Command,
    );
    const after = Object.values(run.state.encounterDecks)[0]!;
    // The Solution itself also goes to the encounter discard.
    expect(after.discard.length - discardBefore).toBe(9 + 1);
    expect(deckBefore - after.deck.length).toBe(9);
  });
});

describe("Apocalypse II/III Steady and IV Stalwart in play, 2 players", () => {
  it("stage II (Steady): one stunned card does not stop his attack, and it stays until a second arrives", () => {
    const s0 = apocalypseGame();
    const s = patchInstance(s0, apoc(s0), { statuses: { stunned: 1, confused: 0, tough: 1 } });
    const stacked = stackEncounterDeck(s, BLANK_A, BLANK_B, SOLUTION, SOLUTION);
    const run = driveEventsPicking(A_DEPS, hero(hero(stacked, P1), P2), declineDefense, endTurn(P1), endTurn(P2));
    const attacks = events(run.events, "attackResolved").filter((e) => e.enemyInstanceId === apoc(run.state));
    expect(attacks).toHaveLength(2);
    expect(inst(run.state, apoc(run.state)).statuses.stunned).toBe(1);
  });

  it("stage I (no Steady): one stunned card stops his attack against the first player and is discarded", () => {
    const s0 = apocalypseGame(0);
    const s = patchInstance(s0, apoc(s0), { statuses: { stunned: 1, confused: 0, tough: 1 } });
    const stacked = stackEncounterDeck(s, BLANK_A, SOLUTION, SOLUTION);
    const run = driveEventsPicking(A_DEPS, hero(hero(stacked, P1), P2), declineDefense, endTurn(P1), endTurn(P2));
    const attacks = events(run.events, "attackResolved").filter((e) => e.enemyInstanceId === apoc(run.state));
    expect(attacks.map((e) => e.targetInstanceId)).toEqual([identityOf(run.state, P2)]);
    expect(inst(run.state, apoc(run.state)).statuses.stunned).toBe(0);
  });
});

describe("The Fittest (45109) and Apocalypse attachments: card icons", () => {
  it("The Fittest gives its host minion +1 ATK, +1 SCH (card icons) and +5 hit points", () => {
    const s = apocalypseGame();
    const prelate = prelatesInPlay(s)[0]!;
    const armed = attachToHost(s, FITTEST, prelate).state;
    expect(statBonus(armed, A_DEPS, prelate, "atk")).toBe(1);
    expect(statBonus(armed, A_DEPS, prelate, "sch")).toBe(1);
    expect(statBonus(armed, A_DEPS, prelate, "hp")).toBe(5);
  });

  it("Cyberpathy gives Apocalypse +1 SCH and Biomorphing +1 ATK", () => {
    const s = apocalypseGame();
    const cyber = attachToHost(s, "45106", apoc(s)).state;
    expect(statBonus(cyber, A_DEPS, apoc(cyber), "sch")).toBe(1);
    const bio = attachToHost(s, "45107", apoc(s)).state;
    expect(statBonus(bio, A_DEPS, apoc(bio), "atk")).toBe(1);
  });
});

describe("Wolf Among Sheep (45110), 2 players", () => {
  const round = (s: GameState, reveals: readonly string[], boosts: readonly string[]) => {
    const stacked = stackEncounterDeck(s, ...boosts, ...reveals);
    return driveEventsPicking(A_DEPS, hero(hero(stacked, P1), P2), declineDefense, endTurn(P1), endTurn(P2));
  };
  const attacksBy = (run: { state: GameState; events: readonly GameEvent[] }, prelate: boolean) =>
    events(run.events, "attackResolved")
      .filter((e) => PRELATE_CODES.includes(codeOf(run.state, e.enemyInstanceId)) === prelate)
      .map((e) => e.targetInstanceId);

  it("revealed by player 2: the Prelate engaged with player 1 attacks PLAYER 2 ('against you')", () => {
    const s = apocalypseGame();
    // Villain phase: Apocalypse vs P1 and vs P2 take a boost card each; the Prelate (no Villainous keyword except Mister
    // Sinister's) takes none. Then P1's card, P2's Wolf.
    const run = round(s, [SOLUTION, "45110"], [BLANK_A, BLANK_B]);
    const [p1, p2] = [identityOf(run.state, P1), identityOf(run.state, P2)];
    expect(attacksBy(run, true)).toEqual([p1, p2]);
    expect(attacksBy(run, false)).toEqual([p1, p2]);
  });

  it("revealed by player 2 with no Prelate in play: Apocalypse attacks player 2", () => {
    let s = apocalypseGame();
    s = hero(s);
    const only = prelatesInPlay(s)[0]!;
    s = patchInstance(s, only, { statuses: { stunned: 0, confused: 0, tough: 0 } });
    s = defeatWithAttack(A_DEPS, patchInstance(s, identityOf(s, P1), { exhausted: false }), only);
    expect(prelatesInPlay(s)).toHaveLength(0);
    const run = round(s, [SOLUTION, "45110", BLANK_A2], [BLANK_A, BLANK_B]);
    const [p1, p2] = [identityOf(run.state, P1), identityOf(run.state, P2)];
    expect(attacksBy(run, false)).toEqual([p1, p2, p2]);
  });
});

describe("No Longer Worthy (45105b), 2 players: the chain to the Throne", () => {
  const thwartOut = (s: GameState, scheme: InstanceId) => {
    const ready = patchInstance(hero(s), identityOf(s, P1), { exhausted: false });
    return driveEventsPicking(A_DEPS, patchInstance(ready, scheme, { threat: 1 }), firstLegal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(s, P1),
      schemeInstanceId: scheme,
    } as Command).state;
  };
  const clearPrelates = (s: GameState) =>
    prelatesInPlay(s).reduce(
      (acc, id) =>
        defeatWithAttack(
          A_DEPS,
          patchInstance(
            hero(patchInstance(acc, id, { statuses: { stunned: 0, confused: 0, tough: 0 } })),
            identityOf(acc, P1),
            {
              exhausted: false,
            },
          ),
          id,
        ),
      s,
    );

  it("the Throne flips to No Longer Worthy on Apocalypse and heals 5 per player (10)", () => {
    let s = clearPrelates(apocalypseGame());
    s = clearPrelates(thwartOut(s, inVillainArea(s, HEART)[0]!));
    s = clearPrelates(thwartOut(s, inVillainArea(s, CITADEL)[0]!));
    s = patchInstance(s, apoc(s), { damage: 15 });
    const throne = inVillainArea(s, THRONE)[0]!;
    const run = thwartOut(s, throne);
    expect(inst(run, apoc(run)).attachments.map((id) => codeOf(run, id))).toContain(NLW);
    expect(inst(run, apoc(run)).damage).toBe(5);
    // "Each other player" is dealt a card each time: player 2 got one at Heart, Citadel and Throne, player 1 none.
    expect(playerOf(run, P1).dealtEncounter).toHaveLength(0);
    expect(playerOf(run, P2).dealtEncounter.length).toBeGreaterThanOrEqual(1);
  });
});

void withActive;
