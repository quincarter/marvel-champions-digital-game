import { HERCULES_CARDS, type EventCard } from "@mc/content";
import {
  activeEncounterDeck,
  applyCommand,
  cardsInPlay,
  createGame,
  separateDeckOf,
  type Command,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import {
  DEFEAT_THE_HYDRA,
  EMBODY_PATHOS,
  GIFT,
  LERNEAN_HYDRA,
  PROTECT_HUMANITY,
  drive,
  newLabors,
  theCard,
  withLaborOrder,
} from "../../../dsl/wave10-labor.testing.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { codeOf } from "../../../wave9/testing.js";
import {
  CORE_SPIDER_MAN,
  HERCULES_DECK,
  HERO_PACK_CARDS,
  WAVE10_DEPS,
  engageMinion,
  heroPackSeat,
  herculesGame,
  herculesHeroGame,
  stagedInPlay,
} from "../../testing.js";
import { HERCULES_EVENTS, HERCULES_EVENTS_SKIPPED } from "./events.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Hercules's three events (59009 The Gift of Battle, 59010 Son of Zeus, 59011 Wisdom of Athena),
 * docs/phase7-wave10-hero-packs.md H3.9 and H8.4 line HS11, played from the hand in real games against Core's Rhino with
 * the hand-built Leadership deck `HERCULES_DECK`. No ruling names these cards.
 *
 * How a game gets its Gift cards. One test per event reaches a Gift for real (a Labor card revealed, its minion
 * defeated, Atonement taken). Every other count (1, 2, 3) is arranged with the staging the Gift and Labor tests use
 * (`withGift`: the card taken out of the Gift deck and attached to the identity under the player's control), since
 * three real Labor cards would be unwieldy (Atonement is once per phase) and prove nothing more about these events.
 *
 * Each case seats exactly the event and the cards that pay for it in the hand. The payers print one resource each, so
 * the cost paid is exact: Olympus 59012 (1 energy) and two Lion of Olympus 59016 (1 physical each).
 */
const GIFT_OF_BATTLE = "59009";
const SON_OF_ZEUS = "59010";
const WISDOM = "59011";
const OLYMPUS = "59012";
const GAUNTLETS = "59013";
const LION = "59016";
const PAYERS = [OLYMPUS, LION, LION];
const NEMEAN = "59005";
const SHIELD = "59006";
const SWORD = "59007";
const GIFTS = [NEMEAN, SHIELD, SWORD];
const APPEAL = "59035";
const MODOK = "01184"; // Core minion, 8 hit points, no guard
const MODOK_ID = "modok" as InstanceId;
const REFS = [
  "59009.the-gift-of-battle-constant",
  "59009.the-gift-of-battle-action",
  "59010.son-of-zeus-action",
  "59011.wisdom-of-athena-constant",
  "59011.wisdom-of-athena-action",
];
const R = HERCULES_EVENTS;

const run = (s: GameState, command: Command, pick: Picker = firstLegal) => drive(s, command, pick, WAVE10_DEPS);
const accepted = (s: GameState, command: Command): boolean => applyCommand(s, command, WAVE10_DEPS).ok;
const giftDeck = (s: GameState, p = P1): readonly InstanceId[] => separateDeckOf(s, p, GIFT).deck;
const handCodes = (s: GameState, p = P1): string[] => playerOf(s, p).hand.map((i) => codeOf(s, i));
const data = (code: string) => HERCULES_CARDS.find((c) => (c.id as string) === code)! as EventCard;
const picks =
  (...targets: readonly InstanceId[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    const hit = choice?.options.find((o) => o.ref.kind === "card" && targets.includes(o.ref.instanceId));
    return hit ? [hit.optionId] : firstLegal(state);
  };

/** Surgery: the Gift `code` taken out of Hercules (P1) Gift deck and attached to `player` identity, under their control. */
function withGift(state: GameState, code: string, player = P1): GameState {
  const id = giftDeck(state).find((i) => codeOf(state, i) === code)!;
  const host = identityOf(state, player);
  const moved: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            separateDecks: {
              ...p.separateDecks,
              [GIFT]: { ...p.separateDecks[GIFT]!, deck: p.separateDecks[GIFT]!.deck.filter((i) => i !== id) },
            },
          }
        : p,
    ),
  };
  const placed = patchInstance(moved, id, { faceup: true, controllerId: player, attachedTo: host });
  return patchInstance(placed, host, { attachments: [...inst(placed, host).attachments, id] });
}
const withGifts = (state: GameState, count: number): GameState =>
  GIFTS.slice(0, count).reduce((s, code) => withGift(s, code), state);

