import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  validateCard,
  validateScenario,
  validateScenarioEncounterSets,
  validateScenarioMainSchemeStages,
  validateStarterDeck,
} from "../schema/index.js";
import type {
  AnyCard,
  AttachmentCard,
  HeroIdentityCard,
  MainSchemeCard,
  MinionCard,
  VillainCard,
} from "../schema/index.js";
import { CORE_CARDS, CORE_ENCOUNTER_SETS } from "./core/index.js";
import { CW_CARDS } from "./cw/cards.js";
import { CW_ENCOUNTER_SETS } from "./cw/encounterSets.js";
import { CW_CYCLE, CW_PACK } from "./cw/packs.js";
import { CW_PROVENANCE } from "./cw/provenance.js";
import { CW_SCENARIOS } from "./cw/scenarios.js";
import { CW_STARTER_DECKS } from "./cw/starterDecks.js";

/**
 * Civil War (`cw`, MC56, cycle 10): the custom scenario expansion. Counts, the four leaders, the sixteen main scheme
 * stages by side, the sixteen modular sets by side, Standard PvP's two printings, every curation correction and erratum
 * with its citation (`scripts/marvelcdb/curation/cw.ts`), the four scenarios and the two box starter decks.
 * Sources: MC56 rulebook (docs/campaign-modes/mc56_rulebook-web_1.pdf), RRG 1.8 Appendix V (p. 70),
 * docs/phase7-wave10-data-survey.md and docs/phase7-wave10.md.
 */

interface RawRecord {
  readonly code: string;
  readonly type_code: string;
  readonly quantity: number;
}
const raw = JSON.parse(readFileSync(new URL("../../raw/marvelcdb/cw.json", import.meta.url), "utf8")) as {
  cards: readonly RawRecord[];
};

const byId = new Map(CW_CARDS.map((c) => [c.id as string, c]));
const get = <T extends AnyCard>(id: string): T => {
  const card = byId.get(id);
  if (!card) throw new Error(`no card ${id}`);
  return card as T;
};
const setOf = (card: AnyCard): readonly string[] =>
  "encounterSetIds" in card ? (card.encounterSetIds as readonly string[]) : [];
const inSet = (set: string) => CW_CARDS.filter((c) => setOf(c).includes(set));
const typeCounts = (cards: readonly AnyCard[]) => {
  const counts: Record<string, number> = {};
  for (const c of cards) counts[c.type] = (counts[c.type] ?? 0) + 1;
  return counts;
};
const copies = (cards: readonly AnyCard[]) => cards.reduce((n, c) => n + c.quantityInSet, 0);
const text = (card: AnyCard) => (card as { text: { printed: string; current: string } }).text;

describe("cw (MC56, cycle 10): the pack", () => {
  it("is Civil War in cycle 10, released 2025-10-17", () => {
    expect(CW_CYCLE).toEqual({ id: "cycle10", name: "Civil War", order: 10 });
    expect(CW_PACK.name).toBe("Civil War");
    expect(CW_PACK.releaseDate).toBe("2025-10-17");
  });

  it("passes validateCard() on every card, with no duplicate id", () => {
    for (const card of CW_CARDS) expect(validateCard(card).errors, card.id as string).toEqual([]);
    expect(byId.size).toBe(CW_CARDS.length);
    for (const card of CW_CARDS) {
      expect(card.setCode as string).toBe("cw");
      expect(card.cycleId as string).toBe("cycle10");
    }
  });

  it("is 190 cards from the 214 raw top-level records, by type", () => {
    expect(raw.cards).toHaveLength(214);
    expect(CW_CARDS).toHaveLength(190);
    expect(typeCounts(CW_CARDS)).toEqual({
      hero_identity: 2,
      ally: 8,
      support: 5,
      upgrade: 18,
      event: 21,
      resource: 9,
      obligation: 6,
      minion: 31,
      side_scheme: 24,
      attachment: 23,
      treachery: 37,
      villain: 4,
      main_scheme: 2,
    });
    // 16 leader and 16 main scheme records fold into four villain cards and two main scheme cards (and each leader
    // stage is one copy); 272 raw copies = 248 card copies + 12 + 12 (a card stands for its stages).
    expect(copies(CW_CARDS)).toBe(248);
    expect(raw.cards.reduce((n, r) => n + r.quantity, 0)).toBe(272);
  });

  it("has the box's 98 player cards (MC56 p. 2), none with an encounter set", () => {
    const player = CW_CARDS.filter((c) => setOf(c).length === 0 && c.type !== "obligation");
    expect(copies(player)).toBe(98);
    expect(typeCounts(player)).toEqual({ hero_identity: 2, ally: 8, support: 5, upgrade: 18, event: 21, resource: 9 });
  });

  it("covers every raw record in provenance", () => {
    const covered = new Set(CW_PROVENANCE.flatMap((p) => p.marvelcdbCodes));
    for (const r of raw.cards) expect(covered.has(r.code), r.code).toBe(true);
  });
});

