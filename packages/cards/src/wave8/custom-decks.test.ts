/**
 * Wave 8 definition-of-done 4b, pieces 2 and 3 (docs/wave-definition-of-done.md, docs/custom-deck-testing.md "The
 * pieces") for the six new heroes: Bishop and Magik (`aoa`), Iceman, Jubilee, Nightcrawler and Magneto.
 *
 * 1. The deck builder's start state: `requiredIdentitySet` is exactly each hero's signature cards (RRG 1.8 Appendix I
 *    "Deck Customization", p. 50: "the exact quantity of each card included in that identity set").
 * 2. The wave's deckbuilding rules, one illegal deck per rule with the problem code and its player-readable message.
 *
 * What the six identities print as deckbuilding rules (docs/phase7-wave8.md section 7 "Deckbuilding (DoD 4b)" bullets of
 * each pass, and `deckbuilding` on the identity records): none of them prints a deckbuilding line. The wave's rules are
 * all card-level:
 * - Iceman's six Frostbite are Permanent and in his identity set (RRG 1.8 "Permanent", p. 32): required at exactly six,
 *   never counted toward the 40 to 50.
 * - Jubilee's Firecracker, Flash of Light and Plasmoid Energy are three records each, one copy of each in the set
 *   (section 3.69; RRG "Copy", p. 13).
 * - Unlikely Duo is a Team-Up card (Jubilee and Wolverine) with "Max 1 per deck" (RRG "Team-Up", p. 43).
 * - Surge, Anole, Bling! and Indra are Linked to New Recruits and can be in no deck (RRG "Linked", p. 27; ruling August
 *   3, 2026 - Ruling 4 (3)).
 * - "Max 1 per deck" and "Max 2 per deck" on aspect and basic cards (Sidekick, Bloodgem, Energy; The Power of ...).
 * - The Age of Apocalypse campaign cards (45171a to 45176) are campaign-specific (RRG "Campaign-Specific Card", p. 11).
 * - "Play only if your identity has ..." (Bloodgem, Basic Spell, Moira MacTaggert, ...) is a play restriction, not a deck
 *   rule: such a card is legal in any deck (section 7.1 to 7.5).
 * - The unique rule in a deck (RRG "Unique Icon", pp. 45-46): the clashes of Iceman, Jubilee, Nightcrawler and Magneto
 *   with earlier allies are proven in `rulings.qa.test.ts` (January 26, 2026 - Ruling 4 (7)); Bishop's, Magik's and the
 *   two new Leadership allies' clashes are here.
 *
 * Decks are validated against `PLAYABLE_CARDS` (it holds Core, every earlier wave and wave 8's data), because a custom
 * deck may name any earlier card (a Wolverine deck for the Team-Up, Gambit's ally 37011).
 */
import { describe, expect, test } from "vitest";
import { requiredIdentitySet, unscriptedCards, validateDeck, type CampaignDeckContext } from "@mc/engine";
import {
  CORE_STARTER_DECKS,
  PLAYABLE_CARDS,
  WAVE2_STARTER_DECKS,
  WAVE3_STARTER_DECKS,
  WAVE4_STARTER_DECKS,
  WAVE5_STARTER_DECKS,
  WAVE6_STARTER_DECKS,
  WAVE7_STARTER_DECKS,
  WAVE8_STARTER_DECKS,
  WAVE1_STARTER_DECKS,
  cardId,
  type AnyCard,
  type DeckContents,
  type HeroIdentityCard,
  type StarterDeck,
} from "@mc/content";
import { WAVE8_DEPS } from "./index.js";

const ALL_STARTER_DECKS: readonly StarterDeck[] = [
  ...CORE_STARTER_DECKS,
  ...WAVE1_STARTER_DECKS,
  ...WAVE2_STARTER_DECKS,
  ...WAVE3_STARTER_DECKS,
  ...WAVE4_STARTER_DECKS,
  ...WAVE5_STARTER_DECKS,
  ...WAVE6_STARTER_DECKS,
  ...WAVE7_STARTER_DECKS,
  ...WAVE8_STARTER_DECKS,
];

