/**
 * Rules-QA 2026-10-04: every modular encounter set of the playable pool against every playable scenario, built
 * through `playableScenario` (the app's builder). Owner decision of 2026-10-04: Table setup will offer every modular
 * set of an unlocked pack for any scenario, because RRG 1.8 "Modular Encounter Set" (p. 29) says modular sets "can be
 * added to and/or removed from nearly any scenario". Until now the picker offered Core's five plus the scenario's own
 * recommendation, so most pairings had never been built.
 *
 * What is pinned here, and why:
 * - the two lists (inline snapshots, so a new pack shows up as a diff a reviewer reads);
 * - the matrix: how many pairings build, how many are restricted by the scenario's own rules, how many are the
 *   scenario's required companion sets;
 * - every pairing that builds yields an encounter deck holding each of the set's cards exactly as often as printed
 *   (RRG "Modular Encounter Set": "added ... as an entire set"), every ability ref of the set's cards registered, and
 *   a setup that leaves no impossible pending choice;
 * - the pairings the builders refuse (findings F1 and F2) are listed by count, and an `it.fails` per finding flips red
 *   the day the builder is fixed so the pin is removed with it.
 *
 * Solo standard for every pairing; expert for a rotating quarter; two players for a rotating tenth (Mojo and The
 * Hood size their set-aside counts by player count, so the seat count is not decoration).
 */
