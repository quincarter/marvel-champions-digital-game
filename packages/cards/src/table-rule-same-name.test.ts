/**
 * The table option "A hero and an ally with the same name can't both be in play" (`TableRules.sameNameHeroAllyConflict`,
 * owner decision 2026-10-03), against FFG's rule, which stays the default.
 *
 * - RRG 1.8 "Unique Icon" (pp. 45-46): two unique cards match if they "share a title, and both have no subtitle and no
 *   alter-ego title", or if "the subtitle or alter-ego title of one matches the title, subtitle, or alter-ego title of
 *   the other". A matching player card "cannot be played or put into play".
 * - Ruling January 26, 2026 (4) #7: "Does Valkyrie (hero) match Valkyrie (ally) under uniqueness?" "No, they do not
 *   match. Valkyrie hero has an alter-ego title that does not match the title of the Valkyrie ally."
 * - Ruling March 19, 2026 (4): the Valkyrie Aggression ally (no subtitle) may be included in a Valkyrie hero deck.
 *
 * So by FFG the Valkyrie ally (06012, no subtitle) may be played beside the Valkyrie hero (alter-ego Brunnhilde), and
 * so may the Ironheart ally (13018). The basic Colossus ally (32048, reprint 35021) is NOT like them: it prints the
 * subtitle "Piotr Rasputin" (scan assets/card-art/bundles/cards/32048.png), the Colossus hero's alter-ego, so the RRG's
 * second bullet already matches the two and the ally is refused beside the Colossus hero with the option off.
 * With the option on, a unique ALLY with NO subtitle also matches an identity whose hero title is its title. Nothing
 * else changes: an ally with a subtitle is left to the RRG's rule, so are two identities, and so is every card that is
 * not an ally. Deck building is not changed.
 *
 * The matrix runs over every card in `@mc/content`, playable or data-only, against an oracle written here from the
 * rule text, independent of the engine's `cardsMatch`.
 */