const byId = new Map<string, AnyCard>(PLAYABLE_CARDS.map((card) => [card.id as string, card]));
const identityOf = (id: string): HeroIdentityCard => {
  const card = byId.get(id);
  if (!card || card.type !== "hero_identity") throw new Error(`no identity ${id}`);
  return card;
};
const starter = (id: string): StarterDeck => {
  const deck = ALL_STARTER_DECKS.find((d) => d.id === id);
  if (!deck) throw new Error(`no starter deck ${id}`);
  return deck;
};
const contentsOf = (deck: StarterDeck): DeckContents => ({
  identityCardId: deck.identityCardId,
  aspects: deck.aspects,
  cards: deck.cards,
});
const deckOf = (id: string): DeckContents => contentsOf(starter(id));

/** `deck` with `quantity` (0 removes the line) of `card` instead of whatever it had. */
const withQuantity = (deck: DeckContents, card: string, quantity: number): DeckContents => ({
  ...deck,
  cards: [
    ...deck.cards.filter((l) => l.cardId !== card),
    ...(quantity > 0 ? [{ cardId: cardId(card), quantity }] : []),
  ],
});
/** `deck` with a new line for `card` (a card the deck does not list yet). */
const adding = (deck: DeckContents, card: string, quantity = 1): DeckContents => ({
  ...deck,
  cards: [...deck.cards, { cardId: cardId(card), quantity }],
});
const problemsOf = (deck: DeckContents, context?: { campaign: CampaignDeckContext }) => {
  const verdict = validateDeck(deck, PLAYABLE_CARDS, context);
  if (verdict.ok) throw new Error("expected an illegal deck");
  return verdict.problems;
};
const codesOf = (deck: DeckContents): string[] => problemsOf(deck).map((p) => p.code);
const messageOf = (deck: DeckContents, code: string): string | undefined =>
  problemsOf(deck).find((p) => p.code === code)?.message;
const countedSize = (deck: DeckContents): number => deck.cards.reduce((n, l) => n + l.quantity, 0);

const HEROES = [
  { name: "Bishop", who: "Bishop (Lucas Bishop)", identity: "45001a", deck: "bishop-leadership", aspect: "leadership" },
  {
    name: "Magik",
    who: "Magik (Illyana Rasputin)",
    identity: "45030a",
    deck: "magik-aggression",
    aspect: "aggression",
  },
  { name: "Iceman", who: "Iceman (Bobby Drake)", identity: "46001a", deck: "iceman-aggression", aspect: "aggression" },
  { name: "Jubilee", who: "Jubilee (Jubilation Lee)", identity: "47001a", deck: "jubilee-justice", aspect: "justice" },
  {
    name: "Nightcrawler",
    who: "Nightcrawler (Kurt Wagner)",
    identity: "48001a",
    deck: "nightcrawler-protection",
    aspect: "protection",
  },
  {
    name: "Magneto",
    who: "Magneto (Erik Lehnsherr)",
    identity: "49001a",
    deck: "magneto-leadership",
    aspect: "leadership",
  },
] as const;

/** Each hero's signature cards, written out from the printed hero-pack lists (docs/phase7-wave8.md section 7; starter deck provenance). */
const EXPECTED_SET: Readonly<Record<string, readonly (readonly [string, number])[]>> = {
  // Bishop: 15 cards.
  "45001a": [
    ["45002", 1],
    ["45003", 1],
    ["45004", 1],
    ["45005", 1],
    ["45006", 2],
    ["45007", 2],
    ["45008", 2],
    ["45009", 2],
    ["45010", 3],
  ],
  // Magik: 15 cards.
  "45030a": [
    ["45031", 1],
    ["45032", 1],
    ["45033", 1],
    ["45034", 1],
    ["45035", 1],
    ["45036", 1],
    ["45037", 3],
    ["45038", 2],
    ["45039", 2],
    ["45040", 2],
  ],
  // Iceman: 15 cards plus his six Permanent Frostbite (46002), 21 in the set.
  "46001a": [
    ["46002", 6],
    ["46003", 2],
    ["46004", 1],
    ["46005", 1],
    ["46006", 1],
    ["46007", 2],
    ["46008", 1],
    ["46009", 2],
    ["46010", 2],
    ["46011", 3],
  ],
  // Jubilee: 15 cards; Firecracker, Flash of Light and Plasmoid Energy are each three version records at one copy.
  "47001a": [
    ["47002", 1],
    ["47003", 1],
    ["47004", 1],
    ["47005", 1],
    ["47006", 1],
    ["47007a", 1],
    ["47007b", 1],
    ["47007c", 1],
    ["47008a", 1],
    ["47008b", 1],
    ["47008c", 1],
    ["47009", 1],
    ["47010a", 1],
    ["47010b", 1],
    ["47010c", 1],
  ],
  // Nightcrawler: 15 cards.
  "48001a": [
    ["48002", 1],
    ["48003", 1],
    ["48004", 1],
    ["48005", 1],
    ["48006", 3],
    ["48007", 2],
    ["48008", 1],
    ["48009", 2],
    ["48010", 1],
    ["48011", 2],
  ],
  // Magneto: 15 cards.
  "49001a": [
    ["49002", 1],
    ["49003", 1],
    ["49004", 1],
    ["49005", 1],
    ["49006", 1],
    ["49007", 2],
    ["49008", 2],
    ["49009", 2],
    ["49010", 2],
    ["49011", 2],
  ],
};
const SET_SIZE: Readonly<Record<string, number>> = {
  "45001a": 15,
  "45030a": 15,
  "46001a": 21,
  "47001a": 15,
  "48001a": 15,
  "49001a": 15,
};

