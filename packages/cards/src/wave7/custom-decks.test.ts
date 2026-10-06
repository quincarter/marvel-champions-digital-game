/**
 * Wave 7 definition-of-done 4b, pieces 1 and 2 (docs/wave-definition-of-done.md, docs/custom-deck-testing.md "The
 * pieces") for the six new heroes: Cable and Domino (`next_evol`), Psylocke, Angel, X-23 and Deadpool.
 *
 * 1. The deck builder's start state: `requiredIdentitySet` is exactly each hero's signature cards (RRG 1.8 Appendix I
 *    "Deck Customization", p. 50: "the exact quantity of each card included in that identity set").
 * 2. The wave's deckbuilding rules, one illegal deck per rule with the problem code and its player-readable message.
 *
 * What the six identities print as deckbuilding rules (read from `packages/content/src/data/*\/cards.ts` and
 * docs/phase7-wave7.md §1.x):
 * - Cable: "You may include player side schemes from any aspect in your deck" (`offAspectAllowance`, no limit).
 * - Domino, Psylocke, Angel, X-23 and Deadpool print none. Their packs bring only card-level rules: Permanent
 *   (Psi-Knife, X-23's Claws), the X-23 insert's Linked keyword, and Team-Up (Soaring Hearts, Frenemies).
 * - The 'Pool aspect (Deadpool insert, "Using the 'Pool Aspect"; RRG 1.8 "Aspect Card", p. 8) is a fifth chosen aspect,
 *   so it is mixed with another aspect only where the identity chooses several (Adam Warlock's FAQ, RRG p. 64).
 * "Counts as 2 restricted cards" (Laser Swords) is a play rule, not a deck rule, and is not tested here.
 * Not a deck rule either: the Crisis of Infinite Deadpools setup rule (RRG p. 64), which the setup tests cover.
 */
import { describe, expect, test } from "vitest";
import { requiredIdentitySet, unscriptedCards, validateDeck, type CampaignDeckContext } from "@mc/engine";
import {
  MTS_STARTER_DECKS,
  CORE_STARTER_DECKS,
  WAVE7_STARTER_DECKS,
  cardId,
  type AnyCard,
  type DeckContents,
  type HeroIdentityCard,
  type StarterDeck,
} from "@mc/content";
import { WAVE7_CARDS } from "./cards.js";
import { WAVE7_DEPS } from "./index.js";

const byId = new Map<string, AnyCard>(WAVE7_CARDS.map((card) => [card.id as string, card]));
const identityOf = (id: string): HeroIdentityCard => {
  const card = byId.get(id);
  if (!card || card.type !== "hero_identity") throw new Error(`no identity ${id}`);
  return card;
};
const starter = (id: string): StarterDeck => {
  const deck = WAVE7_STARTER_DECKS.find((d) => d.id === id);
  if (!deck) throw new Error(`no starter deck ${id}`);
  return deck;
};
const contentsOf = (deck: StarterDeck): DeckContents => ({
  identityCardId: deck.identityCardId,
  aspects: deck.aspects,
  cards: deck.cards,
});

/** `deck` with `quantity` (0 removes the line) of `card` instead of whatever it had. */
const withQuantity = (deck: DeckContents, card: string, quantity: number): DeckContents => ({
  ...deck,
  cards: [
    ...deck.cards.filter((l) => l.cardId !== card),
    ...(quantity > 0 ? [{ cardId: cardId(card), quantity }] : []),
  ],
});
/** `deck` with the whole line of `from` renamed to `to` (the same quantity). */
const swapped = (deck: DeckContents, from: string, to: string): DeckContents => ({
  ...deck,
  cards: deck.cards.map((l) => (l.cardId === from ? { ...l, cardId: cardId(to) } : l)),
});
const problemsOf = (deck: DeckContents) => {
  const verdict = validateDeck(deck, WAVE7_CARDS);
  if (verdict.ok) throw new Error("expected an illegal deck");
  return verdict.problems;
};
const messageOf = (deck: DeckContents, code: string): string | undefined =>
  problemsOf(deck).find((p) => p.code === code)?.message;