/** Surgery: Appeal to Athena (an obligation from the encounter deck) in P1's play area. */
function withAppeal(state: GameState): GameState {
  const deck = activeEncounterDeck(state);
  const id =
    deck.deck.find((i) => codeOf(state, i) === APPEAL) ??
    playerOf(state, P1).setAside.find((i) => codeOf(state, i) === APPEAL);
  if (!id) throw new Error("no Appeal to Athena");
  const key = Object.keys(state.encounterDecks).find((k) => state.encounterDecks[k] === deck)!;
  const placed: GameState = {
    ...state,
    encounterDecks: { ...state.encounterDecks, [key]: { ...deck, deck: deck.deck.filter((i) => i !== id) } },
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
  };
  return patchInstance(placed, id, { faceup: true, controllerId: null });
}

/** The event and exactly `payers` in P1's hand, and the command that plays the event paying with the first `n`. */
function staged(base: GameState, event: string, payers: readonly string[] = PAYERS) {
  const given = moveToHand(base, P1, event, ...payers);
  const [id, ...paying] = given.ids as [InstanceId, ...InstanceId[]];
  const state: GameState = {
    ...given.state,
    players: given.state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [id, ...paying] } : p)),
  };
  return { state, id, paying, command: (n: number) => play(P1, id, paying.slice(0, n)) };
}

/** Hercules, hero form, and Core's Spider-Man (P2) against Rhino. */
function twoPlayerGame(): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: CORE_SPIDER_MAN }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: HERO_PACK_CARDS,
  } as never);
  const created = createGame({ ...config, players: [heroPackSeat(HERCULES_DECK), ...config.players] }, WAVE10_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return withForm(
    settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE10_DEPS),
    { heroForm: 0 },
  );
}

/** A Gift reached for real: Defeat the Hydra revealed, its minion defeated by Hercules's basic attack, Atonement taken. */
function realGift(): GameState {
  const start = withLaborOrder(herculesGame(), DEFEAT_THE_HYDRA, PROTECT_HUMANITY, EMBODY_PATHOS);
  const attached = run(start, newLabors(start)).state;
  const hydra = theCard(attached, LERNEAN_HYDRA);
  const brink = withForm(patchInstance(attached, hydra, { damage: 11 }), { heroForm: 0 });
  const decline: Picker = (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
    if (choice?.options.some((o) => o.label === "Do not flip")) return [choice.options[1]!.optionId];
    return firstLegal(s);
  };
  const { state } = run(
    brink,
    { type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(brink), targetInstanceId: hydra },
    decline,
  );
  return state;
}
const giftsInPlay = (s: GameState): number => cardsInPlay(s).filter((i) => GIFTS.includes(codeOf(s, i))).length;

describe("Hercules events registry", () => {
  it("every ability validates, with the printed timing", () => {
    expect(HERCULES_EVENTS_SKIPPED).toEqual({});
    for (const id of REFS) expect(validateDefinition(R[id]!), id).toEqual([]);
    for (const id of REFS.filter((r) => r.endsWith("-constant")))
      expect(R[id]!.trigger, id).toMatchObject({ kind: "constant" });
    for (const id of REFS.filter((r) => r.endsWith("-action")))
      expect(R[id]!.trigger, id).toMatchObject({ kind: "action", form: "hero" });
  });

  it("the five printed refs are registered, none is skipped, and the registry holds exactly them", () => {
    const printed = [GIFT_OF_BATTLE, SON_OF_ZEUS, WISDOM].flatMap((c) => data(c).abilities.map((a) => a.id as string));
    expect(printed.sort()).toEqual([...REFS].sort());
    expect(Object.keys(R).sort()).toEqual([...REFS].sort());
  });
});

