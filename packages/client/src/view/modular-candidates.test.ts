import { describe, expect, test } from "vitest";
import { CARDS_BY_ID, POOL_ENCOUNTER_SETS, POOL_SCENARIOS } from "../content/pool.js";
import { Unlocks, NO_PROGRESS, DEFAULT_UNLOCK_PREFS } from "../progression/unlocks.js";
import {
  ALL_OPEN,
  RECOMMENDED_GROUP_ID,
  isScenarioSpecificSet,
  modularCandidatesFor,
  type ModularCandidate,
  type ModularScope,
} from "./modular-candidates.js";
import { MODULAR_SET_EXCLUSIONS, modularExclusionReason } from "./modular-exclusions.js";
import { modularSetOptionsFor, toggleModularSet } from "./modular-sets.js";
import { initialSetupDraft } from "./setup-draft.js";

const scenarioOf = (id: string) => POOL_SCENARIOS.find((s) => (s.id as string) === id)!;
const draftFor = (id: string) =>
  initialSetupDraft({ scenarioId: id, seatDeckId: "precon:core-spider-man-justice", seed: 1 });

/** The candidates as `{ group label: [set ids] }`, a recommended set starred: what a pinned snapshot should read like. */
function byGroup(candidates: readonly ModularCandidate[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const c of candidates) (out[c.groupLabel ?? "(pool)"] ??= []).push(c.recommended ? `${c.id}*` : c.id);
  return out;
}

/** What a profile that has not beaten Rhino sees: only the Core Set's wave is open. */
const freshProfile: ModularScope = {
  isCycleOpen: (cycleId) =>
    new Unlocks({ progress: NO_PROGRESS, prefs: DEFAULT_UNLOCK_PREFS }).waveLock(cycleId) === null,
};

describe("Campaign Challenge (GMW) is campaign-only", () => {
  test("no scenario's picker offers it (owner, 2026-10-04; RRG 1.8 p. 61)", () => {
    expect(POOL_ENCOUNTER_SETS.find((set) => (set.id as string) === "challenge")?.campaignSpecific).toBe(true);
    for (const id of ["rhino", "tower-defense", "kang"])
      expect(modularCandidatesFor(scenarioOf(id)).map((c) => c.id)).not.toContain("challenge");
  });
});

describe("modular candidates, pinned for three scenarios (everything unlocked)", () => {
  test("Rhino: Bomb Scare recommended, then every modular set by cycle", () => {
    expect(byGroup(modularCandidatesFor(scenarioOf("rhino")))).toMatchInlineSnapshot(`
      {
        "Core Set": [
          "legions_of_hydra",
          "masters_of_evil",
          "the_doomsday_chair",
          "under_attack",
        ],
        "Mutant Genesis": [
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
        ],
        "NeXt Evolution": [
          "black_tom_cassidy",
          "extreme_measures",
          "flight",
          "military_grade",
          "mutant_insurrection",
          "mutant_slayers",
          "nasty_boys",
          "super_strength",
          "telepathy",
        ],
        "Promo": [
          "kree_fanatic",
        ],
        "Recommended": [
          "bomb_scare*",
        ],
        "Sinister Motives": [
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
        ],
        "The Galaxy's Most Wanted": [
          "badoon_headhunter",
          "band_of_badoon",
          "galactic_artifacts",
          "kree_militant",
          "menagerie_medley",
          "power_stone",
          "ship_command",
          "space_pirates",
        ],
        "The Mad Titan's Shadow": [
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
        ],
        "The Rise of Red Skull": [
          "exper_weapon",
          "hydra_assault",
          "hydra_patrol",
          "weap_master",
          "anachronauts",
          "mot",
          "temporal",
        ],
        "Wave 1": [
          "a_mess_of_things",
          "goblin_gimmicks",
          "power_drain",
          "running_interference",
        ],
      }
    `);
  });

  test("Sabretooth: Brotherhood and Mystique recommended; its own set is never offered", () => {
    expect(byGroup(modularCandidatesFor(scenarioOf("sabretooth")))).toMatchInlineSnapshot(`
      {
        "Core Set": [
          "bomb_scare",
          "legions_of_hydra",
          "masters_of_evil",
          "the_doomsday_chair",
          "under_attack",
        ],
        "Mutant Genesis": [
          "acolytes",
          "future_past",
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
        ],
        "NeXt Evolution": [
          "black_tom_cassidy",
          "extreme_measures",
          "flight",
          "military_grade",
          "mutant_insurrection",
          "mutant_slayers",
          "nasty_boys",
          "super_strength",
          "telepathy",
        ],
        "Promo": [
          "kree_fanatic",
        ],
        "Recommended": [
          "brotherhood*",
          "mystique*",
        ],
        "Sinister Motives": [
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
        ],
        "The Galaxy's Most Wanted": [
          "badoon_headhunter",
          "band_of_badoon",
          "galactic_artifacts",
          "kree_militant",
          "menagerie_medley",
          "power_stone",
          "ship_command",
          "space_pirates",
        ],
        "The Mad Titan's Shadow": [
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
        ],
        "The Rise of Red Skull": [
          "exper_weapon",
          "hydra_assault",
          "hydra_patrol",
          "weap_master",
          "anachronauts",
          "mot",
          "temporal",
        ],
        "Wave 1": [
          "a_mess_of_things",
          "goblin_gimmicks",
          "power_drain",
          "running_interference",
        ],
      }
    `);
  });

  test("Mojo: only the six genre sets, one unlabeled group", () => {
    expect(byGroup(modularCandidatesFor(scenarioOf("mojo")))).toMatchInlineSnapshot(`
      {
        "(pool)": [
          "crime*",
          "fantasy*",
          "horror*",
          "sci-fi*",
          "sitcom*",
          "western*",
        ],
      }
    `);
  });
});