const HEROES = [
  { name: "Cable", identity: "40001a", deck: "cable-leadership", aspect: "leadership" },
  { name: "Domino", identity: "40037a", deck: "domino-justice", aspect: "justice" },
  { name: "Psylocke", identity: "41001a", deck: "psylocke-justice", aspect: "justice" },
  { name: "Angel", identity: "42001a", deck: "angel-protection", aspect: "protection" },
  { name: "X-23", identity: "43001a", deck: "x-23-aggression", aspect: "aggression" },
  { name: "Deadpool", identity: "44001a", deck: "deadpool-pool", aspect: "pool" },
] as const;

/** Each hero's signature cards, written out from the printed hero-pack lists (docs/phase7-wave7.md; starter deck provenance). */
const EXPECTED_SET: Readonly<Record<string, readonly (readonly [string, number])[]>> = {
  // Cable: 15 cards. Technovirus Purge (40006) is his own player side scheme.
  "40001a": [
    ["40002", 1],
    ["40003", 3],
    ["40004", 1],
    ["40005", 2],
    ["40006", 1],
    ["40007", 1],
    ["40008", 1],
    ["40009", 1],
    ["40010", 1],
    ["40011", 1],
    ["40012", 1],
    ["40013", 1],
  ],
  // Domino: 15 cards.
  "40037a": [
    ["40038", 1],
    ["40039", 1],
    ["40040", 2],
    ["40041", 1],
    ["40042", 2],
    ["40043", 1],
    ["40044", 1],
    ["40045", 1],
    ["40046", 2],
    ["40047", 1],
    ["40048", 1],
    ["40049", 1],
  ],
  // Psylocke: 17 cards. Psi-Knife (41002a, Permanent, flips to the Psi-Katana) is two copies of its front face.
  "41001a": [
    ["41002a", 2],
    ["41003", 1],
    ["41004", 3],
    ["41005", 3],
    ["41006", 2],
    ["41007", 2],
    ["41008", 1],
    ["41009", 1],
    ["41010", 1],
    ["41011", 1],
  ],
  // Angel: 15 cards, under a three-face identity (42001a/b/c).
  "42001a": [
    ["42002", 1],
    ["42003", 2],
    ["42004", 2],
    ["42005", 2],
    ["42006", 2],
    ["42007", 2],
    ["42008", 2],
    ["42009", 1],
    ["42010", 1],
  ],
  // X-23: 16 cards. X-23's Claws (43002) is Permanent. The four Linked Specialist upgrades (43034-43037) are not in it.
  "43001a": [
    ["43002", 1],
    ["43003", 1],
    ["43004", 2],
    ["43005", 3],
    ["43006", 2],
    ["43007", 1],
    ["43008", 1],
    ["43009", 1],
    ["43010", 1],
    ["43011", 1],
    ["43012", 2],
  ],
  // Deadpool: 15 cards.
  "44001a": [
    ["44002", 1],
    ["44003", 1],
    ["44004", 2],
    ["44005", 1],
    ["44006", 2],
    ["44007", 1],
    ["44008", 1],
    ["44009", 1],
    ["44010", 2],
    ["44011", 1],
    ["44012", 2],
  ],
};
const SET_SIZE: Readonly<Record<string, number>> = {
  "40001a": 15,
  "40037a": 15,
  "41001a": 17,
  "42001a": 15,
  "43001a": 16,
  "44001a": 15,
};

