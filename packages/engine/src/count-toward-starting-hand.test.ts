/**
 * docs/phase7-wave8.md §3.44: a card found at campaign setup that counts toward the starting hand (`EffectSpec
 * countTowardStartingHand`, `PlayerState.startingHandCredit`).
 *
 * MC45 p. 20, the fifth bullet of every scenario's Campaign Instructions: "Each player searches their deck for an ally
 * and adds it to their hand. (This card counts towards your hand size.)" RRG 1.8 Appendix II steps 13 to 15 (p. 51);
 * "Hand Size" (p. 21); "Search" (p. 39). The starting draw is a counted draw of hand-size cards
 * (docs/campaign-mode-design.md Q20), so without the credit the found card would be a seventh.
 *
 * Synthetic cards and a synthetic campaign: the instruction is the search followed by the credit.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import { DEFAULT_DEPS } from "./abilities.js";
import type { ResolvedInstruction } from "./campaign.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { handSize, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { syntheticCampaignInput, syntheticInstruction } from "./testing/campaign.js";
import { ALLY, HERO, newGameAtMulligan, RESOURCE, seatIdentities, UPGRADE } from "./testing/scenario.js";

const scoped = { kind: "scoped" } as const;
const FOUND = "found";

/** "Each player searches their deck for an ally and adds it to their hand. (This card counts towards your hand size.)" */
const ALLY_SEARCH: EffectSpec = {
  kind: "forEachPlayer",
  players: { kind: "each" },
  effects: [
    {
      kind: "chooseCards",
      slot: FOUND,
      from: { kind: "zone", zone: "deck", player: scoped, filter: { categories: ["ally"] } },
      chooser: scoped,
      min: 0,
      max: 1,
    },
    { kind: "moveCards", cards: { kind: "ref", ref: { kind: "slot", slot: FOUND } }, to: "hand" },
    { kind: "shuffleDeck", player: scoped },
    {
      kind: "countTowardStartingHand",
      player: scoped,
      amount: { kind: "refCount", of: { kind: "slot", slot: FOUND } },
    },
  ],
};
const credit = (amount: number): EffectSpec => ({
  kind: "countTowardStartingHand",
  player: { kind: "each" },
  amount: { kind: "const", value: amount },
});
const SEARCH = [syntheticInstruction("ally.search", "afterScenarioSetup", [ALLY_SEARCH])];

const repeat = (id: CardId, count: number): readonly CardId[] => Array.from({ length: count }, () => id);
const WITH_ALLIES = [...repeat(RESOURCE.id, 12), ...repeat(ALLY.id, 6), ...repeat(UPGRADE.id, 6)];
const NO_ALLY = [...repeat(RESOURCE.id, 14), ...repeat(UPGRADE.id, 10)];

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const isAlly = (state: GameState, id: InstanceId): boolean => state.instances[id]?.cardId === ALLY.id;
const drawnBy = (events: readonly GameEvent[], playerId: PlayerId): number =>
  of(events, "cardDrawn").filter((e) => e.playerId === playerId).length;

interface Run {
  session: GameSession;
  events: GameEvent[];
}
/** Answers the open choice with `selected`. */
function answer(run: Run, selected: readonly string[]): void {
  const choice = run.session.state.pendingChoice;
  if (!choice) throw new Error("no choice is open");
  const result = sessionApply(
    run.session,
    { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: selected },
    DEFAULT_DEPS,
  );
  if (!result.ok) throw new Error(result.error.message);
  run.session = result.session;
  run.events.push(...result.events);
}

/**
 * A game driven from creation until the first mulligan prompt is open. `find`: whether a player takes an ally when
 * the search offers one. `instructions`: `null` is a standalone game.
 */
