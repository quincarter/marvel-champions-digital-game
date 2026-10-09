import { WAVE8_STARTER_DECKS } from "@mc/content";
import {
  activeVillain,
  applyCommand,
  createGame,
  handSize,
  maxHitPoints,
  type Command,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  applyOk,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  resourceAbility,
  settle,
  use,
} from "../../../testing/harness.js";
import { moveToDiscard, withDamage, withForm } from "../../../testing/staging.js";
import { WAVE8_CARDS } from "../../cards.js";
import { WAVE8_DEPS } from "../../index.js";
import { JUBILEE_IDENTITY } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Jubilee / Jubilation Lee (47001a/b), docs/phase7-wave8.md §7.3, §3.66. Her real starter deck (`jubilee-justice`)
 * against Rhino through the wave 8 card pool and registry. Hero face: THW 1, ATK 1, DEF 2, hand size 5; alter-ego face:
 * REC 3, hand size 6; 9 hit points. The rest of her kit (47002 to 47010) and Shopping Spree's own abilities (47003) are
 * later modules', so this file reads where those cards are and their threat, never what they do once in play.
 */
const LIKE_TOTALLY = "47001a.like-totally";
const MALL_RAT = "47001b.mall-rat";
const JUBILEE = WAVE8_STARTER_DECKS.find((d) => d.id === "jubilee-justice")!;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;

type Seat = "jubilee" | typeof SPIDER_MAN;
const seatOf = (seat: Seat) =>
  seat === "jubilee"
    ? {
        identityCardId: JUBILEE.identityCardId,
        aspects: JUBILEE.aspects,
        deck: JUBILEE.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
      }
    : seat;

function setupGame(seats: readonly Seat[] = ["jubilee"], seed = 1): GameState {
  const config = coreScenario("rhino", {
    players: seats.map(seatOf),
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE8_CARDS,
  } as never);
  const created = createGame(config, WAVE8_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE8_DEPS);
}
const alterEgoGame = (seats?: readonly Seat[], seed = 1): GameState => setupGame(seats, seed);
const heroGame = (seats?: readonly Seat[], seed = 1): GameState => withForm(setupGame(seats, seed), { heroForm: 0 });

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const deckCodes = (s: GameState, p = P1): string[] => playerOf(s, p).deck.map((id) => codeOf(s, id));
const spreeIds = (s: GameState): InstanceId[] => instancesOf(s, "47003");
/** Shopping Spree copies that are in play: in none of any player's deck, hand or discard pile. */
const spreeInPlay = (s: GameState): InstanceId[] =>
  spreeIds(s).filter((id) => s.players.every((p) => ![...p.deck, ...p.hand, ...p.discard].includes(id)));
const rhino = (s: GameState): InstanceId => activeVillain(s).instanceId;
const rejected = (s: GameState, c: Command, code?: string): boolean => {
  const r = applyCommand(s, c, WAVE8_DEPS);
  return !r.ok && (code === undefined || r.error.code === code);
};
const mallRat = (s: GameState, player = P1): Command => use(player, identityOf(s, P1), MALL_RAT);
/** Answers the Mall Rat search by taking the first card offered. */
const takeFirst = (s: GameState): readonly string[] => s.pendingChoice!.options.slice(0, 1).map((o) => o.optionId);
const doMallRat = (s: GameState): GameState =>
  settle(applyOk(s, mallRat(s), WAVE8_DEPS).state, takeFirst, undefined, WAVE8_DEPS);

describe("Jubilee identity registry", () => {
  it.each([LIKE_TOTALLY, MALL_RAT])("%s validates", (id) => {
    expect(validateDefinition(JUBILEE_IDENTITY[id]!)).toEqual([]);
  });
  it("holds exactly the two identity refs", () => {
    expect(Object.keys(JUBILEE_IDENTITY).sort()).toEqual([LIKE_TOTALLY, MALL_RAT].sort());
  });
});

