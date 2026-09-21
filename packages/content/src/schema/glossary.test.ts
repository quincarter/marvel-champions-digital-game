import { describe, expect, it } from "vitest";
import {
  GLOSSARY_ENTRIES,
  KNOWN_KEYWORD_NAMES,
  STATUS_NAMES,
  glossaryEntriesForKeywords,
  glossaryEntry,
  type GlossaryEntry,
} from "./index.js";
import { CORE_CARDS } from "../data/core/cards.js";
import type { AllyCard, HeroIdentityCard, MinionCard } from "./cards/index.js";

/**
 * `mc_rulesreference_v18_compressed.pdf` (repo root) is 71 pages, confirmed by direct
 * extraction of the PDF (this sandbox's `Read` tool couldn't render it — `pdftoppm`/poppler
 * isn't installed and couldn't be built here, no C compiler — so a local PyMuPDF script
 * read the real file's page count and per-page text instead of the Read tool's normal
 * image pipeline; see the card-data-pipeline session's report for detail). Every `rrg`
 * source below must cite a page within this range.
 */
const RRG_PAGE_COUNT = 71;

const findCard = <T>(name: string, predicate: (c: unknown) => c is T): T => {
  const card = CORE_CARDS.find((c) => c.name === name && predicate(c));
  if (!card) throw new Error(`fixture card not found: ${name}`);
  return card as T;
};

const isAlly = (c: unknown): c is AllyCard => (c as { type?: string }).type === "ally";
const isMinion = (c: unknown): c is MinionCard => (c as { type?: string }).type === "minion";
const isHero = (c: unknown): c is HeroIdentityCard => (c as { type?: string }).type === "hero_identity";