describe("what counts as modular", () => {
  const offeredFor = (scenarioId: string): string[] => modularCandidatesFor(scenarioOf(scenarioId)).map((c) => c.id);

  test("never a villain's own set, a Standard or Expert set, a nemesis, campaign or extra set", () => {
    const rhino = offeredFor("rhino");
    for (const id of ["klaw", "ultron", "bulldozer", "wrecking_crew", "standard", "expert", "hydra_camp", "longshot"])
      expect(rhino, id).not.toContain(id);
    for (const set of POOL_ENCOUNTER_SETS)
      if (set.campaignSpecific || set.nemesisOfIdentityId || set.classification || set.extraModular)
        expect(rhino, set.id).not.toContain(set.id as string);
  });

  test("a set that is one scenario's own and another's modular pick stays modular, except for its own scenario", () => {
    expect(isScenarioSpecificSet("sentinels")).toBe(false);
    expect(offeredFor("rhino")).toContain("sentinels");
    expect(offeredFor("master-mold")).not.toContain("sentinels");
    expect(offeredFor("sabretooth")).not.toContain("sabretooth");
  });

  test("the hero-pack and scenario-pack modular sets the owner named are all there", () => {
    const ids = offeredFor("rhino");
    for (const id of [
      "shadow_king",
      "deathstrike",
      "exodus",
      "reavers",
      "brotherhood",
      "sentinels",
      "zero_tolerance",
      "acolytes",
      "mystique",
      "crime",
      "western",
    ])
      expect(ids, id).toContain(id);
  });

  test("every candidate is a real set of the pool with cards in it", () => {
    const known = new Set(POOL_ENCOUNTER_SETS.map((s) => s.id as string));
    for (const c of modularCandidatesFor(scenarioOf("rhino"))) {
      expect(known.has(c.id), c.id).toBe(true);
      expect(
        [...CARDS_BY_ID.values()].some(
          (card) => "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(c.id),
        ),
        `${c.id} has cards`,
      ).toBe(true);
    }
  });

  test("the recommended group comes first, then groups in release order, a group's sets together", () => {
    const groups = modularCandidatesFor(scenarioOf("rhino")).map((c) => c.groupId);
    expect(groups[0]).toBe(RECOMMENDED_GROUP_ID);
    const seen: string[] = [];
    for (const g of groups) if (seen[seen.length - 1] !== g) seen.push(g);
    expect(new Set(seen).size, "each group is one run").toBe(seen.length);
    expect(seen.slice(0, 3)).toEqual([RECOMMENDED_GROUP_ID, "core", "wave1"]);
    expect(seen[seen.length - 1]).toBe("cycle7");
  });
});

