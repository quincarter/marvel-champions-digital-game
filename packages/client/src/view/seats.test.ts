/**
 * Which hero seats can be taken, against the real Core starter decks.
 *
 * The case that matters is the one a player actually hit: the two Captain
 * Marvel decks are *different decks* with different aspects, so nothing about
 * their names says they collide — but they name the same identity, and a table
 * cannot hold two of the same unique card.
 */

import { describe, expect, test } from "vitest";
import { CORE_CARDS, CORE_STARTER_DECKS, type AnyCard } from "@mc/content";
import { seatOptions } from "./seats.js";

const CARDS = new Map<string, AnyCard>(CORE_CARDS.map((card) => [card.id as string, card]));
const options = (seated: readonly string[], max = 4) => seatOptions(CORE_STARTER_DECKS, seated, CARDS, max);
const find = (seated: readonly string[], deckId: string) => options(seated).find((o) => o.deckId === deckId)!;

describe("seatOptions", () => {
  test("the two Captain Marvel decks cannot sit together", () => {
    const leadership = "core-captain-marvel-leadership";
    const aggression = "core-captain-marvel-aggression-tutorial";
    // Different decks, different aspects, same identity card.
    expect(
      CORE_STARTER_DECKS.find((d) => (d.id as string) === leadership)!.identityCardId,
    ).toBe(CORE_STARTER_DECKS.find((d) => (d.id as string) === aggression)!.identityCardId);

    const blocked = find([leadership], aggression);
    expect(blocked.blockedBy).toContain("Captain Marvel");
  });

  test("a different hero is still free to sit down", () => {
    // Guard against over-rejecting: the rule is about one identity, not about
    // limiting the table.
    expect(find(["core-captain-marvel-leadership"], "core-spider-man-justice").blockedBy).toBeNull();
  });

  test("a seated deck is never blocked, so it can always be removed", () => {
    const seated = find(["core-spider-man-justice"], "core-spider-man-justice");
    expect(seated.seated).toBe(true);
    expect(seated.blockedBy).toBeNull();
  });

  test("nothing is blocked when the table is empty", () => {
    for (const option of options([])) expect(option.blockedBy, option.deckId).toBeNull();
  });

  test("a full table blocks the rest, and says why", () => {
    const full = ["core-spider-man-justice", "core-she-hulk-aggression"];
    const blocked = seatOptions(CORE_STARTER_DECKS, full, CARDS, 2).find((o) => !o.seated)!;
    expect(blocked.blockedBy).toContain("2 seats");
  });

  test("two identities sharing a title but not an alter-ego may coexist", () => {
    // The Rules Reference exception, which the Core Set cannot pose: this is
    // what stops the check degenerating into "same card id".
    const spiderMan = CARDS.get("01001a")!;
    const milesLike = { ...spiderMan, id: "99001a", alterEgo: { ...(spiderMan as never as { alterEgo: { faceName: string } }).alterEgo, faceName: "Miles Morales" } } as AnyCard;
    const cards = new Map(CARDS).set("99001a", milesLike);
    const decks = [
      CORE_STARTER_DECKS[0]!,
      { ...CORE_STARTER_DECKS[0]!, id: "other-spider-man" as never, identityCardId: "99001a" as never },
    ];
    const result = seatOptions(decks, [CORE_STARTER_DECKS[0]!.id as string], cards).find((o) => o.deckId === "other-spider-man")!;
    expect(result.blockedBy).toBeNull();
  });
});