describe("cw: encounter cards by set (counts by type, copies)", () => {
  const expected: Record<string, readonly [Record<string, number>, number]> = {
    tigra_nemesis: [{ minion: 3, side_scheme: 1, attachment: 1 }, 5],
    hulkling_nemesis: [{ minion: 1, side_scheme: 1, attachment: 1, treachery: 1 }, 5],
    iron_man_leader: [{ villain: 1, attachment: 5, treachery: 2, side_scheme: 1 }, 11],
    captain_marvel_leader: [{ villain: 1, attachment: 3, treachery: 3, side_scheme: 1 }, 11],
    captain_america_leader: [{ villain: 1, attachment: 3, treachery: 3, side_scheme: 1 }, 11],
    spider_woman_leader: [{ villain: 1, attachment: 2, treachery: 3, side_scheme: 1 }, 11],
    registration: [{ main_scheme: 1 }, 1],
    resistance: [{ main_scheme: 1 }, 1],
    mighty_avengers: [{ minion: 3, treachery: 1, side_scheme: 1 }, 5],
    the_initiative: [{ minion: 2, attachment: 1, treachery: 1, side_scheme: 1 }, 5],
    maria_hill_modular: [{ minion: 1, attachment: 1, treachery: 1, side_scheme: 1 }, 5],
    dangerous_recruits: [{ minion: 2, treachery: 2, side_scheme: 1 }, 5],
    cape_killer: [{ minion: 1, obligation: 1, treachery: 1, side_scheme: 1 }, 5],
    martial_law: [{ minion: 1, treachery: 1, side_scheme: 1 }, 5],
    heroes_for_hire: [{ minion: 2, obligation: 1, treachery: 1, side_scheme: 1 }, 5],
    paladin: [{ minion: 1, attachment: 1, treachery: 1, side_scheme: 1 }, 5],
    new_avengers: [{ minion: 3, treachery: 1, side_scheme: 1 }, 5],
    secret_avengers: [{ minion: 2, treachery: 2, side_scheme: 1 }, 5],
    namor_modular: [{ minion: 1, attachment: 2, treachery: 1, side_scheme: 1 }, 5],
    atlanteans: [{ minion: 1, treachery: 1, side_scheme: 1 }, 5],
    spider_man_modular: [{ minion: 1, attachment: 1, treachery: 1, side_scheme: 1 }, 5],
    defenders: [{ minion: 2, treachery: 2, side_scheme: 1 }, 5],
    hells_kitchen: [{ minion: 2, attachment: 1, treachery: 1, side_scheme: 1 }, 5],
    cloak_and_dagger_modular: [{ minion: 2, attachment: 1, treachery: 1, side_scheme: 1 }, 5],
    // The five-card Standard PvP set: 56125, 56126, 56127 x2 and the side scheme Choosing Sides, plus the obligation
    // that is the back of Choosing Sides (Now It's Personal) as a card of its own.
    standard_pvp_registration: [{ treachery: 3, side_scheme: 1, obligation: 1 }, 6],
    standard_pvp_resistance: [{ treachery: 3, side_scheme: 1, obligation: 1 }, 6],
  };

  it.each(Object.entries(expected))("%s", (set, [types, count]) => {
    expect(typeCounts(inSet(set))).toEqual(types);
    expect(copies(inSet(set))).toBe(count);
  });

  it("accounts for every encounter card: the sets above plus the two hero obligations", () => {
    const sets = new Set(Object.keys(expected));
    const stray = CW_CARDS.filter((c) => setOf(c).length > 0 && !setOf(c).some((s) => sets.has(s)));
    expect(stray).toEqual([]);
    expect(setOf(get("56023"))).toEqual([]);
    expect(setOf(get("56054"))).toEqual([]);
  });

  it("emits 26 encounter sets: the 16 modular, 4 leader, 2 main scheme, 2 Standard PvP and 2 nemesis sets", () => {
    expect(CW_ENCOUNTER_SETS).toHaveLength(26);
    for (const set of CW_ENCOUNTER_SETS) expect(set.packCodes as readonly string[]).toEqual(["cw"]);
    const names = Object.fromEntries(CW_ENCOUNTER_SETS.map((s) => [s.id as string, s.name]));
    // Corrections to the raw set titles (curation `encounterSets` and `setRecodes`).
    expect(names.spider_woman_leader).toBe("Spider-Woman");
    expect(names.maria_hill_modular).toBe("Maria Hill"); // the printed set title (MC56 p. 7; scan 56083)
    expect(names.standard_pvp_registration).toBe("Standard PvP (Registration)");
    expect(names.standard_pvp_resistance).toBe("Standard PvP (Resistance)");
    expect(names.cape_killer).toBe("Cape-Killer");
    expect(new Set(CW_ENCOUNTER_SETS.map((s) => s.name)).size).toBe(26);
  });
});

