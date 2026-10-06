import { describe, expect, test } from "vitest";
import { CORE_CARDS } from "../data/core/cards.js";
import { CORE_STARTER_DECKS } from "../data/core/starterDecks.js";
import { PLAYABLE_CARDS } from "../data/index.js";
import { MTS_CARDS } from "../data/mts/cards.js";
import { SM_CARDS } from "../data/sm/cards.js";
import { parseMarvelCdbDeckJson, parseMarvelCdbDeckJsonText, type MarvelCdbDeckJson } from "./from-marvelcdb-json.js";

const blackPanther = CORE_STARTER_DECKS.find((d) => d.name.startsWith("Black Panther"))!;

/** A real response, fetched live from `GET /api/public/decklist/1.json` on 2026-09-13. */
const REAL_DECKLIST_RESPONSE: MarvelCdbDeckJson = {
  id: 1,
  name: "Black Panther - Protection - Starter Deck",
  hero_code: "01040a",
  hero_name: "Black Panther",
  slots: {
    "01041": 1,
    "01042": 1,
    "01043a": 1,
    "01043b": 1,
    "01043c": 1,
    "01043d": 2,
    "01044": 3,
    "01045": 1,
    "01046": 1,
    "01047": 1,
    "01048": 1,
    "01049": 1,
    "01075": 1,
    "01076": 1,
    "01077": 2,
    "01078": 2,
    "01079": 2,
    "01080": 2,
    "01081": 2,
    "01082": 2,
    "01083": 1,
    "01084": 1,
    "01085": 1,
    "01086": 1,
    "01087": 1,
    "01088": 1,
    "01089": 1,
    "01090": 1,
    "01091": 1,
    "01092": 1,
    "01093": 1,
  },
  meta: '{"aspect":"protection"}',
};

