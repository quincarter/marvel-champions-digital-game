import { describe, expect, it } from "vitest";
import { GLOSSARY_ENTRIES, KNOWN_KEYWORD_NAMES } from "@mc/content";
import { POOL_CARDS } from "../content/pool-cards.js";
import { POOL_HERO_SHELF_PACKS } from "../content/pool.js";
import { UNLOCK_WAVES } from "../progression/unlocks.js";
import { MECHANIC_TRYITS } from "../guide/mechanic-tryits.js";
import {
  BOXES,
  boxPageContentLayout,
  boxPageFocusOrder,
  boxPageHeaderLayout,
  boxPageOf,
  originNoteOf,
  boxPageRowRects,
  boxPageSections,
  boxPages,
} from "./new-in-box-model.js";
import { rectsOverlap } from "./layout.js";

const allOpen = (): boolean => true;
const page = (id: string) => boxPages(allOpen).find((p) => p.id === id)!;
const ids = (rows: readonly { id: string }[]) => rows.map((r) => r.id).sort();

describe("boxPages", () => {
  it("has a page for every box after the Core Set that introduced something, in release order", () => {
    expect(boxPages(allOpen).map((p) => p.id)).toEqual([
      "core",
      "wave1",
      "cycle1",
      "cycle3",
      "cycle4",
      "cycle5",
      "cycle6",
      "mojo",
    ]);
  });

  it("names pages after the box and never says wave", () => {
    for (const p of boxPages(allOpen)) {
      expect(p.title).toBe(p.id === "core" ? "Core rules added later" : `New in ${p.name}`);
      expect(`${p.title} ${p.summary}`.toLowerCase()).not.toContain("wave");
    }
    expect(page("cycle6").title).toBe("New in Mutant Genesis");
    expect(page("mojo").title).toBe("New in MojoMania");
  });

  it("names every cycle box the way the unlock path does, and every box's unlock key is on the path", () => {
    for (const box of BOXES) {
      const wave = UNLOCK_WAVES.find((w) => w.cycleId === box.unlockKey);
      expect(wave, `${box.id} unlock key ${box.unlockKey}`).toBeDefined();
      if (box.id.startsWith("cycle")) expect(box.name).toBe(wave!.name);
    }
  });

  it("lists Mutant Genesis' new entries by group", () => {
    const p = page("cycle6");
    expect(ids(p.keywords)).toEqual(["amplify", "find", "teamwork", "temporary"]);
    expect(ids(p.heroMechanics)).toEqual([
      "counters",
      "labeledAbility",
      "phoenixForce",
      "tacticUpgrades",
      "touched",
      "unusualCosts",
      "weatherDeck",
    ]);
    expect(ids(p.scenarioMechanics)).toEqual([
      "campaignRoles",
      "encounterDeckEmpty",
      "futurePast",
      "mansionAttack",
      "robertKelly",
      "wideawake",
    ]);
  });

  it("lists MojoMania's new entries, all scenario mechanics", () => {
    const p = page("mojo");
    expect(p.keywords).toEqual([]);
    expect(p.heroMechanics).toEqual([]);
    expect(ids(p.scenarioMechanics)).toEqual([
      "longshot",
      "ratingsCounters",
      "showDeck",
      "threatOnCharacters",
      "wheelOfGenres",
    ]);
  });

  it("lists every non-Core entry whose box is in the pool exactly once, and none of the Core ones", () => {
    const listed = boxPages(allOpen)
      .filter((p) => p.id !== "core")
      .flatMap((p) => [...p.keywords, ...p.heroMechanics, ...p.scenarioMechanics]);
    const expected = GLOSSARY_ENTRIES.filter((e) => e.introducedIn !== "core" && e.introducedIn !== "later");
    expect(ids(listed)).toEqual(ids(expected));
    expect(listed.some((row) => GLOSSARY_ENTRIES.find((e) => e.id === row.id)!.introducedIn === "core")).toBe(false);
  });

  it("hides a locked box and keeps the rest; MojoMania opens with Mutant Genesis", () => {
    const onlyEarly = boxPages((key) => key === "core" || key === "wave1" || key === "cycle1");
    expect(onlyEarly.map((p) => p.id)).toEqual(["core", "wave1", "cycle1"]);
    expect(boxPages((key) => key === "cycle6" || key === "core").map((p) => p.id)).toEqual(["core", "cycle6", "mojo"]);
    // With only Core open there is nothing added later to list, so no Core page either.
    expect(boxPages((key) => key === "core")).toEqual([]);
    expect(boxPages(() => false)).toEqual([]);
  });

  it("gives a box with no tagged entries and no lesson no page", () => {
    expect(boxPageOf(BOXES[1]!, [], [])).toBeNull();
  });

  it("summarizes entries and Try-its", () => {
    expect(page("cycle1").summary).toMatch(/^\d+ new entries$/);
    const withLessons = boxPageOf(
      BOXES.find((b) => b.id === "cycle6")!,
      GLOSSARY_ENTRIES,
      [{ id: "storm", box: "cycle6", title: "Storm", tagline: "x" }],
    )!;
    expect(withLessons.summary).toMatch(/ · 1 Try-it$/);
    expect(withLessons.lessons.map((l) => l.id)).toEqual(["storm"]);
  });

  it("lists every Try-it lesson under a box that has a page", () => {
    for (const lesson of MECHANIC_TRYITS) {
      expect(boxPages(allOpen).some((p) => p.id === lesson.box && p.lessons.some((l) => l.id === lesson.id))).toBe(
        true,
      );
    }
  });
});

