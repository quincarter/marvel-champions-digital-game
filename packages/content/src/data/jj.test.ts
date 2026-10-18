import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateCard, validateStarterDeck } from "../schema/index.js";
import type { AnyCard } from "../schema/index.js";
import { FNE_CARDS } from "./fne/cards.js";
import { JJ_CARDS } from "./jj/cards.js";
import { JJ_ENCOUNTER_SETS } from "./jj/encounterSets.js";
import { JJ_CYCLE, JJ_PACK } from "./jj/packs.js";
import { JJ_PROVENANCE } from "./jj/provenance.js";
import { JJ_SCENARIOS } from "./jj/scenarios.js";
import { JJ_STARTER_DECKS } from "./jj/starterDecks.js";
import { CORE_CARDS, PLAYABLE_CARDS, WAVE11_CARDS, WAVE11_STARTER_DECKS } from "./index.js";

/**
 * Jessica Jones (`jj`, cycle 11, MC61): counts, the corrections of `scripts/marvelcdb/curation/jj.ts` (Alias
 * Investigations' dash cost, Purple Man's star stats, the three Suggestion titles, Mitigated Threat's any-card host),
 * the three reprints and the unverified stand-in precon. Sources: docs/phase7-wave11-hero-packs.md H1 and
 * docs/phase7-wave11-data-survey.md sections 6, 7 and 10; RRG 1.8 Dash (Value) p. 15.
 */
interface RawRecord {
  readonly code: string;
}
const raw = JSON.parse(readFileSync(new URL("../../raw/marvelcdb/jj.json", import.meta.url), "utf8")) as {
  cards: readonly RawRecord[];
};
const byId = new Map(JJ_CARDS.map((c) => [c.id as string, c]));
const get = <T extends AnyCard>(id: string): T => {
  const card = byId.get(id);
  if (!card) throw new Error(`no card ${id}`);
  return card as T;
};
const notes = (id: string) => JJ_PROVENANCE.find((p) => p.cardId === id)!.corrections.join(" | ");

describe("jj: the pack", () => {
  it("is in cycle 11, released August 21, 2026 (MarvelCDB pack list)", () => {
    expect(JJ_CYCLE).toEqual({ id: "cycle11", name: "Fear No Evil", order: 11 });
    expect(JJ_PACK.releaseDate).toBe("2026-08-21");
    expect(JJ_PACK.cycleId as string).toBe("cycle11");
  });

  it("is 42 cards (59 copies), counted by type", () => {
    expect(JJ_CARDS).toHaveLength(42);
    expect(JJ_CARDS.reduce((n, c) => n + c.quantityInSet, 0)).toBe(59);
    const counts: Record<string, number> = {};
    for (const c of JJ_CARDS) counts[c.type] = (counts[c.type] ?? 0) + 1;
    expect(counts).toEqual({
      hero_identity: 1,
      support: 2,
      ally: 6,
      event: 7,
      player_side_scheme: 6,
      upgrade: 13,
      resource: 1,
      obligation: 4,
      minion: 1,
      side_scheme: 1,
    });
    expect(JJ_ENCOUNTER_SETS.map((s) => s.id as string)).toEqual(["jessica_jones_nemesis"]);
    expect(JJ_SCENARIOS).toEqual([]);
  });

  it("every card is jj's own, carries cycle11 and passes validateCard()", () => {
    for (const c of JJ_CARDS) {
      expect(c.setCode as string, c.id as string).toBe("jj");
      expect(c.cycleId as string, c.id as string).toBe("cycle11");
      expect(validateCard(c).errors, c.id as string).toEqual([]);
    }
  });

  it("covers every MarvelCDB record in provenance", () => {
    const covered = new Set(JJ_PROVENANCE.flatMap((p) => p.marvelcdbCodes));
    for (const r of raw.cards) expect(covered.has(r.code), r.code).toBe(true);
  });
});

