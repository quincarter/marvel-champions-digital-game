import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateCard, validateStarterDeck } from "../schema/index.js";
import type { AnyCard } from "../schema/index.js";
import { FNE_CARDS } from "./fne/cards.js";
import { JJ_CARDS } from "./jj/cards.js";
import { LUKE_CAGE_CARDS } from "./luke_cage/cards.js";
import { LUKE_CAGE_ENCOUNTER_SETS } from "./luke_cage/encounterSets.js";
import { LUKE_CAGE_CYCLE, LUKE_CAGE_PACK } from "./luke_cage/packs.js";
import { LUKE_CAGE_PROVENANCE } from "./luke_cage/provenance.js";
import { LUKE_CAGE_SCENARIOS } from "./luke_cage/scenarios.js";
import { LUKE_CAGE_STARTER_DECKS } from "./luke_cage/starterDecks.js";
import { CORE_CARDS, PLAYABLE_CARDS, WAVE11_CARDS, WAVE11_STARTER_DECKS } from "./index.js";

/**
 * Luke Cage (`luke_cage`, cycle 11, MC62): counts, the corrections of
 * `scripts/marvelcdb/curation/luke_cage.ts` (Metal Bracer's printed "gains", Hulk's dash THW and the stars read from the
 * scans), the Unbreakable Bond reprint of jj 61027 and the unverified stand-in precon. Sources:
 * docs/phase7-wave11-hero-packs.md H1 and H3.23, docs/phase7-wave11-data-survey.md sections 6, 7 and 10; RRG 1.8 Dash
 * (Value) p. 15.
 */
interface RawRecord {
  readonly code: string;
  readonly duplicate_of_code?: string;
}
const raw = JSON.parse(readFileSync(new URL("../../raw/marvelcdb/luke_cage.json", import.meta.url), "utf8")) as {
  cards: readonly RawRecord[];
};
const byId = new Map(LUKE_CAGE_CARDS.map((c) => [c.id as string, c]));
const get = <T extends AnyCard>(id: string): T => {
  const card = byId.get(id);
  if (!card) throw new Error(`no card ${id}`);
  return card as T;
};
const notes = (id: string) => LUKE_CAGE_PROVENANCE.find((p) => p.cardId === id)!.corrections.join(" | ");

describe("luke_cage: the pack", () => {
  it("is in cycle 11, released August 21, 2026 (MarvelCDB pack list)", () => {
    expect(LUKE_CAGE_CYCLE).toEqual({ id: "cycle11", name: "Fear No Evil", order: 11 });
    expect(LUKE_CAGE_PACK.releaseDate).toBe("2026-08-21");
    expect(LUKE_CAGE_PACK.cycleId as string).toBe("cycle11");
  });

  it("is 37 cards, counted by type", () => {
    expect(LUKE_CAGE_CARDS).toHaveLength(37);
    const counts: Record<string, number> = {};
    for (const c of LUKE_CAGE_CARDS) counts[c.type] = (counts[c.type] ?? 0) + 1;
    expect(counts).toEqual({
      hero_identity: 1,
      ally: 6,
      event: 10,
      support: 3,
      upgrade: 6,
      resource: 5,
      obligation: 1,
      minion: 3,
      side_scheme: 1,
      attachment: 1,
    });
    expect(LUKE_CAGE_ENCOUNTER_SETS.map((s) => s.id as string)).toEqual(["luke_cage_nemesis"]);
    expect(LUKE_CAGE_SCENARIOS).toEqual([]);
  });

  it("every card is luke_cage's own, carries cycle11 and passes validateCard()", () => {
    for (const c of LUKE_CAGE_CARDS) {
      expect(c.setCode as string, c.id as string).toBe("luke_cage");
      expect(c.cycleId as string, c.id as string).toBe("cycle11");
      expect(validateCard(c).errors, c.id as string).toEqual([]);
    }
  });

  it("covers every MarvelCDB record in provenance", () => {
    const covered = new Set(LUKE_CAGE_PROVENANCE.flatMap((p) => p.marvelcdbCodes));
    for (const r of raw.cards) expect(covered.has(r.code), r.code).toBe(true);
  });
});

