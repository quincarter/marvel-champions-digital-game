import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateCard, validateStarterDeck } from "../schema/index.js";
import type { AnyCard, HeroIdentityCard, UpgradeCard } from "../schema/index.js";
import { WONDER_MAN_CARDS } from "./wonder_man/cards.js";
import { WONDER_MAN_ENCOUNTER_SETS } from "./wonder_man/encounterSets.js";
import { WONDER_MAN_CYCLE, WONDER_MAN_PACK } from "./wonder_man/packs.js";
import { WONDER_MAN_PROVENANCE } from "./wonder_man/provenance.js";
import { WONDER_MAN_STARTER_DECKS } from "./wonder_man/starterDecks.js";

/**
 * Wonder Man (`wonder_man`, cycle 10, Civil War): counts, the Ionic Physiology erratum (RRG 1.8 p. 70) and what the
 * hero kit and the off-aspect energy events are. Sources: the Wonder Man insert, RRG 1.8 Appendix V,
 * docs/phase7-wave10-hero-packs.md H1 and docs/phase7-wave10-scan-check.md. Wonder Man's deck-building rule
 * ("Ionic Energy Being") is `OffAspectAllowance.printedResource` on 58001a (spec H1.5, H3.15); the deck cases are in
 * `@mc/engine` (`off-aspect-allowance.test.ts`) and `@mc/cards` (`wave10/wonder-man-deck.test.ts`).
 */
interface RawRecord {
  readonly code: string;
  readonly quantity: number;
}
const raw = JSON.parse(readFileSync(new URL("../../raw/marvelcdb/wonder_man.json", import.meta.url), "utf8")) as {
  cards: readonly RawRecord[];
};

const byId = new Map(WONDER_MAN_CARDS.map((c) => [c.id as string, c]));
const get = <T extends AnyCard>(id: string): T => {
  const card = byId.get(id);
  if (!card) throw new Error(`no card ${id}`);
  return card as T;
};
const setOf = (card: AnyCard): readonly string[] =>
  "encounterSetIds" in card ? (card.encounterSetIds as readonly string[]) : [];
const typeCounts = (cards: readonly AnyCard[]) => {
  const counts: Record<string, number> = {};
  for (const c of cards) counts[c.type] = (counts[c.type] ?? 0) + 1;
  return counts;
};
const copies = (cards: readonly AnyCard[]) => cards.reduce((n, c) => n + c.quantityInSet, 0);
const text = (card: AnyCard) => (card as { text: { printed: string; current: string } }).text;
const aspectOf = (card: AnyCard) => (card as { aspect?: string }).aspect;

