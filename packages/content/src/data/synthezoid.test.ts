import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AnyCard, AttachmentCard, SideSchemeCard } from "../schema/index.js";
import { CW_CARDS } from "./cw/cards.js";
import { CW_PACK } from "./cw/packs.js";
import { HERCULES_PACK } from "./hercules/packs.js";
import {
  PLAYABLE_CARDS,
  SYNTHEZOID_CARDS,
  SYNTHEZOID_CYCLE,
  SYNTHEZOID_ENCOUNTER_SETS,
  SYNTHEZOID_PACK,
  SYNTHEZOID_SCENARIOS,
  WAVE10_ENCOUNTER_SETS,
  WAVE10_SCENARIOS,
  WAVE11_CARDS,
  WAVE11_ENCOUNTER_SETS,
  WAVE11_SCENARIOS,
} from "./index.js";
import { SYNTHEZOID_PROVENANCE } from "./synthezoid/provenance.js";
import { WONDER_MAN_PACK } from "./wonder_man/packs.js";

/**
 * Synthezoid Smackdown (`synthezoid`, MC57): where it sits in release order (the owner's decision of 2026-10-19: after
 * Civil War, before Wonder Man, never with Fear No Evil; docs/phase7-synthezoid.md section 1.2, tests T1 and T2) and
 * the pack's curated corrections (T6 and T7; `scripts/marvelcdb/curation/synthezoid.ts`).
 */
const packOf = (card: AnyCard): string => card.setCode as string;
const firstIndex = (cards: readonly AnyCard[], pack: string) => cards.findIndex((c) => packOf(c) === pack);
const lastIndex = (cards: readonly AnyCard[], pack: string) => cards.map(packOf).lastIndexOf(pack);
const byId = new Map(SYNTHEZOID_CARDS.map((c) => [c.id as string, c]));
const get = <T extends AnyCard>(id: string): T => {
  const card = byId.get(id);
  if (!card) throw new Error(`no card ${id}`);
  return card as T;
};
const text = (card: AnyCard) => (card as { text: { printed: string; current: string } }).text;

describe("T1: the pack's cycle and release date", () => {
  it("is cycle 10, released after Civil War and before Wonder Man and Hercules", () => {
    expect(SYNTHEZOID_CYCLE.id as string).toBe("cycle10");
    expect(SYNTHEZOID_CYCLE.order).toBe(10);
    expect(SYNTHEZOID_PACK.cycleId as string).toBe("cycle10");
    expect(SYNTHEZOID_PACK.releaseDate! > CW_PACK.releaseDate!).toBe(true);
    expect(SYNTHEZOID_PACK.releaseDate! < WONDER_MAN_PACK.releaseDate!).toBe(true);
    expect(SYNTHEZOID_PACK.releaseDate! < HERCULES_PACK.releaseDate!).toBe(true);
  });

  it("is in no WAVE11_* export (those hold Fear No Evil and the later packs)", () => {
    expect(WAVE11_CARDS.some((c) => packOf(c) === "synthezoid")).toBe(false);
    const sets = new Set(SYNTHEZOID_ENCOUNTER_SETS.map((s) => s.id as string));
    expect(WAVE11_ENCOUNTER_SETS.some((s) => sets.has(s.id as string))).toBe(false);
    expect(WAVE11_SCENARIOS.some((s) => s.packCode === "synthezoid")).toBe(false);
  });
});

describe("T2: the pool order", () => {
  it("lists the pack's cards after the last Civil War card, before the first Wonder Man card, and Fear No Evil after", () => {
    const first = firstIndex(PLAYABLE_CARDS, "synthezoid");
    expect(first).toBeGreaterThan(-1);
    expect(first).toBeGreaterThan(lastIndex(PLAYABLE_CARDS, "cw"));
    expect(lastIndex(PLAYABLE_CARDS, "synthezoid")).toBeLessThan(firstIndex(PLAYABLE_CARDS, "wonder_man"));
    expect(firstIndex(PLAYABLE_CARDS, "fne")).toBeGreaterThan(lastIndex(PLAYABLE_CARDS, "synthezoid"));
    // The pack is contiguous: nothing from another pack sits inside its run.
    const run = PLAYABLE_CARDS.slice(first, lastIndex(PLAYABLE_CARDS, "synthezoid") + 1);
    expect(run.every((c) => packOf(c) === "synthezoid")).toBe(true);
    expect(run).toHaveLength(SYNTHEZOID_CARDS.length);
  });

  it("orders the Wave 10 encounter sets and scenarios the same way", () => {
    const setPacks = WAVE10_ENCOUNTER_SETS.map((s) => (s.packCodes as readonly string[])[0]);
    expect(setPacks.indexOf("synthezoid")).toBeGreaterThan(setPacks.lastIndexOf("cw"));
    expect(setPacks.lastIndexOf("synthezoid")).toBeLessThan(setPacks.indexOf("wonder_man"));
    expect(WAVE10_SCENARIOS.map((s) => s.id as string)).toEqual([
      "registration-iron-man",
      "registration-captain-marvel",
      "resistance-captain-america",
      "resistance-spider-woman",
      "registration-she-hulk",
      "resistance-vision",
    ]);
  });
});