describe("wave 7 heroes: deck builder start state (RRG 1.8 Appendix I 'Deck Customization', p. 50)", () => {
  describe.each(HEROES)("$name", ({ identity, deck }) => {
    const required = requiredIdentitySet(identityOf(identity), WAVE7_CARDS);
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
        expect(id).not.toMatch(/[bc]$/);
      }
    });
  });

  test("X-23: Permanent X-23's Claws is in the set; the four Linked Specialist upgrades are not", () => {
    const ids = requiredIdentitySet(identityOf("43001a"), WAVE7_CARDS).map((r) => r.cardId as string);
    expect(ids).toContain("43002");
    for (const linked of ["43034", "43035", "43036", "43037"]) expect(ids).not.toContain(linked);
    // Specialized Training (43021, the card that brings them in) is a basic player side scheme, not a set card.
    expect(ids).not.toContain("43021");
  });

  test("Angel: one record with three faces (Angel, Warren Worthington III, Archangel); the set is the same under all of them", () => {
    const angel = identityOf("42001a");
    expect(angel.hero?.faceName).toBe("Angel");
    expect(angel.alterEgo?.faceName).toBe("Warren Worthington III");
    expect(angel.additionalHeroForms?.map((f) => f.faceName)).toEqual(["Archangel"]);
    // The faces are one card (no 42001b/c records), so no face can leak into the set or the deck.
    expect(WAVE7_CARDS.filter((c) => /^42001[bc]$/.test(c.id as string))).toEqual([]);
    expect(validateDeck(contentsOf(starter("angel-protection")), WAVE7_CARDS)).toEqual({ ok: true });
  });

  test("Psylocke: the Psi-Knife line is its front face (41002a) x2, and the deck is legal with both Permanent copies uncounted", () => {
    const required = requiredIdentitySet(identityOf("41001a"), WAVE7_CARDS);
    expect(required.find((r) => r.cardId === "41002a")?.quantity).toBe(2);
    expect(required.some((r) => (r.cardId as string).startsWith("41002") && r.cardId !== "41002a")).toBe(false);
    // RRG 1.8 "Permanent" (p. 32): Permanent cards do not count toward deck size. 42 listed, 40 counted.
    const deck = contentsOf(starter("psylocke-justice"));
    expect(deck.cards.reduce((n, l) => n + l.quantity, 0)).toBe(42);
    expect(validateDeck(deck, WAVE7_CARDS)).toEqual({ ok: true });
  });

  test("Deadpool: the Dreadpool set (44037-44042) is an encounter set, never a deck card or part of his set", () => {
    const required = requiredIdentitySet(identityOf("44001a"), WAVE7_CARDS).map((r) => r.cardId as string);
    for (const id of ["44037", "44038", "44039", "44040", "44041", "44042"]) {
      expect(required).not.toContain(id);
      expect(starter("deadpool-pool").cards.some((l) => l.cardId === id)).toBe(false);
    }
    const deck = withQuantity(contentsOf(starter("deadpool-pool")), "44038", 1);
    const problem = problemsOf(deck).find((p) => p.code === "not_a_player_card");
    expect(problem?.cardIds).toEqual(["44038"]);
    expect(problem?.message).toBe(
      "Dreadpool is a minion card, not a player card: encounter cards (including obligations and nemesis cards, which setup adds for you) cannot be in a player deck.",
    );
  });
});

describe("wave 7 precons: legal, and nothing in them is unscripted", () => {
  describe.each(HEROES)("$name", ({ deck }) => {
    test("is legal under validateDeck against the wave 7 pool", () => {
      expect(validateDeck(contentsOf(starter(deck)), WAVE7_CARDS)).toEqual({ ok: true });
    });

    test("can be seated: no card in it, its obligation or its nemesis set is unscripted", () => {
      expect(unscriptedCards(contentsOf(starter(deck)), WAVE7_CARDS, WAVE7_DEPS)).toEqual([]);
    });
  });
});

