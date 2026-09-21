import { activeEncounterDeck } from "./query.js";
import { flat, cardId, type AllyCard, type AnyCard, type HeroIdentityCard, type UpgradeCard } from "@mc/content";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import { legalActions } from "./legal.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import { createGame } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import {
  stubAlly,
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubMinion,
  stubSupport,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import {
  DEFAULT_CARDS,
  DEFAULT_DECK,
  giveCards,
  MAIN_SCHEME,
  newGame,
  run,
  runWith,
  TREACHERY,
  VILLAIN,
} from "./testing/scenario.js";
import { cardsMatch, matchingCardInPlay } from "./unique.js";

const p1 = playerId("p1");
const p2 = playerId("p2");

const play = (player = p1, id: InstanceId, extra: Partial<Extract<Command, { type: "playCard" }>> = {}): Command => ({
  type: "playCard",
  playerId: player,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
  ...extra,
});
const toHero = (player = p1): Command => ({ type: "changeForm", playerId: player });
const endTurn = (player = p1): Command => ({ type: "endTurn", playerId: player });

const rejected = (state: GameState, command: Command): { code: string; message: string } => {
  const result = applyCommand(state, command);
  if (result.ok) throw new Error(`${command.type} was accepted but should not have been`);
  return { code: result.error.code, message: result.error.message };
};

// ---------------------------------------------------------------------------
// The match predicate, checked against the RRG's own worked examples
// ---------------------------------------------------------------------------

const ally = (id: string, name: string, subtitle?: string): AllyCard => ({
  ...stubAlly({ id, cost: 0, atk: 1, thw: 1, hp: 2 }),
  name,
  unique: true,
  ...(subtitle === undefined ? {} : { subtitle }),
});

const identity = (id: string, name: string, alterEgoName: string): HeroIdentityCard => {
  const base = stubIdentity({ id, name, hp: 10, atk: 2, thw: 2, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6 });
  return { ...base, alterEgo: { ...base.alterEgo, faceName: alterEgoName } };
};

const upgrade = (id: string, name: string): UpgradeCard => ({ ...stubUpgrade({ id, cost: 1 }), name, unique: true });

/**
 * RRG 1.8 "Unique Icon" (pp. 45–46). Each case below is one of the RRG's own printed
 * examples, or the exact carve-out the entry exists to allow.
 */