describe("cw: the four leaders (spec 1.1)", () => {
  const leaders: Record<string, readonly (readonly [number, number, number, number])[]> = {
    // stage, hit points per player, ATK, SCH
    "56059": [
      [1, 12, 1, 1],
      [2, 16, 2, 1],
      [3, 16, 2, 1],
      [4, 20, 3, 1],
    ],
    "56092": [
      [1, 14, 2, 1],
      [2, 18, 2, 2],
      [3, 18, 2, 2],
      [4, 22, 3, 2],
    ],
    "56137": [
      [1, 14, 2, 1],
      [2, 18, 2, 2],
      [3, 18, 2, 2],
      [4, 22, 3, 2],
    ],
    "56168": [
      [1, 13, 2, 1],
      [2, 17, 2, 2],
      [3, 17, 2, 2],
      [4, 21, 3, 2],
    ],
  };

  it.each(Object.entries(leaders))("%s is a four-stage leader with per-player hit points", (id, stages) => {
    const leader = get<VillainCard>(id);
    expect(leader.type).toBe("villain");
    expect(leader.printedType).toBe("leader");
    expect(leader.unique).toBe(true);
    expect(leader.sides).toHaveLength(1);
    expect(leader.sides[0]!.side).toBe("A");
    expect(
      leader.sides[0]!.stages.map((s) => [s.stageNumber, s.hp.perPlayer, s.hp.base, s.atk, s.sch] as const),
    ).toEqual(stages.map(([n, hp, atk, sch]) => [n, hp, 0, atk, sch]));
  });

  it("are named Iron Man, Captain Marvel, Captain America and Spider-Woman, in their own sets", () => {
    expect(["56059", "56092", "56137", "56168"].map((id) => [get(id).name, setOf(get(id))[0]])).toEqual([
      ["Iron Man", "iron_man_leader"],
      ["Captain Marvel", "captain_marvel_leader"],
      ["Captain America", "captain_america_leader"],
      ["Spider-Woman", "spider_woman_leader"],
    ]);
  });

  it("carry Steady on stages II and IV and no keyword on I and III", () => {
    for (const id of Object.keys(leaders)) {
      const stages = get<VillainCard>(id).sides[0]!.stages;
      expect(stages.map((s) => s.keywords.map((k) => k.name))).toEqual([[], ["steady"], [], ["steady"]]);
    }
  });

  it("each leader's set is the leader plus ten cards", () => {
    for (const set of ["iron_man_leader", "captain_marvel_leader", "captain_america_leader", "spider_woman_leader"])
      expect(copies(inSet(set))).toBe(11);
  });
});

describe("cw: the sixteen main scheme stages (spec 1.2)", () => {
  const registration = get<MainSchemeCard>("56063a");
  const resistance = get<MainSchemeCard>("56141a");
  const stageLines = (card: MainSchemeCard) =>
    card.stages.map((s) => [s.printedCardId as string, s.stageNumber, s.name] as const);

  it("are one card per side with eight stages each, in raw code order", () => {
    expect(registration.encounterSetIds as readonly string[]).toEqual(["registration"]);
    expect(resistance.encounterSetIds as readonly string[]).toEqual(["resistance"]);
    expect(stageLines(registration)).toEqual([
      ["56063b", 1, "Cut Off Support"],
      ["56064b", 2, "Negative Zone Prison"],
      ["56096b", 1, "S.H.I.E.L.D. Recruits"],
      ["56097b", 2, "Hunting Rebel Heroes"],
      ["56121b", 1, "Homeland Security"],
      ["56122b", 1, "Public Outrage"],
      ["56123b", 2, "The Initiative"],
      ["56124b", 2, "No Going Back"],
    ]);
    expect(stageLines(resistance)).toEqual([
      ["56141b", 1, "Gathering Support"],
      ["56142b", 2, "Secret Avengers"],
      ["56172b", 1, "Open Rebellion"],
      ["56173b", 2, "Neighborhood Protectors"],
      ["56199b", 1, "Rallying Call"],
      ["56200b", 1, "Going Underground"],
      ["56201b", 2, "Guerilla Warfare"],
      ["56202b", 2, "Superhero Jailbreak"],
    ]);
  });

  it("have four stage 1s and four stage 2s a side", () => {
    for (const card of [registration, resistance]) {
      expect(card.stages.filter((s) => s.stageNumber === 1)).toHaveLength(4);
      expect(card.stages.filter((s) => s.stageNumber === 2)).toHaveLength(4);
    }
  });

  it("start at 0 threat, with a target of 7 (stage 1) or 9 (stage 2) and +1 acceleration, all per player (16 scans read 2026-10-11)", () => {
    for (const stage of [...registration.stages, ...resistance.stages]) {
      const target = stage.stageNumber === 1 ? 7 : 9;
      expect(stage.startingThreat, stage.printedCardId as string).toEqual({ base: 0, perPlayer: 0 });
      expect(stage.targetThreat, stage.printedCardId as string).toEqual({ base: 0, perPlayer: target });
      expect(stage.acceleration, stage.printedCardId as string).toEqual({ base: 0, perPlayer: 1 });
      expect(stage.dashedValues).toBeUndefined();
      expect(stage.printedX).toBeUndefined();
    }
  });

  it("lose the game on completing a stage 2, and only a stage 2", () => {
    for (const stage of [...registration.stages, ...resistance.stages])
      expect(stage.completionLoses === true, stage.printedCardId as string).toBe(stage.stageNumber === 2);
  });

  it("keep the per-player icon the scans print: hinder 2 on all eight stage 1s, and the 1 minions / 1 side schemes searches", () => {
    const stage1s = [...registration.stages, ...resistance.stages].filter((s) => s.stageNumber === 1);
    // The Homeland Security / Rallying Call / Going Underground / Public Outrage / Open Rebellion / Cut Off Support /
    // S.H.I.E.L.D. Recruits / Gathering Support stage 1s all print "hinder 2" with the icon.
    for (const stage of stage1s) {
      expect(stage.text.current, stage.printedCardId as string).toContain(
        "If there is more than 1 player on your team, this stage gains hinder 2[per_hero].",
      );
      expect(stage.text.printed).toBe(stage.text.current);
    }
    const bearer = (id: string) => [...registration.stages, ...resistance.stages].find((s) => s.printedCardId === id)!;
    for (const id of ["56096b", "56141b"])
      expect(bearer(id).text.current, id).toContain("searches the encounter deck for 1[per_hero] minions");
    for (const id of ["56123b", "56173b"])
      expect(bearer(id).text.current, id).toContain("encounter deck and discard pile for 1[per_hero] side schemes");
    expect(CW_CARDS.some((c) => /hinder 2(?!\[per_hero\])/.test(JSON.stringify(c)))).toBe(false);
  });

  it("flag the stars the scans print on a value (text carries the rule, no field): 56064b, 56122b, 56202b", () => {
    expect(registration.stages.find((s) => s.printedCardId === "56064b")!.text.current).toContain(
      "[star] Reduce the target threat",
    );
    expect(registration.stages.find((s) => s.printedCardId === "56122b")!.text.current).toContain(
      "[star] Forced Response",
    );
    expect(resistance.stages.find((s) => s.printedCardId === "56202b")!.text.current).toContain(
      "[star] Forced Response",
    );
  });

  it("share one A side per number: the four stage 1s print Contents and Setup", () => {
    for (const stage of [...registration.stages, ...resistance.stages].filter((s) => s.stageNumber === 1)) {
      expect(stage.aSide.text.current).toContain("Contents: Chosen leader I and II (III and IV for expert mode)");
      expect(stage.aSide.text.current).toContain(
        "In cooperative mode, find the chosen leader's side scheme and reveal it.",
      );
    }
  });
});