describe("parseMarvelCdbDeckJson", () => {
  test("our CardId is the MarvelCDB card code: every code in a real response resolves in the Core pool", () => {
    const result = parseMarvelCdbDeckJson(REAL_DECKLIST_RESPONSE, CORE_CARDS);
    expect(result.ok).toBe(true);
  });

  test("a real decklist response round-trips to exactly the curated Core precon", () => {
    const result = parseMarvelCdbDeckJson(REAL_DECKLIST_RESPONSE, CORE_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    expect(result.contents.identityCardId).toBe(blackPanther.identityCardId);
    expect(result.contents.aspects).toEqual(["protection"]);
    const asMap = (cards: readonly { cardId: string; quantity: number }[]) =>
      Object.fromEntries(cards.map((c) => [c.cardId, c.quantity]));
    expect(asMap(result.contents.cards)).toEqual(asMap(blackPanther.cards));
    expect(result.heroName).toBe("Black Panther");
    expect(result.deckName).toBe("Black Panther - Protection - Starter Deck");
  });

  test("the deck/<id> shape (a user's own deck) is identical and parses the same way", () => {
    // Fetched live from `GET /api/public/deck/1.json` on 2026-09-13: same fields, user_id present, no `tags`.
    const result = parseMarvelCdbDeckJson({ ...REAL_DECKLIST_RESPONSE, user_id: 1, tags: "" }, CORE_CARDS);
    expect(result.ok).toBe(true);
  });

  test("an unknown identity code fails loudly, naming the code", () => {
    const result = parseMarvelCdbDeckJson({ ...REAL_DECKLIST_RESPONSE, hero_code: "99999a" }, CORE_CARDS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toEqual([expect.objectContaining({ code: "unknown_identity" })]);
  });

  test("an identity code that is a real card but not an identity fails loudly", () => {
    // 01041 is Black Panther's "Vibranium Suit" upgrade, not an identity.
    const result = parseMarvelCdbDeckJson({ ...REAL_DECKLIST_RESPONSE, hero_code: "01041" }, CORE_CARDS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((p) => p.code === "not_an_identity")).toBe(true);
  });

  test("an unknown card code in slots is named specifically, and other problems are still collected", () => {
    const result = parseMarvelCdbDeckJson(
      { ...REAL_DECKLIST_RESPONSE, slots: { ...REAL_DECKLIST_RESPONSE.slots, "99999z": 2 } },
      CORE_CARDS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContainEqual(expect.objectContaining({ code: "unknown_card", cardIds: ["99999z"] }));
  });

  test("nonsense and negative quantities fail loudly rather than being dropped or clamped", () => {
    for (const bad of [0, -1, 1.5, "3", 9999]) {
      const result = parseMarvelCdbDeckJson(
        { ...REAL_DECKLIST_RESPONSE, slots: { "01044": bad as never } },
        CORE_CARDS,
      );
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.problems.some((p) => p.code === "invalid_quantity")).toBe(true);
    }
  });

  test("a missing aspect fails loudly rather than importing with no aspect chosen", () => {
    const { meta: _meta, ...withoutMeta } = REAL_DECKLIST_RESPONSE;
    const result = parseMarvelCdbDeckJson(withoutMeta, CORE_CARDS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((p) => p.code === "missing_aspect")).toBe(true);
  });

  test("a MarvelCDB deck-JSON with meta.aspect_1 is read as a second aspect, in order", () => {
    const result = parseMarvelCdbDeckJson(
      { ...REAL_DECKLIST_RESPONSE, meta: '{"aspect":"protection","aspect_1":"justice"}' },
      CORE_CARDS,
    );
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    expect(result.contents.aspects).toEqual(["protection", "justice"]);
  });

  test("MarvelCDB's own meta.aspect2 (a Spider-Woman deck) is read as the second aspect", () => {
    const result = parseMarvelCdbDeckJson(
      { ...REAL_DECKLIST_RESPONSE, meta: '{"aspect":"aggression","aspect2":"justice"}' },
      CORE_CARDS,
    );
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    expect(result.contents.aspects).toEqual(["aggression", "justice"]);
  });

  test("an Adam Warlock deck, whose meta names only two aspects, gets all four from its aspect cards", () => {
    const result = parseMarvelCdbDeckJson(
      {
        ...REAL_DECKLIST_RESPONSE,
        hero_code: "21031a",
        hero_name: "Adam Warlock",
        meta: '{"aspect":"aggression","aspect2":"justice"}',
        slots: { "01053": 1, "01060": 1, "01070": 1, "01077": 1 },
      },
      [...CORE_CARDS, ...MTS_CARDS],
    );
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    expect([...result.contents.aspects].sort()).toEqual(["aggression", "justice", "leadership", "protection"]);
  });

  test("a single-aspect identity keeps meta's aspect even when its cards span more", () => {
    const result = parseMarvelCdbDeckJson(
      { ...REAL_DECKLIST_RESPONSE, slots: { ...REAL_DECKLIST_RESPONSE.slots, "01060": 1 } },
      CORE_CARDS,
    );
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    expect(result.contents.aspects).toEqual(["protection"]);
  });

  test("garbage that isn't an object at all fails loudly with one clear message", () => {
    expect(parseMarvelCdbDeckJson(null, CORE_CARDS)).toEqual({
      ok: false,
      problems: [expect.objectContaining({ code: "invalid_input" })],
    });
    expect(parseMarvelCdbDeckJson("just some text", CORE_CARDS)).toEqual({
      ok: false,
      problems: [expect.objectContaining({ code: "invalid_input" })],
    });
    expect(parseMarvelCdbDeckJson([1, 2, 3], CORE_CARDS)).toEqual({
      ok: false,
      problems: [expect.objectContaining({ code: "invalid_input" })],
    });
  });

  test("a reprint code resolves to the original card it duplicates (03018 reprints Core's 'The Power of Leadership', 01072)", () => {
    // catalog.ts's CATALOG_REPRINTS "03018": "01072" — a cycle-2 (Rise of Red Skull) reprint of a Core resource.
    // The base decklist doesn't already list 01072, so this is a clean "code not in the pool, but a known
    // reprint" case rather than a merge.
    const result = parseMarvelCdbDeckJson(
      { ...REAL_DECKLIST_RESPONSE, slots: { ...REAL_DECKLIST_RESPONSE.slots, "03018": 1 } },
      CORE_CARDS,
    );
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    const leadership = result.contents.cards.find((c) => c.cardId === "01072");
    expect(leadership?.quantity).toBe(1);
    expect(result.notes).toEqual([expect.objectContaining({ code: "reprint_resolved", cardIds: ["03018", "01072"] })]);
  });

  test("reprint + original listed separately in one deck total, rather than overwriting one another", () => {
    // 03012 is a cycle-2 reprint of Core's "Overwatch" (01066, per CATALOG_REPRINTS); the base decklist doesn't
    // include 01066 at all, so this specifically exercises quantities merging by resolved id.
    const result = parseMarvelCdbDeckJson(
      { ...REAL_DECKLIST_RESPONSE, slots: { ...REAL_DECKLIST_RESPONSE.slots, "03012": 2, "01066": 1 } },
      CORE_CARDS,
    );
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    const overwatch = result.contents.cards.filter((c) => c.cardId === "01066");
    expect(overwatch).toHaveLength(1);
    expect(overwatch[0]!.quantity).toBe(3);
    expect(result.notes?.some((n) => n.code === "reprint_resolved" && n.cardIds?.includes("03012" as never))).toBe(
      true,
    );
  });

  test("wave 5: Sinister Motives' own reprint of Core's Energy (27020) resolves when the pool doesn't carry the SM code", () => {
    // packages/content/raw/marvelcdb/sm.json: card 27020 ("Energy") duplicate_of_code "01088". Our own ingestion
    // of sm/cards.ts keeps every printed reprint code as its own AnyCard entry (see `27020`/`27050` both present
    // in SM_CARDS, cross-checked below), so a decklist built against *SM_CARDS itself* never needs the reprint
    // map for this card — the direct code lookup already finds it. The reprint map earns its keep in the more
    // realistic cross-pack case: a decklist naming the Sinister Motives print (27020) is checked against a pool
    // that only has the Core pack (CORE_CARDS has 01088 but not 27020), which is exactly what an app importing a
    // real MarvelCDB decklist against a partial local card pool would hit.
    const result = parseMarvelCdbDeckJson(
      { ...REAL_DECKLIST_RESPONSE, slots: { ...REAL_DECKLIST_RESPONSE.slots, "27020": 1 } },
      CORE_CARDS,
    );
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    const energy = result.contents.cards.find((c) => c.cardId === "01088");
    expect(energy?.quantity).toBe(2); // REAL_DECKLIST_RESPONSE already lists one "01088"; the SM reprint adds one more.
    expect(result.notes).toContainEqual(
      expect.objectContaining({ code: "reprint_resolved", cardIds: ["27020", "01088"] }),
    );
  });

  test("wave 5: Sinister Motives' in-cycle reprint (27050 'Young Love' of 27019) resolves when the pool lacks the reprint's own code", () => {
    // 27050 duplicates 27019 (per CATALOG_REPRINTS) — one Sinister Motives hero pack's precon reprinting another's
    // aspect card, both in the same box. SM_CARDS itself carries 27050 as its own entry too (same ingestion
    // behavior as above), so resolving against SM_CARDS directly finds "27050" by its own code without touching
    // the reprint map at all — asserted below. To exercise the reprint path itself, this uses a pool that has the
    // original (27019) but not the reprint's own code, standing in for a hero-pack pool that hasn't ingested the
    // reprinting pack yet.
    const poolWithoutReprint = SM_CARDS.filter((card) => card.id !== "27050");
    const resolved = parseMarvelCdbDeckJson(
      { ...REAL_DECKLIST_RESPONSE, hero_code: "27001a", slots: { "27050": 3 } },
      poolWithoutReprint,
    );
    if (!resolved.ok) throw new Error(JSON.stringify(resolved.problems, null, 2));
    const original = resolved.contents.cards.find((c) => c.cardId === "27019");
    expect(original?.quantity).toBe(3);
    expect(resolved.notes).toEqual([
      expect.objectContaining({ code: "reprint_resolved", cardIds: ["27050", "27019"] }),
    ]);

    const directHit = parseMarvelCdbDeckJson(
      { ...REAL_DECKLIST_RESPONSE, hero_code: "27001a", slots: { "27050": 3 } },
      SM_CARDS,
    );
    if (!directHit.ok) throw new Error(JSON.stringify(directHit.problems, null, 2));
    expect(directHit.contents.cards.find((c) => c.cardId === "27050")?.quantity).toBe(3);
    expect(directHit.notes).toBeUndefined();
  });

  test("an unknown code that is not a known reprint still fails loudly as unknown_card", () => {
    const result = parseMarvelCdbDeckJson(
      { ...REAL_DECKLIST_RESPONSE, slots: { ...REAL_DECKLIST_RESPONSE.slots, "99999z": 1 } },
      CORE_CARDS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContainEqual(expect.objectContaining({ code: "unknown_card", cardIds: ["99999z"] }));
  });

  test("more distinct cards than the importer accepts is refused before it is walked", () => {
    const hugeSlots = Object.fromEntries(Array.from({ length: 400 }, (_, i) => [`fake-${i}`, 1]));
    const result = parseMarvelCdbDeckJson({ ...REAL_DECKLIST_RESPONSE, slots: hugeSlots }, CORE_CARDS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toEqual([expect.objectContaining({ code: "oversized_input" })]);
  });
});

describe("parseMarvelCdbDeckJsonText", () => {
  test("parses a real fetch response body end to end", () => {
    const result = parseMarvelCdbDeckJsonText(JSON.stringify(REAL_DECKLIST_RESPONSE), CORE_CARDS);
    expect(result.ok).toBe(true);
  });

  test("an empty body — MarvelCDB's actual response for an unknown decklist id — fails loudly and specifically", () => {
    // Confirmed live 2026-09-13: GET /api/public/decklist/<unknown id>.json answers HTTP 200 with an empty body.
    const result = parseMarvelCdbDeckJsonText("", CORE_CARDS);
    expect(result).toEqual({ ok: false, problems: [expect.objectContaining({ code: "invalid_input" })] });
  });

  test("an HTML login page — what following the deck endpoint's redirect for an unknown/private id yields — fails loudly", () => {
    // Confirmed live 2026-09-13: GET /api/public/deck/<unknown id>.json redirects to /login.
    const result = parseMarvelCdbDeckJsonText("<!DOCTYPE html><html>...</html>", CORE_CARDS);
    expect(result).toEqual({ ok: false, problems: [expect.objectContaining({ code: "invalid_input" })] });
  });

  test("oversized input is refused before JSON.parse ever runs", () => {
    const result = parseMarvelCdbDeckJsonText("x".repeat(50_000), CORE_CARDS);
    expect(result).toEqual({ ok: false, problems: [expect.objectContaining({ code: "oversized_input" })] });
  });

  test("a `problem` field from MarvelCDB itself is surfaced rather than parsed further", () => {
    const result = parseMarvelCdbDeckJsonText(
      JSON.stringify({ ...REAL_DECKLIST_RESPONSE, problem: "too_many_cards" }),
      CORE_CARDS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0]!.message).toContain("too_many_cards");
  });
});

describe("the 'Pool aspect (wave 7 QA finding 2)", () => {
  const aspectOfCard = (id: string) => (PLAYABLE_CARDS.find((c) => c.id === id) as { aspect?: string }).aspect;
  const byAspect = (aspect: string) =>
    PLAYABLE_CARDS.find((c) => aspectOfCard(c.id as string) === aspect && c.type === "event")!.id as string;
  const [justice, leadership, protection, pool] = ["justice", "leadership", "protection", "pool"].map(byAspect) as [
    string,
    string,
    string,
    string,
  ];
  const deck = (heroCode: string, slots: Record<string, number>, meta?: Record<string, string>) => ({
    id: 1,
    name: "fixture",
    hero_code: heroCode,
    slots,
    ...(meta ? { meta: JSON.stringify(meta) } : {}),
  });
  const aspectsOf = (raw: unknown): string[] => {
    const result = parseMarvelCdbDeckJson(raw, PLAYABLE_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems.map((p) => p.message)));
    return [...result.contents.aspects];
  };

  test("a Deadpool deck whose meta names 'Pool keeps it", () => {
    expect(aspectsOf(deck("44001a", { "44013": 3, "44046": 1 }, { aspect: "pool" }))).toEqual(["pool"]);
  });

  test("a Core hero choosing 'Pool keeps it", () => {
    expect(aspectsOf(deck("01001a", { "44013": 3, "01008": 2 }, { aspect: "pool" }))).toEqual(["pool"]);
  });

  test.each([
    ["justice then leadership", { aspect: "justice", aspect2: "leadership" }],
    ["leadership then justice", { aspect: "leadership", aspect2: "justice" }],
    ["protection then justice", { aspect: "protection", aspect2: "justice" }],
    ["pool then justice", { aspect: "pool", aspect2: "justice" }],
    ["justice then pool", { aspect: "justice", aspect2: "pool" }],
    ["pool only", { aspect: "pool" }],
    ["no meta", undefined],
  ] as const)("Adam Warlock with 'Pool among four aspects, meta %s", (_label, meta) => {
    const slots = { [justice]: 1, [leadership]: 1, [protection]: 1, [pool]: 1 };
    expect([...aspectsOf(deck("21031a", slots, meta as Record<string, string> | undefined))].sort()).toEqual([
      "justice",
      "leadership",
      "pool",
      "protection",
    ]);
  });

  test("Adam Warlock with no meta and only three aspects among his cards stays unresolved", () => {
    const result = parseMarvelCdbDeckJson(
      deck("21031a", { [justice]: 1, [leadership]: 1, [protection]: 1 }),
      PLAYABLE_CARDS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((p) => p.code === "missing_aspect")).toBe(true);
  });
});
