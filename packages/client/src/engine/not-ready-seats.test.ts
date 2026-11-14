import { describe, expect, test } from "vitest";
import { CORE_STARTER_DECKS, type StarterDeck, type StarterDeckId } from "@mc/content";
import { CARDS_BY_ID, POOL_STARTER_DECKS } from "../content/pool.js";

const BASE_IDS: ReadonlySet<string> = new Set(POOL_STARTER_DECKS.map((deck) => deck.id as string));
const lookupIn =
  (decks: readonly StarterDeck[]) =>
  (id: string): string | undefined =>
    decks.find((deck) => (deck.id as string) === id)?.identityCardId as string | undefined;
import { notReadySeatIdentity } from "./not-ready-seats.js";

const ELEKTRA_FIXTURE: StarterDeck = {
  ...CORE_STARTER_DECKS[0]!,
  id: "fixture-elektra" as StarterDeckId,
  identityCardId: "63001a" as StarterDeck["identityCardId"],
};

describe("notReadySeatIdentity", () => {
  test("a starterDeckId seat whose deck is led by Elektra is found", () => {
    const found = notReadySeatIdentity(
      [{ starterDeckId: "fixture-elektra" }],
      [],
      lookupIn([...POOL_STARTER_DECKS, ELEKTRA_FIXTURE]),
      CARDS_BY_ID,
      BASE_IDS,
    );
    expect(found?.id as string).toBe("63001a");
  });

  test("an explicit identity seat is found; ready heroes and unknown deck ids are not", () => {
    expect(
      notReadySeatIdentity(
        [{ identityCardId: "64001a", deck: [], aspects: [] }] as never,
        [],
        lookupIn([]),
        CARDS_BY_ID,
        BASE_IDS,
      ),
    ).not.toBeNull();
    expect(
      notReadySeatIdentity(
        [{ starterDeckId: CORE_STARTER_DECKS[0]!.id as string }],
        [],
        lookupIn(POOL_STARTER_DECKS),
        CARDS_BY_ID,
        BASE_IDS,
      ),
    ).toBeNull();
    expect(
      notReadySeatIdentity([{ starterDeckId: "nope" }], [], lookupIn(POOL_STARTER_DECKS), CARDS_BY_ID, BASE_IDS),
    ).toBeNull();
  });
});