describe("wave 7 deckbuilding rules", () => {
  describe("Cable: player side schemes from any aspect (his identity text; RRG 1.8 Appendix I 'Deck Customization', p. 50)", () => {
    const cable = contentsOf(starter("cable-leadership"));

    test("his precon holds an Aggression and a Protection player side scheme under Leadership, and is legal", () => {
      expect(cable.cards.some((l) => l.cardId === "40019")).toBe(true); // Lock and Load (Aggression)
      expect(cable.cards.some((l) => l.cardId === "40020")).toBe(true); // Establish Perimeter (Protection)
      expect(validateDeck(cable, WAVE7_CARDS)).toEqual({ ok: true });
    });

    test("there is no limit on how many off-aspect player side schemes he runs", () => {
      // Swap the precon's three Leadership 40022 for the four other aspects' side schemes and Build Support: the
      // deck stays 40 cards and no aspect or requirement problem appears, however many are off-aspect.
      const base = withQuantity(cable, "40022", 0);
      const deck: DeckContents = {
        ...base,
        cards: [
          ...base.cards.filter((l) => l.cardId !== "40019" && l.cardId !== "40020"),
          ...["40019", "40020", "40054", "41016", "42017", "44024"].map((id) => ({ cardId: cardId(id), quantity: 1 })),
        ],
      };
      // Aggression, Protection, Justice and 'Pool side schemes under a Leadership deck: all allowed.
      expect(validateDeck(deck, WAVE7_CARDS)).toEqual({ ok: true });
    });

    test("only player side schemes: an off-aspect Aggression event is still refused", () => {
      // Swap Domino's A Good Workout ... any Aggression card; the Core Aggression deck has plenty. Use Gamora-free pool data.
      const aggressionEvent = WAVE7_CARDS.find(
        (c) => c.type === "event" && (c as { aspect?: string }).aspect === "aggression",
      )!;
      const deck = swapped(cable, "40022", aggressionEvent.id as string); // a Leadership card out, an Aggression event in
      expect(messageOf(deck, "aspect_restriction")).toBe(
        `${aggressionEvent.name} is a Aggression card, but this deck's aspect is Leadership; beyond its identity set a deck may only use its chosen aspect and basic cards.`,
      );
    });

    test("the allowance is Cable's alone: Domino cannot run Cable's Aggression player side scheme", () => {
      const domino = contentsOf(starter("domino-justice"));
      const deck = swapped(domino, "40054", "40019"); // Take Out the Guards (Justice) -> Lock and Load (Aggression)
      expect(messageOf(deck, "aspect_restriction")).toBe(
        "Lock and Load is a Aggression card, but this deck's aspect is Justice; beyond its identity set a deck may only use its chosen aspect and basic cards.",
      );
    });
  });

  describe("no other identity of the six prints a deckbuilding rule", () => {
    test("Domino, Psylocke, Angel, X-23 and Deadpool have no deckbuilding data (no allowance, package or requirement)", () => {
      for (const id of ["40037a", "41001a", "42001a", "43001a", "44001a"]) {
        expect(identityOf(id).deckbuilding, id).toBeUndefined();
      }
      expect(identityOf("40001a").deckbuilding).toEqual({ offAspectAllowance: { cardType: "player_side_scheme" } });
    });

    test("Psylocke may not run an off-aspect player side scheme (Cable's allowance is not hers)", () => {
      const deck = swapped(contentsOf(starter("psylocke-justice")), "41016", "40019");
      expect(messageOf(deck, "aspect_restriction")).toBe(
        "Lock and Load is a Aggression card, but this deck's aspect is Justice; beyond its identity set a deck may only use its chosen aspect and basic cards.",
      );
    });
  });

  describe("a hero's kit is identity-specific (RRG 1.8 'Identity-Specific Card', p. 23)", () => {
    test("another hero's kit card in a Domino deck is refused, naming the owner", () => {
      const deck = withQuantity(contentsOf(starter("domino-justice")), "40003", 1); // Cable's Mind Scan
      expect(problemsOf(deck).map((p) => p.code)).toEqual(["other_identity_card"]);
      expect(messageOf(deck, "other_identity_card")).toBe(
        "Mind Scan belongs to Cable (Nathan Summers)'s identity set; identity-specific cards can only be used in that identity's deck.",
      );
    });

    test("Angel's deck with Psylocke's ally 41003 (her kit card) is refused; Psylocke's own 42002 likewise in Angel's absence", () => {
      const angelDeck = swapped(contentsOf(starter("angel-protection")), "42002", "41003");
      expect(messageOf(angelDeck, "other_identity_card")).toBe(
        "Angel (Warren Worthington III) belongs to Psylocke (Betsy Braddock)'s identity set; identity-specific cards can only be used in that identity's deck.",
      );
      const psylockeDeck = swapped(contentsOf(starter("psylocke-justice")), "41003", "42002");
      expect(messageOf(psylockeDeck, "other_identity_card")).toBe(
        "Psylocke (Betsy Braddock) belongs to Angel (Warren Worthington III)'s identity set; identity-specific cards can only be used in that identity's deck.",
      );
    });

    test("Deadpool's Cable ally (44002) and Cable's own are not interchangeable: 44002 is refused in Cable's deck", () => {
      const deck = withQuantity(contentsOf(starter("cable-leadership")), "44002", 1);
      expect(messageOf(deck, "other_identity_card")).toBe(
        "Cable (Nathan Summers) belongs to Deadpool (Wade Wilson)'s identity set; identity-specific cards can only be used in that identity's deck.",
      );
    });

    test.each(HEROES)("$name: dropping one card of the set is reported with its quantity", ({ identity, deck }) => {
      // The first set card with more than one copy, so the message is the 'has N copies, needs M' one.
      const contents = contentsOf(starter(deck));
      const [first, quantity] = EXPECTED_SET[identity]!.find(([, q]) => q > 1)!;
      const name = (byId.get(first) as { name: string }).name;
      const identityName = (byId.get(identity) as { name: string }).name;
      void identityName;
      const verdict = messageOf(withQuantity(contents, first, quantity - 1), "identity_set_mismatch");
      expect(verdict).toContain(`${name} has ${quantity - 1} cop${quantity - 1 === 1 ? "y" : "ies"}, but `);
      expect(verdict).toContain(
        `identity set has exactly ${quantity} copies, and a deck must include exactly that many.`,
      );
    });
  });

  describe("copy limits (RRG 1.8 Appendix I: no more than three copies by title)", () => {
    test("a fourth copy of a three-copy aspect card is refused", () => {
      const deck = withQuantity(contentsOf(starter("domino-justice")), "40052", 4);
      expect(messageOf(deck, "copy_limit")).toBe(
        "Even the Odds has 4 copies; a deck may include no more than 3 copies of a non-unique card (by title).",
      );
    });
  });
});

