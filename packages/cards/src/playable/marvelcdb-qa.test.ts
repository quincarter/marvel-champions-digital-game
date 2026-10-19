/**
 * Rules QA of the MarvelCDB deck integration (wave 9's twelve fetched decklists, the importer, `validateDeck`, and the
 * community-deck catalog). Sources: RRG 1.8 Appendix I "Player Decks" (p. 50: 40 to 50 cards, the identity and
 * permanent cards not counted, exact identity set, one aspect, at most three copies by title, no matching unique cards),
 * "Permanent" (p. 32), "Linked (Card Title)" (p. 27) and FFG's ruling of August 3, 2026 (ruling 4: linked cards cannot
 * be included in decks).
 *
 * What `marvelcdb-decklists.test.ts` and `wave9/custom-decks-marvelcdb.test.ts` already do and this file does not repeat:
 * import each fixture, check `validateDeck`, and play one seeded one-player game (the first at a Core villain, the
 * second at a wave 9 scenario; the second accepts a command cap in place of an outcome). This file adds an
 * independent legality computation from card data, a slots-to-contents multiset check, minimal decks per refusal code,
 * malformed input, two-player games mixing two of the decks (strict outcome), and a catalog-versus-JSON audit.
 */
import { createGame, replay, validateDeck, type DeckProblemCode } from "@mc/engine";
import {
  CATALOG_REPRINTS,
  PLAYABLE_CARDS,
  parseMarvelCdbDeckJson,
  parseMarvelCdbDeckJsonText,
  parseMarvelCdbReference,
  type AnyCard,
  type CardId,
  type CoreAspect,
  type DeckContents,
} from "@mc/content";
import { describe, expect, it, test } from "vitest";
import { playToOutcome } from "../testing/driver.js";
import { COMMUNITY_DECK_AUTHORS, communityDecks } from "./community-decks.js";
import { PLAYABLE_DEPS, playableScenario } from "./index.js";

interface Raw {
  id: number;
  name: string;
  user_id: number;
  hero_code: string;
  hero_name: string;
  description_md: string;
  meta: string;
  version: string;
  tags: string;
  slots: Record<string, number>;
}
const FIXTURES = (import.meta as unknown as { glob: (p: string, o: object) => unknown }).glob(
  "../wave9/fixtures/decklists/*.json",
  { import: "default", eager: true },
) as Record<string, Raw>;
const fixture = (file: string): Raw => {
  const raw = FIXTURES[`../wave9/fixtures/decklists/${file}.json`];
  if (!raw) throw new Error(`no fixture ${file}`);
  return raw;
};

/** file, hero, identity, aspects, author id and name as the wave 9 test header table gives them. */
const DECKS = [
  ["maria-hill-justice", "Maria Hill", "50001a", ["justice"], 34979, "Web-Warrior Fanatic"],
  ["maria-hill-leadership", "Maria Hill", "50001a", ["leadership"], 5, "dr00"],
  ["nick-fury-aggression", "Nick Fury", "50034a", ["aggression"], 14578, "SoloMarvelChampion"],
  ["nick-fury-justice", "Nick Fury", "50034a", ["justice"], 34979, "Web-Warrior Fanatic"],
  ["black-panther-protection", "Black Panther", "51001a", ["protection"], 16053, "VillainTheory"],
  ["black-panther-justice", "Black Panther", "51001a", ["justice"], 34979, "Web-Warrior Fanatic"],
  ["silk-leadership", "Silk", "52001a", ["leadership"], 34979, "Web-Warrior Fanatic"],
  ["silk-justice", "Silk", "52001a", ["justice"], 38537, "Daring Lime"],
  ["falcon-leadership", "Falcon", "53001a", ["leadership"], 34979, "Web-Warrior Fanatic"],
  ["falcon-pool", "Falcon", "53001a", ["pool"], 16053, "VillainTheory"],
  ["winter-soldier-pool", "Winter Soldier", "54001a", ["pool"], 28541, "andyr"],
  ["winter-soldier-aggression", "Winter Soldier", "54001a", ["aggression"], 34979, "Web-Warrior Fanatic"],
] as const;

const BY_ID = new Map<string, AnyCard>(PLAYABLE_CARDS.map((card) => [card.id as string, card]));
const hasKeyword = (card: AnyCard, name: string): boolean =>
  ((card as { keywords?: readonly { name: string }[] }).keywords ?? []).some((k) => k.name === name);
