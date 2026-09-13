import { describe, expect, test } from "vitest";
import { CORE_CARDS } from "../data/core/cards.js";
import { CORE_STARTER_DECKS } from "../data/core/starterDecks.js";
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
    const result = parseMarvelCdbDeckJson({ ...REAL_DECKLIST_RESPONSE, slots: { ...REAL_DECKLIST_RESPONSE.slots, "99999z": 2 } }, CORE_CARDS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContainEqual(expect.objectContaining({ code: "unknown_card", cardIds: ["99999z"] }));
  });

  test("nonsense and negative quantities fail loudly rather than being dropped or clamped", () => {
    for (const bad of [0, -1, 1.5, "3", 9999]) {
      const result = parseMarvelCdbDeckJson({ ...REAL_DECKLIST_RESPONSE, slots: { "01044": bad as never } }, CORE_CARDS);
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
    const result = parseMarvelCdbDeckJson({ ...REAL_DECKLIST_RESPONSE, meta: '{"aspect":"protection","aspect_1":"justice"}' }, CORE_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    expect(result.contents.aspects).toEqual(["protection", "justice"]);
  });

  test("garbage that isn't an object at all fails loudly with one clear message", () => {
    expect(parseMarvelCdbDeckJson(null, CORE_CARDS)).toEqual({ ok: false, problems: [expect.objectContaining({ code: "invalid_input" })] });
    expect(parseMarvelCdbDeckJson("just some text", CORE_CARDS)).toEqual({ ok: false, problems: [expect.objectContaining({ code: "invalid_input" })] });
    expect(parseMarvelCdbDeckJson([1, 2, 3], CORE_CARDS)).toEqual({ ok: false, problems: [expect.objectContaining({ code: "invalid_input" })] });
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
    const result = parseMarvelCdbDeckJsonText(JSON.stringify({ ...REAL_DECKLIST_RESPONSE, problem: "too_many_cards" }), CORE_CARDS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0]!.message).toContain("too_many_cards");
  });
});