describe("Team-Up cards (RRG 1.8 'Team-Up', p. 43; Appendix I): legal only in a deck whose identity is one of the two named", () => {
  const cable = contentsOf(starter("cable-leadership"));
  const deadpool = contentsOf(starter("deadpool-pool"));
  const psylocke = contentsOf(starter("psylocke-justice"));
  const angel = contentsOf(starter("angel-protection"));

  test("each precon holds its own printing of its Team-Up card and is legal", () => {
    expect(cable.cards.find((l) => l.cardId === "40026")?.quantity).toBe(1); // Frenemies (Cable and Deadpool)
    expect(deadpool.cards.find((l) => l.cardId === "44031")?.quantity).toBe(1); // Frenemies
    expect(psylocke.cards.find((l) => l.cardId === "41020")?.quantity).toBe(1); // Soaring Hearts (Angel and Psylocke)
    expect(angel.cards.find((l) => l.cardId === "42021")?.quantity).toBe(1); // Soaring Hearts
    for (const deck of [cable, deadpool, psylocke, angel])
      expect(validateDeck(deck, WAVE7_CARDS)).toEqual({ ok: true });
  });

  test("the other named hero's printing is legal too: Frenemies 44031 in Cable's deck, 40026 in Deadpool's", () => {
    expect(validateDeck(swapped(cable, "40026", "44031"), WAVE7_CARDS)).toEqual({ ok: true });
    expect(validateDeck(swapped(deadpool, "44031", "40026"), WAVE7_CARDS)).toEqual({ ok: true });
  });

  test("the other named hero's printing is legal too: Soaring Hearts 42021 in Psylocke's deck, 41020 in Angel's", () => {
    expect(validateDeck(swapped(psylocke, "41020", "42021"), WAVE7_CARDS)).toEqual({ ok: true });
    expect(validateDeck(swapped(angel, "42021", "41020"), WAVE7_CARDS)).toEqual({ ok: true });
  });

  test("Soaring Hearts is refused in a Domino deck, with its player-readable message", () => {
    const deck = withQuantity(contentsOf(starter("domino-justice")), "41020", 1);
    expect(problemsOf(deck).map((p) => p.code)).toEqual(["team_up_identity"]);
    expect(messageOf(deck, "team_up_identity")).toBe(
      "Soaring Hearts is a Team-Up card for Angel and Psylocke; only a deck whose identity is one of them may include it.",
    );
  });

  test("Frenemies is refused in a Psylocke deck and Soaring Hearts in a Deadpool deck", () => {
    expect(messageOf(withQuantity(psylocke, "44031", 1), "team_up_identity")).toBe(
      "Frenemies is a Team-Up card for Cable and Deadpool; only a deck whose identity is one of them may include it.",
    );
    expect(messageOf(withQuantity(deadpool, "42021", 1), "team_up_identity")).toBe(
      "Soaring Hearts is a Team-Up card for Angel and Psylocke; only a deck whose identity is one of them may include it.",
    );
  });
});