describe("unlock gating", () => {
  test("a fresh profile sees only the Core Set's modular sets, plus what the scenario recommends", () => {
    const ids = modularCandidatesFor(scenarioOf("rhino"), freshProfile).map((c) => c.id);
    // The Kree Fanatic print-and-play set is no retail pack: it waits for the official print-and-play opt-in (Q-M4).
    expect(ids.sort()).toEqual(
      ["bomb_scare", "legions_of_hydra", "masters_of_evil", "the_doomsday_chair", "under_attack"].sort(),
    );
  });

  test("official print-and-play content is its own opt-in (Q-M4): off on a fresh profile, hidden Promo group, on when chosen", () => {
    const off = modularCandidatesFor(scenarioOf("rhino"), freshProfile);
    expect(off.map((c) => c.id)).not.toContain("kree_fanatic");
    expect(off.map((c) => c.groupLabel)).not.toContain("Promo");
    const optedIn = new Unlocks({
      progress: NO_PROGRESS,
      prefs: { ...DEFAULT_UNLOCK_PREFS, officialPrintAndPlay: true },
    });
    expect(optedIn.officialPrintAndPlay).toBe(true);
    // Independent of every pack: the opt-in alone opens the Promo group, and the Core-only profile still sees no Wave 1 set.
    const scope: ModularScope = { ...freshProfile, officialPrintAndPlay: optedIn.officialPrintAndPlay };
    const on = modularCandidatesFor(scenarioOf("rhino"), scope);
    expect(on.find((c) => c.id === "kree_fanatic")?.groupLabel).toBe("Promo");
    expect(on.map((c) => c.id)).not.toContain("power_drain");
    // "Unlock everything" is not the opt-in.
    const everything = new Unlocks({ progress: NO_PROGRESS, prefs: { ...DEFAULT_UNLOCK_PREFS, unlockAll: true } });
    expect(everything.officialPrintAndPlay).toBe(false);
  });

  test("Experimental Weapons is a modular pick everywhere but Crossbones, which already has it (Q-M3)", () => {
    const offered = (id: string) => modularCandidatesFor(scenarioOf(id)).map((c) => c.id);
    expect(offered("rhino")).toContain("exper_weapon");
    expect(offered("sandman")).toContain("exper_weapon");
    expect(offered("crossbones")).not.toContain("exper_weapon");
  });

  test("beating Rhino opens Wave 1 and The Rise of Red Skull, and their sets arrive with them", () => {
    const beatRhino = new Unlocks({
      progress: { ...NO_PROGRESS, wonScenarioIds: ["rhino"] },
      prefs: DEFAULT_UNLOCK_PREFS,
    });
    const scope: ModularScope = { isCycleOpen: (id) => beatRhino.waveLock(id) === null };
    const ids = modularCandidatesFor(scenarioOf("rhino"), scope).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["power_drain", "hydra_assault"]));
    expect(ids).not.toContain("shadow_king");
  });

  test("unlock everything opens every pack, but not official print-and-play content (its own opt-in, Q-M4)", () => {
    const everything = new Unlocks({ progress: NO_PROGRESS, prefs: DEFAULT_UNLOCK_PREFS, devUnlockAll: true });
    const scope: ModularScope = { isCycleOpen: (id) => everything.waveLock(id) === null };
    expect(modularCandidatesFor(scenarioOf("rhino"), scope)).toEqual(
      modularCandidatesFor(scenarioOf("rhino"), ALL_OPEN).filter((c) => c.id !== "kree_fanatic"),
    );
  });

  test("a scenario's own recommended sets are offered even when their wave is closed", () => {
    // Sabretooth recommends two Mutant Genesis sets; the table is playing it, so they are there on a fresh profile.
    const ids = modularCandidatesFor(scenarioOf("sabretooth"), freshProfile).map((c) => c.id);
    expect(ids.slice(0, 2).sort()).toEqual(["brotherhood", "mystique"]);
  });

  test("Longshot's chip follows its pack's wave", () => {
    const longshotOf = (scope: ModularScope) =>
      modularSetOptionsFor(draftFor("rhino"), scenarioOf("rhino"), CARDS_BY_ID, { scope }).some(
        (o) => o.id === "longshot",
      );
    expect(longshotOf(ALL_OPEN)).toBe(true);
    expect(longshotOf(freshProfile)).toBe(false);
  });
});