describe("wonder_man: the pack", () => {
  it("is in cycle 10, Civil War, released February 20, 2026", () => {
    expect(WONDER_MAN_CYCLE).toEqual({ id: "cycle10", name: "Civil War", order: 10 });
    expect(WONDER_MAN_PACK.releaseDate).toBe("2026-02-20");
    expect(WONDER_MAN_PACK.cycleId as string).toBe("cycle10");
  });

  it("is 34 cards (59 copies), counted by type", () => {
    expect(WONDER_MAN_CARDS).toHaveLength(34);
    expect(copies(WONDER_MAN_CARDS)).toBe(59);
    expect(typeCounts(WONDER_MAN_CARDS)).toEqual({
      hero_identity: 1,
      upgrade: 8,
      event: 9,
      resource: 2,
      support: 4,
      ally: 5,
      obligation: 1,
      minion: 1,
      side_scheme: 1,
      treachery: 2,
    });
  });

  it("every card is Wonder Man's own, passes validateCard(), and the copies equal the raw quantities", () => {
    for (const c of WONDER_MAN_CARDS) {
      expect(c.setCode as string, c.id as string).toBe("wonder_man");
      expect(c.cycleId as string, c.id as string).toBe("cycle10");
      expect(validateCard(c).errors, c.id as string).toEqual([]);
    }
    const covered = new Set(WONDER_MAN_PROVENANCE.flatMap((p) => p.marvelcdbCodes));
    for (const r of raw.cards) expect(covered.has(r.code), r.code).toBe(true);
    expect(copies(WONDER_MAN_CARDS)).toBe(raw.cards.reduce((n, r) => n + r.quantity, 0));
  });

  it("splits by owner: 16 hero-kit copies, 13 Justice, 19 other-aspect, 4 Basic, 5 nemesis (+ obligation)", () => {
    expect(copies(WONDER_MAN_CARDS.filter((c) => aspectOf(c) === "hero:58001a"))).toBe(16);
    expect(copies(WONDER_MAN_CARDS.filter((c) => aspectOf(c) === "justice"))).toBe(13);
    expect(copies(WONDER_MAN_CARDS.filter((c) => aspectOf(c) === "aggression"))).toBe(6);
    expect(copies(WONDER_MAN_CARDS.filter((c) => aspectOf(c) === "protection"))).toBe(6);
    expect(copies(WONDER_MAN_CARDS.filter((c) => aspectOf(c) === "leadership"))).toBe(7);
    expect(copies(WONDER_MAN_CARDS.filter((c) => aspectOf(c) === "basic"))).toBe(4);
    expect(copies(WONDER_MAN_CARDS.filter((c) => setOf(c).includes("wonder_man_nemesis")))).toBe(5);
  });

  it("has one encounter set, the nemesis set on Wonder Man (58026 to 58029), and the obligation is 58025", () => {
    expect(WONDER_MAN_ENCOUNTER_SETS.map((s) => s.id as string)).toEqual(["wonder_man_nemesis"]);
    expect(WONDER_MAN_ENCOUNTER_SETS[0]?.nemesisOfIdentityId).toBe("58001a");
    expect(WONDER_MAN_CARDS.filter((c) => setOf(c).includes("wonder_man_nemesis")).map((c) => c.id as string)).toEqual([
      "58026",
      "58027",
      "58028",
      "58029",
    ]);
    const identity = get<HeroIdentityCard>("58001a");
    expect(identity.obligationCardId as string).toBe("58025");
    expect(identity.nemesisEncounterSetId as string).toBe("wonder_man_nemesis");
  });

  it("has one starter deck, Wonder Man / Justice, from the owner's stand-in listing: unverified, legal, 41 entries", () => {
    expect(
      WONDER_MAN_STARTER_DECKS.map((d) => [d.id as string, d.packCode as string, d.identityCardId as string]),
    ).toEqual([["wonder-man-justice", "wonder_man", "58001a"]]);
    const deck = WONDER_MAN_STARTER_DECKS[0]!;
    expect(deck.aspects).toEqual(["justice"]);
    // Not a scan of the insert: the owner's stand-in, a database listing (2026-10-12).
    expect(deck.provenance.verified).toBe(false);
    expect(deck.provenance.sources.join(" ")).toMatch(/stand-in/);
    expect(validateStarterDeck(deck).errors).toEqual([]);
    // 40 listed cards plus the Permanent Ionic Physiology (58002), which the listing shows apart from the 40.
    expect(deck.cards.reduce((n, e) => n + e.quantity, 0)).toBe(41);
    const qty = new Map(deck.cards.map((e) => [e.cardId as string, e.quantity]));
    expect(qty.get("58002")).toBe(1);
    const split = { hero: 0, aspect: 0, basic: 0, offAspect: 0 };
    for (const e of deck.cards) {
      const card = get(e.cardId as string);
      expect(e.quantity, e.cardId as string).toBeLessThanOrEqual(card.quantityInSet);
      const a = (card as { aspect?: string }).aspect;
      if (e.cardId === "58002") continue;
      if (["58017", "58019", "58020"].includes(e.cardId as string)) split.offAspect += e.quantity;
      else split[a === "basic" ? "basic" : a?.startsWith("hero") ? "hero" : "aspect"] += e.quantity;
    }
    expect(split).toEqual({ hero: 15, aspect: 13, basic: 3, offAspect: 9 });
  });

  it("has no separate decks (the Setup puts Ionic Physiology into play)", () => {
    expect(get<HeroIdentityCard>("58001a").separateDecks).toBeUndefined();
  });
});