describe("cardsMatch (RRG 'Unique Icon')", () => {
  it("matches two bare copies of the same title — the Jarnbjorn example", () => {
    expect(cardsMatch(upgrade("jarnbjorn", "Jarnbjorn"), upgrade("jarnbjorn-2", "Jarnbjorn"))).toBe(true);
  });

  it("matches across card types with no subtitles — the Jessica Jones ally vs. minion example", () => {
    const allyCard = ally("jj-ally", "Jessica Jones");
    const minion: AnyCard = {
      ...stubMinion({ id: "jj-minion", hp: 3, atk: 2, sch: 1 }),
      name: "Jessica Jones",
      unique: true,
    };
    expect(cardsMatch(allyCard, minion)).toBe(true);
  });

  /** "the identity with the T'Challa alter-ego, the T'Challa ally, and the Black Panther ally with the subtitle 'T'Challa' are all considered to match." */
  it("matches the whole T'Challa trio, in every pairing", () => {
    const blackPanther = identity("bp", "Black Panther", "T'Challa");
    const tchallaAlly = ally("tchalla", "T'Challa");
    const bpAlly = ally("bp-ally", "Black Panther", "T'Challa");
    expect(cardsMatch(blackPanther, tchallaAlly)).toBe(true);
    expect(cardsMatch(blackPanther, bpAlly)).toBe(true);
    expect(cardsMatch(tchallaAlly, bpAlly)).toBe(true);
    // Symmetric: "the subtitle or alter-ego title of one matches […] of the other".
    expect(cardsMatch(tchallaAlly, blackPanther)).toBe(true);
    expect(cardsMatch(bpAlly, tchallaAlly)).toBe(true);
  });

  it("does not match two identities that share a title but not an alter-ego (the Spider-Man carve-out)", () => {
    const peter = identity("spidey-peter", "Spider-Man", "Peter Parker");
    const miles = identity("spidey-miles", "Spider-Man", "Miles Morales");
    expect(cardsMatch(peter, miles)).toBe(false);
  });

  it("does not match two cards that share a title but have different subtitles", () => {
    expect(
      cardsMatch(ally("bp-tchalla", "Black Panther", "T'Challa"), ally("bp-shuri", "Black Panther", "Shuri")),
    ).toBe(false);
  });

  it("never matches a card without the unique icon, however identical", () => {
    const plain = { ...ally("plain", "Sidekick"), unique: false };
    expect(cardsMatch(plain, { ...plain, id: cardId("plain-2") })).toBe(false);
  });

  it("is not transitive, so it is a pairwise relation and never a lookup key", () => {
    const bare = ally("x", "X");
    const middle = ally("yx", "Y", "X");
    const far = ally("zy", "Z", "Y");
    expect(cardsMatch(bare, middle)).toBe(true);
    expect(cardsMatch(middle, far)).toBe(true);
    expect(cardsMatch(bare, far)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Enforcement: playCard
// ---------------------------------------------------------------------------

const MOCKINGBIRD = ally("mockingbird", "Mockingbird", "Bobbi Morse");
const OTHER_MOCKINGBIRD: AllyCard = { ...MOCKINGBIRD, id: cardId("mockingbird-2") };
const NICK_FURY = ally("fury", "Nick Fury");
/** Same rule shape as the printed "Max 1 per player" text, and deliberately NOT unique. */
const MANSION: AnyCard = { ...stubSupport({ id: "mansion", cost: 0 }), playRestrictions: { maxPerPlayer: 1 } };

const EXTRA_CARDS = [MOCKINGBIRD, OTHER_MOCKINGBIRD, NICK_FURY, MANSION];
const UNIQUE_DECK = [
  ...DEFAULT_DECK,
  MOCKINGBIRD.id,
  MOCKINGBIRD.id,
  OTHER_MOCKINGBIRD.id,
  NICK_FURY.id,
  MANSION.id,
  MANSION.id,
];

const twoSeats = (): GameState => newGame({ players: 2, extraCards: EXTRA_CARDS, deck: UNIQUE_DECK });

describe("RRG 'Unique Icon': a matching card cannot be played", () => {
  it("refuses a second copy in the same player's own play area", () => {
    const given = giveCards(twoSeats(), p1, "mockingbird", "mockingbird");
    const [first, second] = given.ids as [InstanceId, InstanceId];
    const after = run(given.state, toHero(p1), play(p1, first));
    const error = rejected(after, play(p1, second));
    expect(error.code).toBe("duplicate_unique_card");
    expect(error.message).toContain("Mockingbird (Bobbi Morse)");
    expect(error.message).toContain("only one copy of each unique card in play");
  });

  it("refuses a copy across the table — the rule is group-wide, not per player", () => {
    const given = giveCards(twoSeats(), p1, "mockingbird");
    const forP2 = giveCards(given.state, p2, "fury");
    const p1Fury = giveCards(forP2.state, p1, "fury");
    const [mockingbird] = given.ids as [InstanceId];
    const [p2Fury] = forP2.ids as [InstanceId];
    const [ownFury] = p1Fury.ids as [InstanceId];
    const afterP1 = run(p1Fury.state, toHero(p1), play(p1, mockingbird), play(p1, ownFury), endTurn(p1), toHero(p2));
    expect(rejected(afterP1, play(p2, p2Fury)).code).toBe("duplicate_unique_card");
  });

  it("refuses a different printing of the same character (same title and subtitle, different card id)", () => {
    const given = giveCards(twoSeats(), p1, "mockingbird", "mockingbird-2");
    const [first, second] = given.ids as [InstanceId, InstanceId];
    const after = run(given.state, toHero(p1), play(p1, first));
    expect(rejected(after, play(p1, second)).code).toBe("duplicate_unique_card");
  });

  it("leaves the separate 'Max 1 per player' rule alone: per controller, and a different code", () => {
    const given = giveCards(twoSeats(), p1, "mansion", "mansion");
    const forP2 = giveCards(given.state, p2, "mansion");
    const [first, second] = given.ids as [InstanceId, InstanceId];
    const [p2Mansion] = forP2.ids as [InstanceId];
    const afterP1 = run(forP2.state, toHero(p1), play(p1, first));
    const blocked = rejected(afterP1, play(p1, second));
    expect(blocked.code).toBe("no_valid_target");
    expect(blocked.message).toContain("max 1 per player");
    // The second player may still play their own copy: this rule is scoped to one controller.
    const afterP2 = run(afterP1, endTurn(p1), toHero(p2), play(p2, p2Mansion));
    expect(mustPlayer(afterP2, p2).playArea).toContain(p2Mansion);
  });
});

describe("legalActions surfaces the unique rule so a client can grey the card", () => {
  it("reports the blocked play as illegal with duplicate_unique_card and the engine's message", () => {
    const given = giveCards(twoSeats(), p1, "mockingbird", "mockingbird");
    const [first, second] = given.ids as [InstanceId, InstanceId];
    const after = run(given.state, toHero(p1), play(p1, first));
    const actions = legalActions(after, p1);
    if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
    expect(actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === second)).toBe(false);
    const illegal = actions.illegal.find((a) => a.action.kind === "playCard" && a.action.instanceId === second);
    expect(illegal?.reason).toBe("duplicate_unique_card");
    expect(illegal?.message).toContain("Mockingbird (Bobbi Morse)");
  });
});

// ---------------------------------------------------------------------------
// Setup: identities, and the carve-out that made the predicate title+alter-ego
// ---------------------------------------------------------------------------

describe("identity selection at setup still follows the same predicate", () => {
  const PETER = identity("spidey-peter", "Spider-Man", "Peter Parker");
  const MILES = identity("spidey-miles", "Spider-Man", "Miles Morales");
  const seat = (card: HeroIdentityCard) => ({ identityCardId: card.id, deck: [...DEFAULT_DECK] });
  const table = (a: HeroIdentityCard, b: HeroIdentityCard) =>
    createGame({
      seed: 1,
      cards: [...DEFAULT_CARDS, PETER, MILES],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: [],
      players: [seat(a), seat(b)],
    });

  it("still refuses two seats as the same hero", () => {
    const result = table(PETER, PETER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("duplicate_unique_card");
  });

  it("still allows two heroes who share a title but not an alter-ego", () => {
    expect(table(PETER, MILES).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The in-play scan
// ---------------------------------------------------------------------------

describe("matchingCardInPlay", () => {
  it("ignores facedown cards in play, which show no title to match against", () => {
    const given = giveCards(twoSeats(), p1, "mockingbird");
    const [mockingbird] = given.ids as [InstanceId];
    const inPlay = run(given.state, toHero(p1), play(p1, mockingbird));
    expect(matchingCardInPlay(inPlay, MOCKINGBIRD)).toBe(mockingbird);
    const facedown: GameState = {
      ...inPlay,
      instances: { ...inPlay.instances, [mockingbird]: { ...inPlay.instances[mockingbird]!, faceup: false } },
    };
    expect(matchingCardInPlay(facedown, MOCKINGBIRD)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Enforcement: the putIntoPlay effect path
// ---------------------------------------------------------------------------

/**
 * "Pay the printed cost of an ally in any player's discard pile → put that ally into play"
 * (Make the Call), in the two configurations the engine supports: with `entersPlay`
 * declared, which refuses the pick at initiation, and without, which lets the attempt
 * happen so the RRG's own resolution ("any effect that attempts to do so has no effect")
 * can be observed on its own.
 */
const makeTheCall = (id: string, entersPlay: boolean): StubAbility =>
  stubAbility(id, {
    trigger: { kind: "action" },
    cost: {
      payPrintedCostOf: {
        slot: "ally",
        from: { zone: "discard", player: "any", query: { categories: ["ally"] } },
        ...(entersPlay ? { entersPlay: true } : {}),
      },
    },
    effects: [{ kind: "putIntoPlay", card: { kind: "slot", slot: "ally" }, controller: { kind: "controller" } }],
  });

const CHECKED = makeTheCall("call-checked", true);
const UNCHECKED = makeTheCall("call-unchecked", false);
const CALL_CHECKED = stubEvent({ id: "call-checked", cost: 0, abilities: [CHECKED.ref] });
const CALL_UNCHECKED = stubEvent({ id: "call-unchecked", cost: 0, abilities: [UNCHECKED.ref] });

/** p1 with a Mockingbird in play and a second Mockingbird in their discard pile, plus both Make the Calls in hand. */
function mockingbirdInPlayAndInDiscard() {
  const deps = depsOf(CHECKED, UNCHECKED);
  const extras = [...EXTRA_CARDS, CALL_CHECKED, CALL_UNCHECKED];
  const state = newGame({
    extraCards: extras,
    deck: [...UNIQUE_DECK, CALL_CHECKED.id, CALL_UNCHECKED.id],
    deps,
  });
  const given = giveCards(state, p1, "mockingbird", "mockingbird", "call-checked", "call-unchecked");
  const [inPlay, spare, checked, unchecked] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
  const played = runWith(deps, given.state, toHero(p1), play(p1, inPlay));
  // The spare copy starts in p1's discard pile, where Make the Call reaches.
  const after: GameState = {
    ...played,
    players: played.players.map((seat) =>
      seat.playerId === p1
        ? { ...seat, hand: seat.hand.filter((id) => id !== spare), discard: [spare, ...seat.discard] }
        : seat,
    ),
  };
  expect(mustPlayer(after, p1).playArea).toContain(inPlay);
  expect(mustPlayer(after, p1).discard).toContain(spare);
  return { deps, state: after, inPlay, spare, checked, unchecked };
}

describe("RRG 'Unique Icon': a matching card cannot be put into play either", () => {
  it("refuses the cost pick when the ability declares that the card enters play, so nothing is paid", () => {
    const { deps, state, spare, checked } = mockingbirdInPlayAndInDiscard();
    const result = applyCommand(state, play(p1, checked, { costChoices: { ally: [spare] } }), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("duplicate_unique_card");
      expect(result.error.message).toContain("Mockingbird (Bobbi Morse)");
    }
    // The event is still in hand: an ability that cannot be initiated costs nothing.
    expect(mustPlayer(state, p1).hand).toContain(checked);
  });

  it("otherwise resolves the RRG's way: the attempt has no effect and the card stays put", () => {
    const { deps, state, inPlay, spare, unchecked } = mockingbirdInPlayAndInDiscard();
    const result = applyCommand(state, play(p1, unchecked, { costChoices: { ally: [spare] } }), deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = result.state;
    expect(mustPlayer(after, p1).playArea).toEqual([inPlay]);
    expect(mustPlayer(after, p1).discard).toContain(spare);
    const blocked = result.events.find((e) => e.type === "uniqueEntryBlocked");
    expect(blocked).toMatchObject({ instanceId: spare, matchedInstanceId: inPlay, disposition: "noEffect" });
  });
});

/**
 * FFG's Ronan the Accuser ruling, generalised: a unique minion cannot enter play beside the
 * same-named villain. The villain is exempt from the rule as an *entering* card, not as a
 * card already in play, so it still blocks.
 */
describe("RRG 'Unique Icon': a non-villain encounter card is discarded instead", () => {
  it("discards a unique minion that would enter play beside the matching villain, and logs why", () => {
    const RONAN_VILLAIN = {
      ...stubVillain({ id: "ronan-villain", stages: [{ hp: flat(30), atk: 2, sch: 1 }] }),
      name: "Ronan the Accuser",
      unique: true,
    };
    const RONAN_MINION: AnyCard = {
      ...stubMinion({ id: "ronan-minion", hp: 5, atk: 3, sch: 1, boostIcons: 0 }),
      name: "Ronan the Accuser",
      unique: true,
    };
    const THUG: AnyCard = stubMinion({ id: "thug", hp: 2, atk: 1, sch: 1, boostIcons: 0 });
    const summon = stubAbility("summon", {
      trigger: { kind: "whenRevealed" },
      effects: [
        { kind: "discardEncounterUntil", filter: { categories: ["minion"] }, bind: "m" },
        { kind: "putIntoPlay", card: { kind: "slot", slot: "m" }, controller: { kind: "firstPlayer" } },
      ],
    });
    const SCHEME = stubMainScheme({
      id: "summoning-scheme",
      stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0), abilities: [summon.ref] }],
    });
    const deps = depsOf(summon);

    const blocked = newGame({
      villain: RONAN_VILLAIN,
      mainScheme: SCHEME,
      extraCards: [RONAN_MINION, THUG],
      encounterDeck: [RONAN_MINION.id, ...Array.from({ length: 10 }, () => TREACHERY.id)],
      deps,
    });
    const minion = Object.values(blocked.instances).find((i) => i.cardId === RONAN_MINION.id)?.instanceId;
    expect(minion).toBeDefined();
    expect(activeEncounterDeck(blocked).discard).toContain(minion);
    expect(mustPlayer(blocked, p1).playArea).not.toContain(minion);

    // Control: the same scheme puts a non-matching minion into play exactly as before.
    const allowed = newGame({
      villain: RONAN_VILLAIN,
      mainScheme: SCHEME,
      extraCards: [RONAN_MINION, THUG],
      encounterDeck: [THUG.id, ...Array.from({ length: 10 }, () => TREACHERY.id)],
      deps,
    });
    const thug = Object.values(allowed.instances).find((i) => i.cardId === THUG.id)?.instanceId;
    expect(mustPlayer(allowed, p1).playArea).toContain(thug);
  });
});