describe("the pack's content", () => {
  it("emits two scenarios, one per side, each with its own leader and a four-set recommendation", () => {
    expect(SYNTHEZOID_SCENARIOS.map((s) => [s.id, s.side, s.villainCardId, s.packCode])).toEqual([
      ["registration-she-hulk", "registration", "57001", "synthezoid"],
      ["resistance-vision", "resistance", "57040", "synthezoid"],
    ]);
    for (const s of SYNTHEZOID_SCENARIOS) expect(s.recommendedModularSetIds).toHaveLength(4);
  });

  it("gives every set a side, the two Standard PvP copies competitive-only", () => {
    expect(SYNTHEZOID_ENCOUNTER_SETS).toHaveLength(14);
    for (const s of SYNTHEZOID_ENCOUNTER_SETS) expect(s.side).toBeDefined();
    expect(SYNTHEZOID_ENCOUNTER_SETS.filter((s) => s.competitiveOnly).map((s) => s.id)).toEqual([
      "standard_pvp_registration_mc57",
      "standard_pvp_resistance_mc57",
    ]);
  });

  it("holds every raw record: 81 top-level records, 88 faces, none dropped", () => {
    const raw = JSON.parse(readFileSync(new URL("../../raw/marvelcdb/synthezoid.json", import.meta.url), "utf8")) as {
      cards: readonly { code: string; linked_card?: { code: string } }[];
    };
    expect(raw.cards).toHaveLength(81);
    const faces = raw.cards.flatMap((c) => [c.code, ...(c.linked_card ? [c.linked_card.code] : [])]);
    expect(faces).toHaveLength(88);
    // The merged faces: a main scheme card holds all four of its stage faces, Intangible is Dense's flip side, and the
    // four leader stages are one card each (57001 etc. are stages of one villain card).
    const merged = new Set(["57005b", "57006a", "57006b", "57044b", "57045a", "57045b", "57046b"]);
    const leaderStages = new Set(["57002", "57003", "57004", "57041", "57042", "57043"]);
    for (const code of faces)
      if (!merged.has(code) && !leaderStages.has(code)) expect(byId.has(code), `card ${code}`).toBe(true);
  });
});

describe("T6: errata keep the printed text", () => {
  it("Moon Knight 57065 adds the once per phase limit to the current text only", () => {
    const card = get("57065");
    const t = text(card);
    expect(t.printed).not.toContain("Limit once per phase");
    expect(t.current).toBe(`${t.printed} (Limit once per phase.)`);
    expect((card as { errata?: { currentVersion: string } }).errata?.currentVersion).toBe("RRG 1.8");
  });

  it("Phased Out 57076 reads Hero Action or Hero Response now, Hero Response or Hero Interrupt as printed", () => {
    const card = get("57076");
    const t = text(card);
    expect(t.printed).toContain('"Hero Response" or "Hero Interrupt"');
    expect(t.current).toContain('"Hero Action" or "Hero Response"');
    expect(t.current).not.toContain("Hero Interrupt");
    expect((card as { errata?: { currentVersion: string } }).errata?.currentVersion).toBe("RRG 1.8");
  });
});

describe("T7: corrections to the transcription", () => {
  it("Choosing Sides starts with 4 threat per player on both reprints", () => {
    for (const id of ["57039a", "57081a"])
      expect(get<SideSchemeCard>(id).startingThreat).toEqual({ base: 0, perPlayer: 4 });
  });

  it("Dense and Intangible are one permanent card with no form keyword, and keep the printed text", () => {
    const dense = get<AttachmentCard>("57046a");
    expect(dense.keywords.map((k) => k.name)).toEqual(["permanent"]);
    expect(dense.flipSide?.keywords.map((k) => k.name)).toEqual(["permanent"]);
    expect(text(dense).printed).toBe("Permanent. Mass form.");
    expect(dense.flipSide?.text.printed).toContain("Mass form.");
    expect(dense.attachesTo).toEqual({ kind: "villain" });
  });

  it("the PvP reprints carry duplicateOfCardId naming Civil War's cards, in two side-tagged sets", () => {
    const pairs: readonly (readonly [string, string])[] = [
      ["57036", "56125"],
      ["57037", "56126"],
      ["57038", "56127"],
      ["57039a", "56128a"],
      ["57078", "56203"],
      ["57079", "56204"],
      ["57080", "56205"],
      ["57081a", "56206a"],
    ];
    const cw = new Set(CW_CARDS.map((c) => c.id as string));
    for (const [id, original] of pairs) {
      const p = SYNTHEZOID_PROVENANCE.find((x) => (x.cardId as string) === id)!;
      expect(p.duplicateOfCardId as string).toBe(original);
      expect(cw.has(original)).toBe(true);
      const sets = (get(id) as unknown as { encounterSetIds: readonly string[] }).encounterSetIds;
      expect(sets).toEqual([id < "57060" ? "standard_pvp_registration_mc57" : "standard_pvp_resistance_mc57"]);
    }
  });

  it("Mad Jack's Platform's host is the enemy team's choice of minion", () => {
    expect(get<AttachmentCard>("57029").hostChosenBy).toBe("enemyTeam");
  });
});