const aspectOf = (card: AnyCard): string | undefined => (card as { aspect?: string }).aspect;

const importRaw = (raw: unknown): DeckContents => {
  const result = parseMarvelCdbDeckJson(raw, PLAYABLE_CARDS);
  if (!result.ok) throw new Error(JSON.stringify(result.problems));
  return result.contents;
};
const total = (contents: DeckContents): number => contents.cards.reduce((n, line) => n + line.quantity, 0);
const countedSize = (contents: DeckContents): number =>
  contents.cards.reduce(
    (n, line) => n + (hasKeyword(BY_ID.get(line.cardId as string)!, "permanent") ? 0 : line.quantity),
    0,
  );
const codes = (contents: DeckContents): DeckProblemCode[] => {
  const verdict = validateDeck(contents, PLAYABLE_CARDS);
  return verdict.ok ? [] : [...new Set(verdict.problems.map((p) => p.code))].sort();
};
const message = (contents: DeckContents, code: DeckProblemCode): string => {
  const verdict = validateDeck(contents, PLAYABLE_CARDS);
  return verdict.ok ? "" : (verdict.problems.find((p) => p.code === code)?.message ?? "");
};
const withLines = (base: DeckContents, edit: (lines: { cardId: CardId; quantity: number }[]) => void): DeckContents => {
  const lines = base.cards.map((l) => ({ cardId: l.cardId, quantity: l.quantity }));
  edit(lines);
  return { ...base, cards: lines };
};

describe.each(DECKS)("wave 9 decklist %s", (file, hero, identity, aspects, authorId) => {
  const raw = fixture(file);
  const contents = importRaw(raw);

  it("imports to exactly the slots: every code kept, quantities equal, reprint codes resolved to the original", () => {
    const expected = new Map<string, number>();
    for (const [code, quantity] of Object.entries(raw.slots)) {
      const id = BY_ID.has(code) ? code : CATALOG_REPRINTS[code];
      expect(id && BY_ID.has(id), `slot ${code} resolves to a pool card`).toBe(true);
      expected.set(id!, (expected.get(id!) ?? 0) + quantity);
    }
    const got = new Map(contents.cards.map((line) => [line.cardId as string, line.quantity]));
    expect(got).toEqual(expected);
    expect(contents.cards.length).toBe(new Set(contents.cards.map((l) => l.cardId)).size);
  });

  it("names the right hero and aspect(s)", () => {
    expect(raw.hero_code).toBe(identity);
    expect(raw.hero_name).toBe(hero);
    expect(BY_ID.get(identity)?.type).toBe("hero_identity");
    expect(BY_ID.get(identity)?.name).toBe(hero);
    expect(contents.identityCardId).toBe(identity);
    expect([...contents.aspects]).toEqual([...aspects]);
    expect(JSON.parse(raw.meta)).toEqual({ aspect: aspects[0] });
  });

  it("is legal by an independent reading of RRG Appendix I (p. 50) and Permanent (p. 32)", () => {
    // 40 to 50 cards; the identity and permanent cards are not counted; hero (identity set) cards are counted.
    expect(countedSize(contents)).toBeGreaterThanOrEqual(40);
    expect(countedSize(contents)).toBeLessThanOrEqual(50);
    const byTitle = new Map<string, number>();
    const offAspectTitles = new Set<string>();
    for (const { cardId, quantity } of contents.cards) {
      const card = BY_ID.get(cardId as string)!;
      // Only player cards, none Linked (p. 27) and none from a separate deck.
      expect(["ally", "event", "support", "upgrade", "resource", "player_side_scheme"]).toContain(card.type);
      expect(hasKeyword(card, "linked"), `${card.name} is linked`).toBe(false);
      expect((card as { separateDeck?: string }).separateDeck, card.name).toBeUndefined();
      // Aspect rule: the chosen aspect, basic, or this hero's own identity set.
      const aspect = aspectOf(card);
      const onAspect = aspect === "basic" || aspect === `hero:${identity}` || aspects.includes(aspect as never);
      if (!onAspect) {
        // Only Maria Hill (50001b, RRG 1.8 FAQ "Maria Hill (#1B)", p. 64) may go off-aspect, and only with S.H.I.E.L.D.
        // supports, which the package check below requires to be exactly three titles at their maximum copies.
        expect(identity, `${card.name} (${aspect}) fits ${aspects.join("+")}`).toBe("50001a");
        expect(card.type).toBe("support");
        expect((card as unknown as { traits: string[] }).traits).toContain("S.H.I.E.L.D.");
        offAspectTitles.add(card.name);
        expect(quantity, `${card.name} at its maximum copies`).toBe(card.unique ? 1 : 3);
      }
      if (aspect === `hero:${identity}`) {
        expect(quantity, `${card.name} in its exact identity-set quantity`).toBe(
          (card as { quantityInSet: number }).quantityInSet,
        );
      }
      byTitle.set(card.name, (byTitle.get(card.name) ?? 0) + quantity);
      if (card.unique) expect(quantity, `${card.name} is unique`).toBe(1);
    }
    for (const [title, n] of byTitle) expect(n, `${title} copies`).toBeLessThanOrEqual(3);
    expect([0, 3]).toContain(offAspectTitles.size);
    expect(contents.cards.some((l) => aspectOf(BY_ID.get(l.cardId as string)!) === `hero:${identity}`)).toBe(true);
    // And the game's own check agrees.
    expect(validateDeck(contents, PLAYABLE_CARDS)).toEqual({ ok: true });
  });

  it("is in the community catalog with the JSON's own id, hero, aspect, name and author id", () => {
    const entry = communityDecks().find((d) => d.marvelcdbId === raw.id);
    expect(entry, "listed").toBeDefined();
    expect(entry!.name).toBe(raw.name.trim());
    expect(entry!.heroName).toBe(hero);
    expect(entry!.identityCardId).toBe(identity);
    expect([...entry!.aspects]).toEqual([...aspects]);
    expect(entry!.authorId).toBe(raw.user_id);
    expect(raw.user_id).toBe(authorId);
    expect(entry!.contents).toEqual(contents);
    expect(entry!.url).toBe(`https://marvelcdb.com/decklist/view/${raw.id}`);
    expect(entry!.version).toBe(raw.version);
    expect(entry!.description).toBe(raw.description_md);
    expect(entry!.tags).toEqual(
      raw.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    );
  });
});