describe("59009 The Gift of Battle", () => {
  it.each([0, 1, 2, 3])(
    "with %i Gift cards (arranged) it costs 3 minus that: exactly that many payers play it, one fewer cannot",
    (gifts) => {
      const { state, command } = staged(withGifts(herculesHeroGame(), gifts), GIFT_OF_BATTLE);
      const cost = 3 - gifts;
      expect(accepted(state, command(cost))).toBe(true);
      if (cost > 0) expect(accepted(state, command(cost - 1))).toBe(false);
    },
  );

  it("one Gift reached for real (Atonement) makes it cost 2", () => {
    const real = realGift();
    expect(giftsInPlay(real)).toBe(1);
    const { state, command } = staged(real, GIFT_OF_BATTLE);
    expect(accepted(state, command(1))).toBe(false);
    expect(accepted(state, command(2))).toBe(true);
  });

  it("Hero Action (attack): deals 5 damage to the chosen enemy, not Hercules's ATK 3, and pays the cost in cards", () => {
    const base = engageMinion(herculesHeroGame(), MODOK, MODOK_ID, P1);
    const { state, command } = staged(base, GIFT_OF_BATTLE);
    const villain = base.activeVillainId!;
    const { state: after } = run(state, command(3), picks(MODOK_ID));
    expect(inst(after, MODOK_ID).damage).toBe(5);
    expect(inst(after, villain).damage).toBe(0);
    expect(handCodes(after)).toEqual([]);
    expect(playerOf(after, P1).discard.map((i) => codeOf(after, i))).toContain(GIFT_OF_BATTLE);
  });

  it("the damage does not grow with Gift cards: with three in play the event is free and still deals 5", () => {
    const base = engageMinion(withGifts(herculesHeroGame(), 3), MODOK, MODOK_ID, P1);
    const { state, command } = staged(base, GIFT_OF_BATTLE);
    const { state: after } = run(state, command(0), picks(MODOK_ID));
    expect(inst(after, MODOK_ID).damage).toBe(5);
    expect(playerOf(after, P1).hand).toHaveLength(3);
  });

  it("Appeal to Athena in play: Hercules counts as controlling no Gift, so two Gift cards still leave the cost at 3", () => {
    const { state, command } = staged(withAppeal(withGifts(herculesHeroGame(), 2)), GIFT_OF_BATTLE);
    expect(accepted(state, command(2))).toBe(false);
    expect(accepted(state, command(3))).toBe(true);
  });

  it("an enemy under Defeat the Hydra takes the 5 damage, since the event is Hercules's own attack", () => {
    const start = withLaborOrder(herculesGame(), DEFEAT_THE_HYDRA, PROTECT_HUMANITY, EMBODY_PATHOS);
    const attached = withForm(run(start, newLabors(start)).state, { heroForm: 0 });
    const hydra = theCard(attached, LERNEAN_HYDRA);
    const { state, command } = staged(attached, GIFT_OF_BATTLE);
    const { state: after, events } = run(state, command(3), picks(hydra));
    // Owner 2026-10-20 (A, reversing Q8/Q33): the Hydra's spend option is offered even to a player who cannot pay, and firstLegal takes it (first option), so the Hydra does not heal and keeps all 5.
    expect(
      events
        .filter((e) => e.type === "damageDealt" && e.targetInstanceId === hydra)
        .map((e) => (e as { amount: number }).amount),
    ).toEqual([5]);
    expect(inst(after, hydra).damage).toBe(5);
  });

  it("two players: the other player's Gift cards do not reduce the cost, Hercules's own do", () => {
    const base = twoPlayerGame();
    const spiderGift = withGift(withGift(base, NEMEAN, P2), SHIELD, P2);
    const other = staged(spiderGift, GIFT_OF_BATTLE);
    expect(accepted(other.state, other.command(2))).toBe(false);
    expect(accepted(other.state, other.command(3))).toBe(true);
    const own = staged(withGift(withGift(base, NEMEAN), SHIELD), GIFT_OF_BATTLE);
    expect(accepted(own.state, own.command(1))).toBe(true);
    expect(accepted(own.state, own.command(0))).toBe(false);
  });
});