describe("printed stats, read from the game", () => {
  it("alter-ego form: hand size 6, 9 hit points, REC 3 (recovery heals 3)", () => {
    const s = alterEgoGame();
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    expect(playerOf(s, P1).hand).toHaveLength(6);
    expect(handSize(s, P1, WAVE8_DEPS)).toBe(6);
    expect(maxHitPoints(s, identityOf(s), WAVE8_DEPS)).toBe(9);
    const hurt = withDamage(s, identityOf(s), 5);
    const after = applyOk(hurt, { type: "basicRecover", playerId: P1 }, WAVE8_DEPS).state;
    expect(inst(after, identityOf(after)).damage).toBe(2);
  });
  it("hero form: hand size 5, 9 hit points, ATK 1 and THW 1 (a basic attack deals 1, a basic thwart removes 1)", () => {
    const s = heroGame();
    expect(playerOf(s, P1).identity.form).toBe("hero");
    expect(handSize(s, P1, WAVE8_DEPS)).toBe(5);
    expect(maxHitPoints(s, identityOf(s), WAVE8_DEPS)).toBe(9);
    const before = inst(s, rhino(s)).damage;
    const hit = applyOk(
      s,
      { type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(s), targetInstanceId: rhino(s) },
      WAVE8_DEPS,
    ).state;
    expect(inst(settle(hit, firstLegal, undefined, WAVE8_DEPS), rhino(s)).damage - before).toBe(1);
    const main = s.mainScheme.instanceId;
    const sched = patchInstance(s, main, { threat: 5 });
    const thwarted = settle(
      applyOk(
        sched,
        { type: "basicThwart", playerId: P1, thwarterInstanceId: identityOf(s), schemeInstanceId: main },
        WAVE8_DEPS,
      ).state,
      firstLegal,
      undefined,
      WAVE8_DEPS,
    );
    expect(inst(thwarted, main).threat).toBe(4);
  });
  it("the printed faces carry DEF 2 and the two ability ids", () => {
    const card = heroGame().cardPool["47001a" as never] as never as {
      hero: { def: number; thw: number; atk: number; handSize: number; abilities: { id: string }[] };
      alterEgo: { rec: number; handSize: number; abilities: { id: string }[] };
      hp: number;
    };
    expect([card.hero.def, card.hero.thw, card.hero.atk, card.hero.handSize, card.hp]).toEqual([2, 1, 1, 5, 9]);
    expect([card.alterEgo.rec, card.alterEgo.handSize]).toEqual([3, 6]);
    expect(card.hero.abilities.map((a) => a.id)).toEqual([LIKE_TOTALLY]);
    expect(card.alterEgo.abilities.map((a) => a.id)).toEqual([MALL_RAT]);
  });
});