describe("wave 8 heroes: deck builder start state (RRG 1.8 Appendix I 'Deck Customization', p. 50)", () => {
  describe.each(HEROES)("$name", ({ identity, deck }) => {
    const required = requiredIdentitySet(identityOf(identity), PLAYABLE_CARDS);
    const asPairs = required.map((r) => [r.cardId as string, r.quantity] as const);

    test("requiredIdentitySet is exactly the signature cards, with the printed quantities", () => {
      expect(asPairs).toEqual(EXPECTED_SET[identity]);
      expect(required.reduce((n, r) => n + r.quantity, 0)).toBe(SET_SIZE[identity]);
    });

    test("it equals the precon's own hero-set lines, and every one carries the identity's set icon", () => {
      const inPrecon = starter(deck)
        .cards.filter((l) => (byId.get(l.cardId) as { aspect?: string }).aspect === `hero:${identity}`)
        .map((l) => [l.cardId as string, l.quantity] as const);
      expect(asPairs).toEqual(inPrecon);
      for (const [id] of asPairs) expect((byId.get(id) as { aspect?: string }).aspect).toBe(`hero:${identity}`);
    });

    test("no later face of the identity, obligation, nemesis or encounter card is in the set", () => {
      for (const [id] of asPairs) {
        const type = byId.get(id)!.type;
        expect(["hero_identity", "obligation", "minion", "treachery", "side_scheme", "attachment"]).not.toContain(type);
        // Jubilee's version records (47007a-c, 47008a-c, 47010a-c) are front faces, not later faces.
        if (!/^470(07|08|10)[abc]$/.test(id)) expect(id).not.toMatch(/[bc]$/);
      }
    });
  });

  test("Iceman: the set holds six Frostbite (Permanent) and the precon lists 46 cards, 40 counted", () => {
    const required = requiredIdentitySet(identityOf("46001a"), PLAYABLE_CARDS);
    expect(required.find((r) => r.cardId === "46002")?.quantity).toBe(6);
    const deck = deckOf("iceman-aggression");
    expect(countedSize(deck)).toBe(46);
    // RRG 1.8 "Permanent" (p. 32): Permanent cards do not count toward deck size, so 40 count and the deck is legal.
    expect(validateDeck(deck, PLAYABLE_CARDS)).toEqual({ ok: true });
    expect(codesOf(withQuantity(deck, "46003", 1))).toEqual(["deck_size", "identity_set_mismatch"]);
  });

  test("Jubilee: nine version records among 15 set cards; each at one copy, none carries a later-face id", () => {
    const required = requiredIdentitySet(identityOf("47001a"), PLAYABLE_CARDS);
    const versions = required.filter((r) => /^470(07|08|10)[abc]$/.test(r.cardId as string));
    expect(versions.map((r) => r.cardId)).toEqual([
      "47007a",
      "47007b",
      "47007c",
      "47008a",
      "47008b",
      "47008c",
      "47010a",
      "47010b",
      "47010c",
    ]);
    for (const v of versions) expect(v.quantity).toBe(1);
  });

  test("Magneto: New Recruits is a player side scheme of his Leadership precon, its four Linked allies are not in the set", () => {
    const ids = requiredIdentitySet(identityOf("49001a"), PLAYABLE_CARDS).map((r) => r.cardId as string);
    for (const linked of ["49033", "49034", "49035", "49036"]) expect(ids).not.toContain(linked);
    expect(ids).not.toContain("49020");
    expect(deckOf("magneto-leadership").cards.find((l) => l.cardId === "49020")?.quantity).toBe(1);
  });
});