describe("59010 Son of Zeus", () => {
  /** Hercules and Gauntlets of Hercules (attached) exhausted, `gifts` Gift cards, Son of Zeus (cost 2) and two payers in hand. */
  function setup(gifts: number) {
    const gauntlets = stagedInPlay(herculesHeroGame(), GAUNTLETS, { attach: true });
    const exhausted = patchInstance(
      patchInstance(gauntlets.state, gauntlets.id, { exhausted: true }),
      identityOf(gauntlets.state),
      { exhausted: true },
    );
    const ready = staged(withGifts(exhausted, gifts), SON_OF_ZEUS, [OLYMPUS, LION]);
    return { ...ready, gauntlets: gauntlets.id };
  }
  const result = (gifts: number) => {
    const s = setup(gifts);
    const deckBefore = playerOf(s.state, P1).deck.length;
    const { state } = run(s.state, s.command(2), picks(s.gauntlets));
    return { s, state, drawn: deckBefore - playerOf(state, P1).deck.length };
  };

  it("0 Gift cards: only Hercules is readied; the upgrade stays exhausted, no tough status, no card drawn", () => {
    const { s, state, drawn } = result(0);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    expect(inst(state, s.gauntlets).exhausted).toBe(true);
    expect(inst(state, identityOf(state)).statuses.tough).toBe(0);
    expect(drawn).toBe(0);
    expect(playerOf(state, P1).hand).toHaveLength(0);
  });

  it("1 Gift card: also readies an identity-specific upgrade he controls (the chosen Gauntlets); no tough status, no draw", () => {
    const { s, state, drawn } = result(1);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    expect(inst(state, s.gauntlets).exhausted).toBe(false);
    expect(inst(state, identityOf(state)).statuses.tough).toBe(0);
    expect(drawn).toBe(0);
  });

  it("2 Gift cards (arranged): also gains a tough status card; no draw", () => {
    const { s, state, drawn } = result(2);
    expect(inst(state, s.gauntlets).exhausted).toBe(false);
    expect(inst(state, identityOf(state)).statuses.tough).toBe(1);
    expect(drawn).toBe(0);
  });

  it("3 Gift cards (arranged): all three bullets, he also draws 1 card", () => {
    const { s, state, drawn } = result(3);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    expect(inst(state, s.gauntlets).exhausted).toBe(false);
    expect(inst(state, identityOf(state)).statuses.tough).toBe(1);
    expect(drawn).toBe(1);
    expect(playerOf(state, P1).hand).toHaveLength(1);
  });

  it("one Gift reached for real (Atonement) readies an upgrade and does nothing more", () => {
    const real = realGift();
    const gauntlets = stagedInPlay(real, GAUNTLETS, { attach: true });
    const exhausted = patchInstance(gauntlets.state, gauntlets.id, { exhausted: true });
    const s = staged(exhausted, SON_OF_ZEUS, [OLYMPUS, LION]);
    const { state } = run(s.state, s.command(2), picks(gauntlets.id));
    expect(inst(state, gauntlets.id).exhausted).toBe(false);
    expect(inst(state, identityOf(state)).statuses.tough).toBe(0);
  });

  it("the upgrade offered is one he controls: the Gauntlets of another player are not a candidate", () => {
    const mine = withGift(twoPlayerGame(), NEMEAN);
    const theirs = stagedInPlay(mine, GAUNTLETS, { attach: true });
    // Surgery: the Gauntlets under P2's control on P2's identity, exhausted.
    const p1Host = identityOf(theirs.state);
    const p2Host = identityOf(theirs.state, P2);
    const moved = patchInstance(
      patchInstance(theirs.state, theirs.id, { controllerId: P2, attachedTo: p2Host, exhausted: true }),
      p1Host,
      { attachments: inst(theirs.state, p1Host).attachments.filter((i) => i !== theirs.id) },
    );
    const withHost = patchInstance(moved, p2Host, { attachments: [...inst(moved, p2Host).attachments, theirs.id] });
    const ready = staged(withHost, SON_OF_ZEUS, [OLYMPUS, LION]);
    const seen: string[] = [];
    const { state } = run(ready.state, ready.command(2), (s) => {
      for (const o of s.pendingChoice?.options ?? []) if (o.ref.kind === "card") seen.push(codeOf(s, o.ref.instanceId));
      return firstLegal(s);
    });
    expect(seen).not.toContain(GAUNTLETS);
    expect(inst(state, theirs.id).exhausted).toBe(true);
  });

  it("Appeal to Athena in play with three Gift cards: only Hercules is readied (no upgrade, no tough, no draw)", () => {
    const s = setup(3);
    const { state } = run(withAppeal(s.state), s.command(2), picks(s.gauntlets));
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    expect(inst(state, s.gauntlets).exhausted).toBe(true);
    expect(inst(state, identityOf(state)).statuses.tough).toBe(0);
    expect(playerOf(state, P1).hand).toHaveLength(0);
  });

  it("costs 2 regardless of Gift cards", () => {
    const s = setup(3);
    expect(accepted(s.state, s.command(1))).toBe(false);
    expect(accepted(s.state, s.command(2))).toBe(true);
  });
});

