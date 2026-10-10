import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateCard, validateScenario, validateScenarioEncounterSets } from "../schema/index.js";
import { CORE_ENCOUNTER_SETS } from "./core/encounterSets.js";
import { TT_CARDS } from "./tt/cards.js";
import { TT_ENCOUNTER_SETS } from "./tt/encounterSets.js";
import { TT_CYCLE, TT_PACK } from "./tt/packs.js";
import { TT_SCENARIOS } from "./tt/scenarios.js";

interface RawRecord {
  readonly code: string;
  readonly type_code: string;
}
const raw = JSON.parse(readFileSync(new URL("../../raw/marvelcdb/tt.json", import.meta.url), "utf8")) as {
  cards: readonly RawRecord[];
};

const byId = new Map(TT_CARDS.map((c) => [c.id as string, c]));
const count = (type: string) => TT_CARDS.filter((c) => c.type === type).length;

describe("tt data (MC55, cycle 9): cards", () => {
  it("is the Trickster Takeover pack in cycle 9, released 2025-08-15", () => {
    expect(TT_CYCLE.name).toBe("Agents of S.H.I.E.L.D.");
    expect(TT_CYCLE.order).toBe(9);
    expect(TT_PACK.name).toBe("Trickster Takeover");
    expect(TT_PACK.releaseDate).toBe("2025-08-15");
  });

  it("passes validateCard() on every card, with no duplicate id", () => {
    for (const card of TT_CARDS) expect(validateCard(card).errors, card.id as string).toEqual([]);
    expect(byId.size).toBe(TT_CARDS.length);
  });

  it("covers the 66 raw top-level records (the three Enchantress villains and the two Enchantress main scheme stages merge)", () => {
    expect(raw.cards.length).toBe(66);
    const rawByType = (type: string) => raw.cards.filter((r) => r.type_code === type).length;
    expect(count("minion")).toBe(rawByType("minion"));
    expect(count("side_scheme")).toBe(rawByType("side_scheme"));
    expect(count("attachment")).toBe(rawByType("attachment"));
    expect(count("treachery")).toBe(rawByType("treachery"));
    expect(count("environment")).toBe(rawByType("environment"));
    expect(count("ally")).toBe(rawByType("ally"));
    // Enchantress I to III are one three-stage card; Loki, God of Lies and the four Avatars are five two-sided cards.
    expect(rawByType("villain")).toBe(8);
    expect(count("villain")).toBe(6);
    // Prime Real Estate and Sovereign Sorceress are one two-stage card; Worlds Collide and Mischief and Mayhem one each.
    expect(rawByType("main_scheme")).toBe(4);
    expect(count("main_scheme")).toBe(3);
    expect(TT_CARDS.length).toBe(63);
  });

  it("has no hero, player card, obligation or nemesis cards", () => {
    for (const type of ["hero_identity", "event", "support", "upgrade", "resource", "obligation", "player_side_scheme"])
      expect(count(type), type).toBe(0);
  });
});

describe("tt data: per group values (MC55 insert p. 4)", () => {
  it("55028b Worlds Collide's target threat is 2 per group, with no starting threat or acceleration", () => {
    const card = byId.get("55028a");
    if (card?.type !== "main_scheme") throw new Error("55028a is not a main scheme");
    const stage = card.stages[0];
    expect(card.stages).toHaveLength(1);
    expect(stage?.targetThreat).toEqual({ base: 0, perPlayer: 0, perGroup: 2 });
    expect(stage?.dashedValues).toEqual(["startingThreat", "acceleration"]);
  });

  it("55041 The Mangog has 10 hit points per group, not per hero", () => {
    const card = byId.get("55041");
    if (card?.type !== "minion") throw new Error("55041 is not a minion");
    expect([card.hp, card.hpPerGroup, card.hpPerPlayer]).toEqual([10, true, undefined]);
  });

  it("55046 Door Between Worlds starts with 7 threat per group, not per hero", () => {
    const card = byId.get("55046");
    if (card?.type !== "side_scheme") throw new Error("55046 is not a side scheme");
    expect(card.startingThreat).toEqual({ base: 0, perPlayer: 0, perGroup: 7 });
  });

  it("no other card carries a per group value", () => {
    const carriers = TT_CARDS.filter(
      (c) => JSON.stringify(c).includes("perGroup") || JSON.stringify(c).includes("hpPerGroup"),
    );
    expect(carriers.map((c) => c.id as string).sort()).toEqual(["55028a", "55041", "55046"]);
  });
});

