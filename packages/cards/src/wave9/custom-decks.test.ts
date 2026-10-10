/**
 * Wave 9 definition-of-done 4b, pieces 1 to 3 (docs/wave-definition-of-done.md, docs/custom-deck-testing.md "The
 * pieces") for the six new heroes: Maria Hill and Nick Fury (`aos`), Black Panther / Shuri (`bp`), Silk, Falcon and
 * Winter Soldier. Piece 4 (a real MarvelCDB decklist per hero) needs a download that is not approved: an `it.todo`.
 *
 * 1. Cards in another hero's deck: every scripted new aspect and basic player card of `aos`, `bp`, `silk`, `falcon` and
 *    `winter` (`aspect-basic` modules; `aos/shield` is the S.H.I.E.L.D. Trooper encounter set, no player card; `tt` is
 *    unscripted) is played through the engine from a Core hero's deck, so a script that assumes its precon hero fails.
 *    A card with no ability (a plain resource) has nothing to script and is skipped; a card the Core hero cannot play
 *    by its own printed text ("Play only if your identity has ...") is asserted refused, and played once the Core
 *    identity carries the trait (the card pool is edited, never the rules).
 * 2. The wave's deckbuilding rules (see the comments in "wave 9 deckbuilding rules" for what each identity prints).
 * 3. The deck builder's start state: `requiredIdentitySet` is exactly each hero's signature cards (RRG 1.8 Appendix I
 *    "Deck Customization", p. 50).
 *
 * Decks are validated against `PLAYABLE_CARDS` (it holds every wave, wave 9 included).
 */
import { describe, expect, it, vi } from "vitest";
import {
  PLAYABLE_CARDS,
  WAVE1_STARTER_DECKS,
  WAVE2_STARTER_DECKS,
  WAVE3_STARTER_DECKS,
  WAVE4_STARTER_DECKS,
  WAVE5_STARTER_DECKS,
  WAVE6_STARTER_DECKS,
  WAVE7_STARTER_DECKS,
  WAVE8_STARTER_DECKS,
  WAVE9_STARTER_DECKS,
  CORE_STARTER_DECKS,
  cardId,
  type AnyCard,
  type DeckContents,
  type HeroIdentityCard,
  type StarterDeck,
} from "@mc/content";
import {
  abilityRefsOf,
  applyCommand,
  cardsInPlay,
  createGame,
  legalActions,
  replay,
  requiredIdentitySet,
  sessionApply,
  startSession,
  unscriptedCards,
  validateDeck,
  type Command,
  type GameState,
  type InstanceId,
  type PlayerSetup,
} from "@mc/engine";
import { coreScenario } from "../core/setup.js";
import { CORE_HERO_FOR_ASPECT, buildCrossHeroDeck } from "../testing/cross-hero.js";
import {
  P1,
  P2,
  answer,
  endTurn,
  firstLegal,
  identityOf as seatIdentity,
  inst,
  moveToHand,
  playerOf,
  runWith,
  settle,
  settleUntil,
  stackEncounterDeck,
  type Picker,
} from "../testing/harness.js";
import { withForm } from "../testing/staging.js";
import { attached, conjure, inPlayArea } from "../wave7/rulings-2026-10-06-harness.js";
import { accepting } from "../wave8/cross-hero-testing.js";
import { CARD_GROUPS } from "./card-groups.js";
import { WAVE9_DEPS } from "./index.js";

vi.setConfig({ testTimeout: 120_000 });

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
  ...WAVE9_STARTER_DECKS,
];

const byId = new Map<string, AnyCard>(PLAYABLE_CARDS.map((card) => [card.id as string, card]));
const dataOf = (id: string): AnyCard => {
  const card = byId.get(id);
  if (!card) throw new Error(`no card ${id}`);
  return card;
};
const identityCard = (id: string): HeroIdentityCard => {
  const card = byId.get(id);
  if (!card || card.type !== "hero_identity") throw new Error(`no identity ${id}`);
  return card;
};
const starter = (id: string): StarterDeck => {
  const deck = ALL_STARTER_DECKS.find((d) => d.id === id);
  if (!deck) throw new Error(`no starter deck ${id}`);
  return deck;
};
const deckOf = (id: string): DeckContents => {
  const deck = starter(id);
  return { identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards };
};
const withQuantity = (deck: DeckContents, card: string, quantity: number): DeckContents => ({
  ...deck,
  cards: [
    ...deck.cards.filter((l) => l.cardId !== card),
    ...(quantity > 0 ? [{ cardId: cardId(card), quantity }] : []),
  ],
});
const adding = (deck: DeckContents, card: string, quantity = 1): DeckContents => ({
  ...deck,
  cards: [...deck.cards, { cardId: cardId(card), quantity }],
});
const problemsOf = (deck: DeckContents) => {
  const verdict = validateDeck(deck, PLAYABLE_CARDS);
  if (verdict.ok) throw new Error("expected an illegal deck");
  return verdict.problems;
};
const codesOf = (deck: DeckContents): string[] => problemsOf(deck).map((p) => p.code);
const messageOf = (deck: DeckContents, code: string): string | undefined =>
  problemsOf(deck).find((p) => p.code === code)?.message;
const label = (aspect: string): string => aspect.charAt(0).toUpperCase() + aspect.slice(1);