describe("Linked cards (X-23 insert 'New Keyword: Linked'; RRG 1.8 'Linked (Card Title)', p. 27)", () => {
  const x23 = contentsOf(starter("x-23-aggression"));

  test("the precon holds Specialized Training and none of the four Specialist upgrades, and is legal", () => {
    expect(x23.cards.find((l) => l.cardId === "43021")?.quantity).toBe(1);
    for (const id of ["43034", "43035", "43036", "43037"]) expect(x23.cards.some((l) => l.cardId === id)).toBe(false);
    expect(validateDeck(x23, WAVE7_CARDS)).toEqual({ ok: true });
  });

  test.each([
    ["43034", "Combat Specialist"],
    ["43035", "Defense Specialist"],
    ["43036", "Front Line Specialist"],
    ["43037", "Surveillance Specialist"],
  ])("%s %s cannot be included in a deck, even X-23's own", (id, title) => {
    const deck = withQuantity(x23, id, 1);
    expect(problemsOf(deck).map((p) => p.code)).toEqual(["linked_card"]);
    expect(messageOf(deck, "linked_card")).toBe(
      `${title} has the Linked keyword: linked cards cannot be included in a deck; they are set aside at setup by the card that brings them into play.`,
    );
  });

  test("X-23's Claws is Permanent: it is required, and does not count toward the 40-card minimum (RRG p. 32)", () => {
    const listed = x23.cards.reduce((n, l) => n + l.quantity, 0);
    expect(listed).toBe(41);
    expect(validateDeck(x23, WAVE7_CARDS)).toEqual({ ok: true });
    const without = withQuantity(x23, "43002", 0);
    expect(problemsOf(without).map((p) => p.code)).toEqual(["identity_set_mismatch"]);
    expect(messageOf(without, "identity_set_mismatch")).toBe(
      "X-23's Claws is missing: a deck for X-23 (Laura Kinney) must include every card in that identity's set, and this one needs 1 copy.",
    );
  });
});