describe("tt data: God of Lies villains and schemes", () => {
  it("Loki, God of Lies is one two-sided card with the same title on both faces", () => {
    const card = byId.get("55027a");
    if (card?.type !== "villain") throw new Error("55027a is not a villain");
    expect(card.sides.map((s) => s.name)).toEqual(["Loki, God of Lies", "Loki, God of Lies"]);
    expect(card.sides[0]?.stages[0]?.hp).toEqual({ base: 0, perPlayer: 20 });
  });

  it("each Avatar of Loki flips to Fading Figment (infinite hit points, trait Illusion)", () => {
    for (const id of ["55029a", "55030a", "55031a", "55032a"]) {
      const card = byId.get(id);
      if (card?.type !== "villain") throw new Error(`${id} is not a villain`);
      expect(card.sides[1]?.name, id).toBe("Fading Figment");
      expect(card.sides[1]?.stages[0]?.hp, id).toEqual({ base: 0, perPlayer: 0 });
      expect(card.sides[1]?.stages[0]?.infiniteHp, id).toBe(true);
      expect(card.sides[1]?.stages[0]?.traits.map(String), id).toEqual(["ILLUSION"]);
    }
  });

  it("Dark Scepter and Intense Focus attach to the Avatar of Loki villain; Hypnotic Gaze to each identity", () => {
    const host = { kind: "qualified", category: "villain", trait: "AVATAR OF LOKI" };
    for (const id of ["55034a", "55036"]) {
      const card = byId.get(id);
      expect(card?.type === "attachment" && card.attachesTo, id).toEqual(host);
    }
    for (const id of ["55007a", "55008a", "55009a", "55010a", "55011a"]) {
      const card = byId.get(id);
      expect(card?.type === "attachment" && card.attachesTo, id).toEqual({ kind: "yourIdentity" });
    }
  });
});

describe("tt data: scenarios (MC55 pp. 6 to 21)", () => {
  const sets = [...TT_ENCOUNTER_SETS, ...CORE_ENCOUNTER_SETS];

  it("declares enchantress and god-of-lies, each valid and resolving its sets", () => {
    expect(TT_SCENARIOS.map((s) => s.id as string)).toEqual(["enchantress", "god-of-lies"]);
    for (const s of TT_SCENARIOS) {
      expect(validateScenario(s).errors, s.id as string).toEqual([]);
      expect(validateScenarioEncounterSets(s, sets).errors, s.id as string).toEqual([]);
    }
  });

  it("names villain faces and main schemes that exist, and every set-aside card", () => {
    for (const s of TT_SCENARIOS) {
      const named = [
        s.villainCardId,
        s.mainSchemeCardId,
        ...(s.setAsideVillainCardIds ?? []),
        ...(s.setAsideCardIds ?? []),
        ...(s.neutralCards ? [s.neutralCards.villainCardId, s.neutralCards.mainSchemeCardId] : []),
      ];
      for (const id of named) expect(byId.has(id as string), `${s.id}: ${id}`).toBe(true);
    }
  });

  it("Enchantress: villain I and II (II and III in expert), Trickster Magic as the one modular set", () => {
    const s = TT_SCENARIOS.find((x) => (x.id as string) === "enchantress");
    expect(s?.villainStages).toEqual({ standard: [1, 2], expert: [2, 3] });
    expect(s?.villainCardId as string).toBe("55001");
    expect(s?.mainSchemeCardId as string).toBe("55004a");
    expect(s?.modularSetCount).toBe(1);
    expect(s?.recommendedModularSetIds.map(String)).toEqual(["trickster_magic"]);
    const villain = byId.get("55001");
    expect(villain?.type === "villain" && villain.sides[0]?.stages.map((st) => st.stageNumber)).toEqual([1, 2, 3]);
  });

  it("God of Lies: an Avatar in play by Setup, the other three set aside, Loki and Worlds Collide neutral", () => {
    const s = TT_SCENARIOS.find((x) => (x.id as string) === "god-of-lies");
    expect(s?.villainCardId as string).toBe("55029a");
    expect((s?.setAsideVillainCardIds ?? []).map(String)).toEqual(["55030a", "55031a", "55032a"]);
    expect(s?.startingVillain).toBe("bySetup");
    expect(s?.mainSchemeCardId as string).toBe("55033a");
    expect(s?.neutralCards).toEqual({ villainCardId: "55027a", mainSchemeCardId: "55028a" });
    expect(s?.setAsideCardIds).toBeUndefined();
    expect(s?.victory).toBe("cardAbility");
    expect(s?.modularSetCount).toBe(1);
    expect(s?.recommendedModularSetIds.map(String)).toEqual(["trickster_magic"]);
    expect(s?.separateGameAreas).toBeUndefined();
  });
});