const HEROES = [
  {
    name: "Maria Hill",
    who: "Maria Hill (Maria Hill)",
    identity: "50001a",
    deck: "maria-hill-leadership",
    aspect: "leadership",
  },
  { name: "Nick Fury", who: "Nick Fury (Nick Fury)", identity: "50034a", deck: "nick-fury-justice", aspect: "justice" },
  {
    name: "Black Panther / Shuri",
    who: "Black Panther (Shuri)",
    identity: "51001a",
    deck: "bp-justice",
    aspect: "justice",
  },
  { name: "Silk", who: "Silk (Cindy Moon)", identity: "52001a", deck: "silk-protection", aspect: "protection" },
  { name: "Falcon", who: "Falcon (Sam Wilson)", identity: "53001a", deck: "falcon-leadership", aspect: "leadership" },
  {
    name: "Winter Soldier",
    who: "Winter Soldier (Bucky Barnes)",
    identity: "54001a",
    deck: "winter-aggression",
    aspect: "aggression",
  },
] as const;

// ---------------------------------------------------------------------------------------------------------------------
// 3. Deck builder start state
// ---------------------------------------------------------------------------------------------------------------------

/** Each hero's signature cards as the printed hero-pack lists (and the precons) carry them. */
const EXPECTED_SET: Readonly<Record<string, readonly (readonly [string, number])[]>> = {
  // Maria Hill: 15 cards.
  "50001a": [
    ["50002", 1],
    ["50003", 2],
    ["50004", 2],
    ["50005", 3],
    ["50006", 1],
    ["50007", 2],
    ["50008", 1],
    ["50009", 1],
    ["50010", 1],
    ["50011", 1],
  ],
  // Nick Fury: 16 cards, including his Permanent suit form upgrade Assault / Stealth (50035a).
  "50034a": [
    ["50035a", 1],
    ["50036", 1],
    ["50037", 2],
    ["50038", 3],
    ["50039", 2],
    ["50040", 1],
    ["50041", 1],
    ["50042", 1],
    ["50043", 1],
    ["50044", 1],
    ["50045", 1],
    ["50046", 1],
  ],
  // Black Panther / Shuri: 15 cards.
  "51001a": [
    ["51002", 1],
    ["51003", 2],
    ["51004", 2],
    ["51005", 1],
    ["51006", 2],
    ["51007", 1],
    ["51008", 1],
    ["51009", 1],
    ["51010", 1],
    ["51011", 1],
    ["51012", 1],
    ["51013", 1],
  ],
  // Silk: 15 cards.
  "52001a": [
    ["52002", 2],
    ["52003", 3],
    ["52004", 2],
    ["52005", 1],
    ["52006", 1],
    ["52007", 1],
    ["52008", 1],
    ["52009", 1],
    ["52010", 1],
    ["52011", 1],
    ["52012", 1],
  ],
  // Falcon: 15 cards.
  "53001a": [
    ["53002", 1],
    ["53003", 2],
    ["53004", 2],
    ["53005", 2],
    ["53006", 1],
    ["53007", 1],
    ["53008", 1],
    ["53009", 1],
    ["53010", 1],
    ["53011", 1],
    ["53012", 1],
    ["53013", 1],
  ],
  // Winter Soldier: 15 cards.
  "54001a": [
    ["54002", 1],
    ["54003", 1],
    ["54004", 2],
    ["54005", 3],
    ["54006", 2],
    ["54007", 1],
    ["54008", 2],
    ["54009", 1],
    ["54010", 1],
    ["54011", 1],
  ],
};

describe("wave 9 heroes: deck builder start state (RRG 1.8 Appendix I 'Deck Customization', p. 50)", () => {
  describe.each(HEROES)("$name", ({ identity, deck }) => {
    const required = requiredIdentitySet(identityCard(identity), PLAYABLE_CARDS);
    const asPairs = required.map((r) => [r.cardId as string, r.quantity] as const);

    it("requiredIdentitySet is exactly the signature cards, with the printed quantities", () => {
      expect(asPairs).toEqual(EXPECTED_SET[identity]);
    });

    it("it equals the precon's own hero-set lines, and every one carries the identity's set icon", () => {
      const inPrecon = starter(deck)
        .cards.filter((l) => (byId.get(l.cardId) as { aspect?: string }).aspect === `hero:${identity}`)
        .map((l) => [l.cardId as string, l.quantity] as const);
      expect(asPairs).toEqual(inPrecon);
      for (const [id] of asPairs) expect((byId.get(id) as { aspect?: string }).aspect).toBe(`hero:${identity}`);
    });

    it("no identity face, obligation, nemesis or encounter card is in the set", () => {
      for (const [id] of asPairs) {
        expect(["hero_identity", "obligation", "minion", "treachery", "side_scheme", "attachment"]).not.toContain(
          dataOf(id).type,
        );
      }
    });
  });

  it("Nick Fury: the set holds the Permanent Assault / Stealth once, counted as 16 cards", () => {
    const required = requiredIdentitySet(identityCard("50034a"), PLAYABLE_CARDS);
    expect(required.find((r) => r.cardId === "50035a")?.quantity).toBe(1);
    expect(required.reduce((n, r) => n + r.quantity, 0)).toBe(16);
  });
});

