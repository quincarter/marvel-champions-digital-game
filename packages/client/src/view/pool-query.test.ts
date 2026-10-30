import { describe, expect, test } from "vitest";
import { CORE_CARDS, type AnyCard } from "@mc/content";
import { browsablePool, identityOptions, type PackInfo } from "./deck-builder-model.js";
import { matchesClauses, parsePoolQuery } from "./pool-query.js";

const spiderMan = identityOptions(CORE_CARDS).find((c) => c.name === "Spider-Man")!;
const PACKS: readonly PackInfo[] = [{ code: "core", name: "Core Set", cycleId: "core", cycleName: "Core Set" }];
const pool = (text: string): readonly AnyCard[] =>
  browsablePool(CORE_CARDS, spiderMan, ["justice"], { text }, "name", PACKS);
const costOf = (card: AnyCard): number | null => ("cost" in card && typeof card.cost === "number" ? card.cost : null);

describe("parsePoolQuery (issue #531)", () => {
  test("splits field terms from free words, with aliases, quotes and alternatives", () => {
    expect(parsePoolQuery('spider o>1 t:ally|event k:"s.h.i.e.l.d. agent" web')).toEqual({
      text: "spider web",
      clauses: [
        { field: "cost", op: ">", values: ["1"] },
        { field: "type", op: ":", values: ["ally", "event"] },
        { field: "trait", op: ":", values: ["s.h.i.e.l.d. agent"] },
      ],
    });
    expect(parsePoolQuery("rp=1 kw!guard").clauses).toEqual([
      { field: "physical", op: ":", values: ["1"] },
      { field: "keyword", op: "!", values: ["guard"] },
    ]);
  });

  test("an unknown field, an empty value or a comparison on a word field stays a free word", () => {
    expect(parsePoolQuery("zz:1 o: t>ally")).toEqual({ text: "zz:1 o: t>ally", clauses: [] });
  });
});

describe("search terms filter the pool", () => {
  test("cost compares numbers; a costless resource never matches a cost term", () => {
    const cheap = pool("o<2");
    expect(cheap.length).toBeGreaterThan(0);
    expect(cheap.every((c) => costOf(c) !== null && costOf(c)! < 2)).toBe(true);
    expect(pool("o:2").every((c) => costOf(c) === 2)).toBe(true);
    expect(pool("o>=0").some((c) => c.type === "resource")).toBe(false);
  });

  test("type, trait and keyword terms, alone and combined with free words", () => {
    expect(pool("t:ally").every((c) => c.type === "ally")).toBe(true);
    const shield = pool("k:shield");
    expect(shield.length).toBeGreaterThan(0);
    expect(
      shield.every((c) => "traits" in c && c.traits.some((t) => String(t).toLowerCase().includes("s.h.i.e.l.d"))),
    ).toBe(true);
    const allyNoShield = pool("t:ally k!shield");
    expect(allyNoShield.some((c) => shield.includes(c))).toBe(false);
    const withUses = CORE_CARDS.filter((c) => "keywords" in c && c.keywords.some((k) => k.name === "uses"));
    expect(withUses.length).toBeGreaterThan(0);
    expect(pool("kw:uses").every((c) => "keywords" in c && c.keywords.some((k) => k.name === "uses"))).toBe(true);
  });

  test("resource icons count a resource card's own icons", () => {
    const physical = pool("rp:1");
    expect(physical.length).toBeGreaterThan(0);
    const icons = (c: AnyCard) =>
      ("producesIcons" in c ? c.producesIcons : "resourceIcons" in c ? c.resourceIcons : {}) as Record<string, number>;
    expect(physical.every((c) => icons(c).physical === 1)).toBe(true);
    // Strength produces two physical resources.
    expect(pool("rp:2").map((c) => c.name)).toContain("Strength");
  });

  test("aspect, pack, unique and ally stats", () => {
    expect(pool("f:hero").every((c) => "aspect" in c && String(c.aspect).startsWith("hero:"))).toBe(true);
    expect(pool("e:core").length).toBe(pool("").length);
    expect(pool("e:nope")).toEqual([]);
    expect(pool("u:1").every((c) => c.unique)).toBe(true);
    expect(pool("t:ally thw>=2").every((c) => "thw" in c && typeof c.thw === "number" && c.thw >= 2)).toBe(true);
  });

  test("matchesClauses: every clause must hold", () => {
    const ally = CORE_CARDS.find((c) => c.type === "ally" && "cost" in c && c.cost === 3)!;
    expect(matchesClauses(ally, parsePoolQuery("t:ally o:3").clauses, PACKS)).toBe(true);
    expect(matchesClauses(ally, parsePoolQuery("t:ally o:2").clauses, PACKS)).toBe(false);
  });
});