describe("scenarios that restrict the pool keep it", () => {
  const GENRES = ["crime", "fantasy", "horror", "sci-fi", "sitcom", "western"];

  test("Spiral and Mojo offer the six genre sets and nothing else, even with everything open", () => {
    for (const id of ["spiral", "mojo"])
      expect(
        modularCandidatesFor(scenarioOf(id), ALL_OPEN)
          .map((c) => c.id)
          .sort(),
      ).toEqual([...GENRES].sort());
  });

  test("MaGog's pool is only its random recommendation: the genre sets lead, every other modular set follows", () => {
    const ids = modularCandidatesFor(scenarioOf("magog")).map((c) => c.id);
    expect(ids.slice(0, 6).sort()).toEqual([...GENRES].sort());
    expect(ids).toEqual(expect.arrayContaining(["bomb_scare", "shadow_king"]));
  });

  test("a scenario that calls for no modular sets (Breakout, The Hood) keeps Core's five", () => {
    for (const id of ["breakout", "the-hood"])
      expect(
        modularCandidatesFor(scenarioOf(id), ALL_OPEN)
          .map((c) => c.id)
          .sort(),
      ).toEqual(["bomb_scare", "legions_of_hydra", "masters_of_evil", "the_doomsday_chair", "under_attack"].sort());
  });

  test("every named pool in the data is honored: a restricted pool is exactly its set ids", () => {
    for (const s of POOL_SCENARIOS)
      if (s.modularSetPool?.restricted)
        expect(modularCandidatesFor(s).map((c) => c.id)).toEqual(s.modularSetPool.setIds.map((id) => id as string));
  });
});

describe("the exclusions table", () => {
  test("holds only the rule-based pairings left after the matrix fixes", () => {
    expect(MODULAR_SET_EXCLUSIONS.map((e) => `${e.scenarioId}+${e.setId}`)).toEqual([
      "tower-defense+infinity_gauntlet",
    ]);
  });

  test("every entry names a real scenario and set and a reason short enough for a tile", () => {
    for (const e of MODULAR_SET_EXCLUSIONS) {
      expect(
        POOL_SCENARIOS.some((s) => (s.id as string) === e.scenarioId),
        e.scenarioId,
      ).toBe(true);
      expect(
        POOL_ENCOUNTER_SETS.some((s) => (s.id as string) === e.setId),
        e.setId,
      ).toBe(true);
      expect(e.reason.length).toBeGreaterThan(0);
      expect(e.reason.split(/\s+/).length, `${e.scenarioId}/${e.setId} reason`).toBeLessThanOrEqual(6);
    }
  });

  test("a barred pairing is shown disabled with its reason, never hidden, and cannot be picked", () => {
    const exclusions = [{ scenarioId: "rhino", setId: "mystique", reason: "Needs two villains" }];
    expect(modularExclusionReason("rhino", "mystique", exclusions)).toBe("Needs two villains");
    expect(modularExclusionReason("sabretooth", "mystique", exclusions)).toBeNull();
    const rhino = scenarioOf("rhino");
    const options = modularSetOptionsFor(draftFor("rhino"), rhino, CARDS_BY_ID, { exclusions });
    const mystique = options.find((o) => o.id === "mystique");
    expect(mystique?.disabledReason).toBe("Needs two villains");
    expect(options.find((o) => o.id === "bomb_scare")?.disabledReason).toBeNull();
  });
});

describe("toggling the new candidates", () => {
  test("a non-recommended set from another box replaces the recommendation at cap 1", () => {
    const rhino = scenarioOf("rhino");
    const draft = toggleModularSet(draftFor("rhino"), rhino, "shadow_king");
    const chosen = modularSetOptionsFor(draft, rhino, CARDS_BY_ID).filter((o) => o.selected);
    expect(chosen.map((o) => o.id)).toEqual(["shadow_king"]);
  });
});

describe("the exclusions table (rule-based pairings left after the matrix fixes)", () => {
  test("every entry names a real scenario and set, a short reason, and its set is listed (disabled) for that scenario", () => {
    const sets = new Set(POOL_ENCOUNTER_SETS.map((set) => set.id as string));
    for (const entry of MODULAR_SET_EXCLUSIONS) {
      expect(
        POOL_SCENARIOS.some((s) => (s.id as string) === entry.scenarioId),
        entry.scenarioId,
      ).toBe(true);
      expect(sets.has(entry.setId), entry.setId).toBe(true);
      expect(entry.reason.length, entry.reason).toBeLessThanOrEqual(40);
      expect(modularCandidatesFor(scenarioOf(entry.scenarioId)).map((c) => c.id)).toContain(entry.setId);
    }
  });

  test("the Infinity Gauntlet set cannot be used at Tower Defense, which starts with two villains (MC21 p. 16)", () => {
    expect(modularExclusionReason("tower-defense", "infinity_gauntlet")).toMatch(/one villain/);
    expect(modularExclusionReason("ebony-maw", "infinity_gauntlet")).toBeNull();
  });
});