describe("campaign-only and scenario-only cards are refused in a standard deck (RRG 1.8 'Campaign-Specific Card', p. 11; 'Scenario-Specific Card', p. 38)", () => {
  const domino = contentsOf(starter("domino-justice"));

  test.each([
    ["40190a", "Assemble the Team"],
    ["40191a", "Establish Safehouse"],
    ["40192a", "Gear Up"],
    ["40193a", "Mission Prep"],
    ["40194a", "Practice Maneuvers"],
    ["40195a", "Prepare Defenses"],
    ["40196", "Pouches"],
    ["40197", "Safehouse"],
  ])("%s %s is a NeXt Evolution campaign card", (id, title) => {
    const deck = withQuantity(domino, id, 1);
    expect(problemsOf(deck).map((p) => p.code)).toEqual(["campaign_card"]);
    expect(messageOf(deck, "campaign_card")).toBe(
      `${title} is a campaign card: it can only be used during a campaign from the same product, and this deck is not being built for a campaign.`,
    );
  });

  test.each([
    ["40079", "Morlock"],
    ["40130", "Hope Summers"],
  ])("%s %s is a scenario's own ally, never a deck card", (id, title) => {
    const deck = withQuantity(domino, id, 1);
    expect(problemsOf(deck).map((p) => p.code)).toEqual(["scenario_card"]);
    expect(messageOf(deck, "scenario_card")).toContain(`${title}`);
    expect(messageOf(deck, "scenario_card")).toContain("cannot be put in a deck");
  });

  test("inside the NeXt Evolution campaign, a card the campaign granted is legal and an ungranted one is not", () => {
    const context = (granted: readonly string[]): { campaign: CampaignDeckContext } => ({
      campaign: {
        campaignId: "next_evol",
        campaignSetIds: ["next_evol_campaign"],
        identityCardId: "40037a",
        grantedCardIds: granted,
      },
    });
    const deck = withQuantity(domino, "40197", 1);
    const refused = validateDeck(deck, WAVE7_CARDS, context([]));
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.problems.map((p) => p.code)).toEqual(["campaign_card_not_granted"]);
    expect(validateDeck(deck, WAVE7_CARDS, context(["40197"]))).toEqual({ ok: true });
  });
});