describe("cw: the sixteen modular sets, by side (spec 1.3)", () => {
  const modular: Record<"registration" | "resistance", readonly string[]> = {
    registration: [
      "mighty_avengers",
      "the_initiative",
      "maria_hill_modular",
      "dangerous_recruits",
      "cape_killer",
      "martial_law",
      "heroes_for_hire",
      "paladin",
    ],
    resistance: [
      "new_avengers",
      "secret_avengers",
      "namor_modular",
      "atlanteans",
      "spider_man_modular",
      "defenders",
      "hells_kitchen",
      "cloak_and_dagger_modular",
    ],
  };

  it("each is five copies, eight a side", () => {
    for (const [side, sets] of Object.entries(modular)) {
      expect(sets).toHaveLength(8);
      for (const id of sets) {
        const set = CW_ENCOUNTER_SETS.find((s) => s.id === id)!;
        expect(set.side, id).toBe(side);
        expect(copies(inSet(id)), id).toBe(5);
      }
    }
  });

  it("carry a side on 24 sets: 12 a side (4 leader and modular sets apart, the main scheme set and the Standard PvP copy)", () => {
    const sided = CW_ENCOUNTER_SETS.filter((s) => s.side !== undefined);
    expect(sided).toHaveLength(24);
    expect(sided.filter((s) => s.side === "registration").map((s) => s.id as string)).toEqual(
      expect.arrayContaining([
        "iron_man_leader",
        "captain_marvel_leader",
        "registration",
        "standard_pvp_registration",
        ...modular.registration,
      ]),
    );
    expect(sided.filter((s) => s.side === "registration")).toHaveLength(12);
    expect(sided.filter((s) => s.side === "resistance")).toHaveLength(12);
    // The two nemesis sets are neutral.
    for (const id of ["tigra_nemesis", "hulkling_nemesis"])
      expect(CW_ENCOUNTER_SETS.find((s) => s.id === id)!.side).toBeUndefined();
  });

  it("have a minion, a treachery and a side scheme each", () => {
    for (const id of [...modular.registration, ...modular.resistance]) {
      const types = new Set<string>(inSet(id).map((c) => c.type));
      for (const type of ["minion", "treachery", "side_scheme"]) expect(types.has(type), `${id} ${type}`).toBe(true);
    }
  });

  it("Teamwork (AVENGER) is on the six minions of New Avengers and Secret Avengers", () => {
    const minions = ["56074", "56150", "56151", "56152", "56155", "56156"].map((id) => get<MinionCard>(id));
    for (const m of minions)
      expect(
        m.keywords.some((k) => k.name === "teamwork"),
        m.id as string,
      ).toBe(true);
  });

  it("the cards reprinted under two codes stay separate cards (56076/56081, 56106/56114, 56115/56119, 56153/56157, 56187/56192)", () => {
    for (const [a, b] of [
      ["56076", "56081"],
      ["56106", "56114"],
      ["56115", "56119"],
      ["56153", "56157"],
      ["56187", "56192"],
    ] as const) {
      expect(get(a).name).toBe(get(b).name);
      expect(setOf(get(a))).not.toEqual(setOf(get(b)));
    }
  });
});