describe("Jubilee (47001a): Like, totally! (Resource: exhaust Jubilee, generate a [wild])", () => {
  /** Hand with the given kit card in it, and one other card to pay with. */
  const withCard = (s: GameState, code: string): { state: GameState; card: InstanceId; other: InstanceId } => {
    const moved = moveToHand(s, P1, code);
    const card = moved.ids[0]!;
    const other = playerOf(moved.state, P1).hand.find((id) => id !== card && codeOf(moved.state, id) === "47017")!;
    return { state: moved.state, card, other: other ?? playerOf(moved.state, P1).hand.find((id) => id !== card)! };
  };

  it("pays 1 of a 2-cost card: exhausts Jubilee, spends one hand card, the card enters play", () => {
    const { state: s, card, other } = withCard(heroGame(), "47004");
    const handBefore = playerOf(s, P1).hand.length;
    const after = settle(
      applyOk(s, play(P1, card, [other], { abilities: [resourceAbility(identityOf(s), LIKE_TOTALLY)] }), WAVE8_DEPS)
        .state,
      firstLegal,
      undefined,
      WAVE8_DEPS,
    );
    expect(inst(after, identityOf(after)).exhausted).toBe(true);
    expect(playerOf(after, P1).hand).toHaveLength(handBefore - 2);
    expect(playerOf(after, P1).discard).toContain(other);
    expect(inst(after, card).attachedTo).toBe(identityOf(after));
  });
  it("is worth exactly 1: a 2-cost card paid with the ability alone is refused", () => {
    const { state: s, card } = withCard(heroGame(), "47004");
    expect(
      rejected(
        s,
        play(P1, card, [], { abilities: [resourceAbility(identityOf(s), LIKE_TOTALLY)] }),
        "insufficient_resources",
      ),
    ).toBe(true);
    expect(inst(s, identityOf(s)).exhausted).toBe(false);
  });
  it("a 1-cost card is paid by the ability alone: no hand card is spent", () => {
    const { state: s, card } = withCard(heroGame(), "47013");
    const handBefore = playerOf(s, P1).hand.length;
    const after = settle(
      applyOk(s, play(P1, card, [], { abilities: [resourceAbility(identityOf(s), LIKE_TOTALLY)] }), WAVE8_DEPS).state,
      firstLegal,
      undefined,
      WAVE8_DEPS,
    );
    expect(inst(after, identityOf(after)).exhausted).toBe(true);
    expect(playerOf(after, P1).hand).toHaveLength(handBefore - 1);
  });
  it("is refused while Jubilee is exhausted", () => {
    const { state: s, card } = withCard(heroGame(), "47013");
    const tired = {
      ...s,
      instances: { ...s.instances, [identityOf(s)]: { ...inst(s, identityOf(s)), exhausted: true } },
    };
    expect(
      rejected(
        tired,
        play(P1, card, [], { abilities: [resourceAbility(identityOf(tired), LIKE_TOTALLY)] }),
        "already_exhausted",
      ),
    ).toBe(true);
  });
  it("she cannot also attack after paying with it (the exhaust is spent), and the reverse", () => {
    const { state: s, card } = withCard(heroGame(), "47013");
    const paid = settle(
      applyOk(s, play(P1, card, [], { abilities: [resourceAbility(identityOf(s), LIKE_TOTALLY)] }), WAVE8_DEPS).state,
      firstLegal,
      undefined,
      WAVE8_DEPS,
    );
    const attack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(paid),
      targetInstanceId: rhino(paid),
    };
    expect(rejected(paid, attack, "already_exhausted")).toBe(true);
    // The reverse: after a basic attack she is exhausted and cannot pay with it.
    const attacked = settle(applyOk(s, attack, WAVE8_DEPS).state, firstLegal, undefined, WAVE8_DEPS);
    expect(inst(attacked, identityOf(attacked)).exhausted).toBe(true);
    expect(
      rejected(
        attacked,
        play(P1, card, [], { abilities: [resourceAbility(identityOf(attacked), LIKE_TOTALLY)] }),
        "already_exhausted",
      ),
    ).toBe(true);
  });
  it("is not there in alter-ego form (hero face text): refused", () => {
    const { state: s, card } = withCard(alterEgoGame(), "47013");
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    expect(
      rejected(s, play(P1, card, [], { abilities: [resourceAbility(identityOf(s), LIKE_TOTALLY)] }), "no_valid_target"),
    ).toBe(true);
    expect(inst(s, identityOf(s)).exhausted).toBe(false);
  });
  it("two players: Jubilee is seat 2; the active player (seat 1) cannot pay with her resource", () => {
    const s = withForm(heroGame([SPIDER_MAN, "jubilee"]), { heroForm: 0 }, P2);
    const jubilee = identityOf(s, P2);
    expect(codeOf(s, jubilee)).toBe("47001a");
    const cheap = playerOf(s, P1).hand.find(
      (id) => (s.cardPool[codeOf(s, id) as never] as { cost?: number }).cost === 1,
    )!;
    expect(cheap).toBeDefined();
    expect(
      rejected(s, play(P1, cheap, [], { abilities: [resourceAbility(jubilee, LIKE_TOTALLY)] }), "no_valid_target"),
    ).toBe(true);
    expect(inst(s, jubilee).exhausted).toBe(false);
  });
});

