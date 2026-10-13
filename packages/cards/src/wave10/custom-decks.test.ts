/**
 * Wave 10 definition-of-done 4b, pieces 1 to 3 (docs/wave-definition-of-done.md, docs/custom-deck-testing.md "The
 * pieces") for the four new heroes: Tigra and Hulkling (`cw`, the Civil War box), Wonder Man (`wonder_man`) and Hercules
 * (`hercules`). Piece 4 (a real MarvelCDB decklist per hero) is in `custom-decks-marvelcdb.test.ts`.
 *
 * 1. Cards in another hero's deck: every scripted new aspect and basic player card of the three packs (`cw/aspect-basic`,
 *    `wonder_man/{justice,other-aspects,basic}`, `hercules/{leadership,basic}`) is played through the engine from a Core
 *    hero's deck, so a script that assumes its precon hero fails. A card with no ability (a plain resource) has nothing
 *    to script and is skipped; a card the Core hero cannot play by its own printed text ("Play only if your identity
 *    has ...") is asserted refused, and played once a Core hero (or the Core identity, with the trait added to the
 *    card pool) satisfies it. Identity-specific cards are out of scope. Encounter cards (`hercules/all-versus-all`,
 *    the leaders, the modular sets) are not player cards.
 * 2. The wave's deckbuilding rules: Wonder Man's off-aspect allowance (`OffAspectAllowance.printedResource`, Simon
 *    Williams 58001b), Hercules' Gift and Labor cards (separate decks, never in the 40), identity-specific kits, the
 *    one-aspect rule, copy limits, Team-Up and the unique rule.
 * 3. The deck builder's start state: `requiredIdentitySet` is exactly each hero's signature cards (RRG 1.8 Appendix I
 *    "Deck Customization", p. 50).
 *
 * Decks are validated against `PLAYABLE_CARDS` (it holds every wave, wave 10 included).
 */
import { describe, expect, it, vi } from "vitest";
import {
  PLAYABLE_CARDS,
  CORE_STARTER_DECKS,
  WAVE10_STARTER_DECKS,
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
  answer,
  endTurn,
  firstLegal,
  identityOf as seatIdentity,
  inst,
  patchInstance,
  moveToHand,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../testing/harness.js";
import { withForm } from "../testing/staging.js";
import { attached, conjure, inPlayArea } from "../wave7/rulings-2026-10-06-harness.js";
import { accepting } from "../wave8/cross-hero-testing.js";
import { CARD_GROUPS } from "./card-groups.js";
import { WAVE10_DEPS } from "./index.js";
import { engageMinion } from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

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
const ALL_STARTER_DECKS: readonly StarterDeck[] = [...CORE_STARTER_DECKS, ...WAVE10_STARTER_DECKS];
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
const nameOf = (id: string): string => {
  const card = dataOf(id) as { name: string; subtitle?: string; unique?: boolean };
  return card.unique && card.subtitle ? `${card.name} (${card.subtitle})` : card.name;
};

const HEROES = [
  {
    name: "Tigra",
    who: "Tigra (Greer Nelson)",
    identity: "56001a",
    deck: "tigra-aggression",
    aspect: "aggression",
  },
  {
    name: "Hulkling",
    who: "Hulkling (Teddy Altman)",
    identity: "56029a",
    deck: "hulkling-protection",
    aspect: "protection",
  },
  {
    name: "Wonder Man",
    who: "Wonder Man (Simon Williams)",
    identity: "58001a",
    deck: "wonder-man-justice",
    aspect: "justice",
  },
  {
    name: "Hercules",
    who: "Hercules (Hercules)",
    identity: "59001a",
    deck: "hercules-leadership",
    aspect: "leadership",
  },
] as const;

// ---------------------------------------------------------------------------------------------------------------------
// 3. Deck builder start state
// ---------------------------------------------------------------------------------------------------------------------

/** Each hero's signature cards as the printed hero-pack lists (and the precons) carry them. */
const EXPECTED_SET: Readonly<Record<string, readonly (readonly [string, number])[]>> = {
  // Tigra: 15 cards.
  "56001a": [
    ["56002", 1],
    ["56003", 1],
    ["56004", 1],
    ["56005", 2],
    ["56006", 2],
    ["56007", 3],
    ["56008", 3],
    ["56009", 2],
  ],
  // Hulkling: 15 cards.
  "56029a": [
    ["56030", 1],
    ["56031", 1],
    ["56032", 1],
    ["56033", 1],
    ["56034", 1],
    ["56035", 1],
    ["56036", 1],
    ["56037", 3],
    ["56038", 2],
    ["56039", 2],
    ["56040", 1],
  ],
  // Wonder Man: 16 entries, including his Permanent upgrade Ionic Physiology (58002), which does not count toward 40.
  "58001a": [
    ["58002", 1],
    ["58003", 3],
    ["58004", 2],
    ["58005", 3],
    ["58006", 2],
    ["58007", 1],
    ["58008", 1],
    ["58009", 1],
    ["58010", 1],
    ["58011", 1],
  ],
  // Hercules: 15 cards. His three Gift (59005 to 59007) and three Labor (59002 to 59004) cards are separate decks that
  // setup builds, so they are deliberately not in the set (`identitySetMembers` skips `separateDeck` cards).
  "59001a": [
    ["59008", 1],
    ["59009", 3],
    ["59010", 2],
    ["59011", 2],
    ["59012", 1],
    ["59013", 1],
    ["59014", 1],
    ["59015", 1],
    ["59016", 2],
    ["59017", 1],
  ],
};

describe("wave 10 heroes: deck builder start state (RRG 1.8 Appendix I 'Deck Customization', p. 50)", () => {
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
        const card = dataOf(id);
        expect(["hero_identity", "obligation", "treachery", "minion", "attachment", "side_scheme"]).not.toContain(
          card.type,
        );
      }
    });
  });

  it("Wonder Man's set includes the Permanent Ionic Physiology 58002 (one copy), which the precon lists too", () => {
    expect(requiredIdentitySet(identityCard("58001a"), PLAYABLE_CARDS)[0]).toEqual({
      cardId: cardId("58002"),
      quantity: 1,
    });
    expect(starter("wonder-man-justice").cards.find((l) => l.cardId === "58002")?.quantity).toBe(1);
  });

  it("Hercules' set leaves out the Labor (59002 to 59004) and Gift (59005 to 59007) cards, as the printed precon does", () => {
    const required = requiredIdentitySet(identityCard("59001a"), PLAYABLE_CARDS).map((r) => r.cardId as string);
    for (const id of ["59002", "59003", "59004", "59005", "59006", "59007"]) {
      expect(required).not.toContain(id);
      expect(starter("hercules-leadership").cards.map((l) => l.cardId as string)).not.toContain(id);
      // The exclusion is deliberate (`separateDeck`), not a missing hero-set icon.
      expect((dataOf(id) as { setCode?: string }).setCode).toBe("hercules");
      expect((dataOf(id) as { separateDeck?: string }).separateDeck).toMatch(/^(Labor|Gift)$/);
    }
  });
});

