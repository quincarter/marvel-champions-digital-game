/**
 * The community-deck catalog's own shape: every saved decklist is listed once, credited and linked. That each one
 * imports, is legal and plays to an outcome is the job of `marvelcdb-decklists.ts` (run as
 * `marvelcdb-decklists-<part>.test.ts`), which iterates this same catalog.
 */
import { PLAYABLE_CARDS } from "@mc/content";
import { describe, expect, test } from "vitest";
import { COMMUNITY_DECK_AUTHORS, communityDecks, skippedCommunityDecks } from "./community-decks.js";

const HEROES = new Set(PLAYABLE_CARDS.filter((card) => card.type === "hero_identity").map((card) => card.id as string));

describe("community decks", () => {
  const decks = communityDecks();

  test("every saved decklist for a playable hero is in the catalog", () => {
    expect(
      skippedCommunityDecks().filter((skipped) => skipped.heroCode !== null && HEROES.has(skipped.heroCode)),
    ).toEqual([]);
    expect(decks.length).toBeGreaterThanOrEqual(68);
  });

  test("each deck is listed once, by hero and then MarvelCDB id", () => {
    const ids = decks.map((deck) => deck.marvelcdbId);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = decks.map((deck) => `${deck.identityCardId}:${String(deck.marvelcdbId).padStart(9, "0")}`);
    expect(keys).toEqual([...keys].sort());
  });

  test.each(decks.map((deck) => [deck.marvelcdbId, deck] as const))(
    "decklist %i has a name, hero, author and URL",
    (id, deck) => {
      expect(deck.name.length).toBeGreaterThan(0);
      expect(HEROES.has(deck.identityCardId as string)).toBe(true);
      expect(deck.heroName.length).toBeGreaterThan(0);
      expect(deck.aspects.length).toBeGreaterThan(0);
      expect(deck.authorId).toBeGreaterThan(0);
      expect(deck.author).toBe(COMMUNITY_DECK_AUTHORS[deck.authorId] ?? `MarvelCDB user ${deck.authorId}`);
      expect(deck.authorNamed).toBe(deck.authorId in COMMUNITY_DECK_AUTHORS);
      expect(deck.url).toBe(`https://marvelcdb.com/decklist/view/${id}`);
      expect(deck.publishedAt).not.toBeNull();
    },
  );

  test("every author is named: no deck falls back to its MarvelCDB user id", () => {
    expect(
      decks.filter((deck) => !deck.authorNamed).map((deck) => `${deck.marvelcdbId} (user ${deck.authorId})`),
    ).toEqual([]);
  });

  test("every deck but one carries its author's write-up", () => {
    // Magik's (37117) runs to 34,640 characters, which would put its fixture past the importer's 20,000-character cap.
    expect(decks.filter((deck) => deck.description.trim().length === 0).map((deck) => deck.marvelcdbId)).toEqual([
      37117,
    ]);
  });

  test("a hero can have more than one deck", () => {
    const doctorStrange = decks.filter((deck) => deck.identityCardId === "09001a").map((deck) => deck.marvelcdbId);
    expect(doctorStrange).toEqual([1771, 34506]);
  });
});
