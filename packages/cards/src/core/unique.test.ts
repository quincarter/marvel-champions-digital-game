import { applyCommand, legalActions, type Command, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { CORE_DEPS } from "./index.js";
import { coreScenario } from "./setup.js";
import { endTurn, moveToHand, P1, P2, play, playerOf, run, settle, startCoreGame, toHero } from "../testing/harness.js";

/**
 * RRG 1.8 "Unique Icon" (pp. 45–46), on the table PLAN.md said the deviation was reachable
 * from: "Mockingbird and Nick Fury are in all six Core starter decks, so any two-player
 * table can put two copies of a unique ally into play."
 */
const twoSeats = (): GameState =>
  startCoreGame(
    coreScenario("rhino", {
      players: [{ starterDeckId: "core-captain-marvel-leadership" }, { starterDeckId: "core-spider-man-justice" }],
      seed: 7,
    }),
  );

const rejected = (state: GameState, command: Command) => {
  const result = applyCommand(state, command, CORE_DEPS);
  if (result.ok) throw new Error(`${command.type} was accepted but should not have been`);
  return result.error;
};

/** Plays a card, paying with `cost` other hand cards, and answers everything it opens. */
function playAndSettle(
  state: GameState,
  player: PlayerId,
  card: InstanceId,
  cost: number,
  reserve: readonly InstanceId[] = [],
): GameState {
  const payment = playerOf(state, player)
    .hand.filter((id) => id !== card && !reserve.includes(id))
    .slice(0, cost);
  if (payment.length < cost) throw new Error(`${player} has fewer than ${cost} spare cards in hand`);
  return settle(run(state, play(player, card, payment)));
}

const passTo = (state: GameState, player: PlayerId): GameState =>
  settle(run(settle(state), endTurn(P1), toHero(player)));

describe("RRG 'Unique Icon' with real Core content", () => {
  /** Puts one copy of `code` in each player's hand and plays p1's; returns the state on p2's turn. */
  function onePlayedEachInHand(code: string, cost: number) {
    const forP1 = moveToHand(twoSeats(), P1, code);
    const forP2 = moveToHand(forP1.state, P2, code);
    const [p1Copy] = forP1.ids as [InstanceId];
    const [p2Copy] = forP2.ids as [InstanceId];
    const played = playAndSettle(run(forP2.state, toHero(P1)), P1, p1Copy, cost);
    expect(playerOf(played, P1).playArea).toContain(p1Copy);
    return { onP2Turn: passTo(played, P2), p1Copy, p2Copy };
  }

  it("two players cannot each put Mockingbird into play (01083, subtitle 'Bobbi Morse')", () => {
    const { onP2Turn, p2Copy } = onePlayedEachInHand("01083", 3);
    const payment = playerOf(onP2Turn, P2)
      .hand.filter((id) => id !== p2Copy)
      .slice(0, 3);
    const error = rejected(onP2Turn, play(P2, p2Copy, payment));
    expect(error.code).toBe("duplicate_unique_card");
    expect(error.message).toContain("Mockingbird (Bobbi Morse)");
    expect(error.message).toContain("only one copy of each unique card in play");
  });

  it("two players cannot each put Nick Fury into play (01084, no subtitle — the bare-title branch)", () => {
    const { onP2Turn, p2Copy } = onePlayedEachInHand("01084", 4);
    const payment = playerOf(onP2Turn, P2)
      .hand.filter((id) => id !== p2Copy)
      .slice(0, 4);
    const error = rejected(onP2Turn, play(P2, p2Copy, payment));
    expect(error.code).toBe("duplicate_unique_card");
    expect(error.message).toContain("Nick Fury");
  });

  it("legalActions greys the second copy instead of letting the player click into an error", () => {
    const { onP2Turn, p2Copy } = onePlayedEachInHand("01083", 3);
    const actions = legalActions(onP2Turn, P2, CORE_DEPS);
    if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
    expect(actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === p2Copy)).toBe(false);
    const illegal = actions.illegal.find((a) => a.action.kind === "playCard" && a.action.instanceId === p2Copy);
    expect(illegal?.reason).toBe("duplicate_unique_card");
    expect(illegal?.message).toContain("Mockingbird (Bobbi Morse)");
  });

  it("allies that only share a franchise still coexist: Black Panther/T'Challa beside the Shuri ally (01041)", () => {
    const state = startCoreGame(
      coreScenario("rhino", { players: [{ starterDeckId: "core-black-panther-protection" }], seed: 3 }),
    );
    const given = moveToHand(state, P1, "01041");
    const [shuri] = given.ids as [InstanceId];
    const after = playAndSettle(run(given.state, toHero(P1)), P1, shuri, 4);
    expect(playerOf(after, P1).playArea).toContain(shuri);
  });
});

describe("Make the Call (01071) and RRG 'Unique Icon'", () => {
  /** p1 holding Nick Fury and Make the Call, with a second Nick Fury already in p2's discard pile. */
  function table() {
    const forP1 = moveToHand(twoSeats(), P1, "01084", "01071");
    const [fury, call] = forP1.ids as [InstanceId, InstanceId];
    const forP2 = moveToHand(forP1.state, P2, "01084");
    const [p2Fury] = forP2.ids as [InstanceId];
    const seeded: GameState = {
      ...forP2.state,
      players: forP2.state.players.map((seat) =>
        seat.playerId === P2
          ? { ...seat, hand: seat.hand.filter((id) => id !== p2Fury), discard: [p2Fury, ...seat.discard] }
          : seat,
      ),
    };
    return { seeded: run(seeded, toHero(P1)), fury, call, p2Fury };
  }

  it("refuses to call an ally that matches one already in play, and charges nothing for the refusal", () => {
    const { seeded, fury, call, p2Fury } = table();
    const played = playAndSettle(seeded, P1, fury, 4, [call]);
    expect(playerOf(played, P1).playArea).toContain(fury);
    const error = rejected(played, play(P1, call, [], { costChoices: { ally: [p2Fury] } }));
    expect(error.code).toBe("duplicate_unique_card");
    expect(error.message).toContain("Nick Fury");
    // Nothing moved: Make the Call is still in hand and p2's copy is still in their discard pile.
    expect(playerOf(played, P1).hand).toContain(call);
    expect(playerOf(played, P2).discard).toContain(p2Fury);
  });

  it("legalActions reports that ally as a blocked target, not as a legal pick", () => {
    const { seeded, fury, call, p2Fury } = table();
    const played = playAndSettle(seeded, P1, fury, 4, [call]);
    const actions = legalActions(played, P1, CORE_DEPS);
    if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
    const forCall =
      actions.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === call) ??
      actions.illegal.find((a) => a.action.kind === "playCard" && a.action.instanceId === call);
    expect(forCall).toBeDefined();
    expect(forCall && "targets" in forCall ? forCall.targets : []).not.toContain(p2Fury);
    expect(forCall?.blockedTargets.find((b) => b.instanceId === p2Fury)?.reason).toBe("duplicate_unique_card");
  });

  it("still works normally when nothing matches: the ally leaves the discard pile and enters play", () => {
    const { seeded, call, p2Fury } = table();
    const payment = playerOf(seeded, P1)
      .hand.filter((id) => id !== call)
      .slice(0, 4);
    const played = settle(run(seeded, play(P1, call, payment, { costChoices: { ally: [p2Fury] } })));
    expect(playerOf(played, P1).playArea).toContain(p2Fury);
    expect(playerOf(played, P2).discard).not.toContain(p2Fury);
  });
});
