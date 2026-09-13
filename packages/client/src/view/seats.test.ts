/**
 * Which hero seats can be taken, against the real Core starter decks (as
 * `DeckOption`s, the same shape a saved or imported deck arrives in).
 *
 * The case that matters is the one a player actually hit: the two Captain
 * Marvel decks are *different decks* with different aspects, so nothing about
 * their names says they collide — but they name the same identity, and a table
 * cannot hold two of the same unique card.
 */

import { describe, expect, test } from "vitest";
import { CORE_CARDS, CORE_POOL_VERSION, CORE_STARTER_DECKS, deckFromStarterDeck, type AnyCard, type Deck } from "@mc/content";
import { CORE_DEPS } from "@mc/cards";
import { deckOptionOf, type DeckOption } from "./deck-list-model.js";
import { seatOptions } from "./seats.js";

const CARDS = new Map<string, AnyCard>(CORE_CARDS.map((card) => [card.id as string, card]));
const optionOf = (deck: Deck): DeckOption => deckOptionOf(deck, CORE_CARDS, CORE_POOL_VERSION, CORE_DEPS);
const PRECON_OPTIONS: readonly DeckOption[] = CORE_STARTER_DECKS.map((starter) => optionOf(deckFromStarterDeck(starter, CORE_POOL_VERSION)));

const options = (seated: readonly string[], max = 4) => seatOptions(PRECON_OPTIONS, seated, CARDS, max);
const find = (seated: readonly string[], deckId: string) => options(seated).find((o) => o.deckId === deckId)!;

describe("seatOptions", () => {
  test("the two Captain Marvel decks cannot sit together", () => {
    const leadership = "precon:core-captain-marvel-leadership";
    const aggression = "precon:core-captain-marvel-aggression-tutorial";
    // Different decks, different aspects, same identity card.
    expect(
      PRECON_OPTIONS.find((o) => (o.deck.id as string) === leadership)!.deck.identityCardId,
    ).toBe(PRECON_OPTIONS.find((o) => (o.deck.id as string) === aggression)!.deck.identityCardId);

    const blocked = find([leadership], aggression);
    expect(blocked.blockedBy).toContain("Captain Marvel");
  });

  test("a different hero is still free to sit down", () => {
    // Guard against over-rejecting: the rule is about one identity, not about
    // limiting the table.
    expect(find(["precon:core-captain-marvel-leadership"], "precon:core-spider-man-justice").blockedBy).toBeNull();
  });

  test("a seated deck is never blocked, so it can always be removed", () => {
    const seated = find(["precon:core-spider-man-justice"], "precon:core-spider-man-justice");
    expect(seated.seated).toBe(true);
    expect(seated.blockedBy).toBeNull();
  });

  test("nothing is blocked when the table is empty", () => {
    for (const option of options([])) expect(option.blockedBy, option.deckId).toBeNull();
  });

  test("a full table blocks the rest, and says why", () => {
    const full = ["precon:core-spider-man-justice", "precon:core-she-hulk-aggression"];
    const blocked = seatOptions(PRECON_OPTIONS, full, CARDS, 2).find((o) => !o.seated)!;
    expect(blocked.blockedBy).toContain("2 seats");
  });

  test("two identities sharing a title but not an alter-ego may coexist", () => {
    // The Rules Reference exception, which the Core Set cannot pose: this is
    // what stops the check degenerating into "same card id". Built as bare
    // `DeckOption`s (rather than through `deckOptionOf`/`validateDeck`) so this
    // stays a unit test of `seatOptions`'s own clash logic, not of deckbuilding
    // legality — a full identity-specific card list swapped onto a different
    // identity id would (correctly) fail `validateDeck` for an unrelated reason.
    const spiderMan = CARDS.get("01001a")!;
    const milesLike = { ...spiderMan, id: "99001a", alterEgo: { ...(spiderMan as never as { alterEgo: { faceName: string } }).alterEgo, faceName: "Miles Morales" } } as AnyCard;
    const cards = new Map(CARDS).set("99001a", milesLike);
    const bareOption = (deck: Deck): DeckOption => ({
      deck,
      identityName: null,
      legal: true,
      problems: [],
      unscripted: [],
      poolChanged: false,
      seatable: true,
      blockedReason: null,
    });
    const otherDeck: Deck = { ...deckFromStarterDeck(CORE_STARTER_DECKS[0]!, CORE_POOL_VERSION), id: "other-spider-man" as never, identityCardId: "99001a" as never };
    const decks = [PRECON_OPTIONS[0]!, bareOption(otherDeck)];
    const result = seatOptions(decks, [PRECON_OPTIONS[0]!.deck.id as string], cards).find((o) => o.deckId === "other-spider-man")!;
    expect(result.blockedBy).toBeNull();
  });

  test("a deck that cannot be seated (illegal, or missing scripts) is blocked with the engine's own reason", () => {
    const illegal: Deck = { ...deckFromStarterDeck(CORE_STARTER_DECKS[0]!, CORE_POOL_VERSION), id: "illegal-deck" as never, cards: [] };
    const decks = [PRECON_OPTIONS[0]!, optionOf(illegal)];
    const result = seatOptions(decks, [], CARDS).find((o) => o.deckId === "illegal-deck")!;
    expect(result.blockedBy).not.toBeNull();
    expect(result.blockedBy).toBe(optionOf(illegal).blockedReason);
  });
});