describe("luke_cage: corrections and scan checks (spec H1, H3.23)", () => {
  it('Metal Bracer keeps the printed title and reads "gains retaliate 1" as the scan prints it', () => {
    const card = get("62010") as unknown as { name: string; text: { printed: string; current: string } };
    expect(card.name).toBe("Metal Bracer");
    expect(card.text.printed).toContain("Luke Cage gains retaliate 1.");
    expect(card.text.current).toBe(card.text.printed);
    expect(notes("62010")).toContain("Metal Bracelet");
  });

  it("Hulk prints a dash THW (cannot thwart) and 2 ATK", () => {
    const card = get("62020") as unknown as { thw: number | null; atk: number; hp: number; cost: number };
    expect(card.thw).toBeNull();
    expect([card.atk, card.hp, card.cost]).toEqual([2, 5, 4]);
    expect(notes("62020")).toContain("dash");
  });

  it("the star stats carry their [star] rule lines: 62002, 62013, 62029, 62031, 62032 (and 62006 costs 5)", () => {
    const text = (id: string) => (get(id) as unknown as { text: { printed: string } }).text.printed;
    expect(text("62002")).toMatch(/^\[star\] Jessica Jones gets \+1 THW/);
    expect(text("62013")).toContain("\n[star] Misty Knight gets +2 ATK and +2 THW");
    expect(text("62029")).toMatch(/^\[star\] Forced Response: After Cottonmouth attacks/);
    expect(text("62031")).toContain("\n[star] Forced Interrupt: When attached enemy attacks");
    expect((get("62031") as unknown as { statModifiers: unknown }).statModifiers).toEqual({ atk: 1 });
    expect(text("62032")).toMatch(/^\[star\] Forced Response: After Asp schemes against you/);
    expect((get("62006") as unknown as { cost: number }).cost).toBe(5);
    expect((get("62006") as unknown as { specialCost?: string }).specialCost).toBeUndefined();
  });

  it("Unbreakable Bond (62024) reprints jj 61027 verbatim and takes its art", () => {
    expect(raw.cards.filter((c) => c.duplicate_of_code).map((c) => [c.code, c.duplicate_of_code])).toContainEqual([
      "62024",
      "61027",
    ]);
    const card = get("62024") as unknown as { images: { front: string }; text: { printed: string } };
    const original = JJ_CARDS.find((c) => (c.id as string) === "61027")!;
    expect(card.images.front as string).toBe("/bundles/cards/61027.png");
    expect(card.text.printed).toBe((original as unknown as { text: { printed: string } }).text.printed);
  });
});

describe("luke_cage: the stand-in starter deck (no printed list)", () => {
  const [deck] = LUKE_CAGE_STARTER_DECKS;
  it("is Luke Cage / Leadership, 40 cards, valid, and marked unverified", () => {
    expect(LUKE_CAGE_STARTER_DECKS).toHaveLength(1);
    expect([deck!.id as string, deck!.packCode as string, deck!.identityCardId as string]).toEqual([
      "luke-cage-leadership",
      "luke_cage",
      "62001a",
    ]);
    expect(deck!.aspects).toEqual(["leadership"]);
    expect(deck!.provenance.verified).toBe(false);
    expect(deck!.provenance.sources.join(" ")).toContain("65136");
    expect(validateStarterDeck(deck!).errors).toEqual([]);
    expect(deck!.cards.reduce((n, e) => n + e.quantity, 0)).toBe(40);
    for (const e of deck!.cards) {
      expect(e.quantity, e.cardId as string).toBeLessThanOrEqual(get(e.cardId as string).quantityInSet);
    }
  });
});

describe("luke_cage: wave 11 pool wiring", () => {
  it("WAVE11_CARDS is Core, fne, jj, luke_cage, then shadowland, with no duplicate ids", () => {
    const start = CORE_CARDS.length + FNE_CARDS.length + JJ_CARDS.length;
    expect(WAVE11_CARDS.slice(start, start + LUKE_CAGE_CARDS.length)).toEqual(LUKE_CAGE_CARDS);
    expect(new Set(WAVE11_CARDS.map((c) => c.id)).size).toBe(WAVE11_CARDS.length);
  });

  it("PLAYABLE_CARDS carries the luke_cage cards contiguously, each once (shadowland follows them)", () => {
    const ids = PLAYABLE_CARDS.map((c) => c.id as string);
    expect(new Set(ids).size).toBe(ids.length);
    const first = ids.indexOf(LUKE_CAGE_CARDS[0]!.id as string);
    expect(ids.slice(first, first + LUKE_CAGE_CARDS.length)).toEqual(LUKE_CAGE_CARDS.map((c) => c.id as string));
  });

  it("WAVE11_STARTER_DECKS ends with the luke_cage stand-in", () => {
    expect(WAVE11_STARTER_DECKS.at(-1)).toEqual(LUKE_CAGE_STARTER_DECKS[0]);
  });
});
