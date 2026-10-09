/**
 * A "Boost" ability's "you" in a two-player game, with real cards: Radioactive Man's "Boost: Discard 1 card at random
 * from your hand." (01129) and Weapons Runner's "Boost: Put Weapons Runner into play engaged with you." (01121), both
 * turned up while Klaw I (01113, who gets an additional boost card for each attack) attacks Iron Man.
 *
 * RRG 1.8 "Defend, Defense" (the entry begins on p. 15; this is on p. 16): "If a player defends against an enemy attack
 * that targets a different player …, the defending player becomes the new target of that attack." "Any constant or
 * boost abilities that refer to 'you' refer to the defending player." The defender is declared (step 2) before the
 * boost cards are turned up (step 3; "Attack (Enemy Activation)", p. 9). Owner ruling 2026-10-09
 * (docs/phase7-wave8.md §4.1 row 93): follow the RRG.
 */
import { cardId } from "@mc/content";
import { activeEncounterDeck, type GameState, type PlayerId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { CORE_DEPS } from "./core/index.js";
import { coreScenario } from "./core/setup.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  P1,
  P2,
  patchInstance,
  playerOf,
  startCoreGame,
} from "./testing/harness.js";
import { driveEventsPicking, withForm } from "./testing/staging.js";

const RADIOACTIVE_MAN = "01129";
const WEAPONS_RUNNER = "01121";

interface Seen {
  /** Copies of the boost card in play engaged with each player. */
  readonly engaged: Record<PlayerId, number>;
  /** Facedown boost cards on Klaw as the defender is declared. */
  readonly boostCards: number;
}

/**
 * Iron Man (seat 1) and Spider-Man (seat 2) in hero form against Klaw I, the top of the encounter deck all copies of
 * `boostCard`. Both end their turns and Klaw attacks Iron Man, then Spider-Man. Only the attack on Iron Man is read:
 * the table as each of the two attacks' defenders is asked for, and the cards each player discarded from hand between
 * Klaw's activation against Iron Man and the next enemy activation (a minion's attack has responses of its own).
 */
function klawAttacksIronMan(boostCard: string, defender: (state: GameState) => string) {
  const start = startCoreGame(
    coreScenario("klaw", {
      players: [{ starterDeckId: "core-iron-man-aggression" }, { starterDeckId: "core-spider-man-justice" }],
      seed: 8,
    }),
  );
  const heroes = withForm(withForm(start, { heroForm: 0 }, P1), { heroForm: 0 }, P2);
  const staged = activeEncounterDeck(heroes)
    .deck.slice(0, 8)
    .reduce((acc, id) => patchInstance(acc, id, { cardId: cardId(boostCard) }), heroes);
  const klaw = staged.activeVillainId!;
  const engagedWith = (s: GameState, player: PlayerId): number =>
    Object.values(s.instances).filter((i) => i.cardId === cardId(boostCard) && i.engagedWith === player).length;
  const read = (s: GameState): Seen => ({
    engaged: { [P1]: engagedWith(s, P1), [P2]: engagedWith(s, P2) },
    boostCards: inst(s, klaw).boostCards.length,
  });
  const attacks: { readonly asked: PlayerId; readonly seen: Seen }[] = [];
  /** Each player's hand as the attack on Iron Man is defended. */
  let hands: Record<PlayerId, number> = {};
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind !== "declareDefender" || choice.prompt.attack.enemyInstanceId !== klaw) return firstLegal(s);
    if (attacks.length === 0) hands = { [P1]: playerOf(s, P1).hand.length, [P2]: playerOf(s, P2).hand.length };
    attacks.push({ asked: choice.playerId, seen: read(s) });
    // Only the attack on Iron Man is defended; the attack on Spider-Man that follows is left alone.
    return [attacks.length === 1 ? defender(s) : "decline"];
  };
  const { events } = driveEventsPicking(CORE_DEPS, staged, pick, endTurn(P1), endTurn(P2));
  expect(attacks.map((a) => a.asked)).toEqual([P1, P2]);
  const activations = events.flatMap((e, index) => (e.type === "enemyActivated" ? [{ index, event: e }] : []));
  expect(activations[0]!.event).toMatchObject({ enemyInstanceId: klaw, activation: "attack", playerId: P1 });
  const during = events.slice(activations[0]!.index, activations[1]!.index);
  const discardedBy = (player: PlayerId): number =>
    during.filter((e) => e.type === "cardDiscardedFromHand" && e.playerId === player).length;
  const discarded = { [P1]: discardedBy(P1), [P2]: discardedBy(P2) };
  const [before, after] = [attacks[0]!.seen, attacks[1]!.seen];
  // Klaw I: the attack's own boost card and his additional one.
  expect(before.boostCards).toBe(2);
  return { before, after, boosts: before.boostCards, hands, discarded };
}

describe("Radioactive Man (01129), 'Boost: Discard 1 card at random from your hand.', two players", () => {
  it("nobody defends: the attacked player discards, as far as their hand goes", () => {
    const { hands, discarded } = klawAttacksIronMan(RADIOACTIVE_MAN, () => "decline");
    // Iron Man's hero hand size is 1: one card to lose to two boost cards.
    expect(hands).toEqual({ [P1]: 1, [P2]: 5 });
    expect(discarded).toEqual({ [P1]: 1, [P2]: 0 });
  });

  it("the other player's hero defends: the defending player discards, the attacked player keeps their hand", () => {
    const { boosts, discarded } = klawAttacksIronMan(RADIOACTIVE_MAN, (s) => identityOf(s, P2));
    expect(discarded).toEqual({ [P1]: 0, [P2]: boosts });
  });
});

describe("Weapons Runner (01121), 'Boost: Put Weapons Runner into play engaged with you.', two players", () => {
  it("nobody defends: each one engages the attacked player", () => {
    const { before, after, boosts } = klawAttacksIronMan(WEAPONS_RUNNER, () => "decline");
    expect(after.engaged[P1]).toBe(before.engaged[P1]! + boosts);
    expect(after.engaged[P2]).toBe(before.engaged[P2]);
  });

  it("the other player's hero defends: each one engages the defending player", () => {
    const { before, after, boosts } = klawAttacksIronMan(WEAPONS_RUNNER, (s) => identityOf(s, P2));
    expect(after.engaged[P2]).toBe(before.engaged[P2]! + boosts);
    expect(after.engaged[P1]).toBe(before.engaged[P1]);
  });
});