import {
  type AnyCard,
  cardId,
  CORE_STARTER_DECKS,
  DATA_ONLY_CARDS,
  PLAYABLE_CARDS,
  type StarterDeck,
  WAVE1_STARTER_DECKS,
  WAVE2_STARTER_DECKS,
  WAVE3_STARTER_DECKS,
  WAVE4_STARTER_DECKS,
  WAVE5_STARTER_DECKS,
  WAVE6_STARTER_DECKS,
  WAVE7_STARTER_DECKS,
} from "@mc/content";
import {
  applyCommand,
  cardsMatch,
  createGame,
  type GameState,
  type InstanceId,
  legalActions,
  playCostOf,
  replay,
  sessionApply,
  startSession,
  type TableRules,
  validateDeck,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "./playable/index.js";
import { endTurn, firstLegal, moveToHand, P1, P2, payWith, play, playerOf, settle } from "./testing/harness.js";
import { withForm } from "./testing/staging.js";

const ON: TableRules = { sameNameHeroAllyConflict: true };

/** Every card in the content package, one per id. */
const POOL: readonly AnyCard[] = [
  ...new Map([...PLAYABLE_CARDS, ...DATA_ONLY_CARDS].map((card) => [card.id as string, card])).values(),
];
type Identity = Extract<AnyCard, { type: "hero_identity" }>;
const IDENTITIES = POOL.filter((card): card is Identity => card.type === "hero_identity");
const UNIQUES = POOL.filter((card) => card.type !== "hero_identity" && card.unique);

// ---------------------------------------------------------------------------------------------------------------
// The oracle: RRG 1.8 "Unique Icon", and the option's one added clause, written from the text.
// ---------------------------------------------------------------------------------------------------------------
interface Names {
  readonly title: string;
  readonly subtitle: string | null;
  readonly alterEgo: string | null;
}
const namesOf = (card: AnyCard): Names => ({
  title: card.name,
  subtitle: card.subtitle ?? null,
  alterEgo: card.type === "hero_identity" ? card.alterEgo.faceName : null,
});
/** RRG 1.8: both bare with one title, or a subtitle / alter-ego title of one among the three names of the other. */
function rrgMatch(a: AnyCard, b: AnyCard): boolean {
  const x = namesOf(a);
  const y = namesOf(b);
  const bare = (n: Names) => n.subtitle === null && n.alterEgo === null;
  if (x.title === y.title && bare(x) && bare(y)) return true;
  const all = (n: Names) => [n.title, n.subtitle, n.alterEgo];
  const second = (n: Names) => [n.subtitle, n.alterEgo].filter((name): name is string => name !== null);
  return second(x).some((name) => all(y).includes(name)) || second(y).some((name) => all(x).includes(name));
}
/** The option: the RRG, plus "same title, one is an identity, the other is an ally with no subtitle". */
function optionMatch(a: AnyCard, b: AnyCard): boolean {
  if (rrgMatch(a, b)) return true;
  const sameName = (identity: AnyCard, other: AnyCard) =>
    identity.type === "hero_identity" &&
    other.type === "ally" &&
    (other.subtitle ?? null) === null &&
    identity.name === other.name;
  return sameName(a, b) || sameName(b, a);
}
const label = (card: AnyCard): string => {
  const names = namesOf(card);
  const second = names.subtitle ?? names.alterEgo;
  return `${names.title}${second ? ` (${second})` : ""} [${card.type === "hero_identity" ? "hero" : card.type} ${card.id}]`;
};

/** The card with this id. */
const card = (code: string): AnyCard => {
  const found = POOL.find((candidate) => candidate.id === cardId(code));
  if (!found) throw new Error(`no card ${code}`);
  return found;
};
/** Whether the two match with the option off and with it on, checked in both argument orders. */
function matches(a: string, b: string): { readonly off: boolean; readonly on: boolean } {
  const off = cardsMatch(card(a), card(b));
  const on = cardsMatch(card(a), card(b), ON);
  expect(cardsMatch(card(b), card(a))).toBe(off);
  expect(cardsMatch(card(b), card(a), ON)).toBe(on);
  return { off, on };
}
const NEVER = { off: false, on: false };
const ALWAYS = { off: true, on: true };
const ONLY_WITH_THE_OPTION = { off: false, on: true };

describe("matrix over the whole card pool: every identity against every unique card (RRG 1.8 'Unique Icon', pp. 45-46; owner decision 2026-10-03)", () => {
  it("the pool is the whole content package", () => {
    expect(IDENTITIES.length).toBeGreaterThanOrEqual(58);
    expect(UNIQUES.length).toBeGreaterThan(300);
  });

  it("option off: `cardsMatch` is the RRG's predicate for every identity x unique card, in both orders", () => {
    for (const identity of IDENTITIES) {
      for (const other of UNIQUES) {
        const expected = rrgMatch(identity, other);
        if (cardsMatch(identity, other) !== expected || cardsMatch(other, identity) !== expected) {
          throw new Error(`${label(identity)} x ${label(other)}: expected ${expected}`);
        }
      }
    }
  });

  it("option on: the RRG's predicate plus 'same title, one an identity, the other an ally with no subtitle', in both orders", () => {
    for (const identity of IDENTITIES) {
      for (const other of UNIQUES) {
        const expected = optionMatch(identity, other);
        if (cardsMatch(identity, other, ON) !== expected || cardsMatch(other, identity, ON) !== expected) {
          throw new Error(`${label(identity)} x ${label(other)}: expected ${expected}`);
        }
      }
    }
  });

  it("no pair goes from match to no-match when the option turns on", () => {
    const lost = IDENTITIES.flatMap((identity) =>
      UNIQUES.filter((other) => cardsMatch(identity, other) && !cardsMatch(identity, other, ON)).map(
        (other) => `${label(identity)} x ${label(other)}`,
      ),
    );
    expect(lost).toEqual([]);
  });

  it("every pair the option turns from no-match into match, for a reviewer to read", () => {
    const flipped = IDENTITIES.flatMap((identity) =>
      UNIQUES.filter((other) => !cardsMatch(identity, other) && cardsMatch(identity, other, ON)).map(
        (other) => `${label(identity)} x ${label(other)}`,
      ),
    ).sort();
    expect(flipped).toMatchInlineSnapshot(`
      [
        "Ironheart (Riri Williams) [hero 29001a] x Ironheart [ally 13018]",
        "Ironheart (Riri Williams) [hero 29002a] x Ironheart [ally 13018]",
        "Ironheart (Riri Williams) [hero 29003a] x Ironheart [ally 13018]",
        "Valkyrie (Brunnhilde) [hero 25001a] x Valkyrie [ally 06012]",
      ]
    `);
  });

  it("unique cards that are not allies, have no subtitle and carry a hero's title: the option leaves each to the RRG alone", () => {
    const untouched = IDENTITIES.flatMap((identity) =>
      UNIQUES.filter(
        (other) => other.type !== "ally" && (other.subtitle ?? null) === null && other.name === identity.name,
      ).map((other) => {
        expect(cardsMatch(identity, other, ON)).toBe(cardsMatch(identity, other));
        return `${label(identity)} x ${label(other)}: ${cardsMatch(identity, other) ? "match (RRG)" : "no match"}`;
      }),
    ).sort();
    expect(untouched).toMatchInlineSnapshot(`
      [
        "Captain America (Steve Rogers) [hero 03001a] x Captain America [upgrade 53023]: no match",
        "Gamora (Gamora) [hero 18001a] x Gamora [minion 22028]: match (RRG)",
        "Magneto (Erik Lehnsherr) [hero 49001a] x Magneto [villain 32138]: no match",
        "Nebula (Nebula) [hero 22001a] x Nebula [minion 18026]: match (RRG)",
        "Nebula (Nebula) [hero 22001a] x Nebula [villain 16088]: match (RRG)",
        "Venom (Flash Thompson) [hero 20001a] x Venom [villain 27073]: no match",
      ]
    `);
  });

  it("unique x unique (no identity involved): the option changes nothing", () => {
    for (const a of UNIQUES) {
      for (const b of UNIQUES) {
        if (cardsMatch(a, b, ON) !== cardsMatch(a, b)) throw new Error(`${label(a)} x ${label(b)} changed`);
      }
    }
  });

  it("identity x identity (two seats): the pairs that cannot be seated together, the same with the option on", () => {
    const clashing: string[] = [];
    IDENTITIES.forEach((a, i) => {
      for (const b of IDENTITIES.slice(i + 1)) {
        expect(cardsMatch(a, b)).toBe(rrgMatch(a, b));
        expect(cardsMatch(a, b, ON)).toBe(cardsMatch(a, b));
        if (cardsMatch(a, b)) clashing.push(`${label(a)} x ${label(b)}`);
      }
    });
    expect(clashing.sort()).toMatchInlineSnapshot(`
      [
        "Ironheart (Riri Williams) [hero 29001a] x Ironheart (Riri Williams) [hero 29002a]",
        "Ironheart (Riri Williams) [hero 29001a] x Ironheart (Riri Williams) [hero 29003a]",
        "Ironheart (Riri Williams) [hero 29002a] x Ironheart (Riri Williams) [hero 29003a]",
      ]
    `);
  });
});

describe("named cases, real cards (RRG 1.8 'Unique Icon', pp. 45-46)", () => {
  const PETER = "01001a"; // Spider-Man / Peter Parker
  const MILES = "27030a"; // Spider-Man / Miles Morales

  it("Spider-Man (Peter Parker) hero and the Spider-Man ally subtitled 'Miles Morales' are different people: no match, on or off", () => {
    expect(matches(PETER, "13019")).toEqual(NEVER);
    expect(matches(PETER, "27011")).toEqual(NEVER);
  });
  it("Spider-Man (Miles Morales) hero and the Spider-Man ally subtitled 'Peter Parker': no match, on or off", () => {
    for (const ally of ["04045", "27049", "52022"]) expect(matches(MILES, ally)).toEqual(NEVER);
  });
  it("each Spider-Man hero matches the ally that names his own alter-ego, by the RRG", () => {
    for (const ally of ["04045", "27049", "52022"]) expect(matches(PETER, ally)).toEqual(ALWAYS);
    for (const ally of ["13019", "27011"]) expect(matches(MILES, ally)).toEqual(ALWAYS);
  });
  it("neither Spider-Man hero matches the other Spider-Man allies (Hobie Brown, Pavitr Prabhakar, Otto Octavius)", () => {
    for (const hero of [PETER, MILES]) {
      for (const ally of ["27017", "30013", "31022"]) expect(matches(hero, ally)).toEqual(NEVER);
    }
  });
  it("the two Spider-Man heroes (Peter Parker, Miles Morales) do not match: they may be seated together, on or off", () => {
    // Bullet 1 needs "no alter-ego title" on both; bullet 2 compares only subtitles and alter-ego titles, which differ.
    expect(matches(PETER, MILES)).toEqual(NEVER);
  });
  it("Ghost-Spider, Spider-Woman, SP//dr and Spider-Ham against the allies that name them: matched by the alter-ego, by the RRG", () => {
    expect(matches("27001a", "27048")).toEqual(ALWAYS); // Ghost-Spider (Gwen Stacy)
    for (const ally of ["01011", "27041", "52033"]) expect(matches("04031a", ally)).toEqual(ALWAYS); // Jessica Drew
    expect(matches("31001a", "30021")).toEqual(ALWAYS); // SP//dr Suit (Peni Parker) and the SP//dr ally (Peni Parker)
    expect(matches("30001a", "31021")).toEqual(ALWAYS); // Spider-Ham (Peter Porker)
    // Silk (Cindy Moon) and her ally.
    expect(matches("52001a", "27010")).toEqual(ALWAYS);
  });

  const TCHALLA = "01040a"; // Black Panther / T'Challa
  const SHURI = "51001a"; // Black Panther / Shuri
  it("Black Panther (T'Challa) and Black Panther (Shuri) heroes do not match each other, on or off", () => {
    expect(matches(TCHALLA, SHURI)).toEqual(NEVER);
  });
  it("T'Challa hero matches the Black Panther ally subtitled 'T'Challa' and the 'T'Challa' ally; Shuri hero matches neither, on or off", () => {
    expect(matches(TCHALLA, "23012")).toEqual(ALWAYS);
    expect(matches(TCHALLA, "51002")).toEqual(ALWAYS);
    // The same title is not enough: the ally HAS a subtitle, so the RRG's rule decides, option or not.
    expect(matches(SHURI, "23012")).toEqual(NEVER);
    expect(matches(SHURI, "51002")).toEqual(NEVER);
  });
  it("Shuri hero matches the 'Shuri' ally; T'Challa hero does not, on or off", () => {
    expect(matches(SHURI, "01041")).toEqual(ALWAYS);
    expect(matches(TCHALLA, "01041")).toEqual(NEVER);
  });

  it("the two allies the option reaches: Valkyrie and Ironheart (no subtitle, the hero's title, not the alter-ego's)", () => {
    expect(matches("25001a", "06012")).toEqual(ONLY_WITH_THE_OPTION); // rulings Jan 26, 2026 (4) #7; Mar 19, 2026 (4)
    for (const ironheart of ["29001a", "29002a", "29003a"]) {
      expect(matches(ironheart, "13018")).toEqual(ONLY_WITH_THE_OPTION);
    }
  });

  it("the Colossus ally (32048, reprint 35021) prints the subtitle 'Piotr Rasputin': it matches the Colossus hero by the RRG alone, on or off", () => {
    for (const colossus of ["32048", "35021"]) expect(matches("32001a", colossus)).toEqual(ALWAYS);
  });

  it("a hero whose alter-ego title is also the ally's title already matches by the RRG: Vision, Groot, Rocket Raccoon, Adam Warlock, Gamora, Drax, Nebula", () => {
    expect(matches("26001a", "01068")).toEqual(ALWAYS);
    expect(matches("16001a", "16047")).toEqual(ALWAYS);
    expect(matches("16029a", "16019")).toEqual(ALWAYS);
    for (const ally of ["17011", "53014"]) expect(matches("21031a", ally)).toEqual(ALWAYS);
    for (const ally of ["19020", "22002"]) expect(matches("18001a", ally)).toEqual(ALWAYS);
    expect(matches("19001a", "18019")).toEqual(ALWAYS);
    expect(matches("22001a", "18002")).toEqual(ALWAYS);
  });

  it("shared titles, different people: the subtitle decides, on or off", () => {
    expect(matches("04001a", "04011")).toEqual(NEVER); // Hawkeye (Clint Barton) hero, Hawkeye (Kate Bishop) ally
    for (const ally of ["01066", "03012", "58013"]) expect(matches("04001a", ally)).toEqual(ALWAYS); // Clint Barton
    expect(matches("12001a", "12011")).toEqual(NEVER); // Ant-Man (Scott Lang) hero, Ant-Man (Hank Pym) ally
    expect(matches("12001a", "13002")).toEqual(ALWAYS);
    expect(matches("13001a", "13012")).toEqual(NEVER); // Wasp (Nadia) hero, Wasp (Janet Van Dyne) ally
    for (const ally of ["12002", "29034"]) expect(matches("13001a", ally)).toEqual(ALWAYS);
    expect(matches("06001a", "13011")).toEqual(NEVER); // Thor (Odinson) hero, Thor (Jane Foster) ally
    expect(matches("06001a", "25013")).toEqual(ALWAYS);
    expect(matches("20001a", "27190")).toEqual(NEVER); // Venom (Flash Thompson) hero, Venom (Eddie Brock) ally
    expect(matches("20001a", "22013")).toEqual(ALWAYS);
    expect(matches("53001a", "29015")).toEqual(NEVER); // Falcon (Sam Wilson) hero, Falcon (Joaquin Torres) ally
    for (const ally of ["03011", "23014"]) expect(matches("53001a", ally)).toEqual(ALWAYS);
  });

  it("heroes and their own subtitled allies match by the RRG: Captain Marvel, Ms. Marvel, Hulk, She-Hulk, Captain America, Iron Man, Nova, Wolverine, Shadowcat", () => {
    for (const ally of ["04032", "23013"]) expect(matches("01010a", ally)).toEqual(ALWAYS);
    expect(matches("05001a", "28002")).toEqual(ALWAYS);
    expect(matches("10001a", "01050")).toEqual(ALWAYS);
    expect(matches("01019a", "10013")).toEqual(ALWAYS);
    for (const ally of ["21011", "54012"]) expect(matches("03001a", ally)).toEqual(ALWAYS);
    for (const ally of ["09039", "23002"]) expect(matches("01029a", ally)).toEqual(ALWAYS);
    expect(matches("28001a", "05012")).toEqual(ALWAYS);
    for (const ally of ["32041", "47002"]) expect(matches("35001a", ally)).toEqual(ALWAYS);
    for (const ally of ["32002", "46019"]) expect(matches("32030a", ally)).toEqual(ALWAYS);
    // Hulk and She-Hulk are different titles and different people.
    expect(matches("10001a", "10013")).toEqual(NEVER);
    expect(matches("01019a", "01050")).toEqual(NEVER);
    // Iron Man and Ironheart likewise.
    expect(matches("01029a", "13018")).toEqual(NEVER);
  });

  it("a unique card that is not an ally and carries a hero's title is not the option's business", () => {
    // The 'Captain America' upgrade (no subtitle) and the Captain America (Steve Rogers) hero.
    expect(matches("03001a", "53023")).toEqual(NEVER);
    // The Venom villain and the Venom (Flash Thompson) hero; the Magneto villain and the Magneto hero.
    expect(matches("20001a", "27073")).toEqual(NEVER);
    expect(matches("49001a", "32138")).toEqual(NEVER);
    // A unique minion titled as a hero's alter-ego is matched by the RRG's own bullet, option or not.
    expect(matches("22001a", "18026")).toEqual(ALWAYS); // Nebula hero (alter-ego Nebula), Nebula minion
    expect(matches("18001a", "22028")).toEqual(ALWAYS); // Gamora hero, Gamora minion
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Real games. Seat 2 is always Shadowcat (Aggression), holding the ally under test; seat 1 varies.
// ---------------------------------------------------------------------------------------------------------------
const DEPS = PLAYABLE_DEPS;
const COLOSSUS_ALLY = "32048";
const VALKYRIE_ALLY = "06012";

/** Rhino, `seatOne`'s deck then Shadowcat (Aggression), at Shadowcat's turn with `allyCode` in her hand. */
function shadowcatsTurn(
  seatOne: string,
  allyCode: string,
  tableRules?: TableRules,
): { readonly state: GameState; readonly ally: InstanceId } {
  const config = playableScenario("rhino", {
    seed: 7,
    players: [{ starterDeckId: seatOne }, { starterDeckId: "shadowcat-aggression" }],
  });
  const created = createGame(tableRules ? { ...config, tableRules } : config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const atP1 = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  const ended = applyCommand(atP1, endTurn(P1), DEPS);
  if (!ended.ok) throw new Error(ended.error.message);
  const atP2 = settle(ended.state, firstLegal, undefined, DEPS);
  if (atP2.step.phase !== "player" || atP2.step.kind !== "turn" || atP2.step.activePlayerId !== P2) {
    throw new Error("not Shadowcat's turn");
  }
  // A card Shadowcat's deck does not hold (the Valkyrie ally) is a relabeled spare, as the tests below do.
  const owner = playerOf(atP2, P2);
  const held = [...owner.deck, ...owner.discard].some((id) => atP2.instances[id]!.cardId === cardId(allyCode));
  const spare = owner.deck[0]!;
  const stocked: GameState = held
    ? atP2
    : { ...atP2, instances: { ...atP2.instances, [spare]: { ...atP2.instances[spare]!, cardId: cardId(allyCode) } } };
  const given = moveToHand(stocked, P2, allyCode);
  return { state: given.state, ally: given.ids[0]! };
}
const playAlly = (state: GameState, ally: InstanceId, cost = 3) =>
  applyCommand(state, play(P2, ally, payWith(state, P2, cost, [ally])), DEPS);

/** Whether the ally's play is offered as legal, and the reason given when it is not. */
function offered(
  state: GameState,
  ally: InstanceId,
): { readonly legal: boolean; readonly message: string | undefined } {
  const legal = legalActions(state, P2, DEPS);
  if (legal.kind !== "turn") throw new Error("expected Shadowcat's turn");
  const mine = (action: { readonly kind: string; readonly instanceId?: InstanceId }) =>
    action.kind === "playCard" && action.instanceId === ally;
  return {
    legal: legal.legal.some((entry) => mine(entry.action)),
    message: legal.illegal.find((entry) => mine(entry.action))?.message,
  };
}

/** Pay for another card in Shadowcat's hand with the ally as a resource. */
function payForAnotherCardWith(state: GameState, ally: InstanceId): void {
  // The cheapest other card in hand that costs at least 1.
  const hand = playerOf(state, P2).hand.filter((id) => id !== ally);
  const target = hand.find((id) => {
    const price = playCostOf(state, P2, id, DEPS);
    return price !== null && price.current === 1 && applyCommand(state, play(P2, id, [ally]), DEPS).ok;
  });
  const fallback = hand.find(
    (id) => applyCommand(state, play(P2, id, [ally, ...hand.filter((h) => h !== id)]), DEPS).ok,
  );
  const paidFor = target ?? fallback;
  expect(paidFor, "a card in Shadowcat's hand the ally can help pay for").toBeDefined();
  const payment = target ? [ally] : [ally, ...hand.filter((h) => h !== paidFor)];
  const paid = applyCommand(state, play(P2, paidFor!, payment), DEPS);
  expect(paid.ok).toBe(true);
  if (paid.ok) expect(playerOf(paid.state, P2).discard).toContain(ally);
}

const withAllyAdded = (deckId: string, allyCode: string) => {
  const deck = ALL_STARTER_DECKS.find((candidate) => candidate.id === deckId);
  if (!deck) throw new Error(`no starter deck ${deckId}`);
  const cards = deck.cards.some((entry) => entry.cardId === cardId(allyCode))
    ? deck.cards
    : [...deck.cards, { cardId: cardId(allyCode), quantity: 1 }];
  return validateDeck({ identityCardId: deck.identityCardId, aspects: deck.aspects, cards }, PLAYABLE_CARDS);
};
const ALL_STARTER_DECKS: readonly StarterDeck[] = [
  ...CORE_STARTER_DECKS,
  ...WAVE1_STARTER_DECKS,
  ...WAVE2_STARTER_DECKS,
  ...WAVE3_STARTER_DECKS,
  ...WAVE4_STARTER_DECKS,
  ...WAVE5_STARTER_DECKS,
  ...WAVE6_STARTER_DECKS,
  ...WAVE7_STARTER_DECKS,
];

describe("Colossus hero in seat 1, Shadowcat in seat 2 with the Colossus ally (32048): the RRG's own rule, option off (RRG 1.8 'Unique Icon', pp. 45-46)", () => {
  // The ally prints the subtitle "Piotr Rasputin", the hero's alter-ego title: "the subtitle or alter-ego title of one
  // matches the title, subtitle, or alter-ego title of the other".
  it.each(["hero", "alterEgo"] as const)(
    "the ally is refused while the Colossus identity is in %s form, with the RRG's unique-match message",
    (form) => {
      const base = shadowcatsTurn("colossus-protection", COLOSSUS_ALLY);
      expect(base.state.tableRules).toBeUndefined();
      const state = withForm(base.state, form === "hero" ? { heroForm: 0 } : "alterEgo", P1);
      const played = playAlly(state, base.ally);
      expect(played.ok).toBe(false);
      if (played.ok) return;
      expect(played.error.code).toBe("duplicate_unique_card");
      expect(played.error.message).toBe(
        "Colossus (Piotr Rasputin) matches Colossus (Piotr Rasputin), already in play: the players as a group may have only one copy of each unique card in play",
      );
      const shown = offered(state, base.ally);
      expect(shown.legal).toBe(false);
      expect(shown.message).toBe(played.error.message);
    },
  );

  it("the ally is still a resource beside the Colossus hero", () => {
    const { state, ally } = shadowcatsTurn("colossus-protection", COLOSSUS_ALLY);
    payForAnotherCardWith(state, ally);
  });

  it("deck building (RRG 'Unique Icon': a deck cannot include a unique card matching its own identity): a Colossus deck holding 32048 or 35021 is refused, Shadowcat's deck holding 32048 is legal", () => {
    // Engine today: `validateDeck` refuses the ally in the Colossus hero's own deck, which is the RRG's deckbuilding
    // sentence ("The identity is included in this evaluation"); no divergence from the RRG to report.
    for (const ally of ["32048", "35021"]) {
      const result = withAllyAdded("colossus-protection", ally);
      expect(result).toEqual({
        ok: false,
        problems: [
          {
            code: "unique_match",
            message:
              "Colossus (Piotr Rasputin) matches the identity Colossus (Piotr Rasputin); a deck cannot include a unique card that matches its own identity.",
            cardIds: [cardId("32001a"), cardId(ally)],
          },
        ],
      });
    }
    // Shadowcat is a different person, and her precon already holds 32048.
    expect(ALL_STARTER_DECKS.find((deck) => deck.id === "shadowcat-aggression")?.cards).toContainEqual({
      cardId: cardId(COLOSSUS_ALLY),
      quantity: expect.any(Number),
    });
    expect(withAllyAdded("shadowcat-aggression", COLOSSUS_ALLY)).toEqual({ ok: true });
  });
});

describe("Valkyrie hero in seat 1, Shadowcat in seat 2 with the Valkyrie ally (06012)", () => {
  it("option off (the default): the ally is playable beside the hero, as FFG ruled (rulings Jan 26, 2026 (4) #7 and Mar 19, 2026 (4); RRG 1.8 'Unique Icon', p. 45)", () => {
    const { state, ally } = shadowcatsTurn("valkyrie-aggression", VALKYRIE_ALLY);
    expect(state.tableRules).toBeUndefined();
    const played = playAlly(state, ally);
    expect(played.ok).toBe(true);
    if (played.ok) expect(playerOf(played.state, P2).playArea).toContain(ally);
  });

  it("an option that is off is not stored: the state is the same as with no table rules at all", () => {
    expect(shadowcatsTurn("valkyrie-aggression", VALKYRIE_ALLY, { sameNameHeroAllyConflict: false }).state).toEqual(
      shadowcatsTurn("valkyrie-aggression", VALKYRIE_ALLY).state,
    );
  });

  it.each(["hero", "alterEgo"] as const)(
    "option on: refused while the Valkyrie identity is in %s form, with the table rule named",
    (form) => {
      const base = shadowcatsTurn("valkyrie-aggression", VALKYRIE_ALLY, ON);
      expect(base.state.tableRules).toEqual(ON);
      const state = withForm(base.state, form === "hero" ? { heroForm: 0 } : "alterEgo", P1);
      const played = playAlly(state, base.ally);
      expect(played.ok).toBe(false);
      if (played.ok) return;
      expect(played.error.code).toBe("duplicate_unique_card");
      expect(played.error.message).toBe(
        "Valkyrie is already in play as Player 1's hero (table rule: a hero and an ally with the same name can't both be in play)",
      );
      const shown = offered(state, base.ally);
      expect(shown.legal).toBe(false);
      expect(shown.message).toBe(played.error.message);
    },
  );

  it("option on: the ally is still a resource, and still legal in Shadowcat's and in Valkyrie's own deck (deck building is not changed)", () => {
    const { state, ally } = shadowcatsTurn("valkyrie-aggression", VALKYRIE_ALLY, ON);
    payForAnotherCardWith(state, ally);
    // Deck building compares cards with `cardsMatch` and no table rules (`deck.ts`), so even a Valkyrie hero's own
    // deck may hold the ally, as the March 19, 2026 (4) ruling allows.
    expect(cardsMatch(card("25001a"), card(VALKYRIE_ALLY))).toBe(false);
    expect(withAllyAdded("valkyrie-aggression", VALKYRIE_ALLY)).toEqual({ ok: true });
    expect(withAllyAdded("shadowcat-aggression", VALKYRIE_ALLY)).toEqual({ ok: true });
  });

  it("option on: the Shadowcat ally (32002, subtitle Kitty Pryde) is refused beside the Shadowcat hero by the RRG's own rule, with the RRG's message, on or off", () => {
    for (const rules of [undefined, ON]) {
      const base = shadowcatsTurn("valkyrie-aggression", VALKYRIE_ALLY, rules);
      const spare = playerOf(base.state, P2).deck[0]!;
      const relabeled: GameState = {
        ...base.state,
        instances: { ...base.state.instances, [spare]: { ...base.state.instances[spare]!, cardId: cardId("32002") } },
      };
      const given = moveToHand(relabeled, P2, "32002");
      const kitty = given.ids[0]!;
      const cost = playCostOf(given.state, P2, kitty, DEPS)!.current;
      const played = applyCommand(given.state, play(P2, kitty, payWith(given.state, P2, cost, [kitty])), DEPS);
      expect(played.ok).toBe(false);
      if (played.ok) continue;
      expect(played.error.code).toBe("duplicate_unique_card");
      expect(played.error.message).toContain(
        "Shadowcat (Kitty Pryde) matches Shadowcat (Kitty Pryde), already in play",
      );
    }
  });

  it("option on: a subtitled ally of a different person is unaffected (Nightcrawler 32011 is playable)", () => {
    const base = shadowcatsTurn("valkyrie-aggression", VALKYRIE_ALLY, ON);
    const spare = playerOf(base.state, P2).deck[0]!;
    const relabeled: GameState = {
      ...base.state,
      instances: { ...base.state.instances, [spare]: { ...base.state.instances[spare]!, cardId: cardId("32011") } },
    };
    const given = moveToHand(relabeled, P2, "32011");
    const kurt = given.ids[0]!;
    const cost = playCostOf(given.state, P2, kurt, DEPS)!.current;
    expect(applyCommand(given.state, play(P2, kurt, payWith(given.state, P2, cost, [kurt])), DEPS).ok).toBe(true);
  });

  it("option on: the game replays from its log to the same state, the option included", () => {
    const config = playableScenario("rhino", {
      seed: 7,
      players: [{ starterDeckId: "valkyrie-aggression" }, { starterDeckId: "shadowcat-aggression" }],
    });
    const created = createGame({ ...config, tableRules: ON }, DEPS);
    if (!created.ok) throw new Error(created.error.message);
    let session = startSession(created.state);
    for (let step = 0; step < 40 && session.state.pendingChoice; step++) {
      const choice = session.state.pendingChoice;
      const next = sessionApply(
        session,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: [...firstLegal(session.state)],
        },
        DEPS,
      );
      if (!next.ok) throw new Error(next.error.message);
      session = next.session;
    }
    const ended = sessionApply(session, endTurn(P1), DEPS);
    if (!ended.ok) throw new Error(ended.error.message);
    const replayed = replay(ended.session.log, DEPS);
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;
    expect(replayed.state).toEqual(ended.session.state);
    expect(replayed.state.tableRules).toEqual(ON);
  });
});

// No Colossus hero in the game (it would refuse the ally, above): Wolverine in seat 1, Shadowcat in seat 2.
describe("the Colossus ally's printed cost reduction (32048: 'Reduce the cost to play Colossus by 1 if your identity has the MUTANT or X-MEN trait')", () => {
  it.each(["hero", "alterEgo"] as const)(
    "Shadowcat in %s form (X-MEN as Shadowcat, MUTANT as Kitty Pryde): the engine prices it at 3, printed 4",
    (form) => {
      const base = shadowcatsTurn("wolverine-aggression", COLOSSUS_ALLY);
      const state = withForm(base.state, form === "hero" ? { heroForm: 0 } : "alterEgo", P2);
      const price = playCostOf(state, P2, base.ally, DEPS);
      expect(price?.printed).toBe(4);
      expect(price?.current).toBe(3);
      expect(playAlly(state, base.ally, 2).ok).toBe(false);
      expect(playAlly(state, base.ally, 3).ok).toBe(true);
    },
  );
});