describe("cw: Standard PvP (two side-tagged printings, competitive only)", () => {
  it("is two sets of the same five cards, marked competitive-only and side-tagged", () => {
    for (const [side, set] of [
      ["registration", "standard_pvp_registration"],
      ["resistance", "standard_pvp_resistance"],
    ] as const) {
      const record = CW_ENCOUNTER_SETS.find((s) => s.id === set)!;
      expect(record.competitiveOnly).toBe(true);
      expect(record.side).toBe(side);
      expect(inSet(set).map((c) => c.name)).toEqual(
        expect.arrayContaining(["Choosing Sides", "Now It's Personal", "Targeted Strike"]),
      );
    }
    expect(
      inSet("standard_pvp_registration")
        .map((c) => c.id as string)
        .sort(),
    ).toEqual(["56125", "56126", "56127", "56128a", "56128b"]);
    expect(
      inSet("standard_pvp_resistance")
        .map((c) => c.id as string)
        .sort(),
    ).toEqual(["56203", "56204", "56205", "56206a", "56206b"]);
    // No leftover `standard_pvp` set: neither copy is the legacy id.
    expect(CW_ENCOUNTER_SETS.some((s) => s.id === "standard_pvp")).toBe(false);
  });

  it("is refused by every scenario record (competitive mode is not built)", () => {
    const sets = [...CORE_ENCOUNTER_SETS, ...CW_ENCOUNTER_SETS];
    const pvp = {
      ...CW_SCENARIOS[0]!,
      standardEncounterSetIds: [CW_ENCOUNTER_SETS.find((s) => s.id === "standard_pvp_registration")!.id],
    };
    expect(validateScenarioEncounterSets(pvp, sets).errors).toEqual([
      "scenario registration-iron-man names competitive-only set standard_pvp_registration; competitive mode is not built",
    ]);
  });

  it("Choosing Sides is a permanent side scheme with 4 threat per player, flipping to the obligation Now It's Personal", () => {
    for (const [front, back] of [
      ["56128a", "56128b"],
      ["56206a", "56206b"],
    ] as const) {
      const scheme = get(front) as unknown as {
        startingThreat: unknown;
        keywords: { name: string }[];
        otherFaceId: string;
      };
      expect(get(front).type).toBe("side_scheme");
      expect(scheme.startingThreat).toEqual({ base: 0, perPlayer: 4 });
      expect(scheme.keywords.map((k) => k.name)).toEqual(["permanent"]);
      expect(scheme.otherFaceId).toBe(back);
      expect(get(back).type).toBe("obligation");
      expect((get(back) as { otherFaceId?: string }).otherFaceId).toBe(front);
    }
  });

  it("56128b and 56206a use stand-in scans from the other side's copy of the same card (no `artUnavailable`)", () => {
    // Stand-ins until real scans arrive: 56206a.png is a copy of 56128a.png and 56128b.png a copy of 56206b.png.
    expect(get("56128a").images?.front).toBe("/bundles/cards/56128a.png");
    expect(get("56128b").images?.front).toBe("/bundles/cards/56128b.png");
    expect(get("56206a").images?.front).toBe("/bundles/cards/56206a.png");
    expect(get("56206b").images?.front).toBe("/bundles/cards/56206b.png");
  });
});

describe("cw: the 16 leader-specific basic player cards are competitive-only", () => {
  const perLeader: Record<string, readonly string[]> = {
    iron_man_leader: ["56129", "56130", "56131", "56132"],
    captain_marvel_leader: ["56133", "56134", "56135", "56136"],
    captain_america_leader: ["56207", "56208", "56209", "56210"],
    spider_woman_leader: ["56211", "56212", "56213", "56214"],
  };

  const TYPES: Record<string, readonly string[]> = {
    iron_man_leader: ["event", "event", "resource", "upgrade"],
    captain_marvel_leader: ["event", "resource", "upgrade", "upgrade"],
    captain_america_leader: ["event", "event", "resource", "upgrade"],
    spider_woman_leader: ["event", "event", "resource", "upgrade"],
  };

  it.each(Object.entries(perLeader))("%s's four cards are specificTo competitive, basic, one copy", (set, ids) => {
    expect(ids.map((id) => get(id).type).sort()).toEqual(TYPES[set]);
    for (const id of ids) {
      const card = get(id) as unknown as { specificTo: unknown; aspect: string; deckLimit: number };
      expect(card.specificTo, id).toEqual({ kind: "competitive", encounterSetId: set });
      expect(card.aspect, id).toBe("basic");
      // No `deck_limit` in the cache (survey G11); the scans (56129, 56214 read 2026-10-11) print no limit and the box
      // holds one copy of each, so the default of 1 for a specific card stands.
      expect(card.deckLimit, id).toBe(1);
      expect(get(id).quantityInSet).toBe(1);
    }
  });

  it("are the only competitive-specific cards in the box", () => {
    const specific = CW_CARDS.filter(
      (c) => "specificTo" in c && (c as { specificTo?: unknown }).specificTo !== undefined,
    );
    expect(specific).toHaveLength(16);
  });

  it("High-Tech Suit attaches to your leader and carries an acceleration icon", () => {
    const suit = get("56131") as unknown as { attachesTo: unknown; schemeIcons: string[] };
    expect(suit.attachesTo).toEqual({ kind: "leader", of: "yours" });
    expect(suit.schemeIcons).toEqual(["acceleration"]);
  });
});