describe("entries that apply to Core cards too", () => {
  const entry = (id: string) => GLOSSARY_ENTRIES.find((e) => e.id === id)!;

  it("appear on their box's page and on the Core page, each linking to the other", () => {
    const home = page("cycle6").heroMechanics.find((r) => r.id === "counters")!;
    expect(home.link).toEqual({ label: "Also a Core rule", boxId: "core" });
    const onCore = page("core").heroMechanics.find((r) => r.id === "counters")!;
    expect(onCore.link).toEqual({ label: "Added with Mutant Genesis", boxId: "cycle6" });
    expect(page("core").scenarioMechanics.map((r) => r.id)).toEqual(["encounterDeckEmpty"]);
    expect(page("cycle1").keywords.find((r) => r.id === "setup")!.link?.boxId).toBe("core");
    expect(page("core").keywords.find((r) => r.id === "setup")!.link?.label).toBe("Added with The Rise of Red Skull");
  });

  it("do not link entries that only belong to their box", () => {
    expect(page("cycle6").heroMechanics.find((r) => r.id === "touched")!.link).toBeUndefined();
  });

  it("list on the Core page only while their own box is unlocked", () => {
    const core = boxPages((key) => key === "core" || key === "cycle1").find((p) => p.id === "core")!;
    expect([...core.keywords, ...core.heroMechanics, ...core.scenarioMechanics].map((r) => r.id)).toEqual(["setup"]);
  });

  it("carry the line the glossary entry view shows, linking to that box", () => {
    expect(originNoteOf(entry("counters"))).toEqual({
      text: "Added with Mutant Genesis · applies to Core cards too",
      boxId: "cycle6",
    });
    expect(originNoteOf(entry("touched"))).toBeNull();
  });

  it("give a linked row its own link rect and focus stop", () => {
    const p = page("cycle6");
    const layout = boxPageContentLayout(1440, p);
    const order = boxPageFocusOrder(p);
    expect(order).toContain("link:counters");
    expect(order.indexOf("link:counters")).toBe(order.indexOf("entry:counters") + 1);
    const hero = layout.sections.find((s) => s.section.kind === "hero")!;
    const i = hero.section.rows.findIndex((r) => r.id === "counters");
    const link = hero.linkRects[i]!;
    expect(link.y).toBeGreaterThanOrEqual(hero.rows[i]!.y);
    expect(link.y + link.height).toBeLessThanOrEqual(hero.rows[i]!.y + hero.rows[i]!.height);
    expect(hero.linkRects[hero.section.rows.findIndex((r) => r.id === "touched")]).toBeNull();
    expect(layout.scrollIndexByStop.has("link:counters")).toBe(true);
  });
});