describe("wave 8 precons: legal, and nothing in them is unscripted", () => {
  describe.each(HEROES)("$name", ({ deck }) => {
    test("is legal under validateDeck against the playable pool", () => {
      expect(validateDeck(deckOf(deck), PLAYABLE_CARDS)).toEqual({ ok: true });
    });

    test("can be seated: no card in it, its obligation or its nemesis set is unscripted", () => {
      expect(unscriptedCards(deckOf(deck), PLAYABLE_CARDS, WAVE8_DEPS)).toEqual([]);
    });
  });
});

describe("wave 8 deckbuilding rules", () => {
  describe("no new identity prints a deckbuilding rule (docs/phase7-wave8.md section 7 'Deckbuilding (DoD 4b)')", () => {
    test.each(HEROES)("$name has no deckbuilding data (no allowance, package or requirement)", ({ identity }) => {
      expect(identityOf(identity).deckbuilding).toBeUndefined();
    });

    test.each(HEROES)("$name chooses exactly one aspect: two aspects are refused with the readable message", (hero) => {
      const other = hero.aspect === "justice" ? "protection" : "justice";
      const deck = { ...deckOf(hero.deck), aspects: [hero.aspect, other] } as DeckContents;
      const label = (a: string) => a.charAt(0).toUpperCase() + a.slice(1);
      expect(messageOf(deck, "aspect_choice")).toBe(
        `A deck for ${hero.who} must choose exactly one aspect; this deck chooses ${label(hero.aspect)} and ${label(other)}.`,
      );
    });
  });

  describe("an aspect card of another aspect is refused (RRG 1.8 Appendix I: one aspect plus basic)", () => {
    test("Bishop (Leadership) with Magik's Aggression Clobber 45046", () => {
      expect(messageOf(adding(deckOf("bishop-leadership"), "45046"), "aspect_restriction")).toBe(
        "Clobber is a Aggression card, but this deck's aspect is Leadership; beyond its identity set a deck may only use its chosen aspect and basic cards.",
      );
    });

    test("Magik (Aggression) with Bishop's Leadership Team Training 45013", () => {
      expect(messageOf(adding(deckOf("magik-aggression"), "45013"), "aspect_restriction")).toBe(
        "Team Training is a Leadership card, but this deck's aspect is Aggression; beyond its identity set a deck may only use its chosen aspect and basic cards.",
      );
    });

    test("Jubilee pack's Leadership Mutant Mayhem 47028 is legal for Bishop and refused for Jubilee (Justice)", () => {
      expect(validateDeck(adding(deckOf("bishop-leadership"), "47028"), PLAYABLE_CARDS)).toEqual({ ok: true });
      expect(messageOf(adding(deckOf("jubilee-justice"), "47028"), "aspect_restriction")).toBe(
        "Mutant Mayhem is a Leadership card, but this deck's aspect is Justice; beyond its identity set a deck may only use its chosen aspect and basic cards.",
      );
    });

    test("Jubilee pack's Protection Serve and Protect 47029 is legal for Nightcrawler and refused for Magneto (Leadership)", () => {
      expect(validateDeck(adding(deckOf("nightcrawler-protection"), "47029"), PLAYABLE_CARDS)).toEqual({ ok: true });
      expect(messageOf(adding(deckOf("magneto-leadership"), "47029"), "aspect_restriction")).toBe(
        "Serve and Protect is a Protection card, but this deck's aspect is Leadership; beyond its identity set a deck may only use its chosen aspect and basic cards.",
      );
    });

    test("Nightcrawler pack's Aggression Combine Forces 48031 and Justice Gunboat Diplomacy 48032 follow the same rule", () => {
      expect(validateDeck(adding(deckOf("iceman-aggression"), "48031"), PLAYABLE_CARDS)).toEqual({ ok: true });
      expect(messageOf(adding(deckOf("nightcrawler-protection"), "48031"), "aspect_restriction")).toBe(
        "Combine Forces is a Aggression card, but this deck's aspect is Protection; beyond its identity set a deck may only use its chosen aspect and basic cards.",
      );
      expect(validateDeck(adding(deckOf("jubilee-justice"), "48032"), PLAYABLE_CARDS)).toEqual({ ok: true });
      expect(messageOf(adding(deckOf("iceman-aggression"), "48032"), "aspect_restriction")).toBe(
        "Gunboat Diplomacy is a Justice card, but this deck's aspect is Aggression; beyond its identity set a deck may only use its chosen aspect and basic cards.",
      );
    });
  });

  describe("a hero's kit is identity-specific (RRG 1.8 'Identity-Specific Card', p. 23)", () => {
    test.each([
      ["magik-aggression", "45002", "Malcolm belongs to Bishop (Lucas Bishop)"],
      ["bishop-leadership", "45031", "Colossus (Piotr Rasputin) belongs to Magik (Illyana Rasputin)"],
      ["iceman-aggression", "47002", "Wolverine (Logan) belongs to Jubilee (Jubilation Lee)"],
      ["jubilee-justice", "48002", "Daytripper (Amanda Sefton) belongs to Nightcrawler (Kurt Wagner)"],
      ["nightcrawler-protection", "49002", "Asteroid M belongs to Magneto (Erik Lehnsherr)"],
      ["magneto-leadership", "46003", "Snow Clone belongs to Iceman (Bobby Drake)"],
    ])("%s with %s is refused, naming the owner", (deck, card, owner) => {
      const bad = adding(deckOf(deck), card);
      expect(codesOf(bad)).toEqual(["other_identity_card"]);
      expect(messageOf(bad, "other_identity_card")).toBe(
        `${owner}'s identity set; identity-specific cards can only be used in that identity's deck.`,
      );
    });

    test("Iceman's Frostbite in another hero's deck is refused for the owner's sake, not as a set mismatch", () => {
      const bad = adding(deckOf("jubilee-justice"), "46002", 6);
      expect(messageOf(bad, "other_identity_card")).toBe(
        "Frostbite belongs to Iceman (Bobby Drake)'s identity set; identity-specific cards can only be used in that identity's deck.",
      );
    });

    test.each(HEROES)("$name: dropping one card of the set is reported with its quantity", ({ identity, deck }) => {
      // The first set card with more than one copy, so the message is the 'has N copies, needs M' one.
      const [first, quantity] = EXPECTED_SET[identity]!.find(([, q]) => q > 1) ?? EXPECTED_SET[identity]![0]!;
      const card = byId.get(first) as { name: string; subtitle?: string; unique?: boolean };
      const name = card.unique && card.subtitle ? `${card.name} (${card.subtitle})` : card.name;
      const identityName = HEROES.find((h) => h.identity === identity)!.who;
      const message = messageOf(withQuantity(deckOf(deck), first, quantity - 1), "identity_set_mismatch");
      if (quantity === 1) {
        expect(message).toBe(
          `${name} is missing: a deck for ${identityName} must include every card in that identity's set, and this one needs 1 copy.`,
        );
      } else {
        expect(message).toContain(`${name} has ${quantity - 1} cop${quantity - 1 === 1 ? "y" : "ies"}, but `);
        expect(message).toContain(
          `identity set has exactly ${quantity} copies, and a deck must include exactly that many.`,
        );
      }
    });
  });

  describe("Iceman's six Frostbite (Permanent; RRG 1.8 'Permanent', p. 32; docs/phase7-wave8.md section 7.2)", () => {
    const iceman = deckOf("iceman-aggression");

    test("a deck without Frostbite is refused: all six are missing", () => {
      const bad = withQuantity(iceman, "46002", 0);
      expect(codesOf(bad)).toEqual(["identity_set_mismatch"]);
      expect(problemsOf(bad)[0]!.cardIds).toEqual(["46002"]);
      expect(messageOf(bad, "identity_set_mismatch")).toBe(
        "Frostbite is missing: a deck for Iceman (Bobby Drake) must include every card in that identity's set, and this one needs 6 copies.",
      );
    });

    test("five copies are refused: a deck holds exactly the set's six", () => {
      expect(messageOf(withQuantity(iceman, "46002", 5), "identity_set_mismatch")).toBe(
        "Frostbite has 5 copies, but Iceman (Bobby Drake)'s identity set has exactly 6 copies, and a deck must include exactly that many.",
      );
    });

    test("seven copies are refused too", () => {
      expect(messageOf(withQuantity(iceman, "46002", 7), "identity_set_mismatch")).toBe(
        "Frostbite has 7 copies, but Iceman (Bobby Drake)'s identity set has exactly 6 copies, and a deck must include exactly that many.",
      );
    });

    test("the six do not count toward the 40 to 50: 39 other cards is a short deck, with and without them", () => {
      const short = withQuantity(iceman, "46011", 2); // Chill Out! 3 -> 2: 39 counted (the set mismatch is reported too)
      expect(problemsOf(short).map((p) => p.code)).toContain("deck_size");
      expect(messageOf(short, "deck_size")).toBe(
        "The deck has 39 cards; a deck must have between 40 and 50 (the identity and permanent cards do not count).",
      );
    });

    test("and 50 other cards still fit, 51 do not: Frostbite is not in the count either way", () => {
      // Aggression cards the precon does not list: 40 counted + 3 + 3 + 3 + 1 = 50 counted, 56 listed with Frostbite.
      const more = (clobber: number): DeckContents =>
        [
          ["45043", 3],
          ["45044", 3],
          ["45045", 3],
          ["45046", clobber],
        ].reduce((deck, [id, n]) => adding(deck, id as string, n as number), iceman);
      expect(validateDeck(more(1), PLAYABLE_CARDS)).toEqual({ ok: true });
      expect(messageOf(more(2), "deck_size")).toBe(
        "The deck has 51 cards; a deck must have between 40 and 50 (the identity and permanent cards do not count).",
      );
    });
  });

  describe("Jubilee's three versions of Firecracker, Flash of Light and Plasmoid Energy (section 3.69; RRG 1.8 'Copy', p. 13)", () => {
    const jubilee = deckOf("jubilee-justice");

    test("a second copy of one version is one too many", () => {
      expect(messageOf(withQuantity(jubilee, "47007a", 2), "identity_set_mismatch")).toBe(
        "Firecracker has 2 copies, but Jubilee (Jubilation Lee)'s identity set has exactly 1 copy, and a deck must include exactly that many.",
      );
    });

    test("three of one version with no other is both: too many of it, and the other two missing", () => {
      const bad = withQuantity(withQuantity(withQuantity(jubilee, "47007b", 0), "47007c", 0), "47007a", 3);
      const messages = problemsOf(bad)
        .filter((p) => p.code === "identity_set_mismatch")
        .map((p) => p.message);
      expect(messages).toEqual([
        "Firecracker has 3 copies, but Jubilee (Jubilation Lee)'s identity set has exactly 1 copy, and a deck must include exactly that many.",
        "Firecracker is missing: a deck for Jubilee (Jubilation Lee) must include every card in that identity's set, and this one needs 1 copy.",
        "Firecracker is missing: a deck for Jubilee (Jubilation Lee) must include every card in that identity's set, and this one needs 1 copy.",
      ]);
    });

    test.each([
      ["47008b", "Flash of Light"],
      ["47010c", "Plasmoid Energy"],
    ])("a missing version %s (%s) is a missing identity-set card", (version, title) => {
      expect(messageOf(withQuantity(jubilee, version, 0), "identity_set_mismatch")).toBe(
        `${title} is missing: a deck for Jubilee (Jubilation Lee) must include every card in that identity's set, and this one needs 1 copy.`,
      );
    });
  });

  describe("Unlikely Duo: Team-Up (Jubilee and Wolverine), Max 1 per deck (RRG 1.8 'Team-Up', p. 43)", () => {
    test("Jubilee's precon holds it once and is legal; a second copy hits the deck limit", () => {
      const jubilee = deckOf("jubilee-justice");
      expect(jubilee.cards.find((l) => l.cardId === "47022")?.quantity).toBe(1);
      expect(messageOf(withQuantity(jubilee, "47022", 2), "copy_limit")).toBe(
        "Unlikely Duo has 2 copies, but its deck limit is 1: no more than 1 copy may be in a deck.",
      );
    });

    test("a Wolverine deck may include it", () => {
      expect(validateDeck(adding(deckOf("wolverine-aggression"), "47022"), PLAYABLE_CARDS)).toEqual({ ok: true });
    });

    test("a Spider-Man deck may not, with the player-readable message", () => {
      const bad = adding(deckOf("core-spider-man-justice"), "47022");
      expect(codesOf(bad)).toEqual(["team_up_identity"]);
      expect(messageOf(bad, "team_up_identity")).toBe(
        "Unlikely Duo is a Team-Up card for Jubilee and Wolverine; only a deck whose identity is one of them may include it.",
      );
    });
  });

  describe("Linked allies (Magneto insert; RRG 1.8 'Linked (Card Title)', p. 27; ruling August 3, 2026 - Ruling 4 (3))", () => {
    const magneto = deckOf("magneto-leadership");

    test("the precon holds New Recruits and none of the four Linked allies, and is legal", () => {
      expect(magneto.cards.find((l) => l.cardId === "49020")?.quantity).toBe(1);
      for (const id of ["49033", "49034", "49035", "49036"])
        expect(magneto.cards.some((l) => l.cardId === id)).toBe(false);
      expect(validateDeck(magneto, PLAYABLE_CARDS)).toEqual({ ok: true });
    });

    test.each([
      ["49033", "Surge (Noriko Ashida)"],
      ["49034", "Anole (Victor Borkowski)"],
      ["49035", "Bling! (Roxanne Washington)"],
      ["49036", "Indra (Paras Gavaskar)"],
    ])("%s %s cannot be included in a deck, even Magneto's own", (id, label) => {
      const bad = adding(magneto, id);
      expect(codesOf(bad)).toEqual(["linked_card"]);
      expect(messageOf(bad, "linked_card")).toBe(
        `${label} has the Linked keyword: linked cards cannot be included in a deck; they are set aside at setup by the card that brings them into play.`,
      );
    });

    test("the same in another hero's deck: Bishop with Indra is refused as linked", () => {
      expect(codesOf(adding(deckOf("bishop-leadership"), "49036"))).toEqual(["linked_card"]);
    });
  });

  describe("copy limits: 'Max 1 per deck' and 'Max 2 per deck' (RRG 1.8 Appendix I; the printed line)", () => {
    test.each([
      ["bishop-leadership", "45015", 2, "Sidekick", 1],
      ["bishop-leadership", "45019", 3, "The Power of Leadership", 2],
      ["magik-aggression", "45047", 3, "The Power of Aggression", 2],
      ["nightcrawler-protection", "48023", 2, "Energy", 1],
      ["nightcrawler-protection", "48019", 3, "The Power of Protection", 2],
      ["iceman-aggression", "46023", 3, "The Power in All of Us", 2],
      ["jubilee-justice", "47017", 3, "The Power of Justice", 2],
      ["magneto-leadership", "49022", 2, "Face the Past", 1],
    ])("%s with %s x%i (%s, limit %i) is refused", (deck, card, quantity, title, limit) => {
      const bad = withQuantity(deckOf(deck), card, quantity);
      expect(messageOf(bad, "copy_limit")).toBe(
        `${title} has ${quantity} copies, but its deck limit is ${limit}: no more than ${limit} cop${limit === 1 ? "y" : "ies"} may be in a deck.`,
      );
    });

    test("Bloodgem 45050 is Max 1: two copies are refused", () => {
      expect(messageOf(withQuantity(deckOf("magik-aggression"), "45050", 2), "copy_limit")).toBe(
        "Bloodgem has 2 copies, but its deck limit is 1: no more than 1 copy may be in a deck.",
      );
    });
  });

  describe("'Play only if ...' lines are play restrictions, not deckbuilding (docs/phase7-wave8.md section 7.1 to 7.5)", () => {
    test.each([
      ["bishop-leadership", "45050", "Bloodgem (MYSTIC)"],
      ["bishop-leadership", "45051", "Basic Spell (MYSTIC)"],
      ["bishop-leadership", "45052", "Spiritual Meditation (MYSTIC)"],
      ["core-spider-man-justice", "45021", "Marrow (X-FORCE)"],
      ["core-she-hulk-aggression", "45042", "Tempus (X-MEN)"],
      ["core-spider-man-justice", "45049", "Stepford Cuckoos"],
      ["core-captain-marvel-leadership", "48022", "Moira MacTaggert"],
      ["core-captain-marvel-leadership", "47020", "X-Gene (MUTANT)"],
      ["core-black-panther-protection", "46019", "Shadowcat (X-MEN)"],
      ["core-black-panther-protection", "49021", "White Queen (X-MEN)"],
    ])("%s may include %s though its identity could never play it: %s", (deck, card) => {
      // Four more cards than the precon's 40 stays within 50; the deck is legal.
      expect(validateDeck(adding(deckOf(deck), card), PLAYABLE_CARDS)).toEqual({ ok: true });
    });
  });

  describe("the unique rule in a deck (RRG 1.8 'Unique Icon', pp. 45-46; January 26, 2026 - Ruling 4 (7))", () => {
    // Iceman, Jubilee, Nightcrawler and Magneto against earlier allies: `rulings.qa.test.ts` ("in deckbuilding").
    const uniqueMatches = (deck: DeckContents) => problemsOf(deck).filter((p) => p.code === "unique_match");

    test("Bishop's deck cannot include the ally Bishop 37011 (Gambit pack): he matches the identity", () => {
      const matches = uniqueMatches(adding(deckOf("bishop-leadership"), "37011"));
      expect(matches.map((p) => p.message)).toEqual([
        "Bishop (Lucas Bishop) matches the identity Bishop (Lucas Bishop); a deck cannot include a unique card that matches its own identity.",
      ]);
      expect(matches[0]!.cardIds).toEqual(["45001a", "37011"]);
    });

    test("Magik's deck cannot include the ally Magik 32042 (Mutant Genesis)", () => {
      const matches = uniqueMatches(adding(deckOf("magik-aggression"), "32042"));
      expect(matches.map((p) => p.message)).toEqual([
        "Magik (Illyana Rasputin) matches the identity Magik (Illyana Rasputin); a deck cannot include a unique card that matches its own identity.",
      ]);
    });

    test("the new Leadership Cable 45011 cannot be in Cable's deck, nor beside Deadpool's own Cable ally 44002", () => {
      const cable = uniqueMatches(adding(deckOf("cable-leadership"), "45011"));
      expect(cable.map((p) => p.message)).toEqual([
        "Cable (Nathan Summers) matches the identity Cable (Nathan Summers); a deck cannot include a unique card that matches its own identity.",
      ]);
      const deadpool = uniqueMatches(adding(deckOf("deadpool-pool"), "45011"));
      expect(deadpool.map((p) => p.message)).toEqual([
        "Cable (Nathan Summers) and Cable (Nathan Summers) match; a deck cannot include multiple matching unique cards.",
      ]);
      expect(deadpool[0]!.cardIds).toEqual(["44002", "45011"]);
    });

    test("the new Leadership X-23 45012 cannot be in X-23's deck", () => {
      expect(uniqueMatches(adding(deckOf("x-23-aggression"), "45012")).map((p) => p.message)).toEqual([
        "X-23 (Laura Kinney) matches the identity X-23 (Laura Kinney); a deck cannot include a unique card that matches its own identity.",
      ]);
    });

    test("control: in Magneto's deck (Leadership, no match) both new allies are legal", () => {
      expect(validateDeck(adding(deckOf("magneto-leadership"), "45011"), PLAYABLE_CARDS)).toEqual({ ok: true });
      expect(validateDeck(adding(deckOf("magneto-leadership"), "45012"), PLAYABLE_CARDS)).toEqual({ ok: true });
    });
  });

  describe("Age of Apocalypse campaign cards (RRG 1.8 'Campaign-Specific Card', p. 11; docs/phase7-wave8.md section 3.45)", () => {
    const AOA_CAMPAIGN_CARDS = [
      ["45171a", "Mission Team"],
      ["45172", "Destiny (Irene Adler)"],
      ["45173", "Blink (Clarice Ferguson)"],
      ["45174", "Morph (Kevin Sydney)"],
      ["45175", "X-Man (Nate Grey)"],
      ["45176", "Desperate Measures"],
    ] as const;
    const campaign = (granted: readonly string[]) => ({
      campaign: {
        campaignId: "aoa",
        campaignSetIds: ["age_of_apocalypse", "aoa_mission", "overseer", "aoa_campaign", "aoa_basic_campaign"],
        identityCardId: "45001a",
        grantedCardIds: granted,
      } satisfies CampaignDeckContext,
    });

    test.each(AOA_CAMPAIGN_CARDS)("%s %s is refused in a standard deck", (id, label) => {
      const bad = adding(deckOf("bishop-leadership"), id);
      expect(codesOf(bad)).toEqual(["campaign_card"]);
      expect(messageOf(bad, "campaign_card")).toBe(
        `${label} is a campaign card: it can only be used during a campaign from the same product, and this deck is not being built for a campaign.`,
      );
    });

    test("inside the campaign, a card it granted is legal and an ungranted one is not", () => {
      const deck = adding(deckOf("bishop-leadership"), "45172");
      const refused = problemsOf(deck, campaign([]));
      expect(refused.map((p) => p.code)).toEqual(["campaign_card_not_granted"]);
      expect(validateDeck(deck, PLAYABLE_CARDS, campaign(["45172"]))).toEqual({ ok: true });
    });
  });
});