describe("cw: curation corrections (each cites its evidence in scripts/marvelcdb/curation/cw.ts)", () => {
  const notes = (id: string) => CW_PROVENANCE.find((p) => p.cardId === id)!.corrections.join(" | ");

  it.each([
    ["56023", "engaged", "engage3d", "Scan 56023.png"],
    ["56027", "Criminal Underworld side scheme", "Underwold", "Scan 56027.png"],
    ["56086", "1 damage to each character", "damager", "Scan 56086.png"],
    ["56158", "any player on the enemy team", "enmy", "Scan 56158.png"],
    ["56178", "Choose:", "Chooose", "Scan 56178.png"],
  ])("%s: the scan's wording replaces the cache's typo (%s, not %s)", (id, right, wrong, cite) => {
    const card = get(id);
    expect(text(card).printed).toContain(right);
    expect(text(card).current).toContain(right);
    expect(JSON.stringify(text(card))).not.toContain(wrong);
    expect(notes(id)).toContain(cite);
  });

  it("56118 Paladin's Pistol: 'Attach to Paladin. Otherwise, attach to the enemy leader.' is an ifAble host", () => {
    const pistol = get<AttachmentCard>("56118");
    expect(text(pistol).printed).toContain("Attach to Paladin.");
    expect(pistol.attachesTo).toEqual({
      kind: "ifAble",
      preferred: { kind: "namedCard", name: "Paladin" },
      otherwise: { kind: "leader", of: "enemy" },
    });
    expect(notes("56118")).toContain("Scan 56118.png");
  });

  it("56061 Iron Man III: the scan prints Setup, not the cache's When Revealed (spec 4.1 question 8)", () => {
    const stages = get<VillainCard>("56059").sides[0]!.stages;
    const [one, , three] = [stages[0]!, stages[1]!, stages[2]!];
    for (const stage of [one, three]) {
      expect(stage.text.printed).toContain(
        "Setup: The enemy team searches the encounter deck for an Iron Man attachment",
      );
      expect(stage.text.printed).not.toContain("When Revealed");
    }
    expect(three.abilities.map((a) => a.id as string)).toContain("56061.setup");
    expect(three.abilities.map((a) => a.id as string)).not.toContain("56061.when-revealed");
    expect(notes("56059")).toContain("Scan 56061.png");
    // The raw record still says it (the correction is the data decision, not the cache).
    const rawText = readFileSync(new URL("../../raw/marvelcdb/cw.json", import.meta.url), "utf8");
    expect(rawText).toContain("The enemy team searches the encounter deck for an Iron Man attachment");
  });

  it("the attachments with no 'Attach to' sentence take their host from curation (survey G4)", () => {
    expect(get<AttachmentCard>("56057").attachesTo).toBeUndefined(); // ownWhenRevealed: Super Skrull's When Revealed
    expect(get<AttachmentCard>("56080").attachesTo).toBeUndefined(); // ownWhenRevealed: its own When Revealed
    expect(get<AttachmentCard>("56098").attachesTo).toEqual({ kind: "villain" });
    expect(get<AttachmentCard>("56174").attachesTo).toEqual({ kind: "villain" });
    expect(get<AttachmentCard>("56084").attachesTo).toEqual({
      kind: "anyOf",
      hosts: [{ kind: "minion" }, { kind: "leader", of: "enemy" }],
    });
    // The leaders' own attachments that do print a host line resolve to the same villain-kind host.
    expect(get<AttachmentCard>("56065").attachesTo).toEqual({ kind: "villain" });
    expect(get<AttachmentCard>("56143").attachesTo).toEqual({ kind: "villain" });
  });

  it("56191 Resistance Fighter: 'a minion of the enemy team's choice' parses as a minion host (gap G5); the text is kept", () => {
    const fighter = get<AttachmentCard>("56191");
    expect(fighter.attachesTo).toEqual({ kind: "minion" });
    expect(text(fighter).printed).toContain(
      "Attach to a minion of the enemy team's choice. Otherwise, this card gains surge.",
    );
  });

  it("56084 Life Model Decoy: 'Limit 1 per character' and the enemy team's choice of host are data", () => {
    const decoy = get<AttachmentCard>("56084") as unknown as { playRestrictions: unknown; hostChosenBy: unknown };
    expect(decoy.playRestrictions).toEqual({ maxPerHost: 1 });
    expect(decoy.hostChosenBy).toBe("enemyTeam");
    // Neither is applied to text: both sentences are printed as the raw record has them.
    expect(text(get("56084")).printed).toContain(
      "The enemy team attaches this card to a minion or their leader. (Limit 1 per character.)",
    );
    expect(notes("56084")).toContain('RRG 1.8 "Max, Maximum" (p. 28)');
    expect(notes("56084")).toContain("MC56 p. 6");
  });

  it("56191 Resistance Fighter: the host is the enemy team's choice, and the card prints no limit", () => {
    const fighter = get<AttachmentCard>("56191") as unknown as { playRestrictions: unknown; hostChosenBy: unknown };
    expect(fighter.hostChosenBy).toBe("enemyTeam");
    expect(fighter.playRestrictions).toBeUndefined();
    expect(notes("56191")).toContain("MC56 p. 6");
  });

  it("no other Civil War attachment carries a host chooser or a per-host limit", () => {
    const marked = CW_CARDS.filter((c) => c.type === "attachment")
      .map((c) => c as unknown as { id: string; playRestrictions?: unknown; hostChosenBy?: unknown })
      .filter((c) => c.playRestrictions !== undefined || c.hostChosenBy !== undefined)
      .map((c) => c.id);
    expect(marked).toEqual(["56084", "56191"]);
  });

  it("56069 Mark V Armor is a Forced Interrupt, not the cache's Forced Response (registration scan check item 2)", () => {
    const armor = get(`56069`);
    expect(text(armor).printed).toContain("Forced Interrupt: When Iron Man would take any amount of damage");
    expect(text(armor).printed).not.toContain("Forced Response");
    const ids = (armor as unknown as { abilities: { id: string }[] }).abilities.map((a) => a.id);
    expect(ids).toContain("56069.mark-v-armor-forced-interrupt");
    expect(notes("56069")).toContain("Scan 56069.png");
  });

  it("56127 and 56205 Targeted Strike: the Boost reads 'This card gains' (both scan checks)", () => {
    for (const id of ["56127", "56205"]) {
      expect(text(get(id)).printed, id).toContain("This card gains [boost] for each player on your team.");
      expect(text(get(id)).printed, id).not.toContain("The card gains");
      expect(notes(id), id).toContain("Scan");
    }
  });

  it("56209 Recruited by Cap's malformed raw markup still yields an Action label (resistance scan check item 5)", () => {
    expect(text(get("56209")).printed.startsWith("Action: Choose a minion engaged with you")).toBe(true);
    expect((get("56209") as unknown as { abilities: { id: string }[] }).abilities.map((a) => a.id)).toEqual([
      "56209.recruited-by-cap-action",
    ]);
  });

  it("56135 keeps the correct title, the printed misspelling is noted; Captain Marvel's set quantities sum to 14 with the leader", () => {
    expect(get("56135").name).toBe("Alpha Flight Recruit");
    expect(copies(inSet("captain_marvel_leader"))).toBe(11);
    expect(["56098", "56099", "56100", "56101", "56102", "56103", "56104"].map((id) => get(id).quantityInSet)).toEqual([
      1, 1, 2, 2, 2, 1, 1,
    ]);
  });

  it("56106 / 56114 Unregistered Super print an acceleration icon (scan 56106.png read 2026-10-11)", () => {
    for (const id of ["56106", "56114"]) {
      const card = get(id) as unknown as { schemeIcons: string[]; encounterSetIds: string[] };
      expect(get(id).type).toBe("obligation");
      expect(card.schemeIcons).toEqual(["acceleration"]);
      expect(card.encounterSetIds).toHaveLength(1);
    }
  });
});