describe("jj: corrections (spec H1)", () => {
  it("Alias Investigations prints a dash cost (Permanent, put into play by Setup)", () => {
    const card = get("61002") as unknown as { cost: number; specialCost?: string };
    expect(card.specialCost).toBe("dash");
    expect(card.cost).toBe(0);
    expect(notes("61002")).toContain("Dash");
  });

  it("Purple Man's ATK and SCH are 0 (set by his text), not a dash that could not be modified", () => {
    const card = get("61031") as unknown as { atk: number | null; sch: number | null; text: { printed: string } };
    expect(card.atk).toBe(0);
    expect(card.sch).toBe(0);
    expect(card.text.printed).toContain("[star] Purple Man's SCH is equal to the highest SCH or THW");
    expect(notes("61031")).toContain("star");
  });

  it("the three Suggestion obligations are titled 'Suggestion', as Indomitable Will names them", () => {
    for (const id of ["61033a", "61033b", "61033c"]) {
      expect(get(id).name, id).toBe("Suggestion");
      expect(get(id).type, id).toBe("obligation");
      expect(notes(id), id).toContain("Indomitable Will");
    }
    expect((get("61032") as unknown as { text: { printed: string } }).text.printed).toContain(
      "each Suggestion obligation",
    );
  });

  it("Mitigated Threat attaches to any card", () => {
    expect((get("61040") as unknown as { attachesTo: unknown }).attachesTo).toEqual({ kind: "anyCard" });
  });

  it("the reprints are 61018 (12031), 61021 (41016) and 61022 (21052), each a card of its own here", () => {
    const dupes = (
      JSON.parse(readFileSync(new URL("../../raw/marvelcdb/jj.json", import.meta.url), "utf8")) as {
        cards: { code: string; duplicate_of_code?: string }[];
      }
    ).cards.filter((c) => c.duplicate_of_code);
    expect(dupes.map((c) => [c.code, c.duplicate_of_code])).toEqual([
      ["61018", "12031"],
      ["61021", "41016"],
      ["61022", "21052"],
    ]);
    for (const c of dupes) expect(byId.has(c.code), c.code).toBe(true);
  });
});

describe("jj: the stand-in starter deck (no printed list)", () => {
  const [deck] = JJ_STARTER_DECKS;
  it("is Jessica Jones / Justice, 41 entries, valid, and marked unverified", () => {
    expect(JJ_STARTER_DECKS).toHaveLength(1);
    expect([deck!.id as string, deck!.packCode as string, deck!.identityCardId as string]).toEqual([
      "jj-justice",
      "jj",
      "61001a",
    ]);
    expect(deck!.aspects).toEqual(["justice"]);
    expect(deck!.provenance.verified).toBe(false);
    expect(deck!.provenance.sources.join(" ")).toContain("65137");
    expect(validateStarterDeck(deck!).errors).toEqual([]);
    expect(deck!.cards.reduce((n, e) => n + e.quantity, 0)).toBe(41);
    expect(deck!.cards.some((e) => (e.cardId as string) === "61002")).toBe(true);
    for (const e of deck!.cards) {
      expect(e.quantity, e.cardId as string).toBeLessThanOrEqual(get(e.cardId as string).quantityInSet);
    }
  });
});

describe("jj: wave 11 pool wiring", () => {
  it("WAVE11_CARDS is Core, fne, then jj, with no duplicate ids", () => {
    const start = CORE_CARDS.length + FNE_CARDS.length;
    expect(WAVE11_CARDS.slice(start, start + JJ_CARDS.length)).toEqual(JJ_CARDS);
    expect(new Set(WAVE11_CARDS.map((c) => c.id)).size).toBe(WAVE11_CARDS.length);
  });

  it("PLAYABLE_CARDS carries the jj cards once, as a block", () => {
    const ids = PLAYABLE_CARDS.map((c) => c.id as string);
    expect(new Set(ids).size).toBe(ids.length);
    const at = ids.indexOf("61001a");
    expect(ids.slice(at, at + JJ_CARDS.length)).toEqual(JJ_CARDS.map((c) => c.id as string));
  });

  it("WAVE11_STARTER_DECKS ends with the jj stand-in", () => {
    expect(WAVE11_STARTER_DECKS.at(-1)).toEqual(JJ_STARTER_DECKS[0]);
  });
});