describe("wonder_man: Ionic Energy Being (Simon Williams 58001b), the deck-building rule", () => {
  const identity = get<HeroIdentityCard>("58001a");
  const withAllowance = (offAspectAllowance: unknown): HeroIdentityCard =>
    ({ ...identity, deckbuilding: { offAspectAllowance } }) as unknown as HeroIdentityCard;

  it("the alter-ego face prints the rule", () => {
    expect(identity.alterEgo.text.current).toContain(
      "You may include events with a printed [energy] resource icon from any aspect in your deck.",
    );
  });

  it("is an off-aspect allowance by card type and printed resource, with no maximum and nothing left unmodeled", () => {
    expect(identity.deckbuilding).toEqual({ offAspectAllowance: { cardType: "event", printedResource: "energy" } });
    expect(validateCard(identity).errors).toEqual([]);
  });

  it("validateCard accepts each of the four printed resource types and refuses anything else", () => {
    for (const printedResource of ["physical", "mental", "energy", "wild"])
      expect(validateCard(withAllowance({ cardType: "event", printedResource })).errors, printedResource).toEqual([]);
    for (const printedResource of ["plasma", "", 1, null])
      expect(
        validateCard(withAllowance({ cardType: "event", printedResource })).errors,
        String(printedResource),
      ).toEqual(["offAspectAllowance printedResource must be physical, mental, energy or wild"]);
    // The card type may be absent (any type) when a trait or a printed resource narrows the allowance, but an
    // allowance that names nothing is refused.
    expect(validateCard(withAllowance({ printedResource: "energy" })).errors).toEqual([]);
    expect(validateCard(withAllowance({})).errors).toEqual([
      "offAspectAllowance needs a cardType, an anyTrait or a printedResource",
    ]);
  });
});

describe("wonder_man: the off-aspect energy events (the cards Ionic Energy Being lets the deck take)", () => {
  it("58017 Bombs Away (Aggression), 58019 Stronger Together (Protection) and 58020 Unified Strike (Leadership), 3 copies each", () => {
    expect(
      ["58017", "58019", "58020"].map((id) => [id, aspectOf(get(id)), get(id).type, get(id).quantityInSet]),
    ).toEqual([
      ["58017", "aggression", "event", 3],
      ["58019", "protection", "event", 3],
      ["58020", "leadership", "event", 3],
    ]);
  });

  it("each of the three prints an energy resource icon", () => {
    for (const id of ["58017", "58019", "58020"]) {
      const icons = (get(id) as { resourceIcons: { energy?: number } }).resourceIcons;
      expect(icons.energy, id).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("wonder_man: Ionic Physiology 58002 errata (RRG 1.8 Appendix V, p. 70; ruling March 6, 2026 (3))", () => {
  const ionic = get<UpgradeCard>("58002");

  it("the printed text keeps the cost arrow, the current text reads Then", () => {
    expect(text(ionic).printed).toBe(
      "Permanent. Max 3 cards tucked here.\nResponse: After you play an event with a printed [energy] resource, tuck that event from your discard pile under this card → heal 1 damage from your identity.",
    );
    expect(text(ionic).current).toBe(
      "Permanent. Max 3 cards tucked here.\nResponse: After you play an event with a printed [energy] resource, tuck that event from your discard pile under this card. Then, heal 1 damage from your identity.",
    );
    expect(text(ionic).current).not.toContain("→");
  });

  it("is recorded as RRG 1.8 errata on the text field, with its citation", () => {
    expect(ionic.errata?.currentVersion).toBe("RRG 1.8");
    expect(ionic.errata?.history).toHaveLength(1);
    expect(ionic.errata?.history?.[0]?.version).toBe("RRG 1.8");
    expect(ionic.errata?.history?.[0]?.changedFields).toEqual(["text"]);
    const notes = WONDER_MAN_PROVENANCE.find((p) => p.cardId === "58002")!.corrections.join(" | ");
    expect(notes).toContain("RRG 1.8 p. 70");
    expect(notes).toContain("ruling March 6, 2026 (3)");
  });

  it("is the only card in the pack with errata", () => {
    expect(WONDER_MAN_CARDS.filter((c) => c.errata !== undefined).map((c) => c.id as string)).toEqual(["58002"]);
  });

  it("keeps the dash cost, Permanent and the dash on Cameo", () => {
    expect(ionic.specialCost).toBe("dash");
    expect(ionic.keywords).toContainEqual({ name: "permanent" });
    expect((get("58031") as { specialCost?: string }).specialCost).toBe("dash");
    expect((get("58031") as unknown as { keywords: unknown[] }).keywords).toContainEqual({ name: "setup" });
  });

  it("58018 Everywhere All at Once has an X cost", () => {
    expect((get("58018") as { specialCost?: string }).specialCost).toBe("X");
  });
});