describe("cw: errata (RRG 1.8 Appendix V, p. 70) keep the printed text beside the current text", () => {
  it("56019 Yellow Jacket (ally): the title and the Response read Yellowjacket", () => {
    const ally = get("56019");
    expect(ally.name).toBe("Yellowjacket");
    expect(text(ally).printed).toContain("After Yellow Jacket enters play");
    expect(text(ally).current).toContain("After Yellowjacket enters play");
    expect(ally.errata?.currentVersion).toBe("RRG 1.8");
    expect(ally.errata?.history?.[0]?.changedFields).toEqual(["name", "text"]);
    expect(ally.errata?.history?.[0]?.note).toContain('The print is "Yellow Jacket"');
  });

  it("56073 Yellow Jacket (minion): the title reads Yellowjacket", () => {
    const minion = get<MinionCard>("56073");
    expect(minion.name).toBe("Yellowjacket");
    expect(minion.errata?.history?.[0]?.changedFields).toEqual(["name"]);
    expect(text(minion).printed).toBe(text(minion).current);
  });

  it("56098 Energy Channel: the cost arrow is gone, 'and Captain Marvel attacks that character'", () => {
    const channel = get<AttachmentCard>("56098");
    expect(text(channel).printed).toContain("remove all of them → Captain Marvel attacks that character");
    expect(text(channel).current).toContain("remove all of them and Captain Marvel attacks that character");
    expect(text(channel).current).not.toContain("→");
    expect(channel.errata?.history?.[0]?.changedFields).toEqual(["text"]);
  });

  it("are exactly these three cards in the box", () => {
    expect(
      CW_CARDS.filter((c) => c.errata !== undefined)
        .map((c) => c.id as string)
        .sort(),
    ).toEqual(["56019", "56073", "56098"]);
  });
});

describe("cw: Tigra and Hulkling", () => {
  it("are the two identities with their obligations and nemesis sets", () => {
    const tigra = get<HeroIdentityCard>("56001a");
    const hulkling = get<HeroIdentityCard>("56029a");
    expect([tigra.hp, tigra.hero.handSize, tigra.alterEgo.handSize, tigra.alterEgo.rec]).toEqual([10, 5, 6, 3]);
    expect([hulkling.hp, hulkling.hero.handSize, hulkling.alterEgo.handSize, hulkling.alterEgo.rec]).toEqual([
      13, 5, 5, 4,
    ]);
    expect([tigra.obligationCardId, tigra.nemesisEncounterSetId]).toEqual(["56023", "tigra_nemesis"]);
    expect([hulkling.obligationCardId, hulkling.nemesisEncounterSetId]).toEqual(["56054", "hulkling_nemesis"]);
    const nemesisOf = (set: string) => CW_ENCOUNTER_SETS.find((s) => s.id === set)!.nemesisOfIdentityId;
    expect([nemesisOf("tigra_nemesis"), nemesisOf("hulkling_nemesis")]).toEqual(["56001a", "56029a"]);
  });

  it("each nemesis set has one nemesis minion: The Hood 56024 and Super Skrull 56055", () => {
    const flagged = (set: string) =>
      CW_CARDS.filter(
        (c) =>
          (c.id as string) !== "" && (c as unknown as { encounterSetIds?: string[] }).encounterSetIds?.includes(set),
      )
        .filter((c) => (c as unknown as { nemesisMinion?: boolean }).nemesisMinion === true)
        .map((c) => c.id as string);
    expect(flagged("tigra_nemesis")).toEqual(["56024"]);
    expect(flagged("hulkling_nemesis")).toEqual(["56055"]);
  });

  it("neither has a deckbuilding exception", () => {
    expect((get<HeroIdentityCard>("56001a") as { deckbuilding?: unknown }).deckbuilding).toBeUndefined();
    expect((get<HeroIdentityCard>("56029a") as { deckbuilding?: unknown }).deckbuilding).toBeUndefined();
  });
});