describe("author credit: only what the JSON and the header table support", () => {
  it("each wave 9 deck is credited to the header table's author, matched through the JSON's user_id", () => {
    for (const [file, , , , authorId, authorName] of DECKS) {
      const raw = fixture(file);
      expect(raw.user_id, file).toBe(authorId);
      const entry = communityDecks().find((d) => d.marvelcdbId === raw.id)!;
      expect(entry.author, file).toBe(authorName);
      expect(COMMUNITY_DECK_AUTHORS[raw.user_id], file).toBe(authorName);
    }
  });

  it("no two user ids share a name (a copy-paste in the table would credit someone else's work)", () => {
    const names = Object.values(COMMUNITY_DECK_AUTHORS);
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length);
  });

  it("no catalog deck is credited to an author the table lacks, and no author is invented for a missing id", () => {
    for (const deck of communityDecks()) {
      expect(deck.author).toBe(COMMUNITY_DECK_AUTHORS[deck.authorId] ?? `MarvelCDB user ${deck.authorId}`);
    }
  });

  it("every catalog deck resolves to a real fixture whose own fields it repeats (all waves)", () => {
    const all = (import.meta as unknown as { glob: (p: string[], o: object) => unknown }).glob(
      ["./fixtures/*.json", "../wave*/**/fixtures/**/*.json"],
      { import: "default", eager: true },
    ) as Record<string, Raw>;
    const rawById = new Map(Object.values(all).map((r) => [r.id, r]));
    for (const deck of communityDecks()) {
      const raw = rawById.get(deck.marvelcdbId);
      expect(raw, `fixture for ${deck.marvelcdbId}`).toBeDefined();
      expect(deck.authorId).toBe(raw!.user_id);
      expect(deck.identityCardId).toBe(raw!.hero_code);
      expect(deck.heroName).toBe(raw!.hero_name);
      expect(validateDeck(deck.contents, PLAYABLE_CARDS), String(deck.marvelcdbId)).toEqual({ ok: true });
      const meta = JSON.parse(raw!.meta || "{}") as Record<string, string>;
      for (const aspect of Object.values(meta)) expect(deck.aspects as readonly string[]).toContain(aspect);
    }
  });
});