function toMulligan(
  options: {
    readonly players?: number;
    readonly deck?: readonly CardId[];
    readonly find?: (playerId: PlayerId) => boolean;
    readonly instructions?: readonly ResolvedInstruction[] | null;
  } = {},
) {
  const players = options.players ?? 1;
  const identities = seatIdentities(HERO, players);
  const instructions = options.instructions === undefined ? SEARCH : options.instructions;
  const created = newGameAtMulligan({
    players,
    deck: options.deck ?? WITH_ALLIES,
    ...(instructions === null
      ? {}
      : {
          campaign: syntheticCampaignInput({
            instructions,
            seats: identities.map((identity, seat) => ({
              seatNumber: seat + 1,
              identityCardId: identity.id,
              deck: [],
              aspects: [],
              grantedCardIds: [],
            })),
          }),
        }),
  });
  const run: Run = { session: startSession(created), events: [] };
  const searches: PlayerId[] = [];
  const found = new Map<PlayerId, InstanceId>();
  for (let guard = 0; guard < 20; guard++) {
    const choice = run.session.state.pendingChoice;
    if (!choice || choice.prompt.kind === "mulligan") break;
    searches.push(choice.playerId);
    const take = (options.find ?? (() => true))(choice.playerId) ? choice.options[0]?.optionId : undefined;
    if (take !== undefined) found.set(choice.playerId, take as InstanceId);
    answer(run, take === undefined ? [] : [take]);
  }
  return { run, created, searches, found };
}
const playerIds = (state: GameState): readonly PlayerId[] => state.players.map((p) => p.playerId);

describe("§3.44 a found card counts toward the starting hand", () => {
  it("a hand size of 6: after campaign setup the player holds 1 card, draws 5 and holds 6; a mulligan of the ally and 2 others draws 3", () => {
    const { run, created, searches, found } = toMulligan();
    const [p1] = playerIds(created) as [PlayerId];
    expect(handSize(created, p1, DEFAULT_DEPS)).toBe(6);
    // Campaign setup comes before the draw: the search was asked with an empty hand.
    expect(mustPlayer(created, p1).hand).toHaveLength(0);
    expect(searches).toEqual([p1]);
    const ally = found.get(p1)!;
    expect(isAlly(created, ally)).toBe(true);

    expect(of(run.events, "startingHandCredited")).toEqual([
      { type: "startingHandCredited", playerId: p1, amount: 1, credit: 1 },
    ]);
    expect(of(run.events, "startingHandCreditApplied")).toEqual([
      { type: "startingHandCreditApplied", playerId: p1, handSize: 6, credit: 1, drawn: 5 },
    ]);
    expect(drawnBy(run.events, p1)).toBe(5);
    const atMulligan = run.session.state;
    const hand = mustPlayer(atMulligan, p1).hand;
    expect(hand).toHaveLength(6);
    expect(hand).toContain(ally);
    // The draw cleared the credit.
    expect(mustPlayer(atMulligan, p1)).not.toHaveProperty("startingHandCredit");
    expect(atMulligan.pendingChoice?.prompt).toMatchObject({ kind: "mulligan", handSize: 6 });

    // The ordinary mulligan: the found ally may be discarded, and the player draws back up to hand size.
    const others = hand.filter((id) => id !== ally).slice(0, 2);
    const before = run.events.length;
    answer(run, [ally, ...others]);
    const after = run.session.state;
    expect(drawnBy(run.events.slice(before), p1)).toBe(3);
    expect(mustPlayer(after, p1).hand).toHaveLength(6);
    expect(mustPlayer(after, p1).discard).toEqual(expect.arrayContaining([ally, ...others]));

    const replayed = replay(run.session.log, DEFAULT_DEPS);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(after);
  });

  it("a deck with no ally: nothing found, no credit, 6 drawn", () => {
    const { run, created } = toMulligan({ deck: NO_ALLY });
    const [p1] = playerIds(created) as [PlayerId];
    expect(of(run.events, "startingHandCredited")).toHaveLength(0);
    expect(of(run.events, "startingHandCreditApplied")).toHaveLength(0);
    // Nobody was asked after creation, so the draw happened as the game was created: the hand is the evidence.
    expect(mustPlayer(run.session.state, p1).hand).toHaveLength(6);
    expect(mustPlayer(run.session.state, p1).hand.some((id) => isAlly(run.session.state, id))).toBe(false);
  });

  it("a player who declines the search draws 6; in a two-player game only the player who found a card draws one fewer", () => {
    const { run, created, searches, found } = toMulligan({
      players: 2,
      find: (playerId) => playerId === playerIds(game2).at(1),
    });
    const [p1, p2] = playerIds(created) as [PlayerId, PlayerId];
    // Player order.
    expect(searches).toEqual([p1, p2]);
    expect([...found.keys()]).toEqual([p2]);
    expect(of(run.events, "startingHandCreditApplied")).toEqual([
      { type: "startingHandCreditApplied", playerId: p2, handSize: 6, credit: 1, drawn: 5 },
    ]);
    expect(drawnBy(run.events, p1)).toBe(6);
    expect(drawnBy(run.events, p2)).toBe(5);
    for (const id of [p1, p2]) expect(mustPlayer(run.session.state, id).hand).toHaveLength(6);
  });

  it("a standalone game of the same deck: 6 drawn, no search", () => {
    const { run, searches } = toMulligan({ instructions: null });
    const [p1] = playerIds(run.session.state) as [PlayerId];
    expect(searches).toEqual([]);
    expect(mustPlayer(run.session.state, p1).hand).toHaveLength(6);
    expect(run.session.state.pendingChoice?.prompt.kind).toBe("mulligan");
  });
});