describe("glossary entries", () => {
  it("has exactly one entry per known keyword name, with no extras and no omissions", () => {
    const keywordEntries = GLOSSARY_ENTRIES.filter((e) => e.kind === "keyword");
    expect(keywordEntries.map((e) => e.id).sort()).toEqual([...KNOWN_KEYWORD_NAMES].sort());
  });

  it("has exactly one entry per status name, with no extras and no omissions", () => {
    const statusEntries = GLOSSARY_ENTRIES.filter((e) => e.kind === "status");
    expect(statusEntries.map((e) => e.id).sort()).toEqual([...STATUS_NAMES].sort());
  });

  it("has no duplicate ids across the whole glossary", () => {
    const ids = GLOSSARY_ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry has a non-empty definition under a sane length cap (short paraphrase, not a rules-text dump)", () => {
    for (const entry of GLOSSARY_ENTRIES) {
      expect(entry.definition.trim().length, `${entry.id} definition is empty`).toBeGreaterThan(0);
      expect(
        entry.definition.length,
        `${entry.id} definition is too long for a glossary paraphrase`,
      ).toBeLessThanOrEqual(420);
    }
  });

  it("every entry has a non-empty display name", () => {
    for (const entry of GLOSSARY_ENTRIES) {
      expect(entry.displayName.trim().length).toBeGreaterThan(0);
    }
  });

  it("every entry has at least one source", () => {
    for (const entry of GLOSSARY_ENTRIES) {
      expect(entry.sources.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("every RRG page cite is within the PDF's real page count and is a positive integer", () => {
    for (const entry of GLOSSARY_ENTRIES) {
      for (const source of entry.sources) {
        if (source.kind !== "rrg") continue;
        expect(Number.isInteger(source.page), `${entry.id}: RRG page must be an integer`).toBe(true);
        expect(source.page, `${entry.id}: RRG page must be positive`).toBeGreaterThan(0);
        expect(
          source.page,
          `${entry.id}: RRG page ${source.page} is beyond the PDF's ${RRG_PAGE_COUNT} pages`,
        ).toBeLessThanOrEqual(RRG_PAGE_COUNT);
      }
    }
  });

  it("every ruling cite names a non-empty date/heading (so it's greppable in marvel-champions-rulings-post-rrg-1-7.md)", () => {
    for (const entry of GLOSSARY_ENTRIES) {
      for (const source of entry.sources) {
        if (source.kind !== "ruling") continue;
        expect(source.date.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("every entry sourced only from an un-owned insert is marked unverified, and no entry with a real RRG page is", () => {
    for (const entry of GLOSSARY_ENTRIES) {
      const hasRrgSource = entry.sources.some((s) => s.kind === "rrg");
      const onlyInsertSource = entry.sources.every((s) => s.kind === "insert-not-in-repo");
      if (onlyInsertSource) {
        expect(entry.unverified, `${entry.id} has no RRG source and should be marked unverified`).toBe(true);
      }
      if (hasRrgSource) {
        expect(entry.unverified, `${entry.id} has a real RRG page and shouldn't be marked unverified`).toBeFalsy();
      }
    }
  });

  it("discount is the one keyword with no RRG page, flagged unverified and pointing at the rulebook page that defines it", () => {
    // Wave 2 schema pass (docs/phase7-wave2.md §6.2): the Fear No Evil rulebook, p. 3, was read but is not in the repo.
    const discount = glossaryEntry("discount");
    expect(discount?.unverified).toBe(true);
    expect(discount?.sources).toEqual([{ kind: "insert-not-in-repo", product: "Fear No Evil rulebook, p. 3" }]);
    expect(discount?.definition).toMatch(/identity has the named trait/);
    expect(discount?.sources.some((s) => s.kind === "rrg")).toBe(false);
  });

  it("flags the quickstrike resolution-order conflict between RRG 1.8 and the February 28, 2026 ruling instead of picking a side", () => {
    const quickstrike = glossaryEntry("quickstrike");
    expect(quickstrike?.conflict).toBeTruthy();
    expect(quickstrike?.conflict).toMatch(/When Revealed/);
  });

  it("no entry other than quickstrike declares a conflict (keep the flag meaningful, not boilerplate)", () => {
    const conflicted = GLOSSARY_ENTRIES.filter((e) => e.conflict);
    expect(conflicted.map((e) => e.id)).toEqual(["quickstrike"]);
  });
});

describe("glossaryEntry", () => {
  it("looks up a keyword by id", () => {
    expect(glossaryEntry("guard")?.displayName).toBe("Guard");
  });

  it("looks up a status by id", () => {
    expect(glossaryEntry("tough")?.displayName).toBe("Tough");
  });

  it("returns undefined for an id the glossary doesn't cover", () => {
    expect(glossaryEntry("not-a-real-id" as never)).toBeUndefined();
  });
});

describe("glossaryEntriesForKeywords against real pool cards", () => {
  it("Luke Cage (ally, Toughness) resolves to the toughness entry", () => {
    const lukeCage = findCard<AllyCard>("Luke Cage", isAlly);
    const entries = glossaryEntriesForKeywords(lukeCage.keywords);
    expect(entries.map((e) => e.id)).toEqual(["toughness"]);
  });

  it("Hydra Mercenary (minion, Guard) resolves to the guard entry", () => {
    const hydraMercenary = findCard<MinionCard>("Hydra Mercenary", isMinion);
    const entries = glossaryEntriesForKeywords(hydraMercenary.keywords);
    expect(entries.map((e) => e.id)).toEqual(["guard"]);
  });

  it("Vulture (minion, Quickstrike) resolves to the quickstrike entry, conflict note intact", () => {
    const vulture = findCard<MinionCard>("Vulture", isMinion);
    const entries = glossaryEntriesForKeywords(vulture.keywords);
    expect(entries.map((e) => e.id)).toEqual(["quickstrike"]);
    expect(entries[0]?.conflict).toBeTruthy();
  });

  it("Black Panther's hero face (Retaliate 1) resolves to the retaliate entry", () => {
    const blackPanther = findCard<HeroIdentityCard>("Black Panther", isHero);
    const entries = glossaryEntriesForKeywords(blackPanther.hero.keywords);
    expect(entries.map((e) => e.id)).toEqual(["retaliate"]);
  });

  it("a minion with both Guard and Toughness resolves to both entries, in printed order, with no duplicates", () => {
    const card = CORE_CARDS.find(
      (c) =>
        isMinion(c) && c.keywords.some((k) => k.name === "guard") && c.keywords.some((k) => k.name === "toughness"),
    );
    expect(card).toBeDefined();
    const entries = glossaryEntriesForKeywords((card as MinionCard).keywords);
    expect(entries.map((e) => e.id)).toEqual(["guard", "toughness"]);
  });

  it("a card with no keywords resolves to no entries", () => {
    expect(glossaryEntriesForKeywords([])).toEqual([]);
  });

  it("never returns a status entry, even if asked about a card with no keywords at all", () => {
    const entries = glossaryEntriesForKeywords([]);
    expect(entries.every((e: GlossaryEntry) => e.kind === "keyword")).toBe(true);
  });
});