describe("boxPageSections / focus order / layout", () => {
  it("keeps only non-empty sections in reading order", () => {
    expect(boxPageSections(page("cycle6")).map((s) => s.kind)).toContain("keywords");
    expect(boxPageSections(page("mojo")).map((s) => s.kind)).toEqual([
      "scenario",
      ...(page("mojo").lessons.length ? ["tryit"] : []),
    ]);
  });

  it("focus order is close, then every row in reading order", () => {
    const p = page("cycle6");
    const order = boxPageFocusOrder(p);
    expect(order[0]).toBe("close");
    const rows = [...p.keywords, ...p.heroMechanics, ...p.scenarioMechanics];
    expect(order).toHaveLength(1 + rows.length + rows.filter((r) => r.link).length + p.lessons.length);
    expect(order[1]).toBe(`entry:${p.keywords[0]!.id}`);
  });

  for (const [w, h] of [
    [1440, 900],
    [390, 844],
    [844, 390],
  ] as const) {
    it(`lays out every page without overlap or running outside the column at ${w}x${h}`, () => {
      for (const p of boxPages(allOpen)) {
        const layout = boxPageContentLayout(w, p);
        const rects = boxPageRowRects(layout);
        rects.forEach((r, i) => {
          expect(r.x).toBeGreaterThanOrEqual(0);
          expect(r.x + r.width).toBeLessThanOrEqual(w);
          for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(r, rects[j]!)).toBe(false);
        });
        expect(layout.heights.reduce((a, b) => a + b, 0)).toBe(layout.totalHeight);
        for (const stop of boxPageFocusOrder(p).slice(1)) expect(layout.scrollIndexByStop.has(stop)).toBe(true);
      }
      const header = boxPageHeaderLayout(w, h);
      expect(header.close.x + header.close.width).toBeLessThan(header.title.x);
    });
  }
});

describe("introducedIn is derived from card data, not guessed", () => {
  const rel = new Map(
    POOL_HERO_SHELF_PACKS.map((p, i) => [p.code, { i, date: p.releaseDate ?? "", cycleId: p.cycleId }]),
  );
  const boxOfPack = (code: string): string => (code === "mojo" ? "mojo" : rel.get(code)!.cycleId);
  const earlier = (a: string, b: string): boolean => {
    const x = rel.get(a)!;
    const y = rel.get(b)!;
    return x.date === y.date ? x.i < y.i : x.date < y.date;
  };
  const texts = (o: unknown, acc: string[] = []): string[] => {
    if (Array.isArray(o)) o.forEach((x) => texts(x, acc));
    else if (o && typeof o === "object") {
      for (const [k, v] of Object.entries(o)) {
        if ((k === "printed" || k === "current") && typeof v === "string") acc.push(v);
        else texts(v, acc);
      }
    }
    return acc;
  };
  const keywordsOf = (card: unknown): string[] => {
    const names: string[] = [];
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === "object") {
        for (const [k, v] of Object.entries(o)) {
          if (k === "keywords" && Array.isArray(v)) for (const kw of v) names.push((kw as { name: string }).name);
          else walk(v);
        }
      }
    };
    walk(card);
    return names;
  };

  // A few keywords are printed only as "gains piercing" style clauses or icons, never as a structured keyword instance.
  const TEXT_ONLY: Record<string, RegExp> = {
    overkill: /\boverkill\b/i,
    piercing: /\bpiercing\b/i,
    ranged: /\branged\b/i,
    amplify: /\bamplify\b/i,
    find: /\bfind\b/i,
  };

  const firstPackOf = (keyword: string): string | undefined => {
    let best: string | undefined;
    for (const card of POOL_CARDS as readonly { setCode: string }[]) {
      if (!rel.has(card.setCode)) continue;
      const hit = TEXT_ONLY[keyword]
        ? texts(card).some((t) => TEXT_ONLY[keyword]!.test(t))
        : keywordsOf(card).includes(keyword);
      if (hit && (best === undefined || earlier(card.setCode, best))) best = card.setCode;
    }
    return best;
  };

  it("every keyword the pool prints is tagged with the box of the earliest pack that prints it", () => {
    for (const name of KNOWN_KEYWORD_NAMES) {
      const entry = GLOSSARY_ENTRIES.find((e) => e.id === name)!;
      const first = firstPackOf(name);
      if (first === undefined) {
        // Nothing in the pool prints it: it belongs to a box the app doesn't have yet.
        expect(entry.introducedIn, `${name} is unused in the pool`).toBe("later");
      } else {
        expect(entry.introducedIn, `${name} first appears in ${first}`).toBe(boxOfPack(first));
      }
    }
  });
});