/** The two-seat table's player ids, read once so a `find` callback can name the second seat. */
const game2 = newGameAtMulligan({ players: 2, deck: NO_ALLY });

describe("§3.44 the credit itself", () => {
  it("credits add up, and a credit larger than the hand size draws nothing (never below 0); the mulligan then draws up", () => {
    const { run, created } = toMulligan({
      deck: NO_ALLY,
      instructions: [
        syntheticInstruction("credit.a", "afterScenarioSetup", [credit(4)]),
        syntheticInstruction("credit.b", "beforePlayerSetup", [credit(5), credit(0), credit(-2)]),
      ],
    });
    const [p1] = playerIds(created) as [PlayerId];
    // Every step ran inside creation (no choice was asked), so read the result: nothing drawn at step 14, and the
    // mulligan prompt is not opened for an empty hand, whose draw up to hand size makes the six.
    const state = run.session.state;
    expect(mustPlayer(state, p1)).not.toHaveProperty("startingHandCredit");
    expect(mustPlayer(state, p1).hand).toHaveLength(6);
    expect(state.step.phase).not.toBe("setup");
  });

  it("the last window before the draw still counts; once the starting hands are drawn the effect does nothing", () => {
    const late = toMulligan({
      deck: NO_ALLY,
      instructions: [syntheticInstruction("credit.late", "afterMulligans", [credit(2)])],
    });
    const [p1] = playerIds(late.created) as [PlayerId];
    expect(mustPlayer(late.run.session.state, p1).hand).toHaveLength(6);
    answer(late.run, []);
    const settled = late.run.session.state;
    expect(of(late.run.events, "startingHandCredited")).toHaveLength(0);
    expect(mustPlayer(settled, p1)).not.toHaveProperty("startingHandCredit");
    expect(mustPlayer(settled, p1).hand).toHaveLength(6);

    const early = toMulligan({
      deck: NO_ALLY,
      instructions: [syntheticInstruction("credit.early", "beforePlayerSetup", [credit(2)])],
    });
    // Four drawn at step 14; the mulligan prompt shows the four.
    expect(mustPlayer(early.run.session.state, p1).hand).toHaveLength(4);
    answer(early.run, []);
    // Keeping the hand still draws back up to hand size (step 15).
    expect(mustPlayer(early.run.session.state, p1).hand).toHaveLength(6);
  });
});