import { PLAYABLE_CARDS } from "@mc/content";
import { cardsInPlay, createGame, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { abilityRefIds } from "./ability-refs.js";
import { PLAYABLE_ABILITIES, PLAYABLE_DEPS } from "./playable/index.js";
import {
  EXTRA_SETS,
  MATRIX_HEROES,
  MODULAR_SETS,
  PLAYABLE_ENCOUNTER_SETS,
  PLAYABLE_SCENARIOS,
  buildPairing,
  cardsOfSet,
  classifySet,
  dealtCopiesOfSet,
  pairingFor,
  scenarioCardsOfSet,
  setupKeywordCardsOfSet,
} from "./testing/modular-matrix.js";

const TIMEOUT = 120_000;
/** Finding F3: the Milano (16142, Ship Command's "Permanent. Setup." support) is missing or never put into play. */
const MILANO_PROBLEM = /16142 Milano/;

describe("the lists, derived from content data", () => {
  it("modular encounter sets of the playable pool (RRG 1.8 FAQ, Galaxy's Most Wanted entry: not scenario-specific, not campaign-specific)", () => {
    expect(MODULAR_SETS.map((set) => set.id)).toMatchInlineSnapshot(`
      [
        "bomb_scare",
        "legions_of_hydra",
        "masters_of_evil",
        "the_doomsday_chair",
        "under_attack",
        "a_mess_of_things",
        "goblin_gimmicks",
        "power_drain",
        "running_interference",
        "exper_weapon",
        "hydra_assault",
        "hydra_patrol",
        "weap_master",
        "anachronauts",
        "mot",
        "temporal",
        "badoon_headhunter",
        "band_of_badoon",
        "galactic_artifacts",
        "kree_militant",
        "menagerie_medley",
        "power_stone",
        "ship_command",
        "space_pirates",
        "kree_fanatic",
        "armies_of_titan",
        "black_order",
        "children_of_thanos",
        "enchantress",
        "frost_giants",
        "infinity_gauntlet",
        "legions_of_hel",
        "beasty_boys",
        "brothers_grimm",
        "crossfire_crew",
        "mister_hyde",
        "ransacked_armory",
        "sinister_syndicate",
        "state_of_emergency",
        "streets_of_mayhem",
        "wrecking_crew_modular",
        "city_in_chaos",
        "down_to_earth",
        "goblin_gear",
        "guerrilla_tactics",
        "osborn_tech",
        "personal_nightmare",
        "sinister_assault",
        "symbiotic_strength",
        "whispers_of_paranoia",
        "armadillo",
        "zzzax",
        "inheritors",
        "ironspider_sinister",
        "acolytes",
        "brotherhood",
        "future_past",
        "mystique",
        "sentinels",
        "zero_tolerance",
        "deathstrike",
        "shadow_king",
        "crime",
        "fantasy",
        "horror",
        "sci-fi",
        "sitcom",
        "western",
        "exodus",
        "reavers",
      ]
    `);
  });

  it("extra one-card modular sets are kept apart (MojoMania insert p. 2: Longshot is not counted as a modular set)", () => {
    expect(EXTRA_SETS.map((set) => set.id)).toMatchInlineSnapshot(`
      [
        "longshot",
      ]
    `);
  });

  it("every other set is excluded, grouped by reason", () => {
    const byReason: Record<string, string[]> = {};
    for (const set of PLAYABLE_ENCOUNTER_SETS) {
      const kind = classifySet(set);
      if (kind.kind === "excluded") (byReason[kind.reason.replace(/\s*\(.*$/, "")] ??= []).push(set.id);
    }
    expect(byReason).toMatchInlineSnapshot(`
      {
        "campaign": [
          "challenge",
        ],
        "campaign-specific": [
          "expcamp",
          "hydra_camp",
          "the_market",
          "mts_campaign",
          "bad_publicity",
          "community_service",
          "shield_tech",
          "snitches_get_stitches",
          "brawler",
          "commander",
          "defender",
          "mut_gen_campaign",
          "peacekeeper",
        ],
        "expert set": [
          "expert",
          "expert_ii",
        ],
        "nemesis set": [
          "black_panther_nemesis",
          "captain_marvel_nemesis",
          "iron_man_nemesis",
          "she_hulk_nemesis",
          "spider_man_nemesis",
          "captain_america_nemesis",
          "ms_marvel_nemesis",
          "thor_nemesis",
          "black_widow_nemesis",
          "doctor_strange_nemesis",
          "hulk_nemesis",
          "hawkeye_nemesis",
          "spider_woman_nemesis",
          "ant_nemesis",
          "wsp_nemesis",
          "qsv_nemesis",
          "scw_nemesis",
          "groot_nemesis",
          "rocket_nemesis",
          "stld_nemesis",
          "gam_nemesis",
          "drax_nemesis",
          "vnm_nemesis",
          "spectrum_nemesis",
          "warlock_nemesis",
          "nebu_nemesis",
          "warm_nemesis",
          "vision_nemesis",
          "valk_nemesis",
          "ghost_spider_nemesis",
          "spider_man_morales_nemesis",
          "nova_nemesis",
          "ironheart_nemesis",
          "spiderham_nemesis",
          "spdr_nemesis",
          "colossus_nemesis",
          "shadowcat_nemesis",
          "cyclops_nemesis",
          "phoenix_nemesis",
          "wolverine_nemesis",
          "storm_nemesis",
          "gambit_nemesis",
          "rogue_nemesis",
        ],
        "scenario-specific": [
          "klaw",
          "rhino",
          "ultron",
          "mutagen_formula",
          "risky_business",
          "bulldozer",
          "piledriver",
          "thunderball",
          "wrecker",
          "wrecking_crew",
          "absorbing_man",
          "crossbones",
          "red_skull",
          "taskmaster",
          "zola",
          "exp_kang",
          "kang",
          "brotherhood_of_badoon",
          "escape_the_museum",
          "infiltrate_the_museum",
          "nebula",
          "ronan",
          "ebony_maw",
          "hela",
          "loki",
          "thanos",
          "tower_defense",
          "the_hood",
          "mysterio",
          "sandman",
          "sinister_six",
          "venom",
          "venom_goblin",
          "magneto_villain",
          "mansion_attack",
          "master_mold",
          "project_wideawake",
          "sabretooth",
          "magog",
          "mojo",
          "spiral",
        ],
        "standard set": [
          "standard",
          "standard_ii",
        ],
      }
    `);
  });

  it("playable scenarios", () => {
    expect(PLAYABLE_SCENARIOS.map((scenario) => scenario.id)).toMatchInlineSnapshot(`
      [
        "rhino",
        "klaw",
        "ultron",
        "risky-business",
        "mutagen-formula",
        "breakout",
        "crossbones",
        "absorbing-man",
        "taskmaster",
        "zola",
        "red-skull",
        "kang",
        "brotherhood-of-badoon",
        "infiltrate-the-museum",
        "escape-the-museum",
        "nebula",
        "ronan-the-accuser",
        "ebony-maw",
        "tower-defense",
        "thanos",
        "hela",
        "loki",
        "the-hood",
        "sandman",
        "venom",
        "mysterio",
        "sinister-six",
        "venom-goblin",
        "sabretooth",
        "project-wideawake",
        "master-mold",
        "mansion-attack",
        "magneto",
        "magog",
        "spiral",
        "mojo",
      ]
    `);
  });

  it("unclear classifications, pinned with the question each one raises", () => {
    // Experimental Weapons (trors) is Crossbones' second required set but carries no scenario name: by the FAQ's
    // definition it is modular, and Crossbones requires it, so it pairs with every other scenario.
    expect(classifySet(PLAYABLE_ENCOUNTER_SETS.find((set) => set.id === "exper_weapon")!).kind).toBe("modular");
    // The Challenge set (GMW campaign challenge side schemes) is not flagged `campaignSpecific` in the data.
    const challenge = PLAYABLE_ENCOUNTER_SETS.find((set) => set.id === "challenge")!;
    expect(challenge.campaignSpecific).toBeUndefined();
    expect(classifySet(challenge).kind).toBe("excluded");
    // Hydra Camp, The Market, Brawler, Commander, Defender and Peacekeeper are campaign sets with no cards of their own.
    for (const id of ["hydra_camp", "the_market", "brawler", "commander", "defender", "peacekeeper"])
      expect(cardsOfSet(id), id).toEqual([]);
  });
});

interface Outcome {
  readonly scenario: string;
  readonly set: string;
  readonly kind: "built" | "restricted" | "required" | "refused";
  readonly reason?: string;
  /** The direct build was refused for a pool gap but the staged workaround built. */
  readonly staged?: boolean;
  readonly problems: readonly string[];
}

function seatsFor(setIndex: number, scenarioIndex: number): { readonly seats: readonly { starterDeckId: string }[] } {
  const hero = MATRIX_HEROES[(setIndex * 5 + scenarioIndex) % MATRIX_HEROES.length]!;
  const also = MATRIX_HEROES[(setIndex * 5 + scenarioIndex + 7) % MATRIX_HEROES.length]!;
  const twoPlayer = (setIndex + scenarioIndex) % 10 === 0 && hero !== also;
  return { seats: twoPlayer ? [{ starterDeckId: hero }, { starterDeckId: also }] : [{ starterDeckId: hero }] };
}

const unregistered = (setId: string): string[] =>
  [...new Set(cardsOfSet(setId).flatMap((card) => abilityRefIds(card)))].filter((id) => !(id in PLAYABLE_ABILITIES));

/** Instances in the game of each card of the set (encounter cards have no owner), against what is printed. */
function deckProblems(state: GameState, setId: string): string[] {
  const expected = dealtCopiesOfSet(setId);
  const found = new Map<string, number>();
  for (const instance of Object.values(state.instances))
    if (instance.ownerId === null && expected.has(instance.cardId))
      found.set(instance.cardId, (found.get(instance.cardId) ?? 0) + 1);
  const problems: string[] = [];
  for (const [id, copies] of expected)
    if ((found.get(id) ?? 0) !== copies) problems.push(`${id}: ${found.get(id) ?? 0} copies, printed ${copies}`);
  return problems;
}

/**
 * RRG 1.8 "Setup (Keyword)" (p. 40) and step 11 of setup (p. 51): a card with the setup keyword begins the game in play,
 * wherever its set is used, and a scenario-specific card of the set (the Milano) is in the game at all. Read only for
 * a pairing the builder built itself: the staged workaround for a pool gap adds the encounter cards and nothing else.
 */
function setCardProblems(state: GameState, setId: string): string[] {
  const problems: string[] = [];
  const inPlay = new Set<string>(cardsInPlay(state).map((id) => state.instances[id]!.cardId));
  for (const card of scenarioCardsOfSet(setId))
    if (!Object.values(state.instances).some((instance) => instance.cardId === card.id))
      problems.push(`${card.id} ${card.name} (scenario card of ${setId}) is not in the game`);
  for (const card of setupKeywordCardsOfSet(setId))
    if (!inPlay.has(card.id)) problems.push(`${card.id} ${card.name} has the setup keyword and did not start in play`);
  return problems;
}

function setupProblems(state: GameState): string[] {
  const problems: string[] = [];
  if (state.outcome) problems.push(`game over at setup: ${JSON.stringify(state.outcome)}`);
  const choice = state.pendingChoice;
  if (choice && choice.options.length < choice.minSelections)
    problems.push(`pending ${choice.prompt.kind} offers ${choice.options.length}, needs ${choice.minSelections}`);
  return problems;
}

function runPairing(setId: string, scenarioIndex: number, setIndex: number, expert: boolean): Outcome {
  const scenario = PLAYABLE_SCENARIOS[scenarioIndex]!;
  const { seats } = seatsFor(setIndex, scenarioIndex);
  const built = buildPairing(setId, scenario, { seed: 1000 + setIndex * 40 + scenarioIndex, players: seats, expert });
  const base = { scenario: scenario.id as string, set: setId };
  if (built.pairing.kind !== "build")
    return { ...base, kind: built.pairing.kind, reason: built.pairing.reason, problems: [] };
  const config = built.config ?? built.workaround;
  if (!config) return { ...base, kind: "refused", reason: built.error ?? "unknown", problems: [] };
  const problems: string[] = [];
  try {
    const created = createGame(config, PLAYABLE_DEPS);
    if (!created.ok) problems.push(`createGame: ${created.error.message}`);
    else
      problems.push(
        ...deckProblems(created.state, setId),
        ...setupProblems(created.state),
        ...(built.config ? setCardProblems(created.state, setId) : []),
      );
  } catch (error) {
    problems.push(`createGame threw: ${(error as Error).message}`);
  }
  return built.config
    ? { ...base, kind: "built", problems }
    : { ...base, kind: "refused", reason: built.error ?? "unknown", staged: true, problems };
}

describe("modular set x scenario: every pairing builds", () => {
  const all: Outcome[] = [];

  PLAYABLE_SCENARIOS.forEach((scenario, scenarioIndex) => {
    it(
      `${scenario.id}: every modular set, standard (and expert for a rotating quarter)`,
      () => {
        const failures: string[] = [];
        MODULAR_SETS.forEach((set, setIndex) => {
          const expert = (setIndex + scenarioIndex) % 4 === 0;
          const standard = runPairing(set.id, scenarioIndex, setIndex, false);
          const outcomes = [standard, ...(expert ? [runPairing(set.id, scenarioIndex, setIndex, true)] : [])];
          for (const outcome of outcomes) {
            all.push(outcome);
            // F3 (the Milano) is pinned by its own `it.fails` below; everything else is a new failure.
            for (const problem of outcome.problems)
              if (!MILANO_PROBLEM.test(problem)) failures.push(`${outcome.set}: ${problem}`);
          }
        });
        // Anything wrong beyond a builder's pool gap (F1, F2) is a new failure: the pinned gaps are asserted below.
        expect(failures).toEqual([]);
      },
      TIMEOUT,
    );
  });

  it("the matrix has the shape pinned here", () => {
    const standard = PLAYABLE_SCENARIOS.flatMap((scenario, scenarioIndex) =>
      MODULAR_SETS.map((set) => ({ scenario: scenario.id as string, set: set.id as string, scenarioIndex })),
    );
    const kinds = { build: 0, restricted: 0, required: 0 };
    const restrictedBy: Record<string, number> = {};
    for (const { scenario, set } of standard) {
      const pairing = pairingFor(
        set,
        PLAYABLE_SCENARIOS.find((s) => s.id === scenario)!,
      );
      kinds[pairing.kind]++;
      if (pairing.kind === "restricted") restrictedBy[scenario] = (restrictedBy[scenario] ?? 0) + 1;
    }
    expect({ sets: MODULAR_SETS.length, scenarios: PLAYABLE_SCENARIOS.length, ...kinds }).toMatchInlineSnapshot(`
      {
        "build": 2162,
        "required": 20,
        "restricted": 338,
        "scenarios": 36,
        "sets": 70,
      }
    `);
    expect(restrictedBy).toMatchInlineSnapshot(`
      {
        "breakout": 70,
        "mojo": 64,
        "sinister-six": 69,
        "spiral": 64,
        "the-hood": 70,
        "tower-defense": 1,
      }
    `);
  });

  it("every ability ref of every modular set's cards is registered (no unscripted card)", () => {
    const missing: Record<string, string[]> = {};
    for (const set of [...MODULAR_SETS, ...EXTRA_SETS]) {
      const refs = unregistered(set.id);
      if (refs.length > 0) missing[set.id] = refs;
    }
    expect(missing).toMatchInlineSnapshot(`{}`);
  });

  it("the pool covers the cards it prints", () => {
    for (const set of MODULAR_SETS) expect(cardsOfSet(set.id, PLAYABLE_CARDS).length, set.id).toBeGreaterThan(0);
  });

  it("no builder refuses a pairing (findings F1 and F2, fixed): every direct build succeeds", () => {
    const refused = all.filter((o) => o.kind === "refused").map((o) => `${o.scenario}+${o.set}: ${o.reason}`);
    expect(refused).toEqual([]);
  });

  // F3: Ship Command's Milano is only put into play by a Ship Command scenario's own Setup text.
  it.fails("F3: Ship Command as a modular set starts with the Milano in play (RRG 1.8 'Setup (Keyword)' p. 40, setup step 11 p. 51)", () => {
    const milano = all.filter((o) => o.set === "ship_command" && o.problems.some((p) => MILANO_PROBLEM.test(p)));
    expect(milano.map((o) => o.scenario)).toEqual([]);
  });

  // F2 (fixed): MaGog accepts any modular set (39002a: the players may name any set); covered by the test above.
});
