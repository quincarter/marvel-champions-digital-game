import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PLAYABLE_CARDS } from "../data/index.js";
import { statStarsErrors, validateCard } from "./index.js";
import type { AnyCard, StatStar } from "./index.js";

/**
 * `statStars` (`common.ts`, issue #766) records the printed star beside a stat (ATK, SCH, THW, DEF, HP, REC): a card
 * ability tied to that stat (Klaw's "Forced Interrupt: When Klaw attacks"). MarvelCDB sends it as `attack_star`,
 * `scheme_star`, `thwart_star`, `defense_star`, `health_star` and `recover_star` on the record of each printed face.
 */
const RAW_FIELD: Readonly<Record<string, StatStar>> = {
  attack_star: "atk",
  scheme_star: "sch",
  thwart_star: "thw",
  defense_star: "def",
  health_star: "hp",
  recover_star: "rec",
};

const RAW_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "raw");

/** Every starred stat in the raw records (MarvelCDB, plus Hall of Heroes' scan transcriptions), by `code:stat`. */
function rawStars(): Set<string> {
  const found = new Set<string>();
  const visit = (record: Record<string, unknown>): void => {
    for (const [field, stat] of Object.entries(RAW_FIELD)) {
      if (record[field] === true) found.add(`${String(record.code)}:${stat}`);
    }
    const linked = record.linked_card;
    if (typeof linked === "object" && linked !== null) visit(linked as Record<string, unknown>);
  };
  for (const dir of ["marvelcdb", "hallofheroes"]) {
    for (const file of readdirSync(join(RAW_DIR, dir)).filter((f) => f.endsWith(".json"))) {
      const cache = JSON.parse(readFileSync(join(RAW_DIR, dir, file), "utf8")) as { cards: Record<string, unknown>[] };
      cache.cards.forEach(visit);
    }
  }
  return found;
}

/** Every `statStars` entry in the emitted cards, anywhere in a card: its faces, flip side, hero forms, villain stages. */
function emittedStars(cards: readonly AnyCard[]): number {
  let count = 0;
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (typeof value !== "object" || value === null) return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "statStars") count += (child as readonly string[]).length;
      else visit(child);
    }
  };
  cards.forEach(visit);
  return count;
}

const byId = (id: string): AnyCard => PLAYABLE_CARDS.find((c) => (c.id as string) === id)!;
const stagesOf = (id: string) => (byId(id) as Extract<AnyCard, { type: "villain" }>).sides.flatMap((s) => s.stages);

describe("statStars", () => {
  it("every starred stat in the raw records is emitted, and nothing else carries one", () => {
    const raw = rawStars();
    expect(raw.size).toBeGreaterThan(500);
    expect(emittedStars(PLAYABLE_CARDS)).toBe(raw.size);
  });

  it("a villain stage records its ATK star: Klaw's Forced Interrupt (01113 to 01115)", () => {
    const klaw = stagesOf("01113");
    expect(klaw.map((s) => s.statStars)).toEqual([["atk"], ["atk"], ["atk"]]);
  });

  it("a minion records its SCH star, and one without a star has no field", () => {
    const withSchStar = PLAYABLE_CARDS.filter((c) => c.type === "minion" && c.statStars?.includes("sch"));
    expect(withSchStar.length).toBeGreaterThan(20);
    const plain = PLAYABLE_CARDS.find((c) => c.type === "minion" && !("statStars" in c))!;
    expect(plain).toBeDefined();
  });

  it("an ally records an HP star and a THW star; an alter-ego face its REC star", () => {
    expect(PLAYABLE_CARDS.some((c) => c.type === "ally" && c.statStars?.includes("hp"))).toBe(true);
    expect(PLAYABLE_CARDS.some((c) => c.type === "ally" && c.statStars?.includes("thw"))).toBe(true);
    expect(PLAYABLE_CARDS.some((c) => c.type === "hero_identity" && c.alterEgo.statStars?.includes("rec"))).toBe(true);
    expect(PLAYABLE_CARDS.some((c) => c.type === "hero_identity" && c.hero.statStars?.includes("def"))).toBe(true);
  });

  it("every emitted card validates", () => {
    const failures = PLAYABLE_CARDS.flatMap((c) => statStarsErrors(c).map((e) => `${c.id as string}: ${e}`));
    expect(failures).toEqual([]);
  });

  it("refuses an empty list, a repeated stat, an unknown stat and a list out of order", () => {
    const minion = PLAYABLE_CARDS.find((c) => c.type === "minion")!;
    const withStars = (statStars: unknown): AnyCard => ({ ...minion, statStars }) as unknown as AnyCard;
    for (const bad of [[], ["atk", "atk"], ["luck"], ["sch", "atk"], "atk"]) {
      expect(validateCard(withStars(bad)).errors.join(), JSON.stringify(bad)).toContain("statStars");
    }
    expect(validateCard(withStars(["atk", "sch"])).errors.join()).not.toContain("statStars");
  });
});