describe("wave 9 precons: legal, and nothing in them is unscripted", () => {
  describe.each(HEROES)("$name", ({ deck }) => {
    it("is legal under validateDeck against the playable pool", () => {
      expect(validateDeck(deckOf(deck), PLAYABLE_CARDS)).toEqual({ ok: true });
    });
  });
  // `unscriptedCards` also counts the hero's obligation and nemesis set. Falcon's two are the known gaps (Aerial Recon
  // 53009's action; Strength in Diversity 53019 is unscripted), listed so the day they are scripted this test says so.
  const KNOWN_GAPS: Readonly<Record<string, readonly string[]>> = { "falcon-leadership": ["53009", "53019"] };
  it.each(HEROES.filter((h) => h.identity !== "50001a"))(
    "$name: unscripted cards are only the known gaps",
    ({ deck }) => {
      const unscripted = unscriptedCards(deckOf(deck), PLAYABLE_CARDS, WAVE9_DEPS).map((c) => c as string);
      expect(unscripted).toEqual(KNOWN_GAPS[deck] ?? []);
    },
  );

  // Her alter-ego line is a deckbuilding rule carried by data; its ability ref is registered as covered by the engine.
  it("Maria Hill: nothing in her precon is unscripted", () => {
    expect(unscriptedCards(deckOf("maria-hill-leadership"), PLAYABLE_CARDS, WAVE9_DEPS)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// 2. Deckbuilding rules
// ---------------------------------------------------------------------------------------------------------------------

describe("wave 9 deckbuilding rules", () => {
  describe("only Maria Hill prints a deckbuilding rule (her alter-ego text); the other five print none", () => {
    it.each(HEROES.filter((h) => h.identity !== "50001a"))("$name has no deckbuilding data", ({ identity }) => {
      expect(identityCard(identity).deckbuilding).toBeUndefined();
    });

    it("Maria Hill's data is the S.H.I.E.L.D. support package of 3 titles", () => {
      expect(identityCard("50001a").deckbuilding).toEqual({
        offAspectPackages: [{ cardType: "support", trait: "S.H.I.E.L.D.", titles: 3 }],
      });
    });

    it.each(HEROES)("$name chooses exactly one aspect: two aspects are refused with the readable message", (hero) => {
      const other = hero.aspect === "justice" ? "protection" : "justice";
      const deck = { ...deckOf(hero.deck), aspects: [hero.aspect, other] } as DeckContents;
      expect(messageOf(deck, "aspect_choice")).toBe(
        `A deck for ${hero.who} must choose exactly one aspect; this deck chooses ${label(hero.aspect)} and ${label(other)}.`,
      );
    });
  });

  describe("Maria Hill: 'maximum number of copies of 3 S.H.I.E.L.D. supports from other aspects' (all or nothing)", () => {
    const maria = deckOf("maria-hill-leadership");
    // The precon holds The Bellerophon (Aggression 50018), The Douglass (Justice 50019) and The Pericles (Protection 50020).
    const PREFIX =
      "Maria Hill (Maria Hill)'s deckbuilding requirement: a S.H.I.E.L.D. support card from outside the chosen aspect is allowed only as the maximum copies of exactly 3 different titles, or none at all;";

    it("the precon (exactly 3 titles, each at its maximum) is legal", () => {
      expect(validateDeck(maria, PLAYABLE_CARDS)).toEqual({ ok: true });
    });

    it("two titles of the three are refused, naming the count", () => {
      const bad = withQuantity(maria, "50020", 0);
      expect(codesOf(bad)).toContain("deckbuilding_requirement");
      expect(messageOf(bad, "deckbuilding_requirement")).toBe(`${PREFIX} this deck has 2 different ones.`);
    });

    it("a fourth title (Falcon's Protection Ops Room 53037) is refused", () => {
      const ops = dataOf("53037") as { traits: readonly string[]; type: string; aspect: string };
      expect(ops.type).toBe("support");
      expect(ops.traits).toContain("S.H.I.E.L.D.");
      expect(ops.aspect).toBe("protection");
      expect(messageOf(adding(maria, "53037"), "deckbuilding_requirement")).toBe(
        `${PREFIX} this deck has 4 different ones.`,
      );
    });

    it("an off-aspect S.H.I.E.L.D. support at fewer than its maximum copies is refused, naming the title", () => {
      // Swap The Pericles (limit 1) for Ops Room x1 (limit above 1): 3 titles, but one is short of its maximum.
      const ops = dataOf("53037") as { deckLimit: number; name: string };
      expect(ops.deckLimit).toBeGreaterThan(1);
      const bad = adding(withQuantity(maria, "50020", 0), "53037");
      expect(messageOf(bad, "deckbuilding_requirement")).toBe(`${PREFIX} not at their maximum copies: ${ops.name}.`);
    });

    it("control: Nick Fury's Justice deck gets no such allowance, The Bellerophon (Aggression) is refused", () => {
      expect(messageOf(adding(deckOf("nick-fury-justice"), "50018"), "aspect_restriction")).toBe(
        "The Bellerophon is a Aggression card, but this deck's aspect is Justice; beyond its identity set a deck may only use its chosen aspect and basic cards.",
      );
    });

    it("control: a non-S.H.I.E.L.D. off-aspect support is refused as an aspect card even for Maria Hill", () => {
      // Core's Justice support Interrogation Room (01063) is not S.H.I.E.L.D.
      expect(dataOf("01063").type).toBe("support");
      expect(messageOf(adding(maria, "01063"), "aspect_restriction")).toBe(
        "Interrogation Room is a Justice card, but this deck's aspect is Leadership; beyond its identity set a deck may only use its chosen aspect and basic cards.",
      );
    });

    it("control: a basic S.H.I.E.L.D. support (Core's Helicarrier 01092) is not off-aspect and is legal", () => {
      expect(validateDeck(adding(maria, "01092"), PLAYABLE_CARDS)).toEqual({ ok: true });
    });
  });
});

describe("wave 9 deckbuilding rules: kits, aspects, limits and Team-Up", () => {
  const nameOf = (id: string): string => {
    const card = dataOf(id) as { name: string; subtitle?: string; unique?: boolean };
    return card.unique && card.subtitle ? `${card.name} (${card.subtitle})` : card.name;
  };

  describe("a hero's kit is identity-specific (RRG 1.8 'Identity-Specific Card', p. 23)", () => {
    // Each hero's first kit card placed in the next hero's deck (the last into the first's).
    const pairs = HEROES.map((owner, i) => ({ owner, host: HEROES[(i + 1) % HEROES.length]! }));
    it.each(pairs)("$host.name's deck with $owner.name's kit card is refused, naming the owner", ({ owner, host }) => {
      const card = EXPECTED_SET[owner.identity]![0]![0];
      const bad = adding(deckOf(host.deck), card);
      // Nick Fury's deck holding Maria Hill's ally Nick Fury (50002) is also a unique match with the identity.
      expect(codesOf(bad)).toContain("other_identity_card");
      expect(messageOf(bad, "other_identity_card")).toBe(
        `${nameOf(card)} belongs to ${owner.who}'s identity set; identity-specific cards can only be used in that identity's deck.`,
      );
    });

    it.each(HEROES)("$name: dropping one card of the set is reported with its quantity", ({ identity, deck, who }) => {
      const [first, quantity] = EXPECTED_SET[identity]!.find(([, q]) => q > 1) ?? EXPECTED_SET[identity]![0]!;
      const message = messageOf(withQuantity(deckOf(deck), first, quantity - 1), "identity_set_mismatch");
      if (quantity === 1) {
        expect(message).toBe(
          `${nameOf(first)} is missing: a deck for ${who} must include every card in that identity's set, and this one needs 1 copy.`,
        );
      } else {
        expect(message).toContain(`${nameOf(first)} has ${quantity - 1} cop${quantity - 1 === 1 ? "y" : "ies"}, but `);
        expect(message).toContain(
          `identity set has exactly ${quantity} copies, and a deck must include exactly that many.`,
        );
      }
    });
  });

  describe("Nick Fury's Permanent Assault / Stealth 50035a (RRG 1.8 'Permanent', p. 32)", () => {
    const fury = deckOf("nick-fury-justice");

    it("is listed in the precon but not counted: the 41 entries (40 counted) are legal", () => {
      expect(fury.cards.find((l) => l.cardId === "50035a")?.quantity).toBe(1);
      expect(fury.cards.reduce((n, l) => n + l.quantity, 0)).toBe(41);
      expect(validateDeck(fury, PLAYABLE_CARDS)).toEqual({ ok: true });
    });

    it("a deck without it is refused as a missing identity-set card", () => {
      expect(messageOf(withQuantity(fury, "50035a", 0), "identity_set_mismatch")).toBe(
        `${nameOf("50035a")} is missing: a deck for Nick Fury (Nick Fury) must include every card in that identity's set, and this one needs 1 copy.`,
      );
    });

    it("a second copy is refused: the set has exactly one", () => {
      expect(messageOf(withQuantity(fury, "50035a", 2), "identity_set_mismatch")).toContain(
        "has 2 copies, but Nick Fury (Nick Fury)'s identity set has exactly 1 copy, and a deck must include exactly that many.",
      );
    });
  });

  describe("an aspect card of another aspect is refused (RRG 1.8 Appendix I: one aspect plus basic)", () => {
    // [deck, off-aspect wave 9 card, its aspect, the deck's aspect]
    it.each([
      ["silk-protection", "54014", "aggression", "protection"],
      ["winter-aggression", "52017", "protection", "aggression"],
      ["falcon-leadership", "51014", "justice", "leadership"],
      ["bp-justice", "53014", "leadership", "justice"],
      ["nick-fury-justice", "50012", "leadership", "justice"],
    ])("%s with %s (%s card) is refused", (deck, card, aspect, chosen) => {
      expect((dataOf(card) as { aspect: string }).aspect).toBe(aspect);
      expect(messageOf(adding(deckOf(deck), card), "aspect_restriction")).toBe(
        `${nameOf(card)} is a ${label(aspect)} card, but this deck's aspect is ${label(chosen)}; beyond its identity set a deck may only use its chosen aspect and basic cards.`,
      );
    });

    it("a wave 9 basic card is legal in every wave 9 deck", () => {
      for (const hero of HEROES) {
        expect(validateDeck(withQuantity(deckOf(hero.deck), "50021", 1), PLAYABLE_CARDS), hero.name).toEqual({
          ok: true,
        });
      }
    });
  });

  describe("Team-Up (RRG 1.8 'Team-Up', p. 43): only a deck whose identity is one of the two named characters", () => {
    it.each([
      ["50024", "Super Spies", "Maria Hill and Nick Fury", "maria-hill-leadership", "nick-fury-justice"],
      ["54022", "Super-Soldiers", "Captain America and Winter Soldier", "cap-leadership", "winter-aggression"],
      ["54023", "Winter, Widow, Soldier, Spy", "Black Widow and Winter Soldier", "bkw-justice", "winter-aggression"],
    ])("%s %s: legal for both named heroes, refused for a Core hero", (card, title, names, a, b) => {
      expect(validateDeck(withQuantity(deckOf(a), card, 1), PLAYABLE_CARDS)).toEqual({ ok: true });
      expect(validateDeck(withQuantity(deckOf(b), card, 1), PLAYABLE_CARDS)).toEqual({ ok: true });
      const bad = withQuantity(deckOf("core-she-hulk-aggression"), card, 1);
      expect(codesOf(bad)).toEqual(["team_up_identity"]);
      expect(messageOf(bad, "team_up_identity")).toBe(
        `${title} is a Team-Up card for ${names}; only a deck whose identity is one of them may include it.`,
      );
    });

    it("51025 Heart of the Panther: Black Panther / Shuri and Core's Black Panther may; Spider-Man may not", () => {
      expect(validateDeck(withQuantity(deckOf("bp-justice"), "51025", 1), PLAYABLE_CARDS)).toEqual({ ok: true });
      expect(validateDeck(withQuantity(deckOf("core-black-panther-protection"), "51025", 1), PLAYABLE_CARDS)).toEqual({
        ok: true,
      });
      expect(messageOf(withQuantity(deckOf("core-spider-man-justice"), "51025", 1), "team_up_identity")).toBe(
        "Heart of the Panther is a Team-Up card for Black Panther/T'Challa and Black Panther/Shuri; only a deck whose identity is one of them may include it.",
      );
    });

    it("52024 Investigative Journalism: Silk and Spider-Man (Peter Parker) may; Captain Marvel may not", () => {
      expect(validateDeck(withQuantity(deckOf("silk-protection"), "52024", 1), PLAYABLE_CARDS)).toEqual({ ok: true });
      expect(validateDeck(withQuantity(deckOf("core-spider-man-justice"), "52024", 1), PLAYABLE_CARDS)).toEqual({
        ok: true,
      });
      expect(messageOf(withQuantity(deckOf("core-captain-marvel-leadership"), "52024", 1), "team_up_identity")).toBe(
        "Investigative Journalism is a Team-Up card for Cindy Moon and Peter Parker; only a deck whose identity is one of them may include it.",
      );
    });
  });

  describe("Linked cards are in no deck (RRG 1.8 'Linked (Card Title)', p. 27)", () => {
    it.each([
      ["51036", "Redemption", "bp-justice"],
      ["53034", "Captain America's Shield", "falcon-leadership"],
    ])("%s %s is refused even in the deck of its own hero", (card, title, deck) => {
      const bad = adding(deckOf(deck), card);
      expect(codesOf(bad)).toEqual(["linked_card"]);
      expect(messageOf(bad, "linked_card")).toBe(
        `${title} has the Linked keyword: linked cards cannot be included in a deck; they are set aside at setup by the card that brings them into play.`,
      );
    });
  });

  describe("the unique rule in a deck (RRG 1.8 'Unique Icon', pp. 45-46)", () => {
    it.each([
      ["core-spider-man-justice", "52022", "Spider-Man (Peter Parker)"],
      ["winter-aggression", "53035", "Winter Soldier (Bucky Barnes)"],
    ])("%s cannot include the ally %s matching its identity", (deck, card, title) => {
      const matches = problemsOf(adding(deckOf(deck), card)).filter((p) => p.code === "unique_match");
      expect(matches.map((p) => p.message)).toEqual([
        `${title} matches the identity ${title}; a deck cannot include a unique card that matches its own identity.`,
      ]);
    });
  });

  describe("copy limits: 'Max N per deck' on the new aspect and basic cards", () => {
    const playerCards = Object.entries(CARD_GROUPS)
      .filter(([k]) => /^(aos|bp|silk|falcon|winter)\/aspect-basic$/.test(k))
      .flatMap(([, ids]) => ids)
      .map(
        (id) => dataOf(id) as AnyCard & { deckLimit?: number; aspect?: string; keywords?: readonly { name: string }[] },
      )
      .filter((c) => c.deckLimit !== undefined && c.deckLimit < 3 && !c.keywords?.some((k) => k.name === "linked"));
    const CORE_FOR: Readonly<Record<string, string>> = {
      justice: "core-spider-man-justice",
      leadership: "core-captain-marvel-leadership",
      aggression: "core-she-hulk-aggression",
      protection: "core-black-panther-protection",
      basic: "core-spider-man-justice",
    };

    it("covers the cards with a limit below the default 3", () => {
      expect(playerCards.length).toBeGreaterThan(10);
    });

    // A unique card's limit is the unique rule ("Unique Icon", RRG 1.8 pp. 45-46); a second copy reads as a match.
    const rows = playerCards.map(
      (c) => [c.id as string, nameOf(c.id as string), c.deckLimit!, CORE_FOR[c.aspect ?? "basic"]!] as const,
    );
    it.each(rows.filter(([id]) => !(dataOf(id) as { unique?: boolean }).unique))(
      "%s %s: a copy past its limit %i is refused",
      (id, name, limit, deck) => {
        const message = messageOf(adding(deckOf(deck), id, limit + 1), "copy_limit");
        // Reprinted titles already in the Core deck (Energy 01088) count toward the same limit, so only the shape is fixed.
        expect(message?.startsWith(`${name} has `)).toBe(true);
        expect(
          message?.endsWith(
            `, but its deck limit is ${limit}: no more than ${limit} cop${limit === 1 ? "y" : "ies"} may be in a deck.`,
          ),
        ).toBe(true);
      },
    );

    it.each(rows.filter(([id]) => (dataOf(id) as { unique?: boolean }).unique))(
      "%s %s (unique): a second copy is refused by the unique rule",
      (id, name, _limit, deck) => {
        // Spider-Man 52022 also matches Spider-Man's identity, and The Triskelion 53022 the Core Triskelion in the deck.
        const special = id === "52022" || id === "53022";
        const message = messageOf(adding(deckOf(deck), id, 2), "unique_match");
        if (special) expect(message).toBeDefined();
        else {
          expect(message).toBe(
            `${name} is unique, and a deck cannot include matching unique cards, so it may be included only once (this deck has 2).`,
          );
        }
      },
    );
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// 1. Cards in another hero's deck
// ---------------------------------------------------------------------------------------------------------------------

/** Core identity card of each Core starter deck, for the trait edit. */
const CORE_IDENTITY: Readonly<Record<string, string>> = {
  "core-spider-man-justice": "01001a",
  "core-captain-marvel-leadership": "01010a",
  "core-she-hulk-aggression": "01019a",
  "core-black-panther-protection": "01040a",
};

/** The playable pool with `traits` added to both faces of a Core identity (the pool is edited, never the rules). */
function poolWith(identity: string, traits: readonly string[]): readonly AnyCard[] {
  return PLAYABLE_CARDS.map((card) => {
    if ((card.id as string) !== identity || card.type !== "hero_identity") return card;
    const add = <T extends { traits: readonly unknown[] }>(face: T): T => ({
      ...face,
      traits: [...face.traits, ...traits],
    });
    return { ...card, hero: add(card.hero), alterEgo: add(card.alterEgo) } as AnyCard;
  });
}

interface Spec {
  /** Core starter deck the card is seated in (default: the card's own aspect's Core hero; basic: Spider-Man). */
  readonly hero?: string;
  /** A whole deck to seat instead (a Team-Up card needs the deck of one of its heroes). */
  readonly deck?: () => PlayerSetup;
  /** Traits added to the Core identity. */
  readonly traits?: readonly string[];
  /** Play from alter-ego form (default: hero form). */
  readonly alterEgo?: boolean;
  /** Surgery before the card is put in hand. */
  readonly stage?: (state: GameState) => GameState;
  /** A second player seated beside the first: the partner a Team-Up names (the other character is a player's identity). */
  readonly partner?: () => PlayerSetup;
  /** Cards (by code) conjured into hand and spent as the whole payment: a Requirement the example payment may not meet. */
  readonly pay?: readonly string[];
}

const seat = (starterDeckId: string, card?: string): PlayerSetup => {
  const deck = starter(starterDeckId);
  const cards = [
    ...deck.cards,
    ...(card && !deck.cards.some((l) => l.cardId === card) ? [{ cardId: cardId(card), quantity: 1 }] : []),
  ];
  return {
    identityCardId: deck.identityCardId,
    aspects: deck.aspects,
    deck: cards.flatMap((l) => Array.from({ length: l.quantity }, () => l.cardId)),
  };
};

function openGame(code: string, spec: Spec = {}): GameState {
  const card = dataOf(code) as { aspect?: string };
  const heroId =
    spec.hero ??
    CORE_HERO_FOR_ASPECT[(card.aspect ?? "basic") as keyof typeof CORE_HERO_FOR_ASPECT] ??
    "core-spider-man-justice";
  const pool = spec.traits ? poolWith(CORE_IDENTITY[heroId]!, spec.traits) : PLAYABLE_CARDS;
  const player = spec.deck ? spec.deck() : buildCrossHeroDeck(pool, heroId, code);
  const config = coreScenario("rhino", {
    players: spec.partner ? [player, spec.partner()] : [player],
    seed: 11,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: pool,
  } as never);
  const created = createGame(config, WAVE9_DEPS);
  if (!created.ok) throw new Error(`${code} in ${heroId}: ${created.error.code}: ${created.error.message}`);
  const opened = settle(created.state, firstLegal, (st) => st.step.phase === "player", WAVE9_DEPS);
  const form = spec.alterEgo ? opened : withForm(opened, { heroForm: 0 }, P1);
  return spec.stage ? spec.stage(form) : form;
}

/** The play the engine offers for `id` (`legalActions`' example command), or null when it is not offered. */
function exampleFor(state: GameState, id: InstanceId): Command | null {
  const actions = legalActions(state, P1, WAVE9_DEPS);
  if (actions.kind !== "turn") return null;
  return actions.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === id)?.example ?? null;
}

/** Drives `commands` through a session, answering prompts with `pick`; the log must replay to the identical state. */
function drive(start: GameState, pick: Picker, ...commands: readonly Command[]): GameState {
  let session = startSession(start);
  const apply = (command: Command): void => {
    const result = sessionApply(session, command, WAVE9_DEPS);
    if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.code}: ${result.error.message}`);
    session = result.session;
  };
  const settleAll = (): void => {
    for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
      if (guard > 300) throw new Error(`stuck on ${session.state.pendingChoice.prompt.kind}`);
      const choice = session.state.pendingChoice;
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(session.state),
      });
    }
  };
  settleAll();
  for (const command of commands) {
    apply(command);
    settleAll();
  }
  const replayed = replay(session.log, WAVE9_DEPS);
  if (!replayed.ok) throw new Error(`replay failed: ${JSON.stringify(replayed)}`);
  expect(JSON.stringify(replayed.state)).toBe(JSON.stringify(session.state));
  return session.state;
}

type Where = "hand" | "attached" | "play" | "discard" | "elsewhere";
function whereIs(state: GameState, id: InstanceId): Where {
  const owner = playerOf(state, P1);
  if (owner.hand.includes(id)) return "hand";
  if (inst(state, id).attachedTo) return "attached";
  if (cardsInPlay(state).includes(id)) return "play";
  if (owner.discard.includes(id)) return "discard";
  return "elsewhere";
}

/** `code` put in hand and played the way the engine offers it. Null when the engine offers no such play. */
function cast(code: string, spec: Spec = {}): { before: GameState; after: GameState; id: InstanceId } | null {
  const opened = openGame(code, spec);
  const given = moveToHand(opened, P1, code);
  const id = given.ids[0]!;
  let state = given.state;
  const payment: InstanceId[] = [];
  for (const paying of spec.pay ?? []) {
    const conjured = conjure(state, P1, paying);
    state = conjured.state;
    payment.push(conjured.id);
  }
  const command = spec.pay
    ? ({
        type: "playCard",
        playerId: P1,
        cardInstanceId: id,
        payment: payment.map((fromHand) => ({ fromHand })),
        attachToInstanceId: null,
      } as Command)
    : exampleFor(state, id);
  if (!command) return null;
  return { before: state, after: drive(state, accepting([]), command), id };
}

/** Whether a bare play of `code` from hand is refused outright (not offered, and the engine rejects it). */
function refusedPlay(code: string, spec: Spec = {}): boolean {
  const given = moveToHand(openGame(code, spec), P1, code);
  const id = given.ids[0]!;
  if (exampleFor(given.state, id)) return false;
  const bare = { type: "playCard", playerId: P1, cardInstanceId: id, payment: [], attachToInstanceId: null } as Command;
  return !applyCommand(given.state, bare, WAVE9_DEPS).ok;
}

const PACKS = ["aos", "bp", "silk", "falcon", "winter"] as const;
/** Scripted cards of each pack's aspect-basic module: every ability ref is in the wave 9 registry. */
const scriptedOf = (pack: string): string[] =>
  (CARD_GROUPS[`${pack}/aspect-basic`] ?? []).filter((id) => {
    const refs = abilityRefsOf(dataOf(id));
    return refs.length > 0 && refs.every((ref) => WAVE9_DEPS.abilities[ref.id] !== undefined);
  });

/**
 * Cards played by a plain `legalActions` example from their default Core hero (no staging). The others are in `SPECS`
 * (staging they need), `REACTIVE` (played from a defense or scheme window) or `GATED` (refused for a Core hero).
 */
const SPECS: Readonly<Record<string, Spec>> = {
  // Hero Action: exhaust a S.H.I.E.L.D. card you control (a Core hero controls none).
  "50049": { stage: (st) => inPlayArea(st, "50021").state },
  // Spider-Man (Peter Parker) is the Core Spider-Man deck's identity (the unique rule), so she is seated in Captain Marvel's.
  // Requirement ([physical][mental][energy]) cost 3: Core's Strength, Genius and Energy pay it.
  "52022": { hero: "core-captain-marvel-leadership", pay: ["01090", "01089", "01088"] },
  // Hero Action: exhaust a Web-Warrior card you control.
  "52023": { stage: (st) => inPlayArea(st, "52014").state },
  // Hero Action: deal 1 damage to a Web-Warrior character you control (Requirement [mental]).
  "52034": { stage: (st) => inPlayArea(st, "52014").state },
  // Attach to an Aerial ally.
  "53024": { stage: (st) => inPlayArea(st, "53015").state },
  // Hero Action: exhaust up to 3 Weapon upgrades you control (Core's Energy Daggers is a Weapon).
  "54014": { stage: (st) => attached(st, "01046").state },
  // Attach to a S.H.I.E.L.D. character (Dum Dum Dugan).
  "54018": { stage: (st) => inPlayArea(st, "50021").state },
  "54020": { stage: (st) => inPlayArea(st, "50021").state },
  // Team-Up cards in the deck of one of their heroes (Maria Hill's pair is Nick Fury's deck, which holds Super Spies).
  // Team-Up also needs the partner in play: Core's Maria Hill ally (01067), the Winter Soldier ally 53035.
  "50024": { deck: () => seat("nick-fury-justice", "50024"), stage: (st) => inPlayArea(st, "01067").state },
  // Heart of the Panther: the named partner is a player's identity, so Black Panther / Shuri sits beside Core's T'Challa.
  "51025": { hero: "core-black-panther-protection", partner: () => seat("bp-justice") },
  "54022": { deck: () => seat("cap-leadership", "54022"), stage: (st) => inPlayArea(st, "53035").state },
  "54023": { deck: () => seat("bkw-justice", "54023"), stage: (st) => inPlayArea(st, "53035").state },
};

/** Cards a Core hero cannot play by their own printed text, and the trait of the identity that makes them playable. */
const GATED: Readonly<Record<string, readonly string[]>> = {
  "53020": ["AERIAL"], // Play only if your identity has the Aerial trait.
  "54019": ["SOLDIER"], // Play only if your identity has the Soldier trait.
  "54033": ["S.H.I.E.L.D."], // Play only if your identity has the S.H.I.E.L.D. trait.
};
/** "Play only if you are the Bucky Barnes or Sam Wilson player": no Core hero is, and no trait edit changes that. */
const NAMED_HERO_ONLY = ["53023"];
/** Resource cards: not played, spent to pay for another card (tested below with the card they affect). */
const RESOURCES_WITH_TEXT = ["50014", "53028"];
/** Reactive events, played from a defense or scheme window below. */
const REACTIVE = ["52015", "52016", "52024"];
/** Linked cards are set aside by the card that brings them in and can be in no deck (see the Linked tests above). */
const LINKED = ["51036", "53034"];

describe("wave 9 aspect and basic cards, from a Core hero's deck", () => {
  for (const pack of PACKS) {
    const scripted = scriptedOf(pack);
    const special = new Set([
      ...Object.keys(GATED),
      ...NAMED_HERO_ONLY,
      ...RESOURCES_WITH_TEXT,
      ...REACTIVE,
      ...LINKED,
    ]);
    describe(pack, () => {
      it("has scripted cards to test", () => {
        expect(scripted.length).toBeGreaterThan(5);
      });

      it.each(
        scripted
          .filter((id) => !special.has(id))
          .map((id) => [id, (dataOf(id) as { name: string }).name, dataOf(id).type] as const),
      )("%s %s (%s): offered, played, and ends where its type goes, with the log replaying", (id, _name, type) => {
        const played = cast(id, SPECS[id]);
        expect(played, `${id} was not offered as a play`).not.toBeNull();
        const where = whereIs(played!.after, played!.id);
        expect(where).not.toBe("hand");
        if (type === "event") expect(where).toBe("discard");
        else expect(["play", "attached"]).toContain(where);
      });
    });
  }

  it("no scripted pack module is left out of the loop (tt is unscripted, aos/shield holds encounter cards only)", () => {
    expect(
      Object.keys(CARD_GROUPS)
        .filter((k) => k.endsWith("/aspect-basic"))
        .sort(),
    ).toEqual([...PACKS, "tt"].map((p) => `${p}/aspect-basic`).sort());
    expect(CARD_GROUPS["aos/shield"]!.map((id) => dataOf(id).type)).not.toContain("event");
  });

  describe("cards a Core hero cannot play by their printed text", () => {
    it.each(Object.entries(GATED))(
      "%s is refused for the plain Core hero and played once the identity has %s",
      (id, traits) => {
        expect(refusedPlay(id)).toBe(true);
        const played = cast(id, { traits });
        expect(played, `${id} still not offered with ${traits.join(", ")}`).not.toBeNull();
        expect(whereIs(played!.after, played!.id)).not.toBe("hand");
      },
    );

    it("53023 Captain America (Play only if you are the Bucky Barnes or Sam Wilson player) is refused for a Core hero", () => {
      expect(refusedPlay("53023")).toBe(true);
    });
  });

  describe("resource cards with text", () => {
    it("50014 Organizational Support pays for a card; its interrupt finds nothing to exhaust and the card still resolves", () => {
      const cost1 = (dataOf("01063") as { cost: number }).cost;
      expect(cost1).toBe(1);
      const opened = openGame("50014");
      const resource = moveToHand(opened, P1, "50014");
      const target = conjure(resource.state, P1, "01063");
      const id = target.id;
      const after = drive(target.state, accepting(["50014"]), {
        type: "playCard",
        playerId: P1,
        cardInstanceId: id,
        payment: [{ fromHand: resource.ids[0]! }],
        attachToInstanceId: null,
      } as Command);
      expect(whereIs(after, id)).toBe("play");
      expect(playerOf(after, P1).discard).toContain(resource.ids[0]);
    });

    it("53028 The Power of Flight pays double for an Aerial card (Hugin & Munin, cost 2) and not for another", () => {
      const aerial = dataOf("53017") as { cost: number; traits: readonly string[] };
      expect(aerial.cost).toBe(2);
      expect(aerial.traits).toContain("AERIAL");
      const opened = openGame("53028");
      const resource = moveToHand(opened, P1, "53028");
      const flier = conjure(resource.state, P1, "53017");
      const pay = [{ fromHand: resource.ids[0]! }];
      const play = (cardInstanceId: InstanceId) =>
        ({ type: "playCard", playerId: P1, cardInstanceId, payment: pay, attachToInstanceId: null }) as Command;
      const after = drive(flier.state, accepting([]), play(flier.id));
      expect(whereIs(after, flier.id)).toBe("play");
      // Control: the same single resource does not pay for a non-Aerial card of cost 2 (Core's Backflip-style ally Black Cat 01002).
      const plain = conjure(resource.state, P1, "01002");
      expect((dataOf("01002") as { cost: number }).cost).toBe(2);
      expect(applyCommand(plain.state, play(plain.id), WAVE9_DEPS).ok).toBe(false);
    });
  });

  describe("reactive events, played from the window they answer", () => {
    /** Ends the turn in the current form and stops at the villain's defender prompt (hero form: Rhino attacks). */
    const atDefense = (state: GameState): GameState => {
      const staged = stackEncounterDeck(state, "01186"); // a blank boost card
      return settleUntil(runWith(WAVE9_DEPS, staged, endTurn(P1)), "declareDefender", firstLegal, WAVE9_DEPS);
    };

    it("52015 Not Today!: played as the hero defends, it is discarded and the attack is defended", () => {
      const given = moveToHand(openGame("52015"), P1, "52015");
      const defending = answer(atDefense(given.state), [seatIdentity(given.state)], WAVE9_DEPS);
      const after = settle(defending, accepting(["52015"]), undefined, WAVE9_DEPS);
      expect(whereIs(after, given.ids[0]!)).toBe("discard");
    });

    it('52016 "Stop Hitting Yourself": after a defense that takes no damage, it deals damage to the attacker', () => {
      // Core's Black Panther (Protection) defends Rhino's attack 2 with DEF 3 and takes no damage.
      const given = moveToHand(openGame("52016"), P1, "52016");
      const villain = given.state.activeVillainId!;
      const before = inst(given.state, villain).damage;
      const defending = answer(atDefense(given.state), [seatIdentity(given.state)], WAVE9_DEPS);
      const after = settle(defending, accepting(["52016"]), undefined, WAVE9_DEPS);
      expect(whereIs(after, given.ids[0]!)).toBe("discard");
      expect(inst(after, villain).damage).toBeGreaterThan(before);
    });

    /** `accepting` plus: when discarding down to hand size, never discard the card under test. */
    const keeping =
      (card: InstanceId, wanted: readonly string[]): Picker =>
      (st) => {
        const choice = st.pendingChoice;
        if (choice?.prompt.kind === "discardDownToHandSize") {
          return choice.options
            .filter((o) => o.optionId !== card)
            .slice(0, choice.minSelections)
            .map((o) => o.optionId);
        }
        return accepting(wanted)(st);
      };

    it("52024 Investigative Journalism (Team-Up, Spider-Man is Peter Parker): cancels an enemy scheme and confuses it", () => {
      // Team-Up (Cindy Moon and Peter Parker): Core's Spider-Man is Peter Parker, so Silk sits beside him.
      const given = moveToHand(
        openGame("52024", { alterEgo: true, partner: () => seat("silk-protection") }),
        P1,
        "52024",
      );
      const villain = given.state.activeVillainId!;
      const card = given.ids[0]!;
      const run = (wanted: readonly string[]) =>
        [endTurn(P1), endTurn(P2)].reduce(
          (st, command) => settle(runWith(WAVE9_DEPS, st, command), keeping(card, wanted), undefined, WAVE9_DEPS),
          stackEncounterDeck(given.state, "01186"),
        );
      const control = run([]);
      const after = run(["52024"]);
      expect(whereIs(after, given.ids[0]!)).toBe("discard");
      // With Silk seated the villain activates twice: the confused status the card places is spent by the second scheme.
      expect(inst(after, villain).statuses.confused).toBe(0);
      expect(inst(after, after.mainScheme.instanceId).threat).toBeLessThan(
        inst(control, control.mainScheme.instanceId).threat,
      );
    });
  });
});

describe("a real MarvelCDB decklist per new hero (DoD 4b piece 4)", () => {
  it.todo(
    "needs a download of one public decklist per hero, which is not approved yet; see docs/custom-deck-testing.md",
  );
});