describe("wave 10 precons: legal, and nothing in them is unscripted", () => {
  describe.each(HEROES)("$name", ({ deck }) => {
    it("is legal under validateDeck against the playable pool", () => {
      expect(validateDeck(deckOf(deck), PLAYABLE_CARDS)).toEqual({ ok: true });
    });
    // `unscriptedCards` also counts the hero's obligation and nemesis set. No precon has a known gap.
    it("has no unscripted card (obligation and nemesis set included)", () => {
      expect(unscriptedCards(deckOf(deck), PLAYABLE_CARDS, WAVE10_DEPS).map((c) => c as string)).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// 2. Deckbuilding rules
// ---------------------------------------------------------------------------------------------------------------------

describe("wave 10 deckbuilding rules", () => {
  describe("only Wonder Man prints a deckbuilding rule; the other three print none", () => {
    it.each(HEROES.filter((h) => h.identity !== "58001a"))("$name has no deckbuilding data", ({ identity }) => {
      expect(identityCard(identity).deckbuilding).toBeUndefined();
    });

    it("Wonder Man's data is 'events with a printed energy resource from any aspect' (no cap)", () => {
      expect(identityCard("58001a").deckbuilding).toEqual({
        offAspectAllowance: { cardType: "event", printedResource: "energy" },
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

  describe("Wonder Man: off-aspect events with a printed [energy] resource (Simon Williams 58001b; RRG 1.8 'Printed', p. 35)", () => {
    const wm = deckOf("wonder-man-justice");
    const HINT =
      " Wonder Man (Simon Williams)'s deckbuilding rule lets in only event cards with a printed energy resource from other aspects, and this card is not one.";
    const refusal = (aspect: string, card: string): string =>
      `${nameOf(card)} is a ${label(aspect)} card, but this deck's aspect is Justice; beyond its identity set a deck may only use its chosen aspect and basic cards.${HINT}`;

    it("the precon holds three off-aspect energy events (Bombs Away, Stronger Together, Unified Strike) and is legal", () => {
      for (const id of ["58017", "58019", "58020"]) {
        const card = dataOf(id) as { aspect: string; type: string };
        expect(card.type).toBe("event");
        expect(card.aspect).not.toBe("justice");
        expect(wm.cards.find((l) => l.cardId === id)?.quantity).toBe(3);
      }
      expect(validateDeck(wm, PLAYABLE_CARDS)).toEqual({ ok: true });
    });

    it.each([
      ["01053", "Relentless Assault", "aggression"],
      ["01070", "Lead from the Front", "leadership"],
    ])("a Core off-aspect energy event (%s %s, %s) is legal, with no cap on how many", (id) => {
      expect(validateDeck(adding(wm, id, 3), PLAYABLE_CARDS)).toEqual({ ok: true });
      // Six more off-aspect energy events on top of the nine: the allowance prints no maximum.
      const many = adding(adding(wm, "01053", 3), "01070", 3);
      expect(validateDeck(many, PLAYABLE_CARDS)).toEqual({ ok: true });
    });

    it.each([
      ["01054", "Uppercut", "aggression", "physical"],
      ["01052", "Chase Them Down", "aggression", "mental"],
      ["01077", "Counter-Punch", "protection", "physical"],
      ["01071", "Make the Call", "leadership", "mental"],
    ])(
      "an off-aspect event with no energy icon (%s %s, prints %s) is refused with the rule spelled out",
      (id, _n, aspect) => {
        expect(dataOf(id).type).toBe("event");
        expect(codesOf(adding(wm, id))).toEqual(["aspect_restriction"]);
        expect(messageOf(adding(wm, id), "aspect_restriction")).toBe(refusal(aspect, id));
      },
    );

    it.each([
      ["01056", "Tac Team", "support", "aggression"],
      ["58030", "Caught in the Crossfire", "upgrade", "aggression"],
      ["01050", "Hulk", "ally", "aggression"],
      ["01073", "The Triskelion", "support", "leadership"],
      ["01082", "Indomitable", "upgrade", "protection"],
    ])(
      "an off-aspect %3$s that prints an energy icon (%s %s) is refused: the allowance is for events only",
      (id, _n, type, aspect) => {
        expect(dataOf(id).type).toBe(type);
        expect(messageOf(adding(wm, id), "aspect_restriction")).toBe(refusal(aspect, id));
      },
    );

    it("a printed wild icon is wild only: an off-aspect event that prints only a wild resource is refused", () => {
      // 53019 Strength in Diversity is an Aggression-pool event printing a single wild icon (RRG 1.8 'Printed', p. 35).
      const card = dataOf("53019") as { aspect: string; type: string; name: string };
      expect(card.type).toBe("event");
      expect(card.aspect).not.toBe("justice");
      expect(messageOf(adding(wm, "53019"), "aspect_restriction")).toBe(refusal(card.aspect, "53019"));
    });

    it("control: Hercules' Leadership deck gets no allowance: the same Relentless Assault is refused with no rule hint", () => {
      expect(messageOf(adding(deckOf("hercules-leadership"), "01053"), "aspect_restriction")).toBe(
        "Relentless Assault is a Aggression card, but this deck's aspect is Leadership; beyond its identity set a deck may only use its chosen aspect and basic cards.",
      );
    });

    it("control: Tigra's Aggression deck gets no allowance for a Protection energy event (Stronger Together 58019)", () => {
      expect(messageOf(adding(deckOf("tigra-aggression"), "58019"), "aspect_restriction")).toBe(
        "Stronger Together is a Protection card, but this deck's aspect is Aggression; beyond its identity set a deck may only use its chosen aspect and basic cards.",
      );
    });
  });

  describe("Hercules' Labor and Gift cards are separate decks that setup builds (RRG 1.8 'Deck', p. 15)", () => {
    const hercules = deckOf("hercules-leadership");

    it("a Gift card (a player card marked as part of the Gift deck) is refused by name and deck", () => {
      for (const id of ["59005", "59006", "59007"]) {
        const bad = adding(hercules, id);
        expect(codesOf(bad)).toEqual(["separate_deck_card"]);
        expect(messageOf(bad, "separate_deck_card")).toBe(
          `${nameOf(id)} belongs to Hercules (Hercules)'s Gift deck, which setup builds from the identity; it is not part of a player deck, so it cannot be listed.`,
        );
      }
    });

    it("a Labor card is an encounter card, so it is refused as 'not a player card'", () => {
      for (const id of ["59002", "59003", "59004"]) {
        const bad = adding(hercules, id);
        expect(codesOf(bad)).toEqual(["not_a_player_card"]);
        expect(messageOf(bad, "not_a_player_card")).toContain(`${nameOf(id)} is `);
        expect(messageOf(bad, "not_a_player_card")).toContain(
          "encounter cards (including obligations and nemesis cards, which setup adds for you) cannot be in a player deck.",
        );
      }
    });

    // The article follows the type's first sound: "an attachment card", "a minion card".
    it("a Labor card that is an attachment is refused in grammatical English ('an attachment card')", () => {
      expect(messageOf(adding(hercules, "59002"), "not_a_player_card")).toContain(
        `${nameOf("59002")} is an attachment card, not a player card`,
      );
    });

    it("the 40 is complete without them: removing nothing, the printed precon needs no Gift or Labor card", () => {
      expect(validateDeck(hercules, PLAYABLE_CARDS)).toEqual({ ok: true });
      expect(hercules.cards.reduce((n, l) => n + l.quantity, 0)).toBe(40);
    });
  });

  describe("a hero's kit is identity-specific (RRG 1.8 'Identity-Specific Card', p. 23)", () => {
    // Each hero's first kit card placed in the next hero's deck (the last into the first's).
    const pairs = HEROES.map((owner, i) => ({ owner, host: HEROES[(i + 1) % HEROES.length]! }));
    it.each(pairs)("$host.name's deck with $owner.name's kit card is refused, naming the owner", ({ owner, host }) => {
      const card = EXPECTED_SET[owner.identity]![0]![0];
      const bad = adding(deckOf(host.deck), card);
      expect(codesOf(bad)).toContain("other_identity_card");
      expect(messageOf(bad, "other_identity_card")).toBe(
        `${nameOf(card)} belongs to ${owner.who}'s identity set; identity-specific cards can only be used in that identity's deck.`,
      );
    });

    it("a Core hero's deck with Wonder Man's Ionic Physiology is refused as well", () => {
      const bad = adding(deckOf("core-spider-man-justice"), "58002");
      expect(codesOf(bad)).toContain("other_identity_card");
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

  describe("Wonder Man's Permanent Ionic Physiology 58002 (RRG 1.8 'Permanent', p. 32)", () => {
    const wm = deckOf("wonder-man-justice");

    it("is listed in the precon but not counted: the 41 entries (40 counted) are legal", () => {
      expect(wm.cards.find((l) => l.cardId === "58002")?.quantity).toBe(1);
      expect(wm.cards.reduce((n, l) => n + l.quantity, 0)).toBe(41);
      expect(validateDeck(wm, PLAYABLE_CARDS)).toEqual({ ok: true });
    });

    it("a deck without it is refused as a missing identity-set card", () => {
      expect(messageOf(withQuantity(wm, "58002", 0), "identity_set_mismatch")).toBe(
        `${nameOf("58002")} is missing: a deck for Wonder Man (Simon Williams) must include every card in that identity's set, and this one needs 1 copy.`,
      );
    });

    it("a second copy is refused: the set has exactly one", () => {
      expect(messageOf(withQuantity(wm, "58002", 2), "identity_set_mismatch")).toContain(
        "has 2 copies, but Wonder Man (Simon Williams)'s identity set has exactly 1 copy, and a deck must include exactly that many.",
      );
    });
  });

  describe("an aspect card of another aspect is refused (RRG 1.8 Appendix I: one aspect plus basic)", () => {
    // [deck, off-aspect wave 10 card, its aspect, the deck's aspect]
    it.each([
      ["tigra-aggression", "56041", "protection", "aggression"],
      ["hulkling-protection", "56010", "aggression", "protection"],
      ["hercules-leadership", "58012", "justice", "leadership"],
      ["tigra-aggression", "59018", "leadership", "aggression"],
      ["hulkling-protection", "58016", "justice", "protection"],
    ])("%s with %s (%s card) is refused", (deck, card, aspect, chosen) => {
      expect((dataOf(card) as { aspect: string }).aspect).toBe(aspect);
      expect(messageOf(adding(deckOf(deck), card), "aspect_restriction")).toBe(
        `${nameOf(card)} is a ${label(aspect)} card, but this deck's aspect is ${label(chosen)}; beyond its identity set a deck may only use its chosen aspect and basic cards.`,
      );
    });

    it("a wave 10 basic card is legal in every wave 10 deck", () => {
      // The first unique basic card the precon does not already hold (a unique basic card is limited to one copy).
      for (const hero of HEROES) {
        const deck = deckOf(hero.deck);
        const fresh = ["56052", "56019", "58022", "58024", "59025", "59034"].find(
          (id) => !deck.cards.some((l) => l.cardId === id),
        );
        expect(fresh, `${hero.name}: a basic card to add`).toBeDefined();
        expect(dataOf(fresh!).type !== "resource" && (dataOf(fresh!) as { aspect?: string }).aspect).toBe("basic");
        // Two cards come out so the deck stays within 40 to 50 whatever the precon holds.
        expect(validateDeck(adding(deck, fresh!), PLAYABLE_CARDS), `${hero.name} + ${fresh}`).toEqual({ ok: true });
      }
    });
  });

  describe("Team-Up (RRG 1.8 'Team-Up', p. 43): 59026 Ancient Rivalry names Hercules and Thor", () => {
    it("legal in Hercules' deck (the precon holds it), refused for a Core hero, naming the two characters", () => {
      expect(deckOf("hercules-leadership").cards.find((l) => l.cardId === "59026")?.quantity).toBe(1);
      expect(validateDeck(deckOf("hercules-leadership"), PLAYABLE_CARDS)).toEqual({ ok: true });
      const bad = withQuantity(deckOf("core-she-hulk-aggression"), "59026", 1);
      expect(codesOf(bad)).toEqual(["team_up_identity"]);
      expect(messageOf(bad, "team_up_identity")).toBe(
        "Ancient Rivalry is a Team-Up card for Hercules and Thor; only a deck whose identity is one of them may include it.",
      );
    });
  });

  describe("copy limits and the unique rule on the new aspect and basic cards", () => {
    const playerCards = Object.entries(CARD_GROUPS)
      .filter(([k]) =>
        /^(cw\/aspect-basic\/|wonder_man\/(justice|other-aspects|basic)$|hercules\/(leadership|basic)$)/.test(k),
      )
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
      expect(playerCards.length).toBeGreaterThan(15);
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
        const message = messageOf(adding(deckOf(deck), id, 2), "unique_match");
        expect(message).toBeDefined();
        // Where no other card in the Core deck matches, the message is the plain one.
        if (!["56019", "58012", "58013", "58014", "58015", "59018", "59020", "56041", "56010"].includes(id)) {
          expect(message).toContain(`${name} is unique`);
        }
      },
    );

    it("Yellowjacket (Hank Pym) 56019 and Ant-Man (Hank Pym) 12011 match: one deck cannot hold both (RRG 1.8 'Unique Icon', pp. 45-46)", () => {
      // The second bullet: "The subtitle ... of one matches the ... subtitle ... of the other". Two public decklists
      // (59625 Hercules, 63132 Wonder Man) hold both, so they are refused here.
      const base = deckOf("core-captain-marvel-leadership");
      expect(messageOf(adding(adding(base, "56019"), "12011"), "unique_match")).toBe(
        "Yellowjacket (Hank Pym) and Ant-Man (Hank Pym) match; a deck cannot include multiple matching unique cards.",
      );
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// 1. Cards in another hero's deck
// ---------------------------------------------------------------------------------------------------------------------

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
  /** A second player seated beside the first. */
  readonly partner?: () => PlayerSetup;
  /** Cards (by code) conjured into hand and spent as the whole payment. */
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
  const created = createGame(config, WAVE10_DEPS);
  if (!created.ok) throw new Error(`${code} in ${heroId}: ${created.error.code}: ${created.error.message}`);
  const opened = settle(created.state, firstLegal, (st) => st.step.phase === "player", WAVE10_DEPS);
  const form = spec.alterEgo ? opened : withForm(opened, { heroForm: 0 }, P1);
  return spec.stage ? spec.stage(form) : form;
}

/** The play the engine offers for `id` (`legalActions`' example command), or null when it is not offered. */
function exampleFor(state: GameState, id: InstanceId): Command | null {
  const actions = legalActions(state, P1, WAVE10_DEPS);
  if (actions.kind !== "turn") return null;
  return actions.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === id)?.example ?? null;
}

/** Drives `commands` through a session, answering prompts with `pick`; the log must replay to the identical state. */
function drive(start: GameState, pick: Picker, ...commands: readonly Command[]): GameState {
  let session = startSession(start);
  const apply = (command: Command): void => {
    const result = sessionApply(session, command, WAVE10_DEPS);
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
  const replayed = replay(session.log, WAVE10_DEPS);
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
  return !applyCommand(given.state, bare, WAVE10_DEPS).ok;
}

/** Aspect and basic player-card modules of the three packs (the encounter-side modules hold no player card). */
const MODULES = {
  cw: ["cw/aspect-basic/aggression", "cw/aspect-basic/protection", "cw/aspect-basic/basic"],
  wonder_man: ["wonder_man/justice", "wonder_man/other-aspects", "wonder_man/basic"],
  hercules: ["hercules/leadership", "hercules/basic"],
} as const;
/** Scripted cards of a pack's aspect-basic modules: every ability ref is in the wave 10 registry. */
const scriptedOf = (pack: keyof typeof MODULES): string[] =>
  MODULES[pack]
    .flatMap((module) => CARD_GROUPS[module] ?? [])
    .filter((id) => {
      const refs = abilityRefsOf(dataOf(id));
      return refs.length > 0 && refs.every((ref) => WAVE10_DEPS.abilities[ref.id] !== undefined);
    });

const MINION = "01103"; // Core minion Shocker: ATK 2, 3 hit points
const UPGRADE = "01081"; // Core protection upgrade Armored Vest, cost 1
const ALLY = "01066"; // Core leadership ally Hawkeye (AVENGER)

const engaged = (st: GameState): GameState => engageMinion(st, MINION, "m1");
const minionIn = (state: GameState): boolean => state.players.some((p) => p.playArea.includes("m1" as InstanceId));

/**
 * Cards played by a plain `legalActions` example from their default Core hero (no staging) are not in `SPECS`. The
 * others are here with the staging they need, and `CHECKS` asserts the effect where the card's text names a visible one.
 */
const SPECS: Readonly<Record<string, Spec>> = {
  // Attach to a minion.
  "56014": { stage: engaged },
  // Hero Action (attack): defeat a non-Elite minion with an upgrade attached.
  "56016": { stage: (st) => attached(engaged(st), UPGRADE, P1, "m1" as InstanceId).state },
  // Hero Action: heal 2 damage from an enemy, confuse it.
  "58016": { stage: (st) => patchInstance(st, st.activeVillainId!, { damage: 3 }) },
  // Hero Action: exhaust an AERIAL character you control (Firebird) and choose a player.
  "58017": { stage: (st) => inPlayArea(st, "58012").state },
  // Attach to a non-Elite minion.
  "58030": { stage: engaged },
  // Alter-ego form only.
  "59023": { alterEgo: true },
  // Attach to an ally.
  "59024": { stage: (st) => inPlayArea(st, ALLY).state },
  // Team-Up (Hercules and Thor): in Hercules' own deck, with Thor (the ally) in play.
  "59026": { deck: () => seat("hercules-leadership", "59026"), stage: (st) => inPlayArea(st, "59020").state },
};

/** What a played card did, beyond landing where its type goes. */
const CHECKS: Readonly<Record<string, (played: { before: GameState; after: GameState; id: InstanceId }) => void>> = {
  "56014": ({ after, id }) => expect(inst(after, id).attachedTo).toBe("m1"),
  "56016": ({ after }) => expect(minionIn(after)).toBe(false),
  "58016": ({ before, after }) => {
    const villain = before.activeVillainId!;
    expect(inst(after, villain).damage).toBe(1);
    expect(inst(after, villain).statuses.confused).toBeGreaterThan(0);
  },
  "58017": ({ before, after }) => {
    const villain = before.activeVillainId!;
    expect(inst(after, villain).damage - inst(before, villain).damage).toBe(3);
  },
  "58030": ({ after, id }) => expect(inst(after, id).attachedTo).toBe("m1"),
  "59024": ({ after, id }) => expect(inst(after, inst(after, id).attachedTo!).cardId).toBe(ALLY),
};

/** Cards a Core hero cannot play by their own printed text, and the spec that makes them playable. */
const SCHEME_THREAT: Spec["stage"] = (st) => patchInstance(st, st.mainScheme.instanceId, { threat: 3 });
const GATED: Readonly<Record<string, { readonly why: string; readonly plain: Spec; readonly playable: Spec }>> = {
  // The main scheme needs threat on it, or the thwart event has no target whoever plays it.
  "58018": {
    why: "Play only if your identity has the Aerial trait.",
    plain: { stage: SCHEME_THREAT },
    playable: { traits: ["AERIAL"], stage: SCHEME_THREAT },
  },
  "59027": {
    why: "Play only if your identity has at least 14 printed hit points.",
    plain: {},
    playable: { hero: "core-she-hulk-aggression" },
  },
};
/** Resource cards with text: spent to pay for another card, tested below. */
const RESOURCES_WITH_TEXT: string[] = ["56018", "56051"];
/** Reactive cards, played from the window they answer below. */
const REACTIVE: string[] = ["56017", "56047", "56050", "58019", "58020", "58033", "59021"];
/** A Setup card is resolved during setup and never reaches the hand (tested below). */
const SETUP: string[] = ["58031"];

describe("wave 10 aspect and basic cards, from a Core hero's deck", () => {
  for (const pack of Object.keys(MODULES) as (keyof typeof MODULES)[]) {
    const scripted = scriptedOf(pack);
    const special = new Set([...Object.keys(GATED), ...RESOURCES_WITH_TEXT, ...REACTIVE, ...SETUP]);
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
        CHECKS[id]?.(played!);
      });
    });
  }

  it("every card of the three packs' aspect and basic modules is either played above, special-cased here, or has no ability", () => {
    const all = (Object.keys(MODULES) as (keyof typeof MODULES)[]).flatMap((pack) =>
      MODULES[pack].flatMap((module) => CARD_GROUPS[module] ?? []),
    );
    const scripted = new Set((Object.keys(MODULES) as (keyof typeof MODULES)[]).flatMap(scriptedOf));
    const unscripted = all.filter((id) => !scripted.has(id));
    // Only the plain resources (no ability at all) are outside the loop.
    for (const id of unscripted) {
      expect(dataOf(id).type, id).toBe("resource");
      expect(abilityRefsOf(dataOf(id)), id).toEqual([]);
    }
    expect(unscripted.sort()).toEqual(["56020", "56021", "56022", "58023", "59029", "59030", "59031"]);
  });

  describe("cards a Core hero cannot play by their printed text", () => {
    it.each(Object.entries(GATED))("%s is refused for the plain Core hero and played once it can: %s", (id, gate) => {
      expect(refusedPlay(id, gate.plain)).toBe(true);
      const played = cast(id, gate.playable);
      expect(played, `${id} still not offered`).not.toBeNull();
      expect(whereIs(played!.after, played!.id)).not.toBe("hand");
    });

    it('56019 Yellowjacket, 58034 / 59032 Avengers Compound, 59024 "Avenge Me!" and 59034 Quincarrier (Avenger trait): every Core hero has it', () => {
      for (const hero of Object.keys(CORE_IDENTITY)) {
        const traits = (dataOf(CORE_IDENTITY[hero]!) as HeroIdentityCard).hero.traits as readonly string[];
        expect(traits, hero).toContain("AVENGER");
      }
    });

    it("but an alter-ego without the trait cannot: Avengers Compound 58034 is refused from alter-ego form", () => {
      // Spider-Man's alter ego Peter Parker has only GENIUS.
      expect(refusedPlay("58034", { alterEgo: true })).toBe(true);
      const played = cast("58034");
      expect(played).not.toBeNull();
    });
  });

  describe("resource cards with text (spent to pay for another card)", () => {
    const wildPlay = (code: string, hero: string, stage: (st: GameState) => GameState = (st) => st) => {
      const opened = stage(openGame(code, { hero }));
      const resource = moveToHand(opened, P1, code);
      const target = conjure(resource.state, P1, "01063"); // Core Interrogation Room, cost 1
      const after = drive(target.state, accepting([code]), {
        type: "playCard",
        playerId: P1,
        cardInstanceId: target.id,
        payment: [{ fromHand: resource.ids[0]! }],
        attachToInstanceId: null,
      } as Command);
      return { before: target.state, after, target: target.id, resource: resource.ids[0]! };
    };

    it("56018 Audacity pays for a card; after it is spent it deals 1 damage to the villain", () => {
      const run = wildPlay("56018", "core-she-hulk-aggression");
      expect(whereIs(run.after, run.target)).toBe("play");
      expect(playerOf(run.after, P1).discard).toContain(run.resource);
      const villain = villainOf(run.before);
      expect(inst(run.after, villain).damage - inst(run.before, villain).damage).toBe(1);
    });

    it("56051 Preservation pays for a card; after it is spent it heals 1 damage from the hero", () => {
      const run = wildPlay("56051", "core-black-panther-protection", (st) =>
        patchInstance(st, seatIdentity(st), { damage: 2 }),
      );
      expect(whereIs(run.after, run.target)).toBe("play");
      expect(playerOf(run.after, P1).discard).toContain(run.resource);
      expect(inst(run.after, seatIdentity(run.after)).damage).toBe(1);
    });
  });

  describe("58031 Cameo (Setup): resolved at setup, never in hand", () => {
    const seatCameo = () =>
      createGame(
        coreScenario("rhino", {
          players: [buildCrossHeroDeck(PLAYABLE_CARDS, "core-captain-marvel-leadership", "58031")],
          seed: 11,
          difficulty: "standard",
          modularSetIds: [],
          cardPool: PLAYABLE_CARDS,
        } as never),
        WAVE10_DEPS,
      );

    it("offers a search of the collection for an identity-specific ally, shuffles the pick in, discards 2 and removes itself", () => {
      const created = seatCameo();
      if (!created.ok) throw new Error(created.error.message);
      let state = created.state;
      let offered: string[] = [];
      for (let guard = 0; guard < 30 && state.pendingChoice; guard++) {
        const choice = state.pendingChoice;
        if (choice.prompt.kind === "searchCollection") {
          offered = choice.options.map((o) => o.optionId);
          // Agent 13 (03002), Sharon Carter's identity-specific ally, is not in this game.
          expect(offered).toContain("03002");
          state = answer(state, ["03002"], WAVE10_DEPS);
        } else state = answer(state, firstLegal(state), WAVE10_DEPS);
      }
      const owner = playerOf(state, P1);
      const codes = (ids: readonly InstanceId[]) => ids.map((i) => inst(state, i).cardId as string);
      // The pick is shuffled into the deck, 2 cards were discarded from the hand, and Cameo is in none of the zones.
      expect(codes([...owner.deck, ...owner.hand])).toContain("03002");
      expect(owner.discard).toHaveLength(2);
      expect(codes([...owner.deck, ...owner.hand, ...owner.discard, ...owner.playArea])).not.toContain("58031");
      // Every offered ally is identity-specific; the identity in this game (Captain Marvel) has none of her own offered.
      for (const code of offered) expect((dataOf(code) as { type: string }).type, code).toBe("ally");
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Reactive cards, played from the window they answer; staged plays with an effect check
// ---------------------------------------------------------------------------------------------------------------------

/** `accepting` plus: when discarding down to hand size, never discard the card under test. */
const keeping =
  (card: InstanceId, wanted: readonly string[], opts: { defender?: InstanceId } = {}): Picker =>
  (st) => {
    const choice = st.pendingChoice;
    if (choice?.prompt.kind === "discardDownToHandSize") {
      return choice.options
        .filter((o) => o.optionId !== card)
        .slice(0, choice.minSelections)
        .map((o) => o.optionId);
    }
    return accepting(wanted, opts)(st);
  };

const villainOf = (state: GameState): InstanceId => state.activeVillainId!;

/**
 * The villain attacks the player at the end of the hero's turn (a blank boost card is stacked); `code` is in hand and
 * `wanted` is accepted whenever its trigger is offered. `defender` names who defends (default: the hero).
 */
function underAttack(
  code: string,
  spec: Spec,
  wanted: boolean,
  defender: (state: GameState) => InstanceId = seatIdentity,
): { before: GameState; after: GameState; id: InstanceId; villain: InstanceId } {
  const given = moveToHand(openGame(code, spec), P1, code);
  const id = given.ids[0]!;
  const staged = stackEncounterDeck(given.state, "01186");
  const defend = defender(staged);
  const after = settle(
    runWith(WAVE10_DEPS, staged, endTurn(P1)),
    keeping(id, wanted ? [code] : [], { defender: defend }),
    undefined,
    WAVE10_DEPS,
  );
  return { before: staged, after, id, villain: villainOf(staged) };
}

/** A basic attack by `attacker` on the villain with `code` in hand; `wanted` decides whether its trigger is accepted. */
function attackWith(
  code: string,
  spec: Spec,
  wanted: boolean,
  attacker: (state: GameState) => InstanceId = seatIdentity,
): { before: GameState; after: GameState; id: InstanceId; villain: InstanceId } {
  const given = moveToHand(openGame(code, spec), P1, code);
  const id = given.ids[0]!;
  const villain = villainOf(given.state);
  const command = {
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: attacker(given.state),
    targetInstanceId: villain,
  } as Command;
  const after = drive(given.state, keeping(id, wanted ? [code] : []), command);
  return { before: given.state, after, id, villain };
}

const allyOf =
  (code: string) =>
  (state: GameState): InstanceId =>
    state.players.flatMap((p) => p.playArea).find((i) => inst(state, i).cardId === code)!;

describe("reactive cards, played from the window they answer", () => {
  describe("defense windows (the villain attacks at the end of the hero's turn)", () => {
    it("56050 Cuts Both Ways: the hero gains retaliate 1, so the attacker takes 1 damage after the defended attack", () => {
      const control = underAttack("56050", {}, false);
      const played = underAttack("56050", {}, true);
      expect(whereIs(played.after, played.id)).toBe("discard");
      expect(whereIs(control.after, control.id)).toBe("hand");
      expect(inst(played.after, played.villain).damage - inst(control.after, control.villain).damage).toBe(1);
    });

    it('56047 "I Can Do This All Day": declares the hero as the defender without exhausting them', () => {
      const played = underAttack("56047", {}, true);
      expect(whereIs(played.after, played.id)).toBe("discard");
      expect(inst(played.after, seatIdentity(played.after)).exhausted).toBe(false);
      const control = underAttack("56047", {}, false);
      expect(inst(control.after, seatIdentity(control.after)).exhausted).toBe(true);
    });

    it("58033 Disarming Defense: played as the hero defends, it is discarded and the hero takes no damage", () => {
      const played = underAttack("58033", { hero: "core-black-panther-protection" }, true);
      expect(whereIs(played.after, played.id)).toBe("discard");
      expect(inst(played.after, seatIdentity(played.after)).damage).toBe(0);
    });

    it("58019 Stronger Together: an ally sharing the hero's trait defends and takes the damage reduced by the hero's DEF", () => {
      const spec: Spec = { stage: (st) => inPlayArea(st, "01066").state };
      const control = underAttack("58019", spec, false, allyOf("01066"));
      const played = underAttack("58019", spec, true, allyOf("01066"));
      expect(whereIs(played.after, played.id)).toBe("discard");
      const ally = allyOf("01066")(played.after);
      expect(inst(played.after, ally).damage).toBe(0);
      // Control: without the card the ally takes Rhino's attack.
      const controlAlly = allyOf("01066")(control.after);
      expect(inst(control.after, controlAlly).damage > 0 || whereIs(control.after, controlAlly) === "discard").toBe(
        true,
      );
    });
  });

  describe("attack windows", () => {
    it("56017 Savage Strike: the hero's basic attack gets +6 ATK", () => {
      const control = attackWith("56017", {}, false);
      const played = attackWith("56017", {}, true);
      expect(whereIs(played.after, played.id)).toBe("discard");
      expect(inst(played.after, played.villain).damage - inst(control.after, control.villain).damage).toBe(6);
    });

    it("59021 Teamwork: exhausting an ally adds that ally's ATK to the hero's basic attack", () => {
      const spec: Spec = { stage: (st) => inPlayArea(st, "01066").state };
      const control = attackWith("59021", spec, false);
      const played = attackWith("59021", spec, true);
      expect(whereIs(played.after, played.id)).toBe("discard");
      const atk = (dataOf("01066") as { atk?: number }).atk ?? 1;
      expect(inst(played.after, played.villain).damage - inst(control.after, control.villain).damage).toBe(atk);
      expect(inst(played.after, allyOf("01066")(played.after)).exhausted).toBe(true);
    });

    it("58020 Unified Strike: when an ally uses a basic power, exhausting the hero adds the hero's matching power", () => {
      const spec: Spec = { stage: (st) => inPlayArea(st, "01066").state };
      const control = attackWith("58020", spec, false, allyOf("01066"));
      const played = attackWith("58020", spec, true, allyOf("01066"));
      expect(whereIs(played.after, played.id)).toBe("discard");
      expect(inst(played.after, played.villain).damage).toBeGreaterThan(inst(control.after, control.villain).damage);
      expect(inst(played.after, seatIdentity(played.after)).exhausted).toBe(true);
    });
  });
});