describe("the 'Pool aspect (Deadpool insert, 'Using the 'Pool Aspect'; RRG 1.8 'Aspect Card', p. 8; FAQ p. 64)", () => {
  const spiderMan = CORE_STARTER_DECKS.find((d) => d.id === "core-spider-man-justice")!;
  const spiderIdentity = identityOf(spiderMan.identityCardId as string);
  const isPerm = (id: string): boolean =>
    (byId.get(id) as { keywords?: readonly { name: string }[] }).keywords?.some((k) => k.name === "permanent") ?? false;
  const PLAYER_TYPES: readonly string[] = ["ally", "event", "support", "upgrade", "resource", "player_side_scheme"];
  /** Every 'Pool card as a deck line: three copies of a non-unique title, one of a unique one. */
  const poolCards = WAVE7_CARDS.filter(
    (c) =>
      (c as { aspect?: string }).aspect === "pool" &&
      PLAYER_TYPES.includes(c.type) &&
      (c as { specificTo?: unknown }).specificTo === undefined,
  );

  /** A legal Spider-Man (Peter Parker) deck of 40 counted cards: his set, then 'Pool cards. */
  const poolSpiderMan = (): DeckContents => {
    const set = requiredIdentitySet(spiderIdentity, WAVE7_CARDS).map((r) => ({
      cardId: r.cardId,
      quantity: r.quantity,
    }));
    let counted = set.filter((l) => !isPerm(l.cardId as string)).reduce((n, l) => n + l.quantity, 0);
    const cards = [...set];
    for (const card of poolCards) {
      if (counted >= 40) break;
      const limit = (card as { unique?: boolean }).unique ? 1 : ((card as { deckLimit?: number }).deckLimit ?? 3);
      const quantity = Math.min(limit, 40 - counted);
      cards.push({ cardId: card.id as ReturnType<typeof cardId>, quantity });
      counted += quantity;
    }
    return { identityCardId: spiderMan.identityCardId, aspects: ["pool"], cards };
  };

  test("the wave 7 pool holds 34 'Pool player cards besides Frenemies (basic)", () => {
    expect(poolCards.length).toBe(34);
  });

  test("any hero can choose 'Pool as the chosen aspect: Spider-Man with 'Pool cards is legal", () => {
    expect(validateDeck(poolSpiderMan(), WAVE7_CARDS)).toEqual({ ok: true });
  });

  test("'Pool is an aspect like any other: with Justice chosen instead, the same deck's 'Pool cards are refused", () => {
    const deck: DeckContents = { ...poolSpiderMan(), aspects: ["justice"] };
    const problems = problemsOf(deck).filter((p) => p.code === "aspect_restriction");
    expect(problems.length).toBeGreaterThan(0);
    const first = problems[0]!;
    const name = (byId.get(first.cardIds[0]! as string) as { name: string }).name;
    expect(first.message.startsWith(name)).toBe(true);
    expect(
      first.message.endsWith(
        " is a 'Pool card, but this deck's aspect is Justice; beyond its identity set a deck may only use its chosen aspect and basic cards.",
      ),
    ).toBe(true);
  });

  test("with 'Pool chosen, another aspect's card is refused (the aspects are not mixed)", () => {
    const justice = WAVE7_CARDS.find((c) => (c as { aspect?: string }).aspect === "justice" && c.type === "event") as {
      id: string;
      name: string;
    };
    const deck = swapped(poolSpiderMan(), poolCards[0]!.id as string, justice.id);
    const message = messageOf(deck, "aspect_restriction");
    expect(message?.startsWith(justice.name)).toBe(true);
    expect(
      message?.endsWith(
        " is a Justice card, but this deck's aspect is 'Pool; beyond its identity set a deck may only use its chosen aspect and basic cards.",
      ),
    ).toBe(true);
  });

  test("choosing 'Pool together with a second aspect is refused for a hero who chooses one aspect", () => {
    const deck: DeckContents = { ...poolSpiderMan(), aspects: ["pool", "justice"] };
    expect(messageOf(deck, "aspect_choice")).toBe(
      "A deck for Spider-Man (Peter Parker) must choose exactly one aspect; this deck chooses 'Pool and Justice.",
    );
  });

  test("Deadpool's own deck with another aspect chosen loses his 'Pool cards, and with two aspects is refused", () => {
    const precon = contentsOf(starter("deadpool-pool"));
    const justice: DeckContents = { ...precon, aspects: ["justice"] };
    const restricted = problemsOf(justice).filter((p) => p.code === "aspect_restriction");
    expect(restricted.length).toBeGreaterThan(0);
    expect(restricted[0]!.message).toMatch(/is a 'Pool card, but this deck's aspect is Justice; /);
    const two: DeckContents = { ...precon, aspects: ["pool", "justice"] };
    expect(messageOf(two, "aspect_choice")).toBe(
      "A deck for Deadpool (Wade Wilson) must choose exactly one aspect; this deck chooses 'Pool and Justice.",
    );
  });

  test("Adam Warlock's fifth-aspect FAQ (p. 64): 'Pool replaces Aggression among his four aspects, one copy per title", () => {
    const adam = MTS_STARTER_DECKS.find((d) => d.id === "adam-warlock-all-aspects")!;
    const aggression = adam.cards.filter(
      (l) => (byId.get(l.cardId) as { aspect?: string } | undefined)?.aspect === "aggression",
    );
    expect(aggression.length).toBeGreaterThan(0);
    const titles = new Set<string>();
    const picks = poolCards.filter((c) => {
      const title = (c as { name: string }).name;
      if (titles.has(title)) return false;
      titles.add(title);
      return true;
    });
    const total = aggression.reduce((n, l) => n + l.quantity, 0);
    const replacement = picks.slice(0, total).map((c) => ({ cardId: c.id as ReturnType<typeof cardId>, quantity: 1 }));
    const deck: DeckContents = {
      identityCardId: adam.identityCardId,
      aspects: ["pool", "justice", "leadership", "protection"],
      cards: [...adam.cards.filter((l) => !aggression.includes(l)), ...replacement],
    };
    expect(validateDeck(deck, WAVE7_CARDS)).toEqual({ ok: true });
    // Leaving Aggression among the chosen aspects with 'Pool cards in the list refuses them.
    const stale: DeckContents = { ...deck, aspects: ["aggression", "justice", "leadership", "protection"] };
    expect(problemsOf(stale).some((p) => p.code === "aspect_restriction")).toBe(true);
  });
});