describe("59011 Wisdom of Athena", () => {
  const withThreat = (s: GameState, threat: number): GameState => patchInstance(s, s.mainScheme.instanceId, { threat });

  it.each([0, 1, 2, 3])("with %i Gift cards (arranged) it costs 3 minus that", (gifts) => {
    const { state, command } = staged(withThreat(withGifts(herculesHeroGame(), gifts), 6), WISDOM);
    const cost = 3 - gifts;
    expect(accepted(state, command(cost))).toBe(true);
    if (cost > 0) expect(accepted(state, command(cost - 1))).toBe(false);
  });

  it("one Gift reached for real (Atonement) makes it cost 2", () => {
    const { state, command } = staged(withThreat(realGift(), 6), WISDOM);
    expect(accepted(state, command(1))).toBe(false);
    expect(accepted(state, command(2))).toBe(true);
  });

  it("Hero Action (thwart): removes 4 threat from the chosen scheme, whatever the Gift count", () => {
    for (const gifts of [0, 3]) {
      const base = withThreat(withGifts(herculesHeroGame(), gifts), 10);
      const { state, command } = staged(base, WISDOM);
      const { state: after } = run(state, command(3 - gifts));
      expect(inst(after, after.mainScheme.instanceId).threat, `${gifts} Gifts`).toBe(6);
    }
  });

  it("removes only the threat there is: a scheme with 3 threat goes to 0", () => {
    const { state, command } = staged(withThreat(herculesHeroGame(), 3), WISDOM);
    const { state: after } = run(state, command(3));
    expect(inst(after, after.mainScheme.instanceId).threat).toBe(0);
  });

  it("Appeal to Athena in play: two Gift cards still leave the cost at 3", () => {
    const { state, command } = staged(withThreat(withAppeal(withGifts(herculesHeroGame(), 2)), 6), WISDOM);
    expect(accepted(state, command(2))).toBe(false);
    expect(accepted(state, command(3))).toBe(true);
  });

  it("two players: Spider-Man's Gift cards do not reduce Hercules's cost", () => {
    const spiderGift = withGift(withGift(withGift(twoPlayerGame(), NEMEAN, P2), SHIELD, P2), SWORD, P2);
    const { state, command } = staged(withThreat(spiderGift, 6), WISDOM);
    expect(accepted(state, command(2))).toBe(false);
    expect(accepted(state, command(3))).toBe(true);
  });
});