describe("reprint codes (MarvelCDB duplicate_of) map to the right card and merge", () => {
  // Every catalog reprint is now a card of its own in the pool (the wave 11 data emits reprints with
  // `duplicateOfCardId`), so the mapping path is driven against the pool without the reprint: what a deck naming a
  // reprint the pool does not hold meets. 03012 (Hawkeye, Hawkeye's pack) reprints Core's 01066.
  const REPRINT = "03012";
  const ORIGINAL = "01066";
  const withoutReprint = (reprint: string) => PLAYABLE_CARDS.filter((card) => (card.id as string) !== reprint);

  it("drives a real catalog pair", () => {
    expect(CATALOG_REPRINTS[REPRINT]).toBe(ORIGINAL);
    expect(BY_ID.has(ORIGINAL)).toBe(true);
  });

  it("a reprint code and its original on separate lines total on the original, with a note", () => {
    const base = fixture("silk-justice");
    const slots = { ...base.slots };
    delete slots[ORIGINAL];
    const result = parseMarvelCdbDeckJson(
      { ...base, slots: { ...slots, [REPRINT]: 2, [ORIGINAL]: 1 } },
      withoutReprint(REPRINT),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const lines = result.contents.cards.filter((l) => l.cardId === ORIGINAL);
    expect(lines).toEqual([{ cardId: ORIGINAL, quantity: 3 }]);
    expect(result.contents.cards.some((l) => l.cardId === REPRINT)).toBe(false);
    expect((result.notes ?? []).map((n) => n.code)).toContain("reprint_resolved");
    expect(codes(result.contents).includes("duplicate_entry")).toBe(false);
  });

  it("every reprint whose original is in the pool resolves to a card of the same title", () => {
    const wrong: string[] = [];
    let checked = 0;
    for (const [reprint, original] of Object.entries(CATALOG_REPRINTS)) {
      const card = BY_ID.get(original);
      if (!card) continue;
      checked += 1;
      const result = parseMarvelCdbDeckJson(
        { id: 1, name: "t", hero_code: "50001a", slots: { [reprint]: 1 }, meta: '{"aspect":"justice"}' },
        withoutReprint(reprint),
      );
      if (!result.ok || result.contents.cards.every((l) => l.cardId !== original))
        wrong.push(`${reprint}->${original}`);
    }
    expect(checked).toBeGreaterThan(0);
    expect(wrong).toEqual([]);
  });
});

/**
 * Minimal decks hitting each refusal code. `validateDeck` is the source of `linked_card` and `deck_size` (the importer
 * itself never emits them: it answers "what does this name?", `import/types.ts`).
 */
describe("refusal codes: deck_size and linked_card", () => {
  const silk = importRaw(fixture("silk-justice")); // 40 counted cards, no permanent
  const fury = importRaw(fixture("nick-fury-aggression")); // 43 listed, one permanent upgrade
  const isPad = (card: AnyCard): boolean =>
    ["ally", "event", "resource", "support", "upgrade"].includes(card.type) &&
    aspectOf(card) === "basic" &&
    !card.unique &&
    (card as { specificTo?: unknown }).specificTo === undefined &&
    (card as { separateDeck?: string }).separateDeck === undefined &&
    !hasKeyword(card, "linked") &&
    !hasKeyword(card, "permanent") &&
    !hasKeyword(card, "team-up");
  const grow = (base: DeckContents, n: number): DeckContents => {
    const have = new Set(base.cards.map((l) => l.cardId));
    const extra = PLAYABLE_CARDS.filter(
      (c) => isPad(c) && !have.has(c.id) && !base.cards.some((l) => BY_ID.get(l.cardId as string)!.name === c.name),
    );
    const out = withLines(base, () => {});
    let added = 0;
    for (const card of extra) {
      if (added >= n) break;
      const candidate = withLines(out, (lines) => lines.push({ cardId: card.id, quantity: 1 }));
      if (codes(candidate).length === 0 || codes(candidate).every((c) => c === "deck_size")) {
        (out.cards as { cardId: CardId; quantity: number }[]).push({ cardId: card.id, quantity: 1 });
        added += 1;
      }
    }
    expect(added).toBe(n);
    return out;
  };
  const shrink = (base: DeckContents, n: number): DeckContents =>
    withLines(base, (lines) => {
      let left = n;
      for (const line of lines.slice().reverse()) {
        const card = BY_ID.get(line.cardId as string)!;
        if (aspectOf(card)?.startsWith("hero:") || hasKeyword(card, "permanent")) continue;
        const take = Math.min(left, line.quantity);
        line.quantity -= take;
        left -= take;
        if (left === 0) break;
      }
      for (let i = lines.length - 1; i >= 0; i -= 1) if (lines[i]!.quantity === 0) lines.splice(i, 1);
    });

  test("RRG p. 50: 40 and 50 counted cards are legal, 39 and 51 are deck_size", () => {
    expect(countedSize(silk)).toBe(40);
    expect(codes(silk)).toEqual([]);
    const small = shrink(silk, 1);
    expect(countedSize(small)).toBe(39);
    expect(codes(small)).toEqual(["deck_size"]);
    expect(message(small, "deck_size")).toContain("39 cards");
    const fifty = grow(silk, 10);
    expect(countedSize(fifty)).toBe(50);
    expect(codes(fifty)).toEqual([]);
    const big = grow(silk, 11);
    expect(codes(big)).toEqual(["deck_size"]);
    expect(message(big, "deck_size")).toContain("51 cards");
  });

  test("RRG p. 32 Permanent: a permanent card never counts toward 40 or 50 (the importer's served total is not the size)", () => {
    const furyCounted = countedSize(fury);
    expect(total(fury)).toBe(43);
    expect(furyCounted).toBe(42);
    expect(codes(fury)).toEqual([]);
    // 39 counted plus the permanent card is still too small, though 40 are listed.
    const small = shrink(fury, furyCounted - 39);
    expect(total(small)).toBe(40);
    expect(codes(small)).toEqual(["deck_size"]);
    // 50 counted plus the permanent card is still legal, though 51 are listed.
    const fifty = grow(fury, 8);
    expect(total(fifty)).toBe(51);
    expect(codes(fifty)).toEqual([]);
  });

  test("RRG p. 50: hero (identity set) cards count toward the 40; the identity itself is not a listed card", () => {
    const hero = silk.cards.filter((l) => aspectOf(BY_ID.get(l.cardId as string)!) === "hero:52001a");
    expect(hero.length).toBeGreaterThan(0);
    expect(countedSize(silk)).toBe(40);
    const noIdentity = silk.cards.every((l) => BY_ID.get(l.cardId as string)!.type !== "hero_identity");
    expect(noIdentity).toBe(true);
    const withIdentity = withLines(silk, (lines) => lines.push({ cardId: "52001a" as CardId, quantity: 1 }));
    expect(codes(withIdentity)).toEqual(["identity_in_deck"]);
  });

  test("RRG p. 27 Linked: a linked card listed in a deck is refused, even a hero's own, and never counts toward size", () => {
    const shield = BY_ID.get("53034");
    expect(shield && hasKeyword(shield, "linked")).toBe(true);
    const falcon = importRaw(fixture("falcon-leadership"));
    const listed = withLines(falcon, (lines) => lines.push({ cardId: "53034" as CardId, quantity: 1 }));
    expect(codes(listed)).toEqual(["linked_card"]);
    // A 50-card deck plus the Shield: exactly one problem, no deck_size (linked cards "do not count toward the
    // minimum or maximum deck size", p. 27), so the refusal is the linked one alone.
    const fifty = grow(silk, 10);
    const fiftyShield = withLines(fifty, (lines) => lines.push({ cardId: "53034" as CardId, quantity: 1 }));
    expect(codes(fiftyShield)).toEqual(["linked_card"]);
    // A 39-card deck plus the Shield is still 39: the linked card does not make up the numbers.
    const small = withLines(shrink(silk, 1), (lines) => lines.push({ cardId: "53034" as CardId, quantity: 1 }));
    expect(codes(small)).toEqual(["deck_size", "linked_card"]);
  });

  // Owner decision 61B (2026-10-11): the importer leaves a listed linked card out and says so, and the rest imports.
  test("a MarvelCDB decklist whose slots list the linked card imports without it, with a note naming the card", () => {
    const base = fixture("falcon-leadership");
    const plain = parseMarvelCdbDeckJson(base, PLAYABLE_CARDS);
    const result = parseMarvelCdbDeckJson({ ...base, slots: { ...base.slots, "53034": 1 } }, PLAYABLE_CARDS);
    expect(result.ok && plain.ok).toBe(true);
    if (!result.ok || !plain.ok) return;
    expect(result.contents).toEqual(plain.contents);
    expect(codes(result.contents)).toEqual([]);
    const dropped = (result.notes ?? []).filter((note) => note.code === "linked_card_dropped");
    expect(dropped).toHaveLength(1);
    expect(dropped[0]!.cardIds).toEqual(["53034"]);
    expect(dropped[0]!.message).toMatch(/Captain America's Shield.*Linked.*left out/);
    expect((plain.notes ?? []).some((note) => note.code === "linked_card_dropped")).toBe(false);
  });

  test("the linked refusal names the card and the reason", () => {
    const falcon = importRaw(fixture("falcon-leadership"));
    const listed = withLines(falcon, (lines) => lines.push({ cardId: "53034" as CardId, quantity: 1 }));
    expect(message(listed, "linked_card")).toMatch(/Captain America's Shield.*Linked.*cannot be included/);
  });

  test("a separate-deck card (Doctor Strange's Invocations) is refused and not counted either", () => {
    const invocation = PLAYABLE_CARDS.find((c) => (c as { separateDeck?: string }).separateDeck !== undefined);
    expect(invocation).toBeDefined();
    const listed = withLines(silk, (lines) => lines.push({ cardId: invocation!.id, quantity: 1 }));
    expect(codes(listed)).toEqual(["separate_deck_card"]);
  });

  test("other deckbuilding refusals, each with its RRG page 50 / Unique rule source", () => {
    const aspectCard = (aspect: string, unique = false): AnyCard =>
      PLAYABLE_CARDS.find(
        (c) =>
          aspectOf(c) === aspect &&
          c.unique === unique &&
          isPad({ ...c, ...({ aspect: "basic" } as object) } as AnyCard) &&
          !silk.cards.some((l) => BY_ID.get(l.cardId as string)!.name === c.name),
      )!;
    // Aspect rule: an aggression card in a Justice deck (the swap keeps the size at 40).
    const aggression = aspectCard("aggression");
    const swapped = withLines(silk, (lines) => {
      const first = lines.find((l) => aspectOf(BY_ID.get(l.cardId as string)!) === "justice" && l.quantity === 1)!;
      first.cardId = aggression.id;
    });
    expect(codes(swapped)).toEqual(["aspect_restriction"]);
    // Copies limit: four of one nonunique card (swap 3 for 4 by taking a card from another line).
    const three = silk.cards.find(
      (l) => l.quantity === 3 && !aspectOf(BY_ID.get(l.cardId as string)!)?.startsWith("hero:"),
    );
    const donor = silk.cards.find(
      (l) => l !== three && l.quantity >= 1 && !aspectOf(BY_ID.get(l.cardId as string)!)?.startsWith("hero:"),
    )!;
    if (three) {
      const four = withLines(silk, (lines) => {
        lines.find((l) => l.cardId === three.cardId)!.quantity = 4;
        lines.find((l) => l.cardId === donor.cardId)!.quantity -= 1;
      });
      expect(codes(four)).toContain("copy_limit");
    }
    // Identity set: a hero card removed.
    const heroLine = silk.cards.find((l) => aspectOf(BY_ID.get(l.cardId as string)!) === "hero:52001a")!;
    const noHero = withLines(silk, (lines) =>
      lines.splice(
        lines.findIndex((l) => l.cardId === heroLine.cardId),
        1,
      ),
    );
    expect(codes(noHero)).toContain("identity_set_mismatch");
    // Another hero's identity-set card.
    const falconCard = importRaw(fixture("falcon-leadership")).cards.find(
      (l) => aspectOf(BY_ID.get(l.cardId as string)!) === "hero:53001a",
    )!;
    expect(codes(withLines(silk, (lines) => lines.push({ cardId: falconCard.cardId, quantity: 1 })))).toContain(
      "other_identity_card",
    );
    // One aspect only (p. 50): two aspects for a one-aspect hero.
    expect(codes({ ...silk, aspects: ["justice", "leadership"] as CoreAspect[] })).toContain("aspect_choice");
    // "basic" is not a choosable aspect.
    expect(codes({ ...silk, aspects: ["basic"] as unknown as CoreAspect[] })).toContain("aspect_choice");
  });
});

describe("malformed input to the importer: a refusal with a reason, never a throw or a half-built deck", () => {
  const base = fixture("silk-justice");
  const refused = (text: string) => {
    let result: ReturnType<typeof parseMarvelCdbDeckJsonText> | undefined;
    expect(() => (result = parseMarvelCdbDeckJsonText(text, PLAYABLE_CARDS))).not.toThrow();
    expect(result!.ok).toBe(false);
    if (result!.ok) return [];
    expect(result!.problems.length).toBeGreaterThan(0);
    for (const p of result!.problems) expect(p.message.length).toBeGreaterThan(10);
    expect("contents" in result!).toBe(false);
    return result!.problems.map((p) => p.code);
  };
  const withSlots = (slots: unknown, extra: object = {}) => JSON.stringify({ ...base, slots, ...extra });

  test("unknown card code", () => {
    expect(refused(withSlots({ ...base.slots, "99999": 1 }))).toEqual(["unknown_card"]);
  });
  test("zero, negative, fractional, string and oversized quantities", () => {
    for (const q of [0, -1, 1.5, "2", null, 51, 1e9]) {
      expect(refused(withSlots({ ...base.slots, "01001": q })), `quantity ${String(q)}`).toEqual(["invalid_quantity"]);
    }
  });
  test("a hero_code that is unknown, or a real card that is not an identity", () => {
    expect(refused(JSON.stringify({ ...base, hero_code: "00000a" }))).toEqual(["unknown_identity"]);
    expect(refused(JSON.stringify({ ...base, hero_code: Object.keys(base.slots)[0] }))).toEqual(["not_an_identity"]);
  });
  test("no hero_code, or one that is not a string", () => {
    expect(refused(JSON.stringify({ ...base, hero_code: "" }))).toContain("missing_identity");
    expect(refused(JSON.stringify({ ...base, hero_code: 5 }))).toContain("missing_identity");
  });
  test("a hero mismatch (Silk's cards under Falcon) imports, then validateDeck refuses with the identity-set reason", () => {
    const result = parseMarvelCdbDeckJsonText(JSON.stringify({ ...base, hero_code: "53001a" }), PLAYABLE_CARDS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(codes(result.contents)).toEqual(expect.arrayContaining(["other_identity_card", "identity_set_mismatch"]));
  });
  test("an empty card list is refused by the importer, or by validateDeck as deck_size: never a legal deck", () => {
    const result = parseMarvelCdbDeckJsonText(withSlots({}), PLAYABLE_CARDS);
    if (result.ok) {
      expect(result.contents.cards).toEqual([]);
      expect(codes(result.contents)).toContain("deck_size");
    } else {
      expect(result.problems.length).toBeGreaterThan(0);
    }
  });
  test("slots missing, an array, or null", () => {
    for (const slots of [undefined, [], null, "x"]) {
      expect(refused(JSON.stringify({ ...base, slots })), JSON.stringify(slots)).toEqual(["invalid_input"]);
    }
  });
  test("a missing or empty aspect", () => {
    expect(refused(JSON.stringify({ ...base, meta: "" }))).toEqual(["missing_aspect"]);
    expect(refused(JSON.stringify({ ...base, meta: "not json" }))).toEqual(["missing_aspect"]);
    expect(refused(JSON.stringify({ ...base, meta: null }))).toEqual(["missing_aspect"]);
  });
  test("a nonsense aspect imports and validateDeck refuses it with aspect_choice", () => {
    const result = parseMarvelCdbDeckJsonText(JSON.stringify({ ...base, meta: '{"aspect":"cheese"}' }), PLAYABLE_CARDS);
    expect(result.ok).toBe(true);
    if (result.ok) expect(codes(result.contents)).toContain("aspect_choice");
  });
  test("things that are not a deck: empty body, HTML, plain text, null, a number, an array, a bare id", () => {
    for (const text of ["", "<html><body>login</body></html>", "not a deck", "null", "123", "[]", '"x"', "{}", "{"]) {
      expect(refused(text), JSON.stringify(text)).not.toEqual([]);
    }
  });
  test("MarvelCDB's own `problem` field is surfaced", () => {
    expect(refused(JSON.stringify({ ...base, problem: "deck not found" }))).toEqual(["invalid_input"]);
  });
  test("more than 300 distinct slot lines is oversized_input", () => {
    const slots: Record<string, number> = {};
    for (let i = 0; i < 301; i += 1) slots[String(10000 + i)] = 1;
    expect(refused(withSlots(slots))).toEqual(["oversized_input"]);
  });
  test("a reference string that is not a deck link or id is not parsed", () => {
    for (const text of [
      "",
      "abc",
      "marvelcdb.com/card/01001",
      "12ab",
      "-5",
      "1e3",
      "https://example.com/decklist/view/5",
    ]) {
      expect(parseMarvelCdbReference(text), JSON.stringify(text)).toBeNull();
    }
    expect(parseMarvelCdbReference("https://marvelcdb.com/decklist/view/47248/x")).toEqual({
      kind: "decklist",
      id: "47248",
    });
  });
});

describe("a legal deck is not refused because of its write-up", () => {
  // A MarvelCDB response carries the author's write-up (`description_md`): Magik's (37117) is 34,640 characters. The
  // response has its own cap (`MAX_MARVELCDB_RESPONSE_LENGTH`), well above the pasted-text one, because no rule in the
  // RRG limits a deck's prose and the importer reads only the deck list.
  it("a legal decklist with a 30,000-character description imports", () => {
    const base = fixture("silk-justice");
    const result = parseMarvelCdbDeckJsonText(
      JSON.stringify({ ...base, description_md: "x".repeat(30_000) }),
      PLAYABLE_CARDS,
    );
    expect(result.ok).toBe(true);
  });
});

describe("the community feature never restricts or alters a player's own decks", () => {
  it("an arbitrary legal deck of an unlisted composition imports and validates exactly as before", () => {
    const raw = fixture("winter-soldier-aggression");
    const shuffled = Object.fromEntries(Object.entries(raw.slots).reverse());
    const a = importRaw({ ...raw, id: 999_999_999, user_id: 1, name: "my own", slots: shuffled });
    expect(validateDeck(a, PLAYABLE_CARDS)).toEqual({ ok: true });
    expect(communityDecks().some((d) => d.marvelcdbId === 999_999_999)).toBe(false);
  });
  it("a card outside the playable pool is refused with its code, not dropped or substituted", () => {
    const raw = fixture("falcon-pool");
    const result = parseMarvelCdbDeckJson({ ...raw, slots: { ...raw.slots, "99999": 1 } }, PLAYABLE_CARDS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.map((p) => p.code)).toEqual(["unknown_card"]);
    expect(result.problems[0]!.message).toContain("99999");
    expect(result.problems[0]!.cardIds).toEqual(["99999"]);
  });
  it("importing does not mutate its input, and two imports of the same JSON are equal but independent", () => {
    const raw = fixture("maria-hill-leadership");
    const before = JSON.stringify(raw);
    const a = importRaw(raw);
    const b = importRaw(raw);
    expect(JSON.stringify(raw)).toBe(before);
    expect(a).toEqual(b);
    expect(a.cards).not.toBe(b.cards);
  });
});

describe("games: two-player tables mixing two of the decks (strict outcome, deep-equal replay)", () => {
  // Four pairs only (about 30 s): the other two pairs tried, Falcon + Nick Fury at MODOK and Silk + Black Panther at
  // Batroc, took 48 s and 32 s and also ended in an outcome that replayed deep-equal.
  // Pairs of different heroes (identities that match cannot be chosen together, RRG Unique Icon, Appendix II step 1).
  const pairs = [
    ["maria-hill-justice", "falcon-pool", "thunderbolts", 301],
    ["nick-fury-aggression", "silk-leadership", "black-widow", 302],
    ["black-panther-protection", "winter-soldier-pool", "baron-zemo", 303],
    ["winter-soldier-aggression", "maria-hill-leadership", "rhino", 306],
  ] as const;
  test.each(pairs)(
    "%s + %s at %s",
    (a, b, scenario, seed) => {
      const seat = (file: string) => {
        const contents = importRaw(fixture(file));
        return {
          identityCardId: contents.identityCardId,
          deck: contents.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
          aspects: contents.aspects as readonly CoreAspect[],
        };
      };
      const config = playableScenario(scenario, { seed, players: [seat(a), seat(b)] });
      const created = createGame(config, PLAYABLE_DEPS);
      if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
      const result = playToOutcome(created.state, PLAYABLE_DEPS);
      expect(result.outcome).not.toBeNull();
      const replayed = replay(result.session.log, PLAYABLE_DEPS);
      expect(replayed.ok).toBe(true);
      if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
    },
    120_000,
  );
});