describe("cw: the four preconstructed scenarios (MC56 pp. 7 and 8, spec 1.4)", () => {
  const expected = [
    {
      id: "registration-iron-man",
      villain: "56059",
      scheme: "56063a",
      set: "iron_man_leader",
      side: "registration",
      modular: ["mighty_avengers", "the_initiative", "maria_hill_modular", "dangerous_recruits"],
      stages: ["56063b", "56064b"],
    },
    {
      id: "registration-captain-marvel",
      villain: "56092",
      scheme: "56063a",
      set: "captain_marvel_leader",
      side: "registration",
      modular: ["cape_killer", "martial_law", "heroes_for_hire", "paladin"],
      stages: ["56096b", "56097b"],
    },
    {
      id: "resistance-captain-america",
      villain: "56137",
      scheme: "56141a",
      set: "captain_america_leader",
      side: "resistance",
      modular: ["new_avengers", "secret_avengers", "namor_modular", "atlanteans"],
      stages: ["56141b", "56142b"],
    },
    {
      id: "resistance-spider-woman",
      villain: "56168",
      scheme: "56141a",
      set: "spider_woman_leader",
      side: "resistance",
      modular: ["spider_man_modular", "defenders", "hells_kitchen", "cloak_and_dagger_modular"],
      stages: ["56172b", "56173b"],
    },
  ];

  it("are four records, one per leader, in this order", () => {
    expect(CW_SCENARIOS.map((s) => s.id as string)).toEqual(expected.map((e) => e.id));
  });

  it.each(expected)("$id", (e) => {
    const s = CW_SCENARIOS.find((x) => x.id === e.id)!;
    expect(s.packCode as string).toBe("cw");
    expect(s.villainCardId as string).toBe(e.villain);
    expect(s.mainSchemeCardId as string).toBe(e.scheme);
    expect(s.encounterSetIds as readonly string[]).toEqual([e.set]);
    expect(s.recommendedModularSetIds as readonly string[]).toEqual(e.modular);
    expect(s.standardEncounterSetIds as readonly string[]).toEqual(["standard"]);
    expect(s.expertEncounterSetIds as readonly string[]).toEqual(["expert"]);
    expect(s.villainStages).toEqual({ standard: [1, 2], expert: [3, 4] });
    expect(s.modularSetCount).toBe(4);
    expect(s.modularSetCountRange).toEqual({ min: 3, max: 4 });
    expect(s.side).toBe(e.side);
    expect(s.mainSchemeStages?.recommended as readonly string[]).toEqual(e.stages);
    const sets = [...CORE_ENCOUNTER_SETS, ...CW_ENCOUNTER_SETS];
    expect(validateScenario(s).errors).toEqual([]);
    expect(validateScenarioEncounterSets(s, sets).errors).toEqual([]);
    expect(validateScenarioMainSchemeStages(s, CW_CARDS, sets).errors).toEqual([]);
    const known = new Set([...CW_CARDS, ...CORE_CARDS].map((c) => c.id as string));
    expect(known.has(s.villainCardId as string)).toBe(true);
    // Every recommended set has the scenario's side.
    for (const id of s.recommendedModularSetIds)
      expect(CW_ENCOUNTER_SETS.find((x) => x.id === id)!.side, id as string).toBe(e.side);
  });
});

describe("cw: the two box starter decks (MC56 p. 18)", () => {
  it("are Tigra / Aggression and Hulkling / Protection, 40 cards each, verified", () => {
    expect(CW_STARTER_DECKS.map((d) => [d.id as string, d.packCode as string, d.identityCardId as string])).toEqual([
      ["tigra-aggression", "cw", "56001a"],
      ["hulkling-protection", "cw", "56029a"],
    ]);
    for (const deck of CW_STARTER_DECKS) {
      expect(deck.cards.reduce((n, e) => n + e.quantity, 0)).toBe(40);
      expect(deck.provenance.verified).toBe(true);
      expect(validateStarterDeck(deck).errors, deck.id as string).toEqual([]);
      const known = new Map([...CW_CARDS, ...CORE_CARDS].map((c) => [c.id as string, c]));
      for (const entry of deck.cards) {
        const card = known.get(entry.cardId as string);
        expect(card, entry.cardId as string).toBeDefined();
        expect(entry.quantity).toBeLessThanOrEqual((card as AnyCard).quantityInSet);
      }
    }
    expect(CW_STARTER_DECKS.map((d) => d.aspects)).toEqual([["aggression"], ["protection"]]);
  });

  it("split 15 hero / 21 aspect / 4 basic", () => {
    const split = (deck: (typeof CW_STARTER_DECKS)[number]) => {
      const out = { hero: 0, aspect: 0, basic: 0 };
      for (const e of deck.cards) {
        const card = get(e.cardId as string) as unknown as { aspect?: string };
        const key = card.aspect === "basic" ? "basic" : card.aspect?.startsWith("hero") ? "hero" : "aspect";
        out[key] += e.quantity;
      }
      return out;
    };
    expect(CW_STARTER_DECKS.map(split)).toEqual([
      { hero: 15, aspect: 21, basic: 4 },
      { hero: 15, aspect: 21, basic: 4 },
    ]);
  });
});