describe("Jubilation Lee (47001b): Mall Rat (Action, once per phase: search the deck for Shopping Spree)", () => {
  it("puts Shopping Spree into play under her control with 2 threat, and the deck is one card shorter", () => {
    const s = alterEgoGame();
    expect(spreeInPlay(s)).toEqual([]);
    const before = deckCodes(s);
    expect(before.filter((c) => c === "47003")).toHaveLength(1);
    const after = doMallRat(s);
    const [spree] = spreeInPlay(after);
    expect(spreeInPlay(after)).toHaveLength(1);
    expect(inst(after, spree!).threat).toBe(2);
    expect(inst(after, spree!).controllerId).toBe(P1);
    expect(inst(after, spree!).ownerId).toBe(P1);
    expect(deckCodes(after)).toHaveLength(before.length - 1);
    expect(deckCodes(after)).not.toContain("47003");
    // Not a play: costs nothing, uses no hand card, does not exhaust her.
    expect(playerOf(after, P1).hand).toEqual(playerOf(s, P1).hand);
    expect(inst(after, identityOf(after)).exhausted).toBe(false);
  });
  it("shuffles the deck", () => {
    const s = alterEgoGame();
    const without = playerOf(s, P1).deck.filter((id) => codeOf(s, id) !== "47003");
    const after = doMallRat(s);
    expect([...playerOf(after, P1).deck].sort()).toEqual([...without].sort());
    expect(playerOf(after, P1).deck).not.toEqual(without);
  });
  it("a second use in the same phase is refused (limit 1 per phase)", () => {
    const once = doMallRat(alterEgoGame());
    expect(rejected(once, mallRat(once), "limit_reached")).toBe(true);
    expect(spreeInPlay(once)).toHaveLength(1);
  });
  it("is available again in the next player phase; with Shopping Spree already in play it finds nothing but still shuffles", () => {
    const once = doMallRat(alterEgoGame());
    let s = applyOk(once, { type: "endTurn", playerId: P1 }, WAVE8_DEPS).state;
    s = settle(s, firstLegal, (x) => x.step.phase === "player" && !x.pendingChoice, WAVE8_DEPS);
    expect(s.step.phase).toBe("player");
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    const deckBefore = [...playerOf(s, P1).deck];
    const again = settle(applyOk(s, mallRat(s), WAVE8_DEPS).state, firstLegal, undefined, WAVE8_DEPS);
    expect(spreeInPlay(again)).toHaveLength(1);
    expect([...playerOf(again, P1).deck].sort()).toEqual([...deckBefore].sort());
    expect(playerOf(again, P1).deck).not.toEqual(deckBefore);
    expect(rejected(again, mallRat(again), "limit_reached")).toBe(true);
  });
  it("searches the deck only: a copy in the discard pile is not found, the deck is still shuffled and the use is spent", () => {
    const { state: s } = moveToDiscard(alterEgoGame(), P1, "47003");
    expect(deckCodes(s)).not.toContain("47003");
    const deckBefore = [...playerOf(s, P1).deck];
    const after = settle(applyOk(s, mallRat(s), WAVE8_DEPS).state, firstLegal, undefined, WAVE8_DEPS);
    expect(spreeInPlay(after)).toEqual([]);
    expect(playerOf(after, P1).discard.map((id) => codeOf(after, id))).toContain("47003");
    expect([...playerOf(after, P1).deck].sort()).toEqual([...deckBefore].sort());
    expect(playerOf(after, P1).deck).not.toEqual(deckBefore);
    expect(rejected(after, mallRat(after), "limit_reached")).toBe(true);
  });
  it("searches the deck only: a copy in the hand is not found", () => {
    const moved = moveToHand(alterEgoGame(), P1, "47003");
    const s = moved.state;
    const handBefore = playerOf(s, P1).hand.length;
    const after = settle(applyOk(s, mallRat(s), WAVE8_DEPS).state, firstLegal, undefined, WAVE8_DEPS);
    expect(spreeInPlay(after)).toEqual([]);
    expect(playerOf(after, P1).hand).toHaveLength(handBefore);
    expect(playerOf(after, P1).hand).toContain(moved.ids[0]);
  });
  it("is an alter-ego ability: refused in hero form, and the deck is untouched", () => {
    const s = heroGame();
    expect(rejected(s, mallRat(s), "no_valid_target")).toBe(true);
    expect(deckCodes(s)).toContain("47003");
  });
  it("two players: the other player cannot use it, and only Jubilee's own deck is searched", () => {
    const s = alterEgoGame(["jubilee", SPIDER_MAN]);
    expect(rejected(s, use(P2, identityOf(s, P1), MALL_RAT), "no_valid_target")).toBe(true);
    const p2Deck = [...playerOf(s, P2).deck];
    const after = doMallRat(s);
    expect(spreeInPlay(after)).toHaveLength(1);
    expect(inst(after, spreeInPlay(after)[0]!).controllerId).toBe(P1);
    expect(playerOf(after, P2).deck).toEqual(p2Deck);
  });
});
